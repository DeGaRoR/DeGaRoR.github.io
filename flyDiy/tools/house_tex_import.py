#!/usr/bin/env python3
"""house_tex_import.py - unpacks the DELIVERED house material sets into the
library's own contract at assets/house/<key>/ (G230).

Same three delivered shapes as site_tex_import.py, same single contract
leaving, and for the same reason: tools/house_tex_prep.js must not learn three
shapes.

  Poly Haven, packed   *_diff_1k.jpg  *_arm_1k.jpg     *_nor_gl_1k.jpg
  Poly Haven, plain    *_diff_1k.jpg  *_rough_1k.jpg   *_nor_gl_1k.jpg
  ambientCG            *_Color.jpg    *_Roughness.jpg  *_NormalGL.jpg

The two Poly Haven packings are told apart BY LOOKING IN THE ZIP (see PICK):
this delivery mixes them, and a declared shape column got it wrong on the
first run.

  the contract         diff_<px>.jpg  rough_<px>.jpg   nor_gl_<px>.jpg
  and, for a set the   paint_<px>.jpg
  house can paint

TWO THINGS THIS IMPORTER DOES THAT THE OTHERS DO NOT.

1 THE PAINT VARIANT. The user's ask was bright painted Alaskan houses "and
  there might be a way to get some coloring by simply tweaking the colors in
  there". Multiplying a BLUE painted-plank map by a red `material.color` gives
  mud - the two hues fight, and every tint comes out desaturated and dark. So
  a paintable set leaves here TWICE: the scan as delivered (blue planks are a
  perfectly good blue house), and a NEUTRAL version whose colour has been
  taken out and whose luminance has been re-based to a known mean, so that
  `map * color` reproduces the paint colour honestly at any hue. The peeling,
  the knots and the plank shadows all survive - only the hue leaves.
  PAINT_MEAN is the contract: 0.78 of white. Brighter and a saturated tint
  clips; darker and every colour reads as a stain rather than paint.

2 THE SIZE IS DERIVED FROM THE SET'S OWN PHYSICAL SCALE, not chosen. The user
  asked for "similar texel density in the end", and texel density is
  px / tile_metres - so a 1.2 m plank sheet and a 2 m shingle sheet must NOT
  both be 512. Each row below declares `tile`, the metres of real building one
  repeat covers (read off the scan: count the planks, count the corrugations),
  and the payload size is the power of two nearest DENSITY_TARGET * tile in
  log space. The achieved density is printed for every set and GATE HOUSE
  holds the spread.

Geometry is NOT imported: every delivered .gltf/.bin is a texture-preview
sphere; the library wants maps, not a ball.

Usage:  python tools/house_tex_import.py [--src DIR]     (default ~/Downloads)
Then:   node tools/house_tex_prep.js
"""
import argparse, io, math, os, zipfile
from PIL import Image, ImageFile, ImageStat

ImageFile.MAXBLOCK = 1 << 24    # site_tex_import.py's own encoder-buffer fix

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'house')

DENSITY_TARGET = 320.0          # texels per metre of building
PAINT_MEAN = 0.78               # the neutral paint base, as a fraction of white
POT = (256, 512, 1024)

