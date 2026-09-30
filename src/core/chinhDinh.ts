/**
 * PHIẾU CHỈNH ĐỊNH RƠ LE - ghép phiếu với máy cắt / Recloser trên sơ đồ.
 *
 * Dữ liệu phiếu (src/data/chinhDinh.json) trích từ trang đầu các phiếu chỉnh định
 * trong thư mục "Role\Phieu chinh dinh role" trên Google Drive của Phòng Điều độ
 * (không lấy thư mục "Phieu het hieu luc", trạm khách hàng).
 *
 * Phiếu và thiết bị gặp nhau qua KHOÁ dạng "<trạm>:<lộ>[/<cột>]":
 *   - máy cắt trong trạm:      MC 471 trạm E6.6          -> "E6.6:471"
 *   - Recloser trên đường dây: MC 471E6.6/35             -> "E6.6:471/35"
 *   - máy cắt trạm cắt:        MC 371 TCCN, MC 371TCCN/51 -> "TCCN:371", "TCCN:371/51"
 * Module này không phụ thuộc giao diện để dùng lại được trong công cụ kiểm tra
 * (tools/chinh-dinh/doi-chieu.ts) khi lập danh sách thiết bị chưa có phiếu.
 */

/** Một dòng thông số: [chức năng, cấp bảo vệ, giá trị, thời gian, tác động]. */
export type DongCD = [string, string, string, string, string];

export interface NhomCD {
  /** Nhóm thông số / hướng nhận điện ("Group 1 - khi nhận điện từ ĐZ 373E6.3"). */
  h?: string;
  c: DongCD[];
}

export interface PhieuCD {
  /** Mã file trên Google Drive. */
  id: string;
  /** Tên file phiếu. */
  ten: string;
  /** Số phiếu. */
  so: string;
  /** Thiết bị (máy cắt) - nhiều máy cắt ngăn cách bằng "; ". */
  tb: string;
  /** Thiết bị được bảo vệ. */
  mo: string;
  /** Rơ le - hãng. */
  rl: string;
  /** Tỷ số TI / TU. */
  ti: string;
  /** Năm lắp đặt rơ le. */
  nam: string;
  /** Mục đích ban hành. */
  md?: string;
  /** Ngày / tháng ban hành. */
  nb: string;
  /** Tự động đóng lại (F79) của Recloser. */
  tdl?: string;
  g: NhomCD[];
  /** Ghi chú khi đối chiếu (sai lệch trong phiếu, bản lưu cũ...). */
  gc?: string;
  /** Trích đoạn phiếu bị thiếu, cần mở file gốc để xem đủ. */
  thieu?: 1;
}

/** Tên trạm / trạm cắt đứng sau số lộ. */
const TRAM = String.raw`(E\s*\d+\s*\.\s*\d+|TCCN|TCVB|TC\s*Cao\s*Ngạn|TC\s*Vòng\s*Bi|T[ÂA]N\s*Đ[ỨU]C|Đ[ỒO]NG\s*LI[ÊE]N)`;
const COT = String.raw`([0-9]{1,3}[A-Z]?(?:-[0-9])?)`;
const LO = String.raw`(\d{3})`;
const MAU_LO_COT: [RegExp, (m: RegExpMatchArray) => [string, string, string?]][] = [
  // 475E6.3/03 - 371TCCN/51
  [new RegExp(`${LO}\\s*${TRAM}\\s*/\\s*${COT}(?![0-9A-Z])`, 'i'), (m) => [m[2], m[1], m[3]]],
  // 30/377E6.19 - 65/371 Đồng Liên - 02 Z131/471E6.7 (MC 02 nhánh Z131)
  [new RegExp(`(?:^|[^0-9A-Z])${COT}(?:\\s+[A-Z]+\\d+)?\\s*/\\s*${LO}\\s*${TRAM}`, 'i'), (m) => [m[3], m[2], m[1]]],
  // RMU 472/34 E6.2
  [new RegExp(`${LO}\\s*/\\s*${COT}\\s+${TRAM}`, 'i'), (m) => [m[3], m[1], m[2]]],
  // 471E6.6 - 371 TCCN - T401 E6.23 - 412-A E6.14 - 612B E6.9
  [new RegExp(`(?:^|[^0-9A-Z])(T?\\d{3}(?:-?[A-C])?)\\s*${TRAM}`, 'i'), (m) => [m[2], m[1]]],
];

