/**
 * CHUẨN HOÁ DAO CÁCH LY + DAO TIẾP ĐỊA KIỂU "LIÊN ĐỘNG" (110kV và 35kV).
 *
 *   node tools/chuan-hoa-dcl-lien-dong.mjs [src/data/tram-sld.json]
 *
 * Ở các trạm vẽ tay (E6.13, E6.17, E6.18, E6.20, E26.1, E26.2, E26.3...) dao cách
 * ly được vẽ kiểu liên động: lưỡi dao chéo mở trên đường dây, hai dao tiếp địa đặt
 * ĐÈ lên đường dây ngay tại hai má dao, thêm các nét gãy khúc (thanh liên động cơ
 * khí) nối lưỡi dao tiếp địa với lưỡi dao cách ly. Nhìn rối và khác hẳn các trạm
 * dùng block (E6.3, E6.5...).
 *
 * Script vẽ lại mỗi cụm đó theo đúng kiểu các trạm dùng block (E6.5):
 *   - dao cách ly: ký hiệu block DCL (vạch chéo trên đường dây) đặt giữa khe hở cũ,
 *     đường dây nối liền qua dao;
 *   - dao tiếp địa: nhánh ngang tách khỏi đường dây, cách dao cách ly một quãng về
 *     đúng phía như bản gốc (phía đường dây / phía thanh cái), ký hiệu đất ở ngoài
 *     cùng, giữ nguyên phía đặt (trái/phải) và trạng thái;
 *   - bỏ lưỡi dao chéo, tiếp điểm tĩnh và các nét liên động cũ;
 *   - nhãn dao tiếp địa (…-14, -15, -75, -76...) dời theo, đặt ngay đầu ký hiệu đất.
 *
 * Cỡ ký hiệu lấy theo cỡ chữ nhãn của chính ngăn lộ (mỗi trạm vẽ tay một tỷ lệ),
 * đúng tỷ lệ như E6.5 (chữ cao 7,2): DCL = 1,56 lần, dao tiếp địa = 6,2 lần cỡ chữ,
 * dao tiếp địa cách tâm DCL 2,7 lần cỡ chữ (co lại nếu sát thiết bị khác / thanh cái).
 *
 * Chạy lại bao nhiêu lần cũng được: cụm đã chuẩn hoá thì dao tiếp địa không còn
 * đè lên đường dây nên không bị xử lý nữa.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const duongDan = resolve(process.argv[2] ?? 'src/data/tram-sld.json');
const data = JSON.parse(readFileSync(duongDan, 'utf8'));
const s = data.sheets.find((x) => x.code === 'TONG');
const B = (ten) => data.blocks.indexOf(ten);
const iDTD = B('DTD');
const iDCL = B('DCL');
const iDong = data.states.indexOf('dong');
const iRight = data.aligns.indexOf('right');
const iLeft = data.aligns.indexOf('left');
const CAP = new Set([110, 35]);

/* Hình học block DTD (đã chuẩn hoá trong src/symbols/blocks.ts): trục +Y cục bộ,
 * đầu nối vào đường dây ở y = +0,52, ký hiệu đất ở y = -0,52, bề ngang ±0,136. */
const DTD_DAU = 0.52;
const DTD_NUA_RONG = 0.136;
/* Tỷ lệ theo E6.5 (tính theo cỡ máy cắt của ngăn lộ) */
const K_DCL = 1.56;
const K_DTD = 6.2;
const K_CACH = 2.7;

const rad = (a) => (a * Math.PI) / 180;
const deg = (a) => (a * 180) / Math.PI;
const tram = (x, y) => s.st.find((r) => r.length >= 8 && x >= r[4] && x <= r[6] && y >= r[5] && y <= r[7])?.[0] ?? '?';

/* ---------- đoạn thẳng của tất cả tuyến ---------- */
function doanCua(i) {
  const r = s.b[i];
  const o = [];
  for (let k = 4; k + 3 < r.length; k += 2) o.push({ i, k, a: [r[k], r[k + 1]], b: [r[k + 2], r[k + 3]] });
  return o;
}
let doan = s.b.flatMap((_, i) => doanCua(i));

/** Trục +Y cục bộ của dao tiếp địa trong hệ toạ độ bản vẽ. */
const trucDTD = (rot) => [-Math.sin(rad(rot)), Math.cos(rad(rot))];

/** Tổng chiều dài các đoạn cùng cấp nằm trên đường thẳng qua g, trong cửa sổ ±W quanh P. */
function phuTruc(g, kv, P, W) {
  const dx = g.b[0] - g.a[0];
  const dy = g.b[1] - g.a[1];
  const L = Math.hypot(dx, dy);
  const a = [dx / L, dy / L];
  let tong = 0;
  for (const q of doan) {
    if (s.b[q.i][1] !== kv) continue;
    const na = (q.a[0] - P[0]) * -a[1] + (q.a[1] - P[1]) * a[0];
    const nb = (q.b[0] - P[0]) * -a[1] + (q.b[1] - P[1]) * a[0];
    if (Math.abs(na) > 0.6 || Math.abs(nb) > 0.6) continue;
    let s0 = (q.a[0] - P[0]) * a[0] + (q.a[1] - P[1]) * a[1];
    let s1 = (q.b[0] - P[0]) * a[0] + (q.b[1] - P[1]) * a[1];
    if (s0 > s1) [s0, s1] = [s1, s0];
    tong += Math.max(0, Math.min(s1, W) - Math.max(s0, -W));
  }
  return tong;
}

/**
 * Tìm đường dây (trục ngăn lộ) mà dao tiếp địa nằm đè lên: trả về { t, g }
 * (t: khoảng cách dọc trục +Y của dao tới đường dây). Trong vùng liên động có cả
 * các nét gãy khúc song song với ngăn lộ, nên chọn đường thẳng có nhiều nét nằm
 * trên nó nhất (đường dây thật dài hơn hẳn), không chọn đường gần nhất.
 */
function duongDayCat(r) {
  const [x, y, rot, sc] = [r[3], r[4], r[5], r[6]];
  const [ux, uy] = trucDTD(rot);
  let tot = null;
  for (const g of doan) {
    if (s.b[g.i][1] !== r[1]) continue;
    const dx = g.b[0] - g.a[0];
    const dy = g.b[1] - g.a[1];
    const L = Math.hypot(dx, dy);
    if (L < 1e-6 || Math.abs((dx * ux + dy * uy) / L) > 0.1) continue;
    const den = ux * dy - uy * dx;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((g.a[0] - x) * dy - (g.a[1] - y) * dx) / den;
    // chỉ xét đường dây mà dao nằm ĐÈ lên (đường dây ngăn bên cạnh dài hơn nhưng ở xa)
    if (Math.abs(t) > sc * 0.35) continue;
    const P = [x + t * ux, y + t * uy];
    const phu = phuTruc(g, r[1], P, sc * 3);
    if (phu < sc) continue; // mẩu dây ngắn, không phải đường dây ngăn lộ
    if (!tot || phu > tot.phu + 0.5 || (Math.abs(phu - tot.phu) <= 0.5 && Math.abs(t) < Math.abs(tot.t))) tot = { t, g, phu };
  }
  return tot;
}

