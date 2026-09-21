#!/usr/bin/env node
// grass_perf.js - THE GRASS TYPES, COSTED PER EFFECTIVE COVERAGE (B3, 2026-09-20)
//
//   node tools/grass_perf.js [--url http://localhost:8463/flyDiy/tools/_trees.html]
//        [--covers grass_dry,grass_reed,grass_plates,grass_scan] [--k 0.5,1,2,4 (per-type defaults otherwise)] [--reach 80]
//        [--out screenshots/grass_perf]
//
// The user's question: "the bench has 3 grass models; I need the most
// performance-friendly one at similar visual densities ... have all your
// metrics ready". A density dial is not a fair axis - a reed patch is one
// thing per 6 m2 and a blade plate three per m2 - so the axis here is what
// the eye gets: EFFECTIVE COVERAGE, the share of GROUND pixels a cover type
// hides from a given eye. Headless Chrome on this machine's GPU, the tree
// bench booted, and for each cover type ALONE (no trees, no shrubs, a flat
// plane) at each `cover` multiplier k of its own density:
//
//   - coverage from two eyes over the same patch: FLIGHT (35 m up, 40 deg
//     down - short final over a meadow) and LOW (1.7 m, looking along the
//     ground - taxiing). Two mask renders each: the
//     cover alone over a cleared target (alpha > 0 = a covered pixel), the
//     plane alone (the ground pixels); coverage = covered / ground.
//   - the frame's cost from the same eyes: a GPU timer query around 20
//     renders (EXT_disjoint_timer_query_webgl2; gl.finish() on ANGLE timed
//     the submission alone), the wall time with a readPixels sync beside it;
//     draw calls, tris, instances from renderer.info and the stage.
//   - the type's colour: the mean HSL of its cutout texels (the bench's own
//     measureMats), for the terrain-tint question - a low-saturation, even
//     cover takes a ground colour; a saturated, patterned one fights it.
//
// Then, in node, the cost at MATCHED coverage (30 % and 50 % of the ground
// from each eye) by interpolation over k, so the four types are compared at
// the same picture. A screenshot per type at k = 1 from each eye. JSON
// to tools/perf/grass_perf.json, pictures to --out (gitignored).
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL = opt('url', 'http://localhost:8463/flyDiy/tools/_trees.html');
const COVERS = opt('covers', 'grass_dry,grass_reed,grass_plates,grass_scan').split(',');
// the sweep per type: a blade plate saturates the ground by k = 1 while a tussock needs 16x its
// density to hide a third of it from the air - one k list would leave every type out of range
const K_OF = { grass_dry: [2, 4, 8, 16], grass_reed: [0.5, 1, 2, 4], grass_plates: [0.1, 0.2, 0.4, 1], grass_scan: [2, 4, 8, 16] };
const KS = opt('k', null) ? opt('k').split(',').map(Number) : null;
const ksOf = key => KS || K_OF[key] || [0.5, 1, 2, 4];
const REACH = +opt('reach', 80);
const OUT = opt('out', 'screenshots/grass_perf');
const PORT = 9900 + (process.pid % 90);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('grass_perf: no Chrome'); process.exit(2); }
const udd = path.join(require('os').tmpdir(), 'cdp_grass_' + PORT + '_' + Date.now());
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--window-size=1920,1080', '--hide-scrollbars',
  '--no-first-run', '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });

