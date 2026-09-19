# Phần mềm vẽ sơ đồ nguyên lý một sợi lưới điện tỉnh Thái Nguyên

Công cụ vẽ sơ đồ một sợi (single-line diagram) lưới điện 220/110kV và trung áp của
tỉnh Thái Nguyên sau sáp nhập, dùng cho công tác điều độ tại **Phòng Điều độ –
Công ty Điện lực Thái Nguyên (EVNNPC)**.

Phần mềm chạy hoàn toàn trong trình duyệt, không cần cài đặt, không cần mạng.

---

## 1. Chạy phần mềm

### Cách nhanh nhất (không cần cài gì)

Mở file **`dist/index.html`** bằng Microsoft Edge hoặc Google Chrome (nhấn đúp chuột).
Toàn bộ phần mềm nằm gọn trong một file HTML duy nhất — có thể chép vào USB, gửi
qua email hoặc đặt trên thư mục dùng chung của phòng.

### Khi cần sửa mã nguồn

```bash
npm install
npm run dev          # mở http://localhost:5173
npm run build        # tạo lại dist/index.html
npm run typecheck    # kiểm tra kiểu dữ liệu
```

Kiểm thử tự động bằng trình duyệt thật (tuỳ chọn):

```bash
npm i -D playwright && npx playwright install chromium
npm run build && node tools/smoke-test.mjs anh-kiem-thu.png
```

---

## 2. Quy ước màu theo cấp điện áp

| Cấp điện áp | Màu | | Cấp điện áp | Màu |
|---|---|---|---|---|
| **110kV** | **Đỏ** | | 10kV | Cam |
| **35kV** | **Vàng** | | 6kV | Lục |
| **22kV** | **Xanh** | | 0,4kV | Xám |
| 220kV | Tím | | 500kV | Hồng |

Nét vẽ: đường dây trên không (ĐDK) nét liền · cáp ngầm nét đứt · cáp vặn xoắn nét
gạch-chấm · thanh cái nét đậm. Đường dây do phần mềm tạo sẵn ở mức **sơ bộ** cũng
vẽ nét đứt để dễ nhận ra khi rà soát.

Mỗi cấp điện áp là một lớp (layer) riêng, bật/tắt và khoá được trong bảng **Lớp**.

---

## 3. Thư viện ký hiệu thiết bị

22 ký hiệu, **lấy đúng hình học từ file CAD gốc** của Phòng Điều độ
(`Sơ đồ lưới điện liên thông tỉnh Thái Nguyên.dwg`) — tỷ lệ giữa các thiết bị giữ
nguyên như bản vẽ CAD:

| Nhóm | Ký hiệu |
|---|---|
| Đóng cắt | Máy cắt · Máy cắt hợp bộ · Dao cách ly (đóng/mở) · Dao cách ly hợp bộ · Dao tiếp địa · Tiếp địa trực tiếp · Recloser · LBS · FCO |
| Đo lường – Bảo vệ | TI · TU · TU thanh cái 3 pha · Chống sét van · Bộ đo đếm |
| Máy biến áp – Bù | MBA 3 cuộn (110/35/22) · MBA 2 cuộn · MBA phân phối · Tụ bù · Kháng điện · SVC |
| Khác | Vị trí cột · Đầu cáp |

Bảng đối chiếu hình học gốc lưu tại `docs/cad-blocks-goc.txt`. Mỗi ký hiệu đều ghi
rõ nguồn gốc (block CAD nào, hoặc "vẽ theo quy ước EVN") trong bảng thuộc tính.

Máy cắt đang **đóng** được tô đặc, đang **mở** để rỗng — thuận cho thao tác điều độ.

---

## 4. Thao tác kiểu CAD

| Thao tác | Cách làm |
|---|---|
| Phóng to / thu nhỏ | Lăn chuột (giữ nguyên điểm dưới con trỏ) |
| Di chuyển màn hình | Giữ chuột giữa và kéo |
| Kết thúc lệnh | Chuột phải hoặc `Esc`; kết thúc tuyến bằng `Enter` |
| Chọn trọn trong khung | Kéo khung từ **trái sang phải** (khung xanh dương) |
| Chọn cả vật cắt qua khung | Kéo khung từ **phải sang trái** (khung xanh lá, nét đứt) |