/* ---------- 1. Dò các dao tiếp địa kiểu liên động ---------- */
const lienDong = [];
s.d.forEach((r, i) => {
  if (r[2] !== iDTD || !CAP.has(r[1])) return;
  const c = duongDayCat(r);
  if (!c || Math.abs(c.t / r[6]) >= 0.3) return;
  lienDong.push({ i, r, ...c });
});

/* ---------- 2. Ghép theo khe hở dao cách ly trên trục ngăn lộ ---------- */
const cum = new Map();
const khongGhep = [];
for (const L of lienDong) {
  const { r, g, t } = L;
  const sc = r[6];
  const [ux, uy] = trucDTD(r[5]);
  let P0 = [r[3] + t * ux, r[4] + t * uy];
  const len = Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]);
  let a = [(g.b[0] - g.a[0]) / len, (g.b[1] - g.a[1]) / len];
  // hướng trục chuẩn: đi lên (dọc) hoặc sang phải (ngang)
  if (a[1] < -1e-9 || (Math.abs(a[1]) < 1e-9 && a[0] < 0)) a = [-a[0], -a[1]];
  const n = [-a[1], a[0]];
  const doc = (p) => (p[0] - P0[0]) * a[0] + (p[1] - P0[1]) * a[1];
  const ngang = (p) => (p[0] - P0[0]) * n[0] + (p[1] - P0[1]) * n[1];
  const W = sc * 3;
  // Bản vẽ tay có đoạn lệch nhau vài phần mười đơn vị: đặt trục đúng vào đường
  // dây chính (trung bình theo chiều dài các đoạn nằm trên trục)
  {
    let tong = 0;
    let lech = 0;
    for (const q of doan) {
      if (s.b[q.i][1] !== r[1] || Math.abs(ngang(q.a)) > 0.6 || Math.abs(ngang(q.b)) > 0.6) continue;
      if (Math.max(Math.abs(doc(q.a)), Math.abs(doc(q.b))) > W * 2) continue;
      const l = Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1]);
      tong += l;
      lech += l * (ngang(q.a) + ngang(q.b)) / 2;
    }
    if (tong > 0) P0 = [P0[0] + n[0] * (lech / tong), P0[1] + n[1] * (lech / tong)];
  }
  // Các đoạn nằm TRÊN trục ngăn lộ (cùng cấp điện áp)
  const phu = [];
  for (const q of doan) {
    if (s.b[q.i][1] !== r[1]) continue;
    if (Math.abs(ngang(q.a)) > 0.6 || Math.abs(ngang(q.b)) > 0.6) continue;
    let s0 = doc(q.a);
    let s1 = doc(q.b);
    if (s0 > s1) [s0, s1] = [s1, s0];
    if (s1 < -W || s0 > W || s1 - s0 < 1e-6) continue;
    phu.push([s0, s1]);
  }
  phu.sort((x, y) => x[0] - y[0]);
  const khe = [];
  let cuoi = -W;
  for (const [s0, s1] of phu) {
    if (s0 > cuoi + 0.05) khe.push([cuoi, s0]);
    cuoi = Math.max(cuoi, s1);
  }
  if (cuoi < W) khe.push([cuoi, W]);
  // Khe gần nhất; bỏ khe chứa thiết bị khác (máy cắt, TI...) và khe chạm biên cửa sổ
  let tot = null;
  for (const [k0, k1] of khe) {
    if (k0 <= -W + 1e-6 || k1 >= W - 1e-6 || k1 - k0 < 0.15 * sc) continue;
    const kc = k0 > 0 ? k0 : k1 < 0 ? -k1 : 0;
    if (kc > 1.2 * sc) continue;
    const coThietBiKhac = s.d.some(
      (d) => d[2] !== iDCL && d[2] !== iDTD && Math.abs(ngang([d[3], d[4]])) < 0.5 && doc([d[3], d[4]]) > k0 && doc([d[3], d[4]]) < k1,
    );
    if (coThietBiKhac) continue;
    // Khe dao cách ly nằm GIỮA đường dây: hai phía khe đều có dây liền. Đầu cụt của
    // nhánh rẽ (dao tiếp địa ngăn tủ hợp bộ 35kV) chỉ có dây một phía -> không phải.
    const phuDoan = (x0, x1) => phu.reduce((t, [p0, p1]) => t + Math.max(0, Math.min(p1, x1) - Math.max(p0, x0)), 0);
    if (phuDoan(k0 - sc, k0) < 0.4 * sc || phuDoan(k1, k1 + sc) < 0.4 * sc) continue;
    // Phải có dấu hiệu dao cách ly trong khe: block DCL, hoặc lưỡi dao chéo (nét
    // xiên 15-75 độ so với trục) mọc ra từ một má khe.
    const coDCL = s.d.some(
      (d) => d[2] === iDCL && d[1] === r[1] && Math.abs(ngang([d[3], d[4]])) < 0.4 * sc && doc([d[3], d[4]]) > k0 - 1 && doc([d[3], d[4]]) < k1 + 1,
    );
    const coLuoi = doan.some((q) => {
      if (s.b[q.i][1] !== r[1]) return false;
      const l = Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1]);
      if (l < 0.15 * (k1 - k0)) return false;
      const cos = Math.abs(((q.b[0] - q.a[0]) * a[0] + (q.b[1] - q.a[1]) * a[1]) / l);
      if (cos > Math.cos(rad(15)) || cos < Math.cos(rad(75))) return false;
      return [q.a, q.b].some((p) => Math.abs(ngang(p)) < 0.6 && (Math.abs(doc(p) - k0) < 0.6 || Math.abs(doc(p) - k1) < 0.6));
    });
    if (!coDCL && !coLuoi) continue;
    if (!tot || kc < tot.kc) tot = { kc, k0, k1 };
  }
  if (!tot) {
    khongGhep.push(`${tram(r[3], r[4])} DTD (${r[3].toFixed(1)}, ${r[4].toFixed(1)})`);
    continue;
  }
  // Hai má khe lấy đúng đầu mút đường dây thật (hai nửa có thể lệch nhau chút ít)
  const dauMut = (k) => {
    let tot2 = null;
    for (const q of doan) {
      if (s.b[q.i][1] !== r[1]) continue;
      for (const p of [q.a, q.b]) {
        if (Math.abs(ngang(p)) > 0.6) continue;
        const dd = Math.abs(doc(p) - k);
        if (dd < 0.3 && (!tot2 || dd < tot2.dd)) tot2 = { dd, p };
      }
    }
    return tot2 ? [...tot2.p] : [P0[0] + a[0] * k, P0[1] + a[1] * k];
  };
  const g0 = dauMut(tot.k0);
  const g1 = dauMut(tot.k1);
  // Cùng một khe (hai dao tiếp địa hai bên dao cách ly) -> cùng một cụm
  const giua = [(g0[0] + g1[0]) / 2, (g0[1] + g1[1]) / 2];
  let C = [...cum.values()].find((c) => c.kv === r[1] && Math.hypot(c.giua[0] - giua[0], c.giua[1] - giua[1]) < 1.5);
  if (!C) {
    C = { kv: r[1], a, n, g0, g1, giua, trucSeg: g, dtd: [] };
    cum.set(cum.size, C);
  }
  C.dtd.push(L);
}

