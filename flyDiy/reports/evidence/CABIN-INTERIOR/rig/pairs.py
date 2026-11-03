#!/usr/bin/env python3
# pairs.py <shots_dir> <out_dir> : every <build>_before_<tod>_<view>.png with an _after_ twin ->
#   out/before/<build>_<tod>_<view>.jpg, out/after/..., out/pairs/<build>_<tod>_<view>.jpg (before | after, labelled), q85
import os, re, sys
from PIL import Image, ImageDraw, ImageFont
src, out = sys.argv[1], sys.argv[2]
for d in ('before', 'after', 'pairs'):
    os.makedirs(os.path.join(out, d), exist_ok=True)
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 22)
except Exception:
    font = ImageFont.load_default()
n = 0
for f in sorted(os.listdir(src)):
    m = re.match(r'^(\w+?)_before_(day|dusk|lamps|lite|skin|fresh)_(.+)\.png$', f)
    if not m:
        continue
    b, tod, view = m.groups()
    fa = os.path.join(src, f.replace('_before_', '_after_'))
    if not os.path.exists(fa):
        print('no after for', f); continue
    VN = {'cab--125--4-3.4': 'q34', 'cab--100--4-3.6': 'side', 'cab-170-2-2.4-0.25-0.05': 'ws'}
    name = '%s_%s_%s' % (b, tod, VN.get(view, view))
    A, B = Image.open(os.path.join(src, f)).convert('RGB'), Image.open(fa).convert('RGB')
    A.save(os.path.join(out, 'before', name + '.jpg'), quality=85)
    B.save(os.path.join(out, 'after', name + '.jpg'), quality=85)
    H, G = 34, 8
    C = Image.new('RGB', (A.width + G + B.width, H + max(A.height, B.height)), (26, 24, 22))
    C.paste(A, (0, H)); C.paste(B, (A.width + G, H))
    g = ImageDraw.Draw(C)
    g.text((10, 5), 'BEFORE - ' + name, fill=(232, 222, 208), font=font)
    g.text((A.width + G + 10, 5), 'AFTER (hdlOn, wallTrimOn, ohConsoleOn = 1)', fill=(232, 222, 208), font=font)
    C.save(os.path.join(out, 'pairs', name + '.jpg'), quality=85)
    n += 1
print(n, 'pairs')
