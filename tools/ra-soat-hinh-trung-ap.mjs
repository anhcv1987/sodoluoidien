// Rà soát hình lưới trung áp trên tờ TONG: thiết bị vẽ nghiêng, đoạn dây chéo, bậc lệch nhỏ.
//   node tools/ra-soat-hinh-trung-ap.mjs [src/data/tram-sld.json] [-v]   (-v: liệt kê từng chỗ kèm nhãn gần nhất)
// (cung vòng nhảy vẽ sẵn trong bản vẽ PDF - nhiều đoạn ngắn nối nhau - không tính)
import { readFileSync } from 'node:fs';
const f = process.argv.slice(2).find((a) => !a.startsWith('-')) ?? 'src/data/tram-sld.json';
const d = JSON.parse(readFileSync(f, 'utf8'));
const t = d.sheets.find((s) => s.code === 'TONG');
const src = d.srcLayers.indexOf('Lưới trung áp');
const nhay = new Set((t.nhay ?? []).map(String));
const T = t.t.filter((r) => r[7] === src);
const gan = (x, y) => { let b = null, bd = 1e9; for (const q of T) { const dd = Math.hypot(q[2] - x, q[3] - y); if (dd < bd) { bd = dd; b = q; } } return b?.[8]; };
const TEN = { 18: 'REC', 19: 'LBS', 20: 'DCL' };
const nghieng = t.d.filter((r) => r[8] === src && TEN[r[2]] && (() => { const m = ((r[5] % 90) + 90) % 90; return !(m < 0.5 || m > 89.5); })());
// đoạn chéo / bậc lệch trên các nét trung áp (bỏ vòng nhảy: nét ngắn cong)
let cheo = [], bac = [];
t.b.forEach((r, i) => {
  if (r[3] !== src) return;
  const P = [];
  for (let k = 4; k + 1 < r.length; k += 2) P.push([r[k], r[k + 1]]);
  if (P.length > 6 && P.every((p, k) => k === 0 || Math.hypot(p[0] - P[k - 1][0], p[1] - P[k - 1][1]) < 3)) return; // cung vòng nhảy
  for (let k = 1; k < P.length; k++) {
    const dx = Math.abs(P[k][0] - P[k - 1][0]), dy = Math.abs(P[k][1] - P[k - 1][1]);
    if (dx > 0.3 && dy > 0.3 && Math.hypot(dx, dy) > 1.5) cheo.push([(P[k][0] + P[k - 1][0]) / 2, (P[k][1] + P[k - 1][1]) / 2, dx, dy]);
  }
  // bậc lệch: ngang dài - dọc ngắn (<= 8) - ngang dài cùng chiều (hoặc dọc - ngang ngắn - dọc)
  for (let k = 1; k + 2 < P.length; k++) {
    const [a, b, c, e] = [P[k - 1], P[k], P[k + 1], P[k + 2]];
    for (const h of [0, 1]) {
      const v = 1 - h;
      const L1 = b[h] - a[h], L3 = e[h] - c[h];
      if (Math.abs(a[v] - b[v]) > 0.3 || Math.abs(c[v] - e[v]) > 0.3 || Math.abs(b[h] - c[h]) > 0.3) continue;
      const st = Math.abs(c[v] - b[v]);
      if (st > 0.3 && st <= 8 && Math.abs(L1) > 15 && Math.abs(L3) > 15 && Math.sign(L1) === Math.sign(L3)) bac.push([b[0], b[1], st]);
    }
  }
});
console.log(`thiết bị nghiêng: ${nghieng.length} | đoạn chéo: ${cheo.length} | bậc lệch nhỏ (<= 8): ${bac.length}`);
if (process.argv.includes('-v')) {
  for (const r of nghieng) console.log('  nghiêng', TEN[r[2]], r[5].toFixed(0), Math.round(r[3]), Math.round(r[4]), gan(r[3], r[4]));
  for (const c of cheo.slice(0, 400)) console.log('  chéo', Math.round(c[0]), Math.round(c[1]), c[2].toFixed(1), c[3].toFixed(1), gan(c[0], c[1]));
  for (const c of bac) console.log('  bậc', Math.round(c[0]), Math.round(c[1]), c[2].toFixed(1), gan(c[0], c[1]));
}
