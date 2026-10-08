"""Generates the profile / song-marker border artwork for Wavelength.

Run from the repo root:   python3 tools/borders/generate_borders.py

Writes frontend/public/borders/<key>-<circle|square>-<1|2>.svg:
  - circle = wraps the round profile picture, square = wraps the ocean song marker
  - layer 1 and layer 2 are separate files so the frontend can animate them on
    different rhythms (see frontend/src/components/BorderFrame.tsx and
    frontend/src/lib/borders.ts). Same seed per design => same artwork each run.

The art is drawn on a 400x400 canvas with the picture itself filling the
middle 184x184 (half-size A = 92); everything else is decoration that spills
outside the picture's edge.

To add a border: write a function like bubble_ring() below, add it to DESIGNS
with a new key, run this script, then add the matching entry to
frontend/src/lib/borders.ts and backend/lib/challengePool.js (and run the SQL
in backend/db/borders-migration.sql for the new reward row).
"""
import math, random, bisect

C = 200
A = 92

def shape_points(shape, n=2000):
    pts = []
    for i in range(n):
        th = 2*math.pi*i/n
        if shape == 'circle':
            x, y = A*math.cos(th), A*math.sin(th); nx, ny = math.cos(th), math.sin(th)
        else:
            p = 5; c, s = math.cos(th), math.sin(th)
            x = A*math.copysign(abs(c)**(2/p), c); y = A*math.copysign(abs(s)**(2/p), s)
            gx, gy = math.copysign(abs(x/A)**(p-1), x), math.copysign(abs(y/A)**(p-1), y)
            l = math.hypot(gx, gy); nx, ny = gx/l, gy/l
        pts.append((x, y, nx, ny))
    L = [0]
    for i in range(1, n+1):
        a, b = pts[i-1], pts[i % n]
        L.append(L[-1] + math.hypot(b[0]-a[0], b[1]-a[1]))
    return pts, L

def place(shape, count, rnd, jitter=0.35):
    pts, L = shape_points(shape); total = L[-1]; out = []
    for k in range(count):
        target = (k + rnd.uniform(-jitter, jitter)) / count * total % total
        j = min(max(bisect.bisect_right(L, target) - 1, 0), len(pts) - 1)
        x, y, nx, ny = pts[j]
        out.append((C+x, C+y, nx, ny))
    return out

def base(shape):
    if shape == 'circle':
        return f'<circle cx="{C}" cy="{C}" r="{A}" fill="#2a3341"/><text x="{C}" y="{C+10}" text-anchor="middle" font-family="Inter,Arial" font-size="30" font-weight="700" fill="#cbd5e1">S</text>'
    return (f'<rect x="{C-A}" y="{C-A}" width="{2*A}" height="{2*A}" rx="30" fill="#141c29" stroke="#2d3c52" stroke-width="2"/>'
            f'<text x="{C}" y="{C+6}" text-anchor="middle" font-family="Inter,Arial" font-size="19" font-weight="600" fill="#94a3b8">Your song</text>')

GLOW = lambda i, sd: f'<filter id="gl{i}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="{sd}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'

# Each design returns (defs, layer1, layer2). The two layers "breathe" on
# slightly different rhythms so the motion feels organic, not mechanical.

def bubble_ring(shape, rnd):
    l1, l2 = [], []
    for layer, count, dmin, dmax in ((l1, 90, 0, 16), (l2, 80, 14, 34)):
        for x, y, nx, ny in place(shape, count, rnd, 0.5):
            d = rnd.uniform(dmin, dmax); r = rnd.choice([2.5,3,4,5,6,7,9,11]) * rnd.uniform(.85, 1.15)
            cx, cy = x+nx*(d+r*0.4), y+ny*(d+r*0.4)
            layer.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="rgba(125,232,255,.12)" stroke="#5fe0ff" stroke-width="2"/>'
                         f'<path d="M{cx-r*.55:.1f} {cy-r*.1:.1f} A{r*.6:.1f} {r*.6:.1f} 0 0 1 {cx-r*.05:.1f} {cy-r*.58:.1f}" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round"/>')
    return GLOW(1, 2), l1, l2

def star(cx, cy, s, rot, col):
    return (f'<path transform="translate({cx:.1f} {cy:.1f}) rotate({rot:.0f})" fill="{col}" '
            f'd="M0 {-s} Q{s*.12} {-s*.12} {s} 0 Q{s*.12} {s*.12} 0 {s} Q{-s*.12} {s*.12} {-s} 0 Q{-s*.12} {-s*.12} 0 {-s}Z"/>')

