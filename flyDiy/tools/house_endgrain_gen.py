#!/usr/bin/env python3
"""house_endgrain_gen.py — THE END OF A LOG, generated (G273, the user: "be
careful to use proper textures for the end of the logs").

No scanned library on hand has one: a log end is a disc of rings, and a ring
scan tiled onto a disc would put the pith anywhere but the middle. So this
draws it. ONE TILE IS NINE LOG ENDS - a 3 x 3 grid of 417 mm cells, each with
its own pith, its own ring spacing, its own checks and its own colour - and
the generator maps every round's cap with the pith on the cell's centre
(`logEndUV` in _house_gen.js) and picks a cell by a hash of the log, so a
stack of forty rounds shows nine different ends and never a seam.

What is in a cell, from the middle out: the pith, dark; growth rings as an
asymmetric sawtooth (pale earlywood, a thin darker latewood band) on a
spacing that wanders ring by ring and is never quite round; radial DRYING
CHECKS - four to seven cracks from near the pith that fade out before the
bark, the widest one a real groove; a greyed rim where the weather got to the
sapwood; and a thin bark ring at the very edge for the rounds cut oversize.
The normal map is the height (latewood proud, checks sunk); the roughness is
high everywhere and higher in the checks.

Writes assets/house/endgrain/{diff,nor_gl,rough}_{512,256}.jpg in the
library's own contract and adds the key to assets/house/_sizes.json, so
`node tools/house_tex_prep.js` bakes it like any scan. Deterministic.

Usage: python tools/house_endgrain_gen.py
"""
import io, json, math, os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'assets', 'house', 'endgrain')
PX = 512
CELLS = 3
TILE_M = 1.25                      # metres per repeat: a cell is 417 mm


def fbm(shape, rng, octaves=5, base=4):
    """value noise, tiling, in [0, 1]"""
    h, w = shape
    acc = np.zeros(shape, dtype=np.float64)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        n = base * (2 ** o)
        g = rng.random((n, n))
        # bilinear upsample, periodic
        ys = (np.arange(h) / h) * n
        xs = (np.arange(w) / w) * n
        y0 = np.floor(ys).astype(int) % n; y1 = (y0 + 1) % n; fy = (ys - np.floor(ys))[:, None]
        x0 = np.floor(xs).astype(int) % n; x1 = (x0 + 1) % n; fx = (xs - np.floor(xs))[None, :]
        fy = fy * fy * (3 - 2 * fy); fx = fx * fx * (3 - 2 * fx)
        v = (g[y0][:, x0] * (1 - fy) * (1 - fx) + g[y0][:, x1] * (1 - fy) * fx +
             g[y1][:, x0] * fy * (1 - fx) + g[y1][:, x1] * fy * fx)
        acc += v * amp
        tot += amp
        amp *= 0.5
    return acc / tot


