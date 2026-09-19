import { getBlock } from '../symbols/blocks';
import type { BranchEntity, DeviceEntity, Entity, Id, Pt } from './types';

/**
 * LIÊN KẾT ĐIỆN GIỮA CÁC ĐỐI TƯỢNG TRÊN SƠ ĐỒ.
 *
 * Bản vẽ nhập từ CAD chỉ là hình học: đường thẳng và ký hiệu. Muốn sau này hiện
 * được chiều công suất 110kV → máy biến áp → trung áp thì trước hết phải biết
 * thiết bị nào đấu với thiết bị nào. Mô-đun này dựng ra mô hình đó theo ba lớp:
 *
 *  1. NÚT ĐIỆN (nút đẳng thế).
 *     Một tuyến dây / thanh cái là một vật dẫn liền mạch nên MỌI đỉnh của nó là
 *     cùng một nút. Hai tuyến chạm nhau - đầu chạm đầu, hay đầu chạm vào GIỮA
 *     tuyến kia (rẽ nhánh chữ T từ thanh cái) - thì nhập làm một nút.
 *
 *  2. CỰC THIẾT BỊ.
 *     Mỗi ký hiệu có các cực đấu nối ghi sẵn trong thư viện block (`cuc`):
 *     thiết bị nối tiếp (máy cắt, dao cách ly, TI, recloser…) có hai cực ở hai
 *     đầu trục; thiết bị đấu rẽ xuống đất (dao tiếp địa, chống sét van, TU…) có
 *     một cực; máy biến áp có hai hoặc ba cực theo số cuộn dây. Cực được quay,
 *     lật, phóng theo đúng thiết bị rồi bắt vào nút gần nhất.
 *
 *  3. MẠCH (đảo điện).
 *     Nhập các nút nối thông qua thiết bị ĐANG ĐÓNG. Máy biến áp KHÔNG nhập
 *     chung vì hai phía khác cấp điện áp, nhưng được ghi lại thành "cầu nối qua
 *     máy biến áp" để đi xuyên từ 110kV xuống trung áp khi cần.
 *
 * Từ mô hình này, việc hiện chiều công suất sau này chỉ còn là duyệt cây từ
 * ngăn lộ nguồn (110/220kV) đi ra: lưới trung áp vận hành hình tia nên chiều
 * công suất trên mỗi nhánh chính là chiều đi xa dần nguồn.
 */

export interface CucNoi {
  /** Thiết bị. */
  dev: Id;
  /** Số thứ tự cực trên thiết bị. */
  soCuc: number;
  /** Vị trí cực trên bản vẽ. */
  p: Pt;
  /** Nút điện mà cực bắt vào. */
  nut: number;
  /** Cực này có thực sự bắt được vào một tuyến dây hay không. */
  batDuoc: boolean;
}

export interface MangDien {
  /** Số nút điện. */
  soNut: number;
  /** Tuyến / nút hình học thuộc nút điện nào. */
  nutCua: Map<Id, number>;
  /** Các cực của từng thiết bị. */
  cucCua: Map<Id, CucNoi[]>;
  /** Nút điện thuộc mạch (đảo) nào. */
  daoCuaNut: Int32Array;
  soDao: number;
  /** Cầu nối giữa hai mạch qua máy biến áp: [đảo A, đảo B, id máy biến áp]. */
  cauMBA: [number, number, Id][];
  /** Thiết bị chưa đấu được vào lưới (không cực nào bắt được nút). */
  chuaNoi: Id[];
  /** Thiết bị đấu nối thiếu (có cực bắt được, có cực không). */
  noiThieu: Id[];
}

/* ------------------------------ hợp - tìm ------------------------------ */

class HopTim {
  private cha: number[] = [];

  them(): number {
    this.cha.push(this.cha.length);
    return this.cha.length - 1;
  }

  tim(x: number): number {
    let r = x;
    while (this.cha[r] !== r) r = this.cha[r];
    while (this.cha[x] !== r) {
      const t = this.cha[x];
      this.cha[x] = r;
      x = t;
    }
    return r;
  }

