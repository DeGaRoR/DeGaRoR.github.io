#!/usr/bin/env node
// ground_cost.js - WHAT THE GROUND COSTS, PART BY PART (GROUND-COST G2075, 2026-10-06; the user's target: an even 30 on a
// GTX 1660 Ti laptop at retro - HW-COVERAGE's ?diag put the lean ground at 8 of retro's 12.8 GPU ms on the box's 3080).
// One headed Chrome (the live clock, as diag_run.js), the page at --size with ?gfx=<preset> (+ --q), rolled out to the stand,
// paused, the camera fixed; then per VIEW (stand / taxi / 300 m) and per VARIANT (a ground strip set at compile time -
// splat_ground api.strip, #define GS_<NAME> - and/or splat knobs, live):
//   ground ms   every draw of the island ground's materials (render_world GROUND_FAMILY, the premises patch's clones in)
//               wrapped in its own TIME_ELAPSED query, summed per frame - the ground's GPU time alone (median of N frames)
//   frame ms    the flight recorder's GPU timer round the whole frame (median), with the ground queries off
//   a still     Page.captureScreenshot per view x variant (<out>_<view>_<variant>.png) for the x4 diffs (ground_diff.py)
// The variants are named in --variants as  name=strip1+strip2|knob:value,knob:value|gfxrow:value  joined by ';' (base = none):
//   --variants "base=;vote4=vote4;nohex=nohex;hexoff=|hexOn:0;plain=||ground:plain"
// A program re-key is a cold compile (ANGLE/D3D: 15-60 s a ground program): --udd keeps a profile whose shader cache a
// shake-down run filled (--warm), so the timed run pays no compile.
// Usage: node tools/perf/ground_cost.js --out tools/perf/gcost/run1 [--preset retro] [--views stand,taxi,air300] [--day noon]
//          [--variants "..."] [--frames 90] [--size 1920x1080] [--sport 8591] [--dport 9491] [--udd C:/gcost] [--warm] [--q ''] [--page dev.html]
//          [--noshots] [--repeat 1]
// A GPU MEASUREMENT: boxlock.sh take gpu <WHO> first, drop it after. Rigs have no --help.
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
// --root <checkout>: serve another tree (the 'before' of a before/after: a worktree of master) - the rig itself runs from here
const ROOT = opt('root', null) ? path.resolve(opt('root')) : path.resolve(__dirname, '..', '..', '..');
const OUT = path.resolve(opt('out', 'ground_cost')).replace(/\.json$/, '');
const PRESET = opt('preset', 'retro'), DAY = opt('day', ''), Q = opt('q', ''), PAGE = opt('page', 'dev.html');
const SIZE = opt('size', '1920x1080').split('x').map(Number), FRAMES = +opt('frames', 90), REPEAT = +opt('repeat', 1);
const VIEWS = opt('views', 'stand').split(',');
const VARIANTS = opt('variants', 'base=').split(';').filter(Boolean).map(s => { const i = s.indexOf('='); const name = s.slice(0, i), body = s.slice(i + 1);
  const [st, kn, gx] = body.split('|'); const knobs = {}, gfx = {}; for (const kv of (kn || '').split(',').filter(Boolean)) { const [k, v] = kv.split(':'); knobs[k] = +v; }
  for (const kv of (gx || '').split(',').filter(Boolean)) { const [k, v] = kv.split(':'); gfx[k] = isNaN(+v) ? v : +v; }
  return { name, strip: (st || '').split('+').filter(Boolean), knobs, gfx }; });
const SPORT = +opt('sport', 8591), DPORT = +opt('dport', 9491), UDD = opt('udd', 'C:/gcost'), SHOTS = !flag('noshots');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
fs.mkdirSync(path.dirname(OUT), { recursive: true });
if (!flag('warm')) try { fs.rmSync(UDD, { recursive: true, force: true }); } catch (e) {}
const server = spawn(process.execPath, [path.join(__dirname, '..', '_serve.js'), String(SPORT), ROOT, '--fallback', 'D:/Dev/DeGaRoR.github.io'], { stdio: 'ignore' });
const ch = spawn(CHROME, ['--remote-debugging-port=' + DPORT, '--window-size=' + (SIZE[0] + 16) + ',' + (SIZE[1] + 140), '--window-position=0,0', '--no-first-run', '--no-default-browser-check',
  '--user-data-dir=' + UDD, '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--disable-gpu-vsync', '--disable-frame-rate-limit', 'about:blank'], { stdio: 'ignore' });
