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
// frame over 100 ms, never more than 3 s in a row below 30 fps, stand + taxi at 50 fps DELIVERED (G993: frames over
// the wall time - standTaxiDeliveredFps, with the share of doubled intervals and p90/p99; the old median line stays
// for comparison: a 45 fps frame alternating 16.7 / 33.3 ms read "59.9"), and no
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
//          [--trips] (B9 G1023: the round trips timed - the garage's fps fresh and after, a slider's latency, each trip)
// THE SETTINGS PROBE (G680, A4-FREEZE: "no freezing ever ... This includes possible setting changes"): after the
// recording window, each change of the list is made the way a pick in the GRAPHICS menu makes it (gfx_settings.js
// pick: GFX.set, then FLYDIY_SETTLE - the settings screen), one at a time, each waited out (the screen gone, its
// chain done, 2 s of quiet); its long tasks, its worst task and the screen's time are printed, and the ROLLOUT line
// settingsLongTask1s says whether any change held the main thread over 1 s (R4 counts a settings change).
// It prints the premises stream's slow builds (WORLD.premises.streamState, G591) and closes Chrome through CDP before
// the kill (a killed Chrome drops its GPU program cache writes: every 'warm' run linked cold).
// Starts its own static server (tools/_serve.js) on the repo root (with --fallback for a worktree's
// gitignored data) unless --url is given.
// THE ROUTE AND THE WATER (G790, W-CHECK): --from <aerodrome id> [--dest <id>|CIRCUIT] starts the flight where the
// page's own pickers would (the `flydiy.route` pref that #edRoute / #bootRoute / #selFrom write; a warm profile keeps
// prefs, so every run states it: HOME / CIRCUIT by default) - a float build is placed on the SEA lane by the game
// itself whatever the pick (app.js applyRoute). On floats every frame also carries the pilot's phase, V, the wet
// floats (wheelsOnGround: 3 displacing, 2 on the step), and a WATER PHASE label read in the page: to-afloat /
// to-displace / to-step (the take-off run: the pilot has no water taxi, it runs from the lane's spawn) / climb /
// circuit / flare / ldg-step / ldg-displace / ldg-afloat (the landing's run-out and the stop). --afloat <s> holds
// the flight in the page's MANUAL mode at idle for s seconds from the reveal (the `flydiy.flManual` pref, then
// FLIGHT_PROBE.setManual(false): the pilot takes it from there) - the aeroplane afloat at rest. --shot-phase
// all|<label,...> captures a PNG 1.5 s into each listed phase; --water-gpu turns the water's own GPU timer on
// (WATER.set({timer}): the sea's and the near sea's draws, EXT_disjoint_timer_query). The mirror's capture
// (WATER.mirrorRender: its CPU ms and how often it captured) and the interaction field's step are timed per
// frame on every build. Use `--secs 420` or more to see a float circuit round to the stop.
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
const LABEL = opt('label', [COLD ? 'cold' : 'warm', VARIANT, BUILD ? path.basename(BUILD, '.json').replace(/\W+/g, '') : 'stock', WORLDN || 'jolene'].concat(opt('from', null) ? ['from' + opt('from')] : []).join('_'));
const OUT = opt('out', path.join(__dirname, 'perf', 'rollout_' + LABEL + '.json'));
const SPORT = +opt('port', 8531);
const REPO = path.resolve(__dirname, '..', '..');
const FALLBACK = opt('fallback', null);
let URL = opt('url', null);
const FROM = opt('from', 'HOME'), DEST = opt('dest', 'CIRCUIT');
const AFLOAT = +opt('afloat', 0);
const WATER_GPU = flag('water-gpu');
const SHOT_PHASE = (opt('shot-phase', '') || '').split(',').filter(Boolean);

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

// --trips: a stretch of frame intervals (ms), summarised
function tripStat(dts) {
  const a = (dts || []).filter(x => x > 0).sort((p, q) => p - q); if (!a.length) return null;
  const sum = a.reduce((t, x) => t + x, 0);
  return { frames: a.length, fps: +(1000 * a.length / sum).toFixed(1), med: +a[a.length >> 1].toFixed(1), p90: +a[Math.floor(a.length * 0.9)].toFixed(1), max: +a[a.length - 1].toFixed(1), over33: a.filter(x => x > 33.4).length };
}
// ---- the static server -----------------------------------------------------
let server = null, serverExit = null;
if (!URL) {
  const a = [path.join(__dirname, '_serve.js'), String(SPORT), REPO];
  if (FALLBACK) a.push('--fallback', FALLBACK);
  server = spawn(process.execPath, a, { stdio: 'ignore' });
  server.on('exit', c => { serverExit = c; });
  URL = 'http://localhost:' + SPORT + '/flyDiy/' + PAGE;
}
// G733 (B1-LAG): THE PAGE MEASURED IS THIS TREE'S, OR THE RIG STOPS. A server left over from another run held :8531, this
// rig's own server could not bind (and died quietly), and the run measured the other tree's page (2026-09-28). The port
// must be free before our server starts, and the server that answers must be ours: _serve.js names its root.
const portAnswer = () => new Promise(res => { const rq = http.get('http://127.0.0.1:' + SPORT + '/flyDiy/version.json', r => { r.resume(); res(r.headers['x-serve-root'] ? decodeURIComponent(r.headers['x-serve-root']) : '(unnamed)'); });
  rq.on('error', () => res(null)); rq.setTimeout(2000, () => { rq.destroy(); res(null); }); });
