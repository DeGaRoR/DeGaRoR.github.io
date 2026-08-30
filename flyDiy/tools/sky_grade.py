#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""sky_grade.py - one panorama, several times of day. A TEST AREA.

THE QUESTION THIS ANSWERS (user, 2026-08-29): "can we do a test by altering
the alps HDRI to make it fit the sunset and night moods? I know it is hacky,
but I prefer it to the new HDRI, and would love to package only one."

So: grade the alps field's own RADIANCE into other hours instead of shipping
another panorama for each. Every operation works on the float HDR before any
tone curve, so what comes out is still a radiance map - which means
`sky_prep.py --lab` measures a graded sky exactly as it measures a delivered
one, and the room's light rig follows the picture with nothing hand-matched.

WHAT IS HONEST, AND WHAT IS NOT. The sun cannot be moved: it is baked into the
pixels at 42 deg of elevation, and rolling the sphere to drop it would take the
mountains with it. So there is no grade here that puts a sun on the horizon.
There are two credible readings of that constraint and both are offered:

  `golden` - the sun is still up, two stops down and deep orange. A late
             golden afternoon, which is what a 42 deg sun IS.
  `sunset` - the sun is GONE, and what is left is the warm sky it left behind.
             In a valley ringed by ridges that is what the ten minutes after
             sundown look like.

WHY THERE IS NO CONTENT MASK. The first cut tried to occlude the horizon glow
behind the skyline, segmenting terrain by luminance. It does not work on this
panorama: the mountains are SUNLIT, and brighter than the sky beside them. The
answer was not a better segmenter, it was the right operation - evening light
does not paint a bright patch over a hillside, it MULTIPLIES the hillside by a
warm colour. So:

  - ADDITIVE glow lives only in the sky, in a band placed above the ridge
    (e0 defaults well clear of it) and faded out toward the horizon.
  - Everything at and below the skyline is warmed MULTIPLICATIVELY, more on
    the sun's side of the compass than away from it.

Nothing needs to know where the mountains are, and nothing can paint over them.

THE OPERATIONS, in order:
  1  SPLIT THE SUN OFF - a soft weight over log-luminance separates the disc
     AND its bloom from the sky behind, so the two scale apart. A hard
     threshold leaves a ring of untouched daylight round a dimmed sun, and
     that ring is the tell that gives the trick away.
  2  TINT THE SKY, by elevation (zenith vs horizon) and by AZIMUTH (warm
     toward the sun, cool away from it). This is most of the look: a sunset is
     not a warm image, it is a warm quarter of sky under a cold zenith.
  3  TINT THE GROUND, likewise warmer on the sun's side.
  4  PUT THE DISC BACK, on its own gain and tint.
  5  ADD THE SKY GLOW - a gaussian in azimuth and elevation, sky only, scaled
     against the source's own mean radiance so a recipe means the same thing
     whatever it is applied to.
  6  SATURATE, about the luminance the pixel already has.
  7  STARS, deterministic, upper hemisphere, faded out near the skyline.

