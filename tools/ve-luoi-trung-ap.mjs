/**
 * VẼ LƯỚI TRUNG ÁP (ĐƯỜNG TRỤC + NHÁNH LIÊN KẾT) LÊN TỜ SƠ ĐỒ KẾT DÂY TỔNG.
 *
 *   node tools/ve-luoi-trung-ap.mjs [src/data/tram-sld.json]
 *
 * Nguồn: các bản vẽ lộ trung áp của Phòng Điều độ (Google Drive "So do luoi dien/
 * 1. Lưới trung áp KV Thái Nguyên"). Mỗi lộ được CHÉP TAY sang dạng mô tả dưới đây
 * (file tools/luoi-trung-ap/*.mjs) theo quy ước:
 *   - chỉ đường trục chính và các nhánh có liên kết với đường dây khác, không vẽ TBA
 *     phân phối;
 *   - đủ các đoạn dây / cáp (loại, tiết diện, chiều dài nếu bản vẽ có ghi);
 *   - tủ RMU chỉ vẽ ngăn vào, ngăn ra;
 *   - đủ thiết bị trên trục và ranh giới quản lý / vận hành.
 * Công cụ xếp các phần tử đó dọc theo đường đi đã định (bắt đầu từ đầu ra của ngăn
 * lộ trong trạm) rồi ghi thành nét / thiết bị / chữ của tờ TONG, lớp CAD gốc
 * "Lưới trung áp". Chạy lại bao nhiêu lần cũng được (xoá phần đã vẽ rồi vẽ lại).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const duongDan = resolve(process.argv[2] ?? 'src/data/tram-sld.json');
const tmp = mkdtempSync(join(tmpdir(), 'lta-'));
const bundle = join(tmp, 'blocks.mjs');
execFileSync('npx', ['esbuild', 'src/symbols/blocks.ts', '--bundle', '--format=esm', '--platform=node', `--outfile=${bundle}`, '--log-level=warning'], {
  stdio: 'inherit',
});
const { getBlock } = await import(pathToFileURL(bundle).href);
rmSync(tmp, { recursive: true, force: true });

const data = JSON.parse(readFileSync(duongDan, 'utf8'));
const s = data.sheets.find((x) => x.code === 'TONG');
const idx = (arr, v) => {
  let i = arr.indexOf(v);
  if (i < 0) {
    arr.push(v);
    i = arr.length - 1;
  }
  return i;
};
const SRC = idx(data.srcLayers, 'Lưới trung áp');
const LOP_CHU = data.layers.indexOf('Ghi chú');
const KIEU = { dz: data.lineKinds.indexOf('ĐDK'), cap: data.lineKinds.indexOf('Cáp ngầm') };
const ALIGN = { trai: data.aligns.indexOf('left'), giua: data.aligns.indexOf('center'), phai: data.aligns.indexOf('right') };

// xoá phần đã vẽ lần trước
for (const k of ['b', 'd']) s[k] = s[k].filter((r) => r[k === 'b' ? 3 : 8] !== SRC);
s.t = s.t.filter((r) => r[7] !== SRC);
s.c = (s.c ?? []).filter((r) => r[5] !== SRC);

/* ------------------------------ cỡ chữ, khoảng cách ------------------------------ */
const H_TEN = 4; // tên thiết bị
const H_COT = 3.4; // số cột
const H_DZ = 3.4; // loại dây / cáp
const SC = 9; // cỡ ký hiệu thiết bị
const RONG = (txt, h) => String(txt).length * h * 0.5;

let kv = 22;
let lop = data.layers.indexOf('22kV');
const net = (pts, cap) => s.b.push([lop, kv, cap ? KIEU.cap : KIEU.dz, SRC, ...pts.flat().map((v) => +v.toFixed(3))]);
const chu = (x, y, h, text, canh = 'giua', rot = 0) => s.t.push([LOP_CHU, kv, +x.toFixed(3), +y.toFixed(3), h, rot, ALIGN[canh], SRC, text]);
const thietBi = (block, x, y, rot, mo, scale = SC) =>
  s.d.push([lop, kv, data.blocks.indexOf(block), +x.toFixed(3), +y.toFixed(3), rot, scale, data.states.indexOf(mo ? 'mo' : 'dong'), SRC, 0]);
const cham = (x, y) => s.c.push([lop, kv, +x.toFixed(3), +y.toFixed(3), 1.2, SRC]);

