import type { DocStore } from '../core/doc';
import type { Entity, VoltageKv } from '../core/types';
import { entityOps, kheCat } from '../render/shapes';
import { colorOf, MAU_KXD_IN } from '../core/voltage';

/**
 * Xuat ban ve ra DXF R12 (ASCII) - dinh dang moi phan mem CAD deu doc duoc
 * (AutoCAD, BricsCAD, GstarCAD, VinaCAD, NanoCAD, LibreCAD...).
 * Dung R12 vi day la dinh dang DXF on dinh va tuong thich rong nhat.
 */

/** Mau ACI (AutoCAD Color Index) theo cap dien ap - dung quy uoc cua Phòng Điều độ. */
const ACI: Record<string, number> = {
  '500': 214,
  '220': 6, // tím
  '110': 1, // đỏ
  '35': 2, // vàng
  '22': 5, // xanh
  '10': 30,
  '6': 3,
  '0.4': 8,
};

function aci(kv: VoltageKv): number {
  return ACI[String(kv)] ?? 7;
}

class DxfWriter {
  private out: string[] = [];

  g(code: number, value: string | number): void {
    this.out.push(String(code));
    this.out.push(typeof value === 'number' ? fmt(value) : value);
  }

  text(): string {
    return this.out.join('\r\n') + '\r\n';
  }
}

function fmt(v: number): string {
  if (!isFinite(v)) return '0.0';
  return (Math.round(v * 1e6) / 1e6).toFixed(6);
}

