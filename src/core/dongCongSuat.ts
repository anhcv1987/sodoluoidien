import { getBlock } from '../symbols/blocks';
import { dungMangDien } from './lienket';
import type { BranchEntity, CircleEntity, DeviceEntity, Entity, Id, Pt, VoltageKv } from './types';

/**
 * CHIỀU CÔNG SUẤT TRÊN SƠ ĐỒ - phục vụ hiển thị "công suất chạy trên đường dây".
 *
 * Mô hình liên kết (lienket.ts) coi cả một tuyến là một nút, nhưng muốn công
 * suất DỪNG đúng tại dao cách ly đang cắt nằm giữa một nét dây liền thì phải xét
 * tới từng đoạn. Vì vậy ở đây dựng ĐỒ THỊ HÌNH HỌC:
 *
 *  - Mỗi tuyến dây được chia nhỏ tại mọi điểm có đấu nối: đỉnh, chỗ tuyến khác
 *    rẽ vào (chữ T - trừ đường dây liên trạm chỉ đấu ở hai đầu), cực thiết bị.
 *  - Thiết bị nối tiếp đang ĐÓNG: nối hai cực (dây vẽ đứt tại ký hiệu vẫn thông).
 *    Thiết bị đang CẮT (máy cắt, dao cách ly, dao cách ly hợp bộ…): bỏ mọi đoạn
 *    dây nằm giữa hai cực - kể cả khi nét dây vẽ liền qua ký hiệu.
 *  - Máy biến áp (block MBA hoặc các vòng tròn cuộn dây chồng nhau): nối các
 *    phía với nhau nên công suất đi xuyên từ 220/110kV xuống trung áp.
 *
 * Nguồn là thanh cái 220kV (trong tỉnh và các trạm 220kV ngoài tỉnh). Mạch nào
 * không nối về được thanh cái 220kV thì lấy thanh cái cấp điện áp cao nhất trong
 * mạch đó làm nguồn. Chiều công suất trên mỗi đoạn là chiều đi xa dần nguồn
 * (lưới trung áp vận hành hình tia); mạch vòng thì hai dòng gặp nhau ở giữa.
 * Nhánh cụt không mang tải (dao tiếp địa, chống sét van, TU…) được tỉa bỏ; đoạn
 * dây dẫn tới thiết bị đang cắt thì giữ lại để thấy công suất dừng ở đó.
 */

export interface ChuoiCongSuat {
  /** Toạ độ các điểm theo chiều công suất: x0, y0, x1, y1… */
  pts: number[];
  /** Quãng đường (theo bản vẽ) từ nguồn tới điểm đầu - để các vạch chạy nối tiếp nhau. */
  pha: number;
  kv: VoltageKv;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface DongCongSuat {
  chuoi: ChuoiCongSuat[];
  /** Điểm công suất dừng lại vì gặp thiết bị đang cắt. */
  diemDung: Pt[];
  /** Thống kê để báo cho người dùng. */
  soNguon: number;
  soDoan: number;
}

/** Thiết bị đấu rẽ không mang tải - nhánh cụt tới đó không có công suất. */
/** Thiết bị là phụ tải - nhánh dây tới đó có công suất. */
const MANG_TAI = new Set(['MBAPP', 'TD']);
/** Máy cắt: nhánh có máy cắt là ngăn lộ / xuất tuyến, không phải nhánh cụt. */
const MAY_CAT = new Set(['MC', 'MCHB', 'REC']);
const KHONG_TAI = new Set(['DTD', 'CSV', 'TU', 'TUC', 'TU3P', 'TUBU', 'COT', 'BDD', 'KHANG']);

/** Bán kính vòng tròn cuộn dây của block MBA (theo hệ số phóng của block). */
const BAN_KINH_CUON = 1.174;

const laMBA = (block: string): boolean => /^(MBA|AT)/.test(block) && block !== 'MBAPP';

/** Hàng đợi ưu tiên (đống nhị phân) cho Dijkstra. */
class Dong {
  private k: number[] = [];
  private v: number[] = [];
  get size(): number {
    return this.k.length;
  }
  push(key: number, val: number): void {
    const k = this.k;
    const v = this.v;
    let i = k.length;
    k.push(key);
    v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p];
      v[i] = v[p];
      i = p;
    }
    k[i] = key;
    v[i] = val;
  }
  pop(): [number, number] {
    const k = this.k;
    const v = this.v;
    const top: [number, number] = [k[0], v[0]];
    const lk = k.pop() as number;
    const lv = v.pop() as number;
    if (k.length) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= k.length) break;
        const c = l + 1 < k.length && k[l + 1] < k[l] ? l + 1 : l;
        if (k[c] >= lk) break;
        k[i] = k[c];
        v[i] = v[c];
        i = c;
      }
      k[i] = lk;
      v[i] = lv;
    }
    return top;
  }
}

/** Chỉ mục lưới ô vuông cho đoạn thẳng. */
class LuoiO {
  private o = new Map<number, number[]>();
  constructor(private cell: number) {}
  private key(i: number, j: number): number {
    return (i + 50000) * 100000 + (j + 50000);
  }
  them(ax: number, ay: number, bx: number, by: number, v: number): void {
    const c = this.cell;
    const i0 = Math.floor(Math.min(ax, bx) / c);
    const i1 = Math.floor(Math.max(ax, bx) / c);
    const j0 = Math.floor(Math.min(ay, by) / c);
    const j1 = Math.floor(Math.max(ay, by) / c);
    if ((i1 - i0 + 1) * (j1 - j0 + 1) > 20000) return;
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const k = this.key(i, j);
        const a = this.o.get(k);
        if (a) a.push(v);
        else this.o.set(k, [v]);
      }
    }
  }
  quanh(x: number, y: number, r: number): Set<number> {
    const c = this.cell;
    const out = new Set<number>();
    const i0 = Math.floor((x - r) / c);
    const i1 = Math.floor((x + r) / c);
    const j0 = Math.floor((y - r) / c);
    const j1 = Math.floor((y + r) / c);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (const v of this.o.get(this.key(i, j)) ?? []) out.add(v);
    return out;
  }
}

/** Hình chiếu của p lên đoạn ab: [tham số t trong 0..1, khoảng cách]. */
function chieu(px: number, py: number, ax: number, ay: number, bx: number, by: number): [number, number] {
  const dx = bx - ax;
  const dy = by - ay;
  const L = dx * dx + dy * dy;
  let t = L > 0 ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  return [t, Math.hypot(ax + t * dx - px, ay + t * dy - py)];
}

