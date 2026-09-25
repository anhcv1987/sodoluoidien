/**
 * PHƯƠNG THỨC VẬN HÀNH CƠ BẢN + SỬA TÊN TRÊN SƠ ĐỒ KẾT DÂY.
 *
 *   node tools/phuong-thuc-van-hanh.mjs [src/data/tram-sld.json]
 *
 * Mọi máy cắt, dao cách ly mặc định ĐÓNG (tools/chuan-hoa-dcl-lien-dong.mjs). Các
 * thiết bị CẮT theo kết dây cơ bản của Phòng Điều độ ghi trong bảng CAT dưới đây:
 * tìm theo nhãn ngăn lộ trong đúng trạm, lấy máy cắt gần nhãn nhất. Chạy lại bao nhiêu
 * lần cũng được.
 *
 * Ngoài ra mọi dao cách ly nối thanh cái đường vòng (nhãn "xxx-9") đặt CẮT - đúng
 * phương thức bình thường; Phòng đóng lại trên phần mềm khi dùng máy cắt vòng.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Thiết bị cắt theo kết dây cơ bản: [mã trạm, nhãn ngăn lộ, ghi chú]. */
const CAT = [
  ['E6.4', '171', 'MC 171 Thịnh Đán'],
  ['E6.8', '112', 'MC 112 Xi măng Thái Nguyên'],
  ['E6.22', '171', 'MC 171 Định Hóa'],
  // Tủ phân phối 6kV của C.ty Xi măng TN nhận hai nguồn (lộ 671 từ C61, lộ 672 từ C62):
  // máy cắt liên lạc C08 thường cắt, nếu đóng thì C61 cấp ngược qua tủ khách hàng
  // sang C62 dù đã cắt MC 632, 612.
  ['E6.8', 'C08', 'MC liên lạc C08 tủ 6kV C.ty Xi măng TN'],
];

/** Sửa chữ ghi trên sơ đồ: [chữ cũ, chữ mới]. */
const DOI_CHU = [['TRẠM 110kV ĐÁN (E6.4)', 'TRẠM 110kV THỊNH ĐÁN (E6.4)']];

/** Chữ thừa từ khung tên cũ của bản CAD (đè vào khung tên mới): xoá. */
const XOA_CHU = ['SƠ ĐỐ KẾT DÂY LƯỚI ĐIỆN TỈNH THÁI NGUYÊN'];

const duongDan = resolve(process.argv[2] ?? 'src/data/tram-sld.json');
const data = JSON.parse(readFileSync(duongDan, 'utf8'));
const s = data.sheets.find((x) => x.code === 'TONG');
const tram = (x, y) => s.st.find((r) => r.length >= 8 && x >= r[4] && x <= r[6] && y >= r[5] && y <= r[7])?.[0] ?? '?';
const iMo = data.states.indexOf('mo');
const laMC = new Set(['MC', 'MCHB'].map((b) => data.blocks.indexOf(b)));

let cat = 0;
for (const [ma, nhan, ten] of CAT) {
  const t = s.t.find((t) => String(t[8]).trim() === nhan && tram(t[2], t[3]) === ma);
  if (!t) {
    console.log(`Không thấy nhãn ${nhan} trong ${ma} (${ten})`);
    continue;
  }
  let tot = null;
  for (const r of s.d) {
    if (!laMC.has(r[2])) continue;
    const d = Math.hypot(r[3] - t[2], r[4] - t[3]);
    if (d < 40 && (!tot || d < tot.d)) tot = { d, r };
  }
  if (!tot) {
    console.log(`Không thấy máy cắt cạnh nhãn ${nhan} (${ma})`);
    continue;
  }
  if (tot.r[7] !== iMo) {
    tot.r[7] = iMo;
    cat++;
  }
  console.log(`  ${ten}: CẮT`);
}

