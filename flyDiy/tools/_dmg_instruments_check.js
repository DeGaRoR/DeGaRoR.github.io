#!/usr/bin/env node
// GATE DMGINST (G1800-G1804, DMG-D0 INSTRUMENTS; DEFORM-AND-BREAK §5.2, §5.4, §10.1) - the damage layer's instruments,
// node only, on the user's validated builds (the Cub builds/cub_2026-09-20_corrected.json, the Jodel, the metal Cessna,
// the Cessna on floats, the twin on floats), the damage layer ON where it is read (params.damage: true):
//   1. G1800 SIM-DIVERGED vs BROKE-UP (ruling dm4): the NaN ending is 'sim-diverged' everywhere it is written (the page's
//      watchdog, the load test's 'SIM DIVERGED', the bench card, the crosswind probe, the rigs); 'broke-up' is written by
//      nothing (the structure's, DMG-D1b's to fire); the load test's 'BROKE UP' only on the damage layer's breaks (G1832). The load test with a NaN thrown into it says SIM DIVERGED and the
//      bench card names the numbers, not a member.
//   2. G1801 THE VELOCITY GUARD: a lattice past its integrator's limit (k x 5) rings at ~1 km/s and stays FINITE - the old
//      NaN watchdog never sees it - and trips the guard as 'speed' the first frame; a 1e300 kick trips it the first frame;
//      the whole aeroplane at 200 m/s true (20 km up) does not (relative to the CG);
//      stats().bad and the worker host's diverged() read it; reset() clears it. THE CENSUS: the fastest node off the CG
//      in what the validated builds fly (a flown 3.8 g pull and a 10 ft/s drop on all five, the Cub's circuit, the 30 m/s
//      trunk crashes, the severe water nose-ins) - never near 150.
//   3. G1802 THE PER-BEAM PLASTIC WORK (DMG.wB): sums to DMG.work, is non-negative, is non-zero only on a member that
//      yielded or bent, is zeroed by reset(); summed by section (the bill's input).
//   4. G1803 THE SECTION: every beam of the five builds carries bm.sec, one of its ledger's sections (the def's and the
//      solver's copy); the class x section table.
//   5. G1804 THE DAMAGE VIEW'S COLOURS (src/viewer/dmg_overlay.js, pure): the legend, the precedence (broken > set >
//      stress > calm), the ramps' ends, the live ratio against the solver's own limits on a real crash's beams, every
//      member calm with the layer off; app.js reads it only behind its debug switch.
// Run: node tools/_dmg_instruments_check.js [--out <dir>]   (one final `GATE DMGINST: PASS|FAIL`)
'use strict';
const path = require('path'), fs = require('fs');
const argv = process.argv.slice(2);
const L = require('./_treecrash_lib.js');
const ROOT = path.join(__dirname, '..');
const C = L.core();
const T = require(path.join(ROOT, 'src', 'viewer', 'dmg_overlay.js'));
let checks = 0, fails = 0;
const yes = (ok, msg) => { checks++; if (!ok) fails++; console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + msg); };
const f2 = x => (x == null ? '-' : (+x).toFixed(2));
const src = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const OUT = (() => { const i = argv.indexOf('--out'); return i >= 0 ? argv[i + 1] : null; })();
const evidence = {};

// every sim the lib makes, kept (its scenarios return numbers, not the sim): the guard's census reads them after
const made = [];
{ const mk = C.makeSim; C.makeSim = function () { const s = mk.apply(this, arguments); made.push(s); return s; }; }
const peakOfMade = from => made.slice(from).reduce((m, s) => Math.max(m, s.guard ? s.guard().peak : 0), 0);
const faultOfMade = from => made.slice(from).map(s => s.fault && s.fault()).find(Boolean) || null;

