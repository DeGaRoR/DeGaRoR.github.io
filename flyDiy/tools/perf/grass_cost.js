#!/usr/bin/env node
// grass_cost.js - WHAT THE GRASS COSTS AND HOW IT LOOKS, VIEW BY VIEW (GRASS-DENSE G2560, 2026-10-08; the study's §6.1 step 0:
// futureDesigns/GRASS-STUDY-2026-10.md). One headed Chrome, the page at --size with ?gfx=<preset> (&day=<day>), rolled out to
// the HOME stand and paused; then per VIEW (the study's §6.2 stills: the stand, the taxi, the final at 10 / 30 / 60 / 150 m
// AGL, a paved runway's side, a plot lawn, a grass strip, a muskeg, a forest floor, a shore):
//   grass      every draw of the cover ring's tufts (userData.coverKind === 'cover': the grass and the flowers) counted -
//              draws, instances submitted, triangles submitted - and, with --gpu, each wrapped in its own TIME_ELAPSED query
//              and summed per frame: the grass's GPU ms alone (median of --frames frames)
//   frame      the flight recorder's GPU timer round the whole frame (median), with the grass queries off; fps, draws, Mtris
//   ring       the ring's own stat() (cells, instances held, queued)
//   a still    Page.captureScreenshot per view (<out>_<view>.png) - shot only once BOOT is 'gone', the ring idle and 2 s more
// The free views are placed by the page's own geometry (FLIGHT_PROBE.world(): HOME's runway, the cover's query, TREE_FILL.at),
// so the same view is the same frame on any tree that has the same world - the before and the after.
// Usage: node tools/perf/grass_cost.js --out reports/evidence/GRASS-DENSE/before_gamer [--preset gamer] [--day noon]
//          [--views stand,cockpit,taxi,app10,app30,app60,app150,rwyside,lot,lot20,gstrip,gstrip30,muskeg,forest,shore]
//          [--gpu] [--frames 90] [--size 1920x1080] [--sport 8595] [--dport 9495] [--udd C:/grc] [--warm] [--q ''] [--page dev.html]
//          [--noshots] [--root <checkout>] [--eval <file>]   (--eval: a page body run at the paused stand before the views)
// --gpu is a GPU MEASUREMENT: a TIMED window, boxlock.sh take gpu GRASS first, drop it after. Stills alone are untimed.
// Rigs have no --help.
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const ROOT = opt('root', null) ? path.resolve(opt('root')) : path.resolve(__dirname, '..', '..', '..');
const OUT = path.resolve(opt('out', 'grass_cost')).replace(/\.json$/, '');
const PRESET = opt('preset', 'gamer'), DAY = opt('day', 'noon'), Q = opt('q', ''), PAGE = opt('page', 'dev.html');
const SIZE = opt('size', '1920x1080').split('x').map(Number), FRAMES = +opt('frames', 90), GPU = flag('gpu');
const VIEWS = opt('views', 'stand,cockpit,taxi,app10,app30,app60,app150,rwyside,lot,lot20,gstrip,gstrip30,muskeg,forest,shore').split(',');
const SPORT = +opt('sport', 8595), DPORT = +opt('dport', 9495), UDD = opt('udd', 'C:/grc'), SHOTS = !flag('noshots');
const EVAL = opt('eval', null) ? fs.readFileSync(path.resolve(opt('eval')), 'utf8') : null;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
fs.mkdirSync(path.dirname(OUT), { recursive: true });
if (!flag('warm')) try { fs.rmSync(UDD, { recursive: true, force: true }); } catch (e) {}
const server = spawn(process.execPath, [path.join(__dirname, '..', '_serve.js'), String(SPORT), ROOT, '--fallback', 'D:/Dev/DeGaRoR.github.io'], { stdio: 'ignore' });
const ch = spawn(CHROME, ['--remote-debugging-port=' + DPORT, '--window-size=' + (SIZE[0] + 16) + ',' + (SIZE[1] + 140), '--window-position=0,0', '--no-first-run', '--no-default-browser-check',
  '--user-data-dir=' + UDD, '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  ...(GPU ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : []), 'about:blank'], { stdio: 'ignore' });
console.log('grass_cost: chrome pid ' + ch.pid + ', server pid ' + server.pid);
const kill = () => { for (const p of [ch, server]) try { execSync('taskkill /PID ' + p.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} };
process.on('exit', kill); process.on('SIGINT', () => process.exit(0)); process.on('SIGTERM', () => process.exit(0));

// ---- the page-side instrument (installed once after the roll-out) ----------------------------------------------------
const INSTRUMENT = `(() => {
  if (window.__GRC) return 'have';
  const FP = window.FLIGHT_PROBE, R = FP.renderer(), gl = R.getContext(), X = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const S = { count: false, time: false, frame: 0, pending: [], acc: [], draws: 0, inst: 0, tris: 0 };
  const rbd = R.renderBufferDirect;
  const isGrass = o => o && o.userData && o.userData.coverKind === 'cover';
  R.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
    if (!S.count || !isGrass(object)) return rbd.apply(this, arguments);
    const n = object.isInstancedMesh ? object.count : 1, idx = geometry && geometry.index ? geometry.index.count : (geometry && geometry.attributes.position ? geometry.attributes.position.count : 0);
    S.draws++; S.inst += n; S.tris += n * idx / 3;
    if (!S.time || !X) return rbd.apply(this, arguments);
    const q = gl.createQuery(); gl.beginQuery(X.TIME_ELAPSED_EXT, q);
    const r = rbd.apply(this, arguments);
    gl.endQuery(X.TIME_ELAPSED_EXT); S.pending.push({ q, f: S.frame });
    return r;
  };
  const poll = () => { const keep = [];
    for (const h of S.pending) { if (gl.getQueryParameter(h.q, gl.QUERY_RESULT_AVAILABLE)) {
      if (!gl.getParameter(X.GPU_DISJOINT_EXT)) S.acc[h.f] = (S.acc[h.f] || 0) + gl.getQueryParameter(h.q, gl.QUERY_RESULT) / 1e6; else S.acc[h.f] = NaN;
      gl.deleteQuery(h.q); } else keep.push(h); }
    S.pending = keep; };
  const med = a => { const b = a.filter(x => x === x).sort((x, y) => x - y); return b.length ? b[b.length >> 1] : null; };
  // n frames: the grass's draws / instances / triangles a frame, and with time its GPU ms (the recorder's frame timer off:
  // queries cannot nest)
  const grass = (n, time) => new Promise(res => {
    const REC = window.FLIGHT_REC; const tOn = time && REC && REC.gpuTimer ? REC.gpuTimer() : false; if (tOn) REC.gpuTimer(false);
    S.count = true; S.time = !!time && !!X; S.frame = 0; S.acc = []; S.draws = 0; S.inst = 0; S.tris = 0;
    const tick = () => { if (S.time) poll(); S.frame++; if (S.frame < n) return requestAnimationFrame(tick);
      S.count = false; const fr = S.frame; S.time = false; let k = 0; const dr = () => { poll(); if (S.pending.length && ++k < 60) return requestAnimationFrame(dr);
        if (tOn) REC.gpuTimer(true); const v = S.acc.slice(5);
        res({ grassMs: time ? med(v) : null, grassN: v.filter(x => x === x).length, gDraws: +(S.draws / fr).toFixed(1), gInstK: +(S.inst / fr / 1000).toFixed(1), gTrisM: +(S.tris / fr / 1e6).toFixed(3) }); };
      requestAnimationFrame(dr); };
    requestAnimationFrame(tick); });
  // the recorder's frames over ms milliseconds -> { frameGpuMs, fps, draws, mtris }
  const frame = async ms => { const REC = window.FLIGHT_REC && FLIGHT_REC.rec; if (!REC) return {};
    const f0 = REC.frame; await new Promise(r => setTimeout(r, ms)); const F = REC.F || {}, g = [], dt = [], calls = [], tris = [];
    for (let f = f0; f < REC.frame; f++) { const r = REC.row(f); if (!r || !(r.dt === r.dt)) continue; const fl = r.flags | 0; if ((F.away && (fl & F.away)) || (F.boot && (fl & F.boot))) continue;
      dt.push(r.dt); if (r.gpu === r.gpu) g.push(r.gpu); if (r.calls === r.calls) calls.push(r.calls); if (r.tris === r.tris) tris.push(r.tris); }
    const sum = dt.reduce((a, b) => a + b, 0);
    return { frameGpuMs: med(g), fps: sum ? +(1000 * dt.length / sum).toFixed(1) : null, draws: med(calls), mtris: tris.length ? +(med(tris) / 1e6).toFixed(2) : null }; };
  // the ring idle: nothing queued, no block left to rebuild, for 20 frames in a row (or 60 s)
  const idle = () => new Promise(res => { let ok = 0; const t0 = performance.now();
    const tick = () => { const cr = window.TREE_FILL && TREE_FILL.cover && TREE_FILL.cover(); const s = cr ? cr.stat() : null;
      const fl = TREE_FILL.grass && TREE_FILL.grass(), f = fl && fl.get().on ? fl.stat() : null;
      ok = s && !s.queued && !s.dirty && (!f || (!f.queued && !f.dirty && !f.tierUp)) ? ok + 1 : 0; if (ok >= 20 || performance.now() - t0 > 60000) return res(Math.round(performance.now() - t0)); requestAnimationFrame(tick); };
    requestAnimationFrame(tick); });
  const ring = () => { const cr = window.TREE_FILL && TREE_FILL.cover && TREE_FILL.cover(); if (!cr) return null; const s = cr.stat();
    const fl = TREE_FILL.grass && TREE_FILL.grass(), f = fl && fl.get().on ? fl.stat() : null;   // the grass field (G2563), when the tree has one and it is on
    return { live: s.live, instK: +(s.instances / 1000).toFixed(1), shown: s.shown, blocks: s.blocks, ringDraws: s.draws, agl: +(+s.agl).toFixed(1), aglK: +(+s.aglK).toFixed(3), mix: s.mixAt, grass: s.by && (s.by.grass_reed || 0), lawn: s.by && (s.by.lawn || 0),
      field: f ? { live: f.live, heldK: +(f.instances / 1000).toFixed(1), subK: +((f.submitted || 0) / 1000).toFixed(1), draws: f.draws, tierUp: f.tierUp || 0, lastMs: +(+f.lastMs).toFixed(2), maxMs: +(+f.maxMs).toFixed(2) } : null }; };
  window.__GRC = { grass, frame, idle, ring, S };
  return 'installed ' + (X ? 'timer' : 'NO TIMER');
})()`;

// THE FREE VIEWS: computed once in the page from the world itself. Every view is { eye: [x, y, z], yp: [yaw, pitch] } or null when
// the island has no such place near HOME (said so in the JSON). yaw / pitch as devCam reads them (fwd = sin yaw, -cos yaw).
const LOCS = `(() => {
  const wd = FLIGHT_PROBE.world(), A = wd.aerodromes.find(a => a.id === 'HOME') || wd.aerodromes[0], H = (x, z) => wd.terrainH(x, z);
  const look = (e, t) => { const f = [t[0] - e[0], t[1] - e[1], t[2] - e[2]], l = Math.hypot(f[0], f[1], f[2]); return [Math.atan2(f[0] / l, -f[2] / l), Math.asin(f[1] / l)]; };
  const out = { home: { x: A.x, z: A.z, hdg: A.hdg, len: A.len, wid: A.wid } };
  const dir = [Math.cos(A.hdg), Math.sin(A.hdg)], perp = [-dir[1], dir[0]];
  // THE FINAL (the jungle test): on HOME's extended centreline, the eye h m over the ground under it, at the distance a 3 deg path
  // puts it from the threshold, looking along the runway 6 deg down (4 at 10 m) - the same frames before and after
  const thr = [A.x - dir[0] * A.len / 2, A.z - dir[1] * A.len / 2];
  for (const h of [10, 30, 60, 150]) { const d = h / Math.tan(3 * Math.PI / 180), x = thr[0] - dir[0] * d, z = thr[1] - dir[1] * d;
    const yaw = Math.atan2(dir[0], -dir[1]); out['app' + h] = { eye: [x, H(x, z) + h, z], yp: [yaw, -(h <= 10 ? 4 : 6) * Math.PI / 180] }; }
  // THE PAVED RUNWAY'S SIDE: 8 m off HOME's edge, 15 % along it, 1.8 m up, looking 25 m along the edge
  { const s0 = A.len * 0.15, ex = A.x + dir[0] * s0 + perp[0] * A.wid / 2, ez = A.z + dir[1] * s0 + perp[1] * A.wid / 2;
    const eye = [ex + perp[0] * 8, H(ex + perp[0] * 8, ez + perp[1] * 8) + 1.8, ez + perp[1] * 8], tx = ex + dir[0] * 25, tz = ez + dir[1] * 25;
    out.rwyside = { eye, yp: look(eye, [tx, H(tx, tz), tz]) }; }
  // a ring search outward from HOME for the first point where test(x, z) holds (64 bearings a ring, 20 m rings)
  const find = (test, r0, r1) => { for (let r = r0 || 60; r <= (r1 || 4000); r += 20) for (let k = 0; k < 64; k++) { const a = k / 64 * 2 * Math.PI, x = A.x + Math.cos(a) * r, z = A.z + Math.sin(a) * r;
    try { if (test(x, z)) return [x, z]; } catch (e) {} } return null; };
  const cov = (x, z) => wd.coverAt ? wd.coverAt(x, z) : null;
  const at = (x, z) => window.TREE_FILL && TREE_FILL.at ? TREE_FILL.at(x, z) : null;
  const eyeAt = (p, back, hgt, bearing) => { const b = bearing === undefined ? Math.atan2(p[1] - A.z, p[0] - A.x) : bearing;   // the eye back m from p, toward HOME, looking at p
    const ex = p[0] - Math.cos(b) * back, ez = p[1] - Math.sin(b) * back, eye = [ex, H(ex, ez) + hgt, ez]; return { eye, yp: look(eye, [p[0], H(p[0], p[1]), p[1]]), at: p }; };
  // A PLOT LAWN (the cover's kind 'lawn') whose lawn runs a few metres: the eye 1.7 m and 20 m up, looking at it
  { const p = find((x, z) => { const c = cov(x, z); if (!c || c.kind !== 'lawn') return false; const c2 = cov(x + 4, z), c3 = cov(x, z + 4); return c2 && c2.kind === 'lawn' && c3 && c3.kind === 'lawn'; }, 60, 3000);
    out.lot = p ? eyeAt(p, 8, 1.7) : null; out.lot20 = p ? eyeAt(p, 25, 20) : null; }
  // A GRASS STRIP: the first aerodrome whose surface is grass (the premises' class, or the record's surface word)
  { const g = wd.aerodromes.filter(a => a !== A && a.len && a.wid && a.kind !== 'water' && (a.look === 'grass' || a.surface === 0)).sort((a, b) => Math.hypot(a.x - A.x, a.z - A.z) - Math.hypot(b.x - A.x, b.z - A.z))[0] || null;
    if (g) { const gd = [Math.cos(g.hdg), Math.sin(g.hdg)], t0 = [g.x - gd[0] * g.len * 0.35, g.z - gd[1] * g.len * 0.35], t1 = [g.x + gd[0] * 10, g.z + gd[1] * 10];
      const e0 = [t0[0], H(t0[0], t0[1]) + 1.7, t0[1]]; out.gstrip = { eye: e0, yp: look(e0, [t1[0], H(t1[0], t1[1]), t1[1]]), id: g.id };
      const th = [g.x - gd[0] * g.len / 2, g.z - gd[1] * g.len / 2], d = 30 / Math.tan(5 * Math.PI / 180), x = th[0] - gd[0] * d, z = th[1] - gd[1] * d;
      out.gstrip30 = { eye: [x, H(x, z) + 30, z], yp: [Math.atan2(gd[0], -gd[1]), -7 * Math.PI / 180], id: g.id }; } else { out.gstrip = out.gstrip30 = null; } }
  // THE BIOMES: a muskeg (3), a forest floor (8 / 13 under a canopy under 8 m: a stand's open edge), a shore (sand 4 / shingle 11) - by the code under the point
  { const p = find((x, z) => { const u = at(x, z); return u && u.code === 3 && wd.terrainH(x, z) > 1; }, 200); out.muskeg = p ? eyeAt(p, 15, 1.7) : null; }
  { const p = find((x, z) => { const u = at(x, z); return u && (u.code === 8 || u.code === 13) && u.canopy < 8 && u.slopeDeg < 12; }, 200); out.forest = p ? eyeAt(p, 10, 1.7) : null; }
  { const p = find((x, z) => { const u = at(x, z); return u && (u.code === 4 || u.code === 11); }, 200); out.shore = p ? eyeAt(p, 15, 1.7) : null; }
  return out;
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
  // a clean world look: no saved graphics, world, ground or day the user's browser could have left (a fresh profile anyway)
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: 'try{for(const k of Object.keys(localStorage)) if(/^flydiy\\.(fl([A-Z]|$)|route$|world$|gfx$|premises\\.game|diag|ground\\.splat|day)/.test(k)) localStorage.removeItem(k);}catch(e){}' });
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: require('../_stock_pin.js').pinScript() });
  await cmd('Emulation.setDeviceMetricsOverride', { width: SIZE[0], height: SIZE[1], deviceScaleFactor: 1, mobile: false });
  await cmd('Page.bringToFront');
  const url = 'http://localhost:' + SPORT + '/flyDiy/' + PAGE + '?gfx=' + PRESET + (DAY ? '&day=' + DAY : '') + (Q ? '&' + Q : '');
  const T0 = Date.now(), el = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
  await cmd('Page.navigate', { url });
  console.log('grass_cost ' + url + (GPU ? '  (GPU TIMED)' : '  (stills / counts, untimed)'));
  const KEEP = "(()=>{const l=[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0&&b.offsetParent);l.forEach(x=>x.click());return l.length;})()";
  const inShed = "!!(document.body && document.body.classList.contains('mode-ws'))";
  const quiet = "(()=>{const b=window.BOOT;return !b||(b.state==='gone'&&!(typeof b.busy==='function'&&b.busy()));})()";
  for (let i = 0; i < 900; i++) { await sleep(1000); try { await ev(KEEP); if (await ev('!!(window.FLIGHT_PROBE && window.GFX && window.BOOT) && ' + inShed + ' && ' + quiet)) break; } catch (e) {} }
  console.log('  shed up ' + el() + ' · gfx ' + await ev('GFX.get().preset'));
  await ev("(()=>{const g=document.getElementById('bGo'); if (g) g.click(); if (GFX.hw && GFX.hw.hold) GFX.hw.hold(true); return 1;})()");
  for (let i = 0; i < 600; i++) { await sleep(1000); try { if (await ev('!' + inShed + ' && ' + quiet)) break; } catch (e) {} }
  await sleep(4000);   // the overlay gone + 2 s at the least (the stills rule), the reveal over
  console.log('  rolled out ' + el() + ' · ' + await ev(INSTRUMENT) + ' · ' + await ev("(()=>{const g=FLIGHT_PROBE.renderer().getContext(),d=g.getExtension('WEBGL_debug_renderer_info');return d?g.getParameter(d.UNMASKED_RENDERER_WEBGL):'?';})()"));
  const pause = "(()=>{ const b=document.getElementById('bPause'); if (b && !b.hidden && b.textContent.trim().toLowerCase() === 'pause') b.click(); return b ? b.textContent : '?'; })()";
  for (let i = 0; i < 120; i++) { const t = String(await ev(pause)).trim().toLowerCase(); if (t && t !== 'pause' && t !== '?') break; await sleep(500); }
  await sleep(1500);
  if (GPU) await ev("(()=>{ GFX.set('fps', 'off'); return GFX.get().fps; })()");   // uncapped while timed (ground_cost's lesson: a capped GPU drops its clocks)
  console.log('  held: ' + await ev("document.getElementById('bPause').textContent") + ' · FLYDIY_HELD ' + await ev('!!window.FLYDIY_HELD') + ' · cover ' + JSON.stringify(await ev('(()=>{const c=TREE_FILL.cover(); return c ? c.get() : null;})()')));
  const evalStand = EVAL ? await ev('(async () => {' + EVAL + '})()') : null;
  if (EVAL) console.log('  eval: ' + JSON.stringify(evalStand).slice(0, 400));
  await ev("(async()=>{const FP=FLIGHT_PROBE; if (FP.camModeNow && FP.camModeNow()!=='orbit') FP.camMode('orbit'); await new Promise(r=>setTimeout(r,500)); FP.camSettle(); return 1;})()");
  const cam0 = await ev('FLIGHT_PROBE.cam()');
  const locs = await ev(LOCS);
  console.log('  locs: ' + Object.keys(locs).filter(k => k !== 'home').map(k => k + (locs[k] ? '' : '(none)')).join(' '));
  const VIEW = {
    stand: { orbit: [cam0.azT, cam0.elT, cam0.distT] },
    taxi: { orbit: [cam0.azT, 0.06, 7] },
    cockpit: { mode: 'cockpit' },
  };
  for (const k of Object.keys(locs)) if (k !== 'home') VIEW[k] = locs[k] ? { free: locs[k] } : null;
  const place = async v => {
    const V = VIEW[v]; if (!V) return false;
    await ev(pause);
    if (V.orbit) await ev(`(()=>{const FP=FLIGHT_PROBE; if (FP.camModeNow()!=='orbit') FP.camMode('orbit'); FP.camSet(${V.orbit.join(',')}); return 1;})()`);
    else if (V.mode) await ev(`(()=>{const FP=FLIGHT_PROBE; if (FP.camModeNow()!=='${V.mode}') FP.camMode('${V.mode}'); return FP.camModeNow();})()`);
    else await ev(`FLIGHT_PROBE.devFree(${V.free.eye.join(',')}, ${V.free.yp.join(',')})`);
    return true;
  };
  const rows = [];
  for (const v of VIEWS) {
    if (!(v in VIEW)) { console.log('  ' + v + ': no such view'); continue; }
    if (!await place(v)) { rows.push({ view: v, missing: true }); console.log('  ' + v + ': no such place near HOME'); continue; }
    await sleep(1500);
    const idleMs = await ev('__GRC.idle()');
    await sleep(2000);
    if (VIEW[v].free) await ev(`FLIGHT_PROBE.devFree(${VIEW[v].free.eye.join(',')}, ${VIEW[v].free.yp.join(',')})`);   // (the free eye drifts with nothing; re-set anyway)
    const fr = await ev('__GRC.frame(2000)');
    const gr = await ev('__GRC.grass(' + FRAMES + ',' + (GPU ? 'true' : 'false') + ')');
    const rg = await ev('__GRC.ring()');
    const boot = await ev("(()=>{const b=window.BOOT; return b ? b.state : 'none';})()");
    const row = Object.assign({ view: v, idleMs, boot, where: VIEW[v].free ? VIEW[v].free : VIEW[v] }, fr, gr, { ring: rg });
    rows.push(row);
    console.log('  ' + el() + '  ' + v.padEnd(9) + (GPU ? 'grass ' + String(row.grassMs).padStart(6) + ' ms  frame ' + String(row.frameGpuMs).padStart(6) + ' ms  ' : '') +
      (row.fps ? row.fps.toFixed(0) : '-') + ' fps  grass ' + row.gDraws + ' draws ' + row.gInstK + ' k inst ' + row.gTrisM + ' Mtris  · ring ' + (rg ? rg.instK + ' k held, agl ' + rg.agl + ' ' + rg.mix : '-') + '  (idle ' + idleMs + ' ms)');
    if (SHOTS) {
      if (boot !== 'gone') console.log('  ' + v + ': BOOT is ' + boot + ' - still DISCARDED (the overlay rule)');
      else { const s = await cmd('Page.captureScreenshot', { format: 'png' }); if (s.result) fs.writeFileSync(OUT + '_' + v + '.png', Buffer.from(s.result.data, 'base64')); }
    }
    fs.writeFileSync(OUT + '.json', JSON.stringify({ url, preset: PRESET, day: DAY, size: SIZE, frames: FRAMES, gpu: GPU, at: new Date().toISOString(), locs, evalStand, rows, errs }, null, 1));
  }
  console.log('-> ' + OUT + '.json');
  if (errs.length) console.log('page errors: ' + errs.slice(0, 6).join(' | '));
  try { await cmd('Browser.close'); } catch (e) {}
  await sleep(1500);
  process.exit(0);
})().catch(e => { console.error('grass_cost: ' + (e && e.stack || e)); process.exit(1); });