/** "E 6.6" -> "E6.6"; "TC Cao Ngạn" -> "TCCN"; "Tân Đức" -> "TÂNĐỨC". */
export function chuanTram(s: string): string {
  const t = s.replace(/\s+/g, '').toLocaleUpperCase('vi');
  if (/^TCCAO/.test(t)) return 'TCCN';
  if (/^TCV/.test(t)) return 'TCVB';
  return t.replace(/^TAN/, 'TÂN').replace(/^DONG/, 'ĐỒNG');
}

/** "03" -> "3", "02a" -> "2A", "412-A" -> "412A". */
export function chuanSo(s: string): string {
  const t = s.replace(/\s+/g, '').toUpperCase();
  const k = /^(T?)(\d+)(.*)$/.exec(t);
  if (!k) return t;
  const so = k[2].replace(/^0+(?=\d)/, '');
  return k[1] + so + k[3].replace(/^-(?=[A-C]$)/, '');
}

function khoa(tram: string, lo: string, cot?: string): string {
  return `${chuanTram(tram)}:${chuanSo(lo)}${cot ? '/' + chuanSo(cot) : ''}`;
}

/** Tách khoá từ một đoạn tên thiết bị ("MC 475E6.3/03 Phố Cò"). */
export function khoaTuTen(ten: string): string | null {
  const goc = ten.trim();
  // tụ bù trên đường dây không phải máy cắt / Recloser
  if (/^Tụ bù/i.test(goc)) return null;
  const loai = /^(REC|RMU|Recloser)\b/i.exec(goc)?.[1];
  let s = goc.replace(/^(REC|MC|RMU|Recloser)\s*/i, '');
  // "472E6.4/61 LT 473E6.2": phần sau "LT" là lộ liên thông, không phải thiết bị này
  const lt = s.search(/\bL\.?T\b/);
  if (lt > 0) s = s.slice(0, lt);
  for (const [re, lay] of MAU_LO_COT) {
    const m = s.match(re);
    if (m) {
      const [tram, lo, cot] = lay(m);
      const k = khoa(tram, lo, cot);
      // Recloser / tủ RMU phải có số cột; không có thì chỉ nhận ở trạm cắt
      // (REC 372 Tân Đức), tránh gán nhầm vào máy cắt đầu lộ trong trạm.
      if (loai && !cot && /^E/.test(k)) return null;
      return k;
    }
  }
  return null;
}

/** Các khoá thiết bị ghi trên phiếu (phiếu so lệch MBA ghi nhiều máy cắt). */
export function khoaPhieu(tb: string): string[] {
  const ks: string[] = [];
  for (const phan of tb.split(';')) {
    const k = khoaTuTen(phan);
    if (k && !ks.includes(k)) ks.push(k);
  }
  return ks;
}

/** Nhãn máy cắt trong trạm: "471", "MC 471", "T401", "412-A". */
const NHAN_TRONG_TRAM = /^(?:MC\s*)?(T?\d{3}(?:-?[A-C])?)$/i;

/**
 * Khoá của thiết bị trên sơ đồ theo các chữ quanh nó (gần trước, xa sau).
 * `tram`: mã trạm chứa thiết bị (tờ tổng: ô trạm; tờ trạm: mã tờ) - có thì nhãn
 * chỉ cần số máy cắt; không có thì nhãn phải đủ "MC 471E6.6/35".
 */
export function khoaThietBi(nhanQuanh: string[], tram?: string): string | null {
  for (const n of nhanQuanh) {
    const s = n.trim();
    if (tram) {
      // trong trạm chỉ lấy nhãn gần nhất (bỏ qua nhãn TI đặt sát máy cắt): nhãn gần
      // nhất là "TUC41-1", "CS-4T1"... thì đây không phải máy cắt có phiếu
      if (!s || /^TI\s*\d/i.test(s)) continue;
      const m = NHAN_TRONG_TRAM.exec(s);
      if (m) return khoa(tram, m[1]);
      return /^MC\s*\S/i.test(s) ? khoaTuTen(s) : null;
    }
    if (/^MC\s*\S/i.test(s)) {
      const k = khoaTuTen(s);
      if (k) return k;
    }
  }
  return null;
}

