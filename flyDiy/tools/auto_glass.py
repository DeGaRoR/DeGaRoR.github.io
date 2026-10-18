#!/usr/bin/env python3
"""auto_glass.py - THE TRAFFIC CARS' WINDOWS GLAZED (ASSETS-OCT G2906, 2026-10-18; the user, watching the tests: the
decor traffic's windows are GREY and "look really bad" - make them black, or glass like the aircraft props').

WHY. The everyday vehicles (pier kit group 'auto', "Orchids Simulator Traffic Car Pack", G432) paint their windows
INTO each car's own colour atlas: flat pure white (255, 255, 255) inside a dark outline - the pack's glass was the
texture's alpha, which the JPEG bake dropped. Lit, white reads grey. There is no window geometry to give a material,
so the fix is in the atlas: every LARGE flat pure-white region of a car's own colour map becomes dark tinted glass, a
little lighter at its top (the sky in it), the outline kept. SMALL white regions (number plates, highlights, badges)
stay: a region must cover at least MIN_FRAC of the map. The shared wheel atlas (material_28) and every other kit are
untouched; GROUP01 (the small cars' black glass) already is.

THE PACKS: each glazed map is written under its new content id (media/tex/pier/<sha12>.jpg, prop_prep's TexBank
naming), every pier pack's `texs` and the material records that named the old id (the cars and their levels) move to
the new one, and the old file goes. node tools/ktx2_twins.js --family pier then makes the new maps' twins.
A pier re-bake (tools/pier_prep.py) would bring the white back: `--check` finds any unglazed window left and GATE
ASSETBUDGET runs it.

Usage:  python tools/auto_glass.py            (glaze, rewrite the packs)
        python tools/auto_glass.py --report   (count the windows, write nothing)
        python tools/auto_glass.py --check    (exit 1 when a car map still has a white window)
"""
import hashlib, io, json, os, re, sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PIER = os.path.join(ROOT, 'src', 'pier')
SHARED = {'material_28'}          # the wheel / tyre atlas every detailed car shares
WHITE = 247                       # a window texel: every channel at or above this
MIN_FRAC = 0.0025                 # a window covers >= 0.25 % of the map (650 px at 512^2); a plate is ~0.15 %
MAX_FRAC = 0.06                   # ...and <= 6 % (a windscreen is ~4 %): a bigger flat white is a PANEL (a white box
                                  # truck's side), not glass - left as it is and listed
TOP, BOTTOM = np.array([62, 70, 78], float), np.array([16, 19, 23], float)   # dark tinted glass, sky at the top
QUALITY = 90


def pack_files():
    return [f for f in json.load(open(os.path.join(PIER, 'pier_packs.json')))]


def read_pack(f):
    text = open(os.path.join(PIER, f), encoding='utf-8').read().replace('\r\n', '\n')
    i, j = text.rfind('})('), text.rfind('));')
    if i < 0 or j < i:
        raise SystemExit('auto_glass: no payload in ' + f)
    return text, i, j, json.loads(text[i + 3:j])


