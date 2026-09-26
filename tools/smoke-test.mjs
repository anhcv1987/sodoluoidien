/**
 * Kiem thu nhanh phan mem bang trinh duyet that (Chromium + Playwright).
 *
 *   npm run build
 *   npm i -D playwright && npx playwright install chromium
 *   node tools/smoke-test.mjs anh-kiem-thu.png
 *
 * Kiem tra: khoi dong, so do ket day tong, danh muc tram, nhay toi tung tram,
 * ve tuyen, dat thiet bi, hoan tac, gian tram chong lan, xuat/nhap DXF.
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const shot = process.argv[2] ?? 'smoke.png';
const url = 'file://' + process.cwd() + '/dist/index.html';
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage({ viewport: { width: 1680, height: 980 } });
const errors = [];
// Bỏ qua lỗi tải ô bản đồ nền (máy kiểm thử không có Internet) - không phải lỗi phần mềm.
page.on('console', (m) => m.type() === 'error' && !/^Failed to load resource/.test(m.text()) && errors.push('CONSOLE: ' + m.text()));
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!cond) process.exitCode = 1;
};

await page.goto(url);
await page.waitForTimeout(2500);

/* ---------------- Trang mac dinh: so do ket day tong ---------------- */

const init = await page.evaluate(() => {
  const a = window.sodo;
  const c = {};
  for (const e of a.store.entities) c[e.kind] = (c[e.kind] || 0) + 1;
  const kv = {};
  for (const e of a.store.entities) if (e.kind !== 'node') kv[e.kv] = (kv[e.kv] || 0) + 1;
  return {
    sheets: a.store.drawing.sheets.map((s) => s.name),
    active: a.store.sheet.name,
    counts: c,
    kv,
    tram: document.querySelectorAll('.tram-row').length,
    palette: document.querySelectorAll('.palette-item').length,
    khung: a.store.entities.filter((e) => e.layer === 'Khung bản vẽ').length,
    doiChu: window.sodoDoiChu?.get('TONG'),
  };
});
check('Mở ra là sơ đồ kết dây tổng', init.active.includes('kết dây'), init.active);
check('Chỉ có 1 sơ đồ tổng, không tách riêng từng trạm', init.sheets.length === 2, init.sheets.join(' | '));
check('Sơ đồ tổng đủ thiết bị', (init.counts.device ?? 0) > 2500, `${init.counts.device} thiết bị, ${init.counts.branch} tuyến, ${init.counts.circle} hình tròn`);
check(
  'Có đủ các cấp 110/35/22/6kV',
  ['110', '35', '22', '6'].every((k) => (init.kv[k] ?? 0) > 100),
  JSON.stringify(init.kv),
);
check('Danh mục có 25 trạm + 4 trạm 220kV ngoài địa bàn', init.tram === 29, `${init.tram} trạm`);
check('Có khung bản vẽ A0 + khung tên', init.khung >= 6, `${init.khung} đối tượng khung`);
check('Thư viện thiết bị', init.palette >= 20, `${init.palette} block`);
check(
  'Không còn nhãn bị ký hiệu thiết bị che',
  !!init.doiChu && init.doiChu.daDoi > 100 && init.doiChu.conLai === 0,
  init.doiChu ? `dời ${init.doiChu.daDoi}/${init.doiChu.biLap} nhãn, còn ${init.doiChu.conLai} ${JSON.stringify(init.doiChu.khongDoi ?? [])} · ${init.doiChu.ms} ms` : 'không có số liệu',
);

/* ---------------- Nhay toi tung tram tren to tong ---------------- */

const goto = await page.evaluate(() => {
  const a = window.sodo;
  const ok = a.gotoStation('E6.8');
  const v = a.ed.vp;
  return { ok, sheet: a.store.sheet.name, scale: v.scale, cx: v.cx, cy: v.cy };
});
check('Nhảy tới đúng trạm trên sơ đồ tổng', goto.ok && goto.sheet.includes('kết dây'), `tỷ lệ ${goto.scale.toFixed(2)}`);

const perf = await page.evaluate(() => {
  const a = window.sodo;
  const t = performance.now();
  for (let i = 0; i < 30; i++) {
    a.ed.vp.cx += 2;
    a.ed.draw();
  }
  return (performance.now() - t) / 30;
});
check('Vẽ mượt khi phóng vào trạm', perf < 20, `${perf.toFixed(1)} ms/khung`);

await page.screenshot({ path: shot });

/* ---------------- Ket luoi 110kV giua cac tram ---------------- */

const kl = await page.evaluate(() => {
  const a = window.sodo;
  const dd = a.store.entities.filter((e) => e.kind === 'branch' && e.srcLayer === 'Kết lưới 110kV');
  const nhan = a.store.entities.filter((e) => e.kind === 'text' && e.srcLayer === 'Kết lưới 110kV');
  const dinh = dd.reduce((n, e) => n + e.nodes.length, 0);
  return { tuyen: dd.length, nhan: nhan.length, dinh, kv: [...new Set(dd.map((e) => e.kv))] };
});
check(
  'Đã nối đường dây 110kV giữa các trạm',
  kl.tuyen >= 24 && kl.nhan >= 24 && kl.kv.length === 1 && kl.kv[0] === 110,
  `${kl.tuyen} tuyến · ${kl.nhan} nhãn mã dây · ${kl.dinh} đỉnh`,
);

/* ---------------- Lien ket dien + diem dau noi ---------------- */

const lk = await page.evaluate(() => {
  const a = window.sodo;
  const m = a.mangDien();
  let tong = 0;
  let ho = 0;
  for (const cs of m.cucCua.values()) for (const c of cs) { tong++; if (!c.batDuoc) ho++; }
  a.batDiemNoi();
  return {
    nut: m.soNut, dao: m.soDao, cauMBA: m.cauMBA.length,
    thietBi: a.store.entities.filter((e) => e.kind === 'device').length,
    chuaNoi: m.chuaNoi.length, cuc: tong, cucHo: ho,
    hienDiem: a.ed.renderer.opt.showTerminals, soDiem: a.ed.renderer.diemNoi.length,
  };
});
check('Dựng được mô hình liên kết điện', lk.nut > 1000 && lk.cauMBA > 50, `${lk.nut} nút · ${lk.dao} mạch · ${lk.cauMBA} cầu MBA`);
check(
  'Hầu hết thiết bị đã đấu vào lưới',
  lk.chuaNoi / lk.thietBi < 0.03,
  `${lk.thietBi - lk.chuaNoi}/${lk.thietBi} thiết bị · ${lk.cuc - lk.cucHo}/${lk.cuc} cực đã nối`,
);
check('Bật được lớp điểm đấu nối (F4)', lk.hienDiem && lk.soDiem === lk.cuc, `${lk.soDiem} điểm`);

