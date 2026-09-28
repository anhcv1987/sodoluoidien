/**
 * ĐẶT LẠI TÊN TRẠM 110-220kV TRÊN TỜ SƠ ĐỒ KẾT DÂY (TONG) CHO CÂN ĐỐI VỚI SƠ ĐỒ TRẠM.
 *
 *     node tools/dat-ten-tram.mjs [src/data/tram-sld.json]
 *
 * Tiêu đề trạm trong bản CAD gốc đặt tuỳ tiện: căn trái từ giữa trạm (chữ lệch hẳn sang phải), cỡ chữ
 * 12 - 21,6, có trạm đặt lọt vào giữa hình vẽ; cách ghi lẫn lộn "SƠ ĐỒ TRẠM ...", "110KV" / "110kV",
 * thiếu ngoặc quanh mã trạm. Công cụ này:
 *   - ghi thống nhất "TRẠM 110kV ĐỊNH HÓA (E6.22)";
 *   - cùng một cỡ chữ CAO_CHU;
 *   - căn giữa theo bề ngang phần hình vẽ của trạm, đặt ngay phía trên (cách KHOANG), trên cả các nhãn
 *     nơi đến ở đầu ngăn lộ; vướng hình vẽ trạm khác / lưới trung áp thì đặt giữa phía dưới;
 *   - nới ô trạm (danh mục st) bao lấy tên, ghi vị trí tên vào st.
 * Tên đã đặt mang lớp CAD gốc "Tên trạm" nên chạy lại bao nhiêu lần cũng được (tính lại từ hình vẽ).
 * Chạy sau tools/doi-cho-tram.mjs, trước ve-luoi-trung-ap / noi-duong-day-110.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CAO_CHU = 16;
const KHOANG = 22;

const duongDan = resolve(process.argv[2] ?? 'src/data/tram-sld.json');
const data = JSON.parse(readFileSync(duongDan, 'utf8'));
const to = data.sheets.find((s) => s.code === 'TONG');
const idx = (arr, v) => {
  let i = arr.indexOf(v);
  if (i < 0) i = arr.push(v) - 1;
  return i;
};
const SRC_TEN = idx(data.srcLayers, 'Tên trạm');
const GIUA = data.aligns.indexOf('center');
const boQua = new Set(['Lưới trung áp', 'Kết lưới 110kV', 'Trạm ngoài tỉnh', 'Tên trạm'].map((t) => data.srcLayers.indexOf(t)).filter((i) => i >= 0));

/** "SƠ ĐỒ TRẠM 110KV NÀ PHẶC (E26.3)" / "TRẠM 220 KV THÁI NGUYÊN E6.2" -> "TRẠM 110kV NÀ PHẶC (E26.3)". */
function chuanHoa(ten, ma) {
  let s = String(ten).replace(/\s+/g, ' ').trim();
  s = s.replace(/^SƠ ĐỒ\s+/i, '');
  s = s.replace(new RegExp(`\\(?\\s*${ma.replace('.', '\\.')}\\s*\\)?\\s*$`), '').trim();
  s = s.replace(/(\d{3})\s*KV\b/gi, '$1kV');
  s = s.replace(/^TRẠM\s*/i, 'TRẠM ');
  return `${s} (${ma})`;
}

// Ô trạm GỐC (trước khi nới bao tên) ghi ở st[9] - đo hình vẽ trạm luôn theo ô gốc, chạy lại cho kết
// quả như nhau
for (const q of to.st) if (q.length >= 8 && !q[8] && !Array.isArray(q[9])) { q[8] = q[8] ?? 0; q[9] = [q[4], q[5], q[6], q[7]]; }
const oGoc = (q) => (Array.isArray(q[9]) ? q[9] : [q[4], q[5], q[6], q[7]]);

// Vật cản cho tên: hình vẽ các trạm khác và lưới trung áp đã vẽ (đường dây 110kV sẽ đi lại sau)
const SRC_TA = data.srcLayers.indexOf('Lưới trung áp');
const O = 20;
const ban = new Set();
const danh = (x, y, ma) => ban.add(`${Math.floor(x / O)},${Math.floor(y / O)}|${ma ?? ''}`);
const tramCua = (x, y) => to.st.find((q) => { if (q.length < 8 || q[8]) return false; const [a, b, c, d] = oGoc(q); return x >= a && x <= c && y >= b && y <= d; })?.[0];
for (const b of to.b) {
  if (b[3] === data.srcLayers.indexOf('Kết lưới 110kV') || b[3] === SRC_TEN) continue;
  for (let k = 6; k + 1 < b.length; k += 2) {
    const [ax, ay, bx, by] = [b[k - 2], b[k - 1], b[k], b[k + 1]];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (O / 2)));
    for (let j = 0; j <= n; j++) {
      const x = ax + ((bx - ax) * j) / n, y = ay + ((by - ay) * j) / n;
      danh(x, y, b[3] === SRC_TA ? 'TA' : tramCua(x, y));
    }
  }
}
for (const d of to.d) danh(d[3], d[4], d[8] === SRC_TA ? 'TA' : tramCua(d[3], d[4]));
/** Hộp chữ [x0, y0, x1, y1] có đè lên hình vẽ trạm khác / lưới trung áp không. */
const vuong = (h, ma) => {
  for (let i = Math.floor(h[0] / O); i <= Math.floor(h[2] / O); i++) {
    for (let j = Math.floor(h[1] / O); j <= Math.floor(h[3] / O); j++) {
      if (ban.has(`${i},${j}|TA`)) return true;
      for (const q of to.st) if (q.length >= 8 && !q[8] && q[0] !== ma && ban.has(`${i},${j}|${q[0]}`)) return true;
    }
  }
  return false;
};

