#!/usr/bin/env python
# cockpit_ab.py - the cockpit evidence sheets of tools/cockpit_ab.js's folder (C4b, 2026-09-29).
#   <name>_bake.jpg   the stand from the pilot's eye (the panel, and the wing through the side window): the live shader |
#                     the bake | |OFF-ON| x8, one frame; the mean |difference| over the frame and over the panel's box
#   <name>_dials.jpg  the panel at each state (the stand at idle, the taxi, the climb): the bake ON, each dial labelled
#                     with the value its hand POINTS AT (the hand's angle through the dial's own scale), and under it the
#                     table: the sim's number, the cockpit's reading (the lagged number the hand is posed from), the hand
#                     - green when the hand agrees with the reading
#   <name>_dusk.jpg   the climb at dusk (the panel lit by the pilot's rule): OFF | ON | |OFF-ON| x8
# Usage: python tools/cockpit_ab.py <dir> <out dir> <name>
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

D, OUT, NAME = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True)
info = json.load(open(os.path.join(D, 'cockpit.json'), encoding='utf-8'))
F = lambda s: ImageFont.truetype('C:/Windows/Fonts/consola.ttf', s)
FB = lambda s: ImageFont.truetype('C:/Windows/Fonts/consolab.ttf', s)
# the drives in a pilot's units (the SI number -> (value, unit))
UNIT = {'ias': (1.943844, 'kt'), 'alt': (3.28084, 'ft'), 'vs': (196.8504, 'fpm'), 'rpmEng': (1, 'rpm'), 'hdg': (1, 'deg'),
        'fuelFrac': (100, '%'), 'oilP': (1 / 6894.757, 'psi'), 'oilT': (1, 'C'), 'volts': (1, 'V'), 'nz': (1, 'g'), 'nzMax': (1, 'g'),
        'nzMin': (1, 'g'), 'clockH': (1, 'h'), 'clockM': (1, 'min'), 'clockS': (1, 's'), 'r': (57.29578, 'deg/s'), 'beta': (57.29578, 'deg')}
def fmt(drive, x):
    if x is None: return '-'
    k, u = UNIT.get(drive, (1, ''))
    v = x * k
    return ('%.0f' % v if abs(v) >= 100 or u in ('rpm', 'ft', 'fpm') else '%.1f' % v) + ' ' + u
def sim_of(drive, s):
    return {'ias': s['Veas'] if s['Veas'] is not None else s['V'], 'alt': s['altMSL'] - (s['qnh'] or 0), 'vs': s['vs'], 'rpmEng': s['rpmEng']}.get(drive)
def agree(G):
    r, n = G['reading'], G['needle']
    if r is None or n is None: return None
    if G['law'] == 'turn':
        p = G['per']; d = abs((r % p) - n); return min(d, p - d) <= 0.01 * p
    if G['law'] == 'card':
        d = abs(r % 360 - n); return min(d, 360 - d) <= 1.0
    lo, hi = sorted([G['stops'][0][0], G['stops'][1][0]])
    rc = min(max(r, lo), hi)                                   # a reading past the scale sits the hand on its stop
    return abs(rc - n) <= max(0.01 * (hi - lo), 1e-6)
def lum(im): a = np.asarray(im.convert('RGB'), dtype=np.float32); return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
def tag(im, t, xy=(0, 0), size=22):
    d = ImageDraw.Draw(im); f = FB(size); w = d.textlength(t, font=f)
    d.rectangle([xy[0], xy[1], xy[0] + w + 16, xy[1] + size + 12], fill=(0, 0, 0)); d.text((xy[0] + 8, xy[1] + 5), t, fill=(255, 255, 255), font=f); return im
def diff8(a, b):
    x = np.abs(lum(a) - lum(b)); return Image.fromarray(np.clip(x * 8, 0, 255).astype(np.uint8)).convert('RGB'), x
