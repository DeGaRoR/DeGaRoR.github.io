#!/usr/bin/env node
// eye_judder.js - THE COCKPIT EYE AGAINST THE AEROPLANE, FRAME BY FRAME (C4b, 2026-09-30: the user, "the cockpit view
// was shaking like hell ... camera frenetically going up and down in small increments")
//
// Drives a page kept up by tools/live_driver.js. Rolls the build out, puts the camera in the cockpit (the head at rest),
// starts the circuit, and for each PHASE (taxi: rolling > 3 m/s; climb: 60 m up) records ~5 s of frames AT THE DRAW:
// a hook on the renderer's own render() takes, once per rAF frame, for the world scene drawn through the flight camera:
//   the eye (camera.matrixWorld's position) and its look (the camera's forward, its pitch), the solver's body origin
//   and its pitch (sim.axes), model.grp's matrixWorld position, sim.t, the frame's real time.
// Then: per frame the solver steps (sim.t's advance x 60), and the JUDDER - the second difference of each series (a
// smooth path has a small one; a chatter at the frame rate a large one, its sign flipping frame to frame), in mm and
// in mrad, for the eye, the body origin, the eye relative to it, and the look.
// Usage: node tools/eye_judder.js <cmdPort> <out.json> [secs=5]
// A GPU MEASUREMENT: hold tools/perf/boxlock.sh's gpu lock while the driver's page is up.
'use strict';
const fs = require('fs'), path = require('path');
const PORT = +(process.argv[2] || 8572), OUT = path.resolve(process.argv[3] || 'eye_judder.json'), SECS = +(process.argv[4] || 5);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (p, body) => { const r = await fetch('http://127.0.0.1:' + PORT + p, { method: 'POST', body }); return r.text(); };
const run = async body => { const t = await post('/run', body); try { return JSON.parse(t); } catch (e) { return t; } };
const until = async (cond, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await run('return !!(' + cond + ');')) === true) return true; await sleep(500); } throw new Error('timed out: ' + what); };
const HOOK = `if (!window.__EJ) {
    const R = FLIGHT_PROBE.renderer(), orig = R.render, E = window.__EJ = { on: false, fresh: false, rows: [] };
    const tick = () => { E.fresh = true; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
    const f = new THREE.Vector3();
    R.render = function (scene, cam) {
      if (E.on && E.fresh && cam === FLIGHT_PROBE.camera() && window.WORLD && scene === WORLD.scene) {
        E.fresh = false;
        const s = FLIGHT_PROBE.sim(), m = FLIGHT_PROBE.model(), o = s.bodyOrigin(), ax = s.axes(), e = cam.matrixWorld.elements, g = m && m.grp ? m.grp.matrixWorld.elements : null;
        cam.getWorldDirection(f);
        E.rows.push([performance.now(), s.t, e[12], e[13], e[14], Math.asin(Math.max(-1, Math.min(1, f.y))), o[0], o[1], o[2], Math.asin(Math.max(-1, Math.min(1, -ax[0][1]))),
          g ? g[13] : null, FLIGHT_PROBE.camModeNow ? FLIGHT_PROBE.camModeNow() : null, window.FLYDIY_PACE && FLYDIY_PACE.state ? FLYDIY_PACE.state().cap : null]);
      }
      return orig.apply(this, arguments);
    };
  } return 1;`;
function stats(rows) {
  const n = rows.length, col = i => rows.map(r => r[i]);
  const t = col(0), st = col(1), ey = col(3), ep = col(5), oy = col(7), op = col(9);
  const rel = ey.map((y, i) => y - oy[i]);
  const d2 = a => a.slice(2).map((x, i) => x - 2 * a[i + 1] + a[i]);
  const rms = a => a.length ? Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length) : null;
  const flips = a => { let k = 0; for (let i = 1; i < a.length; i++) if (a[i] * a[i - 1] < 0) k++; return a.length > 1 ? +(k / (a.length - 1)).toFixed(2) : null; };
  const steps = st.slice(1).map((x, i) => Math.round((x - st[i]) * 60));
  const hist = {}; for (const k of steps) hist[k] = (hist[k] || 0) + 1;
  const dts = t.slice(1).map((x, i) => x - t[i]);
  const J = (a, k) => ({ rms: +(rms(d2(a)) * k).toFixed(3), max: +(Math.max(...d2(a).map(Math.abs)) * k).toFixed(3), flips: flips(d2(a)) });
  return { frames: n, secs: +((t[n - 1] - t[0]) / 1000).toFixed(2), fps: +((n - 1) / ((t[n - 1] - t[0]) / 1000)).toFixed(1),
    dtMs: { mean: +(dts.reduce((a, b) => a + b, 0) / dts.length).toFixed(2), max: +Math.max(...dts).toFixed(1) }, stepsPerFrame: hist,
    mode: rows[0][11], cap: rows[0][12],
    judder: { eyeY_mm: J(ey, 1000), originY_mm: J(oy, 1000), eyeRelOriginY_mm: J(rel, 1000), lookPitch_mrad: J(ep, 1000), bodyPitch_mrad: J(op, 1000) } };
}
(async () => {
  const info = { date: new Date().toISOString(), phases: {} };
  await until(`window.BOOT && BOOT.state === 'gone'`, 600000, 'the garage boot');
  await sleep(1500);
  await run(`document.getElementById('bGo').click(); return 1;`);
  await until(`window.BOOT && BOOT.state === 'gone' && /Fly the circuit/.test((document.getElementById('bGo') || {}).textContent || '') && window.FLIGHT_PROBE && FLIGHT_PROBE.model()`, 900000, 'the roll-out');
  await sleep(3000);
  await run(HOOK);
  await run(`FLIGHT_PROBE.camMode('cockpit'); if (window.HEAD_CAM && HEAD_CAM.enter) HEAD_CAM.enter(); return 1;`);
  const rec = async k => {
    await run(`__EJ.rows = []; __EJ.on = true; return 1;`);
    await sleep(SECS * 1000);
    const rows = await run(`__EJ.on = false; return __EJ.rows;`);
    const S = info.phases[k] = stats(rows); S.rows = rows;
    const { rows: _, ...show } = S; console.log(k + ' ' + JSON.stringify(show));
  };
  await rec('stand');
  await run(`document.getElementById('bGo').click(); return 1;`);
  const t0 = Date.now(); let moved = false;
  while (Date.now() - t0 < 90000 && !moved) { await sleep(500); moved = await run(`const v = FLIGHT_PROBE.sim().cgVel(); return Math.hypot(v[0], v[2]) > 3;`); }
  await sleep(1500);
  await rec('taxi');
  const t1 = Date.now(); let up = false;
  while (Date.now() - t1 < 300000 && !up) { await sleep(1000); up = await run(`return (FLIGHT_PROBE.agl() || 0) > 60;`); }
  await rec('climb');
  fs.writeFileSync(OUT, JSON.stringify(info));
  console.log('-> ' + OUT);
})().catch(e => { console.error('eye_judder: ' + (e && e.stack || e)); process.exit(1); });
