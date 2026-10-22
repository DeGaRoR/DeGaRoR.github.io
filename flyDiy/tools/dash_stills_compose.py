#!/usr/bin/env python3
# dash_stills_compose.py - BEFORE | AFTER | OVERLAY strips from tools/dash_stills.js (G3340, DASH-REDESIGN)
#
#   python tools/dash_stills_compose.py <render dir> <out dir> cub jodel cessna172 rufus
#
# Reads <render dir>/<name>_{before,after}_<view>.png, the *_dash.png
# silhouettes and the two JSON verdicts, and writes <out dir>/<name>_<view>.jpg:
# the before render, the after render, and the after render with the
# BEFORE dash's outline in magenta and the AFTER dash's in cyan over it.
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

VIEWS = {'side': 'side, from the left (near skin cut away)',
         'front': 'from the seat, looking forward',
         'q34': '3/4 from aft-left-above (near skin cut away)'}
PANE = 640


def outline(mask, rgb, img, width=2):
    m = mask.convert('L').point(lambda v: 255 if v > 96 else 0)
    edge = Image.fromarray(np.asarray(m.filter(ImageFilter.MaxFilter(2 * width + 1)), dtype=np.int16)
                           - np.asarray(m.filter(ImageFilter.MinFilter(3)), dtype=np.int16) > 0)
    col = Image.new('RGB', img.size, rgb)
    img.paste(col, (0, 0), edge.convert('L'))


def font(sz):
    for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans.ttf'):
        if Path(f).exists():
            return ImageFont.truetype(f, sz)
    return ImageFont.load_default()


def tank_line(j):
    t = j.get('tanks') or []
    if not t:
        return 'no body tank'
    return ', '.join('%s %g L: %d pts through the dash' % (x['bay'], x['litres'], x['dashPts']) for x in t)


def main():
    rd, od = Path(sys.argv[1]), Path(sys.argv[2])
    od.mkdir(parents=True, exist_ok=True)
    F1, F2 = font(22), font(16)
    for name in sys.argv[3:]:
        jb = json.loads((rd / (name + '_before.json')).read_text())
        ja = json.loads((rd / (name + '_after.json')).read_text())
        for v, label in VIEWS.items():
            b = Image.open(rd / ('%s_before_%s.png' % (name, v))).convert('RGB')
            a = Image.open(rd / ('%s_after_%s.png' % (name, v))).convert('RGB')
            mb = Image.open(rd / ('%s_before_%s_dash.png' % (name, v)))
            ma = Image.open(rd / ('%s_after_%s_dash.png' % (name, v)))
            ov = Image.blend(a, Image.new('RGB', a.size, (255, 255, 255)), 0.45)
            outline(ma, (0, 170, 220), ov)
            outline(mb, (220, 0, 160), ov)
            k = PANE / a.width
            sz = (PANE, round(a.height * k))
            panes = [x.resize(sz, Image.LANCZOS) for x in (b, a, ov)]
            head, foot = 64, 40
            W, H = 3 * PANE + 4 * 8, sz[1] + head + foot
            out = Image.new('RGB', (W, H), (250, 250, 248))
            d = ImageDraw.Draw(out)
            d.text((8, 6), '%s - %s' % (name, label), fill=(20, 20, 20), font=F1)
            caps = ['BEFORE: the box (saved builds keep it)', 'AFTER: the arch (new builds)',
                    'OVERLAY: before magenta, after cyan']
            for i, p in enumerate(panes):
                x = 8 + i * (PANE + 8)
                out.paste(p, (x, head))
                d.text((x, 38), caps[i], fill=(60, 60, 60), font=F2)
            d.text((8, head + sz[1] + 10), 'tanks - before: %s   |   after: %s   (green: clear of the dash, red: through it)'
                   % (tank_line(jb), tank_line(ja)), fill=(40, 40, 40), font=F2)
            out.save(od / ('%s_%s.jpg' % (name, v)), quality=86, optimize=True)
            print('wrote', od / ('%s_%s.jpg' % (name, v)))


if __name__ == '__main__':
    main()