Phím tắt: `S` Chọn · `L` Đường dây · `B` Thanh cái · `D` Thiết bị · `T` Trạm ·
`G` Ghi chú · `M` Đo · `R` xoay 90° khi đang đặt thiết bị ·
`F3` bắt điểm · `F7` hiện lưới · `F8` ORTHO · `F9` bắt lưới ·
`Ctrl+Z`/`Ctrl+Y` hoàn tác/làm lại · `Ctrl+A` chọn tất cả · `Ctrl+S` lưu ·
`Home` vừa màn hình · phím mũi tên dịch đối tượng đang chọn.

Bắt điểm (osnap) nhận: điểm cuối · đỉnh · trung điểm · nút · tâm thiết bị ·
tâm trạm · điểm gần nhất trên tuyến. Đặt thiết bị lên tuyến thì thiết bị **tự xoay
theo hướng tuyến**.

---

## 5. Sơ đồ tỉnh có sẵn

Khi mở lần đầu, phần mềm dựng sẵn sơ đồ lưới 220/110kV toàn tỉnh: 28 trạm/nút
nguồn (26 trong tỉnh + 220kV Tuyên Quang và 220kV Sóc Sơn để thể hiện liên kết),
ranh giới tỉnh sơ hoạ, địa danh tham chiếu và 29 đường dây 110/220kV.

**Mức độ tin cậy của dữ liệu — cần đọc kỹ:**

| Dữ liệu | Nguồn | Tin cậy |
|---|---|---|
| Tên trạm, mã trạm (E6.x, E26.x), công suất MBA | Trích xuất trực tiếp từ file CAD của Phòng Điều độ | **Cao** |
| Toạ độ địa lý từng trạm | Người lập trình ước lượng theo địa danh | **Cần rà soát** |
| Kết lưới 110/220kV (đấu nối giữa các trạm) | Suy luận sơ bộ | **Cần rà soát** |
| Ranh giới tỉnh | Đường bao sơ hoạ | Chỉ để định hướng |

Toàn bộ đường dây tạo sẵn đều mang ghi chú *"Kết lưới sơ bộ – cần rà soát"*, vẽ
nét đứt và hiện cảnh báo trong bảng thuộc tính. Sau khi đối chiếu hồ sơ quản lý
vận hành, xoá dòng ghi chú đó để đường dây chuyển sang nét liền.

Sửa nhanh:

* **Kéo thả trạm** trên màn hình, hoặc nhập lại **vĩ độ/kinh độ** trong bảng thuộc tính.
* **Dữ liệu → Giãn các trạm chồng lấn**: đẩy các khối trạm nằm sát nhau (khu Lưu Xá –
  Gang Thép, KCN Yên Bình…) ra vừa đủ để đọc được nhãn, vẫn giữ lệch tối đa 7 km so
  với vị trí thật.
* **Dữ liệu → Đưa trạm về đúng toạ độ địa lý**: trả lại đúng vị trí đã khai báo.
* **Dữ liệu → Xoá toàn bộ đường dây sơ bộ**: xoá sạch để tự vẽ lại theo hồ sơ.
* **Dữ liệu → Bảng trạm / Bảng đường dây**: xem dạng bảng, xuất ra `.csv` cho Excel.

Dữ liệu gốc đặt tại `src/data/grid110.ts` — sửa thẳng trong đó nếu muốn đổi bộ mẫu
dùng chung cho cả phòng.

---

## 6. Đưa sơ đồ lưới trung áp từ CAD vào (giai đoạn 2)

1. Trong CAD (AutoCAD / GstarCAD / VinaCAD…) mở bản vẽ lộ trung áp, dùng **SAVEAS →
   AutoCAD ASCII DXF**.
2. Trong phần mềm: chọn trạm 110kV tương ứng → **Dữ liệu → Thêm trang lưới trung áp…**
3. **Tệp → Nhập từ CAD (.dxf)**, đặt bề rộng quy đổi (km) rồi bấm Nhập.
4. Nội dung vừa nhập được chọn sẵn — kéo chuột đặt khớp vào vị trí mong muốn.

Bộ nhập tự động:

