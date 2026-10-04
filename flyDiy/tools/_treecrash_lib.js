// G1470 (TREE-CRASH): the scenarios GATE TREECRASH (_treecrash_check.js) and its evidence (treecrash_evidence.js)
// fly, on the user's validated builds, node only: the load test, a flown 3.8 g pull, a hard landing at the gear's
// limit, a whole circuit with the pilot, a wingtip brushing a trunk at walking pace, a taxi into a trunk and a flight
// into one at 30 m/s. Each returns what the damage model did (sim.damage()) and, under `probe`, every member's peak
// force over its yield (params.damageProbe: nothing yields, the peaks are read per substep).
'use strict';
const path = require('path'), fs = require('fs');
const T = __dirname;

let C = null;
function core() {
  if (C) return C;
  C = require(path.join(T, 'flight_core.js'));
  for (const k of Object.keys(C)) global[k] = C[k];
  // the cage / gear / engine kits a saved build's join needs (tools/physics_perf.js's loader)
  const noop = function () { return this; };
  class Obj { constructor() { this.children = []; this.position = { set: noop }; this.rotation = {}; this.scale = { set: noop, setScalar: noop }; } add() { return this; } remove() {} traverse() {} }
  if (!global.THREE) global.THREE = new Proxy({}, { get: (t, k) => { if (k === 'Vector3') return function () { return { set: noop, x: 0, y: 0, z: 0 }; }; return class extends Obj {}; } });
  if (!global.window) global.window = { THREE: global.THREE };
  for (const f of ['_cage_parts.js', '_cage_page5.js', '_cage_gen.js', '_cage_crew.js', '_gear_kit.js', '_gear_gen.js', '_gear_page.js', '_cage_gear.js', '_fit_site.js', '_fit_gen.js', '_eng_gen.js', '_eng_mesh.js', '_eng_page.js', '_cowl_gen.js', '_cowl_rows.js', '_cage_cowl.js', '_cage_eng.js', '_strut_gen.js', '_boom_gen.js', '_cage_wing.js', '_cage_brace.js', '_fin_gen.js', '_cage_fin.js', '_cage_stab.js', '_cage_access.js', '_cage_light.js'])
    require(path.join(T, f));
  global.window.CAGE_JOIN_ENGINES = require(path.join(T, '_cage_join.js')).CAGE_JOIN_ENGINES;
  return C;
}

// the validated aeroplanes (tools/master_bench.js BUILDS): the user's Cub, the Jodel, the metal Cessna, the Cessna on
// floats and the twin on floats
const BUILDS = {
  cub: { label: 'Cub', build: 'builds/cub_2026-09-20_corrected.json' },
  jodel: { label: 'Jodel', build: 'builds/jodel_2026-09-20_corrected.json' },
  metal: { label: 'metal Cessna', build: 'bugReports/cessnaMetal (1).json' },
  floats: { label: 'Cessna floats', build: 'bugReports/cessnaFloatsWOrks.json' },
  twinFloats: { label: 'twin floatplane', build: 'tools/fixtures/build_v7_ultralight_2026-09-05.json', patch: j => { j.spec.gear.type = 'floats'; j.spec.cage = Object.assign({}, j.spec.cage, { gearFloats: 1 }); return j; } },
};
const _defs = {};
function defOf(key, opts) {
  const C = core(), B = BUILDS[key];
  if (!_defs[key]) {
    let j = JSON.parse(fs.readFileSync(path.join(T, '..', B.build), 'utf8'));
    if (B.patch) j = B.patch(j);
    const spec = j.spec || j;
    _defs[key] = C.buildGen(C.genMigrateSpec ? C.genMigrateSpec(spec) : spec);
  }
  const d = _defs[key];
  // a shallow copy with its own params (the probe flag) - the beams are copied by makeSim
  return Object.assign({}, d, { params: Object.assign({}, d.params, (opts && opts.probe) ? { damageProbe: true } : {}, (opts && opts.elastic) ? { damage: false } : {}) });
}

// a flat world at `elev` with a trunk set of its own (the TREEHIT gate's world)
function flatWorld(elev) {
  const C = core(), W0 = C.makeWorld(0, {}), TH = C.TREE_HITS.make();
  const W = Object.assign({}, W0, { terrainH: () => elev, obstacles: C.OBSTACLES.make(), trees: [], treesNear: (x, z, q) => { q.length = 0; return q; }, treeHits: TH });
  return { W, TH, strip: W0.aerodromes.find(a => a.id === 'HOME') || W0.aerodromes[0] };
}

