#!/usr/bin/env node
// fold_ab.js - C4b's A/B: THE FOLDED FLOWN MODEL AGAINST C4a's DRAWS, SAME FRAME (C4b, G878)
//
// Drives a page kept up by tools/live_driver.js started with Q='fbake=foldab' (every fold keeps its members, on the
// same arrays: FLOWN_BAKE.showFold(false) draws C4a's meshes - the exterior's baked buckets one by one, the cabin's
// live ones - and showFold(true) the folds; the world held, A and B are one frame's two draws). The rig rolls the
// build out itself, then for each STATE (the aeroplane as it stands, with its surfaces deflected and the flex shown at
// x4, rolling on the taxiway, in the air) and each VIEW it shoots A and B back to back, the frame without the
// aeroplane (the reader's mask), and for the orbit views a sub-pixel orbit sequence, A and B interleaved (the shimmer).
// Where a fold could go wrong - a part's bone (the wheels, the castor, the engine unit), a rig's write range (the flex,
// the hinged surfaces, the legs, the struts), the crumb classes - A and B differ; everywhere else they are the same
// pixels. The cost at each camera, A B A B, from the flight recorder (the loop's JS work, the GPU, the draw calls).
//   states: stand (as rolled out), deflect (ailerons, elevator, rudder and flaps at full travel, FLEX x4, held),
//           taxi (paused 14 s into the pilot's taxi: the wheels turned, the legs loaded), air (paused ~12 s after
//           the wheels leave: the wing flexed by the load, x4, the surfaces where the pilot has them)
//   views: stand (orbit, 3/4 front, 9 m), rear (orbit, 3/4 rear, 8 m: the tail's surfaces), wheel (orbit, low,
//          5 m: the gear), chase, mid (25 m), cockpit (the pilot's eye)
// Writes <out>/<state>_<view>_A.png, _B.png, _bg.png, _seq_A|B_<k>.png, and <out>/ab.json; tools/fold_ab.py reads it.
// Usage: node tools/fold_ab.js <cmdPort> <outDir> [steps=8] [stepRad=0.0006]
// A GPU MEASUREMENT: hold tools/perf/boxlock.sh's gpu lock while the driver's page is up.
'use strict';
const fs = require('fs'), path = require('path');
const PORT = +(process.argv[2] || 8572), OUT = path.resolve(process.argv[3] || 'fold_ab'), STEPS = +(process.argv[4] || 8), STEP = +(process.argv[5] || 0.0006);
const ONLY = process.env.STATES ? process.env.STATES.split(',') : null;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (p, body) => { const r = await fetch('http://127.0.0.1:' + PORT + p, { method: 'POST', body }); return r.text(); };
const run = async body => { const t = await post('/run', body); try { return JSON.parse(t); } catch (e) { return t; } };
const shot = async f => { await fetch('http://127.0.0.1:' + PORT + '/shot?f=' + encodeURIComponent(f)); return f; };
const until = async (cond, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await run('return !!(' + cond + ');')) === true) return true; await sleep(500); } throw new Error('timed out: ' + what); };
const BOX = `const P = FLIGHT_PROBE, m = P.model(), cam = P.camera(), R = P.renderer();
  const b = new THREE.Box3().setFromObject(m.grp), c = R.domElement, w = c.clientWidth, h = c.clientHeight;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i = 0; i < 8; i++) { const v = new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(cam);
    if (v.z > 1) continue; const px = (v.x * 0.5 + 0.5) * w, py = (0.5 - v.y * 0.5) * h; x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); }
  return [Math.max(0, Math.floor(x0)), Math.max(0, Math.floor(y0)), Math.min(w, Math.ceil(x1)), Math.min(h, Math.ceil(y1))];`;
