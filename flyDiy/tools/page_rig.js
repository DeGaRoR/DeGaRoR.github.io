#!/usr/bin/env node
// page_rig.js - THE SHARED PAGE HARNESS (LOOK-1, 15 Nov 2026). The user: "they all reinvent their harness, and most fail and
// need several tries; wasting time". Built from LOOK-1's rig_wabk.js, the one rig that drew real frames on 13 Nov. Read
// tools/RIG-PROCEDURE.md first: this file does its sections 2-4, you add only your views.
//
// A MODULE:
//   const rig = await require('./page_rig.js').start({ cap: 600, q: 'glint=0', size: '1600x900' });
//   await rig.fly();                      // Go until FLYING (BOOT gone, mode-fly, no mode-ws, no rollShot, sim t rising);
//                                         // a float / hull build's start dialog answered: { launch: 'water' (default) | 'trailer' };
//                                         // then the world must DRAW: an open fleet screen / new-plane panel closed (Escape),
//                                         // the AA renders > 0 a second, else a throw naming the hold (rig.plane.aaPerS)
//   await rig.pause();                    // the game's own #bPause, as a player would
//   await rig.place(x, z, agl);           // optional: the aircraft to a FAR subject first (FLIGHT_PROBE.place, paused)
//   await rig.skipToLineUp();             // optional (page-rig-2): the game's own Skip (#bSkip): the stand's taxi skipped, lined up at the hold
//   await rig.eyeNear(dx, dy, dz, yaw, pitch); // (page-rig-2) the free eye RELATIVE TO THE AIRCRAFT'S CG (sim.cgPos), re-read now; the next
//                                         // grab checks the aircraft is in the frame first
//   await rig.eye(x, y, z, yaw, pitch);   // FLIGHT_PROBE.devFree: the free eye (keep it NEAR rig.plane: the world streams round the aircraft)
//   const png = await rig.grab();         // the canvas after FLYDIY_AA.render, read back with readPixels: a PNG Buffer;
//                                         // png.info = { w, h, mean, sd, bgShare, blank, topMean, botMean, eye, fov, frame }
//                                         // rows are flipped (GL's bottom-up): upright, the sky at the top (box, 13-15 Nov)
//   console.log(await rig.why());         // BOOT.state, body classes, FLYDIY_HOLDS(), visibility, rAF/s and by callback name,
//                                         // renderer frames/s, AA.render calls/s, page errors
//   await rig.close();                    // Chrome by its own PID tree, the server, the profile folder
//   also: rig.ev(js) -> value, rig.J(js) -> JSON-parsed value, rig.frames(n) (rAF), rig.gpu, rig.plane, rig.errors, rig.log,
//         rig.anchor() (the aircraft's CG, cross-checked), rig.inFrame([x, y, z]) (projected through the game's camera), rig.misses
//         rig.cmd(method, params) (the raw CDP call: Emulation, a DOM-layer screenshot - never for the world, RIG-PROCEDURE 3)
//
// THE AIRCRAFT IS WHERE THE SIM'S CG IS (page-rig-2, 16 Nov - two traps that cost slots):
//   - FLIGHT_PROBE.craft() is the drawn Group, its position (0, 0, 0) - the meshes move inside it. An eye 'near the craft' from it
//     looks at the world origin. The anchor is FLIGHT_PROBE.sim().cgPos(); camGet().target is the cross-check only (it can be stale
//     after fly() or a place()). An anchor within ORIGIN_R m of the origin is a MISS, never an eye.
//   - A grab of a plane-relative view checks first that the CG projects inside the frame (the game's own camera); two misses stop.
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
//     onNavigate async diagnostic callback receiving rig before the boot wait; throw to stop a phase-only probe cleanly
//
// A CLI (plain stills):
//   node tools/page_rig.js --views views.json --out <dir> [--q k=v&k2=v2] [--size 1600x900] [--cap 600] [--page dev.html]
//        [--seed seed.json] [--init '<js>'] [--jpeg 0.92] [--nofly] [--port 8560] [--launch water|trailer]
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
// (page-rig-2) THE ANCHOR: the aircraft's CG from the sim, camGet().target the cross-check; see the header. Pure, for GATE PAGERIG
const ORIGIN_R = 5, STALE_M = 25;
const okP = p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
const nearOrigin = p => !okP(p) || Math.hypot(p[0], p[2]) < ORIGIN_R;
function pickAnchor(r) {
  const cg = r && r.cg, ct = r && r.camTarget, gap = okP(cg) && okP(ct) ? Math.hypot(cg[0] - ct[0], cg[1] - ct[1], cg[2] - ct[2]) : null;
  const out = { cg: okP(cg) ? cg : null, camTarget: okP(ct) ? ct : null, gap: gap == null ? null : +gap.toFixed(2), notes: [] };
  if (!nearOrigin(cg)) { out.at = cg; out.src = 'cgPos'; if (gap != null && gap > STALE_M) out.notes.push('camGet().target is ' + out.gap + ' m from the CG (stale after fly / place): the CG wins'); }
  else if (!nearOrigin(ct)) { out.at = ct; out.src = 'camGet'; out.notes.push(okP(cg) ? 'cgPos at the world origin: camGet().target used' : 'no sim.cgPos(): camGet().target used'); }
  else out.miss = 'the aim is at the world origin: no CG, no camera target (FLIGHT_PROBE.craft() is a Group at 0,0,0 - never aim at it)';
  return out;
}
// the verdict on a projection (INFRAME's answer): in front of the eye, inside the frame less a margin
const frameVerdict = (v, margin) => { const m = margin == null ? 0.05 : margin; return !!v && !v.err && !!v.front && v.z > -1 && v.z < 1 && Math.abs(v.x) <= 1 - m && Math.abs(v.y) <= 1 - m; };
const ANCHOR = "(() => { const P = window.FLIGHT_PROBE; if (!P) return null; let cg = null; try { const s = P.sim(); cg = s && s.cgPos ? Array.from(s.cgPos()).map(Number) : null; } catch (e) {} let t = null; try { const c = P.camGet ? P.camGet() : null; t = c && c.target ? Array.from(c.target).map(Number) : null; } catch (e) {} return { cg, camTarget: t }; })()";
// a point through the game's camera (its matrices as last drawn): NDC x, y, z, in front or not, its distance from the eye
const INFRAME = p => '(() => { const cam = FLIGHT_PROBE.camera && FLIGHT_PROBE.camera(); if (!cam) return { err: "no FLIGHT_PROBE.camera()" }; cam.updateMatrixWorld(); if (cam.matrixWorldInverse.copy) cam.matrixWorldInverse.copy(cam.matrixWorld).invert();' +
  ' const e = cam.matrixWorldInverse.elements, q = cam.projectionMatrix.elements, x = ' + (+p[0]) + ', y = ' + (+p[1]) + ', z = ' + (+p[2]) + ';' +
  ' const vx = e[0] * x + e[4] * y + e[8] * z + e[12], vy = e[1] * x + e[5] * y + e[9] * z + e[13], vz = e[2] * x + e[6] * y + e[10] * z + e[14];' +
  ' const cx = q[0] * vx + q[4] * vy + q[8] * vz + q[12], cy = q[1] * vx + q[5] * vy + q[9] * vz + q[13], cz = q[2] * vx + q[6] * vy + q[10] * vz + q[14], cw = q[3] * vx + q[7] * vy + q[11] * vz + q[15];' +
  ' return { x: +(cx / cw).toFixed(4), y: +(cy / cw).toFixed(4), z: +(cz / cw).toFixed(4), front: vz < 0, dist: +Math.hypot(vx, vy, vz).toFixed(2) }; })()';
