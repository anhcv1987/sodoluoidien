import type { DocStore } from '../core/doc';
import type { Pt } from '../core/types';
import { dist, distToSeg, orthoConstrain, snapToGrid } from '../core/geom';
import { branchPoints, snapPoints } from '../render/shapes';
import type { Viewport } from '../render/viewport';

export interface SnapSettings {
  /** Bat diem doi tuong (endpoint, midpoint, nut, tam thiet bi). */
  osnap: boolean;
  /** Bat diem vao luoi. */
  grid: boolean;
  /** Buoc luoi (don vi ban ve). */
  gridStep: number;
  /** Rang buoc ngang / doc (F8). */
  ortho: boolean;
  /** Ban kinh hut (pixel). */
  radiusPx: number;
  /** Bat vao diem gan nhat tren duong day (perpendicular / nearest). */
  nearest: boolean;
}

export const defaultSnap = (): SnapSettings => ({
  osnap: true,
  grid: false,
  gridStep: 1,
  ortho: false,
  radiusPx: 12,
  nearest: true,
});

export interface SnapResult {
  p: Pt;
  kind: string;
  /** Nhanh ma diem nam tren (neu bat kieu "tren tuyen"). */
  onBranch?: string;
  /** Nut da co san tai diem nay (neu bat trung nut). */
  nodeId?: string;
}

/**
 * Tim diem bat gan nhat voi con tro.
 * Thu tu uu tien: diem dac biet cua doi tuong > diem tren tuyen > luoi.
 */
export function findSnap(
  store: DocStore,
  vp: Viewport,
  world: Pt,
  s: SnapSettings,
  exclude?: Set<string>,
): SnapResult | null {
  if (!s.osnap && !s.grid) return null;
  const r = vp.px(s.radiusPx);

  if (s.osnap) {
    let best: SnapResult | null = null;
    let bestD = r;
    for (const e of store.entities) {
      if (exclude?.has(e.id)) continue;
      if (!store.isEditable(e)) continue;
      for (const sp of snapPoints(store, e)) {
        const d = dist(sp.p, world);
        if (d < bestD) {
          bestD = d;
          best = { p: sp.p, kind: sp.kind };
          if (e.kind === 'node') best.nodeId = e.id;
        }
      }
    }
    if (best) return best;

    if (s.nearest) {
      let bn: SnapResult | null = null;
      let bd = r;
      for (const e of store.entities) {
        if (e.kind !== 'branch' || exclude?.has(e.id) || !store.isEditable(e)) continue;
        const pts = branchPoints(store, e);
        for (let i = 1; i < pts.length; i++) {
          const q = distToSeg(world, pts[i - 1], pts[i]);
          if (q.d < bd) {
            bd = q.d;
            bn = { p: q.at, kind: 'Trên tuyến', onBranch: e.id };
          }
        }
      }
      if (bn) return bn;
    }
  }

  if (s.grid) {
    const g = snapToGrid(world, s.gridStep);
    if (dist(g, world) < r) return { p: g, kind: 'Lưới' };
  }
  return null;
}

/** Ap dung rang buoc ORTHO so voi diem goc (neu dang bat). */
export function applyOrtho(base: Pt | null, p: Pt, s: SnapSettings): Pt {
  if (!s.ortho || !base) return p;
  return orthoConstrain(base, p);
}