const mchb = await page.evaluate(() => {
  const a = window.sodo;
  const box = [17, 5967, 1058, 6851]; // E26.1 Bac Kan - tram ve tay, khong dung block
  const co = (e) => e.p.x >= box[0] && e.p.x <= box[2] && e.p.y >= box[1] && e.p.y <= box[3];
  const c = {};
  for (const e of a.store.entities) if (e.kind === 'device' && co(e)) c[e.block] = (c[e.block] || 0) + 1;
  return c;
});
check(
  'Trạm vẽ tay đã gắn đủ block (E26.1 Bắc Kạn)',
  (mchb.MCHB ?? 0) >= 8 && (mchb.DCL ?? 0) >= 20 && (mchb.DTD ?? 0) >= 40 && (mchb.TI ?? 0) >= 10,
  JSON.stringify(mchb),
);

/* ---------------- Trang so do dia ly ---------------- */

// Trang "theo vị trí địa lý" là bản đồ nền (Leaflet) + dữ liệu GIS; trong môi trường
// kiểm thử không có Internet nên bản đồ nền tự chuyển về "Không nền".
await page.locator('.tabs .tab', { hasText: 'địa lý' }).click();
await page.waitForTimeout(1500);
const geo = await page.evaluate(() => ({
  tram: document.querySelectorAll('.bddl .bddl-ico').length,
  tuyen: document.querySelectorAll('.bddl path.leaflet-interactive').length,
  canvasAn: getComputedStyle(document.querySelector('canvas.canvas')).display === 'none',
  ds: [...document.querySelectorAll('.bddl-list li b')].map((x) => x.textContent),
}));
check('Bản đồ địa lý có trạm (GIS)', geo.tram >= 29 && geo.canvasAn, `${geo.tram} trạm`);
check('Bản đồ địa lý có đường dây (GIS)', geo.tuyen >= 50, `${geo.tuyen} tuyến`);
const soMa = (m) => m.match(/^E(\d+)\.(\d+)/).slice(1).map(Number);
const trongTinh = geo.ds.slice(0, geo.ds.indexOf('A6.15'));
const dungThuTu = trongTinh.length >= 25 && trongTinh.every((m, i) => {
  if (!i) return true;
  const [a1, a2] = soMa(trongTinh[i - 1]);
  const [b1, b2] = soMa(m);
  return a1 < b1 || (a1 === b1 && a2 < b2);
});
check('Danh sách trạm trên bản đồ xếp theo thứ tự danh mục', dungThuTu && geo.ds.at(-1) === 'E26.5', geo.ds.join(' '));
await page.locator('.tabs .tab').first().click();
await page.waitForTimeout(500);

/* ---------------- Tai khoan & phan quyen ---------------- */

const box = await page.locator('canvas.canvas').boundingBox();
const xem = await page.evaluate(() => ({
  chiXem: window.sodo.store.chiXem,
  lop: document.querySelector('#app')?.classList.contains('che-do-xem') ?? document.body.innerHTML.includes('che-do-xem'),
  anCongCu: [...document.querySelectorAll('.tool-btn')].filter((b) => b.offsetParent !== null).map((b) => b.textContent),
  nut: !!document.querySelector('.btn-dang-nhap'),
}));
check('Mở ra là chế độ xem, ẩn công cụ hiệu chỉnh', xem.chiXem && xem.nut && xem.anCongCu.length === 2, `công cụ còn hiện: ${xem.anCongCu.join(', ')}`);
{
  const n0 = await page.evaluate(() => window.sodo.store.entities.filter((e) => e.kind === 'branch').length);
  await page.keyboard.press('l');
  await page.mouse.click(box.x + 380, box.y + 260);
  await page.mouse.click(box.x + 520, box.y + 340);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  const n1 = await page.evaluate(() => {
    const a = window.sodo;
    const e0 = a.store.entities.length;
    a.store.transact('thử', () => a.store.put({ id: 'thu', kind: 'text', layer: '0', p: { x: 0, y: 0 }, text: 'x', height: 1, rot: 0, align: 'left' }));
    return { n: a.store.entities.filter((e) => e.kind === 'branch').length, them: a.store.entities.length - e0 };
  });
  check('Chế độ xem không sửa được sơ đồ', n1.n === n0 && n1.them === 0, `${n1.them} đối tượng lọt qua`);
}
/* ---------------- Trạng thái đóng / cắt ---------------- */

const tt0 = await page.evaluate(() => {
  const a = window.sodo;
  const tb = a.store.entities.filter((e) => e.kind === 'device' && e.layer !== 'Khung bản vẽ');
  // dao cách ly trong trạm (lưới trung áp vẽ theo phương thức riêng, có dao thường cắt)
  const dcl = tb.filter((e) => e.block === 'DCL' && e.srcLayer !== 'Lưới trung áp');
  const dtd = tb.find((e) => e.block === 'DTD');
  const chuGiai = a.store.entities.filter((e) => e.kind === 'device' && e.layer === 'Khung bản vẽ').length;
  // Chế độ xem: đổi trạng thái bị chặn
  const doi = a.ed.doiTrangThai([dtd.id]);
  return { dclCat: dcl.filter((e) => e.state === 'mo').length, soDcl: dcl.length, chuGiai, doi, dtdId: dtd.id, dtdSt: a.store.get(dtd.id).state };
});
check('Dao cách ly đều Đóng, trừ dao thanh cái đường vòng (-9) Cắt', tt0.dclCat === 51 && tt0.soDcl > 500, `${tt0.soDcl} DCL, ${tt0.dclCat} đang cắt`);
check('Có khung chú giải trạng thái thiết bị', tt0.chuGiai === 12, `${tt0.chuGiai} ký hiệu mẫu`);
check('Chế độ xem không đổi được trạng thái thiết bị', tt0.doi === 0 && tt0.dtdSt === 'mo');

