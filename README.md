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

### Tài khoản và phân quyền

Mở phần mềm ra là **CHẾ ĐỘ XEM** (góc trên bên phải ghi "CHẾ ĐỘ XEM"): xem, phóng to,
tìm trạm, tô sáng mạch (Shift+M), điểm đấu nối (F4), đo, lưu và xuất file đều được,
nhưng các công cụ vẽ, thư viện thiết bị, mục menu sửa đổi đều ẩn và bản vẽ không sửa
được (kéo thả, xoá, hoàn tác, sửa thuộc tính đều bị chặn).

Muốn hiệu chỉnh: bấm **Đăng nhập**.

| Vai trò | Quyền |
|---|---|
| Chưa đăng nhập | Chỉ xem |
| Biên tập | Hiệu chỉnh sơ đồ |
| Quản trị | Hiệu chỉnh sơ đồ + thêm / xoá tài khoản, đặt lại mật khẩu, đổi vai trò |

Tài khoản mặc định: **admin / dieudob6** - phần mềm nhắc đổi mật khẩu ngay khi đăng
nhập bằng mật khẩu mặc định (menu tài khoản > *Đổi mật khẩu*). Không xoá hay hạ quyền
được tài khoản quản trị cuối cùng. Đăng nhập giữ đến khi đóng thẻ trình duyệt.

> **Lưu ý về an toàn:** phần mềm là một file HTML chạy trên máy người dùng, không có
> máy chủ. Danh sách tài khoản lưu trong bộ nhớ của trình duyệt **trên từng máy**
> (mật khẩu chỉ lưu dạng băm SHA-256 kèm muối, không lưu nguyên văn). Cơ chế này chặn
> việc sửa nhầm sơ đồ, nhưng **không chống được người cố tình can thiệp** vào mã nguồn
> trang. Muốn phân quyền thật sự cho nhiều người cùng dùng chung một sơ đồ thì phải
> đặt phần mềm lên máy chủ có đăng nhập.

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

### Trạng thái Đóng / Cắt của thiết bị đóng cắt

Hình ký hiệu đổi theo trạng thái (giữ màu theo cấp điện áp - phương án A đã duyệt),
in đen trắng vẫn phân biệt được:

| Thiết bị | Đóng | Cắt | Không xác định |
|---|---|---|---|
| Máy cắt, máy cắt hợp bộ, recloser | thân **tô đặc** | thân **để rỗng** | nét đứt, màu cam |
| LBS (dao cắt có tải) | thân hộp **tô đặc**, lưỡi dao chéo vắt qua thân | thân hộp **để rỗng** | nét đứt, màu cam |
| Dao cách ly | vạch chéo trên dây | lưỡi dao mở, **đường dây hở** ở khe dao | nét đứt, màu cam |
| Dao tiếp địa | lưỡi dao **nằm thẳng**, nối dây với đất | lưỡi dao mở | nét đứt, màu cam |

* **Đổi trạng thái** (chỉ tài khoản biên tập, đã đăng nhập): **nhấn đúp** vào thiết bị
  để đảo Đóng ↔ Cắt; hoặc **chuột phải** → Đóng / Cắt / Không xác định; hoặc ô
  Trạng thái trong bảng Thuộc tính. Hoàn tác được bằng Ctrl+Z. Ở chế độ xem mọi
  cách đổi đều bị chặn và có thông báo nhắc đăng nhập.
* Đường dây trên sơ đồ vẽ liền xuyên qua dao cách ly, nên khi dao **cắt** phần dây
  nằm trong khe hở của ký hiệu được che đi (trên màn hình, khi in, xuất SVG) và bị
  cắt bỏ khi xuất DXF - nhìn là thấy đường dây đã hở mạch. Đóng lại thì dây liền như cũ.
* **Rê chuột** lên thiết bị hiện nhãn, ví dụ “171 · Máy cắt · Đóng”.
* **Dữ liệu → Trạng thái thiết bị**: danh sách máy cắt / dao cách ly đang cắt, dao
  tiếp địa đang đóng, thiết bị chưa rõ trạng thái theo từng trạm; bấm dòng để nhảy
  tới thiết bị, tải về .csv cho Excel.
* **Khung chú giải** ký hiệu các trạng thái đặt trong khung A0 (tự chọn chỗ trống,
  hiện ở góc trên bên phải).
* Mô hình liên kết điện (tô sáng mạch, kiểm tra liên kết) coi thiết bị đang cắt là
  hở mạch. Xuất SVG / DXF: thân máy cắt đóng tô đặc (SOLID trong DXF), thiết bị chưa
  rõ trạng thái màu cam.

**Trạng thái ban đầu** (Phòng Điều độ duyệt): máy cắt, dao cách ly đều **Đóng**, dao
tiếp địa **Cắt**; Phòng tự chỉnh các dao cắt theo phương thức vận hành. Khi đặt lại,
26 “dao cách ly” nằm trong vòng tròn cuộn dây MBA ở các trạm vẽ tay (nét hình sao /
mũi tên điều áp bị nhận nhầm khi nhập từ CAD) đã được trả về nét vẽ thường.
Nhật ký thao tác và cảnh báo liên động chưa làm ở đợt này.

**Phương thức vận hành cơ bản** (theo kết dây): **MC 171 Thịnh Đán (E6.4), MC 112
Xi măng Thái Nguyên (E6.8), MC 171 Định Hóa (E6.22)** đặt ở trạng thái **Cắt**.
**MC liên lạc C08** tủ phân phối 6kV C.ty Xi măng Thái Nguyên (nhận hai nguồn lộ 671 từ
C61 và lộ 672 từ C62 của E6.8) cũng đặt **Cắt**: nếu đóng thì C61 cấp ngược qua tủ
khách hàng sang C62 dù đã cắt MC 632, 612.
Ngoài ra **51 dao cách ly nối thanh cái đường vòng (nhãn “xxx-9”)** ở E6.2, E6.16,
E6.20, E6.25 đặt **Cắt** theo phương thức bình thường (đóng lại khi dùng máy cắt vòng).
Danh sách ghi trong `tools/phuong-thuc-van-hanh.mjs` (tìm theo nhãn ngăn lộ trong
đúng trạm, lấy máy cắt gần nhãn nhất) - sửa bảng `CAT` ở đầu file rồi chạy lại
`node tools/phuong-thuc-van-hanh.mjs` khi phương thức thay đổi. Công cụ cũng đổi tên
**Trạm 110kV Đán → Trạm 110kV Thịnh Đán** trên tờ sơ đồ.

### Công suất chạy trên đường dây (trình chiếu)

**F6** (hoặc nút **CHẠY CÔNG SUẤT** ở thanh trạng thái, menu **Xem**) bật vạch sáng
chạy liên tục trên đường dây theo chiều công suất; **F11** vào chế độ **trình chiếu**
toàn màn hình (ẩn thanh công cụ và các bảng, tự bật công suất chạy), **Esc** để thoát.
Dùng được cả ở chế độ xem, vẫn kéo / phóng bản vẽ bình thường khi đang chạy.

* Công suất đi từ **thanh cái 220kV** (các trạm 220kV trong tỉnh và ngoài tỉnh) →
  máy biến áp tự ngẫu → thanh cái 110kV → đường dây 110kV → **xuyên qua MBA** (block
  MBA hoặc các vòng tròn cuộn dây) → thanh cái trung áp → xuất tuyến. Mạch không nối
  về được 220kV thì lấy thanh cái cấp cao nhất của mạch đó làm nguồn.
* Gặp **thiết bị đang cắt** - máy cắt, máy cắt hợp bộ, **dao cách ly** (kể cả khi nét
  dây vẽ liền xuyên qua ký hiệu dao) - vạch sáng **dừng lại** ở đó, có vòng tròn
  màu cam nhấp nháy đánh dấu. Mạch vòng thì hai dòng gặp nhau ở giữa.
* **Tách hai đầu thì đoạn giữa mất điện**: đoạn dây, ngăn lộ, phân đoạn thanh cái bị
  cắt ra khỏi lưới có điện bằng thiết bị đang cắt thì không có công suất chạy (không
  lấy thanh cái của đoạn đó làm nguồn riêng). Chỉ mạch nào không nối được về lưới vì
  bản vẽ đứt nét mới lấy thanh cái cấp cao nhất của mạch làm nguồn.
* **Thanh cái đường vòng** (C19, C29 - nhận ra theo các dao -9 nối vào nó, ghi ở
  `vong` trong dữ liệu) ở E6.2, E6.16, E6.25: các ngăn lộ vẽ vắt qua nó không phải
  đấu nối, nên khi các dao -9 cắt thì thanh cái đường vòng không có điện.
