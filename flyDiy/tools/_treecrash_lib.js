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
  // G2353 (DMG-DETERMINISM): never a stale generated core (tools/_core_fresh.js); FLYDIY_CORE=<file> flies another core
  // on purpose (GATE DMGDETERMINISM's doctored and branch cores, an older tree's for a comparison)
  const coreFile = process.env.FLYDIY_CORE ? path.resolve(process.env.FLYDIY_CORE) : path.join(T, 'flight_core.js');
  if (!process.env.FLYDIY_CORE) require('./_core_fresh.js').assertFresh(coreFile);
  C = require(coreFile);
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
// G1816 (DMG-D1a): the last sim each scenario flew (its rigs read the members after the run)
const lastRun = { sim: null };
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
  const o = Object.assign({}, d, { params: Object.assign({}, d.params, (opts && opts.probe) ? { damageProbe: true } : {}, { damage: !(opts && opts.elastic) }) });   // G1898: the damage gates say what they test (the default is off)
  // G1831 (DMG-D2a): `cert` - the certificate stamped (66_gen_cert, computed once per build, the floats' drop on the
  // analytic world's sea lane); without it the members are D1a's physics
  if ((opts && opts.cert) || (process.env.FLYDIY_CERT === '1' && !(opts && opts.cert === false))) o.cert = certOf(key);
  else o.cert = null;
  return o;
}
const _certs = {};
let _seaWorld = null;
function certOf(key) {
  if (_certs[key]) return _certs[key];
  // (FLYDIY_CERT_DIR: the envelope precomputed in another process - <dir>/<key>.json, { nb, Ft, Fc } - as the game hands
  // the flight a certificate its bench thread computed: a sim timed in this process then never shares its solver's
  // code with the certificate's own probe sims, whose beams carry the probe's fields)
  if (process.env.FLYDIY_CERT_DIR) {
    const J = JSON.parse(fs.readFileSync(path.join(process.env.FLYDIY_CERT_DIR, key + '.json'), 'utf8'));
    return (_certs[key] = { nb: J.nb, Ft: Float64Array.from(J.Ft), Fc: Float64Array.from(J.Fc) });
  }
  if (!_defs[key]) defOf(key);
  const C = core(), d = _defs[key];
  const hydro = !!(d.parts && d.parts.floats);
  if (hydro && !_seaWorld) _seaWorld = C.makeWorld();
  return (_certs[key] = C.genCertify(d, { world: hydro ? _seaWorld : null }));
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
const clearPeak = sim => { const P = sim.damagePeak && sim.damagePeak(); if (P) { P.t.fill(0); P.c.fill(0); if (P.cl) P.cl.fill(0); if (P.tw) P.tw.fill(0); } };   // (G1843: the clusters' cuts too)
// (a core from before G1470 has no damage: read as an empty one, so the evidence can fly master's core too)
const NODMG = { yields: 0, breaks: 0, work: 0, setMax: 0, crashed: false, reason: null, at: null, dented: false, propStrike: false, propAt: null, gPeak: 0, broken: [], members: 0, dents: 0, primary: 0, over: false };
const dmgSim = sim => (sim.damage ? sim.damage() : NODMG);
const dmgOf = sim => { const D = dmgSim(sim); return { holed: D.holed || 0, members: D.members, dents: D.dents, yields: D.yields, breaks: D.breaks, work: D.work, setMax: D.setMax, crashed: D.crashed,
  reason: D.reason, at: D.at, dented: D.dented, propStrike: D.propStrike, propAt: D.propAt, gPeak: D.gPeak, broken: D.broken.slice(),
  brokenCls: D.broken.map(i => sim.beams[i].cls) }; };
const finite = sim => { for (let i = 0; i < sim.p.length; i++) if (!Number.isFinite(sim.p[i]) || !Number.isFinite(sim.v[i])) return false; return true; };
// the furthest node from the CG (a node flung away would show here)
const spread = sim => { const c = sim.cgPos(); let r = 0; for (let i = 0; i < sim.n; i++) r = Math.max(r, Math.hypot(sim.p[i*3] - c[0], sim.p[i*3+1] - c[1], sim.p[i*3+2] - c[2])); return r; };

// THE LOAD TEST to `ult` (the garage's own rig), the peak recorded at the limit and at the ultimate
function loadTest(key, o) {
  const C = core(), def = defOf(key, o), spec = def.spec;
  const sim = C.makeSim(def, null); sim.reset(0); lastRun.sim = sim;
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
  const sim = C.makeSim(def, W); sim.reset(0); lastRun.sim = sim;
  C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0, spawnElev: 400 }));
  const fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg);
  for (let i = 0; i < sim.n; i++) { sim.v[i*3] = V * fx; sim.v[i*3+2] = V * fz; }
  sim.ctl.thr = 1;
  // the elevator's sense: a nose-up input is the one that raises nz (found, not assumed)
  let de = 0, I = 0, nzMax = 0, held = 0, sgn = o.sgn || -1, naMax = 0;
  for (let f = 0; f < 60 * 1; f++) { sim.step(1 / 60); }   // a second to settle in the air (the trim transient's own load)
  clearPeak(sim);
  const t0 = sim.t, hist = [];
  for (let f = 0; f < 60 * (o.secs || 6); f++) {
    const tgt = Math.min(nzT, 1 + (nzT - 1) * (f / 60) / 1.0);   // the target ramped over a second (no overshoot past it)
    const e = tgt - sim.out.nz; I += e / 60;
    de = Math.max(-1, Math.min(1, sgn * (0.4 * e + 0.8 * I)));
    sim.ctl.de = de;
    sim.step(1 / 60);
    if (o.onFrame) o.onFrame(sim, f);
    nzMax = Math.max(nzMax, sim.out.nz);
    if (sim.out.nz > nzT - 0.1) held += 1 / 60;
    if (f % 6 === 0) hist.push([sim.t - t0, sim.out.nz, sim.out.V]);
    if (held > (o.hold || 1.5)) break;
    // G1833 (DMG-D2a): `toLimit` - the pull read up to the step its APPLIED load factor (the aero force over the
    // weight - the CG's nz lags the wing's load in a quick pull: 3.8 read while the wing carried 5.7 W) first reaches
    // the limit; past it is an over-g, where the certificate's set is the point
    if (o.toLimit) { const na = sim.out.aeroFy / (sim.totalM * 9.81); naMax = Math.max(naMax, na); if (na >= o.toLimit) break; }
  }
  return { nzMax, naMax, held, V: sim.out.V, peak: peakOf(sim), dmg: dmgOf(sim), finite: finite(sim), hist };
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
  lastRun.sim = sim;
  for (let f = 0; f < 240; f++) sim.step(1 / 60);
  const gap = o.gap == null ? 0.02 : o.gap, sink = o.sink;
  for (let i = 0; i < sim.n; i++) { sim.p[i*3+1] += gap; sim.v[i*3] = 0; sim.v[i*3+1] = -sink; sim.v[i*3+2] = 0; }
  if (o.fwd) { const fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg); for (let i = 0; i < sim.n; i++) { sim.v[i*3] = o.fwd * fx; sim.v[i*3+2] = o.fwd * fz; } }
  clearPeak(sim);
  if (o.onStart) o.onStart(sim, def);
  let gMax = 0, yMin = Infinity;
  for (let f = 0; f < (o.frames || 120); f++) { sim.step(1 / 60); if (o.onFrame) o.onFrame(sim, f); gMax = Math.max(gMax, sim.out.nz); }
  return { gMax, peak: peakOf(sim), dmg: dmgOf(sim), finite: finite(sim) };
}

