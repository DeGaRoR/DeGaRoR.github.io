#!/usr/bin/env node
// garage_fps.js - GARAGE-LAPTOP (G2073): THE SHED'S FRAME ON A WEAK RUNG, ITS CACHES A/B, AND THE PICTURE'S IDENTITY.
//
// One headed Chrome, its own profile, the page at the laptop's 1920 x 1080 on ?gfx=<preset>, the laptop's aeroplane (the
// Jodel) in the WIP slot. The garage loads at the box's own speed; then:
//   IDENTITY (--identity): in ONE task (no clock moves between them) the shed is rendered into a target three ways - the
//     shadow cache alone (SHED_SHADOW.pre with the glass skip off), the cache and the glass skip, and the full pass (no pre:
//     every caster casts, the transmission pass draws everything) - and the pixels compared: count, max channel diff. At
//     rest, then on the frame a prop moved (the cache re-bakes inside that render), then a lamp moved. Stills of the canvas
//     each way (--shots).
//   THE RUNG: CDP's CPU throttle (--cpu-throttle N, the page's main thread N x slower) and HW-COVERAGE's GPU proxy (G1998,
//     --gpux K: every opaque draw issued K times as one instanced call - K x the GPU's work, no extra CPU) - both applied
//     AFTER the load, so a rung costs no minutes of loading.
//   TIMED A/B (ABCCBA): 'off' (the full pass: SHED_SHADOW.S.on and .G.on false - the train before), 'shadow' (the cache),
//     'both' (the cache + the glass skip); each window: switch, 3 s to settle, --secs of frames read off the flight
//     recorder (the laptop log's own columns: dt, work, render, shadow, gpu, calls, tris), the camera still or (--orbit)
//     turning 6 deg a second.
// Usage: node tools/perf/garage_fps.js --out <json> [--q 'gfx=retro'] [--build builds/jodel_2026-09-20_corrected.json]
//          [--size 1920x1080] [--cpu-throttle N] [--gpux K] [--secs 12] [--orbit] [--identity] [--shots <dir>] [--no-ab]
//          [--sport 8581] [--dport 9481] [--udd C:/gfps]
// A GPU MEASUREMENT: take tools/perf/boxlock.sh take gpu <WHO> first, drop it after. Rigs have no --help.
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const ROOT = path.resolve(__dirname, '..', '..', '..');
const OUT = path.resolve(opt('out', 'garage_fps.json'));
const Q = opt('q', 'gfx=retro'), SIZE = opt('size', '1920x1080').split('x').map(Number);
const BUILD = opt('build', 'builds/jodel_2026-09-20_corrected.json'), SECS = +opt('secs', 12);
const THROTTLE = +opt('cpu-throttle', 0) || 0, GPUX = +opt('gpux', 0) || 0, SHOTS = opt('shots', null);
const GPUX_ON = GPUX > 1 || argv.includes('--calibrate');   // the proxy injected (live K) when asked or calibrating
const SPORT = +opt('sport', 8581), DPORT = +opt('dport', 9481), UDD = opt('udd', 'C:/gfps');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
if (!flag('warm')) try { fs.rmSync(UDD, { recursive: true, force: true }); } catch (e) {}   // --warm: the profile (its program cache) kept from the run before
const server = spawn(process.execPath, [path.join(ROOT, 'flyDiy/tools/_serve.js'), String(SPORT), ROOT, '--fallback', 'D:/Dev/DeGaRoR.github.io'], { stdio: 'ignore' });
const ch = spawn(CHROME, ['--remote-debugging-port=' + DPORT, '--window-size=' + (SIZE[0] + 16) + ',' + (SIZE[1] + 140), '--window-position=0,0', '--no-first-run', '--no-default-browser-check',
  '--user-data-dir=' + UDD, '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', 'about:blank'], { stdio: 'ignore' });
