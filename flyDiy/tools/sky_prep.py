#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""sky_prep.py - turns the hangar's HDRI skies into what the game can use.

SOURCE: assets/hangar_sky/<key>.hdr - Poly Haven CC0 4k equirects. One alpine
field (the sky the shed was built against) and four Kloppenheim times of day
shot from the same spot: noon, an afternoon under cloud, sunset, and night.

Two things come out of each one, and the split is the whole point:

  1. A DISPLAY IMAGE (assets/hangar_sky/<key>.jpg). The backdrop sphere is a
     MeshBasicMaterial and the browser reads no Radiance, so the HDR is
     tone-mapped once, here. The curve is a straight exposure into sRGB, which
     is what the existing hand-made alps_field.jpg turns out to be (fitted:
     mean abs error 0.024, against 0.035 for an ACES shoulder) - and it is the
     right choice anyway, because the renderer tone-maps the backdrop a SECOND
     time on the way to the screen and two shoulders read as fog.

  2. A MEASURED LIGHT RIG (assets/hangar_sky/skies.json). Where the sun is,
     what colour it is, what colour the sky and the ground bounce are, and how
     DIRECTIONAL the light is - all integrated over the sphere in the float
     data, before any tone curve has thrown that information away.

WHAT IS MEASURED AND WHAT IS AUTHORED, AND WHY THE LINE IS THERE. Poly Haven
does not calibrate its HDRIs to a common absolute scale: this set's mean
radiance runs 0.79 / 0.81 / 0.49 / 0.50 / 0.32 for a noon, an overcast, a
sunset and a NIGHT, which is not a day. So absolute radiance ratios cannot
carry the day cycle and this tool does not pretend they can. What survives an
arbitrary per-file normalisation is everything SHAPED:

    direct = sunLux / (sunLux + skyLux)

- the share of the light arriving from the sun rather than from the whole
dome. That number is scale-invariant and it is the one that matters to a room:
0.80 for the alpine sun, 0.46 under cloud, 0.005 for a veiled sunset with no
disc left, 0.69 for a hard little moon. It sets how much of the rig is the
shadow-casting key and how much is the ambient dome. Direction and colour are
scale-invariant too, and are likewise measured.

The one number that is AUTHORED is `level`: how much light this sky delivers
into the shed, anchored at 1.00 for the alps. That is a day cycle, and with
uncalibrated sources it has to be a decision. It is one number per row, in the
table below, where it can be argued with.

THE ANCHOR. The alps field, at AFTERNOON, is the look the shed was tuned for
and the user asked to keep it. The rig multiplies into the numbers hangar.js
already carried (RIG0, lifted verbatim from the old MOODS[0] row), scaled by
`level` and by the directness ratio against the alps' own directness - so the
anchor row reproduces itself exactly, by construction, and every other sky is
that same room under a measurably different one.

Run after adding or replacing an HDR:  python tools/sky_prep.py
Then bake the payload:                 node tools/sky_tex_prep.js
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image

import sky_grade

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SKY = os.path.join(ROOT, 'assets', 'hangar_sky')

ANCHOR = 'alps'

