import type { BranchEntity, DeviceEntity, Entity, LineKind, Pt, TextEntity, VoltageKv } from '../core/types';
import { newId } from '../core/doc';
import { layerOf } from '../core/voltage';
import { emptyBox, growBox, rotate, type Box } from '../core/geom';
import { getBlock } from '../symbols/blocks';

/**
 * NHAP FILE DXF TU CAD.
 *
 * Dung cho cong doan 2: cac so do luoi trung ap roi rac ve bang CAD duoc xuat
 * ra DXF (lenh SAVEAS -> *.dxf trong AutoCAD/GstarCAD/VinaCAD) roi nhap vao day.
 *
 * Chuong trinh se:
 *  - doc LINE / LWPOLYLINE / POLYLINE / CIRCLE / ARC / TEXT / MTEXT / INSERT,
 *  - "no" cac block long nhau (toi da 6 cap),
 *  - doan cap dien ap tu TEN LOP (110 / 35 / 22 / 10 / 6 / 0,4),
 *  - nhan dang thiet bi tu TEN BLOCK (MC, DCL, TI, TU, CSV, Recloser, MBA...),
 *  - gop cac doan thang noi tiep thanh mot tuyen de de sua.
 */

/* ------------------------------ doc DXF ------------------------------- */

interface Rec {
  type: string;
  /** Ma nhom -> danh sach gia tri (co the lap lai, VD 10/20 cua LWPOLYLINE). */
  p: Map<number, string[]>;
}

function parseRecords(text: string): Rec[] {
  const lines = text.split(/\r\n|\r|\n/);
  const recs: Rec[] = [];
  let cur: Rec | null = null;
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number(lines[i].trim());
    const value = lines[i + 1];
    if (!Number.isFinite(code)) continue;
    if (code === 0) {
      cur = { type: value.trim().toUpperCase(), p: new Map() };
      recs.push(cur);
    } else if (cur) {
      const arr = cur.p.get(code);
      if (arr) arr.push(value);
      else cur.p.set(code, [value]);
    }
  }
  return recs;
}

const num = (r: Rec, code: number, idx = 0, dflt = 0): number => {
  const v = r.p.get(code)?.[idx];
  const n = v === undefined ? NaN : Number(v.trim());
  return Number.isFinite(n) ? n : dflt;
};
const str = (r: Rec, code: number, dflt = ''): string => (r.p.get(code)?.[0] ?? dflt).trim();
const strU = (r: Rec, code: number, dflt = ''): string => decodeDxfUnicode(str(r, code, dflt));

/* --------------------------- hinh hoc phang --------------------------- */

interface Seg {
  a: Pt;
  b: Pt;
  layer: string;
}
interface Circ {
  c: Pt;
  r: number;
  layer: string;
}
interface Txt {
  p: Pt;
  s: string;
  h: number;
  rot: number;
  layer: string;
}
interface Dev {
  p: Pt;
  rot: number;
  /** Hệ số tỷ lệ CÓ DẤU (âm = lật gương như trong CAD). */
  sx: number;
  block: string;
  layer: string;
  /** Tên block gốc trong CAD - dùng để đoán cấp điện áp. */
  cadName: string;
  /** Trạng thái đóng/mở suy ra từ tên block ("22-DCL Mo" -> mở). */
  state?: 'dong' | 'mo';
}

interface Flat {
  segs: Seg[];
  circles: Circ[];
  texts: Txt[];
  devices: Dev[];
}

interface Mat {
  x: number;
  y: number;
  sx: number;
  sy: number;
  rot: number;
}

const IDENT: Mat = { x: 0, y: 0, sx: 1, sy: 1, rot: 0 };

