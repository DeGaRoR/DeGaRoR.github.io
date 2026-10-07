#!/usr/bin/env node
// turn_pads.js - THE TURN PADS AND THE STRIPS' OWN WAYS, AUTHORED (ISLAND-TOUR, G1966-G1968). Writes, for Jolene:
//   the runway fields  `turn` (the pad per end, contract v1.32) and `departure` (G527.3's one-way take-off) on each strip
//                      that the tour's census asked for - in the strip's OWNER: its jolene_parts/*.json, or the field's
//                      literal in tools/jolene_author.py for Tamgas Hill (w3)
//   the pads' ground   per pad (25_airfield.js turnPadNodes(...).ground, the U-turn's wheel track + 3 m): a terrain
//                      modifier at the strip's own height (a flatten where the strip is level there, else a slope
//                      polygon on the strip's local gradient - the bulb continues the strip, it is not a step), a
//                      surface of the strip's class, the strip's look on it when the look is a pavement (gravel), and
//                      an exclude of trees and plots over the pad + the widest validated span's half + 3 m (the
//                      wingtip's sweep) - in a part of their own, tools/jolene_parts/turnpads.json (prefix tp_)
//   the mine's apron   Jumbo Mine Street's start / park area as an apron: one gravel surface (apron: true) over the
//                      stand's pad and the south turning bay's east half, the gravel look on it, its flatten
//                      (jolene_parts/mn_mine.json)
// and the SAME entries into tools/fixtures/island_jolene.json, where jolene_author.py's merge would put them (the
// field, then the .py parts, then the .json parts alphabetically - turnpads.json last), rev 23 -> 24. jolene_author.py
// cannot run in a cloud session (metlakatla_author.py reads the bench's DEM), which is why G1927 wrote its parts and the
// fixture with one script; this is that, for G1966. Idempotent: it removes what it wrote before it writes.
//   node tools/turn_pads.js [--dry]       (--dry: print the plan, write nothing)
// Then: node tools/premises_cook.js --island jolene (the cook), node tools/taxi_census.js, node tools/approach_census.js.
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname;
const PT = require(path.join(T, 'pilot_trace.js'));
PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const L = require(path.join(T, '_taxiclear_lib.js'));
const DRY = process.argv.includes('--dry');
const FX = path.join(T, 'fixtures', 'island_jolene.json');
const PARTS = path.join(T, 'jolene_parts');
const AUTHOR = path.join(T, 'jolene_author.py');
const REV = 24;

// ---- THE PLAN (every number justified in HANDOVER G1966-G1968) ----------------------------------------------------
// r 9 m: the C172's own 5.9 m tightest taxi turn with room, the Cub's tailwheel (11.3 m on its steering alone) helped
// round by its brakes and the follower's corner speed - GATE TOUR flies both round every pad. `side` 'auto' takes the
// side with no solid thing in the wing's sweep and the least earthwork (printed).
const RUNWAYS = {
  // Tamgas Hill: landed uphill from the water (approach 0, G434); the census: its uphill climb-out has the hill 4.6 m
  // through a 1:15 surface 75 m past the end - it is left DOWNHILL (departure 0, over end 0, the water)
  w3: { owner: 'author', departure: 0, turn: [{ r: 9, side: 'auto' }, { r: 9, side: 'auto' }] },
  // the altiport: landed uphill onto the top, left downhill (altiport: true); a pad on the top (the head's platform
  // side) and one at the foot of the 10 % ramp
  tw_ski: { owner: 'tramway.json', turn: [{ r: 9, side: 'auto' }, { r: 9, side: 'auto' }] },
  // East Point: landed over the cove (approach 1) and left back out over it (departure 1): the take-off starts at the
  // wooded north end (end 0) - the pad there on the stand's side, so the stand stands on it
  nv_strip: { owner: 'native.json', turn: [{ r: 9, side: 'auto' }, { r: 9, side: 'auto' }] },
  // Jumbo Mine Street: its pattern is AUTHORED (G522 / G1927: the teardrops on the two turning bays) - no pad declared;
  // the census: the ridge stands 148 m through the 1:15 surface south of it - it is left NORTH, the way it is landed
  // from (departure 1, over end 1)
  mn_strip: { owner: 'mn_mine.json', departure: 1 },
};
// THE APPROACH FANS the census asked for (G1967): East Point's final over the cove (approach 1) passed 4.8 m UNDER the
// forest's tops 50 m out (the map's 23 m canopy, 20-26 m off the centreline): the user's fan (G527.3) opened 14 m a
// side at the threshold and 22 m 60 m out, inside the 1:15 surface's own corridor (the strip's half-width + 15 m,
// diverging 10 %). Its two inner corner pairs go out to that corridor (+-22 m at the end, +-28 m 60 m out); the user's
// outer lines (+-36 m at 130 m, +-55 m at 230 m) are kept. In the strip's frame: [m along +hdg from the centre, m along n]
const FANS = {
  nv_fan_s: { owner: 'native.json', strip: 'nv_strip', sl: [[75, -22], [135, -28], [205, -36], [305, -55], [305, 55], [205, 36], [135, 28], [75, 22]] },
};
const WIDEST_HALF = 5.5;            // the aluminium C172's half-span (11.0 m), the widest validated build

