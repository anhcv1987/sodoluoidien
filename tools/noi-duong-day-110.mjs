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

/** Tên lớp CAD riêng cho phần do chính script này vẽ thêm. */
const SRC_KET_LUOI = 'Kết lưới 110kV';
const SRC_NGOAI = 'Trạm ngoài tỉnh';

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
const SRC = iSrc(SRC_KET_LUOI);
const SRC_TN = iSrc(SRC_NGOAI);
const KIEU = Math.max(0, data.lineKinds.indexOf('ĐDK'));
const KIEU_TC = Math.max(0, data.lineKinds.indexOf('Thanh cái'));
const CAN_GIUA = Math.max(0, data.aligns.indexOf('center'));
const CAN_TRAI = Math.max(0, data.aligns.indexOf('left'));
const I_MC = Math.max(0, data.blocks.indexOf('MC'));
const r2 = (v) => Math.round(v * 100) / 100;

// Xoá kết quả của lần chạy trước để chạy lại được nhiều lần trên cùng một file.
{
  const bo = new Set([SRC, SRC_TN]);
  const n0 = to.b.length;
  to.b = to.b.filter((r) => !bo.has(r[3]));
  to.t = to.t.filter((r) => !bo.has(r[7]));
  to.d = to.d.filter((r) => !bo.has(r[8]));
  if (n0 !== to.b.length) console.log(`Đã xoá ${n0 - to.b.length} tuyến của lần chạy trước.`);
}

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

// (b) Ghép SỐ HIỆU NGĂN LỘ cho những đầu mút đã nhận ra nhờ nhãn nơi đến.
//     Nhãn nơi đến ghi số hiệu ngăn lộ của ĐẦU KIA ("171 E6.8" ở trạm E6.2 nghĩa
//     là đi tới ngăn 171 của trạm E6.8) nên số hiệu ngăn lộ của chính trạm phải
//     tra ở hàng chữ phía trong, nằm cùng trục với đoạn dây ra.
//
//     Tiện thể ghi lại HÀNG NGĂN LỘ của trạm - cao độ của hàng đầu dây ra - để
//     bước (c) bám theo.
/** Cao độ (hoặc hoành độ) hàng đầu dây ra của từng trạm. */
const hangLo = new Map();
for (const [khoa, m] of [...dauLo]) {
  const g = /^([EA]\d+(?:\.\d+)?)>[EA]\d+(?:\.\d+)?#\d+$/.exec(khoa);
  if (!g) continue;
  const b = hop.get(g[1]);
  if (!b) continue;
  const doc = Math.abs(m.p[1] - m.truoc[1]) >= Math.abs(m.p[0] - m.truoc[0]);
  let lo = '';
  let lech = 40;
  for (const c of nhanLo) {
    if (c.x < b.x0 - 80 || c.x > b.x1 + 80 || c.y < b.y0 - 80 || c.y > b.y1 + 80) continue;
    const d = doc ? Math.abs(c.x - m.p[0]) : Math.abs(c.y - m.p[1]);
    if (d < lech) {
      lech = d;
      lo = c.t;
    }
  }
  if (lo) dauLo.set(`${g[1]}#${lo}`, m);
  hangLo.set(g[1], { doc, v: doc ? m.p[1] : m.p[0] });
}

