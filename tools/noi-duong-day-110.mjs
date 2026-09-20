/**
 * NỐI CÁC ĐƯỜNG DÂY 110kV GIỮA CÁC TRẠM TRÊN TỜ SƠ ĐỒ KẾT DÂY.
 *
 *     node tools/noi-duong-day-110.mjs [src/data/tram-sld.json]
 *
 * Bản CAD gốc vẽ 25 trạm rời nhau, mỗi ngăn lộ 110kV chỉ là một mũi tên cụt kèm
 * nhãn ghi nơi đến ("171 E6.22 ĐỊNH HÓA"). Script này căn cứ:
 *
 *   - chính các nhãn đó trên bản vẽ (do Phòng Điều độ ghi), và
 *   - sơ đồ "LƯỚI ĐIỆN 220KV-110KV KHU VỰC TỈNH THÁI NGUYÊN" của Phòng Điều độ
 *     (mã hiệu dây, chiều dài, số mạch),
 *
 * rồi vẽ đường dây nối hai đầu ngăn lộ lại với nhau.
 *
 * CÁCH ĐI DÂY CHO GỌN MẮT: mỗi đầu ngăn lộ đi thẳng ra ngoài trạm một đoạn ngắn,
 * rồi rẽ vào một "hành lang" nằm trong khoảng trống giữa các trạm, chạy song song
 * với trục toạ độ, cuối cùng rẽ vào đầu kia. Hành lang được chọn sao cho không cắt
 * qua ô của trạm nào khác; các tuyến dùng chung một hành lang thì tự lệch nhau một
 * khoảng để không đè lên nhau.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const duongDan = resolve(process.argv[2] ?? 'src/data/tram-sld.json');
const data = JSON.parse(readFileSync(duongDan, 'utf8'));
const to = data.sheets.find((s) => s.code === 'TONG');
if (!to) throw new Error('Không tìm thấy tờ sơ đồ tổng (TONG) trong dữ liệu.');

/* ------------------------------------------------------------------ */
/* 1. Đọc lại hình học cần dùng                                         */
/* ------------------------------------------------------------------ */

const hop = new Map(to.st.map((r) => [String(r[0]), { x0: r[4], y0: r[5], x1: r[6], y1: r[7] }]));

/** Trạm chứa điểm (x, y), nới rộng biên 80 đơn vị. */
function tram(x, y) {
  for (const [ma, b] of hop) {
    if (x >= b.x0 - 80 && x <= b.x1 + 80 && y >= b.y0 - 80 && y <= b.y1 + 80) return ma;
  }
  return null;
}

// Đếm số lần mỗi đỉnh xuất hiện -> đầu mút TỰ DO là đỉnh chỉ xuất hiện một lần
const dem = new Map();
const khoa = (x, y) => `${Math.round(x * 2)}|${Math.round(y * 2)}`;
for (const r of to.b) {
  for (let i = 4; i + 1 < r.length; i += 2) {
    const k = khoa(r[i], r[i + 1]);
    dem.set(k, (dem.get(k) ?? 0) + 1);
  }
}
/** Đầu mút tự do của tuyến 110kV: { p: [x,y], truoc: [x,y] }. */
const dauMut = [];
for (const r of to.b) {
  if (r[1] !== 110) continue;
  const n = (r.length - 4) / 2;
  if (n < 2) continue;
  const at = (i) => [r[4 + i * 2], r[5 + i * 2]];
  for (const [i, j] of [
    [0, 1],
    [n - 1, n - 2],
  ]) {
    const p = at(i);
    if ((dem.get(khoa(p[0], p[1])) ?? 0) === 1) dauMut.push({ p, truoc: at(j) });
  }
}