# --------------------------------------------------------------- THE TABLE
# ONE panorama, graded into every hour (user, 2026-08-29: "we can officially
# retire the previous 5 HDRI's, and keep only the alps"). It began as a test
# area beside a five-HDRI set; it won, and it is now the only set there is.
# What decided it: the grade runs on the GPU from a single base picture plus a
# gain map, so a whole day costs 5.98 MB at 8k against 6.1 MB for six baked 4k
# pictures — and a seventh hour costs one row rather than another panorama.
#
# The old note, kept because it is still the argument for the shape: the
# alps field's own radiance, graded into other hours by tools/sky_grade.py
# (user 2026-08-29: "alter the alps HDRI to fit the sunset and night moods ...
# I know it is hacky, but I prefer it, and would love to package only one").
#
# THE COLUMNS. `grade` is the recipe name in tools/sky_grade.py. `level` is how
# much light this hour puts into the shed. `lamp`, `ex` and `shaft` are room
# decisions (candela, renderer exposure, dust-shaft opacity). `sunOff` is how
# far off the door axis the sun should stand, in degrees, and the backdrop
# sphere's yaw is SOLVED from it and the measured sun. `kc`/`card` are colour
# overrides and only the alps row carries them, because the shed has always
# been lit warm against a sun that measures white.
#
# `mean` is None on most rows ON PURPOSE: the grade sets the level in RADIANCE
# and one shared exposure (the anchor's) is what makes five pictures one day.
# NIGHT is the exception and has to be, for the same reason the shipping set
# needed one: at a true linear night the picture is a black rectangle. Its
# `mean` lifts the DISPLAY only - the light rig is still measured off the
# graded radiance, and `level` sets the room independently.
SKIES = [
    # key      name        grade      level  mean  lamp   ex   shaft sunOff  kc        card
    ('alps',    'AFTERNOON', 'as-is',   1.00, None,  70, 0.92, 0.055, 126, 0xffdca8, 0xf2ecdc),
    # ...and the graded rows turn the sphere so the door LOOKS AT the hour.
    # The whole point of grading is the warm quarter of sky, and at the alps'
    # own 126 deg that quarter is behind the shed: the first run through the
    # room gave a grey valley out of a doorway that was supposed to be a
    # sunset. Same panorama, different quarter of it - which is free, because
    # this one is mountains the whole way round.
    ('ggolden', 'GOLDEN',    'golden',  0.62, None, 110, 0.90, 0.100,  126, None,     None),
    ('gsunset', 'SUNSET',    'sunset',  0.42, None, 140, 0.92, 0.075,  126, None,     None),
    ('gdusk',   'DUSK',      'dusk',    0.20, None, 170, 0.98, 0.045,  126, None,     None),
    ('gnight',  'NIGHT',     'night',   0.07, 0.085, 190, 1.02, 0.030, 126, None,     None),
    ('gcovered', 'OVERCAST', 'covered', 0.72, None, 120, 0.98, 0.035,  126, None,     None),
]
# THE LAB RUNS OFF THE 8k (user, 2026-08-29). The backdrop is the one thing
# you look at through a 31 m door and 4k was measurably under 1:1 there: at a
# 1920 viewport the opening spans about 50 deg of azimuth and ~770 screen
# pixels, and 4096 px per 360 deg only puts 570 of them across it. 8k puts
# 1140. With the runtime grade this is ONE picture, so it is the only place in
# the whole set that pays for the resolution.
SKY_SRC = 'alps_field_8k.hdr'
# ...but the ROWS are graded and measured at half of it. The integrals are the
# same to four decimals at 4k, the preview JPEGs are a reference and not the
# payload, and grading 33 million pixels six times over costs minutes and
# gigabytes for nothing. Only `base` and `gain` — the two the shader actually
# samples — are written at full resolution.
SKY_MEASURE_MAX = 4096

# the alps/AFTERNOON rig exactly as hangar.js authored it (the old MOODS[0]).
# The measured ratios multiply into these, so the anchor reproduces itself.
# ENV CARRIES THE INDIRECT NOW (G62.5). hemi/top/win are gone from the room, so
# the environment is the only thing left modelling anything that is not the sun
# or a lamp - and 0.55 was tuned as a SUPPLEMENT to three other fills. Measured
# against them, x2.2 puts the room back where it was and better: mean 75.2 with
# 3.8% of the frame crushed, against 64.4 and 14.5% for the six-source rig.
# `hemi` and `top` stay in this table because they are still MEASUREMENTS of
# the sky's shape, and the directness ratio is derived from them; the room just
# no longer has a light to apply them to.
RIG0 = {'key': 2.8, 'hemi': 0.30, 'top': 0.46, 'env': 1.21}
# ...and the COLOURS those intensities were authored against. A light's colour
# carries luminance: hand a lamp the measured sky chroma instead of the hand-
# picked one and the room gets brighter without anybody changing an intensity,
# which would quietly break the anchor. Every intensity below is divided by the
# luminance of the colour it ends up with and multiplied by the luminance of
# the colour it was authored with, so intensity x colour is what is preserved.
# That is also why the orange sunset key comes out stronger than its level
# alone would say: an orange lamp delivers less light per unit of intensity.
COL0 = {'key': 0xffdca8, 'hemi': 0xbfd2e6, 'top': 0xe6eef8, 'gnd': 0x3a3128}

# THE GROUND BOUNCE IS OCCLUDED. Integrated off the HDR, the lower hemisphere
# returns about a third of the sky's irradiance - which is right for something
# standing in that field, and wrong for something standing on a concrete floor
# inside a shed with one wall open. The old hand-picked ground colour encoded
# that occlusion at about a sixth of it. So the SHARE and the COLOUR stay
# measured, per sky, and the absolute level is anchored to what the room
# already used - the same discipline as every other number here.

