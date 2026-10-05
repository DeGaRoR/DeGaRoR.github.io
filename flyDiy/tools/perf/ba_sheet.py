#!/usr/bin/env python3
"""ba_sheet.py - BEFORE / AFTER SHEETS from tools/shadowsky_shots.js pairs (SHORES-2 G1963).

shadowsky_shots writes <view>_<page>.png per page; this lays each view out as one row [before | after], each
half scaled to --w px wide, a label in the corner, and writes one JPEG per group.
  py -3 tools/perf/ba_sheet.py --dir <shots> --before index_before --after index --out <dir>
       --group lakes=lake_shore,lake_shore_back,lake_air,airport_edge --group sea=sea_beach,sea_shingle [--w 800]
       [--label-before "before (train 34)"] [--label-after "after (SHORES-2)"]
"""
import argparse, os
from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser()
ap.add_argument('--dir', required=True); ap.add_argument('--before', required=True); ap.add_argument('--after', required=True)
ap.add_argument('--out', required=True); ap.add_argument('--group', action='append', default=[]); ap.add_argument('--w', type=int, default=800)
ap.add_argument('--label-before', default='before'); ap.add_argument('--label-after', default='after')
a = ap.parse_args()
try: font = ImageFont.truetype('consolab.ttf', 15)
except Exception: font = ImageFont.load_default()

def tile(view, page, label):
    im = Image.open(os.path.join(a.dir, '%s_%s.png' % (view, page))).convert('RGB')
    h = round(im.height * a.w / im.width); im = im.resize((a.w, h), Image.LANCZOS)
    d = ImageDraw.Draw(im); t = '%s - %s' % (view, label)
    bb = d.textbbox((0, 0), t, font=font); d.rectangle([0, 0, bb[2] + 12, bb[3] + 8], fill=(0, 0, 0)); d.text((6, 3), t, fill=(255, 255, 255), font=font)
    return im

os.makedirs(a.out, exist_ok=True)
for g in a.group:
    name, views = g.split('=', 1); views = views.split(',')
    rows = [(tile(v, a.before, a.label_before), tile(v, a.after, a.label_after)) for v in views]
    H = sum(r[0].height for r in rows)
    sheet = Image.new('RGB', (a.w * 2, H), (0, 0, 0)); y = 0
    for b, f in rows: sheet.paste(b, (0, y)); sheet.paste(f, (a.w, y)); y += b.height
    p = os.path.join(a.out, name + '_before_after.jpg'); sheet.save(p, quality=86); print(p, sheet.size)
