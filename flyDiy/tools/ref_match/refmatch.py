# refmatch.py <ref.json> <ours-prefix> [--png <out-prefix>] [--tail <out.json>]
#
# A BUILD AGAINST A REFERENCE MODEL, in the reference's own terms: metres AFT OF THE FIREWALL (the cowl's back
# face) and ABOVE THE THRUST LINE (the propeller hub's axis). The reference is a GLB (glb_tris.py turns it into
# triangles, cached next to it) scaled by one known dimension (ref.json "scale"); ours is dump_build.js's dump of
# the built aeroplane. Prints, side by side with the difference:
#   1. the headline numbers  - cowl, body, tail post, wings, gear, fin, stab
#   2. the fuselage profile   - top / bottom / half-width, station by station (triangles sliced, not vertices)
#   3. the wings sliced        - chord line height, LE / TE across the span, the dihedral
#   4. the main gear           - the wheel's centre, track and radius, the legs' roots on the body
# --png writes side / top / front overlays (ours grey with a red edge, the reference green), aligned the same way;
# --tail writes the reference's fin and stab outlines in OUR frame, for fit_tail.js. The method: tools/REF_MATCH.md.
import sys, os, json, subprocess
import numpy as np

args = sys.argv[1:]
def opt(k):
    return args[args.index(k) + 1] if k in args else None
REFJ, OURS = args[0], args[1]
HERE = os.path.dirname(os.path.abspath(__file__))
ref = json.load(open(REFJ))
RDIR = os.path.dirname(os.path.abspath(REFJ))
glb = os.path.join(HERE, ref['glb']) if not os.path.isabs(ref['glb']) else ref['glb']
if not os.path.exists(glb): glb = os.path.join(RDIR, os.path.basename(ref['glb']))
cache = glb + '.npz'
if not os.path.exists(cache) or os.path.getmtime(cache) < os.path.getmtime(glb):
    subprocess.check_call([sys.executable, '-I', os.path.join(HERE, 'glb_tris.py'), glb, cache])
G = np.load(cache); GT = G['T'].astype(float); GN = G['names']

# ---- the reference's frame: x span, y up, z fore (the cage's) ------------------------------------------------
# "axes": "x=z,y=y,z=-x" remaps a model laid out another way; "align": "pca" turns a model yawed in its file: fore =
# the fuselage's long axis (pointed at the hub / cowl), up = the model's y made square to it, x = up x fore
def remap(T, spec):
    idx = {'x': 0, 'y': 1, 'z': 2}; out = np.empty_like(T)
    for p in spec.split(','):
        k, v = p.split('='); sg = -1 if v.startswith('-') else 1
        out[..., idx[k]] = sg * T[..., idx[v.lstrip('-')]]
    return out
if ref.get('axes'): GT = remap(GT, ref['axes'])
def match(entry):
    if isinstance(entry, str): entry = {'node': entry}
    k = entry['node']
    return np.array([(k in n + '/') or n.endswith(k) for n in GN]), entry.get('box')
SCALE = [1.0]       # boxes are written in the file's own units, after "axes" / "align" and before the scale
def boxed(T, box):
    if not box or not len(T): return np.ones(len(T), bool)
    c = T.mean(1) / SCALE[0]; m = np.ones(len(T), bool)
    for ax_, (lo, hi) in box.items():
        v = np.abs(c[:, 0]) if ax_ == 'absx' else c[:, {'x': 0, 'y': 1, 'z': 2}[ax_]]
        m &= (v >= lo) & (v <= hi)
    return m
def part(role):
    out = []
    for e in (ref['parts'].get(role) or []):
        m, box = match(e); T = GT[m]; out.append(T[boxed(T, box)])
    return np.vstack(out) if out else np.zeros((0, 3, 3))
if ref.get('align') == 'wing':
    # the flying attitude off the upper plane: span its long axis, fore its chord (pointed at the hub), up square to both
    # - for a model sitting in its file on three points (tail down), where the fuselage's axis is pitched
    Wp = part('upper').reshape(-1, 3); c0 = part('fuselage').reshape(-1, 3).mean(0)
    u_, s_, vt = np.linalg.svd(Wp - Wp.mean(0), full_matrices=False); span_, fore = vt[0], vt[1]
    tip = part('hub') if len(part('hub')) else part('cowl')
    if np.dot(tip.reshape(-1, 3).mean(0) - c0, fore) < 0: fore = -fore
    up = np.cross(fore, span_)
    if up[1] < 0: up = -up
    xs = np.cross(up, fore); Rm = np.stack([xs, up, fore])
    GT = (GT - c0) @ Rm.T