// (c) Theo số hiệu ngăn lộ - dùng cho ngăn lộ KHÔNG ghi nhãn nơi đến.
//     Đầu ngăn lộ nằm thành MỘT HÀNG ở mép trạm. Nếu bước (b) đã xác định được
//     hàng đó thì bám theo, không thì lấy hàng có nhiều đầu mút nhất. Lấy đúng
//     hàng là quan trọng: bắt nhầm đầu mút nằm sâu trong trạm (sát thanh cái,
//     giữa hai dao cách ly) thì đường dây sẽ được vẽ cắt ngang qua cả trạm.
for (const [ma, b] of hop) {
  const trong = dauMut.filter(
    (m) => m.p[0] >= b.x0 - 80 && m.p[0] <= b.x1 + 80 && m.p[1] >= b.y0 - 80 && m.p[1] <= b.y1 + 80,
  );
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
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
    const raNgoai =
      (m.p[0] - m.truoc[0]) * (m.p[0] - cx) + (m.p[1] - m.truoc[1]) * (m.p[1] - cy) > 0;
    if (raNgoai) kem.push({ m, t });
  }
  let hang = hangLo.get(ma);
  // Chỉ nới ra ngoài hàng khi ĐÃ BIẾT CHẮC hàng đầu dây ra nhờ nhãn nơi đến;
  // trạm không có nhãn nào thì bám sát hàng đông đầu mút nhất cho an toàn.
  const noiRa = Boolean(hang);
  if (!hang) {
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
    hang = { doc: true, v: yTot };
  }
  // Ngăn lộ chĩa về phía nào thì nhận các đầu mút từ hàng đó TRỞ RA (có trạm vẽ
  // đầu dây ra so le nhau), còn đầu mút nằm phía trong hàng thì bỏ.
  const chieu = hang.v < (hang.doc ? cy : cx) ? -1 : 1;
  const xa = new Map();
  for (const k of kem) {
    const v = hang.doc ? k.m.p[1] : k.m.p[0];
    if (noiRa ? (v - hang.v) * chieu < -40 : Math.abs(v - hang.v) > 40) continue;
    const cu = xa.get(k.t);
    if (!cu || (v - cu.v) * chieu > 0) xa.set(k.t, { m: k.m, v });
  }
  for (const [t, u] of xa) {
    const khoaLo = `${ma}#${t}`;
    if (!dauLo.has(khoaLo)) dauLo.set(khoaLo, u.m);
  }
}

/* ------------------------------------------------------------------ */
/* 2b. Trạm 220kV ngoài tỉnh                                            */
/* ------------------------------------------------------------------ */

/**
 * Lưới 110kV Thái Nguyên - Bắc Kạn còn nhận điện từ ba trạm 220kV KHÔNG thuộc
 * địa bàn, bản CAD gốc chưa vẽ (chỉ ghi nhãn nơi đến ở đầu ngăn lộ):
 *
 *   E26.5 - 220kV Bắc Kạn   (cấp cho E26.1 Bắc Kạn, E26.2 Chợ Đồn, E26.3 Nà Phặc)
 *   E16.2 - 220kV Cao Bằng  (cấp cho E26.3 Nà Phặc)
 *   E1.19 - 220kV Sóc Sơn   (cấp cho E6.16 Phú Bình, E6.24 Đa Phúc, E6.7 Sông Công)
 *
 * E1.19 đã có sẵn một sơ đồ thu nhỏ ở góc dưới bên trái bản vẽ nên chỉ cần lấy
 * lại đầu ngăn lộ; hai trạm còn lại được vẽ thêm phần thanh cái 110kV (thanh cái
 * + máy cắt + ngăn lộ), đủ để thể hiện điểm đấu nối chứ không vẽ sâu vào trạm.
 */

/** Trạm ngoài tỉnh: không vẽ lưới trung áp nên không cần chừa dải để dành. */
const ngoaiTinh = new Set();

const BUOC_LO = 350; // khoảng cách giữa hai ngăn lộ
const SAU_LO = 130; // chiều dài ngăn lộ tính từ thanh cái xuống
const CAO_MC = 16; // cỡ ký hiệu máy cắt, bằng máy cắt 110kV trong các trạm

/** Hình học vẽ thêm cho trạm ngoài tỉnh, ghi vào dữ liệu ở cuối script. */
const veNgoai = { b: [], d: [], t: [] };

const TRAM_NGOAI = [
  // [mã, tên ghi trên bản vẽ, x ngăn lộ đầu, cao độ thanh cái, danh sách ngăn lộ]
  ['E26.5', '220kV BẮC KẠN (E26.5)', -100, 7980, ['171', '173', '172', '174']],
  ['E16.2', '220kV CAO BẰNG (E16.2)', 2450, 7980, ['171']],
];

