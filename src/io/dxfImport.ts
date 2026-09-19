import type { BranchEntity, DeviceEntity, Entity, LineKind, Pt, TextEntity, VoltageKv } from '../core/types';
import { newId } from '../core/doc';
import { layerOf } from '../core/voltage';
import { emptyBox, growBox, type Box } from '../core/geom';

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
  scale: number;
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
              scale: Math.abs(world.sx),
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
}

export const defaultImportOptions = (): ImportOptions => ({
  scale: 1,
  offset: { x: 0, y: 0 },
  defaultKv: 22,
  importText: true,
  skipLayers: ['Defpoints', 'KHUNG', 'Khung ten', 'Viền KT', 'Đường Viền'],
  keepLayers: false,
});

export interface ImportResult {
  entities: Entity[];
  box: Box;
  /** Thong ke de bao cao cho nguoi dung. */
  stats: { tuyen: number; thietBi: number; chu: number; lop: string[] };
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

  for (const ch of chain(flat.segs.filter((s) => keep(s.layer)), tol)) {
    layerSet.add(ch.layer);
    const kv = kvFromLayer(ch.layer) ?? opt.defaultKv;
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
    const kv = kvFromBlockName(d.cadName) ?? kvFromLayer(d.layer) ?? opt.defaultKv;
    const p = tx(d.p);
    growBox(box, p);
    const dev: DeviceEntity = {
      id: newId('d'),
      kind: 'device',
      layer: opt.keepLayers ? d.layer : layerOf(kv),
      kv,
      block: d.block,
      p,
      rot: d.rot,
      scale: Math.max(0.05, d.scale * opt.scale * 18.669),
      state: d.state ?? 'dong',
      srcLayer: d.layer,
      note: `Nhập từ DXF - lớp "${d.layer}"`,
    };
    entities.push(dev);
  }

  if (opt.importText) {
    for (const t of flat.texts) {
      if (!keep(t.layer)) continue;
      layerSet.add(t.layer);
      const kv = kvFromLayer(t.layer) ?? opt.defaultKv;
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

  for (const c of flat.circles) {
    if (!keep(c.layer)) continue;
    const kv = kvFromLayer(c.layer) ?? opt.defaultKv;
    const p = tx(c.c);
    growBox(box, p);
    entities.push({
      id: newId('d'),
      kind: 'device',
      layer: opt.keepLayers ? c.layer : layerOf(kv),
      kv,
      block: 'COT',
      p,
      rot: 0,
      scale: Math.max(0.05, c.r * opt.scale * 6),
      note: `Nhập từ DXF - hình tròn lớp "${c.layer}"`,
    });
  }

  return {
    entities,
    box,
    stats: {
      tuyen: entities.filter((e) => e.kind === 'branch').length,
      thietBi: entities.filter((e) => e.kind === 'device').length,
      chu: entities.filter((e) => e.kind === 'text').length,
      lop: [...layerSet].sort(),
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
