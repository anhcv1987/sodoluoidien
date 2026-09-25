/**
 * ĐZ 477 E6.4 - theo bản vẽ "18. ĐZ 472+477 E6.4.pdf" (Phòng Điều độ, 14/07/2026).
 *
 * C41 E6.4 → tủ RMU 01-477 → tủ RMU 02-477: ngăn 477-7/02-3 cấp ra trục cũ của 472E6.4
 * từ cột 48 (DCL 472E6.4-7/48-2) qua Gia Bảy tới DCL 472E6.4-7/25 (thường cắt). Bên kia
 * DCL 7/25 là đoạn 472E6.4 Gia Bảy - Đồng Bẩm (474E6.4 cấp) nối sang 473E6.2 - vẽ
 * trong 473E6.2.mjs, gặp nhau tại điểm cuối chung của hai đường đi.
 * Ngăn 477-7/02-2 (thường cắt) nối về phía cột 47 của 472E6.4.
 * Nhánh liên kết: cột 60 → LBS 472E6.4/61 (thường cắt) LT 471E6.2; cột 7A → tủ RMU
 * Công an tỉnh → DCL 472E6.2-7/21 LT 472E6.2.
 */
const CAP400 = '3xAL/XLPE/PVC/DATA/PVC 1x400';
export default {
  ten: 'ĐZ 477 E6.4',
  tieuDe: [-2132, -470],
  // đầu ra ngăn lộ 477 (thanh cái C41 E6.4) → xuống → sang phải tới điểm gặp 473E6.2
  duong: [
    [-2141.4, -389.2],
    [-2141.4, -600],
    [-1230, -600],
  ],
  canh: [
    [{ dz: '3xAL/XLPE/PVC/DATA/FR-PVC 1x400', dai: '0,9km', cap: true }],
    [
      { khoang: 16 },
      {
        rmu: 'TỦ RMU 01-477 E6.4',
        ngan: [
          { ten: '477-7/01-1', vai: 'vao' },
          { ten: '477-7/01-3', vai: 'ra' },
        ],
      },
      { dz: CAP400, dai: '1,76km', cap: true },
      { khoang: 78 },
      {
        rmu: 'TỦ RMU 02-477 E6.4',
        ngan: [
          { ten: '477-7/02-1', vai: 'vao' },
          {
            ten: '477-7/02-2',
            vai: 're',
            mo: true,
            muc: [
              { dz: CAP400, dai: '150m', cap: true },
              { khoang: 40 },
              { tb: 'DCL', ten: ['DCL 472E6.4-7/48-1', 'LT 477 E6.4'] },
              { dz: 'ACSR 185' },
              { khoang: 20 },
            ],
            cuoi: 'LT 472 E6.4 (cột 47)',
          },
          { ten: '477-7/02-3', vai: 'ra' },
        ],
      },
      { dz: CAP400, dai: '150m', cap: true },
      { khoang: 74 },
      { tb: 'DCL', ten: ['DCL 472E6.4-7/48-2', 'LT 477 E6.4'] },
      { dz: 'ACSR 185' },
      { khoang: 18 },
      { tb: 'DCL', ten: ['DCL 472E6.4-7/53', '(1F)'] },
      { khoang: 10 },
      {
        coc: '60',
        nhanh: {
          phia: 'trai',
          muc: [
            { tb: 'DCL', ten: ['DPT 472E6.4-7/60', 'L.T 471E6.2'] },
            { tb: 'LBS', ten: ['LBS 472E6.4/61', 'L.T 471E6.2', '(thường cắt)'], mo: true },
          ],
          cuoi: 'LT 471 E6.2',
        },
      },
      { tb: 'DCL', ten: ['DCL 472E6.4-7/01', 'Gia Bảy (1F)'] },
      { khoang: 6 },
      { tb: 'DCL', ten: ['DCL 472E6.4-7/05', 'Gia Bảy'] },
      { dz: 'Al 1x400', cap: true },
      { khoang: 26 },
      {
        coc: '7A',
        nhanh: {
          phia: 'trai',
          muc: [
            { tb: 'DCL', ten: ['DCL 472E6.4-7/7A', 'Công an tỉnh'] },
            { dz: 'Cáp ngầm', cap: true },
            { khoang: 14 },
            {
              rmu: 'TỦ RMU 01-472 E6.4 Công an tỉnh',
              ngan: [
                { ten: '472-7/01-1', vai: 'vao' },
                { ten: '472-7/01-2', vai: 'ra' },
              ],
            },
            { dz: 'Cáp ngầm', cap: true },
            { khoang: 12 },
            { tb: 'DCL', ten: ['DCL 472E6.2-7/21', 'Công An tỉnh'] },
          ],
          cuoi: 'LT 472 E6.2',
        },
      },
      { dz: 'ĐDK', an: true },
      { tb: 'LBS', ten: ['LBS 472E6.4/7A', 'Gia Bảy'] },
      { khoang: 16 },
      { tb: 'DCL', ten: ['DCL 472E6.4-7/25', 'Gia Bảy (thường cắt)'], mo: true },
    ],
  ],
};
