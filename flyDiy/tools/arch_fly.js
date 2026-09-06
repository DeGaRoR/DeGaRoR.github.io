#!/usr/bin/env node
// THE FLIGHT-TEST SERIES, ONE CARD AT A TIME (2026-09-06, the user: "have all
// the archetypes run at least the first flight test ... For the ones clearing
// it, run all of them. Report, with the reason for failure"). Not a gate: a
// bench. GATE ARCHETYPES flies the circuit and says PASS/FAIL over the whole
// list in ~40 min; this flies ONE card through every flight test the game
// offers and prints WHY, as JSON, in a minute or five (a biplane is ~20):
//
//   node tools/arch_fly.js <key> [tests]     tests: circuit,card,crosswind,
//                                            standCalm,standXwind,hotDay
//   node tools/arch_fly.js cub | node -e "..."  (the last line is the JSON)
//
//   circuit     the test pilot's circuit to a full stop (GATE ARCHETYPES's
//               own loop; 420 s, 640 for a glider) — THE FIRST FLIGHT TEST;
//               the series stops here if it is red
//   card        the test card: 150 m at the sheet's own cruise speed, held
//               within 7 % on the settled leg (the plaque's 'held' row)
//   crosswind   genCrosswindLimit — the plaque's number, ok at >= 4 m/s
//   standCalm   a departure from the stand, GATE TAKEOFF's judge (taxi
//   standXwind  cross-track, a real stop on the hold, a straight roll, a
//               lift-off inside 4 m / 12 m in a 2 m/s crosswind)
//   hotDay      the circuit on GATE HOTHIGH's day (35 C, 1008 hPa, wind)
//
// The spec flown is designBake's, pre-join, exactly as GATE ARCHETYPES flies
// it (its loadPanel, verbatim). Every card is composed through the same
// code path the birth overlay applies. Measured with it on 2026-09-06: the
// G195.1 engine-index regression (every card on another card's engine), the
// three electric cards' negative margins, the Whittaker's 76 s roll.
'use strict';
const path = require('path');
const T = __dirname;
function loadPanel() {
  const CORE = require(path.join(T, 'flight_core.js'));
  for (const k of Object.keys(CORE)) global[k] = CORE[k];
  const noop = function () { return this; };
  class Obj { constructor() { this.children = []; this.position = { set: noop }; this.rotation = {}; this.scale = { set: noop, setScalar: noop }; } add() { return this; } remove() {} traverse() {} }
  global.THREE = new Proxy({}, { get: (t, k) => { if (k === 'Vector3') return function () { return { set: noop, x: 0, y: 0, z: 0 }; }; return class extends Obj {}; } });
  global.window = { THREE: global.THREE };
  for (const f of ['_cage_parts.js', '_cage_page5.js', '_cage_gen.js', '_cage_crew.js', '_gear_kit.js', '_gear_gen.js', '_gear_page.js', '_cage_gear.js', '_fit_site.js', '_fit_gen.js', '_eng_gen.js', '_eng_mesh.js', '_eng_page.js', '_cowl_gen.js', '_cowl_rows.js', '_cage_cowl.js', '_cage_eng.js', '_strut_gen.js', '_cage_wing.js', '_cage_brace.js', '_fin_gen.js', '_cage_fin.js', '_cage_stab.js', '_cage_access.js', '_cage_light.js'])
    require(path.join(T, f));
  global.window.CAGE_JOIN_ENGINES = require(path.join(T, '_cage_join.js')).CAGE_JOIN_ENGINES;
}
loadPanel();
const D = require(path.join(T, '_cage_design.js'));
const C = require(path.join(T, 'flight_core.js'));

const key = process.argv[2];
const ONLY = (process.argv[3] || '').split(',').filter(Boolean); // a subset of the tests
const a = D.ARCHETYPES.find(x => x.key === key);
if (!a) {
  console.log('no such archetype: ' + key + '\n  keys: ' + D.ARCHETYPES.map(x => x.key).join(' '));
  process.exit(1);
}
const out = { key, name: a.name, tests: {} };
const t0 = Date.now();
const wall = () => Math.round((Date.now() - t0) / 1000);
const want = t => !ONLY.length || ONLY.includes(t);

const inactive = D.archInactive(a);
if (inactive) { out.skipped = inactive; console.log(JSON.stringify(out)); process.exit(0); }

const spec = D.designBake(a.sel, a.over);
const def0 = C.buildGen(spec);
let sh;
try { sh = C.genShakedown(def0); } catch (e) { out.error = 'shakedown: ' + e.message; console.log(JSON.stringify(out)); process.exit(0); }
const pick = (o, ks) => { const r = {}; for (const k of ks) r[k] = typeof o[k] === 'number' ? +o[k].toFixed(3) : o[k]; return r; };
out.shakedown = pick(sh, ['flyableCircuit', 'climbRate', 'TORun', 'Vs', 'VCruise', 'LDbest', 'staticMargin', 'cnBeta', 'wingLoad', 'propClear', 'noseOver', 'gearType', 'nEngines', 'engMount', 'cgX', 'npX']);
out.mass = +C.makeSim(def0).totalM.toFixed(0);
out.ap = pick(def0.params.ap, ['VClimb', 'VCruise', 'VAppr', 'hCruise', 'hSafe', 'TORun']);
const role = D.optionOf('role', a.sel.role);
out.role = a.sel.role;
const glider = role && role.value === 'glider';

