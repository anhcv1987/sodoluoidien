# Nguồn dữ liệu và mức độ tin cậy

Tài liệu này ghi lại rõ dữ liệu nào lấy từ file CAD của Phòng Điều độ, dữ liệu nào
do người lập trình ước lượng — để khi rà soát biết chỗ nào phải đối chiếu hồ sơ.

## 1. File CAD gốc

`Sơ đồ lưới điện liên thông tỉnh Thái Nguyên.dwg` (AutoCAD 2018 / AC1032,
4,9 MB, lưu lần cuối bằng VinaCAD 2026). File được chuyển sang DXF bằng
LibreDWG `dwg2dxf` rồi phân tích bằng `ezdxf`.

Thống kê: 31.401 LINE · 9.192 TEXT · 8.351 INSERT · 2.210 MTEXT · 1.975 CIRCLE ·
1.355 LWPOLYLINE · 841 HATCH · 281 ARC — 135 lớp, 631 block.

## 2. Dữ liệu TRÍCH XUẤT TRỰC TIẾP (tin cậy cao)

### 2.1 Danh mục trạm

Lấy từ các tiêu đề bản vẽ trong file CAD:

| Mã | Tên trạm | Công suất ghi trong CAD |
|---|---|---|
| E6.2 | TBA 220kV Thái Nguyên (220/110/35/22kV) | 2x250 MVA |
| E6.3 | TBA 110kV Gò Đầm | 3x63 MVA |
| E6.4 | TBA 110kV Đán (Thịnh Đán) | 2x63 MVA |
| E6.5 | TBA 110kV Lưu Xá | 2x40 MVA |
| E6.6 | TBA 110kV Phú Lương | 2x40 MVA |
| E6.7 | TBA 110kV Sông Công | 2x40 MVA |
| E6.8 | TBA 110kV Xi măng Thái Nguyên | 2x40 MVA |
| E6.9 | TBA 110kV Gang Thép | 3x63 MVA |
| E6.11 | TBA 110kV Xi măng Quán Triều | 1x20 MVA |
| E6.12 | TBA 110kV Núi Pháo | 2x40 MVA |
| E6.13 | TBA 110kV Yên Bình | 3x63 MVA |
| E6.14 | TBA 110kV Yên Bình 2 | 3x63 MVA |
| E6.16 | TBA 220kV Phú Bình | 2x250 MVA |
| E6.17 | TBA 110kV Phú Bình | 3x63 MVA |
| E6.18 | TBA 110kV Yên Bình 3 | 3x63 MVA |
| E6.19 | TBA 110kV Đại Từ | 2x40 MVA |
| E6.20 | TBA 220kV Lưu Xá | 2x250 MVA |
| E6.21 | TBA 110kV Sông Công 2 | 2x63 MVA |
| E6.22 | TBA 110kV Định Hóa | (CAD không ghi) |
| E6.23 | TBA 110kV Yên Bình 8 | (CAD không ghi) |
| E6.24 | TBA 110kV Đa Phúc | (CAD không ghi) |
| E6.25 | TBA 220kV Phú Bình 2 | (CAD không ghi) |
| A6.15 | NM Nhiệt điện An Khánh | 2x60 MVA |
| E26.1 | TBA 110kV Bắc Kạn | (CAD không ghi) |
| E26.2 | TBA 110kV Chợ Đồn | (CAD không ghi) |
| E26.3 | TBA 110kV Nà Phặc | (CAD không ghi) |

Liên kết ngoài tỉnh xuất hiện trên bản vẽ: E14.1 (220kV Tuyên Quang),
E1.19 (220kV Sóc Sơn, 125+250 MVA).

Nội dung trích xuất thô: `cad-trich-xuat-so-do-tong.txt`.

### 2.2 Hình học ký hiệu thiết bị

Toạ độ gốc của 22 block thiết bị (110-MC, 110-DCL, 22-MCHB, 110-Tiep Dia,
110-CSV, 110-TUC, 110-TI, MBA 110-35-22, 22-R, LBS 22kV…) lưu tại
`cad-blocks-goc.txt` và được tái tạo trong `src/symbols/blocks.ts`.

Hệ số chuẩn hoá: chia toạ độ CAD cho 18,669 (chiều cao block `110-MC`), nên
máy cắt cao đúng 1 đơn vị bản vẽ và tỷ lệ giữa các thiết bị giống hệt CAD.

### 2.3 Mã hiệu dây dẫn

Các nhãn có thật trên tờ "LƯỚI ĐIỆN 220KV-110KV KHU VỰC TỈNH THÁI NGUYÊN":
AC185, AC240, AC300, AC400, AC157, AC185+AC185, AC240+AC150, ACSR400/51,
TACSR200 — kèm chiều dài từng đoạn. Đã đưa vào thư viện gợi ý mã dây.

