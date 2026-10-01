import type { DocStore } from '../core/doc';
import type { DeviceEntity, Id } from '../core/types';
import { doanCuaNhanh, hinhDoan, phanDoanDay, type DongCongSuat } from '../core/dongCongSuat';
import { docMaDay, ganNhanDay, icpThamKhao, type ChuBanVe, type GoiYDay } from '../core/dayDan';
import { datMuc, docSo, khoaDoan, nhapSo, xuatSo, type MucDayDan } from '../io/soDayDan';
import { download, pickFile } from '../io/file';
import { getBlock } from '../symbols/blocks';
import { button, dialog, el, input, labeled, toast } from './dom';

/**
 * GIAO DIỆN SỔ DÂY DẪN: phần "Dây dẫn / cáp của đoạn" trong bảng thuộc tính khi chọn một nét dây, và
 * hộp thoại danh sách các đoạn đã có mã (nhập tay hoặc theo nhãn trên bản vẽ).
 */
export interface NguCanhDayDan {
  store: DocStore;
  /** Mô hình chiều công suất của tờ đang mở (đồ thị lưới). */
  duLieu(): DongCongSuat;
  /** Mã trạm có ô chứa điểm (tờ sơ đồ tổng), không có thì undefined. */
  tramTai(p: { x: number; y: number }): string | undefined;
  /** Người đang đăng nhập (ghi vào sổ). */
  nguoi(): string | undefined;
  /** Tô đánh dấu đoạn (x1,y1,x2,y2...) hoặc bỏ (null). */
  danhDau(doan: number[] | null): void;
  /** Chọn một nét và phóng tới hộp [x0, y0, x1, y1]. */
  toi(id: Id, hop: [number, number, number, number]): void;
  /** Vẽ lại bảng thuộc tính. */
  veLai(): void;
}

export interface ThongTinDoan {
  k: number;
  khoa: string;
  dau: string[];
  kv: number;
  dai: number;
  soNet: number;
  nhanh: Id[];
  muc?: MucDayDan;
  goiY?: GoiYDay;
  p: [number, number];
}

const goiYCache = new WeakMap<DongCongSuat, Map<number, GoiYDay>>();

/** Gợi ý mã dây theo nhãn trên bản vẽ cho mọi đoạn của tờ (tính một lần mỗi mô hình). */
function goiYTo(c: NguCanhDayDan, d: DongCongSuat): Map<number, GoiYDay> {
  let g = goiYCache.get(d);
  if (g) return g;
  const chu: ChuBanVe[] = [];
  for (const e of c.store.entities) {
    if (e.kind !== 'text' || !c.store.isVisible(e)) continue;
    chu.push({ s: e.text, x: e.p.x, y: e.p.y, h: e.height, rot: e.rot, align: e.align });
  }
  const t = d.doThi;
  const m = t.veU.length;
  const canh = { x1: new Float64Array(m), y1: new Float64Array(m), x2: new Float64Array(m), y2: new Float64Array(m) };
  for (let i = 0; i < m; i++) {
    canh.x1[i] = t.vx[t.veU[i]];
    canh.y1[i] = t.vy[t.veU[i]];
    canh.x2[i] = t.vx[t.veV[i]];
    canh.y2[i] = t.vy[t.veV[i]];
  }
  g = ganNhanDay(chu, canh, phanDoanDay(d).doanCua);
  goiYCache.set(d, g);
  return g;
}

