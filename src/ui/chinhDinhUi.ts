import raw from '../data/chinhDinh.json?raw';
import type { DocStore } from '../core/doc';
import type { Box } from '../core/geom';
import type { DeviceEntity, Entity, Id } from '../core/types';
import {
  ChiMucCD,
  chuanTim,
  dangTimKhoa,
  khoaPhieu,
  khoaThietBi,
  laBanLuu,
  laXungKich,
  linkPhieu,
  tomTatPhieu,
  type PhieuCD,
} from '../core/chinhDinh';
import { getBlock, TEN_TRANG_THAI } from '../symbols/blocks';
import { button, dialog, el } from './dom';

/**
 * PHIẾU CHỈNH ĐỊNH RƠ LE TRÊN SƠ ĐỒ + TÌM KIẾM THIẾT BỊ.
 *
 * Để phần mềm không nặng thêm, thông số chỉnh định KHÔNG vẽ lên sơ đồ:
 *  - dữ liệu phiếu để dạng chuỗi JSON, chỉ phân tích lần đầu cần tới (rê chuột
 *    lên máy cắt, bấm chọn, tìm kiếm);
 *  - khoá của từng thiết bị tính khi cần rồi nhớ lại, tính lại khi bản vẽ đổi;
 *  - rê chuột: hiện tóm tắt; bấm chọn: bảng thuộc tính hiện đủ phiếu.
 */

/** Máy cắt / Recloser - loại thiết bị có phiếu chỉnh định. */
const LOAI_CO_PHIEU = new Set(['MC', 'MCHB', 'REC']);
export const coPhieu = (e: Entity | null | undefined): e is DeviceEntity =>
  !!e && e.kind === 'device' && LOAI_CO_PHIEU.has(e.block) && e.layer !== 'Khung bản vẽ';

let chiMuc: ChiMucCD | null = null;
/** Chỉ mục phiếu - phân tích dữ liệu ở lần gọi đầu tiên. */
export function chiMucCD(): ChiMucCD {
  if (!chiMuc) chiMuc = new ChiMucCD(JSON.parse(raw) as PhieuCD[]);
  return chiMuc;
}

export interface NguCanhCD {
  store: DocStore;
  queryBox: (b: Box) => { e: Entity }[];
  /** Mã trạm chứa điểm p (tờ tổng: ô trạm; tờ trạm: mã tờ). */
  tramTai: (p: { x: number; y: number }) => string | undefined;
  nhanCua: (e: DeviceEntity) => string;
  nhayToi: (id: Id) => void;
  gotoStation: (code: string) => void;
  danhSachTram: () => { code: string; title: string }[];
}

interface MucTim {
  loai: 'tb' | 'tram' | 'phieu';
  hay: string;
  nhan: string;
  phu: string;
  hang: number;
  id?: Id;
  khoa?: string | null;
  tram?: string;
  phieu?: PhieuCD;
}

export class ChinhDinhUi {
  private khoaTB = new Map<Id, string | null>();
  private phienBan = '';
  private tip = el('div', { class: 'cd-tip' });
  private chuot = { x: 0, y: 0 };
  private chiMucTim: MucTim[] | null = null;
  private phienBanTim = '';

  constructor(private ctx: NguCanhCD) {
    document.body.append(this.tip);
  }

  /** Ghi vị trí chuột để đặt khung tóm tắt. */
  theoChuot(ev: PointerEvent): void {
    this.chuot = { x: ev.clientX, y: ev.clientY };
    if (this.tip.classList.contains('hien')) this.datViTri();
  }

  private moiPhien(): void {
    const v = `${this.ctx.store.sheet.id}|${this.ctx.store.version}`;
    if (v !== this.phienBan) {
      this.phienBan = v;
      this.khoaTB.clear();
    }
  }

  /** Chữ quanh một điểm, gần trước xa sau. */
  private chuQuanh(p: { x: number; y: number }, r: number): string[] {
    const a: [number, string][] = [];
    for (const { e } of this.ctx.queryBox({ minX: p.x - r, minY: p.y - r, maxX: p.x + r, maxY: p.y + r })) {
      if (e.kind !== 'text') continue;
      const d = Math.hypot(e.p.x - p.x, e.p.y - p.y);
      if (d <= r) a.push([d, e.text.trim()]);
    }
    return a.sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  }

