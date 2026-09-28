/**
 * MÃ HIỆU DÂY DẪN / CÁP - đọc từ nhãn trên bản vẽ và tra dòng điện cho phép tham khảo.
 *
 * Nhãn trên bản vẽ ghi rất nhiều kiểu: "AC120", "AC 150", "AC-240", "ACSR 185", "AC185 - 17,04km",
 * "AC 185/362m", "Cu 3x240", "Cu-3x240-0,15km", "Cu/XLPE/PVC 1x500", "2x(Cu/XLPE/PVC 1x500)",
 * "3xAL 1x400 - 148m", "AL/XLPE/CTS/PVC/DATA-W-3x(1x400)", "XLPE Cu 3x150mm2", "AXV-120"...
 * docMaDay() đưa về một mã chuẩn thống nhất (để lọc / thống kê) kèm số sợi song song mỗi pha và
 * chiều dài (m) nếu nhãn có ghi.
 */

export type LoaiDay = 'ddk' | 'boc' | 'cap';

export interface MaDay {
  /** Mã chuẩn hoá: "AC-120", "ACSR-185", "AXV-120", "Cu/XLPE 3x240", "Al/XLPE 1x400". */
  ma: string;
  loai: LoaiDay;
  /** Vật liệu lõi. */
  vatLieu: 'Al' | 'Cu' | '?';
  /** Tiết diện một lõi (mm2). */
  tietDien: number;
  /** Số lõi của một sợi cáp (3 lõi / 1 lõi); dây trần = 1. */
  soLoi: number;
  /** Số sợi (mạch) song song mỗi pha: "2x(Cu/XLPE 1x500)" -> 2. */
  songSong: number;
  /** Chiều dài ghi trên nhãn (m). */
  daiM?: number;
}

const TIET_DIEN_HOP_LE = new Set([10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630, 800]);

/** Chiều dài trên nhãn: "1540m", "0,15km", "17,04km", "l= 134m" -> mét. */
function docChieuDai(s: string): number | undefined {
  const m = /(\d+(?:[.,]\d+)?)\s*(km|m)\b/i.exec(s);
  if (!m) return undefined;
  const v = Number(m[1].replace(',', '.'));
  if (!Number.isFinite(v) || v <= 0) return undefined;
  return m[2].toLowerCase() === 'km' ? Math.round(v * 1000) : Math.round(v);
}

/**
 * Đọc mã dây / cáp từ một nhãn. Trả về null nếu nhãn không phải mã dây (tên thiết bị, tên trạm...).
 */
