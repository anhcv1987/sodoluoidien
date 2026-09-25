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
      { p: [705.5, 376.3], t: '→ LT 477 E6.5' },
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
    chu: [
      { p: [474.65, 517], t: '↓ LT 474 E6.4 (DCL 474E6.4-7/01)', canh: 'giua' },
      { p: [642.6, 409.8], t: '→ LT 472 E6.2 (DCL 34 Bảo Tàng)' },
      { p: [473.4, 213], t: '→ LT 476 E6.4' },
      { p: [587, 337.7], t: '→ LT 472 E6.2' },
    ],
  },
];
