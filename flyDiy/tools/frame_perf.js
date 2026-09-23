#!/usr/bin/env node
// frame_perf.js - THE FRAME, PASS BY PASS, ON THE GPU (POST-FX study / D1, 2026-09-21)
//
// What each render pass costs, measured the same way every time: headless
// Chrome on this machine's GPU, the game rolled out (or the shed as booted
// with --garage), the aeroplane held at a place, the streamer settled, and
// then N frames in which EVERY renderer.render() call is wrapped in an
// EXT_disjoint_timer_query_webgl2 TIME_ELAPSED query and tagged by the target
// it draws into - the sky-view and AP tables, the cloud march, the far
// shadow cascade, the canopy cover, the reflection probes, the scene into
// the resolve target, the resolve blit onto the canvas, the flare, and any
// post pass. Queries cannot nest, so three's shadow-map pass (which runs
// INSIDE render()) is timed in a second sub-run that wraps
// renderer.shadowMap.render alone.
//
// A PASS THAT TIMES ITSELF IS INVISIBLE TO US, AND THAT USED TO BE SILENT (FOG-MIST, 2026-09-22).
// clouds.js opens its OWN TIME_ELAPSED query round the march (clouds.js:555). Queries cannot nest,
// so ours over the same draw is invalid, the result never lands, and the `clouds:march` tag was
// simply ABSENT from every row - which reads exactly like a pass that never ran. A whole probe
// series (`CLOUDS.S.maxKm`) was scored against a pass this rig could not see. So the numbers for
// such a pass are now taken from the module's own timer and MARKED: a tag ending in `*` was
// measured by the pass itself (CLOUDS.stats.gpuLast / shadowLast), not by this rig's query. Still
// a GPU millisecond; simply not ours. If another pass ever times itself, add it here.
//
// Usage:  node tools/frame_perf.js [--url http://localhost:8477/flyDiy/dev.html?world=jolene]
//              [--tiers full,msaa,off] [--places stand,forest,sea] [--frames 120]
//              [--probes "base=1;;bloom=GFX.set('bloom','soft')"]   (named configurations, each measured at each place)
//              [--size 2560x1440] [--garage] [--pre "<js>"] [--out tools/perf/frame_perf.json] [--compare <json>] [--label <name>] [--headed] [--quiet [--quiet-max 20]] [--eval "<js>"]
// Needs the dev server up (tools/_serve.js) and Chrome. Prints a table per
// place x tier x probe; writes the JSON. This is a MEASUREMENT, not a gate:
// it needs a GPU and a browser, which the gate battery does not assume.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL = opt('url', 'http://localhost:8477/flyDiy/dev.html?world=jolene');
const TIERS = opt('tiers', 'full,msaa,off').split(',');
const GARAGE = argv.includes('--garage');
const PLACES = GARAGE ? ['garage'] : opt('places', 'stand,forest,sea').split(',');
const FRAMES = +opt('frames', 120);
const PROBES = opt('probes', 'base=1').split(';;').map(s => { const i = s.indexOf('='); return { name: s.slice(0, i), js: s.slice(i + 1) }; });
const OUT = opt('out', path.join(__dirname, 'perf', GARAGE ? 'frame_perf_garage.json' : 'frame_perf.json'));
const COMPARE = opt('compare', null);
const LABEL = opt('label', '');
const PRE = opt('pre', null);
// --size WxH: the page's viewport (default 1920x1080); the frame is GPU-bound, so its size is the first variable (PERF 2026-09-23)
const SIZE = (opt('size', '1920x1080').split('x').map(Number));

