#!/usr/bin/env node
// plane_shot.js - PICTURES OF ANY BUILD, FROM ANY SESSION, WITHOUT A GRAPHICS CARD (CLOUD-SHOTS, G3795-G3799, 2026-10-27)
// (Not tools/cloud_shot.js: that name is the sky's - A6's rig for the clouds, GATE CLOUD checks it is there.)
//
// The user, 27 Oct: "the new phone mode with the black garage is actually key to cloud sessions. It could be light enough
// that they could load this session and do plane screenshots ... If cloud can do screenshots, that is a game changer."
// SOFT-GPU (G1460) proved SwiftShader draws everything the game uses - its only enemy is time - and MOBILE-GARAGE
// (G2103) proved the phone profile boots on it with no world (11 steps, 0 island bytes). This rig is the two together,
// pointed at one job: the phone profile's garage (the black studio once PHONE-GARAGE G3726 is on master, the shed
// before), ANY build file brought in through the fleet's own Import (#gFile -> garage.js readFile -> loadSpec: the
// user's door, no GARAGE_SPEC.set, no localStorage seeding), and one PNG per named view with the UI hidden.
//
//   node flyDiy/tools/plane_shot.js --build <file.json>[,<file2.json>...] --out <dir>
//        [--views q,s,t,f]        the editor's own framing presets: q 3/4 front, s side, t plan, f nose, i interior
//                                 (with a pilot), part:<key or name> a close-up of one part (the tree's key, e.g. wing,
//                                 or its name), orbit:<az>/<el>/<dist> (deg, deg, m), close:<az>/<el>/<dist> the same
//                                 meant close (no cut-off check: a detail - the slot, the VG row - is cut by design) -
//                                 default q,s,t,f
//        [--size 1920x1080]       the viewport (CSS px, DPR 1); the still is the 3D canvas only (the phone's sheet takes a third)
//        [--gpu]                  the machine's graphics card instead of SwiftShader (the box's A/B; a visible window)
//        [--page index.html]      index.html (built) or dev.html (the loose src/)
//        [--secs 1500]            the whole run's budget
//        [--chrome <path>]        the browser (default: Playwright's Chromium, then Chrome, then /usr/bin/chromium*)
//        [--keep-ui]              the still with the page's UI over it
//        [--root <dir>]           the repo served (default: the one this file is in) - e.g. a throwaway archive of a branch
//        [--fallback <dir>[;<dir>]]  _serve.js's fallback roots, in order (a tree over the main checkout's gitignored data)
//        [--dry]                  everything up to the browser: the arguments, the files, the browser found - no launch
//   node flyDiy/tools/plane_shot.js --pair <dirA> <dirB> --out <dir> [--labels A,B]
//                                 side-by-side composites of the PNGs both directories hold (SwiftShader | RTX)
//   -> <out>/<build>_<view>.png per view, and one line `PLANE_SHOT {json}`: the renderer string, the preset, the boot's
//      seconds, per shot its seconds, the eye asked and got, the aeroplane's share of the frame and its box.
//
// THE ASSERTS (the stills rule, 23 Oct: assert the eye, look at a frame) - each failure is a line `FAIL <reason>` and an
// exit code; a view that fails is not written as if it were good:
//   3 the build: the import raised no alert and the page's spec is the file's (>= 90 % of its cage rows equal - the
//     build's clamps may pull a few)          4 the boot: the garage chain ran whole before --secs
//   5 the eye: after the view, camGet()'s az / el / dist are the ones asked (a preset's own numbers, app.js camera())
//   6 the frame: not one flat colour; the aeroplane is IN it - the same frame with the build hidden differs on > 2 % of
//     the pixels, and that difference does not run off an edge (a cut-off aeroplane names the edge)
//   7 a page error (an uncaught exception)   2 no browser here   1 anything else (the run itself)
// Slow by nature on SwiftShader (a frame is a second or more): never read a frame time off it.
//
// No dependencies: node >= 22 (global WebSocket + fetch). It serves the repo with tools/_serve.js on a free port and
// drives the browser over raw CDP (the box has no Playwright; the cloud image keeps one at /opt/node-tools, whose
// Chromium is used, not its API).
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const FLY = path.resolve(__dirname, '..');          // flyDiy/
const REPO = path.resolve(FLY, '..');                // the served root
const T0 = Date.now();
const log = (...a) => console.log('[' + ((Date.now() - T0) / 1000).toFixed(1).padStart(6) + ' s]', ...a);

