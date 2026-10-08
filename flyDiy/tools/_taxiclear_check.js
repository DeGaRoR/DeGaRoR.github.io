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
//     check in 3 can see the fault it guards (G772: HOME's authored ways now
//     thread the apron's gap, so the calibration replays the pre-G772 way)
//   5 FLOWN: both aeroplanes flown by THE PILOT (43_pilot.js) from HOME's
//     stand until they are 30 m past the farthest parked aeroplane: the wing
//     (the CG +- the half-span along the right axis, every 1/60 s) never
//     comes within 0.5 m of a footprint, and the taxi reaches that point
// MILL-TAXI (G1925-G1929, the user 2026-10-05: "In the old mill, the taxi circuit is too close from buildings, and an
// attempt to launch from there hits a building on the right"): 1-5 held the ways out off the PARKED AEROPLANES only;
// nothing held a route off a house. 6-9 are the other half - every solid thing the game registers (tools/_taxiclear_lib.js:
// the cooked places' obstacle grids, their props, cars and objects, the premises' trunks; the analytic world's houses):
//   6 THE CENSUS, Jolene: every stand x every validated build (the stock build, the aluminium C172 - 11 m, the widest -
//     and the user's Cub, builds/cub_2026-09-20_corrected.json), each on its own pattern: the stand, every route the
//     pattern hands the pilot (out[0], out[1], back[0], back[1], sampled as THE PILOT's path) keeps the build's half-span
//     + MARGIN (3 m) off every footprint, and the parked box (the build's own nodes at the stand) MARGIN; the roll printed
//   7 THE CENSUS, the procedural world: seed 0 (the game's) and the seeds that had a house on a strip (1, 6, 12, 42)
//   8 CALIBRATION: Jumbo Mine Street's pattern as it was (the lane up the street, the U-turn into the clinic, the stand
//     by the air taxi office) reads as the faults the user flew into - the mill inside 2 m of the way out's centreline
//   9 FLOWN: the Cub and the C172 by THE PILOT from the mill's stand to 30 m up, the obstacles IN the world: no node
//     inside an obstacle, no trunk hit, no crash, the wing's plan clearance to every footprint >= 1.5 m
//  10 THE FLEET'S TIE-DOWN SPOTS (G2223): every Jolene runway's spots (25_airfield.js fleetSpots) for every archetype
//     footprint that fits: in the field, flat, dry / afloat, 3 m off solids, every validated build's routes half + 3 m off,
//     no overlap; deterministic; HOME's painted stands first; a calibration (a box on the stand, on the mill: faults)
// ~3-5 min (the island world, the cook read twice, four taxis); 11 (G2490) ~20 min more of one core - in 4 shards ~7 min wall.
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
// G2490 (ALTIPORT-TAXI): THE GATE IN SHARDS (run_gates `shards: 3`). Sections 1-10 are ONE heavy job (tools/_shard.js take:
// shard 0); 11's plans and flights are jobs of their own, dealt round-robin. Unsharded, everything runs here, as before
const SHD = require(path.join(T, '_shard.js'));
const BASE = SHD.take();

