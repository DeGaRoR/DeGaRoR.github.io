#!/usr/bin/env python3
"""splat_tex_tone.py - THE HAND TONE ON A GROUND SET'S COLOUR MAP (2026-09-23).

The user tuned the forest floor in GIMP (Hue-Saturation, Master) and asked for
that transformation, not an approximation of it: Hue +13.2, Saturation +0.6,
Lightness left to the shader's grade (the slider's own lightness turned out to
mean something different from a multiply, and -60.4 came out far too dark).

WHY THIS FILE EXISTS. media/tex/ground (media/tex/splat before G911) is
CONTENT-ADDRESSED: a file's name is the first eight hex of the sha256 of its
bytes, and tools/ground_tex_prep.js rebuilds every one of them from assets/. A
tone applied by hand to the shipped file would therefore be LOST, silently, the
next time anyone baked - so the set lists the map in `keep` (tools/ground_sets.json):
the baker then takes the SHIPPED file for it, never assets/.

THE GROUND LIBRARY (G911, AS2): the colour map is ALSO cooked into the set's
texture-array layers, so a tone is only whole once the layers are re-cooked:
--write patches src/viewer/ground_tex.js (the path) and tools/ground_sets.json
(the splat's mean, and `keep`), then runs node tools/ground_tex_prep.js, which
cooks the toned bytes and prunes the untoned file. After a RE-IMPORT of the set:
take 'diff' out of its `keep`, bake (the untoned import lands), then --write.

    py -3.11 tools/splat_tex_tone.py                 # report what it would do
    py -3.11 tools/splat_tex_tone.py --write         # tone, rename by hash, patch, re-bake

The transform is GIMP 2.10's gimp:hue-saturation in HSL over the sRGB values.
The MEAN in the manifest is re-measured here, because the grading chain reads
it: the macro tint's `rel`, the uSLum pivot the grass mask uses, and the tuft
colour a blade takes at its foot all come off that number.
"""
import colorsys, hashlib, io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, 'src', 'viewer', 'ground_tex.js')
SETS = os.path.join(ROOT, 'tools', 'ground_sets.json')
STORE = os.path.join(ROOT, 'media', 'tex', 'ground')

# key -> (hue degrees, lightness %, saturation % as the GIMP dialog reads them,
#         and THE UNTONED HASH - the prep's own output for that set). The hash is
#         what makes this SAFE TO RE-RUN: toning an already-toned map would shift
#         the hue twice and nothing downstream would notice, so the tool only acts
#         when the manifest still names the prep's file, and says so otherwise.
TONE = { 'forestAir': (13.2, 0.0, 0.6, 'c019a81f') }

def hue_sat(im, hue, light, sat):
    px, (w, h) = im.load(), im.size
    for y in range(h):
        for x in range(w):
            r, g, b = [v / 255.0 for v in px[x, y]]
            hh, ll, ss = colorsys.rgb_to_hls(r, g, b)
            hh = (hh + hue / 360.0) % 1.0
            ll = ll * (1.0 + light / 100.0) if light < 0 else ll + (1.0 - ll) * (light / 100.0)
            ss = ss * (1.0 + sat / 100.0) if sat < 0 else ss + (1.0 - ss) * (sat / 100.0)
            r2, g2, b2 = colorsys.hls_to_rgb(hh, min(1.0, max(0.0, ll)), min(1.0, max(0.0, ss)))
            px[x, y] = (int(round(r2 * 255)), int(round(g2 * 255)), int(round(b2 * 255)))
    return im

def linear_mean(im):
    def lin(v):
        v /= 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    px, (w, h) = im.load(), im.size
    acc, n = [0.0, 0.0, 0.0], 0
    for y in range(0, h, 4):
        for x in range(0, w, 4):
            c = px[x, y]
            for i in range(3):
                acc[i] += lin(c[i])
            n += 1
    return [round(a / n, 4) for a in acc]

def main(write):
    import json, subprocess
    from PIL import Image
    text = io.open(MANIFEST, encoding='utf-8').read()
    table = json.load(io.open(SETS, encoding='utf-8'))
    changed = False
    for key, (hue, light, sat, untoned) in TONE.items():
        m = re.search(r'\n    %s: \{"diff":"(media/tex/ground/%s_diff_512\.[0-9a-f]{8}\.jpg)"' % (key, key), text)
        if not m:
            print('%s: not in the manifest' % key); continue
        rel = m.group(1)
        if untoned not in rel:
            print("%s: the manifest names %s, not the import's %s - already toned, nothing to do"
                  % (key, rel.split('.')[-2], untoned))
            continue
        src = os.path.join(ROOT, *rel.split('/'))
        im = hue_sat(Image.open(src).convert('RGB'), hue, light, sat)
        buf = io.BytesIO(); im.save(buf, 'JPEG', quality=92); data = buf.getvalue()
        h8 = hashlib.sha256(data).hexdigest()[:8]
        out = 'media/tex/ground/%s_diff_512.%s.jpg' % (key, h8)
        mean = linear_mean(im)
        print('%s: hue %+.1f light %+.1f sat %+.1f -> %s, mean %s' % (key, hue, light, sat, out, mean))
        if not write:
            continue
        io.open(os.path.join(ROOT, *out.split('/')), 'wb').write(data)
        text = text.replace(rel, out)
        for a in table['libs']['splat']:
            if a['set'] == key:
                a['mean'] = mean
        keep = table['sets'][key].setdefault('keep', [])
        if 'diff' not in keep:
            keep.append('diff')
        changed = True
    if write and changed:
        io.open(MANIFEST, 'w', encoding='utf-8', newline='\n').write(text)
        io.open(SETS, 'w', encoding='utf-8', newline='\n').write(json.dumps(table, indent=1))
        print('manifest and table patched; re-baking (the layers re-cook from the toned file, the untoned is pruned)')
        subprocess.check_call(['node', os.path.join(ROOT, 'tools', 'ground_tex_prep.js')])
        print('run node tools/build.js')

if __name__ == '__main__':
    main('--write' in sys.argv)