* Mạch không nối được về lưới (bản vẽ đứt nét) chỉ lấy **phân đoạn thanh cái chính**
  làm nguồn; khúc thanh cái ngắn bị kẹp giữa dao cách ly và máy cắt đang cắt (vd giữa
  112-1 và MC 112) thì mất điện.
* Ở thanh cái chính vẽ kiểu không dùng chấm, nét dây cắt ngang thanh cái chỉ tính là
  đấu nối khi có dao cách ly / máy cắt của ngăn lộ ngay sát chỗ cắt; cáp tổng từ MBA vắt
  qua thanh cái xuống máy cắt tổng (vd cáp vào MC 632 vắt qua C62 E6.8) không phải
  đấu nối.
* Dây vẽ **nhảy qua** thanh cái / dây khác bằng nửa vòng tròn: đỉnh giữa hay chân
  vòng nhảy nằm sát thanh cái / dây kia nhưng quãng dây quanh đó đi xuyên sang hai
  phía - đó là chỗ cắt ngang, không phải rẽ chữ T. Đã sửa các chỗ cáp tổng MBA nhảy
  qua thanh cái / dây ngăn khác bị nối nhầm: C42 E6.4 (cáp T2 xuống MC 432), E6.23 (cáp
  vào MC 431 nhảy qua dây ngăn 413), E6.17 (cáp liên lạc C33 - C31 nhảy qua dây ngăn
  332).
* `node tools/ra-soat-co-lap-thanh-cai.mjs [--tram=E6.4] [--truy]` rà **thanh cái rò
  điện**: với từng trạm, từng cấp điện áp, cắt hết thiết bị đóng cắt cấp đó trong trạm
  (giữ nguyên các cấp khác) - thanh cái nào còn điện là có dây nối nhầm vào. Kết quả
  hiện tại: 0 lỗi; 3 trường hợp đã biết không phải lỗi (đoạn thanh cái ngắn phía MBA
  của MC 332 E6.5, E6.6; thanh cái 6kV NatSteel Vina E6.9 nhận thẳng từ MBA khách hàng).
* `node tools/kiem-cong-suat.mjs --cat=<số thứ tự thiết bị> --diem=x,y --truy=x,y` thử
  cắt thiết bị, kiểm tra điểm có điện, lần ngược đường công suất tới một điểm.
* Dây **vắt qua** thanh cái không phải là đấu nối: trạm vẽ có chấm đấu nối (vòng tròn
  nhỏ / block chấm) thì chỗ cắt không có chấm là vắt qua; trạm không dùng chấm thì chỉ
  chỗ dây cắt sát đầu thanh cái mới là đấu nối. Nét nằm ngang ngắn của ký hiệu nối
  đất, ký hiệu TU không còn bị nhận nhầm là thanh cái (nguồn).
* Tốc độ chạy 42 điểm ảnh/giây (bằng 0,6 lần bản đầu) - chỉnh ở `tocDo` trong
  `src/render/chayCongSuat.ts`.
* Nhánh cụt không mang tải (tới dao tiếp địa, chống sét van, TU, TUC…) không có
  vạch chạy; xuất tuyến có máy cắt thì vẫn chạy tới cuối dù kết thúc bằng dao tiếp
  địa đầu cáp. Máy biến áp (kể cả MBA phân phối, tự dùng) là phụ tải: công suất
  chạy tới máy dù phía hạ áp chưa vẽ tiếp.
* **Máy biến áp**: mọi đầu dây nằm trong hoặc chạm mép vòng tròn cuộn dây (không
  chỉ đúng tâm cuộn) đều được nối vào máy; mũi tên điều áp vẽ xiên vắt qua cuộn dây
  không tính là dây dẫn.
* **Khung tủ RMU, hộp khách hàng**: khung vẽ bằng lớp đường dây (nét khuất, hình chữ
  nhật khép kín bao thiết bị, vách ngăn giữa các ngăn tủ) được nhận ra và loại khỏi
  lưới - công suất không chạy vòng theo khung mà đi qua thanh cái và các ngăn tủ.
* Thiết bị đặt sát nhau không vẽ đoạn dây nối (dao cách ly kề máy cắt hợp bộ trong
  tủ khách hàng) được nối cực với cực; ký hiệu lệch khỏi trục dây thì mỗi cực chỉ bắt
  vào đoạn dây về phía mình.
* `node tools/kiem-cong-suat.mjs [--chi-tiet]` liệt kê theo trạm thanh cái / thiết
  bị chưa có công suất chạy tới. Hiện có **128/128 thanh cái** và **1.504/1.516**
  máy cắt, dao cách ly, MBA phân phối có công suất; phần còn lại là ngăn đã tháo lèo
  (ghi chú trên sơ đồ) hoặc cầu chì vẽ bằng nét rời.
* Đổi trạng thái thiết bị (tài khoản biên tập) là chiều công suất tính lại ngay
  (khoảng 0,5 giây trên tờ sơ đồ tổng).
* Chiều công suất là chiều **đi xa dần nguồn** trên sơ đồ (lưới trung áp vận hành
  hình tia), chưa phải trào lưu công suất tính toán; khi có số liệu P, Q từ SCADA
  sẽ gán thêm trị số và chiều thực cho từng nhánh.

Vạch sáng vẽ trên một lớp canvas trong suốt riêng chồng lên bản vẽ nên chạy đều
60 hình/giây kể cả khi xem toàn bộ tờ sơ đồ tổng. Mã nguồn: `src/core/dongCongSuat.ts`
(đồ thị hình học, cắt tại thiết bị mở, nguồn, Dijkstra đa nguồn, tỉa nhánh cụt) và
`src/render/chayCongSuat.ts` (vẽ).

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

## 5. Trang phụ: lưới 220-110kV theo vị trí địa lý (bản đồ nền + GIS)

Trang **"Lưới 220-110kV theo vị trí địa lý"** là bản đồ số (Leaflet) dựng từ dữ liệu
**GIS EVNNPC** (PA3504 khu vực Thái Nguyên cũ + PA3526 khu vực Bắc Kạn cũ, trích
xuất 25/9/2026): 31 trạm/điểm nút và 50 tuyến 110/220kV với **toạ độ và hướng tuyến
thật**, vẽ trên bản đồ nền.

* **Bản đồ nền** (nút lớp góc trên bên phải): Google Maps, Google vệ tinh, Esri
  (đường / địa hình / ảnh vệ tinh), Carto nền sáng, bản đồ nền NPC (mạng nội bộ),
  hoặc không nền. Nền đang dùng không tải được thì tự chuyển sang nền kế tiếp; không
  có mạng vẫn xem được trạm và tuyến trên nền trống.
* **Thanh bên trái**: thống kê (số TBA 220kV, 110kV, tổng km đường dây), bật/tắt lớp
  trạm và đường dây từng cấp, nhãn tên trạm (110kV hiện từ zoom ≥ 11), nhãn đường
  dây (zoom ≥ 12), nút **Toàn cảnh**, ô tìm kiếm (tên trạm, mã trạm, lộ đường dây).
* **Danh sách trạm xếp đúng thứ tự danh mục trạm** của phần mềm: E6.1, E6.2 … E6.25,
  E26.1 … E26.3 (so theo số), nhà máy A6.15, rồi các trạm ngoài địa bàn (E1.19 Sóc
  Sơn, E14.3 Sơn Dương, E26.5 Bắc Kạn), cuối cùng là điểm nút N1.
* Bấm một trạm/tuyến để phóng tới và xem thông tin (mã, số hiệu GIS, công suất, toạ
  độ, các đường dây đấu nối / chiều dài, đầu – cuối). Khung thông tin trạm có nút
  **Sơ đồ kết dây E6.x** để nhảy sang đúng trạm đó trên tờ kết dây.
* Trong **Danh mục trạm** (tờ kết dây), nút **Bản đồ** mở vị trí của trạm trên trang này.

Dữ liệu đặt tại `src/data/gisLuoi110.json` (trường `ma` là mã trạm theo danh mục của
Phòng Điều độ). Khi có bản trích xuất GIS mới, thay file này rồi build lại. Toạ độ
220kV Bắc Kạn (E26.5) trong GIS còn ghi chú *"ước lượng theo bản đồ Google, cần xác
nhận"*.

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
* Trang thứ hai — **"Lưới 220-110kV theo vị trí địa lý"** — là bản đồ nền + dữ liệu
  GIS EVNNPC (mục 5); từ khung thông tin trạm trên bản đồ bấm **Sơ đồ kết dây** để
  quay về đúng trạm trên tờ này.

