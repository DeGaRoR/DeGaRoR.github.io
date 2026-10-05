#!/usr/bin/env node
// GATE DMGPLOUGH (G1809, DMG-PLOUGH): THE PLOUGH - the floatplanes' trim through the displacement regime and the hump,
// and the plough wave (G1807, 32_hydro.js ploughWave) that was built to supply it and SHIPS OFF.
// DMG-HULL (G1847-G1849, open question 1) traced the twin on floats' crosswind failures to NOSE-OVERS at the plough and
// read the cause as missing physics: no bow-up wave trim in the displacement regime. G1807 built that wave (the
// hull's Kelvin transverse wave, Noblesse's bow-wave height, faded onto the step) and measured it; G1808 measured what
// the plough's trim actually is and what drives the twin down. This gate holds what was found:
//   LAW (the rigid bench, each validated floatplane's own float, the wave forced ON: kWave 1):
//     - SHIPPED OFF: DEF.kWave is 0, and a float built by the generator carries 0 - the base to the bit
//     - ZERO AT REST (U 0: no amplitude, the forces bit-identical to the wave off) and ZERO DRY (a metre over: 0 N)
//     - THE AMPLITUDE against Fn = U / sqrt(g L_wl): zero at rest, rising as U^2 / (1 + F_D), whole to waveFn0 and
//       faded to NOTHING by waveFn1 (on the step, where Savitsky's planing law and the ventilated wake carry the hull):
//       its peak inside waveFn0..waveFn0 + 0.3, and every Fn >= waveFn1 exactly 0 N and 0 N m
//   HUMP (the calm take-off, THE PILOT, the SEA lane, the default builds): the hump = the floats' water resistance at
//        its maximum (0.5 s smoothed) on the run; the float's KEEL trim there (the forebody's flat keel against the
//        level: what a towing tank measures), its lowest trim on the run and its highest before the hump.
//        The real band at the hump: ~8-12 deg nose-up (free-to-trim tank tests of floats and flying-boat hulls,
//        recalled; HANDOVER G1807). Asserted: the Cessna on floats inside the band and never nose-down on the run. The
//        twin is REPORTED (OWED): it ploughs nose-DOWN at Fn 0.4-0.7.
//   ATTRIBUTION (an INSTRUMENT, not a build change: the twin with its two engines' thrust applied at the nose frame's
//        upper nodes, 0.17 m over the CG, instead of the engines, 0.57 m over it): the twin's own floats trim it
//        NOSE-UP through the plough with the base's hydro - its lowest keel trim on the run stays positive and its
//        trim at the hump is nose-up. Asserted: so the plough's bow-up trim IS in the base, and what drives the twin
//        down is its thrust couple (two Rotax 582s, T/W 0.52, 0.57 m over the CG) plus the water drag 1.5 m under it.
//   WAVE ON (the law flipped on, kWave 1): the calm take-off on both builds - REPORTED (it does not lift the twin's
//        bow: the crest sits on the narrow bow, the trough on the wide forebody ahead of the CG, and the twin noses
//        over in calm air).
//   SWEEP (GATE SEAPLANE's crosswind take-off 0-5 m/s across in 0.5 m/s steps; the default builds, and the twin with
//        the instrument): lift-off, heading swing, |x| off the lane, the lowest pitch, each failure classed (a YAW
//        loop or a NOSE-OVER at the plough, as GATE DMGHULL classes them). Asserted: the Cessna on floats clean at
//        every wind; the twin clean over 0-1.5 m/s (DMG-HULL's clean band); the twin's failures past that printed
//        OWED, classed; the instrumented twin REPORTED.
//   node tools/_dmgplough_check.js [--json] [--only=law,hump,sweep] [--winds=0,1,2] [--evidence=<dir>] [--procs=4]
'use strict';
const path = require('path'), fs = require('fs'), cp = require('child_process'), os = require('os');
const ARGS = process.argv.slice(2);
const arg = (k, d) => { const a = ARGS.find(s => s.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const L = require(path.join(__dirname, '_treecrash_lib.js'));
const C = L.core();
const H = C.HYDRO;
const D2R = Math.PI / 180, G = 9.81;
const BAND = [8, 12];   // deg nose-up at the hump (HANDOVER G1807: recalled tank ranges)

// ---- the builds (GATE DMGHULL's) --------------------------------------------------------------------------------
const BUILDS = { twin: 'twin on floats', cessna: 'Cessna on floats' };
function defOf(key, mode) {
  let def;
  if (key === 'twin') {
    const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'build_v7_ultralight_2026-09-05.json'), 'utf8')).spec;
    spec.gear.type = 'floats';
    def = C.buildGen(C.genMigrateSpec(spec));
  } else def = L.defOf('floats', { elastic: true });
  def = Object.assign({}, def, { params: Object.assign({}, def.params) });
  if (mode === 'wave') def.parts = Object.assign({}, def.parts, { floats: def.parts.floats.map(r => Object.assign({}, r, { P: Object.assign({}, r.P, { kWave: 1 }) })) });
  // the INSTRUMENT: the thrust on the nose frame's upper nodes (the twin: 0.17 m over the CG) instead of the engines
  if (mode === 'thrustcg') def.refs = Object.assign({}, def.refs, { engine: def.refs.upHi.slice(0, def.refs.engine.length) });
  return def;
}
const pitchOf = sim => Math.asin(Math.max(-1, Math.min(1, -sim.axes()[0][1]))) / D2R;
const hdgOf = sim => { const xA = sim.axes()[0]; return Math.atan2(-xA[0], -xA[2]) / D2R; };
// the float's keel trim: its frame's x is aft along the forebody's flat keel, so a nose-up keel points x down
const keelTrim = fx => -Math.asin(Math.max(-1, Math.min(1, fx.ctx.xhat[1]))) / D2R;