## 3. Dữ liệu ƯỚC LƯỢNG (cần rà soát)

### 3.1 Toạ độ địa lý các trạm

File CAD vẽ theo lối sơ đồ nguyên lý, **không theo toạ độ địa lý**, nên không
trích được vị trí thật. Toạ độ trong `src/data/grid110.ts` do người lập trình ước
lượng theo địa danh (TP. Thái Nguyên, TP. Sông Công, KCN Yên Bình, Đại Từ, Định
Hoá, TP. Bắc Kạn, Chợ Đồn, Ngân Sơn…), sai số có thể tới vài km.

### 3.2 Kết lưới 110/220kV

Đã thử truy vết tự động từ hình học tờ sơ đồ tổng nhưng **không đủ tin cậy**: các
tuyến vẽ theo lối schematic đi vòng, điểm cuối không nằm gần khối trạm nên không
ghép cặp trạm chính xác được. Vì vậy 29 đường dây trong `DUONG_DAY` được đánh dấu
`'Sơ bộ - cần rà soát'` và hiển thị nét đứt trong phần mềm.

Một phần thông tin ngăn lộ có trích được (dùng để tham khảo khi rà soát):

```
E6.2   171→E6.11, 171→E6.6, 171→E6.8, 172→E6.4, 172→E6.8
E6.5   173→E6.20
E6.17  173→E6.25          E6.18  174→E6.25
E6.22  172→E6.6, 173→E26.1
E6.19  171→E6.12, 171→E14.1
E6.24  174→E1.19, 175→E6.16
E6.25  171→E6.16, 171→E6.18
```

### 3.3 Ranh giới tỉnh

Đa giác sơ hoạ dựng từ các điểm cực của tỉnh Thái Nguyên sau sáp nhập
(khoảng 21,33°–22,76° vĩ Bắc; 105,40°–106,24° kinh Đông). **Không phải tài liệu
địa giới hành chính.**

## 4. Cách rà soát trong phần mềm

1. Mở **Dữ liệu → Bảng trạm 110/220kV**, tải `.csv`, đối chiếu với hồ sơ QLVH.
2. Sửa vĩ độ/kinh độ trong bảng thuộc tính, hoặc kéo thả trạm trên màn hình.
3. Mở **Dữ liệu → Bảng đường dây**, bấm từng dòng để nhảy tới tuyến tương ứng,
   sửa tên lộ / mã dây / chiều dài / số mạch, rồi xoá ghi chú "cần rà soát".
4. Nếu muốn vẽ lại từ đầu: **Dữ liệu → Xoá toàn bộ đường dây sơ bộ**.
5. Lưu file `.sld` làm bộ dữ liệu dùng chung cho phòng.

---

# 5. Sơ đồ nguyên lý từng trạm (bổ sung)

## 5.1 Cách trích xuất

`tools/tach-so-do-tram.py` tách file DXF tổng thành 27 tờ riêng:

* Tìm tiêu đề dạng "TRẠM 110/220KV …" (chữ cao ≥ 10) trong vùng bản vẽ đã sắp xếp
  theo thứ tự trạm (X > 800000; vùng X ≈ 740000 là bản nháp trùng lặp nên bỏ).
* Xếp các tiêu đề thành cột theo X; trong mỗi cột, nhãn phụ nằm cách tiêu đề chính
  dưới 1000 đơn vị được coi là cùng một tờ.
* Dải Y của mỗi tờ dò từ tiêu đề đi xuống tới khi gặp khoảng trống > 320 đơn vị,
  và không bao giờ vượt quá tiêu đề của tờ kế tiếp.
* Dải X gom theo cụm (khoảng trống > 1200) để loại bảng mục lục nằm cạnh.
* Ba tờ khác (sơ đồ liên thông 220-110kV, hai tờ đường dây trung áp) lấy bằng cách
  gom cụm đối tượng liền nhau quanh tiêu đề.

`tools/dung-du-lieu-tram.mjs` chạy **đúng bộ nhập DXF của phần mềm**
(`src/io/dxfImport.ts`, gói bằng esbuild) để chuyển sang đối tượng bản vẽ, rồi nén
lại thành `src/data/tram-sld.json` (1,1 MB cho 25.387 đối tượng).

## 5.1b Vị trí - cỡ - hướng ký hiệu

Lấy theo **hộp bao hình học và điểm chèn của chính block trong file CAD**, không
theo ký hiệu mẫu dựng sẵn trong phần mềm. Bản vẽ dùng nhiều biến thể của cùng một
thiết bị nên nếu áp một ký hiệu mẫu cho tất cả thì sai vị trí và sai cỡ:

