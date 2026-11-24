#!/usr/bin/env python3
"""GARAGE-VIEW: the side by side - the game from a door, the garage today, the garage with the cooked scene.

  python tools/garage_view/compare.py --refs <capture dir> --garage <garage capture dir> --out page.html
         [--times now,noon,golden,night] [--views door_out,door_left,door_right] [--w 960] [--note "..."]

Same eye, same lens, same hour in each row (capture.js: ref_<time>_<shed>_<view>.png from the world;
<tag>_<time>_<shell>_<view>.png from the garage, tag = today | gview). One self-contained HTML file. Needs Pillow.
"""
import argparse, base64, html, io, json, os
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('--refs', required=True)
ap.add_argument('--garage', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--times', default='now,noon,golden,night')
ap.add_argument('--views', default='door_out,door_left,door_right')
ap.add_argument('--w', type=int, default=720)
ap.add_argument('--note', default='')
ap.add_argument('--today', default='')   # the folder of the 'garage today' pictures, when another run than --garage shot them
ap.add_argument('--sheds', default='HOME:club:Club hangar')   # ref shed id : garage shell : title [: view+view+...], comma separated
ap.add_argument('--title', default='Garage View Side by Side')
ap.add_argument('--extra', default='')   # an HTML fragment put under the note (the costs' table)
ap.add_argument('--eyebrow', default='Wingsmith · Jolene AFB · the view out of the hangars')
A = ap.parse_args()
esc = html.escape
TIMES, VIEWS = A.times.split(','), A.views.split(',')
SHEDS = [tuple(x.split(':')) for x in A.sheds.split(',')]   # (a 4th field: this shed's own views, '+' between them)
TNAME = {'now': '16:00 (the hour the game opens in)', 'noon': 'Noon', 'golden': 'Golden hour', 'night': 'Night'}
VNAME = {'door_out': 'straight out of the door', 'door_left': '45 degrees left', 'door_right': '45 degrees right', 'door_high': 'from 4 m up', 'inside': 'from the back of the room',
         'back': 'the back wall and its high window, from the floor', 'back_high': 'level through the back window', 'apron_out': 'from the apron, 14 m out'}


def aspect_of(path):
    if not os.path.exists(path):
        return None
    with Image.open(path) as im:
        return im.width / im.height


def jpg(path, aspect=None):
    if not os.path.exists(path):
        return None
    im = Image.open(path).convert('RGB')
    # the garage's canvas is narrower than the flight's (its panels): the game's picture is cut to the same shape, about its centre
    if aspect and im.width / im.height > aspect * 1.02:
        w = round(im.height * aspect); x0 = (im.width - w) // 2
        im = im.crop((x0, 0, x0 + w, im.height))
    if im.width > A.w:
        im = im.resize((A.w, round(im.height * A.w / im.width)), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=78, optimize=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()


def cell(cls, cap, src):
    if not src:
        return '<div class="cell"><p class="cap %s">%s</p><div class="none">no picture</div></div>' % (cls, cap)
    return '<div class="cell"><p class="cap %s">%s</p><img alt="%s" src="%s" loading="lazy"></div>' % (cls, cap, esc(cap), src)


rows, n = [], 0
for SH in SHEDS:
    sid, shell, sname = SH[0], SH[1], SH[2]; SV = SH[3].split('+') if len(SH) > 3 else VIEWS
    blk = []
    for t in TIMES:
        for v in SV:
            asp = aspect_of(os.path.join(A.garage, 'today_%s_%s_%s.png' % (t, shell, v))) or aspect_of(os.path.join(A.garage, 'gview_%s_%s_%s.png' % (t, shell, v)))
            g = jpg(os.path.join(A.refs, 'ref_%s_%s_%s.png' % (t, sid, v)), asp)
            a = jpg(os.path.join(A.today or A.garage, 'today_%s_%s_%s.png' % (t, shell, v)))
            b = jpg(os.path.join(A.garage, 'gview_%s_%s_%s.png' % (t, shell, v)))
            if not (g or a or b):
                continue
            n += 1
            blk.append('<div class="row"><h4>%s, %s</h4><div class="three">%s%s%s</div></div>' % (
                esc(TNAME.get(t, t)), esc(VNAME.get(v, v)), cell('game', 'The game', g), cell('bad', 'Garage today', a), cell('ok', 'Garage, new scene', b)))
    if blk:
        rows.append('<section><h2>%s</h2>%s</section>' % (sname, ''.join(blk)))
stats = ''
cj = os.path.join(A.garage, 'capture.json')
if os.path.exists(cj):
    C = json.load(open(cj, encoding='utf-8'))
    for k, v in C.get('steps', {}).items():
        g = v.get('gview') if isinstance(v, dict) else None
        if g and g.get('stats'):
            s = g['stats']
            stats = '<p class="hint">The new scene as it ran here: %d meshes, %s triangles, %d pictures, stood in %s ms.</p>' % (s['meshes'], format(s['tris'], ',').replace(',', ' '), s['textures'], g.get('buildMs'))
            break

PAGE = '''<title>__TITLE__</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* layout: rows of three pictures (the game, the garage today, the garage with the new scene), same eye and hour a row */
:root { --bg: #f1f2ec; --panel: #fbfbf7; --ink: #1f2a24; --mute: #5d6a62; --line: #cfd4c8; --accent: #b85c14; --good: #2f6b3f; --bad: #b3261e; --game: #27408b;
  --sans: "IBM Plex Sans", "Segoe UI", system-ui, sans-serif; --mono: "IBM Plex Mono", ui-monospace, Consolas, monospace; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #161b18; --panel: #1e2521; --ink: #e6ebe4; --mute: #9aa79f; --line: #36413a; --accent: #f0975a; --good: #7fc392; --bad: #ff8a80; --game: #9db4ff; color-scheme: dark } }
:root[data-theme="dark"] { --bg: #161b18; --panel: #1e2521; --ink: #e6ebe4; --mute: #9aa79f; --line: #36413a; --accent: #f0975a; --good: #7fc392; --bad: #ff8a80; --game: #9db4ff; color-scheme: dark }
body { background: var(--bg); color: var(--ink); font-family: var(--sans); font-size: 16px; line-height: 1.5; }
.wrap { max-width: 1500px; margin: 0 auto; padding-block: 28px 56px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: flex; flex-direction: column; gap: 30px; }
h1 { font-size: 30px; line-height: 1.15; margin: 0; text-wrap: balance; } h2 { font-size: 21px; margin: 0 0 10px; } h4 { font-size: 14px; margin: 0 0 6px; font-weight: 600; color: var(--mute); }
p { margin: 0 0 10px; max-width: 70ch; } .eyebrow { font-family: var(--mono); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--accent); margin: 0 0 8px; }
.row { border-top: 1px solid var(--line); padding-top: 12px; margin-bottom: 16px; }
.three { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; } .cell { min-width: 0; }
@media (max-width: 900px) { .three { grid-template-columns: 1fr; } h1 { font-size: 25px; } }
.cell img { width: 100%; height: auto; display: block; border: 1px solid var(--line); }
.cap { font-size: 13px; font-weight: 600; margin: 0 0 4px; } .cap.game { color: var(--game); } .cap.ok { color: var(--good); } .cap.bad { color: var(--bad); }
.tablebox { overflow-x: auto; max-width: 100%; margin-top: 14px; } table { border-collapse: collapse; font-size: 14px; } th, td { border-bottom: 1px solid var(--line); padding: 6px 12px 6px 0; text-align: left; vertical-align: top; } th { color: var(--mute); font-weight: 600; } td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; } h3 { font-size: 16px; margin: 18px 0 4px; }
.none { border: 1px dashed var(--line); color: var(--mute); font-size: 13px; padding: 28px 10px; text-align: center; }
.hint { color: var(--mute); font-size: 13px; } .note { background: var(--panel); border-left: 3px solid var(--accent); padding: 12px 14px; } .note p:last-child { margin-bottom: 0; }
</style>
<div class="wrap">
<header>
  <p class="eyebrow">__EYEBROW__</p>
  <h1>__TITLE__</h1>
  <p style="margin-top:10px">Each row is one eye and one hour: the game's world from the hangar's door, the garage as it is today, and the garage with the new measured scene. All three are real pictures from the game's own renderer.</p>
  __NOTE__ __STATS__
</header>
__ROWS__
</div>
'''
PAGE = PAGE.replace('__TITLE__', esc(A.title)).replace('__EYEBROW__', esc(A.eyebrow)).replace('__NOTE__', ('<div class="note"><p>%s</p></div>' % esc(A.note)) if A.note else '').replace('__STATS__', stats + (open(A.extra, encoding='utf-8').read() if A.extra else '')).replace('__ROWS__', ''.join(rows) or '<p>No pictures found.</p>')
open(A.out, 'w', encoding='utf-8', newline='\n').write(PAGE)
print('compare: %d rows -> %s (%.0f kB)' % (n, A.out, os.path.getsize(A.out) / 1024))
