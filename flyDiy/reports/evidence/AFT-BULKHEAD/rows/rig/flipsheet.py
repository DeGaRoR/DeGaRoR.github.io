# AFT-BULKHEAD-SHOTS check 1: fresh BEFORE | FULL flipped to the default rows in the page | the pixels that differ (> 8)
# usage: python3 -I flipsheet.py <out dir> <build> <SET> <details dir>
import sys, os
import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFont
o, b, s, dd = sys.argv[1:5]
A = Image.open(os.path.join(o, 'day', b + '_BEFORE_bk-infwd.png')).convert('RGB'); B = Image.open(os.path.join(o, 'flip', b + '_' + s + '_bk-infwd.png')).convert('RGB')
d = (np.asarray(ImageChops.difference(A, B)).max(axis=2) > 8)
D = Image.fromarray((d * 255).astype(np.uint8)).convert('RGB')
W, H = A.size; c = Image.new('RGB', (3 * W + 16, H), (24, 24, 24))
F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 26)
for k, (im, t) in enumerate(((A, 'fresh BEFORE'), (B, s + ' -> default rows (page)'), (D, 'differ > 8: %d px' % d.sum()))):
    x = k * (W + 8); c.paste(im, (x, 0)); g = ImageDraw.Draw(c); tw = g.textlength(t, font=F); g.rectangle([x + 12, 12, x + 28 + tw, 52], fill=(0, 0, 0)); g.text((x + 20, 16), t, fill=(255, 255, 255), font=F)
c.save(os.path.join(dd, 'check1_%s_%s_flip_inFwd.jpg' % (b, s)), quality=85); print(d.sum())
