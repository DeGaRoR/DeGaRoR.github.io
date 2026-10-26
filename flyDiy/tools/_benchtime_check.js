#!/usr/bin/env node
// _benchtime_check.js - GATE BENCHTIME (G3780 CERT-RULE + CERT-SLIM; the user 26 Oct: "No long tests that would need to
// re-run. Everything should be as fast as the bench check and the altitude check").
//   EVERY TEST IS COMPUTED: the bench's rows are instant or quick (bench.js: no 'live' kind, the crosswind ladder gone,
//           the test flight the first arrival's)
//   AS FAST  on the validated builds, as the game loads them, the three computations the bench runs - the bench check
//           (genShakedown with the loading corners + the design rows), the density altitude (genDensityAlt) and the
//           wing loading's rig unpaced (bench_worker benchLoadRun, the worker's 'loadq' loop) - each under its ceiling,
//           and the wing loading no slower than two bench checks (the hydroplane's water run is timed on the page)
//   node tools/_benchtime_check.js     -> "GATE BENCHTIME: PASS|FAIL"
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, FLY = path.join(T, '..');
const C = require(path.join(T, 'flight_core.js'));
const BE = require(path.join(FLY, 'src', 'viewer', 'bench.js'));
const BW = require(path.join(FLY, 'src', 'viewer', 'bench_worker.js'));
const LB = require(path.join(T, '_load_build.js'));
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) fails++; console.log((c ? '  ok     ' : '  FAIL   ') + m); return c; };
const now = () => Number(process.hrtime.bigint() / 1000000n);
// ms in node on the box (26 Oct: the bench check 1.9-3.5 s with its loading corners, the density altitude 10-90 ms, the
// wing loading computed 1.5-4.2 s): THE BENCH CHECK IS THE YARDSTICK - the wing loading no slower than two of it
const CEIL = { shake: 6000, dalt: 3000, load: 8000 };

console.log('EVERY TEST IS COMPUTED');
ok(!BE.BENCH_TESTS.some(t => t.kind === 'live'), 'no watched (live) test on the bench');
ok(!BE.BENCH_TESTS.some(t => t.id === 'xwind'), 'the crosswind ladder is gone (its number is the design check\'s rudder row)');
ok(BE.BENCH_TESTS.filter(t => t.kind === 'quick').map(t => t.id).sort().join() === 'hydro,load', 'the wing loading and the hydroplane are quick (computed off the page)');
ok(BE.BENCH_TESTS.filter(t => t.kind === 'flown').map(t => t.id).join() === 'flight', 'the only flown row is the test flight (awarded by the first arrival)');

console.log('AS FAST AS THE BENCH CHECK');
const BUILDS = ['builds/cub_2026-09-20_corrected.json', 'builds/jodel_2026-09-20_corrected.json', 'bugReports/cessnaMetal (1).json',
  'builds/rufus_2026-10-18_certified.json', 'builds/pa18_floats_2026-10-23.json'].filter(b => fs.existsSync(path.join(FLY, b)));
for (const b of BUILDS) {
  const nm = path.basename(b, '.json');
  const spec = LB.gameSpec(JSON.parse(fs.readFileSync(path.join(FLY, b), 'utf8')));
  const S = C.genMigrateSpec(JSON.parse(JSON.stringify(spec)));
  let t0 = now();
  const def = C.buildGen(JSON.parse(JSON.stringify(S)));
  const sh = C.genShakedown(def, { corners: true });
  const tShake = now() - t0;
  t0 = now();
  let da = null; try { da = C.genDensityAlt(def); } catch (e) { da = null; }
  const tDalt = now() - t0;
  t0 = now();
  const run = BW.benchLoadRun(C, { spec: JSON.parse(JSON.stringify(S)), cfg: {} });
  let k = 0; while (run.ok && !run.done && k < 60 * 60) { run.pump(60); k += 60; }
  const st = run.snapshot().state;
  const tLoad = now() - t0;
  ok(sh && isFinite(sh.staticMargin) && tShake <= CEIL.shake, nm + ': the bench check in ' + tShake + ' ms (<= ' + CEIL.shake + ')');
  ok(da && tDalt <= CEIL.dalt, nm + ': the density altitude in ' + tDalt + ' ms (<= ' + CEIL.dalt + ')');
  ok(st && st.done && tLoad <= CEIL.load && tLoad <= Math.max(2000, 2 * tShake),
     nm + ': the wing loading, computed, in ' + tLoad + ' ms (' + k + ' frames; verdict ' + (st && st.verdict) + '; <= ' + CEIL.load + ' and <= 2 bench checks)');
}

console.log(checks + ' checks, ' + fails + ' failed');
console.log('GATE BENCHTIME: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