def cell(px, rng):
    """one log end: returns (rgb float HxWx3, height float, rough float)"""
    ys, xs = np.mgrid[0:px, 0:px]
    cx = px * (0.5 + (rng.random() - 0.5) * 0.10)
    cy = px * (0.5 + (rng.random() - 0.5) * 0.10)
    dx, dy = xs - cx, ys - cy
    ang = np.arctan2(dy, dx)
    # never quite round: the radius is stretched along one axis and wobbles
    e = 1.0 + (rng.random() - 0.5) * 0.18
    rot = rng.random() * math.pi
    ca, sa = math.cos(rot), math.sin(rot)
    rx = (dx * ca + dy * sa) / e
    ry = (-dx * sa + dy * ca) * e
    rad = np.sqrt(rx * rx + ry * ry)
    wob = fbm((px, px), rng, octaves=4, base=3)
    rad = rad * (1.0 + (wob - 0.5) * 0.26)
    R = px * 0.5                     # the cell's own radius (the bark line)
    t = rad / R                      # 0 at the pith, 1 at the bark

    # THE RINGS: spacing that wanders. Integrate a per-ring spacing table so
    # ring k sits at s[k]; a sawtooth across each ring, latewood the last 30 %
    n_rings = int(14 + rng.random() * 12)
    sp = np.cumsum(0.6 + rng.random(n_rings + 4) * 0.8)
    sp = sp / sp[n_rings - 1]        # bark at t = 1
    idx = np.searchsorted(sp, t)      # which ring each pixel is in
    lo = np.where(idx > 0, sp[np.clip(idx - 1, 0, len(sp) - 1)], 0.0)
    hi = sp[np.clip(idx, 0, len(sp) - 1)]
    f = np.clip((t - lo) / np.maximum(hi - lo, 1e-6), 0, 1)
    late = np.clip((f - 0.45) / 0.45, 0, 1) ** 1.6     # 0 earlywood -> 1 latewood
    late = late * (1 - np.clip((f - 0.93) / 0.07, 0, 1))
    # fibre: streaks that run out from the pith - noise read in polar
    # coordinates, fine round the ring and coarse along the radius
    fib = fbm((px, px), rng, octaves=4, base=20)
    pu = ((ang / (2 * math.pi)) % 1.0 * (px - 1)).astype(int)
    pv = (np.clip(t, 0, 1.2) / 1.2 * (px - 1)).astype(int)
    fibr = fib[pv, pu]

    # colour: pale sapwood outside, warmer heartwood in, grey where weathered
    heart = 1 - np.clip((t - 0.55) / 0.25, 0, 1)
    grey = np.clip((t - 0.30) / 0.60, 0, 1) * (0.5 + rng.random() * 0.5)
    base_c = np.array([0.80, 0.68, 0.48])
    heart_c = np.array([0.66, 0.48, 0.30])
    col = base_c[None, None, :] * (1 - heart[..., None]) + heart_c[None, None, :] * heart[..., None]
    col = col * (1 - late[..., None] * 0.38)                  # latewood darker
    col = col * (0.86 + fibr[..., None] * 0.22)
    col = col * (0.86 + (fbm((px, px), rng, octaves=4, base=6)[..., None] - 0.5) * 0.36)
    # the dirt: a season outdoors leaves a log end blotched grey-brown
    dirt = np.clip((fbm((px, px), rng, octaves=4, base=4) - 0.42) * 2.2, 0, 1) * (0.3 + rng.random() * 0.5)
    dirt_c = np.array([0.36, 0.32, 0.27])
    col = col * (1 - dirt[..., None] * 0.6) + dirt_c[None, None, :] * dirt[..., None] * 0.6
    grey_c = np.array([0.55, 0.53, 0.50])
    col = col * (1 - grey[..., None] * 0.55) + grey_c[None, None, :] * grey[..., None] * 0.55
    # the pith
    pith = np.exp(-(rad / (px * 0.018)) ** 2)
    col = col * (1 - pith[..., None] * 0.6)

    height = 0.5 + late * 0.22 - pith * 0.3

    # DRYING CHECKS: radial cracks, from near the pith, fading before the bark
    n_ck = int(4 + rng.random() * 4)
    a0 = rng.random() * 2 * math.pi
    crack = np.zeros((px, px))
    for k in range(n_ck):
        a = a0 + 2 * math.pi * k / n_ck + (rng.random() - 0.5) * 0.9
        reach = 0.45 + rng.random() * 0.45          # how far out it runs
        width = (0.006 + rng.random() * 0.010) * (1.6 if k == 0 else 1.0)
        # signed angular distance, in metres of arc
        da = np.angle(np.exp(1j * (ang - a)))
        arc = np.abs(da) * np.maximum(rad, 1.0) / px
        # a crack is widest in the middle of its run and tapers both ways
        along = np.clip(t / reach, 0, 1)
        taper = np.sin(np.clip(along, 0, 1) * math.pi) ** 0.6
        wig = (fbm((px, px), rng, octaves=3, base=8) - 0.5) * 0.010
        w = width * taper
        c = np.clip(1 - (arc + wig) / np.maximum(w, 1e-6), 0, 1)
        c = np.where((t < reach) & (t > 0.04), c, 0)
        crack = np.maximum(crack, c)
    col = col * (1 - crack[..., None] * 0.75)
    height = height - crack * 0.6

    # the bark ring at the rim, and outside the disc: bark all the way
    bark = np.clip((t - 0.965) / 0.035, 0, 1)
    bark_c = np.array([0.24, 0.18, 0.13]) * (0.8 + fbm((px, px), rng, octaves=3, base=12)[..., None] * 0.5)
    col = col * (1 - bark[..., None]) + bark_c * bark[..., None]
    height = height * (1 - bark) + (0.35 + fbm((px, px), rng, octaves=3, base=10) * 0.4) * bark
    outside = np.clip((t - 1.0) / 0.02, 0, 1)
    col = col * (1 - outside[..., None]) + bark_c * outside[..., None]

    rough = 0.82 + late * 0.05 + crack * 0.12 + bark * 0.08 - pith * 0.05
    return np.clip(col, 0, 1), np.clip(height, 0, 1), np.clip(rough, 0, 1)