const PORT = 9400 + (process.pid % 500);
const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find(p => fs.existsSync(p));
if (!CHROME) { console.error('frame_perf: no Chrome found'); process.exit(2); }
const udd = path.join(require('os').tmpdir(), 'cdp_fp_' + PORT + '_' + Date.now());
// --headed: a real window (the headless GPU path can differ; a check, not the routine)
const HEADED = argv.includes('--headed');
// THE GPU IS SHARED (2026-09-21: five sessions on the box, two headless rigs at 100 %): a TIME_ELAPSED
// query is wall time on the GPU's timeline and another context's work lands inside it, so a number
// taken at 100 % is not a number. --quiet waits (up to --quiet-max minutes) for a window under 15 %
// BEFORE Chrome is spawned - this rig's own Chrome renders flat out (no vsync) and would never let the
// GPU read quiet once it is up; every row then records nvidia-smi's utilisation just before it.
const gpuUtil = () => { try { return +require('child_process').execSync('nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits', { stdio: ['ignore', 'pipe', 'ignore'], timeout: 4000 }).toString().trim(); } catch (e) { return -1; } };
const QUIET = argv.includes('--quiet'), QUIET_MAX = +opt('quiet-max', 20);
if (QUIET) {
  const t0 = Date.now(); let u = gpuUtil(), calm = 0;
  while (u >= 0 && Date.now() - t0 < QUIET_MAX * 60000) { if (u < 15) { if (++calm >= 3) break; } else calm = 0; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 4000); /* a synchronous 4 s, no shell */ u = gpuUtil(); }
  console.log('frame_perf: GPU ' + u + ' % after ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s of waiting' + (u >= 15 ? ' - NOT QUIET, measuring anyway' : ''));
}
const ch = spawn(CHROME, (HEADED ? [] : ['--headless=new']).concat(['--remote-debugging-port=' + PORT,
  '--window-size=' + SIZE[0] + ',' + SIZE[1], '--hide-scrollbars', '--no-first-run',
  '--user-data-dir=' + udd,
  '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync', 'about:blank']), { stdio: 'ignore' });
const killChrome = () => { try { if (process.platform === 'win32') require('child_process').execSync('taskkill /PID ' + ch.pid + ' /T /F', { stdio: 'ignore' }); else ch.kill(); } catch (e) {} };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => {
  http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej);
});