const peakOf = sim => { const P = sim.damagePeak && sim.damagePeak(); if (!P) return null; let t = 0, c = 0, bt = -1, bc = -1;
  for (let i = 0; i < P.t.length; i++) { if (P.t[i] > t) { t = P.t[i]; bt = i; } if (P.c[i] > c) { c = P.c[i]; bc = i; } }
  return { t, c, bt, bc, clsT: bt >= 0 ? sim.beams[bt].cls : null, clsC: bc >= 0 ? sim.beams[bc].cls : null, max: Math.max(t, c) }; };
const clearPeak = sim => { const P = sim.damagePeak && sim.damagePeak(); if (P) { P.t.fill(0); P.c.fill(0); } };
// (a core from before G1470 has no damage: read as an empty one, so the evidence can fly master's core too)
const NODMG = { yields: 0, breaks: 0, work: 0, setMax: 0, crashed: false, reason: null, at: null, dented: false, propStrike: false, propAt: null, gPeak: 0, broken: [], members: 0, dents: 0, primary: 0, over: false };
const dmgSim = sim => (sim.damage ? sim.damage() : NODMG);
const dmgOf = sim => { const D = dmgSim(sim); return { members: D.members, dents: D.dents, yields: D.yields, breaks: D.breaks, work: D.work, setMax: D.setMax, crashed: D.crashed,
  reason: D.reason, at: D.at, dented: D.dented, propStrike: D.propStrike, propAt: D.propAt, gPeak: D.gPeak, broken: D.broken.slice(),
  brokenCls: D.broken.map(i => sim.beams[i].cls) }; };
const finite = sim => { for (let i = 0; i < sim.p.length; i++) if (!Number.isFinite(sim.p[i]) || !Number.isFinite(sim.v[i])) return false; return true; };
// the furthest node from the CG (a node flung away would show here)
const spread = sim => { const c = sim.cgPos(); let r = 0; for (let i = 0; i < sim.n; i++) r = Math.max(r, Math.hypot(sim.p[i*3] - c[0], sim.p[i*3+1] - c[1], sim.p[i*3+2] - c[2])); return r; };

// THE LOAD TEST to `ult` (the garage's own rig), the peak recorded at the limit and at the ultimate
function loadTest(key, o) {
  const C = core(), def = defOf(key, o), spec = def.spec;
  const sim = C.makeSim(def, null); sim.reset(0);
  const rig = C.makeLoadTest(sim, def, { material: spec.fuselage && spec.fuselage.material, wingMaterial: C.genSurfKey ? C.genSurfKey(spec, 'wing', 0) : undefined,
    surface: o.surface || 'wing', limit: o.limit || C.GEN_LOAD_LIMIT, ult: o.ult || C.GEN_LOAD_ULT });
  let atLim = null, ok = rig.state.ok;
  for (let f = 0; f < 60 * 40 && !rig.state.done; f++) {
    rig.step(1 / 60);
    if (!atLim && rig.state.limitPct !== null) atLim = { peak: peakOf(sim), dmg: dmgOf(sim), tip: rig.state.limitPct, yieldPct: rig.state.limitYield };
  }
  return { ok, limit: atLim, ult: { peak: peakOf(sim), dmg: dmgOf(sim), tip: rig.state.ultPct, yieldPct: rig.state.ultYield, verdict: rig.state.verdict }, finite: finite(sim) };
}

// A FLOWN PULL to nz (3.8 g): level at `V` m/s, 400 m up, the elevator on a PI to the load factor, held `hold` s
function pull(key, o) {
  const C = core(), def = defOf(key, o), { W, strip } = flatWorld(0), nzT = o.nz || 3.8, V = o.V || 45;
  const sim = C.makeSim(def, W); sim.reset(0);
  C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0, spawnElev: 400 }));
  const fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg);
  for (let i = 0; i < sim.n; i++) { sim.v[i*3] = V * fx; sim.v[i*3+2] = V * fz; }
  sim.ctl.thr = 1;
  // the elevator's sense: a nose-up input is the one that raises nz (found, not assumed)
  let de = 0, I = 0, nzMax = 0, held = 0, sgn = o.sgn || -1;
  for (let f = 0; f < 60 * 1; f++) { sim.step(1 / 60); }   // a second to settle in the air (the trim transient's own load)
  clearPeak(sim);
  const t0 = sim.t, hist = [];
  for (let f = 0; f < 60 * (o.secs || 6); f++) {
    const tgt = Math.min(nzT, 1 + (nzT - 1) * (f / 60) / 1.0);   // the target ramped over a second (no overshoot past it)
    const e = tgt - sim.out.nz; I += e / 60;
    de = Math.max(-1, Math.min(1, sgn * (0.4 * e + 0.8 * I)));
    sim.ctl.de = de;
    sim.step(1 / 60);
    nzMax = Math.max(nzMax, sim.out.nz);
    if (sim.out.nz > nzT - 0.1) held += 1 / 60;
    if (f % 6 === 0) hist.push([sim.t - t0, sim.out.nz, sim.out.V]);
    if (held > (o.hold || 1.5)) break;
  }
  return { nzMax, held, V: sim.out.V, peak: peakOf(sim), dmg: dmgOf(sim), finite: finite(sim), hist };
}

