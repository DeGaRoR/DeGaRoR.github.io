#!/usr/bin/env python3
# CARD_PREP - a cut-out picture (a shrub, a heath cushion, a flower) made ready for a vegetation CARD (MOUNTAIN-VEG,
# 15 Nov 2026; the user: "Ensure textures are correctly converted and optimized before using").
#
#   python tools/card_prep.py --out <dir> [--px 512] [--name slug=file ...] file.png [file.png ...]
#
# Per picture, in order:
#   1. SPLIT: a sheet holding several subjects side by side (columns of empty alpha between them) gives one card each.
#   2. DE-FRINGE: an AI cut-out's soft edge is the subject blended over a WHITE matte (measured: the edge texels read
#      ~10 % lighter than the solid ones) - un-matted, c' = (c - (1 - a) 255) / a, on 0.04 < a < 0.96.
#   3. TRIM to the alpha box, 2 % pad, the ROOT at the bottom edge (the card stands on v = 1 - 0.95, flowerCards).
#   4. RESIZE premultiplied (a Lanczos on straight colour drags the transparent texels' colour into the edge), the long
#      side to --px (512 = the game's flower cards, tree_prep.py bake_flower), never up.
#   5. BLEED: the transparent texels take the colour of their nearest opaque neighbours (24 rings), so the mip chain and
#      the bilinear filter never pull black or white into the leaves (the halo).
#   6. MEASURE: alpha coverage, the kept texels' mean (linear, the cover ring's texMean), the aspect.
# Writes <slug>.png (RGBA, optimized) + card_prep.json. Never in git until the user picks (media/tex/flowers is the
# game's home for card pictures; tree_prep.py bakes them from ASSETS/vegetation/flowers).
import argparse, json, os, re, io
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('--out', required=True)
ap.add_argument('--px', type=int, default=512)
ap.add_argument('--name', action='append', default=[], help='slug=file (or slug1,slug2=file for a sheet of two)')
ap.add_argument('--matte', default='auto', help='auto | none | white: the edge is un-matted from white only when measured lighter (auto: edge > solid x 1.15)')
ap.add_argument('files', nargs='+')
A = ap.parse_args()
os.makedirs(A.out, exist_ok=True)
names = {}
for n in A.name:
    s, f = n.split('=', 1); names[os.path.basename(f)] = s.split(',')

def slug(s): return re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')

def split_cols(al):
    """column runs of alpha with a gap of 2 % of the width between them; runs under 8 % of the width are dust"""
    W = al.shape[1]; col = (al > 24).sum(0) > 2
    runs, i = [], 0
    while i < W:
        if not col[i]: i += 1; continue
        j = i
        gap = 0
        while j < W and gap < max(8, W * 0.02):
            gap = gap + 1 if not col[j] else 0; j += 1
        runs.append((i, j - gap)); i = j
    runs = [r for r in runs if r[1] - r[0] > W * 0.08]
    return runs or [(0, W)]

def bleed(rgb, a, rings=24):
    known = a > 0.02
    rgb = rgb * known[..., None]
    k = known.astype(np.float32)
    for _ in range(rings):
        if known.all(): break
        acc = np.zeros_like(rgb); cnt = np.zeros(k.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            acc += np.roll(np.roll(rgb * k[..., None], dy, 0), dx, 1); cnt += np.roll(np.roll(k, dy, 0), dx, 1)
        new = (~known) & (cnt > 0)
        rgb[new] = acc[new] / cnt[new][:, None]; k[new] = 1; known = known | new
    if not known.all(): rgb[~known] = rgb[known].mean(0)
    return rgb

def lin(c): c = c / 255.0; return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)