// A CIRCUIT: the pilot from the runway, round and down to a stop (or `maxS`) on the analytic world
function circuit(key, o) {
  const C = core(), def = defOf(key, o), world = C.makeWorld();
  const sim = C.makeSim(def, world); sim.reset(0); lastRun.sim = sim;
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
  // G1883 (DMG-WINDBREAK): `wind` - the air the aeroplane taxies in: a function (x, y, z, t) -> [wx, wy, wz] (the
  // climate's field) or a fixed vector; without it the flat world is calm, as before
  if (o.wind) { const w = o.wind; W.wind = typeof w === 'function' ? w : () => w; }
  const sim = C.makeSim(def, W); lastRun.sim = sim;
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
  // G2354 (DMG-DETERMINISM): `perturb` {seed, amp} - the ensemble's member: every node's start nudged by up to amp m
  // (seeded, uniform per coordinate; seed 0 the run as it was; amp ENS_AMP unless given)
  if (o.perturb && o.perturb.seed) perturbPose(sim, o.perturb.seed, o.perturb.amp == null ? ENS_AMP : o.perturb.amp);
  if (o.V) for (let i = 0; i < sim.n; i++) { sim.v[i*3] = o.V * fx; sim.v[i*3+2] = o.V * fz; }
  const c0 = sim.cgPos().slice(), off = o.off || 0;
  const tk = o.trunk || { r: 0.3, h: 10.05, sink: 0 };
  const tx = c0[0] + fx * o.D - fz * off, tz = c0[2] + fz * o.D + fx * off;
  if (!o.noTrunk) TH.set('fill:test', [tx, tz, elev - tk.sink, tk.r, elev - tk.sink + tk.h]);
  sim.ctl.thr = o.thr == null ? 0 : o.thr;
  clearPeak(sim);
  if (o.onStart) o.onStart(sim, def);
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
    if (o.onFrame) o.onFrame(sim, f);                // G1823 (DMG-D1b): a gate's per-frame reader (the wreck's integrity)
    if (!finite(sim)) { bad = true; break; }
    const c = sim.cgPos(), along = (c[0] - c0[0]) * fx + (c[2] - c0[2]) * fz, v = sim.cgVel();
    reach = Math.max(reach, along); maxSpread = Math.max(maxSpread, spread(sim));
    for (let i = 0; i < sim.n; i++) vNodeMax = Math.max(vNodeMax, Math.hypot(sim.v[i*3], sim.v[i*3+1], sim.v[i*3+2]));
    const ke = energy(); if (ke > keMax) keMax = ke;
    if (vPass === null && along > o.D + 10) vPass = v[0] * fx + v[2] * fz;
    const D = dmgSim(sim);
    if (f % 3 === 0) trace.push({ t: sim.t, along, v: v[0] * fx + v[2] * fz, ke, yields: D.yields, members: D.members, breaks: D.breaks, work: D.work, setMax: D.setMax, g: D.gPeak });
    if (o.every && f % o.every === 0) frames.push({ t: sim.t, along, broken: D.broken.slice(), bent: sim.beams.reduce((a, b, i) => (b.yielded ? (a.push(i), a) : a), []), beams: sim.beams.map(b => [loc(sim.p[b.a*3], sim.p[b.a*3+2]), loc(sim.p[b.b*3], sim.p[b.b*3+2])]) });
  }
  const c = sim.cgPos(), along = (c[0] - c0[0]) * fx + (c[2] - c0[2]) * fz;
  const hash = require('crypto').createHash('md5').update(Buffer.from(sim.p.buffer)).update(Buffer.from(sim.v.buffer)).digest('hex').slice(0, 12);
  return { bad, reach, end: along, vPass, vNodeMax, ke0, keMax, hash, hits: sim.trunkHits(), spread: maxSpread, peak: peakOf(sim), dmg: dmgOf(sim), finite: finite(sim) && !bad,
    eng: sim.eng.map(e => ({ running: e.running, seized: !!e.seized })), trunk: loc(tx, tz), trunkR: tk.r, frames, trace, sim, def, loc };
}

