import type { Drawing, Entity, Id, Layer, Sheet } from './types';
import { FILE_VERSION } from './types';
import { allStyles } from './voltage';

let counter = 0;
/** Sinh ma dinh danh ngan, duy nhat trong mot phien lam viec. */
export function newId(prefix = 'e'): string {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}`;
}

/** Ban ghi thay doi cua mot giao dich - dung cho Undo/Redo. */
interface Patch {
  sheetId: Id;
  /** null = truoc do doi tuong chua ton tai / sau do bi xoa. */
  before: Record<Id, Entity | null>;
  after: Record<Id, Entity | null>;
  label: string;
}

type Listener = () => void;

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function defaultLayers(): Record<string, Layer> {
  const layers: Record<string, Layer> = {
    'Nền bản đồ': { name: 'Nền bản đồ', color: '#3a4250', visible: true, locked: true, lineWidth: 1 },
    'Ghi chú': { name: 'Ghi chú', color: '#d8dee9', visible: true, locked: false, lineWidth: 1 },
    'Tên trạm': { name: 'Tên trạm', color: '#ffffff', visible: true, locked: false, lineWidth: 1 },
  };
  for (const s of allStyles()) {
    layers[s.layer] = { name: s.layer, visible: true, locked: false, lineWidth: s.width };
  }
  return layers;
}

export function emptyDrawing(title = 'Sơ đồ lưới điện tỉnh Thái Nguyên'): Drawing {
  const sheetId = newId('sh');
  const now = new Date().toISOString();
  return {
    version: FILE_VERSION,
    title,
    org: 'Phòng Điều độ - Công ty Điện lực Thái Nguyên',
    createdAt: now,
    updatedAt: now,
    layers: defaultLayers(),
    sheets: [{ id: sheetId, name: 'Sơ đồ lưới điện tỉnh', type: 'tinh', entities: {} }],
    activeSheet: sheetId,
  };
}

/**
 * Kho du lieu ban ve: moi thay doi deu di qua transact() de ghi lai
 * lich su Undo/Redo va phat su kien cho giao dien ve lai.
 */
export class DocStore {
  drawing: Drawing;
  private undoStack: Patch[] = [];
  private redoStack: Patch[] = [];
  private listeners = new Set<Listener>();
  /** Giao dich dang mo (neu co). */
  private pending: Patch | null = null;
  private maxHistory = 200;

  constructor(drawing?: Drawing) {
    this.drawing = drawing ?? emptyDrawing();
  }

  /* --------------------------- su kien --------------------------- */

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(): void {
    for (const fn of this.listeners) fn();
  }

  /* --------------------------- truy van -------------------------- */

  get sheet(): Sheet {
    const s = this.drawing.sheets.find((x) => x.id === this.drawing.activeSheet);
    if (!s) throw new Error('Không tìm thấy trang bản vẽ đang mở');
    return s;
  }

  sheetById(id: Id): Sheet | undefined {
    return this.drawing.sheets.find((s) => s.id === id);
  }

  setActiveSheet(id: Id): void {
    if (this.sheetById(id)) {
      this.drawing.activeSheet = id;
      this.emit();
    }
  }

  get entities(): Entity[] {
    return Object.values(this.sheet.entities);
  }

  get(id: Id): Entity | undefined {
    return this.sheet.entities[id];
  }

  /** Lay doi tuong o bat ky trang nao (dung cho lien ket tram <-> trang tram). */
  getAnywhere(id: Id): Entity | undefined {
    for (const s of this.drawing.sheets) {
      const e = s.entities[id];
      if (e) return e;
    }
    return undefined;
  }

  layer(name: string): Layer | undefined {
    return this.drawing.layers[name];
  }

  /** Doi tuong co the chon/sua duoc khong (lop hien va khong khoa). */
  isEditable(e: Entity): boolean {
    const l = this.drawing.layers[e.layer];
    return !l || (l.visible && !l.locked);
  }

  isVisible(e: Entity): boolean {
    const l = this.drawing.layers[e.layer];
    return !l || l.visible;
  }

  /* --------------------------- giao dich ------------------------- */

  /**
   * Thuc hien mot nhom thay doi nhu mot buoc Undo duy nhat.
   *   store.transact('Vẽ đường dây', () => { ... store.put(e) ... });
   */
  transact<T>(label: string, fn: () => T): T {
    const nested = this.pending !== null;
    if (!nested) {
      this.pending = { sheetId: this.sheet.id, before: {}, after: {}, label };
    }
    let result: T;
    try {
      result = fn();
    } catch (err) {
      if (!nested) this.rollback();
      throw err;
    }
    if (!nested) this.commit();
    return result;
  }

  private commit(): void {
    const p = this.pending;
    this.pending = null;
    if (!p) return;
    if (Object.keys(p.before).length === 0) return; // khong co gi thay doi
    this.undoStack.push(p);
    if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
    this.redoStack.length = 0;
    this.drawing.updatedAt = new Date().toISOString();
    this.emit();
  }

  private rollback(): void {
    const p = this.pending;
    this.pending = null;
    if (!p) return;
    this.applyPatchSide(p, 'before');
    this.emit();
  }

  /** Ghi nhan trang thai truoc khi sua mot doi tuong. */
  private record(id: Id, before: Entity | null, after: Entity | null): void {
    const p = this.pending;
    if (!p) return;
    if (!(id in p.before)) p.before[id] = before ? clone(before) : null;
    p.after[id] = after ? clone(after) : null;
  }

  /** Them moi hoac ghi de mot doi tuong. */
  put(e: Entity): Entity {
    const sheet = this.sheet;
    const old = sheet.entities[e.id] ?? null;
    this.record(e.id, old, e);
    sheet.entities[e.id] = e;
    return e;
  }

  /** Sua doi tuong tai cho qua ham mutator (tu dong ghi lich su). */
  update<T extends Entity>(id: Id, fn: (e: T) => void): T | undefined {
    const sheet = this.sheet;
    const e = sheet.entities[id] as T | undefined;
    if (!e) return undefined;
    const before = clone(e);
    fn(e);
    this.record(id, before, e);
    return e;
  }

  remove(id: Id): void {
    const sheet = this.sheet;
    const old = sheet.entities[id];
    if (!old) return;
    this.record(id, old, null);
    delete sheet.entities[id];
  }

  /* --------------------------- undo / redo ----------------------- */

  private applyPatchSide(p: Patch, side: 'before' | 'after'): void {
    const sheet = this.sheetById(p.sheetId);
    if (!sheet) return;
    const map = p[side];
    for (const [id, v] of Object.entries(map)) {
      if (v === null) delete sheet.entities[id];
      else sheet.entities[id] = clone(v);
    }
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undoLabel(): string {
    return this.undoStack.at(-1)?.label ?? '';
  }

  redoLabel(): string {
    return this.redoStack.at(-1)?.label ?? '';
  }

  undo(): void {
    const p = this.undoStack.pop();
    if (!p) return;
    this.drawing.activeSheet = p.sheetId;
    this.applyPatchSide(p, 'before');
    this.redoStack.push(p);
    this.emit();
  }

  redo(): void {
    const p = this.redoStack.pop();
    if (!p) return;
    this.drawing.activeSheet = p.sheetId;
    this.applyPatchSide(p, 'after');
    this.undoStack.push(p);
    this.emit();
  }

  clearHistory(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  /* --------------------------- lop ------------------------------- */

  ensureLayer(name: string, patch?: Partial<Layer>): Layer {
    let l = this.drawing.layers[name];
    if (!l) {
      l = { name, visible: true, locked: false };
      this.drawing.layers[name] = l;
    }
    if (patch) Object.assign(l, patch);
    return l;
  }

  setLayerVisible(name: string, visible: boolean): void {
    const l = this.drawing.layers[name];
    if (l) {
      l.visible = visible;
      this.emit();
    }
  }

  setLayerLocked(name: string, locked: boolean): void {
    const l = this.drawing.layers[name];
    if (l) {
      l.locked = locked;
      this.emit();
    }
  }

  /* --------------------------- trang ----------------------------- */

  addSheet(sheet: Sheet): Sheet {
    this.drawing.sheets.push(sheet);
    this.emit();
    return sheet;
  }

  removeSheet(id: Id): void {
    if (this.drawing.sheets.length <= 1) return;
    const i = this.drawing.sheets.findIndex((s) => s.id === id);
    if (i < 0) return;
    this.drawing.sheets.splice(i, 1);
    if (this.drawing.activeSheet === id) {
      this.drawing.activeSheet = this.drawing.sheets[Math.max(0, i - 1)].id;
    }
    this.clearHistory();
    this.emit();
  }

  /** Thay toan bo ban ve (mo file moi). */
  load(drawing: Drawing): void {
    this.drawing = drawing;
    this.clearHistory();
    this.emit();
  }
}
