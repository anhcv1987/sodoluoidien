import { DocStore } from '../core/doc';
import { Editor, type ToolName } from '../editor/editor';
import { buildProvinceDrawing, createSubstationSheet } from '../data/seed';
import { buildCadSheet, cadLayerNames, cadSheetName, listCadSheets } from '../data/tramSheets';
import type { Entity, SubstationEntity, VoltageKv } from '../core/types';
import { allStyles, colorOf } from '../core/voltage';
import { exportDxf, exportSvg } from '../io/dxfExport';
import { defaultImportOptions, importDxf, inspectDxf } from '../io/dxfImport';
import {
  autosave,
  clearAutosave,
  deserialize,
  download,
  exportPng,
  loadAutosave,
  pickFile,
  decodeDxfBuffer,
  readDxf,
  readText,
  serialize,
  suggestName,
} from '../io/file';
import { declutterSubstations, resetSubstationsToGeo } from '../editor/declutter';
import { buildPalette } from './palette';
import { buildLayers, buildProps, conductorDatalist } from './props';
import { button, checkbox, dialog, el, input, labeled, select, toast } from './dom';

const TOOLS: { id: ToolName; label: string; key: string; hint: string }[] = [
  { id: 'select', label: 'Chọn', key: 'S', hint: 'Chọn / di chuyển đối tượng' },
  { id: 'line', label: 'Đường dây', key: 'L', hint: 'Vẽ tuyến đường dây / cáp' },
  { id: 'bus', label: 'Thanh cái', key: 'B', hint: 'Vẽ thanh cái' },
  { id: 'device', label: 'Thiết bị', key: 'D', hint: 'Đặt thiết bị (MC, DCL, REC...)' },
  { id: 'substation', label: 'Trạm', key: 'T', hint: 'Đặt trạm biến áp' },
  { id: 'text', label: 'Ghi chú', key: 'G', hint: 'Thêm chữ' },
  { id: 'measure', label: 'Đo', key: 'M', hint: 'Đo khoảng cách' },
];

export class App {
  store: DocStore;
  ed: Editor;
  private canvas: HTMLCanvasElement;
  private propsHost = el('div', { class: 'panel-body' });
  private layersHost = el('div', { class: 'panel-body' });
  private tramHost = el('div', { class: 'panel-body' });
  private statusCoord = el('span', { class: 'status-item', text: 'X 0.00  Y 0.00' });
  private statusMsg = el('span', { class: 'status-msg' });
  private statusPrompt = el('span', { class: 'status-prompt' });
  private toolButtons = new Map<ToolName, HTMLButtonElement>();
  private toggles = el('div', { class: 'status-toggles' });
  private tabs = el('div', { class: 'tabs' });
  private paletteApi!: { root: HTMLElement; refresh: () => void };
  private autosaveTimer = 0;

  constructor(private root: HTMLElement) {
    const saved = loadAutosave();
    this.store = new DocStore(saved ?? buildProvinceDrawing());
    this.canvas = el('canvas', { class: 'canvas' });
    this.ed = new Editor(this.canvas, this.store, {
      onStatus: (m) => {
        if (m.startsWith('X ')) this.statusCoord.textContent = m;
        else this.setMsg(m);
      },
      onPrompt: (m) => (this.statusPrompt.textContent = m),
      onSelection: () => this.refreshProps(),
      onOpenEntity: (e) => {
        if (e.kind === 'substation' && e.code) this.openCadSheet(e.code, e.id);
      },
      onChange: () => this.refreshChrome(),
    });
    this.build();
    if (saved) this.setMsg('Đã khôi phục bản vẽ từ lần làm việc trước');
    requestAnimationFrame(() => {
      this.ed.resize();
      this.zoomProvince();
    });
    window.addEventListener('resize', () => this.ed.resize());
    window.addEventListener('keydown', (e) => this.onKey(e));
    this.store.subscribe(() => this.scheduleAutosave());
  }

