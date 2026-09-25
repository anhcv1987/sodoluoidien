/**
 * RÀ SOÁT VÀ SỬA CẤP ĐIỆN ÁP (MÀU) THEO LIÊN KẾT ĐIỆN.
 *
 *   node tools/ra-soat-cap-dien-ap.mjs [src/data/tram-sld.json]
 *
 * Cấp điện áp của đường dây / thiết bị khi nhập từ CAD lấy theo TÊN LỚP. Bản vẽ gốc
 * có chỗ vẽ nhầm lớp - ví dụ các hộp "SEVT quản lý" ở E6.14 vẽ máy cắt hợp bộ, máy
 * biến áp 22/6kV của khách hàng trên lớp 35kV - nên bị tô màu vàng 35kV dù đấu vào
 * lộ 22kV.
 *
 * Cách rà: dựng mô hình liên kết điện (src/core/lienket.ts - cùng mô hình phần mềm
 * dùng để tô sáng mạch). Mỗi "đảo điện" gồm các tuyến dây và thiết bị nối thông với
 * nhau KHÔNG qua máy biến áp, nên phải cùng một cấp điện áp. Cấp của đảo lấy theo
 * đa số (tính theo chiều dài dây); phần nào lệch thì sửa theo đảo:
 *
 *   - tuyến dây, thiết bị (máy cắt, máy cắt hợp bộ, dao, TI, TU...) lệch cấp;
 *   - vòng tròn cuộn dây máy biến áp vẽ tay: cuộn có dây của đảo chạm vào lấy cấp
 *     của đảo; cuộn còn lại (phía hạ áp) lấy theo nhãn "22/6kV", "35/0,4kV"...;
 *   - nét mũi tên điều áp / nét trang trí nằm trong cuộn dây: theo màu cuộn dây.
 *
 * Chỉ sửa khi đảo có cấp áp đảo rõ ràng (≥ 70% chiều dài dây), để không lan sai qua
 * chỗ bản vẽ vô tình chạm nhau. Chạy lại bao nhiêu lần cũng được.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const duongDan = resolve(process.argv[2] ?? 'src/data/tram-sld.json');
const tmp = mkdtempSync(join(tmpdir(), 'kv-'));
const bundle = join(tmp, 'lienket.mjs');
execFileSync('npx', ['esbuild', 'src/core/lienket.ts', '--bundle', '--format=esm', '--platform=node', `--outfile=${bundle}`, '--log-level=warning'], {
  stdio: 'inherit',
});
const { dungMangDien } = await import(pathToFileURL(bundle).href);
rmSync(tmp, { recursive: true, force: true });

const data = JSON.parse(readFileSync(duongDan, 'utf8'));
const s = data.sheets.find((x) => x.code === 'TONG');
const tram = (x, y) => s.st.find((r) => r.length >= 8 && x >= r[4] && x <= r[6] && y >= r[5] && y <= r[7])?.[0] ?? '?';
const SRC_KET_LUOI = data.srcLayers.indexOf('Kết lưới 110kV');
const CAP = [500, 220, 110, 35, 22, 10, 6, 0.4];
const tenLop = (kv) => (kv === 0.4 ? '0,4kV' : `${kv}kV`);
const lopCua = (kv) => {
  let i = data.layers.indexOf(tenLop(kv));
  if (i < 0) {
    data.layers.push(tenLop(kv));
    i = data.layers.length - 1;
  }
  return i;
};

/* ---------- 1. Dựng đối tượng cho mô hình liên kết ---------- */
const diemNut = new Map();
const ents = [];
// Nét nằm TRONG vòng tròn cuộn dây MBA vẽ tay (hình sao / tam giác, dây vào tâm
// cuộn) nối liền hai phía cao - hạ áp trên hình vẽ: không đưa vào mô hình, nếu
// không đảo điện sẽ "rò" qua máy biến áp.
const cuonDay = (s.c ?? []).filter((c) => c[4] >= 7);
const trongCuon = (x, y) => cuonDay.some((c) => Math.hypot(x - c[2], y - c[3]) < c[4] * 0.97);
const noiBoMBA = new Set();
s.b.forEach((r, i) => {
  for (let k = 4; k + 1 < r.length; k += 2) if (trongCuon(r[k], r[k + 1])) noiBoMBA.add(i);
});
s.b.forEach((r, i) => {
  if (r[3] === SRC_KET_LUOI) return; // đường dây liên trạm đã đúng 110kV
  if (noiBoMBA.has(i)) return;
  const nodes = [];
  for (let k = 4; k + 1 < r.length; k += 2) {
    const id = `n${i}_${k}`;
    diemNut.set(id, { x: r[k], y: r[k + 1] });
    nodes.push(id);
  }
  if (nodes.length >= 2) ents.push({ id: `b${i}`, kind: 'branch', layer: data.layers[r[0]], kv: r[1], nodes });
});
s.d.forEach((r, i) => {
  ents.push({
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
  });
});
const mang = dungMangDien(ents, (id) => diemNut.get(id));

