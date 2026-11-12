#!/usr/bin/env python
# still_diff.py - THE DIFFERENCE BETWEEN TWO SIDES' STILLS (TOWN-1, 2026-11-08; the user: "I'm not seeing any difference in
# your screenshots. Run a subtraction of the images.")
#
#   python -I tools/perf/still_diff.py <shots dir> [--a P] [--b B] [--out <dir, default <shots>/diff>] [--thr 12,32]
#
# Pairs <a>_<build>_<view>.jpg with <b>_<build>_<view>.jpg (metla_ab --shots names). For each pair it writes
#   <view>_diff.jpg : |a - b| per pixel (the channels' max), x4, over a dimmed copy of b - where the two differ, it glows
#   <view>_trio.jpg : a | b | the diff, side by side, half size
# and prints, per view, the % of pixels that change by more than each threshold (0-255, the channels' max; JPEG's own
# noise is a few levels) and the mean change. A view whose % is near zero did not change what a player sees there.
import sys, os, re
import numpy as np
from PIL import Image

args = sys.argv[1:]
def opt(k, d):
    return args[args.index('--' + k) + 1] if ('--' + k) in args else d
if not args or args[0].startswith('--'):
    print(__doc__ if __doc__ else 'usage: still_diff.py <shots dir> [--a P] [--b B] [--out dir] [--thr 12,32]'); sys.exit(2)
D = args[0]; A = opt('a', 'P'); B = opt('b', 'B'); OUT = opt('out', os.path.join(D, 'diff'))
THR = [int(t) for t in opt('thr', '12,32').split(',')]
os.makedirs(OUT, exist_ok=True)
rows = []
for f in sorted(os.listdir(D)):
    m = re.match(r'^' + re.escape(A) + r'_(.+)\.jpg$', f)
    if not m: continue
    g = os.path.join(D, B + '_' + m.group(1) + '.jpg')
    if not os.path.exists(g): continue
    ia, ib = Image.open(os.path.join(D, f)).convert('RGB'), Image.open(g).convert('RGB')
    if ia.size != ib.size: ib = ib.resize(ia.size)
    a, b = np.asarray(ia).astype(np.int16), np.asarray(ib).astype(np.int16)
    d = np.abs(a - b).max(axis=2)
    pct = [100.0 * (d > t).mean() for t in THR]
    rows.append((m.group(1), pct, float(d.mean())))
    glow = np.clip(d * 4, 0, 255).astype(np.uint8)
    base = (np.asarray(ib).astype(np.float32) * 0.35)
    over = base.copy(); over[..., 0] = np.maximum(over[..., 0], glow); over[..., 1] = np.maximum(over[..., 1], glow * 0.85)
    Image.fromarray(over.astype(np.uint8)).save(os.path.join(OUT, m.group(1) + '_diff.jpg'), quality=88)
    w, h = ia.size; half = (w // 2, h // 2)
    trio = Image.new('RGB', (half[0] * 3, half[1]))
    for k, im in enumerate([ia, ib, Image.fromarray(over.astype(np.uint8))]): trio.paste(im.resize(half), (k * half[0], 0))
    trio.save(os.path.join(OUT, m.group(1) + '_trio.jpg'), quality=85)
print('view'.ljust(18) + ''.join(('> ' + str(t)).rjust(10) for t in THR) + 'mean'.rjust(8) + '   (' + A + ' vs ' + B + ', % of pixels)')
for v, pct, mean in rows:
    print(v.ljust(18) + ''.join(('%.2f %%' % p).rjust(10) for p in pct) + ('%.2f' % mean).rjust(8))
print('-> ' + OUT)
