#!/usr/bin/env node
// GATE ACCEPT's flight (G2272): ONE acceptance leg flown in node on a validated build, printed as one JSON line.
// The gate (tools/_accept_check.js) runs one of these per case, in parallel processes (a leg is ~10 min of flight).
//
//   node tools/_accept_fly.js <case>      cases: CASES below (cub, cub2, cubDist, cubWind, jodel, c172, metal)
//
// THE FLIGHT: the analytic world (makeWorld(), calm), lined up at HOME as GATE PILOT's box case is (settled 10 s,
// makePilot, the circuit's own take-off); the moment the pilot leaves CLIMB the leg takes the AP box (72_accept
// makeAcceptLeg: HDG as it is, ALT at HOME + 300 m on full power, SET 75 % throttle, settle, record 5 min) and the
// recorder samples the pilot's own instruments every second. `home: true` hands back ('auto': the pilot plans a
// circuit home) and flies on to the stop: the logbook row app.js writes (from, at = flightWhere of the stop, sink,
// run, occ). `wind`: a steady wind from the leg's start (the calm-air correction). `gust`: a downburst mid-leg (the
// disturbed segment the leg must refuse).
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname;
const L = require(path.join(T, '_treecrash_lib.js'));
const LB = require(path.join(T, '_load_build.js'));   // T41b (JOIN-PARITY): every validated build as the game loads it - the joined spec
const C = L.core();
const B = require(path.join(T, '..', 'src', 'viewer', 'bench.js'));

const FILES = { cub: 'builds/cub_2026-09-20_corrected.json', jodel: 'builds/jodel_2026-09-20_corrected.json',
                c172: 'builds/cessna172_2026-09-20_corrected.json', metal: 'bugReports/cessnaMetal (1).json' };
const CASES = {
  cub:     { build: 'cub', home: true },
  cub2:    { build: 'cub', home: true },                       // the same flight again: deterministic run to run
  cubDist: { build: 'cub', gust: { at: 120, s: 10, vy: -5 } }, // a downburst 2 min into the leg: rejected
  cubWind: { build: 'cub', wind: [-6, 0, 4] },                // 7.2 m/s across and ahead: the TAS stays the calm one
  jodel:   { build: 'jodel' },
  c172:    { build: 'c172' },
  metal:   { build: 'metal' },
};