/* ---------- 2. Cấp điện áp "có thật" của từng trạm ---------- */
// Theo tên thanh cái (C3x = 35kV, C4x = 22kV, C6x = 6kV... - TT 06/2025/TT-BCT) và
// theo chiều dài dây: cấp trung áp chiếm từ 15% chiều dài dây trung áp của trạm trở
// lên cũng coi là có thật (có trạm không ghi tên thanh cái).
const TRUNG_AP = new Set([35, 22, 10, 6, 0.4]);
const SO_CAP = { 1: 110, 2: 220, 3: 35, 4: 22, 5: 500, 6: 6, 7: 10, 9: 0.4 };
const daiTuyen = (r) => {
  let L = 0;
  for (let k = 6; k + 1 < r.length; k += 2) L += Math.hypot(r[k] - r[k - 2], r[k + 1] - r[k - 1]);
  return L;
};
const capTram = new Map();
const themCap = (t, kv) => {
  if (!capTram.has(t)) capTram.set(t, new Set());
  capTram.get(t).add(kv);
};
for (const t of s.t) {
  const m = String(t[8]).trim().match(/^C\s?([1-9])\d$/i);
  if (m && SO_CAP[m[1]]) themCap(tram(t[2], t[3]), SO_CAP[m[1]]);
}
{
  const dai = new Map();
  s.b.forEach((r) => {
    if (!TRUNG_AP.has(r[1])) return;
    const t = tram(r[4], r[5]);
    const m = dai.get(t) ?? new Map();
    m.set(r[1], (m.get(r[1]) ?? 0) + daiTuyen(r));
    dai.set(t, m);
  });
  for (const [t, m] of dai) {
    const tong = [...m.values()].reduce((x, y) => x + y, 0);
    for (const [kv, L] of m) if (L >= 0.15 * tong) themCap(t, kv);
  }
}
/** Phần tử trung áp mang cấp mà trạm KHÔNG có -> nghi vẽ nhầm lớp. */
const nghiSai = (x, y, kv) => {
  const c = capTram.get(tram(x, y));
  return !!c && TRUNG_AP.has(kv) && !c.has(kv) && [...c].some((k) => TRUNG_AP.has(k));
};

/* ---------- 3. Cấp đúng theo đảo điện ---------- */
const daoCuaTuyen = (i) => {
  const n = mang.nutCua.get(`b${i}`);
  return n === undefined ? -1 : mang.daoCuaNut[n];
};
const laMBA = (b) => /^(MBA|AT)/.test(b);
// Mỗi đảo: các cấp trung áp "có thật" của trạm xuất hiện trong đảo
const capDao = new Map();
s.b.forEach((r, i) => {
  const d = daoCuaTuyen(i);
  if (d < 0 || nghiSai(r[4], r[5], r[1]) || !TRUNG_AP.has(r[1])) return;
  if (!capDao.has(d)) capDao.set(d, new Set());
  capDao.get(d).add(r[1]);
});
const capDung = (d) => {
  const c = capDao.get(d);
  return c && c.size === 1 ? [...c][0] : undefined;
};

