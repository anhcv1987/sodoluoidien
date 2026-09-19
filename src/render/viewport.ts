import type { Pt } from '../core/types';
import type { Box } from '../core/geom';

/**
 * Khung nhin: chuyen doi giua toa do the gioi (CAD, truc Y huong len)
 * va toa do man hinh (CSS pixel, truc Y huong xuong).
 */
export class Viewport {
  /** Tam khung nhin trong toa do the gioi. */
  cx = 0;
  cy = 0;
  /** So pixel man hinh tren 1 don vi ban ve. */
  scale = 4;
  /** Kich thuoc vung ve (CSS pixel). */
  width = 800;
  height = 600;

  readonly minScale = 0.02;
  readonly maxScale = 20000;

  toScreen(p: Pt): Pt {
    return {
      x: (p.x - this.cx) * this.scale + this.width / 2,
      y: this.height / 2 - (p.y - this.cy) * this.scale,
    };
  }

  toWorld(sx: number, sy: number): Pt {
    return {
      x: (sx - this.width / 2) / this.scale + this.cx,
      y: (this.height / 2 - sy) / this.scale + this.cy,
    };
  }

  /** Doi mot khoang cach man hinh (px) ra don vi ban ve. */
  px(n: number): number {
    return n / this.scale;
  }

  pan(dxPx: number, dyPx: number): void {
    this.cx -= dxPx / this.scale;
    this.cy += dyPx / this.scale;
  }

  /** Phong to / thu nho giu nguyen diem duoi con tro (giong CAD). */
  zoomAt(sx: number, sy: number, factor: number): void {
    const before = this.toWorld(sx, sy);
    this.scale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * factor));
    const after = this.toWorld(sx, sy);
    this.cx += before.x - after.x;
    this.cy += before.y - after.y;
  }

  /** Dua toan bo hop bao vao khung nhin (ZOOM EXTENTS). */
  fit(b: Box, marginRatio = 0.08): void {
    const w = Math.max(1e-6, b.maxX - b.minX);
    const h = Math.max(1e-6, b.maxY - b.minY);
    this.cx = (b.minX + b.maxX) / 2;
    this.cy = (b.minY + b.maxY) / 2;
    const sx = (this.width * (1 - marginRatio * 2)) / w;
    const sy = (this.height * (1 - marginRatio * 2)) / h;
    this.scale = Math.min(this.maxScale, Math.max(this.minScale, Math.min(sx, sy)));
  }

  /** Hop bao cua vung dang nhin (dung de cat bot doi tuong khi ve). */
  viewBox(pad = 0): Box {
    const a = this.toWorld(-pad, this.height + pad);
    const b = this.toWorld(this.width + pad, -pad);
    return { minX: a.x, minY: a.y, maxX: b.x, maxY: b.y };
  }
}
