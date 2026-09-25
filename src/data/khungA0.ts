import { newId } from '../core/doc';
import type { BoundaryEntity, DeviceEntity, Entity, SwitchState, TextEntity } from '../core/types';

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
export function taoKhungA0(noiDung: HopBao, tt: ThongTinKhung, trong?: (h: HopBao) => boolean): Entity[] {
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

  /* --- Chú giải trạng thái thiết bị đóng cắt, bên trái khung tên --- */
  {
    const CG_RONG = 200;
    const CG_CAO = KT_CAO;
    // Chọn chỗ trống trong khung bản vẽ: góc trên phải (dưới tiêu đề), góc trên trái,
    // bên trái khung tên, góc dưới trái. Không có chỗ nào trống thì đặt cạnh khung tên.
    const ung: [number, number][] = [
      [bx1 - mm(6 + CG_RONG), by1 - mm(34 + CG_CAO)],
      [bx0 + mm(6), by1 - mm(34 + CG_CAO)],
      [kx0 - mm(6 + CG_RONG), ky0],
      [bx0 + mm(6), by0 + mm(6)],
    ];
    const hop = (x: number, y: number): HopBao => ({ minX: x, minY: y, maxX: x + mm(CG_RONG), maxY: y + mm(CG_CAO) });
    const le = mm(4);
    const cho =
      ung.find(([x, y]) => {
        const h = hop(x, y);
        return !trong || trong({ minX: h.minX - le, minY: h.minY - le, maxX: h.maxX + le, maxY: h.maxY + le });
      }) ?? ung[2];
    const gx0 = cho[0];
    const gx1 = gx0 + mm(CG_RONG);
    const gy0 = cho[1];
    const gy1 = gy0 + mm(CG_CAO);
    out.push(hcn(gx0, gy0, gx1, gy1, 'Chú giải trạng thái'));
    const doan = (ax: number, ay: number, bx: number, by: number): BoundaryEntity => ({
      id: newId('kh'),
      kind: 'boundary',
      layer: LAYER,
      kv: 0.4,
      pts: [
        { x: ax, y: ay },
        { x: bx, y: by },
      ],
      closed: false,
      dashed: false,
      name: 'Chú giải trạng thái',
    });
    const tb = (block: string, x: number, y: number, rot: number, scale: number, state: SwitchState): DeviceEntity => ({
      id: newId('kh'),
      kind: 'device',
      layer: LAYER,
      kv: 110,
      block,
      p: { x, y },
      rot,
      scale,
      state,
    });
    out.push(chu((gx0 + gx1) / 2, gy1 - mm(9), 'CHÚ GIẢI TRẠNG THÁI THIẾT BỊ', 5.5));
    // cột: tên thiết bị | Đóng | Cắt | Chưa rõ
    const cot = [gx0 + mm(62), gx0 + mm(107), gx0 + mm(152)];
    const yDau = gy1 - mm(17);
    out.push(doan(gx0, yDau - mm(3), gx1, yDau - mm(3)));
    ['Đóng', 'Cắt', 'Chưa rõ'].forEach((t, i) => out.push(chu(cot[i] + mm(12), yDau, t, 4.2)));
    const hang = mm(21);
    const dong = [
      { ten: 'Máy cắt', block: 'MC' },
      { ten: 'Máy cắt hợp bộ', block: 'MCHB' },
      { ten: 'Dao cách ly', block: 'DCL' },
      { ten: 'Dao tiếp địa', block: 'DTD' },
    ];
    dong.forEach((d, i) => {
      const yc = yDau - mm(3) - hang * (i + 0.5);
      out.push(chu(gx0 + mm(6), yc - mm(1.6), d.ten, 4.2, 'left'));
      (['dong', 'mo', 'khong-xac-dinh'] as SwitchState[]).forEach((st, j) => {
        const xc = cot[j] + mm(12);
        const L = mm(8.5); // nửa chiều dài đoạn dây hai bên ký hiệu
        if (d.block === 'MC') {
          const S = mm(8);
          out.push(doan(xc, yc - L, xc, yc - S / 2), doan(xc, yc + S / 2, xc, yc + L));
          out.push(tb('MC', xc, yc, 0, S, st));
        } else if (d.block === 'MCHB') {
          out.push(tb('MCHB', xc, yc, 0, mm(17) / 3.3033, st));
        } else if (d.block === 'DCL') {
          const S = mm(14);
          const nua = st === 'mo' ? 0.5356 * S : 0;
          if (nua) out.push(doan(xc, yc - L, xc, yc - nua), doan(xc, yc + nua, xc, yc + L));
          else out.push(doan(xc, yc - L, xc, yc + L));
          out.push(tb('DCL', xc, yc, -90, S, st));
        } else {
          // dao tiếp địa nằm ngang, đầu nối vào đoạn dây dọc bên phải
          const S = mm(17) / 1.04;
          const xd = xc + mm(8.5);
          out.push(doan(xd, yc - mm(6), xd, yc + mm(6)));
          out.push(tb('DTD', xd - 0.52 * S, yc, 270, S, st));
        }
      });
    });
    out.push(chu(gx0 + mm(6), gy0 + mm(4), 'Nhấn đúp hoặc chuột phải vào thiết bị để đổi trạng thái (tài khoản biên tập).', 3.4, 'left'));
  }

  // Tiêu đề lớn phía trên khung bản vẽ
  out.push(chu((bx0 + bx1) / 2, by1 - mm(22), tt.tenBanVe, 14));

  return out;
}
