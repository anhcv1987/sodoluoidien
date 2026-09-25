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
          const ds = nhay.get(a) ?? [];
          if (!ds.some(([j, d]) => j === i && Math.abs(d - t * L) < 2 * R + 1)) ds.push([i, t * L]);
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
      for (const [, d] of ds.filter(([j]) => j === i).sort((u, v) => u[1] - v[1])) {
        const cx = x1 + dx * d;
        const cy = y1 + dy * d;
        const cung = [];
        for (let k = 0; k <= 8; k++) {
          const f = (Math.PI * k) / 8;
          cung.push(cx - dx * R * Math.cos(f) + nx * R * Math.sin(f), cy - dy * R * Math.cos(f) + ny * R * Math.sin(f));
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
veGiaoCheo();
writeFileSync(duongDan, JSON.stringify(data));
const dem = (k, i) => s[k].filter((r) => r[i] === SRC).length;
console.log(`Lưới trung áp: ${dsLo.length} lộ - ${dem('b', 3)} nét, ${dem('d', 8)} thiết bị, ${dem('t', 7)} chữ.`);
