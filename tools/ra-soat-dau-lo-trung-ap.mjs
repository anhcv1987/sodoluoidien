/**
 * RÀ SOÁT CÁP ĐẦU LỘ TRUNG ÁP: NỐI ĐÚNG NGĂN LỘ? CẮT MC ĐẦU LỘ THÌ MẤT ĐIỆN?
 *
 *   node tools/ra-soat-dau-lo-trung-ap.mjs [src/data/tram-sld.json] [--thu-cat] [--lo=<json lộ>|...]
 *
 * Mỗi cáp ngăn lộ khai ở tools/luoi-trung-ap/pdf/dat.mjs (noi: { 'ĐZ 4xx E6.y': { tu } }):
 *  1. (mặc định, nhanh) trên đồ thị điện của mô hình công suất, từ đầu cáp ra ngoài có tới được cực
 *     máy cắt đầu lộ (MC / MCHB cùng trạm, thẳng hàng với đầu ra) KHÔNG - không tới được là cáp
 *     không nối vào ngăn lộ (vd 471 E6.17: đoạn cáp trong trạm hụt 15 đv trước mũi tên đầu ra; cáp
 *     vẫn hiện công suất vì được cấp vòng từ lộ khác);
 *  2. (--thu-cat, ~20 phút) cắt MC đầu lộ rồi tính lại: cáp còn điện thì in đường đi tới máy cắt
 *     khác gần nhất và các bước "nối" trên đường đó (qua thiết bị đóng / nối chữ T). Bước nối không
 *     có thiết bị là hai lộ vẽ dính nhau (tuyến cáp chạy sát đầu tuyến lộ kia, ký hiệu nhận nhầm...);
 *     qua thiết bị là thiếu điểm thường cắt trên bản vẽ (so với văn bản phương thức) hoặc hai lộ cùng
 *     cấp cho một khách hàng; lộ có nhà máy thuỷ điện (Bắc Kạn) còn điện là đúng.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const THU_CAT = args.includes('--thu-cat');
const CHI = (() => {
  const a = args.find((x) => x.startsWith('--lo='));
  return a ? new Set(a.slice(5).split('|')) : null;
})();
const tmp = mkdtempSync(join(tmpdir(), 'rsdl-'));
execFileSync('npx', ['esbuild', 'src/core/dongCongSuat.ts', '--bundle', '--format=esm', '--platform=node', `--outfile=${join(tmp, 'cs.mjs')}`, '--log-level=warning']);
const { tinhDongCongSuat } = await import(pathToFileURL(join(tmp, 'cs.mjs')).href);
rmSync(tmp, { recursive: true, force: true });
const { doiDiem } = await import(pathToFileURL(resolve('tools/vi-tri-tram.mjs')).href);
const DAT = (await import(pathToFileURL(resolve('tools/luoi-trung-ap/pdf/dat.mjs')).href)).default;

const data = JSON.parse(readFileSync(resolve(args.find((a) => !a.startsWith('--')) ?? 'src/data/tram-sld.json'), 'utf8'));
const s = data.sheets.find((x) => x.code === 'TONG');
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
const tb = [];
s.d.forEach((r, i) => {
  const e = { id: `d${i}`, kind: 'device', layer: data.layers[r[0]], kv: r[1], block: data.blocks[r[2]], p: { x: r[3], y: r[4] }, rot: r[5], scale: r[6], state: data.states[r[7]], mirror: !!r[9], srcLayer: data.srcLayers[r[8]] };
  ents.push(e);
  tb.push(e);
});
(s.c ?? []).forEach((r, i) => ents.push({ id: `c${i}`, kind: 'circle', layer: data.layers[r[0]], kv: r[1], c: { x: r[2], y: r[3] }, r: r[4] }));
(s.t ?? []).forEach((r, i) =>
  ents.push({ id: `t${i}`, kind: 'text', layer: data.layers[r[0]], kv: r[1], p: { x: r[2], y: r[3] }, height: r[4], rot: r[5] ?? 0, align: data.aligns[r[6]] ?? 'left', text: String(r[8]) }),
);
const chu = ents.filter((e) => e.kind === 'text');
const tinh = () => tinhDongCongSuat(ents, (id) => diem.get(id));
const coDien = (chuoi, x, y) =>
  chuoi.some((c) => {
    if (x < c.minX - 1 || x > c.maxX + 1 || y < c.minY - 1 || y > c.maxY + 1) return false;
    for (let k = 2; k < c.pts.length; k += 2) {
      const [ax, ay, bx, by] = [c.pts[k - 2], c.pts[k - 1], c.pts[k], c.pts[k + 1]];
      const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
      const t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)) : 0;
      if (Math.hypot(ax + t * dx - x, ay + t * dy - y) < 0.6) return true;
    }
    return false;
  });
const tram = (x, y) => s.st.find((r) => r.length >= 8 && x >= r[4] - 5 && x <= r[6] + 5 && y >= r[5] - 5 && y <= r[7] + 5)?.[0];
const nhanGan = (x, y) => {
  let t = '';
  let bd = 40;
  for (const e of chu) {
    const d = Math.hypot(e.p.x - x, e.p.y - y);
    if (d < bd) [bd, t] = [d, e.text];
  }
  return t;
};
/** Kề trên đồ thị điện (cạnh vẽ + cạnh nối qua thiết bị đóng, không qua MBA): [đỉnh, là cạnh nối]. */
function ke(g) {
  const out = Array.from({ length: g.vx.length }, () => []);
  g.veU.forEach((a, c) => {
    out[a].push([g.veV[c], 0]);
    out[g.veV[c]].push([a, 0]);
  });
  g.noiU.forEach((a, c) => {
    if (g.noiMBA[c]) return;
    out[a].push([g.noiV[c], 1]);
    out[g.noiV[c]].push([a, 1]);
  });
  return out;
}
const dinhGan = (g, p) => {
  let u = -1;
  let bd = 1e9;
  for (let i = 0; i < g.vx.length; i++) {
    const d = Math.hypot(g.vx[i] - p[0], g.vy[i] - p[1]);
    if (d < bd) [bd, u] = [d, i];
  }
  return u;
};
/** Duyệt rộng từ p; dừng khi gặp đỉnh thuộc `dich` - trả về [đỉnh gặp, cha]. */
function duyet(g, k, p, dich) {
  const u0 = dinhGan(g, p);
  const cha = new Map([[u0, null]]);
  const q = [u0];
  while (q.length) {
    const u = q.shift();
    if (dich.has(u)) return [u, cha];
    for (const [v, n] of k[u]) if (!cha.has(v)) (cha.set(v, [u, n]), q.push(v));
  }
  return [-1, cha];
}

