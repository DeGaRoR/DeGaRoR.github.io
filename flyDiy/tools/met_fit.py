#!/usr/bin/env python3
"""met_fit.py - register a north-up satellite screenshot onto the island's frame,
by its COASTLINE, without picking a single control point by hand.

WHY NOT BY HAND. Reading two or three landmarks off a Google view and off a 10 m
radar raster puts the rotation wrong by ten degrees: over a kilometre of town
that is a hundred metres of error, and every street traced from it is wrong. The
coastline is the one feature both pictures agree on and there are kilometres of
it, so fit to that instead.

THE ONE THING WE KNOW FOR FREE is the rotation. A Google view is north-up (TRUE
north), and the game's grid north leans 19.32 deg east of true on Jolene
(src/core/28_island.js ISLAND_GEO, and 06_solar.js turns the sun by it). So the
photo's +x is true east, which in the game frame is (cos 19.32, -sin 19.32), and
the photo's +y is true south = (sin 19.32, cos 19.32). Only the SCALE (metres per
photo pixel) and the TRANSLATION are unknown - and the translation falls out of
one FFT cross-correlation per scale.

AND THE ROTATION IS PINNED, not searched (--rotsteps 1, the default). Let free,
the coastline fit here peaks at 15-16 deg with a very flat maximum - Metlakatla's
coast is one long convex arc and it hardly constrains an angle - and the town
then lands 30-50 m off at both ends. Pinned at the convergence, both ends sit on
the radar's own returns. The frame's number wins over the picture's: it is
measured, and test_day.js holds it. --rotsteps > 1 is for a view the user
actually rotated.

    py -3.11 tools/met_fit.py <photo> --window -5400 -1600 -10800 -7400
    py -3.11 tools/met_fit.py <photo> --window ... --scan 0.3 2.5 --check out.png

It prints the affine (photo px -> game x, z) and, with --check, writes a blend of
the warped photo over the island's own albedo so the fit can be SEEN, not
trusted. --json writes it for met_trace.py --affine.
"""
import argparse, json, math, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BENCH = os.path.join(ROOT, 'bench', 'jolene')
if not os.path.exists(os.path.join(BENCH, 'dem.json')):
    BENCH = 'D:/Dev/DeGaRoR.github.io/flyDiy/bench/jolene'

CONVERGENCE_DEG = 19.32          # grid north is this far EAST of true north at Jolene
CG = 4.0                         # the working grid, metres per cell


def dem_land(x0, x1, z0, z1):
    """The island's land mask over a window, resampled to the CG working grid."""
    J = json.load(open(os.path.join(BENCH, 'dem.json')))
    W, H, cell, gx0, gz0 = J['w'], J['h'], J['cell'], J['x0'], J['z0']
    coast = np.fromfile(os.path.join(BENCH, 'dem.coast.u8'), dtype=np.uint8).reshape(H, W)
    nx, nz = int((x1 - x0) / CG), int((z1 - z0) / CG)
    xs = x0 + (np.arange(nx) + 0.5) * CG
    zs = z0 + (np.arange(nz) + 0.5) * CG
    ci = np.clip(((xs - gx0) / cell).astype(int), 0, W - 1)
    rj = np.clip(((zs - gz0) / cell).astype(int), 0, H - 1)
    return (coast[np.ix_(rj, ci)] >= 128).astype(np.float32)


