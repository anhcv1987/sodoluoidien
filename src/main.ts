import './style.css';
import { App } from './ui/app';
import { ketQuaDoiChu } from './data/tramSheets';

const root = document.getElementById('app');
if (!root) {
  throw new Error('Không tìm thấy phần tử #app');
}

try {
  const app = new App(root);
  // Cho phep go loi nhanh tu Console cua trinh duyet khi can ho tro nguoi dung.
  (window as unknown as Record<string, unknown>).sodo = app;
  // Số nhãn đã dời ra khỏi ký hiệu thiết bị ở từng tờ (xem tools/smoke-test.mjs)
  (window as unknown as Record<string, unknown>).sodoDoiChu = ketQuaDoiChu;
} catch (err) {
  root.innerHTML = `<div style="padding:24px;font-family:system-ui;color:#e5e9f0">
    <h2>Phần mềm không khởi động được</h2>
    <p>${(err as Error).message}</p>
    <p>Vui lòng dùng trình duyệt Microsoft Edge hoặc Google Chrome phiên bản mới.</p>
  </div>`;
  throw err;
}