# HOW THE KEY FOLLOWS THE DIRECTNESS. A sky with no disc left in it (the
# veiled sunset) still has a bright quarter of horizon, and a key of zero
# would flatten the aeroplane completely - so a quarter of the key is carried
# by `level` alone and three quarters by how directional the sky measures.
KEY_AMBIENT = 0.25
KEY_FLOOR = 0.06          # a key of exactly 0 loses the shadow direction too
# AN ALL-DOME SKY IS NOT ALLOWED TO OUT-GLOW A SUNNY ONE. The veiled sunset
# measures as pure ambient, and uncapped that put more fill in the shed at dusk
# than the alpine afternoon delivered - visible as an apron outside the door
# reading brighter than the sky above it. Twice the anchor's ambient is as far
# as a sky's SHAPE may push it; past that, only `level` speaks.
HEMI_CAP = 2.0

# the background/fog colour: the horizon's own measured chroma, taken down to
# an INTERIOR darkness. BG_MAX is a DISPLAY level (the fog colour is a hex the
# eye reads, not a radiance), set so the anchor lands beside the 0x14120f the
# room already used.
BG_MAX = 0.082
BG_GAMMA = 0.30

# the glazing panels' glow: how bright the sky reads THROUGH A WINDOW, which is
# the upper hemisphere of the display image, against the anchor's. A bright
# overcast dome glows more than a blue sky with a sun in it, and this measures
# that rather than guessing it.
PANEL0 = 2.6
PANEL_CAP = 4.2

OUT_W = 4096              # display equirect width; the sources are 4k
JPEG_Q = 82               # what the existing alps_field.jpg was made at
JPEG_SUB = 2              # 4:2:0, ditto


# ------------------------------------------------------- radiance .hdr read
def read_hdr(path):
    """Radiance RGBE -> float32 HxWx3, linear. Handles the new-RLE and the
    flat scanline forms; that is everything Poly Haven ships."""
    with open(path, 'rb') as f:
        data = f.read()
    i = 0
    while True:                                  # header lines, then a blank
        j = data.index(b'\n', i)
        line = data[i:j]
        i = j + 1
        if line.strip() == b'':
            break
    j = data.index(b'\n', i)                     # resolution line
    res = data[i:j].split()
    i = j + 1
    if len(res) != 4 or res[0] != b'-Y' or res[2] != b'+X':
        raise ValueError('unsupported HDR orientation %r' % (res,))
    H, W = int(res[1]), int(res[3])

    raw = np.frombuffer(data, dtype=np.uint8, offset=i)
    rgbe = np.empty((H, W, 4), dtype=np.uint8)
    p = 0
    for y in range(H):
        if W < 8 or W > 32767 or raw[p] != 2 or raw[p + 1] != 2 or \
           ((int(raw[p + 2]) << 8) | int(raw[p + 3])) != W:
            rgbe[y] = raw[p:p + W * 4].reshape(W, 4)      # flat scanline
            p += W * 4
            continue
        p += 4
        for c in range(4):                        # the four channels run apart
            x = 0
            while x < W:
                n = int(raw[p]); p += 1
                if n > 128:                       # a run
                    rgbe[y, x:x + n - 128, c] = raw[p]; p += 1
                    x += n - 128
                else:                             # a literal stretch
                    rgbe[y, x:x + n, c] = raw[p:p + n]; p += n
                    x += n
    e = rgbe[:, :, 3].astype(np.int32)
    scale = np.where(e > 0, np.ldexp(1.0, e - 136), 0.0).astype(np.float32)
    return rgbe[:, :, :3].astype(np.float32) * scale[:, :, None]


# ------------------------------------------------------------- measurements
LUM = np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)