| Thiết bị | Biến thể | Hộp bao (rộng x cao) | Tâm so với điểm chèn |
|---|---|---|---|
| Dao tiếp địa | `110-Tiep Dia` | 19,4 x 5,1 | (-5,5; 0) |
| | `22-Tiep dia` | 16,8 x 6,6 | (-8,4; 0) |
| | `6-Tiep dia` / `35-Tiep dia` | 21,3 x 7,1 | (-10,7; 0) |
| Chống sét van | `110-CSV` | 15,5 x 4,9 | (-4,0; -0,4) — nằm ngang |
| | `35-CSV` | 11,1 x 51,8 | (0; -24,3) — nằm dọc |
| Máy cắt | `110-MC` | 12,3 x 18,7 | (0; -9,3) — dưới điểm chèn |
| | `6-MC` / `35-MC` | 9,6 x 25,5 | (0; +12,8) — trên điểm chèn |
| TU thanh cái | `110-TUC` | 36,4 x 38,2 | có chống kết điện dung |
| | `6/22/35-TUC` | 18,4 x 19,1 | chỉ ba cuộn dây |

Góc quay suy từ véc-tơ "điểm chèn → tâm hình" của block CAD so với véc-tơ tương
ứng của ký hiệu mẫu, rồi làm tròn về bội số 90°; lệch quá 25° (ký hiệu lật gương
như `110-TUC1`, `TUC 110`) thì giữ góc chuẩn hoá của ký hiệu mẫu.

## 5.1c Ký hiệu vẽ tay được nhận dạng thành block

Bốn trạm E26.1 Bắc Kạn, E26.2 Chợ Đồn, E26.3 Nà Phặc, E6.17 Phú Bình (và E6.13,
E6.14, E6.18, E6.20, E6.23) vẽ thẳng bằng LINE/CIRCLE. Đối chiếu từng ngăn lộ với
bản CAD gốc cho thấy ba điểm phải xử lý riêng:

1. **Nét bị cắt đôi.** Mỗi vạch của ký hiệu đất ở E26.1 vẽ thành hai nửa trên/dưới
   trục (dài 0,47 + 0,47; 0,79 + 0,79; 1,11 + 1,11). Phải gộp các nét thẳng hàng
   nối tiếp nhau trước khi dò hình.
2. **Ký hiệu "mở" khác hẳn ký hiệu "đóng".** Block `110-DCL` (đóng) cao 6,7 còn
   `22-DCL Mo` (mở) cao 20 - lệch nhau hai lần. Trước đây hai hình chuẩn hoá riêng
   nên lệch nhau 90 độ và lệch tâm, vẽ ra thành hình chữ Z nằm ngang. Nay hình "mở"
   dùng chung hệ toạ độ với hình "đóng", và cỡ lấy theo hộp bao của chính hình "mở".
3. **Máy cắt hợp bộ.** Tủ hợp bộ vẽ thân máy cắt (hình chữ nhật) kèm hai cụm mũi tên
   tiếp điểm xe đẩy ở trên và dưới. Block `22-MCHB` cao 61,67 trong đó thân máy cắt
   chiếm 25,53 ở giữa. Dò đủ hai cụm mũi tên thì thay bằng máy cắt hợp bộ, thiếu một
   cụm thì chỉ là máy cắt thường (ví dụ ngăn TU của E26.1 chỉ có một cụm phía trên).

## 5.1d Đường dây 110kV nối giữa các trạm

File CAD vẽ 25 trạm rời nhau; mỗi ngăn lộ 110kV chỉ là một mũi tên cụt kèm nhãn ghi
nơi đến. Trên tờ sơ đồ tổng có **49 nhãn** dạng `171 E6.22 ĐỊNH HÓA` - đó chính là
danh mục kết lưới do Phòng Điều độ ghi. Ghép các nhãn hai đầu lại thì ra 26 đường
dây 110kV; những tuyến chỉ ghi nhãn một đầu thì đầu kia tra theo **số hiệu ngăn lộ**
(chữ số thứ hai là 7 hoặc 8 mới là ngăn đường dây, 13x là ngăn máy biến áp).

Mã hiệu dây và chiều dài lấy từ sơ đồ **"LƯỚI ĐIỆN 220KV-110KV KHU VỰC TỈNH THÁI
NGUYÊN"** của Phòng Điều độ (bản ngày 10/8/2026, người vẽ Hoàng Gia Tùng).

