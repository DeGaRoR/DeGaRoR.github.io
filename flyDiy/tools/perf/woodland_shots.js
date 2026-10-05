#!/usr/bin/env node
// woodland_shots.js - THE WOODLAND ON THE BOX, PICTURED AND COUNTED (G1480-G1489, WOODLAND)
//
// Boots the game in a headless Chrome on THIS box's GPU (treesnear_shots.js's boot), the user's real Cub
// (builds/cub_2026-09-20_corrected.json in the WIP slot), Jolene, the roll-out, the screen gone; then:
//   1. THE PLANTER'S STATE: the console's warnings from the boot (render_world's afterBuild logs a throw as
//      'world: after the build ...'), the partition's woodland records (TREE_LOD.drawn's own flag) and the
//      woodland physics trees (world.trees) round the aeroplane, the trunk sets (world.treeHits).
//   2. THE VIEWS, every one paused: stand (the chase camera on HOME's stand), look (the free eye 3 m over the stand
//      looking at the densest woodland within 1.5 km), taxi (the pilot taxis until the CG is --taxi m from the stand,
//      then the pause), low (the aeroplane placed --low m over the densest woodland within 3 km, the chase camera),
//      low_eye (the free eye 120 m over that woodland, looking down along the sun). Per view: the woodland instances
//      within 1 km of the eye, the rung census (TREE_LOD.census), three's last render() counts.
//   3. --replant: TREE_PLACE.replant() called in the page and its exception (or its count) printed - the exact failure.
//
//   node tools/perf/woodland_shots.js --url http://localhost:8741/flyDiy/index.html --tag before --jpg <dir> [--png <dir>]
//        [--taxi 250] [--low 60] [--size 1920x1080] [--replant] [--json <file>]
//   Needs a server (tools/_serve.js <port> <repo root> --fallback D:/Dev/DeGaRoR.github.io) and the GPU LOCK.
// No --help (an unknown flag is ignored).
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const URL = opt('url', 'http://localhost:8741/flyDiy/index.html');
const TAG = opt('tag', 'shot');
const TAXI = +opt('taxi', 250), LOW = +opt('low', 60);
const SIZE = opt('size', '1920x1080').split('x').map(Number);
const PNG = opt('png', null), JPG = opt('jpg', null), JSON_OUT = opt('json', null);
const BUILD = path.join(__dirname, '..', '..', opt('build', 'builds/cub_2026-09-20_corrected.json'));
const PORT = 9400 + (process.pid % 90);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('woodland_shots: no Chrome'); process.exit(2); }
const udd = path.join(require('os').tmpdir(), 'cdp_wood_' + PORT + '_' + Date.now());
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--window-size=' + SIZE.join(','), '--hide-scrollbars',
  '--no-first-run', '--user-data-dir=' + udd, '--disable-gpu-sandbox', 'about:blank'], { stdio: 'ignore' });
const killChrome = () => { try { if (process.platform === 'win32') require('child_process').execSync('taskkill /PID ' + ch.pid + ' /T /F', { stdio: 'ignore' }); else ch.kill(); } catch (e) {} };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });

// the woodland state round a point: own (woodland) instances, fill instances, physics trees, trunk sets
const STATE = (r) => `(() => {
  const w = FLIGHT_PROBE.world(), cg = FLIGHT_PROBE.sim().cgPos(), cam = FLIGHT_PROBE.camera();
  const e = cam && cam.position ? [cam.position.x, cam.position.z] : [cg[0], cg[2]];
  const D = TREE_LOD.drawn(e[0], e[1], ${r}); let own = 0, fill = 0; for (let i = 3; i < D.length; i += 4) D[i] ? own++ : fill++;
  const phys = w.trees.filter(T => (T.x - e[0]) ** 2 + (T.z - e[1]) ** 2 <= ${r * r}).length;
  const R = FLIGHT_PROBE.renderer(), inf = R && R.info ? R.info.render : null;
  const TH = w.treeHits;
  return JSON.stringify({ eye: e.map(v => Math.round(v)), r: ${r}, woodDrawn: own, fillDrawn: fill, physTrees: phys,
    trunkSets: TH ? TH.keys().length : null, trunks: TH ? TH.count : null, wood: TH ? TH.has('wood') : null,
    census: TREE_LOD.census ? TREE_LOD.census() : null, info: inf ? { calls: inf.calls, triangles: inf.triangles } : null,
    worldTrees: w.trees.length, solidTrees: w.treesSolid === undefined ? 'n/a' : w.treesSolid });
})()`;
// the densest woodland (world.trees: the woodland's own seeds, the same records before and after) r0..r1 from the CG
const DENSEST = (r0, r1) => `(() => {
  const w = FLIGHT_PROBE.world(), cg = FLIGHT_PROBE.sim().cgPos();
  const C = w.trees.filter(T => { const d = Math.hypot(T.x - cg[0], T.z - cg[2]); return d >= ${r0} && d <= ${r1}; });
  let best = null, bn = -1;
  for (const a of C) { let n = 0; for (const b of C) if (Math.abs(b.x - a.x) < 150 && Math.abs(b.z - a.z) < 150) n++; if (n > bn) { bn = n; best = a; } }
  return best ? { x: best.x, z: best.z, h: best.h, n: bn, d: Math.hypot(best.x - cg[0], best.z - cg[2]) } : null;
})()`;