/** Nửa chiều dài ký hiệu dọc trục (để cắt dây ở hai cực). */
function nuaTruc(block) {
  const def = getBlock(block);
  const c = def?.cuc?.[0] ?? [0, 0.5];
  return Math.hypot(c[0], c[1]) * SC;
}
/** Góc đặt thiết bị cho nằm dọc theo dây có góc `goc` (độ). */
function gocDat(block, goc) {
  // Ký hiệu chuẩn hoá có trục dọc; riêng DCL trục ngang (xem block DCL trong trạm)
  const n = block === 'DCL' ? 90 : 0;
  return (((goc - 90 - n) % 360) + 360) % 360;
}

/* ------------------------------ xếp phần tử dọc tuyến ------------------------------ */
/** Bề rộng mỗi loại phần tử chiếm trên tuyến. */
function beRong(m, doc = false) {
  if (m.coc !== undefined) return 13;
  // tuyến dọc ghi tên thiết bị bên cạnh nên không cần chừa bề ngang cho chữ
  if (m.tb) return doc || m.gon ? 24 : Math.max(34, RONG(m.ten?.[0] ?? '', H_TEN) + 4);
  if (m.rmu) return 26 * m.ngan.length + 14;
  if (m.tu) return 24;
  if (m.ranh) return 22;
  if (m.ghi) return Math.max(16, m.rong ?? 16);
  if (m.nhanh) return 12;
  if (m.dz) return 0;
  if (m.khoang) return m.khoang;
  return 0;
}

/**
 * Vẽ một đoạn tuyến thẳng từ điểm a theo hướng (dx, dy) (đơn vị), các phần tử `muc`.
 * Trả về điểm cuối. `benTen`: phía đặt tên thiết bị (+1 / -1 theo pháp tuyến).
 */
