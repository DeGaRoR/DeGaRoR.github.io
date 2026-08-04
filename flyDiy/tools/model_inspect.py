#!/usr/bin/env python3
"""model_inspect.py — per-object inventory of an OBJ + hinge-line probe.

The measuring half of the model import procedure (docs/MODEL-IMPORT-PROC.md):
Step 1 uses the inventory to sort objects into bake buckets, Step 2 reads the
wheel-mesh centers, Step 4 reads the --edge probe for hinge points.

Usage:
  python tools/model_inspect.py <model.obj>                    inventory
  python tools/model_inspect.py <model.obj> --edge <object> [--span z|y] [--bands N]

Inventory: one row per 'o' object — full name | short name | material |
unique verts (by face reference) | faces | bbox lo..hi | center | size —
plus per-material totals (interior bake groups select by material because
short() collapses e.g. needle.002/needle across different gauges).

--edge probe: split the object's verts into N bands along the span axis
(default z), report per band the forward-edge x (min x: model nose is -x),
the mid-thickness y at that edge, and a suggested hinge point p=(x,y,0).
Warns if the forward edge rakes more than 5 mm across bands.
"""
import sys


def short(name):        # 'voletG_voletG.mesh' -> 'voletG'
    return name.split('_')[0].split('.')[0]


def parse(path):
    V, objs, order = [], {}, []
    cur = None
    for line in open(path):
        t = line.split()
        if not t:
            continue
        if t[0] == 'o':
            cur = t[1]
            if cur not in objs:
                objs[cur] = {'mat': set(), 'verts': set(), 'faces': 0}
                order.append(cur)
        elif t[0] == 'usemtl' and cur:
            objs[cur]['mat'].add(t[1])
        elif t[0] == 'v':
            V.append(tuple(float(x) for x in t[1:4]))
        elif t[0] == 'f' and cur:
            o = objs[cur]
            o['faces'] += 1
            for w in t[1:]:
                o['verts'].add(int(w.split('/')[0]) - 1)
    return V, objs, order


def bbox(V, ids):
    lo = [min(V[i][a] for i in ids) for a in range(3)]
    hi = [max(V[i][a] for i in ids) for a in range(3)]
    return lo, hi


def inventory(V, objs, order):
    print(f'{"object":34} {"short":12} {"material":28} {"verts":>6} {"faces":>6}  bbox lo..hi (x y z) | center | size')
    mats = {}
    for name in order:
        o = objs[name]
        if not o['verts']:
            continue
        lo, hi = bbox(V, o['verts'])
        ctr = [(a + b) / 2 for a, b in zip(lo, hi)]
        siz = [b - a for a, b in zip(lo, hi)]
        mat = ','.join(sorted(o['mat'])) or '-'
        print(f'{name:34} {short(name):12} {mat:28} {len(o["verts"]):>6} {o["faces"]:>6}  '
              f'[{lo[0]:7.3f} {lo[1]:7.3f} {lo[2]:7.3f}]..[{hi[0]:7.3f} {hi[1]:7.3f} {hi[2]:7.3f}] | '
              f'[{ctr[0]:7.3f} {ctr[1]:7.3f} {ctr[2]:7.3f}] | [{siz[0]:.3f} {siz[1]:.3f} {siz[2]:.3f}]')
        m = mats.setdefault(mat, [0, 0, 0])
        m[0] += 1; m[1] += len(o['verts']); m[2] += o['faces']
    print('\nper-material totals:')
    for mat, (n, nv, nf) in sorted(mats.items()):
        print(f'  {mat:28} {n:3} objects {nv:>6} verts {nf:>6} faces')