/* ---------------- Lưới trung áp (bản vẽ 17, 18 cụm E6.4 + 473 E6.2) ---------------- */

const lta = await page.evaluate(() => {
  const a = window.sodo;
  const ds = a.store.entities.filter((e) => e.srcLayer === 'Lưới trung áp');
  const tb = ds.filter((e) => e.kind === 'device');
  const moTen = ['DCL 472E6.4-7/25', 'LBS 472E6.4/61', 'MC 472E6.4/61', 'LBS 476E6.4/39', '477-7/02-2', 'DCL 472E6.2-7/36', 'MC 472E6.4/73', '472-7/02-2'];
  // dao tiếp địa các ngăn tủ RMU (bình thường cắt) không tính vào điểm thường mở
  const dtd = tb.filter((e) => e.block === 'DTD');
  const chu = a.store.entities.filter((e) => e.kind === 'text' && e.srcLayer === 'Lưới trung áp').map((e) => e.text);
  const d = a.congSuat.duLieu();
  const coDien = (x, y) =>
    d.chuoi.some((c) => {
      for (let k = 2; k < c.pts.length; k += 2) {
        const [ax, ay, bx, by] = [c.pts[k - 2], c.pts[k - 1], c.pts[k], c.pts[k + 1]];
        const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
        if (!L) continue;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L));
        if (Math.hypot(ax + t * dx - x, ay + t * dy - y) < 0.5) return true;
      }
      return false;
    });
  // khúc đường dây 35kV vẽ ở chỗ "Giao chéo 376 TCCN": không được nhận điện từ lưới 22kV
  const giao = ds.filter((e) => e.kind === 'branch' && e.kv === 35);
  const giaoCoDien = giao.some((g) => {
    const p = g.nodes.map((id) => a.store.get(id)?.p).filter(Boolean);
    return p.length >= 2 && coDien((p[0].x + p.at(-1).x) / 2, (p[0].y + p.at(-1).y) / 2);
  });
  return {
    net: ds.filter((e) => e.kind === 'branch').length,
    tb: tb.length,
    mo: tb.filter((e) => e.state === 'mo' && e.block !== 'DTD').length,
    dtd: dtd.length,
    dtdCat: dtd.every((e) => e.state === 'mo'),
    // 473 E6.2 (lộ vẽ theo mô tả) nối vào đầu dây "473 E6.2 đến" của bản vẽ 18 (trên MC 472E6.4/61)
    noi: ds.filter((e) => e.kind === 'branch' && e.nodes.some((id) => { const p = a.store.get(id)?.p; return p && Math.hypot(p.x + 663.16, p.y - 217.32) < 0.5; })).length >= 2,
    ten: moTen.every((t) => chu.some((c) => c.startsWith(t))),
    // trục 477 E6.4 (sau cột 48), trục 472 E6.4 (trước cột 48), 473 E6.2 trên trục
    d477: coDien(-1155.627, -69.04),
    d472: coDien(-1266.09, -69.04),
    d473: coDien(-1300, 250),
    nhay: ds.filter((e) => e.kind === 'branch' && e.khongNoiGiua).length,
    giao: giao.length,
    giaoCoDien,
    tuBu: tb.filter((e) => e.block === 'TUBU').length,
  };
});
check(
  'Lưới trung áp: các lộ vẽ từ ngăn lộ, nối nhau, có điện, dừng ở điểm thường cắt (kể cả ngăn tủ RMU); RMU có tiếp địa; giao chéo có vòng nhảy',
  // 26 điểm thường cắt: 1 của 473E6.2, 6 của bản vẽ 17, 5 thiết bị + 2 ngăn tủ RMU của bản vẽ 18,
  // 4 + 1 ngăn của bản vẽ 20, 1 của 21, 2 của 22 (MC 476E6.4/40, MC 474E6.2/07), 2 + 2 ngăn của 23
  lta.net > 100 && lta.tb > 100 && lta.mo === 35 && lta.ten && lta.d477 && lta.d472 && lta.d473 && lta.noi && lta.dtd >= 20 && lta.dtdCat &&
    lta.nhay >= 9 && lta.giao >= 1 && !lta.giaoCoDien && lta.tuBu === 0,
  JSON.stringify(lta),
);

/* ---------------- Màu cuộn dây máy biến áp ---------------- */

const mba = await page.evaluate(() => {
  const a = window.sodo;
  const ds = a.store.entities.filter((e) => e.kind === 'device' && /^MBA[23]$/.test(e.block) && e.kvCuon?.length);
  const e67 = ds.find((e) => Math.hypot(e.p.x + 2295.66, e.p.y + 5977.96) < 1);
  // cuộn tam giác 6,3kV của T2 E6.4 (vẽ bằng vòng tròn) tô màu 6kV
  const t2e64 = a.store.entities.find((e) => e.kind === 'circle' && Math.hypot(e.c.x + 1967.85, e.c.y + 139.02) < 1);
  return { so: ds.length, e67: e67?.kvCuon?.join('/'), t2e64: t2e64?.kv };
});
check(
  'Máy biến áp 110kV tô màu từng cuộn dây theo cấp điện áp',
  mba.so >= 18 && mba.e67 === '110/35/22' && mba.t2e64 === 6,
  `${mba.so} block MBA, T1 E6.7 ${mba.e67}, cuộn Δ T2 E6.4 ${mba.t2e64}kV`,
);

/* ---------------- Phương thức vận hành, khung tên, công suất chạy ---------------- */