// ---- the page-side instrument -------------------------------------------
// __FP.install(): wraps renderer.render (mode 'passes') or shadowMap.render
// (mode 'shadows'); __FP.run(n, mode) -> JSON of per-tag ms per frame.
const INSTRUMENT = `(() => {
  if (window.__FP) return 'have';
  const R = (window.WORLD && WORLD.renderer) || (window.GARAGE_ENV && GARAGE_ENV._debug().renderer) || window.FLYDIY_RENDERER;
  if (!R) throw new Error('no renderer');
  const gl = R.getContext(); const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const rr = R.render.bind(R);
  const SM = R.shadowMap, sm = SM && SM.render ? SM.render.bind(SM) : null;
  const S = { mode: 'off', frame: 0, pending: [], acc: [], calls: {}, ext: !!ext };
  const isQuad = sc => sc && sc.children && sc.children.length === 1 && sc.children[0].geometry && sc.children[0].geometry.type === 'PlaneGeometry';
  function nameOf(t, sc) {
    const AA = window.FLYDIY_AA, A = window.ATMO && ATMO.G, W = window.WORLD, C = window.CLOUDS;
    if (t === null || t === undefined) {
      if (W && sc === W.scene) return 'canvas:scene';
      if (window.GARAGE_ENV && sc === GARAGE_ENV._debug().scene) return 'canvas:scene';
      if (sc && sc.name) return 'canvas:' + sc.name;
      if (isQuad(sc)) return 'resolve';
      return 'canvas:' + (sc && sc.children ? sc.children.length : '?');
    }
    if (AA && AA.target && t === AA.target()) return 'scene';
    if (A) { if (t === A.rtSky) return 'atmo:sky'; if (t === A.rtAP) return sc === A.scene ? 'atmo:ap' : 'clouds:shadow'; }
    if (C && C.rt && t === C.rt()) return 'clouds:march';
    if (W && W.far && t === W.far.rt) return 'shadow:far';
    if (W && W.cover && t === W.cover.rt) return 'shadow:cover';
    if (t.isWebGLCubeRenderTarget) return 'probe:cube';
    if (t.texture && t.texture.mapping === 306 /* CubeUVReflectionMapping */) return 'probe:pmrem';
    if (t.texture && Array.isArray(t.texture)) return 'mrt:' + t.width + 'x' + t.height;
    return (sc && sc.name ? sc.name + ':' : '') + t.width + 'x' + t.height;
  }
  function timed(tag, fn) {
    if (!ext) { fn(); return; }
    const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); fn(); gl.endQuery(ext.TIME_ELAPSED_EXT);
    S.pending.push({ q, tag, f: S.frame });
  }
  R.render = (sc, cam) => {
    if (S.mode !== 'passes') return rr(sc, cam);
    const tag = nameOf(R.getRenderTarget(), sc);
    S.calls[tag] = (S.calls[tag] || 0) + 1;
    timed(tag, () => rr(sc, cam));
  };
  if (sm) SM.render = (lights, sc, cam) => {
    if (S.mode !== 'shadows') return sm(lights, sc, cam);
    S.calls['shadow:maps'] = (S.calls['shadow:maps'] || 0) + 1;
    timed('shadow:maps', () => sm(lights, sc, cam));
  };
  function poll() {
    const keep = [];
    for (const h of S.pending) {
      if (gl.getQueryParameter(h.q, gl.QUERY_RESULT_AVAILABLE)) {
        if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) { const ms = gl.getQueryParameter(h.q, gl.QUERY_RESULT) / 1e6; const a = S.acc[h.f] || (S.acc[h.f] = {}); a[h.tag] = (a[h.tag] || 0) + ms; }
        gl.deleteQuery(h.q);
      } else keep.push(h);
    }
    S.pending = keep;
  }
  // run(n, mode): n frames of the given mode, then drain; returns per-frame tag sums
  function run(n, mode) {
    return new Promise(res => {
      S.mode = mode; S.frame = 0; S.acc = []; S.calls = {};
      const frames = []; let last = performance.now(), cpu = 0, calls = 0, tris = 0;
      R.info.autoReset = false; R.info.reset();
      const wu = window.WORLD && WORLD.worldUpdate;
      if (wu) WORLD.worldUpdate = cg => { const t0 = performance.now(); wu(cg); cpu += performance.now() - t0; };
      let seenMarch = -1, seenCShadow = -1;
      const selfTimed = () => {            // the passes that hold their own query: READ them, never wrap them (header)
        const C = window.CLOUDS;
        if (!C || !C.stats || !C.active) return;
        const a = S.acc[S.frame] || (S.acc[S.frame] = {});
        // the count is how often a NEW result landed, not how often the pass drew - a self-timed
        // pass's query lands a frame or two late, so this is < 1 per frame and is not a draw count
        if (C.stats.gpuLast && C.stats.gpuLast !== seenMarch) { a['clouds:march*'] = C.stats.gpuLast; seenMarch = C.stats.gpuLast; S.calls['clouds:march*'] = (S.calls['clouds:march*'] || 0) + 1; }
        if (C.stats.shadowLast && C.stats.shadowLast !== seenCShadow) { a['clouds:shadow*'] = C.stats.shadowLast; seenCShadow = C.stats.shadowLast; S.calls['clouds:shadow*'] = (S.calls['clouds:shadow*'] || 0) + 1; }
      };
      const tick = () => {
        poll();
        if (S.mode === 'passes') selfTimed();
        const now = performance.now(); frames.push(now - last); last = now;
        calls += R.info.render.calls; tris += R.info.render.triangles; R.info.reset();
        S.frame++;
        if (S.frame < n) requestAnimationFrame(tick);
        else {
          S.mode = 'off';
          let drain = 0;
          const dr = () => { poll(); if (S.pending.length && ++drain < 30) requestAnimationFrame(dr); else {
            if (wu) WORLD.worldUpdate = wu;
            R.info.autoReset = true;
            res(JSON.stringify({ frames: frames.slice(1), acc: S.acc.slice(10), calls: S.calls, cpuWorld: cpu / n, calls1: Math.round(calls / n), tris: Math.round(tris / n), gpuTimer: !!ext }));
          } };
          requestAnimationFrame(dr);
        }
      };
      requestAnimationFrame(tick);
    });
  }
  window.__FP = { S, run, nameOf };
  return 'installed';
})()`;

