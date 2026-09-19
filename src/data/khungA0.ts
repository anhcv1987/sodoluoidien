import { newId } from '../core/doc';
import type { BoundaryEntity, Entity, TextEntity } from '../core/types';

/**
 * KHUNG BẢN VẼ KHỔ A0 + KHUNG TÊN cho tờ sơ đồ kết dây.
 *
 * Khổ A0 theo TCVN 7285 (ISO 5457): 841 x 1189 mm, lề trái 20mm để đóng tập,
 * ba lề còn lại 10mm. Khung tên đặt ở góc dưới bên phải, trong khung bản vẽ.
 *
 * Bản vẽ gốc dùng đơn vị riêng của CAD nên khung được quy đổi theo tỷ lệ sao cho
 * toàn bộ nội dung nằm gọn trong vùng vẽ, rồi đặt trùng tâm với nội dung.
 */

const A0_RONG = 841;
const A0_CAO = 1189;
const LE_TRAI = 20;
const LE_KHAC = 10;
/** Khung tên: rộng x cao (mm). */
const KT_RONG = 300;
const KT_CAO = 120;

export interface HopBao {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ThongTinKhung {
  tenBanVe: string;
  donVi: string;
  phong: string;
  nguoiLap?: string;
  ngay?: string;
}

/**
 * Sinh các đối tượng khung A0 bao quanh `noiDung`.
 *
 * Tỷ lệ được chọn để nội dung vừa trong vùng vẽ (đã trừ lề và chừa chỗ khung tên),
 * nên khung luôn bao trọn sơ đồ dù bản vẽ gốc to nhỏ thế nào.
 */
export function taoKhungA0(noiDung: HopBao, tt: ThongTinKhung): Entity[] {
  const wND = Math.max(noiDung.maxX - noiDung.minX, 1e-6);
  const hND = Math.max(noiDung.maxY - noiDung.minY, 1e-6);

  // Vùng vẽ bên trong khung (mm), chừa thêm một dải cho khung tên phía dưới
  const veRong = A0_RONG - LE_TRAI - LE_KHAC;
  const veCao = A0_CAO - 2 * LE_KHAC;
  const chuaRong = veRong - 16;
  const chuaCao = veCao - KT_CAO - 16;

  // Số đơn vị bản vẽ trên 1 mm giấy
  const dvTrenMm = Math.max(wND / chuaRong, hND / chuaCao);
  const mm = (v: number): number => v * dvTrenMm;

  const cx = (noiDung.minX + noiDung.maxX) / 2;
  const cy = (noiDung.minY + noiDung.maxY) / 2;

  // Mép ngoài tờ giấy
  const x0 = cx - mm(A0_RONG) / 2;
  const y0 = cy - mm(A0_CAO) / 2;
  const x1 = x0 + mm(A0_RONG);
  const y1 = y0 + mm(A0_CAO);
  // Khung bản vẽ (trong lề)
  const bx0 = x0 + mm(LE_TRAI);
  const by0 = y0 + mm(LE_KHAC);
  const bx1 = x1 - mm(LE_KHAC);
  const by1 = y1 - mm(LE_KHAC);

  const out: Entity[] = [];
  const LAYER = 'Khung bản vẽ';

  const hcn = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    ten: string,
  ): BoundaryEntity => ({
    id: newId('kh'),
    kind: 'boundary',
    layer: LAYER,
    kv: 0.4,
    pts: [
      { x: ax, y: ay },
      { x: bx, y: ay },
      { x: bx, y: by },
      { x: ax, y: by },
    ],
    closed: true,
    dashed: false,
    name: ten,
  });

  out.push(hcn(x0, y0, x1, y1, 'Mép tờ giấy A0'));
  out.push(hcn(bx0, by0, bx1, by1, 'Khung bản vẽ'));

  // Khung tên góc dưới phải
  const kx1 = bx1;
  const ky0 = by0;
  const kx0 = kx1 - mm(KT_RONG);
  const ky1 = ky0 + mm(KT_CAO);
  out.push(hcn(kx0, ky0, kx1, ky1, 'Khung tên'));
  // Hai đường kẻ ngang chia khung tên
  for (const f of [0.42, 0.7]) {
    out.push({
      id: newId('kh'),
      kind: 'boundary',
      layer: LAYER,
      kv: 0.4,
      pts: [
        { x: kx0, y: ky0 + mm(KT_CAO) * f },
        { x: kx1, y: ky0 + mm(KT_CAO) * f },
      ],
      closed: false,
      dashed: false,
      name: 'Kẻ khung tên',
    });
  }

  const chu = (
    x: number,
    y: number,
    text: string,
    caoMm: number,
    align: TextEntity['align'] = 'center',
  ): TextEntity => ({
    id: newId('kt'),
    kind: 'text',
    layer: LAYER,
    kv: 0.4,
    p: { x, y },
    text,
    height: mm(caoMm),
    rot: 0,
    align,
  });

  const gx = (kx0 + kx1) / 2;
  out.push(chu(gx, ky0 + mm(KT_CAO * 0.86), tt.donVi, 6));
  out.push(chu(gx, ky0 + mm(KT_CAO * 0.74), tt.phong, 7));
  out.push(chu(gx, ky0 + mm(KT_CAO * 0.5), tt.tenBanVe, 9));
  out.push(
    chu(
      gx,
      ky0 + mm(KT_CAO * 0.28),
      `Khổ giấy A0 (841 x 1189)${tt.ngay ? '   ·   Ngày lập: ' + tt.ngay : ''}`,
      5,
    ),
  );
  if (tt.nguoiLap) out.push(chu(gx, ky0 + mm(KT_CAO * 0.14), `Người lập: ${tt.nguoiLap}`, 5));

  // Tiêu đề lớn phía trên khung bản vẽ
  out.push(chu((bx0 + bx1) / 2, by1 - mm(22), tt.tenBanVe, 14));

  return out;
}