def panel_box(v, pad=90):
    P = [G['px'] for G in v['gauges'] if G['px'] and 0 <= G['px'][0] < v['W'] and 0 <= G['px'][1] < v['H']]
    if not P: return (0, 0, v['W'], v['H'])
    xs, ys = [p[0] for p in P], [p[1] for p in P]
    return (max(0, int(min(xs) - pad)), max(0, int(min(ys) - pad)), min(v['W'], int(max(xs) + pad)), min(v['H'], int(max(ys) + pad)))
def img(st, vk, t): return Image.open(os.path.join(D, '%s_%s_%s.png' % (st, vk, t))).convert('RGB')
res = {}
# ---- 1. the bake ON against OFF, one frame ------------------------------------------------------------------------------
def pair_rows(st, views, title):
    rows = []
    for vk in views:
        v = info['states'][st]['views'][vk]
        A, B = img(st, vk, 'OFF'), img(st, vk, 'ON')
        dm, x = diff8(A, B)
        bx = panel_box(v)
        stats = {'mean': round(float(x.mean()), 3), 'over4': round(float((x > 4).mean()) * 100, 2), 'over16': round(float((x > 16).mean()) * 100, 2),
                 'panelMean': round(float(x[bx[1]:bx[3], bx[0]:bx[2]].mean()), 3) if vk == 'panel' else None}
        res['%s_%s' % (st, vk)] = stats
        w = 780; h = round(A.height * w / A.width)
        t = [tag(A.resize((w, h), Image.LANCZOS), 'LIVE  (the hybrid in the cockpit: t 1)'), tag(B.resize((w, h), Image.LANCZOS), 'BAKED  (t 0: exterior and cabin on the atlases)'),
             tag(dm.resize((w, h), Image.LANCZOS), '|OFF-ON| x8  mean %.2f / 255, %.2f %% of pixels > 16' % (stats['mean'], stats['over16']))]
        row = Image.new('RGB', (3 * w + 20, h), (24, 24, 24))
        for i, im in enumerate(t): row.paste(im, (i * (w + 10), 0))
        rows.append(row)
    W = rows[0].width; H = 60 + sum(r.height + 10 for r in rows)
    sh = Image.new('RGB', (W, H), (24, 24, 24)); d = ImageDraw.Draw(sh)
    d.text((10, 14), title, fill=(255, 255, 255), font=FB(26))
    y = 60
    for r in rows: sh.paste(r, (0, y)); y += r.height + 10
    return sh
st0 = info['states']['stand']
pair_rows('stand', list(st0['views'].keys()), '%s - the cockpit, live | baked, one frame (the stand, %s)' % (NAME, st0['views']['panel']['day'] or '')).save(os.path.join(OUT, NAME + '_bake.jpg'), quality=90)
if 'dusk' in info['states']:
    dv = info['states']['dusk']['views']['panel']
    pair_rows('dusk', ['panel'], '%s - the climb at dusk (%s; panel lights dim %s): live | baked, one frame' % (NAME, dv['day'] or '', dv['lights']['dim'])).save(os.path.join(OUT, NAME + '_dusk.jpg'), quality=90)
