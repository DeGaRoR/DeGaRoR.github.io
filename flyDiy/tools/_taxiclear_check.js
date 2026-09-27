#!/usr/bin/env node
// GATE TAXICLEAR (G710) — THE WAY OUT CLEARS THE PARKED AEROPLANES.
//
// The Jolene playtest (2026-09-26): "the autopilot gets a collision with the
// wing of the cub when getting out of the hangar". HOME's stand (-154, 712),
// its first taxi point (-135, 655) and the Cub o1 parked at (-150, 670) nose
// to the hangar: flown before G710 the stock build's wingtip went 0.76 m INTO
// the Cub's footprint. The site's declared way out is now bent round every
// parked aeroplane when the pattern is built (25_airfield.js gpClearWay), for
// the span that taxis it.
//
//   node tools/_taxiclear_check.js            -> "GATE TAXICLEAR: PASS|FAIL"
//   node tools/_taxiclear_check.js --show     -> every line, passed ones too
//
// WHAT IT ASSERTS
//   1 the footprint table (GP_PARKED_FOOT) holds every archetype's own nodes
//     (designBake -> buildGen): half-span, nose + 0.3 m of propeller, tail -
//     a table that drifted under a real aeroplane would plan a way through it
//   2 every parked aeroplane on Jolene is known by key (arch:<k> in the table)
//     and within 400 m of a stand's way is on that site's `parked` list
//   3 PLANNED: every Jolene stand's routes out[0] and out[1], built for the
//     stock build's and the aluminium C172's span (bugReports/cessnaMetal (1)
//     .json = tools/fixtures/build_v10_cessnaMetal_2026-09-26.json), keep the
//     CG track GP_CLEAR (1.5 m) + the half-span off every footprint, and
//     sitePatternIssues is empty
//   4 CALIBRATION: the same site with its parked list withheld plans the old
//     straight way, and THAT route comes inside the Cub's clearance - the
//     check in 3 can see the fault it guards
//   5 FLOWN: both aeroplanes flown by THE PILOT (43_pilot.js) from HOME's
//     stand until they are 30 m past the farthest parked aeroplane: the wing
//     (the CG +- the half-span along the right axis, every 1/60 s) never
//     comes within 0.5 m of a footprint, and the taxi reaches that point
// ~1-2 min (the island world, two short taxis).
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname;
const PT = require(path.join(T, 'pilot_trace.js'));
PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const D = require(path.join(T, '_cage_design.js'));
const SHOW = process.argv.includes('--show');
let bad = 0;
const check = (ok, what, detail) => {
  if (!ok) bad++;
  if (!ok || SHOW) console.log((ok ? '  ok   ' : '  FAIL ') + what + (detail ? '  (' + detail + ')' : ''));
  return ok;
};
const FX = path.join(T, 'fixtures', 'island_jolene.json');
const METAL = path.join(T, 'fixtures', 'build_v10_cessnaMetal_2026-09-26.json');
const BUILDS = [{ key: 'stock', name: 'stock build' }, { key: METAL, name: 'aluminium C172' }];

// 1 the footprint table against the archetypes' own nodes
{
  let worst = null, n = 0;
  for (const a of D.ARCHETYPES) {
    if (D.archInactive(a)) continue;
    const F = C.GP_PARKED_FOOT[a.key];
    if (!check(!!F, '1 archetype ' + a.key + ' has a footprint row')) continue;
    const def = C.buildGen(D.designBake(a.sel, a.over));
    let x0 = Infinity, x1 = -Infinity, zm = 0;
    for (const nd of def.nodes) { x0 = Math.min(x0, nd.p[0]); x1 = Math.max(x1, nd.p[0]); zm = Math.max(zm, Math.abs(nd.p[2])); }
    const short = Math.max(zm - F[0], (-x0 + 0.3) - F[1], x1 - F[2]);
    if (!worst || short > worst.s) worst = { s: short, k: a.key };
    check(short <= 0.01, '1 ' + a.key + ' footprint holds its nodes', 'half ' + zm.toFixed(2) + '/' + F[0] + ', nose ' + (-x0 + 0.3).toFixed(2) + '/' + F[1] + ', tail ' + x1.toFixed(2) + '/' + F[2]);
    n++;
  }
  check(n >= 20, '1 the table was checked against ' + n + ' archetypes', worst ? 'tightest ' + worst.k + ' ' + worst.s.toFixed(2) + ' m' : '');
}

const txt = fs.readFileSync(FX, 'utf8'), REC = JSON.parse(txt);
const WI = IN.islandWorld('jolene', { premises: txt });
const planes = REC.layers.objects.filter(o => o.kind === 'aircraft');
const stands = WI.aerodromes.filter(a => { const s = C.siteOf(a.id); return s && s.stand && s.taxiOut; });

