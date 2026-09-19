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
page.on('console', (m) => m.type() === 'error' && errors.push('CONSOLE: ' + m.text()));
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
check('Danh mục có 25 trạm', init.tram === 25, `${init.tram} trạm`);
check('Có khung bản vẽ A0 + khung tên', init.khung >= 6, `${init.khung} đối tượng khung`);
check('Thư viện thiết bị', init.palette >= 20, `${init.palette} block`);

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

/* ---------------- Trang so do dia ly ---------------- */

const geo = await page.evaluate(() => {
  const a = window.sodo;
  const s = a.store.drawing.sheets.find((x) => x.type === 'tinh');
  a.store.setActiveSheet(s.id);
  a.zoomProvince();
  const c = {};
  for (const e of a.store.entities) c[e.kind] = (c[e.kind] || 0) + 1;
  return c;
});
check('Sơ đồ địa lý có trạm', (geo.substation ?? 0) >= 25, `${geo.substation} trạm`);
check('Sơ đồ địa lý có đường dây', (geo.branch ?? 0) >= 25, `${geo.branch} tuyến`);

const chong = await page.evaluate(() => {
  const subs = window.sodo.store.entities.filter((e) => e.kind === 'substation');
  let n = 0;
  for (let i = 0; i < subs.length; i++) {
    for (let j = i + 1; j < subs.length; j++) {
      const A = subs[i];
      const B = subs[j];
      if (Math.abs(A.p.x - B.p.x) < (A.w + B.w) / 2 && Math.abs(A.p.y - B.p.y) < (A.h + B.h) / 2) n++;
    }
  }
  return n;
});
check('Không trạm nào đè lên nhau trên sơ đồ địa lý', chong === 0, `${chong} cặp chồng lấn`);

/* ---------------- Cong cu ve ---------------- */

const box = await page.locator('canvas').boundingBox();
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
