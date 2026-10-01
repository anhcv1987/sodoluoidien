import type { DocStore } from '../core/doc';
import { tinhDongCongSuat, type DongCongSuat } from '../core/dongCongSuat';
import type { Pt, VoltageKv } from '../core/types';
import { colorOf } from '../core/voltage';
import type { Viewport } from './viewport';
import CongSuatWorker from '../core/congSuatWorker?worker&inline';

/**
 * LỚP HIỂN THỊ CÔNG SUẤT CHẠY TRÊN ĐƯỜNG DÂY (phục vụ trình chiếu).
 *
 * Vẽ trên một canvas trong suốt đặt chồng lên canvas bản vẽ: mỗi khung hình chỉ
 * vẽ lại các vạch sáng đang chạy, còn sơ đồ bên dưới giữ nguyên - nên chạy mượt
 * liên tục kể cả trên tờ sơ đồ tổng hàng chục nghìn đối tượng. Kéo, phóng bản
 * vẽ bình thường trong khi đang chạy.
 *
 * Vạch sáng đi từ nguồn ra, nối tiếp liền mạch qua các đoạn (pha vạch tính theo
 * quãng đường từ nguồn), dừng lại ở thiết bị đang cắt - tại đó có vòng tròn nhấp
 * nháy đánh dấu.
 */
export class ChayCongSuat {
  readonly layer: HTMLCanvasElement;
  private raf = 0;
  private batDau = 0;
  private mo: { sheet: string; rev: number; d: DongCongSuat } | null = null;
  /** Tốc độ chạy (điểm ảnh / giây) - chậm vừa mắt khi trình chiếu (0,6 lần bản đầu). */
  tocDo = 42;
  /** Được gọi sau khi tính lại chiều công suất (để báo số liệu). */
  onTinh?: (d: DongCongSuat, ms: number) => void;

  constructor(
    private canvas: HTMLCanvasElement,
    private store: DocStore,
    private vp: Viewport,
    private printMode: () => boolean,
  ) {
    this.layer = document.createElement('canvas');
    this.layer.className = 'lop-cong-suat';
    this.layer.style.display = 'none';
  }

  get dangChay(): boolean {
    return this.raf !== 0;
  }

  bat(): void {
    if (this.raf) return;
    this.layer.style.display = '';
    this.batDau = performance.now();
    const buoc = (t: number): void => {
      this.raf = requestAnimationFrame(buoc);
      this.ve(t);
    };
    this.raf = requestAnimationFrame(buoc);
  }

  tat(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.layer.style.display = 'none';
  }

  /* ---------------- tính ở luồng nền (Web Worker) ---------------- */

  /** undefined: chưa tạo; null: trình duyệt không cho chạy luồng nền -> tính trực tiếp. */
  private worker: Worker | null | undefined;
  private dangTinh: { sheet: string; rev: number } | null = null;
  private choXong: (() => void)[] = [];

  private layWorker(): Worker | null {
    if (this.worker !== undefined) return this.worker;
    try {
      const w = new CongSuatWorker();
      w.onmessage = (ev: MessageEvent<{ sheet: string; rev: number; d: DongCongSuat; ms: number }>) => {
        const { sheet, rev, d, ms } = ev.data;
        if (this.dangTinh?.sheet === sheet && this.dangTinh.rev === rev) this.dangTinh = null;
        if (this.store.sheet.id === sheet && this.store.version === rev) {
          this.mo = { sheet, rev, d };
          this.onTinh?.(d, ms);
          const cb = this.choXong;
          this.choXong = [];
          for (const f of cb) f();
        } else if (!this.dangTinh) {
          this.tinhNen(); // bản vẽ đã đổi trong lúc tính - tính lại, giữ các lời hẹn
        }
      };
      w.onerror = () => {
        this.worker = null;
        this.dangTinh = null;
        if (this.choXong.length) this.tinhNen();
      };
      this.worker = w;
    } catch {
      this.worker = null;
    }
    return this.worker;
  }

  /** Mô hình của tờ đang mở đã có sẵn (không phải tính lại)? */
  get san(): boolean {
    return !!this.mo && this.mo.sheet === this.store.sheet.id && this.mo.rev === this.store.version;
  }

  /**
   * Dựng mô hình ở LUỒNG NỀN (giao diện không đứng); `xong` được gọi khi đã có dữ liệu.
   * Trình duyệt không cho chạy luồng nền thì tính trực tiếp như trước.
   */
  tinhNen(xong?: () => void): void {
    if (this.san) {
      xong?.();
      return;
    }
    if (xong) this.choXong.push(xong);
    const sheet = this.store.sheet.id;
    const rev = this.store.version;
    if (this.dangTinh?.sheet === sheet && this.dangTinh.rev === rev) return;
    const w = this.layWorker();
    if (w) {
      try {
        this.dangTinh = { sheet, rev };
        w.postMessage({ sheet, rev, entities: this.store.entities });
        return;
      } catch {
        this.worker = null;
        this.dangTinh = null;
      }
    }
    this.duLieu();
    const cb = this.choXong;
    this.choXong = [];
    for (const f of cb) f();
  }

  /** Mô hình chiều công suất của tờ đang mở (tính lại khi bản vẽ hay trạng thái đổi). */
  duLieu(): DongCongSuat {
    const sheet = this.store.sheet.id;
    const rev = this.store.version;
    if (this.mo && this.mo.sheet === sheet && this.mo.rev === rev) return this.mo.d;
    const t0 = performance.now();
    const d = tinhDongCongSuat(this.store.entities, (id) => {
      const e = this.store.get(id);
      return e && 'p' in e ? (e.p as Pt) : undefined;
    });
    this.mo = { sheet, rev, d };
    this.onTinh?.(d, performance.now() - t0);
    return d;
  }

