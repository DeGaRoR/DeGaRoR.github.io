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
THE NORMALS (the still of 18 Oct 17:45, the real cause of the frosted grey): the pack's normals are rotated 180 deg
about x against the geometry - flipped to (nx, -ny, -nz) in the cars' bins and their levels (normals_pass).
THE SHEEN (the after still, 18 Oct 16:20): dark glass under the pack's ARM (roughness 0.4, metal ~0.2) still read as a
milky grey sheet - so under every glazed window the ARM becomes smooth (GLASS_G) and non-metal (GLASS_B), the occlusion
kept, the window found by the glaze's own tint (glass_of).
A pier re-bake (tools/pier_prep.py) would bring the white back: `--check` finds any unglazed window left and GATE
ASSETBUDGET runs it.

Usage:  python tools/auto_glass.py            (glaze, rewrite the packs)
        python tools/auto_glass.py --report   (count the windows, write nothing)
        python tools/auto_glass.py --check    (exit 1 when a car map still has a white window)
"""
import gzip, hashlib, io, json, os, re, struct, sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from media_lib import write_media          # noqa: E402

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
FLIP0, FLIP = np.array([1, 1, 1]), np.array([1, -1, -1])
NORMAL_OK = 0.9                   # a mesh whose normals agree with its winding on >= 90 % of its triangles is right
RIM = 170                         # a fringe texel next to the glass: every channel at or above this
GLASS_G, GLASS_B = 38, 0          # the glass texels' ARM: roughness 0.4 x 38/255 = 0.06 (smooth), metalness 0: a dark
                                  # pane reflects the sky sharp and thin; the pack's 0.4 / 0.2 read as a milky grey sheet


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
            if not SHARED & set(r.get('mats', {})):
                continue      # a low-poly car (no shared wheel atlas): its flat white is BODY paint, its glass geometry
            for name, m in r.get('mats', {}).items():
                mid = m.get('map')
                if name in SHARED or not isinstance(mid, str):
                    continue
                rel = p['texs'].get(mid)
                if isinstance(rel, str):
                    want[mid] = rel
    return want


def glass_of(rgb):
    """The glazed texels of a colour map: on the BOTTOM..TOP tint (JPEG noise allowed), blue a few levels over red
    (a neutral black trim is not glass)."""
    a = rgb.astype(float)
    d = TOP - BOTTOM
    t = np.clip(((a - BOTTOM) @ d) / (d @ d), 0, 1)
    near = np.linalg.norm(a - (BOTTOM + t[..., None] * d), axis=2) < 9
    return near & (a[..., 2] - a[..., 0] >= 4)


def car_arms(packs):
    """{arm id: {colour map ids}} for the auto group's own materials."""
    out = {}
    for _, (_, _, _, p) in packs.items():
        for r in p['props'].values():
            if r.get('group') != 'auto' and not (r.get('lodOf') or '').startswith('auto_'):
                continue
            if not SHARED & set(r.get('mats', {})):
                continue      # a low-poly car: not glazed, its ARM left as delivered
            for name, m in r.get('mats', {}).items():
                if name in SHARED or not isinstance(m.get('map'), str) or not isinstance(m.get('arm'), str):
                    continue
                out.setdefault(m['arm'], set()).add(m['map'])
    return out


def arm_pass(packs, check):
    """THE SHEEN: under every glazed window the ARM's roughness to GLASS_G and metalness to GLASS_B (the occlusion
    kept). Returns ({old arm id: (new id, new rel, old rel)}, [the arm maps still rough under glass])."""
    texs = {}
    for _, (_, _, _, p) in packs.items():
        texs.update({k: v for k, v in p['texs'].items() if isinstance(v, str)})
    remap, stale = {}, []
    for aid, cols in sorted(car_arms(packs).items()):
        rel = texs.get(aid)
        if not rel:
            continue
        arm = np.array(Image.open(os.path.join(ROOT, *rel.split('/'))).convert('RGB'))
        mask = np.zeros(arm.shape[:2], bool)
        for cid in cols:
            crel = texs.get(cid)
            if not crel:
                continue
            col = Image.open(os.path.join(ROOT, *crel.split('/'))).convert('RGB')
            if col.size != (arm.shape[1], arm.shape[0]):
                col = col.resize((arm.shape[1], arm.shape[0]), Image.NEAREST)
            mask |= glass_of(np.array(col))
        if mask.sum() < MIN_FRAC * mask.size:
            continue
        rough = float(arm[..., 1][mask].mean())
        if rough <= GLASS_G + 12:
            continue                                  # already smooth
        stale.append(rel)
        if check:
            continue
        arm[..., 1][mask] = GLASS_G
        arm[..., 2][mask] = GLASS_B
        buf = io.BytesIO()
        Image.fromarray(arm).save(buf, 'JPEG', quality=QUALITY)
        raw = buf.getvalue()
        nid = hashlib.sha256(raw).hexdigest()[:12]
        nrel = 'media/tex/pier/%s.jpg' % nid
        with open(os.path.join(ROOT, *nrel.split('/')), 'wb') as fh:
            fh.write(raw)
        remap[aid] = (nid, nrel, rel)
        print('%s  glass ARM: %d px, roughness %.0f -> %d -> %s' % (rel, int(mask.sum()), rough, GLASS_G, nrel))
    return remap, stale


