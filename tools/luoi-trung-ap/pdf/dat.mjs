/**
 * Các bản vẽ PDF lộ trung áp đặt lên tờ sơ đồ tổng (đọc bởi tools/ve-luoi-trung-ap.mjs).
 *   json    : hình học xuất từ tools/pdf-lo/xuat.py
 *   goc_pdf : điểm gốc trên PDF (pt) ứng với điểm `goc` trên tờ tổng; ti_le: đơn vị tờ tổng / pt
 *   noi     : tuyến cáp/dây nối từ ngăn lộ trong trạm tới điểm đầu lộ trên bản vẽ (điểm cuối tự thêm)
 * Tuyến nối đi cách các nét có sẵn >= 8 đơn vị (sai số bắt điểm ~3) để khỏi thành chỗ đấu chữ T;
 * chỗ cắt ngang tự vẽ vòng nhảy.
 */
export default [
  {
    json: '17.json',
    goc_pdf: [76, 129],
    goc: [-2370, -650],
    ti_le: 1.2,
    noi: {
      'ĐZ 473 E6.4': [[-2106, -389.2], [-2106, -435], [-2400, -435], [-2400, -1016.13]],
      'ĐZ 471 E6.4': [[-2181.4, -389.2], [-2181.4, -445], [-2410, -445], [-2410, -1035.36]],
      'ĐZ 481 E6.4': [[-2558.8, -389.2], [-2558.8, -405], [-2420, -405], [-2420, -758.48]],
    },
    cap_noi: { 'ĐZ 473 E6.4': true, 'ĐZ 471 E6.4': true, 'ĐZ 481 E6.4': true },
    // đầu dây liên thông sang lộ chưa vẽ (toạ độ PDF)
    chu: [
      { p: [795, 295.9], t: '→ LT 473 E6.3' },
      { p: [637.6, 423.3], t: '→ LT 471 E6.19' },
      { p: [745, 131], t: '→ TĐ Hồ Núi Cốc (A6.10)' },
    ],
  },
  {
    // bản vẽ 18: 472 + 477 E6.4 và 471 E6.2 (liên thông), giữa E6.4 và E6.2
    json: '18.json',
    goc_pdf: [250.91, 148.12],
    goc: [-1301, 215],
    ti_le: 1.2,
    noi: {
      // 477: xuống dưới hàng ngăn lộ E6.4 (dưới cáp liên lạc 412 y=-421, trên cáp 473 y=-435,
      // tránh MBA tự dùng TD41/TD42 ở y≈-403), sang phải tới mép trạm, lên đầu lộ
      'ĐZ 477 E6.4': [[-2141.4, -389.2], [-2141.4, -428], [-1550, -428], [-1550, 91.7]],
      // 472: vào đầu lộ từ phía phải (ngăn lộ trên bản vẽ nằm bên phải cáp đầu lộ)
      'ĐZ 472 E6.4': [[-1913.8, -389.23], [-1913.8, -442], [-1340, -442], [-1340, -238.7]],
      // 471 E6.2: thẳng xuống từ ngăn lộ C43 E6.2
      'ĐZ 471 E6.2': [[-1399.01, 499.32], [-1399.01, 215]],
    },
    cap_noi: { 'ĐZ 477 E6.4': true, 'ĐZ 472 E6.4': true, 'ĐZ 471 E6.2': true },
  },
  // ---------------- bản vẽ 20-23: đặt trong khoảng trống dưới E6.4/E6.5 ----------------
  // Cáp các ngăn lộ E6.4 đi dọc dưới hàng ngăn lộ (y -448 .. -470, trên đường 110kV y=-475),
  // xuống hành lang phía phải E6.5 (x -300 .. -276), sang trái trên các bản vẽ (y -1396 .. -1420),
  // xuống hành lang trái (x -1430 .. -1406) rồi vào đầu lộ. Lộ nào xuống sâu hơn thì đi ngoài.
  {
    json: '20.json',
    goc_pdf: [58, 77],
    goc: [-1370, -1450],
    ti_le: 1.2,
    noi: {
      'ĐZ 474 E6.4': [[-1875.05, -389.2], [-1875.05, -459], [-276, -459], [-276, -1420], [-1406, -1420], [-1406, -1571.49]],
    },
    cap_noi: { 'ĐZ 474 E6.4': true },
    chu: [
      { p: [730, 486.7], t: 'LT 478 E6.4 ←', canh: 'phai' },
      { p: [806, 196], t: '↓ LT 478 E6.4 (Lộ 478 E6.4 đến)' },
      { p: [414.5, 200], t: '→ LT 472 E6.2' },
      { p: [239, 173], t: '↑ RMU 34-472 E6.2 (ngăn 472-7/34-2 thường cắt)', canh: 'giua' },
      { p: [449.5, 437.5], t: '→ LT 478 E6.4 (Đầm Xanh)' },
    ],
    // chỗ liên thông với bản vẽ 18 (472 E6.4): ngăn 472-7/02-2 tủ RMU 02-472 LT 474, DCL 472E6.2-7/36
    noi_ban_ve: [
      { tu: ['20.json', [173.36, 119.41]], den: ['18.json', [474.25, 512.47]], qua: [[-1231.57, -1440], [-270, -1440], [-270, -430], [-1032.5, -430]], cap: true },
      { tu: ['20.json', [293.18, 77.26]], den: ['18.json', [640.8, 408.26]], qua: [[-1087.78, -1446], [-264, -1446], [-264, -424], [-833.1, -424]] },
    ],
  },
  {
    json: '22.json',
    goc_pdf: [100, 174],
    goc: [-1370, -1990],
    ti_le: 1.2,
    noi: {
      'ĐZ 476 E6.4': [[-1782.55, -389.2], [-1782.55, -453.5], [-282, -453.5], [-282, -1414], [-1412, -1414], [-1412, -2050.24]],
      // 475 E6.2: từ ngăn lộ C43 E6.2 xuống y=290 (dưới trạm E6.2, trên 473E6.2), sang phải tới x=-560,
      // xuống y=-300 (dưới bản vẽ 18), sang hành lang x=-258 (trái thanh cái An Khánh), xuống dưới
      // bản vẽ 22 rồi vào đầu lộ (ngăn lộ trên bản vẽ ở phía dưới)
      'ĐZ 475 E6.2': [[-1476.25, 499.32], [-1476.25, 290], [-560, 290], [-560, -300], [-258, -300], [-258, -2385], [-982.8, -2385]],
    },
    cap_noi: { 'ĐZ 476 E6.4': true, 'ĐZ 475 E6.2': true },
    // liên thông: MC 472E6.4/73 (vẽ ở bản vẽ 18, 471 E6.2), LBS 476E6.4/39 (vẽ ở nhánh cột 65 ĐZ 473 E6.2)
    noi_ban_ve: [
      { tu: ['22.json', [403, 206.67]], den: ['18.json', [471.6, 211.48]], qua: [[-1006.4, -1965], [-246, -1965], [-246, -288], [-574, -288], [-574, 139]] },
    ],
  },
  {
    json: '21.json',
    goc_pdf: [92, 190],
    goc: [-1370, -2410],
    ti_le: 1.2,
    noi: {
      'ĐZ 475 E6.4': [[-2257.16, -389.2], [-2257.16, -464.5], [-288, -464.5], [-288, -1408], [-1418, -1408], [-1418, -2575.64]],
    },
    cap_noi: { 'ĐZ 475 E6.4': true },
    chu: [
      { p: [744, 406.5], t: '→ LT 471 E6.5' },
    ],
    // liên thông với bản vẽ 23: DCL 478E6.4-7/01 LT 475 (478 E6.4), ngăn 480-7/02-2 tủ RMU 02-480
    noi_ban_ve: [
      { tu: ['21.json', [133.06, 266.77]], den: ['23.json', [136.1, 194.75]], qua: [[-1320.73, -2494], [-1450, -2494], [-1450, -2898.1]] },
      { tu: ['21.json', [311.62, 454.77]], den: ['23.json', [217.31, 293.53]], qua: [[-1106.46, -2778], [-1455, -2778], [-1455, -3032], [-1219.63, -3032]], cap: true },
    ],
  },
  {
    json: '23.json',
    goc_pdf: [92, 113],
    goc: [-1370, -2800],
    ti_le: 1.2,
    noi: {
      'ĐZ 478 E6.4': [[-2328.57, -389.2], [-2328.57, -470], [-294, -470], [-294, -1402], [-1424, -1402], [-1424, -2882.25]],
      'ĐZ 480 E6.4': [[-1744.48, -389.2], [-1744.48, -448], [-300, -448], [-300, -1396], [-1430, -1396], [-1430, -3018.69]],
    },
    cap_noi: { 'ĐZ 478 E6.4': true, 'ĐZ 480 E6.4': true },
    // đoạn cột 61A - 79 (sau MC 478E6.4/61 thường cắt) do 471 E6.5 cấp (bản vẽ 24: nhánh Phú Xá -
    // MC 475E6.5/01 - cột 27 - DCL 475E6.5-7/42 - LBS 478E6.4/82): vẽ như lộ, đầu lộ ở đầu dây ĐZ 475 E6.5
  },
  // ---------------- cụm E6.5: đặt và đi cáp tự động (tools/pdf-lo/tim-duong.mjs) ----------------
  {
    json: '24.json',
    goc_pdf: [98.9, 116.3],
    goc: [304, -1415],
    ti_le: 1.2,
    noi: { 'ĐZ 471 E6.5': { tu: [-836.25, -1307.72], ra: 'xuong', vao: 'phai' } },
    cap_noi: { 'ĐZ 471 E6.5': true },
    noi_ban_ve: [
      // cột 27 -> DCL 475E6.5-7/42 - LBS 478E6.4/82: đoạn cột 61A - 79 vẽ ở bản vẽ 23
      { tu: ['24.json', [299.85, 432.58]], den: ['23.json', [768, 411.9]], tu_dong: true, ra: 'phai' },
      // MC 471E6.5/48 (thường cắt) vẽ ở bản vẽ 21 (phía 475 E6.4)
      { tu: ['24.json', [480, 116.46]], den: ['21.json', [742.02, 404.45]], tu_dong: true, ra: 'phai' },
    ],
  },
  {
    json: '25.json',
    goc_pdf: [92.5, 38.1],
    goc: [644, -1695],
    ti_le: 1.2,
    noi: { 'ĐZ 473 E6.5': { tu: [-1256.9, -1336.06], ra: 'xuong', vao: 'tren' } },
    cap_noi: { 'ĐZ 473 E6.5': true },
    // đoạn sau MC 474E6.17/37 (LT 473 E6.5) do 474 E6.17 cấp: nối về E6.17 khi làm cụm E6.17
    chu: [
      { p: [527, 93], t: '↑ LT 477 E6.21' },
      { p: [421, 47.1], t: '474 E6.17 ←', canh: 'phai' },
      { p: [618, 219], t: '→ ĐZ 481 E6.17' },
    ],
  },
  {
    json: '26.json',
    goc_pdf: [99, 130.8],
    goc: [804, -1135],
    ti_le: 1.1,
    noi: {
      'ĐZ 475 E6.5': { tu: [-951.2, -1312.46], ra: 'xuong', vao: 'trai' },
      'ĐZ 472 E6.5': { tu: [-1338.5, -1336.06], ra: 'xuong', vao: 'trai' },
      'ĐZ 481 E6.9': { tu: [421.97, -489.15], ra: 'xuong', vao: 'tren' },
    },
    cap_noi: { 'ĐZ 475 E6.5': true, 'ĐZ 472 E6.5': true, 'ĐZ 481 E6.9': true },
    chu: [{ p: [742, 214], t: 'ĐZ 478 E6.4 ←', canh: 'phai' }],
    noi_ban_ve: [
      // đoạn cột 27 - MC 475E6.5/1A Cầu Loàng do 471 E6.5 cấp qua MC 475E6.5/01 (bản vẽ 24)
      { tu: ['26.json', [435.65, 130.78]], den: ['24.json', [299.85, 432.58]], tu_dong: true, ra: 'tren' },
      // LBS 28, 61, 93 (473 E6.5) vẽ ở bản vẽ 25
      { tu: ['26.json', [315.62, 414.58]], den: ['25.json', [320.26, 409.46]], tu_dong: true },
      { tu: ['26.json', [207.77, 479.38]], den: ['25.json', [553.64, 305.27]], tu_dong: true },
      { tu: ['26.json', [174.53, 495.04]], den: ['25.json', [726.65, 268.24]], tu_dong: true },
    ],
  },
  {
    json: '27.json',
    goc_pdf: [99.1, 181.5],
    goc: [1324, -1595],
    ti_le: 1.1,
    noi: { 'ĐZ 477 E6.5': { tu: [-748.05, -1307.72], ra: 'xuong', vao: 'trai' } },
    cap_noi: { 'ĐZ 477 E6.5': true },
    // LBS 477E6.5/115 (thường cắt) vẽ ở bản vẽ 17 (phía 473 E6.4); nhánh 471 E6.5 - cột 84/85 - 475 E6.4
    // (LBS 471E6.5/83, DCL 471E6.5-7/84, DCL 475E6.4-7/30) thuộc phần MC 471E6.5/48 ở bản vẽ 21/24
    noi_ban_ve: [
      { tu: ['27.json', [567.2, 181.51]], den: ['17.json', [703.56, 374.82]], tu_dong: true, ra: 'phai' },
    ],
  },
  // ---------------- cụm E6.2 ----------------
  {
    // 472 E6.2 (bản vẽ 6): chỉ trục ngăn lộ C44 - cột 36; sau cột 36 (38 - 43 - RMU 34, Trung Tâm)
    // đã vẽ ở bản vẽ 20 (474 E6.4), nhánh cột 21 - RMU Công An tỉnh và DCL 472E6.2-7/36 ở bản vẽ 18
    json: '06.json',
    goc_pdf: [131.75, 124],
    goc: [-737.51, 470],
    ti_le: 1.2,
    noi: { 'ĐZ 472 E6.2': [[-737.51, 499.54], [-737.51, 470]] },
    noi_ban_ve: [
      { tu: ['06.json', [131.75, 200.83]], den: ['18.json', [585.11, 336.16]], tu_dong: true, ra: 'trai' },
      { tu: ['06.json', [131.75, 248.85]], den: ['18.json', [640.8, 408.26]], tu_dong: true, ra: 'xuong' },
    ],
  },
  {
    // 473 E6.2 (bản vẽ 7, thay lộ thí điểm 473E6.2.mjs): MC 472E6.4/61 (thường cắt) vẽ ở bản vẽ 18;
    // LBS 476E6.4/39 (thường cắt) vẽ ở đây, phía kia là bản vẽ 22 (476 E6.4)
    json: '07.json',
    goc_pdf: [74.27, 380.86],
    // trục đặt ở y = 304: dưới cáp trong trạm E6.2 (y = 317,55), trên cáp 475 E6.2 (y = 290)
    goc: [-1437.4, 304],
    ti_le: 0.75,
    noi: { 'ĐZ 473 E6.2': [[-1437.4, 499.32], [-1437.4, 304]] },
    cap_noi: { 'ĐZ 473 E6.2': true },
    giao: [{ p: [480, 380.86], t: 'Giao chéo 376 TCCN', kv: 35, dai: 7 }],
    noi_ban_ve: [
      { tu: ['07.json', [572.57, 380.86]], den: ['18.json', [783.25, 146.19]], tu_dong: true, ra: 'phai' },
      { tu: ['07.json', [447.39, 485.4]], den: ['22.json', [559.76, 475.29]], tu_dong: true, ra: 'phai' },
    ],
  },
  {
    // 474 E6.2 (bản vẽ 8): đặt bên phải trạm E6.2 (giữa đường 110kV x = -540 và x = -150).
    // MC 474E6.2/07 LT 476 E6.4 (thường cắt) vẽ ở bản vẽ 22; DCL 474E6.2-7/02 Toàn Thắng (thường
    // cắt) - phía bên kia là ĐZ 471 E6.6 (nối khi vẽ cụm E6.6)
    json: '08.json',
    goc_pdf: [86, 143],
    goc: [-530, 500],
    ti_le: 0.75,
    noi: { 'ĐZ 474 E6.2': { tu: [-698.29, 499.54], ra: 'xuong', vao: 'tren' } },
    cap_noi: { 'ĐZ 474 E6.2': true },
    chu: [{ p: [484, 424], t: '↓ LT 471 E6.6', canh: 'trai' }],
    noi_ban_ve: [
      { tu: ['08.json', [86.69, 143.2]], den: ['22.json', [699.58, 173.82]], tu_dong: true, ra: 'trai' },
    ],
  },
];
