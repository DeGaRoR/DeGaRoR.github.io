# exclusion_map.py - the legend, the outlines and the scale on exclusion_map.js's rasters (GRASS-DENSE G2560).
#   python tools/perf/grass_study/exclusion_map.py <dir> [<outDir>]   -> <outDir>/excl_<id>.png: four panels, top to bottom -
#   the grass today, the grass proposed (the 'sides' law), the trees today, the trees proposed (Annex 14's surfaces)
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

D = sys.argv[1]
O = sys.argv[2] if len(sys.argv) > 2 else D
os.makedirs(O, exist_ok=True)
try:
    F = ImageFont.truetype('arial.ttf', 15); FB = ImageFont.truetype('arialbd.ttf', 18)
except Exception:
    F = FB = ImageFont.load_default()

KEYS = {
    'grass': [((215, 40, 40), 'no grass: the pavement + its band (kill 1)'), ((240, 150, 30), 'thinned: the 6 m fade'),
              ((60, 170, 60), 'wild grass (the biome)'), ((90, 230, 90), 'wild, boosted (the verge)'), ((170, 235, 120), 'plot lawn'),
              ((150, 70, 190), 'plot: none'), ((70, 70, 75), 'no ground for grass (a hard surface in the physics)'), ((40, 60, 110), 'water')],
    'grassP': [((215, 40, 40), 'no grass: the pavement + its drawn side'), ((250, 240, 120), 'CUT grass on a grass runway'),
               ((185, 230, 110), 'CUT grass: the band + the mow band'), ((60, 170, 60), 'wild grass (the biome)'),
               ((90, 230, 90), 'wild, boosted (the verge)'), ((170, 235, 120), 'plot lawn'),
               ((150, 145, 70), 'YOUR CALL: drawn as ground, gravel in the physics'), ((40, 60, 110), 'water')],
    'trees': [((215, 40, 40), 'tree-free (treeAeroBlocked)'), ((230, 60, 230), 'a stand cleared (canopy >= 5 m)'), ((20, 90, 30), 'a stand kept (canopy >= 5 m)')],
    'treesP': [((215, 40, 40), 'the runway strip: no tree'), ((230, 60, 230), 'a stand whose top pierces a surface'), ((20, 90, 30), 'a stand under the surfaces: kept'),
               ((200, 200, 200), 'paler = a lower surface (0 -> 45 m)')],
}

for fn in sorted(os.listdir(D)):
    if not fn.endswith('.json') or fn == 'summary.json':
        continue
    info = json.load(open(os.path.join(D, fn)))
    gid = info['id']
    names = ['grass', 'grassP', 'trees', 'treesP']
    P = {n: Image.open(os.path.join(D, gid + '_' + n + '.ppm')).convert('RGB') for n in names}
    W, H = P['grass'].size
    head, cap, foot, keyW = 34, 26, 30, 440
    img = Image.new('RGB', (W + keyW, head + 4 * (cap + H) + foot), (24, 24, 28))
    for n in names:   # the strips' outlines drawn on each panel (clipped to it)
        pd = ImageDraw.Draw(P[n])
        for o in info['outlines']:
            pts = [tuple(q) for q in o['pts']]
            pd.line(pts + [pts[0]], fill=(255, 255, 255) if o['id'] == gid else (200, 200, 255), width=2)
    dr = ImageDraw.Draw(img)
    a, al, gs, ol = info['across'], info['along'], info['grassSides'], info['ols']
    dr.text((8, 6), '%s  %s  -  %s %dx%d m, band %s m, hdg %.0f deg  (1 px = %g m; the runway horizontal)' % (
        gid, info['name'], info['look'], info['len'], info['wid'], info['band'], info['hdgDeg'], info['px']), fill=(255, 255, 255), font=FB)
    caps = {
        'grass': 'GRASS TODAY: no tuft to %s m past the edge (kill to %s m, faded out by %s m)' % (a['noGroundEnd'], a['killEnd'], a['fadeEnd']),
        'grassP': "GRASS PROPOSED ('sides'): bare %s m past a paved edge (%s soft), cut over the band + %s m, wild after %s m more; a grass runway's surface cut" % (
            gs['sideClear'], gs['softClear'], gs['mowBand'], gs['mowBlend']),
        'trees': 'TREES TODAY (rwyTrees %s): none within %s m of the edge, %s m past each end, whatever their height' % (info['rwyTrees'], a['treeSide'], al['treeEnd']),
        'treesP': 'TREES PROPOSED (ICAO Annex 14, non-instrument code %d): strip %d m each side of the centreline + %d m past the ends, transitional 1:%.0f, approach %.1f %%' % (
            info['code'], ol[0], ol[1], 1 / ol[4], ol[3] * 100),
    }
    colr = {'grass': (255, 220, 160), 'grassP': (220, 255, 170), 'trees': (255, 200, 200), 'treesP': (255, 190, 255)}
    y = head
    for n in names:
        dr.text((8, y + 4), caps[n], fill=colr[n], font=F)
        img.paste(P[n], (0, y + cap))
        yy = y + cap + 4
        for c, t in KEYS[n]:
            dr.rectangle([W + 14, yy, W + 32, yy + 14], fill=c); dr.text((W + 40, yy - 1), t, fill=(230, 230, 230), font=F); yy += 21
        y += cap + H
    L = 100 / info['px']
    dr.line([(10, y + 14), (10 + L, y + 14)], fill=(255, 255, 255), width=3); dr.text((16 + L, y + 5), '100 m', fill=(255, 255, 255), font=F)
    out = os.path.join(O, 'excl_%s.png' % gid)
    img.save(out, optimize=True)
    print(out, img.size)
