import type { VoltageKv } from './types';

/**
 * Quy uoc mau theo cap dien ap - theo yeu cau cua Phong Dieu do PC Thai Nguyen:
 *   110kV = DO, 35kV = VANG, 22kV = XANH.
 * Cac cap con lai dung mau bo sung cho du bo, nguoi dung co the sua trong
 * bang "Cap dien ap" cua phan mem.
 */
export interface VoltageStyle {
  kv: VoltageKv;
  /** Ten hien thi tren giao dien. */
  name: string;
  /** Mau net ve (nen toi). */
  color: string;
  /** Mau net ve khi in / nen sang. */
  printColor: string;
  /** Be day net co ban (px tai zoom 100%). */
  width: number;
  /** Ten lop mac dinh sinh ra cho cap dien ap nay. */
  layer: string;
}

export const VOLTAGE_STYLES: Record<string, VoltageStyle> = {
  '500': { kv: 500, name: '500kV', color: '#ff6ec7', printColor: '#c2007a', width: 3.2, layer: '500kV' },
  '220': { kv: 220, name: '220kV', color: '#b76bff', printColor: '#6a1fb0', width: 2.8, layer: '220kV' },
  '110': { kv: 110, name: '110kV', color: '#ff3b30', printColor: '#d00000', width: 2.4, layer: '110kV' },
  '35': { kv: 35, name: '35kV', color: '#ffd400', printColor: '#b58900', width: 2.0, layer: '35kV' },
  '22': { kv: 22, name: '22kV', color: '#2ea3ff', printColor: '#0060c0', width: 1.8, layer: '22kV' },
  '10': { kv: 10, name: '10kV', color: '#ff9f0a', printColor: '#c05600', width: 1.6, layer: '10kV' },
  '6': { kv: 6, name: '6kV', color: '#30d158', printColor: '#1a7f37', width: 1.6, layer: '6kV' },
  '0.4': { kv: 0.4, name: '0,4kV', color: '#9aa4b2', printColor: '#4b5563', width: 1.2, layer: '0,4kV' },
};

export function styleOf(kv: VoltageKv): VoltageStyle {
  return VOLTAGE_STYLES[String(kv)] ?? VOLTAGE_STYLES['22'];
}

export function colorOf(kv: VoltageKv, printMode = false): string {
  const s = styleOf(kv);
  return printMode ? s.printColor : s.color;
}

export function layerOf(kv: VoltageKv): string {
  return styleOf(kv).layer;
}

/** Danh sach cap dien ap theo thu tu giam dan de dung cho combo box. */
export function allStyles(): VoltageStyle[] {
  return Object.values(VOLTAGE_STYLES).sort((a, b) => b.kv - a.kv);
}
