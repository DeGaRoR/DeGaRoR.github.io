# leg_line.py <ref.json> <ours-prefix> - the main legs seen from the FRONT: a line x(y) fitted through each side's leg
# points between the body and the axle, for the reference ('legs' role) and ours (the gear layer's legs, the wheel left
# out): the root (where the line meets the body's bottom), the foot (at the axle height) and the angle from vertical.
# The angle is set with the legs' anchor rows (the station's pivot angle round the body - how high on the body side the
# legs root - and the half track), not by eye.
import sys, os, runpy, io, contextlib
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv = ['refmatch.py', sys.argv[1], sys.argv[2]]; buf = io.StringIO()
with contextlib.redirect_stdout(buf): g = runpy.run_path(os.path.join(HERE, 'refmatch.py'))
REF, OUR, hr = g['REF'], g['OUR'], g['hr']
cut = g['cut']
def line(T, ybot, ytop):
    # the legs sliced at ten heights (a tube's vertices sit at its ends only): the slice points, starboard side
    T = T[(-T[..., 2] < 2.0).all(1)]
    P = np.vstack([cut(T, 1, y) for y in np.linspace(ybot, ytop, 10)]) if len(T) else np.zeros((0, 3))
    P = P[P[:, 0] > 0.05] if len(P) else P
    if len(P) < 10: return None
    A = np.c_[P[:, 1], np.ones(len(P))]; k, c = np.linalg.lstsq(A, P[:, 0], rcond=None)[0]
    return k, c
tyre = REF['tyre'].reshape(-1, 3); tyre = tyre[tyre[:, 0] > 0]; axle_y = (tyre[:, 1].min() + tyre[:, 1].max()) / 2
bot = hr['body bottom (TL)']
for nm, P in (('ref', REF['legs']), ('ours', OUR['gear'][(OUR['gear'][..., 0] < 0.5 * 2).all(1)])):
    # ours: leave the wheel out (everything within its radius of the axle height and outboard of the leg's foot)
    L = line(P, axle_y + 0.12, bot - 0.03)
    if not L: print(nm, 'no leg points'); continue
    k, c = L
    print('%-4s root x %.3f at y %.3f | foot x %.3f at y %.3f | %.1f deg from vertical' % (nm, k * bot + c, bot, k * axle_y + c, axle_y, np.degrees(np.arctan(k))))
