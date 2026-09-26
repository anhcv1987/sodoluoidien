/**
 * TÌM CHỖ ĐẶT BẢN VẼ LỘ VÀ ĐƯỜNG ĐI CÁP TRÊN TỜ SƠ ĐỒ TỔNG (dùng trong ve-luoi-trung-ap.mjs).
 *
 *  - timCho(): khoảng trống hình chữ nhật đủ lớn, gần một điểm cho trước nhất (lưới ô 20 đơn vị,
 *    ô có nét / chữ / thiết bị / nằm trong khung trạm là ô bận).
 *  - timDuong(): đường gấp khúc vuông góc (A* trên lưới ô 4 đơn vị) từ đầu ra ngăn lộ tới đầu lộ:
 *      . không đi đè / đi song song sát (< 1 ô) nét có sẵn, không đi qua chữ, thiết bị;
 *      . được cắt ngang nét vuông góc (chỗ đó sẽ vẽ vòng nhảy), không rẽ ngay tại chỗ cắt;
 *      . phạt mỗi lần rẽ, mỗi chỗ cắt, đi trong khung trạm / trong bản vẽ lộ khác.
 */

const O_THO = 20; // ô lưới tìm chỗ
const O = 4; // ô lưới tìm đường

/** Hộp bao gần đúng của một dòng chữ [layer,kv,x,y,h,rot,align,src,text]. */
export function hopChu(r, aligns) {
  const [, , x, y, h, rot, al, , t] = r;
  const w = String(t).length * h * 0.56;
  const canh = aligns[al] ?? 'left';
  const d0 = canh === 'center' ? -w / 2 : canh === 'right' ? -w : 0;
  if (Math.abs(rot - 90) < 1) return [x - h, y + d0, x, y + d0 + w];
  return [x + d0, y, x + d0 + w, y + h];
}

/** Duyệt mọi đoạn thẳng của tờ: cb(x0, y0, x1, y1, dong) */
function moiDoan(s, cb) {
  for (const r of s.b) for (let k = 4; k + 3 < r.length; k += 2) cb(r[k], r[k + 1], r[k + 2], r[k + 3], r);
}

/**
 * Chỗ trống cho hình chữ nhật w x h (cộng lề `le`), gần điểm `gan` nhất.
 * `cam`: các hộp [x0,y0,x1,y1] cấm thêm (vd bản vẽ vừa đặt). Trả về góc trái-trên [x, y] (y lớn).
 */