**Cách đọc nhãn nơi đến:** số trong nhãn là **ngăn lộ của ĐẦU KIA**, không phải
ngăn lộ của chính trạm đang xét. Nhãn `171 E6.8` đặt ở ngăn 177 của E6.2 nghĩa là
lộ 177E6.2 đi tới ngăn 171 của E6.8. Đối chiếu vị trí chữ trên bản vẽ xác nhận điều
này: ở E26.1 Bắc Kạn, nhãn `171 E6.22 ĐỊNH HÓA` nằm đúng trên cột của ngăn lộ 173,
còn sơ đồ kết lưới cũng vẽ 173E26.1 - 171E6.22.

Số hiệu ngăn lộ hai đầu của 08 tuyến đã được Phòng Điều độ xác nhận lại:
177E6.2 - 171E6.8, 178E6.2 - 172E6.8, 171E6.3 - 171E6.21, 172E6.3 - 172E6.16,
172E6.13 - 172E6.25.

### Ba trạm 220kV ngoài địa bàn

| Mã | Trạm | Nguồn dữ liệu |
|---|---|---|
| E26.5 | 220kV Bắc Kạn | Sơ đồ kết lưới (ngăn 171-174) + nhãn nơi đến ở E26.1, E26.2, E26.3 |
| E16.2 | 220kV Cao Bằng | Nhãn `171 E16.2 CAO BẰNG` ở ngăn 172 của E26.3 Nà Phặc |
| E1.19 | 220kV Sóc Sơn | Sơ đồ thu nhỏ có sẵn ở góc dưới bên trái file CAD (ngăn 171-176) |

Chiều dài ba tuyến đi Sóc Sơn là **tổng các đoạn** ghi trên sơ đồ kết lưới:
176E1.19 - 176E6.16 = 0,11 + 1,5 + 13,3 + 1,03 = 15,94km;
174E1.19 - 171E6.24 = 1,6 + 6,68 + 0,101 = 8,38km;
172E1.19 - 172E6.7 = 11km (AC 2x185, ghi sẵn một đoạn).
Các tuyến đi 220kV Bắc Kạn và 220kV Cao Bằng chưa có mã hiệu dây / chiều dài trên
sơ đồ nên để trống.

### Nối bổ sung theo sơ đồ kết lưới (bản ngày 24/9/2026)

Đối chiếu từng ngăn lộ đường dây còn hở trên sơ đồ kết dây với sơ đồ PDF:

| Tuyến | Căn cứ trên sơ đồ PDF |
|---|---|
| 171E6.19 - 171E14.1 Tuyên Quang | "AC185+240 - 32.9km", cột 111, 163 |
| 173E6.20 - 172E6.21 | ACSR400/2.84 xuống, AC400/2.88 sang trái tới cột 18, lên ngăn 172 E6.21 |
| 174E6.20 - 171E6.5 | ACSR400/2.84 + AC185-1.78 đi thẳng xuống |
| 172E6.5 - 172E6.23 | AC185-2.0, AC400/2.88 sang cột 27, AC400/4.15 xuống, qua cột 33 |
| 174E6.16 - 171E6.7 | AC400/4.28 tới cột 17, AC400/0.08 |
| 173E6.16 - 172E6.18 | "173 AC400/8.38 Dưới" (nhãn 173 E6.16 ở E6.18 xác nhận) |
| 182E6.16 - 171E6.17 | "182 AC400/12.98 Dưới" (nhãn 182 E6.16 ở E6.17 xác nhận) |
| 172E6.2 - 171A6.15 | AC400/5.2 thẳng xuống NM NĐ An Khánh |
| 176E6.20 - 172A6.15 | AC400/2.15 - cột 57 - AC400/4.2 - cột 52 - AC400/5.2 |

Sửa lại ba tuyến trước đây nối sai: 171E6.7 nối 174E6.16 (không phải 173E6.16);
hai lộ E6.5 không đi 173/174E6.20 như bản trước mà như bảng trên; tuyến 171E6.2 -
172E6.4 bỏ chiều dài 5,2km (đó là của lộ đi An Khánh), ghi "ACSR400 + AC400/3,3km".

Còn hai ngăn lộ 175, 176 E6.2 ghi nhãn đi "A60" nhưng sơ đồ PDF không có nên chưa nối;
các ngăn 175-181 E6.25 sơ đồ PDF chưa vẽ (thuyết minh ghi E6.25 có 04 lộ 171-174).

### Chỗ còn phải rà soát

* Nhãn `173 E26.1 Bắc Kạn` đặt ở E6.6 Phú Lương, nhưng sơ đồ kết lưới vẽ
  172E6.6 - 172E6.22 rồi mới 171E6.22 - 173E26.1. Phần mềm đang vẽ theo sơ đồ kết
  lưới (E6.6 - E6.22 - E26.1).