// ---------------------------------------------------------------------------------------------------------------------
console.log('1. G1800: sim-diverged (the numbers) vs broke-up (the structure)');
{
  const app = src('src/viewer/app.js'), lt = src('src/core/65_gen_loadtest.js'), bench = src('src/viewer/bench.js'), xw = src('src/core/42_crosswind.js');
  // G1898.3: 'broke-up' is now written - by the structure only (DMG-D1b's refs-core, DMG.brokeUp), never by the watchdog
  yes(/endFlight\('sim-diverged'\)/.test(app) && !/endFlight\('broke-up'\)/.test(app) && /endFlight\(up \? 'broke-up' : 'crashed'\)/.test(app)
      && /up = !!\(D && D\.brokeUp\)/.test(app) && /'SIM DIVERGED — RESET'/.test(app),
    'the page\'s watchdog ends a NaN / guarded flight \'sim-diverged\' (the message "SIM DIVERGED — RESET" stays); \'broke-up\' only when the structure\'s refs part (DMG.brokeUp)');
  // G1832 (DMG-D2a): the test to destruction writes 'BROKE UP' - the structure's, from the damage layer's own breaks only
  const ltCode = lt.replace(/\/\/.*$/gm, ''), brokeUp = (ltCode.match(/'BROKE UP'/g) || []).length;
  yes(/bad \? 'SIM DIVERGED'/.test(lt) && brokeUp === (ltCode.match(/sim\.damage\(\)\.breaks\) \? 'BROKE UP'/g) || []).length,
    'the load test\'s NaN verdict is \'SIM DIVERGED\' (65_gen_loadtest.js); \'BROKE UP\' only on the damage layer\'s breaks (' + brokeUp + ')');
  yes(/why: 'sim-diverged'/.test(xw) && !/'broke-up'/.test(xw.replace(/\/\/.*$/gm, '')), 'the crosswind probe\'s NaN ending is \'sim-diverged\' (42_crosswind.js)');
  const writers = [];
  for (const f of ['src/viewer/app.js', 'src/viewer/bench.js', 'src/viewer/sim_host.js', 'src/viewer/sim_link.js', 'src/core/42_crosswind.js', 'src/core/43_pilot.js', 'src/core/65_gen_loadtest.js',
                   'tools/_bench_check.js', 'tools/pilot_trace.js', 'tools/arch_fly.js', 'tools/_simworker_edges_check.js'])
    for (const ln of src(f).split('\n')) {
      const code = ln.replace(/\/\/.*$/, '');
      // G1898.3: the one writer allowed is the structure's ending (DMG-D1b's refs-core, read off DMG.brokeUp)
      if (/['"]broke-up['"]/.test(code) && !(f === 'src/viewer/app.js' && /endFlight\(up \? 'broke-up' : 'crashed'\)/.test(code))) writers.push(f);
    }
  yes(writers.length === 0, 'no code writes \'broke-up\' but the structure\'s ending (DMG.brokeUp): ' + (writers.length ? writers.join(', ') : 'none of the 11 readers / writers'));
  // the rig: the Cub's load test, a NaN thrown in mid-ramp
  const def = L.defOf('cub'), spec = def.spec, sim = C.makeSim(def, null); sim.reset(0);
  const rig = C.makeLoadTest(sim, def, { material: spec.fuselage && spec.fuselage.material, wingMaterial: C.genSurfKey ? C.genSurfKey(spec, 'wing', 0) : undefined, surface: 'wing', limit: C.GEN_LOAD_LIMIT, ult: C.GEN_LOAD_ULT });
  for (let f = 0; f < 60 * 6 && !rig.state.done; f++) { rig.step(1 / 60); if (f === 300) sim.impulse(5, 0, 1e300, 0); }
  yes(rig.state.done && rig.state.verdict === 'SIM DIVERGED', 'the Cub\'s load test with a 1e300 kick in its ramp: \'' + rig.state.verdict + '\'');
  const B = require(path.join(ROOT, 'src', 'viewer', 'bench.js')), LT = B.BENCH_TESTS.find(t => t.id === 'load');
  const card = LT.poll({ loadTestState: () => Object.assign({}, rig.state, { nTarget: 5.7 }) });
  yes(card.done && card.verdict === 'SIM DIVERGED' && !card.ok && /diverged/.test(card.why) && !/member let go/.test(card.why), 'the bench card: ' + card.verdict + ' - "' + card.why + '"');
  const card2 = LT.poll({ loadTestState: () => ({ done: true, verdict: 'BROKE UP', ultPct: 3, ultYield: 120, limitPct: 1, nTarget: 5.7, phase: 'done' }) });
  yes(card2.verdict === 'BROKE UP' && /member let go/.test(card2.why), 'a BROKE UP (the structure, D1b / D2) still reads as a member that let go: "' + card2.why + '"');
}

// ---------------------------------------------------------------------------------------------------------------------
console.log('2. G1801: the velocity guard (150 m/s off the CG)');
{
  const air = () => { const def = L.defOf('cub'), { W, strip } = L.flatWorld(0), sim = C.makeSim(def, W); sim.reset(0);
    C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0, spawnElev: 300 })); return { sim, strip, W }; };
  const finiteAll = sim => { for (let i = 0; i < sim.p.length; i++) if (!Number.isFinite(sim.p[i]) || !Number.isFinite(sim.v[i])) return false; return true; };
  // A LATTICE PAST ITS INTEGRATOR'S LIMIT (every k x 5 in flight): the nodes ring at ~1 km/s and stay FINITE - the old NaN
  // watchdog never fires on it; the guard does, the first frame
  {
    const { sim } = air(); sim.step(1 / 60);
    const g0 = sim.guard().vMax;
    for (const b of sim.beams) b.k *= 5;
    let fr = null, nan = null;
    for (let f = 0; f < 600; f++) { sim.step(1 / 60); if (fr === null && sim.fault()) fr = { f, F: sim.fault(), fin: finiteAll(sim), bad: sim.stats().bad }; if (!finiteAll(sim)) { nan = f; break; } }
    const F = fr && fr.F;
    yes(!!F && F.why === 'speed' && F.v > 150 && fr.f === 0 && fr.fin && fr.bad, 'every k x 5 in flight (past the integrator\'s limit): tripped at frame ' + (fr && fr.f) + ' as \'' + (F && F.why) + '\' (node ' + (F && F.node) + ' at ' + f2(F && F.v) + ' m/s off the CG), every number finite, stats().bad; '
      + (nan === null ? 'it never went NaN in 600 frames - the old watchdog would have flown it on' : 'NaN at frame ' + nan) + ' (at rest the fastest node read ' + f2(g0) + ' m/s)');
    sim.reset(0);
    yes(sim.fault() === null && sim.guard().peak === 0 && !sim.stats().bad, 'reset() clears it');
  }
  {
    // G1898.2: with the layer OFF the speed fault does not end a flight (off = master's game); the peak is still measured
    const def = L.defOf('cub', { elastic: true }), { W, strip } = L.flatWorld(0), sim = C.makeSim(def, W); sim.reset(0);
    C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0, spawnElev: 300 })); sim.step(1 / 60);
    for (const b of sim.beams) b.k *= 5;
    for (let f = 0; f < 30; f++) sim.step(1 / 60);
    yes(sim.fault() === null && sim.guard().peak === 0, 'damage OFF, every k x 5: no speed fault, the guard not run (G1898.10: the layer off runs the master path)');
  }
  {
    const { sim } = air(); sim.step(1 / 60); sim.impulse(0, 0, 1e300, 0); sim.step(1 / 60);
    const F = sim.fault();
    yes(!!F && sim.stats().bad, 'a 1e300 kick (GATE SIMWORKER-EDGES\' divergence): tripped the first frame (\'' + (F && F.why) + '\')');
  }
  {
    // relative to the CG: 200 m/s true at 20 km (the Cub's own equivalent airspeed there, ~27 m/s) - the whole aeroplane fast, no node off it
    const def = L.defOf('cub'), { W, strip } = L.flatWorld(0), sim = C.makeSim(def, W); sim.reset(0);
    C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0, spawnElev: 20000 }));
    const fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg);
    for (let i = 0; i < sim.n; i++) { sim.v[i*3] = 200 * fx; sim.v[i*3+2] = 200 * fz; }
    for (let f = 0; f < 60; f++) sim.step(1 / 60);
    yes(sim.fault() === null && sim.out.V > 150, 'the whole aeroplane at ' + f2(sim.out.V) + ' m/s (200 m/s true at 20 km): not tripped - the fastest node ' + f2(sim.guard().peak) + ' m/s off the CG');
  }
  {
    // the worker host reads it (H.diverged -> the snapshot's F_DIVERGED, the page's sw.diverged)
    const SH = require(path.join(ROOT, 'src', 'viewer', 'sim_host.js')), def = L.defOf('cub');
    const { sim, W } = air();
    const H = SH.makeSimHost(C, { keepSim: { def, sim }, day: false, world: {} }, W);   // (its fresh() resets and places the sim: re-placed in the air here)
    sim.reset(0); C.placeAtAerodrome(sim, Object.assign({}, L.flatWorld(0).strip, { elev: 0, spawnElev: 300 }));
    sim.step(1 / 60); const d0 = H.diverged();
    for (const b of sim.beams) b.k *= 5;
    sim.step(1 / 60);
    yes(!d0 && H.diverged() && Number.isFinite(sim.p[1]), 'the worker host\'s diverged() (its snapshot\'s F_DIVERGED, the page\'s sw.diverged): false, then true on the blown lattice with p still finite');
  }
  // THE CENSUS, on what the validated builds fly
  const rows = [];
  const census = (lab, fn) => { const k0 = made.length; const r = fn(); rows.push({ lab, v: peakOfMade(k0), fault: faultOfMade(k0), r }); };
  for (const k of Object.keys(L.BUILDS)) {
    const Vs = L.defOf(k).params.gen.Vs;
    census(L.BUILDS[k].label + ': a flown 3.8 g pull', () => L.pull(k, { V: 2.6 * Vs, sgn: 1 }));
    census(L.BUILDS[k].label + ': a 10 ft/s drop', () => L.hardLanding(k, { sink: 0.3048 * 10 }));
  }
  census('the Cub: a circuit with the pilot', () => L.circuit('cub', {}));
  census('the Cub: 30 m/s into a trunk (crash)', () => L.atTrunk('cub', { D: 40, agl: 4, V: 30, thr: 0, secs: 5 }));
  census('the metal Cessna: 30 m/s into a trunk (crash)', () => L.atTrunk('metal', { D: 40, agl: 4, V: 30, thr: 0, secs: 5 }));
  census('the Cub: 30 m/s, the wing 2.5 m out (crash)', () => L.atTrunk('cub', { D: 40, agl: 4, V: 30, thr: 0, secs: 5, off: 2.5 }));
  if (C.HYDRO && typeof C.HYDRO.wetBuild === 'function') census('the Cub: SEVERE 180 km/h, 10 m/s, 60 deg into the water', () => L.waterCase('cub', { V: 180 / 3.6, sink: 10, pitch: 60, secs: 4 }));
  census('the twin: SEVERE 150 km/h, 10 m/s, 60 deg float nose-in', () => L.waterCase('twinFloats', { V: 150 / 3.6, sink: 10, pitch: 60, secs: 4 }));
  for (const r of rows) console.log('        ' + r.lab + ': the fastest node ' + f2(r.v) + ' m/s off the CG' + (r.fault ? ' - TRIPPED (' + r.fault.why + ')' : ''));
  const worst = rows.reduce((a, b) => (b.v > a.v ? b : a), rows[0]);
  yes(rows.every(r => !r.fault) && worst.v < 0.75 * 150, 'the census: ' + rows.length + ' runs, never tripped; the worst ' + f2(worst.v) + ' m/s (' + worst.lab + '), under 3/4 of the guard');
  evidence.guard = rows.map(r => ({ run: r.lab, vMax: r.v, tripped: !!r.fault }));
}

