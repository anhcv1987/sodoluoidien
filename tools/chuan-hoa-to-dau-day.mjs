/**
 * CHUẨN HOÁ KÝ HIỆU TỔ ĐẤU DÂY MÁY BIẾN ÁP TRẠM 110-220kV (tờ TONG).
 *
 *   node tools/chuan-hoa-to-dau-day.mjs [src/data/tram-sld.json] [--thu]
 *
 * Bản CAD gốc vẽ ký hiệu sao / tam giác trong cuộn dây mỗi trạm một kiểu: sao xiên lệch,
 * nhánh sao thò ra ngoài vòng tròn, tam giác xoay nghiêng, mũi tên điều áp đè lên nhánh
 * sao, dây trung tính đâm xuyên qua tâm... Công cụ vẽ lại cho THỐNG NHẤT với block MBA3 /
 * MBA2 (src/symbols/blocks.ts):
 *   - sao: thân thẳng đứng xuống, hai nhánh chếch lên 30°, dài nửa bán kính, tâm sao ở tâm cuộn;
 *   - tam giác: tam giác đều đỉnh hướng lên, tâm ở tâm cuộn, bán kính ngoại tiếp 0,55 bán kính cuộn;
 *   - mũi tên điều áp (cuộn nào có thì giữ cuộn đó): xiên 60° qua tâm cuộn, không trùng nhánh sao;
 *   - dao tiếp địa trung tính đặt xiên trong cuộn sao: treo thẳng dưới thân sao, thu nhỏ vừa trong cuộn.
 *
 * 1. MBA vẽ bằng VÒNG TRÒN (cụm ≥ 2 vòng tròn chồng nhau, có cuộn 110kV/220kV): bỏ mọi nét nằm
 *    gọn trong cuộn dây, nét xiên thò ra (nhánh sao vẽ quá tay, mũi tên điều áp), cắt phần nhánh
 *    sao nối liền vào dây trung tính; nhận dạng cuộn sao / tam giác theo nét cũ (nét khép kín =
 *    tam giác, có nét chạm tâm = sao) rồi vẽ lại.
 * 2. Dây (trung tính) dừng lơ lửng TRONG cuộn sao thì kéo vào đúng tâm sao: đoạn cuối nằm ngang
 *    thì kéo tới thẳng tâm rồi gập đứng vào tâm (đoạn gập trùng thân sao), đứng thì kéo thẳng vào tâm.
 *    Áp dụng cho cả MBA vẽ vòng tròn và block MBA.
 * 3. Block MBA tự ngẫu 220kV (E6.2, E6.25) đặt quay 183,73° (lệch 3,73°, sao và tam giác lộn
 *    ngược): đặt lại xoay 0° (lật ngang nếu cần) để cuộn 220kV ở trên, 110kV ở dưới, cuộn tam giác
 *    22kV bên cạnh; đầu dây đấu vào cuộn dời theo tâm cuộn mới. Ghi cấp từng cuộn (kvCuon).
 *
 * Mô hình chiều công suất (src/core/dongCongSuat.ts) bỏ qua nét nằm gọn trong cuộn dây và mũi tên
 * xiên vắt qua cuộn, mọi đầu dây trong cuộn đều nối về tâm máy - nên vẽ lại không đổi kết dây.
 * Chạy lại bao nhiêu lần cũng được (lần sau nhận lại đúng ký hiệu đã vẽ).
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
const r2 = (v) => Math.round(v * 100) / 100;
const rad = (a) => (a * Math.PI) / 180;
const kc = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const diemCua = (r) => {
  const p = [];
  for (let k = 4; k + 1 < r.length; k += 2) p.push([r[k], r[k + 1]]);
  return p;
};
const datDiem = (r, p) => {
  r.length = 4;
  for (const [x, y] of p) r.push(r2(x), r2(y));
};
/** đoạn thẳng nằm ngang / đứng / xiên */
const huong = (a, b) => {
  const dx = Math.abs(b[0] - a[0]);
  const dy = Math.abs(b[1] - a[1]);
  if (dy <= dx * 0.05) return 'ngang';
  if (dx <= dy * 0.05) return 'dung';
  return 'xien';
};
const laXien = (p) => p.every((q, k) => k === 0 || huong(p[k - 1], q) === 'xien');
function kcDenDoan(q, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L)) : 0;
  return Math.hypot(a[0] + t * dx - q[0], a[1] + t * dy - q[1]);
}
const kcDenTuyen = (q, p) => Math.min(...p.slice(1).map((b, k) => kcDenDoan(q, p[k], b)));
const doDai = (p) => p.reduce((t, q, k) => (k ? t + kc(p[k - 1], q) : 0), 0);

