import raw from './tram-sld.json';
import { newId } from '../core/doc';
import type {
  BranchEntity,
  CircleEntity,
  DeviceEntity,
  Entity,
  Id,
  LineKind,
  Sheet,
  SwitchState,
  TextEntity,
  VoltageKv,
} from '../core/types';

/**
 * SƠ ĐỒ NGUYÊN LÝ TỪNG TRẠM, TRÍCH TỪ FILE CAD CỦA PHÒNG ĐIỀU ĐỘ.
 *
 * Dữ liệu trong `tram-sld.json` do tools/tach-so-do-tram.py +
 * tools/dung-du-lieu-tram.mjs dựng ra từ file
 * "Sơ đồ lưới điện liên thông tỉnh Thái Nguyên.dwg", dùng đúng bộ nhập DXF của
 * phần mềm nên hình học, cấp điện áp và ký hiệu thiết bị giống hệt bản CAD gốc.
 *
 * Dữ liệu lưu ở dạng NÉN (bảng tra tên lớp / tên block + mảng số) và chỉ được
 * "bung" ra thành đối tượng bản vẽ khi người dùng thực sự mở tờ đó, để phần mềm
 * khởi động nhanh và không tốn bộ nhớ cho 27 tờ cùng lúc.
 *
 * Toạ độ giữ nguyên đơn vị của bản vẽ CAD gốc (1 đơn vị phần mềm = 1 đơn vị CAD),
 * tâm mỗi tờ được đưa về gốc toạ độ.
 */

interface CompactSheet {
  code: string;
  title: string;
  /** Tuyến: [lớp, kV, loại tuyến, lớp CAD gốc, x0,y0, x1,y1, ...] */
  b: number[][];
  /** Thiết bị: [lớp, kV, block, x, y, góc, cỡ, trạng thái, lớp CAD gốc, lật gương] */
  d: number[][];
  /** Chữ: [lớp, kV, x, y, cao, góc, căn lề, lớp CAD gốc, nội dung] */
  t: (number | string)[][];
  /** Hình tròn: [lớp, kV, x, y, bán kính, lớp CAD gốc] */
  c?: number[][];
  /** Trạm trong tờ tổng: [mã, tiêu đề, x, y, x0, y0, x1, y1] */
  st?: (number | string)[][];
}

interface CompactData {
  version: number;
  lineKinds: LineKind[];
  states: SwitchState[];
  aligns: ('left' | 'center' | 'right')[];
  layers: string[];
  blocks: string[];
  srcLayers: string[];
  sheets: CompactSheet[];
}

const data = raw as unknown as CompactData;

export interface CadSheetInfo {
  /** Mã trạm (E6.5) hoặc "TỜn" với các tờ bản vẽ khác. */
  code: string;
  /** Tiêu đề như ghi trên bản vẽ CAD. */
  title: string;
  soTuyen: number;
  soThietBi: number;
  soChu: number;
  soHinhTron: number;
  /** Là sơ đồ một trạm cụ thể (mã dạng E6.x / E26.x). */
  laTram: boolean;
}

function info(s: CompactSheet): CadSheetInfo {
  return {
    code: s.code,
    title: s.title,
    soTuyen: s.b.length,
    soThietBi: s.d.length,
    soChu: s.t.length,
    soHinhTron: s.c?.length ?? 0,
    laTram: /^[EA]\d+\.\d+/.test(s.code),
  };
}

/** Danh sách các tờ sơ đồ có sẵn trong phần mềm. */
export function listCadSheets(): CadSheetInfo[] {
  return data.sheets.map(info);
}

export function cadSheetInfo(code: string): CadSheetInfo | undefined {
  const s = data.sheets.find((x) => x.code === code);
  return s ? info(s) : undefined;
}

/** Tên trang hiển thị trên thanh thẻ. */
export function cadSheetName(code: string, tenTram?: string): string {
  if (/^[EA]\d+\.\d+/.test(code)) return tenTram ? `${code} - ${tenTram}` : code;
  const s = data.sheets.find((x) => x.code === code);
  return s ? s.title : code;
}

/**
 * Bung một tờ sơ đồ ra thành trang bản vẽ đầy đủ.
 * Trả về undefined nếu không có tờ đó trong dữ liệu kèm theo.
 */
