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
// Khúc vòng vô lý trên tuyến (nối các nét trung áp liền nhau thành tuyến - kể cả dây liên thông):
//  - chữ U: đang đi thẳng, lệch ra <= 30 chạy song song <= 80 rồi quay về đúng tuyến cũ
//  - kẹp tóc (chữ C): đi một đoạn, rẽ ngắn (<= 25), quay ngược chiều chạy song song đoạn vừa đi
//  - răng cưa: >= 3 lần rẽ bằng các đoạn ngắn (< 10) trong quãng <= 40, hai đầu quãng thẳng hàng
const vong = [], kep = [], cua = [];
{
  const R = t.b.filter((r) => r[3] === src && [6, 10, 22, 35].includes(r[1])).map((r) => { const P = []; for (let k = 4; k + 1 < r.length; k += 2) P.push([r[k], r[k + 1]]); return P; });
  const kh = (p) => `${Math.round(p[0] * 10)}|${Math.round(p[1] * 10)}`;
  const bac = new Map();
  for (const P of R) for (const q of [P[0], P.at(-1)]) bac.set(kh(q), (bac.get(kh(q)) ?? 0) + 1);
  // nối các nét qua đầu mút bậc 2 (chỗ không rẽ nhánh)
  const dau = new Map();
  R.forEach((P, i) => { for (const q of [P[0], P.at(-1)]) { const k = kh(q); if (!dau.has(k)) dau.set(k, []); dau.get(k).push(i); } });
  const dung = new Set(), tuyen = [];
  const noi = (i0) => {
    let P = [...R[i0]]; dung.add(i0);
    for (const cuoi of [true, false]) {
      for (;;) {
        const q = cuoi ? P.at(-1) : P[0];
        if (bac.get(kh(q)) !== 2) break;
        const j = dau.get(kh(q)).find((x) => !dung.has(x));
        if (j == null) break;
        dung.add(j);
        let Q = R[j];
        if (kh(Q[0]) !== kh(q)) Q = [...Q].reverse();
        P = cuoi ? [...P, ...Q.slice(1)] : [...[...Q].reverse().slice(0, -1), ...P];
      }
    }
    return P;
  };
  R.forEach((_, i) => { if (!dung.has(i)) tuyen.push(noi(i)); });
  for (const Q of tuyen) {
    if (Q.length > 6 && Q.every((p, k) => k === 0 || Math.hypot(p[0] - Q[k - 1][0], p[1] - Q[k - 1][1]) < 3)) continue; // cung vòng nhảy
    // cung vòng nhảy (>= 4 đoạn ngắn < 3.5 liền nhau) thay bằng dây cung
    const Q2 = [Q[0]];
    for (let k = 1; k < Q.length;) {
      let m = k;
      while (m < Q.length && Math.hypot(Q[m][0] - Q[m - 1][0], Q[m][1] - Q[m - 1][1]) < 3.5) m++;
      if (m - k >= 4) { Q2.push(Q[m - 1]); k = m; } else { Q2.push(Q[k]); k++; }
    }
    // gộp đỉnh trùng / thẳng hàng
    const P = [Q2[0]];
    for (let k = 1; k < Q2.length; k++) {
      const q = Q2[k], a = P.at(-1);
      if (Math.hypot(q[0] - a[0], q[1] - a[1]) < 0.3) continue;
      if (P.length >= 2) { const o = P.at(-2); if (Math.abs((a[0] - o[0]) * (q[1] - o[1]) - (a[1] - o[1]) * (q[0] - o[0])) < 0.3 * Math.hypot(q[0] - o[0], q[1] - o[1]) && (a[0] - o[0]) * (q[0] - a[0]) + (a[1] - o[1]) * (q[1] - a[1]) > 0) { P[P.length - 1] = q; continue; } }
      P.push(q);
    }
    const ph = (a, b) => (Math.abs(a[1] - b[1]) < 0.3 ? 0 : Math.abs(a[0] - b[0]) < 0.3 ? 1 : -1);
    const dx = (a, b, h) => b[h] - a[h];
    for (let k = 0; k + 3 < P.length; k++) {
      const [A, B, C, D] = [P[k], P[k + 1], P[k + 2], P[k + 3]];
      const h = ph(A, B);
      if (h < 0 || ph(B, C) !== 1 - h || ph(C, D) !== h) continue;
      const u1 = dx(A, B, h), u3 = dx(C, D, h), w = Math.abs(dx(B, C, 1 - h));
      if (Math.sign(u1) === -Math.sign(u3) && w <= 25 && Math.min(Math.abs(u1), Math.abs(u3)) >= 10) kep.push([(B[0] + C[0]) / 2, (B[1] + C[1]) / 2, w]);
    }
    for (let k = 0; k + 5 < P.length; k++) {
      const [A, B, C, D, E, F] = P.slice(k, k + 6);
      const h = ph(A, B);
      if (h < 0 || ph(B, C) !== 1 - h || ph(C, D) !== h || ph(D, E) !== 1 - h || ph(E, F) !== h) continue;
      const s = Math.sign(dx(A, B, h));
      if (Math.sign(dx(C, D, h)) !== s || Math.sign(dx(E, F, h)) !== s) continue;
      const sau = dx(B, C, 1 - h);
      if (Math.abs(sau + dx(D, E, 1 - h)) < 0.5 && Math.abs(sau) <= 30 && Math.abs(dx(C, D, h)) <= 80) vong.push([(C[0] + D[0]) / 2, (C[1] + D[1]) / 2, Math.abs(sau)]);
    }
    for (let k = 0; k + 1 < P.length; k++) {
      // (rẽ gắt >= 45 độ - cung vòng nhảy rẽ từng nấc nhỏ không tính)
      const goc = (a, b, c) => { const u = [b[0] - a[0], b[1] - a[1]], v = [c[0] - b[0], c[1] - b[1]]; return Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v) || 1)))); };
      let m = k, L = 0, re = 0;
      while (m + 2 < P.length && Math.hypot(P[m + 1][0] - P[m][0], P[m + 1][1] - P[m][1]) < 12 && L < 50) {
        L += Math.hypot(P[m + 1][0] - P[m][0], P[m + 1][1] - P[m][1]);
        if (goc(P[m], P[m + 1], P[m + 2]) >= Math.PI / 4) re++;
        m++;
      }
      if (re >= 3 && L < 50) { cua.push([P[k][0], P[k][1], re]); k = m; }
    }
  }
}
// bỏ các chỗ trong khung tủ RMU (hình vẽ ngăn tủ, ký hiệu tiếp địa -76 ...): khung = nét kín chữ nhật
{
  const khung = [];
  for (const r of t.b) {
    if (r[3] !== src || r.length !== 14 || Math.abs(r[4] - r[12]) > 0.01 || Math.abs(r[5] - r[13]) > 0.01) continue;
    const xs = [r[4], r[6], r[8], r[10]], ys = [r[5], r[7], r[9], r[11]];
    const h = [Math.min(...xs) - 4, Math.min(...ys) - 4, Math.max(...xs) + 4, Math.max(...ys) + 4];
    if (h[2] - h[0] > 28 && h[3] - h[1] > 28) khung.push(h);
  }
  const ngoai = (c) => !khung.some((h) => c[0] >= h[0] && c[0] <= h[2] && c[1] >= h[1] && c[1] <= h[3]);
  for (const ds of [vong, kep, cua]) { const g = ds.filter(ngoai); ds.length = 0; ds.push(...g); }
}
console.log(`thiết bị nghiêng: ${nghieng.length} | đoạn chéo: ${cheo.length} | bậc lệch nhỏ (<= 8): ${bac.length} | chữ U: ${vong.length} | kẹp tóc: ${kep.length} | răng cưa: ${cua.length}`);
if (process.argv.includes('-v')) {
  for (const c of vong) console.log('  chữ U', Math.round(c[0]), Math.round(c[1]), 'sâu', c[2].toFixed(1), gan(c[0], c[1]));
  for (const c of kep) console.log('  kẹp tóc', Math.round(c[0]), Math.round(c[1]), 'rộng', c[2].toFixed(1), gan(c[0], c[1]));
  for (const c of cua) console.log('  răng cưa', Math.round(c[0]), Math.round(c[1]), c[2], gan(c[0], c[1]));
  for (const r of nghieng) console.log('  nghiêng', TEN[r[2]], r[5].toFixed(0), Math.round(r[3]), Math.round(r[4]), gan(r[3], r[4]));
  for (const c of cheo.slice(0, 400)) console.log('  chéo', Math.round(c[0]), Math.round(c[1]), c[2].toFixed(1), c[3].toFixed(1), gan(c[0], c[1]));
  for (const c of bac) console.log('  bậc', Math.round(c[0]), Math.round(c[1]), c[2].toFixed(1), gan(c[0], c[1]));
}