# key, zip, shape, author, licence, slug, tile (m per repeat), paintable
#
# WHAT WAS LEFT OUT, and why - the user sent nineteen sets and said to be
# selective: `natural_walnut_veneer` (a cabinet veneer; the aeroplane's own
# wood library already carries it, and no Alaskan house is clad in figured
# walnut), `clay_roof_tiles` (Mediterranean - southeast Alaska roofs are metal
# or shake), `roof_3` (lichened clay tiles, same objection), and
# `corrugated_iron` clean (box profile already covers a new metal roof, and
# the two WORN corrugated sets are the characterful ones).
SETS = [
    # metal
    ('galv',      'Metal037_1K-JPG.zip',                  'acg',    'ambientCG',  'CC0', 'Metal037',                 1.0, False),
    ('rust',      'rust_coarse_01_1k.gltf.zip',           'ph',    'Poly Haven', 'CC0', 'rust_coarse_01',           1.8, False),
    ('boxprof',   'box_profile_metal_sheet_1k.gltf.zip',  'ph',    'Poly Haven', 'CC0', 'box_profile_metal_sheet',  3.2, True),
    ('corrworn',  'worn_corrugated_iron_1k.gltf.zip',     'ph',    'Poly Haven', 'CC0', 'worn_corrugated_iron',     3.6, False),
    ('corrrust',  'rusty_corrugated_iron_1k.gltf.zip',    'ph',    'Poly Haven', 'CC0', 'rusty_corrugated_iron',    4.8, False),
    # roof
    ('shingle',   'grey_roof_01_1k.gltf.zip',             'ph',    'Poly Haven', 'CC0', 'grey_roof_01',             2.6, False),
    # wood: painted, rough, weathered
    ('paintwood', 'blue_painted_planks_1k.gltf.zip',      'ph',     'Poly Haven', 'CC0', 'blue_painted_planks',      1.9, True),
    ('greenwood', 'green_rough_planks_1k.gltf.zip',       'ph',    'Poly Haven', 'CC0', 'green_rough_planks',       1.9, True),
    ('roughwood', 'wooden_rough_planks_1k.gltf.zip',      'ph',    'Poly Haven', 'CC0', 'wooden_rough_planks',      1.9, False),
    ('brownwood', 'brown_planks_08_1k.gltf.zip',          'ph',    'Poly Haven', 'CC0', 'brown_planks_08',          1.9, False),
    ('greywood',  'weathered_planks_1k.gltf.zip',         'ph',    'Poly Haven', 'CC0', 'weathered_planks',         2.1, False),
    ('wornwood',  'weathered_brown_planks_1k.gltf.zip',   'ph',    'Poly Haven', 'CC0', 'weathered_brown_planks',   2.1, False),
    ('deckwood',  'wood_floor_deck_1k.gltf.zip',          'ph',    'Poly Haven', 'CC0', 'wood_floor_deck',          2.2, False),
    ('board',     'wood_cabinet_worn_long_1k.gltf.zip',   'ph',    'Poly Haven', 'CC0', 'wood_cabinet_worn_long',   1.9, True),
    # ground
    ('concrete',  'concrete_floor_damaged_01_1k.gltf.zip','ph',    'Poly Haven', 'CC0', 'concrete_floor_damaged_01',2.8, False),
    # G234: the SECOND foundation (the user: "They should be 2 of them; a fine
    # grain light one (the current setup is OK), and a coarse grain darker
    # one"). Measured against the first: grain (the r.m.s. of the diffuse
    # against its own 16x blur) 0.036 against 0.015, and darker in every
    # channel. A footing and a stem wall are not poured the same day and never
    # match; one concrete for every house was the tell.
    ('concretec', 'cracked_concrete_02_1k.gltf.zip',      'ph',    'Poly Haven', 'CC0', 'cracked_concrete_02',      2.8, False),
    # G232: the dark end of the wood, and a shake siding
    ('darkwood',  'Planks025A_1K-JPG.zip',                'acg',   'ambientCG',  'CC0', 'Planks025A',               1.9, True),
    # NOT paintable, and not tintable either (the user: "don't recolor dark
    # strained boards. These one do not tolerate a trim paint on top"). A
    # neutral map is made by dividing the hue out and re-basing the luminance,
    # and on a dark stain that is a lie twice over: the re-base lifts a 0.11
    # mean to 0.78, which is no longer a stain, and a straight tint on the
    # unneutralised scan just muddies it. A stain is a FINISH THAT SHOWS THE
    # WOOD; the only honest thing to do with it is leave it alone. The
    # generator refuses the colour as well - see SET_TINT in _house_gen.js.
    ('stain',     'Planks025C_1K-JPG.zip',                'acg',   'ambientCG',  'CC0', 'Planks025C',               1.9, False),
    ('shakes',    'WoodSiding010_1K-JPG.zip',             'acg',   'ambientCG',  'CC0', 'WoodSiding010',            2.2, False),
    # G232.4: bark, for the piles - a driven pile is a tree with its skin on
    ('bark',      'Bark015_1K-JPG.zip',                   'acg',   'ambientCG',  'CC0', 'Bark015',                  1.1, False),
]

