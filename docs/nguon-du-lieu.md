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

## 5.2 Quy tắc phân loại cấp điện áp

| Đối tượng | Căn cứ | Độ tin cậy |
|---|---|---|
| Thiết bị | **Tên block** ("110-MC", "35-DCL", "22-MCHB", "MBA 110-35-22") rồi mới đến tên lớp | Cao |
| Đường dây | Tên lớp ("110-ĐZ 110", "35-DZ 35", "22-DZ 22", "6-DZ 6") | Cao, trừ các tờ dưới đây |
| Chữ | Tên lớp | Trung bình |

Ưu tiên tên block là cần thiết: trong file CAD, cùng một máy cắt 110kV có thể được
chèn trên lớp bất kỳ tuỳ người vẽ. Trước khi sửa, 5 máy cắt 110kV của E6.5 bị nhận
nhầm thành 220kV và 2 máy biến áp 3 cuộn bị nhận thành 35kV.

**Các tờ cần rà soát cấp điện áp đường dây** (tên lớp CAD không chứa cấp điện áp,
phần mềm phải để mặc định 22kV):

| Tờ | Lớp CAD gốc | Ghi chú |
|---|---|---|
| E26.1 Bắc Kạn | `DUONGCHINH`, `DMANH`, `DTAM`, `THANHCAI`, `DUONGBAO` | Do đơn vị khác vẽ |
| E26.2 Chợ Đồn | như trên | |
| E6.13 Yên Bình | `LINE` (1361 đường) | Phần 110kV bị gán nhầm 22kV |

Tên lớp CAD gốc được giữ lại trong từng đối tượng (`srcLayer`), nên sửa bằng
**Dữ liệu → Gán cấp điện áp theo lớp CAD gốc…** chỉ mất vài giây cho cả tờ.

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

## 6.3 Suy cấp điện áp từ ký hiệu ngăn lộ

Quy ước chữ số đầu (Thông tư 06/2025/TT-BCT): 1→110kV, 2→220kV, 3→35kV, 4→22kV,
5→500kV, 6→6kV, 7→10kV, 9→0,4kV. Áp dụng cho cả tên thanh cái (C11, C31, C41, C61).

Bộ nhập chỉ nhận các chuỗi thật sự là tên thiết bị (171, 171-7, TU171, TI131, C41…) và
loại bỏ những thứ trông giống số nhưng không phải (AC-240, 250kVA, 115/38,5/6,3 kV,
2x40 MVA). Gợi ý được lập chỉ mục lưới rồi gán cho đối tượng gần nhất trong bán kính
bằng 1/25 kích thước tờ.

Kết quả: **4.518 đối tượng** trong tờ A0 được suy cấp điện áp theo cách này, trong đó:

| Trạm | Trước | Sau |
|---|---|---|
| E26.1 Bắc Kạn | tất cả 22kV | 110kV (402) · 35kV (442) · 22kV (278) |
| E26.2 Chợ Đồn | tất cả 22kV | 110kV (118) · 35kV (180) |
| E6.13 Yên Bình | hầu hết 22kV | 110kV (288) · 22kV (926) |

## 6.4 Thống kê tờ A0 sau khi dựng

19.316 đối tượng: 10.628 tuyến · 3.052 thiết bị · 881 hình tròn · 4.755 dòng chữ
(chưa kể ~28.000 nút của các tuyến). Phân bố theo cấp điện áp:
220kV 883 · 110kV 6.392 · 35kV 3.725 · 22kV 7.401 · 10kV 248 · 6kV 510 · 0,4kV 156.

Để tờ này kéo/phóng mượt, bộ vẽ dùng chỉ mục không gian dạng lưới (`src/render/index2d.ts`)
và bỏ qua đối tượng nhỏ hơn 1 pixel khi thu nhỏ: ~4 ms/khung khi phóng vào một trạm,
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
