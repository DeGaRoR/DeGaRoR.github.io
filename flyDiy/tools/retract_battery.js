#!/usr/bin/env node
// RETRACT BATTERY - the retractable gear drawn in many cases, a contact sheet per case (quickshot under the hood: the
// editor's own layers, headless). Each case: a build (an archetype key or a build file) and rows laid over it; each
// sheet: the gear down / half / up (columns) seen from a three-quarter below and from ahead (rows), plus the case's
// fit verdict and its doors printed under it.
//
//   node tools/retract_battery.js <out-dir> [--only name,name] [--w 1600]
//   (BITES=<path> names the B-ITES build when builds/candidates/B-ITES.json is not in this tree)
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const OUT = argv[0]; if (!OUT) { console.error('usage: node tools/retract_battery.js <out-dir> [--only a,b] [--w px]'); process.exit(2); }
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ONLY = opt('only', null), WPX = +opt('w', 1600);
fs.mkdirSync(OUT, { recursive: true });
const BITES = process.env.BITES || path.join(ROOT, 'builds', 'candidates', 'B-ITES.json');
const CASES = [
  { name: 'ttail_fuselage', key: 'ttail', over: { gearRetract: 1 }, what: 'T-tail tourer as born: the mains inward under the belly, the nose aft' },
  { name: 'ttail_wing', key: 'ttail', over: { gearRetract: 1, s1X: 1.6 }, what: 'T-tail tourer, 3.2 m track: the mains inward into the wing' },
  { name: 'ttail_wing_box2', key: 'ttail', over: { gearRetract: 1, s1X: 1.6, gearWellCut: 1, gearDoors: 2 }, what: 'the same, box outline, two doors' },
  { name: 'ttail_partial', key: 'ttail', over: { gearRetract: 1, s1X: 1.6, gearRetFrac: 0.6 }, what: 'the same, retracting 0.6 of the fold (the wheels in their insets)' },
  { name: 'ttail_partial85', key: 'ttail', over: { gearRetract: 1, s1X: 1.6, gearRetFrac: 0.85 }, what: 'the same, 0.85 of the fold: the wheels part way in (the cutouts round them)' },
  { name: 'ttail_nose_fwd', key: 'ttail', over: { gearRetract: 1, s1X: 1.6, gearFoldNose: 1 }, what: 'the nose folding forward (into the narrowing nose / under the cowl)' },
  { name: 'bites', file: BITES, over: { gearRetract: 1 }, what: 'B-ITES as it is (retractable)' },
  { name: 'bites_wing', file: BITES, over: { gearRetract: 1, s1X: 1.4 }, what: 'B-ITES, 2.8 m track: the mains into the wing' },
  { name: 'bites_nose_fwd', file: BITES, over: { gearRetract: 1, gearFoldNose: 1 }, what: 'B-ITES, the nose folding forward' },
];
const views = ['qb', 'front'], gs = ['1', '0.5', '0'];
const QS = path.join(ROOT, 'tools', 'quickshot.js');
const index = [];
for (const c of CASES) {
  if (ONLY && !ONLY.split(',').includes(c.name)) continue;
  const pre = path.join(OUT, c.name), logs = [];
  let frames = null;                  // the gear down frames the series (--focus gear), the others reuse its frames
  for (const g of gs) {
    const args = [QS].concat(c.key ? ['--key', c.key, pre + '_g' + g] : [c.file, pre + '_g' + g],
      ['--over', JSON.stringify(c.over), '--gear', g, '--views', views.join(','), '--noedges', '--w', String(WPX)],
      frames ? ['--frames', JSON.stringify(frames)] : ['--focus', 'gear']);
    let out = '';
    try { out = execFileSync(process.execPath, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (e) { out = String(e.stdout || '') + String(e.stderr || e.message); }
    logs.push('g ' + g + ': ' + out.split('\n').filter(l => /wells|--gear|error|Error|no retract/.test(l)).join(' | '));
    if (!frames) { frames = {}; for (const l of out.split('\n')) { const m = /^frame (\w+): (\[.*\])$/.exec(l); if (m) frames[m[1]] = JSON.parse(m[2]); } }
  }
  index.push({ name: c.name, what: c.what, over: c.over, logs });
  console.log(c.name + ': ' + logs[0]);
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 1));
// the sheets (python + PIL, the ref_match tools' own dependency)
const py = `
import json, os, sys
from PIL import Image, ImageDraw
out = sys.argv[1]; idx = json.load(open(os.path.join(out, 'index.json')))
for c in idx:
    rows = []
    for v in ${JSON.stringify(views)}:
        ims = [Image.open(os.path.join(out, '%s_g%s_%s.png' % (c['name'], g, v))) for g in ${JSON.stringify(gs)}]
        W, H = ims[0].size
        # crop to what is drawn (the dark background trimmed), the same box on the three
        boxes = [im.convert('L').point(lambda p: 255 if p > 40 else 0).getbbox() for im in ims]
        x0 = min(b[0] for b in boxes); y0 = min(b[1] for b in boxes); x1 = max(b[2] for b in boxes); y1 = max(b[3] for b in boxes)
        cs = [im.crop((x0, y0, x1, y1)) for im in ims]
        w, h = cs[0].size; s = 600 / w; cs = [c2.resize((600, int(h * s))) for c2 in cs]
        row = Image.new('RGB', (1800, cs[0].size[1]), (22, 26, 32)); [row.paste(c2, (i * 600, 0)) for i, c2 in enumerate(cs)]
        rows.append(row)
    Ht = sum(r.size[1] for r in rows) + 40
    sheet = Image.new('RGB', (1800, Ht), (22, 26, 32)); d = ImageDraw.Draw(sheet)
    d.text((8, 8), c['name'] + ': ' + c['what'] + '   (down | half | up)', fill=(230, 220, 200))
    y = 40
    for r in rows: sheet.paste(r, (0, y)); y += r.size[1]
    sheet.save(os.path.join(out, 'sheet_' + c['name'] + '.png'))
`;
fs.writeFileSync(path.join(OUT, '_sheets.py'), py);
execFileSync('python3', [path.join(OUT, '_sheets.py'), OUT], { stdio: 'inherit' });
console.log('sheets in ' + OUT);
