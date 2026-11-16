# crew_cut/clash.py - python3 tools/crew_cut/clash.py <dump.json> <sheet.json>: the pilot's body against the dash shell (sheet 'dash'/'dashFace') and the
# crew's panel (edPanel*): pilot vertices within 12 mm of a dash / panel point, where
import sys, json, numpy as np
D = json.load(open(sys.argv[1])); S = json.load(open(sys.argv[2]))
def pts_of_tris(T, n=4):
    out = [T[:, 0], T[:, 1], T[:, 2], T.mean(1)]
    for a, b in ((0, 1), (1, 2), (2, 0)): out.append((T[:, a] + T[:, b]) / 2)
    return np.concatenate(out)
T = np.array([f[1:] for f in S['F'] if f[0] in ('dash', 'dashFace')], np.float64).reshape(-1, 3, 3) / 1000
Q = pts_of_tris(T)
for m in D['meshes']:
    if m['layer'] == 'crew' and m['name'].startswith('edPanel'):
        Q = np.concatenate([Q, pts_of_tris(np.array(m['P'], np.float64).reshape(-1, 3, 3) / 1000)])
P = np.unique(np.concatenate([np.array(m['P'], np.float64).reshape(-1, 3) for m in D['meshes'] if m['skinned']]) / 1000, axis=0)
bb = (P[:, 2] > Q[:, 2].min() - 0.05) & (P[:, 2] < Q[:, 2].max() + 0.05) & (P[:, 1] > Q[:, 1].min() - 0.05) & (P[:, 1] < Q[:, 1].max() + 0.05)
P = P[bb]
# a voxel grid of the dash / panel points (12 mm cells): a pilot point clashes when a cell within one of its own holds one
cell = 0.012; occ = set(map(tuple, np.floor(Q / cell).astype(np.int64)))
K = np.floor(P / cell).astype(np.int64); hit = []
for p, k in zip(P, K):
    if any((k[0] + a, k[1] + b, k[2] + c) in occ for a in (-1, 0, 1) for b in (-1, 0, 1) for c in (-1, 0, 1)): hit.append(p)
hit = [np.array(hit).reshape(-1, 3)]
H = np.concatenate(hit) if hit else np.zeros((0, 3))
print('dash/panel points %d, pilot points near %d, CLASH %d' % (len(Q), len(P), len(H)))
if len(H): print('  where: z %.2f..%.2f  y %.2f..%.2f  |x| %.2f..%.2f' % (H[:, 2].min(), H[:, 2].max(), H[:, 1].min(), H[:, 1].max(), np.abs(H[:, 0]).min(), np.abs(H[:, 0]).max()))
