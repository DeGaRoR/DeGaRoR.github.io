#!/usr/bin/env node
// treesnear_shots.js - THE TREES AT SHORT AND MEDIUM DISTANCE, PER SPECIES, BEFORE AND AFTER (G1110, TREES-NEAR)
//
// The user (2026-09-30): "it is almost impossible to see the trees in their full glory. Almost all camera positions give
// the model plus a dotted transition sprite ... You need to show me the screenshots with the 3 tree species." This rig
// boots the game on Jolene in a headless Chrome on the GPU (frame_perf's boot: dev.html, the roll-out, the screen gone),
// holds the flight paused on the stand, and for each SPECIES finds a planted, living tree of it (TREE_LOD.find: the
// partition's own records, so the tree is one the game drew) with the clearest line of sight at each DISTANCE, puts the
// free camera there (DEV_CAM: eye height, the tree framed), and shoots it under each BAND SET (TREE_LOD.set + fade). Then
// two chase views of the aeroplane: on the stand, and held over the forest at --low m AGL. The page's UI is hidden.
//
//   node tools/treesnear_shots.js [--url http://localhost:8611/flyDiy/dev.html?world=jolene]
//        [--species realistic_fir_trees_pack_lods_gameready.glb,spruce_tree.glb,fir_tree_georgeous.glb]
//        [--dists 20,60] [--sets 'before=10,30,30,30;after=50,120,120,12'] [--low 60] [--size 1920x1080]
//        [--png <dir, lossless, local>] [--jpg <dir, q82 1280 px>] [--jpgsets before,after] [--gfx '<json>']
//   Needs a server (tools/_serve.js <port> <repo root> --fallback D:/Dev/DeGaRoR.github.io) and the GPU LOCK.
// A set is `name=l0,l1,near,fade` (metres). Files: <species stem>_<dist>m_<set>.png / .jpg, chase_<place>_<set>.*
// Prints each shot's tree (key, place, height) and the rung census at the frame (TREE_LOD.census if present).
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const URL = opt('url', 'http://localhost:8611/flyDiy/dev.html?world=jolene');
const SPECIES = opt('species', 'realistic_fir_trees_pack_lods_gameready.glb,spruce_tree.glb,fir_tree_georgeous.glb').split(',');
const DISTS = opt('dists', '20,60').split(',').map(Number);
const SETS = opt('sets', 'before=10,30,30,30;after=50,120,120,12').split(';').map(s => { const [n, v] = s.split('='); const a = v.split(',').map(Number); return { name: n, bands: a.slice(0, 3), fade: a[3] }; });
const LOW = +opt('low', 60);
const SIZE = opt('size', '1920x1080').split('x').map(Number);
const PNG = opt('png', path.join(require('os').tmpdir(), 'treesnear_png'));
const JPG = opt('jpg', path.join(__dirname, 'perf', 'treesnear_evidence'));
const JPGSETS = opt('jpgsets', SETS.map(s => s.name).join(',')).split(',');
const GFX = opt('gfx', null);
const PORT = 9300 + (process.pid % 90);
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('treesnear_shots: no Chrome'); process.exit(2); }
const udd = path.join(require('os').tmpdir(), 'cdp_tnear_' + PORT + '_' + Date.now());
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORT, '--window-size=' + SIZE.join(','), '--hide-scrollbars',
  '--no-first-run', '--user-data-dir=' + udd, '--disable-gpu-sandbox', 'about:blank'], { stdio: 'ignore' });
const killChrome = () => { try { if (process.platform === 'win32') require('child_process').execSync('taskkill /PID ' + ch.pid + ' /T /F', { stdio: 'ignore' }); else ch.kill(); } catch (e) {} };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
const stem = k => k.replace(/\.glb$/, '').replace(/_lods_gameready|_pack/g, '').replace(/\W+/g, '_');

