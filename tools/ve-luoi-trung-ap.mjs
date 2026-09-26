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
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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
const { timCho, luoiChiem, timDuong, quyHoachCho } = await import(pathToFileURL(resolve('tools/pdf-lo/tim-duong.mjs')).href);
const { doiDiem } = await import(pathToFileURL(resolve('tools/vi-tri-tram.mjs')).href);
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
s.nhay = []; // điểm đầu các vòng nhảy giao chéo (chỉ lưới trung áp dùng)

/* ------------------------------ cỡ chữ, khoảng cách ------------------------------ */
const H_TEN = 4; // tên thiết bị
const H_COT = 3.4; // số cột
const H_DZ = 3.4; // loại dây / cáp
const SC = 9; // cỡ ký hiệu thiết bị
const RONG = (txt, h) => String(txt).length * h * 0.5;
const W_NGAN = 26; // bề rộng một ngăn tủ RMU
const H_DAU_RMU = 10; // hàng tên tủ RMU khi tủ nằm trên tuyến dọc

let kv = 22;
let lop = data.layers.indexOf('22kV');
// nét bên trong tủ RMU (khung, thanh cái, dây ngăn) và đoạn đường dây bị giao chéo:
// không vẽ vòng nhảy giao chéo cho các nét này
const dongRmu = new Set();
const dongGiao = new Set();
let trongRmu = false;
const net = (pts, cap) => {
  const r = [lop, kv, cap ? KIEU.cap : KIEU.dz, SRC, ...pts.flat().map((v) => +v.toFixed(3))];
  s.b.push(r);
  if (trongRmu) dongRmu.add(r);
};
const chu = (x, y, h, text, canh = 'giua', rot = 0) => s.t.push([LOP_CHU, kv, +x.toFixed(3), +y.toFixed(3), h, rot, ALIGN[canh], SRC, text]);
// DCL trên lưới trung áp dùng ký hiệu DCLTA: thanh tiếp điểm dài tới hai cực, dây cắt ở hai
// cực mà khi đóng nhìn vẫn liền mạch
const KY_HIEU = { DCL: 'DCLTA' };
const iBlock = (block) => {
  let i = data.blocks.indexOf(block);
  if (i < 0) i = data.blocks.push(block) - 1;
  return i;
};
const thietBi = (block, x, y, rot, mo, scale = SC) =>
  s.d.push([lop, kv, iBlock(KY_HIEU[block] ?? block), +x.toFixed(3), +y.toFixed(3), rot, scale, data.states.indexOf(mo ? 'mo' : 'dong'), SRC, 0]);
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
  const g = (((goc - 90 - n) % 360) + 360) % 360;
  // recloser đối xứng hai đầu: quay sao cho chữ R luôn ở phía trên (tuyến ngang)
  // hoặc bên trái (tuyến dọc), không đè lên tên thiết bị
  if (block === 'REC') {
    const r = (g * Math.PI) / 180;
    const doc = Math.abs(Math.cos(r)) > 0.7;
    if (doc ? Math.cos(r) < 0 : Math.sin(r) > 0) return (g + 180) % 360;
  }
  return g;
}

/* ------------------------------ xếp phần tử dọc tuyến ------------------------------ */
/** Bề rộng mỗi loại phần tử chiếm trên tuyến. */
function beRong(m, doc = false) {
  if (m.coc !== undefined) return 13;
  // tuyến dọc ghi tên thiết bị bên cạnh nên không cần chừa bề ngang cho chữ
  if (m.tb) return doc || m.gon ? 24 : Math.max(34, RONG(m.ten?.[0] ?? '', H_TEN) + 4);
  if (m.rmu) return W_NGAN * m.ngan.length + 8 + (doc ? H_DAU_RMU : 0);
  if (m.tu) return 24;
  if (m.ranh) return 22;
  if (m.ghi) return Math.max(16, m.rong ?? 16);
  if (m.giao) return 16;
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
    // rải đều phần dài còn thừa của cạnh vào khoảng giữa các phần tử
    if (opts.gian) {
      trong.push([t, t + opts.gian]);
      t += opts.gian;
    }
    const w = beRong(m, doc);
    const tm = t + w / 2;
    if (m.coc !== undefined) {
      // số cột: tuyến dọc ghi bên trái, tuyến ngang ghi phía trên (theo hướng bản vẽ)
      const [x, y] = P(tm);
      if (doc) chu(x - 3, y - H_COT / 2, H_COT, m.coc, 'phai');
      else if (m.nhanh) chu(x + 2, y + 2.5, H_COT, m.coc, 'trai'); // tránh nét nhánh
      else chu(x, y + 2.5, H_COT, m.coc, 'giua');
      cham(x, y);
      // nhánh rẽ ngay tại cột (không vẽ thêm điểm rẽ riêng)
      if (m.nhanh) {
        const huong2 = m.nhanh.phia === 'trai' ? [nx, ny] : [-nx, -ny];
        veNhanh([x, y], huong2, m.nhanh.muc, m.nhanh.cuoi, 0, m.nhanh.loai);
      }
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
      tDayRmu = { t: tDay, cap: loai.cap };
      tDay = veRmu(m, t, P, goc, [dx, dy], [nx, ny]);
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
    } else if (m.giao) {
      // giao chéo với đường dây khác (không đấu nối): vẽ khúc đường dây kia cắt ngang
      // tuyến, ghi tên ở đầu khúc; vòng nhảy qua trên tuyến này vẽ chung ở veGiaoCheo()
      const kvG = m.kv ?? kv;
      const [ax, ay] = P(tm, 11);
      const [bx, by] = P(tm, -11);
      const r = [data.layers.indexOf(`${kvG}kV`), kvG, KIEU.dz, SRC, +ax.toFixed(3), +ay.toFixed(3), +bx.toFixed(3), +by.toFixed(3)];
      s.b.push(r);
      dongGiao.add(r);
      if (doc) chu(Math.max(ax, bx) + 2, ay - H_COT / 2, H_COT, m.giao, 'trai');
      else chu(ax, Math.max(ay, by) + 2, H_COT, m.giao, 'giua');
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
      kt.find(([a, b]) => b - a >= (doc ? 14 : RONG(l.dai ? `${l.nhan} - ${l.dai}` : l.nhan, H_DZ) * 0.9)) ??
      [...kt].sort((a, b) => b[1] - b[0] - (a[1] - a[0]))[0];
    const tm = kmax ? (kmax[0] + kmax[1]) / 2 : (t0 + t1) / 2;
    const txt = l.dai ? `${l.nhan} - ${l.dai}` : l.nhan;
    if (doc) {
      // tuyến dọc: ghi ngang bên trái dây (loại dây / chiều dài hai dòng)
      const [x, y] = P(tm, 0);
      const dong = l.dai ? [l.nhan, l.dai] : [l.nhan];
      dong.forEach((d, i) => chu(x - 4, y + (dong.length / 2 - i - 1) * (H_DZ + 1), H_DZ, d, 'phai'));
    } else {
      const [x, y] = P(tm, 8);
      chu(x, y, H_DZ, txt, 'giua');
    }
  }
  return [P(t), loai];
}

/**
 * Tủ RMU theo mẫu bản vẽ lộ: khung, hàng tên tủ, hàng tên ngăn, thanh cái trong tủ;
 * mỗi ngăn: dao cách ly (ký hiệu như DCL trong trạm) + dao tiếp địa (-76), cáp đấu ở
 * chân ngăn. Chỉ vẽ ngăn vào, ngăn ra (và ngăn rẽ sang lộ khác). Tủ nằm phía bên trái
 * tuyến (phía trên nếu tuyến chạy sang phải); dây vào đấu chân ngăn đầu, dây ra đi từ
 * chân ngăn cuối. Tuyến dọc: các ngăn xếp chồng theo tuyến, hàng tên tủ ở trên cùng,
 * mọi chữ vẫn nằm ngang (không phải nghiêng đầu khi xem).
 * Trả về vị trí (theo tuyến) của ngăn ra - nơi đường trục đi tiếp.
 */