// ---- the take-off: GATE SEAPLANE's, measured for the plough and classed for the sweep --------------------------------
function takeoff(key, mode, wind, trace) {
  const def = defOf(key, mode);
  const world = C.makeWorld();
  if (wind) world.setWind({ base: [wind, 0, 0], gust: 0 });
  const sea = world.aerodromes.find(a => a.id === 'SEA');
  const sim = C.makeSim(def, world); sim.reset(0); C.placeAtAerodrome(sim, sea);
  const ap = C.makePilot(sim, def, world); ap.setRoute(sea, sea);
  const P = def.parts.floats[0].P, Vs = def.params.gen.Vs;
  const R = { key, mode, wind, lift: null, swing: 0, x: 0, skips: 0, pitchMin: 0, tSwing30: null, tNose30: null, finite: true,
              B: P.B, L: P.L, Vs, tr: trace ? [] : null };
  const run = [];   // per frame on the water run: V, the floats' resistance / W, keel trim, pitch, Fn_L, wave amplitude
  const W = def.params.gen.mass * G;
  let T = 0, wasWet = true, dryFrom = null, airborne = false, hRef = null;
  for (let s = 0; s < 120 * 60; s++) {
    ap.update(1 / 60); sim.step(1 / 60); T += 1 / 60;
    const cg = sim.cgPos();
    if (!Number.isFinite(cg[0])) { R.finite = false; break; }
    const fl = sim.hydro.floats, wet = fl.reduce((a, x) => a + x.wet, 0) > 0, hdg = hdgOf(sim), pit = pitchOf(sim);
    if (wet && !airborne && (ap.phase === 'ROLL' || ap.phase === 'LIFTOFF')) {
      if (hRef == null) hRef = hdg;
      const d = ((hdg - hRef + 540) % 360) - 180;
      R.swing = Math.max(R.swing, Math.abs(d));
      if (R.tSwing30 == null && Math.abs(d) > 30) R.tSwing30 = T;
      R.pitchMin = Math.min(R.pitchMin, pit);
      if (R.tNose30 == null && pit < -30) R.tNose30 = T;
      const v = sim.cgVel(), V = Math.hypot(v[0], v[2]), fwd = sim.axes()[0];
      let res = 0; for (const fx of fl) if (fx.wet) res += fx.out.F[0] * fwd[0] + fx.out.F[1] * fwd[1] + fx.out.F[2] * fwd[2];
      const fx0 = fl[0];
      run.push([T, V, res / W, keelTrim(fx0), pit, fx0.out.wave ? fx0.out.wave.Fn : 0, fx0.out.wave ? fx0.out.wave.a : 0]);
    }
    if (wet && !airborne) R.x = Math.max(R.x, Math.abs(cg[0]));
    if (R.tr && s % 6 === 0) R.tr.push([+T.toFixed(2), +(hRef == null ? 0 : ((hdg - hRef + 540) % 360) - 180).toFixed(2), +pit.toFixed(2), +keelTrim(fl[0]).toFixed(2), +Math.hypot(sim.cgVel()[0], sim.cgVel()[2]).toFixed(2), wet ? 1 : 0]);
    if (!wet && wasWet && T > 2 && !airborne) dryFrom = T;
    if (wet && !wasWet && dryFrom != null && !airborne) { R.skips++; dryFrom = null; }
    if (!wet && dryFrom != null && !airborne && T - dryFrom >= 2) { airborne = true; R.lift = dryFrom; }
    wasWet = wet;
    if (ap.phase === 'CLIMB') break;
  }
  R.noseOver = R.tNose30 != null && (R.tSwing30 == null || R.tNose30 <= R.tSwing30 + 0.05);
  R.yawLoop = R.tSwing30 != null && !R.noseOver;
  R.ok = R.finite && R.lift != null && R.swing < 30 && R.x < 30;
  // THE HUMP: the floats' water resistance at its maximum, 0.5 s centred means, inside the tank floats' hump band
  // (C_V = V / sqrt(g B) up to 4: GATE HYDRODYN's 2-4.5, tank floats 2.5-3.5; past it a porpoise's drag spikes on the
  // step read as a "hump" at C_V 7.5 on the Cessna). Its keel trim there; the lowest keel trim on the run (from
  // 1 m/s); the highest before the hump
  const n = run.length, h = 15, sm = (j, c) => { let a = 0, m = 0; for (let i = Math.max(0, j - h); i <= Math.min(n - 1, j + h); i++) { a += run[i][c]; m++; } return a / m; };
  const Vcv = Math.sqrt(G * P.B);
  let ih = -1, best = -1;
  for (let j = 0; j < n; j++) if (run[j][1] <= 4 * Vcv) { const r = sm(j, 2); if (r > best) { best = r; ih = j; } }
  if (ih >= 0) {
    R.hump = { V: run[ih][1], Cv: run[ih][1] / Math.sqrt(G * P.B), FnL: run[ih][1] / Math.sqrt(G * P.L), RW: best, trim: sm(ih, 3), pitch: sm(ih, 4), t: run[ih][0] };
    let lo = Infinity, hi = -Infinity, loV = 0;
    for (let j = 0; j < n; j++) if (run[j][1] >= 1) { const k = sm(j, 3); if (k < lo) { lo = k; loV = run[j][1]; } if (j <= ih && k > hi) hi = k; }
    R.trimLow = lo; R.trimLowV = loV; R.trimHiPre = hi;
    // the plough-to-hump window's highest trim (C_V 1.5-4)
    let hw = -Infinity; for (let j = 0; j < n; j++) if (run[j][1] >= 1.5 * Vcv && run[j][1] <= 4 * Vcv) hw = Math.max(hw, sm(j, 3));
    R.trimHumpMax = hw;
    R.waveMax = run.reduce((m, x) => Math.max(m, x[6]), 0);
  }
  R.curve = run.filter((x, i) => i % 6 === 0).map(x => x.map(y => +y.toFixed(3)));
  return R;
}