if ref.get('align') == 'pca':
    F_ = part('fuselage').reshape(-1, 3); c0 = F_.mean(0)
    u_, s_, vt = np.linalg.svd(F_ - c0, full_matrices=False); fore = vt[0]
    tip = part('hub') if len(part('hub')) else part('cowl')
    if np.dot(tip.reshape(-1, 3).mean(0) - c0, fore) < 0: fore = -fore
    up = np.array([0, 1.0, 0]); up = up - np.dot(up, fore) * fore; up /= np.linalg.norm(up)
    xs = np.cross(up, fore); Rm = np.stack([xs, up, fore])
    GT = (GT - c0) @ Rm.T
# the scale: one known dimension of one part
sc = ref['scale']; P0 = part(sc['part']).reshape(-1, 3)
ax = {'span': 0, 'height': 1, 'length': 2}[sc['by']]
s = sc['metres'] / (P0[:, ax].max() - P0[:, ax].min())
GT = GT * s; SCALE[0] = s

def cut(T, axis, v):
    pts = []
    for e0, e1 in [(0, 1), (1, 2), (2, 0)]:
        A = T[:, e0]; B = T[:, e1]; m = (A[:, axis] - v) * (B[:, axis] - v) < 0
        t = (v - A[m, axis]) / (B[m, axis] - A[m, axis]); pts.append(A[m] + (B[m] - A[m]) * t[:, None])
    return np.vstack(pts) if pts else np.zeros((0, 3))

# ---- ours ----------------------------------------------------------------------------------------------------
O = np.fromfile(OURS + '.bin', dtype=np.float32).reshape(-1, 3, 3).astype(float)
runs = json.load(open(OURS + '.json')); a = 0; L = {}
for nm, b in runs:
    L.setdefault(nm, []).append(O[a:b]); a = b
L = {k: np.vstack(v) for k, v in L.items()}
def lay(*names):
    q = [L[n] for n in names if n in L]
    return np.vstack(q) if q else np.zeros((0, 3, 3))

# ---- the two frames: the firewall and the thrust line, each side its own ------------------------------------
def frame(cowl, hub):
    c = cowl.reshape(-1, 3); h = hub.reshape(-1, 3) if len(hub) else c
    return c[:, 2].min(), (h[:, 1].min() + h[:, 1].max()) / 2
# no cowl on the reference (an exposed radial): the firewall is the fuselage's front face
if len(part('cowl')):
    rF, rTL = frame(part('cowl'), part('hub'))
    if ref.get('firewall') == 'cowl-bottom':
        # a bonnet whose top panel runs back over the tank to the cockpit (the Moth's): the firewall is the cowl's
        # back edge on its LOWER third, where the bonnet meets the fuselage
        c_ = part('cowl').reshape(-1, 3); yl = c_[:, 1].min() + (c_[:, 1].max() - c_[:, 1].min()) / 3
        rF = c_[c_[:, 1] < yl][:, 2].min()
else:
    fz = part('fuselage').reshape(-1, 3)[:, 2].max(); h = part('hub').reshape(-1, 3)
    rF, rTL = fz, (h[:, 1].min() + h[:, 1].max()) / 2
oF, oTL = frame(lay('cowl'), lay('eng'))
R = lambda T: T - np.array([0, rTL, rF]) if len(T) else T          # into (x, up, -aft)
Ou = lambda T: T - np.array([0, oTL, oF]) if len(T) else T
# "fbox": a box in the MATCH's own terms (metres: aft of the firewall, above the thrust line, |x|), applied once the
# two are known - the easy way to cut a piece out of a node a model merged everything into (never on cowl / hub)
def partF(role):
    out = []
    for e in (ref['parts'].get(role) or []):
        m, box = match(e); T = GT[m]; T = R(T[boxed(T, box)])
        fb = e.get('fbox') if isinstance(e, dict) else None
        if fb and len(T):
            c = T.mean(1); k_ = np.ones(len(T), bool)
            if 'aft' in fb: k_ &= (-c[:, 2] >= fb['aft'][0]) & (-c[:, 2] <= fb['aft'][1])
            if 'up' in fb: k_ &= (c[:, 1] >= fb['up'][0]) & (c[:, 1] <= fb['up'][1])
            if 'absx' in fb: k_ &= (np.abs(c[:, 0]) >= fb['absx'][0]) & (np.abs(c[:, 0]) <= fb['absx'][1])
            T = T[k_]
        out.append(T)
    return np.vstack(out) if out else np.zeros((0, 3, 3))