# ---- 2. the dials against the sim ----------------------------------------------------------------------------------------
tiles = []
bad = 0
for st in [k for k in ('stand', 'taxi', 'climb', 'dusk') if k in info['states']]:
    v = info['states'][st]['views']['panel']; s = v['sim']
    B = img(st, 'panel', 'ON')
    bx = panel_box(v)
    crop = B.crop(bx); sc = 1180 / crop.width; crop = crop.resize((1180, round(crop.height * sc)), Image.LANCZOS)
    d = ImageDraw.Draw(crop)
    # one label per dial (its hands grouped): the value its long / only hand points at
    seen = {}
    for G in v['gauges']:
        if not G['px']: continue
        k = G.get('gauge') or ('compass' if G.get('drive') == 'hdg' else G.get('drive') or '?'); G['gauge'] = k; seen.setdefault(k, []).append(G)
    lines = []
    for k, Gs in seen.items():
        G0 = Gs[-1] if k != 'alt' else min(Gs, key=lambda g: g['per'] or 1e9)   # the altimeter: the 100-ft (fastest) hand
        x, y = (G0['px'][0] - bx[0]) * sc, (G0['px'][1] - bx[1]) * sc
        ok = all(agree(g) is not False for g in Gs)
        if not ok: bad += 1
        lab = k + ' ' + (fmt(G0['drive'], G0['reading']) if G0['law'] != 'turn' else fmt(G0['drive'], G0['reading']))
        f = FB(18); w = d.textlength(lab, font=f)
        d.rectangle([x - w / 2 - 5, y + 40 * sc / 1.4, x + w / 2 + 5, y + 40 * sc / 1.4 + 24], fill=(0, 90, 0) if ok else (160, 0, 0))
        d.text((x - w / 2, y + 40 * sc / 1.4 + 3), lab, fill=(255, 255, 255), font=f)
        for g in Gs:
            sv = sim_of(g['drive'], s)
            nd = g['needle']
            if g['law'] == 'turn': ndt = '%s (mod %s)' % (fmt(g['drive'], nd), fmt(g['drive'], g['per']))
            else: ndt = fmt(g['drive'], nd)
            lines.append(('%-7s %-6s %-7s sim %-11s reading %-11s hand at %-22s %s' % (k, g.get('hand') or '', g['drive'], fmt(g['drive'], sv) if sv is not None else '-',
                          fmt(g['drive'], g['reading']), ndt, 'OK' if agree(g) else ('-' if agree(g) is None else 'OFF')), agree(g)))
    head = '%s  -  sim: IAS %s  ALT %s (AGL %.0f ft)  VS %s  ENGINE %s  GS %.1f kt  %s' % (st.upper(), fmt('ias', s['Veas'] if s['Veas'] is not None else s['V']),
            fmt('alt', s['altMSL'] - (v['sim']['qnh'] or 0)), s['agl'] * 3.28084, fmt('vs', s['vs']), fmt('rpmEng', s['rpmEng']), s['gs'] * 1.943844, v['day'] or '')
    th = 44 + 22 * len(lines) + 10
    tile = Image.new('RGB', (1200, crop.height + th + 20), (24, 24, 24)); tile.paste(crop, (10, th))
    td = ImageDraw.Draw(tile); td.text((10, 10), head, fill=(255, 255, 255), font=FB(19))
    for i, (ln, ok) in enumerate(lines): td.text((10, 42 + 22 * i), ln, fill=(140, 230, 140) if ok else ((230, 140, 140) if ok is False else (200, 200, 200)), font=F(17))
    tiles.append(tile)
    res['dials_' + st] = {'dials': len(seen), 'hands': sum(len(x) for x in seen.values()), 'off': [l for l, ok in lines if ok is False]}
cols = 2
rows = [tiles[i:i + cols] for i in range(0, len(tiles), cols)]
W = cols * 1210; H = 60 + sum(max(t.height for t in r) + 10 for r in rows)
sh = Image.new('RGB', (W, H), (24, 24, 24)); d = ImageDraw.Draw(sh)
d.text((10, 14), '%s - the dials against the sim (the bake ON; each label = the value the hand points at, by its own scale; green = the hand agrees with the reading)' % NAME, fill=(255, 255, 255), font=FB(22))
y = 60
for r in rows:
    for i, t in enumerate(r): sh.paste(t, (i * 1210, y))
    y += max(t.height for t in r) + 10
sh.save(os.path.join(OUT, NAME + '_dials.jpg'), quality=88)
res['handsOff'] = bad
json.dump(res, open(os.path.join(D, 'sheets.json'), 'w'), indent=1)
print(json.dumps(res))
