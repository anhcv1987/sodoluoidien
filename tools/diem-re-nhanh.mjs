/**
 * ĐIỂM ĐẤU RẼ NHÁNH: chấm tròn tô đặc ở mọi chỗ đường dây rẽ nhánh (chữ T) trên tờ sơ đồ kết dây tổng.
 *
 *   node tools/diem-re-nhanh.mjs [src/data/tram-sld.json]
 *
 * Lấy đúng các ĐỈNH ĐẤU NỐI của mô hình kết lưới / chiều công suất (src/core/dongCongSuat.ts): đỉnh có
 * từ 3 hướng dây trở lên gặp nhau, thuộc ít nhất hai nét khác nhau - chỗ dây chỉ giao chéo (không đấu)
 * thì không chấm. Phạm vi: đường dây ngoài trạm (lưới trung áp, đường dây 110kV) và chỗ lưới trung áp
 * đấu vào đầu ra ngăn lộ. Bỏ qua: đấu nối bên trong ô trạm theo bản CAD gốc, thanh cái, cực thiết bị.
 *
 * Chấm cột rỗng sẵn có của lưới trung áp nằm đúng điểm rẽ thì tô đặc chấm đó (không vẽ chồng).
 * Số cột: điểm rẽ trung áp chưa có số cột bên cạnh thì ghi chữ số cột sát điểm đó trên bản vẽ PDF gốc
 * ("cot_le" do tools/pdf-lo/xuat.py ghi, đổi toạ độ theo tools/luoi-trung-ap/pdf/vi-tri.json).
 * Chạy lại được: xoá chấm của lần trước (lớp CAD gốc "Điểm rẽ nhánh") rồi tính lại. Chạy sau
 * ve-luoi-trung-ap.mjs và noi-duong-day-110.mjs.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const duongDan = resolve(process.argv[2] ?? 'src/data/tram-sld.json');
const tmp = mkdtempSync(join(tmpdir(), 'rn-'));
const bundle = join(tmp, 'cs.mjs');
execFileSync('npx', ['esbuild', 'src/core/dongCongSuat.ts', '--bundle', '--format=esm', '--platform=node', `--outfile=${bundle}`, '--log-level=warning'], {
  stdio: 'inherit',
});
const { tinhDongCongSuat } = await import(pathToFileURL(bundle).href);
rmSync(tmp, { recursive: true, force: true });

const data = JSON.parse(readFileSync(duongDan, 'utf8'));
const s = data.sheets.find((x) => x.code === 'TONG');
const idx = (arr, v) => {
  let i = arr.indexOf(v);
  if (i < 0) i = arr.push(v) - 1;
  return i;
};
const SRC_RN = idx(data.srcLayers, 'Điểm rẽ nhánh');
const SRC_LTA = data.srcLayers.indexOf('Lưới trung áp');
const SRC_110 = data.srcLayers.indexOf('Kết lưới 110kV');

// xoá chấm lần trước; bỏ cờ tô đặc đã đặt cho chấm cột lưới trung áp
s.c = (s.c ?? []).filter((r) => r[5] !== SRC_RN);
s.t = s.t.filter((r) => r[7] !== SRC_RN);
for (const r of s.c) if (r[5] === SRC_LTA && r.length > 6) r.length = 6;

/* ---------- mô hình (dựng giống tools/ra-soat-noi-trung-ap.mjs) ---------- */
const nhay = new Set((s.nhay ?? []).map(([x, y]) => `${x}|${y}`));
const vong = new Set((s.vong ?? []).map(([x, y]) => `${x}|${y}`));
const diem = new Map();
const ents = [];
s.b.forEach((r, i) => {
  const nodes = [];
  for (let k = 4; k + 1 < r.length; k += 2) {
    const id = `n${i}_${k}`;
    diem.set(id, { x: r[k], y: r[k + 1] });
    nodes.push(id);
  }
  const b = { id: `b${i}`, kind: 'branch', layer: data.layers[r[0]], kv: r[1], nodes, lineKind: data.lineKinds[r[2]], srcLayer: data.srcLayers[r[3]] };
  if (r[3] === SRC_110 || nhay.has(`${r[4]}|${r[5]}`)) b.khongNoiGiua = true;
  if (vong.has(`${r[4]}|${r[5]}`)) b.vong = true;
  ents.push(b);
});
s.d.forEach((r, i) =>
  ents.push({ id: `d${i}`, kind: 'device', layer: data.layers[r[0]], kv: r[1], block: data.blocks[r[2]], p: { x: r[3], y: r[4] }, rot: r[5], scale: r[6], state: data.states[r[7]], mirror: !!r[9] }),
);
s.c.forEach((r, i) => ents.push({ id: `c${i}`, kind: 'circle', layer: data.layers[r[0]], kv: r[1], c: { x: r[2], y: r[3] }, r: r[4] }));
const g = tinhDongCongSuat(ents, (id) => diem.get(id)).doThi;

