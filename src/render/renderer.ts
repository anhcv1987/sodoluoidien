import type { DocStore } from '../core/doc';
import type { Entity, Pt, SubstationEntity, BranchEntity } from '../core/types';
import { colorOf, MAU_KXD, MAU_KXD_IN, styleOf } from '../core/voltage';
import type { Box } from '../core/geom';
import { Index2D, type Indexed } from './index2d';
import { branchPoints, entityBox, entityOps, type WOp } from './shapes';
import { getBlock } from '../symbols/blocks';
import type { Viewport } from './viewport';

export interface RenderOptions {
  /** Che do in: nen trang, mau dam hon. */
  printMode: boolean;
  showGrid: boolean;
  /** Hien nhan ma hieu day dan tren tuyen. */
  showConductor: boolean;
  /** Hien ten / ma cac tram. */
  showLabels: boolean;
  /** Hien ten thiet bi. */
  showDeviceLabels: boolean;
  /** Hien dia danh tham chieu. */
  showPlaces: boolean;
  /** Danh dau doi tuong "so bo - can ra soat". */
  markDraft: boolean;
  /**
   * To dac than may cat dang dong. Ban ve CAD goc ve may cat RONG nen mac dinh
   * TAT de giong het ban mau; bat len khi muon nhin nhanh trang thai khi dieu do.
   */
  /** Hien diem dau noi cua thiet bi: xanh = da noi vao day, do = chua noi. */
  showTerminals: boolean;
}

export const defaultRenderOptions = (): RenderOptions => ({
  printMode: false,
  showGrid: true,
  showConductor: true,
  showLabels: true,
  showDeviceLabels: true,
  showPlaces: true,
  markDraft: true,
  showTerminals: false,
});

export interface RenderState {
  selected: Set<string>;
  hover: string | null;
  /** Hinh xem truoc khi dang ve (rubber band). */
  preview?: { ops: WOp[]; color: string; dash?: number[] } | null;
  /** Khung chon (toa do man hinh). */
  marquee?: { x0: number; y0: number; x1: number; y1: number; cross: boolean } | null;
  /** Diem bat diem dang goi y. */
  snap?: { p: Pt; kind: string } | null;
  /** Vi tri con tro (toa do man hinh) de ve chu thap. */
  cursor?: Pt | null;
  crosshair: boolean;
}

const FONT = '"Segoe UI", "Times New Roman", system-ui, sans-serif';

