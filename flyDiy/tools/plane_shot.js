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
//                                 (G3800: an entry stock:<name> is the garage's own stock design, e.g. 'stock:piper cub')
//                                 (PLANE-RENDERS R1: arch:<key> a design card's plane, as the new-aeroplane card bakes it)
//        [--views q,s,t,f]        the editor's own framing presets: q 3/4 front, s side, t plan, f nose, i interior
//                                 (with a pilot), part:<key or name> a close-up of one part (the tree's key, e.g. wing,
//                                 or its name), orbit:<az>/<el>/<dist> (deg, deg, m), close:<az>/<el>/<dist> the same
//                                 meant close (no cut-off check: a detail - the slot, the VG row - is cut by design),
//                                 fit:<key>/<az>/<el>/<dist> one placed fitting close (the flank facing the eye; under
//                                 ~0.8 m the camera's near plane cuts the skin), at:<x>/<y>/<z>/<az>/<el>/<dist> a point
//                                 of the layers' frame (metres) close, one framing for two builds,
//                                 tw:<az>/<el>/<dist> the eye on the drawn tail contact (G3800) -
//                                 default q,s,t,f
//        [--views hero:<yaw>/<el>/<fov>,profile]  PORTRAITS (2 Nov): the level airframe from <yaw> deg off the nose
//                                 (to its left), <el> deg above the chord (negative: below), a <fov> deg lens (then,
//                                 optional, /<fill> the aeroplane's share of the frame, default 0.84 - <fill>c: of the
//                                 inscribed circle instead, a maskable icon's safe zone - and /<W>x<H> the still's
//                                 own size - e.g. hero:38/-12/35/0.7/1024x1024 for an app icon's square); profile[/<fill>
//                                 [/<W>x<H>]] the left side (the thumbnail); board:<fov>/<height> THE PLANE BOARD - the
//                                 hero (yaw 38, el -12 or as asked, the lens) at 5:4 (or as asked) and a column of side / plan /
//                                 front at one scale; cuts:<fov>/<side px>[/<el>[/<aspect>]] the four views matted alone; the left
//                                 side, orthographic - drawn by the page's renderer at --psize 1800x1200 on a dark studio
//                                 (--bg0 / --bg1 the backdrop's centre and edge, --key / --rim the portrait lights)
//        [--same 0.9]             the share of the file's cage rows the page must hold after the import (assert 3)
//        [--takeoff]              the hero (hero:, and cuts:' hero panel) as a take-off: the flown model, flaps at the
//                                 build's take-off setting, every lamp on, the prop's disc turning (3 Nov, the user)
//        [--size 1920x1080]       the viewport (CSS px, DPR 1); the still is the 3D canvas only (the phone's sheet takes a third)
//        [--gpu]                  the machine's graphics card instead of SwiftShader (the box's A/B; a visible window)
//        [--page index.html]      index.html (built) or dev.html (the loose src/)
//        [--secs 1500]            the whole run's budget
//        [--gfx laptop]           the graphics preset (LIVERY-TEXT 9 Nov: laptop draws the decal atlas at 2048 - the phone's
//                                 512 px pages; gamer / ultra at 4096 - a desktop's 1024)
//        [--chrome <path>]        the browser (default: Playwright's Chromium, then Chrome, then /usr/bin/chromium*)
//        [--keep-ui]              the still with the page's UI over it
//        [--root <dir>]           the repo served (default: the one this file is in) - e.g. a throwaway archive of a branch
//        [--fallback <dir>[;<dir>]]  _serve.js's fallback roots, in order (a tree over the main checkout's gitignored data)
//        [--query k=v&k=v]        appended to the page's query (G3800)
//        [--probe <file.js>]      an expression evaluated in the page after each build settles, printed `PROBE <build> <json>`
//        [--probe-out] [--probe-secs <s>]  the probe's value to <out>/<build>_probe.json (R3: the fiche bake), its time (120)
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

