#!/usr/bin/env python3
# blueprint_overlay.py - THE BUILD OVER THE USER'S DRAWING (CAR-3, 12 Nov; the user: "redo an outline projection on the
# blueprint ... I really want to see the original picture and ... a semi-transparent render of the other thing. You may
# use a quick shot"). A TOOL, not a gate.
#
# The side view from tools/quickshot.js (an orthographic picture in a known metre frame - quickshot prints it:
# "frame side: [u0,u1,w0,w1]") is laid semi-transparent over the drawing scaled to the same metres per pixel. The two
# are registered on one point: the build's rear-most and lowest drawn pixels (its tail and the ground under its tyres)
# on the drawing's own tail x and ground y. A 0.5 m grid is drawn over both.
#
#   node tools/quickshot.js build.json /tmp/x --views side --w 1200 --flat      (prints: frame side: [u0,u1,w0,w1])
#   python3 tools/blueprint_overlay.py --render /tmp/x_side.png --frame u0,u1,w0,w1 --bp drawing.gif \
#       --bp-crop x0,y0,x1,y1 --bp-mpp 0.01151 --bp-ref 458,406 [--alpha 0.55] [--flip] --out overlay.png
#
#   --bp-crop  the drawing's side view, pixels (x0,y0,x1,y1) - the other views on the sheet left out
#   --bp-mpp   the drawing's metres per pixel (a known length over its pixels, e.g. the wheelbase)
#   --bp-ref   the drawing's tail x and ground y, pixels (uncropped sheet)
#   --flip     mirror the drawing (when its nose points the other way from the render's)
import argparse
from PIL import Image, ImageDraw

ap = argparse.ArgumentParser()
ap.add_argument('--render', required=True)
ap.add_argument('--frame', required=True)
ap.add_argument('--bp', required=True)
ap.add_argument('--bp-crop', required=True)
ap.add_argument('--bp-mpp', type=float, required=True)
ap.add_argument('--bp-ref', required=True)
ap.add_argument('--alpha', type=float, default=0.55)
ap.add_argument('--flip', action='store_true')
ap.add_argument('--out', required=True)
a = ap.parse_args()

R = Image.open(a.render).convert('RGBA')
u0, u1, w0, w1 = [float(v) for v in a.frame.split(',')]
mpp = (u1 - u0) / R.width                      # the render's metres per pixel

# the build's drawn pixels: anything off the background (the corner's colour)
bg = R.getpixel((0, 0))
px = R.load()
xs, ys = [], []
for y in range(R.height):
    for x in range(R.width):
        p = px[x, y]
        if abs(p[0] - bg[0]) + abs(p[1] - bg[1]) + abs(p[2] - bg[2]) > 24:
            xs.append(x); ys.append(y)
        else:
            px[x, y] = (0, 0, 0, 0)
tailX, groundY = max(xs), max(ys)              # the rear-most and lowest drawn pixels (the nose points left)

# the drawing, cropped and scaled to the render's metres per pixel
B = Image.open(a.bp).convert('RGBA')
cx0, cy0, cx1, cy1 = [int(v) for v in a.bp_crop.split(',')]
rx, ry = [float(v) for v in a.bp_ref.split(',')]
B = B.crop((cx0, cy0, cx1, cy1))
rx -= cx0; ry -= cy0
if a.flip:
    B = B.transpose(Image.FLIP_LEFT_RIGHT); rx = B.width - rx
k = a.bp_mpp / mpp
B = B.resize((max(1, round(B.width * k)), max(1, round(B.height * k))), Image.LANCZOS)
rx *= k; ry *= k

# one canvas holding both, registered on (tail, ground)
ox, oy = round(tailX - rx), round(groundY - ry)  # the drawing's offset in render pixels
L = min(0, ox); T = min(0, oy)
W = max(R.width, ox + B.width) - L; H = max(R.height, oy + B.height) - T
C = Image.new('RGBA', (W, H), (255, 255, 255, 255))
C.alpha_composite(B, (ox - L, oy - T))
Rf = R.copy(); Rf.putalpha(Rf.getchannel('A').point(lambda v: int(v * a.alpha)))
C.alpha_composite(Rf, (-L, -T))
d = ImageDraw.Draw(C)
step = round(0.5 / mpp)
gx0, gy0 = tailX - L, groundY - T              # the grid's origin: the tail at the ground
for i in range(-40, 41):
    x = gx0 - i * step
    if 0 <= x < W: d.line([(x, 0), (x, H)], fill=(0, 140, 200, 70) if i % 2 else (0, 140, 200, 140))
    y = gy0 - i * step
    if 0 <= y < H: d.line([(0, y), (W, y)], fill=(0, 140, 200, 70) if i % 2 else (0, 140, 200, 140))
d.text((6, 6), 'render (semi-transparent) over the drawing, registered on the tail and the ground; grid 0.5 m',
       fill=(20, 20, 20, 255))
C.convert('RGB').save(a.out)
print('overlay %s: render %.4f m/px, drawing scaled x%.3f, length %.2f m (render) - %dx%d' %
      (a.out, mpp, k, (tailX - min(xs)) * mpp, W, H))