/** DXF R12 khong chap nhan mot so ky tu trong ten lop. */
function safeLayer(name: string): string {
  return (name || '0').replace(/[<>/\\":;?*|=`,]/g, '_').slice(0, 31) || '0';
}

export function exportDxf(store: DocStore): string {
  const w = new DxfWriter();
  const sheet = store.sheet;
  const ents = Object.values(sheet.entities);

  /* ------------------------------ HEADER ------------------------------ */
  w.g(0, 'SECTION');
  w.g(2, 'HEADER');
  w.g(9, '$ACADVER');
  w.g(1, 'AC1009');
  w.g(9, '$INSUNITS');
  w.g(70, 0);
  w.g(0, 'ENDSEC');

  /* ------------------------------ TABLES ------------------------------ */
  const layers = new Map<string, number>();
  for (const e of ents) layers.set(safeLayer(e.layer), aci(e.kv));
  layers.set('0', 7);

  w.g(0, 'SECTION');
  w.g(2, 'TABLES');
  w.g(0, 'TABLE');
  w.g(2, 'LAYER');
  w.g(70, layers.size);
  for (const [name, color] of layers) {
    w.g(0, 'LAYER');
    w.g(2, name);
    w.g(70, 0);
    w.g(62, color);
    w.g(6, 'CONTINUOUS');
  }
  w.g(0, 'ENDTAB');
  w.g(0, 'ENDSEC');

  /* ----------------------------- ENTITIES ----------------------------- */
  w.g(0, 'SECTION');
  w.g(2, 'ENTITIES');

  // Khe hở của các dao cách ly đang cắt: đoạn dây nằm trong khe không xuất ra, để
  // bản CAD cũng thấy đường dây hở mạch
  const cacKhe: [{ x: number; y: number }, { x: number; y: number }][] = [];
  for (const e of ents) {
    if (e.kind !== 'device' || !store.isVisible(e)) continue;
    const k = kheCat(e);
    if (k) cacKhe.push(k);
  }
  /** Bỏ phần nằm trong khe hở ra khỏi đoạn a-b (chỉ khi đoạn chạy dọc theo khe). */
  const truKhe = (a: { x: number; y: number }, b: { x: number; y: number }): [number, number][] => {
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    let conLai: [number, number][] = [[0, 1]];
    if (L < 1e-9) return conLai;
    const ux = (b.x - a.x) / L;
    const uy = (b.y - a.y) / L;
    for (const [p, q] of cacKhe) {
      const lech = (z: { x: number; y: number }): number => Math.abs((z.x - a.x) * uy - (z.y - a.y) * ux);
      const tol = Math.max(0.05, Math.hypot(q.x - p.x, q.y - p.y) * 0.05);
      if (lech(p) > tol || lech(q) > tol) continue;
      let t0 = ((p.x - a.x) * ux + (p.y - a.y) * uy) / L;
      let t1 = ((q.x - a.x) * ux + (q.y - a.y) * uy) / L;
      if (t0 > t1) [t0, t1] = [t1, t0];
      if (t1 <= 0 || t0 >= 1) continue;
      const moi: [number, number][] = [];
      for (const [s0, s1] of conLai) {
        if (t1 <= s0 || t0 >= s1) moi.push([s0, s1]);
        else {
          if (t0 > s0) moi.push([s0, t0]);
          if (t1 < s1) moi.push([t1, s1]);
        }
      }
      conLai = moi;
    }
    return conLai;
  };

  for (const e of ents) {
    if (!store.isVisible(e)) continue;
    if (e.kind === 'node') continue;
    const layer = safeLayer(e.layer);
    // Thiết bị đóng cắt chưa rõ trạng thái: tô màu cam (ACI 30) để dễ nhận ra trong CAD
    const kxd = e.kind === 'device' && e.state === 'khong-xac-dinh';
    for (const op of entityOps(store, e)) {
      switch (op.t) {
        case 'path': {
          // Thân máy cắt đang đóng (tô đặc): thêm SOLID - thứ tự đỉnh của SOLID là 1-2-4-3
          if (op.fill && op.close && op.pts.length === 4) {
            const [a, b, c, d] = op.pts;
            w.g(0, 'SOLID');
            w.g(8, layer);
            if (kxd) w.g(62, 30);
            for (const [k, p] of [a, b, d, c].entries()) {
              w.g(10 + k, p.x);
              w.g(20 + k, p.y);
              w.g(30 + k, 0);
            }
          }
          const pts = op.close && op.pts.length > 2 ? [...op.pts, op.pts[0]] : op.pts;
          for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1];
            const b = pts[i];
            const phan: [number, number][] = e.kind === 'branch' && cacKhe.length ? truKhe(a, b) : [[0, 1]];
            for (const [t0, t1] of phan) {
              w.g(0, 'LINE');
              w.g(8, layer);
              if (kxd) w.g(62, 30);
              else if (op.kv !== undefined) w.g(62, aci(op.kv));
              w.g(10, a.x + (b.x - a.x) * t0);
              w.g(20, a.y + (b.y - a.y) * t0);
              w.g(30, 0);
              w.g(11, a.x + (b.x - a.x) * t1);
              w.g(21, a.y + (b.y - a.y) * t1);
              w.g(31, 0);
            }
          }
          break;
        }
        case 'circle':
          if (op.r <= 0) break;
          w.g(0, 'CIRCLE');
          w.g(8, layer);
          if (op.kv !== undefined) w.g(62, aci(op.kv));
          w.g(10, op.c.x);
          w.g(20, op.c.y);
          w.g(30, 0);
          w.g(40, op.r);
          break;
        case 'arc':
          w.g(0, 'ARC');
          w.g(8, layer);
          w.g(10, op.c.x);
          w.g(20, op.c.y);
          w.g(30, 0);
          w.g(40, op.r);
          w.g(50, op.a0);
          w.g(51, op.a1);
          break;
        case 'text':
          w.g(0, 'TEXT');
          w.g(8, layer);
          w.g(10, op.p.x);
          w.g(20, op.p.y);
          w.g(30, 0);
          w.g(40, op.h);
          w.g(1, op.s);
          w.g(50, op.rot);
          w.g(72, op.align === 'center' ? 1 : op.align === 'right' ? 2 : 0);
          if (op.align !== 'left') {
            w.g(11, op.p.x);
            w.g(21, op.p.y);
            w.g(31, 0);
          }
          break;
      }
    }
    // Ghi them nhan cua tram / duong day duoi dang TEXT de ban ve CAD doc duoc
    if (e.kind === 'substation') {
      writeText(w, layer, e.code, e.p.x, e.p.y + e.h / 2 + 0.6, 1.4, 1);
      writeText(w, layer, e.name, e.p.x, e.p.y + e.h / 2 + 2.4, 1.1, 1);
    }
    if (e.kind === 'branch' && (e.label || e.conductor)) {
      const pts = entityOps(store, e)[0];
      if (pts && pts.t === 'path' && pts.pts.length >= 2) {
        const a = pts.pts[0];
        const b = pts.pts[pts.pts.length - 1];
        const label = [e.label, e.conductor?.code].filter(Boolean).join(' ');
        writeText(w, layer, label, (a.x + b.x) / 2, (a.y + b.y) / 2 + 0.4, 0.9, 1);
      }
    }
  }

  w.g(0, 'ENDSEC');
  w.g(0, 'EOF');
  return w.text();
}

