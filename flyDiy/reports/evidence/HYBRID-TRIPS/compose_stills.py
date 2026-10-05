# compose_stills.py - HYBRID-TRIPS G1490: the Cub's fuselage lettering, bake vs live, at the three distances
# (tools/perf/hybrid_trips_stills.js output): a 2x zoom of the same crop, rows = distance, columns = bake | live | rule.
# Usage: python compose_stills.py <stillsDir> <out.jpg>
import sys, json, os
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
info = json.load(open(os.path.join(src, 'stills.json')))
rows = [('1.6', 'where train 29\'s band starts (1.6 px a texel)'), ('taxi1.1', 'the taxi chase (~1.05-1.1 px a texel)'), ('1.0', 'where G1325\'s band starts (1.0 px a texel)')]
box = (380, 380, 940, 640)   # the lettering and the cheat line (the view STILL 1.45,0.12)
Z = 2
w, h = (box[2] - box[0]) * Z, (box[3] - box[1]) * Z
pad = 28
sheet = Image.new('RGB', (3 * w, len(rows) * (h + pad)), (24, 24, 24))
d = ImageDraw.Draw(sheet)
for r, (tag, label) in enumerate(rows):
    for c, draw in enumerate(['bake', 'live', 'rule']):
        f = os.path.join(src, 'm%s_%s.png' % (tag, draw))
        im = Image.open(f).convert('RGB').crop(box).resize((w, h), Image.NEAREST)
        sheet.paste(im, (c * w, r * (h + pad) + pad))
        s = next((x for x in info['shots'] if x['at'] == tag and x['draw'] == draw), {})
        d.text((c * w + 8, r * (h + pad) + 8), '%s - %s: %s  (d %.2f m, %.2f px a texel, t %s)' % (label, draw, {'bake': 'the bake', 'live': 'the live shader', 'rule': 'the 1.0-1.25 rule'}[draw], s.get('d', 0), s.get('mag', 0), round(s.get('t', 0), 2)), fill=(240, 240, 240))
sheet.save(out, quality=88)
print(out, sheet.size)
