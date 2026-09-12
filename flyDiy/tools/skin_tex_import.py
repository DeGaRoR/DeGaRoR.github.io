#!/usr/bin/env python3
"""skin_tex_import.py - the AEROSKIN detail sheets that are NOT wood.

tools/wood_tex_import.py landed the first scanned sheets (G125) and its whole
apparatus - the delivered shapes, the contract names, the pack, the 1k archive
beside the 512 payload - is material-agnostic. Only its SOURCE directory and
its B-channel rule were about wood. This is the same tool for the rest of the
library, starting with the firewall's fireproof foil.

  Poly Haven, packed   *_diff_1k.jpg  *_arm_1k.jpg     *_nor_gl_1k.jpg
  ambientCG            *_Color.jpg    *_Roughness.jpg  *_NormalGL.jpg

  the contract         diff_1k.jpg    rough_1k.jpg     nor_gl_1k.jpg
  plus the PACK        aero_1k.jpg    aero_512.jpg

THE PACK is aeroDetailTex's layout, as wood_tex_import.py derived it:
  R,G  tangent normal xy, copied verbatim from nor_gl (both images ride the
       same CanvasTexture flipY on the way in - see that file for the proof
       that the GL convention and the bake's own dh/dy are the same number).
  B    the height-riding channel, MEAN 0.80. The albedo reads
       1 + uAlb*(B - 0.85), roughness B/0.85, and the wear pass takes its
       valley mask from (0.80 - B)*25, so the mean is a CONTRACT.
  A    metalness multiplier. JPEG has no alpha; drawImage fills 255, which IS
       the procedural bake's constant, so a set whose metalness map is uniform
       (foil: 255 everywhere, measured) loses nothing - the finish row's own
       `metal` scalar carries it.

WHAT B RIDES IS A PER-SET DECISION, and it is the one thing this tool asks
that wood's did not. Wood is almost all colour grain (G68's ruling three times
over), so there B is the diffuse's luminance. A METAL FOIL IS THE OPPOSITE:
Foil001's Color map is flat grey (mean 127.5, span 121..134 - measured), all
of it JPEG noise, while its Roughness spans 13..37 around a mean of 25 and
follows the crinkle exactly. Driving B off the diffuse there would amplify
noise into the albedo and leave the roughness variation - the ONLY thing that
makes crumpled metal read as crumpled - on the floor. So `bsrc` names the map:
'lum' (wood's rule) or 'rough' (a metal's).

Usage:  python tools/skin_tex_import.py [--src DIR]     (default ~/Downloads)
Then:   node tools/skin_tex_prep.js
"""
import argparse, io, os, zipfile
from PIL import Image, ImageFile, ImageStat

ImageFile.MAXBLOCK = 1 << 24    # site_tex_import.py's own encoder-buffer fix

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'skin')

