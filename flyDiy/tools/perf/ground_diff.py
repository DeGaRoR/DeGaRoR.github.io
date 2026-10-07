# ground_diff.py - THE LOOK, BEFORE / AFTER (GROUND-COST G2075): two stills of the same view (tools/perf/ground_cost.js's
# <out>_<view>_<variant>.png) -> one sheet: A | B | |A - B| x 4 (x4 amplified), and the numbers that say how far apart they are
# over the frame and over the lower 55 % (the ground, under the horizon in every view the rig takes): mean |dE| in sRGB
# 8-bit units, the 99th percentile, the share of pixels off by more than 3 / 8 units.
# Usage: py -3.11 tools/perf/ground_diff.py A.png B.png out.jpg [--label "A label|B label"] [--crop x0,y0,x1,y1]
import sys
import numpy as np
from PIL import Image, ImageDraw

a_p, b_p, out_p = sys.argv[1:4]
args = sys.argv[4:]
def opt(k, d=None):
    return args[args.index('--' + k) + 1] if '--' + k in args else d
labels = (opt('label', a_p.split('/')[-1] + '|' + b_p.split('/')[-1])).split('|')
A = np.asarray(Image.open(a_p).convert('RGB')).astype(np.int16)
B = np.asarray(Image.open(b_p).convert('RGB')).astype(np.int16)
if opt('crop'):
    x0, y0, x1, y1 = map(int, opt('crop').split(','))
    A, B = A[y0:y1, x0:x1], B[y0:y1, x0:x1]
D = np.abs(A - B)
dE = D.max(axis=2)
h = A.shape[0]
def stats(m):
    return 'mean %.2f  p99 %d  >3: %.2f %%  >8: %.2f %%' % (m.mean(), np.percentile(m, 99), 100 * (m > 3).mean(), 100 * (m > 8).mean())
full, low = stats(dE), stats(dE[int(h * 0.45):])
print('frame  ' + full)
print('ground ' + low)
amp = np.clip(D * 4, 0, 255).astype(np.uint8)
W = A.shape[1]
sheet = Image.new('RGB', (W * 3, h + 28), (20, 20, 20))
for i, im in enumerate([A.astype(np.uint8), B.astype(np.uint8), amp]):
    sheet.paste(Image.fromarray(im), (i * W, 28))
d = ImageDraw.Draw(sheet)
for i, t in enumerate([labels[0], labels[1], '|A-B| x4   ground: ' + low]):
    d.text((i * W + 8, 8), t, fill=(240, 236, 226))
if sheet.width > 3000:
    sheet = sheet.resize((sheet.width // 2, sheet.height // 2), Image.LANCZOS)
sheet.save(out_p, quality=90)
print('-> ' + out_p)
