#!/usr/bin/env python
# hybrid_ab.py - the hybrid's evidence sheets from tools/hybrid_ab.js's folder (C4b, 2026-09-30). Lossless PNG.
#   <name>_closeup.png   one held frame drawn three ways, close on the fuselage: THE OLD BAKE (C4b as it landed, t = 0) |
#                        THE HYBRID (what it draws this close: the live meshes, t = 1) | THE BAND (t = 0.5, dithered) -
#                        the whole frame (half size) over a 1:1 crop and a 2x crop of the livery
#   <name>_crossing.png  the walk FAR -> NEAR -> FAR under the rule: a strip of frames round the band (t, pixels a texel)
#   <name>_crossing.webp the whole walk, lossless animated (kept beside the folder; large)
# Usage: python tools/hybrid_ab.py <dir> <out dir> <name> [--crop x,y,w,h]
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

D, OUT, NAME = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True)
info = json.load(open(os.path.join(D, 'hybrid.json'), encoding='utf-8'))
FB = lambda s: ImageFont.truetype('C:/Windows/Fonts/consolab.ttf', s)
def tag(im, t, size=20):
    d = ImageDraw.Draw(im); f = FB(size); w = d.textlength(t, font=f)
    d.rectangle([0, 0, w + 16, size + 12], fill=(0, 0, 0)); d.text((8, 5), t, fill=(255, 255, 255), font=f); return im
def lum(im): a = np.asarray(im.convert('RGB'), dtype=np.float32); return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
A = {k: Image.open(os.path.join(D, 'still_' + k + '.png')).convert('RGB') for k in ('bake', 'live', 'band')}
W, H = A['bake'].size
# the crop: given, else where bake and live differ most (the livery's edges), a 480 x 300 box round the difference's centre
if '--crop' in sys.argv:
    cx, cy, cw, ch = map(int, sys.argv[sys.argv.index('--crop') + 1].split(','))
else:
    d = np.abs(lum(A['bake']) - lum(A['live']))
    d[d < 8] = 0
    ys, xs = np.nonzero(d)
    if len(xs): mx, my = int(np.median(xs)), int(np.median(ys))
    else: mx, my = W // 2, H // 2
    cw, ch = 480, 300
    cx, cy = max(0, min(W - cw, mx - cw // 2)), max(0, min(H - ch, my - ch // 2))
st = info['still']
lab = {'bake': 'THE OLD BAKE (t 0)', 'live': 'THE HYBRID, this close (t %s: the live meshes)' % st['rule'].get('t'), 'band': 'THE BAND (t 0.5, dithered)'}
cols = []
for k in ('bake', 'live', 'band'):
    full = A[k].resize((W // 2, H // 2), Image.LANCZOS)
    ImageDraw.Draw(full).rectangle([cx // 2, cy // 2, (cx + cw) // 2, (cy + ch) // 2], outline=(255, 200, 0), width=2)
    c1 = A[k].crop((cx, cy, cx + cw, cy + ch))
    c2 = A[k].crop((cx + cw // 4, cy + ch // 4, cx + 3 * cw // 4, cy + 3 * ch // 4)).resize((cw, ch), Image.NEAREST)
    col = Image.new('RGB', (W // 2, H // 2 + 2 * ch + 20), (24, 24, 24))
    col.paste(tag(full, lab[k]), (0, 0)); col.paste(tag(c1, '1:1'), ((W // 2 - cw) // 2, H // 2 + 10)); col.paste(tag(c2, '2x (nearest)'), ((W // 2 - cw) // 2, H // 2 + ch + 20))
    cols.append(col)
sh = Image.new('RGB', (3 * W // 2 + 20, cols[0].height + 50), (24, 24, 24))
dd = ImageDraw.Draw(sh)
dd.text((10, 12), '%s - close up, one held frame drawn three ways (the orbit %.1f m; the rule: %s screen px a texel -> t %s)' % (
    NAME, st['rule']['cam']['dist'], st['rule'].get('mag'), st['rule'].get('t')), fill=(255, 255, 255), font=FB(22))
for i, c in enumerate(cols): sh.paste(c, (i * (W // 2 + 10), 50))
sh.save(os.path.join(OUT, NAME + '_closeup.png'), optimize=True)
# the crossing
cr = info['cross']
fr = lambda s: Image.open(os.path.join(D, 'cross_%03d.png' % s)).convert('RGB')
# the strip: the first frame the band touches, its middle, full live, and the far and near ends (the way in)
inn = [c for c in cr if c['s'] <= len(cr) // 2]
pick = [inn[0]]
for c in inn:
    if c['t'] and c['t'] > 0 and (len(pick) < 2): pick.append(c)
mid = min(inn, key=lambda c: abs((c['t'] or 0) - 0.5)); full = next((c for c in inn if (c['t'] or 0) >= 1), inn[-1])
for c in (mid, full, inn[-1]):
    if c not in pick: pick.append(c)
tw = 520; th = round(H * tw / W)
strip = Image.new('RGB', (len(pick) * (tw + 10), th + 50), (24, 24, 24))
ImageDraw.Draw(strip).text((10, 12), '%s - the crossing under the rule (orbit walked far -> near; the world held)' % NAME, fill=(255, 255, 255), font=FB(20))
for i, c in enumerate(pick):
    im = fr(c['s']).resize((tw, th), Image.LANCZOS)
    tag(im, '%.1f m  %s px/texel  t %s' % (c['d'], c['mag'], 'n/a' if c['t'] is None else round(c['t'], 2)), 16)
    strip.paste(im, (i * (tw + 10), 50))
strip.save(os.path.join(OUT, NAME + '_crossing.png'), optimize=True)
seq = [fr(c['s']).resize((W // 2, H // 2), Image.LANCZOS) for c in cr]
seq[0].save(os.path.join(D, NAME + '_crossing.webp'), save_all=True, append_images=seq[1:], duration=120, loop=0, lossless=True, quality=100, method=4)
res = {'crop': [cx, cy, cw, ch], 'rule': st['rule'], 'strip': [(c['d'], c['mag'], c['t']) for c in pick],
       'meanAbs_bake_live_crop': round(float(np.abs(lum(A['bake']) - lum(A['live']))[cy:cy + ch, cx:cx + cw].mean()), 2),
       'cost': [(c['d'], c['t'], c['calls'], c['cost']) for c in cr]}
json.dump(res, open(os.path.join(D, 'sheets.json'), 'w'), indent=1)
print(json.dumps({k: res[k] for k in ('crop', 'strip', 'meanAbs_bake_live_crop')}))
