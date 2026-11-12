#!/usr/bin/env node
// GATE SCENEPAGE - SAVE A SCENE, MOVE EVERYTHING, LOAD IT BACK: THE PAGE ITSELF, IN NODE (PHOTO-MODE-2 P2, 2026-11-12).
//
//   node tools/_scenepage_check.js [--modes=inline,simw]   -> "GATE SCENEPAGE: PASS|FAIL"
//
// The page in node (tools/_page_node.js; ?simw=0 and ?simw=1 - the physics worker's placement path too), one script:
//   THE SHED: SCENE.get -> a garage scene (the orbit, the field of view); the orbit moved; SCENE.apply -> the orbit back.
//   THE FLIGHT: roll out, 2 s of the trip, the pause; SCENE.get -> a GROUND scene; the aeroplane moved 300 m and the
//   camera put on chase; SCENE.apply -> the aeroplane back (the CG to 1e-6 m, heading / pitch / roll to 1e-6 deg) and the
//   eye back (1e-3 m). Then the aeroplane put IN THE AIR at a bank (FLIGHT_PROBE.place with a pose: P2's door) ->
//   SCENE.get -> an AIR scene with that roll; moved; SCENE.apply -> back. The scene file round-trips through
//   sceneNormalise on the way (what the player exports is what loads). No page error, no worker error.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };

async function child() {
  const mode = arg('child'), out = arg('out');
  const { openPage } = require('./_page_node.js');
  const R = { mode, rows: [], errors: [] };
  const row = (ok, msg, got) => R.rows.push({ ok: !!ok, msg, got: got === undefined ? null : String(got) });
  const P = await openPage({ quiet: true, storage: {}, query: mode === 'simw' ? 'simw=1' : 'simw=0', workers: /sim_host\.js/ });
  const W = P.win;
  const answer = async pr => { let got, err; pr.then(x => { got = x === undefined ? null : x; }, e => { err = e; got = null; }); await P.until(() => got !== undefined, 1800000); if (err) throw err; return got; };
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 900000);
  const S = W.SCENE, FP = W.FLIGHT_PROBE;
  row(S && ['get', 'apply', 'check', 'ready', 'shoot', 'save', 'list'].every(k => typeof S[k] === 'function'), 'window.SCENE has its doors');
  await answer(S.ready());
  // ---- the shed ----
  const g = S.get('shed');
  row(g.site === 'garage' && g.camera && g.camera.orbit && g.plane && g.plane.build && g.plane.build.spec, 'the shed: a garage scene (the orbit, the build inline)', g.site);
  row(W.sceneNormalise(JSON.parse(JSON.stringify(g))).ok, 'the shed scene is a valid scene file');
  const o0 = FP.cam();
  FP.camSet(o0.az + 1.1, o0.el + 0.15, o0.dist + 4);
  const rg = await answer(S.apply(JSON.parse(JSON.stringify(g)), { photo: false, settle: 3 }));
  const o1 = FP.cam();
  row(Math.abs(o1.az - g.camera.orbit.az) < 1e-6 && Math.abs(o1.el - g.camera.orbit.el) < 1e-6 && Math.abs(o1.dist - g.camera.orbit.dist) < 1e-6, 'the shed scene loaded: the orbit back', [o1.az, o1.el, o1.dist].map(v => v.toFixed(4)).join(' '));
  row(!rg.steps.includes('the roll-out') && !rg.steps.includes('the build'), 'a shed scene of the same build: no roll-out, no rebuild', rg.steps.join(', '));
  // ---- the flight ----
  W.document.getElementById('bGo').click();
  const tripDone = () => { const T = W.FLYDIY_TRIPS; const t = T && T[T.length - 1]; return !!(t && t.kind === 'rollout' && t.done && W.BOOT.state === 'gone'); };
  await P.until(() => (W.FLYDIY_TRIPS ? tripDone() : (W.BOOT.state === 'gone' && W.BOOT.set === 'rollout')), 1800000);
  const RD = FP.renderer(); RD.render = function () {}; if (RD.shadowMap) RD.shadowMap.render = function () {};
  await P.frames(120);
  W.document.getElementById('bPause').click(); await P.frames(3);
  if (P.settleWorkers) await P.settleWorkers();
  const sim = () => FP.sim(), def = () => FP.def();
  const poseNow = () => W.scenePoseOf(sim().p, sim().m, def());
  const D = 180 / Math.PI, ang = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
  const cmp = (sc, tag) => {
    const q = poseNow(), p = sc.pose;
    const dc = Math.hypot(q.cg[0] - p.at[0], q.cg[1] - p.at[1], q.cg[2] - p.at[2]);
    const da = Math.max(ang(q.hdg * D, p.hdg), ang(q.pitch * D, p.pitch), ang(q.roll * D, p.roll));
    row(dc < 1e-5 && da < 1e-5, tag + ': the aeroplane back (CG, heading, pitch, roll)', dc.toExponential(2) + ' m, ' + da.toExponential(2) + ' deg');
  };
  const eyeOf = () => FP.camera().position.toArray();
  for (const where of ['ground', 'air']) {
    if (where === 'air') {
      const c = sim().cgPos(), w = FP.world();
      await answer(FP.place({ at: [c[0] + 150, w.terrainH(c[0] + 150, c[2] - 90) + 120, c[2] - 90], pose: { hdg: 1.0, pitch: 0.08, roll: 0.35 } }));
      if (P.settleWorkers) await P.settleWorkers();
      await P.frames(3);
      const q = poseNow();
      row(Math.abs(q.roll - 0.35) < 1e-9 && Math.abs(q.pitch - 0.08) < 1e-9, 'FLIGHT_PROBE.place with a pose: the aeroplane banked as asked (the worker\'s door too)', (q.roll * D).toFixed(4) + ' deg');
    }
    const sc = JSON.parse(JSON.stringify(S.get(where)));
    const eye0 = eyeOf();
    row(sc.site === 'flight' && sc.pose && sc.pose.where === where && sc.camera.anchor === 'plane', where + ': SCENE.get reads a ' + where + ' scene, the camera on the plane', sc.pose && sc.pose.where);
    row(W.sceneNormalise(sc).ok, where + ': a valid scene file', W.sceneNormalise(sc).errors.join('; '));
    // move everything
    const c = sim().cgPos();
    await answer(FP.place({ by: [300, 40, 200], zeroV: true }));
    if (P.settleWorkers) await P.settleWorkers();
    FP.camMode('chase'); await P.frames(5);
    const rep = await answer(S.apply(sc, { photo: false, settle: 6 }));
    if (P.settleWorkers) await P.settleWorkers();
    await P.frames(3);
    cmp(sc, where);
    const e1 = eyeOf(), de = Math.hypot(e1[0] - eye0[0], e1[1] - eye0[1], e1[2] - eye0[2]);
    row(de < 1e-3, where + ': the eye back where it was', de.toExponential(2) + ' m');
    row(FP.camModeNow() === 'free', where + ': on the free camera (the exact eye)', FP.camModeNow());
    row(rep.steps.includes('the pose') && rep.steps.includes('the camera') && !rep.steps.includes('the roll-out'), where + ': the loader\'s steps', rep.steps.join(', '));
    R[where + 'Warn'] = rep.warnings;
    void c;
  }
  // the scene list (this browser's): save, list, remove
  const saved = await answer(S.save('gate'));
  row(saved && S.list().length === 1 && S.list()[0].name === 'gate', 'SCENE.save keeps it in this browser (flydiy.scenes)', S.list().length);
  S.remove(0);
  row(S.list().length === 0, 'and SCENE.remove takes it away');
  const SW = W.FLYDIY_SIMW;
  if (SW) { const t = SW.state(); R.simw = { phase: t.phase, placed: t.placed || 0, errors: t.errors }; }
  R.workers = P.workers();
  R.errors = P.errors.filter(e => !/impostor bake/.test(e)).slice(0, 20);
  fs.writeFileSync(out, JSON.stringify(R));
  P.close();
  process.exit(0);
}