/** Tên thiết bị có cực tại đỉnh v ('' nếu không có thiết bị có tên). Trong trạm thêm mã trạm. */
function tenThietBiTai(c: NguCanhDayDan, d: DongCongSuat, v: number): string {
  const ids = phanDoanDay(d).tbTai.get(v) ?? [];
  let tot = '';
  for (const id of ids) {
    const e = c.store.get(id);
    if (!e || e.kind !== 'device') continue;
    const nhan = tenTB(c, d, e);
    // nhãn gần thiết bị có khi là nhãn dây ("AC 185") - không phải tên thiết bị
    if (!nhan || docMaDay(nhan)) continue;
    const ten = getBlock(e.block)?.name ?? e.block;
    let s = /[A-Za-zĐđ]{2,}/.test(nhan) && nhan.includes(' ') ? nhan : `${ten} ${nhan}`;
    const tram = c.tramTai(e.p);
    if (tram && !s.includes(tram)) s = `${tram} ${s}`;
    if (!tot || (d.doThi.cucTB.get(id)?.length ?? 0) >= 2) tot = s;
  }
  return tot;
}

/**
 * Tên một đầu đoạn (dùng làm khoá sổ - phải ổn định khi vẽ lại sơ đồ): thiết bị có cực tại đó; chỗ rẽ
 * nhánh thì số cột ghi cạnh đó ("cột 28"), không có thì thiết bị có tên gần nhất theo dây ("gần LBS
 * 473E6.4/30"); cuối cùng mới đến toạ độ.
 */
function tenDau(c: NguCanhDayDan, d: DongCongSuat, v: number): string {
  const tb = tenThietBiTai(c, d, v);
  if (tb) return tb;
  const g = d.doThi;
  const p = { x: g.vx[v], y: g.vy[v] };
  const cot = chuGan(c, d, p, 12);
  if (/^\d{1,3}[A-Za-z]?\d?$/.test(cot)) return `${c.tramTai(p) ? c.tramTai(p) + ' ' : ''}cột ${cot}`;
  // đi theo dây (cả qua thiết bị, theo lớp - gần trước) tới thiết bị có tên, không quá 150 đơn vị
  const ke = keCache(d);
  const kc = new Map<number, number>([[v, 0]]);
  let lop = [v];
  for (let buoc = 0; buoc < 40 && lop.length && kc.size < 400; buoc++) {
    const sau: number[] = [];
    let tot = '';
    let bd = Infinity;
    for (const u of lop) {
      const du = kc.get(u) ?? 0;
      if (u !== v && du < bd) {
        const t = tenThietBiTai(c, d, u);
        if (t) [tot, bd] = [t, du];
      }
      for (const [w, L] of ke[u]) {
        const nd = du + L;
        if (nd > 150 || kc.has(w)) continue;
        kc.set(w, nd);
        sau.push(w);
      }
    }
    if (tot) return `gần ${tot}`;
    lop = sau;
  }
  return `nút ${Math.round(p.x)}, ${Math.round(p.y)}`;
}

const tenTBDaCo = new WeakMap<DongCongSuat, Map<Id, string>>();
/** Tên thiết bị: nhãn gắn sẵn, không có thì chữ gần nhất (như nhanCuaThietBi của giao diện). */
function tenTB(c: NguCanhDayDan, d: DongCongSuat, e: DeviceEntity): string {
  if (e.label) return e.label;
  let m = tenTBDaCo.get(d);
  if (!m) tenTBDaCo.set(d, (m = new Map()));
  let t = m.get(e.id);
  if (t === undefined) {
    t = chuGan(c, d, e.p, Math.max(e.scale * 2.5, 25));
    m.set(e.id, t);
  }
  return t;
}

const chuDaCo = new WeakMap<DongCongSuat, { luoi: Map<string, { s: string; x: number; y: number }[]> }>();
/** Chữ gần điểm nhất trong bán kính r (lưới ô 50 đơn vị, tính một lần mỗi mô hình). */
function chuGan(c: NguCanhDayDan, d: DongCongSuat, p: { x: number; y: number }, r: number): string {
  let o = chuDaCo.get(d);
  if (!o) {
    o = { luoi: new Map() };
    for (const e of c.store.entities) {
      if (e.kind !== 'text') continue;
      const k = `${Math.floor(e.p.x / 50)},${Math.floor(e.p.y / 50)}`;
      const l = o.luoi.get(k);
      const m = { s: e.text.trim(), x: e.p.x, y: e.p.y };
      if (l) l.push(m);
      else o.luoi.set(k, [m]);
    }
    chuDaCo.set(d, o);
  }
  let ten = '';
  let bd = r;
  for (let a = Math.floor((p.x - r) / 50); a <= Math.floor((p.x + r) / 50); a++) {
    for (let b = Math.floor((p.y - r) / 50); b <= Math.floor((p.y + r) / 50); b++) {
      for (const m of o.luoi.get(`${a},${b}`) ?? []) {
        const kc = Math.hypot(m.x - p.x, m.y - p.y);
        if (kc < bd) [bd, ten] = [kc, m.s];
      }
    }
  }
  return ten;
}