// ---------------------------------------------------------------------------------------------------------------------
console.log('3. G1802: the plastic work per beam');
let crashSim = null;
{
  const r = L.atTrunk('cub', { D: 40, agl: 4, V: 30, thr: 0, secs: 5 }), sim = r.sim, D = sim.damage();
  crashSim = r;
  let sum = 0, neg = 0, stray = 0, nz = 0;
  const bySec = {};
  for (let i = 0; i < D.wB.length; i++) { const w = D.wB[i]; sum += w; if (w < 0) neg++; if (w > 0) { nz++; if (!sim.beams[i].yielded) stray++; bySec[sim.beams[i].sec] = (bySec[sim.beams[i].sec] || 0) + w; } }
  yes(D.wB instanceof Float64Array && D.wB.length === sim.beams.length, 'DMG.wB: a Float64Array, one per beam (' + D.wB.length + '), on sim.damage()');
  yes(Math.abs(sum - D.work) <= 1e-9 * D.work && D.work > 1000, 'the Cub at 30 m/s into a trunk: the beams\' work sums to the total (' + sum.toFixed(3) + ' J against ' + D.work.toFixed(3) + ' J)');
  yes(neg === 0 && stray === 0, nz + ' beams carry work, every one of them yielded or bent; none negative');
  console.log('        by section: ' + Object.entries(bySec).sort((a, b) => b[1] - a[1]).map(([s, w]) => s + ' ' + (w / 1000).toFixed(1) + ' kJ').join(', '));
  evidence.workBySection = bySec;
  const q = L.atTrunk('metal', { D: 40, agl: 4, V: 30, thr: 0, secs: 5 }), Dq = q.sim.damage();
  let sq = 0; for (const w of Dq.wB) sq += w;
  yes(Math.abs(sq - Dq.work) <= 1e-9 * Dq.work, 'the metal Cessna\'s: ' + sq.toFixed(3) + ' J against ' + Dq.work.toFixed(3) + ' J');
  // reset zeroes it (a fresh sim's state after a crash: TREECRASH section 5 proves the bits)
  const r2 = L.atTrunk('cub', { D: 40, agl: 4, V: 30, thr: 0, secs: 3, then: { D: 4, V: 3, thr: 0, secs: 0.05 } }), D2 = r2.sim.damage();
  yes(r2.crashedBefore && D2.wB.every(w => w === 0) && D2.work === 0, 'reset() after a crash zeroes every beam\'s work');
}