/* ---------- ký hiệu chuẩn (cùng tỷ lệ block MBA3) ---------- */
const SAO = [270, 30, 150];
/** đầu nét nằm sát mép vòng cuộn dây khác (rà soát cấp điện áp coi là dây đi vào cuộn đó): tránh */
const satMep = (q, khac) => khac.some((k) => Math.abs(kc(q, k.c) - k.r) < k.r * 0.2 + 0.3);
const coVua = (ds, dinh, khac) => ds.find((t) => !dinh(t).some((q) => satMep(q, khac))) ?? ds[ds.length - 1];
const kyHieuSao = (c, r, khac = []) => {
  const dau = (t) => SAO.map((g) => [c[0] + t * r * Math.cos(rad(g)), c[1] + t * r * Math.sin(rad(g))]);
  return dau(coVua([0.5, 0.45, 0.4, 0.35], dau, khac)).map((q) => [c, q]);
};
const kyHieuTamGiac = (c, r, khac = []) => {
  const dinh = (t) => [90, 210, 330].map((g) => [c[0] + t * r * Math.cos(rad(g)), c[1] + t * r * Math.sin(rad(g))]);
  const p = dinh(coVua([0.55, 0.5, 0.45, 0.4], dinh, khac));
  return [[...p, p[0]]];
};
/** mũi tên điều áp: một nét gấp [đuôi, mũi, cánh 1, mũi, cánh 2] - mọi đoạn đều xiên. Đầu đuôi, đầu mũi
 * không nằm sát vòng tròn cuộn khác (rà soát cấp điện áp coi nét có đầu chạm vòng là dây đi vào cuộn) */
const muiTen = (c, r, khac = []) => {
  const u = [Math.cos(rad(60)), Math.sin(rad(60))];
  const duoi = coVua([0.55, 0.45, 0.35, 0.25].map((t) => [c[0] - t * r * u[0], c[1] - t * r * u[1]]), (q) => [q], khac);
  const mui = [c[0] + 1.2 * r * u[0], c[1] + 1.2 * r * u[1]];
  const canh = (g) => [mui[0] + 0.3 * r * Math.cos(rad(g)), mui[1] + 0.3 * r * Math.sin(rad(g))];
  return [duoi, mui, canh(240 + 22), mui, canh(240 - 22)];
};

/* ---------- block MBA: tâm cuộn dây ---------- */
const BAN_KINH_CUON = 1.174; // = src/core/dongCongSuat.ts
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
/** cuộn sao của block (theo src/symbols/blocks.ts): MBA3 cuộn 0 và 2, MBA2 cuộn 0 */
const SAO_BLOCK = { MBA3: [0, 2], MBA2: [0] };
const tamCuonBlock = (r, rot = r[5], mir = r[9]) => {
  const b = data.blocks[r[2]];
  const m = mir ? -1 : 1;
  const g = rad(rot);
  return CUC[b].map(([cx, cy]) => {
    const x = cx * m * r[6];
    const y = cy * r[6];
    return [r[3] + x * Math.cos(g) - y * Math.sin(g), r[4] + x * Math.sin(g) + y * Math.cos(g)];
  });
};

const dauHang = new Set([...(s.vong ?? []), ...(s.nhay ?? [])].map(([x, y]) => `${x}|${y}`));
const coDinh = (r) => dauHang.has(`${r[4]}|${r[5]}`);
const xoa = new Set();
const them = [];
const dem = { mba: 0, cuon: 0, netBo: 0, catNhanh: 0, keoTam: 0, muiTen: 0, xoayAT: 0 };
const baoCao = [];

