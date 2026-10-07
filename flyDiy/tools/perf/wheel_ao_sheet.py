#!/usr/bin/env python3
# wheel_ao_sheet.py - THE CONTACT AO's EVIDENCE SHEET (WHEEL-AO G2055), one per aeroplane, off the stills
# tools/perf/wheel_ao_stills.js shot (each view twice on one held frame: b_<view>_off.png / b_<view>_on.png; the master
# page's m_<view>.png beside them when present).
#   per view: the frame (the contact layer on), then each contact's crop x3 - master | off | on | |on - off| x4
#   the lift-off strip: the four heights (0, 0.10, 0.25, 0.45 m), the same crop, on
# The contacts are found where the layer darkened the frame: (off - on) summed over RGB > THR, on 8 px tiles, flood-filled,
# the largest few kept (frame noise - the clouds' drift, the prop - is scattered single tiles and is dropped by MIN_TILES).
# Usage: python tools/perf/wheel_ao_sheet.py <evidence dir of one aeroplane> [title]
import sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont

D = sys.argv[1]; TITLE = sys.argv[2] if len(sys.argv) > 2 else os.path.basename(os.path.abspath(D))
THR, TILE, MIN_TILES, KEEP, PAD, Z = 24, 8, 2, 4, 26, 3
VIEWS = ['shed_low', 'shed_3q', 'shed_side', 'stand_noon_side', 'stand_noon_3q', 'stand_golden_side', 'stand_golden_3q',
         'taxi_golden_side', 'taxi_golden_rear', 'taxi_noon_side']
LIFT = ['lift_0', 'lift_0p1', 'lift_0p25', 'lift_0p45']
try: FONT = ImageFont.truetype('arial.ttf', 18); FONTS = ImageFont.truetype('arial.ttf', 14)
except Exception: FONT = FONTS = ImageFont.load_default()
P = lambda n: os.path.join(D, n)
def load(n):
    for f in (n, n[:-4] + '.jpg'):                  # the shots as taken (.png) or as committed (.jpg)
        if os.path.exists(P(f)): return Image.open(P(f)).convert('RGB')
    return None

def regions(a, b):
    # the layer only DARKENS: off minus on, summed, past THR (frame noise - glare, the exposure's drift - goes both ways)
    dv = (np.asarray(a, np.int32) - np.asarray(b, np.int32)).sum(2); d = dv > THR
    H, W = d.shape; th, tw = H // TILE, W // TILE
    t = d[:th * TILE, :tw * TILE].reshape(th, TILE, tw, TILE).sum((1, 3)) >= 6
    seen = np.zeros_like(t); out = []
    for y in range(th):
        for x in range(tw):
            if not t[y, x] or seen[y, x]: continue
            st = [(y, x)]; seen[y, x] = True; cells = []
            while st:
                cy, cx = st.pop(); cells.append((cy, cx))
                for ny in range(cy - 1, cy + 2):
                    for nx in range(cx - 1, cx + 2):
                        if 0 <= ny < th and 0 <= nx < tw and t[ny, nx] and not seen[ny, nx]: seen[ny, nx] = True; st.append((ny, nx))
            if len(cells) >= MIN_TILES:
                ys = [c[0] for c in cells]; xs = [c[1] for c in cells]
                bx = (min(xs) * TILE, min(ys) * TILE, (max(xs) + 1) * TILE, (max(ys) + 1) * TILE)
                # ranked by the PEAK darkening: a tyre's core first, the body's faint pool last
                out.append((int(dv[bx[1]:bx[3], bx[0]:bx[2]].max()), bx))
    out.sort(key=lambda r: -r[0])
    boxes = []
    for _, (x0, y0, x1, y1) in out[:KEEP]:
        # a square-ish crop round it, padded, clamped
        cx, cy, s = (x0 + x1) // 2, (y0 + y1) // 2, max(x1 - x0, y1 - y0) // 2 + PAD
        s = min(s, 70)
        boxes.append((max(0, cx - s), max(0, cy - s), min(W, cx + s), min(H, cy + s)))
    return boxes

