/**
 * RÀ SOÁT MÀU CUỘN DÂY MÁY BIẾN ÁP 110kV THEO CẤP ĐIỆN ÁP.
 *
 *   node tools/ra-soat-mba.mjs [src/data/tram-sld.json] [--thu]
 *
 * Mỗi máy biến áp có nhãn tỷ số điện áp ghi cạnh (vd "T1: 63000kVA 115/38,5/23 kV",
 * "T2: 63000kVA 115/23/(6,3) kV"). Công cụ đọc nhãn đó rồi gán cấp điện áp cho TỪNG
 * cuộn dây:
 *   - cuộn cao áp: cuộn có đường dây 110kV (220kV) đấu vào;
 *   - cuộn có đường dây trung áp đấu vào (dây dài nhất): theo cấp của dây nếu cấp đó
 *     có trong nhãn;
 *   - cuộn còn lại (thường là cuộn tam giác 38,5kV / 11kV / 6,3kV chỉ đấu chống sét
 *     van hoặc để hở): lấy cấp còn lại trong nhãn.
 * Máy vẽ bằng vòng tròn: đổi màu vòng tròn và nét Y/Δ trong nó. Máy là block MBA:
 * ghi cấp từng cuộn vào `kvCuon` để phần mềm tô mỗi cuộn một màu. Dây / chống sét
 * van đấu vào cuộn bị đổi cấp cũng đổi theo. Chạy lại bao nhiêu lần cũng được.
 *
 * --thu : chỉ in kết quả, không ghi file.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const thu = args.includes('--thu');
const duongDan = resolve(args.find((a) => !a.startsWith('--')) ?? 'src/data/tram-sld.json');
const data = JSON.parse(readFileSync(duongDan, 'utf8'));
const s = data.sheets.find((x) => x.code === 'TONG');
const tram = (x, y) => s.st.find((r) => r.length >= 8 && x >= r[4] && x <= r[6] && y >= r[5] && y <= r[7])?.[0] ?? '?';
const tenLop = (kv) => (kv === 0.4 ? '0,4kV' : `${kv}kV`);
const lopCua = (kv) => {
  let i = data.layers.indexOf(tenLop(kv));
  if (i < 0) {
    data.layers.push(tenLop(kv));
    i = data.layers.length - 1;
  }
  return i;
};

/* ---------- đọc nhãn tỷ số điện áp ---------- */
const capChuan = (v) =>
  v >= 200 && v <= 240 ? 220 : v >= 100 && v <= 130 ? 110 : v >= 30 && v <= 40 ? 35 : v >= 20 && v <= 25 ? 22 : v >= 9 && v <= 12 ? 10 : v >= 5.5 && v <= 7 ? 6 : null;
function docNhan(text) {
  const tok = String(text).split('/');
  const soTrong = tok.map((t) =>
    (t.replace(/[±+]\s*\(?\s*\d+\s*[xX×]\s*[\d.,]+\s*%+\)?/g, '').replace(/[()]/g, ' ').match(/\d+(?:[.,]\d+)?/g) ?? []).map((v) =>
      Number(v.replace(',', '.')),
    ),
  );
  for (let i = 0; i < tok.length; i++) {
    // cuộn cao áp: số cuối cùng trong đoạn ứng với 110 / 220kV ("40 MVA 115")
    const hvSo = [...soTrong[i]].reverse().find((v) => capChuan(v) === 110 || capChuan(v) === 220);
    if (hvSo === undefined) continue;
    const hv = capChuan(hvSo);
    const kq = [hv];
    for (let j = i + 1; j < tok.length; j++) {
      // các cuộn sau: số ĐẦU TIÊN của đoạn ("23 kV Yo", "(6,3) kV", "38,5+2x2.5%")
      const c = soTrong[j].length ? capChuan(soTrong[j][0]) : null;
      if (c === null || c > hv) break;
      kq.push(c);
      if (/k\s*v/i.test(tok[j])) break;
    }
    if (kq.length >= 2) return kq;
  }
  return null;
}
const nhanTyso = s.t.map((t) => ({ t, kv: docNhan(t[8]) })).filter((x) => x.kv);

