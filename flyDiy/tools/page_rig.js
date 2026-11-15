#!/usr/bin/env node
// page_rig.js - THE SHARED PAGE HARNESS (LOOK-1, 15 Nov 2026). The user: "they all reinvent their harness, and most fail and
// need several tries; wasting time". Built from LOOK-1's rig_wabk.js, the one rig that drew real frames on 13 Nov. Read
// tools/RIG-PROCEDURE.md first: this file does its sections 2-4, you add only your views.
//
// A MODULE:
//   const rig = await require('./page_rig.js').start({ cap: 600, q: 'glint=0', size: '1600x900' });
//   await rig.fly();                      // Go until FLYING (BOOT gone, mode-fly, no mode-ws, no rollShot, sim t rising)
//   await rig.pause();                    // the game's own #bPause, as a player would
//   await rig.place(x, z, agl);           // optional: the aircraft to a FAR subject first (FLIGHT_PROBE.place, paused)
//   await rig.eye(x, y, z, yaw, pitch);   // FLIGHT_PROBE.devFree: the free eye (keep it NEAR rig.plane: the world streams round the aircraft)
//   const png = await rig.grab();         // the canvas after FLYDIY_AA.render, read back with readPixels: a PNG Buffer;
//                                         // png.info = { w, h, mean, sd, bgShare, blank, topMean, botMean, eye, fov, frame }
//                                         // rows are flipped (GL's bottom-up): upright, the sky at the top (box, 13-15 Nov)
//   console.log(await rig.why());         // BOOT.state, body classes, FLYDIY_HOLDS(), visibility, rAF/s and by callback name,
//                                         // renderer frames/s, AA.render calls/s, page errors
//   await rig.close();                    // Chrome by its own PID tree, the server, the profile folder
//   also: rig.ev(js) -> value, rig.J(js) -> JSON-parsed value, rig.frames(n) (rAF), rig.gpu, rig.plane, rig.errors, rig.log
//
//   start({ port, size, q, seed, cap, page, boot, needGpu, repo, fallback, log, name }):
//     port     the static server's port (default: a free one). Chrome's debugging port is always its own free one.
//     size     '1600x900' or [w, h]
//     q        the query string without '?' (e.g. 'glint=0&halo=0')
//     seed     { 'flydiy.key': 'value', ... } written into localStorage after the wipe, before the first load (LOGGED;
//              a seeded run that fails must be retried WITHOUT the seed before blaming the game - RIG-PROCEDURE 2)
//     cap      the HARD CAP in seconds (default 600): at that age the rig logs, kills its Chrome and server, exit code 3.
//              Set it to end BEFORE your slot does. close() disarms it.
//     page     'index.html' (default) or 'dev.html': the load door, never raw build files
//     boot     seconds allowed for BOOT.state 'gone' (default 420)
//     needGpu  true (default): refuse SwiftShader / a software GPU before the boot is spent
//     init     page JS run before every load, after the wipe (a career on a rig: q 'mode=career' + the init RIG-PROCEDURE 2 names)
//
// A CLI (plain stills):
//   node tools/page_rig.js --views views.json --out <dir> [--q k=v&k2=v2] [--size 1600x900] [--cap 600] [--page dev.html]
//        [--seed seed.json] [--init '<js>'] [--jpeg 0.92] [--nofly] [--port 8560]
//   views.json: [ { name, yaw, pitch,  x, y, z  |  near: [dx, dy, dz] (from the aircraft)  |  agl (y over the ground),
//                   place: [x, z] or [x, z, agl] (the aircraft moved there first; then near is relative to it),
//                   settle (frames, 60), wait (ms, 5000), eval (js run before the shot) } ]   (or { views: [...] })
//   Writes <out>/<name>.png (.jpg with --jpeg) and <out>/page_rig.json (base sha, GPU, q, size, every view's eye + stats).
//   Exit 0 = every view grabbed and not blank; 1 = a view failed (the WHY is in the log and the JSON); 3 = the hard cap.
//
// A GPU RUN NEEDS A0's SLOT (RIG-PROCEDURE 1): boxlock.sh take gpu <who> "<what>" first, drop it in an EXIT trap, no node
// gate batteries beside it. The self-test is GATE PAGERIG (tools/_pagerig_check.js; --gpu by hand in a slot).
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os'), net = require('net');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const CHROMES = [process.env.CHROME, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const findChrome = () => CHROMES.find(p => fs.existsSync(p)) || null;
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.unref(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const getJSON = url => new Promise((res, rej) => { http.get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej); });
const httpOk = url => new Promise(res => { const q = http.get(url, r => { r.resume(); res(r.statusCode > 0 && r.statusCode < 500); }); q.on('error', () => res(false)); q.setTimeout(3000, () => { q.destroy(); res(false); }); });
const parseSize = s => Array.isArray(s) ? s.map(Number) : String(s || '1600x900').split('x').map(Number);
const REAL_GPU = g => /NVIDIA|AMD|Radeon|Intel/i.test(g || '') && !/SwiftShader|llvmpipe|Software|Basic Render/i.test(g || '');
// the page's flying test: every condition RIG-PROCEDURE 2 names; -1 = not flying, else the sim's clock
const SIMT = "(()=>{ const b = document.body && document.body.classList; if (!b || !window.FLIGHT_PROBE || (window.BOOT && BOOT.state !== 'gone') || !b.contains('mode-fly') || b.contains('rollShot') || b.contains('mode-ws')) return -1; const s = FLIGHT_PROBE.sim(); return s && typeof s.t === 'number' ? s.t : -1; })()";
const FRAMES = n => `new Promise(r => { let k = ${n | 0}; const f = () => { if (--k <= 0) r(1); else requestAnimationFrame(f); }; requestAnimationFrame(f); })`;
// the localStorage wipe (flydiy.* only, once per tab: a sessionStorage guard, so a page's own reload keeps its state), then the seed
const wipeScript = seed => 'try{if(!sessionStorage.getItem("page_rig_wiped")){for(const k of Object.keys(localStorage)) if(/^flydiy\\./.test(k)) localStorage.removeItem(k);' +
  (seed ? 'const S=' + JSON.stringify(seed) + ';for(const k in S) localStorage.setItem(k, typeof S[k]==="string"?S[k]:JSON.stringify(S[k]));' : '') +
  'sessionStorage.setItem("page_rig_wiped","1")}}catch(e){}';

