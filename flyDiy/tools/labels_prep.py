#!/usr/bin/env python3
"""THE SWITCH LABELS (G282, the user: "I have also generated labels as assets
for labeling the switches ... stick them at 45 deg on top of their
respective controls").

Input: sheets of hand-written tape labels on a transparent background
(assets/interior/labels*.png, the user's renders; SHEETS below), any layout. Each
tape is found as a connected blob of alpha, read in ROWS (top to bottom, then
left to right), cleaned (the render leaves semi-transparent fuzz round every
tape: only the blob itself keeps its alpha) and laid into ONE column sheet,
one tile per label, all tiles the same size with the tape centred — so the
panel layer draws tile i with a fixed uv window and no per-tile table.

Output: media/tex/panel/labels_<w>x<h>.<hash>.png (RGBA, hash-in-filename
like every sheet under media/) and src/viewer/panel_tex.js, the manifest the
viewer, the editor and GATE MEDIA read. The ORDER on the sheet is the
contract: LABELS below names tile i, and the panel layer maps a switch key to
a name. Re-run after editing the sheet.

  python tools/labels_prep.py [--dir assets/interior]
"""
import argparse, hashlib, io, os, sys
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# each sheet's reading order -> the label's name (what is written on it);
# the sheets are read in this order and their tiles stacked (G318: a second
# sheet — the buttons, the fuel selector, the avionics, the flaps, and one
# BLANK tape the panel writes the registration on)
SHEETS = [
    ('labels.png',  ['Cabin', 'Dash', 'Instr', 'Feet', 'beac', 'pos', 'land', 'cruise']),
    ('labels2.png', ['Bat.', 'Alt.', 'OFF/R/L/BOTH', 'Avionics', 'Flaps', 'blank']),
]
LABELS = [n for _, names in SHEETS for n in names]
TILE_W, TILE_H = 512, 160          # one tile; a tape is ~3.4:1, kept whole
PAD = 18                           # the tile's margin round a tape (the shadow lives there)
FEATHER = 0.9                      # px of blur on the tape's own alpha edge (a tad)
SHADOW_BLUR, SHADOW_DX, SHADOW_DY, SHADOW_K = 5.0, 2, 3, 0.42   # the contact shadow under it