// ---- LAW: the plough wave on the rigid bench (forced on) ------------------------------------------------------------
function law(key) {
  const def = defOf(key, 'base'), P = def.parts.floats[0].P;
  const R = { key, checks: [], curve: [], P: { L: P.L, B: P.B, kWave: P.kWave } };
  const chk = (ok, line) => R.checks.push({ ok, line });
  chk(H.DEF ? H.DEF.kWave === 0 : true, `the shipped default: DEF.kWave ${H.DEF ? H.DEF.kWave : '(not exported)'} (0: OFF)`);
  chk(!(P.kWave > 0), `the generator's float carries kWave ${P.kWave} (OFF)`);
  const Fon = H.makeFloat(Object.assign({}, P, { kWave: 1 })), Foff = H.makeFloat(Object.assign({}, P, { kWave: 0 }));
  // the pose: the keel 4 deg nose-up, the step keel at the float's share of the aeroplane's weight at rest
  const Wh = def.params.gen.mass * G / 2;
  const at = (F, U, keelY, trim) => { const S = H.makeBody(F, { trim, keelY }), o = H.makeScratch(F); S.v[0] = -U; H.hydroForces(F, S, H.stillWater, o); return o; };
  let lo = -1, hi = 0.5;
  for (let it = 0; it < 50; it++) { const m = 0.5 * (lo + hi); if (at(Foff, 0, m, 4).F[1] > Wh) lo = m; else hi = m; }
  const ky = 0.5 * (lo + hi);
  R.pose = { keelY: ky, trim: 4 };
  const same = (a, b) => a.F.every((x, i) => x === b.F[i]) && a.tau.every((x, i) => x === b.tau[i]);
  const r0 = at(Fon, 0, ky, 4), r0off = at(Foff, 0, ky, 4);
  chk(r0.wave.a === 0 && same(r0, r0off), `at rest (U 0): amplitude ${r0.wave.a} m, the forces bit-identical to the wave off: ${same(r0, r0off)}`);
  const dry = at(Fon, 3, 1, 4);
  chk(dry.wave.a === 0 && dry.F[1] === 0, `a metre over the water at 3 m/s: amplitude ${dry.wave.a} m, ${dry.F[1]} N`);
  // the sweep in U: amplitude, the wave's own vertical force and pitching moment (on minus off), Fn on the wetted keel
  const Uon = Math.sqrt(G * P.L);
  for (let k = 0; k <= 48; k++) {
    const U = k * 0.03 * Uon;
    const a = at(Fon, U, ky, 4), b = at(Foff, U, ky, 4);
    R.curve.push({ U: +U.toFixed(3), Fn: +a.wave.Fn.toFixed(3), a: +a.wave.a.toFixed(4), env: +a.wave.env.toFixed(3), tanE: +a.wave.tanE.toFixed(3),
                   dFy: +(a.F[1] - b.F[1]).toFixed(2), dM: +(a.tau[2] - b.tau[2]).toFixed(2), vent: +b.vent.toFixed(3) });
  }
  const pk = R.curve.reduce((m, x) => x.a > m.a ? x : m, R.curve[0]);
  R.peak = pk;
  chk(pk.Fn >= P.waveFn0 - 1e-9 && pk.Fn <= P.waveFn0 + 0.3 && pk.a > 0, `the amplitude peaks at Fn ${pk.Fn} (${pk.a} m at ${pk.U} m/s): inside ${P.waveFn0 ?? H.DEF.waveFn0}..${((P.waveFn0 ?? 0.5) + 0.3).toFixed(1)}`);
  const step = R.curve.filter(x => x.Fn >= (P.waveFn1 ?? 1));
  chk(step.length > 0 && step.every(x => x.a === 0 && x.dFy === 0 && x.dM === 0), `on the step (Fn >= ${(P.waveFn1 ?? 1)}: ${step.length} speeds) the wave is 0 m, 0 N, 0 N m`);
  const disp = R.curve.filter(x => x.U > 0 && x.Fn < (P.waveFn0 ?? 0.5));
  chk(disp.every(x => x.a > 0), `in the displacement regime (0 < Fn < ${(P.waveFn0 ?? 0.5)}) the amplitude is positive at every speed (${disp.length})`);
  return R;
}

