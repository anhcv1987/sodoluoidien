import type { VoltageKv } from '../core/types';

/**
 * DANH MUC TRAM 220/110kV TINH THAI NGUYEN (sau sap nhap Bac Kan).
 *
 * Ten tram, ma tram va cong suat MBA duoc TRICH XUAT TRUC TIEP tu file CAD
 * "So do luoi dien lien thong tinh Thai Nguyen.dwg" do Phong Dieu do cung cap
 * (xem docs/cad-trich-xuat-so-do-tong.txt).
 *
 * Toa do lat/lon la VI TRI GAN DUNG do nguoi lap trinh uoc luong theo dia danh -
 * KHONG lay tu file CAD (file CAD ve theo loi so do nguyen ly, khong theo dia ly).
 * Nguoi dung co the keo tha tram tren man hinh hoac nhap lai lat/lon trong bang
 * thuoc tinh; toa do se duoc luu cung file ban ve.
 */

export type NguonGoc = 'CAD' | 'Ước lượng' | 'Sơ bộ - cần rà soát';

export interface TramData {
  code: string;
  name: string;
  /** TBA 220kV / TBA 110kV / Nha may dien. */
  loai: 'TBA 220kV' | 'TBA 110kV' | 'Nhà máy điện' | 'Ngoài tỉnh';
  levels: VoltageKv[];
  /** Cong suat MBA nhu ghi trong CAD, VD "2x40 MVA". */
  mba: string;
  lat: number;
  lon: number;
  /** Khu vuc tham chieu. */
  khuVuc: string;
  /** Do tin cay cua toa do. */
  viTri: NguonGoc;
}