interface Tuyen {
  b: BranchEntity;
  p: Pt[];
}

/** Không đoạn nào của tuyến nằm ngang / thẳng đứng. */
function laNetXien(p: Pt[]): boolean {
  for (let k = 1; k < p.length; k++) {
    const dx = Math.abs(p[k].x - p[k - 1].x);
    const dy = Math.abs(p[k].y - p[k - 1].y);
    if (Math.min(dx, dy) <= Math.max(dx, dy) * 0.05) return false;
  }
  return true;
}

/** Mọi đoạn của tuyến đều nằm ngang hoặc thẳng đứng. */
function vuongGoc(p: Pt[]): boolean {
  for (let k = 1; k < p.length; k++) {
    const dx = Math.abs(p[k].x - p[k - 1].x);
    const dy = Math.abs(p[k].y - p[k - 1].y);
    if (Math.min(dx, dy) > Math.max(dx, dy) * 0.01) return false;
  }
  return true;
}

function kcDenTuyen(q: Pt, p: Pt[], boDau = -1): number {
  let m = Infinity;
  for (let k = 1; k < p.length; k++) {
    if (k - 1 === boDau || k === boDau) continue;
    m = Math.min(m, chieu(q.x, q.y, p[k - 1].x, p[k - 1].y, p[k].x, p[k].y)[1]);
  }
  return m;
}

/**
 * Bỏ KHUNG TỦ (tủ RMU, hộp khách hàng…) ra khỏi lưới dây dẫn.
 *
 * Khung tủ trong bản CAD vẽ bằng chính lớp đường dây nên chạm vào các đầu cáp,
 * công suất "chạy vòng" theo khung. Nhận ra khung:
 *  - nét khuất (lớp CAD "netkhuat");
 *  - hình chữ nhật khép kín vẽ một nét, không có thiết bị nào nằm trên nét;
 *  - rồi lan dần: nét ngang / dọc (vách ngăn giữa các ngăn tủ, cạnh khung vẽ rời)
 *    có HAI ĐẦU đều tựa vào khung đã nhận và không mang thiết bị nào.
 */
function loaiKhungTu(tuyen: Tuyen[], devices: DeviceEntity[], saiSo: number): Tuyen[] {
  const O = 25;
  const luoiTB = new Map<string, DeviceEntity[]>();
  for (const d of devices) {
    const k = `${Math.floor(d.p.x / O)}|${Math.floor(d.p.y / O)}`;
    (luoiTB.get(k) ?? luoiTB.set(k, []).get(k)!).push(d);
  }
  const coThietBi = (p: Pt[]): boolean => {
    for (let k = 1; k < p.length; k++) {
      const a = p[k - 1];
      const b = p[k];
      for (let i = Math.floor(Math.min(a.x, b.x) / O) - 1; i <= Math.floor(Math.max(a.x, b.x) / O) + 1; i++) {
        for (let j = Math.floor(Math.min(a.y, b.y) / O) - 1; j <= Math.floor(Math.max(a.y, b.y) / O) + 1; j++) {
          for (const d of luoiTB.get(`${i}|${j}`) ?? []) {
            if (chieu(d.p.x, d.p.y, a.x, a.y, b.x, b.y)[1] <= saiSo * 0.6) return true;
          }
        }
      }
    }
    return false;
  };
  const khung = new Set<number>();
  const ungVien: number[] = [];
  tuyen.forEach((t, i) => {
    if (t.b.khongNoiGiua || t.b.lineKind === 'Thanh cái' || !vuongGoc(t.p)) return;
    if (t.b.srcLayer === 'netkhuat') {
      khung.add(i);
      return;
    }
    if (coThietBi(t.p)) return;
    const p = t.p;
    const dau = p[0];
    const cuoi = p[p.length - 1];
    const khep =
      p.length >= 4 &&
      (Math.hypot(dau.x - cuoi.x, dau.y - cuoi.y) <= saiSo ||
        kcDenTuyen(dau, p.slice(2)) <= saiSo ||
        kcDenTuyen(cuoi, p.slice(0, -2)) <= saiSo);
    if (khep) {
      // phải bao lấy thiết bị (khung tủ), không phải mạch vòng dây dẫn
      const xs = p.map((q) => q.x);
      const ys = p.map((q) => q.y);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      if (devices.some((d) => d.p.x > x0 && d.p.x < x1 && d.p.y > y0 && d.p.y < y1)) {
        khung.add(i);
        return;
      }
    }
    ungVien.push(i);
  });
  for (let lan = 0; lan < 6; lan++) {
    const ds = [...khung].map((i) => tuyen[i].p);
    const tua = (q: Pt, boQua: Pt[]): boolean => ds.some((p) => p !== boQua && kcDenTuyen(q, p) <= saiSo);
    let them = 0;
    for (const i of ungVien) {
      if (khung.has(i)) continue;
      const p = tuyen[i].p;
      if (tua(p[0], p) && tua(p[p.length - 1], p)) {
        khung.add(i);
        them++;
      }
    }
    if (!them) break;
  }
  return tuyen.filter((_, i) => !khung.has(i));
}

