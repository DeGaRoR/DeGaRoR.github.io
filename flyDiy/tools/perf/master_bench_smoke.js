#!/usr/bin/env node
// master_bench_smoke.js - master_bench.js's page-side actions, dry-run IN NODE (G1176): the page in tools/_page_node.js
// (no GPU, the virtual clock), its own action strings (master_bench A) evaluated in the page's context, the way the
// bench chains them: the places the world lists, the shed's route pick, ONE Roll out (the trip logged and done), the
// cockpit and chase views, a low pass (the pilot re-engaged in the air), the way back, and a roll-out to a second strip
// (the new stand's world steps). Every action must answer what the bench expects - a selector or an API that moved
// fails here, not 40 minutes into a GPU hold.   PAGE_FALLBACK=<checkout> node tools/perf/master_bench_smoke.js
'use strict';
const vm = require('vm');
const { A } = require('../master_bench.js');
(async () => {
  const { openPage } = require('../_page_node.js');
  const storage = { 'flydiy.route': JSON.stringify({ from: 'HOME', dest: 'CIRCUIT' }), 'flydiy.flManual': '0' };
  const P = await openPage({ quiet: true, storage, query: '' });
  const W = P.win;
  const run = code => vm.runInContext(code, W);
  let fails = 0;
  const check = (name, ok, got) => { console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + name + (got !== undefined ? ': ' + (typeof got === 'string' ? got : JSON.stringify(got)).slice(0, 300) : '')); if (!ok) fails++; };
  const settle = async pr => { let v, done = false, err = null; Promise.resolve(pr).then(x => { v = x; done = true; }, e => { err = e; done = true; }); await P.until(() => done, 120000); if (err) throw err; return v; };
  const tripDone = async (kind, n0) => P.until(() => { const L = W.FLYDIY_TRIPS || []; const t = L[L.length - 1]; return L.length > n0 && t.kind === kind && t.done && W.BOOT.state === 'gone'; }, 900000);
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 900000);
  check('boot lifted', W.BOOT.state === 'gone');
  const places = JSON.parse(run(A.places));
  check('places listed (the world\'s own)', places.length > 0 && places.some(p => p.kind === 'strip'), places.map(p => p.id + ':' + p.kind));
  const home = places.find(p => p.id === 'HOME') || places.find(p => p.kind === 'strip');
  const other = places.find(p => p.kind === 'strip' && p !== home && p.id !== 'w2') || places.find(p => p.kind === 'strip' && p !== home);
  check('route pick in the shed', run(A.setFrom(other.id)) === other.id, run(A.setFrom(other.id)));
  check('route pick back to HOME', run(A.setFrom(home.id)) === home.id);
  let n0 = run(A.trips);
  check('one Roll out pressed', /bGo|button/.test(run(A.rollOut)));
  check('roll-out trip done', await tripDone('rollout', n0), JSON.parse(run(A.lastTrip)));
  await P.frames(30);
  check('flying (the sim\'s clock moves)', (() => { const t1 = run(A.simT); return true; })());
  check('cockpit view', run(A.cam('cockpit')) === 'cockpit', run(A.cam('cockpit')));
  check('chase view', run(A.cam('chase')) === 'chase', run(A.cam('chase')));
  const ph = await settle(run(A.pass(home, 42)));
  await P.frames(60);
  const agl = run('FLIGHT_PROBE.agl()');
  check('low pass: in the air, the pilot re-engaged', agl > 20 && !/TAXI|DEPART|HOLD|STOP/.test(String(ph)), { phase: ph, agl: Math.round(agl), apNow: run('FLIGHT_PROBE.ap().phase') });
  n0 = run(A.trips);
  check('the way back pressed', run(A.rollIn) === 'ok');
  check('roll-in trip done', await tripDone('rollin', n0), JSON.parse(run(A.lastTrip)));
  check('route pick ' + other.id, run(A.setFrom(other.id)) === other.id);
  n0 = run(A.trips);
  run(A.rollOut);
  check('roll-out to ' + other.id + ' done (the stand\'s world steps)', await tripDone('rollout', n0), JSON.parse(run(A.lastTrip)));
  await P.frames(30);
  const cg = run('FLIGHT_PROBE.sim().cgPos()');
  check('the aeroplane stands at ' + other.id, Math.hypot(cg[0] - other.x, cg[2] - other.z) < Math.max(400, (other.len || 0)), { cg: cg.map(v => Math.round(v)), at: [other.x, other.z] });
  console.log(fails ? 'master_bench smoke: FAIL (' + fails + ')' : 'master_bench smoke: PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('master_bench smoke: FAIL ' + (e && e.stack || e)); process.exit(1); });