  hop(a: number, b: number): void {
    const x = this.tim(a);
    const y = this.tim(b);
    if (x !== y) this.cha[x] = y;
  }

  get size(): number {
    return this.cha.length;
  }
}

/** Chỉ mục lưới cho các đoạn thẳng, để tìm tuyến gần một điểm. */
class LuoiDoan {
  private o = new Map<string, number[]>();

  constructor(private cell: number) {}

  them(a: Pt, b: Pt, v: number): void {
    const i0 = Math.floor(Math.min(a.x, b.x) / this.cell);
    const i1 = Math.floor(Math.max(a.x, b.x) / this.cell);
    const j0 = Math.floor(Math.min(a.y, b.y) / this.cell);
    const j1 = Math.floor(Math.max(a.y, b.y) / this.cell);
    if ((i1 - i0 + 1) * (j1 - j0 + 1) > 4000) return;
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const k = `${i}|${j}`;
        const arr = this.o.get(k);
        if (arr) arr.push(v);
        else this.o.set(k, [v]);
      }
    }
  }

  quanh(p: Pt, r: number): number[] {
    const out: number[] = [];
    const n = Math.max(1, Math.ceil(r / this.cell));
    const cx = Math.floor(p.x / this.cell);
    const cy = Math.floor(p.y / this.cell);
    for (let i = cx - n; i <= cx + n; i++) {
      for (let j = cy - n; j <= cy + n; j++) {
        for (const v of this.o.get(`${i}|${j}`) ?? []) if (!out.includes(v)) out.push(v);
      }
    }
    return out;
  }
}

function khoangCachDoan(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = dx * dx + dy * dy;
  let t = L > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(a.x + t * dx - p.x, a.y + t * dy - p.y);
}

