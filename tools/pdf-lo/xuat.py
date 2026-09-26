"""PDF_DIR=<thư mục bản vẽ> python3 tools/pdf-lo/xuat.py <cfg.json> <out.json> [--anh=out.png]
Xuất hình học các lộ trong một bản vẽ PDF (đường trục + nhánh liên kết) ra JSON để
vẽ lên tờ sơ đồ tổng (tools/ve-luoi-trung-ap.mjs đọc).

cfg: {
  "pdf": "...",
  "cam": [[x,y],...], "vung": [[x0,y0,x1,y1],...], "mo": [[x,y],...],
  "lo": [ { "ten": "ĐZ 473 E6.4", "kv": 22, "nguon": [x,y], "dich": [[x,y],...] }, ... ],
  "bo_chu": ["regex", ...],     # chữ không lấy
  "tb_vi_tri": {"DCL ...": [x, y]}   # vị trí thiết bị khai tay (ký hiệu không nhận ra được)
}
Toạ độ: pt theo trang đã xoay (như ảnh render). JSON giữ nguyên toạ độ pt.
"""
import sys, json, math, re
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dothi, pymupdf as fitz

cfg = json.load(open(sys.argv[1]))
TC = cfg.get('thanh_cai', [])   # vùng thanh cái trạm (chặn, không phải điểm liên thông)
# đường dẫn PDF: tương đối so với thư mục PDF_DIR (mặc định: thư mục chạy lệnh)
PDF = os.path.join(os.environ.get('PDF_DIR', '.'), cfg['pdf'])
# điểm ngắt không có thiết bị (cột dừng, lèo tháo): chặn như thiết bị thường cắt nhưng
# không nối hai phía, không đặt thiết bị nào thành Cắt
NGAT = cfg.get('ngat', [])
G = dothi.dung(PDF, CAM=cfg.get('cam', []), VUNG=list(cfg.get('vung', [])) + TC + NGAT, MO=cfg.get('mo', []), tu_chan=cfg.get('tu_chan', True), BO=cfg.get('bo_noi', []), NOI=cfg.get('noi_them', []))
# ---- cột tách lèo: chấm tô đặc đứng riêng giữa tuyến thẳng (không sát ký hiệu, đầu cáp) ----
def tim_tach_leo():
    seg_, n0_ = G['seg'], G['n0']
    ds = []
    for (cx, cy, rr) in G['cham_dac']:
        if rr < 0.72: continue
        # phải là hình tròn (có đường viền cung tròn), không phải mũi tên kích thước tô đặc
        if not any(math.hypot(cx - x, cy - y) < 0.5 for (x, y, r) in G['cham']): continue
        if any(0 < math.hypot(cx - x, cy - y) < 3.2 for (x, y, r) in G['cham_dac']): continue
        if any(math.hypot((g[0] + g[2]) / 2 - cx, (g[1] + g[3]) / 2 - cy) < 2.8 for g in G['day']): continue
        tia = set()
        for i in range(n0_):
            x0, y0, x1, y1 = seg_[i]
            for (ax, ay, bx, by) in ((x0, y0, x1, y1), (x1, y1, x0, y0)):
                if math.hypot(ax - cx, ay - cy) <= rr + 1.2 and math.hypot(bx - ax, by - ay) > 0.3:
                    tia.add(round(math.degrees(math.atan2(by - ay, bx - ax)) % 360 / 45) % 8)
            t, dd = G['chieu'](cx, cy, x0, y0, x1, y1)
            L = math.hypot(x1 - x0, y1 - y0)
            if dd < 0.3 and rr < t * L and rr < (1 - t) * L: tia.add(-1)   # dây chạy liền qua chấm
        if -1 not in tia and len(tia) == 2 and (max(tia) - min(tia)) == 4:
            ds.append((round(cx, 2), round(cy, 2), rr))
    return ds
# Chấm đặc giữa tuyến có thể là cột tách lèo (cột 48 ĐZ 472 E6.4) nhưng cũng có thể là cột đỡ
# thường (cột vượt sông 27-30 ĐZ 475 E6.2): chỉ liệt kê để rà; cfg "tach_leo": true thì tự coi là ngắt
TACH_LEO = tim_tach_leo()
moi = []
for (cx, cy, rr) in TACH_LEO:
    da_khai = any(v[0] <= cx <= v[2] and v[1] <= cy <= v[3] for v in NGAT)
    print(f'chấm đặc giữa tuyến (cột tách lèo?): ({cx:.1f},{cy:.1f})' + (' - đã khai ngắt' if da_khai else ''))
    if cfg.get('tach_leo') and not da_khai:
        moi.append([round(cx - rr - 0.7, 2), round(cy - rr - 0.7, 2), round(cx + rr + 0.7, 2), round(cy + rr + 0.7, 2)])