const r3 = v => +v.toFixed(3), r2 = v => +v.toFixed(2);
const txt0 = fs.readFileSync(FX, 'utf8');
const REC = JSON.parse(txt0);
// a world WITHOUT this tool's entries (the pads read the ground as it was), for the levels and the side choice
const strip = JSON.parse(txt0);
for (const k of Object.keys(strip.layers)) strip.layers[k] = strip.layers[k].filter(e => !/^tp_/.test(e.id || '') && !/^mn_(y|m|t)_apron/.test(e.id || ''));
for (const r of strip.layers.runways) if (RUNWAYS[r.id]) { delete r.turn; }
const W = IN.islandWorld('jolene', { premises: JSON.stringify(strip) });
const O = W.premises.overlay, y0 = O.frame ? O.frame.y0 : W.terrainH(0, 0);
const SH = L.islandObstacles(C, 'jolene', 'town').concat(L.treeTrunks(W));
const IX = L.index(SH);
const recOf = id => REC.layers.runways.find(r => r.id === id);

const out = { terrain: [], surface: [], material: [], exclude: [] };
const report = [];
for (const id of Object.keys(RUNWAYS)) {
  const P = RUNWAYS[id], r = recOf(id), a = W.aerodromes.find(q => q.id === id);
  if (!r || !a) throw new Error('turn_pads: no runway ' + id);
  if (P.departure !== undefined) r.departure = P.departure;
  if (!P.turn) { report.push(id + ': departure ' + P.departure + ' (no pad: the authored pattern)'); continue; }
  const turn = [null, null];
  const R = C.siteRunway(a);
  const hAt = s => W.terrainH(R.end0.x + R.dx * s, R.end0.z + R.dz * s);   // the strip's centreline as composed
  for (const k of [0, 1]) {
    const want = P.turn[k];
    if (!want) continue;
    const cand = [];
    for (const side of want.side === 'auto' ? [1, -1] : [want.side]) {
      const ap = Object.assign({}, a, { turn: k === 0 ? [{ r: want.r, side }, null] : [null, { r: want.r, side }] });
      const TP = C.turnPadNodes(ap, k);
      // the wing's sweep: the path (sampled as the pilot's), each point's nearest solid thing
      const pat = C.sitePattern(ap, null, {});
      const pth = C.patternPath(pat, pat.routes.back[k], 1.0, null);
      let near = Infinity, what = null;
      for (const q of pth.pts) { const n = IX.nearest(q.x, q.z, 40); if (n && n.d < near) { near = n.d; what = L.fmtWhat(n.s); } }
      // the earthwork: the strip's height at each point's s against the ground there
      const sOf = (x, z) => (x - R.end0.x) * R.dx + (z - R.end0.z) * R.dz;
      let cut = 0, gs = [];
      const poly = TP.ground;
      for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) {
        const u = i / 10, v = j / 10;
        const A = poly[0], B = poly[1], Cc = poly[2], D = poly[3];
        const x = (1 - u) * ((1 - v) * A[0] + v * B[0]) + u * ((1 - v) * D[0] + v * Cc[0]);
        const z = (1 - u) * ((1 - v) * A[1] + v * B[1]) + u * ((1 - v) * D[1] + v * Cc[1]);
        const s = sOf(x, z), h = hAt(Math.max(0, Math.min(R.len, s)));
        cut = Math.max(cut, Math.abs(W.terrainH(x, z) - h)); gs.push(s);
      }
      cand.push({ side, TP, near, what, cut });
    }
    const ok = cand.filter(c => c.near >= WIDEST_HALF + 3);
    const best = (ok.length ? ok : cand).sort((p, q) => p.cut - q.cut)[0];
    report.push(id + ' end ' + k + ': ' + cand.map(c => 'side ' + (c.side > 0 ? '+' : '-') + ' nearest ' + c.near.toFixed(1) + ' m (' + c.what + '), earthwork ' + c.cut.toFixed(1) + ' m').join(' | ') + ' -> side ' + (best.side > 0 ? '+' : '-'));
    turn[k] = { r: want.r, side: best.side };
    // ---- the ground: the strip's height continued over the pad
    const TP = best.TP;
    // A STAND ON THE PAD (East Point's north end: the stand 16 m off the centreline, 4 m from the end): the pad's ground
    // goes out past the parked aeroplane's tail (+ 10 m) - the turn's 21 m left its tail wheel in the flatten's feather,
    // the drawn ground 4 cm off the true one there (GATE CONTACT's tyres at the stand)
    let poly = TP.ground.map(q => [r2(q[0]), r2(q[1])]);
    const stw = r.stand ? [r.stand.x, r.stand.z] : null;
    if (stw) {
      const E = k === 0 ? R.end0 : R.end1, u = k === 0 ? [R.dx, R.dz] : [-R.dx, -R.dz], nn = [R.nx * best.side, R.nz * best.side];
      const sS = (stw[0] - E.x) * u[0] + (stw[1] - E.z) * u[1], lS = (stw[0] - E.x) * nn[0] + (stw[1] - E.z) * nn[1];
      if (sS > -5 && sS < TP.sE + 5 && lS > 0) {
        const out = Math.max(TP.w + 3, lS + 10), Pw = (q, l) => [r2(E.x + u[0] * q + nn[0] * l), r2(E.z + u[1] * q + nn[1] * l)];
        poly = [Pw(0, R.wid / 2 - 1), Pw(0, out), Pw(TP.sE - TP.r, out), Pw(TP.sE + 3, R.wid / 2 - 1)];
        report.push(id + ' end ' + k + ': the stand stands on the pad (' + sS.toFixed(1) + ' m in, ' + lS.toFixed(1) + ' m out) - the pad out to ' + out.toFixed(1) + ' m');
      }
    }
    const s0 = 0, s1 = TP.sE + 3;
    const sA = k === 0 ? s0 : R.len - s1, sB = k === 0 ? s1 : R.len - s0;
    const hA = hAt(sA), hB = hAt(sB), grad = (hB - hA) / (sB - sA);
    const tag = id.replace(/_strip$/, '').replace(/_/g, '') + k;
    let tmod;
    if (Math.abs(grad) < 0.004) {
      tmod = { id: 'tp_t_' + tag, kind: 'flatten', poly, level: r2((hA + hB) / 2), falloff: 8, abs: true, order: 0 };
    } else {
      // a slope polygon: `level` at the centroid (relative to y0, the frame's base), `slope` rising toward `hdg`
      // (degrees, 0 = +z, 90 = +x) - the strip's own direction and gradient there
      const c = C.PREMISES_GEN.polyCentroid(poly), sc = (c[0] - R.end0.x) * R.dx + (c[1] - R.end0.z) * R.dz;
      const hc = hA + grad * (sc - sA);
      tmod = { id: 'tp_t_' + tag, kind: 'ramp', poly, level: r2(hc - y0), slope: r3(grad), hdg: r2(Math.atan2(R.dx, R.dz) * 180 / Math.PI), falloff: 8, order: 0 };
    }
    out.terrain.push(tmod);
    out.surface.push({ id: 'tp_y_' + tag, poly, surface: +r.surface || 0 });
    const look = r.look && C.PREMISES_GEN.RUNWAY_LOOKS[r.look];
    if (look && look.cls && look.cls !== 'grass') out.material.push({ id: 'tp_m_' + tag, poly, look: r.look, band: r.band === undefined ? 1 : Math.min(+r.band || 1, 2), yaw: r3(r.hdg), z: 1 });
    // the wing's sweep, clear of trees and plots: the pad grown by the widest half-span + 3 m
    const g = WIDEST_HALF + 3, E = k === 0 ? R.end0 : R.end1, u = k === 0 ? [R.dx, R.dz] : [-R.dx, -R.dz], n = [R.nx * best.side, R.nz * best.side];
    const Pw = (s, l) => [r2(E.x + u[0] * s + n[0] * l), r2(E.z + u[1] * s + n[1] * l)];
    out.exclude.push({ id: 'tp_x_' + tag, poly: [Pw(-g, R.wid / 2 - 1), Pw(-g, TP.w + 3 + g), Pw(TP.sE - TP.r + g, TP.w + 3 + g), Pw(TP.sE + 3 + g, R.wid / 2 - 1)], what: ['trees', 'plots'] });
  }
  r.turn = turn;
}

