#!/usr/bin/env node
// GATE GLIDE (TOW-LAUNCH's pilot work, 12-13 Nov, for the Pilot coordinator's coherent autopilot - core files only, no car,
// no tow, no trailer): UNPOWERED FLIGHT. THE PILOT FLIES A GLIDER - every engine's key off, or none - from wherever it is in the air: the glide to a field, A GLIDER'S CIRCUIT
// there on energy (43_pilot.js GLIDE: gliderCircuitPlan, the stages key / burn / downwind / base / final, the base turned
// where the height left just covers the way at the glide ratio flown), the flare and the landing. No tow, no car: each
// glider starts in the air (a settled build moved up and set flying - the solver's reset first: its ground contacts hold
// their stick points), its motor off, the pilot re-engaged at CLIMB (the page's handover after a launch).
//   CIRCUIT   (a) the motorglider and the Archaeopteryx card, 280 / 360 m over Jolene AFB 13/31: the circuit, on the runway
//   TOFIRST   (b) off Skyline Altiport (696 m), the route's To Jolene (7.6 km at 12:1): it goes there, not to the nearest
//   NEAREST   (c) THE DIVERT: a To out of any glide's reach: the nearest field the glide reaches, its circuit, the landing
//   FAIL300 / FAIL1000 / FUELDRY  (d) THE EMERGENCY: the C172-alike, 2.6 km out on a 15 km leg Jolene > East Point Clearing,
//             loses its engine at 300 m and at 1000 m (the engine stops, its key on - an emergency, not a glider), and its
//             tanks run dry at 600 m: the pilot says so, glides to the NEAREST field its glide reaches (Cannery Runway, not
//             its To), flies the circuit there and lands on the runway, within 20 m of its centreline, stopped on it, nothing
//             broken, under 3 m/s at the touchdown (a forced landing: the 300 m case lands clean, no height for the flap, at
//             2.7 m/s; the glider rows ask the normal landing's 1.5)
// 7 flights, ~25 min in one process; run_gates shards it 4 ways (--shard=i/N). One row: ONLY=<row id> node tools/_glide_check.js
'use strict';
const fs = require('fs'), path = require('path');
{ const T = __dirname, src = fs.readFileSync(path.join(__dirname, 'arch_fly.js'), 'utf8');
  eval(src.slice(src.indexOf('function loadPanel()'), src.indexOf('loadPanel();')).replace(/__dirname/g, JSON.stringify(__dirname)).replace('function loadPanel()', 'global.loadPanel = function ()')); global.loadPanel(); void T; }
const DS = require('./_cage_design.js'), C = require('./flight_core.js'), IN = require('./island_node.js');
const SHD = require(path.join(__dirname, '_shard.js'));
// one flight a heavy job: take() in the same order in every shard; ONLY=<row id> runs one row by hand (unsharded)
const go = id => SHD.take() && (!process.env.ONLY || process.env.ONLY === id);
let fails = 0;
const row = (id, ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + id.padEnd(8) + ' ' + msg); if (!ok) fails++; };
const f = (x, n = 1) => (+x).toFixed(n);
const W = IN.islandWorld('jolene', { premises: fs.readFileSync(path.join(__dirname, 'fixtures', 'island_jolene.json'), 'utf8') });
const AD = id => W.aerodromes.find(a => a.id === id);
const defOf = key => { const A = DS.ARCHETYPES.find(x => x.key === key); return C.buildGen(DS.designBake(A.sel, A.over)); };

// a glider in the air: settled at `a`'s line-up, then moved to (x, z) at h m over the ground there, heading hdg, at V
function airborne(def, a, x, z, h, hdg, V) {
  const sim = C.makeSim(def, W); sim.reset(0);
  C.placeAtLineup(sim, a, { x: a.x, z: a.z, hdg }, W, def.refs); for (let i = 0; i < 60; i++) sim.step(1 / 60);
  const P = Float64Array.from(sim.p), cg = sim.cgPos(), y = W.terrainH(x, z) + h;
  sim.reset(0);
  const fx = Math.cos(hdg), fz = Math.sin(hdg);
  for (let i = 0; i < sim.n; i++) {
    sim.p[i * 3] = P[i * 3] - cg[0] + x; sim.p[i * 3 + 1] = P[i * 3 + 1] - cg[1] + y; sim.p[i * 3 + 2] = P[i * 3 + 2] - cg[2] + z;
    sim.v[i * 3] = fx * V; sim.v[i * 3 + 1] = 0; sim.v[i * 3 + 2] = fz * V;
  }
  for (let i = 0; i < sim.eng.length; i++) sim.setEngine(i, { key: 'off' });
  return sim;
}
function fly(def, sim, from, to, T, fail) {
  const ap = C.makePilot(sim, def, W); ap.setRoute(from, to); ap.reEngage({ phase: 'CLIMB' });
  let bad = false;
  for (let fr = 0; fr < 60 * (T || 600); fr++) {
    if (fail && fr === fail.at * 60) fail.fn(sim);
    ap.update(1 / 60); sim.step(1 / 60);
    if (sim.stats().bad) { bad = true; break; }
    if (ap.phase === 'STOPPED') break;
  }
  return { ap, bad, G: ap.report.glider, L: ap.report.landing, phases: (ap.report.phases || []).map(q => q.phase) };
}
const landed = R => !R.bad && R.L && R.L.onStrip && Math.abs(R.L.offCentre) < 20 && R.L.stopLeft > 0 && R.L.sink < 1.5 && R.ap.report.outcome === 'completed';
const words = R => (R.G ? R.G.side + '-hand at ' + R.G.field + ', ' + R.G.way + ', the glide flown ' + R.G.Em + ': ' + R.G.stages.map(q => q.stage + ' ' + q.h + ' m').join(', ') : 'NO CIRCUIT') +
  '; ' + (R.L ? 'landed ' + (R.L.onStrip ? 'on the runway' : 'OFF it') + ' ' + f(R.L.tdIn, 0) + ' m in (' + f(R.L.pastAim, 0) + ' past the aim), ' + f(Math.abs(R.L.offCentre), 1) + ' m off the centreline, sink ' + f(R.L.sink, 2) + ' m/s, ' + f(R.L.stopLeft, 0) + ' m left' : 'NO LANDING') +
  ' (' + R.ap.report.outcome + ')';

