# crew_cut/cut.py - THE CABIN CUT WITH THE PILOT (16 Nov 2026): a dump's scene (dump.js) rasterised in numpy, flat
# Lambert, z-buffered, a 10 cm ruler (the layer frame's z, metres) along the bottom.
#   python3 tools/crew_cut/cut.py <dump.json> <dump_sheet.json> <out.png> [z0 z1 y0 y1 px-per-m] [--label text]
#                                 [--whole] [--view side|bottom]
# default: the side from +x (the pilot's left), nose left, the near (+x) half of the hull and of every other layer
# left out, the crew layer (seat, pilot, stick, pedals, panel) WHOLE; --whole keeps the hull whole and opaque (a crew
# part seen is a part THROUGH it); --view bottom looks up from below (nose left)
import sys, json, numpy as np
from PIL import Image, ImageDraw
a = sys.argv; dump, sheet, out = a[1], a[2], a[3]
z0, z1, y0, y1, K = [float(x) for x in a[4:9]] if len(a) > 8 and not a[4].startswith('--') else (-0.6, 2.9, -0.62, 0.62, 520)
label = a[a.index('--label') + 1] if '--label' in a else ''
WHOLE = '--whole' in a          # the skin kept whole (opaque): a crew part seen is a part through it
VIEW = a[a.index('--view') + 1] if '--view' in a else 'side'   # side (from +x) | bottom (from below, nose left)
W, H = int((z1 - z0) * K), int((y1 - y0) * K)
img = np.zeros((H, W, 3), np.float32); img[:] = (236, 236, 240); zb = np.full((H, W), -1e9, np.float32)
L = np.array([0.55, 0.65, -0.35]); L /= np.linalg.norm(L)
def raster(T, col, keep_near=True):
    # T: (n,3,3) metres; colour (n,3) or (3,)
    col = np.broadcast_to(np.asarray(col, np.float32), (len(T), 3))
    nrm = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]); ln = np.linalg.norm(nrm, axis=1) + 1e-12; nrm /= ln[:, None]
    sh = 0.35 + 0.65 * np.abs(nrm @ L)
    U = (z1 - T[..., 2]) * K; V = (y1 - T[..., 1]) * K; X = T[..., 0]
    for i in range(len(T)):
        u, v, x = U[i], V[i], X[i]
        ua, ub = int(max(0, np.floor(u.min()))), int(min(W - 1, np.ceil(u.max())))
        va, vb = int(max(0, np.floor(v.min()))), int(min(H - 1, np.ceil(v.max())))
        if ua > ub or va > vb: continue
        gu, gv = np.meshgrid(np.arange(ua, ub + 1) + 0.5, np.arange(va, vb + 1) + 0.5)
        d = (v[1] - v[2]) * (u[0] - u[2]) + (u[2] - u[1]) * (v[0] - v[2])
        if abs(d) < 1e-12: continue
        l0 = ((v[1] - v[2]) * (gu - u[2]) + (u[2] - u[1]) * (gv - v[2])) / d
        l1 = ((v[2] - v[0]) * (gu - u[2]) + (u[0] - u[2]) * (gv - v[2])) / d
        l2 = 1 - l0 - l1
        m = (l0 >= -1e-6) & (l1 >= -1e-6) & (l2 >= -1e-6)
        if not m.any(): continue
        dep = l0 * x[0] + l1 * x[1] + l2 * x[2]
        sub = zb[va:vb + 1, ua:ub + 1]; w = m & (dep > sub)
        sub[w] = dep[w]; img[va:vb + 1, ua:ub + 1][w] = col[i] * sh[i]
D = json.load(open(dump)); S = json.load(open(sheet))
def tv(T):
    if VIEW != 'bottom': return T
    U = T.copy(); U[..., 0] = -T[..., 1]; U[..., 1] = T[..., 0]; return U
inwin = lambda T: (T[..., 2].max(1) > z0) & (T[..., 2].min(1) < z1) & (T[..., 1].max(1) > y0) & (T[..., 1].min(1) < y1)
# the sheet: the far half only
F = S['F']; M = np.array([f[0] for f in F]); T = np.array([f[1:] for f in F], np.float32).reshape(-1, 3, 3) / 1000
GL = np.isin(M, ['windshield', 'pilotWindow', 'pasengerWindow', 'skyWindows', 'drawnPane'])
keep = ((T[..., 0].mean(1) < 0.002) | WHOLE) & inwin(T)
col = np.where(GL[:, None], np.array([150, 190, 225], np.float32), np.array([222, 196, 150], np.float32))
raster(tv(T[keep]), col[keep])
COL = {}
for m in D['meshes']:
    T = np.array(m['P'], np.float32).reshape(-1, 3, 3) / 1000
    if not len(T): continue
    w = inwin(T)
    if m['layer'] != 'crew' and not WHOLE: w &= T[..., 0].mean(1) < 0.002     # the other layers: cut too
    if m['op'] < 0.3 and m['layer'] != 'crew': continue
    c = np.array(m['col'], np.float32)
    if m['skinned']: c = np.array([90, 125, 185], np.float32)         # the pilot
    elif m['layer'] == 'crew': c = np.maximum(c, 55)
    raster(tv(T[w]), c)
im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)); dr = ImageDraw.Draw(im)
for z in np.arange(np.ceil(z0 * 10) / 10, z1, 0.1):        # a 10 cm ruler along the bottom (metres, the frame's z)
    u = (z1 - z) * K; big = abs(z * 2 - round(z * 2)) < 1e-6
    dr.line([(u, H - 1), (u, H - (14 if big else 7))], fill=(60, 60, 60))
    if big: dr.text((u + 2, H - 26), '%.1f' % z, fill=(60, 60, 60))
if label: dr.text((10, 8), label, fill=(30, 30, 30))
im.save(out); print('wrote', out, W, 'x', H)