// the page's flying test: every condition RIG-PROCEDURE 2 names; -1 = not flying, else the sim's clock
const SIMT = "(()=>{ const b = document.body && document.body.classList; if (!b || !window.FLIGHT_PROBE || (window.BOOT && BOOT.state !== 'gone') || !b.contains('mode-fly') || b.contains('rollShot') || b.contains('mode-ws')) return -1; const s = FLIGHT_PROBE.sim(); return s && typeof s.t === 'number' ? s.t : -1; })()";
// (page-rig-4) the launch dialog's answer: null when #edLaunch is absent or closed (a land build, or it is answered), else the
// chosen start clicked ('water' | 'trailer') or 'no <k>' when that button is missing
const LAUNCH_ANSWER = k => { k = k === 'trailer' ? 'trailer' : 'water';
  return "(() => { const el = document.getElementById('edLaunch'); if (!el || el.hidden) return null; const b = el.querySelector('button[data-k=" + k + "]'); if (!b) return 'no " + k + "'; b.click(); return '" + k + "'; })()"; };
const BOOT_HEALTH = "(()=>{const B=window.BOOT;if(!B)return {ok:false,reason:'no BOOT'};const rows=B.log||[],failures=rows.filter(e=>e.k==='fail'||e.k==='error'),normalReady=rows.some(e=>e.k==='ready'),busy=!!(B.busy&&B.busy());return {ok:B.state==='gone'&&!busy&&normalReady&&!failures.length,state:B.state,busy,normalReady,failures};})()";
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