function veRmu(m, t, P, goc, huong, phap) {
  trongRmu = true;
  try {
    return veRmuTrong(m, t, P, goc, huong, phap);
  } finally {
    trongRmu = false;
  }
}
function veRmuTrong(m, t, P, goc, [dx, dy], [nx, ny]) {
  const n = m.ngan.length;
  const doc = Math.abs(dy) > Math.abs(dx);
  const t0 = t + 4;
  const H = 64; // chiều cao tủ (theo pháp tuyến)
  const oThanhCai = H - 21;
  const oDao = H - 33;
  const oTd = 13;
  const SD = 8; // cỡ dao tiếp địa
  // tuyến dọc: hàng tên tủ ở đầu tủ phía trên bản vẽ
  const HD = doc ? H_DAU_RMU : 0;
  const t1 = t0 + W_NGAN * n + HD;
  const c0 = doc && dy < 0 ? t0 + HD : t0; // đầu vùng các ngăn
  const tc = (i) => c0 + W_NGAN * (i + 0.5);
  // chữ nằm ngang, dời theo trục y bản vẽ (dyW) để khỏi đè nét
  const chuNgang = (tt, o, h, txt, can, dyW = 0) => {
    const [x, y] = P(tt, o);
    chu(x, y + dyW, h, txt, can);
  };

  net([P(t0, 4), P(t1, 4), P(t1, H), P(t0, H), P(t0, 4)], false);
  if (doc) {
    // hàng tên tủ + vách giữa các ngăn: kẻ ngang hết bề rộng tủ
    const tDau = dy < 0 ? t0 + HD : t1 - HD;
    net([P(tDau, 4), P(tDau, H)], false);
    for (let i = 1; i < n; i++) net([P(c0 + W_NGAN * i, 4), P(c0 + W_NGAN * i, H)], false);
    chuNgang(dy < 0 ? t0 + HD / 2 : t1 - HD / 2, (4 + H) / 2, 3.4, m.rmu, 'giua', -1.7);
  } else {
    // mẫu bản vẽ: hàng tên tủ trên cùng, vách ngăn tới hàng tên tủ, tên ngăn dưới đó
    const oTieuDe = H - 9;
    const gocChu = ((goc + 90) % 180 + 180) % 180 - 90; // chữ luôn đọc xuôi
    net([P(t0, oTieuDe), P(t1, oTieuDe)], false);
    for (let i = 1; i < n; i++) net([P(t0 + W_NGAN * i, 4), P(t0 + W_NGAN * i, oTieuDe)], false);
    chu(...P((t0 + t1) / 2, oTieuDe + 2.2), 3.4, m.rmu, 'giua', gocChu);
    m.ngan.forEach((ng, i) => chu(...P(tc(i), oTieuDe - 5.5), 2.8, ng.ten, 'giua', gocChu));
  }
  // thanh cái trong tủ
  net([P(tc(0), oThanhCai), P(tc(n - 1), oThanhCai)], false);
  m.ngan.forEach((ng, i) => {
    const x = tc(i);
    // tuyến dọc: tên ngăn ghi ngang ở phía ngoài thanh cái, ngay trên dây ngăn
    if (doc) chuNgang(x, (oThanhCai + H) / 2, 2.8, ng.ten, 'giua', 1.5);
    // dao cách ly ngăn tủ vẽ như DCL trong trạm (không hộp): dây liền qua ký hiệu
    net([P(x, oThanhCai), P(x, 0)], false);
    thietBi('DCL', ...P(x, oDao), gocDat('DCL', goc + 90), !!ng.mo);
    if (ng.mo) {
      if (doc) chuNgang(x, oDao, 2.6, '(thường cắt)', 'giua', -6);
      else chu(...P(x + 5, oDao - 2), 2.6, '(thường cắt)', 'trai');
    }
    // dao tiếp địa ngăn tủ (-76), bình thường cắt
    // (tuyến dọc: dao luôn treo xuống phía dưới bản vẽ)
    const lat = doc && dy < 0 ? -1 : 1;
    thietBi('DTD', ...P(x - lat * 0.52 * SD, oTd), ((goc - 90 + (lat < 0 ? 180 : 0)) % 360 + 360) % 360, true, SD);
    if (doc) chuNgang(x - lat * 0.52 * SD * 2.2, oTd + 7, 2.6, '-76', 'giua', -1.3);
    else chu(...P(x - 7, oTd - 7), 2.6, '-76', 'giua');
    if (ng.vai === 'vao') net([P(tDayRmu.t, 0), P(x, 0)], tDayRmu.cap);
    if (ng.vai === 're') {
      trongRmu = false;
      veNhanh(P(x, 0), [-nx, -ny], ng.muc ?? [], ng.cuoi, 0, ng.loai);
      trongRmu = true;
    }
  });
  return tc(m.ngan.findIndex((ng) => ng.vai === 'ra'));
}
let tDayRmu = { t: 0, cap: false };

/** Nhánh vuông góc: vẽ thẳng rồi ghi đích liên kết ở cuối. */
function veNhanh(a, huong, muc, cuoi, batDau = 0, loai) {
  // chừa một đoạn ở gốc nhánh để tên thiết bị đầu nhánh không đè lên chữ của trục
  const [b] = veDoan(a, huong, [{ khoang: 14 }, ...muc], { batDau, them: 14, loai });
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
    // cạnh cuối có ghi "→ LT ..." thì vẽ vừa đủ; không ghi thì kéo đúng tới điểm cuối
    // của đường đi (điểm gặp lộ khác)
    const soPt = muc.filter((m) => !m.dz && !m.khoang).length;
    const du = Math.max(0, L - dung);
    const gian = cuoiCung && lo.cuoi ? 0 : soPt ? du / (soPt + 1) : 0;
    const them = cuoiCung && lo.cuoi ? 24 : soPt ? gian : du;
    const [p, l] = veDoan(a, huong, muc, { loai: loai ?? undefined, daGhi: !!loai?.nhan, them, gian });
    loai = l;
    if (dung > L + 0.5) console.log(`  ! ${lo.ten}: cạnh ${i + 1} cần ${dung.toFixed(0)} đơn vị, đường đi chỉ ${L.toFixed(0)}`);
    if (cuoiCung && lo.cuoi) {
      if (Math.abs(huong[1]) > Math.abs(huong[0])) chu(p[0], p[1] + (huong[1] > 0 ? 3 : -7), H_TEN, lo.cuoi, 'giua');
      else chu(p[0] + 3, p[1] - H_TEN / 2, H_TEN, `→ ${lo.cuoi}`, 'trai');
    }
  }
  if (lo.tieuDe) chu(lo.tieuDe[0], lo.tieuDe[1], 6, lo.ten, 'trai');
}

/**
 * KÝ HIỆU GIAO CHÉO: chỗ đường trung áp vừa vẽ cắt ngang một đường dây khác mà không
 * đấu nối thì vẽ vòng nhảy qua (nửa vòng tròn) trên đường trung áp - tuyến ngang
 * nhảy lên trên, tuyến dọc nhảy sang trái. Hai đường trung áp cắt nhau thì chỉ tuyến
 * ngang nhảy. Không xét nét trong tủ RMU và các vạch ghi chú / ranh giới.
 */