const kill = () => { for (const p of [ch, server]) try { execSync('taskkill /PID ' + p.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} };
process.on('exit', kill); process.on('SIGINT', () => process.exit(0)); process.on('SIGTERM', () => process.exit(0));

// HW-COVERAGE's GPU proxy (G1998, tools/rollout_perf.js --gpux), the same injection: K x the GPU's work per opaque draw
const GPUX_SRC = `(function(){ if (window.__GPUXH || typeof WebGL2RenderingContext === 'undefined') return; window.__GPUXH = 1; window.__GPUX = 1;
  var P = WebGL2RenderingContext.prototype, BL = 0x0BE2, en = P.enable, dis = P.disable, de = P.drawElements, da = P.drawArrays, dei = P.drawElementsInstanced, dai = P.drawArraysInstanced, dre = P.drawRangeElements;
  P.enable = function (c) { if (c === BL) this.__bl = true; return en.call(this, c); };
  P.disable = function (c) { if (c === BL) this.__bl = false; return dis.call(this, c); };
  P.drawElements = function (m, c, t, o) { var k = window.__GPUX | 0; return k > 1 && !this.__bl ? dei.call(this, m, c, t, o, k) : de.call(this, m, c, t, o); };
  P.drawRangeElements = function (m, a, b, c, t, o) { var k = window.__GPUX | 0; return k > 1 && !this.__bl ? dei.call(this, m, c, t, o, k) : dre.call(this, m, a, b, c, t, o); };
  P.drawArrays = function (m, f, c) { var k = window.__GPUX | 0; return k > 1 && !this.__bl ? dai.call(this, m, f, c, k) : da.call(this, m, f, c); };
  P.drawElementsInstanced = function (m, c, t, o, n) { var k = window.__GPUX | 0; if (k > 1 && !this.__bl) for (var i = 1; i < k; i++) dei.call(this, m, c, t, o, n); return dei.call(this, m, c, t, o, n); };
  P.drawArraysInstanced = function (m, f, c, n) { var k = window.__GPUX | 0; if (k > 1 && !this.__bl) for (var i = 1; i < k; i++) dai.call(this, m, f, c, n); return dai.call(this, m, f, c, n); };
})();`;

// the three-way render of the shed into a target, in one task: { shadow: diff vs full, both: diff vs full }
const IDENTITY = `
  const FP = FLIGHT_PROBE, R = FP.renderer(), SC = FP.hangarScene(), cam = FP.camera(), SS = SHED_SHADOW, TH = THREE;
  const w = 960, h = 540, rt = new TH.WebGLRenderTarget(w, h, { samples: 0 }); const px = () => { const b = new Uint8Array(w * h * 4); R.readRenderTargetPixels(rt, 0, 0, w, h, b); return b; };
  const room = window.__GF_ROOM || null;
  const draw = mode => { const prevT = R.getRenderTarget(); R.setRenderTarget(rt); R.clear();
    let on = false; if (mode !== 'full') { const g0 = SS.G.on; SS.G.on = mode === 'both'; on = SS.pre(R, SC, cam, room); SS.G.on = g0; }
    try { R.render(SC, cam); } finally { if (on) SS.post(); R.setRenderTarget(prevT); } return px(); };
  const cmp = (a, b) => { let n = 0, mx = 0; for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); if (d) { n++; if (d > mx) mx = d; } } return { px: Math.round(n / 4 * 10) / 10, max: mx }; };
  // the cache warm first (its own frames), then the three renders back to back
  for (let i = 0; i < 4; i++) draw('shadow');
  const st0 = SS.stat();
  const A = draw('shadow'), B = draw('both'), F = draw('full'), F2 = draw('full');
  // noise: two full passes back to back (a material that reads the clock in its own hooks would show here)
  const out = { stat: { bakes: st0.bakes, baked: st0.baked, live: st0.live }, shadow: cmp(A, F), both: cmp(B, F), noise: cmp(F, F2), glass: SS.glassStat(), pixels: w * h };
  rt.dispose(); return out;`;

(async () => {
  let tgt = null;
  for (let i = 0; i < 60 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + DPORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map(); const errs = [];
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).slice(0, 300)); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const run = async body => { const r = await cmd('Runtime.evaluate', { expression: '(async()=>{ ' + body + '\n })()', awaitPromise: true, returnByValue: true }); const d = r.result;
    if (!d || d.exceptionDetails) return 'ERR ' + (d && d.exceptionDetails ? (d.exceptionDetails.exception && d.exceptionDetails.exception.description || d.exceptionDetails.text) : JSON.stringify(r)); return d.result.value; };
  const until = async (cond, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await run('return !!(' + cond + ');')) === true) return Date.now() - t0; await sleep(500); } throw new Error('timed out: ' + what); };
  const shot = async name => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); const r = await cmd('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.result.data, 'base64')); };
  const pre = ['try{for(const k of Object.keys(localStorage)) if(/^flydiy\\.(fl([A-Z]|$)|route$|world$|gfx$|premises\\.game)/.test(k)) localStorage.removeItem(k);}catch(e){}',
    'try{localStorage.setItem("flydiy.wip",' + JSON.stringify(fs.readFileSync(path.resolve(ROOT, 'flyDiy', BUILD), 'utf8')) + ')}catch(e){}'];
  if (GPUX_ON) pre.push(GPUX_SRC);
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: pre.join('\n') });
  await cmd('Emulation.setDeviceMetricsOverride', { width: SIZE[0], height: SIZE[1], deviceScaleFactor: 1, mobile: false });
  await cmd('Page.bringToFront');
  const url = 'http://localhost:' + SPORT + '/flyDiy/index.html' + (Q ? '?' + Q : '');
  const T0 = Date.now();
  await cmd('Page.navigate', { url });
  console.log('nav ' + url);
  const res = { url, size: SIZE, q: Q, build: BUILD, throttle: THROTTLE, gpux: GPUX, secs: SECS, orbit: flag('orbit'), errs };
  const save = () => fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
  await until(`window.BOOT && BOOT.state === 'gone' && window.FLIGHT_PROBE && window.SHED_SHADOW`, 900000, 'the garage boot');
  res.load = (Date.now() - T0) / 1000; console.log('garage up in ' + res.load.toFixed(1) + ' s');
  await run(`for (const b of document.querySelectorAll('button, [role=button], div, span')) { if (/^\\s*keep the current build\\s*$/i.test(b.textContent || '') && b.offsetParent) { b.click(); break; } } return 1;`);
  // the room the app hands the glass skip (hangar.js: { group, dims }), through the console's door
  await run(`window.__GF_ROOM = window.GARAGE_ENV && GARAGE_ENV._debug ? GARAGE_ENV._debug().hangar : null; return 1;`);
  await sleep(8000);
  res.gfx = await run('return GFX.get();');
  if (flag('identity')) {
    res.identity = { rest: await run(IDENTITY) }; console.log('IDENTITY at rest ' + JSON.stringify(res.identity.rest));
    res.identity.moved = await run(`let p = null; FLIGHT_PROBE.hangarScene().traverse(o => { if (!p && /^prop:(crate|drum|stool|jerrycan)/.test(o.name || '')) p = o; }); if (p) { p.position.x += 0.3; p.updateMatrix(); }
      ` + IDENTITY.replace('for (let i = 0; i < 4; i++) draw(\'shadow\');', ''));
    console.log('IDENTITY a prop moved ' + JSON.stringify(res.identity.moved));
    res.identity.lamp = await run(`let L = null; FLIGHT_PROBE.hangarScene().traverse(o => { if (!L && o.isSpotLight && o.castShadow) L = o; }); if (L) L.position.y += 0.05;
      ` + IDENTITY.replace('for (let i = 0; i < 4; i++) draw(\'shadow\');', ''));
    console.log('IDENTITY a lamp moved ' + JSON.stringify(res.identity.lamp));
    save();
    for (const [k, js] of [['off', 'SHED_SHADOW.S.on = false; SHED_SHADOW.G.on = false;'], ['both', 'SHED_SHADOW.S.on = true; SHED_SHADOW.G.on = true;']]) { await run(js + ' return 1;'); await sleep(2500); await shot('garage_' + k); }
  }
  const MODES0 = { off: 'SHED_SHADOW.S.on = false; SHED_SHADOW.G.on = false;', shadow: 'SHED_SHADOW.S.on = true; SHED_SHADOW.G.on = false;', both: 'SHED_SHADOW.S.on = true; SHED_SHADOW.G.on = true;' };
  const WIN0 = secs => `const R = FLIGHT_REC.rec; const f0 = R.frame; await new Promise(r => setTimeout(r, ${secs * 1000})); const f1 = R.frame;
    const rows = []; for (let f = f0; f < f1; f++) { const o = R.row(f); if (o && o.dt === o.dt) rows.push(o); }
    const q = (k, p) => { const a = rows.map(o => o[k]).filter(x => x === x).sort((x, y) => x - y); return a.length ? +a[Math.min(a.length - 1, Math.floor(p * a.length))].toFixed(2) : null; };
    const wall = rows.reduce((s, o) => s + o.dt, 0);
    return { frames: rows.length, fps: +(1000 * rows.length / Math.max(1, wall)).toFixed(1), dt50: q('dt', .5), dt90: q('dt', .9), dt99: q('dt', .99), slow: rows.filter(o => o.dt > 50).length,
      work50: q('work', .5), render50: q('render', .5), shadow50: q('shadow', .5), gpu50: q('gpu', .5), gpu90: q('gpu', .9), calls: q('calls', .5), mtris: +(q('tris', .5) / 1e6).toFixed(2),
      cache: SHED_SHADOW.stat(), glass: SHED_SHADOW.glassStat() };`;
  const MODES = MODES0, WIN = WIN0;
  // --lampstill: the shed with and without the lamps' own shadows (retro's question for the user: BUDGETS shedLamps false),
  // the camera still, 4 s for the programs to re-link and the light to settle, a still each way
  if (flag('lampstill')) {
    // (the glass skip by pane re-proved first, at rest: the same-task identity)
    res.identityPane = await run(IDENTITY); console.log('IDENTITY (by pane) at rest ' + JSON.stringify(res.identityPane)); save();
    await run('SHED_SHADOW.S.on = true; SHED_SHADOW.G.on = true; return 1;'); await sleep(3000); await shot('lamps_shadow_on');
    await run(`FLIGHT_PROBE.hangarScene().traverse(o => { if (o.isSpotLight && o.castShadow) { o.castShadow = false; o.userData.__gfCast = 1; } }); return 1;`);
    await sleep(4000); await shot('lamps_shadow_off');
    await run(`FLIGHT_PROBE.hangarScene().traverse(o => { if (o.userData && o.userData.__gfCast) { o.castShadow = true; delete o.userData.__gfCast; } }); return 1;`);
    await sleep(4000); await shot('lamps_shadow_on_again');
  }
  let N = THROTTLE, K = GPUX;
  const setRung = async () => { await cmd('Emulation.setCPUThrottlingRate', { rate: Math.max(1, N) }); if (GPUX_ON) await run('window.__GPUX = ' + Math.max(1, K) + '; return 1;'); };
  // --calibrate: THE RUNG FITTED LIVE ON THE BEFORE (HW-COVERAGE's advice): the caches off, the box's loop JS and GPU read at
  // rate 1 / K 1, N = cpu-target / work, K = gpu-target / gpu, read again, adjusted once, then held for the A/B
  if (flag('calibrate')) {
    const CT = +opt('cpu-target', 90), GT = +opt('gpu-target', 105); res.calib = [];   // the laptop's retro shed: cpu 85-103 ms (mean work), GPU 100-122 ms res.calib = [];
    await run(MODES0.off + ' return 1;'); N = 1; K = 1; await setRung(); await sleep(3000);
    let m = await run(WIN0(6)); res.calib.push({ N, K, work: m.work50, gpu: m.gpu50, dt: m.dt50 }); console.log('  calib N1 K1: work ' + m.work50 + ' ms, gpu ' + m.gpu50 + ' ms, dt ' + m.dt50);
    for (let it = 0; it < 2; it++) {
      N = Math.max(1, Math.round(10 * N * CT / Math.max(0.5, m.work50)) / 10); if (GPUX_ON) K = Math.max(1, Math.round(K * GT / Math.max(0.5, m.gpu50)));
      await setRung(); await sleep(3000); m = await run(WIN0(6));
      res.calib.push({ N, K, work: m.work50, gpu: m.gpu50, dt: m.dt50 }); console.log('  calib N' + N + ' K' + K + ': work ' + m.work50 + ' ms, gpu ' + m.gpu50 + ' ms, dt ' + m.dt50);
    }
    save();
  } else if (N > 1 || K > 1) await setRung();
  res.rung = { N, K }; console.log('(the rung: CPU ' + N + 'x, GPU proxy ' + K + 'x)');
  await sleep(3000);
  if (flag('orbit')) await run(`if (!window.__GF_ORB) { let last = performance.now(); window.__GF_ORB = setInterval(() => { const n = performance.now(), c = FLIGHT_PROBE.cam(); FLIGHT_PROBE.camSet(c.az + 0.1047 * (n - last) / 1000, c.el, c.dist); last = n; }, 30); } return 1;`);
  if (!flag('no-ab')) {
    res.ab = [];
    for (const m of ['off', 'both', 'shadow', 'shadow', 'both', 'off']) {
      await run(MODES[m] + ' return 1;'); await sleep(3000);
      const r = await run(WIN(SECS)); r.mode = m; res.ab.push(r); save();
      console.log('  ' + m.padEnd(6) + ' ' + JSON.stringify(Object.assign({}, r, { cache: { bakes: r.cache && r.cache.bakes, lightBakes: r.cache && r.cache.lightBakes, baked: r.cache && r.cache.baked, live: r.cache && r.cache.live }, glass: r.glass && { why: r.glass.why, skipped: r.glass.skipped, drawn: r.glass.drawn } })));
    }
    const by = {}; for (const r of res.ab) (by[r.mode] = by[r.mode] || []).push(r);
    const avg = (a, k) => +(a.reduce((s, r) => s + (r[k] || 0), 0) / a.length).toFixed(2);
    res.summary = Object.fromEntries(Object.entries(by).map(([k, a]) => [k, { fps: avg(a, 'fps'), dt50: avg(a, 'dt50'), dt90: avg(a, 'dt90'), work50: avg(a, 'work50'), render50: avg(a, 'render50'), gpu50: avg(a, 'gpu50'), calls: avg(a, 'calls'), mtris: avg(a, 'mtris'), slow: avg(a, 'slow') }]));
    console.log('GARAGE_FPS ' + JSON.stringify(res.summary));
  }
  res.wall = (Date.now() - T0) / 1000; save();
  try { await cmd('Browser.close'); } catch (e) {}
  await sleep(500);
  process.exit(0);
})().catch(e => { console.log('FATAL ' + e.stack); process.exit(1); });