REF = {k: partF(k) for k in ref['parts']}
OUR = {'cowl': Ou(lay('cowl')), 'fuselage': Ou(lay('sheet')), 'upper': Ou(lay('wing')), 'lower': Ou(lay('wing2')),
       'fin': Ou(lay('fin')), 'stab': Ou(lay('stab')), 'gear': Ou(lay('gear'))}

def bbox(T):
    P = T.reshape(-1, 3); return P.min(0), P.max(0)
def wing_slices(T, semi):
    out = []
    for f in (0.15, 0.35, 0.6, 0.85):
        q = cut(T, 0, f * semi)
        out.append((f * semi, (q[:, 1].min() + q[:, 1].max()) / 2, -q[:, 2].max(), -q[:, 2].min()) if len(q) else (f * semi, np.nan, np.nan, np.nan))
    return out
def dihedral(sl):
    ok = [r for r in sl if not np.isnan(r[1])]
    return np.degrees(np.arctan2(ok[-1][1] - ok[0][1], ok[-1][0] - ok[0][0])) if len(ok) > 1 else np.nan
def heads(side):
    out = {}
    c0, c1 = bbox(side['cowl']); out['cowl length'] = c1[2] - c0[2]; out['cowl dia'] = c1[1] - c0[1]
    out['cowl centre (TL)'] = (c1[1] + c0[1]) / 2
    f0, f1 = bbox(side['fuselage']); out['body bottom (TL)'] = f0[1]; out['body half-width'] = max(-f0[0], f1[0])
    out['tail post aft'] = -f0[2]
    for w in ('upper', 'lower'):
        if len(side[w]):
            w0, w1 = bbox(side[w]); sl = wing_slices(side[w], w1[0])
            out[w + ' LE aft'] = sl[1][2]; out[w + ' TE aft'] = sl[1][3]; out[w + ' chord line (TL)'] = sl[1][1]
            out[w + ' dihedral'] = dihedral(sl); out[w + ' span'] = w1[0] - w0[0]
    for t in ('fin', 'stab'):
        if len(side[t]):
            t0, t1 = bbox(side[t]); out[t + ' LE aft'] = -t1[2]; out[t + ' TE aft'] = -t0[2]
            if t == 'fin': out['fin top (TL)'] = t1[1]; out['fin bottom (TL)'] = t0[1]
            else: out['stab span'] = t1[0] - t0[0]; out['stab height (TL)'] = (t0[1] + t1[1]) / 2
    return out
if 'cowl' not in REF or not len(REF['cowl']): REF['cowl'] = R(part('fuselage'))[:1] * 0 + np.array([0, 0, 0.0])
hr, ho = heads(REF), heads(OUR)
if not len(part('cowl')):
    for k in ('cowl length', 'cowl dia', 'cowl centre (TL)'): hr[k] = np.nan
print('== %s: headline (m; aft of the firewall, above the thrust line; scale x %.5f)' % (ref['name'], s))
for k in hr:
    o = ho.get(k, np.nan); print('  %-24s ours %7.3f  ref %7.3f  d %+7.3f' % (k, o, hr[k], o - hr[k]))

print('== fuselage profile (top / bottom above TL, half-width)')
print('   aft  |  ref top    bot  halfW |  ours top    bot  halfW')
tp = hr['tail post aft']
for d in np.round(np.linspace(0.05, tp - 0.05, 16), 2):
    def pr(T):
        q = cut(T, 2, -d)
        return (q[:, 1].max(), q[:, 1].min(), np.abs(q[:, 0]).max()) if len(q) else (np.nan,) * 3
    # "profile": the roles the outer skin is made of, when the fuselage role is not all of it (a bonnet's tank
    # fairing running back over the body - the Moth's)
    RP = np.vstack([REF[r] for r in ref.get('profile', ['fuselage']) if r in REF and len(REF[r])])
    print('  %5.2f | %6.3f %6.3f %6.3f | %6.3f %6.3f %6.3f' % ((d,) + pr(RP) + pr(OUR['fuselage'])))