See `python tools/sky_prep.py --lab`.
"""
import math

import numpy as np

LUM = np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)

# how far either side of the horizon the sky tint and the ground tint blend,
# in cos(elevation) - about 1.5 degrees
HORIZON_BLEND = 0.026

# ---------------------------------------------------------------- the recipes
# (gain, (r, g, b)) pairs: the tint is a plain per-channel scale, so (1,1,1) is
# colour-neutral. `warm` is the same, applied on the sun's side of the compass
# and faded round to nothing at the antisolar point. `exposure` is the last
# word on level and multiplies everything, glow included.
GRADES = {
    # the source, untouched: an early afternoon, which is what it already is
    'as-is': dict(),

    # LATE GOLDEN AFTERNOON. The sun is still up - it is at 42 deg and no
    # grade can pretend otherwise - so it stays, two stops down and orange,
    # with the whole valley warmed under a deepened sky.
    'golden': dict(
        sun=(0.055, (1.00, 0.55, 0.22)),
        zenith=(0.62, (0.42, 0.55, 1.00)),
        horizon=(1.05, (1.00, 0.80, 0.58)),
        skyWarm=(1.00, (1.00, 0.72, 0.42), 1.10),
        ecurve=0.85,
        ground=(0.70, (1.00, 0.80, 0.56)),
        gndWarm=(1.00, (1.00, 0.82, 0.60), 1.40),
        glow=dict(amp=0.45, col=(1.00, 0.60, 0.26), e0=0.26, se=0.20, sp=0.85),
        sat=1.22,
        exposure=0.62,
    ),

    # JUST AFTER SUNDOWN. The disc is gone behind the ridge - four orders off,
    # which also takes its bloom with it - and what is left is the sky it lit.
    'sunset': dict(
        sun=(2.0e-4, (1.00, 0.40, 0.12)),
        zenith=(0.30, (0.30, 0.40, 1.00)),
        horizon=(0.85, (1.00, 0.58, 0.34)),
        skyWarm=(1.45, (1.00, 0.46, 0.18), 0.85),
        ecurve=0.65,
        ground=(0.26, (1.00, 0.66, 0.44)),
        gndWarm=(1.35, (1.00, 0.56, 0.30), 1.10),
        glow=dict(amp=1.10, col=(1.00, 0.44, 0.14), e0=0.155, se=0.135, sp=0.62),
        sat=1.28,
        exposure=0.55,
    ),

    # LATER AND COLDER. The warm quarter has shrunk to a band, the zenith is
    # nearly out, and the field has gone blue.
    'dusk': dict(
        sun=(2.0e-5, (1.00, 0.50, 0.22)),
        zenith=(0.075, (0.24, 0.32, 0.90)),
        horizon=(0.30, (0.78, 0.60, 0.66)),
        skyWarm=(1.30, (1.00, 0.52, 0.30), 0.60),
        ecurve=0.55,
        ground=(0.115, (0.70, 0.74, 1.00)),
        gndWarm=(1.10, (1.00, 0.78, 0.62), 0.90),
        glow=dict(amp=1.30, col=(1.00, 0.40, 0.20), e0=0.105, se=0.090, sp=0.46),
        sat=1.15,
        exposure=0.55,
    ),

    # THE SUN IS A MOON. Four and a half orders off the disc turns the blown
    # core into a small hard source that already has a halo round it, which is
    # the one piece of luck in the whole idea. Everything else goes to a deep
    # blue two stops under, and the stars go in on top.
    'night': dict(
        sun=(3.0e-5, (0.86, 0.90, 1.00)),
        zenith=(0.0011, (0.16, 0.25, 0.66)),
        horizon=(0.0021, (0.30, 0.40, 0.82)),
        skyWarm=(1.15, (0.74, 0.76, 1.00), 0.70),
        ecurve=1.20,
        ground=(0.0016, (0.32, 0.40, 0.66)),
        gndWarm=(1.00, (1, 1, 1), 1.0),
        glow=dict(amp=0.85, col=(0.55, 0.64, 1.00), e0=0.14, se=0.12, sp=0.75),
        sat=0.78,
        stars=dict(density=0.0022, gain=7.0, warm=0.30, fade=0.06),
        exposure=1.00,
    ),

    # A WHITE SKY. The weakest of the set and kept so it can be judged rather
    # than assumed: there are no clouds in the source to reveal, so this can
    # only flatten the gradient and drown the disc in its own haze.
    'covered': dict(
        sun=(0.010, (1.00, 1.00, 1.00)),
        zenith=(0.85, (0.84, 0.89, 0.98)),
        horizon=(1.00, (0.93, 0.95, 0.99)),
        ecurve=1.70,
        ground=(0.66, (0.95, 0.97, 1.00)),
        glow=dict(amp=0.30, col=(0.95, 0.97, 1.00), e0=0.45, se=0.55, sp=3.20),
        sat=0.50,
        exposure=0.30,
    ),
}


# --------------------------------------------------------------------- helpers
def _sun_weight(lum, peak):
    """A soft 0..1 over log-luminance: 0 at a thousandth of the peak, 1 at a
    third of it. Separating the disc from the sky with a HARD threshold leaves
    a ring of untouched daylight round a dimmed sun, and that ring is exactly
    what gives the grade away."""
    lo, hi = max(peak * 1e-3, 1e-6), max(peak * 0.30, 1e-5)
    w = (np.log(np.maximum(lum, 1e-8)) - math.log(lo)) / (math.log(hi) - math.log(lo))
    return np.clip(w, 0.0, 1.0).astype(np.float32)


def _hash2(i, j, salt):
    """A deterministic per-pixel hash. Math.random has no place in something
    that has to come out the same on every machine and every re-run."""
    h = (i.astype(np.uint64) * np.uint64(0x9E3779B1) ^
         j.astype(np.uint64) * np.uint64(0x85EBCA77) ^ np.uint64(salt))
    h ^= h >> np.uint64(15)
    h = (h * np.uint64(0x2545F491)) & np.uint64(0xFFFFFFFFFFFFFFFF)
    h ^= h >> np.uint64(13)
    return (h & np.uint64(0xFFFFFF)).astype(np.float32) / float(0xFFFFFF)


def _mix(a, b, t):
    return a * (1.0 - t) + b * t


# The band of sky that everything ADDITIVE is measured against: clear of the
# skyline, clear of the zenith, and it is where the eye is looking when it
# looks out of a hangar door.
SKY_BAND = (0.05, 0.50)


def sky_level(rgb, e):
    """Mean luminance of the graded sky band, in radiance. The glow and the
    stars are expressed as multiples of THIS and not of the source, because
    the whole point of a grade is that it changes how bright the sky is."""
    m = (e[:, 0] > SKY_BAND[0]) & (e[:, 0] < SKY_BAND[1])
    return float((rgb[m] @ LUM).mean()) if bool(m.any()) else 1.0


# ----------------------------------------------------------------- the grade
def grade(img, recipe, sun_uv):
    """float32 HxWx3 radiance -> the same, at another hour. `sun_uv` is the
    source's own measured sun; everything azimuthal is referred to it."""
    if not recipe:
        return img.copy()
    H, W, _ = img.shape
    src = img.astype(np.float32)
    lum = src @ LUM
    peak = float(lum.max())
    ref = float(lum.mean())

    v = (np.arange(H, dtype=np.float32) + 0.5) / H
    e = np.cos(v * math.pi)[:, None]                     # +1 zenith .. -1 nadir
    u = (np.arange(W, dtype=np.float32) + 0.5) / W
    # 0 at the sun's azimuth, pi at the antisolar point
    dphi = (np.abs(((u - sun_uv[0] + 0.5) % 1.0) - 0.5) * 2 * math.pi)[None, :]

    # 1 - split the disc (and its bloom) off the sky behind it
    w = _sun_weight(lum, peak)[:, :, None]
    sun_l = src * w
    base = src * (1.0 - w)

    # 2/3 - the sky by elevation, the ground on its own, both warmed toward
    # the sun. MULTIPLICATIVE, so a lit hillside stays a lit hillside.
    zg, zc = recipe.get('zenith', (1.0, (1, 1, 1)))
    hg, hc = recipe.get('horizon', (1.0, (1, 1, 1)))
    gg, gc = recipe.get('ground', (1.0, (1, 1, 1)))
    t = (np.clip(e, 0.0, 1.0) ** float(recipe.get('ecurve', 1.0)))[:, :, None]
    up = _mix(np.float32(hc) * hg, np.float32(zc) * zg, t)
    dn = np.float32(gc) * gg * np.ones_like(up)

    for key, tgt in (('skyWarm', 'up'), ('gndWarm', 'dn')):
        r = recipe.get(key)
        if not r:
            continue
        wg, wc, wsp = r
        f = (np.exp(-(dphi / wsp) ** 2))[:, :, None]
        warm = _mix(np.float32([1, 1, 1]), np.float32(wc) * wg, f)
        if tgt == 'up':
            up = up * warm
        else:
            dn = dn * warm

    # THE SEAM AT THE HORIZON. Switching hard from the sky tint to the ground
    # tint at e = 0 draws a line across the picture wherever the two differ -
    # and at dusk they differ a lot. A couple of degrees of blend is all it
    # takes, and it is what haze does at a real horizon anyway.
    hb = np.clip((e + HORIZON_BLEND) / (2 * HORIZON_BLEND), 0.0, 1.0)[:, :, None]
    base = base * _mix(dn, up, hb)

    # 4 - the disc goes back, on its own gain and tint
    sg, sc = recipe.get('sun', (1.0, (1, 1, 1)))
    out = base + sun_l * (np.float32(sc) * sg)

    # 5 - the glow, ADDITIVE and SKY ONLY. `e0` sits above the skyline by
    # default and the ramp takes it to nothing by the horizon, so it can never
    # be a bright patch painted over a mountain - which is what the first cut
    # did, and it read as a floating blob immediately.
    #
    # `amp` IS A MULTIPLE OF THE SKY THIS GRADE PRODUCES, not of the source's
    # mean - and getting that wrong is what put a halo over the whole view out
    # of the door (user: "it almost annihilates the detail visible from the
    # hangar"). Measured, the old units added between six and twenty-six times
    # the sky they sat on. Referred to the graded sky band, `amp = 0.5` means
    # what it looks like it means: half as much again at the brightest point.
    gl = recipe.get('glow')
    sky_ref = sky_level(out, e)
    if gl:
        g = (np.exp(-(dphi / gl['sp']) ** 2) *
             np.exp(-((e - gl['e0']) / gl['se']) ** 2) *
             np.clip(e / 0.06, 0.0, 1.0))
        out = out + (g[:, :, None] * np.float32(gl['col'])) * (gl['amp'] * sky_ref)

    # 6 - saturation, about the luminance the pixel already has
    s = float(recipe.get('sat', 1.0))
    if s != 1.0:
        l = (out @ LUM)[:, :, None]
        out = np.maximum(l + (out - l) * s, 0.0)

    # 7 - stars. Faded out near the skyline rather than masked to it: there is
    # no reliable way to find the ridge in this panorama (its mountains are
    # SUNLIT and brighter than the sky beside them), and a star that fades out
    # before it reaches the horizon is right anyway - that is what haze does.
    st = recipe.get('stars')
    if st:
        jj, ii = np.meshgrid(np.arange(H, dtype=np.int64),
                             np.arange(W, dtype=np.int64), indexing='ij')
        sin_t = np.maximum(np.sin(np.arccos(np.clip(e, -1.0, 1.0))), 0.20)
        keep = _hash2(ii, jj, 0x51ED) < (st['density'] / sin_t)
        mag = _hash2(ii, jj, 0xB17E) ** 5.0                 # a few bright ones
        col = _hash2(ii, jj, 0x2C9F)[:, :, None]
        tint = (np.float32([1.0, 1.0, 1.0]) +
                (col - 0.5) * 2 * st.get('warm', 0.0) * np.float32([1.0, 0.1, -1.0]))
        hz = np.clip((e - 0.01) / max(st.get('fade', 0.06), 1e-3), 0.0, 1.0)
        amp = (keep * hz)[:, :, None] * mag[:, :, None] * (st['gain'] * sky_ref)
        out = out + amp * tint

    return np.maximum(out * float(recipe.get('exposure', 1.0)), 0.0).astype(np.float32)