### Ký hiệu thiết bị dựng lại đúng bản CAD

* **Nối đoạn thẳng**: dung sai gộp các đoạn thẳng liền nhau phải rất nhỏ. Lúc đầu
  dung sai lấy theo tỷ lệ bản vẽ (≈3 đơn vị CAD) nên hai đầu mút cách nhau vài
  đơn vị bị coi là một, phần mềm vẽ thêm nét nối **không có thật** — chính là hình
  "dao cách ly có liên động" giả ở E6.13. Nay dung sai nhỏ hơn 150 lần.
* **Dao cách ly + dao tiếp địa kiểu liên động (110kV, 35kV)**: các trạm vẽ tay (E6.13,
  E6.17, E6.20, E26.1, E26.2, E26.3...) vẽ dao cách ly lưỡi chéo mở, dao tiếp địa
  đặt ngay hai má dao cùng các nét liên động cơ khí.
  `tools/chuan-hoa-dcl-lien-dong.mjs` vẽ lại **80 cụm** (83 DCL, 131 dao tiếp địa)
  đúng kiểu các trạm dùng block (E6.5): DCL là vạch chéo trên đường dây liền, dao
  tiếp địa là nhánh ngang tách khỏi đường dây (…-76 phía đường dây, …-75 phía máy
  cắt, …-15/-14 hai phía DCL thanh cái — giữ đúng thứ tự và phía như bản gốc), ký
  hiệu đất ngoài cùng, nhãn đặt ngay đầu ký hiệu đất; bỏ lưỡi dao, tiếp điểm tĩnh
  và nét liên động. Ba dạng vẽ được nhận ra:
  - dao tiếp địa là block đè lên đường dây (73 cụm);
  - dao tiếp địa vẽ bằng **nét rời** (E26.3 Nà Phặc 110kV: 171, 172, 131, 112 — 7
    cụm): lấy dao cách ly mở làm mốc, dao tiếp địa lấy theo nhãn …-76/-75/-15… quanh
    nó (cùng số hiệu ngăn lộ, có vạch đất vẽ rời bên cạnh);
  - dao cách ly là **một nét chéo vắt qua đường dây liền** (371-7/1, 371-7/2 Nà
    Phặc; 371-7/1 Chợ Đồn).

  - **dao tiếp địa ngăn tủ 35kV vẽ song song đường dây**, nối vào bằng một cần
    ngang/gãy khúc (34 dao: E6.17 17, E26.2 8, E26.3 7, TU E6.8 2): đổi thành nhánh
    vuông góc tách ra đúng chỗ cần nối vào đường dây, như mọi dao tiếp địa khác.

  Cỡ ký hiệu theo cỡ chữ nhãn của ngăn lộ (tỷ lệ như E6.5); gặp đường dây song
  song sát bên (ngăn tủ đặt sát nhau) thì dao tiếp địa tự rút ngắn và nhãn chuyển
  xuống dưới ký hiệu. Dao tiếp địa đã vẽ vuông góc đường dây, tiếp địa trung tính
  MBA, dao phụ tải tủ RMU giữ nguyên.
* **Màu cấp điện áp vẽ nhầm lớp CAD** (`tools/ra-soat-cap-dien-ap.mjs`): cấp điện áp
  khi nhập lấy theo tên lớp CAD, mà bản gốc có chỗ vẽ nhầm lớp. Công cụ rà theo mô
  hình liên kết điện (các dây / thiết bị nối thông, không qua MBA, phải cùng cấp):
  - phần tử trung áp mang cấp mà trạm không có (theo tên thanh cái C3x/C4x… và tỷ lệ
    chiều dài dây) đổi về cấp trung áp của đảo điện - ví dụ các hộp **SEVT / SEMV
    quản lý ở E6.14** vẽ trên lớp 35kV nay về 22kV, dây 10kV lạc ở E6.13, E6.18;
  - đảo điện có thiết bị lẫn hai cấp thì theo nhãn ngăn lộ (4xx = 22kV…) - ví dụ phía
    23kV cuộn thứ ba MBA tự ngẫu AT1, AT2 E6.16 (ngăn 431, 432, TU4AT, CS4AT);
  - cuộn dây MBA vẽ bằng vòng tròn lấy cấp của dây đi vào nó; cuộn hạ áp MBA khách
    hàng 22/6kV lấy 6kV theo nhãn tỷ số; nét hình sao / tam giác trong cuộn theo màu
    cuộn - ví dụ cuộn 110kV MBA T1 E26.3, E26.2 đang tô vàng, cuộn 22kV MBA E6.13 tô đỏ.

  Không đổi dây / chống sét van ở cuộn 38,5kV của MBA 115/38,5/23kV (đúng là 35kV dù
  trạm không có thanh cái 35kV). Chạy lại bao nhiêu lần cũng được.
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

Khung tên **tự thu nhỏ** (300x120 → 260x104 → … → 160x62 mm, chữ nhỏ theo cùng tỷ lệ)
tới cỡ lớn nhất không đè lên hình vẽ; tờ sơ đồ tổng hiện dùng cỡ 160x62 mm, nằm gọn
dưới các đường dây 110kV ở góc dưới bên phải. Dòng chữ tên sơ đồ thừa của khung tên cũ
trong bản CAD đã được xoá.

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

| Ký hiệu | Dấu hiệu dò tìm |
|---|---|
| **Máy cắt** | bốn đoạn khép kín thành hình chữ nhật, hai cạnh ngắn có dây nối |
| **Máy cắt hợp bộ** | như trên, cộng thêm **hai cụm mũi tên** (tiếp điểm xe đẩy) ở trên và dưới thân |
| **Biến dòng TI** | vòng tròn đơn lẻ trên đường dây (cụm vòng tròn chồng nhau là cuộn dây TU/TUC/MBA) |
| **Dao cách ly** | khe hở TRỐNG trên đường dây + lưỡi dao chéo ở một mép khe |
| **Dao tiếp địa** | ba vạch song song ngắn dần (ký hiệu đất) + cần + lưỡi dao |

Trước khi dò hình, các nét **thẳng hàng** nối tiếp nhau được gộp lại: ở E26.1 mỗi
vạch của ký hiệu đất vẽ thành hai nửa trên/dưới trục nên không gộp thì không nhận
ra vạch nào.

Ký hiệu thay vào được đặt **đúng như hình vẽ tay**:

* dao nhận ra từ lưỡi chéo thì mang trạng thái **mở**, khe hở của ký hiệu bằng đúng
  khe hở đo được trên bản vẽ;
* ở mép khe còn lại thường có thêm một nét chéo ngắn là **tiếp điểm tĩnh** - phải
  lấy nét DÀI NHẤT làm lưỡi dao, nếu không ký hiệu sẽ quay ngược và lưỡi dao thật
  vẫn nằm lại thành nét rời (lỗi dao cách ly 110kV ở E26.1, E26.2, E26.3, E6.17);
* lưỡi dao quay về đúng phía như hình gốc. Lật gương trong phần mềm đổi dấu trục X,
  tức đổi luôn phía **chân** lưỡi dao, nên muốn đổi phía **ngọn** lưỡi thì phải lật
  gương ĐỒNG THỜI quay thêm 180°;
* dao tiếp địa kéo dài tới tận đoạn dây nối vào đường dây chính, không dừng ở ngọn
  lưỡi dao, nên không còn hở một quãng giữa ký hiệu và đường dây;
* máy cắt hợp bộ lấy cỡ theo toàn bộ chiều cao từ cụm mũi tên trên xuống cụm dưới;
  cánh mũi tên có nơi rộng hơn cả thân máy cắt (E26.3 Nà Phặc: cánh vươn 10,3 trong
  khi thân rộng 11,2) nên ngưỡng bề ngang phải nới tới 1,15 lần bề rộng thân.

Toàn tờ sơ đồ kết dây nhận được: **95 máy cắt · 169 máy cắt hợp bộ · 243 TI ·
139 dao cách ly · 311 dao tiếp địa**. Riêng E26.1 Bắc Kạn: 17 máy cắt, 9 máy cắt
hợp bộ, 33 dao cách ly, 68 dao tiếp địa, 14 TI - trước đây dao tiếp địa và TI không
nhận được cái nào.

### Đường dây 110kV nối giữa các trạm

