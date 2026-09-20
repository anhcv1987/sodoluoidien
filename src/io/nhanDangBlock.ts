import type { Pt } from '../core/types';

/**
 * NHẬN DẠNG KÝ HIỆU VẼ BẰNG NÉT RỜI → THAY BẰNG BLOCK THIẾT BỊ.
 *
 * Trong bản vẽ CAD của Phòng Điều độ, 9/25 trạm (E26.1 Bắc Kạn, E6.17 Phú Bình,
 * E26.2 Chợ Đồn, E26.3 Nà Phặc, E6.20 Lưu Xá 220, E6.13 Yên Bình, E6.23, E6.14,
 * E6.18) không dùng block mà vẽ thẳng bằng LINE/CIRCLE. Nhập nguyên như vậy thì
 * những chỗ đó chỉ là các đoạn thẳng rời: không sửa được theo thiết bị, không đổi
 * được trạng thái đóng/cắt, và trông khác hẳn các trạm dùng block (E6.3, E6.5...).
 *
 * Module này dò bốn dạng ký hiệu phổ biến rồi thay bằng block tương ứng:
 *
 *   Máy cắt      bốn đoạn khép kín thành hình chữ nhật, hai cạnh ngắn có dây nối
 *   Biến dòng TI hình tròn nhỏ nằm trên đường dây
 *   Dao tiếp địa ba vạch song song ngắn dần (ký hiệu đất) + cần + lưỡi dao
 *   Dao cách ly  khe hở trên đường dây + lưỡi dao chéo ở một mép khe
 *
 * Với dao cách ly, các nét vẽ "liên động" (thanh nối cơ khí giữa dao cách ly và
 * dao tiếp địa) cũng được bỏ đi, để ký hiệu giống hệt các trạm dùng block.
 *
 * LÀM VIỆC TRÊN ĐOẠN THẲNG GỐC, trước khi gộp thành tuyến: nếu chạy sau bước gộp
 * thì cần và lưỡi dao đã dính vào đường dây, không còn nhận ra hình được nữa.
 */

export interface SegIn {
  a: Pt;
  b: Pt;
  layer: string;
}

export interface CircleIn {
  c: Pt;
  r: number;
  layer: string;
}

/** Thiết bị nhận dạng được, mô tả theo cách đặt block. */
export interface NhanDang {
  block: string;
  /** Tâm block trong toạ độ CAD gốc. */
  p: Pt;
  /** Góc quay của block trong hệ toạ độ phần mềm (độ). */
  rot: number;
  /** Cỡ block (đơn vị CAD). */
  scale: number;
  mirror: boolean;
  layer: string;
  /** Trạng thái đóng/mở đọc được từ chính hình vẽ (lưỡi dao chéo = mở). */
  state?: 'dong' | 'mo';
}

export interface KetQuaNhanDang {
  devices: NhanDang[];
  /** Chỉ số các đoạn thẳng đã bị thay bằng block (không tạo tuyến nữa). */
  boSeg: Set<number>;
  /** Chỉ số các hình tròn đã bị thay bằng block. */
  boCircle: Set<number>;
  thongKe: Record<string, number>;
}

/* ------------------------------ hình học ------------------------------ */

const len = (a: Pt, b: Pt): number => Math.hypot(b.x - a.x, b.y - a.y);
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const tam0 = mid;
const dot = (a: Pt, b: Pt): number => a.x * b.x + a.y * b.y;
const cross = (a: Pt, b: Pt): number => a.x * b.y - a.y * b.x;
const degOf = (v: Pt): number => (Math.atan2(v.y, v.x) * 180) / Math.PI;
const norm = (v: Pt): Pt => {
  const l = Math.hypot(v.x, v.y);
  return l < 1e-12 ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l };
};

/** Chênh lệch giữa hai phương, 0..90 độ (không phân biệt chiều). */
function lechPhuong(a: Pt, b: Pt): number {
  const d = Math.abs(degOf(a) - degOf(b)) % 180;
  return Math.min(d, 180 - d);
}

