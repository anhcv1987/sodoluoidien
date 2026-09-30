/**
 * ĐỐI CHIẾU PHIẾU CHỈNH ĐỊNH VỚI MÁY CẮT / RECLOSER TRÊN SƠ ĐỒ KẾT DÂY TỔNG.
 *
 *   node tools/chinh-dinh/doi-chieu.ts [ra.json]
 *
 * Dùng đúng quy tắc ghép của phần mềm (src/core/chinhDinh.ts): nhãn quanh thiết bị
 * + mã trạm chứa thiết bị -> khoá; phiếu -> khoá theo tên máy cắt ghi trên phiếu.
 * Ghi ra JSON gồm: thiết bị chưa có phiếu, phiếu chưa có thiết bị, phiếu cần lưu ý.
 * tools/chinh-dinh/xuat-excel.py đọc file này để lập bảng Excel gửi Phòng Điều độ.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { ChiMucCD, khoaPhieu, khoaThietBi, laBanLuu, type PhieuCD } from '../../src/core/chinhDinh.ts';

type Row = (number | string)[];
const d = JSON.parse(readFileSync('src/data/tram-sld.json', 'utf8'));
const ds: PhieuCD[] = JSON.parse(readFileSync('src/data/chinhDinh.json', 'utf8'));
const cm = new ChiMucCD(ds);
const to = d.sheets.find((s: { code: string }) => s.code === 'TONG');

const hop = (to.st as Row[]).filter((r) => r.length >= 8);
const tenTram = new Map(hop.map((r) => [String(r[0]), String(r[1])]));
const LOAI: Record<string, string> = { MC: 'Máy cắt', MCHB: 'Máy cắt hợp bộ', REC: 'Recloser' };
type TB = { to: string; loai: string; kv: number; tram: string; nhan: string; khoa: string; x: number; y: number; soPhieu: number };
const thietBi: TB[] = [];
const khoaCo = new Set<string>();

for (const sh of d.sheets as { code: string; title: string; d: number[][]; t: Row[]; st?: Row[] }[]) {
  // chỉ mục chữ theo lưới 50 đơn vị
  const luoi = new Map<string, [string, number, number][]>();
  for (const t of sh.t) {
    const k = `${Math.floor((t[2] as number) / 50)}|${Math.floor((t[3] as number) / 50)}`;
    (luoi.get(k) ?? luoi.set(k, []).get(k)!).push([String(t[8]).trim(), t[2] as number, t[3] as number]);
  }
  const quanh = (x: number, y: number, r: number): string[] => {
    const a: [number, string][] = [];
    for (let i = Math.floor((x - r) / 50); i <= Math.floor((x + r) / 50); i++)
      for (let j = Math.floor((y - r) / 50); j <= Math.floor((y + r) / 50); j++)
        for (const [s, tx, ty] of luoi.get(`${i}|${j}`) ?? []) {
          const dd = Math.hypot(tx - x, ty - y);
          if (dd <= r) a.push([dd, s]);
        }
    return a.sort((p, q) => p[0] - q[0]).map((p) => p[1]);
  };
  const o = (sh.st ?? []).filter((r) => r.length >= 8);
  const tramCua = (x: number, y: number): string =>
    String(o.find((r) => x >= (r[4] as number) && x <= (r[6] as number) && y >= (r[5] as number) && y <= (r[7] as number))?.[0] ?? '');
  for (const r of sh.d) {
    const bl = d.blocks[r[2]];
    if (!LOAI[bl]) continue;
    const [x, y, sc] = [r[3], r[4], r[6]];
    const tram = tramCua(x, y);
    const gan = quanh(x, y, tram ? Math.max(sc * 2.5, 25) : 70);
    const k = khoaThietBi(gan, tram || undefined);
    const nhan = tram ? gan.find((s) => !/^TI\s*\d/i.test(s)) ?? '' : gan.find((s) => /^MC\s*\S/i.test(s)) ?? gan[0] ?? '';
    if (k) khoaCo.add(k);
    thietBi.push({ to: sh.code === 'TONG' ? 'Tờ tổng' : sh.title, loai: LOAI[bl], kv: r[1], tram, nhan, khoa: k ?? '', x: Math.round(x), y: Math.round(y), soPhieu: cm.tra(k).length });
  }
}
const phieuKhongTB = ds.filter((p) => !khoaPhieu(p.tb).some((k) => khoaCo.has(k)));
const ra = {
  tongPhieu: ds.length,
  tongThietBi: thietBi.length,
  tenTram: Object.fromEntries(tenTram),
  thietBi,
  phieuKhongTB: phieuKhongTB.map((p) => ({ ...p, khoa: khoaPhieu(p.tb).join('; ') })),
  luuY: ds.filter((p) => p.gc || p.thieu).map((p) => ({ ...p, banLuu: laBanLuu(p) })),
};
writeFileSync(process.argv[2] ?? 'doi-chieu.json', JSON.stringify(ra));
const co = thietBi.filter((t) => t.soPhieu).length;
const dem = (l: string, f: (t: (typeof thietBi)[0]) => boolean): string =>
  `${l}: ${thietBi.filter((t) => f(t) && t.soPhieu).length}/${thietBi.filter(f).length}`;
console.log(`Thiết bị có phiếu ${co}/${thietBi.length}; ${dem('trong trạm', (t) => !!t.tram)}; ${dem('Recloser/MC đường dây', (t) => !t.tram)}`);
console.log(`Phiếu chưa gặp thiết bị trên sơ đồ: ${phieuKhongTB.length}/${ds.length}`);
