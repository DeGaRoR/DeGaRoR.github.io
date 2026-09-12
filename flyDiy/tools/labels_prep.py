#!/usr/bin/env python3
"""THE SWITCH LABELS (G282, the user: "I have also generated labels as assets
for labeling the switches ... stick them at 45 deg on top of their
respective controls").

Input: one sheet of hand-written tape labels on a transparent background
(assets/interior/labels.png, the user's ChatGPT render), any layout. Each
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

  python tools/labels_prep.py [--src assets/interior/labels.png]
"""
import argparse, hashlib, io, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# the sheet's reading order -> the label's name (what is written on it)
LABELS = ['Cabin', 'Dash', 'Instr', 'Feet', 'beac', 'pos', 'land', 'cruise']
TILE_W, TILE_H = 512, 160          # one tile; a tape is ~3.4:1, kept whole


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
    ap.add_argument('--src', default=os.path.join('assets', 'interior', 'labels.png'))
    a = ap.parse_args()
    src = os.path.join(ROOT, a.src)
    im = Image.open(src).convert('RGBA')
    arr = np.array(im)
    alpha = arr[..., 3]
    bl = blobs(alpha)
    if len(bl) < len(LABELS):
        sys.exit('found %d tapes, expected %d' % (len(bl), len(LABELS)))
    # the largest N, then in reading order: rows by the blob's centre y
    # (a row is anything within half a tape height), left to right within
    bl.sort(key=lambda b: -(b[1] - b[0]) * (b[3] - b[2]))
    bl = bl[:len(LABELS)]
    hmed = float(np.median([b[1] - b[0] for b in bl]))
    bl.sort(key=lambda b: ((b[0] + b[1]) / 2 // (hmed * 0.8), (b[2] + b[3]) / 2))
    sheet = Image.new('RGBA', (TILE_W, TILE_H * len(LABELS)), (0, 0, 0, 0))
    for i, (y0, y1, x0, x1, mask) in enumerate(bl):
        tile = arr[y0:y1, x0:x1].copy()
        m = mask[y0:y1, x0:x1]
        # the fuzz goes: alpha survives only on the blob itself, softened at
        # its own edge by what the render drew there
        tile[..., 3] = np.where(m, tile[..., 3], 0)
        t = Image.fromarray(tile, 'RGBA')
        # fit the tape into the tile, centred, keeping its aspect
        k = min((TILE_W - 16) / t.width, (TILE_H - 12) / t.height)
        t = t.resize((max(1, int(t.width * k)), max(1, int(t.height * k))), Image.LANCZOS)
        ox = (TILE_W - t.width) // 2
        oy = i * TILE_H + (TILE_H - t.height) // 2
        sheet.paste(t, (ox, oy), t)
        print('  %-7s %4dx%-4d -> tile %d' % (LABELS[i], x1 - x0, y1 - y0, i))
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
