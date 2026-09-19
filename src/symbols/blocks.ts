import { A, C, L, P, T, normalizeCad, primBounds, type Prim } from './prims';

/**
 * THU VIEN BLOCK THIET BI.
 *
 * Hinh hoc cua cac block duoi day duoc lay TRUC TIEP tu file CAD goc
 * "So do luoi dien lien thong tinh Thai Nguyen.dwg" (xem docs/cad-blocks-goc.txt),
 * sau do chuan hoa ve he toa do block:
 *   - truc thiet bi nam doc theo phuong +Y (thang dung, giong cac ngan lo trong tram),
 *   - goc toa do dat tai tam hop bao cua block,
 *   - he so thu phong k = 1/18.669 (chieu cao block "110-MC" trong CAD) => MC cao 1 don vi.
 * Nho vay ty le giua cac thiet bi giong het ban ve CAD goc.
 */

export type BlockGroup = 'Đóng cắt' | 'Đo lường - Bảo vệ' | 'Máy biến áp - Bù' | 'Khác';

export interface BlockDef {
  id: string;
  /** Ten hien thi tieng Viet. */
  name: string;
  /** Vi tu thuong dung khi ghi nhan: MC, DCL, REC... */
  abbr: string;
  group: BlockGroup;
  /** Hinh ve trang thai mac dinh / trang thai DONG. */
  prims: Prim[];
  /** Hinh ve trang thai MO (neu la thiet bi dong cat co the ve hai trang thai). */
  primsOpen?: Prim[];
  /** Thiet bi dong cat -> co trang thai dong/mo, tham gia phan tich ket luoi. */
  switching: boolean;
  /** Thiet bi noi tiep tren duong day (cat duong day) hay noi re nhanh xuong dat. */
  inline: boolean;
  /** Chieu dai theo truc Y (don vi block) - dung de chua cho tren duong day. */
  span: number;
  /**
   * Goc (do) da quay hinh hoc CAD goc khi chuan hoa ve truc +Y.
   * Khi nhap tu DXF phai TRU lai goc nay de thiet bi nam dung huong nhu ban CAD.
   */
  normRot: number;
  /** Vi tri (he toa do block) ung voi diem chen cua block CAD goc. */
  origin: [number, number];
  /** Kich thuoc hop bao cua ky hieu (don vi block): [rong, cao]. */
  bbox: [number, number];
  /** Co to dac khi dang dong hay khong (may cat). */
  fillWhenClosed?: boolean;
  /** Nguon goc hinh ve. */
  source: string;
}

const K = 1 / 18.669;

/* ------------------------------------------------------------------ */
/* Dinh nghia hinh hoc theo toa do CAD goc                             */
/* ------------------------------------------------------------------ */

/** 110-MC: hinh chu nhat 12.254 x 18.669, truc doc Y. */
const CAD_MC: Prim[] = [P(true, false, -6.127, 0, 6.127, 0, 6.127, -18.669, -6.127, -18.669)];

/** 110-DCL: thanh tiep diem + luoi dao cheo. Trong CAD truc nam ngang -> quay 90. */
const CAD_DCL: Prim[] = [L(0, -3.353, 0, 3.353), L(-4.82, 1.384, 4.82, -1.384)];

/** 22-DCL Mo: dao cach ly o trang thai MO (co khe ho, luoi dao cheo ra). */
const CAD_DCL_MO: Prim[] = [
  L(0, 0, 0, -4.883),
  L(0, -15.5, 0, -20),
  L(0, -15.5, 9.737, -8.627),
];

/** 22-DCLHB: dao cach ly hop bo (tiep diem kieu mui ten kep tren + duoi). */
const CAD_DCLHB: Prim[] = [
  L(0, 0, -5.016, -6.197),
  L(0, 0, 5.016, -6.197),
  L(0, -5.691, -5.016, -11.888),
  L(0, -5.691, 5.016, -11.888),
  L(0, -11.888, 0, -47.173),
  L(0, -53.37, -5.016, -47.173),
  L(0, -53.37, 5.016, -47.173),
  L(0, -59.061, -5.016, -52.864),
  L(0, -59.061, 5.016, -52.864),
];