/* ---------- hình học ---------- */
const kcDoan = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  const L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
  return Math.hypot(ax + t * dx - px, ay + t * dy - py);
};
const diemCua = (r) => {
  const p = [];
  for (let k = 4; k + 1 < r.length; k += 2) p.push([r[k], r[k + 1]]);
  return p;
};
const dai = (p) => p.slice(1).reduce((a, q, i) => a + Math.hypot(q[0] - p[i][0], q[1] - p[i][1]), 0);

/**
 * Dây đấu vào từng cuộn: tuyến có một đầu nằm trong (hoặc chạm mép) cuộn, đoạn đầu
 * nằm ngang / dọc, đầu kia ra ngoài máy. Trả về [{r (hàng tuyến), kv, L}] mỗi cuộn.
 */
function dayVaoCuon(cuon) {
  return cuon.map((c) => {
    const ds = [];
    for (const r of s.b) {
      const p = diemCua(r);
      if (p.length < 2) continue;
      for (const [a, b, o] of [
        [p[0], p[1], p[p.length - 1]],
        [p[p.length - 1], p[p.length - 2], p[0]],
      ]) {
        if (Math.hypot(a[0] - c.x, a[1] - c.y) > c.r * 1.3) continue;
        // đầu dây thuộc cuộn GẦN NHẤT (điểm trung tính nằm giữa hai cuộn...)
        const kcTa = Math.hypot(a[0] - c.x, a[1] - c.y) / c.r;
        if (cuon.some((c2) => c2 !== c && Math.hypot(a[0] - c2.x, a[1] - c2.y) / c2.r < kcTa)) continue;
        const dx = Math.abs(b[0] - a[0]);
        const dy = Math.abs(b[1] - a[1]);
        // đầu dây ở điểm sao (tâm cuộn): dây trung tính nối đất, có thể vẽ xiên
        const sao = Math.hypot(a[0] - c.x, a[1] - c.y) < c.r * 0.6;
        if (!sao && Math.min(dx, dy) > Math.max(dx, dy) * 0.18) continue;
        if (cuon.some((c2) => Math.hypot(o[0] - c2.x, o[1] - c2.y) < c2.r * 1.05)) continue;
        // nét vắt qua cuộn dây khác (mũi tên điều áp) không phải dây của cuộn này
        const qua = cuon.some((c2) => {
          if (c2 === c) return false;
          for (let k = 1; k < p.length; k++) if (kcDoan(c2.x, c2.y, p[k - 1][0], p[k - 1][1], p[k][0], p[k][1]) < c2.r * 0.9) return true;
          return false;
        });
        if (qua) continue;
        ds.push({ r, kv: r[1], L: dai(p), sao, xien: Math.min(dx, dy) > Math.max(dx, dy) * 0.18 });
        break;
      }
    }
    return ds;
  });
}

