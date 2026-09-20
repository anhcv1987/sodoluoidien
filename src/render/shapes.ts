import type { DocStore } from '../core/doc';
import type { Entity, Pt, DeviceEntity, BranchEntity, SubstationEntity } from '../core/types';
import { emptyBox, growBox, type Box, dist, distToSeg } from '../core/geom';
import { getBlock, primsFor } from '../symbols/blocks';
import { rotate } from '../core/geom';

/** Mot thao tac ve trong toa do THE GIOI (chua doi sang man hinh). */
export type WOp =
  | { t: 'path'; pts: Pt[]; close?: boolean; fill?: boolean }
  | { t: 'circle'; c: Pt; r: number; fill?: boolean }
  | { t: 'arc'; c: Pt; r: number; a0: number; a1: number }
  | { t: 'text'; p: Pt; s: string; h: number; align: 'left' | 'center' | 'right'; rot: number };

/** Lay danh sach diem cua mot nhanh tu cac nut. */
export function branchPoints(store: DocStore, b: BranchEntity): Pt[] {
  const pts: Pt[] = [];
  for (const id of b.nodes) {
    const n = store.get(id);
    if (n && n.kind === 'node') pts.push(n.p);
  }
  return pts;
}

/** Bien doi hinh ve cua block theo vi tri / goc quay / ty le cua thiet bi. */
export function deviceOps(d: DeviceEntity, fillClosedBreaker = false): WOp[] {
  const def = getBlock(d.block);
  if (!def) return [];
  const s = d.scale || 1;
  const m = d.mirror ? -1 : 1;
  const tx = (x: number, y: number): Pt => {
    const r = rotate({ x: x * m * s, y: y * s }, d.rot);
    return { x: r.x + d.p.x, y: r.y + d.p.y };
  };
  const ops: WOp[] = [];
  for (const p of primsFor(def, d.state)) {
    switch (p.t) {
      case 'line':
      case 'poly': {
        const pts: Pt[] = [];
        for (let i = 0; i + 1 < p.pts.length; i += 2) pts.push(tx(p.pts[i], p.pts[i + 1]));
        const fill = p.t === 'poly' ? p.fill : false;
        ops.push({ t: 'path', pts, close: p.t === 'poly' ? p.close : false, fill });
        break;
      }
      case 'circle':
        ops.push({ t: 'circle', c: tx(p.c[0], p.c[1]), r: p.r * s, fill: p.fill });
        break;
      case 'arc':
        // Lat guong doi chieu quet cua cung tron: goc a -> 180 - a, va dao dau/cuoi.
        ops.push(
          m < 0
            ? { t: 'arc', c: tx(p.c[0], p.c[1]), r: p.r * s, a0: 180 - p.a1 + d.rot, a1: 180 - p.a0 + d.rot }
            : { t: 'arc', c: tx(p.c[0], p.c[1]), r: p.r * s, a0: p.a0 + d.rot, a1: p.a1 + d.rot },
        );
        break;
      case 'text':
        // Chu trong block luon ve xuoi chieu, khong lat guong.
        ops.push({ t: 'text', p: tx(p.p[0], p.p[1]), s: p.s, h: p.h * s, align: 'left', rot: 0 });
        break;
    }
  }
  // May cat dang dong: to dac than may cat cho de nhin khi dieu do (tuy chon).
  if (fillClosedBreaker && def.fillWhenClosed && d.state === 'dong') {
    for (const op of ops) if (op.t === 'path' && op.close) op.fill = true;
  }
  return ops;
}

/** Hinh chu nhat khoi tram tren so do tinh. */
export function substationOps(s: SubstationEntity): WOp[] {
  const hw = s.w / 2;
  const hh = s.h / 2;
  return [
    {
      t: 'path',
      pts: [
        { x: s.p.x - hw, y: s.p.y - hh },
        { x: s.p.x + hw, y: s.p.y - hh },
        { x: s.p.x + hw, y: s.p.y + hh },
        { x: s.p.x - hw, y: s.p.y + hh },
      ],
      close: true,
    },
  ];
}

/** Sinh cac thao tac ve cho mot doi tuong bat ky. */
export function entityOps(store: DocStore, e: Entity, fillClosedBreaker = false): WOp[] {
  switch (e.kind) {
    case 'branch': {
      const pts = branchPoints(store, e);
      return pts.length >= 2 ? [{ t: 'path', pts }] : [];
    }
    case 'device':
      return deviceOps(e, fillClosedBreaker);
    case 'substation':
      return substationOps(e);
    case 'node':
      return [{ t: 'circle', c: e.p, r: 0 }];
    case 'text':
      return [{ t: 'text', p: e.p, s: e.text, h: e.height, align: e.align, rot: e.rot }];
    case 'boundary':
      return e.pts.length >= 2 ? [{ t: 'path', pts: e.pts, close: e.closed }] : [];
    case 'circle':
      return [{ t: 'circle', c: e.c, r: e.r, fill: e.filled }];
  }
}