def rewrite(packs, remap, slot):
    """Every pack: the new ids in texs and in every material record whose `slot` named an old one; the old files go
    when no pier pack names them any more."""
    if not remap:
        return
    for f, (text, i, j, p) in packs.items():
        changed = False
        for mid, (nid, nrel, _) in remap.items():
            if mid in p['texs']:
                p['texs'][nid] = nrel
                changed = True
            for r in p['props'].values():
                for m in r.get('mats', {}).values():
                    if m.get(slot) == mid:
                        m[slot] = nid
                        changed = True
        if changed:
            used = {m.get(s) for r in p['props'].values() for m in r.get('mats', {}).values()
                    for s in ('map', 'nor', 'arm', 'emisMap', 'aoMap')}
            for mid in list(p['texs']):
                if mid not in used:
                    del p['texs'][mid]
            body = text[:i + 3] + json.dumps(p, separators=(',', ':')) + text[j:]
            open(os.path.join(PIER, f), 'w', encoding='utf-8', newline='\n').write(body)
            print('rewrote src/pier/%s (%s)' % (f, slot))
    named = set()
    for f in pack_files():
        named |= {v for v in read_pack(f)[3]['texs'].values() if isinstance(v, str)}
    for _, _, rel in remap.values():
        if rel not in named:
            os.remove(os.path.join(ROOT, *rel.split('/')))


def auto_keys(p):
    return [k for k, r in p['props'].items()
            if r.get('group') == 'auto' or (r.get('lodOf') or '').startswith('auto_')]


def read_bin(rel):
    raw = open(os.path.join(ROOT, *rel.split('/')), 'rb').read()
    return bytearray(gzip.decompress(raw) if rel.endswith('.gz.bin') else raw)


def winding(buf, parts, flip):
    """The share of triangles whose vertex normals (x, y, z scaled by `flip`) agree with their winding."""
    agree = tot = 0
    for part in parts:
        o = part['off']
        nv, nt = struct.unpack_from('<II', buf, o)
        pos = np.frombuffer(bytes(buf[o + 8:o + 8 + nv * 6]), '<i2').reshape(nv, 3).astype(float)
        nrm = np.frombuffer(bytes(buf[o + 8 + nv * 6:o + 8 + nv * 9]), 'i1').reshape(nv, 3).astype(float) * flip
        io_ = o + 8 + nv * 13
        idx = np.frombuffer(bytes(buf[io_:io_ + nt * 6]), '<u2').reshape(nt, 3)
        a, b, c = pos[idx[:, 0]], pos[idx[:, 1]], pos[idx[:, 2]]
        n = np.cross(b - a, c - a)
        vn = nrm[idx[:, 0]] + nrm[idx[:, 1]] + nrm[idx[:, 2]]
        agree += int(((n * vn).sum(axis=1) >= 0).sum())
        tot += nt
    return agree / max(1, tot)


def normals_pass(packs, check):
    """THE NORMALS (the still of 18 Oct 17:45): the pack's normals are rotated 180 deg about x against their geometry
    - every up-facing face of all 42 cars carried a downward normal, so the tops never took the sun and the sky lit
    them from below (the frosted grey). (nx, -ny, -nz) agrees with the winding; flipped where the as-is agreement is
    poor and the flipped one good. Returns {pack file: [keys rewritten]} and the stale keys."""
    done, stale = {}, []
    for f, (_, _, _, p) in packs.items():
        for k in auto_keys(p):
            r = p['props'][k]
            if not r.get('bin'):
                continue
            buf = read_bin(r['bin'])
            asis, fl = winding(buf, r['parts'], FLIP0), winding(buf, r['parts'], FLIP)
            if asis >= NORMAL_OK or fl < NORMAL_OK:
                continue                      # already right (or not this fault: left alone)
            stale.append(k)
            if check:
                continue
            for part in r['parts']:
                o = part['off']
                nv = struct.unpack_from('<I', buf, o)[0]
                n0 = o + 8 + nv * 6
                nrm = np.frombuffer(bytes(buf[n0:n0 + nv * 3]), 'i1').reshape(nv, 3).astype(int)
                nrm[:, 1] = -nrm[:, 1]
                nrm[:, 2] = -nrm[:, 2]
                buf[n0:n0 + nv * 3] = np.clip(nrm, -127, 127).astype('i1').tobytes()
            old = r['bin']
            sub = os.path.dirname(old).replace('media/', '', 1)
            r['bin'] = write_media(sub, k, 'bin', bytes(buf))
            if r['bin'] != old:
                os.remove(os.path.join(ROOT, *old.split('/')))
            done.setdefault(f, []).append(k)
    return done, stale