* Ngăn 172 E6.21: đọc kỹ lại sơ đồ kết lưới thì lộ này đi 173E6.20 (qua cột 18),
  không phải 171E6.16 như ghi chú trước; đã nối theo sơ đồ.

### Cách trình bày tuyến kết lưới

Đường đi của 26 tuyến do `tools/noi-duong-day-110.mjs` tính bằng A* trên lưới ô 60
đơn vị. Ngoài các ràng buộc cũ (cấm cắt qua trạm khác, phạt rẽ, phạt ô đã có tuyến),
có thêm hai quy tắc phục vụ việc vẽ tiếp lưới trung áp:

1. **Dải để dành trung áp** - một dải sâu 560 đơn vị ngay dưới mỗi trạm bị phạt
   420/ô (trừ ba trạm 220kV ngoài địa bàn, vốn không vẽ lưới trung áp).
2. **Bám theo hình vẽ thật** - toàn bộ hình học của bản CAD được "rải" lên lưới ô:
   ô có thiết bị trung áp 35/22/10/6/0,4kV (nới rộng thêm một ô) bị phạt 5200/ô, ô
   có hình vẽ khác bị phạt 1100/ô. Cách này chính xác hơn cách ước lượng cũ (lấy
   mép dưới hàng ngăn lộ 110kV làm ranh giới), vì mỗi trạm bố trí một kiểu - có
   trạm ngăn lộ 110kV chĩa xuống chỗ trống, có trạm chĩa xuống ngay phía trên
   thanh cái 22kV.
3. **Giữ đúng gấp khúc vuông góc** - toàn tuyến chỉ gồm đoạn thẳng ngang hoặc dọc,
   không có đoạn xiên. Đoạn vươn ra từ đầu ngăn lộ được kéo tới đúng một đường của
   lưới tìm đường; hai tuyến rẽ trùng một ô thì bị phạt thêm 1400 nên góc rẽ tự
   tách ra (trước đây dùng cách vạt góc, nhưng vạt góc sinh ra đoạn xiên 45 độ nên
   đã bỏ).

Chỗ giao chéo được chèn **nửa hình tròn nhảy dây** (bán kính 24 đơn vị, 8 đoạn cung;
tự thu nhỏ tới tối thiểu 9 đơn vị khi sát góc rẽ). Song song với ký hiệu hình vẽ,
mỗi tuyến kết lưới mang cờ `khongNoiGiua`, nên trong mô hình điện nó **chỉ đấu ở hai
đầu** - 86 điểm giao chéo không bị hiểu nhầm là điểm đấu nối, Shift+M tô sáng mạch
không còn lem sang tuyến khác.

Số liệu sau khi chạy: 40/40 tuyến · 1368 đỉnh · 113 ký hiệu nhảy dây · 0 đỉnh trùng ·
0 đoạn chồng nhau · 0 đoạn xiên · 0 chỗ giao chéo thiếu ký hiệu · 2 đỉnh còn nằm trong
vùng trung áp.

### Đầu dây ra đã sửa lại (bản ngày 23/9/2026)

| Trạm | Trước | Nay |
|---|---|---|
| E6.14 Yên Bình 2 | đường dây vươn lên 150 đơn vị vào phần 22kV rồi quay đầu xuyên xuống qua ngăn lộ | vươn lên 30 đơn vị rồi chạy ngang ra khỏi trạm |
| E6.20 220kV Lưu Xá | đấu vào đầu mút giữa ngăn lộ (sát dao -2), đường dây cắt ngang qua dãy ngăn lộ giữa hai thanh cái | đấu vào đúng 6 mũi tên đầu dây ra phía dưới (nhãn "GANG THÉP 17 E6.9"...), đi trong khe hở dưới trạm |
| E6.5 Lưu Xá | đấu vào hai điểm KHÔNG thuộc cột ngăn lộ 171/172 | đấu vào đầu trên của ngăn lộ 171, 172 (nhãn "173E6.20...", "174E6.20...") |
| E6.17, E6.18 | chọn theo hàng đông đầu mút nhất | theo nhãn nơi đến (bỏ mã định dạng "qc;") |

Công cụ chạy lại được nhiều lần trên cùng một file: mở đầu nó xoá hết các đối tượng
thuộc hai lớp CAD `Kết lưới 110kV` và `Trạm ngoài tỉnh` do chính nó sinh ra.

## 5.2 Quy tắc phân loại cấp điện áp

| Đối tượng | Căn cứ | Độ tin cậy |
|---|---|---|
| Đường dây | **Số hiệu ngăn lộ** ghi cạnh nó (171, 431, C41…) rồi mới đến tên lớp | Cao |
| Thiết bị | **Đường dây đấu vào nó** (trừ máy biến áp) rồi mới đến tên block / tên lớp | Cao |
| Chữ | Đường dây gần nhất, rồi mới đến số hiệu của chính nó | Cao |