// Dao cách ly nối thanh cái ĐƯỜNG VÒNG (nhãn "xxx-9"): bình thường cắt, chỉ đóng khi
// dùng máy cắt vòng thay cho máy cắt ngăn lộ. Để đóng thì đường dây "hai đầu đã cắt"
// vẫn có điện qua thanh cái vòng.
const iDCL = data.blocks.indexOf('DCL');
let dao9 = 0;
const dsDao9 = [];
for (const t of s.t) {
  const nhan = String(t[8]).trim();
  if (!/^(\d{3}\s*)?-\s*9$/.test(nhan)) continue;
  const h = t[4];
  // tâm dòng chữ (chữ canh trái: điểm chèn ở đầu dòng)
  const cx = t[2] + (data.aligns[t[6]] === 'left' || t[6] === undefined ? nhan.length * h * 0.3 : 0);
  const cy = t[3] + h * 0.5;
  let tot = null;
  for (const r of s.d) {
    if (r[2] !== iDCL || tram(r[3], r[4]) !== tram(t[2], t[3])) continue;
    const d = Math.hypot(r[3] - cx, r[4] - cy);
    if (d <= h * 2.5 + r[6] * 0.6 && (!tot || d < tot.d)) tot = { d, r };
  }
  if (!tot) continue;
  dsDao9.push(tot.r);
  if (tot.r[7] !== iMo) {
    tot.r[7] = iMo;
    dao9++;
  }
}
console.log(`  Dao cách ly thanh cái đường vòng (-9): cắt thêm ${dao9}`);

// Thanh cái nối vào các dao -9 là THANH CÁI ĐƯỜNG VÒNG: ghi lại (theo đỉnh đầu) để
// mô hình công suất biết các ngăn lộ vẽ vắt qua nó không phải là đấu nối.
const kc = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  const L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
  return Math.hypot(ax + t * dx - px, ay + t * dy - py);
};
const iTC = data.lineKinds.indexOf('Thanh cái');
const laTC = (r) => {
  if (r[2] === iTC) return true;
  const ys = [];
  const xs = [];
  for (let k = 4; k + 1 < r.length; k += 2) (xs.push(r[k]), ys.push(r[k + 1]));
  const w = Math.max(...xs) - Math.min(...xs);
  return w > 100 && Math.max(...ys) - Math.min(...ys) < 0.5;
};
const demVong = new Map();
for (const dv of dsDao9) {
  // nét dây đi qua dao -9
  for (const r of s.b) {
    let qua = false;
    for (let k = 6; k + 1 < r.length && !qua; k += 2) qua = kc(dv[3], dv[4], r[k - 2], r[k - 1], r[k], r[k + 1]) < 0.5;
    if (!qua) continue;
    // hai đầu nét dây chạm thanh cái nào
    for (const [px, py] of [
      [r[4], r[5]],
      [r[r.length - 2], r[r.length - 1]],
    ]) {
      for (const tc of s.b) {
        if (tc === r || !laTC(tc)) continue;
        let cham = false;
        for (let k = 6; k + 1 < tc.length && !cham; k += 2) cham = kc(px, py, tc[k - 2], tc[k - 1], tc[k], tc[k + 1]) < 1;
        if (cham) demVong.set(tc, (demVong.get(tc) ?? 0) + 1);
      }
    }
  }
}
s.vong = [...demVong].filter(([, n]) => n >= 2).map(([tc]) => [tc[4], tc[5]]);
console.log(`  Thanh cái đường vòng: ${s.vong.map(([x, y]) => tram(x, y)).join(', ')}`);

let chu = 0;
for (const [cu, moi] of DOI_CHU) {
  for (const t of s.t) if (String(t[8]) === cu) (t[8] = moi), chu++;
  for (const r of s.st) if (r[1] === cu) (r[1] = moi), chu++;
}

const truoc = s.t.length;
s.t = s.t.filter((t) => !XOA_CHU.includes(String(t[8]).trim()));
chu += truoc - s.t.length;

writeFileSync(duongDan, JSON.stringify(data));
console.log(`Phương thức vận hành: đặt cắt ${cat} máy cắt; sửa ${chu} chỗ ghi tên.`);
