import { DocStore, defaultLayers, newId } from '../core/doc';
import type { Drawing, Sheet, SubstationEntity, TransformerInfo, VoltageKv } from '../core/types';
import { FILE_VERSION } from '../core/types';
import { layerOf } from '../core/voltage';
import { DIA_DANH, HO_BA_BE, HO_NUI_COC, RANH_GIOI_TINH, project } from './geo';
import { DUONG_DAY, TRAM_220_110, type TramData } from './grid110';
import { dist, norm, sub } from '../core/geom';
import { MA_TO_TONG, buildCadSheet, cadLayerNames, cadSheetInfo } from './tramSheets';
import { taoKhungA0 } from './khungA0';
import { declutterSubstations } from '../editor/declutter';

/** Tach chuoi cong suat kieu "2x40 MVA" thanh danh sach may bien ap. */
function parseMba(s: string, kvList: VoltageKv[]): TransformerInfo[] {
  if (!s.trim()) return [];
  const ratio = kvList.join('/') + ' kV';
  const m = s.match(/^(\d+)\s*x\s*(\d+)\s*MVA/i);
  if (m) {
    const n = Number(m[1]);
    return Array.from({ length: n }, (_, i) => ({
      name: `T${i + 1}`,
      capacity: `${m[2]} MVA`,
      ratio,
    }));
  }
  return [{ name: 'T1', capacity: s.trim(), ratio }];
}

/** Cap dien ap cao nhat cua tram - quyet dinh mau khoi tram. */
function topKv(t: TramData): VoltageKv {
  return (t.levels[0] ?? 110) as VoltageKv;
}

/**
 * Dung so do luoi dien tinh tu du lieu trong src/data.
 * Toan bo doi tuong tao ra deu sua duoc binh thuong trong phan mem.
 */
export function buildProvinceDrawing(): Drawing {
  const sheet: Sheet = {
    id: newId('sh'),
    name: 'Lưới 220-110kV toàn tỉnh',
    type: 'tinh',
    entities: {},
  };
  const now = new Date().toISOString();
  const drawing: Drawing = {
    version: FILE_VERSION,
    title: 'Sơ đồ nguyên lý một sợi lưới điện tỉnh Thái Nguyên',
    org: 'Phòng Điều độ - Công ty Điện lực Thái Nguyên',
    createdAt: now,
    updatedAt: now,
    layers: defaultLayers(),
    sheets: [sheet],
    activeSheet: sheet.id,
  };
  drawing.layers['Địa danh'] = { name: 'Địa danh', color: '#6b7684', visible: true, locked: false };

  const store = new DocStore(drawing);

  store.transact('Khởi tạo sơ đồ tỉnh', () => {
    /* ---------------------- nen ban do ---------------------- */
    store.put({
      id: newId('bd'),
      kind: 'boundary',
      layer: 'Nền bản đồ',
      kv: 0.4,
      pts: RANH_GIOI_TINH.map(([lat, lon]) => project(lat, lon)),
      closed: true,
      name: 'Ranh giới tỉnh Thái Nguyên (sau sáp nhập)',
      note: 'Đường bao sơ họa - chỉ dùng để định hướng vị trí',
    });
    for (const [ten, pts] of [
      ['Hồ Núi Cốc', HO_NUI_COC],
      ['Hồ Ba Bể', HO_BA_BE],
    ] as [string, [number, number][]][]) {
      store.put({
        id: newId('bd'),
        kind: 'boundary',
        layer: 'Nền bản đồ',
        kv: 0.4,
        pts: pts.map(([lat, lon]) => project(lat, lon)),
        closed: true,
        name: ten,
      });
    }
    for (const d of DIA_DANH) {
      const p = project(d.lat, d.lon);
      store.put({
        id: newId('t'),
        kind: 'text',
        layer: 'Địa danh',
        kv: 0.4,
        p: { x: p.x, y: p.y - (d.cap === 1 ? 2.2 : 1.8) },
        text: d.ten,
        height: d.cap === 1 ? 1.9 : 1.5,
        rot: 0,
        align: 'center',
      });
    }

    /* ------------------------ cac tram ---------------------- */
    const byCode = new Map<string, SubstationEntity>();
    for (const t of TRAM_220_110) {
      const p = project(t.lat, t.lon);
      const kv = topKv(t);
      const big = kv >= 220;
      const s: SubstationEntity = {
        id: newId('s'),
        kind: 'substation',
        layer: layerOf(kv),
        kv,
        name: t.name,
        code: t.code,
        p,
        lat: t.lat,
        lon: t.lon,
        commune: t.khuVuc,
        levels: t.levels,
        transformers: parseMba(t.mba, t.levels),
        w: big ? 4.6 : 3.8,
        h: big ? 2.8 : 2.3,
        owner: t.loai,
        note:
          t.viTri === 'Ước lượng'
            ? 'Vị trí ước lượng theo địa danh - cần rà soát lại toạ độ thực tế'
            : undefined,
      };
      store.put(s);
      byCode.set(t.code, s);
    }

    /* ---------------------- duong day ----------------------- */
    for (const d of DUONG_DAY) {
      const a = byCode.get(d.a);
      const b = byCode.get(d.b);
      if (!a || !b) continue;
      // Rut ngan hai dau de duong day khong dam xuyen qua khoi tram
      const v = norm(sub(b.p, a.p));
      const L = dist(a.p, b.p);
      if (L < 0.05) continue;
      // Voi cac tram rat gan nhau (KCN Yen Binh, Luu Xa...) van phai ve duoc
      // duong day -> chi rut ngan toi da 35% chieu dai moi dau.
      const ra = Math.min(Math.max(a.w, a.h) / 2 + 0.2, L * 0.35);
      const rb = Math.min(Math.max(b.w, b.h) / 2 + 0.2, L * 0.35);
      const p1 = { x: a.p.x + v.x * ra, y: a.p.y + v.y * ra };
      const p2 = { x: b.p.x - v.x * rb, y: b.p.y - v.y * rb };
      const n1 = {
        id: newId('n'),
        kind: 'node' as const,
        layer: layerOf(d.kv),
        kv: d.kv,
        p: p1,
        nodeType: 'dau-cuoi' as const,
        substationId: a.id,
      };
      const n2 = {
        id: newId('n'),
        kind: 'node' as const,
        layer: layerOf(d.kv),
        kv: d.kv,
        p: p2,
        nodeType: 'dau-cuoi' as const,
        substationId: b.id,
      };
      store.put(n1);
      store.put(n2);
      store.put({
        id: newId('b'),
        kind: 'branch',
        layer: layerOf(d.kv),
        kv: d.kv,
        nodes: [n1.id, n2.id],
        lineKind: 'ĐDK',
        conductor: { code: d.day, circuits: d.mach },
        lengthKm: d.km,
        label: `${d.a} - ${d.b}${d.mach > 1 ? ` (${d.mach} mạch)` : ''}`,
        note: d.nguon === 'Sơ bộ - cần rà soát' ? 'Kết lưới sơ bộ - cần rà soát' : undefined,
      });
    }

    /* ------------------------ khung ten --------------------- */
    const p = project(22.62, 105.95);
    store.put({
      id: newId('t'),
      kind: 'text',
      layer: 'Ghi chú',
      kv: 0.4,
      p,
      text: 'SƠ ĐỒ NGUYÊN LÝ MỘT SỢI LƯỚI ĐIỆN TỈNH THÁI NGUYÊN',
      height: 3.2,
      rot: 0,
      align: 'left',
    });
    store.put({
      id: newId('t'),
      kind: 'text',
      layer: 'Ghi chú',
      kv: 0.4,
      p: { x: p.x, y: p.y - 4 },
      text: 'Quy ước màu: 110kV - ĐỎ,  35kV - VÀNG,  22kV - XANH',
      height: 2.2,
      rot: 0,
      align: 'left',
    });
  });
  store.clearHistory();
  return drawing;
}