/** 22-MCHB: may cat hop bo = MC + tiep diem rut (mui ten kep tren/duoi). */
const CAD_MCHB: Prim[] = [
  P(true, false, -4.777, -18.067, 4.777, -18.067, 4.777, -43.602, -4.777, -43.602),
  L(0, -18.067, 0, -5.42),
  L(0, -5.42, -4.777, -11.322),
  L(0, -5.42, 4.777, -11.322),
  L(0, 0, -4.777, -5.902),
  L(0, 0, 4.777, -5.902),
  L(0, -43.602, 0, -56.249),
  L(0, -56.249, -4.777, -50.347),
  L(0, -56.249, 4.777, -50.347),
  L(0, -61.669, -4.777, -55.767),
  L(0, -61.669, 4.777, -55.767),
];

/** 110-Tiep Dia: dao tiep dia (luoi dao + ky hieu dat). Truc nam ngang -> quay 90. */
const CAD_DTD: Prim[] = [
  L(-3.035, 0, 4.185, 0),
  L(-5.866, 0, -3.543, 2.187),
  L(-5.866, 0, -11.732, 0),
  L(-11.732, 2.557, -11.732, -2.505),
  L(-13.796, 1.834, -13.796, -1.782),
  L(-15.232, 0.749, -15.232, -0.697),
];

/** 22-Tiep dia ko DCL: noi dat truc tiep, khong qua dao. */
const CAD_TD_TRUCTIEP: Prim[] = [
  L(0, 0, 0, -8),
  L(-3.6, -8, 3.6, -8),
  L(-2.4, -10.2, 2.4, -10.2),
  L(-1.1, -12.2, 1.1, -12.2),
];

/** 110-CSV: chong set van (than van + khe phong dien + noi dat). Truc ngang -> quay 90. */
const CAD_CSV: Prim[] = [
  L(3.687, -0.432, -3.487, -0.432),
  P(true, false, -0.288, 2.016, -0.288, -2.88, -8.342, -2.88, -8.342, 2.016),
  L(-2.74, 2.016, -2.74, -2.88),
  L(-1.514, 2.016, -1.514, -2.88),
  L(-7.2, -0.473, -9.566, -0.46),
  L(-9.566, 1.144, -9.566, -2.064),
  L(-10.874, 0.685, -10.874, -1.606),
  L(-11.783, -0.002, -11.783, -0.918),
];

/** 110-TI: bien dong dien - mot vong tron nho tren day. */
const CAD_TI: Prim[] = [C(0, -2.194, 2.11)];

/** 22-TU1: bien dien ap 1 pha (hai vong tron + dau noi + tiep dia). */
const CAD_TU: Prim[] = [
  C(0, -6.112, 6.112),
  C(0, -15.041, 6.112),
  L(0, -2.717, 0, -5.397),
  L(-2.321, -6.737, 0, -5.397),
  L(2.321, -6.737, 0, -5.397),
  L(0, -13.921, 0, -16.602),
  L(-2.321, -17.942, 0, -16.602),
  L(2.321, -17.942, 0, -16.602),
  L(-6.112, -6.112, -12.623, -6.112),
  L(-12.623, -6.112, -12.623, -33.909),
  L(-6.112, -15.041, -12.623, -15.041),
  L(-15.935, -33.909, -9.311, -33.909),
];