export function docMaDay(nhan: string): MaDay | null {
  const s = nhan.replace(/\s+/g, ' ').trim();
  if (!s || s.length > 60) return null;
  // tên thiết bị / trạm / TBA có chứa số - không phải nhãn dây
  if (/^(DCL|LBS|MC|REC|FCO|DPT|CDPT|RMU|TBA|MBA|CQT|TD|TU|TI|CS|DTĐ|DTD|Tủ|TỦ|Trạm|TRẠM|NR|Cty|UB|AT\d)\b/i.test(s)) return null;
  const daiM = docChieuDai(s.replace(/\d+\s*mm2?/gi, ''));

  // --- dây trần nhôm lõi thép / dây bọc: AC, ACSR, ACKP, TACSR, AXV, AsXV ---
  // mạch kép ghi "AC2x185"
  const kep = /\b(ACSR|AC)\s*(\d)\s*x\s*(\d{2,3})\b/i.exec(s);
  if (kep && TIET_DIEN_HOP_LE.has(Number(kep[3]))) {
    const tiet = Number(kep[3]);
    return { ma: `${kep[1].toUpperCase()}-${tiet}`, loai: 'ddk', vatLieu: 'Al', tietDien: tiet, soLoi: 1, songSong: Number(kep[2]), daiM };
  }
  const ddk = /\b(TACSR|ACSR|ACKP|AC|AsXV|AXV|ABC)\s*[-/]?\s*(\d{2,3})(?:\s*\/\s*(\d{1,2})(?!\d*\s*m))?/i.exec(s);
  if (ddk && !/XLPE/i.test(s.slice(0, ddk.index))) {
    const tiet = Number(ddk[2]);
    if (!TIET_DIEN_HOP_LE.has(tiet) && tiet !== 157) return null;
    const goc = ddk[1].toUpperCase().replace('ASXV', 'AsXV');
    const boc = /AXV|AsXV|ABC/i.test(goc);
    const songSong = /^\s*2\s*x\s*[(A]/i.test(s) ? 2 : 1;
    return {
      ma: `${goc}-${tiet}`,
      loai: boc ? 'boc' : 'ddk',
      vatLieu: 'Al',
      tietDien: tiet,
      soLoi: 1,
      songSong,
      daiM,
    };
  }

  // --- cáp: có Cu / Al / XLPE và dạng "n x S" ---
  if (!/(Cu|\bAL?\b|Al\/|XLPE|\bM\s*\d|\d\s*x\s*\(?\s*AL)/i.test(s)) return null;
  // n x (1 x S), 3x(1x400)
  let soLoi = 0;
  let tiet = 0;
  let songSong = 1;
  // sợi một lõi: "3x(1x400)" (ba pha), "3x2(1x630)" / "2x(1x630)/1 pha" / "3x(1x500)/pha" (song song)
  const motLoi = /(\d)\s*[x*]\s*(\d)?\s*\(\s*1\s*x\s*(\d{2,3})/i.exec(s);
  const ngoaiSongSong = /^\s*(\d)\s*x\s*\(/i.exec(s);
  const nx = /(\d)\s*x\s*(\d{2,3})(?!\d)/i.exec(s.replace(/^\s*\d\s*x\s*\(/, '('));
  if (motLoi) {
    soLoi = 1;
    tiet = Number(motLoi[3]);
    const a = Number(motLoi[1]);
    const b = motLoi[2] ? Number(motLoi[2]) : 0;
    songSong = /pha/i.test(s) ? b || a : b || (a === 3 ? 1 : a);
  } else if (nx) {
    soLoi = Number(nx[1]);
    tiet = Number(nx[2]);
    if (ngoaiSongSong) songSong = Number(ngoaiSongSong[1]);
  } else return null;
  // "3xAL 1x400": tiền tố 3x là ba sợi một lõi cho ba pha, không phải song song
  if (/^\s*3\s*x\s*AL/i.test(s)) songSong = 1;
  if (!TIET_DIEN_HOP_LE.has(tiet) || (soLoi !== 1 && soLoi !== 3 && soLoi !== 4)) return null;
  const vatLieu: MaDay['vatLieu'] = /(Cu|\bM\s*\d)/i.test(s) ? 'Cu' : /(\bAL?\b|Al\/|AL\/|xAL)/i.test(s) ? 'Al' : '?';
  const loi = soLoi === 4 ? 3 : soLoi; // 3(4x1): coi như 3 pha
  const ma = `${vatLieu === '?' ? '' : vatLieu + '/'}XLPE ${loi}x${tiet}`;
  return { ma: songSong > 1 ? `${songSong}x(${ma})` : ma, loai: 'cap', vatLieu, tietDien: tiet, soLoi: loi, songSong, daiM };
}

/**
 * Dòng điện cho phép lâu dài THAM KHẢO (A, một sợi / một mạch) của dây nhôm lõi thép trần (AC, ACSR,
 * ACKP) - bảng thường dùng trong thiết kế lưới phân phối (nhiệt độ môi trường 25°C, dây 70°C, không
 * gió mạnh). Chỉ để gợi ý: dòng định mức chính thức phải theo catalogue nhà sản xuất và điều kiện vận
 * hành thực tế (nhiệt độ môi trường mùa hè, tiếp xúc, lèo, thiết bị trên đoạn...).
 *
 * Cáp ngầm, cáp bọc: dòng cho phép phụ thuộc nhiều vào cách lắp đặt (chôn trực tiếp / trong ống / trên
 * giá, số cáp đi chung, nhiệt trở đất) nên KHÔNG gợi ý - nhập theo catalogue.
 */
const ICP_AC: Record<number, number> = {
  35: 175,
  50: 210,
  70: 265,
  95: 330,
  120: 390,
  150: 445,
  185: 510,
  240: 610,
  300: 690,
  400: 835,
  500: 945,
};

/** Icp tham khảo của một sợi (A) - chỉ dây trần AC / ACSR / ACKP; không có thì undefined. */
export function icpThamKhao(m: MaDay | null): number | undefined {
  if (!m || m.loai !== 'ddk' || /^TACSR/.test(m.ma)) return undefined;
  return ICP_AC[m.tietDien];
}

/** Một chữ trên bản vẽ (để dò nhãn mã dây). */
export interface ChuBanVe {
  s: string;
  x: number;
  y: number;
  /** Chiều cao chữ. */
  h: number;
  /** Góc quay (độ). */
  rot: number;
  align: 'left' | 'center' | 'right';
}

/** Mã dây gợi ý cho một đoạn theo nhãn ghi trên bản vẽ. */
export interface GoiYDay {
  ma: MaDay;
  /** Nguyên văn nhãn. */
  nhan: string;
  /** Khoảng cách nhãn - nét dây (để chọn nhãn gần nhất khi một đoạn có nhiều nhãn). */
  kc: number;
}

/**
 * Gắn nhãn mã dây trên bản vẽ vào đoạn dây: nét dây gần tâm nhãn nhất, chạy song song với chữ
 * (lệch không quá ~20°), cách không quá 3 lần chiều cao chữ. Trả về: chỉ số đoạn -> gợi ý.
 * `canh`: toạ độ các cạnh vẽ (x1, y1, x2, y2), `doanCua`: cạnh -> đoạn.
 */
export function ganNhanDay(chu: ChuBanVe[], canh: { x1: Float64Array; y1: Float64Array; x2: Float64Array; y2: Float64Array }, doanCua: Int32Array): Map<number, GoiYDay> {
  const O = 25;
  const luoi = new Map<string, number[]>();
  const m = doanCua.length;
  for (let i = 0; i < m; i++) {
    const x0 = Math.floor(Math.min(canh.x1[i], canh.x2[i]) / O), x1 = Math.floor(Math.max(canh.x1[i], canh.x2[i]) / O);
    const y0 = Math.floor(Math.min(canh.y1[i], canh.y2[i]) / O), y1 = Math.floor(Math.max(canh.y1[i], canh.y2[i]) / O);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 400) continue; // nét rất dài: bỏ qua ô, dò riêng bên dưới
    for (let a = x0; a <= x1; a++) for (let b = y0; b <= y1; b++) {
      const k = `${a},${b}`;
      const l = luoi.get(k);
      if (l) l.push(i);
      else luoi.set(k, [i]);
    }
  }
  const dai: number[] = [];
  for (let i = 0; i < m; i++) {
    const x0 = Math.floor(Math.min(canh.x1[i], canh.x2[i]) / O), x1 = Math.floor(Math.max(canh.x1[i], canh.x2[i]) / O);
    const y0 = Math.floor(Math.min(canh.y1[i], canh.y2[i]) / O), y1 = Math.floor(Math.max(canh.y1[i], canh.y2[i]) / O);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 400) dai.push(i);
  }
  const kq = new Map<number, GoiYDay>();
  for (const c of chu) {
    const ma = docMaDay(c.s);
    if (!ma) continue;
    const r = (c.rot * Math.PI) / 180;
    const ux = Math.cos(r), uy = Math.sin(r);
    const nx = -uy, ny = ux;
    const w = c.s.length * c.h * 0.55;
    const lech = c.align === 'left' ? w / 2 : c.align === 'right' ? -w / 2 : 0;
    const cx = c.x + ux * lech + nx * c.h * 0.5;
    const cy = c.y + uy * lech + ny * c.h * 0.5;
    const R = Math.max(3 * c.h, 8) + w / 2;
    const ung = new Set<number>(dai);
    for (let a = Math.floor((cx - R) / O); a <= Math.floor((cx + R) / O); a++) {
      for (let b = Math.floor((cy - R) / O); b <= Math.floor((cy + R) / O); b++) for (const i of luoi.get(`${a},${b}`) ?? []) ung.add(i);
    }
    let tot = -1;
    let bd = Math.max(3 * c.h, 8);
    for (const i of ung) {
      const dx = canh.x2[i] - canh.x1[i], dy = canh.y2[i] - canh.y1[i];
      const L = Math.hypot(dx, dy);
      if (L < 1e-6) continue;
      // song song với chữ
      if (Math.abs((dx * uy - dy * ux) / L) > 0.35) continue;
      // khoảng cách từ ĐƯỜNG TÂM chữ (đoạn dài w) tới nét
      const t = Math.max(0, Math.min(1, ((cx - canh.x1[i]) * dx + (cy - canh.y1[i]) * dy) / (L * L)));
      const px = canh.x1[i] + dx * t, py = canh.y1[i] + dy * t;
      // nét phải chạy qua (hoặc sát) bề ngang của chữ
      const doc = Math.abs((px - cx) * ux + (py - cy) * uy);
      if (doc > w / 2 + 2 * c.h) continue;
      const ngang = Math.abs((px - cx) * nx + (py - cy) * ny);
      if (ngang < bd) {
        bd = ngang;
        tot = i;
      }
    }
    if (tot < 0) continue;
    const k = doanCua[tot];
    const cu = kq.get(k);
    if (!cu || bd < cu.kc) kq.set(k, { ma, nhan: c.s, kc: bd });
  }
  return kq;
}