function apply(m: Mat, p: Pt): Pt {
  const r = (m.rot * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const x = p.x * m.sx;
  const y = p.y * m.sy;
  return { x: x * c - y * s + m.x, y: x * s + y * c + m.y };
}

function compose(outer: Mat, inner: Mat): Mat {
  const p = apply(outer, { x: inner.x, y: inner.y });
  return {
    x: p.x,
    y: p.y,
    sx: outer.sx * inner.sx,
    sy: outer.sy * inner.sy,
    rot: outer.rot + inner.rot,
  };
}

/**
 * Giai ma chuoi thoat Unicode cua DXF.
 * CAD ghi ky tu ngoai bang ma hien hanh duoi dang \\U+00EA (e mu), \\M+1EC7...
 * Khong giai ma thi ten lop / chu tieng Viet se hien sai.
 */
export function decodeDxfUnicode(s: string): string {
  return s
    .replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\M\+[0-9A-Fa-f]([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/** Bo ma dinh dang cua MTEXT de lay chu thuan. */
export function cleanMText(s: string): string {
  return decodeDxfUnicode(s)
    .replace(/\\f[^;]*;/g, '')
    .replace(/\\[Ff][^;]*;/g, '')
    .replace(/[{}]/g, '')
    .replace(/\\P/g, ' ')
    .replace(/\\[A-Za-z][-0-9.x,]*;?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* --------------------- nhan dang cap dien ap & block ------------------- */

export function kvFromLayer(layer: string): VoltageKv | null {
  const s = layer.toLowerCase();
  if (/(^|[^0-9])500([^0-9]|$)/.test(s)) return 500;
  if (/(^|[^0-9])220([^0-9]|$)/.test(s)) return 220;
  if (/(^|[^0-9])110([^0-9]|$)/.test(s)) return 110;
  if (/(^|[^0-9])35([^0-9]|$)/.test(s)) return 35;
  if (/(^|[^0-9])22([^0-9]|$)/.test(s)) return 22;
  if (/0[.,]4/.test(s)) return 0.4;
  if (/(^|[^0-9])10([^0-9]|$)/.test(s)) return 10;
  if (/(^|[^0-9])6([^0-9]|$)/.test(s)) return 6;
  return null;
}

/** Suy ra loai duong day tu ten lop (cap ngam / DDK / thanh cai). */
export function lineKindFromLayer(layer: string): LineKind {
  const s = layer.toLowerCase().replace(/\s+/g, '');
  if (/thanhcai|thanhcái|busbar|^tc$|^tc[-_]/.test(s)) return 'Thanh cái';
  if (/c[aá]png[aâ]m|cable|capngam|ngam/.test(s)) return 'Cáp ngầm';
  if (/v[aặ]nxo[aắ]n|abc|axv/.test(s)) return 'Cáp vặn xoắn';
  return 'ĐDK';
}

const BLOCK_RULES: [RegExp, string, 'dong' | 'mo' | undefined][] = [
  [/mchb|mc\s*h[ơo]p\s*b[ộo]/i, 'MCHB', 'dong'],
  [/recloser|(^|[^a-z])r(ec)?($|[^a-z])/i, 'REC', 'dong'],
  [/dclhb|dclh\s*b[ộo]/i, 'DCLHB', 'dong'],
  [/dcl.*(mo|m[ởo]|c[aắ]t|open)/i, 'DCL', 'mo'],
  [/dao\s*c[aá]ch\s*ly|dcl/i, 'DCL', 'dong'],
  [/ti[eế]p\s*[dđ][ịi]a|tiep\s*dia|earth/i, 'DTD', 'mo'],
  [/csv|ch[oố]ng\s*s[eé]t/i, 'CSV', undefined],
  [/lbs/i, 'LBS', 'dong'],
  [/c[aầ]u\s*ch[iì]|fco|\bcc\b/i, 'FCO', 'dong'],
  [/mba.*ph[aâ]n\s*ph[oố]i|mba\s*\d+\s*-\s*0[.,]4/i, 'MBAPP', undefined],
  [/mba\s*\d+\s*-\s*\d+\s*-\s*\d+|at\b/i, 'MBA3', undefined],
  [/mba/i, 'MBA2', undefined],
  [/tuc/i, 'TUC', undefined],
  [/\btu\b|tu\d|bi[eế]n\s*[dđ]i[eệ]n\s*[aá]p/i, 'TU', undefined],
  [/\bti\b|ti\d|bi[eế]n\s*d[oò]ng/i, 'TI', undefined],
  [/kh[aá]ng/i, 'KHANG', undefined],
  [/t[uụ]\s*b[uù]|^t[uụ]\b/i, 'TUBU', undefined],
  [/svc/i, 'SVC', undefined],
  [/b[ộo]\s*[dđ]o\s*[dđ][eế]m|bdd/i, 'BDD', undefined],
  [/c[oộ]t/i, 'COT', undefined],
  [/[dđ][aầ]u\s*c[aá]p/i, 'DAUCAP', undefined],
];

/**
 * Đoán cấp điện áp từ TÊN BLOCK.
 *
 * Trong bản vẽ của Phòng Điều độ, tên block luôn mang tiền tố cấp điện áp
 * ("110-MC", "35-DCL", "22-MCHB", "MBA 110-35-22", "MC cơ 22", "TUC 110"...),
 * nên đây là căn cứ tin cậy hơn nhiều so với tên lớp của đối tượng chèn:
 * cùng một máy cắt 110kV có thể được chèn trên lớp bất kỳ tuỳ người vẽ.
 */
export function kvFromBlockName(name: string): VoltageKv | null {
  const m = name.match(/(?:^|[^0-9.,])(500|220|110|35|22|10|6|0[.,]4)(?![0-9])/);
  if (!m) return null;
  const v = m[1].replace(',', '.');
  const kv = Number(v);
  return ([500, 220, 110, 35, 22, 10, 6, 0.4] as number[]).includes(kv) ? (kv as VoltageKv) : null;
}

export function blockFromName(name: string): { block: string; state?: 'dong' | 'mo' } | null {
  for (const [re, block, state] of BLOCK_RULES) {
    if (re.test(name)) return state ? { block, state } : { block };
  }
  // "110-MC", "22-MC", "MC cơ 22"...
  if (/(^|[^a-z])mc([^a-z]|$)/i.test(name)) return { block: 'MC', state: 'dong' };
  return null;
}

/* ------------------- suy cap dien ap tu ky hieu ngan lo ---------------- */

/**
 * Chữ số đầu của tên thiết bị cho biết cấp điện áp (quy ước đặt tên thiết bị
 * trong Quy trình Điều độ hệ thống điện quốc gia — Thông tư 06/2025/TT-BCT):
 *   171 → 110kV · 271 → 220kV · 331 → 35kV · 431 → 22kV · 571 → 500kV
 *   671 → 6kV  · 771 → 10kV  · 971 → 0,4kV
 * Thanh cái cũng theo quy ước này: C11/C12 là 110kV, C31/C32 là 35kV,
 * C41/C42 là 22kV, C61/C62 là 6kV.
 */
export const KV_THEO_CHU_SO_DAU: Record<string, VoltageKv> = {
  '1': 110,
  '2': 220,
  '3': 35,
  '4': 22,
  '5': 500,
  '6': 6,
  '7': 10,
  '9': 0.4,
};

/**
 * Đọc cấp điện áp từ ký hiệu ngăn lộ / thiết bị trên bản vẽ.
 * Chỉ nhận các dạng thật sự là tên thiết bị (171, 171-7, TU171, TI131, C41,
 * 431-1…) và bỏ qua mọi thứ trông giống số nhưng không phải (AC-240, 250kVA,
 * 115/38,5/6,3 kV, 2x40 MVA…), nếu không sẽ đoán sai hàng loạt.
 */
export function kvFromDesignation(text: string): VoltageKv | null {
  const s = text.trim();
  if (!s || s.length > 16) return null;
  // Loại các chuỗi có đơn vị đo hoặc mã hiệu dây dẫn
  if (/kv|kva|mva|mvar|km|mm|ac-|acsr|tacsr|cu\/|al\/|xlpe|abc|axv|\d,\d|\d\/\d/i.test(s)) return null;

  // Thanh cái: C11, C31, C41, C62…
  let m = s.match(/^C\s?([1-9])[1-9]$/i);
  if (m) return KV_THEO_CHU_SO_DAU[m[1]] ?? null;

  // Ngăn lộ / thiết bị: 171, 171-7, 431-15, TU171, TI131, MC 371, CS-1T1…
  m = s.match(/^(?:TU|TI|TUC|MC|DCL|DTD|LBS|REC|R|CC|CS)?[-\s]?([1-9])\d{2}(?:[-\s]?\d{1,2})?$/i);
  if (m) return KV_THEO_CHU_SO_DAU[m[1]] ?? null;
  return null;
}

/** Chỉ mục lưới đơn giản để tìm gợi ý cấp điện áp gần nhất cho nhanh. */
class HintGrid {
  private cells = new Map<string, { p: Pt; kv: VoltageKv }[]>();

  constructor(private cell: number) {}

  add(p: Pt, kv: VoltageKv): void {
    const k = `${Math.floor(p.x / this.cell)}|${Math.floor(p.y / this.cell)}`;
    const a = this.cells.get(k);
    if (a) a.push({ p, kv });
    else this.cells.set(k, [{ p, kv }]);
  }

  get size(): number {
    let n = 0;
    for (const a of this.cells.values()) n += a.length;
    return n;
  }

  /** Cấp điện áp của gợi ý gần nhất trong bán kính `maxR`, hoặc null. */
  nearest(p: Pt, maxR: number): VoltageKv | null {
    const cx = Math.floor(p.x / this.cell);
    const cy = Math.floor(p.y / this.cell);
    const maxRing = Math.ceil(maxR / this.cell);
    let best: VoltageKv | null = null;
    let bestD = maxR;
    for (let r = 0; r <= maxRing; r++) {
      for (let i = cx - r; i <= cx + r; i++) {
        for (let j = cy - r; j <= cy + r; j++) {
          // chỉ quét viền của vòng r
          if (r > 0 && i !== cx - r && i !== cx + r && j !== cy - r && j !== cy + r) continue;
          const a = this.cells.get(`${i}|${j}`);
          if (!a) continue;
          for (const h of a) {
            const d = Math.hypot(h.p.x - p.x, h.p.y - p.y);
            if (d < bestD) {
              bestD = d;
              best = h.kv;
            }
          }
        }
      }
      // Đã tìm được trong vòng r thì vòng ngoài không thể gần hơn (r-1) ô
      if (best !== null && bestD <= r * this.cell) break;
    }
    return best;
  }
}

/* ------------------------------ lam phang ----------------------------- */

function flatten(recs: Rec[]): Flat {
  // Tach BLOCKS va ENTITIES
  const blocks = new Map<string, { base: Pt; recs: Rec[] }>();
  const entities: Rec[] = [];
  let section = '';
  let curBlock: { name: string; base: Pt; recs: Rec[] } | null = null;

  for (const r of recs) {
    if (r.type === 'SECTION') {
      section = str(r, 2).toUpperCase();
      continue;
    }
    if (r.type === 'ENDSEC') {
      section = '';
      continue;
    }
    if (section === 'BLOCKS') {
      if (r.type === 'BLOCK') {
        curBlock = { name: strU(r, 2), base: { x: num(r, 10), y: num(r, 20) }, recs: [] };
        blocks.set(curBlock.name.toUpperCase(), { base: curBlock.base, recs: curBlock.recs });
      } else if (r.type === 'ENDBLK') {
        curBlock = null;
      } else if (curBlock) {
        curBlock.recs.push(r);
      }
    } else if (section === 'ENTITIES') {
      entities.push(r);
    }
  }

  const out: Flat = { segs: [], circles: [], texts: [], devices: [] };

  const walk = (list: Rec[], m: Mat, depth: number, inheritLayer?: string): void => {
    if (depth > 6) return;
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      const layer = strU(r, 8, inheritLayer ?? '0') || inheritLayer || '0';
      switch (r.type) {
        case 'LINE':
          out.segs.push({
            a: apply(m, { x: num(r, 10), y: num(r, 20) }),
            b: apply(m, { x: num(r, 11), y: num(r, 21) }),
            layer,
          });
          break;
        case 'LWPOLYLINE': {
          const xs = r.p.get(10) ?? [];
          const ys = r.p.get(20) ?? [];
          const closed = (num(r, 70) & 1) === 1;
          const pts: Pt[] = [];
          for (let k = 0; k < Math.min(xs.length, ys.length); k++) {
            pts.push(apply(m, { x: Number(xs[k]), y: Number(ys[k]) }));
          }
          for (let k = 1; k < pts.length; k++) out.segs.push({ a: pts[k - 1], b: pts[k], layer });
          if (closed && pts.length > 2) out.segs.push({ a: pts[pts.length - 1], b: pts[0], layer });
          break;
        }
        case 'POLYLINE': {
          const pts: Pt[] = [];
          let j = i + 1;
          for (; j < list.length && list[j].type === 'VERTEX'; j++) {
            pts.push(apply(m, { x: num(list[j], 10), y: num(list[j], 20) }));
          }
          if (j < list.length && list[j].type === 'SEQEND') j++;
          i = j - 1;
          const closed = (num(r, 70) & 1) === 1;
          for (let k = 1; k < pts.length; k++) out.segs.push({ a: pts[k - 1], b: pts[k], layer });
          if (closed && pts.length > 2) out.segs.push({ a: pts[pts.length - 1], b: pts[0], layer });
          break;
        }
        case 'CIRCLE':
          out.circles.push({
            c: apply(m, { x: num(r, 10), y: num(r, 20) }),
            r: num(r, 40) * Math.abs(m.sx),
            layer,
          });
          break;
        case 'ARC': {
          // Xap xi cung bang cac doan thang de don gian hoa mo hinh.
          const c = { x: num(r, 10), y: num(r, 20) };
          const rad = num(r, 40);
          let a0 = num(r, 50);
          let a1 = num(r, 51);
          if (a1 < a0) a1 += 360;
          const n = Math.max(4, Math.ceil((a1 - a0) / 15));
          let prev: Pt | null = null;
          for (let k = 0; k <= n; k++) {
            const t = ((a0 + ((a1 - a0) * k) / n) * Math.PI) / 180;
            const p = apply(m, { x: c.x + rad * Math.cos(t), y: c.y + rad * Math.sin(t) });
            if (prev) out.segs.push({ a: prev, b: p, layer });
            prev = p;
          }
          break;
        }
        case 'TEXT': {
          const s = cleanMText(str(r, 1));
          if (s) {
            out.texts.push({
              p: apply(m, { x: num(r, 10), y: num(r, 20) }),
              s,
              h: num(r, 40, 0, 1) * Math.abs(m.sx),
              rot: num(r, 50) + m.rot,
              layer,
            });
          }
          break;
        }
        case 'MTEXT': {
          const parts = (r.p.get(3) ?? []).join('') + (r.p.get(1)?.[0] ?? '');
          const s = cleanMText(parts);
          if (s) {
            out.texts.push({
              p: apply(m, { x: num(r, 10), y: num(r, 20) }),
              s,
              h: num(r, 40, 0, 1) * Math.abs(m.sx),
              rot: num(r, 50) + m.rot,
              layer,
            });
          }
          break;
        }
        case 'INSERT': {
          const name = strU(r, 2);
          const im: Mat = {
            x: num(r, 10),
            y: num(r, 20),
            sx: num(r, 41, 0, 1) || 1,
            sy: num(r, 42, 0, 1) || 1,
            rot: num(r, 50),
          };
          const world = compose(m, im);
          const known = blockFromName(name);
          if (known) {
            out.devices.push({
              p: { x: world.x, y: world.y },
              rot: world.rot,
              sx: world.sx,
              block: known.block,
              layer,
              cadName: name,
              state: known.state,
            });
            break;
          }
          const def = blocks.get(name.toUpperCase());
          if (def) {
            const shifted: Mat = { ...world };
            const bp = apply(world, { x: -def.base.x, y: -def.base.y });
            shifted.x = bp.x;
            shifted.y = bp.y;
            walk(def.recs, shifted, depth + 1, layer);
          }
          break;
        }
        default:
          break;
      }
    }
  };

  walk(entities, IDENT, 0);
  return out;
}

/* --------------------------- gop doan thang --------------------------- */

const key = (p: Pt, tol: number): string =>
  `${Math.round(p.x / tol)}|${Math.round(p.y / tol)}`;

/** Noi cac doan thang lien tiep (cung lop) thanh polyline de de sua. */
function chain(segs: Seg[], tol: number): { pts: Pt[]; layer: string }[] {
  const byLayer = new Map<string, Seg[]>();
  for (const s of segs) {
    const arr = byLayer.get(s.layer);
    if (arr) arr.push(s);
    else byLayer.set(s.layer, [s]);
  }
  const out: { pts: Pt[]; layer: string }[] = [];
  for (const [layer, list] of byLayer) {
    const adj = new Map<string, number[]>();
    const push = (k: string, i: number): void => {
      const a = adj.get(k);
      if (a) a.push(i);
      else adj.set(k, [i]);
    };
    list.forEach((s, i) => {
      push(key(s.a, tol), i);
      push(key(s.b, tol), i);
    });
    const used = new Array(list.length).fill(false);
    for (let i = 0; i < list.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      const pts: Pt[] = [list[i].a, list[i].b];
      // Noi ve hai phia chung nao con dinh bac 2
      for (const dir of [0, 1]) {
        for (;;) {
          const end = dir === 0 ? pts[pts.length - 1] : pts[0];
          const cand = (adj.get(key(end, tol)) ?? []).filter((j) => !used[j]);
          if (cand.length !== 1) break;
          const j = cand[0];
          const s = list[j];
          used[j] = true;
          const near = key(s.a, tol) === key(end, tol);
          const next = near ? s.b : s.a;
          if (dir === 0) pts.push(next);
          else pts.unshift(next);
        }
      }
      out.push({ pts, layer });
    }
  }
  return out;
}

/* ------------------------------ ket qua ------------------------------- */

export interface ImportOptions {
  /** He so nhan toa do DXF -> don vi ban ve (km). */
  scale: number;
  /** Tinh tien sau khi nhan he so. */
  offset: Pt;
  /** Cap dien ap mac dinh khi khong doan duoc tu ten lop. */
  defaultKv: VoltageKv;
  /** Co nhap cac doi tuong chu khong. */
  importText: boolean;
  /** Bo qua cac lop nay (VD khung ten, ghi chu). */
  skipLayers: string[];
  /** Giu nguyen ten lop goc cua CAD thay vi gom theo cap dien ap. */
  keepLayers: boolean;
  /**
   * Khi ten lop khong cho biet cap dien ap, suy ra tu ky hieu ngan lo gan nhat
   * (171 -> 110kV, 331 -> 35kV, 431 -> 22kV...). Rat can cho cac ban ve do don vi
   * khac lap, dat ten lop kieu "DUONGCHINH" / "LINE".
   */
  inferKv: boolean;
}

export const defaultImportOptions = (): ImportOptions => ({
  scale: 1,
  offset: { x: 0, y: 0 },
  defaultKv: 22,
  importText: true,
  skipLayers: ['Defpoints', 'KHUNG', 'Khung ten', 'Viền KT', 'Đường Viền'],
  keepLayers: false,
  inferKv: true,
});

export interface ImportResult {
  entities: Entity[];
  box: Box;
  /** Thong ke de bao cao cho nguoi dung. */
  stats: { tuyen: number; thietBi: number; chu: number; hinhTron: number; lop: string[]; suyTuKyHieu: number };
}

export function importDxf(text: string, opt: ImportOptions): ImportResult {
  const flat = flatten(parseRecords(text));
  const skip = new Set(opt.skipLayers.map((s) => s.toLowerCase()));
  const keep = (layer: string): boolean => !skip.has(layer.toLowerCase());

  const tx = (p: Pt): Pt => ({ x: p.x * opt.scale + opt.offset.x, y: p.y * opt.scale + opt.offset.y });

  const entities: Entity[] = [];
  const box = emptyBox();
  const layerSet = new Set<string>();

  // Dung dung sai gop = 1/2000 kich thuoc ban ve goc
  const raw = emptyBox();
  for (const s of flat.segs) {
    growBox(raw, s.a);
    growBox(raw, s.b);
  }
  const span = Math.max(raw.maxX - raw.minX, raw.maxY - raw.minY, 1);
  const tol = span / 5000;

  /* --- Gợi ý cấp điện áp từ ký hiệu ngăn lộ và từ tên block thiết bị --- */
  const hints = new HintGrid(Math.max(span / 120, 1e-6));
  const hintRadius = span / 25;
  if (opt.inferKv) {
    for (const t of flat.texts) {
      if (!keep(t.layer)) continue;
      const kv = kvFromDesignation(t.s);
      if (kv !== null) hints.add(t.p, kv);
    }
    for (const d of flat.devices) {
      if (!keep(d.layer)) continue;
      const kv = kvFromBlockName(d.cadName);
      if (kv !== null) hints.add(d.p, kv);
    }
  }
  let suyTuKyHieu = 0;

  for (const ch of chain(flat.segs.filter((s) => keep(s.layer)), tol)) {
    layerSet.add(ch.layer);
    let kv = kvFromLayer(ch.layer);
    if (kv === null && opt.inferKv) {
      // Lấy điểm giữa tuyến rồi tìm ký hiệu ngăn lộ gần nhất
      const mid = ch.pts[Math.floor(ch.pts.length / 2)];
      const g = hints.nearest(mid, hintRadius);
      if (g !== null) {
        kv = g;
        suyTuKyHieu++;
      }
    }
    if (kv === null) kv = opt.defaultKv;
    const lineKind = lineKindFromLayer(ch.layer);
    const pts = ch.pts.map(tx);
    if (pts.length < 2) continue;
    const nodeIds: string[] = [];
    for (let i = 0; i < pts.length; i++) {
      const id = newId('n');
      nodeIds.push(id);
      growBox(box, pts[i]);
      entities.push({
        id,
        kind: 'node',
        layer: opt.keepLayers ? ch.layer : layerOf(kv),
        kv,
        p: pts[i],
        nodeType: i === 0 || i === pts.length - 1 ? 'dau-cuoi' : 'cot',
      });
    }
    const b: BranchEntity = {
      id: newId('b'),
      kind: 'branch',
      layer: opt.keepLayers ? ch.layer : layerOf(kv),
      kv,
      nodes: nodeIds,
      lineKind,
      srcLayer: ch.layer,
      note: `Nhập từ DXF - lớp "${ch.layer}"`,
    };
    entities.push(b);
  }

  for (const d of flat.devices) {
    if (!keep(d.layer)) continue;
    layerSet.add(d.layer);
    // Tên block đáng tin hơn tên lớp -> ưu tiên trước
    let kv = kvFromBlockName(d.cadName) ?? kvFromLayer(d.layer);
    if (kv === null && opt.inferKv) {
      const g = hints.nearest(d.p, hintRadius);
      if (g !== null) {
        kv = g;
        suyTuKyHieu++;
      }
    }
    if (kv === null) kv = opt.defaultKv;
    const def = getBlock(d.block);

    // Hình học block trong phần mềm đã được xoay `normRot` để trục thiết bị nằm dọc,
    // nên phải TRỪ lại góc đó thì hướng mới trùng bản vẽ CAD. Tỷ lệ âm trong CAD
    // nghĩa là lật gương -> giữ lại bằng cờ `mirror` (khi lật, góc chuẩn hoá đổi dấu).
    const mirror = d.sx < 0;
    const m = mirror ? -1 : 1;
    const normRot = def?.normRot ?? 0;
    const rot = d.rot - m * normRot;

    // Block CAD lấy ĐIỂM CHÈN làm gốc, block ở đây lấy TÂM hình làm gốc
    // -> dời tâm đi một đoạn bằng `origin` đã quay/thu phóng theo thiết bị.
    const scale = Math.max(0.001, Math.abs(d.sx) * opt.scale * 18.669);
    const o = def?.origin ?? [0, 0];
    const off = rotate({ x: o[0] * m * scale, y: o[1] * scale }, rot);
    const ins = tx(d.p);
    const p = { x: ins.x - off.x, y: ins.y - off.y };
    growBox(box, p);

    const dev: DeviceEntity = {
      id: newId('d'),
      kind: 'device',
      layer: opt.keepLayers ? d.layer : layerOf(kv),
      kv,
      block: d.block,
      p,
      rot,
      scale,
      state: d.state ?? 'dong',
      srcLayer: d.layer,
      note: `Nhập từ DXF - lớp "${d.layer}"`,
    };
    if (mirror) dev.mirror = true;
    entities.push(dev);
  }

  if (opt.importText) {
    for (const t of flat.texts) {
      if (!keep(t.layer)) continue;
      layerSet.add(t.layer);
      let kv = kvFromLayer(t.layer) ?? kvFromDesignation(t.s);
      if (kv === null && opt.inferKv) kv = hints.nearest(t.p, hintRadius);
      if (kv === null) kv = opt.defaultKv;
      const p = tx(t.p);
      growBox(box, p);
      const te: TextEntity = {
        id: newId('t'),
        kind: 'text',
        layer: opt.keepLayers ? t.layer : 'Ghi chú',
        kv,
        p,
        text: t.s,
        height: Math.max(0.05, t.h * opt.scale),
        rot: t.rot,
        align: 'left',
        srcLayer: t.layer,
      };
      entities.push(te);
    }
  }

  // Hinh tron roi trong CAD (cuon day MBA, vong tron TU/TI...) giu nguyen la
  // hinh tron - truoc day bien thanh ky hieu "cot" to dac nen sai hoan toan.
  for (const c of flat.circles) {
    if (!keep(c.layer)) continue;
    layerSet.add(c.layer);
    let kv = kvFromLayer(c.layer);
    if (kv === null && opt.inferKv) {
      const g = hints.nearest(c.c, hintRadius);
      if (g !== null) {
        kv = g;
        suyTuKyHieu++;
      }
    }
    if (kv === null) kv = opt.defaultKv;
    const p = tx(c.c);
    growBox(box, { x: p.x - c.r * opt.scale, y: p.y - c.r * opt.scale });
    growBox(box, { x: p.x + c.r * opt.scale, y: p.y + c.r * opt.scale });
    entities.push({
      id: newId('c'),
      kind: 'circle',
      layer: opt.keepLayers ? c.layer : layerOf(kv),
      kv,
      c: p,
      r: Math.max(1e-4, c.r * opt.scale),
      srcLayer: c.layer,
      note: `Nhập từ DXF - lớp "${c.layer}"`,
    });
  }

  return {
    entities,
    box,
    stats: {
      tuyen: entities.filter((e) => e.kind === 'branch').length,
      thietBi: entities.filter((e) => e.kind === 'device').length,
      chu: entities.filter((e) => e.kind === 'text').length,
      hinhTron: entities.filter((e) => e.kind === 'circle').length,
      lop: [...layerSet].sort(),
      suyTuKyHieu,
    },
  };
}

/** Doc nhanh danh sach lop + hop bao cua file DXF de hien thi truoc khi nhap. */
export function inspectDxf(text: string): { layers: string[]; box: Box; soDoiTuong: number } {
  const flat = flatten(parseRecords(text));
  const box = emptyBox();
  const layers = new Set<string>();
  for (const s of flat.segs) {
    growBox(box, s.a);
    growBox(box, s.b);
    layers.add(s.layer);
  }
  for (const d of flat.devices) {
    growBox(box, d.p);
    layers.add(d.layer);
  }
  for (const t of flat.texts) {
    growBox(box, t.p);
    layers.add(t.layer);
  }
  return {
    layers: [...layers].sort(),
    box,
    soDoiTuong: flat.segs.length + flat.devices.length + flat.texts.length,
  };
}