function veDoan(a, huong, muc, opts = {}) {
  const [dx, dy] = huong;
  const nx = -dy; // pháp tuyến bên trái
  const ny = dx;
  const goc = (Math.atan2(dy, dx) * 180) / Math.PI;
  const doc = Math.abs(dy) > Math.abs(dx);
  const P = (t, o = 0) => [a[0] + dx * t + nx * o, a[1] + dy * t + ny * o];
  let t = opts.batDau ?? 0;
  let tDay = t; // đầu đoạn dây đang vẽ
  let loai = opts.loai ?? { cap: false, nhan: null, dai: null };
  const nhanDz = []; // [t0, t1, loai, [khoảng trống]]
  let tDz = t;
  let trong = []; // các khoảng trống (khoang) trong quãng dây hiện tại
  const catDay = (t1) => {
    if (t1 - tDay > 0.01) net([P(tDay), P(t1)], loai.cap);
  };
  for (const m of muc) {
    if (m.dz) {
      // đổi loại dây: kết thúc đoạn dây cũ đúng tại đây
      catDay(t);
      tDay = t;
      if (t > tDz) nhanDz.push([tDz, t, loai, trong]);
      loai = { cap: !!m.cap, nhan: m.an ? null : m.dz, dai: m.dai ?? null };
      tDz = t;
      trong = [];
      continue;
    }
    if (m.khoang) {
      trong.push([t, t + m.khoang]);
      t += m.khoang;
      continue;
    }
    const w = beRong(m, doc);
    const tm = t + w / 2;
    if (m.coc !== undefined) {
      const [x, y] = P(tm, doc ? 0 : 2.5);
      if (doc) chu(x - 3, y - H_COT / 2, H_COT, m.coc, 'phai');
      else chu(x, y, H_COT, m.coc, 'giua');
      const [cx, cy] = P(tm);
      cham(cx, cy);
    } else if (m.tb) {
      const h = nuaTruc(m.tb);
      const [x, y] = P(tm);
      // dao cách ly: dây vẽ liền qua ký hiệu; thiết bị khác: cắt dây ở hai cực
      if (m.tb !== 'DCL') {
        catDay(tm - h);
        tDay = tm + h;
      }
      thietBi(m.tb, x, y, gocDat(m.tb, goc), !!m.mo);
      const ten = m.ten ?? [];
      if (doc) ten.forEach((dong, i) => chu(x + 8, y + 2 - i * (H_TEN + 1), H_TEN, dong, 'trai'));
      else ten.forEach((dong, i) => chu(x, y - 11 - i * (H_TEN + 1), H_TEN, dong, 'giua'));
    } else if (m.rmu) {
      // tủ RMU: khung + các ngăn nối tiếp (ngăn vào / ngăn ra) + ngăn rẽ nhánh
      const n = m.ngan.length;
      const t0 = t + 3;
      const t1 = t + w - 3;
      const duoi = m.re?.some((r) => r.phia !== 'trai') ? -34 : -9;
      const tren = m.re?.some((r) => r.phia === 'trai') ? 30 : 14;
      const hop = [P(t0, duoi), P(t1, duoi), P(t1, tren), P(t0, tren), P(t0, duoi)];
      net(hop, false);
      chu(...(doc ? P(t0 - 2, tren + 2) : P((t0 + t1) / 2, tren + 2)), 3.4, m.rmu, doc ? 'trai' : 'giua', doc ? 90 : 0);
      // Dây vào / ra nối thẳng tới cực ngăn tủ (không dừng ở mép khung - nét dừng đúng
      // mép khung sẽ bị nhận nhầm là cạnh khung tủ)
      const hL = nuaTruc('LBS');
      const buoc = (t1 - t0) / n;
      let tTruoc = tDay;
      m.ngan.forEach((ng, i) => {
        const tc = t0 + buoc * (i + 0.5);
        net([P(tTruoc), P(tc - hL)], i === 0 && loai.cap);
        thietBi('LBS', ...P(tc), gocDat('LBS', goc), !!ng.mo);
        chu(...P(tc, 8.5), 3, ng.ten ?? ng, 'giua', doc ? 90 : 0);
        tTruoc = tc + hL;
      });
      // ngăn rẽ nhánh từ thanh cái trong tủ
      for (const r of m.re ?? []) {
        const tr = (t0 + t1) / 2;
        const goc2 = r.phia === 'trai' ? [nx, ny] : [-nx, -ny];
        const [bx, by] = P(tr, 0);
        // ngăn rẽ vẽ vuông góc, ngay trong khung
        const a2 = [bx, by];
        veNhanh(a2, goc2, [{ khoang: 2 }, { tb: 'LBS', ten: r.ten, mo: r.mo, gon: true }, ...(r.muc ?? [])], r.cuoi, 0);
      }
      tDay = tTruoc;
    } else if (m.tu) {
      // tụ bù treo dưới dây
      const [x, y] = P(tm);
      const [x2, y2] = P(tm, -10);
      net([[x, y], [x2, y2]], false);
      thietBi('TUBU', x2, y2 - 2, gocDat('TUBU', goc + 90) , false, 6);
      m.tu.forEach((dong, i) => chu(x2, y2 - 12 - i * (H_TEN + 1), H_TEN, dong, 'giua'));
    } else if (m.ranh) {
      // ranh giới quản lý: vạch ngang tuyến + tên hai bên
      const [x1, y1] = P(tm, doc ? 16 : 12);
      const [x2, y2] = P(tm, doc ? -16 : -30);
      s.b.push([LOP_CHU, kv, KIEU.cap, SRC, +x1.toFixed(3), +y1.toFixed(3), +x2.toFixed(3), +y2.toFixed(3)]);
      if (doc) {
        // tuyến dọc: tên hai bên vạch ranh giới, ghi phía phải tuyến
        const [ax, ay] = P(tm - 3, 0);
        const [bx, by] = P(tm + 3 + H_TEN, 0);
        const len = dy < 0 ? ['↑', '↓'] : ['↓', '↑'];
        chu(ax + 18, ay, H_TEN, `${len[0]} ${m.ranh[0]}`, 'trai');
        chu(bx + 18, by, H_TEN, `${len[1]} ${m.ranh[1]}`, 'trai');
      } else {
        const [ax, ay] = P(tm - 2, -26);
        const [bx, by] = P(tm + 2, -26);
        chu(ax, ay, H_TEN, `${m.ranh[0]} ←`, 'phai');
        chu(bx, by, H_TEN, `→ ${m.ranh[1]}`, 'trai');
      }
    } else if (m.ghi) {
      const [x, y] = P(tm, doc ? 0 : -9);
      chu(doc ? x + 8 : x, y, H_COT, m.ghi, doc ? 'trai' : 'giua');
    } else if (m.nhanh) {
      const [x, y] = P(tm);
      cham(x, y);
      const huong2 = m.nhanh.phia === 'trai' ? [nx, ny] : [-nx, -ny];
      veNhanh([x, y], huong2, m.nhanh.muc, m.nhanh.cuoi, 0, m.nhanh.loai);
    }
    t += w;
  }
  if (opts.them) trong.push([t, t + opts.them]);
  t += opts.them ?? 0;
  catDay(t);
  nhanDz.push([tDz, t, loai, trong]);
  // nhãn loại dây / cáp giữa từng quãng
  for (const [k, [t0, t1, l, kt]] of nhanDz.entries()) {
    if (!l.nhan || t1 - t0 < 8) continue;
    // quãng nối tiếp từ cạnh trước đã ghi nhãn rồi
    if (k === 0 && opts.daGhi) continue;
    // đặt nhãn giữa khoảng trống dài nhất của quãng (không đè lên thiết bị, tủ RMU)
    // ưu tiên khoảng trống đầu tiên đủ rộng cho nhãn, không có thì khoảng rộng nhất
    const kmax =
      kt.find(([a, b]) => b - a >= RONG(l.dai ? `${l.nhan} - ${l.dai}` : l.nhan, H_DZ) * 0.9) ??
      [...kt].sort((a, b) => b[1] - b[0] - (a[1] - a[0]))[0];
    const tm = kmax ? (kmax[0] + kmax[1]) / 2 : (t0 + t1) / 2;
    const txt = l.dai ? `${l.nhan} - ${l.dai}` : l.nhan;
    if (doc) {
      const [x, y] = P(tm, 0);
      chu(x - 5, y, H_DZ, txt, 'giua', 90);
    } else {
      const [x, y] = P(tm, 8);
      chu(x, y, H_DZ, txt, 'giua');
    }
  }
  return [P(t), loai];
}