function circuit(opts) {
  opts = opts || {};
  const world = C.makeWorld();
  if (opts.weather) world.setWeather(opts.weather);
  const def = C.buildGen(spec);
  const sim = C.makeSim(def, world);
  sim.reset(0);
  for (let i = 0; i < 600; i++) sim.step(1 / 60);
  const ap = C.makePilot(sim, def, world);
  if (opts.card) ap.setCard(opts.card);
  const maxS = opts.maxS || (glider ? 640 : 420);
  let tEnd = maxS, nan = false, aglMax = 0;
  const phases = [];
  let last = null;
  for (let s = 0; s < maxS * 60; s++) {
    ap.update(1 / 60); sim.step(1 / 60);
    if (ap.phase !== last) { phases.push(ap.phase + '@' + (s / 60).toFixed(0)); last = ap.phase; }
    if (sim.stats().bad) { nan = true; tEnd = s / 60; break; }
    aglMax = Math.max(aglMax, ap.dbg.agl || 0);
    if (ap.phase === 'STOPPED' && ap.t > 5) { tEnd = s / 60; break; }
  }
  const rep = ap.report;
  const L = rep.landing;
  return { ok: !nan && rep.outcome === 'completed' && ap.phase === 'STOPPED' && tEnd < maxS,
           outcome: nan ? 'broke-up' : (rep.outcome || 'gave-up'), phase: ap.phase, t: +tEnd.toFixed(0), aglMax: +aglMax.toFixed(0),
           verdicts: rep.verdicts.map(v => v.t + 's ' + v.code + ': ' + v.note),
           landing: L ? { run: +L.run.toFixed(0), sink: +L.sink.toFixed(2), V: +L.V.toFixed(1), pastAim: +L.pastAim.toFixed(0), off: +L.offCentre.toFixed(1) } : null,
           card: rep.card ? { alt: rep.card.alt, V: rep.card.V, altCmd: rep.card.altCmd, VCmd: rep.card.VCmd, altFlown: rep.card.altFlown && +rep.card.altFlown.toFixed(0), VFlown: rep.card.VFlown && +rep.card.VFlown.toFixed(1) } : null,
           phases: phases.join(' ') };
}

// T1 the first flight: the circuit
if (want('circuit')) {
  out.tests.circuit = circuit();
  out.tests.circuit.wall = wall();
  if (!out.tests.circuit.ok) { out.firstFlight = false; console.log(JSON.stringify(out)); process.exit(0); }
  out.firstFlight = true;
}

// T2 the test card: the aeroplane's own cruise speed at 150 m
if (want('card')) {
  const r = circuit({ card: { alt: 150, V: def0.params.ap.VCruise } });
  const cd = r.card;
  r.held = !!cd && cd.altFlown != null && cd.VFlown != null && cd.altFlown >= 0.93 * cd.altCmd && cd.VFlown >= 0.93 * cd.VCmd;
  r.ok = r.ok && r.held;
  r.wall = wall();
  out.tests.card = r;
}

// T3 the crosswind limit
if (want('crosswind')) {
  const xw = C.genCrosswindLimit(C.buildGen(spec));
  out.tests.crosswind = { ok: xw.limit == null || xw.limit >= 4, limit: xw.limit == null ? '> ' + xw.cap : xw.limit, roll: xw.roll, band: xw.band, e: xw.e != null ? +(xw.e * 57.3).toFixed(1) : null,
                          failWhy: xw.failWhy, runs: xw.runs.map(r => r.w + (r.ok ? ' ok' : ' x(' + (r.why || '') + ')')).join(', '), wall: wall() };
}