// A HARD LANDING: the aeroplane settled on its wheels, lifted `gap` m and dropped onto them at `sink` m/s (no lift:
// a drop test with the wing's lift taken as zero, harsher than FAR 23.725's 2/3 W)
// (a floatplane drops onto the analytic world's sea lane, its floats on the water)
function hardLanding(key, o) {
  const C = core(), def = defOf(key, o);
  let W, strip, sim;
  const probe = C.makeSim(def, null);
  if (probe.hydro) { W = C.makeWorld(); strip = W.aerodromes.find(a => a.id === 'SEA'); sim = C.makeSim(def, W); sim.reset(0); C.placeAtAerodrome(sim, strip); }
  else { ({ W, strip } = flatWorld(0)); sim = C.makeSim(def, W); sim.reset(0); C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0, spawnElev: 0 })); }
  for (let f = 0; f < 240; f++) sim.step(1 / 60);
  const gap = o.gap == null ? 0.02 : o.gap, sink = o.sink;
  for (let i = 0; i < sim.n; i++) { sim.p[i*3+1] += gap; sim.v[i*3] = 0; sim.v[i*3+1] = -sink; sim.v[i*3+2] = 0; }
  if (o.fwd) { const fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg); for (let i = 0; i < sim.n; i++) { sim.v[i*3] = o.fwd * fx; sim.v[i*3+2] = o.fwd * fz; } }
  clearPeak(sim);
  let gMax = 0, yMin = Infinity;
  for (let f = 0; f < 120; f++) { sim.step(1 / 60); gMax = Math.max(gMax, sim.out.nz); }
  return { gMax, peak: peakOf(sim), dmg: dmgOf(sim), finite: finite(sim) };
}

// A CIRCUIT: the pilot from the runway, round and down to a stop (or `maxS`) on the analytic world
function circuit(key, o) {
  const C = core(), def = defOf(key, o), world = C.makeWorld();
  const sim = C.makeSim(def, world); sim.reset(0);
  const a = world.aerodromes.find(x => x.id === (sim.hydro ? 'SEA' : 'HOME')) || world.aerodromes[0];
  if (sim.hydro) C.placeAtAerodrome(sim, a);
  for (let i = 0; i < 600; i++) sim.step(1 / 60);
  const ap = C.makePilot(sim, def, world);
  if (sim.hydro) ap.setRoute(a, a);
  clearPeak(sim);
  const phases = []; let last = null, nzMax = 0, s = 0;
  for (; s < (o.maxS || 340) * 60; s++) {
    ap.update(1 / 60); sim.step(1 / 60);
    if (ap.phase !== last) { phases.push(ap.phase); last = ap.phase; }
    if (sim.t > 15) nzMax = Math.max(nzMax, sim.out.nz);
    if (ap.phase === 'STOPPED' && ap.t > 3) break;
  }
  return { phases, outcome: ap.report && ap.report.outcome, t: s / 60, nzMax, peak: peakOf(sim), dmg: dmgOf(sim), finite: finite(sim) };
}