/** Chỉ mục lưới cho các điểm. */
class LuoiDiem<T> {
  private o = new Map<string, { p: Pt; v: T }[]>();

  constructor(private cell: number) {}

  them(p: Pt, v: T): void {
    const k = `${Math.floor(p.x / this.cell)}|${Math.floor(p.y / this.cell)}`;
    const a = this.o.get(k);
    if (a) a.push({ p, v });
    else this.o.set(k, [{ p, v }]);
  }

  quanh(p: Pt, r: number): { p: Pt; v: T }[] {
    const out: { p: Pt; v: T }[] = [];
    const n = Math.max(1, Math.ceil(r / this.cell));
    const cx = Math.floor(p.x / this.cell);
    const cy = Math.floor(p.y / this.cell);
    for (let i = cx - n; i <= cx + n; i++) {
      for (let j = cy - n; j <= cy + n; j++) {
        for (const e of this.o.get(`${i}|${j}`) ?? []) {
          if (len(e.p, p) <= r) out.push(e);
        }
      }
    }
    return out;
  }
}

/* ----------------------- thông số block trong CAD ---------------------- */

/** Hệ số chuẩn hoá dùng chung với src/symbols/blocks.ts. */
const K = 1 / 18.669;
/** Bán kính vòng tròn của block TI sau chuẩn hoá. */
const R_TI = 2.11 * K;
/** Khoảng cách từ vạch đất dài nhất tới đầu tiếp điểm, trong block "110-Tiep Dia". */
const L_DTD = 15.917;
/** Khoảng cách từ vạch đất dài nhất tới điểm chèn của block đó. */
const L_DTD_CHEN = 11.732;
/** Bề rộng KHE HỞ của ký hiệu dao cách ly MỞ, sau chuẩn hoá. */
const KHE_DCL_MO = 0.5687;
/** Chiều cao block "110-MC" sau chuẩn hoá (theo định nghĩa = 1). */
const H_MC = 1;
/** Chiều cao block "22-MCHB" (thân máy cắt + hai cụm mũi tên) sau chuẩn hoá. */
const H_MCHB = 61.67 * K;

/* ------------------------------ nhận dạng ------------------------------ */

/**
 * Chọn những dạng ký hiệu nào được phép thay bằng block.
 *
 * Mặc định CHỈ bật máy cắt và TI: hai dạng này có dấu hiệu hình học rõ ràng
 * (hình chữ nhật khép kín có dây nối hai đầu; vòng tròn nhỏ nằm trên dây) nên
 * nhận gần như không sai. Dao cách ly và dao tiếp địa vẽ tay mỗi nơi một tỷ lệ,
 * quy về block sẽ sai cỡ và lệch chỗ, nên để tắt; bật khi cần thử nghiệm.
 */
export interface TuyChonNhanDang {
  mayCat: boolean;
  ti: boolean;
  daoCachLy: boolean;
  daoTiepDia: boolean;
  /** Bỏ nét liên động quanh dao cách ly (chỉ có tác dụng khi bật daoCachLy). */
  boLienDong: boolean;
}

export const macDinhNhanDang = (): TuyChonNhanDang => ({
  mayCat: true,
  ti: true,
  daoCachLy: true,
  daoTiepDia: true,
  boLienDong: false,
});

/**
 * Nối các đoạn THẲNG HÀNG nối tiếp nhau thành một đoạn.
 *
 * Bản vẽ vẽ tay hay cắt một nét thành hai nửa: ba vạch của ký hiệu đất ở E26.1
 * Bắc Kạn mỗi vạch là hai nửa trên/dưới trục. Không nối lại thì không nhận ra
 * được ký hiệu nào cả. Chỉ nối khi tại điểm chung CHỈ CÓ MỘT đoạn cùng phương,
 * để không nuốt mất lưỡi dao hay nhánh rẽ.
 */