/* ---------- đỉnh rẽ nhánh ---------- */
const nV = g.vx.length;
const bac = new Int32Array(nV);
const bacTC = new Int32Array(nV);
const net = Array.from({ length: nV }, () => new Set());
const kvDinh = new Int32Array(nV);
// ký hiệu vẽ bằng đường của bản CAD, không phải dây rẽ nhánh: nét kín nhỏ (tam giác...), nét rất ngắn
// (mũi tên đầu ra lộ), lưỡi dao cách ly vẽ bằng một nét xiên ngắn
const kyHieu = (r) => {
  if (r[3] === SRC_LTA) return false;
  const n = r.length;
  let dai = 0;
  for (let k = 6; k + 1 < n; k += 2) dai += Math.hypot(r[k] - r[k - 2], r[k + 1] - r[k - 1]);
  if (dai < 10) return true;
  const xs = r.slice(4).filter((_, k) => k % 2 === 0);
  const ys = r.slice(4).filter((_, k) => k % 2 === 1);
  if (n >= 10 && Math.hypot(r[4] - r[n - 2], r[5] - r[n - 1]) < 0.01)
    return Math.max(...xs) - Math.min(...xs) < 15 && Math.max(...ys) - Math.min(...ys) < 15;
  if (n === 8 && dai < 25) {
    const goc = (Math.atan2(Math.abs(r[7] - r[5]), Math.abs(r[6] - r[4])) * 180) / Math.PI;
    return goc > 5 && goc < 85;
  }
  return false;
};
const boKH = g.veU.map((_, i) => kyHieu(s.b[+g.veNhanh[i].slice(1)]));
const bac0 = new Int32Array(nV);
g.veU.forEach((u, i) => {
  if (!boKH[i]) bac0[u]++, bac0[g.veV[i]]++;
});
// đoạn xiên ngắn (dây thật trên sơ đồ đi ngang/dọc): lưỡi dao cách ly có đầu bỏ lửng, nét mũi tên
const boDoan = (i) => {
  if (boKH[i]) return true;
  const u = g.veU[i];
  const v = g.veV[i];
  const dx = Math.abs(g.vx[v] - g.vx[u]);
  const dy = Math.abs(g.vy[v] - g.vy[u]);
  const goc = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (goc < 5 || goc > 85) return false;
  const dai = Math.hypot(dx, dy);
  if (dai < 30 && (bac0[u] === 1 || bac0[v] === 1)) return true;
  return dai < 10 && s.b[+g.veNhanh[i].slice(1)][3] !== SRC_LTA;
};
const huong = Array.from({ length: nV }, () => new Set());
for (let i = 0; i < g.veU.length; i++) {
  if (boDoan(i)) continue;
  for (const [v, w] of [[g.veU[i], g.veV[i]], [g.veV[i], g.veU[i]]]) {
    // hướng dây rời đỉnh (làm tròn 5°): nét vẽ trùng không tính là rẽ nhánh
    huong[v].add((Math.round((Math.atan2(g.vy[w] - g.vy[v], g.vx[w] - g.vx[v]) * 36) / Math.PI) + 72) % 72);
  }
  for (const v of [g.veU[i], g.veV[i]]) {
    bac[v]++;
    if (g.veThanhCai[i]) bacTC[v]++;
    net[v].add(+g.veNhanh[i].slice(1));
    kvDinh[v] = Math.max(kvDinh[v], g.veKv[i]);
  }
}
const cuc = new Set();
for (const ds of g.cucTB.values()) for (const v of ds) cuc.add(v);
const trongTram = (x, y) => (s.st ?? []).some((t) => x >= t[4] && x <= t[6] && y >= t[5] && y <= t[7]);

const tamTB = s.d.map((r) => [r[3], r[4]]);
let them = 0;
let toDac = 0;
const daCham = [];
for (let v = 0; v < nV; v++) {
  if (huong[v].size < 3 || bacTC[v] > 0 || cuc.has(v) || net[v].size < 2) continue;
  const nguon = [...net[v]].map((i) => s.b[i][3]);
  const coLTA = nguon.includes(SRC_LTA);
  const x = g.vx[v];
  const y = g.vy[v];
  // ngoài trạm: mọi đường dây; trong ô trạm: chỉ chỗ có nét lưới trung áp (đấu ra ngăn lộ)
  if (trongTram(x, y) && !coLTA) continue;
  if (tamTB.some(([a, b]) => Math.abs(a - x) < 0.3 && Math.abs(b - y) < 0.3)) continue; // giữa thân thiết bị
  if (daCham.some(([a, b]) => Math.hypot(a - x, b - y) < 2.5)) continue;
  daCham.push([x, y]);
  const kv = kvDinh[v];
  const r = kv >= 110 ? 1.8 : 1.3;
  // chấm sẵn có ngay đó (chấm cột lưới trung áp, chấm của bản CAD)
  const gan = s.c.find((c) => Math.hypot(c[2] - x, c[3] - y) <= Math.max(c[4], r) + 0.6);
  if (gan) {
    if (gan[5] === SRC_LTA && gan.length === 6) {
      gan.push(1);
      toDac++;
    }
    continue;
  }
  const lop = data.layers.indexOf(`${kv}kV`);
  s.c.push([lop >= 0 ? lop : s.b[[...net[v]][0]][0], kv, +x.toFixed(3), +y.toFixed(3), r, SRC_RN, 1]);
  them++;
}

