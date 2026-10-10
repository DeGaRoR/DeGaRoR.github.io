#!/usr/bin/env node
// GATE RADIALDIV (G2630 RADIAL-DIVERGE) — THE USER'S MOSQUITO, BOTH BUILDS, FLY.
// The user (9-10 Oct): "massive issues with radial engines. mosquito turns in circle for no obvious reasons,
// mosquito (1) makes the game crash, and everything is fine if I swap for a boxer engine."
// The builds are the user's own files (+ SYNTH, below) (tools/fixtures/repro/mosquito.json, mosquito_1.json: a 620 kg carbon
// single-seat taildragger, oleo gear, the M-14P radial; (1) differs ONLY in its tailwheel spring, 0.2 m vs 0.4 m).
// THE CAUSE (HANDOVER G2630): genSubstepsTrue (62_gen_aero.js) capped the step at 200 and, where even 200 could not
// carry the dampers, flew them uncut: the oleo's tailwheel bracing dampers (3.7 kg into 0.41 kg carbon nodes) asked
// 483 / 549 substeps, the network read 5.4 against the integrator's hard 4 - the tail rang at rest (20-33 % strain,
// the wheel forces rectified into a turn on the spot) or went NaN on the first frame ('sim-diverged' t 0).
//
//   node tools/_radialdiv_check.js            -> "GATE RADIALDIV: PASS|FAIL"
//   node tools/_radialdiv_check.js --show     -> the numbers per build
//   node tools/_radialdiv_check.js --selftest -> negative verification: the dampers put back as built (the old rule)
//                                               must turn the REST and CONSTRUCTION rows red
//
// WHAT IT ASSERTS, per build:
//   CONSTRUCTION  the flown network inside the integrator's margin: (omega dt)^2 + 2 gamma dt <= GEN_NET_MAX (3.0) at
//                 the build's own step (genNetEig, the rule's own measure, dry masses)
//   REST          lined up at HOME, the engine running at idle and at 30 % throttle, hands off, brakes off, 30 s:
//                 finite, the largest member strain after the first 5 s under 5 % (the Cub reads 3.2 %, the ringing tail read 17-33 %), the heading moved under 5 deg at
//                 idle (no turn on the spot)
//   FLIGHT        from HOME's stand to Tamgas Hill (w3), the game's pilot, through the take-off to 60 s after the
//                 lift-off: finite, never 'sim-diverged', airborne inside 300 s
//   HANDS OFF     then 20 s with the stick and the rudder centred (elevator and throttle where the pilot left them):
//                 finite, the heading moved under HO_TURN (15) deg, released wings level and steady (the Cub flown the same
//                 way: -4.1 deg; the Mosquitos -1.5; a standard-rate circle is 60)
// The validated builds' bit-identity under the fix is GEN's / PILOT's business and the HANDOVER's table.
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname;
const C = require(process.env.CORE || path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));

