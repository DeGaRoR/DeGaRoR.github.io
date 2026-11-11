#!/usr/bin/env node
// GATE DRIVE-TRIP (TOW-LAUNCH phase 1, 2026-11-11) - THE CAR DRIVES FROM HOME TO CEDAR HARBOUR, on Jolene as shipped.
// The user (11 Nov): "see a car DRIVE, in the game, from HOME to Metlakatla" (Cedar Harbour, 01_names.js). The vehicle
// (src/vehicle/: the shell, the driver) on the island's own roads - the premises' road graph (27_premises O.roadGraph)
// through the island adapter (src/vehicle/vehicle_island.js) - with the user's MVP (futureDesigns/GROUND-VEHICLE-2026-10.md
// §0): a long drive, a new destination at any time (the flight's To), proper U-turns, no manual take-over.
//   GRAPH  the island's roads as the driver's graph: the drawn crossings joined vehicle-side (HOME's road r3 crosses the
//          town's mk_sa01 7 m before its end - without that join HOME and the town are two graphs), the spans whose line
//          misses its junctions rebuilt off the record's waypoints (a premises-graph bug, reported), HOME and Cedar
//          Harbour on ONE component, the destinations resolved
//   TRIP   the car placed at HOME facing AWAY from the town, sent to Cedar Harbour: a U-turn (Jolene has no roadside
//          apron: a dead end on hard ground or a junction's side street); after 4 km a new To behind (HOME): a U-turn;
//          then Cedar Harbour again: a U-turn; ARRIVED at the town hall's stop. The cross-track on the road, the
//          manoeuvres' tracking, the body on the ground (depth), the BODY ON THE ROAD (every quarter second each corner of
//          the footprint against the roads' bands and the hard ground), never STUCK
//   PERF   the physics' cost a 60 Hz frame (car.step: 4 substeps), the driver's (D.step), setDest's (a route + a U-turn
//          planned) - printed, bounded loosely (a shared machine)
//   TOWNOFF the page's default world (the town switched off, G590): Cedar Harbour unreachable, said so in the To picker
//   PAGE   the drive mode's wiring by its source: the lazy pack, nothing in MANIFEST.core, app.js's hooks
// ~25 s (the island composed: 5 s). node tools/_drive_trip_check.js [--track out.json]
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const C = require('./flight_core.js');
const IN = require('./island_node.js');
const V = require(path.join(ROOT, 'src/vehicle/vehicle.js'));
const Dr = require(path.join(ROOT, 'src/vehicle/vehicle_drive.js'));
const VI = require(path.join(ROOT, 'src/vehicle/vehicle_island.js'));
const SHEET = require(path.join(ROOT, 'src/cars/car_conquer.json'));
const TRACK = (i => (i > 0 ? process.argv[i + 1] : null))(process.argv.indexOf('--track'));
let fails = 0;
const row = (id, ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + id.padEnd(7) + ' ' + msg); if (!ok) fails++; };
const f = (x, n = 2) => (+x).toFixed(n);

// the town's stop: the Town Hall's site (27_premises sites: mk_hall) - the place the island's map labels Cedar Harbour
const TOWN = { id: 'mk_hall', name: C.GAME_NAMES ? C.GAME_NAMES.town : 'Cedar Harbour', kind: 'town' };

const W = IN.islandWorld('jolene', { premises: fs.readFileSync(path.join(__dirname, 'fixtures', 'island_jolene.json'), 'utf8') });
if (!W) { console.log('FAIL WORLD   the island is not on disk'); console.log('GATE DRIVE-TRIP: FAIL'); process.exit(1); }
const O = W.premises.overlay, REC = W.premises.rec;
const hall = (REC.layers.sites || []).find(s => s.id === 'mk_hall');
Object.assign(TOWN, { x: hall.at.x, z: hall.at.z });
const t0 = Date.now();
const RG = O.roadGraph();
const aero = W.aerodromes.map(a => { const s = C.siteOf(a.id); return { id: a.id, name: C.fieldName(a.id, a.name), x: a.x, z: a.z, stand: s && s.stand }; });
const home = aero.find(a => a.id === 'HOME');
const I = VI.vehIslandSpec(RG, { rec: REC, toWorld: (x, z) => O.frame.toWorld(x, z), aerodromes: aero, sites: [TOWN], from: [home.stand.x, home.stand.z] });
const G = Dr.vehRoadGraph(I.spec);
const tGraph = Date.now() - t0;