const pt = await page.evaluate(() => {
  const a = window.sodo;
  const ents = a.store.entities;
  // máy cắt đang cắt theo kết dây cơ bản
  const mcCat = ents
    .filter((e) => e.kind === 'device' && e.layer !== 'Khung bản vẽ' && e.block === 'MC' && e.state === 'mo')
    .map((e) => `${e.p.x.toFixed(0)},${e.p.y.toFixed(0)}`)
    .sort();
  const tieuDe = ents.some((e) => e.kind === 'text' && e.text === 'TRẠM 110kV THỊNH ĐÁN (E6.4)');
  const conDan = ents.some((e) => e.kind === 'text' && /TRẠM 110kV ĐÁN/.test(e.text));
  // khung tên không đè lên hình vẽ
  const kt = ents.find((e) => e.kind === 'boundary' && e.name === 'Khung tên');
  const xs = kt.pts.map((p) => p.x);
  const ys = kt.pts.map((p) => p.y);
  const h = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  const trong = (p) => p && p.x >= h.minX && p.x <= h.maxX && p.y >= h.minY && p.y <= h.maxY;
  const de = ents.filter(
    (e) => e.layer !== 'Khung bản vẽ' && (((e.kind === 'device' || e.kind === 'text') && trong(e.p)) || (e.kind === 'node' && trong(e.p))),
  ).length;
  return { mcCat, tieuDe, conDan, de };
});
check(
  'Kết dây cơ bản: MC 171 Thịnh Đán, 112 Xi măng TN, 171 Định Hóa cắt',
  pt.mcCat.join(' ') === ['-1628,5059', '-2223,87', '1672,3018'].sort().join(' '),
  pt.mcCat.join(' '),
);
check('Đổi tên trạm 110kV Đán thành Thịnh Đán', pt.tieuDe && !pt.conDan);
check('Khung tên không đè lên sơ đồ', pt.de === 0, `${pt.de} đối tượng nằm trong khung tên`);

await page.keyboard.press('F6');
await page.waitForTimeout(1500);
const cs = await page.evaluate(() => {
  const a = window.sodo;
  const lop = document.querySelector('.lop-cong-suat');
  const d = a.congSuat.duLieu();
  const gan = (x, y) => d.diemDung.some((q) => Math.hypot(q.x - x, q.y - y) < 12);
  return {
    hien: !!lop && lop.style.display !== 'none' && lop.width > 0,
    chuoi: d.chuoi.length,
    dung: [gan(-2222.59, 87.41), gan(1671.98, 3017.72), gan(-1628.16, 5059.23)],
    kv: [...new Set(d.chuoi.map((c) => c.kv))].sort((x, y) => x - y).join(','),
    // khung tủ RMU 01-383 E6.9 (cạnh trái x=465.8) không có công suất; lộ ra MBA T1
    // 4000kVA của C.TY Cơ khí Gang Thép (qua ngăn tủ RMU 01-381) thì có
    khungRMU: d.chuoi.some((c) => c.minX > 465 && c.maxX < 466.5 && c.minY < -700 && c.maxY > -700),
    raRMU: d.chuoi.some((c) => c.minX > 1075 && c.maxX < 1077 && c.minY < -700 && c.maxY > -700),
  };
});
check('Công suất không chạy vòng theo khung tủ RMU, vẫn qua ngăn tủ tới MBA', !cs.khungRMU && cs.raRMU, `khung ${cs.khungRMU}, lộ ra ${cs.raRMU}`);
check(
  'Công suất chạy trên đường dây (F6), dừng tại các MC đang cắt',
  cs.hien && cs.chuoi > 5000 && cs.dung.every(Boolean) && /220/.test(cs.kv) && /22/.test(cs.kv),
  `${cs.chuoi} chuỗi, cấp ${cs.kv}, dừng tại MC cắt: ${cs.dung.join('/')}`,
);
await page.keyboard.press('F6');

const saiMk = await page.evaluate(async () => (await window.sodo.tk.dangNhap('admin', 'sai-mat-khau')) === null);
check('Sai mật khẩu thì không đăng nhập được', saiMk);
await page.click('.btn-dang-nhap');
await page.fill('.dialog input[type=text]', 'admin');
await page.fill('.dialog input[type=password]', 'dieudob6');
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
const daVao = await page.evaluate(() => ({ chiXem: window.sodo.store.chiXem, nhan: document.querySelector('.tai-khoan')?.textContent ?? '' }));
check('Đăng nhập admin / mật khẩu mặc định thì được hiệu chỉnh', !daVao.chiXem, daVao.nhan);

// Đã đăng nhập: đổi Đóng <-> Cắt, hoàn tác được
const tt1 = await page.evaluate((id) => {
  const a = window.sodo;
  a.ed.doiTrangThai([id]);
  const sau = a.store.get(id).state;
  a.store.undo();
  const hoan = a.store.get(id).state;
  return { sau, hoan };
}, tt0.dtdId);
check('Đổi trạng thái thiết bị và hoàn tác (Ctrl+Z)', tt1.sau === 'dong' && tt1.hoan === 'mo', `${tt1.sau} → hoàn tác → ${tt1.hoan}`);