// ---- the mine's apron (G1968): the stand's pad and the south bay's east half as one gravel apron
{
  const mine = REC.layers;
  const pad = mine.surface.find(e => e.id === 'mn_y_stand'), bay = mine.surface.find(e => e.id === 'mn_y_turn_s');
  const a = W.aerodromes.find(q => q.id === 'mn_strip'), R = C.siteRunway(a);
  const sl = (x, z) => [(x - R.end0.x) * R.dx + (z - R.end0.z) * R.dz, (x - R.cx) * R.nx + (z - R.cz) * R.nz];
  const Pw = (s, l) => [r2(R.end0.x + R.dx * s + R.nx * l), r2(R.end0.z + R.dz * s + R.nz * l)];
  const pts = pad.poly.concat(bay.poly).map(q => sl(q[0], q[1]));
  const s0 = Math.min(...pts.map(q => q[0])), s1 = Math.max(...pad.poly.map(q => sl(q[0], q[1])[0]));
  const lMax = Math.max(...pad.poly.map(q => sl(q[0], q[1])[1]));
  // ...held 1.5 m off every footprint (the air taxi office and the fuel shed stand east of the stand pad): in two bands
  // along the street (by the stand, where the parked aeroplane's tail swings, and north of it), each band's far edge
  // comes in until no point of it is within 1.5 m of a solid thing - a stepped apron, the step 16 m from the end
  const clearAt = (sa, sb, l) => { let m = Infinity; for (let q = sa; q <= sb; q += 1) for (let w = R.wid / 2; w <= l; w += 1) { const p = Pw(q, w), n = IX.nearest(p[0], p[1], 10); if (n) m = Math.min(m, n.d); } return m; };
  const edge = (sa, sb) => { let l = lMax; while (l > 20 && clearAt(sa, sb, l) < 1.5) l -= 0.5; return l; };
  const sStep = 16, lA = edge(s0, sStep), lB = edge(sStep, s1);
  // from the strip's east edge (1 m over it) to the band's edge, from the bay's south edge to the stand pad's north
  const poly = [Pw(s0, R.wid / 2 - 1), Pw(s0, lA), Pw(sStep, lA), Pw(sStep, lB), Pw(s1, lB), Pw(s1, R.wid / 2 - 1)];
  // the ground under it: the street's own level (the stand pad's and the bays' flatten, 346.8)
  const lvl = (mine.terrain.find(e => e.id === 'mn_t_stand') || {}).level;
  out.mine = [
    { layer: 'terrain', e: { id: 'mn_t_apron', kind: 'flatten', poly, level: lvl, falloff: 10, abs: true, order: 0 } },
    { layer: 'surface', e: { id: 'mn_y_apron', poly, surface: 6, apron: true } },
    { layer: 'material', e: { id: 'mn_m_apron', poly, look: 'gravel', band: 1, yaw: r3(a.hdg), z: 1 } },
  ];
  report.push('mn_strip apron: s ' + s0.toFixed(1) + '..' + s1.toFixed(1) + ' m from the south end, ' + (R.wid / 2 - 1) + '..' + lA.toFixed(1) + ' m east of the centreline to ' + sStep + ' m, ..' + lB.toFixed(1) + ' m past it, level ' + lvl);
}