def photo_water(path, shrink=4, thr=None):
    """Water in a Google satellite view, measured rather than guessed: the one
    channel difference that separates it is BLUE MINUS GREEN - open sea reads
    0.12-0.13 on these views and every land cover (forest 0.01-0.03, roofs 0.03,
    road 0.03, grass 0.02) reads under 0.04. A darkness rule had put shadowed
    forest in the water. Otsu over b-g picks the threshold when none is given.
    Returned as a LAND mask (1 = land) at 1/shrink of the photo's resolution."""
    im = Image.open(path).convert('RGB')
    im = im.resize((max(1, im.width // shrink), max(1, im.height // shrink)), Image.BILINEAR)
    a = np.asarray(im).astype(np.float32) / 255.0
    d = a[..., 2] - a[..., 1]
    if thr is None:
        h, e = np.histogram(d, 128, (-0.1, 0.3))
        c = h.cumsum().astype(np.float64)
        m = (h * ((e[:-1] + e[1:]) / 2)).cumsum()
        tot, mt = c[-1], m[-1]
        with np.errstate(invalid='ignore', divide='ignore'):
            var = (mt * c / tot - m) ** 2 / np.maximum(1e-9, c * (tot - c))
        thr = float(((e[:-1] + e[1:]) / 2)[int(np.nanargmax(var))])
        thr = min(0.09, max(0.045, thr))
    return (~(d > thr)).astype(np.float32), im, thr


def warp_photo(path, M, t, x0, x1, z0, z1, res):
    """A registered photo resampled into the GAME frame - the drawing board, and
    the reference a second photo is fitted against."""
    from scipy.ndimage import map_coordinates
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(np.float32) / 255.0
    nx, nz = int((x1 - x0) / res), int((z1 - z0) / res)
    gx = x0 + (np.arange(nx) + 0.5) * res
    gz = z0 + (np.arange(nz) + 0.5) * res
    GX, GZ = np.meshgrid(gx, gz)
    Mi = np.linalg.inv(np.asarray(M))
    dx, dz = GX - t[0], GZ - t[1]
    px = Mi[0, 0] * dx + Mi[0, 1] * dz
    py = Mi[1, 0] * dx + Mi[1, 1] * dz
    ok = (px >= 0) & (px < im.width - 1) & (py >= 0) & (py < im.height - 1)
    out = np.zeros((nz, nx, 3), np.float32)
    for c in range(3):
        out[..., c] = map_coordinates(a[..., c], [np.clip(py, 0, im.height - 2), np.clip(px, 0, im.width - 2)],
                                      order=1, mode='nearest')
    out[~ok] = 0
    return out, ok


def high_pass(g, sigma=6.0):
    """What two satellite views of the same ground agree on is their STRUCTURE,
    not their exposure: a Gaussian high pass throws the tint away and leaves the
    streets, the roofs and the shoreline to correlate."""
    from scipy.ndimage import gaussian_filter
    h = g - gaussian_filter(g, sigma)
    n = h.std()
    return h / n if n > 1e-6 else h


def rot_cells(s_cell, theta_deg):
    """The photo -> game matrix in CELLS, in (row=z, col=x) order for ndimage."""
    A = math.radians(theta_deg)
    M = s_cell * np.array([[math.cos(A), math.sin(A)], [-math.sin(A), math.cos(A)]])   # (x, z) <- (px, py)
    return M, np.array([[M[1, 0], M[1, 1]], [M[0, 0], M[0, 1]]])                        # (z, x) <- (px, py)


def warp_to_grid(mask, s_cell, theta_deg):
    """Photo mask -> a game-ORIENTED raster at CG metres per cell, with no
    translation but shifted so nothing falls off: returns (P, minx, minz) in
    cells, where P[j, i] is the photo at game cell (minx + i, minz + j)."""
    from scipy.ndimage import affine_transform
    _, Mrc = rot_cells(s_cell, theta_deg)
    h, w = mask.shape
    corners = np.array([[0, 0], [w, 0], [0, h], [w, h]], float)          # (px, py)
    g = np.array([Mrc @ c for c in corners])                              # (z, x)
    minz, minx = g[:, 0].min(), g[:, 1].min()
    maxz, maxx = g[:, 0].max(), g[:, 1].max()
    ny, nx = int(math.ceil(maxz - minz)) + 1, int(math.ceil(maxx - minx)) + 1
    if ny < 4 or nx < 4 or ny > 6000 or nx > 6000:
        return None, 0, 0
    # affine_transform: out[j, i] = in[ Inv . (j + minz, i + minx) ]
    Inv = np.linalg.inv(np.array([[Mrc[0, 1], Mrc[0, 0]], [Mrc[1, 1], Mrc[1, 0]]]))   # (py, px) <- (z, x)
    off = Inv @ np.array([minz, minx])
    P = affine_transform(mask, Inv, offset=off, output_shape=(ny, nx), order=1, mode='constant', cval=0.0)
    return P, minx, minz


def best_shift(P, D):
    """The translation lining P up with D, by one FFT cross-correlation. Both are
    mean-centred so sheer overlap area cannot win on its own."""
    from scipy.signal import fftconvolve
    p = P - P.mean()
    d = D - D.mean()
    c = fftconvolve(d, p[::-1, ::-1], mode='full')
    j, i = np.unravel_index(int(np.argmax(c)), c.shape)
    n = math.sqrt(max(1e-9, float((p * p).sum()) * float((d * d).sum())))
    return (j - (P.shape[0] - 1), i - (P.shape[1] - 1)), float(c[j, i] / n)


def search(land, D, scales, rots, shrink):
    best = None
    for s_px in scales:
        s_cell = s_px * shrink / CG
        for th in rots:
            P, minx, minz = warp_to_grid(land, s_cell, th)
            if P is None or P.sum() < 10:
                continue
            (dj, di), score = best_shift(P, D)
            if best is None or score > best[0]:
                best = (score, float(s_px), float(th), dj - minz, di - minx)
    return best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('photo')
    ap.add_argument('--window', nargs=4, type=float, metavar=('X0', 'X1', 'Z0', 'Z1'), required=True)
    ap.add_argument('--scan', nargs=2, type=float, default=(0.3, 3.0), help='metres per photo pixel, low high')
    ap.add_argument('--steps', type=int, default=40)
    ap.add_argument('--rot', type=float, default=2.0, help='degrees searched either side of the convergence')
    ap.add_argument('--rotsteps', type=int, default=1, help='1 (the default) PINS the rotation at the convergence')
    ap.add_argument('--shrink', type=int, default=4)
    ap.add_argument('--thr', type=float, default=None, help='the blue-minus-green water threshold (default: Otsu)')
    ap.add_argument('--mask', default=None, help='write the photo land mask, to see what was called water')
    ap.add_argument('--check', default=None, help='write a blend of the fit over the island albedo')
    ap.add_argument('--json', default=None, help='write the affine as json')
    ap.add_argument('--ref', default=None, help='an affine json of an ALREADY registered photo to fit against (for close views with no coastline)')
    ap.add_argument('--refphoto', default=None, help='where that photo actually is')
    a = ap.parse_args()

    x0, x1, z0, z1 = a.window
    if a.ref:
        # A close view of the town centre has no coastline to fit to. Fit it
        # against a photo that IS registered: same projection, same rotation, so
        # only the scale and the offset are open - and the streets correlate.
        R = json.load(open(a.ref))
        ref_photo = a.refphoto or os.path.join(os.path.dirname(os.path.abspath(a.ref)), R['photo'])
        if not os.path.exists(ref_photo):
            sys.exit('met_fit: --ref names %s, which is not beside the json - pass --refphoto' % R['photo'])
        W, ok = warp_photo(ref_photo, R['m'], R['t'], x0, x1, z0, z1, CG)
        D = high_pass(W.mean(2)) * ok
        im0 = Image.open(a.photo).convert('L')
        im0 = im0.resize((max(1, im0.width // a.shrink), max(1, im0.height // a.shrink)), Image.BILINEAR)
        land = high_pass(np.asarray(im0).astype(np.float32) / 255.0)
        print('photo %s -> %dx%d, fitted against %s over %dx%d cells at %g m'
              % (os.path.basename(a.photo), im0.width, im0.height, R['photo'], D.shape[1], D.shape[0], CG))
    else:
        D = dem_land(x0, x1, z0, z1)
        land, small, thr = photo_water(a.photo, a.shrink, a.thr)
        print('photo %s -> %dx%d, land %.1f %% (blue-green over %.3f); window %dx%d cells at %g m'
              % (os.path.basename(a.photo), small.width, small.height, 100 * land.mean(), thr, D.shape[1], D.shape[0], CG))
        if a.mask:
            Image.fromarray((land * 255).astype(np.uint8)).save(a.mask)
            print('wrote', a.mask)

    rots = [CONVERGENCE_DEG] if a.rotsteps <= 1 else list(np.linspace(CONVERGENCE_DEG - a.rot, CONVERGENCE_DEG + a.rot, a.rotsteps))
    best = search(land, D, np.geomspace(a.scan[0], a.scan[1], a.steps), rots, a.shrink)
    if not best:
        sys.exit('met_fit: nothing fitted - widen --scan or the window')
    # a second, fine pass around the coarse winner (and at full rotation resolution)
    s0 = best[1]
    fine_rots = rots if a.rotsteps <= 1 else list(np.linspace(CONVERGENCE_DEG - a.rot, CONVERGENCE_DEG + a.rot, max(9, a.rotsteps)))
    fine = search(land, D, np.linspace(s0 * 0.90, s0 * 1.10, 21), fine_rots, a.shrink)
    if fine and fine[0] >= best[0]:
        best = fine
    score, s_px, th, cz, cx = best
    M, _ = rot_cells(s_px, th)                       # metres per photo px
    t = np.array([x0 + cx * CG, z0 + cz * CG])
    print('BEST  %.4f m per photo px, rotation %.2f deg, %s score %.4f' % (s_px, th, 'reference' if a.ref else 'coastline', score))
    print('      game_x = %+.6f*px %+.6f*py %+.2f' % (M[0, 0], M[0, 1], t[0]))
    print('      game_z = %+.6f*px %+.6f*py %+.2f' % (M[1, 0], M[1, 1], t[1]))
    im = Image.open(a.photo)
    pairs = []
    for name, (px, py) in [('top-left', (0, 0)), ('top-right', (im.width, 0)),
                           ('bottom-left', (0, im.height)), ('bottom-right', (im.width, im.height))]:
        g = M @ np.array([px, py]) + t
        print('      %-12s px %5d,%5d -> x %8.1f z %9.1f' % (name, px, py, g[0], g[1]))
        pairs.append('%d,%d,%.1f,%.1f' % (px, py, g[0], g[1]))
    if a.json:
        json.dump({'photo': os.path.basename(a.photo), 'm': M.tolist(), 't': t.tolist(),
                   'scale': s_px, 'rotation': th, 'score': score,
                   'fit': '; '.join(pairs[:3])}, open(a.json, 'w'), indent=1)
        print('wrote', a.json)
    if a.check:
        import subprocess
        subprocess.run(['py', '-3.11', os.path.join(ROOT, 'tools', 'met_trace.py'),
                        '--window', str(x0), str(x1), str(z0), str(z1), '--layer', 'albedo',
                        '--photo', a.photo, '--fit', '; '.join(pairs[:3]), '--alpha', '0.55',
                        '--out', a.check], check=False)


if __name__ == '__main__':
    main()
