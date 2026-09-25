import type { CircleEntity, DeviceEntity, Entity, Id, Pt, TextEntity } from './types';
import { deviceOps } from '../render/shapes';

/**
 * DỜI CHỮ RA KHỎI KÝ HIỆU THIẾT BỊ.
 *
 * Bản CAD gốc có nhiều nhãn nằm đè lên ký hiệu: số hiệu máy cắt ghi lọt vào trong
 * thân máy cắt ("173"), tên dao cách ly nằm vắt qua lưỡi dao ("173-7"), tên TU chồng
 * lên cuộn dây... Trên AutoCAD chữ mảnh nên còn đọc được, nhưng khi ký hiệu được vẽ
 * đậm (hoặc máy cắt được tô đặc) thì chữ bị lấp mất.
 *
 * Với mỗi nhãn chạm vào nét vẽ của thiết bị, tìm vị trí GẦN NHẤT xung quanh sao cho:
 *   - không chạm nét vẽ của thiết bị nào;
 *   - không đè lên nhãn khác;
 *   - không cắt thêm đường dây nào so với chỗ cũ.
 * Không tìm được chỗ như vậy trong phạm vi cho phép thì giữ nguyên, để nhãn không bị
 * đẩy ra xa khỏi thiết bị mà nó ghi tên.
 */

/** Tỷ lệ bề rộng trung bình một ký tự so với chiều cao chữ. */
const RONG_KY_TU = 0.56;

interface Hop {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
type Doan = [Pt, Pt];

export interface KetQuaDoiChu {
  /** Số nhãn ban đầu chạm nét vẽ thiết bị. */
  biLap: number;
  /** Số nhãn đã dời được ra chỗ thoáng. */
  daDoi: number;
  /** Số nhãn không dời được (giữ nguyên chỗ cũ). */
  conLai: number;
  /** Nội dung + vị trí các nhãn không dời được (để rà soát). */
  khongDoi?: string[];
  /** Thời gian xử lý (ms). */
  ms: number;
}

/**
 * Hộp bao của một nhãn, thu vào một chút so với ô chữ đầy đủ: phần trên dấu và phần
 * dưới chân chữ vốn để trống, tính cả vào thì nhãn nào đặt sát ký hiệu cũng bị coi
 * là chạm.
 */
export function hopChu(t: TextEntity, p: Pt = t.p): Hop {
  const h = t.height;
  const w = t.text.length * h * RONG_KY_TU;
  const lx0 = (t.align === 'center' ? -w / 2 : t.align === 'right' ? -w : 0) + h * 0.06;
  const lx1 = lx0 + w - h * 0.12;
  const ly0 = h * 0.14;
  const ly1 = h * 0.9;
  const a = ((t.rot || 0) * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const hop: Hop = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const [x, y] of [
    [lx0, ly0],
    [lx1, ly0],
    [lx1, ly1],
    [lx0, ly1],
  ]) {
    const X = p.x + x * c - y * s;
    const Y = p.y + x * s + y * c;
    hop.x0 = Math.min(hop.x0, X);
    hop.x1 = Math.max(hop.x1, X);
    hop.y0 = Math.min(hop.y0, Y);
    hop.y1 = Math.max(hop.y1, Y);
  }
  return hop;
}

const giaoHop = (a: Hop, b: Hop): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** Đoạn thẳng có cắt (hoặc nằm trong) hình chữ nhật không - thuật toán Liang-Barsky. */
function doanCatHop(a: Pt, b: Pt, h: Hop): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const p = [-dx, dx, -dy, dy];
  const q = [a.x - h.x0, h.x1 - a.x, a.y - h.y0, h.y1 - a.y];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return true;
}

/** Lưới băm để tra nhanh các đoạn / hộp nằm gần một vùng. */
class LuoiBam<T> {
  private o = new Map<string, T[]>();
  constructor(private canh: number) {}
  private *oCua(h: Hop): Generator<string> {
    const i0 = Math.floor(h.x0 / this.canh);
    const i1 = Math.floor(h.x1 / this.canh);
    const j0 = Math.floor(h.y0 / this.canh);
    const j1 = Math.floor(h.y1 / this.canh);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) yield `${i}|${j}`;
  }
  them(h: Hop, v: T): void {
    for (const k of this.oCua(h)) {
      const a = this.o.get(k);
      if (a) a.push(v);
      else this.o.set(k, [v]);
    }
  }
  bo(h: Hop, v: T): void {
    for (const k of this.oCua(h)) {
      const a = this.o.get(k);
      if (!a) continue;
      const i = a.indexOf(v);
      if (i >= 0) a.splice(i, 1);
    }
  }
  quanh(h: Hop): Set<T> {
    const out = new Set<T>();
    for (const k of this.oCua(h)) for (const v of this.o.get(k) ?? []) out.add(v);
    return out;
  }
}

