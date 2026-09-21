#!/usr/bin/env python3
"""splat_tex_import.py - THE ISLAND'S GROUND LIBRARY (alpha splatting, 2026-09-20).

The user's Poly Haven packs from assets/alphaSplat/*.gltf.zip, normalised to
the one contract every ground library in this repo uses (diff / nor_gl /
rough, 1k archive + 512 working copy) under assets/splat/<key>/, plus
assets/splat/index.json: key, source slug, licence and THE REFERENCE SCALE.

The scale is read from the pack itself, not typed in: a Poly Haven gltf is a
preview sphere whose DIAMETER is the texture's real-world size (aerial_beach_01
spans 30 m, brown_mud_03 1.25 m). `metres` in the index is that diameter; the
splat shader samples every set in world metres divided by it.

Roughness comes in three packings (told apart BY LOOKING IN THE ZIP):
  *_rough_1k.jpg   a plain map
  *_arm_1k.jpg     AO / ROUGHNESS / metal packed - the GREEN channel, only
  *_spec_1k.jpg    a specular map, no rough at all (brown_mud_03) - inverted

THE HEIGHT (height_1k.jpg, for the height blend and the hex tiling): the gltf
zips carry no displacement, so it is INTEGRATED from the normal map (Frankot-
Chellappa: the slopes -n.x/n.z, -n.y/n.z solved in the Fourier domain, exact
for a seamless tile), high-passed at an eighth of the tile, stretched over
its 1-99 percentiles. A real *_disp map
wins when the zip has one. The lot's five (ambientCG, assets/groundTextures)
get their real *_Displacement.jpg written beside them under assets/lot/.

Usage: py -3.11 tools/splat_tex_import.py      (then tools/_island.html reads assets/splat/)
"""
import io, json, os, zipfile
import numpy as np
from PIL import Image, ImageFile, ImageOps
ImageFile.MAXBLOCK = 1 << 22

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, 'assets', 'alphaSplat')
OUT = os.path.join(ROOT, 'assets', 'splat')

# key, zip, label (what the user brought it for)
SETS = [
    ('beach',    'aerial_beach_01_1k.gltf.zip',   'the sand beach, an oriented pattern (faces the sea)'),
    ('rocksA',   'aerial_rocks_01_1k.gltf.zip',   'aerial rocks 1 - the milder rock'),
    ('rocksB',   'aerial_rocks_02_1k.gltf.zip',   'aerial rocks 2 - mixed with rocksA'),
    ('mud',      'brown_mud_03_1k.gltf.zip',      'brown mud - the muskeg'),
    ('leaves',   'forest_leaves_04_1k.gltf.zip',  'the forest floor'),
    ('cliff',    'marble_cliff_02_1k.gltf.zip',   'the cliff - the harshest slopes'),
    ('rocksG',   'rocks_ground_01_1k.gltf.zip',   'rocks on the ground - scree'),
    ('rockyA',   'rocky_terrain_02_1k.gltf.zip',  'rocky terrain 2'),
    ('rockyB',   'rocky_terrain_03_1k.gltf.zip',  'rocky terrain 3'),
    # the second batch (the user, 2026-09-20 evening): the aerial tier
    ('grassRock','aerial_grass_rock_1k.gltf.zip', 'aerial grass + rock - anything grassy, not so rocky'),
    ('forestAir','aerial_rocks_04_1k.gltf.zip',   'aerial rocks 4 - the forest floor from above'),
    ('snowAir',  'snow_field_aerial_1k.gltf.zip', 'the snow field from above'),
    # the rocky beach (TERRAIN FOLLOW-UP 4, 2026-09-21): Poly Haven's smugglers_cove aerials, fetched from the API's
    # file list (the site's zip is built on the fly). coast_land_rocks_02 was looked at and dropped: it is a MODEL
    # (a 10.5 x 4.9 m scanned strip, its diff an atlas), not a tileable texture.
    ('coastA',   'coast_land_rocks_01_1k.gltf.zip', 'the rocky foreshore from above - the shingle band (20 m)'),
    ('coastSand','coast_sand_rocks_02_1k.gltf.zip', 'rock and sand with green tufts - the upper shore (15 m)'),
]
SIZES = (1024, 512)
LOT_SRC = os.path.join(ROOT, 'assets', 'groundTextures')
LOT_OUT = os.path.join(ROOT, 'assets', 'lot')
# a worktree carries no link to the main checkout's assets: fall back to it (never junction - G434.1)
MAIN = 'D:/Dev/DeGaRoR.github.io/flyDiy/assets'
if not os.path.isdir(SRC): SRC = os.path.join(MAIN, 'alphaSplat')
if not os.path.isdir(LOT_SRC): LOT_SRC = os.path.join(MAIN, 'groundTextures')
if not os.path.isdir(LOT_OUT): LOT_OUT = os.path.join(MAIN, 'lot')


def mean_linear(img):
    """the set's mean colour, linear rgb 0-1 (sRGB bytes decoded first): what a tuft's instanceColor takes at its foot"""
    a = np.asarray(img.convert('RGB').resize((64, 64), Image.BOX), dtype='float64') / 255.0
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    return [round(float(v), 4) for v in lin.reshape(-1, 3).mean(0)]
LOT = [('lush', 'Grass001_1K-JPG.zip'), ('grass', 'Grass004_1K-JPG (1).zip'), ('pebble', 'Gravel022_1K-JPG.zip'),
       ('dry', 'Ground081_1K-JPG.zip'), ('dirt', 'Ground110_1K-JPG.zip')]


