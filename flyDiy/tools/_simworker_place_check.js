#!/usr/bin/env node
// GATE SIMWORKER-PLACE - A RIG'S PLACEMENT AND THE PLAYER'S PAUSE UNDER THE PHYSICS WORKER (G1096, SIMW-BENCH 2026-09-30).
//
//   node tools/_simworker_place_check.js [--builds=cub,cessna]   -> "GATE SIMWORKER-PLACE: PASS|FAIL"
//
// Why: C3b (2026-09-30) found the rigs that HOLD or CARRY the aeroplane (shadowsky_shots HOLD, frame_perf's PLACE_AT and
// its forest / sea stands, tree_perf, met_perf, imp_audit, the island / water / cloud / light shots, approach_eval,
// _h7_follow's tow) silently broken under SIMW_DEFAULT = true: they wrote FLIGHT_PROBE.sim().p / .v, and under the worker
// the page's sim is a VIEW of the worker's - every view came out at the stand, the aeroplane "taxiing under pause". They
// go through FLIGHT_PROBE.place now (app.js; sim_host.js simHostPlace: the same writes on the sim that flies, the page's
// inline, the worker's at once between two of its steps, its snapshot back and mirrored before the promise answers).
// THE PAGE ITSELF IN NODE (tools/_page_node.js), twice per build, ?simw=0 and ?simw=1 (the harness's Worker shim, the
// lockstep rig clock), ONE SCRIPT: roll out, 120 frames of the taxi, the PAUSE button, 60 frames held, a placement 300 m
// east / 200 m south and 60 m over the ground with the velocities zeroed, 30 frames held, the pause button again (run),
// 90 frames, a velocity kick (dv 2 m/s east) while flying, 60 frames, the pause, 3 frames. Asserted:
//   1 each run: the pause holds (the CG, the sim time and p to the bit over 60 held frames, and over 30 after the
//     placement); the CG where it was asked (1e-6 m) and velocities zero after the placement;
//   2 the two runs BIT-IDENTICAL at every read (p, v and the CG FNV, the sim time) - the placement and the kick land at
//     the same step boundary in both, and the flight after them is the same flight;
//   3 simw: the worker flew it (live, placed, 2 placements answered, no stray page step, no error); inline: no worker.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const BUILDS = { cub: null, cessna: 'bugReports/cessnaMetal (1).json' };
const fnv = a => { let h = 2166136261; const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); for (let i = 0; i < u.length; i++) h = Math.imul(h ^ u[i], 16777619) >>> 0; return h.toString(16); };

async function child() {
  const mode = arg('child'), build = arg('build', 'cub'), out = arg('out');
  const { openPage } = require('./_page_node.js');
  const storage = {};
  if (BUILDS[build]) storage['flydiy.wip'] = fs.readFileSync(path.join(ROOT, BUILDS[build]), 'utf8');
  const R = { mode, build, reads: {}, errors: [] };
  const P = await openPage({ quiet: true, storage, query: mode === 'simw' ? 'simw=1' : 'simw=0', workers: /sim_host\.js/ });
  const W = P.win;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 600000);
  W.document.getElementById('bGo').click();
  const tripDone = () => { const T = W.FLYDIY_TRIPS; const t = T && T[T.length - 1]; return !!(t && t.kind === 'rollout' && t.done && W.BOOT.state === 'gone'); };
  await P.until(() => (W.FLYDIY_TRIPS ? tripDone() : (W.BOOT.state === 'gone' && W.BOOT.set === 'rollout')), 900000);
  const FP = W.FLIGHT_PROBE, RD = FP.renderer();
  RD.render = function () {}; if (RD.shadowMap) RD.shadowMap.render = function () {};
  const s = FP.sim(), bP = W.document.getElementById('bPause');
  const read = tag => { const cg = new Float64Array(s.cgPos()); R.reads[tag] = { p: fnv(s.p), v: fnv(s.v), cg: fnv(cg), cgv: Array.from(cg), t: s.t, vmax: Math.max(...Array.from(s.v, Math.abs)), phase: FP.ap().phase }; return R.reads[tag]; };
  const answer = async pr => { let got; pr.then(x => { got = x === undefined ? null : x; }); await P.until(() => got !== undefined, 120000); return got; };
  // (every door and every read after the worker's answer to the last frame landed - in a browser it has, long before a click)
  const settle = () => P.settleWorkers();
  // (the doors at the same STEP of the flight in both runs: a new worker flight holds a frame for its init)
  const SW0 = W.FLYDIY_SIMW || null, steps = () => (SW0 && !SW0.dead() ? SW0.state().stepsPosted : Math.round(s.t * 60));
  const toStep = async n => { for (let i = 0; i < 4000 && steps() < n; i++) await P.frames(1); return steps(); };
  R.pauseStep = await toStep(120);
  await settle(); bP.click(); await P.frames(3); await settle(); read('paused');
  await P.frames(60); await settle(); read('paused+60');
  const c = s.cgPos(), w = FP.world(), X = c[0] + 300, Z = c[2] + 200, Y = w.terrainH(X, Z) + 60;
  R.asked = [X, Y, Z];
  R.answered = await answer(FP.place({ at: [X, Y, Z], zeroV: true }));
  await settle(); read('placed');
  await P.frames(30); await settle(); read('placed+30');
  bP.click(); R.kickStep = await toStep(R.pauseStep + 90); await settle(); read('flown90');
  R.kicked = await answer(FP.place({ dv: [2, 0, 0] }));
  R.endStep = await toStep(R.kickStep + 60);
  await settle(); bP.click(); await P.frames(3); await settle(); read('end');
  const SW = W.FLYDIY_SIMW;
  if (SW) { const t = SW.state(); R.simw = { phase: t.phase, reason: t.reason, placeOk: t.placeOk, placed: t.placed || 0, strays: t.strays, inline: t.inline, errors: t.errors, dead: t.dead }; }
  R.workers = P.workers();
  R.errors = P.errors.filter(e => !/impostor bake/.test(e)).slice(0, 20);
  R.mem = Math.round(process.memoryUsage().rss / 1048576);
  fs.writeFileSync(out, JSON.stringify(R));
  P.close();
  process.exit(0);
}