const H = AD('HOME'), hdgH = H.hdg;
// ---- CIRCUIT ----
for (const [key, h] of [['motorglider', 280], ['archaeopteryx', 360]]) {
  if (!go('CIRCUIT')) continue;
  const def = defOf(key), sim = airborne(def, H, H.x, H.z, h, hdgH, 27);
  const R = fly(def, sim, H, H, 600), st = R.G ? R.G.stages.map(q => q.stage) : [];
  row('CIRCUIT', landed(R) && ['downwind', 'base', 'final'].every(s => st.includes(s)), key + ' (motor off), ' + h + ' m over Jolene: ' + words(R));
}
// ---- TOFIRST: off Skyline Altiport, sent to Jolene ----
if (go('TOFIRST')) {
  const def = defOf('motorglider'), A = AD('tw_ski'), hd = A.hdg + Math.PI, ux = Math.cos(hd), uz = Math.sin(hd);
  const sim = airborne(def, A, A.x + ux * (A.len / 2 + 60), A.z + uz * (A.len / 2 + 60), 30, hd, 25);
  const R = fly(def, sim, A, H, 900);
  row('TOFIRST', landed(R) && R.G && R.G.field === H.name, 'off Skyline Altiport (696 m), sent to Jolene 7.6 km away: ' + words(R));
}
// ---- NEAREST: a To no glide reaches ----
if (go('NEAREST')) {
  const def = defOf('motorglider'), far = AD('w7'), sim = airborne(def, H, H.x, H.z, 280, hdgH, 27);
  const R = fly(def, sim, H, far, 600);
  row('NEAREST', landed(R) && R.G && R.G.field !== far.name, 'sent to ' + far.name + ' (' + f(Math.hypot(far.x - H.x, far.z - H.z) / 1000, 1) + ' km, out of reach) from 280 m over Jolene: ' + words(R));
}
// ---- THE EMERGENCY: a powered C172-alike loses its power 3 km out on a 15 km leg (Jolene to East Point Clearing) ----
// (its To far out of any glide's reach: the pilot must take the NEAREST field it reaches - Cannery Runway, 1.6 km off)
{
  const def = defOf('c172'), To = AD('nv_strip'), near = AD('w5');
  const hd = Math.atan2(To.z - H.z, To.x - H.x), sx = H.x + Math.cos(hd) * 2600, sz = H.z + Math.sin(hd) * 2600;
  const stop = s2 => { for (let i = 0; i < s2.eng.length; i++) s2.setEngine(i, { running: false }); };
  const cases = [
    ['FAIL300', 300, 'the engine stops at 300 m', stop],
    ['FAIL1000', 1000, 'the engine stops at 1000 m', stop],
    ['FUELDRY', 600, 'the tanks run dry at 600 m', s2 => { s2.fuel.frac = 1e-9; }],
  ];
  for (const [id, h, what, fn] of cases) {
    if (!go(id)) continue;
    const sim = airborne(def, H, sx, sz, h, hd, 50);
    for (let i = 0; i < sim.eng.length; i++) sim.setEngine(i, { key: 'both', running: true });
    const R = fly(def, sim, H, To, 700, { at: 10, fn });
    const brk = sim.damage().broken.length, said = (R.ap.report.verdicts || []).find(v => v.code === 'out-of-energy');
    row(id, !R.bad && R.L && R.L.onStrip && Math.abs(R.L.offCentre) < 20 && R.L.stopLeft > 0 && R.L.sink < 3 && brk === 0 && R.G && R.G.field === near.name && !!said, 'the C172-alike 2.6 km out on its way to ' + To.name + ' (' + f(Math.hypot(To.x - H.x, To.z - H.z) / 1000, 1) + ' km), ' + what + ': ' + (said ? said.note : 'NOT SAID') + '; ' + words(R) + '; ' + brk + ' members broken');
  }
}
console.log('GATE GLIDE: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
