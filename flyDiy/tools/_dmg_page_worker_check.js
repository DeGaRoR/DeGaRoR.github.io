#!/usr/bin/env node
// GATE DMGPAGEW (G1819, DMG-SKINGPU; the Deform Coordinator's ask after G1818's worker fix) - UNDER THE PHYSICS WORKER (the
// default mode) A CRASH'S BREAKS REACH THE PAGE. Found on the box (2026-10-06 12:50): the page's sim under ?simw=1 is a
// mirror (src/viewer/sim_link.js attach) and dmgState was not mirrored - the page's dmgNow asked the page's own sim, which
// the worker never steps, so no break ever reached the page: D4a's skin break, D4b's debris and the GPU riding never ran
// there while the worker crashed. Every node gate flew the solver inline; this one flies the PAGE.
//
//   node tools/_dmg_page_worker_check.js              -> "GATE DMGPAGEW: PASS|FAIL"
//   node tools/_dmg_page_worker_check.js --selftest   -> negative verification (the mirror's dmgState taken away must turn it red)
//   --secs=S (sim seconds after the placement, default 5)
//
// THE PAGE ITSELF IN NODE (tools/_page_node.js), dev.html?simw=1&damage=1, the user's Cub (builds/cub_2026-09-20_corrected.json),
// the solver in a REAL thread (the harness's Worker shim over src/viewer/sim_host.js - GATE SIMWORKER-PAGE's set-up): the
// garage boot, Roll out, the flight live under the worker; then the box rig's crash (tools/dmg_skingpu_box.js pageFlown):
// the hand on the controls, the aeroplane placed 4 m up at 30 m/s along its heading THROUGH THE WORKER (FLIGHT_PROBE.place),
// a trunk 40 m ahead on the centreline (world.treeHits), the throttle shut. The draws are stubbed (the picture is not the
// subject). Asserted:
//   1 the flight is the worker's: live, its placement check passed, the page's thread stepped no solver (strays 0);
//   2 THE ROW: the worker's crash broke members AND the page's damage state holds them (FLYDIY_DMG_STATE().br - what
//     app.js dmgNow hands the skin break and the debris);
//   3 the skin break ran on the page (records made, riding vertices) and the debris did (the wreck active, a piece or a part gone);
//   4 no page error, no worker error.
// NEGATIVE-VERIFIED (--selftest): the mirror's dmgState removed from the page's sim once the flight is live (the bug as it
// was): 2 and 3 must go red.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const CUB = 'builds/cub_2026-09-20_corrected.json';

