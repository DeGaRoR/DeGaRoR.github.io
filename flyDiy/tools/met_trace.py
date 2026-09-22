#!/usr/bin/env python3
"""met_trace.py - the island's own rasters as a drawing board, in game coordinates.

THE PROBLEM IT SOLVES. Authoring a real place means reading streets off a
satellite picture and writing them as world coordinates. Doing that by eye (as
jolene_author.py had to) costs a round per feature. But the island already ships
a picture that IS in the game frame: bench/jolene/dem.ori.u8, the IFSAR radar
orthoimage at 2.5 m resampled to the 10 m layer grid, which resolves Metlakatla's
street grid. Crop it with a labelled coordinate grid and every street can be read
straight off - no lat/lon, no projection, no 19.32 deg convergence.

    py -3.11 tools/met_trace.py --window -4300 -2300 -9500 -8000 --layer ori
    py -3.11 tools/met_trace.py --window -4300 -2300 -9500 -8000 --layer ori \
        --fixture tools/fixtures/island_jolene.json          # the record ON the raster
    py -3.11 tools/met_trace.py --window ... --photo 3.webp --fit "px,py,x,z; ..."

AND IT IS THE CHECK. --fixture draws the authored record over the same raster:
roads as lines, terrain/zone/surface polygons as outlines, sites and objects as
marks, runways as their boxes. One look says whether a traced street lies on its
street. Every verification screenshot in this chantier comes from here.

LAYERS (bench/jolene/dem.*, the 10 m grid): ori (radar - the streets), albedo
(the baked ground colour), tint (Landsat), ttype (the terrain-type palette),
height, coast (land mask), ndvi, canopy, built (ori with ttype 10 in red).
"""
import argparse, json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BENCH = os.path.join(ROOT, 'bench', 'jolene')
if not os.path.exists(os.path.join(BENCH, 'dem.json')):
    BENCH = 'D:/Dev/DeGaRoR.github.io/flyDiy/bench/jolene'   # a worktree: the main checkout's bake

TT_PAL = {0: (16, 34, 78), 1: (40, 90, 160), 2: (150, 150, 90), 3: (140, 120, 70), 4: (220, 210, 160),
          5: (160, 160, 160), 6: (110, 110, 110), 7: (120, 172, 86), 8: (28, 88, 40), 9: (250, 250, 255),
          10: (228, 60, 60), 11: (200, 190, 170), 15: (170, 220, 90)}
TT_NAME = {0: 'sea', 1: 'lake', 2: 'heath', 3: 'muskeg', 4: 'sand', 5: 'scree', 6: 'rock', 7: 'scrub',
           8: 'forest', 9: 'snow', 10: 'built', 11: 'shingle', 15: 'lush'}


class Grid:
    """The 10 m layer grid, and the window cut out of it."""

    def __init__(self):
        J = json.load(open(os.path.join(BENCH, 'dem.json')))
        self.J = J
        self.W, self.H, self.cell = J['w'], J['h'], J['cell']
        self.x0, self.z0 = J['x0'], J['z0']

    def col(self, x): return int(round((x - self.x0) / self.cell))

    def row(self, z): return int(round((z - self.z0) / self.cell))

    def window(self, x0, x1, z0, z1):
        c0, c1 = max(0, self.col(x0)), min(self.W, self.col(x1))
        r0, r1 = max(0, self.row(z0)), min(self.H, self.row(z1))
        if c1 <= c0 or r1 <= r0:
            sys.exit('met_trace: the window is outside the grid')
        return c0, c1, r0, r1

    def u8(self, name, w):
        c0, c1, r0, r1 = w
        a = np.fromfile(os.path.join(BENCH, 'dem.' + name + '.u8'), dtype=np.uint8)
        return a.reshape(self.H, self.W)[r0:r1, c0:c1]

    def rgb(self, name, w):
        c0, c1, r0, r1 = w
        a = np.fromfile(os.path.join(BENCH, 'dem.' + name + '.rgb'), dtype=np.uint8)
        return a.reshape(self.H, self.W, 3)[r0:r1, c0:c1]

    def f32(self, w):
        c0, c1, r0, r1 = w
        a = np.fromfile(os.path.join(BENCH, 'dem.f32'), dtype=np.float32)
        return a.reshape(self.H, self.W)[r0:r1, c0:c1]


