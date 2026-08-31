#!/usr/bin/env python3
"""wood_tex_import.py - unpacks the DELIVERED wood sets into the library's
contract at assets/wood/<key>/, and PACKS each one into the AEROSKIN detail
sheet aeroskin.js has promised to accept since G67 ("the loader is written so
a baked CC0 payload can replace them one-for-one: same packing, same names,
same tile metres").

Same two delivered shapes as site_tex_import.py, same contract leaving:

  Poly Haven, packed   *_diff_1k.jpg  *_arm_1k.jpg     *_nor_gl_1k.jpg
  ambientCG            *_Color.jpg    *_Roughness.jpg  *_NormalGL.jpg

  the contract         diff_1k.jpg    rough_1k.jpg     nor_gl_1k.jpg
  plus the PACK        aero_1k.jpg    aero_512.jpg

THE PACK is aeroDetailTex's own layout, derived from the code, not recalled:
  R,G  tangent normal xy. The procedural bake writes G = 0.5 + 0.5*dh/dy
       with y the canvas row (downward); a GL-convention map stores
       G = 0.5 + 0.5*n_y with y UP, and n_y = -dh/dy_up = +dh/dy_down —
       the SAME number. So nor_gl's R and G are copied verbatim: both
       images ride the same CanvasTexture flipY on the way in.
  B    the height-riding channel, MEAN 0.80 - the albedo reads
       1 + uAlb*(B - 0.85), roughness B/0.85, and the wear pass derives its
       valley mask from (0.80 - B)*25, so the mean is a CONTRACT, not a
       taste. Wood is almost all colour grain (G68's own ruling), so B is
       the diffuse's luminance: h = (lum/mean - 1)*gain clamped to +-1,
       B = 0.80 + 0.20*h. The achieved mean is printed; drift past a few
       hundredths means the gain is clipping one tail and wants lowering.
  A    metalness multiplier. JPEG has no alpha; drawImage fills 255, which
       IS the procedural bake's own constant. A payload with real metal
       variation would need PNG - none of these is metal.

The sheet is DATA (linear), like the procedural one - the prep tool's data
URI is decoded and drawn, never colour-managed, so JPEG at subsampling=0 is
safe the same way the nor_gl ground maps already are.

Geometry is NOT imported: every delivered .gltf/.bin is a texture-preview
sphere; the library wants maps, not a ball.

Usage:  python tools/wood_tex_import.py [--src DIR]     (default ~/Downloads)
Then:   node tools/wood_tex_prep.js
"""
import argparse, io, os, zipfile
from PIL import Image, ImageFile, ImageStat

ImageFile.MAXBLOCK = 1 << 24    # site_tex_import.py's own encoder-buffer fix

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'wood')

# key, zip name, shape, provenance for CREDITS.md, and the pack's GAIN -
# how hard the diffuse's luminance drives B. The figured walnut's cathedral
# swirls already span a 2:1 luminance range, so it takes less gain than the
# quiet maple; the numbers were picked by looking at the achieved B spread.
SETS = [
    ('maple',     'white_maple_veneer_1k.gltf.zip',    'ph-arm', 'Poly Haven', 'CC0', 'white_maple_veneer',    7.0),
    ('walnut',    'walnut_veneer_02_1k.gltf.zip',      'ph-arm', 'Poly Haven', 'CC0', 'walnut_veneer_02',      3.0),
    ('walnutfig', 'natural_walnut_veneer_1k.gltf.zip', 'ph-arm', 'Poly Haven', 'CC0', 'natural_walnut_veneer', 2.2),
    ('laminate',  'Wood091B_1K-JPG.zip',               'acg',    'ambientCG',  'CC0', 'Wood091B',              4.5),
]

PICK = {
    'ph-arm': {'diff': '_diff_1k.jpg', 'arm': '_arm_1k.jpg', 'nor': '_nor_gl_1k.jpg'},
    'acg':    {'diff': '_Color.jpg', 'rough': '_Roughness.jpg', 'nor': '_NormalGL.jpg'},
}

SIZES = (1024, 512)   # 1k archive, 512 payload - site_tex_import's budget rule


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


def pack_aero(diff, nor, gain):
    lum = diff.convert('L')
    mean = ImageStat.Stat(lum).mean[0]
    lut = []
    for v in range(256):
        h = max(-1.0, min(1.0, (v / max(mean, 1.0) - 1.0) * gain))
        lut.append(max(0, min(255, round(255 * (0.80 + 0.20 * h)))))
    b = lum.point(lut)
    r, g = nor.split()[0], nor.split()[1]
    return Image.merge('RGB', (r, g, b))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=os.path.join(os.path.expanduser('~'), 'Downloads'))
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for key, zname, shape, author, lic, slug, gain in SETS:
        zpath = os.path.join(a.src, zname)
        if not os.path.exists(zpath):
            print('MISSING  %-10s %s' % (key, zpath)); continue
        d = os.path.join(OUT, key)
        os.makedirs(d, exist_ok=True)
        pick = PICK[shape]
        with zipfile.ZipFile(zpath) as zf:
            diff = Image.open(io.BytesIO(member(zf, pick['diff']))).convert('RGB')
            nor = Image.open(io.BytesIO(member(zf, pick['nor']))).convert('RGB')
            if 'arm' in pick:
                # arm: R = AO, G = roughness, B = metalness. G, and G only.
                arm = Image.open(io.BytesIO(member(zf, pick['arm']))).convert('RGB')
                rough = arm.split()[1]
            else:
                rough = Image.open(io.BytesIO(member(zf, pick['rough']))).convert('L')
        n = save(diff, d, 'diff', 88)
        n += save(nor, d, 'nor_gl', 92)
        n += save(rough, d, 'rough', 88)
        aero = pack_aero(diff, nor, gain)
        n += save(aero, d, 'aero', 92)      # normals ride B here: quality 92
        total += n
        # what the finish row wants to know: the base colour a tint of white
        # reproduces, and whether the pack held its contract mean
        mc = ImageStat.Stat(diff).mean
        bm = ImageStat.Stat(aero.split()[2]).mean[0] / 255
        bex = ImageStat.Stat(aero.split()[2]).extrema[0]
        print('%-10s %-22s base 0x%02x%02x%02x  B mean %.3f  span %d..%d  %.1f MB'
              % (key, slug, round(mc[0]), round(mc[1]), round(mc[2]),
                 bm, bex[0], bex[1], n / 1048576))
    print('\n%d sets, %.1f MB on disk (payload picks 512 - tools/wood_tex_prep.js)'
          % (len(SETS), total / 1048576))


if __name__ == '__main__':
    main()
