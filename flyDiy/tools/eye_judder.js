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
// G1100 (POSE-SMOOTH): the second difference per FRAME counts a frame shown twice as long (a 33 ms frame after a
// 16.7 ms one, the aeroplane moved 2 steps) as judder although the motion is right for the time it covers. So each row
// also carries the frame's rAF timestamp (the vsync the frame clock owes its steps against; requestAnimationFrame
// wrapped, nothing else changed), the steps the clock owed, the drawn pose's alpha (FLYDIY_POSE, G1100) and whether the
// physics worker flies it; and `judderTs` is the change of VELOCITY from frame to frame over the frames' own
// timestamps, as mm over a 60th of a second (equal to the second difference where the frames are even): a pose drawn at
// the right time for its frame moves at the aeroplane's speed whatever the frame's length and reads the aeroplane's
// own (its accelerations); a pose that is a step ahead on one frame and not the next reads the step. The eye is taken
// vertical (Y, C4b's) and horizontal (XZ: the taxi's and the climb's motion is mostly along the track).
// Usage: node tools/eye_judder.js <cmdPort> <out.json> [secs=5] [cockpit|chase]
// A GPU MEASUREMENT: hold tools/perf/boxlock.sh's gpu lock while the driver's page is up.
'use strict';
const fs = require('fs'), path = require('path');
const PORT = +(process.argv[2] || 8572), OUT = path.resolve(process.argv[3] || 'eye_judder.json'), SECS = +(process.argv[4] || 5);
const VIEW = process.argv[5] === 'chase' ? 'chase' : 'cockpit';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (p, body) => { const r = await fetch('http://127.0.0.1:' + PORT + p, { method: 'POST', body }); return r.text(); };
const run = async body => { const t = await post('/run', body); try { return JSON.parse(t); } catch (e) { return t; } };
const until = async (cond, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await run('return !!(' + cond + ');')) === true) return true; await sleep(500); } throw new Error('timed out: ' + what); };
const HOOK = `if (!window.__EJ) {
    const R = FLIGHT_PROBE.renderer(), orig = R.render, E = window.__EJ = { on: false, fresh: false, rows: [], ts: 0 };
    const raf0 = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = cb => raf0(ts => { E.ts = ts; return cb(ts); });   // G1100: the frame's own timestamp
    const tick = () => { E.fresh = true; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
    const f = new THREE.Vector3();
    R.render = function (scene, cam) {
      if (E.on && E.fresh && cam === FLIGHT_PROBE.camera() && window.WORLD && scene === WORLD.scene) {
        E.fresh = false;
        const s = FLIGHT_PROBE.sim(), m = FLIGHT_PROBE.model(), o = s.bodyOrigin(), ax = s.axes(), e = cam.matrixWorld.elements, g = m && m.grp ? m.grp.matrixWorld.elements : null;
        cam.getWorldDirection(f);
        const PS = window.FLYDIY_PACE && FLYDIY_PACE.state ? FLYDIY_PACE.state() : null, PO = window.FLYDIY_POSE ? FLYDIY_POSE.state() : null;
        E.rows.push([performance.now(), s.t, e[12], e[13], e[14], Math.asin(Math.max(-1, Math.min(1, f.y))), o[0], o[1], o[2], Math.asin(Math.max(-1, Math.min(1, -ax[0][1]))),
          g ? g[13] : null, FLIGHT_PROBE.camModeNow ? FLIGHT_PROBE.camModeNow() : null, PS ? PS.cap : null,
          E.ts, PS ? PS.steps : null, PO ? (PO.on ? 1 : 0) : null, PO ? PO.alpha : null, PS ? (PS.simw ? 1 : 0) : null]);
      }
      return orig.apply(this, arguments);
    };
  } return 1;`;