def sparkle_ring(shape, rnd):
    cols = ['#5ff0ff', '#ff8ad8', '#ffe66b', '#8dffc6', '#b69cff']
    l1, l2 = [], []
    for x, y, nx, ny in place(shape, 46, rnd, 0.45):
        d = rnd.uniform(5, 22); l1.append(star(x+nx*d, y+ny*d, rnd.choice([7, 9, 11, 14, 18]), rnd.uniform(-15, 15), rnd.choice(cols)))
    for x, y, nx, ny in place(shape, 40, rnd, 0.45):
        d = rnd.uniform(18, 40); l2.append(star(x+nx*d, y+ny*d, rnd.choice([4, 5, 6, 8]), rnd.uniform(-15, 15), rnd.choice(cols)))
    for x, y, nx, ny in place(shape, 110, rnd, 0.5):
        d = rnd.uniform(0, 44)
        l2.append(f'<circle cx="{x+nx*d:.1f}" cy="{y+ny*d:.1f}" r="{rnd.uniform(1.2,2.8):.1f}" fill="{rnd.choice(cols)}" opacity=".9"/>')
    return GLOW(2, 1.5), l1, l2

def pearl_ring(shape, rnd):
    defs = ('<radialGradient id="pg" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#f4e9ee"/><stop offset="1" stop-color="#b9a9c9"/></radialGradient>' + GLOW(3, 2.6))
    l1, l2 = [], []
    for layer, count, off, big, small in ((l1, 50, 10, 9.5, 7), (l2, 40, 27, 7, 5)):
        pts = place(shape, count, rnd, 0)
        path = ' '.join(f'{"M" if i==0 else "L"}{x+nx*off:.1f} {y+ny*off:.1f}' for i, (x, y, nx, ny) in enumerate(pts)) + ' Z'
        layer.append(f'<path d="{path}" stroke="#d9c8e6" stroke-width="1.3" fill="none" opacity=".7"/>')
        for i, (x, y, nx, ny) in enumerate(pts):
            r = big if i % 5 == 0 else small
            layer.append(f'<circle cx="{x+nx*off:.1f}" cy="{y+ny*off:.1f}" r="{r}" fill="url(#pg)" stroke="#a592b8" stroke-width="1"/>')
    return defs, l1, l2

def leaf(x, y, ang, sc, fill='url(#kg)', stroke='#bdf7dc'):
    return (f'<path transform="translate({x:.1f} {y:.1f}) rotate({ang:.0f}) scale({sc:.2f})" fill="{fill}" stroke="{stroke}" stroke-width="1" stroke-opacity=".6" '
            f'd="M0 4 C 9 -8 9 -26 0 -40 C -9 -26 -9 -8 0 4Z"/>')

def kelp_wreath(shape, rnd):
    defs = '<linearGradient id="kg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#0f6b4f"/><stop offset="1" stop-color="#47e0a0"/></linearGradient>'
    l1, l2 = [], []
    for layer, count, lo, hi in ((l1, 44, .5, 1.0), (l2, 38, .35, .7)):
        for x, y, nx, ny in place(shape, count, rnd, 0.4):
            ang = math.degrees(math.atan2(ny, nx)) + 90 + rnd.uniform(-42, 42)
            layer.append(leaf(x, y, ang, rnd.uniform(lo, hi)))
    for x, y, nx, ny in place(shape, 22, rnd, 0.5):
        d = rnd.uniform(26, 46); r = rnd.uniform(2.5, 5)
        l2.append(f'<circle cx="{x+nx*d:.1f}" cy="{y+ny*d:.1f}" r="{r:.1f}" fill="none" stroke="#c9f6ff" stroke-width="1.5" opacity=".9"/>')
    return defs, l1, l2

def coral(x, y, ang, depth, length, w, col, out):
    x2, y2 = x + math.cos(math.radians(ang))*length, y + math.sin(math.radians(ang))*length
    out.append(f'<line x1="{x:.1f}" y1="{y:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{col}" stroke-width="{w:.1f}" stroke-linecap="round"/>')
    if depth == 0:
        out.append(f'<circle cx="{x2:.1f}" cy="{y2:.1f}" r="{w*0.9:.1f}" fill="#ffe3ec"/>'); return
    for da in (-32, 28):
        coral(x2, y2, ang+da+random.uniform(-8, 8), depth-1, length*0.72, w*0.78, col, out)

