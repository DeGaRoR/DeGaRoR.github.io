#!/usr/bin/env node
// garage_draws.js - GARAGE-LAPTOP (G2070): WHAT ONE GARAGE FRAME DRAWS, PER PRESET - in node, no GPU.
//
// The user's GTX 1660 Ti laptop (i5-9300H) on retro: the shed at p50 97-104 ms a frame, 4 341-5 874 draws, 5.7-6.0 M
// triangles, the CPU 85-103 ms (render 59.5, shadow 17.6-22.7), the GPU 100-122 ms. potato on the same laptop: 2 139
// draws, 1.95 M tris, p50 34.7 ms. A draw on that CPU is ~10 us of three + ANGLE; what transfers from this box is COUNTED.
// The page in node (tools/_page_node.js: dev.html's scripts, the recording WebGL2, the virtual clock), ?gfx=<preset> and
// GFX.set('preset') before anything builds, a build in flydiy.wip, booted into the garage; after WARM frames, FRAMES
// frames are counted one by one: every renderBufferDirect attributed to
//   pass    the render target it lands in: 'main' (the canvas or the AA's scene target), 'shadow:<light>' (a light's
//           shadow.map), 'rt:<name WxH>' (anything else: the transmission pass, a probe, the glass)
//   owner   the object's path under the scene, by name, at depth 1 / 2 / 3 (an unnamed node reads '(Type)')
//   program the material's name or type
// with triangles (instances counted), and the frame's renderer.info, the scene's object / mesh / caster counts.
// Usage: node --max-old-space-size=6144 tools/perf/garage_draws.js [--build cub|jodel|metal|<file>] [--preset retro]
//          [--frames 6] [--warm 40] [--out file.json] [--query 'k=v&...'] [--eval '<page js after the warm>']
// Node only, no lock (the 2026-10-04 rule: a CENSUS of several processes takes `boxlock.sh take cpu`). No --help.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const BUILDS = { cub: 'builds/cub_2026-09-20_corrected.json', metal: 'bugReports/cessnaMetal (1).json', jodel: 'builds/jodel_2026-09-20_corrected.json',
  cessna: 'builds/cessna172_2026-09-20_corrected.json' };
const BK = opt('build', 'jodel'), PRESET = opt('preset', 'retro'), FRAMES = +opt('frames', 6), WARM = +opt('warm', 40);
const OUT = opt('out', null), EVAL = opt('eval', null);
const Q = 'gfx=' + PRESET + (opt('query', '') ? '&' + opt('query', '') : '');
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[(s.length - 1) >> 1] : 0; };

