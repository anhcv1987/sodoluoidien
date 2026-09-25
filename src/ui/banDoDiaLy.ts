import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import gis from '../data/gisLuoi110.json';
import { stationsOf, MA_TO_TONG } from '../data/tramSheets';

/**
 * TRANG "LƯỚI 220-110kV THEO VỊ TRÍ ĐỊA LÝ" - BẢN ĐỒ NỀN + DỮ LIỆU GIS.
 *
 * Dữ liệu trạm và tuyến lấy từ GIS EVNNPC (PA3504 khu vực Thái Nguyên cũ + PA3526
 * khu vực Bắc Kạn cũ) do Phòng Điều độ trích xuất (src/data/gisLuoi110.json): tọa độ
 * trạm và hướng tuyến là vị trí thật trên thực địa.
 *
 * Bản đồ nền tải từ Internet (Google, Esri, Carto) hoặc máy chủ bản đồ nội bộ NPC;
 * nền đang dùng không tải được thì tự chuyển sang nền kế tiếp. Không có mạng thì vẫn
 * xem được trạm và tuyến trên nền trống.
 */

interface Tram {
  ten: string;
  sohieu: string;
  ma: string;
  cap: string;
  lat: number;
  lng: number;
  mva: number | null;
  mvaText?: string;
  nmba: number | null;
  ngoai?: boolean;
  ghichu?: string;
  nut?: string;
}
interface DuongDay {
  ten: string;
  sohieu: string;
  cap: string;
  dai: number;
  dau: string | null;
  cuoi: string | null;
  pts: [number, number][];
}

const DATA = gis as unknown as { nguon: string; tram: Tram[]; duongday: DuongDay[] };
const C220 = '#1d4ed8';
const C110 = '#d11f1f';
const fmt = (n: unknown): string => (n == null || n === '' ? '—' : String(n));

/**
 * Thứ tự trạm giống DANH MỤC TRẠM hiện có của phần mềm (sapXepTram): các trạm trong
 * địa bàn E6.1, E6.2 … E6.25, E26.1 … (so theo số, không theo chữ), nhà máy A6.x;
 * rồi các trạm ngoài địa bàn; cuối cùng là điểm nút.
 */
function thuTu(t: Tram, danhMuc: Map<string, boolean>): [number, number, number, number, string] {
  const ngoai = danhMuc.has(t.ma) ? danhMuc.get(t.ma)! : !!t.ngoai || !t.ma;
  const nhom = t.cap === 'nut' ? 2 : ngoai ? 1 : 0;
  const m = t.ma.match(/^([EA])(\d+)\.(\d+)/);
  return [nhom, m?.[1] === 'A' ? 1 : 0, m ? Number(m[2]) : 9999, m ? Number(m[3]) : 9999, t.ten];
}

export class BanDoDiaLy {
  readonly root = document.createElement('div');
  private map?: L.Map;
  private G!: Record<'t220' | 't110' | 'd220' | 'd110', L.LayerGroup>;
  private items: { tram: { o: Tram; layer: L.Marker | L.CircleMarker }[]; dz: { o: DuongDay; layer: L.Polyline; lab: L.Tooltip }[] } = {
    tram: [],
    dz: [],
  };
  private hl: L.Polyline | null = null;
  private bounds = L.latLngBounds([]);
  private tab: 'tram' | 'dz' = 'tram';
  /** Đã phóng tới một trạm / tuyến cụ thể (không tự phóng toàn cảnh nữa). */
  private daPhong = false;
  private list!: HTMLUListElement;
  private q!: HTMLInputElement;
  private lblT!: HTMLInputElement;
  private lblD!: HTMLInputElement;
  private coord!: HTMLDivElement;
  private mapEl!: HTMLDivElement;
  /** Mã trạm trong danh mục → có phải trạm ngoài địa bàn không. */
  private danhMuc = new Map<string, boolean>();