def coral_reef(shape, rnd):
    random.seed(rnd.random())
    cols = ['#ff6f91', '#ff9671', '#ffc75f', '#f9a8d4']
    l1, l2 = [], []
    for layer, count, ln, w in ((l2, 22, 14, 4.6), (l1, 26, 11, 3.6)):
        for x, y, nx, ny in place(shape, count, rnd, 0.4):
            ang = math.degrees(math.atan2(ny, nx)) + rnd.uniform(-20, 20)
            coral(x, y, ang, 2, ln*rnd.uniform(.8, 1.3), w, rnd.choice(cols), layer)
    return GLOW(4, 1.2), l1, l2

def starfish(cx, cy, r, rot, col):
    pts = []
    for i in range(10):
        a = math.radians(rot - 90 + i*36); rr = r if i % 2 == 0 else r*0.45
        pts.append(f'{cx+math.cos(a)*rr:.1f},{cy+math.sin(a)*rr:.1f}')
    dots = ''.join(f'<circle cx="{cx+math.cos(math.radians(rot-90+k*72))*r*.5:.1f}" cy="{cy+math.sin(math.radians(rot-90+k*72))*r*.5:.1f}" r="{r*.07:.1f}" fill="#fff3c4"/>' for k in range(5))
    return f'<polygon points="{" ".join(pts)}" fill="{col}" stroke="#fff3c4" stroke-width="1.2" stroke-linejoin="round"/>{dots}'

def shell(cx, cy, r, ang):
    ribs = ''.join(f'<line x1="0" y1="0" x2="{math.cos(math.radians(a))*r:.1f}" y2="{-math.sin(math.radians(a))*r:.1f}" stroke="#e7a6b8" stroke-width="1"/>' for a in range(20, 161, 20))
    return (f'<g transform="translate({cx:.1f} {cy:.1f}) rotate({ang:.0f})"><path d="M0 0 L{-r} {-r*.2:.1f} A{r} {r} 0 0 1 {r} {-r*.2:.1f} Z" fill="#ffd9e2" stroke="#e7a6b8" stroke-width="1.2"/>{ribs}</g>')

def starfish_shells(shape, rnd):
    cols = ['#ff8a65', '#ffb74d', '#ff7a90']
    l1, l2 = [], []
    for x, y, nx, ny in place(shape, 16, rnd, 0.4):
        d = rnd.uniform(8, 20); l1.append(starfish(x+nx*d, y+ny*d, rnd.choice([11, 14, 17]), rnd.uniform(0, 72), rnd.choice(cols)))
    for x, y, nx, ny in place(shape, 22, rnd, 0.4):
        d = rnd.uniform(10, 24); l1.append(shell(x+nx*d, y+ny*d, rnd.choice([8, 10, 12]), math.degrees(math.atan2(ny, nx)) + 90 + rnd.uniform(-25, 25)))
    for x, y, nx, ny in place(shape, 70, rnd, 0.5):
        d = rnd.uniform(24, 42); l2.append(f'<circle cx="{x+nx*d:.1f}" cy="{y+ny*d:.1f}" r="{rnd.uniform(1.5,3.4):.1f}" fill="#fff3c4" opacity=".9"/>')
    for x, y, nx, ny in place(shape, 24, rnd, 0.5):
        d = rnd.uniform(26, 44); l2.append(starfish(x+nx*d, y+ny*d, rnd.choice([5, 6, 8]), rnd.uniform(0, 72), rnd.choice(cols)))
    return GLOW(5, 1.0), l1, l2

# ---- Dinosaur ideas ----
def footprint(x, y, ang, s, col):
    toes = ''.join(f'<ellipse cx="{math.sin(math.radians(a))*8*s:.1f}" cy="{-math.cos(math.radians(a))*8*s:.1f}" rx="{2.3*s:.1f}" ry="{4*s:.1f}" transform="rotate({a} {math.sin(math.radians(a))*8*s:.1f} {-math.cos(math.radians(a))*8*s:.1f})"/>' for a in (-38, 0, 38))
    return f'<g transform="translate({x:.1f} {y:.1f}) rotate({ang:.0f})" fill="{col}"><ellipse cx="0" cy="1" rx="{4.2*s:.1f}" ry="{5*s:.1f}"/>{toes}</g>'

