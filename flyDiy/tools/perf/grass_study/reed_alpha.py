import json, numpy as np
from PIL import Image
im = np.asarray(Image.open(__import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)), '../../../media/tex/trees/grass_patches_grass1_base.11a17e1a.png')).convert('RGBA')).astype(np.float32)/255
H, W = im.shape[:2]; A = im[..., 3]
print('tex', W, H, 'mean alpha', A.mean().round(3), 'share >0.3', (A > 0.3).mean().round(3))
rgb = im[..., :3][A > 0.3]; print('kept texel mean sRGB', rgb.mean(0).round(3))
rng = np.random.default_rng(1)
S = json.load(open(__import__('os').path.join(__import__('os').environ.get('OUT', __import__('tempfile').gettempdir()), 'reed_tris.json')))
SC = 0.012 * 0.75
for s in S:
    tot = 0; totY = 0; totX = 0; ys = []; ws = []; wsT = []
    for (u0, u1, u2, a, b, c, ax, ay, az) in s['tris']:
        r = rng.random((32, 2)); m = r.sum(1) > 1; r[m] = 1 - r[m]
        w0 = 1 - r[:, 0] - r[:, 1]
        uu = w0 * u0[0] + r[:, 0] * u1[0] + r[:, 1] * u2[0]; vv = w0 * u0[1] + r[:, 0] * u1[1] + r[:, 1] * u2[1]
        px = np.clip((uu % 1) * W, 0, W - 1).astype(int); py = np.clip((vv % 1) * H, 0, H - 1).astype(int)   # flipY false: v down
        al = (A[py, px] > 0.3).mean()
        yy = w0 * a[1] + r[:, 0] * b[1] + r[:, 1] * c[1]
        side = (ax + az) / 2
        tot += side * al; totY += ay * al
        ys.extend(list(yy * SC)); ws.extend([side * al / 32] * 32)
    ys = np.array(ys); ws = np.array(ws)
    o = np.argsort(ys); cw = np.cumsum(ws[o]) / ws.sum()
    q = lambda p: ys[o][np.searchsorted(cw, p)]
    bb = s['bb']; fx = (bb[3] - bb[0]) * SC; fz = (bb[5] - bb[2]) * SC
    print(f"{s['name']}: footprint {fx:.2f} x {fz:.2f} m, top {bb[4]*SC:.2f} m | alpha-kept side area (one axis) {tot*SC*SC:.2f} m2, top-down {totY*SC*SC:.2f} m2 ({totY*SC*SC/(fx*fz)*100:.0f}% of bbox)| visible-area height quantiles p25 {q(.25):.2f} p50 {q(.5):.2f} p75 {q(.75):.2f} p95 {q(.95):.2f} m")