const nhanDaDung = new Set();
const laNhanDTD = (txt) => /-\s*\d\d[A-Z]?$/i.test(String(txt).trim());
/** Số hiệu ngăn lộ đứng trước dấu gạch của nhãn ("171-76" -> "171"), không có thì "". */
const soNgan = (txt) => String(txt).trim().match(/^(\d{3})\s*-/)?.[1] ?? '';

// Nhãn của từng dao tiếp địa (…-14, -15, -75, -76...): nhãn gần dao cũ nhất
for (const C of cum.values()) {
  for (const L of C.dtd) {
    let tot = null;
    s.t.forEach((t, k) => {
      if (nhanDaDung.has(k) || !laNhanDTD(t[8])) return;
      const dd = Math.hypot(t[2] - L.r[3], t[3] - L.r[4]);
      if (dd > Math.max(3 * L.r[6], 45)) return;
      if (!tot || dd < tot.dd) tot = { k, dd };
    });
    if (tot) {
      nhanDaDung.add(tot.k);
      L.nhan = tot.k;
    }
  }
}

/* ---------- 2b. Dao tiếp địa vẽ bằng NÉT RỜI (E26.3 Nà Phặc...) ----------
 * Có trạm vẽ dao tiếp địa bằng các đoạn thẳng rời (cần, lưỡi dao, vạch đất), bộ
 * nhận dạng chỉ bắt được dao cách ly (trạng thái mở), có khi còn bắt nhầm lưỡi dao
 * tiếp địa thành dao cách ly. Khi đó lấy dao cách ly mở làm mốc: khe hở trên đường
 * dây là dao cách ly, còn các dao tiếp địa lấy theo NHÃN (…-76, -75, -15...) quanh
 * nó: nhãn nằm phía nào của dao cách ly (dọc trục) và phía nào của đường dây thì
 * dao tiếp địa đặt về phía đó.
 */
const iMo = data.states.indexOf('mo');
const cumNet = [];
s.d.forEach((r, iD) => {
  if (r[2] !== iDCL || !CAP.has(r[1]) || r[7] !== iMo) return;
  const sc = r[6];
  // góc vẽ tay lệch 1-2 độ: bắt về phương đứng / ngang
  let goc = r[5];
  const g90 = Math.round(goc / 90) * 90;
  if (Math.abs(goc - g90) < 3) goc = g90;
  let a = [Math.cos(rad(goc)), Math.sin(rad(goc))];
  if (a[1] < -1e-9 || (Math.abs(a[1]) < 1e-9 && a[0] < 0)) a = [-a[0], -a[1]];
  const n = [-a[1], a[0]];
  let P0 = [r[3], r[4]];
  const doc = (p) => (p[0] - P0[0]) * a[0] + (p[1] - P0[1]) * a[1];
  const ngang = (p) => (p[0] - P0[0]) * n[0] + (p[1] - P0[1]) * n[1];
  const W = sc * 3;
  const trenTruc = (q) => s.b[q.i][1] === r[1] && Math.abs(ngang(q.a)) <= 1 && Math.abs(ngang(q.b)) <= 1 && Math.max(Math.abs(doc(q.a)), Math.abs(doc(q.b))) <= W * 2;
  let tong = 0;
  let lech = 0;
  let seg = null;
  for (const q of doan) {
    if (!trenTruc(q)) continue;
    const l = Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1]);
    if (Math.abs(((q.b[0] - q.a[0]) * a[0] + (q.b[1] - q.a[1]) * a[1]) / (l || 1)) < 0.99) continue;
    tong += l;
    lech += (l * (ngang(q.a) + ngang(q.b))) / 2;
    if (!seg || l > seg.l) seg = { ...q, l };
  }
  if (!seg) return;
  P0 = [P0[0] + n[0] * (lech / tong), P0[1] + n[1] * (lech / tong)];
  const phu = [];
  for (const q of doan) {
    if (s.b[q.i][1] !== r[1] || Math.abs(ngang(q.a)) > 0.6 || Math.abs(ngang(q.b)) > 0.6) continue;
    let s0 = doc(q.a);
    let s1 = doc(q.b);
    if (s0 > s1) [s0, s1] = [s1, s0];
    if (s1 < -W || s0 > W || s1 - s0 < 1e-6) continue;
    phu.push([s0, s1]);
  }
  phu.sort((x, y) => x[0] - y[0]);
  let cuoi = -W;
  let khe = null;
  for (const [s0, s1] of phu) {
    if (s0 > cuoi + 0.05 && cuoi <= 0.6 * sc && s0 >= -0.6 * sc) khe = khe ?? [cuoi, s0];
    cuoi = Math.max(cuoi, s1);
  }
  if (!khe || khe[0] <= -W + 1e-6) return;
  const phuDoan = (x0, x1) => phu.reduce((t, [p0, p1]) => t + Math.max(0, Math.min(p1, x1) - Math.max(p0, x0)), 0);
  if (phuDoan(khe[0] - sc, khe[0]) < 0.4 * sc || phuDoan(khe[1], khe[1] + sc) < 0.4 * sc) return;
  const g0 = [P0[0] + a[0] * khe[0], P0[1] + a[1] * khe[0]];
  const g1 = [P0[0] + a[0] * khe[1], P0[1] + a[1] * khe[1]];
  const giua = [(g0[0] + g1[0]) / 2, (g0[1] + g1[1]) / 2];
  // đã có cụm (lượt 1 hoặc dao cách ly khác cùng khe)
  if ([...cum.values(), ...cumNet].some((c) => c.kv === r[1] && Math.hypot(c.giua[0] - giua[0], c.giua[1] - giua[1]) < 1.5)) return;
  // nhãn dao cách ly gần nhất -> số hiệu ngăn lộ
  const R = 3 * sc;
  const kc = (t) => Math.hypot(t[2] - giua[0], t[3] - giua[1]);
  let nhanDCL = null;
  for (const t of s.t) {
    if (!/^\d{3}\s*-\s*\d(\/\d)?$/.test(String(t[8]).trim()) || kc(t) > R) continue;
    if (!nhanDCL || kc(t) < kc(nhanDCL)) nhanDCL = t;
  }
  // phải có nhãn dao cách ly dạng 171-7, 112-1... (dao phụ tải tủ RMU 35kV không phải)
  if (!nhanDCL) return;
  const ngan = soNgan(nhanDCL[8]);
  const dtd = [];
  s.t.forEach((t, k) => {
    if (nhanDaDung.has(k) || !laNhanDTD(t[8]) || kc(t) > R) return;
    if (ngan && soNgan(t[8]) && soNgan(t[8]) !== ngan) return;
    // nhãn nằm hẳn một bên đường dây (không nằm trên trục)
    const p = [t[2] + (t[6] === iRight ? -1 : t[6] === iLeft ? 1 : 0) * t[4] * 1.2, t[3] + t[4] * 0.4];
    if (Math.abs(ngang(p)) < 0.5 * t[4]) return;
    // quanh nhãn phải có ký hiệu đất vẽ nét rời: vài vạch ngắn song song trục ngăn lộ
    const vach = doan.filter((q) => {
      if (s.b[q.i][1] !== r[1]) return false;
      const l = Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1]);
      if (l < 1e-6 || l > 0.6 * sc) return false;
      if (Math.abs(((q.b[0] - q.a[0]) * a[0] + (q.b[1] - q.a[1]) * a[1]) / l) < 0.95) return false;
      const m = [(q.a[0] + q.b[0]) / 2, (q.a[1] + q.b[1]) / 2];
      return Math.abs(ngang(m)) > 0.3 * sc && Math.hypot(m[0] - p[0], m[1] - p[1]) < 1.8 * sc;
    });
    if (vach.length < 2) return;
    dtd.push({ nhan: k, net: true, x: doc(p) - (khe[0] + khe[1]) / 2, phiaDatNet: Math.sign(ngang(p)) });
  });
  if (!dtd.length) return;
  for (const L of dtd) nhanDaDung.add(L.nhan);
  cumNet.push({ kv: r[1], a, n, g0, g1, giua, trucSeg: seg, dtd, sc, mau: r });
});

