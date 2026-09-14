#!/usr/bin/env python3
"""sign_import.py - THE BILLBOARDS (G313, the user: "The new billboards are
there ... the billboards, which are assets").

The user generates sheets of painted signs (assets/billboards/*_sheet_*.png,
RGBA, the signs on a clear ground). This cuts every sign off its sheet by
the alpha - the boxes are found by the empty gutters between them, each sign
tightened to its own pixels - and writes assets/billboards/out/<key>.png at
the size it came, plus a 1024-wide working copy. tools/sign_prep.js bakes
those into media/tex/signs/ and the src/viewer/sign_tex.js manifest, with
each sign's aspect, which is what the sign slot needs to size its board.

The keys are declared here, sheet by sheet, in reading order (left column
top to bottom, then the right): a sign is named once, by a person.

Usage: python tools/sign_import.py
"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, 'assets', 'billboards')
OUT = os.path.join(SRC, 'out')

SHEETS = {
    'signs_sheet_1.png': [
        # left column, top to bottom          right column, top to bottom
        ['air_taxi', 'harbor_fuel', 'general_store', 'tidal_cup'],
        ['bear_tours', 'sitka_lumber', 'north_motel', 'tongass_marine'],
    ],
    # G392, the institutions (the user: "signs for the institutions")
    'signs_sheet_2.png': [
        ['admiralty_police', 'island_clinic', 'town_hall', 'fire_brigade'],
        ['kootz_school', 'postal_service', 'community_church', 'veterinary_care'],
    ],
}

# A SHEET WHOSE SIGNS NEARLY TOUCH (G392): the institutions came four to a
# column with four-pixel gutters and a soft halo round every board, which the
# default cut (alpha over 40, gutters joined under 12 px) read as one sign per
# column. Per sheet: the alpha a pixel must beat to count, and the widest
# gutter that is still a gap inside one sign.
OPTS = {
    'signs_sheet_2.png': {'alpha': 160, 'gap': 2},
}


def runs(v, gap=6):
    """index ranges where v is true, joined across gaps shorter than `gap`"""
    out, s, last = [], None, None
    for i, x in enumerate(v):
        if x:
            if s is None:
                s = i
            last = i
        elif s is not None and i - last > gap:
            out.append((s, last + 1)); s = None
    if s is not None:
        out.append((s, last + 1))
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    n = 0
    for sheet, cols in SHEETS.items():
        im = Image.open(os.path.join(SRC, sheet)).convert('RGBA')
        o = OPTS.get(sheet, {})
        th, gap = o.get('alpha', 40), o.get('gap', 12)
        a = im.split()[3].point(lambda v: 255 if v > th else 0)
        W, H = im.size
        col_runs = runs([a.crop((x, 0, x + 1, H)).getbbox() is not None for x in range(W)], gap)
        if len(col_runs) != len(cols):
            raise SystemExit('%s: found %d columns, the table names %d' % (sheet, len(col_runs), len(cols)))
        for (x0, x1), names in zip(col_runs, cols):
            col = a.crop((x0, 0, x1, H))
            row_runs = runs([col.crop((0, y, x1 - x0, y + 1)).getbbox() is not None for y in range(H)], gap)
            if len(row_runs) != len(names):
                raise SystemExit('%s: column at %d has %d signs, the table names %d' % (sheet, x0, len(row_runs), len(names)))
            for (y0, y1), key in zip(row_runs, names):
                box = a.crop((x0, y0, x1, y1)).getbbox()
                sign = im.crop((x0 + box[0], y0 + box[1], x0 + box[2], y0 + box[3]))
                sign.save(os.path.join(OUT, key + '.png'))
                w, h = sign.size
                work = sign if w <= 1024 else sign.resize((1024, round(h * 1024 / w)), Image.LANCZOS)
                work.save(os.path.join(OUT, key + '_1k.png'))
                print('%-16s %4d x %4d  aspect %.2f' % (key, w, h, w / h))
                n += 1
    print('%d signs under assets/billboards/out/' % n)


if __name__ == '__main__':
    main()
