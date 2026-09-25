#!/usr/bin/env node
// ============================================================
// PHYSICS PERF - what the SOLVER and THE PILOT cost a frame, headless.
//
// The graphics were measured to the draw (frame_perf.js, PERF-2026-09-23); this
// measures the other half of the main thread: the per-frame `script(1/60)` +
// `sim.step(1/60)` the game's loop runs (app.js loop()), on the game's own
// road - the island with its premises, the build on the site's stand, the
// pilot's departFrom taxiing it out of the door - so the roll-out, the one
// sequence every player flies again and again, is what is timed.
//
//   node tools/physics_perf.js                         the stock build, Jolene, calm, the roll-out
//   node tools/physics_perf.js --build bugReports/cessnaFloats.json   a saved build (floats start on the SEA lane)
//   node tools/physics_perf.js --preset thermal        a WEATHER_UI preset's wind (calm/breeze/ridge/thermal/hot/front/gale)
//   node tools/physics_perf.js --world none            the analytic world
//   node tools/physics_perf.js --secs 60 --warm 2      the clock (after `warm` s of settle)
//   node tools/physics_perf.js --arch stearman         an archetype (tools/_cage_design.js ARCHETYPES)
//   node tools/physics_perf.js --hash                  + the trajectory's FNV hash (every node's p, v)
//   node tools/physics_perf.js --core snap.js          fly another flight_core.js (the A of an A/B)
//   node --cpu-prof tools/physics_perf.js ...          a V8 profile of the same run
//
// Prints per phase of the pilot: frames, the median / p90 / max ms of the
// pilot's update and of the solver's step, the longest frames and when they
// fall, and the climate's counters. An optimisation that claims to change
// nothing prints the same HASH line before and after; time A and B at the
// same moment (the machine's speed drifts between runs). The audit that
// made it: futureDesigns/PHYSICS-PERF-2026-09-24.md (G572).
// ============================================================
'use strict';
const path = require('path');
const fs = require('fs');
const T = __dirname;
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };

// --core <file>: fly another flight_core.js (a snapshot of the code before a change: the A/B's A)
const CORE_PATH = arg('core', null) ? path.resolve(arg('core')) : path.join(T, 'flight_core.js');
function loadPanel() {
  const CORE = require(CORE_PATH);
  for (const k of Object.keys(CORE)) global[k] = CORE[k];
  const noop = function () { return this; };
  class Obj { constructor() { this.children = []; this.position = { set: noop }; this.rotation = {}; this.scale = { set: noop, setScalar: noop }; } add() { return this; } remove() {} traverse() {} }
  global.THREE = new Proxy({}, { get: (t, k) => { if (k === 'Vector3') return function () { return { set: noop, x: 0, y: 0, z: 0 }; }; return class extends Obj {}; } });
  global.window = { THREE: global.THREE };
  for (const f of ['_cage_parts.js', '_cage_page5.js', '_cage_gen.js', '_cage_crew.js', '_gear_kit.js', '_gear_gen.js', '_gear_page.js', '_cage_gear.js', '_fit_site.js', '_fit_gen.js', '_eng_gen.js', '_eng_mesh.js', '_eng_page.js', '_cowl_gen.js', '_cowl_rows.js', '_cage_cowl.js', '_cage_eng.js', '_strut_gen.js', '_boom_gen.js', '_cage_wing.js', '_cage_brace.js', '_fin_gen.js', '_cage_fin.js', '_cage_stab.js', '_cage_access.js', '_cage_light.js'])
    require(path.join(T, f));
  global.window.CAGE_JOIN_ENGINES = require(path.join(T, '_cage_join.js')).CAGE_JOIN_ENGINES;
  return CORE;
}

const C = loadPanel();
const worldId = arg('world', 'jolene');
const t0 = Date.now();
let world;
if (worldId === 'none') world = C.makeWorld();
else {
  const IN = require(path.join(T, 'island_node.js'));
  const fx = path.join(T, 'fixtures', 'island_' + worldId + '.json');
  // composed with THIS core (island_node's islandWorld requires tools/flight_core.js, which is the B of an A/B)
  const boot = IN.islandBoot(worldId);
  if (!boot) throw new Error('no island ' + worldId);
  world = C.makeWorld(0, { island: C.ISLAND_GEN.makeIsland(boot), premises: fs.existsSync(fx) ? fs.readFileSync(fx, 'utf8') : null });
}
const tWorld = Date.now() - t0;
const preset = arg('preset', 'calm');
if (preset !== 'calm') {
  // the WEATHER_UI rows, the wind only (the same specs the page's presets hand world.setDay)
  const P = {
    breeze: { kts: 8, dirDeg: 250, gust: 0.15, refH: 10, breeze: 1 },
    ridge: { kts: 20, dirDeg: 270, gust: 0.3, refH: 10, terrain: 1, aloftK: 1.25, veerDeg: 15 },
    thermal: { kts: 7, dirDeg: 200, gust: 0.25, refH: 10, terrain: 0.7, thermals: 1 },
    hot: { kts: 5, dirDeg: 210, gust: 0.35, refH: 10 },
    front: { kts: 12, dirDeg: 190, gust: 0.35, refH: 10, terrain: 0.6 },
    gale: { kts: 35, dirDeg: 245, gust: 0.5, refH: 10, terrain: 1, aloftK: 1.3, veerDeg: 20 },
  }[preset];
  if (!P) throw new Error('no preset ' + preset);
  world.setDay({ wind: P });
}

