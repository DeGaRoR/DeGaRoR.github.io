# glb_views.py <in.glb | cache.npz> <out-prefix> [--axes "x=z,y=y,z=-x"]
# A reference GLB drawn side / top / front with every mesh node its own colour and its index printed in the legend:
# how a new reference's parts are found when the model is merged by material (refs/<key>.json "parts"). Units are the
# GLB's own (after --axes). numpy + PIL; python3 -I.
import sys, os, subprocess
import numpy as np
from PIL import Image, ImageDraw
args = sys.argv[1:]
src, out = args[0], args[1]
axes = args[args.index('--axes') + 1] if '--axes' in args else 'x=x,y=y,z=z'
HERE = os.path.dirname(os.path.abspath(__file__))
if src.endswith('.glb'):
    cache = src + '.npz'
    if not os.path.exists(cache): subprocess.check_call([sys.executable, '-I', os.path.join(HERE, 'glb_tris.py'), src, cache])
    src = cache
G = np.load(src); T = G['T'].astype(float); N = G['names']
def remap(T, spec):
    idx = {'x': 0, 'y': 1, 'z': 2}; outT = np.empty_like(T)
    for part in spec.split(','):
        k, v = part.split('='); sgn = -1 if v.startswith('-') else 1
        outT[..., idx[k]] = sgn * T[..., idx[v.lstrip('-')]]
    return outT
T = remap(T, axes)
names = list(dict.fromkeys(N.tolist())); nid = np.array([names.index(n) for n in N])
rng = np.random.default_rng(3); cols = [tuple(int(c) for c in rng.integers(40, 230, 3)) for _ in names]
K = 900 / (T[..., 2].max() - T[..., 2].min() + 1e-9)
for v, (a, b, depth) in {'side': (2, 1, 0), 'top': (2, 0, 1), 'front': (0, 1, 2)}.items():
    U = -T[..., a] if v != 'front' else T[..., a]; Wv = T[..., b]; D = T[..., depth] if v != 'top' else T[..., 1]
    u0, u1, w0, w1 = U.min(), U.max(), Wv.min(), Wv.max(); s = 900 / max(u1 - u0, 1e-9)
    W, H = 900, int((w1 - w0) * s) + 1
    img = Image.new('RGB', (W, H + 18 * ((len(names) + 3) // 4)), (250, 250, 250)); d = ImageDraw.Draw(img)
    order = np.argsort(D.mean(1))          # far first
    for i in order:
        pts = [((U[i, k] - u0) * s, (w1 - Wv[i, k]) * s) for k in range(3)]
        d.polygon(pts, fill=cols[nid[i]])
    for j, n in enumerate(names):
        x, y = (j % 4) * 225 + 4, H + 4 + (j // 4) * 18
        d.rectangle([x, y, x + 12, y + 12], fill=cols[j]); d.text((x + 16, y), '%d %s' % (j, n.split('/')[-1][:28]), fill=(0, 0, 0))
    img.save('%s_%s.png' % (out, v)); print('wrote %s_%s.png' % (out, v))