// ---- the page's half: the grab hook on FLYDIY_AA.render (RIG-PROCEDURE 3: never Page.captureScreenshot) -------------------
const PAGE_HOOK = `(() => {
  if (window.PAGE_RIG) return 'PAGE_RIG ok (again)';
  const AA = window.FLYDIY_AA, R = window.FLYDIY_RENDERER; if (!AA || !R) throw new Error('no FLYDIY_AA / FLYDIY_RENDERER: the game has not booted');
  const gl = R.getContext(), orig = AA.__prOrig || AA.render; AA.__prOrig = orig;
  let want = null, aaN = 0;
  AA.render = function () {
    aaN++; const r = orig.apply(this, arguments);
    if (want) { const done = want; want = null; const c = R.domElement, w = c.width, h = c.height, px = new Uint8Array(w * h * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); done({ px, w, h, frame: R.info.render.frame }); }
    return r;
  };
  const b64 = a => { let s = ''; const u = new Uint8Array(a); for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); };
  // one frame read back: rows flipped, alpha opaque, PNG (or JPEG at q), and the numbers that say whether it is blank
  async function grab(q) {
    const got = await Promise.race([new Promise(r => { want = r; }), new Promise(r => setTimeout(() => r(null), 5000))]);
    if (!got) { want = null; return { miss: 'no frame drawn in 5 s (FLYDIY_AA.render never ran)' }; }
    const { px, w, h } = got, c = new OffscreenCanvas(w, h), x = c.getContext('2d'), d = x.createImageData(w, h), o = d.data;
    let n = 0, s = 0, sq = 0, bg = 0, top = 0, bot = 0; const y5 = (h / 5) | 0;
    for (let y = 0; y < h; y++) { const sr = (h - 1 - y) * w * 4, tr = y * w * 4;
      for (let i = 0; i < w * 4; i += 4) { const r = px[sr + i], g = px[sr + i + 1], b = px[sr + i + 2]; o[tr + i] = r; o[tr + i + 1] = g; o[tr + i + 2] = b; o[tr + i + 3] = 255;
        const L = 0.2126 * r + 0.7152 * g + 0.0722 * b; n++; s += L; sq += L * L; if (y < y5) top += L; else if (y >= h - y5) bot += L; if (Math.abs(r - 207) < 3 && Math.abs(g - 224) < 3 && Math.abs(b - 236) < 3) bg++; } }
    x.putImageData(d, 0, 0);
    const blob = await c.convertToBlob(q ? { type: 'image/jpeg', quality: q } : { type: 'image/png' });
    const mean = s / n, sd = Math.sqrt(Math.max(0, sq / n - mean * mean)), bgShare = bg / n, cg = FLIGHT_PROBE.camGet ? FLIGHT_PROBE.camGet() : null;
    return { data: b64(await blob.arrayBuffer()), info: { w, h, frame: got.frame, mean: +mean.toFixed(2), sd: +sd.toFixed(2), bgShare: +bgShare.toFixed(4),
      blank: sd < 1.5 || bgShare > 0.9, topMean: +(top / (y5 * w)).toFixed(2), botMean: +(bot / (y5 * w)).toFixed(2), eye: cg ? cg.eye.map(v => +v.toFixed(2)) : null, fov: cg ? cg.fov : null } };
  }
  window.PAGE_RIG = { grab, aaCalls: () => aaN };
  return 'PAGE_RIG ok';
})()`;