// ---- GRAPH ----
{
  const R = I.report, x = R.joins.find(j => j.kind === 'crossing' && ((j.a === 'r3' && j.b === 'mk_sa01') || (j.a === 'mk_sa01' && j.b === 'r3')));
  const pl = R.places.filter(p => p.ok).map(p => p.id);
  const ok = !!x && R.rebuilt.length > 0 && R.rebuilt.every(r => !r.chord) && !!G.places.HOME && !!G.places.mk_hall &&
    G.places.mk_hall.off < 40 && R.comps[0].km > 60 && Object.keys(G.turns).length > 50;
  row('GRAPH', ok, 'premises ' + RG.nodes.length + ' nodes / ' + RG.edges.length + ' spans -> ' + G.nodes.length + ' vertices / ' + G.edges.length + ' edges in ' + tGraph + ' ms; joined vehicle-side: ' +
    R.joins.filter(j => j.kind === 'crossing').length + ' drawn crossings (r3 x mk_sa01 at ' + (x ? f(x.x, 1) + ', ' + f(x.z, 1) : 'MISSING') + '), ' + R.joins.filter(j => j.kind === 'tee').length + ' drawn T\'s; ' +
    R.rebuilt.length + ' spans rebuilt off their waypoints (the premises graph\'s straight-street bug); the largest network ' + R.comps[0].km + ' km (' + R.comps[0].roads + ' roads), next ' +
    R.comps.slice(1, 3).map(c => c.km + ' km').join(', ') + '; ' + Object.keys(G.turns).length + ' turning places (junctions, road ends), 0 drawn aprons; destinations ' + pl.join(', ') +
    ' (Cedar Harbour ' + (G.places.mk_hall ? f(G.places.mk_hall.off, 0) : '-') + ' m off the hall)');
}

// the roads' bands (and the hard ground) for the body-on-the-road check: an edge grid
const CELL = 32, EG = new Map(), ek = (i, j) => i + ',' + j;
G.edges.forEach((E, ei) => { const A = G.nodes[E.a], B = G.nodes[E.b], hw = E.w / 2 + 1;
  for (let i = Math.floor((Math.min(A.x, B.x) - hw) / CELL); i <= Math.floor((Math.max(A.x, B.x) + hw) / CELL); i++)
    for (let j = Math.floor((Math.min(A.z, B.z) - hw) / CELL); j <= Math.floor((Math.max(A.z, B.z) + hw) / CELL); j++) { const k = ek(i, j); let L = EG.get(k); if (!L) EG.set(k, L = []); L.push(ei); } });
// metres OFF the road at (x, z): 0 on a road's band or on hard ground (PAVED, GRAVEL), else past the nearest band's edge
function offRoad(x, z) {
  const L = EG.get(ek(Math.floor(x / CELL), Math.floor(z / CELL))) || [];
  let best = Infinity;
  for (const ei of L) { const E = G.edges[ei], A = G.nodes[E.a], B = G.nodes[E.b], F = VI.viSegFoot([x, z], [A.x, A.z], [B.x, B.z]); best = Math.min(best, F.d - E.w / 2); }
  if (best <= 0) return 0;
  const s = W.surface(x, z); if (s === 5 || s === 6) return 0;
  return best;
}

