/**
 * Dựng bộ dữ liệu "sơ đồ nguyên lý từng trạm" cho phần mềm.
 *
 * Đầu vào : thư mục DXF do tools/tach-so-do-tram.py tạo ra (kèm muc-luc.json).
 * Đầu ra  : src/data/tram-sld.json — nhúng thẳng vào phần mềm khi build.
 *
 * Cách dùng:
 *     node tools/dung-du-lieu-tram.mjs <thư-mục-dxf> [đường-dẫn-json-ra]
 *
 * Script dùng đúng bộ nhập DXF của phần mềm (src/io/dxfImport.ts) nên kết quả
 * trong file dữ liệu giống hệt khi người dùng tự nhập tay bằng menu Tệp → Nhập từ CAD.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const dxfDir = resolve(process.argv[2] ?? 'tram');
const outPath = resolve(process.argv[3] ?? 'src/data/tram-sld.json');

/* ---- 1. Gói bộ nhập DXF thành module chạy được bằng Node ---- */

const tmp = mkdtempSync(join(tmpdir(), 'sld-'));
const bundle = join(tmp, 'importer.mjs');
execFileSync(
  'npx',
  ['esbuild', 'src/io/dxfImport.ts', '--bundle', '--format=esm', '--platform=node', `--outfile=${bundle}`, '--log-level=warning'],
  { stdio: 'inherit' },
);
const { importDxf, defaultImportOptions } = await import(pathToFileURL(bundle).href);

/* ---- 2. Đọc mục lục các tờ ---- */

let index;
try {
  index = JSON.parse(readFileSync(join(dxfDir, 'muc-luc.json'), 'utf8'));
} catch {
  index = readdirSync(dxfDir)
    .filter((f) => f.toLowerCase().endsWith('.dxf'))
    .map((f) => ({ code: f.replace(/_/g, '.').replace(/\.dxf$/i, ''), file: f, title: f }));
}

/* ---- 3. Đọc bảng mã của từng file DXF rồi nhập ---- */

/** Giải mã nội dung DXF theo đúng bảng mã ghi trong file (giống src/io/file.ts). */
function decodeDxf(buf) {
  const head = new TextDecoder('windows-1252').decode(buf.subarray(0, 4096));
  const ver = /\$ACADVER\s*\r?\n\s*1\s*\r?\n\s*(AC\d+)/.exec(head)?.[1] ?? '';
  const verNum = Number(ver.replace('AC', '')) || 0;
  let label = 'utf-8';
  if (verNum && verNum < 1021) {
    const cp = /\$DWGCODEPAGE\s*\r?\n\s*3\s*\r?\n\s*([A-Za-z0-9_]+)/.exec(head)?.[1] ?? '';
    const m = /ANSI_(\d{3,4})/i.exec(cp);
    label = /utf/i.test(cp) ? 'utf-8' : m ? `windows-${m[1]}` : 'windows-1252';
  }
  try {
    return new TextDecoder(label, { fatal: label === 'utf-8' }).decode(buf);
  } catch {
    return new TextDecoder('windows-1252').decode(buf);
  }
}

const LINE_KINDS = ['ĐDK', 'Cáp ngầm', 'Cáp vặn xoắn', 'Thanh cái'];
const STATES = ['dong', 'mo', 'khong-xac-dinh'];
const ALIGNS = ['left', 'center', 'right'];

const layerTable = [];
const blockTable = [];
const srcTable = [];
const idx = (table, v) => {
  let i = table.indexOf(v);
  if (i < 0) {
    i = table.length;
    table.push(v);
  }
  return i;
};
const r2 = (v) => Math.round(v * 100) / 100;

const sheets = [];
let totalEntities = 0;

