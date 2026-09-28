/**
 * SỔ DÂY DẪN - mã hiệu dây / cáp của từng ĐOẠN dây (giữa hai thiết bị / chỗ rẽ nhánh) do người dùng
 * nhập, làm căn cứ xác định dòng định mức.
 *
 * Lưu RIÊNG khỏi bản vẽ (localStorage, vài trăm KB), không mất khi cập nhật phần mềm hay vẽ lại lưới
 * (tờ sơ đồ tổng quá lớn nên bản vẽ không lưu tạm được). Mỗi mục gắn với đoạn dây bằng KHOÁ: tên tờ,
 * cấp điện áp và tên hai thiết bị ở hai đầu đoạn (vd "DCL 373E6.22-7/01A", "LBS 373E6.22/72") - bố
 * trí lại sơ đồ vẫn tìm lại được đúng đoạn. Đầu đoạn không có thiết bị (chỗ rẽ nhánh) ghi theo toạ độ.
 * Xuất / nhập file .json để chép sang máy khác, lưu hồ sơ.
 */

export interface MucDayDan {
  /** Mã hiệu dây / cáp (chuẩn hoá hoặc nhập tay). */
  ma: string;
  /** Số sợi (mạch) song song mỗi pha. */
  songSong?: number;
  /** Dòng cho phép một sợi (A) - nhập theo catalogue; bỏ trống thì dùng giá trị tham khảo (dây AC). */
  icp?: number;
  /** Chiều dài thực tế (m). */
  daiM?: number;
  ghiChu?: string;
  /** Cấp điện áp, tên hai đầu (để đọc sổ không cần bản vẽ). */
  kv: number;
  dau: string[];
  /** Một điểm trên đoạn (tìm lại đoạn khi đã vẽ lại). */
  p?: [number, number];
  /** Ngày cập nhật (ISO), người cập nhật. */
  capNhat: string;
  nguoi?: string;
}

export interface SoDayDan {
  phienBan: 1;
  muc: Record<string, MucDayDan>;
}

const KHOA_LS = 'sodoluoidien.sodaydan.v1';

/** Khoá đoạn dây: tên tờ | cấp điện áp | hai đầu (xếp thứ tự). */
export function khoaDoan(to: string, kv: number, dau: string[]): string {
  return [to, `${kv}kV`, ...[...dau].sort()].join(' | ');
}

let bo: SoDayDan | null = null;

export function docSo(): SoDayDan {
  if (bo) return bo;
  try {
    const s = localStorage.getItem(KHOA_LS);
    const o = s ? (JSON.parse(s) as SoDayDan) : null;
    bo = o && o.muc && typeof o.muc === 'object' ? o : { phienBan: 1, muc: {} };
  } catch {
    bo = { phienBan: 1, muc: {} };
  }
  return bo;
}

function ghiSo(): boolean {
  try {
    localStorage.setItem(KHOA_LS, JSON.stringify(docSo()));
    return true;
  } catch {
    return false;
  }
}

/** Ghi / xoá (muc = null) một mục. Trả về false nếu trình duyệt chặn lưu (vẫn giữ trong phiên). */
export function datMuc(khoa: string, muc: MucDayDan | null): boolean {
  const so = docSo();
  if (muc) so.muc[khoa] = muc;
  else delete so.muc[khoa];
  return ghiSo();
}

/** Nội dung file xuất (.json). */
export function xuatSo(): string {
  return JSON.stringify(docSo(), null, 1);
}

/** Nhập file .json: gộp vào sổ hiện có (mục trùng khoá lấy bản cập nhật sau). Trả về số mục nhận. */
export function nhapSo(text: string): number {
  const o = JSON.parse(text) as Partial<SoDayDan>;
  if (!o || typeof o.muc !== 'object' || !o.muc) throw new Error('File không phải sổ dây dẫn.');
  const so = docSo();
  let n = 0;
  for (const [k, m] of Object.entries(o.muc)) {
    if (!m || typeof m.ma !== 'string') continue;
    const cu = so.muc[k];
    if (!cu || (m.capNhat ?? '') >= (cu.capNhat ?? '')) {
      so.muc[k] = m;
      n++;
    }
  }
  ghiSo();
  return n;
}
