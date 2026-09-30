#!/usr/bin/env node
// hybrid_ab.js - THE HYBRID'S EVIDENCE: THE CLOSE-UP, SAME FRAME, AND THE CROSSING IN MOTION (C4b, 2026-09-30)
//
// Drives a page kept up by tools/live_driver.js (the hybrid on: the default). Rolls the build out, holds the flight
// (the pause) and hides the HUD, then:
//   STILLS: the orbit camera close on the fuselage's side (STILL: az, el, dist), the flown model drawn three ways in the
//     same held frame (FLOWN_BAKE.FB.hyForce): t = 0 the bake alone (C4b as it landed: "the old bake"), t = 1 the live
//     meshes (what the hybrid draws this close), t = 0.5 the dithered band (both, each fragment one or the other).
//     -> still_bake.png, still_live.png, still_band.png; and the rule's own t and pixels-a-texel at that distance.
//   CROSSING: the rule on (hyForce null), the orbit walked from FAR to NEAR and back in STEPS steps, a frame shot at each
//     (-> cross_NNN.png) with its distance, magnification and t; and the frame cost across it (the flight recorder's
//     work / render ms, FLOWN_BAKE's t) - the world held, so only the camera and the switch move.
// Writes <out>/hybrid.json. Usage: node tools/hybrid_ab.js <cmdPort> <outDir> [steps=48]
// A GPU MEASUREMENT: hold tools/perf/boxlock.sh's gpu lock while the driver's page is up.
'use strict';
const fs = require('fs'), path = require('path');
const PORT = +(process.argv[2] || 8572), OUT = path.resolve(process.argv[3] || 'hybrid_ab'), STEPS = +(process.argv[4] || 48);
const STILL = (process.env.STILL || '1.45,0.05,3.2').split(',').map(Number), FAR = +(process.env.FAR || 14), NEAR = +(process.env.NEAR || 2.6);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (p, body) => { const r = await fetch('http://127.0.0.1:' + PORT + p, { method: 'POST', body }); return r.text(); };
const run = async body => { const t = await post('/run', body); try { return JSON.parse(t); } catch (e) { return t; } };
const shot = async f => { await fetch('http://127.0.0.1:' + PORT + '/shot?f=' + encodeURIComponent(f)); return f; };
const until = async (cond, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await run('return !!(' + cond + ');')) === true) return true; await sleep(500); } throw new Error('timed out: ' + what); };
const frames = n => run(`await new Promise(r => { let k = ${n}; const f = () => (--k > 0 ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }); return 1;`);
const paused = () => run(`return !!window.FLYDIY_HELD;`);
const pause = async on => { if ((await paused()) !== on) { await run(`document.getElementById('bPause').click(); return 1;`); await frames(4); } };
const state = () => run(`const FB = FLOWN_BAKE.FB, R = FLIGHT_PROBE.renderer(), v = new THREE.Vector2(); R.getDrawingBufferSize(v);
  return { t: FB.hyT, mag: FB.hyMag == null ? null : +FB.hyMag.toFixed(3), cam: FLIGHT_PROBE.cam(), H: v.y, fov: FLIGHT_PROBE.camera().fov, calls: R.info.render.calls };`);
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const info = { date: new Date().toISOString(), still: {}, cross: [] };
  await until(`window.BOOT && BOOT.state === 'gone'`, 600000, 'the garage boot');
  await sleep(1500);
  await run(`document.getElementById('bGo').click(); return 1;`);
  await until(`window.BOOT && BOOT.state === 'gone' && /Fly the circuit/.test((document.getElementById('bGo') || {}).textContent || '') && window.FLIGHT_PROBE && FLIGHT_PROBE.model()`, 900000, 'the roll-out');
  await frames(60); await sleep(1500);
  info.bake = await run('return FLOWN_BAKE.FB.last || null;');
  info.hybrid = await run('const FB = FLOWN_BAKE.FB; return { on: FB.hybrid, A: FB.hyA, B: FB.hyB, folds: FLOWN_BAKE.folds().map(F => ({ set: F.set, folds: F.meshes.length, live: F.live.length })) };');
  console.log('bake ' + JSON.stringify(info.bake && { hit: info.bake.hit, cm: info.bake.cm }) + ' hybrid ' + JSON.stringify(info.hybrid));
  await pause(true);
  await run(`const c = document.getElementById('c'); document.querySelectorAll('body *').forEach(e => { if (e !== c && !e.contains(c) && e.id !== 'bPause') e.style.visibility = 'hidden'; }); return 1;`);
  // THE STILLS: one held frame, three draws
  await run(`FLIGHT_PROBE.camMode('orbit'); FLIGHT_PROBE.camSet(${STILL[0]}, ${STILL[1]}, ${STILL[2]}); return 1;`);
  await frames(30); await sleep(300);
  info.still.rule = await state();
  for (const [k, t] of [['bake', 0], ['live', 1], ['band', 0.5]]) {
    await run(`FLOWN_BAKE.FB.hyForce = ${t}; return 1;`); await frames(6); await sleep(150);
    await shot(path.join(OUT, 'still_' + k + '.png'));
    info.still[k] = await state();
  }
  await run(`FLOWN_BAKE.FB.hyForce = null; return 1;`);
  console.log('still ' + JSON.stringify(info.still.rule));
  // THE CROSSING: FAR -> NEAR -> FAR, the rule deciding, a frame shot at each step, the cost read over a short window
  const az = STILL[0], el = STILL[1];
  for (let s = 0; s <= 2 * STEPS; s++) {
    const u = s <= STEPS ? s / STEPS : 2 - s / STEPS;
    const d = FAR * Math.pow(NEAR / FAR, u);          // geometric: even steps in magnification
    await run(`FLIGHT_PROBE.camSet(${az}, ${el}, ${d}); return 1;`);
    await frames(3);
    const f = path.join(OUT, 'cross_' + String(s).padStart(3, '0') + '.png');
    await shot(f);
    const st = await state();
    const cost = await run(`const s = FLIGHT_REC.stats(300); return { work: s.work, render: s.render, gpu: s.gpu === s.gpu ? s.gpu : null, fps: s.fps };`);
    info.cross.push({ s, d: +d.toFixed(2), t: st.t, mag: st.mag, calls: st.calls, cost });
  }
  console.log('cross ' + info.cross.map(c => c.d + 'm t' + (c.t == null ? '-' : c.t.toFixed(2)) + ' ' + c.calls).join(' | '));
  fs.writeFileSync(path.join(OUT, 'hybrid.json'), JSON.stringify(info, null, 1));
  console.log('-> ' + path.join(OUT, 'hybrid.json'));
})().catch(e => { console.error('hybrid_ab: ' + (e && e.stack || e)); process.exit(1); });
