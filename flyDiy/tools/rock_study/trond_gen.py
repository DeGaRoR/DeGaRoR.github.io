#!/usr/bin/env python3
# trond_gen.py - ROCK-STUDY (15 Nov 2026): THE ISLAND'S OWN ROCK, BAKED. Jolene is Annette Island, and Annette's rock is
# TRONDHJEMITE - a massive, light-grey plutonic rock (plagioclase + quartz, a little biotite). It has no bedding: it breaks
# along JOINT SETS and peels in SHEETS (exfoliation), it weathers light grey to buff, and in the rain of Southeast Alaska its
# faces carry dark water streaks and its cracks fill with dirt and moss. The two earlier generators (cliff-material,
# cliff-generator) were built on sedimentary strata, which is why their pattern made no sense here.
#
# ONE HEIGHT FIELD PER MATERIAL, AND EVERYTHING ELSE READ OFF IT: the normal is its gradient, the albedo's dark crack fill,
# grimy lips, abraded ridges and greyer hollows are its distance-to-crack and curvature, the roughness follows the same
# masks. So the colour and the relief always agree (the user: "relate the displacement/normal work with the actual texture,
# so there is mutual influence. Crevices can be greyer").
#
#   SLAB  (rock under ~50 deg, the top projection; +v = DOWNHILL, the bench turns each hex cell to the local fall line):
#         two joint families - long, warped, sub-parallel joints ACROSS the slope at irregular spacing (2.5-6.5 m), and
#         cross joints DOWN the slope, staggered band by band so they end on the long ones (the T-junctions of the user's
#         Yosemite slab); a master gully down the slope; a few diagonal splits; rounded lips; peeled sheets.
#   FACE  (the cliff, the side projections; +v = UP): smooth sheeting with vertical flutes, a few sub-vertical joints and
#         sheet steps, rare ledges, and the long dark streaks the water draws down a wet granite wall.
#   MACRO (world space over the patch, 0.78 m a pixel): regional joints (two sets, 15-45 m apart, metres wide) cutting the
#         outcrops into domed blocks, weathering zones, wet streaks down the real fall line off the real flow field. It is
#         what the far view reads and what DISPLACES the bench's dense rock mesh - the same field the colour is drawn from.
#
#   python3 flyDiy/tools/rock_study/trond_gen.py [--n 2048] [--tile 24] [--only slab,face,macro] [--seed 7]
# Writes tools/rock_study/data/trond/*.png (gitignored) and a contact sheet to reports/evidence/ROCK-STUDY/trond/.
import argparse, json, os, sys, time
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'data', 'trond')
EVID = os.path.join(HERE, '..', '..', 'reports', 'evidence', 'ROCK-STUDY', 'trond')

# ---------------------------------------------------------------------------------------------------------------- noise
def rng(seed): return np.random.default_rng(seed)

def vnoise_at(X, Y, n, seed):
    """periodic value noise on an n x n lattice; X, Y in lattice units (any float, wraps on n)"""
    g = rng(seed).random((n, n)).astype(np.float32)
    x0 = np.floor(X).astype(np.int64); y0 = np.floor(Y).astype(np.int64)
    fx = (X - x0).astype(np.float32); fy = (Y - y0).astype(np.float32)
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy)
    x0 %= n; y0 %= n; x1 = (x0 + 1) % n; y1 = (y0 + 1) % n
    a = g[y0, x0]; b = g[y0, x1]; c = g[y1, x0]; d = g[y1, x1]
    return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy

def fbm_at(X, Y, n, seed, oct=4, gain=0.5):
    """periodic fbm: X, Y in units of the tile (0..1 = one period); n = the first octave's lattice"""
    s = np.zeros_like(X, dtype=np.float32); a = 0.5; norm = 0; f = 1
    for i in range(oct):
        s += a * vnoise_at(X * n * f, Y * n * f, n * f, seed + 97 * i); norm += a; a *= gain; f *= 2
    return s / norm

def ss(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

def blur(m, r):
    """box blur x2 (periodic), r in pixels"""
    if r < 1: return m
    k = int(round(r))
    out = m.astype(np.float32)
    for ax in (0, 1):
        c = np.cumsum(np.concatenate([out.take(range(-k - 1, 0), axis=ax), out, out.take(range(0, k), axis=ax)], axis=ax), axis=ax, dtype=np.float64)
        n = out.shape[ax]
        hi = c.take(range(2 * k + 1, 2 * k + 1 + n), axis=ax); lo = c.take(range(0, n), axis=ax)
        out = ((hi - lo) / (2 * k + 1)).astype(np.float32)
    return out

def blur2(m, r): return blur(blur(m, r), r)

def nearest_line(c, p, T):
    """c: coordinate (wraps on T); p: sorted line positions in [0, T). -> (distance, index of nearest line, band index)"""
    cm = np.mod(c, T)
    pe = np.concatenate([[p[-1] - T], p, [p[0] + T]])
    i = np.searchsorted(pe, cm)                     # pe[i-1] <= cm < pe[i]
    dl = cm - pe[i - 1]; dr = pe[i] - cm
    left = dl < dr
    d = np.where(left, dl, dr)
    li = np.where(left, i - 2, i - 1) % len(p)      # the nearest line's index in p
    band = (i - 2) % len(p)                         # the band [p[band], p[band+1]) holding cm
    return d.astype(np.float32), li, band

def spaced(T, lo, hi, seed):
    r = rng(seed); s = []
    while sum(s) < T: s.append(r.uniform(lo, hi))
    s = np.array(s); s *= T / s.sum()
    return np.sort(np.mod(np.cumsum(s) + r.uniform(0, T), T))

def hash2(a, b, s):
    a = np.asarray(a, dtype=np.uint64); b = np.asarray(b, dtype=np.uint64)
    h = (a * np.uint64(0x9E3779B1) + b * np.uint64(0x85EBCA6B) + np.uint64(s) * np.uint64(0xC2B2AE35)) & np.uint64(0xFFFFFFFF)
    h ^= h >> np.uint64(15); h = (h * np.uint64(0x2C1B3C6D)) & np.uint64(0xFFFFFFFF)
    h ^= h >> np.uint64(12); h = (h * np.uint64(0x297A2D39)) & np.uint64(0xFFFFFFFF)
    h ^= h >> np.uint64(15)
    return (h.astype(np.float64) / 4294967296.0).astype(np.float32)

def grad(h, px):
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) / (2 * px)
    gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) / (2 * px)
    return gx, gy

def srgb(c):   # '#rrggbb' -> linear rgb
    c = c.lstrip('#'); v = np.array([int(c[i:i + 2], 16) / 255 for i in (0, 2, 4)], dtype=np.float32)
    return np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4).astype(np.float32)

def mixc(a, b, t):
    t = np.asarray(t, dtype=np.float32)[..., None]
    return a * (1 - t) + b * t

