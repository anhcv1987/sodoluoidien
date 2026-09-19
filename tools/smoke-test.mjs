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

// --- Mở sơ đồ nguyên lý trong trạm (dữ liệu trích từ file CAD) ---
const cad = await page.evaluate(() => {
  const a = window.sodo;
  const sub = a.store.entities.find((e) => e.kind === 'substation' && e.code === 'E6.5');
  const ok = a.openCadSheet('E6.5', sub && sub.id);
  const c = {};
  for (const e of a.store.entities) c[e.kind] = (c[e.kind] || 0) + 1;
  const kvs = {};
  for (const e of a.store.entities) if (e.kind === 'device') kvs[e.kv] = (kvs[e.kv] || 0) + 1;
  return { ok, c, kvs, tabs: document.querySelectorAll('.tab').length, sheet: a.store.sheet.name };
});
check('Mở được sơ đồ nguyên lý trạm E6.5', cad.ok && cad.tabs === 2, cad.sheet);
check('Sơ đồ trạm có đủ thiết bị', (cad.c.device ?? 0) > 100, `${cad.c.device} thiết bị, ${cad.c.branch} tuyến`);
check(
  'Thiết bị phân đúng 110/35/22kV',
  (cad.kvs['110'] ?? 0) > 20 && (cad.kvs['35'] ?? 0) > 20 && (cad.kvs['22'] ?? 0) > 20,
  JSON.stringify(cad.kvs),
);

// --- Nhấn đúp vào khối trạm trên sơ đồ tỉnh cũng mở được ---
await page.evaluate(() => {
  const a = window.sodo;
  a.store.setActiveSheet(a.store.drawing.sheets[0].id);
  a.zoomProvince();
});
await page.waitForTimeout(300);
const dbl = await page.evaluate(async () => {
  const a = window.sodo;
  const sub = a.store.entities.find((e) => e.kind === 'substation' && e.code === 'E6.7');
  const s = a.ed.vp.toScreen(sub.p);
  const r = document.querySelector('canvas').getBoundingClientRect();
  const ev = (type) =>
    document.querySelector('canvas').dispatchEvent(
      new MouseEvent(type, { clientX: r.left + s.x, clientY: r.top + s.y, bubbles: true }),
    );
  ev('dblclick');
  await new Promise((res) => setTimeout(res, 200));
  return { sheet: a.store.sheet.name, tabs: document.querySelectorAll('.tab').length };
});
check('Nhấn đúp khối trạm mở sơ đồ trong trạm', dbl.sheet.startsWith('E6.7'), dbl.sheet);

await page.screenshot({ path: shot });
check('Không có lỗi JavaScript', errors.length === 0, errors.join(' | '));
console.log('Ảnh màn hình:', shot);
await browser.close();
