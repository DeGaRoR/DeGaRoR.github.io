# compose_decals.py - HYBRID-TRIPS G1493: the decals on the control surfaces. Per build and view (tools/perf/decal_stills.js
# output): the bake | the live shader before G1493 | the live shader after - the same held frame, half size.
# Usage: python compose_decals.py <decalsDir> <out.jpg> [build ...]
import sys, os
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
builds = sys.argv[3:] or ['metal', 'cub']
cols = [('before_v%d_bake', 'the bake (unchanged by G1493)'), ('before_v%d_live', 'LIVE before G1493'), ('after_v%d_live', 'LIVE after G1493')]
rows = [(b, v) for b in builds for v in (0, 1, 2) if os.path.exists(os.path.join(src, '%s_before_v%d_bake.png' % (b, v)))]
im0 = Image.open(os.path.join(src, '%s_before_v0_bake.png' % rows[0][0]))
w, h = im0.size[0] // 2, im0.size[1] // 2
pad = 24
sheet = Image.new('RGB', (3 * w, len(rows) * (h + pad)), (24, 24, 24))
d = ImageDraw.Draw(sheet)
for r, (b, v) in enumerate(rows):
    for c, (pat, label) in enumerate(cols):
        im = Image.open(os.path.join(src, b + '_' + (pat % v) + '.png')).convert('RGB').resize((w, h), Image.LANCZOS)
        sheet.paste(im, (c * w, r * (h + pad) + pad))
        d.text((c * w + 8, r * (h + pad) + 6), '%s, view %d - %s' % ({'metal': 'metal Cessna', 'cub': 'the Cub'}.get(b, b), v, label), fill=(240, 240, 240))
sheet.save(out, quality=87)
print(out, sheet.size)
