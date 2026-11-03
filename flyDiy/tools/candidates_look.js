#!/usr/bin/env node
// candidates_look.js - THE CANDIDATE OFFICIAL POOL, LOOKED AT IN THE PAGE (CANDIDATES-LOOK, an evidence tool, 3 Nov 2026)
// NOT a gate (not in run_gates.js): pictures and a few asserted behaviours, for a report.
//
// The rig is plane_shot.js's (serve + raw CDP + the phone profile's garage on SwiftShader, the asserted still); its
// browser, CDP and picture code is copied here, not required (plane_shot.js runs its main on load). Per viewport:
//   1 RACK   the fleet rack (#gFleet, via the name menu's LOAD) with its UI: the candidate group's rows (.gfCandRow) are
//            index.json's names, in index order - a still of the group
//   2 OFFER  each offered candidate, clicked in the rack: no alert, no page error, the page's spec is the file's
//            (meta.name equal, >= 90 % of the cage rows equal - plane_shot's import check), the build in frame
//            (plane_shot's frame asserts) - a 3/4 front (q) still with the UI hidden
//   3 CARDS  the NEW overlay (#gNew -> design_flow.js renderBirth): a still of the .dfCandH heading and the .dfArch.dfCand
//            cards (names = index, in order); the DC-3-alike card clicked and asserted as in 2
//   4 EXPORT two builds saved through the page's own Save As (its prompt answered), #gExportAll's download caught
//            (Browser.setDownloadBehavior): {what:'flydiy-fleet', v:1, builds: one per saved slot}; that file imported
//            through #gFile: the alert must start 'That is an "export all" file'
//
//   5 REVIEW (--review a.json,b.json): each file through the fleet's Import (#gFile) - no alert, the spec the file's -
//            q and s stills (plane_shot.js's job, here with &idle=0: plane_shot.js's own URL has no idle=0, and the
//            phone's idle hold, PHONE-EDIT-PERF 2 Nov, holds the canvas so its build-hidden frame equals the still)
//   node flyDiy/tools/candidates_look.js --out <dir> [--sizes 1280x800,360x800] [--secs 5400] [--page index.html]
//        [--review <file.json>[,<file2.json>]] [--sizes 1920x1080]
//   -> <out>/rack/, <out>/cards/, <out>/offered/ (JPG q85) and <out>/look_<W>x<H>.json (every assert, every page error
//      verbatim, the renderer string). Never read a frame time off SwiftShader.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const FLY = path.resolve(__dirname, '..');
const REPO = path.resolve(FLY, '..');
const CAND = path.join(FLY, 'builds', 'candidates');
const T0 = Date.now();
const log = (...a) => console.log('[' + ((Date.now() - T0) / 1000).toFixed(1).padStart(7) + ' s]', ...a);
const PRESET = { q: ['3/4 front', -2.5, 0.25, 12], s: ['side', -Math.PI / 2, 0.06, 13] };   // plane_shot.js PRESET (app.js camera(k))

function findChrome() {
  for (const p of ['playwright', '/opt/node-tools/node_modules/playwright', 'playwright-core']) {
    try { const x = require(p).chromium.executablePath(); if (x && fs.existsSync(x)) return x; } catch (e) {}
  }
  return ['/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(p => fs.existsSync(p) && fs.statSync(p).isFile()) || null;
}
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });

async function launch(chrome, size) {
  const port = await freePort();
  const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'candlook_'));
  const args = ['--remote-debugging-port=' + port, '--user-data-dir=' + udd, '--no-first-run', '--no-default-browser-check',
    '--ignore-gpu-blocklist', '--window-size=' + size[0] + ',' + size[1], '--window-position=0,0', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--hide-scrollbars',
    '--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage', 'about:blank'];
  const proc = spawn(chrome, args, { stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try { const v = await (await fetch('http://127.0.0.1:' + port + '/json/version')).json(); if (v) return { proc, port, udd, ver: v }; } catch (e) {}
    await sleep(500);
  }
  try { proc.kill(); } catch (e) {}
  throw new Error('the browser never opened its DevTools port');
}

