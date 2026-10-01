/**
 * SỔ SỬA PHIẾU CHỈNH ĐỊNH - các phiếu người dùng sửa / thêm / bỏ ngay trên phần mềm.
 *
 * Dữ liệu phiếu gốc (src/data/chinhDinh.json) nằm sẵn trong file phần mềm. Bản sửa lưu RIÊNG
 * (localStorage của trình duyệt, giống sổ dây dẫn) theo mã phiếu, đè lên phiếu gốc khi hiển
 * thị; không mất khi cập nhật phần mềm. Quản trị xuất sổ ra .json để chép sang máy khác, hoặc
 * gộp vào dữ liệu gốc khi dựng lại phần mềm (tools/chinh-dinh/dung-du-lieu.py --so-sua).
 */

import type { PhieuCD } from '../core/chinhDinh';

export interface MucPhieu {
  /** Nội dung phiếu sau khi sửa (phiếu mới: id bắt đầu bằng "moi-"). */
  p: PhieuCD;
  /** Bỏ phiếu khỏi dữ liệu (phiếu hết hiệu lực...). */
  xoa?: 1;
  /** Ngày cập nhật (ISO), người cập nhật. */
  capNhat: string;
  nguoi?: string;
}

export interface SoPhieu {
  phienBan: 1;
  muc: Record<string, MucPhieu>;
}

const KHOA_LS = 'sodoluoidien.sophieu.v1';

let bo: SoPhieu | null = null;

export function docSoPhieu(): SoPhieu {
  if (bo) return bo;
  try {
    const s = localStorage.getItem(KHOA_LS);
    const o = s ? (JSON.parse(s) as SoPhieu) : null;
    bo = o && o.muc && typeof o.muc === 'object' ? o : { phienBan: 1, muc: {} };
  } catch {
    bo = { phienBan: 1, muc: {} };
  }
  return bo;
}

function ghi(): boolean {
  try {
    localStorage.setItem(KHOA_LS, JSON.stringify(docSoPhieu()));
    return true;
  } catch {
    return false;
  }
}

/** Ghi bản sửa của một phiếu; muc = null: khôi phục theo phiếu gốc. Trả false nếu trình duyệt chặn lưu. */
export function datPhieu(id: string, muc: MucPhieu | null): boolean {
  const so = docSoPhieu();
  if (muc) so.muc[id] = muc;
  else delete so.muc[id];
  return ghi();
}

export const soPhieuDaSua = (): number => Object.keys(docSoPhieu().muc).length;

/** Áp sổ sửa lên danh sách phiếu gốc: thay phiếu đã sửa, thêm phiếu mới, bỏ phiếu đã xoá. */
export function apSoPhieu(goc: PhieuCD[]): PhieuCD[] {
  const muc = docSoPhieu().muc;
  if (!Object.keys(muc).length) return goc;
  const ngay = (m: MucPhieu): string =>
    `${m.capNhat.slice(8, 10)}/${m.capNhat.slice(5, 7)}/${m.capNhat.slice(0, 4)}${m.nguoi ? ' - ' + m.nguoi : ''}`;
  const ra: PhieuCD[] = [];
  const daGap = new Set<string>();
  for (const p of goc) {
    const m = muc[p.id];
    daGap.add(p.id);
    if (!m) ra.push(p);
    else if (!m.xoa) ra.push({ ...m.p, id: p.id, sua: ngay(m) });
  }
  for (const [id, m] of Object.entries(muc)) {
    if (!daGap.has(id) && !m.xoa) ra.push({ ...m.p, id, sua: ngay(m) });
  }
  return ra;
}

export function xuatSoPhieu(): string {
  return JSON.stringify(docSoPhieu(), null, 1);
}

/** Nhập file .json: gộp vào sổ (mục trùng mã lấy bản cập nhật sau). Trả về số mục nhận. */
export function nhapSoPhieu(text: string): number {
  const o = JSON.parse(text) as Partial<SoPhieu>;
  if (!o || typeof o.muc !== 'object' || !o.muc) throw new Error('File không phải sổ sửa phiếu chỉnh định.');
  const so = docSoPhieu();
  let n = 0;
  for (const [k, m] of Object.entries(o.muc)) {
    if (!m || !m.p || typeof m.p.tb !== 'string' || !Array.isArray(m.p.g)) continue;
    const cu = so.muc[k];
    if (!cu || (m.capNhat ?? '') >= (cu.capNhat ?? '')) {
      so.muc[k] = m;
      n++;
    }
  }
  ghi();
  return n;
}