/* ---------- 2c. Dao cách ly vẽ bằng MỘT NÉT CHÉO vắt qua đường dây liền ----------
 * (371-7/1, 371-7/2 E26.3 Nà Phặc; 371-7/1 E26.2 Chợ Đồn): đường dây vẽ liền, lưỡi
 * dao là một nét xiên dài cắt ngang. Nhận ra nhờ nhãn dao cách ly (371-7/1...) ngay
 * cạnh; đổi thành vạch DCL trên đường dây như các dao khác.
 */
const cheo = [];
for (const q of doan) {
  const kv = s.b[q.i][1];
  if (!CAP.has(kv) || s.b[q.i].length !== 8) continue;
  const dx = q.b[0] - q.a[0];
  const dy = q.b[1] - q.a[1];
  const l = Math.hypot(dx, dy);
  const goc = Math.abs(deg(Math.atan2(dy, dx))) % 90;
  if (l < 5 || goc < 20 || goc > 70) continue;
  const m = [(q.a[0] + q.b[0]) / 2, (q.a[1] + q.b[1]) / 2];
  const cat = doan.find((g) => {
    if (g === q || s.b[g.i][1] !== kv) return false;
    const doc0 = Math.abs(g.a[0] - g.b[0]) < 0.3;
    const ngang0 = Math.abs(g.a[1] - g.b[1]) < 0.3;
    if (doc0) return Math.abs(g.a[0] - m[0]) < 0.15 * l && Math.min(g.a[1], g.b[1]) < m[1] - 0.3 * l && Math.max(g.a[1], g.b[1]) > m[1] + 0.3 * l;
    if (ngang0) return Math.abs(g.a[1] - m[1]) < 0.15 * l && Math.min(g.a[0], g.b[0]) < m[0] - 0.3 * l && Math.max(g.a[0], g.b[0]) > m[0] + 0.3 * l;
    return false;
  });
  if (!cat) continue;
  const nhan = s.t.filter((t) => /^\d{3}\s*-\s*\d(\/\d)?$/.test(String(t[8]).trim()) && Math.hypot(t[2] - m[0], t[3] - m[1]) < 2 * l);
  if (!nhan.length) continue;
  const doc0 = Math.abs(cat.a[0] - cat.b[0]) < 0.3;
  const tam = doc0 ? [cat.a[0], m[1]] : [m[0], cat.a[1]];
  cheo.push({ q, cat, tam, doc0, h: nhan[0][4], kv });
}

/* ---------- 3. Vẽ lại từng cụm ---------- */
const boD = new Set();
const boB = new Map(); // chỉ số tuyến -> tập đỉnh bị bỏ
const themB = [];
const dem = { cum: 0, dcl: 0, dtd: 0, nhan: 0, net: 0 };

/* Hai lượt: lượt 1 chỉ đánh dấu nét / thiết bị cũ sẽ bỏ của MỌI cụm, lượt 2 mới đặt ký
 * hiệu mới - để khi dò vật cản không vướng nét cũ của cụm bên cạnh. */