const buildPath = arg('build', null), archKey = arg('arch', null);
const spec = buildPath ? (j => j.spec || j)(JSON.parse(fs.readFileSync(buildPath, 'utf8')))
  : archKey ? (() => { const D = require(path.join(T, '_cage_design.js')); const a = D.ARCHETYPES.find(x => x.key === archKey);
      if (!a) throw new Error('no archetype ' + archKey + ': ' + D.ARCHETYPES.map(x => x.key).join(' ')); return D.designBake(a.sel, a.over); })()
  : JSON.parse(fs.readFileSync(path.join(T, 'fixtures', 'build_v9_stock_2026-09-15.json'), 'utf8')).spec;
const def = C.buildGen(C.genMigrateSpec ? C.genMigrateSpec(spec) : spec);
// --subcap N (an EXPERIMENT, not the game): every beam that asks more than N substeps has its spring
// (omega dt 0.45) and its damper (c dt 0.65) cut to what N carries, and the build flies N - what a
// stiffness cap would cost the flight. --tip prints the wing tips' height over the root in the air.
const SUBCAP = +arg('subcap', 0);
const capInfo = { k: 0, c: 0, kMin: 1 };
if (SUBCAP > 0) {
  const N = def.nodes, dry = i => (N[i].mFuel ? Math.max(0.5, N[i].m - N[i].mFuel) : N[i].m), dt = 1 / (60 * SUBCAP);
  for (const b of def.beams) {
    const inv = 1 / dry(b.a) + 1 / dry(b.b);
    const kMax = (0.45 / dt) * (0.45 / dt) / inv, cMax = 0.65 / (inv * dt);
    if (b.k > kMax) { capInfo.kMin = Math.min(capInfo.kMin, kMax / b.k); b.k = kMax; capInfo.k++; }
    if (b.c > cMax) { b.c = cMax; capInfo.c++; }
  }
  def.params.substeps = Math.min(def.params.substeps, SUBCAP);
}
const sim = C.makeSim(def, world);
sim.reset(0);
const home = world.aerodromes.find(a => a.id === 'HOME') || world.aerodromes[0];
const ap = C.makePilot(sim, def, world, { style: 'normal' });
let where;
if (sim.hydro) {
  const sea = world.aerodromes.find(a => a.id === 'SEA') || { hdg: Math.PI / 2, spawn: [0, 1285], elev: 0 };
  C.placeAtAerodrome(sim, sea); ap.setRoute(sea, sea); where = 'SEA lane';
} else {
  const site = typeof C.siteOf === 'function' ? C.siteOf(home.id) : null;
  if (typeof sim.stance === 'function') sim.stance();
  if (site && site.stand) { C.placeAtStand(sim, home, site.stand); ap.setRoute(home, home); ap.departFrom(home, home, site); where = 'the stand'; }
  else { C.placeAtAerodrome(sim, home); ap.setRoute(home, home); where = 'the spawn'; }
}
const secs = +arg('secs', 90), warm = +arg('warm', 0);
const nowMs = () => Number(process.hrtime.bigint()) / 1e6;
const rows = {};
const phaseOrder = [];
const cstat = world.climate && world.climate.stats;
const spikes = [];   // [frame ms, sim s]: where the long frames fall (a warm-up, or a recurring hitch)
for (let s = 0; s < (warm + secs) * 60; s++) {
  const a = nowMs(); ap.update(1 / 60);
  const b = nowMs(); sim.step(1 / 60);
  const c = nowMs();
  if (s < warm * 60) continue;
  const ph = ap.phase || '?';
  let r = rows[ph];
  if (!r) { r = rows[ph] = { ap: [], sim: [], smp: 0, skp: 0 }; phaseOrder.push(ph); }
  r.ap.push(b - a); r.sim.push(c - b);
  spikes.push([c - a, s / 60]);
  r.smp += sim.out.gndSampled || 0; r.skp += sim.out.gndSkipped || 0;
}
const q = (a, f) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
const f2 = v => v.toFixed(2);
console.log(`world ${worldId} (${tWorld} ms) · build ${buildPath || 'stock'} · ${def.nodes.length} nodes, ${def.beams.length} beams, ${def.strips.length} strips, substeps ${def.params.substeps ?? 24}${sim.hydro ? ', FLOATS' : ''} · wind ${preset} · from ${where}`);
console.log('phase          frames |  pilot med/p90/max ms |  solver med/p90/max ms | gnd samples/frame (skipped)');
let allAp = [], allSim = [];
for (const ph of phaseOrder) {
  const r = rows[ph]; allAp = allAp.concat(r.ap); allSim = allSim.concat(r.sim);
  console.log(`${ph.padEnd(14)} ${String(r.ap.length).padStart(6)} | ${f2(q(r.ap, .5)).padStart(6)} ${f2(q(r.ap, .9)).padStart(6)} ${f2(q(r.ap, 1)).padStart(7)} | ${f2(q(r.sim, .5)).padStart(6)} ${f2(q(r.sim, .9)).padStart(6)} ${f2(q(r.sim, 1)).padStart(7)} | ${(r.smp / r.ap.length).toFixed(0)} (${(r.skp / r.ap.length).toFixed(0)})`);
}
const mean = a => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
console.log(`ALL            ${String(allAp.length).padStart(6)} | mean pilot ${f2(mean(allAp))} ms, solver ${f2(mean(allSim))} ms, total ${f2(mean(allAp) + mean(allSim))} ms a frame`);
{ const sp = spikes.slice().sort((x, y) => y[0] - x[0]).slice(0, 6);
  const med = q(spikes.map(x => x[0]), 0.5);
  console.log('longest frames: ' + sp.map(x => x[0].toFixed(0) + ' ms @ ' + x[1].toFixed(2) + ' s').join(', ') + ` · frames over 2x the median: ${spikes.filter(x => x[0] > 2 * med).length}, of them after the first 2 s: ${spikes.filter(x => x[0] > 2 * med && x[1] > 2 + warm).length}`); }
