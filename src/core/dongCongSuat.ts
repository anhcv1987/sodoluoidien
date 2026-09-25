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
const KHONG_TAI = new Set(['DTD', 'CSV', 'TU', 'TUC', 'TU3P', 'TUBU', 'COT', 'BDD', 'KHANG']);

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

  /* ---------- 1. Polyline các tuyến ---------- */
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const tuyen: { b: BranchEntity; p: Pt[] }[] = [];
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
  const bat = (x: number, y: number, r: number, boQua?: number): [number, number] | null => {
    let tot = -1;
    let tt = 0;
    let bd = r;
    for (const s of luoi.quanh(x, y, r)) {
      if (boQua !== undefined && doanTuyen[s] === boQua) continue;
      const a = A(s);
      const b = B(s);
      const [t, d] = chieu(x, y, a.x, a.y, b.x, b.y);
      if (d < bd) {
        bd = d;
        tot = s;
        tt = t;
      }
    }
    return tot < 0 ? null : [chiaTai(tot, tt), tot];
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
      for (const s of luoi.quanh(p.x, p.y, saiSoT)) {
        const j = doanTuyen[s];
        if (j === i) continue;
        const a = A(s);
        const b = B(s);
        if (tuyen[j].b.khongNoiGiua) {
          // chỉ đấu vào HAI ĐẦU của đường dây liên trạm
          const q = tuyen[j].p;
          const dau = doanSo[s] === 0 ? a : null;
          const cuoi = doanSo[s] === q.length - 2 ? b : null;
          for (const e of [dau, cuoi]) if (e && Math.hypot(e.x - p.x, e.y - p.y) <= saiSoT) noi(u, dinh(e.x, e.y));
          continue;
        }
        const [tt, d] = chieu(p.x, p.y, a.x, a.y, b.x, b.y);
        if (d <= saiSoT) {
          noi(u, chiaTai(s, tt));
          reVao[j].add(i);
        }
      }
    }
  });

  /* --- ngăn lộ vẽ cắt ngang qua thanh cái (nét dây liền vắt qua thanh cái) --- */
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
      noi(chiaTai(s, t), chiaTai(s2, u));
    }
  }

  /* --- 3. Thiết bị --- */
  const mang = dungMangDien(entities, diem);
  const diemTai = new Set<number>(); // cực thiết bị mang tải (MBA phân phối, tự dùng…)
  const diemKhongTai = new Set<number>(); // cực thiết bị đấu rẽ không mang tải
  const diemThietBi = new Set<number>(); // đỉnh có bắt cực thiết bị
  const cucCat = new Set<number>(); // cực của thiết bị đang cắt
  const doanCat: [number, number, number, number][] = []; // khoảng dây nằm giữa hai cực thiết bị cắt
  for (const d of devices) {
    const cuc = mang.cucCua.get(d.id) ?? [];
    const def = getBlock(d.block);
    const r = Math.max(saiSo * 3, d.scale * 0.6, def ? Math.max(def.bbox[0], def.bbox[1]) * d.scale * 0.2 : 0);
    const dinhCuc: number[] = [];
    for (const c of cuc) {
      const kq = c.batDuoc ? bat(c.p.x, c.p.y, r) : null;
      if (kq) {
        dinhCuc.push(kq[0]);
        diemThietBi.add(kq[0]);
      }
    }
    if (!dinhCuc.length) continue;
    if (laMBA(d.block)) {
      // máy biến áp: nối các phía qua tâm máy
      const tam = dinh(d.p.x, d.p.y);
      for (const v of dinhCuc) noi(v, tam);
      continue;
    }
    if (cuc.length < 2) {
      for (const v of dinhCuc) {
        if (KHONG_TAI.has(d.block)) diemKhongTai.add(v);
        else diemTai.add(v);
      }
      continue;
    }
    const dangCat = !!def?.switching && d.state === 'mo';
    if (!dangCat) {
      for (let i = 1; i < dinhCuc.length; i++) noi(dinhCuc[0], dinhCuc[i]);
      continue;
    }
    for (const v of dinhCuc) cucCat.add(v);
    if (dinhCuc.length >= 2) {
      const [u, v] = dinhCuc;
      doanCat.push([vx[u], vy[u], vx[v], vy[v]]);
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
        diemThietBi.add(v);
      }
    }
  }

  /* ---------- 4. Cạnh dây dẫn (có vẽ) ---------- */
  const veU: number[] = [];
  const veV: number[] = [];
  const veL: number[] = [];
  const veKv: VoltageKv[] = [];
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
    if (t.b.khongNoiGiua || t.p.length !== 2 || reVao[i].size < 3) return false;
    const [a, b] = t.p;
    return Math.abs(a.y - b.y) <= Math.abs(a.x - b.x) * 0.01;
  };
  // Nguồn: đỉnh trên thanh cái cấp điện áp cao nhất của mỗi mạch (ưu tiên 220kV)
  const capCao = new Float64Array(soMach).fill(-1);
  const dinhThanhCai: [number, number][] = [];
  for (let s = 0; s < doanTuyen.length; s++) {
    const b = tuyen[doanTuyen[s]].b;
    if (!laThanhCai(doanTuyen[s])) continue;
    for (const v of chia.get(s)?.values() ?? []) {
      if (mach[v] < 0) continue;
      dinhThanhCai.push([v, b.kv]);
      capCao[mach[v]] = Math.max(capCao[mach[v]], b.kv);
    }
  }
  const nguon = new Set<number>();
  for (const [v, kv] of dinhThanhCai) if (kv >= 110 && (kv === capCao[mach[v]] || kv >= 220)) nguon.add(v);

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
  const giu = (u: number): boolean =>
    nguon.has(u) || cucCat.has(u) || diemTai.has(u) || (dauMut.has(u) && !diemThietBi.has(u) && !diemKhongTai.has(u));
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