// 1 the footprint table against the archetypes' own nodes
if (BASE) {
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
if (BASE) {
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
if (BASE) {   // sections 3-5 (G2490: shard 0)
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
      // G772: HOME's ways out were re-authored through the apron's gap (taxiOut for 13, taxiOut1 for 31), so a
      // narrow wing needs no bend and a wide one a small one: the way is CLEAR, as authored or as bent
      check(!!(P.clearance && P.clearance.ok), '3 ' + B.name + ' HOME way out is clear (as authored or bent)', JSON.stringify(P.clearance));
      // ...and the calibration replays the way that was authored before G772 (the straight leg to the NE arm's
      // mouth, G710's own fault case), unbent: it must still read as the fault check 3 guards
      const s0 = Object.assign({}, s, { taxiOut: [[-135, 655], [-133, 590], [-120, 500], [-92, 442]] }); delete s0.parked; delete s0.taxiOut1;
      const P0 = C.sitePattern(a, s0, { half });
      // (G1926: o1 stands 2.5 m further west, off the authored ways by the census's half-span + 3 m: the old way is
      // measured against that law, half + 3 m, and still reads as the fault)
      const need4 = half + 3;
      const w0 = worstOf(P0, s.parked, P0.routes.out[0], need4);
      check(!!w0 && w0.d < -1 && w0.id === 'o1', '4 ' + B.name + ' calibration: the unbent HOME way passes inside the Cub o1\'s clearance',
            w0 ? w0.id + ' at ' + (w0.d + need4).toFixed(2) + ' m of ' + need4.toFixed(1) : 'nothing near');
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
}   // (BASE: sections 3-5)

// 6-9 MILL-TAXI (G1925-G1929): every stand and route against every solid thing
const L = require(path.join(T, '_taxiclear_lib.js'));
const VB = L.BUILDS.map(B => { const def = C.buildGen(PT.specOf(B.key).spec); return Object.assign({}, B, { def, dims: L.buildDims(C, def) }); });
check(Math.max(...VB.map(B => B.dims.half)) >= 5.49, '6 the widest validated build is the 11 m C172', VB.map(B => B.name + ' ' + (2 * B.dims.half).toFixed(2)).join(', '));
const SH = L.islandObstacles(C, 'jolene', 'town').concat(L.treeTrunks(WI)).concat(L.registryObstacles(WI));
const IX = L.index(SH);
const tags = {}; for (const q of SH) tags[q.tag] = (tags[q.tag] || 0) + 1;
check(tags.item > 50 && tags.house > 100 && tags.prop > 1000 && tags.tree > 1000 && tags.aircraft >= 5, '6 the obstacle set is the shipped one', Object.entries(tags).map(e => e.join(' ')).join(', '));
if (BASE) {   // sections 6-10 (G2490: shard 0)
const showRows = (rows, label) => {
  let n = 0;
  for (const r of rows) {
    if (r.need === null) { if (SHOW) console.log('       ' + label + ' ' + r.id + ' ' + r.build + ' ' + r.what + ' ' + r.d.toFixed(2) + ' m (' + r.near + ')'); continue; }
    n++;
    check(r.ok, label + ' ' + r.id + ' ' + r.build + ' ' + r.what + ' keeps ' + r.need.toFixed(2) + ' m', r.d.toFixed(2) + ' m to ' + r.near + ' at (' + r.at[0].toFixed(1) + ', ' + r.at[1].toFixed(1) + ')');
  }
  return n;
};
{
  const rows = L.census(C, WI, IX, VB);
  const n = showRows(rows, '6 Jolene');
  const ids = new Set(rows.map(r => r.id));
  check(n >= 60 && ['HOME', 'w3', 'mn_strip', 'nv_strip', 'tw_ski'].every(id => ids.has(id)), '6 every Jolene stand was censused', n + ' rows, ' + Array.from(ids).join(' '));
  const mn = rows.filter(r => r.id === 'mn_strip' && r.need !== null).reduce((m, r) => Math.min(m, r.d - r.need), Infinity);
  console.log('  Jolene: ' + n + ' stand / parked / route rows, Jumbo Mine Street\'s tightest ' + mn.toFixed(2) + ' m over its need');
}
for (const seed of [0, 1, 6, 12, 42]) {
  const W = C.makeWorld(seed), I = L.index(L.registryObstacles(W));
  const rows = L.census(C, W, I, VB.filter(B => B.dims.half === Math.max(...VB.map(b => b.dims.half))));
  const n = showRows(rows, '7 seed ' + seed);
  check(n >= 20, '7 seed ' + seed + ' censused', n + ' rows, ' + W.obstacles.count + ' houses');
  const roll = rows.filter(r => r.need === null).reduce((m, r) => Math.min(m, r.d), Infinity);
  check(roll >= 8.5, '7 seed ' + seed + ' no strip\'s roll within 8.5 m of a house', roll.toFixed(2) + ' m');
}
// 8 calibration: the mill's pattern before G1925 (the nodes it moved, as they were)
{
  const a = WI.aerodromes.find(q => q.id === 'mn_strip'), s = C.siteOf('mn_strip');
  const P0 = JSON.parse(JSON.stringify(C.sitePattern(a, s, {})));
  const by = {}; for (const q of P0.nodes) by[q.id] = q;
  Object.assign(by.stand, { x: 7281.85, z: -15319.76 }); Object.assign(by.c1, { x: 7263.829, z: -15342.268 });
  Object.assign(by.l0a, { x: 7270.84, z: -15313.775 }); Object.assign(by.l0b, { x: 7248.923, z: -15311.856 }); Object.assign(by.l0c, { x: 7247.005, z: -15333.773 }); Object.assign(by.d0, { x: 7257.092, z: -15344.694 });
  P0.routes = { out: [['stand', 'tx0', 'c0', 'hold0'], ['stand', 'tx0', 'c1', 'l1a', 'l1b', 'l1c', 'd1', 'hold1']], back: [['l0a', 'l0b', 'l0c', 'd0', 'hold0'], ['l1a', 'l1b', 'l1c', 'd1', 'hold1']] };
  const r = L.censusSite(C, IX, a, P0, 8.5), o1 = r.routes.find(q => q.name === 'out[1]'), b0 = r.routes.find(q => q.name === 'back[0]');
  check(o1.worst.d < 2 && /mill$/.test(o1.worst.what.id), '8 calibration: the old way up the street passes the mill inside 2 m', o1.worst.d.toFixed(2) + ' m to ' + L.fmtWhat(o1.worst.what));
  check(b0.worst.d < 2 && /clinic$/.test(b0.worst.what.id), '8 calibration: the old south U-turn passes the clinic inside 2 m', b0.worst.d.toFixed(2) + ' m to ' + L.fmtWhat(b0.worst.what));
  check(r.stand.d < 8.5 && /airtaxi$/.test(r.stand.what.id), '8 calibration: the old stand stood inside 8.5 m of the air taxi office', r.stand.d.toFixed(2) + ' m');
}
// 9 flown from the mill
{
  const a = WI.aerodromes.find(q => q.id === 'mn_strip'), s = C.siteOf('mn_strip');
  const put = L.intoWorld(C, WI, SH, a.x, a.z, 600);
  check(put.obstacles > 150 && WI.obstacles.count >= put.obstacles, '9 the mill\'s obstacles are in the world', put.obstacles + ' obstacles, ' + put.trunks + ' trunks');
  for (const B of VB.filter(b => b.key !== 'stock')) {
    const F = L.flyOut(C, WI, IX, B.def, a, s);
    check(F.air, '9 ' + B.name + ' taxied from the mill and took off', 't ' + F.t.toFixed(0) + ' s, ' + F.phases.join('>'));
    check(F.contacts === 0 && F.trunkHits === 0 && !F.crashed, '9 ' + B.name + ' touched nothing', F.contacts + ' node contacts' + (F.cWhat ? ' (' + F.cWhat + ')' : '') + ', ' + F.trunkHits + ' trunk hits, crashed ' + F.crashed);
    check(F.minWing >= 1.5, '9 ' + B.name + ' wing kept 1.5 m off every footprint', F.minWing.toFixed(2) + ' m, ' + F.at);
    console.log('  ' + B.name.padEnd(15) + ' span ' + F.span.toFixed(1) + ' m from the mill: ' + (F.air ? 'airborne' : 'NOT airborne') + ' at ' + F.t.toFixed(0) + ' s, the wing ' + F.minWing.toFixed(2) + ' m off the nearest footprint (' + F.at + '), ' + F.contacts + ' contacts, ' + F.trunkHits + ' trunk hits');
  }
}

// 10 THE FLEET'S TIE-DOWN SPOTS (G2223, FLEET-PROPS A): every Jolene runway's ordered spots (25_airfield.js fleetSpots:
// the painted stands first, then the apron ring), held by spotCensus to the census's rules, independently of the planner:
// for every spot and every archetype footprint that fits it - inside the field, flat, dry (afloat on the water fields),
// 3 m off every solid thing, every validated build's routes its half-span + 3 m off - and no two spots overlapping; the
// list the same on a second call; HOME's first spots its painted stands; a CALIBRATION: the stand's own box and a box
// on the mill read as faults
{
  const foots = {}; for (const k in C.GP_PARKED_FOOT) { const f = C.GP_PARKED_FOOT[k]; foots[k] = { half: f[0], fwd: f[1], aft: f[2] }; }
  foots.default = { half: C.GP_PARKED_DEFAULT[0], fwd: C.GP_PARKED_DEFAULT[1], aft: C.GP_PARKED_DEFAULT[2] };
  const t0 = Date.now(), SC = L.spotCensus(C, WI, IX, VB, foots);
  check(WI.aerodromes.length === 8 && SC.per.length === 8, '10 Jolene\'s eight runways', SC.per.map(p => p.id).join(' '));
  for (const p of SC.per) {
    // a field with no room stands no spot (never a bad one): every candidate it had was refused by a rule
    const refused = Object.values(p.why).reduce((a, b) => a + b, 0);
    check(p.n >= 1 || refused >= 20, '10 ' + p.id + (p.n ? ' has tie-down spots' : ' has no room: every candidate refused by the rules'), p.n + ' (' + p.kinds + '); refused: ' + JSON.stringify(p.why));
    check(p.same, '10 ' + p.id + ' spots are deterministic (the same list on a second call)');
  }
  check(SC.per.filter(p => p.n >= 1).length >= 6 && SC.per.reduce((a, p) => a + p.n, 0) >= 50, '10 the fleet has room on six or more of the eight runways', SC.per.filter(p => p.n >= 1).length + ' runways, ' + SC.per.reduce((a, p) => a + p.n, 0) + ' spots');
  const home = SC.per.find(p => p.id === 'HOME');
  check(!!home && home.n >= 8 && /^s+a/.test(home.kinds) && home.spots[0].id.indexOf('stand:af_m_park:') === 0, '10 HOME: its painted stands (af_m_park) first, then the apron round the stand', home ? home.n + ' ' + home.kinds + ' ' + home.spots.slice(0, 3).map(q => q.id).join(' ') : 'none');
  let n = 0;
  for (const r of SC.rows) { n++; if (!r.ok || SHOW) check(r.ok, '10 ' + r.id + ' ' + r.spot + ' [' + r.foot + '] ' + r.what, (r.d != null ? r.d.toFixed(2) + ' m' + (r.need != null ? ' of ' + r.need.toFixed(2) : '') : '') + (r.near ? ' (' + r.near + ')' : '')); }
  check(n > 500 && SC.rows.every(r => r.ok), '10 every spot x every archetype footprint that fits: in the field, flat, dry / afloat, clear; no overlap', n + ' rows, ' + SC.rows.filter(r => !r.ok).length + ' failing');
  // calibration: the spot rules see a fault - a box on HOME's stand (its routes start there), a box on the mill
  const a = WI.aerodromes.find(q => q.id === 'HOME'), s = C.siteOf('HOME'), inp = L.spotInputs(WI, IX, SC.pave);
  const st = s.stand, f0 = foots.c172, bx = { x: st.x, z: st.z, ry: 0, half: f0.half, fwd: f0.fwd, aft: f0.aft };
  const P = C.sitePattern(a, s, { half: 5.5 }), pts = L.routesOf(C, P).reduce((l, r) => l.concat(r.pts), []);
  const wr = pts.reduce((m, q) => Math.min(m, C.fleetSpotDist(bx, q.x, q.z)), Infinity);
  check(wr < 8.5, '10 calibration: a box on HOME\'s stand reads inside its routes\' 8.5 m', wr.toFixed(2) + ' m');
  const mill = SH.find(q => /mill$/.test(q.id));
  const bm = mill ? { x: mill.x, z: mill.z, ry: 0, half: f0.half, fwd: f0.fwd, aft: f0.aft } : null;
  const wm = bm ? C.fleetSpotPts(bm, 0.25, true).reduce((m, q) => Math.min(m, inp.solid(q[0], q[1], 30)), Infinity) : null;
  check(bm && wm < 3, '10 calibration: a box on the mill reads inside 3 m of a solid thing', bm ? wm.toFixed(2) + ' m' : 'no mill');
  console.log('  10 the fleet\'s spots: ' + SC.per.map(p => p.id + ' ' + p.n + ' (' + p.kinds + ')').join(', ') + '; ' + n + ' rows in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
}
}   // (BASE: sections 6-10)

// 11 THE TURN-AROUND FROM WHERE A LANDING STOPPED (G2490, ALTIPORT-TAXI). The game, 8 Oct (train 40, the user's Cub, the
// 8 kt day, damage on): landed uphill at the Skyline altiport, the slope roll-on stopped it on the level part 33 m from the
// top end - 6 m short of the U-turn the pattern draws there - and the route back down, joined from that pose (a 2.7 m
// fillet for wheels that steer 11.3 m), ran the Cub 8 m wide into the tram station's corner: 'a fus member broke', 22 s
// into the leg. 6 holds the pattern's routes from their own first node, on the drawn centreline; nothing held the join
// from where a landing stops, nor the swing of a bend the wheels cannot steer. 43_pilot.js turnAtPose (G2490) sweeps a
// turn-around against the solid things the world holds and turns on the spot where the wings clear. Held here:
//   a PLANNED: every Jolene land strip x the validated land builds (the user's Cub, the Jodel, the metal Cessna) x poses
//     on the centreline facing either end 15-150 m from it, the island's solid things in the world: the plan DEPART makes
//     (tools/_taxiclear_lib.js planAt) keeps, on the census's own footprints - its CG track the half-span + MARGIN off
//     every footprint (the drawn line); a route it keeps, its bends tighter than the wheels widened by the shortfall (the
//     driven line); a turn on the spot, its disc (the airframe's reach + the CG's walk) MARGIN off
//   b CALIBRATION: the altiport's pose with the pilot blind to the obstacles (the planner as it was) plans the route the
//     game flew - its drawn line passes 6's rule, its driven line comes inside the tram station's margin
//   c FLOWN: the altiport's apron after the slope roll-on (the game's stop, 8 Oct: (335.7, -7843.8), the nose up the
//     strip) and Jumbo Mine's street 45 m from its south end: the three builds by THE PILOT (the chained leg the page
//     gives - departFrom, no site) - off the altiport to 30 m up, at Jumbo Mine to the take-off run - no node inside an
//     obstacle, no trunk, no crash, the wing 1.5 m off every footprint (9's bound); and the calibration flown: the Cub at
//     the altiport with the pilot blind goes into the station
//   (run_gates `shards: 4`: sections 1-10 one job in shard 0, each plan census, the calibration and each flight a job)
{
  const t0 = Date.now();
  const LB = [{ key: path.join(T, '..', 'builds', 'cub_2026-09-20_corrected.json'), name: "the user's Cub" },
              { key: path.join(T, '..', 'builds', 'jodel_2026-09-20_corrected.json'), name: 'the Jodel' },
              { key: METAL, name: 'the metal Cessna' }]
    .map(B => { const sp = PT.specOf(B.key).spec; return Object.assign({}, B, { def: C.buildGen(C.genMigrateSpec ? C.genMigrateSpec(sp) : sp) }); });
  // the solid things near every land strip into the world (9, in shard 0, put the mill's: the rest, and every strip's
  // trunks again - intoWorld's trunks are one set)
  const mn = WI.aerodromes.find(q => q.id === 'mn_strip');
  const land = WI.aerodromes.filter(q => !q.water && q.kind !== 'water');
  const keep = SH.filter(s => land.some(q => Math.hypot(s.x - q.x, s.z - q.z) - (s.r || 0) < 700 + q.len / 2) && (!BASE || s.tag === 'tree' || Math.hypot(s.x - mn.x, s.z - mn.z) - (s.r || 0) > 600));
  const put = L.intoWorld(C, WI, keep, 0, 0, Infinity);
  check(WI.obstacles.count > 300, '11 every land strip\'s solid things are in the world', WI.obstacles.count + ' obstacles, ' + put.trunks + ' trunks');
  const fmt = q => (isFinite(q.d) ? q.d.toFixed(2) + ' m (' + q.what + ')' : 'nothing near');
  // a: the census of the plans (a job per build)
  for (const B of LB) {
    if (!SHD.take()) continue;
    let n = 0, worst = null;
    for (const a of land) {
      const b = land.find(q => q.id !== a.id), ux = Math.cos(a.hdg), uz = Math.sin(a.hdg);
      for (const sg of [1, -1]) for (const dEnd of [15, 25, 33, 45, 60, 90, 150]) {
        if (dEnd > a.len - 20) continue;
        const s = sg * (a.len / 2 - dEnd), pose = { x: a.x + ux * s, z: a.z + uz * s, hdg: Math.atan2(sg * uz, sg * ux) };
        const r = L.planAt(C, WI, IX, B.def, a, b, pose);
        const where = a.id + ' ' + (sg > 0 ? 'end1' : 'end0') + ' -' + dEnd + ' m ' + B.name;
        n++;
        const m = Math.min(r.drawn.d - L.MARGIN, r.driven.d, r.disc ? r.disc.d - L.MARGIN : Infinity);
        if (!worst || m < worst.m) worst = { m, where };
        const det = r.phase + ' ' + (r.turn ? 'turn' + (r.roll ? ' after ' + r.roll.toFixed(0) + ' m' : ' here') + ': ' : '') + r.ids + ' | drawn ' + fmt(r.drawn) + ', driven ' + fmt(r.driven) + (r.disc ? ', the turn\'s disc ' + fmt(r.disc) : '');
        // (the driven line's widening is the wheels' whole shortfall - an upper bound on the swing: held off the footprint)
        check(r.drawn.d >= L.MARGIN - 1e-9 && r.driven.d >= 0 && (!r.disc || r.disc.d >= L.MARGIN - 1e-9), '11a ' + where + ' the turn-around: drawn and turned ' + L.MARGIN + ' m off, driven off every footprint', det);
      }
    }
    check(n >= 70, '11a ' + B.name + ': every land strip x pose planned', n + ' plans; the tightest ' + (worst ? worst.m.toFixed(2) + ' m over its need at ' + worst.where : '-'));
    console.log('  11a ' + B.name.padEnd(16) + ' ' + n + ' turn-around plans, the tightest ' + (worst ? worst.m.toFixed(2) + ' m over its need (' + worst.where + ')' : '-'));
  }
  // b: the calibration - the altiport's game pose, the planner blind
  const tw = WI.aerodromes.find(q => q.id === 'tw_ski'), nv = WI.aerodromes.find(q => q.id === 'nv_strip');
  const POSE = { x: 335.69, z: -7843.75, hdg: -1.05 };
  if (SHD.take()) {
    const r0 = L.planAt(C, WI, IX, LB[0].def, tw, nv, POSE, { blindPilot: true }), r1 = L.planAt(C, WI, IX, LB[0].def, tw, nv, POSE);
    check(!r0.turn && r0.drawn.d >= L.MARGIN && r0.driven.d < 0 && /station$/.test(r0.driven.what || ''), '11b calibration: the altiport pose, the pilot blind: the route the game flew - drawn ' + L.MARGIN + ' m clear, driven into the tram station',
      r0.ids + ' | drawn ' + fmt(r0.drawn) + ', driven ' + fmt(r0.driven));
    check(r1.turn && !r1.roll, '11b the altiport pose, the pilot seeing: the turn on the spot there', r1.ids + ' | disc ' + (r1.disc ? fmt(r1.disc) : '-'));
  }
  // c: flown (a job a flight)
  const flights = [{ a: tw, b: nv, pose: POSE, what: 'the altiport apron after the slope roll-on' }];
  { const ux = Math.cos(mn.hdg), uz = Math.sin(mn.hdg), s = -(mn.len / 2 - 45); flights.push({ a: mn, b: WI.aerodromes.find(q => q.id === 'w2'), pose: { x: mn.x + ux * s, z: mn.z + uz * s, hdg: Math.atan2(-uz, -ux) }, what: 'Jumbo Mine\'s street 45 m from its south end' }); }
  for (const Fl of flights) for (const B of LB) {
    if (!SHD.take()) continue;
    const F = L.flyTurn(C, WI, IX, B.def, Fl.a, Fl.b, Fl.pose, { tMax: 150 });
    const tag = '11c ' + B.name + ' from ' + Fl.what;
    // the altiport's 380 m is left by every one; Jumbo Mine's 250 m is held to its taxi (the roll begun) - the take-off
    // there is the roll's own call (G531: a short field's reserve), printed
    if (Fl.a === tw) check(F.air, tag + ': airborne', 't ' + F.t.toFixed(0) + ' s, ' + F.phases.join('>'));
    else check(F.phases.includes('ROLL'), tag + ': taxied to the take-off run', 't ' + F.t.toFixed(0) + ' s, ' + F.phases.join('>') + (F.air ? ', airborne' : ', ' + (F.verdicts.find(v => /reject|abort|declin/i.test(v)) || 'not airborne')));
    check(F.contacts === 0 && F.trunkHits === 0 && !F.crashed, tag + ': touched nothing', F.contacts + ' node contacts' + (F.cWhat ? ' (' + F.cWhat + ')' : '') + ', ' + F.trunkHits + ' trunk hits, crashed ' + F.crashed);
    check(F.minWing >= 1.5, tag + ': the wing 1.5 m off every footprint', F.minWing.toFixed(2) + ' m, ' + F.at);
    console.log('  11c ' + B.name.padEnd(16) + ' from ' + Fl.what + ': ' + (F.air ? 'airborne' : 'NOT airborne') + ' at ' + F.t.toFixed(0) + ' s, the wing ' + F.minWing.toFixed(2) + ' m off (' + F.at + '), ' + F.contacts + ' contacts | ' + F.verdicts.filter(v => /pivot|taxi-clearance/.test(v)).join('; '));
  }
  if (SHD.take()) {
    const F = L.flyTurn(C, WI, IX, LB[0].def, tw, nv, POSE, { blindPilot: true, tMax: 30 });
    check(F.contacts > 0 && /station/.test(F.cWhat || F.at || '') && F.minWing < 0.5, '11c calibration: the Cub from the altiport apron, the pilot blind: into the tram station', F.contacts + ' node contacts (' + F.cWhat + '), the wing ' + F.minWing.toFixed(2) + ' m (' + F.at + '), crashed ' + F.crashed);
  }
  console.log('  11 the turn-around' + SHD.tag + ' in ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
}

console.log('GATE TAXICLEAR: ' + (bad ? 'FAIL (' + bad + ')' : 'PASS'));
process.exit(bad ? 1 : 0);
