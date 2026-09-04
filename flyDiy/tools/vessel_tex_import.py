#!/usr/bin/env python3
"""vessel_tex_import.py - the FOUR SURFACES A TANK OR A PACK IS MADE OF.

tools/skin_tex_import.py's sibling, and deliberately not its copy: that tool
packs AEROSKIN detail sheets (R,G normal / B a 0.80-mean ride) because the
covering is drawn by one shader with one four-channel sheet. A fuel tank is
not covering. It is an OBJECT in the scene with its own MeshStandardMaterial,
so it wants the shape the HANGAR PROPS already use and that src/viewer/props.js
already documents:

    diff   sRGB base colour
    arm    linear   R = ambient occlusion, G = roughness, B = metalness
    nor    linear   tangent-space normal, OpenGL convention

ONE image serves roughnessMap and metalnessMap - three samplers, one upload -
which is the whole reason the props baker packs them that way, and the reason
this one does too.

THE FOUR SETS, and why each is where it is:

  paint    green_metal_rust (Poly Haven, CC0). The painted-metal tank, and the
           one the player may RECOLOUR. Measured here: 94% of its pixels sit in
           a fifteen-degree hue bin (90-105 deg) at a saturation of 0.325 +-
           0.02 - there is no second hue in the image to protect, no orange
           rust to turn blue - so a FLAT HUE ROTATION in the shader is exactly
           right and needs no mask. That measurement is why the hue row exists.
  steel    Metal038 (ambientCG, CC0). The hardware: filler necks, sender
           plates, drain sumps, strap buckles, terminal posts. Dark, roughness
           0.37, and the only set here with a real metalness map.
  plastic  Plastic002 (ambientCG, CC0). Moulded tanks and rubber bladders.
  alu      ALREADY IN STORE - assets/skin/panel/ (Metal050C, ambientCG, CC0),
           imported for the instrument facia. Bare rolled sheet: near white
           (mean 245), roughness 0.24, a very shallow normal. A welded
           aluminium tank IS that sheet, so this set is built from the files
           that are already there rather than from a fourth download.

TINTABLE OR AS-IS, declared per set. A material's `color` MULTIPLIES its map,
so a dark map can only ever be darkened - Plastic002's own colour is a dark
red-brown (48, 39, 38) and no tint reaches natural white polythene from there.
So `norm` renormalises a set's diffuse to a pale mean, keeping every relative
variation, and the vessel's colour row then decides what it is. `paint` and
`steel` and `alu` keep their measured colour: a hue rotation, a steel fitting
and bare alloy are all things whose colour is a FACT of the material.

Usage:  python tools/vessel_tex_import.py [--src DIR]     (default ~/Downloads)
Then:   node tools/vessel_tex_prep.js
"""
import argparse, io, os, zipfile
from PIL import Image, ImageFile, ImageStat

ImageFile.MAXBLOCK = 1 << 24    # site_tex_import.py's own encoder-buffer fix

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'vessel')

# key, source, provenance for CREDITS.md, metalness (None = the set has a map),
# and the diffuse mean to renormalise to (None = keep the measured colour).
#   source ('zip', name, shape) | ('store', assets-relative dir)
SETS = [
    ('paint',   ('zip', 'green_metal_rust_1k.gltf.zip', 'ph'),
     'Poly Haven', 'CC0', 'green_metal_rust', 0.0,  None),
    ('steel',   ('zip', 'Metal038_1K-JPG.zip', 'acg'),
     'ambientCG', 'CC0', 'Metal038',          None, None),
    ('plastic', ('zip', 'Plastic002_1K-JPG.zip', 'acg'),
     'ambientCG', 'CC0', 'Plastic002',        0.0,  0.78),
    ('alu',     ('store', os.path.join('skin', 'panel')),
     'ambientCG', 'CC0', 'Metal050C',         1.0,  None),
]

PICK = {
    'ph':    {'diff': '_diff_1k.jpg', 'rough': '_rough_1k.jpg',
              'nor': '_nor_gl_1k.jpg'},
    'acg':   {'diff': '_Color.jpg', 'rough': '_Roughness.jpg',
              'nor': '_NormalGL.jpg', 'metal': '_Metalness.jpg'},
    'store': {'diff': 'diff_1k.jpg', 'rough': 'rough_1k.jpg',
              'nor': 'nor_gl_1k.jpg'},
}