const argv = process.argv.slice(2);
const SHOW = argv.includes('--show'), SELF = argv.includes('--selftest');
const ONLY = (() => { const a = argv.find(x => x.startsWith('--only=')); return a ? a.slice(7).split(',') : null; })();
// SYNTH (the user: "we don't care about the mosquito design as such. It is a symptom for our engine, so all fixes should
// be generic"): the validated Jodel (builds/jodel_2026-09-20_corrected.json) with a carbon fuselage, the R-985 radial
// and its oleo at stiffness 3 - heavy nose, light carbon nodes, a hard damper: NaN on master's core at frame 0. Not a
// design anyone flies; the construction and the rest are asked of it, the flight is the user's builds'.
const BUILDS = {
  mosquito:   { file: 'tools/fixtures/repro/mosquito.json', fly: true },
  mosquito_1: { file: 'tools/fixtures/repro/mosquito_1.json', fly: true },
  // the REFERENCE for the hands-off row: the user's Cub, flown the same way (its own rows are PILOT's; this one is asked
  // only for its hands-off turn, which bounds the radial's)
  cub:        { file: 'builds/cub_2026-09-20_corrected.json', fly: true, ref: true },
  synth:      { file: 'builds/jodel_2026-09-20_corrected.json', fly: false,
                edit: s => { s.gear.suspension = 'oleo'; s.gear.stiffness = 3; s.fuselage.material = 'carbon'; s.engines[0].type = 'r985_hs2b20'; } },
};
const NET_MAX = 3.0, REST_STRAIN = 0.05, REST_TURN = 5, HO_TURN = 15, AIR_BY = 300;
const D = 180 / Math.PI;
const jolene = () => IN.islandWorld('jolene', { premises: fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8') });
const bankOf = sim => { const [, yU, zR] = sim.axes(); return Math.atan2(zR[1], yU[1]) * D; };
const nose = sim => { const [xA] = sim.axes(); return Math.atan2(-xA[2], -xA[0]); };
const wrap = a => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
const finite = sim => { for (let i = 0; i < sim.p.length; i++) if (!Number.isFinite(sim.p[i])) return false; return true; };

// the build as the game makes it; `asBuilt`: the dampers the cap cut put back (the old rule, for the selftest)
function defOf(key, asBuilt) {
  const B = BUILDS[key], raw = JSON.parse(fs.readFileSync(path.join(T, '..', B.file), 'utf8'));
  const spec = JSON.parse(JSON.stringify(raw.spec));
  if (B.edit) B.edit(spec);
  const def = C.buildGen(C.genMigrateSpec(spec));
  if (asBuilt) for (const b of def.beams) if (b.cSized != null && b.kTrue == null) b.c = b.cSized;
  return def;
}
function netMetric(def) {
  const N = def.nodes, dry = i => (N[i].mFuel ? Math.max(0.5, N[i].m - N[i].mFuel) : N[i].m);
  const dt = 1 / (60 * (def.params.substeps || 24));
  return C.genNetEig(N, def.beams, b => b.k, dry) * dt * dt + 2 * C.genNetEig(N, def.beams, b => b.c, dry) * dt;
}
function start(def, W, a, lineup) {
  const sim = C.makeSim(def, W); sim.reset(0); if (sim.stance) sim.stance();
  const site = C.siteOf(a.id);
  C.placeAtStand(sim, a, site.stand); C.seatOnGround(sim, (x, z) => W.terrainH(x, z), def.refs);
  if (lineup) {
    const q = C.makePilot(sim, def, W, {}); q.setRoute(a, a); q.departFrom(a, a, site);
    const pose = q.lineupPose(); sim.reset(0); if (sim.stance) sim.stance(); C.placeAtLineup(sim, a, pose, W, def.refs);
  }
  if (sim.setEngine && sim.eng) for (let i = 0; i < sim.eng.length; i++) sim.setEngine(i, { key: 'both', running: true });
  return sim;
}
function rest(def, thr) {
  const W = jolene(), a = W.aerodromes.find(x => x.id === 'HOME'), sim = start(def, W, a, true);
  let hp = nose(sim), turn = 0, smax = 0;
  for (let s = 0; s < 30 * 60; s++) {
    Object.assign(sim.ctl, { thr, de: 0, da: 0, dr: 0, brake: 0 });
    sim.step(1 / 60);
    if (!finite(sim)) return { nan: +(s / 60).toFixed(2) };
    const h = nose(sim); turn += wrap(h - hp); hp = h;
    if (s >= 300) smax = Math.max(smax, sim.stats().smax);
  }
  return { turn: +(turn * D).toFixed(2), smax: +smax.toFixed(4) };
}
function flight(def) {
  const W = jolene(), A = id => W.aerodromes.find(x => x.id === id), sim = start(def, W, A('HOME'), false);
  const ap = C.makePilot(sim, def, W, {}); ap.departFrom(A('HOME'), A('w3'), C.siteOf('HOME'));
  const R = { phases: [] }; let last = null, lof = null, s;
  for (s = 0; s < (AIR_BY + 70) * 60; s++) {
    ap.update(1 / 60); sim.step(1 / 60);
    if (ap.phase !== last) { R.phases.push((s / 60).toFixed(0) + ' ' + ap.phase); last = ap.phase; }
    if (!finite(sim) || sim.stats().bad) { R.nan = +(s / 60).toFixed(2); break; }
    if (lof == null && sim.wheelsOnGround() === 0 && (ap.phase === 'LIFTOFF' || ap.phase === 'CLIMB')) lof = s;
    if (lof != null && s - lof >= 60 * 60) break;
    const o = ap.report && ap.report.outcome; if (o && o !== 'completed') { R.outcome = o; break; }
  }
  R.lof = lof == null ? null : +(lof / 60).toFixed(1); R.t = +(s / 60).toFixed(1);
  R.alt = +sim.cgPos()[1].toFixed(0);
  if (lof != null && R.nan == null && !R.outcome) {
    // the pilot flies on until it is wings level and its heading steady (|bank| < 2 deg, |yaw rate| < 0.3 deg/s for 3 s,
    // at most 120 s) - a release in the middle of a turn measures the turn, not the aeroplane
    let hp = nose(sim), calm = 0, k = 0;
    for (; k < 120 * 60 && calm < 180; k++) {
      ap.update(1 / 60); sim.step(1 / 60);
      if (!finite(sim)) { R.nan = +((s + k) / 60).toFixed(2); return R; }
      const h = nose(sim), r = Math.abs(wrap(h - hp)) * 60 * D; hp = h;
      calm = (Math.abs(bankOf(sim)) < 2 && r < 0.3) ? calm + 1 : 0;
    }
    R.steady = calm >= 180;
    const de = sim.ctl.de, thr = sim.ctl.thr; let turn = 0;
    for (let q = 0; q < 20 * 60; q++) {
      Object.assign(sim.ctl, { de, thr, da: 0, dr: 0 });
      sim.step(1 / 60);
      if (!finite(sim)) { R.hoNaN = +(q / 60).toFixed(2); break; }
      const h = nose(sim); turn += wrap(h - hp); hp = h;
    }
    R.hoTurn = +(turn * D).toFixed(1); R.hoBank = +bankOf(sim).toFixed(1);
  }
  return R;
}

function run(asBuilt, rows) {
  let fail = [];
  const check = (ok, label, extra) => { if (!ok) fail.push(label + (extra != null ? ' - ' + extra : '')); if (SHOW) console.log((ok ? '  ok   ' : '  FAIL ') + label + (extra != null ? '  (' + extra + ')' : '')); return ok; };
  for (const key of Object.keys(BUILDS)) {
    if (rows && !rows.includes(key)) continue;
    const def = defOf(key, asBuilt);
    const m = netMetric(def);
    check(m <= NET_MAX + 1e-9, key + ': CONSTRUCTION the network inside the margin at ' + def.params.substeps + ' substeps', m.toFixed(3) + ' <= ' + NET_MAX);
    const r0 = rest(def, 0);
    if (check(r0.nan == null, key + ': REST idle finite', r0.nan != null ? 'NaN at ' + r0.nan + ' s' : null)) {
      check(r0.smax < REST_STRAIN, key + ': REST idle, the largest strain after 5 s', r0.smax + ' < ' + REST_STRAIN);
      check(Math.abs(r0.turn) < REST_TURN, key + ': REST idle, no turn on the spot', r0.turn + ' deg, bound ' + REST_TURN);
    }
    if (asBuilt || !BUILDS[key].fly) continue;    // (the selftest asks the construction and the rest; the flight is the user's builds')
    const r3 = rest(def, 0.3);
    if (check(r3.nan == null, key + ': REST 30 % finite', r3.nan != null ? 'NaN at ' + r3.nan + ' s' : null))
      check(r3.smax < REST_STRAIN, key + ': REST 30 %, the largest strain after 5 s', r3.smax + ' < ' + REST_STRAIN);
    const F = flight(def);
    if (SHOW) console.log('    ' + key + ' flight: ' + JSON.stringify(F));
    check(F.nan == null, key + ': FLIGHT finite', F.nan != null ? 'NaN at ' + F.nan + ' s' : null);
    check(F.outcome == null, key + ': FLIGHT not ended by the pilot or the sim', F.outcome);
    check(F.lof != null && F.lof <= AIR_BY, key + ': FLIGHT airborne inside ' + AIR_BY + ' s', F.lof);
    check(F.lof == null || F.t - F.lof >= 59.9, key + ': FLIGHT 60 s after the lift-off', F.lof != null ? (F.t - F.lof).toFixed(1) + ' s' : null);
    if (F.hoTurn != null || F.hoNaN != null) {
      check(F.hoNaN == null, key + ': HANDS OFF finite', F.hoNaN);
      check(F.hoTurn != null && Math.abs(F.hoTurn) < HO_TURN, key + ': HANDS OFF 20 s, the heading moved under ' + HO_TURN + ' deg', F.hoTurn);
    }
  }
  return fail;
}

if (SELF) {
  // the old rule: every damper the cap cut, put back - CONSTRUCTION and REST must go red on both builds
  const f = run(true);
  const want = Object.keys(BUILDS).map(k => [k + ': CONSTRUCTION', k + ': REST']);
  const missed = want.filter(([a, b]) => !f.some(x => x.startsWith(a)) || !f.some(x => x.startsWith(b)));
  if (SHOW) for (const x of f) console.log('  (red, as it must) ' + x);
  console.log('GATE RADIALDIV selftest: ' + (missed.length ? 'MISSED ' + JSON.stringify(missed) : 'CAUGHT (' + f.length + ' reds on the old rule)'));
  process.exit(missed.length ? 1 : 0);
}
const fail = run(false, ONLY);
for (const x of fail) console.log('  FAIL ' + x);
console.log('GATE RADIALDIV: ' + (fail.length ? 'FAIL (' + fail.length + ')' : 'PASS'));
process.exit(fail.length ? 1 : 0);
