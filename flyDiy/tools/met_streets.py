#!/usr/bin/env python3
"""met_streets.py - pull a gridded town's streets off a REGISTERED satellite view
as polylines in the game frame.

Metlakatla is a surveyor's town: two families of parallel streets, one running
grid bearing 43 deg (the numbered avenues, along the shore) and one 133 deg (the
named cross streets), avenues about 46 m apart and cross streets 46-100 m. That
regularity is what makes this possible without a road detector worth the name:

  1  the view is warped into the game frame by met_fit.py's affine;
  2  a road-likeness image is made - bright, grey, not green, not water (roofs
     and yards score too, which is why step 3 is a VOTE and not a threshold);
  3  every pixel votes on the perpendicular offset of the line it lies on, per
     family; a street is a peak in that histogram, and a roof is not;
  4  each peak is walked end to end along its own direction and cut where the
     road-likeness dies, so a line becomes a segment with real ends.

It prints and writes the segments; the author keeps the NUMBERS, because the
views themselves are Google's and are not in the repo.

    py -3.11 tools/met_streets.py --affine fit3.json --photo 3.webp \
        --window -4000 -3100 -9060 -8560 --out streets.json
"""
import argparse, json, math, os, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))

AVENUE_DEG = 133.0        # atan2(z, x) of the avenues, measured over the whole town
CROSS_DEG = 43.0          # and of the cross streets


def road_likeness(warp, ok, lo=0.32, span=0.28, green=0.045):
    g = warp.mean(2)
    grn = warp[..., 1] - (warp[..., 0] + warp[..., 2]) / 2
    water = (warp[..., 2] - warp[..., 1]) > 0.073
    return np.clip((g - lo) / span, 0, 1) * np.clip((green - grn) / 0.05, 0, 1) * (~water) * ok


def peaks(hist, centres, mind, frac):
    from scipy.ndimage import gaussian_filter1d
    hs = gaussian_filter1d(hist, 2.0)
    b = hs.copy()
    thr = frac * hs.max()
    out = []
    while True:
        k = int(np.argmax(b))
        if b[k] < thr:
            break
        out.append((float(centres[k]), float(hs[k])))
        b[max(0, k - int(mind)):k + int(mind)] = -1
    out.sort()
    return out