# VENEER, AND WHY IT COMES FROM THE AEROPLANE'S OWN LIBRARY (the user: "You
# should not take planks for finish, shoot for a veneer"). A casing, a corner
# board and a barge board are MILLED stock — one board, planed, painted. A
# plank-wall scan tiled onto a 100 mm casing puts three plank joints across a
# board that has none, and that is what made the finish read as cladding. The
# repo already owns four scanned veneers: `assets/wood/` (G125, AEROSKIN's
# wood sheets), whose diff/nor_gl/rough leave the wood import in exactly this
# file's contract. They are COPIED, not re-imported: same bytes, one more
# `tile`, and CREDITS.md already carries their provenance.
FROM_WOOD = [
    ('veneer',     'maple',     'Poly Haven', 'CC0', 'white_maple_veneer',    0.90, True),
    ('veneerdark', 'walnutfig', 'Poly Haven', 'CC0', 'natural_walnut_veneer', 0.90, True),
    ('veneerwarm', 'walnut',    'Poly Haven', 'CC0', 'walnut_veneer_02',      0.90, True),
    ('veneerpale', 'laminate',  'ambientCG',  'CC0', 'Wood091B',              0.90, True),
]

# THE POLY HAVEN SHAPE IS RESOLVED PER ZIP, NOT DECLARED. The delivery is
# mixed - eleven of these fifteen carry a plain *_rough_1k.jpg and four pack
# roughness into arm's green - and a hand-written shape column gets that wrong
# for a set you did not open, which is exactly how the first run of this
# importer died on grey_roof_01. `ph` means "Poly Haven, either packing".
PICK = {
    'ph':  {'diff': '_diff_1k.jpg', 'nor': '_nor_gl_1k.jpg'},
    'acg': {'diff': '_Color.jpg', 'rough': '_Roughness.jpg', 'nor': '_NormalGL.jpg'},
}


def rough_of(zf, shape):
    if shape == 'acg':
        return Image.open(io.BytesIO(member(zf, PICK['acg']['rough']))).convert('L')
    if any(n.endswith('_arm_1k.jpg') for n in zf.namelist()):
        # arm: R = AO, G = roughness, B = metalness. G, and G only.
        arm = Image.open(io.BytesIO(member(zf, '_arm_1k.jpg'))).convert('RGB')
        return arm.split()[1]
    return Image.open(io.BytesIO(member(zf, '_rough_1k.jpg'))).convert('L')


def payload_px(tile):
    """the power of two whose texel density is nearest the target, in log space"""
    want = DENSITY_TARGET * tile
    return min(POT, key=lambda p: abs(math.log(p / want)))


def member(zf, suffix):
    hits = [n for n in zf.namelist() if n.endswith(suffix)]
    if len(hits) != 1:
        raise SystemExit('  %s: expected one *%s, found %d'
                         % (zf.filename, suffix, len(hits)))
    return zf.read(hits[0])


def save(img, d, stem, px, quality):
    """1k archive + the payload size, exactly site_tex_import's budget rule"""
    n = 0
    for size in sorted({1024, px}):
        im = img if img.size[0] <= size else img.resize((size, size), Image.LANCZOS)
        name = '%s_%s.jpg' % (stem, '1k' if size == 1024 else size)
        path = os.path.join(d, name)
        im.save(path, 'JPEG', quality=quality, subsampling=0, optimize=True)
        n += os.path.getsize(path)
    return n


def neutralise(diff):
    """take the hue out and re-base the luminance on PAINT_MEAN, so that
    map * color IS the paint colour.

    A PURE GAIN WAS THE FIRST TRY AND IT BLEW THE HIGHLIGHTS: these scans are
    dark paint with bright flecks of bare wood, so lifting the MEAN to 0.78
    drove 14% of blue_painted_planks past white - and a clipped highlight
    tints to a flat white blob instead of to pale paint. The gain is kept
    below KNEE and rolls off exponentially above it, so nothing ever reaches
    1.0 and the flecks stay flecks. The fraction that lands in the knee is
    reported; the contrast below it is the scan's own, untouched."""
    KNEE = 0.80
    lum = diff.convert('L')
    mean = ImageStat.Stat(lum).mean[0]
    gain = (PAINT_MEAN * 255.0) / max(mean, 1.0)
    lut = []
    for v in range(256):
        x = v * gain / 255.0
        if x > KNEE:
            x = KNEE + (1.0 - KNEE) * (1.0 - math.exp(-(x - KNEE) / (1.0 - KNEE)))
        lut.append(max(0, min(255, round(255 * x))))
    out = lum.point(lut).convert('RGB')
    hist = lum.histogram()
    rolled = sum(hist[v] for v in range(256) if v * gain / 255.0 > KNEE)
    got = ImageStat.Stat(out.convert('L')).mean[0] / 255.0
    return out, rolled / float(sum(hist)), got