// ---- PORTRAITS (PORTRAITS, 2 Nov; the user: "3/4 bottom-up shot, low FOV, possibly dark studio background" - "I'm
// getting lost myself"): the aeroplane's picture for a card or a gallery, drawn by the page's own renderer into its own
// camera, not the editor's orbit (whose lens is fixed and whose eye stops at the floor):
//   hero:<yaw>/<el>/<fov>  the airframe LEVEL (the stance's pitch taken off - the air, not the ramp), the eye <yaw> deg
//                          round from the nose to the aeroplane's left, <el> deg above (negative: below) the level
//                          chord, a lens of <fov> deg (vertical); the box fitted to ~84 % of the frame, centred
//   profile                the left side, an orthographic eye level with it, on its gear as it stands - the silhouette
// A dark studio either way: the studio's black under a soft radial backdrop, the studio's own lights plus a portrait
// key (low at the front, so a belly seen from below is lit) and a rim from behind; no pool, no floor. Drawn at 2x and
// halved (the supersample is the anti-aliasing). The page's size, lens and pose come back as they were.
// THE CRAFT FRAME FOLLOWS THE PORTRAIT (SIDEBOX-SLIDE, 12 Nov): the side-box and plan-box liveries (kit m<n>Mode 1/2)
// project through vCraftPos = uCraftInv * modelMatrix * v, and uCraftInv is ONE shared uniform the game sets once a frame
// (app.js poseModel: from the mount in the garage, from model.grp in flight). A portrait draws synchronously, between
// frames: the levelled hero turned the mount ~10 deg (the PC-6's stance) under a frame still measured on the pitched mount,
// so the bands came out diagonal and the far flank rotated. So the body sets the frame from the root it draws (craft: the
// axes of that root, as app.js passes them), after the levelling, and puts the frame back after. The profile's root is not
// turned, so its frame is the frame it had, bit for bit.
const PORTRAIT_BODY = `(o, root, fwd0, craft) => {
  const P = window.FLIGHT_PROBE, R = P.renderer(), S = P.hangarScene(), cam0 = P.camera();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const pitch0 = root.rotation.x;
  if (o.kind !== 'profile' && !fwd0) root.rotation.x = 0;   // the air's attitude for the hero and the board's 3-view; the thumbnail stands
  root.updateMatrixWorld(true);
  const AK = window.AEROSKIN, CU = AK && AK.aeroSetCraft && AK.aeroSharedU ? AK.aeroSharedU(THREE).uCraftInv : null, craft0 = CU ? CU.value.clone() : null;
  const reframe = () => { if (!CU || !craft) return; const m = craft.mount || root; m.updateWorldMatrix(true, false); AK.aeroSetCraft(THREE, m.matrixWorld, craft.axes); };
  reframe();
  // the box of what is drawn (the hidden overlays out), and the aeroplane's own axes (z forward in the cage, the mount
  // turned to the room; up is the room's)
  const box = new THREE.Box3(), gb = new THREE.Box3();
  root.traverseVisible(m => { if (!m.isMesh || !m.geometry) return; const g = m.geometry; if (!g.boundingBox) g.computeBoundingBox(); gb.copy(g.boundingBox).applyMatrix4(m.matrixWorld); box.union(gb); });
  const fwd = fwd0 ? V(fwd0[0], fwd0[1], fwd0[2]) : V(0, 0, 1).transformDirection(root.parent.matrixWorld); fwd.y = 0; fwd.normalize();
  const up = V(0, 1, 0), left = V().crossVectors(up, fwd).normalize();
  const c = box.getCenter(V()), W = o.w * o.ss, H = o.h * o.ss, aspect = o.w / o.h;
  // the fit's points: the drawn vertices themselves (a few hundred a mesh), not the box's corners - a 3/4 eye throws a
  // box's corners far wider than the aeroplane (the 20:50 take's heroes filled half the frame, off centre)
  const corners = [], pv = V();
  root.traverseVisible(m => { const pa = m.isMesh && m.geometry && m.geometry.attributes && m.geometry.attributes.position; if (!pa) return;
    const step = Math.max(1, Math.floor(pa.count / 300)); for (let i = 0; i < pa.count; i += step) corners.push(pv.fromBufferAttribute(pa, i).applyMatrix4(m.matrixWorld).clone().sub(c)); });
  if (!corners.length) for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(V(x, y, z).sub(c));
  const fill = o.fill || 0.84;
  // the aeroplane's own frame: the drawn points' extents along the nose, the left wing and up - the orthos' one scale
  const ext = { f: [1e9, -1e9], l: [1e9, -1e9], u: [1e9, -1e9] };
  for (const p of corners) for (const [k, ax] of [['f', fwd], ['l', left], ['u', up]]) { const v = p.dot(ax); if (v < ext[k][0]) ext[k][0] = v; if (v > ext[k][1]) ext[k][1] = v; }
  const mid = k => (ext[k][0] + ext[k][1]) / 2, len = k => Math.max(0.1, ext[k][1] - ext[k][0]);
  const cc = c.clone().addScaledVector(fwd, mid('f')).addScaledVector(left, mid('l')).addScaledVector(up, mid('u'));
  // the hero: a lens of its own, the distance that holds every drawn point, then the target moved to centre what is seen
  const heroCam = (fov, aspect, yawD, elD, fl, circle) => {
    const yaw = yawD * Math.PI / 180, el = elD * Math.PI / 180;
    const d = fwd.clone().multiplyScalar(Math.cos(yaw) * Math.cos(el)).addScaledVector(left, Math.sin(yaw) * Math.cos(el)).addScaledVector(up, Math.sin(el)).normalize();
    const cam = new THREE.PerspectiveCamera(fov, aspect, 0.05, 2000);
    const tt = Math.tan(fov * Math.PI / 360), tv = tt * fl, th = tv * aspect;
    let t = c.clone(), D = 1;
    for (let it = 0; it < 3; it++) {
      cam.position.copy(t).addScaledVector(d, 10); cam.up.copy(up); cam.lookAt(t); cam.updateMatrixWorld(true);
      const rx = V(1, 0, 0).transformDirection(cam.matrixWorld), ry = V(0, 1, 0).transformDirection(cam.matrixWorld);
      const off = c.clone().sub(t);
      D = 0; for (const p0 of corners) { const p = p0.clone().add(off); const z = p.dot(d); D = Math.max(D, circle ? z + Math.hypot(p.dot(rx) / th, p.dot(ry) / tv) : Math.max(z + Math.abs(p.dot(rx)) / th, z + Math.abs(p.dot(ry)) / tv)); }
      cam.position.copy(t).addScaledVector(d, D); cam.lookAt(t); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
      let x0 = 1, x1 = -1, y0 = 1, y1 = -1; for (const p0 of corners) { const q = p0.clone().add(c).project(cam); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
      t.addScaledVector(rx, (x0 + x1) / 2 * tt * aspect * D).addScaledVector(ry, (y0 + y1) / 2 * tt * D);
    }
    cam.position.copy(t).addScaledVector(d, D); cam.lookAt(t);
    return cam;
  };
  // an orthographic eye from <from> (a unit axis of the aeroplane), <s> px a metre, centred on the drawn extents
  const ortho = (from, camUp, w, h, s) => { const cam = new THREE.OrthographicCamera(-w / (2 * s), w / (2 * s), h / (2 * s), -h / (2 * s), 0.05, 2000);
    cam.position.copy(cc).addScaledVector(from, 80); cam.up.copy(camUp); cam.lookAt(cc); return cam; };
  // THE PANELS, in the still's px: { cam, x, y, w, h, low (the key from below: a hero seen from under), caption }
  const panels = []; let OW = o.w, OH = o.h;
  if (o.kind === 'hero') panels.push({ cam: heroCam(o.fov, o.w / o.h, o.yaw, o.el, fill, o.circle), x: 0, y: 0, w: o.w, h: o.h, low: true });
  else if (o.kind === 'profile') {   // the left side, the nose to the frame's left (the thumbnail)
    const s = Math.min(o.w * fill / len('f'), o.h * fill / len('u'));
    panels.push({ cam: ortho(left, up, o.w, o.h, s), x: 0, y: 0, w: o.w, h: o.h });
  } else if (o.kind === 'cuts') {
    // THE CUT-OUTS (the user, 2 Nov 21:45: "look at actual pixels, and not just images bounding boxes, so images can
    // 'interpenetrate' each other ... the difference between something that looks like a beautiful illustration and a
    // simple collage"): the hero and the three orthos each alone, the background matted away (shot() below), for a
    // composer that packs by the silhouettes. o.h: the side view's length in px; the plan and the front at its scale
    const s = o.h / len('f'), ow = a => Math.round(s * a) + 24;
    const ha = o.aspect || 1.25, Wh = Math.round(o.h * 1.25), Hh = Math.round(Wh / ha);   // the hero squarer (the user, 2 Nov: "a more square image, easier to composite")
    panels.push({ name: 'hero_m' + Math.round(Math.abs(o.el)), cam: heroCam(o.fov, ha, o.yaw, o.el, 0.94), w: Wh, h: Hh, low: true });
    panels.push({ name: 'side', cam: ortho(left, up, ow(len('f')), ow(len('u')), s), w: ow(len('f')), h: ow(len('u')), s });
    panels.push({ name: 'top', cam: ortho(up, fwd, ow(len('l')), ow(len('f')), s), w: ow(len('l')), h: ow(len('f')), s });
    panels.push({ name: 'front', cam: ortho(fwd, up, ow(len('l')), ow(len('u')), s), w: ow(len('l')), h: ow(len('u')), s });
    for (const p of panels) { p.x = 0; p.y = 0; }
  } else {
    // THE PLANE BOARD (the user, 2 Nov: "a full board: top, side, front AND hero shot, well composited, without much
    // margin between the pictures"): the hero on the left at 5:4 (the user picked a squarer hero, 2 Nov) the board's height; on the right one column, the three
    // orthos at ONE scale - the side (the nose left), the plan below it (the nose up: span across, as the front's) and
    // the front under the plan, the span of the two aligned - a 3-view drawing's column, sized so its height is the
    // hero's; gutters of a few px
    const Hb = o.h, g = 4, pad = Math.round(0.045 * Hb), L = len('f'), Sp = len('l'), Hh = len('u');
    const s = (Hb - 2 * g - 6 * pad) / (L + 2 * Hh);
    const Wc = Math.round(s * Math.max(L, Sp) + 2 * pad), hs = Math.round(s * Hh + 2 * pad), ht = Math.round(s * L + 2 * pad), hf = Hb - 2 * g - hs - ht;
    const Wh = Math.round(Hb * (o.aspect || 1.25));
    OW = Wh + g + Wc; OH = Hb;
    panels.push({ cam: heroCam(o.fov, Wh / Hb, o.yaw, o.el, 0.86), x: 0, y: 0, w: Wh, h: Hb, low: true, caption: true });
    panels.push({ cam: ortho(left, up, Wc, hs, s), x: Wh + g, y: 0, w: Wc, h: hs });
    panels.push({ cam: ortho(up, fwd, Wc, ht, s), x: Wh + g, y: hs + g, w: Wc, h: ht });
    panels.push({ cam: ortho(fwd, up, Wc, hf, s), x: Wh + g, y: hs + ht + 2 * g, w: Wc, h: hf });
  }
  for (const p of panels) { p.cam.layers.mask = cam0.layers.mask; if (typeof UI_LAYER !== 'undefined') UI_LAYER.blind(p.cam); p.cam.updateMatrixWorld(true); p.cam.updateProjectionMatrix(); }
  // the studio, dressed for a portrait: a backdrop a panel, the two lights, the pool out
  const bgTex = (w, h) => { const bg = document.createElement('canvas'); bg.width = 512; bg.height = Math.max(8, Math.round(512 * h / w));
    const g2 = bg.getContext('2d'), gr = g2.createRadialGradient(bg.width * 0.5, bg.height * 0.42, 0, bg.width * 0.5, bg.height * 0.5, Math.max(bg.width, bg.height) * 0.62);
    gr.addColorStop(0, o.bg0); gr.addColorStop(1, o.bg1); g2.fillStyle = gr; g2.fillRect(0, 0, bg.width, bg.height);
    const t = new THREE.CanvasTexture(bg); if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace; return t; };
  for (const p of panels) p.bg = bgTex(p.w, p.h);
  const lights = new THREE.Group();
  const key = new THREE.DirectionalLight(0xfff0dc, o.key), rim = new THREE.DirectionalLight(0xe6eeff, o.rim);
  rim.position.copy(c).addScaledVector(fwd, -7).addScaledVector(left, -2).addScaledVector(up, 6); rim.target.position.copy(c); key.target.position.copy(c);
  lights.add(key, key.target, rim, rim.target); S.add(lights);
  const hid = []; S.traverse(m => { if (m.visible && /^studio:pool$/.test(m.name || '')) { m.visible = false; hid.push(m); } });
  const bg0 = S.background;
  const sz = R.getSize(new THREE.Vector2()), pr = R.getPixelRatio();
  let meta = {}; try { meta = (GARAGE_SPEC.get() || {}).meta || {}; } catch (e) {}
  const shot = () => {
    const out = document.createElement('canvas'); out.width = OW; out.height = OH;
    const g = out.getContext('2d'); g.fillStyle = o.bg1; g.fillRect(0, 0, OW, OH); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    for (const p of panels) {
      key.position.copy(c).addScaledVector(fwd, 6).addScaledVector(left, 5).addScaledVector(up, p.low ? -2 : 3);
      S.background = p.bg; R.setPixelRatio(1); R.setSize(p.w * o.ss, p.h * o.ss, false); R.render(S, p.cam);
      g.drawImage(R.domElement, 0, 0, p.w * o.ss, p.h * o.ss, p.x, p.y, p.w, p.h);
      if (p.caption && (meta.name || meta.reg)) {   // the name and the registration, the garage's type, low on the hero
        const fs = Math.round(p.h * 0.034), x = p.x + Math.round(p.h * 0.04), y = p.y + p.h - Math.round(p.h * 0.045);
        g.textBaseline = 'alphabetic'; g.fillStyle = '#e8ded0'; g.font = '600 ' + fs + "px 'IBM Plex Sans', system-ui, sans-serif";
        g.fillText(String(meta.name || ''), x, y - (meta.reg ? Math.round(fs * 0.95) : 0));
        if (meta.reg) { g.fillStyle = '#a89c8c'; g.font = '500 ' + Math.round(fs * 0.7) + "px 'IBM Plex Sans', system-ui, sans-serif"; g.fillText(String(meta.reg), x, y); }
      }
    }
    return out.toDataURL('image/png').split(',')[1];
  };
  // A CUT-OUT: the panel drawn twice, on black and on white - the difference is the background's share (1 - alpha), the
  // black draw over alpha the colour (difference matting: exact for the anti-aliased edge and the glass, as the blend
  // happens in the output's values both times); normalised by an empty corner's difference, cropped to the silhouette
  const grab = (p, col) => {
    key.position.copy(c).addScaledVector(fwd, 6).addScaledVector(left, 5).addScaledVector(up, p.low ? -2 : 3);
    S.background = col; R.setPixelRatio(1); R.setSize(p.w * o.ss, p.h * o.ss, false); R.render(S, p.cam);
    const cv = document.createElement('canvas'); cv.width = p.w; cv.height = p.h;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(R.domElement, 0, 0, p.w * o.ss, p.h * o.ss, 0, 0, p.w, p.h);
    return g.getImageData(0, 0, p.w, p.h).data;
  };
  const matte = p => {
    const k = grab(p, new THREE.Color(0, 0, 0)), wt = grab(p, new THREE.Color(1, 1, 1));
    const bgD = Math.max(1, ((wt[0] - k[0]) + (wt[1] - k[1]) + (wt[2] - k[2])) / 3);
    const out = new ImageData(p.w, p.h), d = out.data; let x0 = p.w, y0 = p.h, x1 = -1, y1 = -1, n = 0;
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      const A = Math.max(0, Math.min(255, 255 * (1 - ((wt[i] - k[i]) + (wt[i + 1] - k[i + 1]) + (wt[i + 2] - k[i + 2])) / 3 / bgD)));
      if (A < 2) continue;
      const f = 255 / A; d[i] = Math.min(255, k[i] * f); d[i + 1] = Math.min(255, k[i + 1] * f); d[i + 2] = Math.min(255, k[i + 2] * f); d[i + 3] = A;
      const x = j % p.w, y = (j / p.w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; n++;
    }
    if (!n) return { name: p.name, px: 0 };
    const cv = document.createElement('canvas'); cv.width = x1 - x0 + 1; cv.height = y1 - y0 + 1;
    cv.getContext('2d').putImageData(out, -x0, -y0);
    return { name: p.name, png: cv.toDataURL('image/png').split(',')[1], w: cv.width, h: cv.height, px: n, s: p.s || null,
             edge: x0 === 0 || y0 === 0 || x1 === p.w - 1 || y1 === p.h - 1 };
  };
  let a, b, cuts = null;
  try {
    if (o.kind === 'cuts') cuts = panels.map(matte);
    else { a = shot(); root.visible = false; b = shot(); root.visible = true; }
  } finally {
    root.visible = true; S.background = bg0; S.remove(lights); key.dispose && key.dispose(); rim.dispose && rim.dispose(); for (const p of panels) p.bg.dispose();
    for (const m of hid) m.visible = true;
    root.rotation.x = pitch0; root.updateMatrixWorld(true);
    if (craft0) CU.value.copy(craft0);   // the frame the page had (its next frame sets it again anyway)
    R.setPixelRatio(pr); R.setSize(sz.x, sz.y, false);
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
  }
  const cam = panels[0].cam;
  return { a, b, cuts, meta: { name: meta.name || null, reg: meta.reg || null }, eye: cam.position.toArray().map(x => +x.toFixed(3)), fov: cam.isPerspectiveCamera ? cam.fov : 0, w: OW, h: OH,
           box: [box.min.toArray(), box.max.toArray()].flat().map(x => +x.toFixed(3)), dist: +cam.position.distanceTo(c).toFixed(2) };
}`;
// THE TAKE-OFF HERO (the user, 3 Nov: "the hero shot should be rendered with flaps, lights, and turning blades, as it
// clearly evokes a plane just taking off seen from the ground"): o.takeoff draws the FLOWN model, not the editor's cage
// (the cage has no flap travel, no prop disc, no lamps) - shown at the stand for the one call through the roll-out
// shot's door (window.FLYDIY_CRAFT_IN_SHED: model.grp shown, the cage down, posed), the flaps run to the build's take-off
// setting through the linkage (def.params.flaps.to, else 0.25), every lamp switched on (the cockpit's switches,
// FLYDIY_COCKPIT_I), the prop drawn as the game draws it turning (its disc at 2400 rpm); everything put back after. Its
// attitude is the stand's (the flown model is not levelled); the stand's forward is the cage's. Cuts: the hero panel
// from the take-off draw, the three orthos from the cage as before. No door -> the cage's hero, said in the result.
const PORTRAIT = `(o) => {
  const body = ${PORTRAIT_BODY};
  const cage = window.CAGE_UI_SCENE, P = window.FLIGHT_PROBE;
  // the craft frame of each root, as app.js poseModel sets it: the cage's mount (x lateral, z forward, y up), the flown
  // model.grp (x along, y up, z left)
  const J = window.CAGE_JOIN, CAGE_F = { mount: (J && J.mount && J.mount()) || cage, axes: { lateral: 'x', along: 'z', up: 'y', aft: true } };
  if (!o.takeoff) return body(o, cage, null, CAGE_F);
  const M = P.model && P.model(), g = M && M.grp, sim = P.sim && P.sim(), def = P.def && P.def(), CK = window.FLYDIY_COCKPIT_I;
  if (!g || !window.FLYDIY_CRAFT_IN_SHED || !sim || !sim.ctl) { const r = body(o, cage, null, CAGE_F); r.takeoff = 'fallback: no flown model door'; return r; }
  const plain = o.kind === 'cuts' ? body(o, cage, null, CAGE_F) : null;   // the orthos as before
  cage.updateMatrixWorld(true);
  const f = new THREE.Vector3(0, 0, 1).transformDirection(cage.parent.matrixWorld), fwd0 = [f.x, f.y, f.z];
  const fl = def && def.params && def.params.flaps, flapTO = fl && Number.isFinite(fl.to) ? fl.to : 0.25;
  const ctl0 = { flap: sim.ctl.flap, de: sim.ctl.de, da: sim.ctl.da, dr: sim.ctl.dr };
  const sw0 = CK && CK.sw ? Object.assign({}, CK.sw) : null, hand0 = CK && CK.handSw ? Object.assign({}, CK.handSw) : null;
  const disc = rpm => { for (const p of (M.props || [])) { const d = p.userData && p.userData.disc; if (d && d.update) try { d.update(rpm, p.userData.spinAng || 0, 1, 0.016); } catch (e) {} } };
  try {
    Object.assign(sim.ctl, { flap: flapTO, de: 0, da: 0, dr: 0 });
    for (let i = 0; i < 300; i++) window.FLYDIY_CRAFT_IN_SHED(() => 0);   // the linkage is rate-limited: run it home
    return window.FLYDIY_CRAFT_IN_SHED(() => {
      let lamps = 0;
      if (CK && CK.sw) { for (const k of ['sw_nav', 'sw_beacon', 'sw_land', 'sw_taxi', 'sw_strobe']) if (k in CK.sw) { CK.sw[k] = 1; lamps++; if (CK.handSw) CK.handSw[k] = true; } try { if (CK.glow) CK.glow(0); } catch (e) {} }
      disc(2400); g.updateMatrixWorld(true);
      const r = body(o, g, fwd0, { mount: g, axes: { lateral: 'z', along: 'x', up: 'y', aft: false } });
      if (plain) { const hero = r.cuts.find(c => /^hero/.test(c.name)); plain.cuts = plain.cuts.map(c => /^hero/.test(c.name) && hero ? hero : c); }
      const out = plain || r;
      out.takeoff = { flap: flapTO, props: (M.props || []).length, lamps };
      return out;
    });
  } finally {
    Object.assign(sim.ctl, ctl0); disc(0);
    if (CK && sw0) { Object.assign(CK.sw, sw0); CK.handSw = hand0 || {}; try { if (CK.glow) CK.glow(0); } catch (e) {} }
  }
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
    // PHONE-EDIT-PERF (2 Nov): the phone profile draws the phone's material tier (aeroskin.js aeroLite: no weathering, no
    // large-scale field, no structure grammar) - a still of a BUILD is its full look: ?phmat=full (--phmat lite: the tier)
    // (G3800: --query k=v&k=v rides the page's own query - a brief's switches)
    const url = 'http://localhost:' + o.servePort + '/flyDiy/' + o.page + '?profile=phone&gfx=' + (/^[a-z]+$/.test(o.gfx || '') ? o.gfx : 'laptop') + '&intro=0&idle=0&phmat=' + (o.phmat === 'lite' ? 'lite' : 'full')
              + (opt('query') ? '&' + opt('query') : '');   // idle=0 (NEW-PLANE): PHONE-1a's idle hold froze the frame and the in-frame check read 0 %
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
    await C.ev('(() => { for (const x of document.querySelectorAll(".dfClose, .npCancel")) try { x.click(); } catch (e) {} return 1; })()');
    await frames(3);

    const doc = await C.cmd('DOM.getDocument', { depth: 0 });
    const fileNode = (await C.cmd('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '#gFile' })).result.nodeId;
    if (!fileNode) throw Object.assign(new Error('no #gFile on the page (the fleet\'s Import)'), { code: EXIT.run });

    // G3800: 'stock:*' - every stock design the garage offers (GARAGE_SPEC.stock())
    if (o.builds.includes('stock:*')) { const names = await J('(GARAGE_SPEC.stock() || [])'); o.builds = o.builds.flatMap(b => b === 'stock:*' ? names.map(n => 'stock:' + n) : [b]); log('stock designs', JSON.stringify(names)); }
    for (let file of o.builds) {
      // G3800 (thumb_bake.js): 'stock:<name>' is the garage's own stock design - its spec written to a build file in --out
      // and brought in through the same door as any file
      if (/^stock:/.test(file)) {
        const nm = file.slice(6), sp = await J('(GARAGE_SPEC.stockSpec(' + JSON.stringify(nm) + ') || null)');
        if (!sp || !sp.cage) { log('no stock design', JSON.stringify(nm)); continue; }
        file = path.join(o.out, 'stock_' + nm.replace(/[^\w.-]+/g, '-') + '.json');
        fs.writeFileSync(file, JSON.stringify({ what: 'flydiy-build', stock: nm, spec: sp }));
      }
      // PLANE-RENDERS R1: 'arch:<key>' is a design card's plane as the new-aeroplane card bakes it (CAGE_DESIGN.designBake),
      // the authored recreations' pictures
      if (/^arch:/.test(file)) {
        const k = file.slice(5), sp = await J('(() => { const D = window.CAGE_DESIGN, a = D && D.ARCHETYPES && D.ARCHETYPES.find(x => x.key === ' + JSON.stringify(k) + '); return a && D.designBake ? D.designBake(a.sel, a.over) : null; })()');
        if (!sp || !sp.cage) { log('no design card', JSON.stringify(k)); continue; }
        file = path.join(o.out, 'arch_' + k.replace(/[^\w.-]+/g, '-') + '.json');
        fs.writeFileSync(file, JSON.stringify({ what: 'flydiy-build', arch: k, spec: sp }));
      }
      const tb = Date.now(), base = path.basename(file).replace(/\.json$/i, '');
      // (NEW-PLANE: a fresh profile's first launch opens the new-aeroplane chooser a moment after the boot, and the chooser
      // holds the frames behind it - closed before every build, as the player's cancel would)
      await C.ev('(() => { try { if (window.NEW_PLANE && NEW_PLANE.isOpen()) NEW_PLANE.close(); } catch (e) {} return 1; })()');
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
        if (keys.length && same / keys.length >= o.same) break;
        if (i > 120 || left() <= 0) break;
      }
      BR.cageRows = keys.length; BR.cageSame = same;
      if (C.S.dialogs.length > d0) { fail(EXIT.build, base + ': the import said "' + C.S.dialogs.slice(d0).join(' / ') + '"'); continue; }
      if (!keys.length || same / keys.length < o.same) { fail(EXIT.build, base + ': the page\'s build is not the file\'s (' + same + ' of ' + keys.length + ' cage rows equal)'); continue; }
      // the build settles: its box the same over two looks a few frames apart (the join's second round, the floats' datum)
      const box = '(() => { const o = window.CAGE_UI_SCENE; if (!o || typeof THREE === "undefined") return null; const b = new THREE.Box3().setFromObject(o); return b.isEmpty() ? null : [b.min.toArray(), b.max.toArray()].flat().map(v => +v.toFixed(3)); })()';
      let prev = null;
      for (let i = 0; i < 20; i++) { await frames(3); const b = await J(box); if (b && prev && b.join() === prev.join()) break; prev = b; }
      BR.box = prev; BR.t = +((Date.now() - tb) / 1000).toFixed(1);
      log(base, 'loaded in', BR.t + ' s,', same + '/' + keys.length, 'cage rows equal, box', JSON.stringify(prev));
      // --probe <file.js>: an expression evaluated in the page once the build has settled, its value printed as one line
      // `PROBE <base> <json>` (G3800: what the page drew where - the scene the still is of, not a headless copy)
      // (PLANE-RENDERS R3: --probe-out writes the value to <out>/<build>_probe.json instead - a fiche's pictures as base64, the
      // bake's - and --probe-secs gives a long probe its time, 120 s by default)
      if (opt('probe')) { try { const pv = await C.ev(fs.readFileSync(opt('probe'), 'utf8'), 1000 * +opt('probe-secs', '120'));
        if (flag('probe-out')) { const pf = path.join(o.out, base + '_probe.json'); fs.writeFileSync(pf, JSON.stringify(pv)); log('PROBE', base, 'to', pf, Math.round(JSON.stringify(pv).length / 1024) + ' KB'); }
        else log('PROBE', base, JSON.stringify(pv)); } catch (e) { log('PROBE', base, 'threw', e.message); } }

      for (const v of o.views) {
        const tv = Date.now(), name = v.replace(/[:/]/g, '-');
        const VR = { view: v }; BR.views.push(VR);
        try {
          let asked = null;
          if (/^(hero:|board:|cuts:|profile($|\/))/.test(v)) {
            // A PORTRAIT: drawn in the page (PORTRAIT above), the craft-hidden twin with it; the same frame checks
            // hero:<yaw>/<el>/<fov>[/<fill>[/<W>x<H>]] - the aeroplane's share of the frame and the still's own size (the
            // app icon's square, A0 2 Nov) over --psize; profile[/<fill>[/<W>x<H>]] the same; board:<fov>/<height>[/<el>[/<hero aspect>]]; cuts the same, <side px>
            const kind = v.split(/[:/]/)[0];
            const hp = kind === 'profile' ? v.split('/').slice(1) : v.slice(kind.length + 1).split('/');
            let po;
            if (kind === 'board' || kind === 'cuts') po = { kind, yaw: 38, el: hp[2] != null ? parseFloat(hp[2]) : -12, aspect: hp[3] != null ? parseFloat(hp[3]) : 1.25, fov: parseFloat(hp[0]), w: 0, h: +hp[1], ss: 2 };
            else {
              const [yaw, el, fov, fill] = kind === 'profile' ? [90, 0, 0, parseFloat(hp[0])] : hp.slice(0, 4).map(parseFloat);
              const fs = kind === 'profile' ? hp[0] : hp[3], sz = kind === 'profile' ? hp[1] : hp[4];
              const ps = sz ? sz.split('x').map(Number) : o.psize;
              po = { kind, yaw, el, fov, fill: fill || 0, circle: /c$/.test(fs || ''), w: ps[0], h: ps[1], ss: 2 };
            }
            Object.assign(po, o.look); if (o.takeoff && kind !== 'profile') po.takeoff = true;
            if (!o.keepUi) { await C.ev('(() => { if (window.SHOT_MODE) SHOT_MODE.enter(); return 1; })()'); await frames(3); }
            const pr = await J('(' + PORTRAIT + ')(' + JSON.stringify(po) + ')', 120000);
            await C.ev('(() => { if (window.SHOT_MODE && SHOT_MODE.on) SHOT_MODE.exit(); return 1; })()');
            Object.assign(VR, { door: 'portrait', eye: pr.eye, fov: pr.fov, dist: pr.dist, box: pr.box, takeoff: pr.takeoff || null });
            if (pr.takeoff) log(base, v, 'take-off:', JSON.stringify(pr.takeoff));
            if (pr.cuts) {   // THE CUT-OUTS: one transparent PNG a view + <base>_cuts.json (the orthos' px a metre, the name, the reg)
              VR.cuts = [];
              for (const k of pr.cuts) {
                if (!k.px) throw Object.assign(new Error('the ' + k.name + ' cut-out is empty'), { code: EXIT.frame });
                if (k.edge) throw Object.assign(new Error('the ' + k.name + ' cut-out touches its frame (cut off)'), { code: EXIT.frame });
                const f = path.join(o.out, base + '_cut_' + k.name + '.png'); fs.writeFileSync(f, Buffer.from(k.png, 'base64'));
                VR.cuts.push({ name: k.name, w: k.w, h: k.h, px: k.px, s: k.s, png: f });
              }
              fs.writeFileSync(path.join(o.out, base + '_cuts.json'), JSON.stringify({ build: base, meta: pr.meta, cuts: VR.cuts }, null, 1));
              VR.t = +((Date.now() - tv) / 1000).toFixed(1);
              log(base, v, 'ok', VR.t + ' s,', VR.cuts.map(k => k.name + ' ' + k.w + 'x' + k.h).join(', '));
              continue;
            }
            const P = await J('(' + ANALYSE + ')(' + JSON.stringify(pr.a) + ', ' + JSON.stringify(pr.b) + ')', 180000);
            VR.picture = P;
            const bad = why => { const f = path.join(o.out, base + '_' + name + '_FAIL.png'); fs.writeFileSync(f, Buffer.from(pr.a, 'base64')); VR.failPng = f; return why; };
            if (P.topShare > 0.97) throw Object.assign(new Error(bad('the portrait is one flat colour')), { code: EXIT.frame });
            if (!(P.craftShare > 0.02)) throw Object.assign(new Error(bad('the aeroplane is not in the portrait (' + (100 * (P.craftShare || 0)).toFixed(2) + ' %)')), { code: EXIT.frame });
            if (P.cut && P.cut.length) throw Object.assign(new Error(bad('the aeroplane is cut off at the ' + P.cut.join(' and ') + ' edge')), { code: EXIT.frame });
            const out = path.join(o.out, base + '_' + name + '.png');
            fs.writeFileSync(out, Buffer.from(pr.a, 'base64'));
            VR.png = out; VR.t = +((Date.now() - tv) / 1000).toFixed(1);
            log(base, v, 'ok', VR.t + ' s,', 'aeroplane', (100 * P.craftShare).toFixed(1) + ' % of', P.w + 'x' + P.h, '->', path.relative(process.cwd(), out));
            continue;
          }
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
          } else if (/^at:/.test(v)) {
            // PILLAR-ANCHORS: A POINT OF THE CAGE, CLOSE - at:<x>/<y>/<z>/<az>/<el>/<dist>: a point in the layers' own
            // frame (metres, +x port, +z forward; the flank facing the eye: x or -x, whichever is nearer it), the eye
            // panned onto it at az / el (deg) / dist (m) - one framing for a before and an after
            const n = v.slice(3).split('/').map(Number);
            if (n.length !== 6 || !n.every(isFinite)) throw Object.assign(new Error('at:<x>/<y>/<z>/<az>/<el>/<dist>: ' + v), { code: EXIT.run });
            asked = [n[3] * Math.PI / 180, n[4] * Math.PI / 180, n[5]];
            const fr = await J('(async () => { let g = null; window.CAGE_UI_SCENE.traverse(o => { if (!g && o.name === "cageLayer:access") g = o; });' +
              ' if (!g) window.CAGE_UI_SCENE.traverse(o => { if (!g && o.name === "cageLayer:wing") g = o; }); if (!g) return { err: "no access or wing layer" };' +
              ' g.updateMatrixWorld(true);' +
              ' FLIGHT_PROBE.pan(0, 0, 0); FLIGHT_PROBE.camSet(' + asked[0] + ', ' + asked[1] + ', 13); FLIGHT_PROBE.camSettle(); await new Promise(r => requestAnimationFrame(r));' +
              ' const E = new THREE.Vector3().fromArray(FLIGHT_PROBE.camGet().eye);' +
              ' const a = g.parent.localToWorld(new THREE.Vector3(' + n[0] + ', ' + n[1] + ', ' + n[2] + ')), b = g.parent.localToWorld(new THREE.Vector3(' + (-n[0]) + ', ' + n[1] + ', ' + n[2] + '));' +
              ' const c = a.distanceTo(E) <= b.distanceTo(E) ? a : b;' +
              ' FLIGHT_PROBE.pan(0, 0, 0); FLIGHT_PROBE.camSettle(); await new Promise(r => requestAnimationFrame(r));' +
              ' const G = FLIGHT_PROBE.camGet(); FLIGHT_PROBE.pan(c.x - G.target[0], c.y - G.target[1], c.z - G.target[2]); FLIGHT_PROBE.camSet(' + asked.join(', ') + ');' +
              ' return { centre: c.toArray().map(x => +x.toFixed(3)) }; })()');
            if (fr.err) throw Object.assign(new Error(fr.err), { code: EXIT.eye });
            Object.assign(VR, { at: n.slice(0, 3), centre: fr.centre }); VR.door = 'at'; VR.close = true;
          } else if (/^fit:/.test(v)) {
            // PILLAR-ANCHORS: ONE FITTING, CLOSE - fit:<key>/<az>/<el>/<dist>: the fittings layer's placed record of that
            // key (CAGE_ACCESS.placed, the first on the port flank, else the first), taken from the layer's frame to the
            // world, the eye panned onto it and set at az / el (deg) / dist (m)
            const [key, a, e, d] = v.slice(4).split('/');
            asked = [+a * Math.PI / 180, +e * Math.PI / 180, +d];
            if (!key || !asked.every(isFinite)) throw Object.assign(new Error('fit:<key>/<az>/<el>/<dist>: ' + v), { code: EXIT.run });
            const fr = await J('(async () => { const A = window.CAGE_ACCESS, L = (A && A.placed || []).filter(x => x.key === ' + JSON.stringify(key) + ');' +
              ' if (!L.length) return { err: "no fitting " + ' + JSON.stringify(key) + ' + " placed (" + (A && A.placed || []).map(x => x.key).join(", ") + ")" };' +
              ' let g = null; window.CAGE_UI_SCENE.traverse(o => { if (!g && o.name === "cageLayer:access") g = o; }); if (!g) return { err: "no access layer" };' +
              ' g.updateMatrixWorld(true);' +
              // the one the eye sees: the eye set at the asked az / el from the whole aeroplane's framing, the fitting nearest it
              ' FLIGHT_PROBE.pan(0, 0, 0); FLIGHT_PROBE.camSet(' + asked[0] + ', ' + asked[1] + ', 13); FLIGHT_PROBE.camSettle(); await new Promise(r => requestAnimationFrame(r));' +
              ' const E = new THREE.Vector3().fromArray(FLIGHT_PROBE.camGet().eye);' +
              ' let c = null; for (const q of L) { const w = g.parent.localToWorld(new THREE.Vector3(q.p[0], q.p[1], q.p[2])); if (!c || w.distanceTo(E) < c.distanceTo(E)) c = w; }' +
              ' const G = FLIGHT_PROBE.camGet(); FLIGHT_PROBE.pan(c.x - G.target[0], c.y - G.target[1], c.z - G.target[2]); FLIGHT_PROBE.camSet(' + asked.join(', ') + ');' +
              ' return { centre: c.toArray().map(x => +x.toFixed(3)) }; })()');
            if (fr.err) throw Object.assign(new Error(fr.err), { code: EXIT.eye });
            Object.assign(VR, { fit: key, centre: fr.centre }); VR.door = 'fit'; VR.close = true;
          } else if (/^tw:/.test(v)) {
            // G3800: THE TAIL CONTACT, CLOSE - the eye on the drawn tail wheel / skid (its leg, fork and wheel meshes, the
            // gear layer's edLegT / edCastorT / edWheelT and their children: on twin booms both of them)
            const [a, e, d] = v.slice(3).split('/').map(Number);
            const pr = await J('(async () => { const root = window.CAGE_UI_SCENE, b = new THREE.Box3(); root.updateMatrixWorld(true);' +
              ' root.traverse(o => { let q = o, hit = false; for (; q; q = q.parent) if (/^ed(Wheel|Castor|Leg)T/.test(q.name || "")) { hit = true; break; }' +
              '   if (hit && o.geometry) b.expandByObject(o); });' +
              ' if (b.isEmpty()) return { err: "no tail contact drawn" };' +
              ' FLIGHT_PROBE.pan(0, 0, 0); FLIGHT_PROBE.camSettle(); await new Promise(r => requestAnimationFrame(r));' +
              ' const g = FLIGHT_PROBE.camGet(), c = b.getCenter(new THREE.Vector3());' +
              ' FLIGHT_PROBE.pan(c.x - g.target[0], c.y - g.target[1], c.z - g.target[2]);' +
              ' return { centre: c.toArray().map(x => +x.toFixed(3)) }; })()');
            if (pr.err) throw Object.assign(new Error(pr.err), { code: EXIT.eye });
            asked = [a * Math.PI / 180, e * Math.PI / 180, d];
            await C.ev('(() => { FLIGHT_PROBE.camSet(' + asked.join(', ') + '); return 1; })()');
            Object.assign(VR, { centre: pr.centre, close: true }); VR.door = 'tw';
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
    builds, out, size, chrome, gpu: flag('gpu'), page: opt('page', 'index.html'), secs: +opt('secs', 1500), phmat: opt('phmat', 'full'), gfx: opt('gfx', 'laptop'),
    views: (opt('views', 'q,s,t,f')).split(',').filter(Boolean), keepUi: flag('keep-ui'), fallback: opt('fallback', null),
    root: path.resolve(opt('root', REPO)),
    psize: (opt('psize', '1800x1200')).split('x').map(Number),
    same: +opt('same', 0.9),   // the share of the file's cage rows the page must hold (an old v7 / v8 file: the build's clamps and migrations pull more)
    // the portrait's studio: the backdrop's centre and edge, the key's and the rim's strength
    takeoff: flag('takeoff'),
    look: { bg0: opt('bg0', '#2b2724'), bg1: opt('bg1', '#0a0908'), key: +opt('key', 2.2), rim: +opt('rim', 2.6) },
  };
  // the arguments, before anything is launched (--dry stops here)
  if (!builds.length) bail(EXIT.run, '--build <file.json>[,<file2.json>]: which aeroplane(s)');
  for (const b of builds) {
    if (/^(stock|arch):./.test(b)) continue;   // G3800: a stock design, read from the page (R1: or a design card)
    if (!fs.existsSync(b)) bail(EXIT.build, 'no such build file: ' + b);
    let j = null; try { j = JSON.parse(fs.readFileSync(b, 'utf8')); } catch (e) { bail(EXIT.build, b + ' is not JSON: ' + e.message); }
    // the garage's own rule (garage.js unwrap: a spec with a cage), not the export's label - the pool's NEW-SHAPES files
    // name their recipe in `what` (PORTRAITS)
    if (!j || !j.spec || !j.spec.cage) bail(EXIT.build, b + ' is not a flyDiy build (what: ' + (j && j.what) + ')');
  }
  for (const v of o.views) if (!PRESET[v] && !/^part:./.test(v) && !/^fit:\w+\/[-\d.]+\/[-\d.]+\/[\d.]+$/.test(v) && !/^at:([-\d.]+\/){5}[\d.]+$/.test(v) && !/^hero:[-\d.]+\/[-\d.]+\/[\d.]+(\/0?\.\d+c?(\/\d{2,4}x\d{2,4})?)?$/.test(v) && !/^profile(\/0?\.\d+(\/\d{2,4}x\d{2,4})?)?$/.test(v) && !/^(board|cuts):[\d.]+\/\d{3,4}(\/-?[\d.]+(\/[\d.]+)?)?$/.test(v) &&!/^(orbit|close|tw):[-\d.]+\/[-\d.]+\/[\d.]+$/.test(v)) bail(EXIT.run, 'unknown view ' + v + ' (q, s, t, f, i, part:<key>, orbit:<az>/<el>/<dist>, close:<az>/<el>/<dist>)');
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
