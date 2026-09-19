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

## 5. Trang phụ: sơ đồ 220-110kV theo vị trí địa lý

Ngoài tờ sơ đồ kết dây (mục 6), phần mềm còn một trang đặt các trạm **gần đúng vị trí
địa lý**: 28 trạm/nút nguồn (26 trong tỉnh + 220kV Tuyên Quang và 220kV Sóc Sơn để
thể hiện liên kết), ranh giới tỉnh sơ hoạ, địa danh tham chiếu và 29 đường dây
110/220kV. Trang này để hình dung không gian lưới; nhấn đúp vào một khối trạm sẽ
nhảy sang đúng trạm đó trên sơ đồ kết dây.

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

## 6. Sơ đồ kết dây toàn tỉnh — tất cả trạm trên MỘT tờ

Trang mở ra đầu tiên là **"Sơ đồ kết dây lưới điện tỉnh Thái Nguyên"** — nguyên tờ
khổ A0 lấy từ bản vẽ CAD của Phòng Điều độ, **tất cả 25 trạm nằm trên một sơ đồ duy
nhất, giữ đúng bố trí bản gốc** (đối chiếu với file PDF xuất từ AutoCAD).

Trên tờ này có hơn **19.300 đối tượng**: thanh cái, máy cắt, máy cắt hợp bộ, dao cách
ly, dao tiếp địa, TI, TU, TUC, chống sét van, cầu chì, máy biến áp, tụ bù, các lộ xuất
tuyến, nhãn ngăn lộ và mã hiệu cáp ở đủ các cấp **220 / 110 / 35 / 22 / 10 / 6 / 0,4kV**.

Đi lại trên tờ:

* Bấm tên trạm trong bảng **Danh mục trạm** (bên phải) để phóng tới đúng trạm đó.
* Hoặc **Dữ liệu → Danh mục trạm trên sơ đồ kết dây…**
* Trang thứ hai — **"Lưới 220-110kV theo vị trí địa lý"** — đặt các trạm gần đúng vị
  trí thật; nhấn đúp vào khối trạm ở đó sẽ nhảy sang đúng trạm trên sơ đồ kết dây.
  Các khối trạm 220/110kV được giãn sẵn nên **không khối nào đè lên khối nào**
  (kiểm thử tự động xác nhận 0 cặp chồng lấn), lệch tối đa 18 km so với vị trí thật.

### Ký hiệu thiết bị dựng lại đúng bản CAD

* **Nối đoạn thẳng**: dung sai gộp các đoạn thẳng liền nhau phải rất nhỏ. Lúc đầu
  dung sai lấy theo tỷ lệ bản vẽ (≈3 đơn vị CAD) nên hai đầu mút cách nhau vài
  đơn vị bị coi là một, phần mềm vẽ thêm nét nối **không có thật** — chính là hình
  "dao cách ly có liên động" giả ở E6.13. Nay dung sai nhỏ hơn 150 lần.
* **Góc xoay**: hình học block trong phần mềm được xoay về trục dọc để tiện vẽ tay,
  nên khi nhập từ CAD phải trừ lại đúng góc đó; thiếu bước này thì mọi dao cách ly,
  dao tiếp địa, chống sét van, recloser đều lệch 90°.
* **Lật gương**: CAD dùng hệ số tỷ lệ âm để lật thiết bị (ngăn lộ bên trái / bên phải
  thanh cái) — phần mềm giữ lại bằng thuộc tính riêng.
* **Điểm chèn**: block CAD lấy điểm chèn làm gốc, block trong phần mềm lấy tâm hình
  làm gốc, nên vị trí được bù lại theo góc xoay và tỷ lệ của từng thiết bị.
* **Máy cắt vẽ rỗng** đúng như bản CAD. Muốn tô đặc máy cắt đang đóng cho dễ nhìn khi
  điều độ thì bật **Xem → Tô đặc máy cắt đang đóng**.
