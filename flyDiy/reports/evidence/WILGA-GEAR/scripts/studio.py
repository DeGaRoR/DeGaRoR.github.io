import sys, numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
src, out, label, sub = sys.argv[1:5]
im = Image.open(src).convert('RGB'); a = np.array(im).astype(int); H, W, _ = a.shape
bg = a[3, 3]; mask = (np.abs(a - bg).sum(2) > 8)
# the tyre's floor: the lowest black pixel of the near wheel (the largest dark blob's bottom)
blk = (a.sum(2) < 40) & mask; ys, xs = np.nonzero(blk); yb = ys.max(); xc = int(np.median(xs[ys > yb - 6])); txs = xs[ys > ys.max() - 0.25 * (ys.max() - ys.min())]
# the room: a wall to the floor line, a concrete floor below it (perspective-ish gradient), the floor line at the tyre
floor = yb - int(0.012 * H)
room = np.zeros_like(a, dtype=float)
for y in range(H):
    if y < floor: t = y / max(1, floor); c = np.array([168, 174, 178]) * (0.78 + 0.22 * t)
    else: t = (y - floor) / max(1, H - floor); c = np.array([150, 148, 142]) * (0.92 - 0.25 * t) + np.array([14, 12, 8]) * t
    room[y, :] = c
rng = np.random.default_rng(1); room[floor:] += rng.normal(0, 3.5, room[floor:].shape)   # the slab's grain
room = Image.fromarray(np.clip(room, 0, 255).astype(np.uint8))
# a soft contact shadow under the tyre and a faint one under the aeroplane
sh = Image.new('L', (W, H), 0); d = ImageDraw.Draw(sh)
w = (txs.max() - txs.min()) if len(txs) else 80
d.ellipse([xc - 0.9 * w, floor - 0.06 * w, xc + 0.9 * w, floor + 0.16 * w], fill=150)
sh = sh.filter(ImageFilter.GaussianBlur(14))
room = Image.composite(Image.new('RGB', (W, H), (40, 40, 38)), room, sh)
m = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
outim = Image.composite(im, room, m)
d = ImageDraw.Draw(outim)
try: F1 = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', int(H * 0.021)); F2 = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', int(H * 0.016))
except Exception: F1 = F2 = ImageFont.load_default()
d.rectangle([0, H - int(H * 0.085), W, H], fill=(24, 26, 30)); d.text((int(W * 0.02), H - int(H * 0.078)), label, fill=(240, 240, 240), font=F1); d.text((int(W * 0.02), H - int(H * 0.040)), sub, fill=(190, 194, 200), font=F2)
outim.save(out); print(out, outim.size)
