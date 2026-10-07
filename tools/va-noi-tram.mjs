/**
 * VÁ CÁC CHỖ BẢN VẼ TRẠM THIẾU ĐIỂM NỐI (TRA THEO TOẠ ĐỘ SAU doi-cho-tram.mjs).
 *
 *   node tools/va-noi-tram.mjs [src/data/tram-sld.json]
 *
 * Chạy chiều công suất (F6) chỉ đi theo các nét thực sự nối với nhau. Vài chỗ bản CAD
 * vẽ hụt / vắt qua mà không có điểm nối nên ngăn lộ bị cô lập; trước đây công suất vẫn
 * hiện ở đó chỉ vì nét ký hiệu TU, MCHB tạo vòng kín giữ lại nhánh cụt. Công cụ này:
 *   - keo : dời đầu mút một nét từ điểm `tu` tới điểm `den`;
 *   - net : thay nét có đúng dãy đỉnh `cu` bằng dãy đỉnh `moi` (null = xoá nét) - nét vẽ lặp,
 *           đi rồi quay lại làm sai đầu mút ngăn lộ;
 *   - tb  : đặt trạng thái thiết bị gần toạ độ `p` (cùng loại `block`) thành `state`;
 *   - tach: tách nét đi xuyên qua điểm đó thành hai nét có chung đầu mút tại đó (để
 *           nhận ra rẽ chữ T vào thanh cái); `doc` = chỉ tách nét dọc (không tách
 *           chính thanh cái nằm ngang đi qua điểm đó).
 * Chạy lại bao nhiêu lần cũng được.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const VA = [
  {
    tram: 'E6.17',
    mo_ta: 'ký hiệu "dao cách ly" cỡ 42 (gấp 5 lần dao thường) nằm ngang giữa đầu ra ngăn 373 và ngăn 371 - nét gạch chéo của bản CAD nhận nhầm thành dao; đang đóng thì nối tắt hai lộ: đặt cắt',
    tb: { p: [4019.08, -4911.33], block: 'DCL', state: 'mo' },
  },
  {
    tram: 'E6.17',
    mo_ta: 'ngăn 471: cáp Cu-3x240-0,15km trong trạm dừng cách mũi tên đầu ra 15 đv - cáp lộ 471 không nối vào ngăn (chỉ có điện vòng từ E6.3)',
    keo: { tu: [3032.57, -5217.6], den: [3032.57, -5232.32] },
  },
  {
    tram: 'E6.23',
    mo_ta: 'đầu ngăn đường dây ký hiệu 3 nét: nét giữa đứt làm hai khúc, ngắn hơn nét bên - đường dây bắt nhầm vào nét bên phải',
    net: [
      { cu: [[1320.01, -3604.81], [1320.01, -3502.07]], moi: [[1320.01, -3604.81], [1320.01, -3497.34]] },
      { cu: [[1320.01, -3502.07], [1320.01, -3497.34]], moi: null },
      { cu: [[1327.11, -3497.34], [1327.11, -3502.07], [1327.11, -3514.79]], moi: null },
      { cu: [[1312.91, -3497.34], [1312.91, -3502.07], [1312.91, -3514.79]], moi: null },
    ],
  },
  {
    tram: 'E6.7',
    mo_ta: 'ngăn 171: nét dây ngăn vẽ đi lên rồi quay xuống, kèm một nét vẽ trùng - đường dây 174 E6.16 bắt nhầm vào giữa ngăn',
    net: [
      { cu: [[-2299.61, -4347.08], [-2299.61, -4342.58], [-2299.61, -4347.08], [-2299.61, -4425.27]], moi: [[-2299.61, -4342.58], [-2299.61, -4425.27]] },
      { cu: [[-2299.61, -4382.83], [-2299.58, -4425.27]], moi: null },
    ],
  },
  {
    tram: 'E6.5',
    mo_ta: 'ngăn MCHB 431: dây xuống dao -38 dừng ở cực dao, hụt 5 đv so với cáp tổng 3x400 từ MBA T1',
    keo: { tu: [1187.5, -2279.19], den: [1187.5, -2284.32] },
  },
  {
    tram: 'E6.16',
    mo_ta: 'ngăn liên lạc 112: dây từ TUC11 xuống dao 112-1 vắt qua thanh cái C11 không có điểm nối',
    tach: [-3453, -5399.21],
    doc: true,
  },
];

const duongDan = resolve(process.argv[2] ?? 'src/data/tram-sld.json');
const data = JSON.parse(readFileSync(duongDan, 'utf8'));
const s = data.sheets.find((x) => x.code === 'TONG');
const E = 0.05;
const trung = (x, y, p) => Math.abs(x - p[0]) <= E && Math.abs(y - p[1]) <= E;
let doi = 0;

const dinhNet = (r) => {
  const p = [];
  for (let k = 4; k + 1 < r.length; k += 2) p.push([r[k], r[k + 1]]);
  return p;
};
for (const v of VA) {
  for (const { cu, moi } of v.net ?? []) {
    const i = s.b.findIndex((r) => {
      const p = dinhNet(r);
      return p.length === cu.length && p.every((q, k) => trung(q[0], q[1], cu[k]));
    });
    if (i < 0) {
      console.log(`${v.tram} ${v.mo_ta}: ${s.b.some((r) => moi && dinhNet(r).length === moi.length && dinhNet(r).every((q, k) => trung(q[0], q[1], moi[k]))) || !moi ? 'đã vá' : 'KHÔNG THẤY'}`);
      continue;
    }
    if (moi) s.b[i] = [...s.b[i].slice(0, 4), ...moi.flat()];
    else s.b.splice(i, 1);
    console.log(`${v.tram} ${v.mo_ta}: ${moi ? 'sửa' : 'xoá'} 1 nét`);
    doi++;
  }
  if (v.tb) {
    const { p, block, state } = v.tb;
    const iB = data.blocks.indexOf(block);
    const iS = data.states.indexOf(state);
    const r = s.d.find((r) => r[2] === iB && trung(r[3], r[4], p));
    if (!r) console.log(`${v.tram} ${v.mo_ta}: KHÔNG THẤY`);
    else if (r[7] === iS) console.log(`${v.tram} ${v.mo_ta}: đã vá`);
    else {
      r[7] = iS;
      doi++;
      console.log(`${v.tram} ${v.mo_ta}: đặt ${state}`);
    }
  }
  if (v.keo) {
    const { tu, den } = v.keo;
    let co = 0;
    for (const r of s.b) {
      const n = r.length;
      for (const k of [4, n - 2]) {
        if (trung(r[k], r[k + 1], den)) co = -1;
        else if (trung(r[k], r[k + 1], tu) && co >= 0) {
          r[k] = den[0];
          r[k + 1] = den[1];
          co++;
        }
      }
    }
    console.log(`${v.tram} ${v.mo_ta}: ${co > 0 ? `dời ${co} đầu mút` : co < 0 ? 'đã vá' : 'KHÔNG THẤY'}`);
    if (co > 0) doi += co;
  }
  if (v.tach) {
    const P = v.tach;
    let co = 0;
    let da = false;
    const them = [];
    for (const r of s.b) {
      const n = r.length;
      if (trung(r[4], r[5], P) || trung(r[n - 2], r[n - 1], P)) {
        da = true;
        continue;
      }
      for (let k = 4; k + 3 < n; k += 2) {
        const [ax, ay, bx, by] = [r[k], r[k + 1], r[k + 2], r[k + 3]];
        const L = Math.hypot(bx - ax, by - ay);
        if (L < E || (v.doc && Math.abs(bx - ax) > E)) continue;
        const t = ((P[0] - ax) * (bx - ax) + (P[1] - ay) * (by - ay)) / (L * L);
        const d = Math.abs((bx - ax) * (P[1] - ay) - (by - ay) * (P[0] - ax)) / L;
        if (t <= 0 || t >= 1 || d > E) continue;
        them.push([...r.slice(0, 4), P[0], P[1], ...r.slice(k + 2)]);
        r.length = k + 2;
        r.push(P[0], P[1]);
        co++;
        break;
      }
    }
    s.b.push(...them);
    console.log(`${v.tram} ${v.mo_ta}: ${co ? `tách ${co} nét` : da ? 'đã vá' : 'KHÔNG THẤY'}`);
    doi += co;
  }
}
if (doi) writeFileSync(duongDan, JSON.stringify(data));
console.log(doi ? `Đã sửa ${doi} chỗ.` : 'Không có gì thay đổi.');