// THE WATER (A0, with GEAR-WATER 2's wet body): a build put 0.3 m over the analytic world's sea lane, `V` m/s along its
// heading, sinking `sink` m/s, pitched `pitch` deg nose-down about its CG, power off (GATE HYDRODYN's ditchOf, pitched);
// the water reaches the frame through its nodes (the floats' panels; the wet body's slam where 32_hydro has wetBuild)
function waterCase(key, o) {
  const C = core(), def = defOf(key, o), world = C.makeWorld(), sea = world.aerodromes.find(a => a.id === 'SEA');
  const sim = C.makeSim(def, world); sim.reset(0); C.placeAtAerodrome(sim, sea); lastRun.sim = sim;
  const n = sim.n, p = sim.p, v = sim.v, [xA, , zR] = sim.axes(), c0 = sim.cgPos();
  // pitch nose-down about the CG round the body's lateral axis (Rodrigues; nose at -xAft, so + about +z right lowers it)
  const th = -(o.pitch || 0) * Math.PI / 180, k = zR, cs = Math.cos(th), sn = Math.sin(th);
  for (let i = 0; i < n; i++) {
    const d = [p[i*3] - c0[0], p[i*3+1] - c0[1], p[i*3+2] - c0[2]], kd = k[0]*d[0] + k[1]*d[1] + k[2]*d[2];
    const cr = [k[1]*d[2] - k[2]*d[1], k[2]*d[0] - k[0]*d[2], k[0]*d[1] - k[1]*d[0]];
    for (let j = 0; j < 3; j++) p[i*3+j] = c0[j] + d[j] * cs + cr[j] * sn + k[j] * kd * (1 - cs);
  }
  const wh = world.waterH(c0[0], c0[2]);
  let yMin = Infinity; for (let i = 0; i < n; i++) yMin = Math.min(yMin, p[i*3+1] - def.nodes[i].r);
  const hl = Math.hypot(xA[0], xA[2]), V = o.V;
  for (let i = 0; i < n; i++) { p[i*3+1] += wh + 0.3 - yMin; v[i*3] = -V * xA[0] / hl; v[i*3+1] = -o.sink; v[i*3+2] = -V * xA[2] / hl; }
  sim.ctl.thr = 0;
  clearPeak(sim);
  let finite_ = true, sp = 0;
  if (o.onStart) o.onStart(sim, def);
  for (let s = 0; s < (o.secs || 4) * 60; s++) { sim.step(1 / 60); if (o.onFrame) o.onFrame(sim, s); if (!finite(sim)) { finite_ = false; break; } sp = Math.max(sp, spread(sim)); }
  const WB = sim.wetBody || null;
  return { dmg: dmgOf(sim), peak: peakOf(sim), finite: finite_, spread: sp, wet: !!(WB || sim.hydro), wetBody: !!WB, holed: WB && WB.slices ? WB.slices.filter(x => x.br).length : 0,
    slamKPa: WB && WB.slamPeak ? WB.slamPeak / 1000 : null, members: dmgOf(sim).members, cls: (sim.damage().broken || []).map(i => sim.beams[i].cls),
    yieldedCls: sim.beams.filter(b => b.yielded).reduce((a, b) => (a[b.cls] = (a[b.cls] || 0) + 1, a), {}) };
}