// ============================================================ THE CHILD: one page
async function child() {
  const out = arg('out'), fault = arg('fault', ''), SECS = +arg('secs', 5);
  const { openPage } = require('./_page_node.js');
  const R = { fault, t: {}, errors: [], frames: 0 };
  const t0 = Date.now();
  const storage = { 'flydiy.wip': fs.readFileSync(path.join(ROOT, CUB), 'utf8') };
  const P = await openPage({ quiet: true, storage, query: 'simw=1&damage=1', workers: /sim_host\.js/ });
  const W = P.win;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 600000);
  R.t.garage = Date.now() - t0;
  W.document.getElementById('bGo').click();
  const tripDone = () => { const T = W.FLYDIY_TRIPS; const t = T && T[T.length - 1]; return !!(t && t.kind === 'rollout' && t.done && W.BOOT.state === 'gone'); };
  await P.until(() => (W.FLYDIY_TRIPS ? tripDone() : (W.BOOT.state === 'gone' && W.BOOT.set === 'rollout')), 900000);
  R.t.rollout = Date.now() - t0 - R.t.garage;
  const FP = W.FLIGHT_PROBE, SW = W.FLYDIY_SIMW || null;
  const RD = FP.renderer();
  RD.render = function () {}; if (RD.shadowMap) RD.shadowMap.render = function () {};
  const live = () => { const s = SW && SW.state(); return !!(s && s.phase === 'live' && s.flight && s.flight.live); };
  for (let i = 0; i < 600 && !live(); i++) await P.frames(1);
  const s0 = SW ? SW.state() : null;
  R.simw = s0 ? { phase: s0.phase, reason: s0.reason, placeOk: s0.placeOk, live: live() } : null;
  if (!live()) { R.errors = P.errors.slice(0, 20); fs.writeFileSync(out, JSON.stringify(R)); P.close(); process.exit(0); }
  W.FLYDIY_WRECK = true; W.FLYDIY_SKINBREAK = true; W.FLYDIY_WRECK_FAST = true;
  FP.setManual(true);
  const sim = FP.sim(), world = FP.world();
  R.mirrored = typeof sim.dmgState === 'function';
  // the bug as it was (selftest): the page's sim without the mirror's damage state
  if (fault === 'nodmg') Object.defineProperty(sim, 'dmgState', { configurable: true, enumerable: true, writable: true, value: undefined });
  // the crash (tools/dmg_skingpu_box.js pageFlown's): 4 m up, 30 m/s along the heading, placed through the worker
  const [xA] = sim.axes(), hl = Math.hypot(xA[0], xA[2]), fx = -xA[0] / hl, fz = -xA[2] / hl, V = 30, D = 40;
  const c = sim.cgPos(), g = world.terrainH(c[0], c[2]);
  let yMin = Infinity; for (let i = 1; i < sim.p.length; i += 3) yMin = Math.min(yMin, sim.p[i]);
  let placed = false;
  FP.place({ at: [c[0], g + 4 + (c[1] - yMin), c[2]], zeroV: true, dv: [V * fx, 0, V * fz] }).then(() => { placed = true; });
  await P.until(() => placed, 60000);
  for (let i = 0; i < 200 && !placed; i++) await P.frames(1);
  R.placed = placed;
  const c2 = sim.cgPos(), tx = c2[0] + fx * D, tz = c2[2] + fz * D, gt = world.terrainH(tx, tz);
  world.treeHits.set('fill:dmgpagew', [tx, tz, gt, 0.3, gt + 10]);
  sim.ctl.thr = 0;
  const tA = sim.t, t1 = Date.now();
  let pageBr = 0, firstT = null, recs = 0, riding = 0, wreck = false, gone = 0, bodies = 0;
  for (let f = 0; f < SECS * 60 + 600 && sim.t - tA < SECS; f++) {
    await P.frames(1); R.frames++;
    const DS = W.FLYDIY_DMG_STATE ? W.FLYDIY_DMG_STATE() : null, nb = DS && DS.br ? DS.br.length : 0;
    if (nb > 0 && firstT == null) firstT = +(sim.t - tA).toFixed(3);
    pageBr = Math.max(pageBr, nb);
    const S = W.FLYDIY_SKINBREAK_STATS ? W.FLYDIY_SKINBREAK_STATS() : null;
    if (S) { recs = Math.max(recs, S.recs || 0); riding = Math.max(riding, S.riding || 0); }
    const K = W.FLYDIY_WRECK_STATS ? W.FLYDIY_WRECK_STATS() : null;
    if (K) { wreck = wreck || !!K.active; gone = Math.max(gone, K.parts.filter(p => p.gone).length); bodies = Math.max(bodies, K.bodies.length); }
  }
  R.t.crash = Date.now() - t1;
  const s1 = SW ? SW.state() : null, dm = FP.damage ? FP.damage() : null;
  R.end = { simT: +(sim.t - tA).toFixed(3), phase: s1 && s1.phase, strays: s1 ? s1.strays : null, errors: s1 ? s1.errors : null,
            verdict: dm ? { reason: dm.reason || null } : null };
  R.page = { br: pageBr, firstT, recs, riding, wreck, gone, bodies };
  R.workers = P.workers ? P.workers() : null;
  R.errors = P.errors.filter(e => !/impostor bake/.test(e)).slice(0, 20);
  R.mem = Math.round(process.memoryUsage().rss / 1048576);
  fs.writeFileSync(out, JSON.stringify(R));
  P.close();
  process.exit(0);
}