/** Nhánh vuông góc: vẽ thẳng rồi ghi đích liên kết ở cuối. */
function veNhanh(a, huong, muc, cuoi, batDau = 0, loai) {
  const [b] = veDoan(a, huong, muc, { batDau, them: 14, loai });
  if (cuoi) {
    const [dx, dy] = huong;
    const doc = Math.abs(dy) > Math.abs(dx);
    if (doc) chu(b[0], b[1] + (dy > 0 ? 3 : -7), H_TEN, `${dy > 0 ? '↑' : '↓'} ${cuoi}`, 'giua');
    else chu(b[0] + (dx > 0 ? 3 : -3), b[1] - H_TEN / 2, H_TEN, dx > 0 ? `→ ${cuoi}` : `${cuoi} ←`, dx > 0 ? 'trai' : 'phai');
  }
  return b;
}

/**
 * Vẽ một lộ: đường đi `duong` (các đỉnh, bắt đầu ở đầu ra ngăn lộ trong trạm) và
 * danh sách phần tử chia theo từng cạnh của đường đi.
 */
function veLo(lo) {
  let loai = null;
  for (let i = 0; i + 1 < lo.duong.length; i++) {
    const a = lo.duong[i];
    const b = lo.duong[i + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const huong = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    const muc = lo.canh[i] ?? [];
    const dung = muc.reduce((t, m) => t + beRong(m, Math.abs(huong[1]) > Math.abs(huong[0])), 0);
    const cuoiCung = i + 2 === lo.duong.length;
    // cạnh cuối: vẽ vừa đủ các phần tử rồi thêm một đoạn ngắn tới chữ liên kết
    const [p, l] = veDoan(a, huong, muc, { loai: loai ?? undefined, daGhi: !!loai?.nhan, them: cuoiCung ? 24 : Math.max(0, L - dung) });
    loai = l;
    if (dung > L + 0.5) console.log(`  ! ${lo.ten}: cạnh ${i + 1} cần ${dung.toFixed(0)} đơn vị, đường đi chỉ ${L.toFixed(0)}`);
    if (cuoiCung && lo.cuoi) {
      if (Math.abs(huong[1]) > Math.abs(huong[0])) chu(p[0], p[1] + (huong[1] > 0 ? 3 : -7), H_TEN, lo.cuoi, 'giua');
      else chu(p[0] + 3, p[1] - H_TEN / 2, H_TEN, `→ ${lo.cuoi}`, 'trai');
    }
  }
  if (lo.tieuDe) chu(lo.tieuDe[0], lo.tieuDe[1], 6, lo.ten, 'trai');
}

const thuMuc = resolve('tools/luoi-trung-ap');
const dsLo = [];
for (const f of readdirSync(thuMuc).filter((f) => f.endsWith('.mjs')).sort()) {
  const mod = await import(pathToFileURL(join(thuMuc, f)).href);
  dsLo.push(mod.default);
}
for (const lo of dsLo) {
  kv = lo.kv ?? 22;
  lop = data.layers.indexOf(`${kv}kV`);
  veLo(lo);
  console.log(`  ${lo.ten}: đã vẽ`);
}
writeFileSync(duongDan, JSON.stringify(data));
const dem = (k, i) => s[k].filter((r) => r[i] === SRC).length;
console.log(`Lưới trung áp: ${dsLo.length} lộ - ${dem('b', 3)} nét, ${dem('d', 8)} thiết bị, ${dem('t', 7)} chữ.`);