const doi = { tuyen: 0, thietBi: 0, vong: 0, net: 0 };
const theoTram = {};
const ghi = (x, y, loai, tu, den) => {
  const k = `${tram(x, y)} ${loai} ${tu}→${den}kV`;
  theoTram[k] = (theoTram[k] ?? 0) + 1;
};
s.b.forEach((r, i) => {
  if (!nghiSai(r[4], r[5], r[1])) return;
  const kv = capDung(daoCuaTuyen(i));
  if (kv === undefined) return;
  ghi(r[4], r[5], 'dây', r[1], kv);
  r[1] = kv;
  r[0] = lopCua(kv);
  doi.tuyen++;
});
s.d.forEach((r, i) => {
  const b = data.blocks[r[2]];
  if (laMBA(b) || !nghiSai(r[3], r[4], r[1])) return;
  const cs = mang.cucCua.get(`d${i}`) ?? [];
  const cac = new Set(cs.filter((c) => c.batDuoc).map((c) => capDung(mang.daoCuaNut[c.nut])).filter((v) => v !== undefined));
  if (cac.size !== 1) return;
  const kv = [...cac][0];
  ghi(r[3], r[4], b, r[1], kv);
  r[1] = kv;
  r[0] = lopCua(kv);
  doi.thietBi++;
});

/* ---------- 3a. Đảo điện có thiết bị lẫn hai cấp: theo nhãn ngăn lộ ----------
 * Ví dụ phía 23kV cuộn thứ ba MBA tự ngẫu AT2 E6.16: ngăn 432 (22kV) đúng màu nhưng
 * dây, TU, chống sét van vẽ trên lớp 110kV. Nhãn ngăn lộ (TT 06/2025/TT-BCT: chữ
 * số đầu 1 = 110kV, 3 = 35kV, 4 = 22kV, 6 = 6kV...) quanh các thiết bị của đảo cùng
 * chỉ một cấp trung áp -> cả đảo theo cấp đó.
 */
{
  const capNhan = (t) => {
    const m = String(t).trim().match(/^(?:TI|TU|TUC|MC|DCL)?\s?-?\s?([1-9])\d{2}(?:-\d{1,2})?$/i);
    return m ? SO_CAP[m[1]] : undefined;
  };
  const nhanCo = s.t.map((t) => ({ x: t[2], y: t[3], kv: capNhan(t[8]) })).filter((t) => t.kv !== undefined);
  const tbTheoDao = new Map();
  s.d.forEach((r, i) => {
    if (laMBA(data.blocks[r[2]])) return;
    for (const c of mang.cucCua.get(`d${i}`) ?? []) {
      if (!c.batDuoc) continue;
      const d = mang.daoCuaNut[c.nut];
      if (!tbTheoDao.has(d)) tbTheoDao.set(d, new Set());
      tbTheoDao.get(d).add(i);
    }
  });
  const tuyenCuaDao = new Map();
  s.b.forEach((_, i) => {
    const d = daoCuaTuyen(i);
    if (d < 0) return;
    if (!tuyenCuaDao.has(d)) tuyenCuaDao.set(d, []);
    tuyenCuaDao.get(d).push(i);
  });
  for (const [d, tbs] of tbTheoDao) {
    const ds = [...tbs].map((i) => s.d[i]);
    const capTB = new Set(ds.map((r) => r[1]));
    if (capTB.size < 2 || (tuyenCuaDao.get(d)?.length ?? 0) > 40) continue;
    const capN = new Set();
    for (const r of ds) {
      for (const t of nhanCo) if (Math.hypot(t.x - r[3], t.y - r[4]) < Math.max(3 * r[6], 30)) capN.add(t.kv);
    }
    if (capN.size !== 1) continue;
    const kv = [...capN][0];
    if (!TRUNG_AP.has(kv) || !capTB.has(kv)) continue;
    for (const r of ds) {
      if (r[1] === kv) continue;
      ghi(r[3], r[4], data.blocks[r[2]], r[1], kv);
      r[1] = kv;
      r[0] = lopCua(kv);
      doi.thietBi++;
    }
    for (const i of tuyenCuaDao.get(d) ?? []) {
      const r = s.b[i];
      if (r[1] === kv) continue;
      ghi(r[4], r[5], 'dây', r[1], kv);
      r[1] = kv;
      r[0] = lopCua(kv);
      doi.tuyen++;
    }
    // TU / ký hiệu vẽ bằng vòng tròn nhỏ treo trên đảo này (cả cụm vòng chồng nhau)
    const dsVong = s.c ?? [];
    const cham = new Set();
    dsVong.forEach((c, j) => {
      if (c[4] >= 7) return;
      for (const i of tuyenCuaDao.get(d) ?? []) {
        const r = s.b[i];
        for (let k = 4; k + 1 < r.length; k += 2) if (Math.abs(Math.hypot(r[k] - c[2], r[k + 1] - c[3]) - c[4]) < c[4] * 0.15 + 0.3) cham.add(j);
      }
    });
    let them = true;
    while (them) {
      them = false;
      dsVong.forEach((c, j) => {
        if (cham.has(j) || c[4] >= 7) return;
        if ([...cham].some((k) => Math.hypot(dsVong[k][2] - c[2], dsVong[k][3] - c[3]) < (dsVong[k][4] + c[4]) * 0.98)) {
          cham.add(j);
          them = true;
        }
      });
    }
    for (const j of cham) {
      const c = dsVong[j];
      if (c[1] === kv) continue;
      ghi(c[2], c[3], 'vòng TU', c[1], kv);
      c[1] = kv;
      c[0] = lopCua(kv);
      doi.vong++;
    }
  }
}

