#!/usr/bin/env node
// _framecost_check.js - GATE FRAMECOST (G1010-G1014): what a frame and a boot step cost, COUNTED, and ratcheted.
//
// WHY (2026-09-27): the render CPU at the Jolene taxi grew from 11.0 to 14.7 ms (48 -> 43 fps delivered, the old stock
// plane, pinned 60) across eight landings, each with a green battery. The draw counts had not moved (1184 main, 429
// shadow, 252 programs); a live profile spread the cost over three's per-draw path (uniformMatrix4fv 65 ms a second of
// taxi, the renderer's internals ~140, updateMatrixWorld 46, onBeforeRender 12, the frustum 12, terrainH + grHeight
// 27). No gate counted per-frame WORK, so any session could add some in silence. This one counts it.
//
// HOW. THE PAGE ITSELF, IN NODE (tools/_page_node.js): dev.html's scripts in their order, the real three.js r186 on a
// RECORDING WebGL2 (tools/_fake_gl.js makeGL: every call, the uniform / buffer / texture bytes, the programs reflected
// off their GLSL so three uploads what a driver would make it upload), a small document (tools/_page_dom.js) and a
// VIRTUAL clock (every timer and frame on it, Math.random seeded) - deterministic, node only, no GPU. For each build
// (the default Cub - the first boot, no working build - and the metal Cessna, bugReports/cessnaMetal (1).json) the
// garage boots, `Roll out` is pressed, the roll-out screen runs, the flight is PAUSED (the pause button: FLYDIY_HELD,
// every clock still) and two VIEWS are rendered N frames each through the page's own loop:
//   stand   the aeroplane on HOME's stand, the chase camera settled;
//   taxi    the aeroplane put on a PINNED pose half-way along the taxi route the pilot plans from that stand (TAXI_PIN:
//           patternPath as DEPART plans it, 951 m, s = 475; placed as the skip-to-line-up places it), the chase
//           camera settled. The live route's half-way point is reported beside the pin.
// PER FRAME (the MEDIAN of N frames after a warm-up, counter by counter) it counts: draws by pass (main, shadow, other), every GL call, programs used and switched,
// texture binds, uniform uploads by kind (calls and bytes), buffer and texture uploads (calls and bytes),
// renderer.render calls, Object3D.updateMatrixWorld and updateMatrix calls, custom onBeforeRender / onAfterRender /
// onBeforeShadow callbacks (object and material), frustum tests, the world's terrainH and the raster's grHeight
// (premises terrainFast) calls. PER BOOT STEP (BOOT.run's own list: the garage boot and the roll-out screen, plus the
// scripts' evaluation) the same GL units and the program links.
//
// THE RATCHET: tools/perf/framecost_baseline.json. A count above its baseline by more than the tolerance (TOL: 1 %
// and a small absolute slack) is RED; a fall is reported ("ratchet down: run --update"). A rise is admitted only by an
// ALLOW entry below, with its reason and its G-number (GATE ASSETS' rule). `--update` rewrites the baseline and prints
// the diff. Every run prints the table: view x counter, baseline vs now.
// THE GATE PROVES IT CAN SEE: after the views, on the Cub's stand, three injected regressions are measured through the
// same comparison and each must be RED - (a) an onBeforeRender on 100 drawn meshes, (b) a uniform set per frame on
// every material, (c) matrixAutoUpdate forced on the static props.
//
//   node tools/_framecost_check.js              the gate (two builds in parallel child processes)
//   node tools/_framecost_check.js --update     rewrite the baseline, print the diff
//   node tools/_framecost_check.js --json out   also write the whole census
//   node tools/_framecost_check.js --census cub|cessna [--frames N]   one build's census as JSON (the child)
//   node tools/_framecost_check.js --compare a.json b.json   which counts differ between two censuses (the bisect's)
//   FRAMECOST_QUERY='raster=1'  a URL query for the page (hold a default equal across commits in a bisect)
// READING THE COUNTS. They are the page's work on THIS harness: exact and repeatable, not a browser's. What the page
// budgets in milliseconds (the forest fill, the premises stream, the prewarms) runs on the virtual clock, where
// performance.now() moves 10 us a call - so a streamer does its work in fewer, fuller frames than in Chrome, and the
// first frames after the reveal carry streaming (the fill's terrainH) the browser spreads wider. Two runs of one tree
// give the same numbers to the last digit (checked: 0 of 433 values differ); the page's own JS dominates the wall
// (~3 min a build on the 4-core cloud box, ~3.6 GB each: the shakedown's solver, the editor, the parked captures
// without a Worker, the world step).
'use strict';
const fs = require('fs'), path = require('path');
const { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
const BASE_FILE = path.join(__dirname, 'perf', 'framecost_baseline.json');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const UPDATE = argv.includes('--update');
const FRAMES = +opt('frames', 12), WARM = +opt('warm', 6);
const BUILDS = { cub: null, cessna: 'bugReports/cessnaMetal (1).json' };

// THE TOLERANCE: the counts are exact on one tree (the clock is virtual); the slack absorbs a frame whose periodic
// work (a probe, a cascade every other frame) lands on the other side of the window after an unrelated change
const TOL = { rel: 0.01, abs: 2 };
// ALLOW: a rise admitted, with its reason and its G-number - { key: 'view/counter' or 'boot/step/counter' (a prefix
// ending in '/' admits the whole row), build: 'cub'|'cessna'|'*', upTo: the admitted value (or Infinity), why, g }.
// e.g. { key: 'stand/draws.shadow', build: '*', upTo: 760, why: 'the craft-only cascade: the aeroplane drawn into its own map', g: 'G1100' }
//      { key: 'boot/rollout:compile/', build: '*', why: 'the contact-shadow pass links its programs under the screen', g: 'G1101' }
// An entry admits a rise until the next --update takes it into the baseline; then it is dead and should go.
const ALLOW = [
  // B1-LAG (2026-09-28): the parked tree rungs' stand-ins compiled lit and through their depth variants under the roll-out
  // screen - two tree materials and their two depth programs no warm-up had met (R1's +32 s link in the taxi, 567 ms)
  { key: 'boot/rollout:images/links', build: '*', upTo: 6, why: 'the parked rungs\' programs linked under the screen (rungPrelink), not in the taxi', g: 'G730' },
  { key: 'boot/rollout:images/gl.calls', build: '*', upTo: 80, why: 'the rung prelink\'s compile slices (render targets bound per slice)', g: 'G730' },
  // ...their maps and the textures an onBeforeCompile hook hands the shaders, uploaded a slice a task before first light,
  // not by the first world frame (the 'frames' task's texSubImage: 325 MB of 2D, 80 MB of array data in this census)
  { key: 'boot/rollout:upload/gl.calls', build: '*', upTo: 4700, why: 'the stand-ins\' maps and the compiled uniforms\' textures uploaded in the upload step', g: 'G730/G732' },
  { key: 'boot/rollout:frames/gl.calls', build: '*', upTo: 51500, why: 'the catch-up upload of the hooks\' textures and the sliced depth variants before first light', g: 'G732' },
  { key: 'boot/rollout:bake/', build: '*', why: 'the flown aeroplane texture bake, a roll-out step under the screen (cached: an IndexedDB hit reads and uploads only)', g: 'G870' },
  // C4b (G875-G878): the census now sees the flown bake as the game runs it (the step's read-back returns written texels
  // here: before, it bowed out at 0 % and the census measured an aeroplane no player sees); the bake step's row is G870's above
  { key: 'boot/rollout:compile/links', build: '*', upTo: 72, why: 'the folds\' programs linked under the screen: the skinned variant of the baked material, the cabin\'s baked material and its skinned variant', g: 'G875' },
  { key: 'boot/rollout:compile/gl.calls', build: '*', upTo: 800, why: 'the same three links', g: 'G875' },
  { key: 'stand/gl.texSubImage2D', build: '*', upTo: 102, why: 'the folds\' bone textures: one small upload per skinned fold a frame (four on a Cessna)', g: 'G875' },
  { key: 'taxi/gl.texSubImage2D', build: '*', upTo: 100, why: 'the folds\' bone textures (above)', g: 'G875' },
  { key: 'stand/bytes.texSubImage2D', build: '*', upTo: 496000, why: 'the folds\' bone textures (~1.5 KB each a frame)', g: 'G875' },
  { key: 'taxi/bytes.texSubImage2D', build: '*', upTo: 490000, why: 'the folds\' bone textures (above)', g: 'G875' },
  { key: 'taxi/world.terrainH', build: 'cub', upTo: 42000, why: 'the Cub\'s taxi view only (the Cessna\'s did not move): the terrain fill\'s calls rose once the bake runs in the census - not traced further', g: 'G878' },
  { key: 'taxi/world.grHeight', build: 'cub', upTo: 56000, why: 'the raster behind that terrainH (above)', g: 'G878' },
  // G923 (AS4a M3): the strip stones are BatchedMeshes per (map, casts) in a cell - taxi main draws 1097 -> 982, shadow
  // 533 -> 495 (Cub) - and a batch binds its matrix and index textures and re-uploads its visible-instance list
  // (three's per-instance culling) at each of its draws: a small texSubImage2D and two binds where a stone part was a
  // whole draw
  { key: 'stand/gl.bindTexture', build: '*', upTo: 1390, why: 'the strip stones\' batches bind their matrix / index textures', g: 'G923' },
  { key: 'taxi/gl.bindTexture', build: '*', upTo: 1080, why: 'the strip stones\' batches bind their matrix / index textures', g: 'G923' },
  { key: 'stand/gl.texSubImage2D', build: '*', upTo: 130, why: 'a strip-stone batch uploads its visible-instance list at each draw', g: 'G923' },
  { key: 'taxi/gl.texSubImage2D', build: '*', upTo: 165, why: 'a strip-stone batch uploads its visible-instance list at each draw', g: 'G923' },
  { key: 'stand/bytes.texSubImage2D', build: '*', upTo: 500000, why: 'the strip-stone batches\' instance lists (~3 KB a frame)', g: 'G923' },
  { key: 'taxi/bytes.texSubImage2D', build: '*', upTo: 470000, why: 'the strip-stone batches\' instance lists (~3 KB a frame)', g: 'G923' },
];

// ---- the census: one build, the page in node ---------------------------------------------------------------
async function census(build) {
  const { openPage } = require('./_page_node.js');
  const C = bootMark.C = { who: null, obr: 0, oar: 0, obs: 0, mobr: 0, umw: 0, um: 0, frustum: 0, terrainH: 0, grHeight: 0, renders: 0, pick: null };
  const storage = {};
  if (BUILDS[build]) storage['flydiy.wip'] = fs.readFileSync(path.join(ROOT, BUILDS[build]), 'utf8');
  let mainCam = null;
  const hooks = pageHooks(C, () => mainCam);
  const t0 = Date.now();
  const P = await openPage({ quiet: true, storage, hooks, query: process.env.FRAMECOST_QUERY || '' });
  const W = P.win;
  const snap = bootMark.snap;
  // the boot's LANDING (every step ran; the frames until the overlay lifts) is its own row, not the last step's
  let cur = null, rows = null;
  const landing = () => { const B = W.BOOT; if (bootMark.cur && B && B.state === 'landing' && !/:landing$/.test(bootMark.cur)) bootMark.open(bootMark.cur.split(':')[0] + ':landing'); };
  P.onFrame((ph) => {
    if (ph === 'start') { landing(); if (C.injectFrame) C.injectFrame(P.frameNo); wrapPremises(FP && FP.world(), C); P.rec.resetUsed(); C.drawn = rows ? [] : null; C.drawnShadow = rows ? [] : null; cur = snap(); }
    else if (ph === 'end' && rows && cur) { const r = diff(cur, snap()); r.programs = P.rec.progUsed.size; rows.push(r); if (C.drawn) { C.lastDrawn = C.drawn; C.lastShadow = C.drawnShadow; } }
  });
  let FP = null;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 600000);
  bootMark.close();
  const tGarage = Date.now() - t0;
  const bGo = W.document.getElementById('bGo');
  bootMark.open('rollout:click'); bGo.click();
  // B9 (G1020): a roll-out that changes nothing shows no screen at all - the trip's own log says when it is done
  // (window.FLYDIY_TRIPS); a tree before B9 has none and lifts its roll-out screen
  const tripDone = () => { const T = W.FLYDIY_TRIPS; const t = T && T[T.length - 1]; return !!(t && t.kind === 'rollout' && t.done && W.BOOT.state === 'gone'); };
  await P.until(() => W.FLYDIY_TRIPS ? tripDone() : (W.BOOT.state === 'gone' && W.BOOT.set === 'rollout'), 900000);
  bootMark.close();
  const tRoll = Date.now() - t0 - tGarage;
  // THE PAGE'S MEMORY after the roll-out (G905, reported, never ratcheted): a full gc first when the child has one
  // (--expose-gc); heapUsed is the JS heap, arrayBuffers the typed arrays' backing stores (the grids, the bins, the
  // textures' image.data) - the harness's own (the recording GL keeps no data) is a constant beside them
  const mem = () => { if (global.gc) { global.gc(); global.gc(); } const m = process.memoryUsage(); const MB = x => +(x / 1048576).toFixed(1); return { heapUsed: MB(m.heapUsed), arrayBuffers: MB(m.arrayBuffers), external: MB(m.external), rss: MB(m.rss) }; };
  const memRoll = mem();
  FP = W.FLIGHT_PROBE;
  mainCam = typeof FP.camera === 'function' ? FP.camera() : FP.camera;
  // THE FLIGHT HELD: the pause button, the world's clocks with it
  const bP = W.document.getElementById('bPause'); if (bP) bP.click();
  const measure = async (warm, frames) => { rows = null; FP.camSettle(); await P.frames(warm === undefined ? WARM : warm); rows = []; await P.frames(frames || FRAMES); const r = median(rows); rows = null; return r; };
  const views = {};
  C.phase = () => P.rec.phase;
  await debugAids(W, P, FP, C, () => rows, v => { rows = v; });
  views.stand = await measure();
  const craft = { stand: await craftCensus(W, P, FP, C) };
  const detail = { stand: drawnDetail(C) };
  if (C.who) { for (const [k, m] of Object.entries(C.who)) { process.stderr.write('WHO ' + k + '\n'); const w = e => e[1] * (+((/\[(\d+) B\]$/.exec(e[0]) || [0, 1])[1]) || 1); for (const [st, n] of Object.entries(m).sort((a, b) => w(b) - w(a)).slice(0, 8)) process.stderr.write('   ' + n + '  ' + st + '\n'); } C.who = null; P.rec.onCall = null; }
  // THE PROOF (on the Cub's stand, where the baseline view is fresh): three regressions injected, each measured
  const selftest = build === 'cub' ? await injections(W, FP, C, views.stand, measure) : null;
  // THE TAXI: a PINNED pose, half-way along the route the pilot plans from HOME's stand (patternPath, 951 m, measured
  // G1010). Pinned so the view is the render's question alone: a change to the pilot's planning must not move the camera
  // (the live route's half-way point is still computed and its distance to the pin reported); and a tree older than
  // G771 (no lineupPose) is measured at the same place - the bisect's case
  const route = taxiPose(W, FP);
  const pose = Object.assign({}, TAXI_PIN, { off: route ? +Math.hypot(route.x - TAXI_PIN.x, route.z - TAXI_PIN.z).toFixed(1) : null });
  placeAt(W, FP, pose);
  if (process.env.FRAMECOST_WHAT === 'taxi') { FP.camSettle(); await P.frames(WARM); await debugAids(W, P, FP, C, () => rows, v => { rows = v; }, 'taxi'); }
  views.taxi = await measure();
  detail.taxi = drawnDetail(C);
  views.taxi.pose = [pose.x, pose.z, pose.hdg, pose.off === null ? 'no route' : 'route ' + pose.off + ' m off'];
  // THE ISLAND TEXTURES ARE THE GPU'S (G906): after the roll-out not one keeps its image.data; the class weights were
  // never built (the default stack starts past the class layer); a lost context's re-derive (the canvas's
  // webglcontextrestored handler, called here directly - three's own restore is not run on the recording GL) gives
  // every one its bytes back, and the next frames' uploads drop them again
  const release = await (async () => {
    const GA = W.WORLD && W.WORLD.ground; const G = GA && GA.gpuTex ? GA.gpuTex() : null; if (!G) return null;
    const held = () => G.list.filter(t => t.image && t.image.data).length;
    const r = { n: G.list.length, big: G.list.filter(t => t.image && t.image.width > 1).length, heldAfterRollout: held(), classWeights: GA.classWeights ? GA.classWeights() : null };
    r.rederived = G.restore(); r.heldAfterRestore = held();
    await P.frames(2); r.heldAfterReupload = held();
    return r;
  })();
  craft.taxi = await craftCensus(W, P, FP, C);
  const wd = FP.world();
  const health = { premises: !!(wd.premises && wd.premises.rec), townCut: (W.FLYDIY_TOWN && W.FLYDIY_TOWN.n) || 0, raster: !!(wd.premises && wd.premises.overlay && wd.premises.overlay.raster && wd.premises.overlay.raster.on),
    world: W.FLYDIY_WORLD, depth: W.FLYDIY_DEPTH, gfx: W.GFX && W.GFX.get ? (g => ({ preset: g.preset, shadows: g.shadows }))(W.GFX.get()) : null,
    thrown: P.errors.filter(e => /^(script |timer: |frame: |FLYDIY_BOOT)/.test(e)).slice(0, 5) };
  craft.bake = W.FLOWN_BAKE ? (W.FLOWN_BAKE.FB.last || null) : undefined;
  detail.scene = matCensus(W.WORLD && W.WORLD.scene);
  if (process.env.FRAMECOST_WHAT) process.stderr.write('DETAIL ' + JSON.stringify(detail, null, 1) + '\n');
  return { build, health, release, frames: FRAMES, warm: WARM, views, craft, detail, boot: bootMark.rows, selftest, mem: { rollout: memRoll, end: mem() }, programsTotal: W.FLYDIY_RENDERER.info.programs.length,
    wall: { garage: tGarage, rollout: tRoll, total: Date.now() - t0 }, errors: P.errors.slice(0, 20), errorsN: P.errors.length };
}
// the page's hooks for a census (B9: shared with GATE ROUNDTRIP): the three counters, the boot's step marks, the
// graphics the census holds (gamer, shadows full), the world's terrainH and the renderer's passes
function pageHooks(C, getCam) {
  return {
    afterScript(name, P) {
      const W = P.win;
      if (name === 'vendor/three.min.js') installThree(W.THREE, C);
      if (name === 'src/viewer/boot.js' && W.BOOT) wrapBoot(W, P);
      if (name === 'src/viewer/gfx_settings.js' && W.GFX) { W.GFX.set('preset', 'gamer'); W.GFX.set('shadows', 'full'); }
      // C4b (G875): THE FLOWN BAKE ENGAGES HERE AS IT DOES IN THE GAME. The recording GL draws nothing, so the bake's
      // read-back is all zeros and the step bows out (0 % of the atlas written: the live shader flies) - the census
      // then measured an aeroplane no player sees. During the step only, its read-back returns a written mid-grey texel.
      if (name === 'src/viewer/flown_bake.js' && W.FLOWN_BAKE) { const FBk = W.FLOWN_BAKE, st = FBk.step;
        FBk.step = async function () { C.fbFill = true; try { return await st.apply(this, arguments); } finally { C.fbFill = false; } }; }
    },
    beforeScript(name, P) {
      const W = P.win;
      if (name === 'src/viewer/app.js') {
        // the world's terrainH, counted where every caller reads it (the world object's own property)
        if (typeof W.makeWorld === 'function') { const mk = W.makeWorld; W.makeWorld = function () { const w = mk.apply(this, arguments); wrapWorld(w, C); return w; }; }
        // the renderer: its render (the pass it draws) and its shadow pass, once app.js makes it
        let R = null;
        Object.defineProperty(W, 'FLYDIY_RENDERER', { configurable: true, get: () => R, set: v => { R = v; if (v && !v.__fc) wrapRenderer(v, P, C, getCam); } });
      }
    },
  };
}
// ---- the debugging aids (stderr only, never in the verdict) ------------------------------------------------------
//   FRAMECOST_WHO=1     the callers of terrainH and of the buffer / texture / matrix uploads, sampled, over the stand's
//                       frames; the premises overlay's state
//   FRAMECOST_WHAT=1    what the main pass drew in one frame, by object path and material (=taxi: at the taxi pose)
//   FRAMECOST_PROBE=N   N frames at the stand, a line every 10 (draws, GL calls, terrainH, ...): how the world settles
async function debugAids(W, P, FP, C, getRows, setRows, at) {
  const E = process.env;
  if (E.FRAMECOST_WHO) {
    Error.stackTraceLimit = 60;
    C.who = {}; P.rec.onCall = (n, b) => { if (!/SubData|SubImage|bufferData/.test(n)) return;
      // the first frames outside three and this harness: the page's line that asked for the upload, and the bytes
      const st = (new Error().stack || '').split('\n').slice(1).map(l => l.trim()).filter(l => !/three\.min\.js|_fake_gl\.js|_framecost_check\.js|_page_node\.js|node:/.test(l)).slice(0, 3).map(l => l.replace(/^at /, '').replace(/\(.*[\/\\]/, '(')).join(' < ');
      const m = C.who[n] || (C.who[n] = {}); const k = st + ' [' + b + ' B]'; m[k] = (m[k] || 0) + 1; };
    // who marks a buffer attribute dirty (its upload next draw): the setter's caller and the attribute's bytes
    for (const K of ['BufferAttribute', 'InterleavedBuffer']) { const pr = W.THREE[K] && W.THREE[K].prototype, d = pr && Object.getOwnPropertyDescriptor(pr, 'needsUpdate');
      if (d && d.set) Object.defineProperty(pr, 'needsUpdate', { configurable: true, get: d.get, set(v) { if (v === true && C.who) { const b = this.array ? this.array.byteLength : 0; const st = (new Error().stack || '').split('\n').slice(2, 4).map(l => l.trim().replace(/^at /, '').replace(/\(.*[\/\\]/, '(')).join(' < '); const m = C.who['dirty ' + K] || (C.who['dirty ' + K] = {}); const k = st + ' [' + b + ' B]'; m[k] = (m[k] || 0) + 1; } d.set.call(this, v); } }); }
    const w = FP.world(), PM = w.premises && w.premises.overlay;
    process.stderr.write('PREMISES rec ' + !!(w.premises && w.premises.rec) + ' town cut ' + (W.FLYDIY_TOWN && W.FLYDIY_TOWN.n) + ' raster flag ' + W.FLYDIY_GROUND_RASTER + ' overlay ' + !!PM + ' raster ' + JSON.stringify(PM && PM.raster) + '\n');
  }
  if (E.FRAMECOST_PROBE) {
    setRows([]);
    for (let i = 0; i < +E.FRAMECOST_PROBE; i++) {
      await P.frames(1);
      if (i % 10 === 9) { const r = getRows()[getRows().length - 1]; process.stderr.write('PROBE ' + (i + 1) + ' ' + JSON.stringify({ d: r['draws.total'], dm: r['draws.main'], ds: r['draws.shadow'], gl: r['gl.calls'], th: r['world.terrainH'], gr: r['world.grHeight'], umw: r['three.updateMatrixWorld'], ft: r['three.frustumTests'] }) + '\n'); }
    }
    setRows(null);
  }
  if (E.FRAMECOST_WHAT && (E.FRAMECOST_WHAT === 'taxi') === !!at) {
    setRows([]); await P.frames(1); setRows(null);
    const by = {};
    for (const o of C.lastDrawn || []) { let n = o; const pth = []; while (n && pth.length < 3) { if (n.name) pth.push(n.name); n = n.parent; }
      const m = [].concat(o.material)[0]; const k = (o.isInstancedMesh ? 'I:' : o.isBatchedMesh ? 'B:' : '') + (pth.reverse().join('/') || o.type) + ' | ' + (m && (m.name || m.type)); by[k] = (by[k] || 0) + 1; }
    process.stderr.write('WHAT ' + (C.lastDrawn || []).length + '\n' + Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 60).map(([k, v]) => '  ' + v + ' ' + k).join('\n') + '\n');
  }
}
// ---- WHAT A VIEW DREW, AND THE MATERIALS BY UUID AND BY SIGNATURE (AS4a, G920) --------------------------------------
// Read off the last measured frame's own draw list (the hooks above record the drawn meshes; nothing is drawn for it): the
// draws by FAMILY (the nearest named ancestor's name, cut at its first ':' '#' or digit) in the main and shadow passes, and
// the distinct materials drawn, by object (uuid) and by SIGNATURE (the type and every value three uploads or keys a program
// on: maps by texture, colours, scalars, the program key, and the uniforms a hook hands in). Reported in the census
// (`detail`), never ratcheted: the gap uuid - sig is what a signature dedupe can still take.
const famOf = o => { for (let n = o; n; n = n.parent) if (n.name) return n.name.split(/[:#]/)[0].replace(/[0-9_.-]+$/, '') || n.name; return o.type; };
const MAT_KEYS = ['side', 'transparent', 'opacity', 'alphaTest', 'alphaToCoverage', 'depthWrite', 'depthTest', 'blending', 'vertexColors', 'flatShading', 'wireframe', 'fog', 'toneMapped',
  'roughness', 'metalness', 'emissiveIntensity', 'envMapIntensity', 'aoMapIntensity', 'lightMapIntensity', 'bumpScale', 'displacementScale', 'clearcoat', 'transmission', 'sheen', 'ior', 'reflectivity', 'dithering', 'polygonOffset', 'polygonOffsetFactor', 'polygonOffsetUnits', 'colorWrite', 'visible'];
function matSig(m) {
  if (!m) return 'none';
  const t = [m.type];
  for (const k of MAT_KEYS) if (m[k] !== undefined) t.push(k + '=' + (typeof m[k] === 'number' ? +m[k].toFixed(5) : m[k]));
  for (const k of Object.keys(m)) { const v = m[k]; if (v && v.isTexture) t.push(k + '@' + v.uuid); else if (v && v.isColor) t.push(k + '#' + v.getHexString()); else if (v && v.isVector2) t.push(k + '<' + v.x + ',' + v.y); }
  try { t.push('key:' + (m.customProgramCacheKey ? m.customProgramCacheKey() : '')); } catch (e) {}
  if (m.defines) t.push('def:' + JSON.stringify(m.defines));
  // a hook's own uniforms (a material's userData holds the objects its onBeforeCompile hands to the program)
  const ud = m.userData || {};
  for (const k of Object.keys(ud).sort()) { const v = ud[k]; if (v && typeof v === 'object' && 'value' in v) t.push('u.' + k + '=' + (typeof v.value === 'number' ? +v.value.toFixed(5) : v.value && v.value.uuid ? v.value.uuid : JSON.stringify(v.value))); }
  if (m.uniforms) for (const k of Object.keys(m.uniforms).sort()) { const v = m.uniforms[k] && m.uniforms[k].value; t.push('U.' + k + '=' + (v && v.uuid ? v.uuid : v && v.isColor ? v.getHexString() : typeof v === 'number' ? +v.toFixed(5) : v && v.toArray ? v.toArray().map(x => +(+x).toFixed(5)).join(',') : typeof v)); }
  return t.join('|');
}
function matTally(objs) {
  const uu = new Set(), sg = new Set(), fam = {};
  for (const o of objs) for (const m of [].concat(o.material)) { if (!m) continue; uu.add(m.uuid); const s = matSig(m); sg.add(s);
    const f = famOf(o), F = fam[f] || (fam[f] = { uu: new Set(), sg: new Set() }); F.uu.add(m.uuid); F.sg.add(s); }
  const byFam = {}; for (const [f, F] of Object.entries(fam)) byFam[f] = [F.uu.size, F.sg.size];
  // the trees' materials (trees.js hookLeaf: userData.uLeaf) by uuid, by signature, and by MAP alone - the last is
  // what a tint carried per instance (not per material) would leave
  const leaf = { uu: new Set(), sg: new Set(), map: new Set() };
  for (const o of objs) for (const m of [].concat(o.material)) if (m && m.userData && m.userData.uLeaf) { leaf.uu.add(m.uuid); leaf.sg.add(matSig(m)); leaf.map.add((m.map ? m.map.uuid : '-') + '|' + m.userData.uLeaf.value + '|' + (m.userData.uCut ? m.userData.uCut.value : 0) + '|' + (m.customProgramCacheKey ? m.customProgramCacheKey() : '')); }
  return { uuid: uu.size, sig: sg.size, byFam, leaf: [leaf.uu.size, leaf.sg.size, leaf.map.size] };
}
function drawnDetail(C) {
  const count = list => { const r = {}; for (const o of list || []) { const f = famOf(o); r[f] = (r[f] || 0) + 1; } return r; };
  // FRAMECOST_WHAT: the main pass's draws by the nearest name and the material (the families' members), stderr only
  let names = null;
  if (process.env.FRAMECOST_WHAT) { names = {}; for (const o of C.lastDrawn || []) { let n = o; while (n && !n.name) n = n.parent; const m = [].concat(o.material)[0];
    const k = (o.isInstancedMesh ? 'I:' : o.isBatchedMesh ? 'B:' : o.isSkinnedMesh ? 'S:' : '') + (n ? n.name : '-') + ' | ' + (m ? (m.name || m.type) + (m.map ? ' map' : '') : '-'); names[k] = (names[k] || 0) + 1; }
    names = Object.fromEntries(Object.entries(names).sort((a, b) => b[1] - a[1]).slice(0, 80)); }
  return { main: count(C.lastDrawn), shadow: count(C.lastShadow), mats: matTally(C.lastDrawn || []), names };
}
function matCensus(scene) {
  if (!scene) return null;
  const objs = []; scene.traverse(o => { if (o.material && (o.isMesh || o.isPoints || o.isLine || o.isSprite)) objs.push(o); });
  return matTally(objs);
}
// ---- the counters inside three -------------------------------------------------------------------------------
function installThree(T, C) {
  const O = T.Object3D.prototype, M = T.Material.prototype;
  const umw = O.updateMatrixWorld, um = O.updateMatrix;
  O.updateMatrixWorld = function (f) { C.umw++; return umw.call(this, f); };
  O.updateMatrix = function () { C.um++; return um.call(this); };
  // the per-draw hooks: three reads object.onBeforeRender / onAfterRender (and material.onBeforeRender) once per draw,
  // onBeforeShadow / onAfterShadow once per shadow draw - a read of a CUSTOM one is a callback run
  const hook = (proto, k, ctr, pick) => {
    const DEF = proto[k], slot = '__fc_' + k;
    Object.defineProperty(proto, k, { configurable: true,
      get() { const f = this[slot]; if (pick && C.drawn && this.isMesh && (!C.phase || C.phase() === pick)) (pick === 'shadow' ? C.drawnShadow : C.drawn).push(this);
        if (C.craft && (pick || k === 'onBeforeShadow') && C.craft.set.has(this)) craftDraw(C, this, k === 'onBeforeShadow' ? 'shadow' : C.phase ? C.phase() : 'main');
        if (f) { C[ctr]++; return f; } return DEF; },
      set(f) { Object.defineProperty(this, slot, { value: f === DEF ? undefined : f, writable: true, configurable: true, enumerable: false }); } });
  };
  hook(O, 'onBeforeRender', 'obr', 'main'); hook(O, 'onAfterRender', 'oar'); hook(O, 'onBeforeShadow', 'obs', 'shadow'); hook(O, 'onAfterShadow', 'obs');
  hook(M, 'onBeforeRender', 'mobr');
  const F = T.Frustum.prototype;
  for (const k of ['intersectsObject', 'intersectsSprite']) { const f = F[k]; F[k] = function (o) { C.frustum++; return f.call(this, o); }; }
}
// C4b (G875): THE AEROPLANE'S OWN SHARE - its draws by pass, the materials and programs its main-pass draws use
// (a census field beside the views, never in the ratchet's rows: the whole frame's counts already carry it)
function craftDraw(C, o, ph) {
  const K = C.craft; K[ph] = (K[ph] || 0) + 1;
  if (ph !== 'main') return;
  for (const m of [].concat(o.material)) if (m) K.mats.add(m);
  if (o.isSkinnedMesh) K.skinned++;
}
async function craftCensus(W, P, FP, C, n) {
  const m = FP.model && FP.model(), set = new Set();
  if (m && m.grp) m.grp.traverse(o => { if (o.isMesh || o.isLine || o.isPoints) set.add(o); });
  let r = null;
  for (let i = 0; i < (n || 3); i++) {
    C.craft = { set, main: 0, shadow: 0, other: 0, skinned: 0, mats: new Set() };
    await P.frames(1);
    r = C.craft;
  }
  C.craft = null;
  // FRAMECOST_CRAFT=1: every mesh the aeroplane drew, by the payload bucket it came from (stderr, a debugging aid)
  if (process.env.FRAMECOST_CRAFT && m && m.data) {
    const who = new Map(), D = m.data, mats = D.mats || {};
    for (const k in D.groups || {}) who.set(D.groups[k].pos, { k, part: '' });
    for (const pt of D.parts || []) for (const k in pt.groups) who.set(pt.groups[k].pos, { k, part: pt.kind });
    const rows = {};
    for (const o of set) { const g = o.geometry, pa = g && g.attributes && g.attributes.position; const w = pa && who.get(pa.array);
      const mt = [].concat(o.material)[0] || {}, rec = w ? (mats[w.k] || {}) : {};
      const cls = w ? [w.part || 'grp', rec.fin || '-', rec.inside ? 'in' : '', rec.spin ? 'spin' + rec.spin : '', rec.char ? 'char' : '', rec.lamp || rec.lampCup ? 'lamp' : '', rec.panel ? 'panel' : '', rec.ves ? 'ves' : '', rec.propMat ? 'kit' : '', rec.opacity < 1 ? 'clear' : '', rec.sec === 'dashFace' ? 'facia' : ''].filter(Boolean).join(' ') : (o.name || o.type) + ' ' + (o.userData.still ? 'still' : '');
      const key = cls + ' | ' + (mt.name || mt.type); rows[key] = (rows[key] || 0) + 1; }
    process.stderr.write('CRAFT ' + set.size + '\n' + Object.entries(rows).sort((a, b) => b[1] - a[1]).map(([k, v]) => '  ' + v + ' ' + k).join('\n') + '\n');
  }
  const R = W.FLYDIY_RENDERER, progs = new Set(), names = {};
  for (const mt of r.mats) { const pr = R.properties.get(mt), cp = pr && pr.currentProgram; if (cp) progs.add(cp.id);
    const k = mt.name || mt.type; names[k] = (names[k] || 0) + 1; }
  return { meshes: set.size, draws: { main: r.main, shadow: r.shadow, other: r.other }, skinnedDraws: r.skinned, materials: r.mats.size, programs: progs.size,
           byMaterial: Object.entries(names).sort((a, b) => b[1] - a[1]).slice(0, 40) };
}
function wrapWorld(w, C) {
  if (!w || w.__fc) return; w.__fc = true;
  if (typeof w.terrainH === 'function') { const f = w.terrainH; w.terrainH = function (x, z) { C.terrainH++; if (C.who && C.terrainH % 97 === 0) who(C, 'terrainH'); return f.call(this, x, z); }; }
  // the premises' overlay (the raster behind terrainH) is recomposed through world.premises.set: wrapped as it is made
  wrapPremises(w, C);
  if (w.premises && typeof w.premises.set === 'function') { const set = w.premises.set; w.premises.set = function () { const r = set.apply(this, arguments); wrapPremises(w, C); return r; }; }
}
// FRAMECOST_WHO=1: the callers of a counter, sampled (a debugging aid, never in the verdict)
function who(C, k) { const st = (new Error().stack || '').split('\n').slice(3, 6).map(l => l.trim().replace(/^at /, '').replace(/\(.*[\/\\]/, '(')).join(' < '); const m = C.who[k] || (C.who[k] = {}); m[st] = (m[st] || 0) + 1; }
// the raster's reads (G614): every world terrainH that misses its cache reaches PM.terrainFast -> grHeight
function wrapPremises(w, C) {
  const PM = w && w.premises && w.premises.overlay;
  if (!PM || PM.__fc) return; PM.__fc = true;
  if (typeof PM.terrainFast === 'function') { const f = PM.terrainFast; PM.terrainFast = function (x, z, h) { C.grHeight++; return f.call(this, x, z, h); }; }
}
function wrapRenderer(R, P, C, cam) {
  R.__fc = true;
  const rr = R.render;
  R.render = function (scene, camera) {
    C.renders++;
    const prev = P.rec.phase;
    if (prev !== 'shadow') { const W = P.win, main = (W.WORLD && scene === W.WORLD.scene) || (W.FLIGHT_PROBE && W.FLIGHT_PROBE.hangarScene && scene === W.FLIGHT_PROBE.hangarScene());
      P.rec.phase = main && camera === cam() ? 'main' : 'other'; }
    try { return rr.apply(this, arguments); } finally { P.rec.phase = prev; }
  };
  for (const k of ['readRenderTargetPixels', 'readRenderTargetPixelsAsync']) { const f = R[k]; if (typeof f !== 'function') continue;
    R[k] = function (rt, x, y, w, h, buf) { const r = f.apply(this, arguments); const fill = () => { if (C.fbFill && buf && buf.fill) buf.fill(128); return buf; };
      return r && typeof r.then === 'function' ? r.then(v => { fill(); return v; }) : (fill(), r); }; }
  const SM = R.shadowMap, sr = SM.render;
  SM.render = function () { const prev = P.rec.phase; P.rec.phase = 'shadow'; try { return sr.apply(this, arguments); } finally { P.rec.phase = prev; } };
}
// ---- the boot's steps: BOOT.run's list, each step from its start to the next one's --------------------------
const bootMark = {
  rows: {}, cur: null, at: null, snap: null, C: null,
  open(label) { this.close(); this.cur = label; this.at = this.snap(); this.w0 = Date.now(); },
  close() { if (!this.cur) return; const d = diff(this.at, this.snap()); d.wallMs = Date.now() - this.w0; const k = this.cur; this.rows[k] = this.rows[k] ? add(this.rows[k], d) : d; this.cur = null; },
};
function wrapBoot(W, P) {
  const mark = (steps, set) => { for (const s of steps || []) { if (s.__fc) continue; const fn = s.fn; s.__fc = true;
    s.fn = function () { bootMark.open(set + ':' + s.id); return typeof fn === 'function' ? fn.apply(this, arguments) : undefined; }; } };
  // run() takes the garage boot's list; show() (the roll-out screen, the way back, a settings screen) calls the inner run
  const run = W.BOOT.run, show = W.BOOT.show;
  W.BOOT.run = function (steps, o) { mark(steps, (o && o.set) || 'boot'); return run.apply(this, arguments); };
  if (typeof show === 'function') W.BOOT.show = function (set, o) { if (o && o.steps) mark(o.steps, o.set || set); return show.apply(this, arguments); };
  // the scripts' own evaluation (the world made inside app.js's, the core, the editor) is the boot's first row
  bootMark.snap = () => ({ rec: P.rec.snapshot(), c: Object.assign({}, bootMark.C, { pick: null, drawn: null, lastDrawn: null }) });
  bootMark.open('garage:scripts');
}
// ---- one row of counts: a snapshot's difference ----------------------------------------------------------------
const GL_SKIP = new Set(['getParameter', 'getExtension', 'getSupportedExtensions', 'getShaderPrecisionFormat', 'getContextAttributes', 'getError', 'isContextLost', 'getProgramParameter', 'getShaderParameter', 'getUniformLocation', 'getAttribLocation', 'getActiveUniform', 'getActiveAttrib', 'getProgramInfoLog', 'getShaderInfoLog', 'getShaderSource', 'checkFramebufferStatus', 'getUniformBlockIndex']);
function diff(a, b) {
  const r = {};
  const d = (k, x, y) => { const v = (y || 0) - (x || 0); if (v) r[k] = v; };
  let gl = 0;
  for (const k of Object.keys(b.rec.calls)) { const v = b.rec.calls[k] - (a.rec.calls[k] || 0); if (!v) continue; if (!GL_SKIP.has(k)) gl += v;
    if (/^uniform/.test(k) || /^(bufferData|bufferSubData|bindTexture|useProgram|bindFramebuffer|bindVertexArray|bindBuffer|texImage2D|texSubImage2D|texImage3D|texSubImage3D|compressedTexImage2D|generateMipmap|readPixels|drawBuffers|blitFramebuffer|invalidateFramebuffer|renderbufferStorageMultisample)$/.test(k)) r['gl.' + k] = v; }
  r['gl.calls'] = gl;
  let ub = 0; for (const k of Object.keys(b.rec.bytes)) { const v = b.rec.bytes[k] - (a.rec.bytes[k] || 0); if (!v) continue; if (/^uniform/.test(k)) ub += v; else r['bytes.' + k] = v; }
  if (ub) r['bytes.uniforms'] = ub;
  let draws = 0; for (const k of Object.keys(b.rec.draws)) { const v = b.rec.draws[k] - (a.rec.draws[k] || 0); if (v) { r['draws.' + k] = v; draws += v; } }
  r['draws.total'] = draws;
  d('links', a.rec.links, b.rec.links);
  for (const k of ['umw', 'um', 'obr', 'oar', 'obs', 'mobr', 'frustum', 'terrainH', 'grHeight', 'renders']) d(NAMES[k], a.c[k], b.c[k]);
  return r;
}
const NAMES = { umw: 'three.updateMatrixWorld', um: 'three.updateMatrix', obr: 'cb.onBeforeRender', oar: 'cb.onAfterRender', obs: 'cb.onShadow', mobr: 'cb.material.onBeforeRender', frustum: 'three.frustumTests', terrainH: 'world.terrainH', grHeight: 'world.grHeight', renders: 'three.renders' };
const add = (a, b) => { const r = Object.assign({}, a); for (const k of Object.keys(b)) if (typeof b[k] === 'number') r[k] = (r[k] || 0) + b[k]; return r; };
// the MEDIAN of the frames, counter by counter: a frame's burst (a chunk the streamer finishes, a probe re-shot) is not
// the frame; a period-2 alternation (a cascade every other frame) reads as its midpoint
function median(rows) {
  const keys = new Set(); for (const row of rows) for (const k of Object.keys(row)) if (typeof row[k] === 'number') keys.add(k);
  const r = {};
  for (const k of keys) { const a = rows.map(x => x[k] || 0).sort((p, q) => p - q), n = a.length; const m = n % 2 ? a[n >> 1] : (a[n / 2 - 1] + a[n / 2]) / 2; if (m) r[k] = Math.round(m * 10) / 10; }
  return r;
}
function mean(rows) {
  const r = {}, n = rows.length || 1;
  for (const row of rows) for (const k of Object.keys(row)) if (typeof row[k] === 'number') r[k] = (r[k] || 0) + row[k];
  for (const k of Object.keys(r)) r[k] = Math.round(r[k] / n * 10) / 10;
  return r;
}
// ---- the taxi pose: half-way along the pilot's own route out of the stand ------------------------------------
const TAXI_PIN = { x: 263.5, z: 727.6, hdg: 0.716 };   // Jolene, HOME: stand -> hold, s = 475 of 951 m (G1010)
// the aeroplane put on a pose the way the game's skip-to-line-up does (app.js placeLinedUp: a fresh reset, the one
// transform, the wheels seated on the ground they meet), with the older primitives where placeAtLineup is absent
function placeAt(W, FP, pose) {
  const sim = FP.sim(), ap = FP.ap(), def = FP.def(), world = FP.world();
  const from = ap && ap.route && ap.route.from;
  sim.reset(0); if (typeof sim.stance === 'function') sim.stance();
  if (typeof W.placeAtLineup === 'function') return W.placeAtLineup(sim, from, pose, world, def.refs);
  W.placeAtAerodrome(sim, { hdg: pose.hdg, spawn: [pose.x, pose.z], elev: (from && from.elev) || 0 });
  if (typeof W.seatOnGround === 'function') W.seatOnGround(sim, (x, z) => world.terrainH(x, z), def.refs);
}
function taxiPose(W, FP) {
  const ap = FP.ap(), sim = FP.sim();
  if (!ap || typeof ap.lineupPose !== 'function' || !ap.route) return null;
  let path = null; const pp = W.patternPath;
  if (typeof pp === 'function') W.patternPath = function () { const r = pp.apply(this, arguments); path = r; return r; };
  let hold = null; try { hold = ap.lineupPose(); } finally { if (typeof pp === 'function') W.patternPath = pp; }
  const cg = sim.cgPos();
  if (process.env.FRAMECOST_WHO) process.stderr.write('TAXI cg ' + cg.map(v => v.toFixed(1)) + ' hold ' + JSON.stringify(hold) + ' path ' + (path ? path.pts.length + ' ' + JSON.stringify(path.pts[0]) + ' .. ' + JSON.stringify(path.pts[path.pts.length - 1]) + ' ids ' + path.ids : 'none') + '\n');
  if (path && path.pts && path.pts.length > 1) {
    const pts = path.pts; let L = 0; const acc = [0];
    for (let i = 1; i < pts.length; i++) { L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); acc.push(L); }
    const half = L / 2; let i = 1; while (i < pts.length - 1 && acc[i] < half) i++;
    const a = pts[i - 1], b = pts[i], f = (half - acc[i - 1]) / Math.max(1e-6, acc[i] - acc[i - 1]);
    return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, hdg: Math.atan2(b.z - a.z, b.x - a.x), how: 'route' };
  }
  if (hold) return { x: (cg[0] + hold.x) / 2, z: (cg[2] + hold.z) / 2, hdg: Math.atan2(hold.z - cg[2], hold.x - cg[0]), how: 'midway' };
  return null;
}
// ---- the proof: three regressions, each must be red against the view it was injected into ---------------------
async function injections(W, FP, C, base, measure) {
  const scene = W.WORLD.scene, out = {};
  // each injection: its window (2 + 4 frames), then the same window with it removed (the CONTROL: the world streams
  // on between windows, so the injected counter must rise against the control as well as against the view)
  const probe = async (name, target, on, off) => {
    const n = on();
    const inj = await measure(2, 4);
    off();
    const ctl = await measure(2, 4);
    const red = compare(base, inj, '', '*', true).filter(x => x.state === 'RED');
    const vsCtl = compare(ctl, inj, '', '*', true).filter(x => x.state === 'RED' && target.test(x.key));
    out[name + '_x' + n] = { red: red.filter(x => target.test(x.key)).length && vsCtl.length ? red.length : 0,
      rows: red.filter(x => target.test(x.key)).slice(0, 3).map(x => x.key + ' ' + x.base + ' -> ' + x.now) };
  };
  // (a) an onBeforeRender on 100 of the meshes the main pass drew
  let drawn = [];
  const noop = function () {};
  await probe('a_onBeforeRender', /^cb\.onBeforeRender$/,
    () => { drawn = [...new Set(C.lastDrawn || [])].filter(o => !o.__fc_onBeforeRender).slice(0, 100); for (const o of drawn) o.onBeforeRender = noop; return drawn.length; },
    () => { for (const o of drawn) o.onBeforeRender = undefined; });
  // (b) a uniform set on every material, every frame: its colour nudged (a uniform3f per draw), or its first number uniform
  let list = [];
  await probe('b_uniformPerFrame', /^(gl\.uniform|bytes\.uniforms)/,
    () => { const mats = new Set(); scene.traverse(o => { if (o.material) for (const m of [].concat(o.material)) if (m) mats.add(m); }); list = [...mats];
      C.injectFrame = n => { const v = (n % 2) ? 1e-4 : -1e-4;
        for (const m of list) { if (m.color && m.color.isColor) m.color.r += v; if (m.emissive && m.emissive.isColor) m.emissive.r += v;
          if (m.uniforms) for (const k in m.uniforms) { const u = m.uniforms[k]; if (u && typeof u.value === 'number') u.value += v; } } };
      return list.length; },
    () => { C.injectFrame = null; });
  // (c) matrixAutoUpdate forced on the static props (everything the world set static)
  let stat = [];
  await probe('c_matrixAutoUpdate', /^three\.updateMatrix$/,
    () => { stat = []; scene.traverse(o => { if (o.matrixAutoUpdate === false) stat.push(o); }); for (const o of stat) o.matrixAutoUpdate = true; return stat.length; },
    () => { for (const o of stat) o.matrixAutoUpdate = false; });
  return out;
}
// ---- the comparison: baseline vs now, with the tolerance and the ALLOW list ---------------------------------------
function allowed(key, build, now) {
  return ALLOW.find(a => (a.key === key || (a.key.endsWith('/') && key.startsWith(a.key))) && (a.build === '*' || a.build === build) && now <= (a.upTo === undefined ? Infinity : a.upTo));
}
function compare(base, now, prefix, build, noAllow) {
  const out = [];
  const keys = new Set(Object.keys(base || {}).concat(Object.keys(now || {})));
  for (const k of [...keys].sort()) {
    const b = base && typeof base[k] === 'number' ? base[k] : 0, n = now && typeof now[k] === 'number' ? now[k] : 0;
    if (!(base && k in base) && !(now && k in now)) continue;
    if (typeof (base || {})[k] === 'object' || typeof (now || {})[k] === 'object') continue;
    const slack = Math.max(TOL.abs, Math.abs(b) * TOL.rel);
    let state = 'ok';
    if (n > b + slack) { const a = !noAllow && allowed(prefix + k, build, n); state = a ? 'ALLOW' : 'RED'; }
    else if (n < b - slack) state = 'down';
    out.push({ key: prefix + k, base: b, now: n, state });
  }
  return out;
}

// ---- the table ---------------------------------------------------------------------------------------------------
const VIEW_ROWS = ['draws.main', 'draws.shadow', 'draws.other', 'draws.total', 'gl.calls', 'programs', 'gl.useProgram', 'gl.bindTexture', 'gl.bindVertexArray',
  'gl.uniformMatrix4fv', 'gl.uniformMatrix3fv', 'gl.uniform4fv', 'gl.uniform3fv', 'gl.uniform2fv', 'gl.uniform1f', 'gl.uniform1fv', 'gl.uniform1i', 'bytes.uniforms',
  'gl.bufferData', 'gl.bufferSubData', 'bytes.bufferData', 'bytes.bufferSubData', 'gl.texImage2D', 'gl.texSubImage2D', 'three.renders', 'three.updateMatrixWorld', 'three.updateMatrix',
  'cb.onBeforeRender', 'cb.onAfterRender', 'cb.onShadow', 'cb.material.onBeforeRender', 'three.frustumTests', 'world.terrainH', 'world.grHeight'];
function printTable(rows, title) {
  console.log('  ' + title);
  const lab = x => x.state === 'ok' ? '' : UPDATE && x.state === 'RED' ? 'up (taken)' : UPDATE && x.state === 'down' ? 'down (taken)' : x.state;
  for (const r of rows) console.log('    ' + r.key.padEnd(44) + String(r.base).padStart(11) + String(r.now).padStart(11) + '  ' + lab(r));
}

// ---- the parent: two children, the ratchet ----------------------------------------------------------------------
function child(build) {
  return new Promise((res) => {
    const args = [__filename, '--census', build, '--frames', String(FRAMES), '--warm', String(WARM)];
    const p = spawn(process.execPath, ['--max-old-space-size=6144', '--expose-gc'].concat(args), { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
    p.on('close', code => { const line = out.trim().split('\n').pop(); try { res(JSON.parse(line)); } catch (e) { res({ build, failed: 'exit ' + code + ': ' + (err || out).slice(-800) }); } });
  });
}
function flatBoot(boot) { const r = {}; for (const [step, row] of Object.entries(boot || {})) for (const [k, v] of Object.entries(row)) r[step + '/' + k] = v; return r; }
const BOOT_KEYS = /\/(gl\.calls|draws\.total|links|bytes\.bufferData|bytes\.texImage2D|bytes\.uniforms|three\.updateMatrixWorld|three\.frustumTests|world\.terrainH|world\.grHeight)$/;

async function main() {
  if (flag('census')) { const r = await census(opt('census', 'cub')); process.stdout.write('\n' + JSON.stringify(r) + '\n'); process.exit(0); }
  if (flag('compare')) {
    // a whole census (--json) or one build's (--census's stdout: its last line)
    const load = f => { const t = fs.readFileSync(f, 'utf8').trim(), j = JSON.parse(t.startsWith('{') && !t.includes('\n{') ? t : t.split('\n').pop()); return j.builds ? j : { builds: { [j.build]: j } }; };
    const [a, b] = argv.slice(argv.indexOf('--compare') + 1, argv.indexOf('--compare') + 3).map(load);
    for (const build of Object.keys(b.builds || {})) {
      const A = a.builds[build], B = b.builds[build]; if (!A) continue;
      for (const v of Object.keys(B.views)) printTable(compare(A.views[v], B.views[v], v + '/', build, true).filter(r => r.state !== 'ok'), build + ' ' + v + ' (a -> b, what moved)');
      printTable(compare(flatBoot(A.boot), flatBoot(B.boot), 'boot/', build, true).filter(r => r.state !== 'ok' && BOOT_KEYS.test(r.key)), build + ' boot (a -> b, what moved)');
      // the texture upload bytes by boot step (reported: the ratchet's boot keys carry no texture bytes)
      const texB = boot => { const o = {}; let t = 0; for (const [k, r] of Object.entries(boot || {})) { const v = (r['bytes.texImage2D'] || 0) + (r['bytes.texSubImage2D'] || 0) + (r['bytes.texImage3D'] || 0) + (r['bytes.texSubImage3D'] || 0); if (v) { o[k] = v; t += v; } } o.total = t; return o; };
      { const ta = texB(A.boot), tb = texB(B.boot), M = x => ((x || 0) / 1048576).toFixed(1);
        console.log('  ' + build + ' texture upload MiB by step (a -> b): ' + Object.keys(Object.assign({}, ta, tb)).filter(k => ta[k] !== tb[k] || k === 'total').map(k => k + ' ' + M(ta[k]) + ' -> ' + M(tb[k])).join(', ')); }
      if (A.mem && B.mem) for (const at of Object.keys(B.mem)) console.log('  ' + build + ' memory after ' + at + ' (MiB, a -> b): ' + Object.keys(B.mem[at]).map(k => k + ' ' + A.mem[at][k] + ' -> ' + B.mem[at][k]).join(', '));
      for (const v of ['stand', 'taxi']) { if (!(B.craft || {})[v]) continue; const a2 = (A.craft || {})[v] || {}, b2 = B.craft[v];
        const row = k => ({ 'draws.main': k.draws && k.draws.main, 'draws.shadow': k.draws && k.draws.shadow, 'draws.other': k.draws && k.draws.other, skinnedDraws: k.skinnedDraws, materials: k.materials, programs: k.programs, meshes: k.meshes });
        printTable(compare(row(a2), row(b2), 'craft.' + v + '/', build, true), build + ' the aeroplane at ' + v + ' (a -> b)'); }
    }
    return;
  }
  console.log('GATE FRAMECOST');
  const t0 = Date.now();
  const res = await Promise.all(Object.keys(BUILDS).map(child));
  const CEN = { date: new Date().toISOString().slice(0, 10), frames: FRAMES, warm: WARM, builds: {} };
  let fails = 0;
  const ok = (c, msg, extra) => { console.log((c ? '  ok   ' : '  FAIL ') + msg + (extra !== undefined ? '  (' + extra + ')' : '')); if (!c) fails++; };
  for (const r of res) {
    ok(!r.failed, r.build + ': the page booted, rolled out and rendered its views', r.failed || ('garage ' + (r.wall.garage / 1000).toFixed(1) + ' s, roll-out ' + (r.wall.rollout / 1000).toFixed(1) + ' s, total ' + (r.wall.total / 1000).toFixed(1) + ' s wall; ' + r.programsTotal + ' programs; page errors ' + r.errorsN));
    if (!r.failed && r.mem) console.log('       memory after the roll-out (MiB, reported): ' + JSON.stringify(r.mem.rollout) + '; at the end ' + JSON.stringify(r.mem.end));
    if (r.failed) continue;
    ok(!!(r.views.stand && r.views.taxi), r.build + ': both views measured (stand, taxi)', r.views.taxi ? 'taxi at ' + r.views.taxi.pose.join(' ') : 'no taxi pose');
    if (r.craft) for (const v of ['stand', 'taxi']) { const k = r.craft[v]; if (!k) continue; console.log('  info ' + r.build + ' ' + v + ': the aeroplane draws ' + k.draws.main + ' main + ' + k.draws.shadow + ' shadow + ' + k.draws.other + ' other (' + k.skinnedDraws + ' skinned), ' + k.materials + ' materials, ' + k.programs + ' programs, ' + k.meshes + ' meshes'); }
    const H = r.health || {};
    ok(H.world === 'jolene' && H.premises && H.townCut > 0 && H.raster, r.build + ': the scene is the page\'s - Jolene, its premises composed with Metlakatla cut, the ground raster on', 'world ' + H.world + ', premises ' + H.premises + ', ' + H.townCut + ' mk_ entries cut, raster ' + H.raster + ', depth ' + H.depth);
    ok(H.gfx && H.gfx.preset === 'gamer' && H.gfx.shadows === 'full', r.build + ': graphics gamer, shadows full', JSON.stringify(H.gfx));
    const RL = r.release;
    ok(RL && RL.n >= 4 && RL.heldAfterRollout === 0 && RL.classWeights === false && RL.rederived === RL.n && RL.heldAfterRestore === RL.n && RL.heldAfterReupload === 0,
       r.build + ': the island textures keep no CPU copy after upload, the class weights are unbuilt, a lost context re-derives every one (G906)', JSON.stringify(RL));
    ok(!(H.thrown || []).length, r.build + ': no script, timer or frame of the page threw', (H.thrown || []).join(' | ') || undefined);
    CEN.builds[r.build] = r;
  }
  const base = fs.existsSync(BASE_FILE) ? JSON.parse(fs.readFileSync(BASE_FILE, 'utf8')) : null;
  // the proof first: each injected regression is RED
  const cub = CEN.builds.cub;
  if (cub && cub.selftest) for (const [k, v] of Object.entries(cub.selftest)) ok(v.red > 0, 'SELF-TEST ' + k + ' turns the gate red', v.red + ' counters: ' + v.rows.join('; '));
  else ok(false, 'SELF-TEST: the injections ran');
  const newBase = { note: 'GATE FRAMECOST baseline (tools/_framecost_check.js): per-frame MEDIANS over ' + FRAMES + ' frames per view (after ' + WARM + ' warm-up frames), and per boot step. Rewrite with --update.', date: CEN.date, frames: FRAMES, warm: WARM, builds: {} };
  let downs = 0, reds = 0, allows = 0;
  for (const [build, r] of Object.entries(CEN.builds)) {
    const nb = newBase.builds[build] = { views: {}, boot: {} };
    for (const [v, row] of Object.entries(r.views)) { nb.views[v] = Object.assign({}, row); delete nb.views[v].pose; }
    const fb = flatBoot(r.boot); for (const k of Object.keys(fb)) if (BOOT_KEYS.test('/' + k.split('/').slice(1).join('/')) || BOOT_KEYS.test(k)) nb.boot[k] = fb[k];
    const B = base && base.builds && base.builds[build];
    for (const v of Object.keys(nb.views)) {
      const rows = compare(B && B.views[v], nb.views[v], v + '/', build);
      const shown = rows.filter(x => VIEW_ROWS.includes(x.key.slice(v.length + 1)) || x.state !== 'ok');
      printTable(shown, build + ' · ' + v + (r.views[v].pose ? ' (' + r.views[v].pose.join(', ') + ')' : '') + ' · per frame: counter, baseline, now');
      for (const x of rows) { if (x.state === 'RED') reds++; if (x.state === 'down') downs++; if (x.state === 'ALLOW') allows++; }
      if (B && !UPDATE) for (const x of rows.filter(y => y.state === 'RED')) ok(false, build + ' ' + x.key + ' rose ' + x.base + ' -> ' + x.now + ' (tolerance ' + (TOL.rel * 100) + ' % / ' + TOL.abs + '; admit with an ALLOW entry: reason + G-number)');
    }
    const brow = compare(B && B.boot, nb.boot, 'boot/', build);
    const bshown = brow.filter(x => x.state !== 'ok' || /\/(gl\.calls|links)$/.test(x.key));
    printTable(bshown, build + ' · boot steps: counter, baseline, now');
    for (const x of brow) { if (x.state === 'RED') reds++; if (x.state === 'down') downs++; if (x.state === 'ALLOW') allows++; }
    if (B && !UPDATE) for (const x of brow.filter(y => y.state === 'RED')) ok(false, build + ' ' + x.key + ' rose ' + x.base + ' -> ' + x.now);
  }
  if (flag('json')) { fs.writeFileSync(opt('json'), JSON.stringify(CEN, null, 1)); console.log('  census -> ' + opt('json')); }
  if (flag('update') && fails) console.log('  baseline NOT rewritten: ' + fails + ' checks failed above (a census that did not run whole is no baseline)');
  else if (flag('update')) {
    fs.mkdirSync(path.dirname(BASE_FILE), { recursive: true });
    fs.writeFileSync(BASE_FILE, JSON.stringify(newBase, null, 1) + '\n');
    console.log('  baseline rewritten -> ' + path.relative(ROOT, BASE_FILE) + (base ? ' (' + reds + ' rises, ' + downs + ' falls taken in)' : ' (the first)'));
  } else {
    ok(!!base, 'the baseline exists (tools/perf/framecost_baseline.json; --update writes it)');
    if (downs) console.log('  ratchet down: ' + downs + ' counters fell below the baseline - run `node tools/_framecost_check.js --update` to keep the gain');
    if (allows) console.log('  ALLOWED: ' + allows + ' rises admitted by the ALLOW list');
  }
  console.log('  wall ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  console.log('GATE FRAMECOST: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
  process.exit(fails ? 1 : 0);
}
if (require.main !== module) module.exports = { census, compare, diff, mean, median, pageHooks, bootMark, NAMES }; else main().catch(e => { console.log('  FAIL ' + (e && e.stack || e)); console.log('GATE FRAMECOST: FAIL'); process.exit(1); });