/** Phiếu lưu cũ / phiếu dùng khi đóng xung kích xếp sau phiếu vận hành. */
export const laBanLuu = (p: PhieuCD): boolean => /Bản lưu cũ/i.test(p.gc ?? '');
export const laXungKich = (p: PhieuCD): boolean => p.g.some((n) => /xung kích/i.test(n.h ?? ''));

/** Ngày ban hành quy về yyyymmdd để xếp mới trước cũ. */
export function ngayPhieu(p: PhieuCD): number {
  const nb = p.nb ?? '';
  let m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(nb);
  if (m) return +m[3] * 10000 + +m[2] * 100 + +m[1];
  m = /(\d{1,2})\/(\d{4})/.exec(nb);
  if (m) return +m[2] * 10000 + +m[1] * 100;
  m = /(\d{4})/.exec(nb) ?? /(20\d\d|19\d\d)/.exec(p.so);
  return m ? +m[1] * 10000 : 0;
}

export function soSanhPhieu(a: PhieuCD, b: PhieuCD): number {
  return (
    Number(laBanLuu(a)) - Number(laBanLuu(b)) ||
    Number(laXungKich(a)) - Number(laXungKich(b)) ||
    ngayPhieu(b) - ngayPhieu(a)
  );
}

/** Bỏ dấu, bỏ khoảng trắng, chữ thường - để tìm kiếm. */
export function chuanTim(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[\s\-_.]+/g, '');
}

/** Các cách gõ thường gặp của một khoá ("E6.17:474/111" → "474e617/111", "111/474e617", "mc474e617"...). */
export function dangTimKhoa(k: string | null): string {
  if (!k) return '';
  const [tram, so] = k.split(':');
  const [lo, cot] = so.split('/');
  const t = chuanTim(tram);
  const v = cot ? [`${lo}${t}/${cot}`, `${cot}/${lo}${t}`, `${lo}/${cot}${t}`] : [`${lo}${t}`, `${t}${lo}`];
  return v.join('|');
}

/** Chỉ mục phiếu theo khoá thiết bị. */
export class ChiMucCD {
  private theoKhoa = new Map<string, PhieuCD[]>();
  /** Phiếu không ra được khoá thiết bị (thanh cái, tủ sa thải, trạm trung gian...). */
  readonly khongKhoa: PhieuCD[] = [];

  readonly ds: PhieuCD[];

  constructor(ds: PhieuCD[]) {
    this.ds = ds;
    for (const p of ds) {
      const ks = khoaPhieu(p.tb);
      if (!ks.length) this.khongKhoa.push(p);
      for (const k of ks) {
        const a = this.theoKhoa.get(k) ?? [];
        a.push(p);
        this.theoKhoa.set(k, a);
      }
    }
    for (const a of this.theoKhoa.values()) a.sort(soSanhPhieu);
  }

  /** Các phiếu của một thiết bị, phiếu đang dùng đứng đầu. */
  tra(k: string | null | undefined): PhieuCD[] {
    return k ? this.theoKhoa.get(k) ?? [] : [];
  }

  get khoa(): string[] {
    return [...this.theoKhoa.keys()];
  }
}

/** Link mở phiếu gốc trên Google Drive. */
export const linkPhieu = (p: PhieuCD): string => `https://drive.google.com/file/d/${p.id}/view`;

/** Tóm tắt một phiếu thành vài dòng ngắn để hiện khi rê chuột. */
export function tomTatPhieu(p: PhieuCD): string[] {
  const dong: string[] = [`${p.rl}${p.ti ? ' · TI ' + p.ti : ''}`];
  const ngan = (c: DongCD): string => `${c[0]}${c[1] ? ' ' + c[1] : ''}: ${c[2] || '—'}${c[3] ? ' / ' + c[3] : ''}`;
  for (const n of p.g) {
    if (p.g.length > 1 || n.h) dong.push(`▸ ${n.h ?? 'Nhóm thông số'}`);
    const cs = n.c.filter((c) => !/cảnh báo/i.test(c[4]));
    dong.push(...cs.slice(0, 6).map(ngan));
    if (cs.length > 6) dong.push(`… và ${cs.length - 6} chức năng khác`);
  }
  if (p.tdl) dong.push(`TĐL: ${p.tdl}`);
  dong.push(`Phiếu ${p.so} (${p.nb})${p.thieu ? ' - trích đoạn chưa đủ, xem file gốc' : ''}`);
  return dong;
}