/* ---------- 3b. Thiết bị khác màu với chính đoạn dây nó nằm trên ----------
 * Mọi cực của thiết bị bắt vào dây cùng MỘT cấp, riêng thiết bị lại mang cấp khác
 * (ký hiệu đặt trên lớp CAD của cấp khác) -> theo cấp của dây.
 */
{
  const kvNut = new Map();
  s.b.forEach((r, i) => {
    const n = mang.nutCua.get(`b${i}`);
    if (n === undefined) return;
    if (!kvNut.has(n)) kvNut.set(n, new Set());
    kvNut.get(n).add(r[1]);
  });
  s.d.forEach((r, i) => {
    const b = data.blocks[r[2]];
    if (laMBA(b) || r[0] === data.layers.indexOf('Khung bản vẽ')) return;
    const cs = (mang.cucCua.get(`d${i}`) ?? []).filter((c) => c.batDuoc);
    if (!cs.length) return;
    const ks = new Set();
    for (const c of cs) for (const k of kvNut.get(c.nut) ?? []) ks.add(k);
    if (ks.size !== 1) return;
    const kv = [...ks][0];
    if (kv === r[1]) return;
    ghi(r[3], r[4], b, r[1], kv);
    r[1] = kv;
    r[0] = lopCua(kv);
    doi.thietBi++;
  });
}

/* ---------- 4. Cuộn dây máy biến áp vẽ bằng vòng tròn ---------- */
// Nhãn tỷ số "22/6kV", "35/0,4kV", "115/38,5/23kV" gần cuộn dây
const CAP_GAN = (v) => CAP.reduce((a, c) => (Math.abs(c - v) < Math.abs(a - v) ? c : a), CAP[0]);
const tySo = s.t
  .map((t) => {
    const m = String(t[8]).replace(/,/g, '.').match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?\s*kv/i);
    if (!m) return null;
    const ds = [m[1], m[2], m[3]].filter(Boolean).map((v) => CAP_GAN(Number(v)));
    return { x: t[2], y: t[3], ds };
  })
  .filter(Boolean);
