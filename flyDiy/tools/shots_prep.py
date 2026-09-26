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

G640 (the loading screen's carousel, 2026-09-26): a row may carry a fifth
element, a dict: 'w' / 'q' override the width cap and the JPEG quality (the
carousel's later pictures are fetched one ahead of their turn, 1600 wide at
q80 is plenty behind the veil), 'txt' is the picture card's line under the
caption. A source may sit outside screenshots/ ('../bugReports/...'): the
playtest captures are the island as a player sees it. Only the FIRST
picture of each set is fetched with the page; boot.js fetches the others
one turn ahead (build.js writes data-src).
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
     'the steel shed, afternoon', {'txt': 'The shed follows the clock: afternoon, golden, sunset, dusk, night - and overcast when the clouds close in.'}),
    ('Screenshot 2026-09-12 214350.png', 'garage', None,
     'cowl off, night', {'txt': 'The explode button pulls the aeroplane apart, part from part.'}),
    ('Screenshot 2026-09-12 223748.png', 'garage', None,
     'the wooden shed, door open'),
    ('Screenshot 2026-09-12 223607.png', 'garage', None,
     'a wing on the bench', {'txt': 'Wing loading is the weight over the wing area: a trainer near 40 kg/m², an ultralight under 25.'}),
    ('Screenshot 2026-09-12 224119.png', 'garage', None,
     'F-PGAR', {'txt': 'Every new aeroplane is registered F-PGAR until you letter your own.'}),
    ('Screenshot 2026-09-12 223943.png', 'garage', None,
     'from the loft', {'txt': 'The camera pills: 3/4 front, side, plan, nose, and the pilot’s own eyes.'}),
    ('Screenshot 2026-09-12 022252.png', 'world', (0, 0, 1611, 906),
     'over the fields', {'txt': 'The procedural world the game was built on, still one pick away in the graphics menu.'}),
    ('Screenshot 2026-09-09 011423.png', 'world', (0, 60, 1133, 697),
     'the stand'),
    ('Screenshot 2026-09-09 012958.png', 'world', (0, 60, 1130, 696),
     'the alps behind'),
    # G640: the carousel's pictures (1600 wide, q80, fetched one turn ahead)
    ('Screenshot 2026-09-01 031521.jpg', 'garage', (0, 46, 1708, 1007),
     'the engineering bench', {'w': 1600, 'q': 80,
     'txt': 'Bench check, wing loading, density altitude, test flight: the tests that earn the plaque, and the logbook under them.'}),
    ('Screenshot 2026-08-30 234008.jpg', 'garage', (50, 20, 1786, 996),
     'sun on the shed floor', {'w': 1600, 'q': 80,
     'txt': 'The room is lit by the same sky as the island: the hour you pick in the shed is the hour you fly in.'}),
    ('weather/g3455_side_grooves.png', 'garage', (200, 0, 1373, 660),
     'centre of gravity, neutral point', {'w': 1600, 'q': 80,
     'txt': 'Both are drawn on the aeroplane. The centre of gravity must sit ahead of the neutral point: the gap between them is the stability margin.'}),
    ('Screenshot 2026-09-12 183934.png', 'garage', (0, 250, 976, 799),
     'the switch row', {'w': 1600, 'q': 80,
     'txt': 'The switches work: M the master, K the beacon, N the navigation lights, T the taxi light, I the instruments.'}),
    ('Screenshot 2026-09-08 005742.png', 'world', (0, 0, 1210, 681),
     'an evening on the apron', {'w': 1600, 'q': 80,
     'txt': 'A garage build out on the concrete. The time of day, the clouds and the wind are yours to set.'}),
    ('../bugReports/Screenshot 2026-09-26 144049.png', 'world', (1070, 128, 2204, 766),
     'every field on the map', {'w': 1600, 'q': 80,
     'txt': 'The island is Annette Island, Alaska, from its real elevation data. The map names every field you can land on.'}),
    ('../bugReports/Screenshot 2026-09-26 145815.png', 'world', (100, 0, 1908, 1017),
     'climbing out over the muskeg', {'w': 1600, 'q': 80,
     'txt': 'Forest, muskeg, heath and rock: the ground is read from the island\'s own land-cover maps.'}),
    ('../bugReports/Screenshot 2026-09-17 195236.png', 'world', (0, 0, 1268, 713),
     'floats, over the coast', {'w': 1600, 'q': 80,
     'txt': 'Floats are a gear choice in the garage. The sea and the lakes are runways too.'}),
    ('shoulder/30_flight_cockpit_forward.png', 'world', (0, 0, 1778, 1000),
     'the cockpit, before the roll', {'w': 1600, 'q': 80,
     'txt': 'C cycles the views: chase, orbit, cockpit, wing and tower.'}),
    ('Screenshot 2026-09-12 213534.png', 'world', (350, 418, 1794, 1230),
     'stilt houses, night', {'w': 1600, 'q': 80,
     'txt': 'After dark the windows light up and the piers keep their lamps on.'}),
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
    for row in SHOTS:
        src, set_, crop, cap = row[:4]
        opt = row[4] if len(row) > 4 else {}
        w_out, q = opt.get('w', W_OUT), opt.get('q', QUALITY)
        p = os.path.normpath(os.path.join(SRC, src))
        if not os.path.exists(p):
            print('  skip (not on this machine): %s' % src)
            continue
        im = Image.open(p).convert('RGB')
        box = crop or default_crop(*im.size)
        im = im.crop(box)
        if im.width > w_out:
            im = im.resize((w_out, int(round(im.height * w_out / im.width))), Image.LANCZOS)
        stem = os.path.splitext(os.path.basename(src))[0].replace('Screenshot ', 'shot_').replace(' ', '_')
        if preview:
            im.save(os.path.join(PREVIEW, stem + '.jpg'), 'JPEG', quality=q)
            print('  preview %s  %dx%d' % (stem, im.width, im.height))
            continue
        buf = io.BytesIO()
        im.save(buf, 'JPEG', quality=q, optimize=True, progressive=True)
        raw = buf.getvalue()
        rel = write_media('tex/shots', stem, 'jpg', raw)
        keep.append(rel)
        r = {'src': rel, 'w': im.width, 'h': im.height,
             'kb': int(round(len(raw) / 1024)), 'set': set_, 'cap': cap}
        if opt.get('txt'):
            r['txt'] = opt['txt']
        rows.append(r)
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