const biBo = (q) => {
  const t = boB.get(q.i);
  return !!t && (t.has((q.k - 4) / 2) || t.has((q.k - 2) / 2));
};
for (const luot of [1, 2])
for (const C of [...cum.values(), ...cumNet]) {
  const { a, n, g0, g1, kv } = C;
  const M = [(g0[0] + g1[0]) / 2, (g0[1] + g1[1]) / 2];
  const doc = (p) => (p[0] - M[0]) * a[0] + (p[1] - M[1]) * a[1];
  const ngang = (p) => (p[0] - M[0]) * n[0] + (p[1] - M[1]) * n[1];
  const scGoc = C.sc ?? Math.max(...C.dtd.map((L) => L.r[6]));
  // Cỡ ký hiệu theo cỡ chữ nhãn của chính ngăn lộ (bản vẽ tay mỗi trạm một tỷ lệ)
  const cao = C.dtd.filter((L) => L.nhan !== undefined).map((L) => s.t[L.nhan][4]).sort((x, y) => x - y);
  const h = cao.length ? cao[cao.length >> 1] : scGoc / 4.4;
  const u = h;
  const S = K_DTD * u;

  // Khoảng trống dọc trục về mỗi phía (tới thiết bị khác / thanh cái / chỗ rẽ nhánh)
  const vatCan = [];
  for (const d of s.d) {
    if (d[2] === iDTD || d[2] === iDCL) continue;
    if (Math.abs(ngang([d[3], d[4]])) < 2) vatCan.push(doc([d[3], d[4]]));
  }
  for (const q of doan) {
    // đoạn cắt ngang trục (thanh cái, nhánh rẽ) ngoài vùng khe
    const na = ngang(q.a);
    const nb = ngang(q.b);
    if (Math.abs(na) < 0.6 && Math.abs(nb) < 0.6) continue;
    if (na * nb > 0 && Math.min(Math.abs(na), Math.abs(nb)) > 0.6) continue;
    const dA = doc(q.a);
    const dB = doc(q.b);
    if (Math.abs(dA - dB) > 1) continue; // chỉ đoạn vuông góc trục
    const x = (dA + dB) / 2;
    if (Math.abs(x) < Math.abs(doc(g0)) + 0.3) continue;
    // bỏ nét của chính cụm liên động (sẽ xoá)
    if (Math.abs(x) < scGoc * 1.3 && Math.max(Math.abs(na), Math.abs(nb)) < scGoc * 1.2) continue;
    vatCan.push(x);
  }
  const trong = (dau) => {
    let m = Infinity;
    for (const x of vatCan) if (x * dau > 0) m = Math.min(m, Math.abs(x));
    return m;
  };
  const cachChuan = K_CACH * u;
  const nuaKhe = Math.abs(doc(g1));

  // Phía dọc trục của từng dao tiếp địa (giữ đúng thứ tự như bản gốc)
  const ds = C.dtd
    .map((L) => ({ L, x: L.net ? L.x : doc([L.r[3] + L.t * trucDTD(L.r[5])[0], L.r[4] + L.t * trucDTD(L.r[5])[1]]) }))
    .sort((p, q) => p.x - q.x);
  ds.forEach((p, k) => {
    p.dau = Math.abs(p.x) > 0.15 * nuaKhe ? Math.sign(p.x) : ds.length === 1 ? 1 : k === 0 ? -1 : 1;
  });

  // Vùng cụm cũ (để xoá lưỡi dao, tiếp điểm, nét liên động)
  let dMin = Math.min(doc(g0), doc(g1));
  let dMax = Math.max(doc(g0), doc(g1));
  let nMax = nuaKhe * 1.6 + 0.5;
  if (C.sc) {
    // dao tiếp địa nét rời: vùng quanh dao cách ly và các nhãn
    for (const L of C.dtd) {
      const t = s.t[L.nhan];
      dMin = Math.min(dMin, doc([t[2], t[3]]) - 0.3 * scGoc);
      dMax = Math.max(dMax, doc([t[2], t[3]]) + 0.3 * scGoc);
    }
    dMin = Math.max(dMin, -1.6 * scGoc);
    dMax = Math.min(dMax, 1.6 * scGoc);
    nMax = 1.6 * scGoc;
  }
  for (const L of C.dtd.filter((L) => !L.net)) {
    const [ux, uy] = trucDTD(L.r[5]);
    for (const k of [-DTD_DAU, DTD_DAU]) {
      const p = [L.r[3] + ux * k * L.r[6], L.r[4] + uy * k * L.r[6]];
      dMin = Math.min(dMin, doc(p) - DTD_NUA_RONG * L.r[6]);
      dMax = Math.max(dMax, doc(p) + DTD_NUA_RONG * L.r[6]);
      nMax = Math.max(nMax, Math.abs(ngang(p)) + 0.1 * L.r[6]);
    }
  }
  const trongVung = (p) => doc(p) >= dMin - 0.3 && doc(p) <= dMax + 0.3 && Math.abs(ngang(p)) <= nMax;

  // a) Bỏ block DCL cũ trong khe (cụm nét rời: bỏ luôn dao tiếp địa / lưỡi dao nhận nhầm trong vùng)
  if (C.sc)
    s.d.forEach((d, i) => {
      if ((d[2] === iDCL || d[2] === iDTD) && d[1] === kv && trongVung([d[3], d[4]])) boD.add(i);
    });
  s.d.forEach((d, i) => {
    if (d[2] !== iDCL || d[1] !== kv) return;
    if (Math.abs(ngang([d[3], d[4]])) < 0.4 * scGoc && doc([d[3], d[4]]) >= Math.min(doc(g0), doc(g1)) - 1 && doc([d[3], d[4]]) <= Math.max(doc(g0), doc(g1)) + 1)
      boD.add(i);
  });
  // b) Bỏ các nét lệch trục trong vùng cụm
  s.b.forEach((r, i) => {
    if (r[1] !== kv) return;
    const pts = [];
    for (let k = 4; k + 1 < r.length; k += 2) pts.push([r[k], r[k + 1]]);
    // nét vụn (tiếp điểm tĩnh, mẩu nét liên động) quanh cụm: bỏ cả khi hơi ra ngoài vùng
    let dai = 0;
    for (let k = 1; k < pts.length; k++) dai += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    const vun =
      dai < 0.15 * scGoc &&
      pts.some((p) => Math.abs(ngang(p)) > 0.6) &&
      pts.every((p) => doc(p) >= dMin - 0.5 * scGoc && doc(p) <= dMax + 0.5 * scGoc && Math.abs(ngang(p)) <= nMax * 1.5 + 1);
    const bo = pts.map((p) => vun || (trongVung(p) && Math.abs(ngang(p)) > 0.6));
    if (!bo.some(Boolean)) return;
    const tapBo = boB.get(i) ?? new Set();
    bo.forEach((x, k) => x && tapBo.add(k));
    boB.set(i, tapBo);
  });
  if (luot === 1) continue;
  // c) Nối liền đường dây qua khe
  const tg = s.b[C.trucSeg.i];
  themB.push([tg[0], tg[1], tg[2], tg[3], g0[0], g0[1], g1[0], g1[1]]);

  // d) Dao cách ly: block DCL đóng, vạch chéo trên đường dây
  let rotDCL = deg(Math.atan2(a[1], a[0]));
  if (rotDCL > 1e-6 && rotDCL < 180 - 1e-6) rotDCL -= 180;
  else if (Math.abs(rotDCL) < 1e-6) rotDCL = 180;
  const mau = C.mau ?? C.dtd[0].r;
  s.d.push([mau[0], kv, iDCL, +M[0].toFixed(2), +M[1].toFixed(2), Math.round(rotDCL * 100) / 100, +(K_DCL * u).toFixed(2), iDong, mau[8], 0]);
  dem.dcl++;

  // e) Dao tiếp địa: nhánh ngang về phía ký hiệu đất như bản gốc
  for (const p of ds) {
    const { i } = p.L;
    const r = p.L.r ?? [mau[0], kv, iDTD, 0, 0, 0, 0, iMo, mau[8]];
    let phiaDat = p.L.phiaDatNet;
    if (!p.L.net) {
      const [ux, uy] = trucDTD(r[5]);
      const dat = [r[3] - ux * DTD_DAU * r[6], r[4] - uy * DTD_DAU * r[6]];
      phiaDat = Math.sign(ngang(dat)) || -1;
    }
    const nn = [n[0] * phiaDat, n[1] * phiaDat];
    // khoảng cách dọc trục: chuẩn 1,75u, co lại nếu sát vật cản
    const cho = trong(p.dau) - DTD_NUA_RONG * S - 0.15 * u;
    const cach = Math.max(0.5 * K_DCL * u + DTD_NUA_RONG * S * 0.8, Math.min(cachChuan, cho));
    const A = [M[0] + a[0] * p.dau * cach, M[1] + a[1] * p.dau * cach];
    // Đường dây song song ngay phía đất (ngăn bên cạnh, thanh nối...) -> rút ngắn
    // dao tiếp địa cho ký hiệu đất không chạm sang, nhãn chuyển lên trên ký hiệu.
    let Si = S;
    const dA = doc(A);
    for (const q of doan) {
      if ((trongVung(q.a) && trongVung(q.b)) || biBo(q)) continue;
      const l = Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1]);
      if (l < 1e-6 || Math.abs(((q.b[0] - q.a[0]) * a[0] + (q.b[1] - q.a[1]) * a[1]) / l) < 0.95) continue;
      const D = ((q.a[0] - M[0]) * nn[0] + (q.a[1] - M[1]) * nn[1] + (q.b[0] - M[0]) * nn[0] + (q.b[1] - M[1]) * nn[1]) / 2;
      if (D < 1 || D > 2 * DTD_DAU * S + 0.5 * u) continue;
      const lo = Math.min(doc(q.a), doc(q.b));
      const hi = Math.max(doc(q.a), doc(q.b));
      if (hi < dA - DTD_NUA_RONG * S || lo > dA + DTD_NUA_RONG * S) continue;
      Si = Math.min(Si, (D - 0.5 * u) / (2 * DTD_DAU));
    }
    Si = Math.max(Si, 3 * u);
    const biRut = Si < S - 1e-6;
    const tam = [A[0] + nn[0] * DTD_DAU * Si, A[1] + nn[1] * DTD_DAU * Si];
    // +Y cục bộ hướng từ tâm vào đường dây (= -nn)
    const rot = deg(Math.atan2(nn[0], -nn[1]));
    // lưỡi dao (ngọn về -X cục bộ) chĩa lên trên (ngăn dọc) / sang phải (ngăn ngang)
    const ngon = [-Math.cos(rad(rot)), -Math.sin(rad(rot))];
    const doc0 = Math.abs(a[1]) > Math.abs(a[0]);
    const mir = (doc0 ? ngon[1] < 0 : ngon[0] < 0) ? 1 : 0;
    if (i !== undefined) boD.add(i);
    s.d.push([r[0], r[1], iDTD, +tam[0].toFixed(2), +tam[1].toFixed(2), Math.round(rot * 100) / 100, +Si.toFixed(2), r[7], r[8], mir]);
    dem.dtd++;

    // f) Nhãn dao tiếp địa dời theo, đặt ngay đầu ký hiệu đất
    if (p.L.nhan !== undefined) {
      const t = s.t[p.L.nhan];
      const h = t[4];
      const datMoi = [A[0] + nn[0] * (2 * DTD_DAU * Si), A[1] + nn[1] * (2 * DTD_DAU * Si)];
      const le = 0.2 * Si;
      if (biRut) {
        // không còn chỗ ở đầu ký hiệu đất: đặt nhãn phía ngoài ký hiệu (xa dao cách ly)
        const giua = [A[0] + nn[0] * DTD_DAU * Si * 1.3, A[1] + nn[1] * DTD_DAU * Si * 1.3];
        const ra = DTD_NUA_RONG * Si + 0.3 * h;
        const q = [giua[0] + a[0] * p.dau * ra, giua[1] + a[1] * p.dau * ra];
        t[2] = +q[0].toFixed(2);
        t[3] = +(doc0 ? (p.dau * a[1] > 0 ? q[1] : q[1] - h) : q[1] - h * 0.5).toFixed(2);
        t[6] = data.aligns.indexOf('center');
      } else if (doc0) {
        // đầu đất ở trái/phải -> nhãn cùng hàng, canh sát ký hiệu đất
        t[2] = +(datMoi[0] + (nn[0] < 0 ? -le : le)).toFixed(2);
        t[3] = +(datMoi[1] - h * 0.5).toFixed(2);
        t[6] = nn[0] < 0 ? iRight : iLeft;
      } else {
        t[2] = +datMoi[0].toFixed(2);
        t[3] = +(nn[1] < 0 ? datMoi[1] - le - h : datMoi[1] + le).toFixed(2);
        t[6] = data.aligns.indexOf('center');
      }
      t[5] = 0;
      dem.nhan++;
    }
  }
  dem.cum++;
}

