/**
 * TÀI KHOẢN VÀ PHÂN QUYỀN.
 *
 * Mở phần mềm ra là CHẾ ĐỘ XEM: xem, phóng, tìm trạm, tô sáng mạch, xuất file đều
 * được, nhưng không sửa được sơ đồ. Muốn hiệu chỉnh phải đăng nhập.
 *
 *   quan-tri  (quản trị) : hiệu chỉnh sơ đồ + quản lý tài khoản
 *   bien-tap  (biên tập) : hiệu chỉnh sơ đồ
 *
 * Tài khoản mặc định: admin / dieudob6 (nên đổi mật khẩu ngay lần đầu dùng).
 *
 * LƯU Ý: phần mềm là MỘT FILE HTML chạy trên máy người dùng, không có máy chủ, nên
 * danh sách tài khoản lưu trong bộ nhớ của trình duyệt trên từng máy (localStorage)
 * và mật khẩu chỉ lưu dạng băm SHA-256 kèm "muối". Cơ chế này chặn việc SỬA NHẦM,
 * không chống được người cố tình can thiệp vào mã nguồn của trang.
 */

export type VaiTro = 'quan-tri' | 'bien-tap';

export const TEN_VAI_TRO: Record<VaiTro, string> = {
  'quan-tri': 'Quản trị',
  'bien-tap': 'Biên tập',
};

export interface TaiKhoan {
  ten: string;
  hoTen?: string;
  vaiTro: VaiTro;
  muoi: string;
  bam: string;
}

export interface Phien {
  ten: string;
  hoTen?: string;
  vaiTro: VaiTro;
}

export const TK_MAC_DINH = 'admin';
export const MK_MAC_DINH = 'dieudob6';

const KHOA_DS = 'sodo.taiKhoan.v1';
const KHOA_PHIEN = 'sodo.phien.v1';

/* ------------------------------ SHA-256 ------------------------------ */

/** SHA-256 viết tay - dùng khi trình duyệt không cho gọi crypto.subtle. */
function sha256JS(s: string): string {
  const bytes = new TextEncoder().encode(s);
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const len = bytes.length;
  const tong = Math.ceil((len + 9) / 64) * 64;
  const m = new Uint8Array(tong);
  m.set(bytes);
  m[len] = 0x80;
  const bits = len * 8;
  const dv = new DataView(m.buffer);
  dv.setUint32(tong - 8, Math.floor(bits / 0x100000000));
  dv.setUint32(tong - 4, bits >>> 0);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < tong; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }
  return [...H].map((x) => x.toString(16).padStart(8, '0')).join('');
}

