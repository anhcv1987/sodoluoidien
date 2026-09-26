/**
 * RÀ SOÁT CHỖ NỐI NHẦM VÀO THANH CÁI (thanh cái "rò điện").
 *
 *   node tools/ra-soat-co-lap-thanh-cai.mjs [src/data/tram-sld.json] [--tram=E6.4] [--truy]
 *
 * Với từng trạm và từng cấp điện áp: CẮT HẾT thiết bị đóng cắt cấp đó trong trạm (MC,
 * MCHB, recloser, LBS, DCL, DCLHB, FCO), giữ nguyên các cấp khác (máy biến áp vẫn có
 * điện từ phía cao áp). Khi đó mọi thanh cái cấp đó phải MẤT ĐIỆN; thanh cái nào còn
 * điện là có dây nối nhầm vào (vd cáp tổng MBA vẽ nhảy qua thanh cái mà bị coi là đấu
 * nối - lỗi ở C42 E6.4). --truy in đường công suất tới thanh cái đó để tìm chỗ nối.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { doiDiem } from './vi-tri-tram.mjs';

const args = process.argv.slice(2);
const chiTram = args.find((a) => a.startsWith('--tram='))?.slice(7);
const inTruy = args.includes('--truy');
const duongDan = resolve(args.find((a) => !a.startsWith('--')) ?? 'src/data/tram-sld.json');
const tmp = mkdtempSync(join(tmpdir(), 'cl-'));
const bundle = join(tmp, 'cs.mjs');
execFileSync('npx', ['esbuild', 'src/core/dongCongSuat.ts', '--bundle', '--format=esm', '--platform=node', `--outfile=${bundle}`, '--log-level=warning'], {
  stdio: 'inherit',
});
const { tinhDongCongSuat } = await import(pathToFileURL(bundle).href);
rmSync(tmp, { recursive: true, force: true });

const data = JSON.parse(readFileSync(duongDan, 'utf8'));
const s = data.sheets.find((x) => x.code === 'TONG');
const vong = new Set((s.vong ?? []).map(([x, y]) => `${x}|${y}`));
const nhay = new Set((s.nhay ?? []).map(([x, y]) => `${x}|${y}`));

// Dựng thực thể một lần (giống src/data/tramSheets.ts), mỗi lượt chỉ đổi trạng thái
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
const tb = s.d.map((r, i) => ({
  id: `d${i}`,
  kind: 'device',
  layer: data.layers[r[0]],
  kv: r[1],
  block: data.blocks[r[2]],
  p: { x: r[3], y: r[4] },
  rot: r[5],
  scale: r[6],
  state: data.states[r[7]],
  mirror: !!r[9],
}));
ents.push(...tb);
(s.c ?? []).forEach((r, i) => ents.push({ id: `c${i}`, kind: 'circle', layer: data.layers[r[0]], kv: r[1], c: { x: r[2], y: r[3] }, r: r[4] }));
const trangThaiGoc = tb.map((d) => d.state);

const DONG_CAT = new Set(['MC', 'MCHB', 'REC', 'LBS', 'DCL', 'DCLTA', 'DCLHB', 'FCO']);
const trong = (st, x, y, le = 0) => x >= st[4] - le && x <= st[6] + le && y >= st[5] - le && y <= st[7] + le;
// khung trạm vẽ tay có chỗ hụt vài đơn vị: chọn thiết bị để cắt thì nới khung ra (cắt
// nhầm thiết bị trạm bên cạnh chỉ làm mất điện thêm, không sinh báo lỗi sai)
const LE = 80;

/** Thanh cái có công suất chạy qua không (xét trung điểm từng khúc thanh cái). */
const coDien = (kq, r) => {
  for (let k = 6; k + 1 < r.length; k += 2) {
    const [ax, ay, bx, by] = [r[k - 2], r[k - 1], r[k], r[k + 1]];
    const L = Math.hypot(bx - ax, by - ay);
    if (L < 1) continue;
    for (const c of kq.chuoi) {
      if (c.maxX < Math.min(ax, bx) - 1 || c.minX > Math.max(ax, bx) + 1 || c.maxY < Math.min(ay, by) - 1 || c.minY > Math.max(ay, by) + 1) continue;
      for (let m = 2; m < c.pts.length; m += 2) {
        const [px, py] = [(c.pts[m - 2] + c.pts[m]) / 2, (c.pts[m - 1] + c.pts[m + 1]) / 2];
        const t = ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / (L * L);
        if (t >= -0.01 && t <= 1.01 && Math.abs((px - ax) * (by - ay) - (py - ay) * (bx - ax)) / L < 0.5) return true;
      }
    }
  }
  return false;
};

