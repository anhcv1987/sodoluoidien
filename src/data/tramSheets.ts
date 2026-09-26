import raw from './tram-sld.json';
import { newId } from '../core/doc';
import { doiChuKhoiThietBi, type KetQuaDoiChu } from '../core/doiChu';
import { allStyles, styleOf } from '../core/voltage';
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
  /** Trạm trong tờ tổng: [mã, tiêu đề, x, y, x0, y0, x1, y1, ngoài tỉnh (0/1)] */
  st?: (number | string)[][];
  /** Thanh cái đường vòng (C19, C29…): đỉnh đầu [x0, y0] của từng thanh cái. */
  vong?: number[][];
  /** Điểm đầu các vòng nhảy giao chéo của lưới trung áp: nét chỉ đấu ở hai đầu. */
  nhay?: number[][];
  /** Máy biến áp (block): [x, y, kV cuộn cao áp, kV cuộn phải, kV cuộn dưới]. */
  kvCuon?: number[][];
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

/** Kết quả dời nhãn ra khỏi ký hiệu thiết bị của từng tờ đã bung (để kiểm tra). */
export const ketQuaDoiChu = new Map<string, KetQuaDoiChu>();

/**
 * Bung một tờ sơ đồ ra thành trang bản vẽ đầy đủ.
 * Trả về undefined nếu không có tờ đó trong dữ liệu kèm theo.
 */
export function buildCadSheet(code: string, name: string, substationId?: Id): Sheet | undefined {
  const s = data.sheets.find((x) => x.code === code);
  if (!s) return undefined;

  const entities: Record<Id, Entity> = {};
  const put = (e: Entity): void => void (entities[e.id] = e);
  // thanh cái đường vòng: ghi theo đỉnh đầu (tools/phuong-thuc-van-hanh.mjs)
  const vong = new Set((s.vong ?? []).map(([x, y]) => `${x}|${y}`));
  const nhay = new Set((s.nhay ?? []).map(([x, y]) => `${x}|${y}`));
  const kvCuon = new Map((s.kvCuon ?? []).map(([x, y, ...kv]) => [`${x}|${y}`, kv as VoltageKv[]]));

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
    if (srcLayer === 'Kết lưới 110kV' || nhay.has(`${row[4]}|${row[5]}`)) b.khongNoiGiua = true;
    if (vong.has(`${row[4]}|${row[5]}`)) b.vong = true;
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
    const kc = kvCuon.get(`${row[3]}|${row[4]}`);
    if (kc) d.kvCuon = kc;
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

  // Tờ tổng: phần nằm ngoài ô các trạm (đường dây, lưới trung áp) sang lớp "Đường dây xxkV"
  // để bật/tắt riêng từng cấp điện áp mà không ẩn sơ đồ trong trạm.
  if (code === MA_TO_TONG) tachLopDuongDay(entities, s.st ?? []);

  // Nhãn nằm đè lên ký hiệu thiết bị thì dời ra chỗ thoáng gần nhất.
  ketQuaDoiChu.set(code, doiChuKhoiThietBi(entities));

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
  /** Trạm ngoài địa bàn PCTN (220kV Bắc Kạn, 220kV Sóc Sơn...) - xếp cuối danh mục. */
  ngoaiTinh?: boolean;
}

/**
 * SỬA TÊN TRẠM cho đúng danh mục của Phòng Điều độ.
 *
 * Tiêu đề trong file CAD có chỗ ghi thiếu hoặc ghi lẫn ký tự thừa; mã trạm thì
 * giữ nguyên như Phòng Điều độ đánh (trạm 220kV Lưu Xá là E6.20).
 */
const SUA_TRAM: Record<string, { ma?: string; ten: string }> = {
  'E6.2': { ten: 'Trạm 220kV Thái Nguyên' },
  'E6.4': { ten: 'Trạm 110kV Thịnh Đán' },
  'E6.20': { ten: 'Trạm 220kV Lưu Xá' },
  'E6.16': { ten: 'Trạm 220kV Phú Bình' },
  'E6.25': { ten: 'Trạm 220kV Phú Bình 2' },
  // Trạm 220kV ngoài địa bàn (do tools/noi-duong-day-110.mjs thêm vào danh mục)
  'E26.5': { ten: 'Trạm 220kV Bắc Kạn' },
  'E16.2': { ten: 'Trạm 220kV Cao Bằng' },
  'E1.19': { ten: 'Trạm 220kV Sóc Sơn' },
  'E14.1': { ten: 'Trạm 220kV Tuyên Quang' },
};

