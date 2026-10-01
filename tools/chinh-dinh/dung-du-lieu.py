"""Dựng src/data/chinhDinh.json từ tools/chinh-dinh/phieu.jsonl.

phieu.jsonl: mỗi dòng một phiếu chỉnh định (trích trang 1 phiếu trên Google Drive,
thư mục Role/Phieu chinh dinh role, không lấy "Phieu het hieu luc" và trạm khách hàng).

    python3 tools/chinh-dinh/dung-du-lieu.py
    python3 tools/chinh-dinh/dung-du-lieu.py --so-sua so-sua-phieu-chinh-dinh.json

--so-sua: gộp sổ sửa phiếu xuất từ phần mềm (menu Dữ liệu -> Sổ sửa phiếu chỉnh định ->
Xuất sổ) vào phieu.jsonl trước khi dựng: phiếu sửa thay phiếu gốc, phiếu nhập mới thêm vào,
phiếu "bỏ" bị xoá. Sau đó máy nào mở bản phần mềm mới cũng thấy các bản sửa này.
"""
import json, os, sys

GOC = os.path.dirname(os.path.abspath(__file__))
NGUON = os.path.join(GOC, "phieu.jsonl")
K = ["id", "ten", "so", "tb", "mo", "rl", "ti", "nam", "md", "nb", "tdl", "g", "gc", "thieu"]
BAT_BUOC = ("ten", "so", "tb", "mo", "rl", "ti", "nam", "nb")

ds = [json.loads(d) for d in open(NGUON, encoding="utf-8") if d.strip()]

if "--so-sua" in sys.argv:
    so = json.load(open(sys.argv[sys.argv.index("--so-sua") + 1], encoding="utf-8"))
    theo_id = {p["id"]: i for i, p in enumerate(ds)}
    sua = them = bo = 0
    for pid, m in so.get("muc", {}).items():
        p = {k: v for k, v in m["p"].items() if k != "sua"}
        p["id"] = pid
        if pid in theo_id:
            if m.get("xoa"):
                ds[theo_id[pid]] = None
                bo += 1
            else:
                ds[theo_id[pid]] = p
                sua += 1
        elif not m.get("xoa"):
            ds.append(p)
            them += 1
    ds = [p for p in ds if p]
    with open(NGUON, "w", encoding="utf-8") as f:
        for p in ds:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")
    print(f"Gộp sổ sửa: sửa {sua}, thêm {them}, bỏ {bo} -> phieu.jsonl")

ra_ds = []
for p in ds:
    r = {k: p[k] for k in K if k in p and p[k] not in ("", None)}
    for k in BAT_BUOC:
        r.setdefault(k, "")
    ra_ds.append(r)
ra_ds.sort(key=lambda r: (r["tb"], r["so"]))
s = json.dumps(ra_ds, ensure_ascii=False, separators=(",", ":"))
ra = os.path.join(GOC, "..", "..", "src", "data", "chinhDinh.json")
open(ra, "w", encoding="utf-8").write(s)
print(f"{len(ra_ds)} phiếu, {len(s.encode()) // 1024} KB -> src/data/chinhDinh.json")
