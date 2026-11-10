# overlay.py <render.png> <out.png> rhx rhy rtx rty [phx phy ptx pty [photo.jpg]]: our render's silhouette (outline + a veil) laid
# over the user's photo by a similarity fitted on two points (the prop hub and the tailwheel), photo coords at 540 px
import sys, numpy as np
from PIL import Image, ImageFilter
rp, out = sys.argv[1], sys.argv[2]
rh = np.array([float(sys.argv[3]), float(sys.argv[4])]); rt = np.array([float(sys.argv[5]), float(sys.argv[6])])
ph_ = np.array([47., 190.]); pt_ = np.array([462., 300.])
if len(sys.argv) > 7: ph_ = np.array([float(sys.argv[7]), float(sys.argv[8])]); pt_ = np.array([float(sys.argv[9]), float(sys.argv[10])])
K = 2.0                                        # the photo upscaled x2
photo = Image.open((sys.argv[11] if len(sys.argv) > 11 else 'reports/evidence/RUCKUS-2026-11-09/ref_photo_solo103.jpg')).convert('RGB')
photo = photo.resize((photo.width * 2, photo.height * 2), Image.LANCZOS)
R = Image.open(rp).convert('RGB'); a = np.asarray(R).astype(int)
mask = (np.abs(a - np.array([22, 26, 32])).sum(2) > 24)
# the similarity: render px -> photo px (x2)
vr = rt - rh; vp = (pt_ - ph_) * K
s = np.linalg.norm(vp) / np.linalg.norm(vr); ang = np.arctan2(vp[1], vp[0]) - np.arctan2(vr[1], vr[0])
c, sn = np.cos(ang) * s, np.sin(ang) * s
M = np.array([[c, -sn], [sn, c]]); T = ph_ * K - M @ rh
# warp the mask by the inverse map
H, W = photo.height, photo.width; yy, xx = np.mgrid[0:H, 0:W]
Mi = np.linalg.inv(M); src = (Mi @ (np.stack([xx.ravel(), yy.ravel()]) - T[:, None]))
sx = np.round(src[0]).astype(int); sy = np.round(src[1]).astype(int)
ok = (sx >= 0) & (sx < mask.shape[1]) & (sy >= 0) & (sy < mask.shape[0])
wm = np.zeros(H * W, bool); wm[ok] = mask[sy[ok], sx[ok]]; wm = wm.reshape(H, W)
mi = Image.fromarray((wm * 255).astype(np.uint8))
er = np.asarray(mi.filter(ImageFilter.MinFilter(5))) > 0
edge = wm & ~er
P = np.asarray(photo).astype(float)
P[wm] = P[wm] * 0.75 + np.array([0, 200, 255]) * 0.25
P[edge] = [0, 255, 255]
Image.fromarray(P.astype(np.uint8)).save(out); print(out, 'scale', round(s, 3), 'rot deg', round(np.degrees(ang), 2))
