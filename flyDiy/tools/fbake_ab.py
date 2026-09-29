#!/usr/bin/env python
# fbake_ab.py - the flown bake's A/B, read (C4a, G870): the side-by-sides, the shimmer numbers, the orbit GIFs.
# Reads tools/fbake_ab.js's folder. Per view: <view>_ab.jpg (A live | B baked, the full frame over the aeroplane's
# crop at 2x), and for the orbit views the SHIMMER: the mean |difference| of consecutive frames' luminance inside the
# aeroplane's box (0-255), and the same on the frame's high-pass (the frame less its 3x3 blur - what a sub-pixel move
# should NOT change when the surface is prefiltered), A against B; <view>_seq.gif (A | B, the crop at 2x, nearest).
# Usage: python tools/fbake_ab.py <dir> [--jpg-out <dir>]
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

D = sys.argv[1]
JO = sys.argv[sys.argv.index('--jpg-out') + 1] if '--jpg-out' in sys.argv else D
info = json.load(open(os.path.join(D, 'ab.json')))
# (G805) a rig may name its two sides in ab.json (parked_ab.js: A the live capture, B the cook); the flown bake's by default
LA, LB = info.get('labels') or ['A live shader', 'B baked']
res = {}
def lum(im): a = np.asarray(im.convert('RGB'), dtype=np.float32); return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
def hp(im): return lum(im) - lum(im.filter(ImageFilter.BoxBlur(1)))
def label(im, t):
    d = ImageDraw.Draw(im); d.rectangle([0, 0, 8 * len(t) + 10, 22], fill=(0, 0, 0)); d.text((5, 5), t, fill=(255, 255, 255)); return im
for k, v in info['views'].items():
    A, B = Image.open(os.path.join(D, k + '_A.png')).convert('RGB'), Image.open(os.path.join(D, k + '_B.png')).convert('RGB')
    x0, y0, x1, y1 = v['box']
    pad = 12; x0, y0, x1, y1 = max(0, x0 - pad), max(0, y0 - pad), min(A.width, x1 + pad), min(A.height, y1 + pad)
    cw, ch = x1 - x0, y1 - y0
    # the crop at most 780 px wide per side, at 2x where it fits (nearest: the pixels as they are)
    z = max(1, min(2, 780 // max(1, cw)))
    ca, cb = A.crop((x0, y0, x1, y1)), B.crop((x0, y0, x1, y1))
    if z > 1: ca, cb = ca.resize((cw * z, ch * z), Image.NEAREST), cb.resize((cw * z, ch * z), Image.NEAREST)
    W = A.width // 2
    fa, fb = A.resize((W, A.height // 2), Image.LANCZOS), B.resize((W, B.height // 2), Image.LANCZOS)
    out = Image.new('RGB', (2 * max(W, ca.width), fa.height + ca.height), (20, 20, 20))
    out.paste(label(fa, LA), (0, 0)); out.paste(label(fb, LB), (max(W, ca.width), 0))
    out.paste(ca, (0, fa.height)); out.paste(cb, (max(W, ca.width), fa.height))
    out.save(os.path.join(JO, k + '_ab.jpg'), quality=88)
    # THE MASK: the aeroplane's pixels (A against the frame without it), eroded 3 px - its INTERIOR, where a surface's
    # shading is all that changes (the silhouette's edges are geometry: the same in A and B, MSAA's job)
    bgp = os.path.join(D, k + '_bg.png')
    if os.path.exists(bgp):
        bg = Image.open(bgp).convert('RGB')
        m = (np.abs(lum(A) - lum(bg)) > 6).astype(np.uint8) * 255
        m = np.asarray(Image.fromarray(m).filter(ImageFilter.MinFilter(7))) > 0
    else: m = np.ones(lum(A).shape, bool)
    mk = m[y0:y1, x0:x1]
    r = {'box': v['box'], 'maskPx': int(mk.sum()), 'diffAB': float(np.abs(lum(A) - lum(B))[y0:y1, x0:x1][mk].mean()) if mk.any() else None}
    if v.get('seq'):
        n = v['seq']
        seq = {s: [Image.open(os.path.join(D, '%s_seq_%s_%02d.png' % (k, s, i))).convert('RGB') for i in range(n)] for s in 'AB'}
        for s in 'AB':
            L = [lum(im)[y0:y1, x0:x1] for im in seq[s]]; H = [hp(im)[y0:y1, x0:x1] for im in seq[s]]
            r['shimmer' + s] = float(np.mean([np.abs(L[i + 1] - L[i])[mk].mean() for i in range(n - 1)]))
            r['shimmerHP' + s] = float(np.mean([np.abs(H[i + 1] - H[i])[mk].mean() for i in range(n - 1)]))
            r['hpEnergy' + s] = float(np.mean([np.abs(h)[mk].mean() for h in H]))
            # the per-pixel temporal spread over the sequence: a stable surface under a 0.6 px move changes little
            r['tstd' + s] = float(np.std(np.stack(L), axis=0)[mk].mean())
        r['shimmerCut'] = round(1 - r['shimmerB'] / max(1e-9, r['shimmerA']), 3)
        r['shimmerHPCut'] = round(1 - r['shimmerHPB'] / max(1e-9, r['shimmerHPA']), 3)
        r['tstdCut'] = round(1 - r['tstdB'] / max(1e-9, r['tstdA']), 3)
        # the GIF: A | B, the crop at 2x (at most 900 px wide in all)
        z2 = max(1, min(3, 450 // max(1, cw)))
        fr = []
        for i in range(n):
            a = seq['A'][i].crop((x0, y0, x1, y1)).resize((cw * z2, ch * z2), Image.NEAREST)
            b = seq['B'][i].crop((x0, y0, x1, y1)).resize((cw * z2, ch * z2), Image.NEAREST)
            g = Image.new('RGB', (2 * a.width + 6, a.height), (20, 20, 20)); g.paste(label(a, ' '.join(LA.split(' ')[:2])), (0, 0)); g.paste(label(b, LB), (a.width + 6, 0))
            fr.append(g.convert('P', palette=Image.ADAPTIVE, colors=255))
        fr += fr[-2:0:-1]   # there and back
        fr[0].save(os.path.join(JO, k + '_seq.gif'), save_all=True, append_images=fr[1:], duration=90, loop=0)
    res[k] = r
    print(k, json.dumps(r))
json.dump(res, open(os.path.join(D, 'ab_read.json'), 'w'), indent=1)
