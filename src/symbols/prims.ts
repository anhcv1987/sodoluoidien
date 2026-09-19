/**
 * Nguyen thuy hinh hoc dung de dinh nghia block thiet bi.
 * Toa do trong block la "don vi block"; khi dat vao ban ve se nhan voi
 * DeviceEntity.scale va quay theo DeviceEntity.rot.
 */
export type Prim =
  | { t: 'line'; pts: number[] }
  | { t: 'poly'; pts: number[]; close?: boolean; fill?: boolean }
  | { t: 'circle'; c: [number, number]; r: number; fill?: boolean }
  | { t: 'arc'; c: [number, number]; r: number; a0: number; a1: number }
  | { t: 'text'; p: [number, number]; s: string; h: number };

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function grow(b: Bounds, x: number, y: number): void {
  b.minX = Math.min(b.minX, x);
  b.minY = Math.min(b.minY, y);
  b.maxX = Math.max(b.maxX, x);
  b.maxY = Math.max(b.maxY, y);
}

export function primBounds(prims: Prim[]): Bounds {
  const b: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const p of prims) {
    switch (p.t) {
      case 'line':
      case 'poly':
        for (let i = 0; i + 1 < p.pts.length; i += 2) grow(b, p.pts[i], p.pts[i + 1]);
        break;
      case 'circle':
        grow(b, p.c[0] - p.r, p.c[1] - p.r);
        grow(b, p.c[0] + p.r, p.c[1] + p.r);
        break;
      case 'arc': {
        // Lay gan dung: bao ca duong tron (du an toan cho viec canh giua).
        grow(b, p.c[0] - p.r, p.c[1] - p.r);
        grow(b, p.c[0] + p.r, p.c[1] + p.r);
        break;
      }
      case 'text':
        grow(b, p.p[0], p.p[1]);
        grow(b, p.p[0] + p.s.length * p.h * 0.6, p.p[1] + p.h);
        break;
    }
  }
  if (!isFinite(b.minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return b;
}

/** Bien doi tuyen tinh: quay (do) roi nhan he so roi tinh tien. */
export interface Xform {
  /** Goc quay (do), nguoc chieu kim dong ho. */
  rot?: number;
  /** He so thu phong. */
  k?: number;
  dx?: number;
  dy?: number;
}

export function xformPrims(prims: Prim[], x: Xform): Prim[] {
  const r = ((x.rot ?? 0) * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const k = x.k ?? 1;
  const dx = x.dx ?? 0;
  const dy = x.dy ?? 0;
  const tx = (px: number, py: number): [number, number] => [
    (px * c - py * s) * k + dx,
    (px * s + py * c) * k + dy,
  ];
  const mapPts = (pts: number[]): number[] => {
    const out: number[] = [];
    for (let i = 0; i + 1 < pts.length; i += 2) {
      const [a, b] = tx(pts[i], pts[i + 1]);
      out.push(round(a), round(b));
    }
    return out;
  };
  return prims.map((p): Prim => {
    switch (p.t) {
      case 'line':
        return { t: 'line', pts: mapPts(p.pts) };
      case 'poly':
        return { ...p, pts: mapPts(p.pts) };
      case 'circle': {
        const [a, b] = tx(p.c[0], p.c[1]);
        return { ...p, c: [round(a), round(b)], r: round(p.r * k) };
      }
      case 'arc': {
        const [a, b] = tx(p.c[0], p.c[1]);
        const d = x.rot ?? 0;
        return { t: 'arc', c: [round(a), round(b)], r: round(p.r * k), a0: p.a0 + d, a1: p.a1 + d };
      }
      case 'text': {
        const [a, b] = tx(p.p[0], p.p[1]);
        return { ...p, p: [round(a), round(b)], h: round(p.h * k) };
      }
    }
  });
}

const round = (v: number): number => Math.round(v * 10000) / 10000;

/**
 * Chuan hoa mot bo hinh ve lay tu CAD ve he toa do block:
 *  - quay `rot` do (de dua truc thiet bi ve phuong thang dung +Y),
 *  - nhan he so `k`,
 *  - tinh tien sao cho tam hop bao nam tai goc toa do.
 *
 * Tra ve kem `origin` = vi tri (trong he toa do block moi) ung voi DIEM CHEN
 * cua block CAD goc. Can gia tri nay de khi nhap tu DXF dat thiet bi dung cho:
 * block CAD lay diem chen lam goc, con block o day lay TAM hinh lam goc.
 */
export function normalizeCad(
  prims: Prim[],
  rot = 0,
  k = 1 / 18.669,
): { prims: Prim[]; origin: [number, number] } {
  const rotated = xformPrims(prims, { rot, k });
  const b = primBounds(rotated);
  const dx = -(b.minX + b.maxX) / 2;
  const dy = -(b.minY + b.maxY) / 2;
  return {
    prims: xformPrims(rotated, { dx, dy }),
    origin: [round(dx), round(dy)],
  };
}

/* -------------------- ham tien ich dung khi dinh nghia block ------------- */

export const L = (...pts: number[]): Prim => ({ t: 'line', pts });
export const P = (close: boolean, fill: boolean, ...pts: number[]): Prim => ({
  t: 'poly',
  pts,
  close,
  fill,
});
export const C = (cx: number, cy: number, r: number, fill = false): Prim => ({
  t: 'circle',
  c: [cx, cy],
  r,
  fill,
});
export const A = (cx: number, cy: number, r: number, a0: number, a1: number): Prim => ({
  t: 'arc',
  c: [cx, cy],
  r,
  a0,
  a1,
});
export const T = (px: number, py: number, s: string, h: number): Prim => ({
  t: 'text',
  p: [px, py],
  s,
  h,
});
