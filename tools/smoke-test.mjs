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
  init.doiChu ? `dời ${init.doiChu.daDoi}/${init.doiChu.biLap} nhãn, còn ${init.doiChu.conLai} · ${init.doiChu.ms} ms` : 'không có số liệu',
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

const box = await page.locator('canvas').boundingBox();
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
const saiMk = await page.evaluate(async () => (await window.sodo.tk.dangNhap('admin', 'sai-mat-khau')) === null);
check('Sai mật khẩu thì không đăng nhập được', saiMk);
await page.click('.btn-dang-nhap');
await page.fill('.dialog input[type=text]', 'admin');
await page.fill('.dialog input[type=password]', 'dieudob6');
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
const daVao = await page.evaluate(() => ({ chiXem: window.sodo.store.chiXem, nhan: document.querySelector('.tai-khoan')?.textContent ?? '' }));
check('Đăng nhập admin / mật khẩu mặc định thì được hiệu chỉnh', !daVao.chiXem, daVao.nhan);

/* ---------------- Cong cu ve ---------------- */

const before = await page.evaluate(() => window.sodo.store.entities.filter((e) => e.kind === 'branch').length);
await page.keyboard.press('l');
await page.mouse.click(box.x + 380, box.y + 260);
await page.mouse.click(box.x + 520, box.y + 340);
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
const after = await page.evaluate(() => window.sodo.store.entities.filter((e) => e.kind === 'branch').length);
check('Vẽ được tuyến mới', after === before + 1, `${after} tuyến`);

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

const dxf = await page.evaluate(() => window.sodo.exportDxfText());
check('Xuất DXF có nội dung', dxf.includes('ENTITIES') && dxf.includes('EOF'), `${dxf.length} ký tự`);
writeFileSync('/tmp/roundtrip.dxf', dxf);
const stats = await page.evaluate((t) => window.sodo.importDxfText(t), dxf);
check('Nhập lại chính file DXF vừa xuất', stats.tuyen > 0, `${stats.tuyen} tuyến, ${stats.chu} chữ`);

check('Không có lỗi JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log('Ảnh màn hình:', shot);
await browser.close();