// THE EDITOR'S PRESETS, as app.js's camera(k) writes them (az, el, dist; the pan back to the build's centre) - the
// numbers the eye is asserted against, whichever door pressed them
const PRESET = { q: ['3/4 front', -2.5, 0.25, 12], s: ['side', -Math.PI / 2, 0.06, 13], t: ['plan', -Math.PI / 2, 1.35, 15],
                 f: ['nose', Math.PI, 0.10, 10], i: ['interior', null, null, null] };
const EXIT = { run: 1, browser: 2, build: 3, boot: 4, eye: 5, frame: 6, page: 7 };

// ---- the browser ----------------------------------------------------------------------------------------------------
function findChrome() {
  const want = opt('chrome', null);
  if (want) return fs.existsSync(want) ? want : null;
  const tries = [];
  for (const p of ['playwright', '/opt/node-tools/node_modules/playwright', 'playwright-core']) {
    try { const pw = require(p); const x = pw.chromium.executablePath(); if (x && fs.existsSync(x)) return x; } catch (e) {}
  }
  try { const g = path.join(execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(), 'playwright');
        const x = require(g).chromium.executablePath(); if (x && fs.existsSync(x)) return x; } catch (e) {}
  tries.push('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser');
  return tries.find(p => fs.existsSync(p)) || null;
}
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });

async function launch(chrome, gpu, size) {
  const port = await freePort();
  const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'planeshot_'));
  const args = ['--remote-debugging-port=' + port, '--user-data-dir=' + udd, '--no-first-run', '--no-default-browser-check',
    '--ignore-gpu-blocklist', '--window-size=' + size[0] + ',' + size[1], '--window-position=0,0', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--hide-scrollbars'];
  // SwiftShader: ANGLE on SwiftShader's Vulkan, the cloud's only GL (G1460's flags); --gpu: the card, in a real window
  if (!gpu) args.push('--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader');
  if (process.platform === 'linux') args.push('--no-sandbox', '--disable-dev-shm-usage');
  args.push('about:blank');
  const proc = spawn(chrome, args, { stdio: 'ignore', detached: false });
  for (let i = 0; i < 60; i++) {
    try { const v = await (await fetch('http://127.0.0.1:' + port + '/json/version')).json(); if (v) return { proc, port, udd, ver: v }; } catch (e) {}
    await sleep(500);
  }
  try { proc.kill(); } catch (e) {}
  throw Object.assign(new Error('the browser never opened its DevTools port (' + chrome + ')'), { code: EXIT.browser });
}

async function connect(port) {
  const base = 'http://127.0.0.1:' + port;
  const tab = await (await fetch(base + '/json/new?about:blank', { method: 'PUT' })).json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const waits = new Map(); const S = { closed: false, crashed: false, exc: [], dialogs: [] };
  const cmd = (method, params) => S.closed ? Promise.resolve({ error: { message: 'closed' } })
    : new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
    if (m.method === 'Inspector.targetCrashed') S.crashed = true;
    if (m.method === 'Runtime.exceptionThrown') S.exc.push(((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text || '').split('\n')[0]);
    // an alert() (the import's "That file is not a flyDiy build") or a prompt: noted and dismissed, never left blocking
    if (m.method === 'Page.javascriptDialogOpening') { S.dialogs.push(m.params.type + ': ' + m.params.message); cmd('Page.handleJavaScriptDialog', { accept: true }); }
  };
  ws.onclose = () => { S.closed = true; for (const f of waits.values()) f({ error: { message: 'closed' } }); waits.clear(); };
  const ev = async (expr, ms = 120000) => {
    const r = await Promise.race([cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }), sleep(ms).then(() => ({ error: { message: 'timeout after ' + ms + ' ms' } }))]);
    if (r.error) throw new Error(r.error.message);
    const d = r.result; if (d.exceptionDetails) throw new Error((d.exceptionDetails.exception || {}).description || d.exceptionDetails.text);
    return d.result.value;
  };
  for (const d of ['Page.enable', 'Runtime.enable', 'Inspector.enable', 'DOM.enable']) await cmd(d);
  return { cmd, ev, S, close: async () => { try { await fetch(base + '/json/close/' + tab.id); } catch (e) {} } };
}

