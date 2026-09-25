"""met_axes — the lines a HUMAN drew on a trace picture, read back as game coordinates.

    py -3.11 tools/met_axes.py --image <png> --gx0 -4200 --gz0 -9200 [--step 200]

`met_trace.py` draws the island's own rasters with a labelled game-coordinate grid.
Draw on that picture in any paint program and this reads the drawing back: the grid
lines give the calibration (they are the only strong ORANGE in the frame), the
strokes are the only strong RED, and what comes out is a list of polylines in game
metres, ready to paste into an author's table.

WHY IT EXISTS. The street grid was measured by a vote (`met_streets.py`), and a vote
over a rotated regular grid answers with a rotated regular grid: 73 straight segments
on two bearings, geometrically right and visibly wrong, because the real town's
arterials curve round the hill and along the shore and cut the blocks at their own
angles. The user's answer was to draw those axes in red over the trace, which is a
better instrument than any detector - so this turns the drawing into a record rather
than into an eye-balled table of numbers.

THE METHOD, in four steps and no cleverness:
  1. the ORANGE grid lines -> the pixel positions of the 200 m ticks -> the scale and
     the origin (one number each way, checked against both axes and printed);
  2. the RED mask, closed, and thinned to one pixel by Zhang-Suen;
  3. the thinned mask as a GRAPH: a pixel's neighbours are its 8-neighbours, a node is
     any pixel of degree != 2, and a BRANCH is the run between two nodes. A network of
     hand-drawn strokes crosses itself, and a single longest-path walk through it
     doubles back and returns one 3 km line that is really nine roads;
  4. each branch resampled, smoothed and converted. Branches under `--min` metres are
     dropped (a stub at a crossing is not a road).

The strokes are drawn thick - eight to ten pixels, which is twelve metres here - so
the thinned line sits within a few metres of what was meant; the smoothing pass is
what takes out the thinning's stair, not what invents the shape.
"""
import argparse
import math
import sys

import numpy as np
from PIL import Image
from scipy import ndimage


# ---------------------------------------------------------------------------
def grid_lines(R, G, B):
    """The picture's own 200 m grid: the columns and rows of strong orange, as a
    fitted LATTICE rather than as whatever peaks survived a threshold.

    The grid is drawn over a satellite view and half of it is buried under roofs,
    labels and the record's own lines, so the column sums are wildly uneven: one
    threshold found four of eight columns and three of six rows, and the mean gap
    between THOSE came out at exactly half the real scale - a calibration that is
    wrong by a factor of two and looks perfectly reasonable. So the peaks are only
    candidates; the period and the phase are fitted to all of them at once, and the
    lattice is what is returned."""
    org = (R > 140) & (G > 55) & (G < 160) & (B < 100) & ((R - G) > 50)

    def cand(v):
        thr = max(30.0, v.max() * 0.18)
        out, i = [], 0
        while i < len(v):
            if v[i] > thr:
                j = i
                while j < len(v) and v[j] > thr:
                    j += 1
                if j - i <= 6:                      # a grid line is thin; a red stroke is not
                    w = np.arange(i, j)
                    out.append(float((w * v[i:j]).sum() / v[i:j].sum()))
                i = j
            else:
                i += 1
        return out

    def lattice(pk, n):
        if len(pk) < 2:
            return pk
        best = None
        gaps = sorted(pk[i + 1] - pk[i] for i in range(len(pk) - 1))
        for g in gaps:                              # every observed gap is a candidate period
            if g < 20:
                continue
            for ph in pk:
                score = sum(1 for q in pk if abs(((q - ph) / g) - round((q - ph) / g)) * g < 2.5)
                if best is None or score > best[0]:
                    best = (score, g, ph)
        score, g, ph = best
        k0 = math.ceil((0 - ph) / g)
        k1 = math.floor((n - 1 - ph) / g)
        return [ph + k * g for k in range(k0, k1 + 1)]

    cx, cy = cand(org.sum(0)), cand(org.sum(1))
    return lattice(cx, org.shape[1]), lattice(cy, org.shape[0])