export function tinhDongCongSuat(entities: Entity[], diem: (id: Id) => Pt | undefined): DongCongSuat {
  const LOP_KHUNG = 'Khung bản vẽ';
  const branches = entities.filter((e): e is BranchEntity => e.kind === 'branch' && e.layer !== LOP_KHUNG);
  const devices = entities.filter((e): e is DeviceEntity => e.kind === 'device' && e.layer !== LOP_KHUNG);
  const circles = entities.filter((e): e is CircleEntity => e.kind === 'circle' && e.layer !== LOP_KHUNG && e.r >= 5);

  /* ---------- 0. Cuộn dây máy biến áp vẽ bằng vòng tròn ---------- */
  // Các vòng tròn chồng lên nhau là một máy biến áp (2 hoặc 3 cuộn).
  const chaV = circles.map((_, i) => i);
  const timV = (i: number): number => (chaV[i] === i ? i : (chaV[i] = timV(chaV[i])));
  for (let i = 0; i < circles.length; i++) {
    for (let j = i + 1; j < circles.length; j++) {
      const a = circles[i];
      const b = circles[j];
      const d = Math.hypot(a.c.x - b.c.x, a.c.y - b.c.y);
      if (d < (a.r + b.r) * 0.98 && d > Math.min(a.r, b.r) * 0.3) chaV[timV(i)] = timV(j);
    }
  }
  const nhomV = new Map<number, CircleEntity[]>();
  circles.forEach((c, i) => {
    const r = timV(i);
    const a = nhomV.get(r);
    if (a) a.push(c);
    else nhomV.set(r, [c]);
  });
  const mbaVong = [...nhomV.values()].filter((g) => g.length >= 2);
  const luoiVong = new LuoiO(40);
  mbaVong.forEach((g, gi) => {
    for (const c of g) luoiVong.them(c.c.x - c.r, c.c.y - c.r, c.c.x + c.r, c.c.y + c.r, gi);
  });
  /** Máy biến áp (nhóm vòng tròn) chứa điểm, -1 nếu không có. */
  const trongMBA = (x: number, y: number, bien: number): number => {
    for (const gi of luoiVong.quanh(x, y, 0)) {
      if (mbaVong[gi].some((c) => Math.hypot(x - c.c.x, y - c.c.y) <= c.r + bien)) return gi;
    }
    return -1;
  };

  // Cuộn dây của các block máy biến áp (tâm + bán kính)
  const cuonMBA: { x: number; y: number; r: number }[] = [];
  for (const d of devices) {
    if (!laMBA(d.block)) continue;
    const m = d.mirror ? -1 : 1;
    const g = (d.rot * Math.PI) / 180;
    for (const [cx, cy] of getBlock(d.block)?.cuc ?? []) {
      const x = cx * m * d.scale;
      const y = cy * d.scale;
      cuonMBA.push({ x: d.p.x + x * Math.cos(g) - y * Math.sin(g), y: d.p.y + x * Math.sin(g) + y * Math.cos(g), r: BAN_KINH_CUON * d.scale });
    }
  }
  for (const g of mbaVong) for (const c of g) cuonMBA.push({ x: c.c.x, y: c.c.y, r: c.r });

  /* ---------- 1. Polyline các tuyến ---------- */
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let tuyen: Tuyen[] = [];
  for (const b of branches) {
    const p: Pt[] = [];
    for (const id of b.nodes) {
      const q = diem(id);
      if (!q) continue;
      const tr = p[p.length - 1];
      if (tr && tr.x === q.x && tr.y === q.y) continue;
      p.push(q);
    }
    if (p.length < 2) continue;
    // Nét hình sao / tam giác vẽ trong cuộn dây: không phải dây dẫn
    if (mbaVong.length && p.every((q) => trongMBA(q.x, q.y, 0) >= 0)) continue;
    // Mũi tên điều áp vẽ xiên vắt qua cuộn dây máy biến áp
    if (
      laNetXien(p) &&
      cuonMBA.some((c) => kcDenTuyen(c, p) <= c.r * 0.9 && p.every((q) => Math.hypot(q.x - c.x, q.y - c.y) <= c.r * 3))
    )
      continue;
    for (const q of p) {
      if (q.x < minX) minX = q.x;
      if (q.y < minY) minY = q.y;
      if (q.x > maxX) maxX = q.x;
      if (q.y > maxY) maxY = q.y;
    }
    tuyen.push({ b, p });
  }
  const co = Math.max(maxX - minX, maxY - minY, 1);
  const saiSo = Math.max(co * 2e-4, 1e-6);
  tuyen = loaiKhungTu(tuyen, devices, saiSo);

  // Đoạn thẳng: [chỉ số tuyến, chỉ số đoạn]
  const doanTuyen: number[] = [];
  const doanSo: number[] = [];
  const luoi = new LuoiO(Math.max(co / 300, saiSo * 4));
  tuyen.forEach((t, i) => {
    for (let k = 1; k < t.p.length; k++) {
      const s = doanTuyen.length;
      doanTuyen.push(i);
      doanSo.push(k - 1);
      luoi.them(t.p[k - 1].x, t.p[k - 1].y, t.p[k].x, t.p[k].y, s);
    }
  });
  const A = (s: number): Pt => tuyen[doanTuyen[s]].p[doanSo[s]];
  const B = (s: number): Pt => tuyen[doanTuyen[s]].p[doanSo[s] + 1];

  /* ---------- 2. Đỉnh của đồ thị ---------- */
  const vx: number[] = [];
  const vy: number[] = [];
  const dinhTai = new Map<string, number>();
  const dinh = (x: number, y: number): number => {
    const k = `${Math.round(x * 1e3)}|${Math.round(y * 1e3)}`;
    let v = dinhTai.get(k);
    if (v === undefined) {
      v = vx.length;
      vx.push(x);
      vy.push(y);
      dinhTai.set(k, v);
    }
    return v;
  };
  /** Điểm chia trên từng đoạn: tham số t -> đỉnh. */
  const chia = new Map<number, Map<number, number>>();
  const chiaTai = (s: number, t: number): number => {
    const a = A(s);
    const b = B(s);
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    // bắt về đầu mút khi rất gần để khỏi sinh đoạn vụn
    if (t * L < saiSo * 0.05) t = 0;
    else if ((1 - t) * L < saiSo * 0.05) t = 1;
    let m = chia.get(s);
    if (!m) chia.set(s, (m = new Map()));
    const key = Math.round(t * 1e6);
    let v = m.get(key);
    if (v === undefined) {
      v = dinh(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
      m.set(key, v);
    }
    return v;
  };
  // Đầu mút mọi đoạn luôn là đỉnh
  for (let s = 0; s < doanTuyen.length; s++) {
    chiaTai(s, 0);
    chiaTai(s, 1);
  }

  // Cạnh không vẽ (nối qua thiết bị, chữ T, máy biến áp): [u, v, dài]
  const noiU: number[] = [];
  const noiV: number[] = [];
  const noiL: number[] = [];
  const noi = (u: number, v: number): void => {
    if (u === v) return;
    noiU.push(u);
    noiV.push(v);
    noiL.push(Math.hypot(vx[u] - vx[v], vy[u] - vy[v]));
  };

  /** Bắt một điểm vào đoạn dây gần nhất trong bán kính r -> [đỉnh, đoạn] hoặc null. */
  /**
   * `phia` = tâm thiết bị: chỉ nhận điểm bắt nằm về phía cực này (cực trên không
   * được bắt nhầm vào đoạn dây phía cực dưới khi ký hiệu nằm lệch trục dây).
   */
  const bat = (x: number, y: number, r: number, phia?: Pt): [number, number] | null => {
    let tot = -1;
    let tt = 0;
    let bd = r;
    for (const s of luoi.quanh(x, y, r)) {
      const a = A(s);
      const b = B(s);
      const [t, d] = chieu(x, y, a.x, a.y, b.x, b.y);
      if (phia) {
        const qx = a.x + (b.x - a.x) * t;
        const qy = a.y + (b.y - a.y) * t;
        if ((qx - phia.x) * (x - phia.x) + (qy - phia.y) * (y - phia.y) <= 0) continue;
      }
      if (d < bd) {
        bd = d;
        tot = s;
        tt = t;
      }
    }
    return tot < 0 ? null : [chiaTai(tot, tt), tot];
  };

  /** Số nhánh dây toả ra từ một điểm (dây đi xuyên qua tính 2, đầu dây tính 1). */
  const soNhanh = (p: Pt): number => {
    const e = saiSo * 0.3;
    let n = 0;
    for (const s of luoi.quanh(p.x, p.y, e)) {
      const a = A(s);
      const b = B(s);
      const [t, d] = chieu(p.x, p.y, a.x, a.y, b.x, b.y);
      if (d > e) continue;
      const L = Math.hypot(b.x - a.x, b.y - a.y);
      n += t * L <= e || (1 - t) * L <= e ? 1 : 2;
    }
    return n;
  };

  const mang = dungMangDien(entities, diem);

  /* --- chấm đấu nối (vòng tròn nhỏ) --- */
  const luoiCham = new LuoiO(Math.max(co / 300, saiSo * 4));
  // vòng tròn nhỏ, hoặc block "35-Cot" (chấm tròn đặc) đặt tại chỗ nối
  const cham: { c: Pt; r: number }[] = [
    ...entities.filter((e): e is CircleEntity => e.kind === 'circle' && e.r < 5),
    ...devices.filter((d) => d.block === 'COT').map((d) => ({ c: d.p, r: d.scale * 0.2 })),
    // có trạm vẽ chấm nối bằng block vòng tròn (nhập về thành TI): TI đặt đúng chỗ
    // rẽ chữ T (từ 3 nhánh dây trở lên gặp nhau tại tâm) là chấm đấu nối
    ...devices.filter((d) => d.block === 'TI' && soNhanh(d.p) >= 3).map((d) => ({ c: d.p, r: saiSo * 0.5 })),
  ];
  cham.forEach((c, i) => luoiCham.them(c.c.x, c.c.y, c.c.x, c.c.y, i));
  const coCham = (x: number, y: number): boolean => {
    for (const i of luoiCham.quanh(x, y, saiSo * 2)) {
      const c = cham[i];
      if (Math.hypot(c.c.x - x, c.c.y - y) <= c.r + saiSo * 0.5) return true;
    }
    return false;
  };

  /**
   * Tuyến có vẽ chấm đấu nối ở đâu đó trên nó không. Trạm vẽ theo kiểu có chấm (vd
   * E6.20) thì chỗ dây cắt qua thanh cái mà KHÔNG có chấm là dây vắt qua; trạm vẽ
   * không dùng chấm (vd E6.4) thì dây cắt qua thanh cái là đấu vào thanh cái.
   */
  const tuyenCoCham = new Set<number>();
  for (const c of cham) {
    for (const s of luoi.quanh(c.c.x, c.c.y, saiSo)) {
      const a = A(s);
      const b = B(s);
      if (chieu(c.c.x, c.c.y, a.x, a.y, b.x, b.y)[1] <= c.r + saiSo * 0.5) tuyenCoCham.add(doanTuyen[s]);
    }
  }

  /**
   * Đầu p của tuyến i chạm tuyến j - nhưng có một nét khác đi XUYÊN qua p và kéo
   * tiếp sang phía bên kia tuyến j theo đúng hướng của tuyến i: đó là dây vẽ thành
   * nhiều đoạn chồng nhau đi ngang qua (không có chấm đấu nối), không phải rẽ nhánh.
   */
  const vatQua = (i: number, p: Pt, j: number): boolean => {
    const q = tuyen[i].p;
    const k0 = q[0] === p ? 1 : q[q.length - 1] === p ? q.length - 2 : -1;
    if (k0 < 0) return false;
    const dx = p.x - q[k0].x;
    const dy = p.y - q[k0].y;
    const L = Math.hypot(dx, dy);
    if (L < 1e-9) return false;
    const x = p.x + (dx / L) * saiSo * 1.5;
    const y = p.y + (dy / L) * saiSo * 1.5;
    const e = saiSo * 0.3;
    for (const s of luoi.quanh(p.x, p.y, saiSo * 2)) {
      const k = doanTuyen[s];
      if (k === i || k === j) continue;
      const a = A(s);
      const b = B(s);
      const [t, d] = chieu(p.x, p.y, a.x, a.y, b.x, b.y);
      const Ls = Math.hypot(b.x - a.x, b.y - a.y);
      // p nằm GIỮA đoạn của tuyến k (không phải đầu mút) và đoạn đó kéo qua phía kia
      if (d > e || t * Ls <= e || (1 - t) * Ls <= e) continue;
      if (chieu(x, y, a.x, a.y, b.x, b.y)[1] <= e) return true;
    }
    return false;
  };

  /* --- chữ T: đỉnh của tuyến này chạm vào giữa tuyến khác --- */
  // Bản vẽ CAD nhiều chỗ để hụt vài đơn vị giữa đầu thanh cái và ngăn lộ: nới thêm.
  const saiSoT = saiSo * 1.5;
  /** Các tuyến rẽ vào từng tuyến (để nhận ra thanh cái vẽ như dây thường). */
  const reVao: Set<number>[] = tuyen.map(() => new Set());
  tuyen.forEach((t, i) => {
    const ds = t.b.khongNoiGiua ? [t.p[0], t.p[t.p.length - 1]] : t.p;
    for (const p of ds) {
      const u = dinh(p.x, p.y);
      // Chỉ nới sai số cho đầu dây TỰ DO (không nối tiếp với nét nào): đầu dây đã
      // nối tiếp nét khác là chỗ dây vẽ thành nhiều đoạn đi ngang qua, nới ra sẽ
      // "hàn" nhầm vào thanh cái nó vắt qua.
      let tuDo = true;
      for (const s of luoi.quanh(p.x, p.y, saiSo * 0.3)) {
        if (doanTuyen[s] === i) continue;
        const a = A(s);
        const b = B(s);
        if (chieu(p.x, p.y, a.x, a.y, b.x, b.y)[1] <= saiSo * 0.3) {
          tuDo = false;
          break;
        }
      }
      const lim = tuDo ? saiSoT : saiSo;
      for (const s of luoi.quanh(p.x, p.y, lim)) {
        const j = doanTuyen[s];
        if (j === i) continue;
        const a = A(s);
        const b = B(s);
        if (tuyen[j].b.khongNoiGiua) {
          // chỉ đấu vào HAI ĐẦU của đường dây liên trạm
          const q = tuyen[j].p;
          const dau = doanSo[s] === 0 ? a : null;
          const cuoi = doanSo[s] === q.length - 2 ? b : null;
          for (const e of [dau, cuoi]) if (e && Math.hypot(e.x - p.x, e.y - p.y) <= lim) noi(u, dinh(e.x, e.y));
          continue;
        }
        const [tt, d] = chieu(p.x, p.y, a.x, a.y, b.x, b.y);
        if (d <= lim) {
          if ((tuyenCoCham.has(j) || tuyen[j].b.vong) && vatQua(i, p, j) && !coCham(p.x, p.y)) continue;
          noi(u, chiaTai(s, tt));
          reVao[j].add(i);
        }
      }
    }
  });

  /* --- ngăn lộ vẽ cắt ngang qua thanh cái (nét dây liền vắt qua thanh cái) ---
   * Thanh cái có vẽ chấm đấu nối thì chỉ tính là đấu nối khi có chấm tại chỗ cắt;
   * không có chấm là dây đi ngang qua (vd lộ 175 E6.20 đi Thịnh Đán vắt qua thanh
   * cái đường vòng rồi mới ra đường dây). */
  for (let s = 0; s < doanTuyen.length; s++) {
    const tb = tuyen[doanTuyen[s]].b;
    if (tb.lineKind !== 'Thanh cái') continue;
    const a = A(s);
    const b = B(s);
    const cand = new Set<number>();
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    const buoc = Math.max(co / 300, saiSo * 4);
    for (let k = 0; k <= Math.ceil(L / buoc); k++) {
      const f = Math.min(1, (k * buoc) / Math.max(L, 1e-9));
      for (const s2 of luoi.quanh(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, buoc)) cand.add(s2);
    }
    for (const s2 of cand) {
      const j = doanTuyen[s2];
      if (j === doanTuyen[s] || tuyen[j].b.khongNoiGiua || tuyen[j].b.kv !== tb.kv) continue;
      const c = A(s2);
      const d = B(s2);
      const den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
      if (Math.abs(den) < 1e-12) continue;
      const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / den;
      const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / den;
      if (t < 0 || t > 1 || u < 0 || u > 1) continue;
      const X = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      if (!coCham(X.x, X.y)) {
        // Không có chấm:
        //  - thanh cái vẽ kiểu có chấm (vd E6.20): dây vắt qua, không đấu nối;
        //  - thanh cái đường vòng (C19, C29 - đánh dấu theo các dao -9): các ngăn lộ
        //    vẽ vắt qua nó để xuống MBA / ra đường dây, không đấu nối;
        //  - thanh cái chính vẽ kiểu không dùng chấm (vd E6.4, E6.8): ngăn lộ vẽ
        //    xuyên qua thanh cái là đấu vào thanh cái.
        if (tuyenCoCham.has(doanTuyen[s]) || tb.vong) continue;
      }
      noi(chiaTai(s, t), chiaTai(s2, u));
    }
  }

  /* --- 3. Thiết bị --- */
  // Đầu mút các tuyến (để nối dây vào cuộn dây máy biến áp)
  const luoiDau = new LuoiO(Math.max(co / 300, saiSo * 4));
  const dsDau: number[] = [];
  for (const t of tuyen) {
    const n = t.p.length;
    for (const [q, k] of [
      [t.p[0], t.p[1]],
      [t.p[n - 1], t.p[n - 2]],
    ] as [Pt, Pt][]) {
      // Nét xiên vắt qua cuộn dây (mũi tên điều áp) không phải dây đấu vào máy
      const dx = Math.abs(k.x - q.x);
      const dy = Math.abs(k.y - q.y);
      if (Math.min(dx, dy) > Math.max(dx, dy) * 0.18) continue;
      const v = dinh(q.x, q.y);
      luoiDau.them(q.x, q.y, q.x, q.y, dsDau.length);
      dsDau.push(v);
    }
  }
  const dauTuyenQuanh = (x: number, y: number, r: number): number[] => {
    const out: number[] = [];
    for (const i of luoiDau.quanh(x, y, r)) {
      const v = dsDau[i];
      if (Math.hypot(vx[v] - x, vy[v] - y) <= r && !out.includes(v)) out.push(v);
    }
    return out;
  };
  const diemTai = new Set<number>(); // cực thiết bị mang tải (MBA phân phối, tự dùng…)
  const diemKhongTai = new Set<number>(); // cực thiết bị đấu rẽ không mang tải
  const diemThietBi = new Set<number>(); // đỉnh có bắt cực thiết bị
  const cucCat = new Set<number>(); // cực của thiết bị đang cắt
  const cucMayCat = new Set<number>(); // cực của máy cắt đang đóng
  const capCat: [number, number][] = []; // hai cực của từng thiết bị đang cắt
  const doanCat: [number, number, number, number][] = []; // khoảng dây nằm giữa hai cực thiết bị cắt
  const cucTreo: { v: number; x: number; y: number; dev: Id; r: number }[] = [];
  const tatCaCuc: { v: number; x: number; y: number; dev: Id }[] = [];
  for (const d of devices) {
    const cuc = mang.cucCua.get(d.id) ?? [];
    const def = getBlock(d.block);
    if (laMBA(d.block) && cuc.length >= 2) {
      // Máy biến áp: cực là TÂM các cuộn dây. Bản vẽ CAD có chỗ kéo dây vào tận tâm,
      // có chỗ dừng ở mép vòng tròn, lại có cả dây trung tính / chống sét van đấu vào
      // cùng cuộn - nên nối MỌI đầu dây nằm trong (hoặc chạm mép) cuộn dây về tâm máy.
      const tam = dinh(d.p.x, d.p.y);
      // máy biến áp là tải: phía hạ áp chưa vẽ tiếp thì công suất vẫn chạy tới máy
      diemTai.add(tam);
      const R = BAN_KINH_CUON * d.scale;
      for (const c of cuc) {
        let co = false;
        for (const v of dauTuyenQuanh(c.p.x, c.p.y, R * 1.3)) {
          noi(v, tam);
          diemThietBi.add(v);
          co = true;
        }
        if (!co) {
          const kq = bat(c.p.x, c.p.y, R * 1.3);
          if (kq) {
            noi(kq[0], tam);
            diemThietBi.add(kq[0]);
          }
        }
      }
      continue;
    }
    const r = Math.max(saiSo * 3, d.scale * 0.6, def ? Math.max(def.bbox[0], def.bbox[1]) * d.scale * 0.2 : 0);
    const dinhCuc: number[] = [];
    let soBat = 0;
    for (const c of cuc) {
      const kq = bat(c.p.x, c.p.y, r, cuc.length >= 2 ? d.p : undefined);
      let v: number;
      if (kq) {
        v = kq[0];
        soBat++;
      } else {
        // cực không chạm dây: có thể đấu thẳng vào cực thiết bị bên cạnh (dao cách ly
        // đặt sát máy cắt hợp bộ, không vẽ đoạn dây nối)
        v = dinh(c.p.x, c.p.y);
        cucTreo.push({ v, x: c.p.x, y: c.p.y, dev: d.id, r });
      }
      tatCaCuc.push({ v, x: c.p.x, y: c.p.y, dev: d.id });
      dinhCuc.push(v);
      diemThietBi.add(v);
    }
    if (!soBat && cuc.length < 2) continue;
    // MBA phân phối, MBA tự dùng: phụ tải cuối đường dây
    if (MANG_TAI.has(d.block)) for (const v of dinhCuc) diemTai.add(v);
    if (cuc.length < 2) {
      for (const v of dinhCuc) {
        if (KHONG_TAI.has(d.block)) diemKhongTai.add(v);
        else diemTai.add(v);
      }
      continue;
    }
    const dangCat = !!def?.switching && d.state === 'mo';
    if (!dangCat && MAY_CAT.has(d.block)) for (const v of dinhCuc) cucMayCat.add(v);
    if (!dangCat) {
      for (let i = 1; i < dinhCuc.length; i++) noi(dinhCuc[0], dinhCuc[i]);
      continue;
    }
    for (const v of dinhCuc) cucCat.add(v);
    if (dinhCuc.length >= 2) {
      const [u, v] = dinhCuc;
      doanCat.push([vx[u], vy[u], vx[v], vy[v]]);
      capCat.push([u, v]);
    }
  }

  /* --- cực treo nối vào cực gần nhất của thiết bị khác --- */
  if (cucTreo.length) {
    const luoiCuc = new LuoiO(Math.max(co / 300, saiSo * 4));
    tatCaCuc.forEach((c, i) => luoiCuc.them(c.x, c.y, c.x, c.y, i));
    for (const c of cucTreo) {
      let tot = -1;
      let bd = Math.max(saiSo * 2.5, c.r);
      for (const i of luoiCuc.quanh(c.x, c.y, bd)) {
        const k = tatCaCuc[i];
        if (k.dev === c.dev) continue;
        const d = Math.hypot(k.x - c.x, k.y - c.y);
        if (d < bd) {
          bd = d;
          tot = i;
        }
      }
      if (tot >= 0) noi(c.v, tatCaCuc[tot].v);
    }
  }

  /* --- máy biến áp vẽ bằng vòng tròn: dây đi vào cuộn dây nối về tâm máy --- */
  if (mbaVong.length) {
    const tamMBA = mbaVong.map((g) => {
      const x = g.reduce((s, c) => s + c.c.x, 0) / g.length;
      const y = g.reduce((s, c) => s + c.c.y, 0) / g.length;
      return dinh(x, y);
    });
    const soDinh = vx.length;
    for (let v = 0; v < soDinh; v++) {
      const g = trongMBA(vx[v], vy[v], saiSo);
      if (g >= 0 && v !== tamMBA[g]) {
        noi(v, tamMBA[g]);
        diemTai.add(tamMBA[g]);
        diemThietBi.add(v);
      }
    }
  }

  /* ---------- 4. Cạnh dây dẫn (có vẽ) ---------- */
  const veU: number[] = [];
  const veV: number[] = [];
  const veL: number[] = [];
  const veKv: VoltageKv[] = [];
  const veTuyen: number[] = [];
  const luoiCat = new LuoiO(Math.max(co / 300, saiSo * 4));
  doanCat.forEach((c, i) => luoiCat.them(c[0], c[1], c[2], c[3], i));
  const biCat = (u: number, v: number): boolean => {
    const mx = (vx[u] + vx[v]) / 2;
    const my = (vy[u] + vy[v]) / 2;
    for (const i of luoiCat.quanh(mx, my, saiSo)) {
      const [ax, ay, bx, by] = doanCat[i];
      const L = Math.hypot(bx - ax, by - ay);
      if (L < 1e-9) continue;
      const ok = (x: number, y: number): boolean => {
        const [t, d] = chieu(x, y, ax, ay, bx, by);
        return d <= Math.max(saiSo * 0.15, L * 0.05) && t * L >= -1e-6 && t <= 1 + 1e-6;
      };
      if (ok(vx[u], vy[u]) && ok(vx[v], vy[v]) && ok(mx, my)) return true;
    }
    return false;
  };
  const dauMut = new Set<number>(); // đầu mút tự do của tuyến (đầu xuất tuyến)
  for (let s = 0; s < doanTuyen.length; s++) {
    const m = chia.get(s);
    if (!m) continue;
    const ds = [...m.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
    const kv = tuyen[doanTuyen[s]].b.kv;
    for (let k = 1; k < ds.length; k++) {
      const u = ds[k - 1];
      const v = ds[k];
      if (u === v || biCat(u, v)) continue;
      veU.push(u);
      veV.push(v);
      veL.push(Math.hypot(vx[u] - vx[v], vy[u] - vy[v]));
      veKv.push(kv);
      veTuyen.push(doanTuyen[s]);
    }
  }
  tuyen.forEach((t) => {
    dauMut.add(dinh(t.p[0].x, t.p[0].y));
    dauMut.add(dinh(t.p[t.p.length - 1].x, t.p[t.p.length - 1].y));
  });

  /* ---------- 5. Kề và nguồn ---------- */
  const n = vx.length;
  const ke: number[][] = Array.from({ length: n }, () => []);
  // mã cạnh: >= 0 là cạnh vẽ, < 0 là cạnh nối (-(i+1))
  veU.forEach((u, i) => {
    ke[u].push(i);
    ke[veV[i]].push(i);
  });
  noiU.forEach((u, i) => {
    ke[u].push(-(i + 1));
    ke[noiV[i]].push(-(i + 1));
  });
  const canh = (c: number): [number, number, number] =>
    c >= 0 ? [veU[c], veV[c], veL[c]] : [noiU[-c - 1], noiV[-c - 1], noiL[-c - 1]];
  const ben = (c: number, u: number): number => {
    const [a, b] = canh(c);
    return a === u ? b : a;
  };

  // Mạch liên thông
  const mach = new Int32Array(n).fill(-1);
  let soMach = 0;
  for (let s = 0; s < n; s++) {
    if (mach[s] >= 0 || !ke[s].length) continue;
    const st = [s];
    mach[s] = soMach;
    while (st.length) {
      const u = st.pop() as number;
      for (const c of ke[u]) {
        const v = ben(c, u);
        if (mach[v] < 0) {
          mach[v] = soMach;
          st.push(v);
        }
      }
    }
    soMach++;
  }

  // Thanh cái: đúng loại "Thanh cái", hoặc nét thẳng nằm ngang có từ 3 ngăn lộ rẽ
  // vào (thanh cái 220kV trong bản vẽ CAD gốc vẽ bằng lớp dây thường).
  const laThanhCai = (i: number): boolean => {
    const t = tuyen[i];
    if (t.b.lineKind === 'Thanh cái') return true;
    if (t.b.khongNoiGiua || reVao[i].size < 3) return false;
    // một nét thẳng nằm ngang (có thể nhiều đỉnh thẳng hàng), đủ dài - nét ký hiệu
    // nối đất, ký hiệu TU cũng nằm ngang và có nét chạm vào nhưng rất ngắn
    const xs = t.p.map((q) => q.x);
    const ys = t.p.map((q) => q.y);
    const w = Math.max(...xs) - Math.min(...xs);
    if (w < saiSo * 10) return false;
    return Math.max(...ys) - Math.min(...ys) <= w * 0.01;
  };
  // Nguồn: đỉnh trên thanh cái cấp điện áp cao nhất của mỗi mạch (ưu tiên 220kV)
  const capCao = new Float64Array(soMach).fill(-1);
  const dinhThanhCai: [number, number, boolean][] = [];
  for (let s = 0; s < doanTuyen.length; s++) {
    const b = tuyen[doanTuyen[s]].b;
    if (!laThanhCai(doanTuyen[s])) continue;
    for (const v of chia.get(s)?.values() ?? []) {
      if (mach[v] < 0) continue;
      dinhThanhCai.push([v, b.kv, b.srcLayer === 'Trạm ngoài tỉnh']);
      capCao[mach[v]] = Math.max(capCao[mach[v]], b.kv);
    }
  }
  // Nguồn chính: thanh cái 220kV. Mạch không nối được về 220kV (bản vẽ đứt nét) thì
  // lấy thanh cái cấp cao nhất của mạch làm nguồn - TRỪ mạch bị TÁCH khỏi lưới có
  // điện bằng thiết bị đang cắt (cắt hai đầu một đoạn dây, cắt dao hai phía một
  // ngăn…): đoạn đó mất điện, không được coi là có nguồn riêng.
  const nguon = new Set<number>();
  const coNguon = new Uint8Array(soMach);
  for (const [v, kv, ngoai] of dinhThanhCai) {
    // thanh cái 220kV, và thanh cái các trạm 220kV ngoài tỉnh (chỉ vẽ phía 110kV)
    if (kv >= 220 || ngoai) {
      nguon.add(v);
      coNguon[mach[v]] = 1;
    }
  }
  const biTach = new Uint8Array(soMach);
  {
    const keCat = new Map<number, number[]>();
    for (const [u, v] of capCat) {
      const a = mach[u];
      const b = mach[v];
      if (a < 0 || b < 0 || a === b) continue;
      (keCat.get(a) ?? keCat.set(a, []).get(a)!).push(b);
      (keCat.get(b) ?? keCat.set(b, []).get(b)!).push(a);
    }
    const hangM: number[] = [];
    for (let m = 0; m < soMach; m++) if (coNguon[m]) hangM.push(m);
    const tham = new Uint8Array(soMach);
    for (const m of hangM) tham[m] = 1;
    while (hangM.length) {
      const m = hangM.pop() as number;
      for (const m2 of keCat.get(m) ?? []) {
        if (tham[m2]) continue;
        tham[m2] = 1;
        biTach[m2] = 1;
        hangM.push(m2);
      }
    }

    // Còn lại: các mạch không nối được về nguồn chính (bản vẽ đứt nét). Gom các mạch
    // nối với nhau qua thiết bị đang cắt thành một cụm; trong cụm chỉ lấy làm nguồn
    // những phân đoạn thanh cái CHÍNH (dài ≥ nửa phân đoạn dài nhất, cấp cao nhất
    // cụm) - khúc thanh cái ngắn bị kẹp giữa dao cách ly và máy cắt đang cắt (vd
    // giữa 112-1 và MC 112) thì mất điện.
    const daiTC = new Map<number, number>(); // mạch -> chiều dài thanh cái cấp cao nhất
    for (let i = 0; i < veU.length; i++) {
      const m = mach[veU[i]];
      if (m < 0 || !laThanhCai(veTuyen[i])) continue;
      if (veKv[i] !== capCao[m]) continue;
      daiTC.set(m, (daiTC.get(m) ?? 0) + veL[i]);
    }
    const cum = new Int32Array(soMach).fill(-1);
    const dsCum: number[][] = [];
    for (let m0 = 0; m0 < soMach; m0++) {
      if (tham[m0] || cum[m0] >= 0) continue;
      const ds = [m0];
      cum[m0] = dsCum.length;
      for (let k = 0; k < ds.length; k++) {
        for (const m2 of keCat.get(ds[k]) ?? []) {
          if (tham[m2] || cum[m2] >= 0) continue;
          cum[m2] = dsCum.length;
          ds.push(m2);
        }
      }
      dsCum.push(ds);
    }
    const chon = new Uint8Array(soMach);
    for (const ds of dsCum) {
      const kvMax = Math.max(...ds.map((m) => capCao[m]));
      if (kvMax < 110) continue;
      const dai = ds.filter((m) => capCao[m] === kvMax).map((m) => daiTC.get(m) ?? 0);
      const lon = Math.max(...dai);
      for (const m of ds) if (capCao[m] === kvMax && (daiTC.get(m) ?? 0) >= lon * 0.5) chon[m] = 1;
    }
    for (const [v, kv] of dinhThanhCai) {
      const m = mach[v];
      if (chon[m] && kv === capCao[m]) nguon.add(v);
    }
  }

  /* ---------- 6. Dijkstra đa nguồn ---------- */
  const kc = new Float64Array(n).fill(Infinity);
  const h = new Dong();
  for (const v of nguon) {
    kc[v] = 0;
    h.push(0, v);
  }
  while (h.size) {
    const [d, u] = h.pop();
    if (d > kc[u]) continue;
    for (const c of ke[u]) {
      const [, , L] = canh(c);
      const v = ben(c, u);
      const nd = d + L;
      if (nd < kc[v]) {
        kc[v] = nd;
        h.push(nd, v);
      }
    }
  }

  /* ---------- 7. Tỉa nhánh cụt không mang tải ---------- */
  const bac = new Int32Array(n);
  const song = new Uint8Array(veU.length + noiU.length + 1);
  const idx = (c: number): number => (c >= 0 ? c : veU.length - c - 1);
  for (let u = 0; u < n; u++) {
    if (!isFinite(kc[u])) continue;
    for (const c of ke[u]) {
      const v = ben(c, u);
      if (isFinite(kc[v])) {
        bac[u]++;
        song[idx(c)] = 1;
      }
    }
  }
  const coBac = (u: number): number[] => ke[u].filter((c) => song[idx(c)]);
  // Xuất tuyến trung áp hay kết thúc bằng dao tiếp địa đầu cáp: đi ngược từ đầu cụt
  // về chỗ rẽ nhánh, gặp máy cắt thì đó là xuất tuyến (có tải) - giữ lại.
  const xuatTuyen = new Set<number>();
  for (let u = 0; u < n; u++) {
    if (bac[u] !== 1) continue;
    let truoc = -1;
    let cur = u;
    for (let buoc = 0; buoc < 20000; buoc++) {
      if (cur !== u && bac[cur] !== 2) break;
      if (cucMayCat.has(cur)) {
        xuatTuyen.add(u);
        break;
      }
      if (nguon.has(cur)) break;
      const tiep = coBac(cur)
        .map((c) => ben(c, cur))
        .find((v) => v !== truoc);
      if (tiep === undefined) break;
      truoc = cur;
      cur = tiep;
    }
  }
  const giu = (u: number): boolean =>
    nguon.has(u) ||
    cucCat.has(u) ||
    diemTai.has(u) ||
    xuatTuyen.has(u) ||
    (dauMut.has(u) && !diemThietBi.has(u) && !diemKhongTai.has(u));
  const hang: number[] = [];
  for (let u = 0; u < n; u++) if (bac[u] === 1 && !giu(u)) hang.push(u);
  while (hang.length) {
    const u = hang.pop() as number;
    if (bac[u] !== 1) continue;
    for (const c of ke[u]) {
      if (!song[idx(c)]) continue;
      song[idx(c)] = 0;
      bac[u]--;
      const v = ben(c, u);
      bac[v]--;
      if (bac[v] === 1 && !giu(v)) hang.push(v);
    }
  }

  /* ---------- 8. Các khúc có hướng rồi nối thành chuỗi ---------- */
  interface Khuc {
    a: number; // đỉnh đầu (-1 = điểm gặp nhau giữa đoạn)
    b: number;
    ax: number;
    ay: number;
    bx: number;
    by: number;
    pha: number;
    L: number;
    kv: VoltageKv;
  }
  const khuc: Khuc[] = [];
  const diemDung: Pt[] = [];
  const eps = saiSo * 1e-3;
  for (let i = 0; i < veU.length; i++) {
    if (!song[i]) continue;
    const u = veU[i];
    const v = veV[i];
    const L = veL[i];
    const du = kc[u];
    const dv = kc[v];
    const kv = veKv[i];
    if (dv - du >= L - eps) khuc.push({ a: u, b: v, ax: vx[u], ay: vy[u], bx: vx[v], by: vy[v], pha: du, L, kv });
    else if (du - dv >= L - eps) khuc.push({ a: v, b: u, ax: vx[v], ay: vy[v], bx: vx[u], by: vy[u], pha: dv, L, kv });
    else {
      // mạch vòng: hai dòng gặp nhau trên đoạn này
      const x = Math.max(0, Math.min(L, (L + dv - du) / 2));
      const mx = vx[u] + ((vx[v] - vx[u]) * x) / L;
      const my = vy[u] + ((vy[v] - vy[u]) * x) / L;
      if (x > eps) khuc.push({ a: u, b: -1, ax: vx[u], ay: vy[u], bx: mx, by: my, pha: du, L: x, kv });
      if (L - x > eps) khuc.push({ a: v, b: -1, ax: vx[v], ay: vy[v], bx: mx, by: my, pha: dv, L: L - x, kv });
    }
  }
  for (const u of cucCat) if (isFinite(kc[u]) && bac[u] > 0) diemDung.push({ x: vx[u], y: vy[u] });

  const ra = new Map<number, number[]>();
  const vao = new Map<number, number>();
  khuc.forEach((k, i) => {
    const a = ra.get(k.a);
    if (a) a.push(i);
    else ra.set(k.a, [i]);
    if (k.b >= 0) vao.set(k.b, (vao.get(k.b) ?? 0) + 1);
  });
  const noiTiep = (k: Khuc): number => {
    if (k.b < 0 || vao.get(k.b) !== 1) return -1;
    const r = ra.get(k.b);
    if (!r || r.length !== 1) return -1;
    const k2 = khuc[r[0]];
    if (k2.kv !== k.kv || Math.abs(k2.pha - (k.pha + k.L)) > saiSo * 0.01) return -1;
    return r[0];
  };
  const laTiep = new Uint8Array(khuc.length);
  khuc.forEach((k) => {
    const j = noiTiep(k);
    if (j >= 0) laTiep[j] = 1;
  });
  const daDung = new Uint8Array(khuc.length);
  const chuoi: ChuoiCongSuat[] = [];
  const dungChuoi = (i0: number): void => {
    const k0 = khuc[i0];
    const c: ChuoiCongSuat = { pts: [k0.ax, k0.ay], pha: k0.pha, kv: k0.kv, minX: k0.ax, minY: k0.ay, maxX: k0.ax, maxY: k0.ay };
    let i = i0;
    while (i >= 0 && !daDung[i]) {
      daDung[i] = 1;
      const k = khuc[i];
      c.pts.push(k.bx, k.by);
      c.minX = Math.min(c.minX, k.bx);
      c.minY = Math.min(c.minY, k.by);
      c.maxX = Math.max(c.maxX, k.bx);
      c.maxY = Math.max(c.maxY, k.by);
      i = noiTiep(k);
    }
    chuoi.push(c);
  };
  khuc.forEach((_, i) => {
    if (!laTiep[i]) dungChuoi(i);
  });
  // phần còn lại (vòng khép kín - hiếm) cũng dựng chuỗi
  khuc.forEach((_, i) => {
    if (!daDung[i]) dungChuoi(i);
  });

  return { chuoi, diemDung, soNguon: nguon.size, soDoan: khuc.length };
}