for (const [ma, ten, x0Lo, yTC, dsLo] of TRAM_NGOAI) {
  const xs = dsLo.map((_, i) => x0Lo + i * BUOC_LO);
  const xa = xs[0] - 120;
  const xb = xs[xs.length - 1] + 120;
  veNgoai.b.push([LOP, 110, KIEU_TC, SRC_TN, xa, yTC, xb, yTC]);
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    const yMC = yTC - 40 - CAO_MC / 2;
    veNgoai.b.push([LOP, 110, KIEU, SRC_TN, x, yTC, x, yMC + CAO_MC / 2]);
    veNgoai.d.push([LOP, 110, I_MC, x, yMC, 0, CAO_MC, 0, SRC_TN, 0]);
    veNgoai.b.push([LOP, 110, KIEU, SRC_TN, x, yMC - CAO_MC / 2, x, yTC - SAU_LO]);
    veNgoai.t.push([LOP, 110, x + 14, yMC - 6, 13, 0, CAN_TRAI, SRC_TN, dsLo[i]]);
    dauLo.set(`${ma}#${dsLo[i]}`, { p: [x, yTC - SAU_LO], truoc: [x, yMC - CAO_MC / 2] });
  }
  veNgoai.t.push([LOP, 110, (xa + xb) / 2, yTC + 30, 24, 0, CAN_GIUA, SRC_TN, ten]);
  hop.set(ma, { x0: xa, y0: yTC - SAU_LO, x1: xb, y1: yTC + 70 });
  ngoaiTinh.add(ma);
}

/**
 * E1.19 SÓC SƠN - sơ đồ thu nhỏ có sẵn trong file CAD. Ngăn lộ 172 chỉ vẽ tới máy
 * cắt, thiếu đoạn dây ra nên vẽ bù cho bằng các ngăn lộ bên cạnh.
 */
{
  hop.set('E1.19', { x0: -4816, y0: -6975, x1: -4610, y1: -6762 });
  ngoaiTinh.add('E1.19');
  veNgoai.b.push([LOP, 110, KIEU, SRC_TN, -4686.61, -6836.27, -4686.61, -6869.38]);
  const bayE119 = [
    // [số ngăn lộ, x, y đầu dây ra, y điểm phía trong]
    ['172', -4686.61, -6869.38, -6836.27],
    ['174', -4651.73, -6954.27, -6836.27],
    ['176', -4617.08, -6915.43, -6852.83],
  ];
  for (const [lo, x, y, yTrong] of bayE119) {
    dauLo.set(`E1.19#${lo}`, { p: [x, y], truoc: [x, yTrong] });
  }
}

// Xem danh sách khoá đầu ngăn lộ nhận được:  XEM=1 node tools/noi-duong-day-110.mjs
if (process.env.XEM) {
  const ds = [...dauLo.entries()].map(([k, m]) => [k, m.p.map((v) => Math.round(v))]);
  ds.sort((x, y) => x[0].localeCompare(y[0]));
  for (const [k, q] of ds) console.log(k.padEnd(18), q.join(', '));
  process.exit(0);
}

/* ------------------------------------------------------------------ */
/* 3. Danh mục đường dây 110kV                                          */
/* ------------------------------------------------------------------ */

/**
 * [đầu A, đầu B, mã hiệu dây, chiều dài km]
 *
 * Khoá đầu ngăn lộ ưu tiên dạng "trạm#số ngăn lộ" vì đó là cách Phòng Điều độ gọi
 * tên lộ (177E6.2, 171E6.8...). Dạng "trạm>trạm đến" chỉ dùng khi ngăn lộ không
 * ghi số hiệu trên bản vẽ. Để trống mã hiệu dây thì không ghi nhãn.
 */