// WHY (RIG-PROCEDURE 4): one look at everything that stops a frame, logged on the first miss
const WHY = `new Promise(res => { const R = window.FLYDIY_RENDERER, f0 = R ? R.info.render.frame : null, t0 = performance.now(), aa0 = window.PAGE_RIG ? PAGE_RIG.aaCalls() : null; let n = 0;
  const raf0 = window.requestAnimationFrame, names = {}; window.requestAnimationFrame = function (cb) { const k = (cb && cb.name) || 'anonymous'; names[k] = (names[k] || 0) + 1; return raf0.call(window, cb); };
  const pageRigTick = () => { n++; if (performance.now() - t0 < 1000) raf0.call(window, pageRigTick); }; raf0.call(window, pageRigTick);
  setTimeout(() => { window.requestAnimationFrame = raf0; let holds = null; try { holds = window.FLYDIY_HOLDS ? FLYDIY_HOLDS() : null; } catch (e) { holds = 'ERR ' + e.message; }
    res(JSON.stringify({ boot: window.BOOT ? BOOT.state : 'none', body: document.body ? document.body.className : null, holds, visibility: document.visibilityState,
      rafPerS: n, rafByName: names, rendererFramesPerS: R ? R.info.render.frame - f0 : null, aaRenderPerS: aa0 == null ? null : PAGE_RIG.aaCalls() - aa0, simT: ${SIMT}, url: location.href })); }, 1100); })`;