  /** Khoá ghép phiếu của máy cắt / Recloser ("E6.6:471", "E6.6:471/35"). */
  khoa(e: DeviceEntity): string | null {
    this.moiPhien();
    let k = this.khoaTB.get(e.id);
    if (k === undefined) {
      const tram = this.ctx.tramTai(e.p);
      const r = tram ? Math.max(e.scale * 2.5, 25) : 70;
      const quanh = this.chuQuanh(e.p, r);
      if (e.label) quanh.unshift(e.label);
      k = khoaThietBi(quanh, tram);
      this.khoaTB.set(e.id, k);
    }
    return k;
  }

  phieuCua(e: DeviceEntity): PhieuCD[] {
    return chiMucCD().tra(this.khoa(e));
  }

  /** Tên hiển thị: đọc từ khoá ghép phiếu (tránh lấy nhầm nhãn "LT…", "TI…" cạnh máy cắt). */
  tenHienThi(e: DeviceEntity): string {
    const k = coPhieu(e) ? this.khoa(e) : null;
    if (!k) return this.ctx.nhanCua(e);
    const [tram, so] = k.split(':');
    const [lo, cot] = so.split('/');
    return cot ? `MC ${lo}${tram}/${cot}` : `MC ${lo} ${tram}`;
  }

  /* ----------------------------- rê chuột ----------------------------- */

  /** Tóm tắt khi rê chuột lên thiết bị đóng cắt (trả false nếu không hiện). */
  goiY(e: DeviceEntity | null): boolean {
    if (!e) {
      this.anTip();
      return false;
    }
    const nhan = this.tenHienThi(e);
    const ten = getBlock(e.block)?.name ?? e.block;
    const dau = `${nhan ? nhan + ' · ' : ''}${ten} · ${TEN_TRANG_THAI[e.state ?? 'dong']}`;
    const noi: (HTMLElement | string)[] = [el('div', { class: 'cd-tip-dau', text: dau })];
    if (coPhieu(e)) {
      const ds = this.phieuCua(e);
      if (ds.length) {
        for (const d of tomTatPhieu(ds[0])) noi.push(el('div', { text: d }));
        const khac = ds.length - 1;
        noi.push(el('div', { class: 'cd-tip-chu', text: `Bấm chọn để xem đủ phiếu${khac ? ` (còn ${khac} phiếu khác)` : ''}.` }));
      } else {
        noi.push(el('div', { class: 'cd-tip-chu', text: 'Chưa có phiếu chỉnh định trong dữ liệu.' }));
      }
    }
    this.tip.replaceChildren(...noi);
    this.tip.classList.add('hien');
    this.datViTri();
    return true;
  }

  anTip(): void {
    this.tip.classList.remove('hien');
  }

  private datViTri(): void {
    const w = this.tip.offsetWidth;
    const h = this.tip.offsetHeight;
    let x = this.chuot.x + 16;
    let y = this.chuot.y + 18;
    if (x + w > innerWidth - 4) x = Math.max(4, this.chuot.x - w - 12);
    if (y + h > innerHeight - 4) y = Math.max(4, this.chuot.y - h - 12);
    this.tip.style.left = `${x}px`;
    this.tip.style.top = `${y}px`;
  }

  /* --------------------------- bảng thuộc tính --------------------------- */

  /** Phần "Phiếu chỉnh định rơ le" trong bảng thuộc tính của máy cắt đang chọn. */
  phanThuocTinh(e: DeviceEntity): HTMLElement {
    const box = el('div', { class: 'cd-phan' });
    box.append(el('div', { class: 'props-title', text: 'Phiếu chỉnh định rơ le' }));
    const k = this.khoa(e);
    const ds = this.phieuCua(e);
    if (!ds.length) {
      box.append(
        el('p', {
          class: 'muted small',
          text: k
            ? `Chưa có phiếu chỉnh định cho ${k.replace(':', ' - MC ')} trong dữ liệu phần mềm.`
            : 'Không đọc được số hiệu máy cắt từ nhãn trên sơ đồ nên chưa ghép được phiếu.',
        }),
      );
      return box;
    }
    box.append(this.khoiPhieu(ds[0], true));
    if (ds.length > 1) {
      const kh = el('details', { class: 'cd-khac' });
      kh.append(el('summary', { text: `Phiếu khác của thiết bị này (${ds.length - 1})` }));
      for (const p of ds.slice(1)) {
        const d = el('details', { class: 'cd-khac-1' });
        d.append(el('summary', { text: `${p.so || p.ten} · ${p.nb}${laXungKich(p) ? ' · xung kích' : ''}${laBanLuu(p) ? ' · bản lưu' : ''}` }));
        d.append(this.khoiPhieu(p, false));
        kh.append(d);
      }
      box.append(kh);
    }
    box.append(
      button('Xem phiếu khung lớn', () => this.hopThoaiPhieu(ds, this.tenHienThi(e)), { class: 'btn cd-nut' }),
    );
    return box;
  }

