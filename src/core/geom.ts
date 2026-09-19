import type { Pt } from './types';

export const EPS = 1e-9;

export const pt = (x: number, y: number): Pt => ({ x, y });
export const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
export const len = (a: Pt): number => Math.hypot(a.x, a.y);
export const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);
export const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export function norm(a: Pt): Pt {
  const l = len(a);
  return l < EPS ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
}

/** Quay diem quanh goc toa do, goc tinh bang do, nguoc chieu kim dong ho. */
export function rotate(p: Pt, deg: number): Pt {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

/** Goc cua vector (do), 0 = +X, tang nguoc chieu kim dong ho. */
export function angleOf(v: Pt): number {
  return (Math.atan2(v.y, v.x) * 180) / Math.PI;
}

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function emptyBox(): Box {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}

export function isEmptyBox(b: Box): boolean {
  return !(b.maxX >= b.minX && b.maxY >= b.minY);
}

export function growBox(b: Box, p: Pt): Box {
  b.minX = Math.min(b.minX, p.x);
  b.minY = Math.min(b.minY, p.y);
  b.maxX = Math.max(b.maxX, p.x);
  b.maxY = Math.max(b.maxY, p.y);
  return b;
}

export function unionBox(a: Box, b: Box): Box {
  if (isEmptyBox(a)) return { ...b };
  if (isEmptyBox(b)) return { ...a };
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

export function padBox(b: Box, m: number): Box {
  return { minX: b.minX - m, minY: b.minY - m, maxX: b.maxX + m, maxY: b.maxY + m };
}

export function boxContains(b: Box, p: Pt): boolean {
  return p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY;
}

export function boxIntersects(a: Box, b: Box): boolean {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

/** Box a nam tron trong box b. */
export function boxInside(a: Box, b: Box): boolean {
  return a.minX >= b.minX && a.maxX <= b.maxX && a.minY >= b.minY && a.maxY <= b.maxY;
}

/** Khoang cach tu diem p den doan thang ab, kem diem chieu gan nhat. */
export function distToSeg(p: Pt, a: Pt, b: Pt): { d: number; at: Pt; t: number } {
  const ab = sub(b, a);
  const l2 = ab.x * ab.x + ab.y * ab.y;
  if (l2 < EPS) return { d: dist(p, a), at: a, t: 0 };
  let t = ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2;
  t = Math.max(0, Math.min(1, t));
  const at = { x: a.x + ab.x * t, y: a.y + ab.y * t };
  return { d: dist(p, at), at, t };
}

/** Hai doan thang co cat nhau khong (dung de chon bang khung cat). */
export function segIntersectsSeg(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const d = (a: Pt, b: Pt, c: Pt) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = d(p3, p4, p1);
  const d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3);
  const d4 = d(p1, p2, p4);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

/** Doan thang co cat qua hinh chu nhat khong. */
export function segIntersectsBox(a: Pt, b: Pt, box: Box): boolean {
  if (boxContains(box, a) || boxContains(box, b)) return true;
  const c1 = { x: box.minX, y: box.minY };
  const c2 = { x: box.maxX, y: box.minY };
  const c3 = { x: box.maxX, y: box.maxY };
  const c4 = { x: box.minX, y: box.maxY };
  return (
    segIntersectsSeg(a, b, c1, c2) ||
    segIntersectsSeg(a, b, c2, c3) ||
    segIntersectsSeg(a, b, c3, c4) ||
    segIntersectsSeg(a, b, c4, c1)
  );
}

/** Lam tron toa do ve boi so cua step (bat diem luoi). */
export function snapToGrid(p: Pt, step: number): Pt {
  if (step <= 0) return p;
  return { x: Math.round(p.x / step) * step, y: Math.round(p.y / step) * step };
}

/** Rang buoc ORTHO: ep diem ve phuong ngang hoac doc so voi goc. */
export function orthoConstrain(base: Pt, p: Pt): Pt {
  const dx = Math.abs(p.x - base.x);
  const dy = Math.abs(p.y - base.y);
  return dx >= dy ? { x: p.x, y: base.y } : { x: base.x, y: p.y };
}

/** Tong chieu dai polyline. */
export function polylineLength(pts: Pt[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]);
  return s;
}
