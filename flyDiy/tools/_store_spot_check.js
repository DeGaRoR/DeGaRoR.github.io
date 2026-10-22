#!/usr/bin/env node
// GATE STORESPOT (G2701, HANGAR-STORAGE-2) - AN APRON AEROPLANE FLIES FROM ITS OWN TIE-DOWN SPOT.
//
// The study (futureDesigns/game/HANGAR-STORAGE-2026-10-10.md §3): "Outside -> it starts at its apron spot". The page
// (app.js storeFly / storeSpotOf -> applyRoute) puts a storage Fly of an OUTSIDE aeroplane on the spot FLEET_STAND
// stands its prop on (src/viewer/fleet_spots_pack.js: [x, z, ry, id], the nose along (cos ry, -sin ry)) as a stand
// { x, z, hdg: -ry } and hands the pilot the field's site with that stand. This gate holds it on Jolene's HOME, the Cub
// (joined as the game flies it), for each of the first --n spots (default 6, the drawn cap):
//   - placed, the nose points along the prop's (|nose - spot| < 1 deg): the aeroplane starts where its prop stood;
//   - the pilot plans from there and taxis to its ROLL inside 420 s (no STOPPED; the planner may pick the far end: spot 0 takes 13 by the left arm, 333 s), then lifts off inside 120 s more,
//     on the runway (|across| < 6 m) - a flyable start, a short take-off.
//   node tools/_store_spot_check.js [--n 6] [--show]      -> "GATE STORESPOT: PASS|FAIL"
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname;
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const BJ = require(path.join(T, '_bake_joined.js'));
const argv = process.argv.slice(2);
const SHOW = argv.includes('--show');
const N = (i => (i >= 0 ? +argv[i + 1] : 6))(argv.indexOf('--n'));

const fail = [];
const check = (ok, label, extra) => { if (!ok) fail.push(label + (extra ? ' - ' + extra : '')); if (SHOW || !ok) console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + label + (extra ? '  [' + extra + ']' : '')); return ok; };
const wrap = a => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
const noseHdg = sim => { const [xA] = sim.axes(); return Math.atan2(-xA[2], -xA[0]); };

const src = fs.readFileSync(path.join(T, '..', 'src', 'viewer', 'fleet_spots_pack.js'), 'utf8');
const PACK = JSON.parse(src.slice(src.indexOf('{', src.indexOf('FLEET_SPOTS_PACK'))).replace(/;\s*$/, '').trim());
const spots = (PACK.aero.HOME || []).slice(0, N);
check(spots.length === N, 'HOME has ' + N + ' cooked tie-down spots', spots.length + ' in the pack');

BJ.loadPanel();
const cub = BJ.bakeCard('cub');
const def = C.buildGen(cub.spec);
const J = IN.islandWorld('jolene', { premises: fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8') });
const home = J.aerodromes.find(a => a.id === 'HOME');
const site0 = C.siteOf('HOME');
const ux = Math.cos(home.hdg), uz = Math.sin(home.hdg);
const across = (x, z) => -(x - home.x) * uz + (z - home.z) * ux;
const t0 = Date.now();

for (const [x, z, ry, id] of spots) {
  const tag = 'HOME spot ' + id + ': ';
  // the page's stand (app.js applyRoute: the spot's ground under it, then seatOnGround)
  const stand = { x, z, hdg: -ry, elev: +J.terrainH(x, z).toFixed(2) };
  const site = Object.assign({}, site0, { stand });
  const sim = C.makeSim(def, J);
  sim.reset(0); if (sim.stance) sim.stance();
  C.placeAtStand(sim, home, stand);
  if (C.seatOnGround) C.seatOnGround(sim, (a, b) => J.terrainH(a, b), def.refs);
  const e0 = Math.abs(wrap(noseHdg(sim) - Math.atan2(-Math.sin(ry), Math.cos(ry))));
  check(e0 < 1 / 57.3, tag + 'the nose points along the prop that stood there', (e0 * 57.3).toFixed(2) + ' deg');
  const ap = C.makePilot(sim, def, J, {});
  ap.setRoute(home, home); ap.departFrom(home, home, site);
  let roll = null, lift = null, stopped = false, ids = null;
  for (let s = 0; s < 420 * 60; s++) {
    ap.update(1 / 60); sim.step(1 / 60);
    if (!ids && ap.path) ids = ap.path.ids || null;
    const c = sim.cgPos();
    if (!roll && ap.phase === 'ROLL') roll = { t: s / 60 };
    if (ap.phase === 'STOPPED') { stopped = true; break; }
    if (roll && !lift && sim.wheelsOnGround() === 0 && c[1] - J.terrainH(c[0], c[2]) > 5) { lift = { t: s / 60, cr: across(c[0], c[2]) }; break; }
    if (!roll && s / 60 > 420) break;
    if (roll && s / 60 > roll.t + 120) break;
  }
  check(!stopped && !!roll && roll.t <= 420, tag + "the pilot taxis from the spot to its roll inside 420 s", (roll ? roll.t.toFixed(0) + ' s' : 'no roll') + (stopped ? ', STOPPED' : '') + ' | ' + (ids || []).join('>'));
  check(!!lift && Math.abs(lift.cr) < 6, tag + 'and lifts off inside 120 s, on the runway', lift ? (lift.t - roll.t).toFixed(0) + ' s from the roll, ' + lift.cr.toFixed(1) + ' m across' : 'no lift-off');
}
console.log('  (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
console.log('GATE STORESPOT: ' + (fail.length ? 'FAIL (' + fail.length + ')' : 'PASS'));
process.exit(fail.length ? 1 : 0);
