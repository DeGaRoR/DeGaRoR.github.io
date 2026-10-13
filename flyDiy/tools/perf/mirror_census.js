#!/usr/bin/env node
// mirror_census.js - THE WATER'S LIVE MIRROR, COUNTED AND FLOWN (WATER-STEADY G2830-G2839)
//
// The user (10 Oct): "the water model switching from simple to reflective is really annoying ... do an optimization
// session on the reflective shader, to allow it safely over 30 fps on my machine, then turn it on for game and ultra".
// This rig answers the two halves on the box's GPU, headless Chrome, the game rolled out and PAUSED, the free eye:
//   1. THE COST: at each view, N frames with the mirror 'off' and N with it 'live' - the frame's median and p90 (rAF
//      intervals, uncapped), the capture's CPU ms (WATER.mirror.ms), its scene draws, how many frames it was skipped
//      (THE WATER SEEN). --census adds, on the 'live' run, the capture's draws by the scene's top-level object and by
//      material (renderer.renderBufferDirect hooked while WATER.mirror.capturing - a branch build; master has no flag).
//   2. THE SWITCH: two flights of the free eye - across the east shore at 30 m (sea -> land -> sea) and a climb from
//      20 m to 1500 m over the sea - reading the mirror's weight (uWMirror4.x) and plane (.w) every frame. A branch build
//      must hold the weight at 1 and the plane still all the way; master drops the weight to 0 over the land (mirrorOff).
//
//   node tools/perf/mirror_census.js [--url http://localhost:8480/flyDiy/dev.html?world=jolene&gfx=gamer] [--label branch]
//        [--frames 120] [--views sea12,sea40,sea300,lake,inland,sky] [--census] [--flights] [--skip '<js -> array of objects>']
//        [--size 1920x1080] [--out tools/perf/mirror_census_<label>.json] [--headed]
// A MEASUREMENT for a booked box window (boxlock.sh take gpu first), not a gate. No screenshots are taken.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL = opt('url', 'http://localhost:8480/flyDiy/dev.html?world=jolene&gfx=gamer');
const LABEL = opt('label', 'run');
const FRAMES = +opt('frames', 120);
const VIEWS = opt('views', 'sealow,sea12,sea40,sea300,lake,inland,sky').split(',').filter(Boolean);
const CENSUS = argv.includes('--census'), FLIGHTS = argv.includes('--flights'), HEADED = argv.includes('--headed');
const SKIP = opt('skip', null);
const SIZE = opt('size', '1920x1080').split('x').map(Number);
const OUT = opt('out', path.join(__dirname, 'mirror_census_' + LABEL + '.json'));

// the eyes (DEV_CAM: yaw 0 = -z, 90 = +x; Jolene's east coast is at x ~ 2640 on z = 0, the sea east of it)
const EYES = {
  sea12:  { pos: [2600, 12, 0],   yaw: 270, pitch: -4 },    // AT the coast line looking inland (G2830 census: its frame drew no water - skipped 120/120)
  sealow: { pos: [2950, 12, 0],   yaw: 270, pitch: -3 },    // 12 m over the open sea, ~300 m of water to the shore and its trees: the classic reflection
  sea40:  { pos: [2800, 40, 0],   yaw: 270, pitch: -10 },
  sea300: { pos: [3000, 300, 0],  yaw: 270, pitch: -25 },   // the island ahead from the air
  lake:   { pos: [-604, 120, -1150], yaw: 0, pitch: -40 },  // an inland lake (water_shot's)
  inland: { pos: [0, 0, 0], yaw: 180, pitch: -15, inland: true },  // over the densest forest, 110 m up (frame_perf's rule)
  sky:    { pos: [0, 0, 0], yaw: 180, pitch: 35, inland: true },   // the same place looking up: no water in the frame
};

const PORT = 9400 + (process.pid % 500);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('mirror_census: no Chrome'); process.exit(2); }
const udd = path.join(require('os').tmpdir(), 'cdp_mir_' + PORT + '_' + Date.now());
const ch = spawn(CHROME, (HEADED ? [] : ['--headless=new']).concat(['--remote-debugging-port=' + PORT, '--window-size=' + SIZE[0] + ',' + SIZE[1],
  '--hide-scrollbars', '--no-first-run', '--user-data-dir=' + udd, '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync', 'about:blank']), { stdio: 'ignore' });
const killChrome = () => { try { if (process.platform === 'win32') require('child_process').execSync('taskkill /PID ' + ch.pid + ' /T /F', { stdio: 'ignore' }); else ch.kill(); } catch (e) {} };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });

// ---- the page-side instrument --------------------------------------------------------------------------------
const INSTRUMENT = `(() => {
  if (window.__MC) return 'have';
  const R = WORLD.renderer || window.FLYDIY_RENDERER, M = WATER.mirror, scene = WORLD.scene;
  const S = { census: false, byTop: new Map(), byMat: new Map(), draws: 0 };
  const topOf = o => { let t = o; while (t.parent && t.parent !== scene) t = t.parent; return t; };
  const label = o => o.name || (o.isInstancedMesh ? 'InstancedMesh' : o.type) + (o.material && o.material.name ? '<' + o.material.name + '>' : '');
  const rbd = R.renderBufferDirect.bind(R);
  R.renderBufferDirect = function (cam, sc, geo, mat, obj, grp) {
    if (S.census && M.capturing) { const t = topOf(obj), k = label(t) + (t !== obj ? ' / ' + label(obj) : ''), km = (mat && (mat.name || mat.type)) || '?';
      S.byTop.set(k, (S.byTop.get(k) || 0) + 1); S.byMat.set(km, (S.byMat.get(km) || 0) + 1); S.draws++; }
    return rbd(cam, sc, geo, mat, obj, grp);
  };
  const med = a => { if (!a.length) return null; const f = a.slice().sort((x, y) => x - y); return +f[f.length >> 1].toFixed(2); };
  const p90 = a => { if (!a.length) return null; const f = a.slice().sort((x, y) => x - y); return +f[Math.floor(f.length * 0.9)].toFixed(2); };
  function run(n, census) {
    return new Promise(res => {
      S.census = !!census; S.byTop.clear(); S.byMat.clear(); S.draws = 0;
      const ft = [], cms = [], calls = []; let last = performance.now(), k = 0, cap0 = M.captures || 0, skip0 = M.skipped || 0, capN = 0;
      const tick = () => {
        const now = performance.now(); ft.push(now - last); last = now;
        if (M.captures !== undefined && M.captures !== cap0 + capN) { capN = M.captures - cap0; cms.push(M.ms); calls.push(M.calls); }
        else if (M.captures === undefined && M.on) cms.push(M.ms);
        if (++k < n) requestAnimationFrame(tick);
        else { S.census = false;
          const top = (m, N) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, N).map(e => [e[0], +(e[1] / Math.max(1, capN)).toFixed(1)]);
          res(JSON.stringify({ frame: { median: med(ft.slice(1)), p90: p90(ft.slice(1)) }, captureMs: { median: med(cms), p90: p90(cms) }, captures: capN, skipped: (M.skipped || 0) - skip0,
            calls: med(calls), w: M.w, plane: M.plane !== undefined ? M.plane : null,
            census: census ? { drawsPerCapture: +(S.draws / Math.max(1, capN)).toFixed(1), byTop: top(S.byTop, 40), byMat: top(S.byMat, 20) } : null })); }
      };
      requestAnimationFrame(tick);
    });
  }
  // fly(path, n): the free eye along a path of n frames, the mirror's weight and plane read each frame (and the frame's ms)
  function fly(from, to, yaw, pitch, n) {
    return new Promise(res => {
      const U = WATER.uniforms, rows = []; let k = 0, last = performance.now();
      const tick = () => { const f = k / (n - 1), now = performance.now();
        DEV_CAM.pos.set(from[0] + (to[0] - from[0]) * f, from[1] + (to[1] - from[1]) * f, from[2] + (to[2] - from[2]) * f);
        DEV_CAM.yaw = yaw * Math.PI / 180; DEV_CAM.pitch = pitch * Math.PI / 180;
        if (k) rows.push([+(now - last).toFixed(1), +U.uWMirror4.value.x.toFixed(3), +U.uWMirror4.value.w.toFixed(2), +DEV_CAM.pos.x.toFixed(0), +DEV_CAM.pos.y.toFixed(0)]);
        last = now;
        if (++k < n) requestAnimationFrame(tick); else res(JSON.stringify(rows)); };
      requestAnimationFrame(tick);
    });
  }
  window.__MC = { S, run, fly };
  return 'installed';
})()`;