async function serverCheck() {
  if (!server) return;
  const want = path.resolve(REPO).toLowerCase();
  for (let i = 0; i < 40; i++) {
    if (serverExit !== null) throw new Error('rollout_perf: the static server exited (code ' + serverExit + ') - port ' + SPORT + ' is held by another process; stop it or pass --port');
    const root = await portAnswer();
    if (root !== null) {
      if (path.resolve(root).toLowerCase() !== want) throw new Error('rollout_perf: port ' + SPORT + ' is served by ANOTHER server (root ' + root + '), not ' + REPO + ' - stop it or pass --port');
      return;
    }
    await sleep(250);
  }
  throw new Error('rollout_perf: the static server never answered on port ' + SPORT);
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
// --pre <js | @file> (C4b, G879): a script the page runs before its first own script (after the rig's own pre-lines) - a
// debugging hook, e.g. tools/perf/progwait_hook.js, which names every GL call that waited on a program link
const PRE = (e => e && e[0] === '@' ? fs.readFileSync(path.resolve(e.slice(1)), 'utf8') : e)(opt('pre', null));
const EVAL = (e => e && e[0] === '@' ? fs.readFileSync(path.resolve(e.slice(1)), 'utf8') : e)(opt('eval', null));   // '@tools/rollout_census.js': from a file
const SETTINGS = flag('settings') ? (() => { const v = opt('settings', null); return (v && !v.startsWith('--') ? v : 'shadows=off,shadows=full,preset=potato,preset=gamer').split(',').map(x => x.split('=')); })() : null;
// --trips (B9, G1023): THE ROUND TRIPS, timed - the garage's frame rate fresh (5 s before the first roll-out) and after a
// round trip, back to the shed, a slider of the editor moved (the input's task and the time to the next frame), roll out,
// back, roll out with no change: each trip's own ms (window.FLYDIY_TRIPS), the steps it ran, its frames (fps, p90, max,
// frames over 33.4 ms) and long tasks; and the load's long tasks (a task of 50 ms or more is a frame under 20 fps).
const TRIPS = flag('trips');
// --profile-settings (G991): a CPU profile of each settings change (<label>_set_<k>_<v>.cpuprofile), its longest task
// summarised by self time and by the calling chain - where a change's long task goes
const PROFILE_SET = flag('profile-settings');
const CHROME_FLAGS = argv.reduce((a, x, i) => (x === '--chrome-flag' && argv[i + 1] ? a.concat([argv[i + 1]]) : a), []);
// --udd <dir> (G999, A5-LOAD): a PERSISTENT profile of one's own (the shader-cache study: a private warm profile, the
// shared one untouched); --progsrc: every program's real GLSL hashed (vertex + fragment as the driver got them) and kept
// in the JSON as progSrc [name, fnv of the source, source length, fnv of three's key] - two runs' lists say whether a
// program's SOURCE changed between them (a key built per run) or the same source linked again (Chrome's cache);
// with --progwatch each row also carries [first seen at ms, ms to ready] (else two nulls), then the object/material wearing it
const UDD_OPT = opt('udd', null);
const PROGSRC = flag('progsrc');
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
  // G991: and the flight's own prefs - the route (G710, flydiy.route), the flight panel's (flydiy.fl*: manual, the start,
  // the pilot's rows) and the world: peers' sessions in the shared warm profile left a departure from another strip (the
  // "taxi" a take-off roll there) and an aeroplane that never left the stand (DEPART, 150 s) - different frames to measure
  lines.push('try{for(const k of Object.keys(localStorage))if(/^flydiy\\.(fl([A-Z]|$)|route$|world$)/.test(k))localStorage.removeItem(k)}catch(e){}');
  // G790: the route and who flies, stated every run (a warm profile keeps both from the last one)
  lines.push('try{localStorage.setItem("flydiy.route",' + JSON.stringify(JSON.stringify({ from: FROM, dest: DEST })) + ');localStorage.setItem("flydiy.flManual","' + (AFLOAT > 0 ? '1' : '0') + '")}catch(e){}');
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
  lines.push(`(function(){ if (window.__RP) return; var R = window.__RP = { t0: performance.now(), lt: [], ev: [], waterGpu: ${WATER_GPU ? 'true' : 'false'} };
    try { new PerformanceObserver(function(l){ l.getEntries().forEach(function(e){ R.lt.push([Math.round(e.startTime), Math.round(e.duration)]); }); }).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  })();`);
  if (PRE) lines.push(PRE);
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
  // G790: the water's own passes - the mirror's capture (CPU ms, captures) and the interaction field's step
  let mirMs = 0, mirN = 0, fldMs = 0;
  const WT = window.WATER;
  if (WT && !WT.__rp) {
    if (WT.mirrorRender) { const mr = WT.mirrorRender; WT.mirrorRender = function () { const t = performance.now(); const x = mr.apply(this, arguments); mirMs += performance.now() - t; if (x) mirN++; return x; }; }
    if (WT.fieldStep) { const fs = WT.fieldStep; WT.fieldStep = function () { const t = performance.now(); const x = fs.apply(this, arguments); fldMs += performance.now() - t; return x; }; }
    if (R.waterGpu && WT.set) WT.set({ timer: true });
    WT.__rp = 1;
  }
  // G790: THE WATER PHASE, read here so the shots and the reading agree: the first lift-off splits the run from the landing
  const wPhase = (ap, onG, Vg, agl) => {
    const air = onG === 0 && agl > 1;
    if (air && agl > 3) R.airSeen = true;
    if (air) return /LIFTOFF|CLIMB/.test(ap) ? 'climb' : ap === 'FLARE' ? 'flare' : 'circuit';
    const pre = R.airSeen ? 'ldg-' : 'to-';
    return pre + (Vg < 0.5 ? 'afloat' : onG >= 3 ? 'displace' : 'step');
  };
  let lastNow = 0;
  const ph = document.getElementById('phName');
  const prem = () => { const p = W && W.premises; return p && p.stats ? p.stats.queued : -1; };
  P.end = function (workMs, physMs, steps, now) {
    const st = P.state();
    let agl = null, x = null, z = null, apPh = '', V = null, onG = null, hAgl = null, wph = '', man = 0;
    try { const s = window.FLIGHT_PROBE && FLIGHT_PROBE.sim(); if (s) { const cg = s.cgPos(); agl = cg[1] - FLIGHT_PROBE.world().terrainH(cg[0], cg[2]); x = cg[0]; z = cg[2];
      const ap = FLIGHT_PROBE.ap(); apPh = ap ? ap.phase || '' : ''; V = s.out ? s.out.V : null; onG = s.wheelsOnGround(); hAgl = FLIGHT_PROBE.agl(); man = FLIGHT_PROBE.manual() ? 1 : 0;
      if (s.hydro) { const v = s.cgVel(); wph = wPhase(apPh, onG, Math.hypot(v[0], v[2]), hAgl); } } } catch (e) {}
    R.fr.push([ +now.toFixed(1), lastNow ? +(now - lastNow).toFixed(2) : 0, +workMs.toFixed(2), +physMs.toFixed(2), steps, +wuMs.toFixed(2), st.cap, ph ? ph.textContent : '', prem(), agl == null ? null : +agl.toFixed(1),
      +rMs.toFixed(2), +shMs.toFixed(2), +pmMs.toFixed(2), pmN, x == null ? null : +x.toFixed(2), z == null ? null : +z.toFixed(2),
      apPh, V == null ? null : +V.toFixed(2), onG, hAgl == null ? null : +hAgl.toFixed(2), +mirMs.toFixed(2), mirN, +fldMs.toFixed(2), WT && WT.stats && R.waterGpu ? +WT.stats.gpuMs.toFixed(3) : null, man, wph ]
      // G820 (C1c): THE PHYSICS WORKER'S readings (?simw): its step's cost (ms, eased), its dilation, its steps a turn at most (ms)
      .concat((() => { const SW = window.FLYDIY_SIMW; const w = SW && SW.perf ? SW.perf() : null; return w && w.live ? [+w.stepMs.toFixed(3), +w.dil.toFixed(4), +w.maxMs.toFixed(2)] : [null, null, null]; })()));
    R.wph = wph;
    lastNow = now; wuMs = 0; rMs = 0; shMs = 0; pmMs = 0; pmN = 0; mirMs = 0; mirN = 0; fldMs = 0;
    return endW(workMs, physMs, steps, now);
  };
  return 'installed';
})()`;

// G991: the change's WORST task (the page's own long-task entry, [start ms, duration ms] on its clock) in its CPU profile:
// the samples inside it (the profile's start taken as the page's clock at Profiler.start, within a few ms) - self time by
// function and the heaviest calling chains (the leaf's four callers), printed; the profile saved to `file`
function profileTask(prof, file, pageT0, win) {
  try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(prof)); } catch (e) {}
  if (!win) return null;
  const byId = new Map(); for (const n of prof.nodes) byId.set(n.id, n);
  const parent = new Map(); for (const n of prof.nodes) for (const c of (n.children || [])) parent.set(c, n.id);
  let t = prof.startTime; const best = { start: win[0], end: win[0] + win[1], idx: [] };
  for (let i = 0; i < prof.samples.length; i++) {
    t += prof.timeDeltas[i];
    const at = pageT0 + (t - prof.startTime) / 1000;
    if (at >= best.start && at <= best.end && byId.get(prof.samples[i]).callFrame.functionName !== '(idle)') best.idx.push(i);
  }
  if (!best.idx.length) return null;
  const dt = (prof.endTime - prof.startTime) / Math.max(1, prof.samples.length) / 1000;
  const self = new Map(), chain = new Map();
  const name = id => { const cf = byId.get(id).callFrame; return (cf.functionName || '(anon)') + ' ' + ((cf.url || '').split('/').pop().split('?')[0]) + ':' + (cf.lineNumber + 1); };
  for (const i of best.idx) {
    const id = prof.samples[i]; self.set(name(id), (self.get(name(id)) || 0) + 1);
    const ch = []; let p = id; for (let k = 0; k < 5 && p != null; k++) { ch.push(name(p)); p = parent.get(p); }
    const key = ch.join(' < '); chain.set(key, (chain.get(key) || 0) + 1);
  }
  const top = m => [...m].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, n]) => [+(n * dt).toFixed(1), k]);
  const out = { ms: win[1], sampledMs: +(best.idx.length * dt).toFixed(0), self: top(self), chains: top(chain) };
  const NL = String.fromCharCode(10);
  console.log('    worst task ' + out.ms + ' ms (' + out.sampledMs + ' ms sampled), self time:' + NL + out.self.map(x => '      ' + x[0] + ' ms  ' + x[1]).join(NL)
    + NL + '    chains:' + NL + out.chains.slice(0, 8).map(x => '      ' + x[0] + ' ms  ' + x[1]).join(NL));
  return out;
}
const med = a => { if (!a.length) return 0; const f = a.slice().sort((x, y) => x - y); return f[f.length >> 1]; };
const pct = (a, p) => { if (!a.length) return 0; const f = a.slice().sort((x, y) => x - y); return f[Math.min(f.length - 1, Math.floor(f.length * p))]; };

(async () => {
  if (flag('quiet')) {
    const t0 = Date.now(); let u = gpuUtil(), calm = 0;
    while (u >= 0 && Date.now() - t0 < 20 * 60000) { if (u < 15) { if (++calm >= 3) break; } else calm = 0; await sleep(4000); u = gpuUtil(); }
    console.log('rollout_perf: GPU ' + u + ' % after ' + ((Date.now() - t0) / 1000 | 0) + ' s of waiting');
  }
  try { await serverCheck(); }
  catch (e) { if (server && serverExit === null) try { if (process.platform === 'win32') execSync('taskkill /PID ' + server.pid + ' /T /F', { stdio: 'ignore' }); else server.kill(); } catch (e2) {}
    console.error('*** ' + e.message + ' ***'); process.exit(4); }
  const box = { gpuUtil: gpuUtil(), cpuLoad: cpuLoad() };
  const DPORT = 9300 + (process.pid % 500);
  const UDD = UDD_OPT ? path.resolve(UDD_OPT) : COLD ? path.join(os.tmpdir(), 'rollout_cold_' + DPORT + '_' + Date.now()) : path.join(os.tmpdir(), 'flydiy_rollout_warm_profile');
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
  // G833 (C2a): THE LOADING'S TOWN STEP - its own time (BOOT.log), the long tasks inside it (the main thread's share),
  // and the house worker's account (src/viewer/house_worker.js: its world's init, the recompose, what it generated and
  // what came from its IndexedDB cache). Cold (--cold: an empty cache) vs warm (a second run on the same profile: the
  // cache holds every house - `built 0`). The same for the settle (the stream's share round the stand). ?housew=0
  // (--q housew=0) is the inline build of before, for the A/B.
  let townLine = null;
  try {
    townLine = JSON.parse(await ev("JSON.stringify((() => { const B = window.BOOT || {}; const L = B.log || []; const s = L.filter(e => e.k === 'step' && (e.id === 'town' || e.id === 'settle')).map(e => ({ id: e.id, t0: e.t + (B.t0 || 0), ms: e.ms })); return { steps: s, hw: window.HOUSE_WORKER && HOUSE_WORKER.stats ? HOUSE_WORKER.stats() : null, hwq: window.WORLD && WORLD.premises && WORLD.premises.hw ? { dispatched: WORLD.premises.hw.dispatched, placed: WORLD.premises.hw.placed, here: WORLD.premises.hw.local } : null }; })())", 20000));
    const lt = JSON.parse(await ev('JSON.stringify(__RP.lt)', 20000));
    for (const s of townLine.steps) {
      const inS = lt.filter(x => x[0] >= s.t0 - 5 && x[0] <= s.t0 + (s.ms || 0));
      s.longTasks = inS.length; s.over100 = inS.filter(x => x[1] > 100).length; s.worst = inS.reduce((m, x) => Math.max(m, x[1]), 0); s.longMs = inS.reduce((a, x) => a + x[1], 0);
      console.log('  ' + s.id.toUpperCase() + ' step ' + ((s.ms || 0) / 1000).toFixed(1) + ' s · long tasks >= 50 ms: ' + s.longTasks + ' (' + s.longMs + ' ms), over 100 ms: ' + s.over100 + ', worst ' + s.worst + ' ms');
    }
    if (townLine.hw) console.log('  HOUSE WORKER ' + JSON.stringify(townLine.hw) + (townLine.hwq ? ' · page: ' + JSON.stringify(townLine.hwq) : ''));
  } catch (e) { console.log('  (town step: ' + (e && e.message) + ')'); }
  // --trips: the garage's frames, fresh (the world exists since the one loading: the recorder can go in now)
  let garageFresh = null;
  if (TRIPS) { await ev(INSTALL); await sleep(1000); const a0 = await ev('performance.now()'); await sleep(5000); const a1 = await ev('performance.now()');
    garageFresh = tripStat(JSON.parse(await ev('JSON.stringify(__RP.fr.filter(r => r[0] >= ' + a0 + ' && r[0] <= ' + a1 + ').map(r => r[1]))')));
    const loadLt = JSON.parse(await ev('JSON.stringify(__RP.lt)')).filter(x => x[0] <= a0);
    console.log('  LOAD ' + tGarage.toFixed(1) + ' s to the shed · long tasks >= 50 ms (a frame under 20 fps each): ' + loadLt.length + ', over 100 ms: ' + loadLt.filter(x => x[1] > 100).length + ', worst ' + loadLt.reduce((m, x) => Math.max(m, x[1]), 0) + ' ms');
    console.log('  GARAGE fresh ' + JSON.stringify(garageFresh)); }
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
  // G790: where the flight began - the route the page applied, the aerodrome under the CG, the build's step
  const where = JSON.parse(await ev("JSON.stringify((() => { const s = FLIGHT_PROBE.sim(), d = FLIGHT_PROBE.def(), W = FLIGHT_PROBE.world(), cg = s.cgPos();"
    + " const near = (W.aerodromes || []).map(a => [a.id, Math.hypot(cg[0] - a.x, cg[2] - a.z)]).sort((a, b) => a[1] - b[1])[0];"
    + " return { route: window.FLYDIY_ROUTE ? FLYDIY_ROUTE.get() : null, hydro: !!s.hydro, substeps: d.params.substeps, substepsTrue: d.params.substepsTrue || null, hydroEvery: s.hydro ? s.hydro.every || 1 : null,"
    + " nodes: s.n, mass: Math.round(s.totalM), cg: cg.map(v => +v.toFixed(1)), near: near ? [near[0], Math.round(near[1])] : null, phase: FLIGHT_PROBE.ap().phase, manual: FLIGHT_PROBE.manual() }; })())"));
  console.log('  start: ' + JSON.stringify(where));
  const HYDRO = where.hydro;
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
  const shoot = async tag => {
    if (SHOT_EVAL) { await ev('(()=>{' + SHOT_EVAL + ';return 1;})()').catch(e => console.log('  shot-eval: ' + e.message)); await sleep(800); }
    const r = await cmd('Page.captureScreenshot', { format: 'png' });
    const f = OUT.replace(/\.json$/, '_' + tag + '.png'); fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, Buffer.from(r.result.data, 'base64')); console.log('  shot -> ' + f);
  };
  // one clock for the timed shots, the phase shots, the afloat hold's release and the 10 s status lines (G790)
  const shotQ = SHOTS.slice().sort((a, b) => a - b), phaseSeen = new Map(), phaseShot = new Set();
  let nextStatus = every, released = !(AFLOAT > 0);
  for (;;) {
    const el = (Date.now() - tRec) / 1000;
    if (el >= SECS) break;
    if (!released && el >= AFLOAT) { released = true; await ev('(()=>{FLIGHT_PROBE.setManual(false);return 1;})()'); console.log('  +' + el.toFixed(0) + ' s: the pilot takes it (manual off)'); }
    while (shotQ.length && el >= shotQ[0]) await shoot(shotQ.shift() + 's');
    if (SHOT_PHASE.length) {
      const wph = await ev("window.__RP && __RP.wph || ''");
      if (wph && !phaseSeen.has(wph)) phaseSeen.set(wph, el);
      for (const [k, t0] of phaseSeen) if (!phaseShot.has(k) && el - t0 >= 1.5 && (SHOT_PHASE[0] === 'all' || SHOT_PHASE.includes(k)) && wph === k) { phaseShot.add(k); await shoot(k); }
    }
    if (el >= nextStatus) {
      nextStatus += every;
      const st = await ev("JSON.stringify({ph: (document.getElementById('phName')||{}).textContent, ap: FLIGHT_PROBE.ap().phase, wph: window.__RP && __RP.wph, pace: FLYDIY_PACE.state(), q: WORLD.premises && WORLD.premises.stats ? WORLD.premises.stats.queued : -1, t: FLIGHT_PROBE.sim().t})", 30000);
      shots.push(st);
      console.log('  +' + String(Math.round(el)).padStart(3) + ' s ' + st);
    }
    await sleep(SHOT_PHASE.length ? 250 : 500);
  }
  let premStream = null;
  if (flag('progwatch')) { const pw = JSON.parse(await ev("(() => { const who = new Map(); try { WORLD.scene.traverse(o => { for (const m of (o.material ? [].concat(o.material) : [])) { const p = WORLD.renderer.properties.get(m).currentProgram; if (p && !who.has(p)) who.set(p, (o.name || o.type) + '/' + (m.name || m.type) + (m.userData && Object.keys(m.userData).length ? '{' + Object.keys(m.userData).slice(0, 4).join(',') + '}' : '')); } }); } catch (e) {} for (const [pr, e] of (window.__PW || new Map())) e.who = who.get(pr) || ''; return 1; })() && JSON.stringify([...(window.__PW || new Map()).values()].map(e => [e.n, e.k, Math.round(e.t0), e.t1 == null ? -1 : Math.round(e.t1 - e.t0), e.who || '']))", 20000)); pw.sort((a, b) => b[3] - a[3]); console.log('  programs: ' + pw.length + ', slowest links (name, key length, seen at ms, ms to ready):\n' + pw.slice(0, 30).map(x => '    ' + x.join('  ')).join('\n')); }
  // ---- the settings probe (G680) ----
  const settingsRuns = [];
  let settingsT0 = null;   // the frame targets are the roll-out's: a settings screen holds the render, its frames are its own
  if (SETTINGS) {
    settingsT0 = await ev('performance.now()');
    for (const [k, v] of SETTINGS) {
      if (PROFILE_SET) { await cmd('Profiler.enable'); await cmd('Profiler.setSamplingInterval', { interval: 500 }); await cmd('Profiler.start'); }
      const t0 = await ev('performance.now()'), pT0 = t0;
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
      // G992: the shader links of the change (the flight recorder's events): made in the window, made inside the worst
      // task (a program first keyed by the frame), and the task's waits on a link (linkwait: a program made before, still linking)
      { const wt = lt.reduce((m, x) => (!m || x[1] > m[1] ? x : m), null);
        run.links = JSON.parse(await ev('(() => { const E = (window.FLIGHT_REC && FLIGHT_REC.rec && FLIGHT_REC.rec.events) || []; const a = ' + t0 + ', b = ' + t1 + ', w0 = ' + (wt ? wt[0] : -1) + ', w1 = ' + (wt ? wt[0] + wt[1] : -1) + ';'
          + " let n = 0, inW = 0, waitN = 0, waitMs = 0; for (const e of E) { if (e[0] < a || e[0] > b) continue; if (e[1] === 'link') { n++; if (e[0] >= w0 && e[0] <= w1) inW++; } if (e[1] === 'linkwait' && e[0] >= w0 && e[0] <= w1) { waitN++; waitMs += e[2] || 0; } }"
          + ' return JSON.stringify({ n, inWorst: inW, waitsInWorst: waitN, waitMsInWorst: Math.round(waitMs) }); })()', 30000).catch(() => 'null'));
        if (run.links) console.log('    links: ' + run.links.n + ' made, ' + run.links.inWorst + ' inside the worst task, ' + run.links.waitsInWorst + ' waits there (' + run.links.waitMsInWorst + ' ms)'); }
      if (PROFILE_SET) { const pr = (await cmd('Profiler.stop')).result.profile; run.profile = profileTask(pr, OUT.replace(/\.json$/, '_set_' + k + '_' + v + '.cpuprofile'), pT0, lt.reduce((m, x) => (!m || x[1] > m[1] ? x : m), null)); }
      settingsRuns.push(run);
      console.log('  SETTINGS ' + run.change.padEnd(16) + ' click task ' + run.clickMs + ' ms · ' + (shown ? 'screen' : 'no screen') + ' · settled in ' + (run.spanMs / 1000).toFixed(1) + ' s · worst task ' + worst + ' ms · >1 s: ' + run.over1s + (run.over200.length ? ' · >200 ms: ' + run.over200.join(' ') : ''));
    }
  }
  // ---- the round trips (B9, G1023) ----
  let tripRuns = null;
  if (TRIPS) {
    tripRuns = [];
    if (garageFresh) tripRuns.push({ label: 'garage, fresh', garage: garageFresh });
    const now = () => ev('performance.now()');
    const waitTrip = async (kind, n0) => { const tEnd = Date.now() + 240000; while (Date.now() < tEnd) {
      const d = JSON.parse(await ev("JSON.stringify((() => { const L = window.FLYDIY_TRIPS || []; const t = L[L.length - 1]; return { n: L.length, kind: t && t.kind, done: !!(t && t.done), ms: t && t.ms, anim: t && t.anim, ran: t ? t.steps.filter(s => s.ran).map(s => s.id) : [], boot: window.BOOT ? BOOT.state : '' }; })())", 30000));
      if (d.n > n0 && d.kind === kind && d.done && d.boot === 'gone') return d; await sleep(100); } return null; };
    const framesIn = async (t0, t1) => JSON.parse(await ev('JSON.stringify(__RP.fr.filter(r => r[0] >= ' + t0 + ' && r[0] <= ' + t1 + ').map(r => r[1]))'));
    const longIn = async (t0, t1) => JSON.parse(await ev('JSON.stringify(__RP.lt)')).filter(x => x[0] >= t0 - 5 && x[0] <= t1).map(x => x[1]);
    const trip = async (label, kind, click) => {
      const n0 = await ev('(window.FLYDIY_TRIPS || []).length'), t0 = await now();
      await ev('(() => { ' + click + '; return 1; })()');
      const d = await waitTrip(kind, n0), t1 = await now();
      await sleep(2000);   // the reveal's first frames
      const t2 = await now();
      const run = { label, kind, tripMs: d ? d.ms : null, wallMs: Math.round(t1 - t0), ran: d ? d.ran : null, anim: d ? d.anim : null, frames: tripStat(await framesIn(t0, t2)), long: await longIn(t0, t2) };
      tripRuns.push(run);
      console.log('  TRIP ' + label.padEnd(30) + ' ' + (run.tripMs == null ? 'NOT DONE' : run.tripMs + ' ms') + ' (wall ' + run.wallMs + ' ms) · ran [' + (run.ran || []).join(' ') + '] · frames ' + JSON.stringify(run.frames) + ' · long tasks ' + (run.long.join(' ') || 'none'));
      return run;
    };
    const garage = async label => { await sleep(1500); const a0 = await now(); await sleep(5000); const a1 = await now();
      const g = tripStat(await framesIn(a0, a1)); tripRuns.push({ label, garage: g }); console.log('  GARAGE ' + label + ' ' + JSON.stringify(g)); return g; };
    const HANG = "document.getElementById('bHangar2').click()", GO = "document.getElementById('bGo').click()";
    await trip('back to the shed 1', 'rollin', HANG);
    await garage('after a round trip');
    // A SLIDER: the editor's first range of these keys moved a step, as a drag does; the input's own task and the time
    // to the next rendered frame (two rAFs: the frame after the rebuild is on screen)
    const sl = JSON.parse(await ev("(async () => { const keys = ['noseLen', 'span', 'wingSpan', 'chord', 'fuseLen'].concat(window.CAGE_UI && CAGE_UI.P ? Object.keys(CAGE_UI.P) : []);"
      + " for (const k of keys) { const r = document.getElementById('p_' + k); if (!r || r.type !== 'range' || r.disabled || typeof r.oninput !== 'function') continue;"
      + " const st = +r.step || 0.01, v = +r.value, nv = v + st <= +r.max ? v + st : v - st; const t0 = performance.now(); r.value = String(nv); r.oninput({ target: r }); const t1 = performance.now();"
      + " await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res))); return JSON.stringify({ key: k, from: v, to: nv, inputMs: Math.round(t1 - t0), toFrameMs: Math.round(performance.now() - t0) }); }"
      + " return JSON.stringify(null); })()", 60000));
    tripRuns.push({ label: 'slider', slider: sl });
    console.log('  SLIDER ' + JSON.stringify(sl));
    await sleep(2000);
    await trip('roll out 2 (the slider moved)', 'rollout', GO);
    await sleep(5000);
    await trip('back to the shed 2', 'rollin', HANG);
    await garage('after two round trips');
    await trip('roll out 3 (no change)', 'rollout', GO);
    await sleep(3000);
  }
  let progSrc = null;
  if (PROGSRC) {
    progSrc = JSON.parse(await ev("(() => { const R = WORLD.renderer, gl = R.getContext(); const fnv = c => { let h = 2166136261; for (let i = 0; i < c.length; i++) h = Math.imul(h ^ c.charCodeAt(i), 16777619) >>> 0; return h.toString(16); }; const who = new Map(); try { WORLD.scene.traverse(o => { for (const m of (o.material ? [].concat(o.material) : [])) { const p = R.properties.get(m).currentProgram; if (p && !who.has(p)) who.set(p, (o.name || o.type) + '/' + (m.name || m.type)); } }); } catch (e) {} return JSON.stringify(R.info.programs.map(pr => { let src = ''; try { for (const sh of gl.getAttachedShaders(pr.program) || []) src += gl.getShaderSource(sh) + '//--'; } catch (e) {} const w = window.__PW && window.__PW.get(pr); return [pr.name, fnv(src), src.length, fnv(String(pr.cacheKey))].concat(w ? [Math.round(w.t0), w.t1 == null ? -1 : Math.round(w.t1 - w.t0)] : [null, null], [who.get(pr) || '']); })); })()", 60000));
    const bytes = progSrc.reduce((a, x) => a + x[2], 0);
    console.log('  programs (source hashed): ' + progSrc.length + ', ' + new Set(progSrc.map(x => x[1])).size + ' distinct sources, ' + (bytes / 1e6).toFixed(1) + ' MB of GLSL');
  }
  // G820 (C1c): who flew it - the physics worker (live, placed) or the page (inline, and why)
  const simw = JSON.parse(await ev('JSON.stringify(window.FLYDIY_SIMW ? (s => ({ phase: s.phase, reason: s.reason, dead: s.dead, placeOk: s.placeOk, flights: s.flights, inline: s.inline, wvBad: s.wvBad, wvMaxLag: s.wvMaxLag, worldMs: s.worldMs, initMs: s.initMs, bootFetchMs: s.bootFetchMs, readyWaitFrames: s.readyWaitFrames, view: s.view }))(FLYDIY_SIMW.state()) : null)', 20000).catch(() => 'null'));
  console.log('  physics: ' + (simw ? (simw.dead ? 'INLINE (no worker: ' + simw.dead + ')' : 'the WORKER - ' + simw.phase + (simw.reason ? ' (' + simw.reason + ')' : '') + ', placed ' + simw.placeOk + ', ' + simw.flights + ' flights (' + simw.inline + ' inline), world made in ' + (simw.worldMs != null ? Math.round(simw.worldMs) : '?') + ' ms, held ' + simw.readyWaitFrames + ' frames, world-version lag max ' + simw.wvMaxLag + ' frames')
    : 'INLINE (?simw=0)'));
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
  // fr rows: [now, dt, workMs, physMs, steps, worldMs, cap, phase, premQueued, agl, renderMs, shadowMs, premStepMs, premSteps, x, z,
  //           apPhase, V, onG, hudAgl, mirrorMs, mirrorCaptures, fieldMs, waterGpuMs, manual, waterPhase] (G790: 16..25),
  //           [workerStepMs, workerDilation, workerTurnMaxMs] (G820, C1c: null when the page flies it inline)
  const fr = R.fr.filter(r => r[0] >= revealAt && r[1] > 0 && (settingsT0 == null || r[0] < settingsT0));
  // ground speed from the CG track (m/s), over the frame's own dt
  for (let i = 0; i < fr.length; i++) { const a = fr[Math.max(0, i - 1)], b = fr[i]; fr[i].spd = (i && a[14] != null && b[14] != null) ? Math.hypot(b[14] - a[14], b[15] - a[15]) / Math.max(1e-3, b[1] / 1000) : 0; }
  let everMoved = false;
  const phaseOf = r => { const p = (r[7] || '').toUpperCase(); const agl = r[9] == null ? 0 : r[9];
    if (agl > 4) return 'air';
    if (/TAKE|ROLL|LINE|DEPART/.test(p)) return 'takeoff';
    if (r.spd > 0.4) everMoved = true;
    return everMoved ? 'taxi' : 'stand'; };
  for (const r of fr) r.ph = HYDRO && r[25] ? r[25] : phaseOf(r);
  const groups = {};
  for (const r of fr) (groups[r.ph] = groups[r.ph] || []).push(r);
  // G993: THE DELIVERED RATE (frames over the wall time they took) and the share of DOUBLED intervals (over 1.5 refreshes of
  // 60 Hz): the median interval read 16.7 ms ("59.9 fps") for a 45 fps frame whose intervals alternate 16.7 / 33.3 - it
  // says only that more than half the frames were on time. R3 is judged on the delivered rate.
  const row = rs => { const dt = rs.map(r => r[1]), wall = dt.reduce((a, b) => a + b, 0); return { frames: rs.length, fpsDelivered: +(wall > 0 ? 1000 * rs.length / wall : 0).toFixed(1), doubled: +(dt.filter(x => x > 25).length / Math.max(1, dt.length)).toFixed(3),
    fpsMedian: +(1000 / med(dt)).toFixed(1), dtMedian: +med(dt).toFixed(1), dtP90: +pct(dt, 0.9).toFixed(1), dtP99: +pct(dt, 0.99).toFixed(1), dtMax: +Math.max(0, ...dt).toFixed(0),
    workMed: +med(rs.map(r => r[2])).toFixed(1), physMed: +med(rs.map(r => r[3])).toFixed(1), physP90: +pct(rs.map(r => r[3]), 0.9).toFixed(1), worldMed: +med(rs.map(r => r[5])).toFixed(1), worldP90: +pct(rs.map(r => r[5]), 0.9).toFixed(1),
    steps: +(rs.reduce((s, r) => s + r[4], 0) / Math.max(1, rs.length)).toFixed(2), msPerStep: +(rs.reduce((s, r) => s + r[3], 0) / Math.max(1, rs.reduce((s, r) => s + r[4], 0))).toFixed(2),
    secs: +(rs.reduce((s, r) => s + r[1], 0) / 1000).toFixed(1), mirrorMs: +(rs.reduce((s, r) => s + (r[20] || 0), 0) / Math.max(1, rs.length)).toFixed(2), mirrorPerS: +(rs.reduce((s, r) => s + (r[21] || 0), 0) / Math.max(1e-3, rs.reduce((s, r) => s + r[1], 0) / 1000)).toFixed(2),
    fieldMs: +(rs.reduce((s, r) => s + (r[22] || 0), 0) / Math.max(1, rs.length)).toFixed(2), waterGpu: rs.some(r => r[23] != null) ? +med(rs.filter(r => r[23] != null).map(r => r[23])).toFixed(3) : null,
    wStepMed: rs.some(r => r[26] != null) ? +med(rs.filter(r => r[26] != null).map(r => r[26])).toFixed(2) : null,
    wStepP90: rs.some(r => r[26] != null) ? +pct(rs.filter(r => r[26] != null).map(r => r[26]), 0.9).toFixed(2) : null,
    wDilMin: rs.some(r => r[27] != null) ? +Math.min(...rs.filter(r => r[27] != null).map(r => r[27])).toFixed(3) : null,
    workP90: +pct(rs.map(r => r[2]), 0.9).toFixed(1),
    vMed: +med(rs.map(r => r[17] || 0)).toFixed(1), renderMed: +med(rs.map(r => r[10])).toFixed(1), renderP90: +pct(rs.map(r => r[10]), 0.9).toFixed(1), shadowMed: +med(rs.map(r => r[11])).toFixed(1), premStepMs: +(rs.reduce((s, r) => s + r[12], 0) / Math.max(1, rs.length)).toFixed(2), cap30: +(rs.filter(r => r[6] === 30).length / Math.max(1, rs.length)).toFixed(2) }; };
  const phases = {}; for (const k of Object.keys(groups)) phases[k] = row(groups[k]);
  // the gate numbers
  let run = 0, worstRun = 0; for (const r of fr) { if (r[1] > 1000 / 30) { run += r[1]; worstRun = Math.max(worstRun, run); } else run = 0; }
  const over100 = fr.filter(r => r[1] > 100);
  const lt = R.lt.filter(x => settingsT0 == null || x[0] < settingsT0).sort((a, b) => b[1] - a[1]);
  const lt1s = R.lt.filter(x => x[1] > 1000 && (settingsT0 == null || x[0] < settingsT0));   // a settings change reports on its own line
  const premEmptyAt = (() => { const r = fr.find(r => r[8] === 0); return r ? +((r[0] - revealAt) / 1000).toFixed(1) : null; })();
  const standTaxi = fr.filter(r => ['stand', 'taxi', 'to-afloat', 'to-displace', 'to-step'].includes(r.ph));
  const standTaxiFps = standTaxi.length ? 1000 / med(standTaxi.map(r => r[1])) : 0;
  const standTaxiRow = standTaxi.length ? row(standTaxi) : { fpsDelivered: 0, doubled: 0, dtP90: 0, dtP99: 0 };
  const gates = {
    over100ms: { n: over100.length, worst: over100.length ? Math.max(...over100.map(r => r[1])) | 0 : 0, pass: over100.length === 0 },
    below30run: { sec: +(worstRun / 1000).toFixed(2), pass: worstRun <= 3000 },
    standTaxiMedianFps: { fps: +standTaxiFps.toFixed(1), pass: standTaxiFps >= 50 },
    standTaxiDeliveredFps: { fps: standTaxiRow.fpsDelivered, doubled: standTaxiRow.doubled, dtP90: standTaxiRow.dtP90, dtP99: standTaxiRow.dtP99, pass: standTaxiRow.fpsDelivered >= 50 },   // G993: R3
    longTask1s: { n: lt1s.length, worst: lt.length ? lt[0][1] : 0, pass: lt1s.length === 0 },
  };
  console.log('  ---- ' + LABEL + ' · garage ' + tGarage.toFixed(1) + ' s · roll-out screen ' + tReveal.toFixed(1) + ' s · premises queue empty at +' + premEmptyAt + ' s');
  const ORDER = HYDRO ? ['to-afloat', 'to-displace', 'to-step', 'climb', 'circuit', 'flare', 'ldg-step', 'ldg-displace', 'ldg-afloat'] : ['stand', 'taxi', 'takeoff', 'air'];
  for (const k of ORDER) if (phases[k]) { const p = phases[k];
    console.log(`  ${k.padEnd(HYDRO ? 12 : 8)} ${String(p.fpsDelivered).padStart(5)} fps delivered, ${Math.round(p.doubled * 100)} % doubled (median ${p.fpsMedian}; dt med ${p.dtMedian} p90 ${p.dtP90} p99 ${p.dtP99} max ${p.dtMax}) · loop JS ${p.workMed} · solver ${p.physMed} (p90 ${p.physP90}; ${p.msPerStep} a step) · world ${p.worldMed} (p90 ${p.worldP90}) · render ${p.renderMed} (p90 ${p.renderP90}, shadow ${p.shadowMed}) · prem ${p.premStepMs}/fr · ${p.steps} steps/frame · at 30-cap ${Math.round(p.cap30 * 100)} % · ${p.frames} fr / ${p.secs} s`
      + (p.wStepMed != null ? ` · WORKER step ${p.wStepMed} ms (p90 ${p.wStepP90}), dilation min ${p.wDilMin} · loop JS p90 ${p.workP90}` : '')
      + (HYDRO ? ` · V ${p.vMed} · mirror ${p.mirrorMs}/fr (${p.mirrorPerS} captures/s) · field ${p.fieldMs}/fr` + (p.waterGpu != null ? ` · water GPU ${p.waterGpu}` : '') : '')); }
  if (HYDRO) { const seq = []; for (const r of fr) if (!seq.length || seq[seq.length - 1][0] !== r.ph) seq.push([r.ph, +((r[0] - revealAt) / 1000).toFixed(1), r[16]]);
    console.log('  water phases (label @ s after the reveal, the pilot phase): ' + seq.map(x => x[0] + '@' + x[1] + '(' + x[2] + ')').join(' '));
    const apSeq = []; for (const r of fr) if (!apSeq.length || apSeq[apSeq.length - 1][0] !== r[16]) apSeq.push([r[16], +((r[0] - revealAt) / 1000).toFixed(1)]);
    console.log('  pilot phases: ' + apSeq.map(x => x[0] + '@' + x[1]).join(' ')); }
  if (SETTINGS) { const w = settingsRuns.reduce((m, r) => Math.max(m, r.worst), 0), n = settingsRuns.reduce((m, r) => m + r.over1s, 0);
    gates.settingsLongTask1s = { n, worst: w, pass: n === 0 }; }
  for (const [k, g] of Object.entries(gates)) console.log('  ROLLOUT ' + k + ': ' + (g.pass ? 'PASS' : 'FAIL') + ' ' + JSON.stringify(g));
  console.log('  long tasks > 200 ms: ' + R.lt.filter(x => x[1] > 200).length + ' · worst 8: ' + lt.slice(0, 8).map(x => x[1] + '@' + (x[0] / 1000).toFixed(0) + 's').join(' '));
  if (exc.length) console.log('  page exceptions: ' + exc.length + ' · ' + exc.slice(0, 3).join(' | '));
  const result = { date: new Date().toISOString(), label: LABEL, url: URL, cold: COLD, build: BUILD, variant: VARIANT, gfx: GFX, world: WORLDN || 'jolene', size: SIZE, gpu, gfx0: JSON.parse(gfx0 || 'null'), box,
    from: FROM, dest: DEST, afloat: AFLOAT, start: where,
    tGarage, tReveal, premEmptyAt, phases, gates, simw, settings: settingsRuns, trips: tripRuns, town: townLine, chromeFlags: CHROME_FLAGS, worldSlices: worldSlices, progSrc, longTasks: R.lt, shots, premStream, eval: evalOut, profile: profTop, bootLog: bootLog ? JSON.parse(bootLog) : null, exceptions: exc.slice(0, 20),
    frames: fr.map(r => [+((r[0] - revealAt) / 1000).toFixed(3)].concat(r.slice(1), [r.ph, +r.spd.toFixed(2)])) };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result));
  console.log('  -> ' + OUT);
  process.exit(0);
})().catch(e => { console.error('rollout_perf: ' + (e && e.stack || e)); process.exit(1); });
