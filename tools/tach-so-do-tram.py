# -*- coding: utf-8 -*-
"""
Tách từng tờ sơ đồ nguyên lý trạm 110/220kV trong file CAD tổng của Phòng Điều độ
ra các file DXF riêng, để đưa vào phần mềm bằng tools/dung-du-lieu-tram.mjs.

Cách dùng:

    # 1. Chuyển DWG -> DXF (LibreDWG hoặc ODA File Converter)
    dwg2dxf -o tong.dxf "So do luoi dien lien thong tinh Thai Nguyen.dwg"

    # 2. Tách (chỉ lấy vùng bản vẽ đã sắp xếp theo thứ tự trạm, X > 800000)
    pip install ezdxf
    python3 tools/tach-so-do-tram.py tong.dxf thu-muc-ra/ --min-x 800000

Kết quả: mỗi trạm một file <mã trạm>.dxf + file muc-luc.json mô tả các tờ.

Ghi chú: bản vẽ tổng chứa nhiều bản sao của cùng một tờ sơ đồ (bản nháp ở vùng
X ~ 740000 và bản đã sắp xếp ở vùng X > 800000). Dùng --min-x để chỉ lấy một bộ.
"""
import argparse
import json
import os
import re

import ezdxf
from ezdxf.addons import Importer


def clean(s: str) -> str:
    s = re.sub(r"\\f[^;]*;", "", s)
    s = re.sub(r"[{}]", "", s)
    s = re.sub(r"\\[A-Za-z][0-9.x-]*;?", "", s)
    return re.sub(r"\s+", " ", s).strip()


TITLE = re.compile(r"TRẠM\s*(110|220)\s*KV", re.I)
CODE = re.compile(r"\(?\b(E\d+\.\d+|A\d+\.\d+)\b\)?")

BUCKET = 50          # độ phân giải khi dò khoảng trống theo trục Y
GAP_Y = 320          # khoảng trống theo Y đủ lớn để coi là hết một tờ
GAP_X = 1200         # khoảng trống theo X để tách tờ khỏi bảng mục lục bên cạnh
MIN_TITLE_GAP = 1000 # hai tiêu đề cách nhau dưới mức này thì coi là cùng một tờ


