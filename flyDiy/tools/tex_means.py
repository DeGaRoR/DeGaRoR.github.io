#!/usr/bin/env python3
# tex_means.py - THE MEAN COLOUR OF EVERY SHIPPED ALBEDO MAP THE FAR TOWN MAY MERGE (HLOD-MEANS, A0 22 Oct; HWCOV).
# render_premises meanOf took a house map's mean on first touch by drawing the image onto a 4 x 4 canvas and reading it
# back (drawImage + getImageData): a synchronous decode + readback, 217-287 ms of a boot settle slice and of the first
# world frame after the reveal (the strict gate's over100 x4). The means are measured here once, off the page, the way
# meanOf measured them (PIL BOX to 4 x 4, the 16 pixels' sRGB bytes averaged - tools/city_cook.js MEANS' rule), and ship
# as src/viewer/tex_means.js (TEX_MEANS: the file's media path -> [r, g, b] in sRGB bytes); meanOf reads them, no canvas.
# Keyed by the FILE (its name carries its content hash): a re-shot map is a new file with no mean - GATE PREMISES says so.
#   python tools/tex_means.py            (after any texture prep: house_tex_prep.js, wall_tex_prep.js, sign_prep.js, ...)
import os, re, sys, json
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
# the albedo maps a far-town bag can carry (tools/_house_gen.js / _big_gen.js / _hangar_gen.js / _tower_gen.js / _totem_gen.js):
# the house and wall sets' diff and paint maps, the lot / ground sets' diffs (the parks' grass), the sign sheets
DIRS = [('media/tex/house', r'_(diff|paint)_'), ('media/tex/walls', r'_(diff|paint)_'), ('media/tex/ground', r'_diff_'), ('media/tex/signs', r'')]
OUT = os.path.join(ROOT, 'src', 'viewer', 'tex_means.js')

def mean4(path):
    im = Image.open(path).convert('RGB').resize((4, 4), Image.BOX)
    px = list(im.getdata())
    return [round(sum(p[c] for p in px) / 16.0, 2) for c in range(3)]

def main():
    means = {}
    for d, pat in DIRS:
        full = os.path.join(ROOT, d)
        if not os.path.isdir(full): continue
        for f in sorted(os.listdir(full)):
            if not re.search(r'\.(jpg|jpeg|png|webp)$', f, re.I) or (pat and not re.search(pat, f)): continue
            means[d + '/' + f] = mean4(os.path.join(full, f))
    body = ',\n'.join('  ' + json.dumps(k) + ': ' + json.dumps(v) for k, v in sorted(means.items()))
    src = ('// GENERATED FILE - DO NOT EDIT. Built by tools/tex_means.py (HLOD-MEANS): every shipped albedo map\'s mean colour,\n'
           '// the 4 x 4 BOX mean of its sRGB bytes - what render_premises meanOf drew its canvas to - read by meanOf instead of a\n'
           '// canvas readback. Keyed by the media path (the file name carries its content hash).\n'
           'const TEX_MEANS = {\n' + body + '\n};\n'
           "if (typeof window !== 'undefined') window.TEX_MEANS = TEX_MEANS;\n")
    with open(OUT, 'w', encoding='utf-8', newline='\n') as fh: fh.write(src)
    print('tex_means: %d maps -> %s' % (len(means), os.path.relpath(OUT, ROOT)))

if __name__ == '__main__':
    main()
