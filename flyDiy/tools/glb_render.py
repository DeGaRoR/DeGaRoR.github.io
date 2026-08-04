#!/usr/bin/env python3
"""glb_render.py — silhouette contact sheets + shaded views, for eyeballing
a model import without a browser.

Sketchfab exports arrive with mangled object names ("Plane.002_1"), so the
model-import Step 1 inventory cannot be sorted by name. The contact sheet
renders each node-primitive highlighted red against the whole-model
silhouette in three orthographic views, so parts can be identified by eye and
named in the extract table (tools/models/<key>_src.py PARTS).

Takes a .glb OR the .obj that glb_extract.py produced — same views either way,
so what was extracted is directly comparable with what was delivered.

Usage:
  python tools/glb_render.py <model.glb|obj> [--out DIR] [--cols 6] [--tile 200]
                             [--only 4,6,8] [--views] [--shade]

  --views  only the three whole-model views, large (no contact sheet)
  --shade  flat-shaded renders from three directions, coloured per material
           from the .mtl — the "did the import actually work" picture

Views are taken in the source's own axes: for a GLB, side (z right, y up),
top (z right, x up), front (x right, y up); for an OBJ they are remapped to
the model frame (x aft, y up, z left) so both show the aircraft the same way.
"""
import math, os, sys
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from glb_inspect import load, accessor, walk, xform

VIEWS = [('side', 2, 1, -1, 1), ('top', 2, 0, -1, 1), ('front', 0, 1, 1, 1)]


def collect(j, bin_):
    """[(node_idx, prim_idx, material, [ (p0,p1,p2), ... ] world-space)]"""
    out = []
    for idx, n, w, path in walk(j):
        if 'mesh' not in n:
            continue
        for pi, prim in enumerate(j['meshes'][n['mesh']]['primitives']):
            pos = [xform(w, p) for p in accessor(j, bin_, prim['attributes']['POSITION'])]
            ids = accessor(j, bin_, prim['indices']) if 'indices' in prim else list(range(len(pos)))
            tris = [(pos[ids[i]], pos[ids[i + 1]], pos[ids[i + 2]]) for i in range(0, len(ids) - 2, 3)]
            mat = j['materials'][prim['material']]['name'] if 'material' in prim else '-'
            out.append((idx, pi, mat, tris))
    return out


def collect_obj(path):
    """Same shape as collect(), for an OBJ (so extracted output can be checked
    against the source with identical views). Object index = order in file."""
    V, out, cur = [], [], None
    mat = '-'
    for line in open(path):
        t = line.split()
        if not t:
            continue
        if t[0] == 'o':
            cur = [len(out), 0, mat, []]
            out.append(cur)
            cur[2] = mat
        elif t[0] == 'usemtl':
            mat = t[1]
            if cur:
                cur[2] = mat
        elif t[0] == 'v':
            V.append(tuple(float(x) for x in t[1:4]))
        elif t[0] == 'f' and cur:
            vi = [int(w.split('/')[0]) - 1 for w in t[1:]]
            for k in range(1, len(vi) - 1):
                cur[3].append((V[vi[0]], V[vi[k]], V[vi[k + 1]]))
    return [tuple(p) for p in out]


def bounds(parts):
    lo = [1e9] * 3; hi = [-1e9] * 3
    for _, _, _, tris in parts:
        for t in tris:
            for p in t:
                for a in range(3):
                    lo[a] = min(lo[a], p[a]); hi[a] = max(hi[a], p[a])
    return lo, hi


def projector(lo, hi, view, size, pad=0.04):
    _, ha, va, hs, vs = view
    w = max(hi[ha] - lo[ha], hi[va] - lo[va]) * (1 + 2 * pad)
    cx = (lo[ha] + hi[ha]) / 2; cy = (lo[va] + hi[va]) / 2
    k = size / w

    def f(p):
        return (size / 2 + (p[ha] - cx) * hs * k,
                size / 2 - (p[va] - cy) * vs * k)
    return f


def draw(parts, view, lo, hi, size, sel=None, ctx=(214, 214, 214), hi_col=(214, 32, 32)):
    img = Image.new('RGB', (size, size), 'white')
    d = ImageDraw.Draw(img)
    f = projector(lo, hi, view, size)
    for idx, pi, mat, tris in parts:
        if sel is not None and (idx, pi) == sel:
            continue
        for t in tris:
            d.polygon([f(p) for p in t], fill=ctx)
    if sel is not None:
        for idx, pi, mat, tris in parts:
            if (idx, pi) != sel:
                continue
            for t in tris:
                d.polygon([f(p) for p in t], fill=hi_col)
    return img


def read_mtl(path):
    """{material: (r,g,b)} from an MTL's Kd lines."""
    cols, cur = {}, None
    try:
        for line in open(path):
            t = line.split()
            if not t:
                continue
            if t[0] == 'newmtl':
                cur = t[1]
            elif t[0] == 'Kd' and cur:
                cols[cur] = tuple(min(255, int(255 * float(v) ** 0.4545)) for v in t[1:4])
    except OSError:
        pass
    return cols