// (page-rig-4, AUDIO via A0 22 Nov) THE UI HOLDS: flying (the sim's clock rising, rAF looping) and still nothing drawn - the
// game's loop returns before the world (app.js: holdRender || uiHold || NEW_PLANE open || FLEET_SCREEN open; uiHold is
// FLYDIY_UI_HOLD's, set by the fleet screen, the new-plane panel and the fiche's picture). The screens a player closes
// with Escape, named (ONE key event on the page: the screens listen on window in the capture phase; a second would reach
// the game's own Escape once the screen has closed); the AA renders in one second (0 = the world held)
const UI_HOLDS = "(() => { const o = (x) => { try { return !!(x && x.isOpen && x.isOpen()); } catch (e) { return false; } }; const h = []; if (o(window.FLEET_SCREEN)) h.push('fleet screen'); if (o(window.NEW_PLANE)) h.push('new plane'); return h; })()";
const ESCAPE = "(() => { const ev = () => new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true }); (document.body || document).dispatchEvent(ev()); return true; })()";
const AA_RATE = "new Promise(res => { if (!window.PAGE_RIG) return res(null); const a0 = PAGE_RIG.aaCalls(); setTimeout(() => res(PAGE_RIG.aaCalls() - a0), 1000); })";
// WHY (RIG-PROCEDURE 4): one look at everything that stops a frame, logged on the first miss
const WHY = `new Promise(res => { const R = window.FLYDIY_RENDERER, f0 = R ? R.info.render.frame : null, t0 = performance.now(), aa0 = window.PAGE_RIG ? PAGE_RIG.aaCalls() : null; let n = 0;
  const raf0 = window.requestAnimationFrame, names = {}; window.requestAnimationFrame = function (cb) { const k = (cb && cb.name) || 'anonymous'; names[k] = (names[k] || 0) + 1; return raf0.call(window, cb); };
  const pageRigTick = () => { n++; if (performance.now() - t0 < 1000) raf0.call(window, pageRigTick); }; raf0.call(window, pageRigTick);
  setTimeout(() => { window.requestAnimationFrame = raf0; let holds = null; try { holds = window.FLYDIY_HOLDS ? FLYDIY_HOLDS() : null; } catch (e) { holds = 'ERR ' + e.message; }
    res(JSON.stringify({ boot: window.BOOT ? BOOT.state : 'none', body: document.body ? document.body.className : null, holds, uiHolds: ${UI_HOLDS}, visibility: document.visibilityState,
      rafPerS: n, rafByName: names, rendererFramesPerS: R ? R.info.render.frame - f0 : null, aaRenderPerS: aa0 == null ? null : PAGE_RIG.aaCalls() - aa0, simT: ${SIMT}, url: location.href })); }, 1100); })`;

// (page-rig-3) the frame rate over one second: low while a new place streams in after a long jump (DIRT-STRIP 16 Nov:
// the first grab after w8 4 km / w7 came back BLANK at rafPerS 9-10, the second at the same place was fine)
const RAFRATE = `new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else res(n); }; requestAnimationFrame(f); })`;
const SETTLE_RAF = 20, SETTLE_RUN = 2, SETTLE_MS = 90000;

