/**
 * ĐZ 477 E6.4 - theo bản vẽ "18. ĐZ 472+477 E6.4.pdf" (Phòng Điều độ, 14/07/2026).
 *
 * C41 E6.4 → tủ RMU 01-477 → tủ RMU 02-477: ngăn 477-7/02-3 cấp ra trục cũ của 472E6.4
 * từ cột 48 (DCL 472E6.4-7/48-2) qua Gia Bảy tới DCL 472E6.4-7/25 (thường cắt, bên kia
 * là 474E6.4); ngăn 477-7/02-2 (thường cắt) nối về phía cột 47 của 472E6.4.
 * Nhánh liên kết: cột 60 → LBS 472E6.4/61 (thường cắt) LT 471E6.2; cột 7A → tủ RMU
 * Công an tỉnh → DCL 472E6.2-7/21 LT 472E6.2.
 */
const CAP400 = '3xAL/XLPE/PVC/DATA/PVC 1x400';
export default {
  ten: 'ĐZ 477 E6.4',
  tieuDe: [-2132, -470],
  // đầu ra ngăn lộ 477 (thanh cái C41 E6.4) → xuống → sang phải
  duong: [
    [-2141.4, -389.2],
    [-2141.4, -600],
    [-1165, -600],
  ],
  canh: [
    // cạnh 1: cáp từ ngăn lộ
    [{ dz: '3xAL/XLPE/PVC/DATA/FR-PVC 1x400', dai: '0,9km', cap: true }],
    // cạnh 2: trục chính
    [
      { khoang: 20 },
      { rmu: 'TỦ RMU 01-477 E6.4', ngan: ['477-7/01-1', '477-7/01-3'] },
      { dz: CAP400, dai: '1,76km', cap: true },
      { khoang: 80 },
      {
        rmu: 'TỦ RMU 02-477 E6.4',
        ngan: ['477-7/02-1', '477-7/02-3'],
        re: [
          {
            phia: 'phai',
            ten: ['477-7/02-2', '(thường cắt)'],
            mo: true,
            muc: [
              { dz: CAP400, dai: '150m', cap: true },
              { khoang: 40 },
              { tb: 'DCL', ten: ['DCL 472E6.4-7/48-1', 'LT 477 E6.4'] },
              { dz: 'ACSR 185' },
              { coc: '48' },
              { coc: '47' },
            ],
            cuoi: 'LT 472 E6.4 (cột 47)',
          },
        ],
      },
      { dz: CAP400, dai: '150m', cap: true },
      { khoang: 76 },
      { tb: 'DCL', ten: ['DCL 472E6.4-7/48-2', 'LT 477 E6.4'] },
      { coc: '48' },
      { dz: 'ACSR 185' },
      { khoang: 14 },
      { coc: '53' },
      { tb: 'DCL', ten: ['DCL 472E6.4-7/53', '(1F)'] },
      { coc: '54' },
      { tu: ['TBN 401/54', '600kVAr'] },
      { coc: '56' },
      { khoang: 14 },
      { coc: '60' },
      {
        nhanh: {
          phia: 'trai',
          muc: [
            { tb: 'DCL', ten: ['DPT 472E6.4-7/60', 'L.T 471E6.2'] },
            { tb: 'LBS', ten: ['LBS 472E6.4/61', 'L.T 471E6.2', '(thường cắt)'], mo: true },
            { coc: '62' },
          ],
          cuoi: 'LT 471 E6.2',
        },
      },
      { tb: 'DCL', ten: ['DCL 472E6.4-7/01', 'Gia Bảy (1F)'] },
      { coc: '1' },
      { coc: '3' },
      { coc: '5' },
      { tb: 'DCL', ten: ['DCL 472E6.4-7/05', 'Gia Bảy'] },
      { dz: 'Al 1x400', cap: true },
      { khoang: 30 },
      { coc: '7A' },
      {
        nhanh: {
          phia: 'trai',
          muc: [
            { tb: 'DCL', ten: ['DCL 472E6.4-7/7A', 'Công an tỉnh'] },
            { dz: 'Cáp ngầm', cap: true },
            { khoang: 12 },
            { rmu: 'TỦ RMU 01-472 E6.4 Công an tỉnh', ngan: ['472-7/01-1', '472-7/01-2 LT 472E6.2'] },
            { dz: 'Cáp ngầm', cap: true },
            { khoang: 10 },
            { tb: 'DCL', ten: ['DCL 472E6.2-7/21', 'Công An tỉnh'] },
          ],
          cuoi: 'LT 472 E6.2',
        },
      },
      { dz: 'ĐDK', an: true },
      { tb: 'LBS', ten: ['LBS 472E6.4/7A', 'Gia Bảy'] },
      { coc: '8' },
      { coc: '15' },
      { coc: '17' },
      { coc: '18' },
      { coc: '23' },
      { coc: '24' },
      { tb: 'DCL', ten: ['DCL 472E6.4-7/25', 'Gia Bảy (thường cắt)'], mo: true },
      { coc: '25' },
    ],
  ],
  cuoi: 'LT 474 E6.4 (MC 472E6.4/25 Gia Bảy)',
};