/** 110-TUC: bo TU thanh cai 3 pha + dau noi thanh cai + tiep dia. */
const CAD_TUC: Prim[] = [
  L(0, 0, 0, 10.246),
  L(0, 13.039, 0, 22.715),
  L(4.029, 10.246, -4.029, 10.246),
  L(4.303, 13.039, -3.756, 13.039),
  L(4.303, 22.715, -3.756, 22.715),
  L(4.576, 25.508, -3.483, 25.508),
  L(0, 25.508, 0, 32.566),
  L(-4.092, 32.566, 4.009, 32.566),
  L(-2.935, 35.868, 2.851, 35.868),
  L(-1.199, 38.165, 1.116, 38.165),
  L(13.168, 18.292, 0, 18.292),
  C(26.478, 18.317, 5.781),
  C(22.694, 25.096, 5.781),
  C(18.949, 18.292, 5.781),
  L(26.478, 18.317, 24.559, 14.779),
  L(26.478, 18.317, 24.849, 21.223),
  L(26.478, 18.317, 28.966, 18.233),
  L(18.949, 18.292, 17.03, 14.754),
  L(18.949, 18.292, 17.32, 21.198),
  L(18.949, 18.292, 21.437, 18.208),
  L(24.687, 26.288, 22.335, 23.026),
  L(22.335, 23.026, 21.04, 26.748),
  L(21.04, 26.748, 23.395, 27.064),
];
/** Ba cuon day TU thanh cai - theo block "22-TUC" / "6-TUC" / "35-TUC" trong CAD. */
const CAD_TU3P: Prim[] = [
  C(0, -5.781, 5.781),
  C(6.781, -9.561, 5.781),
  C(-0.025, -13.311, 5.781),
  L(0, -5.781, -3.538, -7.7),
  L(0, -5.781, 2.906, -7.41),
  L(0, -5.781, -0.084, -3.292),
  L(-0.025, -13.311, -3.563, -15.23),
  L(-0.025, -13.311, 2.881, -14.941),
  L(-0.025, -13.311, -0.109, -10.822),
  L(7.969, -7.573, 4.707, -9.925),
  L(4.707, -9.925, 8.429, -11.22),
  L(8.429, -11.22, 8.745, -8.864),
  L(0, -5.781, -4.032, -5.091),
  C(-4.032, -5.091, 0.5),
  L(-0.025, -13.311, -4.047, -12.621),
  C(-4.047, -12.621, 0.5),
];


/** MBA 110-35-22: ba cuon day (110 dau Y, 35 dau tam giac, 22 dau Y). */
const CAD_MBA3: Prim[] = [
  C(21.91, 0, 21.91),
  L(21.91, 0, 24.418, -13.893),
  L(21.91, 0, 31.97, 9.909),
  L(21.91, 0, 9.587, 4.128),
  C(49.401, -10.533, 21.91),
  P(true, false, 37.766, -6.075, 51.358, -22.839, 59.08, -2.686),
  C(22.512, -34.319, 21.91),
  L(22.512, -34.319, 25.02, -48.212),
  L(22.512, -34.319, 32.572, -24.41),
  L(22.512, -34.319, 10.189, -30.191),
];

/** MBA 2 cuon (lay theo ty le cua MBA 110-35-22, cuon tren Y, cuon duoi tam giac). */
const CAD_MBA2: Prim[] = [
  C(0, 0, 21.91),
  L(0, 0, 2.508, -13.893),
  L(0, 0, 10.06, 9.909),
  L(0, 0, -12.323, 4.128),
  C(0, -34.319, 21.91),
  P(true, false, -12.5, -27.5, 12.5, -27.5, 0, -47.5),
];

/** MBA phan phoi 22/0,4kV (hai vong tron nho). */
const CAD_MBAPP: Prim[] = [C(0, -6.423, 6.423), C(-0.061, -14.663, 6.423)];

/** Tu 22: tu bu - hai ban cuc song song. */
const CAD_TUBU: Prim[] = [L(-4.343, 0, 4.343, 0), L(-4.343, -7.237, 4.343, -7.237), L(0, 0, 0, 4), L(0, -7.237, 0, -11.237)];

/** 22-Khang: khang dien (cuon khang). */
const CAD_KHANG: Prim[] = [
  L(0, 7.089, 0, 0),
  A(0, 0, 6.187, -90, 180),
  L(0, -6.187, 0, -13.7),
];

/** 22-R: recloser - hinh chu nhat co chu R. Trong CAD truc nam ngang. */
const CAD_REC: Prim[] = [
  P(true, false, 0, -7.452, 0, 7.452, 39.834, 7.452, 39.834, -7.452),
  L(-6, 0, 0, 0),
  L(39.834, 0, 45.834, 0),
  T(13.766, -6.404, 'R', 13.813),
];

/** LBS: dao cat co tai = dao cach ly nam trong hop. */
const CAD_LBS: Prim[] = [
  P(true, false, -10.9, -11.9, 10.9, -11.9, 10.9, 11.9, -10.9, 11.9),
  L(0, 20, 0, 6),
  L(0, -6, 0, -20),
  L(0, -6, 9.7, 1),
];