const DUONG_DAY = [
  ['E6.19>E6.12', 'E6.12>E6.19', 'AC185+AC240', 10.7],
  ['E6.12>E6.11', 'E6.11>E6.12', 'AC240 + AC185', 19.1],
  ['E6.11>E6.2', 'E6.2>E6.11', 'AC185', 6.7],
  ['E6.2>E6.6', 'E6.6>E6.2', 'AC185', 20.99],
  ['E6.6>E26.1', 'E6.22>E6.6', 'AC185', 26.0],
  ['E6.22>E26.1', 'E26.1>E6.22', 'ACSR240', 10.99],
  ['E6.2#177', 'E6.8#171', 'AC185', 17.04],
  ['E6.2#178', 'E6.8#172', 'AC185', 17.04],
  ['E6.2>E6.4', 'E6.4>E6.2', 'AC400', 5.2],
  ['E6.4>E6.20', 'E6.20#175', 'AC400', 2.15],
  ['E6.9>E6.20#1', 'E6.20#171', 'AC300', 7.8],
  ['E6.9>E6.20#2', 'E6.20#172', 'AC300', 7.8],
  ['E6.5#171', 'E6.20#173', 'AC185', 1.78],
  ['E6.5#172', 'E6.20#174', 'AC185', 2.0],
  ['E6.3#171', 'E6.21#171', 'AC400', 4.28],
  ['E6.3#172', 'E6.16#172', 'AC400', 4.34],
  ['E6.7>E6.16', 'E6.16#173', 'AC400', 8.38],
  ['E6.24>E6.16', 'E6.16>E6.24', 'AC400', 5.54],
  ['E6.13>E6.16', 'E6.16#178', 'AC400', 4.34],
  ['E6.14>E6.16#1', 'E6.16#180', 'AC400', 8.92],
  ['E6.14>E6.16#2', 'E6.16#181', 'AC400', 8.92],
  ['E6.13>E6.23', 'E6.23>E6.13', 'ACSR400', 2.61],
  ['E6.13#172', 'E6.25#172', 'AC400', 5.3],
  ['E6.16>E6.25', 'E6.25>E6.16', 'AC400', 3.3],
  ['E6.25>E6.17', 'E6.17#172', 'AC400', 5.82],
  ['E6.25>E6.18', 'E6.18#171', 'AC400', 5.3],

  /* --- Đường dây 110kV đi các trạm 220kV ngoài địa bàn ---
     Sơ đồ kết lưới của Phòng Điều độ không ghi mã hiệu dây và chiều dài cho các
     lộ nối lên 220kV Bắc Kạn và 220kV Cao Bằng nên để trống, chờ bổ sung. */
  ['E26.5#173', 'E26.1#171', '', 0],
  ['E26.5#172', 'E26.1#172', '', 0],
  ['E26.5#171', 'E26.2#171', '', 0],
  ['E26.5#174', 'E26.3#171', '', 0],
  ['E16.2#171', 'E26.3#172', '', 0],
  // 220kV Sóc Sơn: chiều dài là tổng các đoạn ghi trên sơ đồ kết lưới
  ['E1.19#176', 'E6.16#176', 'AC400+TACSR200', 15.94],
  ['E1.19#174', 'E6.24#171', 'AC400+TACSR200', 8.38],
  ['E1.19#172', 'E6.7#172', 'AC2x185', 11.0],
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
/**
 * HÀNH LANG DÀNH SẴN CHO LƯỚI TRUNG ÁP.
 *
 * Trong mỗi sơ đồ trạm, thanh cái trung áp nằm ở DƯỚI CÙNG và các lộ xuất tuyến
 * chĩa xuống. Sau này đấu lưới 22/35kV vào thì các lộ đó phải đi xuống. Vì vậy
 * dải ngay bên dưới mỗi trạm được để dành: đường dây 110kV vẫn đi qua được nhưng
 * bị phạt nặng nên sẽ tự vòng sang hai bên, chừa chỗ cho lưới trung áp.
 */
const DAI_TA = 560; // bề sâu dải để dành (đơn vị bản vẽ)
const PHAT_TA = 420; // phạt mỗi ô khi đi vào dải đó
const daiTrungAp = new Array(NX * NY).fill('');
for (const h of hopList) {
  if (ngoaiTinh.has(h.ma)) continue; // trạm ngoài tỉnh không vẽ lưới trung áp
  for (let i = Math.max(0, cot(h.x0 - LE)); i <= Math.min(NX - 1, cot(h.x1 + LE)); i++) {
    for (let j = Math.max(0, hang(h.y0 - LE - DAI_TA)); j <= Math.min(NY - 1, hang(h.y0 - LE)); j++) {
      const k = j * NX + i;
      if (!chiem[k]) daiTrungAp[k] = h.ma;
    }
  }
}

/**
 * Ô đã có sẵn hình vẽ trên bản CAD. Đường dây kết lưới đi đè lên thanh cái, máy
 * cắt hay dao cách ly của trạm thì nhìn rất rối, nên các ô đó bị phạt; riêng ô có
 * thiết bị TRUNG ÁP (35/22/10/6/0,4kV) bị phạt rất nặng - đó là phần phải để dành
 * cho việc đấu tiếp lưới trung áp sau này.
 */
const CAP_TA = [0.4, 6, 10, 22, 35];
const oDaVe = new Uint8Array(NX * NY);
const oTrungAp = new Uint8Array(NX * NY);
{
  const cham = (mang, x, y) => {
    const i = cot(x);
    const j = hang(y);
    if (i < 0 || i >= NX || j < 0 || j >= NY) return;
    mang[j * NX + i] = 1;
  };
  for (const r of to.b) {
    if (r[3] === SRC || r[3] === SRC_TN) continue; // phần do chính script này vẽ
    const mang = CAP_TA.includes(r[1]) ? oTrungAp : oDaVe;
    for (let i = 4; i + 3 < r.length; i += 2) {
      const [x0, y0, x1, y1] = [r[i], r[i + 1], r[i + 2], r[i + 3]];
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (O / 2)));
      for (let t = 0; t <= n; t++) cham(mang, x0 + ((x1 - x0) * t) / n, y0 + ((y1 - y0) * t) / n);
    }
  }
  // nới rộng vùng trung áp ra một ô cho thoáng
  const goc = Uint8Array.from(oTrungAp);
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      if (!goc[j * NX + i]) continue;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const i1 = i + di;
          const j1 = j + dj;
          if (i1 >= 0 && i1 < NX && j1 >= 0 && j1 < NY) oTrungAp[j1 * NX + i1] = 1;
        }
      }
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
  const maTru = tru.map((t) => t.ma);
  const si = cot(A[0]);
  const sj = hang(A[1]);
  const ti = cot(B[0]);
  const tj = hang(B[1]);
  if (si < 0 || si >= NX || sj < 0 || sj >= NY || ti < 0 || ti >= NX || tj < 0 || tj >= NY) return null;
  // Ô của trạm khác thì cấm hẳn; ô của CHÍNH hai trạm đầu cuối thì đi được nhưng
  // phạt nặng, để đường dây thoát ra khỏi trạm ngay chứ không cắt ngang trạm.
  const PHAT_TRONG_TRAM = 900;
  /** Phạt khi đè lên hình vẽ sẵn có của bản CAD. */
  const PHAT_DE = 1100;
  /** Phạt rất nặng khi đi vào phần TRUNG ÁP - chỗ để dành đấu lưới 35/22/6kV. */
  const PHAT_TA_TRONG = 5200;
  const phatO = (i, j) => {
    const k = j * NX + i;
    const c = chiem[k];
    if (c && !maTru.includes(c)) return -1;
    let p = c ? PHAT_TRONG_TRAM : 0;
    if (oTrungAp[k]) p += PHAT_TA_TRONG;
    else if (oDaVe[k]) p += PHAT_DE;
    // Dải để dành cho lưới trung áp ngay dưới trạm: đi qua được nhưng phạt nặng.
    const d = daiTrungAp[k];
    if (d && !maTru.includes(d)) p += PHAT_TA;
    return p;
  };
  const N = NX * NY;
  const DI = [1, -1, 0, 0];
  const DJ = [0, 0, 1, -1];
  const g = new Float64Array(N * 4).fill(Infinity);
  const truocO = new Int32Array(N * 4).fill(-1);
  const PHAT_RE = 260;
  const PHAT_DUC = 220;
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