# =========================================================================
# THE RUNTIME SIDE (user: "do the runtime shader version")
#
# Grading offline derives many hours from one panorama but still ships one
# JPEG per hour. To ship ONE picture the grade has to run on the GPU, and for
# that it needs two things the browser does not otherwise have:
#
#   1  THE RADIANCE BACK. The display JPEG is CLIPPED - the sun is a flat
#      white blob with no range left in it - and step 1 of the grade separates
#      the disc from the sky by log-luminance. Grading the LDR picture would
#      dim one large flat region and leave a hole where the sun was. So
#      `pack()` writes a second, tiny image: a GAIN MAP holding
#      log2(radiance / display-linear), which is ZERO everywhere the picture
#      did not clip and therefore compresses to almost nothing. The shader
#      multiplies it back in and works in radiance, exactly as grade() does.
#   2  THE GLOBALS. `peak` and the graded sky level are whole-image
#      reductions and a fragment shader cannot do them. They are measured here
#      and handed over as uniforms - which is also what keeps the shader and
#      this file agreeing about what `amp` means.
#
# The GLSL below is a line-for-line port of grade(). It lives in this file,
# beside the thing it mirrors, because the one real risk in having two
# implementations is that they drift apart in two different files. There is
# ONE deliberate difference, marked at its site: the star hash. Python's is a
# 64-bit integer mix and WebGL1 has no integer bit ops, so the shader uses a
# float hash. Stars are noise either way and contribute nothing measurable to
# the light rig, so the two need not agree pixel for pixel.
# =========================================================================