  /** Dua khung nhin ve dung pham vi tinh (bo qua cac tram lien ket ngoai tinh). */
  zoomProvince(): void {
    const bd = this.store.entities.find(
      (e) => e.kind === 'boundary' && (e.name ?? '').includes('Ranh giới tỉnh'),
    );
    if (bd && bd.kind === 'boundary' && bd.pts.length > 2) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of bd.pts) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      this.ed.vp.fit({ minX, minY, maxX, maxY }, 0.05);
      this.ed.requestDraw();
      return;
    }
    this.ed.zoomExtents();
  }

  /* =============================== khung =============================== */

  private build(): void {
    this.root.append(conductorDatalist());
    this.root.append(this.buildHeader());
    const main = el('div', { class: 'main' });
    main.append(this.buildLeft());
    const center = el('div', { class: 'center' });
    center.append(this.tabs);
    center.append(this.canvas);
    main.append(center);
    main.append(this.buildRight());
    this.root.append(main);
    this.root.append(this.buildStatus());
    this.refreshChrome();
    this.refreshProps();
    this.refreshTram();
    this.refreshTabs();
  }

  private buildHeader(): HTMLElement {
    const h = el('header', { class: 'header' });
    h.append(
      el('div', { class: 'brand' }, [
        el('strong', { text: 'Sơ đồ lưới điện Thái Nguyên' }),
        el('span', { class: 'brand-sub', text: 'Phòng Điều độ — Công ty Điện lực Thái Nguyên' }),
      ]),
    );
    const menu = el('nav', { class: 'menu' });

    menu.append(
      this.dropdown('Tệp', [
        ['Tạo mới (sơ đồ tỉnh mẫu)', () => this.newProvince()],
        ['Tạo mới (bản vẽ trắng)', () => this.newBlank()],
        ['Mở file .sld…', () => void this.openFile()],
        ['Lưu bản vẽ (.sld)', () => this.saveFile()],
        ['—', () => undefined],
        ['Nhập từ CAD (.dxf)…', () => void this.importDxfDialog()],
        ['Xuất ra CAD (.dxf)', () => this.doExportDxf()],
        ['Xuất hình vector (.svg)', () => this.doExportSvg()],
        ['Xuất ảnh (.png)', () => this.doExportPng()],
      ]),
    );
    menu.append(
      this.dropdown('Sửa', [
        ['Hoàn tác (Ctrl+Z)', () => this.ed.store.undo()],
        ['Làm lại (Ctrl+Y)', () => this.ed.store.redo()],
        ['Chọn tất cả (Ctrl+A)', () => this.ed.select(this.store.entities.filter((e) => e.kind !== 'node').map((e) => e.id))],
        ['Xoá đối tượng đang chọn', () => this.ed.deleteSelection()],
        ['—', () => undefined],
        ['Quay 90° đối tượng đang chọn', () => this.ed.rotateSelection(90)],
        ['Nhân bản sang phải 2km', () => this.ed.copySelection(2, 0)],
      ]),
    );
    menu.append(
      this.dropdown('Xem', [
        ['Vừa màn hình (Home)', () => this.ed.zoomExtents()],
        ['Vừa phạm vi tỉnh', () => this.zoomProvince()],
        ['Bật/tắt lưới (F7)', () => this.toggleOpt('showGrid')],
        ['Bật/tắt nhãn mã dây', () => this.toggleOpt('showConductor')],
        ['Bật/tắt tên trạm', () => this.toggleOpt('showLabels')],
        ['Bật/tắt tên thiết bị', () => this.toggleOpt('showDeviceLabels')],
        ['—', () => undefined],
        ['Chế độ in (nền trắng)', () => this.toggleOpt('printMode')],
        ['Bật/tắt con trỏ chữ thập', () => {
          this.ed.crosshair = !this.ed.crosshair;
          this.ed.requestDraw();
        }],
      ]),
    );
    menu.append(
      this.dropdown('Dữ liệu', [
        ['Mở sơ đồ nguyên lý trạm (từ CAD)…', () => this.showCadSheetList()],
        ['Nạp tất cả các tờ sơ đồ từ CAD', () => this.loadAllCadSheets()],
        ['—', () => undefined],
        ['Gán cấp điện áp theo lớp CAD gốc…', () => this.showSrcLayerDialog()],
        ['—', () => undefined],
        ['Bảng trạm 110/220kV', () => this.showTramTable()],
        ['Bảng đường dây', () => this.showLineTable()],
        ['Thêm trang sơ đồ trạm…', () => this.addSubstationSheet('tram')],
        ['Thêm trang lưới trung áp…', () => this.addSubstationSheet('trung-ap')],
        ['Xoá trang đang mở', () => this.removeSheet()],
        ['—', () => undefined],
        ['Giãn các trạm chồng lấn', () => this.doDeclutter()],
        ['Đưa trạm về đúng toạ độ địa lý', () => this.doResetGeo()],
        ['—', () => undefined],
        ['Xoá toàn bộ đường dây sơ bộ', () => this.removeDraftLines()],
      ]),
    );
    menu.append(this.dropdown('Trợ giúp', [['Phím tắt & hướng dẫn', () => this.showHelp()]]));
    h.append(menu);
    return h;
  }

  private dropdown(label: string, items: [string, () => void][]): HTMLElement {
    const wrap = el('div', { class: 'dropdown' });
    const btn = el('button', { class: 'menu-btn', type: 'button', text: label });
    const list = el('div', { class: 'dropdown-list' });
    for (const [text, fn] of items) {
      if (text === '—') {
        list.append(el('div', { class: 'sep' }));
        continue;
      }
      const it = el('button', { class: 'dropdown-item', type: 'button', text });
      it.addEventListener('click', () => {
        list.classList.remove('open');
        fn();
      });
      list.append(it);
    }
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = list.classList.contains('open');
      for (const o of document.querySelectorAll('.dropdown-list.open')) o.classList.remove('open');
      if (!wasOpen) list.classList.add('open');
    });
    document.addEventListener('click', () => list.classList.remove('open'));
    wrap.append(btn, list);
    return wrap;
  }

  private buildLeft(): HTMLElement {
    const side = el('aside', { class: 'side side-left' });

    const toolBox = el('div', { class: 'tool-grid' });
    for (const t of TOOLS) {
      const b = el('button', { class: 'tool-btn', type: 'button', title: `${t.hint} (${t.key})` }, [
        el('span', { class: 'tool-label', text: t.label }),
        el('span', { class: 'tool-key', text: t.key }),
      ]);
      b.addEventListener('click', () => this.ed.setTool(t.id));
      this.toolButtons.set(t.id, b);
      toolBox.append(b);
    }
    side.append(this.panel('Công cụ', toolBox));

    /* ----- thiet lap ve ----- */
    const s = el('div', { class: 'panel-body' });
    const kvRow = el('div', { class: 'kv-row' });
    for (const st of allStyles()) {
      const b = el('button', {
        class: 'kv-chip',
        type: 'button',
        title: `Vẽ ở cấp ${st.name}`,
        'data-kv': String(st.kv),
      }, [st.name]);
      b.style.borderColor = st.color;
      b.style.color = st.color;
      b.addEventListener('click', () => {
        this.ed.settings.kv = st.kv;
        this.refreshChrome();
      });
      kvRow.append(b);
    }
    s.append(labeled('Cấp điện áp đang vẽ', kvRow));
    s.append(
      labeled(
        'Loại tuyến',
        select(
          [
            { value: 'ĐDK', label: 'ĐDK (trên không)' },
            { value: 'Cáp ngầm', label: 'Cáp ngầm' },
            { value: 'Cáp vặn xoắn', label: 'Cáp vặn xoắn' },
            { value: 'Thanh cái', label: 'Thanh cái' },
          ],
          this.ed.settings.lineKind,
          (v) => (this.ed.settings.lineKind = v as typeof this.ed.settings.lineKind),
        ),
      ),
    );
    s.append(
      labeled(
        'Mã hiệu dây / cáp',
        input(this.ed.settings.conductor, (v) => (this.ed.settings.conductor = v), {
          list: 'ma-day',
          placeholder: 'AC-120 / Cu/XLPE/PVC 3x240',
        }),
      ),
    );
    const scaleInput = input(String(this.ed.settings.deviceScale), (v) => (this.ed.settings.deviceScale = Math.max(0.001, Number(v) || 1)), {
      type: 'number',
      step: '0.1',
    });
    const scaleRow = el('div', { class: 'row' }, [
      scaleInput,
      button('Vừa mắt', () => {
        // Chon co ky hieu sao cho may cat cao khoang 26px tren man hinh hien tai.
        const v = Math.round(this.ed.vp.px(26) * 1000) / 1000;
        this.ed.settings.deviceScale = v;
        scaleInput.value = String(v);
        this.setMsg(`Cỡ ký hiệu thiết bị: ${v}`);
      }, { title: 'Đặt cỡ ký hiệu vừa với mức phóng hiện tại' }),
    ]);
    (scaleRow.lastElementChild as HTMLElement).style.flex = '0 0 auto';
    s.append(labeled('Cỡ ký hiệu thiết bị', scaleRow));
    s.append(
      labeled(
        'Bước lưới (km)',
        input(String(this.ed.snap.gridStep), (v) => (this.ed.snap.gridStep = Math.max(0.01, Number(v) || 1)), {
          type: 'number',
          step: '0.1',
        }),
      ),
    );
    side.append(this.panel('Thiết lập vẽ', s));

    this.paletteApi = buildPalette(
      () => this.ed.settings.block,
      (id) => {
        this.ed.settings.block = id;
        this.ed.setTool('device');
        this.paletteApi.refresh();
      },
    );
    side.append(this.panel('Thư viện thiết bị', this.paletteApi.root, true));
    side.append(this.panel('Lớp (Layer)', this.layersHost, true));
    return side;
  }

  private buildRight(): HTMLElement {
    const side = el('aside', { class: 'side side-right' });
    side.append(this.panel('Thuộc tính', this.propsHost));
    side.append(this.panel('Danh mục trạm', this.tramHost, true));
    return side;
  }

  private panel(title: string, body: HTMLElement, scroll = false): HTMLElement {
    const p = el('section', { class: `panel${scroll ? ' panel-scroll' : ''}` });
    const head = el('div', { class: 'panel-head' }, [el('span', { text: title })]);
    head.addEventListener('click', () => p.classList.toggle('collapsed'));
    p.append(head, body);
    return p;
  }

  private buildStatus(): HTMLElement {
    const bar = el('footer', { class: 'status' });
    bar.append(this.statusCoord);
    bar.append(this.toggles);
    bar.append(this.statusPrompt);
    bar.append(this.statusMsg);
    return bar;
  }

  /* ============================== cap nhat ============================= */

  private setMsg(m: string): void {
    this.statusMsg.textContent = m;
    window.clearTimeout(Number(this.statusMsg.dataset.t ?? 0));
    const t = window.setTimeout(() => (this.statusMsg.textContent = ''), 4000);
    this.statusMsg.dataset.t = String(t);
  }

  refreshChrome(): void {
    for (const [id, b] of this.toolButtons) b.classList.toggle('active', this.ed.toolName === id);
    for (const chip of this.root.querySelectorAll<HTMLElement>('.kv-chip')) {
      const on = chip.dataset.kv === String(this.ed.settings.kv);
      chip.classList.toggle('active', on);
      chip.style.background = on ? colorOf(Number(chip.dataset.kv) as VoltageKv) : 'transparent';
      chip.style.color = on ? '#0b0e13' : chip.style.borderColor;
    }
    this.paletteApi?.refresh();
    this.toggles.replaceChildren(
      this.toggleChip('ORTHO', this.ed.snap.ortho, () => (this.ed.snap.ortho = !this.ed.snap.ortho), 'F8'),
      this.toggleChip('BẮT ĐIỂM', this.ed.snap.osnap, () => (this.ed.snap.osnap = !this.ed.snap.osnap), 'F3'),
      this.toggleChip('LƯỚI', this.ed.snap.grid, () => (this.ed.snap.grid = !this.ed.snap.grid), 'F9'),
      this.toggleChip('HIỆN LƯỚI', this.ed.renderer.opt.showGrid, () => this.toggleOpt('showGrid'), 'F7'),
      this.toggleChip('CHẾ ĐỘ IN', this.ed.renderer.opt.printMode, () => this.toggleOpt('printMode'), ''),
    );
    this.layersHost.replaceChildren(buildLayers(this.ed, () => this.refreshChrome()));
    this.ed.requestDraw();
  }

  private toggleChip(label: string, on: boolean, toggle: () => void, key: string): HTMLElement {
    const b = el('button', {
      class: `chip${on ? ' on' : ''}`,
      type: 'button',
      title: key ? `${label} (${key})` : label,
      text: label,
    });
    b.addEventListener('click', () => {
      toggle();
      this.refreshChrome();
    });
    return b;
  }

  private toggleOpt(k: keyof typeof this.ed.renderer.opt): void {
    this.ed.renderer.opt[k] = !this.ed.renderer.opt[k];
    this.refreshChrome();
  }

  refreshProps(): void {
    this.propsHost.replaceChildren(buildProps(this.ed, this.ed.selectedEntities()));
  }

  refreshTram(): void {
    const list = el('div', { class: 'tram-list' });
    const subs = this.store.entities.filter((e): e is SubstationEntity => e.kind === 'substation');
    if (subs.length) {
      list.append(
        el('p', {
          class: 'muted small hint',
          text: 'Bấm tên trạm để phóng tới; bấm "Sơ đồ" (hoặc nhấn đúp vào khối trạm) để mở sơ đồ nguyên lý trong trạm.',
        }),
      );
    }
    subs.sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true }));
    if (!subs.length) list.append(el('p', { class: 'muted', text: 'Trang này chưa có trạm nào.' }));
    const coSoDo = new Set(listCadSheets().map((c) => c.code));
    for (const s of subs) {
      const wrap = el('div', { class: 'tram-item' });
      const row = el('button', { class: 'tram-row', type: 'button', title: 'Phóng tới trạm trên sơ đồ tỉnh' }, [
        el('span', { class: 'tram-code', text: s.code }),
        el('span', { class: 'tram-name', text: s.name.replace(/^TBA\s*/i, '') }),
      ]);
      (row.firstChild as HTMLElement).style.color = colorOf(s.kv);
      row.addEventListener('click', () => {
        this.ed.select([s.id]);
        this.ed.zoomToEntity(s.id);
      });
      wrap.append(row);
      if (coSoDo.has(s.code)) {
        const open = el('button', {
          class: 'tram-open',
          type: 'button',
          title: `Mở sơ đồ nguyên lý ${s.code} (trích từ file CAD)`,
          text: 'Sơ đồ',
        });
        open.addEventListener('click', () => this.openCadSheet(s.code, s.id));
        wrap.append(open);
      }
      list.append(wrap);
    }
    this.tramHost.replaceChildren(list);
  }

  refreshTabs(): void {
    this.tabs.replaceChildren();
    for (const sh of this.store.drawing.sheets) {
      const b = el('button', {
        class: `tab${sh.id === this.store.drawing.activeSheet ? ' active' : ''}`,
        type: 'button',
        text: sh.name,
      });
      b.addEventListener('click', () => {
        this.store.setActiveSheet(sh.id);
        this.ed.clearSelection();
        this.ed.zoomExtents();
        this.refreshTabs();
        this.refreshTram();
      });
      this.tabs.append(b);
    }
  }

  private scheduleAutosave(): void {
    window.clearTimeout(this.autosaveTimer);
    this.autosaveTimer = window.setTimeout(() => {
      if (!autosave(this.store.drawing)) {
        this.setMsg('Bản vẽ quá lớn để lưu tạm trong trình duyệt — hãy lưu ra file .sld');
      }
    }, 1500);
  }

  /* ============================== phim tat ============================ */

  private onKey(e: KeyboardEvent): void {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    if (e.key === 'Home') {
      this.ed.zoomExtents();
      e.preventDefault();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      this.saveFile();
      return;
    }
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      const tool = TOOLS.find((x) => x.key.toLowerCase() === e.key.toLowerCase());
      if (tool) {
        this.ed.setTool(tool.id);
        e.preventDefault();
        return;
      }
    }
    if (this.ed.handleKey(e)) {
      e.preventDefault();
      this.refreshChrome();
      this.refreshProps();
    }
  }

  /* ================================ tep =============================== */

  private newProvince(): void {
    if (!confirm('Tạo sơ đồ tỉnh mẫu mới? Bản vẽ hiện tại sẽ bị thay thế.')) return;
    clearAutosave();
    this.store.load(buildProvinceDrawing());
    this.ed.clearSelection();
    this.ed.zoomExtents();
    this.refreshTabs();
    this.refreshTram();
    this.refreshChrome();
  }

  private newBlank(): void {
    if (!confirm('Tạo bản vẽ trắng? Bản vẽ hiện tại sẽ bị thay thế.')) return;
    const d = buildProvinceDrawing();
    d.sheets[0].entities = {};
    d.sheets[0].name = 'Bản vẽ mới';
    d.title = 'Bản vẽ mới';
    clearAutosave();
    this.store.load(d);
    this.ed.clearSelection();
    this.refreshTabs();
    this.refreshTram();
    this.refreshChrome();
  }

  private async openFile(): Promise<void> {
    const f = await pickFile('.sld,.json,application/json');
    if (!f) return;
    try {
      const d = deserialize(await readText(f));
      this.store.load(d);
      this.ed.clearSelection();
      this.ed.zoomExtents();
      this.refreshTabs();
      this.refreshTram();
      this.refreshChrome();
      toast(`Đã mở ${f.name}`);
    } catch (err) {
      toast(`Không mở được file: ${(err as Error).message}`, 'error');
    }
  }

  private saveFile(): void {
    download(suggestName(this.store.drawing.title, 'sld'), serialize(this.store.drawing), 'application/json');
    toast('Đã lưu bản vẽ');
  }

  private doExportDxf(): void {
    download(suggestName(this.store.sheet.name, 'dxf'), exportDxf(this.store), 'application/dxf');
    toast('Đã xuất DXF (mở được bằng AutoCAD / GstarCAD / VinaCAD)');
  }

  private doExportSvg(): void {
    const svg = exportSvg(this.store, (e: Entity) => colorOf(e.kv, true));
    download(suggestName(this.store.sheet.name, 'svg'), svg, 'image/svg+xml');
    toast('Đã xuất SVG');
  }

  private doExportPng(): void {
    exportPng(this.canvas, suggestName(this.store.sheet.name, 'png'));
    toast('Đã xuất ảnh PNG theo đúng khung nhìn hiện tại');
  }

  /* ============================== nhap DXF ============================ */

  private async importDxfDialog(): Promise<void> {
    const f = await pickFile('.dxf');
    if (!f) return;
    let text: string;
    try {
      text = await readDxf(f);
    } catch (err) {
      toast((err as Error).message, 'error');
      return;
    }
    let info: ReturnType<typeof inspectDxf>;
    try {
      info = inspectDxf(text);
    } catch (err) {
      toast(`File DXF không đọc được: ${(err as Error).message}`, 'error');
      return;
    }
    if (!info.soDoiTuong) {
      toast('Không tìm thấy đối tượng nào trong file DXF (file có thể ở dạng nhị phân - hãy lưu lại dạng ASCII DXF).', 'error');
      return;
    }

    const opt = defaultImportOptions();
    const w = Math.max(1e-6, info.box.maxX - info.box.minX);
    const h = Math.max(1e-6, info.box.maxY - info.box.minY);
    let targetKm = 20;
    opt.scale = targetKm / Math.max(w, h);
    opt.defaultKv = this.ed.settings.kv;

    const body = el('div', { class: 'import-dialog' });
    body.append(
      el('p', {
        class: 'muted small',
        text: `File: ${f.name} — ${info.soDoiTuong} đối tượng — ${info.layers.length} lớp — kích thước gốc ${w.toFixed(1)} x ${h.toFixed(1)} đơn vị CAD.`,
      }),
    );
    const sizeInput = input(String(targetKm), (v) => {
      targetKm = Math.max(0.1, Number(v) || 20);
      opt.scale = targetKm / Math.max(w, h);
    }, { type: 'number', step: '1' });
    body.append(labeled('Đặt bản vẽ nhập vào rộng khoảng (km)', sizeInput));
    body.append(
      labeled(
        'Cấp điện áp mặc định (khi tên lớp không cho biết)',
        select(allStyles().map((s) => ({ value: String(s.kv), label: s.name })), String(opt.defaultKv), (v) => {
          opt.defaultKv = Number(v) as VoltageKv;
        }),
      ),
    );
    body.append(checkbox('Nhập cả chữ / ghi chú', opt.importText, (v) => (opt.importText = v)));
    body.append(checkbox('Giữ nguyên tên lớp của CAD (thay vì gom theo cấp điện áp)', opt.keepLayers, (v) => (opt.keepLayers = v)));
    const skip = input(opt.skipLayers.join(', '), (v) => (opt.skipLayers = v.split(',').map((s) => s.trim()).filter(Boolean)));
    body.append(labeled('Bỏ qua các lớp (cách nhau bởi dấu phẩy)', skip));
    body.append(
      el('details', {}, [
        el('summary', { text: `Danh sách ${info.layers.length} lớp trong file` }),
        el('div', { class: 'layer-list small muted', text: info.layers.join(' · ') }),
      ]),
    );

    const ok = button('Nhập vào bản vẽ', () => {
      close();
      this.runImport(text, opt, f.name);
    }, { class: 'btn primary' });
    const cancel = button('Huỷ', () => close());
    const close = dialog('Nhập sơ đồ từ file CAD (DXF)', body, [cancel, ok]);
  }

  private runImport(text: string, opt: ReturnType<typeof defaultImportOptions>, fileName: string): void {
    try {
      // Dat goc ban ve nhap vao ben phai vung dang nhin de khong de len so do cu
      const view = this.ed.vp.viewBox();
      const pre = importDxf(text, { ...opt, offset: { x: 0, y: 0 } });
      opt.offset = {
        x: view.maxX + 5 - pre.box.minX,
        y: (view.minY + view.maxY) / 2 - (pre.box.minY + pre.box.maxY) / 2,
      };
      const res = importDxf(text, opt);
      this.store.transact(`Nhập DXF: ${fileName}`, () => {
        for (const e of res.entities) {
          this.store.ensureLayer(e.layer);
          this.store.put(e);
        }
      });
      this.ed.select(res.entities.filter((e) => e.kind !== 'node').map((e) => e.id));
      this.ed.zoomExtents();
      this.refreshChrome();
      this.refreshTram();
      toast(
        `Đã nhập ${res.stats.tuyen} tuyến, ${res.stats.thietBi} thiết bị, ${res.stats.chu} dòng chữ từ ${fileName}. Toàn bộ đang được chọn — có thể kéo để đặt đúng vị trí.`,
      );
    } catch (err) {
      toast(`Nhập DXF thất bại: ${(err as Error).message}`, 'error');
    }
  }

  /* ============================== bang bieu =========================== */

  /* ======================= so do trong tram (CAD) ===================== */

  /**
   * Mở tờ sơ đồ nguyên lý của một trạm, lấy từ bộ dữ liệu trích xuất từ file CAD.
   * Nếu trang đã mở trước đó thì chỉ chuyển sang trang đó.
   */
  openCadSheet(code: string, substationId?: string): boolean {
    const existing = this.store.drawing.sheets.find((s) => s.cadCode === code);
    if (existing) {
      this.store.setActiveSheet(existing.id);
      this.ed.clearSelection();
      this.ed.zoomExtents();
      this.refreshTabs();
      this.refreshTram();
      return true;
    }
    const sub = substationId ? this.store.getAnywhere(substationId) : undefined;
    const tenTram = sub && sub.kind === 'substation' ? sub.name : undefined;
    const sheet = buildCadSheet(code, cadSheetName(code, tenTram), substationId);
    if (!sheet) {
      toast(`Chưa có sơ đồ nguyên lý của ${code} trong dữ liệu kèm theo.`, 'warn');
      return false;
    }
    sheet.cadCode = code;
    for (const l of cadLayerNames()) this.store.ensureLayer(l);
    this.store.addSheet(sheet);
    if (substationId && sheet.type === 'tram') {
      this.store.update(substationId, (x: Entity) => {
        if (x.kind === 'substation') x.internalSheet = sheet.id;
      });
    }
    this.store.setActiveSheet(sheet.id);
    this.ed.clearSelection();
    this.ed.zoomExtents();
    this.refreshTabs();
    this.refreshTram();
    this.refreshChrome();
    return true;
  }

  private showCadSheetList(): void {
    const list = listCadSheets();
    const body = el('div', {});
    body.append(
      el('p', {
        class: 'muted small',
        text:
          `${list.length} tờ sơ đồ trích xuất từ file CAD của Phòng Điều độ. ` +
          'Bấm vào một dòng để mở; trang mở ra sửa được như mọi trang khác. ' +
          'Cách nhanh hơn: nhấn đúp chuột vào khối trạm trên sơ đồ tỉnh.',
      }),
    );
    const t = el('table', { class: 'table' });
    t.append(
      el('thead', {}, [
        el('tr', {}, [
          el('th', { text: 'Mã' }),
          el('th', { text: 'Tên tờ sơ đồ' }),
          el('th', { text: 'Tuyến' }),
          el('th', { text: 'Thiết bị' }),
          el('th', { text: 'Chữ' }),
          el('th', { text: '' }),
        ]),
      ]),
    );
    const tb = el('tbody');
    for (const s of list) {
      const opened = this.store.drawing.sheets.some((x) => x.cadCode === s.code);
      const tr = el('tr', {}, [
        el('td', { text: s.code }),
        el('td', { text: s.title }),
        el('td', { text: String(s.soTuyen) }),
        el('td', { text: String(s.soThietBi) }),
        el('td', { text: String(s.soChu) }),
        el('td', { text: opened ? 'đã mở' : '' }),
      ]);
      tr.addEventListener('click', () => {
        close();
        const sub = this.store.entities.find(
          (e): e is SubstationEntity => e.kind === 'substation' && e.code === s.code,
        );
        this.openCadSheet(s.code, sub?.id);
      });
      tb.append(tr);
    }
    t.append(tb);
    const close = dialog(
      'Sơ đồ nguyên lý các trạm (trích xuất từ file CAD)',
      el('div', { class: 'table-wrap' }, [t]),
      [button('Đóng', () => close())],
    );
  }

  private loadAllCadSheets(): void {
    const list = listCadSheets();
    const chua = list.filter((s) => !this.store.drawing.sheets.some((x) => x.cadCode === s.code));
    if (!chua.length) {
      toast('Tất cả các tờ sơ đồ CAD đã được nạp.');
      return;
    }
    if (
      !confirm(
        `Nạp ${chua.length} tờ sơ đồ (khoảng ${chua.reduce((a, s) => a + s.soTuyen + s.soThietBi + s.soChu, 0).toLocaleString('vi-VN')} đối tượng)?\n` +
          'Bản vẽ sẽ nặng hơn và không lưu tạm được trong trình duyệt — nhớ lưu ra file .sld.',
      )
    ) {
      return;
    }
    for (const s of chua) {
      const sub = this.store.entities.find(
        (e): e is SubstationEntity => e.kind === 'substation' && e.code === s.code,
      );
      const sheet = buildCadSheet(s.code, cadSheetName(s.code, sub?.name), sub?.id);
      if (!sheet) continue;
      sheet.cadCode = s.code;
      this.store.addSheet(sheet);
    }
    for (const l of cadLayerNames()) this.store.ensureLayer(l);
    this.refreshTabs();
    this.refreshChrome();
    toast(`Đã nạp ${chua.length} tờ sơ đồ. Chọn trang ở thanh thẻ phía trên bản vẽ.`);
  }

  /**
   * Gán lại cấp điện áp theo LỚP CAD GỐC của trang đang mở.
   *
   * Vài tờ trong file CAD (Bắc Kạn, Yên Bình...) dùng tên lớp không có cấp điện áp
   * ("DUONGCHINH", "LINE", "THANHCAI"...) nên khi nhập, phần mềm phải để mặc định.
   * Bảng này cho sửa cả lớp một lần thay vì chọn từng đối tượng.
   */
  private showSrcLayerDialog(): void {
    const groups = new Map<string, { n: number; kvs: Map<number, number> }>();
    for (const e of this.store.entities) {
      if (!e.srcLayer) continue;
      let g = groups.get(e.srcLayer);
      if (!g) {
        g = { n: 0, kvs: new Map() };
        groups.set(e.srcLayer, g);
      }
      g.n++;
      g.kvs.set(e.kv, (g.kvs.get(e.kv) ?? 0) + 1);
    }
    if (!groups.size) {
      toast('Trang này không có đối tượng nào nhập từ CAD.', 'warn');
      return;
    }

    const changes = new Map<string, VoltageKv>();
    const body = el('div', {});
    body.append(
      el('p', {
        class: 'muted small',
        text:
          'Mỗi dòng là một lớp trong file CAD gốc. Chọn cấp điện áp đúng rồi bấm Áp dụng — ' +
          'toàn bộ đối tượng thuộc lớp đó trong trang này sẽ đổi màu theo quy ước.',
      }),
    );
    const t = el('table', { class: 'table' });
    t.append(
      el('thead', {}, [
        el('tr', {}, [
          el('th', { text: 'Lớp trong file CAD' }),
          el('th', { text: 'Số đối tượng' }),
          el('th', { text: 'Đang là' }),
          el('th', { text: 'Đổi thành' }),
          el('th', { text: '' }),
        ]),
      ]),
    );
    const tb = el('tbody');
    for (const [name, g] of [...groups].sort((a, b) => b[1].n - a[1].n)) {
      const cur = [...g.kvs.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const pick = select(
        [{ value: '', label: '(giữ nguyên)' }, ...allStyles().map((x) => ({ value: String(x.kv), label: x.name }))],
        '',
        (v) => {
          if (v) changes.set(name, Number(v) as VoltageKv);
          else changes.delete(name);
        },
      );
      const sel = button('Chọn', () => {
        close();
        this.ed.select(
          this.store.entities.filter((e) => e.srcLayer === name && e.kind !== 'node').map((e) => e.id),
        );
        this.refreshProps();
      }, { title: 'Chọn toàn bộ đối tượng của lớp này trên bản vẽ' });
      tb.append(
        el('tr', {}, [
          el('td', { text: name }),
          el('td', { text: String(g.n) }),
          el('td', { text: `${cur} kV` }),
          el('td', {}, [pick]),
          el('td', {}, [sel]),
        ]),
      );
    }
    t.append(tb);
    body.append(el('div', { class: 'table-wrap' }, [t]));

    const apply = button(
      'Áp dụng',
      () => {
        if (!changes.size) {
          close();
          return;
        }
        let n = 0;
        this.store.transact('Gán cấp điện áp theo lớp CAD', () => {
          for (const e of this.store.entities) {
            const kv = e.srcLayer ? changes.get(e.srcLayer) : undefined;
            if (kv === undefined) continue;
            n++;
            this.store.update(e.id, (x: Entity) => {
              x.kv = kv;
              x.layer = allStyles().find((st) => st.kv === kv)?.layer ?? x.layer;
            });
          }
        });
        close();
        this.refreshChrome();
        toast(`Đã đổi cấp điện áp cho ${n} đối tượng.`);
      },
      { class: 'btn primary' },
    );
    const close = dialog('Gán cấp điện áp theo lớp CAD gốc', body, [button('Đóng', () => close()), apply]);
  }

  private showTramTable(): void {
    const subs = this.store.entities.filter((e): e is SubstationEntity => e.kind === 'substation');
    subs.sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true }));
    const t = el('table', { class: 'table' });
    t.append(
      el('thead', {}, [
        el('tr', {}, [
          el('th', { text: 'Mã' }),
          el('th', { text: 'Tên trạm' }),
          el('th', { text: 'Cấp ĐA' }),
          el('th', { text: 'MBA' }),
          el('th', { text: 'Khu vực' }),
          el('th', { text: 'Vĩ độ' }),
          el('th', { text: 'Kinh độ' }),
        ]),
      ]),
    );
    const tb = el('tbody');
    for (const s of subs) {
      tb.append(
        el('tr', {}, [
          el('td', { text: s.code }),
          el('td', { text: s.name }),
          el('td', { text: s.levels.join('/') + ' kV' }),
          el('td', { text: s.transformers.map((x) => x.capacity).join(' + ') }),
          el('td', { text: s.commune ?? '' }),
          el('td', { text: s.lat?.toFixed(4) ?? '' }),
          el('td', { text: s.lon?.toFixed(4) ?? '' }),
        ]),
      );
    }
    t.append(tb);
    const wrap = el('div', { class: 'table-wrap' }, [t]);
    const csv = button('Tải về .csv', () => {
      const rows = [['Mã', 'Tên trạm', 'Cấp ĐA', 'MBA', 'Khu vực', 'Vĩ độ', 'Kinh độ']];
      for (const s of subs) {
        rows.push([s.code, s.name, s.levels.join('/') + ' kV', s.transformers.map((x) => x.capacity).join(' + '), s.commune ?? '', String(s.lat ?? ''), String(s.lon ?? '')]);
      }
      download('danh-muc-tram.csv', '﻿' + rows.map((r) => r.map((c) => `"${c}"`).join(';')).join('\r\n'), 'text/csv');
    });
    const close = dialog(`Danh mục trạm (${subs.length})`, wrap, [csv, button('Đóng', () => close())]);
  }

  private showLineTable(): void {
    const branches = this.store.entities.filter((e) => e.kind === 'branch');
    const t = el('table', { class: 'table' });
    t.append(
      el('thead', {}, [
        el('tr', {}, [
          el('th', { text: 'Tuyến' }),
          el('th', { text: 'Cấp ĐA' }),
          el('th', { text: 'Loại' }),
          el('th', { text: 'Mã dây' }),
          el('th', { text: 'Mạch' }),
          el('th', { text: 'Dài (km)' }),
          el('th', { text: 'Ghi chú' }),
        ]),
      ]),
    );
    const tb = el('tbody');
    for (const b of branches) {
      if (b.kind !== 'branch') continue;
      const tr = el('tr', {}, [
        el('td', { text: b.label ?? '(chưa đặt tên)' }),
        el('td', { text: `${b.kv} kV` }),
        el('td', { text: b.lineKind }),
        el('td', { text: b.conductor?.code ?? '' }),
        el('td', { text: String(b.conductor?.circuits ?? 1) }),
        el('td', { text: (b.lengthKm ?? this.ed.renderer.branchLength(b)).toFixed(2) }),
        el('td', { text: b.note ?? '' }),
      ]);
      tr.addEventListener('click', () => {
        this.ed.select([b.id]);
        this.ed.zoomToEntity(b.id);
      });
      tb.append(tr);
    }
    t.append(tb);
    const close = dialog(
      `Bảng đường dây (${branches.length})`,
      el('div', { class: 'table-wrap' }, [t]),
      [button('Đóng', () => close())],
    );
  }

  private doDeclutter(): void {
    const n = this.declutter();
    this.refreshChrome();
    toast(
      n
        ? `Đã giãn ${n} trạm để nhãn không che nhau. Dùng "Đưa trạm về đúng toạ độ địa lý" nếu muốn trả lại vị trí gốc.`
        : 'Không có trạm nào chồng lấn.',
    );
  }

  private doResetGeo(): void {
    const n = resetSubstationsToGeo(this.store);
    this.refreshChrome();
    toast(n ? `Đã đưa ${n} trạm về đúng toạ độ địa lý.` : 'Các trạm đã ở đúng toạ độ địa lý.');
  }

  private removeDraftLines(): void {
    const drafts = this.store.entities.filter((e) => e.kind === 'branch' && e.note?.includes('sơ bộ'));
    if (!drafts.length) {
      toast('Không còn đường dây sơ bộ nào.');
      return;
    }
    if (!confirm(`Xoá ${drafts.length} đường dây được đánh dấu "sơ bộ - cần rà soát"?`)) return;
    this.store.transact('Xoá đường dây sơ bộ', () => {
      for (const b of drafts) {
        if (b.kind === 'branch') for (const n of b.nodes) this.store.remove(n);
        this.store.remove(b.id);
      }
    });
    this.ed.clearSelection();
    toast(`Đã xoá ${drafts.length} đường dây sơ bộ`);
  }

  private addSubstationSheet(type: 'tram' | 'trung-ap'): void {
    const sel = this.ed.selectedEntities().find((e): e is SubstationEntity => e.kind === 'substation');
    if (!sel) {
      toast('Hãy chọn một trạm trên sơ đồ tỉnh trước, rồi chọn lại mục này.', 'warn');
      return;
    }
    const sheet = createSubstationSheet(this.store, sel, type);
    if (type === 'tram') {
      this.store.transact('Liên kết trang trạm', () => {
        this.store.update(sel.id, (x: Entity) => {
          if (x.kind === 'substation') x.internalSheet = sheet.id;
        });
      });
    }
    this.store.setActiveSheet(sheet.id);
    this.refreshTabs();
    this.refreshTram();
    toast(
      type === 'tram'
        ? `Đã tạo trang "${sheet.name}". Dùng Thanh cái + Thiết bị để vẽ sơ đồ nguyên lý trong trạm.`
        : `Đã tạo trang "${sheet.name}". Dùng Tệp → Nhập từ CAD (.dxf) để đưa sơ đồ lộ trung áp vào trang này.`,
    );
  }

  private removeSheet(): void {
    if (this.store.drawing.sheets.length <= 1) {
      toast('Bản vẽ chỉ còn một trang, không xoá được.', 'warn');
      return;
    }
    const sh = this.store.sheet;
    if (!confirm(`Xoá trang "${sh.name}"? Toàn bộ nội dung trong trang sẽ mất.`)) return;
    this.store.removeSheet(sh.id);
    this.ed.clearSelection();
    this.refreshTabs();
    this.refreshTram();
    this.ed.zoomExtents();
  }

  /* ---- cac ham duoi day duoc goi tu script kiem thu tools/smoke-test.mjs ---- */

  /** Xuat noi dung DXF cua trang hien tai (khong tai file). */
  exportDxfText(): string {
    return exportDxf(this.store);
  }

  /** Nhap DXF tu byte (tu dong do bang ma) - dung cho kiem thu. */
  importDxfBuffer(buf: ArrayBuffer): { tuyen: number; thietBi: number; chu: number } {
    return this.importDxfText(decodeDxfBuffer(buf));
  }

  /** Nhap mot chuoi DXF vao ban ve, tra ve thong ke. */
  importDxfText(text: string): { tuyen: number; thietBi: number; chu: number } {
    const opt = defaultImportOptions();
    const res = importDxf(text, opt);
    this.store.transact('Nhập DXF', () => {
      for (const e of res.entities) {
        this.store.ensureLayer(e.layer);
        this.store.put(e);
      }
    });
    this.refreshChrome();
    return res.stats;
  }

  /** Giãn các trạm chồng lấn (dùng cho kiểm thử và menu Dữ liệu). */
  declutter(): number {
    return declutterSubstations(this.store);
  }

  private showHelp(): void {
    const body = el('div', { class: 'help' });
    body.innerHTML = `
      <h4>Thao tác chuột (giống CAD)</h4>
      <ul>
        <li><b>Lăn chuột</b>: phóng to / thu nhỏ tại vị trí con trỏ.</li>
        <li><b>Giữ chuột giữa + kéo</b>: di chuyển màn hình (Pan).</li>
        <li><b>Chuột phải</b>: kết thúc lệnh đang vẽ / bỏ chọn.</li>
        <li><b>Kéo khung từ trái sang phải</b>: chọn các đối tượng nằm trọn trong khung.</li>
        <li><b>Kéo khung từ phải sang trái</b>: chọn cả đối tượng cắt qua khung.</li>
      </ul>
      <h4>Phím tắt</h4>
      <ul>
        <li><b>S / L / B / D / T / G / M</b>: Chọn · Đường dây · Thanh cái · Thiết bị · Trạm · Ghi chú · Đo</li>
        <li><b>F3</b> bắt điểm · <b>F7</b> hiện lưới · <b>F8</b> ORTHO · <b>F9</b> bắt lưới</li>
        <li><b>R</b>: xoay 90° khi đang đặt thiết bị</li>
        <li><b>Enter</b> kết thúc tuyến · <b>Esc</b> huỷ lệnh · <b>Delete</b> xoá</li>
        <li><b>Ctrl+Z / Ctrl+Y</b> hoàn tác / làm lại · <b>Ctrl+A</b> chọn tất cả · <b>Ctrl+S</b> lưu</li>
        <li><b>Home</b>: xem vừa màn hình · <b>Phím mũi tên</b>: dịch đối tượng đang chọn</li>
      </ul>
      <h4>Quy ước màu</h4>
      <ul>
        <li><b>110kV — đỏ</b> · <b>35kV — vàng</b> · <b>22kV — xanh</b> (220kV tím, 10kV cam, 6kV lục, 0,4kV xám)</li>
        <li>Cáp ngầm vẽ nét đứt, ĐDK vẽ nét liền, thanh cái vẽ nét đậm.</li>
      </ul>
      <h4>Xem sơ đồ nguyên lý bên trong trạm</h4>
      <ol>
        <li><b>Nhấn đúp chuột</b> vào khối trạm trên sơ đồ tỉnh — phần mềm mở trang sơ đồ
            nguyên lý của trạm đó với đầy đủ thiết bị 110 / 35 / 22 / 6kV lấy từ file CAD.</li>
        <li>Hoặc bấm nút <b>Sơ đồ</b> bên cạnh tên trạm trong bảng <b>Danh mục trạm</b>.</li>
        <li>Hoặc vào <b>Dữ liệu → Mở sơ đồ nguyên lý trạm (từ CAD)…</b> để xem cả danh sách.</li>
        <li>Chuyển qua lại giữa các trang bằng thanh thẻ phía trên vùng vẽ.</li>
      </ol>

      <h4>Đưa sơ đồ trung áp từ CAD vào</h4>
      <ol>
        <li>Trong CAD mở bản vẽ lộ trung áp, dùng lệnh <b>SAVEAS</b> → chọn <b>AutoCAD ASCII DXF</b>.</li>
        <li>Trong phần mềm chọn <b>Tệp → Nhập từ CAD (.dxf)</b>, đặt bề rộng quy đổi (km) rồi bấm Nhập.</li>
        <li>Phần mềm tự nhận cấp điện áp theo tên lớp và nhận dạng block MC / DCL / TI / TU / CSV / Recloser / MBA.</li>
        <li>Nội dung vừa nhập đang được chọn sẵn — kéo chuột để đặt khớp vào trạm 110kV tương ứng.</li>
      </ol>
      <p class="muted small">Bản vẽ được lưu tạm trong trình duyệt sau mỗi thay đổi. Vẫn nên lưu ra file .sld để giữ lâu dài.</p>
    `;
    const close = dialog('Hướng dẫn sử dụng', body, [button('Đóng', () => close())]);
  }
}