// G2353 (DMG-DETERMINISM): THE STANDARD CRASHES (DMG-TUNE's sanity table, tools/_dmg_tune_lib.js CRASHES - the same
// options) flown by atTrunk, and the state's fingerprint: sha1 of sim.p then sim.v as float64, 16 hex (DMG-COMPOSITE's
// validated_hashes.txt) - equal is the same bits
const STANDARD = {
  taxi:     { label: '3 m/s taxi into a trunk', o: { D: 4, V: 3, thr: 0, secs: 8 } },
  noseover: { label: 'nose-over: 12 m/s into a 35 cm stump', o: { D: 12, V: 12, thr: 0, secs: 6, trunk: { r: 0.25, h: 0.35, sink: 0 } } },
  trunk0:   { label: '30 m/s trunk, the centreline', o: { D: 40, agl: 4, V: 30, thr: 0, secs: 6, off: 0 } },
  trunk25:  { label: '30 m/s trunk, 2.5 m out', o: { D: 40, agl: 4, V: 30, thr: 0, secs: 6, off: 2.5 } },
  flight:   { label: 'damage-OFF flight: 20 s at full power from 30 m/s, 60 m up, no trunk', o: { D: 40, agl: 60, V: 30, thr: 1, secs: 20, noTrunk: true } },
};
const stateHash = sim => require('crypto').createHash('sha1').update(Buffer.from(sim.p.buffer, sim.p.byteOffset, sim.p.byteLength))
  .update(Buffer.from(sim.v.buffer, sim.v.byteOffset, sim.v.byteLength)).digest('hex').slice(0, 16);

