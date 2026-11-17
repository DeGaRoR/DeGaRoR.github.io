"""lily_prep.py - the water lily pictures (the species water_lily, shape 'float') from the user's four lily-pad sheets.

The user, 17 Nov 2026: "Better water lily assets. You can slice them if you want" - four 1254 px cut-outs of real pads seen from
above (they replace the procedural picture of the same morning). The sheets are the user's and stay OUT of git (they live in
D:/Dev/flydiy-notes/assets/water_lily/); this writes the game's pictures from them:

  - THE CUT: every sheet's halo (lime and yellow fringe, an olive haze between the raft's pads) sits at alpha 1-7, so the alpha is
    cut at 128 (a 1 px soft rim kept) and the colour of every cut texel is the nearest leaf's (an 24-step push-pull), so no mip and no
    bilinear tap brings the fringe back;
  - THE SLICES: sheet 1's five pad groups (labelled at 1/4 scale, 12 px apart = one group), each masked to its own pads and centred
    on a square; sheets 2 (a scatter), 3 (a raft) and 4 (a chain) whole - 8 pictures;
  - THE SIZE: one scale for all, PX_M metres a pixel (the largest pad ~0.45 m), so a slice's square side in metres is written as
    the species' `aspects` (the float quad is `aspect` wide at size 1);
  - 512 px on the long side, PNG, through media_lib.write_media (tree_prep's bake_flower's own way), plus a copy as
    assets/vegetation/flowers/water_lily_<k>.png (tree_prep's source folder, not in git).

    python tools/lily_prep.py <sheet dir>      prints the maps + aspects for the pack and the tuning
"""
import io, json, os, sys
from collections import deque
import numpy as np
from PIL import Image, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from media_lib import write_media
PX_M = 0.0014
SHEETS = [('sheet1_groups', 'groups'), ('sheet2_scatter', 'whole'), ('sheet3_raft', 'whole'), ('sheet4_chain', 'whole')]


def label(m):
    H, W = m.shape; lab = np.zeros((H, W), int); n = 0
    for y in range(H):
        for x in range(W):
            if m[y, x] and not lab[y, x]:
                n += 1; q = deque([(y, x)]); lab[y, x] = n
                while q:
                    cy, cx = q.popleft()
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < H and 0 <= nx < W and m[ny, nx] and not lab[ny, nx]:
                            lab[ny, nx] = n; q.append((ny, nx))
    return lab, n


def cut(im):
    """alpha cut at 128 with a 1 px soft rim; the cut texels wear the nearest leaf's colour (push-pull)."""
    a = np.asarray(im.getchannel('A')).astype(np.float32)
    hard = (a >= 128).astype(np.float32)
    soft = np.asarray(Image.fromarray((hard * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32) / 255
    alpha = np.clip(soft * 1.6 - 0.3, 0, 1) * (a >= 24)
    rgb = np.asarray(im.convert('RGB')).astype(np.float32)
    w = hard.copy(); acc = rgb * w[..., None]
    for _ in range(24):   # grow the leaves' colour outward one ring a step
        k = np.ones((3, 3), np.float32)
        def blur(x):
            p = np.pad(x, ((1, 1), (1, 1)) + ((0, 0),) * (x.ndim - 2))
            return sum(p[dy:dy + x.shape[0], dx:dx + x.shape[1]] for dy in range(3) for dx in range(3))
        ws, accs = blur(w), blur(acc)
        grow = (w == 0) & (ws > 0)
        acc[grow] = accs[grow] / ws[grow][:, None]; w[grow] = 1
    fill = np.where(w[..., None] > 0, acc, rgb)
    out = np.where(hard[..., None] > 0, rgb, fill)
    return Image.fromarray(np.dstack([np.clip(out, 0, 255), alpha * 255]).astype(np.uint8), 'RGBA')


def square(im):
    """the picture centred on a square of its long side (the float quad is square), transparent around."""
    bb = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    im = im.crop(bb); s = max(im.size) + 8
    sq = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    # the transparent margin wears the edge colour too (no dark rim in the mips)
    edge = np.asarray(im.convert('RGB')).reshape(-1, 3).mean(0).astype(np.uint8)
    sq.paste(Image.new('RGBA', (s, s), tuple(int(v) for v in edge) + (0,)), (0, 0))
    sq.paste(im, ((s - im.width) // 2, (s - im.height) // 2))
    return sq


def main():
    src = sys.argv[1]
    flowers = os.path.join(ROOT, 'assets', 'vegetation', 'flowers'); os.makedirs(flowers, exist_ok=True)
    pics = []
    for name, how in SHEETS:
        im = Image.open(os.path.join(src, name + '.png')).convert('RGBA')
        if how == 'whole':
            pics.append(cut(im)); continue
        A = im.getchannel('A').point(lambda v: 255 if v >= 128 else 0)
        small = A.resize((im.width // 4, im.height // 4), Image.BOX)
        lab, n = label(np.asarray(small.filter(ImageFilter.MaxFilter(7))) > 40)
        big = np.asarray(Image.fromarray(lab.astype(np.uint8)).resize(im.size, Image.NEAREST))
        for i in range(1, n + 1):
            if (np.asarray(small)[lab == i] > 128).sum() < 3000: continue
            g = np.asarray(im).copy(); g[..., 3] = np.where(big == i, g[..., 3], 0)
            pics.append(cut(Image.fromarray(g, 'RGBA')))
    maps, aspects = [], []
    for k, p in enumerate(pics):
        sq = square(p); side_m = round(sq.width * PX_M, 2)
        key = 'water_lily_' + 'abcdefghij'[k]
        sq.save(os.path.join(flowers, key + '.png'))
        r = 512.0 / sq.width
        if r < 1: sq = sq.resize((512, 512), Image.LANCZOS)
        buf = io.BytesIO(); sq.save(buf, 'PNG', optimize=True)
        maps.append(write_media('tex/flowers', key, 'png', buf.getvalue())); aspects.append(side_m)
        print('  %s %4d px  %.2f m  %s' % (key, p.width, side_m, maps[-1]))
    print(json.dumps({'maps': maps, 'aspects': aspects}))


if __name__ == '__main__':
    main()