Bản CAD gốc vẽ 25 trạm rời nhau, mỗi ngăn lộ 110kV chỉ là một mũi tên cụt kèm nhãn
ghi nơi đến (`171 E6.22 ĐỊNH HÓA`). Phần mềm nay **nối các ngăn lộ đó lại thành
đường dây**, căn cứ:

* chính các nhãn nơi đến trên bản vẽ (do Phòng Điều độ ghi) - 49 nhãn;
* sơ đồ **"Lưới điện 220kV-110kV khu vực tỉnh Thái Nguyên"** của Phòng Điều độ
  (mã hiệu dây, chiều dài, số mạch).

Tổng cộng **40 đường dây 110kV** được vẽ nối. Bảng đường dây trong
`tools/noi-duong-day-110.mjs` gọi tên hai đầu theo **số hiệu ngăn lộ** đúng như
Phòng Điều độ vẫn gọi (177E6.2 - 171E6.8), ví dụ:

| Đầu A | Đầu B | Dây | km |
|---|---|---|---|
| 171 E6.19 Đại Từ | 172 E6.12 Núi Pháo | AC185+AC240 | 10,7 |
| 177 E6.2 220kV Thái Nguyên | 171 E6.8 XM Thái Nguyên | AC185 | 17,04 |
| 178 E6.2 220kV Thái Nguyên | 172 E6.8 XM Thái Nguyên | AC185 | 17,04 |
| 171 E6.3 Gò Đầm | 171 E6.21 Sông Công 2 | AC400 | 4,28 |
| 172 E6.3 Gò Đầm | 172 E6.16 220kV Phú Bình | AC400 | 4,34 |
| 172 E6.13 Yên Bình | 172 E6.25 220kV Phú Bình 2 | AC400 | 5,3 |
| 171 E6.22 Định Hóa | 173 E26.1 Bắc Kạn | ACSR240 | 10,99 |
| 171/172 E6.9 Gang Thép | 171/172 E6.20 220kV Lưu Xá | AC300 | 7,8 (2 mạch) |
| 173 E6.20 220kV Lưu Xá | 172 E6.21 Sông Công 2 | ACSR400+AC400 | 5,72 |
| 174 E6.20 220kV Lưu Xá | 171 E6.5 Lưu Xá | ACSR400+AC185 | 4,62 |
| 172 E6.5 Lưu Xá | 172 E6.23 Yên Bình 8 | AC185+AC400 | (qua cột 27) |
| 174 E6.16 220kV Phú Bình | 171 E6.7 Sông Công | AC400 | 4,36 |
| 173 E6.16 220kV Phú Bình | 172 E6.18 Yên Bình 3 | AC400 | 8,38 |
| 182 E6.16 220kV Phú Bình | 171 E6.17 Phú Bình | AC400 | 12,98 |
| 172 E6.2 220kV Thái Nguyên | 171 A6.15 NM NĐ An Khánh | AC400 | 5,2 |
| 176 E6.20 220kV Lưu Xá | 172 A6.15 NM NĐ An Khánh | AC400 | |

Chiều dài lấy theo số ghi trên sơ đồ kết lưới; tuyến gồm nhiều đoạn thì cộng các
đoạn có ghi; đoạn nào sơ đồ không ghi thì để trống chiều dài, nhãn chỉ ghi mã hiệu dây.

#### Trạm 220kV ngoài địa bàn và NM Nhiệt điện An Khánh

Lưới 110kV Thái Nguyên - Bắc Kạn còn nhận điện từ bốn trạm 220kV **không thuộc địa
bàn PCTN** và NM Nhiệt điện An Khánh, bản CAD gốc chưa vẽ (chỉ ghi nhãn nơi đến ở
đầu ngăn lộ). Phần mềm bổ sung các nút đó và **11 đường dây 110kV**:

| Trạm | Ngăn lộ | Đi tới |
|---|---|---|
| **E26.5** 220kV Bắc Kạn | 171 | 171 E26.2 Chợ Đồn |
| | 172 | 172 E26.1 Bắc Kạn |
| | 173 | 171 E26.1 Bắc Kạn |
| | 174 | 171 E26.3 Nà Phặc |
| **E16.2** 220kV Cao Bằng | 171 | 172 E26.3 Nà Phặc |
| **E1.19** 220kV Sóc Sơn | 172 | 172 E6.7 Sông Công (AC2x185 - 11km) |
| | 174 | 171 E6.24 Đa Phúc (8,38km) |
| | 176 | 176 E6.16 220kV Phú Bình (15,94km) |
| **E14.1** 220kV Tuyên Quang | 171 | 171 E6.19 Đại Từ (AC185+240 - 32,9km) |
| **A6.15** NM NĐ An Khánh | 171 | 172 E6.2 220kV Thái Nguyên (AC400 - 5,2km) |
| | 172 | 176 E6.20 220kV Lưu Xá |

E1.19 Sóc Sơn đã có sẵn một **sơ đồ thu nhỏ ở góc dưới bên trái** bản vẽ gốc nên
chỉ lấy lại đầu ngăn lộ (và vẽ bù đoạn dây ra của ngăn 172 mà bản CAD bỏ sót).
E26.5, E16.2, E14.1 và A6.15 được vẽ thêm **phần thanh cái 110kV** (thanh cái + máy cắt + ngăn
lộ có ghi số hiệu), đủ để thể hiện điểm đấu nối chứ không vẽ sâu vào trạm; hình
này nằm trên lớp CAD riêng `Trạm ngoài tỉnh`. Sơ đồ kết lưới của Phòng Điều độ
không ghi mã hiệu dây và chiều dài cho các lộ lên 220kV Bắc Kạn và 220kV Cao Bằng
nên các tuyến đó **chưa có nhãn**, chờ bổ sung.

#### Tìm đúng đầu dây ra của ngăn lộ

Một ngăn lộ 110kV trong sơ đồ trạm có nhiều đầu mút hở: sát thanh cái, giữa hai dao
cách ly, và **đầu dây ra** ở ngoài cùng. Đấu nhầm vào đầu mút phía trong thì đường
dây sẽ được vẽ cắt ngang qua cả trạm. Vì vậy công cụ xác định **hàng đầu dây ra**
của từng trạm từ những ngăn lộ CÓ nhãn nơi đến (nhãn luôn đặt ở đầu dây ra), rồi
mới gán số hiệu cho các ngăn lộ còn lại theo hàng đó trở ra - có trạm vẽ đầu dây ra
so le nhau nên không chốt cứng một hàng. Chạy `XEM=1 node tools/noi-duong-day-110.mjs`
để in ra bảng *số hiệu ngăn lộ → toạ độ đầu dây ra*.

Lưu ý cách đọc nhãn nơi đến: **số trong nhãn là ngăn lộ của ĐẦU KIA**. Nhãn
`171 E6.8` đặt ở ngăn 177 của E6.2 nghĩa là lộ 177E6.2 đi tới ngăn 171 của E6.8.

Nhãn nơi đến được nhận ở ba cách ghi: `171 E6.22 ĐỊNH HÓA`, `174E6.20 LƯU XÁ` (dính
liền số và mã, ở E6.5) và `GANG THÉP 17 E6.9` (tên trạm đứng trước, ở trạm 220kV Lưu
Xá E6.20); mã định dạng MTEXT còn sót (`qc;`, `tz;`...) được bỏ đi. Với cách ghi thứ ba,
nhãn nằm dưới cả dãy TU, chống sét vẽ bằng nét rời rất ngắn, nên chỉ nhận đầu mút của
đoạn dây thật (dài từ 12 đơn vị) nằm bên phải điểm đầu nhãn.

**Cách đi dây cho gọn mắt** (`tools/noi-duong-day-110.mjs`): mỗi đầu ngăn lộ đi
thẳng ra khỏi trạm một đoạn tới 110 đơn vị - **co ngắn còn 30 đơn vị** nếu phía trước
là thiết bị trung áp hoặc trạm bên cạnh - rồi tìm đường bằng thuật toán **A\*** trên
lưới ô 60 đơn vị. Đường đi phải rời đầu ngăn lộ đúng theo hướng ngăn lộ chĩa ra và
**không được quay đầu 180 độ** (trước đây ở E6.14 đường dây vươn lên rồi quay ngược
xuống xuyên qua chính ngăn lộ):

* ô nằm trong phạm vi trạm khác bị **cấm** - đường dây không bao giờ cắt qua trạm;
* ô của chính hai trạm đầu cuối thì đi được nhưng **phạt nặng** (900/ô), nên đường
  dây thoát ra khỏi trạm ngay chứ không chạy dọc qua giữa trạm;