/** Gán cấp cho các cuộn theo nhãn. Trả về mảng kV hoặc null. */
function ganCap(cuon, dayDu, L, caoAp) {
  // nét xiên (dây trung tính vẽ xiên) không dùng để suy cấp cuộn dây
  const day = dayDu.map((ds) => ds.filter((d) => !d.xien));
  // cuộn cao áp: block thì luôn là cuộn 0; vẽ vòng tròn thì là vòng đang tô 110kV
  let cao = caoAp ?? -1;
  if (cao < 0) {
    const ds110 = cuon.map((c, i) => (c.kv >= 110 ? i : -1)).filter((i) => i >= 0);
    if (ds110.length === 1) cao = ds110[0];
  }
  if (cao < 0) {
    const kvDay = day.map((ds) => (ds.length ? Math.max(...ds.map((d) => d.kv)) : null));
    cao = kvDay.findIndex((k) => k !== null && k >= 110);
  }
  if (cao < 0) cao = 0;
  const kq = cuon.map(() => null);
  kq[cao] = L[0];
  const con = L.slice(1);
  const thuTu = cuon
    .map((_, i) => i)
    .filter((i) => i !== cao)
    .sort((a, b) => Math.max(0, ...day[b].map((d) => d.L)) - Math.max(0, ...day[a].map((d) => d.L)));
  // cuộn có dây trung áp đấu vào: giữ cấp của dây (dây dài nhất trước)
  for (const i of thuTu) {
    const ds = [...day[i]].sort((a, b) => b.L - a.L);
    for (const d of ds) {
      const k = con.indexOf(d.kv);
      if (k >= 0) {
        kq[i] = d.kv;
        con.splice(k, 1);
        break;
      }
    }
  }
  // cuộn còn lại: lấy cấp còn lại trong nhãn
  for (const i of thuTu) if (kq[i] === null && con.length) kq[i] = con.shift();
  // nhãn ít cấp hơn số cuộn vẽ (vd "115/23" mà vẽ ký hiệu 3 cuộn): cuộn thừa lấy cấp
  // thấp nhất của nhãn
  return kq.map((k, i) => k ?? (L.length >= 2 ? L[L.length - 1] : cuon[i].kv));
}

/** Đổi cấp dây đấu vào cuộn (và chống sét van, thiết bị trên dây đó). */
let soDay = 0;
let soTB = 0;
function doiDay(dsDay, kv) {
  for (const { r, sao } of dsDay) {
    // chỉ đổi giữa các cấp trung áp - không đụng tới dây 110 / 220kV
    // (riêng dây trung tính cuộn 110kV lại vẽ nhầm lớp 220kV thì trả về 110kV)
    const nhamCao = kv === 110 && r[1] === 220;
    // dây trung tính cuộn trung / hạ áp (nối từ điểm sao xuống đất) vẽ nhầm màu 110kV
    const trungTinh = sao && kv < 110 && r[1] >= 110 && dai(diemCua(r)) < 120;
    if (r[1] === kv || ((r[1] >= 110 || kv >= 110) && !nhamCao && !trungTinh)) continue;
    // chỉ nét dây ngắn nối tới chống sét van / để hở (không phải dây ra thanh cái)
    if (dai(diemCua(r)) > 200) continue;
    if (thu) console.log(`    dây ${tram(r[4], r[5])} (${r[4].toFixed(0)}, ${r[5].toFixed(0)}) dài ${dai(diemCua(r)).toFixed(0)}: ${r[1]} → ${kv}`);
    r[1] = kv;
    r[0] = lopCua(kv);
    soDay++;
    const p = diemCua(r);
    for (const d of s.d) {
      if (d[1] === kv) continue;
      let gan = false;
      for (let k = 1; k < p.length && !gan; k++) gan = kcDoan(d[3], d[4], p[k - 1][0], p[k - 1][1], p[k][0], p[k][1]) <= Math.max(1, d[6] * 0.6);
      if (gan) {
        d[1] = kv;
        d[0] = lopCua(kv);
        soTB++;
      }
    }
  }
}

const nhanGan = (x, y, R) => {
  let tot = null;
  for (const n of nhanTyso) {
    if (tram(n.t[2], n.t[3]) !== tram(x, y)) continue;
    const d = Math.hypot(n.t[2] - x, n.t[3] - y);
    if (d < R && (!tot || d < tot.d)) tot = { d, n };
  }
  return tot?.n ?? null;
};
const ghi = [];

