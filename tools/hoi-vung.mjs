/** Liet ke doi tuong trong mot vung: node tools/hoi-vung.mjs x0,y0,x1,y1 */
import { chromium } from 'playwright';
const [x0,y0,x1,y1] = process.argv[2].split(',').map(Number);
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const p = await b.newPage();
await p.goto('file://' + process.cwd() + '/dist/index.html');
await p.waitForTimeout(2600);
const r = await p.evaluate(([x0,y0,x1,y1]) => {
  const a = window.sodo;
  const inb = (q)=> q.x>=x0&&q.x<=x1&&q.y>=y0&&q.y<=y1;
  const R=(v)=>Math.round(v*10)/10;
  const out=[];
  for (const e of a.store.entities) {
    if (e.kind==='branch') {
      const pts = e.nodes.map(n=>a.store.get(n).p);
      if (pts.some(inb)) out.push({k:'branch',kv:e.kv,sl:e.srcLayer,pts:pts.map(q=>[R(q.x),R(q.y)])});
    } else if (e.kind==='device' && inb(e.p)) out.push({k:'dev',blk:e.block,kv:e.kv,sl:e.srcLayer,p:[R(e.p.x),R(e.p.y)],rot:Math.round(e.rot),sc:R(e.scale),st:e.state});
    else if (e.kind==='text' && inb(e.p)) out.push({k:'text',kv:e.kv,t:e.text,p:[R(e.p.x),R(e.p.y)]});
    else if (e.kind==='circle' && inb(e.c)) out.push({k:'circle',kv:e.kv,c:[R(e.c.x),R(e.c.y)],r:R(e.r)});
  }
  return out;
}, [x0,y0,x1,y1]);
console.log(JSON.stringify(r,null,0).replace(/\},\{/g,'}\n{'));
await b.close();