// ---- the picture's numbers, computed in the page on a 2D canvas (no image library in node) ---------------------------
// a: the still, b: the same frame with the build hidden -> the flat-colour share, the colours, and the difference: its
// share of the pixels, its box, and which edges it touches (a 2-px border, > 0.5 % of that edge's pixels)
const ANALYSE = `async (a, b) => {
  const img = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/png;base64,' + src; });
  const px = async src => { const i = await img(src); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(i, 0, 0); return { w: i.width, h: i.height, d: g.getImageData(0, 0, i.width, i.height).data }; };
  const A = await px(a), B = b ? await px(b) : null, n = A.w * A.h;
  const hist = new Map(); let top = 0;
  for (let i = 0; i < A.d.length; i += 4) { const k = (A.d[i] >> 3) << 10 | (A.d[i + 1] >> 3) << 5 | (A.d[i + 2] >> 3); const v = (hist.get(k) || 0) + 1; hist.set(k, v); if (v > top) top = v; }
  const out = { w: A.w, h: A.h, topShare: +(top / n).toFixed(4), colours: hist.size };
  if (B && B.w === A.w && B.h === A.h) {
    let on = 0, x0 = A.w, y0 = A.h, x1 = -1, y1 = -1; const edge = { top: 0, bottom: 0, left: 0, right: 0 };
    for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) {
      const i = (y * A.w + x) * 4;
      if (Math.max(Math.abs(A.d[i] - B.d[i]), Math.abs(A.d[i + 1] - B.d[i + 1]), Math.abs(A.d[i + 2] - B.d[i + 2])) <= 12) continue;
      on++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (y < 2) edge.top++; if (y >= A.h - 2) edge.bottom++; if (x < 2) edge.left++; if (x >= A.w - 2) edge.right++;
    }
    out.craftShare = +(on / n).toFixed(4);
    out.craftBox = on ? [x0, y0, x1, y1] : null;
    out.cut = Object.keys(edge).filter(k => edge[k] > 0.005 * ((k === 'top' || k === 'bottom') ? A.w : A.h) * 2);
  }
  return out;
}`;