def gray(a):
    return np.dstack([a] * 3)


def layer_image(G, w, layer):
    if layer == 'ori':
        return gray(G.u8('ori', w))
    if layer == 'ndvi':
        return gray(G.u8('ndvi', w))
    if layer == 'coast':
        return gray((G.u8('coast', w) >= 128).astype(np.uint8) * 255)
    if layer == 'canopy':
        return gray(np.clip(G.u8('canopy', w).astype(np.int16) * 8, 0, 255).astype(np.uint8))
    if layer in ('albedo', 'tint'):
        return np.clip(G.rgb(layer, w).astype(np.int16) * 2, 0, 255).astype(np.uint8)
    if layer == 'height':
        h = G.f32(w)
        v = np.clip(h / max(1.0, float(h.max())), 0, 1)
        return (np.dstack([v, v, v]) * 255).astype(np.uint8)
    if layer in ('ttype', 'built'):
        tt = G.u8('ttype', w)
        if layer == 'built':
            img = gray(G.u8('ori', w)).copy()
            img[tt == 10] = TT_PAL[10]
            return img
        img = np.zeros(tt.shape + (3,), np.uint8)
        for k, v in TT_PAL.items():
            img[tt == k] = v
        return img
    sys.exit('met_trace: unknown layer ' + layer)


# ---- the record over the raster ----------------------------------------------
ROAD_COL = (255, 230, 60)
ZONE_COL = {'residential': (120, 200, 255), 'commercial': (255, 170, 80), 'industrial': (200, 140, 255),
            'harbour': (80, 255, 220), 'park': (140, 255, 140), 'airfield': (255, 255, 255),
            'forest': (60, 200, 60), 'clear': (200, 200, 200)}


def draw_record(d, rec, to_px, layers=None):
    L = rec['layers']
    want = (lambda k: True) if not layers else (lambda k: k in layers)

    def poly(pts, col, wid=1, close=True):
        p = [to_px(q[0], q[1]) for q in pts]
        d.line(p + ([p[0]] if close and len(p) > 2 else []), fill=col, width=wid)

    if want('terrain'):
        for t in L.get('terrain', []):
            if t.get('poly'):
                poly(t['poly'], (255, 120, 120))
            elif t.get('pts'):
                poly([[q[0], q[1]] for q in t['pts']], (255, 120, 120), close=False)
    if want('surface'):
        for s in L.get('surface', []):
            poly(s['poly'], (170, 170, 170))
    if want('material'):
        for m in L.get('material', []):
            poly(m['poly'], (120, 120, 200))
    if want('exclude'):
        for e in L.get('exclude', []):
            poly(e['poly'], (90, 90, 90))
    if want('ttype'):
        for c in L.get('ttype', []):
            poly(c['poly'], (170, 255, 90), 2)
    if want('zones'):
        for z in L.get('zones', []):
            col = ZONE_COL.get(z.get('kind'), (255, 255, 255))
            poly(z['poly'], col, 2)
            cx = sum(q[0] for q in z['poly']) / len(z['poly'])
            cz = sum(q[1] for q in z['poly']) / len(z['poly'])
            d.text(to_px(cx, cz), z['id'], fill=col)
    if want('roads'):
        for r in L.get('roads', []):
            poly(r['pts'], ROAD_COL, 2, close=False)
            d.text(to_px(*r['pts'][0]), r['id'], fill=ROAD_COL)
    if want('runways'):
        for r in L.get('runways', []):
            c, hd, ln, wd = r['c'], r['hdg'], r['len'], r['wid']
            dx, dz = math.cos(hd), math.sin(hd)
            nx, nz = dz, -dx
            box = [[c[0] + dx * ln / 2 + nx * wd / 2, c[1] + dz * ln / 2 + nz * wd / 2],
                   [c[0] + dx * ln / 2 - nx * wd / 2, c[1] + dz * ln / 2 - nz * wd / 2],
                   [c[0] - dx * ln / 2 - nx * wd / 2, c[1] - dz * ln / 2 - nz * wd / 2],
                   [c[0] - dx * ln / 2 + nx * wd / 2, c[1] - dz * ln / 2 + nz * wd / 2]]
            poly(box, (255, 255, 255), 2)
            d.text(to_px(*c), r['id'], fill=(255, 255, 255))
    if want('sites'):
        for s in L.get('sites', []):
            a = s['at']
            ca, sa = math.cos(a['yaw']), math.sin(a['yaw'])
            for it in s.get('items', []):
                wx = a['x'] + it['x'] * ca + it['z'] * sa
                wz = a['z'] - it['x'] * sa + it['z'] * ca
                p = to_px(wx, wz)
                d.ellipse([p[0] - 3, p[1] - 3, p[0] + 3, p[1] + 3], outline=(255, 100, 255))
            p = to_px(a['x'], a['z'])
            d.ellipse([p[0] - 5, p[1] - 5, p[0] + 5, p[1] + 5], outline=(255, 60, 255), width=2)
            d.text((p[0] + 7, p[1]), s['id'], fill=(255, 60, 255))
    if want('objects'):
        for o in L.get('objects', []):
            p = to_px(o['x'], o['z'])
            d.ellipse([p[0] - 2, p[1] - 2, p[0] + 2, p[1] + 2], outline=(255, 255, 0))


