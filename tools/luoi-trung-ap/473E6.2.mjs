/**
 * ĐZ 473 E6.2 - theo bản vẽ "7. ĐZ 473 E6.2.pdf" (Phòng Điều độ, 18/07/2026).
 *
 * C43 E6.2 → cáp Cu 3x185 250m → cột 03 → trục AC120 / AC150 qua LBS 473E6.2/71 tới
 * đầu dây "473 E6.2 đến" của bản vẽ 18 (DCL 472E6.4-7/62 - MC 472E6.4/61 thường cắt -
 * DPT 472E6.4-7/61: vẽ theo bản vẽ 18, tools/luoi-trung-ap/pdf/).
 * Nhánh liên kết: cột 65 → LBS 473E6.2/04 … LBS 476E6.4/39 (thường cắt) LT 476E6.4.
 */
export default {
  ten: 'ĐZ 473 E6.2',
  tieuDe: [-1428, 420],
  // đầu ra ngăn lộ 473 (C43 E6.2) → xuống → sang phải → xuống → sang trái → xuống,
  // điểm cuối trùng điểm cuối ĐZ 477 E6.4
  duong: [
    [-1437.4, 499.3],
    [-1437.4, 250],
    // cột 65 (nhánh LT 476E6.4 đi xuống) đặt vào khoảng trống giữa MC 472E6.4/73 và
    // tủ RMU Công an tỉnh của bản vẽ 18
    [-1058, 250],
    [-663.16, 250],
    [-663.16, 217.32],
  ],
  canh: [
    [{ dz: 'Cu 3x185', dai: '250m', cap: true }],
    [
      { khoang: 6 },
      { tb: 'DCL', ten: ['DCL 473E6.2-7/01'] },
      { dz: 'AC120' },
      { coc: '03' },
      { ghi: '(cột 04-474E6.2 cách 2m)', rong: 4 },
      { khoang: 30 },
      { tb: 'DCL', ten: ['DCL 473E6.2-7/42'] },
    ],
    [
      {
        coc: '65',
        nhanh: {
          phia: 'phai',
          muc: [
            { tb: 'DCL', ten: ['DCL 473E6.2-7/04', 'LT 476E6.4'] },
            { tb: 'LBS', ten: ['LBS 473E6.2/04', 'LT 476E6.4'] },
            { tb: 'DCL', ten: ['DCL 473E6.2-7/05', 'LT 476E6.4'] },
            { dz: 'AC185' },
            { khoang: 20 },
            { tb: 'DCL', ten: ['DCL 476E6.4-7/40', 'LT 473 E6.2'] },
            { tb: 'LBS', ten: ['LBS 476E6.4/39', 'LT 473 E6.2', '(thường cắt)'], mo: true },
            { tb: 'DCL', ten: ['DCL 476E6.4-7/39', 'LT 473 E6.2'] },
            { ranh: ['Đồng Hỷ', 'Thành phố'] },
            { dz: 'AC185' },
            { khoang: 14 },
            { ghi: 'Qua sông' },
          ],
          cuoi: 'LT 476 E6.4',
        },
      },
      { tb: 'DCL', ten: ['DCL 473E6.2-7/70A'] },
      { tb: 'LBS', ten: ['LBS 473E6.2/71'] },
      { dz: 'AC120' },
      { khoang: 30 },
      { dz: 'AC150' },
      { khoang: 30 },
      { giao: 'Giao chéo 376 TCCN', kv: 35 },
      { khoang: 12 },
    ],
    [],
  ],
};
