# overlay.py <dump-prefix> <out-prefix> : our build's silhouette outlined in red over the LS4 drawings (quick projection)
import sys, json, numpy as np
from PIL import Image, ImageDraw
pre, out = sys.argv[1], sys.argv[2]
U = '/root/.claude/uploads/8d1f46f0-5f89-532e-91da-78d2c2662e9d/'
tri = np.fromfile(pre + '.bin', dtype=np.float32).reshape(-1, 3, 3)
runs = json.load(open(pre + '.json'))
lay = []; c = 0
for name, n in runs: lay += [name] * (n - c); c = n
lay = np.array(lay[:len(tri)])
SKIP = ('eng', 'light', 'access', 'hinge', 'prop', 'spinner')
keep = np.array([not any(s in l for s in SKIP) for l in lay])
T = tri[keep]; L = lay[keep]
x, y, z = T[..., 0], T[..., 1], T[..., 2]          # x span, y up, z fore
# THE AIRCRAFT'S ATTITUDE (PITCH env, degrees nose UP): the drawing's side view stands on its wheel and tail wheel, so
# ours is turned about its main wheel's contact to the same attitude (the boom stays the boom; the attitude is global)
import os
PITCH = float(os.environ.get('PITCH', '0'))
if PITCH:
    import math
    gm0 = np.array(['gear' in l for l in L])
    yc = y[gm0].min(); zc = z[gm0][np.argmin(y[gm0].ravel()) // 3 if False else 0].mean() if False else z[gm0].ravel()[np.argmin(y[gm0].ravel())]
    a_ = math.radians(PITCH); ca, sa = math.cos(a_), math.sin(a_)
    dz, dy = z - zc, y - yc
    z = zc + dz * ca - dy * sa; y = yc + dz * sa + dy * ca
nose = z.max(); aft = nose - z                       # metres aft of the nose
gearM = np.array(['gear' in l for l in L])
ground = y[gearM].min() if gearM.any() else y.min()
print('ours: length %.2f span %.2f height %.2f (ground %.2f)' % (aft.max(), x.max() - x.min(), y.max() - ground, ground))
def mask(W, H, P):                                   # P: (n,3,2) pixel triangles
    im = Image.new('L', (W, H), 0); d = ImageDraw.Draw(im)
    for t in P: d.polygon([tuple(p) for p in t], fill=255)
    return np.array(im) > 0
def outline(m):
    e = m.copy(); e[1:-1, 1:-1] = m[1:-1, 1:-1] & ~(m[:-2, 1:-1] & m[2:, 1:-1] & m[1:-1, :-2] & m[1:-1, 2:]); return e
def dark(img, box): a = np.array(img.convert('L'))[box[1]:box[3], box[0]:box[2]] < 120; return a
def draw(imgfile, P, name, boxcrop):
    img = Image.open(U + imgfile).convert('RGB'); W, H = img.size
    m = mask(W, H, P); o = outline(m); a = np.array(img); a[o] = [230, 20, 20]
    Image.fromarray(a).crop(boxcrop).save(out + '_' + name + '.png'); return m
# ---- the factory sheet 1U-87 (051df29c): plan, nose down; front ----
F = '051df29c-image.jpg'; K = 17.65 / 1000           # m a pixel
g = np.array(Image.open(U + F).convert('L')) < 120
cx = 595
# (the scan is not square: the span's 15 m reads 17.65 mm a pixel across, the fuselage's 6.787 m 15.4 along - nose
#  y 783, the rudder's tip y 342; each axis takes its own)
KY = 6.787 / (766 - 377); noseY = 766        # (13 Nov pm: the nose tip is row 766 and the rudder's tip 377 - the scan is ~square, 17.45 / 17.65 mm a pixel; 783 / 342 were dimension lines)
P = np.stack([cx + x / K, noseY - aft / KY], -1)
draw(F, P, 'plan', (140, 340, 1050, 830))
# front: the wheel's bottom on the drawing's (found: the lowest ink under the pod, 240-300)
# front: aligned on the WINGTIPS (ours: the wing's outermost vertex height; the drawing's: the ink at the tip columns)
W = np.array(['wing' in l for l in L]); iw = np.argmax(np.abs(x[W])); yTip = y[W].ravel()[iw]
tipX = cx - 7.5 / K; trow = np.nonzero(g[150:320, int(tipX) + 6])[0] + 150; tipY = trow.mean()
P = np.stack([cx + x / K, tipY - (y - yTip) / KY], -1)
draw(F, P, 'front', (140, 150, 1050, 320))
# ---- the small three-view (095efe18): side, level, the 0-4 m bar ----
S = '095efe18-image.jpg'; g2 = np.array(Image.open(U + S).convert('L')) < 120
bx = np.nonzero(g2[384, :340])[0]; K2 = 4.0 / (bx.max() - bx.min())   # the 0-4 m bar (rows 382-387, left of the tail)
reg = g2[230:362, 0:470]; cols = np.nonzero(reg.any(axis=0))[0]; noseX = cols.min()
rr = np.nonzero(g2[300:362, 0:330].any(axis=1))[0]; wheelY2 = 300 + rr.max()
print('three-view: %.1f mm/px, nose x %d, wheel y %d' % (K2 * 1000, noseX, wheelY2))
noW = np.array(['wing' not in l for l in L])     # (the side: the body, the tail and the gear - the wing's dihedral is the front view's)
# aligned on the NOSE TIP (ours: the fore-most vertex; the drawing's: the ink rows at its fore-most column)
iz = np.unravel_index(np.argmax(z), z.shape); yNose = y[iz]
nrows = np.nonzero(g2[230:362, noseX])[0] + 230; noseY2 = nrows.mean()
P = np.stack([noseX + aft[noW] / K2, noseY2 - (y[noW] - yNose) / K2], -1)
draw(S, P, 'side', (0, 220, 470, 362))
# ...and the factory side view (1U-87), tilted: the boom's underside 3.0 deg (its own note) - rotated about the nose
Fs = '051df29c-image.jpg'
gs = np.array(Image.open(U + Fs).convert('L')) < 120
print('wrote', out + '_{plan,front,side}.png')