export async function sha256(s: string): Promise<string> {
  try {
    if (globalThis.crypto?.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
      return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    /* rơi xuống bản viết tay */
  }
  return sha256JS(s);
}

function taoMuoi(): string {
  const a = new Uint8Array(16);
  if (typeof globalThis.crypto !== 'undefined') crypto.getRandomValues(a);
  else for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
  return [...a].map((x) => x.toString(16).padStart(2, '0')).join('');
}

const bamMatKhau = (muoi: string, mk: string): Promise<string> => sha256(`${muoi}:${mk}`);

/** Tên đăng nhập: bỏ khoảng trắng hai đầu, không phân biệt hoa thường. */
export const chuanTen = (ten: string): string => ten.trim().toLowerCase();

/* -------------------------- kho tài khoản --------------------------- */

export class QuanLyTaiKhoan {
  private ds: TaiKhoan[] = [];
  /** localStorage bị chặn (cửa sổ ẩn danh...) thì giữ trong bộ nhớ, mất khi đóng trang. */
  private boNhoTam = false;
  phien: Phien | null = null;

  /** Nạp danh sách; chưa có tài khoản nào thì tạo tài khoản quản trị mặc định. */
  async khoiTao(): Promise<void> {
    try {
      const raw = localStorage.getItem(KHOA_DS);
      if (raw) this.ds = (JSON.parse(raw) as TaiKhoan[]).filter((t) => t && t.ten && t.bam && t.muoi);
    } catch {
      this.boNhoTam = true;
    }
    if (!this.ds.some((t) => t.vaiTro === 'quan-tri')) {
      const muoi = taoMuoi();
      this.ds.push({
        ten: TK_MAC_DINH,
        hoTen: 'Quản trị',
        vaiTro: 'quan-tri',
        muoi,
        bam: await bamMatKhau(muoi, MK_MAC_DINH),
      });
      this.luu();
    }
    try {
      const p = sessionStorage.getItem(KHOA_PHIEN);
      if (p) {
        const ph = JSON.parse(p) as Phien;
        // phiên chỉ còn hiệu lực nếu tài khoản vẫn tồn tại với đúng vai trò đó
        const tk = this.ds.find((t) => t.ten === ph.ten);
        if (tk) this.phien = { ten: tk.ten, hoTen: tk.hoTen, vaiTro: tk.vaiTro };
      }
    } catch {
      /* không có phiên */
    }
  }

  get khongLuuDuoc(): boolean {
    return this.boNhoTam;
  }

  private luu(): void {
    try {
      localStorage.setItem(KHOA_DS, JSON.stringify(this.ds));
    } catch {
      this.boNhoTam = true;
    }
  }

  private luuPhien(): void {
    try {
      if (this.phien) sessionStorage.setItem(KHOA_PHIEN, JSON.stringify(this.phien));
      else sessionStorage.removeItem(KHOA_PHIEN);
    } catch {
      /* bỏ qua */
    }
  }

  danhSach(): Omit<TaiKhoan, 'muoi' | 'bam'>[] {
    return this.ds.map(({ ten, hoTen, vaiTro }) => ({ ten, hoTen, vaiTro }));
  }

  /** Mật khẩu của tài khoản vẫn là mật khẩu mặc định? (để nhắc đổi) */
  async dangDungMkMacDinh(ten: string): Promise<boolean> {
    const tk = this.ds.find((t) => t.ten === chuanTen(ten));
    return !!tk && (await bamMatKhau(tk.muoi, MK_MAC_DINH)) === tk.bam;
  }

  async dangNhap(ten: string, mk: string): Promise<Phien | null> {
    const tk = this.ds.find((t) => t.ten === chuanTen(ten));
    if (!tk || (await bamMatKhau(tk.muoi, mk)) !== tk.bam) return null;
    this.phien = { ten: tk.ten, hoTen: tk.hoTen, vaiTro: tk.vaiTro };
    this.luuPhien();
    return this.phien;
  }

  dangXuat(): void {
    this.phien = null;
    this.luuPhien();
  }

  get laQuanTri(): boolean {
    return this.phien?.vaiTro === 'quan-tri';
  }

  /** Đổi mật khẩu của chính mình (phải nhập đúng mật khẩu cũ). */
  async doiMatKhau(mkCu: string, mkMoi: string): Promise<string | null> {
    if (!this.phien) return 'Chưa đăng nhập.';
    const tk = this.ds.find((t) => t.ten === this.phien!.ten);
    if (!tk) return 'Không tìm thấy tài khoản.';
    if ((await bamMatKhau(tk.muoi, mkCu)) !== tk.bam) return 'Mật khẩu cũ không đúng.';
    const loi = kiemTraMatKhau(mkMoi);
    if (loi) return loi;
    tk.muoi = taoMuoi();
    tk.bam = await bamMatKhau(tk.muoi, mkMoi);
    this.luu();
    return null;
  }

  /* ----- chỉ quản trị ----- */

  async themTaiKhoan(ten: string, hoTen: string, mk: string, vaiTro: VaiTro): Promise<string | null> {
    if (!this.laQuanTri) return 'Chỉ tài khoản quản trị mới thêm được tài khoản.';
    const t = chuanTen(ten);
    if (!/^[a-z0-9._-]{3,32}$/.test(t)) return 'Tên đăng nhập 3-32 ký tự, chỉ gồm chữ không dấu, số, dấu chấm, gạch.';
    if (this.ds.some((x) => x.ten === t)) return `Đã có tài khoản "${t}".`;
    const loi = kiemTraMatKhau(mk);
    if (loi) return loi;
    const muoi = taoMuoi();
    this.ds.push({ ten: t, hoTen: hoTen.trim() || undefined, vaiTro, muoi, bam: await bamMatKhau(muoi, mk) });
    this.luu();
    return null;
  }

  async datLaiMatKhau(ten: string, mk: string): Promise<string | null> {
    if (!this.laQuanTri) return 'Chỉ tài khoản quản trị mới đặt lại được mật khẩu.';
    const tk = this.ds.find((x) => x.ten === chuanTen(ten));
    if (!tk) return 'Không tìm thấy tài khoản.';
    const loi = kiemTraMatKhau(mk);
    if (loi) return loi;
    tk.muoi = taoMuoi();
    tk.bam = await bamMatKhau(tk.muoi, mk);
    this.luu();
    return null;
  }

  doiVaiTro(ten: string, vaiTro: VaiTro): string | null {
    if (!this.laQuanTri) return 'Chỉ tài khoản quản trị mới đổi được vai trò.';
    const tk = this.ds.find((x) => x.ten === chuanTen(ten));
    if (!tk) return 'Không tìm thấy tài khoản.';
    if (tk.vaiTro === 'quan-tri' && vaiTro !== 'quan-tri' && this.soQuanTri() <= 1) {
      return 'Phải còn ít nhất một tài khoản quản trị.';
    }
    tk.vaiTro = vaiTro;
    this.luu();
    if (this.phien?.ten === tk.ten) {
      this.phien.vaiTro = vaiTro;
      this.luuPhien();
    }
    return null;
  }

  xoaTaiKhoan(ten: string): string | null {
    if (!this.laQuanTri) return 'Chỉ tài khoản quản trị mới xoá được tài khoản.';
    const t = chuanTen(ten);
    const tk = this.ds.find((x) => x.ten === t);
    if (!tk) return 'Không tìm thấy tài khoản.';
    if (tk.vaiTro === 'quan-tri' && this.soQuanTri() <= 1) return 'Không xoá được tài khoản quản trị cuối cùng.';
    if (this.phien?.ten === t) return 'Không tự xoá tài khoản đang đăng nhập.';
    this.ds = this.ds.filter((x) => x.ten !== t);
    this.luu();
    return null;
  }

  private soQuanTri(): number {
    return this.ds.filter((x) => x.vaiTro === 'quan-tri').length;
  }
}

export function kiemTraMatKhau(mk: string): string | null {
  if (mk.length < 6) return 'Mật khẩu phải có ít nhất 6 ký tự.';
  return null;
}

/** Dùng cho kiểm thử: SHA-256 bản viết tay phải khớp với crypto.subtle. */
export const _sha256JS = sha256JS;
