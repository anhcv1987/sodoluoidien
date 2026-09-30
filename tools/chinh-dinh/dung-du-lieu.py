"""Dựng src/data/chinhDinh.json từ tools/chinh-dinh/phieu.jsonl.

phieu.jsonl: mỗi dòng một phiếu chỉnh định (trích trang 1 phiếu trên Google Drive,
thư mục Role/Phieu chinh dinh role, không lấy "Phieu het hieu luc" và trạm khách hàng).

    python3 tools/chinh-dinh/dung-du-lieu.py
"""
import json, os

GOC = os.path.dirname(os.path.abspath(__file__))
K = ["id", "ten", "so", "tb", "mo", "rl", "ti", "nam", "md", "nb", "tdl", "g", "gc", "thieu"]
BAT_BUOC = ("ten", "so", "tb", "mo", "rl", "ti", "nam", "nb")

ds = []
for dong in open(os.path.join(GOC, "phieu.jsonl"), encoding="utf-8"):
    p = json.loads(dong)
    r = {k: p[k] for k in K if k in p and p[k] not in ("", None)}
    for k in BAT_BUOC:
        r.setdefault(k, "")
    ds.append(r)
ds.sort(key=lambda r: (r["tb"], r["so"]))
s = json.dumps(ds, ensure_ascii=False, separators=(",", ":"))
ra = os.path.join(GOC, "..", "..", "src", "data", "chinhDinh.json")
open(ra, "w", encoding="utf-8").write(s)
print(f"{len(ds)} phiếu, {len(s.encode()) // 1024} KB -> src/data/chinhDinh.json")
