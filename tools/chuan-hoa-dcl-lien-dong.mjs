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

/* ---------- 3. Vẽ lại từng cụm ---------- */
const boD = new Set();
const boB = new Map(); // chỉ số tuyến -> tập đỉnh bị bỏ
const themB = [];
const dem = { cum: 0, dcl: 0, dtd: 0, nhan: 0, net: 0 };
const nhanDaDung = new Set();

const laNhanDTD = (txt) => /-\s*\d\d[A-Z]?$/i.test(String(txt).trim());

for (const C of cum.values()) {
  const { a, n, g0, g1, kv } = C;
  const M = [(g0[0] + g1[0]) / 2, (g0[1] + g1[1]) / 2];
  const doc = (p) => (p[0] - M[0]) * a[0] + (p[1] - M[1]) * a[1];
  const ngang = (p) => (p[0] - M[0]) * n[0] + (p[1] - M[1]) * n[1];
  const scGoc = Math.max(...C.dtd.map((L) => L.r[6]));

  // Nhãn của từng dao tiếp địa (…-14, -15, -75, -76...): nhãn gần dao cũ nhất
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
    .map((L) => ({ L, x: doc([L.r[3] + L.t * trucDTD(L.r[5])[0], L.r[4] + L.t * trucDTD(L.r[5])[1]]) }))
    .sort((p, q) => p.x - q.x);
  ds.forEach((p, k) => {
    p.dau = Math.abs(p.x) > 0.15 * nuaKhe ? Math.sign(p.x) : ds.length === 1 ? 1 : k === 0 ? -1 : 1;
  });

  // Vùng cụm cũ (để xoá lưỡi dao, tiếp điểm, nét liên động)
  let dMin = Math.min(doc(g0), doc(g1));
  let dMax = Math.max(doc(g0), doc(g1));
  let nMax = nuaKhe * 1.6 + 0.5;
  for (const L of C.dtd) {
    const [ux, uy] = trucDTD(L.r[5]);
    for (const k of [-DTD_DAU, DTD_DAU]) {
      const p = [L.r[3] + ux * k * L.r[6], L.r[4] + uy * k * L.r[6]];
      dMin = Math.min(dMin, doc(p) - DTD_NUA_RONG * L.r[6]);
      dMax = Math.max(dMax, doc(p) + DTD_NUA_RONG * L.r[6]);
      nMax = Math.max(nMax, Math.abs(ngang(p)) + 0.1 * L.r[6]);
    }
  }
  const trongVung = (p) => doc(p) >= dMin - 0.3 && doc(p) <= dMax + 0.3 && Math.abs(ngang(p)) <= nMax;

  // a) Bỏ block DCL cũ trong khe
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
  // c) Nối liền đường dây qua khe
  const tg = s.b[C.trucSeg.i];
  themB.push([tg[0], tg[1], tg[2], tg[3], g0[0], g0[1], g1[0], g1[1]]);

  // d) Dao cách ly: block DCL đóng, vạch chéo trên đường dây
  let rotDCL = deg(Math.atan2(a[1], a[0]));
  if (rotDCL > 1e-6 && rotDCL < 180 - 1e-6) rotDCL -= 180;
  else if (Math.abs(rotDCL) < 1e-6) rotDCL = 180;
  const mau = C.dtd[0].r;
  s.d.push([mau[0], kv, iDCL, +M[0].toFixed(2), +M[1].toFixed(2), Math.round(rotDCL * 100) / 100, +(K_DCL * u).toFixed(2), iDong, mau[8], 0]);
  dem.dcl++;

  // e) Dao tiếp địa: nhánh ngang về phía ký hiệu đất như bản gốc
  for (const p of ds) {
    const { r, i } = p.L;
    const [ux, uy] = trucDTD(r[5]);
    const dat = [r[3] - ux * DTD_DAU * r[6], r[4] - uy * DTD_DAU * r[6]];
    const phiaDat = Math.sign(ngang(dat)) || -1;
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
      if (trongVung(q.a) && trongVung(q.b)) continue;
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
    boD.add(i);
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
for (const C of cum.values()) {
  const k = `${tram(C.g0[0], C.g0[1])}@${C.kv}`;
  theoTram[k] = (theoTram[k] ?? 0) + 1;
}
console.log(
  `Chuẩn hoá ${dem.cum} cụm DCL liên động: ${dem.dcl} DCL, ${dem.dtd} dao tiếp địa, ${dem.nhan} nhãn, bỏ ${dem.net} đỉnh nét lưỡi dao / liên động`,
);
console.log('Theo trạm:', JSON.stringify(theoTram));
if (process.env.XEM) for (const C of cum.values()) console.log('cụm', tram(C.g0[0], C.g0[1]), C.kv, ((C.g0[0] + C.g1[0]) / 2).toFixed(1), ((C.g0[1] + C.g1[1]) / 2).toFixed(1), C.dtd.length);
if (khongGhep.length) console.log(`Không tìm được khe dao cách ly (${khongGhep.length}):`, khongGhep.join('; '));