// the settle: the streamer has generated nothing for 60 frames (tree_perf's rule)
const SETTLED = `(() => new Promise(res => {
  if (!window.WORLD) { let n = 0; const t = () => { if (++n < 60) requestAnimationFrame(t); else res(true); }; requestAnimationFrame(t); return; }
  const wu = WORLD.worldUpdate; let worst = 0, n = 0, busy = false;
  const st = () => (window.TREE_FILL && TREE_FILL.stat) ? TREE_FILL.stat() : null;
  const g0 = st() ? st().gens : -1;
  WORLD.worldUpdate = cg => { const t0 = performance.now(); wu(cg); worst = Math.max(worst, performance.now() - t0); const S = st(); if (S && (S.busy || S.gens !== g0)) busy = true; };
  const tick = () => { if (++n < 60) requestAnimationFrame(tick); else { WORLD.worldUpdate = wu; res(st() ? !busy : worst < 8); } };
  requestAnimationFrame(tick); }))()`;

// the places: where the aeroplane is held (paused), and the eye
const PLACE_JS = {
  // the stand: where the roll-out put it (the shed, the field, the premises)
  stand: `(()=>{const b=document.getElementById('bPause');if(b&&/pause/i.test(b.textContent))b.click();return JSON.stringify({at:FLIGHT_PROBE.sim().cgPos().map(v=>v|0)});})()`,
  // the densest stand within 2.5 km at 110 m AGL (tree_perf's rule)
  forest: `(() => {
  const w = FLIGHT_PROBE.world();
  const T = w.trees.filter(t => Math.hypot(t.x, t.z) < 2500);
  let best = null, bn = -1;
  for (let i = 0; i < T.length; i += 7) { const a = T[i]; let n = 0;
    for (const b of T) if (Math.abs(b.x - a.x) < 120 && Math.abs(b.z - a.z) < 120) n++;
    if (n > bn) { bn = n; best = a; } }
  const gy = w.terrainH(best.x, best.z);
  const s = FLIGHT_PROBE.sim(); const cg = s.cgPos();
  const dx = best.x - cg[0], dy = (gy + 110) - cg[1], dz = best.z - cg[2];
  for (let i = 0; i < s.n; i++) { s.p[i*3] += dx; s.p[i*3+1] += dy; s.p[i*3+2] += dz; s.v[i*3] = s.v[i*3+1] = s.v[i*3+2] = 0; }
  const b=document.getElementById('bPause');if(b&&/pause/i.test(b.textContent))b.click();
  return JSON.stringify({ at: [best.x | 0, gy + 110 | 0, best.z | 0], neighbours: bn }); })()`,
  // over the sea: the first water 1.5-6 km out in sixteen headings, 300 m up, the island in view
  sea: `(() => {
  const w = FLIGHT_PROBE.world(); let best = null;
  for (let r = 1500; r <= 6000 && !best; r += 250) for (let k = 0; k < 16 && !best; k++) { const a = k / 16 * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (w.terrainH(x, z) <= 0 && w.terrainH(x * 1.1, z * 1.1) <= 0) best = [x, z]; }
  if (!best) best = [3000, 0];
  const s = FLIGHT_PROBE.sim(); const cg = s.cgPos();
  const dx = best[0] - cg[0], dy = 300 - cg[1], dz = best[1] - cg[2];
  for (let i = 0; i < s.n; i++) { s.p[i*3] += dx; s.p[i*3+1] += dy; s.p[i*3+2] += dz; s.v[i*3] = s.v[i*3+1] = s.v[i*3+2] = 0; }
  const b=document.getElementById('bPause');if(b&&/pause/i.test(b.textContent))b.click();
  return JSON.stringify({ at: [best[0] | 0, 300, best[1] | 0] }); })()`,
  garage: `'garage'`,
};

const med = a => { if (!a.length) return 0; const f = a.slice().sort((x, y) => x - y); return f[f.length >> 1]; };
const p90 = a => { if (!a.length) return 0; const f = a.slice().sort((x, y) => x - y); return f[Math.floor(f.length * 0.9)]; };