// ---------------------------------------------------------------------------------------------------------------------
console.log('4. G1803: every beam carries its ledger section');
{
  const tab = {};
  for (const k of Object.keys(L.BUILDS)) {
    const def = L.defOf(k), led = (def.parts && def.parts.ledger) || def.params.ledger || {}, secs = new Set(Object.keys(led));
    const miss = def.beams.filter(b => !b.sec).length, alien = def.beams.filter(b => b.sec && !secs.has(b.sec)).length;
    const sim = C.makeSim(def, null), simMiss = sim.beams.filter(b => !b.sec).length;
    const ct = {}; for (const b of def.beams) { const kk = b.cls + ' > ' + b.sec; ct[kk] = (ct[kk] || 0) + 1; }
    tab[k] = ct;
    yes(miss === 0 && alien === 0 && simMiss === 0, L.BUILDS[k].label + ': ' + def.beams.length + ' beams, every one stamped (the def\'s and the solver\'s copy), every section a ledger row: '
      + Object.entries(ct).map(([s, n]) => s + ' ' + n).join(', '));
  }
  evidence.sections = tab;
}

// ---------------------------------------------------------------------------------------------------------------------
console.log('5. G1804: the damage view\'s colours (src/viewer/dmg_overlay.js)');
{
  const c = (r, s, b) => { const o = []; const k = T.tint(o, 0, r, s, b); return { k, o }; };
  const eq = (a, b) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-12);
  yes(eq(c(0, 0, false).o, T.COL.N) && eq(c(T.R0, 0, false).o, T.COL.N) && c(0.2, 0, false).k === 'calm', 'calm: |F| / limit up to ' + T.R0 + ' draws the frame\'s neutral ' + JSON.stringify(T.COL.N));
  const r1 = c(1, 0, false), r2 = c(5, 0, false), rm = c(0.625, 0, false);
  yes(r1.k === 'stress' && eq(r1.o, T.COL.A) && eq(r2.o, T.COL.A) && rm.o.every((x, i) => (x - T.COL.N[i]) * (T.COL.A[i] - x) >= -1e-12), 'stress: ramps to amber ' + JSON.stringify(T.COL.A) + ' at the limit, held past it; between the ends in between');
  const st = c(0, T.SET_MIN, false), sc = c(0, -T.SET_FULL, false), sl = c(0, 0.5 * T.SET_MIN, false);
  yes(st.k === 'set' && sc.k === 'set' && eq(sc.o, T.COL.C) && eq(c(0, 0.1, false).o, T.COL.T) && sl.k === 'calm', 'set: from ' + (100 * T.SET_MIN).toFixed(2) + ' % (orange stretched, cyan crushed), full at ' + (100 * T.SET_FULL) + ' %; under it no set');
  yes(c(2, 0.05, true).k === 'broken' && eq(c(2, 0.05, true).o, T.COL.R) && c(2, 0.05, false).k === 'set' && c(2, 0, false).k === 'stress', 'the precedence: broken > set > stress > calm');
  // the live ratio against the solver's own limits, on the Cub's crash (the beams as the solver left them)
  const sim = crashSim.sim, D = sim.damage(), cnt = { calm: 0, stress: 0, set: 0, broken: 0 };
  let brokenOk = true, setOk = true;
  for (let i = 0; i < sim.beams.length; i++) {
    const b = sim.beams[i], a3 = b.a * 3, b3 = b.b * 3, Lb = Math.hypot(sim.p[b3] - sim.p[a3], sim.p[b3+1] - sim.p[a3+1], sim.p[b3+2] - sim.p[a3+2]);
    const k = T.kind(T.ratioOf(b, Lb), T.setOf(b), !!b.broken); cnt[k]++;
    if (b.broken !== (k === 'broken')) brokenOk = false;
    if (!b.broken && b.yielded && Math.abs(T.setOf(b)) >= T.SET_MIN && k !== 'set') setOk = false;
  }
  yes(brokenOk && setOk && cnt.broken === D.broken.length, 'the Cub\'s 30 m/s crash drawn: ' + JSON.stringify(cnt) + ' - every broken member red, every set member orange / cyan');
  // a member at its yield reads 1: the live ratio is the solver's own comparison (FY / FC)
  const b0 = sim.beams.find(b => !b.broken && !b.tens && b.fyM > 0 && Number.isFinite(b.fyM) && !(b.dk > 0));
  const atY = T.ratioOf(b0, b0.L0 + b0.fyM / b0.k), atC = T.ratioOf(b0, b0.L0 - b0.fc0 / b0.k);
  yes(Math.abs(atY - 1) < 1e-9 && Math.abs(atC - 1) < 1e-9, 'a member stretched to its yield reads ' + atY.toFixed(6) + ', crushed to its crush load ' + atC.toFixed(6));
  // with the layer off every member is calm (no limits, no set)
  let offN = 0, offCalm = 0;
  for (const k of Object.keys(L.BUILDS)) {
    const def = L.defOf(k, { elastic: true }), s = C.makeSim(def, null); s.reset(0); s.step(1 / 60);
    for (const b of s.beams) { const a3 = b.a * 3, b3 = b.b * 3, Lb = Math.hypot(s.p[b3] - s.p[a3], s.p[b3+1] - s.p[a3+1], s.p[b3+2] - s.p[a3+2]); offN++; if (T.kind(T.ratioOf(b, Lb), T.setOf(b), !!b.broken) === 'calm') offCalm++; }
  }
  yes(offN > 0 && offCalm === offN, 'the layer off (params.damage false): all ' + offN + ' members of the five builds calm');
  // the probe: the peak is the colour's ratio
  const P = { t: new Float64Array([0.1, 0.9]), c: new Float64Array([0.95, 0.2]) };
  yes(T.ratioPeak(P, 0) === 0.95 && T.ratioPeak(P, 1) === 0.9, 'under the probe (sim.damagePeak()) the ratio is the member\'s peak, tension or compression');
  // the page: a debug switch, off by default; sync() colours by strain unless it is on
  const app = src('src/viewer/app.js'), bld = src('tools/build.js');
  yes(/let dmgView = \(\(\) => \{ try \{ return \/\[\?&\]dmgview=1/.test(app) && /if \(!\(dmgView && dmgSync\(b, i, o\)\)\) \{ sCol\(b\.strain, o\); sCol\(b\.strain, o \+ 3\); \}/.test(app) && /'dmg_overlay\.js',/.test(bld),
    'app.js: the view is off unless ?dmgview=1 or the overlays pill; off, sync() is the strain colouring; dmg_overlay.js is in the page (build.js) before app.js');
  console.log('        the legend:');
  for (const r of T.LEGEND) console.log('          ' + r.kind.padEnd(7) + r.at.padEnd(22) + ' rgb ' + r.rgb.map(x => x.toFixed(3)).join(' ') + '  #' + r.rgb.map(x => Math.round(255 * x).toString(16).padStart(2, '0')).join(''));
  evidence.legend = T.LEGEND.map(r => ({ kind: r.kind, at: r.at, rgb: r.rgb, hex: '#' + r.rgb.map(x => Math.round(255 * x).toString(16).padStart(2, '0')).join('') }));
  evidence.crashKinds = cnt;
  // the picture's data: the crash from above, each beam with its kind and colour
  const c0 = sim.cgPos();
  evidence.crashTop = sim.beams.map(b => { const a3 = b.a * 3, b3 = b.b * 3, Lb = Math.hypot(sim.p[b3] - sim.p[a3], sim.p[b3+1] - sim.p[a3+1], sim.p[b3+2] - sim.p[a3+2]); const o = []; const k = T.tint(o, 0, T.ratioOf(b, Lb), T.setOf(b), !!b.broken);
    return [+(sim.p[a3] - c0[0]).toFixed(3), +(sim.p[a3+2] - c0[2]).toFixed(3), +(sim.p[b3] - c0[0]).toFixed(3), +(sim.p[b3+2] - c0[2]).toFixed(3), k, o.map(x => +x.toFixed(3))]; });
}

if (OUT) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'dmginst.json'), JSON.stringify(evidence)); }
console.log('  ' + (checks - fails) + '/' + checks + ' checks');
console.log('GATE DMGINST: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