for (const c of cheo) {
  const tapBo = boB.get(c.q.i) ?? new Set();
  tapBo.add(0).add(1);
  boB.set(c.q.i, tapBo);
  const tg = s.b[c.cat.i];
  s.d.push([tg[0], c.kv, iDCL, +c.tam[0].toFixed(2), +c.tam[1].toFixed(2), c.doc0 ? -90 : 180, +(K_DCL * c.h).toFixed(2), iDong, tg[3], 0]);
  dem.dcl++;
}

/* ---------- 3b. Dao tiếp địa tủ 35kV vẽ SONG SONG đường dây ----------
 * Ngăn tủ hợp bộ 35kV ở các trạm vẽ tay (E26.3, E26.2, E6.17, TU E6.8...) vẽ dao
 * tiếp địa dựng song song với đường dây ngăn lộ, nối vào bằng một cần ngang (có
 * khi gãy khúc). Đổi về cùng kiểu với dao tiếp địa 110kV: nhánh vuông góc tách ra
 * từ đúng chỗ cần nối vào đường dây, ký hiệu đất ở ngoài cùng, nhãn ở đầu ký hiệu đất.
 */
const iCenter = data.aligns.indexOf('center');
const tuyenCua = new Map(); // chỉ số tuyến -> điểm
s.b.forEach((r, i) => {
  const pts = [];
  for (let k = 4; k + 1 < r.length; k += 2) pts.push([r[k], r[k + 1]]);
  tuyenCua.set(i, pts);
});
const dtdTu = [];
s.d.forEach((r, iD) => {
  if (r[2] !== iDTD || r[1] !== 35 || boD.has(iD)) return;
  const [x, y, rot, sc] = [r[3], r[4], r[5], r[6]];
  const u = trucDTD(rot);
  const w = [-u[1], u[0]];
  const al = (p) => (p[0] - x) * u[0] + (p[1] - y) * u[1];
  const pe = (p) => (p[0] - x) * w[0] + (p[1] - y) * w[1];
  // tuyến nối vào dao: BẮT ĐẦU ở đầu tiếp điểm (phía +Y) của dao, đi ra đường dây
  for (const [i, pts] of tuyenCua) {
    if (s.b[i][1] !== 35 || boB.has(i) || pts.length < 2) continue;
    for (const dao of [false, true])
    // F: đỉnh đầu tiên của cần nối nằm trên đường dây ngăn lộ (phần sau F, nếu có, là
    // chính đường dây - giữ lại)
    for (let kF = 1; kF < pts.length; kF++) {
      const ds = (dao ? [...pts].reverse() : pts).slice(0, kF + 1);
      const E = ds[0];
      const F = ds[ds.length - 1];
      if (Math.abs(pe(E)) > 0.12 * sc || al(E) < 0.05 * sc || al(E) > 0.6 * sc) continue;
      let dai = 0;
      for (let k = 1; k < ds.length; k++) dai += Math.hypot(ds[k][0] - ds[k - 1][0], ds[k][1] - ds[k - 1][1]);
      if (dai > 2.5 * sc || Math.abs(pe(F)) < 0.3 * sc) continue;
      // cần nối chạy thẳng theo trục dao -> dao đã vuông góc đường dây (đúng kiểu)
      if (ds.every((p) => Math.abs(pe(p)) < 0.12 * sc)) continue;
      // đầu dao chạm thẳng vào một đường dây dài vuông góc trục -> đã đúng kiểu
      const chamDay = doan.some((q) => {
        if (q.i === i || s.b[q.i][1] !== 35) return false;
        const l = Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1]);
        if (l < sc || Math.abs(((q.b[0] - q.a[0]) * u[0] + (q.b[1] - q.a[1]) * u[1]) / l) > 0.1) return false;
        const t = Math.max(0, Math.min(1, ((E[0] - q.a[0]) * (q.b[0] - q.a[0]) + (E[1] - q.a[1]) * (q.b[1] - q.a[1])) / (l * l)));
        return Math.hypot(q.a[0] + t * (q.b[0] - q.a[0]) - E[0], q.a[1] + t * (q.b[1] - q.a[1]) - E[1]) < 0.3;
      });
      if (chamDay) continue;
      // cần nối là một đoạn của đường dây chạy XUYÊN qua đầu dao (dây còn đi tiếp ở phía
      // bên kia) -> dao nằm ngang đấu thẳng vào đường dây, đã đúng kiểu
      const h0 = [ds[1][0] - E[0], ds[1][1] - E[1]];
      const l0 = Math.hypot(h0[0], h0[1]) || 1;
      const v = [h0[0] / l0, h0[1] / l0];
      const diTiep = doan.some((q) => {
        if (q.i === i || s.b[q.i][1] !== 35) return false;
        const l = Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1]);
        if (l < 0.5 * sc || Math.abs(((q.b[0] - q.a[0]) * v[0] + (q.b[1] - q.a[1]) * v[1]) / l) < 0.99) return false;
        return [q.a, q.b].some((P) => {
          const t = (P[0] - E[0]) * v[0] + (P[1] - E[1]) * v[1];
          const n2 = (P[0] - E[0]) * -v[1] + (P[1] - E[1]) * v[0];
          return Math.abs(n2) < 0.5 && t <= 0.05 && t > -0.3 * sc;
        });
      });
      if (diTiep) continue;
      // F nằm GIỮA một đường dây song song trục dao (dây đi tiếp cả hai phía)
      let c1 = 0;
      let c2 = 0;
      let mau = null;
      for (const q of doan) {
        if (s.b[q.i][1] !== 35) continue;
        if (q.i === i) {
          // chỉ tính phần tuyến SAU F
          const kq = (q.k - 4) / 2;
          const vt = dao ? pts.length - 2 - kq : kq;
          if (vt < kF) continue;
        }
        const pa = (q.a[0] - F[0]) * w[0] + (q.a[1] - F[1]) * w[1];
        const pb = (q.b[0] - F[0]) * w[0] + (q.b[1] - F[1]) * w[1];
        if (Math.abs(pa) > 0.6 || Math.abs(pb) > 0.6) continue;
        const ta = (q.a[0] - F[0]) * u[0] + (q.a[1] - F[1]) * u[1];
        const tb = (q.b[0] - F[0]) * u[0] + (q.b[1] - F[1]) * u[1];
        const [t0, t1] = ta < tb ? [ta, tb] : [tb, ta];
        c1 += Math.max(0, t1 - Math.max(0, t0));
        c2 += Math.max(0, Math.min(0, t1) - t0);
        mau = mau ?? q;
      }
      if (c1 < 0.2 * sc || c2 < 0.2 * sc || c1 + c2 < 0.6 * sc) continue;
      if (process.env.XEM) console.log('tủ', tram(x, y), x, y, F);
      const bo = [];
      for (let k = 0; k < kF; k++) bo.push(dao ? pts.length - 1 - k : k);
      dtdTu.push({ iD, r, i, E, F, u, w, sc, mau, bo });
      return;
    }
  }
});
for (const T of dtdTu) {
  const { iD, r, i, F, u, sc } = T;
  // hướng nhánh: vuông góc đường dây, về phía dao cũ
  const phia = Math.sign((r[3] - F[0]) * T.w[0] + (r[4] - F[1]) * T.w[1]) || 1;
  const nn = [T.w[0] * phia, T.w[1] * phia];
  // nhãn gần dao cũ nhất
  let nhan = null;
  s.t.forEach((t, k) => {
    if (nhanDaDung.has(k) || !laNhanDTD(t[8])) return;
    const dd = Math.hypot(t[2] - r[3], t[3] - r[4]);
    if (dd > Math.max(3 * sc, 45)) return;
    if (!nhan || dd < nhan.dd) nhan = { k, dd };
  });
  if (nhan) nhanDaDung.add(nhan.k);
  const h = nhan ? s.t[nhan.k][4] : sc / 3.6;
  let Si = K_DTD * h;
  // đường dây song song phía đất (ngăn bên cạnh) -> rút ngắn
  for (const q of doan) {
    if (q.i === i) continue;
    const l = Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1]);
    if (l < 1e-6 || Math.abs(((q.b[0] - q.a[0]) * u[0] + (q.b[1] - q.a[1]) * u[1]) / l) < 0.95) continue;
    const D = ((q.a[0] + q.b[0]) / 2 - F[0]) * nn[0] + ((q.a[1] + q.b[1]) / 2 - F[1]) * nn[1];
    if (D < 1 || D > 2 * DTD_DAU * Si + 0.5 * h) continue;
    const ta = (q.a[0] - F[0]) * u[0] + (q.a[1] - F[1]) * u[1];
    const tb = (q.b[0] - F[0]) * u[0] + (q.b[1] - F[1]) * u[1];
    if (Math.max(ta, tb) < -DTD_NUA_RONG * Si || Math.min(ta, tb) > DTD_NUA_RONG * Si) continue;
    // chừa khoảng hở ~1,5 lần cỡ chữ trước đường dây bên cạnh
    Si = Math.min(Si, (D - 1.5 * h) / (2 * DTD_DAU));
  }
  Si = Math.max(Si, 3 * h);
  const biRut = Si < K_DTD * h - 1e-6;
  const tam = [F[0] + nn[0] * DTD_DAU * Si, F[1] + nn[1] * DTD_DAU * Si];
  const rotMoi = deg(Math.atan2(nn[0], -nn[1]));
  const ngon = [-Math.cos(rad(rotMoi)), -Math.sin(rad(rotMoi))];
  const doc0 = Math.abs(u[1]) > Math.abs(u[0]);
  const mir = (doc0 ? ngon[1] < 0 : ngon[0] < 0) ? 1 : 0;
  // bỏ dao cũ, cần nối, và các mẩu tiếp điểm quanh dao cũ
  boD.add(iD);
  boB.set(i, new Set(T.bo));
  for (const [j, pts] of tuyenCua) {
    if (j === i || s.b[j][1] !== 35) continue;
    let dai = 0;
    for (let k = 1; k < pts.length; k++) dai += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    // mẩu tiếp điểm nằm ngay trên trục dao cũ (không đụng ký hiệu tủ trên đường dây bên cạnh)
    const peCu = (p) => Math.abs((p[0] - r[3]) * T.w[0] + (p[1] - r[4]) * T.w[1]);
    if (dai < 0.5 * sc && pts.every((p) => Math.hypot(p[0] - r[3], p[1] - r[4]) < 0.7 * sc && peCu(p) < 0.25 * sc))
      boB.set(j, new Set(pts.map((_, k) => k)));
  }
  s.d.push([r[0], r[1], iDTD, +tam[0].toFixed(2), +tam[1].toFixed(2), Math.round(rotMoi * 100) / 100, +Si.toFixed(2), r[7], r[8], mir]);
  dem.tu = (dem.tu ?? 0) + 1;
  if (nhan) {
    const t = s.t[nhan.k];
    const dat = [F[0] + nn[0] * 2 * DTD_DAU * Si, F[1] + nn[1] * 2 * DTD_DAU * Si];
    const le = 0.2 * Si;
    if (biRut) {
      // không đủ chỗ ở đầu ký hiệu đất (ngăn tủ sát nhau): nhãn ngay dưới ký hiệu
      const ra = DTD_NUA_RONG * Si + 0.4 * t[4];
      if (doc0) {
        t[2] = +tam[0].toFixed(2);
        t[3] = +(tam[1] - ra - t[4] * 0.8).toFixed(2);
        t[6] = iCenter;
      } else {
        t[2] = +(tam[0] + ra).toFixed(2);
        t[3] = +(tam[1] - t[4] * 0.5).toFixed(2);
        t[6] = iLeft;
      }
    } else if (doc0) {
      t[2] = +(dat[0] + (nn[0] < 0 ? -le : le)).toFixed(2);
      t[3] = +(dat[1] - t[4] * 0.5).toFixed(2);
      t[6] = nn[0] < 0 ? iRight : iLeft;
    } else {
      t[2] = +dat[0].toFixed(2);
      t[3] = +(nn[1] < 0 ? dat[1] - le - t[4] : dat[1] + le).toFixed(2);
      t[6] = iCenter;
    }
    t[5] = 0;
    dem.nhan++;
  }
}

