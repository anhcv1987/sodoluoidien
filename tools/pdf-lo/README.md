# Dò lộ trung áp từ bản vẽ PDF

Xem README chính, mục 7.1. Cần `pip install pymupdf`.

    PDF_DIR=<thư mục PDF> python3 tools/pdf-lo/xuat.py tools/pdf-lo/cfg17.json tools/luoi-trung-ap/pdf/17.json [--anh=kiem.png]

Toạ độ trong cfg là pt trên trang PDF đã xoay (như ảnh render trang). `--anh` vẽ kết
quả dò chồng lên ảnh bản vẽ để soát.
