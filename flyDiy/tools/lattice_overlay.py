# LATTICE OVERLAY's drawing (tools/lattice_overlay.js writes the lattice and calls this):
#   python3 -I tools/lattice_overlay.py <lattice.json> <prefix> side,top,front
# reads <prefix>_<view>.png (quickshot's), writes it over with the lattice. Physics frame -> cage: cx = p.z (lateral),
# cy = p.y + yD, cz = zFw - p.x; the views as quickshot draws them: side (-cz, cy), top (-cz, -cx), front (-cx, cy).
import json, sys
from PIL import Image, ImageDraw, ImageEnhance
L = json.load(open(sys.argv[1])); pre = sys.argv[2]; views = sys.argv[3].split(',')
zFw, yD = L['D']['zFw'], L['D']['yD']
def uw(v, p):
    cx, cy, cz = p[2], p[1] + yD, zFw - p[0]
    return {'side': (-cz, cy), 'top': (-cz, -cx), 'front': (-cx, cy)}[v]
COL = {'fus': (0, 0, 0), 'wing': (20, 70, 220), 'cabane': (240, 130, 0), 'interplane': (150, 40, 190), 'tail': (0, 150, 60),
       'wire': (120, 120, 120), 'gear': (220, 20, 20)}
for v in views:
    im = Image.open('%s_%s.png' % (pre, v)).convert('RGB'); W, H = im.size
    im = ImageEnhance.Brightness(ImageEnhance.Color(im).enhance(0.35)).enhance(1.25)
    u0, u1, w0, w1 = L['frames'][v]; pad = 0.04 * (u1 - u0); u0 -= pad; u1 += pad; w0 -= pad; w1 += pad; sc = W / (u1 - u0)
    P = lambda p: ((uw(v, p)[0] - u0) * sc, (w1 - uw(v, p)[1]) * sc)
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    for b in L['beams']:
        c = COL.get(b['cls'], (255, 0, 255)); d.line([P(L['nodes'][b['a']]['p']), P(L['nodes'][b['b']]['p'])], fill=c + (170,), width=2)
    for s in L['strips']:
        a, f, r = s['a'], s['f'], s['r']; dv = [r[k] - f[k] for k in range(3)]; n = sum(x * x for x in dv) ** .5 or 1; u = [x / n for x in dv]
        le = [a[k] - .25 * s['chord'] * u[k] for k in range(3)]; te = [a[k] + .75 * s['chord'] * u[k] for k in range(3)]
        d.line([P(le), P(te)], fill=(255, 0, 200, 200), width=1); x, y = P(a); d.ellipse([x - 2, y - 2, x + 2, y + 2], fill=(255, 0, 200, 255))
    for nd in L['nodes']:
        x, y = P(nd['p']); m = nd.get('m') or 0; rr = 2 + min(7, (m ** .5) * 0.6)
        d.ellipse([x - rr, y - rr, x + rr, y + rr], outline=(0, 0, 0, 255), fill=(255, 220, 0, 230))
    Image.alpha_composite(im.convert('RGBA'), ov).convert('RGB').save('%s_%s.png' % (pre, v))
