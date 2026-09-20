#!/usr/bin/env python3
"""splat_sheet.py - THE COLOUR CASCADE, measured (alpha splatting, 2026-09-20).

Per terrain-type code, the three tiers the splat cross-fades between:
  MACRO   the baked albedo (Landsat tint x radar x canopy shade) averaged over
          the code's own cells - the colour the island IS from 5 km
  AERIAL  the far set(s) (tens of metres per tile), mean colour of the tile
  DETAIL  the near set(s) (metres per tile), mean colour of the tile
A cascade is consistent when the three means sit close in Lab; a gap is a
colour jump the camera crosses on the way down. The sheet draws the swatches
and the tiles side by side and prints dE (CIE76, a JND is ~2.3, a clear jump
is > 10) plus the mild RGB gain that would bring a set's mean onto its macro,
so the bench's per-set grade can be set by numbers, not by eye alone.

Usage: py -3.11 tools/splat_sheet.py [--map recipe.json] [--grid bench/jolene/dem]
       --map: the bench's `export` JSON (its `splat` table); the default table
       below is the bench's SPLAT_DEFAULT of 2026-09-20 evening.
Writes bench/splat_sheet.png (bench/ is gitignored scratch).
"""
import argparse, json, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

NAMES = {2: 'heath', 3: 'muskeg', 4: 'sand', 5: 'scree', 6: 'rock', 7: 'scrub', 8: 'forest', 9: 'snow', 10: 'built', 11: 'shingle',
         12: 'cliff (rock, slope>32-42)', 13: 'forest old (canopy>14-20)', 14: 'scrub dense (canopy>1-2.5)'}
# derived codes read their parent's cells for the macro
PARENT = {12: 6, 13: 8, 14: 7}
DEFAULT = {
    2:  {'tex': ['dry', 'grass', 'rockyA'],  'far': ['grassRock', 'grassRock', 'rockyA']},
    3:  {'tex': ['mud', 'lush', None],       'far': ['grassRock', None, None]},
    4:  {'tex': ['beach', None, None],       'far': [None, None, None]},
    5:  {'tex': ['rocksG', 'rockyB', None],  'far': ['rockyB', None, None]},
    6:  {'tex': ['rocksB', 'rocksA', None],  'far': ['rocksA', 'rockyA', None]},
    7:  {'tex': ['grass', 'lush', 'rockyA'], 'far': ['grassRock', 'grassRock', 'rockyA']},
    8:  {'tex': ['leaves', 'mud', None],     'far': ['forestAir', None, None]},
    9:  {'tex': ['snowAir', None, None],     'far': [None, None, None]},
    10: {'tex': ['dirt', None, None],        'far': ['grassRock', None, None]},
    11: {'tex': ['pebble', 'rocksG', None],  'far': ['rocksB', None, None]},
    12: {'tex': ['cliff', 'rocksA', None],   'far': ['rocksB', None, None]},
    13: {'tex': ['leaves', None, None],      'far': ['forestAir', None, None]},
    14: {'tex': ['lush', 'grass', 'rockyA'], 'far': ['grassRock', None, 'rockyA']},
}
LOT = {'lush', 'grass', 'pebble', 'dry', 'dirt'}


def set_path(key):
    lib = 'lot' if key in LOT else 'splat'
    return os.path.join(ROOT, 'assets', lib, key, 'diff_512.jpg')


def srgb_to_lab(rgb):
    c = np.asarray(rgb, dtype='float64') / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16.0 / 116.0)
    return np.array([116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])])


