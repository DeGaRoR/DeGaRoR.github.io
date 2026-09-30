#!/usr/bin/env python3
# rollreal_pick.py - the evidence frames out of a rollreal_shots.js screencast (G1115, ROLLOUT-REAL): the frames nearest the
# asked times (ms since the Roll-out click), resized to 1280 px wide, JPEG q82, into the committed evidence folder.
#   py -3.11 tools/rollreal_pick.py <raw dir> <out dir> <prefix> <ms,ms,...>
#   -> <out>/<prefix>_<nn>_<ms>ms.jpg, and a line per frame (its size); the whole folder's size at the end
import json, os, sys
from PIL import Image
raw, out, prefix, times = sys.argv[1], sys.argv[2], sys.argv[3], [int(t) for t in sys.argv[4].split(',')]
idx = json.load(open(os.path.join(raw, 'index.json'), encoding='utf-8'))
frames = [f for f in idx['frames'] if f[1] >= 0]
os.makedirs(out, exist_ok=True)
for k, t in enumerate(times):
    f, ms = min(frames, key=lambda x: abs(x[1] - t))
    im = Image.open(os.path.join(raw, f)).convert('RGB')
    if im.width != 1280:
        im = im.resize((1280, round(im.height * 1280 / im.width)), Image.LANCZOS)
    name = '%s_%02d_%05dms.jpg' % (prefix, k, ms)
    im.save(os.path.join(out, name), 'JPEG', quality=82, optimize=True)
    print('%s  %d KB' % (name, os.path.getsize(os.path.join(out, name)) // 1024))
tot = sum(os.path.getsize(os.path.join(out, n)) for n in os.listdir(out))
print('folder %.2f MB' % (tot / 1e6))
