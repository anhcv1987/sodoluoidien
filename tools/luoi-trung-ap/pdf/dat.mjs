/**
 * Các bản vẽ PDF lộ trung áp đặt lên tờ sơ đồ tổng (đọc bởi tools/ve-luoi-trung-ap.mjs).
 *   json    : hình học xuất từ tools/pdf-lo/xuat.py
 *   goc     : 'tu_dong' - tự đặt vào khoảng trống gần tâm lý tưởng: giữa các ngăn lộ nguồn và các
 *             bản vẽ liên thông (hai trạm liên kết theo đường ngắn nhất, xem tinhTamTuDong); hoặc
 *             [X, Y] cố định kèm goc_pdf (điểm PDF ứng với goc). ti_le: đơn vị tờ tổng / pt
 *   noi     : cáp từ đầu ra ngăn lộ trong trạm (tu) tới đầu lộ trên bản vẽ, tìm đường tự động
 *   noi_ban_ve: dây nối chỗ liên thông giữa hai bản vẽ (mỗi bản vẽ chỉ vẽ một phía), tìm đường tự động
 *   chu     : chữ thêm (toạ độ PDF); giao: khúc đường dây cấp khác cắt ngang tuyến (toạ độ PDF)
 * Vị trí thực sau khi đặt ghi ra tools/luoi-trung-ap/pdf/vi-tri.json.
 */
