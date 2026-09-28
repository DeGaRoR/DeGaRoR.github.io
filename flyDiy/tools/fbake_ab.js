#!/usr/bin/env node
// fbake_ab.js - THE FLOWN BAKE'S A/B, LIVE SHADER vs BAKED, SAME FRAME (C4a, G870)
//
// Drives a page kept up by tools/live_driver.js started with Q='fbake=ab' (the A/B build: every baked mesh keeps its
// live twin, the still merge off, FLOWN_BAKE.show(false|true) flips them in place). At the stand, the world held
// before the flight starts, for each view: A (live) and B (baked) shot back to back at ONE camera; then an ORBIT
// SEQUENCE (the camera turned in sub-pixel steps, A and B interleaved at each step) for the shimmer: the mean
// |difference| of consecutive frames inside the aeroplane's screen box (A6-SHADOW's metric), per side.
//   views: stand (orbit, 3/4 front, 9 m), chase (the chase framing), far (orbit, 40 m), cockpit (the pilot's eye,
//   looking at the wing root)
// Writes <out>/<view>_A.png, <view>_B.png, <view>_seq_A_<k>.png, <view>_seq_B_<k>.png and <out>/ab.json (the boxes,
// the bake's stats, the page's memory). tools/fbake_ab.py makes the side-by-sides, the GIFs and the numbers.
// Usage: node tools/fbake_ab.js <cmdPort> <outDir> [steps=16] [stepRad=0.0012]
// A GPU MEASUREMENT: hold tools/perf/boxlock.sh's gpu lock while it runs (the driver's page is the GPU user).
'use strict';
const fs = require('fs'), path = require('path');
const PORT = +(process.argv[2] || 8572), OUT = path.resolve(process.argv[3] || 'fbake_ab'), STEPS = +(process.argv[4] || 16), STEP = +(process.argv[5] || 0.0006);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (p, body) => { const r = await fetch('http://127.0.0.1:' + PORT + p, { method: 'POST', body }); return r.text(); };
const run = async body => { const t = await post('/run', body); try { return JSON.parse(t); } catch (e) { return t; } };
const shot = async f => { await fetch('http://127.0.0.1:' + PORT + '/shot?f=' + encodeURIComponent(f)); return f; };
// the aeroplane's screen box (px), from model.grp's world box through the camera
const BOX = `const P = FLIGHT_PROBE, m = P.model(), cam = P.camera(), R = P.renderer();
  const b = new THREE.Box3().setFromObject(m.grp), c = R.domElement, w = c.clientWidth, h = c.clientHeight;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i = 0; i < 8; i++) { const v = new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(cam);
    if (v.z > 1) continue; const px = (v.x * 0.5 + 0.5) * w, py = (0.5 - v.y * 0.5) * h; x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); }
  return [Math.max(0, Math.floor(x0)), Math.max(0, Math.floor(y0)), Math.min(w, Math.ceil(x1)), Math.min(h, Math.ceil(y1))];`;
