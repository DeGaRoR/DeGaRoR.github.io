#!/usr/bin/env python3
"""GARAGE-VIEW: a garage shoot against the game's references, in numbers and one sheet.
   python gv_measure.py <garage dir> <refs dir> <out.jpg> [shell=club] [shed=HOME]
Linear medians of five bands (sky top, sky low, tree line, apron far, apron near) of the door_out view, the garage over the game."""
import sys, os
import numpy as np
from PIL import Image
G, R, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
shell = sys.argv[4] if len(sys.argv) > 4 else 'club'
shed = sys.argv[5] if len(sys.argv) > 5 else 'HOME'
def lin(a):
    a = a / 255.0
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
def load(f, asp=None):
    im = Image.open(f).convert('RGB')
    if asp and im.width / im.height > asp * 1.02:
        w = round(im.height * asp); x0 = (im.width - w) // 2; im = im.crop((x0, 0, x0 + w, im.height))
    return im
def med(A, y0, y1, x0=0.1, x1=0.9):
    h, w = A.shape[:2]
    return np.median(A[int(h * y0):int(h * y1), int(w * x0):int(w * x1)].reshape(-1, 3), axis=0)
BANDS = (('sky top', 0.02, 0.15), ('sky low', 0.30, 0.40), ('tree line', 0.40, 0.45), ('apron far', 0.56, 0.62), ('apron near', 0.80, 0.95))
cells = []
for t in ('noon', 'now', 'golden', 'night'):
    g = os.path.join(G, 'gview_%s_%s_door_out.png' % (t, shell)); r = os.path.join(R, 'ref_%s_%s_door_out.png' % (t, shed))
    if not (os.path.exists(g) and os.path.exists(r)):
        continue
    gi = load(g); ri = load(r, gi.width / gi.height)
    GA, RA = lin(np.asarray(gi, dtype=np.float64)), lin(np.asarray(ri, dtype=np.float64))
    print(t)
    for nm, y0, y1 in BANDS:
        a, b = med(RA, y0, y1), med(GA, y0, y1)
        print('  %-10s game %s  garage %s  ratio %s' % (nm, np.round(a, 3), np.round(b, 3), np.round(b / np.maximum(a, 1e-4), 2)))
    for v in ('door_out', 'door_left', 'door_right', 'inside', 'back', 'back_high'):
        gp = os.path.join(G, 'gview_%s_%s_%s.png' % (t, shell, v)); rp = os.path.join(R, 'ref_%s_%s_%s.png' % (t, shed, v))
        if v in ('door_out', 'door_left') and os.path.exists(rp):
            cells.append(load(rp, gi.width / gi.height).resize((400, round(400 * gi.height / gi.width))))
        if os.path.exists(gp):
            cells.append(load(gp).resize((400, round(400 * gi.height / gi.width))))
if cells:
    per = 8; h = cells[0].height; rows = (len(cells) + per - 1) // per
    W = Image.new('RGB', (400 * per, h * rows))
    for i, im in enumerate(cells):
        W.paste(im, ((i % per) * 400, (i // per) * h))
    W.save(OUT, quality=80); print('sheet', W.size, '->', OUT)