/* ---------- số cột tại điểm rẽ (lấy chữ số cột trên bản vẽ PDF gốc) ---------- */
// tools/pdf-lo/xuat.py ghi mọi chữ số cột sát đường dây vào "cot_le"; vi-tri.json (ve-luoi-trung-ap.mjs
// ghi) cho phép đổi toạ độ PDF -> tờ tổng giống hệt lúc vẽ
const RE_COT = /^\d{1,3}[A-Za-z]?(-\d)?$/;
const thuMuc = resolve('tools/luoi-trung-ap/pdf');
const viTri = JSON.parse(readFileSync(join(thuMuc, 'vi-tri.json'), 'utf8'));
const cotPdf = [];
for (const [ten, v] of Object.entries(viTri)) {
  const J = JSON.parse(readFileSync(join(thuMuc, ten), 'utf8'));
  const [X0, Y0] = v.goc;
  const [gx, gy] = v.goc_pdf;
  const k = v.ti_le;
  const W = (x, y) => [X0 + k * (x - gx), Y0 - k * (y - gy)];
  for (const c of J.cot_le ?? []) {
    const [a0, b0] = W(c.x0, c.y1);
    const [a1, b1] = W(c.x1, c.y0);
    cotPdf.push({ t: c.t, hop: [a0, b0, a1, b1], k, c });
  }
}
const kcHop = (h, x, y) => Math.hypot(Math.max(h[0] - x, 0, x - h[2]), Math.max(h[1] - y, 0, y - h[3]));
// chữ số cột đã có trên tờ (khung ước lượng theo cỡ chữ)
const hopChu = (r) => {
  const w = String(r[8]).length * r[4] * 0.62;
  return r[5] === 90 ? [r[2] - r[4], r[3], r[2], r[3] + w] : [r[2], r[3], r[2] + w, r[3] + r[4]];
};
const chuCot = s.t.filter((r) => RE_COT.test(String(r[8]).trim())).map(hopChu);
const LOP_CHU = data.layers.indexOf('Ghi chú');
const ALIGN_TRAI = data.aligns.indexOf('left');
const daDung = new Set();
let ghiSo = 0;
let coSan = 0;
const cap = [];
for (const c of s.c) {
  if (!(c[5] === SRC_RN || (c[5] === SRC_LTA && c.length > 6)) || c[1] >= 110) continue;
  if (chuCot.some((h) => kcHop(h, c[2], c[3]) < 4)) {
    coSan++;
    continue;
  }
  cotPdf.forEach((p, i) => {
    const d = kcHop(p.hop, c[2], c[3]) / p.k;
    if (d <= 5) cap.push([d, c, i]);
  });
}
// ghép gần nhất trước: mỗi chấm một số cột, mỗi chữ trên PDF dùng một lần
const daGhi = new Set();
for (const [, c, i] of cap.sort((a, b) => a[0] - b[0])) {
  if (daGhi.has(c) || daDung.has(i)) continue;
  daGhi.add(c);
  daDung.add(i);
  const { t: so, k, c: n } = cotPdf[i];
  const h = Math.max(n.h, 2.5) * k * 0.92;
  // cùng cách đặt chữ như chuPdf trong ve-luoi-trung-ap.mjs
  const hp = cotPdf[i].hop;
  const [x, y] = n.doc ? [hp[2] - n.h * 0.18 * k, hp[1]] : [hp[0], hp[1] + n.h * 0.18 * k];
  s.t.push([LOP_CHU, c[1], +x.toFixed(3), +y.toFixed(3), +h.toFixed(3), n.doc ? 90 : 0, ALIGN_TRAI, SRC_RN, so]);
  ghiSo++;
}
writeFileSync(duongDan, JSON.stringify(data));
console.log(`Điểm rẽ nhánh: thêm ${them} chấm đặc, tô đặc ${toDac} chấm cột sẵn có (${daCham.length} điểm rẽ).`);
console.log(`Số cột tại điểm rẽ trung áp: ${coSan} đã có, ghi thêm ${ghiSo} (theo bản vẽ PDF gốc).`);