// Cắt nốt MC 175 E6.20 (MC 171 Thịnh Đán đã cắt): đường dây 175 E6.20 - 171 E6.4
// tách cả hai đầu -> không còn điện, không có công suất chạy
const tachHaiDau = await page.evaluate(() => {
  const a = window.sodo;
  const mc = a.store.entities.find((e) => e.kind === 'device' && e.block === 'MC' && Math.hypot(e.p.x + 2578.2, e.p.y + 1106.2) < 1);
  // có khúc công suất đi qua điểm (-2456, 250) trên tuyến đường dây
  const coDien = () =>
    a.congSuat.duLieu().chuoi.some((c) => {
      for (let k = 2; k < c.pts.length; k += 2) {
        const [x0, y0, x1, y1] = [c.pts[k - 2], c.pts[k - 1], c.pts[k], c.pts[k + 1]];
        if (Math.abs(x0 + 2456) < 0.5 && Math.abs(x1 + 2456) < 0.5 && Math.min(y0, y1) <= 250 && Math.max(y0, y1) >= 250) return true;
      }
      return false;
    });
  const truoc = coDien();
  a.ed.doiTrangThai([mc.id], 'mo');
  const sau = coDien();
  a.store.undo();
  return { truoc, sau, lai: coDien() };
});
// E6.8 Xi măng Thái Nguyên: MC 112 đang cắt, cắt thêm 112-1, 112-2 -> khúc thanh cái
// giữa hai dao không có công suất; hai phân đoạn C11, C12 vẫn có (nhận điện từ lộ 171,
// 172 - đường dây đã bắt đúng vào nét giữa ở đầu trạm)
const tach112 = await page.evaluate(() => {
  const a = window.sodo;
  const tim = (x, y) => a.store.entities.find((e) => e.kind === 'device' && Math.hypot(e.p.x - x, e.p.y - y) < 0.5);
  const coDien = (x, y) =>
    a.congSuat.duLieu().chuoi.some((c) => {
      for (let k = 2; k < c.pts.length; k += 2) {
        const [x0, y0, x1, y1] = [c.pts[k - 2], c.pts[k - 1], c.pts[k], c.pts[k + 1]];
        if (Math.abs(y0 - y) < 0.5 && Math.abs(y1 - y) < 0.5 && Math.min(x0, x1) <= x && Math.max(x0, x1) >= x) return true;
      }
      return false;
    });
  a.ed.doiTrangThai([tim(1615.82, 3017.72).id, tim(1717.53, 3017.72).id], 'mo');
  const kq = { giua: coDien(1640, 3017.72) || coDien(1695, 3017.72), c11: coDien(1600, 3017.72), c12: coDien(1740, 3017.72) };
  a.store.undo();
  return kq;
});
// E6.8: cắt MC tổng 632 và MC phân đoạn 612 -> thanh cái C62 mất điện (cáp tổng từ
// MBA vắt qua C62 không phải đấu nối; MC liên lạc C08 tủ khách hàng đang cắt nên không
// bị cấp ngược từ C61)
const c62 = await page.evaluate(() => {
  const a = window.sodo;
  const tim = (x, y) => a.store.entities.find((e) => e.kind === 'device' && Math.hypot(e.p.x - x, e.p.y - y) < 0.5);
  const coDien = (x, y) =>
    a.congSuat.duLieu().chuoi.some((c) => {
      for (let k = 2; k < c.pts.length; k += 2) {
        const [x0, y0, x1, y1] = [c.pts[k - 2], c.pts[k - 1], c.pts[k], c.pts[k + 1]];
        if (Math.abs(y0 - y) < 0.5 && Math.abs(y1 - y) < 0.5 && Math.min(x0, x1) <= x && Math.max(x0, x1) >= x) return true;
      }
      return false;
    });
  const truoc = coDien(1760, 2735.7);
  a.ed.doiTrangThai([tim(1695.2, 2715).id, tim(1547.58, 2714.96).id], 'mo');
  const sau = coDien(1760, 2735.7) || coDien(1620, 2735.7);
  a.store.undo();
  return { truoc, sau };
});
/* ---------------- Lộ trung áp nhập từ bản vẽ PDF (471, 473, 481 E6.4) ---------------- */

const pdf17 = await page.evaluate(() => {
  const a = window.sodo;
  const chu = a.store.entities.filter((e) => e.kind === 'text' && e.srcLayer === 'Lưới trung áp').map((e) => e.text);
  const tb = a.store.entities.filter((e) => e.kind === 'device');
  const coDien = (x, y) =>
    a.congSuat.duLieu().chuoi.some((c) => {
      for (let k = 2; k < c.pts.length; k += 2) {
        const [ax, ay, bx, by] = [c.pts[k - 2], c.pts[k - 1], c.pts[k], c.pts[k + 1]];
        const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
        if (!L) continue;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L));
        if (Math.hypot(ax + t * dx - x, ay + t * dy - y) < 0.5) return true;
      }
      return false;
    });
  const ten = ['MC 473E6.4/64', 'LBS 473E6.4/14B', 'DCL 473E6.4-7/19', 'DCL 431-7', 'LBS 473E6.4/47', 'TỦ RMU 01-481E6.4'].every((t) =>
    chu.some((c) => c.startsWith(t)),
  );
  // trục 473 gần MC 64 Ao Cang; cáp đầu lộ 473, 471, 481
  const diem = [[-1600, -848.516], [-2106, -400], [-2410, -600], [-2420, -600]];
  const truoc = diem.map(([x, y]) => coDien(x, y));
  const mc473 = tb.find((e) => e.block === 'MCHB' && Math.hypot(e.p.x + 2105.97, e.p.y + 316.26) < 0.5);
  a.ed.doiTrangThai([mc473.id], 'mo');
  const cat473 = diem.map(([x, y]) => coDien(x, y));
  a.store.undo();
  return { ten, truoc, cat473 };
});
check(
  'Lộ 471/473/481 E6.4 (bản vẽ PDF): đủ thiết bị, có điện; cắt MC 473 thì trục 473 mất điện (DCL 7/19 thường cắt không cấp ngược từ 481), 471 và 481 vẫn có điện',
  pdf17.ten && pdf17.truoc.every(Boolean) && JSON.stringify(pdf17.cat473) === '[false,false,true,true]',
  JSON.stringify(pdf17),
);