function gopThangHang(segs: SegIn[]): { segs: SegIn[]; goc: number[][] } {
  const n = segs.length;
  const huong = segs.map((s) => norm(sub(s.b, s.a)));
  const dai0 = segs.map((s) => len(s.a, s.b));
  const cell = 0.4;
  const luoi = new Map<string, number[]>();
  const them = (p: Pt, i: number): void => {
    const k = `${Math.floor(p.x / cell)}|${Math.floor(p.y / cell)}`;
    const a = luoi.get(k);
    if (a) a.push(i);
    else luoi.set(k, [i]);
  };
  for (let i = 0; i < n; i++) {
    if (dai0[i] < 1e-9) continue;
    them(segs[i].a, i);
    them(segs[i].b, i);
  }
  const quanh = (p: Pt): number[] => {
    const out: number[] = [];
    const gx = Math.floor(p.x / cell);
    const gy = Math.floor(p.y / cell);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        for (const k of luoi.get(`${gx + i}|${gy + j}`) ?? []) {
          if (len(segs[k].a, p) < 0.08 || len(segs[k].b, p) < 0.08) out.push(k);
        }
      }
    }
    return out;
  };
  const cha = new Int32Array(n);
  for (let i = 0; i < n; i++) cha[i] = i;
  const tim = (x: number): number => {
    while (cha[x] !== x) x = cha[x] = cha[cha[x]];
    return x;
  };
  for (let i = 0; i < n; i++) {
    if (dai0[i] < 1e-9) continue;
    for (const p of [segs[i].a, segs[i].b]) {
      const cung = quanh(p).filter(
        (j) => j !== i && segs[j].layer === segs[i].layer && lechPhuong(huong[j], huong[i]) < 4,
      );
      if (cung.length !== 1) continue;
      const j = cung[0];
      const a = tim(i);
      const b = tim(j);
      if (a !== b) cha[a] = b;
    }
  }
  const nhom = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const g = tim(i);
    const a = nhom.get(g);
    if (a) a.push(i);
    else nhom.set(g, [i]);
  }
  const ra: SegIn[] = [];
  const goc: number[][] = [];
  for (const list of nhom.values()) {
    if (list.length === 1) {
      ra.push(segs[list[0]]);
      goc.push(list);
      continue;
    }
    // Hai đầu xa nhau nhất của cả nhóm
    const pts: Pt[] = [];
    for (const i of list) {
      pts.push(segs[i].a);
      pts.push(segs[i].b);
    }
    let A = pts[0];
    let B = pts[0];
    let d = -1;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const l = len(pts[i], pts[j]);
        if (l > d) {
          d = l;
          A = pts[i];
          B = pts[j];
        }
      }
    }
    ra.push({ a: A, b: B, layer: segs[list[0]].layer });
    goc.push(list);
  }
  return { segs: ra, goc };
}

