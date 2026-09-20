import { DocStore } from '../core/doc';
import { Editor, type ToolName } from '../editor/editor';
import { buildDefaultDrawing, buildProvinceDrawing, createSubstationSheet } from '../data/seed';
import {
  MA_TO_TONG,
  buildCadSheet,
  cadLayerNames,
  cadSheetName,
  listCadSheets,
  stationsOf,
  type CadStation,
} from '../data/tramSheets';
import type { Entity, SubstationEntity, VoltageKv } from '../core/types';
import { allStyles, colorOf } from '../core/voltage';
import { exportDxf, exportSvg } from '../io/dxfExport';
import { defaultImportOptions, importDxf, inspectDxf } from '../io/dxfImport';
import { cungMach, daoCua, dungMangDien, type MangDien } from '../core/lienket';
import { getBlock } from '../symbols/blocks';
import {
  BUILD_ID,
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
  /** Bản vẽ quá lớn để lưu tạm -> chỉ nhắc một lần, không nhắc lại mỗi lần sửa. */
  private autosaveOff = false;

  constructor(private root: HTMLElement) {
    const saved = loadAutosave();
    this.store = new DocStore(saved ?? buildDefaultDrawing());
    this.canvas = el('canvas', { class: 'canvas' });
    this.ed = new Editor(this.canvas, this.store, {
      onStatus: (m) => {
        if (m.startsWith('X ')) this.statusCoord.textContent = m;
        else this.setMsg(m);
      },
      onPrompt: (m) => (this.statusPrompt.textContent = m),
      onSelection: () => this.refreshProps(),
      onOpenEntity: (e) => {
        // Nhấn đúp vào khối trạm trên sơ đồ địa lý -> nhảy tới đúng trạm đó
        // trên tờ sơ đồ kết dây tổng.
        if (e.kind === 'substation' && e.code) this.gotoStation(e.code);
      },
      onChange: () => {
        // Bản vẽ đổi -> tính lại điểm đấu nối để vừa vẽ xong là thấy ngay
        // thiết bị đã nối được hay chưa.
        if (this.ed.renderer.opt.showTerminals) this.capNhatDiemNoi();
        this.refreshChrome();
      },
    });
    this.build();
    if (saved) this.setMsg('Đã khôi phục bản vẽ từ lần làm việc trước');
    requestAnimationFrame(() => {
      this.ed.resize();
      if (this.store.sheet.cadCode === MA_TO_TONG) this.ed.zoomExtents();
      else this.zoomProvince();
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
        ['—', () => undefined],
        ['Xoá dữ liệu lưu tạm trong trình duyệt…', () => this.resetLocal()],
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
        ['Tô đặc máy cắt đang đóng', () => this.toggleOpt('fillClosedBreaker')],
        ['Chế độ in (nền trắng)', () => this.toggleOpt('printMode')],
        ['Bật/tắt con trỏ chữ thập', () => {
          this.ed.crosshair = !this.ed.crosshair;
          this.ed.requestDraw();
        }],
      ]),
    );
    menu.append(
      this.dropdown('Dữ liệu', [
        ['Danh mục trạm trên sơ đồ kết dây…', () => this.showStationIndex()],
        ['Mở tờ bản vẽ khác từ CAD…', () => this.showCadSheetList()],
        ['—', () => undefined],
        ['Gán cấp điện áp theo lớp CAD gốc…', () => this.showSrcLayerDialog()],
        ['—', () => undefined],
        ['Hiện điểm đấu nối của thiết bị (F4)', () => this.batDiemNoi()],
        ['Tô sáng mạch điện của đối tượng đang chọn (Shift+M)', () => this.toSangMach(false)],
        ['Tô sáng cả chuỗi 110kV - MBA - trung áp', () => this.toSangMach(true)],
        ['Kiểm tra liên kết điện…', () => this.kiemTraLienKet()],
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
    // Hiện mã phiên bản ngay trên thanh trạng thái để biết chắc đang mở bản mới
    bar.append(
      el('span', { class: 'status-item', text: `Phiên bản ${BUILD_ID}`, title: 'Mã phiên bản phần mềm' }),
    );
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
      this.toggleChip('ĐIỂM ĐẤU NỐI', this.ed.renderer.opt.showTerminals, () => this.batDiemNoi(), 'F4'),
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
    const cad: CadStation[] = stationsOf(MA_TO_TONG);
    const subs = this.store.entities.filter((e): e is SubstationEntity => e.kind === 'substation');
    const viTri = new Map(subs.map((s) => [s.code, s.id]));

    if (cad.length) {
      list.append(
        el('p', {
          class: 'muted small hint',
          text: 'Bấm tên trạm để phóng tới trạm đó trên sơ đồ kết dây. Nút "Bản đồ" chuyển sang trang đặt theo vị trí địa lý.',
        }),
      );
      for (const st of cad) {
        const wrap = el('div', { class: 'tram-item' });
        // Giữ lại cấp điện áp trong tên rút gọn: trạm 220kV Phú Bình (E6.16) và
        // trạm 110kV Phú Bình (E6.17) chỉ khác nhau ở chỗ đó.
        const capTram = st.title.match(/(\d{3})\s*KV/i)?.[1] ?? '';
        const ten = st.title
          .replace(/^(SƠ ĐỒ\s*)?TRẠM\s*\d+\s*KV\s*/i, '')
          .replace(/\s*\(?[EA]\d+\.\d+\)?\s*$/i, '')
          .trim();
        const tenDay = capTram ? `${capTram}kV ${ten}` : ten;
        const row = el('button', { class: 'tram-row', type: 'button', title: st.title }, [
          el('span', { class: 'tram-code', text: st.code }),
          el('span', { class: 'tram-name', text: tenDay || st.title }),
        ]);
        (row.firstChild as HTMLElement).style.color = colorOf(capTram === '220' ? 220 : 110);
        row.addEventListener('click', () => this.gotoStation(st.code));
        wrap.append(row);
        const id = viTri.get(st.code);
        if (id) {
          const map = el('button', {
            class: 'tram-open',
            type: 'button',
            title: `Xem vị trí địa lý của ${st.code}`,
            text: 'Bản đồ',
          });
          map.addEventListener('click', () => {
            const geo = this.store.drawing.sheets.find((x) => x.type === 'tinh');
            if (geo) this.store.setActiveSheet(geo.id);
            this.ed.select([id]);
            this.ed.zoomToEntity(id);
            this.refreshTabs();
          });
          wrap.append(map);
        }
        list.append(wrap);
      }
    } else if (!subs.length) {
      list.append(el('p', { class: 'muted', text: 'Trang này chưa có trạm nào.' }));
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
    if (this.autosaveOff) return;
    window.clearTimeout(this.autosaveTimer);
    this.autosaveTimer = window.setTimeout(() => {
      // Sơ đồ kết dây toàn tỉnh có hàng chục nghìn đối tượng, vượt dung lượng
      // lưu tạm của trình duyệt -> bỏ qua thay vì thử đi thử lại mỗi lần sửa.
      let n = 0;
      for (const sh of this.store.drawing.sheets) n += Object.keys(sh.entities).length;
      if (n > 20000 || !autosave(this.store.drawing)) {
        this.autosaveOff = true;
        toast(
          'Bản vẽ lớn nên không lưu tạm được trong trình duyệt. Nhớ dùng Tệp → Lưu bản vẽ (.sld) trước khi đóng.',
          'warn',
        );
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
    if (e.key === 'F4') {
      e.preventDefault();
      this.batDiemNoi();
      return;
    }
    if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'm') {
      e.preventDefault();
      this.toSangMach(false);
      return;
    }
    if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
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

  /**
   * Xoá bản vẽ lưu tạm trong trình duyệt rồi tải lại.
   * Dùng khi vừa chép phiên bản phần mềm mới về mà vẫn thấy dữ liệu cũ.
   */
  /** Mô hình liên kết điện của tờ đang mở (dựng lại khi bản vẽ đổi). */
  private mang?: { sheet: string; rev: number; m: MangDien };

  private mangDien(): MangDien {
    const rev = this.store.version;
    const key = this.store.sheet.id;
    if (this.mang && this.mang.sheet === key && this.mang.rev === rev) return this.mang.m;
    const m = dungMangDien(this.store.entities, (id) => {
      const e = this.store.get(id);
      return e && 'p' in e ? (e.p as { x: number; y: number }) : undefined;
    });
    this.mang = { sheet: key, rev, m };
    return m;
  }

  /**
   * Bật / tắt lớp hiển thị ĐIỂM ĐẤU NỐI.
   *
   * Mỗi cực của thiết bị được đánh dấu: ô vuông xanh đặc = cực đã chạm vào dây
   * dẫn (thiết bị thực sự nối vào lưới), ô vuông đỏ gạch chéo = chưa nối. Nhờ đó
   * khi vẽ thêm đường nối nhìn là biết ngay đã đấu được hay còn hụt.
   */
  private batDiemNoi(): void {
    const bat = !this.ed.renderer.opt.showTerminals;
    this.ed.renderer.opt.showTerminals = bat;
    if (bat) this.capNhatDiemNoi();
    else this.ed.renderer.diemNoi = [];
    this.refreshChrome();
    this.setMsg(
      bat
        ? 'Hiện điểm đấu nối: ô xanh = đã nối vào dây, ô đỏ = chưa nối.'
        : 'Đã tắt lớp điểm đấu nối.',
    );
  }

  /** Tính lại vị trí và trạng thái các cực đấu nối để vẽ lên bản vẽ. */
  private capNhatDiemNoi(): void {
    const m = this.mangDien();
    const ds: { p: { x: number; y: number }; noi: boolean }[] = [];
    for (const cs of m.cucCua.values()) for (const c of cs) ds.push({ p: c.p, noi: c.batDuoc });
    this.ed.renderer.diemNoi = ds;
  }

  /** Tô sáng toàn bộ đối tượng nối thông với đối tượng đang chọn. */
  private toSangMach(quaMBA: boolean): void {
    const goc = this.ed.selectedEntities()[0];
    if (!goc) {
      this.setMsg('Hãy chọn một thiết bị hoặc đoạn dây trước.');
      return;
    }
    const m = this.mangDien();
    const ids = cungMach(this.store.entities, m, goc, quaMBA);
    if (!ids.length) {
      this.setMsg('Đối tượng này chưa đấu vào lưới nào.');
      return;
    }
    this.ed.select(ids);
    this.ed.requestDraw();
    this.setMsg(
      `Mạch ${(daoCua(m, goc) ?? 0) + 1}: ${ids.length} đối tượng nối thông` +
        (quaMBA ? ' (đã đi xuyên máy biến áp)' : ' qua các thiết bị đang đóng'),
    );
  }

  /** Phóng tới một điểm trên bản vẽ và chọn sẵn đối tượng ở đó. */
  private nhayToiDoiTuong(id: string): void {
    const e = this.store.get(id);
    if (!e || !('p' in e)) return;
    const p = e.p as { x: number; y: number };
    const r = 'scale' in e ? Math.max(Number(e.scale) * 3, 30) : 30;
    this.ed.vp.fit({ minX: p.x - r, minY: p.y - r, maxX: p.x + r, maxY: p.y + r }, 0.1);
    this.ed.select([id]);
    this.ed.requestDraw();
    this.refreshProps();
  }

  /** Nhãn ghi gần thiết bị nhất - để biết đó là ngăn lộ nào. */
  private nhanGanNhat(p: { x: number; y: number }, r: number): string {
    let ten = '';
    let bd = r;
    for (const e of this.store.entities) {
      if (e.kind !== 'text') continue;
      const d = Math.hypot(e.p.x - p.x, e.p.y - p.y);
      if (d < bd) {
        bd = d;
        ten = e.text.trim();
      }
    }
    return ten;
  }

  /**
   * Bảng kiểm tra liên kết điện.
   *
   * Ngoài phần thống kê còn liệt kê CHI TIẾT từng thiết bị chưa đấu vào lưới để
   * bấm vào là nhảy tới đúng chỗ, chọn sẵn thiết bị đó mà sửa.
   */
  private kiemTraLienKet(): void {
    const m = this.mangDien();
    const tb = this.store.entities.filter((e) => e.kind === 'device').length;
    let cuc = 0;
    let cucHo = 0;
    for (const cs of m.cucCua.values()) for (const c of cs) { cuc++; if (!c.batDuoc) cucHo++; }

    const row = (a: string, b: string): string =>
      `<tr><td style="padding:2px 14px 2px 0">${a}</td><td><b>${b}</b></td></tr>`;
    const tom = el('div', { class: 'help' });
    tom.innerHTML =
      `<table>${row('Số nút điện (điểm đẳng thế)', String(m.soNut))}` +
      `${row('Số mạch rời nhau (qua thiết bị đang đóng)', String(m.soDao))}` +
      `${row('Cầu nối qua máy biến áp', String(m.cauMBA.length))}` +
      `${row('Thiết bị đã đấu vào lưới', `${tb - m.chuaNoi.length}/${tb}`)}` +
      `${row('Cực đã chạm vào dây dẫn', `${cuc - cucHo}/${cuc}`)}</table>`;

    // Danh sach chi tiet: thiet bi chua dau + thiet bi dau thieu mot cuc
    const ds = [
      ...m.chuaNoi.map((id) => ({ id, loai: 'Chưa đấu' })),
      ...m.noiThieu.map((id) => ({ id, loai: 'Thiếu một cực' })),
    ];
    const t = el('table', { class: 'table' });
    t.append(
      el('thead', {}, [
        el('tr', {}, [
          el('th', { text: 'Ký hiệu' }),
          el('th', { text: 'Nhãn gần nhất' }),
          el('th', { text: 'Cấp' }),
          el('th', { text: 'Toạ độ' }),
          el('th', { text: 'Tình trạng' }),
        ]),
      ]),
    );
    const tbody = el('tbody');
    for (const v of ds) {
      const e = this.store.get(v.id);
      if (!e || e.kind !== 'device') continue;
      const nhan = e.label ?? this.nhanGanNhat(e.p, Math.max(e.scale * 2.5, 25));
      const tr = el('tr', {}, [
        el('td', { text: getBlock(e.block)?.abbr ?? e.block }),
        el('td', { text: nhan }),
        el('td', { text: `${e.kv}kV` }),
        el('td', { text: `${Math.round(e.p.x)} ; ${Math.round(e.p.y)}` }),
        el('td', { text: v.loai }),
      ]);
      tr.title = 'Bấm để nhảy tới và chọn thiết bị này';
      tr.addEventListener('click', () => {
        dong();
        this.nhayToiDoiTuong(v.id);
        if (!this.ed.renderer.opt.showTerminals) this.batDiemNoi();
      });
      tbody.append(tr);
    }
    t.append(tbody);

    const than = el('div', {}, [
      tom,
      el('p', {
        class: 'muted small',
        text: ds.length
          ? `Còn ${ds.length} thiết bị cần rà lại - bấm một dòng để nhảy tới và chọn sẵn thiết bị đó. ` +
            'Vẽ thêm đoạn dây nối vào cực (ô đỏ) là xong.'
          : 'Tất cả thiết bị đã đấu vào lưới.',
      }),
      el('div', { class: 'table-wrap' }, [t]),
    ]);
    const dong = dialog('Kiểm tra liên kết điện', than, [
      button('Chọn hết thiết bị chưa đấu', () => {
        this.ed.select(ds.map((v) => v.id));
        this.ed.requestDraw();
        dong();
      }),
      button('Đóng', () => dong()),
    ]);
  }

  private resetLocal(): void {
    if (
      !confirm(
        'Xoá bản vẽ lưu tạm trong trình duyệt và tải lại phần mềm?\n\n' +
          'Mọi thay đổi chưa lưu ra file .sld sẽ mất. Dùng khi vừa cập nhật phiên bản mới ' +
          'mà màn hình vẫn hiện dữ liệu cũ.',
      )
    ) {
      return;
    }
    clearAutosave();
    location.reload();
  }

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

  /** Đưa khung nhìn tới một trạm trên tờ sơ đồ kết dây tổng. */
  gotoStation(code: string): boolean {
    const sheet =
      this.store.drawing.sheets.find((x) => x.cadCode === MA_TO_TONG) ??
      (() => {
        const n = buildCadSheet(MA_TO_TONG, 'Sơ đồ kết dây lưới điện tỉnh Thái Nguyên');
        if (!n) return undefined;
        n.cadCode = MA_TO_TONG;
        for (const l of cadLayerNames()) this.store.ensureLayer(l);
        this.store.addSheet(n);
        return n;
      })();
    if (!sheet) {
      toast('Không có dữ liệu sơ đồ kết dây kèm theo phần mềm.', 'warn');
      return false;
    }
    const st = stationsOf(MA_TO_TONG).find((x) => x.code === code);
    this.store.setActiveSheet(sheet.id);
    this.ed.clearSelection();
    if (st?.box) {
      this.ed.vp.fit(st.box, 0.05);
    } else if (st) {
      this.ed.vp.cx = st.x;
      this.ed.vp.cy = st.y - 400;
      this.ed.vp.scale = 0.7;
    } else {
      this.ed.zoomExtents();
    }
    this.refreshTabs();
    this.refreshTram();
    this.ed.requestDraw();
    if (!st) toast(`Không tìm thấy trạm ${code} trên sơ đồ kết dây.`, 'warn');
    return !!st;
  }

  /** Danh mục 25 trạm có trên tờ sơ đồ kết dây. */
  private showStationIndex(): void {
    const list = stationsOf(MA_TO_TONG);
    if (!list.length) {
      toast('Không có dữ liệu sơ đồ kết dây kèm theo phần mềm.', 'warn');
      return;
    }
    const t = el('table', { class: 'table' });
    t.append(
      el('thead', {}, [
        el('tr', {}, [el('th', { text: 'Mã' }), el('th', { text: 'Tên trạm trên bản vẽ' })]),
      ]),
    );
    const tb = el('tbody');
    for (const st of list) {
      const tr = el('tr', {}, [el('td', { text: st.code }), el('td', { text: st.title })]);
      tr.addEventListener('click', () => {
        close();
        this.gotoStation(st.code);
      });
      tb.append(tr);
    }
    t.append(tb);
    const close = dialog(
      `Các trạm trên sơ đồ kết dây (${list.length})`,
      el('div', {}, [
        el('p', {
          class: 'muted small',
          text: 'Bấm một dòng để phóng tới trạm đó ngay trên tờ sơ đồ kết dây (không mở trang riêng).',
        }),
        el('div', { class: 'table-wrap' }, [t]),
      ]),
      [button('Đóng', () => close())],
    );
  }

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
        <li><b>F3</b> bắt điểm · <b>F4</b> hiện điểm đấu nối · <b>F7</b> hiện lưới · <b>F8</b> ORTHO · <b>F9</b> bắt lưới</li>
         <li><b>Shift+M</b> tô sáng cả mạch điện nối thông với đối tượng đang chọn</li>
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
      <h4>Sơ đồ kết dây toàn tỉnh</h4>
      <p>Trang <b>"Sơ đồ kết dây lưới điện tỉnh Thái Nguyên"</b> là nguyên tờ A0 lấy từ bản vẽ
         CAD của Phòng Điều độ: <b>tất cả 25 trạm nằm trên một sơ đồ duy nhất</b>, đầy đủ
         thiết bị các cấp 110 / 35 / 22 / 6kV, giữ nguyên bố trí bản gốc.</p>
      <ul>
        <li>Bấm tên trạm trong bảng <b>Danh mục trạm</b> để phóng tới trạm đó.</li>
        <li>Hoặc <b>Dữ liệu → Danh mục trạm trên sơ đồ kết dây…</b></li>
        <li>Trang <b>"Lưới 220-110kV theo vị trí địa lý"</b> đặt các trạm gần đúng vị trí thật;
            nhấn đúp vào khối trạm ở đó sẽ nhảy sang đúng trạm trên sơ đồ kết dây.</li>
      </ul>

      <h4>Đưa sơ đồ trung áp từ CAD vào</h4>
      <ol>
        <li>Trong CAD mở bản vẽ lộ trung áp, dùng lệnh <b>SAVEAS</b> → chọn <b>AutoCAD ASCII DXF</b>.</li>
        <li>Trong phần mềm chọn <b>Tệp → Nhập từ CAD (.dxf)</b>, đặt bề rộng quy đổi (km) rồi bấm Nhập.</li>
        <li>Phần mềm tự nhận cấp điện áp theo tên lớp và nhận dạng block MC / DCL / TI / TU / CSV / Recloser / MBA.</li>
        <li>Nội dung vừa nhập đang được chọn sẵn — kéo chuột để đặt khớp vào trạm 110kV tương ứng.</li>
      </ol>
      <h4>Khi cập nhật phiên bản mới mà vẫn thấy dữ liệu cũ</h4>
      <p>Phần mềm lưu tạm bản vẽ trong trình duyệt để khôi phục khi mở lại. Bản lưu tạm
         có gắn mã phiên bản, nên khi chép file mới về thì bản cũ tự bị bỏ. Nếu vẫn thấy
         dữ liệu cũ, vào <b>Tệp → Xoá dữ liệu lưu tạm trong trình duyệt</b>, hoặc nhấn
         <b>Ctrl+F5</b>.</p>
      <p class="muted small">Bản vẽ được lưu tạm trong trình duyệt sau mỗi thay đổi. Vẫn nên lưu ra file .sld để giữ lâu dài.
         Phiên bản đang chạy: <b>${BUILD_ID}</b>.</p>
    `;
    const close = dialog('Hướng dẫn sử dụng', body, [button('Đóng', () => close())]);
  }
}