/** Kéo đầu dây dừng trong cuộn sao về tâm sao. Trả về true nếu có sửa. */
function keoVaoTam(r, c, R, chieuThan) {
  if (coDinh(r)) return false;
  const p = diemCua(r);
  let sua = false;
  for (const dau of [0, 1]) {
    const i = dau ? p.length - 1 : 0;
    const j = dau ? p.length - 2 : 1;
    const e = p[i];
    const d = kc(e, c);
    // đã tới tâm nhưng bằng một đoạn xiên ngắn sau đoạn ngang: đổi thành gập đứng (trùng thân sao)
    if (d < R * 0.04 && p.length >= 3) {
      const k = dau ? p.length - 3 : 2;
      const q = p[j];
      if (huong(q, e) === 'xien' && kc(q, c) <= R * 0.5 && huong(p[k], q) === 'ngang' && Math.sign(q[1] - c[1]) === chieuThan) {
        p[j] = [c[0], q[1]];
        sua = true;
      }
      continue;
    }
    if (d > R * 0.8) continue;
    // đầu kia của dây phải ra ngoài cuộn (dây thật, không phải nét ký hiệu)
    if (p.every((q) => kc(q, c) <= R * 1.02)) continue;
    const h = huong(p[j], e);
    let moi;
    if (h === 'ngang') {
      const dy = c[1] - e[1];
      // đoạn gập đứng phải trùng thân sao (thân hướng chieuThan, dài 0,5R)
      if (Math.abs(dy) > R * 0.04 && !(Math.sign(-dy) === chieuThan && Math.abs(dy) <= R * 0.5)) continue;
      moi = Math.abs(dy) > R * 0.04 ? [[c[0], e[1]], [c[0], c[1]]] : [[c[0], c[1]]];
    } else if (h === 'dung') {
      if (Math.abs(c[0] - e[0]) > R * 0.04) continue;
      moi = [[e[0], c[1]]];
    } else moi = [[c[0], c[1]]]; // dây xiên: kéo thẳng vào tâm
    if (dau) p.splice(i, 1, ...moi);
    else p.splice(0, 1, ...moi.reverse());
    sua = true;
  }
  if (!sua) return false;
  // bỏ điểm trùng
  const q = p.filter((v, k) => k === 0 || kc(v, p[k - 1]) > 1e-6);
  const cu = r.slice(4).join(',');
  datDiem(r, q);
  return r.slice(4).join(',') !== cu;
}

/* ================= 1. MBA vẽ bằng vòng tròn ================= */
const tron = (s.c ?? []).map((c, i) => ({ i, l: c[0], kv: c[1], c: [c[2], c[3]], r: c[4] })).filter((c) => c.r >= 8);
const cha = tron.map((_, i) => i);
const tim = (i) => (cha[i] === i ? i : (cha[i] = tim(cha[i])));
for (let i = 0; i < tron.length; i++)
  for (let j = i + 1; j < tron.length; j++) {
    const d = kc(tron[i].c, tron[j].c);
    if (d < (tron[i].r + tron[j].r) * 0.98 && d > Math.min(tron[i].r, tron[j].r) * 0.3) cha[tim(i)] = tim(j);
  }
const nhom = new Map();
tron.forEach((c, i) => (nhom.get(tim(i)) ?? nhom.set(tim(i), []).get(tim(i))).push(c));
const mbaTron = [...nhom.values()].filter((g) => g.length >= 2 && g.some((c) => c.kv >= 110) && tram(g[0].c[0], g[0].c[1]) !== '?');

