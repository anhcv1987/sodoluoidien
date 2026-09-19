import type { Entity } from '../core/types';
import { boxIntersects, type Box } from '../core/geom';

export interface Indexed {
  e: Entity;
  box: Box;
}

interface Item extends Indexed {
  stamp: number;
}

/**
 * Chỉ mục không gian dạng lưới đều.
 *
 * Tờ sơ đồ tổng khổ A0 có hàng chục nghìn đối tượng; nếu mỗi khung hình đều
 * duyệt hết thì kéo/phóng sẽ giật. Lưới này cho phép chỉ lấy ra những đối tượng
 * nằm trong vùng đang nhìn.
 */
export class Index2D {
  private cells = new Map<string, Item[]>();
  /** Đối tượng quá lớn (trải trên quá nhiều ô) - luôn xét. */
  private oversized: Item[] = [];
  private items: Item[] = [];
  private cell = 1;
  private stamp = 0;

  constructor(list: Indexed[]) {
    this.items = list.map((x) => ({ ...x, stamp: 0 }));
    if (!this.items.length) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const it of this.items) {
      if (!(it.box.maxX >= it.box.minX)) continue;
      minX = Math.min(minX, it.box.minX);
      minY = Math.min(minY, it.box.minY);
      maxX = Math.max(maxX, it.box.maxX);
      maxY = Math.max(maxY, it.box.maxY);
    }
    if (!isFinite(minX)) return;
    const w = Math.max(maxX - minX, 1e-9);
    const h = Math.max(maxY - minY, 1e-9);
    // Cỡ ô sao cho trung bình vài đối tượng một ô
    this.cell = Math.max(Math.sqrt((w * h) / Math.max(1, this.items.length)) * 2, 1e-9);

    for (const it of this.items) {
      if (!(it.box.maxX >= it.box.minX)) continue;
      const i0 = Math.floor(it.box.minX / this.cell);
      const i1 = Math.floor(it.box.maxX / this.cell);
      const j0 = Math.floor(it.box.minY / this.cell);
      const j1 = Math.floor(it.box.maxY / this.cell);
      if ((i1 - i0 + 1) * (j1 - j0 + 1) > 256) {
        this.oversized.push(it);
        continue;
      }
      for (let i = i0; i <= i1; i++) {
        for (let j = j0; j <= j1; j++) {
          const k = `${i}|${j}`;
          const a = this.cells.get(k);
          if (a) a.push(it);
          else this.cells.set(k, [it]);
        }
      }
    }
  }

  get length(): number {
    return this.items.length;
  }

  /** Toàn bộ đối tượng (theo đúng thứ tự đưa vào). */
  all(): Indexed[] {
    return this.items;
  }

  /** Các đối tượng có hộp bao giao với `box`, giữ nguyên thứ tự đưa vào. */
  query(box: Box): Indexed[] {
    if (!this.items.length) return [];
    const st = ++this.stamp;
    const out: Item[] = [];
    const i0 = Math.floor(box.minX / this.cell);
    const i1 = Math.floor(box.maxX / this.cell);
    const j0 = Math.floor(box.minY / this.cell);
    const j1 = Math.floor(box.maxY / this.cell);
    // Vùng nhìn quá rộng so với lưới -> duyệt thẳng còn nhanh hơn
    if ((i1 - i0 + 1) * (j1 - j0 + 1) > 20000) {
      return this.items.filter((it) => boxIntersects(it.box, box));
    }
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const a = this.cells.get(`${i}|${j}`);
        if (!a) continue;
        for (const it of a) {
          if (it.stamp === st) continue;
          it.stamp = st;
          if (boxIntersects(it.box, box)) out.push(it);
        }
      }
    }
    for (const it of this.oversized) {
      if (it.stamp === st) continue;
      it.stamp = st;
      if (boxIntersects(it.box, box)) out.push(it);
    }
    return out;
  }
}