  /** @param moSoDo bấm "Sơ đồ kết dây" trong khung thông tin trạm -> mở trạm đó trên tờ kết dây. */
  constructor(private moSoDo?: (ma: string) => void) {
    this.root.className = 'bddl';
    this.root.innerHTML = `
      <aside class="bddl-aside">
        <div class="bddl-sec">
          <div class="bddl-tieu-de">Sơ đồ lưới điện 110kV tỉnh Thái Nguyên theo vị trí địa lý</div>
          <div class="bddl-nguon">Nguồn: ${DATA.nguon}</div>
        </div>
        <div class="bddl-sec">
          <h3>Thống kê</h3>
          <div class="bddl-stats">
            <div class="bddl-stat"><b data-n="t220">0</b><span>TBA 220kV</span></div>
            <div class="bddl-stat"><b data-n="t110">0</b><span>TBA 110kV</span></div>
            <div class="bddl-stat"><b data-n="km">0</b><span>km đường dây</span></div>
          </div>
        </div>
        <div class="bddl-sec">
          <h3>Lớp hiển thị</h3>
          <label class="bddl-chk"><input type="checkbox" data-l="t220" checked><span class="bddl-tri" style="border-bottom-color:${C220}"></span> Trạm 220kV</label>
          <label class="bddl-chk"><input type="checkbox" data-l="t110" checked><span class="bddl-tri" style="border-bottom-color:${C110}"></span> Trạm 110kV</label>
          <label class="bddl-chk"><input type="checkbox" data-l="d220" checked><span class="bddl-sw" style="border-color:${C220}"></span> Đường dây 220kV</label>
          <label class="bddl-chk"><input type="checkbox" data-l="d110" checked><span class="bddl-sw" style="border-color:${C110}"></span> Đường dây 110kV</label>
          <label class="bddl-chk"><input type="checkbox" data-o="lblT" checked> Nhãn tên trạm (110kV hiện từ zoom ≥ 11)</label>
          <label class="bddl-chk"><input type="checkbox" data-o="lblD"> Nhãn tên đường dây (zoom ≥ 12)</label>
          <div class="bddl-note">Trạm viền nét đứt: nằm ngoài địa bàn tỉnh (liên kết lưới).</div>
          <button type="button" class="bddl-fit">Toàn cảnh</button>
        </div>
        <div class="bddl-sec">
          <input class="bddl-q" placeholder="Tìm trạm / lộ đường dây (VD: 171E6.2, Lưu Xá)…">
          <div class="bddl-tabs"><button type="button" data-t="tram" class="on">Trạm</button><button type="button" data-t="dz">Đường dây</button></div>
        </div>
        <ul class="bddl-list"></ul>
      </aside>
      <div class="bddl-map"></div>
      <div class="bddl-coord"></div>`;
    this.list = this.root.querySelector('.bddl-list')!;
    this.q = this.root.querySelector('.bddl-q')!;
    this.lblT = this.root.querySelector('[data-o=lblT]')!;
    this.lblD = this.root.querySelector('[data-o=lblD]')!;
    this.coord = this.root.querySelector('.bddl-coord')!;
    this.mapEl = this.root.querySelector('.bddl-map')!;
  }