/* ---------- 4. Ghi lại ---------- */
// Tuyến bị bỏ đỉnh: tách thành các đoạn liền còn lại
const moi = [];
s.b.forEach((r, i) => {
  const bo = boB.get(i);
  if (!bo) return void moi.push(r);
  const pts = [];
  for (let k = 4; k + 1 < r.length; k += 2) pts.push([r[k], r[k + 1]]);
  let chuoi = [];
  const xa = () => {
    if (chuoi.length >= 2) moi.push([r[0], r[1], r[2], r[3], ...chuoi.flat()]);
    chuoi = [];
  };
  pts.forEach((p, k) => {
    if (bo.has(k)) {
      dem.net++;
      xa();
    } else chuoi.push(p);
  });
  xa();
});
s.b = [...moi, ...themB];
s.d = s.d.filter((_, i) => !boD.has(i));

writeFileSync(duongDan, JSON.stringify(data));
const theoTram = {};
for (const C of [...cum.values(), ...cumNet]) {
  const k = `${tram(C.g0[0], C.g0[1])}@${C.kv}${C.sc ? ' (nét rời)' : ''}`;
  theoTram[k] = (theoTram[k] ?? 0) + 1;
}
console.log(
  `Chuẩn hoá ${dem.cum} cụm DCL liên động: ${dem.dcl} DCL, ${dem.dtd} dao tiếp địa, ${dem.nhan} nhãn, bỏ ${dem.net} đỉnh nét lưỡi dao / liên động`,
);
for (const c of cheo) {
  const k = `${tram(c.tam[0], c.tam[1])}@${c.kv} (nét chéo)`;
  theoTram[k] = (theoTram[k] ?? 0) + 1;
}
for (const T of dtdTu) {
  const k = `${tram(T.F[0], T.F[1])}@35 (dao tiếp địa tủ)`;
  theoTram[k] = (theoTram[k] ?? 0) + 1;
}
console.log('Theo trạm:', JSON.stringify(theoTram));
if (process.env.XEM) for (const C of [...cum.values(), ...cumNet]) console.log('cụm', tram(C.g0[0], C.g0[1]), C.kv, ((C.g0[0] + C.g1[0]) / 2).toFixed(1), ((C.g0[1] + C.g1[1]) / 2).toFixed(1), C.dtd.length);
if (process.env.XEM && khongGhep.length) console.log(`Không tìm được khe dao cách ly (${khongGhep.length}):`, khongGhep.join('; '));