(async () => {
  const { openPage } = require('../_page_node.js');
  const storage = { 'flydiy.wip': fs.readFileSync(path.join(ROOT, BUILDS[BK] || BK), 'utf8') };
  const hooks = { afterScript(name, P) { if (/gfx_settings\.js$/.test(name) && P.win.GFX) P.win.GFX.set('preset', PRESET); } };
  const t0 = Date.now();
  const P = await openPage({ quiet: true, storage, hooks, query: Q });
  const W = P.win;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 900000);
  await P.frames(WARM);
  if (EVAL) { try { W.eval(EVAL); } catch (e) { console.error('eval: ' + e.message); } await P.frames(4); }
  const FP = W.FLIGHT_PROBE, R = FP.renderer(), SC = FP.hangarScene();
  const lights = []; SC.traverse(o => { if (o.isLight && o.shadow) lights.push(o); });
  const lname = (L, i) => (L.name || L.type.replace('Light', '')) + '#' + i + (L.castShadow ? '' : '(nocast)');
  // a node's label: its name, else '~' + the first named node under it (breadth first, 3 levels), else '(Type)'; the top
  // level's children also carry their index (the shed's group, the craft, the editor's mount are all unnamed)
  const LBL = new Map();
  const label = o => { if (LBL.has(o)) return LBL.get(o); let s = o.name;
    if (!s) { let q = [o], lv = 0; while (!s && q.length && lv < 3) { const nq = []; for (const x of q) for (const c of x.children) { if (!s && c.name) s = '~' + c.name; nq.push(c); } q = nq; lv++; } }
    s = s || '(' + o.type + ')'; if (o.parent === SC) s = '[' + SC.children.indexOf(o) + ']' + s; LBL.set(o, s); return s; };
  const keyPath = o => { const a = []; let p = o; while (p && p !== SC) { a.unshift(label(p)); p = p.parent; } return p === SC ? a : ['(detached)'].concat(a); };
  let frame = null, curPass = 'main';
  const rt0 = R.setRenderTarget;
  R.setRenderTarget = function (t) {
    if (!t) curPass = 'main';
    else { const i = lights.findIndex(L => L.shadow && L.shadow.map === t);
      curPass = i >= 0 ? 'shadow:' + lname(lights[i], i) : (W.FLYDIY_AA && W.FLYDIY_AA.target && W.FLYDIY_AA.target() === t ? 'main'
        : 'rt:' + ((t.texture && t.texture.name) || '') + ' ' + t.width + 'x' + t.height + (t.isWebGLCubeRenderTarget ? ' cube' : '')); }
    return rt0.apply(this, arguments);
  };
  const rbd = R.renderBufferDirect;
  R.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
    if (frame) try {
      let n = geometry.index ? geometry.index.count : (geometry.attributes.position ? geometry.attributes.position.count : 0);
      if (group) n = Math.min(n, group.count); if (geometry.drawRange.count !== Infinity) n = Math.min(n, geometry.drawRange.count);
      let inst = object.isInstancedMesh ? object.count : (geometry.isInstancedBufferGeometry ? geometry.instanceCount : 1);
      if (inst === Infinity || inst == null) inst = 1;
      const tris = object.isMesh && !material.wireframe ? n / 3 * inst : 0;
      const kp = keyPath(object), pass = curPass.startsWith('rt:') && /scene|aa|msaa/i.test(curPass) ? 'main' : curPass;
      const add = (M, k) => { const e = M[k] || (M[k] = { d: 0, t: 0 }); e.d++; e.t += tris; };
      add(frame.pass, pass); add(frame.prog, (material.name || material.type) + (pass.startsWith('shadow') ? ' [sh]' : ''));
      for (let d = 1; d <= 4; d++) { add(frame['own' + d], kp.slice(0, d).join(' / ')); add(frame['own' + d + (pass === 'main' ? 'M' : pass.startsWith('shadow') ? 'S' : 'O')], kp.slice(0, d).join(' / ')); }
      frame.draws++; frame.tris += tris;
      if (pass.startsWith('shadow')) { const e = frame.shObj.get(object) || 0; frame.shObj.set(object, e + 1); }
    } catch (e) {}
    return rbd.apply(this, arguments);
  };
  const sigOf = o => { const m = o.matrixWorld.elements, g = o.geometry, pa = g && g.attributes && g.attributes.position;
    let s = ''; for (let i = 0; i < 16; i++) s += m[i].toFixed(6) + ',';
    return s + (g ? g.id : '') + ':' + (pa ? pa.version : '') + ':' + (g && g.index ? g.index.version : '') + ':' + (o.instanceMatrix ? o.instanceMatrix.version : ''); };
  const frames = [];
  for (let f = 0; f < FRAMES; f++) {
    frame = { draws: 0, tris: 0, pass: {}, prog: {}, shObj: new Map() };
    for (let d = 1; d <= 4; d++) for (const s of ['', 'M', 'S', 'O']) frame['own' + d + s] = {};
    const c0 = R.info.render.calls;
    await P.frames(1);
    // THE MOVERS: each shadow-drawn object's pose / geometry signature at the end of the frame (what a shadow cache sees)
    frame.sig = new Map(); for (const o of frame.shObj.keys()) frame.sig.set(o, sigOf(o));
    frames.push(frame); frame = null;
  }
  const movers = new Map();   // object -> why (changed between any two counted frames, or skinned / morphed)
  for (let f = 1; f < frames.length; f++) for (const [o, s] of frames[f].sig) { const s0 = frames[f - 1].sig.get(o);
    if (o.isSkinnedMesh || (o.morphTargetInfluences && o.morphTargetInfluences.length)) movers.set(o, 'skinned');
    else if (s0 === undefined) movers.set(o, 'new'); else if (s0 !== s) movers.set(o, 'moved'); }
  // the frame that drew (the 30 cap skips a refresh): the median of the drawn ones
  const drawn = frames.filter(f => f.draws > 0);
  const pick = drawn.slice().sort((a, b) => a.draws - b.draws)[(drawn.length - 1) >> 1] || frames[0];
  let objs = 0, meshes = 0, casters = 0, visMeshes = 0, mats = new Set();
  SC.traverse(o => { objs++; if (o.isMesh) { meshes++; if (o.castShadow) casters++; let v = true, p = o; while (p) { if (!p.visible) { v = false; break; } p = p.parent; } if (v) visMeshes++;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m && mats.add(m)); } });
  const sortT = M => Object.fromEntries(Object.entries(M).sort((a, b) => b[1].d - a[1].d).map(([k, v]) => [k, { draws: v.d, ktris: +(v.t / 1000).toFixed(1) }]));
  const out = { build: BK, preset: PRESET, query: Q, gfx: W.GFX && W.GFX.get ? W.GFX.get() : null, budget: W.GFX && W.GFX.budget ? W.GFX.budget() : null,
    drawnFrames: drawn.length + '/' + frames.length, draws: pick.draws, ktris: +(pick.tris / 1000).toFixed(1), drawsAll: frames.map(f => f.draws),
    scene: { objects: objs, meshes, visibleMeshes: visMeshes, casters, materials: mats.size, programs: R.info.programs ? R.info.programs.length : null,
      lights: lights.map((L, i) => ({ n: lname(L, i), map: L.shadow.map ? L.shadow.map.width : null, auto: L.shadow.autoUpdate })) },
    pass: sortT(pick.pass), prog: sortT(pick.prog), shedShadow: W.SHED_SHADOW ? W.SHED_SHADOW.stat() : null };
  for (let d = 1; d <= 4; d++) for (const s of ['', 'M', 'S', 'O']) out['owner' + d + s] = sortT(pick['own' + d + s]);
  { const by = {}; let n = 0, dr = 0; for (const [o, why] of movers) { const d = pick.shObj.get(o) || 0; n++; dr += d; const k = keyPath(o).slice(0, 4).join(' / ') + ' [' + why + ']';
      const e = by[k] || (by[k] = { n: 0, draws: 0 }); e.n++; e.draws += d; }
    out.movers = { objects: n, shadowDraws: dr, by: Object.fromEntries(Object.entries(by).sort((a, b) => b[1].draws - a[1].draws)) }; }
  out.wall = Date.now() - t0; out.errors = P.errors.slice(0, 10);
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  const line = (M, n) => Object.entries(M).slice(0, n).map(([k, v]) => '    ' + String(v.draws).padStart(5) + ' dr ' + String(v.ktris).padStart(8) + ' kt  ' + k).join('\n');
  console.log('GARAGE ' + BK + ' ' + PRESET + ': ' + out.draws + ' draws, ' + out.ktris + ' ktris (frames ' + out.drawsAll.join(',') + ') | objects ' + objs + ', meshes ' + meshes + ' (visible ' + visMeshes + ', casters ' + casters + '), materials ' + mats.size + ', programs ' + out.scene.programs);
  if (out.shedShadow) { out.shedShadow.liveList = W.SHED_SHADOW.liveList(); console.log('  SHED_SHADOW ' + JSON.stringify(out.shedShadow)); }
  console.log('  PASSES\n' + line(out.pass, 20));
  const DEP = +opt('depth', 3);
  console.log('  OWNERS (depth 1, all passes)\n' + line(out.owner1, 12));
  console.log('  OWNERS (depth ' + DEP + ', main)\n' + line(out['owner' + DEP + 'M'], 30));
  console.log('  OWNERS (depth ' + DEP + ', shadow)\n' + line(out['owner' + DEP + 'S'], 30));
  console.log('  OWNERS (depth ' + DEP + ', other targets)\n' + line(out['owner' + DEP + 'O'], 12));
  console.log('  MOVERS (the shadow casters that changed across the counted frames): ' + out.movers.objects + ' objects, ' + out.movers.shadowDraws + ' of the frame shadow draws');
  for (const [k, v] of Object.entries(out.movers.by).slice(0, 25)) console.log('    ' + String(v.draws).padStart(5) + ' dr ' + String(v.n).padStart(4) + ' obj  ' + k);
  console.log('  wall ' + (out.wall / 1000).toFixed(0) + ' s; page errors ' + P.errors.length);
  process.exit(0);
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