// Recloser trên lưới trung áp (bản vẽ 18): cắt MC đầu lộ 472 E6.4 thì đoạn Đồng Bẩm và trục
// 472 mất điện; đóng MC 472E6.4/61 (thường cắt) -> 473 E6.2 cấp ngược sang cả hai; cắt thêm
// MC 472E6.4/25 Gia Bảy -> trục 472 phía sau MC 25 mất điện, Đồng Bẩm vẫn có
const rec = await page.evaluate(() => {
  const a = window.sodo;
  const coDien = (x, y) =>
    a.congSuat.duLieu().chuoi.some((c) => {
      for (let k = 2; k < c.pts.length; k += 2) {
        const [ax, ay, bx, by] = [c.pts[k - 2], c.pts[k - 1], c.pts[k], c.pts[k + 1]];
        const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
        if (!L) continue;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L));
        if (Math.hypot(ax + t * dx - x, ay + t * dy - y) < 0.5) return true;
      }
      return false;
    });
  const gan = (block, x, y) =>
    a.store.entities.filter((e) => e.kind === 'device' && e.block === block).sort((p, q) => Math.hypot(p.p.x - x, p.p.y - y) - Math.hypot(q.p.x - x, q.p.y - y))[0];
  const mc472 = gan('MCHB', -1913.8, -316.26);
  const mc61 = gan('REC', -662.2, 205);
  const mc25 = gan('REC', -849.7, -72.2);
  const [dongBam, truc472] = [[-664.124, 100], [-1266.09, -69.04]];
  const kq = { truoc: coDien(...dongBam) && coDien(...truc472) };
  a.ed.doiTrangThai([mc472.id], 'mo');
  kq.cat472 = !coDien(...dongBam) && !coDien(...truc472);
  a.ed.doiTrangThai([mc61.id], 'dong');
  kq.dong61 = coDien(...dongBam) && coDien(...truc472);
  a.ed.doiTrangThai([mc25.id], 'mo');
  kq.cat25 = coDien(...dongBam) && !coDien(...truc472);
  a.store.undo();
  a.store.undo();
  a.store.undo();
  kq.lai = coDien(...dongBam) && a.store.get(mc61.id).state === 'mo';
  return kq;
});
check(
  'Đóng/cắt recloser (MC 472E6.4/61, MC 472E6.4/25) đổi chiều công suất tương ứng',
  rec.truoc && rec.cat472 && rec.dong61 && rec.cat25 && rec.lai,
  JSON.stringify(rec),
);
// Bản vẽ 18: 477 và 472 E6.4 chỉ gặp nhau qua ngăn 477-7/02-2 (thường cắt) của tủ RMU 02-477
// và cột 48 (lèo tháo) -> cắt MC 477 thì trục 477 mất điện, trục 472 vẫn có và ngược lại
const rmu477 = await page.evaluate(() => {
  const a = window.sodo;
  const coDien = (x, y) =>
    a.congSuat.duLieu().chuoi.some((c) => {
      for (let k = 2; k < c.pts.length; k += 2) {
        const [ax, ay, bx, by] = [c.pts[k - 2], c.pts[k - 1], c.pts[k], c.pts[k + 1]];
        const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
        if (!L) continue;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L));
        if (Math.hypot(ax + t * dx - x, ay + t * dy - y) < 0.5) return true;
      }
      return false;
    });
  const mchb = (x) => a.store.entities.find((e) => e.kind === 'device' && e.block === 'MCHB' && Math.hypot(e.p.x - x, e.p.y + 316.26) < 0.5);
  const diem = () => [coDien(-1155.627, -69.04), coDien(-1266.09, -69.04)];
  const kq = { truoc: diem() };
  a.ed.doiTrangThai([mchb(-2141.41).id], 'mo');
  kq.cat477 = diem();
  a.store.undo();
  a.ed.doiTrangThai([mchb(-1913.8).id], 'mo');
  kq.cat472 = diem();
  a.store.undo();
  return kq;
});
check(
  'Bản vẽ 18: 477 và 472 E6.4 tách nhau ở ngăn RMU 477-7/02-2 thường cắt (cắt MC 477 chỉ mất điện trục 477, cắt MC 472 chỉ mất điện trục 472)',
  JSON.stringify(rmu477) === '{"truoc":[true,true],"cat477":[false,true],"cat472":[true,false]}',
  JSON.stringify(rmu477),
);
// Cụm E6.4 (bản vẽ 17-23): cắt MC đầu lộ nào thì chỉ đầu lộ đó mất điện (các lộ chỉ gặp nhau
// qua điểm thường cắt; cáp đi chung hành lang có vòng nhảy, không đấu vào nhau)
const cumE64 = await page.evaluate(() => {
  const a = window.sodo;
  const coDien = (x, y) =>
    a.congSuat.duLieu().chuoi.some((c) => {
      for (let k = 2; k < c.pts.length; k += 2) {
        const [ax, ay, bx, by] = [c.pts[k - 2], c.pts[k - 1], c.pts[k], c.pts[k + 1]];
        const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
        if (!L) continue;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L));
        if (Math.hypot(ax + t * dx - x, ay + t * dy - y) < 0.5) return true;
      }
      return false;
    });
  // [x ngăn lộ, điểm đầu lộ trên bản vẽ]
  const lo = {
    474: [-1875.05, [-1341.12, -1571.49]],
    475: [-2257.16, [-1352.72, -2575.64]],
    476: [-1782.55, [-1370.35, -2050.24]],
    478: [-2328.57, [-1369.5, -2882.25]],
    480: [-1744.48, [-1306.21, -3018.69]],
    477: [-2141.41, [-1155.627, -69.04]],
    472: [-1913.8, [-1266.09, -69.04]],
  };
  const ten = Object.keys(lo);
  const trangThai = () => ten.map((t) => coDien(...lo[t][1]));
  const kq = { truoc: trangThai().every(Boolean), loi: [] };
  for (const t of ten) {
    const mc = a.store.entities.find((e) => e.kind === 'device' && e.block === 'MCHB' && Math.hypot(e.p.x - lo[t][0], e.p.y + 316.26) < 0.5);
    a.ed.doiTrangThai([mc.id], 'mo');
    const tt = trangThai();
    a.store.undo();
    if (ten.some((u, i) => tt[i] !== (u !== t))) kq.loi.push(`cắt ${t}: ${ten.filter((u, i) => tt[i]).join(',')}`);
  }
  return kq;
});
check('Cụm E6.4: cắt MC đầu lộ 472/474/475/476/477/478/480 thì chỉ lộ đó mất điện', cumE64.truoc && !cumE64.loi.length, JSON.stringify(cumE64));
// Liên thông ĐZ 475 E6.2 (bản vẽ 22): cắt MC đầu lộ 475 E6.2 thì mất điện; đóng một trong các
// điểm thường cắt MC 472E6.4/73 (471 E6.2), LBS 476E6.4/39 (473 E6.2), MC 476E6.4/40 (476 E6.4)
// thì có điện trở lại; đóng MC 478E6.4/61 thì đoạn cột 61A-79 nhận điện từ 480 E6.4
const lt475E62 = await page.evaluate(() => {
  const a = window.sodo;
  const coDien = (x, y) =>
    a.congSuat.duLieu().chuoi.some((c) => {
      for (let k = 2; k < c.pts.length; k += 2) {
        const [ax, ay, bx, by] = [c.pts[k - 2], c.pts[k - 1], c.pts[k], c.pts[k + 1]];
        const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
        if (!L) continue;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L));
        if (Math.hypot(ax + t * dx - x, ay + t * dy - y) < 0.5) return true;
      }
      return false;
    });
  const gan = (block, x, y) =>
    a.store.entities.filter((e) => e.kind === 'device' && e.block === block).sort((p, q) => Math.hypot(p.p.x - x, p.p.y - y) - Math.hypot(q.p.x - x, q.p.y - y))[0];
  const dau = [-982.77, -2351.5];
  const mc = gan('MCHB', -1476.25, 554.31);
  const kq = { truoc: coDien(...dau) };
  a.ed.doiTrangThai([mc.id], 'mo');
  kq.cat = !coDien(...dau);
  kq.dong = [gan('REC', -1048, 139), gan('LBS', -1007.13, 128), gan('REC', -1096, -2100)].map((d) => {
    a.ed.doiTrangThai([d.id], 'dong');
    const co = coDien(...dau);
    a.store.undo();
    return co;
  });
  a.store.undo();
  // đoạn 61A-79 do 471 E6.5 cấp (bản vẽ 24): cắt MC đầu lộ 471 E6.5 thì mất điện, đóng MC 478E6.4/61 có điện lại
  const mc61 = gan('REC', -840, -3159);
  const mc471 = gan('MCHB', -836.3, -1252.69);
  kq.doan61A = [coDien(-650, -3158.69)];
  a.ed.doiTrangThai([mc471.id], 'mo');
  kq.doan61A.push(coDien(-650, -3158.69));
  a.ed.doiTrangThai([mc61.id], 'dong');
  kq.doan61A.push(coDien(-650, -3158.69));
  a.store.undo();
  a.store.undo();
  return kq;
});
check(
  'Liên thông 475 E6.2 qua MC 472E6.4/73, LBS 476E6.4/39, MC 476E6.4/40; đoạn 61A-79 (471 E6.5 cấp) qua MC 478E6.4/61',
  lt475E62.truoc && lt475E62.cat && lt475E62.dong.every(Boolean) && lt475E62.doan61A[0] && !lt475E62.doan61A[1] && lt475E62.doan61A[2],
  JSON.stringify(lt475E62),
);
// Cụm E6.5 (bản vẽ 24-27) + 481 E6.9: cắt MC đầu lộ thì chỉ lộ đó mất điện; đoạn cột 27 - MC 475E6.5/1A
// Cầu Loàng (bản vẽ 26) do 471 E6.5 cấp qua MC 475E6.5/01
const cumE65 = await page.evaluate(() => {
  const a = window.sodo;
  const coDien = (x, y) =>
    a.congSuat.duLieu().chuoi.some((c) => {
      for (let k = 2; k < c.pts.length; k += 2) {
        const [ax, ay, bx, by] = [c.pts[k - 2], c.pts[k - 1], c.pts[k], c.pts[k + 1]];
        const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
        if (!L) continue;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L));
        if (Math.hypot(ax + t * dx - x, ay + t * dy - y) < 0.5) return true;
      }
      return false;
    });
  // [MC đầu lộ (x, y), các điểm trên lộ]
  const lo = {
    '471 E6.5': [[-836.3, -1252.69], [[425.32, -1415.21], [1174.31, -1211.1]]],
    '473 E6.5': [[-1256.9, -1253.86], [[1133, -2017.93]]],
    '475 E6.5': [[-951.2, -1252.69], [[915.1, -1387.79], [1000, -1587.28]]],
    '472 E6.5': [[-1338.5, -1253.86], [[937.1, -1292.73]]],
    '477 E6.5': [[-748.1, -1252.69], [[1750, -1797.43]]],
    '481 E6.9': [[421.97, -428.28], [[1245.1, -1387.71]]],
  };
  const ten = Object.keys(lo);
  const trangThai = () => ten.map((t) => lo[t][1].map((p) => coDien(...p)));
  const kq = { truoc: trangThai().flat().every(Boolean), loi: [] };
  for (const t of ten) {
    const [x, y] = lo[t][0];
    const mc = a.store.entities.find((e) => e.kind === 'device' && e.block === 'MCHB' && Math.hypot(e.p.x - x, e.p.y - y) < 0.5);
    if (!mc) { kq.loi.push(t + ': không thấy MC'); continue; }
    a.ed.doiTrangThai([mc.id], 'mo');
    trangThai().forEach((ds, i) => ds.forEach((co, j) => { if (co === (ten[i] === t)) kq.loi.push(`cắt ${t}: ${ten[i]}#${j} ${co ? 'còn điện' : 'mất điện'}`); }));
    a.store.undo();
  }
  return kq;
});
check('Cụm E6.5: cắt MC đầu lộ 471/472/473/475/477 E6.5, 481 E6.9 thì chỉ lộ đó mất điện', cumE65.truoc && !cumE65.loi.length, JSON.stringify(cumE65));
// E6.4: cáp tổng MBA T2 vẽ nhảy qua C42 (nửa vòng tròn) xuống MC 432 - chỗ nhảy không
// phải đấu nối. Cắt 432 + 412 -> C42 mất điện, C41 vẫn có (T1 qua 431); cắt 431 + 412
// -> C41 mất điện; chỉ cắt 432 -> C42 nhận điện từ C41 qua 412
const e64 = await page.evaluate(() => {
  const a = window.sodo;
  const tim = (x, y) => a.store.entities.find((e) => e.kind === 'device' && Math.hypot(e.p.x - x, e.p.y - y) < 0.5);
  const coDien = (x, y) =>
    a.congSuat.duLieu().chuoi.some((c) => {
      for (let k = 2; k < c.pts.length; k += 2) {
        const [x0, y0, x1, y1] = [c.pts[k - 2], c.pts[k - 1], c.pts[k], c.pts[k + 1]];
        if (Math.abs(y0 - y) < 0.5 && Math.abs(y1 - y) < 0.5 && Math.min(x0, x1) <= x && Math.max(x0, x1) >= x) return true;
      }
      return false;
    });
  const c41 = () => coDien(-2400, -289.17);
  const c42 = () => coDien(-1700, -289.17);
  const [mc431, mc412, mc432] = [tim(-2374.3, -316.26), tim(-2294.16, -316.26), tim(-1819.55, -316.26)];
  const kq = {};
  a.ed.doiTrangThai([mc432.id, mc412.id], 'mo');
  kq.cat432_412 = { c41: c41(), c42: c42() };
  a.store.undo();
  a.ed.doiTrangThai([mc431.id, mc412.id], 'mo');
  kq.cat431_412 = { c41: c41(), c42: c42() };
  a.store.undo();
  a.ed.doiTrangThai([mc432.id], 'mo');
  kq.cat432 = { c41: c41(), c42: c42() };
  a.store.undo();
  return kq;
});
check(
  'E6.4: cắt MC 432 + 412 thì C42 mất điện (cáp T2 nhảy qua C42 không đấu vào), cắt 431 + 412 thì C41 mất điện',
  e64.cat432_412.c41 && !e64.cat432_412.c42 && !e64.cat431_412.c41 && e64.cat431_412.c42 && e64.cat432.c41 && e64.cat432.c42,
  JSON.stringify(e64),
);
check('Cắt MC 632 và 612 (E6.8): thanh cái C62 mất điện', c62.truoc && !c62.sau, JSON.stringify(c62));
check(
  'Cắt MC 112 và 112-1, 112-2 (E6.8): khúc giữa mất điện, C11 C12 vẫn có điện',
  !tach112.giua && tach112.c11 && tach112.c12,
  JSON.stringify(tach112),
);
check(
  'Cắt hai đầu đường dây thì đoạn giữa mất điện',
  tachHaiDau.truoc && !tachHaiDau.sau && tachHaiDau.lai,
  `trước ${tachHaiDau.truoc}, cắt MC 175 E6.20 ${tachHaiDau.sau}, hoàn tác ${tachHaiDau.lai}`,
);