def windows(rgb):
    """The labelled LARGE flat-white regions of an HxWx3 uint8 image: (mask, count)."""
    white = (rgb >= WHITE).all(axis=2)
    h, w = white.shape
    lab = np.zeros((h, w), np.int32)
    keep = np.zeros((h, w), bool)
    n, kept, need, cap, big = 0, 0, MIN_FRAC * h * w, MAX_FRAC * h * w, []
    ys, xs = np.nonzero(white)
    for y0, x0 in zip(ys, xs):
        if lab[y0, x0]:
            continue
        n += 1
        stack, pix = [(y0, x0)], []
        lab[y0, x0] = n
        while stack:
            y, x = stack.pop()
            pix.append((y, x))
            for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= yy < h and 0 <= xx < w and white[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = n
                    stack.append((yy, xx))
        if len(pix) > cap:
            big.append(len(pix))
        elif len(pix) >= need:
            kept += 1
            for y, x in pix:
                keep[y, x] = True
    return keep, kept, big


def glaze(rgb, keep):
    out = rgb.astype(float).copy()
    ys = np.nonzero(keep.any(axis=1))[0]
    if not len(ys):
        return rgb
    # the gradient runs over each window's own rows: label rows by vertical runs of the mask
    h = rgb.shape[0]
    col = np.zeros_like(out)
    for x in range(rgb.shape[1]):
        c = keep[:, x]
        if not c.any():
            continue
        y = 0
        while y < h:
            if c[y]:
                y1 = y
                while y1 < h and c[y1]:
                    y1 += 1
                t = np.linspace(0, 1, y1 - y)[:, None]
                col[y:y1, x] = TOP * (1 - t) + BOTTOM * t
                y = y1
            else:
                y += 1
    out[keep] = col[keep]
    return np.clip(out, 0, 255).astype(np.uint8)


def car_maps(packs):
    """{old map id: rel path} for the auto group's own colour maps."""
    want = {}
    for f, (_, _, _, p) in packs.items():
        for k, r in p['props'].items():
            if r.get('group') not in ('auto',) and not (r.get('lodOf') or '').startswith('auto_'):
                continue
            for name, m in r.get('mats', {}).items():
                mid = m.get('map')
                if name in SHARED or not isinstance(mid, str):
                    continue
                rel = p['texs'].get(mid)
                if isinstance(rel, str):
                    want[mid] = rel
    return want


def main(argv):
    report, check = '--report' in argv, '--check' in argv
    packs = {f: read_pack(f) for f in pack_files()}
    maps = car_maps(packs)
    remap, left, total = {}, [], 0
    for mid, rel in sorted(maps.items()):
        img = np.array(Image.open(os.path.join(ROOT, *rel.split('/'))).convert('RGB'))
        keep, n, big = windows(img)
        if big:
            print('%s  left as is: %d flat-white panel(s) over %d %% of the map (%s px)' % (rel, len(big), MAX_FRAC * 100, big))
        total += n
        if not n:
            continue
        left.append((rel, n))
        if report or check:
            continue
        # the JPEG re-encode can merge white specks that were each under MIN_FRAC into a window-sized one:
        # glaze, encode, decode, look again - until nothing is left (three passes at most)
        for _ in range(3):
            buf = io.BytesIO()
            Image.fromarray(glaze(img, keep)).save(buf, 'JPEG', quality=QUALITY)
            raw = buf.getvalue()
            img = np.array(Image.open(io.BytesIO(raw)).convert('RGB'))
            keep, more, _ = windows(img)
            if not more:
                break
            n += more
        nid = hashlib.sha256(raw).hexdigest()[:12]
        nrel = 'media/tex/pier/%s.jpg' % nid
        with open(os.path.join(ROOT, *nrel.split('/')), 'wb') as fh:
            fh.write(raw)
        remap[mid] = (nid, nrel, rel)
        print('%s  %d windows -> %s' % (rel, n, nrel))
    if check:
        for rel, n in left:
            print('auto_glass --check: %s still has %d white window(s)' % (rel, n))
        print('auto_glass --check: ' + ('STALE (python tools/auto_glass.py)' if left else 'glazed (%d car maps)' % len(maps)))
        return 1 if left else 0
    if report or not remap:
        print('%d car maps, %d white windows%s' % (len(maps), total, '' if report else ' - nothing to glaze'))
        return 0
    # every pack: the new ids in texs and in every material record that named an old one
    for f, (text, i, j, p) in packs.items():
        changed = False
        for mid, (nid, nrel, _) in remap.items():
            if mid in p['texs']:
                p['texs'][nid] = nrel
                changed = True
            for r in p['props'].values():
                for m in r.get('mats', {}).values():
                    if m.get('map') == mid:
                        m['map'] = nid
                        changed = True
        if changed:
            used = {m.get(s) for r in p['props'].values() for m in r.get('mats', {}).values()
                    for s in ('map', 'nor', 'arm', 'emisMap', 'aoMap')}
            for mid in list(p['texs']):
                if mid not in used:
                    del p['texs'][mid]
            body = text[:i + 3] + json.dumps(p, separators=(',', ':')) + text[j:]
            open(os.path.join(PIER, f), 'w', encoding='utf-8', newline='\n').write(body)
            print('rewrote src/pier/%s' % f)
    # the old maps go when no pier pack names them any more
    named = set()
    for f in pack_files():
        named |= {v for v in read_pack(f)[3]['texs'].values() if isinstance(v, str)}
    for _, _, rel in remap.values():
        if rel not in named:
            os.remove(os.path.join(ROOT, *rel.split('/')))
    print('---\n%d car maps glazed (%d windows); then: node tools/ktx2_twins.js --family pier' % (len(remap), total))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