async function start(o) {
  o = o || {};
  const t0 = Date.now(), name = o.name || 'page_rig', size = parseSize(o.size), cap = +(o.cap || 600);
  const log = o.log || (s => console.log('[' + new Date().toTimeString().slice(0, 8) + '] ' + name + ': ' + s));
  const repo = path.resolve(o.repo || path.join(__dirname, '..', '..'));
  const fallback = o.fallback !== undefined ? o.fallback : (fs.existsSync('D:/Dev/DeGaRoR.github.io') && path.resolve('D:/Dev/DeGaRoR.github.io') !== repo ? 'D:/Dev/DeGaRoR.github.io' : null);
  const chrome = findChrome(); if (!chrome) throw new Error('page_rig: no Chrome found (set CHROME=<path>)');
  const sport = +(o.port || await freePort());
  const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'page_rig_'));
  const rig = { log, errors: [], size, gpu: null, plane: null, flying: false, closed: false, misses: 0, maxMiss: o.maxMiss || 2, lastNear: false };
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
    // (page-rig-2) _serve.js by absolute path from the REPO served, so a copy of this file elsewhere (a scratchpad) still finds it
    const serveJs = [path.join(repo, 'flyDiy', 'tools', '_serve.js'), path.join(__dirname, '_serve.js')].find(p => fs.existsSync(p));
    if (!serveJs) throw new Error('page_rig: no _serve.js under ' + repo + ' or ' + __dirname);
    srv = spawn(process.execPath, [serveJs, String(sport), repo].concat(fallback ? ['--fallback', fallback] : []), { stdio: 'ignore' });
    let up = false; for (let i = 0; i < 40 && !up; i++) { up = await httpOk('http://127.0.0.1:' + sport + '/flyDiy/' + (o.page || 'index.html')); if (!up) await sleep(250); }
    if (!up) throw new Error('page_rig: the server on ' + sport + ' never answered');

    // Chrome: headless on the real GPU, its own profile, its own debugging port (read back from DevToolsActivePort)
    // A nonzero debugging port avoids Chrome's port0 webdriver signal. The
    // explicit player mode preserves vsync/frame pacing; legacy rigs unchanged.
    const playerPort = o.live ? await freePort() : 0;
    // HEADED (the user 22 Nov: GPU work in a visible window): Chrome backgrounds a covered window (no rAF: 'no frame drawn in 5 s')
    const HEADED_ARGS = ['--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--window-position=0,0'];
    ch = spawn(chrome, [...(o.headed ? HEADED_ARGS : ['--headless=new']), '--remote-debugging-port=' + playerPort, '--window-size=' + size[0] + ',' + size[1], '--user-data-dir=' + udd,
      '--disable-gpu-sandbox', ...(o.live ? [] : ['--disable-frame-rate-limit', '--disable-gpu-vsync']), '--no-first-run', '--hide-scrollbars', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
    let dport = playerPort; for (let i = 0; i < 80 && !dport; i++) { await sleep(250); try { dport = +fs.readFileSync(path.join(udd, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch (e) {} }
    if (!dport) throw new Error('page_rig: Chrome never opened its debugging port');
    let tgt = null; for (let i = 0; i < 40 && !tgt; i++) { try { tgt = (await getJSON('http://127.0.0.1:' + dport + '/json')).find(t => t.type === 'page'); } catch (e) {} if (!tgt) await sleep(250); }
    if (!tgt) throw new Error('page_rig: no page target');
    ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('page_rig: the CDP socket failed')); });

    let id = 0, shown = 0; const waits = new Map();
    const note = t => { rig.errors.push(t); if (rig.errors.length > 200) rig.errors.shift(); if (shown++ < 20) log(t); };
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); return; }
      if (rig.onEvent) { try { rig.onEvent(m); } catch (e2) {} }   // (23 Nov: a caller's own CDP events - flight_script's --screencast)
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
    rig.cmd = cmd;   // CONTROLS-STRIP (16 Nov): the raw CDP call, for a rig that must resize the viewport (Emulation) or read the DOM layer
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
    const navigationStarted = Date.now();
    await cmd('Page.navigate', { url });
    // Optional diagnostic before the normal boot wait. Throwing closes this
    // rig's browser/server, allowing a phase-only probe to stop without a full boot.
    if (o.onNavigate) await o.onNavigate(rig);

    // the boot: BOOT.state 'gone' (the cover stays up until every program links; a click under it never reaches a flight)
    const bootS = +(o.boot || 420), tb = navigationStarted; let bs = null, noneSince = 0;
    while (bs === null || (Date.now() - tb) / 1000 < bootS) {
      try { bs = await rig.ev("window.BOOT ? BOOT.state : (document.readyState === 'complete' ? 'none' : 'loading')", 10000); } catch (e) { bs = 'navigating'; }
      if (bs === 'gone') break;
      if (bs === 'none') { if (!noneSince) noneSince = Date.now(); else if (Date.now() - noneSince > 30000) break; } else noneSince = 0;
      await sleep(1000);
    }
    rig.bootS = Math.round((Date.now() - tb) / 1000);
    log('boot ' + bs + ' after ' + rig.bootS + ' s');
    if (bs !== 'gone') { const w = await rig.why(); log('WHY ' + JSON.stringify(w)); throw new Error('page_rig: no boot in ' + bootS + ' s (BOOT.state ' + bs + ')'); }
    rig.bootHealth = await rig.J(BOOT_HEALTH);
    if (!rig.bootHealth.ok) {
      log('BOOT NOT ACCEPTED ' + JSON.stringify(rig.bootHealth));
      if (!o.allowBootFailure) throw new Error('page_rig: loading screen gone without a healthy completed boot');
      log('Diagnostic capture continues; this is not a passing boot or responsiveness result.');
    }
    const g2 = await rig.ev("(() => { const g = window.FLYDIY_RENDERER && FLYDIY_RENDERER.getContext(), d = g && g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : null; })()");
    if (g2 && g2 !== rig.gpu) { log('the game renderer reports ' + g2); rig.gpu = g2; }
    if (o.needGpu !== false && g2 && !REAL_GPU(g2)) throw new Error('page_rig: the game renderer is not on a real GPU: ' + g2);
    log(await rig.ev(PAGE_HOOK));
  } catch (e) { clearTimeout(capT); kill(); process.removeListener('exit', onExit); process.removeListener('SIGINT', onInt); process.removeListener('SIGTERM', onInt); throw e; }

  // fly: Go until FLYING - all of RIG-PROCEDURE 2's conditions, the sim's clock rising. The text HOLDING is not flying.
  // (page-rig-4, SEAPLANES 22 Nov) A FLOAT OR HULL BUILD ASKS WHERE TO START: Go from the workshop opens #edLaunch (app.js
  // launchAsk: On the water / From the trailer) and every further Go only toggles it - 8 presses never flew the Super
  // Petrel (the 03:18 slot). After each Go the open dialog is answered as a player does: fo.launch 'water' (the default)
  // or 'trailer' (CLI --launch trailer); its button runs Go itself. A land build never opens it: nothing to answer.
  rig.fly = async (fo) => {
    fo = fo || {}; const tries = fo.tries || 8, launch = fo.launch === 'trailer' ? 'trailer' : 'water';
    // (page-rig-4 x perf-codex) the live (headed) run waits natively; its Go also answers a float / hull build's start dialog
    if(o.live){const r=await require('./perf/native_fly_wait')({timeoutMs:fo.timeoutMs||180000,sleep,
      state:()=>rig.J(`({t:(${SIMT}),ready:document.body.classList.contains('mode-fly')&&!document.body.classList.contains('mode-ws')&&!document.body.classList.contains('rollShot')&&BOOT.state==='gone'&&!BOOT.busy(),garage:document.body.classList.contains('mode-ws'),roll:document.body.classList.contains('rollShot'),busy:BOOT.state!=='gone'||BOOT.busy()})`),
      click:()=>rig.ev("(()=>{const b=document.getElementById('bGo');if(b&&!b.disabled)b.click();" + LAUNCH_ANSWER(launch) + ";return !!b;})()"),progress:s=>log('native flight wait '+JSON.stringify(s))});rig.flying=r.ok;
    }else for (let a = 0; a < tries && !rig.flying; a++) {
      await rig.ev("(() => { const b = document.getElementById('bGo'); if (b) b.click(); return !!b; })()");
      await sleep(400); const la = await rig.ev(LAUNCH_ANSWER(launch)); if (la) log('launch dialog answered: ' + la);
      await sleep(fo.waitMs || 6000);
      const ta = await rig.ev(SIMT); await sleep(1500); const tb = await rig.ev(SIMT);
      rig.flying = ta >= 0 && tb > ta; log('fly try ' + (a + 1) + ': sim t ' + ta + ' -> ' + tb + ', body ' + await rig.ev('document.body.className'));
    }
    if (!rig.flying) { const w = await rig.why(); log('WHY ' + JSON.stringify(w)); if (fo.need !== false) throw new Error(o.live?'page_rig: native flight readiness deadline (no two advancing sim samples)':'page_rig: not flying after ' + tries + ' Go clicks (the free eye would be inert)'); return false; }
    // (page-rig-4) FLYING IS NOT DRAWING: a UI hold returns the loop before the world - close it (Escape, as a player does)
    // and see the AA render before going on; a hold that stays is named (rig.why().uiHolds) and the run stops
    let aa = 0, uh = [];
    for (let k = 0; k < 3; k++) {
      uh = await rig.J(UI_HOLDS);
      if (uh && uh.length) { log('UI hold open: ' + uh.join(', ') + ' - Escape'); await rig.ev(ESCAPE); await sleep(800); }
      aa = await rig.J(AA_RATE); if (aa > 0) break;
      if (!(uh && uh.length)) await sleep(1500);   // (a passing hold - the fiche's picture: give it a moment)
    }
    rig.plane = Object.assign({}, rig.plane || {}, { aaPerS: aa });
    if (!(aa > 0)) {
      const w = await rig.why(); log('WHY ' + JSON.stringify(w));
      if (fo.need !== false) throw new Error('page_rig: flying but the world is HELD - no AA render in a second' + (uh && uh.length ? ' (open: ' + uh.join(', ') + ')' : ' (no screen open: uiHold / holdRender, see WHY)'));
      return false;
    }
    await rig.frames(30); const A = await rig.anchor();
    if (A.miss) { if (fo.need !== false) throw new Error('page_rig: flying, but ' + A.miss); return false; }
    // (page-rig-2) the chase camera shows the aircraft after fly(): its CG projects inside the frame (GATE PAGERIG 6b)
    const v = await rig.J(INFRAME(A.at)); rig.plane.inFrame = frameVerdict(v); rig.plane.ndc = v;
    log('flying; the aircraft (' + A.src + ') at ' + JSON.stringify(rig.plane.target) + (A.notes.length ? ' - ' + A.notes.join('; ') : '') + '; in the chase frame ' + rig.plane.inFrame + ' ' + JSON.stringify(v));
    return true;
  };
  // (page-rig-2) the aircraft's CG now (sim.cgPos), cross-checked against camGet().target; rig.plane follows it
  rig.anchor = async () => {
    const A = pickAnchor(await rig.J(ANCHOR));
    if (!A.miss) rig.plane = Object.assign({}, rig.plane || {}, { target: A.at.map(v => +v.toFixed(2)), src: A.src, gap: A.gap, camTarget: A.camTarget });
    else log('ANCHOR MISS: ' + A.miss);
    return A;
  };
  rig.inFrame = async (p, margin) => { const v = await rig.J(INFRAME(p)); return { ok: frameVerdict(v, margin), ndc: v }; };
  // a miss: counted, WHY logged; at maxMiss (2) the run stops (RIG-PROCEDURE 4)
  const miss = async (what) => {
    rig.misses++; const w = await rig.why(); log('MISS ' + rig.misses + '/' + rig.maxMiss + ': ' + what + ' WHY ' + JSON.stringify(w));
    const e = new Error('page_rig: ' + what + (rig.misses >= rig.maxMiss ? ' - two misses: STOP (RIG-PROCEDURE 4)' : '')); e.why = w; e.stop = rig.misses >= rig.maxMiss; throw e;
  };
  // the free eye relative to the aircraft's CG, read NOW (never a stale rig.plane): the next grab checks the aircraft is in frame
  rig.eyeNear = async (dx, dy, dz, yaw, pitch) => {
    const A = await rig.anchor(); if (A.miss) await miss(A.miss);
    await rig.eye(A.at[0] + dx, A.at[1] + dy, A.at[2] + dz, yaw, pitch); rig.lastNear = true; return A.at;
  };
  // the game's own Skip (#bSkip, app.js skipToLineup -> placeLinedUp): the stand's taxi skipped, lined up at the hold, engine running
  rig.skipToLineUp = async (wo) => {
    wo = wo || {};
    const r = await rig.J("(() => { const b = document.getElementById('bSkip'); if (!b) return { ok: false, why: 'no #bSkip on this page' }; if (b.hidden) return { ok: false, why: '#bSkip hidden: no taxi on this start (water, a classic pilot, the shed)' }; if (b.disabled) return { ok: false, why: '#bSkip disabled: ' + b.title }; b.click(); return { ok: true }; })()");
    if (r.ok) { await sleep(wo.waitMs || 3000); await rig.frames(60); const A = await rig.anchor(); r.at = A.at; r.src = A.src; }
    log('skipToLineUp ' + JSON.stringify(r)); if (!r.ok && wo.need) throw new Error('page_rig: ' + r.why); return r;
  };
  rig.pause = async () => {
    const t = await rig.ev("(() => { const b = document.getElementById('bPause'); if (!b) return null; if (/pause/i.test(b.textContent)) b.click(); return b.textContent; })()");
    await rig.frames(2); return t;
  };
  // (page-rig-3) settleLoad: wait until the page draws at least SETTLE_RAF frames a second, SETTLE_RUN seconds in a row
  // (the place has streamed in), at most SETTLE_MS. Never a miss on its own: a page still slow at the cap is logged, and the grab says the rest
  rig.settleLoad = async (so) => {
    so = so || {}; const minRaf = so.minRaf || SETTLE_RAF, run = so.run || SETTLE_RUN, maxMs = so.maxMs || SETTLE_MS, t = Date.now(), seen = [];
    let ok = 0;
    while (ok < run && Date.now() - t < maxMs) { const n = await rig.ev(RAFRATE, 10000); seen.push(n); ok = n >= minRaf ? ok + 1 : 0; }
    const r = { settled: ok >= run, ms: Date.now() - t, rafPerS: seen.slice(-6) };
    if (!r.settled || seen.length > run) log('settleLoad ' + JSON.stringify(r));
    return r;
  };
  // place: the aircraft's CG to (x, the ground or water + agl, z), its velocities zeroed, on the sim that flies (G1096). Pause
  // first. The world streams round the AIRCRAFT: move it to a far subject, then the eye near it (DIRT-STRIP, 15 Nov)
  rig.place = async (x, z, agl, settle) => {
    const at = await rig.J(`(async () => { const W = FLIGHT_PROBE.world(), x = ${+x}, z = ${+z}; let g = W && W.terrainH ? W.terrainH(x, z) : 0; if (W && W.waterH) { const w = W.waterH(x, z); if (Number.isFinite(w) && w > g) g = w; }
      const at = [x, g + ${agl == null ? 3 : +agl}, z]; await FLIGHT_PROBE.place({ at, zeroV: true }); return at; })()`);
    rig.plane = { target: at.map(v => +v.toFixed(2)), placed: true }; await rig.frames(settle || 60);
    await rig.settleLoad();   // (page-rig-3) a long jump streams a new place in: wait until the frame rate is back
    await rig.anchor(); rig.plane.placed = true;   // (page-rig-2) the CG where it settled, not where it was asked
    log('placed the aircraft: asked ' + JSON.stringify(at.map(v => +v.toFixed(2))) + ', CG ' + JSON.stringify(rig.plane.target)); return rig.plane;
  };
  // the free eye, x y z in world metres, yaw / pitch in radians as devCam reads them
  rig.eye = async (x, y, z, yaw, pitch) => {
    if (!rig.flying) log('eye() before fly(): devFree in the setup screen is inert');
    rig.lastNear = false;
    const m = await rig.ev('FLIGHT_PROBE.devFree(' + [x, y, z, yaw, pitch].map(Number).join(',') + ')');
    await rig.frames(2); return m;
  };
  // grab: wait `settle` frames (rAF), then the next drawn frame read back. On a miss: WHY, logged once, then a throw.
  rig.grab = async (go) => {
    go = go || {}; await rig.ev(PAGE_HOOK);   // again after any reload of the page (a GFX row's reload drops the hook): a no-op otherwise
    if (rig.misses >= rig.maxMiss) throw new Error('page_rig: ' + rig.misses + ' misses already: stopped (RIG-PROCEDURE 4)');
    if (go.settle !== 0) await rig.frames(go.settle || 4);
    // (page-rig-2) a plane-relative view (eyeNear, a CLI `near`, or craft: true) checks the aircraft's CG is in the frame first
    if (go.craft === true || (go.craft !== false && rig.lastNear)) {
      const A = await rig.anchor(); if (A.miss) await miss(A.miss);
      const fr = await rig.inFrame(A.at, go.margin); if (!fr.ok) await miss('the aircraft is not in the frame (its CG ' + JSON.stringify(A.at.map(v => +v.toFixed(1))) + ' at NDC ' + JSON.stringify(fr.ndc) + ')');
    }
    let r = await rig.J('PAGE_RIG.grab(' + (go.jpeg ? +go.jpeg : 0) + ')');
    if (!r || r.miss) await miss(r && r.miss || 'no grab');
    // (page-rig-3) a BLANK frame: settle (the place may still be streaming in) and grab ONCE more before anyone counts it.
    // The second frame is returned as it is: still blank, the caller sees info.blank (the CLI counts it bad)
    if (r.info.blank && go.retryBlank !== false) {
      log('blank grab (sd ' + r.info.sd + ', page-background share ' + r.info.bgShare + '): settling, one more grab');
      await rig.settleLoad(); await rig.frames(60);
      r = await rig.J('PAGE_RIG.grab(' + (go.jpeg ? +go.jpeg : 0) + ')');
      if (!r || r.miss) await miss(r && r.miss || 'no grab');
      r.info.retried = true;
    }
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
    if (w.craft != null && typeof w.craft !== 'boolean') throw new Error('views: ' + w.name + ' craft is true / false (the aircraft-in-frame check; default: on for near views)');
  }
  return v;
}

