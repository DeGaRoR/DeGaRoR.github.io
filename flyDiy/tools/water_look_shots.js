#!/usr/bin/env node
// water_look_shots.js - WATER-LOOK's evidence rig (G2090-G2094): stills and a CDP screencast of the wet body's spray, wake,
// splash and bubbles, and of a floatplane's take-off, in the real page (headed Chrome on the box's GPU, vsync on).
// UNTIMED: the frames are pictures, not measurements - but it IS a browser run: take the GPU lock first
// (bash D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh take gpu WLOOK "<what>"), drop it after.
//
// SCENARIOS (--scenario):
//   float   a floatplane (--build: default the Cessna floats, bugReports/cessnaFloatsWOrks.json; --twin: the twin-582 on
//           floats, master_bench's patch) rolls out on the SEA lane and the pilot takes off; the eye rides abeam
//   ditch   a landplane (--build: default the user's Cub, builds/cub_2026-09-20_corrected.json) is placed (FLIGHT_PROBE.place,
//           the sim that flies - the worker's by default) 0.5 m over the SEA lane at --speed m/s (22) sinking --sink m/s
//           (1.5), nose along the lane, power off, by hand; a fixed eye abeam the touchdown watches it; --damage 1 = ?damage=1
//   sink    the ditch, then left in the water (TEST_FLIGHT.rate(2): 2x) --secs (60) for the flooding's bubbles, a close eye
// OUTPUT (--out <dir>): frames/NNNN.jpg (Page.startScreencast, every --every-th frame), stills still_<t>.jpg at --stills
// (seconds after the start, comma list), cast.webp (ImageMagick, 12 fps, 640 px wide) and index.json: per frame the sim
// time, the wet groups in contact (sim.wetFx), live particles, the slam's peak, the flood, the CG's depth, the page's errors.
//
//   node tools/water_look_shots.js --port 8655 --scenario ditch --out reports/evidence/WATER-LOOK/ditch_cub [--damage 1]
//   (--q 'simw=0' adds URL parameters; --udd a profile dir, default a fresh one under %TEMP%)
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const { spawn, execSync } = require('child_process');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const ROOT = path.join(__dirname, '..'), REPO = path.resolve(ROOT, '..');
const SCEN = opt('scenario', 'ditch'), PORT = +opt('port', 0), OUT = path.resolve(opt('out', path.join(ROOT, 'reports', 'evidence', 'WATER-LOOK', SCEN)));
const SIZE = [1280, 720], EVERY = +opt('every', 2);
const SECS = +opt('secs', SCEN === 'float' ? 40 : SCEN === 'sink' ? 60 : 8);
const STILLS = (opt('stills', SCEN === 'float' ? '8,14,20,26' : SCEN === 'sink' ? '5,20,40,58' : '0.3,0.6,1.0,1.6,3,6')).split(',').map(Number);
const TWIN = flag('twin');
const BUILD = opt('build', SCEN === 'float' ? (TWIN ? 'tools/fixtures/build_v7_ultralight_2026-09-05.json' : 'bugReports/cessnaFloatsWOrks.json') : 'builds/cub_2026-09-20_corrected.json');
const PATCH = TWIN ? j => { j.spec.gear.type = 'floats'; j.spec.cage = Object.assign({}, j.spec.cage, { gearFloats: 1 }); return j; } : null;
const Q = [opt('q', ''), opt('damage', null) != null ? 'damage=' + opt('damage') : ''].filter(Boolean).join('&');
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'].find(p => fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
const serveRoot = port => new Promise(res => { const rq = http.get('http://127.0.0.1:' + port + '/flyDiy/version.json', r => { r.resume(); res(r.headers['x-serve-root'] ? decodeURIComponent(r.headers['x-serve-root']) : '(unnamed)'); }); rq.on('error', () => res(null)); rq.setTimeout(1500, () => { rq.destroy(); res(null); }); });

