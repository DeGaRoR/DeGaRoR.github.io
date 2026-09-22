#!/usr/bin/env python3
"""pavement_tex_import.py - THE PAVEMENT LIBRARY (roads & runways, 2026-09-21).

The sets the pavement material draws roads and runways with - concrete, asphalt,
gravel, dirt, sand, the shoulders' tracks and the moss - normalised to the one
contract every ground library in this repo uses (diff / nor_gl / rough / height,
1k archive + 512 working copy) under assets/pavement/<key>/, plus
assets/pavement/index.json: key, source slug, licence, THE REFERENCE SCALE and
the mean colour.

--fetch: the packs are read STRAIGHT OFF POLY HAVEN (CC0): api.polyhaven.com/
files/<slug> names the 1k jpg of every map, /info/<slug> gives `dimensions` in
millimetres - the texture's real size, which is what the shader tiles it by.
Nothing is guessed: no diameter off a preview sphere, no typed-in metres. A map
already on disk under assets/pavement/_dl/ is not fetched twice.

Roughness comes in two packings (told apart by what the API lists):
  Rough   a plain map                 arm   AO / ROUGHNESS / metal - the GREEN channel
THE HEIGHT (for the hex tiling's height blend): Poly Haven's Displacement map
where the pack has one; otherwise integrated from the normal map the way
splat_tex_import.py does (Frankot-Chellappa, high-passed at an eighth of the tile).

Usage:  py -3.11 tools/pavement_tex_import.py --fetch [--out DIR] [--only key,key]
Then:   node tools/pavement_tex_prep.js
The archive goes to the MAIN checkout's gitignored assets/ by default (a worktree
carries no link to it - never junction, G434.1); --out overrides.
"""
import argparse, io, json, os, sys, urllib.request
import numpy as np
from PIL import Image, ImageFile
ImageFile.MAXBLOCK = 1 << 22

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MAIN = 'D:/Dev/DeGaRoR.github.io/flyDiy/assets'
API = 'https://api.polyhaven.com'

# key, Poly Haven slug, ROLE (what the class rows reach for), label
SETS = [
    ('concreteA',  'damaged_concrete_floor',     'base',    'the WWII runway - damaged poured concrete'),
    ('concreteB',  'damaged_concrete_floor_02',  'damage',  'the runway broken up - the damage layer'),
    ('concreteM',  'concrete_moss',              'moss',    'moss on concrete - the edges and the joints'),
    ('concreteD',  'dirty_concrete',             'base',    'dirty concrete - taxiway / apron'),
    ('asphaltW',   'worn_asphalt',               'base',    'worn asphalt - the road'),
    ('asphaltC',   'road_damaged',               'damage',  'cracked asphalt - the road damaged'),
    ('gravelR',    'gravel_road',                'base',    'a gravel road'),
    ('gravelK',    'rocky_gravel',               'shoulder','rocky gravel - the shoulder band'),
    ('gravelS',    'sandy_gravel_02',            'base',    'sandy gravel - the transition to sand'),
    ('dirtP',      'park_dirt',                  'base',    'park dirt - the dirt road'),
    ('tracksM',    'muddy_tracks',               'tracks',  'muddy tracks - the ruts'),
    ('mudAir',     'aerial_mud_1',               'tracks',  'aerial mud with tyre tracks - the cleared band'),
    ('dirtAir',    'dirt_aerial_02',             'macro',   'dirt from above - the macro tier'),
    ('sandC',      'coast_sand_04',              'base',    'coast sand - the sand strip'),
    # the second batch (2026-09-22, the user: "the soft ones deserve more love ... the gravel one should be grey")
    ('gravelG',    'gravel_ground_01',           'base',    'gravel ground - the grey gravel strip'),
    ('gravelF',    'gravel_floor_02',            'base',    'fine grey gravel - the compacted wheel band'),
    ('gravelB',    'gravel_stones',              'shoulder','crushed dark stone - the strip edges'),
    ('rockG',      'rock_ground_02',             'damage',  'rocky ground - the coarse patches of a gravel strip'),
    ('dirtS',      'stony_dirt_path',            'base',    'stony dirt path - the dirt road'),
    ('trailR',     'rocky_trail',                'damage',  'rocky trail - the dirt road coarse patches'),
    ('dirtG',      'dirt',                       'tracks',  'plain dirt - the compacted wheel tracks'),
    ('grassG',     'grass_ground',               'base',    'meadow grass - the grass strip'),
    ('grassP',     'grass_path_2',               'tracks',  'worn grass with soil - the strip wheel tracks'),
    ('grassS',     'sparse_grass',               'damage',  'sparse mossy grass - the strip rough patches'),
]
SIZES = (1024, 512)