const keDaCo = new WeakMap<DongCongSuat, [number, number][][]>();
/** Kề của đồ thị lưới (cạnh vẽ + cạnh nối, kèm chiều dài) - để đi tìm thiết bị gần nhất. */
function keCache(d: DongCongSuat): [number, number][][] {
  let ke = keDaCo.get(d);
  if (ke) return ke;
  const g = d.doThi;
  ke = Array.from({ length: g.vx.length }, () => []);
  const them = (u: number, v: number): void => {
    const L = Math.hypot(g.vx[u] - g.vx[v], g.vy[u] - g.vy[v]);
    ke![u].push([v, L]);
    ke![v].push([u, L]);
  };
  g.veU.forEach((u, i) => them(u, g.veV[i]));
  g.noiU.forEach((u, i) => them(u, g.noiV[i]));
  keDaCo.set(d, ke);
  return ke;
}

export function thongTinDoan(c: NguCanhDayDan, d: DongCongSuat, k: number): ThongTinDoan {
  const t = phanDoanDay(d).ds[k];
  const g = d.doThi;
  const dau = t.dau.length ? t.dau.slice(0, 2).map((v) => tenDau(c, d, v)) : ['(vòng kín)'];
  const khoa = khoaDoan(c.store.sheet.name, t.kv, dau);
  // điểm giữa cạnh dài nhất (tìm lại đoạn khi đã vẽ lại)
  let bd = -1;
  let p: [number, number] = [0, 0];
  for (const i of t.canh) {
    const L = Math.hypot(g.vx[g.veU[i]] - g.vx[g.veV[i]], g.vy[g.veU[i]] - g.vy[g.veV[i]]);
    if (L > bd) {
      bd = L;
      p = [+((g.vx[g.veU[i]] + g.vx[g.veV[i]]) / 2).toFixed(1), +((g.vy[g.veU[i]] + g.vy[g.veV[i]]) / 2).toFixed(1)];
    }
  }
  return { k, khoa, dau, kv: t.kv, dai: t.dai, soNet: t.nhanh.length, nhanh: t.nhanh, muc: docSo().muc[khoa], goiY: goiYTo(c, d).get(k), p };
}

/** Icp (A) một sợi và nguồn của giá trị. */
function icpMotSoi(ma: string, icpNhap?: number): { icp?: number; nguon: string } {
  if (icpNhap && icpNhap > 0) return { icp: icpNhap, nguon: 'nhập tay' };
  const t = icpThamKhao(docMaDay(ma));
  return t ? { icp: t, nguon: 'tham khảo dây AC' } : { nguon: 'chưa có - nhập theo catalogue' };
}

const soNguyen = (s: string): number | undefined => {
  const v = Number(String(s).replace(',', '.'));
  return Number.isFinite(v) && v > 0 ? Math.round(v) : undefined;
};

/** Dựng sẵn các bộ đệm của sổ dây dẫn cho mô hình hiện tại (gọi lúc rảnh) - lần chọn đoạn dây đầu không phải chờ. */
export function chuanBiDayDan(c: NguCanhDayDan): void {
  const d = c.duLieu();
  goiYTo(c, d);
  chuGan(c, d, { x: 0, y: 0 }, 0);
}