/**
 * Thứ tự danh mục: E6.2, E6.3 … E6.25 rồi mới tới E26.1, E26.2, E26.3; các trạm
 * ngoài địa bàn xếp cuối. So theo SỐ chứ không so theo chữ, nếu không E6.10 sẽ
 * đứng trước E6.2.
 */
function thuTuTram(ma: string): [number, number, string] {
  const m = ma.match(/^E(\d+)\.(\d+)/i);
  if (!m) return [9999, 9999, ma];
  return [Number(m[1]), Number(m[2]), ma];
}

export function sapXepTram<T extends { code: string; ngoaiTinh?: boolean }>(ds: T[]): T[] {
  return [...ds].sort((a, b) => {
    const x = thuTuTram(a.code);
    const y = thuTuTram(b.code);
    return (
      Number(!!a.ngoaiTinh) - Number(!!b.ngoaiTinh) ||
      x[0] - y[0] ||
      x[1] - y[1] ||
      x[2].localeCompare(y[2])
    );
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
    if (r[8]) st.ngoaiTinh = true;
    return st;
  }));
}

/** Mã tờ sơ đồ tổng (tất cả các trạm trên một tờ khổ A0). */
export const MA_TO_TONG = 'TONG';

/** Tên lớp đường dây theo cấp điện áp: "Đường dây 22kV". */
export const lopDuongDay = (kv: VoltageKv): string => `Đường dây ${styleOf(kv).name}`;
/** Các lớp đường dây trên tờ tổng (cấp cao xuống thấp). */
export const LOP_DUONG_DAY = allStyles().map((st) => lopDuongDay(st.kv));

/** Nguồn nét (lớp CAD) luôn thuộc đường dây dù nằm trong ô trạm (cáp nối ngăn lộ đi ra). */
const NGUON_DUONG_DAY = new Set(['Lưới trung áp', 'Kết lưới 110kV']);
/** Trạm ngoài tỉnh do công cụ vẽ thêm: là trạm, không phải đường dây. */
const NGUON_TRAM = new Set(['Trạm ngoài tỉnh']);

/**
 * Chuyển các đối tượng nằm ngoài ô trạm sang lớp "Đường dây xxkV":
 *  - nét, thiết bị, chữ của lưới trung áp và kết lưới 110kV (kể cả đoạn cáp nằm trong ô trạm);
 *  - các đối tượng khác thuộc lớp cấp điện áp nằm hẳn ngoài mọi ô trạm.
 * Chữ lớp "Ghi chú" chỉ chuyển khi là chữ của lưới trung áp / kết lưới.
 */
function tachLopDuongDay(entities: Record<Id, Entity>, st: unknown[][]): void {
  const hop = st.filter((r) => r.length >= 8).map((r) => [r[4], r[5], r[6], r[7]] as number[]);
  const trong = (x: number, y: number): boolean =>
    hop.some((b) => x >= b[0] - 0.01 && x <= b[2] + 0.01 && y >= b[1] - 0.01 && y <= b[3] + 0.01);
  const lopCap = new Set(allStyles().map((x) => x.layer));
  const doi = (e: Entity, ps: { x: number; y: number }[]): boolean => {
    const sl = 'srcLayer' in e ? e.srcLayer : undefined;
    if (sl && NGUON_TRAM.has(sl)) return false;
    if (sl && NGUON_DUONG_DAY.has(sl)) return true;
    if (!lopCap.has(e.layer)) return false;
    return ps.length > 0 && !ps.every((p) => trong(p.x, p.y));
  };
  for (const e of Object.values(entities)) {
    if (e.kind === 'branch') {
      const ps = e.nodes.map((id) => entities[id]).filter((n): n is Extract<Entity, { kind: 'node' }> => n?.kind === 'node').map((n) => n.p);
      if (!doi(e, ps)) continue;
      e.layer = lopDuongDay(e.kv);
      for (const id of e.nodes) {
        const n = entities[id];
        if (n) n.layer = e.layer;
      }
    } else if (e.kind === 'device' || e.kind === 'text') {
      if (doi(e, [e.p])) e.layer = lopDuongDay(e.kv ?? 22);
    } else if (e.kind === 'circle') {
      if (doi(e, [e.c])) e.layer = lopDuongDay(e.kv);
    }
  }
}

/** Các lớp (layer) mà dữ liệu CAD kèm theo sử dụng — để tạo sẵn trong bản vẽ. */
export function cadLayerNames(): string[] {
  return [...data.layers, ...LOP_DUONG_DAY];
}