  /** Một phiếu: thông tin chung + bảng thông số từng nhóm. */
  khoiPhieu(p: PhieuCD, dayDu: boolean): HTMLElement {
    const k = el('div', { class: 'cd-phieu' });
    const dong = (nhan: string, gt?: string): void => {
      if (gt) k.append(el('div', { class: 'cd-dong' }, [el('span', { class: 'muted', text: `${nhan}: ` }), gt]));
    };
    dong('Số phiếu', p.so);
    dong('Ban hành', p.nb);
    dong('Thiết bị bảo vệ', p.mo);
    dong('Rơ le', p.rl + (p.nam ? ` (lắp ${p.nam})` : ''));
    dong('TI / TU', p.ti);
    if (dayDu) dong('Mục đích', p.md);
    if (p.gc || p.thieu) {
      k.append(
        el('div', {
          class: 'cd-luu-y',
          text: [p.gc, p.thieu ? 'Trích đoạn chưa đủ thông số - xem file gốc.' : ''].filter(Boolean).join(' '),
        }),
      );
    }
    for (const n of p.g) {
      if (p.g.length > 1 || n.h) k.append(el('div', { class: 'cd-nhom', text: n.h ?? 'Nhóm thông số' }));
      if (!n.c.length) continue;
      const t = el('table', { class: 'table cd-bang' });
      t.append(el('thead', {}, [el('tr', {}, ['Chức năng', 'Cấp', 'Giá trị', 'Thời gian', 'Tác động'].map((h) => el('th', { text: h })))]));
      const tb = el('tbody');
      for (const c of n.c) tb.append(el('tr', {}, c.map((x) => el('td', { text: x }))));
      t.append(tb);
      k.append(t);
    }
    if (p.tdl) dong('Tự động đóng lại', p.tdl);
    k.append(el('a', { class: 'cd-link', href: linkPhieu(p), target: '_blank', rel: 'noopener', text: `Mở phiếu gốc: ${p.ten}` }));
    return k;
  }

  hopThoaiPhieu(ds: PhieuCD[], tieuDe: string): void {
    const than = el('div', { class: 'cd-hop' });
    ds.forEach((p, i) => {
      if (i) than.append(el('hr'));
      than.append(this.khoiPhieu(p, true));
    });
    const close = dialog(`Phiếu chỉnh định${tieuDe ? ' - ' + tieuDe : ''}`, than, [button('Đóng', () => close())]);
  }

  /* ------------------------------ tìm kiếm ------------------------------ */

  private dungChiMucTim(): MucTim[] {
    const v = `${this.ctx.store.sheet.id}|${this.ctx.store.version}`;
    if (this.chiMucTim && v === this.phienBanTim) return this.chiMucTim;
    const ds: MucTim[] = [];
    for (const e of this.ctx.store.entities) {
      if (e.kind !== 'device' || e.layer === 'Khung bản vẽ') continue;
      const nhanGoc = this.ctx.nhanCua(e);
      if (!nhanGoc) continue;
      const tram = this.ctx.tramTai(e.p) ?? '';
      const ten = getBlock(e.block)?.name ?? e.block;
      const k = coPhieu(e) ? this.khoa(e) : null;
      const soK = k ? k.split(':')[1] : '';
      const nhan = k ? this.tenHienThi(e) : nhanGoc;
      ds.push({
        loai: 'tb',
        id: e.id,
        nhan,
        phu: `${ten}${tram ? ' · trạm ' + tram : ''}${k && chiMucCD().tra(k).length ? ' · có phiếu' : ''}`,
        hay: chuanTim(`${nhan} ${nhanGoc} ${tram} ${ten}`) + '|' + chuanTim(soK) + chuanTim(k ?? '') + '|' + dangTimKhoa(k),
        hang: coPhieu(e) ? 1 : 2,
        khoa: k,
        tram,
      });
    }
    for (const t of this.ctx.danhSachTram()) {
      ds.push({ loai: 'tram', nhan: `${t.code}`, phu: t.title, hay: chuanTim(`${t.code} ${t.title}`), hang: 0, tram: t.code });
    }
    for (const p of chiMucCD().ds) {
      ds.push({ loai: 'phieu', nhan: p.tb, phu: `Phiếu ${p.so || p.ten} · ${p.nb}`, hay: chuanTim(`${p.tb} ${p.so} ${p.ten} ${p.rl}`) + '|' + khoaPhieu(p.tb).map(dangTimKhoa).join('|'), hang: 3, phieu: p });
    }
    this.chiMucTim = ds;
    this.phienBanTim = v;
    return ds;
  }