def diffimg(a, b):
    d = np.abs(np.asarray(a, np.int32) - np.asarray(b, np.int32)) * 4
    return Image.fromarray(np.clip(d, 0, 255).astype(np.uint8))

rows = []
for v in VIEWS:
    a, b, m = load('b_' + v + '_off.png'), load('b_' + v + '_on.png'), load('m_' + v + '.png')
    if a is None or b is None: continue
    rows.append((v, a, b, m, regions(a, b)))
lift = [(n, load('b_' + n + '_on.png'), load('b_' + n + '_off.png')) for n in LIFT]
lift = [x for x in lift if x[1] is not None]

FW = 480                                     # the frame's width on the sheet
def frame_thumb(img, boxes):
    t = img.copy(); dr = ImageDraw.Draw(t)
    for i, bx in enumerate(boxes): dr.rectangle(bx, outline=(255, 60, 60), width=3); dr.text((bx[0] + 4, bx[1] + 2), str(i + 1), fill=(255, 60, 60), font=FONT)
    return t.resize((FW, int(img.height * FW / img.width)))
CW = 0
for _, a, b, m, boxes in rows:
    for bx in boxes: CW = max(CW, (bx[2] - bx[0]) * Z)
CW = max(CW, 200)
cols = 4
rowsH = []
for _, a, b, m, boxes in rows:
    fh = int(a.height * FW / a.width)
    ch = sum(max(1, (bx[3] - bx[1]) * Z) + 26 for bx in boxes) if boxes else 40
    rowsH.append(max(fh, ch) + 40)
liftH = 0
if lift:
    _, l0on, l0off = lift[0]; lb = regions(l0off, l0on)[:1]
    liftBox = lb[0] if lb else None
    liftH = ((liftBox[3] - liftBox[1]) * Z + 70) if liftBox else 0
W = FW + 20 + cols * (CW + 10) + 20
H = 70 + sum(rowsH) + liftH + 20
S = Image.new('RGB', (W, H), (24, 26, 30)); dr = ImageDraw.Draw(S)
dr.text((20, 18), 'WHEEL-AO G2055 - ' + TITLE + ': per contact, x3 crops   master | layer off | layer on | |on - off| x4', fill=(235, 235, 235), font=FONT)
y = 60
for (v, a, b, m, boxes), rh in zip(rows, rowsH):
    dr.text((20, y), v, fill=(255, 210, 120), font=FONT)
    S.paste(frame_thumb(b, boxes), (20, y + 26))
    yy = y + 26
    for i, bx in enumerate(boxes):
        cw, chh = (bx[2] - bx[0]) * Z, (bx[3] - bx[1]) * Z
        x = FW + 40
        for k, (lab, src) in enumerate([('master', m), ('off', a), ('on', b), ('diff x4', diffimg(a, b))]):
            if src is not None: S.paste(src.crop(bx).resize((cw, chh), Image.LANCZOS), (x, yy + 18))
            dr.text((x, yy), (str(i + 1) + ' ' if k == 0 else '') + lab, fill=(200, 200, 200), font=FONTS)
            x += CW + 10
        yy += chh + 26
    y += rh
if lift and liftBox:
    dr.text((20, y), 'lift-off: the mains\' tyres at 0 / 0.10 / 0.25 / 0.45 m over the ground (layer on; the same crop)', fill=(255, 210, 120), font=FONT)
    x = 20; bx = liftBox; cw, chh = (bx[2] - bx[0]) * Z, (bx[3] - bx[1]) * Z
    for n, on, off in lift:
        S.paste(on.crop(bx).resize((cw, chh), Image.LANCZOS), (x, y + 44)); dr.text((x, y + 24), n, fill=(200, 200, 200), font=FONTS); x += cw + 10
out = P('sheet_' + TITLE + '.jpg'); S.save(out, quality=88); print(out, S.size)
# the committed copy: 1400 px wide, one level up (the full stills stay beside it, untracked)
small = S.resize((1400, int(S.height * 1400 / S.width)), Image.LANCZOS)
out2 = os.path.join(os.path.dirname(os.path.abspath(D)), 'sheet_' + TITLE + '.jpg'); small.save(out2, quality=80); print(out2, small.size, os.path.getsize(out2) // 1024, 'KB')