* **Cuộn dây máy biến áp** trong CAD là hình tròn rời (không nằm trong block) nên phần
  mềm có kiểu đối tượng hình tròn riêng, không quy về ký hiệu cột như trước.

### Cấp điện áp lấy theo ký hiệu ngăn lộ

Bản vẽ CAD gốc đặt lớp (layer) **không phải chỗ nào cũng đúng**: có ngăn lộ 22kV vẽ
trên lớp `35-DZ 35`, có cả trạm 110kV vẽ trên lớp `10-DZ 10`, có block cầu chì 35kV
lại chèn vào lớp 22kV. Vì vậy phần mềm **không tin tên lớp**, mà lấy căn cứ đáng tin
nhất là **số hiệu ngăn lộ** theo Thông tư 06/2025/TT-BCT — chữ số đầu cho biết cấp
điện áp:

| Ký hiệu | Cấp | | Ký hiệu | Cấp |
|---|---|---|---|---|
| 1xx (171, 131) | 110kV | | 5xx | 500kV |
| 2xx (271) | 220kV | | 6xx (641, 612) | 6kV |
| 3xx (331, 301) | 35kV | | 7xx | 10kV |
| 4xx (431, 471) | 22kV | | 9xx | 0,4kV |

Thanh cái cũng theo quy ước này: C11/C12 là 110kV, C31/C32 là 35kV, C41/C42 là 22kV,
C61/C62 là 6kV.

Cách phần mềm gán cấp điện áp cho từng đoạn dây:

1. **Gom mạch.** Các đoạn dây chạm nhau (kể cả rẽ nhánh chữ T từ thanh cái) được gom
   thành một mạch — về điện thì chỗ chạm nhau bắt buộc cùng một cấp.
2. **Nhãn bỏ phiếu.** Mỗi nhãn ngăn lộ được gán về đoạn dây gần nó nhất; nếu trong tầm
   có đoạn mà tên lớp đã đúng cấp của nhãn thì ưu tiên đoạn đó (tránh bắt nhầm sang
   dây khác chạy sát bên, ví dụ nhãn `131-08` cạnh đoạn cáp 22kV của máy biến áp).
3. **Lan sang đoạn chưa có nhãn.** Đoạn dây nối giữa hai thiết bị trong cùng một ngăn
   lộ thì không có nhãn riêng, nên lấy theo nhãn gần nhất tính theo số bước nối
   (tối đa 4 bước).
4. **Còn lại mới theo tên lớp.**

Thiết bị, chữ ghi và hình tròn thì lấy theo **đường dây gần nhất** — vẽ điện thì thiết
bị và dây đấu vào nhau bắt buộc cùng một cấp, nên cách này bám đúng hình vẽ.

Hai chỗ dễ nhầm đã được xử lý riêng:

* Dãy **tủ hợp bộ 6kV/22kV** đánh số `C09, C10, C11…` là **số thứ tự tủ**, không phải
  tên thanh cái (tên thanh cái không bao giờ có chữ số 0). Gặp kiểu đánh số này thì bỏ
  toàn bộ phiếu dạng `Cxx` của chỗ đó, nếu không cả dãy tủ 6kV sẽ bị tô thành 110kV.
* **Máy biến áp / máy biến áp tự ngẫu** nối hai cấp khác nhau nên không bao giờ lấy cấp
  điện áp theo đường dây đấu vào nó.

Nhờ vậy **E26.1 Bắc Kạn** ra đúng 110/35/22kV, **E26.2 Chợ Đồn** ra 110/35kV,
**E6.13 Yên Bình** ra 110/22kV, và các trạm **E6.24 Đa Phúc**, **E6.7 Sông Công**,
**E6.5 Lưu Xá**, **E6.8 Xi măng Thái Nguyên** hết cảnh một ngăn lộ hai màu.

Rà soát lại bất cứ lúc nào bằng:

```bash
npm run build && node tools/kiem-cap-dien-ap.mjs
```

