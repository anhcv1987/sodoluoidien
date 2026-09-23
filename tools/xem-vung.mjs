/**
 * Chup anh mot vung cua so do trong phan mem, de doi chieu voi ban CAD goc.
 *   node tools/xem-vung.mjs x0,y0,x1,y1 anh.png
 * Mac dinh chup o che do in (nen trang); dat MAN_HINH=1 de chup dung nhu tren man hinh.
 */
import { chromium } from 'playwright';
const [x0,y0,x1,y1] = process.argv[2].split(',').map(Number);
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const p = await b.newPage({ viewport: { width: 1100, height: 1100 } });
await p.goto('file://' + process.cwd() + '/dist/index.html');
await p.waitForTimeout(2600);
await p.evaluate(([x0,y0,x1,y1,manHinh]) => {
  const a = window.sodo;
  a.ed.renderer.opt.printMode = !manHinh;
  a.ed.renderer.opt.showGrid = false;
  a.ed.crosshair = false;
  a.ed.vp.fit({minX:x0, minY:y0, maxX:x1, maxY:y1}, 0.02);
  a.ed.requestDraw();
}, [x0,y0,x1,y1,!!process.env.MAN_HINH]);
await p.waitForTimeout(600);
await p.locator('canvas').screenshot({ path: process.argv[3] });
await b.close();
