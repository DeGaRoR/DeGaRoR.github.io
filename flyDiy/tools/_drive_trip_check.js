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
//   PLAIN  the trip as the page sets it off: the car facing its route (vehFaceToward) - no U-turn
//   RUNWAY (phase 2) road -> stand -> taxi route -> runway 31 at Jolene AFB, the 2325 m of 13/31, onto 02/20, the body on
//          hard ground; Fishing Village and back (its approach r40 an even ramp since the composer's junction ease)
//   TOWNOFF the town not built (the laptop / potato budgets, software rendering - G590, G1526; ON by default): Cedar
//          Harbour unreachable, said so in the To picker
//   CARPLACES (13 Nov) the car's own places (harbour front, village, tramway, cannery) reachable from HOME, the car's To list
//          without the runway ends, a GARAGE car (the roadster's measured sheet) driven HOME -> the village
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
const HOME_STAND = C.siteOf('HOME').stand;
// (phase 2: the one recipe the page uses - the runways and their taxi routes, the stands' links, the steep stretches closed)
const H = { siteOf: C.siteOf, fieldName: C.fieldName, town: { id: 'mk_hall', site: 'mk_hall', name: TOWN.name }, from: [HOME_STAND.x, HOME_STAND.z] };
const I = VI.vehIslandFromWorld(W, H), RG = I.RG, aero = I.aero;
const home = aero.find(a => a.id === 'HOME');
const G = Dr.vehRoadGraph(I.spec);
const tGraph = Date.now() - t0;

