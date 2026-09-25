/**
 * ĐZ 473 E6.2 - theo bản vẽ "7. ĐZ 473 E6.2.pdf" (Phòng Điều độ, 18/07/2026), nối
 * sang ĐZ 477 E6.4 qua đoạn 472E6.4 Đồng Bẩm - Gia Bảy (bản vẽ "18. ĐZ 472+477 E6.4").
 *
 * C43 E6.2 → cáp Cu 3x185 250m → cột 03 → trục AC120 / AC150 qua LBS 473E6.2/71 tới
 * MC 472E6.4/61 (thường cắt, ranh giới 473E6.2 / 472E6.4) → đoạn 472E6.4 (474E6.4 cấp
 * qua DCL 472E6.4-7/25-1): AC150 → AC120 qua Đồng Bẩm → tủ RMU 07 Đồng Bẩm → MC
 * 472E6.4/25 Gia Bảy (ranh giới Đồng Hỷ / Thành phố) → cột 25 → gặp ĐZ 477 E6.4 tại
 * DCL 472E6.4-7/25 (thường cắt).
 * Nhánh liên kết: cột 65 → LBS 473E6.2/04 … LBS 476E6.4/39 (thường cắt) LT 476E6.4;
 * cột 25 → DCL 472E6.4-7/25-1 → cột 26 (DCL 472E6.2-7/36 thường cắt LT 472E6.2) →
 * DCL 472E6.4-7/26 LT 474E6.4.
 */
export default {
  ten: 'ĐZ 473 E6.2',
  tieuDe: [-1428, 420],
  // đầu ra ngăn lộ 473 (C43 E6.2) → xuống → sang phải → xuống → sang trái → xuống,
  // điểm cuối trùng điểm cuối ĐZ 477 E6.4
  duong: [
    [-1437.4, 499.3],
    [-1437.4, 250],
    [-760, 250],
    [-760, -330],
    [-1230, -330],
    [-1230, -600],
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
      { khoang: 14 },
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
      { coc: '73' },
      { tu: ['TBN 401/73', '150kVAr'] },
      { dz: 'AC120' },
      { khoang: 30 },
      { dz: 'AC150' },
      { khoang: 30 },
      { ghi: 'Giao chéo 376 TCCN', rong: 4 },
      { khoang: 12 },
      { tb: 'DCL', ten: ['DPT 472E6.4-7/62', 'LT 473E6.2'] },
      { ranh: ['473E6.2', '472E6.4'] },
      { tb: 'REC', ten: ['MC 472E6.4/61', 'LT 473E6.2 (thường cắt)'], mo: true },
      { tb: 'DCL', ten: ['DCL 472E6.4-7/61', 'LT 473E6.2'] },
    ],
    // đoạn 472E6.4 (474E6.4 cấp): từ cột 44 đi lên Đồng Bẩm
    [
      { dz: 'AC150' },
      { khoang: 24 },
      { ghi: 'Giao chéo 371 TCCN (VT35)' },
      { khoang: 18 },
      { dz: 'AC120' },
      { khoang: 30 },
      { tb: 'DCL', ten: ['DCL 472E6.4-7/28', 'Đồng Bẩm (1F)'] },
      { coc: '27' },
      { tu: ['300kVAr'] },
      { khoang: 16 },
      { tb: 'DCL', ten: ['DCL 472E6.4-7/08', 'Đồng Bẩm'] },
      { dz: 'Cu 1x240', cap: true },
      { khoang: 26 },
      {
        rmu: 'TỦ RMU 07-472 E6.4 NR Đồng Bẩm',
        ngan: [
          { ten: '472-7/07-2', vai: 'vao' },
          { ten: '472-7/07-1', vai: 'ra' },
        ],
      },
      { dz: 'Cu 1x240', cap: true },
      { khoang: 26 },
      { tb: 'DCL', ten: ['DCL 472E6.4-7/06', 'Đồng Bẩm'] },
      { dz: 'ĐDK', an: true },
    ],
    // Gia Bảy: MC 472E6.4/25 (ranh giới Đồng Hỷ / Thành phố), cột 25 rẽ lên 474E6.4
    [
      { ranh: ['Đồng Hỷ', 'Thành phố'] },
      { tb: 'REC', ten: ['MC 472E6.4/25', 'Gia Bảy'] },
      {
        coc: '25',
        nhanh: {
          phia: 'phai',
          muc: [
            { tb: 'DCL', ten: ['DCL 472E6.4-7/25-1', 'LT 474E6.4 (1F)'] },
            { khoang: 12 },
            {
              coc: '26',
              nhanh: {
                phia: 'phai',
                muc: [{ khoang: 4 }, { tb: 'DCL', ten: ['DCL 472E6.2-7/36', '(thường cắt)'], mo: true }],
                cuoi: 'LT 472 E6.2 (DCL 34 Bảo Tàng)',
              },
            },
            { khoang: 30 },
            { tb: 'DCL', ten: ['DCL 472E6.4-7/26', 'LT 474E6.4'] },
          ],
          cuoi: 'LT 474 E6.4',
        },
      },
    ],
    [],
  ],
};