export const TRAM_220_110: TramData[] = [
  /* ---------------- Khu vuc TP. Thai Nguyen ---------------- */
  { code: 'E6.2', name: 'TBA 220kV Thái Nguyên', loai: 'TBA 220kV', levels: [220, 110, 35, 22], mba: '2x250 MVA', lat: 21.6, lon: 105.838, khuVuc: 'TP. Thái Nguyên', viTri: 'Ước lượng' },
  { code: 'E6.20', name: 'TBA 220kV Lưu Xá', loai: 'TBA 220kV', levels: [220, 110, 22], mba: '2x250 MVA', lat: 21.541, lon: 105.852, khuVuc: 'TP. Thái Nguyên', viTri: 'Ước lượng' },
  { code: 'E6.4', name: 'TBA 110kV Đán', loai: 'TBA 110kV', levels: [110, 35, 22], mba: '2x63 MVA', lat: 21.583, lon: 105.795, khuVuc: 'TP. Thái Nguyên', viTri: 'Ước lượng' },
  { code: 'E6.5', name: 'TBA 110kV Lưu Xá', loai: 'TBA 110kV', levels: [110, 35, 22], mba: '2x40 MVA', lat: 21.552, lon: 105.845, khuVuc: 'TP. Thái Nguyên', viTri: 'Ước lượng' },
  { code: 'E6.9', name: 'TBA 110kV Gang Thép', loai: 'TBA 110kV', levels: [110, 35, 22], mba: '3x63 MVA', lat: 21.548, lon: 105.866, khuVuc: 'TP. Thái Nguyên', viTri: 'Ước lượng' },
  { code: 'E6.11', name: 'TBA 110kV Xi măng Quán Triều', loai: 'TBA 110kV', levels: [110, 22], mba: '1x20 MVA', lat: 21.632, lon: 105.806, khuVuc: 'TP. Thái Nguyên', viTri: 'Ước lượng' },
  { code: 'E6.8', name: 'TBA 110kV Xi măng Thái Nguyên', loai: 'TBA 110kV', levels: [110, 22], mba: '2x40 MVA', lat: 21.663, lon: 105.905, khuVuc: 'Đồng Hỷ', viTri: 'Ước lượng' },

  /* ---------------- Song Cong - Pho Yen - Phu Binh ---------------- */
  { code: 'E6.7', name: 'TBA 110kV Sông Công', loai: 'TBA 110kV', levels: [110, 35, 22], mba: '2x40 MVA', lat: 21.487, lon: 105.826, khuVuc: 'TP. Sông Công', viTri: 'Ước lượng' },
  { code: 'E6.21', name: 'TBA 110kV Sông Công 2', loai: 'TBA 110kV', levels: [110, 22], mba: '2x63 MVA', lat: 21.503, lon: 105.858, khuVuc: 'TP. Sông Công', viTri: 'Ước lượng' },
  { code: 'E6.3', name: 'TBA 110kV Gò Đầm', loai: 'TBA 110kV', levels: [110, 35, 22], mba: '3x63 MVA', lat: 21.448, lon: 105.848, khuVuc: 'TP. Phổ Yên', viTri: 'Ước lượng' },
  { code: 'E6.13', name: 'TBA 110kV Yên Bình', loai: 'TBA 110kV', levels: [110, 22], mba: '3x63 MVA', lat: 21.432, lon: 105.872, khuVuc: 'KCN Yên Bình - Phổ Yên', viTri: 'Ước lượng' },
  { code: 'E6.14', name: 'TBA 110kV Yên Bình 2', loai: 'TBA 110kV', levels: [110, 22], mba: '3x63 MVA', lat: 21.424, lon: 105.884, khuVuc: 'KCN Yên Bình - Phổ Yên', viTri: 'Ước lượng' },
  { code: 'E6.18', name: 'TBA 110kV Yên Bình 3', loai: 'TBA 110kV', levels: [110, 22], mba: '3x63 MVA', lat: 21.412, lon: 105.893, khuVuc: 'KCN Yên Bình - Phổ Yên', viTri: 'Ước lượng' },
  { code: 'E6.23', name: 'TBA 110kV Yên Bình 8', loai: 'TBA 110kV', levels: [110, 22], mba: '', lat: 21.402, lon: 105.902, khuVuc: 'KCN Yên Bình - Phổ Yên', viTri: 'Ước lượng' },
  { code: 'E6.24', name: 'TBA 110kV Đa Phúc', loai: 'TBA 110kV', levels: [110, 22], mba: '', lat: 21.362, lon: 105.878, khuVuc: 'TP. Phổ Yên', viTri: 'Ước lượng' },
  { code: 'E6.16', name: 'TBA 220kV Phú Bình', loai: 'TBA 220kV', levels: [220, 110, 22], mba: '2x250 MVA', lat: 21.462, lon: 105.944, khuVuc: 'Phú Bình', viTri: 'Ước lượng' },
  { code: 'E6.17', name: 'TBA 110kV Phú Bình', loai: 'TBA 110kV', levels: [110, 35, 22], mba: '3x63 MVA', lat: 21.487, lon: 105.928, khuVuc: 'Phú Bình', viTri: 'Ước lượng' },
  { code: 'E6.25', name: 'TBA 220kV Phú Bình 2', loai: 'TBA 220kV', levels: [220, 110], mba: '', lat: 21.452, lon: 105.958, khuVuc: 'Phú Bình', viTri: 'Ước lượng' },

  /* ---------------- Dai Tu - Phu Luong - Dinh Hoa ---------------- */
  { code: 'E6.19', name: 'TBA 110kV Đại Từ', loai: 'TBA 110kV', levels: [110, 35, 22], mba: '2x40 MVA', lat: 21.618, lon: 105.638, khuVuc: 'Đại Từ', viTri: 'Ước lượng' },
  { code: 'E6.12', name: 'TBA 110kV Núi Pháo', loai: 'TBA 110kV', levels: [110, 35, 22], mba: '2x40 MVA', lat: 21.648, lon: 105.662, khuVuc: 'Đại Từ', viTri: 'Ước lượng' },
  { code: 'A6.15', name: 'NM Nhiệt điện An Khánh', loai: 'Nhà máy điện', levels: [110], mba: '2x60 MVA', lat: 21.602, lon: 105.702, khuVuc: 'Đại Từ', viTri: 'Ước lượng' },
  { code: 'E6.6', name: 'TBA 110kV Phú Lương', loai: 'TBA 110kV', levels: [110, 35, 22], mba: '2x40 MVA', lat: 21.726, lon: 105.716, khuVuc: 'Phú Lương', viTri: 'Ước lượng' },
  { code: 'E6.22', name: 'TBA 110kV Định Hóa', loai: 'TBA 110kV', levels: [110, 35, 22], mba: '', lat: 21.898, lon: 105.638, khuVuc: 'Định Hóa', viTri: 'Ước lượng' },

  /* ---------------- Khu vuc Bac Kan (cu) ---------------- */
  { code: 'E26.1', name: 'TBA 110kV Bắc Kạn', loai: 'TBA 110kV', levels: [110, 35, 22], mba: '', lat: 22.142, lon: 105.828, khuVuc: 'TP. Bắc Kạn', viTri: 'Ước lượng' },
  { code: 'E26.2', name: 'TBA 110kV Chợ Đồn', loai: 'TBA 110kV', levels: [110, 35, 22], mba: '', lat: 22.152, lon: 105.586, khuVuc: 'Chợ Đồn', viTri: 'Ước lượng' },
  { code: 'E26.3', name: 'TBA 110kV Nà Phặc', loai: 'TBA 110kV', levels: [110, 35, 22], mba: '', lat: 22.402, lon: 105.972, khuVuc: 'Ngân Sơn', viTri: 'Ước lượng' },

  /* ---------------- Lien ket ngoai tinh ---------------- */
  { code: 'E14.1', name: 'TBA 220kV Tuyên Quang', loai: 'Ngoài tỉnh', levels: [220, 110], mba: '', lat: 21.83, lon: 105.24, khuVuc: 'Tỉnh Tuyên Quang', viTri: 'Ước lượng' },
  { code: 'E1.19', name: 'TBA 220kV Sóc Sơn', loai: 'Ngoài tỉnh', levels: [220, 110], mba: '125+250 MVA', lat: 21.25, lon: 105.85, khuVuc: 'TP. Hà Nội', viTri: 'Ước lượng' },
];