const SETTLED = `(() => new Promise(res => {
  const wu = WORLD.worldUpdate; let busy = false, n = 0;
  const st = () => (window.TREE_FILL && TREE_FILL.stat) ? TREE_FILL.stat() : null; const g0 = st() ? st().gens : -1;
  const pq = () => { const P = WORLD.premises; return P && P.streamState ? P.streamState.near : 0; };
  WORLD.worldUpdate = cg => { wu(cg); const S = st(); if (S && (S.busy || S.gens !== g0)) busy = true; if (pq() > 0) busy = true; };
  const tick = () => { if (++n < 60) requestAnimationFrame(tick); else { WORLD.worldUpdate = wu; res(!busy); } };
  requestAnimationFrame(tick); }))()`;

(async () => {
  let tgt = null;
  for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  if (!tgt) throw new Error('no page target');
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); } };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); const d = r.result;
    if (!d || d.exceptionDetails) throw new Error('page: ' + (d && d.exceptionDetails ? (d.exceptionDetails.exception && d.exceptionDetails.exception.description || d.exceptionDetails.text) : JSON.stringify(r))); return d.result.value; };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: require('../_stock_pin.js').pinScript() });   // G770: the OLD stock, pinned (frame_perf's)
  await cmd('Emulation.setDeviceMetricsOverride', { width: SIZE[0], height: SIZE[1], deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: URL });
  await sleep(1500);
  try { await ev("(() => Promise.race([(window.BOOT && BOOT.whenReady) ? BOOT.whenReady().then(() => 'ready') : new Promise(r => setTimeout(() => r('no BOOT'), 18500)), new Promise(r => setTimeout(() => r('boot timeout'), 120000))]))()"); }
  catch (e) { await sleep(18500); }
  await sleep(500);
  const KEEP = "(()=>{const l=[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0&&b.offsetParent);l.forEach(x=>x.click());return l.length;})()";
  let flying = false;
  for (let a = 0; a < 8 && !flying; a++) {
    await ev("(()=>{const g=document.getElementById('bGo'); if (g) { g.click(); return; } [...document.querySelectorAll('button')].filter(b=>/roll out/i.test(b.textContent)).forEach(x=>x.click());})()");
    await sleep(6000);
    flying = await ev("!!window.FLIGHT_PROBE && (/TAXI|DOWNWIND|FINAL|DEPART/.test(document.body.innerText) || (window.BOOT && BOOT.state === 'loading'))");
  }
  if (!flying) throw new Error('the roll-out never happened');
  for (let i = 0; i < 20; i++) { const n = await ev(KEEP); await sleep(500); if (!n && i > 4) break; }
  for (let i = 0; i < 300; i++) { const bs = await ev("window.BOOT ? BOOT.state : 'none'"); if (bs === 'gone' || bs === 'none') break; await sleep(1000); }
  await ev("(()=>{[...document.querySelectorAll('button')].filter(b=>/continue anyway/i.test(b.textContent)).forEach(b=>b.click());return 1;})()");
  await sleep(2000);
  // paused, then the free eye (water_shot's way)
  await ev("(()=>{const b=document.getElementById('bPause');if(b&&/pause/i.test(b.textContent))b.click();return 1;})()");
  await ev("(()=>{const R=window.FLYDIY_RAIL,f=document.getElementById('flFly');if(R)R.open(f&&!f.hidden?null:'camera');return 1;})()");
  await sleep(300);
  const got = await ev("(()=>{const p=[...document.querySelectorAll('#flFlyBody .pill')].find(b=>b.textContent.trim()==='free');if(!p)return 0;p.click();return 1;})()");
  if (!got) throw new Error('no free pill on the camera flyout');
  await ev("(()=>{const R=window.FLYDIY_RAIL,f=document.getElementById('flFly');if(R)R.open(f&&!f.hidden?null:'camera');return 1;})()");
  const gpu = await ev("(()=>{const g=(WORLD.renderer||window.FLYDIY_RENDERER).getContext();const d=g.getExtension('WEBGL_debug_renderer_info');return d?g.getParameter(d.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER);})()");
  const gfx = JSON.parse(await ev('JSON.stringify(window.GFX ? GFX.get() : null)'));
  console.log(`mirror_census [${LABEL}]  ${gpu}  · preset ${gfx && gfx.preset} (mirror '${gfx && gfx.mirror}', aa ${gfx && gfx.aa}, clouds ${gfx && gfx.clouds})  · ${await ev(INSTRUMENT)}`);
  // the inland place: the densest forest within 2.5 km, 110 m over it (frame_perf's)
  const inland = JSON.parse(await ev(`(() => { const w = FLIGHT_PROBE.world(); const T = w.trees.filter(t => Math.hypot(t.x, t.z) < 2500); let best = T[0], bn = -1;
    for (let i = 0; i < T.length; i += 7) { const a = T[i]; let n = 0; for (const b of T) if (Math.abs(b.x - a.x) < 120 && Math.abs(b.z - a.z) < 120) n++; if (n > bn) { bn = n; best = a; } }
    return JSON.stringify([best.x, w.terrainH(best.x, best.z) + 110, best.z]); })()`));
  if (SKIP) console.log('  skip -> ' + await ev(`(()=>{ WATER.mirror.skip = (${SKIP}) || []; return WATER.mirror.skip.length + ' objects left out of the capture'; })()`));
  const rows = [];
  for (const v of VIEWS) {
    const E = EYES[v]; if (!E) { console.log('  (no view ' + v + ')'); continue; }
    const p = E.inland ? inland : E.pos;
    await ev(`(()=>{DEV_CAM.pos.set(${p[0]},${p[1]},${p[2]});DEV_CAM.yaw=${E.yaw * Math.PI / 180};DEV_CAM.pitch=${E.pitch * Math.PI / 180};return 1;})()`);
    await sleep(1200);
    for (let i = 0; i < 20 && !(await ev(SETTLED)); i++);
    const row = { view: v, at: p.map(x => Math.round(x)) };
    for (const mode of ['off', 'live']) {
      await ev(`(()=>{WATER.set({mirror:'${mode}'});return 1;})()`); await sleep(800);
      await ev('__MC.run(30, false)');   // the first frames pay the target and any lazy program
      row[mode] = JSON.parse(await ev(`__MC.run(${FRAMES}, ${CENSUS && mode === 'live'})`));
    }
    rows.push(row);
    const o = row.off, l = row.live;
    console.log(`  ${v.padEnd(7)} off ${String(o.frame.median).padStart(6)} ms (p90 ${o.frame.p90}) · live ${String(l.frame.median).padStart(6)} ms (p90 ${l.frame.p90}) · capture ${l.captureMs.median} ms CPU (p90 ${l.captureMs.p90}) × ${l.captures}/${FRAMES}, ${l.calls} draws, skipped ${l.skipped} · w ${l.w}`);
    if (l.census) { console.log(`      census: ${l.census.drawsPerCapture} draws a capture`); for (const [k, n] of l.census.byTop.slice(0, 25)) console.log(`        ${String(n).padStart(7)}  ${k}`);
      console.log('      by material: ' + l.census.byMat.slice(0, 12).map(e => e[0] + ' ' + e[1]).join(' · ')); }
  }
  let flights = null;
  if (FLIGHTS) {
    await ev("(()=>{WATER.set({mirror:'live'});return 1;})()"); await sleep(600);
    const shore = JSON.parse(await ev("__MC.fly([2950, 30, 0], [2250, 30, 0], 270, -8, 360)"));
    const back = JSON.parse(await ev("__MC.fly([2250, 30, 0], [2950, 30, 0], 90, -8, 360)"));
    const climb = JSON.parse(await ev("__MC.fly([3200, 20, 0], [3200, 1500, 0], 270, -12, 480)"));
    const sum = (name, r) => { const w = r.map(x => x[1]), pl = r.map(x => x[2]), ms = r.map(x => x[0]).sort((a, b) => a - b);
      const s = { frames: r.length, wMin: Math.min(...w), wMax: Math.max(...w), planeMin: Math.min(...pl), planeMax: Math.max(...pl), wSteps: r.filter((x, i) => i && Math.abs(x[1] - r[i - 1][1]) > 0.05).length,
        frameMedian: ms[ms.length >> 1], frameP90: ms[Math.floor(ms.length * 0.9)], over33: r.filter(x => x[0] > 33.4).length };
      console.log(`  flight ${name.padEnd(6)} weight ${s.wMin}..${s.wMax} (${s.wSteps} steps), plane ${s.planeMin}..${s.planeMax} · frame ${s.frameMedian} ms (p90 ${s.frameP90}), ${s.over33} of ${s.frames} over 33.4 ms`);
      return s; };
    flights = { shore: sum('shore', shore), back: sum('back', back), climb: sum('climb', climb), raw: { shore, back, climb } };
  }
  ws.close(); killChrome();
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ date: new Date().toISOString(), url: URL, label: LABEL, gpu, gfx, frames: FRAMES, skip: SKIP, rows, flights }, null, 1));
  console.log('  -> ' + OUT);
})().catch(e => { console.error('mirror_census: ' + e.message); killChrome(); process.exit(1); });
