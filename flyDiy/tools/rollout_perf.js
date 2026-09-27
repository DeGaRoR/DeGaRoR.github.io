#!/usr/bin/env node
// rollout_perf.js - THE ROLL-OUT AS THE PLAYER LIVES IT (A0, Jolene playtest 2026-09-26)
//
// Every other rig in tools/ measures a PAUSED scene after the streamers settled (frame_perf,
// tree_perf, premises_perf) or the boot alone (boot_perf) - and every one of them runs in a RIG
// browser, which G586's frame clock keeps on the legacy one-step-a-call clock. The window the user
// found unplayable is none of those: the first minutes after the roll-out screen lifts, the sim
// running on the WALL clock (steps owed per frame, the auto 60/30 cap), the pilot taxiing, the far
// premises still streaming in. This rig measures exactly that window:
//   - a HEADED Chrome (not headless: navigator.webdriver false, no HeadlessChrome UA -> the live
//     clock), vsync ON (the player's frame pacing), at the player's viewport;
//   - --cold: a fresh profile (no shader cache, no service worker, no IndexedDB bake cache = a first
//     visit from GitHub Pages); default: a persistent profile warmed by a previous run;
//   - the page's own loop is read through FLYDIY_PACE.end (called once per rendered frame with the
//     loop's JS work and its solver ms), WORLD.worldUpdate is timed, long tasks are observed from
//     the first byte, and each frame also records the phase, the premises queue and the cap.
// Variants need no code change: --build <file.json> loads a garage build into the WIP slot (none = the OLD
// STOCK, GEN_DEFAULT, pinned by tools/_stock_pin.js since G770; `--build default` = the new first boot, the Cub),
// --variant nomet filters Metlakatla (mk_*) out of the premises through the WORLD rail's saved-copy
// slot, --gfx '{"shadows":"off"}' pre-sets graphics rows, --world none boots the analytic world.
//
// THE ROLLOUT TARGETS (batch A gate, futureDesigns/PLAYTEST-2026-09-26.md): after the reveal no
// frame over 100 ms, never more than 3 s in a row below 30 fps, stand + taxi median >= 50 fps, and no
// main-thread task over 1 s anywhere (boot and roll-out included). Printed as PASS/FAIL lines, but
// this is a MEASUREMENT (GPU + headed browser), not a battery gate.
//
// Usage: node tools/rollout_perf.js [--cold] [--secs 150] [--build "bugReports/cessnaMetal (1).json"]
//          [--variant base|nomet|nopremises] [--gfx '<json>'] [--world jolene|none] [--page index.html|dev.html]
//          [--size 2216x1023] [--label name] [--out tools/perf/rollout_<label>.json] [--quiet]
//          [--port 8531] [--fallback D:/Dev/DeGaRoR.github.io] [--q 'depth=log'] [--shot 5,20]
//          [--profile] (a CPU profile of the roll-out screen, summarised) [--progwatch] (the slowest program links)
//          [--settings ['shadows=off,shadows=full,preset=potato,preset=gamer']] (G680: the settings-change probe, below)
//          [--chrome-flag '--gpu-program-cache-size-kb=262144'] (G680: an extra Chrome switch, e.g. G584's cache-size test)
//          [--profile-boot] (G680: a CPU profile of the garage boot, <label>_boot.cpuprofile)
// THE SETTINGS PROBE (G680, A4-FREEZE: "no freezing ever ... This includes possible setting changes"): after the
// recording window, each change of the list is made the way a pick in the GRAPHICS menu makes it (gfx_settings.js
// pick: GFX.set, then FLYDIY_SETTLE - the settings screen), one at a time, each waited out (the screen gone, its
// chain done, 2 s of quiet); its long tasks, its worst task and the screen's time are printed, and the ROLLOUT line
// settingsLongTask1s says whether any change held the main thread over 1 s (R4 counts a settings change).
// It prints the premises stream's slow builds (WORLD.premises.streamState, G591) and closes Chrome through CDP before
// the kill (a killed Chrome drops its GPU program cache writes: every 'warm' run linked cold).
// Starts its own static server (tools/_serve.js) on the repo root (with --fallback for a worktree's
// gitignored data) unless --url is given.
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const COLD = flag('cold');
const SECS = +opt('secs', 150);
const BUILD = opt('build', null);
const VARIANT = opt('variant', 'base');
const GFX = opt('gfx', null);
const WORLDN = opt('world', null);
const PAGE = opt('page', 'index.html');
const SIZE = opt('size', '2216x1023').split('x').map(Number);
const LABEL = opt('label', [COLD ? 'cold' : 'warm', VARIANT, BUILD ? path.basename(BUILD, '.json').replace(/\W+/g, '') : 'stock', WORLDN || 'jolene'].join('_'));
const OUT = opt('out', path.join(__dirname, 'perf', 'rollout_' + LABEL + '.json'));
const SPORT = +opt('port', 8531);
const REPO = path.resolve(__dirname, '..', '..');
const FALLBACK = opt('fallback', null);
let URL = opt('url', null);

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find(p => fs.existsSync(p));
if (!CHROME) { console.error('rollout_perf: no Chrome found'); process.exit(2); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => {
  http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej);
});
const gpuUtil = () => { try { return +execSync('nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits', { stdio: ['ignore', 'pipe', 'ignore'], timeout: 4000 }).toString().trim(); } catch (e) { return -1; } };
const cpuLoad = () => { try { return +execSync('powershell -NoProfile -Command "(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average"', { stdio: ['ignore', 'pipe', 'ignore'], timeout: 8000 }).toString().trim(); } catch (e) { return -1; } };