function stats(rows) {
  const n = rows.length, col = i => rows.map(r => r[i]);
  const t = col(0), st = col(1), ex = col(2), ey = col(3), ez = col(4), ep = col(5), oy = col(7), op = col(9), ts = col(13);
  const rel = ey.map((y, i) => y - oy[i]);
  const d2 = a => a.slice(2).map((x, i) => x - 2 * a[i + 1] + a[i]);
  const rms = a => a.length ? Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length) : null;
  const flips = a => { let k = 0; for (let i = 1; i < a.length; i++) if (a[i] * a[i - 1] < 0) k++; return a.length > 1 ? +(k / (a.length - 1)).toFixed(2) : null; };
  const steps = st.slice(1).map((x, i) => Math.round((x - st[i]) * 60));
  const hist = a => { const h = {}; for (const k of a) h[k] = (h[k] || 0) + 1; return h; };
  const dts = t.slice(1).map((x, i) => x - t[i]);
  const J = (a, k) => ({ rms: +(rms(d2(a)) * k).toFixed(3), max: +(Math.max(...d2(a).map(Math.abs)) * k).toFixed(3), flips: flips(d2(a)) });
  // G1100: the velocity's change frame to frame over the frames' timestamps, x a 60th (m -> mm by k)
  const haveTs = ts.every(x => typeof x === 'number' && x > 0);
  const dv = (a, b) => {   // a, b: one or two series (b: the horizontal pair's second)
    const out = [];
    for (let i = 2; i < n; i++) {
      const h1 = ts[i - 1] - ts[i - 2], h2 = ts[i] - ts[i - 1];
      if (!(h1 > 0 && h2 > 0)) continue;
      const va = (a[i] - a[i - 1]) / h2 - (a[i - 1] - a[i - 2]) / h1;
      const vb = b ? (b[i] - b[i - 1]) / h2 - (b[i - 1] - b[i - 2]) / h1 : 0;
      out.push((b ? Math.hypot(va, vb) : va) * (1000 / 60));
    }
    return out;
  };
  const JT = (d, k) => d.length ? { rms: +(rms(d) * k).toFixed(3), max: +(Math.max(...d.map(Math.abs)) * k).toFixed(3) } : null;
  const tsIv = haveTs ? ts.slice(1).map((x, i) => x - ts[i]) : [];
  const out = { frames: n, secs: +((t[n - 1] - t[0]) / 1000).toFixed(2), fps: +((n - 1) / ((t[n - 1] - t[0]) / 1000)).toFixed(1),
    dtMs: { mean: +(dts.reduce((a, b) => a + b, 0) / dts.length).toFixed(2), max: +Math.max(...dts).toFixed(1) }, stepsPerFrame: hist(steps),
    mode: rows[0][11], cap: rows[0][12], simw: rows[0][17], poseOn: rows.filter(r => r[15] === 1).length, alpha: hist(rows.map(r => r[16] == null ? 'na' : (+r[16]).toFixed(2))),
    tsRefreshes: haveTs ? hist(tsIv.map(x => +(x / (1000 / 60)).toFixed(1))) : null,
    judder: { eyeY_mm: J(ey, 1000), originY_mm: J(oy, 1000), eyeRelOriginY_mm: J(rel, 1000), lookPitch_mrad: J(ep, 1000), bodyPitch_mrad: J(op, 1000) } };
  if (haveTs) out.judderTs = { eyeY_mm: JT(dv(ey), 1000), eyeXZ_mm: JT(dv(ex, ez), 1000), originY_mm: JT(dv(oy), 1000), eyeRelOriginY_mm: JT(dv(rel), 1000),
    lookPitch_mrad: JT(dv(ep), 1000), bodyPitch_mrad: JT(dv(op), 1000) };
  return out;
}
(async () => {
  const info = { date: new Date().toISOString(), view: VIEW, phases: {} };
  await until(`window.BOOT && BOOT.state === 'gone'`, 600000, 'the garage boot');
  await sleep(1500);
  await run(`document.getElementById('bGo').click(); return 1;`);
  await until(`window.BOOT && BOOT.state === 'gone' && /Fly the circuit/.test((document.getElementById('bGo') || {}).textContent || '') && window.FLIGHT_PROBE && FLIGHT_PROBE.model()`, 900000, 'the roll-out');
  await sleep(3000);
  await run(HOOK);
  if (VIEW === 'cockpit') await run(`FLIGHT_PROBE.camMode('cockpit'); if (window.HEAD_CAM && HEAD_CAM.enter) HEAD_CAM.enter(); return 1;`);
  else await run(`FLIGHT_PROBE.camMode('chase'); return 1;`);
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
  // G1100: the worker view's ring (its delay, the frames it drew, those starved of a successor and those before its oldest)
  info.ring = await run(`const s = window.FLYDIY_SIMW && FLYDIY_SIMW.state ? FLYDIY_SIMW.state() : null; return s ? s.ring || null : null;`);
  console.log('ring ' + JSON.stringify(info.ring));
  fs.writeFileSync(OUT, JSON.stringify(info));
  console.log('-> ' + OUT);
})().catch(e => { console.error('eye_judder: ' + (e && e.stack || e)); process.exit(1); });
