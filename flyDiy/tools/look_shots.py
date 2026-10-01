#!/usr/bin/env python
# look_shots.py - tools/look_shots.js's frames for the user: each at 1280 px, and per build and view MASTER over THE
# HYBRID, one JPEG q93 a pair (small: the repo ships to Pages) (the chase close: the hybrid draws the live meshes; the cockpit: the fallback, the cabin live and the exterior
# on the bake, as C4b), labelled with the hybrid's t and pixels a texel. 
# Usage: python tools/look_shots.py <look dir> <out dir>
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

D, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
FB = ImageFont.truetype('C:/Windows/Fonts/consolab.ttf', 22)
def tag(im, t):
    d = ImageDraw.Draw(im); w = d.textlength(t, font=FB)
    d.rectangle([0, 0, w + 16, 34], fill=(0, 0, 0)); d.text((8, 6), t, fill=(255, 255, 255), font=FB); return im
done = []
for b in ('cub', 'cessna'):
    info = {}
    for side in ('master', 'hybrid'):
        p = os.path.join(D, '%s_%s.json' % (b, side))
        info[side] = json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}
    for view in ('chase', 'cockpit'):
        ims = []
        for side in ('master', 'hybrid'):
            f = os.path.join(D, '%s_%s_%s.png' % (b, side, view))
            if not os.path.exists(f): continue
            im = Image.open(f).convert('RGB'); im = im.resize((1280, round(im.height * 1280 / im.width)), Image.LANCZOS)
            st = (info[side] or {}).get(view) or {}
            if side == 'master': lab = 'MASTER (C4b: the bake%s)' % (', the cabin live' if view == 'cockpit' else '')
            elif view == 'chase': lab = 'THE HYBRID - t %s (%s px a texel): %s' % (st.get('t'), round(st.get('mag') or 0, 2), 'the live meshes' if (st.get('t') or 0) >= 1 else 'the bake')
            elif os.environ.get('LIVECK'): lab = "THE HYBRID, ?fbake=cockpitlive: the cabin and the eye's zone live (tEye %s)" % st.get('tEye')
            else: lab = 'THE HYBRID, the cockpit as C4b (the fallback): the cabin live, the exterior on the bake'
            ims.append(tag(im, lab))
        if len(ims) == 2:
            sh = Image.new('RGB', (1280, ims[0].height + ims[1].height + 10), (24, 24, 24))
            sh.paste(ims[0], (0, 0)); sh.paste(ims[1], (0, ims[0].height + 10))
            n = os.path.join(OUT, '%s_look_%s.jpg' % (b, view)); sh.save(n, quality=93, subsampling=0); done.append(n)
print('\n'.join(done))
