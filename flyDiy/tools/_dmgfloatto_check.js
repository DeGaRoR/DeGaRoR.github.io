#!/usr/bin/env node
// GATE DMGFLOATTO (G1882, DMG-FLOATTO): THE FLOATPLANE'S TAKE-OFF IN A CROSSWIND, FLOWN AS A HIGH-THRUST-LINE SEAPLANE IS.
// DMG-DAMP took the solver's hidden 2 s angular damper out (G1885); DMG-HULL and DMG-PLOUGH then traced the user's twin
// on floats nosing over across the SEA lane to its own thrust couple (two 582s 0.54 m over the CG). On the assembled
// bundle (PILOT-ONE-2's water power ramp in) it still nosed over at 2, 2.5, 4.5 and 5 m/s, and the cause is the CHOP
// the wind raises on the lane: with the sea flattened every crosswind run is the calm one. The porpoise it drives on
// the step is no longer damped by the solver; the pilot damps it (G1880, 39b S.porpoise, 43's FEATURE porpoise: the
// power off as the nose falls, the stick forward as it rises, armed by the thrust couple's lever) and the into-wind
// bank afloat is bounded as on the wheels (G1881). What this gate holds:
//   SWEEP  the validated floatplanes (tools/_load_build.js `twinFloats` and `floats`, AS THE GAME FLIES THEM), THE
//          PILOT, the SEA lane, 0, 0.5 .. 5 m/s straight across: every take-off COMPLETES (the pilot reaches CLIMB:
//          a hop that settles back and is rejected is not one), NO NOSE-OVER (the pitch at every float contact from
//          the roll to CLIMB never below -20 deg), the run's heading swing and |x| off the lane under 30 (GATE
//          SEAPLANE's: until first dry for 2 s; the worst at any later touch printed beside), every row printed with
//          its water run, lowest / highest pitch, skips, balks and how long the power was held back
//   LAND   the technique never arms on a wheeled take-off (the Cub, the metal Cessna: the power's ceiling stays 1)
//   node tools/_dmgfloatto_check.js [--only=sweep,land] [--winds=0,2,4,5] [--builds=twinFloats,floats]
//        [--core=<flight_core.js>] [--procs=4] [--evidence=<dir> --name=<file>] [--json]
//        EXPERIMENTS (never the gate's default): --ap=k:v,.. (the pilot's per-aeroplane keys, dotted for a sub-object)
//        --thrCap=c --capUntil=V (PLOUGH's instrument: the throttle held at c until the speed passes V)
'use strict';
const path = require('path'), fs = require('fs'), cp = require('child_process'), os = require('os');
const ARGS = process.argv.slice(2);
const arg = (k, d) => { const a = ARGS.find(s => s.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
// --core: fly another core (the before / after A/B) - aliased in the require cache so the load chain shares it
const CORE = arg('core', null);
if (CORE) { const abs = path.resolve(CORE); require(abs); require.cache[path.join(__dirname, 'flight_core.js')] = require.cache[abs]; }
const C = require(path.join(__dirname, 'flight_core.js'));
const LB = require(path.join(__dirname, '_load_build.js'));
const D2R = Math.PI / 180;
const NOSE = -20;   // deg: the pitch on the water run never below this (the brief's no-nose-over bar)
const THRCAP = arg('thrCap', null) != null ? +arg('thrCap') : null, CAPV = +arg('capUntil', 6);
const BUILDS = { twinFloats: 'twin on floats', floats: 'Cessna on floats' };
const LANDB = { cub: 'the user\'s Cub', metal: 'the metal Cessna' };
const _defs = {};
function defOf(key) {
  if (!_defs[key]) {
    const d = C.buildGen(C.genMigrateSpec(LB.loadValidated(key).spec));
    // --ap=k:v,..: an EXPERIMENT on the pilot's per-aeroplane keys (def.params.ap), never the gate's default
    const ov = arg('ap', null);
    if (ov) { d.params = Object.assign({}, d.params, { ap: Object.assign({}, d.params.ap) }); for (const kv of ov.split(',')) { const [k, v] = kv.split(':'), val = v === 'true' ? true : v === 'false' ? false : +v; const ks = k.split('.'); let o = d.params.ap; for (const q of ks.slice(0, -1)) o = o[q] = Object.assign({}, o[q]); o[ks[ks.length - 1]] = val; } }
    _defs[key] = d;
  }
  return _defs[key];
}
const pitchOf = sim => Math.asin(Math.max(-1, Math.min(1, -sim.axes()[0][1]))) / D2R;
const hdgOf = sim => { const xA = sim.axes()[0]; return Math.atan2(-xA[0], -xA[2]) / D2R; };

// ---- the water take-off (GATE SEAPLANE's crosswind run, judged until dry for 2 s) ----------------------------------
function takeoff(key, wind, trace) {
  const def = defOf(key);
  const world = C.makeWorld();
  if (wind) world.setWind({ base: [wind, 0, 0], gust: 0 });
  const sea = world.aerodromes.find(a => a.id === 'SEA');
  const sim = C.makeSim(def, world); sim.reset(0); C.placeAtAerodrome(sim, sea);
  const ap = C.makePilot(sim, def, world); ap.setRoute(sea, sea);
  const R = { key, wind, lift: null, roll0: null, swing: 0, swingRun: 0, xRun: 0, air2: null, x: 0, skips: 0, balks: 0, pitchMin: 0, pitchMax: -90, tNose: null, finite: true,
              ploughT: 0, thrMin: 1, phaseEnd: null, reject: null, tr: trace ? [] : null };
  // THE WHOLE RUN IS JUDGED, from the first ROLL frame to CLIMB: every wet frame (a hop that settles back and is
  // rejected is not a take-off - GATE SEAPLANE's "dry 2 s" read one as airborne); the lift-off is the start of the
  // last dry stretch before CLIMB; a skip is any return to the water after a dry moment. The heading swing and the lane
  // are GATE SEAPLANE's - the water run until the aeroplane is first dry for 2 s (swingRun, xRun, asserted) - and, printed
  // beside them, the worst at any float contact until CLIMB (swing, x: a crabbed touch on a hop after the lift-off)
  let T = 0, wasWet = true, dryFrom = null, hRef = null;
  for (let s = 0; s < 150 * 60; s++) {
    ap.update(1 / 60);
    // INSTRUMENT (PLOUGH's, not the pilot): --thrCap=c --capUntil=V holds the throttle at c until the speed passes V
    if (THRCAP != null) { const vv = sim.cgVel(); if (Math.hypot(vv[0], vv[2]) < CAPV) sim.ctl.thr = Math.min(sim.ctl.thr, THRCAP); }
    sim.step(1 / 60); T += 1 / 60;
    const cg = sim.cgPos();
    if (!Number.isFinite(cg[0])) { R.finite = false; break; }
    const wet = sim.hydro.floats.reduce((a, x) => a + x.wet, 0) > 0, pit = pitchOf(sim), hdg = hdgOf(sim);
    const v = sim.cgVel(), V = Math.hypot(v[0], v[2]);
    if (hRef == null && ap.phase === 'ROLL') { hRef = hdg; R.roll0 = T; }
    if (hRef != null && wet) {
      const d = ((hdg - hRef + 540) % 360) - 180;
      R.swing = Math.max(R.swing, Math.abs(d));
      R.pitchMin = Math.min(R.pitchMin, pit); R.pitchMax = Math.max(R.pitchMax, pit);
      if (R.tNose == null && pit < NOSE) R.tNose = T;
      R.x = Math.max(R.x, Math.abs(cg[0]));
      if (R.air2 == null) { R.swingRun = Math.max(R.swingRun, Math.abs(d)); R.xRun = Math.max(R.xRun, Math.abs(cg[0])); }
    }
    if (hRef != null && ap.thrCap != null) {
      if (ap.thrCap < 1) R.thrMin = Math.min(R.thrMin, ap.thrCap);
      if (ap.thrCap < 0.98) R.ploughT += 1 / 60;   // the power held back: the ceiling 2 % or more under full
    }
    if (R.tr && s % 6 === 0 && hRef != null)
      R.tr.push([+(T - R.roll0).toFixed(2), +V.toFixed(2), +pit.toFixed(2), +sim.ctl.thr.toFixed(3), +(sim.ctl.de || 0).toFixed(3), +(((hdg - hRef + 540) % 360) - 180).toFixed(2), wet ? 1 : 0, ap.thrCap == null ? 1 : +ap.thrCap.toFixed(3)]);
    if (hRef != null && !wet && wasWet) dryFrom = T;
    if (R.air2 == null && !wet && dryFrom != null && T - dryFrom >= 2) R.air2 = dryFrom;
    if (hRef != null && wet && !wasWet && dryFrom != null) { R.skips++; dryFrom = null; }
    wasWet = wet;
    if ((ap.phase === 'ABORT' || ap.phase === 'STOPPED') && !R.reject) R.reject = ((ap.report.verdicts || []).filter(e => e.code === 'rejected-takeoff' || e.code === 'wont-climb').pop() || {}).note || ap.phase;
    if (ap.phase === 'CLIMB' || ap.phase === 'STOPPED') { R.phaseEnd = ap.phase; break; }
  }
  R.balks = (ap.report.verdicts || []).filter(e => e.code === 'balked').length;
  R.noseOver = R.tNose != null;
  R.climb = R.phaseEnd === 'CLIMB';
  if (R.climb && dryFrom != null) R.lift = dryFrom;
  R.run = R.lift != null && R.roll0 != null ? R.lift - R.roll0 : null;   // the water run: the throttle's roll to lift-off
  R.ok = R.finite && R.climb && !R.noseOver && R.swingRun < 30 && R.xRun < 30;
  return R;
}

// ---- a wheeled take-off: the technique never arms (it is the water's) ---------------------------------------------
function landTO(key) {
  const def = defOf(key);
  const world = C.makeWorld();
  const home = world.aerodromes[0];
  const sim = C.makeSim(def, world); sim.reset(0); C.placeAtAerodrome(sim, home);
  const ap = C.makePilot(sim, def, world); ap.setRoute(home, home);
  let armed = 0, T = 0, lift = null;
  for (let s = 0; s < 90 * 60; s++) {
    ap.update(1 / 60); sim.step(1 / 60); T += 1 / 60;
    if (ap.thrCap != null && ap.thrCap < 1) armed++;
    if (lift == null && ap.phase === 'LIFTOFF') lift = T;
    if (ap.phase === 'CLIMB') break;
  }
  return { key, land: true, armed, lift, phase: ap.phase };
}

// ---- child mode ----------------------------------------------------------------------------------------------------
const CHILD = arg('child', null);
if (CHILD) {
  const [what, key, w] = CHILD.split(':');
  const r = what === 'land' ? landTO(key) : takeoff(key, +w, ARGS.includes('--trace'));
  process.stdout.write('RESULT ' + JSON.stringify(r) + '\n');
  process.exit(0);
}
function pool(jobs, n) {
  return new Promise(resolve => {
    const out = new Array(jobs.length); let next = 0, done = 0;
    if (!jobs.length) return resolve(out);
    const run = () => {
      if (next >= jobs.length) return;
      const i = next++;
      const extra = (jobs[i].trace ? ['--trace'] : []).concat(CORE ? ['--core=' + path.resolve(CORE)] : []).concat(ARGS.filter(a => /^--(ap|thrCap|capUntil)=/.test(a)));
      cp.execFile(process.execPath, [__filename, '--child=' + jobs[i].id].concat(extra), { maxBuffer: 64 << 20 }, (err, so, se) => {
        const line = (so || '').split('\n').find(l => l.startsWith('RESULT '));
        out[i] = line ? JSON.parse(line.slice(7)) : { error: (se || String(err)).slice(-400), job: jobs[i].id };
        if (++done === jobs.length) resolve(out); else run();
      });
    };
    for (let k = 0; k < Math.min(n, jobs.length); k++) run();
  });
}

(async () => {
  const ONLY = arg('only', 'sweep,land').split(',');
  const WINDS = arg('winds', '0,0.5,1,1.5,2,2.5,3,3.5,4,4.5,5').split(',').map(Number);
  const KEYS = arg('builds', Object.keys(BUILDS).join(',')).split(',');
  const EVID = arg('evidence', null);
  const NPROC = Math.max(1, Math.min(+arg('procs', os.cpus().length), 8));
  let fails = 0;
  const verdict = (ok, line) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + line); };
  const jobs = [];
  // the Cessna's runs are the long ones (~30 s of water): queued first
  if (ONLY.includes('sweep')) for (const k of KEYS.slice().reverse()) for (const w of WINDS) jobs.push({ id: `to:${k}:${w}`, trace: true });
  if (ONLY.includes('land')) for (const k of Object.keys(LANDB)) jobs.push({ id: `land:${k}` });
  const t0 = Date.now();
  const out = await pool(jobs, NPROC);
  for (const b of out.filter(r => r.error)) verdict(false, `child ${b.job} failed: ${b.error}`);
  const ok = out.filter(r => !r.error), res = { sweep: ok.filter(r => !r.land), land: ok.filter(r => r.land) };
  if (ONLY.includes('sweep')) {
    console.log(`SWEEP (THE PILOT, the SEA lane, straight across; the whole run judged until CLIMB; no nose-over = pitch on the water >= ${NOSE} deg)`);
    for (const k of KEYS) {
      const rows = res.sweep.filter(r => r.key === k).sort((a, b) => a.wind - b.wind);
      console.log(`   ${BUILDS[k]}:  wind | water run s | swing deg (any touch) | |x| m (any touch) | pitch on the water min..max deg | skips | balks | power held back s (lowest) | class`);
      for (const r of rows) console.log(`     ${r.wind.toFixed(1).padStart(4)} | ${r.run == null ? '    -   ' : r.run.toFixed(1).padStart(8)} | ${r.swingRun.toFixed(1).padStart(5)} (${r.swing.toFixed(1).padStart(5)}) | ${r.xRun.toFixed(1).padStart(5)} (${r.x.toFixed(1).padStart(5)}) | ${r.pitchMin.toFixed(1).padStart(6)} .. ${r.pitchMax.toFixed(1).padStart(5)} | ${r.skips} | ${r.balks} | ${r.ploughT.toFixed(1).padStart(5)} (${r.thrMin < 1 ? r.thrMin.toFixed(2) : '  - '}) | ${r.ok ? 'ok' : !r.finite ? 'DIVERGED' : r.noseOver ? 'NOSE-OVER' : !r.climb ? 'NOT AWAY (' + (r.reject || r.phaseEnd || 'timeout') + ')' : r.swingRun >= 30 ? 'YAW SWING' : 'OFF THE LANE'}${r.ok && r.swing >= 30 ? ' (a touch after the lift-off ' + r.swing.toFixed(0) + ' deg off)' : ''}`);
      verdict(rows.every(r => !r.noseOver && r.finite), `${BUILDS[k]}: no nose-over at any wind (lowest pitch on the water ${Math.min(...rows.map(r => r.pitchMin)).toFixed(1)} deg, bar ${NOSE})`);
      verdict(rows.every(r => r.climb), `${BUILDS[k]}: every take-off completes (the pilot reaches CLIMB)${rows.filter(r => !r.climb).length ? ' - not at ' + rows.filter(r => !r.climb).map(r => r.wind).join(', ') : ''}`);
      verdict(rows.every(r => r.swingRun < 30 && r.xRun < 30), `${BUILDS[k]}: the run's swing and lane under 30, GATE SEAPLANE's (worst ${Math.max(...rows.map(r => r.swingRun)).toFixed(1)} deg, ${Math.max(...rows.map(r => r.xRun)).toFixed(1)} m)`);
      const late = rows.filter(r => r.swing >= 30 || r.x >= 30);
      if (late.length) console.log(`NOTE ${BUILDS[k]}: a float touched ${late.map(r => r.swing.toFixed(0) + ' deg / ' + r.x.toFixed(0) + ' m off at ' + r.wind + ' m/s').join(', ')} after the aeroplane had flown (a hop at the lift-off, crabbed into the wind; HANDOVER G1880-G1882, open)`);
    }
  }
  if (ONLY.includes('land')) {
    console.log('\nLAND (a wheeled take-off: the technique never arms)');
    for (const r of res.land) verdict(r.armed === 0 && r.lift != null, `${LANDB[r.key]}: off the ground (LIFTOFF at ${r.lift == null ? '-' : r.lift.toFixed(1)} s), the power held back on ${r.armed} frames`);
  }
  console.log(`\n(${jobs.length} runs in ${((Date.now() - t0) / 1000).toFixed(0)} s on ${NPROC} processes${CORE ? ', core ' + CORE : ''})`);
  if (EVID) { fs.mkdirSync(EVID, { recursive: true }); fs.writeFileSync(path.join(EVID, arg('name', 'dmgfloatto') + '.json'), JSON.stringify(res)); }
  if (ARGS.includes('--json')) console.log('JSON ' + JSON.stringify(res));
  console.log(fails ? `GATE DMGFLOATTO: FAIL (${fails})` : 'GATE DMGFLOATTO: PASS');
  process.exit(fails ? 1 : 0);
})();