let so = 0;
for (const r of to.st) {
  if (r.length < 8 || r[8]) continue; // trạm ngoài tỉnh: tên do noi-duong-day-110 vẽ, đã căn giữa
  const ma = String(r[0]);
  const [x0, y0, x1, y1] = oGoc(r);
  // chữ tiêu đề: đã đặt lần trước (lớp "Tên trạm") hoặc chữ gốc trong bản CAD
  const laTieuDe = (t) =>
    t[7] === SRC_TEN
      ? String(t[8]).endsWith(`(${ma})`)
      : String(t[8]).trim() === String(r[1]).trim() ||
        (/(^|\s)(TRẠM|SƠ ĐỒ)\s/i.test(String(t[8])) && new RegExp(`\\(?${ma.replace('.', '\\.')}\\)?\\s*$`).test(String(t[8]).trim()));
  const i = to.t.findIndex(laTieuDe);
  if (i < 0) {
    console.log(`  ! ${ma}: không thấy chữ tiêu đề "${r[1]}"`);
    continue;
  }
  // phần hình vẽ của trạm: nét / thiết bị nằm trọn trong ô trạm (bỏ đường dây, lưới trung áp, tên)
  const trong = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  let [X0, Y0, X1, Y1] = [Infinity, Infinity, -Infinity, -Infinity];
  const them = (x, y) => {
    X0 = Math.min(X0, x);
    Y0 = Math.min(Y0, y);
    X1 = Math.max(X1, x);
    Y1 = Math.max(Y1, y);
  };
  for (const b of to.b) {
    if (boQua.has(b[3])) continue;
    const p = [];
    for (let k = 4; k + 1 < b.length; k += 2) p.push([b[k], b[k + 1]]);
    if (p.every(([x, y]) => trong(x, y))) for (const [x, y] of p) them(x, y);
  }
  for (const d of to.d) if (!boQua.has(d[8]) && trong(d[3], d[4])) them(d[3], d[4]);
  if (!Number.isFinite(X0)) continue;
  // chữ của trạm (nhãn nơi đến "171 E26.1 BẮC KẠN" ở đầu ngăn lộ...) - tên đặt trên cả các chữ này
  for (let k = 0; k < to.t.length; k++) {
    const c = to.t[k];
    if (k === i || boQua.has(c[7]) || !trong(c[2], c[3]) || c[5] !== 0) continue;
    const w = String(c[8]).length * c[4] * 0.6;
    const a0 = c[6] === GIUA ? c[2] - w / 2 : c[6] === data.aligns.indexOf('right') ? c[2] - w : c[2];
    if (c[3] + c[4] > Y1 && c[3] + c[4] - Y1 < 60) them(a0, c[3] + c[4]);
  }
  const ten = chuanHoa(to.t[i][8], ma);
  const nua = (ten.length * CAO_CHU * 0.62) / 2;
  // chỗ đặt: giữa phía trên sơ đồ trạm; vướng trạm khác / lưới trung áp thì giữa phía dưới, rồi lệch
  // trái / phải phía trên
  const giua = (X0 + X1) / 2;
  // giữa phía trên sơ đồ trạm (trên cả các nhãn nơi đến); vướng hình vẽ trạm khác / lưới trung áp thì
  // giữa phía dưới. Đường dây 110kV vào ngăn lộ có chạy qua tên thì phần mềm vẽ tên trên nền che.
  const cho = [
    [giua, Y1 + KHOANG],
    [giua, Y0 - KHOANG - CAO_CHU],
  ];
  const tot = cho.find(([x, yy]) => !vuong([x - nua, yy - 4, x + nua, yy + CAO_CHU + 4], ma)) ?? cho[0];
  if (tot !== cho[0]) console.log(`  ${ma}: phía trên vướng hình vẽ khác - đặt phía dưới`);
  const cx = +tot[0].toFixed(2);
  const y = +tot[1].toFixed(2);
  const t = to.t[i];
  t[2] = cx;
  t[3] = y;
  t[4] = CAO_CHU;
  t[5] = 0;
  t[6] = GIUA;
  t[7] = SRC_TEN;
  t[8] = ten;
  // ô trạm bao lấy tên (bề ngang chữ ước 0,62 x cao mỗi ký tự)
  r[2] = cx;
  r[3] = y;
  r[4] = Math.min(x0, +(cx - nua - 10).toFixed(2));
  r[6] = Math.max(x1, +(cx + nua + 10).toFixed(2));
  r[5] = Math.min(y0, +(y - 12).toFixed(2));
  r[7] = Math.max(y1, +(y + CAO_CHU + 12).toFixed(2));
  so++;
}
writeFileSync(duongDan, JSON.stringify(data));
console.log(`Đặt lại tên ${so} trạm: căn giữa trên sơ đồ trạm, cao chữ ${CAO_CHU}.`);