* đọc `LINE`, `LWPOLYLINE`, `POLYLINE`, `CIRCLE`, `ARC`, `TEXT`, `MTEXT`, `INSERT`;
* "nổ" các block lồng nhau tới 6 cấp;
* **đoán cấp điện áp theo tên lớp** (110 / 35 / 22 / 10 / 6 / 0,4);
* **nhận dạng thiết bị theo tên block**: MC, MCHB, DCL, DCLHB, dao tiếp địa, CSV,
  TI, TU, TUC, Recloser, LBS, cầu chì, MBA, kháng, tụ bù, cột…;
* nối các đoạn thẳng liên tiếp thành một tuyến để dễ sửa;
* **đọc đúng tiếng Việt** với cả file DXF bảng mã cũ (ANSI_1258/1252) và chuỗi
  thoát `\U+xxxx`.

Đã thử với chính file CAD của Phòng Điều độ (trích sơ đồ TBA 110kV Lưu Xá E6.5):
nhận đúng 179 tuyến, 212 thiết bị và 240 dòng chữ, phân đúng 117 tuyến 22kV,
44 tuyến 35kV, 17 tuyến 110kV.

Sau khi nhập, chọn từng tuyến để điền **mã hiệu dây** (`AC-120`, `AC-95`,
`Cu/XLPE/PVC 3x240`…), **loại tuyến** (ĐDK / cáp ngầm), **số mạch** và **chiều dài**.
Ô mã hiệu có sẵn danh sách gợi ý dây ĐDK, dây bọc, cáp ngầm và cáp vặn xoắn thông dụng.

---

## 7. Lưu và xuất

| Định dạng | Dùng để |
|---|---|
| `.sld` (JSON) | **Định dạng làm việc** — giữ đầy đủ thuộc tính, mở lại sửa tiếp |
| `.dxf` | Mở lại bằng CAD để in khổ lớn, ghép vào hồ sơ |
| `.svg` | Dán vào Word / Excel, phóng to không vỡ nét |
| `.png` | Ảnh theo đúng khung nhìn hiện tại, dán nhanh vào báo cáo |
| `.csv` | Bảng trạm để xử lý trong Excel |

Bản vẽ được **lưu tạm tự động** vào trình duyệt sau mỗi thay đổi và khôi phục khi
mở lại. Vẫn nên lưu ra file `.sld` để giữ lâu dài và chia sẻ.

> Lưu ý: khi xuất DXF, các ký hiệu thiết bị được "nổ" thành đường và hình tròn (để
> mọi phần mềm CAD đều mở được). Vì vậy **không nên** xuất DXF rồi nhập lại làm
> quy trình làm việc chính — hãy dùng file `.sld`.

---

## 8. Cấu trúc mã nguồn

```
src/
├── core/        types.ts (mô hình dữ liệu) · doc.ts (kho dữ liệu + Undo/Redo)
│                voltage.ts (quy ước màu) · geom.ts (hình học)
├── symbols/     prims.ts (nguyên thuỷ hình học) · blocks.ts (22 ký hiệu thiết bị)
├── data/        geo.ts (phép chiếu, ranh giới, địa danh)
│                grid110.ts (danh mục trạm + đường dây + mã hiệu dây)
│                seed.ts (dựng sơ đồ tỉnh ban đầu)
├── render/      viewport.ts · shapes.ts (sinh hình + bắt điểm) · renderer.ts (canvas)
├── editor/      editor.ts (công cụ vẽ) · snap.ts (bắt điểm) · declutter.ts (giãn trạm)
├── io/          dxfExport.ts · dxfImport.ts · file.ts
└── ui/          app.ts (khung giao diện) · palette.ts · props.ts · dom.ts
docs/            dữ liệu trích xuất từ file CAD gốc
tools/           smoke-test.mjs — kiểm thử bằng trình duyệt thật
```

Không dùng framework giao diện; chỉ TypeScript + Vite, nên đọc và sửa trực tiếp được.

---

## 9. Việc còn phải làm

* Rà soát toạ độ thực tế của 28 trạm và kết lưới 110/220kV (mục 5).
* Bổ sung công suất MBA cho E6.22 Định Hoá, E6.23 Yên Bình 8, E6.24 Đa Phúc,
  E6.25 Phú Bình 2 và ba trạm khu vực Bắc Kạn (E26.1–E26.3) — file CAD gốc chưa ghi.
* Nhập lần lượt các sơ đồ lộ trung áp rời rạc và đấu nối về trạm 110kV tương ứng.
