/**
 * KIỂM TRA CÔNG SUẤT CHẠY TỚI ĐÂU TRÊN SƠ ĐỒ KẾT DÂY.
 *
 *   node tools/kiem-cong-suat.mjs [src/data/tram-sld.json] [--chi-tiet]
 *        [--cat=<số thứ tự thiết bị,...>] [--dong=<số thứ tự,...>] [--diem=x,y;x,y...]
 *
 * --cat  : thử đặt CẮT các thiết bị (số thứ tự trong mảng d của tờ TONG) trước khi tính
 * --dong : thử đặt ĐÓNG các thiết bị
 * --diem : in ra từng điểm có công suất chạy qua hay không (thử phương thức)
 *
 * Dựng chiều công suất (src/core/dongCongSuat.ts - đúng mô hình phần mềm dùng khi
 * bấm F6) rồi liệt kê theo từng trạm các THANH CÁI chưa có công suất chạy tới: thường
 * là do thiết bị / máy biến áp chưa đấu được vào dây trong bản vẽ.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const chiTiet = args.includes('--chi-tiet');
const thuCat = new Set((args.find((a) => a.startsWith('--cat='))?.slice(6) ?? '').split(',').filter(Boolean).map(Number));
const thuDong = new Set((args.find((a) => a.startsWith('--dong='))?.slice(7) ?? '').split(',').filter(Boolean).map(Number));
const thuDiem = (args.find((a) => a.startsWith('--diem='))?.slice(7) ?? '').split(';').filter(Boolean).map((p) => p.split(',').map(Number));
const duongDan = resolve(args.find((a) => !a.startsWith('--')) ?? 'src/data/tram-sld.json');
const tmp = mkdtempSync(join(tmpdir(), 'cs-'));
const bundle = join(tmp, 'cs.mjs');
execFileSync('npx', ['esbuild', 'src/core/dongCongSuat.ts', '--bundle', '--format=esm', '--platform=node', `--outfile=${bundle}`, '--log-level=warning'], {
  stdio: 'inherit',
});
const { tinhDongCongSuat } = await import(pathToFileURL(bundle).href);
rmSync(tmp, { recursive: true, force: true });

const data = JSON.parse(readFileSync(duongDan, 'utf8'));
const s = data.sheets.find((x) => x.code === 'TONG');
const tram = (x, y) => s.st.find((r) => r.length >= 8 && x >= r[4] && x <= r[6] && y >= r[5] && y <= r[7])?.[0] ?? '?';

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
  ents.push({
    id: `d${i}`,
    kind: 'device',
    layer: data.layers[r[0]],
    kv: r[1],
    block: data.blocks[r[2]],
    p: { x: r[3], y: r[4] },
    rot: r[5],
    scale: r[6],
    state: thuCat.has(i) ? 'mo' : thuDong.has(i) ? 'dong' : data.states[r[7]],
    mirror: !!r[9],
  }),
);
(s.c ?? []).forEach((r, i) => ents.push({ id: `c${i}`, kind: 'circle', layer: data.layers[r[0]], kv: r[1], c: { x: r[2], y: r[3] }, r: r[4] }));

const t0 = Date.now();
const kq = tinhDongCongSuat(ents, (id) => diem.get(id));
console.log(`${kq.chuoi.length} chuỗi, ${kq.soNguon} điểm nguồn, ${kq.diemDung.length} điểm dừng - ${Date.now() - t0} ms`);
// --truy=x,y : lần ngược đường công suất tới điểm đó (để tìm chỗ nối nhầm)
const truy = args.find((a) => a.startsWith('--truy='))?.slice(7);
if (truy) {
  const [x, y] = truy.split(',').map(Number);
  const dai = (c) => {
    let L = 0;
    for (let k = 2; k < c.pts.length; k += 2) L += Math.hypot(c.pts[k] - c.pts[k - 2], c.pts[k + 1] - c.pts[k - 1]);
    return L;
  };
  const qua = (c, px, py) => {
    for (let k = 0; k < c.pts.length; k += 2) if (Math.hypot(c.pts[k] - px, c.pts[k + 1] - py) < 3) return true;
    return false;
  };
  let cur = kq.chuoi.filter((c) => qua(c, x, y)).sort((a, b) => a.pha - b.pha)[0];
  const da = new Set();
  for (let i = 0; i < 80 && cur; i++) {
    da.add(cur);
    console.log(`  ← quãng ${cur.pha.toFixed(1)}: (${cur.pts[0].toFixed(1)}, ${cur.pts[1].toFixed(1)}) → (${cur.pts.at(-2).toFixed(1)}, ${cur.pts.at(-1).toFixed(1)}) ${cur.kv}kV`);
    const [sx, sy] = cur.pts;
    let tot = null;
    let bd = Infinity;
    for (const c of kq.chuoi) {
      if (da.has(c)) continue;
      const e = Math.hypot(c.pts.at(-2) - sx, c.pts.at(-1) - sy);
      const hut = cur.pha - (c.pha + dai(c));
      if (hut < -0.01 || hut > e + 0.5 || e > 60) continue;
      if (e < bd) {
        bd = e;
        tot = c;
      }
    }
    cur = tot;
  }
}
for (const [x, y] of thuDiem) {
  const co = kq.chuoi.some((c) => {
    for (let k = 2; k < c.pts.length; k += 2) {
      const [ax, ay, bx, by] = [c.pts[k - 2], c.pts[k - 1], c.pts[k], c.pts[k + 1]];
      const dx = bx - ax;
      const dy = by - ay;
      const L = dx * dx + dy * dy;
      if (!L) continue;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L));
      if (Math.hypot(ax + t * dx - x, ay + t * dy - y) < 0.5) return true;
    }
    return false;
  });
  console.log(`  (${x}, ${y}): ${co ? 'CÓ công suất' : 'không'}`);
}

// Trung điểm các khúc có công suất
const O = 20;
const luoi = new Map();
for (const c of kq.chuoi) {
  for (let k = 2; k < c.pts.length; k += 2) {
    const x = (c.pts[k - 2] + c.pts[k]) / 2;
    const y = (c.pts[k - 1] + c.pts[k + 1]) / 2;
    const key = `${Math.floor(x / O)}|${Math.floor(y / O)}`;
    (luoi.get(key) ?? luoi.set(key, []).get(key)).push([x, y]);
  }
}
const coDong = (ax, ay, bx, by) => {
  const L = Math.hypot(bx - ax, by - ay);
  for (let f = 0; f <= 1; f += Math.min(1, O / Math.max(L, 1e-9))) {
    const x = ax + (bx - ax) * f;
    const y = ay + (by - ay) * f;
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++)
        for (const [px, py] of luoi.get(`${Math.floor(x / O) + i}|${Math.floor(y / O) + j}`) ?? []) {
          const dx = bx - ax;
          const dy = by - ay;
          const t = ((px - ax) * dx + (py - ay) * dy) / (L * L);
          if (t >= -0.01 && t <= 1.01 && Math.abs((px - ax) * dy - (py - ay) * dx) / L < 0.5) return true;
        }
  }
  return false;
};

const theoTram = new Map();
let tong = 0;
let khong = 0;
s.b.forEach((r) => {
  if (data.lineKinds[r[2]] !== 'Thanh cái' || r.length < 8) return;
  const L = Math.hypot(r[6] - r[4], r[7] - r[5]);
  if (L < 20) return;
  tong++;
  let co = false;
  for (let k = 6; k + 1 < r.length && !co; k += 2) co = coDong(r[k - 2], r[k - 1], r[k], r[k + 1]);
  if (co) return;
  khong++;
  const ma = tram((r[4] + r[6]) / 2, (r[5] + r[7]) / 2);
  (theoTram.get(ma) ?? theoTram.set(ma, []).get(ma)).push(`${r[1]}kV (${r[4].toFixed(0)}, ${r[5].toFixed(0)})`);
});
console.log(`Thanh cái có công suất: ${tong - khong}/${tong}`);
for (const [ma, ds] of [...theoTram].sort()) console.log(`  ${ma}: ${ds.length} thanh cái chưa có${chiTiet ? ' - ' + ds.join('; ') : ''}`);

// Thiết bị đóng cắt / MBA phân phối chưa có công suất chạy qua (hoặc tới)
const coGan = (x, y, r) => {
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++)
      for (const [px, py] of luoi.get(`${Math.floor(x / O) + i}|${Math.floor(y / O) + j}`) ?? []) if (Math.hypot(px - x, py - y) <= r) return true;
  // đầu mút các khúc
  return false;
};
const dauKhuc = new Map();
for (const c of kq.chuoi)
  for (let k = 0; k < c.pts.length; k += 2) {
    const key = `${Math.floor(c.pts[k] / O)}|${Math.floor(c.pts[k + 1] / O)}`;
    (dauKhuc.get(key) ?? dauKhuc.set(key, []).get(key)).push([c.pts[k], c.pts[k + 1]]);
  }
const ganDau = (x, y, r) => {
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++)
      for (const [px, py] of dauKhuc.get(`${Math.floor(x / O) + i}|${Math.floor(y / O) + j}`) ?? []) if (Math.hypot(px - x, py - y) <= r) return true;
  return false;
};
const KIEM = new Set(['MC', 'MCHB', 'DCL', 'DCLTA', 'MBAPP', 'REC', 'LBS']);
const tbKhong = new Map();
let soTB = 0;
s.d.forEach((r) => {
  const b = data.blocks[r[2]];
  if (!KIEM.has(b)) return;
  soTB++;
  const R = Math.max(r[6] * (b === 'MCHB' ? 1.8 : 1.2), 4);
  if (coGan(r[3], r[4], R) || ganDau(r[3], r[4], R)) return;
  const ma = tram(r[3], r[4]);
  (tbKhong.get(ma) ?? tbKhong.set(ma, []).get(ma)).push(`${b} (${r[3].toFixed(0)}, ${r[4].toFixed(0)})`);
});
const soKhong = [...tbKhong.values()].reduce((a, v) => a + v.length, 0);
console.log(`Thiết bị (MC, MCHB, DCL, MBA phân phối…) có công suất: ${soTB - soKhong}/${soTB}`);
for (const [ma, ds] of [...tbKhong].sort()) console.log(`  ${ma}: ${ds.length}${chiTiet ? ' - ' + ds.join('; ') : ''}`);
