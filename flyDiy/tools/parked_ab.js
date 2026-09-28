#!/usr/bin/env node
// parked_ab.js - THE PARKED COOK'S A/B: THE LIVE CAPTURE vs THE COOK, SAME FRAME (G805, C0b)
//
// Drives a page kept up by tools/live_driver.js (the cook ON: the default). The rig rolls out (the page's own button),
// pauses, and for each cooked key the world parks: the placement nearest the stand is found (its rungs must be the
// COOK's - userData.cooked), the key is captured and baked LIVE beside it (PARKED.abLive: the editor round trip and the
// G569 bake, exactly what a roll-out without the cook runs), and the placement's three baked meshes are switched between
// the two - A the live capture, B the cook - at one frozen camera (scene.onBeforeRender, fbake_ab's way):
//   views: near (12 m, 3/4 front, rung L1), mid (45 m, rung L1), far (170 m, rung L2); each a STILL pair and a SLOW PAN
//   (the camera turned about its own up axis a sub-pixel step at a time, A and B at each step), plus the frame without
//   the aeroplane (the reader's mask).
// And the bytes, which say more than any picture: each atlas's texels A against B (how many differ, the mean and the
// largest difference), each rung's positions (L2 / L3 should be bit-identical, L1 within the half step the container
// quantizes to), the stance and the hitbox.
// Writes <out>/<key>_<view>_A.png, _B.png, _bg.png, _seq_A|B_<k>.png, <out>/ab.json (views as fbake_ab.py reads them,
// with labels) and <out>/bytes.json; then: python tools/fbake_ab.py <out> gives the mean |A-B| on the aeroplane, the
// pan's shimmer per side, the side-by-sides and the GIFs.
// Usage: node tools/parked_ab.js <cmdPort> <outDir> [steps=16] [stepRad=0.0006]
// A GPU MEASUREMENT: hold tools/perf/boxlock.sh's gpu lock while it runs (the driver's page is the GPU user).
'use strict';
const fs = require('fs'), path = require('path');
const PORT = +(process.argv[2] || 8572), OUT = path.resolve(process.argv[3] || 'parked_ab'), STEPS = +(process.argv[4] || 16), STEP = +(process.argv[5] || 0.0006);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (p, body) => { const r = await fetch('http://127.0.0.1:' + PORT + p, { method: 'POST', body }); return r.text(); };
const run = async body => { const t = await post('/run', body); if (/^ERR /.test(t)) throw new Error(t.slice(0, 400)); try { return JSON.parse(t); } catch (e) { return t; } };
const shot = async f => { await fetch('http://127.0.0.1:' + PORT + '/shot?f=' + encodeURIComponent(f)); return f; };
const frames = n => run(`await new Promise(r => { let k = ${n}; const f = () => (--k > 0 ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }); return 1;`);
const until = async (expr, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await run('return !!(' + expr + ');') === true) return; } catch (e) {} await sleep(1000); } throw new Error('timed out waiting for ' + what); };
const VIEWS = [{ k: 'near', d: 12, az: 0.75, el: 0.12 }, { k: 'mid', d: 45, az: 0.6, el: 0.1 }, { k: 'far', d: 170, az: 0.55, el: 0.08 }];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const info = { labels: ['A live capture', 'B cooked'], views: {}, keys: {}, date: new Date().toISOString(), steps: STEPS, step: STEP };
  // THE ROLL-OUT: the garage boot, the build rolled out (the page's own button), the screen gone
  await until(`window.BOOT && BOOT.state === 'gone'`, 600000, 'the garage boot');
  await run(`document.getElementById('bGo').click(); return 1;`);
  await until(`window.BOOT && BOOT.state === 'gone' && BOOT.set === 'rollout' && window.FLIGHT_PROBE && FLIGHT_PROBE.model()`, 900000, 'the roll-out');
  await frames(30);
  if (!(await run('return !!window.FLYDIY_HELD;'))) { await run(`document.getElementById('bPause').click(); return 1;`); await frames(4); }
  info.bootParked = await run(`return (BOOT.log || []).filter(e => e.k === 'parked');`);
  await run(`const c = document.getElementById('c'); document.querySelectorAll('body *').forEach(e => { if (e !== c && !e.contains(c) && e.id !== 'bPause') e.style.visibility = 'hidden'; }); return 1;`);
  // the placements: the one nearest the stand per key
  const found = await run(`const S = WORLD.scene, me = new THREE.Vector3(); FLIGHT_PROBE.model().grp.getWorldPosition(me);
    const best = {}; S.traverse(o => { if (!o.isLOD || !o.userData || typeof o.userData.parked !== 'string') return; /* animal_run.js's userData.parked is a boolean */ const p = new THREE.Vector3(); o.getWorldPosition(p);
      const d = p.distanceTo(me), k = o.userData.parked; if (!best[k] || d < best[k].d) best[k] = { d, o }; });
    window.__PAB = { lods: {}, prev: S.onBeforeRender, M: null };
    const out = {}; for (const k in best) { __PAB.lods[k] = best[k].o; out[k] = { d: Math.round(best[k].d), cooked: !!best[k].o.userData.cooked }; }
    const cam = FLIGHT_PROBE.camera();
    S.onBeforeRender = (r, s, c) => { if (c !== cam || !__PAB.M) return; c.matrixWorld.copy(__PAB.M); c.matrixWorldInverse.copy(__PAB.M).invert(); };
    return out;`);
  console.log('placements ' + JSON.stringify(found));
  const keys = Object.keys(found).filter(k => found[k].cooked);
  if (!keys.length) throw new Error('no cooked placement: is the cook stale for this build? ' + JSON.stringify(info.bootParked));
  for (const key of keys) {
    const K = JSON.stringify(key), tag = key.replace(/\W+/g, '_');
    // the live twin, and the bytes compared
    const bytes = await run(`const key = ${K}, lod = __PAB.lods[key], rec = PARKED.records[key];
      const t0 = performance.now(); const L = await PARKED.abLive(key); const ms = Math.round(performance.now() - t0);
      if (!L) return null;
      const meshes = [0, 1, 2].map(i => { let m = null; lod.levels[i].object.traverse(o => { if (o.isMesh && o.name === 'parked:baked') m = o; }); return m; });
      __PAB.sw = { meshes, cook: meshes.map(m => [m.geometry, m.material]), live: meshes.map((m, i) => [L.bk.geos[i], L.bk.mat]) };
      const tx = s => { const m = s.mat; return [m.map, m.normalMap, m.roughnessMap].map(t => t.image.data); };
      const C = tx(rec.baked), A = tx(L.bk);
      const atlas = C.map((c, j) => { let n = 0, sum = 0, mx = 0; for (let i = 0; i < c.length; i++) { const d = Math.abs(c[i] - A[j][i]); if (d) { n++; sum += d; if (d > mx) mx = d; } }
        return { differ: n, share: +(n / c.length).toFixed(6), meanAbs: +(sum / c.length).toFixed(5), max: mx }; });
      const geo = [0, 1, 2].map(i => { const a = rec.baked.geos[i].attributes, b = L.bk.geos[i].attributes;
        if (a.position.count !== b.position.count) return { count: [a.position.count, b.position.count] };
        let dp = 0, du = 0, dn = 0; for (let j = 0; j < a.position.array.length; j++) dp = Math.max(dp, Math.abs(a.position.array[j] - b.position.array[j]));
        for (let j = 0; j < a.uv.array.length; j++) du = Math.max(du, Math.abs(a.uv.array[j] - b.uv.array[j]));
        for (let j = 0; j < a.normal.array.length; j++) dn = Math.max(dn, Math.abs(a.normal.array[j] - b.normal.array[j]));
        const ia = rec.baked.geos[i].index.array, ib = L.bk.geos[i].index.array; let di = ia.length === ib.length ? 0 : -1; if (!di) for (let j = 0; j < ia.length; j++) if (ia[j] !== ib[j]) di++;
        return { verts: a.position.count, maxPosM: dp, maxUv: du, maxNrm: dn, idxDiffer: di }; });
      const hb = JSON.stringify(rec.hitbox) === JSON.stringify(L.hitbox);
      return { liveMs: ms, cookMs: rec.t, atlas, geo, stance: { cooked: rec.stance, live: L.stance, dPitch: Math.abs(rec.stance.pitch - L.stance.pitch), dLift: Math.abs(rec.stance.lift - L.stance.lift) }, hitboxSame: hb,
               tris: [rec.baked.tris, L.bk.tris] };`);
    if (!bytes) { console.log(key + ': no live twin'); continue; }
    info.keys[key] = bytes;
    console.log(key + ' bytes ' + JSON.stringify(bytes));
    const side = s => run(`__PAB.sw.meshes.forEach((m, i) => { const [g, mt] = __PAB.sw[${s ? "'cook'" : "'live'"}][i]; m.geometry = g; m.material = mt; }); return 1;`);
    for (const V of VIEWS) {
      const vk = tag + '_' + V.k;
      // the pose: from the aeroplane's nose side, V.d metres out, looking at its middle; `pan` turns the view about up
      await run(`const lod = __PAB.lods[${K}], P = new THREE.Vector3(); lod.getWorldPosition(P);
        const yaw = lod.parent ? lod.parent.rotation.y : 0, a = yaw + ${V.az}, T = P.clone().add(new THREE.Vector3(0, 1.2, 0));
        const E = T.clone().add(new THREE.Vector3(Math.cos(a) * ${V.d} * Math.cos(${V.el}), ${V.d} * Math.sin(${V.el}), -Math.sin(a) * ${V.d} * Math.cos(${V.el})));
        __PAB.E = E; __PAB.T = T;
        __PAB.pose = pan => { const m = new THREE.Matrix4().lookAt(E, T, new THREE.Vector3(0, 1, 0)); m.multiply(new THREE.Matrix4().makeRotationY(pan)); m.setPosition(E); __PAB.M = m; };
        __PAB.pose(0); return 1;`);
      await frames(20); await sleep(200);
      const box = await run(`const cam = FLIGHT_PROBE.camera(), R = FLIGHT_PROBE.renderer(), c = R.domElement, w = c.clientWidth, h = c.clientHeight, lod = __PAB.lods[${K}];
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const pan of [0, ${STEP * (STEPS - 1)}]) { __PAB.pose(pan); cam.matrixWorld.copy(__PAB.M); cam.matrixWorldInverse.copy(__PAB.M).invert();
          const b = new THREE.Box3().setFromObject(lod.levels[0].object);
          for (let i = 0; i < 8; i++) { const v = new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(cam);
            if (v.z > 1) continue; const px = (v.x * 0.5 + 0.5) * w, py = (0.5 - v.y * 0.5) * h; x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); } }
        __PAB.pose(0);
        return [Math.max(0, Math.floor(x0)), Math.max(0, Math.floor(y0)), Math.min(w, Math.ceil(x1)), Math.min(h, Math.ceil(y1))];`);
      const rung = await run(`const lod = __PAB.lods[${K}]; return lod.levels.findIndex(l => l.object.visible);`);
      const one = async (t, s) => { await side(s); await frames(6); await sleep(120); return shot(path.join(OUT, vk + '_' + t + '.png')); };
      await one('A', false); await one('B', true);
      await run(`__PAB.lods[${K}].visible = false; return 1;`); await frames(6); await sleep(120);
      await shot(path.join(OUT, vk + '_bg.png'));
      await run(`__PAB.lods[${K}].visible = true; return 1;`);
      for (let s = 0; s < STEPS; s++) {
        await run(`__PAB.pose(${s * STEP}); return 1;`);
        await one('seq_A_' + String(s).padStart(2, '0'), false);
        await one('seq_B_' + String(s).padStart(2, '0'), true);
      }
      info.views[vk] = { box, rung, d: V.d, seq: STEPS, step: STEP };
      console.log(vk + ' box ' + JSON.stringify(box) + ' rung ' + rung);
    }
    await side(true);
  }
  await run(`WORLD.scene.onBeforeRender = __PAB.prev; __PAB.M = null; return 1;`);
  fs.writeFileSync(path.join(OUT, 'ab.json'), JSON.stringify(info, null, 1));
  console.log('-> ' + path.join(OUT, 'ab.json') + '  (then: python tools/fbake_ab.py ' + OUT + ')');
})().catch(e => { console.error('parked_ab: ' + (e && e.stack || e)); process.exit(1); });