def height_from_normal(nor):
    """Integrate a GL normal map (tangent space, +y up) to a 0..1 height."""
    n = np.asarray(nor.convert('RGB'), dtype='float64') / 255.0 * 2.0 - 1.0
    nz = np.clip(n[..., 2], 0.05, 1.0)
    p, q = -n[..., 0] / nz, -n[..., 1] / nz          # dh/dx, dh/dy (image y points down: q flips below)
    H, W = p.shape
    wx = np.fft.fftfreq(W)[None, :] * 2 * np.pi
    wy = np.fft.fftfreq(H)[:, None] * 2 * np.pi
    P, Q = np.fft.fft2(p), np.fft.fft2(-q)
    d = wx ** 2 + wy ** 2; d[0, 0] = 1.0
    Hf = (-1j * wx * P - 1j * wy * Q) / d; Hf[0, 0] = 0.0
    # high-pass: the integration drifts into a tile-wide swell; the blend wants
    # the local relief (pebble over sand), so periods over an eighth of the
    # tile are rolled off
    k0 = 2 * np.pi / (W / 8.0)
    Hf *= 1.0 - np.exp(-(d / (k0 * k0)))
    h = np.real(np.fft.ifft2(Hf))
    lo, hi = np.percentile(h, 1), np.percentile(h, 99)
    return Image.fromarray(np.clip((h - lo) / max(hi - lo, 1e-9) * 255.0, 0, 255).astype('uint8'), 'L')


def member(zf, suffix, optional=False):
    hits = [n for n in zf.namelist() if n.endswith(suffix)]
    if not hits and optional:
        return None
    if len(hits) != 1:
        raise SystemExit('  %s: expected one *%s, found %d' % (zf.filename, suffix, len(hits)))
    return zf.read(hits[0])


def sphere_diameter(zf):
    """The preview sphere's extent along x, from the POSITION accessor's min/max."""
    gltf = json.loads(member(zf, '.gltf'))
    prim = gltf['meshes'][0]['primitives'][0]
    acc = gltf['accessors'][prim['attributes']['POSITION']]
    return acc['max'][0] - acc['min'][0]


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
    index, total = [], 0
    for key, zname, label in SETS:
        zpath = os.path.join(SRC, zname)
        if not os.path.exists(zpath):
            print('MISSING  %-8s %s' % (key, zpath)); continue
        d = os.path.join(OUT, key)
        os.makedirs(d, exist_ok=True)
        slug = zname.replace('_1k.gltf.zip', '')
        with zipfile.ZipFile(zpath) as zf:
            metres = sphere_diameter(zf)
            diff_b = member(zf, '_diff_1k.jpg', True) or member(zf, '_col_1k.jpg')     # older packs say col
            diff = Image.open(io.BytesIO(diff_b)).convert('RGB')
            nor = Image.open(io.BytesIO(member(zf, '_nor_gl_1k.jpg'))).convert('RGB')
            rough_b, arm_b, spec_b, disp_b = (member(zf, s, True) for s in ('_rough_1k.jpg', '_arm_1k.jpg', '_spec_1k.jpg', '_disp_1k'))
            if rough_b:
                rough, packing = Image.open(io.BytesIO(rough_b)).convert('L'), 'rough'
            elif arm_b:
                rough, packing = Image.open(io.BytesIO(arm_b)).convert('RGB').split()[1], 'arm.G'
            elif spec_b:
                rough, packing = ImageOps.invert(Image.open(io.BytesIO(spec_b)).convert('L')), '1-spec'
            else:
                raise SystemExit('  %s: no rough, arm or spec map' % zname)
        height, hsrc = (Image.open(io.BytesIO(disp_b)).convert('L'), 'disp') if disp_b else (height_from_normal(nor), 'nor->fft')
        n = save(diff, d, 'diff', 88) + save(nor, d, 'nor_gl', 92) + save(rough, d, 'rough', 88) + save(height, d, 'height', 88)
        total += n
        index.append({'key': key, 'slug': slug, 'source': 'Poly Haven', 'licence': 'CC0',
                      'metres': round(metres, 2), 'rough': packing, 'height': hsrc, 'label': label, 'mean': mean_linear(diff)})
        print('%-8s %-20s %6.2f m  rough=%-6s height=%-8s %dx%d  %.1f MB' % (key, slug, metres, packing, hsrc, diff.size[0], diff.size[1], n / 1048576))
    # the lot's five: their real displacement, beside lot_tex_import's maps; their means to assets/lot/means.json
    lot_means = {}
    for key, zname in LOT:
        zpath = os.path.join(LOT_SRC, zname)
        if not os.path.exists(zpath) or not os.path.isdir(os.path.join(LOT_OUT, key)):
            print('MISSING  lot %-8s (zip or assets/lot/%s)' % (key, key)); continue
        with zipfile.ZipFile(zpath) as zf:
            disp = Image.open(io.BytesIO(member(zf, '_Displacement.jpg'))).convert('L')
        n = save(disp, os.path.join(LOT_OUT, key), 'height', 88)
        lot_means[key] = mean_linear(Image.open(os.path.join(LOT_OUT, key, 'diff_512.jpg')))
        print('lot %-6s height=disp %dx%d  %.1f MB' % (key, disp.size[0], disp.size[1], n / 1048576))
    with open(os.path.join(LOT_OUT, 'means.json'), 'w') as f:
        json.dump(lot_means, f, indent=1)
    with open(os.path.join(OUT, 'index.json'), 'w') as f:
        json.dump(index, f, indent=1)
    print('%d sets, %.1f MB under assets/splat/ (untracked); index.json written' % (len(index), total / 1048576))


if __name__ == '__main__':
    main()
