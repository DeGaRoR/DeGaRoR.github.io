#!/usr/bin/env python3
"""lot_tex_import.py - THE LOT'S GROUND (G290, the user: "I have provided 5
ground textures. For the grass, we need to mix up the different textures, on
the basis of a perlin noise mask ... the grass should be more dense/lush close
to the fences, not growing under the houses (we need to use the least green
textures for that), the seafront uses pebbles").

Five ambientCG sets from assets/groundTextures/, normalised to the one
contract every ground library in this repo uses (diff / nor_gl / rough, 1k
archive + 512 working copy) under assets/lot/<key>/. tools/lot_tex_prep.js
bakes the payload from there.

    lush     Grass001   the dark, dense grass: by the fences
    grass    Grass004   the everyday grass, yellower
    pebble   Gravel022  the seafront
    dry      Ground081  the least green: under the houses
    dirt     Ground110  the paths

Usage: python tools/lot_tex_import.py
"""
import io, os, zipfile
from PIL import Image, ImageFile
ImageFile.MAXBLOCK = 1 << 22     # a 1k jpeg with optimize wants a bigger buffer than PIL's default

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, 'assets', 'groundTextures')
OUT = os.path.join(ROOT, 'assets', 'lot')

SETS = [
    ('lush',   'Grass001_1K-JPG.zip',     'ambientCG', 'CC0', 'Grass001'),
    ('grass',  'Grass004_1K-JPG (1).zip', 'ambientCG', 'CC0', 'Grass004'),
    ('pebble', 'Gravel022_1K-JPG.zip',    'ambientCG', 'CC0', 'Gravel022'),
    ('dry',    'Ground081_1K-JPG.zip',    'ambientCG', 'CC0', 'Ground081'),
    ('dirt',   'Ground110_1K-JPG.zip',    'ambientCG', 'CC0', 'Ground110'),
]
PICK = {'diff': '_Color.jpg', 'rough': '_Roughness.jpg', 'nor': '_NormalGL.jpg'}
SIZES = (1024, 512)


def member(zf, suffix):
    hits = [n for n in zf.namelist() if n.endswith(suffix)]
    if len(hits) != 1:
        raise SystemExit('  %s: expected one *%s, found %d' % (zf.filename, suffix, len(hits)))
    return zf.read(hits[0])


def save(img, d, stem, quality):
    n = 0
    for px in SIZES:
        im = img if img.size[0] <= px else img.resize((px, px), Image.LANCZOS)
        path = os.path.join(d, '%s_%s.jpg' % (stem, '1k' if px == 1024 else px))
        im.save(path, 'JPEG', quality=quality, subsampling=0, optimize=True)
        n += os.path.getsize(path)
    return n


def main():
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for key, zname, author, lic, slug in SETS:
        zpath = os.path.join(SRC, zname)
        if not os.path.exists(zpath):
            print('MISSING  %-8s %s' % (key, zpath)); continue
        d = os.path.join(OUT, key)
        os.makedirs(d, exist_ok=True)
        with zipfile.ZipFile(zpath) as zf:
            diff = Image.open(io.BytesIO(member(zf, PICK['diff']))).convert('RGB')
            nor = Image.open(io.BytesIO(member(zf, PICK['nor']))).convert('RGB')
            rough = Image.open(io.BytesIO(member(zf, PICK['rough']))).convert('L')
        n = save(diff, d, 'diff', 88) + save(nor, d, 'nor_gl', 92) + save(rough, d, 'rough', 88)
        total += n
        print('%-8s %-10s %dx%d  %.1f MB' % (key, slug, diff.size[0], diff.size[1], n / 1048576))
    print('%d sets, %.1f MB under assets/lot/ (untracked)' % (len(SETS), total / 1048576))


if __name__ == '__main__':
    main()