Công cụ so số hiệu ngăn lộ với màu của dây/thiết bị bên cạnh và in ra chỗ lệch
(hiện còn 13/2191 nhãn, phần lớn là báo nhầm của chính công cụ — như dãy tủ C09-C14).

Nếu còn chỗ nào sai, sửa cả lớp một lần bằng **Dữ liệu → Gán cấp điện áp theo lớp CAD
gốc…** (tên lớp CAD gốc được giữ lại trong từng đối tượng).

### Khung bản vẽ A0

Tờ sơ đồ kết dây có sẵn khung bản vẽ khổ **A0 (841 x 1189 mm)** theo TCVN 7285:
lề trái 20mm để đóng tập, ba lề còn lại 10mm, khung tên ở góc dưới bên phải ghi
tên đơn vị, Phòng Điều độ, tên bản vẽ và ngày lập. Khung nằm trên lớp riêng
**"Khung bản vẽ"**, tắt/bật được trong bảng Lớp và xuất sang DXF cùng bản vẽ.

### Ký hiệu đặt theo đúng block trong bản CAD

Vị trí, cỡ và hướng của mỗi ký hiệu được suy từ **chính block trong file CAD**
(hộp bao hình học và điểm chèn của nó), không lấy theo ký hiệu mẫu dựng sẵn. Phải
làm vậy vì bản vẽ dùng nhiều biến thể của cùng một thiết bị:

| Thiết bị | Biến thể trong CAD | Khác nhau |
|---|---|---|
| Dao tiếp địa | `110-Tiep Dia` / `22-Tiep dia` / `6-Tiep dia` | dài 19,4 / 16,8 / 21,3 đơn vị |
| Chống sét van | `110-CSV` / `35-CSV` | nằm ngang / nằm dọc |
| Máy cắt | `110-MC` / `6-MC` | ký hiệu ở dưới / ở trên điểm chèn |
| TU thanh cái | `110-TUC` / `22-TUC` | có chống kết điện dung / chỉ ba cuộn dây |

Nhờ vậy dao tiếp địa `-76`, `-24B` bám đúng vào đường dây thay vì lệch đi vài đơn
vị, chống sét van 35kV xoay đúng chiều, và TU tụ `TUC62B` ở E6.9 không còn vẽ ngược.
Góc quay suy ra được làm tròn về bội số 90°; lệch quá 25° thì quay về góc chuẩn hoá
của ký hiệu mẫu.

### Ký hiệu vẽ bằng nét rời được thay bằng block

9/25 trạm trong bản vẽ gốc (E26.1 Bắc Kạn, E26.2 Chợ Đồn, E26.3 Nà Phặc,
E6.17 Phú Bình, E6.20 Lưu Xá 220, E6.13 Yên Bình, E6.23, E6.14, E6.18) không dùng
block mà vẽ thẳng bằng LINE/CIRCLE. Phần mềm dò hình rồi thay bằng block:

* **Máy cắt** — bốn đoạn khép kín thành hình chữ nhật, hai cạnh ngắn có dây nối.
* **Biến dòng TI** — vòng tròn đơn lẻ nằm trên đường dây (loại cụm vòng tròn chồng
  nhau vì đó là cuộn dây TU/TUC/máy biến áp).
* **Dao cách ly** — khe hở TRỐNG trên đường dây + lưỡi dao chéo ở một mép khe.
* **Dao tiếp địa** — ba vạch song song ngắn dần (ký hiệu đất) + cần + lưỡi dao.

Trước khi dò hình, các nét **thẳng hàng** nối tiếp nhau được gộp lại: ở E26.1 mỗi
vạch của ký hiệu đất vẽ thành hai nửa trên/dưới trục nên không gộp thì không nhận
ra vạch nào. Dao nhận ra từ lưỡi chéo thì mang trạng thái **mở** đúng như hình vẽ.

Riêng E26.1 Bắc Kạn: **26 máy cắt, 33 dao cách ly, 68 dao tiếp địa, 14 TI** — trước
đây dao tiếp địa và TI không nhận được cái nào.