function preScript() {
  const L = [];
  let txt = fs.readFileSync(path.join(ROOT, BUILD), 'utf8'); if (PATCH) txt = JSON.stringify(PATCH(JSON.parse(txt)));
  L.push('try{localStorage.setItem("flydiy.wip",' + JSON.stringify(txt) + ')}catch(e){}');
  L.push('try{localStorage.removeItem("flydiy.gfx")}catch(e){}');
  L.push('try{for(const k of Object.keys(localStorage))if(/^flydiy\\.(fl([A-Z]|$)|route$|world$)/.test(k))localStorage.removeItem(k)}catch(e){}');
  L.push('try{localStorage.setItem("flydiy.route",' + JSON.stringify(JSON.stringify({ from: 'HOME', dest: 'CIRCUIT' })) + ');localStorage.setItem("flydiy.flManual","0")}catch(e){}');
  return L.join('\n');
}

// the page side: the eye (a free camera set every frame), the per-frame record, the ditch's placement
const PAGE = `
window.__WL = { rec: [], eye: null, t0: null };
(function tick() {
  const W = window.__WL, F = window.FLIGHT_PROBE, s = F && F.sim && F.sim();
  if (s && s.cgPos && !document.body.classList.contains('mode-ws')) {
    const c = s.cgPos();
    if (W.eye && window.DEV_CAM) { const D = DEV_CAM, e = W.eye;
      // 'fixed': a still eye; 'ride': the offset kept from the CG (the eye moves with the aeroplane)
      const ex = e.mode === 'ride' ? c[0] + e.o[0] : e.p[0], ey = e.mode === 'ride' ? Math.max(e.yMin, c[1] + e.o[1]) : e.p[1], ez = e.mode === 'ride' ? c[2] + e.o[2] : e.p[2];
      D.pos.set(ex, ey, ez); const dx = c[0] - ex, dy = c[1] - ey, dz = c[2] - ez;
      D.yaw = Math.atan2(dx, -dz); D.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }
    if (W.t0 != null) {
      // (what the emitters read this frame - never sim.wetFx here: a read hands the slam peaks over, the splash's)
      const fx = window.WATER_FX && WATER_FX.fx, b = fx && fx.wet ? fx.wet.last : null, n = b ? b[0] : 0;
      let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, b[5 + i * 18 + 13]);
      const W2 = F.world(), wl = W2.waterH ? W2.waterH(c[0], c[2]) : NaN, v = s.cgVel();
      W.rec.push({ ms: Math.round(performance.now() - W.t0), t: +s.t.toFixed(3), wet: n, live: fx && fx.drops ? fx.drops.live : null, shown: fx && fx.pts ? !!fx.pts.visible : null, fxMs: fx && fx.ms != null ? +fx.ms.toFixed(3) : null,
        flood: s.out && s.out.wetFlood != null ? +s.out.wetFlood.toFixed(4) : null, drag: s.out && s.out.wetDrag != null ? Math.round(s.out.wetDrag) : null,
        depth: Number.isFinite(wl) ? +(wl - c[1]).toFixed(3) : null, gs: +Math.hypot(v[0], v[2]).toFixed(2), field: !!(window.WATER && WATER.field && WATER.field.on),
        phase: F.ap && F.ap() ? F.ap().phase : null });
      // the field's own height (the wave the surface draws: fine and coarse levels' max |h|, m), every 10th frame - a readback
      if (W.rec.length % 10 === 1 && window.WATER && WATER.fieldProbe && WATER.field.on && window.THREE) {
        const r0 = WATER.fieldProbe(F.renderer(), THREE, 0), r1 = WATER.fieldProbe(F.renderer(), THREE, 1);
        W.rec[W.rec.length - 1].fh = [r0 && r0.maxH != null ? +r0.maxH.toFixed(3) : null, r1 && r1.maxH != null ? +r1.maxH.toFixed(3) : null]; }
    }
  }
  requestAnimationFrame(tick);
})();
// the ditch: the CG put so the lowest node is 0.5 m over the lane, the nose along it, V forward and sink down; by hand, power off
window.__WL.ditch = async (V, sink) => {
  const F = FLIGHT_PROBE, s = F.sim(), W = F.world(), sea = W.aerodromes.find(a => a.id === 'SEA');
  const b = document.getElementById('bPause'); if (b && /pause/i.test(b.textContent)) b.click();
  s.ctl.thr = 0; F.setManual(true); s.ctl.thr = 0;
  const [xA] = s.axes(), hl = Math.hypot(xA[0], xA[2]), fx = -xA[0] / hl, fz = -xA[2] / hl;
  const c = s.cgPos(); let yMin = Infinity; for (let i = 0; i < s.n; i++) yMin = Math.min(yMin, s.p[i * 3 + 1]);
  const x = sea.spawn ? sea.spawn[0] : sea.x, z = sea.spawn ? sea.spawn[1] : sea.z, wl = W.waterH(x, z);
  const cg = await F.place({ at: [x, wl + 0.5 + (c[1] - yMin), z], zeroV: true, dv: [fx * V, -sink, fz * V] });
  return { cg, wl, fwd: [fx, fz], yMin: yMin - c[1] };
};
window.__WL.run = () => { const p = document.getElementById('bPause'); if (p && /run/i.test(p.textContent)) p.click(); return FLIGHT_PROBE.sim().t; };
`;