// AT A TRUNK: taxied or flown at a trunk `D` m ahead (`off` m across, to the left wing), as GATE TREEHIT's flyAt;
// `walk` holds a walking pace with the throttle (the wingtip brush). Records the CG along the track, the beams
// top-down every `every` frames (for the pictures) and the damage over time.
function atTrunk(key, o) {
  const C = core(), def = defOf(key, o), elev = 300, { W, TH, strip } = flatWorld(elev);
  const sim = C.makeSim(def, W);
  const r = flyRun(C, sim, def, TH, strip, elev, o);
  // `then`: the same sim reset and flown again (reset must make the aeroplane whole)
  if (o.then) { const crashedBefore = dmgSim(sim).crashed; TH.drop('fill:test'); const r2 = flyRun(C, sim, def, TH, strip, elev, o.then); r2.crashedBefore = crashedBefore; return r2; }
  return r;
}
function flyRun(C, sim, def, TH, strip, elev, o) {
  sim.reset(0);
  C.placeAtAerodrome(sim, Object.assign({}, strip, { elev, spawnElev: elev + (o.agl || 0) }));
  const fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg);
  if (!o.agl) for (let f = 0; f < 120; f++) sim.step(1 / 60);
  if (o.V) for (let i = 0; i < sim.n; i++) { sim.v[i*3] = o.V * fx; sim.v[i*3+2] = o.V * fz; }
  const c0 = sim.cgPos().slice(), off = o.off || 0;
  const tk = o.trunk || { r: 0.3, h: 10.05, sink: 0 };
  const tx = c0[0] + fx * o.D - fz * off, tz = c0[2] + fz * o.D + fx * off;
  if (!o.noTrunk) TH.set('fill:test', [tx, tz, elev - tk.sink, tk.r, elev - tk.sink + tk.h]);
  sim.ctl.thr = o.thr == null ? 0 : o.thr;
  clearPeak(sim);
  const loc = (x, z) => [(x - c0[0]) * fx + (z - c0[2]) * fz, -((x - c0[0]) * -fz + (z - c0[2]) * fx)];
  // the mechanical energy (kinetic + the weight's potential): with the throttle shut nothing may add to it
  const energy = () => { let e = 0; for (let i = 0; i < sim.n; i++) e += sim.m[i] * (0.5 * (sim.v[i*3] ** 2 + sim.v[i*3+1] ** 2 + sim.v[i*3+2] ** 2) + 9.81 * (sim.p[i*3+1] - elev)); return e; };
  const ke0 = energy();
  let reach = -Infinity, maxSpread = 0, vPass = null, bad = false, vNodeMax = 0, keMax = ke0, walked = false;
  const frames = [], trace = [];
  for (let f = 0; f < (o.secs || 8) * 60; f++) {
    // `walk`: a walking pace held on the throttle until the first touch, then the throttle shut (the pilot's reflex)
    if (o.walk && !walked) { if (sim.trunkHits() > 0) { walked = true; sim.ctl.thr = 0; } else { const v = sim.cgVel(), V = v[0] * fx + v[2] * fz; sim.ctl.thr = Math.max(0, Math.min(1, 0.12 + 0.3 * (o.walk - V))); } }
    if (o.rollThen != null) { const c = sim.cgPos(); if ((c[0] - c0[0]) * fx + (c[2] - c0[2]) * fz > 6) sim.ctl.thr = o.rollThen; }
    sim.step(1 / 60);
    if (!finite(sim)) { bad = true; break; }
    const c = sim.cgPos(), along = (c[0] - c0[0]) * fx + (c[2] - c0[2]) * fz, v = sim.cgVel();
    reach = Math.max(reach, along); maxSpread = Math.max(maxSpread, spread(sim));
    for (let i = 0; i < sim.n; i++) vNodeMax = Math.max(vNodeMax, Math.hypot(sim.v[i*3], sim.v[i*3+1], sim.v[i*3+2]));
    const ke = energy(); if (ke > keMax) keMax = ke;
    if (vPass === null && along > o.D + 10) vPass = v[0] * fx + v[2] * fz;
    const D = dmgSim(sim);
    if (f % 3 === 0) trace.push({ t: sim.t, along, v: v[0] * fx + v[2] * fz, ke, yields: D.yields, members: D.members, breaks: D.breaks, work: D.work, setMax: D.setMax, g: D.gPeak });
    if (o.every && f % o.every === 0) frames.push({ t: sim.t, along, broken: D.broken.slice(), beams: sim.beams.map(b => [loc(sim.p[b.a*3], sim.p[b.a*3+2]), loc(sim.p[b.b*3], sim.p[b.b*3+2])]) });
  }
  const c = sim.cgPos(), along = (c[0] - c0[0]) * fx + (c[2] - c0[2]) * fz;
  const hash = require('crypto').createHash('md5').update(Buffer.from(sim.p.buffer)).update(Buffer.from(sim.v.buffer)).digest('hex').slice(0, 12);
  return { bad, reach, end: along, vPass, vNodeMax, ke0, keMax, hash, hits: sim.trunkHits(), spread: maxSpread, peak: peakOf(sim), dmg: dmgOf(sim), finite: finite(sim) && !bad,
    eng: sim.eng.map(e => ({ running: e.running, seized: !!e.seized })), trunk: loc(tx, tz), trunkR: tk.r, frames, trace, sim, def, loc };
}

// FAR 23.473(d): the limit descent velocity V = 4.4 (W/S)^(1/4) ft/s (W/S in lb/ft2), at least 7 and at most 10 ft/s
function far473(key) {
  const g = defOf(key).params.gen, WS = (g.W / 4.4482) / (g.Sw * 10.7639);
  return Math.min(10, Math.max(7, 4.4 * Math.pow(WS, 0.25))) * 0.3048;
}
module.exports = { far473, core, BUILDS, defOf, flatWorld, loadTest, pull, hardLanding, circuit, atTrunk, peakOf, dmgOf, finite };