const hang = s.b.map((r, i) => ({ r, i, p: diemCua(r) }));
/** đầu nét chạm cực một thiết bị (không phải MBA): nét đó là dây nối thiết bị (vd dây trung tính xuống tiếp địa) */
const chamThietBi = (q, R) => s.d.some((d) => !CUC[data.blocks[d[2]]] && Math.hypot(d[3] - q[0], d[4] - q[1]) <= Math.max(0.5 * d[6], 0.3 * R));
for (const g of mbaTron) {
  const Rmax = Math.max(...g.map((c) => c.r));
  const gan = hang.filter(({ i, p }) => !xoa.has(i) && p.some((q) => g.some((c) => kc(q, c.c) <= c.r * 3.2)));
  const trong = (q) => g.some((c) => kc(q, c.c) <= c.r * 1.03);
  const cuon = g.map(() => ({ doan: [], muiTen: false, mau: null }));
  const cuonGanTam = (q, tl = 0.25) => g.findIndex((c) => kc(q, c.c) <= c.r * tl);
  const cuonGanNhat = (q) => {
    let k = 0;
    g.forEach((c, j) => kc(q, c.c) / c.r < kc(q, g[k].c) / g[k].r && (k = j));
    return k;
  };
  const ghiNet = (j, p, r) => {
    cuon[j].doan.push(...p.slice(1).map((q, k) => [p[k], q]));
    if (!cuon[j].mau) cuon[j].mau = [r[0], r[1], r[2], r[3]];
  };
  /** sao: có đỉnh chung của ≥ 3 nét (tâm sao) hoặc nét chạm tâm; tam giác: các đỉnh đều bậc 2 */
  const loaiCuon = (j) => {
    const ds = cuon[j].doan;
    const tl = g[j].r * 0.12;
    const dinh = [];
    const bac = [];
    for (const d of ds)
      for (const q of d) {
        let k = dinh.findIndex((v) => kc(v, q) <= tl);
        if (k < 0) k = dinh.push(q) - 1;
        bac[k] = (bac[k] ?? 0) + 1;
      }
    if (bac.some((b) => b >= 3)) return 'sao';
    if (ds.length >= 3 && bac.every((b) => b === 2)) return 'tg';
    if (ds.some((d) => d.some((q) => kc(q, g[j].c) <= g[j].r * 0.25)) || cuon[j].saoDay) return 'sao';
    if (ds.length >= 3) return 'tg';
    return null;
  };
  const muiTenCu = [];
  const nhanhRa = [];
  for (const { r, i, p } of gan) {
    if (coDinh(r)) continue;
    // (a) nét nằm gọn trong cuộn dây: ký hiệu sao / tam giác
    if (p.every(trong) && p.every((q) => g.some((c) => kc(q, c.c) <= c.r * 3))) {
      const jt = p.map((q) => cuonGanTam(q)).find((j) => j >= 0);
      const j = jt ?? cuonGanNhat([p.reduce((t, q) => t + q[0], 0) / p.length, p.reduce((t, q) => t + q[1], 0) / p.length]);
      // dây trung tính ngắn nằm ngang / đứng nối thiết bị đặt trong cuộn: giữ
      if (p.length === 2 && huong(p[0], p[1]) !== 'xien' && s.d.some((d) => p.some((q) => Math.hypot(d[3] - q[0], d[4] - q[1]) < g[j].r * 0.15) && !CUC[data.blocks[d[2]]]))
        continue;
      ghiNet(j, p, r);
      xoa.add(i);
      dem.netBo++;
      continue;
    }
    // (b) nét xiên vắt qua / thò ra khỏi cuộn: mũi tên điều áp hoặc nhánh sao vẽ quá tay
    if (laXien(p)) {
      const diemMT = (k) => kcDenTuyen(g[k].c, p) / g[k].r + (g[k].kv === r[1] ? 0 : 0.5);
      const j = g.reduce((m, c, k) => (diemMT(k) < diemMT(m) ? k : m), 0);
      const c = g[j];
      if (kcDenTuyen(c.c, p) <= c.r * 0.9 && p.every((q) => kc(q, c.c) <= c.r * 3.2)) {
        const dauXa = Math.max(...p.map((q) => kc(q, c.c)));
        const dauGan = Math.min(kc(p[0], c.c), kc(p[p.length - 1], c.c));
        const xuyen =
          (doDai(p) >= c.r * 1.5 && dauGan >= c.r * 0.6) ||
          (doDai(p) >= c.r * 1.4 && kcDenTuyen(c.c, p) <= c.r * 0.15 && dauXa >= c.r * 1.1 && dauGan >= c.r * 0.15);
        const jt = p.map((q) => cuonGanTam(q)).find((k) => k >= 0);
        if (xuyen) {
          const xa = kc(p[0], c.c) > kc(p[p.length - 1], c.c) ? p[0] : p[p.length - 1];
          muiTenCu.push({ j, p, dau: [p[0], p[p.length - 1]], xa });
          cuon[j].muiTen = true;
          if (!cuon[j].mauMT) cuon[j].mauMT = [r[0], r[1], r[2], r[3]];
        } else if (jt !== undefined && doDai(p) <= g[jt].r * 2.2 && ![p[0], p[p.length - 1]].some((q) => chamThietBi(q, g[jt].r))) {
          // từ tâm cuộn đi ra: nhánh sao vẽ quá tay, hoặc mũi tên điều áp vẽ từ tâm (xét cánh sau)
          nhanhRa.push({ j: jt, p, r, i });
        } else continue;
        xoa.add(i);
        dem.netBo++;
        continue;
      }
    }
  }
  // (c) dây đi qua tâm cuộn rồi chạy tiếp trong cuộn (nhánh sao vẽ liền với dây trung tính) hoặc
  // chạy tiếp ra ngoài theo đường xiên (mũi tên điều áp vẽ liền với dây trung tính): cắt
  for (const h of gan) {
    if (xoa.has(h.i) || coDinh(h.r)) continue;
    let p = diemCua(h.r);
    for (let lan = 0; lan < 2; lan++) {
      const k = p.findIndex((q, idx) => idx > 0 && idx < p.length - 1 && cuonGanTam(q, 0.15) >= 0);
      if (k < 0) break;
      const j = cuonGanTam(p[k], 0.15);
      const c = g[j];
      const truoc = p.slice(0, k);
      const sau = p.slice(k + 1);
      const laNhanh = (ds) => ds.every((q) => kc(q, c.c) <= c.r * 1.03) || laXien([p[k], ...ds]) || laXien([p[k], ds[0]]) && doDai([p[k], ...ds]) <= c.r * 3;
      if (laNhanh(sau) && !laNhanh(truoc)) {
        if (sau.every((q) => kc(q, c.c) <= c.r * 1.03)) ghiNet(j, [p[k], ...sau], h.r);
        else nhanhRa.push({ j, p: [p[k], ...sau], r: h.r, i: -1 });
        p = p.slice(0, k + 1);
      } else if (laNhanh(truoc) && !laNhanh(sau)) {
        if (truoc.every((q) => kc(q, c.c) <= c.r * 1.03)) ghiNet(j, [...truoc, p[k]], h.r);
        else nhanhRa.push({ j, p: [...truoc, p[k]].reverse(), r: h.r, i: -1 });
        p = p.slice(k);
      } else break;
      dem.catNhanh++;
    }
    if (p.length !== h.p.length) datDiem(h.r, p);
  }
  // nét từ tâm đi ra: có cánh mũi tên ở đầu xa (hoặc tự gấp khúc thành cánh) là mũi tên điều áp
  const canhGan = (xa, R) =>
    gan.filter(({ i, r, p }) => !xoa.has(i) && !coDinh(r) && doDai(p) <= R * 2.5 && p.every((q) => kc(q, xa) <= R * 0.6));
  for (const n of nhanhRa) {
    const c = g[n.j];
    if (chamThietBi(n.p[n.p.length - 1], c.r)) {
      // dây trung tính xuống thiết bị: giữ (tách riêng nếu đã cắt khỏi dây khác)
      if (n.i >= 0) {
        xoa.delete(n.i);
        dem.netBo--;
      } else them.push([n.r[0], n.r[1], n.r[2], n.r[3], ...n.p.flat().map(r2)]);
      continue;
    }
    const xa = n.p.reduce((m, q) => (kc(q, c.c) > kc(m, c.c) ? q : m), n.p[0]);
    const canh = canhGan(xa, c.r);
    const tuGap = n.p.length >= 4;
    if (kc(xa, c.c) >= c.r * 1.2 && (canh.length || tuGap)) {
      muiTenCu.push({ j: n.j, p: n.p, xa });
      cuon[n.j].muiTen = true;
      if (!cuon[n.j].mauMT) cuon[n.j].mauMT = [n.r[0], n.r[1], n.r[2], n.r[3]];
    } else ghiNet(n.j, [n.p[0], n.p[1]], n.r);
  }
  // cánh mũi tên cũ: nét ngắn sát đầu mũi tên
  for (const m of muiTenCu)
    for (const { i } of (m.dau ?? [m.xa]).flatMap((q) => canhGan(q, g[m.j].r))) {
      xoa.add(i);
      dem.netBo++;
    }
  // nét xiên vụn (còn sót của mũi tên / nhánh sao cũ) không nối với gì quanh máy: bỏ
  for (const { r, i, p } of gan) {
    if (xoa.has(i) || coDinh(r) || !laXien(p) || doDai(p) > Rmax * 0.6) continue;
    const noi = (q) =>
      hang.some((h) => h.i !== i && !xoa.has(h.i) && diemCua(h.r).some((v) => kc(v, q) <= Rmax * 0.05)) || chamThietBi(q, Rmax);
    if (noi(p[0]) || noi(p[p.length - 1])) continue;
    xoa.add(i);
    dem.netBo++;
  }
  // nét chạm tâm của dây (đầu dây ở tâm cuộn) cũng là dấu hiệu cuộn sao
  for (const h of gan) {
    if (xoa.has(h.i)) continue;
    const p = diemCua(h.r);
    for (const e of [p[0], p[p.length - 1]]) {
      const j = cuonGanTam(e, 0.08);
      if (j >= 0) cuon[j].saoDay = true;
    }
  }
  dem.mba++;
  const moTa = [];
  g.forEach((c, j) => {
    const k = cuon[j];
    const loai = loaiCuon(j);
    const mau = k.mau ?? k.mauMT ?? [c.l, c.kv, 0, gan[0]?.r[3] ?? 0];
    if (loai === 'sao') for (const p of kyHieuSao(c.c, c.r, g.filter((x) => x !== c))) them.push([...mau.slice(0, 4), ...p.flat().map(r2)]);
    if (loai === 'tg') for (const p of kyHieuTamGiac(c.c, c.r, g.filter((x) => x !== c))) them.push([...mau.slice(0, 4), ...p.flat().map(r2)]);
    if (k.muiTen) {
      them.push([...(k.mauMT ?? mau).slice(0, 4), ...muiTen(c.c, c.r, g.filter((x) => x !== c)).flat().map(r2)]);
      dem.muiTen++;
    }
    if (loai) dem.cuon++;
    // kéo dây trung tính vào tâm sao
    // (hai lượt: lượt đầu kéo đầu dây vào tâm, lượt sau gập đoạn xiên ngắn còn lại thành đoạn đứng)
    if (loai === 'sao')
      for (let luot = 0; luot < 2; luot++) for (const h of gan) if (!xoa.has(h.i) && keoVaoTam(h.r, c.c, c.r, -1)) dem.keoTam++;
    moTa.push(`${c.kv}kV:${loai ?? '?'}${k.muiTen ? '+mũi tên' : ''}`);
  });
  baoCao.push(`  ${tram(g[0].c[0], g[0].c[1])} (${r2(g[0].c[0])}, ${r2(g[0].c[1])}) vòng tròn: ${moTa.join(' / ')}`);
}