/** Phần "Dây dẫn / cáp của đoạn" trong bảng thuộc tính (chọn một nét dây). */
export function phanDayDan(c: NguCanhDayDan, id: Id): HTMLElement | null {
  const d = c.duLieu();
  const k = doanCuaNhanh(d, id);
  if (k < 0) {
    c.danhDau(null);
    return null;
  }
  const t = thongTinDoan(c, d, k);
  c.danhDau(hinhDoan(d, k));
  const m = t.muc;
  const gy = t.goiY;
  const box = el('div', { class: 'day-dan' });
  box.append(el('div', { class: 'props-title', text: 'Dây dẫn / cáp của đoạn' }));
  box.append(
    el('p', {
      class: 'muted small',
      text: `Đoạn ${t.dau.join(' ↔ ')} · ${t.soNet} nét · dài theo hình vẽ ${t.dai.toFixed(0)} (tô cam trên bản vẽ)`,
    }),
  );
  if (gy) {
    box.append(
      el('p', {
        class: 'muted small',
        text: `Theo nhãn bản vẽ: "${gy.nhan}" → ${gy.ma.ma}${gy.ma.songSong > 1 ? ` (${gy.ma.songSong} sợi/pha)` : ''}${gy.ma.daiM ? `, ${gy.ma.daiM} m` : ''}`,
      }),
    );
  }
  const iMa = input(m?.ma ?? '', () => capNhatIcp(), { list: 'ma-day', placeholder: gy?.ma.ma ?? 'VD: AC-120, Cu/XLPE 3x240' });
  const iSs = input(String(m?.songSong ?? ''), () => capNhatIcp(), { type: 'number', step: '1', placeholder: String(gy?.ma.songSong ?? 1) });
  const iIcp = input(m?.icp ? String(m.icp) : '', () => capNhatIcp(), { type: 'number', step: '1' });
  const iDai = input(m?.daiM ? String(m.daiM) : '', () => undefined, { type: 'number', step: '1', placeholder: gy?.ma.daiM ? String(gy.ma.daiM) : '' });
  const iGhi = input(m?.ghiChu ?? '', () => undefined, { placeholder: 'VD: theo biên bản nghiệm thu 2024' });
  const kqIcp = el('p', { class: 'small' });
  const capNhatIcp = (): void => {
    const ma = iMa.value.trim() || gy?.ma.ma || '';
    const ss = soNguyen(iSs.value) ?? (iMa.value.trim() ? 1 : gy?.ma.songSong ?? 1);
    const r = icpMotSoi(ma, soNguyen(iIcp.value));
    iIcp.placeholder = r.icp && r.nguon !== 'nhập tay' ? `${r.icp} (tham khảo)` : 'nhập theo catalogue';
    kqIcp.textContent = !ma
      ? 'Chưa có mã dây cho đoạn này.'
      : r.icp
        ? `Dòng cho phép của đoạn: ${ss > 1 ? `${ss} × ${r.icp} = ` : ''}${ss * r.icp} A (${r.nguon}${m ? '' : ', chưa lưu'})`
        : `Dòng cho phép: ${r.nguon}.`;
  };
  capNhatIcp();
  box.append(labeled('Mã hiệu dây / cáp', iMa));
  box.append(labeled('Số sợi (mạch) song song mỗi pha', iSs));
  box.append(labeled('Dòng cho phép một sợi Icp (A)', iIcp));
  box.append(labeled('Chiều dài thực tế (m)', iDai));
  box.append(labeled('Ghi chú', iGhi));
  box.append(kqIcp);
  const hang = el('div', { class: 'row' });
  hang.append(
    button('Lưu cho cả đoạn', () => {
      const ma = iMa.value.trim() || gy?.ma.ma || '';
      if (!ma) {
        toast('Nhập mã hiệu dây / cáp trước khi lưu.', 'warn');
        return;
      }
      const muc: MucDayDan = {
        ma,
        songSong: soNguyen(iSs.value) ?? (iMa.value.trim() ? undefined : gy?.ma.songSong),
        icp: soNguyen(iIcp.value),
        daiM: soNguyen(iDai.value) ?? (iMa.value.trim() ? undefined : gy?.ma.daiM),
        ghiChu: iGhi.value.trim() || undefined,
        kv: t.kv,
        dau: t.dau,
        p: t.p,
        capNhat: new Date().toISOString(),
        nguoi: c.nguoi(),
      };
      if (muc.songSong === 1) delete muc.songSong;
      const ok = datMuc(t.khoa, muc);
      toast(ok ? `Đã lưu vào sổ dây dẫn: ${t.dau.join(' ↔ ')} - ${ma}` : 'Trình duyệt chặn lưu - hãy xuất sổ ra file để giữ lại.', ok ? 'info' : 'warn');
      c.veLai();
    }),
  );
  if (m) {
    hang.append(
      button('Xoá khỏi sổ', () => {
        datMuc(t.khoa, null);
        c.veLai();
      }, { class: 'btn danger' }),
    );
  }
  box.append(hang);
  if (m) box.append(el('p', { class: 'muted small', text: `Cập nhật ${new Date(m.capNhat).toLocaleString('vi-VN')}${m.nguoi ? ` - ${m.nguoi}` : ''}` }));
  return box;
}