async function cli(argv) {
  const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
  const flag = k => argv.includes('--' + k);
  if (!opt('views') || !opt('out')) { console.error('usage: node tools/page_rig.js --views views.json --out <dir> [--q ...] [--size 1600x900] [--cap 600] [--page dev.html] [--seed seed.json] [--init <js>] [--jpeg 0.92] [--nofly] [--skip] [--port N]'); return 2; }
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
    if (!flag('nofly')) { await rig.fly({ launch: opt('launch', 'water') }); if (flag('skip')) await rig.skipToLineUp({ need: true }); await sleep(3000); await rig.pause(); await rig.anchor(); R.plane = rig.plane; }
    for (const v of views) {
      try {
        if (Array.isArray(v.place)) { if (!rig.flying) throw new Error('place: needs a flight (drop --nofly)'); await rig.place(v.place[0], v.place[1], v.place[2]); }
        let x = v.x, y = v.y, z = v.z;
        if (Array.isArray(v.near)) { if (!rig.plane) throw new Error('near: needs a flight (drop --nofly)'); const A = await rig.anchor(); if (A.miss) throw new Error(A.miss); x = A.at[0] + v.near[0]; y = A.at[1] + v.near[1]; z = A.at[2] + v.near[2]; }
        if (v.agl != null) y = await rig.ev(`(() => { const W = FLIGHT_PROBE.world(); return (W && W.terrainH ? W.terrainH(${+x}, ${+z}) : 0) + ${+v.agl}; })()`);
        if (v.eval) await rig.ev('(async () => { ' + v.eval + '; return 1; })()');
        await rig.eye(x, y, z, v.yaw, v.pitch);
        await rig.frames(v.settle || 60); await sleep(v.wait != null ? v.wait : 5000);
        await rig.settleLoad();   // (page-rig-3) a far eye or a place: the frame rate back before the grab
        const b = await rig.grab({ settle: 30, jpeg, craft: v.craft != null ? !!v.craft : Array.isArray(v.near) });
        const f = path.join(out, v.name + (jpeg ? '.jpg' : '.png')); fs.writeFileSync(f, b);
        R.views[v.name] = { asked: { x, y, z, yaw: v.yaw, pitch: v.pitch }, info: b.info, file: path.basename(f) };
        if (b.info.blank) { bad++; R.views[v.name].why = await rig.why(); rig.log(v.name + ' is BLANK ' + JSON.stringify(b.info)); }
        else rig.log(v.name + ' ' + JSON.stringify(b.info));
      } catch (e) { bad++; R.views[v.name] = { error: String(e.message || e), why: e.why || await rig.why() }; rig.log(v.name + ' FAILED ' + e.message); if (bad >= 2 || e.stop) { rig.log('two misses: stop (RIG-PROCEDURE 4)'); break; } }
      save();
    }
  } finally { R.errors = rig.errors.slice(0, 40); save(); await rig.close(); }
  console.log('page_rig: ' + Object.keys(R.views).length + ' views, ' + bad + ' bad -> ' + out);
  return bad ? 1 : 0;
}

module.exports = { start, parseViews, cli, REAL_GPU, SIMT, LAUNCH_ANSWER, UI_HOLDS, ESCAPE, AA_RATE, BOOT_HEALTH, PAGE_HOOK, WHY, RAFRATE, SETTLE_RAF, pickAnchor, frameVerdict, ANCHOR, INFRAME, ORIGIN_R, STALE_M };
if (require.main === module) cli(process.argv.slice(2)).then(c => process.exit(c), e => { console.error('page_rig: ' + (e && e.stack || e)); process.exit(1); });