  /** Hiện bản đồ (khởi tạo lần đầu khi khung đã có kích thước). */
  show(): void {
    this.root.style.display = '';
    if (!this.map) this.khoiTao();
    else this.map.invalidateSize();
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  /** Phóng tới trạm theo mã (E6.2...). Trả về false nếu GIS không có trạm đó. */
  denTram(ma: string): boolean {
    this.show();
    const it = this.items.tram.find((i) => i.o.ma === ma);
    if (!it) return false;
    this.chuyenTab('tram');
    this.focus(it);
    return true;
  }

  private khoiTao(): void {
    for (const st of stationsOf(MA_TO_TONG)) this.danhMuc.set(st.code, !!st.ngoaiTinh);

    const map = L.map(this.mapEl, { zoomControl: true }).setView([21.6, 105.83], 10);
    this.map = map;
    const nen: Record<string, L.Layer> = {
      'Google Maps': L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}', { subdomains: '0123', maxZoom: 20, attribution: '© Google' }),
      'Google vệ tinh': L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&hl=vi&x={x}&y={y}&z={z}', { subdomains: '0123', maxZoom: 20, attribution: '© Google' }),
      'Bản đồ đường (Esri)': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: '© Esri' }),
      'Địa hình (Esri)': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: '© Esri' }),
      'Ảnh vệ tinh (Esri)': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: '© Esri' }),
      'Nền sáng (Carto)': L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '© OSM © CARTO' }),
      'Bản đồ nền NPC (mạng nội bộ)': L.tileLayer('https://mapgis.npc.com.vn/gservices/rest/maps/npc/tile/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© EVNNPC' }),
      'Không nền': L.layerGroup(),
    };
    // Tự chuyển nền nếu nền đang dùng bị chặn / không tải được
    const thuTuNen = ['Google Maps', 'Bản đồ đường (Esri)', 'Nền sáng (Carto)', 'Bản đồ nền NPC (mạng nội bộ)', 'Không nền'];
    let nenHienTai = thuTuNen[0];
    let loiNen = 0;
    let daTaiNen = 0;
    for (const [ten, l] of Object.entries(nen)) {
      if (!(l instanceof L.TileLayer)) continue;
      l.on('tileload', () => {
        if (ten === nenHienTai) daTaiNen++;
      });
      l.on('tileerror', () => {
        if (ten !== nenHienTai || daTaiNen > 0) return;
        if (++loiNen >= 4) {
          const i = thuTuNen.indexOf(ten);
          const k = thuTuNen[Math.min(i + 1, thuTuNen.length - 1)];
          if (k !== ten) {
            map.removeLayer(l);
            nen[k].addTo(map);
          }
        }
      });
    }
    map.on('baselayerchange', (e: L.LayersControlEvent) => {
      nenHienTai = e.name;
      loiNen = 0;
      daTaiNen = 0;
    });
    map.on('layeradd', (e: L.LayerEvent) => {
      const k = Object.keys(nen).find((n) => nen[n] === e.layer);
      if (k) {
        nenHienTai = k;
        loiNen = 0;
        daTaiNen = 0;
      }
    });
    nen[thuTuNen[0]].addTo(map);
    L.control.layers(nen, undefined, { position: 'topright' }).addTo(map);
    L.control.scale({ imperial: false }).addTo(map);

    this.G = {
      t220: L.layerGroup().addTo(map),
      t110: L.layerGroup().addTo(map),
      d220: L.layerGroup().addTo(map),
      d110: L.layerGroup().addTo(map),
    };
    this.napDuLieu();

    // Giao diện
    for (const cb of this.root.querySelectorAll<HTMLInputElement>('[data-l]')) {
      cb.onchange = () => {
        const g = this.G[cb.dataset.l as keyof typeof this.G];
        if (cb.checked) g.addTo(map);
        else map.removeLayer(g);
        this.apNhan();
      };
    }
    // Khung đổi kích thước (lần đầu hiện, ẩn/hiện panel, đổi cỡ cửa sổ) -> đo lại;
    // chưa phóng tới trạm nào thì giữ toàn cảnh.
    new ResizeObserver(() => {
      if (!this.mapEl.clientWidth) return;
      map.invalidateSize();
      if (!this.daPhong && this.bounds.isValid()) map.fitBounds(this.bounds, { padding: [20, 20] });
    }).observe(this.mapEl);
    this.lblT.onchange = () => this.apNhan();
    this.lblD.onchange = () => this.apNhan();
    map.on('zoomend', () => this.apNhan());
    map.on('click', () => {
      if (this.hl) {
        map.removeLayer(this.hl);
        this.hl = null;
      }
    });
    this.q.oninput = () => this.veDanhSach();
    for (const b of this.root.querySelectorAll<HTMLButtonElement>('.bddl-tabs button')) {
      b.onclick = () => this.chuyenTab(b.dataset.t as 'tram' | 'dz');
    }
    this.root.querySelector<HTMLButtonElement>('.bddl-fit')!.onclick = () => {
      if (this.bounds.isValid()) map.fitBounds(this.bounds, { padding: [20, 20] });
    };
    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      this.coord.textContent = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
    });
  }

  private triIcon(color: string, big: boolean, ngoai?: boolean): L.DivIcon {
    const s = big ? 20 : 15;
    const dash = ngoai ? 'stroke-dasharray="3 2"' : '';
    const svg = `<svg width="${s}" height="${s}" viewBox="0 0 20 20"><polygon points="10,1 19,18 1,18" fill="${color}" stroke="${ngoai ? '#333' : '#fff'}" stroke-width="1.8" ${dash}/></svg>`;
    return L.divIcon({ className: 'bddl-ico', html: svg, iconSize: [s, s], iconAnchor: [s / 2, s * 0.62] });
  }

  /** Mã trạm có trên sơ đồ kết dây. */
  coTram(ma: string): boolean {
    return DATA.tram.some((t) => t.ma === ma);
  }

  private popTramEl(t: Tram): HTMLElement {
    const d = document.createElement('div');
    d.innerHTML = this.popTram(t);
    if (this.moSoDo && this.danhMuc.has(t.ma)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bddl-mo';
      b.textContent = `Sơ đồ kết dây ${t.ma}`;
      b.onclick = () => this.moSoDo!(t.ma);
      d.append(b);
    }
    return d;
  }

  private popTram(t: Tram): string {
    const dd = DATA.duongday
      .filter((d) => d.dau === t.ten || d.cuoi === t.ten || (!!t.nut && (d.dau === t.nut || d.cuoi === t.nut) && d.dai > 200))
      .map((d) => d.ten)
      .join('<br>');
    return `<div class="bddl-pop"><h4>${t.ten}</h4><table>
      <tr><td>Mã trạm</td><td>${fmt(t.ma)}</td></tr>
      <tr><td>Số hiệu GIS</td><td>${fmt(t.sohieu)}</td></tr>
      <tr><td>Cấp điện áp</td><td>${t.cap === 'nut' ? '110kV (điểm nút)' : t.cap}</td></tr>
      <tr><td>Số MBA</td><td>${fmt(t.nmba)}</td></tr>
      <tr><td>Tổng công suất</td><td>${t.mvaText ?? (t.mva ? `${t.mva} MVA` : '—')}</td></tr>
      <tr><td>Tọa độ</td><td>${t.lat.toFixed(5)}, ${t.lng.toFixed(5)}</td></tr>
      ${t.ngoai ? '<tr><td>Ghi chú</td><td>Ngoài địa bàn tỉnh</td></tr>' : ''}
      ${t.ghichu ? `<tr><td>Ghi chú</td><td>${t.ghichu}</td></tr>` : ''}
      <tr><td>Đường dây đấu nối</td><td>${dd || '—'}</td></tr>
      </table></div>`;
  }

  private popDZ(d: DuongDay): string {
    return `<div class="bddl-pop"><h4>ĐZ ${d.ten}</h4><table>
      <tr><td>Mã/số hiệu</td><td>${fmt(d.sohieu)}</td></tr>
      <tr><td>Cấp điện áp</td><td>${d.cap}</td></tr>
      <tr><td>Chiều dài (GIS)</td><td>${(d.dai / 1000).toFixed(2)} km</td></tr>
      <tr><td>Đầu</td><td>${fmt(d.dau)}</td></tr>
      <tr><td>Cuối</td><td>${fmt(d.cuoi)}</td></tr>
      </table></div>`;
  }

  private napDuLieu(): void {
    const map = this.map!;
    for (const d of DATA.duongday) {
      const is220 = d.cap === '220kV';
      const w = is220 ? 4 : 3;
      const pl = L.polyline(d.pts, { color: is220 ? C220 : C110, weight: w, opacity: 0.9 });
      pl.bindPopup(() => this.popDZ(d));
      pl.bindTooltip(d.ten, { sticky: true });
      pl.on('mouseover', () => pl.setStyle({ weight: w + 3 })).on('mouseout', () => pl.setStyle({ weight: w }));
      const mid = d.pts[Math.floor(d.pts.length / 2)];
      const lab = L.tooltip({ permanent: true, direction: 'center', className: 'bddl-lbl-line' }).setLatLng(mid).setContent(d.ten);
      (is220 ? this.G.d220 : this.G.d110).addLayer(pl);
      this.items.dz.push({ o: d, layer: pl, lab });
      for (const p of d.pts) this.bounds.extend(p);
    }
    for (const t of DATA.tram) {
      const is220 = t.cap.startsWith('220');
      let m: L.Marker | L.CircleMarker;
      if (t.cap === 'nut') {
        m = L.circleMarker([t.lat, t.lng], { radius: 5, color: '#333', weight: 2, fillColor: '#fff', fillOpacity: 1 });
        m.bindTooltip('N1', { permanent: true, direction: 'right', offset: [6, 0], className: 'bddl-lbl' });
        this.G.t110.addLayer(m);
      } else {
        m = L.marker([t.lat, t.lng], { icon: this.triIcon(is220 ? C220 : C110, is220, t.ngoai), zIndexOffset: is220 ? 1000 : 500 });
        const ten = t.ten.replace(/^(TBA|Trạm) /, '');
        m.bindTooltip(t.ma && !ten.includes(t.ma) ? `${ten} (${t.ma})` : ten, {
          permanent: true,
          direction: 'right',
          offset: [8, 0],
          className: 'bddl-lbl',
        });
        (is220 ? this.G.t220 : this.G.t110).addLayer(m);
      }
      m.bindPopup(() => this.popTramEl(t));
      this.items.tram.push({ o: t, layer: m });
      this.bounds.extend([t.lat, t.lng]);
    }
    // danh sách trạm theo đúng thứ tự danh mục trạm hiện có
    this.items.tram.sort((a, b) => {
      const x = thuTu(a.o, this.danhMuc);
      const y = thuTu(b.o, this.danhMuc);
      return x[0] - y[0] || x[1] - y[1] || x[2] - y[2] || x[3] - y[3] || x[4].localeCompare(y[4], 'vi');
    });
    if (this.bounds.isValid()) map.fitBounds(this.bounds, { padding: [20, 20] });
    const set = (k: string, v: string | number): void => {
      this.root.querySelector(`[data-n=${k}]`)!.textContent = String(v);
    };
    set('t220', DATA.tram.filter((t) => t.cap.startsWith('220')).length);
    set('t110', DATA.tram.filter((t) => t.cap !== 'nut' && !t.cap.startsWith('220')).length);
    set('km', (DATA.duongday.reduce((a, d) => a + d.dai, 0) / 1000).toFixed(1));
    this.apNhan();
    this.veDanhSach();
  }

  private apNhan(): void {
    const map = this.map!;
    const z = map.getZoom();
    const showT = this.lblT.checked;
    for (const i of this.items.tram) {
      const on = showT && (i.o.cap.startsWith('220') || z >= 11);
      if (on) i.layer.openTooltip();
      else i.layer.closeTooltip();
    }
    const showD = this.lblD.checked && z >= 12;
    for (const i of this.items.dz) {
      const grp = i.o.cap === '220kV' ? this.G.d220 : this.G.d110;
      if (showD && map.hasLayer(grp)) i.lab.addTo(map);
      else map.removeLayer(i.lab);
    }
  }

  private chuyenTab(t: 'tram' | 'dz'): void {
    this.tab = t;
    for (const b of this.root.querySelectorAll<HTMLButtonElement>('.bddl-tabs button')) b.classList.toggle('on', b.dataset.t === t);
    this.veDanhSach();
  }

  private veDanhSach(): void {
    const q = this.q.value.trim().toLowerCase();
    this.list.replaceChildren();
    const loc = (o: { ten: string; sohieu: string; ma?: string }): boolean =>
      `${o.ten} ${o.sohieu || ''} ${o.ma || ''}`.toLowerCase().includes(q);
    if (this.tab === 'tram') {
      for (const i of this.items.tram.filter((x) => loc(x.o))) {
        const li = document.createElement('li');
        const o = i.o;
        li.innerHTML = `${o.ma ? `<b class="bddl-ma" style="color:${o.cap.startsWith('220') ? C220 : C110}">${o.ma}</b> ` : ''}${o.ten}<small>${
          o.cap === 'nut' ? 'Điểm nút' : o.cap
        } · ${fmt(o.sohieu)}${o.mva ? ` · ${o.mva} MVA` : ''}${thuTu(o, this.danhMuc)[0] === 1 ? ' · ngoài địa bàn' : ''}</small>`;
        li.onclick = () => this.focus(i);
        this.list.append(li);
      }
    } else {
      for (const i of this.items.dz.filter((x) => loc(x.o)).sort((a, b) => a.o.ten.localeCompare(b.o.ten, 'vi'))) {
        const li = document.createElement('li');
        const o = i.o;
        li.innerHTML = `${o.ten}<small>${o.cap} · ${(o.dai / 1000).toFixed(2)} km · ${fmt(o.dau)} → ${fmt(o.cuoi)}</small>`;
        li.onclick = () => this.focus(i);
        this.list.append(li);
      }
    }
    if (!this.list.children.length) this.list.innerHTML = '<li class="bddl-note">Không có dữ liệu</li>';
  }

  private focus(i: { o: Tram; layer: L.Marker | L.CircleMarker } | { o: DuongDay; layer: L.Polyline }): void {
    const map = this.map!;
    this.daPhong = true;
    map.invalidateSize();
    if (this.hl) {
      map.removeLayer(this.hl);
      this.hl = null;
    }
    if (i.layer instanceof L.Polyline && 'pts' in i.o) {
      map.fitBounds(i.layer.getBounds(), { padding: [40, 40] });
      this.hl = L.polyline(i.o.pts, { color: '#f59e0b', weight: 10, opacity: 0.45, interactive: false }).addTo(map);
      i.layer.bringToFront();
      const mid = i.o.pts[Math.floor(i.o.pts.length / 2)];
      setTimeout(() => i.layer.openPopup(L.latLng(mid)), 250);
    } else {
      const layer = i.layer as L.Marker | L.CircleMarker;
      map.setView(layer.getLatLng(), 14);
      setTimeout(() => layer.openPopup(), 250);
    }
  }
}