def convex_hull(P):
    P = sorted(set(P))
    if len(P) < 3:
        return None
    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo = []
    for q in P:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], q) <= 0:
            lo.pop()
        lo.append(q)
    up = []
    for q in reversed(P):
        while len(up) >= 2 and cross(up[-2], up[-1], q) <= 0:
            up.pop()
        up.append(q)
    H = lo[:-1] + up[:-1]
    return H if len(H) >= 3 else None


def thin(m):
    """Zhang-Suen, to one pixel. Twenty lines and no dependency."""
    m = m.astype(np.uint8).copy()
    # P2..P9 clockwise from the north. np.roll(a, -dy, 0)[y, x] is a[y + dy, x],
    # so the shifts are NEGATED offsets - with the sign the other way the ring runs
    # backwards, c1/c2 test the wrong triples and the thinning does nothing at all
    # (8931 red pixels came back as 8931, and every one of them was a graph node).
    def nb(a):
        return [np.roll(np.roll(a, -dy, 0), -dx, 1) for dy, dx in
                ((-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1), (-1, -1))]
    while True:
        changed = False
        for step in (0, 1):
            P = nb(m)
            B_ = sum(P)
            # the 0->1 transitions round the ring
            A = sum(((P[i] == 0) & (P[(i + 1) % 8] == 1)).astype(np.uint8) for i in range(8))
            if step == 0:
                c1 = (P[0] * P[2] * P[4]) == 0
                c2 = (P[2] * P[4] * P[6]) == 0
            else:
                c1 = (P[0] * P[2] * P[6]) == 0
                c2 = (P[0] * P[4] * P[6]) == 0
            kill = (m == 1) & (B_ >= 2) & (B_ <= 6) & (A == 1) & c1 & c2
            if kill.any():
                m[kill] = 0
                changed = True
        if not changed:
            return m.astype(bool)


def branches(m):
    """The thinned mask as a graph; every run between two nodes, as a pixel list."""
    ys, xs = np.nonzero(m)
    pix = set(zip(ys.tolist(), xs.tolist()))
    N8 = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    nbrs = {p: [(p[0] + dy, p[1] + dx) for dy, dx in N8 if (p[0] + dy, p[1] + dx) in pix] for p in pix}
    # THE STAIRCASE IS NOT A JUNCTION. A one-pixel 8-connected diagonal run has THREE
    # neighbours at every step - the pixel beside it and the two diagonals - so a
    # plain degree test called 1108 staircase pixels junctions and returned 2470
    # two-pixel 'branches' for nine drawn lines. A diagonal edge whose two ends share
    # a 4-neighbour is redundant with that pair and is dropped; what is left is the
    # path, and only a real fork keeps a degree over two.
    for p in pix:
        keep = []
        for q in nbrs[p]:
            dy, dx = q[0] - p[0], q[1] - p[1]
            if dy and dx and (((p[0] + dy, p[1]) in pix) or ((p[0], p[1] + dx) in pix)):
                continue
            keep.append(q)
        nbrs[p] = keep
    for p in pix:                                   # an edge survives only if BOTH ends kept it
        nbrs[p] = [q for q in nbrs[p] if p in nbrs[q]]
    nodes = {p for p in pix if len(nbrs[p]) != 2}
    out, seen = [], set()
    for a in nodes:
        for b in nbrs[a]:
            if (a, b) in seen:
                continue
            run, prev, cur = [a], a, b
            while True:
                run.append(cur)
                seen.add((prev, cur))
                seen.add((cur, prev))
                if cur in nodes:
                    break
                nxt = [q for q in nbrs[cur] if q != prev]
                if not nxt:
                    break
                prev, cur = cur, nxt[0]
            out.append(run)
    if not nodes and pix:                       # one closed loop and no end at all
        out.append(list(pix))
    return out


