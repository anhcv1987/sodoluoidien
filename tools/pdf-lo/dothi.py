import sys, math, heapq, collections, re as _re, pymupdf as fitz
def dung(pdf, CAM=(), VUNG=(), MO=(), tu_chan=True, giao_cheo=True):
    d=fitz.open(pdf); p=d[0]; M=p.rotation_matrix
    seg=[]; day=[]
    for g in p.get_drawings():
        if g['type']!='s': continue
        w=g.get('width') or 0
        for it in g['items']:
            ds=[]
            if it[0]=='l': ds=[(it[1],it[2])]
            elif it[0]=='re':
                r=it[1]; q=[fitz.Point(r.x0,r.y0),fitz.Point(r.x1,r.y0),fitz.Point(r.x1,r.y1),fitz.Point(r.x0,r.y1)]
                ds=[(q[i],q[(i+1)%4]) for i in range(4)]
            elif it[0]=='qu':
                qd=it[1]; q=[qd.ul,qd.ur,qd.lr,qd.ll]
                ds=[(q[i],q[(i+1)%4]) for i in range(4)]
            for a0,b0 in ds:
                a=a0*M; b=b0*M
                if math.hypot(b.x-a.x,b.y-a.y)<0.05: continue
                (day if w>0.3 else seg).append((a.x,a.y,b.x,b.y))
    # đỉnh: gộp đầu mút trong 0.4pt
    K=0.4
    nut={}; xy=[]
    def id_(x,y):
        k=(round(x/K),round(y/K))
        for dx in (-1,0,1):
            for dy in (-1,0,1):
                if (k[0]+dx,k[1]+dy) in nut: return nut[(k[0]+dx,k[1]+dy)]
        nut[k]=len(xy); xy.append((x,y)); return nut[k]
    ke=collections.defaultdict(list)
    def noi(u,v,w):
        if u!=v: ke[u].append((v,w)); ke[v].append((u,w))
    E=[]
    for (x0,y0,x1,y1) in seg:
        u=id_(x0,y0); v=id_(x1,y1); E.append((u,v)); noi(u,v,math.hypot(x1-x0,y1-y0))
    # chữ T: đầu mút nằm giữa đoạn khác
    import bisect
    grid=collections.defaultdict(list); G=10
    for i,(x0,y0,x1,y1) in enumerate(seg):
        for gx in range(int(min(x0,x1)//G),int(max(x0,x1)//G)+1):
            for gy in range(int(min(y0,y1)//G),int(max(y0,y1)//G)+1): grid[(gx,gy)].append(i)
    def chieu(px,py,x0,y0,x1,y1):
        dx,dy=x1-x0,y1-y0; L=dx*dx+dy*dy
        t=max(0,min(1,((px-x0)*dx+(py-y0)*dy)/L)) if L else 0
        return t,math.hypot(x0+t*dx-px,y0+t*dy-py)
    # nét đậm (ký hiệu thiết bị) cũng là đường dẫn: nối vào đồ thị, cho vào lưới để bắt
    n0=len(seg)
    for (x0,y0,x1,y1) in day:
        u=id_(x0,y0); v=id_(x1,y1); noi(u,v,math.hypot(x1-x0,y1-y0)); E.append((u,v))
        i=len(seg); seg.append((x0,y0,x1,y1))
        for gx in range(int(min(x0,x1)//G),int(max(x0,x1)//G)+1):
            for gy in range(int(min(y0,y1)//G),int(max(y0,y1)//G)+1): grid[(gx,gy)].append(i)
    # hai nét mảnh cắt ngang nhau (giao chữ thập, không có vòng nhảy) - coi là có nối
    def giao(a,b):
        x1,y1,x2,y2=a; x3,y3,x4,y4=b
        den=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4)
        if abs(den)<1e-9: return None
        t=((x1-x3)*(y3-y4)-(y1-y3)*(x3-x4))/den; u=-((x1-x2)*(y1-y3)-(y1-y2)*(x1-x3))/den
        if 0.02<t<0.98 and 0.02<u<0.98: return (x1+t*(x2-x1),y1+t*(y2-y1))
        return None
    if giao_cheo:
        da=set()
        for cell,ids in list(grid.items()):
            ids=[i for i in ids if i<n0]
            for ii in range(len(ids)):
                for jj in range(ii+1,len(ids)):
                    i,j=ids[ii],ids[jj]
                    if (i,j) in da: continue
                    da.add((i,j))
                    X=giao(seg[i],seg[j])
                    if not X: continue
                    c=id_(*X)
                    for k in (i,j):
                        x0,y0,x1,y1=seg[k]
                        noi(c,id_(x0,y0),math.hypot(X[0]-x0,X[1]-y0)); noi(c,id_(x1,y1),math.hypot(X[0]-x1,X[1]-y1))
    # chấm cột (hình tròn nhỏ): mọi nét đi qua chấm nối với nhau tại tâm chấm
    cham=[]
    for g in p.get_drawings():
        its=g['items']
        if its and all(it[0]=='c' for it in its):
            r=g['rect']*M
            if r.width<3.2 and r.height<3.2 and r.width>0.5: cham.append(((r.x0+r.x1)/2,(r.y0+r.y1)/2,max(r.width,r.height)/2))
    for (cx,cy,rr) in cham:
        c=None
        for i in grid[(int(cx//G),int(cy//G))]:
            x0,y0,x1,y1=seg[i]; t,dd=chieu(cx,cy,x0,y0,x1,y1)
            if dd<=rr+0.4:
                if c is None: c=id_(cx,cy)
                u,v=id_(x0,y0),id_(x1,y1)
                noi(c,u,math.hypot(cx-x0,cy-y0)); noi(c,v,math.hypot(cx-x1,cy-y1))
    deg=collections.Counter()
    for u,v in E: deg[u]+=1; deg[v]+=1
    for n,(x,y) in enumerate(xy):
        for i in grid[(int(x//G),int(y//G))]:
            x0,y0,x1,y1=seg[i]; t,dd=chieu(x,y,x0,y0,x1,y1)
            if dd<0.35 and 0.001<t<0.999:
                u=id_(x0,y0); v=id_(x1,y1)
                noi(n,u,math.hypot(x-x0,y-y0)); noi(n,v,math.hypot(x-x1,y-y1))
    # nối khe nét đứt / khe ký hiệu: đầu mút bậc 1 tới đầu mút khác cùng phương trong 7pt
    dau=[n for n in range(len(xy)) if deg[n]==1]
    huong={}
    for u,v in E:
        for a,b in ((u,v),(v,u)):
            if deg[a]==1:
                (xa,ya),(xb,yb)=xy[a],xy[b]; L=math.hypot(xa-xb,ya-yb) or 1
                huong[a]=((xa-xb)/L,(ya-yb)/L)
    dg=collections.defaultdict(list)
    # đầu cụt sát đỉnh khác (<1.6pt): nối luôn (lưỡi dao, khe ký hiệu)
    for n in dau: dg[(int(xy[n][0]//8),int(xy[n][1]//8))]
    for a in dau:
        xa,ya=xy[a]
        for i in grid[(int(xa//G),int(ya//G))]:
            x0,y0,x1,y1=seg[i]
            for (bx,by) in ((x0,y0),(x1,y1)):
                b=id_(bx,by)
                L=math.hypot(bx-xa,by-ya)
                if b!=a and L<1.6: noi(a,b,L)
    for n in dau: dg[(int(xy[n][0]//8),int(xy[n][1]//8))].append(n)
    for a in dau:
        xa,ya=xy[a]; ha=huong.get(a)
        if not ha: continue
        for gx in (-1,0,1):
            for gy in (-1,0,1):
                for b in dg[(int(xa//8)+gx,int(ya//8)+gy)]:
                    if b<=a: continue
                    xb,yb=xy[b]; L=math.hypot(xb-xa,yb-ya)
                    if L>12 or L<0.01: continue
                    ux,uy=(xb-xa)/L,(yb-ya)/L
                    hb=huong.get(b)
                    if ha[0]*ux+ha[1]*uy>0.97 and hb and -(hb[0]*ux+hb[1]*uy)>0.97:
                        noi(a,b,L*1.5)
    # đầu dây cụt: kéo dài theo hướng ra tối đa 7pt, gặp nét nào thì nối vào nét đó
    for a in dau:
        ha=huong.get(a)
        if not ha: continue
        xa,ya=xy[a]
        hit=None
        for k in range(1,41):
            qx,qy=xa+ha[0]*k*0.25,ya+ha[1]*k*0.25
            for i in grid[(int(qx//G),int(qy//G))]:
                x0,y0,x1,y1=seg[i]
                u,v=id_(x0,y0),id_(x1,y1)
                if a in (u,v): continue
                t,dd=chieu(qx,qy,x0,y0,x1,y1)
                if dd<0.3: hit=(i,t,k*0.25); break
            if hit: break
        if hit:
            i,t,L=hit; x0,y0,x1,y1=seg[i]; u,v=id_(x0,y0),id_(x1,y1)
            Ls=math.hypot(x1-x0,y1-y0)
            noi(a,u,L+t*Ls); noi(a,v,L+(1-t)*Ls)
    # --- chặn thiết bị thường cắt: nhãn "(Thường cắt)" / "thường cắt" đứng riêng -> ký hiệu nét đậm gần nhất
    import re as _re
    _tex=[]
    for b in p.get_text('dict')['blocks']:
        for l in b.get('lines',[]):
            t=''.join(sp['text'] for sp in l['spans']).strip()
            r=fitz.Rect(l['bbox'])*M
            _tex.append(((r.x0+r.x1)/2,(r.y0+r.y1)/2,t))
    nhan_mo=[(x,y) for x,y,t in _tex if _re.fullmatch(r'\(?\s*[Tt]hường cắt\s*\)?',t)]
    vung=[]
    def cum_quanh(cx,cy):
        # các nét đậm liền nhau quanh điểm (cx,cy)
        ds=[sg for sg in day if min(math.hypot(sg[0]-cx,sg[1]-cy),math.hypot(sg[2]-cx,sg[3]-cy))<6]
        if not ds: return None
        xs=[v for sg in ds for v in (sg[0],sg[2])]; ys=[v for sg in ds for v in (sg[1],sg[3])]
        return (min(xs)-0.6,min(ys)-0.6,max(xs)+0.6,max(ys)+0.6)
    if tu_chan:
        for (x,y) in nhan_mo:
            if not day: break
            k=min(day,key=lambda sg:math.hypot((sg[0]+sg[2])/2-x,(sg[1]+sg[3])/2-y))
            dd=math.hypot((k[0]+k[2])/2-x,(k[1]+k[3])/2-y)
            if dd<18:
                v=cum_quanh((k[0]+k[2])/2,(k[1]+k[3])/2)
                if v: vung.append(v)
    for v in VUNG: vung.append(tuple(v))
    for (x,y) in CAM:
        v=cum_quanh(x,y); vung.append(v if v else (x-2.5,y-2.5,x+2.5,y+2.5))
    # --mo: bỏ chặn quanh điểm (thiết bị thường cắt nhưng muốn đi qua)
    vung=[v for v in vung if not any(v[0]-3<=x<=v[2]+3 and v[1]-3<=y<=v[3]+3 for x,y in MO)]
    chan=set(n for n,(x,y) in enumerate(xy) if any(v[0]<=x<=v[2] and v[1]<=y<=v[3] for v in vung))
    # đỉnh biên: còn giữ nhưng có cạnh nối vào đỉnh bị chặn của vùng k
    bien={}
    for k,v in enumerate(vung):
        trong_v=set(n for n in chan if v[0]<=xy[n][0]<=v[2] and v[1]<=xy[n][1]<=v[3])
        bien[k]=set(u for n in trong_v for u,w in ke[n] if u not in chan)
    # cạnh cắt xuyên vùng (không có đỉnh nào trong vùng): cũng cắt
    def xuyen(a,b,v):
        (x0,y0),(x1,y1)=a,b; t0,t1=0.0,1.0; dx,dy=x1-x0,y1-y0
        for pp,qq in ((-dx,x0-v[0]),(dx,v[2]-x0),(-dy,y0-v[1]),(dy,v[3]-y0)):
            if pp==0:
                if qq<0: return False
            else:
                r=qq/pp
                if pp<0: t0=max(t0,r)
                else: t1=min(t1,r)
        return t0<t1
    cat_canh=set()
    for u in list(ke):
        if u in chan: continue
        for v_,w in ke[u]:
            if v_ in chan or v_<u: continue
            for k,v in enumerate(vung):
                if xuyen(xy[u],xy[v_],v):
                    cat_canh.add((u,v_)); bien[k].add(u); bien[k].add(v_)
    for u in list(ke): ke[u]=[(v,w) for v,w in ke[u] if v not in chan and (min(u,v),max(u,v)) not in cat_canh]
    for n in chan: ke[n]=[]
    print('chặn', len(vung), 'thiết bị thường cắt:', ' '.join(f'({(v[0]+v[2])/2:.0f},{(v[1]+v[3])/2:.0f})' for v in vung))
    def gan(x,y):
        return min((n for n in range(len(xy)) if n not in chan),key=lambda n:math.hypot(xy[n][0]-x,xy[n][1]-y))

    return dict(bien=bien,p=p,M=M,xy=xy,ke=ke,seg=seg,day=day,chan=chan,gan=gan,chieu=chieu,vung=vung,n0=n0)
def dij(G,s,t=None):
    ke=G['ke'];D={s:0};P={};h=[(0,s)]
    while h:
        dd,u=heapq.heappop(h)
        if u==t: break
        if dd>D[u]: continue
        for v,w in ke[u]:
            nd=dd+w
            if nd<D.get(v,1e18): D[v]=nd;P[v]=u;heapq.heappush(h,(nd,v))
    return D,P
