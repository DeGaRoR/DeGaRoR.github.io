#!/usr/bin/env python3
"""site_tex_import.py - unpacks the DELIVERED airfield ground sets into the
library's own contract at assets/airfield/<key>/.

Three delivered shapes arrive here and exactly one leaves:

  Poly Haven, packed   *_diff_1k.jpg  *_arm_1k.jpg     *_nor_gl_1k.jpg
  Poly Haven, plain    *_diff_1k.jpg  *_rough_1k.jpg   *_nor_gl_1k.jpg
  ambientCG            *_Color.jpg    *_Roughness.jpg  *_NormalGL.jpg

  the contract         diff_1k.jpg    rough_1k.jpg     nor_gl_1k.jpg

The packed family needs arm's GREEN channel lifted out as roughness (R is AO,
B is metalness).  That unpack is not new: G59 did it for raw_plank_wall so
wall_tex_prep.js could stay one recipe, and this file exists for the same
reason - tools/site_tex_prep.js must not learn three shapes.

NORMALS STAY JPEG, unlike assets/hangar_walls/ which keeps PNG.  These are
ground planes read at grazing angles across hundreds of metres, JPEG normals
are already accepted in this repo (prop_prep.py writes them at quality 90),
and PNG would cost ~0.5 MB a set for nothing anyone can see.

Geometry is NOT imported.  Every delivered .gltf/.bin here is a texture-preview
sphere; the library wants maps, not a ball.

Usage:  python tools/site_tex_import.py [--src DIR]     (default ~/Downloads)
Then:   node tools/site_tex_prep.js
"""
import argparse, io, os, sys, zipfile
from PIL import Image, ImageFile

# PIL's default JPEG scanline buffer is too small for a 1k normal written with
# optimize+subsampling=0: it raises "encoder error -2" rather than growing.
ImageFile.MAXBLOCK = 1 << 24

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'airfield')

# key, zip name, shape, and the licence/provenance CREDITS.md has to carry.
# 'ph-arm'  roughness lives in arm's G     'ph'  a plain rough map
# 'acg'     ambientCG's own naming
SETS = [
    ('brushed',       'brushed_concrete_04_1k.gltf.zip',  'ph-arm', 'Poly Haven', 'CC0', 'brushed_concrete_04'),
    ('cracked',       'cracked_concrete_02_1k.gltf.zip',  'ph-arm', 'Poly Haven', 'CC0', 'cracked_concrete_02'),
    ('antislip',      'anti_slip_concrete_1k.gltf.zip',   'ph-arm', 'Poly Haven', 'CC0', 'anti_slip_concrete'),
    ('asphalt',       'asphalt_02_1k.gltf.zip',           'ph',     'Poly Haven', 'CC0', 'asphalt_02'),
    ('asphaltaerial', 'aerial_asphalt_01_1k.gltf.zip',    'ph',     'Poly Haven', 'CC0', 'aerial_asphalt_01'),
    ('dirt',          'dirt_floor_1k.gltf.zip',           'ph-arm', 'Poly Haven', 'CC0', 'dirt_floor'),
    ('leafygrass',    'leafy_grass_1k.gltf.zip',          'ph-arm', 'Poly Haven', 'CC0', 'leafy_grass'),
    ('ground003',     'Ground003_1K-JPG.zip',             'acg',    'ambientCG',  'CC0', 'Ground003'),
    ('grass004',      'Grass004_1K-JPG.zip',              'acg',    'ambientCG',  'CC0', 'Grass004'),
    ('grass005',      'Grass005_1K-JPG.zip',              'acg',    'ambientCG',  'CC0', 'Grass005'),
]

# what each shape calls the three maps we keep, as a filename SUFFIX test
PICK = {
    'ph-arm': {'diff': '_diff_1k.jpg', 'arm': '_arm_1k.jpg', 'nor': '_nor_gl_1k.jpg'},
    'ph':     {'diff': '_diff_1k.jpg', 'rough': '_rough_1k.jpg', 'nor': '_nor_gl_1k.jpg'},
    'acg':    {'diff': '_Color.jpg', 'rough': '_Roughness.jpg', 'nor': '_NormalGL.jpg'},
}


def member(zf, suffix):
    hits = [n for n in zf.namelist() if n.endswith(suffix)]
    if len(hits) != 1:
        raise SystemExit('  %s: expected one *%s, found %d' % (zf.filename, suffix, len(hits)))
    return zf.read(hits[0])


# TWO SIZES LEAVE HERE, and the reason is the payload.  The 1k set is the
# ARCHIVE - raising a row's `tex` in site_tex_prep.js and re-baking restores
# full quality without re-importing, which is props_table.py's own `tex` budget
# rule.  The 512 set is what the artifact normally carries: ground read at
# grazing angles across hundreds of metres does not resolve 1k, and ten sets at
# 1k is ~19 MB of base64 on an index.html that is already 89 MB.
SIZES = (1024, 512)


def save(img, d, stem, quality):
    n = 0
    for px in SIZES:
        im = img if img.size[0] <= px else img.resize((px, px), Image.LANCZOS)
        path = os.path.join(d, '%s_%s.jpg' % (stem, '1k' if px == 1024 else px))
        im.save(path, 'JPEG', quality=quality, subsampling=0, optimize=True)
        n += os.path.getsize(path)
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=os.path.join(os.path.expanduser('~'), 'Downloads'))
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    rows = []
    for key, zname, shape, author, lic, slug in SETS:
        zpath = os.path.join(a.src, zname)
        if not os.path.exists(zpath):
            print('MISSING  %-14s %s' % (key, zpath)); continue
        d = os.path.join(OUT, key)
        os.makedirs(d, exist_ok=True)
        pick = PICK[shape]
        with zipfile.ZipFile(zpath) as zf:
            diff = Image.open(io.BytesIO(member(zf, pick['diff']))).convert('RGB')
            nor = Image.open(io.BytesIO(member(zf, pick['nor']))).convert('RGB')
            if 'arm' in pick:
                # R = AO, G = roughness, B = metalness. Take G, and G only:
                # reading the wrong channel is the whole trap this file exists for.
                arm = Image.open(io.BytesIO(member(zf, pick['arm']))).convert('RGB')
                rough = arm.split()[1]
            else:
                rough = Image.open(io.BytesIO(member(zf, pick['rough']))).convert('L')
        n = save(diff, d, 'diff', 88)
        n += save(nor, d, 'nor_gl', 92)     # normals get the props baker's 90+
        n += save(rough, d, 'rough', 88)
        rows.append((key, slug, author, lic, diff.size[0], n))
        print('%-14s %-22s %s  %dx%d  %.1f MB' %
              (key, slug, shape, diff.size[0], diff.size[1], n / 1048576))
    print('\n%d sets, %.1f MB on disk at 1k (the payload downscales - see '
          'tools/site_tex_prep.js)' % (len(rows), sum(r[5] for r in rows) / 1048576))


if __name__ == '__main__':
    main()