def dino_eggs(shape, rnd):
    defs = ('<radialGradient id="egg" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#fff9e6"/><stop offset=".7" stop-color="#f3e3b3"/><stop offset="1" stop-color="#d9bf7a"/></radialGradient>'
            '<linearGradient id="fern" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#1b6b32"/><stop offset="1" stop-color="#69db7c"/></linearGradient>')
    l1, l2 = [], []
    for x, y, nx, ny in place(shape, 40, rnd, 0.4):   # ferns behind
        ang = math.degrees(math.atan2(ny, nx)) + 90 + rnd.uniform(-50, 50)
        l2.append(leaf(x, y, ang, rnd.uniform(.5, .95), 'url(#fern)', '#b2f2bb'))
    for x, y, nx, ny in place(shape, 22, rnd, 0.35):  # spotted eggs
        d = rnd.uniform(10, 20); ex, ey = x+nx*d, y+ny*d; rot = math.degrees(math.atan2(ny, nx)) + 90 + rnd.uniform(-20, 20)
        s = rnd.uniform(.8, 1.15)
        spots = ''.join(f'<circle cx="{rnd.uniform(-4,4):.1f}" cy="{rnd.uniform(-6,6):.1f}" r="{rnd.uniform(1,2):.1f}" fill="#a9803d" opacity=".75"/>' for _ in range(4))
        l1.append(f'<g transform="translate({ex:.1f} {ey:.1f}) rotate({rot:.0f}) scale({s:.2f})"><ellipse rx="8" ry="10.5" fill="url(#egg)" stroke="#a9803d" stroke-width="1.2"/>{spots}</g>')
    for x, y, nx, ny in place(shape, 12, rnd, 0.4):
        d = rnd.uniform(34, 46); l2.append(footprint(x+nx*d, y+ny*d, math.degrees(math.atan2(ny, nx)) + 90 + rnd.uniform(-50, 50), rnd.uniform(.7, 1.0), '#69db7c'))
    return '', l1, l2, defs

def norm(res):
    if len(res) == 4:  # dino: (blank, l1, l2, defs)
        return res[3], res[1], res[2]
    return res

BONE = '#f6edd3'; BONE_EDGE = '#8a7a55'

def bone(cx, cy, ang, L):
    k = 3.4
    return (f'<g transform="translate({cx:.1f} {cy:.1f}) rotate({ang:.0f})" fill="{BONE}" stroke="{BONE_EDGE}" stroke-width="1.1">'
            f'<rect x="{-L/2:.1f}" y="-2.2" width="{L:.1f}" height="4.4" rx="2"/>'
            f'<circle cx="{-L/2:.1f}" cy="-2.6" r="{k}"/><circle cx="{-L/2:.1f}" cy="2.6" r="{k}"/>'
            f'<circle cx="{L/2:.1f}" cy="-2.6" r="{k}"/><circle cx="{L/2:.1f}" cy="2.6" r="{k}"/></g>')

def skull(cx, cy, ang, s):
    teeth = ''.join(f'<path d="M{-7+i*3.5:.1f} 8 l1.7 4.2 l1.7 -4.2z" fill="#fff" stroke="{BONE_EDGE}" stroke-width=".7"/>' for i in range(5))
    return (f'<g transform="translate({cx:.1f} {cy:.1f}) rotate({ang:.0f}) scale({s})">'
            f'<ellipse cx="0" cy="-1" rx="12" ry="10" fill="{BONE}" stroke="{BONE_EDGE}" stroke-width="1.3"/>'
            f'<rect x="-8" y="3" width="16" height="9" rx="3" fill="{BONE}" stroke="{BONE_EDGE}" stroke-width="1.3"/>{teeth}'
            f'<circle cx="-4.6" cy="-2.2" r="3" fill="#2b1d0e"/><circle cx="4.6" cy="-2.2" r="3" fill="#2b1d0e"/>'
            f'<circle cx="-4.6" cy="-2.2" r="1" fill="#ff7a2f"/><circle cx="4.6" cy="-2.2" r="1" fill="#ff7a2f"/>'
            f'<path d="M-1.4 3.2 l1.4 -2.4 l1.4 2.4z" fill="#2b1d0e"/></g>')

def claw(x, y, ang, s):
    lines = ''.join(f'<path d="M{o*5:.1f} {-14*s:.1f} Q{o*5+3:.1f} 0 {o*5-1:.1f} {14*s:.1f}" stroke="#ff4d4d" stroke-width="2.2" fill="none" stroke-linecap="round"/>' for o in (-1, 0, 1))
    return f'<g transform="translate({x:.1f} {y:.1f}) rotate({ang:.0f})" opacity=".95">{lines}</g>'