if moi:
    # dựng lại đồ thị với các điểm tách lèo là điểm ngắt
    NGAT = NGAT + moi
    G = dothi.dung(PDF, CAM=cfg.get('cam', []), VUNG=list(cfg.get('vung', [])) + TC + NGAT, MO=cfg.get('mo', []),
                   tu_chan=cfg.get('tu_chan', True), BO=cfg.get('bo_noi', []), NOI=cfg.get('noi_them', []))
VUNG_MO = [v for v in G['vung'] if not any(abs(v[0]-t[0])<0.01 and abs(v[1]-t[1])<0.01 for t in TC)]
# vùng tự dò (chữ "(Thường cắt)") có tâm nằm trong ô ngắt khai báo cũng coi là ngắt (thiết bị vẽ ở bản vẽ khác)
la_ngat = lambda v: any((abs(v[0]-t[0])<0.01 and abs(v[1]-t[1])<0.01) or
                        (t[0] <= (v[0]+v[2])/2 <= t[2] and t[1] <= (v[1]+v[3])/2 <= t[3]) for t in NGAT)
xy, p, M, chieu, ke = G['xy'], G['p'], G['M'], G['chieu'], G['ke']
bo_chu = [re.compile(r) for r in cfg.get('bo_chu', [])]

# ---------------- chữ ----------------
tex = []
rot = p.rotation
for b in p.get_text('dict')['blocks']:
    for l in b.get('lines', []):
        # chữ "R" trong ký hiệu recloser đôi khi dính cùng dòng với tên thiết bị bên cạnh
        t = ''.join(s['text'] for s in l['spans'] if s['text'].strip() != 'R').strip()
        if not t or any(r.search(t) for r in bo_chu): continue
        r = fitz.Rect(l['bbox']) * M
        h = max(s['size'] for s in l['spans'])
        # hướng chữ trên trang đã xoay
        dx, dy = l['dir']
        v = fitz.Point(dx, dy) * fitz.Matrix(rot)
        doc = abs(v.x) < 0.5
        tex.append(dict(x=(r.x0 + r.x1) / 2, y=(r.y0 + r.y1) / 2, x0=r.x0, y0=r.y0, x1=r.x1, y1=r.y1,
                        t=t, h=h, doc=doc, vx=v.x, vy=v.y))

RE_COT = re.compile(r'^\d{1,3}[A-Za-z]?(-\d)?$')
RE_TB = re.compile(r'^(DCL|LBS|MC|DPT|REC|CD|DCLHB|Recloser|CDPT)\b', re.I)
RE_DAY = re.compile(r'^(AC|ACSR|AL|Al|Cu|CU|M|XLPE|AAC|A)\s?[-/]?\s?(\d|XLPE|/|x)', re.I)
RE_MO = re.compile(r'^\(?\s*[Tt]hường cắt\s*\)?$')
HUYEN = ['Thái Nguyên', 'Đại Từ', 'Sông Công', 'Phổ Yên', 'Phú Bình', 'Đồng Hỷ', 'Võ Nhai', 'Phú Lương',
         'Định Hóa', 'Thành phố', 'Bắc Kạn', 'Chợ Mới', 'Chợ Đồn', 'Ba Bể', 'Bạch Thông', 'Ngân Sơn', 'Na Rì',
         'Pác Nặm']

def chieu_pl(pts, x, y):
    best = (1e9, 0, None); acc = 0
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        L = math.hypot(x1 - x0, y1 - y0)
        t, d = chieu(x, y, x0, y0, x1, y1)
        if d < best[0]: best = (d, acc + t * L, (x0 + t * (x1 - x0), y0 + t * (y1 - y0), (x1 - x0) / (L or 1), (y1 - y0) / (L or 1)))
        acc += L
    return best