function writeText(
  w: DxfWriter,
  layer: string,
  s: string,
  x: number,
  y: number,
  h: number,
  align: number,
): void {
  if (!s) return;
  w.g(0, 'TEXT');
  w.g(8, layer);
  w.g(10, x);
  w.g(20, y);
  w.g(30, 0);
  w.g(40, h);
  w.g(1, s);
  w.g(72, align);
  w.g(11, x);
  w.g(21, y);
  w.g(31, 0);
}

/** Xuat SVG - dung de dan vao Word/Excel bao cao. */
export function exportSvg(store: DocStore, colorFor: (e: Entity) => string): string {
  // Vẽ theo thứ tự như trên màn hình (dây trước, thiết bị sau) để phần che khe hở
  // của dao cách ly đang cắt nằm đè lên đường dây
  const hang: Record<string, number> = { boundary: 0, branch: 1, circle: 1, substation: 3, device: 4, text: 5 };
  const ents = Object.values(store.sheet.entities)
    .filter((e) => store.isVisible(e) && e.kind !== 'node')
    .sort((a, b) => (hang[a.kind] ?? 9) - (hang[b.kind] ?? 9));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const body: string[] = [];
  for (const e of ents) {
    const kxd = e.kind === 'device' && e.state === 'khong-xac-dinh';
    const mau = kxd ? MAU_KXD_IN : colorFor(e);
    const net = kxd ? ' stroke-dasharray="0.6 0.45"' : '';
    // Dao cách ly đang cắt: che phần dây trong khe hở bằng màu nền trắng
    const khe = e.kind === 'device' ? kheCat(e) : null;
    if (khe) {
      body.push(
        `<line x1="${fmt(khe[0].x)}" y1="${fmt(-khe[0].y)}" x2="${fmt(khe[1].x)}" y2="${fmt(-khe[1].y)}" stroke="#ffffff" stroke-width="0.6"/>`,
      );
    }
    for (const op of entityOps(store, e)) {
      // cuộn dây máy biến áp: màu theo cấp điện áp của cuộn
      const color = op.t !== 'text' && op.kv !== undefined && !kxd ? colorOf(op.kv, true) : mau;
      if (op.t === 'path' && op.pts.length >= 2) {
        for (const p of op.pts) {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, -p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, -p.y);
        }
        const d = op.pts.map((p, i) => `${i ? 'L' : 'M'}${fmt(p.x)} ${fmt(-p.y)}`).join(' ');
        body.push(
          `<path d="${d}${op.close ? ' Z' : ''}" fill="${op.fill ? color : 'none'}" stroke="${color}" stroke-width="0.12"${net}/>`,
        );
      } else if (op.t === 'circle' && op.r > 0) {
        minX = Math.min(minX, op.c.x - op.r);
        minY = Math.min(minY, -op.c.y - op.r);
        maxX = Math.max(maxX, op.c.x + op.r);
        maxY = Math.max(maxY, -op.c.y + op.r);
        body.push(
          `<circle cx="${fmt(op.c.x)}" cy="${fmt(-op.c.y)}" r="${fmt(op.r)}" fill="${op.fill ? color : 'none'}" stroke="${color}" stroke-width="0.12"/>`,
        );
      } else if (op.t === 'text') {
        const anchor = op.align === 'center' ? 'middle' : op.align === 'right' ? 'end' : 'start';
        body.push(
          `<text x="${fmt(op.p.x)}" y="${fmt(-op.p.y)}" font-size="${fmt(op.h)}" fill="${color}" text-anchor="${anchor}" font-family="Segoe UI, sans-serif">${esc(op.s)}</text>`,
        );
      }
    }
  }
  if (!isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 100;
    maxY = 100;
  }
  const pad = 4;
  const w = maxX - minX + pad * 2;
  const h = maxY - minY + pad * 2;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmt(minX - pad)} ${fmt(minY - pad)} ${fmt(w)} ${fmt(h)}" width="${Math.round(w * 8)}" height="${Math.round(h * 8)}">`,
    `<rect x="${fmt(minX - pad)}" y="${fmt(minY - pad)}" width="${fmt(w)}" height="${fmt(h)}" fill="#ffffff"/>`,
    ...body,
    '</svg>',
  ].join('\n');
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
