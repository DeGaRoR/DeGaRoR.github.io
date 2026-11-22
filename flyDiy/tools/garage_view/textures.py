#!/usr/bin/env python3
"""GARAGE-VIEW, step 4b: the scene's pictures into what the page downloads.

  python tools/garage_view/textures.py --scene <cook's out dir> [--max 4096] [--q 86]

cook.js writes PNG (no dependency in node). Here every picture scene.json names is re-encoded - an opaque one as JPEG, one
with a cut-out (the trees' cards, the far band) as WebP with its alpha, the normals as lossless WebP - sized down to --max
on its long side, and scene.json is rewritten to name the new files (the PNGs are removed). Needs Pillow.
"""
import argparse, json, os
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
ap = argparse.ArgumentParser()
ap.add_argument('--scene', required=True)
ap.add_argument('--max', type=int, default=4096)
ap.add_argument('--q', type=int, default=86)
A = ap.parse_args()
jf = os.path.join(A.scene, 'scene.json')
J = json.load(open(jf, encoding='utf-8'))
tot0 = tot1 = 0
for key, T in J['textures'].items():
    src = os.path.join(A.scene, T['file'])
    if not T['file'].lower().endswith('.png') or not os.path.exists(src):
        continue
    im = Image.open(src)
    tot0 += os.path.getsize(src)
    # the long side is the texture's own; only the ground pictures shrink to --max (the atlases keep their tiles whole)
    if max(im.size) > A.max and key.startswith('ground'):
        k = A.max / max(im.size)
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    stem = os.path.splitext(T['file'])[0]
    cut = key in ('trees_col', 'far')            # the alpha is a cut-out the draw tests
    if key == 'trees_nrm':
        out = stem + '.webp'; im.convert('RGB').save(os.path.join(A.scene, out), 'WEBP', lossless=True, method=4)
    elif cut:
        out = stem + '.webp'; im.convert('RGBA').save(os.path.join(A.scene, out), 'WEBP', quality=90, alpha_quality=100, method=4, exact=True)
    else:
        out = stem + '.jpg'; im.convert('RGB').save(os.path.join(A.scene, out), 'JPEG', quality=A.q, optimize=True, subsampling=1)
    T['file'] = out; T['size'] = list(im.size)
    tot1 += os.path.getsize(os.path.join(A.scene, out))
    os.remove(src)
    print('  %-22s %5d x %-5d -> %s  %.2f MB' % (key, im.width, im.height, out, os.path.getsize(os.path.join(A.scene, out)) / 1048576))
json.dump(J, open(jf, 'w', encoding='utf-8'))
print('textures: %.1f MB of PNG -> %.2f MB; GPU memory with mips about %.0f MB' % (tot0 / 1048576, tot1 / 1048576, sum(t.get('size', [0, 0])[0] * t.get('size', [0, 0])[1] * 4 * 1.33 for t in J['textures'].values()) / 1048576))