export function timCho(s, data, w, h, gan, { le = 30, cam = [], vung = null, boQua = new Set() } = {}) {
  // boQua: nguồn nét (chỉ số lớp CAD) không tính là chỗ bận, vd đường dây 110kV liên trạm sẽ đi lại sau
  const s0 = s;
  s = { ...s0, b: s0.b.filter((r) => !boQua.has(r[3])), t: s0.t.filter((r) => !boQua.has(r[7])), d: s0.d.filter((r) => !boQua.has(r[8])) };
  let [X0, Y0, X1, Y1] = [Infinity, Infinity, -Infinity, -Infinity];
  moiDoan(s, (a, b, c, d) => {
    X0 = Math.min(X0, a, c);
    Y0 = Math.min(Y0, b, d);
    X1 = Math.max(X1, a, c);
    Y1 = Math.max(Y1, b, d);
  });
  if (vung) [X0, Y0, X1, Y1] = vung;
  const nx = Math.ceil((X1 - X0) / O_THO) + 1;
  const ny = Math.ceil((Y1 - Y0) / O_THO) + 1;
  const ban = new Uint8Array(nx * ny);
  const danh = (x0, y0, x1, y1) => {
    const i0 = Math.max(0, Math.floor((Math.min(x0, x1) - X0) / O_THO));
    const i1 = Math.min(nx - 1, Math.floor((Math.max(x0, x1) - X0) / O_THO));
    const j0 = Math.max(0, Math.floor((Math.min(y0, y1) - Y0) / O_THO));
    const j1 = Math.min(ny - 1, Math.floor((Math.max(y0, y1) - Y0) / O_THO));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) ban[j * nx + i] = 1;
  };
  moiDoan(s, (a, b, c, d) => {
    const L = Math.hypot(c - a, d - b);
    const n = Math.max(1, Math.ceil(L / (O_THO / 2)));
    for (let k = 0; k <= n; k++) {
      const x = a + ((c - a) * k) / n;
      const y = b + ((d - b) * k) / n;
      danh(x, y, x, y);
    }
  });
  for (const r of s.t) {
    const [a, b, c, d] = hopChu(r, data.aligns);
    danh(a, b, c, d);
  }
  for (const r of s.d) danh(r[3] - r[6], r[4] - r[6], r[3] + r[6], r[4] + r[6]);
  for (const r of s.st) if (r.length >= 8) danh(r[4], r[5], r[6], r[7]);
  for (const c of cam) danh(...c);
  // ảnh tích phân
  const I = new Int32Array((nx + 1) * (ny + 1));
  for (let j = 0; j < ny; j++) {
    let dong = 0;
    for (let i = 0; i < nx; i++) {
      dong += ban[j * nx + i];
      I[(j + 1) * (nx + 1) + i + 1] = I[j * (nx + 1) + i + 1] + dong;
    }
  }
  const tong = (i0, j0, i1, j1) => I[j1 * (nx + 1) + i1] - I[j0 * (nx + 1) + i1] - I[j1 * (nx + 1) + i0] + I[j0 * (nx + 1) + i0];
  const cw = Math.ceil((w + 2 * le) / O_THO);
  const ch = Math.ceil((h + 2 * le) / O_THO);
  let tot = null;
  let bd = Infinity;
  for (let j = 0; j + ch <= ny; j++) {
    for (let i = 0; i + cw <= nx; i++) {
      const x = X0 + i * O_THO + le;
      const yTren = Y0 + (j + ch) * O_THO - le;
      const d = Math.hypot(x + w / 2 - gan[0], yTren - h / 2 - gan[1]);
      if (d >= bd) continue;
      if (tong(i, j, i + cw, j + ch) === 0) {
        bd = d;
        tot = [x, yTren];
      }
    }
  }
  return tot;
}

/**
 * QUY HOẠCH CHỖ ĐẶT NHIỀU BẢN VẼ CÙNG LÚC.
 *
 * ds: [{ id, w, h, noi: [{ o: [ox, oy], A: [x, y], tru?: [x0, y0, x1, y1] } | { o, ref: id, oRef: [ox, oy] }], w? }]
 *   o     : lệch của điểm nối so với tâm bản vẽ (toạ độ tờ tổng)
 *   A     : điểm nối cố định (đầu ra ngăn lộ); tru: khung trạm chứa ngăn lộ đó (cáp phải ra khỏi
 *           trạm theo phía dưới - bản vẽ nằm sau hàng ngăn lộ thì cộng thêm quãng vòng)
 *   ref   : điểm nối trên bản vẽ khác (tâm bản vẽ đó + oRef)
 * Chi phí một vị trí = tổng (theo trọng số) độ dài Manhattan các chỗ nối. Đặt lần lượt rồi cải
 * thiện vài vòng: gỡ từng bản vẽ ra, tìm chỗ trống có chi phí nhỏ nhất khi đã biết chỗ các bản
 * vẽ khác. Trả về Map id -> tâm [x, y].
 */