const fans = {};
for (const id of Object.keys(FANS)) {
  const F = FANS[id], r = recOf(F.strip), d = [Math.cos(r.hdg), Math.sin(r.hdg)], n = [-d[1], d[0]];
  fans[id] = { owner: F.owner, poly: F.sl.map(q => [r2(r.c[0] + d[0] * q[0] + n[0] * q[1]), r2(r.c[1] + d[1] * q[0] + n[1] * q[1])]) };
  report.push(id + ': ' + F.sl.map(q => q.join('/')).join(' '));
}
for (const l of report) console.log('  ' + l);
if (DRY) process.exit(0);

// ---- write. The JSON goes through Python's json (load / dump, indent 1): it is what jolene_author.py writes, it keeps
// `7278.0` a float where JavaScript's stringify would print `7278` - the fixture and the parts move only where this
// tool moves them
const plan = { rev: REV, fans, parts: PARTS, fx: FX, author: AUTHOR, owners: {}, authorRunways: {}, mine: out.mine,
  pads: { part: 'turn pads', prefix: 'tp_',
    note: 'THE TURN PADS (ISLAND-TOUR G1966): the ground of every strip end that declares a `turn` (the runway record, contract v1.32) - the U-turn the derived pattern draws on it (25_airfield.js turnPadNodes): a flatten or a slope on the strip\'s own height, a surface of the strip\'s class, its gravel look, the wing\'s sweep kept clear of trees and plots. Written by tools/turn_pads.js (with the fixture); edit the plan there, not here.',
    layers: { terrain: out.terrain, surface: out.surface, material: out.material, exclude: out.exclude } },
  runways: {} };
