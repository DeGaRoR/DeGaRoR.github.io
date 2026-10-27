# fit_cowl.py <ref.json> <--key K | build.json> <out-prefix> '<rows JSON: {"row": [lo, hi, step], ...}>' [--over JSON]
#             [--starboard] [--nose a0,a1] [--w top,bot,halfW,round]
# ONE STEP OF THE COWL FITTING (tools/REF_MATCH.md, section 4), searched: the rows named - and only those, the step's
# own - are walked one at a time (coordinate search, the step halved when no move helps) against cowl_sections.py's
# table and the body aft of the cockpits. The aft body is in the score because every row at the front moves the
# thrust line (the engine sits on the cowl's nose axis, plus engY): a fit that rebuilds the nose by sliding the whole
# aeroplane against the thrust line reads as a body gone wrong aft. Prints the rows found and the table.
# The order is the procedure's, not the tool's: waist and sizes, then roundness, then the faces and the droop, then
# the apertures, then engY - one call per step, each over the last one's result (--over).
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
base = json.loads(opt('--over', '{}')); SB = '--starboard' in args
SB = SB or json.load(open(refj)).get('exhaust') == 'port'
n0, n1 = (float(v) for v in opt('--nose', '0.2,1.1').split(','))
wT, wB, wW, wR = (float(v) for v in opt('--w', '1,1,1,0.3').split(','))
sys.argv = ['x']
def measure(over):
    subprocess.check_call(['node', os.path.join(HERE, 'dump_build.js')] + src + [out, '--over', json.dumps(over)],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    sys.argv = ['refmatch.py', refj, out]; buf = io.StringIO()
    with contextlib.redirect_stdout(buf): g = runpy.run_path(os.path.join(HERE, 'refmatch.py'))
    return g
def sec(cut, T, d, sb):
    q = cut(T, 2, -d)
    if sb: q = q[q[:, 0] > 0]
    if len(q) < 6: return None
    y, x = q[:, 1], np.abs(q[:, 0]); top, bot = y.max(), y.min(); H = top - bot; W = x.max()
    def wAt(yy):
        m = np.abs(y - yy) < 0.012
        return x[m].max() / W if m.any() else np.nan
    return np.array([top, bot, W, wAt(top - 0.12 * H), wAt(bot + 0.12 * H)])
REFS = None
def score(over):
    global REFS
    g = measure(over); REF, OUR, cut, ref = g['REF'], g['OUR'], g['cut'], g['ref']
    roles = list(dict.fromkeys(ref.get('profile', ['fuselage']) + ['cowl']))
    RP = np.vstack([REF[r] for r in roles if r in REF and len(REF[r])])
    OP = np.vstack([OUR[r] for r in ('fuselage', 'cowl') if len(OUR.get(r, []))])
    RF = REF['fuselage']; OF = OUR['fuselage']
    tp = g['hr']['tail post aft'] if 'hr' in g else 6.0
    nose = np.arange(n0, n1 + 1e-6, 0.1); aft = np.linspace(3.4, tp - 0.15, 6)
    if REFS is None:
        REFS = ([sec(cut, RP, d, SB) for d in nose], [sec(cut, RF, d, False) for d in aft])
    e = []
    for r, d in zip(REFS[0], nose):
        o = sec(cut, OP, d, SB)
        if r is None or o is None: continue
        dd = o - r; e += [wT * abs(dd[0]), wB * abs(dd[1]), wW * abs(dd[2])]
        e += [wR * abs(v) for v in dd[3:] if np.isfinite(v)]
    for r, d in zip(REFS[1], aft):
        o = sec(cut, OF, d, False)
        if r is None or o is None: continue
        e += [abs(o[0] - r[0]), abs(o[1] - r[1])]
    return float(np.mean(e))
# each row starts where --over puts it, else mid-range: name the build's own value in --over to start from it
cur = dict(base); cur.update({k: v[0] + (v[1] - v[0]) / 2 for k, v in rows.items() if k not in base})
best = score(cur); print('start %.4f  %s' % (best, json.dumps({k: cur[k] for k in rows})))
stp = {k: v[2] * 4 for k, v in rows.items()}
for it in range(6):
    moved = False
    for k, (lo, hi, s0) in rows.items():
        for sg in (1, -1):
            while True:
                t = dict(cur); t[k] = round(min(hi, max(lo, cur[k] + sg * stp[k])) / s0) * s0
                if abs(t[k] - cur[k]) < 1e-9: break
                sc = score(t)
                if sc < best - 1e-5: best, cur, moved = sc, t, True
                else: break
    print('pass %d  %.4f  %s' % (it, best, json.dumps({k: round(cur[k], 4) for k in rows})))
    if not moved:
        if all(stp[k] <= rows[k][2] for k in rows): break
        stp = {k: max(rows[k][2], stp[k] / 2) for k in rows}
print('FOUND ' + json.dumps({k: round(cur[k], 4) for k in rows}))
