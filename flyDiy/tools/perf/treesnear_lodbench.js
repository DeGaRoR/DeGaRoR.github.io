#!/usr/bin/env node
// treesnear_lodbench.js - THE TREE PARTITION'S CPU ON THE LOW PASS, IN NODE (G1114.1, TREES-NEAR's train-19 lever)
//
//   node tools/perf/treesnear_lodbench.js [--bands minimum] [--frames 600] [--step 1.5] [--agl 60] [--check 200] [--out f.json]
//
// The page itself (tools/_page_node.js: dev.html's scripts, the real three on a recording GL, the virtual clock), the
// default Cub rolled out and PAUSED, then carried along the low pass of tools/perf/treesnear_lowpass.js (the 3 km line
// with the most TREE ground within 4 km of the stand, along the nose, `agl` m over the ground) by `step` m a frame
// (1.5 = 45 m/s at 30 fps) for `frames` frames. Over exactly those frames a V8 CPU profile (node's inspector) gives the
// REAL inclusive time of the tree partition's functions - partitionChunk, parkChunk, lodUpdate, showRung - and of the
// world's whole update, per frame. The virtual clock moves the page's budgets (the fill's stream), not these: they run
// on a refresh cadence of distance and frames. Deterministic but for the machine's speed: compare two trees in ONE
// sitting (master and the change, the same flags). Prints ms per frame and per second at 30 fps, and TREE_LOD.census().
'use strict';
const fs = require('fs'), path = require('path'), inspector = require('inspector');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const BANDS = opt('bands', 'minimum'), FRAMES = +opt('frames', 600), STEP = +opt('step', 1.5), AGL = +opt('agl', 60);
const OUT = opt('out', null);
const FN = ['partitionChunk', 'parkChunk', 'lodUpdate', 'showRung', 'worldUpdate', 'walk', 'build'];