const hopDoan = (a: Pt, b: Pt): Hop => ({
  x0: Math.min(a.x, b.x),
  y0: Math.min(a.y, b.y),
  x1: Math.max(a.x, b.x),
  y1: Math.max(a.y, b.y),
});

/** Hình kín của ký hiệu (thân máy cắt, cuộn dây...): nhãn lọt vào trong cũng là bị lấp. */
type HinhKin = { t: 'da-giac'; pts: Pt[] } | { t: 'tron'; c: Pt; r: number };

/** Nét vẽ của một thiết bị: các đoạn thẳng (đường tròn xấp xỉ 16 cạnh) và các hình kín. */
function netThietBi(e: DeviceEntity | CircleEntity): { doan: Doan[]; kin: HinhKin[] } {
  const doan: Doan[] = [];
  const kin: HinhKin[] = [];
  const tron = (c: Pt, r: number, laKin: boolean): void => {
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a0 = (2 * Math.PI * i) / n;
      const a1 = (2 * Math.PI * (i + 1)) / n;
      doan.push([
        { x: c.x + r * Math.cos(a0), y: c.y + r * Math.sin(a0) },
        { x: c.x + r * Math.cos(a1), y: c.y + r * Math.sin(a1) },
      ]);
    }
    if (laKin) kin.push({ t: 'tron', c, r });
  };
  if (e.kind === 'circle') {
    tron(e.c, e.r, true);
    return { doan, kin };
  }
  for (const op of deviceOps(e)) {
    if (op.t === 'path') {
      for (let i = 1; i < op.pts.length; i++) doan.push([op.pts[i - 1], op.pts[i]]);
      if (op.close && op.pts.length > 2) {
        doan.push([op.pts[op.pts.length - 1], op.pts[0]]);
        kin.push({ t: 'da-giac', pts: op.pts });
      }
    } else if (op.t === 'circle') {
      tron(op.c, op.r, true);
    } else if (op.t === 'arc') {
      tron(op.c, op.r, false);
    }
  }
  return { doan, kin };
}

/** Điểm có nằm trong hình kín không. */
function trongHinh(p: Pt, h: HinhKin): boolean {
  if (h.t === 'tron') return Math.hypot(p.x - h.c.x, p.y - h.c.y) < h.r;
  let trong = false;
  const q = h.pts;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    if (q[i].y > p.y !== q[j].y > p.y && p.x < ((q[j].x - q[i].x) * (p.y - q[i].y)) / (q[j].y - q[i].y) + q[i].x) {
      trong = !trong;
    }
  }
  return trong;
}

const hopHinh = (h: HinhKin): Hop => {
  if (h.t === 'tron') return { x0: h.c.x - h.r, y0: h.c.y - h.r, x1: h.c.x + h.r, y1: h.c.y + h.r };
  const b: Hop = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const p of h.pts) {
    b.x0 = Math.min(b.x0, p.x);
    b.x1 = Math.max(b.x1, p.x);
    b.y0 = Math.min(b.y0, p.y);
    b.y1 = Math.max(b.y1, p.y);
  }
  return b;
};

/**
 * Dời các nhãn đang đè lên ký hiệu thiết bị trong một tờ bản vẽ.
 * Sửa trực tiếp toạ độ `p` của các TextEntity trong `entities`.
 */
