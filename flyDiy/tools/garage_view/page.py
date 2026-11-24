#!/usr/bin/env python3
"""GARAGE-VIEW: the user's page - the measured world round the two hangars (maps, skylines, schematic door views).

  python tools/garage_view/page.py --in <dir with measure.json, the svgs, sketch.json + pngs> --out page.html [--sketch dir]

One self-contained HTML file (the pictures inline, as the user reads it on the phone). Stdlib only.
"""
import argparse, base64, json, os, re, html

ap = argparse.ArgumentParser()
ap.add_argument('--in', dest='src', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--sketch', default=None)
ap.add_argument('--note', default='')
ap.add_argument('--refs', default=None, help="a capture dir: the game's own door views (ref_<time>_<shed>_<view>.png)")
A = ap.parse_args()
SK = A.sketch or A.src
M = json.load(open(os.path.join(A.src, 'measure.json'), encoding='utf-8'))
S = json.load(open(os.path.join(SK, 'sketch.json'), encoding='utf-8'))
CEN = os.path.join(A.src, 'census.json')
CEN = json.load(open(CEN, encoding='utf-8')) if os.path.exists(CEN) else None
esc = html.escape


def svg(name):
    t = open(os.path.join(A.src, name), encoding='utf-8').read()
    # the sheet scales with its box: drop the fixed pixel size, keep the viewBox
    return re.sub(r'(<svg[^>]*?) width="\d+" height="\d+"', r'\1', t, count=1)


def png(name):
    return 'data:image/png;base64,' + base64.b64encode(open(os.path.join(SK, name), 'rb').read()).decode()


club, large = M['sheds'][0], M['sheds'][1]
home = [r for r in M['runways'] if r['id'] == (M.get('site') or {}).get('field', 'HOME')][0]
hz = M['horizon'][0]['rows']
cone = [r for r in hz if abs(((r['a'] - club['doorBearing'] + 540) % 360) - 180) <= 80]
top = max(cone, key=lambda r: r['el'])
people = sum(1 for o in M['objects'] if o.get('person'))


def figure(v):
    labs = sorted(v['labels'], key=lambda l: l['d'])[:7]
    tags = ''.join('<span class="tag" style="left:%.1f%%;top:%.1f%%">%s <b>%d m</b></span>' % (100 * l['x'] / v['w'], 100 * l['y'] / v['h'], esc(l['name']), l['d']) for l in labs)
    return '<figure class="shot"><div class="frame"><img alt="%s" src="%s" loading="lazy">%s</div></figure>' % (esc(v['label']), png(v['file']), tags)


def pair(shed, view):
    ref = [v for v in S if v['shed'] == shed and v['view'] == view and v['scene'] == 'ref'][0]
    tod = [v for v in S if v['shed'] == shed and v['view'] == view and v['scene'] == 'today'][0]
    return ('<div class="pair"><h4>%s</h4><div class="two"><div><p class="cap ok">The measured world</p>%s</div><div><p class="cap bad">What the garage builds today</p>%s</div></div></div>'
            % (esc(ref['label'][0].upper() + ref['label'][1:]), figure(ref), figure(tod)))


def jpg(path, w=1280, q=80):
    from PIL import Image
    import io
    im = Image.open(path).convert('RGB')
    if im.width > w:
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=q, optimize=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()


def refs_section():
    if not A.refs:
        return ''
    out = []
    for sh, nm in ((club, 'club hangar'), (large, 'large hangar')):
        sid = re.sub(r'\W', '_', sh['id'])
        pics = []
        for view, cap in (('door_out', 'straight out of the door'), ('door_left', '45 degrees to the left'), ('door_right', '45 degrees to the right')):
            f = os.path.join(A.refs, 'ref_now_%s_%s.png' % (sid, view))
            if os.path.exists(f):
                pics.append('<figure class="shot"><div class="frame"><img alt="The game from the %s door, %s" src="%s" loading="lazy"></div><figcaption>%s</figcaption></figure>' % (nm, cap, jpg(f), cap[0].upper() + cap[1:]))
        if pics:
            out.append('<h4 style="margin-top:14px">From the %s door</h4><div class="refs">%s</div>' % (nm, ''.join(pics)))
    if not out:
        return ''
    return ('<section><h2>The game itself, from each door</h2><p>Real pictures from the game (the 16:00 light it boots in), the eye standing in each door at 1.7 m, through the same 46 degree lens the garage uses. '
            'These are the references the new scene is judged against.</p>%s</section>' % ''.join(out))


def rows(items, name):
    out = []
    for o in items:
        s = o['seen']
        out.append('<tr><td>%s</td><td class="n">%s m</td><td>%s</td><td class="n">%s m</td><td>%s</td></tr>' % (
            esc(name(o)), s[0]['d'], 'in front' if s[0]['front'] else 'behind', s[1]['d'], 'in front' if s[1]['front'] else 'behind'))
    return ''.join(out)


veh = [o for o in M['objects'] if (o['kind'] == 'aircraft' or re.match(r'^(auto_|truck_|machine_)', o['key'])) and min(o['seen'][0]['d'], o['seen'][1]['d']) < 260]
veh.sort(key=lambda o: min(o['seen'][0]['d'], o['seen'][1]['d']))
bld = sorted(M['buildings'], key=lambda b: min(b['seen'][0]['d'], b['seen'][1]['d']))
trees_line = ''
if CEN:
    n = CEN['n']
    trees_line = '<li><b>%s drawn trees</b> within 1.5 km, %d species, each with the game\'s own place, size and sink (read from the game\'s tree planter, not guessed).</li>' % (format(n, ',').replace(',', ' '), len(CEN['keys']))
else:
    trees_line = '<li><b>The forest is being counted</b> (every drawn tree with its species, size and sink); the maps and views below do not show it yet.</li>'

PAGE = '''<title>Garage View Survey</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* layout: a survey report - one column of sheets (maps, pictures) between short notes; numbers in mono */
:root { --bg: #f1f2ec; --panel: #fbfbf7; --ink: #1f2a24; --mute: #5d6a62; --line: #cfd4c8; --accent: #b85c14; --good: #2f6b3f; --bad: #b3261e; --sheet: #e3e8d6;
  --sans: "IBM Plex Sans", "Segoe UI", system-ui, sans-serif; --mono: "IBM Plex Mono", ui-monospace, Consolas, monospace; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #161b18; --panel: #1e2521; --ink: #e6ebe4; --mute: #9aa79f; --line: #36413a; --accent: #f0975a; --good: #7fc392; --bad: #ff8a80; --sheet: #2a332d; color-scheme: dark } }
:root[data-theme="dark"] { --bg: #161b18; --panel: #1e2521; --ink: #e6ebe4; --mute: #9aa79f; --line: #36413a; --accent: #f0975a; --good: #7fc392; --bad: #ff8a80; --sheet: #2a332d; color-scheme: dark }
body { background: var(--bg); color: var(--ink); font-family: var(--sans); font-size: 16px; line-height: 1.5; }
.wrap { max-width: 1120px; margin: 0 auto; padding-block: 28px 56px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: flex; flex-direction: column; gap: 34px; }
h1 { font-size: 30px; line-height: 1.15; margin: 0; text-wrap: balance; font-weight: 700; }
h2 { font-size: 21px; margin: 0 0 6px; text-wrap: balance; font-weight: 600; }
h4 { font-size: 15px; margin: 0 0 8px; font-weight: 600; }
p { margin: 0 0 10px; max-width: 68ch; } ul { margin: 0; padding-left: 20px; max-width: 70ch; } li { margin-bottom: 6px; }
.eyebrow { font-family: var(--mono); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--accent); margin: 0 0 8px; }
.lead { font-size: 17px; color: var(--ink); }
.facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
.fact { border-top: 2px solid var(--accent); padding-top: 8px; min-width: 0; }
.fact b { display: block; font-family: var(--mono); font-size: 24px; font-weight: 500; font-variant-numeric: tabular-nums; }
.fact span { color: var(--mute); font-size: 14px; }
.sheet { background: var(--sheet); border: 1px solid var(--line); overflow: auto; max-height: 86vh; }
.sheet svg { display: block; width: max(100%, 940px); height: auto; }
.sheet.strip svg { width: max(100%, 860px); }
.hint { color: var(--mute); font-size: 13px; margin-top: 6px; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 13px; color: var(--mute); margin-top: 8px; }
.legend i { display: inline-block; width: 12px; height: 12px; margin-right: 5px; vertical-align: -1px; border: 1px solid var(--line); }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; } .two > div { min-width: 0; }
@media (max-width: 720px) { .two { grid-template-columns: 1fr; } h1 { font-size: 25px; } }
.pair { border-top: 1px solid var(--line); padding-top: 14px; }
.pairs { display: flex; flex-direction: column; gap: 18px; }
.refs { display: grid; grid-template-columns: 1fr; gap: 12px; } figcaption { font-size: 13px; color: var(--mute); margin-top: 4px; }
.cap { font-size: 13px; font-weight: 600; margin: 0 0 4px; } .cap.ok { color: var(--good); } .cap.bad { color: var(--bad); }
figure { margin: 0; } .frame { position: relative; line-height: 0; border: 1px solid var(--line); overflow: hidden; }
.frame img { width: 100%; height: auto; display: block; }
.tag { position: absolute; transform: translate(-50%, -135%); background: rgba(20, 26, 22, .78); color: #f2f5ef; font-size: 10.5px; line-height: 1.25; padding: 1px 5px; white-space: nowrap; border-radius: 2px; font-family: var(--sans); }
.tag b { font-family: var(--mono); font-weight: 500; }
.tablebox { overflow-x: auto; border: 1px solid var(--line); background: var(--panel); }
table { border-collapse: collapse; width: 100%; font-size: 14px; min-width: 560px; }
th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--line); } th { font-weight: 600; color: var(--mute); font-size: 12px; text-transform: uppercase; letter-spacing: .05em; }
td.n { font-family: var(--mono); font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
.note { background: var(--panel); border-left: 3px solid var(--accent); padding: 12px 14px; }
.note p:last-child { margin-bottom: 0; }
code { font-family: var(--mono); font-size: .92em; }
</style>
<div class="wrap">
<header>
  <p class="eyebrow">Wingsmith · Jolene AFB · the view out of the hangars</p>
  <h1>Garage View Survey</h1>
  <p class="lead" style="margin-top:10px">The world round the club hangar and the large hangar, measured from the game's own data. This is the survey the new outdoor scene is built from; nothing here is the final look. The pictures are schematic (flat colours, boxes, cones) but every place, size and distance is the game's.</p>
  __NOTE__
</header>

__REFS__

<section class="facts">
  <div class="fact"><b>__BETWEEN__ m</b><span>between the two hangars; one shared scene serves both</span></div>
  <div class="fact"><b>__BEAR__°</b><span>compass bearing both doors look to (north-east)</span></div>
  <div class="fact"><b>__RWY__ m</b><span>from each door to the edge of runway 13/31, straight ahead</span></div>
  <div class="fact"><b>__TOPH__ m</b><span>the highest summit on the skyline, __TOPD__ km away, __TOPE__° above eye level</span></div>
</section>

<section>
  <h2>The garage shows the airfield turned by 41°</h2>
  <p>Today's outdoor scene places the runway and the aprons as if every hangar faced due north. On Jolene both hangars face north-east. The sky already follows the true heading, the ground does not, so through the door the runway sits 41° away from where the sun and the mountains say it should. In red: where today's garage draws the runway and the aprons. In grey: where they are. This is read from the code; the GPU run will confirm it in pictures.</p>
  <div class="sheet">__MAP_TODAY__</div>
  <p class="hint">Scroll or pinch inside the sheet. North is up; orange rings are 50, 100 and 200 m from each door; orange lines are the door's view, straight out and 40° and 80° each side.</p>
</section>

<section>
  <h2>From the door: the measured world against today's garage</h2>
  <p>Same eye, same field of view (46°, the garage's default). Left: what the game's world holds at that spot. Right: what today's garage builds there (redrawn from its code, schematic too). __FOREST_SENTENCE__</p>
  <h4 style="margin-top:14px">Club hangar</h4>
  <div class="pairs">__PAIRS_CLUB__</div>
  <h4 style="margin-top:22px">Large hangar</h4>
  <div class="pairs">__PAIRS_LARGE__</div>
</section>

<section>
  <h2>The map, 300 m around</h2>
  <div class="sheet">__MAP_NEAR__</div>
  <div class="legend"><span><i style="background:#c9b79a"></i>the two hangars (door edge in orange)</span><span><i style="background:#aeaaa0"></i>apron, taxiway</span><span><i style="background:#8f8c86"></i>runway</span><span><i style="background:#b9a88c"></i>buildings (dashed: size not yet read from the game)</span><span><i style="background:#27408b"></i>parked aircraft, stands</span><span><i style="background:#b0332b"></i>vehicles</span><span><i style="background:#2f5d3a"></i>conifers</span><span><i style="background:#5c8a3c"></i>broadleaf</span><span><i style="background:#fff;border-color:#c2185b"></i>people (left out of the scene)</span></div>
  <p class="hint">Thin brown lines are 1 m contours; the apron is a flat pad at 30.6 m.</p>
</section>

<section>
  <h2>The skyline from each door</h2>
  <p>What stands behind the airfield, degree by degree: the ridges one behind another. This is the far ring of the scene.</p>
  <div class="sheet strip">__HZ0__</div>
  <div class="sheet strip" style="margin-top:10px">__HZ1__</div>
</section>

<section>
  <h2>Two kilometres around</h2>
  <div class="sheet">__MAP_WIDE__</div>
  <p class="hint">10 m contours; green is the game's canopy map (darker = taller forest); blue is the sea.</p>
</section>

<section>
  <h2>What stands where</h2>
  <p>Distances are from each door's centre. "In front" means past the door line, on the side the door opens to.</p>
  <div class="tablebox"><table><thead><tr><th>What</th><th>Club door</th><th></th><th>Large door</th><th></th></tr></thead><tbody>
  __ROWS_B__
  __ROWS_V__
  </tbody></table></div>
  <ul style="margin-top:12px">
    __TREES_LINE__
    <li><b>__PEOPLE__ people</b> stand near the apron in the world. They are left out of the scene, as you asked.</li>
    <li><b>Cars</b> will be the game's own car models, not boxes. Parked aircraft stay out unless you want them.</li>
  </ul>
</section>

<section class="note">
  <p><b>Next.</b> A GPU run brings back the real pictures: the game's view from each door at four times of day (the references the new scene is judged against), the ground from above in two resolutions (about 1 cm a pixel in front of each door, 11 cm over the whole pavement), and the game's own tree sprites. Then the scene is built, and it comes back to you side by side with the game.</p>
</section>
</div>
'''

rep = {
    '__REFS__': refs_section(),
    '__NOTE__': ('<p class="hint">%s</p>' % esc(A.note)) if A.note else '',
    '__BETWEEN__': str(M['between']), '__BEAR__': '%d' % round(club['doorBearing']),
    '__RWY__': '%d' % round(home['nearest'][0]['toEdge']), '__TOPH__': '%d' % round(top['h']), '__TOPD__': '%.0f' % (top['d'] / 1000), '__TOPE__': '%.1f' % top['el'],
    '__MAP_TODAY__': svg('map_today.svg'), '__MAP_NEAR__': svg('map_near.svg'), '__MAP_WIDE__': svg('map_wide.svg'),
    '__HZ0__': svg('horizon_HOME.svg'), '__HZ1__': svg('horizon_HOME_2.svg'),
    '__PAIRS_CLUB__': ''.join(pair('HOME', v) for v in ['door_out', 'door_left', 'door_right', 'inside']),
    '__PAIRS_LARGE__': ''.join(pair('HOME.2', v) for v in ['door_out', 'door_left', 'door_right', 'inside']),
    '__ROWS_B__': rows(bld, lambda b: b['key'].split('/')[-1] + ' (' + b['name'].replace('Jolene AFB ', '') + ')'),
    '__ROWS_V__': rows(veh, lambda o: o['key'].replace('arch:', 'parked ').replace('auto_', '').replace('truck_', '').replace('_', ' ')),
    '__TREES_LINE__': trees_line, '__PEOPLE__': str(people),
    '__FOREST_SENTENCE__': 'The trees on the left are the game\'s own, one by one.' if CEN else 'The forest is not drawn on the left yet (it is being counted): the left pictures show the ground, the buildings, the vehicles and the skyline only.',
}
for k, v in rep.items():
    PAGE = PAGE.replace(k, v)
open(A.out, 'w', encoding='utf-8').write(PAGE)
print('page: %s  (%.0f kB)' % (A.out, os.path.getsize(A.out) / 1024))