print('== wings sliced (station x: chord line above TL, LE / TE aft)')
for w in ('upper', 'lower'):
    if not len(REF.get(w, [])) or not len(OUR[w]): continue
    semi = bbox(REF[w])[1][0]
    for (x, y, le, te), (_, y2, le2, te2) in zip(wing_slices(OUR[w], semi), wing_slices(REF[w], semi)):
        print('  %-5s x %5.2f  ours %6.3f %6.3f %6.3f | ref %6.3f %6.3f %6.3f' % (w, x, y, le, te, y2, le2, te2))

print('== main gear (x > 0)')
def wheel_of(T):
    P = T.reshape(-1, 3); P = P[P[:, 0] > 0]
    if not len(P): return None
    yb = P[:, 1].min(); w = P[P[:, 1] < yb + 0.75]; xo = w[:, 0].max(); t = w[w[:, 0] > xo - 0.12]
    return (-(t[:, 2].min() + t[:, 2].max()) / 2, (t[:, 1].min() + t[:, 1].max()) / 2, (t[:, 0].min() + t[:, 0].max()) / 2, (t[:, 1].max() - t[:, 1].min()) / 2)
wr = wheel_of(REF['tyre']) if 'tyre' in REF else None; wo = wheel_of(OUR['gear'][(-OUR['gear'][..., 2] < 2.0).all(1)])
if wr and wo:
    for k, a_, b_ in zip(('aft', 'centre (TL)', 'x', 'R'), wo, wr): print('  wheel %-12s ours %7.3f  ref %7.3f  d %+7.3f' % (k, a_, b_, a_ - b_))
def roots_of(T, bottom):
    P = T.reshape(-1, 3); P = P[(P[:, 0] > 0) & (P[:, 1] > bottom - 0.07) & (P[:, 1] < bottom + 0.09) & (-P[:, 2] < 2.0)]
    if not len(P): return []
    a_ = -P[:, 2]; cut_ = np.median(a_); out = []
    for m in (a_ <= cut_, a_ > cut_):
        if m.any(): Q = P[m]; out.append((-Q[:, 2].mean(), Q[:, 0].mean(), Q[:, 1].mean()))
    return out
if 'legs' in REF:
    rb = bbox(REF['legs'])[1][1]
    rr = roots_of(REF['legs'], rb - 0.03)
    # ours: the main gear's own top ends (x > 0.1, ahead of 2 m aft - the tail gear and the axle centre left out)
    g_ = OUR['gear'][((OUR['gear'][..., 0] > 0.1) & (-OUR['gear'][..., 2] < 2.0)).all(1)]
    ro = roots_of(g_, bbox(g_)[1][1] - 0.03) if len(g_) else []
    for i, r_ in enumerate(rr): print('  leg root %d ref  aft %.3f x %.3f y %.3f' % (i + 1, *r_))
    for i, r_ in enumerate(ro): print('  leg root %d ours aft %.3f x %.3f y %.3f' % (i + 1, *r_))

# ---- --roles: the reference coloured by role (is the config right?) -------------------------------------------
if opt('--roles'):
    from PIL import Image, ImageDraw
    COL = {'cowl': (230, 120, 40), 'hub': (40, 40, 40), 'fuselage': (90, 120, 200), 'upper': (40, 170, 90), 'lower': (120, 200, 80),
           'fin': (200, 60, 150), 'stab': (150, 60, 200), 'tyre': (30, 30, 30), 'legs': (200, 180, 40)}
    allT = R(GT)
    for v, (ua, wa) in {'side': (2, 1), 'top': (2, 0), 'front': (0, 1)}.items():
        U = allT[..., ua] * (-1 if v != 'front' else 1); Wv = allT[..., wa]
        u0, u1, w0, w1 = U.min(), U.max(), Wv.min(), Wv.max(); k_ = 900 / (u1 - u0)
        img = Image.new('RGB', (900, int((w1 - w0) * k_) + 30), (250, 250, 250)); d = ImageDraw.Draw(img)
        for t in allT: d.polygon([((-t[i, ua] if v != 'front' else t[i, ua]) * k_ - u0 * k_, (w1 - t[i, wa]) * k_) for i in range(3)], fill=(215, 215, 215))
        for role, c in COL.items():
            for t in REF.get(role, []): d.polygon([((-t[i, ua] if v != 'front' else t[i, ua]) * k_ - u0 * k_, (w1 - t[i, wa]) * k_) for i in range(3)], fill=c)
        x = 4
        for role, c in COL.items():
            d.rectangle([x, img.height - 20, x + 12, img.height - 8], fill=c); d.text((x + 15, img.height - 21), role, fill=(0, 0, 0)); x += 95
        img.save(opt('--roles') + '_' + v + '.png'); print('wrote ' + opt('--roles') + '_' + v + '.png')