SIZES = (1024, 512)   # 1k archive, 512 payload - site_tex_import's budget rule


def member(zf, suffix):
    hits = [n for n in zf.namelist() if n.endswith(suffix)]
    if len(hits) != 1:
        raise SystemExit('  %s: expected one *%s, found %d'
                         % (zf.filename, suffix, len(hits)))
    return zf.read(hits[0])


def save(img, d, stem, quality):
    n = 0
    for px in SIZES:
        im = img if img.size[0] <= px else img.resize((px, px), Image.LANCZOS)
        path = os.path.join(d, '%s_%s.jpg' % (stem, '1k' if px == 1024 else px))
        im.save(path, 'JPEG', quality=quality, subsampling=0, optimize=True)
        n += os.path.getsize(path)
    return n


def renorm(diff, target):
    """Scale a diffuse so its mean luminance lands on `target` (0..1), keeping
    every relative variation - and its own colour cast with it, because a
    channel-wise scale would bleach the moulding marks as well as the brown."""
    lum = ImageStat.Stat(diff.convert('L')).mean[0] / 255
    k = target / max(lum, 1e-3)
    lut = [max(0, min(255, round(v * k))) for v in range(256)] * 3
    return diff.point(lut)


def load(a, src):
    """-> ((diff RGB, rough L, nor RGB, metal L or None), where) | (None, where)"""
    kind = src[0]
    if kind == 'zip':
        zpath = os.path.join(a.src, src[1])
        if not os.path.exists(zpath):
            return None, zpath
        pick = PICK[src[2]]
        with zipfile.ZipFile(zpath) as zf:
            diff = Image.open(io.BytesIO(member(zf, pick['diff']))).convert('RGB')
            rough = Image.open(io.BytesIO(member(zf, pick['rough']))).convert('L')
            nor = Image.open(io.BytesIO(member(zf, pick['nor']))).convert('RGB')
            has = 'metal' in pick and any(n.endswith(pick['metal'])
                                          for n in zf.namelist())
            metal = (Image.open(io.BytesIO(member(zf, pick['metal']))).convert('L')
                     if has else None)
        return (diff, rough, nor, metal), zpath
    d = os.path.join(ROOT, 'assets', src[1])
    pick = PICK['store']
    if not os.path.exists(os.path.join(d, pick['diff'])):
        return None, d
    diff = Image.open(os.path.join(d, pick['diff'])).convert('RGB')
    rough = Image.open(os.path.join(d, pick['rough'])).convert('L')
    nor = Image.open(os.path.join(d, pick['nor'])).convert('RGB')
    return (diff, rough, nor, None), d


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=os.path.join(os.path.expanduser('~'), 'Downloads'))
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for key, src, author, lic, slug, metal, norm in SETS:
        got, where = load(a, src)
        if not got:
            print('MISSING  %-10s %s' % (key, where))
            continue
        diff, rough, nor, metalMap = got
        rm = ImageStat.Stat(rough).mean[0] / 255
        mc = ImageStat.Stat(diff).mean
        if norm is not None:
            diff = renorm(diff, norm)
        # arm: R = AO (none measured in any of these sets, so white and the
        # material simply does not bind aoMap), G = roughness, B = metalness
        white = Image.new('L', rough.size, 255)
        bmap = metalMap if metalMap is not None else \
            Image.new('L', rough.size, int(round(255 * (metal or 0))))
        arm = Image.merge('RGB', (white, rough, bmap))
        d = os.path.join(OUT, key)
        os.makedirs(d, exist_ok=True)
        n = save(diff, d, 'diff', 88)
        n += save(arm, d, 'arm', 92)        # data, not a picture: quality 92
        n += save(nor, d, 'nor_gl', 92)
        total += n
        nc = ImageStat.Stat(diff).mean
        bm = ImageStat.Stat(bmap).mean[0] / 255
        print('%-9s %-18s src 0x%02x%02x%02x -> 0x%02x%02x%02x  rough %.3f  '
              'metal %.3f%s  %.1f MB'
              % (key, slug, round(mc[0]), round(mc[1]), round(mc[2]),
                 round(nc[0]), round(nc[1]), round(nc[2]), rm, bm,
                 ' (map)' if metalMap is not None else '', n / 1048576))
    print('\n%d sets, %.1f MB on disk (payload picks 512 - tools/vessel_tex_prep.js)'
          % (len(SETS), total / 1048576))


if __name__ == '__main__':
    main()