# key, zip name, shape, provenance for CREDITS.md, what B rides, and the GAIN
# (how hard that map drives B). Foil001's roughness spans +-0.45 of its own
# mean, so gain 2.0 opens it to very nearly the full 0.60..0.98 the sheet
# convention allows without clipping either tail - the achieved span is
# printed, which is how that number was picked.
SETS = [
    ('foil', 'Foil001_1K-JPG.zip', 'acg', 'ambientCG', 'CC0', 'Foil001', 'rough', 2.0),
    # THE DASHBOARD'S TWO SURFACES (2026-09-04). Same argument as the foil's,
    # measured the same way, and it lands on OPPOSITE answers for the two:
    #   Metal050C  Color 245,246,245 span 218..254 (nothing), Roughness mean
    #              0.240 with p1..p99 at 0.62..1.70 of that mean. B rides the
    #              roughness, gain 1.3 -> h -0.49..+0.91 = B 0.70..0.98, very
    #              nearly the full convention range with neither tail clipped.
    #   Leather027 the mirror image: Roughness p1..p99 is 0.90..1.12 of its
    #              mean — flat, and opening THAT to the full range would be
    #              amplifying JPEG noise 8x — while the Color's own p1..p99 is
    #              0.65..1.76, the crease pattern. So B rides luminance here,
    #              wood's rule, gain 1.2 -> h -0.42..+0.91.
    ('panel', 'Metal050C_1K-JPG.zip', 'acg', 'ambientCG', 'CC0', 'Metal050C', 'rough', 1.3),
    ('leather', 'Leather027_1K-JPG.zip', 'acg', 'ambientCG', 'CC0', 'Leather027', 'lum', 1.2),
    # THE COCKPIT'S HANDS-ON SURFACES (the panel arc, session 4f, the user's
    # own five from assets/interior/): what a hand touches. B rides the
    # roughness on the plastics and the rubber (their colour is flat, their
    # scratches and grain are in the roughness), the luminance on the leather
    # (Leather027's rule: the creases are in the colour).
    #   Plastic007   a scratched glossy plastic      -> the throttle's ball, the buttons' caps
    #   Plastic012A  a fine-grained matte plastic    -> the dimmer knobs, the moulded pieces
    #   Plastic017B  a worn, scuffed semi-gloss      -> the compass bowl, the switch bezels
    #   Rubber004    a fine-grained rubber           -> the stick's grip and boot, the pedal treads
    #   fabric_leather_01 (Poly Haven) a brown hide  -> the yoke's horns
    ('plasticScr', 'Plastic007_1K-JPG.zip', 'acg', 'ambientCG', 'CC0', 'Plastic007', 'rough', 1.6),
    ('plasticGrn', 'Plastic012A_1K-JPG.zip', 'acg', 'ambientCG', 'CC0', 'Plastic012A', 'rough', 1.6),
    ('plasticWorn', 'Plastic017B_1K-JPG.zip', 'acg', 'ambientCG', 'CC0', 'Plastic017B', 'rough', 1.6),
    ('rubberGrip', 'Rubber004_1K-JPG.zip', 'acg', 'ambientCG', 'CC0', 'Rubber004', 'rough', 1.6),
    ('hide', 'fabric_leather_01_1k.gltf.zip', 'ph-sep', 'Poly Haven', 'CC0', 'fabric_leather_01', 'lum', 1.2),
]

PICK = {
    'ph-arm': {'diff': '_diff_1k.jpg', 'arm': '_arm_1k.jpg', 'nor': '_nor_gl_1k.jpg'},
    'acg':    {'diff': '_Color.jpg', 'rough': '_Roughness.jpg', 'nor': '_NormalGL.jpg'},
    # Poly Haven's gltf zip: the three maps loose under textures/, no arm
    'ph-sep': {'diff': '_diff_1k.jpg', 'rough': '_rough_1k.jpg', 'nor': '_nor_gl_1k.jpg'},
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


def pack_aero(drive, nor, gain):
    """drive is the single-channel map B rides - the diffuse's luminance for a
    wood, the roughness for a metal. Same recentring either way: the map's own
    mean becomes 0.80, and gain sets how much of the 0.60..0.98 range the
    excursion is opened to."""
    mean = ImageStat.Stat(drive).mean[0]
    lut = []
    for v in range(256):
        h = max(-1.0, min(1.0, (v / max(mean, 1.0) - 1.0) * gain))
        lut.append(max(0, min(255, round(255 * (0.80 + 0.20 * h)))))
    b = drive.point(lut)
    r, g = nor.split()[0], nor.split()[1]
    return Image.merge('RGB', (r, g, b))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=os.path.join(os.path.expanduser('~'), 'Downloads'))
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for key, zname, shape, author, lic, slug, bsrc, gain in SETS:
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
        aero = pack_aero(diff.convert('L') if bsrc == 'lum' else rough, nor, gain)
        n += save(aero, d, 'aero', 92)      # normals ride B here: quality 92
        total += n
        # what the finish row wants to know: the base colour a tint of white
        # reproduces, the roughness the scan itself measured, and whether the
        # pack held its contract mean
        mc = ImageStat.Stat(diff).mean
        rm = ImageStat.Stat(rough).mean[0] / 255
        bm = ImageStat.Stat(aero.split()[2]).mean[0] / 255
        bex = ImageStat.Stat(aero.split()[2]).extrema[0]
        print('%-10s %-22s base 0x%02x%02x%02x  rough %.3f  B(%s) mean %.3f  '
              'span %d..%d  %.1f MB'
              % (key, slug, round(mc[0]), round(mc[1]), round(mc[2]), rm, bsrc,
                 bm, bex[0], bex[1], n / 1048576))
    print('\n%d sets, %.1f MB on disk (payload picks 512 - tools/skin_tex_prep.js)'
          % (len(SETS), total / 1048576))


if __name__ == '__main__':
    main()
