# bp_fit.py <bp.json> <born.json> <out-prefix> '<rows JSON: {"row": [lo, hi, step], ...}>' [--over JSON]
#           [--w side,plan,front] [--range a0,a1]
# ONE STEP OF A CARD AGAINST A THREE-VIEW DRAWING, searched (tools/REF_MATCH.md section 12; blueprint.py's frames).
# The born spec is re-drawn with the rows laid over it (dump_build.js --over, as fit_body.py does: no re-birth, ~4 s
# a try) and scored 1 - IoU against the traced silhouettes, each view weighted by --w (default 1,1,1); --range keeps
# the side and plan views to the stations a0..a1 metres aft of the nose (a step's own part: the pod, the tail). The
# rows named are walked one at a time, a step up and a step down, the step halved when no move helps (a coordinate
# search, as fit_body.py). Prints each improvement and the rows at the end; writes <out>.json with them. The order
# stays the procedure's: one call per step, its rows only, each over the last one's result (--over).
import sys, os, json, subprocess
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import blueprint as BPM
args = sys.argv[1:]
def opt(k, d=None): return args[args.index(k) + 1] if k in args else d
BPM.setup(args[0]); BORN, OUT = args[1], args[2]; ROWS = json.loads(args[3])
base = json.loads(opt('--over', '{}'))
W = dict(zip(BPM.VIEWS, (float(v) for v in opt('--w', '1,1,1').split(','))))
rng = [float(v) for v in opt('--range', '-1,99').split(',')]
REF = BPM.load_ref()
def window(view, M):
    if view == 'front' or rng == [-1, 99]: return M
    M = M.copy(); u0, u1, v0, v1 = BPM.GRID[view]
    if view == 'side':
        a = int(round((rng[0] - u0) / BPM.RES)); b = int(round((rng[1] - u0) / BPM.RES))
        M[:, :max(0, a)] = False; M[:, b:] = False
    else:                                                          # plan: v = aft, rows from v1 down
        a = int(round((v1 - rng[1]) / BPM.RES)); b = int(round((v1 - rng[0]) / BPM.RES))
        M[:max(0, a)] = False; M[b:] = False
    return M
def score(over):
    subprocess.check_call(['node', os.path.join(HERE, 'dump_build.js'), BORN, OUT, '--over', json.dumps(over)],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    O = BPM.ours_masks(OUT); s = 0
    for v in BPM.VIEWS:
        if not W[v]: continue
        r, o = window(v, REF[v]), window(v, O[v])
        s += W[v] * (1 - (r & o).sum() / max(1, (r | o).sum()))
    return s
cur = dict(base); step = {k: v[2] for k, v in ROWS.items()}
born = json.load(open(BORN))['spec']['cage']
for k in ROWS:
    if k not in cur: cur[k] = born.get(k) if born.get(k) is not None else (ROWS[k][0] + ROWS[k][1]) / 2
best = score(cur); print('start %.4f' % best, json.dumps({k: cur[k] for k in ROWS}))
for rnd in range(6):
    moved = False
    for k, (lo, hi, st0) in ROWS.items():
        for sg in (1, -1):
            while True:
                v = round(min(hi, max(lo, cur[k] + sg * step[k])), 4)
                if v == cur[k]: break
                tr = dict(cur, **{k: v}); s = score(tr)
                if s < best - 1e-4:
                    best, cur, moved = s, tr, True; print('  %-14s %8.3f  -> %.4f' % (k, v, best), flush=True)
                else: break
    if not moved:
        if all(step[k] <= ROWS[k][2] / 4 for k in ROWS): break
        step = {k: step[k] / 2 for k in step}
print('best %.4f' % best); print(json.dumps({k: cur[k] for k in ROWS}))
json.dump(cur, open(OUT + '_fit.json', 'w'))