/** Cau chi tu roi FCO (ve theo quy uoc EVN - khong co block rieng trong file CAD goc). */
const CAD_FCO: Prim[] = [
  L(0, 10, 0, 6),
  P(true, false, -3.2, 6, 3.2, 6, 3.2, -6, -3.2, -6),
  L(0, -6, 0, -10),
];

/** Cot (35-Cot): diem cot / vi tri tren tuyen. */
const CAD_COT: Prim[] = [C(0, 0, 3.134, true)];

/** Dau cap (chuyen tiep DDK <-> cap ngam). */
const CAD_DAUCAP: Prim[] = [
  L(0, 9, 0, 3),
  P(true, true, -3.4, 3, 3.4, 3, 0, -3),
  L(0, -3, 0, -9),
];

/** Bo do dem (35-BDD): cong to do dem. */
const CAD_BDD: Prim[] = [
  C(0, 0, 6.5),
  L(0, 6.5, 0, 12),
  L(0, -6.5, 0, -12),
  L(-3.2, 1.6, 3.2, 1.6),
  L(-3.2, -1.6, 3.2, -1.6),
];

/** SVC / thiet bi bu tinh. */
const CAD_SVC: Prim[] = [
  L(0, 12, 0, 7),
  P(true, false, -7, 7, 7, 7, 7, -7, -7, -7),
  L(-7, 7, 7, -7),
  L(0, -7, 0, -12),
];

/* ------------------------------------------------------------------ */
/* Dang ky block                                                       */
/* ------------------------------------------------------------------ */

function make(
  id: string,
  name: string,
  abbr: string,
  group: BlockGroup,
  cad: Prim[],
  opts: {
    rot?: number;
    switching?: boolean;
    inline?: boolean;
    open?: Prim[];
    openRot?: number;
    fillWhenClosed?: boolean;
    source: string;
  },
): BlockDef {
  const norm = normalizeCad(cad, opts.rot ?? 0, K);
  const b = primBounds(norm.prims);
  const def: BlockDef = {
    id,
    name,
    abbr,
    group,
    prims: norm.prims,
    switching: opts.switching ?? false,
    inline: opts.inline ?? true,
    span: Math.max(0.1, b.maxY - b.minY),
    normRot: opts.rot ?? 0,
    origin: norm.origin,
    bbox: [Math.max(1e-6, b.maxX - b.minX), Math.max(1e-6, b.maxY - b.minY)],
    source: opts.source,
  };
  if (opts.fillWhenClosed) def.fillWhenClosed = true;
  if (opts.open) def.primsOpen = normalizeCad(opts.open, opts.openRot ?? opts.rot ?? 0, K).prims;
  return def;
}