/**
 * Ban ve mac dinh khi mo phan mem lan dau:
 *   Trang 1 - SO DO KET DAY toan tinh (kho A0): tat ca cac tram tren MOT to,
 *             giu nguyen bo cuc cua ban ve CAD do Phong Dieu do lap.
 *   Trang 2 - So do 220-110kV dat theo vi tri dia ly (de hinh dung khong gian).
 */
export function buildDefaultDrawing(): Drawing {
  const d = buildProvinceDrawing();
  d.sheets[0].name = 'Lưới 220-110kV theo vị trí địa lý';
  // Giãn sẵn các trạm nằm sát nhau để không khối nào đè lên khối nào
  const store0 = new DocStore(d);
  declutterSubstations(store0, 1200, 18);
  store0.clearHistory();

  const info = cadSheetInfo(MA_TO_TONG);
  const tong = buildCadSheet(MA_TO_TONG, 'Sơ đồ kết dây lưới điện tỉnh Thái Nguyên');
  if (tong && info) {
    tong.cadCode = MA_TO_TONG;
    for (const l of cadLayerNames()) {
      if (!d.layers[l]) d.layers[l] = { name: l, visible: true, locked: false };
    }

    // Khung bản vẽ khổ A0 + khung tên bao quanh sơ đồ
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const e of Object.values(tong.entities)) {
      const ps =
        e.kind === 'node' || e.kind === 'device' || e.kind === 'text'
          ? [e.p]
          : e.kind === 'circle'
            ? [
                { x: e.c.x - e.r, y: e.c.y - e.r },
                { x: e.c.x + e.r, y: e.c.y + e.r },
              ]
            : [];
      for (const p of ps) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
    }
    if (isFinite(minX)) {
      d.layers['Khung bản vẽ'] = {
        name: 'Khung bản vẽ',
        color: '#cfd6e0',
        visible: true,
        locked: false,
        lineWidth: 1.4,
      };
      const today = new Date();
      const ngay = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
      for (const e of taoKhungA0(
        { minX, minY, maxX, maxY },
        {
          tenBanVe: 'SƠ ĐỒ KẾT DÂY LƯỚI ĐIỆN TỈNH THÁI NGUYÊN',
          donVi: 'TỔNG CÔNG TY ĐIỆN LỰC MIỀN BẮC - CÔNG TY ĐIỆN LỰC THÁI NGUYÊN',
          phong: 'PHÒNG ĐIỀU ĐỘ',
          ngay,
        },
      )) {
        tong.entities[e.id] = e;
      }
    }

    d.sheets.unshift(tong);
    d.activeSheet = tong.id;
  }
  return d;
}

/**
 * Tao trang ban ve rong gan voi mot tram:
 *  - type 'tram'      : so do nguyen ly trong tram,
 *  - type 'trung-ap'  : luoi trung ap xuat tuyen tu tram do (giai doan 2).
 */
export function createSubstationSheet(
  store: DocStore,
  sub: SubstationEntity,
  type: 'tram' | 'trung-ap' = 'tram',
): Sheet {
  const sheet: Sheet = {
    id: newId('sh'),
    name: type === 'tram' ? `${sub.code} - ${sub.name}` : `Trung áp ${sub.code}`,
    type,
    entities: {},
    substationId: sub.id,
  };
  store.addSheet(sheet);
  return sheet;
}