for (const item of index) {
  const buf = readFileSync(join(dxfDir, item.file));
  const text = decodeDxf(buf);

  const opt = defaultImportOptions();
  // Giữ nguyên đơn vị của bản vẽ CAD (1 đơn vị phần mềm = 1 đơn vị CAD)
  // để hình học trong trạm đúng y như bản gốc.
  opt.scale = 1;
  opt.defaultKv = 22;
  opt.importText = true;

  // Lượt 1 để biết hộp bao, lượt 2 để đưa tâm bản vẽ về gốc toạ độ.
  const pre = importDxf(text, opt);
  opt.offset = {
    x: -(pre.box.minX + pre.box.maxX) / 2,
    y: -(pre.box.minY + pre.box.maxY) / 2,
  };
  const res = importDxf(text, opt);

  // Chuyển sang dạng nén gọn: nút của tuyến lưu thẳng thành danh sách toạ độ,
  // tên lớp và tên block tra qua bảng dùng chung -> nhỏ hơn ~4 lần so với JSON thẳng.
  const nodes = new Map();
  for (const e of res.entities) if (e.kind === 'node') nodes.set(e.id, e.p);

  const b = [];
  const d = [];
  const t = [];
  const c = [];
  for (const e of res.entities) {
    if (e.kind === 'branch') {
      const pts = [];
      for (const id of e.nodes) {
        const p = nodes.get(id);
        if (p) pts.push(r2(p.x), r2(p.y));
      }
      if (pts.length >= 4) {
        b.push([idx(layerTable, e.layer), e.kv, LINE_KINDS.indexOf(e.lineKind), idx(srcTable, e.srcLayer ?? ''), ...pts]);
      }
    } else if (e.kind === 'device') {
      d.push([
        idx(layerTable, e.layer),
        e.kv,
        idx(blockTable, e.block),
        r2(e.p.x),
        r2(e.p.y),
        r2(e.rot),
        r2(e.scale),
        Math.max(0, STATES.indexOf(e.state ?? 'dong')),
        idx(srcTable, e.srcLayer ?? ''),
      ]);
    } else if (e.kind === 'circle') {
      c.push([
        idx(layerTable, e.layer),
        e.kv,
        r2(e.c.x),
        r2(e.c.y),
        r2(e.r),
        idx(srcTable, e.srcLayer ?? ''),
      ]);
    } else if (e.kind === 'text') {
      t.push([
        idx(layerTable, e.layer),
        e.kv,
        r2(e.p.x),
        r2(e.p.y),
        r2(e.height),
        r2(e.rot),
        Math.max(0, ALIGNS.indexOf(e.align)),
        idx(srcTable, e.srcLayer ?? ''),
        e.text,
      ]);
    }
  }
  totalEntities += b.length + d.length + t.length + c.length;

  const sheet = { code: item.code, title: item.title, b, d, t, c };
  // Tờ tổng: kèm vị trí từng trạm (đã quy đổi toạ độ) để phần mềm nhảy tới đúng chỗ
  if (item.stations?.length) {
    const px = (v) => r2(v * opt.scale + opt.offset.x);
    const py = (v) => r2(v * opt.scale + opt.offset.y);
    sheet.st = item.stations.map((x) => [
      x.code,
      x.title,
      px(x.x),
      py(x.y),
      ...(x.box ? [px(x.box[0]), py(x.box[1]), px(x.box[2]), py(x.box[3])] : []),
    ]);
  }
  sheets.push(sheet);
  console.log(
    `  ${item.code.padEnd(8)} ${String(b.length).padStart(5)} tuyến  ` +
      `${String(d.length).padStart(5)} thiết bị  ${String(c.length).padStart(4)} hình tròn  ${String(t.length).padStart(5)} chữ` +
      (res.stats.suyTuKyHieu ? `  (${res.stats.suyTuKyHieu} suy từ ký hiệu ngăn lộ)` : ''),
  );
}

writeFileSync(
  outPath,
  JSON.stringify({
    version: 3,
    lineKinds: LINE_KINDS,
    states: STATES,
    aligns: ALIGNS,
    layers: layerTable,
    blocks: blockTable,
    srcLayers: srcTable,
    sheets,
  }),
);
rmSync(tmp, { recursive: true, force: true });

const kb = (readFileSync(outPath).length / 1024).toFixed(0);
console.log(`\nĐã dựng ${sheets.length} tờ, ${totalEntities} đối tượng → ${outPath} (${kb} KB)`);