# ---------------- tủ RMU: biến khung tủ thành một nút điện ----------------
seg_mo = G['seg'][:G['n0']]
def khung_tu(e):
    cx = e['x']
    # cạnh trên khung: các đoạn ngang cùng hàng nối tiếp nhau (bản vẽ hay chia cạnh thành nhiều đoạn)
    ngang = sorted(((min(sg[0], sg[2]), max(sg[0], sg[2]), sg[1]) for sg in seg_mo
                    if abs(sg[1] - sg[3]) < 0.3 and e['y0'] - 6 < sg[1] < e['y0'] + 0.8), key=lambda g: (round(g[2] / 0.3), g[0]))
    ghep = []
    for a, b, y in ngang:
        if ghep and abs(ghep[-1][2] - y) < 0.3 and a <= ghep[-1][1] + 0.3: ghep[-1][1] = max(ghep[-1][1], b)
        else: ghep.append([a, b, y])
    tren = [g for g in ghep if g[0] < cx < g[1] and g[1] - g[0] > (e['x1'] - e['x0'])]
    if not tren: return None
    x0, x1, y0 = max(tren, key=lambda g: g[2])
    # cạnh bên: nối các đoạn dọc liền nhau từ cạnh trên xuống
    y1 = None
    for xc in (x0, x1):
        doc = sorted((min(g[1], g[3]), max(g[1], g[3])) for g in seg_mo if abs(g[0] - g[2]) < 0.3 and abs(g[0] - xc) < 0.6)
        day = None
        for a, b in doc:
            if day is None:
                if a < y0 + 1 and b > y0: day = b
            elif a <= day + 0.3: day = max(day, b)
        if day is not None and day > y0 + 5: y1 = max(y1 or 0, day)
    if y1 is None: y1 = y0 + 32
    return x0, y0, x1, y1
TU = []   # [ten, khung, tâm (nút), tiêu đề, tên ngăn]
for e in tex:
    # tên tủ: "TỦ RMU ..." hoặc "RMU 63 - 474 E6.4"; không lấy chữ chỉ hướng cáp trong ngăn ("RMU 02/478 E6.4")
    if not (e['t'].upper().startswith('TỦ RMU') or re.match(r'^RMU\s?\d+\s*-', e['t'])): continue
    kh = khung_tu(e)
    if not kh: continue
    x0, y0, x1, y1 = kh
    ngan = []
    for f in tex:
        if f is e or not (x0 <= f['x'] <= x1 and 0 < f['y'] - e['y'] < 12) or f['t'].strip() in ('DPT', 'MC', 'DCL'): continue
        # nhiều tên ngăn dính một dòng: tách trước DPT/MC/DCL hoặc trước số hiệu ngăn "472-7/02-2"
        tok = [t.strip() for t in re.split(r'(?=\b(?:DPT|MC|DCL)\s)|\s+(?=\d{3}-\d)', f['t']) if t and t.strip()]
        if len(tok) > 1:
            w = (f['x1'] - f['x0']) / len(tok)
            for q, t in enumerate(tok): ngan.append(dict(f, t=t, x=f['x0'] + w * (q + 0.5)))
        elif len(f['t']) < 18: ngan.append(f)
    # xoá đỉnh trong khung, cạnh xuyên khung; nối các đỉnh biên về tâm
    E = 0.4
    trong = set(n for n, (x, y) in enumerate(xy) if x0 - E <= x <= x1 + E and y0 - E <= y <= y1 + E)
    bien = set()
    for n in trong:
        for u, w in ke[n]:
            if u not in trong: bien.add(u)
    for n in trong: ke[n] = []
    for u in bien: ke[u] = [(v, w) for v, w in ke[u] if v not in trong]
    # chỉ giữ đỉnh biên ở dưới khung (chỗ cáp đấu vào chân ngăn)
    bien = [u for u in bien if xy[u][1] >= y1 - 1]
    # đầu cáp tô đặc (tam giác) giữa đáy khung và cáp: cáp dọc bắt đầu ngay dưới đáy (<= 2.5pt) là chân ngăn
    # (phải thẳng hàng với dây ngăn trong khung đi xuống sát đáy - không lấy nhầm cáp ngang đi sát chân tủ)
    x_ngan = [xy[m][0] for m in trong if xy[m][1] >= y1 - 3]
    for n, (x, y) in enumerate(xy):
        if n in trong or n in bien or not (x0 + 0.3 < x < x1 - 0.3 and y1 < y <= y1 + 2.5) or not ke[n]: continue
        if not any(abs(x - xn) < 0.4 for xn in x_ngan): continue
        if all(abs(xy[v][0] - x) < 0.3 and xy[v][1] > y + 0.3 for v, w in ke[n]): bien.append(n)
    c = len(xy); xy.append(((x0 + x1) / 2, y1))
    ke[c] = []
    for u in bien:
        w = abs(xy[u][0] - (x0 + x1) / 2) + 1
        ke[c].append((u, w)); ke[u].append((c, w))
    # "(Thường cắt)" ghi dưới tên ngăn -> ngăn đó thường cắt
    ten_mo = [f for f in ngan if RE_MO.match(f['t'])]
    ngan = [f for f in ngan if not RE_MO.match(f['t'])]
    ds_ngan = [dict(t=f['t'], x=round(f['x'], 2), y=round(f['y'], 2), h=f['h']) for f in ngan]
    for m in ten_mo:
        if ds_ngan: min(ds_ngan, key=lambda g: abs(g['x'] - m['x']) + abs(g['y'] - m['y']))['mo'] = True
    for g in ds_ngan:
        if g['t'] in cfg.get('ngan_mo', []): g['mo'] = True
    TU.append(dict(ten=e['t'], khung=[x0, y0, x1, y1], tam=c, tieude=dict(x0=e['x0'], y0=e['y0'], x1=e['x1'], y1=e['y1'], h=e['h'], t=e['t']),
                   ngan=ds_ngan))
