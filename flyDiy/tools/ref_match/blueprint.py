# blueprint.py - A CARD AGAINST A THREE-VIEW DRAWING, when there is no reference model (tools/REF_MATCH.md section 12).
#
#   python3 -I tools/ref_match/blueprint.py trace <bp.json> <image>        # the drawing -> silhouettes in metres
#   python3 -I tools/ref_match/blueprint.py match <bp.json> <ours-prefix> [--png <out-prefix>] [--on-image <image>]
#   python3 -I tools/ref_match/blueprint.py tail  <bp.json> <ours-prefix> <tail.json>   # the fin / stab for fit_tail.js
#
# TRACE reads each view's box off the drawing (a line drawing: dark lines on white), erases the boxes the config names
# (dimension lines, text, ground hatching, the dashed pilot's legs), fills every closed outline (the background is
# what a flood from the box's border reaches) and opens the result by one pixel (the thin leftovers - a dash, a
# dimension tick - go). The scale is the config's `mmPerPx` (measure it on the drawing's own dimension lines). It
# writes <bp dir>/<key>/{side,plan,front}.png, one bit a centimetre, in THE MATCH'S FRAME:
#   side   u = metres AFT of the nose, v = metres ABOVE the datum line
#   plan   u = metres along the span (+ starboard as drawn), v = metres AFT of the nose
#   front  u = metres along the span, v = metres ABOVE the datum line
# The datum line is the rod's (boom's) top edge at `datumAt` metres aft of the nose in the side view, and in the front
# view the wing's upper edge at `frontDatumSpan` metres out, set to the height the side view reads for the wing's top
# at the root (so the two views share one height). Those masks are what gets committed - measurements, not the drawing.
#
# MATCH renders ours (dump_build.js's dump: x span, y up, z fore) into the same three frames at 1 cm, aligned the same
# way (our nose, our rod's top at `datumAt`, our wing's top at the root), leaving out the layers the drawing does not
# have (`skipLayers`: a glider's drawing has no engine), and prints:
#   - the headline: length, height, span, nose to wing LE / TE, the pod's aft face, the tail's stations, IoU per view;
#   - the side profile (top / bottom) station by station;
#   - the plan: the wing's LE / TE / chord across the span, the stab's, the body's half-width station by station;
#   - the front: the pod's width at heights under the wing.
# --png writes <out>_{side,plan,front}.png: both = grey, the drawing only = green, ours only = red, at 1 cm a pixel.
# --on-image draws our outline in red over the drawing itself (for the user's eye; that picture is not committed).
import sys, os, json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

RES = 0.01                                   # metres a cell
args = sys.argv[1:]
def opt(k, d=None): return args[args.index(k) + 1] if k in args else d
BP = K = OUTDIR = None
def setup(bpj):                                                   # the config (bp_fit.py imports this file and calls it)
    global BP, K, OUTDIR
    BP = json.load(open(bpj)); K = BP['mmPerPx'] / 1000.0
    OUTDIR = os.path.join(os.path.dirname(os.path.abspath(bpj)), BP['key'])
VIEWS = ('side', 'plan', 'front')
# each view's grid: (u0, u1, v0, v1) metres
GRID = {'side': (-0.5, 7.0, -2.0, 2.5), 'plan': (-8.0, 8.0, -0.5, 7.0), 'front': (-8.0, 8.0, -2.0, 2.5)}

def grid_shape(view):
    u0, u1, v0, v1 = GRID[view]
    return int(round((v1 - v0) / RES)), int(round((u1 - u0) / RES))

def to_cell(view, u, v):
    u0, u1, v0, v1 = GRID[view]
    return (np.asarray(u) - u0) / RES, (v1 - np.asarray(v)) / RES     # col, row (row 0 = top)

