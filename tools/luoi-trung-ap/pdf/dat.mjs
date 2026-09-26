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
    noi_ban_ve: [
      // lộ 371 / 376 TCCN đi từ thanh cái trạm cắt Cao Ngạn (vẽ ở bản vẽ 4)
      { tu: ['05.json', [87.11, 174.79]], den: ['04.json', [187.43, 336.49]], tu_dong: true },
      { tu: ['05.json', [87.11, 193.87]], den: ['04.json', [187.43, 492.46]], tu_dong: true },
    ],
  },
  {
    json: '12.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 473 E6.3': { tu: [-3971.84, -3145.26], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 473 E6.3': true },
    noi_ban_ve: [
      // MC 473E6.4/64 Ao Cang (thường cắt) vẽ ở bản vẽ 17
      { tu: ['12.json', [144.11, 145.33]], den: ['17.json', [793.02, 294.46]], tu_dong: true },
    ],
  },
  {
    json: '14.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 479 E6.3': { tu: [-3762.15, -3145.26], ra: 'xuong' },
      'ĐZ 478 E6.3': { tu: [-3687.34, -3145.26], ra: 'xuong' },
      'ĐZ 471 E6.3': { tu: [-4001.15, -3145.26], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 479 E6.3': true, 'ĐZ 478 E6.3': true, 'ĐZ 471 E6.3': true },
  },
  {
    json: '10.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 373 E6.3': { tu: [-3323.7, -2648.59], ra: 'len' },
      'ĐZ 375 E6.3': { tu: [-3021.51, -2646.56], ra: 'len' },
      'ĐZ 374 E6.3': { tu: [-3021.11, -2919.78], ra: 'xuong' },
      'ĐZ 375 E6.17': { tu: [2052.37, -2801.32], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 373 E6.3': true, 'ĐZ 375 E6.3': true, 'ĐZ 374 E6.3': true },
    noi_ban_ve: [
      // trục 373 E6.3 sau cột 15 (tới MC 373E6.3/74 LT 372 TCVB) vẽ ở bản vẽ 9
      { tu: ['10.json', [220.91, 216.01]], den: ['09.json', [691.8, 237.02]], tu_dong: true },
      // đoạn MC 375E6.3/43 - E6.5 vẽ ở bản vẽ 1 (đầu dây "Đi 375 E6.3")
      { tu: ['10.json', [532.3, 219.03]], den: ['01.json', [502.22, 561.22]], tu_dong: true },
    ],
  },
  {
    json: '11.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 376 E6.3': { tu: [-3531.37, -2708.36], ra: 'len' },
      'ĐZ 380 E6.3': { tu: [-3565.11, -2708.36], ra: 'len' },
    },
    cap_noi: { 'ĐZ 376 E6.3': true, 'ĐZ 380 E6.3': true },
    chu: [
      { p: [680, 168], t: '→ LT 377 E6.19' },
      { p: [735, 368], t: '↓ LT 372 E6.7' },
    ],
    noi_ban_ve: [
      // DCL 380E6.3-7/23 (thường cắt) LT 374 E6.3 - phía 374 vẽ ở bản vẽ 10
      { tu: ['11.json', [144.2, 440.85]], den: ['10.json', [144.65, 239.02]], tu_dong: true },
    ],
  },
  {
    json: '13.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 456 E6.3': { tu: [-3248.78, -3070.71], ra: 'xuong' },
      'ĐZ 475 E6.3': { tu: [-3940.08, -3145.26], ra: 'xuong' },
      'ĐZ 472 E6.3': { tu: [-3550.08, -3145.26], ra: 'xuong' },
      'ĐZ 475 E6.21': { tu: [-2201.08, -2342.85], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 456 E6.3': true, 'ĐZ 475 E6.3': true, 'ĐZ 472 E6.3': true, 'ĐZ 475 E6.21': true },
    chu: [
      { p: [805, 342], t: '↑ LT 471 E6.7' },
    ],
  },
  {
    json: '65.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 477 E6.21': { tu: [-2269.78, -2342.85], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 477 E6.21': true },
    chu: [
      { p: [760, 350], t: '↑ Đi 476 E6.3' },
      { p: [790, 440], t: '↑ Nguồn 473 E6.17' },
    ],
    noi_ban_ve: [
      // MC 477E6.21/02 (thường cắt) LT 473 E6.5 vẽ ở bản vẽ 25
      { tu: ['65.json', [214.82, 404.86]], den: ['25.json', [522.78, 94.0]], tu_dong: true },
    ],
  },
  {
    json: '64.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 478 E6.21': { tu: [-2546.97, -2356.67], ra: 'xuong' },
      'ĐZ 454 E6.3': { tu: [-3273.68, -3070.71], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 478 E6.21': true, 'ĐZ 454 E6.3': true },
  },
  {
    json: '32.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 371 E6.7': { tu: [-2041.71, -6344.82], ra: 'xuong' },
      'ĐZ 371 E6.24': { tu: [-3416.15, -6811.27], ra: 'trai' },
    },
    cap_noi: { 'ĐZ 371 E6.7': true, 'ĐZ 371 E6.24': true },
    noi_ban_ve: [
      // DCL 371E6.7-7/06 (thường cắt) LT 372 E6.7 - lộ 372 vẽ ở bản vẽ 33
      { tu: ['32.json', [197.93, 368.0]], den: ['33.json', [111.71, 229.93]], tu_dong: true },
    ],
  },
  {
    json: '33.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 372 E6.7': { tu: [-1728.1, -6279.44], ra: 'xuong' },
      'ĐZ 373 E6.7': { tu: [-2072.77, -6344.31], ra: 'xuong' },
      'ĐZ 373 E6.17': { tu: [2085.96, -2801.32], ra: 'xuong', tu_do: 8 },
    },
    cap_noi: { 'ĐZ 372 E6.7': true, 'ĐZ 373 E6.7': true },
    chu: [
      { p: [760, 300], t: 'TRẠM CẮT VÒNG BI (TCVB) - LT 371 TCVB' },
    ],
    noi_ban_ve: [
      // MC 372E6.7/08 LT 380 E6.3 vẽ ở bản vẽ 11
      { tu: ['33.json', [310.4, 131.74]], den: ['11.json', [728.51, 343.0]], tu_dong: true },
    ],
  },
  {
    json: '34.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 471 E6.7': { tu: [-2655.03, -6230.96], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 471 E6.7': true },
  },
  {
    json: '35.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 476 E6.7': { tu: [-2218.11, -6231.42], ra: 'xuong' },
      'ĐZ 477 E6.13': { tu: [405, -5580.1], ra: 'phai' },
      'ĐZ 450 E6.14': { tu: [1656.01, -5828.52], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 476 E6.7': true, 'ĐZ 477 E6.13': true, 'ĐZ 450 E6.14': true },
    noi_ban_ve: [
      // MC 471E6.7/1A NR Tiên Phong (thường cắt), DCL 471E6.7-7/14 (thường cắt), DCL 471E6.7-7/02
      // LT 477 E6.13 (thường cắt): thiết bị vẽ ở bản vẽ 34 (lộ 471 E6.7)
      { tu: ['35.json', [362.27, 376.72]], den: ['34.json', [382.1, 560.1]], tu_dong: true },
      { tu: ['35.json', [135.56, 240.76]], den: ['34.json', [167.23, 523.75]], tu_dong: true },
      { tu: ['35.json', [461.36, 376.72]], den: ['34.json', [462.48, 561.34]], tu_dong: true },
    ],
  },
  {
    json: '36.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 473 E6.7': { tu: [-2476.47, -6230.96], ra: 'xuong' },
      'ĐZ 475 E6.7': { tu: [-2503.84, -6230.96], ra: 'xuong' },
      'ĐZ 475 E6.24': { tu: [-3777.96, -6856.34], ra: 'xuong' },
      'ĐZ 477 E6.24': { tu: [-3812.11, -6856.34], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 473 E6.7': true, 'ĐZ 475 E6.7': true, 'ĐZ 475 E6.24': true, 'ĐZ 477 E6.24': true },
    noi_ban_ve: [
      // MC 476E6.7/11 LT 473 E6.7 vẽ ở bản vẽ 35
      { tu: ['36.json', [392.36, 305.65]], den: ['35.json', [797.48, 69.46]], tu_dong: true },
    ],
  },
  {
    json: '37.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 472 E6.7': { tu: [-2276.33, -6231.42], ra: 'xuong' },
      'ĐZ 474 E6.7': { tu: [-2248.96, -6231.42], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 472 E6.7': true, 'ĐZ 474 E6.7': true },
    chu: [{ p: [790, 400], t: 'C.TY THÉP ĐẠI VIỆT' }],
    noi_ban_ve: [
      // DCL 473E6.7-7/25 NR Chã (thường cắt) vẽ ở bản vẽ 36
      { tu: ['37.json', [760.52, 202.72]], den: ['36.json', [256.13, 166.79]], tu_dong: true },
    ],
  },
  {
    json: '70.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 373 E6.24': { tu: [-3279.63, -6767.2], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 373 E6.24': true },
    noi_ban_ve: [
      // LBS 371E6.24/1A LT 373 E6.24 (thường cắt) - phía 371 E6.24 (đầu lộ sau ngăn) vẽ ở bản vẽ 32
      { tu: ['70.json', [173.0, 303.33]], den: ['32.json', [577.85, 134.14]], tu_dong: true },
    ],
  },
  {
    json: '09.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {},
    cap_noi: {},
    chu: [{ p: [60, 292], t: 'TRẠM CẮT VÒNG BI (TCVB)' }],
    noi_ban_ve: [
      // MC 373E6.17/27 (ngăn 374 TCVB) vẽ ở bản vẽ 33
      { tu: ['09.json', [92.6, 237.82]], den: ['33.json', [753.8, 241.63]], tu_dong: true },
    ],
  },
  {
    json: '03.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 373 E6.8': { tu: [1962.46, 2566.86], ra: 'xuong' },
      'ĐZ 374 E6.8': { tu: [2291.74, 2551.16], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 373 E6.8': true, 'ĐZ 374 E6.8': true },
    chu: [{ p: [690, 305], t: 'XI MĂNG LA HIÊN' }],
  },
  {
    json: '38.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 371 E6.8': { tu: [1999.02, 2580.6], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 371 E6.8': true },
    chu: [{ p: [705, 250], t: '→ Tràng Xá (MC 371E6.8/1A)' }, { p: [405, 470], t: '← 375 E13.1 Lạng Sơn (PC Lạng Sơn)', canh: 'phai' }],
    noi_ban_ve: [
      // LBS 371E6.8/111 NR Văn Hán (thường cắt) vẽ ở bản vẽ 5 (phía 371 TCCN)
      { tu: ['38.json', [539.24, 144.67]], den: ['05.json', [463.26, 74.74]], tu_dong: true },
      // DCL 371E6.8-7/02 LT 372 E6.8 (thường cắt): lộ 372 E6.8 vẽ ở bản vẽ 40
      { tu: ['38.json', [107.03, 482.2]], den: ['40.json', [141.5, 298.06]], tu_dong: true },
    ],
  },
  {
    json: '41.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 375 E6.8': { tu: [1920.02, 2678.05], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 375 E6.8': true },
    noi_ban_ve: [
      // LBS 375E6.8/04 Cúc Đường (thường cắt) - phía 371 E6.8 cột 58 vẽ ở bản vẽ 38
      { tu: ['41.json', [161.76, 383.0]], den: ['38.json', [215.99, 246.76]], tu_dong: true },
      // DCL 375E6.8-7/319 - cột 188 ĐZ 371 E6.8
      { tu: ['41.json', [311.09, 417.85]], den: ['38.json', [625.7, 310.85]], tu_dong: true },
      // LBS 375E6.8/333 - cột 202A ĐZ 371 E6.8
      { tu: ['41.json', [439.16, 409.85]], den: ['38.json', [713.15, 338.08]], tu_dong: true },
    ],
  },
  {
    json: '40.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 372 E6.8': { tu: [2261.59, 2551.16], ra: 'xuong' },
      'ĐZ 377 E6.8': { tu: [1873.52, 2678.05], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 372 E6.8': true, 'ĐZ 377 E6.8': true },
    noi_ban_ve: [
      // MC 373TCCN/65 LT 372 E6.8 (thường cắt) vẽ ở bản vẽ 4
      { tu: ['40.json', [336.08, 96.37]], den: ['04.json', [777.17, 480.64]], tu_dong: true },
      // DCL 377E6.8-7/13 LT 375 E6.8 (thường cắt) vẽ ở bản vẽ 41
      { tu: ['40.json', [204.35, 388.75]], den: ['41.json', [84.5, 458.65]], tu_dong: true },
    ],
  },
];