def walk(R, X0, Z0, res, cx, cz, dx, dz, band, step, thr, gap, centre=None, reach=None):
    """Follow a line and return its longest run of road, in metres along it.

    The line is given by the foot of its perpendicular from the ORIGIN, which for
    a town 9 km from the frame's origin is several kilometres away: walking a
    fixed +-3 km either side of that foot never reaches the window at all (it
    returned nothing at all until this was fixed). So the walk is centred on the
    window's own centre projected onto the line."""
    nz, nx = R.shape

    def score(x, z):
        s = 0.0
        n = 0
        for o in np.arange(-band, band + 0.01, res):
            i = int((x - dz * o - X0) / res)
            j = int((z + dx * o - Z0) / res)
            if 0 <= i < nx and 0 <= j < nz:
                s = max(s, float(R[j, i]))
                n += 1
        return s if n else 0.0

    if centre is not None:
        t0 = dx * (centre[0] - cx) + dz * (centre[1] - cz)
    else:
        t0 = 0.0
    L = reach if reach else 3000.0
    ts = np.arange(t0 - L, t0 + L, step)
    v = np.array([score(cx + dx * t, cz + dz * t) for t in ts])
    on = v > thr
    best = None
    i = 0
    while i < len(on):
        if not on[i]:
            i += 1
            continue
        j = i
        miss = 0
        k = i
        while k < len(on):
            if on[k]:
                j = k
                miss = 0
            else:
                miss += 1
                if miss * step > gap:
                    break
            k += 1
        if best is None or (j - i) > (best[1] - best[0]):
            best = (i, j)
        i = k
    if not best or (best[1] - best[0]) * step < 40:
        return None
    return ts[best[0]], ts[best[1]]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--affine', required=True)
    ap.add_argument('--photo', required=True)
    ap.add_argument('--window', nargs=4, type=float, required=True)
    ap.add_argument('--res', type=float, default=0.5)
    ap.add_argument('--mind', type=float, default=40.0, help='closest two streets of one family may be, metres')
    ap.add_argument('--frac', type=float, default=0.45, help='a peak must reach this share of the strongest')
    ap.add_argument('--band', type=float, default=3.5, help='half width sampled across a street')
    ap.add_argument('--thr', type=float, default=0.30)
    ap.add_argument('--gap', type=float, default=45.0, help='a break this long does not end a street')
    ap.add_argument('--out', default=None)
    ap.add_argument('--png', default=None)
    a = ap.parse_args()

    import met_fit as MF
    fit = json.load(open(a.affine))
    X0, X1, Z0, Z1 = a.window
    warp, ok = MF.warp_photo(a.photo, fit['m'], fit['t'], X0, X1, Z0, Z1, a.res)
    R = road_likeness(warp, ok)
    nz, nx = R.shape
    GX, GZ = np.meshgrid(X0 + (np.arange(nx) + 0.5) * a.res, Z0 + (np.arange(nz) + 0.5) * a.res)
    w = R.ravel()
    X, Z = GX.ravel(), GZ.ravel()
    sel = w > 0.02
    w, X, Z = w[sel], X[sel], Z[sel]

    segs = []
    for deg, tag in ((AVENUE_DEG, 'A'), (CROSS_DEG, 'C')):
        A = math.radians(deg)
        dx, dz = math.cos(A), math.sin(A)
        nxx, nzz = -dz, dx
        p = nxx * X + nzz * Z
        lo, hi = p.min(), p.max()
        h, e = np.histogram(p, bins=int(hi - lo) + 1, range=(lo, hi), weights=w)
        for i, (q, strength) in enumerate(peaks(h, (e[:-1] + e[1:]) / 2, a.mind, a.frac)):
            cx, cz = nxx * q, nzz * q
            r = walk(R, X0, Z0, a.res, cx, cz, dx, dz, a.band, 2.0, a.thr, a.gap,
                     centre=((X0 + X1) / 2, (Z0 + Z1) / 2), reach=math.hypot(X1 - X0, Z1 - Z0) * 0.6)
            if not r:
                continue
            t0, t1 = r
            segs.append({'id': '%s%d' % (tag, i), 'family': tag, 'deg': deg, 'offset': round(q, 1),
                         'strength': round(strength, 4),
                         'pts': [[round(cx + dx * t0, 1), round(cz + dz * t0, 1)],
                                 [round(cx + dx * t1, 1), round(cz + dz * t1, 1)]],
                         'len': round(t1 - t0, 1)})
    segs.sort(key=lambda s: (s['family'], s['offset']))
    for s in segs:
        print('%-4s off %9.1f  len %6.1f  (%8.1f, %9.1f) -> (%8.1f, %9.1f)'
              % (s['id'], s['offset'], s['len'], s['pts'][0][0], s['pts'][0][1], s['pts'][1][0], s['pts'][1][1]))
    print('%d streets' % len(segs))
    if a.out:
        json.dump({'window': a.window, 'photo': os.path.basename(a.photo), 'streets': segs}, open(a.out, 'w'), indent=1)
        print('wrote', a.out)
    if a.png:
        from PIL import Image, ImageDraw
        im = Image.fromarray((np.clip(warp, 0, 1) * 255).astype(np.uint8))
        d = ImageDraw.Draw(im)
        px = lambda x, z: ((x - X0) / a.res, (z - Z0) / a.res)
        for s in segs:
            col = (255, 60, 60) if s['family'] == 'A' else (60, 220, 255)
            d.line([px(*s['pts'][0]), px(*s['pts'][1])], fill=col, width=2)
            d.text(px(*s['pts'][0]), s['id'], fill=col)
        for x in range(int(math.ceil(X0 / 100) * 100), int(X1) + 1, 100):
            d.line([px(x, Z0), px(x, Z1)], fill=(255, 170, 0))
            d.text((px(x, Z0)[0] + 2, 2), str(x), fill=(255, 190, 0))
        for z in range(int(math.ceil(Z0 / 100) * 100), int(Z1) + 1, 100):
            d.line([px(X0, z), px(X1, z)], fill=(255, 170, 0))
            d.text((2, px(X0, z)[1] + 2), str(z), fill=(255, 190, 0))
        im.save(a.png)
        print('wrote', a.png)


if __name__ == '__main__':
    main()