/** Hop bao cua doi tuong trong toa do the gioi. */
export function entityBox(store: DocStore, e: Entity): Box {
  const b = emptyBox();
  if (e.kind === 'node') {
    growBox(b, e.p);
    return b;
  }
  for (const op of entityOps(store, e)) {
    switch (op.t) {
      case 'path':
        for (const p of op.pts) growBox(b, p);
        break;
      case 'circle':
      case 'arc':
        growBox(b, { x: op.c.x - op.r, y: op.c.y - op.r });
        growBox(b, { x: op.c.x + op.r, y: op.c.y + op.r });
        break;
      case 'text':
        growBox(b, op.p);
        growBox(b, { x: op.p.x + op.s.length * op.h * 0.6, y: op.p.y + op.h });
        break;
    }
  }
  return b;
}

/** Khoang cach tu diem den doi tuong (don vi ban ve); Infinity neu qua xa. */
export function distToEntity(store: DocStore, e: Entity, p: Pt): number {
  let best = Infinity;
  if (e.kind === 'node') return dist(p, e.p);
  for (const op of entityOps(store, e)) {
    switch (op.t) {
      case 'path': {
        const pts = op.pts;
        for (let i = 1; i < pts.length; i++) best = Math.min(best, distToSeg(p, pts[i - 1], pts[i]).d);
        if (op.close && pts.length > 2) {
          best = Math.min(best, distToSeg(p, pts[pts.length - 1], pts[0]).d);
        }
        break;
      }
      case 'circle':
      case 'arc':
        best = Math.min(best, Math.abs(dist(p, op.c) - op.r));
        break;
      case 'text': {
        const w = op.s.length * op.h * 0.6;
        const x0 = op.align === 'center' ? op.p.x - w / 2 : op.align === 'right' ? op.p.x - w : op.p.x;
        const inside = p.x >= x0 && p.x <= x0 + w && p.y >= op.p.y && p.y <= op.p.y + op.h;
        best = Math.min(best, inside ? 0 : dist(p, op.p));
        break;
      }
    }
  }
  return best;
}

/** Cac diem "bat diem" (osnap) ma doi tuong cung cap. */
/**
 * Vi tri cac CUC DAU NOI cua mot thiet bi tren ban ve.
 *
 * Lay tu thu vien block (`cuc`), quay - lat - phong theo dung thiet bi. Day la
 * cho ma day dan phai cham vao thi thiet bi moi thuc su duoc dau vao luoi.
 */
export function cucThietBi(e: DeviceEntity): Pt[] {
  const def = getBlock(e.block);
  const bang = (e.state === 'mo' ? def?.cucMo : undefined) ?? def?.cuc;
  const ds = bang?.length ? bang : [[0, 0] as [number, number]];
  const m = e.mirror ? -1 : 1;
  const r = (e.rot * Math.PI) / 180;
  const co = Math.cos(r);
  const si = Math.sin(r);
  const laMBA = /^(MBA|AT)/.test(e.block);
  return ds.map((c) => {
    let cx = c[0];
    let cy = c[1];
    // Thiet bi dau re mot cuc: diem dau nam o MEP hop bao (xem src/core/lienket.ts)
    const hb = (e.state === 'mo' ? def?.bboxOpen : undefined) ?? def?.bbox;
    if (ds.length === 1 && hb && !laMBA) {
      const k = Math.max(
        Math.abs(cx) / Math.max(hb[0] / 2, 1e-9),
        Math.abs(cy) / Math.max(hb[1] / 2, 1e-9),
      );
      if (k > 1e-6) {
        cx /= k;
        cy /= k;
      }
    }
    const x = cx * m * e.scale;
    const y = cy * e.scale;
    return { x: e.p.x + x * co - y * si, y: e.p.y + x * si + y * co };
  });
}

export function snapPoints(store: DocStore, e: Entity): { p: Pt; kind: string }[] {
  const out: { p: Pt; kind: string }[] = [];
  switch (e.kind) {
    case 'node':
      out.push({ p: e.p, kind: 'Nút' });
      break;
    case 'device': {
      // Cực đấu nối phải đứng TRƯỚC tâm thiết bị: vẽ dây thì bao giờ cũng muốn
      // bắt vào cực, bắt vào tâm là nối hụt.
      for (const c of cucThietBi(e)) out.push({ p: c, kind: 'Cực đấu nối' });
      out.push({ p: e.p, kind: 'Tâm thiết bị' });
      break;
    }
    case 'substation':
      out.push({ p: e.p, kind: 'Tâm trạm' });
      break;
    case 'branch': {
      const pts = branchPoints(store, e);
      for (let i = 0; i < pts.length; i++) {
        out.push({ p: pts[i], kind: i === 0 || i === pts.length - 1 ? 'Điểm cuối' : 'Đỉnh' });
        if (i > 0) {
          out.push({
            p: { x: (pts[i - 1].x + pts[i].x) / 2, y: (pts[i - 1].y + pts[i].y) / 2 },
            kind: 'Trung điểm',
          });
        }
      }
      break;
    }
    case 'boundary':
      break;
    case 'text':
      out.push({ p: e.p, kind: 'Điểm chèn' });
      break;
    case 'circle':
      out.push({ p: e.c, kind: 'Tâm đường tròn' });
      break;
  }
  return out;
}