/* ---------- 1. Máy biến áp là block ---------- */
const CUC = {
  MBA3: [
    [-0.736, 0.919],
    [0.736, 0.355],
    [-0.704, -0.919],
  ],
  MBA2: [
    [0, 0.919],
    [0, -0.919],
  ],
};
const dsKvCuon = [];
for (const d of s.d) {
  const blk = data.blocks[d[2]];
  if (!CUC[blk]) continue;
  const m = d[9] ? -1 : 1;
  const g = (d[5] * Math.PI) / 180;
  const cuon = CUC[blk].map(([cx, cy]) => {
    const x = cx * m * d[6];
    const y = cy * d[6];
    return { x: d[3] + x * Math.cos(g) - y * Math.sin(g), y: d[4] + x * Math.sin(g) + y * Math.cos(g), r: 1.174 * d[6], kv: d[1] };
  });
  const nhan = nhanGan(d[3], d[4], 250);
  // máy tự ngẫu 220kV (AT): giữ một màu như cũ
  if (!nhan || nhan.kv[0] === 220) continue;
  const day = dayVaoCuon(cuon);
  const kv = ganCap(cuon, day, nhan.kv, 0);
  dsKvCuon.push([d[3], d[4], ...kv]);
  cuon.forEach((_, i) => doiDay(day[i], kv[i]));
  ghi.push(`  ${tram(d[3], d[4])} ${blk}: ${kv.join('/')}  ← "${String(nhan.t[8]).slice(0, 50)}"`);
}
s.kvCuon = dsKvCuon;

/* ---------- 2. Máy biến áp vẽ bằng vòng tròn ---------- */
const C = s.c.filter((c) => c[4] >= 7);
const cha = C.map((_, i) => i);
const tim = (i) => (cha[i] === i ? i : (cha[i] = tim(cha[i])));
for (let i = 0; i < C.length; i++)
  for (let j = i + 1; j < C.length; j++) {
    const dd = Math.hypot(C[i][2] - C[j][2], C[i][3] - C[j][3]);
    if (dd < (C[i][4] + C[j][4]) * 0.98 && dd > Math.min(C[i][4], C[j][4]) * 0.3) cha[tim(i)] = tim(j);
  }
const nhom = new Map();
C.forEach((c, i) => (nhom.get(tim(i)) ?? nhom.set(tim(i), []).get(tim(i))).push(c));
let soVong = 0;
for (const cs of nhom.values()) {
  if (cs.length < 2 || !cs.some((c) => c[1] >= 110)) continue;
  const cx = cs.reduce((a, c) => a + c[2], 0) / cs.length;
  const cy = cs.reduce((a, c) => a + c[3], 0) / cs.length;
  const nhan = nhanGan(cx, cy, 170);
  if (!nhan || nhan.kv[0] === 220) continue; // máy tự ngẫu 220kV: giữ nguyên
  const cuon = cs.map((c) => ({ x: c[2], y: c[3], r: c[4], kv: c[1] }));
  const day = dayVaoCuon(cuon);
  const kv = ganCap(cuon, day, nhan.kv);
  cs.forEach((c, i) => {
    if (c[1] !== kv[i]) {
      c[1] = kv[i];
      c[0] = lopCua(kv[i]);
      soVong++;
      // nét Y / Δ vẽ trong vòng tròn
      for (const r of s.b) {
        const p = diemCua(r);
        if (p.every((q) => Math.hypot(q[0] - c[2], q[1] - c[3]) < c[4] * 1.04) && r[1] !== kv[i]) {
          r[1] = kv[i];
          r[0] = lopCua(kv[i]);
        }
      }
    }
    doiDay(day[i], kv[i]);
  });
  ghi.push(`  ${tram(cx, cy)} vòng tròn: ${kv.join('/')}  ← "${String(nhan.t[8]).slice(0, 50)}"`);
}

console.log(ghi.sort().join('\n'));
console.log(`Máy biến áp: ${dsKvCuon.length} block ghi màu từng cuộn; đổi ${soVong} vòng tròn cuộn dây, ${soDay} nét dây, ${soTB} thiết bị.`);
if (!thu) writeFileSync(duongDan, JSON.stringify(data));