(async () => {
  if (!PORT) { console.error('water_look_shots: --port is required'); process.exit(2); }
  if (await serveRoot(PORT)) { console.error('water_look_shots: port ' + PORT + ' is taken'); process.exit(4); }
  fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
  for (const f of fs.readdirSync(path.join(OUT, 'frames'))) fs.unlinkSync(path.join(OUT, 'frames', f));
  const srv = spawn(process.execPath, [path.join(__dirname, '_serve.js'), String(PORT), REPO, '--fallback', 'D:/Dev/DeGaRoR.github.io'], { stdio: 'ignore' });
  await sleep(800);
  const root = await serveRoot(PORT);
  if (!root || path.resolve(root) !== path.resolve(REPO)) { console.error('serves ' + root + ', not ' + REPO); try { execSync('taskkill /PID ' + srv.pid + ' /T /F'); } catch (e) {} process.exit(4); }
  const udd = path.resolve(opt('udd', path.join(os.tmpdir(), 'wl' + Date.now())));
  const dport = 9700 + (process.pid % 200);
  const ch = spawn(CHROME, ['--remote-debugging-port=' + dport, '--window-size=' + (SIZE[0] + 16) + ',' + (SIZE[1] + 140), '--window-position=0,0', '--no-first-run',
    '--no-default-browser-check', '--user-data-dir=' + udd, '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', 'about:blank'], { stdio: 'ignore' });
  const kill = () => { for (const p of [ch, srv]) try { execSync('taskkill /PID ' + p.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} };
  process.on('exit', kill);
  let tgt = null;
  for (let i = 0; i < 50 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + dport + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0, casting = false, nFrame = 0, castT0 = 0; const waits = new Map(), exc = [], frames = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') exc.push((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text || '').split('\n').slice(0, 2).join(' | '));
    if (m.method === 'Page.screencastFrame') {
      ws.send(JSON.stringify({ id: ++id, method: 'Page.screencastFrameAck', params: { sessionId: m.params.sessionId } }));
      if (casting) { const f = String(++nFrame).padStart(4, '0') + '.jpg'; fs.writeFileSync(path.join(OUT, 'frames', f), Buffer.from(m.params.data, 'base64')); frames.push({ f, wall: Date.now() - castT0 }); } } };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (expr, ms) => { const p = cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    const r = await (ms ? Promise.race([p, sleep(ms).then(() => ({ result: { result: { value: '__timeout' } } }))]) : p);
    const d = r.result; if (!d || d.exceptionDetails) throw new Error('page: ' + (d && d.exceptionDetails ? (d.exceptionDetails.exception && d.exceptionDetails.exception.description || d.exceptionDetails.text) : JSON.stringify(r)));
    return d.result.value; };
  const shot = async name => { const r = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 82 }); fs.writeFileSync(path.join(OUT, name.replace(/.png$/, '.jpg')), Buffer.from(r.result.data, 'base64')); };
  const log = s => console.log('  ' + s);
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: SIZE[0], height: SIZE[1], deviceScaleFactor: 1, mobile: false });
  await cmd('Page.bringToFront');
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: preScript() });
  const url = 'http://localhost:' + PORT + '/flyDiy/index.html' + (Q ? '?' + Q : '');
  log('nav ' + url + ' (' + BUILD + (TWIN ? ', twin floats' : '') + ')');
  await cmd('Page.navigate', { url }); await sleep(1500);
  log('boot ' + await ev("(() => Promise.race([(window.BOOT && BOOT.whenReady) ? BOOT.whenReady().then(() => 'ready') : new Promise(r => setTimeout(() => r('no BOOT'), 30000)), new Promise(r => setTimeout(() => r('boot timeout'), 400000))]))()", 410000));
  await ev(PAGE);
  // roll out (one press), wait for the trip to end and the screen to go
  const n0 = await ev('(window.FLYDIY_TRIPS || []).length');
  await ev("(() => { const g = document.getElementById('bGo'); const l = [...document.querySelectorAll('button')].filter(b => /roll out/i.test(b.textContent) && b.offsetParent); const b = g && g.offsetParent && /roll out/i.test(g.textContent) ? g : l[0]; if (b) b.click(); return !!b; })()");
  for (let i = 0; i < 2400; i++) { const d = JSON.parse(await ev("JSON.stringify((() => { const L = window.FLYDIY_TRIPS || []; const t = L[L.length - 1]; return { n: L.length, done: !!(t && t.done), boot: window.BOOT ? BOOT.state : '' }; })())"));
    if (d.n > n0 && d.done && d.boot === 'gone') break; await sleep(250); }
  // (the roll-out's overlays: keep the build, CONTINUE ANYWAY)
  for (let i = 0; i < 8; i++) { await ev("(()=>{const l=[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build|continue anyway/i.test(b.textContent||'')&&b.children.length===0&&b.offsetParent);l.forEach(x=>x.click());return l.length;})()"); await sleep(300); }
  log('flying: ' + await ev('JSON.stringify({ t: FLIGHT_PROBE.sim().t, phase: FLIGHT_PROBE.ap().phase, physics: window.FLYDIY_SIMW ? (s => ({ phase: s.phase, dead: s.dead, flights: s.flights, inline: s.inline, flight: s.flight })) (FLYDIY_SIMW.state()) : null })'));
  await sleep(3000);
  await ev("FLIGHT_PROBE.camMode('free')");
  let info = null;
  if (SCEN === 'float') {
    // ride abeam: 22 m off the left, 8 m aft, 3.5 m up (never under 2 m over the water)
    await ev(`(() => { const s = FLIGHT_PROBE.sim(), [xA] = s.axes(), h = Math.hypot(xA[0], xA[2]), fx = -xA[0] / h, fz = -xA[2] / h, lx = fz, lz = -fx;
      const wl = FLIGHT_PROBE.world().waterH(s.cgPos()[0], s.cgPos()[2]);
      window.__WL.eye = { mode: 'ride', o: [lx * 22 - fx * 8, 3.5, lz * 22 - fz * 8], yMin: wl + 2 }; return 1; })()`);
    await ev('window.__WL.run()');
  } else {
    info = await ev(`window.__WL.ditch(${+opt('speed', 22)}, ${+opt('sink', 1.5)})`, 30000);
    log('placed ' + JSON.stringify(info));
    // a still eye abeam the touchdown: 20 m off its left, 12 m along the lane past the placement, 3 m over the water
    const fwd = info.fwd, l = [fwd[1], -fwd[0]], along = SCEN === 'sink' ? 18 : 12, off = SCEN === 'sink' ? 14 : 20;
    const ex = info.cg[0] + fwd[0] * along + l[0] * off, ez = info.cg[2] + fwd[1] * along + l[1] * off;
    // (the sinking: an eye that rides with the aeroplane as it drifts, HIGH - 14 m off its left, 6 m ahead, 8 m over the CG,
    // looking down past the wing at the water round the fuselage: at 3 m up and 10 m off the first take sat inside the wing)
    if (SCEN === 'sink') await ev(`(window.__WL.eye = { mode: 'ride', o: [${l[0] * 14 + fwd[0] * 6}, 8, ${l[1] * 14 + fwd[1] * 6}], yMin: ${info.wl + 6} }, 1)`);
    else await ev(`(window.__WL.eye = { mode: 'fixed', p: [${ex}, ${info.wl + 3}, ${ez}] }, 1)`);
    await sleep(600);
    await shot('still_placed.png');
    if (SCEN === 'sink') await ev('(window.TEST_FLIGHT && TEST_FLIGHT.rate) ? TEST_FLIGHT.rate(2) : 0');
  }
  // the cast and the stills
  await ev('(window.__WL.t0 = performance.now(), window.__WL.rec.length = 0, 1)');
  casting = true; castT0 = Date.now();
  await cmd('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: SIZE[0], maxHeight: SIZE[1], everyNthFrame: EVERY });
  if (SCEN !== 'float') await ev('window.__WL.run()');
  const t0 = Date.now(); let si = 0;
  while (Date.now() - t0 < SECS * 1000) {
    const el = (Date.now() - t0) / 1000;
    if (si < STILLS.length && el >= STILLS[si]) { await shot('still_' + String(STILLS[si]).replace('.', 'p') + 's.png'); si++; continue; }
    await sleep(40);
  }
  await cmd('Page.stopScreencast'); casting = false;
  const rec = JSON.parse(await ev('JSON.stringify(window.__WL.rec)'));
  const sum = { frames: rec.length, maxWet: Math.max(0, ...rec.map(r => r.wet)), maxLive: Math.max(0, ...rec.map(r => r.live || 0)), maxDepth: Math.max(-99, ...rec.map(r => r.depth == null ? -99 : r.depth)),
    fxMs: (() => { const a = rec.map(r => r.fxMs).filter(x => x > 0).sort((x, y) => x - y); return a.length ? { n: a.length, p50: a[a.length >> 1], p90: a[Math.floor(a.length * 0.9)], max: a[a.length - 1] } : null; })(),
    frameMs: (() => { const d = []; for (let i = 1; i < rec.length; i++) d.push(rec[i].ms - rec[i - 1].ms); d.sort((x, y) => x - y); return d.length ? { p50: d[d.length >> 1], p90: d[Math.floor(d.length * 0.9)], max: d[d.length - 1] } : null; })(),
    fieldMaxH: (() => { const f = rec.filter(r => r.fh); return f.length ? [Math.max(...f.map(r => r.fh[0] || 0)), Math.max(...f.map(r => r.fh[1] || 0))] : null; })(),
    floodEnd: rec.length ? rec[rec.length - 1].flood : null, firstWetMs: (rec.find(r => r.wet > 0) || {}).ms, fieldOnFrames: rec.filter(r => r.field).length, simT: rec.length ? [rec[0].t, rec[rec.length - 1].t] : null };
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ scenario: SCEN, build: BUILD, twin: TWIN, q: Q, url, placed: info, sum, frames, rec, exceptions: exc }, null, 1));
  log('frames ' + frames.length + ' cast, record ' + JSON.stringify(sum));
  log('exceptions ' + exc.length + (exc.length ? ': ' + exc.slice(0, 3).join(' || ') : ''));
  // the cast as an animated webp (12 fps of the cast frames, 960 px) - ImageMagick, when the box has it
  try {
    const step = Math.max(1, Math.round(frames.length / Math.max(1, SECS * 12)));
    const list = frames.filter((_, i) => i % step === 0).map(f => path.join(OUT, 'frames', f.f));
    fs.writeFileSync(path.join(OUT, 'frames.txt'), list.map(f => '"' + f.replace(/\\/g, '/') + '"').join('\n'));
    execSync('magick -delay ' + Math.round(100 / 12) + ' @"' + path.join(OUT, 'frames.txt').replace(/\\/g, '/') + '" -resize 640x -quality 55 -loop 0 "' + path.join(OUT, 'cast.webp').replace(/\\/g, '/') + '"', { stdio: 'ignore', timeout: 600000 });
    log('cast.webp ' + (fs.statSync(path.join(OUT, 'cast.webp')).size / 1048576).toFixed(1) + ' MB (' + list.length + ' frames)');
  } catch (e) { log('no webp: ' + e.message.split('\n')[0]); }
  try { await cmd('Browser.close'); } catch (e) {}
  await sleep(1000); kill(); process.exit(0);
})().catch(e => { console.error('water_look_shots: ' + (e && e.stack || e)); process.exit(1); });