// ============================================================ THE PARENT
function runChild(extra) {
  const out = path.join(os.tmpdir(), 'dmgpagew_' + process.pid + (extra.fault ? '_' + extra.fault : '') + '.json');
  const a = [__filename, '--child=1', '--out=' + out, '--secs=' + extra.secs];
  if (extra.fault) a.push('--fault=' + extra.fault);
  const w0 = Date.now();
  const r = spawnSync(process.execPath, ['--max-old-space-size=6000'].concat(a), { stdio: ['ignore', 'inherit', 'inherit'], timeout: 2 * 3600 * 1000 });
  if (r.status !== 0 || !fs.existsSync(out)) return { failed: 'child exit ' + r.status + (r.signal ? ' ' + r.signal : '') };
  const R = JSON.parse(fs.readFileSync(out, 'utf8')); fs.unlinkSync(out);
  R.wallS = (Date.now() - w0) / 1000;
  return R;
}
function judge(R, say) {
  const fails = [], bad = m => fails.push(m);
  if (R.failed) { bad(R.failed); return fails; }
  say('  the flight: ' + JSON.stringify(R.simw) + '; placed ' + R.placed + '; ' + R.frames + ' frames, ' + (R.end ? R.end.simT : '-') + ' s of sim time; '
      + 'the worker\'s verdict ' + JSON.stringify(R.end && R.end.verdict) + '; wall ' + (R.wallS || 0).toFixed(0) + ' s, ' + R.mem + ' MB');
  say('  the page: ' + JSON.stringify(R.page) + '; the mirror\'s dmgState ' + (R.mirrored ? 'on the page\'s sim' : 'ABSENT'));
  // 1 the worker's flight
  if (!(R.simw && R.simw.live && R.simw.placeOk !== false)) bad('the flight did not go live under the worker: ' + JSON.stringify(R.simw));
  if (!R.placed) bad('the placement never came back from the worker');
  if (!(R.end && R.end.strays === 0)) bad('the page\'s thread stepped the solver under the worker (strays ' + (R.end && R.end.strays) + ')');
  // 2 the row
  // (the worker's crash verdict - FLIGHT_PROBE.damage(), the worker's under it (G1470): 'broke up: ...' only on the damage
  // layer's breaks (G1832) - is independent of the mirror's damage state)
  const wv = R.end && R.end.verdict ? R.end.verdict.reason : null, wb = !!(wv && /^broke up/.test(wv));
  if (!wb) bad('the worker\'s crash broke nothing (its verdict ' + JSON.stringify(wv) + ') - the staging, not the mirror');
  if (!(R.page && R.page.br > 0)) bad('THE PAGE HOLDS NO BREAK under the worker (FLYDIY_DMG_STATE().br empty all the crash; the worker\'s verdict ' + JSON.stringify(wv) + ')');
  // 3 the page's consumers
  if (!(R.page && R.page.recs > 0 && R.page.riding > 0)) bad('the skin break never ran on the page (records ' + (R.page && R.page.recs) + ', riding ' + (R.page && R.page.riding) + ')');
  if (!(R.page && R.page.wreck && (R.page.gone > 0 || R.page.bodies > 0))) bad('no debris on the page (wreck ' + (R.page && R.page.wreck) + ', parts gone ' + (R.page && R.page.gone) + ', pieces ' + (R.page && R.page.bodies) + ')');
  // 4 errors
  const we = R.end && R.end.errors ? R.end.errors.length : 0;
  if ((R.errors || []).length || we) bad('errors: page ' + JSON.stringify(R.errors).slice(0, 400) + ', worker ' + JSON.stringify(R.end && R.end.errors).slice(0, 300));
  return fails;
}
function parent() {
  const secs = +arg('secs', 5), say = m => console.log(m);
  if (argv.includes('--selftest')) {
    say('DMGPAGEW selftest: the mirror\'s dmgState taken off the page\'s sim (the bug as it was) must turn the row red');
    const R = runChild({ fault: 'nodmg', secs });
    const f = judge(R, say);
    const red = f.some(m => /THE PAGE HOLDS NO BREAK/.test(m));
    say('  ' + (red ? 'ok  ' : 'FAIL') + '  the fault turned the row red' + (f.length ? ': ' + f.join(' | ') : ''));
    console.log('GATE DMGPAGEW-SELFTEST: ' + (red ? 'PASS' : 'FAIL'));
    process.exit(red ? 0 : 1);
  }
  say('GATE DMGPAGEW - under the physics worker a crash\'s breaks reach the page (dev.html?simw=1&damage=1, the user\'s Cub, a trunk at 30 m/s)');
  const R = runChild({ secs });
  const f = judge(R, say);
  for (const m of f) say('  FAIL  ' + m);
  if (!f.length) say('  ok    the worker\'s breaks on the page, the skin break and the debris ran there');
  console.log('GATE DMGPAGEW: ' + (f.length ? 'FAIL' : 'PASS'));
  process.exit(f.length ? 1 : 0);
}
if (arg('child')) child().catch(e => { console.error(e && e.stack || e); process.exit(2); });
else parent();