// T4/T5 departures from the stand (calm; 2 m/s crosswind), GATE TAKEOFF's judge
function depart(opts) {
  const world = C.makeWorld();
  if (opts.wind && world.setWind) world.setWind({ base: [opts.wind[0], 0, opts.wind[1]], gust: 0 });
  const def = C.buildGen(spec);
  const ad = world.aerodromes[0], site = C.siteOf('HOME');
  const sim = C.makeSim(def, world);
  sim.reset(0);
  for (let i = 0; i < 600; i++) sim.step(1 / 60);
  if (sim.stance) sim.stance();
  C.placeAtStand(sim, ad, site.stand);
  const ap = C.makePilot(sim, def, world);
  ap.setRoute(ad, ad);
  ap.departFrom(ad, ad, site);
  const posts = [];
  for (const [x0, x1] of site.fence.runs)
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1) + 1e-6; x += site.fence.step) posts.push([x, site.fence.z]);
  const R = C.siteRunway(ad);
  const rec = { phases: [], maxXT: 0, minPost: 1e9, offStrip: 0, stopped: false, minVgHold: 1e9, roll: null, maxSCrRoll: 0, lift: null, tRoll: null, rejected: false, t: 0, nan: false };
  let last = null;
  const Tm = 300;
  for (let s = 0; s < Tm * 60; s++) {
    ap.update(1 / 60); sim.step(1 / 60);
    if (sim.stats().bad) { rec.nan = true; break; }
    const t = s / 60, d = ap.dbg || {}, cg = sim.cgPos();
    const Vg = Math.hypot(...sim.cgVel());
    if (ap.phase !== last) { rec.phases.push(ap.phase + '@' + t.toFixed(0)); last = ap.phase; }
    if (ap.phase === 'TAXI') {
      rec.maxXT = Math.max(rec.maxXT, Math.abs(d.xt || 0));
      for (const p of posts) rec.minPost = Math.min(rec.minPost, Math.hypot(cg[0] - p[0], cg[2] - p[1]));
      const along = (cg[0] - R.end0.x) * R.dx + (cg[2] - R.end0.z) * R.dz;
      const cross = Math.abs((cg[0] - R.cx) * R.nx + (cg[2] - R.cz) * R.nz);
      if (cross < R.half && (along < -2 || along > R.len + 2)) rec.offStrip++;
    }
    if (ap.phase === 'HOLD') { rec.minVgHold = Math.min(rec.minVgHold, Vg); if (Vg < 0.3) rec.stopped = true; }
    if (ap.phase === 'ROLL') {
      if (!rec.roll) { rec.roll = { sCr: +(d.z || 0).toFixed(2), e: +((d.e || 0) * 57.3).toFixed(1) }; rec.tRoll = +t.toFixed(0); }
      rec.maxSCrRoll = Math.max(rec.maxSCrRoll, Math.abs(d.z || 0));
    }
    if (ap.report.verdicts.some(v => v.code === 'rejected-takeoff')) rec.rejected = true;
    if ((ap.phase === 'LIFTOFF' || ap.phase === 'CLIMB') && (d.agl || 0) > (def.params.ap.hSafe || 8)) {
      rec.lift = { t: +t.toFixed(0), sCr: +(d.z || 0).toFixed(2), e: +((d.e || 0) * 57.3).toFixed(1), V: +(d.V || 0).toFixed(1) };
      rec.t = t; break;
    }
    if (ap.phase === 'STOPPED') { rec.t = t; break; }
    rec.t = t;
  }
  const lim = opts.wind ? 12 : 4;
  const fails = [];
  if (!rec.phases.some(p => p.startsWith('TAXI'))) fails.push('never taxied');
  if (rec.maxXT >= 2.5) fails.push('taxi cross-track ' + rec.maxXT.toFixed(1) + ' m');
  if (rec.minPost <= 2) fails.push('fence post at ' + rec.minPost.toFixed(1) + ' m');
  if (rec.offStrip) fails.push('on the flanks ' + rec.offStrip + ' frames');
  if (!(rec.phases.some(p => p.startsWith('HOLD')) && rec.stopped)) fails.push('no real stop on the hold (min Vg ' + (rec.minVgHold === 1e9 ? '-' : rec.minVgHold.toFixed(2)) + ')');
  if (!(rec.roll && Math.abs(rec.roll.sCr) < 2.5 && Math.abs(rec.roll.e) < 6)) fails.push('roll not lined up ' + JSON.stringify(rec.roll));
  if (rec.maxSCrRoll >= lim) fails.push('roll wandered ' + rec.maxSCrRoll.toFixed(1) + ' m');
  if (!(rec.lift && Math.abs(rec.lift.sCr) < lim && Math.abs(rec.lift.e) < 6)) fails.push(rec.lift ? 'lift-off off ' + rec.lift.sCr + ' m / ' + rec.lift.e + ' deg' : 'never airborne');
  if (rec.rejected) fails.push('rejected take-off');
  if (!opts.wind && !(rec.tRoll != null && rec.tRoll < 150)) fails.push('stand to roll ' + rec.tRoll + ' s');
  if (rec.nan) fails.push('NaN');
  const verdicts = ap.report.verdicts.map(v => v.t + 's ' + v.code + ': ' + v.note);
  return { ok: fails.length === 0, fails, phases: rec.phases.join(' '), maxXT: +rec.maxXT.toFixed(2), minPost: +rec.minPost.toFixed(1), roll: rec.roll, maxSCrRoll: +rec.maxSCrRoll.toFixed(2), lift: rec.lift, tRoll: rec.tRoll, verdicts, wall: wall() };
}
if (want('standCalm')) out.tests.standCalm = depart({});
if (want('standXwind')) out.tests.standXwind = depart({ wind: [0, 2] });

// T6 the hot day circuit (GATE HOTHIGH's day)
if (want('hotDay')) {
  out.tests.hotDay = circuit({ weather: { oatC: 35, qnhPa: 100800, wind: { base: [-2.2, 0, 2.6], gust: 0.7, refH: 10 } } });
  out.tests.hotDay.wall = wall();
}
out.wall = wall();
console.log(JSON.stringify(out));