def mean_linear(img):
    a = np.asarray(img.convert('RGB').resize((64, 64), Image.BOX), dtype='float64') / 255.0
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    return [round(float(v), 4) for v in lin.reshape(-1, 3).mean(0)]


def height_from_normal(nor):
    """Integrate a GL normal map (tangent space, +y up) to a 0..1 height (splat_tex_import.py's)."""
    n = np.asarray(nor.convert('RGB'), dtype='float64') / 255.0 * 2.0 - 1.0
    nz = np.clip(n[..., 2], 0.05, 1.0)
    p, q = -n[..., 0] / nz, -n[..., 1] / nz
    H, W = p.shape
    wx = np.fft.fftfreq(W)[None, :] * 2 * np.pi
    wy = np.fft.fftfreq(H)[:, None] * 2 * np.pi
    P, Q = np.fft.fft2(p), np.fft.fft2(-q)
    d = wx ** 2 + wy ** 2; d[0, 0] = 1.0
    Hf = (-1j * wx * P - 1j * wy * Q) / d; Hf[0, 0] = 0.0
    k0 = 2 * np.pi / (W / 8.0)
    Hf *= 1.0 - np.exp(-(d / (k0 * k0)))
    h = np.real(np.fft.ifft2(Hf))
    lo, hi = np.percentile(h, 1), np.percentile(h, 99)
    return Image.fromarray(np.clip((h - lo) / max(hi - lo, 1e-9) * 255.0, 0, 255).astype('uint8'), 'L')


def get_json(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'flyDiy pavement_tex_import'}), timeout=60) as r:
        return json.loads(r.read().decode('utf8'))


def fetch(url, dst):
    if os.path.exists(dst) and os.path.getsize(dst) > 0:
        return os.path.getsize(dst), False
    # the CDN stalls now and then mid-file: three tries, the partial never kept
    err = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'flyDiy pavement_tex_import'}), timeout=120) as r:
                data = r.read()
            with open(dst, 'wb') as f:
                f.write(data)
            return len(data), True
        except Exception as e:      # noqa: BLE001 - a stalled socket, a reset; retried
            err = e
    raise SystemExit('  fetch failed after 3 tries: %s (%s)' % (url, err))


def flatten(img, k=0.7, frac=4.0):
    """THE LOW FREQUENCIES TAKEN OUT (2026-09-22, the user: "high contrast hex patterns, very noticeable").
    A scanned ground tile drifts in tone across itself - one corner darker, a damp side - and once
    the shader cuts it into hex cells with random offsets every cell lands on a different part of that
    drift: the cell borders become seams and the tiling shows as a mosaic. The luminance is divided
    by its own blur (a quarter of the tile) and multiplied back by the tile's mean, in linear light,
    colour kept; the large-scale variation a surface really has is the shader's (the macro noise,
    the patches), not the scan's."""
    a = np.asarray(img.convert('RGB'), dtype='float64') / 255.0
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    lum = 0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2]
    W = lum.shape[1]
    # a periodic blur: the tile wraps, so the blur wraps (FFT), a quarter-tile gaussian
    sig = W / frac
    fx = np.fft.fftfreq(W)[None, :]; fy = np.fft.fftfreq(lum.shape[0])[:, None]
    G = np.exp(-2.0 * (np.pi * sig) ** 2 * (fx ** 2 + fy ** 2))
    blur = np.real(np.fft.ifft2(np.fft.fft2(lum) * G))
    mean = lum.mean()
    gain = (mean / np.maximum(blur, 1e-4)) ** k
    out = np.clip(lin * gain[..., None], 0.0, 1.0)
    srgb = np.where(out <= 0.0031308, out * 12.92, 1.055 * out ** (1 / 2.4) - 0.055)
    return Image.fromarray((srgb * 255.0 + 0.5).astype('uint8'), 'RGB')