def measure(img):
    """Integrate the sphere. Everything comes back in the equirect's own
    (u, v) frame: hangar.js applies the backdrop sphere's own orientation to
    the sun direction, so this file never has to know how the sphere is hung."""
    H, W, _ = img.shape
    v = (np.arange(H, dtype=np.float32) + 0.5) / H
    theta = v * math.pi                          # 0 = zenith
    cos_t = np.cos(theta)
    # a pixel's solid angle: dw = sin(theta) . dtheta . dphi
    dw = (np.sin(theta) * (math.pi / H) * (2 * math.pi / W)).astype(np.float32)

    lum = img @ LUM
    upper = np.where((cos_t > 0)[:, None], lum, 0.0)

    # THE SUN. Everything within a factor of the peak belongs to the same
    # disc. A threshold RELATIVE to the peak, not an absolute cd/m2, is what
    # lets one pass handle a hard noon sun and a hazy sunset - and what keeps
    # it working across sources that are not calibrated to each other.
    peak = float(upper.max())
    disc = upper > (peak * 0.30)
    sun_sr = float((disc * dw[:, None]).sum())
    # a genuinely sunless dome spreads its "peak" over steradians: call that no
    # sun rather than a two-steradian light source
    has_sun = bool(sun_sr < 0.15 and peak > 0)

    w = (disc * dw[:, None]).astype(np.float32)
    sun_e = (img * w[:, :, None]).sum(axis=(0, 1))
    wl = w * lum
    tot = float(wl.sum())
    if tot > 0:                                  # radiance-weighted centroid
        jj, ii = np.nonzero(disc)
        ww = wl[jj, ii]
        su = float((((ii + 0.5) / W) * ww).sum() / tot)
        sv = float((((jj + 0.5) / H) * ww).sum() / tot)
    else:
        jj, ii = np.unravel_index(int(np.argmax(upper)), upper.shape)
        su, sv = float((ii + 0.5) / W), float((jj + 0.5) / H)

    # the diffuse dome: upper hemisphere, cosine-weighted (irradiance on the
    # floor), with the disc taken out so it is not counted twice
    cw = (np.clip(cos_t, 0, None) * dw)[:, None] * (~disc)
    sky_e = (img * cw[:, :, None]).sum(axis=(0, 1))
    # the ground bounce: the same integral, flipped
    gw = (np.clip(-cos_t, 0, None) * dw)[:, None]
    gnd_e = (img * gw[:, :, None]).sum(axis=(0, 1))
    # the horizon band, for the fog and the background: where the world ends
    hor = img[int(H * 0.46):int(H * 0.56)].reshape(-1, 3).mean(axis=0)


    return {
        'sunUV': [round(su, 5), round(sv, 5)], 'hasSun': has_sun,
        'sunSr': sun_sr, 'peak': peak,
        'sunE': [float(x) for x in sun_e],
        'skyE': [float(x) for x in sky_e],
        'gndE': [float(x) for x in gnd_e],
        'horizon': [float(x) for x in hor],
        'meanLum': float((lum * dw[:, None]).sum() / (4 * math.pi)),
    }


# --------------------------------------------------------------- tone curve
def srgb(x):
    x = np.clip(x, 0.0, 1.0)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * x ** (1 / 2.4) - 0.055)


def solve_exposure(img, target_mean):
    lo, hi = 1e-4, 1e4
    for _ in range(40):
        mid = math.sqrt(lo * hi)
        if float(srgb(img * mid).mean()) < target_mean:
            lo = mid
        else:
            hi = mid
    return math.sqrt(lo * hi)


# --------------------------------------------------------------------- rig
def chroma(e):
    """A colour, normalised so the brightest channel is 1: intensity belongs
    to the light's intensity and is never smuggled into its colour."""
    m = max(e[0], e[1], e[2])
    return (1.0, 1.0, 1.0) if m <= 0 else (e[0] / m, e[1] / m, e[2] / m)


def to_hex(c):
    """A LINEAR colour -> the sRGB hex a THREE.Color literal wants."""
    return '0x%02x%02x%02x' % tuple(
        max(0, min(255, int(round(float(srgb(np.float32(x))) * 255)))) for x in c)


def dim_hex(c, level):
    """A linear chroma taken down to a DISPLAY level. The fog and background
    colours are hexes the eye reads, not radiances, so the level is applied
    after the sRGB encode - scaling in linear space and encoding afterwards
    lands three stops brighter than it looks like it should."""
    m = max(float(srgb(np.float32(x))) for x in c) or 1.0
    return '0x%02x%02x%02x' % tuple(
        max(0, min(255, int(round(float(srgb(np.float32(x))) / m * level * 255))))
        for x in c)


def lum_of(e):
    return float(e[0] * 0.2126 + e[1] * 0.7152 + e[2] * 0.0722)


def unsrgb(x):
    return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4


