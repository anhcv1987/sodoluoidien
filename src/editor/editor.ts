import { DocStore, newId } from '../core/doc';
import type {
  BranchEntity,
  DeviceEntity,
  Entity,
  Id,
  LineKind,
  NodeEntity,
  Pt,
  SubstationEntity,
  SwitchState,
  TextEntity,
  VoltageKv,
} from '../core/types';
import { layerOf, colorOf } from '../core/voltage';
import {
  angleOf,
  boxInside,
  boxIntersects,
  dist,
  emptyBox,
  growBox,
  polylineLength,
  segIntersectsBox,
  sub,
  type Box,
} from '../core/geom';
import { Renderer, defaultRenderOptions, type RenderState } from '../render/renderer';
import { Viewport } from '../render/viewport';
import { branchPoints, distToEntity, entityBox, entityOps, deviceOps, type WOp } from '../render/shapes';
import { applyOrtho, defaultSnap, findSnap, type SnapResult, type SnapSettings } from './snap';
import { getBlock, TEN_TRANG_THAI } from '../symbols/blocks';

export type ToolName =
  | 'select'
  | 'line'
  | 'bus'
  | 'device'
  | 'substation'
  | 'text'
  | 'measure'
  | 'pan';

export interface DrawSettings {
  kv: VoltageKv;
  lineKind: LineKind;
  conductor: string;
  /** Block dang chon de dat. */
  block: string;
  /** Ty le thiet bi khi dat (don vi ban ve). */
  deviceScale: number;
  textHeight: number;
}

export interface EditorEvents {
  onChange?: () => void;
  onStatus?: (msg: string) => void;
  onPrompt?: (msg: string) => void;
  onSelection?: (sel: Entity[]) => void;
  /** Nhấn đúp chuột lên một đối tượng (dùng để mở sơ đồ trạm). */
  onOpenEntity?: (e: Entity) => void;
  /** Bấm chuột phải lên một đối tượng (toạ độ màn hình của chuột). */
  onContextEntity?: (e: Entity, clientX: number, clientY: number) => void;
  /** Con trỏ chuột rê lên / rời khỏi một đối tượng. */
  onHover?: (e: Entity | null) => void;
}

interface Tool {
  name: ToolName;
  prompt: string;
  down?(w: Pt, ev: PointerEvent): void;
  move?(w: Pt, ev: PointerEvent): void;
  up?(w: Pt, ev: PointerEvent): void;
  dblclick?(w: Pt): void;
  key?(ev: KeyboardEvent): boolean;
  preview?(): { ops: WOp[]; color: string; dash?: number[] } | null;
  cancel?(): void;
}

export class Editor {
  store: DocStore;
  vp = new Viewport();
  renderer: Renderer;
  snap: SnapSettings = defaultSnap();
  settings: DrawSettings = {
    kv: 22,
    lineKind: 'ĐDK',
    conductor: 'AC-120',
    block: 'MC',
    deviceScale: 1,
    textHeight: 1.6,
  };
  selection = new Set<Id>();
  hover: Id | null = null;
  crosshair = true;

