/**
 * Các bản vẽ PDF lộ trung áp đặt lên tờ sơ đồ tổng (đọc bởi tools/ve-luoi-trung-ap.mjs).
 *   json    : hình học xuất từ tools/pdf-lo/xuat.py
 *   goc     : 'tu_dong' - tự đặt vào khoảng trống gần tâm lý tưởng: giữa các ngăn lộ nguồn và các
 *             bản vẽ liên thông (hai trạm liên kết theo đường ngắn nhất, xem tinhTamTuDong); hoặc
 *             [X, Y] cố định kèm goc_pdf (điểm PDF ứng với goc). ti_le: đơn vị tờ tổng / pt
 *   noi     : cáp từ đầu ra ngăn lộ trong trạm (tu) tới đầu lộ trên bản vẽ, tìm đường tự động
 *   noi_ban_ve: dây nối chỗ liên thông giữa hai bản vẽ (mỗi bản vẽ chỉ vẽ một phía), tìm đường tự động
 *   chu     : chữ thêm (toạ độ PDF); giao: khúc đường dây cấp khác cắt ngang tuyến (toạ độ PDF)
 *   lat     : lật ngang một vùng bản vẽ quanh trục đứng (toạ độ PDF) - [{ vung: [x0, y0, x1, y1], truc: x }]:
 *             đoạn tuyến bản PDF vẽ quay ngược về phía khác với hướng dây liên thông đi tiếp (phải vòng chữ U)
 *             thì lật sang phía kia; thiết bị, tên, số cột lật theo, thứ tự trên tuyến giữ nguyên
 *   nan_diem: nắn điểm gấp của bản PDF (bậc thang thừa không có thiết bị) - [[[x, y], [x2, y2] | null |
 *             [[x2, y2], [x3, y3]...]], ...]: dời đỉnh tuyến (x, y) tới (x2, y2), null = bỏ đỉnh đó, danh sách
 *             = thay bằng các đỉnh đó; hoặc { tu: [x, y], den: [x, y], thay: [[x, y]...], cap: true } thay
 *             cả khúc từ đỉnh tu tới đỉnh den (cap: khúc mới vẫn vẽ cáp ngầm) (toạ độ PDF, làm trước 'lat')
 *   nha_may : nhà máy điện ở cuối nhánh - { p: điểm dây vào khung nhà máy (PDF), huong: phía đặt ký hiệu
 *             máy phát (phai/trai/len/xuong), ten, ma (mã điều độ), cs (công suất), noi: đoạn dây vẽ thêm }
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
    // bậc thang thừa sau LBS 474E6.4/59 (xuống 12pt, ngang 44pt rồi mới xuống tủ RMU 62): đi ngang thẳng
    // tới trên tủ rồi xuống - khúc nắn vẫn vẽ cáp ngầm như bản gốc
    nan_diem: [{ tu: [289.4, 280.33], den: [333.65, 291.43], thay: [[333.65, 279.52]], cap: true }],
    noi: {
      'ĐZ 474 E6.4': { tu: [-1875.05, -389.2], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 474 E6.4': true },
    chu: [
      { p: [730, 486.7], t: 'LT 478 E6.4 ←', canh: 'phai' },
      { p: [806, 196], t: '↓ LT 478 E6.4 (Lộ 478 E6.4 đến)' },
      { p: [414.5, 200], t: '→ LT 472 E6.2' },
      { p: [239, 173], t: '↑ RMU 34-472 E6.2 (ngăn 472-7/34-2 thường cắt)', canh: 'giua' },
    ],
    noi_ban_ve: [
      { tu: ['20.json', [173.36, 119.41]], den: ['18.json', [474.25, 512.47]], tu_dong: true, cap: true },
      { tu: ['20.json', [293.18, 77.26]], den: ['18.json', [640.8, 408.26]], tu_dong: true },
    ],
  },
  {
    // bản vẽ 6 (ĐZ 472 E6.2 hoàn thiện hạ ngầm), phần NR Điện Lực - BLX 99 (tên thiết bị cũ 478E6.4, nay
    // nhận điện 472 E6.2 qua RMU 34 -> RMU 35-472E6.2 -> cột 19A): nhánh cột 11 (DCL 478E6.4-7/01 LT
    // 474E6.4, Cu 3x240) lên LBS 474E6.4/04 Đầm Xanh (thường cắt) vẽ ở bản vẽ 20; cuối tuyến LBS 478E6.4/01
    // Công ty Điện lực (thường cắt) sang RMU 14-478 E6.4
    json: '06b.json',
    goc: 'tu_dong',
    gan: [-230, -1560],
    ti_le: 1.2,
    chu: [
      { p: [492, 414.5], t: '→ RMU 14-478 E6.4 (LT 478 E6.4)' },
    ],
    noi_ban_ve: [
      { tu: ['20.json', [293.09, 190.99]], den: ['06b.json', [131.72, 405.07]], tu_dong: true, cap: true },
      { tu: ['06b.json', [359.99, 381.67]], den: ['20.json', [447.64, 435.67]], tu_dong: true, cap: true },
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
  },
  {
    json: '26.json',
    goc: 'tu_dong',
    ti_le: 1.1,
    // bậc thang thừa sau cột 38 (LBS 475E6.5/37A): đi thẳng tới chân cột đứng rồi lên
    nan_diem: [{ tu: [754.94, 297.31], den: [804.88, 297.42], thay: [[804.92, 333.25], [804.92, 297.42]] }],
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
      'ĐZ 473 E6.3': { tu: [-3971.84, -3145.26], ra: 'xuong', tu_do: 6 },
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
      // bản vẽ trạm vẽ 475 qua DCL 7/01A, TD42, 7/01B, AL 1x300-810m tới DCL 7/02; bản vẽ 13 (mới hơn) đi cáp
      // thẳng từ ngăn lộ vào tủ RMU 01-475E6.21 - giữ đầu nối tại ngăn lộ, chờ Phòng Điều độ xác nhận
      'ĐZ 475 E6.21': { tu: [-2201.08, -2342.85], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 456 E6.3': true, 'ĐZ 475 E6.3': true, 'ĐZ 472 E6.3': true, 'ĐZ 475 E6.21': true },
  },
  {
    json: '65.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    // DCL 477E6.21-7/01 đã có trong bản vẽ trạm (đầu nối cáp ngăn lộ đặt sau dao này)
    bo_tb: ['DCL 477E6.21-7/01'],
    noi: {
      // cuối nét ngăn lộ vẽ trong trạm (qua cáp AL 1x400-2536m, DCL 477E6.21-7/01)
      'ĐZ 477 E6.21': { tu: [-2391.51, -2449.31], ra: 'trai' },
    },
    cap_noi: { 'ĐZ 477 E6.21': true },
    chu: [
      { p: [760, 350], t: '↑ Đi 476 E6.3' },
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
      'ĐZ 373 E6.17': { tu: [2085.96, -2801.32], ra: 'xuong', tu_do: 12 },
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
    noi_ban_ve: [
      // cột 83 - LBS 471E6.7/84 (LT 475 E6.3, thường cắt) vẽ ở bản vẽ 13
      { tu: ['34.json', [825.26, 267.37]], den: ['13.json', [800.54, 351.22]], tu_dong: true },
    ],
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
  {
    json: '44.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 371 E6.17': { tu: [2112.19, -2884.26], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 371 E6.17': true },
    noi_ban_ve: [
      // LBS 371E6.17/23 LT 377 E6.17 (thường cắt) - cột 38A ĐZ 377 E6.17 (trước TG Phú Bình) vẽ ở bản vẽ 5
      { tu: ['44.json', [515.5, 329.64]], den: ['05.json', [96.89, 348.82]], tu_dong: true },
    ],
  },
  {
    json: '47.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    // bậc thang thừa ở cột 07A (trước MC 472E6.17/16): đi thẳng tới chân cột đứng rồi lên
    nan_diem: [{ tu: [579.23, 433.51], den: [614.09, 433.51], thay: [[614.09, 446.32], [614.09, 433.51]] }],
    noi: {
      'ĐZ 472 E6.17': { tu: [1150.37, -3127.8], ra: 'xuong' },
      'ĐZ 474 E6.17': { tu: [1613.82, -3127.8], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 472 E6.17': true, 'ĐZ 474 E6.17': true },
    noi_ban_ve: [
      // MC 474E6.17/233 (thường cắt, phía nguồn 481 E6.17) - đoạn cột 12 - MC 474E6.17/37 vẽ ở bản vẽ 25
      { tu: ['47.json', [276.52, 150.13]], den: ['25.json', [567.92, 46.78]], tu_dong: true },
      // cột 50 - MC 476E6.7/16 LT 474 E6.17 (thường cắt) vẽ ở bản vẽ 35
      { tu: ['47.json', [165.56, 334.78]], den: ['35.json', [745.1, 196.87]], tu_dong: true },
    ],
  },
  {
    json: '48.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 481 E6.17': { tu: [1404.99, -3127.8], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 481 E6.17': true },
    noi_ban_ve: [
      // MC 481E6.17/125 LT 473 E6.5 vẽ ở bản vẽ 25
      { tu: ['48.json', [406.04, 366.79]], den: ['25.json', [621.71, 214.18]], tu_dong: true },
    ],
  },
  {
    json: '28.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 371 E6.6': { tu: [440.11, 3923.97], ra: 'phai' }, // cuối nét ngăn lộ (nhãn Phú Lương)
    },
    cap_noi: { 'ĐZ 371 E6.6': true },
    noi_ban_ve: [
      // MC 371E6.6/158 LT 376 E6.2 (thường cắt) vẽ ở bản vẽ 2
      { tu: ['28.json', [751.79, 431.47]], den: ['02.json', [544.44, 260.83]], tu_dong: true },
    ],
  },
  {
    json: '29.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 372 E6.6': { tu: [440.11, 3961.65], ra: 'phai' }, // cuối nét ngăn lộ
      'ĐZ 373 E6.6': { tu: [439.89, 4250.14], ra: 'phai' }, // cuối nét ngăn lộ (nhãn Sang Định Hóa)
    },
    cap_noi: { 'ĐZ 372 E6.6': true, 'ĐZ 373 E6.6': true },
  },
  {
    json: '30.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 471 E6.6': { tu: [0.8, 3773.6], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 471 E6.6': true },
    noi_ban_ve: [
      // DCL 474E6.2-7/02 NR Toàn Thắng (thường cắt) vẽ ở bản vẽ 8
      { tu: ['30.json', [482.18, 320.38]], den: ['08.json', [480.46, 421.55]], tu_dong: true },
      // MC 471E6.6/01 NR Đồng Hút (thường cắt) - phía 474 E6.2 cột 16 Liên Hồng
      { tu: ['30.json', [341.85, 290.59]], den: ['08.json', [480.53, 386.41]], tu_dong: true },
      // LBS 08/474E6.2 MV 471E6.6 (thường cắt) - phía 474 E6.2 cột 71
      { tu: ['30.json', [540.0, 319.87]], den: ['08.json', [597.59, 195.7]], tu_dong: true },
    ],
  },
  {
    json: '57.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 375 E6.19': { tu: [-2331.01, 3842.45], ra: 'phai' },
    },
    cap_noi: { 'ĐZ 375 E6.19': true },
    noi_ban_ve: [
      // MC 377E6.2/101A LT 375 E6.19 (thường cắt) vẽ ở bản vẽ 2
      { tu: ['57.json', [635.3, 318.91]], den: ['02.json', [762.92, 274.5]], tu_dong: true },
    ],
  },
  {
    json: '58.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 377 E6.19': { tu: [-2331.01, 3896.4], ra: 'phai' },
    },
    cap_noi: { 'ĐZ 377 E6.19': true },
    noi_ban_ve: [
      // MC 376E6.3/55 LT 377 E6.19 (thường cắt) vẽ ở bản vẽ 11
      { tu: ['58.json', [161.75, 115.03]], den: ['11.json', [668.5, 172.58]], tu_dong: true },
    ],
  },
  {
    json: '59.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 471 E6.19': { tu: [-2786.42, 3317.15], ra: 'xuong' },
    },
    // đoạn trên (cột 174 - DCL 473E6.4-7/22 - MC 473E6.4/20 - DCL 473E6.4-7/20) bản PDF vẽ quay sang
    // trái, còn dây liên thông về 473 E6.4 đi sang phải - phải vòng chữ U: lật sang phải quanh cột đứng
    lat: [{ vung: [530, 170, 694.6, 214], truc: 694.73 }],
    // bậc thang thừa trước DCL 471E6.19-7/136 (dây lên 18pt rồi mới tới cột đứng, không có thiết bị):
    // đi thẳng tới chân cột đứng rồi lên
    nan_diem: [
      [[666.5, 344.98], null],
      [[666.5, 327.34], null],
      // góc mới ở chân cột đứng; giữ đỉnh cũ (khúc 4,7pt sát ký hiệu DCL như bản gốc - để khúc dài
      // 18,7pt không bị tính lây thành cáp theo cụm nét ngắn quanh ký hiệu dao)
      [[694.58, 327.37], [[694.58, 346.06], [694.58, 327.37]]],
    ],
    cap_noi: { 'ĐZ 471 E6.19': true },
    noi_ban_ve: [
      // MC 473E6.4/20 LT 471 E6.19 (thường cắt) - đoạn 473 E6.4 tới LBS 473E6.4/47 vẽ ở bản vẽ 17
      { tu: ['59.json', [573.0, 194.9]], den: ['17.json', [635.67, 421.96]], tu_dong: true },
    ],
  },
  {
    json: '60.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 473 E6.19': { tu: [-2834, 3317.15], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 473 E6.19': true },
    noi_ban_ve: [
      // DCL 471E6.19-7/29 LT 473 E6.19 (thường cắt) vẽ ở bản vẽ 59
      { tu: ['60.json', [309.38, 307.3]], den: ['59.json', [315.35, 364.49]], tu_dong: true },
    ],
  },
  {
    json: '61.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 475 E6.19': { tu: [-2891.45, 3317.15], ra: 'xuong' },
      'ĐZ 477 E6.19': { tu: [-2956.28, 3317.15], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 475 E6.19': true, 'ĐZ 477 E6.19': true },
  },
  {
    json: '66.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      // đầu xuất tuyến là CUỐI nét vẽ trong trạm: 371 qua cáp Cu 3x240, DCL 371E6.22-7/1A, 7/1B tới
      // "đi lộ 373 E6.6 trục chính"; 373 tới "đi NR Lam Vỹ" (nhãn chắn phía ngoài: cáp đi xuống)
      'ĐZ 371 E6.22': { tu: [-1359.8, 4620.61], ra: 'xuong' },
      'ĐZ 373 E6.22': { tu: [-1150.94, 4642.51], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 371 E6.22': true, 'ĐZ 373 E6.22': true },
    noi_ban_ve: [
      // MC 371E6.6/125 LT 371 E6.22 (thường cắt) vẽ ở bản vẽ 28
      { tu: ['66.json', [705.98, 81.01]], den: ['28.json', [252.5, 211.03]], tu_dong: true },
      // LBS 371E6.22/58 (thường cắt) - đoạn cột 59 - MC 371E6.22/100 do 373 E6.6 cấp (bản vẽ 29)
      { tu: ['66.json', [495.5, 252.2]], den: ['29.json', [310.79, 413.29]], tu_dong: true },
    ],
  },
  {
    json: '67.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 471 E6.22': { tu: [-1644.8, 4556.93], ra: 'xuong' },
      'ĐZ 473 E6.22': { tu: [-1598.26, 4556.93], ra: 'xuong' },
      'ĐZ 472 E6.22': { tu: [-1556.16, 4556.93], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 471 E6.22': true, 'ĐZ 473 E6.22': true, 'ĐZ 472 E6.22': true },
    noi_ban_ve: [
      // MC 472E6.22/143 LT 475 E6.19 (thường cắt) vẽ ở bản vẽ 61
      { tu: ['67.json', [767.21, 483.19]], den: ['61.json', [806.2, 201.58]], tu_dong: true },
    ],
  },
  {
    json: 'bk01.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 371 E26.1': { tu: [227.25, 5986.95], ra: 'xuong' },
      'ĐZ 378 E26.1': { tu: [672.07, 5986.95], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 371 E26.1': true, 'ĐZ 378 E26.1': true },
  },
  {
    json: 'bk02.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 372 E26.1': { tu: [945.28, 5968.75], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 372 E26.1': true },
    nha_may: [
      { p: [356.5, 382.0], huong: 'phai', ten: 'NMTĐ Nặm Cắt', ma: 'A26.2', cs: '2×1,6 MW' },
      { p: [463.5, 501.5], huong: 'phai', ten: 'NMTĐ Khuổi Thốc', ma: 'A26.5', cs: '1×3,0 MW' },
    ],
  },
  {
    json: 'bk03.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 373 E26.1': { tu: [315.12, 5986.95], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 373 E26.1': true },
    nha_may: [{ p: [583.6, 361.7], huong: 'trai', ten: 'NMTĐ Thác Giềng 1', ma: 'A26.3', cs: '1×5,5 MW' }],
  },
  {
    json: 'bk04.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {

    },
    cap_noi: {  },
    noi_ban_ve: [
      { tu: ['bk04.json', [162.26, 439.42]], den: ['bk03.json', [805.82, 232.84]], tu_dong: true },
      { tu: ['bk04.json', [118.4, 382.24]], den: ['bk03.json', [749.18, 419.41]], tu_dong: true },
      { tu: ['bk04.json', [237.89, 305.11]], den: ['bk01.json', [366.48, 459.5]], tu_dong: true },
      { tu: ['bk04.json', [767.9, 439.42]], den: ['29.json', [779.53, 311.99]], tu_dong: true },
    ],
  },
  {
    json: 'bk05.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 374 E26.1': { tu: [854.29, 5986.95], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 374 E26.1': true },
    noi_ban_ve: [
      { tu: ['bk05.json', [370.79, 219.43]], den: ['bk03.json', [576.95, 141.5]], tu_dong: true },
      { tu: ['bk05.json', [494.96, 318.01]], den: ['bk03.json', [642.26, 175.76]], tu_dong: true },
      { tu: ['bk05.json', [678.14, 280.9]], den: ['bk04.json', [505.23, 505.0]], tu_dong: true },
      { tu: ['bk05.json', [704.18, 433.63]], den: ['bk04.json', [540.47, 479.5]], tu_dong: true },
    ],
  },
  {
    json: 'bk06.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 376 E26.1': { tu: [764.27, 5986.95], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 376 E26.1': true },
    noi_ban_ve: [
      { tu: ['bk06.json', [214.1, 302.14]], den: ['bk01.json', [221.05, 90.0]], tu_dong: true },
      { tu: ['bk06.json', [255.26, 343.18]], den: ['bk01.json', [316.05, 186.02]], tu_dong: true },
      { tu: ['bk06.json', [367.13, 352.12]], den: ['bk01.json', [567.41, 88.0]], tu_dong: true },
    ],
  },
  {
    json: 'bk07.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    // bậc thang thừa trước DCL 371E26.2-7/57: xuống thẳng tới hàng ngang rồi rẽ
    nan_diem: [{ tu: [553.26, 328.71], den: [557.39, 330.85], thay: [[541.52, 338.47]] }],
    noi: {
      'ĐZ 371 E26.2': { tu: [-1462.98, 5492.07], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 371 E26.2': true },
    noi_ban_ve: [
      { tu: ['bk07.json', [497.54, 387.88]], den: ['bk02.json', [593.41, 306.1]], tu_dong: true },
      { tu: ['bk07.json', [638.75, 338.47]], den: ['bk03.json', [149.45, 343.98]], tu_dong: true },
    ],
  },
  {
    json: 'bk08.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 373 E26.2': { tu: [-1551.61, 5534.08], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 373 E26.2': true },
  },
  {
    json: 'bk09.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 375 E26.2': { tu: [-1638.23, 5534.08], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 375 E26.2': true },
    noi_ban_ve: [
      { tu: ['bk09.json', [339.23, 384.91]], den: ['bk07.json', [318.5, 267.01]], tu_dong: true },
      { tu: ['bk09.json', [745.43, 274.66]], den: ['bk07.json', [730.0, 152.98]], tu_dong: true },
    ],
  },
  {
    json: 'bk10.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 377 E26.2': { tu: [-1726.5, 5534.08], ra: 'xuong' },
      'ĐZ 379 E26.2': { tu: [-1813.21, 5534.08], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 377 E26.2': true, 'ĐZ 379 E26.2': true },
    noi_ban_ve: [
      { tu: ['bk10.json', [146.6, 283.84]], den: ['bk08.json', [153.17, 160.5]], tu_dong: true },
      { tu: ['bk10.json', [335.0, 311.89]], den: ['bk08.json', [328.93, 149.01]], tu_dong: true },
    ],
  },
  {
    json: 'bk11.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 371 E26.3': { tu: [1747.18, 6491.97], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 371 E26.3': true },
    // NMTĐ Pác Cáp: hai máy cắt đầu cực 371, 373 song song (khép vòng hai đầu)
    nha_may: [{
      p: [101.5, 383.5], huong: 'trai', ten: 'NMTĐ Pác Cáp', ma: 'A26.4', cs: '2×3,0 MW',
      noi: [[[151.64, 374.59], [151.64, 383.77]], [[113.24, 374.59], [113.24, 391.96]]],
    }],
    noi_ban_ve: [
      { tu: ['bk11.json', [667.91, 167.38]], den: ['bk01.json', [718.5, 262.8]], tu_dong: true },
      { tu: ['bk11.json', [212.66, 465.79]], den: ['bk04.json', [117.48, 104.01]], tu_dong: true },
    ],
  },
  {
    json: 'bk12.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 373 E26.3': { tu: [1839.93, 6540.48], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 373 E26.3': true },
    nha_may: [{ p: [713.5, 362.0], huong: 'trai', ten: 'NMTĐ Thượng Ân', ma: 'A26.1', cs: '3×0,8 MW' }],
    noi_ban_ve: [
      { tu: ['bk12.json', [558.26, 173.86]], den: ['bk11.json', [717.5, 327.31]], tu_dong: true },
    ],
  },
  {
    json: 'bk13.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 375 E26.3': { tu: [1931.18, 6540.48], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 375 E26.3': true },
    nha_may: [
      { p: [550.0, 488.5], huong: 'phai', ten: 'NMTĐ Tà Làng', ma: 'A26.0', cs: '2×2,5 MW' },
      // bản vẽ 375 E26.3 ghi "Nặm Cắt 2 - 320" ở cột 42 sau MC 375E26.3/02 Nặm Cắt; tính toán bảo vệ
      // "Nặm cắt 2 (375E26.3)" (Drive: Co so tinh toan/E26.3) xác định đây là nhà máy thuỷ điện
      { p: [405.0, 502.0], huong: 'trai', ten: 'NMTĐ Nặm Cắt 2', cs: 'MBA 320 kVA' },
    ],
    noi_ban_ve: [
      { tu: ['bk13.json', [257.87, 380.56]], den: ['bk06.json', [617.38, 247.5]], tu_dong: true },
      { tu: ['bk13.json', [405.86, 437.56]], den: ['bk06.json', [661.0, 351.94]], tu_dong: true },
      { tu: ['bk13.json', [716.84, 424.6]], den: ['bk08.json', [751.12, 298.49]], tu_dong: true },
      { tu: ['bk13.json', [370.22, 537.28]], den: ['bk07.json', [383.52, 441.95]], tu_dong: true },
    ],
  },
  {
    json: 'bk14.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 473 E26.1': { tu: [430.67, 6172.91], ra: 'xuong' },
      'ĐZ 471 E26.1': { tu: [383.04, 6172.91], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 473 E26.1': true, 'ĐZ 471 E26.1': true },
    noi_ban_ve: [
      { tu: ['bk14.json', [803.13, 349.59]], den: ['bk16.json', [205.3, 254.71]], tu_dong: true },
    ],
  },
  {
    json: 'bk15.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 472 E26.1': { tu: [778.34, 6217.37], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 472 E26.1': true },
    noi_ban_ve: [
      { tu: ['bk15.json', [144.44, 282.25]], den: ['bk14.json', [186.47, 271.82]], tu_dong: true },
      { tu: ['bk15.json', [588.71, 242.56]], den: ['bk14.json', [626.84, 96.5]], tu_dong: true },
      // RMU 20-472 (ngăn 472-7/02 thường cắt) - ngăn 472-7/01 cáp sang RMU 37-474 (bản vẽ 16)
      { tu: ['bk15.json', [169.19, 305.68]], den: ['bk16.json', [127.91, 113.83]], tu_dong: true },
      // RMU 24-472 ngăn 472-7/02 - MC 474/16 (thường cắt) tủ RMU 16-474 (bản vẽ 16)
      { tu: ['bk15.json', [255.23, 470.77]], den: ['bk16.json', [618.62, 335.5]], tu_dong: true },
    ],
  },
  {
    json: 'bk16.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 474 E26.1': { tu: [730.6, 6179.67], ra: 'xuong' },
      'ĐZ 476 E26.1': { tu: [685.71, 6179.67], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 474 E26.1': true, 'ĐZ 476 E26.1': true },
  },
  {
    json: '15.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 476 E6.3': { tu: [-3332.45, -3075.85], ra: 'xuong' },
      'ĐZ 450 E6.3': { tu: [-3396.13, -3070.71], ra: 'xuong' },
      'ĐZ 477 E6.3': { tu: [-3790.66, -3145.26], ra: 'xuong' },
      'ĐZ 480 E6.3': { tu: [-3654.34, -3145.26], ra: 'xuong' },
    },
    cap_noi: { 'ĐZ 476 E6.3': true, 'ĐZ 450 E6.3': true, 'ĐZ 477 E6.3': true, 'ĐZ 480 E6.3': true },
    chu: [{ p: [236, 222], t: 'Tháo lèo cột 06' }, { p: [362, 222], t: 'Tháo lèo cột 13A' }],
    noi_ban_ve: [
      // cột 17 - LBS 476E6.3/02 Vĩnh An (thường cắt) / DCL 473E6.17-7/26: phía 473 E6.17 vẽ ở bản vẽ 65
      { tu: ['15.json', [483.38, 228.37]], den: ['65.json', [744.74, 366.25]], vao: 'len', tu_dong: true },
    ],
  },
  {
    // 451 + 453 E6.17 LT 485 + 486 E6.13 (kèm 475, 477 E6.17 tới RMU 01 và trục 471, 473 E6.17 tới cột 13)
    json: '49.json',
    goc: 'tu_dong',
    ti_le: 1.2,
    noi: {
      'ĐZ 485 E6.13': { tu: [375.28, -5449.4], ra: 'xuong' },
      'ĐZ 486 E6.13': { tu: [527.15, -5448.82], ra: 'xuong' },
      'ĐZ 471 E6.17': { tu: [1112.57, -3127.8], ra: 'xuong' },
      'ĐZ 473 E6.17': { tu: [1530.56, -3127.8], ra: 'xuong' },
      'ĐZ 477 E6.17': { tu: [1244.58, -3127.8], ra: 'xuong' },
      'ĐZ 475 E6.17': { tu: [1812.77, -3127.8], ra: 'xuong' },
      'ĐZ 451 E6.17': { tu: [2037.94, -3127.8], ra: 'xuong' },
      'ĐZ 453 E6.17': { tu: [2076.07, -3127.8], ra: 'xuong' },
    },
    cap_noi: {
      'ĐZ 485 E6.13': true, 'ĐZ 486 E6.13': true, 'ĐZ 471 E6.17': true, 'ĐZ 473 E6.17': true,
      'ĐZ 477 E6.17': true, 'ĐZ 475 E6.17': true, 'ĐZ 451 E6.17': true, 'ĐZ 453 E6.17': true,
    },
    noi_ban_ve: [
      // cột 13: DCL 471E6.17-7/26 (LT 472 E6.3) vẽ ở bản vẽ 13, DCL 473E6.17-7/26 (LT 476 E6.3) vẽ ở bản vẽ 65
      { tu: ['49.json', [419.99, 107.86]], den: ['13.json', [323.93, 263.5]], tu_dong: true },
      { tu: ['49.json', [405.02, 121.21]], den: ['65.json', [786.47, 432.94]], tu_dong: true },
    ],
  },
];