# --------------------------------------------------------------------------------------------------------------------
def silhouette(img, view):
    V = BP['views'][view]
    x0, y0, x1, y1 = V['box']
    g = np.asarray(img.convert('L'), dtype=np.int16)[y0:y1, x0:x1]
    ink = g < BP.get('ink', 160)
    for (a, b, c, d) in V.get('erase', []):                       # absolute pixel boxes
        ink[max(0, b - y0):max(0, d - y0), max(0, a - x0):max(0, c - x0)] = False
    for (a, b, c, d) in V.get('fill', []):                        # boxes declared solid (a part drawn open)
        ink[max(0, b - y0):max(0, d - y0), max(0, a - x0):max(0, c - x0)] = True
    # close one-pixel gaps in the lines so an outline holds water, then flood the background from the border
    im = Image.fromarray((ink * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))
    pad = Image.new('L', (im.width + 2, im.height + 2), 0); pad.paste(im, (1, 1))
    ImageDraw.floodfill(pad, (0, 0), 128)
    a = np.asarray(pad)[1:-1, 1:-1]
    solid = a != 128
    # the 3x3 close above grew every line by a pixel: shrink back, then drop what is thinner than 3 px (dims, dashes)
    s = Image.fromarray((solid * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    s = np.asarray(s) > 0
    # keep the components that touch the view's seeds (the aeroplane), drop the rest (text, stray marks)
    lab = Image.fromarray((s * 255).astype(np.uint8)); keep = np.zeros_like(s)
    for (sx, sy) in V['seeds']:
        if not s[sy - y0, sx - x0]: continue
        t = lab.copy(); ImageDraw.floodfill(t, (sx - x0, sy - y0), 77); keep |= np.asarray(t) == 77
    return keep, (x0, y0)

def trace(image):
    img = Image.open(image)
    os.makedirs(OUTDIR, exist_ok=True)
    out = {}
    # side first: the nose and the datum line
    m, (x0, y0) = silhouette(img, 'side')
    ys, xs = np.nonzero(m)
    fwd = BP['views']['side'].get('fore', 'left')
    noseX = xs.min() if fwd == 'left' else xs.max()
    sgn = 1 if fwd == 'left' else -1
    col = int(round(noseX + sgn * BP['datumAt'] / K))
    top = np.nonzero(m[:, col])[0].min()
    datumY = top                                                  # the rod's top at datumAt, image rows (crop frame)
    S = {'side': {'noseX': int(noseX + x0), 'datumY': int(datumY + y0)}}
    def put(view, mask, inv):
        # each centimetre cell samples the drawing pixel it falls in (inv: grid u, v -> crop column, row)
        H, W = grid_shape(view); u0, u1, v0, v1 = GRID[view]
        uu = u0 + (np.arange(W) + 0.5) * RES; vv = v1 - (np.arange(H) + 0.5) * RES
        U, Vv = np.meshgrid(uu, vv); c, r = inv(U, Vv)
        c = np.floor(c).astype(int); r = np.floor(r).astype(int)
        ok = (c >= 0) & (c < mask.shape[1]) & (r >= 0) & (r < mask.shape[0])
        G = np.zeros((H, W), bool); G[ok] = mask[r[ok], c[ok]]
        return G
    out['side'] = put('side', m, lambda u, v: (noseX + sgn * u / K, datumY - v / K))
    # the wing's top at the root, off the side view (wingTopAt metres aft of the nose): the front view's height datum
    cw = int(round(noseX + sgn * BP['wingTopAt'] / K))
    wingTopH = (datumY - np.nonzero(m[:, cw])[0].min()) * K
    # plan: nose = the fore-most row, centre = the wing's mid-span
    m, (x0, y0) = silhouette(img, 'plan')
    ys, xs = np.nonzero(m)
    pf = BP['views']['plan'].get('fore', 'down')
    noseY = ys.max() if pf == 'down' else ys.min()
    cx = (xs.min() + xs.max() + 1) / 2.0
    ps = -1 if pf == 'down' else 1
    S['plan'] = {'noseY': int(noseY + y0), 'cx': float(cx + x0)}
    out['plan'] = put('plan', m, lambda u, v: (cx + u / K, noseY + ps * v / K))
    # front: centre as the plan; height: the wing's top at frontDatumSpan out, put at the side view's wing-top height
    m, (x0, y0) = silhouette(img, 'front')
    ys, xs = np.nonzero(m)
    fcx = (xs.min() + xs.max() + 1) / 2.0
    sp = BP.get('frontDatumSpan', 2.0)
    cl = [int(round(fcx + sp / K)), int(round(fcx - sp / K))]
    wtop = np.mean([np.nonzero(m[:, c])[0].min() for c in cl])
    S['front'] = {'cx': float(fcx + x0), 'wingTopY': float(wtop + y0), 'wingTopH': float(wingTopH)}
    out['front'] = put('front', m, lambda u, v: (fcx + u / K, wtop - (v - wingTopH) / K))
    for v in VIEWS:
        Image.fromarray((out[v] * 255).astype(np.uint8)).convert('1').save(os.path.join(OUTDIR, v + '.png'))
    json.dump({'datums_px': S, 'mmPerPx': BP['mmPerPx']}, open(os.path.join(OUTDIR, 'trace.json'), 'w'), indent=1)
    print('traced ->', OUTDIR, json.dumps(S))

# --------------------------------------------------------------------------------------------------------------------
def load_ours(prefix):
    O = np.fromfile(prefix + '.bin', dtype=np.float32).reshape(-1, 3, 3).astype(float)
    runs = json.load(open(prefix + '.json')); a = 0; keep = np.zeros(len(O), bool)
    skip = set(BP.get('skipLayers', []))
    for name, end in runs:
        if name not in skip: keep[a:end] = True
        a = end
    return O[keep]

def raster(view, polys):
    H, W = grid_shape(view)
    im = Image.new('1', (W, H), 0); d = ImageDraw.Draw(im)
    for p in polys:
        c, r = to_cell(view, p[:, 0], p[:, 1])
        d.polygon(list(zip(c.tolist(), r.tolist())), fill=1)
    return np.asarray(im, dtype=bool)

def datums(T):                                                    # our nose (z) and our datum line (y), world metres
    zN = T[..., 2].max()
    aft = zN - T[..., 2]
    side0 = raster('side', np.stack([aft, T[..., 1]], -1))       # our silhouette's top at datumAt aft
    c = int(round((BP['datumAt'] - GRID['side'][0]) / RES))
    r = np.nonzero(side0[:, c])[0].min()
    return zN, GRID['side'][3] - r * RES

def ours_masks(prefix):
    T = load_ours(prefix)
    zN, y0 = datums(T); aft = zN - T[..., 2]
    side = raster('side', np.stack([aft, T[..., 1] - y0], -1))
    plan = raster('plan', np.stack([-T[..., 0], aft], -1))
    front = raster('front', np.stack([-T[..., 0], T[..., 1] - y0], -1))
    return {'side': side, 'plan': plan, 'front': front}

def load_ref():
    return {v: np.asarray(Image.open(os.path.join(OUTDIR, v + '.png')).convert('L')) > 0 for v in VIEWS}

def colv(view, M, u):                                             # the mask's column at u: (top v, bottom v) or None
    c = int(round((u - GRID[view][0]) / RES))
    if c < 0 or c >= M.shape[1]: return None
    r = np.nonzero(M[:, c])[0]
    if not len(r): return None
    v1 = GRID[view][3]
    return v1 - r.min() * RES, v1 - r.max() * RES

def runs_v(view, M, u):                                           # every solid run down a column, as (top, bottom)
    c = int(round((u - GRID[view][0]) / RES)); col = M[:, c]; out = []; v1 = GRID[view][3]; r = 0
    while r < len(col):
        if col[r]:
            r0 = r
            while r < len(col) and col[r]: r += 1
            out.append((v1 - r0 * RES, v1 - (r - 1) * RES))
        else: r += 1
    return out

def extent(view, M):
    rr, cc = np.nonzero(M); u0, u1, v0, v1 = GRID[view]
    return u0 + cc.min() * RES, u0 + cc.max() * RES, v1 - rr.max() * RES, v1 - rr.min() * RES

def f(x): return '   -  ' if x is None else '%6.2f' % x
def dd(a, b): return '   -  ' if a is None or b is None else '%+6.2f' % (b - a)

def match(prefix):
    R, O = load_ref(), ours_masks(prefix)
    iou = {v: (R[v] & O[v]).sum() / max(1, (R[v] | O[v]).sum()) for v in VIEWS}
    print('IoU  side %.3f  plan %.3f  front %.3f   (1 = the same silhouette)' % (iou['side'], iou['plan'], iou['front']))
    eR, eO = extent('side', R['side']), extent('side', O['side'])
    pR, pO = extent('plan', R['plan']), extent('plan', O['plan'])
    print('%-34s %7s %7s %7s' % ('', 'drawing', 'ours', 'diff'))
    def row(name, a, b): print('%-34s %7s %7s %7s' % (name, f(a), f(b), dd(a, b)))
    row('length (nose to the last point)', eR[1], eO[1])
    row('top above the datum', eR[3], eO[3]); row('bottom below the datum', eR[2], eO[2])
    row('span', pR[1] - pR[0], pO[1] - pO[0])
    # the wing at the root (plan, 0.6 m out: clear of the body) and the tail
    def chord_at(M, s, lo=0.5, hi=3.5):                           # the LE / TE (aft of the nose) of the run in [lo, hi]
        for (top, bot) in runs_v('plan', M, s):                   # plan v = aft: a run reads (aft end, fore end)
            if bot <= hi and top >= lo: return bot, top
        return None
    for s in BP.get('wingStations', [0.6]):
        cr, co = chord_at(R['plan'], s), chord_at(O['plan'], s)
        row('wing LE at %.1f m out' % s, cr and cr[0], co and co[0]); row('wing TE at %.1f m out' % s, cr and cr[1], co and co[1])
    fR, fO = extent('front', R['front']), extent('front', O['front'])
    row('span (front view)', fR[1] - fR[0], fO[1] - fO[0]); row('front: top', fR[3], fO[3]); row('front: bottom', fR[2], fO[2])
    print('\nTHE SIDE PROFILE (metres; top / bottom of the silhouette, the datum the rod top at %.1f m)' % BP['datumAt'])
    print('%6s | %6s %6s | %6s %6s | %6s %6s' % ('aft', 'd.top', 'd.bot', 'o.top', 'o.bot', 'dtop', 'dbot'))
    for s in np.arange(0.0, 6.01, 0.25):
        a, b = colv('side', R['side'], s), colv('side', O['side'], s)
        print('%6.2f | %s %s | %s %s | %s %s' % (s, f(a and a[0]), f(a and a[1]), f(b and b[0]), f(b and b[1]),
              dd(a and a[0], b and b[0]), dd(a and a[1], b and b[1])))
    print('\nTHE PLAN: the wing across the span (LE / TE metres aft of the nose, chord)')
    print('%6s | %6s %6s %6s | %6s %6s %6s | %6s %6s' % ('span', 'd.LE', 'd.TE', 'd.c', 'o.LE', 'o.TE', 'o.c', 'dLE', 'dTE'))
    for s in np.arange(0.5, 7.01, 0.5):
        cr, co = chord_at(R['plan'], s), chord_at(O['plan'], s)
        print('%6.2f | %s %s %s | %s %s %s | %s %s' % (s, f(cr and cr[0]), f(cr and cr[1]), f(cr and cr[1] - cr[0]),
              f(co and co[0]), f(co and co[1]), f(co and co[1] - co[0]), dd(cr and cr[0], co and co[0]), dd(cr and cr[1], co and co[1])))
    print('\nTHE PLAN: the tailplane (LE / TE aft of the nose) across its span')
    for s in np.arange(0.2, 1.61, 0.2):
        cr, co = chord_at(R['plan'], s, 4.0, 7.0), chord_at(O['plan'], s, 4.0, 7.0)
        print('%6.2f | %s %s %s | %s %s %s' % (s, f(cr and cr[0]), f(cr and cr[1]), f(cr and cr[1] - cr[0]),
              f(co and co[0]), f(co and co[1]), f(co and co[1] - co[0])))
    print('\nTHE PLAN: the body\'s half-width (aft of the nose; read on the centreline\'s run)')
    def halfw(M, s):
        r = int(round((GRID['plan'][3] - (-s)) / RES)) if False else int(round((GRID['plan'][3] - s) / RES))
        # plan v = aft; rows run v1 -> v0, so the row for v = s
        row_ = M[int(round((GRID['plan'][3] - s) / RES))] if 0 <= int(round((GRID['plan'][3] - s) / RES)) < M.shape[0] else None
        if row_ is None: return None
        c0 = int(round((0 - GRID['plan'][0]) / RES))
        if not row_[c0]: return None
        a = c0
        while a < len(row_) - 1 and row_[a + 1]: a += 1
        b = c0
        while b > 0 and row_[b - 1]: b -= 1
        return (a - b) * RES / 2
    for s in np.arange(0.1, 6.0, 0.3):
        print('%6.2f | drawing %s  ours %s  %s' % (s, f(halfw(R['plan'], s)), f(halfw(O['plan'], s)), dd(halfw(R['plan'], s), halfw(O['plan'], s))))
    print('\nTHE FRONT: the wing\'s upper / lower edge across the span (metres above the datum; the dihedral)')
    def wingRun(M, s):
        rs = [r for r in runs_v('front', M, s) if -0.6 < r[0] < 0.9 and r[0] - r[1] < 0.4]
        return rs[0] if rs else None
    for s in (1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 6.4):
        a, b = wingRun(R['front'], s), wingRun(O['front'], s)
        print('%6.2f | drawing %s %s  ours %s %s  | %s %s' % (s, f(a and a[0]), f(a and a[1]), f(b and b[0]), f(b and b[1]),
              dd(a and a[0], b and b[0]), dd(a and a[1], b and b[1])))
    print('\nTHE FRONT: the width of the silhouette at heights (the pod under the wing; metres above the datum)')
    def widthAt(M, h):
        rr = int(round((GRID['front'][3] - h) / RES)); row_ = M[rr]; c0 = int(round((0 - GRID['front'][0]) / RES))
        if not row_[c0]: return None
        a = c0
        while a < len(row_) - 1 and row_[a + 1]: a += 1
        b = c0
        while b > 0 and row_[b - 1]: b -= 1
        return (a - b) * RES
    for h in np.arange(0.4, -1.61, -0.1):
        print('%6.2f | drawing %s  ours %s  %s' % (h, f(widthAt(R['front'], h)), f(widthAt(O['front'], h)), dd(widthAt(R['front'], h), widthAt(O['front'], h))))
    if opt('--png'):
        for v in VIEWS:
            rgb = np.full(R[v].shape + (3,), 255, np.uint8)
            rgb[R[v] & O[v]] = (150, 150, 150); rgb[R[v] & ~O[v]] = (40, 170, 70); rgb[O[v] & ~R[v]] = (215, 60, 50)
            im = Image.fromarray(rgb)
            # crop to the union, a margin round it
            rr, cc = np.nonzero(R[v] | O[v]); m = 20
            im = im.crop((max(0, cc.min() - m), max(0, rr.min() - m), min(im.width, cc.max() + m), min(im.height, rr.max() + m)))
            im.save(opt('--png') + '_' + v + '.png')
        print('\noverlays ->', opt('--png') + '_{side,plan,front}.png  (grey both, green the drawing only, red ours only)')
    if opt('--on-image'):
        draw_on_image(opt('--on-image'), O, opt('--png', prefix))
    return iou

def tail_json(prefix, outj):
    """the drawing's fin (side view) and stab (plan, one half) as triangles in OUR frame (x span, y up, z fore), the
    shape fit_tail.js takes from refmatch.py --tail: each silhouette row-run a rectangle. `tail` in the config bounds them:
    finAft / finAbove (metres aft of the nose, above the datum), stabAft (fore, aft) and stabFrom (out from the centre)"""
    R = load_ref(); zN, y0 = datums(load_ours(prefix)); tc = BP['tail']
    def rects(view, M, keep, fn):
        u0, u1, v0, v1 = GRID[view]; out = []
        for r in range(M.shape[0]):
            row_ = M[r]; c = 0
            while c < len(row_):
                if row_[c]:
                    c0 = c
                    while c < len(row_) and row_[c]: c += 1
                    ua, ub, v = u0 + c0 * RES, u0 + c * RES, v1 - r * RES
                    if keep(ua, ub, v):
                        out += fn(ua, ub, v - RES, v)
                else: c += 1
        return out
    fa, fh = tc['finAft'], tc['finAbove']
    def finRect(ua, ub, va, vb):                                  # side: u aft, v up
        ua = max(ua, fa); P = lambda u, v: [0.0, y0 + v, zN - u]
        return [[P(ua, va), P(ub, va), P(ub, vb)], [P(ua, va), P(ub, vb), P(ua, vb)]]
    fin = rects('side', R['side'], lambda ua, ub, v: ub > fa and v > fh, finRect)
    sa, sb = tc['stabAft']; s0 = tc['stabFrom']
    M = R['plan'].copy(); u0 = GRID['plan'][0]
    M[:, :int(round((s0 - u0) / RES))] = False                    # the starboard-as-drawn half, clear of the rod
    def stabRect(ua, ub, va, vb):                                 # plan: u span, v aft
        P = lambda u, v: [u, 0.0, zN - v]
        return [[P(ua, va), P(ub, va), P(ub, vb)], [P(ua, va), P(ub, vb), P(ua, vb)]]
    stab = rects('plan', M, lambda ua, ub, v: sa <= v <= sb, stabRect)
    json.dump({'fin': fin, 'stab': stab}, open(outj, 'w'))
    print('tail outlines in our frame ->', outj, '(fin %d, stab %d triangles; our nose z %.3f, datum y %.3f)' % (len(fin), len(stab), zN, y0))

def draw_on_image(image, O, outp):
    """our silhouettes' edges, in red, over the drawing in its own pixels (each view through the traced datums)"""
    tj = json.load(open(os.path.join(OUTDIR, 'trace.json')))['datums_px']
    img = Image.open(image).convert('RGB'); px = img.load()
    fwd = BP['views']['side'].get('fore', 'left'); sgn = 1 if fwd == 'left' else -1
    pf = BP['views']['plan'].get('fore', 'down'); ps = -1 if pf == 'down' else 1
    def edges(M):
        e = M & ~np.asarray(Image.fromarray((M * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)), bool)
        rr, cc = np.nonzero(e); return rr, cc
    for v in VIEWS:
        rr, cc = edges(O[v]); u0, u1, v0, v1 = GRID[v]
        u = u0 + cc * RES; w = v1 - rr * RES
        if v == 'side':
            X = tj['side']['noseX'] + sgn * u / K; Y = tj['side']['datumY'] - w / K
        elif v == 'plan':
            X = tj['plan']['cx'] + u / K; Y = tj['plan']['noseY'] + ps * w / K
        else:
            X = tj['front']['cx'] + u / K; Y = tj['front']['wingTopY'] - (w - tj['front']['wingTopH']) / K
        for x, y in zip(np.round(X).astype(int), np.round(Y).astype(int)):
            if 0 <= x < img.width and 0 <= y < img.height: px[x, y] = (220, 30, 30)
    img.save(outp + '_on_drawing.png')
    print('our outline over the drawing ->', outp + '_on_drawing.png')

if __name__ == '__main__':
    if len(args) < 3 or args[0] not in ('trace', 'match', 'tail'):
        print(open(__file__).read().split('import sys')[0]); sys.exit(1)
    setup(args[1])
    if args[0] == 'trace': trace(args[2])
    elif args[0] == 'tail': tail_json(args[2], args[3])
    else: match(args[2])