function veGiaoCheo() {
  // bán kính lớn hơn sai số bắt điểm của mô hình công suất (~3 đơn vị trên tờ tổng)
  const R = 5;
  const laLta = (r) => r[3] === SRC && r[0] !== LOP_CHU && !dongRmu.has(r) && !dongGiao.has(r);
  const dsLta = s.b.filter(laLta);
  const khac = s.b.filter((r) => r[0] !== LOP_CHU && !dongRmu.has(r));
  const doan = (r) => {
    const o = [];
    for (let k = 4; k + 3 < r.length; k += 2) o.push([r[k], r[k + 1], r[k + 2], r[k + 3]]);
    return o;
  };
  const nhay = new Map(); // dòng -> [[chỉ số đoạn, khoảng cách từ đầu đoạn]]
  let dem = 0;
  for (const a of dsLta) {
    doan(a).forEach(([x1, y1, x2, y2], i) => {
      const L = Math.hypot(x2 - x1, y2 - y1);
      if (L < 2 * R + 1) return;
      const ngang = Math.abs(y2 - y1) < Math.abs(x2 - x1);
      for (const b of khac) {
        if (b === a) continue;
        for (const [x3, y3, x4, y4] of doan(b)) {
          const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
          if (Math.abs(den) < 1e-9) continue;
          const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
          const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;
          const Lb = Math.hypot(x4 - x3, y4 - y3);
          // phải cắt ngang giữa cả hai đoạn (chạm đầu đoạn là chỗ đấu nối chữ T)
          if (t * L < R + 0.5 || (1 - t) * L < R + 0.5 || u * Lb < 0.5 || (1 - u) * Lb < 0.5) continue;
          // hai đường trung áp cắt nhau: chỉ tuyến ngang nhảy
          if (laLta(b) && !ngang) continue;
          // chỗ giao gần nhau (cắt ngang một bó dây song song) gộp thành một vòng nhảy rộng
          const ds = nhay.get(a) ?? [];
          const g = ds.find(([j, d0, d1]) => j === i && t * L > d0 - (2 * R + 1) && t * L < d1 + (2 * R + 1));
          if (g) {
            g[1] = Math.min(g[1], t * L);
            g[2] = Math.max(g[2], t * L);
          } else ds.push([i, t * L, t * L]);
          nhay.set(a, ds);
        }
      }
    });
  }
  // Tách tuyến tại từng chỗ nhảy: vòng nhảy thành một nét riêng, đánh dấu vào
  // s.nhay để khi đọc dữ liệu mang cờ khongNoiGiua (chỉ đấu ở hai đầu) - đỉnh vòng
  // nhảy nằm sát đường dây kia không bị coi là điểm đấu chữ T.
  for (const [a, ds] of nhay) {
    const manh = [[]];
    const vong = [];
    doan(a).forEach(([x1, y1, x2, y2], i) => {
      if (i === 0) manh[0].push(x1, y1);
      const L = Math.hypot(x2 - x1, y2 - y1);
      const dx = (x2 - x1) / L;
      const dy = (y2 - y1) / L;
      // phía nhảy: tuyến ngang lên trên, tuyến dọc sang trái
      let [nx, ny] = [-dy, dx];
      if (Math.abs(dy) < Math.abs(dx) ? ny < 0 : nx > 0) [nx, ny] = [-nx, -ny];
      // gộp tiếp các nhóm chồng nhau
      const nhom = [];
      for (const [, d0, d1] of ds.filter(([j]) => j === i).sort((u, v) => u[1] - v[1])) {
        const cuoi = nhom.at(-1);
        if (cuoi && d0 < cuoi[1] + 2 * R + 1) cuoi[1] = Math.max(cuoi[1], d1);
        else nhom.push([d0, d1]);
      }
      for (const [d0, d1] of nhom) {
        const d = (d0 + d1) / 2;
        const h = (d1 - d0) / 2 + R; // nửa bề rộng vòng nhảy dọc tuyến
        const cx = x1 + dx * d;
        const cy = y1 + dy * d;
        const cung = [];
        for (let k = 0; k <= 8; k++) {
          const f = (Math.PI * k) / 8;
          cung.push(cx - dx * h * Math.cos(f) + nx * R * Math.sin(f), cy - dy * h * Math.cos(f) + ny * R * Math.sin(f));
        }
        manh.at(-1).push(cung[0], cung[1]);
        vong.push(cung);
        manh.push([cung.at(-2), cung.at(-1)]);
        dem++;
      }
      manh.at(-1).push(x2, y2);
    });
    const dau = a.slice(0, 4);
    const tron = (pts) => pts.map((v) => +v.toFixed(3));
    const moi = [...manh.map((m) => [...dau, ...tron(m)]), ...vong.map((c) => [...dau, ...tron(c)])];
    for (const r of vong.map((c) => tron(c))) s.nhay.push([r[0], r[1]]);
    s.b.splice(s.b.indexOf(a), 1, ...moi);
  }
  console.log(`  giao chéo: ${dem} chỗ vẽ vòng nhảy`);
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

/* ============================================================================
 * LỘ LẤY TỪ HÌNH HỌC BẢN VẼ PDF
 * tools/luoi-trung-ap/pdf/<số>.json: đường trục + nhánh liên kết đã dò trên bản vẽ lộ
 * (tools/pdf-lo/xuat.py). tools/luoi-trung-ap/pdf/dat.mjs: đặt từng bản vẽ lên tờ tổng
 * (điểm gốc, tỷ lệ) và đường nối từ đầu ra ngăn lộ trong trạm tới đầu lộ trên bản vẽ.
 * Giữ nguyên bố cục của bản vẽ gốc (người vẽ đã xếp chữ không chồng nhau), chỉ bỏ TBA
 * phân phối và nhánh không liên kết.
 * ========================================================================== */
const SC_PDF = { DCL: 7, LBS: 3.4, REC: 3.2 };
const HOP_BAN_VE = []; // hộp bao các bản vẽ đã đặt (đường cáp tự động tránh đi qua)
const VI_TRI_PDF = new Map(); // tên file JSON -> hàm đổi điểm PDF sang toạ độ tờ tổng

/**
 * Dây nối giữa hai bản vẽ (chỗ liên thông mà mỗi bản vẽ chỉ vẽ một phía): đi từ đầu dây của
 * bản vẽ này qua các điểm gấp khúc tới đầu dây của bản vẽ kia.
 *   { tu: ['20.json', [x, y]], den: ['18.json', [x, y]] | [X, Y], qua: [[X, Y], ...], cap, kv }
 */
function veNoiGiuaBanVe(ds, { hoan } = {}) {
  const conLai = [];
  for (const l of ds) {
    const diem = (d) => (typeof d[0] === 'string' ? VI_TRI_PDF.get(d[0])?.(d[1]) : d);
    const a = diem(l.tu), b = diem(l.den);
    if (!a || !b) {
      if (hoan) conLai.push(l); // bản vẽ bên kia chưa đặt: để vẽ sau
      else console.log(`  ! nối giữa bản vẽ: thiếu ${JSON.stringify(l.tu)} / ${JSON.stringify(l.den)}`);
      continue;
    }
    kv = l.kv ?? 22;
    lop = data.layers.indexOf(`${kv}kV`);
    if (l.tu_dong) {
      // tìm đường tự động (ra: hướng đi ra ở đầu 'tu', vao: hướng đi vào đầu 'den'). Có 'vao' thì tìm
      // đường tới điểm lùi ra 16 đơn vị rồi đi thẳng vào: đầu dây sát nét khác của bản vẽ (vd chân
      // ngăn tủ sát trục) thì vùng tự do quanh đích không cho cáp men theo nét đó
      const LUI = { len: [0, -16], xuong: [0, 16], phai: [-16, 0], trai: [16, 0] }[l.vao];
      const b1 = LUI ? [b[0] + LUI[0], b[1] + LUI[1]] : b;
      const diem = [a, ...(l.qua ?? []), b1];
      let duong = [a];
      for (let m = 0; m + 1 < diem.length && duong; m++) {
        const p = diem[m], q = diem[m + 1], le = l.le ?? 500;
        const hop = [Math.min(p[0], q[0]) - le, Math.min(p[1], q[1]) - le, Math.max(p[0], q[0]) + le, Math.max(p[1], q[1]) + le];
        const r = timDuong(luoiChiem(s, data, hop, { vungPhat: HOP_BAN_VE }), p, q, { ra: m === 0 ? l.ra : null, vao: m === diem.length - 2 ? l.vao : null });
        if (!r) { console.log(`  ! nối giữa bản vẽ: không tìm được đường ${JSON.stringify(p)} -> ${JSON.stringify(q)}`); duong = null; break; }
        duong.push(...r.slice(1));
      }
      if (duong && LUI) duong.push(b);
      if (duong) net(duong, !!l.cap);
      continue;
    }
    net([a, ...(l.qua ?? []), b], !!l.cap);
  }
  return conLai;
}

const docBanVe = (json) => JSON.parse(readFileSync(resolve('tools/luoi-trung-ap/pdf', json), 'utf8'));
/** Hộp bao bản vẽ (điểm chuỗi, nhãn thiết bị, khung tủ) theo toạ độ PDF. */
function hopBanVe(J) {
  const hopPdf = [Infinity, Infinity, -Infinity, -Infinity];
  const up = (x, y) => {
    hopPdf[0] = Math.min(hopPdf[0], x); hopPdf[1] = Math.min(hopPdf[1], y);
    hopPdf[2] = Math.max(hopPdf[2], x); hopPdf[3] = Math.max(hopPdf[3], y);
  };
  for (const lo of J.lo) for (const c of lo.chuoi) {
    for (const p of c.pts) up(...p);
    for (const t of c.tb ?? []) for (const n of t.nhan) { up(n.x0, n.y0); up(n.x1, n.y1); }
  }
  for (const r of J.rmu ?? []) { up(r.khung[0], r.khung[1]); up(r.khung[2], r.khung[3]); }
  return hopPdf;
}
/** Nguồn nét không tính là chỗ bận khi tìm chỗ đặt bản vẽ: đường dây 110kV liên trạm. */
const BO_QUA_CHO = new Set(['Kết lưới 110kV'].map((t) => data.srcLayers.indexOf(t)).filter((i) => i >= 0));
// lề quanh mỗi bản vẽ khi quy hoạch chỗ đặt: hai bản vẽ cách nhau ít nhất 2 lề, cách hình trạm 1 lề -
// chừa hành lang cho cáp, sơ đồ không dày đặc (chỉnh bằng biến môi trường LE_BAN_VE)
const LE_BAN_VE = Number(process.env.LE_BAN_VE ?? 150);
/** Tâm lý tưởng (toạ độ tờ tổng) của các bản vẽ đặt tự động. */
const TAM_TU_DONG = new Map();

/**
 * ĐẶT BẢN VẼ SAO CHO HAI TRẠM LIÊN KẾT THEO ĐƯỜNG NGẮN NHẤT.
 *
 * Mỗi chỗ nối của bản vẽ (đầu lộ <- ngăn lộ trong trạm; đầu dây liên thông <-> bản vẽ khác) cho
 * một vị trí tâm "lý tưởng": tâm đặt sao cho điểm nối trên bản vẽ trùng điểm nối bên kia. Tâm bản
 * vẽ = trung bình có trọng số các vị trí đó (ngăn lộ trọng số 2, liên thông 1), lặp vài vòng vì
 * vị trí bản vẽ bên kia cũng đang tìm. Bản vẽ nằm giữa các trạm nó nối tới; chỗ đặt thật là
 * khoảng trống gần tâm đó nhất (timCho), cáp đi đường ngắn nhất (timDuong).
 */
function tinhTamTuDong(ds) {
  const tt = new Map();
  for (const d of ds) {
    const J = docBanVe(d.json);
    const h = hopBanVe(J);
    const k = d.ti_le ?? 1;
    tt.set(d.json, { d, J, k, h, c: [(h[0] + h[2]) / 2, (h[1] + h[3]) / 2] });
  }
  const lech = (json, p) => { const t = tt.get(json); return [(p[0] - t.c[0]) * t.k, -(p[1] - t.c[1]) * t.k]; };
  // khung trạm chứa đầu ra ngăn lộ (nới 120 đơn vị)
  const truCua = (A) => {
    const r = s.st.find((q) => q.length >= 8 && A[0] >= q[4] - 120 && A[0] <= q[6] + 120 && A[1] >= q[5] - 120 && A[1] <= q[7] + 120);
    return r ? [r[4], r[5], r[6], r[7]] : undefined;
  };
  const lien = ds.flatMap((d) => d.noi_ban_ve ?? []);
  const bai = [];
  for (const d of ds) {
    if (d.goc !== 'tu_dong') continue;
    const t = tt.get(d.json);
    const noi = [];
    for (const lo of t.J.lo) {
      const n = d.noi?.[lo.ten];
      if (!n) continue;
      const A = Array.isArray(n) ? n[0] : n.tu;
      noi.push({ o: lech(d.json, lo.chuoi[0]?.pts[0] ?? lo.nguon), A, tru: truCua(A), ra: Array.isArray(n) ? 'xuong' : n.ra ?? 'xuong', w: 2 });
    }
    for (const l of lien) {
      for (const [a, b] of [[l.tu, l.den], [l.den, l.tu]]) {
        if (typeof a[0] !== 'string' || a[0] !== d.json) continue;
        if (typeof b[0] === 'string') {
          const tb = tt.get(b[0]);
          if (!tb) continue;
          if (tb.d.goc === 'tu_dong') noi.push({ o: lech(d.json, a[1]), ref: b[0], oRef: lech(b[0], b[1]), w: 1 });
          else {
            const [gx, gy] = tb.d.goc_pdf;
            noi.push({ o: lech(d.json, a[1]), A: [tb.d.goc[0] + tb.k * (b[1][0] - gx), tb.d.goc[1] - tb.k * (b[1][1] - gy)], w: 1 });
          }
        } else noi.push({ o: lech(d.json, a[1]), A: b, w: 1 });
      }
    }
    bai.push({ id: d.json, w: (t.h[2] - t.h[0]) * t.k, h: (t.h[3] - t.h[1]) * t.k, noi });
  }
  const tam = quyHoachCho(s, data, bai, { le: LE_BAN_VE, boQua: BO_QUA_CHO });
  for (const [json, c] of tam) TAM_TU_DONG.set(json, c);
  // đặt đúng chỗ đã quy hoạch (tâm -> góc trái trên của hộp bản vẽ)
  for (const d of ds) {
    const c = tam.get(d.json);
    if (!c) continue;
    const t = tt.get(d.json);
    d.goc_pdf = [+t.h[0].toFixed(1), +t.h[1].toFixed(1)];
    d.goc = [+(c[0] - ((t.h[2] - t.h[0]) * t.k) / 2).toFixed(1), +(c[1] + ((t.h[3] - t.h[1]) * t.k) / 2).toFixed(1)];
    console.log(`  đặt ${d.json}: tâm [${c.map(Math.round)}] (${((t.h[2] - t.h[0]) * t.k).toFixed(0)} x ${((t.h[3] - t.h[1]) * t.k).toFixed(0)})`);
  }
}

function vePdf(dat) {
  const J = docBanVe(dat.json);
  const k = dat.ti_le ?? 1;
  // hộp bao bản vẽ (điểm chuỗi, nhãn thiết bị, khung tủ) theo toạ độ PDF
  const hopPdf = hopBanVe(J);
  // goc: 'tu_dong' -> tìm khoảng trống gần tâm lý tưởng (dat.gan hoặc tính từ các chỗ nối - xem
  // tinhTamTuDong); tuyến 110kV liên trạm không tính là chỗ bận (chạy lại noi-duong-day-110 sau)
  if (dat.goc === 'tu_dong') {
    const w = (hopPdf[2] - hopPdf[0]) * k, h = (hopPdf[3] - hopPdf[1]) * k;
    const c = timCho(s, data, w, h, dat.gan ?? TAM_TU_DONG.get(dat.json), { le: dat.le ?? 40, boQua: BO_QUA_CHO });
    if (!c) throw new Error(`Không tìm được chỗ cho bản vẽ ${dat.json}`);
    dat.goc_pdf = [+hopPdf[0].toFixed(1), +hopPdf[1].toFixed(1)];
    dat.goc = [Math.round(c[0]), Math.round(c[1])];
    const t0 = dat.gan ?? TAM_TU_DONG.get(dat.json);
    if (t0) console.log(`  tâm lý tưởng ${dat.json}: [${t0.map(Math.round)}], đặt tại [${Math.round(c[0] + w / 2)},${Math.round(c[1] - h / 2)}]`);
    console.log(`  đặt ${dat.json}: goc_pdf ${JSON.stringify(dat.goc_pdf)}, goc ${JSON.stringify(dat.goc)} (${w.toFixed(0)} x ${h.toFixed(0)})`);
  }
  const [gx, gy] = dat.goc_pdf;
  const [X0, Y0] = dat.goc;
  const W = ([x, y]) => [X0 + k * (x - gx), Y0 - k * (y - gy)];
  const bo = new Set(dat.bo_tb ?? []); // tên thiết bị bỏ (nhãn bắt nhầm)
  const choNoi = [];
  // chữ theo khung chữ trên bản vẽ
  // nửa khoảng hở dây ở thiết bị (đơn vị tờ tổng): tới cực xa nhất (kể cả cực khi CẮT) và
  // không nhỏ hơn 1,2 lần sai số bắt điểm của mô hình công suất (~3) - hai đầu dây gần nhau
  // hơn sai số sẽ bị coi là nối liền, dao cắt cũng không hở mạch
  /** Khoảng cách tâm - cực của ký hiệu (đơn vị block). */
  const rCuc = (loai) => {
    const def = getBlock(KY_HIEU[loai] ?? loai);
    return Math.max(...[...(def?.cuc ?? []), ...(def?.cucMo ?? [])].map((c) => Math.hypot(c[0], c[1])), 0.5);
  };
  // Khe cắt dây ở thiết bị đóng cắt tối thiểu 3,7 đơn vị mỗi phía (lớn hơn sai số bắt điểm của
  // mô hình công suất, để hai đầu dây không tự nối tắt qua dao). Ký hiệu được phóng cho cực chạm
  // đúng đầu dây - không còn khe hở nhìn thấy giữa dây và ký hiệu.
  const scTb = (loai) => Math.max(SC_PDF[loai] * k, 3.7 / rCuc(loai));
  const nuaPdf = (loai) => rCuc(loai) * scTb(loai);
  const chuPdf = (n, canh = 'trai') => {
    const h = Math.max(n.h, 2.5) * k * 0.92; // chữ quá nhỏ trên PDF nâng lên cho đều
    if (n.doc) {
      const [x, y] = W([n.x1 - n.h * 0.18, n.y1]);
      chu(x, y, h, n.t, 'trai', 90);
    } else {
      const [x, y] = W([n.x0, n.y1 - n.h * 0.18]);
      chu(x, y, h, n.t, canh);
    }
  };
  // Nắn thẳng: đường dò bắc qua tâm ký hiệu nên dây gần ngang / gần dọc hay lệch 1-2pt.
  // Mỗi quãng dài >= 8pt mà các đỉnh lệch nhau <= 2pt (độ dốc tổng <= 10%) được đặt đúng
  // ngang / dọc. Ghi theo toạ độ gốc của đỉnh để đỉnh chung giữa các chuỗi (điểm rẽ,
  // chân tủ) nắn giống nhau.
  {
    const khoa = (p) => `${p[0]}|${p[1]}`;
    const nanX = new Map(), nanY = new Map();
    const quet = (P, tr) => {
      // tr = 1: quãng ngang (nắn y); tr = 0: quãng dọc (nắn x)
      const doc = 1 - tr;
      let s0 = 0;
      while (s0 < P.length - 1) {
        let e = s0;
        let lo = P[s0][tr], hi = P[s0][tr];
        while (e + 1 < P.length) {
          const v = P[e + 1][tr];
          if (Math.max(hi, v) - Math.min(lo, v) > 2) break;
          lo = Math.min(lo, v); hi = Math.max(hi, v); e++;
        }
        const dai = Math.abs(P[e][doc] - P[s0][doc]);
        if (e > s0 && dai >= 8 && Math.abs(P[e][tr] - P[s0][tr]) <= 0.1 * dai) {
          // giá trị nắn: trung bình theo chiều dài các đoạn con
          let tong = 0, w = 0;
          for (let m = s0; m < e; m++) {
            const l = Math.abs(P[m + 1][doc] - P[m][doc]);
            tong += ((P[m][tr] + P[m + 1][tr]) / 2) * l; w += l;
          }
          const g = w ? tong / w : P[s0][tr];
          for (let m = s0; m <= e; m++) (tr ? nanY : nanX).set(khoa(P[m]), g);
          s0 = e;
        } else s0++;
      }
    };
    const tatCa = J.lo.flatMap((lo) => lo.chuoi.map((c) => c.pts));
    for (const P of tatCa) { quet(P, 1); quet(P, 0); }
    const doi = (p) => { const kk = khoa(p); return [nanX.get(kk) ?? p[0], nanY.get(kk) ?? p[1]]; };
    // toạ độ trên tờ tổng của một điểm PDF (sau khi nắn thẳng) - để nối dây giữa các bản vẽ
    VI_TRI_PDF.set(dat.json, (p) => W(doi(p)));
    for (const lo of J.lo) for (const c of lo.chuoi) {
      c.pts = c.pts.map(doi);
      for (const t of c.tb ?? []) t.p = doi(t.p);
    }
  }
  // đầu mút các chuỗi (điểm rẽ nhánh / điểm cuối) - cột tại đó mới ghi số
  const dauMut = [];
  for (const lo of J.lo) for (const c of lo.chuoi) dauMut.push(c.pts[0], c.pts.at(-1));
  const laDauMut = (p) => dauMut.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 2.2);
  const daVeTb = [];
  // tủ RMU: bỏ nét trong khung tủ (đường dò đi qua khung, thanh cái của bản vẽ)
  const boQua = new Map(); // "i,j" -> [[k0,k1]]
  // bỏ nét từ chân ngăn tới tâm tủ (đỉnh ảo): khoảng (a, b) chứa đỉnh tâm, a/b là chân ngăn
  for (const r of J.rmu ?? []) {
    for (const c of r.cua) {
      if (c.ngoai) continue; // ngăn thường cắt nối cáp từ ngoài tới: không có nét tới tâm tủ
      const key = c.ij.join(',');
      if (!boQua.has(key)) boQua.set(key, []);
      const ds = boQua.get(key);
      const iv = c.k < c.kc ? [c.k, c.kc + 1] : [c.kc - 1, c.k];
      // tủ nằm giữa chuỗi: hai chân cho cùng khoảng (kc-1, kc+1)
      if (!ds.some(([a, b]) => a === iv[0] && b === iv[1])) ds.push(iv);
    }
  }
  J.lo.forEach((lo, i) => {
    kv = lo.kv ?? 22;
    lop = data.layers.indexOf(`${kv}kV`);
    const noi = dat.noi?.[lo.ten];
    // đường nối từ đầu ra ngăn lộ trong trạm tới đầu lộ trên bản vẽ
    const dauLo = VI_TRI_PDF.get(dat.json)(lo.chuoi[0]?.pts[0] ?? lo.nguon);
    if (Array.isArray(noi)) net([...noi.map((p) => p), dauLo], !!dat.cap_noi?.[lo.ten]);
    // { tu: đầu ra ngăn lộ, ra, vao, qua? }: tìm đường tự động sau khi vẽ xong bản vẽ
    else if (noi) choNoi.push({ noi, dauLo, cap: !!dat.cap_noi?.[lo.ten], ten: lo.ten, kv, lop });
    if (noi) CUA_RA.push(hopCuaRa(noi));
    lo.chuoi.forEach((c, j) => {
      const P = c.pts;
      const bq = boQua.get(`${i},${j}`) ?? [];
      const trongTu = (m) => bq.some(([a, b]) => m > a && m < b);
      // chiều dài cộng dồn
      const acc = [0];
      for (let m = 1; m < P.length; m++) acc.push(acc[m - 1] + Math.hypot(P[m][0] - P[m - 1][0], P[m][1] - P[m - 1][1]));
      const L = acc.at(-1);
      // khoảng cắt dây ở thiết bị đóng cắt: dây chỉ nối vào hai cực, thiết bị cắt thì hở mạch
      const cat = [];
      for (const t of c.tb ?? []) {
        if (bo.has(t.ten[0])) continue;
        const nua = nuaPdf(t.loai);
        cat.push([t.s - (nua / k) * 1.35, t.s + (nua / k) * 1.35, t, nua]);
      }
      // hai thiết bị sát nhau: khoảng cắt chồng lên nhau -> chia đôi tại điểm giữa hai tâm
      // (a0, b0 giữ khoảng đối xứng để đặt tâm thiết bị)
      cat.sort((u, v) => u[2].s - v[2].s);
      for (const c of cat) c.push(c[0], c[1]);
      for (let m = 1; m < cat.length; m++) {
        if (cat[m - 1][1] > cat[m][0]) {
          const g = (cat[m - 1][2].s + cat[m][2].s) / 2;
          cat[m - 1][1] = g;
          cat[m][0] = g;
        }
      }
      // nét đứt (cáp): đoạn ngắn liền nhau; tách chuỗi thành các quãng cùng loại
      const cap = [];
      for (let m = 1; m < P.length; m++) cap.push(acc[m] - acc[m - 1] < 1.8);
      // làm mịn: quãng cáp phải dài từ 6pt, khe giữa các nét đứt tính là cáp
      const laCap = (m) => {
        let a = m, b = m;
        while (a > 0 && (cap[a - 1] || acc[a] - acc[a - 1] < 2.6)) a--;
        while (b < cap.length - 1 && (cap[b + 1] || acc[b + 2] - acc[b + 1] < 2.6)) b++;
        return acc[b + 1] - acc[a] >= 6 && cap.slice(a, b + 1).filter(Boolean).length >= 3;
      };
      const loai = cap.map((_, m) => laCap(m));
      // điểm tại chiều dài s
      const tai = (sv) => {
        let m = 1;
        while (m < P.length - 1 && acc[m] < sv) m++;
        const t = (sv - acc[m - 1]) / Math.max(1e-9, acc[m] - acc[m - 1]);
        return [P[m - 1][0] + t * (P[m][0] - P[m - 1][0]), P[m - 1][1] + t * (P[m][1] - P[m - 1][1])];
      };
      // đầu dây bị cắt ở thiết bị [a, b]: lấy trên đường thẳng nối hai đỉnh ngoài khoảng cắt
      // (bỏ đỉnh gãy ở tâm ký hiệu do đường dò bắc qua khe ký hiệu -> dây thẳng vào cực)
      const taiCat = (sv, a, b) => {
        let i = 0, j = P.length - 1;
        while (i + 1 < P.length && acc[i + 1] <= a + 1e-6) i++;
        while (j - 1 >= 0 && acc[j - 1] >= b - 1e-6) j--;
        if (j <= i) return tai(sv);
        // chỉ nắn thẳng khi các đỉnh giữa lệch ít (đỉnh gãy ở tâm ký hiệu); chỗ rẽ góc thì giữ
        const [dx, dy] = [P[j][0] - P[i][0], P[j][1] - P[i][1]];
        const dd = Math.hypot(dx, dy) || 1;
        for (let m = i + 1; m < j; m++) if (Math.abs((P[m][0] - P[i][0]) * dy - (P[m][1] - P[i][1]) * dx) / dd > 2) return tai(sv);
        const t = (Math.min(L, Math.max(0, sv)) - acc[i]) / Math.max(1e-9, acc[j] - acc[i]);
        return [P[i][0] + t * (P[j][0] - P[i][0]), P[i][1] + t * (P[j][1] - P[i][1])];
      };
      // vẽ theo quãng: cắt ở thiết bị, đổi loại dây
      let cur = [];
      let curCap = null;
      const xong = () => {
        if (cur.length >= 2) {
          // bỏ đỉnh thẳng hàng
          const g = [cur[0]];
          for (let m = 1; m < cur.length - 1; m++) {
            const a = g.at(-1), b = cur[m], cc = cur[m + 1];
            const cr = (b[0] - a[0]) * (cc[1] - a[1]) - (b[1] - a[1]) * (cc[0] - a[0]);
            if (Math.abs(cr) > 0.02 * Math.hypot(cc[0] - a[0], cc[1] - a[1])) g.push(b);
          }
          g.push(cur.at(-1));
          if (g.some((q) => Math.hypot(q[0] - g[0][0], q[1] - g[0][1]) > 1e-6)) net(g.map(W), curCap);
        }
        cur = [];
      };
      const trongCat = (sv) => cat.some(([a, b]) => sv > a + 1e-6 && sv < b - 1e-6);
      // hướng chuỗi quanh chiều dài sv (lấy ±6pt, không theo cạnh hộp ký hiệu)
      const huongTai = (sv) => {
        const a = tai(Math.max(0, sv - 6)), b = tai(Math.min(L, sv + 6));
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
      };
      for (let m = 0; m < P.length; m++) {
        if (m > 0) {
          const c1 = loai[m - 1];
          if (curCap !== null && c1 !== curCap) {
            const q = cur.at(-1);
            xong();
            cur = q ? [q] : [];
          }
          curCap = c1;
          // các điểm cắt nằm trong đoạn này - xử lý theo thứ tự dọc chuỗi
          const sk = [];
          for (const [a, b, , , a0, b0] of cat) {
            if (a > acc[m - 1] && a < acc[m]) sk.push([a, 0, a0, b0]);
            if (b > acc[m - 1] && b < acc[m]) sk.push([b, 1, a0, b0]);
          }
          sk.sort((u, v) => u[0] - v[0] || v[1] - u[1]);
          for (const [sv, loai, a0, b0] of sk) {
            if (loai === 0) { cur.push(taiCat(sv, a0, b0)); xong(); }
            else cur = [taiCat(sv, a0, b0)];
          }
        }
        if (trongTu(m)) { xong(); continue; }
        if (bq.some(([a]) => a === m - 1) && m > 0 && trongTu(m - 1) === false && bq.some(([a, b]) => m - 1 === a && b > a)) {
          // vừa ra khỏi điểm vào tủ: ngắt nét
        }
        if (!trongCat(acc[m])) cur.push(P[m]);
        if (bq.some(([a]) => a === m)) xong();
      }
      xong();
      // vị trí + hướng đặt thiết bị (trên tờ tổng): nằm giữa hai đầu dây bị cắt, thẳng hàng
      // với dây (tâm ký hiệu trên PDF thường lệch khỏi dây một chút -> dây gãy chéo)
      const datTb = new Map();
      for (const [a, b, t, nua, a0, b0] of cat) {
        const pa = W(taiCat(a0, a0, b0)), pb = W(taiCat(b0, a0, b0));
        let c, u;
        const d = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
        if (a >= 0 && b <= L && d > 1e-6) {
          c = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
          u = [(pb[0] - pa[0]) / d, (pb[1] - pa[1]) / d];
        } else {
          const [hx, hy] = huongTai(t.s);
          c = W(t.p);
          u = [hx, -hy];
        }
        // gần ngang / gần dọc thì đặt đúng ngang / dọc
        if (Math.abs(u[1]) < 0.09) u = [Math.sign(u[0]) || 1, 0];
        else if (Math.abs(u[0]) < 0.09) u = [0, Math.sign(u[1])];
        datTb.set(t, { c, u });
        // dây từ đầu cắt (có thể đã rút về điểm giữa hai thiết bị sát nhau) tới cực
        net([W(taiCat(a, a0, b0)), [c[0] - u[0] * nua, c[1] - u[1] * nua]], curCap);
        net([[c[0] + u[0] * nua, c[1] + u[1] * nua], W(taiCat(b, a0, b0))], curCap);
      }
      // thiết bị
      for (const t of c.tb ?? []) {
        if (bo.has(t.ten[0])) continue;
        if (daVeTb.some((q) => Math.hypot(q[0] - t.p[0], q[1] - t.p[1]) < 1.5)) continue;
        daVeTb.push(t.p);
        const vt = datTb.get(t);
        const [x, y] = vt ? vt.c : W(t.p);
        const [hx, hy] = vt ? [vt.u[0], -vt.u[1]] : huongTai(t.s);
        const goc = (Math.atan2(-hy, hx) * 180) / Math.PI;
        thietBi(t.loai, x, y, gocDat(t.loai, goc), !!t.mo, scTb(t.loai));
        for (const n of t.nhan) chuPdf(n);
      }
      // loại dây: chỉ nhãn nằm dọc theo chuỗi
      for (const d of c.day ?? []) {
        const [a] = [tai(Math.min(L, Math.max(0, d.s)))];
        // hướng chuỗi tại đó
        const b = tai(Math.min(L, d.s + 1));
        const doc = Math.abs(b[1] - a[1]) > Math.abs(b[0] - a[0]);
        if (doc !== !!d.nhan.doc) continue;
        chuPdf({ ...d.nhan, t: d.ten });
      }
      // cột tại điểm rẽ / đầu cuối
      for (const cc of c.cot ?? []) {
        if (!laDauMut(cc.p)) continue;
        const [x, y] = W(cc.p);
        cham(x, y);
        chuPdf({ ...cc.nhan, t: cc.ten, doc: false });
      }
    });
  });
  // vẽ tủ RMU theo mẫu: khung, tên tủ, 2 ngăn (vào, ra), thanh cái, DCL, tiếp địa -76
  for (const r of J.rmu ?? []) {
    const lo = J.lo[r.cua[0].ij[0]];
    kv = lo.kv ?? 22;
    lop = data.layers.indexOf(`${kv}kV`);
    const T = r.tieude;
    const tenGan = (x) => (r.ngan.length ? r.ngan.reduce((a, b) => (Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a)) : null);
    // chân các ngăn có dây nối ra (không trùng nhau), xếp trái -> phải
    const chan = [];
    for (const c of r.cua) {
      const q = J.lo[c.ij[0]].chuoi[c.ij[1]].pts[c.k];
      if (!chan.some((p) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.5)) chan.push(q);
    }
    chan.sort((p, q) => p[0] - q[0]);
    // cột ngăn: theo x chân ngăn, giãn cho cách nhau >= 10pt
    const cot = chan.map((p) => p[0]);
    for (let m = 1; m < cot.length; m++) if (cot[m] - cot[m - 1] < 10) cot[m] = cot[m - 1] + 10;
    // bề rộng chữ tiêu đề khi hiển thị (font trên tờ tổng rộng hơn font bản vẽ PDF ~0,5 em/ký tự)
    const rongTen = (T.t ?? r.ten).length * Math.max(T.h, 2.5) * 0.92 * 0.5;
    const trai = Math.min(cot[0] - 6, T.x0 - 2), phai = Math.max(cot.at(-1) + 6, T.x1 + 2, T.x0 + rongTen + 2);
    const day = Math.max(...chan.map((p) => p[1]));
    const dinh = T.y0 - 1.5;
    const yTen = T.y1 + 1;           // hàng tên ngăn
    const yTc = T.y1 + 9;            // thanh cái trong tủ
    trongRmu = true;
    // khung khép kín một nét: mô hình công suất nhận là khung tủ, bỏ khỏi lưới dây dẫn (cạnh
    // đáy đi qua chân các ngăn - nếu coi là dây thì nối tắt các ngăn, kể cả ngăn thường cắt)
    net([[trai, dinh], [phai, dinh], [phai, day], [trai, day], [trai, dinh]].map(W), false);
    net([[trai, yTen], [phai, yTen]].map(W), false);
    net([[cot[0], yTc], [cot.at(-1), yTc]].map(W), false);
    chan.forEach(([x0, y0], m) => {
      const xc = cot[m];
      const n = tenGan(x0);
      const yd = (yTc + day) / 2 - 2;
      const nd = nuaPdf('DCL') / k;
      net([[xc, yTc], [xc, yd - nd]].map(W), false);
      // chân cáp nằm ngay trên dây ngăn, phía trong khung: dây ngăn dừng ở chân cáp (không kéo
      // xuống đáy khung rồi quay ngược lên - đầu nhọn đó dễ chạm nhầm cáp chạy sát dưới tủ)
      if (Math.abs(x0 - xc) < 0.5 && y0 > yd + nd && y0 < day) net([[xc, yd + nd], [x0, y0]].map(W), false);
      else net([[xc, yd + nd], [xc, day], [x0, y0]].map(W), false);
      const [dx, dy] = W([xc, yd]);
      thietBi('DCL', dx, dy, gocDat('DCL', 90), !!n?.mo, scTb('DCL'));
      // dao tiếp địa: cực nối vào dây ngăn (bên phải), đầu nối đất quay ra ngoài (bên trái)
      const scD = 3.4 * k;
      // đầu dao (điểm xa nhất trên trục của ký hiệu) chạm đúng dây ngăn
      const dDTD = getBlock('DTD');
      const cucD = [0, Math.max(...(dDTD?.primsOpen ?? dDTD?.prims ?? []).flatMap((q) => (q.t === 'line' ? [q.pts[1], q.pts[3]] : [])), 0.3)];
      const [ex, ey] = W([xc, day - 4]);
      thietBi('DTD', ex - cucD[1] * scD, ey + cucD[0] * scD, 270, true, scD);
      const [lx, ly] = W([xc - 5.5, day - 1]);
      chu(lx, ly, 1.8 * k, '-76', 'giua');
      trongRmu = false;
      if (n) {
        const [x, y] = W([xc, yTen + 3.2]);
        chu(x, y, 1.9 * k, n.t, 'giua');
        if (n.mo) {
          const [x2, y2] = W([xc, yTen + 5.6]);
          chu(x2, y2, 1.6 * k, '(Thường cắt)', 'giua');
        }
      }
      trongRmu = true;
    });
    trongRmu = false;
    chuPdf({ t: T.t ?? r.ten, x0: T.x0, y0: T.y0, x1: T.x1, y1: T.y1, h: T.h, doc: false });
  }
  // ranh giới quản lý
  for (const r of J.ranh ?? []) {
    kv = 22;
    const [x, y] = W(r.p);
    const nx = -r.h[1], ny = -r.h[0]; // pháp tuyến (đổi chiều trục y)
    const L = 10 * k;
    s.b.push([LOP_CHU, kv, KIEU.cap, SRC, +(x - nx * L).toFixed(3), +(y - ny * L).toFixed(3), +(x + nx * L).toFixed(3), +(y + ny * L).toFixed(3)]);
    for (const n of r.nhan) chuPdf(n);
  }
  // giao chéo với đường dây khác cấp điện áp (không đấu nối): khúc đường dây kia cắt ngang tuyến
  // tại điểm p (toạ độ PDF trên tuyến), vòng nhảy vẽ ở veGiaoCheo(); doc: tuyến dọc
  for (const g of dat.giao ?? []) {
    const [x, y] = W(g.p);
    const kvG = g.kv ?? 35, d = g.dai ?? 11;
    const r = g.doc
      ? [data.layers.indexOf(`${kvG}kV`), kvG, KIEU.dz, SRC, +(x - d).toFixed(3), +y.toFixed(3), +(x + d).toFixed(3), +y.toFixed(3)]
      : [data.layers.indexOf(`${kvG}kV`), kvG, KIEU.dz, SRC, +x.toFixed(3), +(y + d).toFixed(3), +x.toFixed(3), +(y - d).toFixed(3)];
    s.b.push(r);
    dongGiao.add(r);
    if (g.doc) chu(x + d + 2, y - H_COT / 2, H_COT, g.t, 'trai');
    else chu(x, y + d + 2, H_COT, g.t, 'giua');
  }
  // chữ thêm (ghi liên thông ở đầu dây cụt ...)
  for (const g of dat.chu ?? []) {
    const [x, y] = W(g.p);
    chu(x, y, (g.h ?? 3) * k, g.t, g.canh ?? 'trai', g.rot ?? 0);
  }
  // cáp nối ngăn lộ - đầu lộ tìm đường tự động: để sau khi đã vẽ xong mọi bản vẽ (các bản vẽ đặt
  // theo quy hoạch nên bản vẽ sau có thể nằm trên hướng đi của cáp bản vẽ trước)
  const hopNay = [X0 + k * (hopPdf[0] - gx), Y0 - k * (hopPdf[3] - gy), X0 + k * (hopPdf[2] - gx), Y0 - k * (hopPdf[1] - gy)];
  CAP_HOAN.push(() => { for (const c of choNoi) {
    const a = c.noi.tu;
    const qua = c.noi.qua ?? [];
    const diem = [a, ...qua, c.dauLo];
    let duong = [a];
    for (let m = 0; m + 1 < diem.length; m++) {
      const p = diem[m], q = diem[m + 1];
      // khung tìm đường quanh hai đầu; không thông thì nới rộng khung (cáp dài vòng qua các bản vẽ)
      let r = null;
      for (const [le, gioiHan] of [[c.noi.le ?? 500, 4e6], [2000, 1.5e7]]) {
        const hop = [Math.min(p[0], q[0]) - le, Math.min(p[1], q[1]) - le, Math.max(p[0], q[0]) + le, Math.max(p[1], q[1]) + le];
        const L = luoiChiem(s, data, hop, { vungPhat: HOP_BAN_VE.filter((v) => v !== hopNay), vungCam: CUA_RA.filter((v) => v.cua !== c.noi) });
        r = timDuong(L, p, q, { ra: m === 0 ? c.noi.ra : null, vao: m === diem.length - 2 ? c.noi.vao : null, tuDoDau: m === 0 ? c.noi.tu_do ?? 2 : 2, gioiHan });
        if (r) break;
      }
      if (!r) { console.log(`  ! ${c.ten}: không tìm được đường ${JSON.stringify(p)} -> ${JSON.stringify(q)}`); duong = null; break; }
      duong.push(...r.slice(1));
    }
    if (!duong) continue;
    kv = c.kv; lop = c.lop;
    net(duong, c.cap);
    console.log(`  cáp ${c.ten}: ${duong.length - 1} đoạn, dài ${duong.slice(1).reduce((t, q, i) => t + Math.hypot(q[0] - duong[i][0], q[1] - duong[i][1]), 0).toFixed(0)}`);
  } });
  HOP_BAN_VE.push(hopNay);
  console.log(`  bản vẽ ${dat.json}: ${J.lo.map((l) => l.ten).join(', ')}`);
}

