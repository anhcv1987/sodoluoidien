/**
 * Mo hinh du lieu so do nguyen ly mot soi (single-line diagram) luoi dien.
 *
 * Toan bo toa do trong file la toa do "the gioi" (world) tinh bang don vi ban ve.
 * Quy uoc: 1 don vi ban ve = 1 km thuc dia khi chieu tu toa do dia ly.
 * Truc X huong Dong, truc Y huong Bac (giong CAD, khac voi truc man hinh).
 */

/** Cap dien ap (kV) duoc phan mem ho tro. */
export type VoltageKv = 500 | 220 | 110 | 35 | 22 | 10 | 6 | 0.4;

export const VOLTAGE_LEVELS: VoltageKv[] = [500, 220, 110, 35, 22, 10, 6, 0.4];

/** Kieu duong day: tren khong hoac cap ngam. */
export type LineKind = 'ĐDK' | 'Cáp ngầm' | 'Cáp vặn xoắn' | 'Thanh cái';

/** Diem 2D. */
export interface Pt {
  x: number;
  y: number;
}

/** Ma dinh danh duy nhat cua mot doi tuong trong ban ve. */
export type Id = string;

/* ------------------------------------------------------------------ */
/* Lop (layer)                                                         */
/* ------------------------------------------------------------------ */

export interface Layer {
  name: string;
  /** Mau ghi de; neu bo trong thi lay mau theo cap dien ap. */
  color?: string;
  visible: boolean;
  /** Khoa lop: van hien thi nhung khong chon/sua duoc. */
  locked: boolean;
  /** Be day net ve (pixel tai zoom 100%). */
  lineWidth?: number;
}

/* ------------------------------------------------------------------ */
/* Cac thuc the tren ban ve                                            */
/* ------------------------------------------------------------------ */

export type EntityKind = 'node' | 'branch' | 'device' | 'substation' | 'text' | 'boundary';

export interface EntityBase {
  id: Id;
  kind: EntityKind;
  layer: string;
  kv: VoltageKv;
  /** Ghi chu tu do cua nguoi dung. */
  note?: string;
}

/**
 * Nut dien: diem noi chung cua nhieu nhanh, dau/cuoi tuyen, vi tri cot...
 * Nut khong nhat thiet phai ve ra; no la "xuong song" de dinh tuyen.
 */
export interface NodeEntity extends EntityBase {
  kind: 'node';
  p: Pt;
  /** Ten nut hien thi (VD: "Cot 27", "Nut re T2"). */
  label?: string;
  /** Kieu nut anh huong den cach ve. */
  nodeType: 'noi' | 'cot' | 're-nhanh' | 'dau-cuoi' | 'an';
  /** Neu nut nam trong mot tram, ghi id cua tram. */
  substationId?: Id;
}

/** Thong so day dan / cap - phuc vu giai doan 2 (luoi trung ap). */
export interface ConductorSpec {
  /** Ma hieu day: AC-120, AC-95, ACKP-185, Cu/XLPE/PVC 3x240, AXV/XLPE-240... */
  code: string;
  /** Tiet dien danh dinh (mm2), suy ra tu ma hieu neu co the. */
  section?: number;
  /** So mach song song. */
  circuits?: number;
  /** Dong dien cho phep lau dai (A). */
  ampacity?: number;
}

/**
 * Nhanh: doan duong day / cap / thanh cai noi cac nut.
 * Duong di la polyline qua danh sach nut (>= 2 nut).
 */
export interface BranchEntity extends EntityBase {
  kind: 'branch';
  /** Danh sach id nut theo thu tu tu dau den cuoi. */
  nodes: Id[];
  lineKind: LineKind;
  conductor?: ConductorSpec;
  /** Chieu dai thuc te (km) do nguoi dung nhap; neu trong thi tinh theo hinh hoc. */
  lengthKm?: number;
  /** Ten tuyen / lo: "471 E6.5", "Thanh cai C41". */
  label?: string;
  /** Thanh cai ve net dam hon va co the ve ngang. */
  busWidth?: number;
}

/** Trang thai dong cat cua thiet bi. */
export type SwitchState = 'dong' | 'mo' | 'khong-xac-dinh';