const frames = n => run(`await new Promise(r => { let k = ${n}; const f = () => (--k > 0 ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }); return 1;`);
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const info = { views: {}, date: new Date().toISOString() };
  info.bake = await run('return window.FLOWN_BAKE && FLOWN_BAKE.FB.last || null;');
  info.ab = await run('return window.FLOWN_BAKE ? FLOWN_BAKE.FB.ab : null;');
  info.flip = await run('return FLOWN_BAKE.show(true);');
  console.log('bake ' + JSON.stringify(info.bake) + ' · live twins ' + info.flip);
  if (!(info.flip > 0)) { console.log('no live twins: start live_driver with Q=fbake=ab'); process.exit(1); }
  // the HUD and the panels out of the frame (the canvas and its ancestors stay)
  await run(`const c = document.getElementById('c'); document.querySelectorAll('body *').forEach(e => { if (e !== c && !e.contains(c)) e.style.visibility = 'hidden'; }); return 1;`);
  const VIEWS = [
    { k: 'stand', set: `P.camMode('orbit'); P.camSet(0.8, 0.10, 9);`, seq: 'az' },
    { k: 'chase', set: `P.camMode('chase');`, seq: null },
    { k: 'mid', set: `P.camMode('orbit'); P.camSet(0.7, 0.12, 25);`, seq: 'az' },
    { k: 'far', set: `P.camMode('orbit'); P.camSet(0.6, 0.12, 60);`, seq: 'az' },
    { k: 'cockpit', set: `P.camMode('cockpit'); HEAD_CAM.yaw = 0.95; HEAD_CAM.pitch = 0.42;`, seq: 'yaw' },
  ];
  for (const V of VIEWS) {
    await run('const P = FLIGHT_PROBE; ' + V.set + ' return 1;');
    await frames(40); await sleep(300);
    // THE COCKPIT'S EYE SWAYS every frame (the head, the world held or not): its matrix is frozen as it stands, in the
    // scene's onBeforeRender (after three's own camera update, before the frustum and the draws), and the sequence
    // turns it about its own up axis - A and B then see the very same frames
    if (V.seq === 'yaw') await run(`const S = WORLD.scene, cam = FLIGHT_PROBE.camera();
      window.__FBF = { M0: cam.matrixWorld.clone(), k: 0, step: ${STEP}, prev: S.onBeforeRender };
      S.onBeforeRender = (r, s, c) => { if (c !== cam) return; const M = __FBF.M0.clone().multiply(new THREE.Matrix4().makeRotationY(__FBF.k * __FBF.step));
        c.matrixWorld.copy(M); c.matrixWorldInverse.copy(M).invert(); };
      return 1;`);
    const box = await run(BOX);
    const cam0 = await run('return FLIGHT_PROBE.cam();');
    const one = async (tag, on) => { await run(`FLOWN_BAKE.show(${on}); return 1;`); await frames(6); await sleep(120); return shot(path.join(OUT, V.k + '_' + tag + '.png')); };
    await one('A', false); await one('B', true);
    // the frame without the aeroplane: the reader's mask (what differs from it is the aeroplane)
    await run('FLIGHT_PROBE.model().grp.visible = false; return 1;'); await frames(6); await sleep(120);
    await shot(path.join(OUT, V.k + '_bg.png'));
    await run('FLIGHT_PROBE.model().grp.visible = true; return 1;');
    const v = info.views[V.k] = { box, cam: cam0, seq: 0 };
    // THE COST AT THIS CAMERA, same frame content: the recorder's GPU time (EXT_disjoint_timer_query) and the loop's JS
    // work, 3 s a side, A B A B (the drift of a warm GPU cancels)
    v.cost = { A: [], B: [] };
    for (const side of ['A', 'B', 'A', 'B']) {
      await run(`FLOWN_BAKE.show(${side === 'B'}); return 1;`); await frames(30);
      v.cost[side].push(await run(`const g = [], w = [], c = []; const t0 = performance.now();
        while (performance.now() - t0 < 3000) { await new Promise(r => setTimeout(r, 250)); const s = FLIGHT_REC.stats(250); if (s.gpu === s.gpu) g.push(s.gpu); w.push(s.work); c.push(s.fps); }
        const m = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
        return { gpu: m(g), work: m(w), fps: m(c), calls: FLIGHT_PROBE.renderer().info.render.calls };`));
    }
    if (V.seq) {
      // the orbit (or the head) turned a sub-pixel step at a time, A and B at each step
      const a0 = cam0.az, y0 = await run('return HEAD_CAM.yaw;');
      for (let s = 0; s < STEPS; s++) {
        if (V.seq === 'az') await run(`FLIGHT_PROBE.camSet(${a0 + s * STEP}, ${cam0.el}, ${cam0.dist}); return 1;`);
        else await run(`__FBF.k = ${s}; return 1;`);
        await one('seq_A_' + String(s).padStart(2, '0'), false);
        await one('seq_B_' + String(s).padStart(2, '0'), true);
      }
      v.seq = STEPS; v.step = STEP;
    }
    if (V.seq === 'yaw') await run('WORLD.scene.onBeforeRender = __FBF.prev; return 1;');
    console.log(V.k + ' box ' + JSON.stringify(box) + (V.seq ? ' · ' + STEPS + ' steps' : ''));
  }
  await run('FLOWN_BAKE.show(true); FLIGHT_PROBE.camMode("chase"); return 1;');
  info.mem = await run('const R = FLIGHT_PROBE.renderer(); return { textures: R.info.memory.textures, geometries: R.info.memory.geometries, programs: R.info.programs.length, heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null, bakeMB: +(FLOWN_BAKE.bytes / 1048576).toFixed(1) };');
  fs.writeFileSync(path.join(OUT, 'ab.json'), JSON.stringify(info, null, 1));
  console.log('-> ' + path.join(OUT, 'ab.json') + ' ' + JSON.stringify(info.mem));
})().catch(e => { console.error('fbake_ab: ' + (e && e.stack || e)); process.exit(1); });