Trước đây phần mềm tin **tên lớp** CAD, nhưng đối chiếu bản vẽ cho thấy tên lớp sai
khá nhiều chỗ, và mỗi chỗ sai là một ngăn lộ hai màu trên màn hình:

| Chỗ | Tên lớp trong CAD | Thực tế |
|---|---|---|
| Ngăn 433/481/483/485/487 của E6.5 Lưu Xá | `35-DZ 35` | 22kV (nối vào thanh cái C43) |
| Cả trạm E6.25 Phú Bình 2 | `10-DZ 10` | 110kV (ngăn 171-1, 172-1, C11, C12) |
| Ngăn 231/232 (phía 220kV của AT1) | `110-ĐZ 110` / `220` | 220kV |
| Cầu chì, chống sét của E6.24 Đa Phúc, E6.7 Sông Công | lẫn lộn 22/35 | theo ngăn lộ |

Vì vậy nay lấy căn cứ theo **số hiệu ngăn lộ** (Thông tư 06/2025/TT-BCT) — xem mục 6.3.

**Các tờ có tên lớp CAD hoàn toàn không chứa cấp điện áp:**

| Tờ | Lớp CAD gốc | Ghi chú |
|---|---|---|
| E26.1 Bắc Kạn | `DUONGCHINH`, `DMANH`, `DTAM`, `THANHCAI`, `DUONGBAO` | Do đơn vị khác vẽ |
| E26.2 Chợ Đồn | như trên | |
| E6.13 Yên Bình | `LINE` (1361 đường) | |

Những tờ này ra đúng cấp điện áp hoàn toàn nhờ số hiệu ngăn lộ. Tên lớp CAD gốc vẫn
được giữ lại trong từng đối tượng (`srcLayer`), nên nếu còn chỗ nào cần sửa tay thì
dùng **Dữ liệu → Gán cấp điện áp theo lớp CAD gốc…**.

## 5.3 Thống kê sau khi trích xuất

27 tờ, 25.387 đối tượng. Một số tờ tiêu biểu:

| Tờ | Tuyến | Thiết bị | Chữ |
|---|---|---|---|
| E6.2 – 220kV Thái Nguyên | 505 | 758 | 667 |
| E6.5 – 110kV Lưu Xá | 113 | 136 | 154 |
| E6.9 – 110kV Gang Thép (có cấp 6kV) | 633 | 352 | 353 |
| E6.18 – 110kV Yên Bình 3 | 1.718 | 197 | 298 |
| TỜ1 – Sơ đồ liên thông 220-110kV | 794 | 2 | 536 |
| TỜ2 – Đường dây trung áp E6.2 / E6.5 | 2.738 | 612 | 1.058 |

Thiết bị của TBA 110kV Lưu Xá (E6.5) sau khi phân loại — khớp với một trạm
110/35/22kV hai máy biến áp:

* **110kV**: 5 MC, 10 DCL, 16 dao tiếp địa, 5 CSV, 5 TI, 4 TUC, 2 MBA 3 cuộn
* **35kV**: 2 MC, 10 MCHB, 12 TI, 11 dao tiếp địa, 2 CSV, 2 TUC
* **22kV**: 3 MC, 11 MCHB, 11 TI, 15 dao tiếp địa, 2 CSV, 2 TU, 1 MBA phân phối

---

# 6. Sơ đồ kết dây khổ A0 (bản dựng hiện hành)

## 6.1 Vùng lấy dữ liệu

File CAD tổng chứa **ba bản** của cùng bộ sơ đồ trạm:

| Vùng X | Nội dung |
|---|---|
| ~717.000 | Tờ "Lưới điện 220kV-110kV khu vực tỉnh Thái Nguyên" (sơ đồ liên thông) |
| ~725.000 – 735.000 | Hai tờ sơ đồ đường dây trung áp (372+373 E6.2, 371-375 E6.5, 472 E6.2) |
| **741.100 – 750.700** | **Tờ A0 "Sơ đồ kết dây lưới điện tỉnh Thái Nguyên"** — bản đã ghép, đúng với file PDF xuất từ AutoCAD |
| > 800.000 | Bản xếp theo cột, mỗi trạm một tờ (dùng để in rời) |

Bản dùng cho phần mềm là **tờ A0** (9.632 × 14.871 đơn vị bản vẽ, 23.811 đối tượng CAD),
vì đây chính là bố cục Phòng Điều độ đang dùng. Vị trí 25 trạm trong tờ được xác định
bằng cách gom cụm đối tượng liền nhau quanh từng tiêu đề, rồi cắt đôi phạm vi tại điểm
giữa hai tiêu đề với các trạm vẽ sát nhau.