TAM = {t["tam"]: t for t in TU}
print("tủ:", [(t["ten"], [round(v) for v in t["khung"]]) for t in TU])

# ---------------- cây các lộ ----------------
ket = {'lo': [], 'rmu': [], 'ranh': []}
da_ve = {}          # cạnh (u,v) đã vẽ -> tên lộ (để hai lộ cùng bản vẽ không vẽ trùng)
da_trong = set()    # đỉnh thuộc cây các lộ đã dò trước
for lo in cfg['lo']:
    s0 = G['gan'](*lo['nguon'])
    D, P = dothi.dij(G, s0)
    canh = []   # cạnh cây theo thứ tự thêm
    trong = set([s0])
    # đích: điểm cuối khai báo + mọi thiết bị thường cắt kề vùng lộ này cấp điện
    dich = [tuple(d[:2]) for d in lo.get('dich', [])]
    dich_n = []
    for v in VUNG_MO:
        k = G['vung'].index(v)
        b = [n for n in G['bien'][k] if n in D]
        if b: dich_n.append(min(b, key=lambda n: D[n]))
    lo['_dich'] = dich
    lo['_dich_n'] = dich_n
    print(lo['ten'], 'đích:', [(round(xy[n][0]), round(xy[n][1])) for n in dich_n])
    ds_t = [min((n for n in D), key=lambda n: math.hypot(xy[n][0] - x, xy[n][1] - y)) for (x, y) in dich] + dich_n
    for t in ds_t:
        r = [t]
        while r[-1] != s0: r.append(P[r[-1]])
        r = r[::-1]
        for a, b in zip(r, r[1:]):
            if (a, b) not in trong and b not in trong:
                canh.append((a, b))
            trong.add(b)
            # hai lộ cùng bản vẽ không có điểm thường cắt ở giữa (vd ngăn lộ trạm bên kia thường cắt):
            # gặp cây của lộ vẽ trước thì dừng ở đó (đấu vào đỉnh của nó), không vẽ chồng lần nữa
            if b in da_trong: break
    da_trong.update(trong)
    # tách cây thành các chuỗi (giữa điểm rẽ / đầu cuối)
    con = {}
    for a, b in canh: con.setdefault(a, []).append(b)
    chuoi = []
    def di(u):
        for v in con.get(u, []):
            c = [u, v]
            while len(con.get(c[-1], [])) == 1:
                c.append(con[c[-1]][0])
            chuoi.append(c)
            di(c[-1])
    di(s0)
    # nét đứt (cáp): cạnh ngắn liền nhau
    out = []
    for c in chuoi:
        pts = [xy[n] for n in c]
        # bỏ đỉnh thẳng hàng, giữ cờ cáp theo từng đoạn con
        seg = []
        for a, b in zip(pts, pts[1:]):
            L = math.hypot(b[0] - a[0], b[1] - a[1])
            if L < 1e-6: continue
            seg.append((a, b, L))
        # cáp: đoạn dài <1.8 liên tiếp
        out.append(dict(pts=[list(map(lambda v: round(v, 2), q)) for q in pts],
                        ngan=[round(s[2], 2) for s in seg]))
        # tủ RMU trên chuỗi: mỗi đỉnh kề tâm tủ là chân một ngăn có dây nối ra
        for k_, n_ in enumerate(c):
            if n_ not in TAM: continue
            tu = TAM[n_]
            r_ = next((r for r in ket['rmu'] if r['tam'] == n_), None)
            if not r_:
                r_ = dict(ten=tu['ten'], tam=n_, khung=[round(v, 2) for v in tu['khung']], tieude=tu['tieude'],
                          ngan=tu['ngan'], cua=[])
                ket['rmu'].append(r_)
            for kk in (k_ - 1, k_ + 1):
                if 0 <= kk < len(c): r_['cua'].append(dict(ij=[len(ket['lo']), len(out) - 1], k=kk, kc=k_))
    ket['lo'].append(dict(ten=lo['ten'], kv=lo.get('kv', 22), nguon=list(xy[s0]), chuoi=out,
                          cuoi=lo.get('cuoi', {})))