def blobs(alpha, thr=128, min_px=4000):
    """connected components of alpha > thr (4-connected, iterative flood):
    [(y0, y1, x0, x1, mask)] for the blobs above min_px pixels"""
    h, w = alpha.shape
    solid = alpha > thr
    seen = np.zeros_like(solid, dtype=bool)
    out = []
    for y in range(h):
        row = solid[y]
        for x in np.nonzero(row & ~seen[y])[0]:
            # flood fill from (y, x)
            stack = [(y, x)]
            seen[y, x] = True
            pts = []
            while stack:
                cy, cx = stack.pop()
                pts.append((cy, cx))
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < h and 0 <= nx < w and solid[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
            if len(pts) < min_px:
                continue
            ys = np.fromiter((p[0] for p in pts), int, len(pts))
            xs = np.fromiter((p[1] for p in pts), int, len(pts))
            mask = np.zeros_like(solid)
            mask[ys, xs] = True
            out.append((ys.min(), ys.max() + 1, xs.min(), xs.max() + 1, mask))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dir', default=os.path.join('assets', 'interior'))
    a = ap.parse_args()
    tiles = []            # (name, arr, blob)
    for fname, names in SHEETS:
        im = Image.open(os.path.join(ROOT, a.dir, fname)).convert('RGBA')
        arr = np.array(im)
        bl = blobs(arr[..., 3])
        if len(bl) < len(names):
            sys.exit('%s: found %d tapes, expected %d' % (fname, len(bl), len(names)))
        # the largest N, then in reading order: rows by the blob's centre y
        # (a row is anything within half a tape height), left to right within
        bl.sort(key=lambda b: -(b[1] - b[0]) * (b[3] - b[2]))
        bl = bl[:len(names)]
        hmed = float(np.median([b[1] - b[0] for b in bl]))
        bl.sort(key=lambda b: ((b[0] + b[1]) / 2 // (hmed * 0.8), (b[2] + b[3]) / 2))
        for n, b in zip(names, bl):
            tiles.append((n, arr, b))
    sheet = Image.new('RGBA', (TILE_W, TILE_H * len(LABELS)), (0, 0, 0, 0))
    for i, (name, arr, (y0, y1, x0, x1, mask)) in enumerate(tiles):
        tile = arr[y0:y1, x0:x1].copy()
        m = mask[y0:y1, x0:x1]
        # the fuzz goes: alpha survives only on the blob itself, softened at
        # its own edge by what the render drew there
        tile[..., 3] = np.where(m, tile[..., 3], 0)
        t = Image.fromarray(tile, 'RGBA')
        # fit the tape into the tile, centred, keeping its aspect — with room
        # round it for the shadow below
        k = min((TILE_W - 2 * PAD) / t.width, (TILE_H - 2 * PAD) / t.height)
        t = t.resize((max(1, int(t.width * k)), max(1, int(t.height * k))), Image.LANCZOS)
        ox = (TILE_W - t.width) // 2
        oy = i * TILE_H + (TILE_H - t.height) // 2
        # THE STICKER SITS ON THE SURFACE (G320, the user: "the transitions
        # with the stickers are harsh. Can we smooth them out a tad?"): the
        # cut edge was the alpha test's own — a hard stair at every magnified
        # pixel, and the tape floating on the paint with nothing between
        # them. Two things: the tape's alpha is feathered a pixel (the edge
        # the render drew, softened, never widened), and a soft contact
        # shadow goes under it — its own outline blurred, a hair down and
        # right, faint — so the tape reads stuck ON the plate, the way the
        # screws' shadow does.
        a = t.getchannel('A')
        sh_a = a.filter(ImageFilter.GaussianBlur(SHADOW_BLUR)).point(lambda v: int(v * SHADOW_K))
        shadow = Image.new('RGBA', t.size, (0, 0, 0, 0)); shadow.putalpha(sh_a)
        sheet.alpha_composite(shadow, (ox + SHADOW_DX, oy + SHADOW_DY))
        soft = a.filter(ImageFilter.GaussianBlur(FEATHER))
        t.putalpha(soft)                                                   # the feathered edge
        sheet.alpha_composite(t, (ox, oy))
        print('  %-12s %4dx%-4d -> tile %d' % (name, x1 - x0, y1 - y0, i))
    buf = io.BytesIO()
    sheet.save(buf, 'PNG', optimize=True)
    data = buf.getvalue()
    h = hashlib.sha1(data).hexdigest()[:8]
    outdir = os.path.join(ROOT, 'media', 'tex', 'panel')
    os.makedirs(outdir, exist_ok=True)
    for f in os.listdir(outdir):
        if f.startswith('labels_') and f.endswith('.png'):
            os.remove(os.path.join(outdir, f))
    name = 'labels_%dx%d.%s.png' % (TILE_W, TILE_H, h)
    with open(os.path.join(outdir, name), 'wb') as f:
        f.write(data)
    rel = 'media/tex/panel/' + name
    js = (
        "// GENERATED FILE - DO NOT EDIT. Built by tools/labels_prep.py from\n"
        "// assets/interior/labels.png (the user's own tape labels). ONE column\n"
        "// sheet, one tile per label, the tape centred in its tile; the panel\n"
        "// layer draws tile i through a fixed uv window. `names` is the sheet's\n"
        "// order, the contract between the sheet and the switch that wears it.\n"
        "// Lives under media/tex/panel/ (hash-in-filename); loading starts at\n"
        "// script eval, like every sheet.\n"
        "const PANEL_TEX_SHEETS = (typeof Image !== 'undefined') ? (() => {\n"
        "  const B = (typeof FLYDIY_ASSET_BASE !== 'undefined') ? FLYDIY_ASSET_BASE : '';\n"
        "  const mk = src => { const i = new Image(); i.src = B + src; return i; };\n"
        "  return {\n"
        "    labels: { img: mk('%s'), w: %d, h: %d, n: %d,\n"
        "              names: %s },\n"
        "  };\n"
        "})() : {};\n"
        "if (typeof window !== 'undefined') window.PANEL_TEX_SHEETS = PANEL_TEX_SHEETS;\n"
    ) % (rel, TILE_W, TILE_H, len(LABELS), repr(LABELS).replace("'", '"'))
    with open(os.path.join(ROOT, 'src', 'viewer', 'panel_tex.js'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    print('wrote', rel, 'and src/viewer/panel_tex.js')


if __name__ == '__main__':
    main()