* trong trạm đầu cuối, phần nằm **phía sau hàng đầu ngăn lộ** (phía thanh cái, các
  ngăn lộ khác) bị phạt 9000/ô: đường dây phải chạy ngang **phía trước** các đầu
  ngăn lộ cho tới khi ra khỏi trạm, không cắt qua dãy ngăn lộ;
* hai trạm vẽ sát nhau thì ô ở khe hở thuộc về trạm **gần hơn**, để khe hở vẫn còn
  đường cho dây đi (khe giữa E6.20 với E6.21, E6.3 chỉ rộng khoảng 110 đơn vị);
* ô **đã có hình vẽ sẵn** của bản CAD (thanh cái, máy cắt, dao cách ly...) bị phạt
  1100/ô, nên đường dây không đè lên ký hiệu thiết bị;
* ô có **thiết bị trung áp 35/22/10/6/0,4kV** bị phạt 5200/ô - đó chính là chỗ phải
  để dành cho việc đấu tiếp lưới trung áp; ô sát bên (cách một ô) phạt nhẹ 1100/ô;
* mỗi lần rẽ bị phạt, nên đường đi ít gấp khúc nhất;
* ô đã có tuyến khác đi qua cũng bị phạt, nên các tuyến **tự tản ra song song**;
  chạy cùng chiều trong ô tuyến khác đã chạy bị phạt thêm 400/ô;
* **dải để dành cho lưới trung áp** ngay dưới mỗi trạm (xem ngay dưới) bị phạt
  420/ô, nên đường dây 110kV tránh xuống vùng sẽ vẽ lộ 35/22/6kV.

Sau khi tìm đường còn các bước sửa hình:

* **tách làn** - chỗ nhiều tuyến buộc phải đi chung một hàng ô (khe hở giữa hai
  trạm), các đoạn chồng nhau được dịch lệch nhau từng 12 đơn vị thành bó song song;
  đoạn ngang dời lên/xuống thì hai đoạn dọc hai bên chỉ dài ra hay ngắn đi, tuyến vẫn
  gấp khúc vuông góc;
* **bỏ nấc tí hon** - đầu ngăn lộ không nằm đúng đường lưới nên đôi khi còn một nấc
  gấp khúc vài đơn vị sát đầu ngăn lộ; dời đoạn song song phía trước cho thẳng hàng;
* **làm thẳng nấc gấp khúc** (tới 75 đơn vị) - tuyến đi ra khỏi ngăn lộ, rẽ ngang
  một quãng ngắn rồi lại đi tiếp theo hướng cũ (do đầu ngăn lộ lệch đường lưới ô 60
  đơn vị): dời cả đoạn dài phía sau cho thẳng hàng với đoạn trước (hoặc ngược lại),
  chỉ khi đoạn mới không chồng lên / chạm chữ T vào tuyến khác hay hình vẽ sẵn và
  không cắt thêm nét nào. Đã làm thẳng 52 nấc (còn 1 nấc 1 đơn vị ở tuyến ngắn nhất
  E26.1, cả hai đầu là đầu ngăn lộ nên không dời được);
* **ký hiệu nhảy dây** không vồng chạm vào tuyến ngang khác cắt cùng đoạn dọc ngay
  phía trên (hai nửa vòng xếp chồng thì thu nhỏ nửa vòng dưới).

Chạy xong, công cụ tự kiểm và in ra số đỉnh rơi vào vùng trung áp / đè lên hình vẽ
sẵn có, để dễ so sánh giữa hai lần chỉnh. Kết quả hiện tại: 40/40 tuyến, **0 đoạn
chồng nhau** (bản trước còn 14 đoạn, dài cộng lại khoảng 1.860 đơn vị), 0 đỉnh trùng,
0 đoạn xiên, 0 chỗ giao chéo thiếu ký hiệu nhảy dây, 2 đỉnh nằm trong vùng trung áp.

**Chỉ có đoạn thẳng ngang - dọc, gấp khúc vuông góc 90 độ** - đúng quy ước vẽ sơ
đồ nguyên lý, không có đoạn xiên nào. Hai chỗ dễ sinh đoạn xiên đều đã xử lý:

* đoạn từ đầu ngăn lộ vươn ra được kéo dài tới **đúng một đường của lưới tìm
  đường**, nên đoạn kế tiếp chỉ chạy theo trục vuông góc với nó;
* thay vì **vạt góc** hai tuyến rẽ trùng một điểm (cách cũ, sinh ra đoạn xiên 45
  độ), thuật toán **phạt thêm 1400 khi rẽ đúng ô mà tuyến khác đã rẽ**, nên các
  góc rẽ tự tách nhau ra - hiện còn **0 đỉnh trùng**.

Công cụ tự kiểm lại điều này sau mỗi lần chạy và in cảnh báo nếu còn đoạn xiên
(ký hiệu nhảy dây nửa hình tròn không tính, vì đó là ký hiệu quy ước).

Mỗi tuyến mang một nhãn **mã hiệu dây và chiều dài** đặt giữa đoạn dài nhất, và nằm
trên lớp riêng `110kV` với tên lớp CAD gốc là `Kết lưới 110kV` (tắt/bật được trong
bảng Lớp).

#### Dải để dành cho lưới trung áp

Mỗi trạm 110kV sau này còn phải vẽ tiếp các lộ 35/22/6kV đi ra phía dưới. Vì vậy
bộ định tuyến giữ sẵn một **dải sâu 560 đơn vị ngay dưới mỗi trạm** (trừ ba trạm
220kV ngoài địa bàn, vốn không vẽ lưới trung áp) và phạt 420/ô khi đi vào đó. Cộng
với việc phạt 5200/ô ở những ô có sẵn thiết bị trung áp, đường dây 110kV chạy vòng
phía trên hoặc đi men rìa chứ không bổ dọc qua thanh cái 22kV/35kV: trong 717 đỉnh
của 34 tuyến chỉ còn **23 đỉnh** nằm trong vùng trung áp.

#### Ký hiệu nhảy dây ở chỗ giao chéo

Chỗ hai đường dây cắt nhau **trên hình vẽ** mà **không** đấu nối với nhau được vẽ
bằng **nửa hình tròn** (bán kính 24 đơn vị, 8 đoạn cung) chèn thẳng vào tuyến đi
ngang - đúng quy ước "nhảy dây" của bản vẽ sơ đồ nguyên lý. Hiện có **46 ký hiệu
nhảy dây**, và **0 chỗ giao chéo còn thiếu ký hiệu**. Chỗ sát góc rẽ thì bán kính
tự thu nhỏ theo khoảng trống còn lại (tối thiểu 9 đơn vị).

Quan trọng hơn hình vẽ là **mô hình điện**: các tuyến kết lưới mang cờ
`khongNoiGiua` (`src/core/types.ts`), nên khi dựng nút điện (`src/core/lienket.ts`)
chúng **chỉ được đấu ở hai đầu**, đoạn giữa chỉ đi ngang qua. Nếu không có cờ này
thì mọi điểm giao chéo sẽ bị coi là điểm đấu và **Shift+M** (tô sáng cả mạch) sẽ tô
lem sang các tuyến không liên quan.

### Dời chữ ra khỏi ký hiệu thiết bị

Bản CAD gốc có nhiều nhãn nằm đè lên ký hiệu: số hiệu máy cắt ghi lọt vào trong thân
máy cắt (`173`), tên dao cách ly vắt qua lưỡi dao (`173-7`), tên TU chồng lên cuộn
dây, tên chống sét nằm trên thân chống sét (`CS1 T1`)... Trên AutoCAD nét mảnh nên
còn đọc được, còn trong phần mềm ký hiệu vẽ đậm (máy cắt đóng có thể tô đặc) nên chữ
bị lấp.

Khi mở tờ sơ đồ, `src/core/doiChu.ts` rà từng nhãn:

* nhãn **chạm nét vẽ** của thiết bị, hoặc **lọt vào trong thân** thiết bị (máy cắt,
  cuộn dây, TI...) thì coi là bị lấp. Ký hiệu nhỏ mà bản CAD vẽ bằng nét rời chứ
  không dùng block (chống sét, cầu chì) - đường gấp khúc khép kín, nhỏ - cũng tính;
* với nhãn bị lấp, thử các vị trí xung quanh **từ gần ra xa** (ưu tiên dời ngang để
  nhãn vẫn cùng hàng với thiết bị) và lấy chỗ đầu tiên **không chạm thiết bị nào,
  không đè nhãn khác, không cắt thêm đường dây nào** so với chỗ cũ;