const LTA = 'Lưới trung áp';
const goc = tinh();
const kGoc = ke(goc.doThi);
const loi = [];
let tong = 0;
let datCat = 0;
for (const d of DAT)
  for (const [lo, v] of Object.entries(d.noi ?? {})) {
    if (CHI && !CHI.has(`${d.json} ${lo}`)) continue;
    tong++;
    const [X, Y] = doiDiem(v.tu[0], v.tu[1]);
    const ten = `${lo} (${d.json})`;
    // điểm dò: trên cáp, cách đầu ra 3 đv
    let thu = null;
    for (const b of ents) {
      if (b.kind !== 'branch' || b.srcLayer !== LTA) continue;
      const p = b.nodes.map((id) => diem.get(id));
      for (const [a, c] of [[p[0], p[1]], [p.at(-1), p.at(-2)]])
        if (Math.hypot(a.x - X, a.y - Y) < 1) {
          const f = Math.min(1, 3 / Math.hypot(c.x - a.x, c.y - a.y));
          thu = [a.x + (c.x - a.x) * f, a.y + (c.y - a.y) * f];
        }
      if (thu) break;
    }
    if (!thu) {
      loi.push(`${ten}: không thấy cáp tại đầu ra [${X.toFixed(1)}, ${Y.toFixed(1)}]`);
      continue;
    }
    const ma = tram(X, Y);
    const mc = tb
      .filter((e) => ['MC', 'MCHB', 'REC'].includes(e.block) && e.kv < 110 && e.srcLayer !== LTA && tram(e.p.x, e.p.y) === ma)
      .filter((e) => (Math.abs(e.p.x - X) < 1.5 || Math.abs(e.p.y - Y) < 1.5) && Math.hypot(e.p.x - X, e.p.y - Y) < 250)
      .sort((a, b) => Math.hypot(a.p.x - X, a.p.y - Y) - Math.hypot(b.p.x - X, b.p.y - Y))[0];
    if (!coDien(goc.chuoi, ...thu)) loi.push(`${ten}: cáp đầu lộ không có công suất`);
    if (!mc) {
      // đầu ra không thẳng hàng máy cắt: chỉ kiểm tra cáp có vào được trạm (tới máy cắt nào đó của trạm)
      const cuc = new Set(goc.doThi.mayCat.filter((m) => tram(m.p.x, m.p.y) === ma).flatMap((m) => goc.doThi.cucTB.get(m.id) ?? []));
      if (duyet(goc.doThi, kGoc, thu, cuc)[0] < 0) loi.push(`${ten}: cáp không nối vào trạm ${ma}`);
      continue;
    }
    const cucMC = new Set(goc.doThi.cucTB.get(mc.id) ?? []);
    if (duyet(goc.doThi, kGoc, thu, cucMC)[0] < 0) {
      loi.push(`${ten}: cáp KHÔNG NỐI vào máy cắt đầu lộ ${nhanGan(mc.p.x, mc.p.y)} ${ma} [${mc.p.x.toFixed(0)}, ${mc.p.y.toFixed(0)}]`);
      continue;
    }
    if (!THU_CAT || mc.state !== 'dong') continue;
    mc.state = 'mo';
    const kq = tinh();
    mc.state = 'dong';
    if (!coDien(kq.chuoi, ...thu)) {
      datCat++;
      continue;
    }
    const g = kq.doThi;
    const dich = new Set(g.mayCat.filter((m) => m.dong && m.id !== mc.id).flatMap((m) => g.cucTB.get(m.id) ?? []));
    const [den, cha] = duyet(g, ke(g), thu, dich);
    if (den < 0) {
      loi.push(`${ten}: cắt MC đầu lộ vẫn có điện - không qua máy cắt trạm nào (nguồn phát trên lưới, vd thuỷ điện)`);
      continue;
    }
    const buoc = [];
    for (let u = den; cha.get(u); u = cha.get(u)[0]) if (cha.get(u)[1]) { const w = cha.get(u)[0]; buoc.push(`${nhanGan(g.vx[w], g.vy[w]) || '(nối chữ T)'} [${g.vx[w].toFixed(0)}, ${g.vy[w].toFixed(0)}]`); }
    const m = g.mayCat.find((q) => (g.cucTB.get(q.id) ?? []).includes(den));
    loi.push(`${ten}: cắt MC đầu lộ vẫn có điện, tới máy cắt ${tram(m.p.x, m.p.y)} [${m.p.x.toFixed(0)}, ${m.p.y.toFixed(0)}] qua: ${buoc.reverse().slice(0, 6).join(' > ')}`);
  }
for (const l of loi) console.log('  ' + l);
console.log(`Cáp đầu lộ trung áp: ${tong}; ${loi.length} mục cần xem${THU_CAT ? `; cắt MC đầu lộ thì mất điện: ${datCat}` : ''}.`);
