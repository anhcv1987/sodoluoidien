"""Ve nguyen ban mot vung cua file DXF goc ra SVG de doi chieu.
   python3 tools/xem-cad.py x0,y0,x1,y1 ra.svg [duong-dan-dxf]"""
import ezdxf, sys, math
from ezdxf.math import Vec3
f = sys.argv[3] if len(sys.argv) > 3 else 'tram/to-tong.dxf'
OX, OY = 745932.58, 5940.11   # lech giua toa do CAD va toa do to ve
x0,y0,x1,y1 = [float(v) for v in sys.argv[1].split(',')]
out = sys.argv[2]
d = ezdxf.readfile(f); msp = d.modelspace()
W = 1000; H = max(1, int(W*(y1-y0)/(x1-x0))); sc = W/(x1-x0)
X = lambda x: (x-OX-x0)*sc
Y = lambda y: H-(y-OY-y0)*sc
seg=[]; circ=[]
def add(e):
    t=e.dxftype()
    try:
        if t=='LINE': seg.append((e.dxf.start,e.dxf.end))
        elif t=='CIRCLE': circ.append((e.dxf.center,e.dxf.radius))
        elif t=='ARC':
            c=e.dxf.center; r=e.dxf.radius
            a0=math.radians(e.dxf.start_angle); a1=math.radians(e.dxf.end_angle)
            if a1<a0: a1+=2*math.pi
            n=max(6,int((a1-a0)/0.2))
            pts=[Vec3(c.x+r*math.cos(a0+(a1-a0)*i/n), c.y+r*math.sin(a0+(a1-a0)*i/n),0) for i in range(n+1)]
            for i in range(n): seg.append((pts[i],pts[i+1]))
        elif t=='LWPOLYLINE':
            p=[Vec3(q[0],q[1],0) for q in e.get_points('xy')]
            for i in range(len(p)-1): seg.append((p[i],p[i+1]))
            if e.closed and len(p)>2: seg.append((p[-1],p[0]))
    except Exception: pass
for e in msp:
    if e.dxftype()=='INSERT':
        p=e.dxf.insert
        if not (x0-150<=p.x-OX<=x1+150 and y0-150<=p.y-OY<=y1+150): continue
        for v in e.virtual_entities(): add(v)
    elif e.dxftype() not in ('TEXT','MTEXT'): add(e)
inb = lambda p: x0-30<=p.x-OX<=x1+30 and y0-30<=p.y-OY<=y1+30
L=[f'<line x1="{X(a.x):.1f}" y1="{Y(a.y):.1f}" x2="{X(b.x):.1f}" y2="{Y(b.y):.1f}"/>'
   for a,b in seg if inb(a) or inb(b)]
L+= [f'<circle cx="{X(c.x):.1f}" cy="{Y(c.y):.1f}" r="{r*sc:.1f}" fill="none"/>' for c,r in circ if inb(c)]
open(out,'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
  f'<rect width="{W}" height="{H}" fill="#fff"/><g stroke="#0a0" stroke-width="1.2" fill="none">'+''.join(L)+'</g></svg>')
print(out, W, H, len(L))