* phạm vi tìm có giới hạn (sang ngang một bề rộng nhãn + 3 lần chiều cao chữ, lên
  xuống 2,5 lần) để nhãn không bị đẩy xa khỏi thiết bị mà nó ghi tên; không có chỗ
  thì giữ nguyên.

Kết quả trên tờ sơ đồ kết dây: **193/193 nhãn bị lấp đã được dời**, còn 0; thời gian
xử lý khoảng 0,3 giây khi mở phần mềm. Nhãn dời xa nhất là các dòng mô tả MBA dài
(`MBA T2 - 40/40/40 MVA ...`), vẫn nằm ngay cạnh MBA của nó.

### Danh mục trạm

Danh mục xếp theo số hiệu: **E6.2, E6.3 … E6.25 rồi mới tới E26.1, E26.2, E26.3**
(so theo số chứ không so theo chữ, nếu không E6.10 sẽ đứng trước E6.2). Tên rút gọn
giữ lại cấp điện áp để phân biệt **220kV Phú Bình (E6.16)** với **110kV Phú Bình
(E6.17)**.

Cuối danh mục, dưới dòng *"Trạm 220kV ngoài địa bàn có đường dây 110kV nối về"*, có
thêm **E1.19 220kV Sóc Sơn**, **E14.1 220kV Tuyên Quang**, **E16.2 220kV Cao Bằng** và
**E26.5 220kV Bắc Kạn**; bấm tên cũng phóng tới đúng trạm trên sơ đồ kết dây. Các dòng này do `tools/noi-duong-day-110.mjs` ghi vào danh
mục (cột thứ 9 của dòng trạm = 1 đánh dấu trạm ngoài tỉnh) và xoá đi khi chạy lại.
Danh mục nay có **29 trạm**. NM NĐ An Khánh (A6.15) là nhà máy nên không đưa vào danh mục trạm.

Bốn trạm 220kV được sửa lại tên cho đúng danh mục của Phòng Điều độ (bản CAD ghi
thiếu hoặc lẫn ký tự thừa); mã trạm giữ nguyên:

| Mã | Tên | Ghi trong file CAD |
|---|---|---|
| E6.2 | Trạm 220kV Thái Nguyên | TRẠM 220 KV THÁI NGUYÊN E6.2 |
| E6.20 | Trạm 220kV Lưu Xá | `i128.88;` TRẠM 220KV LƯU XÁ (E6.20) |
| E6.16 | Trạm 220kV Phú Bình | TRẠM 220KV PHÚ BÌNH |
| E6.25 | Trạm 220kV Phú Bình 2 | TRẠM 220KV PHÚ BÌNH 2 |

#### Màu cuộn dây máy biến áp 110kV

Mỗi cuộn dây máy biến áp tô **màu theo cấp điện áp của cuộn đó** (như E6.8: cuộn 110kV
đỏ, 35kV vàng, 22kV xanh dương, 6kV xanh lá, 10kV nâu). `tools/ra-soat-mba.mjs` đọc nhãn
tỷ số cạnh máy (vd "T1: 63000kVA 115/38,5/23 kV", "T2: 63000kVA 115/23/(6,3) kV",
"MBA T1: 63/63/21 MVA 115/23/11 kV") rồi gán cấp cho từng cuộn:

* cuộn có dây trung áp đấu vào giữ cấp của dây; cuộn còn lại (cuộn tam giác 38,5kV,
  11kV, 6,3kV chỉ đấu chống sét van hoặc để hở) lấy cấp còn lại trong nhãn - sửa
  E6.4 T1 (cuộn Δ 38,5kV), E6.4 T2 (Δ 6,3kV), E6.14 T4 và E6.23 T1, T2 (cuộn 11kV),
  E26.2 T1;
* **20 máy vẽ bằng block** (E6.5, E6.6, E6.7, E6.11, E6.12, E6.14, E6.18, E6.19,
  E6.21, E6.22, E6.24) trước đây tô một màu đỏ: nay mỗi cuộn một màu, cuộn cao áp có
  thêm mũi tên điều áp dưới tải; máy tự ngẫu 220kV (AT) giữ nguyên;
* dây trung tính, chống sét van đấu vào cuộn đổi màu theo cuộn.

Xuất DXF / SVG cũng giữ màu từng cuộn.

#### Đầu trạm 110kV vẽ ba nét song song

Đầu ra đường dây của ngăn lộ 110kV ở một số trạm vẽ bằng **ba nét song song**: nét giữa
là dây dẫn đi xuống ngăn lộ, hai nét ngắn hai bên chỉ là ký hiệu. Đường dây liên trạm
có chỗ bắt nhầm vào nét bên (lộ 171 E6.8 Xi măng Thái Nguyên) nên trạm không nối
được vào lưới. `tools/bo-net-dau-tram.mjs` bỏ hai nét bên ở **13 đầu dây** (E6.7,
E6.8, E6.9, E6.11, E6.12, E6.21) và dời đầu đường dây đang bắt nhầm sang nét giữa.
Công cụ cũng vá chỗ **đầu dây để hở ngay trước vòng nhảy** (cáp tổng MBA T1 E6.4 hở
5,2 đơn vị trước vòng nhảy qua C41 - trước đây chỉ "nối" được nhờ đỉnh vòng nhảy chạm
thanh cái).

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

#### Bắt điểm và kiểm tra đã nối hay chưa

* Khi vẽ, con trỏ **bắt thẳng vào cực đấu nối của thiết bị** (thanh trạng thái hiện
  "Cực đấu nối"), không còn bắt nhầm vào tâm ký hiệu rồi nối hụt. Các loại điểm có
  mức ưu tiên: **cực đấu nối** và **đầu dây / nút** hút từ xa (khoảng 45 pixel),
  đỉnh ở giữa tuyến vừa phải, còn **trung điểm, tâm ký hiệu** chỉ bắt khi đặt sát
  con trỏ; chữ ghi chú không còn hút con trỏ. Điểm bắt được là chỗ nối thì hiện ô
  vuông **xanh lá**, bắt vào giữa dây hiện dấu **×**.
* Chọn công cụ vẽ dây / thanh cái là **tự hiện lớp điểm đấu nối** (thôi vẽ thì tự tắt)
  để thấy ngay cực nào còn hở.
* Tìm điểm bắt dùng chỉ mục không gian của bộ vẽ nên rê chuột trên tờ sơ đồ tổng vẫn
  nhẹ.
* **F4** bật lớp **ĐIỂM ĐẤU NỐI**: mỗi cực được đánh dấu ngay trên bản vẽ —
  **ô vuông xanh đặc** = cực đã chạm vào dây dẫn, **ô vuông đỏ gạch chéo** = chưa nối.
  Vẽ xong một đoạn dây là thấy ngay ô đỏ chuyển thành ô xanh.
* **Dữ liệu → Kiểm tra liên kết điện…** liệt kê CHI TIẾT từng thiết bị còn thiếu
  (ký hiệu, nhãn ngăn lộ gần nhất, cấp điện áp, toạ độ, tình trạng). Bấm một dòng là
  nhảy tới đúng chỗ và chọn sẵn thiết bị đó để sửa.

Dùng trong phần mềm:

| Lệnh | Tác dụng |
|---|---|
| **F4** | Hiện / ẩn điểm đấu nối của mọi thiết bị |
| Chọn một đối tượng rồi **Shift+M** | Tô sáng toàn bộ mạch nối thông với nó |
| **Dữ liệu → Tô sáng cả chuỗi 110kV - MBA - trung áp** | Như trên nhưng đi xuyên máy biến áp |
| **Dữ liệu → Kiểm tra liên kết điện…** | Bảng thống kê + chọn nhanh thiết bị chưa đấu vào lưới |

Trên tờ sơ đồ kết dây hiện có: **1.471 nút điện, 807 mạch rời nhau, 98 cầu nối qua
máy biến áp**; **4.007/4.014 thiết bị (99,8%)** và **6.421/6.469 cực (99,3%)** đã đấu
được vào lưới. Dựng mô hình mất khoảng 0,25 giây.

Bán kính hút của con trỏ là 20 pixel, còn bán kính coi một cực là "đã chạm vào dây"
lấy theo cỡ ký hiệu (0,45 lần cỡ ký hiệu, riêng máy biến áp là 1,25 lần vì bản vẽ
kéo dây vào tận tâm cuộn dây) - bản CAD gốc nhiều chỗ để hở vài đơn vị giữa ký hiệu
và đường dây, siết chặt quá thì báo nhầm "chưa nối".