// ---- the static server -----------------------------------------------------
let server = null;
if (!URL) {
  const a = [path.join(__dirname, '_serve.js'), String(SPORT), REPO];
  if (FALLBACK) a.push('--fallback', FALLBACK);
  server = spawn(process.execPath, a, { stdio: 'ignore' });
  URL = 'http://localhost:' + SPORT + '/flyDiy/' + PAGE;
}
const q = [];
if (WORLDN) q.push('world=' + WORLDN);
if (VARIANT === 'nopremises') q.push('premises=none');
// --q 'a=1&b=2': extra URL parameters (a switch under test: ?depth=log, ?cover=0 ...)
if (opt('q', null)) q.push(opt('q'));
// --shot <s>[,<s>...]: PNG captures that many seconds after the reveal (tools/perf/rollout_<label>_<s>s.png)
const SHOTS = (opt('shot', '') || '').split(',').filter(Boolean).map(Number);
// --shot-eval '<js>' (G672): evaluated before each shot, then 0.8 s of frames (an orbit set for the propeller: FLIGHT_PROBE.camSet)
const SHOT_EVAL = opt('shot-eval', null);
// --profile-live <at>,<secs>: a CPU profile window of the live game (below); --eval '<js>': an expression evaluated in the page at the end of the
// recording (a census: renderer.info, a module's stats), its value printed and kept in the JSON
const PROFILE_LIVE = opt('profile-live', null);
const EVAL = (e => e && e[0] === '@' ? fs.readFileSync(path.resolve(e.slice(1)), 'utf8') : e)(opt('eval', null));   // '@tools/rollout_census.js': from a file
const SETTINGS = flag('settings') ? (() => { const v = opt('settings', null); return (v && !v.startsWith('--') ? v : 'shadows=off,shadows=full,preset=potato,preset=gamer').split(',').map(x => x.split('=')); })() : null;
const CHROME_FLAGS = argv.reduce((a, x, i) => (x === '--chrome-flag' && argv[i + 1] ? a.concat([argv[i + 1]]) : a), []);
if (q.length) URL += (URL.includes('?') ? '&' : '?') + q.join('&');

// ---- what the page is given before its first script --------------------------
function preScript() {
  const lines = [];
  // a warm profile keeps localStorage between runs: every run states its build and graphics afresh
  // G770: no --build is THE OLD STOCK, pinned by name (tools/_stock_pin.js) - a fresh first boot is the Cub
  // since G770, and every 'stock' row measured before it was GEN_DEFAULT's; `--build default` measures that
  // new first boot (no working build at all)
  if (BUILD === 'default') lines.push('try{localStorage.removeItem("flydiy.wip")}catch(e){}');
  else if (BUILD) {
    const txt = fs.readFileSync(path.resolve(REPO, 'flyDiy', BUILD), 'utf8');
    lines.push('try{localStorage.setItem("flydiy.wip",' + JSON.stringify(txt) + ')}catch(e){}');
  } else lines.push(require('./_stock_pin.js').pinScript());
  lines.push('try{localStorage.removeItem("flydiy.gfx")}catch(e){}');
  if (VARIANT === 'nomet') {
    const F = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'island_jolene.json'), 'utf8'));
    let cut = 0;
    for (const k of Object.keys(F.layers)) if (Array.isArray(F.layers[k])) {
      const n = F.layers[k].length;
      F.layers[k] = F.layers[k].filter(e => !(e && typeof e.id === 'string' && e.id.startsWith('mk_')));
      cut += n - F.layers[k].length;
    }
    console.log('  variant nomet: ' + cut + ' mk_ records removed (rev ' + F.rev + ' kept, so the saved copy wins)');
    lines.push('try{localStorage.setItem("flydiy.premises.game.jolene",' + JSON.stringify(JSON.stringify(F)) + ')}catch(e){}');
  } else {
    lines.push('try{localStorage.removeItem("flydiy.premises.game.jolene")}catch(e){}');
  }
  if (GFX) lines.push('try{localStorage.setItem("flydiy.gfx",JSON.stringify(' + GFX + '))}catch(e){}');
  // resource timing keeps 250 entries by default and a boot fetches more: raised before the first fetch so
  // an --eval census (tools/asset_census.js --runtime, G902) sees every URL; the size rides in __RTBUF
  lines.push('try{performance.setResourceTimingBufferSize(20000);window.__RTBUF=20000}catch(e){}');
  // the recorder's early half: long tasks from the first byte (buffered), and the boot's own clock
  lines.push(`(function(){ if (window.__RP) return; var R = window.__RP = { t0: performance.now(), lt: [], ev: [] };
    try { new PerformanceObserver(function(l){ l.getEntries().forEach(function(e){ R.lt.push([Math.round(e.startTime), Math.round(e.duration)]); }); }).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  })();`);
  return lines.join('\n');
}