function fly(name) {
  const K = CASES[name];
  if (!K) throw new Error('unknown case ' + name);
  const wall0 = Date.now();
  const spec = LB.loadBuild(FILES[K.build]).spec;   // (was the file as written: JOIN-PARITY)
  const fp = B.benchFingerprint(spec, null);
  // the def as GATE DESTTO's library builds one (the saved spec through the migrator and buildGen), the damage model
  // off: an acceptance leg is a cruise, not a crash
  const def0 = C.buildGen(C.genMigrateSpec ? C.genMigrateSpec(spec) : spec);
  const def = Object.assign({}, def0, { params: Object.assign({}, def0.params, { damage: false }), cert: null });
  const sh = C.genShakedown(def, { corners: false });
  const W = C.makeWorld();
  const HOME = W.aerodromes[0];
  // the whole leg's samples for the selftest's re-measurement (the doctored rules are judged on the same flight)
  const KEEP = ['cub', 'cubDist', 'cubWind'].includes(name);
  // the wind and the gust, on the leg's own clock (null until the leg starts)
  let legT0 = null, simT = 0;
  const calm = W.wind;
  W.wind = (x, y, z, t) => {
    if (legT0 == null) return calm ? calm(x, y, z, t) : [0, 0, 0];
    const w = K.wind ? K.wind.slice() : [0, 0, 0];
    if (K.gust && L_.tRec != null && simT >= L_.tRec + K.gust.at && simT < L_.tRec + K.gust.at + K.gust.s) w[1] += K.gust.vy;
    return w;
  };
  const sim = C.makeSim(def, W); sim.reset(0);
  for (let i = 0; i < 600; i++) sim.step(1 / 60);
  const ap = C.makePilot(sim, def, W);
  const L_ = C.acceptLegStart(sim, ap, def, { fieldElev: HOME.elev || 0, resume: 'auto', legMin: process.env.ACCEPT_FLY_LEGMIN ? +process.env.ACCEPT_FLY_LEGMIN : undefined, meta: { fp, when: '2026-10-07', from: HOME.id } });
  const load = L_.load, rec = L_.rec;
  const phases = [];
  let lastPh = '', n = 0, bad = false;
  const step = () => { ap.update(1 / 60); sim.step(1 / 60); simT = ap.t; if (sim.stats().bad) bad = true; if (ap.phase !== lastPh) { phases.push([Math.round(ap.t), ap.phase]); lastPh = ap.phase; } };
  // up to the end of the climb on the pilot's own circuit
  while (!bad && ap.phase !== 'CROSSWIND' && n++ < 60 * 300) step();
  // the leg
  n = 0;
  while (!bad && L_.stage !== 'done' && L_.stage !== 'aborted' && n++ < 60 * 1200) {
    const st = L_.tick(sim, ap);
    if (st !== 'idle' && legT0 == null) legT0 = ap.t;
    step();
  }
  const measure = L_.result || rec.result();
  const legEnd = { t: Math.round(ap.t), x: Math.round(ap.instruments().x), z: Math.round(ap.instruments().z) };
  // home and the stop (the logbook's row)
  let row = null;
  if (K.home && !bad) {
    legT0 = null;   // calm again for the way home (the case is calm anyway)
    n = 0;
    while (!bad && ap.phase !== 'STOPPED' && n++ < 60 * 1500) step();
    for (let i = 0; i < 120 && !bad; i++) step();
    const cg = sim.cgPos(), td = ap.tdInfo, Ld = ap.report && ap.report.landing;
    row = { from: HOME.id, to: 'CIRCUIT', at: ap.phase === 'STOPPED' ? C.acceptStopAt(W, cg[0], cg[2]) : null,
            sink: td ? +td.sink.toFixed(2) : null, V: td ? +(td.V * 3.6).toFixed(0) : null, t: Math.round(ap.t),
            occ: load.occupants, payloadKg: load.payloadKg, fp, outcome: ap.report && ap.report.outcome !== 'completed' ? ap.report.outcome : undefined };
    if (Ld && Ld.run != null) row.run = Math.round(Ld.run);
  }
  const signed = L_.record || C.acceptSign(measure, { fp, when: '2026-10-07', from: HOME.id, thr: L_.thr, alt: L_.alt, legMin: L_.legMin, load });
  const published = ap.accept ? { stage: ap.accept.stage, sig: ap.accept.record && ap.accept.record.sig } : null;
  const sampleHash = C.acceptHash(C.acceptCanon(rec.samples.map(s => [s.t, s.alt, s.tas, s.E])));
  return {
    case: name, build: K.build, fp, bad,
    shake: { VCruiseKmh: +(sh.VCruise * 3.6).toFixed(1), VsKmh: +(sh.Vs * 3.6).toFixed(1), VsGen: def.params.gen.Vs,
             clampHi: +(2.2 * def.params.gen.Vs * 3.6).toFixed(1), burnKgH: sh.burnKgH, enduranceCruiseH: sh.enduranceCruiseH,
             rangeKm: sh.rangeKm, thrCruise: def.params.ap.thrCruise, energyKg: sh.energyKg, energyKind: sh.energyKind },
    load, legStart: legT0 != null ? Math.round(legT0) : null, settledQuiet: !!L_.settledQuiet, stage: L_.stage, legEnd,
    record: signed, published, sampleHash, nSamples: rec.samples.length,
    samples: rec.samples.filter((s, i) => i % 10 === 0).map(s => ({ t: +s.t.toFixed(1), alt: +s.alt.toFixed(2), tas: +(s.tas * 3.6).toFixed(2), gs: +(s.gs * 3.6).toFixed(2), E: +s.E.toFixed(4) })),
    all: KEEP ? rec.samples : undefined,
    row, phases, wallMs: Date.now() - wall0,
  };
}

