#!/usr/bin/env node
// boot_perf.js - THE BOOT'S BENCHMARK (LOADING chantier, 2026-09-14)
//
// What the boot costs, measured the same way every time: headless Chrome on
// this machine's GPU, a CDP sampling profile from before the navigation to
// SECS seconds after it, the network log, the long tasks, the page's own
// milestones (window.BOOT.log once the loading screen exists; window.__M
// hooks on the readiness globals regardless), and screenshots at the moment
// the overlay drops and 2 / 5 s later - with a STILLNESS score (mean absolute
// pixel difference between the +0.2 s and the +5 s frame): the number that
// says "nothing changes after the drop", which is the whole point of S1.
//
// Usage:  node tools/boot_perf.js [--url http://localhost:8361/flyDiy/dev.html]
//                                 [--world jolene] [--cold] [--secs 40] [--tag name]
//                                 [--out tools/perf/boot_perf.json] [--compare <json>]
//                                 [--shots]  (write the screenshots to screenshots/boot/)
// --cold = a fresh Chrome profile (no GPU shader cache: every program compiles
// from source); default = the rig's own persistent profile (the second run is
// the user's daily boot). Needs a static server on the repo root and Chrome.
// A MEASUREMENT, not a gate: no PASS/FAIL, not in run_gates.js.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const zlib = require('zlib');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const WORLD = opt('world', null);
let URL = opt('url', 'http://localhost:8361/flyDiy/dev.html');
if (WORLD) URL += (URL.includes('?') ? '&' : '?') + 'world=' + WORLD;
const SECS = +opt('secs', 40);
const TAG = opt('tag', (flag('cold') ? 'cold' : 'warm') + (WORLD ? '_' + WORLD : ''));
const OUT = opt('out', path.join(__dirname, 'perf', 'boot_perf_' + TAG + '.json'));
const COMPARE = opt('compare', null);
const SHOTDIR = flag('shots') ? path.join(__dirname, '..', 'screenshots', 'boot') : os.tmpdir();
const ORIGIN = URL.replace(/^(https?:\/\/[^/]+).*$/, '$1');

const PORT = 9400 + (process.pid % 500);
const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find(p => fs.existsSync(p));
if (!CHROME) { console.error('boot_perf: no Chrome found'); process.exit(2); }
// --udd <dir>: this Chrome profile, kept between runs (the WARM-CACHE test, PERF-LEAD 22 Nov: a second PROCESS on
// the profile a cold run just filled is a returning player's load). --chrome <flag>, repeatable: one more Chrome
// switch (e.g. --chrome --gpu-program-cache-size-kb=1048576). Neither is given by default: the runs are as before.
const UDD = opt('udd', null) || (flag('cold') ? path.join(os.tmpdir(), 'cdp_boot_' + PORT + '_' + Date.now())
                         : path.join(os.tmpdir(), 'flydiy_boot_perf_profile'));
const XFLAGS = argv.map((a, i) => (a === '--chrome' ? argv[i + 1] : null)).filter(Boolean);
// --headed: a VISIBLE Chrome (the user, 22 Nov: "the only reliable timing comes from an actual in-browser test").
// --size W,H: the window (default 1920,1080; the user's screen is 5120,1440). Headless, the page's viewport is set to
// it. Headed, NOTHING is emulated: the viewport is what the window leaves under its tabs and bars, as for a player,
// and the run prints the canvas it really drew (`canvas WxH`): read that, not the window, before comparing two rows.
const HEADED = flag('headed');
const [SW, SH] = String(opt('size', '1920,1080')).split(/[,x]/).map(Number);
if (!(SW > 0 && SH > 0)) { console.error('boot_perf: --size W,H'); process.exit(2); }
// (23 Nov, A0's fix 6881e8d2a: a COVERED headed window is backgrounded by Chrome - no rAF, a load that never ends; the user's
//  own windows may cover it during an unattended night window)
const args = [...(HEADED ? ['--window-position=0,0', '--no-default-browser-check', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] : ['--headless=new']), '--remote-debugging-port=' + PORT,
  '--window-size=' + SW + ',' + SH, '--hide-scrollbars', '--no-first-run',
  '--user-data-dir=' + UDD, '--disable-gpu-sandbox'].concat(XFLAGS, ['about:blank']);