export default [
  {
    json: '17.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 473 E6.4': { tu: [-2106, -389.2], ra: 'xuong' },
      'ĐZ 471 E6.4': { tu: [-2181.4, -389.2], ra: 'xuong' },
      'ĐZ 481 E6.4': { tu: [-2558.8, -389.2], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 473 E6.4': true, 'ĐZ 471 E6.4': true, 'ĐZ 481 E6.4': true },
    chu: [
      { p: [795, 295.9], t: '→ LT 473 E6.3' },
      { p: [637.6, 423.3], t: '→ LT 471 E6.19' },
      { p: [745, 131], t: '→ TĐ Hồ Núi Cốc (A6.10)' },
    ],
  },
  {
    json: '18.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 477 E6.4': { tu: [-2141.4, -389.2], ra: 'xuong' },
      'ĐZ 472 E6.4': { tu: [-1913.8, -389.23], ra: 'xuong' },
      'ĐZ 471 E6.2': { tu: [-1399.01, 499.32], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 477 E6.4': true, 'ĐZ 472 E6.4': true, 'ĐZ 471 E6.2': true },
  },
  {
    json: '20.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 474 E6.4': { tu: [-1875.05, -389.2], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 474 E6.4': true },
    chu: [
      { p: [730, 486.7], t: 'LT 478 E6.4 ←', canh: 'phai' },
      { p: [806, 196], t: '↓ LT 478 E6.4 (Lộ 478 E6.4 đến)' },
      { p: [414.5, 200], t: '→ LT 472 E6.2' },
      { p: [239, 173], t: '↑ RMU 34-472 E6.2 (ngăn 472-7/34-2 thường cắt)', canh: 'giua' },
      { p: [449.5, 437.5], t: '→ LT 478 E6.4 (Đầm Xanh)' },
    ],
    noi_ban_ve: [
      { tu: ['20.json', [173.36, 119.41]], den: ['18.json', [474.25, 512.47]], tu_dong: true, cap: true },
      { tu: ['20.json', [293.18, 77.26]], den: ['18.json', [640.8, 408.26]], tu_dong: true },
    ],
  },
  {
    json: '22.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 476 E6.4': { tu: [-1782.55, -389.2], ra: 'xuong' },
      'ĐZ 475 E6.2': { tu: [-1476.25, 499.32], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 476 E6.4': true, 'ĐZ 475 E6.2': true },
    noi_ban_ve: [
      { tu: ['22.json', [403, 206.67]], den: ['18.json', [471.6, 211.48]], tu_dong: true },
    ],
  },
  {
    json: '21.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 475 E6.4': { tu: [-2257.16, -389.2], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 475 E6.4': true },
    chu: [
      { p: [744, 406.5], t: '→ LT 471 E6.5' },
    ],
    noi_ban_ve: [
      { tu: ['21.json', [133.06, 266.77]], den: ['23.json', [136.1, 194.75]], tu_dong: true },
      // chân ngăn 480-7/02-2 (thường cắt) tủ RMU 02-480 xiên xuống sát trục 480: cáp đi từ dưới lên, cắt qua trục
      { tu: ['21.json', [311.62, 454.77]], den: ['23.json', [217.31, 293.53]], tu_dong: true, cap: true, vao: 'len' },
    ],
  },
  {
    json: '23.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 478 E6.4': { tu: [-2328.57, -389.2], ra: 'xuong' },
      'ĐZ 480 E6.4': { tu: [-1744.48, -389.2], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 478 E6.4': true, 'ĐZ 480 E6.4': true },
  },
  {
    json: '24.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 471 E6.5': { tu: [-836.25, -1307.72], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 471 E6.5': true },
    noi_ban_ve: [
      { tu: ['24.json', [299.85, 432.58]], den: ['23.json', [768, 411.9]], tu_dong: true },
      { tu: ['24.json', [480, 116.46]], den: ['21.json', [742.02, 404.45]], tu_dong: true },
    ],
  },
  {
    json: '25.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 473 E6.5': { tu: [-1256.9, -1336.06], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 473 E6.5': true },
    chu: [
      { p: [527, 93], t: '↑ LT 477 E6.21' },
      { p: [421, 47.1], t: '474 E6.17 ←', canh: 'phai' },
      { p: [618, 219], t: '→ ĐZ 481 E6.17' },
    ],
  },
  {
    json: '26.json',
    goc: 'tu_dong',
    ti_le: 1.1,
    noi: {
      'ĐZ 475 E6.5': { tu: [-951.2, -1312.46], ra: 'xuong' },
      'ĐZ 472 E6.5': { tu: [-1338.5, -1336.06], ra: 'xuong' },
      'ĐZ 481 E6.9': { tu: [421.97, -489.15], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 475 E6.5': true, 'ĐZ 472 E6.5': true, 'ĐZ 481 E6.9': true },
    chu: [
      { p: [742, 214], t: 'ĐZ 478 E6.4 ←', canh: 'phai' },
    ],
    noi_ban_ve: [
      { tu: ['26.json', [435.65, 130.78]], den: ['24.json', [299.85, 432.58]], tu_dong: true },
      { tu: ['26.json', [315.62, 414.58]], den: ['25.json', [320.26, 409.46]], tu_dong: true },
      { tu: ['26.json', [207.77, 479.38]], den: ['25.json', [553.64, 305.27]], tu_dong: true },
      { tu: ['26.json', [174.53, 495.04]], den: ['25.json', [726.65, 268.24]], tu_dong: true },
    ],
  },
  {
    json: '27.json',
    goc: 'tu_dong',
    ti_le: 1.1,
    noi: {
      'ĐZ 477 E6.5': { tu: [-748.05, -1307.72], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 477 E6.5': true },
    noi_ban_ve: [
      { tu: ['27.json', [567.2, 181.51]], den: ['17.json', [703.56, 374.82]], tu_dong: true },
    ],
  },
  {
    json: '06.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 472 E6.2': { tu: [-737.51, 499.54], ra: 'xuong' },
    },
    noi_ban_ve: [
      { tu: ['06.json', [131.75, 200.83]], den: ['18.json', [585.11, 336.16]], tu_dong: true },
      { tu: ['06.json', [131.75, 248.85]], den: ['18.json', [640.8, 408.26]], tu_dong: true },
    ],
  },
  {
    json: '07.json',
    goc: 'tu_dong',
    ti_le: 0.75,
    noi: {
      'ĐZ 473 E6.2': { tu: [-1437.4, 499.32], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 473 E6.2': true },
    giao: [
      { p: [480, 380.86], t: 'Giao chéo 376 TCCN', kv: 35, dai: 7 },
    ],
    noi_ban_ve: [
      { tu: ['07.json', [572.57, 380.86]], den: ['18.json', [783.25, 146.19]], tu_dong: true },
      { tu: ['07.json', [447.39, 485.4]], den: ['22.json', [559.76, 475.29]], tu_dong: true },
    ],
  },
  {
    json: '08.json',
    goc: 'tu_dong',
    ti_le: 0.75,
    noi: {
      'ĐZ 474 E6.2': { tu: [-698.29, 499.54], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 474 E6.2': true },
    chu: [
      { p: [484, 424], t: '↓ LT 471 E6.6', canh: 'trai' },
    ],
    noi_ban_ve: [
      { tu: ['08.json', [86.69, 143.2]], den: ['22.json', [699.58, 173.82]], tu_dong: true },
    ],
  },
  {
    json: '01.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 372 E6.2': { tu: [-942.85, 329.13], ra: 'xuong' },
      'ĐZ 373 E6.2': { tu: [-992.9, 329.13], ra: 'xuong' },
      'ĐZ 371 E6.5': { tu: [-388.73, -1103.43], ra: 'phai' },
      'ĐZ 373 E6.5': { tu: [-388.73, -1058.22], ra: 'phai' },
      'ĐZ 375 E6.5': { tu: [-388.73, -1003.86], ra: 'phai' },
      'ĐZ 372 E6.5': { tu: [-388.99, -844.09], ra: 'phai' },
    },
    cap_noi: { 'ĐZ 372 E6.2': true, 'ĐZ 373 E6.2': true, 'ĐZ 371 E6.5': true, 'ĐZ 373 E6.5': true, 'ĐZ 375 E6.5': true, 'ĐZ 372 E6.5': true },
    chu: [
      { p: [505, 568], t: '↓ LT 375 E6.3', canh: 'giua' },
    ],
  },
  {
    json: '02.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 376 E6.2': { tu: [-1042.31, 328.94], ra: 'xuong' },
      'ĐZ 377 E6.2': { tu: [-1093.68, 329.13], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 376 E6.2': true, 'ĐZ 377 E6.2': true },
    chu: [
      { p: [470, 262], t: '← LT 371 E6.6', canh: 'phai' },
      { p: [790, 250], t: '↑ LT 375 E6.19' },
    ],
  },
  {
    json: '04.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 381 E6.2': { tu: [-1195.4, 328.09], ra: 'xuong' },
      'ĐZ 380 E6.2': { tu: [-1144.88, 329.2], ra: 'xuong' },
      'ĐZ 372 E6.8': { tu: [2261.59, 2551.16], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 381 E6.2': true, 'ĐZ 380 E6.2': true },
    chu: [
      { p: [150, 250], t: 'TRẠM CẮT CAO NGẠN (TCCN)' },
    ],
  },
  {
    json: '05.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 377 E6.17': { tu: [2018.99, -2801.32], ra: 'xuong' },
      'ĐZ 387 E6.9': { tu: [865.1, -724.86], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 387 E6.9': true },
    chu: [
      { p: [420, 72], t: '← LT 371 E6.8', canh: 'phai' },
    ],
    noi_ban_ve: [
      // lộ 371 / 376 TCCN đi từ thanh cái trạm cắt Cao Ngạn (vẽ ở bản vẽ 4)
      { tu: ['05.json', [87.11, 174.79]], den: ['04.json', [187.43, 336.49]], tu_dong: true },
      { tu: ['05.json', [87.11, 193.87]], den: ['04.json', [187.43, 492.46]], tu_dong: true },
    ],
  },
];