def prune(m, minlen=10, rounds=8):
    """Shave the skeleton's hairs.

    Zhang-Suen on a hand-drawn, anti-aliased, WebP-compressed stroke grows a spur at
    every bump on its edge: 1225 skeleton pixels came out as 494 branches, which is a
    hedge, not a network. A spur is a run from a LEAF (one neighbour) to the first
    junction; shorter than `minlen` pixels it is an artefact of the edge and not a
    line anybody drew. Shaving makes new leaves, so it repeats."""
    m = m.copy()
    for _ in range(rounds):
        cut = []
        for run in branches(m):
            a, b = run[0], run[-1]
            da, db = _deg(m, a), _deg(m, b)
            if len(run) <= minlen and (da == 1) != (db == 1):
                cut += run[:-1] if da == 1 else run[1:]
        if not cut:
            break
        for y, x in cut:
            m[y, x] = False
    return m


def _deg(m, p):
    y, x = p
    h, w = m.shape
    return sum(1 for dy in (-1, 0, 1) for dx in (-1, 0, 1)
               if (dy or dx) and 0 <= y + dy < h and 0 <= x + dx < w and m[y + dy, x + dx])


def join(polys, turn):
    """Carry a stroke THROUGH a junction it merely crosses.

    A graph gives branches, and a person draws roads: the long hill road came back
    as four pieces because three other lines happen to meet it. At each junction the
    branch ends are paired by their tangents - the pair that turns least, under
    `turn` degrees, is one road going through - and the rest stay separate. This is
    the same rule an eye uses and it needs no names for anything."""
    ends = {}
    for i, g in enumerate(polys):
        ends.setdefault(g[0], []).append((i, 0))
        ends.setdefault(g[-1], []).append((i, 1))
    link = {}
    for pt_, lst in ends.items():
        if len(lst) < 2:
            continue
        def tang(i, side):
            g = polys[i]
            a, b = (g[0], g[min(3, len(g) - 1)]) if side == 0 else (g[-1], g[max(-4, -len(g))])
            d = (b[0] - a[0], b[1] - a[1])
            L = math.hypot(*d) or 1.0
            return (d[0] / L, d[1] / L)
        best = None
        for a in range(len(lst)):
            for b in range(a + 1, len(lst)):
                ta, tb = tang(*lst[a]), tang(*lst[b])
                ang = math.degrees(math.acos(max(-1.0, min(1.0, ta[0] * tb[0] + ta[1] * tb[1]))))
                if ang < turn and (best is None or ang < best[0]):
                    best = (ang, lst[a], lst[b])
        if best:
            link[best[1]] = best[2]
            link[best[2]] = best[1]
    used, out = set(), []
    for i in range(len(polys)):
        if i in used:
            continue
        chain, side = list(polys[i]), 1
        used.add(i)
        for side in (1, 0):                         # forwards, then backwards
            cur = (i, side)
            while cur in link:
                j, js = link[cur]
                if j in used:
                    break
                used.add(j)
                g = list(polys[j]) if js == 0 else list(polys[j])[::-1]
                chain = chain + g[1:] if side == 1 else g[:-1] + chain
                cur = (j, 1 - js)
        out.append(chain)
    return out


def resample(run, every, rounds):
    pts = [run[i] for i in range(0, len(run), max(1, every))]
    if pts[-1] != run[-1]:
        pts.append(run[-1])
    pts = [(float(y), float(x)) for y, x in pts]
    for _ in range(rounds):
        if len(pts) < 3:
            break
        pts = ([pts[0]]
               + [((pts[i - 1][0] + 2 * pts[i][0] + pts[i + 1][0]) / 4,
                   (pts[i - 1][1] + 2 * pts[i][1] + pts[i + 1][1]) / 4) for i in range(1, len(pts) - 1)]
               + [pts[-1]])
    return pts


# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--image', required=True)
    ap.add_argument('--gx0', type=float, default=0.0, help='game x of the LEFTMOST grid line')
    ap.add_argument('--gz0', type=float, default=0.0, help='game z of the TOPMOST grid line')
    ap.add_argument('--step', type=float, default=200.0, help='metres between grid lines')
    ap.add_argument('--min', type=float, default=60.0, help='drop a branch under this many metres')
    ap.add_argument('--every', type=int, default=9, help='resample the thinned run every N pixels')
    ap.add_argument('--smooth', type=int, default=4, help='3-tap passes over the resampled run')
    ap.add_argument('--blob', type=int, default=200, help='drop a red blob under this many pixels')
    ap.add_argument('--spur', type=int, default=12, help='shave a skeleton spur under this many pixels')
    ap.add_argument('--pixels', action='store_true',
                    help='no grid: emit 0..1 picture coordinates instead of game metres')
    ap.add_argument('--colour', default='red', choices=['red', 'green', 'blue'],
                    help='which pen to read (a picture may carry three instructions at once)')
    ap.add_argument('--shape', default='lines', choices=['lines', 'region', 'marks', 'hulls'],
                    help='lines: open polylines; region: the outline of a closed loop; marks: a point per blob; '
                         'hulls: the convex hull of each blob (a SCRIBBLE means an area, not a line)')
    ap.add_argument('--turn', type=float, default=55.0, help='carry a stroke through a junction it turns less than this to cross')
    ap.add_argument('--name', default='MK_AX', help='the emitted table s name')
    A = ap.parse_args()

    a = np.asarray(Image.open(A.image).convert('RGB')).astype(int)
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    # --pixels: a GAME SCREENSHOT has no grid to calibrate against, so the strokes
    # come out in the picture's own pixels, normalised to 0..1 across and down, and
    # somebody else turns them into world coordinates (tools/met_unproject.js casts
    # them through the camera that took the shot and lands them on the terrain).
    if A.pixels:
        cols, rows = [0.0, 1.0], [0.0, 1.0]
        sx = sz = 1.0
    else:
        cols, rows = grid_lines(R, G, B)
        if len(cols) < 2 or len(rows) < 2:
            sys.exit('met_axes: fewer than two grid lines found - is this a met_trace picture?')
    if not A.pixels:
        sx = float(A.step / np.diff(cols).mean())
        sz = float(A.step / np.diff(rows).mean())
    if A.pixels:
        print('# picture %d x %d, coordinates normalised 0..1' % (R.shape[1], R.shape[0]))
    else:
        print('# grid: %d columns, %d rows; %.4f m/px across, %.4f down (%.2f %% apart)'
              % (len(cols), len(rows), sx, sz, abs(sx - sz) / sx * 100))
    c0, r0 = float(cols[0]), float(rows[0])
    H, W = R.shape
    gx = (lambda px: float(px) / (W - 1.0)) if A.pixels else (lambda px: A.gx0 + (float(px) - c0) * sx)
    gz = (lambda py: float(py) / (H - 1.0)) if A.pixels else (lambda py: A.gz0 + (float(py) - r0) * sz)

    # THREE PENS, ONE PICTURE. The user's second pass carried three instructions at
    # once - a red region to clear, a green road to add, blue ticks on what to
    # delete - so the pen is an argument and the shape it means is another.
    PENS = {'red':   (R > 150) & (G < 95) & (B < 95) & ((R - G) > 80) & ((R - B) > 80),
            'green': (G > 120) & ((G - R) > 60) & ((G - B) > 60),
            'blue':  (B > 120) & ((B - R) > 50) & ((B - G) > 40)}
    red = PENS[A.colour]
    red = ndimage.binary_closing(red, np.ones((5, 5)))
    lab, n = ndimage.label(red, np.ones((3, 3)))
    blobs = ndimage.sum(red, lab, range(1, n + 1)) if n else np.zeros(0)
    if n:
        red = np.isin(lab, [i + 1 for i, v in enumerate(blobs) if v >= A.blob])
    print('# %s: %d pixels in %d blob(s) over %d px' % (A.colour, red.sum(), int((blobs >= A.blob).sum()), A.blob))

    if A.shape == 'hulls':
        # A SCRIBBLE IS AN AREA. The user's green marks are loops and zigzags over
        # the ground they mean, not lines to follow: thinned to centrelines they are
        # nonsense, and their convex hulls are exactly the patches pointed at.
        lab4, n4 = ndimage.label(red, np.ones((3, 3)))
        print('%s = [' % A.name)
        for k in range(1, n4 + 1):
            ys, xs = np.nonzero(lab4 == k)
            if len(ys) < A.blob:
                continue
            HULL = convex_hull(list(zip(xs.tolist(), ys.tolist())))
            if not HULL:
                continue
            g = [(round(gx(x), 5 if A.pixels else 1), round(gz(y), 5 if A.pixels else 1)) for x, y in HULL]
            print('    [' + ', '.join('(%g, %g)' % q for q in g) + '],   # %d px' % len(ys))
        print(']')
        return

    if A.shape == 'marks':
        # A TICK IS A PLACE, NOT A LINE. "delete the one I crossed in blue" means the
        # thing under the mark; what comes out is the mark's middle and its reach.
        lab2, n2 = ndimage.label(red, np.ones((3, 3)))
        print('%s = [' % A.name)
        for k in range(1, n2 + 1):
            ys, xs = np.nonzero(lab2 == k)
            if len(ys) < 12:
                continue
            r = max(4.0, max(xs.max() - xs.min(), ys.max() - ys.min()) / 2.0) * sx
            print('    (%g, %g, %g),   # %d px' % (round(gx(xs.mean()), 1), round(gz(ys.mean()), 1), round(r, 1), len(ys)))
        print(']')
        return

    sk = prune(thin(red), A.spur)
    runs = branches(sk)

    if A.shape == 'region':
        # A CLOSED LOOP HAS NO END, so the graph has no node in it and `branches`
        # would hand back an unordered heap of pixels. One pixel is cut out, the
        # rest is walked as an open run, and the ends are joined again.
        lab3, n3 = ndimage.label(sk, np.ones((3, 3)))
        print('%s = [' % A.name)
        for k in range(1, n3 + 1):
            m = lab3 == k
            if m.sum() < 60:
                continue
            ys, xs = np.nonzero(m)
            m2 = m.copy()
            m2[ys[0], xs[0]] = False
            runs2 = [r for r in branches(m2) if len(r) > m.sum() * 0.5]
            if not runs2:
                continue
            pts = resample(max(runs2, key=len), A.every, A.smooth)
            g = [(round(gx(x), 1), round(gz(y), 1)) for y, x in pts]
            ar = abs(sum(g[i][0] * g[(i + 1) % len(g)][1] - g[(i + 1) % len(g)][0] * g[i][1]
                         for i in range(len(g)))) / 2
            print('    # %.1f ha, %d points' % (ar / 10000, len(g)))
            print('    [' + ', '.join('(%g, %g)' % q for q in g) + '],')
        print(']')
        return

    out = []
    for run in runs:
        pts = resample(run, A.every, A.smooth)
        g = [(round(gx(x), 1), round(gz(y), 1)) for y, x in pts]
        L = sum(math.dist(g[i - 1], g[i]) for i in range(1, len(g)))
        if L < A.min or len(g) < 2:
            continue
        out.append((L, g))
    out = [(sum(math.dist(g[i - 1], g[i]) for i in range(1, len(g))), g)
           for g in join([g for _, g in out], A.turn)]
    out.sort(key=lambda r: -r[0])
    print('# %d axes over %.0f m (%d branches, the rest under %.0f m)'
          % (len(out), sum(r[0] for r in out), len(runs), A.min))
    print('%s = [' % A.name)
    for i, (L, g) in enumerate(out):
        print('    # %d: %s, %d points' % (i, ('%.3f u' % L) if A.pixels else ('%.0f m' % L), len(g)))
        print('    [' + ', '.join('(%g, %g)' % q for q in g) + '],')
    print(']')


if __name__ == '__main__':
    main()