def normal_from_height(h, strength):
    hy = np.roll(h, -1, 0) - np.roll(h, 1, 0)
    hx = np.roll(h, -1, 1) - np.roll(h, 1, 1)
    nx = -hx * strength
    ny = -hy * strength            # GL convention: +y is up in the image? see below
    nz = np.ones_like(h)
    l = np.sqrt(nx * nx + ny * ny + nz * nz)
    n = np.stack([nx / l, -ny / l, nz / l], -1)   # image rows go DOWN; OpenGL's green points UP
    return (n * 0.5 + 0.5)


def main():
    rng = np.random.default_rng(20260912)
    cpx = PX // CELLS
    # 512 / 3 is not whole: draw at 171 and crop the tile to 512
    big = cpx + 1
    rgb = np.zeros((big * CELLS, big * CELLS, 3))
    hgt = np.zeros((big * CELLS, big * CELLS))
    rgh = np.zeros((big * CELLS, big * CELLS))
    for j in range(CELLS):
        for i in range(CELLS):
            c, h, r = cell(big, rng)
            rgb[j * big:(j + 1) * big, i * big:(i + 1) * big] = c
            hgt[j * big:(j + 1) * big, i * big:(i + 1) * big] = h
            rgh[j * big:(j + 1) * big, i * big:(i + 1) * big] = r
    rgb = rgb[:PX, :PX]; hgt = hgt[:PX, :PX]; rgh = rgh[:PX, :PX]
    nor = normal_from_height(hgt, 6.0)
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for px in (PX, 256):
        sfx = '1k' if px == 1024 else str(px)
        for stem, arr, q in (('diff', rgb, 88), ('nor_gl', nor, 92),
                             ('rough', np.repeat(rgh[..., None], 3, -1), 88)):
            im = Image.fromarray((np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGB')
            if px != PX:
                im = im.resize((px, px), Image.LANCZOS)
            f = os.path.join(OUT, '%s_%s.jpg' % (stem, sfx))
            im.save(f, quality=q, optimize=True)
            total += os.path.getsize(f)
    sizes_f = os.path.join(ROOT, 'assets', 'house', '_sizes.json')
    sizes = json.load(io.open(sizes_f, encoding='utf-8')) if os.path.exists(sizes_f) else {}
    sizes['endgrain'] = PX
    with io.open(sizes_f, 'w', encoding='utf-8') as f:
        f.write(json.dumps(sizes, indent=1, sort_keys=True))
    print('endgrain: %d x %d, %d log ends per tile of %.2f m, %.0f KB'
          % (PX, PX, CELLS * CELLS, TILE_M, total / 1024))


if __name__ == '__main__':
    main()