# ---------------- ngăn tủ RMU thường cắt mà cáp tới từ phía ngoài (mạch vòng) ----------------
# chân ngăn là đầu một chuỗi nhưng không đi qua tâm tủ: vẫn vẽ ngăn đó (dao cắt) nối xuống chân
for r_ in ket['rmu']:
    x0, y0, x1, y1 = r_['khung']
    for g in r_['ngan']:
        if not g.get('mo'): continue
        if any(abs(ket['lo'][c['ij'][0]]['chuoi'][c['ij'][1]]['pts'][c['k']][0] - g['x']) < 3 for c in r_['cua']): continue
        tot = None
        for i, lo_ in enumerate(ket['lo']):
            for j, c in enumerate(lo_['chuoi']):
                for k in (0, len(c['pts']) - 1):
                    q = c['pts'][k]
                    if abs(q[0] - g['x']) < 3 and y1 - 0.5 <= q[1] <= y1 + 3:
                        tot = dict(ij=[i, j], k=k, kc=None, ngoai=True)
        if tot: r_['cua'].append(tot)

# ---------------- đoạn qua thiết bị thường cắt ----------------
ket['lien'] = []
for v in VUNG_MO:
    if la_ngat(v): continue
    cx, cy = (v[0] + v[2]) / 2, (v[1] + v[3]) / 2
    k = G['vung'].index(v)
    bien_xy = [xy[n] for n in G['bien'][k]]
    dau = []   # (lo, điểm cuối chuỗi là đỉnh biên của vùng)
    for i, lo in enumerate(ket['lo']):
        for j, c in enumerate(lo['chuoi']):
            # đỉnh biên thường là đầu cuối chuỗi; phía lộ kia có thể nằm giữa chuỗi (điểm rẽ)
            for q in [c['pts'][-1]] + c['pts'][:-1]:
                if any(math.hypot(q[0] - b[0], q[1] - b[1]) < 0.05 for b in bien_xy):
                    dau.append((i, j, q))
                    break
    if not dau: continue
    # mỗi lộ một đầu (gần tâm nhất)
    theo_lo = {}
    for i, j, q in dau:
        dd = math.hypot(q[0] - cx, q[1] - cy)
        if i not in theo_lo or dd < theo_lo[i][2]: theo_lo[i] = (j, q, dd)
    ds = sorted(theo_lo.items(), key=lambda kv: kv[1][2])
    a = ds[0][1][1]
    if len(ds) >= 2:
        b = ds[1][1][1]
        ket['lien'].append(dict(lo=[ds[0][0], ds[1][0]], pts=[a, [round(cx, 2), round(cy, 2)], b]))
    else:
        # một phía: kéo qua thiết bị thêm một đoạn ngắn
        ux, uy = cx - a[0], cy - a[1]; L = math.hypot(ux, uy) or 1
        b = [round(cx + ux / L * 10, 2), round(cy + uy / L * 10, 2)]
        ket['lien'].append(dict(lo=[ds[0][0]], pts=[a, [round(cx, 2), round(cy, 2)], b], vung=v))
# chuỗi liên kết cũng nhận thiết bị / chữ
for k, l in enumerate(ket['lien']):
    i = l['lo'][0]
    ket['lo'][i]['chuoi'].append(dict(pts=l['pts'], ngan=[], lien=True))

# ---------------- phần tử theo chữ (gán cho chuỗi gần nhất) ----------------
tat_ca = [(i, j, c['pts']) for i, lo in enumerate(ket['lo']) for j, c in enumerate(lo['chuoi'])]
def gan_chuoi(x, y):
    best = (1e9, None, None)
    for i, j, pts in tat_ca:
        d, s, q = chieu_pl(pts, x, y)
        if d < best[0]: best = (d, (i, j, s), q)
    return best

def gan_khung(e):
    # khoảng cách từ khung chữ (tâm và trung điểm 4 cạnh) tới chuỗi gần nhất
    pts_ = ((e['x'], e['y']), (e['x0'], e['y']), (e['x1'], e['y']), (e['x'], e['y0']), (e['x'], e['y1']))
    return min((gan_chuoi(px, py) for px, py in pts_), key=lambda b: b[0])
def kc_khung(e, x, y):
    dx = max(e['x0'] - x, 0, x - e['x1']); dy = max(e['y0'] - y, 0, y - e['y1'])
    return math.hypot(dx, dy)
