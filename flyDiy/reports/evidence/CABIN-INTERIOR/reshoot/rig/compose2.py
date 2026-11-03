#!/usr/bin/env python3
# compose2.py <shots2_dir> <out_dir> : the user's second set (twin wgCentre 2 'open (upper only)' = twin2, the Jodel),
# phone lite tier: every view as BEFORE | AFTER, <build>_<set>_<view>.jpg, q85
import os, re, sys
from PIL import Image, ImageDraw, ImageFont
src, out = sys.argv[1:3]; os.makedirs(out, exist_ok=True)
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 22)
VN = {'cab--125--4-3.4': 'q34', 'cab--100--4-3.6': 'side', 'cab-170-2-2.4-0.25-0.05': 'ws'}
idx = {}
for job in os.listdir(src):
    d = os.path.join(src, job)
    if not os.path.isdir(d): continue
    for f in os.listdir(d):
        m = re.match(r'^(twin2|jodel)_(before|after)_(day|dusk)_(.+?)(_FAIL)?\.png$', f)
        if m: idx[m.groups()[:4]] = (os.path.join(d, f), bool(m.group(5)))
n = 0
for (b, ba, st, v), (p, bad) in sorted(idx.items()):
    if ba != 'before': continue
    q = idx.get((b, 'after', st, v))
    if not q: print('no after for', b, st, v); continue
    name = '%s_%s_%s' % (b, st, VN.get(v, v))
    A, B = Image.open(p).convert('RGB'), Image.open(q[0]).convert('RGB')
    H, G = 34, 8
    C = Image.new('RGB', (A.width + G + B.width, H + max(A.height, B.height)), (26, 24, 22)); C.paste(A, (0, H)); C.paste(B, (A.width + G, H))
    g = ImageDraw.Draw(C)
    g.text((10, 5), 'BEFORE - ' + name + (' (rig FAIL: flat)' if bad else ''), fill=(232, 222, 208), font=font)
    g.text((A.width + G + 10, 5), 'AFTER (rows on)' + (' (rig FAIL: flat)' if q[1] else '') + ' - lite tier', fill=(232, 222, 208), font=font)
    C.save(os.path.join(out, name + '.jpg'), quality=85); n += 1
print(n, 'pairs')