/* ---------------- Cong cu ve ---------------- */

const before = await page.evaluate(() => window.sodo.store.entities.filter((e) => e.kind === 'branch').length);
await page.keyboard.press('l');
await page.mouse.click(box.x + 380, box.y + 260);
await page.mouse.click(box.x + 520, box.y + 340);
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
const after = await page.evaluate(() => window.sodo.store.entities.filter((e) => e.kind === 'branch').length);
check('Vẽ được tuyến mới', after === before + 1, `${after} tuyến`);

// Bắt điểm: rê chuột gần cực máy cắt (lệch vài pixel, lại gần cả trung điểm / tâm ký
// hiệu) thì phải bắt đúng vào cực đấu nối; đang vẽ dây thì tự hiện điểm đấu nối
await page.keyboard.press('l');
const cucMC = await page.evaluate(() => {
  const a = window.sodo;
  a.ed.vp.fit({ minX: -2262, minY: -60, maxX: -2182, maxY: 0 }, 0.02);
  a.ed.requestDraw();
  const s = a.ed.vp.toScreen({ x: -2222.59, y: -30.29 + 0.5 * 9.33 });
  const r = document.querySelector('canvas.canvas').getBoundingClientRect();
  return { x: r.left + s.x + 9, y: r.top + s.y + 4 };
});
await page.mouse.move(cucMC.x, cucMC.y);
await page.waitForTimeout(200);
const batCuc = await page.evaluate(() => ({ kind: window.sodo.ed.currentSnap?.kind, f4: window.sodo.ed.renderer.opt.showTerminals }));
check('Vẽ dây: bắt đúng cực đấu nối của thiết bị, tự hiện điểm đấu nối', batCuc.kind === 'Cực đấu nối' && batCuc.f4, `${batCuc.kind}, F4 ${batCuc.f4}`);
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');
await page.evaluate(() => window.sodo.ed.setTool('select'));