dung = set()
tb, cot, day, mo = [], [], [], []
for k, e in enumerate(tex):
    t = e['t']
    if RE_TB.match(t):
        # dòng 2 ngay dưới
        # (bỏ chữ một ký tự như "R" trong ký hiệu recloser)
        d2 = [f for f in tex if f is not e and abs(f['x0'] - e['x0']) < 6 and 0 < f['y'] - e['y'] < e['h'] * 1.7
              and not RE_TB.match(f['t']) and not RE_COT.match(f['t']) and len(f['t'].strip()) > 1 and not RE_MO.match(f['t'])]
        d2 = min(d2, key=lambda f: f['y']) if d2 else None
        # nhãn cách dây tới ~12pt (nhãn 2-3 dòng đặt trên ký hiệu hộp MC/LBS thường cắt)
        d, ij, q = min(gan_khung(f) for f in [e] + ([d2] if d2 else []))
        if d > 12: continue
        # ký hiệu thiết bị: nét đậm gần chữ nhất nằm trên chuỗi
        nhan = [e] + ([d2] if d2 else [])
        ten = [t] + ([d2['t']] if d2 else [])
        # tên viết 3 dòng: "DCL" / "471E6.4" / "-7/16"
        if d2 and re.fullmatch(r'(DCL|LBS|MC|DPT)', t.strip()):
            d3 = [f for f in tex if f is not d2 and abs(f['x'] - d2['x']) < 6 and 0 < f['y'] - d2['y'] < d2['h'] * 1.7]
            d3 = min(d3, key=lambda f: f['y']) if d3 else None
            if d3 and d3['t'].startswith('-'):
                nhan.append(d3); ten = [t + ' ' + d2['t'] + d3['t']]
            else:
                ten = [t + ' ' + d2['t']] + ([d3['t']] if d3 else [])
                if d3: nhan.append(d3)
        tb.append(dict(ten=ten, nhan=nhan, d=d, ij=ij, q=q))
    elif RE_COT.match(t):
        d, ij, q = gan_chuoi(e['x'], e['y'])
        if d <= 3: cot.append(dict(ten=t, e=e, ij=ij, q=q))
    elif RE_DAY.match(t) and len(t) < 60:
        d, ij, q = gan_chuoi(e['x'], e['y'])
        if d <= 6: day.append(dict(ten=t, e=e, ij=ij, q=q))
    elif RE_MO.match(t):
        mo.append(e)

# ký hiệu nét đậm: vị trí thiết bị chính xác (tâm cụm nét đậm gần chuỗi nhất trong 8pt quanh chữ)
day_net = G['day']
# ghép nhãn thiết bị với ký hiệu nét đậm nằm trên chuỗi: ghép cặp gần nhất toàn bản vẽ
ung_vien = []
for k_, d_ in enumerate(tb):
    e = d_['nhan'][0]
    for sg in day_net:
        cx, cy = (sg[0] + sg[2]) / 2, (sg[1] + sg[3]) / 2
        kk = min(kc_khung(f, cx, cy) for f in d_['nhan'])
        if kk < 10:
            dd, ij, q = gan_chuoi(cx, cy)
            # ký hiệu hộp (MC, LBS) ở điểm thường cắt: cạnh hộp cách dây đi qua vùng chặn tới ~2pt
            trong_vung = any(v[0] <= cx <= v[2] and v[1] <= cy <= v[3] for v in VUNG_MO if not la_ngat(v))
            if dd < 1.0 or (trong_vung and dd < 3.0):
                # xếp theo khoảng cách tới khung chữ (nhãn sát ký hiệu nào thì của ký hiệu đó)
                ung_vien.append((kk + 0.3 * math.hypot(cx - e['x'], cy - e['y']), k_, q, ij, sg))
# bản vẽ vẽ ký hiệu bằng nét mảnh (dao cách ly là gạch xiên mảnh, hộp MC / LBS là khung mảnh): nhãn chưa
# có ký hiệu nét đậm thì lấy nét mảnh ngắn (1.5 - 10pt) cắt ngang chuỗi (lệch hướng dây > 20 độ) gần nhãn
co_ung = set(u[1] for u in ung_vien)
net_manh = [sg for sg in G['seg'][:G['n0']] if 1.5 <= math.hypot(sg[2] - sg[0], sg[3] - sg[1]) <= 10]
for k_, d_ in enumerate(tb):
    if k_ in co_ung: continue
    e = d_['nhan'][0]
    for sg in net_manh:
        cx, cy = (sg[0] + sg[2]) / 2, (sg[1] + sg[3]) / 2
        kk = min(kc_khung(f, cx, cy) for f in d_['nhan'])
        if kk >= 10: continue
        dd, ij, q = gan_chuoi(cx, cy)
        if dd >= 1.5: continue
        L = math.hypot(sg[2] - sg[0], sg[3] - sg[1])
        cos = abs((sg[2] - sg[0]) / L * q[2] + (sg[3] - sg[1]) / L * q[3])
        if cos > 0.94: continue
        ung_vien.append((kk + 0.3 * math.hypot(cx - e['x'], cy - e['y']) + 2, k_, q, ij, sg))