/** Hộp thoại sổ dây dẫn của tờ đang mở. */
export function hopThoaiSoDayDan(c: NguCanhDayDan): void {
  const d = c.duLieu();
  const pd = phanDoanDay(d);
  const gy = goiYTo(c, d);
  const so = docSo();
  const to = c.store.sheet.name;
  // đoạn có gợi ý theo nhãn + đoạn có mục sổ (tìm theo điểm p rồi so khoá)
  const hang = new Map<number, ThongTinDoan>();
  for (const k of gy.keys()) hang.set(k, thongTinDoan(c, d, k));
  const g = d.doThi;
  const khongKhop: [string, MucDayDan][] = [];
  for (const [khoa, muc] of Object.entries(so.muc)) {
    if (!khoa.startsWith(to + ' | ')) continue;
    let tim = -1;
    if (muc.p) {
      let bd = 40;
      for (let i = 0; i < g.veU.length; i++) {
        const ax = g.vx[g.veU[i]], ay = g.vy[g.veU[i]], bx = g.vx[g.veV[i]], by = g.vy[g.veV[i]];
        const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
        const tt = Math.max(0, Math.min(1, ((muc.p[0] - ax) * dx + (muc.p[1] - ay) * dy) / L2));
        const kc = Math.hypot(ax + dx * tt - muc.p[0], ay + dy * tt - muc.p[1]);
        if (kc < bd && thongTinDoan(c, d, pd.doanCua[i]).khoa === khoa) {
          bd = kc;
          tim = pd.doanCua[i];
          if (kc < 1) break;
        }
      }
    }
    if (tim < 0) khongKhop.push([khoa, muc]);
    else hang.set(tim, thongTinDoan(c, d, tim));
  }
  const ds = [...hang.values()].sort((a, b) => b.kv - a.kv || a.dau[0].localeCompare(b.dau[0], 'vi'));
  const dong = ds.map((t) => {
    const ma = t.muc?.ma ?? t.goiY?.ma.ma ?? '';
    const ss = t.muc ? t.muc.songSong ?? 1 : t.goiY?.ma.songSong ?? 1;
    const r = icpMotSoi(ma, t.muc?.icp);
    return {
      t,
      o: [
        `${t.kv}`,
        t.dau[0] ?? '',
        t.dau[1] ?? '',
        ma,
        String(ss),
        r.icp ? String(r.icp) : '',
        r.icp ? String(r.icp * ss) : '',
        r.nguon,
        String(t.muc?.daiM ?? t.goiY?.ma.daiM ?? ''),
        t.muc ? 'sổ (nhập tay)' : `nhãn bản vẽ "${t.goiY?.nhan ?? ''}"`,
        t.muc?.ghiChu ?? '',
      ],
    };
  });
  const tieuDe = ['kV', 'Đầu 1', 'Đầu 2', 'Mã hiệu', 'Sợi/pha', 'Icp 1 sợi (A)', 'Icp đoạn (A)', 'Nguồn Icp', 'Dài (m)', 'Nguồn mã', 'Ghi chú'];
  const bang = el('table', { class: 'table' });
  bang.append(el('thead', {}, [el('tr', {}, tieuDe.map((x) => el('th', { text: x })))]));
  const tb = el('tbody');
  for (const r of dong) {
    const tr = el('tr', {}, r.o.map((x) => el('td', { text: x })));
    tr.addEventListener('click', () => {
      const h = hinhDoan(d, r.t.k);
      let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
      for (let i = 0; i + 3 < h.length; i += 4) {
        x0 = Math.min(x0, h[i], h[i + 2]);
        x1 = Math.max(x1, h[i], h[i + 2]);
        y0 = Math.min(y0, h[i + 1], h[i + 3]);
        y1 = Math.max(y1, h[i + 1], h[i + 3]);
      }
      const e = Math.max(40, (x1 - x0 + y1 - y0) * 0.15);
      // chọn nét mà phần dài nhất nằm trong đoạn này (bảng thuộc tính hiện đúng đoạn)
      const id = r.t.nhanh.find((x) => doanCuaNhanh(d, x) === r.t.k) ?? r.t.nhanh[0];
      c.toi(id, [x0 - e, y0 - e, x1 + e, y1 + e]);
    });
    tb.append(tr);
  }
  bang.append(tb);
  const soTay = ds.filter((t) => t.muc).length;
  const tom = el('p', {
    class: 'muted small',
    text:
      `Tờ "${to}": ${pd.ds.length} đoạn dây; có mã ${ds.length} đoạn (nhập tay ${soTay}, theo nhãn bản vẽ ${ds.length - soTay}). ` +
      `Sổ dây dẫn cả máy: ${Object.keys(so.muc).length} mục${khongKhop.length ? `; ${khongKhop.length} mục của tờ này không còn tìm thấy đoạn (bản vẽ đã sửa?)` : ''}. ` +
      'Bấm một dòng để tới đoạn đó. Icp tham khảo chỉ có cho dây trần AC/ACSR - cáp và dây bọc nhập theo catalogue.',
  });
  const csv = button('Xuất CSV (Excel)', () => {
    const rows = [tieuDe, ...dong.map((r) => r.o), ...khongKhop.map(([, m]) => [String(m.kv), m.dau[0] ?? '', m.dau[1] ?? '', m.ma, String(m.songSong ?? 1), String(m.icp ?? ''), '', '(không tìm thấy đoạn)', String(m.daiM ?? ''), 'sổ', m.ghiChu ?? ''])];
    download(`so-day-dan-${to}.csv`.replace(/[\\/:*?"<>| ]+/g, '-'), '﻿' + rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(';')).join('\r\n'), 'text/csv');
  }, { class: 'btn can-qt' });
  const xuat = button('Xuất sổ (.json)', () => download('so-day-dan.json', xuatSo(), 'application/json'), { class: 'btn can-qt' });
  const nhap = button('Nhập sổ (.json)…', () => {
    void pickFile('.json,application/json').then(async (f) => {
      if (!f) return;
      try {
        const n = nhapSo(await f.text());
        toast(`Đã nhập ${n} mục vào sổ dây dẫn.`);
        dong_();
        hopThoaiSoDayDan(c);
      } catch (err) {
        toast(`Không nhập được: ${(err as Error).message}`, 'error');
      }
    });
  });
  if (c.store.chiXem) nhap.disabled = true;
  const dong_ = dialog(`Sổ dây dẫn - mã hiệu dây / cáp theo đoạn (${ds.length})`, el('div', {}, [tom, el('div', { class: 'table-wrap' }, [bang])]), [
    csv,
    xuat,
    nhap,
    button('Đóng', () => dong_()),
  ]);
}