(async () => {
  for (const d of [PNG, JPG]) if (d) fs.mkdirSync(d, { recursive: true });
  let tgt = null;
  for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  if (!tgt) throw new Error('no page target');
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map(); const warns = [], exc = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled' && /warn|error/.test(m.params.type)) {
      const t = m.params.args.map(a => a.value !== undefined ? String(a.value) : (a.description || a.type)).join(' ');
      if (/world|tree|wood|imp/i.test(t)) warns.push(t.split('\n').slice(0, 3).join(' | ').slice(0, 400)); }
    if (m.method === 'Runtime.exceptionThrown') exc.push(((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text).split('\n').slice(0, 2).join(' | ').slice(0, 300)); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    const d = r.result; if (!d || d.exceptionDetails) throw new Error('page: ' + (d && d.exceptionDetails ? (d.exceptionDetails.exception && d.exceptionDetails.exception.description || d.exceptionDetails.text) : JSON.stringify(r)));
    return d.result.value; };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  const pre = ['try{localStorage.setItem("flydiy.wip",' + JSON.stringify(fs.readFileSync(BUILD, 'utf8')) + ')}catch(e){}',
    'try{localStorage.removeItem("flydiy.gfx");for(const k of Object.keys(localStorage))if(/^flydiy\\.(fl([A-Z]|$)|route$|world$)/.test(k))localStorage.removeItem(k);localStorage.setItem("flydiy.route",JSON.stringify({from:"HOME",dest:"CIRCUIT"}));localStorage.setItem("flydiy.flManual","0")}catch(e){}'];
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: pre.join('\n') });
  await cmd('Emulation.setDeviceMetricsOverride', { width: SIZE[0], height: SIZE[1], deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: URL });
  await sleep(1500);
  try { await ev("(() => Promise.race([(window.BOOT && BOOT.whenReady) ? BOOT.whenReady().then(() => 'ready') : new Promise(r => setTimeout(() => r('no BOOT'), 18500)), new Promise(r => setTimeout(() => r('boot timeout'), 180000))]))()"); }
  catch (e) { await sleep(18500); }
  await sleep(500);
  const KEEP = "(()=>{const l=[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0&&b.offsetParent);l.forEach(x=>x.click());return l.length;})()";
  let flying = false;
  for (let attempt = 0; attempt < 8 && !flying; attempt++) {
    // the FIRST matching button only (a second click on bGo skips the roll-out shot - rig flag traps)
    await ev("(()=>{const g=document.getElementById('bGo'); if (g) { g.click(); return; } const b=[...document.querySelectorAll('button')].find(b=>/roll out/i.test(b.textContent)&&b.offsetParent); if (b) b.click();})()");
    await sleep(6000);
    flying = await ev("!!window.FLIGHT_PROBE && (/TAXI|DOWNWIND|FINAL|DEPART/.test(document.body.innerText) || (window.BOOT && BOOT.state === 'loading'))");
  }
  if (!flying) throw new Error('the roll-out never happened');
  for (let i = 0; i < 20; i++) { const n = await ev(KEEP); await sleep(500); if (!n && i > 4) break; }
  for (let i = 0; i < 300; i++) { const bs = await ev("window.BOOT ? BOOT.state : 'none'"); if (bs === 'gone' || bs === 'none') break; await sleep(1000); }
  const pause = "(()=>{const b=document.getElementById('bPause');if(b&&/pause/i.test(b.textContent))b.click();return 1;})()";
  const resume = "(()=>{const b=document.getElementById('bPause');if(b&&!/pause/i.test(b.textContent))b.click();return 1;})()";
  await ev(pause);
  await sleep(3000);
  const out = { tag: TAG, url: URL, build: path.basename(BUILD), gfx: await ev('JSON.stringify(window.GFX ? GFX.get() : null)'), flyBuild: await ev('window.FLYDIY_BUILD || null'), views: {} };
  console.log('woodland_shots ' + TAG + '  build ' + out.flyBuild + '  gfx ' + out.gfx);
  const hideUI = "(()=>{document.body.style.visibility='hidden';const c=document.getElementById('c');c.style.visibility='visible';return 1;})()";
  const showUI = "(()=>{document.body.style.visibility='';return 1;})()";
  const settle = async (n) => { await ev('new Promise(r => { let n = 0; const t = () => (++n < ' + (n || 120) + ' ? requestAnimationFrame(t) : r(1)); requestAnimationFrame(t); })'); await sleep(800); };
  const shoot = async name => {
    const f = TAG + '_' + name;
    if (PNG) { const png = await cmd('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(PNG, f + '.png'), Buffer.from(png.result.data, 'base64')); }
    if (JPG) { const s = 1280 / SIZE[0];
      const jpg = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 82, clip: { x: 0, y: 0, width: SIZE[0], height: SIZE[1], scale: s } });
      fs.writeFileSync(path.join(JPG, f + '.jpg'), Buffer.from(jpg.result.data, 'base64')); }
  };
  const view = async (name, extra) => { await settle(); await ev(hideUI); await settle(30); await shoot(name);
    const st = JSON.parse(await ev(STATE(1000))); out.views[name] = Object.assign(st, extra || {}); await ev(showUI);
    console.log('  ' + name.padEnd(8) + ' wood ' + st.woodDrawn + ' fill ' + st.fillDrawn + ' phys ' + st.physTrees + ' (1 km of the eye)  trunks ' + st.trunks + ' in ' + st.trunkSets + ' sets' + (st.wood ? ' +wood' : '') + '  rungs ' + JSON.stringify(st.census && st.census.inst) + '  last render ' + JSON.stringify(st.info) + (extra ? '  ' + JSON.stringify(extra) : '')); };

  // 1. the planter's state after the boot
  out.bootWarnings = warns.slice(); out.bootExceptions = exc.slice();
  console.log('  boot warnings (world/tree): ' + (warns.length ? '\n    ' + warns.join('\n    ') : 'none'));
  // 2. the views
  await ev("FLIGHT_PROBE.camMode('chase')"); await ev('FLIGHT_PROBE.camSettle()');
  await view('stand');
  const look = await ev(DENSEST(150, 1500));
  if (look) {
    await ev(`(() => { const w = FLIGHT_PROBE.world(), cg = FLIGHT_PROBE.sim().cgPos(); FLIGHT_PROBE.camMode('free');
      const ex = cg[0], ez = cg[2], ey = w.terrainH(ex, ez) + 3, L = ${JSON.stringify(look)};
      const dx = L.x - ex, dz = L.z - ez; DEV_CAM.pos.set(ex, ey, ez); DEV_CAM.yaw = Math.atan2(dx, -dz); DEV_CAM.pitch = Math.atan2(L.h + 8 - ey, Math.hypot(dx, dz)); return 1; })()`);
    await view('look', { at: [Math.round(look.x), Math.round(look.z)], dist: Math.round(look.d), physWithin150: look.n });
  }
  await ev("FLIGHT_PROBE.camMode('chase')");
  // the taxi: the pilot rolls until the CG is TAXI m from the stand (or 90 s), then the pause
  const c0 = await ev('JSON.stringify(FLIGHT_PROBE.sim().cgPos())').then(JSON.parse);
  await ev(resume);
  let moved = 0; const t0 = Date.now();
  while (Date.now() - t0 < 90000) { await sleep(250); const c = JSON.parse(await ev('JSON.stringify(FLIGHT_PROBE.sim().cgPos())')); moved = Math.hypot(c[0] - c0[0], c[2] - c0[2]); if (moved >= TAXI) break; }
  await ev(pause); await ev('FLIGHT_PROBE.camSettle()');
  await view('taxi', { moved: Math.round(moved), secs: Math.round((Date.now() - t0) / 1000) });
  // the low pass: placed LOW m over the densest woodland within 3 km of HOME
  const low = await ev(DENSEST(300, 3000));
  if (low) {
    await ev(`(async () => { const w = FLIGHT_PROBE.world(), L = ${JSON.stringify(low)}; await FLIGHT_PROBE.place({ at: [L.x, w.terrainH(L.x, L.z) + ${LOW}, L.z], zeroV: true }); return 1; })()`);
    await sleep(3000); await ev('FLIGHT_PROBE.camSettle()');
    await settle(240);
    await view('low', { at: [Math.round(low.x), Math.round(low.z)], agl: LOW, physWithin150: low.n });
    await ev(`(() => { const w = FLIGHT_PROBE.world(), L = ${JSON.stringify(low)}; FLIGHT_PROBE.camMode('free');
      const ex = L.x - 260, ez = L.z - 180, ey = w.terrainH(L.x, L.z) + 120, dx = L.x - ex, dz = L.z - ez;
      DEV_CAM.pos.set(ex, ey, ez); DEV_CAM.yaw = Math.atan2(dx, -dz); DEV_CAM.pitch = Math.atan2(w.terrainH(L.x, L.z) - ey, Math.hypot(dx, dz)); return 1; })()`);
    await view('low_eye');
  }
  // 3. the exact failure
  if (flag('replant')) {
    out.replant = await ev("(() => { try { const n = TREE_PLACE.replant(); return 'replant ok, placed ' + n; } catch (e) { return 'replant THREW: ' + e.name + ': ' + e.message + ' | ' + String(e.stack).split('\\n').slice(1, 3).join(' | '); } })()");
    console.log('  ' + out.replant);
  }
  out.exceptions = exc;
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(out, null, 1));
  ws.close(); killChrome();
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
})().catch(e => { console.error('woodland_shots: ' + e.message); killChrome(); process.exit(1); });