const ch = spawn(CHROME, args, { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => {
  http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej);
});

// Injected before any page script: the milestone recorder. Hooks the
// readiness globals the boot defines (so a page without BOOT still reports),
// the first rAF, the long tasks, the paints, and #boot's `gone` class.
const INJECT = `(() => {
  const M = window.__M = { ev: [], props: [], chars: [], longTasks: [], paints: [], fetches: [] };
  const now = () => +performance.now().toFixed(0);
  const mark = (k, extra) => M.ev.push(Object.assign({ k, t: now() }, extra || {}));
  const hook = (name, wrap) => { let v; Object.defineProperty(window, name, { configurable: true, enumerable: true,
    get: () => v, set: nv => { if (v === undefined) mark('def:' + name); v = wrap ? wrap(nv) : nv; } }); };
  hook('WORLD'); hook('treeReady'); hook('TREE_FILL'); hook('CAGE_UI');
  hook('PROP_LANDED', f => (k, g) => { M.props.push({ k, t: now() }); return f(k, g); });
  hook('CHAR_TEX_LANDED', f => (k) => { M.chars.push({ k, t: now() }); return f(k); });
  hook('ASSET_FETCH', f => url => { const t = now(); const p = f(url);
    p.then(b => M.fetches.push({ url: String(url).replace(/^.*media\\//, ''), t0: t, t1: now(), n: b ? b.length : 0 }), () => {}); return p; });
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) M.longTasks.push({ t: +e.startTime.toFixed(0), d: +e.duration.toFixed(0) }); }).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) M.paints.push({ k: e.name, t: +e.startTime.toFixed(0) }); }).observe({ type: 'paint', buffered: true }); } catch (e) {}
  let firstRaf = false; const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(ts => { if (!firstRaf) { firstRaf = true; mark('firstRAF'); } return cb(ts); });
  const mo = new MutationObserver(() => { const b = document.getElementById('boot');
    if (b && b.classList.contains('gone') && !M.bootGone) { M.bootGone = now(); mark('bootGone'); } });
  document.addEventListener('DOMContentLoaded', () => { mark('DOMContentLoaded'); mo.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] }); });
  window.addEventListener('load', () => mark('load'));
})();`;

// a minimal PNG reader (8-bit RGB/RGBA, non-interlaced): enough for the
// stillness score without a dependency
function readPNG(buf) {
  let p = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8);
    if (type === 'IHDR') { w = buf.readUInt32BE(p + 8); h = buf.readUInt32BE(p + 12); ct = buf[p + 17]; }
    else if (type === 'IDAT') idat.push(buf.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp;
  const out = Buffer.alloc(w * h * bpp);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[dst + x - bpp] : 0, b = y > 0 ? out[dst - stride + x] : 0, c = (x >= bpp && y > 0) ? out[dst - stride + x - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      out[dst + x] = v & 255;
    }
  }
  return { w, h, bpp, data: out };
}
const stillness = (A, B) => { if (!A || !B || A.w !== B.w || A.h !== B.h) return null;
  let s = 0; for (let i = 0; i < A.data.length; i++) s += Math.abs(A.data[i] - B.data[i]); return +(s / A.data.length).toFixed(2); };