await page.keyboard.press('d');
await page.mouse.click(box.x + 450, box.y + 300);
await page.waitForTimeout(150);
const d1 = await page.evaluate(() => window.sodo.store.entities.filter((e) => e.kind === 'device').length);
check('Đặt được thiết bị', d1 >= 1, `${d1} thiết bị`);

await page.keyboard.press('Escape');
await page.keyboard.press('Control+z');
await page.waitForTimeout(150);
const d2 = await page.evaluate(() => window.sodo.store.entities.filter((e) => e.kind === 'device').length);
check('Hoàn tác (Ctrl+Z)', d2 === d1 - 1);

/* ---------------- Xuat / nhap DXF ---------------- */

// Dao cách ly đang CẮT: đường dây phải hở ở khe dao (cả trên màn hình lẫn file DXF)
const khe = await page.evaluate(() => {
  const a = window.sodo;
  const d = a.store.entities.find((e) => e.kind === 'device' && e.block === 'DCL' && Math.abs(e.p.x + 892.38) < 0.1 && Math.abs(e.p.y + 704.46) < 0.1);
  a.ed.doiTrangThai([d.id], 'mo');
  const t = a.exportDxfText();
  a.store.undo();
  // các LINE thẳng đứng trên trục x = -892.38 có vắt qua tâm dao không
  const g = t.split(/\r?\n/);
  let vat = 0;
  for (let i = 0; i + 1 < g.length; i++) {
    if (g[i].trim() !== '0' || g[i + 1].trim() !== 'LINE') continue;
    const v = {};
    for (let k = i + 2; k + 1 < g.length && g[k].trim() !== '0'; k += 2) v[g[k].trim()] = Number(g[k + 1]);
    if (Math.abs(v['10'] + 892.38) < 0.05 && Math.abs(v['11'] + 892.38) < 0.05 && Math.min(v['20'], v['21']) < -704.46 && Math.max(v['20'], v['21']) > -704.46) vat++;
  }
  return { vat, sau: a.store.get(d.id).state };
});
check('Dao cách ly cắt: đường dây hở ở khe dao (file DXF)', khe.vat === 0 && khe.sau === 'dong', `${khe.vat} nét vắt qua khe`);

const dxf = await page.evaluate(() => window.sodo.exportDxfText());
check('Xuất DXF có nội dung', dxf.includes('ENTITIES') && dxf.includes('EOF'), `${dxf.length} ký tự`);
writeFileSync('/tmp/roundtrip.dxf', dxf);
const stats = await page.evaluate((t) => window.sodo.importDxfText(t), dxf);
check('Nhập lại chính file DXF vừa xuất', stats.tuyen > 0, `${stats.tuyen} tuyến, ${stats.chu} chữ`);

check('Không có lỗi JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log('Ảnh màn hình:', shot);
await browser.close();