export function quyHoachCho(s, data, ds, { le = 40, boQua = new Set(), vong = 4, soThu = 12 } = {}) {
  const s0 = s;
  s = { ...s0, b: s0.b.filter((r) => !boQua.has(r[3])), t: s0.t.filter((r) => !boQua.has(r[7])), d: s0.d.filter((r) => !boQua.has(r[8])) };
  let [X0, Y0, X1, Y1] = [Infinity, Infinity, -Infinity, -Infinity];
  moiDoan(s, (a, b, c, d) => {
    X0 = Math.min(X0, a, c); Y0 = Math.min(Y0, b, d); X1 = Math.max(X1, a, c); Y1 = Math.max(Y1, b, d);
  });
  X0 -= 2000; Y0 -= 2000; X1 += 2000; Y1 += 2000;
  const nx = Math.ceil((X1 - X0) / O_THO) + 1;
  const ny = Math.ceil((Y1 - Y0) / O_THO) + 1;
  const ban = new Uint8Array(nx * ny);
  const danh = (x0, y0, x1, y1) => {
    const i0 = Math.max(0, Math.floor((Math.min(x0, x1) - X0) / O_THO));
    const i1 = Math.min(nx - 1, Math.floor((Math.max(x0, x1) - X0) / O_THO));
    const j0 = Math.max(0, Math.floor((Math.min(y0, y1) - Y0) / O_THO));
    const j1 = Math.min(ny - 1, Math.floor((Math.max(y0, y1) - Y0) / O_THO));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) ban[j * nx + i] = 1;
  };
  moiDoan(s, (a, b, c, d) => {
    const n = Math.max(1, Math.ceil(Math.hypot(c - a, d - b) / (O_THO / 2)));
    for (let k = 0; k <= n; k++) danh(a + ((c - a) * k) / n, b + ((d - b) * k) / n, a + ((c - a) * k) / n, b + ((d - b) * k) / n);
  });
  for (const r of s.t) danh(...hopChu(r, data.aligns));
  for (const r of s.d) danh(r[3] - r[6], r[4] - r[6], r[3] + r[6], r[4] + r[6]);
  // khung trạm (danh mục st) có nhiều khoảng trắng: chỉ tính phần có hình vẽ (đã đánh ở trên)
  const I = new Int32Array((nx + 1) * (ny + 1));
  for (let j = 0; j < ny; j++) {
    let dong = 0;
    for (let i = 0; i < nx; i++) {
      dong += ban[j * nx + i];
      I[(j + 1) * (nx + 1) + i + 1] = I[j * (nx + 1) + i + 1] + dong;
    }
  }
  const tong = (i0, j0, i1, j1) => I[j1 * (nx + 1) + i1] - I[j0 * (nx + 1) + i1] - I[j1 * (nx + 1) + i0] + I[j0 * (nx + 1) + i0];
  const tam = new Map();
  const hop = new Map(); // id -> [x0, y0, x1, y1] đã đặt (kể cả lề)
  const chiPhi = (b, cx, cy) => {
    let c = 0;
    for (const n of b.noi) {
      const px = cx + n.o[0], py = cy + n.o[1];
      let A = n.A;
      if (n.ref) {
        const t = tam.get(n.ref);
        if (!t) continue;
        A = [t[0] + n.oRef[0], t[1] + n.oRef[1]];
      }
      let d = Math.abs(px - A[0]) + Math.abs(py - A[1]);
      // điểm nối ở phía sau hàng đầu ra ngăn lộ (ngược hướng ngăn lộ chĩa ra) thì cáp phải vòng ra ngoài trạm
      const [ux, uy] = { xuong: [0, -1], len: [0, 1], phai: [1, 0], trai: [-1, 0] }[n.ra ?? 'xuong'];
      const truoc = (px - A[0]) * ux + (py - A[1]) * uy; // > 0: phía trước đầu ra
      if (n.tru && truoc < 20) {
        d += 2 * (20 - truoc);
        // còn nằm trong bề ngang trạm (theo hướng vuông góc) thì phải vòng qua mép trạm
        if (uy && px > n.tru[0] && px < n.tru[2]) d += 2 * Math.min(px - n.tru[0], n.tru[2] - px);
        if (ux && py > n.tru[1] && py < n.tru[3]) d += 2 * Math.min(py - n.tru[1], n.tru[3] - py);
      }
      c += d * (n.w ?? 1);
    }
    return c;
  };
  const datMot = (b) => {
    const cw = Math.ceil((b.w + 2 * le) / O_THO);
    const ch = Math.ceil((b.h + 2 * le) / O_THO);
    let tot = null, bd = Infinity;
    const khac = [...hop.entries()].filter(([id]) => id !== b.id).map(([, h]) => h);
    for (let j = 0; j + ch <= ny; j++) {
      for (let i = 0; i + cw <= nx; i++) {
        const x0 = X0 + i * O_THO, y0 = Y0 + j * O_THO, x1 = x0 + cw * O_THO, y1 = y0 + ch * O_THO;
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        const c = chiPhi(b, cx, cy);
        if (c >= bd) continue;
        if (tong(i, j, i + cw, j + ch) !== 0) continue;
        if (khac.some((h) => x0 < h[2] && x1 > h[0] && y0 < h[3] && y1 > h[1])) continue;
        bd = c;
        tot = [cx, cy, x0, y0, x1, y1];
      }
    }
    if (!tot) throw new Error(`Không tìm được chỗ cho bản vẽ ${b.id}`);
    tam.set(b.id, [tot[0], tot[1]]);
    hop.set(b.id, tot.slice(2));
    return bd;
  };
  /** Tổng chi phí khi mọi bản vẽ đã đặt (mỗi chỗ nối giữa hai bản vẽ tính hai lần như nhau). */
  const tongChiPhi = () => ds.reduce((t, b) => t + chiPhi(b, ...tam.get(b.id)), 0);
  const chay = (thuTu) => {
    tam.clear();
    hop.clear();
    for (const b of thuTu) datMot(b);
    let truoc = tongChiPhi();
    for (let v = 0; v < vong; v++) {
      for (const b of thuTu) {
        hop.delete(b.id);
        tam.delete(b.id);
        datMot(b);
      }
      const sau = tongChiPhi();
      if (sau >= truoc - 1e-6) break;
      truoc = sau;
    }
    return truoc;
  };
  // đa khởi đầu: đặt theo nhiều thứ tự khác nhau (bản vẽ nối nhiều trạm trước, ngẫu nhiên có hạt
  // giống cố định để chạy lại ra đúng kết quả), giữ phương án tổng chiều dài nối nhỏ nhất
  let hat = 12345;
  const ngauNhien = () => ((hat = (hat * 1103515245 + 12345) % 2147483648) / 2147483648);
  const thuTuDs = [ds, [...ds].reverse(), [...ds].sort((a, b) => b.noi.filter((n) => n.A).length - a.noi.filter((n) => n.A).length)];
  for (let m = 0; m < soThu; m++) {
    const t = [...ds];
    for (let i = t.length - 1; i > 0; i--) {
      const j = Math.floor(ngauNhien() * (i + 1));
      [t[i], t[j]] = [t[j], t[i]];
    }
    thuTuDs.push(t);
  }
  let tot = null;
  thuTuDs.forEach((t, m) => {
    const cp = chay(t);
    if (!tot || cp < tot.cp) tot = { cp, tam: new Map(tam), m };
  });
  console.log(`  quy hoạch chỗ đặt: thử ${thuTuDs.length} thứ tự, tổng chiều dài nối ước tính nhỏ nhất ${tot.cp.toFixed(0)} (thứ tự ${tot.m + 1})`);
  return tot.tam;
}