  private dongBoKichThuoc(): CanvasRenderingContext2D | null {
    const c = this.canvas;
    if (c.style.display === 'none' || !c.offsetWidth) {
      this.layer.style.visibility = 'hidden';
      return null;
    }
    this.layer.style.visibility = '';
    const L = this.layer;
    L.style.left = `${c.offsetLeft}px`;
    L.style.top = `${c.offsetTop}px`;
    L.style.width = `${c.offsetWidth}px`;
    L.style.height = `${c.offsetHeight}px`;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = Math.round(c.offsetWidth * dpr);
    const h = Math.round(c.offsetHeight * dpr);
    if (L.width !== w || L.height !== h) {
      L.width = w;
      L.height = h;
    }
    const ctx = L.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  private ve(t: number): void {
    const ctx = this.dongBoKichThuoc();
    if (!ctx) return;
    // mô hình chưa có / đang tính lại ở luồng nền: vẽ tạm theo mô hình cũ của tờ (nếu có),
    // không tính trực tiếp trong khung hình để giao diện không bị đứng
    let d: DongCongSuat;
    if (this.san) d = this.mo!.d;
    else {
      if (this.worker !== null) this.tinhNen();
      if (this.mo?.sheet === this.store.sheet.id) d = this.mo.d;
      else if (this.worker !== null) {
        ctx.clearRect(0, 0, this.vp.width, this.vp.height);
        return;
      } else d = this.duLieu();
    }
    const vp = this.vp;
    ctx.clearRect(0, 0, vp.width, vp.height);
    const view = vp.viewBox(20);
    const sc = vp.scale;
    const giay = (t - this.batDau) / 1000;
    const inAn = this.printMode();

    // Vạch dài/khoảng hở theo điểm ảnh - nhìn đều nhau ở mọi mức phóng
    const VACH = 10;
    const HO = 14;
    const CHU_KY = VACH + HO;
    const chay = (giay * this.tocDo) % CHU_KY;
    const w0 = vp.width / 2;
    const h0 = vp.height / 2;

    // Gom theo cấp điện áp để đổi màu ít lần
    const theoCap = new Map<VoltageKv, number[]>();
    d.chuoi.forEach((c, i) => {
      if (c.lop && this.store.layer(c.lop)?.visible === false) return; // lớp đang tắt
      if (c.maxX < view.minX || c.minX > view.maxX || c.maxY < view.minY || c.minY > view.maxY) return;
      if ((c.maxX - c.minX + c.maxY - c.minY) * sc < 1.5) return;
      const a = theoCap.get(c.kv);
      if (a) a.push(i);
      else theoCap.set(c.kv, [i]);
    });

    const duong = (i: number): void => {
      const c = d.chuoi[i];
      const p = c.pts;
      ctx.beginPath();
      ctx.moveTo((p[0] - vp.cx) * sc + w0, h0 - (p[1] - vp.cy) * sc);
      for (let k = 2; k < p.length; k += 2) ctx.lineTo((p[k] - vp.cx) * sc + w0, h0 - (p[k + 1] - vp.cy) * sc);
      // pha tại điểm đầu = quãng đường từ nguồn (đổi ra điểm ảnh) - thời gian chạy
      ctx.lineDashOffset = ((c.pha * sc) % CHU_KY) - chay;
      ctx.stroke();
    };

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([VACH, HO]);
    const caps = [...theoCap.keys()].sort((a, b) => a - b);
    // Lượt 1: quầng màu cấp điện áp; lượt 2: lõi sáng
    for (const kv of caps) {
      const mau = colorOf(kv, inAn);
      const ds = theoCap.get(kv) as number[];
      // thu nhỏ bản vẽ thì vạch mảnh lại cho khỏi phủ kín sơ đồ
      const w = (kv >= 110 ? 7 : 5.5) * Math.max(0.45, Math.min(1, sc / 0.6));
      ctx.strokeStyle = mau;
      ctx.globalAlpha = inAn ? 0.35 : 0.45;
      ctx.lineWidth = w;
      for (const i of ds) duong(i);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = inAn ? mau : pha(mau, '#ffffff', 0.72);
      ctx.lineWidth = w * 0.42;
      for (const i of ds) duong(i);
    }
    ctx.restore();

    // Điểm công suất dừng lại (thiết bị đang cắt): vòng tròn nhấp nháy
    const nhip = 0.5 + 0.5 * Math.sin(giay * Math.PI * 2 * 0.8);
    ctx.save();
    ctx.strokeStyle = inAn ? '#b45309' : '#fbbf24';
    ctx.fillStyle = inAn ? '#b45309' : '#fbbf24';
    for (const q of d.diemDung) {
      if (q.x < view.minX || q.x > view.maxX || q.y < view.minY || q.y > view.maxY) continue;
      const x = (q.x - vp.cx) * sc + w0;
      const y = h0 - (q.y - vp.cy) * sc;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.85 * (1 - nhip);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 4 + 9 * nhip, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** Trộn hai màu hex theo tỷ lệ k (0 = màu a, 1 = màu b). */
function pha(a: string, b: string, k: number): string {
  const doc = (h: string): number[] => {
    const s = h.replace('#', '');
    const f = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
    return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16));
  };
  const x = doc(a);
  const y = doc(b);
  if (x.some(isNaN) || y.some(isNaN)) return a;
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',')})`;
}