## 6.2 Ba lỗi đã sửa khi dựng lại ký hiệu

| Lỗi | Nguyên nhân | Cách sửa |
|---|---|---|
| Thiết bị lệch 90° | Hình học block trong phần mềm được xoay về trục dọc (`normRot`) nhưng khi nhập không trừ lại | `rot = rot_CAD − mirror × normRot` |
| Thiết bị không lật | CAD lật thiết bị bằng hệ số tỷ lệ âm, phần mềm lấy trị tuyệt đối | Thêm thuộc tính `mirror` cho thiết bị |
| Thiết bị lệch vị trí | Block CAD lấy điểm chèn làm gốc, block phần mềm lấy tâm hình | Lưu `origin` của từng block và bù lại theo góc xoay, tỷ lệ, lật gương |

Ngoài ra: máy cắt vẽ **rỗng** đúng như bản CAD (tô đặc là tuỳ chọn), và hình tròn rời
trong CAD (cuộn dây máy biến áp) được giữ nguyên là hình tròn thay vì quy về ký hiệu cột.

## 6.3 Cấp điện áp lấy theo ký hiệu ngăn lộ

Quy ước chữ số đầu (Thông tư 06/2025/TT-BCT): 1→110kV, 2→220kV, 3→35kV, 4→22kV,
5→500kV, 6→6kV, 7→10kV, 9→0,4kV. Áp dụng cho cả tên thanh cái (C11, C31, C41, C61).

Bộ nhập chỉ nhận các chuỗi thật sự là tên thiết bị (171, 171-7, TU171, TI131, TBN 401,
KH401, C41…) và loại bỏ những thứ trông giống số nhưng không phải (AC-240, 250kVA,
115/38,5/6,3 kV, 2x40 MVA).

Trình tự gán (hàm `capDienApTuyen` trong `src/io/dxfImport.ts`):

1. **Gom mạch.** Đoạn dây chạm nhau — kể cả rẽ nhánh chữ T vào giữa thanh cái — được
   gom thành một mạch bằng thuật toán hợp-tìm (union-find). Về điện thì chỗ chạm nhau
   bắt buộc cùng một cấp.
2. **Nhãn bỏ phiếu cho đoạn gần nó nhất.** Nếu trong tầm có đoạn mà tên lớp đã đúng cấp
   của nhãn thì ưu tiên đoạn đó — nhãn `131-08` của dao tiếp địa 110kV nằm sát đoạn cáp
   22kV của máy biến áp, không phân biệt thì đoạn cáp sẽ bị tô đỏ.
3. **Lan sang đoạn chưa có nhãn** theo số bước nối trong mạch (tối đa 4 bước): đoạn dây
   nối giữa hai thiết bị trong cùng một ngăn lộ không có nhãn riêng.
4. **Còn lại mới lấy theo tên lớp.**

Hai bẫy đã xử lý riêng:

* Dãy **tủ hợp bộ 6kV** của E6.8 Xi măng Thái Nguyên đánh số `C09, C10, C11 … C14`.
  Đó là số thứ tự tủ chứ không phải tên thanh cái (tên thanh cái không có chữ số 0),
  nên gặp kiểu đánh số này thì bỏ toàn bộ phiếu dạng `Cxx` của chỗ đó — nếu không cả
  dãy tủ 6kV bị tô thành 110kV.
* **Máy biến áp / tự ngẫu** nối hai cấp khác nhau nên không lấy cấp theo đường dây đấu
  vào; hai phía cũng không được gom chung một mạch.

Kết quả rà soát (`node tools/kiem-cap-dien-ap.mjs` — so số hiệu ngăn lộ với màu của
dây/thiết bị bên cạnh trên toàn bộ 2.191 nhãn của tờ A0):

| Cách làm | Số nhãn lệch |
|---|---|
| Theo tên lớp (bản cũ) | 274 |
| Nhãn bỏ phiếu theo mảng nối | 41 |
| Thêm nối chữ T + lan theo bước nối (bản hiện tại) | **13** |

13 chỗ còn lại phần lớn là báo nhầm của chính công cụ (dãy tủ C09-C14, nhãn dao tiếp
địa `131-08` nằm giữa hai cấp).

## 6.4 Thống kê tờ A0 sau khi dựng

18.891 đối tượng: 9.930 tuyến · 3.577 thiết bị · 629 hình tròn · 4.755 dòng chữ
(chưa kể ~28.000 nút của các tuyến). Phân bố theo cấp điện áp:
220kV 1.082 · 110kV 6.036 · 35kV 3.646 · 22kV 7.352 · 10kV 94 · 6kV 515 · 0,4kV 175.