def _srgb8(x):
    x = np.clip(x, 0.0, 1.0)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * x ** (1 / 2.4) - 0.055)


def pack(radiance, k):
    """radiance -> (base sRGB uint8, gain uint8, gmax). `k` is the display
    exposure the base is written at. Reconstruction, in the shader:

        rad = sRGBtoLinear(base) / k * exp2(gain * gmax)

    exact wherever the base did not clip, and carrying the sun where it did.
    """
    lin = np.clip(radiance * k, 0.0, 1.0)
    base = np.clip(_srgb8(lin) * 255.0 + 0.5, 0, 255).astype(np.uint8)
    # what the base LOST: 1 where nothing clipped, large only inside the disc.
    #
    # PER CHANNEL, and that is not a detail. A single scalar gain cannot undo
    # clipping that happened in only SOME channels - and in a warm bloom red
    # clips long before blue - so a scalar map reconstructed the sun to a 37%
    # median error where the per-channel one lands at 0.8%. It costs 90 KB.
    ratio = np.maximum(radiance * k, 1e-8) / np.maximum(lin, 1e-8)
    g = np.log2(np.maximum(ratio, 1.0))
    gmax = float(g.max())
    if gmax <= 0:
        return base, np.zeros(g.shape, np.uint8), 1.0
    return base, np.clip(g / gmax * 255.0 + 0.5, 0, 255).astype(np.uint8), gmax