def write_pack(f, text, i, j, p):
    body = text[:i + 3] + json.dumps(p, separators=(',', ':')) + text[j:]
    open(os.path.join(PIER, f), 'w', encoding='utf-8', newline='\n').write(body)


def rims_pass(packs):
    """THE RIMS: the JPEG left a thin bright fringe (just under WHITE) round some glazed windows - every bright texel
    within 2 px of the glass takes the mean of the glass round it. Returns {old map id: (new id, new rel, old rel)}."""
    remap = {}
    for mid, rel in sorted(car_maps(packs).items()):
        img = np.array(Image.open(os.path.join(ROOT, *rel.split('/'))).convert('RGB'))
        g = glass_of(img)
        if g.sum() < MIN_FRAC * g.size:
            continue
        near = g.copy()
        for _ in range(2):
            n2 = near.copy()
            n2[1:] |= near[:-1]; n2[:-1] |= near[1:]; n2[:, 1:] |= near[:, :-1]; n2[:, :-1] |= near[:, 1:]
            near = n2
        rim = near & ~g & (img.min(axis=2) >= RIM)
        if rim.sum() < 20:
            continue
        acc = np.zeros(img.shape, float)
        cnt = np.zeros(img.shape[:2], float)
        gi = img.astype(float) * g[..., None]
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                acc += np.roll(np.roll(gi, dy, 0), dx, 1)
                cnt += np.roll(np.roll(g.astype(float), dy, 0), dx, 1)
        fill = acc / np.maximum(cnt, 1)[..., None]
        out = img.copy()
        out[rim] = np.clip(fill[rim], 0, 255).astype(np.uint8)
        buf = io.BytesIO()
        Image.fromarray(out).save(buf, 'JPEG', quality=QUALITY)
        raw = buf.getvalue()
        nid = hashlib.sha256(raw).hexdigest()[:12]
        nrel = 'media/tex/pier/%s.jpg' % nid
        with open(os.path.join(ROOT, *nrel.split('/')), 'wb') as fh:
            fh.write(raw)
        remap[mid] = (nid, nrel, rel)
        print('%s  rims: %d px -> %s' % (rel, int(rim.sum()), nrel))
    return remap


def main(argv):
    report, check = '--report' in argv, '--check' in argv
    packs = {f: read_pack(f) for f in pack_files()}
    flipped, n_stale = normals_pass(packs, check or report)
    if flipped:
        for f, keys in flipped.items():
            write_pack(f, *packs[f][:3], packs[f][3])
            print('normals flipped (nx, -ny, -nz): %d props in src/pier/%s' % (len(keys), f))
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
        _, arm_left = arm_pass(packs, True)
        for rel, n in left:
            print('auto_glass --check: %s still has %d white window(s)' % (rel, n))
        for rel in arm_left:
            print('auto_glass --check: %s - the glass is not smooth yet' % rel)
        for k in n_stale:
            print('auto_glass --check: %s - its normals disagree with its winding' % k)
        bad = left or arm_left or n_stale
        print('auto_glass --check: ' + ('STALE (python tools/auto_glass.py)' if bad else 'glazed (%d car maps)' % len(maps)))
        return 1 if bad else 0
    if report:
        print('%d car maps, %d white windows' % (len(maps), total))
        return 0
    rewrite(packs, remap, 'map')
    packs = {f: read_pack(f) for f in pack_files()}
    # (the RIMS pass is NOT run: on 19 Oct it found the glass tint in the small cars' own dark paint and blotched their
    # white bodies - kept below for a later, window-only take)
    rim_remap = {}
    arm_remap, _ = arm_pass(packs, False)
    rewrite(packs, arm_remap, 'arm')
    print('---\n%d car props\' normals flipped, %d car maps glazed (%d windows), %d rims painted, %d glass ARMs smoothed; '
          'then: node tools/ktx2_twins.js --family pier'
          % (sum(len(v) for v in flipped.values()), len(remap), total, len(rim_remap), len(arm_remap)))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