function diDay(mA, mB, maTram) {
  const dA = huongRa(mA);
  const dB = huongRa(mB);
  const tru = [{ ma: maTram[0] }, { ma: maTram[1] }];
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

const thieu = [];
/** Các tuyến đã đi dây xong, chờ chèn ký hiệu nhảy dây rồi mới ghi. */
const tuyen = [];
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
  tuyen.push({ pts, day, km });
}

/* ------------------------------------------------------------------ */
/* 6. Ký hiệu NHẢY DÂY ở chỗ giao chéo                                  */
/* ------------------------------------------------------------------ */

/**
 * Hai đường dây cắt nhau trên bản vẽ nhưng KHÔNG đấu với nhau. Theo thông lệ vẽ
 * sơ đồ điện, đoạn nằm ngang được vẽ vòng qua bằng một NỬA HÌNH TRÒN, đoạn nằm
 * dọc giữ nguyên - nhìn là biết ngay hai tuyến không giao nhau.
 *
 * Nửa hình tròn được chèn thẳng vào chính đường gấp khúc của tuyến nằm ngang
 * (xấp xỉ bằng 8 đoạn thẳng ngắn). Nhờ vậy chỗ giao KHÔNG có đỉnh nào trùng nhau,
 * nên phần tô sáng mạch điện (Shift+M) cũng không nhầm hai tuyến là một.
 */