def _pair(r, key):
    g, c = r.get(key, (1.0, (1.0, 1.0, 1.0)))
    return float(g), [float(c[0]), float(c[1]), float(c[2])]


def uniforms(recipe, sun_uv, peak, sky_ref, base_k, out_k):
    """Everything the shader needs for one row, flat. `sky_ref` is the graded
    sky level grade() measured, so the shader's glow and stars land on the
    same yardstick without a whole-image reduction of their own."""
    r = recipe or {}
    sg, sc = _pair(r, 'sun')
    zg, zc = _pair(r, 'zenith')
    hg, hc = _pair(r, 'horizon')
    gg, gc = _pair(r, 'ground')
    swg, swc, swp = r.get('skyWarm', (1.0, (1, 1, 1), 1.0))
    gwg, gwc, gwp = r.get('gndWarm', (1.0, (1, 1, 1), 1.0))
    gl = r.get('glow') or dict(amp=0.0, col=(0, 0, 0), e0=0.0, se=1.0, sp=1.0)
    sz = r.get('stars') or dict(density=0.0, gain=0.0, warm=0.0, fade=1.0)
    return {
        'k': base_k, 'outK': out_k, 'peak': peak, 'sunU': sun_uv[0],
        'hb': HORIZON_BLEND, 'ecurve': float(r.get('ecurve', 1.0)),
        'sat': float(r.get('sat', 1.0)),
        'exposure': float(r.get('exposure', 1.0)),
        'sunG': sg, 'sunT': sc,
        'zenG': zg, 'zenT': zc, 'horG': hg, 'horT': hc,
        'gndG': gg, 'gndT': gc,
        'skyW': [float(swg), float(swp)], 'skyWT': [float(c) for c in swc],
        'gndW': [float(gwg), float(gwp)], 'gndWT': [float(c) for c in gwc],
        # amp and star gain arrive PRE-MULTIPLIED by the sky level, so the
        # shader gets absolute radiance and never has to know the yardstick
        'glow': [gl['amp'] * sky_ref, gl['e0'], gl['se'], gl['sp']],
        'glowT': [float(c) for c in gl['col']],
        'star': [sz['density'], sz['gain'] * sky_ref, sz.get('fade', 1.0)],
        'starWarm': float(sz.get('warm', 0.0)),
    }


