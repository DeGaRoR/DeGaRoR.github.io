# AFT-BULKHEAD-SHOTS: the rig's PNGs -> rows/<dir>/<build>_<SET>_<day|dusk>_<view>.jpg (q85), and the BEFORE | AFTER pairs.
# usage: python3 -I to_rows.py <out dir> <rows dir> [<study stills dir>]
import sys, os, re
from PIL import Image, ImageDraw, ImageFont
src, dst = sys.argv[1], sys.argv[2]; study = sys.argv[3] if len(sys.argv) > 3 else None
VIEW = {'bk-out--30-0-3': 'q34Fwd', 'bk-out--45-0-3': 'q45Fwd', 'bk-infwd': 'inFwd', 'bk-inclose-0.6': 'inClose', 'bk-inside-30': 'inSide', 'bk-infwd--0.215-0-0.4@0.282': 'inFwdFwd'}
DIR = {'BEFORE': 'before', 'FULL': 'full', 'TWINA': 'full', 'TWINB': 'full', 'FULLPAX0': 'full', 'TWINAPAX0': 'full', 'FLAT': 'flat', 'SLING': 'sling'}
def dirOf(s): return DIR.get(s, 'relief' if s.startswith('RELIEF') or s == 'RIVETS' else 'misc')
for d in set(DIR.values()) | {'relief', 'pairs', 'details'}: os.makedirs(os.path.join(dst, d), exist_ok=True)
have = {}
for st in ('day', 'dusk'):
    d = os.path.join(src, st)
    if not os.path.isdir(d): continue
    for f in sorted(os.listdir(d)):
        m = re.match(r'^([a-z0-9]+)_([A-Z0-9]+)_(bk-.+?)\.png$', f)
        if not m or m.group(3) not in VIEW: continue
        b, s, v = m.group(1), m.group(2), VIEW[m.group(3)]
        out = os.path.join(dst, dirOf(s), '%s_%s_%s_%s.jpg' % (b, s, st, v))
        p = os.path.join(d, f)
        if not os.path.exists(out) or os.path.getmtime(out) < os.path.getmtime(p):
            Image.open(p).convert('RGB').save(out, quality=85)
        have[(b, s, st, v)] = p
try: FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 26)
except Exception: FONT = ImageFont.load_default()
def pair(a, b, la, lb, out):
    A = Image.open(a).convert('RGB'); B = Image.open(b).convert('RGB')
    if B.size != A.size: B = B.resize(A.size)
    W, H = A.size; c = Image.new('RGB', (2 * W + 8, H), (24, 24, 24)); c.paste(A, (0, 0)); c.paste(B, (W + 8, 0))
    g = ImageDraw.Draw(c)
    for x, t in ((0, la), (W + 8, lb)):
        tw = g.textlength(t, font=FONT); g.rectangle([x + 12, 12, x + 28 + tw, 52], fill=(0, 0, 0)); g.text((x + 20, 16), t, fill=(255, 255, 255), font=FONT)
    c.save(out, quality=85); print(out)
PAIRS = [('cub', 'FULL'), ('cub', 'FLAT'), ('cub', 'SLING'), ('twin', 'TWINA'), ('twin', 'TWINB'), ('jodel', 'FULL'), ('mosquito', 'FULL'), ('c172', 'FULL')]
for b, s in PAIRS:
    for v in VIEW.values():
        if (b, 'BEFORE', 'day', v) in have and (b, s, 'day', v) in have:
            pair(have[(b, 'BEFORE', 'day', v)], have[(b, s, 'day', v)], 'BEFORE', s, os.path.join(dst, 'pairs', '%s_BEFORE-%s_day_%s.jpg' % (b, s, v)))
# the lamp: li_pax 0 | li_pax 1 at dusk, the pilot's eye
for b, s0, s1, v in (('cub', 'FULLPAX0', 'FULL', 'inFwd'), ('twin', 'TWINAPAX0', 'TWINA', 'inFwd'), ('twin', 'TWINAPAX0', 'TWINA', 'q34Fwd'), ('jodel', 'FULLPAX0', 'FULL', 'inFwdFwd')):
    if (b, s0, 'dusk', v) in have and (b, s1, 'dusk', v) in have:
        pair(have[(b, s0, 'dusk', v)], have[(b, s1, 'dusk', v)], s1 + ' li_pax 0', s1 + ' li_pax 1', os.path.join(dst, 'pairs', '%s_%s_dusk_%s_pax0-pax1.jpg' % (b, s1, v)))
# screws | rivets on the twin's framed panel
for v in ('q34Fwd', 'inClose'):
    if ('twin', 'RELIEF3', 'day', v) in have and ('twin', 'RIVETS', 'day', v) in have:
        pair(have[('twin', 'RELIEF3', 'day', v)], have[('twin', 'RIVETS', 'day', v)], 'RELIEF3 screws', 'RELIEF3 rivets', os.path.join(dst, 'pairs', 'twin_screws-rivets_day_%s.jpg' % v))
# check 5: this run's BEFORE next to the study's own still (the same view)
if study:
    for (b, s, st, v), p in have.items():
        if s != 'BEFORE': continue
        q = os.path.join(study, '%s_%s_%s.jpg' % (b, st, v))
        if os.path.exists(q): pair(q, p, 'study L30b' + (' (floats_2)' if b == 'twin' else ''), 'this run BEFORE' + (' (4b)' if b == 'twin' else ''), os.path.join(dst, 'pairs', '%s_study-BEFORE_%s_%s.jpg' % (b, st, v)))
