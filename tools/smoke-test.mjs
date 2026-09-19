/**
 * Kiem thu nhanh phan mem bang trinh duyet that (Chromium + Playwright).
 *
 *   npm run build
 *   npm i -D playwright && npx playwright install chromium
 *   node tools/smoke-test.mjs anh-kiem-thu.png
 *
 * Script kiem tra: khoi dong, du lieu nap dung, ve tuyen, dat thiet bi,
 * hoan tac, gian tram chong lan, xuat DXF va nhap lai chinh file DXF do.
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const shot = process.argv[2] ?? 'smoke.png';
const url = 'file://' + process.cwd() + '/dist/index.html';
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push('CONSOLE: ' + m.text()));
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!cond) process.exitCode = 1;
};

await page.goto(url);
await page.waitForTimeout(1200);

const init = await page.evaluate(() => {
  const a = window.sodo;
  const c = {};
  for (const e of a.store.entities) c[e.kind] = (c[e.kind] || 0) + 1;
  return {
    counts: c,
    palette: document.querySelectorAll('.palette-item').length,
    tram: document.querySelectorAll('.tram-row').length,
    layers: document.querySelectorAll('.layer-row').length,
  };
});
check('Nạp sơ đồ tỉnh: có trạm', init.counts.substation >= 25, `${init.counts.substation} trạm`);
check('Nạp sơ đồ tỉnh: có đường dây', init.counts.branch >= 25, `${init.counts.branch} tuyến`);
check('Thư viện thiết bị', init.palette >= 20, `${init.palette} block`);
check('Danh mục trạm hiển thị đủ', init.tram === init.counts.substation);
check('Bảng lớp có cấp điện áp', init.layers >= 8, `${init.layers} lớp`);

const box = await page.locator('canvas').boundingBox();

// --- Ve mot tuyen moi ---
await page.keyboard.press('l');
await page.mouse.click(box.x + 380, box.y + 260);
await page.mouse.click(box.x + 520, box.y + 340);
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
const b1 = await page.evaluate(() => window.sodo.store.entities.filter((e) => e.kind === 'branch').length);
check('Vẽ được tuyến mới', b1 === init.counts.branch + 1, `${b1} tuyến`);

// --- Dat thiet bi ---
await page.keyboard.press('d');
await page.mouse.click(box.x + 450, box.y + 300);
await page.waitForTimeout(150);
const d1 = await page.evaluate(() => window.sodo.store.entities.filter((e) => e.kind === 'device').length);
check('Đặt được thiết bị', d1 >= 1, `${d1} thiết bị`);

// --- Hoan tac ---
await page.keyboard.press('Escape');
await page.keyboard.press('Control+z');
await page.waitForTimeout(150);
const d2 = await page.evaluate(() => window.sodo.store.entities.filter((e) => e.kind === 'device').length);
check('Hoàn tác (Ctrl+Z)', d2 === d1 - 1);

// --- Gian tram chong lan ---
const decl = await page.evaluate(() => window.sodo.declutter());
check('Giãn trạm chồng lấn', decl > 0, `${decl} trạm được giãn`);

// --- Xuat DXF roi nhap lai ---
const dxf = await page.evaluate(() => window.sodo.exportDxfText());
check('Xuất DXF có nội dung', dxf.includes('ENTITIES') && dxf.includes('EOF'), `${dxf.length} ký tự`);
writeFileSync('/tmp/roundtrip.dxf', dxf);
const stats = await page.evaluate((t) => window.sodo.importDxfText(t), dxf);
check('Nhập lại chính file DXF vừa xuất', stats.tuyen > 0, `${stats.tuyen} tuyến, ${stats.thietBi} thiết bị, ${stats.chu} chữ`);

await page.screenshot({ path: shot });
check('Không có lỗi JavaScript', errors.length === 0, errors.join(' | '));
console.log('Ảnh màn hình:', shot);
await browser.close();
