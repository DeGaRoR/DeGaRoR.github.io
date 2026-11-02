#!/usr/bin/env node
// phone_edit.js - PHONE-EDIT-PERF (2 Nov): THE PHONE GARAGE'S EDITS, ON A DESKTOP PROXY OF THE USER'S S20 FE.
// The user (2 Nov, the phone garage on a Galaxy S20 FE 5G): "very laggy ... second long waits. Impossible to operate" - every
// slider release froze the page 6-11 s (their flight log: one 10.2 s frame = a setTimeout 8.5 s + the pointerup 1.5 s), worse
// with floats. The user does not move sliders for tests, so this rig does: a Chrome on this box as a phone - ?profile=phone,
// mobile emulation (--w x --h at --dpr, touch), the CPU throttled --cpu times - booted into the phone garage on --build, then
// per row of --rows (default: one or more per slider family) and per --reps:
//   drag    - the finger's way, as phone.js's knob drives the editor (R12: a pointerdown on the range, an `input` a frame for
//             --ticks frames, then the window's pointerup and the range's `change`): the ticks' handler ms (median / max),
//             the frame intervals while dragging (what "the plane follows the finger" is judged on), the release's own
//             handler ms (pointerup + change), then every long task until the page has been quiet --quiet ms: the
//             FREEZE (release start to the last long task's end) and its tasks;
//   typed   - the value chip's way (_cage_ui's v_<key> `change`): the handler ms and the freeze after it (--typed);
//   the page's own garage edit log (_cage_ui 'gedit': how, path, builds, sheet, layers; 'gtask': the named timers) for each.
// --idle S: S seconds of the shed at rest first: the frame intervals, draws and triangles (renderer.info via the recorder).
// --prof: the first rep's release under the CDP CPU profiler: self ms by function.
// Usage: node tools/perf/phone_edit.js --port 8741 --udd D:/upe1 [--build twin|cub|jodel|cessna|floats|<path>]
//          [--rows wgSpan,fltL] [--reps 3] [--ticks 20] [--cpu 6] [--dpr 2.625] [--w 412] [--h 915] [--quiet 1500]
//          [--typed] [--idle 10] [--prof] [--query 'extra=1'] [--out file.json]
// --phone [adbPort]: THE REAL PHONE (the user's S20 FE on the cable; A0 2 Nov): this tree served on --port, given to the phone
//   as its own localhost (adb reverse - a separate origin, so the user's own flydiy.wip and settings on the live site are never
//   touched), the phone's Chrome over adb forward (default 9333) - a NEW tab of our own, closed at the end; no emulation, no
//   throttle (the phone is the measure). The phone renders: no box lock needed, but nothing heavy beside a TIMED gate.
// The box (the desktop proxy): a browser run - boxlock + A0's slot first. No --help (an unknown flag is ignored).
'use strict';
const fs = require('fs'), path = require('path');
const MB = require('../master_bench.js');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const PORT = +opt('port', 0), UDD = opt('udd', null);
if (!PORT || (!UDD && !argv.includes('--phone'))) { console.error('phone_edit: --port (and --udd, but for --phone) are required'); process.exit(2); }
if (PORT >= 8600 && PORT <= 8680) { console.error('phone_edit: --port inside 8600-8680 (the cook ports) - pick 87xx'); process.exit(2); }
const REPO = path.resolve(__dirname, '..', '..', '..');
const BUILDS = { twin: 'bugReports/Twin_busher_floats_2.json', cub: 'builds/cub_2026-09-20_corrected.json', jodel: 'builds/jodel_2026-09-20_corrected.json',
  cessna: 'builds/cessna172_2026-09-20_corrected.json', floats: 'bugReports/cessnaFloatsWOrks.json', pa18: 'builds/pa18_floats_2026-10-23.json' };
