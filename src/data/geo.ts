import type { Pt } from '../core/types';

/**
 * PHEP CHIEU DIA LY -> TOA DO BAN VE.
 *
 * Dung phep chieu tru dai (equirectangular) lay tam tai giua tinh Thai Nguyen
 * (sau sap nhap Bac Kan, 2025). Sai so trong pham vi mot tinh la khong dang ke
 * so voi muc do "gan dung vi tri" ma so do nguyen ly mot soi can.
 *
 * 1 don vi ban ve = 1 km thuc dia. Truc X huong Dong, truc Y huong Bac.
 */
export const LAT0 = 22.0;
export const LON0 = 105.8;
const KM_PER_DEG_LAT = 110.574;
const KM_PER_DEG_LON = 111.32 * Math.cos((LAT0 * Math.PI) / 180);

export function project(lat: number, lon: number): Pt {
  return {
    x: (lon - LON0) * KM_PER_DEG_LON,
    y: (lat - LAT0) * KM_PER_DEG_LAT,
  };
}

export function unproject(p: Pt): { lat: number; lon: number } {
  return {
    lat: p.y / KM_PER_DEG_LAT + LAT0,
    lon: p.x / KM_PER_DEG_LON + LON0,
  };
}

/** Dinh dang toa do dia ly kieu do-phut-giay cho thanh trang thai. */
export function formatLatLon(lat: number, lon: number): string {
  const f = (v: number, pos: string, neg: string) => {
    const s = v >= 0 ? pos : neg;
    const a = Math.abs(v);
    const d = Math.floor(a);
    const m = Math.floor((a - d) * 60);
    const sec = ((a - d) * 60 - m) * 60;
    return `${d}°${String(m).padStart(2, '0')}'${sec.toFixed(1)}"${s}`;
  };
  return `${f(lat, 'B', 'N')} ${f(lon, 'Đ', 'T')}`;
}

/**
 * Ranh gioi so hoa tinh Thai Nguyen sau sap nhap (Thai Nguyen + Bac Kan cu).
 * CHU Y: day la duong bao SO HOA - chi de dinh huong vi tri tuong doi cua cac tram,
 * KHONG dung lam tai lieu dia gioi hanh chinh. Co the thay bang duong bao chinh xac
 * bang chuc nang "Nhap nen ban do" trong phan mem.
 */
export const RANH_GIOI_TINH: [number, number][] = [
  // [lat, lon] di theo chieu kim dong ho tu cuc Bac (Pac Nam)
  [22.76, 105.62],
  [22.72, 105.79],
  [22.63, 105.92],
  [22.55, 106.04],
  [22.38, 106.19],
  [22.22, 106.24],
  [22.06, 106.18],
  [21.94, 106.12],
  [21.84, 106.1],
  [21.72, 106.08],
  [21.62, 106.02],
  [21.5, 106.0],
  [21.4, 105.96],
  [21.33, 105.9],
  [21.32, 105.81],
  [21.38, 105.74],
  [21.47, 105.68],
  [21.55, 105.58],
  [21.63, 105.52],
  [21.72, 105.5],
  [21.82, 105.46],
  [21.92, 105.44],
  [22.02, 105.41],
  [22.14, 105.4],
  [22.28, 105.44],
  [22.42, 105.47],
  [22.56, 105.52],
  [22.68, 105.56],
];

/** Ho Nui Coc - moc dia hinh de de dinh vi khu vuc Dai Tu / Thinh Dan. */
export const HO_NUI_COC: [number, number][] = [
  [21.57, 105.68],
  [21.6, 105.66],
  [21.62, 105.68],
  [21.61, 105.72],
  [21.58, 105.73],
  [21.55, 105.71],
];

/** Ho Ba Be - moc dia hinh phia Bac (Bac Kan cu). */
export const HO_BA_BE: [number, number][] = [
  [22.42, 105.61],
  [22.44, 105.63],
  [22.4, 105.65],
  [22.37, 105.64],
  [22.38, 105.61],
];

/**
 * Cac dia danh tham chieu (trung tam huyen/thi xa cu). Sau sap nhap 2025 cap huyen
 * da bo, nhung day van la moc dinh vi quen thuoc trong cong tac dieu do.
 */
export const DIA_DANH: { ten: string; lat: number; lon: number; cap: 1 | 2 }[] = [
  { ten: 'TP. Thái Nguyên', lat: 21.594, lon: 105.848, cap: 1 },
  { ten: 'TP. Sông Công', lat: 21.482, lon: 105.83, cap: 1 },
  { ten: 'TP. Phổ Yên', lat: 21.42, lon: 105.86, cap: 1 },
  { ten: 'TP. Bắc Kạn', lat: 22.147, lon: 105.834, cap: 1 },
  { ten: 'Phú Bình', lat: 21.48, lon: 105.95, cap: 2 },
  { ten: 'Đại Từ', lat: 21.625, lon: 105.634, cap: 2 },
  { ten: 'Định Hóa', lat: 21.902, lon: 105.632, cap: 2 },
  { ten: 'Phú Lương', lat: 21.724, lon: 105.72, cap: 2 },
  { ten: 'Đồng Hỷ', lat: 21.68, lon: 105.92, cap: 2 },
  { ten: 'Võ Nhai', lat: 21.79, lon: 106.03, cap: 2 },
  { ten: 'Chợ Mới', lat: 21.95, lon: 105.83, cap: 2 },
  { ten: 'Chợ Đồn', lat: 22.15, lon: 105.58, cap: 2 },
  { ten: 'Bạch Thông', lat: 22.22, lon: 105.83, cap: 2 },
  { ten: 'Na Rì', lat: 22.19, lon: 106.09, cap: 2 },
  { ten: 'Ngân Sơn', lat: 22.42, lon: 105.98, cap: 2 },
  { ten: 'Ba Bể', lat: 22.4, lon: 105.72, cap: 2 },
  { ten: 'Pác Nặm', lat: 22.63, lon: 105.65, cap: 2 },
];