const frames = n => run(`await new Promise(r => { let k = ${n}; const f = () => (--k > 0 ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }); return 1;`);
const paused = () => run(`return !!window.FLYDIY_HELD;`);
const pause = async on => { if ((await paused()) !== on) { await run(`document.getElementById('bPause').click(); return 1;`); await frames(4); } };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const info = { states: {}, date: new Date().toISOString(), steps: STEPS, step: STEP };
  // THE ROLL-OUT: the garage boot, then the build rolled out (the page's own button), the screen gone
  await until(`window.BOOT && BOOT.state === 'gone'`, 600000, 'the garage boot');
  await sleep(1500);
  await run(`document.getElementById('bGo').click(); return 1;`);
  await until(`window.BOOT && BOOT.state === 'gone' && BOOT.set === 'rollout' && window.FLIGHT_PROBE && FLIGHT_PROBE.model()`, 900000, 'the roll-out');
  await frames(60);
  info.bake = await run('return window.FLOWN_BAKE && FLOWN_BAKE.FB.last || null;');
  info.merge = await run('return window.FLOWN_BAKE && FLOWN_BAKE.FB.merge || null;');
  info.foldab = await run('return window.FLOWN_BAKE ? !!FLOWN_BAKE.FB.foldAB : null;');
  info.flip = await run('return FLOWN_BAKE.showFold(true);');
  console.log('bake ' + JSON.stringify(info.bake && { hit: info.bake.hit, total: info.bake.total, cm: info.bake.cm, in: info.bake.sets && info.bake.sets.in && info.bake.sets.in.cm }) + ' · merge ' + JSON.stringify(info.merge) + ' · members ' + info.flip);
  if (!(info.flip > 0)) { console.log('no kept members: start live_driver with Q=fbake=foldab'); process.exit(1); }
  await pause(true);
  // the HUD and the panels out of the frame (the canvas and its ancestors stay)
  await run(`const c = document.getElementById('c'); document.querySelectorAll('body *').forEach(e => { if (e !== c && !e.contains(c) && e.id !== 'bPause' && e.id !== 'bSkin') e.style.visibility = 'hidden'; }); return 1;`);
  const VIEWS = {
    stand: { set: `P.camMode('orbit'); P.camSet(0.8, 0.10, 9);`, seq: 'az' },
    rear: { set: `P.camMode('orbit'); P.camSet(2.45, 0.22, 8);`, seq: 'az' },
    wheel: { set: `P.camMode('orbit'); P.camSet(1.35, 0.02, 5);`, seq: null },
    chase: { set: `P.camMode('chase');`, seq: null },
    mid: { set: `P.camMode('orbit'); P.camSet(0.7, 0.12, 25);`, seq: 'az' },
    cockpit: { set: `P.camMode('cockpit'); HEAD_CAM.yaw = 0.95; HEAD_CAM.pitch = 0.42;`, seq: null },
  };
  const STATES = [
    { k: 'stand', views: ['stand', 'rear', 'wheel', 'chase', 'mid', 'cockpit'], cost: true },
    { k: 'deflect', views: ['stand', 'rear', 'wheel'], prep: async () => {
        // full travel on every surface, held: the linkage steps on the frame's own dt while the world is paused
        await run(`const s = FLIGHT_PROBE.sim(); Object.assign(s.ctl, { da: 1, de: -0.8, dr: 0.9, flap: 1 }); return 1;`);
        await run(`document.getElementById('bSkin').click(); return 1;`);   // FLEX x4 (skinMode 1)
        await frames(120);
      }, done: async () => { await run(`document.getElementById('bSkin').click(); document.getElementById('bSkin').click(); document.getElementById('bSkin').click();
        const s = FLIGHT_PROBE.sim(); Object.assign(s.ctl, { da: 0, de: 0, dr: 0, flap: 0 }); return 1;`); await frames(60); } },
    { k: 'taxi', views: ['chase', 'wheel', 'stand'], prep: async () => {
        await pause(false);
        await run(`document.getElementById('bGo').click(); return 1;`);
        const t0 = Date.now(); let moved = false;
        while (Date.now() - t0 < 90000 && !moved) { await sleep(1000); moved = await run(`const v = FLIGHT_PROBE.sim().cgVel(); return Math.hypot(v[0], v[2]) > 2.5;`); }
        await sleep(6000);
        await pause(true);
      }, cost: true },
    { k: 'air', views: ['chase', 'stand', 'rear'], prep: async () => {
        await pause(false);
        const t0 = Date.now(); let up = false;
        while (Date.now() - t0 < 240000 && !up) { await sleep(1000); up = await run(`return (FLIGHT_PROBE.agl() || 0) > 25;`); }
        await sleep(8000);
        await pause(true);
        await run(`document.getElementById('bSkin').click(); return 1;`);   // FLEX x4
        await frames(10);
      }, cost: true },
  ];
  for (const St of STATES) {
    if (ONLY && !ONLY.includes(St.k)) { if (St.prep && (St.k === 'taxi' || St.k === 'air') && ONLY.some(k => STATES.findIndex(q => q.k === k) > STATES.findIndex(q => q.k === St.k))) await St.prep(); continue; }
    if (St.prep) await St.prep();
    const S = info.states[St.k] = { views: {}, pose: await run(`const s = FLIGHT_PROBE.sim(), c = s.cgPos(), v = s.cgVel(); return { cg: c.map(x => +x.toFixed(2)), v: +Math.hypot(v[0], v[1], v[2]).toFixed(2), agl: +(FLIGHT_PROBE.agl() || 0).toFixed(1), ctl: { da: s.ctl.da, de: s.ctl.de, dr: s.ctl.dr, flap: s.ctl.flap } };`) };
    console.log('state ' + St.k + ' ' + JSON.stringify(S.pose));
    for (const vk of St.views) {
      const V = VIEWS[vk], tag = St.k + '_' + vk;
      await run('const P = FLIGHT_PROBE; ' + V.set + ' return 1;');
      await frames(40); await sleep(300);
      const box = await run(BOX);
      const cam0 = await run('return FLIGHT_PROBE.cam();');
      // B as played: in the cockpit the cabin flies its live shader (the fold's swap), so only the exterior's folds flip
      const flip = on => vk === 'cockpit' ? `FLOWN_BAKE.showFold(false, 'in'); FLOWN_BAKE.showFold(${on}, 'ext');` : `FLOWN_BAKE.showFold(${on});`;
      const one = async (t, on) => { await run(flip(on) + ' return 1;'); await frames(6); await sleep(120); return shot(path.join(OUT, tag + '_' + t + '.png')); };
      await one('A', false); await one('B', true);
      await run('FLIGHT_PROBE.model().grp.visible = false; return 1;'); await frames(6); await sleep(120);
      await shot(path.join(OUT, tag + '_bg.png'));
      await run('FLIGHT_PROBE.model().grp.visible = true; return 1;');
      const v = S.views[vk] = { box, cam: cam0, seq: 0 };
      if (St.cost && (vk === 'chase' || vk === 'stand')) {
        v.cost = { A: [], B: [] };
        for (const side of ['A', 'B', 'A', 'B']) {
          await run(flip(side === 'B') + ' return 1;'); await frames(30);
          v.cost[side].push(await run(`const g = [], w = [], c = [], r = []; const t0 = performance.now();
            while (performance.now() - t0 < 3000) { await new Promise(q => setTimeout(q, 250)); const s = FLIGHT_REC.stats(250); if (s.gpu === s.gpu) g.push(s.gpu); w.push(s.work); c.push(s.fps); if (s.render === s.render) r.push(s.render); }
            const m = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
            return { gpu: m(g), work: m(w), fps: m(c), render: m(r), calls: FLIGHT_PROBE.renderer().info.render.calls };`));
        }
      }
      if (V.seq && STEPS > 1) {
        const a0 = cam0.az;
        for (let s = 0; s < STEPS; s++) {
          await run(`FLIGHT_PROBE.camSet(${a0 + s * STEP}, ${cam0.el}, ${cam0.dist}); return 1;`);
          await one('seq_A_' + String(s).padStart(2, '0'), false);
          await one('seq_B_' + String(s).padStart(2, '0'), true);
        }
        v.seq = STEPS;
      }
      console.log('  ' + tag + ' box ' + JSON.stringify(box) + (v.cost ? ' cost ' + JSON.stringify(v.cost) : ''));
    }
    if (St.done) await St.done();
    await run('FLOWN_BAKE.showFold(true); FLIGHT_PROBE.camMode("chase"); return 1;');
  }
  info.mem = await run('const R = FLIGHT_PROBE.renderer(); return { textures: R.info.memory.textures, geometries: R.info.memory.geometries, programs: R.info.programs.length, heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null, bakeMB: +(FLOWN_BAKE.bytes / 1048576).toFixed(1) };');
  fs.writeFileSync(path.join(OUT, 'ab.json'), JSON.stringify(info, null, 1));
  console.log('-> ' + path.join(OUT, 'ab.json') + ' ' + JSON.stringify(info.mem));
})().catch(e => { console.error('fold_ab: ' + (e && e.stack || e)); process.exit(1); });