# THE COLOURS (sRGB, then linear): trondhjemite weathers light grey; fresh breaks are near white; iron gives a buff film;
# lichens and the wet give the dark greys and the near-black streaks; dirt and moss fill the cracks
C = dict(fresh='#c9bd9f', grey='#a89d84', buff='#b89f76', pink='#b4a28a', lichen='#6a6656', lichenD='#3e3c33',
         dirt='#3f3a2e', moss='#4f5a2c', streakK='#2e2b25', streakO='#555036', scar='#d3c7a6',
         grime='#5a5040', lichY='#a3a14e', lichO='#b07a3c', lichG='#7f8a6c')
# (15 Nov, the user: "a little more towards sandstone yellow, and a lot more dirty" - the colours lean warm, and WEATHER below
# ages them: a desaturating, darkening film, dirt in every hollow, grime drips under every edge, crustose lichens)
C = {k: srgb(v) for k, v in C.items()}

def save_maps(name, h, alb, rough, px, relief_note):
    os.makedirs(OUT, exist_ok=True)
    N = h.shape[0]
    lo, hi = float(h.min()), float(h.max())
    hn = (h - lo) / max(1e-6, hi - lo)
    gx, gy = grad(h, px)
    n = np.stack([-gx, -gy, np.ones_like(h)], -1); n /= np.linalg.norm(n, axis=-1, keepdims=True)
    to8 = lambda a: np.clip(np.round(a * 255), 0, 255).astype(np.uint8)
    lin2s = lambda a: np.where(a <= 0.0031308, a * 12.92, 1.055 * np.power(np.clip(a, 0, None), 1 / 2.4) - 0.055)
    alb = alb * np.float32(0.92)
    Image.fromarray(to8(lin2s(np.clip(alb, 0, 1)))).save(os.path.join(OUT, name + '_albedo.png'))
    Image.fromarray(to8(hn)).save(os.path.join(OUT, name + '_height.png'))
    Image.fromarray(to8(n * 0.5 + 0.5)).save(os.path.join(OUT, name + '_normal.png'))
    Image.fromarray(to8(rough)).save(os.path.join(OUT, name + '_rough.png'))
    meta = dict(name=name, n=N, px=px, tile=N * px, hmin=lo, hmax=hi, note=relief_note,
                meanAlbedo=[float(x) for x in alb.reshape(-1, 3).mean(0)])
    json.dump(meta, open(os.path.join(OUT, name + '.json'), 'w'), indent=1)
    return meta

# ---------------------------------------------------------------------------------------------------------------- WEATHER
def worley(Ut, Vt, n, seed):
    """periodic F1, F2 and cell id on an n x n jittered lattice (Ut, Vt in tile units)"""
    X = Ut * n; Y = Vt * n; ix = np.floor(X).astype(np.int64); iy = np.floor(Y).astype(np.int64)
    f1 = np.full(X.shape, 9.0, np.float32); f2 = f1.copy(); cid = np.zeros(X.shape, np.float32)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            cx = ix + dx; cy = iy + dy; wx = np.mod(cx, n); wy = np.mod(cy, n)
            ox = hash2(wx, wy, seed); oy = hash2(wx, wy, seed + 7)
            d = np.hypot(cx + ox - X, cy + oy - Y).astype(np.float32)
            closer = d < f1
            f2 = np.where(closer, f1, np.minimum(f2, d)); cid = np.where(closer, hash2(wx, wy, seed + 13), cid); f1 = np.where(closer, d, f1)
    return f1, f2, cid

def roughen(h, Ut, Vt, T, S, k=1.0):
    """NOT SO SMOOTH (the user): spalled flakes (Voronoi plates ~0.6-1.5 m, each a few cm proud or sunk, their rims chipped),
    pits, and a granular relief - the grain the crystals and the frost leave"""
    f1, f2, cid = worley(Ut, Vt, int(round(T / 0.9)), S + 501)
    edge = f2 - f1
    h = h + k * ((cid - 0.5) * 0.035 * ss(0.0, 0.18, edge) - 0.012 * (1 - ss(0.0, 0.06, edge)))
    g1, g2, _ = worley(Ut, Vt, int(round(T / 0.18)), S + 502)
    h = h - k * 0.008 * (1 - ss(0.0, 0.35, g1)) * (hash2(np.floor(Ut * 1e3).astype(np.int64), 0, S) > -1)
    h = h + k * (fbm_at(Ut, Vt, int(round(T / 0.35)), S + 503, 3) - 0.5) * 0.03
    return h, edge

