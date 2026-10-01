/**
 * LUỒNG NỀN dựng mô hình chiều công suất / đồ thị nối thông của một tờ sơ đồ.
 *
 * Tờ sơ đồ tổng mất ~1,3 s để dựng; chạy ở đây thì giao diện không bị đứng (lần click đầu
 * tô sáng vùng nối thông, đổi trạng thái thiết bị...). Nhận danh sách đối tượng của tờ,
 * trả về DongCongSuat (dữ liệu thuần: số, mã, toạ độ).
 */
import { tinhDongCongSuat } from './dongCongSuat';
import type { Entity, Pt } from './types';

interface YeuCau {
  sheet: string;
  rev: number;
  entities: Entity[];
}

self.onmessage = (ev: MessageEvent<YeuCau>): void => {
  const { sheet, rev, entities } = ev.data;
  const t0 = performance.now();
  const theoId = new Map(entities.map((e) => [e.id, e]));
  const d = tinhDongCongSuat(entities, (id) => {
    const e = theoId.get(id);
    return e && 'p' in e ? (e.p as Pt) : undefined;
  });
  (self as unknown as Worker).postMessage({ sheet, rev, d, ms: performance.now() - t0 });
};
