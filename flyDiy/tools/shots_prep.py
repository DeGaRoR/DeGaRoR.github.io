"""shots_prep.py — the LOADING SCREEN's pictures (LOADING chantier S1, 2026-09-14).

The boot overlay rotates a few of the user's own captures while the shed
(or the world) is built. This is the ONE baker that turns a capture under
screenshots/ (gitignored: developer evidence, not a shipped asset) into a
shipped media file: a 16:9 crop that drops the chrome (the BACK · ESC pill,
the F8 readout), Lanczos to 1920 wide (never upscaled), a progressive JPEG,
written through media_lib so the name carries its hash and GATE MEDIA owns it.

  python tools/shots_prep.py             bake media/tex/shots/ + src/viewer/shots_pack.json
  python tools/shots_prep.py --preview   write the crops to bench/shots_preview/ and stop

The table is the truth: a row is (source, set, crop, caption). `crop` is
(left, top, right, bottom) in source pixels, or None for the default
16:9 box that trims 78 px of the sides and 90 px off the top (where the
capture's pill sits). `set` is 'garage' (the boot) or 'world' (the roll-out).
A source that is missing on this machine is SKIPPED with a line - the
manifest lists what was baked, and the media files that already exist for a
row stay valid because they are named by content.
"""
import io
import json
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from media_lib import write_media, prune_media  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'screenshots')
OUT_JSON = os.path.join(ROOT, 'src', 'viewer', 'shots_pack.json')
PREVIEW = os.path.join(ROOT, 'bench', 'shots_preview')

W_OUT = 1920
QUALITY = 82

# (source under screenshots/, set, crop or None, caption)
SHOTS = [
    ('Screenshot 2026-09-12 223450.png', 'garage', None,
     'the steel shed, afternoon'),
    ('Screenshot 2026-09-12 214350.png', 'garage', None,
     'cowl off, night'),
    ('Screenshot 2026-09-12 223748.png', 'garage', None,
     'the wooden shed, door open'),
    ('Screenshot 2026-09-12 223607.png', 'garage', None,
     'a wing on the bench'),
    ('Screenshot 2026-09-12 224119.png', 'garage', None,
     'F-PGAR'),
    ('Screenshot 2026-09-12 223943.png', 'garage', None,
     'from the loft'),
    ('Screenshot 2026-09-12 022252.png', 'world', (0, 0, 1611, 906),
     'over the fields'),
    ('Screenshot 2026-09-09 011423.png', 'world', (0, 60, 1133, 697),
     'the stand'),
    ('Screenshot 2026-09-09 012958.png', 'world', (0, 60, 1130, 696),
     'the alps behind'),
]


def default_crop(w, h):
    left, top = 78, 90
    cw = w - 2 * left
    ch = int(round(cw * 9 / 16))
    if top + ch > h:                     # a short capture: fit the height
        ch = h - top
        cw = int(round(ch * 16 / 9))
        left = (w - cw) // 2
    return (left, top, left + cw, top + ch)


def bake(preview=False):
    rows, keep = [], []
    if preview:
        os.makedirs(PREVIEW, exist_ok=True)
    for src, set_, crop, cap in SHOTS:
        p = os.path.join(SRC, src)
        if not os.path.exists(p):
            print('  skip (not on this machine): %s' % src)
            continue
        im = Image.open(p).convert('RGB')
        box = crop or default_crop(*im.size)
        im = im.crop(box)
        if im.width > W_OUT:
            im = im.resize((W_OUT, int(round(im.height * W_OUT / im.width))), Image.LANCZOS)
        stem = os.path.splitext(src)[0].replace('Screenshot ', 'shot_').replace(' ', '_')
        if preview:
            im.save(os.path.join(PREVIEW, stem + '.jpg'), 'JPEG', quality=QUALITY)
            print('  preview %s  %dx%d' % (stem, im.width, im.height))
            continue
        buf = io.BytesIO()
        im.save(buf, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
        raw = buf.getvalue()
        rel = write_media('tex/shots', stem, 'jpg', raw)
        keep.append(rel)
        rows.append({'src': rel, 'w': im.width, 'h': im.height,
                     'kb': int(round(len(raw) / 1024)), 'set': set_, 'cap': cap})
        print('  %s  %dx%d  %d KB  [%s]' % (rel, im.width, im.height, len(raw) // 1024, set_))
    if preview:
        return
    gone = prune_media('tex/shots', keep)
    for g in gone:
        print('  pruned %s' % g)
    with open(OUT_JSON, 'w', encoding='utf8', newline='\n') as f:
        json.dump(rows, f, indent=1)
        f.write('\n')
    print('wrote %s (%d shots, %d KB)' % (os.path.relpath(OUT_JSON, ROOT), len(rows), sum(r['kb'] for r in rows)))


if __name__ == '__main__':
    bake(preview='--preview' in sys.argv)