def weather(h, col, px, Ut, Vt, S, down, lipmask=None):
    """THE WEATHERING PASS, as the town's houses age (house_tarr: age = desaturate + darken, the dirt in the occluded, a
    noise to break it): an AGE film; DIRT in every hollow at two scales; GRIME DRIPS below every edge and crack (the rain
    leaves what it carries a little way under where it falls off - `down` = +1 if the rows run downhill, -1 if up);
    CRUSTOSE LICHENS (black, grey-green, map-yellow, and the coast's orange, in rosettes)"""
    N = h.shape[0]
    # age: desaturate and darken, unevenly
    age = 0.55 + 0.45 * fbm_at(Ut, Vt, 3, S + 600, 3)
    l = col.mean(-1, keepdims=True)
    col = col * (1 - 0.35 * age[..., None]) + l * 0.35 * age[..., None]
    col *= (1 - 0.22 * age)[..., None]
    # dirt in the hollows: two scales of concavity (0.3 m and 2 m)
    c1 = np.clip((blur2(h, 0.3 / px) - h) * 14, 0, 1); c2 = np.clip((blur2(h, 2.0 / px) - h) * 3, 0, 1)
    dirt = np.clip(c1 * 0.8 + c2 * 0.6, 0, 1) * (0.7 + 0.3 * fbm_at(Ut, Vt, 12, S + 601, 2))
    col = mixc(col, C['dirt'] * 1.1, dirt * 0.75)
    # grime drips: sources where the surface turns down (a lip, a crack's edge) - propagated a few metres down the rows
    # (only from the LIPS - a crack's edge, a ledge's, a flake's - where the surface turns down sharply: a general slope draws curtains)
    gy = (np.roll(h, -down, 0) - h) / px
    src = np.clip(-gy * 2.5 - 0.6, 0, 1) * ss(0.45, 0.7, fbm_at(Ut * 6, Vt * 0.4, 6, S + 602, 2))
    if lipmask is not None: src *= lipmask
    acc = np.zeros(N, np.float32); drip = np.zeros_like(h); dec = 1 - px / (0.7 if lipmask is not None else 2.5)
    rows = range(N * 2) if down > 0 else range(N * 2)
    for r in rows:
        row = (r % N) if down > 0 else ((N - 1 - r) % N)
        acc = acc * dec + src[row] * 0.03
        if r % 20 == 0: acc = 0.86 * acc + 0.07 * (np.roll(acc, 1) + np.roll(acc, -1))
        if r >= N: drip[row] = acc
    drip = np.clip(drip * 3, 0, 1)
    col = mixc(col, C['grime'] * 0.8, drip * 0.6)
    # the dirt film: large soft patches of brown-grey
    film = ss(0.4, 0.75, fbm_at(Ut, Vt, 4, S + 603, 4))
    col = mixc(col, col * np.array([0.78, 0.72, 0.6], np.float32), film * 0.7)
    # crustose lichens: rosettes of four kinds, in colonies
    # (blotches, not discs: a warped high-frequency noise thresholded inside its colonies - each kind its own size and share)
    colony = ss(0.45, 0.7, fbm_at(Ut, Vt, 6, S + 604, 3))
    def blot(n, seed, th, sh):
        wx = (fbm_at(Ut, Vt, n // 4, seed + 1, 2) - 0.5) * 0.6 / n; wy = (fbm_at(Ut, Vt, n // 4, seed + 2, 2) - 0.5) * 0.6 / n
        return ss(th, th + 0.04, fbm_at(Ut + wx, Vt + wy, n, seed, 3)) * colony * sh
    col = mixc(col, C['lichenD'], blot(96, S + 605, 0.66, 0.75))
    col = mixc(col, C['lichG'], blot(64, S + 606, 0.64, 0.55))
    col = mixc(col, C['lichY'], blot(160, S + 607, 0.74, 0.6))
    col = mixc(col, C['lichO'], blot(220, S + 608, 0.78, 0.6))
    return col, np.clip(dirt + drip * 0.5 + film * 0.3, 0, 1)

# ---------------------------------------------------------------------------------------------------------------- SLAB
def slab(N, T, S):
    t0 = time.time(); px = T / N
    u = ((np.arange(N) + 0.5) * px).astype(np.float32)
    U, V = np.meshgrid(u, u)                      # rows = v (DOWNHILL), cols = u (across)
    Ut, Vt = U / T, V / T                         # tile units for the periodic noise
    # ---- family 1: long joints ACROSS the slope, warped, irregularly spaced; some stretches closed
    w1 = (fbm_at(Ut, Vt, 2, S + 1, 3) - 0.5) * 2 * 2.0 + (fbm_at(Ut, Vt, 4, S + 2, 3) - 0.5) * 1.1
    c1 = V + w1
    p1 = spaced(T, 2.5, 6.5, S + 3)
    d1, l1, band = nearest_line(c1, p1, T)
    g1 = np.hypot(*grad(c1, px)); d1 = d1 / np.maximum(g1, 0.3)
    o1 = ss(0.28, 0.5, vnoise_at(Ut * 3 + l1 * 0.37, l1.astype(np.float32) * 1.7, 3, S + 4)) * (0.55 + 0.45 * hash2(l1, 1, S))
    # ---- family 2: cross joints DOWN the slope, staggered band by band (they end on family 1: T-junctions); 20 % missing
    w2 = (fbm_at(Ut, Vt, 3, S + 11, 3) - 0.5) * 2 * 1.6
    shift = (hash2(band, 2, S) * T).astype(np.float32)
    pmid = (p1 + np.diff(np.concatenate([p1, [p1[0] + T]])) / 2)
    slant = (hash2(band, 12, S) - 0.5) * 1.1                  # each band's cross joints lean their own way (+-29 deg)
    c2 = U + w2 + shift + slant * (np.mod(c1 - pmid[band] + T / 2, T) - T / 2)
    p2 = spaced(T, 2.2, 6.0, S + 12)
    d2, l2, b2 = nearest_line(c2, p2, T)
    g2 = np.hypot(*grad(c2, px)); d2 = d2 / np.maximum(g2, 0.3)
    e2 = hash2(band * 31 + l2, 3, S) < 0.8
    o2 = np.where(e2, 0.5 + 0.5 * hash2(band * 31 + l2, 4, S), 0.0)
    # ---- the master gully: one long joint down the slope, continuous, wider, where the water goes
    w3 = (fbm_at(Ut, Vt, 2, S + 21, 3) - 0.5) * 2 * 2.6 + (fbm_at(Ut, Vt, 6, S + 23, 2) - 0.5) * 0.6
    d3, _, _ = nearest_line(U + w3, np.array([T * 0.37]), T)
    o3 = 0.6 + 0.4 * ss(0.3, 0.6, vnoise_at(Vt * 4, Ut * 0, 4, S + 22))
    # ---- diagonal splits: a third of the blocks cut once more, across
    blk = band * 131 + b2
    dg = hash2(blk, 5, S) < 0.33
    th = hash2(blk, 6, S) * np.pi
    pm1 = (p1 + np.roll(p1, -1) + np.where(np.arange(len(p1)) == len(p1) - 1, T, 0)) / 2
    pm2 = (p2 + np.roll(p2, -1) + np.where(np.arange(len(p2)) == len(p2) - 1, T, 0)) / 2
    lx = np.mod(c2 - pm2[b2] + T / 2, T) - T / 2; ly = np.mod(c1 - pm1[band] + T / 2, T) - T / 2
    d4 = np.abs(lx * np.cos(th) + ly * np.sin(th) - (hash2(blk, 7, S) - 0.5) * 1.2 + (fbm_at(Ut, Vt, 8, S + 13, 2) - 0.5) * 0.9)
    o4 = np.where(dg, 0.55, 0.0)
    # ---- the surface: undulation (sheets are curved), per-block lift, peeled sheets, rounded lips, the grooves, grain
    h = (fbm_at(Ut, Vt, 2, S + 30, 4) - 0.5) * 0.55
    h += (hash2(blk, 8, S) - 0.5) * 0.10
    sheetN = fbm_at(Ut, Vt, 5, S + 31, 3)
    sth = 0.42 + 0.25 * hash2(blk, 9, S)
    sheet = ss(sth, sth + 0.015, sheetN) * (hash2(blk, 10, S) < 0.55)
    h += sheet * 0.045
    eff = lambda d, o: np.where(o > 0.05, d / np.maximum(o, 0.05), 99.0)
    de = np.minimum.reduce([eff(d1, o1), eff(d2, o2), eff(d3, o3) * 0.6, eff(d4, o4)])
    lip = (1 - ss(0.0, 0.32, de)) ** 1.4
    h -= lip * 0.08
    gro = lambda d, o, w, dep: dep * o * (1 - ss(0.0, w * (0.6 + 0.6 * o), d))
    groove = np.maximum.reduce([gro(d1, o1, 0.09, 0.22), gro(d2, o2, 0.07, 0.16), gro(d3, o3, 0.26, 0.38), gro(d4, o4, 0.045, 0.08)])
    h -= groove
    h += (fbm_at(Ut, Vt, 64, S + 40, 3) - 0.5) * 0.012 + (rng(S + 41).random((N, N)).astype(np.float32) - 0.5) * 0.002
    h, flake = roughen(h, Ut, Vt, T, S)
    # ---- the colour, read off the surface
    patch = fbm_at(Ut, Vt, 3, S + 50, 4)
    col = mixc(C['grey'], C['fresh'], ss(0.38, 0.72, patch))
    col = mixc(col, C['buff'], ss(0.55, 0.8, fbm_at(Ut, Vt, 2, S + 51, 3)) * 0.55)
    col *= (0.95 + 0.1 * hash2(blk, 11, S))[..., None]
    col = mixc(col, C['scar'], (1 - sheet) * (hash2(blk, 10, S) < 0.55) * 0.35)     # where a sheet came off: fresher rock
    # lichen: dark rosettes in clusters, fewer on the fresh patches
    lich = ss(0.68, 0.80, fbm_at(Ut, Vt, 160, S + 52, 2)) * ss(0.3, 0.6, fbm_at(Ut, Vt, 4, S + 53, 2)) * (1 - 0.6 * ss(0.5, 0.8, patch))
    col = mixc(col, C['lichen'], lich * 0.5)
    # curvature: the abraded crowns lighter, every hollow greyer and darker
    cv = h - blur2(h, 0.35 / px)
    col = col * (1 + np.clip(cv * 5, -0.35, 0.18))[..., None]
    grey = col.mean(-1, keepdims=True)
    col = col * (1 - np.clip(-cv * 6, 0, 0.5))[..., None] + grey * np.clip(-cv * 6, 0, 0.5)[..., None] * 0.8
    # the cracks: grimy lips, then the dirt fill, moss where they are wide
    col = mixc(col, col * 0.78, lip * 0.6)
    fill = np.clip(groove / 0.12, 0, 1)
    col = mixc(col, C['dirt'], fill * 0.85)
    col = mixc(col, C['moss'], np.clip(fill * ss(0.12, 0.3, groove) * 0.45 + (1 - ss(0.0, 0.3, d3)) * o3 * ss(0.5, 0.7, fbm_at(Ut, Vt, 12, S + 54, 2)) * 0.5, 0, 1))
    # grain: the rock is medium grained - a fine value speckle and biotite flecks
    sp = rng(S + 60).random((N, N)).astype(np.float32)
    col *= (0.94 + 0.12 * blur(sp, 1))[..., None]
    col = mixc(col, col * 0.45, (sp > 0.992).astype(np.float32))
    col = mixc(col, col * 0.85, (1 - ss(0.0, 0.05, flake)) * 0.3)          # the flakes' rims: a faint hairline
    col, wd = weather(h, col, px, Ut, Vt, S, +1, lipmask=np.clip(lip * 1.5, 0, 1))
    # ROUGHNESS (16 Nov, the user: "what's remaining of bare stone should be significantly more shiny than the green parts"):
    # bare trondhjemite is a polished-by-weather crystalline surface, 0.4-0.55; the crowns the rain and the frost abrade are
    # the smoothest; everything that grows or fills - the cracks' dirt and moss, the lichens, the grime and the dirt film -
    # goes to 0.9-1 (the moss and the grass on top of it are set to 0.97 in the shader)
    rough = np.clip(0.50 + 0.06 * (fbm_at(Ut, Vt, 8, S + 61, 2) - 0.5) - 0.10 * np.clip(cv * 6, 0, 1) + 0.12 * ss(0.5, 0.8, patch) * 0
                    + 0.5 * fill + 0.45 * lich + 0.35 * wd + 0.15 * lip, 0.3, 1)
    m = save_maps('slab', h, col, rough, px, '+v downhill; relief m')
    print(f'slab {N}^2, {T} m ({px * 100:.2f} cm/px), h {m["hmin"]:.2f}..{m["hmax"]:.2f} m, {time.time() - t0:.1f} s')
    return h, col

# ---------------------------------------------------------------------------------------------------------------- FACE
def face(N, T, S):
    t0 = time.time(); px = T / N
    u = ((np.arange(N) + 0.5) * px).astype(np.float32)
    U, V = np.meshgrid(u, u)                      # rows = v (UP), cols = u (along the wall)
    Ut, Vt = U / T, V / T
    # sheeting: the wall is big curved sheets - smooth low relief, stretched up the face
    h = (fbm_at(Ut, Vt * 0.5, 2, S + 1, 4) - 0.5) * 0.9
    # vertical flutes and runnels: water-polished grooves, noise stretched 6x along v
    flute = fbm_at(Ut * 4, Vt, 4, S + 2, 3)
    h += (flute - 0.5) * 0.14 * (0.4 + 0.6 * fbm_at(Ut, Vt, 2, S + 12, 2))
    # sub-vertical joints and sheet steps: a step where one sheet ends (the right side recessed), some open as slits
    wj = (fbm_at(Ut, Vt, 2, S + 3, 3) - 0.5) * 2 * 2.2
    pj = spaced(T, 4.0, 11.0, S + 4)
    cj = U + wj + 0.25 * np.sin(Vt * 2 * np.pi) * 2.0       # (the sheet joints lean and curve across the wall)
    dj, lj, bj = nearest_line(cj, pj, T)
    stepH = hash2(lj, 1, S) * 0.25
    side = np.mod(cj, T) > pj[lj]                          # which side of the nearest joint
    h -= np.where(side, 0, 1) * 0 + ss(-0.12, 0.12, np.where(side, dj, -dj)) * stepH
    oj = ss(0.35, 0.6, vnoise_at(Vt * 3, lj.astype(np.float32) * 2.3, 3, S + 5)) * (hash2(lj, 2, S) < 0.6)
    slit = oj * (1 - ss(0.0, 0.05, dj))
    h -= slit * 0.25
    # rare ledges: sub-horizontal, where the wall above steps back and a shelf holds dirt (and later, plants)
    wl = (fbm_at(Ut, Vt, 2, S + 6, 3) - 0.5) * 2 * 1.2
    pl = spaced(T, 9.0, 16.0, S + 7)
    dl, ll, bl = nearest_line(V + wl + (U / T) * 3.0, pl, T)              # (and lean across the wall)
    open_l = ss(0.62, 0.75, vnoise_at(Ut * 4, ll.astype(np.float32) * 3.1, 4, S + 8))   # short segments only
    ledge = open_l * (1 - ss(0.0, 0.28, dl))
    h -= ledge * 0.12
    h += (fbm_at(Ut, Vt, 64, S + 9, 3) - 0.5) * 0.012 + (rng(S + 10).random((N, N)).astype(np.float32) - 0.5) * 0.002
    h, flake = roughen(h, Ut, Vt, T, S, 1.3)
    # ---- the colour: light pinkish grey, sheets of fresher rock, lichen-grey zones, and the STREAKS
    col = mixc(C['grey'], C['pink'], ss(0.4, 0.7, fbm_at(Ut, Vt * 0.5, 2, S + 20, 3)))
    col = mixc(col, C['fresh'], ss(0.6, 0.8, fbm_at(Ut, Vt * 0.4, 3, S + 21, 3)) * 0.6)
    col = mixc(col, C['lichen'], ss(0.62, 0.78, fbm_at(Ut, Vt, 5, S + 22, 3)) * 0.45)
    # STREAKS: water leaves a dark band from where it is released (a ledge, a slit's foot, the top of a flute) downward,
    # fading with distance; the band's width wanders along u. Accumulated row by row, top to bottom (-v), on a source map.
    # sources: the ledges' open segments, the slits' feet, and SEEPS - a few dozen points where water leaves the rock
    seeps = np.zeros_like(h); R = rng(S + 25)
    for k in range(28):
        cx, cy, rr = R.uniform(0, T), R.uniform(0, T), R.uniform(0.15, 0.7)
        du = np.mod(U - cx + T / 2, T) - T / 2; dv = np.mod(V - cy + T / 2, T) - T / 2
        seeps = np.maximum(seeps, (1 - ss(0, rr, np.hypot(du, dv * 2))) * R.uniform(0.4, 1))
    src = np.clip(ledge * open_l * 1.2 + slit * 0.6 + seeps, 0, 1)
    # two stages, so a streak RISES out of its source over a metre or two and then fades over 6-14 m (no hard top)
    a1 = np.zeros(N, np.float32); a2 = np.zeros(N, np.float32); streak = np.zeros_like(h)
    d1_, d2_ = 1 - px / 1.2, 1 - px / R.uniform(6, 14)
    wob = (fbm_at(Ut * 0, Vt, 6, S + 26, 3) - 0.5) * 0.6                    # the column wanders sideways going down
    for r in range(N * 2):                                   # two passes over the period, from the top down (rows wrap)
        row = (N - 1 - r) % N
        a1 = a1 * d1_ + src[row] * 0.04
        a2 = a2 * d2_ + a1 * px * 1.6
        if r % 16 == 0: a2 = 0.82 * a2 + 0.09 * (np.roll(a2, 1) + np.roll(a2, -1))   # and widens a little
        if r >= N: streak[row] = np.roll(a2, int(round(wob[row, 0] / px)))
    streak = np.clip(streak * 1.6, 0, 1) ** 0.85 * (0.55 + 0.45 * flute)
    kind = fbm_at(Ut * 3, Vt * 0.2, 3, S + 24, 2)
    col = mixc(col, mixc(C['streakO'], C['streakK'], ss(0.4, 0.6, kind)) * 0.8, np.clip(streak * 1.25, 0, 1))
    cv = h - blur2(h, 0.35 / px)
    col = col * (1 + np.clip(cv * 4, -0.3, 0.15))[..., None]
    fill = np.clip(slit + ledge * 0.6, 0, 1)
    col = mixc(col, C['dirt'], fill * 0.8)
    col = mixc(col, C['moss'], ledge * 0.55)
    sp = rng(S + 30).random((N, N)).astype(np.float32)
    col *= (0.95 + 0.1 * blur(sp, 1))[..., None]
    col = mixc(col, col * 0.45, (sp > 0.993).astype(np.float32))
    col = mixc(col, col * 0.85, (1 - ss(0.0, 0.05, flake)) * 0.3)
    col, wd = weather(h, col, px, Ut, Vt, S, -1)
    # the FACE is the shiniest: water-polished sheets (0.38, the flutes' crests 0.33), the wet streaks glossier still (to
    # ~0.2: a seep keeps them damp), the slits, ledges, grime and moss rough
    rough = np.clip(0.38 - 0.18 * streak - 0.05 * ss(0.55, 0.75, flute) + 0.55 * fill + 0.3 * wd, 0.18, 1)
    m = save_maps('face', h, col, rough, px, '+v up; relief m')
    print(f'face {N}^2, {T} m ({px * 100:.2f} cm/px), h {m["hmin"]:.2f}..{m["hmax"]:.2f} m, {time.time() - t0:.1f} s')
    return h, col

# ---------------------------------------------------------------------------------------------------------------- MACRO
def load_patch():
    hdr = json.load(open(os.path.join(HERE, 'data', 'patch.json')))
    raw = open(os.path.join(HERE, 'data', 'patch.bin'), 'rb').read()
    L = {l['name']: l for l in hdr['layout']}
    dt = {'Float32Array': np.float32, 'Uint8Array': np.uint8}
    arr = lambda n: np.frombuffer(raw, dtype=dt[L[n]['type']], count=L[n]['len'], offset=L[n]['off'])
    n = hdr['n']
    return hdr, arr('h').reshape(n, n), arr('curv').reshape(n, n, 2), arr('codes').reshape(n, n, 4), arr('flow').reshape(n, n)

def bilin(A, hdr, X, Z):
    """sample a patch grid (n x n [x C], local metres, origin at the patch centre) at X, Z"""
    n, st, half = hdr['n'], hdr['step'], hdr['size'] / 2
    fi = np.clip((X + half) / st, 0, n - 1.001); fj = np.clip((Z + half) / st, 0, n - 1.001)
    i = np.floor(fi).astype(int); j = np.floor(fj).astype(int); u = fi - i; v = fj - j
    if A.ndim == 3: u = u[..., None]; v = v[..., None]
    A = A.astype(np.float32)
    return (A[j, i] * (1 - u) + A[j, i + 1] * u) * (1 - v) + (A[j + 1, i] * (1 - u) + A[j + 1, i + 1] * u) * v

def lines_world(lo, hi, smin, smax, seed):
    r = rng(seed); p = [lo + r.uniform(0, smax)]
    while p[-1] < hi: p.append(p[-1] + r.uniform(smin, smax))
    return np.array(p, dtype=np.float32)

def nearest_world(c, p):
    i = np.clip(np.searchsorted(p, c), 1, len(p) - 1)
    dl = c - p[i - 1]; dr = p[i] - c
    left = dl < dr
    return np.where(left, dl, dr).astype(np.float32), np.where(left, i - 1, i), i - 1

def macro(N, EXT, S):
    """the world-space layer over the patch's middle EXT metres: REGIONAL JOINTS (two sets, staggered, segments), DOMED
    blocks between them, weathering zones, wet streaks down the real fall line. -> height (m), normal, albedo multiplier,
    and the vegetation's chance (for the next chantier: the joints, the hollows, the benches)"""
    t0 = time.time(); px = EXT / N
    hdr, H, CU, CO, FL = load_patch()
    x = (-EXT / 2 + (np.arange(N) + 0.5) * px).astype(np.float32)
    X, Z = np.meshgrid(x, x)                         # rows = z, cols = x (the bench's local frame)
    Y = bilin(H, hdr, X, Z)
    rock = bilin(CO[..., 0], hdr, X, Z) / 255
    flow = bilin(FL, hdr, X, Z) / 255
    cvv = bilin(CU[..., 1], hdr, X, Z)
    # the DEM's own slope and fall line (5 m, smoothed over ~15 m)
    Ys = blur2(Y, 8 / px)
    gx = (np.roll(Ys, -1, 1) - np.roll(Ys, 1, 1)) / (2 * px); gz = (np.roll(Ys, -1, 0) - np.roll(Ys, 1, 0)) / (2 * px)
    slope = np.degrees(np.arctan(np.hypot(gx, gz)))
    gl = np.maximum(np.hypot(gx, gz), 1e-4); dnx, dnz = -gx / gl, -gz / gl
    Xt, Zt = X / 2048.0, Z / 2048.0                  # noise coordinates (periodic on 2 km - never seen to repeat here)
    # ---- regional joints: set A strikes ~150 deg (NW-SE, Annette's grain), set B ~60 deg, B staggered between A's lines
    def jset(theta, smin, smax, seed, warpA, shiftBand=None):
        nx, nz = np.cos(np.radians(theta)), np.sin(np.radians(theta))
        c = X * (-nz) + Z * nx + (fbm_at(Xt, Zt, 16, seed, 3) - 0.5) * 2 * warpA + (fbm_at(Xt, Zt, 64, seed + 1, 2) - 0.5) * 2 * warpA * 0.25
        t = X * nx + Z * nz                          # along the joint
        if shiftBand is not None: c = c + shiftBand
        p = lines_world(-1500, 1500, smin, smax, seed + 2)
        d, li, band = nearest_world(c, p)
        op = ss(0.45, 0.6, vnoise_at(t / 160.0 + li * 13.1, li.astype(np.float32) * 0.0 + 0.5, 64, seed + 3))   # segments 100-400 m
        wid = 0.8 + 1.7 * hash2(li, 1, seed)
        return d, li, band, op, wid
    # (16 Nov, the user: "the network a little denser ... twice or maybe even 3 times denser" - every set at about a third of
    # its spacing, the primaries a little narrower so the denser net does not turn into trenches)
    dA, lA, bA, oA, wA = jset(150, 10, 30, S + 1, 22.0)
    dB, lB, bB, oB, wB = jset(60, 12, 38, S + 11, 18.0, shiftBand=(hash2(bA, 5, S) * 150).astype(np.float32))
    wA = wA * 0.65; wB = wB * 0.65
    oB = oB * (hash2(bA * 97 + lB, 6, S) < 0.65)
    # THE DENSER NETWORK (15 Nov, the user): two SECONDARY sets, closer (9-30 m), narrower, shorter, each staggered on the
    # primaries' bands so they end on them
    dC, lC, bC, oC, wC = jset(105, 3.5, 10, S + 21, 6.0, shiftBand=(hash2(bA * 7 + bB, 7, S) * 80).astype(np.float32))
    dD, lD, bD, oD, wD = jset(15, 4.5, 12, S + 31, 6.0, shiftBand=(hash2(bB * 5 + bA, 8, S) * 80).astype(np.float32))
    oC = oC * (hash2(bA * 31 + lC, 9, S) < 0.7); oD = oD * (hash2(bB * 17 + lD, 10, S) < 0.6)
    wC = wC * 0.4; wD = wD * 0.35
    # ---- the surface: domed blocks (rounded within ~10 m of a joint), the joints cut into them
    dm = np.minimum(np.where(oA > 0.05, dA, 999), np.where(oB > 0.05, dB, 999))
    dm2 = np.minimum(np.where(oC > 0.05, dC, 999), np.where(oD > 0.05, dD, 999))
    # FORMATIONS: every block the veins bound is its own mass - its own height (a tor, a step, a buttress, a sunk floor),
    # rounded down into its bounding veins (the primaries over ~10 m, the secondaries over ~4 m)
    fid = (bA * 7919 + bB * 104729 + bC * 13 + bD * 1009)
    lift = (hash2(fid, 11, S) - 0.42) * 3.2
    edgeF = ss(0.0, 10.0, dm) * ss(0.0, 4.0, dm2)
    hgt = 0.9 * ss(0.0, 14.0, dm) ** 0.7 + lift * edgeF
    groove = np.maximum.reduce([oA * (1 - ss(0.3, 1.0, dA / wA)) * (0.6 + 0.9 * hash2(lA, 2, S)),
                                oB * (1 - ss(0.3, 1.0, dB / wB)) * (0.5 + 0.8 * hash2(lB, 3, S)),
                                oC * (1 - ss(0.3, 1.0, dC / wC)) * (0.35 + 0.5 * hash2(lC, 4, S)),
                                oD * (1 - ss(0.3, 1.0, dD / wD)) * (0.3 + 0.45 * hash2(lD, 5, S))])
    hgt -= groove
    # NOT SO SMOOTH: the medium relief - knobs and hollows of 3-12 m and 1-3 m on every mass
    hgt += (fbm_at(Xt, Zt, 192, S + 30, 3) - 0.5) * 1.1 + (fbm_at(Xt, Zt, 768, S + 34, 2) - 0.5) * 0.35
    # (no height-keyed sheet steps on the faces: massive trondhjemite has no benches, and any law keyed to the height draws
    # the contour lines - the user's 'fingerprint' twice over; the faces' relief is the joints, the domes and the tiles' own)
    steep = ss(38, 55, slope)
    # ---- the colour multiplier (over the tile's own albedo): weathering zones, the joints' fill, the wet streaks
    zone = fbm_at(Xt, Zt, 12, S + 40, 4)
    mult = np.ones((N, N, 3), np.float32)
    mult *= (0.55 + 0.40 * ss(0.3, 0.75, zone))[..., None]   # (the lichen-darkened rock is most of an outcrop seen from afar)
    mult = mixc(mult, np.array([1.06, 1.0, 0.9], np.float32), ss(0.6, 0.8, fbm_at(Xt, Zt, 6, S + 41, 3)) * 0.7)    # a buff film
    jf = np.clip(groove / 0.5, 0, 1)
    mult = mixc(mult, np.array([0.40, 0.38, 0.30], np.float32), jf * 0.85)                                           # the joints: dirt
    # dirt in the masses' hollows and at their feet, and the DIRT LINE where the outcrop meets the ground (the houses' own)
    lap = hgt - blur2(hgt, 4.0 / px)
    mult = mixc(mult, np.array([0.55, 0.5, 0.4], np.float32), np.clip(-lap * 1.2, 0, 1) * 0.8)
    rb = blur2(rock, 6.0 / px)   # (the raster is 10 m: its stairs, blurred out)
    edgeR = ss(0.15, 0.35, rb) * (1 - ss(0.45, 0.8, rb))
    mult = mixc(mult, np.array([0.5, 0.46, 0.36], np.float32), edgeR * 0.7)
    # WET STREAKS DOWN THE REAL FALL LINE: a noise smeared along the downhill field (line-integral convolution, 48 steps of
    # 0.9 m each way) - a coordinate along the contour swirls far from the origin, the smear cannot
    nz0 = fbm_at(Xt, Zt, 1024, S + 42, 2)
    acc = np.zeros_like(nz0); cnt = 0
    for sgn in (1, -1):
        qx, qz = X.copy(), Z.copy()
        for k in range(48):
            fi = np.clip((qx - X[0, 0]) / px, 0, N - 1.001); fj = np.clip((qz - Z[0, 0]) / px, 0, N - 1.001)
            i = fi.astype(int); j = fj.astype(int)
            acc += nz0[j, i]; cnt += 1
            qx = qx + sgn * dnx[j, i] * 0.9; qz = qz + sgn * dnz[j, i] * 0.9
    lic = acc / cnt
    lic = (lic - lic.mean()) / max(1e-6, lic.std())
    st = ss(0.6, 1.6, lic) * steep * (0.35 + 0.65 * ss(0.2, 0.7, flow))
    mult = mixc(mult, np.array([0.38, 0.38, 0.34], np.float32), st * 0.75)                                          # wet streaks
    # ---- the vegetation's chance (not drawn yet: the next chantier): in the joints, the hollows, the low-angle benches
    # (the joints, the hollows, the masses' flat tops and the low-angle benches, the outcrop's margin - broken by a noise)
    gxt = (np.roll(hgt + Y, -1, 1) - np.roll(hgt + Y, 1, 1)) / (2 * px); gzt = (np.roll(hgt + Y, -1, 0) - np.roll(hgt + Y, 1, 0)) / (2 * px)
    slT = np.degrees(np.arctan(np.hypot(gxt, gzt)))
    veg = np.clip(jf * 1.0 + np.clip(-lap * 0.8, 0, 1) * 0.6 + (1 - ss(14, 30, slT)) * 0.55 + edgeR * 0.6, 0, 1)
    veg *= 0.55 + 0.45 * ss(0.3, 0.7, fbm_at(Xt, Zt, 96, S + 50, 3))
    # ---- THE ROCK'S EXPOSURE (15 Nov, the user's Google Maps view of Annette: "vegetation cuts through a lot of stuff, rock
    # is concentrated on the top parts and the ridges"): rock where the ground is HIGH, CONVEX and STEEP and the raster says
    # rock; vegetation down the drainage lines (the flow field), in the hollows and on the lower slopes - then a mosaic of two
    # noises (40 m patches, 8 m blotches) so it breaks into the mottled grey-and-green of the reference
    cz = cvv / max(1e-3, float(np.std(cvv)))
    Ef = (0.42 * ss(250, 760, Y) + 0.22 * ss(22, 48, slope) + 0.20 * np.clip(cz * 0.45, -1, 1)
          - 0.35 * ss(0.45, 0.8, flow) + 0.30 * rb - 0.08)
    mos = fbm_at(Xt, Zt, 48, S + 70, 4); fine = fbm_at(Xt, Zt, 256, S + 71, 3)
    ufine = fbm_at(Xt, Zt, 640, S + 72, 2)
    Ef = Ef + (mos - 0.5) * 0.5 + (fine - 0.5) * 0.5 + (ufine - 0.5) * 0.35   # (the reference is mottled at 2-10 m, not in blobs)
    expo = ss(0.42, 0.50, Ef) * (1 - jf * 0.7)
    # and the green SPECKLES all over the rock (the reference: heath and krummholz in every pocket, 2-5 m, up to the top)
    sp1 = fbm_at(Xt, Zt, 420, S + 73, 3); sp2 = fbm_at(Xt, Zt, 1000, S + 74, 2)
    expo *= 1 - np.clip(ss(0.56, 0.63, sp1) + ss(0.6, 0.66, sp2) * 0.8, 0, 1) * (0.55 + 0.45 * ss(0.3, 0.7, fine))
    veg = np.clip(np.maximum(veg, 1 - expo), 0, 1)
    # ---- THE VEGETATION MAPS (16 Nov, the user: "generate also a map for the small vegetation ... another session is working on
    # a subalpine biome ... feed it some maps, so that it would have a more accurate placement"). Same frame as the rest:
    # world metres, the patch's middle 1.6 km, 0.78 m a pixel. RGBA = exposure / suitability / wetness / soil, and a CLASS map:
    #   0 bare rock | 1 crack & vein flora (moss, grass, ferns in the joints) | 2 heath, dwarf shrubs (shallow soil on rock)
    #   3 krummholz, subalpine conifers (deeper pockets, sheltered, not wet) | 4 wet sedge / muskeg (flat, gathering water)
    #   5 forest (low and deep soil)
    wet = np.clip(ss(0.3, 0.8, flow) * 0.7 + np.clip(-cvv / 2.0, 0, 1) * 0.4 + (1 - ss(5, 20, slope)) * 0.3, 0, 1)
    soil = np.clip((1 - expo) * 0.6 + np.clip(-lap * 0.8, 0, 1) * 0.3 + (1 - ss(20, 45, slT)) * 0.3, 0, 1)
    cls = np.full((N, N), 2, np.uint8)
    cls[(soil >= 0.5) & (wet < 0.6) & (slT < 40)] = 3
    cls[(Y < 420) & (soil >= 0.55)] = 5
    cls[(wet >= 0.6) & (slT < 12)] = 4
    cls[(jf > 0.35) | ((expo > 0.3) & (veg > 0.65) & (soil < 0.5))] = 1
    cls[(expo > 0.6) & (jf <= 0.35)] = 0
    VEG = dict(expo=expo, suit=veg, wet=wet, soil=soil, cls=cls)
    # ---- out
    os.makedirs(OUT, exist_ok=True)
    gxh = (np.roll(hgt, -1, 1) - np.roll(hgt, 1, 1)) / (2 * px); gzh = (np.roll(hgt, -1, 0) - np.roll(hgt, 1, 0)) / (2 * px)
    nn = np.stack([-gxh, np.ones_like(hgt), -gzh], -1); nn /= np.linalg.norm(nn, axis=-1, keepdims=True)
    lo, hi = float(hgt.min()), float(hgt.max())
    to8 = lambda a: np.clip(np.round(a * 255), 0, 255).astype(np.uint8)
    nh = np.stack([nn[..., 0] * 0.5 + 0.5, nn[..., 2] * 0.5 + 0.5, veg, (hgt - lo) / (hi - lo)], -1)
    Image.fromarray(to8(nh), 'RGBA').save(os.path.join(OUT, 'macro_nh.png'))
    Image.fromarray(to8(np.clip(mult / 1.5, 0, 1))).save(os.path.join(OUT, 'macro_mult.png'))
    Image.fromarray(to8(expo)).save(os.path.join(OUT, 'macro_rock.png'))
    vm = np.stack([expo, veg, wet, soil], -1)
    Image.fromarray(to8(vm), 'RGBA').save(os.path.join(OUT, 'veg_maps.png'))
    Image.fromarray(cls).save(os.path.join(OUT, 'veg_class.png'))
    # the hand-over copies: 1024^2 (1.56 m a pixel), committed with their README (reports/evidence/ROCK-STUDY/vegmaps/)
    HV = os.path.join(EVID, '..', 'vegmaps'); os.makedirs(HV, exist_ok=True)
    Image.fromarray(to8(vm), 'RGBA').resize((1024, 1024), Image.BILINEAR).save(os.path.join(HV, 'veg_maps_1024.png'))
    Image.fromarray(cls).resize((1024, 1024), Image.NEAREST).save(os.path.join(HV, 'veg_class_1024.png'))
    pal = np.array([[150, 146, 136], [120, 140, 60], [170, 150, 80], [40, 90, 45], [90, 120, 120], [20, 60, 30]], np.uint8)
    shade = np.clip(0.55 + (nn[..., 0] * -0.6 + nn[..., 1] * 0.8 - 0.8) * 2.0, 0.3, 1.2)[..., None] if 'nn' in dir() else 1.0
    prev = (pal[cls].astype(np.float32))
    Image.fromarray(np.clip(prev, 0, 255).astype(np.uint8)).resize((1024, 1024), Image.NEAREST).save(os.path.join(HV, 'veg_class_preview.png'))
    json.dump(dict(frame='bench local metres: x east, z south (rows = z, cols = x), origin = Jolene (9540, -5140); world x = local x + 9540, world z = local z - 5140',
                   extent_m=EXT, n_full=N, px_full=px, n_handover=1024, px_handover=EXT / 1024, x0=-EXT / 2, z0=-EXT / 2,
                   veg_maps='RGBA: R rock exposure, G vegetation suitability (joints, hollows, benches, margins, not-rock), B wetness (flow + concavity + flatness), A soil depth proxy',
                   veg_class={0: 'bare rock', 1: 'crack & vein flora (moss, grass, ferns)', 2: 'heath / dwarf shrubs (shallow soil)', 3: 'krummholz / subalpine conifers (deeper pockets, not wet)', 4: 'wet sedge / muskeg', 5: 'forest (low, deep soil)'},
                   shares={str(k): round(float((cls == k).mean()), 3) for k in range(6)}),
              open(os.path.join(HV, 'veg_maps.json'), 'w'), indent=1)
    print(f'  rock exposed: {float(expo.mean()) * 100:.0f} % of the extent ({float((expo > 0.5).mean()) * 100:.0f} % over 0.5)')
    hgt.astype(np.float32).tofile(os.path.join(OUT, 'macro_h.f32'))
    json.dump(dict(n=N, ext=EXT, px=px, x0=-EXT / 2, z0=-EXT / 2, hmin=lo, hmax=hi, multScale=1.5,
                   note='rows = z, cols = x, the bench local frame (origin at the patch centre); nh = (nx, nz, veg, height)'),
              open(os.path.join(OUT, 'macro.json'), 'w'), indent=1)
    # the evidence: the multiplier, the height, the vegetation's chance, from above
    os.makedirs(EVID, exist_ok=True)
    sh = (nn[..., 0] * -0.6 + nn[..., 1] * 0.8)
    a = Image.fromarray(to8(np.clip(mult / 1.5, 0, 1))).resize((768, 768))
    b = Image.fromarray(to8(np.clip(0.5 + (sh - 0.8) * 2.5, 0, 1))).resize((768, 768))
    c = Image.fromarray(to8(np.clip(0.25 + expo * 0.5 + (sh - 0.8) * 1.5, 0, 1))).resize((768, 768))   # (the exposure over the hillshade)
    W = Image.new('RGB', (768 * 3, 768)); W.paste(a, (0, 0)); W.paste(b.convert('RGB'), (768, 0)); W.paste(c.convert('RGB'), (1536, 0))
    W.save(os.path.join(EVID, 'macro_mult_relief_expo.jpg'), quality=85)
    print(f'macro {N}^2 over {EXT} m ({px:.2f} m/px), relief {lo:.2f}..{hi:.2f} m, {time.time() - t0:.1f} s')

# ---------------------------------------------------------------------------------------------------------------- sheet
def contact(names):
    os.makedirs(EVID, exist_ok=True)
    tiles = []
    for n in names:
        for k in ('albedo', 'height', 'normal'):
            im = Image.open(os.path.join(OUT, f'{n}_{k}.png')).convert('RGB')
            if n == 'face': im = im.transpose(Image.FLIP_TOP_BOTTOM)   # (rows go UP the wall: shown the right way up)
            tiles.append(im.resize((512, 512), Image.LANCZOS))
    W = Image.new('RGB', (512 * 3, 512 * len(names)))
    for i, t in enumerate(tiles): W.paste(t, (512 * (i % 3), 512 * (i // 3)))
    W.save(os.path.join(EVID, 'maps_' + '_'.join(names) + '.jpg'), quality=86)
    # a 1:1 crop of each albedo (the resolution the eye gets near)
    for n in names:
        im = Image.open(os.path.join(OUT, f'{n}_albedo.png'))
        if n == 'face': im = im.transpose(Image.FLIP_TOP_BOTTOM)
        im.crop((0, 0, 768, 768)).save(os.path.join(EVID, f'{n}_albedo_crop_1to1.jpg'), quality=88)

def assets(seed):
    """THE GAME'S SETS (R1, 17 Nov): the slab (16 m) and face (24 m) baked at 1024 and LANCZOS-downsampled to the ground
    library's 512 (the fine lichen and grain anti-aliased, not aliased), written as the library's sources:
    assets/splat/trondSlab|trondFace/{diff,nor_gl,rough,height}_512.jpg - tools/ground_tex_prep.js cooks them into the
    arrays' layers and KTX2 (assets/ is gitignored: the shipped media/tex/ground files are the re-bake's fallback)"""
    ROOTF = os.path.join(HERE, '..', '..')
    for name, fn, T, sd in (('trondSlab', slab, 16.0, seed), ('trondFace', face, 24.0, seed + 100)):
        fn(1024, T, sd)
        src = 'slab' if fn is slab else 'face'
        d = os.path.join(ROOTF, 'assets', 'splat', name); os.makedirs(d, exist_ok=True)
        A = Image.open(os.path.join(OUT, src + '_albedo.png')).convert('RGB').resize((512, 512), Image.LANCZOS)
        Hh = Image.open(os.path.join(OUT, src + '_height.png')).convert('L').resize((512, 512), Image.LANCZOS)
        R = Image.open(os.path.join(OUT, src + '_rough.png')).convert('L').resize((512, 512), Image.LANCZOS)
        Nn = np.asarray(Image.open(os.path.join(OUT, src + '_normal.png')).convert('RGB'), np.float32) / 127.5 - 1
        Nn = np.asarray(Image.fromarray(((Nn * 0.5 + 0.5) * 255).astype(np.uint8)).resize((512, 512), Image.LANCZOS), np.float32) / 127.5 - 1
        Nn /= np.maximum(np.linalg.norm(Nn, axis=-1, keepdims=True), 1e-6)
        Nimg = Image.fromarray(np.clip(np.round((Nn * 0.5 + 0.5) * 255), 0, 255).astype(np.uint8))
        for im, stem in ((A, 'diff'), (Nimg, 'nor_gl'), (R, 'rough'), (Hh, 'height')):
            im.save(os.path.join(d, stem + '_512.jpg'), quality=95)
        lin = np.asarray(A, np.float32) / 255; lin = np.where(lin <= 0.04045, lin / 12.92, ((lin + 0.055) / 1.055) ** 2.4)
        print(name, T, 'm, mean linear', [round(float(v), 4) for v in lin.reshape(-1, 3).mean(0)], '->', d)

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--n', type=int, default=2048); ap.add_argument('--tile', type=float, default=24)
    ap.add_argument('--seed', type=int, default=7); ap.add_argument('--only', default='slab,face,macro'); ap.add_argument('--assets', action='store_true')
    a = ap.parse_args()
    if a.assets: assets(a.seed); sys.exit(0)
    todo = a.only.split(',')
    if 'slab' in todo: slab(a.n, a.tile, a.seed)
    if 'face' in todo: face(a.n, a.tile, a.seed + 100)
    if 'macro' in todo: macro(2560, 2000.0, a.seed + 200)   # (17 Nov: the whole 2 km patch - at 1.6 km the far ridge fell outside it and showed the bare tiles)
    names = [n for n in ('slab', 'face') if n in todo]
    if names: contact(names)