export function buildCadSheet(code: string, name: string, substationId?: Id): Sheet | undefined {
  const s = data.sheets.find((x) => x.code === code);
  if (!s) return undefined;

  const entities: Record<Id, Entity> = {};
  const put = (e: Entity): void => void (entities[e.id] = e);

  for (const row of s.b) {
    const layer = data.layers[row[0]] ?? '0';
    const kv = row[1] as VoltageKv;
    const lineKind = data.lineKinds[row[2]] ?? 'ĐDK';
    const srcLayer = data.srcLayers[row[3]] || undefined;
    const nodes: Id[] = [];
    for (let i = 4; i + 1 < row.length; i += 2) {
      const id = newId('n');
      nodes.push(id);
      put({
        id,
        kind: 'node',
        layer,
        kv,
        p: { x: row[i], y: row[i + 1] },
        nodeType: i === 4 || i + 3 >= row.length ? 'dau-cuoi' : 'cot',
      });
    }
    if (nodes.length < 2) continue;
    const b: BranchEntity = { id: newId('b'), kind: 'branch', layer, kv, nodes, lineKind };
    if (srcLayer) b.srcLayer = srcLayer;
    // Đường dây nối giữa các trạm chỉ đấu ở hai đầu; chỗ cắt nhau là giao chéo.
    if (srcLayer === 'Kết lưới 110kV') b.khongNoiGiua = true;
    put(b);
  }

  for (const row of s.d) {
    const d: DeviceEntity = {
      id: newId('d'),
      kind: 'device',
      layer: data.layers[row[0]] ?? '0',
      kv: row[1] as VoltageKv,
      block: data.blocks[row[2]] ?? 'MC',
      p: { x: row[3], y: row[4] },
      rot: row[5],
      scale: row[6],
      state: data.states[row[7]] ?? 'dong',
    };
    const sl = data.srcLayers[row[8]];
    if (sl) d.srcLayer = sl;
    if (row[9]) d.mirror = true;
    put(d);
  }

  for (const row of s.c ?? []) {
    const ce: CircleEntity = {
      id: newId('c'),
      kind: 'circle',
      layer: data.layers[row[0]] ?? '0',
      kv: row[1] as VoltageKv,
      c: { x: row[2], y: row[3] },
      r: row[4],
    };
    const sl3 = data.srcLayers[row[5]];
    if (sl3) ce.srcLayer = sl3;
    put(ce);
  }

  for (const row of s.t) {
    const t: TextEntity = {
      id: newId('t'),
      kind: 'text',
      layer: (data.layers[row[0] as number] ?? 'Ghi chú') as string,
      kv: row[1] as VoltageKv,
      p: { x: row[2] as number, y: row[3] as number },
      text: String(row[8]),
      height: row[4] as number,
      rot: row[5] as number,
      align: data.aligns[row[6] as number] ?? 'left',
    };
    const sl2 = data.srcLayers[row[7] as number];
    if (sl2) t.srcLayer = sl2;
    put(t);
  }

  const sheet: Sheet = {
    id: newId('sh'),
    name,
    type: /^[EA]\d+\.\d+/.test(code) ? 'tram' : 'trung-ap',
    entities,
  };
  if (substationId) sheet.substationId = substationId;
  return sheet;
}

/** Một trạm nằm trong tờ sơ đồ tổng. */
export interface CadStation {
  code: string;
  title: string;
  /** Vị trí tiêu đề trạm trên tờ tổng. */
  x: number;
  y: number;
  /** Phạm vi bản vẽ của trạm trên tờ tổng (để phóng tới vừa khít). */
  box?: { minX: number; minY: number; maxX: number; maxY: number };
}

/**
 * SỬA MÃ / TÊN TRẠM cho đúng danh mục của Phòng Điều độ.
 *
 * Tiêu đề trong file CAD có chỗ ghi thiếu, ghi lẫn ký tự thừa, hoặc đánh mã không
 * đúng (trạm 220kV Lưu Xá ghi là E6.20 trong khi danh mục là E6.15).
 */
const SUA_TRAM: Record<string, { ma?: string; ten: string }> = {
  'E6.2': { ten: 'Trạm 220kV Thái Nguyên' },
  'E6.20': { ma: 'E6.15', ten: 'Trạm 220kV Lưu Xá' },
  'E6.16': { ten: 'Trạm 220kV Phú Bình' },
  'E6.25': { ten: 'Trạm 220kV Phú Bình 2' },
};

/**
 * Thứ tự danh mục: E6.2, E6.3 … E6.25 rồi mới tới E26.1, E26.2, E26.3.
 * So theo SỐ chứ không so theo chữ, nếu không E6.10 sẽ đứng trước E6.2.
 */
function thuTuTram(ma: string): [number, number, string] {
  const m = ma.match(/^E(\d+)\.(\d+)/i);
  if (!m) return [9999, 9999, ma];
  return [Number(m[1]), Number(m[2]), ma];
}

export function sapXepTram<T extends { code: string }>(ds: T[]): T[] {
  return [...ds].sort((a, b) => {
    const x = thuTuTram(a.code);
    const y = thuTuTram(b.code);
    return x[0] - y[0] || x[1] - y[1] || x[2].localeCompare(y[2]);
  });
}

/** Danh sách trạm nằm trong một tờ (chỉ tờ tổng mới có). */
export function stationsOf(code: string): CadStation[] {
  const s = data.sheets.find((x) => x.code === code);
  if (!s?.st) return [];
  return sapXepTram(s.st.map((r) => {
    const ma0 = String(r[0]);
    const sua = SUA_TRAM[ma0];
    const st: CadStation = {
      code: sua?.ma ?? ma0,
      title: sua?.ten ?? String(r[1]).replace(/^[^A-ZĐ]*(?=[A-ZĐ])/u, '').trim(),
      x: r[2] as number,
      y: r[3] as number,
    };
    if (r.length >= 8) {
      st.box = {
        minX: r[4] as number,
        minY: r[5] as number,
        maxX: r[6] as number,
        maxY: r[7] as number,
      };
    }
    return st;
  }));
}

/** Mã tờ sơ đồ tổng (tất cả các trạm trên một tờ khổ A0). */
export const MA_TO_TONG = 'TONG';

/** Các lớp (layer) mà dữ liệu CAD kèm theo sử dụng — để tạo sẵn trong bản vẽ. */
export function cadLayerNames(): string[] {
  return [...data.layers];
}