export function doiChuKhoiThietBi(entities: Record<Id, Entity>): KetQuaDoiChu {
  const t0 = performance.now();
  const ds = Object.values(entities);
  const chu = ds.filter((e): e is TextEntity => e.kind === 'text' && !!e.text.trim() && e.height > 0);
  if (!chu.length) return { biLap: 0, daDoi: 0, conLai: 0, ms: 0 };

  // Cạnh ô lưới băm ~ 4 lần chiều cao chữ phổ biến
  const hs = chu.map((t) => t.height).sort((a, b) => a - b);
  const canh = Math.max(20, hs[hs.length >> 1] * 4);

  const netTB = new LuoiBam<Doan>(canh);
  const hinhKin = new LuoiBam<HinhKin>(canh);
  for (const e of ds) {
    if (e.kind !== 'device' && e.kind !== 'circle') continue;
    const { doan, kin } = netThietBi(e);
    for (const d of doan) netTB.them(hopDoan(d[0], d[1]), d);
    for (const k of kin) hinhKin.them(hopHinh(k), k);
  }
  // Ký hiệu nhỏ mà bản CAD vẽ bằng nét rời chứ không dùng block (chống sét, cầu
  // chì...): đường gấp khúc KHÉP KÍN và nhỏ thì cũng coi là ký hiệu thiết bị.
  const nhoToiDa = canh * 2;
  const day = new LuoiBam<Doan>(canh);
  for (const e of ds) {
    if (e.kind !== 'branch') continue;
    const pts: Pt[] = [];
    for (const id of e.nodes) {
      const n = entities[id];
      if (n && n.kind === 'node') pts.push(n.p);
    }
    for (let i = 1; i < pts.length; i++) day.them(hopDoan(pts[i - 1], pts[i]), [pts[i - 1], pts[i]]);
    const dau = pts[0];
    const cuoi = pts[pts.length - 1];
    if (pts.length >= 4 && Math.hypot(dau.x - cuoi.x, dau.y - cuoi.y) < 1e-6) {
      const k: HinhKin = { t: 'da-giac', pts };
      const b = hopHinh(k);
      if (b.x1 - b.x0 < nhoToiDa && b.y1 - b.y0 < nhoToiDa) {
        for (let i = 1; i < pts.length; i++) netTB.them(hopDoan(pts[i - 1], pts[i]), [pts[i - 1], pts[i]]);
        hinhKin.them(b, k);
      }
    }
  }
  const hopCua = new Map<TextEntity, Hop>();
  const oChu = new LuoiBam<TextEntity>(canh);
  for (const t of chu) {
    const h = hopChu(t);
    hopCua.set(t, h);
    oChu.them(h, t);
  }

  const demCat = (luoi: LuoiBam<Doan>, h: Hop): number => {
    let n = 0;
    for (const d of luoi.quanh(h)) if (doanCatHop(d[0], d[1], h)) n++;
    return n;
  };
  /** Nhãn chạm nét vẽ thiết bị, hoặc lọt vào trong thân thiết bị. */
  const biChe = (h: Hop): boolean => {
    if (demCat(netTB, h)) return true;
    const tam = { x: (h.x0 + h.x1) / 2, y: (h.y0 + h.y1) / 2 };
    for (const k of hinhKin.quanh(h)) if (trongHinh(tam, k)) return true;
    return false;
  };
  const deChu = (t: TextEntity, h: Hop): boolean => {
    for (const u of oChu.quanh(h)) if (u !== t && giaoHop(h, hopCua.get(u)!)) return true;
    return false;
  };

  let biLap = 0;
  let daDoi = 0;
  const khongDoi: string[] = [];
  for (const t of chu) {
    const h0 = hopCua.get(t)!;
    if (!biChe(h0)) continue;
    biLap++;
    const catDay0 = demCat(day, h0);
    const w = h0.x1 - h0.x0;
    const hh = h0.y1 - h0.y0;
    const buoc = t.height * 0.25;
    // Phạm vi tìm: sang ngang tối đa một bề rộng nhãn + 3 lần chiều cao chữ,
    // lên xuống tối đa 2,5 lần chiều cao nhãn.
    const maxX = w + t.height * 3;
    const maxY = hh * 2.5 + t.height;
    // Thử các vị trí theo thứ tự GẦN DẦN RA XA, gặp chỗ thoáng đầu tiên thì lấy.
    // Đi ngang được ưu tiên hơn đi dọc (nhãn vẫn cùng hàng với thiết bị).
    const nx = Math.ceil(maxX / buoc);
    const ny = Math.ceil(maxY / buoc);
    const thu: [number, number, number][] = [];
    for (let iy = -ny; iy <= ny; iy++) {
      for (let ix = -nx; ix <= nx; ix++) if (ix || iy) thu.push([ix * buoc, iy * buoc, Math.hypot(ix, iy * 1.6)]);
    }
    thu.sort((a, b) => a[2] - b[2]);
    let tot: { dx: number; dy: number } | null = null;
    for (const [dx, dy] of thu) {
      const h = { x0: h0.x0 + dx, y0: h0.y0 + dy, x1: h0.x1 + dx, y1: h0.y1 + dy };
      if (biChe(h)) continue;
      if (demCat(day, h) > catDay0) continue;
      if (deChu(t, h)) continue;
      tot = { dx, dy };
      break;
    }
    if (!tot) {
      khongDoi.push(`${t.text} @(${t.p.x.toFixed(1)}, ${t.p.y.toFixed(1)})`);
      continue;
    }
    oChu.bo(h0, t);
    t.p = { x: t.p.x + tot.dx, y: t.p.y + tot.dy };
    const h1 = hopChu(t);
    hopCua.set(t, h1);
    oChu.them(h1, t);
    daDoi++;
  }
  return { biLap, daDoi, conLai: biLap - daDoi, khongDoi, ms: Math.round(performance.now() - t0) };
}