# ---- the reference's tail in OUR frame (fit_tail.js) ----------------------------------------------------------
if opt('--tail'):
    sh = np.array([0, oTL, oF])
    tj = {'fin': (REF['fin'] + sh).tolist() if 'fin' in REF else [], 'stab': (REF['stab'] + sh).tolist() if 'stab' in REF else []}
    json.dump(tj, open(opt('--tail'), 'w')); print('wrote ' + opt('--tail'))

# ---- the overlays ---------------------------------------------------------------------------------------------
if opt('--png'):
    from PIL import Image, ImageDraw, ImageFilter
    K = 150
    A_all = Ou(O); B_all = R(GT)
    def view(T, v):
        if v == 'side': return np.stack([T[..., 2], -T[..., 1]], -1)
        if v == 'top': return np.stack([T[..., 2], T[..., 0]], -1)
        return np.stack([T[..., 0], -T[..., 1]], -1)
    for v in ('side', 'top', 'front'):
        A = view(A_all, v); B = view(B_all, v)
        lo = np.minimum(A.reshape(-1, 2).min(0), B.reshape(-1, 2).min(0)) - 0.2
        hi = np.maximum(A.reshape(-1, 2).max(0), B.reshape(-1, 2).max(0)) + 0.2
        W, H = ((hi - lo) * K).astype(int) + 1
        def mask(Pp):
            m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
            for t in (Pp - lo) * K: d.polygon([tuple(p) for p in t], fill=255)
            return m
        if v != 'front':     # nose to the left: flip the u axis
            A = A * np.array([-1, 1]); B = B * np.array([-1, 1])
            lo2 = np.minimum(A.reshape(-1, 2).min(0), B.reshape(-1, 2).min(0)) - 0.2; lo = lo2
        mo = mask(A); mg = mask(B)
        img = Image.new('RGB', (W, H), (250, 250, 250)); d = ImageDraw.Draw(img)
        for g in np.arange(np.floor(lo[0] * 2) / 2, lo[0] + W / K, 0.5):
            d.line([((g - lo[0]) * K, 0), ((g - lo[0]) * K, H)], fill=(200, 200, 200) if abs(g % 1) < 1e-6 else (228, 228, 228))
        for g in np.arange(np.floor(lo[1] * 2) / 2, lo[1] + H / K, 0.5):
            d.line([(0, (g - lo[1]) * K), (W, (g - lo[1]) * K)], fill=(200, 200, 200) if abs(g % 1) < 1e-6 else (228, 228, 228))
        img.paste((150, 150, 160), (0, 0), mo.point(lambda q: 150 if q else 0))
        img.paste((40, 190, 70), (0, 0), mg.point(lambda q: 70 if q else 0))
        img.paste((200, 60, 40), (0, 0), mo.filter(ImageFilter.FIND_EDGES).point(lambda q: 255 if q > 50 else 0))
        img.paste((0, 150, 40), (0, 0), mg.filter(ImageFilter.FIND_EDGES).point(lambda q: 255 if q > 50 else 0).filter(ImageFilter.MaxFilter(3)))
        d.text((8, 8), '%s - %s: grey/red ours, green the reference; aligned on the firewall and the thrust line; grid 0.5 m' % (ref['name'], v), fill=(0, 0, 0))
        out = opt('--png') + '_' + v + '.png'; img.save(out); print('wrote ' + out)