const doanTuyen = [];
s.b.forEach((r, i) => {
  for (let k = 4; k + 3 < r.length; k += 2) doanTuyen.push({ i, a: [r[k], r[k + 1]], b: [r[k + 2], r[k + 3]] });
});
const kcDoan = (p, a, b) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0;
  return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]);
};
const vong = (s.c ?? []).map((c, j) => ({ j, c, cap: null }));
for (const v of vong) {
  const [, , x, y, R] = v.c;
  if (R < 2.5) continue;
  // đầu dây chạm vòng (cuộn dây) hoặc dây xuyên qua tâm (TI)
  const cac = new Set();
  for (const q of doanTuyen) {
    const kv = s.b[q.i][1];
    const cham = [q.a, q.b].some((p) => Math.abs(Math.hypot(p[0] - x, p[1] - y) - R) < R * 0.12 + 0.3);
    const xuyen = kcDoan([x, y], q.a, q.b) < R * 0.15;
    if (cham || xuyen) cac.add(kv);
  }
  // chỉ lấy theo dây trung áp (cuộn cao áp của MBA chính giữ nguyên màu)
  if (cac.size === 1 && TRUNG_AP.has([...cac][0])) v.cap = [...cac][0];
}
// Cuộn còn lại của cặp / bộ ba cuộn chồng nhau: lấy cấp khác trong nhãn tỷ số
for (const v of vong) {
  if (v.cap !== null) continue;
  const [, , x, y, R] = v.c;
  if (R < 2.5) continue;
  const ban = vong.filter((u) => u !== v && u.cap !== null && Math.hypot(u.c[2] - x, u.c[3] - y) < (u.c[4] + R) * 0.95 && Math.abs(u.c[4] - R) < R * 0.3);
  if (!ban.length) continue;
  const daCo = new Set(ban.map((u) => u.cap));
  let nhan = null;
  for (const t of tySo) {
    const d = Math.hypot(t.x - x, t.y - y);
    if (d < R * 6 && (!nhan || d < nhan.d) && t.ds.some((k) => daCo.has(k))) nhan = { d, t };
  }
  if (!nhan) continue;
  const con = nhan.t.ds.filter((k) => !daCo.has(k));
  if (con.length === 1 || (con.length && ban.length === 1)) v.cap = con[con.length - 1];
}
// Cặp cuộn dây (MBA 2 cuộn vẽ bằng hai vòng tròn chồng nhau) vừa rà: cuộn có dây
// từ ngoài đi vào là cuộn cao áp; cuộn kia là cuộn hạ áp, lấy cấp thấp trong nhãn
// tỷ số gần đó ("22/6kV" -> 6kV). MBA không ghi tỷ số thì lấy như các MBA cùng loại
// đã rõ tỷ số trong cùng trạm (các MBA khách hàng 22/6kV vẽ giống nhau).
const tySoTram = new Map(); // "trạm|cấp cao" -> cấp hạ
for (const luot of [1, 2])
for (const v of vong) {
  if (v.cap === null || !nghiSai(v.c[2], v.c[3], v.c[1])) continue;
  const [, , x, y, R] = v.c;
  const ban = vong.filter((u) => u !== v && u.cap === v.cap && Math.abs(u.c[4] - R) < R * 0.3 && Math.hypot(u.c[2] - x, u.c[3] - y) < 2 * R * 0.97 && Math.hypot(u.c[2] - x, u.c[3] - y) > R * 0.5);
  if (ban.length !== 1) continue;
  const u = ban[0];
  let nhan = null;
  for (const t of tySo) {
    const d = Math.min(Math.hypot(t.x - x, t.y - y), Math.hypot(t.x - u.c[2], t.y - u.c[3]));
    if (d < R * 8 && t.ds.length === 2 && t.ds.includes(v.cap) && (!nhan || d < nhan.d)) nhan = { d, t };
  }
  const khoaTS = `${tram(x, y)}|${v.cap}`;
  let ha = nhan ? nhan.t.ds.find((k) => k !== v.cap) : undefined;
  if (ha === undefined) {
    if (luot === 1) continue;
    ha = tySoTram.get(khoaTS);
  }
  if (ha === undefined || ha > v.cap) continue;
  if (nhan) tySoTram.set(khoaTS, ha);
  // dây từ ngoài vào: đầu mút nằm trên vòng, đầu kia ra xa cả hai vòng
  const dayVao = (c) =>
    doanTuyen.some((q) =>
      [
        [q.a, q.b],
        [q.b, q.a],
      ].some(([p, o]) => Math.abs(Math.hypot(p[0] - c[2], p[1] - c[3]) - c[4]) < c[4] * 0.12 + 0.3 && Math.hypot(o[0] - c[2], o[1] - c[3]) > c[4] * 1.5 && Math.hypot(o[0] - (c === v.c ? u.c : v.c)[2], o[1] - (c === v.c ? u.c : v.c)[3]) > c[4] * 1.5),
    );
  const vVao = dayVao(v.c);
  const uVao = dayVao(u.c);
  if (vVao && !uVao) u.cap = ha;
  else if (uVao && !vVao) v.cap = ha;
}
for (const v of vong) {
  if (v.cap === null || v.cap === v.c[1] || !nghiSai(v.c[2], v.c[3], v.c[1])) continue;
  ghi(v.c[2], v.c[3], 'cuộn dây/vòng', v.c[1], v.cap);
  v.c[1] = v.cap;
  v.c[0] = lopCua(v.cap);
  doi.vong++;
}

