import { chromium } from 'playwright';
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const p = await b.newPage();
await p.goto('file://' + process.argv[2]);
await p.locator('svg').screenshot({ path: process.argv[3] });
await b.close();