def hex_lum(h):
    """Luminance of an sRGB hex literal, in linear light."""
    return lum_of([unsrgb(((h >> s) & 255) / 255.0) for s in (16, 8, 0)])


def keep_level(i0, authored_hex, colour):
    """An intensity re-expressed for a different colour, so that
    intensity x colour - the light the room actually receives - is unchanged."""
    return i0 * hex_lum(authored_hex) / max(1e-6, lum_of(colour))


def main():
    table = SKIES
    outdir = SKY

    imgs, meas, srcs, refs = {}, {}, {}, {}
    base = base_uv = None
    base_peak = 0.0
    bp = os.path.join(SKY, SKY_SRC)
    if not os.path.exists(bp):
        sys.exit('missing source: %s' % bp)
    print('reading %-26s' % SKY_SRC, end=' ', flush=True)
    base_full = read_hdr(bp)
    # the grading/measuring copy, decimated if the source is bigger
    step = max(1, base_full.shape[1] // SKY_MEASURE_MAX)
    base = base_full[::step, ::step] if step > 1 else base_full
    bm = measure(base)
    base_uv, base_peak = bm['sunUV'], bm['peak']
    print('%dx%d (rows at %dx%d) -> grading %d rows off it'
          % (base_full.shape[1], base_full.shape[0],
             base.shape[1], base.shape[0], len(table)))
    for key, name, src, level, mean, lamp, ex, shaft, off, kc, card in table:
        if src not in sky_grade.GRADES:
            sys.exit('unknown grade: %s' % src)
        srcs[key] = '%s (graded: %s)' % (SKY_SRC, src)
        print('grading %-25s' % src, end=' ', flush=True)
        imgs[key] = sky_grade.grade(base, sky_grade.GRADES[src], base_uv)
        # the yardstick the glow and the stars were measured against, kept so
        # the shader can be handed absolute numbers (see uniforms())
        H0 = base.shape[0]
        e0 = np.cos(((np.arange(H0, dtype=np.float32) + 0.5) / H0) * math.pi)[:, None]
        refs[key] = sky_grade.sky_level(
            sky_grade.grade(base, dict(sky_grade.GRADES[src], glow=None,
                                       stars=None, exposure=1.0), base_uv), e0)
        meas[key] = measure(imgs[key])
        m = meas[key]
        print('%dx%d  peak %8.0f  mean %.4f  sun %s %.4f sr' %
              (imgs[key].shape[1], imgs[key].shape[0], m['peak'], m['meanLum'],
               'yes' if m['hasSun'] else ' no', m['sunSr']))

    a = meas[ANCHOR]
    a_direct = lum_of(a['sunE']) / max(1e-9, lum_of(a['sunE']) + lum_of(a['skyE']))
    gnd_k = hex_lum(COL0['gnd']) / max(1e-9, lum_of(chroma(a['skyE'])) *
                                       lum_of(a['gndE']) / lum_of(a['skyE']))
    print('\nanchor %s: directness %.3f, ground bounce x%.3f (occlusion)'
          % (ANCHOR, a_direct, gnd_k))

    rows, domes, anchor_k = [], {}, None
    print('\n%-9s %-9s %6s %6s | %5s %5s %5s %5s %5s | %-9s %-9s %8s' %
          ('key', 'name', 'direct', 'level', 'key', 'hemi', 'top', 'env',
           'panel', 'keyColour', 'fog', 'jpeg'))
    for key, name, src, level, mean, lamp, ex, shaft, off, kc, card in table:
        m, img = meas[key], imgs[key]
        sun, sky = lum_of(m['sunE']), lum_of(m['skyE'])
        direct = sun / max(1e-9, sun + sky)

        r_dir = direct / a_direct
        r_amb = min(HEMI_CAP, (1 - direct) / max(1e-6, 1 - a_direct))

        # THE HEMISPHERE'S TWO COLOURS are normalised TOGETHER: the sky chroma
        # sets the scale and the ground keeps its own measured share of it.
        # Normalising them apart would hand the ground bounce the same
        # strength as the sky, and a room lit as hard from below as from above
        # has no modelling left in it at all.
        sky_c = chroma(m['skyE'])
        gnd = lum_of(m['gndE']) / max(1e-9, lum_of(m['skyE']))
        gc = chroma(m['gndE'])
        gc = tuple(c * lum_of(sky_c) * gnd * gnd_k / max(1e-6, lum_of(gc))
                   for c in gc)
        kcc = (chroma(m['sunE']) if m['hasSun'] and sun > 0
               else chroma(m['horizon']))
        if kc is not None:
            kcc = tuple(unsrgb(((kc >> sh) & 255) / 255.0) for sh in (16, 8, 0))

        keyI = max(KEY_FLOOR, keep_level(RIG0['key'], COL0['key'], kcc) * level *
                   (KEY_AMBIENT + (1 - KEY_AMBIENT) * r_dir))
        hemiI = keep_level(RIG0['hemi'], COL0['hemi'], sky_c) * level * r_amb
        topI = keep_level(RIG0['top'], COL0['top'], sky_c) * level * r_amb
        envI = RIG0['env'] * level

        # DISPLAY. The anchor keeps the mean of the picture that already
        # exists, so it comes back unchanged; the rest ride the authored curve.
        tgt = mean
        if tgt is None:
            ref = os.path.join(SKY, 'alps_field.jpg')
            tgt = (float(np.asarray(Image.open(ref).convert('RGB'),
                                    dtype=np.float32).mean() / 255.0)
                   if os.path.exists(ref) else 0.50)
        # THE EXPOSURE IS THE ANCHOR'S, FULL STOP. Re-solving it
        # per row would normalise every graded picture back to the same mean
        # and undo the grade's whole job: the recipes decide the level in
        # RADIANCE, and ONE shared exposure is what turns five of them into
        # one day rather than five pictures of the same brightness.
        # ...and `anchor_k` is captured ONLY on the anchor row. Capturing it
        # from whichever row last solved its own exposure means NIGHT's lift
        # becomes the shared exposure for every row after it, which is how
        # OVERCAST came out as a sheet of paper.
        if anchor_k is not None and mean is None:
            k = anchor_k
        else:
            k = solve_exposure(img, tgt)
            if key == ANCHOR:
                anchor_k = k
        out = (srgb(img * k) * 255 + 0.5).astype(np.uint8)
        im = Image.fromarray(out)
        if OUT_W != img.shape[1]:
            im = im.resize((OUT_W, OUT_W // 2), Image.LANCZOS)
        jpg = os.path.join(outdir, '%s.jpg' % key)
        im.save(jpg, quality=JPEG_Q, optimize=True, subsampling=JPEG_SUB)

        # THE GLAZING PANELS glow with whatever the window shows, which is the
        # DISPLAY image's own upper half - measured after the exposure above,
        # because that is the picture the eye compares the panel against. A
        # white overcast dome outglows a blue sky with a sun in it, and this
        # says so without anybody authoring it.
        dome = float((out[:out.shape[0] // 2].astype(np.float32) / 255.0
                      @ LUM).mean())
        domes[key] = dome
        panel = min(PANEL_CAP, PANEL0 * dome / domes[ANCHOR])

        # fog and background: the horizon's measured chroma, taken down to an
        # interior darkness that follows the day cycle
        bg = dim_hex(chroma(m['horizon']), BG_MAX * (level ** BG_GAMMA))
        sunc = to_hex(chroma(m['sunE'] if m['hasSun'] and sun > 0 else m['horizon']))
        cardc = ('0x%06x' % card) if card is not None else             dim_hex(sky_c, min(1.0, level ** (1 / 2.2)))

        # HOW THE SPHERE IS HUNG. The backdrop is mirrored in x and then
        # turned about y; the turn is what decides which part of the panorama
        # the door frames. Solve it from where the sun measures to and where
        # the row wants the sun to stand: with phi = (u - 1/2).2pi, the sun's
        # azimuth in the room lands at pi - phi + yaw, and the door faces pi,
        # so yaw = radians(sunOff) - phi. hangar.js applies the same yaw to
        # the sphere AND to the sun vector, from this one number.
        yaw = math.radians(off) - (m['sunUV'][0] - 0.5) * 2 * math.pi

        rows.append({
            'key': key, 'name': name, 'src': srcs[key],
            'file': '%s.jpg' % key, 'grade': src,
            'bytes': os.path.getsize(jpg),
            'yaw': round(yaw, 5), 'sunOff': off,
            # THE RUNTIME HALF: what the fragment shader needs to reproduce
            # this row from the ONE base picture, instead of from its own JPEG
            'u': (sky_grade.uniforms(sky_grade.GRADES[src], base_uv,
                                     float(base_peak), refs[key], anchor_k, k)
                  ),
            # ---- measured
            'sunUV': m['sunUV'], 'hasSun': m['hasSun'],
            'sunColor': sunc,
            'skyColor': to_hex(sky_c),
            'gndColor': to_hex(gc),
            'gndShare': round(gnd, 4),
            'bg': bg,
            # ---- the rig the room runs
            'kc': ('0x%06x' % kc) if kc is not None else sunc,
            'kcMeasured': sunc,
            'card': cardc, 'panel': round(panel, 3),
            'keyI': round(keyI, 3), 'hemi': round(hemiI, 3),
            'top': round(topI, 3), 'env': round(envI, 3),
            'lamp': lamp, 'ex': ex, 'shaft': shaft,
            # ---- the working, kept so the numbers can be argued with
            'measured': {
                'sunLux': round(sun, 4), 'skyLux': round(sky, 4),
                'gndLux': round(lum_of(m['gndE']), 4),
                'direct': round(direct, 4), 'sunSr': round(m['sunSr'], 6),
                'meanLum': round(m['meanLum'], 4), 'peak': round(m['peak'], 1),
                'level': level, 'displayExposure': round(k, 5),
                'displayMean': round(tgt, 4), 'domeDisplay': round(dome, 4),
            },
        })
        print('%-9s %-9s %6.3f %6.2f | %5.2f %5.3f %5.3f %5.3f %5.2f | %-9s %-9s %5.2f MB' %
              (key, name, direct, level, keyI, hemiI, topI, envI, panel,
               rows[-1]['kc'], bg, rows[-1]['bytes'] / 1048576))

    out = {
        'note': 'GENERATED by tools/sky_prep.py - do not edit. Measured from '
                'the HDR sources; the anchor, the day-cycle levels and the '
                'display means are the tool\'s own table.',
        'anchor': ANCHOR, 'anchorDirect': round(a_direct, 4),
        'rig0': RIG0, 'keyAmbient': KEY_AMBIENT, 'hemiCap': HEMI_CAP,
        'skies': rows,
    }
    # THE ONE PICTURE, and the gain map that carries the range the JPEG
    # clipped. Everything the shader needs to rebuild any of the rows
    # above from this single panorama.
    # FULL RESOLUTION here, and only here: this pair IS the payload
    bb, gg2, gmax = sky_grade.pack(base_full, anchor_k)
    Image.fromarray(bb).save(os.path.join(outdir, 'base.jpg'),
                             quality=JPEG_Q, optimize=True, subsampling=JPEG_SUB)
    # PNG, not JPEG: this map is read back through an exp2 over 17 stops,
    # where a JPEG's ringing round the disc edge becomes real radiance
    Image.fromarray(gg2).save(os.path.join(outdir, 'gain.png'), optimize=True)
    with open(os.path.join(outdir, '_grade.glsl'), 'w') as f:
        f.write(sky_grade.GLSL)
    out['gmax'] = gmax
    out['baseExposure'] = anchor_k
    out['baseSize'] = [int(base_full.shape[1]), int(base_full.shape[0])]
    out['basePeak'] = float(base_peak)
    nz = float((gg2.max(axis=2) > 0).mean())
    bsz = os.path.getsize(os.path.join(outdir, 'base.jpg')) / 1048576
    gsz = os.path.getsize(os.path.join(outdir, 'gain.png')) / 1048576
    print('runtime: base.jpg %.2f MB + gain.png %.2f MB = %.2f MB for ALL '
          'rows (gmax %.1f stops, %.1f%% of pixels clipped) + _grade.glsl'
          % (bsz, gsz, bsz + gsz, gmax, nz * 100))
    print('         base is %dx%d' % (base_full.shape[1], base_full.shape[0]))
    out['source'] = SKY_SRC
    out['note'] = ('GENERATED by tools/sky_prep.py - do not edit. ONE '
                   'panorama (%s) graded into %d hours by tools/sky_grade.py, '
                   'each measured exactly as a delivered sky would be.'
                   % (SKY_SRC, len(rows)))
    with open(os.path.join(outdir, 'skies.json'), 'w') as f:
        json.dump(out, f, indent=2)
    tot = sum(r['bytes'] for r in rows)
    print('\nassets/hangar_sky/skies.json  +  %d display equirects, %.1f MB'
          % (len(rows), tot / 1048576))


if __name__ == '__main__':
    main()