/**
 * Lưới chiếm chỗ cho tìm đường trong hộp `hop` = [x0,y0,x1,y1].
 * Bit: 1 nét ngang, 2 nét dọc, 4 nét xiên/cong, 8 chữ/thiết bị (cấm), 16 vùng phạt (khung trạm, bản vẽ lộ).
 */
export function luoiChiem(s, data, hop, { vungPhat = [], vungCam = [] } = {}) {
  const [X0, Y0, X1, Y1] = hop;
  const nx = Math.ceil((X1 - X0) / O) + 1;
  const ny = Math.ceil((Y1 - Y0) / O) + 1;
  const g = new Uint8Array(nx * ny);
  const oCua = (x, y) => [Math.floor((x - X0) / O), Math.floor((y - Y0) / O)];
  const dat = (i, j, bit) => {
    if (i >= 0 && j >= 0 && i < nx && j < ny) g[j * nx + i] |= bit;
  };
  moiDoan(s, (a, b, c, d) => {
    if (Math.max(a, c) < X0 - O || Math.min(a, c) > X1 + O || Math.max(b, d) < Y0 - O || Math.min(b, d) > Y1 + O) return;
    const dx = c - a;
    const dy = d - b;
    const L = Math.hypot(dx, dy);
    const bit = Math.abs(dy) <= Math.abs(dx) * 0.05 ? 1 : Math.abs(dx) <= Math.abs(dy) * 0.05 ? 2 : 4;
    const n = Math.max(1, Math.ceil(L / (O / 2)));
    for (let k = 0; k <= n; k++) {
      const [i, j] = oCua(a + (dx * k) / n, b + (dy * k) / n);
      dat(i, j, bit);
    }
  });
  const danhHop = (x0, y0, x1, y1, bit) => {
    const [i0, j0] = oCua(Math.min(x0, x1), Math.min(y0, y1));
    const [i1, j1] = oCua(Math.max(x0, x1), Math.max(y0, y1));
    for (let j = Math.max(0, j0); j <= Math.min(ny - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(nx - 1, i1); i++) g[j * nx + i] |= bit;
  };
  // quanh đỉnh (góc, đầu mút) các nét có sẵn: trong 1 ô cấm đi qua, trong 2 ô cấm cắt ngang - vòng
  // nhảy (bán kính 5) hoặc góc sát nhau lọt vào sai số bắt điểm của mô hình công suất thành đấu nối
  for (const r of s.b) {
    for (let k = 4; k + 1 < r.length; k += 2) {
      const x = r[k];
      const y = r[k + 1];
      if (x < X0 - 2 * O || x > X1 + 2 * O || y < Y0 - 2 * O || y > Y1 + 2 * O) continue;
      const [i, j] = oCua(x, y);
      for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) dat(i + di, j + dj, Math.abs(di) <= 1 && Math.abs(dj) <= 1 ? 96 : 32);
    }
  }
  for (const r of s.t) {
    const [a, b, c, d] = hopChu(r, data.aligns);
    if (c < X0 || a > X1 || d < Y0 || b > Y1) continue;
    danhHop(a, b, c, d, 8);
  }
  for (const r of s.d) {
    const k = r[6] * 0.6;
    danhHop(r[3] - k, r[4] - k, r[3] + k, r[4] + k, 8);
  }
  for (const r of s.c ?? []) danhHop(r[2] - r[4], r[3] - r[4], r[2] + r[4], r[3] + r[4], 8);
  for (const r of s.st) if (r.length >= 8) danhHop(r[4], r[5], r[6], r[7], 16);
  for (const v of vungPhat) danhHop(...v, 16);
  for (const v of vungCam) danhHop(...v, 8);
  return { g, nx, ny, X0, Y0, oCua };
}