def shaded(parts, size, cols, elev=22.0, azim=38.0, light=(0.4, 0.8, 0.45)):
    """Painter's-algorithm shaded render from an arbitrary direction.

    Not a beauty pass — a verification pass: it shows which parts made it
    through the extract, in their bake materials, with enough shading to read
    the shape. Depth sort is per triangle (fine for a convex-ish airframe)."""
    ce, se = math.cos(math.radians(elev)), math.sin(math.radians(elev))
    ca, sa = math.cos(math.radians(azim)), math.sin(math.radians(azim))
    # camera basis over the model frame (x aft, y up, z left)
    right = (-sa, 0.0, ca)
    up = (-ca * se, ce, -sa * se)
    fwd = (ca * ce, se, sa * ce)          # toward the camera
    dot = lambda a, b: a[0]*b[0] + a[1]*b[1] + a[2]*b[2]
    lm = math.sqrt(sum(c*c for c in light)) or 1
    L = tuple(c / lm for c in light)

    tris = []
    lo = [1e9]*3; hi = [-1e9]*3
    for _, _, mat, ts in parts:
        for t in ts:
            for p in t:
                for a in range(3):
                    lo[a] = min(lo[a], p[a]); hi[a] = max(hi[a], p[a])
    ctr = [(lo[a]+hi[a])/2 for a in range(3)]
    ext = max(hi[a]-lo[a] for a in range(3)) * 1.08
    k = size / ext
    proj = lambda p: (size/2 + dot([p[a]-ctr[a] for a in range(3)], right) * k,
                      size/2 - dot([p[a]-ctr[a] for a in range(3)], up) * k)
    for _, _, mat, ts in parts:
        base = cols.get(mat, (170, 170, 170))
        for t in ts:
            u = [t[1][a]-t[0][a] for a in range(3)]
            v = [t[2][a]-t[0][a] for a in range(3)]
            n = (u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0])
            nl = math.sqrt(sum(c*c for c in n))
            if nl < 1e-12:
                continue
            n = tuple(c/nl for c in n)
            if dot(n, fwd) < 0:
                n = tuple(-c for c in n)          # meshes are double-sided
            sh = 0.34 + 0.66 * max(0.0, dot(n, L))
            depth = sum(dot([p[a]-ctr[a] for a in range(3)], fwd) for p in t) / 3
            tris.append((depth, [proj(p) for p in t],
                         tuple(min(255, int(c*sh)) for c in base)))
    tris.sort(key=lambda r: r[0])
    img = Image.new('RGB', (size, size), (250, 250, 250))
    d = ImageDraw.Draw(img)
    for _, pts, col in tris:
        d.polygon(pts, fill=col)
    return img


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    path = args[0]
    out = args[args.index('--out') + 1] if '--out' in args else 'tools/_glbview'
    tile = int(args[args.index('--tile') + 1]) if '--tile' in args else 200
    cols = int(args[args.index('--cols') + 1]) if '--cols' in args else 6
    only = set(int(v) for v in args[args.index('--only') + 1].split(',')) if '--only' in args else None
    os.makedirs(out, exist_ok=True)

    if path.lower().endswith('.obj'):
        parts = collect_obj(path)          # model frame: side/top/front remap
        global VIEWS
        VIEWS = [('side', 0, 1, 1, 1), ('top', 0, 2, 1, 1), ('front', 2, 1, -1, 1)]
    else:
        j, bin_ = load(path)
        parts = collect(j, bin_)
    lo, hi = bounds(parts)
    print(f'{len(parts)} prims, bbox {[round(v,3) for v in lo]}..{[round(v,3) for v in hi]}')

    for v in VIEWS:
        img = draw(parts, v, lo, hi, 900)
        img.save(os.path.join(out, f'_all_{v[0]}.png'))
        print(f'{out}/_all_{v[0]}.png')
    if '--shade' in args:
        cols = read_mtl(path.rsplit('.', 1)[0] + '.mtl') if path.lower().endswith('.obj') else {}
        for nm, el, az in [('iso', 20, 40), ('iso2', 14, 145), ('nose', 8, 8)]:
            f = os.path.join(out, f'_shade_{nm}.png')
            shaded(parts, 1000, cols, el, az).save(f)
            print(f)
    if '--views' in args or '--shade' in args:
        return

    sel = [p for p in parts if only is None or p[0] in only]
    # pre-render the grey context per view once; highlight is drawn on a copy
    ctxs = [(v, draw(parts, v, lo, hi, tile)) for v in VIEWS]
    cw, ch = tile * 3, tile + 16
    rows = (len(sel) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cw, rows * ch), 'white')
    sd = ImageDraw.Draw(sheet)
    for i, (idx, pi, mat, tris) in enumerate(sel):
        r, c = divmod(i, cols)
        for k, (v, base) in enumerate(ctxs):
            img = base.copy()
            d = ImageDraw.Draw(img)
            f = projector(lo, hi, v, tile)
            for t in tris:
                d.polygon([f(p) for p in t], fill=(214, 32, 32))
            sheet.paste(img, (c * cw + k * tile, r * ch + 16))
        sd.text((c * cw + 3, r * ch + 3), f'node {idx}.{pi}  {mat}  {len(tris)}t', fill='black')
        sd.line([(c * cw, r * ch), (c * cw + cw, r * ch)], fill=(160, 160, 160))
    p = os.path.join(out, 'sheet.png')
    sheet.save(p)
    print(f'{p}  ({len(sel)} tiles, {cols} cols; views: side | top | front)')


if __name__ == '__main__':
    main()