/** Lần ngược đường công suất tới điểm (x, y). */
const truy = (kq, x, y) => {
  const dai = (c) => {
    let L = 0;
    for (let k = 2; k < c.pts.length; k += 2) L += Math.hypot(c.pts[k] - c.pts[k - 2], c.pts[k + 1] - c.pts[k - 1]);
    return L;
  };
  const qua = (c) => {
    for (let k = 2; k < c.pts.length; k += 2) {
      const [ax, ay, bx, by] = [c.pts[k - 2], c.pts[k - 1], c.pts[k], c.pts[k + 1]];
      const L = Math.hypot(bx - ax, by - ay) || 1;
      const t = ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / (L * L);
      if (t >= 0 && t <= 1 && Math.abs((x - ax) * (by - ay) - (y - ay) * (bx - ax)) / L < 0.5) return true;
    }
    return false;
  };
  let cur = kq.chuoi.filter(qua).sort((a, b) => a.pha - b.pha)[0];
  const da = new Set();
  const out = [];
  for (let i = 0; i < 25 && cur; i++) {
    da.add(cur);
    out.push(`(${cur.pts[0].toFixed(1)}, ${cur.pts[1].toFixed(1)}) → (${cur.pts.at(-2).toFixed(1)}, ${cur.pts.at(-1).toFixed(1)})`);
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
  return out;
};

// Đã rà, KHÔNG phải lỗi (thanh cái nhận điện thẳng từ MBA, không có thiết bị đóng cắt
// cấp đó ở giữa): trạm, cấp, điểm đầu thanh cái -> lý do
// (toạ độ theo bản CAD gốc, đổi theo trạm đã dời - tools/vi-tri-tram.mjs)
const DA_BIET = new Map(
  [
    ['E6.5', 35, -431.9, -685.6, 'đoạn thanh cái ngắn phía MBA của MC 332 (sau TI, chỗ đấu cáp tổng)'],
    ['E6.6', 35, 404.1, 4153.3, 'đoạn thanh cái ngắn phía MBA của MC 332 (sau TI, chỗ đấu cáp tổng)'],
    ['E6.9', 6, 1164.6, -642.0, 'thanh cái 6kV TG NatSteel Vina nhận điện thẳng từ MBA T1 35/6kV khách hàng'],
  ].map(([t, kv, x, y, lyDo]) => [`${t}|${kv}`, [...doiDiem(x, y), lyDo]]),
);
const daBietLyDo = (tram, kv, x, y) => {
  const m = DA_BIET.get(`${tram}|${kv}`);
  return m && Math.hypot(m[0] - x, m[1] - y) < 0.2 ? m[2] : undefined;
};
const SRC_NGOAI = data.srcLayers.indexOf('Trạm ngoài tỉnh');

const tramDs = s.st.filter((r) => r.length >= 8 && (!chiTram || r[0] === chiTram));
const thanhCai = s.b.filter((r) => data.lineKinds[r[2]] === 'Thanh cái' && r.length >= 8 && Math.hypot(r[6] - r[4], r[7] - r[5]) >= 20);
let soLuot = 0;
let daBiet = 0;
const loi = [];
const t0 = Date.now();
for (const st of tramDs) {
  const tcTram = thanhCai.filter((r) => trong(st, (r[4] + r[6]) / 2, (r[5] + r[7]) / 2));
  // nguồn giả định của phần mềm (thanh cái 220kV, trạm ngoài tỉnh) - bỏ qua
  if (tcTram.some((r) => r[3] === SRC_NGOAI)) continue;
  const caps = [...new Set(tcTram.map((r) => r[1]))].filter((kv) => kv < 220);
  for (const kv of caps) {
    let soCat = 0;
    tb.forEach((d, i) => {
      const cat = d.kv === kv && DONG_CAT.has(d.block) && trong(st, d.p.x, d.p.y, LE);
      d.state = cat ? 'mo' : trangThaiGoc[i];
      if (cat) soCat++;
    });
    if (!soCat) continue;
    const kq = tinhDongCongSuat(ents, (id) => diem.get(id));
    soLuot++;
    for (const r of tcTram.filter((r) => r[1] === kv)) {
      if (!coDien(kq, r)) continue;
      const lyDo = daBietLyDo(st[0], kv, r[4], r[5]);
      if (lyDo) {
        daBiet++;
        console.log(`  (đã biết) ${st[0]} ${kv}kV (${r[4].toFixed(1)}, ${r[5].toFixed(1)}): ${lyDo}`);
        continue;
      }
      const x = (r[4] + r[6]) / 2;
      const y = (r[5] + r[7]) / 2;
      loi.push({ tram: st[0], kv, r, truy: inTruy ? truy(kq, x, r[5]) : [] });
      console.log(`  ! ${st[0]} ${kv}kV: thanh cái (${r[4].toFixed(1)}, ${r[5].toFixed(1)}) → (${r.at(-2).toFixed(1)}, ${r.at(-1).toFixed(1)}) vẫn có điện khi cắt hết ${soCat} thiết bị đóng cắt ${kv}kV của trạm`);
      if (inTruy) for (const dong of loi.at(-1).truy) console.log(`      ← ${dong}`);
    }
  }
}
tb.forEach((d, i) => (d.state = trangThaiGoc[i]));
console.log(
  `Rà ${tramDs.length} trạm, ${soLuot} lượt tính (${((Date.now() - t0) / 1000).toFixed(0)} s): ${loi.length} thanh cái còn điện khi đã cô lập` +
    (daBiet ? `, ${daBiet} trường hợp đã biết không phải lỗi.` : '.'),
);
process.exitCode = loi.length ? 1 : 0;
