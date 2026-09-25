import type { DocStore } from '../core/doc';
import type { Entity, Pt } from '../core/types';
import type { Box } from '../core/geom';
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
  radiusPx: 20,
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
 * Hệ số ưu tiên các loại điểm bắt (nhỏ = ưu tiên hơn). Nối dây thì hầu như luôn
 * muốn bắt vào CỰC THIẾT BỊ hoặc ĐẦU DÂY: hai loại này thắng cả khi xa con trỏ hơn
 * một chút; trung điểm, tâm ký hiệu chỉ được bắt khi con trỏ đặt sát.
 */
const UU_TIEN: Record<string, number> = {
  'Cực đấu nối': 0.45,
  'Điểm cuối': 0.55,
  Nút: 0.55,
  Đỉnh: 0.8,
  'Tâm đường tròn': 1.1,
  'Tâm trạm': 1,
  'Tâm thiết bị': 1.6,
  'Trung điểm': 2,
};

/**
 * Tim diem bat gan nhat voi con tro.
 * Thu tu uu tien: diem dac biet cua doi tuong > diem tren tuyen > luoi.
 *
 * `quanh` (nếu có) trả về các đối tượng trong một hộp - dùng chỉ mục không gian
 * của bộ vẽ để khỏi duyệt hàng chục nghìn đối tượng mỗi lần rê chuột.
 */
export function findSnap(
  store: DocStore,
  vp: Viewport,
  world: Pt,
  s: SnapSettings,
  exclude?: Set<string>,
  quanh?: (b: Box) => Entity[],
): SnapResult | null {
  if (!s.osnap && !s.grid) return null;
  const r = vp.px(s.radiusPx);

  if (s.osnap) {
    const R = r / 0.45; // bán kính lớn nhất (cực đấu nối)
    const hop: Box = { minX: world.x - R, minY: world.y - R, maxX: world.x + R, maxY: world.y + R };
    const ds = (quanh ? quanh(hop) : store.entities).filter(
      (e) => !exclude?.has(e.id) && e.kind !== 'text' && store.isEditable(e),
    );
    // node la dinh cua tuyen: tim theo tuyen, khong co trong chi muc ve
    let best: SnapResult | null = null;
    let bestW = r;
    for (const e of ds) {
      for (const sp of snapPoints(store, e)) {
        const w = dist(sp.p, world) * (UU_TIEN[sp.kind] ?? 1);
        if (w < bestW) {
          bestW = w;
          best = { p: sp.p, kind: sp.kind };
          if (e.kind === 'node') best.nodeId = e.id;
        }
      }
    }
    if (best) return best;

    if (s.nearest) {
      let bn: SnapResult | null = null;
      let bd = r;
      for (const e of ds) {
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