report = []
for f in A.files:
    src = Image.open(f).convert('RGBA'); arr = np.asarray(src).astype(np.float32)
    al = arr[..., 3]
    base = names.get(os.path.basename(f))
    runs = split_cols(al)
    if base and len(base) > len(runs):   # named as N subjects that touch: cut at the profile's valleys (a crossing twig is clipped)
        W = al.shape[1]; col = np.convolve((al > 24).sum(0).astype(float), np.ones(31) / 31, 'same'); cuts = []
        for k in range(1, len(base)):
            lo, hi = int(W * (k / len(base) - 0.18)), int(W * (k / len(base) + 0.18))
            cuts.append(lo + int(np.argmin(col[lo:hi])))
        edges = [0] + cuts + [W]; runs = [(edges[i], edges[i + 1]) for i in range(len(base))]
    for ri, (c0, c1) in enumerate(runs):
        sub = arr[:, c0:c1]
        if len(runs) > 1:   # a cut sheet: keep the widest mass, drop the neighbour's stray twigs at the cut
            rr = split_cols(sub[..., 3]); m0, m1 = max(rr, key=lambda r: r[1] - r[0]); sub = sub[:, m0:m1]
        a = sub[..., 3] / 255.0; rgb = sub[..., :3].copy()
        # 2. de-fringe against white
        edge = (a > 0.04) & (a < 0.96)
        before = rgb[edge].mean() if edge.any() else 0
        solid0 = rgb[a >= 0.96].mean() if (a >= 0.96).any() else 0
        if A.matte == 'white' or (A.matte == 'auto' and before > solid0 * 1.15):
          rgb[edge] = np.clip((rgb[edge] - (1 - a[edge])[:, None] * 255.0) / a[edge][:, None], 0, 255)
        after = rgb[edge].mean() if edge.any() else 0
        solid = solid0
        # 3. trim
        ys, xs = np.nonzero(a > 0.1)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        pad = int(round(0.02 * max(y1 - y0, x1 - x0)))
        x0, x1, y0 = max(0, x0 - pad), min(a.shape[1], x1 + pad), max(0, y0 - pad)   # no pad under the root
        a, rgb = a[y0:y1, x0:x1], rgb[y0:y1, x0:x1]
        # 4. premultiplied resize
        H, W = a.shape; k = min(1.0, A.px / max(H, W)); nw, nh = max(1, round(W * k)), max(1, round(H * k))
        pm = np.dstack([rgb * a[..., None], a * 255.0]).astype(np.float32)
        chans = [np.asarray(Image.fromarray(pm[..., c]).resize((nw, nh), Image.LANCZOS)) for c in range(4)]
        A2 = np.clip(chans[3], 0, 255) / 255.0
        RGB = np.dstack(chans[:3]) / np.maximum(A2[..., None], 1e-4)
        RGB = np.clip(RGB, 0, 255)
        # 5. bleed
        RGB = bleed(RGB, A2)
        out = np.dstack([RGB, A2 * 255.0]).round().clip(0, 255).astype(np.uint8)
        nm = (base[ri] if base and ri < len(base) else slug(os.path.splitext(os.path.basename(f))[0]) + ('_%d' % (ri + 1) if len(runs) > 1 else ''))
        p = os.path.join(A.out, nm + '.png')
        Image.fromarray(out, 'RGBA').save(p, optimize=True)
        kept = A2 >= 0.5
        mean = lin(RGB[kept]).mean(0) if kept.any() else np.zeros(3)
        r = {'name': nm, 'src': os.path.basename(f), 'part': ri + 1, 'parts': len(runs), 'px': [nw, nh], 'aspect': round(nw / nh, 3),
             'coverage': round(float(kept.mean()), 3), 'texMean': [round(float(v), 4) for v in mean],
             'fringe': {'edgeLum': round(float(before), 1), 'edgeLumAfter': round(float(after), 1), 'solidLum': round(float(solid), 1)},
             'bytes': os.path.getsize(p), 'srcBytes': os.path.getsize(f)}
        report.append(r)
        print('%-34s %4dx%-4d cov %.2f  edge %5.1f -> %5.1f (solid %5.1f)  %6d B (from %d)' % (nm, nw, nh, r['coverage'], before, after, solid, r['bytes'], r['srcBytes']))
with open(os.path.join(A.out, 'card_prep.json'), 'w', newline='\n') as fh: json.dump(report, fh, indent=1); fh.write('\n')