/* ================= 3. Block MBA tự ngẫu đặt lệch góc ================= */
// Bản gốc đặt block MBA3 quay 183,73°: cuộn sao lộn ngược, nghiêng 3,73°; dây 110kV đâm vào cuộn
// tam giác, dây 22kV vào cuộn sao. Đặt lại xoay 0°: cuộn trên (sao, mũi tên) 220kV ngay dưới dây
// 220kV, cuộn dưới (sao) 110kV, cuộn tam giác 22kV phía dây 22kV đi ra (ngược phía dây 110kV).
const kvCuon = new Map((s.kvCuon ?? []).map((k) => [`${k[0]}|${k[1]}`, k]));
for (const r of s.d) {
  const b = data.blocks[r[2]];
  if (b !== 'MBA3' || Math.abs((((r[5] % 360) + 360) % 360) - 180) > 6) continue;
  const cu = tamCuonBlock(r);
  const R = BAN_KINH_CUON * r[6];
  const O = [r[3], r[4]];
  const dauGan = (h) => {
    const p = diemCua(h.r);
    const d = [0, p.length - 1].map((i) => Math.min(...cu.map((c) => kc(p[i], c))));
    const i = d[0] <= d[1] ? 0 : p.length - 1;
    return { p, i, d: Math.min(...d) };
  };
  const day = (kv) =>
    hang
      .filter((h) => !xoa.has(h.i) && h.r[1] === kv)
      .map((h) => ({ h, ...dauGan(h) }))
      .filter((x) => x.d <= R * 1.2)
      .sort((x, y) => x.d - y.d)[0];
  const d220 = day(220);
  const d110 = day(110);
  const d22 = day(22);
  if (!d220 || !d110) {
    baoCao.push(`  ${tram(...O)} MBA tự ngẫu (${O}): không thấy dây 220kV / 110kV đấu vào - bỏ qua`);
    continue;
  }
  // phía dây 110kV đi ra (theo đỉnh kế đầu dây)
  const ke110 = d110.p[d110.i ? d110.i - 1 : 1];
  const phia110 = Math.sign(ke110[0] - d110.p[d110.i][0]) || -1;
  const mir = phia110 < 0 ? 0 : 1; // không lật: cuộn tam giác bên phải
  const x220 = d220.p[d220.i][0];
  const tamMoi = (dx) => tamCuonBlock([r[0], r[1], r[2], O[0] + dx, O[1], 0, r[6], r[7], r[8], mir], 0, mir);
  const dx = x220 - tamMoi(0)[0][0];
  const [T, S, B] = tamMoi(dx);
  // 220kV: chạm đỉnh cuộn trên
  {
    const { h, p, i } = d220;
    p[i] = [T[0], T[1] + R];
    datDiem(h.r, p);
  }
  // 110kV: vào mép cuộn dưới phía dây đi ra, đỉnh kế dời theo (đoạn sau đứng)
  {
    const { h, p, i } = d110;
    const j = i ? i - 1 : 1;
    p[i] = [B[0] + phia110 * R, B[1]];
    p[j] = [p[j][0], B[1]];
    datDiem(h.r, p);
  }
  // 22kV: ra từ đáy cuộn tam giác, đỉnh kế dời ngang theo (đoạn sau nằm ngang)
  if (d22) {
    const { h, p, i } = d22;
    const j = i ? i - 1 : 1;
    p[i] = [S[0], S[1] - R];
    p[j] = [S[0], p[j][1]];
    datDiem(h.r, p);
  }
  const keyCu = `${r[3]}|${r[4]}`;
  kvCuon.delete(keyCu);
  baoCao.push(`  ${tram(...O)} MBA tự ngẫu (${O}): xoay ${r[5]}°${r[9] ? ' lật' : ''} -> 0°${mir ? ' lật' : ''}, dời ${r2(dx)}; cuộn trên 220kV, dưới 110kV, tam giác 22kV`);
  r[3] = r2(O[0] + dx);
  r[5] = 0;
  r[9] = mir;
  kvCuon.set(`${r[3]}|${r[4]}`, [r[3], r[4], 220, 22, 110]);
  dem.xoayAT++;
}