// ---- G2354 (DMG-DETERMINISM): THE ENSEMBLE ----
// One 30 m/s run is one draw of a wreck that depends on its start: N members, member 0 the run as it was and member s
// every node's start nudged by up to ENS_AMP from a seeded generator, read as a distribution - median, p10-p90, spread -
// of the members broken, the pieces, the member work, the engine mount off, the cowl off. Measured (HANDOVER G2354,
// reports/evidence/DMG-DETERMINISM/amp_sweep.json), 16 members each, the Jodel / Cub / metal Cessna centreline:
//   1e-9 m  124 [124-124] / 169 [168-171] / 215 [215-215]   (bit-level noise moves the wreck's bits, hardly its counts)
//   1e-6 m  124 [123-124] / 159 [157-170] / 215 [215-216]
//   1 mm    168 [135-196] / 170 [158-216] / 169 [151-193]   (the physical sensitivity: the metal's single 215 is its tail)
// so the gates' ensembles nudge by 1 mm (ENS_AMP): the spread a crash really has, which a change of the physics must
// beat. A REGRESSION is called only when the distribution moves: a two-sided Mann-Whitney rank test at p < ENS_P (ties
// corrected, the normal approximation), not a single count.
const ENS_AMP = 1e-3, ENS_P = 0.01;
const mulberry = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
function perturbPose(sim, seed, amp) { const r = mulberry(seed * 2654435761 >>> 0); for (let i = 0; i < sim.n * 3; i++) sim.p[i] += amp * (2 * r() - 1); }
// what the wreck is: the members broken, the pieces (the live members' and the whole clusters' union-find, pieces of
// 0.5 kg and more - DMG-TUNE's "what came off"), the member work (J), the engine mount off (a group `*:mount` let go),
// the cowl off (the cowl rides the engine and its nose bowl: off with the mount, or the bowl crushed through - the nose's
// crush to the stack's depth, DMG-NOSE's layers)
function crashStats(sim) {
  const D = dmgSim(sim), n = sim.n, P = new Int32Array(n); for (let i = 0; i < n; i++) P[i] = i;
  const f = i => { while (P[i] !== i) { P[i] = P[P[i]]; i = P[i]; } return i; };
  for (const b of sim.beams) if (!b.broken) { const x = f(b.a), y = f(b.b); if (x !== y) P[x] = y; }
  const cc = sim.clusterCuts ? sim.clusterCuts().clusters : [];
  for (const C of cc) if (!C.off && C.nodes && C.nodes.length) for (const i of C.nodes) { const x = f(i), y = f(C.nodes[0]); if (x !== y) P[x] = y; }
  const m = new Map(); for (let i = 0; i < n; i++) { const r = f(i); m.set(r, (m.get(r) || 0) + sim.m[i]); }
  let pieces = 0; for (const v of m.values()) if (v >= 0.5) pieces++;
  const mountOff = (D.groups || []).some(g => /:mount$/.test(g.key));
  const bowl = (D.drive || []).some(x => x.crushOf > 0 && x.crush >= x.crushOf - 1e-9);
  return { broken: D.broken.length, pieces, work: D.work, mountOff: mountOff ? 1 : 0, cowlOff: mountOff || bowl ? 1 : 0, crashed: D.crashed ? 1 : 0 };
}
const ENS_FIELDS = ['broken', 'pieces', 'work', 'mountOff', 'cowlOff'];
const quant = (s, q) => { if (!s.length) return NaN; const x = (s.length - 1) * q, i = Math.floor(x), f = x - i; return i + 1 < s.length ? s[i] + f * (s[i + 1] - s[i]) : s[i]; };
function ensStats(vals) {
  const s = vals.slice().sort((a, b) => a - b), p10 = quant(s, 0.1), p90 = quant(s, 0.9);
  return { n: s.length, median: quant(s, 0.5), p10, p90, spread: p90 - p10, min: s[0], max: s[s.length - 1], mean: s.reduce((a, b) => a + b, 0) / s.length };
}
// the two-sided Mann-Whitney U test (average ranks over ties, the tie-corrected variance, continuity 0.5)
function rankTest(a, b) {
  const all = a.map(v => [v, 0]).concat(b.map(v => [v, 1])).sort((x, y) => x[0] - y[0]), N = all.length, r = new Float64Array(N);
  let tie = 0;
  for (let i = 0; i < N;) { let j = i; while (j + 1 < N && all[j + 1][0] === all[i][0]) j++; const t = j - i + 1; for (let k = i; k <= j; k++) r[k] = (i + j) / 2 + 1; tie += t * t * t - t; i = j + 1; }
  let Ra = 0; for (let k = 0; k < N; k++) if (all[k][1] === 0) Ra += r[k];
  const n1 = a.length, n2 = b.length, U = Ra - n1 * (n1 + 1) / 2, mu = n1 * n2 / 2, sd = Math.sqrt(n1 * n2 / 12 * ((N + 1) - tie / (N * (N - 1))));
  if (!(sd > 0)) return { U, z: 0, p: 1 };
  const z = (Math.abs(U - mu) - 0.5) / sd, p = Math.min(1, 2 * (1 - normCdf(Math.max(0, z))));
  return { U, z: Math.sign(U - mu) * Math.max(0, z), p };
}
function normCdf(x) { const t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989422804014327 * Math.exp(-x * x / 2);
  const q = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))); return x >= 0 ? 1 - q : q; }