  private tool: Tool;
  private tools: Record<ToolName, Tool>;
  private cursorScreen: Pt | null = null;
  private cursorWorld: Pt = { x: 0, y: 0 };
  private currentSnap: SnapResult | null = null;
  private marquee: { x0: number; y0: number; x1: number; y1: number; cross: boolean } | null = null;
  private dragging: { start: Pt; last: Pt; moved: boolean; ids: Id[] } | null = null;
  private panning: { x: number; y: number } | null = null;
  private raf = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    store: DocStore,
    public events: EditorEvents = {},
  ) {
    this.store = store;
    this.renderer = new Renderer(canvas, store, this.vp, defaultRenderOptions());
    this.tools = {
      select: this.makeSelectTool(),
      line: this.makeLineTool(),
      bus: this.makeBusTool(),
      device: this.makeDeviceTool(),
      substation: this.makeSubstationTool(),
      text: this.makeTextTool(),
      measure: this.makeMeasureTool(),
      pan: this.makePanTool(),
    };
    this.tool = this.tools.select;
    this.bind();
    this.store.subscribe(() => this.requestDraw());
  }

  /* =============================== ve =============================== */

  requestDraw(): void {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.draw();
    });
  }

  draw(): void {
    const state: RenderState = {
      selected: this.selection,
      hover: this.hover,
      preview: this.tool.preview?.() ?? null,
      marquee: this.marquee,
      snap: this.currentSnap ? { p: this.currentSnap.p, kind: this.currentSnap.kind } : null,
      cursor: this.cursorScreen,
      crosshair: this.crosshair && this.tool.name !== 'pan',
    };
    this.renderer.draw(state);
  }

  resize(): void {
    this.renderer.resize();
    this.requestDraw();
  }

  zoomExtents(): void {
    const b = this.contentBox();
    if (b.maxX > b.minX) this.vp.fit(b);
    this.requestDraw();
  }

  contentBox(): Box {
    let b = emptyBox();
    for (const e of this.store.entities) {
      if (!this.store.isVisible(e)) continue;
      const eb = entityBox(this.store, e);
      if (eb.maxX >= eb.minX) {
        growBox(b, { x: eb.minX, y: eb.minY });
        growBox(b, { x: eb.maxX, y: eb.maxY });
      }
    }
    if (b.maxX < b.minX) b = { minX: -10, minY: -10, maxX: 10, maxY: 10 };
    return b;
  }

  zoomToEntity(id: Id): void {
    const e = this.store.get(id);
    if (!e) return;
    const b = entityBox(this.store, e);
    const pad = Math.max(3, (b.maxX - b.minX) * 0.8, (b.maxY - b.minY) * 0.8);
    this.vp.fit({ minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad });
    this.requestDraw();
  }

  /* ============================ cong cu ============================= */

  /**
   * Đổi trạng thái thiết bị đóng cắt. Không truyền `trangThai` thì đảo Đóng <-> Cắt
   * (đang "không xác định" thì chuyển sang Đóng). Chế độ xem bị chặn như mọi thao
   * tác sửa khác (DocStore.transact). Trả về số thiết bị đã đổi.
   */
  doiTrangThai(ids: Id[], trangThai?: SwitchState): number {
    const ds = ids
      .map((id) => this.store.get(id))
      .filter((e): e is DeviceEntity => !!e && e.kind === 'device' && !!getBlock(e.block)?.switching);
    if (!ds.length) return 0;
    let doi = 0;
    this.store.transact(ds.length === 1 ? 'Đổi trạng thái thiết bị' : `Đổi trạng thái ${ds.length} thiết bị`, () => {
      for (const d of ds) {
        const moi: SwitchState = trangThai ?? ((d.state ?? 'dong') === 'dong' ? 'mo' : 'dong');
        if (d.state === moi) continue;
        this.store.update(d.id, (x) => void ((x as DeviceEntity).state = moi));
        doi++;
      }
    });
    if (doi) {
      const d = ds[0];
      const ten = getBlock(d.block)?.name ?? d.block;
      const tt = TEN_TRANG_THAI[(this.store.get(d.id) as DeviceEntity | undefined)?.state ?? 'dong'];
      this.events.onStatus?.(ds.length === 1 ? `${ten}: ${tt}` : `Đã đổi trạng thái ${doi} thiết bị`);
      this.requestDraw();
    }
    return doi;
  }

  setTool(name: ToolName): void {
    // Chế độ xem: chỉ được chọn và đo
    if (this.store.chiXem && name !== 'select' && name !== 'measure') {
      this.store.onBiChan?.('Công cụ vẽ');
      return;
    }
    this.tool.cancel?.();
    this.tool = this.tools[name];
    this.events.onPrompt?.(this.tool.prompt);
    this.events.onChange?.();
    this.requestDraw();
  }

  get toolName(): ToolName {
    return this.tool.name;
  }

  cancel(): void {
    this.tool.cancel?.();
    if (this.tool.name !== 'select') this.setTool('select');
    else {
      this.clearSelection();
    }
    this.requestDraw();
  }

  /* =========================== lua chon ============================ */

  clearSelection(): void {
    this.selection.clear();
    this.events.onSelection?.([]);
    this.requestDraw();
  }

  select(ids: Id[], add = false): void {
    if (!add) this.selection.clear();
    for (const id of ids) this.selection.add(id);
    this.events.onSelection?.(this.selectedEntities());
    this.requestDraw();
  }

  selectedEntities(): Entity[] {
    return [...this.selection].map((id) => this.store.get(id)).filter((e): e is Entity => !!e);
  }

  /** Tim doi tuong duoi con tro (uu tien thiet bi/tram roi den duong day). */
  pick(w: Pt): Entity | null {
    const r = this.vp.px(7);
    const prio: Record<Entity['kind'], number> = {
      device: 0,
      text: 1,
      substation: 2,
      node: 3,
      circle: 4,
      branch: 4,
      boundary: 5,
    };
    let best: Entity | null = null;
    let bestKey = [99, Infinity];
    // Chỉ xét các đối tượng quanh con trỏ (qua chỉ mục không gian) rồi mới tính
    // khoảng cách chính xác - nếu không, tờ sơ đồ tổng sẽ rất chậm.
    const near = { minX: w.x - r, minY: w.y - r, maxX: w.x + r, maxY: w.y + r };
    for (const { e, box } of this.renderer.queryBox(near)) {
      if (!this.store.isEditable(e)) continue;
      if (w.x < box.minX - r || w.x > box.maxX + r || w.y < box.minY - r || w.y > box.maxY + r) continue;
      const d = distToEntity(this.store, e, w);
      if (d > r) continue;
      const key = [prio[e.kind], d];
      if (key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) {
        bestKey = key;
        best = e;
      }
    }
    return best;
  }

  private pickBox(box: Box, crossing: boolean): Entity[] {
    const out: Entity[] = [];
    for (const { e, box: eb } of this.renderer.queryBox(box)) {
      if (!this.store.isEditable(e)) continue;
      if (crossing) {
        if (!boxIntersects(eb, box)) continue;
        let hit = boxInside(eb, box);
        if (!hit) {
          for (const op of entityOps(this.store, e)) {
            if (op.t === 'path') {
              for (let i = 1; i < op.pts.length; i++) {
                if (segIntersectsBox(op.pts[i - 1], op.pts[i], box)) {
                  hit = true;
                  break;
                }
              }
            } else if (op.t === 'circle' || op.t === 'arc') {
              if (boxIntersects({ minX: op.c.x - op.r, minY: op.c.y - op.r, maxX: op.c.x + op.r, maxY: op.c.y + op.r }, box)) hit = true;
            }
            if (hit) break;
          }
        }
        if (hit) out.push(e);
      } else if (boxInside(eb, box)) {
        out.push(e);
      }
    }
    return out;
  }

  /* ========================= tao doi tuong ========================= */

  addNode(p: Pt, kv: VoltageKv, opts: Partial<NodeEntity> = {}): NodeEntity {
    const n: NodeEntity = {
      id: newId('n'),
      kind: 'node',
      layer: layerOf(kv),
      kv,
      p: { ...p },
      nodeType: 'noi',
      ...opts,
    };
    this.store.ensureLayer(n.layer);
    this.store.put(n);
    return n;
  }

  addBranch(pts: Pt[], opts: Partial<BranchEntity> = {}): BranchEntity | null {
    if (pts.length < 2) return null;
    const kv = opts.kv ?? this.settings.kv;
    const nodes = pts.map((p, i) =>
      this.addNode(p, kv, { nodeType: i === 0 || i === pts.length - 1 ? 'dau-cuoi' : 'cot' }).id,
    );
    const b: BranchEntity = {
      id: newId('b'),
      kind: 'branch',
      layer: layerOf(kv),
      kv,
      nodes,
      lineKind: opts.lineKind ?? this.settings.lineKind,
      ...opts,
    };
    if (!b.conductor && this.settings.conductor && b.lineKind !== 'Thanh cái') {
      b.conductor = { code: this.settings.conductor };
    }
    this.store.ensureLayer(b.layer);
    this.store.put(b);
    return b;
  }

  addDevice(p: Pt, block: string, opts: Partial<DeviceEntity> = {}): DeviceEntity {
    const kv = opts.kv ?? this.settings.kv;
    const def = getBlock(block);
    const d: DeviceEntity = {
      id: newId('d'),
      kind: 'device',
      layer: layerOf(kv),
      kv,
      block,
      p: { ...p },
      rot: opts.rot ?? 0,
      scale: opts.scale ?? this.settings.deviceScale,
      state: def?.switching ? (opts.state ?? 'dong') : undefined,
      ...opts,
    };
    this.store.ensureLayer(d.layer);
    this.store.put(d);
    return d;
  }

  addSubstation(p: Pt, data: Partial<SubstationEntity> = {}): SubstationEntity {
    const kv = data.kv ?? 110;
    const s: SubstationEntity = {
      id: newId('s'),
      kind: 'substation',
      layer: layerOf(kv),
      kv,
      name: data.name ?? 'Trạm mới',
      code: data.code ?? '',
      p: { ...p },
      levels: data.levels ?? [110, 35, 22],
      transformers: data.transformers ?? [],
      w: data.w ?? 7,
      h: data.h ?? 4,
      ...data,
    };
    this.store.ensureLayer(s.layer);
    this.store.put(s);
    return s;
  }

  addText(p: Pt, text: string): TextEntity {
    const t: TextEntity = {
      id: newId('t'),
      kind: 'text',
      layer: 'Ghi chú',
      kv: this.settings.kv,
      p: { ...p },
      text,
      height: this.settings.textHeight,
      rot: 0,
      align: 'left',
    };
    this.store.ensureLayer(t.layer);
    this.store.put(t);
    return t;
  }

  /* ========================== thao tac sua ========================= */

  deleteSelection(): void {
    const ids = [...this.selection];
    if (!ids.length) return;
    this.store.transact(`Xóa ${ids.length} đối tượng`, () => {
      for (const id of ids) {
        const e = this.store.get(id);
        if (e?.kind === 'branch') for (const n of e.nodes) this.store.remove(n);
        this.store.remove(id);
      }
    });
    this.clearSelection();
    this.events.onStatus?.(`Đã xóa ${ids.length} đối tượng`);
  }

  moveSelection(dx: number, dy: number, label = 'Di chuyển'): void {
    const ids = this.movableIds();
    if (!ids.length) return;
    this.store.transact(label, () => {
      for (const id of ids) {
        const e = this.store.get(id);
        if (!e) continue;
        this.store.update(id, (x: Entity) => {
          if (x.kind === 'node' || x.kind === 'device' || x.kind === 'substation' || x.kind === 'text') {
            x.p.x += dx;
            x.p.y += dy;
          } else if (x.kind === 'circle') {
            x.c.x += dx;
            x.c.y += dy;
          } else if (x.kind === 'boundary') {
            for (const p of x.pts) {
              p.x += dx;
              p.y += dy;
            }
          }
        });
      }
    });
  }

  /** Khi di chuyen mot nhanh thi phai di chuyen cac nut cua no. */
  private movableIds(): Id[] {
    const ids = new Set<Id>();
    for (const id of this.selection) {
      const e = this.store.get(id);
      if (!e) continue;
      if (e.kind === 'branch') for (const n of e.nodes) ids.add(n);
      else ids.add(id);
    }
    return [...ids];
  }

  rotateSelection(deg: number): void {
    const ids = [...this.selection];
    if (!ids.length) return;
    this.store.transact(`Quay ${deg}°`, () => {
      for (const id of ids) {
        this.store.update(id, (e: Entity) => {
          if (e.kind === 'device') e.rot = (e.rot + deg) % 360;
          else if (e.kind === 'text') e.rot = (e.rot + deg) % 360;
        });
      }
    });
  }

  copySelection(dx: number, dy: number): void {
    const ids = [...this.selection];
    if (!ids.length) return;
    const created: Id[] = [];
    this.store.transact('Sao chép', () => {
      for (const id of ids) {
        const e = this.store.get(id);
        if (!e) continue;
        if (e.kind === 'branch') {
          const pts = branchPoints(this.store, e).map((p) => ({ x: p.x + dx, y: p.y + dy }));
          const nb = this.addBranch(pts, {
            kv: e.kv,
            lineKind: e.lineKind,
            conductor: e.conductor ? { ...e.conductor } : undefined,
            label: e.label,
            layer: e.layer,
          });
          if (nb) created.push(nb.id);
        } else if (e.kind !== 'node') {
          const c = JSON.parse(JSON.stringify(e)) as Entity;
          c.id = newId(e.kind[0]);
          if ('p' in c) {
            c.p.x += dx;
            c.p.y += dy;
          }
          if (c.kind === 'circle') {
            c.c.x += dx;
            c.c.y += dy;
          }
          if (c.kind === 'boundary') for (const p of c.pts) {
            p.x += dx;
            p.y += dy;
          }
          this.store.put(c);
          created.push(c.id);
        }
      }
    });
    this.select(created);
    this.events.onStatus?.(`Đã sao chép ${created.length} đối tượng`);
  }

  /** Dat thiet bi len mot nhanh: tu dong quay theo huong tuyen. */
  private angleOnBranch(branchId: Id, p: Pt): number {
    const b = this.store.get(branchId);
    if (!b || b.kind !== 'branch') return 0;
    const pts = branchPoints(this.store, b);
    let best = 0;
    let bd = Infinity;
    for (let i = 1; i < pts.length; i++) {
      const m = { x: (pts[i].x + pts[i - 1].x) / 2, y: (pts[i].y + pts[i - 1].y) / 2 };
      const d = dist(m, p);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    if (best === 0) return 0;
    // Block ve theo truc +Y nen goc quay = goc tuyen - 90.
    return angleOf(sub(pts[best], pts[best - 1])) - 90;
  }

  /* ========================== xu ly chuot ========================== */

  private bind(): void {
    const c = this.canvas;
    c.addEventListener('pointerdown', (ev) => this.onDown(ev));
    c.addEventListener('pointermove', (ev) => this.onMove(ev));
    c.addEventListener('pointerup', (ev) => this.onUp(ev));
    c.addEventListener('pointerleave', () => {
      this.cursorScreen = null;
      this.currentSnap = null;
      this.requestDraw();
    });
    c.addEventListener('dblclick', (ev) => {
      const w = this.worldOf(ev);
      this.tool.dblclick?.(w);
    });
    c.addEventListener('wheel', (ev) => this.onWheel(ev), { passive: false });
    c.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      // Chỉ khi đang ở công cụ Chọn - lúc đang vẽ, chuột phải là kết thúc lệnh
      if (this.tool.name !== 'select') return;
      const hit = this.pick(this.worldOf(ev));
      if (hit) this.events.onContextEntity?.(hit, ev.clientX, ev.clientY);
    });
  }

  private worldOf(ev: { clientX: number; clientY: number }): Pt {
    const r = this.canvas.getBoundingClientRect();
    return this.vp.toWorld(ev.clientX - r.left, ev.clientY - r.top);
  }

  private screenOf(ev: { clientX: number; clientY: number }): Pt {
    const r = this.canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  /** Toa do da ap dung bat diem + ortho, dung cho moi cong cu ve. */
  private snappedPoint(w: Pt, base: Pt | null, exclude?: Set<Id>): Pt {
    const s = findSnap(this.store, this.vp, w, this.snap, exclude);
    this.currentSnap = s;
    let p = s ? s.p : w;
    if (!s) p = applyOrtho(base, p, this.snap);
    return p;
  }

  private onWheel(ev: WheelEvent): void {
    ev.preventDefault();
    const s = this.screenOf(ev);
    const f = ev.deltaY < 0 ? 1.15 : 1 / 1.15;
    this.vp.zoomAt(s.x, s.y, f);
    this.updateStatus();
    this.requestDraw();
  }

  private onDown(ev: PointerEvent): void {
    this.canvas.setPointerCapture(ev.pointerId);
    const s = this.screenOf(ev);
    // Chuot giua hoac Space = keo man hinh (pan) giong CAD
    if (ev.button === 1 || this.tool.name === 'pan') {
      this.panning = { x: s.x, y: s.y };
      return;
    }
    if (ev.button === 2) {
      this.cancel();
      return;
    }
    const w = this.worldOf(ev);
    this.tool.down?.(w, ev);
  }

  private onMove(ev: PointerEvent): void {
    const s = this.screenOf(ev);
    this.cursorScreen = s;
    const w = this.worldOf(ev);
    this.cursorWorld = w;
    if (this.panning) {
      this.vp.pan(s.x - this.panning.x, s.y - this.panning.y);
      this.panning = { x: s.x, y: s.y };
      this.updateStatus();
      this.requestDraw();
      return;
    }
    this.tool.move?.(w, ev);
    this.updateStatus();
    this.requestDraw();
  }

  private onUp(ev: PointerEvent): void {
    this.canvas.releasePointerCapture(ev.pointerId);
    if (this.panning) {
      this.panning = null;
      return;
    }
    const w = this.worldOf(ev);
    this.tool.up?.(w, ev);
    this.requestDraw();
  }

  handleKey(ev: KeyboardEvent): boolean {
    if (this.tool.key?.(ev)) return true;
    const k = ev.key;
    if (k === 'Escape') {
      this.cancel();
      return true;
    }
    if (k === 'Delete' || k === 'Backspace') {
      this.deleteSelection();
      return true;
    }
    if (k === 'F8') {
      this.snap.ortho = !this.snap.ortho;
      this.events.onStatus?.(`ORTHO ${this.snap.ortho ? 'BẬT' : 'TẮT'}`);
      this.events.onChange?.();
      return true;
    }
    if (k === 'F3') {
      this.snap.osnap = !this.snap.osnap;
      this.events.onStatus?.(`Bắt điểm ${this.snap.osnap ? 'BẬT' : 'TẮT'}`);
      this.events.onChange?.();
      return true;
    }
    if (k === 'F7') {
      this.renderer.opt.showGrid = !this.renderer.opt.showGrid;
      this.events.onChange?.();
      this.requestDraw();
      return true;
    }
    if (k === 'F9') {
      this.snap.grid = !this.snap.grid;
      this.events.onStatus?.(`Bắt lưới ${this.snap.grid ? 'BẬT' : 'TẮT'}`);
      this.events.onChange?.();
      return true;
    }
    if ((ev.ctrlKey || ev.metaKey) && k.toLowerCase() === 'z') {
      ev.shiftKey ? this.store.redo() : this.store.undo();
      this.clearSelection();
      return true;
    }
    if ((ev.ctrlKey || ev.metaKey) && k.toLowerCase() === 'y') {
      this.store.redo();
      this.clearSelection();
      return true;
    }
    if ((ev.ctrlKey || ev.metaKey) && k.toLowerCase() === 'a') {
      this.select(this.store.entities.filter((e) => this.store.isEditable(e) && e.kind !== 'node').map((e) => e.id));
      return true;
    }
    // Phim mui ten: dich chuyen doi tuong dang chon
    const stepMap: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, 1],
      ArrowDown: [0, -1],
    };
    if (stepMap[k] && this.selection.size) {
      const base = ev.shiftKey ? 10 : 1;
      const unit = this.snap.grid ? this.snap.gridStep : this.vp.px(4);
      const [dx, dy] = stepMap[k];
      this.moveSelection(dx * unit * base, dy * unit * base);
      return true;
    }
    return false;
  }

  private updateStatus(): void {
    const w = this.cursorWorld;
    this.events.onStatus?.(`X ${w.x.toFixed(2)}  Y ${w.y.toFixed(2)}`);
  }

  /* ============================ cac tool =========================== */

  private makeSelectTool(): Tool {
    let downScreen: Pt | null = null;
    let downWorld: Pt | null = null;
    const self = this;
    return {
      name: 'select',
      prompt: 'Chọn đối tượng, hoặc kéo khung để chọn nhiều. Chuột giữa = di chuyển màn hình.',
      down(w, ev) {
        downWorld = w;
        downScreen = self.screenOf(ev);
        const hit = self.pick(w);
        // chế độ xem: chọn được để xem thuộc tính nhưng không kéo di chuyển
        const keo = !self.store.chiXem;
        if (hit && self.selection.has(hit.id)) {
          if (keo) self.dragging = { start: w, last: w, moved: false, ids: [...self.selection] };
        } else if (hit) {
          self.select([hit.id], ev.shiftKey);
          if (keo) self.dragging = { start: w, last: w, moved: false, ids: [...self.selection] };
        } else {
          if (!ev.shiftKey) self.clearSelection();
          self.marquee = { x0: downScreen.x, y0: downScreen.y, x1: downScreen.x, y1: downScreen.y, cross: false };
        }
      },
      move(w, ev) {
        if (self.marquee && downScreen) {
          const s = self.screenOf(ev);
          self.marquee.x1 = s.x;
          self.marquee.y1 = s.y;
          self.marquee.cross = s.x < downScreen.x;
          return;
        }
        if (self.dragging) {
          const p = self.snappedPoint(w, self.dragging.start, new Set(self.dragging.ids));
          const dx = p.x - self.dragging.last.x;
          const dy = p.y - self.dragging.last.y;
          if (dx || dy) {
            self.dragging.moved = true;
            self.dragging.last = p;
            self.moveSelection(dx, dy);
          }
          return;
        }
        const hit = self.pick(w);
        const id = hit?.id ?? null;
        if (id !== self.hover) {
          self.hover = id;
          self.events.onHover?.(hit ?? null);
        }
      },
      up(w) {
        if (self.marquee && downWorld) {
          const a = downWorld;
          const box: Box = {
            minX: Math.min(a.x, w.x),
            minY: Math.min(a.y, w.y),
            maxX: Math.max(a.x, w.x),
            maxY: Math.max(a.y, w.y),
          };
          const found = self.pickBox(box, self.marquee.cross).filter((e) => e.kind !== 'node');
          if (Math.abs(box.maxX - box.minX) > self.vp.px(3)) self.select(found.map((e) => e.id), true);
          self.marquee = null;
        }
        if (self.dragging) {
          if (self.dragging.moved) self.events.onStatus?.('Đã di chuyển');
          self.dragging = null;
          self.events.onSelection?.(self.selectedEntities());
        }
        downScreen = null;
        downWorld = null;
      },
      dblclick(w) {
        const hit = self.pick(w);
        if (hit) {
          self.select([hit.id]);
          self.events.onSelection?.(self.selectedEntities());
          // Thiết bị đóng cắt: nhấn đúp để đổi Đóng <-> Cắt
          if (hit.kind === 'device' && getBlock(hit.block)?.switching && self.store.isEditable(hit)) {
            self.doiTrangThai([hit.id]);
            self.events.onSelection?.(self.selectedEntities());
            return;
          }
          self.events.onOpenEntity?.(hit);
        }
      },
      cancel() {
        self.marquee = null;
        self.dragging = null;
      },
    };
  }

  private makeLineTool(): Tool {
    const pts: Pt[] = [];
    let cur: Pt | null = null;
    const self = this;
    const finish = (): void => {
      if (pts.length >= 2) {
        const copy = pts.slice();
        self.store.transact('Vẽ tuyến', () => {
          const b = self.addBranch(copy);
          if (b) {
            b.lengthKm = Math.round(polylineLength(copy) * 1000) / 1000;
            self.select([b.id]);
          }
        });
      }
      pts.length = 0;
      cur = null;
    };
    return {
      name: 'line',
      prompt: 'Chỉ điểm đầu tuyến. Click tiếp để thêm đỉnh, Enter/chuột phải để kết thúc, Esc để hủy.',
      down(w) {
        const p = self.snappedPoint(w, pts.at(-1) ?? null);
        pts.push(p);
      },
      move(w) {
        cur = self.snappedPoint(w, pts.at(-1) ?? null);
      },
      key(ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          finish();
          return true;
        }
        if (ev.key === 'Escape') {
          if (pts.length) {
            pts.length = 0;
            cur = null;
            return true;
          }
        }
        return false;
      },
      preview() {
        if (!pts.length) return null;
        const list = cur ? [...pts, cur] : pts;
        return { ops: [{ t: 'path', pts: list }], color: colorOf(self.settings.kv), dash: [8, 5] };
      },
      cancel() {
        finish();
      },
    };
  }

  private makeBusTool(): Tool {
    const self = this;
    let a: Pt | null = null;
    let cur: Pt | null = null;
    return {
      name: 'bus',
      prompt: 'Vẽ thanh cái: chỉ điểm đầu rồi điểm cuối.',
      down(w) {
        const p = self.snappedPoint(w, a);
        if (!a) {
          a = p;
        } else {
          const p0 = a;
          self.store.transact('Vẽ thanh cái', () => {
            const b = self.addBranch([p0, p], { lineKind: 'Thanh cái' });
            if (b) {
              b.conductor = undefined;
              self.select([b.id]);
            }
          });
          a = null;
          cur = null;
        }
      },
      move(w) {
        cur = self.snappedPoint(w, a);
      },
      preview() {
        if (!a || !cur) return null;
        return { ops: [{ t: 'path', pts: [a, cur] }], color: colorOf(self.settings.kv), dash: [] };
      },
      cancel() {
        a = null;
        cur = null;
      },
    };
  }

  private makeDeviceTool(): Tool {
    const self = this;
    let ghost: { p: Pt; rot: number } | null = null;
    let rotOffset = 0;
    return {
      name: 'device',
      prompt: 'Chọn thiết bị ở bảng trái rồi click để đặt. Phím R xoay 90°, Esc để thoát.',
      down(w) {
        const s = findSnap(self.store, self.vp, w, self.snap);
        self.currentSnap = s;
        const p = s ? s.p : w;
        let rot = rotOffset;
        if (s?.onBranch) rot = self.angleOnBranch(s.onBranch, p) + rotOffset;
        const branchId = s?.onBranch;
        self.store.transact('Đặt thiết bị', () => {
          const d = self.addDevice(p, self.settings.block, {
            rot,
            kv: branchId ? (self.store.get(branchId)?.kv ?? self.settings.kv) : self.settings.kv,
            onBranch: branchId,
          });
          self.select([d.id]);
        });
      },
      move(w) {
        const s = findSnap(self.store, self.vp, w, self.snap);
        self.currentSnap = s;
        const p = s ? s.p : w;
        let rot = rotOffset;
        if (s?.onBranch) rot = self.angleOnBranch(s.onBranch, p) + rotOffset;
        ghost = { p, rot };
      },
      key(ev) {
        if (ev.key.toLowerCase() === 'r') {
          rotOffset = (rotOffset + 90) % 360;
          self.events.onStatus?.(`Góc đặt thiết bị: ${rotOffset}°`);
          return true;
        }
        return false;
      },
      preview() {
        if (!ghost) return null;
        const def = getBlock(self.settings.block);
        if (!def) return null;
        const ops = deviceOps({
          id: '_ghost',
          kind: 'device',
          layer: '0',
          kv: self.settings.kv,
          block: self.settings.block,
          p: ghost.p,
          rot: ghost.rot,
          scale: self.settings.deviceScale,
        });
        return { ops, color: colorOf(self.settings.kv), dash: [] };
      },
      cancel() {
        ghost = null;
      },
    };
  }

  private makeSubstationTool(): Tool {
    const self = this;
    let ghost: Pt | null = null;
    return {
      name: 'substation',
      prompt: 'Click để đặt trạm mới; sau đó sửa tên/mã trong bảng thuộc tính bên phải.',
      down(w) {
        const p = self.snappedPoint(w, null);
        self.store.transact('Thêm trạm', () => {
          const s = self.addSubstation(p, { kv: 110, name: 'TBA 110kV mới', code: 'E?' });
          self.select([s.id]);
        });
        self.setTool('select');
      },
      move(w) {
        ghost = self.snappedPoint(w, null);
      },
      preview() {
        if (!ghost) return null;
        const hw = 3.5;
        const hh = 2;
        return {
          ops: [
            {
              t: 'path',
              pts: [
                { x: ghost.x - hw, y: ghost.y - hh },
                { x: ghost.x + hw, y: ghost.y - hh },
                { x: ghost.x + hw, y: ghost.y + hh },
                { x: ghost.x - hw, y: ghost.y + hh },
              ],
              close: true,
            },
          ],
          color: colorOf(110),
        };
      },
      cancel() {
        ghost = null;
      },
    };
  }

  private makeTextTool(): Tool {
    const self = this;
    return {
      name: 'text',
      prompt: 'Click vị trí đặt chữ rồi nhập nội dung.',
      down(w) {
        const p = self.snappedPoint(w, null);
        const s = window.prompt('Nội dung ghi chú:');
        if (s) {
          self.store.transact('Thêm ghi chú', () => {
            const t = self.addText(p, s);
            self.select([t.id]);
          });
        }
        self.setTool('select');
      },
    };
  }

  private makeMeasureTool(): Tool {
    const self = this;
    const pts: Pt[] = [];
    let cur: Pt | null = null;
    return {
      name: 'measure',
      prompt: 'Đo khoảng cách: click các điểm, Esc để kết thúc.',
      down(w) {
        pts.push(self.snappedPoint(w, pts.at(-1) ?? null));
      },
      move(w) {
        cur = self.snappedPoint(w, pts.at(-1) ?? null);
        if (pts.length) {
          const list = cur ? [...pts, cur] : pts;
          const l = polylineLength(list);
          const last = list.length >= 2 ? dist(list[list.length - 2], list[list.length - 1]) : 0;
          self.events.onStatus?.(`Đoạn: ${last.toFixed(3)} km   Tổng: ${l.toFixed(3)} km`);
        }
      },
      preview() {
        if (!pts.length) return null;
        const list = cur ? [...pts, cur] : pts;
        return { ops: [{ t: 'path', pts: list }], color: '#f5d90a', dash: [4, 4] };
      },
      cancel() {
        pts.length = 0;
        cur = null;
      },
    };
  }

  private makePanTool(): Tool {
    return { name: 'pan', prompt: 'Kéo để di chuyển màn hình.' };
  }
}