/* ================= 2. Dây trung tính dừng trong cuộn sao của block ================= */
for (const r of s.d) {
  const b = data.blocks[r[2]];
  if (!CUC[b]) continue;
  const tam = tamCuonBlock(r);
  const R = BAN_KINH_CUON * r[6];
  // thân sao của block hướng xuống theo hệ block: quay theo góc đặt
  const than = Math.round(Math.cos(rad(r[5]))) || 1;
  for (const j of SAO_BLOCK[b]) for (const h of hang) if (!xoa.has(h.i) && keoVaoTam(h.r, tam[j], R, -than)) dem.keoTam++;
}

/* ================= 4. Dao tiếp địa trung tính đặt xiên trong cuộn sao ================= */
// Block TD (src/symbols/blocks.ts): trục đứng, cực trên ở +0,327 x tỷ lệ, dài 0,653 x tỷ lệ.
const cuonSao = [];
for (const g of mbaTron) for (const c of g) cuonSao.push({ c: c.c, r: c.r });
for (const r of s.d) {
  const b = data.blocks[r[2]];
  if (!CUC[b]) continue;
  const tam = tamCuonBlock(r);
  for (const j of SAO_BLOCK[b]) cuonSao.push({ c: tam[j], r: BAN_KINH_CUON * r[6] });
}
const iTD = data.blocks.indexOf('TD');
let treoTD = 0;
for (const r of s.d) {
  if (r[2] !== iTD) continue;
  const cs = cuonSao.find((q) => kc([r[3], r[4]], q.c) <= q.r * 0.6);
  if (!cs) continue;
  const sc = r2((cs.r * 0.42) / 0.653);
  const x = r2(cs.c[0]);
  const y = r2(cs.c[1] - cs.r * 0.5 - 0.327 * sc);
  if (r[3] === x && r[4] === y && r[5] === 0 && r[6] === sc && !r[9]) continue;
  Object.assign(r, { 3: x, 4: y, 5: 0, 6: sc, 9: 0 });
  treoTD++;
}

s.b = s.b.filter((_, i) => !xoa.has(i)).concat(them);
s.kvCuon = [...kvCuon.values()];

console.log(baoCao.join('\n'));
console.log(
  `MBA vẽ vòng tròn: ${dem.mba} máy, vẽ lại ${dem.cuon} cuộn (${dem.muiTen} mũi tên điều áp), bỏ ${dem.netBo} nét cũ, cắt ${dem.catNhanh} nhánh sao liền dây; ` +
    `kéo ${dem.keoTam} đầu dây trung tính vào tâm sao; đặt lại góc ${dem.xoayAT} MBA tự ngẫu; treo lại ${treoTD} dao tiếp địa trung tính.`,
);
if (!thu) writeFileSync(duongDan, JSON.stringify(data));
