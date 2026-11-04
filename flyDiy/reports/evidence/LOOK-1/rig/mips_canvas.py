# LOOK-1-STUDY: the game's leaf-map mip chain (trees.js coverageMips) replayed on each conifer map AS THE CANVAS RETURNS IT
# (getImageData off a premultiplied 2D canvas: RGB 0 under alpha 0), straight box filter (today) vs alpha-weighted (A1).
# Prints, per map and mip, the covered texels' mean linear luma over mip 0's and their spread (p90/p10).
#   python3 -I flyDiy/reports/evidence/LOOK-1/rig/mips_canvas.py   (from the repo root; needs numpy + Pillow)
import os, numpy as np
from PIL import Image
T = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'media', 'tex', 'trees')
Y = [0.2126, 0.7152, 0.0722]
def lin(c): return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def cov(a, cut, s): return (np.minimum(255, a * s) >= cut).mean()
def rescale(a, target, cut):   # trees.js rescale(): bisection on an alpha scale to keep mip 0's coverage at the cut
    lo, hi, best = 0, 64, 1
    for _ in range(12):
        mid = (lo + hi) / 2
        if cov(a, cut, mid) < target: lo = mid
        else: hi = mid; best = mid
    return a if abs(best - 1) < 0.02 else np.minimum(255, a * best)
def canvas(im):
    a = im[..., 3:4]; p = np.round(im[..., :3] * a / 255); out = im.copy()
    out[..., :3] = np.where(a > 0, np.minimum(255, np.round(p * 255 / np.maximum(a, 1))), 0); return out
def chain(im, cut, weighted):
    target = cov(im[..., 3], cut, 1); cur = im.copy(); out = [im]
    while cur.shape[0] > 1:
        h, w = cur.shape[:2]; r = cur.reshape(h // 2, 2, w // 2, 2, 4); st = r.mean((1, 3)); nd = st.copy()
        if weighted:
            aw = r[..., 3:4].sum((1, 3)); pm = (r[..., :3] * r[..., 3:4]).sum((1, 3))
            nd[..., :3] = np.where(aw > 0, pm / np.maximum(aw, 1e-6), st[..., :3])
        nd = np.floor(nd); nd[..., 3] = rescale(nd[..., 3], target, cut); cur = nd; out.append(nd)
    return out
MAPS = dict(cedar=('cedar_tree_m_branch_009_base.af7f7481.png', 0.6263), larch=('larch_tree_m_branch_base.8e0f34a9.png', 0.0777),
            spruce=('spruce_tree_m_branch_001_base.f76f96b7.png', 0.2971), rfir=('realistic_fir_trees_pack_lods_gameready_brunches_mat_base.96c367ea.png', 0.3764),
            pine_g=('pine_georgeous_m_branch_003_base.6d87b28b.png', 0.224), fir_g=('fir_tree_georgeous_m_branch_007_base.4742577f.png', 0.608),
            pine_e=('pine_evolveduk_tree_1mat_base.58ec41cf.png', 0.208))
for k, (f, c) in MAPS.items():
    im = canvas(np.asarray(Image.open(os.path.join(T, f)).convert('RGBA')).astype(float)); cut = round(255 * c)
    m0 = (lin(im[..., :3][im[..., 3] >= cut] / 255) @ Y).mean()
    print(k)
    for nm, w in (('straight (today)', False), ('alpha-weighted (A1)', True)):
        ch = chain(im, cut, w); s = []
        for L in (3, 5, 6, 7):
            t = ch[L]; m = t[..., 3] >= cut; y = lin(t[..., :3][m] / 255) @ Y
            s.append(f"mip{L} {y.mean() / m0:.2f} spread {np.percentile(y, 90) / max(np.percentile(y, 10), 1e-4):.1f}")
        print('   ', nm.ljust(20), ' | '.join(s))
