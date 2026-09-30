#!/usr/bin/env node
// cockpit_ab.js - THE COCKPIT FROM THE PILOT'S EYE: THE BAKE ON AGAINST OFF, AND THE DIALS AGAINST THE SIM (C4b, 2026-09-29)
//
// Drives a page kept up by tools/live_driver.js started with Q='fbake=ab' (every baked mesh keeps its live material
// beside the bake: FLOWN_BAKE.show(false) flies the live shader, show(true) the bake - one frame's two draws, the world
// held). The rig rolls the build out itself, then for each STATE (the stand at idle, the taxi, the climb, the climb at
// dusk) it looks from the pilot's head (the eye's matrix frozen: it sways every frame, held or not) and shoots:
//   <state>_<view>_OFF.png / _ON.png   the live shader / the bake, same frame (views: panel = the dials, side = the wing
//                                      through the side window, the stand only)
//   and reads THE DIALS: for every hand on the panel its drive's number (the cockpit's lagged reading, what the hand is
//   posed from), the sim's own number, the hand's angle MEASURED off its quaternion and turned back into a value
//   through the dial's own scale (c.stops, c.rest: G442's rest-twice rule), and where the dial sits on the screen.
// In the cockpit the cabin flies its live shader anyway (the fold's view(on)); the faces, the hands, the glass and the
// lamps are never baked - so ON and OFF differ only where the exterior shows (the cowl, the wing, the struts).
// Writes <out>/<state>_<view>_OFF|ON.png and <out>/cockpit.json; tools/cockpit_ab.py makes the evidence sheets.
// Usage: node tools/cockpit_ab.js <cmdPort> <outDir>
// A GPU MEASUREMENT: hold tools/perf/boxlock.sh's gpu lock while the driver's page is up.
'use strict';
const fs = require('fs'), path = require('path');
const PORT = +(process.argv[2] || 8572), OUT = path.resolve(process.argv[3] || 'cockpit_ab');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (p, body) => { const r = await fetch('http://127.0.0.1:' + PORT + p, { method: 'POST', body }); return r.text(); };
const run = async body => { const t = await post('/run', body); try { return JSON.parse(t); } catch (e) { return t; } };
const shot = async f => { await fetch('http://127.0.0.1:' + PORT + '/shot?f=' + encodeURIComponent(f)); return f; };
const until = async (cond, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await run('return !!(' + cond + ');')) === true) return true; await sleep(500); } throw new Error('timed out: ' + what); };
const frames = n => run(`await new Promise(r => { let k = ${n}; const f = () => (--k > 0 ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }); return 1;`);
const paused = () => run(`return !!window.FLYDIY_HELD;`);
const pause = async on => { if ((await paused()) !== on) { await run(`document.getElementById('bPause').click(); return 1;`); await frames(4); } };
// THE DIALS, read on the page: every lin / turn / card hand of the panel
const READ = `const CK = window.FLYDIY_COCKPIT_I, s = FLIGHT_PROBE.sim(), o = s.out || {}, cam = FLIGHT_PROBE.camera(), R = CK.readings;
  const c0 = FLIGHT_PROBE.renderer().domElement, W = c0.clientWidth, H = c0.clientHeight, D = 180 / Math.PI;
  const inv = (stops, a) => {            // the dial's own scale turned round: an angle (deg) -> the value it marks
    for (let i = 0; i + 1 < stops.length; i++) { const [v0, a0] = stops[i], [v1, a1] = stops[i + 1];
      if ((a - a0) * (a - a1) <= 0 && a1 !== a0) return v0 + (v1 - v0) * (a - a0) / (a1 - a0); }
    const f = stops[0], l = stops[stops.length - 1]; return Math.abs(a - f[1]) < Math.abs(a - l[1]) ? f[0] : l[0]; };
  const g = [], v = new THREE.Vector3();
  for (const G of (CK.model && CK.model.gauges) || []) {
    const c = G.c, q = G.obj && G.obj.quaternion; if (!q || !c.ax || !['lin', 'turn', 'card'].includes(c.law)) continue;
    const n = Math.hypot(c.ax[0], c.ax[1], c.ax[2]) || 1, sg = c.sgn || 1;
    const th = 2 * Math.atan2((q.x * c.ax[0] + q.y * c.ax[1] + q.z * c.ax[2]) / n, q.w);   // the hand's turn about its axis
    const L = sg * th + (c.rest || 0);                                                            // the law's angle (rad)
    const val = R[c.drive];
    let needle = null;
    if (c.law === 'lin' && c.stops) needle = inv(c.stops, L * D);
    else if (c.law === 'turn') { const per = c.perSI || 1; needle = (((L / (2 * Math.PI)) % 1) + 1) % 1 * per; }
    else if (c.law === 'card') needle = ((L * D) % 360 + 360) % 360;
    G.obj.getWorldPosition(v); v.project(cam);
    g.push({ gauge: c.gauge, hand: c.hand || null, law: c.law, drive: c.drive, per: c.perSI || null,
      reading: val == null ? null : +(+val).toFixed(4), needle: needle == null ? null : +needle.toFixed(4),
      stops: c.stops ? [c.stops[0], c.stops[c.stops.length - 1]] : null,
      px: v.z < 1 ? [+((v.x * 0.5 + 0.5) * W).toFixed(1), +((0.5 - v.y * 0.5) * H).toFixed(1)] : null });
  }
  const cg = s.cgPos(), vel = s.cgVel(), E = (s.eng && s.eng[0]) || {};
  return { gauges: g, W, H,
    sim: { V: +(o.V || 0).toFixed(3), Veas: o.Veas == null ? null : +o.Veas.toFixed(3), altMSL: +cg[1].toFixed(2), qnh: CK.qnh, agl: +(FLIGHT_PROBE.agl() || 0).toFixed(2),
      vs: +(o.vs || 0).toFixed(3), rpmEng: o.rpmEng ? +(+o.rpmEng[0]).toFixed(1) : null, rpmProp: o.rpm ? +(+o.rpm[0]).toFixed(1) : null, hdg: +(o.hdg || 0).toFixed(3),
      roll: +(o.roll || 0).toFixed(4), pitch: +(o.pitch || 0).toFixed(4), gs: +Math.hypot(vel[0], vel[2]).toFixed(2), running: !!E.running, flap: s.ctl ? s.ctl.flap : null,
      fuel: s.fuel ? { kind: s.fuel.kind, litres: s.fuel.litres, soc: s.fuel.soc, frac: s.fuel.frac } : null },
    readings: Object.fromEntries(Object.entries(R).map(([k, x]) => [k, typeof x === 'number' ? +x.toFixed(4) : x])),
    lights: { dim: CK.dimNow == null ? null : +CK.dimNow.toFixed(3), sw: Object.fromEntries(Object.entries(CK.sw || {}).filter(([k]) => /^sw_/.test(k))) },
    day: window.DAY_CLOCK && DAY_CLOCK.label ? DAY_CLOCK.label() : null, cam: FLIGHT_PROBE.cam() };`;
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const info = { states: {}, date: new Date().toISOString() };
  // THE ROLL-OUT: the garage boot, then the build rolled out (the page's own button), the screen gone
  await until(`window.BOOT && BOOT.state === 'gone'`, 600000, 'the garage boot');
  await sleep(1500);
  await run(`document.getElementById('bGo').click(); return 1;`);
  await until(`window.BOOT && BOOT.state === 'gone' && /Fly the circuit/.test((document.getElementById('bGo') || {}).textContent || '') && window.FLIGHT_PROBE && FLIGHT_PROBE.model() && window.FLYDIY_COCKPIT_I && FLYDIY_COCKPIT_I.model`, 900000, 'the roll-out');
  await frames(90); await sleep(3000);   // the gauges' lags settle (they run in frame time)
  info.bake = await run('return window.FLOWN_BAKE && FLOWN_BAKE.FB.last || null;');
  // THE HYBRID (the default since 2026-09-30): the cockpit flies the live meshes by its rule, and FB.hyForce holds the
  // bake (0) or the live meshes (1) for one frame's two draws; a ?fbake=ab page flips its live twins instead
  info.hybrid = await run('return !!(FLOWN_BAKE.FB.hybrid && FLOWN_BAKE.folds && FLOWN_BAKE.folds().length);');
  info.twins = info.hybrid ? 0 : await run('return FLOWN_BAKE.show(true);');
  info.build = await run('const s = window.GARAGE_SPEC && GARAGE_SPEC.spec ? GARAGE_SPEC.spec() : null; return s && (s.name || s.id) || null;');
  console.log('bake ' + JSON.stringify(info.bake && { hit: info.bake.hit, total: info.bake.total }) + ' · live twins ' + info.twins);
  if (!info.hybrid && !(info.twins > 0)) { console.log('no hybrid folds and no live twins: start live_driver with Q=fbake=ab'); process.exit(1); }
  const flipJs = on => info.hybrid ? 'FLOWN_BAKE.FB.hyForce = ' + (on ? 0 : 1) + ';' : 'FLOWN_BAKE.show(' + on + ');';
  await pause(true);
  // the HUD and the panels out of the frame (the canvas and its ancestors stay)
  await run(`const c = document.getElementById('c'); document.querySelectorAll('body *').forEach(e => { if (e !== c && !e.contains(c) && e.id !== 'bPause') e.style.visibility = 'hidden'; }); return 1;`);
  await run(`FLIGHT_PROBE.camMode('cockpit'); return 1;`);
  const VIEWS = { panel: [0, -22], side: [1.05, -8] };   // HEAD_CAM yaw (rad) and pitch (deg, down negative)
  const STATES = [
    { k: 'stand', views: ['panel', 'side'] },
    { k: 'taxi', views: ['panel'], prep: async () => {
        await pause(false);
        await run(`document.getElementById('bGo').click(); return 1;`);
        const t0 = Date.now(); let moved = false;
        while (Date.now() - t0 < 90000 && !moved) { await sleep(1000); moved = await run(`const v = FLIGHT_PROBE.sim().cgVel(); return Math.hypot(v[0], v[2]) > 3;`); }
        await sleep(5000);
        await pause(true);
      } },
    { k: 'climb', views: ['panel'], prep: async () => {
        await pause(false);
        const t0 = Date.now(); let up = false;
        while (Date.now() - t0 < 240000 && !up) { await sleep(1000); up = await run(`return (FLIGHT_PROBE.agl() || 0) > 120;`); }
        await sleep(4000);
        await pause(true);
      } },
    { k: 'dusk', views: ['panel'], prep: async () => {
        // the hour only (the weather stays the day's); the pilot's lights rule lights the panel from sunset, and it
        // runs in the cockpit's frame - so the sim runs 4 s for the lights, the exposure and the env to follow
        await run(`DAY_CLOCK.preset('dusk'); return DAY_CLOCK.label();`);
        await pause(false); await sleep(4000); await pause(true);
        await frames(30);
      } },
  ];
  for (const St of STATES) {
    if (St.prep) await St.prep();
    const S = info.states[St.k] = { views: {} };
    for (const vk of St.views) {
      const [yaw, pit] = VIEWS[vk], tag = St.k + '_' + vk;
      await run(`FLIGHT_PROBE.camMode('cockpit'); HEAD_CAM.yaw = ${yaw}; HEAD_CAM.pitch = ${pit * Math.PI / 180}; return 1;`);
      await frames(40); await sleep(300);
      // THE COCKPIT'S EYE SWAYS every frame, the world held or not (C4a's trap): its matrix frozen as it stands, in the
      // scene's onBeforeRender (after three's camera update, before the frustum and the draws), so OFF and ON are one frame
      await run(`const S = WORLD.scene, cam = FLIGHT_PROBE.camera();
        window.__CKF = { M0: cam.matrixWorld.clone(), prev: S.onBeforeRender };
        S.onBeforeRender = (r, s, c) => { if (c !== cam) return; c.matrixWorld.copy(__CKF.M0); c.matrixWorldInverse.copy(__CKF.M0).invert(); };
        return 1;`);
      await frames(4);
      const one = async (t, on) => { await run(flipJs(on) + ' return 1;'); await frames(6); await sleep(150); return shot(path.join(OUT, tag + '_' + t + '.png')); };
      await one('OFF', false); await one('ON', true);
      S.views[vk] = await run(READ);
      await run('WORLD.scene.onBeforeRender = __CKF.prev; return 1;');
      const d = S.views[vk];
      console.log('  ' + tag + ' ' + JSON.stringify({ sim: { V: d.sim.V, agl: d.sim.agl, vs: d.sim.vs, rpm: d.sim.rpmEng }, day: d.day, dim: d.lights.dim }));
      for (const G of d.gauges) console.log('    ' + (G.gauge + '.' + (G.hand || '')).padEnd(18) + ' ' + String(G.drive).padEnd(8) + ' reading ' + String(G.reading).padEnd(10) + ' needle ' + G.needle);
    }
  }
  await run(info.hybrid ? 'FLOWN_BAKE.FB.hyForce = null; return 1;' : 'FLOWN_BAKE.show(true); return 1;');
  fs.writeFileSync(path.join(OUT, 'cockpit.json'), JSON.stringify(info, null, 1));
  console.log('-> ' + path.join(OUT, 'cockpit.json'));
})().catch(e => { console.error('cockpit_ab: ' + (e && e.stack || e)); process.exit(1); });