  tim(q: string, toiDa = 60): MucTim[] {
    const tu = q.split(/\s+/).map(chuanTim).filter(Boolean);
    if (!tu.length) return [];
    const ghep = chuanTim(q);
    const kq: [number, MucTim][] = [];
    for (const m of this.dungChiMucTim()) {
      // "475E6.3/03" và "475E6.3/3" coi như nhau (số cột bỏ số 0 đầu)
      if (!tu.every((t) => m.hay.includes(t) || m.hay.includes(t.replace(/(^|\/)0+(?=\d)/g, '$1')))) continue;
      const n = chuanTim(m.nhan);
      const diem = m.hang * 10 + (n === ghep ? 0 : n.startsWith(ghep) ? 1 : 3) + n.length / 1000;
      kq.push([diem, m]);
    }
    kq.sort((a, b) => a[0] - b[0]);
    return kq.slice(0, toiDa).map((x) => x[1]);
  }

  chon(m: MucTim): void {
    if (m.loai === 'tb' && m.id) this.ctx.nhayToi(m.id);
    else if (m.loai === 'tram' && m.tram) this.ctx.gotoStation(m.tram);
    else if (m.loai === 'phieu' && m.phieu) {
      const ks = khoaPhieu(m.phieu.tb);
      const tb = this.dungChiMucTim().find((x) => x.loai === 'tb' && x.khoa && ks.includes(x.khoa));
      if (tb?.id) this.ctx.nhayToi(tb.id);
      else this.hopThoaiPhieu([m.phieu], m.phieu.tb);
    }
  }

  /** Ô tìm kiếm trên thanh tiêu đề (Ctrl+F). */
  oTimKiem(): { root: HTMLElement; focus: () => void } {
    const o = el('input', {
      class: 'input cd-tim',
      type: 'search',
      placeholder: 'Tìm máy cắt, Recloser, thiết bị, trạm… (Ctrl+F)',
      title: 'Gõ tên / số hiệu thiết bị: 471 E6.6, 471E6.6/35, 172-7, T401 E6.23…',
    });
    const ds = el('div', { class: 'dropdown-list cd-kq' });
    const root = el('div', { class: 'cd-tim-wrap' }, [o, ds]);
    let kq: MucTim[] = [];
    let dang = -1;
    const TEN_LOAI = { tb: '', tram: 'Trạm', phieu: 'Phiếu' } as const;
    const ve = (): void => {
      ds.replaceChildren();
      if (!o.value.trim()) {
        ds.classList.remove('open');
        return;
      }
      if (!kq.length) ds.append(el('div', { class: 'cd-kq-trong', text: 'Không tìm thấy trên tờ đang mở.' }));
      kq.forEach((m, i) => {
        const it = el('button', { class: `dropdown-item cd-kq-dong${i === dang ? ' dang-chon' : ''}`, type: 'button' }, [
          TEN_LOAI[m.loai] ? el('span', { class: 'cd-kq-loai', text: TEN_LOAI[m.loai] }) : null,
          el('span', { class: 'cd-kq-nhan', text: m.nhan }),
          el('span', { class: 'cd-kq-phu', text: m.phu }),
        ]);
        it.addEventListener('mousedown', (ev) => ev.preventDefault());
        it.addEventListener('click', () => {
          ds.classList.remove('open');
          this.chon(m);
        });
        ds.append(it);
      });
      ds.classList.add('open');
    };
    let hen = 0;
    o.addEventListener('input', () => {
      clearTimeout(hen);
      hen = window.setTimeout(() => {
        kq = this.tim(o.value);
        dang = kq.length ? 0 : -1;
        ve();
      }, 120);
    });
    o.addEventListener('focus', () => {
      if (o.value.trim()) {
        kq = this.tim(o.value);
        ve();
      }
    });
    o.addEventListener('blur', () => setTimeout(() => ds.classList.remove('open'), 150));
    o.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        if (!kq.length) return;
        dang = (dang + (ev.key === 'ArrowDown' ? 1 : -1) + kq.length) % kq.length;
        ve();
        ds.children[dang]?.scrollIntoView({ block: 'nearest' });
      } else if (ev.key === 'Enter') {
        const m = kq[dang] ?? kq[0];
        if (m) {
          ds.classList.remove('open');
          this.chon(m);
        }
      } else if (ev.key === 'Escape') {
        o.value = '';
        ds.classList.remove('open');
        o.blur();
      }
    });
    return { root, focus: () => (o.focus(), o.select()) };
  }
}
