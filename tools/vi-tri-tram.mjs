/**
 * DỜI CHỖ TRẠM TRÊN TỜ SƠ ĐỒ KẾT DÂY (dùng chung cho tools/doi-cho-tram.mjs, ve-luoi-trung-ap.mjs,
 * smoke test, rà soát).
 *
 * Các trạm có nhiều đường dây trung áp liên thông được dời ra chỗ rộng để các bản vẽ lộ trung áp
 * đặt quanh trạm không chen chúc. Mỗi mục:
 *   chon: hộp [x0, y0, x1, y1] theo toạ độ bản CAD gốc - nét / thiết bị / chữ có tâm nằm trong hộp
 *         là của trạm (ô trạm trong bản CAD vẽ chồng lên nhau, không dùng thẳng được)
 *   doi : độ dời [dx, dy] so với bản CAD gốc (số nguyên)
 * Toạ độ trong bản CAD gốc (vd đầu ngăn lộ khai ở tools/luoi-trung-ap/pdf/dat.mjs) đổi sang vị trí
 * mới bằng doiDiem().
 */
export const DOI_TRAM = {
  'E6.2': { chon: [-1500, 300, -50, 1530], doi: [1200, 1100] },
  'E6.4': { chon: [-2620, -470, -1550, 275], doi: [720, 350] },
  'E6.5': { chon: [-1530, -1380, -300, -470], doi: [1980, -970] },
  'E6.3': { chon: [-4070, -3215, -2990, -2480], doi: [-830, 515] },
  'E6.7': { chon: [-2760, -6350, -1615, -5505], doi: [0, 1300] },
  'E6.17': { chon: [780, -3290, 2240, -2380], doi: [1920, -2110] },
};

const trong = ([x0, y0, x1, y1], x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

/** Trạm (mã) có hộp chọn chứa điểm (x, y) theo toạ độ gốc, hoặc undefined. */
export const tramCuaDiem = (x, y) => Object.keys(DOI_TRAM).find((k) => trong(DOI_TRAM[k].chon, x, y));

/** Làm tròn giống nhau ở mọi nơi để khoá tra theo toạ độ (vong, kvCuon) vẫn khớp. */
export const tron = (v) => Math.round(v * 1000) / 1000;

/** Điểm theo toạ độ bản CAD gốc -> toạ độ trên tờ sau khi dời trạm. */
export function doiDiem(x, y) {
  const k = tramCuaDiem(x, y);
  if (!k) return [x, y];
  const [dx, dy] = DOI_TRAM[k].doi;
  return [tron(x + dx), tron(y + dy)];
}