Hiển thị chiều công suất đã làm - xem mục **Công suất chạy trên đường dây** ở phần 3.

### Dựng lại bộ dữ liệu từ file CAD mới

```bash
dwg2dxf -o tong.dxf "So do luoi dien lien thong tinh Thai Nguyen.dwg"
pip install ezdxf
python3 tools/tach-so-do-tram.py tong.dxf tram/ --min-x 999999999 \
        --to-tong 'KẾT DÂY LƯỚI ĐIỆN' \
        --them-to 'LƯỚI ĐIỆN 220KV' --them-to 'ĐƯỜNG DÂY'
node tools/dung-du-lieu-tram.mjs tram/ src/data/tram-sld.json
node tools/chuan-hoa-dcl-lien-dong.mjs src/data/tram-sld.json
node tools/ra-soat-cap-dien-ap.mjs src/data/tram-sld.json
node tools/ra-soat-mba.mjs src/data/tram-sld.json
node tools/bo-net-dau-tram.mjs src/data/tram-sld.json
node tools/noi-duong-day-110.mjs src/data/tram-sld.json
node tools/phuong-thuc-van-hanh.mjs src/data/tram-sld.json
node tools/ve-luoi-trung-ap.mjs src/data/tram-sld.json
npm run build
```

---

## 7. Lưới trung áp liên thông (đang làm: cụm E6.4 - xong bản vẽ 17, 18)

Nguồn: bản vẽ từng lộ trên Google Drive (`So do luoi dien/1. Lưới trung áp KV Thái
Nguyên`, vd "18. ĐZ 472+477 E6.4.pdf", "7. ĐZ 473 E6.2.pdf"). Mỗi lộ chép sang một file
mô tả trong `tools/luoi-trung-ap/` (477E6.4.mjs, 473E6.2.mjs), rồi
`node tools/ve-luoi-trung-ap.mjs` vẽ lên tờ sơ đồ tổng, nối thẳng vào đầu ra ngăn lộ
trong trạm (lớp CAD gốc "Lưới trung áp", chạy lại được).

Quy ước thể hiện (đề xuất, chờ Phòng thống nhất):

* Chỉ **đường trục** và **nhánh có liên kết** với lộ khác; không vẽ TBA phân phối,
  không vẽ nhánh chỉ cấp cho TBA.
* Đủ các **đoạn dây / cáp**: cáp ngầm nét đứt, ĐDK nét liền; ghi loại, tiết diện, chiều
  dài đúng như bản vẽ (vd "3xAL/XLPE/PVC/DATA/PVC 1x400 - 1,76km", "ACSR 185",
  "Cu 3x185 - 250m"); đoạn bản vẽ không ghi thì để trống.
* **Tủ RMU** theo mẫu bản vẽ lộ: khung tủ, hàng tên tủ, hàng tên ngăn, thanh cái
  trong tủ; mỗi ngăn có dao cách ly **vẽ như DCL ngăn 110kV trong trạm (không hộp)** +
  **dao tiếp địa (-76, bình thường cắt)**, cáp đấu ở chân ngăn. Chỉ vẽ ngăn vào, ngăn ra
  (thêm ngăn rẽ nếu ngăn đó liên kết sang lộ khác, vd ngăn 477-7/02-2); bỏ ngăn dự
  phòng, ngăn cấp TBA khách hàng. Tủ nằm trên tuyến dọc: các ngăn xếp chồng theo tuyến,
  hàng tên tủ ở trên cùng, **mọi chữ vẫn nằm ngang** (không phải nghiêng đầu khi xem);
  nhãn dây / cáp trên tuyến dọc cũng ghi ngang, bên trái dây.
* **Thiết bị trên trục** đủ: DCL, DPT, LBS, recloser (MC … R, chữ R luôn ở phía
  trên/bên trái; đóng/cắt recloser thì công suất chạy đổi theo), đúng trạng
  thái kết dây cơ bản (thường cắt = Cắt). **Không vẽ tụ bù.** **Chỉ ghi các cột có
  thiết bị hoặc điểm rẽ nhánh liên kết** (bỏ cột đỡ thuần túy); nhánh rẽ ngay tại cột đó.
* **Giao chéo**: chỗ bản vẽ lộ ghi "Giao chéo …" vẽ một khúc đường dây kia (đúng cấp
  điện áp, vd 35kV) cắt ngang tuyến kèm tên; mọi chỗ đường trung áp cắt ngang đường dây
  khác mà không đấu nối (kể cả trong trạm) tự vẽ **vòng nhảy** nửa hình tròn - tuyến
  ngang nhảy lên, tuyến dọc nhảy sang trái. Vòng nhảy là nét riêng chỉ đấu ở hai đầu
  (danh sách `nhay` của tờ TONG), nên công suất chạy tiếp qua vòng nhảy mà không lan
  sang đường dây bị cắt ngang.
* Số cột ghi trên trục, tên thiết bị ghi dưới; phần dài còn thừa của cạnh rải đều giữa
  các phần tử.
* **Hai lộ nối liền nhau**: đường đi của 477 E6.4 và 473 E6.2 cùng kết thúc tại một điểm
  chung (DCL 472E6.4-7/25 Gia Bảy - thường cắt). 473 E6.2 đi tiếp qua đoạn 472E6.4
  Đồng Bẩm - Gia Bảy (MC 472E6.4/61 thường cắt, RMU 07-472, MC 472E6.4/25, nhánh
  LT 474E6.4 / LT 472E6.2) tới điểm đó. Đoạn này do 474E6.4 cấp - lộ chưa vẽ - nên
  hiện chưa có công suất chạy.
* **Ranh giới quản lý / vận hành**: vạch đứt ngang tuyến, hai bên ghi đơn vị / lộ
  (vd "473E6.2 ← | → 472E6.4", "Đồng Hỷ | Thành phố").
* Chỗ liên kết với lộ chưa vẽ: kết thúc bằng "→ LT …" (vd "→ LT 474 E6.4 (MC 472E6.4/25
  Gia Bảy)"); khi vẽ lộ đó sẽ nối liền.

Công suất chạy (F6) đi từ ngăn lộ theo trục, dừng ở các điểm thường cắt.

### 7.1. Nhập lộ thẳng từ hình học bản vẽ PDF (`tools/pdf-lo/`)

Từ cụm E6.4 trở đi các lộ không chép tay nữa mà **dò đường dây trên chính file PDF**
(bản vẽ xuất từ CAD còn giữ nét vector), giữ nguyên bố cục bản vẽ gốc:

```
PDF_DIR=<thư mục các file PDF> python3 tools/pdf-lo/xuat.py tools/pdf-lo/cfg17.json tools/luoi-trung-ap/pdf/17.json
node tools/ve-luoi-trung-ap.mjs      # đọc tools/luoi-trung-ap/pdf/dat.mjs, vẽ lên tờ tổng
```

* `dothi.py` dựng đồ thị đường dây: nét mảnh = dây (nét đứt ghép thành cáp), nét đậm =
  ký hiệu thiết bị (vẫn dẫn điện khi dò), bắc qua khe ở ký hiệu, qua chấm cột, nối chỗ
  giao chữ X.
* File cấu hình `cfg*.json` cho từng bản vẽ: `cam` = toạ độ các thiết bị **thường cắt**
  (chặn đường dò), `thanh_cai` = khung thanh cái trạm, `lo` = tên lộ + điểm đầu lộ +
  điểm cuối (nếu có), `bo_tb` = nhãn thiết bị nhánh rẽ cần bỏ.
* `xuat.py` đi từ đầu lộ tới mọi điểm thường cắt tới được → **đường trục + nhánh liên
  kết** (lưới hình tia khi mở các điểm thường cắt nên đường đi là duy nhất), gắn nhãn
  thiết bị lên đúng ký hiệu nằm trên đường, lấy loại dây / cáp, cột ở điểm rẽ, tủ RMU
  (ngăn vào / ra), ranh giới quản lý; thiết bị gần điểm "thường cắt" đặt trạng thái Cắt.
* `ve-luoi-trung-ap.mjs` đặt bản vẽ lên tờ tổng theo `dat.mjs` (điểm gốc, tỷ lệ, tuyến
  cáp nối từ ngăn lộ trong trạm), cắt dây ở hai cực mọi thiết bị đóng cắt (thiết bị cắt
  thì hở mạch thật), vẽ tủ RMU theo mẫu, tự thêm vòng nhảy chỗ giao chéo. Tuyến cáp nối
  phải đi cách các nét có sẵn ≥ 8 đơn vị để không thành chỗ đấu chữ T.