// ---- the page-side recorder, installed once the game exists --------------------
const INSTALL = `(() => {
  const R = window.__RP; if (R.on) return 'have';
  const P = window.FLYDIY_PACE; if (!P) throw new Error('no FLYDIY_PACE');
  R.fr = []; R.on = true; R.rev = 0;
  const endW = P.end.bind(P);
  let wuMs = 0;
  const W = window.WORLD;
  if (W && W.worldUpdate && !W.__rpW) { const wu = W.worldUpdate; W.worldUpdate = function (cg) { const t = performance.now(); const r = wu.apply(this, arguments); wuMs += performance.now() - t; return r; }; W.__rpW = 1; }
  // the CPU side of every renderer.render() (the scene, the mirror, the probes: submit + any sync
  // stall), three's shadow pass inside it, and each premises stream step
  let rMs = 0, shMs = 0, pmMs = 0, pmN = 0;
  const RD = W && W.renderer;
  if (RD && !RD.__rp) { const rr = RD.render; RD.render = function () { const t = performance.now(); const x = rr.apply(this, arguments); rMs += performance.now() - t; return x; };
    const SM = RD.shadowMap; if (SM && SM.render) { const sr = SM.render; SM.render = function () { const t = performance.now(); const x = sr.apply(this, arguments); shMs += performance.now() - t; return x; }; }
    RD.__rp = 1; }
  const PR = W && W.premises;
  // the stream: step (a live edit, the old one-every-third-frame) and, since G591, stream (the aircraft-centred bank)
  if (PR && PR.step && !PR.__rp) { for (const k of ['step', 'stream']) if (PR[k]) { const ps = PR[k]; PR[k] = function () { const t = performance.now(); const x = ps.apply(this, arguments); pmMs += performance.now() - t; if (x) pmN++; return x; }; } PR.__rp = 1; }
  let lastNow = 0;
  const ph = document.getElementById('phName');
  const prem = () => { const p = W && W.premises; return p && p.stats ? p.stats.queued : -1; };
  P.end = function (workMs, physMs, steps, now) {
    const st = P.state();
    let agl = null, x = null, z = null; try { const s = window.FLIGHT_PROBE && FLIGHT_PROBE.sim(); if (s) { const cg = s.cgPos(); agl = cg[1] - FLIGHT_PROBE.world().terrainH(cg[0], cg[2]); x = cg[0]; z = cg[2]; } } catch (e) {}
    R.fr.push([ +now.toFixed(1), lastNow ? +(now - lastNow).toFixed(2) : 0, +workMs.toFixed(2), +physMs.toFixed(2), steps, +wuMs.toFixed(2), st.cap, ph ? ph.textContent : '', prem(), agl == null ? null : +agl.toFixed(1),
      +rMs.toFixed(2), +shMs.toFixed(2), +pmMs.toFixed(2), pmN, x == null ? null : +x.toFixed(2), z == null ? null : +z.toFixed(2) ]);
    lastNow = now; wuMs = 0; rMs = 0; shMs = 0; pmMs = 0; pmN = 0;
    return endW(workMs, physMs, steps, now);
  };
  return 'installed';
})()`;

const med = a => { if (!a.length) return 0; const f = a.slice().sort((x, y) => x - y); return f[f.length >> 1]; };
const pct = (a, p) => { if (!a.length) return 0; const f = a.slice().sort((x, y) => x - y); return f[Math.min(f.length - 1, Math.floor(f.length * p))]; };