ung_vien.sort(key=lambda u: u[0])
# cụm nét đậm liền nhau (một ký hiệu): tâm cụm chiếu lên chuỗi là vị trí thiết bị
def cum_net(sg0):
    cum = [sg0]; da = {id(sg0)}
    k = 0
    while k < len(cum) and len(cum) < 40:
        a = cum[k]; k += 1
        for b in day_net:
            if id(b) in da: continue
            if min(math.hypot(a[i] - b[j], a[i + 1] - b[j + 1]) for i in (0, 2) for j in (0, 2)) < 0.6:
                da.add(id(b)); cum.append(b)
    xs = [v for g in cum for v in (g[0], g[2])]; ys = [v for g in cum for v in (g[1], g[3])]
    return (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, max(max(xs) - min(xs), max(ys) - min(ys))
da_gan, da_diem = set(), []
for dist, k_, q, ij, sg in ung_vien:
    if k_ in da_gan: continue
    # chỉ ký hiệu hộp (MC/recloser, LBS) mới lấy tâm cụm; DCL/DPT là nét gạch đơn, cụm có thể
    # dính sang hộp bên cạnh
    hop = re.match(r'(MC|LBS|REC|Recloser)', tb[k_]['ten'][0], re.I)
    cx, cy, co = cum_net(sg) if hop else (0, 0, 99)
    if co < 16:
        dd, ij2, q2 = gan_chuoi(cx, cy)
        if dd < 3.0: q, ij = q2, ij2
    if any(math.hypot(q[0] - p_[0], q[1] - p_[1]) < 2.0 for p_ in da_diem): continue
    da_gan.add(k_); da_diem.append(q)
    tb[k_]['q'] = q; tb[k_]['ij'] = ij
# thiết bị khai vị trí bằng tay (ký hiệu vẽ lạ, công cụ không nhận ra): cfg "tb_vi_tri": {"tên": [x, y]}
for ten_, (px_, py_) in cfg.get('tb_vi_tri', {}).items():
    k_ = next((k for k, d_ in enumerate(tb) if d_['ten'][0] == ten_ or d_['ten'][0].startswith(ten_ + ' ')), None)
    if k_ is None:
        e = next((e for e in tex if e['t'].strip() == ten_), None)
        if e is None:
            print('tb_vi_tri: không thấy chữ', ten_); continue
        tb.append(dict(ten=[ten_], nhan=[e], d=0, ij=None, q=None)); k_ = len(tb) - 1
    dd, ij, q = gan_chuoi(px_, py_)
    tb[k_]['q'] = q; tb[k_]['ij'] = ij
    da_gan.add(k_)
for k_, d_ in enumerate(tb):
    if k_ not in da_gan:
        d_['bo'] = True   # không có ký hiệu trên đường dò: thiết bị ở nhánh rẽ bên cạnh
for d_ in tb:
    e = d_['nhan'][0]
    x, y = d_['q'][0], d_['q'][1]
    d_['mo'] = False
for v in VUNG_MO:
    if la_ngat(v): continue
    cx, cy = (v[0] + v[2]) / 2, (v[1] + v[3]) / 2
    ung = [d_ for d_ in tb if not d_.get('bo')]
    if not ung: break
    g = min(ung, key=lambda d_: math.hypot(d_['q'][0] - cx, d_['q'][1] - cy))
    if math.hypot(g['q'][0] - cx, g['q'][1] - cy) < 6: g['mo'] = True
trong_tu = lambda x, y: any(t['khung'][0] <= x <= t['khung'][2] and t['khung'][1] <= y <= t['khung'][3] for t in TU)
for m in mo:
    if trong_tu(m['x'], m['y']): continue
    ung = [d_ for d_ in tb if not d_.get('bo')]
    if not ung: break
    # ưu tiên thiết bị nằm trên đoạn qua điểm thường cắt (chuỗi liên kết)
    kc = lambda d_: math.hypot(d_['q'][0] - m['x'], d_['q'][1] - m['y'])
    tren_lien = [d_ for d_ in ung if ket['lo'][d_['ij'][0]]['chuoi'][d_['ij'][1]].get('lien') and kc(d_) < 16]
    g = min(tren_lien or ung, key=kc)
    if kc(g) < 16: g['mo'] = True

def loai_tb(ten):
    t = ten[0].upper()
    if t.startswith('LBS'): return 'LBS'
    if t.startswith('MC') or t.startswith('REC'): return 'REC'
    return 'DCL'

BO_TB = set(cfg.get('bo_tb', []))
for d_ in tb:
    if d_.get('bo') or ' | '.join(d_['ten']) in BO_TB or d_['ten'][0] in BO_TB: continue
    i, j, s = d_['ij']
    ket['lo'][i]['chuoi'][j].setdefault('tb', []).append(dict(
        s=round(s, 2), p=[round(d_['q'][0], 2), round(d_['q'][1], 2)], h=[round(d_['q'][2], 3), round(d_['q'][3], 3)],
        loai=loai_tb(d_['ten']), mo=d_['mo'], ten=d_['ten'],
        nhan=[dict(t=e['t'], x0=round(e['x0'], 2), y0=round(e['y0'], 2), x1=round(e['x1'], 2), y1=round(e['y1'], 2),
                   h=round(e['h'], 2), doc=e['doc']) for e in d_['nhan']]))
for c in cot:
    i, j, s = c['ij']; e = c['e']
    ket['lo'][i]['chuoi'][j].setdefault('cot', []).append(dict(
        s=round(s, 2), ten=c['ten'], p=[round(c['q'][0], 2), round(c['q'][1], 2)],
        nhan=dict(x0=round(e['x0'], 2), y0=round(e['y0'], 2), x1=round(e['x1'], 2), y1=round(e['y1'], 2), h=round(e['h'], 2))))
for c in day:
    i, j, s = c['ij']; e = c['e']
    ket['lo'][i]['chuoi'][j].setdefault('day', []).append(dict(
        s=round(s, 2), ten=c['ten'], nhan=dict(x0=round(e['x0'], 2), y0=round(e['y0'], 2), x1=round(e['x1'], 2),
                                              y1=round(e['y1'], 2), h=round(e['h'], 2), doc=e['doc'])))

# ranh giới: cặp tên huyện gần nhau sát chuỗi
hs = [e for e in tex if e['t'].strip() in HUYEN]
for a_i, a in enumerate(hs):
    for b in hs[a_i + 1:]:
        if a['t'] != b['t'] and math.hypot(a['x'] - b['x'], a['y'] - b['y']) < 60:
            d, ij, q = gan_chuoi((a['x'] + b['x']) / 2, (a['y'] + b['y']) / 2)
            if d < 25:
                ket['ranh'].append(dict(ij=list(ij[:2]), p=[round(q[0], 2), round(q[1], 2)], h=[q[2], q[3]],
                                        nhan=[dict(t=e['t'], x0=round(e['x0'], 2), y0=round(e['y0'], 2), x1=round(e['x1'], 2),
                                                   y1=round(e['y1'], 2), h=round(e['h'], 2)) for e in (a, b)]))

# tủ RMU: tiêu đề + tên ngăn; chỗ chuỗi đi vào/ra khung tủ
json.dump(ket, open(sys.argv[2], 'w'), ensure_ascii=False)

# ---------------- ảnh kiểm tra ----------------
anh = next((a[6:] for a in sys.argv if a.startswith('--anh=')), None)
if anh:
    from PIL import Image, ImageDraw
    Image.MAX_IMAGE_PIXELS = None
    z = 3
    pix = p.get_pixmap(matrix=fitz.Matrix(z, z))
    im = Image.frombytes('RGB', (pix.width, pix.height), pix.samples).convert('RGB')
    im = Image.blend(im, Image.new('RGB', im.size, 'white'), 0.55)
    dr = ImageDraw.Draw(im)
    mau = ['#d62728', '#1f77b4', '#2ca02c', '#9467bd', '#ff7f0e']
    for i, lo in enumerate(ket['lo']):
        for c in lo['chuoi']:
            dr.line([(x * z, y * z) for x, y in c['pts']], fill=mau[i % 5], width=4)
            for t in c.get('tb', []):
                x, y = t['p']
                dr.ellipse([x * z - 7, y * z - 7, x * z + 7, y * z + 7], outline='black' if not t['mo'] else 'orange', width=3)
    im.save(anh)
print('xong', ', '.join(f"{lo['ten']}: {len(lo['chuoi'])} chuỗi, {sum(len(c.get('tb', [])) for c in lo['chuoi'])} TB" for lo in ket['lo']))