(async () => {
  const { openPage } = require('../_page_node.js');
  const storage = { 'flydiy.gfx': JSON.stringify({ preset: 'gamer', pv: 5, bands: BANDS }) };
  const P = await openPage({ quiet: true, storage });
  const W = P.win;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 600000);
  W.document.getElementById('bGo').click();
  await P.until(() => W.BOOT.state === 'gone' && W.BOOT.set === 'rollout', 900000);
  const FP = W.FLIGHT_PROBE;
  const bP = W.document.getElementById('bPause'); if (bP) bP.click();
  await P.frames(30);
  if (W.GFX && W.GFX.get().bands !== BANDS) W.GFX.set('bands', BANDS);
  // the track: treesnear_lowpass.js's rule, the same numbers
  const w = FP.world(), s = FP.sim(), cg = s.cgPos(), ax = s.axes()[0];
  let fx = -ax[0], fz = -ax[2]; const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
  const I = w.island, L = 3000; let best = null, bf = -1;
  for (let gz = -4000; gz <= 4000; gz += 250) for (let gx = -4000; gx <= 4000; gx += 250) {
    const x0 = cg[0] + gx, z0 = cg[2] + gz; let f = 0, k = 0;
    for (let t = 0; t <= L; t += 100, k++) if (I.effClass(x0 + fx * t, z0 + fz * t) === I.WC.TREE) f++;
    if (f / k > bf) { bf = f / k; best = [x0, z0]; }
  }
  const at = d => { const x = best[0] + fx * d, z = best[1] + fz * d; return [x, w.terrainH(x, z) + AGL, z]; };
  await FP.place({ at: at(0), zeroV: true });
  await P.frames(120);                                     // the stream catches up at the start of the line
  const sess = new inspector.Session(); sess.connect();
  const post = (m, p) => new Promise((res, rej) => sess.post(m, p || {}, (e, r) => e ? rej(e) : res(r)));
  await post('Profiler.enable'); await post('Profiler.setSamplingInterval', { interval: 100 });
  await post('Profiler.start');
  const t0 = process.hrtime.bigint();
  for (let f = 1; f <= FRAMES; f++) { await FP.place({ at: at(Math.min(L, f * STEP)), zeroV: true }); await P.frames(1); }
  const wall = Number(process.hrtime.bigint() - t0) / 1e6;
  const { profile } = await post('Profiler.stop');
  const byId = new Map(profile.nodes.map(x => [x.id, x])), self = {};
  const dt = (profile.endTime - profile.startTime) / profile.samples.length / 1000;
  // INCLUSIVE time (a function and what it calls - the typed arrays' set() is a builtin of its own): each sample counts
  // once for every function of FN on its stack
  const parent = new Map(); for (const x of profile.nodes) for (const c of (x.children || [])) parent.set(c, x.id);
  for (const sid of profile.samples) { const seen = new Set(); for (let id = sid; id != null; id = parent.get(id)) { const nm = byId.get(id).callFrame.functionName; if (FN.includes(nm) && !seen.has(nm)) { seen.add(nm); self[nm] = (self[nm] || 0) + dt; } } }
  const cen = W.TREE_LOD && W.TREE_LOD.census ? W.TREE_LOD.census() : null;
  const per = k => +((self[k] || 0) / FRAMES).toFixed(3);
  const out = { bands: BANDS, fade: W.TREE_LOD ? W.TREE_LOD.fade() : null, frames: FRAMES, stepM: STEP, agl: AGL, start: best.map(Math.round), forest: +bf.toFixed(2),
                wallMsPerFrame: +(wall / FRAMES).toFixed(2), selfMsPerFrame: Object.fromEntries(FN.map(k => [k, per(k)])),
                lodMsPerFrame: per('lodUpdate'), census: cen };
  console.log('treesnear_lodbench ' + BANDS + ' w' + out.fade + ': ' + FRAMES + ' frames, ' + STEP + ' m a frame, ' + AGL + ' m AGL from ' + out.start + ' (forest ' + out.forest + ')');
  console.log('  tree LOD (lodUpdate inclusive) ms/frame ' + out.lodMsPerFrame + ' (x30 = ' + (out.lodMsPerFrame * 30).toFixed(1) + ' ms/s): ' + FN.slice(0, 4).map(k => k + ' ' + out.selfMsPerFrame[k]).join(' · '));
  console.log('  worldUpdate incl ' + out.selfMsPerFrame.worldUpdate + ' · fill walk ' + out.selfMsPerFrame.walk + ' · wall ' + out.wallMsPerFrame + ' ms/frame (the harness included)');
  console.log('  census ' + JSON.stringify(cen));
  // THE SAME TREES (A0's proof, G1114.1): a second pass over the same track, after the profile, every CHECK m. At each
  // checkpoint the dealt trees of every rung mesh (the scene's 'treeRungs' group: a mesh holding trees hangs there) are
  // listed as `<vertices>|<indices>|<material>|x|y|z` (the world place, to 1 cm) - first as the cadence left them
  // ('natural'), then after a refresh forced at that very eye (TREE_LOD.fade(TREE_LOD.fade()) clears the partition's
  // last eye; one frame). Compare two trees with tools/perf/treesnear_samecheck.js: 'forced' must be identical,
  // 'natural' may differ only by trees within one refresh step of a band edge.
  const CHECK = +opt('check', 200);
  const dump = () => { const g = W.WORLD.scene.getObjectByName('treeRungs'), o = [];
    if (g) for (const m of g.children) { if (!m.isInstancedMesh || !m.count) continue;
      const a = m.instanceMatrix.array, gk = m.geometry.attributes.position.count + '|' + (m.geometry.index ? m.geometry.index.count : 0) + '|' + (m.material.name || '');
      for (let i = 0; i < m.count; i++) o.push(gk + '|' + (a[i * 16 + 12] + m.position.x).toFixed(2) + '|' + (a[i * 16 + 13] + m.position.y).toFixed(2) + '|' + (a[i * 16 + 14] + m.position.z).toFixed(2)); }
    return o.sort(); };
  const eyeNow = () => { const c = W.WORLD.treeLod.cam.value; return [+c.x.toFixed(2), +c.y.toFixed(2), +c.z.toFixed(2)]; };
  out.checks = [];
  await FP.place({ at: at(0), zeroV: true }); await P.frames(60);
  for (let f = 1, next = CHECK; f <= FRAMES; f++) {
    await FP.place({ at: at(Math.min(L, f * STEP)), zeroV: true }); await P.frames(1);
    if (f * STEP >= next) { next += CHECK;
      const natural = dump(), eye = eyeNow();
      W.TREE_LOD.fade(W.TREE_LOD.fade()); await P.frames(1);
      out.checks.push({ m: Math.round(f * STEP), eye, eyeForced: eyeNow(), bands: W.TREE_LOD.get(), fade: W.TREE_LOD.fade(), natural, forced: dump() }); }
  }
  console.log('  same-trees dump: ' + out.checks.length + ' checkpoints, ' + out.checks.reduce((n, c) => n + c.forced.length, 0) + ' dealt (forced)');
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  process.exit(0);
})().catch(e => { console.error('treesnear_lodbench: ' + (e && e.stack || e)); process.exit(1); });
