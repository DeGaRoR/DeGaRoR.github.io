#!/usr/bin/env python3
# compose.py <shots_dir> <old_after_dir> <out_dir> : CABIN-RESHOOT's folders from the queue's PNGs (jobs.js)
#  before/ after/ pairs/ (the 30, CABIN-SHOTS names), pairs/<name>__old-new.jpg (eb2a7f10a after | this after),
#  roof/ and inside/ (BEFORE | AFTER pairs), canopies/ (singles). JPG q85.
import os, re, sys
from PIL import Image, ImageDraw, ImageFont
shots, old, out = sys.argv[1:4]
for d in ('before', 'after', 'pairs', 'roof', 'inside', 'canopies'):
    os.makedirs(os.path.join(out, d), exist_ok=True)
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 22)
except Exception: font = ImageFont.load_default()
VN = {'cab--125--4-3.4': 'q34', 'cab--100--4-3.6': 'side', 'cab-170-2-2.4-0.25-0.05': 'ws'}
ROOF = ('roofHdr', 'roofHdrLo', 'roofGraze', 'roofLampRear', 'roofLampRearNW', 'roofLampFront', 'roofLampFrontNW')
INSIDE = ('inUp', 'inSide', 'inRear', 'inLamp')
def pair(a, b, la, lb, to):
    A, B = Image.open(a).convert('RGB'), Image.open(b).convert('RGB')
    H, G = 34, 8
    C = Image.new('RGB', (A.width + G + B.width, H + max(A.height, B.height)), (26, 24, 22))
    C.paste(A, (0, H)); C.paste(B, (A.width + G, H))
    g = ImageDraw.Draw(C); g.text((10, 5), la, fill=(232, 222, 208), font=font); g.text((A.width + G + 10, 5), lb, fill=(232, 222, 208), font=font)
    C.save(to, quality=85)
# every PNG: (build, ba, set, view) -> path
idx = {}
for job in sorted(os.listdir(shots)):
    d = os.path.join(shots, job)
    if not os.path.isdir(d): continue
    for f in os.listdir(d):
        m = re.match(r'^(twin|cub|c172)_(before|after)_(day|dusk|lamps|lite|skin|fresh)_(.+)\.png$', f)
        if m and not f.endswith('_FAIL.png'):
            b, ba, st, v = m.groups(); idx[(b, ba, st, VN.get(v, v))] = os.path.join(d, f)
        m = re.match(r'^(can1_twin|can2_twin|can3_mosquito|open_tigermoth|sky_c172|sky_twin)_(.+)\.png$', f)
        if m and not f.endswith('_FAIL.png'):
            c, v = m.groups(); Image.open(os.path.join(d, f)).convert('RGB').save(os.path.join(out, 'canopies', c + '_' + VN.get(v, v) + '.jpg'), quality=85)
n = {'std': 0, 'oldnew': 0, 'roof': 0, 'inside': 0}
AL = 'AFTER (hdlOn, wallTrimOn, ohConsoleOn = 1) on 20243a3ed'
for (b, ba, st, v), p in sorted(idx.items()):
    if ba != 'before': continue
    q = idx.get((b, 'after', st, v))
    if not q: print('no after for', b, st, v); continue
    name = '%s_%s_%s' % (b, st, v)
    if v in ('q34', 'side', 'ws'):
        Image.open(p).convert('RGB').save(os.path.join(out, 'before', name + '.jpg'), quality=85)
        Image.open(q).convert('RGB').save(os.path.join(out, 'after', name + '.jpg'), quality=85)
        pair(p, q, 'BEFORE (rows absent) - ' + name, AL, os.path.join(out, 'pairs', name + '.jpg')); n['std'] += 1
        o = os.path.join(old, name + '.jpg')
        if os.path.exists(o):
            pair(o, q, 'OLD AFTER (eb2a7f10a, shot on 28ad47471) - ' + name, 'NEW AFTER (20243a3ed)', os.path.join(out, 'pairs', name + '__old-new.jpg')); n['oldnew'] += 1
        else: print('no old after for', name)
    elif v in ROOF:
        lab = ' (WING LAYER HIDDEN by the rig)' if v.endswith('NW') else ''
        pair(p, q, 'BEFORE - ' + name + lab, 'AFTER' + lab, os.path.join(out, 'roof', name + '.jpg')); n['roof'] += 1
    elif v in INSIDE:
        pair(p, q, 'BEFORE - ' + name, 'AFTER (rows on)', os.path.join(out, 'inside', name + '.jpg')); n['inside'] += 1
    else: print('unsorted', name)
print(n)
