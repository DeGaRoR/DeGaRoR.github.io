import sys, numpy as np
from PIL import Image
sys.path.insert(0, sys.argv[1]); 
def lin(c): return np.where(c <= 0.04045, c/12.92, ((c+0.055)/1.055)**2.4)
def cov(a, cut, s): return (np.minimum(255, a*s) >= cut).mean()
def rescale(a, target, cut):
    lo, hi, best = 0, 64, 1
    for _ in range(12):
        mid = (lo+hi)/2
        if cov(a, cut, mid) < target: lo = mid
        else: hi = mid; best = mid
    return a if abs(best-1) < 0.02 else np.minimum(255, a*best)
def chain(im, cut, premul):
    a0 = im[...,3]; target = cov(a0, cut, 1); cur = im.copy(); out = [im]
    while cur.shape[0] > 1:
        h,w = cur.shape[:2]
        if premul:
            p = cur.copy(); p[...,:3] *= p[...,3:4]/255; p = p.reshape(h//2,2,w//2,2,4).mean((1,3)); a = p[...,3:4]
            p[...,:3] = np.where(a > 0, p[...,:3]*255/np.maximum(a,1e-6), 0); nd = p
        else: nd = cur.reshape(h//2,2,w//2,2,4).mean((1,3))
        nd = np.floor(nd); nd[...,3] = rescale(nd[...,3], target, cut); cur = nd; out.append(nd)
    return out
fs = dict(cedar=('cedar_tree_m_branch_009_base.af7f7481.png',0.6263), larch=('larch_tree_m_branch_base.8e0f34a9.png',0.0777),
          spruce=('spruce_tree_m_branch_001_base.f76f96b7.png',0.2971), rfir=('realistic_fir_trees_pack_lods_gameready_brunches_mat_base.96c367ea.png',0.3764),
          pine_g=('pine_georgeous_m_branch_003_base.6d87b28b.png',0.224), fir_g=('fir_tree_georgeous_m_branch_007_base.4742577f.png',0.608),
          pine_e=('pine_evolveduk_tree_1mat_base.58ec41cf.png',0.208))
for k,(f,c) in fs.items():
    im = np.asarray(Image.open('media/tex/trees/'+f).convert('RGBA')).astype(float); cut = round(255*c)
    base = lin(im[...,:3][im[...,3]>=cut]/255) @ [0.2126,0.7152,0.0722]; bm = np.median(base)
    row = []
    for pm in (False, True):
        ch = chain(im, cut, pm); s=[]
        for L in (4,5,6,7):
            m = ch[L][...,3] >= cut; y = lin(ch[L][...,:3][m]/255) @ [0.2126,0.7152,0.0722]
            s.append(f"L{L} {(y > 2.5*bm).mean()*100:4.1f}%")
        row.append(('premul ' if pm else 'today  ') + ' '.join(s))
        if k in ('cedar','larch'):
            L = 6; t = ch[L]; m = t[...,3] >= cut; v = np.where(m[...,None], t[...,:3], 0).astype(np.uint8)
            Image.fromarray(v).resize((256,256), Image.NEAREST).save(f"{sys.argv[1]}/mip6_{k}_{'premul' if pm else 'today'}.png")
    print(f"{k:7s} texels drawn >2.5x the leaf median:", ' | '.join(row))
