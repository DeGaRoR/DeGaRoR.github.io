import json, math, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
D = '/tmp/claude-0/-workspace-DeGaRoR-github-io/87d1e332-cdaa-5b4d-9fd2-f5d4f14e6cc0/scratchpad/rough/'
M = json.load(open(D + 'meta.json'))
A, lam = M['A'], M['lam']; k1 = 2*math.pi/lam; k2 = 2*math.pi/(0.43*lam)
H = lambda x, z: A*math.sin(k1*x+0.7)*math.cos(0.8*k1*z) + 0.5*A*math.sin(k2*(0.6*x+0.8*z))
PPM = 70                                     # pixels per metre in the panels
PW, PH = int(9.5*PPM), int(3.2*PPM)
def font(sz):
    for f in ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans.ttf']:
        try: return ImageFont.truetype(f, sz)
        except Exception: pass
    return ImageFont.load_default()
F1, F2 = font(15), font(12)
panels = []
for m in M['meta']:
    im = Image.open(D + 'f%d_side.png' % m['i']).convert('RGBA'); a = np.array(im).astype(int)
    bg = a[2, 2, :3]
    diff = np.abs(a[:, :, :3] - bg).sum(2); a[:, :, 3] = np.where(diff < 10, 0, 255)
    u0, u1, v0, v1 = m['frame']; sc = im.width / (u1 - u0)          # source px per metre
    # the main tyre: the black pixels in the lower half, left 60 %; its lowest point and its column
    blk = (a[:, :, :3].sum(2) < 30) & (a[:, :, 3] > 0); blk[:im.height//2, :] = False; blk[:, int(im.width*0.6):] = False
    ys, xs = np.nonzero(blk); yb = ys.max(); xb = int(np.median(xs[ys > yb - 4]))
    src = Image.fromarray(a.astype(np.uint8), 'RGBA').resize((int(im.width*PPM/sc), int(im.height*PPM/sc)), Image.LANCZOS)
    xb, yb = xb*PPM/sc, yb*PPM/sc
    # rotate about the tyre's contact point by the pitch (nose left: nose-up is clockwise on screen)
    deg = math.degrees(m['pitch']) - 8.4                              # less the parked three-point attitude the image is drawn level at? (the drawing is level: the full pitch)
    deg = math.degrees(m['pitch'])
    pad = max(src.size); big = Image.new('RGBA', (src.width + 2*pad, src.height + 2*pad), (0,0,0,0)); big.paste(src, (pad, pad), src)
    cx, cy = xb + pad, yb + pad
    rot = big.rotate(-deg, resample=Image.BICUBIC, center=(cx, cy))
    # the panel: sky, the field's profile under the near wheel's track, the aeroplane's contact on its axle's ground point
    P = Image.new('RGB', (PW, PH), (196, 214, 230)); d = ImageDraw.Draw(P)
    for yy in range(PH):
        t = yy/PH; d.line([(0, yy), (PW, yy)], fill=(int(150+70*t), int(178+56*t), int(214+30*t)))
    ax, ay, az = m['axL']; R = 0.25
    gnd = H(ax, az); wheelBottom = ay - R                           # the tyre's bottom over the ground (may be in the air)
    yGpx = int(PH*0.80)                                             # the ground under the axle drawn here
    xA = int(PW*0.30)
    # world x -> panel px: the nose points to world +x and to screen LEFT
    X = lambda x: xA - (x - ax)*PPM
    Y = lambda y: yGpx - (y - gnd)*PPM
    pts = [(X(x), Y(H(x, az))) for x in np.linspace(ax + 4.5, ax - 9.0, 400)]
    d.polygon(pts + [(PW, PH), (0, PH)], fill=(92, 112, 58))
    d.line(pts, fill=(64, 82, 40), width=3)
    rng = np.random.default_rng(m['i'])
    for _ in range(260):
        x = rng.uniform(ax - 9.0, ax + 4.5); y0 = H(x, az); px, py = X(x), Y(y0); h = rng.uniform(3, 9)
        d.line([(px, py), (px + rng.uniform(-2, 2), py - h)], fill=(78 + int(rng.uniform(0, 30)), 104 + int(rng.uniform(0, 30)), 46), width=1)
    ox, oy = X(ax) - cx, Y(wheelBottom) - cy
    P.paste(rot, (int(round(ox)), int(round(oy))), rot)
    _q = np.array(P).astype(int); _b = (_q.sum(2) < 30); _b[:, :max(0, int(X(ax)) - 30)] = False; _b[:, int(X(ax)) + 30:] = False
    print("panel", m["i"], "Y(wb)", round(Y(wheelBottom), 1), "cy", round(cy), "lowest black", np.nonzero(_b)[0].max() if _b.any() else None, "gnd", round(gnd, 3), "ay", round(ay, 3))
    d.rectangle([0, 0, PW-1, PH-1], outline=(40, 44, 52), width=2)
    d.text((10, 8), 't = %.2f s' % m['t'], fill=(20, 24, 30), font=F1)
    d.text((10, 28), 'strut %3.0f mm of %3.0f   (preview %.2f)' % (m['s']*1000, M['S']*1000, m['pos']), fill=(20, 24, 30), font=F2)
    panels.append(P)
# the stroke trace
TW, TH = PW*len(panels) if len(panels) <= 3 else PW*3, 210
cols = 3 if len(panels) > 3 else len(panels); rows = math.ceil(len(panels)/cols)
W = PW*cols; out = Image.new('RGB', (W, PH*rows + TH + 46), (240, 242, 245)); d = ImageDraw.Draw(out)
d.text((12, 12), 'Trailing-link oleo (Wilga type) landing on a rough strip: 1.5 m/s down at 0.8 Vs onto 5 cm bumps every 3 m (the host: 1.0 t, high wing, 2.83 m track, 500 mm tyres)', fill=(20, 24, 30), font=F1)
for k, P in enumerate(panels): out.paste(P, ((k % cols)*PW, 40 + (k//cols)*PH))
# empty cells (when the grid is not full): the trace legend goes there
y0 = 40 + rows*PH + 6; x0, x1 = 60, W - 20; tmax = M['trace'][-1][0]
d.rectangle([x0, y0, x1, y0 + TH - 30], outline=(120, 124, 130))
S = M['S']
ty = lambda s: y0 + (TH - 30) - s/S*(TH - 40)
d.line([(x0, ty(S)), (x1, ty(S))], fill=(200, 60, 50), width=1); d.text((x1 - 170, ty(S) - 16), 'full stroke %.0f mm' % (S*1000), fill=(200, 60, 50), font=F2)
for side, col in [(1, (30, 90, 200)), (2, (230, 140, 30))]:
    pts = [(x0 + r[0]/tmax*(x1 - x0), ty(max(0, r[side]))) for r in M['trace']]; d.line(pts, fill=col, width=2)
for m in M['meta']:
    x = x0 + m['t']/tmax*(x1 - x0); d.line([(x, y0), (x, y0 + TH - 30)], fill=(150, 150, 150)); d.text((x + 3, y0 + 2), '%.2f' % m['t'], fill=(90, 90, 90), font=F2)
d.text((8, y0 + 4), 'strut', fill=(20, 24, 30), font=F2); d.text((x0, y0 + TH - 26), 'left strut (blue), right strut (orange) against time, 0 - %.0f s; the vertical lines are the panels above' % tmax, fill=(40, 44, 52), font=F2)
out.save(sys.argv[1]); print(out.size)