const kill = () => { for (const p of [ch, server]) try { execSync('taskkill /PID ' + p.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} };
process.on('exit', kill); process.on('SIGINT', () => process.exit(0)); process.on('SIGTERM', () => process.exit(0));

// ---- the page-side instrument (installed once after the roll-out) ----------------------------------------------------
const INSTRUMENT = `(() => {
  if (window.__GC) return 'have';
  const FP = window.FLIGHT_PROBE, R = FP.renderer(), gl = R.getContext(), X = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const S = { on: false, frame: 0, pending: [], acc: [], draws: 0 };
  const rbd = R.renderBufferDirect;
  R.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
    if (!S.on || !X || !material || !material.groundFamily) return rbd.apply(this, arguments);
    const q = gl.createQuery(); gl.beginQuery(X.TIME_ELAPSED_EXT, q);
    const r = rbd.apply(this, arguments);
    gl.endQuery(X.TIME_ELAPSED_EXT); S.pending.push({ q, f: S.frame }); S.draws++;
    return r;
  };
  const poll = () => { const keep = [];
    for (const h of S.pending) { if (gl.getQueryParameter(h.q, gl.QUERY_RESULT_AVAILABLE)) {
      if (!gl.getParameter(X.GPU_DISJOINT_EXT)) S.acc[h.f] = (S.acc[h.f] || 0) + gl.getQueryParameter(h.q, gl.QUERY_RESULT) / 1e6; else S.acc[h.f] = NaN;
      gl.deleteQuery(h.q); } else keep.push(h); }
    S.pending = keep; };
  const med = a => { const b = a.filter(x => x === x).sort((x, y) => x - y); return b.length ? b[b.length >> 1] : null; };
  // n frames of ground queries (the recorder's frame timer off: queries cannot nest) -> { groundMs, draws/frame }
  const ground = n => new Promise(res => {
    const REC = window.FLIGHT_REC; const tOn = REC && REC.gpuTimer ? REC.gpuTimer() : false; if (tOn) REC.gpuTimer(false);
    S.on = true; S.frame = 0; S.acc = []; S.draws = 0;
    const tick = () => { poll(); S.frame++; if (S.frame < n) return requestAnimationFrame(tick);
      S.on = false; let k = 0; const dr = () => { poll(); if (S.pending.length && ++k < 60) return requestAnimationFrame(dr);
        if (tOn) REC.gpuTimer(true); const v = S.acc.slice(5); res({ groundMs: med(v), groundN: v.filter(x => x === x).length, gdraws: Math.round(S.draws / n) }); };
      requestAnimationFrame(dr); };
    requestAnimationFrame(tick); });
  // the recorder's frames over ms milliseconds -> { frameGpuMs, fps, draws, mtris }
  const frame = async ms => { const REC = window.FLIGHT_REC && FLIGHT_REC.rec; if (!REC) return {};
    const f0 = REC.frame; await new Promise(r => setTimeout(r, ms)); const F = REC.F || {}, g = [], dt = [], calls = [], tris = [];
    for (let f = f0; f < REC.frame; f++) { const r = REC.row(f); if (!r || !(r.dt === r.dt)) continue; const fl = r.flags | 0; if ((F.away && (fl & F.away)) || (F.boot && (fl & F.boot))) continue;
      dt.push(r.dt); if (r.gpu === r.gpu) g.push(r.gpu); if (r.calls === r.calls) calls.push(r.calls); if (r.tris === r.tris) tris.push(r.tris); }
    const sum = dt.reduce((a, b) => a + b, 0);
    return { frameGpuMs: med(g), fps: sum ? 1000 * dt.length / sum : null, draws: med(calls), mtris: tris.length ? med(tris) / 1e6 : null }; };
  // the frames flow again (a re-keyed program compiles synchronously on its first draw): 40 frames under 80 ms in a row
  const flowing = () => new Promise(res => { let ok = 0, last = performance.now(); const t0 = last;
    const tick = () => { const t = performance.now(); ok = t - last < 80 ? ok + 1 : 0; last = t; if (ok >= 40 || t - t0 > 240000) return res(Math.round(t - t0)); requestAnimationFrame(tick); };
    requestAnimationFrame(tick); });
  window.__GC = { ground, frame, flowing, S };
  return 'installed ' + (X ? 'timer' : 'NO TIMER');
})()`;

(async () => {
  let tgt = null;
  for (let i = 0; i < 60 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + DPORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map(); const errs = [];
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).slice(0, 300));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push('console: ' + m.params.args.map(a => a.value || a.description || '').join(' ').slice(0, 300)); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); const d = r.result;
    if (!d || d.exceptionDetails) throw new Error('page: ' + (d && d.exceptionDetails ? (d.exceptionDetails.exception && d.exceptionDetails.exception.description || d.exceptionDetails.text) : JSON.stringify(r)));
    return d.result.value; };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: 'try{for(const k of Object.keys(localStorage)) if(/^flydiy\\.(fl([A-Z]|$)|route$|world$|gfx$|premises\\.game|diag|ground\\.splat|day)/.test(k)) localStorage.removeItem(k);}catch(e){}' });
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: require('../_stock_pin.js').pinScript() });
  await cmd('Emulation.setDeviceMetricsOverride', { width: SIZE[0], height: SIZE[1], deviceScaleFactor: 1, mobile: false });
  await cmd('Page.bringToFront');
  const url = 'http://localhost:' + SPORT + '/flyDiy/' + PAGE + '?gfx=' + PRESET + (DAY ? '&day=' + DAY : '') + (Q ? '&' + Q : '');
  const T0 = Date.now(), el = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
  await cmd('Page.navigate', { url });
  console.log('ground_cost ' + url);
  const KEEP = "(()=>{const l=[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0&&b.offsetParent);l.forEach(x=>x.click());return l.length;})()";
  const inShed = "!!(document.body && document.body.classList.contains('mode-ws'))";
  const quiet = "(()=>{const b=window.BOOT;return !b||(b.state==='gone'&&!(typeof b.busy==='function'&&b.busy()));})()";
  for (let i = 0; i < 900; i++) { await sleep(1000); try { await ev(KEEP); if (await ev('!!(window.FLIGHT_PROBE && window.GFX && window.BOOT) && ' + inShed + ' && ' + quiet)) break; } catch (e) {} }
  console.log('  shed up ' + el() + ' · gfx ' + await ev('GFX.get().preset'));
  await ev("(()=>{const g=document.getElementById('bGo'); if (g) g.click(); if (GFX.hw && GFX.hw.hold) GFX.hw.hold(true); return 1;})()");
  for (let i = 0; i < 600; i++) { await sleep(1000); try { if (await ev('!' + inShed + ' && ' + quiet)) break; } catch (e) {} }
  await sleep(4000);
  console.log('  rolled out ' + el() + ' · ' + await ev(INSTRUMENT) + ' · ' + await ev("(()=>{const g=FLIGHT_PROBE.renderer().getContext(),d=g.getExtension('WEBGL_debug_renderer_info');return d?g.getParameter(d.UNMASKED_RENDERER_WEBGL):'?';})()"));
  // the player's pause by the button's own word (FLYDIY_HELD is set on the next frame: two calls in one frame toggled it back)
  const pause = "(()=>{ const b=document.getElementById('bPause'); if (b && !b.hidden && b.textContent.trim().toLowerCase() === 'pause') b.click(); return b ? b.textContent : '?'; })()";
  // held before anything is read: the button shows once the reveal is over; until it reads Run / Resume the aeroplane taxis
  for (let i = 0; i < 120; i++) { const t = String(await ev(pause)).trim().toLowerCase(); if (t && t !== 'pause' && t !== '?') break; await sleep(500); }
  await sleep(1500);
  // THE FRAME UNCAPPED WHILE IT MEASURES (the box's first runs: at the preset's 30 cap the GPU idles between frames and its
  // clocks fall - the same program read 5.7 to 7.6 ms row to row): the GPU flat out, its clocks steady; a GPU ms is a GPU ms
  await ev("(()=>{ GFX.set('fps', 'off'); return GFX.get().fps; })()");
  console.log('  held: ' + await ev("document.getElementById('bPause').textContent") + ' · FLYDIY_HELD ' + await ev('!!window.FLYDIY_HELD'));
  await ev("(async()=>{const FP=FLIGHT_PROBE; if (FP.camModeNow && FP.camModeNow()!=='orbit') FP.camMode('orbit'); await new Promise(r=>setTimeout(r,500)); FP.camSettle(); return 1;})()");
  // --place forest[:agl]: the aeroplane set down (agl m over the ground, default 2) at the densest stand of trees within 2.5 km
  // (frame_perf.js's own finder), held there - the forest floor's views (GROUND-LOOK G2610). Absolute (FLIGHT_PROBE.place 'at'),
  // then held again: a relative move under the physics worker read a stale CG and buried the eye (6 Oct)
  if (opt('place', null)) {
    const [pk, pa] = opt('place').split(':'); const AGL = isFinite(+pa) ? +pa : 2;
    if (pk === 'forest') console.log('  placed: ' + await ev(`(async () => {
      const w = FLIGHT_PROBE.world(); const T = (w.trees || []).filter(t => Math.hypot(t.x, t.z) < 2500);
      let best = null, bn = -1;
      for (let i = 0; i < T.length; i += 7) { const a = T[i]; let n = 0; for (const b of T) if (Math.abs(b.x - a.x) < 120 && Math.abs(b.z - a.z) < 120) n++; if (n > bn) { bn = n; best = a; } }
      if (!best) return 'no trees';
      // a clearing inside the stand: the nearest point 6-12 m from the chosen tree with no trunk within 4 m
      let at = [best.x + 8, best.z];
      for (let r = 6; r <= 14; r += 2) { let found = false; for (let k = 0; k < 12 && !found; k++) { const x = best.x + r * Math.cos(k * 0.5236), z = best.z + r * Math.sin(k * 0.5236);
        if (!T.some(t => Math.hypot(t.x - x, t.z - z) < 4)) { at = [x, z]; found = true; } } if (found) break; }
      const y = w.terrainH(at[0], at[1]) + ${AGL};
      await FLIGHT_PROBE.place({ at: [at[0], y, at[1]], zeroV: true });
      return JSON.stringify({ at: [at[0] | 0, y | 0, at[1] | 0], neighbours: bn }); })()`));
    await sleep(2500);
    for (let i = 0; i < 20; i++) { const t = String(await ev(pause)).trim().toLowerCase(); if (t && t !== 'pause' && t !== '?') break; await sleep(500); }
  }
  const cam0 = await ev('FLIGHT_PROBE.cam()');
  const cg0 = await ev('FLIGHT_PROBE.sim().cgPos()');
  console.log('  cam ' + JSON.stringify(cam0) + ' cg ' + cg0.map(v => v | 0));
  // the views: where the aeroplane is held and the eye (az / el / dist as the orbit takes them)
  // THE VIEWS ARE THE EYE ALONE (the aeroplane stays on its stand, paused - a placement under the physics worker buried the
  // eye in the ground on the box's first run): the orbit's azimuth / elevation (rad) / distance (m) round the stand
  const VIEW = {
    stand: { cam: [cam0.azT, cam0.elT, cam0.distT] },
    taxi: { cam: [cam0.azT, 0.06, 7] },
    air300: { cam: [cam0.azT, 0.55, 560] },   // ~290 m over the stand, looking down the island at ~30 deg
    // the grass round the stand (the stand and taxi views are mostly the apron): the eye turned away from it, low
    field1: { cam: [cam0.azT + Math.PI, 0.12, 30] },
    field2: { cam: [cam0.azT + Math.PI / 2, 0.12, 30] },
    field3: { cam: [cam0.azT - Math.PI / 2, 0.12, 30] },
    low: { cam: [cam0.azT + Math.PI, 0.30, 140] },   // ~40 m up, the near field and the forest's edge
    grass: { cam: [cam0.azT + Math.PI + 0.35, 0.035, 260] },   // ~9 m up, 260 m out past the apron: the grass at taxi height
    // GROUND-LOOK (with --place forest): the forest floor at 10 / 40 / 150 m, a crash-site close-up, the seams at 400 m and 1.2 km
    f10: { cam: [cam0.azT, 0.35, 10] }, f40: { cam: [cam0.azT, 0.30, 40] }, f150: { cam: [cam0.azT, 0.25, 150] },
    crash: { cam: [cam0.azT + 0.8, 0.65, 4] },
    s400: { cam: [cam0.azT, 0.20, 400] }, s1200: { cam: [cam0.azT, 0.12, 1200] },
  };
  const place = async v => { await ev(pause); const c = VIEW[v].cam; await ev('FLIGHT_PROBE.camSet(' + c.join(',') + ')'); };
  const apply = async V => {
    const st = JSON.stringify(V.strip.slice().sort());
    // the graphics rows: the preset's own back first, then the variant's (a settle per change, as the menu does)
    const gr = await ev(`(()=>{ window.__GC.g0 = window.__GC.g0 || GFX.get(); const want = Object.assign({}, ${JSON.stringify(V.gfx)}); let n = 0;
      for (const k of Object.keys(window.__GC.g0)) { const v = k in want ? want[k] : window.__GC.g0[k]; if (GFX.get()[k] !== v && GFX.OPTIONS.some(o => o.k === k && !o.reload)) { GFX.set(k, v); if (typeof FLYDIY_SETTLE === 'function') FLYDIY_SETTLE(k); n++; } }
      return n; })()`);
    const r = await ev(`(()=>{const sp=WORLD.ground.splat(); if(!sp) return 'no splat'; if (!sp.strip) { if (${JSON.stringify(V.strip)}.length) return 'NO STRIPS IN THIS TREE'; } const was=sp.strip ? JSON.stringify(sp.strip()) : '[]'; const k0=sp.knobs();
      window.__GC.k0 = window.__GC.k0 || k0; sp.set(Object.assign({}, window.__GC.k0, ${JSON.stringify(V.knobs)}));
      if (was !== '${st}') sp.strip(${st}); return was === '${st}' ? 'same' : 'rekeyed';})()`);
    const ms = await ev('__GC.flowing()');
    return r + (gr ? ' +' + gr + ' gfx' : '') + ' (' + ms + ' ms to flow)';
  };
  const rows = [];
  for (let rep = 0; rep < REPEAT; rep++) for (const v of VIEWS) {
    await place(v); await sleep(2500);
    for (const V of VARIANTS) {
      const how = await apply(V);
      await ev(pause); await place(v); await sleep(2000); await ev('FLIGHT_PROBE.camSet(' + VIEW[v].cam.join(',') + ')');
      const fr = await ev('__GC.frame(2000)');
      const gr = await ev('__GC.ground(' + FRAMES + ')');
      const sst = await ev("(()=>{const sp=WORLD.ground.splat(); return sp ? (sp.ready() ? 'R' : 'r') + (sp.plain() ? 'P' : '') + (sp.on() ? '' : 'off') + ' ' + (sp.strip ? sp.strip().join('+') : '(before G2075)') + (sp.lean && sp.lean() ? ' lean' : '') : 'none';})()");
      const row = Object.assign({ rep, view: v, variant: V.name, strip: V.strip, knobs: V.knobs, how, splat: sst }, fr, gr);
      for (const k of ['frameGpuMs', 'fps', 'groundMs', 'mtris']) if (row[k] != null) row[k] = Math.round(row[k] * 100) / 100;
      rows.push(row);
      console.log('  ' + el() + '  ' + v.padEnd(7) + V.name.padEnd(16) + 'ground ' + String(row.groundMs).padStart(6) + ' ms  frame ' + String(row.frameGpuMs).padStart(6) + ' ms  ' +
        (row.fps ? row.fps.toFixed(0) : '-') + ' fps  ' + row.gdraws + ' gdraws  [' + sst + ']  ' + how);
      // the variant's ground programs as the driver got them (cold_links_bench.js --progs format), once per variant
      if (rep === 0 && v === VIEWS[0] && flag('progs')) { const src = await ev(`(()=>{ const R = FLIGHT_PROBE.renderer(), gl = R.getContext(), out = [], seen = new Set();
          WORLD.scene.traverse(o => { const m = o.material; if (!m || !m.groundFamily) return; const pr = R.properties.get(m), cp = pr && pr.currentProgram; if (!cp || seen.has(cp)) return; seen.add(cp);
            const sh = gl.getAttachedShaders(cp.program) || []; const g = t => { const x = sh.find(z => gl.getShaderParameter(z, gl.SHADER_TYPE) === t); return x ? gl.getShaderSource(x) : ''; };
            out.push({ name: (m.customProgramCacheKey ? m.customProgramCacheKey() : m.type), vs: g(gl.VERTEX_SHADER), fs: g(gl.FRAGMENT_SHADER) }); });
          return JSON.stringify(out); })()`);
        fs.writeFileSync(OUT + '_' + V.name + '_progs.json', src); }
      if (SHOTS && rep === 0) { const s = await cmd('Page.captureScreenshot', { format: 'png' }); if (s.result) fs.writeFileSync(OUT + '_' + v + '_' + V.name + '.png', Buffer.from(s.result.data, 'base64')); }
      fs.writeFileSync(OUT + '.json', JSON.stringify({ url, preset: PRESET, day: DAY, size: SIZE, frames: FRAMES, at: new Date().toISOString(), rows, errs }, null, 1));
    }
  }
  await ev(`(()=>{const sp=WORLD.ground.splat(); if (sp && window.__GC.k0) sp.set(window.__GC.k0); if (sp && sp.strip) sp.strip([]); return 1;})()`).catch(() => {});
  console.log('-> ' + OUT + '.json');
  if (errs.length) console.log('page errors: ' + errs.slice(0, 6).join(' | '));
  try { await cmd('Browser.close'); } catch (e) {}
  await sleep(1500);
  process.exit(0);
})().catch(e => { console.error('ground_cost: ' + (e && e.stack || e)); process.exit(1); });