(async () => {
  let tgt = null;
  for (let i = 0; i < 40 && !tgt; i++) { await sleep(400);
    try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  if (!tgt) throw new Error('no page target');
  const ws = new WebSocket(tgt.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map(); const net = new Map(); const netOrder = [];
  ws.onmessage = ev => { const m = JSON.parse(ev.data);
    if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); return; }
    if (m.method === 'Network.requestWillBeSent') { const p = m.params; net.set(p.requestId, { url: p.request.url, t0: p.timestamp, type: p.type }); netOrder.push(p.requestId); }
    else if (m.method === 'Network.loadingFinished') { const r = net.get(m.params.requestId); if (r) { r.t1 = m.params.timestamp; r.bytes = m.params.encodedDataLength; } }
    else if (m.method === 'Network.loadingFailed') { const r = net.get(m.params.requestId); if (r) { r.t1 = m.params.timestamp; r.failed = m.params.errorText; } }
  };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    const d = r.result; if (!d || d.exceptionDetails) throw new Error('page: ' + (d && d.exceptionDetails ? d.exceptionDetails.text : JSON.stringify(r))); return d.result.value; };
  await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Network.enable', { maxTotalBufferSize: 200000000 });
  if (!HEADED) await cmd('Emulation.setDeviceMetricsOverride', { width: SW, height: SH, deviceScaleFactor: 1, mobile: false });
  let VP = [SW, SH];   // the viewport the screenshots clip to: the emulated one, or (headed) the window's own, read below
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: INJECT });
  // --init-file <js file> (22 Nov): a script run in the page BEFORE any of its own (a window.FLYDIY_* switch a test
  // needs set before the boot reads it). Named in the run's output: a seeded run is never mistaken for a plain one.
  { const f = opt('init-file', null); if (f) { await cmd('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(f, 'utf8') }); console.log('  init ' + f); } }
  // a same-origin page first, so the profiler survives the navigation (a
  // cross-origin hop would swap the renderer process)
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: require('./_stock_pin.js').pinScript() });   // G770: the OLD stock (GEN_DEFAULT), pinned - a fresh first boot is the Cub
  await cmd('Page.navigate', { url: ORIGIN + '/__boot_perf_warm__' }); await sleep(800);
  if (HEADED) try { const v = JSON.parse(await ev('JSON.stringify([innerWidth, innerHeight])')); if (v[0] > 0 && v[1] > 0) VP = v; } catch (e) {}
  await cmd('Profiler.enable'); await cmd('Profiler.setSamplingInterval', { interval: 500 });
  await cmd('Profiler.start');
  const navT = Date.now();
  await cmd('Page.navigate', { url: URL });
  const shotAt = [0.2, 2, 5]; const taken = new Map(); let bootGoneWall = null;
  const snap = async name => {
    const r = await cmd('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: VP[0], height: VP[1], scale: 0.25 } });
    const buf = Buffer.from(r.result.data, 'base64');
    if (flag('shots')) {
      fs.mkdirSync(SHOTDIR, { recursive: true }); fs.writeFileSync(path.join(SHOTDIR, `boot_${TAG}_${name}.png`), buf);
      // ...and the full frame as a JPEG, for the eye (the PNG quarter is for the score)
      const j = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
      fs.writeFileSync(path.join(SHOTDIR, `boot_${TAG}_${name}.jpg`), Buffer.from(j.result.data, 'base64'));
    }
    return readPNG(buf);
  };
  const samples = [];
  // until SECS, and past that until the overlay has been gone 5.5 s (the
  // +5 s shot) - the sample that sees the drop can itself be held back by a
  // post-drop block; hard cap SECS + 30
  // --after N (22 Nov, for a slot's worth of loads): stop N seconds after the overlay is GONE instead of watching the
  // page to SECS whatever happened (a 110 s load under --secs 240 spends 130 s of box time on nothing); SECS is then
  // only the cap for a load that never ends. N >= 6 keeps the +5 s shot.
  const AFTER = Math.max(0, +opt('after', 0));
  const due = AFTER ? () => (bootGoneWall ? Date.now() - bootGoneWall < Math.max(6, AFTER) * 1000 : Date.now() - navT < SECS * 1000)
    : () => Date.now() - navT < SECS * 1000 || (bootGoneWall && Date.now() - bootGoneWall < 5500 && Date.now() - navT < (SECS + 30) * 1000);
  while (due()) {
    await sleep(250);
    let s = null; try { s = await ev(`(() => { const M = window.__M || {}; const st = (window.TREE_FILL && TREE_FILL.stat) ? TREE_FILL.stat() : null;
      const B = window.BOOT || null;
      return JSON.stringify({ t: +performance.now().toFixed(0), bootGone: M.bootGone || 0, tree: (typeof window.treeReady === 'function') ? treeReady() : null,
        fill: st ? { live: st.live, queued: st.queued } : null, props: (M.props||[]).length, chars: (M.chars||[]).length,
        boot: B ? { state: B.state, phase: B.current && B.current.id, pending: B.pending ? B.pending() : null } : null }); })()`); } catch (e) { continue; }
    if (!s) continue; s = JSON.parse(s); samples.push(s);
    if (s.bootGone && !bootGoneWall) bootGoneWall = Date.now();
    if (bootGoneWall) for (const k of shotAt) if (!taken.has(k) && Date.now() - bootGoneWall >= k * 1000) taken.set(k, await snap('plus' + k + 's'));
    if (flag('shots') && !s.bootGone && s.boot && s.boot.phase && !taken.has('ph:' + s.boot.phase)) { taken.set('ph:' + s.boot.phase, 1); await snap('loading_' + s.boot.phase); }
  }
  const still = { drop_vs_2s: stillness(taken.get(0.2), taken.get(2)), drop_vs_5s: stillness(taken.get(0.2), taken.get(5)), s2_vs_5s: stillness(taken.get(2), taken.get(5)) };
  // THE ROLL-OUT (--rollout, LOADING S3): press the button, watch the second
  // set of the overlay (its steps, its ms), the ring's state when it lifts,
  // and the stillness of the world in the seconds after - the trees must not
  // keep arriving in front of you
  let rollout = null;
  if (flag('rollout') && bootGoneWall) {
    // --pre-rollout-file <js file> (22 Nov): one expression awaited in the garage BEFORE the click (e.g. the clock set to
    // noon after a night load: the departure that re-keys every lit program). Its result is the run's `pre-rollout` line.
    let preOut = null;
    { const f = opt('pre-rollout-file', null);
      if (f) { try { const v = await ev(fs.readFileSync(f, 'utf8')); preOut = typeof v === 'string' ? v : JSON.stringify(v); } catch (e) { preOut = 'failed: ' + e.message; } await sleep(1500); } }
    let progs0 = null; try { progs0 = await ev("WORLD.renderer.info.programs.length"); } catch (e) {}
    const t0r = Date.now(), RSECS = +opt('rollout-secs', 90);
    // the button is #bGo today ("Fly the circuit"); the 'roll out' text is the September page's. Pressed again every
    // 2 s until the roll-out's screen shows or the page flies (RIG-PROCEDURE: "click #bGo until flying").
    const GO = "(()=>{const b=document.getElementById('bGo');if(b){b.click();return 1;}let n=0;[...document.querySelectorAll('button')].filter(b=>/roll out/i.test(b.textContent)).forEach(x=>{x.click();n++;});return n;})()";
    await ev(GO); let goClicks = 1;   // (a click DURING the roll-out shot skips the shot: the count says whether this run's did)
    let goneWall = null, lastGo = Date.now(), seen = false, flyWall = null; const rt = new Map();
    // --rollout-watch N (22 Nov eve): how long the page is watched AFTER the roll-out's screen lifts for the flight to begin
    // (default 8.5 s, the stills' span). With links still pending the reveal waits for them (app.js programsReady) and
    // 8.5 s saw no flight in three rows of the evening's window; a longer watch ends as soon as the flight is seen
    // (and the 8.5 s of stills are in).
    const WATCH = Math.max(8.5, +opt('rollout-watch', 8.5)) * 1000;
    while (Date.now() - t0r < RSECS * 1000 && !(goneWall && (Date.now() - goneWall > WATCH || (flyWall && Date.now() - goneWall > 8500)))) {
      await sleep(250);
      try { const f = JSON.parse(await ev("(()=>{const c=document.body.classList;return JSON.stringify({fly:c.contains('mode-fly')&&!c.contains('mode-ws')&&!c.contains('rollShot'),set:window.BOOT&&BOOT.set,state:window.BOOT&&BOOT.state});})()"));
        if (f.set === 'rollout' && f.state !== 'gone') seen = true;
        if (f.fly && !flyWall) flyWall = Date.now();
        // --rollout-once (23 Nov): Go is pressed ONCE, so the roll-out shot PLAYS (about 11 s): the departure a player sees
        if (!flag('rollout-once') && !seen && !f.fly && Date.now() - lastGo > 2000) { lastGo = Date.now(); await ev(GO); goClicks++; } } catch (e) {}
      let s = null; try { s = JSON.parse(await ev(`(() => { const B = window.BOOT; const st = (window.TREE_FILL && TREE_FILL.ringStat) ? TREE_FILL.ringStat() : null;
        return JSON.stringify({ state: B.state, set: B.set, phase: B.current && B.current.id, ring: st, flying: /TAXI|DOWNWIND|FINAL|STOPPED/.test(document.body.innerText) }); })()`)); } catch (e) { continue; }
      if (s.set === 'rollout' && s.state === 'gone' && !goneWall) { goneWall = Date.now(); rollout = { screenMs: goneWall - t0r, ring: s.ring }; }
      if (goneWall) for (const k of [0.3, 3, 8]) if (!rt.has(k) && Date.now() - goneWall >= k * 1000) rt.set(k, await snap('rollout_plus' + k + 's'));
      if (flag('shots') && !goneWall && s.phase && !rt.has('ph:' + s.phase)) { rt.set('ph:' + s.phase, 1); await snap('rollout_' + s.phase); }
    }
    if (!rollout) rollout = { screenMs: null, note: 'the roll-out screen never lifted in ' + RSECS + ' s' };
    rollout.flyMs = flyWall ? flyWall - t0r : null; rollout.goClicks = goClicks; rollout.programs0 = progs0; rollout.pre = preOut;
    rollout.still = { lift_vs_3s: stillness(rt.get(0.3), rt.get(3)), s3_vs_8s: stillness(rt.get(3), rt.get(8)) };
    try { rollout.log = JSON.parse(await ev("JSON.stringify(BOOT.log.filter(e => e.k === 'step' || e.k === 'show' || e.k === 'ready' || e.k === 'fail').slice(-12))")); } catch (e) {}
    try { rollout.ringAfter = JSON.parse(await ev("JSON.stringify(TREE_FILL.ringStat ? TREE_FILL.ringStat() : null)")); } catch (e) {}
    try { rollout.programs = await ev("WORLD.renderer.info.programs.length"); } catch (e) {}
    try { rollout.keys1 = JSON.parse(await ev("JSON.stringify(window.__PROGS1 || [])")); rollout.keys2 = JSON.parse(await ev("JSON.stringify(WORLD.renderer.info.programs.map(p => p.cacheKey))")); } catch (e) {}
    // the last programs made, in order: what the first frame compiled after the compile pass
    try { rollout.lastPrograms = JSON.parse(await ev("JSON.stringify(WORLD.renderer.info.programs.slice(-40).map(p => p.name + ' used' + p.usedTimes + ' ' + (p.cacheKey || '').replace(/[^A-Za-z0-9_,:|.-]/g, '').slice(0, 260)))")); } catch (e) {}
  }
  let gpu = null; try { gpu = JSON.parse(await ev(`(() => { const r = WORLD.renderer, g = r.getContext(), i = r.info; const d = g.getExtension('WEBGL_debug_renderer_info');
    return JSON.stringify({ programs: i.programs.length, geometries: i.memory.geometries, textures: i.memory.textures,
      canvas: g.drawingBufferWidth + 'x' + g.drawingBufferHeight, view: innerWidth + 'x' + innerHeight, dpr: devicePixelRatio,
      vis: document.visibilityState, focus: document.hasFocus(),
      parallel: !!g.getExtension('KHR_parallel_shader_compile'), gl: d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER) }); })()`)); } catch (e) { gpu = String(e); }
  // --eval-file <js file>: one expression read in the page at the end of the run, its (short) result printed as the
  // run's `eval` line and kept in the JSON - a row's own numbers (a FLYDIY_* counter, the longest world slice).
  // --dump-file <js file> <out file>: the same for a LARGE result (a saved flight log): written to the out file whole.
  let evalOut = null;
  { const f = opt('eval-file', null);
    if (f) try { const v = await ev(fs.readFileSync(f, 'utf8')); evalOut = typeof v === 'string' ? v : JSON.stringify(v); } catch (e) { evalOut = 'eval failed: ' + e.message; }
    const di = argv.indexOf('--dump-file');
    // (kept in the page and fetched 4 MB at a time: one CDP answer of a 15-30 MB flight log is slow or refused)
    if (di >= 0 && argv[di + 2]) try { const NL = String.fromCharCode(10);
      const ex = fs.readFileSync(argv[di + 1], 'utf8').split(NL).filter(l => !/^\s*\/\//.test(l)).join(NL).replace(/[;\s]+$/, '');   // (its comment lines and a last ';' off: it is wrapped as ONE expression)
      const len = await ev('(window.__BPD = String((' + NL + ex + NL + '))).length'); let v = '';
      for (let a = 0; a < len; a += 4000000) v += await ev('window.__BPD.slice(' + a + ', ' + (a + 4000000) + ')');
      await ev('(window.__BPD = null, 0)');
      fs.mkdirSync(path.dirname(path.resolve(argv[di + 2])), { recursive: true }); fs.writeFileSync(argv[di + 2], v);
      console.log('  dump ' + argv[di + 2] + ' ' + fs.statSync(argv[di + 2]).size + ' bytes'); } catch (e) { console.log('  dump failed: ' + e.message); } }
  const prof = (await cmd('Profiler.stop')).result.profile;
  // --window a,b (ms of the page's clock, roughly): the self time by function inside it
  const WIN = opt('window', null);
  if (WIN) {
    const [wa, wb] = WIN.split(',').map(Number); const nodes2 = new Map(prof.nodes.map(n => [n.id, n]));
    let t = 0; const acc = new Map();
    // the profile's clock starts ~at the navigation; the page's at its first script - within ~0.3 s
    for (let i = 0; i < prof.samples.length; i++) { t += (prof.timeDeltas[i] || 0) / 1000;
      if (t < wa || t > wb) continue; const cf = nodes2.get(prof.samples[i]).callFrame;
      const k = (cf.url ? cf.url.replace(/\?.*$/, '').replace(/^.*\//, '') : '(native)') + ' ' + (cf.functionName || '(anon)') + ':' + (cf.lineNumber + 1);
      acc.set(k, (acc.get(k) || 0) + (prof.timeDeltas[i] || 0)); }
    console.log('  WINDOW ' + wa + '-' + wb + ' ms: ' + [...acc].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([k, v]) => k + ' ' + (v / 1000 | 0)).join('  |  '));
  }
  const M = JSON.parse(await ev('JSON.stringify(window.__M)'));
  let bootLog = null; try { bootLog = JSON.parse(await ev('JSON.stringify(window.BOOT ? BOOT.log : null)')); } catch (e) {}
  // self time by file and function; inclusive time for the boot's named steps
  const nodes = new Map(prof.nodes.map(n => [n.id, n]));
  const selfByNode = new Map();
  for (let i = 0; i < prof.samples.length; i++) selfByNode.set(prof.samples[i], (selfByNode.get(prof.samples[i]) || 0) + (prof.timeDeltas[i] || 0));
  const byFile = new Map(), byFn = new Map(); let total = 0;
  const base = u => u ? u.replace(/\?.*$/, '').replace(/^.*\//, '') : '(native)';
  for (const [nid, us] of selfByNode) { const n = nodes.get(nid); const cf = n.callFrame; total += us;
    const f = base(cf.url) || '(program)'; const fn = f + ' ' + (cf.functionName || '(anon)') + ':' + (cf.lineNumber + 1);
    byFile.set(f, (byFile.get(f) || 0) + us); byFn.set(fn, (byFn.get(fn) || 0) + us); }
  const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => [k, +(v / 1000).toFixed(0)]);
  const parent = new Map(); for (const n of prof.nodes) for (const c of (n.children || [])) parent.set(c, n.id);
  const KEYS = ['buildWorldScene', 'makeWorld', 'genHangarBuild', 'buildGen', 'CAGE_UI_BOOT', 'bakeImpostorAtlasNow', 'plantWoodland', 'bakeHangarEnv', 'renderSky', 'openEditor', 'setAircraft', 'seedEditor', 'buildModel', 'makeIsland', 'bakeGroundShadow', 'syncBuild', 'fromScene', 'fillStep', 'compileAsync', 'compile', 'makeSim', 'getHangar', 'enterGarage', 'treeBuild', 'coverageMips', 'decodeModel', 'fillPropMesh', 'genShakedown', 'bakeGround', 'apply', 'render', 'colorAt', 'terrainH', 'surface', 'h0a', 'forestHere', 'walk', 'treeSettle'];
  const incl = new Map();
  for (const [nid, us] of selfByNode) { let p = nid; const seen = new Set();
    while (p !== undefined) { const n = nodes.get(p); const fn = n.callFrame.functionName; const key = fn + ' @' + base(n.callFrame.url);
      if (KEYS.includes(fn) && !seen.has(key)) { seen.add(key); incl.set(key, (incl.get(key) || 0) + us); } p = parent.get(p); } }
  const reqs = netOrder.map(r => net.get(r)).filter(r => r && r.t1);
  const t0n = Math.min(...reqs.map(r => r.t0));
  const netRows = reqs.map(r => ({ url: r.url.replace(ORIGIN + '/flyDiy/', ''), t0: +((r.t0 - t0n) * 1000).toFixed(0), t1: +((r.t1 - t0n) * 1000).toFixed(0), kb: +((r.bytes || 0) / 1024).toFixed(0), type: r.type, failed: r.failed }));
  const bytesByDir = new Map(); for (const r of netRows) { const d = r.url.replace(/\?.*$/, '').split('/').slice(0, 2).join('/'); bytesByDir.set(d, (bytesByDir.get(d) || 0) + r.kb); }
  // ...and one level deeper under media/ (media/tex/signs, media/geo/props): which TABLE the bytes belong to
  const bytesBySub = new Map(); for (const r of netRows) { const p = r.url.replace(/\?.*$/, '').split('/'); if (p[0] !== 'media') continue; const d = p.slice(0, 3).join('/'); const v = bytesBySub.get(d) || [0, 0]; v[0] += r.kb; v[1]++; bytesBySub.set(d, v); }
  const byType = {}; for (const r of netRows) byType[r.type] = (byType[r.type] || 0) + r.kb;
  const longSum = M.longTasks.reduce((a, e) => a + e.d, 0);
  const longTop = M.longTasks.slice().sort((a, b) => b.d - a.d).slice(0, 8);
  const out = { url: URL, tag: TAG, evalOut, cold: flag('cold'), secs: SECS, date: new Date().toISOString().slice(0, 10), gpu, rollout,
    milestones: M.ev, bootGone: M.bootGone || null, bootLog, paints: M.paints, propsLanded: M.props.length, charsLanded: M.chars.length,
    fetches: M.fetches.length, longTaskTotalMs: longSum, longTasks: longTop, profileTotalMs: +(total / 1000).toFixed(0), stillness: still,
    byFile: top(byFile, 25), byFn: top(byFn, 40), inclusive: [...incl].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v / 1000).toFixed(0)]),
    netTotalKB: netRows.reduce((a, r) => a + r.kb, 0), netRequests: netRows.length, netFailed: netRows.filter(r => r.failed).length,
    netByType: byType, bytesByDir: [...bytesByDir].sort((a, b) => b[1] - a[1]).slice(0, 12),
    bytesBySub: [...bytesBySub].sort((a, b) => b[1][0] - a[1][0]).map(([k, v]) => [k, v[0], v[1]]),
    bigFiles: netRows.filter(r => r.kb >= 300).sort((a, b) => b.kb - a.kb).slice(0, 40).map(r => [r.url.replace(/\?.*$/, ''), r.kb, r.t1]), samples };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`boot_perf ${TAG}  ${URL}\n  gpu ${gpu && gpu.gl}  programs ${gpu && gpu.programs}  parallel-compile ${gpu && gpu.parallel}`);
  console.log(`  ${HEADED ? 'HEADED' : 'headless'} window ${SW}x${SH}  view ${gpu && gpu.view}  canvas ${gpu && gpu.canvas}  dpr ${gpu && gpu.dpr}  page ${gpu && gpu.vis}${gpu && gpu.focus ? ', focused' : ', NOT focused'}`);
  if (evalOut !== null) console.log('  eval ' + String(evalOut).replace(/\s+/g, ' ').slice(0, 600));
  console.log('  milestones: ' + M.ev.map(e => e.k + '@' + e.t).join('  '));
  if (bootLog) {
    // the steps with their ms, the marks, and the landings folded per key
    const marks = bootLog.filter(e => e.k !== 'landed').map(e => e.k + (e.id ? ':' + e.id : '') + '@' + e.t + (e.ms !== undefined ? ' (' + e.ms + ' ms)' : ''));
    const perKey = {}; for (const e of bootLog) if (e.k === 'landed') { const q = perKey[e.key] || (perKey[e.key] = { n: 0, failed: 0, last: 0 }); q.n++; if (!e.ok) q.failed++; q.last = e.t; }
    console.log('  BOOT.log:   ' + marks.join('  '));
    console.log('  landings:   ' + Object.entries(perKey).map(([k, q]) => k + ' ' + q.n + (q.failed ? ' (' + q.failed + ' failed)' : '') + ' by ' + q.last).join('  '));
  }
  console.log(`  overlay gone ${M.bootGone} ms   long tasks ${longSum} ms in ${M.longTasks.length}: ` + longTop.map(t => t.d + '@' + t.t).join(' '));
  console.log(`  stillness (mean |dpx|, 0 = nothing changed after the drop): drop->2s ${still.drop_vs_2s}  drop->5s ${still.drop_vs_5s}  2s->5s ${still.s2_vs_5s}`);
  console.log(`  network ${(out.netTotalKB / 1024).toFixed(1)} MB / ${out.netRequests} req (failed ${out.netFailed})  ` + Object.entries(byType).map(([k, v]) => k + ' ' + (v / 1024).toFixed(1) + ' MB').join(', '));
  console.log('  media by table: ' + out.bytesBySub.slice(0, 14).map(([k, kb, n]) => k.replace(/^media\//, '') + ' ' + (kb / 1024).toFixed(1) + ' MB/' + n).join(', '));
  if (rollout) console.log('  rollout: screen ' + rollout.screenMs + ' ms, flying after ' + rollout.flyMs + ' ms (Go clicked ' + rollout.goClicks + 'x' + (rollout.goClicks > 1 ? ': the 2nd click skips the roll-out shot, about 11 s when it plays' : ': the roll-out shot played') + '), programs ' + rollout.programs0 + ' -> ' + rollout.programs + (rollout.pre ? ', pre-rollout ' + String(rollout.pre).slice(0, 200) : ''));
  if (rollout) console.log('  ROLL-OUT: screen ' + rollout.screenMs + ' ms  steps ' + ((rollout.log || []).filter(e => e.k === 'step').map(e => e.id + ':' + e.ms).join(' ')) + '  ring at lift ' + JSON.stringify(rollout.ring) + '  after ' + JSON.stringify(rollout.ringAfter) + '  programs ' + rollout.programs + '  stillness lift->3s ' + rollout.still.lift_vs_3s + '  3s->8s ' + rollout.still.s3_vs_8s + (rollout.note ? '  ' + rollout.note : ''));
  console.log('  props landed ' + M.props.length + '  chars ' + M.chars.length + '  ASSET_FETCH ' + M.fetches.length);
  console.log('  inclusive ms: ' + out.inclusive.slice(0, 16).map(([k, v]) => pad(k.split(' @')[0], 18) + v).join('\n                '));
  console.log('  self by file ms: ' + out.byFile.slice(0, 10).map(([k, v]) => k + ' ' + v).join(', '));
  if (COMPARE && fs.existsSync(COMPARE)) { const c = JSON.parse(fs.readFileSync(COMPARE, 'utf8'));
    console.log(`  vs ${path.basename(COMPARE)}: overlay gone ${c.bootGone} -> ${M.bootGone} ms; long tasks ${c.longTaskTotalMs} -> ${longSum} ms; network ${(c.netTotalKB / 1024).toFixed(1)} -> ${(out.netTotalKB / 1024).toFixed(1)} MB; programs ${c.gpu && c.gpu.programs} -> ${gpu && gpu.programs}`); }
  console.log('  wrote ' + path.relative(process.cwd(), OUT));
  // --udd: the profile is read by the NEXT run, so Chrome closes itself (Browser.close on the browser's own socket,
  // 20 s at most) and has the time to write its GPU shader cache to disk; a kill would leave the next run cold.
  if (opt('udd', null)) {
    const gone = new Promise(r => ch.once('exit', r));
    try { const v = await getJSON('http://127.0.0.1:' + PORT + '/json/version');
      const bw = new WebSocket(v.webSocketDebuggerUrl); await new Promise((r, j) => { bw.onopen = r; bw.onerror = j; });
      bw.send(JSON.stringify({ id: 1, method: 'Browser.close' })); } catch (e) { console.log('  Browser.close failed: ' + e.message); }
    const how = await Promise.race([gone.then(() => 'closed itself'), sleep(20000).then(() => 'KILLED after 20 s (its shader cache may not be on disk)')]);
    console.log('  chrome ' + how); if (ch.exitCode === null) ch.kill();
    return;
  }
  ws.close(); ch.kill();
})().catch(e => { console.error(e); ch.kill(); process.exit(1); });