async function start(o) {
  o = o || {};
  const t0 = Date.now(), name = o.name || 'page_rig', size = parseSize(o.size), cap = +(o.cap || 600);
  const log = o.log || (s => console.log('[' + new Date().toTimeString().slice(0, 8) + '] ' + name + ': ' + s));
  const repo = path.resolve(o.repo || path.join(__dirname, '..', '..'));
  const fallback = o.fallback !== undefined ? o.fallback : (fs.existsSync('D:/Dev/DeGaRoR.github.io') && path.resolve('D:/Dev/DeGaRoR.github.io') !== repo ? 'D:/Dev/DeGaRoR.github.io' : null);
  const chrome = findChrome(); if (!chrome) throw new Error('page_rig: no Chrome found (set CHROME=<path>)');
  const sport = +(o.port || await freePort());
  const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'page_rig_'));
  const rig = { log, errors: [], size, gpu: null, plane: null, flying: false, closed: false };
  let srv = null, ch = null, ws = null, capT = null, cmd = null;

  // the kill: Chrome by ITS OWN PID tree (never a pattern), the server, the profile folder
  const kill = () => {
    if (ch && ch.pid && !ch.__dead) { ch.__dead = true; try { if (process.platform === 'win32') execSync('taskkill /PID ' + ch.pid + ' /T /F', { stdio: 'ignore' }); else ch.kill('SIGKILL'); } catch (e) {} }
    if (srv && !srv.__dead) { srv.__dead = true; try { srv.kill(); } catch (e) {} }
  };
  const onExit = () => kill(), onInt = () => process.exit(130);
  process.on('exit', onExit); process.on('SIGINT', onInt); process.on('SIGTERM', onInt);
  capT = setTimeout(() => { log('HARD CAP ' + cap + ' s reached: closing Chrome and the server, exit 3'); kill(); process.exit(3); }, cap * 1000);

  try {
    // the server: the worktree first, the main checkout's gitignored data (bench/, assets/) as the fallback
    srv = spawn(process.execPath, [path.join(__dirname, '_serve.js'), String(sport), repo].concat(fallback ? ['--fallback', fallback] : []), { stdio: 'ignore' });
    let up = false; for (let i = 0; i < 40 && !up; i++) { up = await httpOk('http://127.0.0.1:' + sport + '/flyDiy/' + (o.page || 'index.html')); if (!up) await sleep(250); }
    if (!up) throw new Error('page_rig: the server on ' + sport + ' never answered');

    // Chrome: headless on the real GPU, its own profile, its own debugging port (read back from DevToolsActivePort)
    ch = spawn(chrome, ['--headless=new', '--remote-debugging-port=0', '--window-size=' + size[0] + ',' + size[1], '--user-data-dir=' + udd,
      '--disable-gpu-sandbox', '--disable-frame-rate-limit', '--disable-gpu-vsync', '--no-first-run', '--hide-scrollbars', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
    let dport = 0; for (let i = 0; i < 80 && !dport; i++) { await sleep(250); try { dport = +fs.readFileSync(path.join(udd, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch (e) {} }
    if (!dport) throw new Error('page_rig: Chrome never opened its debugging port');
    let tgt = null; for (let i = 0; i < 40 && !tgt; i++) { try { tgt = (await getJSON('http://127.0.0.1:' + dport + '/json')).find(t => t.type === 'page'); } catch (e) {} if (!tgt) await sleep(250); }
    if (!tgt) throw new Error('page_rig: no page target');
    ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('page_rig: the CDP socket failed')); });

    let id = 0, shown = 0; const waits = new Map();
    const note = t => { rig.errors.push(t); if (rig.errors.length > 200) rig.errors.shift(); if (shown++ < 20) log(t); };
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); return; }
      if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; note('EXC ' + String(d.exception && d.exception.description || d.text).slice(0, 300)); }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') note('ERR ' + m.params.args.map(a => a.value != null ? a.value : a.description).join(' ').slice(0, 300)); };
    cmd = (method, params) => new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    // ev: one page call, never longer than 150 s (a call that never answers held the GPU lock 76 min on 5 Nov)
    rig.ev = async (expr, ms) => {
      const lim = ms || 150000; let tm = null;
      const r = await Promise.race([cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }), new Promise((_, j) => { tm = setTimeout(() => j(new Error('page_rig: a page call took over ' + lim / 1000 + ' s: ' + expr.slice(0, 80))), lim); })]).finally(() => clearTimeout(tm));
      const d = r.result; if (r.error) throw new Error('page_rig: CDP ' + JSON.stringify(r.error));
      if (!d || d.exceptionDetails) throw new Error('page: ' + (d && d.exceptionDetails ? (d.exceptionDetails.exception && d.exceptionDetails.exception.description || d.exceptionDetails.text) : JSON.stringify(r)));
      return d.result.value;
    };
    rig.J = async expr => { const s = await rig.ev('Promise.resolve(' + expr + ').then(v => JSON.stringify(v === undefined ? null : v))'); return s == null ? null : JSON.parse(s); };
    rig.frames = n => rig.ev(FRAMES(n || 1));
    rig.why = async () => { try { const w = JSON.parse(await rig.ev(WHY, 10000)); w.errors = rig.errors.slice(-10); w.ageS = Math.round((Date.now() - t0) / 1000); return w; } catch (e) { return { whyFailed: String(e.message || e), errors: rig.errors.slice(-10) }; } };

    await cmd('Page.enable'); await cmd('Runtime.enable');
    // the real-GPU check on about:blank, before a boot is spent on SwiftShader
    rig.gpu = await rig.ev("(() => { const g = document.createElement('canvas').getContext('webgl2'); if (!g) return null; const d = g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); })()");
    log('gpu ' + rig.gpu);
    if (o.needGpu !== false && !REAL_GPU(rig.gpu)) throw new Error('page_rig: not on a real GPU: ' + rig.gpu);
    await cmd('Page.addScriptToEvaluateOnNewDocument', { source: wipeScript(o.seed) });
    if (o.init) { await cmd('Page.addScriptToEvaluateOnNewDocument', { source: String(o.init) }); log('INIT script before the load: ' + String(o.init).slice(0, 120)); }
    if (o.seed) log('SEEDED localStorage before the load: ' + Object.keys(o.seed).join(', ') + ' (a failure must be retried without the seed)');
    await cmd('Emulation.setDeviceMetricsOverride', { width: size[0], height: size[1], deviceScaleFactor: 1, mobile: false });
    const url = 'http://localhost:' + sport + '/flyDiy/' + (o.page || 'index.html') + (o.q ? '?' + o.q : '');
    log('load ' + url); rig.url = url;
    await cmd('Page.navigate', { url });

    // the boot: BOOT.state 'gone' (the cover stays up until every program links; a click under it never reaches a flight)
    const bootS = +(o.boot || 420), tb = Date.now(); let bs = null, noneSince = 0;
    while ((Date.now() - tb) / 1000 < bootS) {
      try { bs = await rig.ev("window.BOOT ? BOOT.state : (document.readyState === 'complete' ? 'none' : 'loading')", 10000); } catch (e) { bs = 'navigating'; }
      if (bs === 'gone') break;
      if (bs === 'none') { if (!noneSince) noneSince = Date.now(); else if (Date.now() - noneSince > 30000) break; } else noneSince = 0;
      await sleep(1000);
    }
    rig.bootS = Math.round((Date.now() - tb) / 1000);
    log('boot ' + bs + ' after ' + rig.bootS + ' s');
    if (bs !== 'gone') { const w = await rig.why(); log('WHY ' + JSON.stringify(w)); throw new Error('page_rig: no boot in ' + bootS + ' s (BOOT.state ' + bs + ')'); }
    const g2 = await rig.ev("(() => { const g = window.FLYDIY_RENDERER && FLYDIY_RENDERER.getContext(), d = g && g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : null; })()");
    if (g2 && g2 !== rig.gpu) { log('the game renderer reports ' + g2); rig.gpu = g2; }
    if (o.needGpu !== false && g2 && !REAL_GPU(g2)) throw new Error('page_rig: the game renderer is not on a real GPU: ' + g2);
    log(await rig.ev(PAGE_HOOK));
  } catch (e) { clearTimeout(capT); kill(); process.removeListener('exit', onExit); process.removeListener('SIGINT', onInt); process.removeListener('SIGTERM', onInt); throw e; }

  // fly: Go until FLYING - all of RIG-PROCEDURE 2's conditions, the sim's clock rising. The text HOLDING is not flying.
  rig.fly = async (fo) => {
    fo = fo || {}; const tries = fo.tries || 8;
    for (let a = 0; a < tries && !rig.flying; a++) {
      await rig.ev("(() => { const b = document.getElementById('bGo'); if (b) b.click(); return !!b; })()"); await sleep(fo.waitMs || 6000);
      const ta = await rig.ev(SIMT); await sleep(1500); const tb = await rig.ev(SIMT);
      rig.flying = ta >= 0 && tb > ta; log('fly try ' + (a + 1) + ': sim t ' + ta + ' -> ' + tb + ', body ' + await rig.ev('document.body.className'));
    }
    if (!rig.flying) { const w = await rig.why(); log('WHY ' + JSON.stringify(w)); if (fo.need !== false) throw new Error('page_rig: not flying after ' + tries + ' Go clicks (the free eye would be inert)'); return false; }
    rig.plane = await rig.J("(() => { const s = FLIGHT_PROBE.sim(), c = FLIGHT_PROBE.camGet(); return { target: c.target.map(v => +v.toFixed(2)), eye: c.eye.map(v => +v.toFixed(2)) }; })()");
    log('flying; the aircraft at ' + JSON.stringify(rig.plane.target));
    return true;
  };
  rig.pause = async () => {
    const t = await rig.ev("(() => { const b = document.getElementById('bPause'); if (!b) return null; if (/pause/i.test(b.textContent)) b.click(); return b.textContent; })()");
    await rig.frames(2); return t;
  };
  // place: the aircraft's CG to (x, the ground or water + agl, z), its velocities zeroed, on the sim that flies (G1096). Pause
  // first. The world streams round the AIRCRAFT: move it to a far subject, then the eye near it (DIRT-STRIP, 15 Nov)
  rig.place = async (x, z, agl, settle) => {
    const at = await rig.J(`(async () => { const W = FLIGHT_PROBE.world(), x = ${+x}, z = ${+z}; let g = W && W.terrainH ? W.terrainH(x, z) : 0; if (W && W.waterH) { const w = W.waterH(x, z); if (Number.isFinite(w) && w > g) g = w; }
      const at = [x, g + ${agl == null ? 3 : +agl}, z]; await FLIGHT_PROBE.place({ at, zeroV: true }); return at; })()`);
    rig.plane = { target: at.map(v => +v.toFixed(2)), placed: true }; await rig.frames(settle || 60); log('placed the aircraft at ' + JSON.stringify(rig.plane.target)); return rig.plane;
  };
  // the free eye, x y z in world metres, yaw / pitch in radians as devCam reads them
  rig.eye = async (x, y, z, yaw, pitch) => {
    if (!rig.flying) log('eye() before fly(): devFree in the setup screen is inert');
    const m = await rig.ev('FLIGHT_PROBE.devFree(' + [x, y, z, yaw, pitch].map(Number).join(',') + ')');
    await rig.frames(2); return m;
  };
  // grab: wait `settle` frames (rAF), then the next drawn frame read back. On a miss: WHY, logged once, then a throw.
  rig.grab = async (go) => {
    go = go || {}; await rig.ev(PAGE_HOOK);   // again after any reload of the page (a GFX row's reload drops the hook): a no-op otherwise
    if (go.settle !== 0) await rig.frames(go.settle || 4);
    const r = await rig.J('PAGE_RIG.grab(' + (go.jpeg ? +go.jpeg : 0) + ')');
    if (!r || r.miss) { const w = await rig.why(); log('MISS ' + (r && r.miss) + ' WHY ' + JSON.stringify(w)); const e = new Error('page_rig: ' + (r && r.miss || 'no grab')); e.why = w; throw e; }
    const b = Buffer.from(r.data, 'base64'); b.info = r.info; return b;
  };
  rig.close = async () => {
    if (rig.closed) return; rig.closed = true; clearTimeout(capT);
    try { await Promise.race([cmd('Browser.close'), sleep(3000)]); } catch (e) {}
    try { ws.close(); } catch (e) {}
    kill(); process.removeListener('exit', onExit); process.removeListener('SIGINT', onInt); process.removeListener('SIGTERM', onInt);
    for (let i = 0; i < 6; i++) { try { fs.rmSync(udd, { recursive: true, force: true }); break; } catch (e) { await sleep(500); } }
  };
  return rig;
}