/**
 * DANH MUC DUONG DAY 110/220kV (SO BO).
 *
 * CANH BAO: khac voi danh muc tram, ket luoi duoi day KHONG trich xuat duoc
 * chinh xac tu file CAD (file ve theo loi so do, cac net khong noi lien mach nen
 * khong truy vet tu dong duoc). Day la ket luoi SO BO de co san khung ban ve;
 * de nghi ra soat lai va chinh sua truc tiep tren phan mem (chon duong day ->
 * bang thuoc tinh), hoac xoa het bang lenh "Xóa toàn bộ đường dây sơ bộ".
 *
 * Ma hieu day dan lay tu cac nhan co that tren file CAD khi xac dinh duoc.
 */
export interface DuongDayData {
  /** Ma tram dau A. */
  a: string;
  /** Ma tram dau B. */
  b: string;
  kv: VoltageKv;
  /** Ma hieu day dan, VD "AC-185". */
  day: string;
  /** Chieu dai (km) neu biet. */
  km?: number;
  /** So mach. */
  mach: number;
  nguon: NguonGoc;
  ghiChu?: string;
}

export const DUONG_DAY: DuongDayData[] = [
  /* Danh muc lay tu so do "LUOI DIEN 220KV-110KV KHU VUC TINH THAI NGUYEN" cua
     Phong Dieu do (ban ngay 10/8/2026), doi chieu voi nhan ghi noi den tren tung
     ngan lo trong file CAD so do ket day. */

  /* ---- Nhanh Tuyen Quang - Dai Tu - Nui Phao - Quan Trieu - E6.2 ---- */
  { a: 'E14.1', b: 'E6.19', kv: 110, day: 'AC-185+AC-240', km: 32.9, mach: 1, nguon: 'CAD' },
  { a: 'E6.19', b: 'E6.12', kv: 110, day: 'AC-185+AC-240', km: 10.7, mach: 1, nguon: 'CAD' },
  { a: 'E6.12', b: 'E6.11', kv: 110, day: 'AC-240 + AC-185', km: 19.1, mach: 1, nguon: 'CAD' },
  { a: 'E6.11', b: 'E6.2', kv: 110, day: 'AC-185', km: 6.7, mach: 1, nguon: 'CAD' },

  /* ---- Tu 220kV Thai Nguyen (E6.2) ---- */
  { a: 'E6.2', b: 'E6.8', kv: 110, day: 'AC-185', km: 17.04, mach: 2, nguon: 'CAD' },
  { a: 'E6.2', b: 'E6.6', kv: 110, day: 'AC-185', km: 20.99, mach: 1, nguon: 'CAD' },
  { a: 'E6.2', b: 'E6.4', kv: 110, day: 'AC-400', km: 5.2, mach: 1, nguon: 'CAD' },
  { a: 'E6.2', b: 'A6.15', kv: 110, day: 'AC-400', km: 5.2, mach: 2, nguon: 'CAD' },

  /* ---- Nhanh Phu Luong - Dinh Hoa - Bac Kan ---- */
  { a: 'E6.6', b: 'E6.22', kv: 110, day: 'AC-185', km: 26.0, mach: 1, nguon: 'CAD' },
  { a: 'E6.22', b: 'E26.1', kv: 110, day: 'ACSR-240', km: 10.99, mach: 1, nguon: 'CAD' },
  { a: 'E26.1', b: 'E26.5', kv: 110, day: 'AC-185', km: 2.0, mach: 2, nguon: 'CAD' },
  { a: 'E26.5', b: 'E26.2', kv: 110, day: 'AC-185', km: 28.0, mach: 1, nguon: 'CAD' },
  { a: 'E26.5', b: 'E26.3', kv: 110, day: 'AC-185', km: 32.0, mach: 1, nguon: 'CAD' },
  { a: 'E26.3', b: 'E16.2', kv: 110, day: 'AC-185', km: 40.0, mach: 1, nguon: 'Sơ bộ - cần rà soát' },

  /* ---- Tu 220kV Luu Xa (E6.15 / E6.20 tren ban CAD) ---- */
  { a: 'E6.20', b: 'E6.9', kv: 110, day: 'AC-300', km: 7.8, mach: 2, nguon: 'CAD' },
  { a: 'E6.20', b: 'E6.5', kv: 110, day: 'AC-185', km: 2.0, mach: 2, nguon: 'CAD' },
  { a: 'E6.20', b: 'E6.4', kv: 110, day: 'AC-400', km: 2.15, mach: 2, nguon: 'CAD' },
  { a: 'E6.2', b: 'E6.20', kv: 220, day: 'ACSR-400', km: 3.3, mach: 2, nguon: 'CAD' },

  /* ---- Khu vuc Song Cong - Pho Yen ---- */
  { a: 'E6.21', b: 'E6.3', kv: 110, day: 'AC-400', km: 4.2, mach: 1, nguon: 'CAD' },
  { a: 'E6.3', b: 'E6.16', kv: 110, day: 'AC-400', km: 4.34, mach: 1, nguon: 'CAD' },
  { a: 'E6.7', b: 'E6.16', kv: 110, day: 'AC-400', km: 4.28, mach: 1, nguon: 'CAD' },
  { a: 'E6.7', b: 'E1.19', kv: 110, day: 'AC 2x185', km: 11.0, mach: 2, nguon: 'CAD' },
  { a: 'E6.24', b: 'E6.16', kv: 110, day: 'AC-400', km: 5.54, mach: 1, nguon: 'CAD' },
  { a: 'E6.24', b: 'E1.19', kv: 110, day: 'AC-400', km: 6.68, mach: 1, nguon: 'CAD' },

  /* ---- Khu vuc Yen Binh - Phu Binh ---- */
  { a: 'E6.16', b: 'E6.13', kv: 110, day: 'AC-400 + AC 2x185', km: 4.34, mach: 1, nguon: 'CAD' },
  { a: 'E6.16', b: 'E6.14', kv: 110, day: 'AC-400', km: 8.92, mach: 2, nguon: 'CAD' },
  { a: 'E6.16', b: 'E6.23', kv: 110, day: 'AC-400', km: 8.38, mach: 1, nguon: 'CAD' },
  { a: 'E6.16', b: 'E6.18', kv: 110, day: 'AC-400', km: 12.98, mach: 1, nguon: 'CAD' },
  { a: 'E6.16', b: 'E6.25', kv: 220, day: 'AC-400', km: 3.3, mach: 2, nguon: 'CAD' },
  { a: 'E6.16', b: 'E1.19', kv: 110, day: 'ACSR-400', km: 0.11, mach: 1, nguon: 'CAD' },
  { a: 'E6.13', b: 'E6.23', kv: 110, day: 'ACSR-400', km: 2.61, mach: 1, nguon: 'CAD' },
  { a: 'E6.13', b: 'E6.25', kv: 110, day: 'AC-400', km: 5.3, mach: 1, nguon: 'CAD' },
  { a: 'E6.25', b: 'E6.17', kv: 110, day: 'AC-400', km: 5.82, mach: 1, nguon: 'CAD' },
  { a: 'E6.25', b: 'E6.18', kv: 110, day: 'AC-400', km: 5.3, mach: 1, nguon: 'CAD' },
];