export const BLOCKS: BlockDef[] = [
  /* ---------------------------- Dong cat --------------------------- */
  make('MC', 'Máy cắt', 'MC', 'Đóng cắt', CAD_MC, {
    switching: true,
    fillWhenClosed: true,
    source: 'CAD: block "110-MC"',
  }),
  make('MCHB', 'Máy cắt hợp bộ', 'MCHB', 'Đóng cắt', CAD_MCHB, {
    switching: true,
    fillWhenClosed: true,
    source: 'CAD: block "22-MCHB"',
  }),
  make('DCL', 'Dao cách ly', 'DCL', 'Đóng cắt', CAD_DCL, {
    rot: 90,
    switching: true,
    open: CAD_DCL_MO,
    openRot: 0,
    source: 'CAD: block "110-DCL" (đóng) / "22-DCL Mo" (mở)',
  }),
  make('DCLHB', 'Dao cách ly hợp bộ', 'DCLHB', 'Đóng cắt', CAD_DCLHB, {
    switching: true,
    source: 'CAD: block "22-DCLHB"',
  }),
  make('DTD', 'Dao tiếp địa', 'DTĐ', 'Đóng cắt', CAD_DTD, {
    rot: 90,
    switching: true,
    inline: false,
    source: 'CAD: block "110-Tiep Dia"',
  }),
  make('TD', 'Tiếp địa trực tiếp', 'TĐ', 'Đóng cắt', CAD_TD_TRUCTIEP, {
    inline: false,
    source: 'CAD: block "22-Tiep dia ko DCL"',
  }),
  make('REC', 'Recloser', 'REC', 'Đóng cắt', CAD_REC, {
    rot: 90,
    switching: true,
    source: 'CAD: block "22-R"',
  }),
  make('LBS', 'Dao cắt có tải (LBS)', 'LBS', 'Đóng cắt', CAD_LBS, {
    switching: true,
    source: 'CAD: block "LBS 22kV"',
  }),
  make('FCO', 'Cầu chì tự rơi (FCO)', 'FCO', 'Đóng cắt', CAD_FCO, {
    switching: true,
    source: 'Vẽ theo quy ước EVN',
  }),

  /* ------------------------ Do luong - bao ve ---------------------- */
  make('TI', 'Biến dòng điện (TI)', 'TI', 'Đo lường - Bảo vệ', CAD_TI, {
    source: 'CAD: block "110-TI"',
  }),
  make('TU', 'Biến điện áp (TU)', 'TU', 'Đo lường - Bảo vệ', CAD_TU, {
    inline: false,
    source: 'CAD: block "22-TU1"',
  }),
  make('TUC', 'TU thanh cái 3 pha', 'TUC', 'Đo lường - Bảo vệ', CAD_TUC, {
    inline: false,
    source: 'CAD: block "110-TUC"',
  }),
  make('TU3P', 'TU 3 pha (3 cuộn)', 'TU3', 'Đo lường - Bảo vệ', CAD_TU3P, {
    inline: false,
    source: 'CAD: block "22-TUC" / "6-TUC" / "35-TUC"',
  }),
  make('CSV', 'Chống sét van', 'CSV', 'Đo lường - Bảo vệ', CAD_CSV, {
    rot: 90,
    inline: false,
    source: 'CAD: block "110-CSV"',
  }),
  make('BDD', 'Bộ đo đếm', 'BĐĐ', 'Đo lường - Bảo vệ', CAD_BDD, {
    source: 'CAD: block "35-BDD"',
  }),

  /* ----------------------- May bien ap - Bu ------------------------ */
  make('MBA3', 'MBA 3 cuộn dây (110/35/22)', 'MBA', 'Máy biến áp - Bù', CAD_MBA3, {
    source: 'CAD: block "MBA 110-35-22"',
  }),
  make('MBA2', 'MBA 2 cuộn dây', 'MBA', 'Máy biến áp - Bù', CAD_MBA2, {
    source: 'Theo tỷ lệ block "MBA 110-35-22"',
  }),
  make('MBAPP', 'MBA phân phối', 'MBA', 'Máy biến áp - Bù', CAD_MBAPP, {
    source: 'CAD: block "MBA phân phối 22-0.4"',
  }),
  make('TUBU', 'Tụ bù', 'TB', 'Máy biến áp - Bù', CAD_TUBU, {
    inline: false,
    source: 'CAD: block "Tụ 22"',
  }),
  make('KHANG', 'Kháng điện', 'KH', 'Máy biến áp - Bù', CAD_KHANG, {
    source: 'CAD: block "22-Khang"',
  }),
  make('SVC', 'Thiết bị bù SVC', 'SVC', 'Máy biến áp - Bù', CAD_SVC, {
    inline: false,
    source: 'Vẽ theo quy ước EVN',
  }),

  /* ------------------------------ Khac ----------------------------- */
  make('COT', 'Vị trí cột', 'VT', 'Khác', CAD_COT, {
    source: 'CAD: block "35-Cot"',
  }),
  make('DAUCAP', 'Đầu cáp', 'ĐC', 'Khác', CAD_DAUCAP, {
    source: 'Vẽ theo quy ước EVN',
  }),
];

const BY_ID = new Map<string, BlockDef>(BLOCKS.map((b) => [b.id, b]));

export function getBlock(id: string): BlockDef | undefined {
  return BY_ID.get(id);
}

export function blockGroups(): { group: BlockGroup; blocks: BlockDef[] }[] {
  const groups: BlockGroup[] = ['Đóng cắt', 'Đo lường - Bảo vệ', 'Máy biến áp - Bù', 'Khác'];
  return groups.map((g) => ({ group: g, blocks: BLOCKS.filter((b) => b.group === g) }));
}

/** Hinh ve thuc te cua thiet bi theo trang thai dong/mo. */
export function primsFor(def: BlockDef, state?: string): Prim[] {
  if (state === 'mo' && def.primsOpen) return def.primsOpen;
  return def.prims;
}