// ---- the CLI: plain stills from a views file ---------------------------------------------------------------------------------
function parseViews(txt) {
  const j = typeof txt === 'string' ? JSON.parse(txt) : txt, v = Array.isArray(j) ? j : (j && j.views);
  if (!Array.isArray(v) || !v.length) throw new Error('views: an array of { name, yaw, pitch, x y z | near | agl } (or { views: [...] })');
  const seen = new Set();
  for (const w of v) {
    if (!w || typeof w.name !== 'string' || !/^[\w.-]+$/.test(w.name)) throw new Error('views: every view needs a file-safe name: ' + JSON.stringify(w));
    if (seen.has(w.name)) throw new Error('views: the name ' + w.name + ' twice'); seen.add(w.name);
    if (!(Array.isArray(w.near) && w.near.length === 3) && !(Number.isFinite(w.x) && Number.isFinite(w.z))) throw new Error('views: ' + w.name + ' needs x, z (and y or agl) or near: [dx, dy, dz]');
    if (!Number.isFinite(w.yaw) || !Number.isFinite(w.pitch)) throw new Error('views: ' + w.name + ' needs yaw and pitch (radians)');
  }
  return v;
}

async function cli(argv) {
  const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
  const flag = k => argv.includes('--' + k);
  if (!opt('views') || !opt('out')) { console.error('usage: node tools/page_rig.js --views views.json --out <dir> [--q ...] [--size 1600x900] [--cap 600] [--page dev.html] [--seed seed.json] [--init <js>] [--jpeg 0.92] [--nofly] [--port N]'); return 2; }
  const views = parseViews(fs.readFileSync(opt('views'), 'utf8')), out = path.resolve(opt('out')), jpeg = opt('jpeg') ? +opt('jpeg') : 0;
  fs.mkdirSync(out, { recursive: true });
  const seed = opt('seed') ? JSON.parse(fs.readFileSync(opt('seed'), 'utf8')) : null;
  let base = null; try { base = execSync('git rev-parse --short HEAD', { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) {}
  const R = { when: new Date().toISOString(), base, q: opt('q', ''), size: parseSize(opt('size', '1600x900')), seed: seed ? Object.keys(seed) : null, views: {} };
  const save = () => fs.writeFileSync(path.join(out, 'page_rig.json'), JSON.stringify(R, null, 1));
  const rig = await start({ q: opt('q', ''), size: opt('size', '1600x900'), cap: +opt('cap', 600), page: opt('page', 'index.html'), seed, init: opt('init', null), port: opt('port') ? +opt('port') : 0 });
  let bad = 0;
  try {
    R.gpu = rig.gpu; R.bootS = rig.bootS; save();
    if (!flag('nofly')) { await rig.fly(); await sleep(3000); await rig.pause(); R.plane = rig.plane; }
    for (const v of views) {
      try {
        if (Array.isArray(v.place)) { if (!rig.flying) throw new Error('place: needs a flight (drop --nofly)'); await rig.place(v.place[0], v.place[1], v.place[2]); }
        let x = v.x, y = v.y, z = v.z;
        if (Array.isArray(v.near)) { if (!rig.plane) throw new Error('near: needs a flight (drop --nofly)'); x = rig.plane.target[0] + v.near[0]; y = rig.plane.target[1] + v.near[1]; z = rig.plane.target[2] + v.near[2]; }
        if (v.agl != null) y = await rig.ev(`(() => { const W = FLIGHT_PROBE.world(); return (W && W.terrainH ? W.terrainH(${+x}, ${+z}) : 0) + ${+v.agl}; })()`);
        if (v.eval) await rig.ev('(async () => { ' + v.eval + '; return 1; })()');
        await rig.eye(x, y, z, v.yaw, v.pitch);
        await rig.frames(v.settle || 60); await sleep(v.wait != null ? v.wait : 5000);
        const b = await rig.grab({ settle: 30, jpeg });
        const f = path.join(out, v.name + (jpeg ? '.jpg' : '.png')); fs.writeFileSync(f, b);
        R.views[v.name] = { asked: { x, y, z, yaw: v.yaw, pitch: v.pitch }, info: b.info, file: path.basename(f) };
        if (b.info.blank) { bad++; R.views[v.name].why = await rig.why(); rig.log(v.name + ' is BLANK ' + JSON.stringify(b.info)); }
        else rig.log(v.name + ' ' + JSON.stringify(b.info));
      } catch (e) { bad++; R.views[v.name] = { error: String(e.message || e), why: e.why || await rig.why() }; rig.log(v.name + ' FAILED ' + e.message); if (bad >= 2) { rig.log('two misses: stop (RIG-PROCEDURE 4)'); break; } }
      save();
    }
  } finally { R.errors = rig.errors.slice(0, 40); save(); await rig.close(); }
  console.log('page_rig: ' + Object.keys(R.views).length + ' views, ' + bad + ' bad -> ' + out);
  return bad ? 1 : 0;
}

module.exports = { start, parseViews, cli, REAL_GPU, SIMT, PAGE_HOOK, WHY };
if (require.main === module) cli(process.argv.slice(2)).then(c => process.exit(c), e => { console.error('page_rig: ' + (e && e.stack || e)); process.exit(1); });