def collect_titles(msp, min_x: float):
    """Lấy tiêu đề chính của từng tờ sơ đồ trạm, theo thứ tự từ trên xuống."""
    rows = []
    for e in msp:
        t = e.dxftype()
        if t == "TEXT":
            p, h, s = e.dxf.insert, e.dxf.height, clean(e.dxf.text)
        elif t == "MTEXT":
            p, h, s = e.dxf.insert, e.dxf.char_height, clean(e.text)
        else:
            continue
        if p.x < min_x or len(s) > 80 or h < 10 or not TITLE.search(s):
            continue
        m = CODE.search(s)
        if not m:
            continue
        rows.append({"x": p.x, "y": p.y, "h": h, "text": s, "code": m.group(1)})

    # Chia cột theo X
    rows.sort(key=lambda r: r["x"])
    cols = []
    for r in rows:
        if cols and r["x"] - cols[-1][-1]["x"] < 6000:
            cols[-1].append(r)
        else:
            cols.append([r])

    # Trong mỗi cột, đi từ trên xuống; nhãn phụ nằm ngay dưới tiêu đề chính thì bỏ
    out = []
    for col in cols:
        col.sort(key=lambda r: -r["y"])
        last = None
        for r in col:
            if last is not None and last["y"] - r["y"] < MIN_TITLE_GAP:
                # cùng tờ với tiêu đề trước: giữ nhãn có chữ to hơn làm tên tờ
                if r["h"] > last["h"]:
                    last["text"] = r["text"]
                continue
            r["col"] = len(out)
            out.append(r)
            last = r
    out.sort(key=lambda r: (r["x"] // 6000, -r["y"]))
    return out


def entity_boxes(msp, min_x: float):
    items = []
    for e in msp:
        t = e.dxftype()
        try:
            if t == "LINE":
                xs = [e.dxf.start.x, e.dxf.end.x]
                ys = [e.dxf.start.y, e.dxf.end.y]
            elif t in ("TEXT", "MTEXT", "INSERT"):
                xs = [e.dxf.insert.x]
                ys = [e.dxf.insert.y]
            elif t in ("CIRCLE", "ARC"):
                r = e.dxf.radius
                xs = [e.dxf.center.x - r, e.dxf.center.x + r]
                ys = [e.dxf.center.y - r, e.dxf.center.y + r]
            elif t == "LWPOLYLINE":
                q = [(a[0], a[1]) for a in e.get_points("xy")]
                if not q:
                    continue
                xs = [a[0] for a in q]
                ys = [a[1] for a in q]
            else:
                continue
        except Exception:
            continue
        if max(xs) < min_x:
            continue
        items.append((e, min(xs), min(ys), max(xs), max(ys)))
    return items


def band_y(title, items, col_x0, col_x1, y_floor):
    """Dải Y thực tế của một tờ: từ tiêu đề đi xuống tới khi gặp khoảng trống lớn,
    nhưng không bao giờ vượt quá tiêu đề của tờ kế tiếp bên dưới (y_floor)."""
    occupied = set()
    for _, x0, y0, x1, y1 in items:
        if x1 < col_x0 or x0 > col_x1:
            continue
        for b in range(int(y0 // BUCKET), int(y1 // BUCKET) + 1):
            occupied.add(b)
    top = int((title["y"] + 150) // BUCKET)
    floor_b = int(y_floor // BUCKET)
    b, empty, bottom = top, 0, top
    while b > max(floor_b, top - int(5000 / BUCKET)):
        if b in occupied:
            empty = 0
            bottom = b
        else:
            empty += 1
            if empty * BUCKET > GAP_Y and bottom < top:
                break
        b -= 1
    return bottom * BUCKET - BUCKET, (top + 1) * BUCKET


def band_x(title, band_items):
    """Giới hạn X của tờ: gom theo cụm, giữ cụm chứa tiêu đề (loại bảng mục lục bên cạnh)."""
    xs = sorted({round(it[1]) for it in band_items} | {round(it[3]) for it in band_items})
    if not xs:
        return None
    groups, cur = [], [xs[0]]
    for x in xs[1:]:
        if x - cur[-1] > GAP_X:
            groups.append(cur)
            cur = [x]
        else:
            cur.append(x)
    groups.append(cur)
    for g in groups:
        if g[0] - GAP_X <= title["x"] <= g[-1] + GAP_X:
            return g[0], g[-1]
    big = max(groups, key=len)
    return big[0], big[-1]


CELL = 150  # ô lưới khi dò cụm cho các tờ bản vẽ khác


def extract_cluster(px, py, items):
    """Gom cụm đối tượng liền nhau chứa điểm (px, py) - dùng cho các tờ không xếp theo cột."""
    occ = {}
    for it in items:
        for cx in range(int(it[1] // CELL), int(it[3] // CELL) + 1):
            for cy in range(int(it[2] // CELL), int(it[4] // CELL) + 1):
                occ.setdefault((cx, cy), []).append(it)
    start = (int(px // CELL), int(py // CELL))
    if start not in occ:
        for d in range(1, 4):
            cand = [(start[0] + i, start[1] + j) for i in range(-d, d + 1) for j in range(-d, d + 1)]
            hit = [c for c in cand if c in occ]
            if hit:
                start = hit[0]
                break
        else:
            return []
    seen, stack, members = {start}, [start], set()
    while stack:
        cur = stack.pop()
        for it in occ.get(cur, ()):
            members.add(id(it))
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                n = (cur[0] + dx, cur[1] + dy)
                if n in occ and n not in seen:
                    seen.add(n)
                    stack.append(n)
    return [it for it in items if id(it) in members]


def find_extra_titles(msp, patterns, max_x):
    out = []
    for e in msp:
        t = e.dxftype()
        if t == "TEXT":
            p, h, s = e.dxf.insert, e.dxf.height, clean(e.dxf.text)
        elif t == "MTEXT":
            p, h, s = e.dxf.insert, e.dxf.char_height, clean(e.text)
        else:
            continue
        if p.x >= max_x or h < 20 or len(s) > 100:
            continue
        for pat in patterns:
            if re.search(pat, s, re.I):
                out.append({"x": p.x, "y": p.y, "h": h, "text": s})
                break
    out.sort(key=lambda r: -r["h"])
    uniq = []
    for r in out:
        if any(abs(r["x"] - u["x"]) < 4000 and abs(r["y"] - u["y"]) < 3000 for u in uniq):
            continue
        uniq.append(r)
    return uniq


def main() -> int:
    ap = argparse.ArgumentParser(description="Tách sơ đồ từng trạm từ file DXF tổng")
    ap.add_argument("dxf", help="file DXF tổng")
    ap.add_argument("out", help="thư mục kết quả")
    ap.add_argument("--min-x", type=float, default=0.0, help="chỉ xét phần bản vẽ có X lớn hơn giá trị này")
    ap.add_argument(
        "--to-tong",
        default=None,
        help=(
            "Trích NGUYÊN CẢ tờ bản vẽ tổng (khổ A0, tất cả các trạm trên một tờ) "
            "chứa tiêu đề khớp mẫu này, VD --to-tong 'KẾT DÂY LƯỚI ĐIỆN'"
        ),
    )
    ap.add_argument(
        "--them-to",
        action="append",
        default=[],
        help="lấy thêm tờ bản vẽ khác có tiêu đề khớp mẫu này (lặp lại được), VD --them-to 'LƯỚI ĐIỆN 220KV'",
    )
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    src = ezdxf.readfile(args.dxf)
    msp = src.modelspace()

    titles = collect_titles(msp, args.min_x)
    items = entity_boxes(msp, args.min_x)
    print(f"Tìm thấy {len(titles)} tờ sơ đồ trạm, {len(items)} đối tượng trong vùng xét")

    # Với mỗi tờ, xác định "đáy" là tiêu đề của tờ ngay dưới trong cùng cột
    for i, t in enumerate(titles):
        nxt = next(
            (u for u in titles[i + 1:] if abs(u["x"] - t["x"]) < 6000 and u["y"] < t["y"]),
            None,
        )
        t["floor"] = (nxt["y"] + 150) if nxt else (t["y"] - 5000)

    index, seen = [], {}

    # ---- Tờ tổng khổ A0: lấy nguyên cả tờ, giữ đúng bố trí gốc ----
    if args.to_tong:
        all_items = entity_boxes(msp, -1e18)
        title = None
        for e in msp:
            t = e.dxftype()
            if t == "TEXT":
                p, h, txt = e.dxf.insert, e.dxf.height, clean(e.dxf.text)
            elif t == "MTEXT":
                p, h, txt = e.dxf.insert, e.dxf.char_height, clean(e.text)
            else:
                continue
            if h >= 20 and re.search(args.to_tong, txt, re.I):
                if title is None or h > title["h"]:
                    title = {"x": p.x, "y": p.y, "h": h, "text": txt}
        if title is None:
            print(f"  Không tìm thấy tiêu đề khớp {args.to_tong!r}")
        else:
            # Tờ tổng tách biệt hẳn với phần còn lại theo trục X -> gom cụm theo X
            xs = sorted({round(it[1]) for it in all_items})
            groups, cur = [], [xs[0]]
            for x in xs[1:]:
                if x - cur[-1] > 1500:
                    groups.append(cur)
                    cur = [x]
                else:
                    cur.append(x)
            groups.append(cur)
            g = next((q for q in groups if q[0] - 1500 <= title["x"] <= q[-1] + 1500), None)
            if g:
                sel = [it for it in all_items if g[0] - 10 <= it[1] and it[3] <= g[-1] + 3000]
                bx0 = min(it[1] for it in sel)
                by0 = min(it[2] for it in sel)
                bx1 = max(it[3] for it in sel)
                by1 = max(it[4] for it in sel)
                # Vị trí từng trạm trong tờ tổng, để phần mềm nhảy tới đúng chỗ.
                # Tờ A0 xếp các trạm so le nên không dùng được cách chia cột ở trên.
                stations = []
                for e in msp:
                    t = e.dxftype()
                    if t == "TEXT":
                        p2, h2, s2 = e.dxf.insert, e.dxf.height, clean(e.dxf.text)
                    elif t == "MTEXT":
                        p2, h2, s2 = e.dxf.insert, e.dxf.char_height, clean(e.text)
                    else:
                        continue
                    if not (bx0 <= p2.x <= bx1 and by0 <= p2.y <= by1):
                        continue
                    if h2 < 10 or len(s2) > 80 or not TITLE.search(s2):
                        continue
                    m2 = CODE.search(s2)
                    if not m2:
                        continue
                    if any(
                        abs(u["x"] - p2.x) < 400 and abs(u["y"] - p2.y) < 400 for u in stations
                    ):
                        continue
                    stations.append(
                        {"code": m2.group(1), "title": s2, "x": round(p2.x, 1), "y": round(p2.y, 1), "h": round(h2, 1)}
                    )
                stations.sort(key=lambda r: (-r["y"], r["x"]))
                # Phạm vi từng trạm trong tờ tổng: gom cụm đối tượng liền nhau
                # quanh tiêu đề, để phần mềm phóng tới vừa khít.
                for st in stations:
                    cl = extract_cluster(st["x"], st["y"] - 60, sel)
                    if not cl:
                        cl = extract_cluster(st["x"], st["y"], sel)
                    if cl:
                        st["box"] = [
                            round(min(it[1] for it in cl), 1),
                            round(min(it[2] for it in cl), 1),
                            round(max(it[3] for it in cl), 1),
                            round(max(it[4] for it in cl), 1),
                        ]
                # Hai trạm vẽ sát nhau có thể rơi vào cùng một cụm -> cắt đôi
                # phạm vi tại điểm giữa hai tiêu đề để phóng tới không bị lẫn.
                for st in stations:
                    b = st.get("box")
                    if not b:
                        continue
                    for other in stations:
                        if other is st or not (b[0] <= other["x"] <= b[2] and b[1] <= other["y"] <= b[3]):
                            continue
                        dx = other["x"] - st["x"]
                        dy = other["y"] - st["y"]
                        if abs(dx) >= abs(dy):
                            mid = (st["x"] + other["x"]) / 2
                            if dx > 0:
                                b[2] = min(b[2], mid)
                            else:
                                b[0] = max(b[0], mid)
                        else:
                            mid = (st["y"] + other["y"]) / 2
                            if dy > 0:
                                b[3] = min(b[3], mid)
                            else:
                                b[1] = max(b[1], mid)
                    # Luôn chừa đủ chỗ quanh tiêu đề
                    b[0] = round(min(b[0], st["x"] - 120), 1)
                    b[2] = round(max(b[2], st["x"] + 120), 1)
                    b[1] = round(min(b[1], st["y"] - 180), 1)
                    b[3] = round(max(b[3], st["y"] + 60), 1)
                tgt = ezdxf.new("R2000", setup=True)
                imp = Importer(src, tgt)
                imp.import_entities([it[0] for it in sel])
                imp.finalize()
                tgt.saveas(os.path.join(args.out, "to-tong.dxf"))
                index.append(
                    {
                        "code": "TONG",
                        "title": title["text"],
                        "file": "to-tong.dxf",
                        "entities": len(sel),
                        "box": [round(bx0, 1), round(by0, 1), round(bx1, 1), round(by1, 1)],
                        "stations": stations,
                    }
                )
                print(
                    f"  TỜ TỔNG {len(sel):6d} đối tượng  {bx1 - bx0:7.0f} x {by1 - by0:7.0f}"
                    f"  {len(stations)} trạm  ->  to-tong.dxf   {title['text'][:40]}"
                )

    for t in titles:
        col_x0, col_x1 = t["x"] - 6000, t["x"] + 9000
        y0, y1 = band_y(t, items, col_x0, col_x1, t["floor"])
        rough = [it for it in items if it[2] >= y0 and it[4] <= y1 and it[1] >= col_x0 and it[3] <= col_x1]
        bx = band_x(t, rough)
        if not bx:
            continue
        sel = [it for it in rough if it[1] >= bx[0] - 10 and it[3] <= bx[1] + 10]
        if len(sel) < 30:
            print(f"  BỎ QUA {t['code']}: chỉ có {len(sel)} đối tượng")
            continue

        code = t["code"]
        if code in seen:
            # Bản vẽ gốc có vài chỗ ghi nhầm mã trùng nhau -> đánh số cho khỏi đè file
            n = seen[code] + 1
            seen[code] = n
            code = f"{code}-{n}"
            print(f"  ! Mã trùng, đổi thành {code} (tiêu đề: {t['text']})")
        else:
            seen[code] = 1

        tgt = ezdxf.new("R2000", setup=True)
        imp = Importer(src, tgt)
        imp.import_entities([it[0] for it in sel])
        imp.finalize()
        name = code.replace(".", "_") + ".dxf"
        tgt.saveas(os.path.join(args.out, name))
        index.append(
            {
                "code": code,
                "title": t["text"],
                "file": name,
                "entities": len(sel),
                "box": [
                    round(min(it[1] for it in sel), 1),
                    round(min(it[2] for it in sel), 1),
                    round(max(it[3] for it in sel), 1),
                    round(max(it[4] for it in sel), 1),
                ],
            }
        )
        b = index[-1]["box"]
        print(
            f"  {code:8s} {len(sel):5d} đối tượng  {b[2] - b[0]:7.0f} x {b[3] - b[1]:6.0f}  ->  {name}"
            f"   {t['text'][:42]}"
        )

    # ---- Các tờ bản vẽ khác (sơ đồ liên thông, sơ đồ đường dây trung áp...) ----
    if args.them_to:
        all_items = entity_boxes(msp, -1e18)
        done = []
        for i, t in enumerate(find_extra_titles(msp, args.them_to, args.min_x)):
            sel = extract_cluster(t["x"], t["y"], all_items)
            if len(sel) < 30:
                print(f"  BỎ QUA tờ '{t['text'][:40]}': chỉ có {len(sel)} đối tượng")
                continue
            bb = (
                min(it[1] for it in sel),
                min(it[2] for it in sel),
                max(it[3] for it in sel),
                max(it[4] for it in sel),
            )
            # Hai tiêu đề nằm trong cùng một tờ -> chỉ lấy một lần
            if any(abs(bb[k] - d[k]) < 200 for d in done for k in (0,)) and any(
                all(abs(bb[k] - d[k]) < 200 for k in range(4)) for d in done
            ):
                print(f"  (gộp) '{t['text'][:50]}' nằm chung tờ đã lấy")
                continue
            done.append(bb)
            tgt = ezdxf.new("R2000", setup=True)
            imp = Importer(src, tgt)
            imp.import_entities([it[0] for it in sel])
            imp.finalize()
            name = f"to-{i + 1}.dxf"
            tgt.saveas(os.path.join(args.out, name))
            index.append(
                {
                    "code": f"TỜ{i + 1}",
                    "title": t["text"],
                    "file": name,
                    "entities": len(sel),
                    "box": [
                        round(min(it[1] for it in sel), 1),
                        round(min(it[2] for it in sel), 1),
                        round(max(it[3] for it in sel), 1),
                        round(max(it[4] for it in sel), 1),
                    ],
                }
            )
            print(f"  TỜ{i + 1:<5} {len(sel):5d} đối tượng  ->  {name}   {t['text'][:50]}")

    with open(os.path.join(args.out, "muc-luc.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)
    print(f"Đã ghi {len(index)} tờ vào {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
