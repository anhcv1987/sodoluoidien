/**
 * RÀ SOÁT CHỖ NỐI CHƯA HOÀN THIỆN TRÊN LƯỚI TRUNG ÁP (tờ TONG).
 *
 *   node tools/ra-soat-noi-trung-ap.mjs [src/data/tram-sld.json] [-v] [--binh-thuong]
 *
 * 1. Đoạn dây trung áp KHÔNG CÓ CÔNG SUẤT chạy qua khi ĐÓNG HẾT thiết bị đóng cắt (mô hình
 *    src/core/dongCongSuat.ts - như khi bấm F6): dây không nối được tới nguồn nào - hở ở chỗ nối.
 *    Gộp thành cụm liền nhau, in cụm kèm tên thiết bị / chữ gần nhất. --binh-thuong: giữ trạng
 *    thái vận hành (thêm cả dây mất điện vì nằm sau điểm thường cắt).
 * 2. ĐẦU DÂY HỞ: đầu mút nét trung áp không chạm (<= 3) nét nào khác, không ở thiết bị, không sát
 *    thiết bị thường cắt, không có chữ ghi hướng đi (→ ↑ ĐZ ... LT ...), tên TBA, tháo lèo ngay đó. Còn lại
 *    phần lớn là cuối nhánh tới TBA (sơ đồ không vẽ TBA) - soát bằng mắt với bản vẽ gốc.
 * Không tính nét trong khung tủ RMU (khung, thanh cái, tên ngăn) và vạch ranh giới.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const chiTiet = args.includes('-v');
const duongDan = resolve(args.find((a) => !a.startsWith('-')) ?? 'src/data/tram-sld.json');
const tmp = mkdtempSync(join(tmpdir(), 'nt-'));
const bundle = join(tmp, 'cs.mjs');
execFileSync('npx', ['esbuild', 'src/core/dongCongSuat.ts', '--bundle', '--format=esm', '--platform=node', `--outfile=${bundle}`, '--log-level=warning'], {
  stdio: 'inherit',
});
const { tinhDongCongSuat } = await import(pathToFileURL(bundle).href);
rmSync(tmp, { recursive: true, force: true });

const data = JSON.parse(readFileSync(duongDan, 'utf8'));
const s = data.sheets.find((x) => x.code === 'TONG');
const SRC = data.srcLayers.indexOf('Lưới trung áp');
const vong = new Set((s.vong ?? []).map(([x, y]) => `${x}|${y}`));
const nhay = new Set((s.nhay ?? []).map(([x, y]) => `${x}|${y}`));
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
  if (data.srcLayers[r[3]] === 'Kết lưới 110kV' || nhay.has(`${r[4]}|${r[5]}`)) b.khongNoiGiua = true;
  if (vong.has(`${r[4]}|${r[5]}`)) b.vong = true;
  ents.push(b);
});
s.d.forEach((r, i) =>
  ents.push({ id: `d${i}`, kind: 'device', layer: data.layers[r[0]], kv: r[1], block: data.blocks[r[2]], p: { x: r[3], y: r[4] }, rot: r[5], scale: r[6], state: data.states[r[7]], mirror: !!r[9] }),
);
(s.c ?? []).forEach((r, i) => ents.push({ id: `c${i}`, kind: 'circle', layer: data.layers[r[0]], kv: r[1], c: { x: r[2], y: r[3] }, r: r[4] }));
// ĐÓNG HẾT thiết bị đóng cắt: dây vẫn không có công suất là dây không nối được tới nguồn nào
// (hở thật) - khác dây chỉ mất điện vì nằm sau điểm thường cắt
const DONG_HET = !args.includes('--binh-thuong');
if (DONG_HET) for (const e of ents) if (e.kind === 'device' && e.state === 'mo') e.state = 'dong';
const kq = tinhDongCongSuat(ents, (id) => diem.get(id));

// lưới ô tra nhanh trung điểm các khúc có công suất
const O = 20;
const oKey = (x, y) => `${Math.floor(x / O)}|${Math.floor(y / O)}`;
const luoi = new Map();
for (const c of kq.chuoi)
  for (let k = 2; k < c.pts.length; k += 2) {
    const [ax, ay, bx, by] = [c.pts[k - 2], c.pts[k - 1], c.pts[k], c.pts[k + 1]];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 5));
    for (let q = 0; q <= n; q++) {
      const x = ax + ((bx - ax) * q) / n, y = ay + ((by - ay) * q) / n;
      (luoi.get(oKey(x, y)) ?? luoi.set(oKey(x, y), []).get(oKey(x, y))).push([x, y]);
    }
  }
const coDien = (x, y) => {
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++)
      for (const [px, py] of luoi.get(`${Math.floor(x / O) + i}|${Math.floor(y / O) + j}`) ?? []) if (Math.hypot(px - x, py - y) < 3) return true;
  return false;
};

// nét trung áp cần xét: bỏ khung tủ RMU (nét kín) và nét trong khung
const LOP_CHU = data.layers.indexOf('Ghi chú'); // vạch ranh giới quản lý
const laTA = (r) => r[3] === SRC && r[0] !== LOP_CHU && [6, 10, 22, 35].includes(r[1]);
// khúc đường dây khác cấp vẽ cắt ngang tuyến ở chỗ giao chéo (không đấu nối, cố ý không có điện)
const GIAO = s.t.filter((q) => /^Giao chéo/i.test(q[8]));
const laGiao = (r) => GIAO.some((q) => Math.hypot(q[2] - (r[4] + r.at(-2)) / 2, q[3] - (r[5] + r.at(-1)) / 2) <= 25);
const khung = [];
for (const r of s.b) {
  if (!laTA(r) || r.length !== 14 || Math.abs(r[4] - r[12]) > 0.01 || Math.abs(r[5] - r[13]) > 0.01) continue;
  const xs = [r[4], r[6], r[8], r[10]], ys = [r[5], r[7], r[9], r[11]];
  khung.push([Math.min(...xs) + 0.5, Math.min(...ys) + 0.5, Math.max(...xs) - 0.5, Math.max(...ys) - 0.5]);
}
const trongKhung = (x, y) => khung.some((h) => x > h[0] && x < h[2] && y > h[1] && y < h[3]);
const dong = s.b.map((r, i) => ({ r, i })).filter(({ r }) => laTA(r) && !laGiao(r) && !(r.length === 14 && Math.abs(r[4] - r[12]) < 0.01 && Math.abs(r[5] - r[13]) < 0.01));
const T = s.t.filter((q) => q[7] === SRC);
const tenGan = (x, y) => {
  let b = null, bd = 1e9;
  for (const q of T) { const d = Math.hypot(q[2] - x, q[3] - y); if (d < bd && !/^-?\d{1,3}$/.test(q[8])) { bd = d; b = q; } }
  return b ? `${b[8]} (cách ${bd.toFixed(0)})` : '';
};

// 1. đoạn không có công suất
const khongDien = [];
for (const { r, i } of dong) {
  let L = 0, het = true, ngoai = false;
  for (let k = 4; k + 3 < r.length; k += 2) {
    const [ax, ay, bx, by] = [r[k], r[k + 1], r[k + 2], r[k + 3]];
    const l = Math.hypot(bx - ax, by - ay);
    L += l;
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    if (!trongKhung(mx, my)) ngoai = true;
    if (l > 0.5 && coDien(mx, my)) het = false;
  }
  if (het && ngoai && L > 1) khongDien.push({ r, i, L });
}
// gộp cụm: hai nét chạm nhau (đầu mút cách <= 3)
const cha = new Map(khongDien.map((d) => [d.i, d.i]));
const goc = (x) => (cha.get(x) === x ? x : (cha.set(x, goc(cha.get(x))), cha.get(x)));
const dau = (r) => [[r[4], r[5]], [r.at(-2), r.at(-1)]];
for (let a = 0; a < khongDien.length; a++)
  for (let b = a + 1; b < khongDien.length; b++) {
    const A = khongDien[a], B = khongDien[b];
    if (dau(A.r).some((p) => dau(B.r).some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= 3))) cha.set(goc(A.i), goc(B.i));
  }
const cum = new Map();
for (const d of khongDien) (cum.get(goc(d.i)) ?? cum.set(goc(d.i), []).get(goc(d.i))).push(d);
const dsCum = [...cum.values()].map((ds) => {
  const L = ds.reduce((t, d) => t + d.L, 0);
  const xs = ds.flatMap((d) => d.r.filter((_, k) => k >= 4 && k % 2 === 0)), ys = ds.flatMap((d) => d.r.filter((_, k) => k >= 5 && k % 2 === 1));
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return { L, n: ds.length, cx, cy, kv: ds[0].r[1] };
}).sort((a, b) => b.L - a.L);
console.log(`1. Dây trung áp không có công suất (${DONG_HET ? 'đóng hết thiết bị' : 'vận hành bình thường'}): ${dsCum.length} cụm, tổng dài ${dsCum.reduce((t, c) => t + c.L, 0).toFixed(0)}`);
for (const c of chiTiet ? dsCum : dsCum.slice(0, 15)) console.log(`   ${c.kv}kV dài ${c.L.toFixed(0)} (${c.n} nét) quanh (${c.cx.toFixed(0)}, ${c.cy.toFixed(0)}) - ${tenGan(c.cx, c.cy)}`);

// 2. đầu dây hở
const doan = [];
s.b.forEach((r, i) => { for (let k = 4; k + 3 < r.length; k += 2) doan.push([r[k], r[k + 1], r[k + 2], r[k + 3], i]); });
const oDoan = new Map();
doan.forEach((d, n) => {
  const [x0, x1, y0, y1] = [Math.min(d[0], d[2]), Math.max(d[0], d[2]), Math.min(d[1], d[3]), Math.max(d[1], d[3])];
  for (let i = Math.floor(x0 / O) - 1; i <= Math.floor(x1 / O) + 1; i++)
    for (let j = Math.floor(y0 / O) - 1; j <= Math.floor(y1 / O) + 1; j++) (oDoan.get(`${i}|${j}`) ?? oDoan.set(`${i}|${j}`, []).get(`${i}|${j}`)).push(n);
});
const kc = (px, py, [ax, ay, bx, by]) => {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  const u = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
  return Math.hypot(ax + u * dx - px, ay + u * dy - py);
};
const cham = (x, y, i) => (oDoan.get(oKey(x, y)) ?? []).some((n) => doan[n][4] !== i && kc(x, y, doan[n]) <= 3);
const ganTb = (x, y) => s.d.some((r) => Math.hypot(r[3] - x, r[4] - y) <= Math.max(6, r[6] * 2.5));
const coChu = (x, y) => s.t.some((q) => Math.hypot(q[2] - x, q[3] - y) <= 14 && /[→←↑↓]|^\s*(LT|TBA|Đi|Từ|Về|Cột|C\.|ĐZ|Tháo lèo)/i.test(q[8]));
// dừng ở thiết bị thường cắt (điểm mở giữa hai lộ - phía bên kia vẽ ở chỗ khác)
const MO = data.states.indexOf('mo');
const ganMo = (x, y) => s.d.some((r) => r[7] === MO && Math.hypot(r[3] - x, r[4] - y) <= 15);
const vongTron = (x, y) => (s.c ?? []).some((c) => Math.abs(Math.hypot(c[2] - x, c[3] - y) - c[4]) <= 3);
const ho = [];
for (const { r, i } of dong) {
  for (const [x, y] of dau(r)) {
    if (trongKhung(x, y) || cham(x, y, i) || ganTb(x, y) || coChu(x, y) || vongTron(x, y) || ganMo(x, y)) continue;
    ho.push([x, y, r[1]]);
  }
}
console.log(`2. Đầu dây hở (không chạm nét / thiết bị, không có chữ ghi hướng đi): ${ho.length}`);
for (const [x, y, kv] of chiTiet ? ho : ho.slice(0, 30)) console.log(`   ${kv}kV (${x.toFixed(0)}, ${y.toFixed(0)}) - ${tenGan(x, y)}`);