// two ensembles, field by field: moved = the rank test's p < ENS_P (and the medians' shift against the pooled spread, reported)
function ensCompare(A, B, fields) {
  const out = {};
  for (const f of fields || ENS_FIELDS) {
    const a = A.members.map(x => x[f]), b = B.members.map(x => x[f]), sa = ensStats(a), sb = ensStats(b), t = rankTest(a, b);
    const pooled = Math.max(sa.spread, sb.spread);
    out[f] = { a: sa, b: sb, dMedian: sb.median - sa.median, pooled, p: t.p, z: t.z, moved: t.p < ENS_P };
  }
  return out;
}
// ONE MEMBER (in this process): atTrunk with its seed; { seed, hash, ...crashStats }
function member(key, id, seed, o) {
  const sc = STANDARD[id] ? STANDARD[id].o : {};
  const r = atTrunk(key, Object.assign({}, sc, o || {}, { perturb: { seed, amp: o && o.amp != null ? o.amp : ENS_AMP } }));
  return Object.assign({ seed, hash: stateHash(r.sim), finite: r.finite, keMax: r.keMax, ke0: r.ke0, wing: r.dmg.brokenCls.filter(c => c === 'wing').length }, crashStats(r.sim));
}
// THE ENSEMBLE: N members (seeds 0..N-1) in child processes, `jobs` at once, the certificate computed once in its own
// child (o.cert: FLYDIY_CERT_DIR - the game's bench thread hands the flight its envelope) unless one is given;
// o.core flies another core (FLYDIY_CORE); returns { key, id, members, stats: { field: ensStats }, s }
async function ensemble(key, id, o) {
  o = o || {};
  const { spawn } = require('child_process'), os = require('os'), N = o.n || 16, J = o.jobs || 3, t0 = Date.now();
  const env = Object.assign({}, process.env, o.core ? { FLYDIY_CORE: o.core } : {});
  const runChild = (args, envX) => new Promise(res => {
    const c = spawn(process.execPath, (o.flags || []).concat([__filename], args), { stdio: ['ignore', 'pipe', 'pipe'], env: envX || env });
    let so = '', se = ''; c.stdout.on('data', d => { so += d; }); c.stderr.on('data', d => { se += d; });
    c.on('close', code => { const l = so.split('\n').reverse().find(x => x.indexOf('RESULT ') === 0); res(l ? JSON.parse(l.slice(7)) : { err: (se || so).slice(-600), code }); });
  });
  const dmgOn = o.dmg !== 'off';
  // (o.certDir: the certificates' directory shared across ensembles - computed into it when missing)
  let tmp = null;
  if (o.certDir) env.FLYDIY_CERT_DIR = o.certDir;
  if (dmgOn && !(env.FLYDIY_CERT_DIR && fs.existsSync(path.join(env.FLYDIY_CERT_DIR, key + '.json')))) {
    const d = env.FLYDIY_CERT_DIR || (tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ens-')));
    const e2 = Object.assign({}, env); delete e2.FLYDIY_CERT_DIR;   // (the certificate computed, not read)
    const c = await runChild(['--ens-cert', key, d], e2);
    if (c.err) throw new Error('the certificate: ' + c.err);
    env.FLYDIY_CERT_DIR = d;
  }
  const seeds = Array.from({ length: N }, (_, i) => i), members = new Array(N); let q = 0;
  await Promise.all(Array.from({ length: Math.min(J, N) }, async () => { while (q < N) { const i = q++;
    members[i] = await runChild(['--ens-member', key, id, String(seeds[i]), dmgOn ? 'on' : 'off', JSON.stringify(o.o || {})]); } }));
  if (tmp) try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* stays */ }
  const bad = members.filter(m => m.err);
  if (bad.length) throw new Error(key + '/' + id + ': ' + bad.length + ' members failed: ' + bad[0].err);
  const stats = {}; for (const f of ENS_FIELDS) stats[f] = ensStats(members.map(m => m[f]));
  return { key, id, n: N, amp: ENS_AMP, members, stats, s: (Date.now() - t0) / 1000 };
}
const ensLine = (E, f) => { const s = E.stats[f], k = f === 'work' ? 1e-3 : 1, d = f === 'work' ? 1 : (f === 'mountOff' || f === 'cowlOff' ? 2 : 0);
  return f === 'mountOff' || f === 'cowlOff' ? (s.mean * E.n).toFixed(0) + '/' + E.n : (s.median * k).toFixed(d) + ' [' + (s.p10 * k).toFixed(d) + '-' + (s.p90 * k).toFixed(d) + ']'; };
