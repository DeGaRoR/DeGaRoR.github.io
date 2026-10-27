# fit_body.py <ref.json> --key K <out-prefix> '<rows JSON: {"row": [lo, hi, step], ...}>' [--over JSON]
#             [--range a0,a1] [--skipbot b0,b1] [--cut y] [--w top,bot,hw,post]
# ONE STEP OF THE BODY (tools/REF_MATCH.md, section 3, steps 1 and 2), searched: the rows named are walked one at a
# time (coordinate search, the step halved when no move helps) against the reference body station by station -
# the centreline's TOP and BOTTOM (|x| < 4 cm) and the HALF-WIDTH above the height `cut` (default -0.45 m: the
# wing's roots and the radiators below it are not the body), and the tail post. `skipbot` leaves the bottom out
# over a station range: where a low wing's centre section IS the belly (the Spitfire's 1.9 - 4.4 m) the reference's
# bottom is the wing's skin and ours the keel above it. The order stays the procedure's: the lengths first (the
# openings, the post), then the sections, then the plan - one call per step, each over the last one's result.
import sys, os, json, subprocess, io, contextlib, runpy
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
args = sys.argv[1:]
def opt(k, d=None):
    return args[args.index(k) + 1] if k in args else d
refj = args[0]
src = ['--key', args[2]] if args[1] == '--key' else [args[1]]
rest = args[3:] if args[1] == '--key' else args[2:]
out, rows = rest[0], json.loads(rest[1])
base = json.loads(opt('--over', '{}'))
a0, a1 = (float(v) for v in opt('--range', '0.5,9.0').split(','))
sk = [float(v) for v in opt('--skipbot', '0,0').split(',')]
CUT = float(opt('--cut', '-0.45'))
wT, wB, wW, wP = (float(v) for v in opt('--w', '1,1,1,2').split(','))
STATIONS = np.arange(a0, a1 + 1e-6, 0.25)
def measure(over):
    subprocess.check_call(['node', os.path.join(HERE, 'dump_build.js')] + src + [out, '--over', json.dumps(over)],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    sys.argv = ['refmatch.py', refj, out]; buf = io.StringIO()
    with contextlib.redirect_stdout(buf): g = runpy.run_path(os.path.join(HERE, 'refmatch.py'))
    return g
def table(cut, T, d):
    q = cut(T, 2, -d)
    if len(q) < 4: return None
    c = q[np.abs(q[:, 0]) < 0.04]; s = q[q[:, 1] > CUT]
    return (c[:, 1].max() if len(c) else np.nan, c[:, 1].min() if len(c) else np.nan,
            np.abs(s[:, 0]).max() if len(s) else np.nan)
REFT = None
def score(over, show=False):
    global REFT
    g = measure(over); REF, OUR, cut = g['REF'], g['OUR'], g['cut']
    RP = np.vstack([REF[r] for r in ('fuselage', 'cowl') if len(REF.get(r, []))])
    OP = np.vstack([OUR[r] for r in ('fuselage', 'cowl') if len(OUR.get(r, []))])
    if REFT is None:
        # the hood: the config's "markers" naming glazing (canopy / windscreen / hood) join the body's top line
        GN = np.array([str(x) for x in g['GN']]); R = g['R'](g['GT'])
        gl = [v for k, v in (g['ref'].get('markers') or {}).items() if any(w in k for w in ('canopy', 'windscreen', 'hood'))]
        H = R[np.array([any(n.endswith(m) for m in gl) for n in GN])] if gl else np.zeros((0, 3, 3))
        REFT = ([table(cut, np.vstack([RP, H]) if len(H) else RP, d) for d in STATIONS], g['hr']['tail post aft'])
    e = []; rows_ = []
    for r, d in zip(REFT[0], STATIONS):
        o = table(cut, OP, d)
        if r is None or o is None: continue
        rows_.append((d, r, o))
        if np.isfinite(r[0]) and np.isfinite(o[0]): e.append(wT * abs(o[0] - r[0]))
        if not (sk[0] <= d <= sk[1]) and np.isfinite(r[1]) and np.isfinite(o[1]): e.append(wB * abs(o[1] - r[1]))
        if np.isfinite(r[2]) and np.isfinite(o[2]): e.append(wW * abs(o[2] - r[2]))
    post = -OUR['fuselage'][..., 2].min()
    e.append(wP * abs(post - REFT[1]))
    if show:
        print('   aft  | ref top   bot    hw | ours top   bot    hw')
        for d, r, o in rows_: print('  %5.2f | %6.3f %6.3f %5.3f | %6.3f %6.3f %5.3f' % ((d,) + tuple(r) + tuple(o)))
        print('  tail post ours %.3f ref %.3f' % (post, REFT[1]))
    return float(np.mean(e))
cur = dict(base); cur.update({k: v[0] + (v[1] - v[0]) / 2 for k, v in rows.items() if k not in base})
best = score(cur); print('start %.4f  %s' % (best, json.dumps({k: cur[k] for k in rows})), flush=True)
stp = {k: v[2] * 4 for k, v in rows.items()}
for it in range(8):
    moved = False
    for k, (lo, hi, s0) in rows.items():
        for sg in (1, -1):
            while True:
                t = dict(cur); t[k] = round(min(hi, max(lo, cur[k] + sg * stp[k])) / s0) * s0
                if abs(t[k] - cur[k]) < 1e-9: break
                sc = score(t)
                if sc < best - 1e-5: best, cur, moved = sc, t, True
                else: break
    print('pass %d  %.4f  %s' % (it, best, json.dumps({k: round(cur[k], 4) for k in rows})), flush=True)
    if not moved:
        if all(stp[k] <= rows[k][2] for k in rows): break
        stp = {k: max(rows[k][2], stp[k] / 2) for k in rows}
score(cur, show=True)
print('FOUND ' + json.dumps({k: round(cur[k], 4) for k in rows}))