/**
 * Thiet bi: mot "block" dat tai mot vi tri, co goc quay va ty le.
 * Loai thiet bi tra cuu trong thu vien block (symbols/registry).
 */
export interface DeviceEntity extends EntityBase {
  kind: 'device';
  /** Ma block: MC, DCL, DTD, REC, LBS, FCO, CSV, TU, TI, MBA2, MBA3, TUBU, KHANG... */
  block: string;
  p: Pt;
  /** Goc quay (do), nguoc chieu kim dong ho, 0 = huong sang phai. */
  rot: number;
  /** He so phong to block. */
  scale: number;
  /** Nhan thiet bi: "131", "471-7", "DCL 371-7". */
  label?: string;
  /** Trang thai dong/mo (chi co y nghia voi thiet bi dong cat). */
  state?: SwitchState;
  /** Nhanh ma thiet bi nam tren (neu co) - de tinh toan ket luoi. */
  onBranch?: Id;
  /** Tram chua thiet bi (neu thiet bi nam trong tram). */
  substationId?: Id;
  /** Thuoc tinh mo rong: cong suat MBA, Un, In, ma hieu... */
  attrs?: Record<string, string>;
}

/** Mot may bien ap trong tram. */
export interface TransformerInfo {
  name: string;
  /** VD: "40 MVA", "2x40 MVA". */
  capacity: string;
  /** VD: "110/35/22 kV". */
  ratio: string;
}

/**
 * Tram bien ap 220/110kV - hien thi tren so do tinh nhu mot khoi
 * dat gan dung vi tri dia ly, co the mo ra xem so do nguyen ly trong tram.
 */
export interface SubstationEntity extends EntityBase {
  kind: 'substation';
  /** Ten day du: "TBA 110kV Song Cong". */
  name: string;
  /** Ma tram theo EVN: E6.5, E26.1... */
  code: string;
  /** Vi tri tam khoi tram tren so do tinh. */
  p: Pt;
  /** Toa do dia ly de tham chieu / dinh vi lai. */
  lat?: number;
  lon?: number;
  /** Don vi hanh chinh (xa/phuong sau sap nhap 2025). */
  commune?: string;
  /** Cac cap dien ap co trong tram, VD [110, 35, 22]. */
  levels: VoltageKv[];
  transformers: TransformerInfo[];
  /** Kich thuoc khoi ve tren so do tinh. */
  w: number;
  h: number;
  /** Don vi quan ly: PC Thai Nguyen, Truyen tai, khach hang... */
  owner?: string;
  /** So do nguyen ly chi tiet ben trong tram (ban ve con). */
  internalSheet?: Id;
}

export interface TextEntity extends EntityBase {
  kind: 'text';
  p: Pt;
  text: string;
  height: number;
  rot: number;
  align: 'left' | 'center' | 'right';
}

/** Duong ranh gioi hanh chinh / song ngoi lam nen. */
export interface BoundaryEntity extends EntityBase {
  kind: 'boundary';
  pts: Pt[];
  closed: boolean;
  /** Ten vung: "Ranh gioi tinh", "Ho Nui Coc". */
  name?: string;
  fill?: string;
}

export type Entity =
  | NodeEntity
  | BranchEntity
  | DeviceEntity
  | SubstationEntity
  | TextEntity
  | BoundaryEntity;

/* ------------------------------------------------------------------ */
/* Ban ve                                                              */
/* ------------------------------------------------------------------ */

/** Mot "sheet": so do tinh, hoac so do nguyen ly trong mot tram. */
export interface Sheet {
  id: Id;
  name: string;
  /** 'tinh' = so do luoi toan tinh; 'tram' = so do nguyen ly mot tram. */
  type: 'tinh' | 'tram' | 'trung-ap';
  entities: Record<Id, Entity>;
  /** Neu la sheet tram, tro ve id tram tren so do tinh. */
  substationId?: Id;
}

export interface Drawing {
  /** Phien ban dinh dang file, de nang cap ve sau. */
  version: number;
  title: string;
  /** Don vi lap: Phong Dieu do - Cong ty Dien luc Thai Nguyen. */
  org: string;
  createdAt: string;
  updatedAt: string;
  layers: Record<string, Layer>;
  sheets: Sheet[];
  activeSheet: Id;
}

export const FILE_VERSION = 1;