def edge_probe(V, objs, target, span_ax, bands):
    axi = {'x': 0, 'y': 1, 'z': 2}[span_ax]
    ids = set()
    for name, o in objs.items():
        if name == target or short(name) == target:
            ids |= o['verts']
    if not ids:
        sys.exit(f'no object named "{target}"')
    lo, hi = bbox(V, ids)
    depth = hi[0] - lo[0]                       # chord extent along x
    tol = max(0.10 * depth, 0.005)
    s0, s1 = lo[axi], hi[axi]
    print(f'{target}: {len(ids)} verts, bbox x {lo[0]:.4f}..{hi[0]:.4f}  y {lo[1]:.4f}..{hi[1]:.4f}  z {lo[2]:.4f}..{hi[2]:.4f}')
    print(f'edge probe along {span_ax}, {bands} bands, edge tolerance {tol*1000:.0f} mm:')
    exs, mids, spans = [], [], []
    for b in range(bands):
        b0 = s0 + (s1 - s0) * b / bands
        b1 = s0 + (s1 - s0) * (b + 1) / bands
        bv = [V[i] for i in ids if b0 <= V[i][axi] <= b1]
        if not bv:
            print(f'  band {span_ax} {b0:7.3f}..{b1:7.3f}: empty')
            continue
        ex = min(p[0] for p in bv)              # forward edge: min x (nose is -x)
        ys = [p[1] for p in bv if p[0] <= ex + tol]
        mid = (min(ys) + max(ys)) / 2
        exs.append(ex); mids.append(mid)
        # third coordinate of the edge point: for a spanwise (z) probe the band
        # centre; for a vertical (y) probe `mid` already IS the y, so z ~ 0
        spans.append((b0 + b1) / 2 if span_ax == 'z' else 0.0)
        print(f'  band {span_ax} {b0:7.3f}..{b1:7.3f}: fwd-edge x {ex:8.4f}  y {min(ys):7.4f}..{max(ys):7.4f}  mid y {mid:7.4f}')
    px = sum(exs) / len(exs)
    py = sum(mids) / len(mids)
    print(f'suggested hinge p = ({px:.3f}, {py:.3f}, 0)  axis = span direction')
    rake = max(exs) - min(exs)
    if rake > 0.005:
        print(f'WARNING: forward edge rakes {rake*1000:.1f} mm across bands — hinge line may not be axis-aligned')
    fit_line(list(zip(exs, mids, spans)), rake)


def fit_line(pts, rake):
    """Least-squares 3D line through the per-band forward-edge points: the
    hinge line a swept and/or dihedral surface actually turns about. Prints a
    (p, ax) pair usable verbatim as a SURFACES row — the payload's Rodrigues
    hinge takes an arbitrary unit axis, so a raked rudder or a wing with
    dihedral needs no approximation."""
    if len(pts) < 2:
        return
    n = len(pts)
    c = [sum(p[a] for p in pts) / n for a in range(3)]
    # principal direction via one power iteration on the covariance (well
    # conditioned here: the points are collinear by construction)
    d = [pts[-1][a] - pts[0][a] for a in range(3)]
    for _ in range(8):
        acc = [0.0, 0.0, 0.0]
        for p in pts:
            v = [p[a] - c[a] for a in range(3)]
            s = sum(v[a] * d[a] for a in range(3))
            for a in range(3):
                acc[a] += s * v[a]
        m = sum(x * x for x in acc) ** 0.5
        if m < 1e-12:
            return
        d = [x / m for x in acc]
    if d[2] < 0 or (abs(d[2]) < 1e-9 and d[1] < 0):
        d = [-x for x in d]                 # canonical: +z (or +y) leading
    res = 0.0
    for p in pts:
        v = [p[a] - c[a] for a in range(3)]
        s = sum(v[a] * d[a] for a in range(3))
        res = max(res, sum((v[a] - s * d[a]) ** 2 for a in range(3)) ** 0.5)
    print(f'fitted hinge  p = ({c[0]:.3f}, {c[1]:.3f}, {c[2]:.3f})  '
          f'ax = ({d[0]:.4f}, {d[1]:.4f}, {d[2]:.4f})   max residual {res*1000:.1f} mm')


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    V, objs, order = parse(args[0])
    if '--edge' in args:
        target = args[args.index('--edge') + 1]
        span = args[args.index('--span') + 1] if '--span' in args else 'z'
        bands = int(args[args.index('--bands') + 1]) if '--bands' in args else 6
        edge_probe(V, objs, target, span, bands)
    else:
        inventory(V, objs, order)


if __name__ == '__main__':
    main()