Để tờ này kéo/phóng mượt, bộ vẽ dùng chỉ mục không gian dạng lưới (`src/render/index2d.ts`)
và bỏ qua đối tượng nhỏ hơn 1 pixel khi thu nhỏ: ~6 ms/khung khi phóng vào một trạm,
~36 ms/khung khi xem toàn tờ.

---

# 7. Rà soát ký hiệu (bản cập nhật)

## 7.1 Lỗi nối nhầm đầu mút — nguyên nhân gốc của nhiều hiện tượng lạ

Bước gộp các đoạn thẳng liền nhau thành tuyến dùng dung sai `span / 5000`. Với tờ
A0 cao 14.871 đơn vị thì dung sai là **≈3 đơn vị CAD**, trong khi chi tiết nhỏ nhất
của một ngăn lộ chỉ khoảng 3-4 đơn vị. Hậu quả: hai đầu mút khác nhau bị coi là
một, polyline nối tắt qua khoảng trống và **vẽ thêm nét không có trong bản gốc**.

Ví dụ tại dao cách ly 172-7 của E6.13, bản CAD có:

```
(745799.81, 987.39)-(745799.81, 1033.62)   thanh dẫn phía trên khe
(745799.81, 971.24)-(745799.81,  953.05)   thanh dẫn phía dưới khe
(745796.19, 987.39)-(745799.81,  987.39)   mấu tiếp điểm trên
(745796.19, 966.71)-(745799.81,  966.71)   mấu tiếp điểm dưới
(745799.81, 971.24)-(745802.84,  980.10)   lưỡi dao
```

Phần mềm nối nhầm các mấu tiếp điểm thành một hình thang kín → trông như dao cách
ly có dao tiếp địa liên động. Dung sai nay là `span * 2e-6` (≈0,03 đơn vị) và khi
nối còn kiểm tra khoảng cách thật giữa hai đầu mút, không chỉ dựa vào ô lưới.

## 7.2 Ba lỗi đặt block đã sửa

Xem mục 6.2. Bổ sung: hình tròn rời (cuộn dây MBA, vòng tròn TU/TI) giữ nguyên là
hình tròn; máy cắt vẽ rỗng đúng bản CAD.

## 7.3 Nhận dạng ký hiệu vẽ bằng nét rời

`src/io/nhanDangBlock.ts` chạy trên **đoạn thẳng gốc**, trước bước gộp tuyến — nếu
chạy sau thì cần và lưỡi dao đã dính vào đường dây, không còn nhận ra hình được.

| Dạng | Dấu hiệu | Kết quả |
|---|---|---|
| Máy cắt | 4 đoạn khép kín thành hình chữ nhật, tỷ lệ cạnh 0,3-1,0, hai cạnh ngắn có dây nối | 377 |
| Biến dòng TI | vòng tròn bán kính 0,4-6 đơn vị nằm cạnh đầu mút một đoạn dây | 800 |
| Dao cách ly | khe hở 6-24 đơn vị trên đường dây + lưỡi chéo ở mép khe | **tắt** |
| Dao tiếp địa | 3 vạch song song ngắn dần + cần + lưỡi dao | **tắt** |

Hai dạng sau đã thử và **bị tắt lại**: dao cách ly / dao tiếp địa vẽ tay có tỷ lệ
khác hẳn block (khe hở 16 đơn vị trong khi block chỉ 4,8), quy về block thì ký hiệu
to gấp 3 lần và đè lên các chi tiết xung quanh. Bật lại bằng `macDinhNhanDang()`
trong `src/io/nhanDangBlock.ts` nếu muốn thử nghiệm tiếp.

## 7.4 Khung bản vẽ A0

`src/data/khungA0.ts` sinh khung theo TCVN 7285 (ISO 5457): mép giấy 841x1189mm,
lề trái 20mm, ba lề còn lại 10mm, khung tên 300x120mm ở góc dưới phải. Tỷ lệ quy
đổi chọn sao cho toàn bộ nội dung nằm gọn trong vùng vẽ, nên khung luôn bao trọn
sơ đồ. Khung nằm trên lớp riêng "Khung bản vẽ".

## 7.5 Sơ đồ địa lý không còn chồng lấn

`buildDefaultDrawing()` chạy sẵn `declutterSubstations(store, 1200, 18)`: đẩy các
khối trạm ra cho tới khi không cặp nào giao nhau, đồng thời giới hạn độ lệch tối đa
18 km so với toạ độ địa lý đã khai. Kiểm thử tự động (`tools/smoke-test.mjs`) xác
nhận 0 cặp chồng lấn.
