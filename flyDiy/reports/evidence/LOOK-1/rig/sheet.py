# before | after sheets + the crown numbers (linear luma over the crown pixels: mean, speck index p99/p50)
import sys, json, numpy as np
from PIL import Image, ImageDraw
S = sys.argv[1]; E = sys.argv[2]
def lin(c): c = c / 255; return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def crown(f, box):
    a = np.asarray(Image.open(f).convert('RGB')).astype(float)[box[1]:box[3], box[0]:box[2]]
    sky = (a[..., 2] > a[..., 1] * 1.12) & (a[..., 2] > 50)   # the sky's blue, by eye on the base frames
    y = lin(a) @ [0.2126, 0.7152, 0.0722]; y = y[~sky]
    return y.mean(), np.percentile(y, 99) / max(np.percentile(y, 50), 1e-5)
out = {}
BOX = {'near': (380, 100, 780, 500), 'forest': (0, 260, 1280, 720)}
for v in ('near', 'forest'):
    for l in ('night', 'blue', 'golden', 'noon'):
        b, a = f'{S}/run4/{v}_{l}.jpg', f'{S}/run3/{v}_{l}.jpg'
        try: B, A = Image.open(b), Image.open(a)
        except Exception as e: print('skip', v, l, e); continue
        mb, sb = crown(b, BOX[v]); ma, sa = crown(a, BOX[v])
        out[f'{v}_{l}'] = dict(before_mean=round(mb, 4), after_mean=round(ma, 4), ratio=round(ma / mb, 3), speck_before=round(sb, 2), speck_after=round(sa, 2))
        bx = BOX[v]; cb, ca = B.crop(bx), A.crop(bx)
        if v == 'forest': cb, ca = cb.resize((640, 230)), ca.resize((640, 230))
        W, H = cb.size; s = Image.new('RGB', (W * 2 + 8, H + 22), (24, 24, 24)); s.paste(cb, (0, 22)); s.paste(ca, (W + 8, 22))
        d = ImageDraw.Draw(s); d.text((6, 5), f'BEFORE master  mean {mb:.3f} speck {sb:.1f}', fill=(230, 230, 230)); d.text((W + 14, 5), f'AFTER l1mip + light x0.69  mean {ma:.3f} speck {sa:.1f}', fill=(230, 230, 230))
        s.save(f'{E}/sheet_{v}_{l}.jpg', quality=85)
        B.convert('RGB').save(f'{E}/{v}_{l}_before.jpg', quality=85); A.convert('RGB').save(f'{E}/{v}_{l}_after.jpg', quality=85)
json.dump(out, open(f'{E}/crowns.json', 'w'), indent=1); print(json.dumps(out, indent=1))
