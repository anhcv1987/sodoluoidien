/**
 * RÀ SOÁT CẤP ĐIỆN ÁP TRÊN SƠ ĐỒ KẾT DÂY.
 *
 *     npm run build && node tools/kiem-cap-dien-ap.mjs
 *
 * Quét toàn bộ nhãn ngăn lộ trong sơ đồ (471, 331, C43, TI431...), suy ra cấp điện
 * áp theo chữ số đầu (Thông tư 06/2025/TT-BCT) rồi so với cấp điện áp của đường dây
 * / thiết bị ngay cạnh nhãn đó. Chỗ nào lệch là chỗ nghi tô sai màu, cần xem lại.
 *
 * Lưu ý: một số chỗ lệch là "báo nhầm" của chính công cụ này, ví dụ dãy tủ hợp bộ
 * 6kV đánh số C09, C10, C11... (không phải tên thanh cái 110kV).
 */
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage();
await p.goto('file://' + process.cwd() + '/dist/index.html');
await p.waitForTimeout(2600);
const r = await p.evaluate(() => {
  const a = window.sodo;
  const KV = {1:110,2:220,3:35,4:22,5:500,6:6,7:10,9:0.4};
  const kvOf = (s) => {
    s = (s||'').trim();
    if (/kv|kva|mva|mvar|km|mm|ac-|acsr|cu\/|al\/|xlpe|\d,\d|\d\/\d/i.test(s)) return null;
    let m = s.match(/^C\s?([1-9])[1-9]$/i); if (m) return KV[m[1]]??null;
    m = s.match(/^(?:TUC|TU|TI|MC|DCL|DTD|LBS|REC|TBN|TB|KH|FCO|LTD|CD|CC|CS|AT|R|T)?[-\s]?([1-9])\d{2}(?:[-\s]?\d{1,2})?$/i);
    return m ? (KV[m[1]]??null) : null;
  };
  const ents = a.store.entities;
  const dev = ents.filter(e=>e.kind==='device');
  const br  = ents.filter(e=>e.kind==='branch');
  const segs=[]; for (const e of br) { const q=e.nodes.map(n=>a.store.get(n).p); for(let i=1;i<q.length;i++) segs.push({a:q[i-1],b:q[i],kv:e.kv,id:e.id}); }
  const d2 = (p,s)=>{const dx=s.b.x-s.a.x, dy=s.b.y-s.a.y; const L=dx*dx+dy*dy; let t=L?((p.x-s.a.x)*dx+(p.y-s.a.y)*dy)/L:0; t=Math.max(0,Math.min(1,t)); const qx=s.a.x+t*dx-p.x, qy=s.a.y+t*dy-p.y; return Math.hypot(qx,qy);};
  const out=[]; const tong={};
  for (const t of ents) {
    if (t.kind!=='text') continue;
    const k = kvOf(t.text); if (k===null) continue;
    tong[k]=(tong[k]||0)+1;
    const R = Math.max(t.height*6, 8);
    let near=null, nd=R;
    for (const s of segs) { const d=d2(t.p,s); if (d<nd){nd=d;near=s.kv;} }
    let ndv=R, nearDev=null;
    for (const dv of dev) { const d=Math.hypot(dv.p.x-t.p.x, dv.p.y-t.p.y); if(d<ndv){ndv=d;nearDev=dv;} }
    if (near!==null && near!==k) out.push({t:t.text, nhan:k, day:near, p:[Math.round(t.p.x),Math.round(t.p.y)]});
    else if (nearDev && nearDev.kv!==k) out.push({t:t.text, nhan:k, tb:nearDev.block+':'+nearDev.kv, p:[Math.round(t.p.x),Math.round(t.p.y)]});
  }
  const kvAll={}; for(const e of ents) if(e.kind!=='node') kvAll[e.kv]=(kvAll[e.kv]||0)+1;
  return {tong, soNhan:Object.values(tong).reduce((x,y)=>x+y,0), lech: out.length, vd: out.slice(0,40), kvAll};
});
console.log(JSON.stringify(r,null,1));
await b.close();