# ---- fitting one of the user's screenshots onto the frame --------------------
def fit_similarity(pairs):
    """[(px, py, x, z), ...] -> a similarity (rotation+scale+translation) px -> game,
    least squares. Needs >= 2 pairs; reports the residual so a bad pick shows."""
    if len(pairs) < 2:
        sys.exit('met_trace: --fit needs at least two px,py,x,z pairs')
    P = np.array([[p[0], p[1]] for p in pairs], float)
    Q = np.array([[p[2], p[3]] for p in pairs], float)
    pm, qm = P.mean(0), Q.mean(0)
    A, B = P - pm, Q - qm
    # the complex-number trick: one scale and one rotation, in closed form
    a = (A[:, 0] + 1j * A[:, 1])
    b = (B[:, 0] + 1j * B[:, 1])
    s = (np.vdot(a, b) / np.vdot(a, a))
    M = np.array([[s.real, -s.imag], [s.imag, s.real]])
    t = qm - M @ pm
    res = np.hypot(*(np.array([M @ p + t for p in P]) - Q).T)
    return M, t, float(res.max()), float(res.mean())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--window', nargs=4, type=float, metavar=('X0', 'X1', 'Z0', 'Z1'), required=True)
    ap.add_argument('--layer', default='ori')
    ap.add_argument('--scale', type=float, default=0, help='output pixels per grid cell (default: fit ~1200 px)')
    ap.add_argument('--grid', type=float, default=0, help='coordinate grid spacing in metres (default: auto)')
    ap.add_argument('--fixture', default=None)
    ap.add_argument('--only', default=None, help='comma-separated layers of the record to draw')
    ap.add_argument('--photo', default=None, help='a satellite screenshot to register onto the frame')
    ap.add_argument('--fit', default=None, help='"px,py,x,z; px,py,x,z; ..." control points for --photo')
    ap.add_argument('--affine', default=None, help="met_fit.py's json for --photo, instead of --fit")
    ap.add_argument('--alpha', type=float, default=0.5, help='the photo weight in the blend')
    ap.add_argument('--coast', action='store_true', help="draw the island's own waterline over it - the registration check")
    ap.add_argument('--out', default=None)
    a = ap.parse_args()

    x0, x1, z0, z1 = a.window
    G = Grid()
    w = G.window(x0, x1, z0, z1)
    c0, c1, r0, r1 = w
    # the window the grid actually gave us, so the pixel maths is exact
    gx0, gx1 = G.x0 + c0 * G.cell, G.x0 + c1 * G.cell
    gz0, gz1 = G.z0 + r0 * G.cell, G.z0 + r1 * G.cell
    img = layer_image(G, w, a.layer)
    scale = a.scale if a.scale > 0 else max(1.0, round(1200.0 / img.shape[1]))
    im = Image.fromarray(img).resize((int(img.shape[1] * scale), int(img.shape[0] * scale)), Image.LANCZOS)
    mpp = (gx1 - gx0) / im.width                              # metres per output pixel

    if a.photo:
        if a.affine and not a.fit:
            a.fit = json.load(open(a.affine))['fit']
        if not a.fit:
            sys.exit('met_trace: --photo needs --fit or --affine')
        pairs = []
        for chunk in a.fit.split(';'):
            q = [float(v) for v in chunk.replace(',', ' ').split()]
            if len(q) != 4:
                sys.exit('met_trace: --fit wants px,py,x,z quadruples')
            pairs.append(tuple(q))
        M, t, worst, mean = fit_similarity(pairs)
        print('fit: %d points, residual mean %.1f m worst %.1f m, %.3f m per photo px, rotation %.2f deg'
              % (len(pairs), mean, worst, math.hypot(M[0, 0], M[1, 0]), math.degrees(math.atan2(M[1, 0], M[0, 0]))))
        ph = Image.open(a.photo).convert('RGB')
        # PIL's AFFINE maps OUTPUT pixels back to INPUT pixels: output px -> game -> photo px
        Mi = np.linalg.inv(M)
        ti = -Mi @ t
        A = Mi @ np.array([[mpp, 0.0], [0.0, mpp]])
        b = Mi @ np.array([gx0, gz0]) + ti
        warped = ph.transform(im.size, Image.AFFINE, (A[0, 0], A[0, 1], b[0], A[1, 0], A[1, 1], b[1]), Image.BICUBIC)
        im = Image.blend(im, warped, max(0.0, min(1.0, a.alpha)))

    d = ImageDraw.Draw(im)

    def to_px(x, z):
        return ((x - gx0) / mpp, (z - gz0) / mpp)

    if a.coast:
        # THE REGISTRATION CHECK: the island's own waterline, drawn on whatever is
        # underneath. A photo that is registered has its beach on this line.
        land = G.u8('coast', w) >= 128
        e = land[:-1, :-1] ^ land[1:, :-1]
        f = land[:-1, :-1] ^ land[:-1, 1:]
        edge = np.argwhere(e | f)
        for j, i in edge:
            px, pz = ((gx0 + (i + 1) * G.cell) - gx0) / mpp, ((gz0 + (j + 1) * G.cell) - gz0) / mpp
            d.ellipse([px - 1, pz - 1, px + 1, pz + 1], fill=(0, 255, 255))

    if a.fixture:
        rec = json.load(open(a.fixture))
        rec = rec.get('premises', rec)
        draw_record(d, rec, to_px, a.only.split(',') if a.only else None)

    step = a.grid if a.grid > 0 else max(50.0, round((gx1 - gx0) / 10 / 100) * 100)
    x = math.ceil(gx0 / step) * step
    while x <= gx1:
        px = (x - gx0) / mpp
        d.line([(px, 0), (px, im.height)], fill=(255, 80, 0))
        d.text((px + 2, 2), str(int(x)), fill=(255, 170, 0))
        x += step
    z = math.ceil(gz0 / step) * step
    while z <= gz1:
        pz = (z - gz0) / mpp
        d.line([(0, pz), (im.width, pz)], fill=(255, 80, 0))
        d.text((2, pz + 2), str(int(z)), fill=(255, 170, 0))
        z += step
    d.text((im.width - 250, im.height - 14),
           '%s  x %d..%d  z %d..%d  %.2f m/px' % (a.layer, gx0, gx1, gz0, gz1, mpp), fill=(255, 170, 0))

    out = a.out or os.path.join(ROOT, 'screenshots', 'met_%s_%d_%d.png' % (a.layer, int(gx0), int(gz0)))
    if os.path.dirname(out):
        os.makedirs(os.path.dirname(out), exist_ok=True)
    im.save(out)
    print('wrote', out, im.size)


if __name__ == '__main__':
    main()
