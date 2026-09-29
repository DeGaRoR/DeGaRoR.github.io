#!/usr/bin/env python
# fold_ab.py - C4b's A/B, read (G878): the side-by-sides and the numbers of tools/fold_ab.js's folder.
# Per state and view: <state>_<view>_ab.jpg (A C4a's draws | B the folds | |A-B| x8, the aeroplane's crop, at 2x where it
# fits) and the numbers inside the aeroplane (its pixels against the frame without it, eroded 3 px - the surface, not
# the silhouette): the mean |A-B| of the luminance (0-255), its 99.9th percentile and max, the share of pixels over 4
# and over 16 levels. For the orbit views the shimmer (the mean |difference| of consecutive frames under the sub-pixel
# orbit) per side. A fold that is right draws what C4a drew: the numbers sit at the noise of two draws of one frame.
# Usage: python tools/fold_ab.py <dir> [--jpg-out <dir>] [--sheet <file.jpg>]
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

D = sys.argv[1]
JO = sys.argv[sys.argv.index('--jpg-out') + 1] if '--jpg-out' in sys.argv else D
SHEET = sys.argv[sys.argv.index('--sheet') + 1] if '--sheet' in sys.argv else None
info = json.load(open(os.path.join(D, 'ab.json')))
res = {}
def lum(im): a = np.asarray(im.convert('RGB'), dtype=np.float32); return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
def label(im, t):
    d = ImageDraw.Draw(im); d.rectangle([0, 0, 7 * len(t) + 10, 20], fill=(0, 0, 0)); d.text((5, 4), t, fill=(255, 255, 255)); return im
tiles = []
for sk, S in info['states'].items():
    for vk, v in S['views'].items():
        tag = sk + '_' + vk
        A, B = Image.open(os.path.join(D, tag + '_A.png')).convert('RGB'), Image.open(os.path.join(D, tag + '_B.png')).convert('RGB')
        x0, y0, x1, y1 = v['box']
        pad = 12; x0, y0, x1, y1 = max(0, x0 - pad), max(0, y0 - pad), min(A.width, x1 + pad), min(A.height, y1 + pad)
        if x1 <= x0 or y1 <= y0: x0, y0, x1, y1 = 0, 0, A.width, A.height
        cw, ch = x1 - x0, y1 - y0
        bgp = os.path.join(D, tag + '_bg.png')
        if os.path.exists(bgp):
            bg = Image.open(bgp).convert('RGB')
            m = (np.abs(lum(A) - lum(bg)) > 6).astype(np.uint8) * 255
            m = np.asarray(Image.fromarray(m).filter(ImageFilter.MinFilter(7))) > 0
        else: m = np.ones(lum(A).shape, bool)
        mk = m[y0:y1, x0:x1]
        d = np.abs(lum(A) - lum(B))[y0:y1, x0:x1]
        dm = d[mk] if mk.any() else d.ravel()
        r = {'box': v['box'], 'maskPx': int(mk.sum()), 'meanAB': round(float(dm.mean()), 4), 'p999': round(float(np.percentile(dm, 99.9)), 2), 'max': round(float(dm.max()), 1),
             'over4': round(float((dm > 4).mean()), 5), 'over16': round(float((dm > 16).mean()), 5),
             # the whole frame too: a fold drawn where the members were not shows OUTSIDE the eroded mask as well
             'frameMax': round(float(np.abs(lum(A) - lum(B)).max()), 1), 'frameOver16': int((np.abs(lum(A) - lum(B)) > 16).sum())}
        if v.get('cost'): r['cost'] = v['cost']
        if v.get('seq'):
            n = v['seq']
            seq = {s: [lum(Image.open(os.path.join(D, '%s_seq_%s_%02d.png' % (tag, s, i))))[y0:y1, x0:x1] for i in range(n)] for s in 'AB'}
            for s in 'AB': r['shimmer' + s] = round(float(np.mean([np.abs(seq[s][i + 1] - seq[s][i])[mk].mean() for i in range(n - 1)])), 4)
            r['seqMeanAB'] = round(float(np.mean([np.abs(seq['A'][i] - seq['B'][i])[mk].mean() for i in range(n)])), 4)
        # the picture: A | B | |A-B| x8
        z = max(1, min(2, 620 // max(1, cw)))
        ca, cb = A.crop((x0, y0, x1, y1)), B.crop((x0, y0, x1, y1))
        dd = np.clip(np.abs(np.asarray(A, np.float32) - np.asarray(B, np.float32))[y0:y1, x0:x1] * 8, 0, 255).astype(np.uint8)
        cd = Image.fromarray(dd)
        if z > 1: ca, cb, cd = [im.resize((cw * z, ch * z), Image.NEAREST) for im in (ca, cb, cd)]
        out = Image.new('RGB', (3 * ca.width + 12, ca.height), (20, 20, 20))
        out.paste(label(ca, 'A C4a draws'), (0, 0)); out.paste(label(cb, 'B C4b folds'), (ca.width + 6, 0)); out.paste(label(cd, '|A-B| x8'), (2 * ca.width + 12, 0))
        label(out, tag + '  mean %.3f  max %.0f  >16: %.3f%%' % (r['meanAB'], r['max'], 100 * r['over16']))
        out.save(os.path.join(JO, tag + '_ab.jpg'), quality=86)
        tiles.append(out)
        res[tag] = r
        print(tag, json.dumps(r))
json.dump(res, open(os.path.join(D, 'ab_read.json'), 'w'), indent=1)
if SHEET and tiles:
    W = 1500
    rows = []
    for t in tiles:
        s = W / t.width
        rows.append(t.resize((W, max(1, int(t.height * s))), Image.LANCZOS))
    H = sum(r.height for r in rows) + 4 * len(rows)
    sh = Image.new('RGB', (W, H), (20, 20, 20)); y = 0
    for r in rows: sh.paste(r, (0, y)); y += r.height + 4
    sh.save(SHEET, quality=80)
    print('sheet ->', SHEET, sh.size)