function main() {
  const modes = arg('modes', 'inline,simw').split(',');
  let fails = 0;
  for (const mode of modes) {
    const out = path.join(os.tmpdir(), 'scenepage_' + process.pid + '_' + mode + '.json'), w0 = Date.now();
    console.log('== ' + mode + ' (?simw=' + (mode === 'simw' ? 1 : 0) + ')');
    const r = spawnSync(process.execPath, ['--max-old-space-size=6000', __filename, '--child=' + mode, '--out=' + out], { stdio: ['ignore', 'inherit', 'inherit'], timeout: 3 * 3600 * 1000 });
    if (r.status !== 0 || !fs.existsSync(out)) { console.log('  FAIL the child exited ' + r.status + (r.signal ? ' ' + r.signal : '')); fails++; continue; }
    const R = JSON.parse(fs.readFileSync(out, 'utf8')); fs.unlinkSync(out);
    for (const x of R.rows) { console.log((x.ok ? '  ok   ' : '  FAIL ') + x.msg + (x.got != null ? '  [' + x.got + ']' : '')); if (!x.ok) fails++; }
    if (R.errors.length) { console.log('  FAIL page errors: ' + R.errors.slice(0, 3).join(' | ')); fails++; }
    for (const w of R.workers || []) if (w.errors && w.errors.length) { console.log('  FAIL worker errors: ' + w.errors.slice(0, 3).join(' | ')); fails++; }
    if (mode === 'simw') { const S = R.simw; if (!S || S.phase !== 'live') { console.log('  FAIL the simw flight is not live (' + JSON.stringify(S) + ')'); fails++; } else console.log('  ok   the worker flew it (placements answered: ' + S.placed + ')'); }
    console.log('  (warnings the loader gave: ground ' + JSON.stringify(R.groundWarn || []) + ', air ' + JSON.stringify(R.airWarn || []) + '; ' + ((Date.now() - w0) / 1000).toFixed(0) + ' s)');
  }
  console.log('GATE SCENEPAGE: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
  process.exit(fails ? 1 : 0);
}

if (arg('child')) child().catch(e => { console.error(e && e.stack || e); process.exit(2); });
else main();
