# crew_cut/poke.py - python3 tools/crew_cut/poke.py <dump.json> <sheet.json> [--all]: which crew-layer parts (the pilot included) stand OUTSIDE the
# fuselage's OUTER skin (composite / body / glass / waistband / the pillars - not the seams' joint strips, nor the dash,
# floor loop and shoulder that line the inside). For each vertex: a ray from the section's own axis (x 0, the middle of
# the section's height at that z) out through the vertex; the first skin hit along it is the wall there; a vertex beyond
# it by more than 2 mm is out, by that much
import sys, json, numpy as np
D = json.load(open(sys.argv[1])); S = json.load(open(sys.argv[2]))
OUTER = {'composite', 'windshield', 'body', 'waistband', 'pillarCabin', 'pillarTail'}
F = [f for f in S['F'] if f[0] in OUTER]
T = np.array([f[1:] for f in F], np.float64).reshape(-1, 3, 3) / 1000
V0, E1, E2 = T[:, 0], T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]
SV = T.reshape(-1, 3); zb = np.round(SV[:, 2] / 0.02).astype(int)
ylo, yhi = {}, {}
for k, y in zip(zb, SV[:, 1]): ylo[k] = min(ylo.get(k, 9), y); yhi[k] = max(yhi.get(k, -9), y)
def yc(z):
    k = int(round(z / 0.02))
    for dk in (0, 1, -1, 2, -2): 
        if k + dk in ylo: return (ylo[k + dk] + yhi[k + dk]) / 2
    return None
def depth(p):
    c = yc(p[2])
    if c is None: return 1.0        # beyond the body's ends
    O = np.array([0.0, c, p[2]]); r = p - O; L = np.linalg.norm(r)
    if L < 1e-6: return 0.0
    d = r / L
    Pv = np.cross(d, E2); det = np.einsum('ij,ij->i', E1, Pv); ok = np.abs(det) > 1e-14; inv = np.where(ok, 1 / np.where(ok, det, 1), 0)
    s = O - V0; u = np.einsum('ij,ij->i', s, Pv) * inv; q = np.cross(s, E1); v = (q @ d) * inv; t = np.einsum('ij,ij->i', E2, q) * inv
    h = ok & (u >= -1e-9) & (v >= -1e-9) & (u + v <= 1 + 1e-9) & (t > 1e-6)
    if not h.any(): return 1.0
    return L - t[h].min()
rows = []
for m in D['meshes']:
    if m['layer'] != 'crew': continue
    P = np.unique(np.array(m['P'], np.float64).reshape(-1, 3) / 1000, axis=0)
    if len(P) > 400: P = P[np.random.default_rng(0).choice(len(P), 400, replace=False)]
    dd = np.array([depth(p) for p in P]); o = dd > 0.002
    if o.any():
        O = P[o]; rows.append((dd.max(), m['name'][:58], int(o.sum()), len(P), O[:, 2].min(), O[:, 2].max(), O[:, 1].min(), O[:, 1].max(), np.abs(O[:, 0]).max()))
rows.sort(reverse=True)
print('%-58s %8s %6s  %-11s %-12s %s' % ('part (crew layer)', 'out/all', 'depth', 'z', 'y', '|x|max'))
for r in rows: print('%-58s %4d/%-4d %5.0fmm  %.2f..%.2f  %.2f..%.2f  %.2f' % (r[1], r[2], r[3], r[0] * 1000, r[4], r[5], r[6], r[7], r[8]))
print('PARTS OUT:', len(rows))
