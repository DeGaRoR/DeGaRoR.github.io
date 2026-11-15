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
C = dict(fresh='#cdcac3', grey='#a9a6a0', buff='#bba890', pink='#b8aaa2', lichen='#6e6f6a', lichenD='#4b4c48',
         dirt='#4a463f', moss='#556236', streakK='#3a3835', streakO='#5d5c45', scar='#dcd8d1')
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
    alb = alb * np.array([0.74, 0.77, 0.81], np.float32)   # (15 Nov, first look: too white; Annette's rock is mid blue-grey)
    Image.fromarray(to8(lin2s(np.clip(alb, 0, 1)))).save(os.path.join(OUT, name + '_albedo.png'))
    Image.fromarray(to8(hn)).save(os.path.join(OUT, name + '_height.png'))
    Image.fromarray(to8(n * 0.5 + 0.5)).save(os.path.join(OUT, name + '_normal.png'))
    Image.fromarray(to8(rough)).save(os.path.join(OUT, name + '_rough.png'))
    meta = dict(name=name, n=N, px=px, tile=N * px, hmin=lo, hmax=hi, note=relief_note,
                meanAlbedo=[float(x) for x in alb.reshape(-1, 3).mean(0)])
    json.dump(meta, open(os.path.join(OUT, name + '.json'), 'w'), indent=1)
    return meta

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
    rough = np.clip(0.82 + 0.15 * fill - 0.08 * ss(0.5, 0.8, patch) + 0.1 * lich, 0.4, 1)
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
    col = mixc(col, mixc(C['streakO'], C['streakK'], ss(0.4, 0.6, kind)), streak * 0.85)
    cv = h - blur2(h, 0.35 / px)
    col = col * (1 + np.clip(cv * 4, -0.3, 0.15))[..., None]
    fill = np.clip(slit + ledge * 0.6, 0, 1)
    col = mixc(col, C['dirt'], fill * 0.8)
    col = mixc(col, C['moss'], ledge * 0.55)
    sp = rng(S + 30).random((N, N)).astype(np.float32)
    col *= (0.95 + 0.1 * blur(sp, 1))[..., None]
    col = mixc(col, col * 0.45, (sp > 0.993).astype(np.float32))
    rough = np.clip(0.8 - 0.3 * streak + 0.15 * fill, 0.35, 1)
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
    dA, lA, bA, oA, wA = jset(150, 35, 110, S + 1, 22.0)
    dB, lB, bB, oB, wB = jset(60, 45, 140, S + 11, 18.0, shiftBand=(hash2(bA, 5, S) * 150).astype(np.float32))
    oB = oB * (hash2(bA * 97 + lB, 6, S) < 0.6)
    # ---- the surface: domed blocks (rounded within ~10 m of a joint), the joints cut into them
    eff = lambda d, o, w: np.where(o > 0.05, d / np.maximum(o, 0.05), 999.0) / w
    de = np.minimum(eff(dA, oA, wA), eff(dB, oB, wB))          # in joint widths
    dm = np.minimum(np.where(oA > 0.05, dA, 999), np.where(oB > 0.05, dB, 999))
    dome = ss(0.0, 14.0, dm)                                    # 0 at a joint, 1 at 14 m from it
    hgt = 1.1 * dome ** 0.7
    groove = np.maximum(oA * (1 - ss(0.3, 1.0, dA / wA)) * (0.6 + 0.9 * hash2(lA, 2, S)),
                        oB * (1 - ss(0.3, 1.0, dB / wB)) * (0.5 + 0.8 * hash2(lB, 3, S)))
    hgt -= groove
    hgt += (fbm_at(Xt, Zt, 256, S + 30, 3) - 0.5) * 0.6                         # a little block-scale roughness
    # (no height-keyed sheet steps on the faces: massive trondhjemite has no benches, and any law keyed to the height draws
    # the contour lines - the user's 'fingerprint' twice over; the faces' relief is the joints, the domes and the tiles' own)
    steep = ss(38, 55, slope)
    # ---- the colour multiplier (over the tile's own albedo): weathering zones, the joints' fill, the wet streaks
    zone = fbm_at(Xt, Zt, 12, S + 40, 4)
    mult = np.ones((N, N, 3), np.float32)
    mult *= (0.55 + 0.40 * ss(0.3, 0.75, zone))[..., None]   # (the lichen-darkened rock is most of an outcrop seen from afar)
    mult = mixc(mult, np.array([1.06, 1.0, 0.9], np.float32), ss(0.6, 0.8, fbm_at(Xt, Zt, 6, S + 41, 3)) * 0.7)    # a buff film
    jf = np.clip(groove / 0.6, 0, 1)
    mult = mixc(mult, np.array([0.42, 0.44, 0.36], np.float32), jf * 0.85)                                           # the joints: dirt and moss
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
    veg = np.clip(jf * 0.9 + ss(0.0, -1.5, cvv) * 0.4 + (1 - ss(12, 26, slope)) * 0.5 * rock, 0, 1)
    # ---- out
    os.makedirs(OUT, exist_ok=True)
    gxh = (np.roll(hgt, -1, 1) - np.roll(hgt, 1, 1)) / (2 * px); gzh = (np.roll(hgt, -1, 0) - np.roll(hgt, 1, 0)) / (2 * px)
    nn = np.stack([-gxh, np.ones_like(hgt), -gzh], -1); nn /= np.linalg.norm(nn, axis=-1, keepdims=True)
    lo, hi = float(hgt.min()), float(hgt.max())
    to8 = lambda a: np.clip(np.round(a * 255), 0, 255).astype(np.uint8)
    nh = np.stack([nn[..., 0] * 0.5 + 0.5, nn[..., 2] * 0.5 + 0.5, veg, (hgt - lo) / (hi - lo)], -1)
    Image.fromarray(to8(nh), 'RGBA').save(os.path.join(OUT, 'macro_nh.png'))
    Image.fromarray(to8(np.clip(mult / 1.5, 0, 1))).save(os.path.join(OUT, 'macro_mult.png'))
    hgt.astype(np.float32).tofile(os.path.join(OUT, 'macro_h.f32'))
    json.dump(dict(n=N, ext=EXT, px=px, x0=-EXT / 2, z0=-EXT / 2, hmin=lo, hmax=hi, multScale=1.5,
                   note='rows = z, cols = x, the bench local frame (origin at the patch centre); nh = (nx, nz, veg, height)'),
              open(os.path.join(OUT, 'macro.json'), 'w'), indent=1)
    # the evidence: the multiplier, the height, the vegetation's chance, from above
    os.makedirs(EVID, exist_ok=True)
    sh = (nn[..., 0] * -0.6 + nn[..., 1] * 0.8)
    a = Image.fromarray(to8(np.clip(mult / 1.5, 0, 1))).resize((768, 768))
    b = Image.fromarray(to8(np.clip(0.5 + (sh - 0.8) * 2.5, 0, 1))).resize((768, 768))
    c = Image.fromarray(to8(veg)).resize((768, 768))
    W = Image.new('RGB', (768 * 3, 768)); W.paste(a, (0, 0)); W.paste(b.convert('RGB'), (768, 0)); W.paste(c.convert('RGB'), (1536, 0))
    W.save(os.path.join(EVID, 'macro_mult_relief_veg.jpg'), quality=85)
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

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--n', type=int, default=2048); ap.add_argument('--tile', type=float, default=24)
    ap.add_argument('--seed', type=int, default=7); ap.add_argument('--only', default='slab,face,macro')
    a = ap.parse_args()
    todo = a.only.split(',')
    if 'slab' in todo: slab(a.n, a.tile, a.seed)
    if 'face' in todo: face(a.n, a.tile, a.seed + 100)
    if 'macro' in todo: macro(2048, 1600.0, a.seed + 200)
    names = [n for n in ('slab', 'face') if n in todo]
    if names: contact(names)
