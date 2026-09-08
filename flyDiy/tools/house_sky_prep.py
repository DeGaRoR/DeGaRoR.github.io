#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""house_sky_prep.py - a real captured sky for the house bench (the user:
"give this an hdr for lighting and reflections please", with
grasslands_sunset_2k.hdr attached).

WHY A CAPTURED SKY AND NOT ONE MORE PAINTED GRADIENT. The bench already had
four procedural moods, and they were enough to judge a silhouette by. They are
not enough to judge a MATERIAL by: a painted dome has no cloud edges, no bright
band along the horizon and no dark ground behind you, so a rough plank gets a
smear where it should get structure and a metal roof reflects one flat colour
where it should catch the difference between the sky and the field. Reflections
are the whole reason the library was scanned. So the dome becomes a photograph.

SOURCE: assets/house_sky/*.hdr - Poly Haven CC0 Radiance equirects, untracked
like every other raw asset. TWO THINGS come out of each one, and the split is
the same one tools/sky_prep.py makes for the hangar, for the same reason:

  1. THE ENVIRONMENT (RGBE PNG, 512x256). Lighting and reflections, kept in
     FLOAT: this is what PMREM integrates into an irradiance dome and a
     roughness chain, and it is the only part that has to stay linear and
     unclipped - a tone-mapped backdrop would light the house with its own
     shoulder baked in. RGBE is four bytes a pixel, lossless through PNG, and
     the browser decodes it with a canvas and eight lines of arithmetic; no
     loader, no vendored parser, no float texture upload.
     512x256 is deliberate: PMREM blurs everything above mirror-sharp anyway,
     and the house's glass now runs at roughness 0.4 (the user asked for it),
     so nothing on the model can resolve more than this.

  2. THE BACKDROP (JPEG, 2048x1024). What you actually see behind the house,
     tone-mapped ONCE, here - the renderer tone-maps on the way to the screen
     and two shoulders read as fog, which is the lesson sky_prep already paid
     for.

AND A MEASURED RIG. Where the sun is, what colour it is, and what share of the
light arrives from it rather than from the whole dome - integrated over the
sphere in the float data, before any curve throws that away. The bench points
its shadow-casting light down the measured vector, so the shadow on the grass
and the highlight on the roof agree with the photograph behind them. Without
that the model floats: env light from one sky, shadows from another.

THE ONE NORMALISATION. Poly Haven does not calibrate to a common scale, so the
dome is scaled to a fixed mean luminance (MEAN_TARGET) before anything is
written. That makes the bench's exposure dial mean the same thing on every sky
and on the four painted moods, and it is the only value here that is not
measured.

Run:   python tools/house_sky_prep.py        (then node tools/house_tex_prep.js)
"""
import io
import json
import math
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sky_prep import read_hdr                       # noqa: E402  (same reader)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'house_sky')
OUT = os.path.join(ROOT, 'assets', 'house_sky', 'out')
ENV_W, BG_W = 512, 2048
MEAN_TARGET = 0.42                       # the painted moods' own mean, near
EV_ANCHOR = 1.40                         # downward radiance -> exposure 1
LUM = np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)

# key -> the label the bench shows. A file with no row here still builds; it
# is listed under its own stem.
NAMES = {'grassland': 'grassland sunset'}


def dirs_of(H, W):
    """the bench's own equirect convention, so a measured sun vector can be
    handed straight to the light: u runs phi = -pi .. pi, v runs zenith down,
    dir = (sin0 sin0, cos0, sin0 cos0)"""
    th = (np.arange(H, dtype=np.float32) + 0.5) / H * math.pi
    ph = (np.arange(W, dtype=np.float32) + 0.5) / W * 2 * math.pi - math.pi
    st, ct = np.sin(th)[:, None], np.cos(th)[:, None]
    return (np.stack([st * np.sin(ph)[None, :],
                      np.broadcast_to(ct, (H, W)),
                      st * np.cos(ph)[None, :]], -1),
            np.broadcast_to(st, (H, W)).copy())


def box_down(img, w):
    """area average in LINEAR light - a PIL resize on floats is fine, but the
    sun disc must not be resampled away, and an integer box keeps its energy"""
    H, W, _ = img.shape
    h = w // 2
    fy, fx = H // h, W // w
    return img[:h * fy, :w * fx].reshape(h, fy, w, fx, 3).mean((1, 3))


def rgbe(img):
    """float32 HxWx3 -> uint8 HxWx4 Radiance RGBE"""
    m = img.max(2)
    e = np.zeros_like(m)
    nz = m > 1e-9
    e[nz] = np.floor(np.log2(m[nz])) + 1.0
    scale = np.where(nz, 256.0 / np.exp2(np.clip(e, -127, 127)), 0.0)
    out = np.zeros(img.shape[:2] + (4,), dtype=np.uint8)
    out[:, :, :3] = np.clip(img * scale[:, :, None], 0, 255).astype(np.uint8)
    out[:, :, 3] = np.clip(np.where(nz, e + 128.0, 0.0), 0, 255).astype(np.uint8)
    return out


def srgb(x):
    x = np.clip(x, 0.0, 1.0)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * x ** (1 / 2.4) - 0.055)


def measure(img):
    """integrate the sphere: where the sun is, what colour it is, and how much
    of the light is IT rather than the dome"""
    H, W, _ = img.shape
    d, sinth = dirs_of(H, W)
    lum = img @ LUM
    w = sinth
    tot = float((lum * w).sum())
    # THE SUN IS WHAT IS FAR BRIGHTER THAN THE SKY AROUND IT, and on a veiled
    # sunset there may be no disc at all - so the threshold is a quantile of
    # the sky's own distribution, not an absolute.
    hi = float(np.quantile(lum, 0.9995))
    mask = lum >= max(hi, float(np.median(lum)) * 12.0)
    sunW = (lum * w)[mask]
    sunLux = float(sunW.sum())
    direct = sunLux / max(tot, 1e-6)
    if mask.sum() > 0 and sunLux > 0:
        v = (d[mask] * sunW[:, None]).sum(0) / sunLux
        n = float(np.linalg.norm(v))
        sdir = (v / n).tolist() if n > 1e-6 else [0.3, 0.5, 0.8]
        c = img[mask].mean(0)
    else:
        sdir, c = [0.3, 0.5, 0.8], img.reshape(-1, 3).mean(0)
    c = c / max(float(c.max()), 1e-6)
    up = d[:, :, 1] > 0
    band = np.abs(d[:, :, 1]) < 0.18
    # HOW MUCH LIGHT ACTUALLY FALLS ON THE ROOF: the cosine-weighted mean of
    # the upper hemisphere, which IS the irradiance on a horizontal surface
    # over pi. The sphere mean cannot stand in for it - a sky with a black
    # ground and one with a snowfield have the same mean and light a house
    # completely differently - and it is what the bench's exposure has to be
    # anchored on. EV_ANCHOR is the one authored number here, in the same
    # spirit as sky_prep's `level`: how much downward radiance puts a building
    # where the four painted moods put it.
    cw = np.where(up, np.clip(d[:, :, 1], 0, 1) * sinth, 0.0)
    up_irr = float((lum * cw).sum() / cw.sum())
    return {
        'upIrr': round(up_irr, 4),
        'ev': round(min(3.0, max(0.8, EV_ANCHOR / max(up_irr, 1e-6))), 3),
        'sun': [round(float(x), 4) for x in sdir],
        'sunCol': [round(float(x), 3) for x in c],
        'direct': round(direct, 4),
        'hor': [round(float(x), 3) for x in img[band].mean(0)],
        'gnd': [round(float(x), 3) for x in img[~up].mean(0)],
        'zen': [round(float(x), 3) for x in img[:H // 12].reshape(-1, 3).mean(0)],
    }


def main():
    if not os.path.isdir(SRC):
        raise SystemExit('no %s - drop the .hdr files there' % SRC)
    os.makedirs(OUT, exist_ok=True)
    rows = {}
    for f in sorted(os.listdir(SRC)):
        if not f.lower().endswith('.hdr'):
            continue
        key = os.path.splitext(f)[0]
        img = read_hdr(os.path.join(SRC, f))
        H, W, _ = img.shape
        _, sinth = dirs_of(H, W)
        mean = float(((img @ LUM) * sinth).sum() / sinth.sum())
        img = img * (MEAN_TARGET / max(mean, 1e-6))
        rig = measure(img)

        env = box_down(img, ENV_W)
        Image.fromarray(rgbe(env), 'RGBA').save(
            os.path.join(OUT, key + '_env.png'), optimize=True)
        # the backdrop: one straight exposure into sRGB, no shoulder - the
        # renderer's ACES is the only tone curve allowed to touch this
        bg = box_down(img, BG_W) if W > BG_W else img
        k = 0.92 / max(float(np.quantile(bg @ LUM, 0.995)), 1e-6)
        Image.fromarray((srgb(bg * k) * 255 + 0.5).astype(np.uint8), 'RGB').save(
            os.path.join(OUT, key + '_bg.jpg'), 'JPEG', quality=90,
            subsampling=0, optimize=True)

        rows[key] = dict(rig, name=NAMES.get(key, key.replace('_', ' ')),
                         w=ENV_W, h=ENV_W // 2, scale=round(MEAN_TARGET / mean, 5))
        print('%-12s %dx%d  sun %6.2f %5.2f %6.2f  direct %.3f  '
              'colour %.2f/%.2f/%.2f  x%.3f  down %.2f ev %.2f'
              % (key, W, H, rig['sun'][0], rig['sun'][1], rig['sun'][2],
                 rig['direct'], rig['sunCol'][0], rig['sunCol'][1],
                 rig['sunCol'][2], MEAN_TARGET / mean, rig['upIrr'],
                 rig['ev']))
    with io.open(os.path.join(OUT, '_skies.json'), 'w', encoding='utf-8',
                 newline='') as fh:
        fh.write(json.dumps(rows, indent=1, sort_keys=True))
    print('%d sk%s -> assets/house_sky/out/ (bake: node tools/house_tex_prep.js)'
          % (len(rows), 'y' if len(rows) == 1 else 'ies'))


if __name__ == '__main__':
    main()