// THE VIEW OF ONE TREE: candidates rooted 80-2500 m from the aeroplane, 16 bearings each, the eye `d` m out on dry
// ground; the score is the planted trees (any species) standing within 2.5 m of the sight line, then the tree's height
// (the tallest of the clearest). The eye stands 1.7 m up at 20 m, 4 m up beyond; it looks at the crown's middle.
const VIEW = (key, d) => `(() => {
  const w = FLIGHT_PROBE.world(), cg = FLIGHT_PROBE.sim().cgPos(), P = window.TREE_PACK_REG;
  const hOf = k => { const [c, s] = k.split('|'); const C = P.collections.find(x => x.name === c); const S = C && C.subjects.find(x => x.name === s); return S ? S.h : 15; };
  const cands = TREE_LOD.find(${JSON.stringify(key)}, cg[0], cg[2], 80, 2500, 80);
  let best = null;
  for (const T of cands) {
    const all = TREE_LOD.find('', T.x, T.z, 0.5, ${d} + 3, 3000);
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2, ex = T.x + Math.cos(a) * ${d}, ez = T.z + Math.sin(a) * ${d};
      const gy = w.terrainH(ex, ez); if (w.waterH && w.waterH(ex, ez) > gy - 0.2) continue;
      let occ = 0; const ux = (T.x - ex) / ${d}, uz = (T.z - ez) / ${d};
      for (const o of all) { const px = o.x - ex, pz = o.z - ez, t = px * ux + pz * uz; if (t < -2 || t > ${d} - 1.5) continue;
        if (Math.abs(px * uz - pz * ux) < 2.5) occ++; }
      const h = hOf(T.key) * T.s, score = occ * 100 - h;
      if (!best || score < best.score) best = { T, h, ex, ez, gy, occ, score };
    }
  }
  if (!best) return JSON.stringify({ none: true, cands: cands.length });
  const B = best, eyeY = B.gy + (${d} <= 25 ? 1.7 : 4), look = B.T.y + B.h * 0.5;
  const dx = B.T.x - B.ex, dz = B.T.z - B.ez;
  DEV_CAM.pos.set(B.ex, eyeY, B.ez); DEV_CAM.yaw = Math.atan2(dx, -dz); DEV_CAM.pitch = Math.atan2(look - eyeY, Math.hypot(dx, dz));
  return JSON.stringify({ key: B.T.key, tree: [B.T.x | 0, B.T.y | 0, B.T.z | 0], h: +B.h.toFixed(1), eye: [B.ex | 0, eyeY | 0, B.ez | 0], dist: ${d}, occluders: B.occ, fromAircraft: B.T.d | 0 });
})()`;