Đã nhập: **bản vẽ 17 - ĐZ 471, 473, 481 E6.4** (473: 38 thiết bị trên trục và nhánh
liên kết, 6 tủ RMU; 471: 16; 481: RMU 01-481 tới DCL 473E6.4-7/19). Các điểm thường
cắt: MC 473E6.4/64 (LT 473E6.3), LBS 473E6.4/14B (LT 471), DCL 473E6.4-7/19 (LT 481),
LBS 477E6.5/115, LBS 473E6.4/47 (LT 471E6.19), DCL 471E6.4-7/01.

**Bản vẽ 18 - ĐZ 472 + 477 E6.4 LT 471 + 473 E6.2** (thay lộ thí điểm 477E6.4.mjs):

* 477 E6.4: C41 → RMU 01-477 → RMU 02-477 (ngăn 477-7/02-2 **thường cắt**, ngăn 02-3 ra) →
  cột 48 → Gia Bảy tới DCL 472E6.4-7/25 (thường cắt); nhánh cột 60 → LBS 472E6.4/61
  (thường cắt, LT 471E6.2); nhánh 7A → RMU Công an tỉnh → DCL 472E6.2-7/21 (→ LT 472E6.2).
* 472 E6.4: C41 → RMU 01-472 → cột 32, 35 → MC 472E6.4/44 → cột 47 → DCL 7/48-1; cột 46 →
  chuỗi RMU 01, 02, 03-472 LT 474 (ngăn 472-7/02-2 thường cắt → LT 474E6.4) → cột 26 →
  DCL 7/25-1 → MC 472E6.4/25 Gia Bảy → RMU 07 Đồng Bẩm → MC 472E6.4/61 (thường cắt,
  LT 473E6.2); cột 26 → DCL 472E6.2-7/36 (thường cắt, LT 472E6.2 - DCL 34 Bảo Tàng).
* 471 E6.2: C43 E6.2 → cột 10 → MC 472E6.4/73 (thường cắt, LT 476E6.4) → xuống LBS 472E6.4/61.
* **Cột 48** vẽ liền trên bản vẽ nhưng theo kết dây cơ bản (477E6.4: 31 MBA, chỉ ngăn
  477-7/02-02 thường cắt) thì 472 và 477 không thể nối liền ở đây → coi là **điểm tách**
  (`ngat` trong cfg18.json). Đoạn từ cột 48 về phía Gia Bảy do 477 cấp.
* Lộ thí điểm 473E6.2.mjs nay dừng ở đầu dây "473 E6.2 đến" của bản vẽ 18 (trên MC 61).

Công cụ dò đã bổ sung: ghép cạnh khung tủ vẽ thành nhiều đoạn; dây nhảy qua (cung
nhỏ) không coi là nối; `bo_noi` (hộp bỏ nối chỗ bản vẽ đè nét); tủ RMU ghi mọi ngăn có
dây nối ra và ngăn "(Thường cắt)"; ký hiệu hộp (MC, LBS) lấy tâm cụm nét đậm.

Kiểm tra: `node tools/ra-soat-co-lap-thanh-cai.mjs` (không thanh cái nào còn điện khi
cô lập) và smoke test (cắt MC 473 thì trục 473 mất điện, 471/481 vẫn có điện; cắt MC
477 chỉ mất điện trục 477, cắt MC 472 chỉ mất điện trục 472; đóng MC 472E6.4/61 thì
473E6.2 cấp ngược sang Đồng Bẩm).

## 8. Đưa sơ đồ lưới trung áp từ CAD vào (giai đoạn 3)

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

## 9. Lưu và xuất

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

## 10. Cấu trúc mã nguồn

```
src/
├── core/        types.ts (mô hình dữ liệu) · doc.ts (kho dữ liệu + Undo/Redo)
│                voltage.ts (quy ước màu) · geom.ts (hình học)
│                lienket.ts (nút điện - cực thiết bị - mạch, nền cho chiều công suất)
│                dongCongSuat.ts (chiều công suất: dừng tại thiết bị cắt, qua MBA)
│                doiChu.ts (dời nhãn ra khỏi ký hiệu thiết bị khi mở tờ sơ đồ)
│                taiKhoan.ts (tài khoản, phân quyền, băm mật khẩu SHA-256)
├── symbols/     prims.ts (nguyên thuỷ hình học) · blocks.ts (23 ký hiệu thiết bị)
├── data/        geo.ts (phép chiếu, ranh giới, địa danh)
│                grid110.ts (danh mục trạm + đường dây + mã hiệu dây)
│                seed.ts (dựng bản vẽ mặc định)
│                tram-sld.json + tramSheets.ts (sơ đồ kết dây trích từ file CAD)
├── render/      viewport.ts · shapes.ts (sinh hình + bắt điểm) · renderer.ts (canvas)
│                chayCongSuat.ts (vạch sáng công suất chạy - trình chiếu)
│                index2d.ts (chỉ mục không gian cho tờ hàng chục nghìn đối tượng)
├── editor/      editor.ts (công cụ vẽ) · snap.ts (bắt điểm) · declutter.ts (giãn trạm)
├── io/          dxfExport.ts · dxfImport.ts · file.ts
└── ui/          app.ts (khung giao diện) · palette.ts · props.ts · dom.ts
docs/            dữ liệu trích xuất từ file CAD gốc
tools/           tach-so-do-tram.py     — tách từng tờ sơ đồ trạm từ file CAD tổng
                 dung-du-lieu-tram.mjs  — dựng src/data/tram-sld.json
                 chuan-hoa-dcl-lien-dong.mjs — vẽ lại DCL + dao tiếp địa kiểu liên động (110/35kV)
                 ra-soat-cap-dien-ap.mjs — sửa màu (cấp điện áp) vẽ nhầm lớp theo liên kết điện
                 phuong-thuc-van-hanh.mjs — đặt các máy cắt cắt theo kết dây cơ bản, sửa tên trạm
                 bo-net-dau-tram.mjs    — bỏ 2 nét thừa ở đầu trạm 110kV ký hiệu 3 nét song song; vá dây hở trước vòng nhảy
                 ra-soat-co-lap-thanh-cai.mjs — cô lập từng thanh cái, tìm chỗ nối nhầm (thanh cái rò điện)
                 ra-soat-mba.mjs        — gán cấp điện áp (màu) từng cuộn dây MBA theo nhãn tỷ số
                 ve-luoi-trung-ap.mjs   — vẽ lộ trung áp (trục + nhánh liên kết) từ tools/luoi-trung-ap/*.mjs
                 smoke-test.mjs         — kiểm thử bằng trình duyệt thật
                 noi-duong-day-110.mjs  — nối đường dây 110kV giữa các trạm (A*)
                 kiem-cap-dien-ap.mjs   — rà soát cấp điện áp theo số hiệu ngăn lộ
                 kiem-cong-suat.mjs     — thanh cái / thiết bị chưa có công suất chạy tới
                 xem-vung.mjs           — chụp một vùng sơ đồ để đối chiếu (MAN_HINH=1: như trên màn hình)
                 xem-cad.py             — vẽ nguyên bản vùng đó (cả chữ) từ file DXF gốc
                 hoi-vung.mjs           — liệt kê đối tượng trong một vùng
```

Không dùng framework giao diện; chỉ TypeScript + Vite, nên đọc và sửa trực tiếp được.

---

## 11. Việc còn phải làm

* Xác nhận toạ độ 220kV Bắc Kạn (E26.5) trên GIS (mục 5).
* Bổ sung công suất MBA cho E6.22 Định Hoá, E6.23 Yên Bình 8, E6.24 Đa Phúc,
  E6.25 Phú Bình 2 và ba trạm khu vực Bắc Kạn (E26.1–E26.3) — file CAD gốc chưa ghi.
* Rà lại vài chỗ lẻ còn suy sai cấp điện áp (chạy `node tools/kiem-cap-dien-ap.mjs`)
  — sửa bằng công cụ ở mục 6.
* Nhập lần lượt các sơ đồ lộ trung áp rời rạc và đấu nối về trạm 110kV tương ứng.
* Gán trị số P, Q (SCADA) cho công suất chạy trên đường dây; coi NM NĐ An Khánh
  (A6.15) là nguồn phát.
* Đấu nốt 40 thiết bị còn thiếu (bật **F4** hoặc `Dữ liệu → Kiểm tra liên kết
  điện…` để xem danh sách chi tiết) - phần lớn là dao cách ly đầu cáp và máy cắt hợp
  bộ vẽ tách rời đường dây trong bản CAD gốc.