/* ---------- 4b. Cuộn dây MBA vẽ tay tô sai màu ----------
 * Cuộn dây (vòng tròn lớn) mà MỌI dây từ ngoài đi vào (đầu dây nằm trên vòng, đầu
 * kia ra xa mọi cuộn dây) cùng một cấp khác màu cuộn -> lấy cấp của dây đó. Ví dụ
 * cuộn 110kV của MBA T1 E26.3 tô vàng 35kV, cuộn 22kV của MBA E6.13 tô đỏ 110kV.
 */
// Cấp theo THIẾT BỊ trên đảo điện (đoạn dây vào cuộn có khi cũng vẽ nhầm lớp):
// đảo nhỏ có thiết bị cùng một cấp thì lấy cấp đó cho cả dây lẫn cuộn
const tbDao = new Map();
for (const [id, cs] of mang.cucCua) {
  const r = s.d[Number(id.slice(1))];
  if (laMBA(data.blocks[r[2]])) continue;
  for (const c of cs) {
    if (!c.batDuoc) continue;
    const d = mang.daoCuaNut[c.nut];
    if (!tbDao.has(d)) tbDao.set(d, new Set());
    tbDao.get(d).add(r[1]);
  }
}
const tuyenDao = new Map();
s.b.forEach((_, i) => {
  const d = daoCuaTuyen(i);
  if (d < 0) return;
  if (!tuyenDao.has(d)) tuyenDao.set(d, []);
  tuyenDao.get(d).push(i);
});
const capTheoTB = (i) => {
  const d = daoCuaTuyen(i);
  if (d < 0 || (tuyenDao.get(d)?.length ?? 99) > 12) return undefined;
  const t = tbDao.get(d);
  if (t && t.size === 1) return [...t][0];
  if (t && t.size > 1) return undefined;
  // đảo chỉ có dây: lấy cấp chiếm đa số chiều dài (từ 55%)
  const m = new Map();
  let tong = 0;
  for (const j of tuyenDao.get(d)) {
    const L = daiTuyen(s.b[j]);
    m.set(s.b[j][1], (m.get(s.b[j][1]) ?? 0) + L);
    tong += L;
  }
  for (const [kv, L] of m) if (tong > 0 && L / tong >= 0.55) return kv;
  return undefined;
};
for (const v of vong) {
  const [, , x, y, R] = v.c;
  if (R < 7) continue;
  const ks = new Set();
  const dayVao = [];
  for (const q of doanTuyen) {
    for (const [p, o] of [
      [q.a, q.b],
      [q.b, q.a],
    ]) {
      if (Math.abs(Math.hypot(p[0] - x, p[1] - y) - R) >= R * 0.12 + 0.3) continue;
      if (Math.hypot(o[0] - x, o[1] - y) <= R * 1.3) continue;
      if (cuonDay.some((u) => Math.hypot(o[0] - u[2], o[1] - u[3]) < u[4] * 1.05)) continue;
      ks.add(capTheoTB(q.i) ?? s.b[q.i][1]);
      dayVao.push(q.i);
    }
  }
  if (ks.size !== 1) continue;
  const kv = [...ks][0];
  // cuộn chung 220/110kV của MBA tự ngẫu giữ nguyên; chỉ đổi cuộn thứ ba (trung áp)
  if (kv === 220 || (v.c[1] === 220 && !TRUNG_AP.has(kv))) continue;
  // đoạn dây vào cuộn vẽ nhầm lớp (khác cấp thiết bị trên nó) -> sửa cả đảo nhỏ đó
  for (const i of dayVao) {
    if (capTheoTB(i) !== kv) continue;
    for (const j of tuyenDao.get(daoCuaTuyen(i)) ?? []) {
      const r = s.b[j];
      if (r[1] === kv) continue;
      ghi(r[4], r[5], 'dây vào cuộn MBA', r[1], kv);
      r[1] = kv;
      r[0] = lopCua(kv);
      doi.tuyen++;
    }
  }
  if (kv === v.c[1]) continue;
  ghi(x, y, 'cuộn dây MBA', v.c[1], kv);
  v.c[1] = kv;
  v.c[0] = lopCua(kv);
  doi.vong++;
}