def recentre(nor):
    """THE MEAN TILT TAKEN OUT (2026-09-22): a scanned normal map can lean as a whole - gravel_ground_01's
    mean is (0.44, 0.44), a 30 degree lean baked into the scan, rock_ground_02's 0.04 - and once the
    shader turns each hex cell by its own angle every cell is lit from a different side: a mosaic that
    hex-off or normals-off both cure. A tileable ground's mean normal is straight up by definition;
    the lean is subtracted and the map renormalised. Returns the map and the tilt it had."""
    n = np.asarray(nor.convert('RGB'), dtype='float64') / 255.0 * 2.0 - 1.0
    mx, my = n[..., 0].mean(), n[..., 1].mean()
    n[..., 0] -= mx; n[..., 1] -= my
    n[..., 2] = np.sqrt(np.clip(1.0 - n[..., 0] ** 2 - n[..., 1] ** 2, 0.04, 1.0))
    out = np.clip((n + 1.0) * 0.5 * 255.0 + 0.5, 0, 255).astype('uint8')
    return Image.fromarray(out, 'RGB'), (round(float(mx), 3), round(float(my), 3))


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
    ap.add_argument('--fetch', action='store_true', help='download the 1k jpg maps off Poly Haven (CC0) into <out>/_dl/')
    ap.add_argument('--out', default=os.path.join(MAIN, 'pavement'))
    ap.add_argument('--only', default='', help='comma-separated keys')
    a = ap.parse_args()
    OUT = a.out
    DL = os.path.join(OUT, '_dl')
    os.makedirs(DL, exist_ok=True)
    only = set(k for k in a.only.split(',') if k)
    index_path = os.path.join(OUT, 'index.json')
    index = {e['key']: e for e in (json.load(open(index_path)) if os.path.exists(index_path) else [])}
    total = 0
    for key, slug, role, label in SETS:
        if only and key not in only:
            continue
        d = os.path.join(OUT, key)
        os.makedirs(d, exist_ok=True)
        maps = {}
        if a.fetch:
            files = get_json('%s/files/%s' % (API, slug))
            info = get_json('%s/info/%s' % (API, slug))
            dims = info.get('dimensions') or [0, 0]
            metres = round(dims[0] / 1000.0, 3)
            authors = ', '.join(info.get('authors', {}).keys())
            want = [('diff', 'Diffuse'), ('nor', 'nor_gl'), ('rough', 'Rough'), ('arm', 'arm'), ('disp', 'Displacement')]
            for stem, api_key in want:
                ent = files.get(api_key, {}).get('1k', {}).get('jpg')
                if not ent:
                    continue
                dst = os.path.join(DL, '%s_%s_1k.jpg' % (slug, stem))
                n, new = fetch(ent['url'], dst)
                maps[stem] = dst
                print('  %-8s %-6s %7.0f kB %s' % (key, stem, n / 1024, 'fetched' if new else 'cached'))
            meta = {'metres': metres, 'authors': authors}
        else:
            # no fetch: the maps must be in _dl already, the metres in the index
            for stem in ('diff', 'nor', 'rough', 'arm', 'disp'):
                p = os.path.join(DL, '%s_%s_1k.jpg' % (slug, stem))
                if os.path.exists(p):
                    maps[stem] = p
            prev = index.get(key)
            if not prev:
                print('MISSING  %-10s (no index row; run with --fetch)' % key); continue
            meta = {'metres': prev['metres'], 'authors': prev.get('authors', '')}
        if 'diff' not in maps or 'nor' not in maps:
            print('MISSING  %-10s %s: no diffuse/normal in _dl (run --fetch)' % (key, slug)); continue
        diff = Image.open(maps['diff']).convert('RGB')
        nor = Image.open(maps['nor']).convert('RGB')
        if 'rough' in maps:
            rough, packing = Image.open(maps['rough']).convert('L'), 'rough'
        elif 'arm' in maps:
            rough, packing = Image.open(maps['arm']).convert('RGB').split()[1], 'arm.G'
        else:
            print('MISSING  %-10s %s: no rough or arm map' % (key, slug)); continue
        if 'disp' in maps:
            height, hsrc = Image.open(maps['disp']).convert('L'), 'disp'
        else:
            height, hsrc = height_from_normal(nor), 'nor->fft'
        flat = role != 'macro'                      # the aerial macro tiers keep their large scale: they ARE the large scale
        # a loose ground (the soft classes' sets) is flattened harder: its metre-scale blotches would
        # show per hex cell; a concrete's or an asphalt's larger stains are what makes it read
        loose = key not in ('concreteA', 'concreteB', 'concreteM', 'concreteD', 'asphaltW', 'asphaltC')
        if flat:
            diff = flatten(diff, 0.85 if loose else 0.7, 8.0 if loose else 4.0)
        nor, tilt = recentre(nor)
        n = save(diff, d, 'diff', 88) + save(nor, d, 'nor_gl', 92) + save(rough, d, 'rough', 88) + save(height, d, 'height', 88)
        total += n
        index[key] = {'key': key, 'slug': slug, 'source': 'Poly Haven', 'licence': 'CC0', 'authors': meta['authors'],
                      'metres': meta['metres'], 'rough': packing, 'height': hsrc, 'role': role, 'label': label, 'mean': mean_linear(diff), 'flat': flat, 'tilt': tilt}
        print('%-10s %-26s %6.2f m  rough=%-6s height=%-8s tilt %s  %dx%d  %.1f MB' % (key, slug, meta['metres'], packing, hsrc, tilt, diff.size[0], diff.size[1], n / 1048576))
    rows = [index[k] for k, _, _, _ in SETS if k in index]
    with open(index_path, 'w') as f:
        json.dump(rows, f, indent=1)
    print('%d sets, %.1f MB under %s (untracked); index.json written' % (len(rows), total / 1048576, OUT))
    # THE AIRFIELD SETS THE CLASSES REUSE (cracked, brushed, asphalt, aerial asphalt): site_tex_import.py
    # kept no height for them - integrated from their normals here, written beside their maps, so
    # every layer of the pavement's arrays carries a height for the hex blend (the lot's five have
    # their real displacement from splat_tex_import.py)
    # THE REUSED SETS (the airfield's, the lot's): a flattened copy of the colour and a height under
    # assets/pavement/_legacy/<key>/ - their own directories are other bakers' and stay as they are
    legacy = [('cracked', 'airfield'), ('brushed', 'airfield'), ('asphalt', 'airfield'), ('asphaltaerial', 'airfield'), ('leafygrass', 'airfield'), ('grass005', 'airfield'),
              ('lush', 'lot'), ('grass', 'lot'), ('pebble', 'lot'), ('dry', 'lot'), ('dirt', 'lot')]
    for key, lib in legacy:
        d = os.path.join(os.path.dirname(OUT), lib, key)
        src = os.path.join(d, 'diff_1k.jpg')
        if not os.path.exists(src):
            print('MISSING  %s %-14s (%s)' % (lib, key, src)); continue
        out = os.path.join(OUT, '_legacy', key)
        os.makedirs(out, exist_ok=True)
        diff = Image.open(src).convert('RGB')
        n = save(diff if key == 'asphaltaerial' else flatten(diff, 0.85 if lib == 'lot' or 'grass' in key else 0.7, 8.0 if lib == 'lot' or 'grass' in key else 4.0), out, 'diff', 88)
        hsrc = os.path.join(d, 'height_1k.jpg')
        nor_src = Image.open(os.path.join(d, 'nor_gl_1k.jpg'))
        height = Image.open(hsrc).convert('L') if os.path.exists(hsrc) else height_from_normal(nor_src)
        n += save(height, out, 'height', 88)
        nor, tilt = recentre(nor_src)
        n += save(nor, out, 'nor_gl', 92)
        print('%-8s %-12s flattened colour + height  %.1f MB' % (lib, key, n / 1048576))


if __name__ == '__main__':
    main()