// THE PAGE'S WRAPPER (src/viewer/accept_rec.js) on a stub window: FLIGHT_PROBE hands it the Cub's real sim and pilot
// (flown inline, as ?simw=0 flies), GARAGE_SPEC a logbook, BENCH_FP_OUT the build's fingerprint. A short leg (0.5 min):
// the refusals before it (on the ground), the start, the frame tick, the signature into the logbook once, the note,
// the plaque's row (and withdrawn under another fingerprint), the contract door (evidence / verdict)
function flyPage() {
  const wall0 = Date.now(), vm = require('vm');
  const spec = LB.loadBuild(FILES.cub).spec;
  const fp = B.benchFingerprint(spec, null);
  const def0 = C.buildGen(C.genMigrateSpec(spec));
  const def = Object.assign({}, def0, { params: Object.assign({}, def0.params, { damage: false }), cert: null });
  const W = C.makeWorld(), sim = C.makeSim(def, W); sim.reset(0);
  for (let i = 0; i < 600; i++) sim.step(1 / 60);
  const ap = C.makePilot(sim, def, W);
  const LOG = { built: null, tests: [], flights: [] };
  let manual = false;
  global.window = Object.assign(global.window || {}, {
    FLIGHT_PROBE: { ap: () => ap, sim: () => sim, def: () => def, world: () => W, manual: () => manual, over: () => false },
    GARAGE_SPEC: { log: () => LOG, note: r => LOG.tests.push(r) },
    BENCH_FP_OUT: () => fp, BENCH_FP: () => fp, BENCH_STATE: () => ({ results: {} }), FLYDIY_SIMW: null,
  });
  vm.runInThisContext(fs.readFileSync(path.join(T, '..', 'src', 'viewer', 'accept_rec.js'), 'utf8'), { filename: 'accept_rec.js' });
  const R = global.window.ACCEPT_REC;
  const out = { case: 'page', fp };
  out.refuseGround = R.start({ legMin: 0.5 });
  manual = true; out.refuseHand = null;
  const step = () => { ap.update(1 / 60); sim.step(1 / 60); R.frame(); };
  let n = 0;
  while (ap.phase !== 'CROSSWIND' && n++ < 60 * 300) step();
  out.refuseHand = R.start({ legMin: 0.5 }); manual = false;
  out.start = R.start({ legMin: 0.5 });
  out.refuseTwice = R.start({ legMin: 0.5 });
  n = 0;
  while (!(ap.accept && ap.accept.record) && n++ < 60 * 600) step();
  for (let i = 0; i < 30; i++) step();
  out.state = R.state();
  out.log = LOG;
  out.signedOnce = (LOG.accept || []).length;
  out.plaque = R.plaqueLeg();
  out.plaqueOther = R.plaqueLeg('00000000');
  out.verdict = R.verdict([{ k: 'tasKmh', v: 100 }, { k: 'seats', v: 2 }, { k: 'landAt', at: 'HOME' }]);
  out.wallMs = Date.now() - wall0;
  return out;
}
// THE PHYSICS THREAD'S DOOR (sim_host.js 'accept'): the worker's host made in node (GATE DMGINST's way), the Cub lined
// up at HOME, the start, the leg started by the COMMAND the page's sim_link sends, ticked by the host's own step, its
// state reaching the page through the snapshot's pilot fields (H.meta().ap.accept); a short leg (0.5 min)
function flyHost() {
  const wall0 = Date.now();
  const SH = require(path.join(T, '..', 'src', 'viewer', 'sim_host.js'));
  const spec = LB.loadBuild(FILES.cub).spec;
  const fp = B.benchFingerprint(spec, null);
  const def0 = C.buildGen(C.genMigrateSpec(spec));
  const def = Object.assign({}, def0, { params: Object.assign({}, def0.params, { damage: false }), cert: null });
  const W = C.makeWorld(), sim = C.makeSim(def, W);
  const H = SH.makeSimHost(C, { keepSim: { def, sim }, day: false, world: {}, place: { from: 'HOME', stand: false } }, W);
  H.queueCmd({ cmd: 'start' });
  let n = 0, seen = null, stages = [];
  const meta = () => { const M = H.meta(); if (M.ap && M.ap.accept !== undefined) { seen = M.ap.accept; if (seen && stages[stages.length - 1] !== seen.stage) stages.push(seen.stage); } };
  while (H.ap.phase !== 'CROSSWIND' && n++ < 60 * 300) { H.step(); if (n % 60 === 0) meta(); }
  H.queueCmd({ cmd: 'accept', op: 'start', o: { legMin: 0.5, alt: 300, meta: { fp, when: '2026-10-07', from: 'HOME' } } });
  n = 0;
  while (!(seen && seen.record) && n++ < 60 * 600) { H.step(); if (n % 30 === 0) meta(); }
  return { case: 'host', fp, stages, record: seen ? seen.record : null, hostLegCleared: !H.accept, phase: H.ap.phase, wallMs: Date.now() - wall0 };
}

if (require.main === module) {
  const name = process.argv[2];
  try { console.log(JSON.stringify(name === 'page' ? flyPage() : name === 'host' ? flyHost() : fly(name))); }
  catch (e) { console.log(JSON.stringify({ case: name, error: String(e && e.stack || e) })); process.exitCode = 1; }
}
module.exports = { fly, CASES, FILES };