// 2 the parked records on the sites
{
  check(planes.length >= 5 && stands.length >= 4, '2 Jolene has its parked aeroplanes and its stands', planes.length + ' parked, ' + stands.length + ' stands');
  for (const o of planes) check(/^arch:/.test(o.key) && !!C.GP_PARKED_FOOT[o.key.slice(5)], '2 parked ' + o.id + ' (' + o.key + ') has a footprint of its own');
  for (const a of stands) {
    const s = C.siteOf(a.id), way = [[s.stand.x, s.stand.z]].concat(s.taxiOut);
    const want = planes.filter(o => way.some(q => Math.hypot(q[0] - o.x, q[1] - o.z) < 400)).map(o => o.id).sort();   // the frame is the identity on Jolene
    const have = (s.parked || []).map(p => p.id).sort();
    check(JSON.stringify(want) === JSON.stringify(have), '2 ' + a.id + ' carries its parked aeroplanes', have.join(' ') || 'none');
  }
}

// the samples of a route closer than `need` to a footprint: the worst, or null
const worstOf = (P, parked, ids, need) => {
  if (!ids || !parked || !parked.length) return null;
  const path_ = C.patternPath(P, ids, 1.0);
  let w = null;
  for (const q of path_.pts) for (const p of parked) { const d = C.gpParkedDist(p, q.x, q.z) - need; if (!w || d < w.d) w = { d, x: q.x, z: q.z, id: p.id }; }
  return w;
};
const spanOf = key => { const def = C.buildGen(PT.specOf(key).spec); return def.params.gen.span; };

// 3 planned, 4 calibration
for (const B of BUILDS) {
  const half = spanOf(B.key) / 2, need = half + C.GP_CLEAR;
  for (const a of stands) {
    const s = C.siteOf(a.id), P = C.sitePattern(a, s, { half });
    const iss = C.sitePatternIssues(P, a, s, 6, C.patternPath);
    check(!iss.length, '3 ' + B.name + ' ' + a.id + ' pattern sound', iss[0] || '');
    for (const T_ of [0, 1]) {
      const w = worstOf(P, s.parked, P.routes.out[T_], need);
      check(!w || w.d >= -0.05, '3 ' + B.name + ' ' + a.id + ' out[' + T_ + '] clears the parked aeroplanes by ' + need.toFixed(1) + ' m',
            w ? 'nearest ' + w.id + ' at ' + (w.d + need).toFixed(2) + ' m, (' + w.x.toFixed(1) + ', ' + w.z.toFixed(1) + ')' : 'none near');
    }
    if (a.id === 'HOME') {
      check(!!(P.clearance && P.clearance.ok && (P.clearance.added + P.clearance.moved) > 0), '3 ' + B.name + ' HOME way out was bent', JSON.stringify(P.clearance));
      const s0 = Object.assign({}, s); delete s0.parked;
      const P0 = C.sitePattern(a, s0, { half });
      const w0 = worstOf(P0, s.parked, P0.routes.out[0], need);
      check(!!w0 && w0.d < -1 && w0.id === 'o1', '4 ' + B.name + ' calibration: the unbent HOME way passes inside the Cub o1\'s clearance',
            w0 ? w0.id + ' at ' + (w0.d + need).toFixed(2) + ' m of ' + need.toFixed(1) : 'nothing near');
    }
  }
}

// 5 flown
for (const B of BUILDS) {
  const a = WI.aerodromes.find(q => q.id === 'HOME'), s = C.siteOf('HOME');
  const def = C.buildGen(PT.specOf(B.key).spec), half = def.params.gen.span / 2;
  const sim = C.makeSim(def, WI); sim.reset(0); if (sim.stance) sim.stance(); C.placeAtStand(sim, a, s.stand);
  for (let i = 0; i < 600; i++) sim.step(1 / 60);
  const ap = C.makePilot(sim, def, WI, { style: 'normal' }); ap.setRoute(a, a); ap.departFrom(a, a, s);
  const far = Math.max(...s.parked.map(p => Math.hypot(p.x - s.stand.x, p.z - s.stand.z))) + 30;
  let minD = Infinity, at = null, t = 0, past = false;
  for (let k = 0; k < 60 * 180 && !past; k++) {
    ap.update(1 / 60); sim.step(1 / 60); t += 1 / 60;
    const cg = sim.cgPos(), zR = sim.axes()[2], rl = Math.hypot(zR[0], zR[2]) || 1;
    for (let f = -1; f <= 1.0001; f += 0.1) {
      const x = cg[0] + zR[0] / rl * half * f, z = cg[2] + zR[2] / rl * half * f;
      for (const p of s.parked) { const d = C.gpParkedDist(p, x, z); if (d < minD) { minD = d; at = p.id + ' at (' + cg[0].toFixed(1) + ', ' + cg[2].toFixed(1) + ') in ' + ap.phase; } }
    }
    past = Math.hypot(cg[0] - s.stand.x, cg[2] - s.stand.z) > far;
  }
  check(past, '5 ' + B.name + ' taxied 30 m past the parked aeroplanes', 't ' + t.toFixed(0) + ' s, ' + ap.phase);
  check(minD >= 0.5, '5 ' + B.name + ' wingtip kept 0.5 m off every parked footprint', 'nearest ' + minD.toFixed(2) + ' m, ' + at);
  console.log('  ' + B.name.padEnd(15) + ' span ' + (2 * half).toFixed(1) + ' m: flown, nearest wing to a parked footprint ' + minD.toFixed(2) + ' m (' + at + ')');
}

console.log('GATE TAXICLEAR: ' + (bad ? 'FAIL (' + bad + ')' : 'PASS'));
process.exit(bad ? 1 : 0);