export function nhanDangBlock(
  segsGoc: SegIn[],
  circles: CircleIn[],
  tol: number,
  chon: TuyChonNhanDang = macDinhNhanDang(),
): KetQuaNhanDang {
  const { segs, goc } = gopThangHang(segsGoc);
  const devices: NhanDang[] = [];
  const boSeg = new Set<number>();
  const boCircle = new Set<number>();
  const thongKe: Record<string, number> = {};
  const dem = (k: string, n = 1): void => void (thongKe[k] = (thongKe[k] ?? 0) + n);

  /** Bán kính coi hai điểm là "chạm nhau". */
  const hut = Math.max(tol * 8, 0.05);

  const dai = segs.map((s) => len(s.a, s.b));
  const huong = segs.map((s) => norm(sub(s.b, s.a)));

  // Chỉ mục đầu mút -> chỉ số đoạn
  const mut = new LuoiDiem<number>(Math.max(hut * 4, 1e-6));
  segs.forEach((s, i) => {
    mut.them(s.a, i);
    mut.them(s.b, i);
  });

  /** Các đoạn chưa dùng có đầu mút trùng `p`. */
  const taiDiem = (p: Pt, tru: number[] = []): number[] =>
    mut
      .quanh(p, hut)
      .map((e) => e.v)
      .filter((i, k, arr) => !boSeg.has(i) && !tru.includes(i) && arr.indexOf(i) === k);

  /** Đầu còn lại của đoạn i tính từ điểm p. */
  const dauKia = (i: number, p: Pt): Pt => (len(segs[i].a, p) <= len(segs[i].b, p) ? segs[i].b : segs[i].a);

  /* -------- 1. Máy cắt: bốn đoạn khép kín thành hình chữ nhật -------- */

  for (let i0 = 0; chon.mayCat && i0 < segs.length; i0++) {
    if (boSeg.has(i0) || dai[i0] < 2 || dai[i0] > 60) continue;
    const goc = segs[i0].a;
    // Đi vòng 4 cạnh, mỗi lần rẽ vuông góc
    const canh = [i0];
    let diem = segs[i0].b;
    let ok = true;
    for (let k = 1; k < 4; k++) {
      const tiep = taiDiem(diem, canh).filter(
        (j) => dai[j] >= 2 && dai[j] <= 60 && lechPhuong(huong[j], huong[canh[k - 1]]) > 80,
      );
      if (tiep.length !== 1) {
        ok = false;
        break;
      }
      canh.push(tiep[0]);
      diem = dauKia(tiep[0], diem);
    }
    if (!ok || len(diem, goc) > hut) continue;

    const l = canh.map((j) => dai[j]);
    if (Math.abs(l[0] - l[2]) > l[0] * 0.1 || Math.abs(l[1] - l[3]) > l[1] * 0.1) continue;
    const dDai = Math.max(l[0], l[1]);
    const dNgan = Math.min(l[0], l[1]);
    const tyLe = dNgan / dDai;
    if (dDai < 4 || dDai > 60 || tyLe < 0.3 || tyLe > 1.0) continue;

    const truc = l[0] >= l[1] ? huong[canh[0]] : huong[canh[1]];
    const tam = mid(mid(segs[canh[0]].a, segs[canh[0]].b), mid(segs[canh[2]].a, segs[canh[2]].b));

    // Phải có dây nối vào ít nhất một cạnh ngắn -> đúng là thiết bị nối tiếp
    const ngangTruc = { x: -truc.y, y: truc.x };
    const dauNgan: Pt[] = [add(tam, mul(truc, dDai / 2)), add(tam, mul(truc, -dDai / 2))];
    const coDay = dauNgan.some((m) => taiDiem(m, canh).length > 0);
    if (!coDay) continue;
    void ngangTruc;

    /* --- May cat HOP BO: hinh chu nhat + hai cum mui ten tren va duoi --- */
    // Tu hop bo ve them hai cum "mui ten" (tiep diem xe day) o tren va duoi than
    // may cat. Co du hai cum thi phai thay bang block may cat hop bo, khong phai
    // may cat thuong.
    const nganTruc2 = { x: -truc.y, y: truc.x };
    const doc = (p: Pt): number => dot(sub(p, tam), truc);
    const ngang = (p: Pt): number => dot(sub(p, tam), nganTruc2);
    const nuaDai = dDai / 2;
    const timMuiTen = (dau: 1 | -1): { seg: number[]; xa: number } => {
      const seg: number[] = [];
      let xa = nuaDai;
      for (let k = 0; k < segs.length; k++) {
        if (boSeg.has(k) || canh.includes(k)) continue;
        const u1 = doc(segs[k].a) * dau;
        const u2 = doc(segs[k].b) * dau;
        const v1 = Math.abs(ngang(segs[k].a));
        const v2 = Math.abs(ngang(segs[k].b));
        if (Math.min(u1, u2) < nuaDai - dNgan * 0.2 || Math.max(u1, u2) > nuaDai + dDai * 1.2) continue;
        // Cánh mũi tên có nơi rộng hơn cả thân máy cắt (E26.3 Nà Phặc: cánh
        // vươn ra 10,3 trong khi thân rộng 11,2) nên không siết chặt được.
        if (Math.max(v1, v2) > dNgan * 1.15) continue;
        const a = lechPhuong(huong[k], truc);
        // Canh mui ten nam cheo; doan doc truc la day noi giua than va mui ten
        if (a < 18 && dai[k] < dDai * 1.2) {
          seg.push(k);
          xa = Math.max(xa, Math.max(u1, u2));
          continue;
        }
        if (a >= 18 && a <= 80 && dai[k] < dDai) {
          seg.push(k);
          xa = Math.max(xa, Math.max(u1, u2));
        }
      }
      const cheo = seg.filter((k) => lechPhuong(huong[k], truc) >= 18);
      return cheo.length >= 2 ? { seg, xa } : { seg: [], xa: nuaDai };
    };
    const tren = timMuiTen(1);
    const duoi = timMuiTen(-1);
    const hopBo = chon.mayCat && tren.seg.length > 0 && duoi.seg.length > 0;

    for (const j of canh) boSeg.add(j);
    if (hopBo) {
      for (const k of tren.seg) boSeg.add(k);
      for (const k of duoi.seg) boSeg.add(k);
      const toanBo = tren.xa + duoi.xa;
      devices.push({
        block: 'MCHB',
        p: tam,
        rot: degOf(truc) - 90,
        scale: toanBo / H_MCHB,
        mirror: false,
        layer: segs[i0].layer,
      });
      dem('MCHB');
      continue;
    }
    devices.push({
      block: 'MC',
      p: tam,
      rot: degOf(truc) - 90,
      scale: dDai / H_MC,
      mirror: false,
      layer: segs[i0].layer,
    });
    dem('MC');
  }

  /* ---------------- 2. Biến dòng TI: vòng tròn trên dây ---------------- */

  circles.forEach((c, i) => {
    if (!chon.ti) return;
    // Vòng tròn của TI trong bản vẽ chỉ khoảng 1,5-2,5 đơn vị và RỖNG.
    // Vòng tròn to hơn, hoặc có nét vẽ bên trong (tụ bù, TU, máy biến áp,
    // thiết bị bù) thì không phải TI - giữ nguyên là hình tròn.
    if (c.r < 0.4 || c.r > 5.2) return;
    // Cuộn dây TU / TUC / máy biến áp vẽ thành CỤM vòng tròn chồng nhau, còn TI
    // thì đứng một mình trên đường dây.
    const cum = circles.some(
      (o, k) =>
        k !== i &&
        Math.abs(o.r - c.r) < c.r * 0.35 &&
        len(o.c, c.c) < c.r * 2.5,
    );
    if (cum) return;
    if (!mut.quanh(c.c, Math.max(c.r * 3.5, hut * 4)).length) return;
    // Đoạn dây đi XUYÊN QUA vòng tròn là bình thường; nhưng đoạn nằm GỌN bên
    // trong (nét chữ thập của tụ bù, nét cuộn dây của TU) thì đây không phải TI.
    const trongLong = mut
      .quanh(c.c, c.r * 0.9)
      .some((e) => {
        const s2 = segs[e.v];
        return len(s2.a, c.c) < c.r * 0.9 && len(s2.b, c.c) < c.r * 0.9;
      });
    if (trongLong) return;
    boCircle.add(i);
    devices.push({
      block: 'TI',
      p: c.c,
      rot: 0,
      scale: c.r / R_TI,
      mirror: false,
      layer: c.layer,
    });
    dem('TI');
  });

  /* ------- 3. Dao tiếp địa: ba vạch song song ngắn dần + cần + lưỡi ------ */

  const tamSeg = segs.map((s) => mid(s.a, s.b));
  const luoiTam = new LuoiDiem<number>(8);
  segs.forEach((_, i) => {
    if (dai[i] >= 0.3 && dai[i] <= 20) luoiTam.them(tamSeg[i], i);
  });

  for (let i1 = 0; chon.daoTiepDia && i1 < segs.length; i1++) {
    if (boSeg.has(i1) || dai[i1] < 0.8 || dai[i1] > 20) continue;
    const L1 = dai[i1];
    const h1 = huong[i1];
    const truc = { x: -h1.y, y: h1.x };
    const t = (p: Pt): number => dot(sub(p, tamSeg[i1]), truc);
    const ngang = (p: Pt): number => dot(sub(p, tamSeg[i1]), h1);

    const gan = luoiTam
      .quanh(tamSeg[i1], L1 * 3 + 4)
      .map((e) => e.v)
      .filter(
        (j) =>
          j !== i1 &&
          !boSeg.has(j) &&
          dai[j] < L1 * 0.95 &&
          lechPhuong(huong[j], h1) < 10 &&
          Math.abs(ngang(tamSeg[j])) < L1 * 0.4,
      )
      .sort((a, b) => Math.abs(t(tamSeg[a])) - Math.abs(t(tamSeg[b])));
    if (gan.length < 2) continue;
    const i2 = gan[0];
    const i3 = gan[1];
    const t2 = t(tamSeg[i2]);
    const t3 = t(tamSeg[i3]);
    if (!t2 || !t3 || Math.sign(t2) !== Math.sign(t3)) continue;
    if (Math.abs(t2) > L1 * 1.3 || Math.abs(t3) > L1 * 2.4) continue;
    // Ba vạch cách đều nhau
    if (Math.abs(Math.abs(t3) - 2 * Math.abs(t2)) > Math.abs(t2) * 0.8) continue;
    if (dai[i3] > dai[i2]) continue;

    // Hướng từ đất ra tiếp điểm
    const d = mul(norm(truc), -Math.sign(t2));

    // Cần nối: đoạn xuất phát từ tâm vạch dài nhất, chạy theo hướng d
    const can = taiDiem(tamSeg[i1], [i1, i2, i3]).find(
      (j) => lechPhuong(huong[j], d) < 14 && dai[j] > 0.5 && dai[j] < L1 * 6,
    );
    if (can === undefined) continue;
    const dauCan = dauKia(can, tamSeg[i1]);

    // Lưỡi dao: đoạn chéo nối tiếp đầu kia của cần
    const luoi = taiDiem(dauCan, [i1, i2, i3, can]).find((j) => {
      const v = sub(dauKia(j, dauCan), dauCan);
      const a = lechPhuong(v, d);
      return a > 8 && a < 82 && dai[j] > 0.8 && dai[j] < L1 * 6;
    });
    if (luoi === undefined) continue;
    const dinhLuoi = dauKia(luoi, dauCan);

    // Sau lưỡi dao thường còn một đoạn dây nối tiếp tới đường dây chính. Ký hiệu
    // dao tiếp địa phải dài tới đó, nếu không sẽ vẽ ngắn hơn hình gốc và hở ra
    // một quãng giữa ký hiệu và đường dây.
    let xaNhat = len(tamSeg[i1], dinhLuoi);
    const banKinh = xaNhat * 1.6;
    for (const e of luoiTam.quanh(add(tamSeg[i1], mul(d, xaNhat)), banKinh)) {
      const j = e.v;
      if (j === i1 || j === i2 || j === i3 || j === can || j === luoi || boSeg.has(j)) continue;
      if (lechPhuong(huong[j], d) > 14) continue;
      for (const q of [segs[j].a, segs[j].b]) {
        const doc = dot(sub(q, tamSeg[i1]), d);
        const lech = Math.abs(dot(sub(q, tamSeg[i1]), h1));
        if (doc > xaNhat && doc < xaNhat * 2.2 && lech < L1 * 1.2) {
          xaNhat = doc;
          boSeg.add(j);
        }
      }
    }
    const L = xaNhat;
    if (L < 3 || L > 150) continue;

    boSeg.add(i1);
    boSeg.add(i2);
    boSeg.add(i3);
    boSeg.add(can);
    boSeg.add(luoi);
    devices.push({
      block: 'DTD',
      state: 'mo',
      p: add(tamSeg[i1], mul(d, (L_DTD_CHEN / L_DTD) * L)),
      // Trục của ký hiệu trong thư viện hướng +Y, còn `d` là hướng từ đất ra tiếp
      // điểm trong toạ độ bản vẽ -> phải trừ 90 độ, nếu không dao tiếp địa sẽ
      // nằm vuông góc với thực tế và không bắt được vào đường dây.
      rot: degOf(d) - 90,
      scale: (L / L_DTD) * 18.669,
      mirror: cross(d, sub(dinhLuoi, dauCan)) < 0,
      layer: segs[i1].layer,
    });
    dem('DTĐ');
  }

  /* ---------- 4. Dao cách ly: khe hở trên đường dây + lưỡi chéo ---------- */

  interface Mep {
    seg: number;
    p: Pt;
    /** Phương của đoạn, hướng từ mép khe đi vào trong đoạn. */
    vao: Pt;
  }
  const meps: Mep[] = [];
  if (chon.daoCachLy) segs.forEach((s, i) => {
    if (boSeg.has(i) || dai[i] < 1) return;
    meps.push({ seg: i, p: s.a, vao: huong[i] });
    meps.push({ seg: i, p: s.b, vao: mul(huong[i], -1) });
  });
  const luoiMep = new LuoiDiem<number>(12);
  meps.forEach((m, i) => luoiMep.them(m.p, i));

  const daDung = new Set<number>();
  for (let i = 0; i < meps.length; i++) {
    const A = meps[i];
    if (daDung.has(i) || boSeg.has(A.seg)) continue;
    for (const e of luoiMep.quanh(A.p, 45)) {
      const j = e.v;
      if (j <= i || daDung.has(j)) continue;
      const B = meps[j];
      if (B.seg === A.seg || boSeg.has(B.seg)) continue;

      const G = len(A.p, B.p);
      // Khe của dao cách ly vẽ tay chỉ khoảng 10-20 đơn vị; khe rộng hơn thường
      // là hai đoạn dây rời nhau chứ không phải thiết bị.
      if (G < 6 || G > 24) continue;
      const truc = norm(sub(B.p, A.p));
      // Hai đoạn cùng phương với khe và quay lưng vào nhau (khe nằm giữa)
      if (lechPhuong(truc, A.vao) > 6 || lechPhuong(truc, B.vao) > 6) continue;
      if (dot(A.vao, truc) > 0 || dot(B.vao, truc) < 0) continue;

      // Trong khe KHÔNG được có nét vẽ nào khác. Thiếu điều kiện này thì hai
      // đầu dây cách nhau khá xa cũng bị ghép thành một dao cách ly, sinh ra ký
      // hiệu to gấp mấy lần thật (đã gặp ở E26.1 Bắc Kạn).
      const ngang0 = { x: -truc.y, y: truc.x };
      let vuong = true;
      for (const e2 of mut.quanh(tam0(A.p, B.p), G)) {
        const k = e2.v;
        if (k === A.seg || k === B.seg || boSeg.has(k)) continue;
        const q = e2.p;
        const u = dot(sub(q, A.p), truc);
        if (u > G * 0.12 && u < G * 0.88 && Math.abs(dot(sub(q, A.p), ngang0)) < G * 0.35) {
          vuong = false;
          break;
        }
      }
      if (!vuong) continue;

      // Lưỡi dao: đoạn chéo bắt đầu ở một trong hai mép khe.
      // Ở mép còn lại thường có thêm một nét chéo NGẮN là tiếp điểm tĩnh; phải
      // lấy nét DÀI NHẤT làm lưỡi dao, nếu không ký hiệu vẽ ra sẽ quay ngược và
      // lưỡi dao thật vẫn còn nằm lại thành nét rời (lỗi dao cách ly 110kV).
      let luoi: number | undefined;
      let goc: Pt | undefined;
      const cheoKhac: number[] = [];
      for (const mep of [A.p, B.p]) {
        for (const k of taiDiem(mep, [A.seg, B.seg])) {
          const v = sub(dauKia(k, mep), mep);
          const a = lechPhuong(v, truc);
          if (a <= 10 || a >= 80 || dai[k] <= 1.5 || dai[k] >= G * 1.8) continue;
          if (luoi === undefined || dai[k] > dai[luoi]) {
            if (luoi !== undefined) cheoKhac.push(luoi);
            luoi = k;
            goc = mep;
          } else cheoKhac.push(k);
        }
      }
      if (luoi === undefined || !goc) continue;
      // Nét tiếp điểm tĩnh cũng thuộc ký hiệu -> bỏ luôn, khỏi vẽ thừa
      for (const k of cheoKhac) boSeg.add(k);

      const tam = mid(A.p, B.p);
      // Đặt ký hiệu sao cho lưỡi dao vẽ ra trùng hướng lưỡi dao trên bản vẽ:
      // trục +X của ký hiệu hướng về mép khe có chân lưỡi dao, còn ngọn lưỡi
      // nằm bên nào thì lật gương theo bên đó.
      const trucL = norm(sub(goc, tam));
      const ngonLuoi = sub(dauKia(luoi, goc), goc);
      const lat = cross(trucL, ngonLuoi) < 0;
      boSeg.add(luoi);
      daDung.add(i);
      daDung.add(j);
      devices.push({
        block: 'DCL',
        state: 'mo',
        p: tam,
        // Trục ký hiệu dao cách ly trong thư viện nằm ngang (+X) ở góc 0, khác
        // máy cắt (trục dọc +Y), nên KHÔNG trừ 90 độ như máy cắt.
        // Lật gương trong phần mềm đổi dấu trục X - tức đổi luôn phía chân lưỡi
        // dao. Muốn chỉ đổi phía NGỌN lưỡi thì phải lật gương ĐỒNG THỜI quay
        // thêm 180 độ, khi đó chân lưỡi trở về đúng mép khe cũ.
        rot: degOf(trucL) + (lat ? 180 : 0),
        // Ký hiệu vẽ ra phải có KHE HỞ đúng bằng khe hở dò được trên bản vẽ
        scale: G / KHE_DCL_MO,
        mirror: lat,
        layer: segs[A.seg].layer,
      });
      dem('DCL');

      /* --- Bỏ nét liên động còn sót quanh dao cách ly vừa nhận dạng --- */
      if (!chon.boLienDong) break;
      const R = G * 1.1;
      const ngangTruc = { x: -truc.y, y: truc.x };
      const trong = (p: Pt): boolean =>
        Math.abs(dot(sub(p, tam), truc)) <= R && Math.abs(dot(sub(p, tam), ngangTruc)) <= R;
      let boDi = 0;
      for (let k = 0; k < segs.length; k++) {
        if (boSeg.has(k) || k === A.seg || k === B.seg) continue;
        if (!trong(segs[k].a) || !trong(segs[k].b)) continue;
        // Chỉ bỏ nét nằm LỆCH hẳn khỏi trục ngăn lộ (thanh nối cơ khí),
        // không đụng tới phần nằm trên chính đường dây.
        const lech = Math.min(
          Math.abs(dot(sub(segs[k].a, tam), ngangTruc)),
          Math.abs(dot(sub(segs[k].b, tam), ngangTruc)),
        );
        if (lech < G * 0.18) continue;
        boSeg.add(k);
        boDi++;
      }
      if (boDi) dem('bỏ nét liên động', boDi);
      break;
    }
  }

  // Đổi chỉ số đoạn đã gộp về chỉ số đoạn gốc
  const boGoc = new Set<number>();
  for (const i of boSeg) for (const k of goc[i] ?? []) boGoc.add(k);
  return { devices, boSeg: boGoc, boCircle, thongKe };
}