const R_NHAY = 24;
const N_CUNG = 8;

/**
 * Chỗ giao của một đoạn NGANG và một đoạn DỌC: trả về { x, r } với r là bán kính
 * nửa hình tròn vẽ được (thu nhỏ lại nếu chỗ giao nằm sát góc rẽ), hoặc null.
 */
function giaoNgangDoc(h, v) {
  const y = h[0][1];
  const x = v[0][0];
  const hx0 = Math.min(h[0][0], h[1][0]);
  const hx1 = Math.max(h[0][0], h[1][0]);
  const vy0 = Math.min(v[0][1], v[1][1]);
  const vy1 = Math.max(v[0][1], v[1][1]);
  if (!(x > hx0 + 4 && x < hx1 - 4 && y > vy0 + 2 && y < vy1 - 2)) return null;
  const r = Math.min(R_NHAY, x - hx0 - 3, hx1 - x - 3);
  return r >= 9 ? { x, r } : null;
}

const laNgang = (a, b) => Math.abs(a[1] - b[1]) < 0.6;
const laDoc = (a, b) => Math.abs(a[0] - b[0]) < 0.6;

// Gom các điểm cần nhảy theo từng đoạn nằm ngang: khoá "tuyến|chỉ số đoạn"
const diemNhay = new Map();
for (let i = 0; i < tuyen.length; i++) {
  for (let k = 1; k < tuyen[i].pts.length; k++) {
    const h = [tuyen[i].pts[k - 1], tuyen[i].pts[k]];
    if (!laNgang(h[0], h[1])) continue;
    for (let j = 0; j < tuyen.length; j++) {
      if (j === i) continue;
      for (let l = 1; l < tuyen[j].pts.length; l++) {
        const v = [tuyen[j].pts[l - 1], tuyen[j].pts[l]];
        if (!laDoc(v[0], v[1])) continue;
        const g = giaoNgangDoc(h, v);
        if (!g) continue;
        const khoaD = `${i}|${k}`;
        const ds = diemNhay.get(khoaD) ?? [];
        if (!ds.some((u) => Math.abs(u.x - g.x) < (u.r + g.r) * 0.55)) ds.push(g);
        diemNhay.set(khoaD, ds);
      }
    }
  }
}

let soNhay = 0;
// Chèn từ đoạn CUỐI ngược về đầu: splice làm dịch chỉ số các đoạn phía sau,
// chèn xuôi thì những chỗ nhảy sau sẽ rơi sai chỗ.
const khoaSap = [...diemNhay.keys()].sort((p, q) => {
  const [i1, k1] = p.split('|').map(Number);
  const [i2, k2] = q.split('|').map(Number);
  return i1 - i2 || k2 - k1;
});
for (const khoaD of khoaSap) {
  const xs = diemNhay.get(khoaD);
  const [i, k] = khoaD.split('|').map(Number);
  const pts = tuyen[i].pts;
  const a = pts[k - 1];
  const b = pts[k];
  const chieu = b[0] > a[0] ? 1 : -1;
  xs.sort((u, w) => (u.x - w.x) * chieu);
  const them = [];
  for (const { x, r } of xs) {
    const y = a[1];
    // nửa hình tròn vồng lên trên (+y)
    for (let t = 0; t <= N_CUNG; t++) {
      const goc = Math.PI * (t / N_CUNG);
      them.push([r2(x - chieu * r * Math.cos(goc)), r2(y + r * Math.sin(goc))]);
    }
    soNhay++;
  }
  pts.splice(k, 0, ...them);
}

