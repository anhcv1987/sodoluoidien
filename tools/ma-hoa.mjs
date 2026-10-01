/**
 * MÃ HOÁ BẢN PHÁT HÀNH - chỉ máy đã được cấp quyền mới mở được phần mềm.
 *
 * Chạy sau `vite build` (npm run build tự gọi): lấy toàn bộ mã + dữ liệu trong dist/index.html,
 * nén gzip rồi mã hoá AES-256-GCM. File phát hành chỉ còn màn hình KÍCH HOẠT:
 *  - máy chưa kích hoạt: hiện mã máy, quản trị nhập MẬT KHẨU KÍCH HOẠT -> giải mã được thì lưu khoá
 *    (dạng không xuất ra được) trong IndexedDB của trình duyệt máy đó;
 *  - máy đã kích hoạt: tự giải mã và mở phần mềm, không phải nhập lại;
 *  - mang file sang máy khác / gửi ra ngoài: chỉ thấy màn hình kích hoạt, dữ liệu là chuỗi mã hoá.
 *
 * Khoá = PBKDF2-SHA256(mật khẩu kích hoạt, muối cố định, 600 000 vòng). Muối cố định nên các bản cập
 * nhật sau vẫn mở được trên máy đã kích hoạt; đổi mật khẩu kích hoạt thì mọi máy phải kích hoạt lại.
 *
 *   MAT_KHAU_KICH_HOAT='...' node tools/ma-hoa.mjs [dist/index.html]
 * Mật khẩu kích hoạt KHÔNG ghi trong mã nguồn: bắt buộc đặt biến môi trường MAT_KHAU_KICH_HOAT khi
 * build bản phát hành (thiếu thì dừng, không xuất bản chưa mã hoá).
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import { webcrypto as wc } from 'node:crypto';

const FILE = process.argv[2] ?? 'dist/index.html';
const MAT_KHAU = process.env.MAT_KHAU_KICH_HOAT ?? '';
if (MAT_KHAU.length < 6) {
  console.error('Chưa đặt MAT_KHAU_KICH_HOAT (>= 6 ký tự) - không mã hoá được bản phát hành. dist/index.html CHƯA MÃ HOÁ, không phát hành file này.');
  process.exit(1);
}
const MUOI = 'sodoluoidien|PCTN-PhongDieuDo|kich-hoat-v1';
const VONG = 600000;

const html = fs.readFileSync(FILE, 'utf8');
if (html.includes('id="goi-ma-hoa"')) {
  console.log(`${FILE} đã mã hoá rồi - bỏ qua.`);
  process.exit(0);
}
const MO = '<script type="module" crossorigin>';
const a = html.indexOf(MO);
const b = html.lastIndexOf('</script>');
if (a < 0 || b < a) throw new Error('Không tìm thấy mã chương trình trong ' + FILE);
const ma = html.slice(a + MO.length, b);
const vo = html.slice(0, a) + html.slice(b + '</script>'.length);

const enc = new TextEncoder();
const goc = await wc.subtle.importKey('raw', enc.encode(MAT_KHAU), 'PBKDF2', false, ['deriveKey']);
const khoa = await wc.subtle.deriveKey(
  { name: 'PBKDF2', salt: enc.encode(MUOI), iterations: VONG, hash: 'SHA-256' },
  goc,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt'],
);
const iv = wc.getRandomValues(new Uint8Array(12));
const nen = zlib.gzipSync(Buffer.from(ma, 'utf8'), { level: 9 });
const mh = new Uint8Array(await wc.subtle.encrypt({ name: 'AES-GCM', iv }, khoa, nen));
const goi = Buffer.concat([Buffer.from(iv), Buffer.from(mh)]).toString('base64');

const loader = fs.readFileSync(new URL('./kich-hoat-loader.js', import.meta.url), 'utf8')
  .replace('__MUOI__', JSON.stringify(MUOI))
  .replace('__VONG__', String(VONG));

const ra = vo.replace(
  '</body>',
  `<script id="goi-ma-hoa" type="application/octet-stream">${goi}</script>\n<script>${loader}</script>\n</body>`,
);
fs.writeFileSync(FILE, ra);
console.log(
  `Đã mã hoá ${FILE}: mã ${(ma.length / 1024).toFixed(0)} KB -> nén ${(nen.length / 1024).toFixed(0)} KB -> file ${(ra.length / 1024).toFixed(0)} KB`,
);