(async () => {
  let tgt = null;
  for (let i = 0; i < 40 && !tgt; i++) {
    await sleep(400);
    try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(t => t.type === 'page'); } catch (e) {}
  }
  if (!tgt) throw new Error('no page target');
  const ws = new WebSocket(tgt.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown' && process.env.FRAME_PERF_DEBUG) console.error('page exception: ' + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).split('\n').slice(0, 3).join(' | ')); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async expr => {
    const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    const d = r.result;
    if (!d || d.exceptionDetails) throw new Error('page: ' + (d && d.exceptionDetails ? (d.exceptionDetails.exception && d.exceptionDetails.exception.description || d.exceptionDetails.text) : JSON.stringify(r)));
    return d.result.value;
  };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  if (PRE) await cmd('Page.addScriptToEvaluateOnNewDocument', { source: PRE });
  await cmd('Emulation.setDeviceMetricsOverride', { width: SIZE[0], height: SIZE[1], deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: URL });
  await sleep(1500);
  // bounded (120 s): under a saturated GPU the boot can stall past its own watchdogs
  try { await ev("(() => Promise.race([(window.BOOT && BOOT.whenReady) ? BOOT.whenReady().then(() => 'ready') : new Promise(r => setTimeout(() => r('no BOOT'), 18500)), new Promise(r => setTimeout(() => r('boot timeout'), 120000))]))()"); }
  catch (e) { await sleep(18500); }
  await sleep(500);
  const KEEP = "(()=>{const l=[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0&&b.offsetParent);l.forEach(x=>x.click());return l.length;})()";
  if (!GARAGE) {
    let flying = false;
    for (let attempt = 0; attempt < 8 && !flying; attempt++) {
      await ev("(()=>{[...document.querySelectorAll('button')].filter(b=>/roll out/i.test(b.textContent)).forEach(x=>x.click());})()");
      await sleep(6000);
      flying = await ev("/TAXI|DOWNWIND|FINAL/.test(document.body.innerText)");
    }
    if (!flying) throw new Error('the roll-out never happened (no TAXI/DOWNWIND/FINAL on the page after 8 tries)');
    for (let i = 0; i < 20; i++) { const n = await ev(KEEP); await sleep(500); if (!n && i > 4) break; }
    // the roll-out screen (LOADING S3) holds the render until its steps land; headless, the
    // parallel compile can idle out - wait for the overlay to go, and say how it went
    const t0 = Date.now(); let bs = '';
    for (let i = 0; i < 100; i++) { bs = await ev("window.BOOT ? BOOT.state : 'none'"); if (bs === 'gone' || bs === 'none') break; await sleep(1000); }
    console.log('  roll-out screen: ' + bs + ' after ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s' + (await ev("!!(window.BOOT && BOOT.log && BOOT.log.some(e => e.k === 'fail'))") ? ' (a step timed out)' : ''));
    await sleep(2000);
  } else {
    for (let i = 0; i < 20; i++) { const n = await ev(KEEP); await sleep(500); if (!n && i > 4) break; }
  }
  const gpu = await ev("(()=>{const R=(window.WORLD&&WORLD.renderer)||GARAGE_ENV._debug().renderer;const g=R.getContext();const d=g.getExtension('WEBGL_debug_renderer_info');return d?g.getParameter(d.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER);})()");
  console.log('frame_perf  ' + gpu + (LABEL ? '  [' + LABEL + ']' : ''));
  console.log('  ' + await ev(INSTRUMENT) + ' · gpu timer ' + await ev('__FP.S.ext') + ' · gfx ' + await ev('JSON.stringify(window.GFX ? GFX.get() : null)'));

  const snap = async name => { if (!process.env.FRAME_PERF_DEBUG) return;
    const r = await cmd('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(require('os').tmpdir(), 'frame_perf_' + name + '.png'), Buffer.from(r.result.data, 'base64'));
    console.error('  [' + name + '] ' + await ev("document.body.innerText.replace(/\s+/g,' ').slice(0,160)")); };
  const rows = [];
  for (const place of PLACES) {
    const where = await ev(PLACE_JS[place] || PLACE_JS.stand);
    await sleep(1500);
    let settled = false;
    for (let i = 0; i < 60 && !settled; i++) settled = await ev(SETTLED);
    await snap(place);
    if (opt('eval', null)) console.log('  eval -> ' + await ev(opt('eval')));
    for (const probe of PROBES) {
      if (probe.js && probe.js !== '1') { await ev('(()=>{' + probe.js + ';return 1;})()'); await sleep(1500); await ev(SETTLED); }
      for (const tier of TIERS) {
        // --tiers gfx: the AA the graphics menu set (a preset probe's own), not a forced tier (PERF 2026-09-23)
        if (tier !== 'gfx') { await ev("FLYDIY_AA.setTier('" + tier + "')"); await sleep(1200); }
        await ev(SETTLED);
        const util = gpuUtil();   // includes this rig's own Chrome: a reading of the box, not of the pass
        // the first run at a configuration pays its allocations and lazy programs; only the second is recorded
        await ev('__FP.run(30, "passes")');
        // the frame with NO query in it (the timer's own cost shows as the difference)
        const Raw = JSON.parse(await ev('__FP.run(' + FRAMES + ', "off")'));
        const P = JSON.parse(await ev('__FP.run(' + FRAMES + ', "passes")'));
        const Sh = JSON.parse(await ev('__FP.run(' + Math.max(40, FRAMES >> 1) + ', "shadows")'));
        const tags = {};
        const names = new Set(); for (const a of P.acc) for (const k in a) names.add(k);
        for (const k of names) { const v = P.acc.map(a => a[k] || 0); tags[k] = { median: +med(v).toFixed(2), p90: +p90(v).toFixed(2), calls: +(P.calls[k] / P.frames.length).toFixed(1) }; }
        const shv = Sh.acc.map(a => a['shadow:maps'] || 0);
        tags['shadow:maps'] = { median: +med(shv).toFixed(2), p90: +p90(shv).toFixed(2), calls: +((Sh.calls['shadow:maps'] || 0) / Sh.frames.length).toFixed(1) };
        const sum = Object.keys(tags).filter(k => k !== 'shadow:maps').reduce((s, k) => s + tags[k].median, 0);
        const row = { place, probe: probe.name, tier, where: JSON.parse(where === 'garage' ? '{"at":"garage"}' : where), frame: { median: +med(Raw.frames).toFixed(1), p90: +p90(Raw.frames).toFixed(1), timed: +med(P.frames).toFixed(1) },
                      gpuSum: +sum.toFixed(2), cpuWorld: +P.cpuWorld.toFixed(2), calls: P.calls1, tris: P.tris, gpuUtilBefore: util, tags };
        try { row.post = JSON.parse(await ev('JSON.stringify(window.POST_FX && POST_FX.stats ? POST_FX.stats : null)')); } catch (e) { row.post = null; }
        rows.push(row);
        const order = Object.keys(tags).sort((a, b) => tags[b].median - tags[a].median);
        console.log(`  ${place.padEnd(7)} ${probe.name.padEnd(10)} ${tier.padEnd(5)} frame ${String(row.frame.median).padStart(6)} ms (p90 ${row.frame.p90}; ${row.frame.timed} under the timer) · gpu passes ${row.gpuSum} ms · cpu world ${row.cpuWorld} ms · ${row.calls} calls · ${(row.tris / 1e6).toFixed(1)} Mtris` + (util > 15 ? ` · GPU WAS ${util} % BUSY BEFORE` : ''));
        console.log('      ' + order.map(k => `${k} ${tags[k].median}` + (tags[k].calls !== 1 ? `×${tags[k].calls}` : '')).join(' · '));
      }
    }
    if (!TIERS.includes('gfx')) await ev("FLYDIY_AA.setTier('full')");
  }
  ws.close(); killChrome();
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}

  const result = { date: new Date().toISOString(), url: URL, gpu, label: LABEL, frames: FRAMES, rows };
  if (COMPARE && fs.existsSync(COMPARE)) {
    const prev = JSON.parse(fs.readFileSync(COMPARE, 'utf8'));
    console.log('  vs ' + COMPARE + ' (' + prev.date.slice(0, 10) + (prev.label ? ', ' + prev.label : '') + ')');
    for (const r of rows) {
      const p = prev.rows.find(x => x.place === r.place && x.tier === r.tier && x.probe === r.probe);
      if (!p) continue;
      const d = [];
      for (const k of new Set(Object.keys(r.tags).concat(Object.keys(p.tags)))) { const a = p.tags[k] ? p.tags[k].median : 0, b = r.tags[k] ? r.tags[k].median : 0; if (Math.abs(a - b) > 0.05) d.push(`${k} ${a}->${b}`); }
      console.log(`  ${r.place} ${r.probe} ${r.tier}: frame ${p.frame.median} -> ${r.frame.median} ms` + (d.length ? ' · ' + d.join(' · ') : ' · no pass moved'));
    }
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
  console.log('  -> ' + OUT);
})().catch(e => { console.error('frame_perf: ' + e.message); killChrome(); process.exit(1); });
