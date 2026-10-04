#!/usr/bin/env node
// mobile_phone_cdp.js - MOBILE-GARAGE (G1514): THE REAL PHONE, MEASURED - for A0 on the box, against the Galaxy S20 FE over
// adb + the Chrome DevTools Protocol. A STUDY rig: it changes nothing on the phone but Chrome's tab, and nothing shipped.
// No dependencies: node >= 22 (global WebSocket + fetch) and adb on the PATH (or ADB=<path>).
//
// WHAT IT MEASURES (one JSON + a printed table):
//   boot    - navigation -> BOOT 'gone' (the page's own loading), the step table (BOOT.log, page clock), and per step the JS
//             heap (Runtime.getHeapUsage: V8 used + ArrayBuffer backing stores, polled every 1 s) and Chrome's processes'
//             PSS off `dumpsys meminfo` every 5 s (the renderer = the page, the privileged/GPU process = the GPU's share).
//             A renderer killed by Android (the MEM-DIET story: "building the field", 2.8 GB) is caught (Inspector.
//             targetCrashed / the socket closing) and reported with the step it died in.
//   drag    - each --rows slider dragged the player's way IN THE PAGE (garage_release.js's procedure: pointerdown, --ticks
//             input ticks, change + pointerup) - the handler ms (performance.now around dispatch) and the DRAWN ms (to the
//             second requestAnimationFrame after it: what the eye waits for); median of --reps.
//   frames  - --frames seconds of requestAnimationFrame intervals in the garage at rest, and the same while the camera
//             orbits (a scripted one-finger drag on the canvas through Input.dispatchTouchEvent): p50 / p95 / p99 / > 50 ms.
//   soak    - --soak minutes (default 10) of the worst honest case - a slider scrubbed back and forth, a tick every 100 ms,
//             a release every 2 s - with, every 30 s: fps over the window, the battery temperature (dumpsys battery,
//             tenths of a degree), the thermal status and the HAL's skin/CPU/GPU temperatures (dumpsys thermalservice,
//             no root needed on Android 10+), and the JS heap. Throttling shows as fps falling while temperature climbs.
//
// SET-UP (once per session, the box):
//   1. the phone: Developer options -> USB debugging on; Chrome open; `adb devices` lists it.
//   2. the page: serve this tree on the box (node tools/_serve.js 8700 D:/Dev/DeGaRoR.github.io) and give the phone the
//      box's port as its own localhost: `adb reverse tcp:8700 tcp:8700` (localhost also skips the welcome's phone gate).
//      Or measure the published game: --url https://degaror.github.io/flyDiy/index.html?gfx=potato (?gfx= skips the gate).
//   3. this rig forwards the DevTools socket itself (adb forward tcp:9222 localabstract:chrome_devtools_remote).
// USAGE:
//   node tools/perf/mobile_phone_cdp.js [--url http://localhost:8700/flyDiy/index.html?gfx=potato] [--build cub|metal]
//        [--cold] [--rows wgSpan,wgChord,stSpan,paxLen] [--reps 3] [--ticks 4] [--frames 10] [--soak 10] [--skip boot,drag,frames,soak]
//        [--port 9222] [--out tools/perf/phone_<build>_<stamp>.json]
//   --build puts that validated build in flydiy.wip before the page's first script (the phone opens on it).
//   --cold clears the origin's cache and storage first (a first visit); otherwise a warm load (run it twice: the first warms).
//   When the garage-only entry exists (MOBILE-GARAGE phase M1), point --url at it: the same rig, the same table.
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const ROOT = path.join(__dirname, '..', '..');
const ADB = process.env.ADB || 'adb';
const PORT = +opt('port', 9222), URL0 = opt('url', 'http://localhost:8700/flyDiy/index.html?gfx=potato');
const BK = opt('build', 'cub'), ROWS = opt('rows', 'wgSpan,wgChord,stSpan,paxLen').split(','), REPS = +opt('reps', 3), TICKS = +opt('ticks', 4);
const FRAMES = +opt('frames', 10), SOAK = +opt('soak', 10), SKIP = new Set(opt('skip', '').split(',').filter(Boolean));
const BUILDS = { cub: 'builds/cub_2026-09-20_corrected.json', metal: 'bugReports/cessnaMetal (1).json', jodel: 'builds/jodel_2026-09-20_corrected.json',
  cessna: 'builds/cessna172_2026-09-20_corrected.json', floats: 'bugReports/cessnaFloatsWOrks.json' };
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
const OUT = path.resolve(opt('out', path.join(__dirname, 'phone_' + BK + '_' + stamp + '.json')));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MiB = x => +(x / 1048576).toFixed(1);
const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))].toFixed(1) : null; };
const med = a => pct(a, 0.5);
const adb = (...a) => { try { return execFileSync(ADB, a, { encoding: 'utf8', timeout: 20000 }); } catch (e) { return ''; } };
const log = s => console.log(s);

