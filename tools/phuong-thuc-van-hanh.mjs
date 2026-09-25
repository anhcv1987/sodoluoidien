/**
 * PHƯƠNG THỨC VẬN HÀNH CƠ BẢN + SỬA TÊN TRÊN SƠ ĐỒ KẾT DÂY.
 *
 *   node tools/phuong-thuc-van-hanh.mjs [src/data/tram-sld.json]
 *
 * Mọi máy cắt, dao cách ly mặc định ĐÓNG (tools/chuan-hoa-dcl-lien-dong.mjs). Các
 * thiết bị CẮT theo kết dây cơ bản của Phòng Điều độ ghi trong bảng CAT dưới đây:
 * tìm theo nhãn ngăn lộ trong đúng trạm, lấy máy cắt gần nhãn nhất. Chạy lại bao nhiêu
 * lần cũng được.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Thiết bị cắt theo kết dây cơ bản: [mã trạm, nhãn ngăn lộ, ghi chú]. */
const CAT = [
  ['E6.4', '171', 'MC 171 Thịnh Đán'],
  ['E6.8', '112', 'MC 112 Xi măng Thái Nguyên'],
  ['E6.22', '171', 'MC 171 Định Hóa'],
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