// ---- TRIP ----
const def = V.vehicleDef(SHEET), car = V.makeVehicle(def, W);
const P0 = G.places.HOME;
// facing AWAY from the town: the heading whose straight-on route has no way to the town (a dead end)
let hdg = Math.atan2(P0.dz, P0.dx);
{
  car.place(P0.x, P0.z, hdg); const L = Dr.vehGraphLocate(G, P0.x, P0.z, hdg), D0 = Dr.vehDijkstra(G, L.ahead, new Set([L.e]));
  if (D0.dist[G.places.mk_hall.node] < Infinity) hdg += Math.PI;
}
car.place(P0.x, P0.z, hdg);
for (let i = 0; i < 30; i++) car.step(1 / 60);
const D = Dr.makeDriver(car, G, { vCruise: 20 });
const DT = 1 / 60, perf = { car: 0, drv: 0, n: 0, dest: [] };
const timed = fn => { const a = process.hrtime.bigint(); const r = fn(); perf.dest.push(Number(process.hrtime.bigint() - a) / 1e6); return r; };
const answers = [timed(() => D.setDest('mk_hall'))];
let t = 0, odo = 0, last = car.refPoint(), pen = 0, vmax = 0, offMax = 0, offN = 0, offAt = null, nextChk = 0, did = 0;
const track = [];
while (t < 3600 && !['ARRIVED', 'STUCK', 'IDLE'].includes(D.phase)) {
  if (did === 0 && odo > 4000) { did = 1; answers.push(timed(() => D.setDest('HOME'))); }
  if (did === 1 && D.phase === 'DRIVE' && D.stats.uturns >= 2 && odo > 5200) { did = 2; answers.push(timed(() => D.setDest('mk_hall'))); }
  let a = process.hrtime.bigint(); D.step(DT); perf.drv += Number(process.hrtime.bigint() - a);
  a = process.hrtime.bigint(); car.step(DT); perf.car += Number(process.hrtime.bigint() - a); perf.n++;
  t += DT;
  const q = car.refPoint(); odo += Math.hypot(q[0] - last[0], q[2] - last[2]); last = q;
  vmax = Math.max(vmax, car.out.u);
  if (car.out.proxyHit) for (const pb of def.proxy) { const w = car.toWorld(pb); pen = Math.max(pen, W.terrainH(w[0], w[2]) - w[1]); }
  if (t >= nextChk) {
    nextChk = t + 0.25;
    for (const c of car.footprint()) { const o = offRoad(c[0], c[1]); if (o > offMax) { offMax = o; offAt = [q[0], q[2], D.phase]; } if (o > 0.3) offN++; }
    if (TRACK && track.length < 1e5 && (track.length === 0 || t - track[track.length - 1][3] >= 2)) track.push([+q[0].toFixed(1), +q[2].toFixed(1), +car.out.u.toFixed(2), +t.toFixed(1), D.phase]);
  }
}
const end = car.refPoint(), Pm = G.places.mk_hall, dEnd = Math.hypot(end[0] - Pm.x, end[2] - Pm.z);
const turns = D.log.filter(l => l.what === 'uturn').map(l => l.msg.replace(/: .*/, ''));
{
  const rms = Math.sqrt(D.stats.xtSq / Math.max(1, D.stats.xtN));
  const ok = D.phase === 'ARRIVED' && dEnd < 1 && answers.join() === 'uturn,uturn,uturn' && D.stats.uturns === 3 && odo > 12000 &&
    D.stats.xtMax < 2.5 && rms < 0.3 && D.stats.manXt < 0.15 && pen < 0.02 && offMax < 0.6 && !D.log.some(l => l.what === 'stuck');
  row('TRIP', ok, 'HOME -> ' + TOWN.name + ': ' + D.phase + ' in ' + f(t / 60, 1) + ' min, ' + f(odo / 1000, 2) + ' km, ' + f(vmax * 3.6, 0) + ' km/h at most, ' + f(dEnd, 2) + ' m from the stop; setDest ' +
    answers.join(' / ') + '; U-turns: ' + turns.join(', ') + ' (tracked within ' + f(D.stats.manXt * 100, 0) + ' cm); ' + D.stats.windows + ' windows; cross-track ' + f(D.stats.xtMax) + ' m max (the town\'s 90 deg corners), ' +
    f(rms, 3) + ' m rms; the body\'s corners off the road ' + f(offMax) + ' m at most (' + offN + ' corner-samples past 0.3 m' + (offAt ? ', the worst at ' + f(offAt[0], 0) + ', ' + f(offAt[1], 0) + ' ' + offAt[2] : '') +
    '); the body into the ground ' + f(pen * 1000, 0) + ' mm at most (the sheet\'s box on a junction\'s crease)');
}
// ---- PERF ----
{
  const car_ms = perf.car / perf.n / 1e6, drv_ms = perf.drv / perf.n / 1e6, dmax = Math.max(...perf.dest);
  row('PERF', car_ms < 2.5 && drv_ms < 1 && dmax < 3000, 'a 60 Hz frame: the physics ' + f(car_ms, 3) + ' ms (4 substeps), the driver ' + f(drv_ms, 3) + ' ms (' + perf.n + ' frames); setDest ' +
    perf.dest.map(x => f(x, 0) + ' ms').join(' / ') + ' (a route + a U-turn planned)');
}
// ---- TOWNOFF: the page's default world - the town switched off (G590: 27_premises TOWN_OFF, world_boot.js's TOWN; the GRAPHICS
// 'town' row or ?town=1 turns it on) takes Cedar Harbour's streets with it: the car's places are HOME's network's only, and
// the drive mode lists the town greyed, saying so (drive_mode.js DM.choices) ----
{
  const PG = C.PREMISES_GEN, raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'island_jolene.json'), 'utf8'));
  const Dp = PG.dropPlaces(PG.unwrap(raw).rec, PG.TOWN_OFF.drop, PG.TOWN_OFF.keep);
  const W2 = IN.islandWorld('jolene', { premises: JSON.stringify(Dp.rec) }), O2 = W2.premises.overlay;
  const aero2 = W2.aerodromes.map(a => { const s = C.siteOf(a.id); return { id: a.id, name: C.fieldName(a.id, a.name), x: a.x, z: a.z, stand: s && s.stand }; });
  const h2 = aero2.find(a => a.id === 'HOME');
  const I2 = VI.vehIslandSpec(O2.roadGraph(), { rec: W2.premises.rec, toWorld: (x, z) => O2.frame.toWorld(x, z), aerodromes: aero2, sites: [], from: [h2.stand.x, h2.stand.z] });
  const ids = I2.spec.places.map(p => p.id).sort();
  const DMsrc = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'drive_mode.js'), 'utf8');
  row('TOWNOFF', !ids.includes('mk_hall') && !ids.includes('mk_sea') && ids.includes('HOME') && /the town is off/.test(DMsrc),
    'the town off (' + Dp.n + ' entries dropped): the car\'s places ' + ids.join(', ') + ' - Cedar Harbour unreachable, the To picker lists it greyed ("the town is off"); the drive there needs Graphics: Town all (or ?town=1)');
}
// ---- PAGE: the drive mode's wiring, by its source (the browser rig is tools/drive_shot.js) ----
{
  const B = require(path.join(ROOT, 'tools', 'build.js'));
  const lazy = B.MANIFEST.lazy.map(([d, f]) => d + '/' + f);
  const want = ['src/cars/cars_car.js', 'src/vehicle/vehicle.js', 'src/vehicle/vehicle_drive.js', 'src/vehicle/vehicle_island.js', 'src/viewer/drive_mode.js'];
  const APP = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
  const hooks = { loop: /driveOn\(\); if \(DM\) DM\.frame\(pc\.steps\)/, target: /target\.fromArray\(driveOn\(\)\.target\(\)\)/, camera: /DMc\.tailAxis\(\)/,
    hud: /if \(DM\) \{ DM\.hud\(\); return; \}/, map: /DMm\.drawOnMap\(/, trip: /if \(DM\) return DM\.trip\(\)/, picker: /DM\.setDest\(id\); flRender\(\)/,
    pause: /DM\.paused = !!on/, restart: /DM\.restart\(\); return;/, refill: /FLYDIY_DEST_REFILL = /, entry: /DRIVE_Q\) setTimeout\(\(\) => DRIVE\.enter\(\)/ };
  const miss = Object.keys(hooks).filter(k => !hooks[k].test(APP));
  const core = B.MANIFEST.core.some(n => /vehicle|drive_mode|cars?[_/]/i.test(n));
  if (!/body\.driveMode #flNotice, body\.driveMode #bSkip/.test(fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'flight.css'), 'utf8'))) miss.push('css (the aeroplane\'s verbs off while driving)');
  row('PAGE', want.every(w => lazy.includes(w)) && !miss.length && !core,
    'lazy: ' + want.filter(w => lazy.includes(w)).length + ' of ' + want.length + ' files in MANIFEST.lazy, none in MANIFEST.core; app.js hooks ' + (Object.keys(hooks).length - miss.length) + ' of ' + Object.keys(hooks).length + (miss.length ? ' (missing: ' + miss.join(', ') + ')' : ' (loop, target, camera, hud, map, trip, picker, pause, restart, refill, ?drive=1)'));
}
if (TRACK) fs.writeFileSync(TRACK, JSON.stringify({ track, log: D.log, places: Object.values(G.places).map(p => ({ id: p.id, name: p.name, x: p.x, z: p.z })), joins: I.report.joins }));
console.log('GATE DRIVE-TRIP: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