/**
 * Thu vien ma hieu day dan / cap - dung cho o chon nhanh khi ve tuyen.
 * Phan 110kV lay tu chinh cac nhan tren file CAD goc.
 */
export const MA_DAY: Record<string, string[]> = {
  'ĐDK 110-220kV': [
    'AC-150', 'AC-185', 'AC-240', 'AC-300', 'AC-400',
    'AC-185+AC-185', 'AC-240+AC-150', 'ACSR-400/51', 'TACSR-200', 'AC-157',
  ],
  'ĐDK trung áp': [
    'AC-35', 'AC-50', 'AC-70', 'AC-95', 'AC-120', 'AC-150', 'AC-185', 'AC-240',
    'ACKP-50', 'ACKP-70', 'ACKP-95', 'ACKP-120', 'ACKP-150', 'ACKP-185', 'ACKP-240',
    'AC-70/11', 'AC-95/16', 'AC-120/19', 'AC-150/24', 'AC-185/29',
  ],
  'Cáp ngầm trung áp': [
    'Cu/XLPE/PVC 3x50', 'Cu/XLPE/PVC 3x70', 'Cu/XLPE/PVC 3x95',
    'Cu/XLPE/PVC 3x120', 'Cu/XLPE/PVC 3x150', 'Cu/XLPE/PVC 3x185',
    'Cu/XLPE/PVC 3x240', 'Cu/XLPE/PVC 3x300', 'Cu/XLPE/PVC 3x400',
    'Al/XLPE/PVC 3x240', 'Al/XLPE/PVC 3x300',
    'Cu/XLPE/DSTA/PVC 24kV 3x240', 'Cu/XLPE/DSTA/PVC 24kV 3x300',
  ],
  'Cáp vặn xoắn / bọc': [
    'AXV-70', 'AXV-95', 'AXV-120', 'AXV-150', 'AXV-185', 'AXV-240',
    'ABC 3x70', 'ABC 3x95', 'ABC 3x120',
  ],
};

/** Tiet dien danh dinh suy ra tu ma hieu day (mm2). */
export function tietDienTuMa(ma: string): number | undefined {
  const m = ma.match(/(\d{2,4})(?!.*\d)/);
  if (!m) return undefined;
  const v = Number(m[1]);
  return Number.isFinite(v) ? v : undefined;
}
