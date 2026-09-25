/**
 * BỎ HAI NÉT THỪA Ở ĐẦU TRẠM 110kV (KÝ HIỆU "3 ĐOẠN THẲNG").
 *
 *   node tools/bo-net-dau-tram.mjs [src/data/tram-sld.json]
 *
 * Bản CAD vẽ đầu ra đường dây của ngăn lộ 110kV bằng ba nét song song: nét giữa là
 * dây dẫn đi xuống ngăn lộ, hai nét ngắn hai bên chỉ là ký hiệu. Khi nối đường dây
 * giữa các trạm, có chỗ đường dây bắt nhầm vào nét bên (vd lộ 171 E6.8 Xi măng Thái
 * Nguyên) nên trạm không nối được vào lưới. Công cụ này:
 *   1. tìm các bộ ba nét song song cùng đầu mút, nét giữa dài hơn và đi tiếp vào
 *      ngăn lộ, hai nét bên ngắn, cách đều nét giữa - xoá hai nét bên;
 *   2. đường dây liên trạm nào đang bắt vào nét bên thì dời đầu dây sang nét giữa.
 * Chạy lại bao nhiêu lần cũng được.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const duongDan = resolve(process.argv[2] ?? 'src/data/tram-sld.json');
const data = JSON.parse(readFileSync(duongDan, 'utf8'));
const s = data.sheets.find((x) => x.code === 'TONG');
const tram = (x, y) => s.st.find((r) => r.length >= 8 && x >= r[4] && x <= r[6] && y >= r[5] && y <= r[7])?.[0] ?? '?';
const SRC_KET_LUOI = data.srcLayers.indexOf('Kết lưới 110kV');
const E = 0.05;

// Nét thẳng (2 hoặc 3 đỉnh thẳng hàng) nằm dọc hoặc ngang, cấp 110kV, không phải đường liên trạm
const net = [];
s.b.forEach((r, i) => {
  if (r[1] !== 110 || r[3] === SRC_KET_LUOI) return;
  const xs = [];
  const ys = [];
  for (let k = 4; k + 1 < r.length; k += 2) {
    xs.push(r[k]);
    ys.push(r[k + 1]);
  }
  const doc = Math.max(...xs) - Math.min(...xs) < E;
  const ngang = Math.max(...ys) - Math.min(...ys) < E;
  if (!doc && !ngang) return;
  // toạ độ theo trục (a) và vị trí ngang trục (c)
  const a = doc ? ys : xs;
  const c = doc ? xs[0] : ys[0];
  net.push({ i, doc, c, a0: Math.min(...a), a1: Math.max(...a), L: Math.max(...a) - Math.min(...a) });
});

const xoa = new Set();
const doiDau = []; // [đầu cũ x,y, đầu mới x,y]
let bo = 0;
for (const g of net) {
  if (g.L < 20) continue; // nét giữa phải đi tiếp vào ngăn lộ
  for (const dauG of ['a0', 'a1']) {
    const muc = g[dauG];
    // hai nét bên: cùng hướng, cùng đầu mút, ngắn, lệch hai phía đều nhau
    const ben = net.filter(
      (h) =>
        h !== g &&
        h.doc === g.doc &&
        !xoa.has(h.i) &&
        Math.abs(h.c - g.c) > 1 &&
        Math.abs(h.c - g.c) < 12 &&
        h.L < g.L * 0.6 &&
        h.L < 40 &&
        Math.abs(h[dauG] - muc) < 0.2,
    );
    const trai = ben.filter((h) => h.c < g.c);
    const phai = ben.filter((h) => h.c > g.c);
    let cap = null;
    for (const t of trai) for (const p of phai) if (Math.abs(g.c - t.c - (p.c - g.c)) < 0.3 && Math.abs(t.L - p.L) < 0.5) cap = [t, p];
    if (!cap) continue;
    for (const h of cap) {
      xoa.add(h.i);
      const dau = g.doc ? [h.c, muc] : [muc, h.c];
      const moi = g.doc ? [g.c, muc] : [muc, g.c];
      doiDau.push([dau, moi]);
    }
    bo++;
    console.log(`  ${tram(g.doc ? g.c : muc, g.doc ? muc : g.c)}: đầu dây (${(g.doc ? g.c : muc).toFixed(1)}, ${(g.doc ? muc : g.c).toFixed(1)})`);
  }
}

// Dời đầu đường dây liên trạm đang bắt vào nét bên
let doi = 0;
s.b.forEach((r) => {
  if (r[3] !== SRC_KET_LUOI) return;
  const n = r.length;
  for (const [kx, ky, kx2, ky2] of [
    [4, 5, 6, 7],
    [n - 2, n - 1, n - 4, n - 3],
  ]) {
    const hit = doiDau.find(([dau]) => Math.hypot(r[kx] - dau[0], r[ky] - dau[1]) < 0.3);
    if (!hit) continue;
    const [dau, moi] = hit;
    const dx = moi[0] - dau[0];
    const dy = moi[1] - dau[1];
    // đoạn cuối vuông góc với ký hiệu: dời cả đỉnh kề cho đoạn cuối vẫn thẳng
    const doc = Math.abs(r[kx2] - r[kx]) < E;
    const ngang = Math.abs(r[ky2] - r[ky]) < E;
    r[kx] += dx;
    r[ky] += dy;
    if (doc && dx) r[kx2] += dx;
    if (ngang && dy) r[ky2] += dy;
    doi++;
  }
});

s.b = s.b.filter((_, i) => !xoa.has(i));
writeFileSync(duongDan, JSON.stringify(data));
console.log(`Đầu trạm 110kV: bỏ ${xoa.size} nét thừa ở ${bo} đầu dây; dời ${doi} đầu đường dây liên trạm sang nét giữa.`);