### Liên kết điện và chiều công suất

Phần mềm dựng sẵn mô hình **liên kết điện** giữa các đối tượng (xem
`src/core/lienket.ts`), làm nền cho việc hiện chiều công suất 110kV → máy biến áp →
trung áp sau này:

1. **Nút điện.** Một tuyến dây / thanh cái là vật dẫn liền mạch nên mọi đỉnh của nó
   là một nút; hai tuyến chạm nhau (kể cả rẽ nhánh chữ T vào giữa thanh cái) nhập
   làm một nút.
2. **Cực thiết bị.** Mỗi ký hiệu có các cực ghi trong thư viện block: thiết bị nối
   tiếp hai cực ở hai đầu trục, thiết bị đấu rẽ xuống đất một cực tại điểm chèn,
   máy biến áp hai hoặc ba cực tại tâm các cuộn dây. Cực được quay - lật - phóng
   theo thiết bị rồi bắt vào tuyến gần nhất.
3. **Mạch.** Nhập các nút nối thông qua thiết bị **đang đóng**. Máy biến áp không
   nhập chung (hai phía khác cấp điện áp) mà ghi thành "cầu nối qua máy biến áp".

Dùng trong phần mềm:

| Lệnh | Tác dụng |
|---|---|
| Chọn một đối tượng rồi **Shift+M** | Tô sáng toàn bộ mạch nối thông với nó |
| **Dữ liệu → Tô sáng cả chuỗi 110kV - MBA - trung áp** | Như trên nhưng đi xuyên máy biến áp |
| **Dữ liệu → Kiểm tra liên kết điện…** | Bảng thống kê + chọn nhanh thiết bị chưa đấu vào lưới |

Trên tờ sơ đồ kết dây hiện có: **1.551 nút điện, 861 mạch rời nhau, 98 cầu nối qua
máy biến áp**; 3.975/4.028 thiết bị (98,7%) đã đấu được vào lưới. Dựng mô hình mất
khoảng 0,25 giây.

Bước tiếp theo để hiện chiều công suất: đánh dấu ngăn lộ nguồn (110/220kV), duyệt
cây từ nguồn đi ra - lưới trung áp vận hành hình tia nên chiều công suất trên mỗi
nhánh chính là chiều đi xa dần nguồn - rồi vẽ mũi tên trên tuyến. Khi có số liệu
P, Q từ SCADA thì chỉ cần gán thêm trị số vào từng nhánh.

### Dựng lại bộ dữ liệu từ file CAD mới

```bash
dwg2dxf -o tong.dxf "So do luoi dien lien thong tinh Thai Nguyen.dwg"
pip install ezdxf
python3 tools/tach-so-do-tram.py tong.dxf tram/ --min-x 999999999 \
        --to-tong 'KẾT DÂY LƯỚI ĐIỆN' \
        --them-to 'LƯỚI ĐIỆN 220KV' --them-to 'ĐƯỜNG DÂY'
node tools/dung-du-lieu-tram.mjs tram/ src/data/tram-sld.json
npm run build
```

---

## 7. Đưa sơ đồ lưới trung áp từ CAD vào (giai đoạn 3)

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

## 8. Lưu và xuất

| Định dạng | Dùng để |
|---|---|
| `.sld` (JSON) | **Định dạng làm việc** — giữ đầy đủ thuộc tính, mở lại sửa tiếp |
| `.dxf` | Mở lại bằng CAD để in khổ lớn, ghép vào hồ sơ |
| `.svg` | Dán vào Word / Excel, phóng to không vỡ nét |
| `.png` | Ảnh theo đúng khung nhìn hiện tại, dán nhanh vào báo cáo |
| `.csv` | Bảng trạm để xử lý trong Excel |

Bản vẽ được **lưu tạm tự động** vào trình duyệt sau mỗi thay đổi và khôi phục khi
mở lại. Vẫn nên lưu ra file `.sld` để giữ lâu dài và chia sẻ.