// ---- the phone's side: memory, temperature ----
function chromePss() {   // KB per Chrome process from `dumpsys meminfo` (the total PSS table)
  const t = adb('shell', 'dumpsys', 'meminfo'); const r = {};
  for (const m of t.matchAll(/([\d,]+)K: (com\.android\.chrome[^\s(]*)/g)) r[m[2]] = +m[1].replace(/,/g, '');
  const sum = k => Object.entries(r).filter(([n]) => k.test(n)).reduce((a, [, v]) => a + v, 0);
  return { rendererMB: +(sum(/sandboxed_process/) / 1024).toFixed(0), gpuMB: +(sum(/privileged_process/) / 1024).toFixed(0), browserMB: +((r['com.android.chrome'] || 0) / 1024).toFixed(0) };
}
function thermals() {
  const bat = adb('shell', 'dumpsys', 'battery'); const bt = /temperature: (\d+)/.exec(bat);
  const th = adb('shell', 'dumpsys', 'thermalservice');
  const status = (/Thermal Status: (\d)/.exec(th) || [])[1];
  const temps = {};   // "Temperature{mValue=38.2, mType=0, mName=AP, mStatus=0}" (the HAL's current temperatures)
  const cur = th.split(/Current temperatures from HAL:/)[1] || '';
  for (const m of cur.split(/Current cooling devices/)[0].matchAll(/mValue=([\d.]+), mType=(\d+), mName=([^,]+),/g)) temps[m[3]] = +m[1];
  return { batteryC: bt ? +bt[1] / 10 : null, status: status != null ? +status : null, temps };
}

// ---- CDP ----
async function connect() {
  adb('forward', 'tcp:' + PORT, 'localabstract:chrome_devtools_remote');
  const base = 'http://127.0.0.1:' + PORT;
  const ver = await (await fetch(base + '/json/version')).json().catch(() => null);
  if (!ver) throw new Error('no DevTools on :' + PORT + ' - is Chrome open on the phone and USB debugging allowed? (adb devices)');
  const tab = await (await fetch(base + '/json/new?about:blank', { method: 'PUT' })).json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const waits = new Map(); const S = { crashed: false, closed: false, exc: [] };
  ws.onmessage = e => { const m = JSON.parse(e.data);
    if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Inspector.targetCrashed') S.crashed = true;
    if (m.method === 'Runtime.exceptionThrown') S.exc.push(((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text || '').split('\n')[0]); };
  ws.onclose = () => { S.closed = true; for (const f of waits.values()) f({ error: { message: 'closed' } }); waits.clear(); };
  const cmd = (method, params) => S.closed ? Promise.resolve({ error: { message: 'closed' } }) : new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (expr, ms = 60000) => {
    const r = await Promise.race([cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }), sleep(ms).then(() => ({ error: { message: 'timeout' } }))]);
    if (r.error) throw new Error(r.error.message); const d = r.result; if (d.exceptionDetails) throw new Error((d.exceptionDetails.exception || {}).description || d.exceptionDetails.text);
    return d.result.value; };
  await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Inspector.enable'); await cmd('Performance.enable');
  return { ver, tab, cmd, ev, S, close: async () => { try { await fetch(base + '/json/close/' + tab.id); } catch (e) {} } };
}

