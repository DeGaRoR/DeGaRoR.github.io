#!/usr/bin/env python3
"""splat_tex_tone.py - THE HAND TONE ON A GROUND SET'S COLOUR MAP (2026-09-23).

The user tuned the forest floor in GIMP (Hue-Saturation, Master) and asked for
that transformation, not an approximation of it: Hue +13.2, Saturation +0.6,
Lightness left to the shader's grade (the slider's own lightness turned out to
mean something different from a multiply, and -60.4 came out far too dark).

WHY THIS FILE EXISTS. media/tex/splat is CONTENT-ADDRESSED: a file's name is
the first eight hex of the sha256 of its bytes, and tools/splat_tex_prep.js
rebuilds every one of them from assets/splat/<key>/. A tone applied by hand to
the shipped file would therefore be LOST, silently, the next time anyone ran
the prep - the manifest would go back to the untoned hash and nobody would know
why the ground changed. Re-run this after a prep, or fold it into the import.

    py -3.11 tools/splat_tex_tone.py                 # report what it would do
    py -3.11 tools/splat_tex_tone.py --write         # tone, rename by hash, patch the manifest

The transform is GIMP 2.10's gimp:hue-saturation in HSL over the sRGB values.
The MEAN in the manifest is re-measured here, because the grading chain reads
it: the macro tint's `rel`, the uSLum pivot the grass mask uses, and the tuft
colour a blade takes at its foot all come off that number.
"""
import colorsys, hashlib, io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, 'src', 'viewer', 'splat_tex.js')
STORE = os.path.join(ROOT, 'media', 'tex', 'splat')

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
    from PIL import Image
    text = io.open(MANIFEST, encoding='utf-8').read()
    for key, (hue, light, sat, untoned) in TONE.items():
        m = re.search(r"key: '%s'.*?get diff\(\) \{ return mk\('(media/tex/splat/%s_diff_512\.[0-9a-f]{8}\.jpg)'\)" % (key, key), text, re.S)
        if not m:
            print('%s: not in the manifest' % key); continue
        rel = m.group(1)
        if untoned not in rel:
            print("%s: the manifest names %s, not the prep's %s - already toned, nothing to do"
                  % (key, rel.split('.')[-2], untoned))
            continue
        src = os.path.join(ROOT, *rel.split('/'))
        im = hue_sat(Image.open(src).convert('RGB'), hue, light, sat)
        buf = io.BytesIO(); im.save(buf, 'JPEG', quality=92); data = buf.getvalue()
        h8 = hashlib.sha256(data).hexdigest()[:8]
        out = 'media/tex/splat/%s_diff_512.%s.jpg' % (key, h8)
        mean = linear_mean(im)
        print('%s: hue %+.1f light %+.1f sat %+.1f -> %s, mean %s' % (key, hue, light, sat, out, mean))
        if not write:
            continue
        if out == rel:
            print('  (already toned - the bytes are these)'); continue
        io.open(os.path.join(ROOT, *out.split('/')), 'wb').write(data)
        text = text.replace(rel, out)
        text = re.sub(r"(key: '%s', metres: [0-9.]+, px: 512, mean: )\[[^\]]*\]" % key,
                      lambda mm: mm.group(1) + '[' + ','.join(str(v) for v in mean) + ']', text)
        if os.path.exists(src):
            os.remove(src)
            print('  the untoned file is pruned - the store holds only what the manifest names')
    if write:
        io.open(MANIFEST, 'w', encoding='utf-8', newline='\n').write(text)
        print('manifest patched; run node tools/build.js')

if __name__ == '__main__':
    main('--write' in sys.argv)