// ---- GRAPH ----
// (12 Nov, the user: "join the roads" - the island record carries the junctions now, tools/road_join_drawn.js: HOME's road
// r3 meets the town's mk_sa01 at a junction. The proof is the graph WITHOUT the vehicle's own joins: one network)
{
  const R = I.report, pl = R.places.filter(p => p.ok).map(p => p.id);
  const I0 = VI.vehIslandFromWorld(W, Object.assign({}, H, { joinCrossings: false, tTol: 0 }));
  const same = I0.spec.places.some(p => p.id === 'mk_hall') && I0.spec.places.some(p => p.id === 'HOME');
  const j3 = (REC.layers.roads.find(r => r.id === 'r3') || {}).nodes || [], s01 = (REC.layers.roads.find(r => r.id === 'mk_sa01') || {}).nodes || [];
  const shared = j3.filter(j => j && s01.includes(j));
  const ok = same && shared.length > 0 && R.rebuilt.every(r => !r.chord) && !!G.places.HOME && !!G.places.mk_hall &&
    G.places.mk_hall.off < 40 && R.comps[0].km > 60 && Object.keys(G.turns).length > 50;
  row('GRAPH', ok, 'premises ' + RG.nodes.length + ' nodes / ' + RG.edges.length + ' spans -> ' + G.nodes.length + ' vertices / ' + G.edges.length + ' edges in ' + tGraph + ' ms; ' +
    'HOME and Cedar Harbour on one network by the record\'s own junctions (r3 x mk_sa01: ' + (shared.join(', ') || 'NONE') + ', the vehicle\'s joins off: ' + (same ? 'one network' : 'TWO') + '); ' +
    'still joined vehicle-side: ' + R.joins.length + ' (drawn crossings / T\'s the record leaves); ' +
    R.rebuilt.length + ' spans rebuilt off their waypoints (the premises graph\'s straight-street bug); the largest network ' + R.comps[0].km + ' km (' + R.comps[0].roads + ' roads), next ' +
    R.comps.slice(1, 3).map(c => c.km + ' km').join(', ') + '; ' + Object.keys(G.turns).length + ' turning places (junctions, road ends); destinations ' + pl.join(', ') +
    ' (Cedar Harbour ' + (G.places.mk_hall ? f(G.places.mk_hall.off, 0) : '-') + ' m off the hall)');
}
// ---- PLAIN: the trip as the page sets it off - the car stood facing its route (vehFaceToward): no U-turn at all ----
{
  const car0 = V.makeVehicle(V.vehicleDef(SHEET), W), P = G.places.HOME;
  car0.place(P.x, P.z, Dr.vehFaceToward(G, P.x, P.z, Math.atan2(P.dz, P.dx), 'mk_hall'));
  for (let i = 0; i < 30; i++) car0.step(1 / 60);
  const D0 = Dr.makeDriver(car0, G, { vCruise: 20 }), a0 = D0.setDest('mk_hall');
  let t = 0; while (t < 2400 && !['ARRIVED', 'STUCK', 'IDLE'].includes(D0.phase)) { D0.step(1 / 60); car0.step(1 / 60); t += 1 / 60; }
  const e = car0.refPoint(), dE = Math.hypot(e[0] - G.places.mk_hall.x, e[2] - G.places.mk_hall.z);
  row('PLAIN', a0 === 'replan' && D0.phase === 'ARRIVED' && D0.stats.uturns === 0 && dE < 1, 'HOME -> ' + TOWN.name + ' set off facing the route: setDest ' + a0 + ', ' + D0.phase + ' in ' + f(t / 60, 1) + ' min, ' +
    D0.stats.uturns + ' U-turns (a U-turn is for a new To behind - the TRIP row), ' + f(dE, 2) + ' m from the stop');
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
let u1 = 0, odo1 = 0, t = 0, odo = 0, last = car.refPoint(), pen = 0, vmax = 0, offMax = 0, offN = 0, offAt = null, nextChk = 0, did = 0;
const track = [];
while (t < 3600 && !['ARRIVED', 'STUCK', 'IDLE'].includes(D.phase)) {
  // (the start's answer is the island's: facing away from the town at HOME's stand the car may U-turn, or go round by the
  //  taxi route and the runway - 'uturn' or 'replan'. Then the two re-routes BEHIND it, each a U-turn by construction)
  if (did === 0 && odo > 4000) { did = 1; u1 = D.stats.uturns; answers.push(timed(() => D.setDest('HOME'))); }
  if (did === 1 && D.phase === 'DRIVE' && D.stats.uturns > u1 && odo > odo1 + 1200) { did = 2; answers.push(timed(() => D.setDest('mk_hall'))); }
  if (did === 1 && !odo1 && D.phase === 'DRIVE' && D.stats.uturns > u1) odo1 = odo;
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
  const ok = D.phase === 'ARRIVED' && dEnd < 1 && /^(uturn|replan),uturn,uturn$/.test(answers.join()) && D.stats.uturns >= 2 && odo > 10000 &&
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
// ---- RUNWAY (phase 2: "cars on RUNWAYS, including going FROM A ROAD ONTO A RUNWAY (an apron or a taxiway as the link)") ----
// HOME's stand -> runway 31's end (the road, the stand's link, the aeroplane's taxi route, onto the runway), the length of
// 13/31 to runway 13's end, onto 02/20 (its end on 13/31's pavement); every corner of the body on PAVED / GRAVEL every
// quarter second. And Fishing Village: its approach r40 meets the strip at a bank, closed - the answer is 'none', never a
// car driven into it
{
  const car1 = V.makeVehicle(V.vehicleDef(SHEET), W), legs = [];
  let soft = 0, vmax = 0;
  const leg = (from, to, onHard) => {   // (onHard: the airfield legs - every corner of the body on PAVED / GRAVEL)
    const P = G.places[from];
    if (!P || !G.places[to]) { legs.push(from + ' -> ' + to + ': no such place'); return false; }
    car1.place(P.x, P.z, Dr.vehFaceToward(G, P.x, P.z, Math.atan2(P.dz, P.dx), to)); for (let i = 0; i < 30; i++) car1.step(1 / 60);
    const D1 = Dr.makeDriver(car1, G, { vCruise: 20 }), a1 = D1.setDest(to);
    let t = 0, nx = 0;
    while (t < 900 && !['ARRIVED', 'STUCK', 'IDLE'].includes(D1.phase)) { D1.step(1 / 60); car1.step(1 / 60); t += 1 / 60; vmax = Math.max(vmax, car1.out.u);
      if (onHard !== false && t >= nx) { nx = t + 0.25; for (const c of car1.footprint()) { const sf = W.surface(c[0], c[1]); if (sf !== 5 && sf !== 6) soft++; } } }
    const e = car1.refPoint(), Q = G.places[to], dE = Math.hypot(e[0] - Q.x, e[2] - Q.z);
    legs.push(G.places[from].name + ' -> ' + Q.name + ': ' + a1 + ', ' + D1.phase + ' ' + f(t, 0) + ' s, ' + f(dE, 2) + ' m off, ' + D1.stats.uturns + ' U-turns, x-track ' + f(D1.stats.xtMax, 2) + ' m');
    return a1 === 'replan' && D1.phase === 'ARRIVED' && dE < 1 && D1.stats.uturns === 0;
  };
  const ok1 = leg('HOME', 'rwy:HOME:1'), ok2 = leg('rwy:HOME:1', 'rwy:HOME:0'), ok3 = leg('rwy:HOME:0', 'rwy:w2:1');
  // Fishing Village (12 Nov, the user: "just join it"): its approach r40 met the strip's terrace at a 5 m step (68 %) - the
  // composer eased a road off its junction over a fixed 7 m; the ease is as long as the climb now (27_premises), r40 as drawn
  // is an even ramp: driven there and back
  const ok4 = leg('HOME', 'rwy:w3:0', false), ok5 = leg('rwy:w3:0', 'HOME', false), r40 = (I.report.closed || []).find(c => c.road === 'r40');
  const rn = (I.report.runways || []).map(r => r.name), lk = (I.report.links || []).filter(l => l.ok).map(l => l.id + ' -> ' + l.to + ' ' + l.m + ' m');
  row('RUNWAY', ok1 && ok2 && ok3 && ok4 && ok5 && soft === 0 && !r40,
    legs.join('; ') + '; ' + f(vmax * 3.6, 0) + ' km/h at most, body corners off hard ground on the airfield legs: ' + soft + ' samples. Runway ends as places: ' + rn.length + ' (' + rn.slice(0, 4).join(', ') + ' ...); stands linked: ' + lk.join(', ') +
    '. Fishing Village\'s approach r40: ' + (r40 ? 'CLOSED at ' + JSON.stringify(r40.at) : 'open (an even ramp onto the strip)') + '; the steep stretches closed island-wide: ' + (I.report.closed || []).length + ' roads');
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
  row('TOWNOFF', !ids.includes('mk_hall') && !ids.includes('mk_sea') && ids.includes('HOME') && /not built at this graphics budget/.test(DMsrc),
    'the town not built (laptop / potato budget, software rendering; ' + Dp.n + ' entries dropped): the car\'s places ' + ids.join(', ') + ' - Cedar Harbour unreachable, the To picker lists it greyed ("not built at this graphics budget"); the town is on by default');
}
// ---- CARPLACES (13 Nov, the user's usable car: "put the car in the garage, roll out, pick a destination, drive there"; "a few
// CAR-ONLY destinations"): the car's own places on HOME's network, a car's To list without the runway ends (the tow's and the
// trailer's), and A GARAGE CAR - the roadster's sheet as tools/car_sheet.js measured its drawing (src/cars/car_roadster.json),
// not the stock pickup - driven by the AI from HOME to the village ----
{
  const want = VI.VI_CAR_PLACES.map(c => c.id), got = want.filter(id => G.places[id]);
  const L0 = Dr.vehGraphLocate(G, G.places.HOME.x, G.places.HOME.z, 0), DA = Dr.vehDijkstra(G, L0.ahead, null), DB = Dr.vehDijkstra(G, L0.behind, null);
  const km = id => Math.min(DA.dist[G.places[id].node], DB.dist[G.places[id].node]) / 1000;
  const reach = got.filter(id => isFinite(km(id)));
  const DMsrc = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'drive_mode.js'), 'utf8');
  const noRwy = /p\.kind === 'stop' && p\.what !== 'runway'/.test(DMsrc), useCar = /DM\.useCar = useCar/.test(DMsrc) && /await useCar\(ctx\)/.test(DMsrc);
  const RS = require(path.join(ROOT, 'src/cars/car_roadster.json'));
  const car2 = V.makeVehicle(V.vehicleDef(RS), W), P = G.places.HOME;
  car2.place(P.x, P.z, Dr.vehFaceToward(G, P.x, P.z, Math.atan2(P.dz, P.dx), 'car:village'));
  for (let i = 0; i < 30; i++) car2.step(1 / 60);
  const D2 = Dr.makeDriver(car2, G, { vCruise: 20 }); D2.setDest('car:village');
  let t = 0, off = 0, vmax = 0; while (t < 1800 && !['ARRIVED', 'STUCK', 'IDLE'].includes(D2.phase)) { D2.step(1 / 60); car2.step(1 / 60); t += 1 / 60;
    vmax = Math.max(vmax, car2.speed ? Math.abs(car2.speed()) : 0); if (((t * 60) | 0) % 15 === 0) { const e = car2.refPoint(); off = Math.max(off, offRoad(e[0], e[2])); } }
  const e = car2.refPoint(), dV = Math.hypot(e[0] - G.places['car:village'].x, e[2] - G.places['car:village'].z);
  row('CARPLACES', got.length === want.length && reach.length === want.length && noRwy && useCar && D2.phase === 'ARRIVED' && dV < 2 && off < 1,
    'the car\'s own places on HOME\'s network: ' + got.map(id => G.places[id].name + ' ' + f(km(id), 1) + ' km (' + f(G.places[id].off, 0) + ' m off a road)').join(', ') +
    ' (' + reach.length + ' of ' + want.length + ' reachable); the car\'s To list without the runway ends: ' + (noRwy ? 'yes' : 'NO') + '; drive mode takes a given car (useCar): ' + (useCar ? 'yes' : 'NO') +
    '; THE GARAGE ROADSTER (' + (RS.car && RS.car.name || 'car_roadster.json') + ', its measured sheet) HOME -> the village: ' + D2.phase + ' in ' + f(t / 60, 1) + ' min, ' + f(dV, 2) + ' m from the stop, ' +
    f(vmax * 3.6, 0) + ' km/h at most, ' + f(off, 2) + ' m off the road at worst');
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