export class Renderer {
  /**
   * Bộ nhớ đệm: danh sách đối tượng kèm hộp bao, chia theo lớp thứ tự vẽ và
   * lập chỉ mục không gian. Chỉ dựng lại khi bản vẽ thay đổi.
   */
  private cache: {
    version: number;
    sheet: string;
    list: Indexed[];
    /** Chỉ mục riêng cho từng lớp thứ tự vẽ (nền → đường dây → … → chữ). */
    layers: Index2D[];
  } | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private store: DocStore,
    private vp: Viewport,
    public opt: RenderOptions = defaultRenderOptions(),
  ) {}

  private ctx(): CanvasRenderingContext2D {
    const c = this.canvas.getContext('2d');
    if (!c) throw new Error('Trình duyệt không hỗ trợ canvas 2D');
    return c;
  }

  resize(): void {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const r = this.canvas.getBoundingClientRect();
    this.vp.width = r.width;
    this.vp.height = r.height;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    const ctx = this.ctx();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private bg(): string {
    return this.opt.printMode ? '#ffffff' : '#12161d';
  }

  private fg(): string {
    return this.opt.printMode ? '#111827' : '#e5e9f0';
  }

  /**
   * Diem dau noi cua thiet bi (toa do the gioi) kem trang thai da noi hay chua.
   * Do lop giao dien tinh san (src/core/lienket.ts) roi gan vao day.
   */
  diemNoi: { p: Pt; noi: boolean }[] = [];

  /** Ve diem dau noi: o vuong xanh = da cham vao day, o do rong = chua noi. */
  private drawTerminals(ctx: CanvasRenderingContext2D): void {
    if (!this.diemNoi.length) return;
    const view = this.vp.viewBox(20);
    const r = 3.5;
    ctx.save();
    ctx.lineWidth = 1.4;
    for (const d of this.diemNoi) {
      if (d.p.x < view.minX || d.p.x > view.maxX || d.p.y < view.minY || d.p.y > view.maxY) continue;
      const s = this.vp.toScreen(d.p);
      if (d.noi) {
        ctx.fillStyle = this.opt.printMode ? '#15803d' : '#22c55e';
        ctx.fillRect(s.x - r, s.y - r, r * 2, r * 2);
      } else {
        ctx.strokeStyle = '#ef4444';
        ctx.strokeRect(s.x - r, s.y - r, r * 2, r * 2);
        ctx.beginPath();
        ctx.moveTo(s.x - r, s.y - r);
        ctx.lineTo(s.x + r, s.y + r);
        ctx.moveTo(s.x + r, s.y - r);
        ctx.lineTo(s.x - r, s.y + r);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  draw(state: RenderState): void {
    const ctx = this.ctx();
    const { width, height } = this.vp;
    ctx.save();
    ctx.fillStyle = this.bg();
    ctx.fillRect(0, 0, width, height);

    if (this.opt.showGrid) this.drawGrid(ctx);

    const view = this.vp.viewBox(80);
    const cache = this.buildCache();

    // Bỏ qua đối tượng nhỏ hơn ~1 pixel khi thu nhỏ: mắt không thấy được mà lại
    // chiếm phần lớn thời gian vẽ của tờ sơ đồ tổng.
    const minPx = 1.0 / this.vp.scale;

    const visible: Entity[] = [];
    for (const idx of cache.layers) {
      for (const { e, box } of idx.query(view)) {
        visible.push(e);
        if (
          e.kind !== 'substation' &&
          box.maxX - box.minX < minPx &&
          box.maxY - box.minY < minPx
        ) {
          continue;
        }
        this.drawEntity(ctx, e, state);
      }
    }

    if (this.opt.showTerminals) this.drawTerminals(ctx);
    if (this.opt.showConductor) this.drawConductorLabels(ctx, visible, view);
    if (this.opt.showLabels) this.drawSubstationLabels(ctx, visible, view);

    if (state.preview) this.drawPreview(ctx, state.preview);
    if (state.marquee) this.drawMarquee(ctx, state.marquee);
    if (state.snap) this.drawSnap(ctx, state.snap);
    if (state.crosshair && state.cursor) this.drawCrosshair(ctx, state.cursor);

    ctx.restore();
  }

  /**
   * Danh sách đối tượng đang hiện, đã sắp theo thứ tự vẽ và kèm hộp bao.
   * Tính lại chỉ khi bản vẽ thay đổi - nhờ vậy các tờ sơ đồ trạm hàng chục nghìn
   * đối tượng vẫn kéo/phóng mượt.
   */
  /** Danh sách đối tượng đang hiện kèm hộp bao (dùng chung cho vẽ và bắt chọn). */
  visibleList(): Indexed[] {
    return this.buildCache().list;
  }

  /** Các đối tượng đang hiện nằm trong một vùng - dùng khi bắt chọn. */
  queryBox(box: Box): Indexed[] {
    const out: Indexed[] = [];
    for (const idx of this.buildCache().layers) out.push(...idx.query(box));
    return out;
  }

  private buildCache(): NonNullable<Renderer['cache']> {
    const sheetId = this.store.sheet.id;
    if (this.cache && this.cache.version === this.store.version && this.cache.sheet === sheetId) {
      return this.cache;
    }
    // Thứ tự vẽ: nền -> đường dây -> nút -> trạm -> thiết bị -> chữ
    const order: Record<Entity['kind'], number> = {
      boundary: 0,
      branch: 1,
      circle: 1,
      node: 2,
      substation: 3,
      device: 4,
      text: 5,
    };
    const buckets: Indexed[][] = [[], [], [], [], [], []];
    const list: Indexed[] = [];
    for (const e of this.store.entities) {
      if (!this.store.isVisible(e)) continue;
      const item = { e, box: entityBox(this.store, e) };
      list.push(item);
      buckets[order[e.kind]].push(item);
    }
    this.cache = {
      version: this.store.version,
      sheet: sheetId,
      list,
      layers: buckets.map((b) => new Index2D(b)),
    };
    return this.cache;
  }

  /* -------------------------- luoi toa do -------------------------- */

  private drawGrid(ctx: CanvasRenderingContext2D): void {
    const { width, height, scale } = this.vp;
    // Chon buoc luoi sao cho khoang cach tren man hinh nam trong 25..250 px
    let step = Math.pow(10, Math.floor(Math.log10(60 / scale)));
    const nice = [1, 2, 5, 10];
    for (const n of nice) {
      if (step * n * scale >= 45) {
        step = step * n;
        break;
      }
    }
    const v = this.vp.viewBox(0);
    const minor = this.opt.printMode ? '#eceff4' : '#1b212b';
    const major = this.opt.printMode ? '#dde3ec' : '#252d3a';
    ctx.lineWidth = 1;
    for (let k = 0; k < 2; k++) {
      const s = k === 0 ? step : step * 10;
      if (s * scale < 8) continue;
      ctx.strokeStyle = k === 0 ? minor : major;
      ctx.beginPath();
      const x0 = Math.floor(v.minX / s) * s;
      for (let x = x0; x <= v.maxX; x += s) {
        const sx = Math.round(this.vp.toScreen({ x, y: 0 }).x) + 0.5;
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, height);
      }
      const y0 = Math.floor(v.minY / s) * s;
      for (let y = y0; y <= v.maxY; y += s) {
        const sy = Math.round(this.vp.toScreen({ x: 0, y }).y) + 0.5;
        ctx.moveTo(0, sy);
        ctx.lineTo(width, sy);
      }
      ctx.stroke();
    }
  }

  /* ---------------------------- doi tuong -------------------------- */

  private strokeStyleFor(e: Entity, state: RenderState): { color: string; width: number; dash: number[] } {
    const layer = this.store.layer(e.layer);
    let color = layer?.color ?? colorOf(e.kv, this.opt.printMode);
    let width = layer?.lineWidth ?? styleOf(e.kv).width;
    let dash: number[] = [];

    if (e.kind === 'branch') {
      if (e.lineKind === 'Cáp ngầm') dash = [10, 5];
      else if (e.lineKind === 'Cáp vặn xoắn') dash = [14, 4, 3, 4];
      else if (e.lineKind === 'Thanh cái') width = Math.max(width * 2.2, 4);
      if (this.opt.markDraft && e.note?.includes('rà soát')) dash = [6, 4];
    }
    if (e.kind === 'boundary') {
      color = layer?.color ?? (this.opt.printMode ? '#9aa4b2' : '#39424f');
      width = layer?.lineWidth ?? 1.4;
      // Nen ban do ve net dut; khung ban ve / khung ten ve net lien
      dash = e.dashed === false ? [] : [7, 5];
    }
    if (e.kind === 'text') color = layer?.color ?? this.fg();
    // Thiết bị đóng cắt chưa rõ trạng thái: nét đứt màu cam
    if (e.kind === 'device' && e.state === 'khong-xac-dinh' && getBlock(e.block)?.switching) {
      color = this.opt.printMode ? MAU_KXD_IN : MAU_KXD;
      dash = [5, 4];
    }

    if (state.selected.has(e.id)) {
      color = this.opt.printMode ? '#0b6bcb' : '#00e5ff';
      width = width + 1.2;
    } else if (state.hover === e.id) {
      width = width + 0.8;
    }
    return { color, width, dash };
  }

  private drawEntity(ctx: CanvasRenderingContext2D, e: Entity, state: RenderState): void {
    if (e.kind === 'node') {
      if (e.nodeType === 'an') return;
      const s = this.vp.toScreen(e.p);
      const sel = state.selected.has(e.id);
      const r = sel ? 4 : e.nodeType === 're-nhanh' || e.nodeType === 'noi' ? 3 : 2;
      ctx.beginPath();
      ctx.fillStyle = sel ? '#00e5ff' : colorOf(e.kv, this.opt.printMode);
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    const st = this.strokeStyleFor(e, state);
    const ops = entityOps(this.store, e);
    ctx.save();
    ctx.strokeStyle = st.color;
    ctx.fillStyle = st.color;
    ctx.lineWidth = st.width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash(st.dash);

    for (const op of ops) {
      switch (op.t) {
        case 'path': {
          if (op.pts.length < 2) break;
          ctx.beginPath();
          const p0 = this.vp.toScreen(op.pts[0]);
          ctx.moveTo(p0.x, p0.y);
          for (let i = 1; i < op.pts.length; i++) {
            const p = this.vp.toScreen(op.pts[i]);
            ctx.lineTo(p.x, p.y);
          }
          if (op.close) ctx.closePath();
          if (op.fill) ctx.fill();
          ctx.stroke();
          break;
        }
        case 'circle': {
          if (op.r <= 0) break;
          const c = this.vp.toScreen(op.c);
          const r = op.r * this.vp.scale;
          ctx.beginPath();
          ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
          if (op.fill) ctx.fill();
          ctx.stroke();
          break;
        }
        case 'arc': {
          const c = this.vp.toScreen(op.c);
          const r = op.r * this.vp.scale;
          // Truc Y man hinh nguoc chieu -> doi dau goc.
          ctx.beginPath();
          ctx.arc(c.x, c.y, r, (-op.a1 * Math.PI) / 180, (-op.a0 * Math.PI) / 180);
          ctx.stroke();
          break;
        }
        case 'text': {
          const p = this.vp.toScreen(op.p);
          const h = op.h * this.vp.scale;
          if (h < 4) break;
          ctx.save();
          ctx.setLineDash([]);
          ctx.translate(p.x, p.y);
          if (op.rot) ctx.rotate((-op.rot * Math.PI) / 180);
          ctx.font = `${h}px ${FONT}`;
          ctx.textAlign = op.align;
          ctx.textBaseline = 'bottom';
          ctx.fillText(op.s, 0, 0);
          ctx.restore();
          break;
        }
      }
    }

    // Nhan thiet bi
    if (this.opt.showDeviceLabels && e.kind === 'device' && e.label) {
      const s = this.vp.toScreen(e.p);
      const size = Math.min(16, Math.max(8, e.scale * this.vp.scale * 0.42));
      if (size >= 8) {
        ctx.setLineDash([]);
        ctx.font = `${size}px ${FONT}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = st.color;
        ctx.fillText(e.label, s.x + e.scale * this.vp.scale * 0.5 + 3, s.y);
      }
    }
    ctx.restore();
  }

  /* ----------------------------- nhan ------------------------------ */

  private drawConductorLabels(ctx: CanvasRenderingContext2D, ents: Entity[], view: Box): void {
    ctx.save();
    ctx.setLineDash([]);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (const e of ents) {
      if (e.kind !== 'branch') continue;
      const b = e as BranchEntity;
      const parts: string[] = [];
      if (b.label) parts.push(b.label);
      if (b.conductor?.code) {
        const km = b.lengthKm ?? this.branchLength(b);
        parts.push(km > 0 ? `${b.conductor.code} - ${km.toFixed(2)}km` : b.conductor.code);
      }
      if (!parts.length) continue;
      const pts = branchPoints(this.store, b);
      if (pts.length < 2) continue;
      // Dat nhan tai doan dai nhat de de doc
      let best = 0;
      let bestLen = -1;
      for (let i = 1; i < pts.length; i++) {
        const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        if (l > bestLen) {
          bestLen = l;
          best = i;
        }
      }
      const a = pts[best - 1];
      const c = pts[best];
      const mid = { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 };
      if (mid.x < view.minX || mid.x > view.maxX || mid.y < view.minY || mid.y > view.maxY) continue;
      const lenPx = bestLen * this.vp.scale;
      if (lenPx < 60) continue;
      const s = this.vp.toScreen(mid);
      let ang = Math.atan2(-(c.y - a.y), c.x - a.x);
      if (ang > Math.PI / 2) ang -= Math.PI;
      if (ang < -Math.PI / 2) ang += Math.PI;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(ang);
      ctx.font = `11px ${FONT}`;
      const txt = parts.join('  ');
      const w = ctx.measureText(txt).width;
      ctx.fillStyle = this.opt.printMode ? 'rgba(255,255,255,0.88)' : 'rgba(18,22,29,0.82)';
      ctx.fillRect(-w / 2 - 3, -14, w + 6, 14);
      ctx.fillStyle = colorOf(e.kv, this.opt.printMode);
      ctx.fillText(txt, 0, -3);
      ctx.restore();
    }
    ctx.restore();
  }

  branchLength(b: BranchEntity): number {
    const pts = branchPoints(this.store, b);
    let s = 0;
    for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return s;
  }

  private drawSubstationLabels(ctx: CanvasRenderingContext2D, ents: Entity[], view: Box): void {
    ctx.save();
    ctx.setLineDash([]);
    ctx.textAlign = 'center';

    // Tranh chong nhan: giu lai cac o chu da ve, o nao de len thi bo bot dong phu.
    const taken: { x0: number; y0: number; x1: number; y1: number }[] = [];
    const free = (x0: number, y0: number, x1: number, y1: number): boolean => {
      for (const t of taken) {
        if (!(x1 < t.x0 || x0 > t.x1 || y1 < t.y0 || y0 > t.y1)) return false;
      }
      return true;
    };
    const claim = (x0: number, y0: number, x1: number, y1: number): void => {
      taken.push({ x0, y0, x1, y1 });
    };
    const put = (txt: string, cx: number, cy: number, size: number, color: string): boolean => {
      const w = ctx.measureText(txt).width;
      const x0 = cx - w / 2 - 1;
      const x1 = cx + w / 2 + 1;
      const y0 = cy - size * 0.5;
      const y1 = cy + size * 0.5;
      if (!free(x0, y0, x1, y1)) return false;
      claim(x0, y0, x1, y1);
      ctx.fillStyle = color;
      ctx.fillText(txt, cx, cy);
      return true;
    };

    // Ve tram lon truoc de nhan cua tram quan trong luon duoc uu tien.
    const subs = ents
      .filter((e): e is SubstationEntity => e.kind === 'substation')
      .filter((s) => s.p.x >= view.minX && s.p.x <= view.maxX && s.p.y >= view.minY && s.p.y <= view.maxY)
      .sort((a, b) => b.kv - a.kv);

    for (const s of subs) {
      const c = this.vp.toScreen(s.p);
      const hPx = s.h * this.vp.scale;
      ctx.textBaseline = 'middle';
      if (hPx < 12) {
        // Qua nho: chi ve cham + ma tram
        ctx.fillStyle = colorOf(s.kv, this.opt.printMode);
        ctx.beginPath();
        ctx.arc(c.x, c.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = `600 10px ${FONT}`;
        put(s.code, c.x, c.y - 9, 10, colorOf(s.kv, this.opt.printMode));
        continue;
      }
      const size = Math.min(15, Math.max(9, hPx * 0.3));
      ctx.font = `600 ${size}px ${FONT}`;
      put(s.code, c.x, c.y - size * 0.62, size, colorOf(s.kv, this.opt.printMode));
      ctx.font = `${size * 0.85}px ${FONT}`;
      const short = s.name.replace(/^TBA\s*\d+kV\s*/i, '');
      const okName = put(short, c.x, c.y + size * 0.62, size * 0.85, this.fg());
      if (okName && s.transformers.length && hPx > 40) {
        ctx.font = `${size * 0.72}px ${FONT}`;
        put(
          s.transformers.map((t) => t.capacity).join(' + '),
          c.x,
          c.y + size * 1.55,
          size * 0.72,
          this.opt.printMode ? '#4b5563' : '#98a2b3',
        );
      }
    }
    ctx.restore();
  }

  /* --------------------------- lop phu ----------------------------- */

  private drawPreview(
    ctx: CanvasRenderingContext2D,
    pv: { ops: WOp[]; color: string; dash?: number[] },
  ): void {
    ctx.save();
    ctx.strokeStyle = pv.color;
    ctx.fillStyle = pv.color;
    ctx.lineWidth = 1.6;
    ctx.setLineDash(pv.dash ?? [6, 4]);
    for (const op of pv.ops) {
      if (op.t === 'path' && op.pts.length >= 2) {
        ctx.beginPath();
        const p0 = this.vp.toScreen(op.pts[0]);
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < op.pts.length; i++) {
          const p = this.vp.toScreen(op.pts[i]);
          ctx.lineTo(p.x, p.y);
        }
        if (op.close) ctx.closePath();
        ctx.stroke();
      } else if (op.t === 'circle') {
        const c = this.vp.toScreen(op.c);
        ctx.beginPath();
        ctx.arc(c.x, c.y, op.r * this.vp.scale, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawMarquee(
    ctx: CanvasRenderingContext2D,
    m: { x0: number; y0: number; x1: number; y1: number; cross: boolean },
  ): void {
    const x = Math.min(m.x0, m.x1);
    const y = Math.min(m.y0, m.y1);
    const w = Math.abs(m.x1 - m.x0);
    const h = Math.abs(m.y1 - m.y0);
    ctx.save();
    // Xanh la = khung cat (chon ca doi tuong giao), xanh duong = khung bao tron
    ctx.strokeStyle = m.cross ? '#4ade80' : '#60a5fa';
    ctx.fillStyle = m.cross ? 'rgba(74,222,128,0.12)' : 'rgba(96,165,250,0.12)';
    ctx.setLineDash(m.cross ? [5, 4] : []);
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);
    ctx.restore();
  }

  private drawSnap(ctx: CanvasRenderingContext2D, snap: { p: Pt; kind: string }): void {
    const s = this.vp.toScreen(snap.p);
    ctx.save();
    ctx.strokeStyle = '#f5d90a';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([]);
    ctx.strokeRect(s.x - 5.5, s.y - 5.5, 11, 11);
    ctx.font = `11px ${FONT}`;
    ctx.fillStyle = '#f5d90a';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(snap.kind, s.x + 9, s.y + 7);
    ctx.restore();
  }

  private drawCrosshair(ctx: CanvasRenderingContext2D, c: Pt): void {
    ctx.save();
    ctx.strokeStyle = this.opt.printMode ? 'rgba(17,24,39,0.35)' : 'rgba(229,233,240,0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(0, Math.round(c.y) + 0.5);
    ctx.lineTo(this.vp.width, Math.round(c.y) + 0.5);
    ctx.moveTo(Math.round(c.x) + 0.5, 0);
    ctx.lineTo(Math.round(c.x) + 0.5, this.vp.height);
    ctx.stroke();
    // O chon (pickbox) giong CAD
    ctx.strokeStyle = this.opt.printMode ? '#111827' : '#e5e9f0';
    ctx.strokeRect(Math.round(c.x) - 4.5, Math.round(c.y) - 4.5, 9, 9);
    ctx.restore();
  }
}