for (const id of Object.keys(RUNWAYS)) {
  const P = RUNWAYS[id], r = recOf(id), f = {};
  if (P.departure !== undefined) f.departure = P.departure;
  if (r.turn) f.turn = r.turn;
  plan.runways[id] = f;
  if (P.owner === 'author') plan.authorRunways[id] = f; else (plan.owners[P.owner] = plan.owners[P.owner] || []).push(id);
}
const PY = String.raw`
import json, os, re, sys
P = json.load(sys.stdin)
def load(f): return json.load(open(f, encoding='utf8'))
def dump(f, o, ea): open(f, 'w', encoding='utf8', newline='\n').write(json.dumps(o, indent=1, ensure_ascii=ea) + '\n')
DROP = re.compile(r'^(tp_|mn_(y|m|t)_apron)')
# the owners' runways (and the mine's apron in its own part)
for f, ids in P['owners'].items():
    fp = os.path.join(P['parts'], f); o = load(fp)
    for r in o['layers']['runways']:
        if r['id'] in ids: r.update(P['runways'][r['id']])
    for e in o['layers'].get('exclude', []):
        if e['id'] in P['fans'] and P['fans'][e['id']]['owner'] == f: e['poly'] = P['fans'][e['id']]['poly']
    if f == 'mn_mine.json':
        for k in ('terrain', 'surface', 'material'): o['layers'][k] = [e for e in o['layers'].get(k, []) if not DROP.match(e['id'])]
        for m in P['mine']: o['layers'].setdefault(m['layer'], []).append(m['e'])
    dump(fp, o, False)
# the field's literals (jolene_author.py): the runway dict's 'approach': N, is followed by the fields
src = open(P['author'], encoding='utf8').read()
def py(v): return repr(v).replace("'", "'")
for rid, f in P['authorRunways'].items():
    pat = re.compile(r"(\{'id': '" + rid + r"',[\s\S]*?'approach': \d,)( 'departure': [^,]+,)?( 'turn': \[[^\]]*\],)?")
    if not pat.search(src): sys.exit('turn_pads: no literal for ' + rid)
    add = ''.join(" '" + k + "': " + repr(v).replace('None', 'None') + ',' for k, v in f.items())
    src = pat.sub(lambda m: m.group(1) + add, src, count=1)
src = re.sub(r"'rev': \d+,( *# .*?)(; 24 ISLAND-TOUR.*)?$", lambda m: "'rev': " + str(P['rev']) + ',' + m.group(1) + "; 24 ISLAND-TOUR (G1966-G1968, 2026-10-05): the turn pads (jolene_parts/turnpads.json, the strips' turn), Tamgas Hill and Jumbo Mine left one way (departure), the mine's apron (jolene_parts/mn_mine.json)", src, count=1, flags=re.M)
open(P['author'], 'w', encoding='utf8', newline='\n').write(src)
# the pads' part
dump(os.path.join(P['parts'], 'turnpads.json'), P['pads'], False)
# the fixture, in the merge's order (the field, the .py parts, the .json parts alphabetically)
names = sorted(f for f in os.listdir(P['parts']) if f.endswith('.py') and not f.startswith('_')) + sorted(f for f in os.listdir(P['parts']) if f.endswith('.json'))
pref = []
for f in names:
    t = open(os.path.join(P['parts'], f), encoding='utf8').read()
    if f.endswith('.json'): pref.append(json.loads(t).get('prefix'))
    else:
        m = re.search(r"PREFIX\s*=\s*['\"]([^'\"]+)['\"]", t); pref.append(m.group(1) if m else None)
def rank(i):
    for k, p in enumerate(pref):
        if p and str(i).startswith(p): return k + 1
    return 0
rec = load(P['fx'])
for k in rec['layers']: rec['layers'][k] = [e for e in rec['layers'][k] if not DROP.match(str(e.get('id', '')))]
for r in rec['layers']['runways']:
    if r['id'] in P['runways']: r.update(P['runways'][r['id']])
for e in rec['layers']['exclude']:
    if e.get('id') in P['fans']: e['poly'] = P['fans'][e['id']]['poly']
def put(layer, e):
    rows = rec['layers'][layer]; rk = rank(e['id']); at = len(rows)
    for i, q in enumerate(rows):
        if rank(q.get('id')) > rk: at = i; break
    rows.insert(at, e)
for m in P['mine']: put(m['layer'], m['e'])
for k in ('terrain', 'surface', 'material', 'exclude'):
    for e in P['pads']['layers'][k]: put(k, e)
rec['rev'] = P['rev']
dump(P['fx'], rec, True)
print('turn_pads: wrote %d pads, the mine\'s apron, rev %d' % (len(P['pads']['layers']['terrain']), P['rev']))
`;
const res = require('child_process').spawnSync(process.platform === 'win32' ? 'py' : 'python3', (process.platform === 'win32' ? ['-3'] : []).concat(['-c', PY]), { input: JSON.stringify(plan), encoding: 'utf8' });
process.stdout.write(res.stdout || ''); process.stderr.write(res.stderr || '');
process.exit(res.status || 0);