(async () => {
  if (flag('quiet')) {
    const t0 = Date.now(); let u = gpuUtil(), calm = 0;
    while (u >= 0 && Date.now() - t0 < 20 * 60000) { if (u < 15) { if (++calm >= 3) break; } else calm = 0; await sleep(4000); u = gpuUtil(); }
    console.log('rollout_perf: GPU ' + u + ' % after ' + ((Date.now() - t0) / 1000 | 0) + ' s of waiting');
  }
  const box = { gpuUtil: gpuUtil(), cpuLoad: cpuLoad() };
  const DPORT = 9300 + (process.pid % 500);
  const UDD = COLD ? path.join(os.tmpdir(), 'rollout_cold_' + DPORT + '_' + Date.now()) : path.join(os.tmpdir(), 'flydiy_rollout_warm_profile');
  const ch = spawn(CHROME, ['--remote-debugging-port=' + DPORT, '--window-size=' + (SIZE[0] + 16) + ',' + (SIZE[1] + 140),
    '--window-position=0,0', '--no-first-run', '--no-default-browser-check', '--user-data-dir=' + UDD,
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'].concat(CHROME_FLAGS, ['about:blank']), { stdio: 'ignore' });
  const kill = () => { try { if (process.platform === 'win32') execSync('taskkill /PID ' + ch.pid + ' /T /F', { stdio: 'ignore' }); else ch.kill(); } catch (e) {}
    if (server) try { if (process.platform === 'win32') execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore' }); else server.kill(); } catch (e) {} };
  process.on('exit', kill);
  let tgt = null;
  for (let i = 0; i < 50 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + DPORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  if (!tgt) throw new Error('no page target');
  const ws = new WebSocket(tgt.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map(); const exc = [];
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') exc.push((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text || '').split('\n')[0]); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (expr, timeoutMs) => {
    const p = cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    const r = await (timeoutMs ? Promise.race([p, sleep(timeoutMs).then(() => ({ result: { result: { value: '__timeout' } } }))]) : p);
    const d = r.result;
    if (!d || d.exceptionDetails) throw new Error('page: ' + (d && d.exceptionDetails ? (d.exceptionDetails.exception && d.exceptionDetails.exception.description || d.exceptionDetails.text) : JSON.stringify(r)));
    return d.result.value;
  };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: preScript() });
  await cmd('Emulation.setDeviceMetricsOverride', { width: SIZE[0], height: SIZE[1], deviceScaleFactor: 1, mobile: false });
  await cmd('Page.bringToFront');
  // --profile-boot (G680): a CPU profile of the garage boot, from the navigation to "ready", saved as <label>_boot.cpuprofile
  const PROFILE_BOOT = flag('profile-boot');
  if (PROFILE_BOOT) { await cmd('Profiler.enable'); await cmd('Profiler.setSamplingInterval', { interval: 1000 }); await cmd('Profiler.start'); }
  const tNav = Date.now();
  await cmd('Page.navigate', { url: URL });
  await sleep(2000);
  const boot = await ev("(() => Promise.race([(window.BOOT && BOOT.whenReady) ? BOOT.whenReady().then(() => 'ready') : new Promise(r => setTimeout(() => r('no BOOT'), 30000)), new Promise(r => setTimeout(() => r('boot timeout'), 240000))]))()", 250000);
  const tGarage = (Date.now() - tNav) / 1000;
  console.log('rollout_perf [' + LABEL + '] ' + URL);
  console.log('  garage ready: ' + boot + ' after ' + tGarage.toFixed(1) + ' s');
  if (PROFILE_BOOT) { await sleep(5000);   // the boot's own tail after the lift (the see-through programs at +1.5 s)
    const pr = (await cmd('Profiler.stop')).result.profile; fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT.replace(/.json$/, '_boot.cpuprofile'), JSON.stringify(pr)); console.log('  boot profile -> ' + OUT.replace(/.json$/, '_boot.cpuprofile')); }
  const KEEP = "(()=>{const l=[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0&&b.offsetParent);l.forEach(x=>x.click());return l.length;})()";
  for (let i = 0; i < 10; i++) { const n = await ev(KEEP); await sleep(400); if (!n && i > 3) break; }
  await sleep(1500);
  const gpu = await ev("(()=>{const c=document.createElement('canvas').getContext('webgl2');const d=c&&c.getExtension('WEBGL_debug_renderer_info');return d?c.getParameter(d.UNMASKED_RENDERER_WEBGL):'?';})()");
  const gfx0 = await ev('JSON.stringify(window.GFX ? GFX.get() : null)');
  console.log('  ' + gpu + ' · gfx ' + gfx0);
  // --profile: a CPU profile of the roll-out screen (the click to the reveal), saved next to the JSON and summarised
  // by self and inclusive time per function (G591: where the roll-out's long tasks go)
  const PROFILE = flag('profile');
  if (PROFILE) { await cmd('Profiler.enable'); await cmd('Profiler.setSamplingInterval', { interval: 1000 }); await cmd('Profiler.start'); }
  // ROLL OUT
  const tRoll = Date.now();
  await ev("(()=>{[...document.querySelectorAll('button')].filter(b=>/roll out/i.test(b.textContent)&&b.offsetParent).forEach(x=>x.click());return 1;})()");
  // the roll-out screen: wait for the overlay to go (the reveal)
  let bs = '', installed = false;
  for (let i = 0; i < 400; i++) {
    bs = await ev("window.BOOT ? BOOT.state : 'none'", 20000);
    // --progwatch: every program three made, when it was first seen pending and when it was ready (the compile step's slow links)
    if (flag('progwatch')) await ev("(() => { const P = window.__PW || (window.__PW = new Map()); const R = window.WORLD && WORLD.renderer; if (!R || !R.info || !R.info.programs) return 0; const t = performance.now(); for (const pr of R.info.programs) { let e = P.get(pr); if (!e) P.set(pr, e = { n: pr.name, k: String(pr.cacheKey).slice(0, 40) + '#' + (() => { let h = 2166136261; const c = String(pr.cacheKey); for (let i = 0; i < c.length; i++) h = Math.imul(h ^ c.charCodeAt(i), 16777619) >>> 0; return h.toString(16) + '/' + c.length; })(), t0: t, t1: null }); if (e.t1 == null && (!pr.isReady || pr.isReady())) e.t1 = t; } if (!window.__PWI) window.__PWI = setInterval(() => { const t = performance.now(); for (const pr of R.info.programs) { let e = P.get(pr); if (!e) P.set(pr, e = { n: pr.name, k: String(pr.cacheKey).slice(0, 40) + '#' + (() => { let h = 2166136261; const c = String(pr.cacheKey); for (let i = 0; i < c.length; i++) h = Math.imul(h ^ c.charCodeAt(i), 16777619) >>> 0; return h.toString(16) + '/' + c.length; })(), t0: t, t1: null }); if (e.t1 == null && (!pr.isReady || pr.isReady())) e.t1 = t; } }, 100); return P.size; })()", 20000);
    if (!installed && await ev('!!(window.FLYDIY_PACE && window.WORLD && WORLD.worldUpdate)', 20000)) { installed = (await ev(INSTALL)) !== ''; }
    if ((bs === 'gone' || bs === 'none') && Date.now() - tRoll > 3000) break;
    await sleep(500);
  }
  if (!installed) await ev(INSTALL);
  if (PROFILE) {
    const pr = (await cmd('Profiler.stop')).result.profile;
    fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT.replace(/.json$/, '.cpuprofile'), JSON.stringify(pr));
    const byId = new Map(pr.nodes.map(n => [n.id, n])), self = new Map(), dt = new Map();
    for (let i = 0; i < pr.samples.length; i++) dt.set(pr.samples[i], (dt.get(pr.samples[i]) || 0) + (pr.timeDeltas[i] || 0) / 1000);
    const par = new Map(); for (const n of pr.nodes) for (const c of (n.children || [])) par.set(c, n.id);
    const key = n => (n.callFrame.functionName || '(anon)') + ' ' + (n.callFrame.url || '').split('/').pop() + ':' + (n.callFrame.lineNumber + 1);
    const incl = new Map();
    for (const [id, ms] of dt) { const n = byId.get(id); self.set(key(n), (self.get(key(n)) || 0) + ms); const seen = new Set(); for (let x = id; x != null; x = par.get(x)) { const k = key(byId.get(x)); if (seen.has(k)) continue; seen.add(k); incl.set(k, (incl.get(k) || 0) + ms); } }
    const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => '    ' + (v / 1000).toFixed(2).padStart(7) + ' s  ' + k).join('\n');
    console.log('  profile, self:\n' + top(self, 25) + '\n  profile, inclusive:\n' + top(incl, 40));
  }
  const revealAt = await ev('performance.now()');
  const tReveal = (Date.now() - tRoll) / 1000;
  console.log('  roll-out screen: ' + bs + ' after ' + tReveal.toFixed(1) + ' s');
  // the flight: make sure the sim runs (the circuit button, if the roll-out left it held)
  await sleep(1500);
  const t1 = await ev('FLIGHT_PROBE.sim().t'); await sleep(1500); const t2 = await ev('FLIGHT_PROBE.sim().t');
  if (!(t2 > t1)) { await ev("(()=>{const b=document.getElementById('bGo');if(b&&b.offsetParent)b.click();const p=document.getElementById('bPause');if(p&&/run/i.test(p.textContent))p.click();return 1;})()"); }
  // record SECS seconds of the live game
  const every = 10;
  const shots = [];
  const tRec = Date.now();
  // --profile-live <at>,<secs> (A1-STAND G600): a V8 CPU profile of the live game from <at> s after the reveal for <secs> s -
  // self time by function and by script (three's minified internals read as `three.min.js`), written beside the JSON
  // as <label>_live.cpuprofile (DevTools opens it). The sampler costs a little: read the frame numbers from a run without it.
  let profDone = Promise.resolve(null);
  if (PROFILE_LIVE) profDone = (async () => {
    const [pAt, pSecs] = PROFILE_LIVE.split(',').map(Number);
    await sleep(Math.max(0, pAt * 1000 - (Date.now() - tRec)));
    await cmd('Profiler.enable'); await cmd('Profiler.setSamplingInterval', { interval: 250 });
    await cmd('Profiler.start'); await sleep((pSecs || 10) * 1000);
    const r = await cmd('Profiler.stop');
    return r.result && r.result.profile;
  })();
  for (const at of SHOTS) {
    const wait = at * 1000 - (Date.now() - tRec); if (wait > 0) await sleep(wait);
    if (SHOT_EVAL) { await ev('(()=>{' + SHOT_EVAL + ';return 1;})()').catch(e => console.log('  shot-eval: ' + e.message)); await sleep(800); }
    const r = await cmd('Page.captureScreenshot', { format: 'png' });
    const f = OUT.replace(/\.json$/, '_' + at + 's.png'); fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, Buffer.from(r.result.data, 'base64')); console.log('  shot -> ' + f);
  }
  for (let s = 0; s < SECS; s += every) {
    await sleep(every * 1000);
    const st = await ev("JSON.stringify({ph: (document.getElementById('phName')||{}).textContent, pace: FLYDIY_PACE.state(), q: WORLD.premises && WORLD.premises.stats ? WORLD.premises.stats.queued : -1, t: FLIGHT_PROBE.sim().t})", 30000);
    shots.push(st);
    console.log('  +' + String(s + every).padStart(3) + ' s ' + st);
  }
  let premStream = null;
  if (flag('progwatch')) { const pw = JSON.parse(await ev("(() => { const who = new Map(); try { WORLD.scene.traverse(o => { for (const m of (o.material ? [].concat(o.material) : [])) { const p = WORLD.renderer.properties.get(m).currentProgram; if (p && !who.has(p)) who.set(p, (o.name || o.type) + '/' + (m.name || m.type) + (m.userData && Object.keys(m.userData).length ? '{' + Object.keys(m.userData).slice(0, 4).join(',') + '}' : '')); } }); } catch (e) {} for (const [pr, e] of (window.__PW || new Map())) e.who = who.get(pr) || ''; return 1; })() && JSON.stringify([...(window.__PW || new Map()).values()].map(e => [e.n, e.k, Math.round(e.t0), e.t1 == null ? -1 : Math.round(e.t1 - e.t0), e.who || '']))", 20000)); pw.sort((a, b) => b[3] - a[3]); console.log('  programs: ' + pw.length + ', slowest links (name, key length, seen at ms, ms to ready):\n' + pw.slice(0, 30).map(x => '    ' + x.join('  ')).join('\n')); }
  // ---- the settings probe (G680) ----
  const settingsRuns = [];
  let settingsT0 = null;   // the frame targets are the roll-out's: a settings screen holds the render, its frames are its own
  if (SETTINGS) {
    settingsT0 = await ev('performance.now()');
    for (const [k, v] of SETTINGS) {
      const t0 = await ev('performance.now()');
      const vv = /^-?[0-9.]+$/.test(v) ? v : JSON.stringify(v);
      // one task, as the pill's click: set (apply inside), then the settle screen
      await ev('(() => { const r = GFX.set(' + JSON.stringify(k) + ', ' + vv + '); if (' + JSON.stringify(k) + " !== 'fps' && typeof FLYDIY_SETTLE === 'function') FLYDIY_SETTLE(" + JSON.stringify(k) + '); return 1; })()', 60000);
      const tClick = await ev('performance.now()');
      let quietSince = 0, shown = false;
      const tEnd = Date.now() + 120000;
      while (Date.now() < tEnd) {
        await sleep(250);
        const st = JSON.parse(await ev("JSON.stringify({ s: window.BOOT ? BOOT.state : 'none', b: window.BOOT && BOOT.busy ? BOOT.busy() : false, set: window.BOOT ? BOOT.set : '' })", 30000));
        if (st.s !== 'gone' && st.set === 'settings') shown = true;
        if (st.s === 'gone' && !st.b) { if (!quietSince) quietSince = Date.now(); if (Date.now() - quietSince > 2000) break; } else quietSince = 0;
      }
      const t1 = await ev('performance.now()');
      const lt = JSON.parse(await ev('JSON.stringify(__RP.lt)', 30000)).filter(x => x[0] >= t0 - 5 && x[0] <= t1);
      const worst = lt.reduce((m, x) => Math.max(m, x[1]), 0);
      const run = { change: k + '=' + v, clickMs: Math.round(tClick - t0), screen: shown, spanMs: Math.round(t1 - t0 - 2000), worst, over1s: lt.filter(x => x[1] > 1000).length, over200: lt.filter(x => x[1] > 200).map(x => x[1]) };
      settingsRuns.push(run);
      console.log('  SETTINGS ' + run.change.padEnd(16) + ' click task ' + run.clickMs + ' ms · ' + (shown ? 'screen' : 'no screen') + ' · settled in ' + (run.spanMs / 1000).toFixed(1) + ' s · worst task ' + worst + ' ms · >1 s: ' + run.over1s + (run.over200.length ? ' · >200 ms: ' + run.over200.join(' ') : ''));
    }
  }
  const evalOut = EVAL ? await ev('(async () => JSON.stringify(await (' + EVAL + '\n)))()', 60000).catch(e => 'error: ' + e.message) : null;
  if (EVAL) console.log('  eval: ' + evalOut);
  const prof = await profDone;
  let profTop = null;
  if (prof) {
    // self time per node = its samples x the mean interval; aggregated by function (name + script + line) and by script
    const dtUs = (prof.endTime - prof.startTime) / Math.max(1, prof.samples.length);
    const hits = new Map(); for (const s of prof.samples) hits.set(s, (hits.get(s) || 0) + 1);
    const byFn = new Map(), byUrl = new Map(); let tot = 0;
    for (const n of prof.nodes) {
      const h = hits.get(n.id) || 0; if (!h) continue;
      const cf = n.callFrame, url = (cf.url || '').split('/').pop().split('?')[0] || '(' + (cf.functionName || 'native') + ')';
      const k = (cf.functionName || '(anon)') + ' ' + url + ':' + (cf.lineNumber + 1);
      byFn.set(k, (byFn.get(k) || 0) + h); byUrl.set(url, (byUrl.get(url) || 0) + h); tot += h;
    }
    const ms = h => +(h * dtUs / 1000).toFixed(1), secs = (prof.endTime - prof.startTime) / 1e6;
    const fnTop = [...byFn].sort((a, b) => b[1] - a[1]).slice(0, 45), urlTop = [...byUrl].sort((a, b) => b[1] - a[1]).slice(0, 12);
    console.log('  profile ' + secs.toFixed(1) + ' s, ' + prof.samples.length + ' samples · by script (ms/s): ' + urlTop.map(([u, h]) => u + ' ' + (ms(h) / secs).toFixed(1)).join(' · '));
    for (const [k, h] of fnTop) console.log('    ' + String((ms(h) / secs).toFixed(2)).padStart(7) + ' ms/s  ' + k);
    profTop = { secs, byUrl: urlTop.map(([u, h]) => [u, ms(h)]), byFn: fnTop.map(([k, h]) => [k, ms(h)]) };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT.replace(/\.json$/, '_live.cpuprofile'), JSON.stringify(prof));
  }
  const R = JSON.parse(await ev('JSON.stringify({ fr: __RP.fr, lt: __RP.lt })', 60000));
  // G680: the world step's slices (app.js buildWorldSliced) - how many, the longest, the step's wall
  const worldSlices = JSON.parse(await ev('JSON.stringify(window.__WORLD_SLICES || null)').catch(() => 'null'));
  if (worldSlices) console.log('  world step: ' + worldSlices.n + ' yields in ' + worldSlices.ms + ' ms, the longest slice ' + worldSlices.worst + ' ms');
  const bootLog = await ev('JSON.stringify(window.BOOT && BOOT.log ? BOOT.log : null)').catch(() => null);
  // the premises stream's own account (G591: its dials, the slow builds [id, ms])
  premStream = null; try { premStream = JSON.parse(await ev("JSON.stringify(window.WORLD && WORLD.premises && WORLD.premises.streamState ? Object.assign({}, WORLD.premises.streamState, { stats: WORLD.premises.stats }) : null)", 20000)); } catch (e) {}
  if (premStream && premStream.slow && premStream.slow.length) console.log('  premises slow builds: ' + premStream.slow.slice().sort((a, b) => b[1] - a[1]).slice(0, 12).map(x => x[0] + ' ' + x[1]).join(', '));
  // CLOSED, NOT KILLED (G591): Chrome writes its GPU program cache on the way out; the taskkill /F alone left the warm
  // profile's cache without the programs a run compiled, so every 'warm' run linked them again (the compile step 15 -> 40 s)
  // ...AND WAITED FOR (2026-09-27, A2-SHADOW-SKY's find): a fixed 2.5 s then `taskkill /T /F` of the whole tree still cut
  // the cache write short - the warm profile's GPUCache/index stopped being rewritten, so every program first compiled
  // after that linked cold on every 'warm' run (a changed-shader branch read 36 s, the cold number). Wait for Chrome's
  // own exit (15 s at most); the kill is only the fallback for a Chrome that did not go.
  const exited = new Promise(res => { if (ch.exitCode !== null) return res(true); ch.once('exit', () => res(true)); setTimeout(() => res(false), 15000); });
  try { await Promise.race([cmd('Browser.close'), sleep(8000)]); } catch (e) {}
  const clean = await exited;
  if (!clean) console.log('  (Chrome did not exit within 15 s of Browser.close - killed; the warm profile\'s GPU cache may be stale)');
  ws.close(); if (!clean) kill(); else if (server) try { if (process.platform === 'win32') execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore' }); else server.kill(); } catch (e) {}
  if (COLD) try { fs.rmSync(UDD, { recursive: true, force: true }); } catch (e) {}

  // ---- the reading ------------------------------------------------------------
  // fr rows: [now, dt, workMs, physMs, steps, worldMs, cap, phase, premQueued, agl, renderMs, shadowMs, premStepMs, premSteps, x, z]
  const fr = R.fr.filter(r => r[0] >= revealAt && r[1] > 0 && (settingsT0 == null || r[0] < settingsT0));
  // ground speed from the CG track (m/s), over the frame's own dt
  for (let i = 0; i < fr.length; i++) { const a = fr[Math.max(0, i - 1)], b = fr[i]; fr[i].spd = (i && a[14] != null && b[14] != null) ? Math.hypot(b[14] - a[14], b[15] - a[15]) / Math.max(1e-3, b[1] / 1000) : 0; }
  let everMoved = false;
  const phaseOf = r => { const p = (r[7] || '').toUpperCase(); const agl = r[9] == null ? 0 : r[9];
    if (agl > 4) return 'air';
    if (/TAKE|ROLL|LINE|DEPART/.test(p)) return 'takeoff';
    if (r.spd > 0.4) everMoved = true;
    return everMoved ? 'taxi' : 'stand'; };
  for (const r of fr) r.ph = phaseOf(r);
  const groups = {};
  for (const r of fr) (groups[r.ph] = groups[r.ph] || []).push(r);
  const row = rs => { const dt = rs.map(r => r[1]); return { frames: rs.length, fpsMedian: +(1000 / med(dt)).toFixed(1), dtMedian: +med(dt).toFixed(1), dtP90: +pct(dt, 0.9).toFixed(1), dtMax: +Math.max(0, ...dt).toFixed(0),
    workMed: +med(rs.map(r => r[2])).toFixed(1), physMed: +med(rs.map(r => r[3])).toFixed(1), physP90: +pct(rs.map(r => r[3]), 0.9).toFixed(1), worldMed: +med(rs.map(r => r[5])).toFixed(1), worldP90: +pct(rs.map(r => r[5]), 0.9).toFixed(1),
    steps: +(rs.reduce((s, r) => s + r[4], 0) / Math.max(1, rs.length)).toFixed(2), renderMed: +med(rs.map(r => r[10])).toFixed(1), renderP90: +pct(rs.map(r => r[10]), 0.9).toFixed(1), shadowMed: +med(rs.map(r => r[11])).toFixed(1), premStepMs: +(rs.reduce((s, r) => s + r[12], 0) / Math.max(1, rs.length)).toFixed(2), cap30: +(rs.filter(r => r[6] === 30).length / Math.max(1, rs.length)).toFixed(2) }; };
  const phases = {}; for (const k of Object.keys(groups)) phases[k] = row(groups[k]);
  // the gate numbers
  let run = 0, worstRun = 0; for (const r of fr) { if (r[1] > 1000 / 30) { run += r[1]; worstRun = Math.max(worstRun, run); } else run = 0; }
  const over100 = fr.filter(r => r[1] > 100);
  const lt = R.lt.filter(x => settingsT0 == null || x[0] < settingsT0).sort((a, b) => b[1] - a[1]);
  const lt1s = R.lt.filter(x => x[1] > 1000 && (settingsT0 == null || x[0] < settingsT0));   // a settings change reports on its own line
  const premEmptyAt = (() => { const r = fr.find(r => r[8] === 0); return r ? +((r[0] - revealAt) / 1000).toFixed(1) : null; })();
  const standTaxi = fr.filter(r => ['stand', 'taxi'].includes(r.ph));
  const standTaxiFps = standTaxi.length ? 1000 / med(standTaxi.map(r => r[1])) : 0;
  const gates = {
    over100ms: { n: over100.length, worst: over100.length ? Math.max(...over100.map(r => r[1])) | 0 : 0, pass: over100.length === 0 },
    below30run: { sec: +(worstRun / 1000).toFixed(2), pass: worstRun <= 3000 },
    standTaxiMedianFps: { fps: +standTaxiFps.toFixed(1), pass: standTaxiFps >= 50 },
    longTask1s: { n: lt1s.length, worst: lt.length ? lt[0][1] : 0, pass: lt1s.length === 0 },
  };
  console.log('  ---- ' + LABEL + ' · garage ' + tGarage.toFixed(1) + ' s · roll-out screen ' + tReveal.toFixed(1) + ' s · premises queue empty at +' + premEmptyAt + ' s');
  for (const k of ['stand', 'taxi', 'takeoff', 'air']) if (phases[k]) { const p = phases[k];
    console.log(`  ${k.padEnd(8)} ${String(p.fpsMedian).padStart(5)} fps (dt med ${p.dtMedian} p90 ${p.dtP90} max ${p.dtMax}) · loop JS ${p.workMed} · solver ${p.physMed} (p90 ${p.physP90}) · world ${p.worldMed} (p90 ${p.worldP90}) · render ${p.renderMed} (p90 ${p.renderP90}, shadow ${p.shadowMed}) · prem ${p.premStepMs}/fr · ${p.steps} steps/frame · at 30-cap ${Math.round(p.cap30 * 100)} % · ${p.frames} fr`); }
  if (SETTINGS) { const w = settingsRuns.reduce((m, r) => Math.max(m, r.worst), 0), n = settingsRuns.reduce((m, r) => m + r.over1s, 0);
    gates.settingsLongTask1s = { n, worst: w, pass: n === 0 }; }
  for (const [k, g] of Object.entries(gates)) console.log('  ROLLOUT ' + k + ': ' + (g.pass ? 'PASS' : 'FAIL') + ' ' + JSON.stringify(g));
  console.log('  long tasks > 200 ms: ' + R.lt.filter(x => x[1] > 200).length + ' · worst 8: ' + lt.slice(0, 8).map(x => x[1] + '@' + (x[0] / 1000).toFixed(0) + 's').join(' '));
  if (exc.length) console.log('  page exceptions: ' + exc.length + ' · ' + exc.slice(0, 3).join(' | '));
  const result = { date: new Date().toISOString(), label: LABEL, url: URL, cold: COLD, build: BUILD, variant: VARIANT, gfx: GFX, world: WORLDN || 'jolene', size: SIZE, gpu, gfx0: JSON.parse(gfx0 || 'null'), box,
    tGarage, tReveal, premEmptyAt, phases, gates, settings: settingsRuns, chromeFlags: CHROME_FLAGS, worldSlices: worldSlices, longTasks: R.lt, shots, premStream, eval: evalOut, profile: profTop, bootLog: bootLog ? JSON.parse(bootLog) : null, exceptions: exc.slice(0, 20),
    frames: fr.map(r => [+((r[0] - revealAt) / 1000).toFixed(3)].concat(r.slice(1), [r.ph, +r.spd.toFixed(2)])) };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result));
  console.log('  -> ' + OUT);
  process.exit(0);
})().catch(e => { console.error('rollout_perf: ' + (e && e.stack || e)); process.exit(1); });
