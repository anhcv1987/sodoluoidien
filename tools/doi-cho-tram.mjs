/**
 * DỜI CHỖ TRẠM TRÊN TỜ SƠ ĐỒ KẾT DÂY THEO tools/vi-tri-tram.mjs.
 *
 *     node tools/doi-cho-tram.mjs [src/data/tram-sld.json]      (XEM=1: chỉ in phần được chọn)
 *
 * Dời mọi nét, thiết bị, vòng tròn, chữ của trạm (tâm nằm trong hộp chọn), tên trạm trong danh mục
 * (ô trạm lấy đúng hộp chọn đã dời), cờ vòng / cuộn MBA đi theo. Độ dời đã áp lưu ở tờ TONG (doiTram) nên chạy lại nhiều lần chỉ dời
 * phần chênh. Không đụng tới phần do công cụ khác vẽ lại (đường dây 110kV, trạm ngoài tỉnh, lưới
 * trung áp) - sau khi dời chạy lại: ve-luoi-trung-ap -> noi-duong-day-110 -> ve-luoi-trung-ap.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DOI_TRAM, tron } from './vi-tri-tram.mjs';

const duongDan = resolve(process.argv[2] ?? 'src/data/tram-sld.json');
const data = JSON.parse(readFileSync(duongDan, 'utf8'));
const to = data.sheets.find((s) => s.code === 'TONG');
const xem = !!process.env.XEM;
const boQua = new Set(['Kết lưới 110kV', 'Trạm ngoài tỉnh', 'Lưới trung áp'].map((t) => data.srcLayers.indexOf(t)));

const daDoi = to.doiTram ?? {};
const trong = ([x0, y0, x1, y1], [x, y]) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
const tamB = (r) => {
  let [a, b, c, d] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let k = 4; k + 1 < r.length; k += 2) {
    a = Math.min(a, r[k]);
    b = Math.min(b, r[k + 1]);
    c = Math.max(c, r[k]);
    d = Math.max(d, r[k + 1]);
  }
  return [(a + c) / 2, (b + d) / 2, a, b, c, d];
};

const ma = new Set([...Object.keys(DOI_TRAM), ...Object.keys(daDoi)]);
for (const k of ma) {
  const cu = daDoi[k] ?? [0, 0];
  const moi = DOI_TRAM[k]?.doi ?? [0, 0];
  const chon0 = DOI_TRAM[k]?.chon;
  if (!chon0) throw new Error(`${k}: đã dời nhưng không còn hộp chọn trong vi-tri-tram.mjs`);
  const chon = [chon0[0] + cu[0], chon0[1] + cu[1], chon0[2] + cu[0], chon0[3] + cu[1]];
  const [dx, dy] = [moi[0] - cu[0], moi[1] - cu[1]];
  const X = (v) => tron(v + dx);
  const Y = (v) => tron(v + dy);
  const dem = { b: 0, d: 0, t: 0, c: 0 };
  const vuot = [];
  for (const r of to.b) {
    if (boQua.has(r[3])) continue;
    const [cx, cy, a, b, c, d] = tamB(r);
    if (!trong(chon, [cx, cy])) continue;
    dem.b++;
    if (a < chon[0] - 20 || b < chon[1] - 20 || c > chon[2] + 20 || d > chon[3] + 20) vuot.push(`  nét ${data.srcLayers[r[3]]} ${[a, b, c, d].map(Math.round).join(',')}`);
    if (xem) continue;
    for (let q = 4; q + 1 < r.length; q += 2) [r[q], r[q + 1]] = [X(r[q]), Y(r[q + 1])];
  }
  for (const r of to.d) {
    if (boQua.has(r[8]) || !trong(chon, [r[3], r[4]])) continue;
    dem.d++;
    if (!xem) [r[3], r[4]] = [X(r[3]), Y(r[4])];
  }
  for (const r of to.t) {
    if (boQua.has(r[7]) || !trong(chon, [r[2], r[3]])) continue;
    dem.t++;
    if (!xem) [r[2], r[3]] = [X(r[2]), Y(r[3])];
  }
  for (const r of to.c ?? []) {
    if (boQua.has(r[5]) || !trong(chon, [r[2], r[3]])) continue;
    dem.c++;
    if (!xem) [r[2], r[3]] = [X(r[2]), Y(r[3])];
  }
  for (const key of ['vong', 'kvCuon']) for (const p of to[key] ?? []) if (trong(chon, p) && !xem) [p[0], p[1]] = [X(p[0]), Y(p[1])];
  const st = to.st.find((r) => r[0] === k);
  const khac = to.st.filter((r) => r[0] !== k && trong(chon, [r[2], r[3]])).map((r) => r[0]);
  if (!xem && st) {
    [st[2], st[3]] = [X(st[2]), Y(st[3])];
    // ô trạm trong bản CAD vẽ rộng, chồng sang trạm bên cạnh: lấy đúng hộp chọn (phần có hình vẽ)
    [st[4], st[5], st[6], st[7]] = [chon0[0] + moi[0], chon0[1] + moi[1], chon0[2] + moi[0], chon0[3] + moi[1]];
  }
  daDoi[k] = moi;
  console.log(`${k}: dời [${dx}, ${dy}] (tổng [${moi}]) - ${dem.b} nét, ${dem.d} thiết bị, ${dem.t} chữ, ${dem.c} vòng tròn${khac.length ? ' | tên trạm khác trong hộp: ' + khac.join(', ') : ''}`);
  if (xem) vuot.forEach((v) => console.log(v));
}
if (!xem) {
  for (const k of Object.keys(daDoi)) if (!daDoi[k][0] && !daDoi[k][1]) delete daDoi[k];
  to.doiTram = daDoi;
  writeFileSync(duongDan, JSON.stringify(data));
}
