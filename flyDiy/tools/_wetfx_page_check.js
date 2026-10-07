#!/usr/bin/env node
// _wetfx_page_check.js - GATE WETFX-PAGE (G2090, WATER-LOOK; full tier: the page in node, ~3 min, ~4 GB - take the CPU
// lock): THE PAGE'S OWN LOOP over a wheeled ditching. dev.html in node (tools/_page_node.js: the real three r186 on the
// recording GL, the virtual clock), the user's Cub (builds/cub_2026-09-20_corrected.json) rolled out at HOME, then:
//   1. ON THE STAND, DRY: the wet body's spray pool exists (made at the build, its program warmed), is HIDDEN, nothing
//      lives in it, the interaction field is off - and the pool's material is among the linked programs already.
//   2. THE DITCH (FLIGHT_PROBE.place, the sim that flies): 0.5 m over the SEA lane at 22 m/s sinking 1.5 m/s, power off,
//      by hand. Within 2 s of sim: contacts read (waterFx.wet.last), a splash's droplets alive, the pool shown, the
//      field on and stamped; the spray and field materials draw with the programs linked before the contact (warmed at load), no variant added; no page error.
//   3. AFTER: the spray dies down while the aeroplane sits; the field is let go 10 s past the last contact - here the
//      aeroplane stays in the water, so the field stays asked (held by its contacts, not by a flag).
//   PAGE_Q=simw=0 runs it inline (the default is the page's: the worker's path under the harness's Worker shim when
//   WETFX_WORKER=1, else the page's no-Worker path - the solver on the main thread).
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
let fails = 0;
const ok = (c, msg) => { console.log((c ? '  ok   ' : '  FAIL ') + msg); if (!c) fails++; };
(async () => {
  const { openPage } = require('./_page_node.js');
  const storage = { 'flydiy.wip': fs.readFileSync(path.join(ROOT, 'builds', 'cub_2026-09-20_corrected.json'), 'utf8') };
  const wk = process.env.WETFX_WORKER ? { workers: /sim_host|house_worker/, workerWaitMs: 900000 } : {};
  const P = await openPage(Object.assign({ quiet: true, storage, query: process.env.PAGE_Q || '' }, wk));
  const W = P.win;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 600000);
  W.document.getElementById('bGo').click();
  const tripDone = () => { const T = W.FLYDIY_TRIPS; const t = T && T[T.length - 1]; return !!(t && t.kind === 'rollout' && t.done && W.BOOT.state === 'gone'); };
  await P.until(tripDone, 900000);
  await P.frames(30);
  const FP = W.FLIGHT_PROBE, fx = () => W.WATER_FX && W.WATER_FX.fx;
  const progs = () => (FP.renderer().info.programs || []).length;
  // 1. dry
  const f0 = fx();
  ok(!!f0 && f0.shared && !!f0.wet, 'the Cub carries the wet body\'s pool (shared, with its contact state)');
  ok(f0 && !f0.pts.visible && f0.drops.live === 0, `on the stand: the pool hidden, ${f0 ? f0.drops.live : '-'} particles alive`);
  ok(!(W.WATER && W.WATER.field && W.WATER.field.on), 'on the stand: the interaction field off');
  // WATER-LOOK's own materials - the pool's sprites, the field's step and derive - each with its program linked before
  // the first contact (three's material properties: currentProgram, set by compile or a first draw)
  const R = FP.renderer(), mats = () => [['the spray pool', f0 && f0.drops.spray && f0.drops.spray.material],
    ['the field step', W.WATER && W.WATER.field && W.WATER.field.stepMat], ['the field derive', W.WATER && W.WATER.field && W.WATER.field.deriveMat]];
  const progOf = m => { const q = m && R.properties.get(m); return q && q.currentProgram ? q.currentProgram : null; };
  const varsOf = m => { const q = m && R.properties.get(m); return q && q.programs ? q.programs.size : 0; };
  const pre = mats().map(([k, m]) => [k, progOf(m), varsOf(m)]);
  ok(pre.every(x => !!x[1]), 'linked before any contact: ' + pre.map(x => x[0] + (x[1] ? ' yes (' + x[2] + ')' : ' NO')).join(', '));
  console.log('  (programs linked on the stand: ' + progs() + ')');
  // 2. the ditch
  const p0 = progs(), e0 = P.errors.length;
  const s = FP.sim(), Wd = FP.world(), sea = Wd.aerodromes.find(a => a.id === 'SEA');
  s.ctl.thr = 0; FP.setManual(true); s.ctl.thr = 0;
  const [xA] = s.axes(), hl = Math.hypot(xA[0], xA[2]), fxd = -xA[0] / hl, fzd = -xA[2] / hl;
  const c = s.cgPos(); let yMin = Infinity; for (let i = 0; i < s.n; i++) yMin = Math.min(yMin, s.p[i * 3 + 1]);
  const x = sea.spawn ? sea.spawn[0] : sea.x, z = sea.spawn ? sea.spawn[1] : sea.z, wl = Wd.waterH(x, z);
  let placed = null; FP.place({ at: [x, wl + 0.5 + (c[1] - yMin), z], zeroV: true, dv: [fxd * 22, -1.5, fzd * 22] }).then(cg => { placed = cg; });
  await P.until(() => !!placed, 60000);
  const bP = W.document.getElementById('bPause'); if (bP && /run/i.test(bP.textContent)) bP.click();
  const t0 = s.t; let maxLive = 0, maxWet = 0, shown = 0, fieldOn = 0, n = 0, stampsSeen = 0;
  const st0 = W.WATER.stamp; W.WATER.stamp = function () { stampsSeen++; return st0.apply(this, arguments); };
  while (FP.sim().t - t0 < 2.0 && n < 600) { await P.frames(1); n++;
    const F = fx(); const L = F && F.wet && F.wet.last; maxWet = Math.max(maxWet, L ? L[0] : 0); maxLive = Math.max(maxLive, F ? F.drops.live : 0);
    if (F && F.pts.visible) shown++; if (W.WATER.field.on) fieldOn++; }
  ok(maxWet > 0, `the ditch: up to ${maxWet} wet groups read by the page in ${n} frames (${(FP.sim().t - t0).toFixed(2)} s of sim)`);
  ok(maxLive > 50, `the splash and the plough: up to ${maxLive} particles alive`);
  ok(shown > 0 && fieldOn > 0 && stampsSeen > 0, `the pool shown ${shown} frames, the field on ${fieldOn}, ${stampsSeen} stamps`);
  // the first contact links nothing of WATER-LOOK's: each material drew with the program warmed, no variant added
  const post = mats().map(([k, m]) => [k, progOf(m), varsOf(m)]);
  ok(post.every((x, i) => x[1] === pre[i][1] && x[2] === pre[i][2]), 'the first contact drew with the warmed programs: ' +
    post.map((x, i) => x[0] + ' ' + (x[1] === pre[i][1] ? 'same' : 'NEW') + ' (' + pre[i][2] + ' -> ' + x[2] + ')').join(', '));
  // (the page's other links meanwhile: the world streaming in at the SEA lane, a kilometre from the stand - reported, not ours)
  console.log(`  (programs ${p0} -> ${progs()} meanwhile, the world's: ` + (R.info.programs || []).slice(p0).map(q => String(q.cacheKey || '').split(',').slice(-2).join(',').slice(0, 32)).join(' | ') + ')');
  ok(P.errors.length === e0, `no page error (${P.errors.slice(e0, e0 + 3).join(' | ')})`);
  // 3. sitting in the water
  let liveEnd = 0; for (let i = 0; i < 300; i++) { await P.frames(1); }
  liveEnd = fx().drops.live;
  const cg = FP.sim().cgPos();
  console.log(`  (after ${(FP.sim().t - t0).toFixed(1)} s: ${liveEnd} alive, the CG ${(Wd.waterH(cg[0], cg[2]) - cg[1]).toFixed(2)} m under the surface, flood ${FP.sim().out.wetFlood})`);
  ok(liveEnd < maxLive, `the spray dies down as the aeroplane slows (${liveEnd} alive against the peak ${maxLive})`);
  ok(P.errors.length === e0, `no page error after 300 frames more`);
  console.log(fails ? `\nGATE WETFX-PAGE: FAIL (${fails})` : '\nGATE WETFX-PAGE: PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