function xoay(p: Pt, deg: number): Pt {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

/** Thiết bị đóng cắt đang MỞ thì không dẫn điện. */
function dangDan(e: DeviceEntity): boolean {
  const def = getBlock(e.block);
  if (!def?.switching) return true;
  return e.state !== 'mo';
}

/** Máy biến áp / tự ngẫu - nối các cấp điện áp khác nhau. */
function laMBA(block: string): boolean {
  return /^(MBA|AT)/.test(block);
}

/* ------------------------------ dựng mạng ------------------------------ */

export interface TuyChonMang {
  /** Sai số bắt điểm (đơn vị bản vẽ). Bỏ trống thì tự tính theo cỡ bản vẽ. */
  saiSo?: number;
}

/**
 * Dựng mô hình liên kết điện cho một danh sách đối tượng (thường là một tờ).
 */
export function dungMangDien(
  entities: Entity[],
  diem: (id: Id) => Pt | undefined,
  tc: TuyChonMang = {},
): MangDien {
  const branches = entities.filter((e): e is BranchEntity => e.kind === 'branch');
  const devices = entities.filter((e): e is DeviceEntity => e.kind === 'device');

  // Cỡ bản vẽ -> sai số bắt điểm
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const pts: Pt[][] = branches.map((b) => {
    const q: Pt[] = [];
    for (const n of b.nodes) {
      const p = diem(n);
      if (!p) continue;
      q.push(p);
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return q;
  });
  const co = Math.max(maxX - minX, maxY - minY, 1);
  const saiSo = tc.saiSo ?? Math.max(co * 2e-4, 1e-6);

  /* --- 1. Mỗi tuyến là một nút; tuyến chạm nhau thì nhập nút --- */
  const ht = new HopTim();
  for (let i = 0; i < branches.length; i++) ht.them();

  const luoi = new LuoiDoan(Math.max(co / 300, saiSo * 4));
  for (let i = 0; i < branches.length; i++) {
    const q = pts[i];
    for (let k = 1; k < q.length; k++) luoi.them(q[k - 1], q[k], i);
  }
  for (let i = 0; i < branches.length; i++) {
    for (const p of pts[i]) {
      for (const j of luoi.quanh(p, saiSo)) {
        if (j === i) continue;
        const q = pts[j];
        for (let k = 1; k < q.length; k++) {
          if (khoangCachDoan(p, q[k - 1], q[k]) <= saiSo) {
            ht.hop(i, j);
            break;
          }
        }
      }
    }
  }

  /* --- 2. Cực thiết bị bắt vào tuyến gần nhất --- */
  const cucCua = new Map<Id, CucNoi[]>();
  const chuaNoi: Id[] = [];
  const noiThieu: Id[] = [];
  /** Nút riêng cho cực không bắt được tuyến nào - để thiết bị vẫn có mạch riêng. */
  const nutRieng = new Map<string, number>();

  for (const d of devices) {
    const def = getBlock(d.block);
    const cucGoc: [number, number][] = def?.cuc?.length ? def.cuc : [[0, 0]];
    // Với thiết bị đấu rẽ (một cực), điểm đấu là ĐIỂM CHÈN của block CAD. Bản vẽ
    // dùng nhiều biến thể block khác nhau: "6-Tiep dia" kết thúc đúng tại điểm
    // đấu, còn "110-Tiep Dia" lại thò thêm một đoạn dây quá điểm đấu. Vì vậy thử
    // CẢ HAI vị trí - điểm chèn của ký hiệu mẫu và mép hộp bao - rồi lấy vị trí
    // nào bắt được đường dây.
    const themUngVien = (t: [number, number]): [number, number][] => {
      const out: [number, number][] = [t];
      if (def?.bbox) {
        const [w, h] = def.bbox;
        const k = Math.max(
          Math.abs(t[0]) / Math.max(w / 2, 1e-9),
          Math.abs(t[1]) / Math.max(h / 2, 1e-9),
        );
        if (k > 1e-6 && Math.abs(k - 1) > 0.02) out.push([t[0] / k, t[1] / k]);
      }
      return out;
    };
    const m = d.mirror ? -1 : 1;
    const ds: CucNoi[] = [];
    let batDuoc = 0;
    // Bán kính bắt: theo cỡ ký hiệu, vì ký hiệu vẽ tay không khít tuyệt đối
    // Ký hiệu mẫu và block trong bản vẽ CAD không cùng tỷ lệ ngang/dọc, nên cực
    // có thể lệch vài phần trăm cỡ ký hiệu; bán kính bắt lấy theo cỡ ký hiệu.
    const cuCo = def ? Math.max(def.bbox[0], def.bbox[1]) : 1;
    // Máy biến áp: đường dây trong bản vẽ kéo vào tận tâm cuộn dây, nên bán kính
    // bắt phải bằng cỡ một cuộn dây.
    const r = laMBA(d.block)
      ? Math.max(saiSo, d.scale * 1.25)
      : Math.max(saiSo, d.scale * 0.28, d.scale * cuCo * 0.1);
    for (let k = 0; k < cucGoc.length; k++) {
      const ungVien = cucGoc.length === 1 ? themUngVien(cucGoc[k]) : [cucGoc[k]];
      let nut = -1;
      let bd = r;
      let p = { x: d.p.x, y: d.p.y };
      for (const c of ungVien) {
        const v = xoay({ x: c[0] * m * d.scale, y: c[1] * d.scale }, d.rot);
        const q0 = { x: d.p.x + v.x, y: d.p.y + v.y };
        if (nut < 0) p = q0;
        for (const j of luoi.quanh(q0, r)) {
          const q = pts[j];
          for (let t = 1; t < q.length; t++) {
            const kc = khoangCachDoan(q0, q[t - 1], q[t]);
            if (kc < bd) {
              bd = kc;
              nut = ht.tim(j);
              p = q0;
            }
          }
        }
      }
      const daBat = nut >= 0;
      if (daBat) batDuoc++;
      else {
        // Cực lơ lửng (đầu nối đất, đầu cáp chưa vẽ) vẫn cho một nút riêng
        const key = `${d.id}#${k}`;
        let n = nutRieng.get(key);
        if (n === undefined) {
          n = ht.them();
          nutRieng.set(key, n);
        }
        nut = n;
      }
      ds.push({ dev: d.id, soCuc: k, p, nut, batDuoc: daBat });
    }
    cucCua.set(d.id, ds);
    if (batDuoc === 0) chuaNoi.push(d.id);
    else if (batDuoc < cucGoc.length && !laMBA(d.block) && (getBlock(d.block)?.inline ?? true)) {
      noiThieu.push(d.id);
    }
  }

  /* --- 3. Mạch: nhập nút qua thiết bị đang đóng --- */
  const dao = new HopTim();
  const soNutTho = ht.size;
  for (let i = 0; i < soNutTho; i++) dao.them();
  const cauMBA: [number, number, Id][] = [];
  for (const d of devices) {
    const ds = cucCua.get(d.id) ?? [];
    if (ds.length < 2) continue;
    if (laMBA(d.block)) {
      for (let i = 1; i < ds.length; i++) {
        cauMBA.push([ds[0].nut, ds[i].nut, d.id]);
      }
      continue;
    }
    if (!dangDan(d)) continue;
    for (let i = 1; i < ds.length; i++) dao.hop(ds[0].nut, ds[i].nut);
  }

  // Đánh số lại nút và mạch cho gọn
  const soNut = new Map<number, number>();
  const nutCua = new Map<Id, number>();
  const danhSo = (g: number): number => {
    let v = soNut.get(g);
    if (v === undefined) {
      v = soNut.size;
      soNut.set(g, v);
    }
    return v;
  };
  for (let i = 0; i < branches.length; i++) {
    const g = ht.tim(i);
    const n = danhSo(g);
    nutCua.set(branches[i].id, n);
    for (const id of branches[i].nodes) nutCua.set(id, n);
  }
  for (const ds of cucCua.values()) for (const c of ds) c.nut = danhSo(ht.tim(c.nut));

  const daoCuaNut = new Int32Array(soNut.size).fill(-1);
  const soDaoMap = new Map<number, number>();
  for (const [g, n] of soNut) {
    const r = dao.tim(g);
    let v = soDaoMap.get(r);
    if (v === undefined) {
      v = soDaoMap.size;
      soDaoMap.set(r, v);
    }
    daoCuaNut[n] = v;
  }
  const cau: [number, number, Id][] = cauMBA.map(([a, b, id]) => [
    daoCuaNut[danhSo(ht.tim(a))],
    daoCuaNut[danhSo(ht.tim(b))],
    id,
  ]);

  return {
    soNut: soNut.size,
    nutCua,
    cucCua,
    daoCuaNut,
    soDao: soDaoMap.size,
    cauMBA: cau,
    chuaNoi,
    noiThieu,
  };
}

/** Mạch (đảo) của một đối tượng bất kỳ, hoặc null nếu không thuộc mạch nào. */
export function daoCua(mang: MangDien, e: Entity): number | null {
  if (e.kind === 'branch' || e.kind === 'node') {
    const n = mang.nutCua.get(e.id);
    return n === undefined ? null : mang.daoCuaNut[n];
  }
  if (e.kind === 'device') {
    const ds = mang.cucCua.get(e.id);
    if (!ds?.length) return null;
    const c = ds.find((x) => x.batDuoc) ?? ds[0];
    return mang.daoCuaNut[c.nut];
  }
  return null;
}

/**
 * Tất cả đối tượng cùng một mạch với `goc`.
 *
 * `quaMBA` = true thì đi xuyên qua máy biến áp, tức lấy cả chuỗi
 * 110kV → máy biến áp → trung áp (dùng khi xem đường đi của công suất).
 */
export function cungMach(
  entities: Entity[],
  mang: MangDien,
  goc: Entity,
  quaMBA = false,
): Id[] {
  const d0 = daoCua(mang, goc);
  if (d0 === null) return [];
  const nhan = new Set<number>([d0]);
  if (quaMBA) {
    let them = true;
    while (them) {
      them = false;
      for (const [a, b] of mang.cauMBA) {
        if (nhan.has(a) && !nhan.has(b)) {
          nhan.add(b);
          them = true;
        } else if (nhan.has(b) && !nhan.has(a)) {
          nhan.add(a);
          them = true;
        }
      }
    }
  }
  const out: Id[] = [];
  for (const e of entities) {
    const d = daoCua(mang, e);
    if (d !== null && nhan.has(d)) out.push(e.id);
  }
  return out;
}