(async () => {
  fs.mkdirSync(PNG, { recursive: true }); fs.mkdirSync(JPG, { recursive: true });
  let tgt = null;
  for (let i = 0; i < 40 && !tgt; i++) { await sleep(400); try { tgt = (await getJSON('http://127.0.0.1:' + PORT + '/json')).find(t => t.type === 'page'); } catch (e) {} }
  if (!tgt) throw new Error('no page target');
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const waits = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); } };
  const cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    const d = r.result; if (!d || d.exceptionDetails) throw new Error('page: ' + (d && d.exceptionDetails ? (d.exceptionDetails.exception && d.exceptionDetails.exception.description || d.exceptionDetails.text) : JSON.stringify(r)));
    return d.result.value; };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  await cmd('Page.addScriptToEvaluateOnNewDocument', { source: require('./_stock_pin.js').pinScript() });
  if (GFX) await cmd('Page.addScriptToEvaluateOnNewDocument', { source: 'try{localStorage.setItem("flydiy.gfx",JSON.stringify(' + GFX + '))}catch(e){}' });
  await cmd('Emulation.setDeviceMetricsOverride', { width: SIZE[0], height: SIZE[1], deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: URL });
  await sleep(1500);
  try { await ev("(() => Promise.race([(window.BOOT && BOOT.whenReady) ? BOOT.whenReady().then(() => 'ready') : new Promise(r => setTimeout(() => r('no BOOT'), 18500)), new Promise(r => setTimeout(() => r('boot timeout'), 120000))]))()"); }
  catch (e) { await sleep(18500); }
  await sleep(500);
  const KEEP = "(()=>{const l=[...document.querySelectorAll('button,a,div')].filter(b=>/keep the current build/i.test(b.textContent||'')&&b.children.length===0&&b.offsetParent);l.forEach(x=>x.click());return l.length;})()";
  let flying = false;
  for (let attempt = 0; attempt < 8 && !flying; attempt++) {
    await ev("(()=>{const g=document.getElementById('bGo'); if (g) { g.click(); return; } [...document.querySelectorAll('button')].filter(b=>/roll out/i.test(b.textContent)).forEach(x=>x.click());})()");
    await sleep(6000);
    flying = await ev("!!window.FLIGHT_PROBE && (/TAXI|DOWNWIND|FINAL|DEPART/.test(document.body.innerText) || (window.BOOT && BOOT.state === 'loading'))");
  }
  if (!flying) throw new Error('the roll-out never happened');
  for (let i = 0; i < 20; i++) { const n = await ev(KEEP); await sleep(500); if (!n && i > 4) break; }
  for (let i = 0; i < 300; i++) { const bs = await ev("window.BOOT ? BOOT.state : 'none'"); if (bs === 'gone' || bs === 'none') break; await sleep(1000); }
  await sleep(3000);
  await ev("(()=>{const b=document.getElementById('bPause');if(b&&/pause/i.test(b.textContent))b.click();return 1;})()");
  console.log('treesnear_shots  gfx ' + await ev('JSON.stringify(window.GFX ? GFX.get() : null)') + '  bands ' + await ev('JSON.stringify([TREE_LOD.get(), TREE_LOD.fade()])'));
  const hideUI = "(()=>{document.body.style.visibility='hidden';const c=document.getElementById('c');c.style.visibility='visible';return 1;})()";
  const showUI = "(()=>{document.body.style.visibility='';return 1;})()";
  // a frame the eye has not moved in: the partition refreshed (TREE_LOD.set forces it), the maps decoded, the shadows re-cast
  const settle = async () => { await ev('new Promise(r => { let n = 0; const t = () => (++n < 90 ? requestAnimationFrame(t) : r(1)); requestAnimationFrame(t); })'); await sleep(600); };
  const shoot = async (name, set) => {
    const png = await cmd('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(PNG, name + '.png'), Buffer.from(png.result.data, 'base64'));
    if (JPGSETS.includes(set)) {
      const s = 1280 / SIZE[0];
      const jpg = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 82, clip: { x: 0, y: 0, width: SIZE[0], height: SIZE[1], scale: s } });
      fs.writeFileSync(path.join(JPG, name + '.jpg'), Buffer.from(jpg.result.data, 'base64'));
    }
  };
  const bandsTo = async S => { await ev('(()=>{TREE_LOD.set(' + JSON.stringify(S.bands) + ');TREE_LOD.fade(' + S.fade + ');return 1;})()'); await settle(); };
  const census = async () => { try { return await ev('JSON.stringify(window.TREE_LOD && TREE_LOD.census ? TREE_LOD.census() : null)'); } catch (e) { return 'null'; } };

  await ev("FLIGHT_PROBE.camMode('free')"); await settle();
  await ev(hideUI);
  for (const key of SPECIES) for (const d of DISTS) {
    const v = await ev(VIEW(key, d));
    console.log('  ' + stem(key) + ' @ ' + d + ' m: ' + v);
    if (/"none"/.test(v)) continue;
    for (const S of SETS) { await bandsTo(S); await shoot(stem(key) + '_' + d + 'm_' + S.name, S.name); console.log('    ' + S.name + ' ' + S.bands.join('/') + ' w' + S.fade + ' census ' + await census()); }
  }
  // the chase views: on the stand, then held --low m over the densest forest near it
  await ev(showUI); await ev("FLIGHT_PROBE.camMode('chase')"); await settle(); await ev(hideUI);
  for (const S of SETS) { await bandsTo(S); await shoot('chase_stand_' + S.name, S.name); }
  const lowAt = await ev(`(async () => {
    const w = FLIGHT_PROBE.world(), cg = FLIGHT_PROBE.sim().cgPos();
    const C = TREE_LOD.find('', cg[0], cg[2], 400, 2500, 4000);
    let best = null, bn = -1;
    for (let i = 0; i < C.length; i += 20) { const a = C[i]; let n = 0; for (const b of C) if (Math.abs(b.x - a.x) < 60 && Math.abs(b.z - a.z) < 60) n++; if (n > bn) { bn = n; best = a; } }
    const y = w.terrainH(best.x, best.z) + ${LOW};
    if (FLIGHT_PROBE.place) await FLIGHT_PROBE.place({ at: [best.x, y, best.z], zeroV: true });
    else { const s = FLIGHT_PROBE.sim(), c = s.cgPos(); for (let i = 0; i < s.n; i++) { s.p[i*3] += best.x - c[0]; s.p[i*3+1] += y - c[1]; s.p[i*3+2] += best.z - c[2]; s.v[i*3] = s.v[i*3+1] = s.v[i*3+2] = 0; } }
    return JSON.stringify({ at: [best.x | 0, y | 0, best.z | 0], agl: ${LOW}, trees60: bn }); })()`);
  console.log('  low: ' + lowAt);
  await sleep(4000); await settle();
  for (const S of SETS) { await bandsTo(S); await shoot('chase_low' + LOW + '_' + S.name, S.name); console.log('    low ' + S.name + ' census ' + await census()); }
  ws.close(); killChrome();
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) {}
  console.log('  -> ' + PNG + ' (PNG) and ' + JPG + ' (JPEG, sets ' + JPGSETS.join(',') + ')');
})().catch(e => { console.error('treesnear_shots: ' + e.message); killChrome(); process.exit(1); });