GLSL = r"""
// GENERATED FROM tools/sky_grade.py - the GLSL half of grade(). Read the two
// together; they are meant to stay a line-for-line pair.
//
// fdSkyGrade returns DISPLAY-LINEAR colour: the graded radiance times the
// row's exposure and the display exposure, clamped to 0..1 exactly as writing
// an 8-bit picture clamps it. The backdrop hands that straight to the
// renderer's tone mapping; the probe pass sRGB-encodes it into a byte target.
#define FD_PI 3.141592653589793
const vec3 FD_LUM = vec3(0.2126, 0.7152, 0.0722);

uniform sampler2D uBase;
uniform sampler2D uGain;
uniform float uK, uGMax, uOutK, uPeak, uSunU, uHB, uEcurve, uSat, uExposure;
uniform float uSunG, uZenG, uHorG, uGndG, uStarWarm;
uniform vec3 uSunT, uZenT, uHorT, uGndT, uSkyWT, uGndWT, uGlowT;
uniform vec2 uSkyW, uGndW;
uniform vec4 uGlow;
uniform vec3 uStar;

vec3 fdS2L(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}
vec3 fdL2S(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055,
             step(vec3(0.0031308), c));
}
float fdHash(vec2 p, float s) {
  return fract(sin(dot(p + vec2(s, s * 1.7), vec2(127.1, 311.7))) * 43758.5453123);
}
float fdSq(float x) { return x * x; }   // pow(x, 2.0) is undefined for x < 0

vec3 fdSkyGrade(vec2 uv, vec2 px) {
  // 0 - the radiance back, out of the base picture and its gain map
  vec3 rad = fdS2L(texture2D(uBase, uv).rgb) / uK
             * exp2(texture2D(uGain, uv).rgb * uGMax);

  // flipY is on for both source images, so uv.y = 1 is the zenith
  float e = cos((1.0 - uv.y) * FD_PI);
  float dphi = abs(fract(uv.x - uSunU + 0.5) - 0.5) * 2.0 * FD_PI;

  // 1 - split the disc and its bloom off the sky behind it
  float lo = log(max(uPeak * 1e-3, 1e-6));
  float hi = log(max(uPeak * 0.30, 1e-5));
  float w = clamp((log(max(dot(rad, FD_LUM), 1e-8)) - lo) / (hi - lo), 0.0, 1.0);
  vec3 sunL = rad * w;
  vec3 b = rad * (1.0 - w);

  // 2/3 - the sky by elevation, the ground on its own, both warmed toward the sun
  float t = pow(clamp(e, 0.0, 1.0), uEcurve);
  vec3 up = mix(uHorT * uHorG, uZenT * uZenG, t);
  vec3 dn = uGndT * uGndG;
  up *= mix(vec3(1.0), uSkyWT * uSkyW.x, exp(-fdSq(dphi / uSkyW.y)));
  dn *= mix(vec3(1.0), uGndWT * uGndW.x, exp(-fdSq(dphi / uGndW.y)));
  b *= mix(dn, up, clamp((e + uHB) / (2.0 * uHB), 0.0, 1.0));

  // 4 - the disc goes back, on its own gain and tint
  vec3 c = b + sunL * (uSunT * uSunG);

  // 5 - the glow: sky only, and its amplitude arrived pre-multiplied by the
  // sky level this grade produces, which is what stops it being a halo
  float g = exp(-fdSq(dphi / uGlow.w)) * exp(-fdSq((e - uGlow.y) / uGlow.z))
            * clamp(e / 0.06, 0.0, 1.0);
  c += g * uGlowT * uGlow.x;

  // 6 - saturation, about the luminance already there
  float lv = dot(c, FD_LUM);
  c = max(vec3(lv) + (c - vec3(lv)) * uSat, 0.0);

  // 7 - stars. A FLOAT hash, not the python's 64-bit mix: WebGL1 has no
  // integer bit ops, and stars are noise the light rig never sees.
  if (uStar.x > 0.0) {
    float sn = max(sqrt(max(1.0 - e * e, 0.0)), 0.20);
    float keep = step(fdHash(px, 3.7), uStar.x / sn);
    vec3 tint = vec3(1.0) + (fdHash(px, 23.9) - 0.5) * 2.0 * uStarWarm
                * vec3(1.0, 0.1, -1.0);
    c += keep * clamp((e - 0.01) / uStar.z, 0.0, 1.0)
         * pow(fdHash(px, 11.3), 5.0) * uStar.y * tint;
  }

  return clamp(c * uExposure * uOutK, 0.0, 1.0);
}
"""