// ---- child mode ----------------------------------------------------------------------------------------------------
const CHILD = arg('child', null);
if (CHILD) {
  const [what, key, a1, a2] = CHILD.split(':');
  const r = what === 'law' ? law(key) : takeoff(key, a2 || 'base', +a1, ARGS.includes('--trace'));
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
      cp.execFile(process.execPath, [__filename, '--child=' + jobs[i].id].concat(jobs[i].trace ? ['--trace'] : []), { maxBuffer: 64 << 20 }, (err, so, se) => {
        const line = (so || '').split('\n').find(l => l.startsWith('RESULT '));
        out[i] = line ? JSON.parse(line.slice(7)) : { error: (se || String(err)).slice(-400), job: jobs[i].id };
        if (++done === jobs.length) resolve(out); else run();
      });
    };
    for (let k = 0; k < Math.min(n, jobs.length); k++) run();
  });
}

(async () => {
  const ONLY = arg('only', 'law,hump,sweep').split(',');
  const WINDS = arg('winds', '0,0.5,1,1.5,2,2.5,3,3.5,4,4.5,5').split(',').map(Number);
  const EVID = arg('evidence', null);
  const NPROC = Math.max(1, Math.min(+arg('procs', os.cpus().length), 8));
  let fails = 0;
  const verdict = (ok, line) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + line); };
  const jobs = [];
  if (ONLY.includes('law')) for (const k of Object.keys(BUILDS)) jobs.push({ id: `law:${k}` });
  // the calm take-offs: base, the wave on (both); the instrument (the twin) - the sweep's 0 m/s rows are these
  const MODES = { twin: ['base', 'thrustcg', 'wave'], cessna: ['base', 'wave'] };
  if (ONLY.includes('hump') || ONLY.includes('sweep')) for (const k of Object.keys(BUILDS)) for (const m of MODES[k]) jobs.push({ id: `to:${k}:0:${m}`, trace: true });
  if (ONLY.includes('sweep')) for (const k of Object.keys(BUILDS)) for (const m of MODES[k].filter(m => m !== 'wave')) for (const w of WINDS) if (w !== 0) jobs.push({ id: `to:${k}:${w}:${m}`, trace: [2, 4, 5].includes(w) });
  const t0 = Date.now();
  const out = await pool(jobs, NPROC);
  for (const b of out.filter(r => r.error)) verdict(false, `child ${b.job} failed: ${b.error}`);
  const ok = out.filter(r => !r.error), res = {};
  const runOf = (k, m, w) => ok.find(r => r.key === k && r.mode === m && r.wind === w);

  if (ONLY.includes('law')) {
    console.log('LAW (the plough wave G1807 on the rigid bench, FORCED ON: each build\'s float, the keel 4 deg nose-up at its share of the weight)');
    res.law = ok.filter(r => r.checks);
    for (const r of res.law) {
      console.log(`   ${BUILDS[r.key]}: float L ${r.P.L.toFixed(2)} m, B ${r.P.B.toFixed(2)} m; Fn | U m/s | amplitude m | env | tan(alpha_E) | the wave's lift N | its pitching moment N m (+ nose-down)`);
      for (const x of r.curve.filter((x, i) => i % 4 === 0)) console.log(`     ${x.Fn.toFixed(2).padStart(5)} | ${x.U.toFixed(2).padStart(5)} | ${x.a.toFixed(3)} | ${x.env.toFixed(2)} | ${x.tanE.toFixed(2)} | ${x.dFy.toFixed(0).padStart(6)} | ${x.dM.toFixed(0).padStart(6)}`);
      for (const c of r.checks) verdict(c.ok, `${BUILDS[r.key]} ${c.line}`);
    }
  }
  const humpLine = r => r && r.hump ? `hump at ${r.hump.V.toFixed(1)} m/s (C_V ${r.hump.Cv.toFixed(2)}, Fn_L ${r.hump.FnL.toFixed(2)}, R/W ${r.hump.RW.toFixed(3)}): keel trim ${r.hump.trim.toFixed(1)} deg (pitch ${r.hump.pitch.toFixed(1)}); lowest keel trim on the run ${r.trimLow.toFixed(1)} deg at ${r.trimLowV.toFixed(1)} m/s; highest before the hump ${r.trimHiPre.toFixed(1)}, over C_V 1.5-4 ${r.trimHumpMax.toFixed(1)}; lift-off ${r.lift == null ? '-' : r.lift.toFixed(1) + ' s'}${r.noseOver ? ' - NOSE-OVER (pitch ' + r.pitchMin.toFixed(0) + ')' : ''}` : '(no run)';
  if (ONLY.includes('hump')) {
    console.log(`\nHUMP (the calm take-off, THE PILOT, the SEA lane; the band ${BAND[0]}-${BAND[1]} deg nose-up at the hump)`);
    res.hump = {};
    for (const k of Object.keys(BUILDS)) for (const m of MODES[k]) { const r = runOf(k, m, 0); res.hump[`${k}:${m}`] = r && { hump: r.hump, trimHumpMax: r.trimHumpMax, trimLow: r.trimLow, trimLowV: r.trimLowV, trimHiPre: r.trimHiPre, lift: r.lift, noseOver: r.noseOver, pitchMin: r.pitchMin, waveMax: r.waveMax, curve: r.curve }; console.log(`   ${BUILDS[k]} ${m === 'base' ? '(as built)' : m === 'thrustcg' ? '(INSTRUMENT: thrust at the nose frame, 0.17 m over the CG)' : '(the plough wave ON, kWave 1)'}: ${humpLine(r)}`); }
    const cb = runOf('cessna', 'base', 0), tb = runOf('twin', 'base', 0), ti = runOf('twin', 'thrustcg', 0), tw = runOf('twin', 'wave', 0);
    verdict(cb && cb.hump && cb.hump.trim >= BAND[0] && cb.hump.trim <= BAND[1], `${BUILDS.cessna}: keel trim at the hump ${cb && cb.hump ? cb.hump.trim.toFixed(1) : '-'} deg inside ${BAND[0]}-${BAND[1]}`);
    verdict(cb && cb.trimLow > 0, `${BUILDS.cessna}: never nose-down on the run (lowest keel trim ${cb ? cb.trimLow.toFixed(1) : '-'} deg)`);
    // THE ATTRIBUTION: the twin's floats trim it nose-up through the plough once its thrust couple is taken out
    verdict(ti && ti.trimLow > 0 && ti.hump && ti.hump.trim > 0 && !ti.noseOver, `${BUILDS.twin} with the thrust at the nose frame (INSTRUMENT): lowest keel trim ${ti ? ti.trimLow.toFixed(1) : '-'} deg (> 0), at the hump ${ti && ti.hump ? ti.hump.trim.toFixed(1) : '-'} deg: the base's hydro carries the plough's bow-up trim`);
    if (tb && tb.hump) console.log(`${tb.hump.trim >= BAND[0] && tb.hump.trim <= BAND[1] && tb.trimLow > 0 ? 'NOTE' : 'OWED'} ${BUILDS.twin} (as built): keel trim at the hump ${tb.hump.trim.toFixed(1)} deg, lowest ${tb.trimLow.toFixed(1)} deg at ${tb.trimLowV.toFixed(1)} m/s - its thrust couple (0.57 m over the CG) and the water drag (1.5 m under it) beat the floats' nose-down restoring once the afterbody unwets (HANDOVER G1807-G1809, open question 1)`);
    if (tw) console.log(`${tw.noseOver ? 'NOTE' : 'NOTE'} ${BUILDS.twin} with the plough wave ON: ${tw.noseOver ? 'NOSES OVER in calm air (pitch ' + tw.pitchMin.toFixed(0) + ' deg)' : 'lowest keel trim ' + tw.trimLow.toFixed(1) + ' deg'} - the wave's crest on the narrow bow, its trough on the wide forebody ahead of the CG: why it ships OFF`);
  }
  if (ONLY.includes('sweep')) {
    console.log('\nSWEEP (GATE SEAPLANE\'s crosswind take-off, THE PILOT, the SEA lane; swing from the roll\'s own heading)');
    res.sweep = ok.filter(r => r.wind != null && r.mode && r.mode !== 'wave').map(r => ({ key: r.key, mode: r.mode, wind: r.wind, lift: r.lift, swing: r.swing, x: r.x, pitchMin: r.pitchMin, skips: r.skips, ok: r.ok, noseOver: r.noseOver, yawLoop: r.yawLoop, hump: r.hump, trimLow: r.trimLow, tr: r.tr }));
    for (const k of Object.keys(BUILDS)) for (const m of MODES[k].filter(m => m !== 'wave')) {
      const rows = res.sweep.filter(r => r.key === k && r.mode === m).sort((a, b) => a.wind - b.wind);
      console.log(`   ${BUILDS[k]}${m === 'thrustcg' ? ' (INSTRUMENT: thrust at the nose frame)' : ''}:  wind | lift-off s | swing deg | |x| m | lowest pitch deg | lowest keel trim deg | skips | class`);
      for (const r of rows) console.log(`     ${r.wind.toFixed(1).padStart(4)} | ${r.lift == null ? '   -  ' : r.lift.toFixed(1).padStart(6)} | ${r.swing.toFixed(1).padStart(6)} | ${r.x.toFixed(1).padStart(6)} | ${r.pitchMin.toFixed(1).padStart(6)} | ${r.trimLow == null ? '  -  ' : r.trimLow.toFixed(1).padStart(6)} | ${r.skips} | ${r.ok ? 'ok' : r.noseOver ? 'NOSE-OVER at the plough' : r.yawLoop ? 'YAW WATER LOOP' : 'FAIL'}`);
      const nose = rows.filter(r => r.noseOver), yaw = rows.filter(r => r.yawLoop);
      if (k === 'cessna') verdict(rows.every(r => r.ok), `${BUILDS[k]}: every take-off off the water, no nose-over, swing and lane under 30 (worst ${Math.max(...rows.map(r => r.swing)).toFixed(1)} deg, ${Math.max(...rows.map(r => r.x)).toFixed(1)} m)`);
      else if (m === 'base') {
        verdict(rows.filter(r => r.wind <= 1.5).every(r => r.ok), `${BUILDS[k]}: 0-1.5 m/s across clean (DMG-HULL's clean band)`);
        if (nose.length) console.log(`OWED ${BUILDS[k]}: NOSE-OVER at the plough at ${nose.map(r => r.wind).join(', ')} m/s across (HANDOVER G1807-G1809, open question 1: the thrust couple, not a missing wave)`);
        if (yaw.length) console.log(`OWED ${BUILDS[k]}: YAW swing past 30 deg at ${yaw.map(r => r.wind + ' m/s (' + r.swing.toFixed(1) + ' deg)').join(', ')} (HANDOVER G1847-G1849, open question 2)`);
      } else {
        console.log(`NOTE ${BUILDS[k]} with the thrust at the nose frame: ${nose.length ? 'nose-over at ' + nose.map(r => r.wind).join(', ') + ' m/s' : 'no nose-over at any wind'}${yaw.length ? '; yaw swing past 30 deg at ' + yaw.map(r => r.wind + ' m/s (' + r.swing.toFixed(1) + ')').join(', ') : '; no yaw loop'}`);
      }
    }
  }
  console.log(`\n(${jobs.length} runs in ${((Date.now() - t0) / 1000).toFixed(0)} s on ${NPROC} processes)`);
  if (EVID) { fs.mkdirSync(EVID, { recursive: true }); fs.writeFileSync(path.join(EVID, 'dmgplough.json'), JSON.stringify(res)); }
  if (ARGS.includes('--json')) console.log('JSON ' + JSON.stringify(res));
  console.log(fails ? `GATE DMGPLOUGH: FAIL (${fails})` : 'GATE DMGPLOUGH: PASS');
  process.exit(fails ? 1 : 0);
})();