// ---- one boot, every build, every view ----------------------------------------------------------------------------
async function shoot(o) {
  const R = { builds: [], errors: [], fails: [], t: {} };
  const fail = (code, why) => { R.fails.push({ code, why }); log('FAIL ' + why); };
  const stop = T0 + o.secs * 1000, left = () => stop - Date.now();
  const serve = spawn(process.execPath, [path.join(FLY, 'tools', '_serve.js'), String(o.servePort), o.root].concat(o.fallback ? ['--fallback', o.fallback] : []), { stdio: 'ignore' });
  let B = null, C = null;
  try {
    B = await launch(o.chrome, o.gpu, o.size);
    log('browser', B.ver.Browser, o.gpu ? '(the graphics card)' : '(SwiftShader)');
    C = await connect(B.port);
    // a frame counter of the page's own (every rAF is one turn of the game's loop - seconds apart on SwiftShader), and
    // no backdrop blur (the compositor's, never the picture's, and the most of a software frame's cost - soft_still's)
    await C.cmd('Page.addScriptToEvaluateOnNewDocument', { source:
      'window.__shotFrames=0;(function t(){window.__shotFrames++;requestAnimationFrame(t)})();' +
      'document.addEventListener("DOMContentLoaded",()=>{const s=document.createElement("style");s.textContent="*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}";document.head.appendChild(s);});' });
    await C.cmd('Emulation.setDeviceMetricsOverride', { width: o.size[0], height: o.size[1], deviceScaleFactor: 1, mobile: false });
    // (awaited in the page: an async expression's value, not its promise - JSON.stringify(a promise) is {})
    const J = async (e, ms) => JSON.parse(await C.ev('(async () => JSON.stringify(await (' + e + ')))()', ms));
    const until = async (what, expr, every = 1000) => {
      for (;;) {
        let v = null; try { v = await C.ev(expr, 60000); } catch (e) { v = null; }
        if (v) return v;
        if (C.S.crashed) throw Object.assign(new Error('the page crashed waiting for ' + what), { code: EXIT.run });
        if (left() <= 0) throw Object.assign(new Error('timed out waiting for ' + what + ' (' + o.secs + ' s)'), { code: what === 'the garage' ? EXIT.boot : EXIT.run });
        await sleep(every);
      }
    };
    const frames = async n => { const f0 = await C.ev('window.__shotFrames || 0'); await until(n + ' frames', '(window.__shotFrames || 0) >= ' + (f0 + n), 300); };

    // THE PAGE: the phone profile (the garage alone, no world; the studio where it has landed), the laptop preset on
    // both renderers (the software rung would pick potato by itself - gfx_settings.js - and the A/B must be one preset)
    const url = 'http://localhost:' + o.servePort + '/flyDiy/' + o.page + '?profile=phone&gfx=laptop&intro=0';
    log('page', url);
    await C.cmd('Page.navigate', { url });
    await until('the garage', '!!(window.BOOT && BOOT.state === "gone" && BOOT.set === "garage" && BOOT.stepI >= (BOOT.steps || []).length && !BOOT.current && window.FLIGHT_PROBE && window.CAGE_UI && window.GARAGE_SPEC)', 2000);
    R.t.boot = +((Date.now() - T0) / 1000).toFixed(1);
    Object.assign(R, await J('(() => { const g = window.FLYDIY_RENDERER && FLYDIY_RENDERER.getContext(); let gpu = null; try { const d = g.getExtension("WEBGL_debug_renderer_info"); gpu = d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); } catch (e) {}' +
      ' let gfx = null; try { gfx = JSON.parse(localStorage.getItem("flydiy.gfx") || "null"); } catch (e) {}' +
      ' return { gpu, profile: window.PROFILE && PROFILE.name, room: window.PROFILE && PROFILE.get && PROFILE.get("room"), preset: (window.GFX && GFX.get && GFX.get().preset) || (gfx && gfx.preset) || null, soft: !!(window.GFX && GFX.soft && GFX.soft()),' +
      ' bootSteps: BOOT.steps.length, hardTimeout: (BOOT.log || []).some(e => e && e.k === "fail") }; })()'));
    log('garage up', R.t.boot + ' s,', R.bootSteps, 'steps, on', R.gpu, '- profile', R.profile, 'room', R.room || 'shed', 'preset', R.preset);
    if (R.hardTimeout) fail(EXIT.boot, 'the boot\'s watchdog lifted the loading screen before the chain ended');
    await C.ev('(() => { for (const x of document.querySelectorAll(".dfClose")) try { x.click(); } catch (e) {} return 1; })()');
    await frames(3);

    const doc = await C.cmd('DOM.getDocument', { depth: 0 });
    const fileNode = (await C.cmd('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '#gFile' })).result.nodeId;
    if (!fileNode) throw Object.assign(new Error('no #gFile on the page (the fleet\'s Import)'), { code: EXIT.run });

    for (const file of o.builds) {
      const tb = Date.now(), base = path.basename(file).replace(/\.json$/i, '');
      const BR = { file, views: [] }; R.builds.push(BR);
      // THE USER'S DOOR: the fleet's Import input, a real file - garage.js readFile -> unwrap -> loadSpec
      const want = JSON.parse(fs.readFileSync(file, 'utf8'));
      const wantCage = (want.spec && want.spec.cage) || {};
      const d0 = C.S.dialogs.length;
      await C.cmd('DOM.setFileInputFiles', { nodeId: fileNode, files: [path.resolve(file)] });
      const probe = 'JSON.stringify((() => { const s = GARAGE_SPEC.get(); return s && s.cage; })())';
      let same = 0, keys = Object.keys(wantCage).filter(k => typeof wantCage[k] === 'number');
      for (let i = 0; ; i++) {
        await sleep(1000);
        if (C.S.dialogs.length > d0) break;
        let got = {}; try { got = JSON.parse(await C.ev(probe, 60000)) || {}; } catch (e) {}
        same = keys.filter(k => typeof got[k] === 'number' && Math.abs(got[k] - wantCage[k]) <= 1e-6 * Math.max(1, Math.abs(wantCage[k]))).length;
        if (keys.length && same / keys.length >= 0.9) break;
        if (i > 120 || left() <= 0) break;
      }
      BR.cageRows = keys.length; BR.cageSame = same;
      if (C.S.dialogs.length > d0) { fail(EXIT.build, base + ': the import said "' + C.S.dialogs.slice(d0).join(' / ') + '"'); continue; }
      if (!keys.length || same / keys.length < 0.9) { fail(EXIT.build, base + ': the page\'s build is not the file\'s (' + same + ' of ' + keys.length + ' cage rows equal)'); continue; }
      // the build settles: its box the same over two looks a few frames apart (the join's second round, the floats' datum)
      const box = '(() => { const o = window.CAGE_UI_SCENE; if (!o || typeof THREE === "undefined") return null; const b = new THREE.Box3().setFromObject(o); return b.isEmpty() ? null : [b.min.toArray(), b.max.toArray()].flat().map(v => +v.toFixed(3)); })()';
      let prev = null;
      for (let i = 0; i < 20; i++) { await frames(3); const b = await J(box); if (b && prev && b.join() === prev.join()) break; prev = b; }
      BR.box = prev; BR.t = +((Date.now() - tb) / 1000).toFixed(1);
      log(base, 'loaded in', BR.t + ' s,', same + '/' + keys.length, 'cage rows equal, box', JSON.stringify(prev));

      for (const v of o.views) {
        const tv = Date.now(), name = v.replace(/[:/]/g, '-');
        const VR = { view: v }; BR.views.push(VR);
        try {
          let asked = null;
          if (PRESET[v]) {
            const label = PRESET[v][0];
            // the doors in order: the top bar's VIEWS button (PHONE-GARAGE G3724), the camera flyout's pill (the rail's,
            // built when it was opened), else the preset's own numbers through the probe (no interior that way)
            VR.door = await C.ev('(async () => {' +
              ' const b = document.querySelector(".edQuickBtn[data-q=views]"), lab = ' + JSON.stringify(label) + ';' +
              ' if (b) { for (let i = 0; i < 7; i++) { b.click(); await new Promise(r => setTimeout(r, 50)); if ((b.title || "").startsWith("View: " + lab + " ")) return "views button"; } }' +
              ' const p = [...document.querySelectorAll(".edCam button.pill")].find(x => x.textContent.trim() === lab && !x.disabled); if (p) { p.click(); return "camera pill"; }' +
              ' return null; })()');
            if (!VR.door) {
              if (v === 'i') throw Object.assign(new Error('no door to the interior here (no VIEWS button, no camera pill - or no pilot)'), { code: EXIT.eye });
              await C.ev('(() => { FLIGHT_PROBE.pan(0, 0, 0); FLIGHT_PROBE.camSet(' + PRESET[v].slice(1).join(', ') + '); return 1; })()');
              VR.door = 'probe';
            }
            if (v !== 'i') asked = PRESET[v].slice(1);
          } else if (/^(orbit|close):/.test(v)) {
            const [a, e, d] = v.replace(/^\w+:/, '').split('/').map(Number);
            if (![a, e, d].every(isFinite)) throw Object.assign(new Error('orbit:<az>/<el>/<dist> wants three numbers: ' + v), { code: EXIT.run });
            asked = [a * Math.PI / 180, e * Math.PI / 180, d];
            await C.ev('(() => { FLIGHT_PROBE.pan(0, 0, 0); FLIGHT_PROBE.camSet(' + asked.join(', ') + '); return 1; })()');
            VR.door = v.slice(0, v.indexOf(':')); if (VR.door === 'close') VR.close = true;
          } else if (/^part:/.test(v)) {
            // THE PART: the editor's own selection names its meshes (hiBuild's overlays, userData.edHi) - their box is
            // the part's; the selection goes back to the whole aeroplane before the still, so no highlight is in it
            const pk = v.slice(5);
            const pr = await J('(async () => { const P = window.CAGE_PARTS, q = ' + JSON.stringify(pk.toLowerCase()) + ';' +
              ' const part = P && (P.partByKey[' + JSON.stringify(pk) + '] || P.CAGE_PARTS.find(p => p.key.toLowerCase() === q || String(p.name || "").toLowerCase() === q));' +
              ' if (!part) return { err: "no part " + ' + JSON.stringify(pk) + ' + " (keys: " + (P ? P.CAGE_PARTS.map(p => p.key).join(", ") : "no CAGE_PARTS") + ")" };' +
              ' EDITOR_SELECT(part.key); for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r));' +
              ' const root = window.CAGE_UI_SCENE, b = new THREE.Box3(); root.traverse(o => { if (o.userData && o.userData.edHi && o.geometry) b.expandByObject(o); });' +
              ' EDITOR_SELECT("craft");' +
              ' if (b.isEmpty()) return { err: "part " + part.key + " drew nothing in this build" };' +
              ' FLIGHT_PROBE.pan(0, 0, 0); FLIGHT_PROBE.camSettle(); await new Promise(r => requestAnimationFrame(r));' +
              ' const g = FLIGHT_PROBE.camGet(), c = b.getCenter(new THREE.Vector3()), r = b.getSize(new THREE.Vector3()).length() / 2;' +
              ' const vf = (g.fov || 40) * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * innerWidth / innerHeight), d = Math.max(0.6, r / (0.8 * Math.tan(Math.min(vf, hf) / 2)));' +   // the part ~80 % of the narrower side
              ' FLIGHT_PROBE.pan(c.x - g.target[0], c.y - g.target[1], c.z - g.target[2]); FLIGHT_PROBE.camSet(-2.5, 0.3, d);' +
              ' return { key: part.key, centre: c.toArray().map(x => +x.toFixed(3)), radius: +r.toFixed(3), asked: [-2.5, 0.3, d] }; })()');
            if (pr.err) throw Object.assign(new Error(pr.err), { code: EXIT.eye });
            Object.assign(VR, { part: pr.key, centre: pr.centre, radius: pr.radius });
            asked = pr.asked; VR.door = 'part';
          } else throw Object.assign(new Error('unknown view ' + v + ' (q, s, t, f, i, part:<key>, orbit:<az>/<el>/<dist>, close:<az>/<el>/<dist>)'), { code: EXIT.run });
          await C.ev('(() => { FLIGHT_PROBE.camSettle(); return 1; })()');
          await frames(4);
          // THE EYE: where it is, against where it was told to be
          const g = await J('FLIGHT_PROBE.camGet()');
          VR.eye = { az: +g.az.toFixed(4), el: +g.el.toFixed(4), dist: +g.dist.toFixed(3), target: g.target.map(x => +x.toFixed(3)) };
          if (asked) {
            VR.asked = asked.map(x => +x.toFixed(4));
            const off = [Math.abs(g.az - asked[0]), Math.abs(g.el - asked[1]), Math.abs(g.dist - asked[2]) / asked[2]];
            if (off[0] > 0.01 || off[1] > 0.01 || off[2] > 0.05)
              throw Object.assign(new Error('eye not where asked: az/el/dist ' + VR.asked.join('/') + ', got ' + [VR.eye.az, VR.eye.el, VR.eye.dist].join('/') + ' (a clamp?)'), { code: EXIT.eye });
          }
          // THE STILL: THE GAME'S OWN SCREENSHOT MODE (G255 / G317, SHOT_MODE: the panels away, the CG and neutral-point
          // posts, the canopy's loops and the selection's highlight dark), then the 3D canvas alone, whatever is left over it hidden
          if (!o.keepUi) { await C.ev('(() => { if (window.SHOT_MODE) SHOT_MODE.enter(); return 1; })()'); await frames(3); }
          const clip = await J('(() => { const c = document.getElementById("c"); const r = c.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height), scale: 1 }; })()');
          if (!o.keepUi) await C.ev('(() => { const c = document.getElementById("c"); window.__shotHid = []; for (const e of document.body.querySelectorAll("*")) { if (e === c || e.contains(c) || e.closest("svg") && e.tagName !== "svg") continue; if (getComputedStyle(e).visibility !== "hidden") { window.__shotHid.push([e, e.style.visibility]); e.style.setProperty("visibility", "hidden", "important"); } } return window.__shotHid.length; })()');
          await frames(2);
          const shotA = (await C.cmd('Page.captureScreenshot', { format: 'png', clip })).result.data;
          await C.ev('(() => { window.CAGE_UI_SCENE.visible = false; return 1; })()');
          await frames(3);
          const shotB = (await C.cmd('Page.captureScreenshot', { format: 'png', clip })).result.data;
          await C.ev('(() => { window.CAGE_UI_SCENE.visible = true; for (const [e, v] of (window.__shotHid || [])) { e.style.removeProperty("visibility"); if (v) e.style.visibility = v; } window.__shotHid = []; if (window.SHOT_MODE && SHOT_MODE.on) SHOT_MODE.exit(); return 1; })()');
          const P = await J('(' + ANALYSE + ')(' + JSON.stringify(shotA) + ', ' + JSON.stringify(shotB) + ')', 180000);
          VR.picture = P;
          // a frame that fails its check is kept beside the good ones as <name>_FAIL.png - a failure you can look at
          const bad = why => { const f = path.join(o.out, base + '_' + name + '_FAIL.png'); fs.writeFileSync(f, Buffer.from(shotA, 'base64')); VR.failPng = f; return why; };
          if (P.topShare > 0.97) throw Object.assign(new Error(bad('the still is one flat colour (' + (100 * P.topShare).toFixed(1) + ' %)')), { code: EXIT.frame });
          if (!(P.craftShare > 0.02)) throw Object.assign(new Error(bad('the aeroplane is not in the frame (hiding it changes ' + (100 * (P.craftShare || 0)).toFixed(2) + ' % of the pixels)')), { code: EXIT.frame });
          if (P.cut && P.cut.length && !VR.part && !VR.close && v !== 'i') throw Object.assign(new Error(bad('the aeroplane is cut off at the ' + P.cut.join(' and ') + ' edge')), { code: EXIT.frame });
          const out = path.join(o.out, base + '_' + name + '.png');
          fs.writeFileSync(out, Buffer.from(shotA, 'base64'));
          VR.png = out; VR.t = +((Date.now() - tv) / 1000).toFixed(1);
          log(base, v, 'ok', VR.t + ' s,', 'aeroplane', (100 * P.craftShare).toFixed(1) + ' % of', P.w + 'x' + P.h, '->', path.relative(process.cwd(), out));
        } catch (e) {
          VR.t = +((Date.now() - tv) / 1000).toFixed(1); VR.fail = e.message;
          fail(e.code || EXIT.run, base + ' ' + v + ': ' + e.message);
          try { await C.ev('(() => { if (window.SHOT_MODE && SHOT_MODE.on) SHOT_MODE.exit(); if (window.CAGE_UI_SCENE) CAGE_UI_SCENE.visible = true; for (const [e, v] of (window.__shotHid || [])) { e.style.removeProperty("visibility"); if (v) e.style.visibility = v; } window.__shotHid = []; return 1; })()'); } catch (x) {}
        }
      }
    }
  } catch (e) {
    fail(e.code || EXIT.run, e.message);
  } finally {
    if (C) { R.errors = C.S.exc.slice(); R.dialogs = C.S.dialogs.slice(); try { await C.close(); } catch (e) {} }
    if (B) { try { B.proc.kill(); } catch (e) {} if (process.platform === 'win32') try { execSync('taskkill /PID ' + B.proc.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {}
             await sleep(1500); try { fs.rmSync(B.udd, { recursive: true, force: true }); } catch (e) {} }
    try { serve.kill(); } catch (e) {}
  }
  if (R.errors.length) fail(EXIT.page, 'page errors: ' + R.errors.slice(0, 3).join(' | '));
  R.t.all = +((Date.now() - T0) / 1000).toFixed(1);
  return R;
}

// ---- --pair: the composites (A | B, labelled), drawn in the same headless browser ------------------------------------
async function pair(dirA, dirB, out, labels, chrome) {
  const names = fs.readdirSync(dirA).filter(f => /\.png$/i.test(f) && fs.existsSync(path.join(dirB, f)));
  if (!names.length) throw Object.assign(new Error('no PNG is in both ' + dirA + ' and ' + dirB), { code: EXIT.run });
  const B = await launch(chrome, false, [800, 600]);
  const C = await connect(B.port);
  try {
    for (const f of names) {
      const a = fs.readFileSync(path.join(dirA, f)).toString('base64'), b = fs.readFileSync(path.join(dirB, f)).toString('base64');
      const png = await C.ev('(async () => { const img = s => new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = "data:image/png;base64," + s; });' +
        ' const A = await img(' + JSON.stringify(a) + '), Bi = await img(' + JSON.stringify(b) + '), H = 28, G = 8;' +
        ' const c = document.createElement("canvas"); c.width = A.width + G + Bi.width; c.height = H + Math.max(A.height, Bi.height);' +
        ' const g = c.getContext("2d"); g.fillStyle = "#1a1816"; g.fillRect(0, 0, c.width, c.height); g.drawImage(A, 0, H); g.drawImage(Bi, A.width + G, H);' +
        ' g.fillStyle = "#e8ded0"; g.font = "16px sans-serif"; g.fillText(' + JSON.stringify(labels[0] + ' - ' + f) + ', 8, 19); g.fillText(' + JSON.stringify(labels[1]) + ', A.width + G + 8, 19);' +
        ' return c.toDataURL("image/png").split(",")[1]; })()', 120000);
      const to = path.join(out, f.replace(/\.png$/i, '_pair.png'));
      fs.writeFileSync(to, Buffer.from(png, 'base64'));
      log('pair', f, '->', path.relative(process.cwd(), to));
    }
  } finally {
    try { await C.close(); } catch (e) {}
    try { B.proc.kill(); } catch (e) {} if (process.platform === 'win32') try { execSync('taskkill /PID ' + B.proc.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {}
    await sleep(1000); try { fs.rmSync(B.udd, { recursive: true, force: true }); } catch (e) {}
  }
  return names.length;
}

// ---- main ------------------------------------------------------------------------------------------------------------
(async () => {
  const out = path.resolve(opt('out', 'plane_shots'));
  const chrome = findChrome();
  const bail = (code, why) => { console.log('FAIL ' + why); console.log('PLANE_SHOT ' + JSON.stringify({ ok: false, code, why })); process.exit(code); };
  if (flag('pair')) {
    const i = argv.indexOf('--pair'), dirA = argv[i + 1], dirB = argv[i + 2];
    if (!dirA || !dirB || !fs.existsSync(dirA) || !fs.existsSync(dirB)) bail(EXIT.run, '--pair <dirA> <dirB>: both directories must exist');
    if (!chrome) bail(EXIT.browser, 'no Chromium here (--chrome <path>, or the cloud image\'s /opt/node-tools playwright)');
    fs.mkdirSync(out, { recursive: true });
    try { const n = await pair(dirA, dirB, out, (opt('labels', 'SwiftShader,graphics card')).split(','), chrome); console.log('PLANE_SHOT ' + JSON.stringify({ ok: true, pairs: n, out })); process.exit(0); }
    catch (e) { bail(e.code || EXIT.run, e.message); }
  }
  const builds = (opt('build', '') || '').split(',').filter(Boolean);
  const size = (opt('size', '1920x1080')).split('x').map(Number);
  const o = {
    builds, out, size, chrome, gpu: flag('gpu'), page: opt('page', 'index.html'), secs: +opt('secs', 1500),
    views: (opt('views', 'q,s,t,f')).split(',').filter(Boolean), keepUi: flag('keep-ui'), fallback: opt('fallback', null),
    root: path.resolve(opt('root', REPO)),
  };
  // the arguments, before anything is launched (--dry stops here)
  if (!builds.length) bail(EXIT.run, '--build <file.json>[,<file2.json>]: which aeroplane(s)');
  for (const b of builds) {
    if (!fs.existsSync(b)) bail(EXIT.build, 'no such build file: ' + b);
    let j = null; try { j = JSON.parse(fs.readFileSync(b, 'utf8')); } catch (e) { bail(EXIT.build, b + ' is not JSON: ' + e.message); }
    if (!j || j.what !== 'flydiy-build' || !j.spec || !j.spec.cage) bail(EXIT.build, b + ' is not a flyDiy build (what: ' + (j && j.what) + ')');
  }
  for (const v of o.views) if (!PRESET[v] && !/^part:./.test(v) && !/^(orbit|close):[-\d.]+\/[-\d.]+\/[\d.]+$/.test(v)) bail(EXIT.run, 'unknown view ' + v + ' (q, s, t, f, i, part:<key>, orbit:<az>/<el>/<dist>, close:<az>/<el>/<dist>)');
  if (!(size.length === 2 && size.every(n => n >= 200 && n <= 4096))) bail(EXIT.run, '--size WxH (200-4096)');
  if (!fs.existsSync(path.join(o.root, 'flyDiy', o.page))) bail(EXIT.run, 'no page ' + o.page + ' in ' + path.join(o.root, 'flyDiy') + (o.page === 'index.html' ? ' (not built? --page dev.html)' : ''));
  if (!chrome) bail(EXIT.browser, 'no Chromium here (--chrome <path>, or the cloud image\'s /opt/node-tools playwright)');
  log('plane_shot:', builds.length, 'build(s) x', o.views.join(','), 'at', size.join('x'), o.gpu ? 'on the graphics card' : 'on SwiftShader', 'with', chrome);
  if (flag('dry')) { console.log('PLANE_SHOT ' + JSON.stringify({ ok: true, dry: true, chrome, builds, views: o.views, size, page: o.page })); process.exit(0); }
  fs.mkdirSync(out, { recursive: true });
  o.servePort = +opt('port', 0) || await freePort();
  const R = await shoot(o);
  const code = R.fails.length ? Math.min(...R.fails.map(f => f.code)) : 0;
  console.log('PLANE_SHOT ' + JSON.stringify(Object.assign({ ok: !code, code }, R)));
  process.exit(code);
})().catch(e => { console.log('FAIL ' + (e && e.stack || e)); process.exit(EXIT.run); });