/* ---------- 5. Nét lẻ nằm trên cuộn dây (mũi tên điều áp...) ---------- */
// Tuyến không thuộc đảo nào có cấp rõ, nằm cắt ngang cuộn dây -> theo màu cuộn dây
const soTuyenDao = new Map();
s.b.forEach((_, i) => {
  const d = daoCuaTuyen(i);
  soTuyenDao.set(d, (soTuyenDao.get(d) ?? 0) + 1);
});
const daoCoThietBi = new Set();
for (const cs of mang.cucCua.values()) for (const c of cs) if (c.batDuoc) daoCoThietBi.add(mang.daoCuaNut[c.nut]);
s.b.forEach((r, i) => {
  const dao = daoCuaTuyen(i);
  // chỉ nét lẻ: đảo tối đa 2 tuyến, không thiết bị nào đấu vào
  if (!noiBoMBA.has(i) && ((soTuyenDao.get(dao) ?? 0) > 2 || daoCoThietBi.has(dao))) return;
  const pts = [];
  for (let k = 4; k + 1 < r.length; k += 2) pts.push([r[k], r[k + 1]]);
  const tren = vong.filter((v) => v.c[4] >= 7 && pts.some((p) => Math.hypot(p[0] - v.c[2], p[1] - v.c[3]) < v.c[4] * 2.2) && kcDoan([v.c[2], v.c[3]], pts[0], pts[pts.length - 1]) < v.c[4] * 1.1);
  if (!tren.length) return;
  // nét nằm trọn trong đúng một cuộn dây (hình sao / tam giác) -> màu cuộn đó;
  // nét vắt qua nhiều cuộn (mũi tên điều áp) đang nghi sai cấp -> màu cuộn cao áp
  const chua = tren.filter((v) => pts.every((p) => Math.hypot(p[0] - v.c[2], p[1] - v.c[3]) < v.c[4] * 1.04));
  let kv;
  if (chua.length === 1) kv = chua[0].c[1];
  else if (nghiSai(r[4], r[5], r[1])) kv = Math.max(...tren.map((v) => v.c[1]));
  else return;
  if (kv === r[1]) return;
  ghi(r[4], r[5], 'nét trên cuộn dây', r[1], kv);
  r[1] = kv;
  r[0] = lopCua(kv);
  doi.net++;
});

writeFileSync(duongDan, JSON.stringify(data));
console.log(
  `Sửa cấp điện áp theo liên kết điện: ${doi.tuyen} tuyến dây, ${doi.thietBi} thiết bị, ${doi.vong} vòng tròn cuộn dây / TI, ${doi.net} nét trên cuộn dây.`,
);
for (const k of Object.keys(theoTram).sort()) console.log(`  ${k}: ${theoTram[k]}`);
