"""Rubber-sheet the AI map onto the real geography: per block, the shift that best matches the AI's land mask to the
real one; a smoothed displacement field; a bilinear remap. Also reports the local drift (in metres) before / after."""
import sys, numpy as np
from PIL import Image, ImageFilter
B = r'C:/Users/denis/AppData/Local/Temp/claude/D--Dev-DeGaRoR-github-io--claude-worktrees-charming-lichterman-3a3f8b/64b47f9a-7d94-4136-a88b-c85eedbdd445'
S = B + '/scratchpad'
W, H, MPP = 2167, 2834, 12
ai = Image.open(B + '/images/2.webp').convert('RGB').resize((W, H), Image.LANCZOS)
ref = Image.open(S + '/map_hd/jolene_map_6m_clean_bold.png').convert('RGB').resize((W, H), Image.NEAREST)
def land(im):
    a = np.asarray(im).astype(int); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return ~((b > r + 25) & (b > g - 10))
La, Lr = land(ai), land(ref)
# edges matter (a block of solid land or sea says nothing): score = agreement on the coastline band of the reference
def band(L):
    e = np.asarray(Image.fromarray((L * 255).astype('uint8')).filter(ImageFilter.FIND_EDGES)) > 0
    return np.asarray(Image.fromarray((e * 255).astype('uint8')).filter(ImageFilter.MaxFilter(9))) > 0
Br = band(Lr)
BS, STEP, R = 260, 130, 48          # block size, step, search radius (px)
gy = list(range(0, H - BS + 1, STEP)); gx = list(range(0, W - BS + 1, STEP))
DX = np.zeros((len(gy), len(gx))); DY = np.zeros_like(DX); WT = np.zeros_like(DX)
for a, y in enumerate(gy):
    for b, x in enumerate(gx):
        m = Br[y:y + BS, x:x + BS]
        if m.sum() < 400: continue
        ref_blk = Lr[y:y + BS, x:x + BS]
        best = (-1, 0, 0)
        for dy in range(-R, R + 1, 4):
            for dx in range(-R, R + 1, 4):
                y0, x0 = y + dy, x + dx
                if y0 < 0 or x0 < 0 or y0 + BS > H or x0 + BS > W: continue
                sc = ((La[y0:y0 + BS, x0:x0 + BS] == ref_blk) & m).sum() / m.sum()
                if sc > best[0]: best = (sc, dx, dy)
        sc, dx, dy = best
        for ddy in range(dy - 3, dy + 4):          # refine at 1 px
            for ddx in range(dx - 3, dx + 4):
                y0, x0 = y + ddy, x + ddx
                if y0 < 0 or x0 < 0 or y0 + BS > H or x0 + BS > W: continue
                s2 = ((La[y0:y0 + BS, x0:x0 + BS] == ref_blk) & m).sum() / m.sum()
                if s2 > sc: sc, best = s2, (s2, ddx, ddy)
        DX[a, b], DY[a, b], WT[a, b] = best[1], best[2], best[0]
# fill blocks without coast (open sea / inland) from neighbours, then smooth (weighted)
def fill_smooth(D, Wt, it=40):
    D = D.copy(); known = Wt > 0
    for _ in range(it):
        P = np.pad(D, 1, mode='edge'); K = np.pad(known.astype(float), 1, mode='edge'); Q = np.pad(Wt, 1, mode='edge')
        num = np.zeros_like(D); den = np.zeros_like(D)
        for oy in (-1, 0, 1):
            for ox in (-1, 0, 1):
                w = (K * Q)[1 + oy:1 + oy + D.shape[0], 1 + ox:1 + ox + D.shape[1]] * (2 if (oy == 0 and ox == 0) else 1)
                num += P[1 + oy:1 + oy + D.shape[0], 1 + ox:1 + ox + D.shape[1]] * w; den += w
        D = np.where(den > 0, num / np.maximum(den, 1e-9), D)
        known = known | (den > 0); Wt = np.where(Wt > 0, Wt, 0.5 * (den > 0))
    return D
DXs, DYs = fill_smooth(DX, WT), fill_smooth(DY, WT)
mag = np.hypot(DX, DY)[WT > 0]
print('blocks with coast %d; local drift median %.1f px (%.0f m), 90th %.1f px (%.0f m), max %.1f px (%.0f m)' % (
    mag.size, np.median(mag), np.median(mag) * MPP, np.percentile(mag, 90), np.percentile(mag, 90) * MPP, mag.max(), mag.max() * MPP))
# the field at full resolution (bilinear over block centres), then remap: out(u,v) = ai(u+dx, v+dy)
cy = np.array(gy) + BS / 2; cx = np.array(gx) + BS / 2
def up(D):
    yy = np.clip(np.interp(np.arange(H), cy, np.arange(len(cy))), 0, len(cy) - 1)
    xx = np.clip(np.interp(np.arange(W), cx, np.arange(len(cx))), 0, len(cx) - 1)
    y0 = np.floor(yy).astype(int); x0 = np.floor(xx).astype(int); y1 = np.minimum(y0 + 1, len(cy) - 1); x1 = np.minimum(x0 + 1, len(cx) - 1)
    fy = (yy - y0)[:, None]; fx = (xx - x0)[None, :]
    return (D[y0][:, x0] * (1 - fy) * (1 - fx) + D[y0][:, x1] * (1 - fy) * fx + D[y1][:, x0] * fy * (1 - fx) + D[y1][:, x1] * fy * fx)
FX, FY = up(DXs), up(DYs)
A = np.asarray(ai).astype(np.float32)
V, U = np.mgrid[0:H, 0:W].astype(np.float32)
sx = np.clip(U + FX, 0, W - 1.001); sy = np.clip(V + FY, 0, H - 1.001)
x0 = np.floor(sx).astype(int); y0 = np.floor(sy).astype(int); fx = (sx - x0)[..., None]; fy = (sy - y0)[..., None]
out = (A[y0, x0] * (1 - fx) * (1 - fy) + A[y0, x0 + 1] * fx * (1 - fy) + A[y0 + 1, x0] * (1 - fx) * fy + A[y0 + 1, x0 + 1] * fx * fy)
outI = Image.fromarray(np.clip(out, 0, 255).astype('uint8'))
outI.save(S + '/boards/mapmock/map_ai2.jpg', quality=88)
outI.save(S + '/map_hd/jolene_map_ai_fitted.png', optimize=True)
Lo = land(outI)
def iou(L): return (L & Lr).sum() / (L | Lr).sum()
print('land IoU before %.3f after %.3f' % (iou(La), iou(Lo)))
# the check picture: the real coast in red over the fitted map, the south
e = band(Lr) & ~np.asarray(Image.fromarray((band(Lr) * 255).astype('uint8')).filter(ImageFilter.MinFilter(7)))
e = np.asarray(Image.fromarray((Lr * 255).astype('uint8')).filter(ImageFilter.FIND_EDGES)) > 0
e = np.asarray(Image.fromarray((e * 255).astype('uint8')).filter(ImageFilter.MaxFilter(3))) > 0
for name, img in (('before', ai), ('after', outI)):
    ov = np.asarray(img).copy(); ov[e] = [255, 30, 30]
    Image.fromarray(ov).crop((int(W * .18), int(H * .6), int(W * .6), int(H * .95))).save(S + '/map_hd/fit_%s_south.jpg' % name, quality=88)
np.save(S + '/map_hd/fit_field.npy', np.stack([DXs, DYs]))