const CAP_HOAN = []; // cáp ngăn lộ - đầu lộ, vẽ sau khi đặt xong mọi bản vẽ
// lối ra trước đầu các ngăn lộ (dài 24): cáp lộ khác không đi ngang qua - để trống cho cáp của ngăn đó
const CUA_RA = [];
const hopCuaRa = (noi) => {
  const { tu: [x, y], ra } = noi;
  const v = { xuong: [x - 2, y - 24, x + 2, y], len: [x - 2, y, x + 2, y + 24], trai: [x - 24, y - 2, x, y + 2], phai: [x, y - 2, x + 24, y + 2] }[ra ?? 'xuong'];
  v.cua = noi;
  return v;
};
const datPdf = resolve('tools/luoi-trung-ap/pdf/dat.mjs');
if (existsSync(datPdf)) {
  const ds = (await import(pathToFileURL(datPdf).href)).default;
  // toạ độ tờ tổng khai trong dat.mjs theo bản CAD gốc: đổi theo trạm đã dời (tools/vi-tri-tram.mjs)
  const D = (p) => doiDiem(p[0], p[1]);
  for (const d of ds) {
    for (const [ten, n] of Object.entries(d.noi ?? {})) {
      if (Array.isArray(n)) d.noi[ten] = n.map(D);
      else d.noi[ten] = { ...n, tu: D(n.tu), qua: n.qua?.map(D) };
    }
    for (const l of d.noi_ban_ve ?? []) {
      for (const k of ['tu', 'den']) if (typeof l[k][0] !== 'string') l[k] = D(l[k]);
      if (l.qua) l.qua = l.qua.map(D);
    }
  }
  const t0 = Date.now();
  tinhTamTuDong(ds);
  console.log(`  (quy hoạch chỗ đặt: ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  // dây liên thông khai tay (có 'qua') vẽ ngay sau bản vẽ của nó để các cáp tìm đường tự động
  // vẽ sau tránh được; dây tìm đường tự động vẽ cuối cùng
  const tuDong = [];
  let choTay = [];
  for (const d of ds) {
    vePdf(d);
    choTay = veNoiGiuaBanVe([...choTay, ...(d.noi_ban_ve ?? []).filter((l) => !l.tu_dong)], { hoan: true });
    tuDong.push(...(d.noi_ban_ve ?? []).filter((l) => l.tu_dong));
  }
  const t1 = Date.now();
  for (const f of CAP_HOAN) f();
  console.log(`  (cáp ngăn lộ: ${((Date.now() - t1) / 1000).toFixed(0)} s)`);
  const t2 = Date.now();
  veNoiGiuaBanVe([...choTay, ...tuDong]);
  console.log(`  (dây liên thông: ${((Date.now() - t2) / 1000).toFixed(0)} s)`);
  // vị trí các bản vẽ (để kiểm thử tra toạ độ theo điểm trên bản vẽ PDF)
  writeFileSync(
    resolve('tools/luoi-trung-ap/pdf/vi-tri.json'),
    JSON.stringify(Object.fromEntries(ds.map((d) => [d.json, { goc: d.goc, goc_pdf: d.goc_pdf, ti_le: d.ti_le ?? 1 }])), null, 1),
  );
}
veGiaoCheo();
writeFileSync(duongDan, JSON.stringify(data));
const dem = (k, i) => s[k].filter((r) => r[i] === SRC).length;
console.log(`Lưới trung áp: ${dsLo.length} lộ - ${dem('b', 3)} nét, ${dem('d', 8)} thiết bị, ${dem('t', 7)} chữ.`);
