# LOOK-1-STUDY pass 3: the temporal-instability numbers off stage_flicker.js's PNGs.
#   python3 -I flicker.py <runF dir> <evidence dir>
# Per view x dial: the N sub-pixel offsets' per-pixel standard deviation in display code (0-255, luma); the noise floor
# (|repeat - offset 0|); "flicker" = the share of pixels whose spread exceeds 4 codes (a visible crawl) over the frame,
# over the sky band (clouds) and over the rest (trees, ground). Sheets: one frame | the offsets' mean (what a temporal
# accumulation converges to) | the flicker map (spread x 8, hot = crawls in motion).
import sys, os, json, numpy as np
from PIL import Image, ImageDraw
R, E = sys.argv[1], sys.argv[2]
meta = json.load(open(os.path.join(R, 'meta.json')))
Y = np.array([0.2126, 0.7152, 0.0722])
out = {}
for m in meta:
    v, N = m['view'], m['N']
    tags = sorted({f.split('_', 1)[1].rsplit('_', 1)[0] for f in os.listdir(R) if f.startswith(v + '_') and f.endswith('.png')})
    rows = []
    for t in tags:
        fr = [np.asarray(Image.open(os.path.join(R, f'{v}_{t}_{k}.png')).convert('RGB')).astype(float) for k in range(N + 1)]
        L = [f @ Y for f in fr]
        st = np.std(np.stack(L[:N]), 0); nf = np.abs(L[N] - L[0])
        H = st.shape[0]; sky = slice(0, int(H * 0.45)); low = slice(int(H * 0.45), H)
        def share(a, s=slice(None)): return round(float((a[s] > 4).mean()) * 100, 2)
        r = dict(flicker_all=share(st), flicker_sky=share(st, sky), flicker_low=share(st, low), spread_p99=round(float(np.percentile(st, 99)), 1),
                 noise_floor=share(nf), mean_spread=round(float(st.mean()), 2))
        out[f'{v}_{t}'] = r; rows.append((t, r))
        one = Image.fromarray(fr[0].astype(np.uint8)); mean = Image.fromarray(np.mean(np.stack(fr[:N]), 0).astype(np.uint8))
        hm = np.clip(st * 8, 0, 255); heat = Image.fromarray(np.stack([hm, hm * 0.6, hm * 0.15], -1).astype(np.uint8))
        W, Hh = 640, 360; s = Image.new('RGB', (3 * W + 16, Hh + 22), (20, 20, 20)); d = ImageDraw.Draw(s)
        for i, (im, lab) in enumerate([(one, f'{v} / {t}: one frame'), (mean, f'the mean of {N} sub-pixel offsets (what TAA converges to)'),
                                       (heat, f'flicker map: {r["flicker_all"]} % of pixels crawl (sky {r["flicker_sky"]} / below {r["flicker_low"]})')]):
            s.paste(im.resize((W, Hh)), (i * (W + 8), 22)); d.text((i * (W + 8) + 6, 5), lab, fill=(235, 235, 235))
        s.save(os.path.join(E, f'flicker_{v}_{t}.jpg'), quality=85)
    print(v); [print('  ', t.ljust(9), r) for t, r in rows]
json.dump(out, open(os.path.join(E, 'flicker.json'), 'w'), indent=1)