def dino_wild(shape, rnd):
    defs = ('<linearGradient id="plate" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#d9480f"/><stop offset=".6" stop-color="#ff922b"/><stop offset="1" stop-color="#ffd43b"/></linearGradient>'
            + GLOW(7, 1.4))
    l1, l2 = [], []
    # back layer: embers, claw slashes, teeth jaw
    for x, y, nx, ny in place(shape, 70, rnd, 0.1):
        ang = math.degrees(math.atan2(ny, nx)) + 90
        l2.append(f'<path transform="translate({x+nx*3:.1f} {y+ny*3:.1f}) rotate({ang:.0f})" d="M-4 0 L0 -11 L4 0Z" fill="#fff" stroke="{BONE_EDGE}" stroke-width=".9" stroke-linejoin="round"/>')
    for x, y, nx, ny in place(shape, 20, rnd, 0.45):
        d = rnd.uniform(30, 50); l2.append(f'<circle cx="{x+nx*d:.1f}" cy="{y+ny*d:.1f}" r="{rnd.uniform(1.3,3):.1f}" fill="{rnd.choice(["#ff7a2f","#ffd43b","#ff4d4d"])}" filter="url(#gl7)"/>')
    for x, y, nx, ny in place(shape, 6, rnd, 0.3):
        d = rnd.uniform(38, 48); l2.append(claw(x+nx*d, y+ny*d, math.degrees(math.atan2(ny, nx)) + 90 + rnd.uniform(-35, 35), rnd.uniform(.7, 1)))
    for x, y, nx, ny in place(shape, 12, rnd, 0.4):
        d = rnd.uniform(34, 46); l2.append(footprint(x+nx*d, y+ny*d, math.degrees(math.atan2(ny, nx)) + 90 + rnd.uniform(-50, 50), rnd.uniform(.7, 1.0), '#ffd43b'))
    # front layer: stegosaurus plates, then two staggered rings of bones, then four skulls
    for i, (x, y, nx, ny) in enumerate(place(shape, 26, rnd, 0.15)):
        h = (34 if i % 2 == 0 else 24) * rnd.uniform(.85, 1.15); w = h*0.4
        ang = math.degrees(math.atan2(ny, nx)) + 90
        l1.append(f'<path transform="translate({x+nx*14:.1f} {y+ny*14:.1f}) rotate({ang:.0f})" fill="url(#plate)" stroke="#7c2d12" stroke-width="1.3" stroke-linejoin="round" d="M{-w:.1f} 0 L0 {-h:.1f} L{w:.1f} 0 Z"/>')
    for off, count, L in ((15, 22, 26), (27, 26, 20)):
        for x, y, nx, ny in place(shape, count, rnd, 0.1):
            tangent = math.degrees(math.atan2(ny, nx)) + 90   # lay each bone along the edge
            l1.append(bone(x+nx*off, y+ny*off, tangent + rnd.uniform(-22, 22), L*rnd.uniform(.85, 1.1)))
    for x, y, nx, ny in place(shape, 4, rnd, 0):
        l1.append(skull(x+nx*36, y+ny*36, math.degrees(math.atan2(ny, nx)) + 90, 1.25))
    return defs, l1, l2


# (key, display name, generator). Order fixes each design's random seed.
DESIGNS = [
    ('bubble-ring', 'Bubble Ring', bubble_ring),
    ('sea-sparkle', 'Sea Sparkle', sparkle_ring),
    ('pearl-strand', 'Pearl Strand', pearl_ring),
    ('kelp-wreath', 'Kelp Wreath', kelp_wreath),
    ('coral-reef', 'Coral Reef', coral_reef),
    ('starfish-shells', 'Starfish & Shells', starfish_shells),
    ('skeletons', 'Skeletons', dino_wild),
    ('dino-eggs', 'Dino Eggs', dino_eggs),
]

def layer_svg(defs, layer):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">'
            f'<defs>{defs}</defs>{"".join(layer)}</svg>')

def export(out_dir):
    import os
    os.makedirs(out_dir, exist_ok=True)
    for index, (key, _name, fn) in enumerate(DESIGNS):
        for shape in ('circle', 'square'):
            rnd = random.Random(11 + index)
            defs, front, back = norm(fn(shape, rnd))
            # layer 1 = front, layer 2 = back (matches the preview pages)
            open(os.path.join(out_dir, f'{key}-{shape}-1.svg'), 'w').write(layer_svg(defs, front))
            open(os.path.join(out_dir, f'{key}-{shape}-2.svg'), 'w').write(layer_svg(defs, back))
    print(f'Wrote {len(DESIGNS) * 4} files to {out_dir}')

if __name__ == '__main__':
    import os
    export(os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'public', 'borders'))
