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
  },
];