(async () => {
  const R = { at: new Date().toISOString(), url: URL0, build: BK, cold: flag('cold'), device: adb('shell', 'getprop', 'ro.product.model').trim(),
    android: adb('shell', 'getprop', 'ro.build.version.release').trim(), thermalsAtStart: thermals() };
  const C = await connect(); R.chrome = C.ver.Browser; log('phone ' + R.device + ' (Android ' + R.android + '), ' + R.chrome + '; battery ' + R.thermalsAtStart.batteryC + ' C');
  const save = () => fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
  // the pre-script: the build in flydiy.wip; a rig flag the page already honours nowhere else is NOT set (the phone is the subject)
  const wip = fs.readFileSync(path.join(ROOT, BUILDS[BK] || BK), 'utf8');
  await C.cmd('Page.addScriptToEvaluateOnNewDocument', { source: 'try { if (!sessionStorage.getItem("mp.wip")) { localStorage.setItem("flydiy.wip", ' + JSON.stringify(wip) + '); sessionStorage.setItem("mp.wip", "1"); } } catch (e) {}' });
  if (flag('cold')) { await C.cmd('Network.enable'); await C.cmd('Network.clearBrowserCache');
    await C.cmd('Storage.clearDataForOrigin', { origin: new URL(URL0).origin, storageTypes: 'all' }); }
  // ---- BOOT ----
  if (!SKIP.has('boot')) {
    const rows = []; const pss = []; const t0 = Date.now();
    await C.cmd('Page.navigate', { url: URL0 });
    let state = 'loading', lastPss = 0;
    while (Date.now() - t0 < 900000) {
      await sleep(1000);
      if (C.S.crashed || C.S.closed) { state = 'CRASHED'; break; }
      let lab = '?', st = '';
      try { const v = JSON.parse(await C.ev('JSON.stringify(window.BOOT ? [BOOT.state, BOOT.current ? (BOOT.current.label || BOOT.current.id) : null] : ["page", null])', 5000)); st = v[0]; lab = v[1] || v[0]; } catch (e) { lab = 'busy'; }
      const h = (await C.cmd('Runtime.getHeapUsage')).result || {};
      rows.push([Date.now() - t0, lab, MiB(h.usedSize || 0), MiB(h.backingStorageSize || 0)]);
      if (Date.now() - lastPss > 5000) { lastPss = Date.now(); pss.push([Date.now() - t0, lab, chromePss()]); }
      if (st === 'gone') { state = 'gone'; break; }
    }
    R.boot = { state, sec: +((Date.now() - t0) / 1000).toFixed(1), rows, pss, lastStep: rows.length ? rows[rows.length - 1][1] : null };
    if (state === 'gone') { try { R.boot.log = JSON.parse(await C.ev('JSON.stringify(BOOT.log)')); } catch (e) {} }
    R.boot.peakHeap = Math.max(0, ...rows.map(r => r[2])); R.boot.peakAB = Math.max(0, ...rows.map(r => r[3]));
    R.boot.peakRenderer = Math.max(0, ...pss.map(p => p[2].rendererMB)); R.boot.peakGpu = Math.max(0, ...pss.map(p => p[2].gpuMB));
    log('boot: ' + state + ' in ' + R.boot.sec + ' s' + (state === 'CRASHED' ? ' - died in "' + R.boot.lastStep + '"' : '') + '; JS heap peak ' + R.boot.peakHeap + ' MB + backing stores ' + R.boot.peakAB +
      ' MB; renderer PSS peak ' + R.boot.peakRenderer + ' MB, GPU process ' + R.boot.peakGpu + ' MB');
    // the step table: the heap at each step's end
    const steps = []; for (const r of rows) { const L = steps[steps.length - 1]; if (!L || L.step !== r[1]) steps.push({ step: r[1], t: r[0], heap: r[2], ab: r[3] }); else { L.heap = r[2]; L.ab = r[3]; } }
    R.boot.steps = steps; for (const s of steps) log('   ' + String(s.step).slice(0, 34).padEnd(36) + String((s.t / 1000).toFixed(0)).padStart(5) + ' s  heap ' + s.heap + ' + ' + s.ab + ' MB');
    save(); if (state !== 'gone') { log('-> ' + OUT); await C.close(); process.exit(state === 'CRASHED' ? 2 : 1); }
    await sleep(5000);
    try { await C.cmd('HeapProfiler.collectGarbage'); const h = (await C.cmd('Runtime.getHeapUsage')).result; R.boot.afterGC = { heap: MiB(h.usedSize), ab: MiB(h.backingStorageSize || 0), pss: chromePss() }; } catch (e) {}
    log('   after GC: heap ' + (R.boot.afterGC || {}).heap + ' + ' + (R.boot.afterGC || {}).ab + ' MB, PSS ' + JSON.stringify((R.boot.afterGC || {}).pss)); save();
  }
  if (SKIP.has('boot')) {   // no boot measured: the page is still opened (and its loading waited for, when it has one)
    await C.cmd('Page.navigate', { url: URL0 }); const t0 = Date.now();
    while (Date.now() - t0 < 900000) { await sleep(2000); let st = 'x'; try { st = await C.ev('window.BOOT ? BOOT.state : (document.readyState === "complete" ? "gone" : "x")', 5000); } catch (e) {} if (st === 'gone') break; }
    await sleep(3000);
  }
  // the page-side helpers: a drag the player's way, timed to the handler and to the second frame after it
  await C.ev(`window.__MP = {
    frame2: () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))),
    async drag(k, reps, ticks) {
      const el = document.getElementById('p_' + k); if (!el || el.type !== 'range') return { key: k, missing: true };
      const PE = window.PointerEvent || Event, U = window.CAGE_UI || {};
      const lo = +el.min, hi = +el.max, x0 = +el.value, st = +el.step || 0.001, dir = (hi - x0) > (x0 - lo) ? 1 : -1, d = Math.max(st, (hi - lo) * 0.012);
      const tk = [], tkD = [], rl = [], rlD = [];
      for (let r = 0; r <= reps; r++) {
        el.dispatchEvent(new PE('pointerdown')); await new Promise(z => setTimeout(z, 20));
        for (let i = 1; i <= ticks; i++) { el.value = String(Math.min(hi, Math.max(lo, x0 + dir * d * i * (r % 2 ? -1 : 1) + dir * d * 5 * (r % 2))));
          const a = performance.now(); el.dispatchEvent(new Event('input')); const b = performance.now(); await this.frame2();
          if (r) { tk.push(b - a); tkD.push(performance.now() - a); } await new Promise(z => setTimeout(z, 30)); }
        const a = performance.now(); el.dispatchEvent(new Event('change')); window.dispatchEvent(new PE('pointerup')); const b = performance.now(); await this.frame2();
        if (r) { rl.push(b - a); rlD.push(performance.now() - a); } await new Promise(z => setTimeout(z, 1500));
      }
      el.value = String(x0); el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); await new Promise(z => setTimeout(z, 2000));
      const md = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? +s[Math.floor((s.length - 1) / 2)].toFixed(1) : null; };
      return { key: k, tick: md(tk), tickDrawn: md(tkD), release: md(rl), releaseDrawn: md(rlD), why: U.release ? JSON.stringify(U.release).slice(0, 120) : '' };
    },
    frames(sec) { return new Promise(res => { const dt = []; let last = performance.now(); const end = last + sec * 1000;
      const f = t => { dt.push(t - last); last = t; if (t < end) requestAnimationFrame(f); else res(dt); }; requestAnimationFrame(f); }); },
    scrub: { on: false, n: 0, rel: 0, async run(k) { const el = document.getElementById('p_' + k); if (!el) return; const PE = window.PointerEvent || Event;
      const lo = +el.min, hi = +el.max; this.on = true; let x = +el.value, dir = 1, t = 0;
      while (this.on) { el.dispatchEvent(new PE('pointerdown'));
        for (let i = 0; i < 20 && this.on; i++) { x += dir * (hi - lo) * 0.01; if (x > hi || x < lo) { dir = -dir; x = Math.min(hi, Math.max(lo, x)); }
          el.value = String(x); el.dispatchEvent(new Event('input')); this.n++; await new Promise(z => setTimeout(z, 100)); }
        el.dispatchEvent(new Event('change')); window.dispatchEvent(new PE('pointerup')); this.rel++; } } } }; 'ok'`);
  // ---- DRAG ----
  if (!SKIP.has('drag')) {
    R.drag = [];
    for (const k of ROWS) { let r; try { r = JSON.parse(await C.ev('__MP.drag(' + JSON.stringify(k) + ',' + REPS + ',' + TICKS + ').then(JSON.stringify)', 600000)); } catch (e) { r = { key: k, error: String(e) }; }
      R.drag.push(r); save();
      log('drag ' + k.padEnd(10) + (r.missing ? ' (no slider on this build)' : r.error ? ' ' + r.error : ' tick ' + r.tick + ' ms (drawn ' + r.tickDrawn + ')  release ' + r.release + ' ms (drawn ' + r.releaseDrawn + ')  ' + r.why)); }
  }
  // ---- FRAMES ----
  if (!SKIP.has('frames')) {
    const stat = dt => ({ n: dt.length, fps: +(1000 * dt.length / dt.reduce((a, x) => a + x, 0)).toFixed(1), p50: pct(dt, 0.5), p95: pct(dt, 0.95), p99: pct(dt, 0.99), over50: dt.filter(x => x > 50).length });
    R.frames = { rest: stat(JSON.parse(await C.ev('__MP.frames(' + FRAMES + ').then(JSON.stringify)', FRAMES * 1000 + 30000))) };
    // the orbit: a one-finger drag across the canvas's middle, back and forth, while the frames are counted
    const vp = JSON.parse(await C.ev('JSON.stringify([innerWidth, innerHeight])'));
    const fp = C.ev('__MP.frames(' + FRAMES + ').then(JSON.stringify)', FRAMES * 1000 + 30000);
    const y = vp[1] * 0.35, x0 = vp[0] * 0.3, x1 = vp[0] * 0.7, tEnd = Date.now() + FRAMES * 1000;
    await C.cmd('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
    for (let i = 0; Date.now() < tEnd; i++) { const u = (Math.sin(i / 15) + 1) / 2; await C.cmd('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * u, y }] }); await sleep(16); }
    await C.cmd('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    R.frames.orbit = stat(JSON.parse(await fp));
    log('frames at rest: ' + JSON.stringify(R.frames.rest) + '\nframes orbiting: ' + JSON.stringify(R.frames.orbit)); save();
  }
  // ---- SOAK: the heat ----
  if (!SKIP.has('soak') && SOAK > 0) {
    R.soak = []; C.ev('__MP.scrub.run(' + JSON.stringify(ROWS[0]) + ')', SOAK * 60000 + 60000).catch(() => {});
    const tEnd = Date.now() + SOAK * 60000;
    while (Date.now() < tEnd && !C.S.crashed && !C.S.closed) {
      let dt = []; try { dt = JSON.parse(await C.ev('__MP.frames(30).then(JSON.stringify)', 90000)); } catch (e) {}
      const th = thermals(); let h = {}; try { h = (await C.cmd('Runtime.getHeapUsage')).result || {}; } catch (e) {}
      let n = {}; try { n = JSON.parse(await C.ev('JSON.stringify({ ticks: __MP.scrub.n, releases: __MP.scrub.rel })', 10000)); } catch (e) {}
      const row = { min: +((SOAK * 60000 - (tEnd - Date.now())) / 60000).toFixed(1), fps: dt.length ? +(1000 * dt.length / dt.reduce((a, x) => a + x, 0)).toFixed(1) : null,
        p95: pct(dt, 0.95), batteryC: th.batteryC, status: th.status, temps: th.temps, heap: MiB(h.usedSize || 0), ab: MiB(h.backingStorageSize || 0), ...n };
      R.soak.push(row); save();
      log('soak ' + String(row.min).padStart(4) + ' min  fps ' + row.fps + ' (p95 ' + row.p95 + ' ms)  battery ' + row.batteryC + ' C  thermal ' + row.status + '  ' + Object.entries(row.temps).slice(0, 4).map(([k, v]) => k + ' ' + v).join(' ') + '  heap ' + row.heap + '+' + row.ab);
    }
    try { await C.ev('(__MP.scrub.on = false, 1)', 5000); } catch (e) {}
    if (C.S.crashed || C.S.closed) R.soakCrashed = true;
  }
  R.exceptions = C.S.exc.slice(0, 30); R.thermalsAtEnd = thermals(); save();
  log('-> ' + OUT); await C.close(); process.exit(0);
})().catch(e => { console.error('mobile_phone_cdp: ' + (e && e.stack || e)); process.exit(1); });