// ---- the page-side probes ----------------------------------------------
// one cover type alone, at k times its density, on the plane, no trees
const PLANT = (key, k) => `(async () => {
  for (const s of SPECIES) PICK[s.key] = (s.key === ${JSON.stringify(key)});
  Object.assign(FOREST, { count: 0, under: 0, cover: ${k}, reach: ${REACH}, impostor: false, ground: 'plane', wet: 0, radius: 220, seed: 7 });
  if (MODE !== 'forest') setMode('forest'); else await showForest();
  for (let i = 0; i < 600; i++) { if ($('msg').textContent === '' && !/building/i.test($('msg').textContent)) break; await new Promise(r => setTimeout(r, 100)); }
  await texturesReady();
  let inst = 0, meshes = 0;
  stage.traverse(o => { if (o.isInstancedMesh) { inst += o.count; meshes++; } });
  return JSON.stringify({ inst, meshes, msg: $('msg').textContent });
})()`;
// the two eyes, the masks, the cost; the stand eye is what showForest set
const MEASURE = `(async () => {
  const R = renderer, gl = R.getContext();
  const W = 960, H = 540;
  const rt = new THREE.WebGLRenderTarget(W, H, { format: THREE.RGBAFormat, generateMipmaps: false });
  const eye0 = { target: target.clone(), dist, yaw, pitch };
  const cover = [];
  stage.traverse(o => { if (o.isInstancedMesh) cover.push(o); });
  const maskCount = show => {
    const bg = scene.background, env = scene.environment, fog = scene.fog;
    const vis = { man: man.visible, ground: ground.visible, grid: grid.visible };
    scene.background = null; scene.fog = null;
    man.visible = false; grid.visible = false;
    ground.visible = show === 'ground';
    for (const o of cover) o.visible = show === 'cover';
    const pRT = R.getRenderTarget(), pAC = R.autoClear;
    R.setRenderTarget(rt); R.autoClear = true; R.setClearColor(0x000000, 0); R.clear(); R.render(scene, camera);
    const px = new Uint8Array(W * H * 4); R.readRenderTargetPixels(rt, 0, 0, W, H, px);
    R.setRenderTarget(pRT); R.autoClear = pAC;
    scene.background = bg; scene.environment = env; scene.fog = fog;
    man.visible = vis.man; ground.visible = vis.ground; grid.visible = vis.grid;
    for (const o of cover) o.visible = true;
    const mask = new Uint8Array(W * H); let n = 0;
    for (let i = 0; i < W * H; i++) if (px[i * 4 + 3] > 0) { mask[i] = 1; n++; }
    return { mask, n };
  };
  // THE COST IS THE GPU'S: a timer query around the draws (EXT_disjoint_timer_query_webgl2,
  // the clouds' instrument) - gl.finish() on ANGLE/D3D11 returned in microseconds and
  // timed the submission alone; a one-pixel readPixels is the fallback sync
  const cost = async () => {
    const vis = man.visible; man.visible = false;
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    R.render(scene, camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));   // warm + sync
    const N = 20; let ms = null;
    if (ext) {
      const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
      for (let i = 0; i < N; i++) R.render(scene, camera);
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      for (let t = 0; t < 200; t++) { await new Promise(r => setTimeout(r, 10)); if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break; }
      if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) && !gl.getParameter(ext.GPU_DISJOINT_EXT)) ms = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6 / N;
      gl.deleteQuery(q);
    }
    const t0 = performance.now();
    for (let i = 0; i < N; i++) R.render(scene, camera);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    const wall = (performance.now() - t0) / N;
    const info = R.info.render;
    man.visible = vis;
    return { ms: +(ms === null ? wall : ms).toFixed(2), wall: +wall.toFixed(2), gpuTimer: ms !== null, calls: info.calls, tris: info.triangles };
  };
  const views = {};
  // the cover is planted within reach of the stand eye's GROUND POINT (showForest plants
  // around the eye), so both eyes look from there: FLIGHT - 35 m up, 40 deg down over the
  // patch (short final over a meadow); LOW - 1.7 m up, along the ground (taxiing)
  const ex = camera.position.x, ez = camera.position.z, yy = Math.atan2(ex, ez);
  const eyes = {
    flight: { target: new THREE.Vector3(ex - 42 * Math.sin(yy), 0, ez - 42 * Math.cos(yy)), dist: 55, yaw: yy, pitch: 0.69 },
    low: { target: new THREE.Vector3(ex - 6 * Math.sin(yy), 1.2, ez - 6 * Math.cos(yy)), dist: 6.02, yaw: yy, pitch: 0.083 } };
  for (const name in eyes) {
    const e = eyes[name]; target.copy(e.target); dist = e.dist; yaw = e.yaw; pitch = e.pitch; place();
    const g = maskCount('ground'), c = maskCount('cover');
    let both = 0; for (let i = 0; i < W * H; i++) if (g.mask[i] && c.mask[i]) both++;
    views[name] = Object.assign({ ground: +(g.n / (W * H)).toFixed(4), covered: +(c.n / (W * H)).toFixed(4),
      coverage: +(g.n ? both / g.n : 0).toFixed(4) }, await (async () => { let best = null; for (let r = 0; r < 3; r++) { const c = await cost(); if (!best || c.ms < best.ms) best = c; } return best; })());
  }
  target.copy(eye0.target); dist = eye0.dist; yaw = eye0.yaw; pitch = eye0.pitch; place(); render();
  rt.dispose();
  return JSON.stringify(views);
})()`;
// the type's texels and materials
const COLOUR = key => `(() => {
  const sp = spOf(${JSON.stringify(key)}); const built = cache[sp.file];
  const mats = matsOfGroups(built, sp.subjects);
  const m = measureMats(mats);
  const list = mats.map(x => ({ name: x.name, mode: x.userData.alphaMode, map: x.map && x.map.image ? (x.map.image.naturalWidth || x.map.image.width) + 'x' + (x.map.image.naturalHeight || x.map.image.height) : null, vcol: !!x.vertexColors }));
  let tris = 0; sp.subjects.forEach(() => {});
  const pr = speciesProtos(sp, built)[0]; if (pr) pr.near.traverse(o => { if (o.isMesh && o.geometry) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  return JSON.stringify({ hsl: m ? { h: +m.h.toFixed(3), s: +m.s.toFixed(3), l: +m.l.toFixed(3), rgb: m.rgb } : null, mats: list, trisPerInstance: Math.round(tris), density: tuneOf(sp.key).density, size: tuneOf(sp.key).size, file: sp.file });
})()`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let tgt = null;
  for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  if (!tgt) throw new Error('no page');
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') console.error('page exception: ' + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).split(String.fromCharCode(10)).slice(0, 2).join(' | ')); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (!r.result || r.result.exceptionDetails) throw new Error('page: ' + JSON.stringify(r.result && r.result.exceptionDetails && (r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description || r.result.exceptionDetails.text))); return r.result.result.value; };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: URL });
  for (let i = 0; i < 60; i++) { await sleep(1000); try { if (await ev("typeof SPECIES !== 'undefined' && SPECIES.length > 0")) break; } catch (e) {} }
  const gpu = await ev("(()=>{const g=renderer.getContext();const d=g.getExtension('WEBGL_debug_renderer_info');return d?g.getParameter(d.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER);})()");
  console.log('grass_perf  ' + gpu + '\n  ' + URL + '\n  reach ' + REACH + ' m · 1920x1080, masks at 960x540 · GPU timer, min of 3 x 20 frames');
  const result = { date: new Date().toISOString(), gpu, url: URL, reach: REACH, types: {} };
  for (const key of COVERS) {
    const T = { colour: null, runs: [] };
    // the first plant of a type is a WARM-UP (its files load, its programs compile, the
    // previous mode's stage clears) - planted, measured, thrown away, then the sweep
    await ev(PLANT(key, ksOf(key)[0])); await ev(MEASURE);
    for (const k of ksOf(key)) {
      const p = JSON.parse(await ev(PLANT(key, k)));
      if (!T.colour) T.colour = JSON.parse(await ev(COLOUR(key)));
      const v = JSON.parse(await ev(MEASURE));
      T.runs.push(Object.assign({ k, inst: p.inst, meshes: p.meshes }, v));
      if (k === ksOf(key)[1]) {   // the two eyes' pictures at the sweep's second step
        await ev("(()=>{const ex=camera.position.x,ez=camera.position.z,yy=Math.atan2(ex,ez);target.set(ex-42*Math.sin(yy),0,ez-42*Math.cos(yy));dist=55;yaw=yy;pitch=0.69;place();render();return 1;})()");
        await sleep(300);
        const r = await cmd('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, key + '_k' + k + '_flight.png'), Buffer.from(r.result.data, 'base64'));
        await ev("(()=>{const ex=camera.position.x,ez=camera.position.z,yy=Math.atan2(ex,ez);target.set(ex-6*Math.sin(yy),1.2,ez-6*Math.cos(yy));dist=6.02;yaw=yy;pitch=0.083;place();render();return 1;})()");
        await sleep(300);
        const r2 = await cmd('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, key + '_k' + k + '_low.png'), Buffer.from(r2.result.data, 'base64'));
      }
      console.log(`  ${key.padEnd(13)} k ${String(k).padEnd(4)} inst ${String(p.inst).padEnd(7)} flight: cov ${(v.flight.coverage * 100).toFixed(1).padStart(5)} %  ${String(v.flight.ms).padStart(6)} ms${v.flight.gpuTimer ? '' : '(wall)'}  ${String(v.flight.tris).padStart(9)} tris  ${String(v.flight.calls).padStart(4)} calls | low: cov ${(v.low.coverage * 100).toFixed(1).padStart(5)} %  ${String(v.low.ms).padStart(6)} ms`);
    }
    result.types[key] = T;
  }
  // ---- matched coverage: ms at 30 % and 50 % of the ground, per eye, interpolated over k (log-log) ----
  const at = (runs, eye, cov) => {
    const pts = runs.map(r => ({ c: r[eye].coverage, ms: r[eye].ms, inst: r.inst })).filter(p => p.c > 0).sort((a, b) => a.c - b.c);
    if (!pts.length || cov < pts[0].c * 0.5 || cov > pts[pts.length - 1].c * 1.5) return null;
    let a = pts[0], b = pts[pts.length - 1];
    for (let i = 0; i + 1 < pts.length; i++) if (cov >= pts[i].c && cov <= pts[i + 1].c) { a = pts[i]; b = pts[i + 1]; }
    const t = a.c === b.c ? 0 : (Math.log(cov) - Math.log(a.c)) / (Math.log(b.c) - Math.log(a.c));
    const lerp = (x, y) => Math.exp(Math.log(Math.max(1e-6, x)) + t * (Math.log(Math.max(1e-6, y)) - Math.log(Math.max(1e-6, x))));
    return { ms: +lerp(a.ms, b.ms).toFixed(2), inst: Math.round(lerp(a.inst, b.inst)), extrap: t < 0 || t > 1 };
  };
  console.log('\n  AT MATCHED COVERAGE (interpolated over k; ~ = extrapolated):');
  console.log('    ' + 'type'.padEnd(13) + 'flight 30 %     flight 50 %     low 30 %        low 50 %        tris/inst  density  texels HSL (sat = tint fitness)');
  result.matched = {};
  for (const key of COVERS) {
    const T = result.types[key]; const row = {};
    const cells = [];
    for (const [eye, cov] of [['flight', 0.3], ['flight', 0.5], ['low', 0.3], ['low', 0.5]]) {
      const m = at(T.runs, eye, cov); row[eye + cov] = m;
      cells.push(m ? ((m.extrap ? '~' : '') + m.ms + ' ms/' + m.inst).padEnd(16) : 'out of range'.padEnd(16));
    }
    const c = T.colour;
    console.log('    ' + key.padEnd(13) + cells.join('') + String(c.trisPerInstance).padEnd(11) + String(c.density).padEnd(9) + (c.hsl ? `h ${c.hsl.h} s ${c.hsl.s} l ${c.hsl.l} rgb ${c.hsl.rgb}` : '-') + '  ' + c.mats.map(m => m.name + ':' + m.mode + ':' + m.map).join(' '));
    result.matched[key] = row;
  }
  fs.mkdirSync('tools/perf', { recursive: true });
  fs.writeFileSync('tools/perf/grass_perf.json', JSON.stringify(result, null, 1));
  console.log('\n  wrote tools/perf/grass_perf.json and ' + OUT + '/');
  ws.close(); ch.kill();
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
})().catch(e => { console.error('grass_perf: ' + e.message); ch.kill(); process.exit(1); });
