# fit_tips.py <ref.json> <born.json> <out-prefix> [plane: upper|lower|both] - each wing tip type the garage offers (the
# `wgTip` / `w2Tip` rows), built and scored against the reference's planform over the OUTER 35 % of the semispan
# (1 - IoU seen from above, 2 cm): the tip shape is chosen by measurement, not by eye. Prints the table and the best.
import sys, os, json, subprocess, runpy, io, contextlib
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
refj, born, out = sys.argv[1:4]; which = sys.argv[4] if len(sys.argv) > 4 else 'both'
TIPS = ['square', 'clipped', 'rounded', 'elliptic', 'hoerner', 'winglet']
def run(over):
    subprocess.check_call(['node', os.path.join(HERE, 'dump_build.js'), born, out, '--over', json.dumps(over)], stdout=subprocess.DEVNULL)
    sys.argv = ['refmatch.py', refj, out]; buf = io.StringIO()
    with contextlib.redirect_stdout(buf): g = runpy.run_path(os.path.join(HERE, 'refmatch.py'))
    return g
def tip_iou(g, w):
    from PIL import Image, ImageDraw
    A, B = g['OUR'][w], g['REF'][w]
    if not len(A) or not len(B): return np.nan
    semi = B.reshape(-1, 3)[:, 0].max(); x0 = 0.65 * semi
    A = A[(A[..., 0] > x0).all(1)]; B = B[(B[..., 0] > x0).all(1)]
    P_ = np.vstack([A.reshape(-1, 3), B.reshape(-1, 3)]); lo = P_.min(0); hi = P_.max(0); K = 50
    W, H = int((hi[0] - lo[0]) * K) + 2, int((hi[2] - lo[2]) * K) + 2
    def m(T):
        im = Image.new('1', (W, H), 0); d = ImageDraw.Draw(im)
        for t in T: d.polygon([((p[0] - lo[0]) * K, (p[2] - lo[2]) * K) for p in t], fill=1)
        return np.asarray(im)
    a, b = m(A), m(B); return 1 - (a & b).sum() / max(1, (a | b).sum())
planes = [('upper', 'wgTip'), ('lower', 'w2Tip')]
for w, key in planes:
    if which not in ('both', w): continue
    res = []
    for i, t in enumerate(TIPS):
        g = run({key: i}); res.append((tip_iou(g, w), t, i))
        print('  %-6s %-8s 1-IoU %.3f' % (w, t, res[-1][0]))
    best = min(res); print('best %s: %s (%s %d), 1-IoU %.3f' % (w, best[1], key, best[2], best[0]))
