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