/* --- Tách các đỉnh trùng nhau giữa hai tuyến khác nhau ---
   Hai tuyến rẽ đúng tại cùng một điểm thì mô hình liên kết điện sẽ coi là chúng
   ĐẤU VÀO NHAU, tô sáng Shift+M sẽ sáng nhầm cả hai. Vạt góc đi một chút để hai
   tuyến chỉ cắt nhau chứ không chạm nhau. Làm nhiều lượt vì vạt xong có thể lại
   sinh ra đỉnh trùng mới. */
{
  const kh = (q) => `${Math.round(q[0] * 2)}|${Math.round(q[1] * 2)}`;
  let vat = 0;
  for (let luot = 0; luot < 6; luot++) {
    const kho = new Map();
    tuyen.forEach((t, i) =>
      t.pts.forEach((q, k) => {
        const a = kho.get(kh(q));
        if (a) a.push([i, k]);
        else kho.set(kh(q), [[i, k]]);
      }),
    );
    const canVat = [];
    for (const ds of kho.values()) {
      if (ds.length < 2) continue;
      if (!ds.some(([i]) => i !== ds[0][0])) continue;
      // giữ tuyến đầu tiên, vạt góc các tuyến còn lại
      for (let z = 1; z < ds.length; z++) canVat.push([...ds[z], z]);
    }
    if (!canVat.length) break;
    // vạt từ cuối lên đầu để splice không làm lệch chỉ số
    canVat.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
    for (const [i, k, z] of canVat) {
      const pts = tuyen[i].pts;
      if (k === 0 || k >= pts.length - 1) continue;
      const a = pts[k - 1];
      const c = pts[k];
      const b = pts[k + 1];
      const d = 13 + z * 9;
      const ca = [c[0] + Math.sign(a[0] - c[0]) * d, c[1] + Math.sign(a[1] - c[1]) * d];
      const cb = [c[0] + Math.sign(b[0] - c[0]) * d, c[1] + Math.sign(b[1] - c[1]) * d];
      if (cach(ca, a) < 2 || cach(cb, b) < 2) continue;
      pts.splice(k, 1, [r2(ca[0]), r2(ca[1])], [r2(cb[0]), r2(cb[1])]);
      vat++;
    }
  }
  if (vat) console.log(`Đã vạt ${vat} góc trùng nhau giữa hai tuyến.`);
}

/* ------------------------------------------------------------------ */
/* 7. Ghi ra dữ liệu                                                    */
/* ------------------------------------------------------------------ */

let xong = 0;
for (const { pts, day, km } of tuyen) {
  to.b.push([LOP, 110, KIEU, SRC, ...pts.flat()]);

  // Nhãn mã hiệu dây đặt giữa đoạn thẳng dài nhất
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
  xong++;
  if (!day) continue; // chưa có mã hiệu dây / chiều dài thì không ghi nhãn
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
}

// Phần vẽ thêm cho trạm 220kV ngoài tỉnh
for (const r of veNgoai.b) to.b.push(r);
for (const r of veNgoai.d) to.d.push(r);
for (const r of veNgoai.t) to.t.push(r);

writeFileSync(duongDan, JSON.stringify(data));

// Tự kiểm: đếm số đỉnh rơi vào ô đã có hình vẽ / ô trung áp.
{
  let deTA = 0;
  let deVe = 0;
  let dinh = 0;
  for (const { pts } of tuyen) {
    for (const q of pts) {
      const i = cot(q[0]);
      const j = hang(q[1]);
      if (i < 0 || i >= NX || j < 0 || j >= NY) continue;
      dinh++;
      if (oTrungAp[j * NX + i]) deTA++;
      else if (oDaVe[j * NX + i]) deVe++;
    }
  }
  console.log(`Tự kiểm: ${dinh} đỉnh, ${deTA} đỉnh trong vùng trung áp, ${deVe} đỉnh đè hình vẽ sẵn.`);
}

console.log(
  `Đã nối ${xong}/${DUONG_DAY.length} đường dây 110kV vào tờ sơ đồ kết dây` +
    `, chèn ${soNhay} ký hiệu nhảy dây ở chỗ giao chéo.`,
);
if (thieu.length) {
  console.log('Chưa nối được:');
  for (const t of thieu) console.log('  -', t);
}