function runChild(mode, build) {
  const out = path.join(os.tmpdir(), 'simwplace_' + process.pid + '_' + build + '_' + mode + '.json');
  const w0 = Date.now();
  const r = spawnSync(process.execPath, ['--max-old-space-size=6000', __filename, '--child=' + mode, '--build=' + build, '--out=' + out], { stdio: ['ignore', 'inherit', 'inherit'], timeout: 3 * 3600 * 1000 });
  if (r.status !== 0 || !fs.existsSync(out)) return { failed: 'child ' + mode + ' ' + build + ' exit ' + r.status + (r.signal ? ' ' + r.signal : '') };
  const R = JSON.parse(fs.readFileSync(out, 'utf8')); fs.unlinkSync(out);
  R.wallS = (Date.now() - w0) / 1000;
  return R;
}

function check(A, B, say) {
  const fails = [], bad = m => fails.push(m);
  if (A.failed) return [A.failed]; if (B.failed) return [B.failed];
  for (const X of [A, B]) {
    const r = X.reads, same = (a, b) => a.p === b.p && a.cg === b.cg && a.t === b.t;
    if (!same(r.paused, r['paused+60'])) bad(X.mode + ': the pause did not hold over 60 frames (t ' + r.paused.t + ' -> ' + r['paused+60'].t + ')');
    if (!same(r.placed, r['placed+30'])) bad(X.mode + ': the placed aeroplane moved under the pause');
    const off = Math.hypot(...r.placed.cgv.map((v, j) => v - X.asked[j]));
    if (!(off < 1e-6)) bad(X.mode + ': the CG ' + off.toFixed(3) + ' m from where it was asked');
    if (r.placed.vmax !== 0) bad(X.mode + ': velocities not zeroed by the placement (max ' + r.placed.vmax + ')');
    if (!X.answered || Math.hypot(...X.answered.map((v, j) => v - r.placed.cgv[j])) > 1e-9) bad(X.mode + ': the placement answered ' + JSON.stringify(X.answered) + ', the page reads ' + JSON.stringify(r.placed.cgv));
    if (!(r.flown90.t > r.placed.t)) bad(X.mode + ': the flight did not run after the pause');
    if (X.errors.length) bad(X.mode + ' page errors: ' + X.errors.slice(0, 3).join(' | '));
    for (const w of X.workers || []) if (w.errors && w.errors.length) bad(X.mode + ' worker errors: ' + w.errors.slice(0, 3).join(' | '));
    say('  ' + X.mode.padEnd(6) + ' paused at t ' + r.paused.t.toFixed(3) + ' (' + r.paused.phase + '), placed ' + off.toExponential(1) + ' m off, end t ' + r.end.t.toFixed(3) + ' ' + r.end.phase + ' · wall ' + X.wallS.toFixed(0) + ' s, rss ' + X.mem + ' MB');
  }
  for (const k of ['pauseStep', 'kickStep', 'endStep']) if (A[k] !== B[k]) bad('the door ' + k + ' at step ' + A[k] + ' inline, ' + B[k] + ' simw');
  for (const k of Object.keys(A.reads)) {
    const a = A.reads[k], b = B.reads[k];
    if (!b) { bad('simw has no read ' + k); continue; }
    const what = ['p', 'v', 'cg', 't', 'phase'].filter(f => a[f] !== b[f]);
    if (what.length) bad('read "' + k + '": inline and simw differ in ' + what.join(', ') + (what.includes('t') ? ' (t ' + a.t + ' / ' + b.t + ')' : ''));
  }
  if (A.simw && A.simw.phase === 'live') bad('the inline run flew through the worker');
  const S = B.simw;
  if (!S) bad('no FLYDIY_SIMW under ?simw=1');
  else {
    say('  simw: phase ' + S.phase + ', placement ' + S.placeOk + ', rig placements answered ' + S.placed + ', strays ' + S.strays + ', inline flights ' + S.inline);
    if (S.phase !== 'live') bad('the simw flight is ' + S.phase + (S.reason ? ' (' + S.reason + ')' : ''));
    if (S.placed !== 2) bad('the worker answered ' + S.placed + ' rig placements (2 asked)');
    if (S.strays) bad(S.strays + ' stray page step(s)');
    if (S.errors && S.errors.length) bad('simw errors: ' + S.errors.join(' | '));
  }
  return fails;
}

function main() {
  const builds = arg('builds', 'cub,cessna').split(',').filter(b => b in BUILDS);
  let fails = 0;
  const say = x => console.log(x);
  for (const b of builds) {
    say('== ' + b + ': the pause, a placement and a kick - ?simw=0 against ?simw=1 (lockstep)');
    const A = runChild('inline', b), B = runChild('simw', b);
    const f = check(A, B, say);
    for (const m of f) say('  FAIL ' + m);
    if (!f.length) say('  ok   ' + b + ': the pause held, the placement took on the sim that flies, ' + Object.keys(A.reads).length + ' reads bit-identical across the two paths');
    fails += f.length;
  }
  console.log('GATE SIMWORKER-PLACE: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
  process.exit(fails ? 1 : 0);
}

if (arg('child')) child().catch(e => { console.error(e && e.stack || e); process.exit(2); });
else main();
