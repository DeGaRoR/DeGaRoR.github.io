# ovls_threeview.py <tag> <our_side.png> <our_top.png> <our_front.png> <frame_side_m> <frame_top_m> <frame_front_m>
#                   <ref_side.png> <ref_top.png> <ref_front.png> <dim_side_m> <dim_top_m> <dim_front_m> <out_dir>
# THE OUTLINE EXERCISE ON A 3-VIEW (the Petrel, 10 Nov): our quickshot renders (side / top / front, --noedges) projected
# onto three reference drawings (transparent PNGs, one view each). Each drawing is scaled from its OWN extent along x to
# a published dimension (length for the side, span for the top and front), ours from its drawn extent over the frame
# quickshot prints. Anchors: side - bow and the wheels' bottom (ours flipped: the drawing's bow on the right); top -
# nose and centreline (ours turned nose-up); front - centreline and wheels. Prints both extents; writes
# <out_dir>/petrel_<tag>_on_LS.png. Our parts the drawing does not have read as red veil outside its lines.
import sys, numpy as np
from PIL import Image, ImageFilter, ImageDraw
tag = sys.argv[1]; ours = dict(side=sys.argv[2], top=sys.argv[3], front=sys.argv[4])
REFS = dict(side=sys.argv[8], top=sys.argv[9], front=sys.argv[10]); DIMS = dict(side=float(sys.argv[11]), top=float(sys.argv[12]), front=float(sys.argv[13])); OUT = sys.argv[14]
K = 3
V = {  # drawing file, its LS dimension along x (m), our frame extent along the render's x (m), transform, anchor rule
 'side':  dict(n=3, dim=6.35, our_m=None, tf='flip',  rule='right_bottom'),
 'top':   dict(n=4, dim=8.90, our_m=None, tf='rotcw', rule='centre_top'),
 'front': dict(n=5, dim=8.90, our_m=None, tf=None,    rule='centre_bottom'),
}
FR = dict(side=float(sys.argv[5]), top=float(sys.argv[6]), front=float(sys.argv[7]))   # our frame extent along the render's x, metres
def ours_mask(im):
    a = np.asarray(im.convert('RGB')).astype(int); return np.abs(a - a[2, 2]).sum(2) > 6
panels = []; report = []
for name, v in V.items():
    d = Image.open(REFS[name]).convert('RGBA'); v['dim'] = DIMS[name]; d = d.resize((d.width * K, d.height * K), Image.LANCZOS)
    a = np.asarray(d).astype(int); ink = a[:, :, 3] > 40; ys, xs = np.nonzero(ink)
    ppm = (xs.max() - xs.min()) / v['dim']                         # the drawing's px per metre, from its own extent
    base = Image.new('RGB', d.size, (255, 255, 255)); base.paste(d, (0, 0), d)
    im = Image.open(ours[name]).convert('RGB'); m0 = ours_mask(im); x0s = np.nonzero(m0)[1]
    ppm_o = (x0s.max() - x0s.min()) / FR[name]
    if v['tf'] == 'flip': im = im.transpose(Image.FLIP_LEFT_RIGHT)
    if v['tf'] == 'rotcw': im = im.rotate(-90, expand=True)
    k = ppm / ppm_o; im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    m = ours_mask(im); oy, ox = np.nonzero(m)
    if v['rule'] == 'right_bottom': ax, ay, rx, ry = ox.max(), oy.max(), xs.max(), ys.max()
    elif v['rule'] == 'centre_top': ax, ay, rx, ry = (ox.min() + ox.max()) / 2, oy.min(), (xs.min() + xs.max()) / 2, ys.min()
    else: ax, ay, rx, ry = (ox.min() + ox.max()) / 2, oy.max(), (xs.min() + xs.max()) / 2, ys.max()
    dx, dy = int(round(rx - ax)), int(round(ry - ay))
    pad = 60; W, H = base.width + 2 * pad, base.height + 2 * pad
    can = Image.new('RGB', (W, H), (255, 255, 255)); can.paste(base, (pad, pad))
    full = Image.new('L', (W, H), 0); full.paste(Image.fromarray((m * 255).astype(np.uint8)), (dx + pad, dy + pad))
    fa = np.asarray(full) > 0; edge = fa & ~(np.asarray(full.filter(ImageFilter.MinFilter(3))) > 0)
    c = np.asarray(can).astype(float); c[fa] = c[fa] * 0.78 + np.array([255, 110, 110]) * 0.22; c[edge] = [215, 30, 30]
    p = Image.fromarray(c.astype(np.uint8)); D = ImageDraw.Draw(p)
    D.text((6, 6), '%s - drawing scaled to %.2f m (LS); ours red' % (name.upper(), v['dim']), fill=(0, 0, 0))
    panels.append(p)
    report.append('%s: drawing %.2f x %.2f m | ours %.2f x %.2f m' % (name, (xs.max() - xs.min()) / ppm, (ys.max() - ys.min()) / ppm, (ox.max() - ox.min()) / ppm, (oy.max() - oy.min()) / ppm))
W = max(p.width for p in panels); H = sum(p.height for p in panels)
S = Image.new('RGB', (W, H), (255, 255, 255)); y = 0
for p in panels: S.paste(p, (0, y)); y += p.height
S.save(OUT + '/petrel_%s_on_LS.png' % tag); print('\n'.join(report)); print('saved', S.size)
