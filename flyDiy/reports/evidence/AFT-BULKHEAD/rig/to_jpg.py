# AFT-BULKHEAD-LOOK: the rig's PNGs -> stills/<build>_<set>_<view>.jpg (q85). usage: python3 -I to_jpg.py <out dir> <stills dir>
import sys, os, re
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
VIEW = {'bk-out-0-0-3': 'sideAft', 'bk-out-30-0-3': 'q34Aft', 'bk-out--30-0-3': 'q34Fwd', 'bk-infwd': 'inFwd', 'bk-inclose-0.6': 'inClose',
        'bk-out-0-0-3-0.42': 'sideAftMid', 'bk-out--30-0-3-0.42': 'q34FwdMid', 'bk-infwd--0.215-0-0.4': 'inFwdFwd'}
os.makedirs(dst, exist_ok=True)
for st in sorted(os.listdir(src)):
    d = os.path.join(src, st)
    if not os.path.isdir(d): continue
    for f in sorted(os.listdir(d)):
        m = re.match(r'^(\w+?)_(bk-.+?)(@[-\d.]+)?\.png$', f)
        if not m or m.group(2) not in VIEW: continue
        out = os.path.join(dst, '%s_%s_%s.jpg' % (m.group(1), st, VIEW[m.group(2)]))
        Image.open(os.path.join(d, f)).convert('RGB').save(out, quality=85)
        print(out)