const BK = opt('build', 'twin'), BUILD = BUILDS[BK] || BK;
// the slider families: wing, tail, fuselage (the sheet), boom, floats, engine, lights
const ROWS = opt('rows', 'wgSpan,wgChord,stSpan,finHeight,paxLen,halfW,boomLen,fltL,fltZ,engY,li_lampSize').split(',');
const REPS = +opt('reps', 3), TICKS = +opt('ticks', 20), CPU = +opt('cpu', 6), DPR = +opt('dpr', 2.625), VW = +opt('w', 412), VH = +opt('h', 915);
const QUIET = +opt('quiet', 1500), IDLE = +opt('idle', 0), TYPED = flag('typed');
const CENSUS = opt('census', null) ? opt('census').split(',') : (flag('census') ? ['base', 'noenv', 'lights1', 'nolamps', 'lambert', 'halfres', 'noplane', 'base'] : null);
// --idlecheck: the phone's idle hold (load WITHOUT ?idle=0): frames rendered in 5 s after 7 s untouched, then after a touch
// --shot <file.jpg>: the page after the idle / census (Page.captureScreenshot); --flightlog <file.json>: the page's flight log
const IDLECHECK = flag('idlecheck'), SHOTF = opt('shot', null), FLOGF = opt('flightlog', null);
const CSEC = +opt('csec', 8);
const PHONE = flag('phone'), APORT = +(opt('phone', '') || 9333);
const ADB = process.env.ADB || 'D:/Dev/platform-tools/adb.exe';
const adb = (...a) => { try { return require('child_process').execFileSync(ADB, a, { encoding: 'utf8', timeout: 20000 }); } catch (e) { return ''; } };
// the phone's Chrome: our own tab (never the user's), the same { ev, cmd, load, close, exc } as master_bench's browser
async function phoneBrowser() {
  adb('reverse', 'tcp:' + PORT, 'tcp:' + PORT);
  adb('forward', 'tcp:' + APORT, 'localabstract:chrome_devtools_remote');
  const base = 'http://127.0.0.1:' + APORT;
  const ver = await fetch(base + '/json/version').then(r => r.json()).catch(() => null);
  if (!ver) throw new Error('no DevTools on :' + APORT + ' - Chrome open on the phone, USB debugging allowed? (adb devices)');
  // the browser's socket: a target of our own (Target.createTarget - the phone's /json/new refuses), attached flat
  const ws = new WebSocket(ver.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0, sid = null; const waits = new Map(), exc = []; let closed = false;
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.sessionId && m.sessionId !== sid) return;
    if (m.method === 'Runtime.exceptionThrown') exc.push(((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text || '').split('\n')[0]);
    if (m.method === 'Inspector.targetCrashed') exc.push('TARGET CRASHED'); };
  ws.onclose = () => { closed = true; for (const f of waits.values()) f({ error: { message: 'closed' } }); waits.clear(); };
  const raw = (method, params, session) => closed ? Promise.resolve({ error: { message: 'closed' } }) : new Promise(r => { const i = ++id; waits.set(i, r);
    ws.send(JSON.stringify(Object.assign({ id: i, method, params: params || {} }, session ? { sessionId: session } : {}))); });
  const tgt = await raw('Target.createTarget', { url: 'about:blank' });
  if (!tgt.result) throw new Error('createTarget: ' + JSON.stringify(tgt.error));
  const targetId = tgt.result.targetId;
  const att = await raw('Target.attachToTarget', { targetId, flatten: true });
  sid = att.result && att.result.sessionId;
  if (!sid) throw new Error('attach: ' + JSON.stringify(att.error));
  const cmd = (method, params) => raw(method, params, sid);
  const ev = async (expr, ms) => {
    const r = await Promise.race([cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }), sleep(ms || 120000).then(() => ({ result: { result: { value: '__timeout' } } }))]);
    if (r.error) throw new Error(r.error.message); const d = r.result; if (d.exceptionDetails) throw new Error((d.exceptionDetails.exception || {}).description || d.exceptionDetails.text);
    return d.result.value; };
  process.on('exit', () => { try { ws.send(JSON.stringify({ id: ++id, method: 'Target.closeTarget', params: { targetId } })); } catch (e) {} });
  await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Inspector.enable');
  const load = async (url, pre) => {
    await cmd('Page.addScriptToEvaluateOnNewDocument', { source: pre });
    const t0 = Date.now(); await cmd('Page.navigate', { url }); await sleep(3000);
    const r = await ev("(() => Promise.race([(window.BOOT && BOOT.whenReady) ? BOOT.whenReady().then(() => 'ready') : new Promise(r => setTimeout(() => r('no BOOT'), 30000)), new Promise(r => setTimeout(() => r('boot timeout'), 300000))]))()", 310000);
    return { state: r, sec: +((Date.now() - t0) / 1000).toFixed(1) };
  };
  const close = async () => { try { await raw('Target.closeTarget', { targetId }); } catch (e) {} try { ws.close(); } catch (e) {} };
  return { ev, cmd, load, close, exc, device: adb('shell', 'getprop', 'ro.product.model').trim() };
}
const OUT = path.resolve(opt('out', path.join(__dirname, 'phone_edit_' + BK + '_' + Date.now() + '.json')));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = s => console.log('  ' + s);
const med = a => { const s = a.filter(x => x != null).slice().sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const r1 = x => x == null ? null : Math.round(x * 10) / 10;

// the page side: long tasks, frames, the garage edit log; a drag and a typed value as the phone sends them
const HARNESS = `(() => { if (window.__PE) return 'again';
  const G = window.__PE = { lt: [], fr: [], ev: [], last: 0 };
  try { new PerformanceObserver(l => l.getEntries().forEach(e => G.lt.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: false }); } catch (e) {}
  const loop = t => { if (G.last) G.fr.push([t, t - G.last]); G.last = t; if (G.fr.length > 40000) G.fr.splice(0, 20000); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  const F = window.FLIGHT_REC, e0 = F && F.event;
  if (F && e0) F.event = function (k, ms, d) { if (k === 'gedit' || k === 'gtask') G.ev.push([performance.now(), k, ms, d]); return e0.apply(F, arguments); };
  G.raf = () => new Promise(r => requestAnimationFrame(() => r(performance.now())));
  G.quiet = async (t0, q, cap) => { for (;;) { await new Promise(r => setTimeout(r, 100)); const now = performance.now(); const L = G.lt.filter(x => x[0] + x[1] > t0);
    const last = L.length ? Math.max(...L.map(x => x[0] + x[1])) : t0; if (now - last >= q || now - t0 > cap) return last; } };
  const PE = (t, o) => { try { return new PointerEvent(t, Object.assign({ bubbles: true, pointerId: 7, pointerType: 'touch' }, o || {})); } catch (e) { return new Event(t, { bubbles: true }); } };
  G.drag = async (k, ticks, quiet) => {
    const el = document.getElementById('p_' + k); if (!el || el.type !== 'range' || el.disabled) return { k, missing: true };
    const lo = +el.min, hi = +el.max, st = +el.step || 0.001, x0 = +el.value, dir = (hi - x0) > (x0 - lo) ? 1 : -1, span = Math.min(hi - lo, Math.abs(dir > 0 ? hi - x0 : x0 - lo)) * 0.6;
    const ev0 = G.ev.length, tk = [];
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: false }));
    let tLast = await G.raf(); const fr = [];
    for (let i = 1; i <= ticks; i++) {
      const v = x0 + dir * span * i / ticks; el.value = String(Math.round(v / st) * st);
      const a = performance.now(); el.dispatchEvent(new Event('input', { bubbles: true })); tk.push(performance.now() - a);
      const t = await G.raf(); fr.push(t - tLast); tLast = t;
    }
    const tR = performance.now();
    window.dispatchEvent(PE('pointerup')); el.dispatchEvent(new Event('change', { bubbles: true }));
    const rel = performance.now() - tR;
    const end = await G.quiet(tR, quiet, 60000);
    const L = G.lt.filter(x => x[0] + x[1] > tR).map(x => [+(x[0] - tR).toFixed(0), +x[1].toFixed(0)]);
    return { k, x0, x1: +el.value, ticks: tk, frames: fr, release: rel, freeze: Math.max(rel, end - tR), longs: L, ev: G.ev.slice(ev0).map(e => [+(e[0] - tR).toFixed(0), e[1], e[2], e[3]]) };
  };
  G.typed = async (k, quiet) => {
    const el = document.getElementById('p_' + k), vf = document.getElementById('v_' + k); if (!el || !vf || el.disabled) return { k, missing: true };
    const lo = +el.min, hi = +el.max, x0 = +el.value, dir = (hi - x0) > (x0 - lo) ? 1 : -1, v = x0 + dir * (hi - lo) * 0.05;
    const ev0 = G.ev.length; vf.value = String(+v.toFixed(4));
    const tR = performance.now(); vf.dispatchEvent(new Event('change', { bubbles: true })); const rel = performance.now() - tR;
    const end = await G.quiet(tR, quiet, 60000);
    const L = G.lt.filter(x => x[0] + x[1] > tR).map(x => [+(x[0] - tR).toFixed(0), +x[1].toFixed(0)]);
    return { k, x0, x1: +el.value, release: rel, freeze: Math.max(rel, end - tR), longs: L, ev: G.ev.slice(ev0).map(e => [+(e[0] - tR).toFixed(0), e[1], e[2], e[3]]) };
  };
  // back to a value, a plain release, settled
  G.back = async (k, v, quiet) => { const el = document.getElementById('p_' + k); if (!el) return 0; el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); await G.quiet(performance.now(), quiet, 60000); return 1; };
  G.idle = async s => { const t0 = performance.now(); await new Promise(r => setTimeout(r, s * 1000)); const fr = G.fr.filter(f => f[0] > t0).map(f => f[1]);
    const R = window.FLIGHT_REC, st = R && R.stats ? R.stats(s * 1000) : null, rr = window.FLYDIY_RENDERER || null;
    return { n: fr.length, fr, stats: st }; };
  return 'ok'; })()`;


// --census [v1,v2,...]: THE SHED'S MATERIALS, A/B (A0 2 Nov, the user: "the materials will be the things hitting it"): each
// variant applied in the page, --csec seconds of frames after a 4 s settle (the programs it needs linked), reverted. The scene is
// the one the game renders to the screen (caught off FLYDIY_RENDERER.render). Variants: base; noenv (scene.environment and
// every envMap off); lights1 (the first directional light alone); nolamps (the aeroplane's own point / spot lights off);
// lambert / basic (every mesh's material as a Lambert / Basic one with its colour and map - the cheap-material bounds);
// halfres (the pixel ratio halved). ?idle=0 belongs with it (the shed must draw).
const CENSUS_JS = `(() => { if (window.__CEN) return 'again'; const C = window.__CEN = { scenes: new Map(), undo: [] };
  const r = window.FLYDIY_RENDERER, o = r.render; r.render = function (sc, cam) { C.scenes.set(sc, 1); return o.apply(this, arguments); };
  C.scene = () => { let best = null, n = -1; for (const sc of C.scenes.keys()) { let k = 0; sc.traverse(x => { if (x.isMesh && x.visible) k++; }); if (k > n) { n = k; best = sc; } } return best; };
  const mats = sc => { const L = []; sc.traverse(x => { if (x.isMesh && x.material) L.push(x); }); return L; };
  C.apply = v => { const sc = C.scene(); if (!sc) return 'no scene'; const T = window.THREE;
    if (v === 'noenv') { const e = sc.environment; sc.environment = null; C.undo.push(() => { sc.environment = e; }); }
    if (v === 'lights1') { let kept = false; sc.traverse(x => { if (x.isLight && x.visible) { if (x.isDirectionalLight && !kept) { kept = true; return; } x.visible = false; C.undo.push(() => { x.visible = true; }); } }); }
    if (v === 'nolamps') sc.traverse(x => { if ((x.isPointLight || x.isSpotLight) && x.visible) { x.visible = false; C.undo.push(() => { x.visible = true; }); } });
    if (v === 'lambert' || v === 'basic') { const K = v === 'lambert' ? T.MeshLambertMaterial : T.MeshBasicMaterial, cache = new Map();
      for (const m of mats(sc)) { if (m.isSkinnedMesh) continue; const old = m.material;
        const mk = mt => { if (cache.has(mt)) return cache.get(mt); const n = new K({ color: mt.color ? mt.color.clone() : 0xcccccc, map: mt.map || null, transparent: !!mt.transparent, opacity: mt.opacity == null ? 1 : mt.opacity, side: mt.side, depthWrite: mt.depthWrite }); cache.set(mt, n); return n; };
        m.material = Array.isArray(old) ? old.map(mk) : mk(old); C.undo.push(() => { m.material = old; }); } }
    if (v === 'halfres') { const pr = r.getPixelRatio(); r.setPixelRatio(pr * 0.5); window.dispatchEvent(new Event('resize')); C.undo.push(() => { r.setPixelRatio(pr); window.dispatchEvent(new Event('resize')); }); }
    if (v === 'noplane') for (const m of mats(sc)) if (m.visible) { m.visible = false; C.undo.push(() => { m.visible = true; }); }
    return 'ok'; };
  C.revert = () => { while (C.undo.length) try { C.undo.pop()(); } catch (e) {} return 'ok'; };
  C.sample = async (v, settle, sec) => { const a = C.apply(v); await new Promise(rs => setTimeout(rs, settle));
    await new Promise(rs => setTimeout(rs, sec * 1000));
    const s = window.FLIGHT_REC.stats(sec * 1000), info = window.FLYDIY_RENDERER.info;
    const out = { v, a, fps: +s.fps.toFixed(1), p50: +s.med.toFixed(1), p90: +s.p90.toFixed(1), max: +s.max.toFixed(0), work: +s.work.toFixed(1), programs: info.programs ? info.programs.length : null };
    C.revert(); await new Promise(rs => setTimeout(rs, 1500)); return out; };
  return 'ok'; })()`;
(async () => {
  // (a server already serving THIS tree on the port - phone_night.sh's - is used as it is)
  const already = await MB.serveRoot(PORT);
  if (already && path.resolve(already) !== REPO) { console.error('phone_edit: port ' + PORT + ' serves ' + already + ', not this tree'); process.exit(4); }
  const srv = already ? null : MB.serve(PORT, null); if (srv) await sleep(800);
  const root = await MB.serveRoot(PORT);
  if (!root || path.resolve(root) !== REPO) { console.error('phone_edit: the server serves ' + root + ', not ' + REPO); try { if (srv) srv.kill(); } catch (e) {} process.exit(4); }
  const done = () => { if (!srv) return; try { srv.kill(); require('child_process').execSync('taskkill /PID ' + srv.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} };
  process.on('exit', done);
  const R = { date: new Date().toISOString(), build: BK, file: BUILD, cpu: CPU, dpr: DPR, w: VW, h: VH, ticks: TICKS, reps: REPS, rows: [] };
  const save = () => fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
  const b = PHONE ? await phoneBrowser() : await MB.browser(UDD);
  if (PHONE) { R.device = b.device; R.cpu = 1; log('the phone: ' + b.device); }
  // the proxy: the phone's viewport and DPR, touch, a mobile UA's layout; the CPU after the boot (a 6x boot takes minutes)
  else { await b.cmd('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: DPR, mobile: true });
    await b.cmd('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); }
  const url = 'http://localhost:' + PORT + '/flyDiy/' + opt('page', 'index.html') + '?profile=phone' + (opt('query', '') ? '&' + opt('query') : '');
  const l = await b.load(url, MB.preScript(BUILD, null, null));
  log('loaded ' + l.state + ' in ' + l.sec + ' s (' + url + ')');
  await sleep(6000);
  R.meta = JSON.parse(await b.ev(`JSON.stringify({ profile: window.PROFILE && PROFILE.name, catcher: window.POST_FX && POST_FX.catcher && POST_FX.catcher.summary(),
    menuLog: !!(window.FLYDIY_MENU), dpr: devicePixelRatio, canvas: (() => { const c = document.getElementById('c'); return c ? [c.width, c.height] : null; })() })`));
  log('page: ' + JSON.stringify(R.meta));
  log('harness ' + await b.ev(HARNESS));
  if (CPU > 1 && !PHONE) await b.cmd('Emulation.setCPUThrottlingRate', { rate: CPU });
  await sleep(3000);
  if (IDLE) {
    const id = JSON.parse(await b.ev(`(async () => JSON.stringify(await __PE.idle(${IDLE})))()`, IDLE * 1000 + 30000));
    const s = id.fr.slice().sort((x, y) => x - y), q = p => s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null;
    R.idle = { n: id.n, p50: r1(q(0.5)), p90: r1(q(0.9)), max: r1(s[s.length - 1]), stats: id.stats };
    log('idle ' + IDLE + ' s: ' + id.n + ' frames, p50 ' + R.idle.p50 + ' p90 ' + R.idle.p90 + ' max ' + R.idle.max + ' ms; ' + JSON.stringify(id.stats || {}).slice(0, 300));
    save();
  }
  if (IDLECHECK) {
    const ic = JSON.parse(await b.ev(`(async () => { const w = ms => new Promise(r => setTimeout(r, ms));
      await w(7000); const held = window.FLIGHT_REC.stats(5000); await w(5000); const s0 = window.FLIGHT_REC.stats(5000);
      window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await w(3000); const s1 = window.FLIGHT_REC.stats(2500);
      return JSON.stringify({ on: !!window.FLYDIY_IDLE, heldFrames: window.FLYDIY_IDLE ? window.FLYDIY_IDLE.held : null, idleFps: +s0.fps.toFixed(1), afterTouchFps: +s1.fps.toFixed(1) }); })()`, 60000));
    R.idlecheck = ic; save();
    log('idle hold: ' + JSON.stringify(ic));
  }
  if (CENSUS) {
    log('census ' + await b.ev(CENSUS_JS));
    R.census = [];
    for (const v of CENSUS) {
      const c = JSON.parse(await b.ev(`(async () => JSON.stringify(await __CEN.sample(${JSON.stringify(v)}, 4000, ${CSEC})))()`, CSEC * 1000 + 60000));
      R.census.push(c); save();
      log('census ' + v.padEnd(9) + ' ' + c.fps + ' fps  p50 ' + c.p50 + '  p90 ' + c.p90 + '  max ' + c.max + ' ms  work ' + c.work + '  programs ' + c.programs + (c.a !== 'ok' ? '  (' + c.a + ')' : ''));
    }
  }
  for (const k of (opt('rows', null) === 'none' ? [] : ROWS)) {
    const reps = []; let prof = null, x0 = null;
    for (let r = 0; r < REPS + (flag('prof') ? 1 : 0); r++) {
      const P = flag('prof') && r === 0;
      if (P) { await b.cmd('Profiler.enable'); await b.cmd('Profiler.setSamplingInterval', { interval: 500 }); await b.cmd('Profiler.start'); }
      const one = JSON.parse(await b.ev(`(async () => JSON.stringify(await __PE.${TYPED ? 'typed(' + JSON.stringify(k) + ', ' + QUIET + ')' : 'drag(' + JSON.stringify(k) + ', ' + TICKS + ', ' + QUIET + ')'}))()`, 180000));
      if (P) { const p = await b.cmd('Profiler.stop'); await b.cmd('Profiler.disable'); prof = p.result && p.result.profile ? selfTop(p.result.profile) : null; }
      if (one.missing) { log(k.padEnd(12) + ' (no slider)'); break; }
      if (x0 == null) x0 = one.x0;
      await b.ev(`(async () => __PE.back(${JSON.stringify(k)}, ${one.x0}, ${QUIET}))()`, 180000);
      if (!P) reps.push(one);
    }
    if (!reps.length) { R.rows.push({ k, missing: true }); save(); continue; }
    const tick = reps.flatMap(x => x.ticks || []), fr = reps.flatMap(x => x.frames || []);
    const row = { k, how: TYPED ? 'typed' : 'drag', tickMed: r1(med(tick)), tickMax: r1(tick.length ? Math.max(...tick) : null), dragFrameMed: r1(med(fr)), dragFrameMax: r1(fr.length ? Math.max(...fr) : null),
      release: r1(med(reps.map(x => x.release))), freeze: r1(med(reps.map(x => x.freeze))), freezeMax: r1(Math.max(...reps.map(x => x.freeze))), reps, prof };
    R.rows.push(row); save();
    log(k.padEnd(12) + (TYPED ? '' : ' tick ' + row.tickMed + '/' + row.tickMax + '  drag frame ' + row.dragFrameMed + '/' + row.dragFrameMax) + '  RELEASE ' + row.release + '  FREEZE ' + row.freeze + ' (max ' + row.freezeMax + ')');
    const last = reps[reps.length - 1];
    log('      long tasks: ' + last.longs.map(x => '+' + x[0] + ':' + x[1]).join(' '));
    for (const e of last.ev) log('      +' + e[0] + ' ' + e[1] + ' ' + r1(e[2]) + ' ms ' + (e[3] && typeof e[3] === 'object' ? [e[3].how, e[3].path, e[3].why, 'build ' + e[3].build + '/' + e[3].builds, 'sheet ' + e[3].sheet, 'onBuild ' + e[3].onBuild, e[3].layers].filter(Boolean).join(' | ') : e[3]));
    if (prof) log('      prof self: ' + prof.slice(0, 14).map(([f, ms]) => f + ' ' + ms).join(', '));
  }
  if (SHOTF) { const sh = await b.cmd('Page.captureScreenshot', { format: 'jpeg', quality: 85 }); if (sh.result) { fs.writeFileSync(SHOTF, Buffer.from(sh.result.data, 'base64')); log('still -> ' + SHOTF); } }
  if (FLOGF) { try { const t = await b.ev(`(() => { const R = window.FLIGHT_REC && window.FLIGHT_REC.rec; const p = R && R.logParts ? R.logParts() : null; return p ? (Array.isArray(p) ? p.join('') : String(p)) : ''; })()`, 120000);
    if (t && t !== '__timeout') { fs.writeFileSync(FLOGF, t); log('flight log -> ' + FLOGF + ' (' + t.length + ' chars)'); } } catch (e) { log('flight log: ' + e.message); } }
  R.exc = b.exc.slice();
  if (CPU > 1 && !PHONE) await b.cmd('Emulation.setCPUThrottlingRate', { rate: 1 });
  await b.close();
  save(); log('-> ' + OUT);
  process.exit(0);
})().catch(e => { console.error('phone_edit: ' + (e && e.stack || e)); process.exit(1); });

function selfTop(p) {
  const byId = new Map(p.nodes.map(n => [n.id, n])), self = new Map();
  for (let i = 0; i < p.samples.length; i++) { const n = byId.get(p.samples[i]), us = p.timeDeltas[i + 1] || 0; if (!n) continue;
    const cf = n.callFrame, k = (cf.functionName || '(anon)') + ' ' + (cf.url || '').split('/').pop().split('?')[0] + ':' + (cf.lineNumber + 1);
    self.set(k, (self.get(k) || 0) + us); }
  return [...self].filter(x => !/^\((idle|program|root)\)/.test(x[0])).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, us]) => [k, +(us / 1000).toFixed(1)]);
}