/**
 * Đường gấp khúc vuông góc từ a tới b. `ra`: hướng đi ra ở a ('xuong','len','trai','phai'),
 * `vao`: hướng đi vào b (hướng di chuyển ở bước cuối). Trả về danh sách điểm (gồm a, b) hoặc null.
 */
export function timDuong(L, a, b, { ra = null, vao = null, gioiHan = 4e6 } = {}) {
  const { g, nx, ny, X0, Y0, oCua } = L;
  const [si, sj] = oCua(...a);
  const [ti, tj] = oCua(...b);
  const HUONG = [
    [1, 0], // 0 phải
    [-1, 0], // 1 trái
    [0, 1], // 2 lên
    [0, -1], // 3 xuống
  ];
  const tenH = { phai: 0, trai: 1, len: 2, xuong: 3 };
  const gan = (i, j, i2, j2, r) => Math.abs(i - i2) <= r && Math.abs(j - j2) <= r;
  const tuDo = (i, j) => gan(i, j, si, sj, 2) || gan(i, j, ti, tj, 2);
  const cell = (i, j) => (i < 0 || j < 0 || i >= nx || j >= ny ? 255 : g[j * nx + i]);
  // chi phí vào ô (i,j) khi đi theo hướng h; Infinity = cấm
  const phi = (i, j, h) => {
    const v = cell(i, j);
    if (v === 255) return Infinity;
    if (tuDo(i, j)) return 1;
    if (v & 8 || v & 4) return Infinity;
    const ngang = h < 2;
    let c = v & 16 ? 4 : 1;
    if (v & 64) return Infinity; // sát đỉnh (đầu mút, góc) nét khác - lọt sai số bắt điểm
    if (v & 32) {
      if (v & 3) return Infinity; // cắt / đè nét sát đỉnh của nó
      c += 6;
    }
    if (ngang) {
      if (v & 1) return Infinity; // đè nét ngang
      if (v & 2) c += 40; // cắt nét dọc
      if ((cell(i, j + 1) & 1 || cell(i, j - 1) & 1) && !(v & 2)) return Infinity; // sát nét ngang
    } else {
      if (v & 2) return Infinity;
      if (v & 1) c += 40;
      if ((cell(i + 1, j) & 2 || cell(i - 1, j) & 2) && !(v & 1)) return Infinity;
    }
    return c;
  };
  // rẽ ở (i,j) từ hướng h sang h2: trong 2 ô phía trước (h2) hoặc 2 ô vừa đi qua (h) có nét cắt ngang
  const gocSatCho = (i, j, h, h2) => {
    for (let k = 1; k <= 2; k++) {
      const [a, b] = HUONG[h2];
      if (cell(i + a * k, j + b * k) & (h2 < 2 ? 2 : 1)) return true;
      const [c, d] = HUONG[h];
      if (cell(i - c * k, j - d * k) & (h < 2 ? 2 : 1)) return true;
    }
    return false;
  };
  const N = nx * ny * 4;
  const dist = new Float64Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  // hàng đợi ưu tiên (heap nhị phân)
  const heap = [];
  const push = (f, s) => {
    heap.push([f, s]);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heap[p][0] <= heap[k][0]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  };
  const hRa = ra != null ? tenH[ra] : null;
  const hVao = vao != null ? tenH[vao] : null;
  const H = (i, j) => Math.abs(i - ti) + Math.abs(j - tj);
  for (let h = 0; h < 4; h++) {
    if (hRa != null && h !== hRa) continue;
    const s0 = ((sj * nx + si) << 2) | h;
    dist[s0] = 0;
    push(H(si, sj), s0);
  }
  let dich = -1;
  let dem = 0;
  while (heap.length) {
    const [f, st] = pop();
    const h = st & 3;
    const c = st >> 2;
    const i = c % nx;
    const j = (c - i) / nx;
    const d = dist[st];
    if (f - H(i, j) > d + 1e-9) continue;
    if (i === ti && j === tj && (hVao == null || h === hVao)) {
      dich = st;
      break;
    }
    if (++dem > gioiHan) break;
    const catTaiDay = (cell(i, j) & 3) !== 0 && !tuDo(i, j);
    for (let h2 = 0; h2 < 4; h2++) {
      if ((h ^ h2) === 1 && (h >> 1) === (h2 >> 1)) continue; // quay đầu
      if (h2 !== h && catTaiDay) continue; // không rẽ tại chỗ cắt / chỗ đè
      if (h2 !== h && !tuDo(i, j) && gocSatCho(i, j, h, h2)) continue; // góc sát chỗ cắt (vòng nhảy chạm góc)
      const [di, dj] = HUONG[h2];
      const i2 = i + di;
      const j2 = j + dj;
      const p = phi(i2, j2, h2);
      if (p === Infinity) continue;
      const nd = d + p + (h2 !== h ? (cell(i, j) & 32 && !tuDo(i, j) ? 60 : 15) : 0);
      const s2 = ((j2 * nx + i2) << 2) | h2;
      if (nd < dist[s2]) {
        dist[s2] = nd;
        prev[s2] = st;
        push(nd + H(i2, j2), s2);
      }
    }
  }
  if (dich < 0) return null;
  const o = [];
  for (let st = dich; st >= 0; st = prev[st]) o.push(st);
  o.reverse();
  const tam = (st) => {
    const c = st >> 2;
    const i = c % nx;
    const j = (c - i) / nx;
    return [X0 + (i + 0.5) * O, Y0 + (j + 0.5) * O];
  };
  let pts = o.map(tam);
  // bỏ đỉnh thẳng hàng
  const gon = [pts[0]];
  for (let k = 1; k < pts.length - 1; k++) {
    const [p, q, r] = [gon.at(-1), pts[k], pts[k + 1]];
    if (Math.abs((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])) > 1e-6) gon.push(q);
  }
  gon.push(pts.at(-1));
  pts = gon;
  // khớp đúng hai đầu: đoạn đầu / cuối lấy theo toạ độ a / b
  const khop = (arr, P, dau) => {
    const k = dau ? 0 : arr.length - 1;
    const k2 = dau ? 1 : arr.length - 2;
    if (arr.length < 2) return;
    const doc = Math.abs(arr[k2][0] - arr[k][0]) < 1e-6;
    if (doc) {
      arr[k][0] = P[0];
      arr[k2][0] = P[0];
    } else {
      arr[k][1] = P[1];
      arr[k2][1] = P[1];
    }
    arr[k] = [P[0], P[1]];
  };
  if (pts.length === 1) return [a, b];
  if (pts.length === 2) {
    // một đoạn thẳng: chèn góc nếu a, b lệch
    return Math.abs(a[0] - b[0]) < 1e-6 || Math.abs(a[1] - b[1]) < 1e-6 ? [a, b] : [a, [a[0], b[1]], b];
  }
  khop(pts, a, true);
  khop(pts, b, false);
  return pts.map(([x, y]) => [+x.toFixed(2), +y.toFixed(2)]);
}