def main():
    # ONE SOURCE OF TRUTH FOR THE PAYLOAD SIZE. It is derived here from each
    # set's own tile and written to _sizes.json; tools/house_tex_prep.js reads
    # it instead of repeating the number, which is what drifted the first time
    # a tile moved (the prep asked for a 512 that had never been written).
    sizes = {}
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=os.path.join(os.path.expanduser('~'), 'Downloads'))
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    total = 0
    print('%-10s %-26s %5s %5s %6s  %-16s %s'
          % ('key', 'source', 'tile', 'px', 'px/m', 'base colour', 'notes'))
    for key, zname, shape, author, lic, slug, tile, paint in SETS:
        zpath = os.path.join(a.src, zname)
        if not os.path.exists(zpath):
            # the walnut zip arrived as "... (1).zip"; try the browser's suffix
            alt = zpath.replace('.zip', ' (1).zip')
            zpath = alt if os.path.exists(alt) else zpath
        if not os.path.exists(zpath):
            print('MISSING  %-10s %s' % (key, zpath)); continue
        px = payload_px(tile)
        sizes[key] = px
        d = os.path.join(OUT, key)
        os.makedirs(d, exist_ok=True)
        pick = PICK[shape]
        with zipfile.ZipFile(zpath) as zf:
            diff = Image.open(io.BytesIO(member(zf, pick['diff']))).convert('RGB')
            nor = Image.open(io.BytesIO(member(zf, pick['nor']))).convert('RGB')
            rough = rough_of(zf, shape)
        n = save(diff, d, 'diff', px, 88)
        n += save(nor, d, 'nor_gl', px, 92)
        n += save(rough, d, 'rough', px, 88)
        note = ''
        if paint:
            neu, rolled, got = neutralise(diff)
            n += save(neu, d, 'paint', px, 88)
            note = 'paintable, base %.2f, %.0f%% in the knee' % (got, 100 * rolled)
        total += n
        mc = ImageStat.Stat(diff).mean
        print('%-10s %-26s %5.2f %5d %6.0f  0x%02x%02x%02x %-8s %s'
              % (key, slug, tile, px, px / tile,
                 round(mc[0]), round(mc[1]), round(mc[2]),
                 '', note))
    # the veneers, lifted out of the aeroplane's wood library
    wood_dir = os.path.join(ROOT, 'assets', 'wood')
    for key, src, author, lic, slug, tile, paint in FROM_WOOD:
        sd = os.path.join(wood_dir, src)
        if not os.path.isdir(sd):
            print('MISSING  %-10s %s (run tools/wood_tex_import.py)' % (key, sd))
            continue
        px = payload_px(tile)
        sizes[key] = px
        d = os.path.join(OUT, key)
        os.makedirs(d, exist_ok=True)
        diff = Image.open(os.path.join(sd, 'diff_1k.jpg')).convert('RGB')
        nor = Image.open(os.path.join(sd, 'nor_gl_1k.jpg')).convert('RGB')
        rough = Image.open(os.path.join(sd, 'rough_1k.jpg')).convert('L')
        n = save(diff, d, 'diff', px, 88)
        n += save(nor, d, 'nor_gl', px, 92)
        n += save(rough, d, 'rough', px, 88)
        note = ''
        if paint:
            neu, rolled, got = neutralise(diff)
            n += save(neu, d, 'paint', px, 88)
            note = 'paintable, base %.2f, %.0f%% in the knee' % (got, 100 * rolled)
        total += n
        mc = ImageStat.Stat(diff).mean
        print('%-10s %-26s %5.2f %5d %6.0f  0x%02x%02x%02x %-8s %s'
              % (key, slug + ' (veneer)', tile, px, px / tile,
                 round(mc[0]), round(mc[1]), round(mc[2]), '', note))
    import json
    with io.open(os.path.join(OUT, '_sizes.json'), 'w',
                 encoding='utf-8') as f:
        f.write(json.dumps(sizes, indent=1, sort_keys=True))
    print('\n%d sets, %.1f MB on disk under assets/house/ (untracked; the '
          'payload picks one size - tools/house_tex_prep.js)'
          % (len(SETS) + len(FROM_WOOD), total / 1048576))


if __name__ == '__main__':
    main()