> **Cập nhật bản mới mà vẫn thấy bản cũ?** Dữ liệu lưu tạm nay được đóng dấu mã phiên
> bản: mở bản `index.html` mới thì dữ liệu tạm của bản cũ tự bị bỏ, không phải mở cửa
> sổ ẩn danh nữa. Mã phiên bản đang chạy hiện ở **góc phải thanh trạng thái** và trong
> **Trợ giúp**; muốn xoá sạch dữ liệu tạm thì vào **Tệp → Xoá dữ liệu lưu tạm trong
> trình duyệt…**.

> Lưu ý: khi xuất DXF, các ký hiệu thiết bị được "nổ" thành đường và hình tròn (để
> mọi phần mềm CAD đều mở được). Vì vậy **không nên** xuất DXF rồi nhập lại làm
> quy trình làm việc chính — hãy dùng file `.sld`.

---

## 9. Cấu trúc mã nguồn

```
src/
├── core/        types.ts (mô hình dữ liệu) · doc.ts (kho dữ liệu + Undo/Redo)
│                voltage.ts (quy ước màu) · geom.ts (hình học)
│                lienket.ts (nút điện - cực thiết bị - mạch, nền cho chiều công suất)
├── symbols/     prims.ts (nguyên thuỷ hình học) · blocks.ts (23 ký hiệu thiết bị)
├── data/        geo.ts (phép chiếu, ranh giới, địa danh)
│                grid110.ts (danh mục trạm + đường dây + mã hiệu dây)
│                seed.ts (dựng bản vẽ mặc định)
│                tram-sld.json + tramSheets.ts (sơ đồ kết dây trích từ file CAD)
├── render/      viewport.ts · shapes.ts (sinh hình + bắt điểm) · renderer.ts (canvas)
│                index2d.ts (chỉ mục không gian cho tờ hàng chục nghìn đối tượng)
├── editor/      editor.ts (công cụ vẽ) · snap.ts (bắt điểm) · declutter.ts (giãn trạm)
├── io/          dxfExport.ts · dxfImport.ts · file.ts
└── ui/          app.ts (khung giao diện) · palette.ts · props.ts · dom.ts
docs/            dữ liệu trích xuất từ file CAD gốc
tools/           tach-so-do-tram.py     — tách từng tờ sơ đồ trạm từ file CAD tổng
                 dung-du-lieu-tram.mjs  — dựng src/data/tram-sld.json
                 smoke-test.mjs         — kiểm thử bằng trình duyệt thật
                 kiem-cap-dien-ap.mjs   — rà soát cấp điện áp theo số hiệu ngăn lộ
```

Không dùng framework giao diện; chỉ TypeScript + Vite, nên đọc và sửa trực tiếp được.

---

## 10. Việc còn phải làm

* Rà soát toạ độ thực tế của 28 trạm và kết lưới 110/220kV (mục 5).
* Bổ sung công suất MBA cho E6.22 Định Hoá, E6.23 Yên Bình 8, E6.24 Đa Phúc,
  E6.25 Phú Bình 2 và ba trạm khu vực Bắc Kạn (E26.1–E26.3) — file CAD gốc chưa ghi.
* Rà lại vài chỗ lẻ còn suy sai cấp điện áp (chạy `node tools/kiem-cap-dien-ap.mjs`)
  — sửa bằng công cụ ở mục 6.
* Nhập lần lượt các sơ đồ lộ trung áp rời rạc và đấu nối về trạm 110kV tương ứng.
* Hiện **chiều công suất** trên sơ đồ: đánh dấu ngăn lộ nguồn, duyệt cây từ nguồn
  rồi vẽ mũi tên (mô hình liên kết điện đã có, xem mục 6).
* Đấu nốt 53 thiết bị còn lơ lửng (`Dữ liệu → Kiểm tra liên kết điện…` để xem danh
  sách) - phần lớn là chống sét van và TU vẽ tách rời đường dây trong bản CAD gốc.