// a CDP session on one websocket (a page, or the browser itself)
function session(wsUrl, onEvent) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0; const waits = new Map(); const st = { closed: false };
    const cmd = (method, params) => st.closed ? Promise.resolve({ error: { message: 'closed' } })
      : new Promise(r => { const i = ++id; waits.set(i, r); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); } else if (m.method && onEvent) onEvent(m, cmd); };
    ws.onclose = () => { st.closed = true; for (const f of waits.values()) f({ error: { message: 'closed' } }); waits.clear(); };
    ws.onopen = () => resolve({ cmd, ws, st });
    ws.onerror = reject;
  });
}

async function connect(port) {
  const base = 'http://127.0.0.1:' + port;
  const tab = await (await fetch(base + '/json/new?about:blank', { method: 'PUT' })).json();
  // S.exc: every uncaught exception VERBATIM (its whole description); S.dialogs: every alert / prompt / confirm, answered
  // (a prompt with the next of S.prompts, else its default) and never left blocking; S.console: console errors (info)
  const S = { crashed: false, exc: [], dialogs: [], prompts: [], console: [] };
  const P = await session(tab.webSocketDebuggerUrl, (m, cmd) => {
    if (m.method === 'Inspector.targetCrashed') S.crashed = true;
    if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; S.exc.push(((d.exception || {}).description || d.text || '') + (d.url ? ' @ ' + d.url + ':' + d.lineNumber + ':' + d.columnNumber : '')); }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') S.console.push(m.params.args.map(a => a.value != null ? String(a.value) : (a.description || '')).join(' ').slice(0, 400));
    if (m.method === 'Page.javascriptDialogOpening') {
      const p = m.params; S.dialogs.push({ type: p.type, message: p.message });
      const ans = { accept: true }; if (p.type === 'prompt') ans.promptText = S.prompts.length ? S.prompts.shift() : (p.defaultPrompt || '');
      cmd('Page.handleJavaScriptDialog', ans);
    }
  });
  const cmd = P.cmd;
  const ev = async (expr, ms = 120000) => {
    const r = await Promise.race([cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }), sleep(ms).then(() => ({ error: { message: 'timeout after ' + ms + ' ms' } }))]);
    if (r.error) throw new Error(r.error.message);
    const d = r.result; if (d.exceptionDetails) throw new Error((d.exceptionDetails.exception || {}).description || d.exceptionDetails.text);
    return d.result.value;
  };
  for (const d of ['Page.enable', 'Runtime.enable', 'Inspector.enable', 'DOM.enable']) await cmd(d);
  return { cmd, ev, S, close: async () => { try { await fetch(base + '/json/close/' + tab.id); } catch (e) {} } };
}

// plane_shot.js's ANALYSE, verbatim: the flat-colour share and the build-hidden difference (share, box, cut edges)
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
const TO_JPEG = `async (src) => { const i = await new Promise((res, rej) => { const x = new Image(); x.onload = () => res(x); x.onerror = rej; x.src = 'data:image/png;base64,' + src; });
  const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; c.getContext('2d').drawImage(i, 0, 0); return c.toDataURL('image/jpeg', 0.85).split(',')[1]; }`;