if (SUBCAP > 0) console.log(`subcap ${SUBCAP}: ${capInfo.k} springs cut (to x${capInfo.kMin.toFixed(2)} at most), ${capInfo.c} dampers`);
if (argv.includes('--tip')) {
  // the wing's bend: each tip's front spar node over the root's, in the aeroplane's up axis
  const [, yU] = sim.axes(); const P = sim.p;
  let rootI = -1, tipL = -1, tipR = -1, zR = Infinity, zMin = Infinity, zMax = -Infinity;
  for (const st of def.strips) if (st.kind === 'wing' && (st.plane | 0) === 0) for (const i of [st.fIn, st.fOut]) {
    const z = def.nodes[i].p[2]; if (Math.abs(z) < zR) { zR = Math.abs(z); rootI = i; } if (z < zMin) { zMin = z; tipL = i; } if (z > zMax) { zMax = z; tipR = i; } }
  const up = (i, j) => (P[i*3]-P[j*3]) * yU[0] + (P[i*3+1]-P[j*3+1]) * yU[1] + (P[i*3+2]-P[j*3+2]) * yU[2];
  const up0 = (i, j) => def.nodes[i].p[1] - def.nodes[j].p[1];
  console.log(`wing bend (tip over root, change from the drawn pose): L ${((up(tipL, rootI) - up0(tipL, rootI)) * 1000).toFixed(1)} mm, R ${((up(tipR, rootI) - up0(tipR, rootI)) * 1000).toFixed(1)} mm · V ${sim.out.V.toFixed(1)} m/s, alt ${sim.out.alt.toFixed(0)} m`);
}
if (cstat) console.log('climate:', JSON.stringify(cstat));
// --hash: the trajectory's fingerprint (every node's p and v, to the bit) - an optimisation that claims
// to change nothing must print the same line before and after
if (argv.includes('--hash')) {
  const st = sim.state ? sim.state() : null, P = (st && st.p) || sim.p, V = (st && st.v) || sim.v;
  let h = 0x811c9dc5 >>> 0;
  const eat = arr => { const u = new Uint8Array(new Float64Array(arr).buffer); for (let i = 0; i < u.length; i++) h = Math.imul(h ^ u[i], 16777619) >>> 0; };
  eat(P); eat(V);
  console.log('HASH ' + h.toString(16).padStart(8, '0') + ' t ' + (ap.t != null ? ap.t.toFixed(2) : '?') + ' phase ' + ap.phase + ' cg ' + sim.cgPos().map(x => x.toFixed(6)).join(','));
}