// the children's entry points
if (require.main === module && process.argv[2] === '--ens-cert') {
  const c = certOf(process.argv[3]);
  fs.writeFileSync(path.join(process.argv[4], process.argv[3] + '.json'), JSON.stringify({ nb: c.nb, Ft: Array.from(c.Ft), Fc: Array.from(c.Fc) }));
  process.stdout.write('RESULT {"ok":1}\n', () => process.exit(0));
} else if (require.main === module && process.argv[2] === '--ens-member') {
  const [key, id, seed, dmg, oj] = process.argv.slice(3), oo = JSON.parse(oj || '{}');
  const r = member(key, id, +seed, Object.assign(oo, dmg === 'off' ? { elastic: true, cert: false } : { cert: true }));
  process.stdout.write('RESULT ' + JSON.stringify(r) + '\n', () => process.exit(0));
}

// FAR 23.473(d): the limit descent velocity V = 4.4 (W/S)^(1/4) ft/s (W/S in lb/ft2), at least 7 and at most 10 ft/s
function far473(key) {
  const g = defOf(key).params.gen, WS = (g.W / 4.4482) / (g.Sw * 10.7639);
  return Math.min(10, Math.max(7, 4.4 * Math.pow(WS, 0.25))) * 0.3048;
}
module.exports = { STANDARD, stateHash, perturbPose, ENS_AMP, ENS_P, ENS_FIELDS, crashStats, ensStats, rankTest, ensCompare, member, ensemble, ensLine, certOf, lastRun, far473, waterCase, core, BUILDS, defOf, flatWorld, loadTest, pull, hardLanding, circuit, atTrunk, peakOf, dmgOf, finite };