async function look(o, size) {
  const tag = size.join('x');
  const R = { size: tag, stills: [], asserts: [], errors: [], dialogs: [], console: [], t: {} };
  const ok = (step, what, pass, detail) => { R.asserts.push({ step, what, pass: !!pass, detail: detail == null ? '' : detail }); log((pass ? 'PASS ' : 'FAIL ') + step + ' ' + what + (detail ? ' - ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); return !!pass; };
  const servePort = await freePort();
  const serve = spawn(process.execPath, [path.join(FLY, 'tools', '_serve.js'), String(servePort), REPO], { stdio: 'ignore' });
  const dl = fs.mkdtempSync(path.join(os.tmpdir(), 'candlook_dl_'));
  let B = null, C = null, BR = null;
  const stop = Date.now() + o.secs * 1000;
  try {
    B = await launch(o.chrome, size);
    R.browser = B.ver.Browser;
    BR = await session(B.ver.webSocketDebuggerUrl);
    C = await connect(B.port);
    await C.cmd('Page.addScriptToEvaluateOnNewDocument', { source:
      'window.__shotFrames=0;(function t(){window.__shotFrames++;requestAnimationFrame(t)})();' +
      'document.addEventListener("DOMContentLoaded",()=>{const s=document.createElement("style");s.textContent="*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}";document.head.appendChild(s);});' });
    await C.cmd('Emulation.setDeviceMetricsOverride', { width: size[0], height: size[1], deviceScaleFactor: 1, mobile: false });
    const J = async (e, ms) => JSON.parse(await C.ev('(async () => JSON.stringify(await (' + e + ')))()', ms));
    const until = async (what, expr, every = 1000, ms) => {
      const end = ms ? Math.min(stop, Date.now() + ms) : stop;
      for (;;) {
        let v = null; try { v = await C.ev(expr, 60000); } catch (e) { v = null; }
        if (v) return v;
        if (C.S.crashed) throw new Error('the page crashed waiting for ' + what);
        if (Date.now() > end) throw new Error('timed out waiting for ' + what);
        await sleep(every);
      }
    };
    const frames = async n => { const f0 = await C.ev('window.__shotFrames || 0'); await until(n + ' frames', '(window.__shotFrames || 0) >= ' + (f0 + n), 300); };
    const pageShot = async (sub, name, what, asserts) => {
      const data = (await C.cmd('Page.captureScreenshot', { format: 'jpeg', quality: 85 })).result.data;
      const f = path.join(o.out, sub, tag + '_' + name + '.jpg'); fs.writeFileSync(f, Buffer.from(data, 'base64'));
      R.stills.push({ file: path.relative(o.out, f), what, asserts }); log('still', path.relative(process.cwd(), f));
    };

    const url = 'http://localhost:' + servePort + '/flyDiy/' + o.page + '?profile=phone&gfx=laptop&intro=0&phmat=full&idle=0';
    R.url = url.replace(/localhost:\d+/, 'localhost:<port>');
    log(tag, 'page', url);
    await C.cmd('Page.navigate', { url });
    await until('the garage', '!!(window.BOOT && BOOT.state === "gone" && BOOT.set === "garage" && BOOT.stepI >= (BOOT.steps || []).length && !BOOT.current && window.FLIGHT_PROBE && window.CAGE_UI && window.GARAGE_SPEC)', 2000);
    R.t.boot = +((Date.now() - T0) / 1000).toFixed(1);
    Object.assign(R, await J('(() => { const g = window.FLYDIY_RENDERER && FLYDIY_RENDERER.getContext(); let gpu = null; try { const d = g.getExtension("WEBGL_debug_renderer_info"); gpu = d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); } catch (e) {}' +
      ' return { gpu, profile: window.PROFILE && PROFILE.name, idleOn: !!window.FLYDIY_IDLE }; })()'));
    log(tag, 'garage up on', R.gpu, '- profile', R.profile, 'idle hold', R.idleOn);
    await C.ev('(() => { for (const x of document.querySelectorAll(".dfClose")) try { x.click(); } catch (e) {} return 1; })()');
    await frames(3);
    const doc = await C.cmd('DOM.getDocument', { depth: 0 });
    const fileNode = (await C.cmd('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '#gFile' })).result.nodeId;

    const index = JSON.parse(fs.readFileSync(path.join(CAND, 'index.json'), 'utf8')).planes;
    const menu = id => C.ev('(() => { const n = document.getElementById("fbName"), b = document.getElementById(' + JSON.stringify(id) + ');' +
      ' if (!n || !b) return "missing " + (!n ? "#fbName" : "#' + id + '"); n.click(); const shown = !!b.getClientRects().length; b.click(); return shown ? "menu" : "menu (item not on screen)"; })()');
    const openRack = async () => {
      const how = await menu('gLoad');
      await until('the candidate rows', '(() => { const f = document.getElementById("gFleet"); return !!(f && !f.hidden && f.querySelectorAll(".gfCandRow").length >= ' + index.length + '); })()', 500, 60000);
      return how;
    };

    // the q view and its asserted still (plane_shot.js's view + frame asserts); returns the list of failures
    const qStill = async (sub, name, what, pre, view = 'q') => {
      const PRESET_Q = PRESET[view];
      const fails = [];
      const box = '(() => { const o = window.CAGE_UI_SCENE; if (!o || typeof THREE === "undefined") return null; const b = new THREE.Box3().setFromObject(o); return b.isEmpty() ? null : [b.min.toArray(), b.max.toArray()].flat().map(v => +v.toFixed(3)); })()';
      let prev = null;
      for (let i = 0; i < 20; i++) { await frames(3); const b = await J(box); if (b && prev && b.join() === prev.join()) break; prev = b; }
      const door = await C.ev('(async () => { const b = document.querySelector(".edQuickBtn[data-q=views]"), lab = ' + JSON.stringify(PRESET_Q[0]) + ';' +
        ' if (b) { for (let i = 0; i < 7; i++) { b.click(); await new Promise(r => setTimeout(r, 50)); if ((b.title || "").startsWith("View: " + lab + " ")) return "views button"; } }' +
        ' const p = [...document.querySelectorAll(".edCam button.pill")].find(x => x.textContent.trim() === lab && !x.disabled); if (p) { p.click(); return "camera pill"; }' +
        ' FLIGHT_PROBE.pan(0, 0, 0); FLIGHT_PROBE.camSet(' + PRESET_Q.slice(1).join(', ') + '); return "probe"; })()');
      await C.ev('(() => { FLIGHT_PROBE.camSettle(); return 1; })()');
      await frames(4);
      const g = await J('FLIGHT_PROBE.camGet()');
      const off = [Math.abs(g.az - PRESET_Q[1]), Math.abs(g.el - PRESET_Q[2]), Math.abs(g.dist - PRESET_Q[3]) / PRESET_Q[3]];
      if (off[0] > 0.01 || off[1] > 0.01 || off[2] > 0.05) fails.push('eye not where asked: az/el/dist ' + PRESET_Q.slice(1).join('/') + ', got ' + [g.az, g.el, g.dist].map(x => +x.toFixed(4)).join('/'));
      await C.ev('(() => { if (window.SHOT_MODE) SHOT_MODE.enter(); return 1; })()'); await frames(3);
      const clip = await J('(() => { const c = document.getElementById("c"); const r = c.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height), scale: 1 }; })()');
      await C.ev('(() => { const c = document.getElementById("c"); window.__shotHid = []; for (const e of document.body.querySelectorAll("*")) { if (e === c || e.contains(c) || e.closest("svg") && e.tagName !== "svg") continue; if (getComputedStyle(e).visibility !== "hidden") { window.__shotHid.push([e, e.style.visibility]); e.style.setProperty("visibility", "hidden", "important"); } } return window.__shotHid.length; })()');
      await frames(2);
      const shotA = (await C.cmd('Page.captureScreenshot', { format: 'png', clip })).result.data;
      await C.ev('(() => { window.CAGE_UI_SCENE.visible = false; return 1; })()'); await frames(3);
      const shotB = (await C.cmd('Page.captureScreenshot', { format: 'png', clip })).result.data;
      await C.ev('(() => { window.CAGE_UI_SCENE.visible = true; for (const [e, v] of (window.__shotHid || [])) { e.style.removeProperty("visibility"); if (v) e.style.visibility = v; } window.__shotHid = []; if (window.SHOT_MODE && SHOT_MODE.on) SHOT_MODE.exit(); return 1; })()');
      const P = await J('(' + ANALYSE + ')(' + JSON.stringify(shotA) + ', ' + JSON.stringify(shotB) + ')', 180000);
      if (P.topShare > 0.97) fails.push('the still is one flat colour (' + (100 * P.topShare).toFixed(1) + ' %)');
      if (!(P.craftShare > 0.02)) fails.push('the aeroplane is not in the frame (hiding it changes ' + (100 * (P.craftShare || 0)).toFixed(2) + ' % of the pixels)');
      if (P.cut && P.cut.length) fails.push('the aeroplane is cut off at the ' + P.cut.join(' and ') + ' edge');
      const jpg = await C.ev('(' + TO_JPEG + ')(' + JSON.stringify(shotA) + ')', 120000);
      const f = path.join(o.out, sub, tag + '_' + name + '_' + view + (fails.length || pre.some(a => !a.pass) ? '_FAIL' : '') + '.jpg');
      fs.writeFileSync(f, Buffer.from(jpg, 'base64'));
      const asserts = pre.concat([{ what: 'in frame (eye, not flat, aeroplane > 2 %, not cut)', pass: !fails.length, detail: fails.join('; ') || ('aeroplane ' + (100 * P.craftShare).toFixed(1) + ' % of ' + P.w + 'x' + P.h + ', box ' + JSON.stringify(P.craftBox) + ', door ' + door) }]);
      R.stills.push({ file: path.relative(o.out, f), what, asserts, box: prev, picture: P });
      log('still', path.relative(process.cwd(), f), fails.length ? 'FAIL ' + fails.join('; ') : 'ok');
      return fails;
    };

    // a candidate clicked: no alert, no page error, the page's spec the file's; then its q still
    const loadCheck = async (step, c, clickExpr, sub, name, what, views = ['q']) => {
      const want = JSON.parse(fs.readFileSync(c.path || path.join(CAND, c.file), 'utf8'));
      const wantCage = (want.spec && want.spec.cage) || {}, keys = Object.keys(wantCage).filter(k => typeof wantCage[k] === 'number');
      const wantName = want.spec && want.spec.meta && want.spec.meta.name;
      const d0 = C.S.dialogs.length, e0 = C.S.exc.length, tb = Date.now();
      const clicked = typeof clickExpr === 'function' ? await clickExpr() : await C.ev(clickExpr);
      let same = 0, got = {};
      for (let i = 0; ; i++) {
        await sleep(1000);
        if (C.S.dialogs.length > d0) break;
        try { got = JSON.parse(await C.ev('JSON.stringify((() => { const s = GARAGE_SPEC.get(); return s ? { cage: s.cage, name: s.meta && s.meta.name, slot: GARAGE_SPEC.name() } : null; })())', 60000)) || {}; } catch (e) { got = {}; }
        const gc = got.cage || {};
        same = keys.filter(k => typeof gc[k] === 'number' && Math.abs(gc[k] - wantCage[k]) <= 1e-6 * Math.max(1, Math.abs(wantCage[k]))).length;
        if (keys.length && same / keys.length >= 0.9) break;
        if (i > 240 || Date.now() > stop) break;
      }
      await frames(3);
      const pre = [];
      const dl2 = C.S.dialogs.slice(d0), ex2 = C.S.exc.slice(e0);
      pre.push({ what: c.path ? 'imported through #gFile' : 'clicked', pass: clicked === true, detail: String(clicked) });
      pre.push({ what: 'no alert', pass: !dl2.length, detail: dl2.map(d => d.type + ': ' + d.message).join(' / ') });
      pre.push({ what: 'no page error', pass: !ex2.length, detail: ex2.join(' | ') });
      pre.push({ what: 'spec name = file\'s (spec.meta.name)', pass: got.name === wantName, detail: JSON.stringify(got.name) + ' vs ' + JSON.stringify(wantName) + (got.slot ? ', slot ' + JSON.stringify(got.slot) : ', unnamed slot') });
      pre.push({ what: 'spec = file\'s (>= 90 % cage rows)', pass: keys.length > 0 && same / keys.length >= 0.9, detail: same + '/' + keys.length + ' in ' + ((Date.now() - tb) / 1000).toFixed(0) + ' s' });
      for (const a of pre) ok(step, c.file + ': ' + a.what, a.pass, a.detail);
      for (const v of views) {
        const fails = await qStill(sub, name, what.replace('3/4 front', PRESET[v][0]), pre, v);
        ok(step, c.file + ': in frame (' + v + ')', !fails.length, fails.join('; '));
      }
    };

    // ---- 5 REVIEW (--review): each file through the fleet's Import (#gFile), plane_shot.js's checks, q and s ----
    if (o.review) {
      for (const f of o.review) {
        const c = { file: path.basename(f), path: path.resolve(f) };
        try {
          await loadCheck('5', c, async () => { await C.cmd('DOM.setFileInputFiles', { nodeId: fileNode, files: [c.path] }); return true; },
            'review', c.file.replace(/\.json$/i, '').replace(/[^\w.()-]+/g, '_'), 'review file "' + c.file + '" imported through #gFile, 3/4 front, UI hidden', ['q', 's']);
        } catch (e) { ok('5', c.file, false, e.message); }
      }
    }
    if (!o.review) {          // steps 1-4 (a --review run is step 5 alone)
    // ---- 1 RACK ----
    try {
      const how = await openRack();
      const want = index.map(p => p.name || p.file);
      // the row's button (garage.js rowBtn) is <b>name</b><span>sub-label</span>
      const names = await J('[...document.querySelectorAll("#gFleet .gfCandRow")].map(r => { const b = r.querySelector("button") || r; return (b.querySelector("b") || b).textContent.trim(); })');
      const inOrder = names.length === want.length && names.every((n, i) => n === want[i]);
      ok('1', 'the candidate rows = index.json names, in order', inOrder, inOrder ? names.length + ' rows' : JSON.stringify(names) + ' vs ' + JSON.stringify(want));
      R.rackRows = names; R.rackDoor = how;
      await C.ev('(() => { const h = document.querySelector("#gFleet .gfCandH"); if (h) h.scrollIntoView({ block: "start" }); return 1; })()');
      await frames(2);
      await pageShot('rack', 'rack', 'the fleet rack, scrolled to the candidate group (UI shown)', [{ what: 'rows = index names in order', pass: inOrder, detail: names.join(' | ') }]);
      await C.ev('(() => { const r = document.querySelectorAll("#gFleet .gfCandRow"); if (r.length) r[r.length - 1].scrollIntoView({ block: "end" }); return 1; })()');
      await frames(2);
      await pageShot('rack', 'rack_end', 'the fleet rack, scrolled to its last candidate row (UI shown)', [{ what: 'rows = index names in order', pass: inOrder, detail: '' }]);
      await C.ev('(() => { const f = document.getElementById("gFleet"); const x = f && f.querySelector(".gfClose"); if (x) x.click(); return 1; })()');
    } catch (e) { ok('1', 'the rack', false, e.message); }

    // ---- 2 OFFER ----
    for (let i = 0; i < index.length; i++) {
      const c = index[i];
      try {
        await openRack();
        await loadCheck('2', c, '(() => { const r = document.querySelectorAll("#gFleet .gfCandRow")[' + i + ']; const b = r && (r.querySelector("button") || r); if (!b) return "no row ' + i + '"; b.click(); return true; })()',
          'offered', c.file.replace(/\.json$/i, ''), 'offered candidate "' + c.name + '" (' + c.file + ') clicked in the rack, 3/4 front, UI hidden');
      } catch (e) { ok('2', c.file, false, e.message); }
    }

    // ---- 3 CARDS ----
    try {
      await menu('gNew');
      await until('the candidate cards', '(() => { const b = document.getElementById("dfBirth"); return !!(b && !b.hidden && b.querySelector(".dfCandH") && b.querySelectorAll(".dfArch.dfCand").length >= ' + index.length + '); })()', 500, 60000);
      const cards = await J('[...document.querySelectorAll("#dfBirth .dfArch.dfCand")].map(b => (b.querySelector("b") || b).textContent.trim())');
      const want = index.map(p => p.name || p.file);
      const inOrder = cards.length === want.length && cards.every((n, i) => n === want[i]);
      ok('3', 'the candidate cards = index.json names, in order', inOrder, inOrder ? cards.length + ' cards' : JSON.stringify(cards) + ' vs ' + JSON.stringify(want));
      const head = await C.ev('(() => { const h = document.querySelector("#dfBirth .dfCandH"); if (!h) return null; h.scrollIntoView({ block: "start" }); return h.textContent; })()');
      ok('3', 'the .dfCandH heading', !!head, JSON.stringify(head));
      await frames(2);
      await pageShot('cards', 'cards', 'the NEW overlay, scrolled to the candidate heading and cards (UI shown)', [{ what: 'heading present', pass: !!head, detail: head || '' }, { what: 'cards = index names in order', pass: inOrder, detail: cards.join(' | ') }]);
      await C.ev('(() => { const c = document.querySelectorAll("#dfBirth .dfArch.dfCand"); if (c.length) c[c.length - 1].scrollIntoView({ block: "end" }); return 1; })()');
      await frames(2);
      await pageShot('cards', 'cards_end', 'the NEW overlay, scrolled to the last candidate card (UI shown)', [{ what: 'cards = index names in order', pass: inOrder, detail: '' }]);
      const dc3 = index.find(p => p.name === 'DC-3-alike');
      if (!ok('3', 'a DC-3-alike row in index.json', !!dc3)) throw new Error('no DC-3-alike');
      await loadCheck('3', dc3, '(() => { const b = [...document.querySelectorAll("#dfBirth .dfArch.dfCand")].find(x => (x.querySelector("b") || x).textContent.trim() === "DC-3-alike"); if (!b) return "no DC-3-alike card"; b.click(); return true; })()',
        'cards', 'dc3_card', 'the DC-3-alike card clicked in the NEW overlay, 3/4 front, UI hidden');
      ok('3', 'the overlay closed after the card', await C.ev('(() => { const b = document.getElementById("dfBirth"); return !b || b.hidden; })()'));
    } catch (e) { ok('3', 'the cards', false, e.message); }

    // ---- 4 EXPORT ALL ----
    try {
      const save = async (nm, slotWant) => {
        const d0 = C.S.dialogs.length;
        C.S.prompts.push(nm);
        const how = await menu('gSaveAs');
        await until('the save of ' + nm, '(() => { try { return Object.keys(localStorage).includes(' + JSON.stringify('flydiy.build.' + nm) + '); } catch (e) { return false; } })()', 500, 60000).catch(() => null);
        const dd = C.S.dialogs.slice(d0);
        const okSave = dd.length === 1 && dd[0].type === 'prompt' && await C.ev('Object.keys(localStorage).includes(' + JSON.stringify('flydiy.build.' + nm) + ')');
        ok('4', 'Save As "' + nm + '" through the name menu (' + how + ')', okSave, dd.map(d => d.type + ': ' + d.message).join(' / '));
      };
      // the stand holds the DC-3-alike (step 3); the second a Stearman-alike from the rack
      await save('candidates-look A');
      await openRack();
      const st = index.findIndex(p => p.file === 'stearman_2026-10.json');
      await loadCheck('4', index[st], '(() => { const r = document.querySelectorAll("#gFleet .gfCandRow")[' + st + ']; const b = r && (r.querySelector("button") || r); if (!b) return "no row"; b.click(); return true; })()',
        'offered', 'export_second_stearman', 'the second build to save: Stearman-alike from the rack, 3/4 front, UI hidden');
      await save('candidates-look B');
      const slots = await J('Object.keys(localStorage).filter(k => k.startsWith("flydiy.build.")).map(k => k.slice(13)).sort()');
      ok('4', 'at least 2 builds saved', slots.length >= 2, JSON.stringify(slots));
      await BR.cmd('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl, eventsEnabled: true });
      const d0 = C.S.dialogs.length;
      const how = await menu('gExportAll');
      let file = null;
      for (let i = 0; i < 90 && !file; i++) { await sleep(1000); file = fs.readdirSync(dl).find(f => /\.json$/i.test(f)) || null; }
      ok('4', '#gExportAll download caught (' + how + ')', !!file, file || ('nothing in ' + dl + (C.S.dialogs.length > d0 ? '; dialog: ' + C.S.dialogs.slice(d0).map(d => d.message).join(' / ') : '')));
      if (file) {
        const fp = path.join(dl, file);
        await sleep(500);
        let j = null; try { j = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch (e) { ok('4', 'the download is JSON', false, e.message); }
        if (j) {
          const bs = Array.isArray(j.builds) ? j.builds : null;
          const got = bs ? bs.map(b => b.slot).sort() : null;
          ok('4', 'what = "flydiy-fleet"', j.what === 'flydiy-fleet', JSON.stringify(j.what));
          ok('4', 'v = 1', j.v === 1, JSON.stringify(j.v));
          ok('4', 'builds: one per slot', !!bs && JSON.stringify(got) === JSON.stringify(slots) && bs.every(b => b && b.spec && b.spec.cage),
            bs ? 'slots ' + JSON.stringify(got) + ' vs localStorage ' + JSON.stringify(slots) + ', each with spec.cage: ' + bs.every(b => b && b.spec && b.spec.cage) : 'no builds array');
          R.exportFile = { name: file, bytes: fs.statSync(fp).size, keys: Object.keys(j), date: j.date, slots: got };
          const e0 = C.S.dialogs.length;
          await C.cmd('DOM.setFileInputFiles', { nodeId: fileNode, files: [fp] });
          for (let i = 0; i < 30 && C.S.dialogs.length === e0; i++) await sleep(500);
          const a = C.S.dialogs.slice(e0);
          ok('4', 'import of it: alert starts \'That is an "export all" file\'', a.length === 1 && a[0].type === 'alert' && a[0].message.startsWith('That is an "export all" file'), a.map(d => d.type + ': ' + d.message).join(' / ') || 'no dialog');
        }
      }
    } catch (e) { ok('4', 'export all', false, e.message); }
    }
  } catch (e) {
    ok('run', 'the run', false, e.message);
  } finally {
    if (C) { R.errors = C.S.exc.slice(); R.dialogs = C.S.dialogs.slice(); R.console = C.S.console.slice(0, 50); try { await C.close(); } catch (e) {} }
    if (B) { try { B.proc.kill(); } catch (e) {} await sleep(1500); try { fs.rmSync(B.udd, { recursive: true, force: true }); } catch (e) {} }
    try { serve.kill(); } catch (e) {}
    try { fs.rmSync(dl, { recursive: true, force: true }); } catch (e) {}
  }
  R.t.all = +((Date.now() - T0) / 1000).toFixed(1);
  return R;
}

(async () => {
  const out = path.resolve(opt('out', 'candidates_look'));
  const chrome = findChrome();
  if (!chrome) { console.log('FAIL no Chromium'); process.exit(2); }
  for (const d of ['rack', 'cards', 'offered', 'review']) fs.mkdirSync(path.join(out, d), { recursive: true });
  const o = { out, chrome, secs: +opt('secs', 5400), page: opt('page', 'index.html'), review: opt('review', null) ? opt('review').split(',') : null };
  let bad = 0;
  for (const s of opt('sizes', '1280x800,360x800').split(',')) {
    const size = s.split('x').map(Number);
    const R = await look(o, size);
    fs.writeFileSync(path.join(out, 'look_' + (o.review ? 'review_' : '') + s + '.json'), JSON.stringify(R, null, 1));
    const f = R.asserts.filter(a => !a.pass).length;
    bad += f + R.errors.length;
    console.log('CANDIDATES_LOOK ' + s + ' ' + (f ? 'FAIL' : 'PASS') + ' (' + (R.asserts.length - f) + '/' + R.asserts.length + ' asserts, ' + R.errors.length + ' page errors)');
  }
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('FAIL ' + (e && e.stack || e)); process.exit(1); });
