#!/usr/bin/env node
// DMG-D4b (the user's review via the coordinator: "the previous crash's drawing survives the reset"): EVERY WAY BACK TO A
// FRESH AEROPLANE CLEARS THE WRECK. A client of tools/live_driver.js (a page at the stand, ?damage=1&simw=0; the GPU lock
// first). Per path: a 30 m/s trunk crash staged as the stills stage it (the wind off), the wreck checked drawn (bodies,
// released parts), then the path the player takes -
//   retry     the crash's card: `Fly again` (bGo after endFlight: fullReset);
//   garage    `The shed` (bHangar2), then `Roll out` again;
//   place     `The shed`, another departure in the route select, `Roll out`;
// then a few seconds of the game's own frames and the check: the wreck layer idle (FLYDIY_WRECK_STATS().active false), no
// debris body left in the scene (wreckDebris:*), every part object visible and on its rig (no collapsed matrix), the
// skin break idle (FLYDIY_SKINBREAK_STATS), and a still of the fresh aeroplane.
//   node tools/dmg_wreck_paths.js [--cmd 8572] [--out <dir>] [--paths retry,garage,place]
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const S = require('./dmg_wreck_stills.js'), MB = require('./master_bench.js');
const OUT = path.resolve(opt('out', '.')); fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = async js => { const b = await S.post('/eval', js); try { return JSON.parse(b); } catch (e) { return b; } };

// the page's own frames again (the stills rig holds the sim's step; the paths need the game's loop)
function pageFree() { const sim = FLIGHT_PROBE.sim(); if (window.__d4bStep) { sim.step = window.__d4bStep; delete window.__d4bStep; } return 1; }
// the wreck as drawn now
function pageWreck() {
  const P = FLIGHT_PROBE, m = P.model(), scene = P.craft().parent, W = window.FLYDIY_WRECK_STATS ? FLYDIY_WRECK_STATS() : {};
  const debris = scene.children.filter(c => /^wreckDebris:/.test(c.name || '')).length;
  let hidden = 0, collapsed = 0;
  const parts = [].concat((m.engRigs || []).map(e => e.obj), m.props || [], (m.wheelParts || []).map(w => w.obj), m.castorRig ? [m.castorRig.obj] : []);
  for (const o of parts) { if (!o) continue; if (!o.visible) hidden++; const e = o.matrix.elements; if (Math.abs(e[0]) < 1e-4 && Math.abs(e[5]) < 1e-4 && Math.abs(e[10]) < 1e-4) collapsed++; }
  const SB = window.FLYDIY_SKINBREAK_STATS ? FLYDIY_SKINBREAK_STATS() : null, D = P.sim().damage ? P.sim().damage() : null;
  return { active: !!W.active, bodies: (W.bodies || []).length, gone: (W.parts || []).filter(p => p.gone).map(p => p.kind + ':' + p.why), debris, parts: parts.length, hidden, collapsed,
           skinRecs: SB ? (SB.recs != null ? SB.recs : SB.n) : null, broken: D ? D.broken.length : null, t: +P.sim().t.toFixed(2), garage: document.body.classList.contains('mode-ws') };
}
const waitFor = async (js, ms) => { const t = Date.now() + ms; while (Date.now() < t) { if (await ev(js) === true) return true; await sleep(500); } return false; };
const inWorld = "(window.BOOT ? BOOT.state === 'gone' : true) && !document.body.classList.contains('mode-ws') && !!(window.FLIGHT_PROBE && FLIGHT_PROBE.sim())";
const inShed = "document.body.classList.contains('mode-ws')";

(async () => {
  const R = { at: new Date().toISOString(), paths: {} };
  const pl0 = await ev(MB.A.places), places = typeof pl0 === 'string' ? JSON.parse(pl0) : pl0;
  const strips = places.filter(p => p.kind === 'strip');
  for (const k of opt('paths', 'retry,garage,place').split(',')) {
    const r = { path: k };
    // (a staged crash that breaks nothing proves nothing about the path: staged once more, the why kept - the hits, the
    // steps, the sim's clock - and the path marked NOT EXERCISED if it still breaks nothing)
    const crashOnce = async () => { const x = await S.run(S.pageStage, S.CASES['trunk-0'].o);
      const why = await ev("JSON.stringify({ hits: FLIGHT_PROBE.sim().trunkHits ? FLIGHT_PROBE.sim().trunkHits() : null, t: FLIGHT_PROBE.sim().t, held: !!window.__d4bStep, world: !!FLIGHT_PROBE.world().treeHits })");
      return { broken: x.broken, reason: x.reason, steps: x.steps, why: typeof why === 'string' ? JSON.parse(why) : why }; };
    r.crash = await crashOnce();
    if (!r.crash.broken) { r.crash0 = r.crash; await S.run(pageFree); r.crash = await crashOnce(); }
    r.exercised = r.crash.broken > 0;
    await S.run(pageFree);
    r.wreck = await S.run(pageWreck);
    if (k === 'retry') {
      r.act = await ev("(() => { FLIGHT_PROBE.endFlight('crashed'); document.getElementById('bGo').click(); return 'ok'; })()");
      await sleep(4000);
    } else {
      r.rollIn = await ev(MB.A.rollIn); r.shed = await waitFor(inShed, 120000); await sleep(3000);
      if (k === 'place') { const other = strips.find(p => p.id !== 'HOME') || strips[0]; r.from = other && other.id; r.set = await ev(MB.A.setFrom(r.from)); }
      r.rollOut = await ev(MB.A.rollOut); r.world = await waitFor(inWorld, 300000); await sleep(5000);
    }
    r.after = await S.run(pageWreck);
    r.ok = r.exercised && !r.after.active && r.after.bodies === 0 && r.after.debris === 0 && r.after.hidden === 0 && r.after.collapsed === 0 && !r.after.broken;
    // (two views of the fresh aeroplane, far enough to see all of it: a front quarter and from above-behind)
    r.shots = [];
    for (const [i, cam] of [[150, 14, 14], [235, 30, 18]].entries()) {
      await S.run(S.pageView, cam); await sleep(800);
      const f = path.join(OUT, 'path_' + k + '_after_' + (i + 1) + '.png'); await S.get('/shot?f=' + encodeURIComponent(f)); r.shots.push(f);
    }
    console.log(k + ': crash ' + JSON.stringify(r.crash) + ' wreck ' + JSON.stringify(r.wreck) + ' -> after ' + JSON.stringify(r.after) + ' ' + (!r.exercised ? 'NOT EXERCISED (the staged crash broke nothing)' : r.ok ? 'CLEAN' : 'LEFT OVER'));
    R.paths[k] = r;
    // (back to the home strip for the next path)
    if (k === 'place') { await ev(MB.A.rollIn); await waitFor(inShed, 120000); await ev(MB.A.setFrom('HOME')); await ev(MB.A.rollOut); await waitFor(inWorld, 300000); await sleep(4000); }
  }
  fs.writeFileSync(path.join(OUT, 'paths.json'), JSON.stringify(R, null, 1));
  console.log('WRECK_PATHS ' + Object.entries(R.paths).map(([k, r]) => k + ' ' + (!r.exercised ? 'NOT EXERCISED' : r.ok ? 'CLEAN' : 'LEFT OVER')).join(', '));
})().catch(e => { console.log('WRECK_PATHS_FAIL ' + (e && e.stack || e)); process.exit(1); });