def dE(a, b):
    return float(np.linalg.norm(srgb_to_lab(a) - srgb_to_lab(b)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--map'); ap.add_argument('--grid', default='bench/jolene/dem')
    a = ap.parse_args()
    table = DEFAULT
    if a.map:
        table = {int(k): v for k, v in json.load(open(a.map))['splat'].items()}
    G = os.path.join(ROOT, a.grid)
    meta = json.load(open(G + '.json')); W, H = meta['w'], meta['h']
    tt = np.fromfile(G + '.ttype.u8', dtype='uint8').reshape(H, W)
    alb = np.fromfile(G + '.albedo.rgb', dtype='uint8').reshape(H, W, 3)
    tint = np.fromfile(G + '.tint.rgb', dtype='uint8').reshape(H, W, 3)
    means, thumbs = {}, {}

    def set_mean(key):
        if key in means: return means[key]
        im = Image.open(set_path(key)).convert('RGB')
        means[key] = np.asarray(im.resize((64, 64), Image.BOX), dtype='float64').reshape(-1, 3).mean(0)
        thumbs[key] = im.resize((96, 96), Image.LANCZOS)
        return means[key]

    rows = []
    for code in sorted(table):
        m = tt == PARENT.get(code, code)
        n = int(m.sum())
        if n == 0: continue
        macro = alb[m].reshape(-1, 3).mean(0); tn = tint[m].reshape(-1, 3).mean(0)
        far = [k for k in table[code]['far'] if k]
        near = [k for k in table[code]['tex'] if k]
        rows.append({'code': code, 'n': n, 'macro': macro, 'tint': tn,
                     'far': [(k, set_mean(k)) for k in far], 'near': [(k, set_mean(k)) for k in near]})

    # ---- the print ----
    print('%-28s %7s  %-14s | %-38s | %s' % ('code', 'cells', 'macro rgb', 'aerial: mean  dE(macro)  gain->macro', 'detail: mean  dE(macro)  dE(aerial)'))
    for r in rows:
        mc = r['macro']
        def fmt(k, c, ref):
            g = mc / np.maximum(c, 1)
            return '%s (%3d,%3d,%3d) dE %5.1f gain %.2f/%.2f/%.2f' % (k, *c.round(), dE(c, ref), *g)
        far_s = '; '.join(fmt(k, c, mc) for k, c in r['far']) or '-'
        near_s = '; '.join('%s (%3d,%3d,%3d) dE %5.1f%s' % (k, *c.round(), dE(c, mc),
                           ('/%5.1f' % dE(c, r['far'][0][1])) if r['far'] else '') for k, c in r['near'])
        print('%-28s %7d  (%3d,%3d,%3d) | %s | %s' % ('%d %s' % (r['code'], NAMES[r['code']]), r['n'], *mc.round(), far_s, near_s))

    # ---- the sheet ----
    SW, TH, PAD, LH = 96, 96, 8, 128
    cols = 1 + 3 + 3
    img = Image.new('RGB', (PAD + 300 + cols * (SW + PAD), PAD + 28 + len(rows) * LH), (24, 27, 32))
    d = ImageDraw.Draw(img)
    try: font = ImageFont.truetype('consola.ttf', 13); small = ImageFont.truetype('consola.ttf', 11)
    except Exception: font = small = ImageFont.load_default()
    x0 = PAD + 300
    for j, h in enumerate(['MACRO (albedo)', 'far A', 'far B', 'far C', 'near A', 'near B', 'near C']):
        d.text((x0 + j * (SW + PAD), PAD), h, fill=(190, 200, 210), font=font)
    for i, r in enumerate(rows):
        y = PAD + 28 + i * LH
        d.text((PAD, y), '%d %s' % (r['code'], NAMES[r['code']]), fill=(230, 235, 240), font=font)
        d.text((PAD, y + 18), '%d cells' % r['n'], fill=(130, 140, 150), font=small)
        d.text((PAD, y + 34), 'macro %s' % str(tuple(int(v) for v in r['macro'])), fill=(130, 140, 150), font=small)
        d.text((PAD, y + 48), 'tint  %s' % str(tuple(int(v) for v in r['tint'])), fill=(130, 140, 150), font=small)
        d.rectangle([x0, y, x0 + SW, y + SW], fill=tuple(int(v) for v in r['macro']))
        d.rectangle([x0, y + SW - 18, x0 + SW, y + SW], fill=tuple(int(v) for v in r['tint']))
        d.text((x0 + 2, y + SW - 16), 'tint', fill=(0, 0, 0), font=small)
        for tier, off in (('far', 1), ('near', 4)):
            for j, (k, c) in enumerate(r[tier]):
                x = x0 + (off + j) * (SW + PAD)
                img.paste(thumbs[k], (x, y))
                d.rectangle([x, y + TH - 22, x + 44, y + TH], fill=tuple(int(v) for v in c))
                d.text((x + 48, y + TH - 20), 'dE %.0f' % dE(c, r['macro']), fill=(240, 240, 240), font=small)
                d.text((x, y + TH + 2), k, fill=(190, 200, 210), font=small)
    out = os.path.join(ROOT, 'bench', 'splat_sheet.png')
    img.save(out)
    print('\nsheet:', out)


if __name__ == '__main__':
    main()
