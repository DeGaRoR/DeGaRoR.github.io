# cowl_sections.py <ref.json> <ours-prefix> [aft0 aft1 step] [--starboard] - THE COWL FITTING TABLE (tools/REF_MATCH.md, section 4):
# the nose sliced across, station by station, the reference's skin (its "profile" roles) against ours (body + cowl),
# in refmatch.py's frame. Each station gives the numbers the cowl is fitted by, in the fitting's order:
#   waist  - the height of the section's widest point (above the thrust line): the waist line, matched FIRST
#   top / bot / halfW - the global sizes, against the body's nose behind it
#   rT / rB - roundness, top and bottom: the half-width 12 % of the height under the top (over the bottom) over the
#             widest half-width (a box reads 1.00, an ellipse 0.62)
#   then the slope: top and bottom station to station (a top that RISES aft is the bonnet sloping down to the prop)
# and it flags the INVERTED CONE: a section wider or taller than the one behind it, past the nose's own rounding
# (the first 0.25 m). A cowl is never wider at its front than at its back.
# --starboard reads the half-widths off the +x side alone: a reference whose exhaust runs down one side (the DH.82's,
# port) would read the pipe as the cowl's width; a config's "exhaust": "port" sets it.
import sys, os, io, runpy, contextlib
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
SB = '--starboard' in sys.argv; av = [a for a in sys.argv[1:] if a != '--starboard']
refj, ours = av[0], av[1]
RANGE = [float(v) for v in av[2:5]] if len(av) > 4 else None
sys.argv = ['refmatch.py', refj, ours]; buf = io.StringIO()
with contextlib.redirect_stdout(buf): g = runpy.run_path(os.path.join(HERE, 'refmatch.py'))
REF, OUR, cut, ref = g['REF'], g['OUR'], g['cut'], g['ref']
SB = SB or ref.get('exhaust') == 'port'      # the config can say it once
# the flag is the COWL's: its own length only (aft of it, the body may taper as it likes). The default stations run
# from the cowl's front (+0.1, clear of the spinner) to 0.6 m behind its back - the fuselage's nose it is fitted to
hasC = len(OUR.get('cowl', [])) > 0
cAft = -OUR['cowl'][..., 2].min() if hasC else -1.0
cFore = -OUR['cowl'][..., 2].max() if hasC else 0.0
a0, a1, st = RANGE if RANGE else (np.round(cFore, 1) + 0.1, np.round(cAft, 1) + 0.6, 0.1)
roles = list(dict.fromkeys(ref.get('profile', ['fuselage']) + ['cowl']))
RP = np.vstack([REF[r] for r in roles if r in REF and len(REF[r])])
OP = np.vstack([OUR[r] for r in ('fuselage', 'cowl') if len(OUR.get(r, []))])
def sec(T, d):
    q = cut(T, 2, -d)
    if SB: q = q[q[:, 0] > 0]
    if len(q) < 6: return None
    y, x = q[:, 1], np.abs(q[:, 0]); top, bot = y.max(), y.min(); H = top - bot
    # the widest point: half-widths binned by height (1 cm), the waist the middle of the bins within 3 mm of the max
    b = np.round((y - bot) / 0.01).astype(int); w = np.zeros(b.max() + 1)
    np.maximum.at(w, b, x); W = w.max(); k = np.nonzero(w >= W - 0.003)[0]
    waist = bot + 0.01 * (k.min() + k.max()) / 2
    def wAt(yy):
        m = np.abs(y - yy) < 0.012
        return x[m].max() / W if m.any() else np.nan
    return dict(top=top, bot=bot, W=W, waist=waist, rT=wAt(top - 0.12 * H), rB=wAt(bot + 0.12 * H))
print('== the cowl fitting table (m: aft of the datum, above the thrust line); ref | ours | d')
print('   aft  |  waist          |  top            |  bot            |  halfW          |  rT        |  rB')
prev = None; flags = []
for d in np.arange(a0, a1 + 1e-6, st):
    r, o = sec(RP, d), sec(OP, d)
    if not r or not o: print('  %5.2f |  (no section: %s)' % (d, 'ref' if not r else 'ours')); continue
    row = '  %5.2f |' % d
    for k in ('waist', 'top', 'bot', 'W'):
        row += ' %5.2f %5.2f %+5.2f |' % (r[k], o[k], o[k] - r[k])
    row += ' %4.2f %4.2f |  %4.2f %4.2f' % (r['rT'], o['rT'], r['rB'], o['rB'])
    print(row)
    if prev and d > 0.25 + a0 and d <= cAft + 1e-6:
        if prev['W'] > o['W'] + 0.008 or prev['top'] - prev['bot'] > o['top'] - o['bot'] + 0.008:
            flags.append('%.2f' % (d - st))
    prev = o
print('INVERTED CONE (our cowl, to %.2f aft: wider or taller ahead of the station behind): ' % cAft + (', '.join(flags) if flags else 'none'))