const chu = to.t.map((r) => ({ t: String(r[8]).trim(), x: r[2], y: r[3] }));
const nhanDich = chu.filter((c) => /^1\d\d\b/.test(c.t) && /[EA]\d+(\.\d+)?/.test(c.t));
// Ngăn lộ ĐƯỜNG DÂY 110kV: chữ số thứ hai là 7 hoặc 8 (13x là ngăn máy biến áp).
// Nhận cả dạng có hậu tố dao cách ly ("171-7") vì nhiều trạm chỉ ghi kiểu đó.
const nhanLo = chu
  .filter((c) => /^1[78]\d(-\d+)?$/.test(c.t))
  .map((c) => ({ ...c, t: c.t.slice(0, 3) }));

const cach = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Đầu mút tự do gần một điểm nhất. */
function mutGanNhat(x, y, max = 260) {
  let best = null;
  let bd = max;
  for (const m of dauMut) {
    const d = cach(m.p, [x, y]);
    if (d < bd) {
      bd = d;
      best = m;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* 2. Bảng đầu ngăn lộ 110kV                                            */
/* ------------------------------------------------------------------ */

/**
 * Khoá đầu ngăn lộ:
 *   "E6.2>E6.8#1"  - ngăn lộ ở E6.2 có nhãn ghi đi E6.8, cái thứ 1
 *   "E6.20#175"    - ngăn lộ số 175 của E6.20 (nhãn chỉ ghi số hiệu)
 */
const dauLo = new Map();

// (a) Theo nhãn ghi nơi đến
{
  const demTrung = new Map();
  for (const c of nhanDich) {
    const A = tram(c.x, c.y);
    const dest = /([EA]\d+(?:\.\d+)?)/.exec(c.t.replace(/^1\d\d\s*/, ''));
    if (!A || !dest) continue;
    const m = mutGanNhat(c.x, c.y);
    if (!m) continue;
    const goc = `${A}>${dest[1]}`;
    const n = (demTrung.get(goc) ?? 0) + 1;
    demTrung.set(goc, n);
    dauLo.set(`${goc}#${n}`, m);
    if (n === 1) dauLo.set(goc, m);
  }
}

// (b) Theo số hiệu ngăn lộ - dùng cho đầu kia của những tuyến chỉ ghi nhãn một đầu.
//     Đầu ngăn lộ nằm thành MỘT HÀNG ở mép trạm; chọn hàng có nhiều đầu mút nhất.
for (const [ma, b] of hop) {
  const trong = dauMut.filter(
    (m) => m.p[0] >= b.x0 - 80 && m.p[0] <= b.x1 + 80 && m.p[1] >= b.y0 - 80 && m.p[1] <= b.y1 + 80,
  );
  const kem = [];
  for (const m of trong) {
    let t = '';
    let bd = 150;
    for (const c of nhanLo) {
      const d = cach([c.x, c.y], m.p);
      if (d < bd) {
        bd = d;
        t = c.t;
      }
    }
    if (!t) continue;
    // Đầu ngăn lộ là đầu mút CHĨA RA XA tâm trạm
    const cx = (b.x0 + b.x1) / 2;
    const cy = (b.y0 + b.y1) / 2;
    const raNgoai =
      (m.p[0] - m.truoc[0]) * (m.p[0] - cx) + (m.p[1] - m.truoc[1]) * (m.p[1] - cy) > 0;
    if (raNgoai) kem.push({ m, t });
  }
  // hàng (theo y) có nhiều đầu mút nhất
  const theoY = new Map();
  for (const k of kem) {
    const y = Math.round(k.m.p[1] / 8) * 8;
    theoY.set(y, (theoY.get(y) ?? 0) + 1);
  }
  let yTot = null;
  let nTot = 0;
  for (const [y, n] of theoY) if (n > nTot) [yTot, nTot] = [y, n];
  if (yTot === null) continue;
  for (const k of kem) {
    if (Math.abs(k.m.p[1] - yTot) > 40) continue;
    const khoaLo = `${ma}#${k.t}`;
    if (!dauLo.has(khoaLo)) dauLo.set(khoaLo, k.m);
  }
}

/* ------------------------------------------------------------------ */
/* 3. Danh mục đường dây 110kV                                          */
/* ------------------------------------------------------------------ */

/** [đầu A, đầu B, mã hiệu dây, chiều dài km] */
const DUONG_DAY = [
  ['E6.19>E6.12', 'E6.12>E6.19', 'AC185+AC240', 10.7],
  ['E6.12>E6.11', 'E6.11>E6.12', 'AC240 + AC185', 19.1],
  ['E6.11>E6.2', 'E6.2>E6.11', 'AC185', 6.7],
  ['E6.2>E6.6', 'E6.6>E6.2', 'AC185', 20.99],
  ['E6.6>E26.1', 'E6.22>E6.6', 'AC185', 26.0],
  ['E6.22>E26.1', 'E26.1>E6.22', 'ACSR240', 10.99],
  ['E6.2>E6.8#1', 'E6.8>E6.2#1', 'AC185', 17.04],
  ['E6.2>E6.8#2', 'E6.8>E6.2#2', 'AC185', 17.04],
  ['E6.2>E6.4', 'E6.4>E6.2', 'AC400', 5.2],
  ['E6.4>E6.20', 'E6.20#175', 'AC400', 2.15],
  ['E6.9>E6.20#1', 'E6.20#171', 'AC300', 7.8],
  ['E6.9>E6.20#2', 'E6.20#172', 'AC300', 7.8],
  ['E6.5#171', 'E6.20#173', 'AC185', 1.78],
  ['E6.5#172', 'E6.20#174', 'AC185', 2.0],
  ['E6.21>E6.3', 'E6.3#171', 'AC400', 4.2],
  ['E6.3>E6.16', 'E6.16#174', 'AC400', 4.34],
  ['E6.7>E6.16', 'E6.16#173', 'AC400', 8.38],
  ['E6.24>E6.16', 'E6.16>E6.24', 'AC400', 5.54],
  ['E6.13>E6.16', 'E6.16#178', 'AC400', 4.34],
  ['E6.14>E6.16#1', 'E6.16#180', 'AC400', 8.92],
  ['E6.14>E6.16#2', 'E6.16#181', 'AC400', 8.92],
  ['E6.13>E6.23', 'E6.23>E6.13', 'ACSR400', 2.61],
  ['E6.13>E6.25', 'E6.25>E6.13', 'AC400', 5.3],
  ['E6.16>E6.25', 'E6.25>E6.16', 'AC400', 3.3],
  ['E6.25>E6.17', 'E6.17#172', 'AC400', 5.82],
  ['E6.25>E6.18', 'E6.18#171', 'AC400', 5.3],
];

/* ------------------------------------------------------------------ */
/* 4. Đi dây                                                            */
/* ------------------------------------------------------------------ */

const hopList = [...hop.entries()].map(([ma, b]) => ({ ma, ...b }));
const LE = 60; // nới biên ô trạm khi kiểm tra va chạm
const VUON = 110; // đoạn đi thẳng ra khỏi ngăn lộ
const O = 60; // cạnh ô lưới khi tìm đường

function huongRa(m) {
  const dx = m.p[0] - m.truoc[0];
  const dy = m.p[1] - m.truoc[1];
  if (Math.abs(dx) >= Math.abs(dy)) return [Math.sign(dx) || 1, 0];
  return [0, Math.sign(dy) || 1];
}

/* --- Lưới tìm đường --- */
const bao = {
  x0: Math.min(...hopList.map((h) => h.x0)) - 700,
  y0: Math.min(...hopList.map((h) => h.y0)) - 700,
  x1: Math.max(...hopList.map((h) => h.x1)) + 700,
  y1: Math.max(...hopList.map((h) => h.y1)) + 700,
};
const NX = Math.ceil((bao.x1 - bao.x0) / O) + 1;
const NY = Math.ceil((bao.y1 - bao.y0) / O) + 1;
const cot = (x) => Math.round((x - bao.x0) / O);
const hang = (y) => Math.round((y - bao.y0) / O);
const toaX = (i) => bao.x0 + i * O;
const toaY = (j) => bao.y0 + j * O;

/** Ô bị trạm nào chiếm (mã trạm), hoặc rỗng. */
const chiem = new Array(NX * NY).fill('');
for (const h of hopList) {
  for (let i = Math.max(0, cot(h.x0 - LE)); i <= Math.min(NX - 1, cot(h.x1 + LE)); i++) {
    for (let j = Math.max(0, hang(h.y0 - LE)); j <= Math.min(NY - 1, hang(h.y1 + LE)); j++) {
      chiem[j * NX + i] = h.ma;
    }
  }
}
/** Số tuyến đã đi qua mỗi ô - để các tuyến tự tản ra, không chồng lên nhau. */
const dongDuc = new Int16Array(NX * NY);

/**
 * Tìm đường đi vuông góc từ A tới B bằng A*, tránh ô của các trạm khác.
 * Chi phí = chiều dài + phạt mỗi lần rẽ + phạt đi trùng tuyến đã có.
 */
function timDuong(A, B, tru) {
  const si = cot(A[0]);
  const sj = hang(A[1]);
  const ti = cot(B[0]);
  const tj = hang(B[1]);
  if (si < 0 || si >= NX || sj < 0 || sj >= NY || ti < 0 || ti >= NX || tj < 0 || tj >= NY) return null;
  // Ô của trạm khác thì cấm hẳn; ô của CHÍNH hai trạm đầu cuối thì đi được nhưng
  // phạt rất nặng, để đường dây thoát ra khỏi trạm ngay chứ không cắt ngang trạm.
  const PHAT_TRONG_TRAM = 900;
  const phatO = (i, j) => {
    const c = chiem[j * NX + i];
    if (!c) return 0;
    return tru.includes(c) ? PHAT_TRONG_TRAM : -1;
  };
  const N = NX * NY;
  const DI = [1, -1, 0, 0];
  const DJ = [0, 0, 1, -1];
  const g = new Float64Array(N * 4).fill(Infinity);
  const truocO = new Int32Array(N * 4).fill(-1);
  const PHAT_RE = 260;
  const PHAT_DUC = 130;
  const h = (i, j) => (Math.abs(i - ti) + Math.abs(j - tj)) * O;
  // hàng đợi ưu tiên đơn giản (mảng + sắp xếp theo lô)
  let bien = [];
  for (let d = 0; d < 4; d++) {
    const k = (sj * NX + si) * 4 + d;
    g[k] = 0;
    bien.push([h(si, sj), k]);
  }
  let dich = -1;
  while (bien.length) {
    bien.sort((a, b) => a[0] - b[0]);
    const [f, k] = bien.shift();
    const d0 = k & 3;
    const o = k >> 2;
    const i0 = o % NX;
    const j0 = (o / NX) | 0;
    if (f - h(i0, j0) > g[k] + 1e-6) continue;
    if (i0 === ti && j0 === tj) {
      dich = k;
      break;
    }
    for (let d = 0; d < 4; d++) {
      const i1 = i0 + DI[d];
      const j1 = j0 + DJ[d];
      if (i1 < 0 || i1 >= NX || j1 < 0 || j1 >= NY) continue;
      const pt = phatO(i1, j1);
      if (pt < 0) continue;
      const k1 = (j1 * NX + i1) * 4 + d;
      const c = g[k] + O + pt + (d === d0 ? 0 : PHAT_RE) + dongDuc[j1 * NX + i1] * PHAT_DUC;
      if (c + 1e-9 < g[k1]) {
        g[k1] = c;
        truocO[k1] = k;
        bien.push([c + h(i1, j1), k1]);
      }
    }
    if (bien.length > 260000) return null;
  }
  if (dich < 0) return null;
  const o = [];
  for (let k = dich; k >= 0; k = truocO[k]) {
    const oo = k >> 2;
    o.push([toaX(oo % NX), toaY((oo / NX) | 0), oo]);
    if (truocO[k] < 0) break;
  }
  o.reverse();
  for (const v of o) dongDuc[v[2]]++;
  // bỏ điểm giữa của các đoạn thẳng hàng
  const pts = [];
  for (let i = 0; i < o.length; i++) {
    if (i === 0 || i === o.length - 1) {
      pts.push([o[i][0], o[i][1]]);
      continue;
    }
    const a = o[i - 1];
    const b = o[i + 1];
    if ((a[0] === o[i][0] && b[0] === o[i][0]) || (a[1] === o[i][1] && b[1] === o[i][1])) continue;
    pts.push([o[i][0], o[i][1]]);
  }
  return pts;
}

function diDay(mA, mB, tru) {
  const dA = huongRa(mA);
  const dB = huongRa(mB);
  const A = [mA.p[0] + dA[0] * VUON, mA.p[1] + dA[1] * VUON];
  const B = [mB.p[0] + dB[0] * VUON, mB.p[1] + dB[1] * VUON];
  const giua = timDuong(A, B, tru);
  if (!giua) return null;
  // nối đầu ngăn lộ -> điểm ra -> đường đi -> điểm ra -> đầu ngăn lộ
  return { pts: [mA.p, A, ...giua, B, mB.p] };
}

/* ------------------------------------------------------------------ */
/* 5. Ghi vào dữ liệu                                                   */
/* ------------------------------------------------------------------ */

const iLayer = (ten) => {
  let i = data.layers.indexOf(ten);
  if (i < 0) {
    data.layers.push(ten);
    i = data.layers.length - 1;
  }
  return i;
};
const iSrc = (ten) => {
  let i = data.srcLayers.indexOf(ten);
  if (i < 0) {
    data.srcLayers.push(ten);
    i = data.srcLayers.length - 1;
  }
  return i;
};
const LOP = iLayer('110kV');
const SRC = iSrc('Kết lưới 110kV');
const KIEU = Math.max(0, data.lineKinds.indexOf('ĐDK'));
const CAN_GIUA = Math.max(0, data.aligns.indexOf('center'));
const r2 = (v) => Math.round(v * 100) / 100;

let xong = 0;
const thieu = [];
for (const [ka, kb, day, km] of DUONG_DAY) {
  const mA = dauLo.get(ka);
  const mB = dauLo.get(kb);
  if (!mA || !mB) {
    thieu.push(`${ka} <-> ${kb}${!mA ? '  (thiếu ' + ka + ')' : ''}${!mB ? '  (thiếu ' + kb + ')' : ''}`);
    continue;
  }
  const tru = [ka.split(/[>#]/)[0], kb.split(/[>#]/)[0]];
  const d = diDay(mA, mB, tru);
  if (!d) {
    thieu.push(`${ka} <-> ${kb}  (không tìm được đường đi)`);
    continue;
  }
  // gộp các điểm trùng nhau
  const pts = [];
  for (const p of d.pts) {
    const q = [r2(p[0]), r2(p[1])];
    if (!pts.length || cach(pts[pts.length - 1], q) > 0.5) pts.push(q);
  }
  to.b.push([LOP, 110, KIEU, SRC, ...pts.flat()]);

  // Nhãn mã hiệu dây đặt giữa đoạn hành lang dài nhất
  let bestI = 1;
  let bestL = -1;
  for (let i = 1; i < pts.length; i++) {
    const L = cach(pts[i - 1], pts[i]);
    if (L > bestL) {
      bestL = L;
      bestI = i;
    }
  }
  const mx = (pts[bestI - 1][0] + pts[bestI][0]) / 2;
  const my = (pts[bestI - 1][1] + pts[bestI][1]) / 2;
  const doc = Math.abs(pts[bestI][0] - pts[bestI - 1][0]) < 1;
  to.t.push([
    LOP,
    110,
    r2(mx + (doc ? 14 : 0)),
    r2(my + (doc ? 0 : 16)),
    13,
    doc ? 90 : 0,
    CAN_GIUA,
    SRC,
    `${day} - ${String(km).replace('.', ',')}km`,
  ]);
  xong++;
}

writeFileSync(duongDan, JSON.stringify(data));
console.log(`Đã nối ${xong}/${DUONG_DAY.length} đường dây 110kV vào tờ sơ đồ kết dây.`);
if (thieu.length) {
  console.log('Chưa nối được:');
  for (const t of thieu) console.log('  -', t);
}
