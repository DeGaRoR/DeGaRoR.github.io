#!/usr/bin/env node
// G1864 (DMG-D4b WRECK DRAWN): THE WRECK ON THE BOX - stills, the colour census, the drawn clip, the hitch. A client of
// tools/live_driver.js (a headed Chrome on the box's GPU, driven over 127.0.0.1:<cmd>): the real page, the user's Cub
// (builds/cub_2026-09-20_corrected.json), ?damage=1&simw=0 (the crash stepped in the page: the solver the worker runs),
// at the stand. TAKE THE GPU LOCK FIRST (tools/perf/boxlock.sh take gpu <who>), drop it after.
//   SPORT=8571 DPORT=9471 UDD=C:/d4b Q='damage=1&simw=0' node tools/live_driver.js <root> builds/cub_2026-09-20_corrected.json dev.html 8572 &
//   node tools/dmg_wreck_stills.js [--cmd 8572] [--out reports/evidence/DMG-D4b] [--cases trunk-0,trunk-2.5,nosein,taxi] [--boot]
// Each case is staged on the home strip as the gates stage it (the trunk the physics' own, drawn as a brown cylinder),
// stepped two physics steps a frame (so the page draws every moment: the releases, the strike, the binding) until the
// wreck and its debris are at rest, then frozen and shot from each camera THREE ways - AFTER (the wreck drawn: debris,
// the strike, the skin break), SKIN ONLY (window.FLYDIY_WRECK = false: D4a's drawing, no debris) and BEFORE (both off:
// the drawing until G1851). Per shot:
//   - THE COLOUR CENSUS (the user's test: the Cub is yellow, even crashed - grey or black on its outside is an inside
//     layer leaking through): the aeroplane's own pixels by flat masks (the scene black, the aeroplane white over it, the
//     depth kept: a tree in front hides it), less the parts that are not yellow by design (the glazing, the struts, the
//     wheels and legs, the prop and the engine), classed by hue: yellow, dark yellow (yellow in shadow), and the rest - the
//     'other' share is the number to watch (the black stripe, the letters and the cabin seen through the empty windows are
//     in it intact: the baseline, shot from the same cameras where the aeroplane is placed, before the crash);
//   - the frame's cost while the crash ran (the median and the worst, a frame's own ms: the first break's binding and
//     the releases are in the worst), and the wreck's own stats (FLYDIY_WRECK_STATS, FLYDIY_SKINBREAK_STATS).
// And for each case at rest THE DRAWN CLIP (§8.5 on the drawn geometry): every drawn triangle of the aeroplane in the
// world as it stands (the static merge, the parts, the debris), dumped by class - the exterior skin, the cabin's
// furniture (the seats, the panel and its hands, the controls, the crew), the debris bodies - and measured in node
// (tools/_mesh_query.js, signed distance on the drawn skin): furniture or debris vertices OUTSIDE / INSIDE the skin past
// a bound. -> <out>/<case>_<cam>_<after|skin|before>.jpg, stand_<cam>.jpg, stills.json
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const CMD = +opt('cmd', 8572);
const OUT = path.resolve(opt('out', path.join(__dirname, '..', 'reports', 'evidence', 'DMG-D4b')));
const post = (route, body) => new Promise((res, rej) => {
  const r = http.request({ host: '127.0.0.1', port: CMD, path: route, method: 'POST' }, s => { let b = ''; s.on('data', d => b += d); s.on('end', () => res(b)); });
  r.on('error', rej); r.setTimeout(600000, () => r.destroy(new Error('timeout'))); r.end(body);
});
const get = route => new Promise((res, rej) => http.get({ host: '127.0.0.1', port: CMD, path: route }, s => { let b = ''; s.on('data', d => b += d); s.on('end', () => res(b)); }).on('error', rej));
// (the page's helpers travel with every call: pageRunOn is pageStage's second half)
const run = async (fn, arg) => { const b = await post('/run', pageRunOn.toString() + ';\n' + pageStageW.toString() + ';\nreturn await (' + fn.toString() + ')(' + JSON.stringify(arg == null ? null : arg) + ');'); try { return JSON.parse(b); } catch (e) { return b; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const CASES = {
  'trunk-0':   { label: 'a trunk at 30 m/s, the centreline', o: { kind: 'trunk', D: 40, agl: 4, V: 30, off: 0, steps: 1500 }, cams: [[200, 22, 14], [300, 45, 20], [120, 12, 10]] },
  'trunk-2.5': { label: 'a trunk at 30 m/s, the wing 2.5 m out (DMG-D4a\'s wing still)', o: { kind: 'trunk', D: 40, agl: 4, V: 30, off: 2.5, steps: 1500 }, cams: [[200, 22, 16], [250, 55, 26]] },
  'nosein':    { label: 'a nose-in on the ground (180 km/h, 10 m/s, 60 deg; DMG-D4a\'s nose-in still)', o: { kind: 'ground', V: 50, sink: 10, pitch: 60, steps: 1500 }, cams: [[150, 20, 12], [235, 28, 14]] },
  // G1863: the cockpit rule - the severe nose-in watched from the pilot's eye; no stills, its verdict read
  'cockpit':   { label: 'the severe nose-in from the cockpit view (the camera rule)', o: { kind: 'ground', V: 50, sink: 10, pitch: 60, steps: 900 }, cams: [], cockpit: true },
  // the nose-over (the user; DMG-WALL's census staging): the Cub rolling at 12 m/s into a 35 cm stump that takes the wheels
  'noseover':  { label: 'a nose-over: 12 m/s on the ground into a 35 cm stump (the wheels stopped)', o: { kind: 'trunk', D: 12, agl: 0, V: 12, off: 0, top: 0.35, r: 0.25, steps: 1200, thr: 0 }, cams: [[200, 22, 9], [90, 15, 7], [300, 40, 10]] },
  'taxi':      { label: 'a taxi into a trunk at 3 m/s, the throttle shut (the prop strike: a wooden prop snaps, a metal one bends)', o: { kind: 'trunk', D: 6, agl: 0, V: 3, off: 0, steps: 700, thr: 0 }, cams: [[150, 8, 4.5], [215, 14, 6], ['nose', 10, 4.2], ['noseL', 6, 3.0]] },
};

// ---- in the page ----
// the UI hidden (the plates, the card), the camera
function pageView([az, el, dist]) {
  const s = document.getElementById('d4bHide') || document.createElement('style'); s.id = 'd4bHide';
  s.textContent = '#ui,#hud,.hud,#pfd,#mm,#topbar,.plate,#phase,#card,.card,#flLine,#bootFly{visibility:hidden!important}';
  document.head.appendChild(s);
  if (FLIGHT_PROBE.camModeNow() !== 'orbit') FLIGHT_PROBE.camMode('orbit');   // (the chase writes its own pose: camSet is the orbit's)
  // (az 'nose': a front-quarter close on the prop, from the aeroplane's own heading - the orbit is centred on the CG)
  // ('noseL': the other front quarter, closer - the bent blades' close-up)
  if (az === 'nose' || az === 'noseL') { const [xA] = FLIGHT_PROBE.sim().axes(); FLIGHT_PROBE.camSet(Math.atan2(-xA[2], -xA[0]) + (az === 'nose' ? 0.6 : -0.6), el * Math.PI / 180, dist); }
  else FLIGHT_PROBE.camSet(az * Math.PI / 180, el * Math.PI / 180, dist);
  return new Promise(r => setTimeout(() => r(1), 900));
}
// a JPEG of what the screen shows, made in the page from the CDP's PNG (no image library in node)
async function pageJpeg(png) {
  const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0);
  return c.toDataURL('image/jpeg', 0.86).slice(23);
}
// THE COLOUR CENSUS of the frame as it stands (see the header)
async function pageCensus() {
  // THE MASKS ARE FLAT RENDERS: the aeroplane drawn all white, then all black, everything else as it is - the difference
  // is the aeroplane alone, a tree or a wall in front of it hiding it. (Hiding the aeroplane in a lit frame, the first
  // cut, moved the craft's own shadow cascade and caught half the frame; a black scene with the aeroplane white still
  // drew the sky and the trees through the app's own passes.) The two materials are compiled before they count: a new
  // program is not ready on its first frame
  const P = FLIGHT_PROBE, m = P.model(), r = P.renderer(), cam = P.camera(), scene = P.craft().parent, B = m.wreckBuild;
  const cv = document.createElement('canvas'); cv.width = r.domElement.width >> 1; cv.height = r.domElement.height >> 1;
  const g = cv.getContext('2d', { willReadFrequently: true });
  const read = () => { g.drawImage(r.domElement, 0, 0, cv.width, cv.height); return g.getImageData(0, 0, cv.width, cv.height).data; };
  const wait = ms => new Promise(res => setTimeout(res, ms));
  const debris = scene.children.filter(c => /^wreckDebris:/.test(c.name || ''));
  scene.updateMatrixWorld(true);
  r.render(scene, cam);
  const A = read();
  // the parts that are not yellow by design: the struts, the wheels / legs / castor, the prop and the engine (bones in the
  // fold: hidden by their matrix), the glazing (its own meshes), the debris of those kinds
  const parts = new Set();
  const parentOfAttr = new Map(); for (const [mesh, par] of B.parentOf) if (mesh.geometry && mesh.geometry.attributes.position) parentOfAttr.set(mesh.geometry.attributes.position, par);
  for (const s of m.strutRigs || []) { const p = parentOfAttr.get(s.posAttr); if (p && p !== m.grp) parts.add(p); }
  for (const w of m.wheelParts || []) parts.add(w.obj);
  if (m.castorRig) parts.add(m.castorRig.obj);
  for (const s of m.stretchRigs || []) if (s.mesh) { const p = B.parentOf.get(s.mesh); if (p) parts.add(p); }
  for (const e of m.engRigs || []) parts.add(e.obj);
  const glass = []; for (const k in B.meshes0) { const mt = m.mats[k]; if (mt && mt.fin === 'glass' && B.meshes0[k].parent) glass.push(B.meshes0[k]); }
  const exDebris = debris.filter(d => /:(wheel|eng|blade|spinner|pane)$/.test(d.name));
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, side: THREE.DoubleSide, fog: false });
  const black = new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false, side: THREE.DoubleSide, fog: false });
  const craftMeshes = []; m.grp.traverse(o => { if (o.isMesh) craftMeshes.push(o); }); for (const d of debris) d.traverse(o => { if (o.isMesh) craftMeshes.push(o); });
  const flat = (mat, only) => {
    const sw = craftMeshes.map(o => o.material); for (const o of craftMeshes) o.material = mat;
    const undo = only ? only() : null;
    r.render(scene, cam); const X = read();
    if (undo) undo();
    craftMeshes.forEach((o, i) => { o.material = sw[i]; });
    return X;
  };
  flat(white); flat(black); await wait(500); flat(white); flat(black); await wait(300);   // (compiled)
  const hideParts = () => {
    const keep = [...parts].map(o => ({ o, auto: o.matrixAutoUpdate, M: o.matrix.clone(), vis: o.visible }));
    for (const k of keep) { k.o.matrixAutoUpdate = false; k.o.matrix.makeScale(1e-6, 1e-6, 1e-6); k.o.visible = false; }
    const gv = glass.map(x => x.visible); glass.forEach(x => { x.visible = false; });
    const dv = exDebris.map(x => x.visible); exDebris.forEach(x => { x.visible = false; });
    scene.updateMatrixWorld(true);
    return () => { for (const k of keep) { k.o.matrixAutoUpdate = k.auto; k.o.matrix.copy(k.M); k.o.visible = k.vis; if (k.auto) k.o.updateMatrix(); }
      glass.forEach((x, i) => { x.visible = gv[i]; }); exDebris.forEach((x, i) => { x.visible = dv[i]; }); scene.updateMatrixWorld(true); };
  };
  const glassOnly = () => {
    const kv = craftMeshes.map(c => c.visible); craftMeshes.forEach(c => { c.visible = glass.includes(c) || (c.parent && /:pane$/.test(c.parent.name || '')); });
    return () => { craftMeshes.forEach((c, i) => { c.visible = kv[i]; }); };
  };
  const diffMask = only => { const W = flat(white, only), K = flat(black, only), M = new Uint8Array(W.length >> 2);
    for (let i = 0, j = 0; i < W.length; i += 4, j++) M[j] = (W[i] + W[i+1] + W[i+2]) - (K[i] + K[i+1] + K[i+2]) > 300 ? 1 : 0; return M; };
  const MA = diffMask(null), MN = diffMask(hideParts), MG = diffMask(glassOnly);
  r.render(scene, cam);
  white.dispose(); black.dispose();
  let craftPx = 0, yellow = 0, dark = 0, other = 0, grey = 0, all = 0;
  for (let i = 0, j = 0; i < A.length; i += 4, j++) {
    if (MA[j]) all++;
    if (!MA[j] || !MN[j] || MG[j]) continue;
    craftPx++;
    const R = A[i] / 255, G = A[i+1] / 255, Bl = A[i+2] / 255, mx = Math.max(R, G, Bl), mn = Math.min(R, G, Bl), V = mx, S = mx > 0 ? (mx - mn) / mx : 0;
    let h = 0; if (mx > mn) { h = mx === R ? 60 * (((G - Bl) / (mx - mn)) % 6) : mx === G ? 60 * ((Bl - R) / (mx - mn) + 2) : 60 * ((R - G) / (mx - mn) + 4); if (h < 0) h += 360; }
    if (h >= 30 && h <= 68 && S > 0.35) { if (V > 0.32) yellow++; else dark++; }
    else { other++; if (S < 0.18) grey++; }
  }
  const pc = x => craftPx ? +(100 * x / craftPx).toFixed(1) : 0;
  return { px: craftPx, craftAll: all, yellow: pc(yellow), darkYellow: pc(dark), other: pc(other), greyOrBlack: pc(grey), w: cv.width, h: cv.height };
}
// the case staged and stepped (the gates' set-up on the home strip), two steps a frame until the wreck and its debris rest
// UNDER THE PHYSICS WORKER (the DEFAULT, A0's rule 2026-10-06): the worker flies its own copy, placed from the route and
// the stand, and the page's sim is a mirror - a rig may not touch p / v or step it (G1096). So the crash is staged on
// the flight that runs: the conditions calm (the worker reads its own wind: #selCond 'calm'), the hands on with the
// throttle shut, the aeroplane MOVED (FLIGHT_PROBE.place: a translation, the stand's own heading kept) onto the runway
// and settled, then pushed along its heading; the trunk is a tree hit (world.treeHits, which sim_link forwards to the
// worker). The run is the game's own, in real time, until the verdict and the debris rest; then the flight is paused for
// the stills. Trunk cases only: a pitched nose-in needs the aeroplane turned, which a placement cannot do.
async function pageStageW(o) {
  const P = FLIGHT_PROBE, world = P.world(), wait = ms => new Promise(r => setTimeout(r, ms));
  const SW = window.FLYDIY_SIMW, live = () => !!(SW && SW.state().phase === 'live' && SW.state().flight && SW.state().flight.live);
  if (o.kind !== 'trunk') return { err: 'worker: a ' + o.kind + ' case needs the aeroplane turned (only trunk cases under the worker)' };
  // (DMG-DRIVE2's find: a case staged on the last case's wreck - its flight 'over' - ran 0.8 s on the same broken members:
  // a fresh flight first - the card's own `Fly again` (fullReset) - and none staged on a sim still over)
  if (P.over() || (P.damage() && (P.damage().crashed || P.damage().over))) {
    if (!P.over()) P.endFlight('crashed');
    const g = document.getElementById('bGo'); if (g) g.click();
    for (let i = 0; i < 80 && (P.over() || (P.damage() && P.damage().crashed)); i++) await wait(250);
    if (P.over() || (P.damage() && P.damage().crashed)) return { err: 'worker: the wreck of the last case is still flying (the reset did not take) - not staged on it' };
  }
  window.FLYDIY_WRECK = !window.__d4bWreckOff; window.FLYDIY_SKINBREAK = true;
  const cond = document.getElementById('selCond');
  if (cond && [...cond.options].some(x => x.value === 'calm') && cond.value !== 'calm') { cond.value = 'calm'; cond.onchange({ target: cond }); }
  // the flight running, hands on, the throttle shut, the brakes off
  if (!P.over() && P.sim().t > 0.5 && P.damage() && P.damage().crashed) { /* a previous crash: the caller resets */ }
  P.sim().ctl.thr = 0; P.sim().ctl.brake = 0; P.setManual(true); P.sim().ctl.thr = 0;
  const go = document.getElementById('bGo'); if (go && go.offsetParent && !/roll out/i.test(go.textContent)) go.click();
  const pz = document.getElementById('bPause'); if (pz && /run/i.test(pz.textContent)) pz.click();
  for (let i = 0; i < 40 && !live(); i++) await wait(250);
  if (!live()) return { err: 'worker: no live worker flight (' + JSON.stringify(SW ? SW.state().phase : null) + ')' };
  P.sim().ctl.thr = 0; P.sim().ctl.brake = 0;
  // where: the home strip's centre, the aeroplane's own heading (the nose: -xA), the trunk on the strip, the start D back
  const strip = world.aerodromes.find(a => a.id === 'HOME') || world.aerodromes[0];
  const [xA] = P.sim().axes(), hl = Math.hypot(xA[0], xA[2]) || 1, fx = -xA[0] / hl, fz = -xA[2] / hl;
  const c0 = P.sim().cgPos(), hCg = c0[1] - world.terrainH(c0[0], c0[2]);
  const tx = strip.x - fz * (o.off || 0), tz = strip.z + fx * (o.off || 0), sx = strip.x - fx * o.D, sz = strip.z - fz * o.D;
  const gS = world.terrainH(sx, sz), gT = world.terrainH(tx, tz);
  if (world.treeHits.drop) world.treeHits.drop('fill:wreckstill');
  const scene = P.craft().parent;
  if (window.__d4bTrunk) { scene.remove(window.__d4bTrunk); window.__d4bTrunk = null; }
  await P.place({ at: [sx, gS + hCg + 0.05 + (o.agl || 0), sz], zeroV: true });
  if (!o.agl) await wait(1500);                                  // (on its wheels: settled)
  if (o.placeOnly) { P.sim().ctl.thr = 0; const pz2 = document.getElementById('bPause'); if (pz2 && /pause/i.test(pz2.textContent)) pz2.click(); await wait(600); return { placed: true, worker: true }; }
  const TR = o.r || 0.3, TH = o.top || 10;
  world.treeHits.set('fill:wreckstill', [tx, tz, gT, TR, gT + TH]);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(TR, TR * 1.17, TH, 20), new THREE.MeshStandardMaterial({ color: 0x5b4632, roughness: 0.95 }));
  m.position.set(tx, gT + TH / 2, tz); m.castShadow = true; scene.add(m); window.__d4bTrunk = m;
  window.__d4bO = o;
  const t0 = performance.now(), simT0 = P.sim().t;
  await P.place({ by: [0, 0, 0], zeroV: true, dv: [o.V * fx, 0, o.V * fz] });
  // the game's own run, real time: until the verdict and the debris at rest (2 s still), or 25 s
  let rest = 0, ms = [], tl = performance.now();
  while (performance.now() - t0 < 25000) {
    await new Promise(r => requestAnimationFrame(() => r())); const tn = performance.now(); ms.push(tn - tl); tl = tn;
    P.sim().ctl.thr = 0;
    const W = window.FLYDIY_WRECK_STATS(), D = P.damage();
    const settled = D && D.crashed && W.bodies.every(b => b.asleep) && P.sim().t - simT0 > 4;
    rest = settled ? rest + ms[ms.length - 1] : 0;
    if (rest > 2000) break;
  }
  const pz3 = document.getElementById('bPause'); if (pz3 && /pause/i.test(pz3.textContent)) pz3.click();   // (held for the stills)
  await wait(500);
  const D = P.damage() || {}, DS = P.sim().dmgState ? P.sim().dmgState() : null, q = ms.slice().sort((a, b) => a - b);
  return { worker: true, crashed: !!D.crashed, over: !!D.over, reason: D.reason || null, broken: (D.broken || []).length, brokeUp: !!D.brokeUp,
           pageBr: DS && DS.br ? DS.br.length : null, simT: +(P.sim().t - simT0).toFixed(2), wall: Math.round(performance.now() - t0),
           frameMed: q.length ? +q[q.length >> 1].toFixed(1) : null, frameMax: q.length ? +q[q.length - 1].toFixed(1) : null,
           wreck: window.FLYDIY_WRECK_STATS(), skin: window.FLYDIY_SKINBREAK_STATS() };
}
async function pageStage(o) {
  // (the DEFAULT mode is the physics worker: a page with a live worker flight is staged there)
  if (window.FLYDIY_SIMW && !/[?&]simw=0(&|$)/.test(location.search || '') && !(FLIGHT_PROBE.sim().dmgState == null && FLYDIY_SIMW.state().dead)) return pageStageW(o);
  if (o.run) return pageRunOn(o);
  const P = FLIGHT_PROBE, sim = P.sim(), world = P.world();
  if (sim.dmgState) return { err: 'worker: open with ?simw=0' };
  if (!window.__d4bStep) window.__d4bStep = sim.step;
  const step = window.__d4bStep;
  sim.step = () => {};
  window.FLYDIY_WRECK = !window.__d4bWreckOff; window.FLYDIY_SKINBREAK = true;
  // THE WIND OFF while staged (the solver reads world.wind every step, a gust field at sim.t: the same staging at another t
  // was another crash - 2.43 vs 3.11 kJ on the metal Cessna's taxi); back at the run's end (pageRunOn)
  if (!('__d4bWind' in window)) window.__d4bWind = world.wind;
  world.wind = null;
  const strip = world.aerodromes.find(a => a.id === 'HOME') || world.aerodromes[0];
  sim.reset(0); placeAtAerodrome(sim, strip);
  const n = sim.n, p = sim.p, v = sim.v, fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg);
  // ON THE RUNWAY (its centre less 300 m: open, flat, its trees cleared): the stand's is in the woods
  { const c = sim.cgPos(), dx = strip.x - 300 * fx - c[0], dz = strip.z - 300 * fz - c[2]; for (let i = 0; i < n; i++) { p[i*3] += dx; p[i*3+2] += dz; } }
  const c0 = sim.cgPos(), ground = world.terrainH(c0[0], c0[2]);
  let yMin = Infinity; for (let i = 0; i < n; i++) yMin = Math.min(yMin, p[i*3+1] - (sim.r[i] || 0));
  const scene = P.craft().parent;
  if (window.__d4bTrunk) { scene.remove(window.__d4bTrunk); window.__d4bTrunk = null; }
  if (world.treeHits.drop) world.treeHits.drop('fill:wreckstill');
  if (o.kind === 'trunk') {
    if (!o.agl) { for (let i = 0; i < n; i++) p[i*3+1] += ground - yMin + 0.02; for (let f = 0; f < 120; f++) step(1 / 60); }
    else for (let i = 0; i < n; i++) p[i*3+1] += ground - yMin + o.agl;
    for (let i = 0; i < n; i++) { v[i*3] = o.V * fx; v[i*3+2] = o.V * fz; if (o.agl) v[i*3+1] = 0; }
    const c = sim.cgPos(), tx = c[0] + fx * o.D - fz * o.off, tz = c[2] + fz * o.D + fx * o.off;
    // (o.r, o.top: a stump - the nose-over's, DMG-WALL's census staging: 0.25 m across, 0.35 m tall)
    const TR = o.r || 0.3, TH = o.top || 10;
    world.treeHits.set('fill:wreckstill', [tx, tz, ground, TR, ground + TH]);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(TR, TR * 1.17, TH, 20), new THREE.MeshStandardMaterial({ color: 0x5b4632, roughness: 0.95 }));
    m.position.set(tx, ground + TH / 2, tz); m.castShadow = true; scene.add(m); window.__d4bTrunk = m;
  } else {
    const [xA, , zR] = sim.axes(), cg = sim.cgPos(), th = -o.pitch * Math.PI / 180, k = zR, cs = Math.cos(th), sn = Math.sin(th);
    for (let i = 0; i < n; i++) {
      const d = [p[i*3] - cg[0], p[i*3+1] - cg[1], p[i*3+2] - cg[2]], kd = k[0]*d[0] + k[1]*d[1] + k[2]*d[2];
      const cr = [k[1]*d[2] - k[2]*d[1], k[2]*d[0] - k[0]*d[2], k[0]*d[1] - k[1]*d[0]];
      for (let j = 0; j < 3; j++) p[i*3+j] = cg[j] + d[j] * cs + cr[j] * sn + k[j] * kd * (1 - cs);
    }
    let y2 = Infinity; for (let i = 0; i < n; i++) y2 = Math.min(y2, p[i*3+1] - (sim.r[i] || 0));
    const hl = Math.hypot(xA[0], xA[2]);
    for (let i = 0; i < n; i++) { p[i*3+1] += ground + 0.3 - y2; v[i*3] = -o.V * xA[0] / hl; v[i*3+1] = -o.sink; v[i*3+2] = -o.V * xA[2] / hl; }
  }
  // (DMG-DRIVE2's find: the page's own loop writes the controls every frame from the input - input.js write(): ctl.thr =
  // S.throttle.out - so a throttle set once ran at 0.62 between the steps: hands on, as the worker path, and the controls
  // zeroed before every step pair in pageRunOn)
  P.setManual(true); sim.ctl.thr = o.thr || 0; sim.ctl.brake = 0;
  window.__d4bO = o;
  // (the placement held: the page draws it still for the intact census, then pageRunOn steps it)
  if (o.placeOnly) { const raf0 = () => new Promise(r => requestAnimationFrame(() => r())); for (let f = 0; f < 6; f++) await raf0(); return { placed: true }; }
  return pageRunOn(o);
}
async function pageRunOn(o) {
  const P = FLIGHT_PROBE, sim = P.sim(), step = window.__d4bStep;
  const raf = () => new Promise(r => requestAnimationFrame(() => r()));
  const ms = [], trace = [];
  const FRr = window.FLIGHT_REC && window.FLIGHT_REC.rec, C = FRr ? FRr.COLS : null, col = k => C ? C.indexOf(k) : -1;
  let s = 0, settled = 0, t1 = performance.now(); window.__d4bMountT = null;
  for (; s < (o.steps || 1200); s += 2) {
    sim.ctl.thr = (window.__d4bO && window.__d4bO.thr) || 0;
    const p0 = performance.now(); step(1 / 60); step(1 / 60); const phys = performance.now() - p0;
    await raf();
    const t2 = performance.now(); ms.push(t2 - t1); t1 = t2;
    // G1869: THE FRAME'S OWN SPLIT - the physics (stepped here, two steps), the recorder's slots for the frame the page drew
    // (the pose and the skin break and the debris are its `scene`, the submit `render`, the links `shader`), the skin
    // break's and the debris' own part of the scene, the damage state's events
    const f = FRr ? FRr.frame - 1 : -1, v = k => (f >= 0 && col(k) >= 0 ? +FRr.val(f, col(k)).toFixed(2) : null);
    const SB2 = window.FLYDIY_SKINBREAK_STATS ? window.FLYDIY_SKINBREAK_STATS().ms : {}, WM = window.FLYDIY_WRECK_STATS ? window.FLYDIY_WRECK_STATS().ms : {};
    trace.push({ t: +sim.t.toFixed(3), ms: +ms[ms.length - 1].toFixed(1), phys: +phys.toFixed(2), work: v('work'), scene: v('scene'), render: v('render'), shader: v('shader'), shadow: v('shadow'),
      brk: SB2.lastT === sim.t ? +(SB2.last || 0).toFixed(2) : 0, brkRec: SB2.lastT === sim.t ? +(SB2.lastRec || 0).toFixed(2) : 0, brkEv: SB2.lastT === sim.t ? +(SB2.lastEv || 0).toFixed(2) : 0,
      brkPose: SB2.lastT === sim.t ? +(SB2.lastPose || 0).toFixed(2) : 0, wreck: +(WM.frame || 0).toFixed(2), broken: sim.damage().broken.length });
    const W = window.FLYDIY_WRECK_STATS(), D = sim.damage();
    // (the first engine-mount member to break and when - the coordinator: the mount first, or the strike?)
    if (window.__d4bMountT == null && D.broken.length) { const df = P.def(); for (const bi of D.broken) { const b = sim.beams[bi], ta = df.nodes[b.a].tag || '', tb = df.nodes[b.b].tag || '', ea = /^(ENG|CGE)/.test(ta), eb = /^(ENG|CGE)/.test(tb); if (ea !== eb) { window.__d4bMountT = { t: +sim.t.toFixed(3), member: ta + '-' + tb }; break; } } }
    if ((D.over || (!D.crashed && s > 400)) && W.bodies.every(b => b.asleep)) { if (++settled > 40) break; }
  }
  if ('__d4bWind' in window) { P.world().wind = window.__d4bWind; delete window.__d4bWind; }
  const D = sim.damage(), q = ms.slice().sort((a, b) => a - b);
  return { steps: s, crashed: D.crashed, over: !!D.over, reason: D.reason, broken: D.broken.length, brokeUp: !!D.brokeUp,
    mountFirst: window.__d4bMountT, frameMed: +q[q.length >> 1].toFixed(1), frameP95: +q[Math.floor(q.length * 0.95)].toFixed(1), frameMax: +q[q.length - 1].toFixed(1), trace: o.trace ? trace : undefined,
    wreck: window.FLYDIY_WRECK_STATS(), skin: window.FLYDIY_SKINBREAK_STATS() };
}
// THE TEAR CENSUS (the user's review: "why are the wings lacerated like this?"): the members broken (names), the plastic
// work, the impact's energy; and per wing side (the triangle's rest centroid z in the frame's own coordinates) the
// covering triangles gone, by the rule that took them - skin_break's dead codes: 1 spanned two pieces / crossed a broken
// member (the event), 2 the stretch tear (a fabric record's own; WALL's tube or sheet bound on a tube / sheet record;
// the confetti islands counted apart), 3 the wall cut, 4 gone with its covering, 5 taken by a debris body
function pageTears() {
  const P = FLIGHT_PROBE, sim = P.sim(), def = P.def(), m = P.model(), tg = i => def.nodes[i].tag || i;
  // (under the worker the page's own sim is never stepped: the breaks are the mirror's dmgState, the work the worker's verdict)
  const DS = sim.dmgState ? sim.dmgState() : null, V0 = P.damage() || {}, D0 = sim.damage ? sim.damage() : {};
  const D = DS ? { broken: DS.br || [], work: V0.work != null ? V0.work : NaN, reason: V0.reason || null } : D0;
  const o = window.__d4bO || {}, M = sim.totalM || 0, V = o.V || 0, sink = o.sink || 0;
  const out = { broken: D.broken.length, members: D.broken.map(i => tg(sim.beams[i].a) + '-' + tg(sim.beams[i].b)), workJ: Math.round(D.work || 0),
                energyJ: Math.round(0.5 * M * (V * V + sink * sink)), reason: D.reason, wings: {}, other: {} };
  const recs = window.FLYDIY_SKINBREAK_RECS ? FLYDIY_SKINBREAK_RECS() : [];
  const NAME = { 1: 'pieces/broken member', 3: 'wall cut', 4: 'with its covering', 5: 'debris' };
  for (const R of recs) {
    if (!R.dead || !R.idx0 || !R.baseD) continue;
    const mt = m.mats && R.secName ? m.mats[R.secName] : null, sec = (mt && mt.sec) || R.secName || '?';
    const wing = /wing|ail|flap|tip/i.test(sec);
    const rule2 = R.tubeTear ? 'tube tear (WALL)' : R.sheetTear ? 'sheet tear (WALL)' : 'stretch tear';
    for (let t = 0; t < R.nt; t++) {
      const c = R.dead[t];
      let z = 0; for (let k = 0; k < 3; k++) z += R.baseD[R.idx0[t * 3 + k] * 3 + 2] / 3;
      const side = z >= 0 ? 'z+' : 'z-', key = wing ? side : sec;
      const B = wing ? (out.wings[key] = out.wings[key] || { tris: 0, gone: 0, by: {} }) : (out.other[key] = out.other[key] || { tris: 0, gone: 0, by: {} });
      B.tris++;
      if (!c) continue;
      B.gone++; const why = c === 2 ? rule2 : (NAME[c] || 'code ' + c); B.by[why] = (B.by[why] || 0) + 1;
      if (wing) { B.secs = B.secs || {}; B.secs[sec] = (B.secs[sec] || 0) + 1; }   // (which sections the 'wing' count is made of)
    }
    if (R.islN && wing) { let z = 0; for (let v = 0; v < Math.min(R.nv, 50); v++) z += R.baseD[v * 3 + 2]; const B = out.wings[z >= 0 ? 'z+' : 'z-']; if (B) B.islands = (B.islands || 0) + R.islN; }
  }
  return out;
}
// THE DRAWN CLIP's dump: every drawn triangle of the aeroplane in the world, by class (base64 Float32 x 9 a triangle)
function pageDump() {
  const P = FLIGHT_PROBE, m = P.model(), B = m.wreckBuild, scene = P.craft().parent;
  m.grp.updateMatrixWorld(true);
  const out = { skin: [], furniture: [], debris: [], parts: [] };
  const v = new THREE.Vector3();
  const worldOf = mesh => { const M = new THREE.Matrix4().copy(mesh.matrix);
    for (let q = B.parentOf.get(mesh) || mesh.parent; q && q !== m.grp; q = q.parent) { if (q.matrixAutoUpdate) q.updateMatrix(); M.premultiply(q.matrix); }
    return M.premultiply(m.grp.matrixWorld); };
  const push = (L, g, M) => { if (!g || !g.attributes.position) return; const pa = g.attributes.position.array, nt = g.index ? g.index.count / 3 : pa.length / 9;
    const ix = g.index ? g.index.array : null;
    for (let t = 0; t < nt; t++) { const a = ix ? ix[t*3] : t*3, b = ix ? ix[t*3+1] : t*3+1, c = ix ? ix[t*3+2] : t*3+2; if (a === b && b === c) continue;
      for (const k of [a, b, c]) { v.set(pa[k*3], pa[k*3+1], pa[k*3+2]).applyMatrix4(M); L.push(v.x, v.y, v.z); } } };
  const furn = (mt, key) => !!(mt && (mt.char || mt.panel || /seat|dash|panel|yoke|stick|pedal|dummy/i.test((mt.sec || '') + key)));
  for (const [mesh, par] of B.parentOf) {
    if (mesh.userData && mesh.userData.propDisc) continue;
    const key = B.keyOf.get(mesh) || Object.keys(B.meshes0).find(k => B.meshes0[k] === mesh) || '';
    const mt = m.mats[key];
    if (!mt) continue;
    // a hidden part (gone as debris) collapses its matrix: its triangles land on a point and are skipped by size below
    const M = par === m.grp ? m.grp.matrixWorld : worldOf(mesh);
    if (Math.abs(M.determinant()) < 1e-12) continue;
    const L = furn(mt, key) ? out.furniture : (par === m.grp && !mt.inside && mt.fin !== 'glass' && !mt.lamp && !mt.lampCup) ? out.skin : out.parts;
    push(L, mesh.geometry, M);
  }
  for (const d of scene.children) if (/^wreckDebris:/.test(d.name || '') && d.visible) { d.updateMatrixWorld(true); for (const c of d.children) push(out.debris, c.geometry, c.matrixWorld); }
  const b64 = a => { const f = new Float32Array(a); let s = ''; const u = new Uint8Array(f.buffer); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  return { skin: b64(out.skin), furniture: b64(out.furniture), debris: b64(out.debris), parts: b64(out.parts) };
}

// ---- in node: the drawn clip, measured (signed distance to the drawn exterior skin, tools/_mesh_query.js) ----
// furniture OUTSIDE the skin (a seat, the panel, the crew, a control through a crushed side) and debris INSIDE it (a
// cowl panel or a pane come to rest in the cabin) past 3 cm; the skin's own sign is its pseudonormal's (an open skin -
// a torn wreck - reads a point beside a hole by its nearest real skin). Sampled: every vertex of the furniture, every
// third triangle's corners of the debris
function clipOf(dump) {
  const MQ = require(path.join(__dirname, '_mesh_query.js'));
  const f32 = s => { const b = Buffer.from(s, 'base64'); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); };
  const skin = f32(dump.skin);
  if (!skin.length) return { err: 'no skin drawn' };
  const P = Float64Array.from(skin), I = new Uint32Array(P.length / 3); for (let i = 0; i < I.length; i++) I[i] = i;
  const Q = MQ.build(P, I, { quant: 1e-4 }); Q.orient();
  const stat = (arr, outsideBad, every) => { const a = f32(arr); let n = 0, bad = 0, worst = 0;
    for (let i = 0; i < a.length; i += 9 * every) for (let k = 0; k < 3; k++) {
      const q = Q.signedDist([a[i + k * 3], a[i + k * 3 + 1], a[i + k * 3 + 2]], 2); if (!q || !Number.isFinite(q.d)) continue; n++;
      // (only through a FACE: a point beside a hole reads its rim, which never votes beyond itself - a seat in a torn-open
      // cabin is in the open, not through its wall)
      const pen = outsideBad ? q.d : -q.d; if (pen > 0.03 && q.region === 0) { bad++; if (pen > worst) worst = pen; } }
    return { sampled: n, past3cm: bad, share: n ? +(bad / n).toFixed(4) : 0, worst: +worst.toFixed(3) }; };
  return { skinTris: skin.length / 9, furnitureOutside: stat(dump.furniture, true, 1), debrisInside: stat(dump.debris, false, 3) };
}

module.exports = { run, post, get, CASES, pageStage, pageView, pageCensus, pageTears };
if (require.main === module) (async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const names = opt('cases', Object.keys(CASES).join(',')).split(',');
  const R = { at: new Date().toISOString(), cases: {} };
  const shoot = async file => { const tmp = file + '.png'; await get('/shot?f=' + encodeURIComponent(tmp)); const png = fs.readFileSync(tmp).toString('base64'); fs.unlinkSync(tmp);
    const jpg = await run(pageJpeg, png); fs.writeFileSync(file, Buffer.from(jpg, 'base64')); return path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/'); };
  try { R.standClip = clipOf(await run(pageDump)); } catch (e) { R.standClip = { err: String(e && e.message || e) }; }
  console.log('stand clip ' + JSON.stringify(R.standClip));
  for (const k of names) {
    const C = CASES[k], out = { label: C.label, shots: [] };
    // intact, where it will crash: the census's baseline from the case's own cameras (the stripe, the letters)
    await run(pageStage, Object.assign({}, C.o, { placeOnly: true }));
    out.intact = [];
    for (const [ci, c] of C.cams.entries()) { await run(pageView, c); out.intact.push({ cam: c, census: await run(pageCensus), file: ci === 0 ? await shoot(path.join(OUT, k + '_' + (ci + 1) + '_intact.jpg')) : null }); }
    if (C.cockpit) await post('/run', "FLIGHT_PROBE.camMode('cockpit'); await new Promise(r => setTimeout(r, 1500)); return FLIGHT_PROBE.camModeNow();");
    out.stage = await run(pageStage, Object.assign({}, C.o, { run: true }));
    if (C.cockpit) { out.camAfter = await post('/run', 'return FLIGHT_PROBE.camModeNow();'); out.eye = out.stage.wreck && { cut: out.stage.wreck.eyeCut, eye: out.stage.wreck.eye, cab: out.stage.wreck.cab };
      await post('/run', "FLIGHT_PROBE.camMode('chase'); return 1;"); }
    console.log(k, JSON.stringify(out.stage).slice(0, 600));
    // (the user's review: does the cowl come off - each cowl panel and the spinner, its reason and its distortion)
    if (out.stage && out.stage.wreck) console.log('  ' + k + ' cowl: ' + out.stage.wreck.parts.filter(p => p.kind === 'cowl' || p.kind === 'spinner' || p.kind === 'eng')
      .map(p => p.kind + ' ' + (p.gone ? 'OFF (' + p.why + (p.crush != null ? ', ' + Math.round(p.crush * 100) + ' cm' : '') + ')' : 'on' + (p.crush != null ? ' (' + Math.round(p.crush * 100) + ' cm)' : ''))).join(', '));
    if (out.stage && out.stage.wreck) console.log('  ' + k + ' strikes: ' + (out.stage.wreck.strikes || []).map(x => 'engine ' + x.eng + ' at t ' + x.t + ' ' + (x.drive ? 'DRIVE ' + x.drive + (x.biteR != null ? ' biteR ' + (+x.biteR).toFixed(3) : '') + (x.surf ? ' ' + x.surf : '') : 'own strike') + ' ' + x.material + ' curl ' + x.curl.join('/') + ' cut ' + x.cut.join('/')).join('; '));
    if (out.stage) console.log('  ' + k + ' mount first: ' + JSON.stringify(out.stage.mountFirst || null));
    // (the user's review: the tear census - which members, how much work, which rule took each wing's covering)
    try { out.tears = await run(pageTears);
      const W = out.tears.wings, f = b => b ? b.gone + '/' + b.tris + ' gone (' + Object.entries(b.by).map(([r, n]) => r + ' ' + n).join(', ') + (b.islands ? '; islands ' + b.islands : '') + (b.secs ? '; by section ' + JSON.stringify(b.secs) : '') + ')' : 'n/a';
      console.log('  ' + k + ' tears: ' + out.tears.broken + ' members broken, work ' + out.tears.workJ + ' J of ' + out.tears.energyJ + ' J; wing z+ ' + f(W['z+']) + '; wing z- ' + f(W['z-']));
      console.log('  ' + k + ' members: ' + out.tears.members.join(' '));
    } catch (e) { console.log('  ' + k + ' tears: ' + (e && e.message)); }
    if (out.stage && out.stage.err) { R.cases[k] = out; continue; }
    // the wreck drawn first from every camera, then D4a's alone, then neither (a heal does not fly the debris again: it
    // would re-release them from the wreck at rest)
    for (const [tag, wreck, skin] of [['after', true, true], ['skin', false, true], ['before', false, false]]) {
      await post('/run', 'window.FLYDIY_WRECK = ' + wreck + '; window.FLYDIY_SKINBREAK = ' + skin + '; await new Promise(r => setTimeout(r, 700)); return 1;');
      if (tag === 'after') { try { const dump = await run(pageDump); if (opt('dump', null)) fs.writeFileSync(path.join(opt('dump'), k + '_dump.json'), JSON.stringify(dump));
          out.clip = clipOf(dump); } catch (e) { out.clip = { err: String(e && e.message || e) }; } }
      for (const [ci, c] of C.cams.entries()) {
        await run(pageView, c);
        const census = await run(pageCensus);
        const file = await shoot(path.join(OUT, k + '_' + (ci + 1) + '_' + tag + '.jpg'));
        out.shots.push({ cam: c, tag, file, census });
      }
    }
    await post('/run', 'window.FLYDIY_WRECK = true; window.FLYDIY_SKINBREAK = true; return 1;');
    R.cases[k] = out;
    fs.writeFileSync(path.join(OUT, 'stills.json'), JSON.stringify(R, null, 1));
  }
  fs.writeFileSync(path.join(OUT, 'stills.json'), JSON.stringify(R, null, 1));
  console.log('WRECK_STILLS ' + JSON.stringify(Object.fromEntries(Object.entries(R.cases).map(([k, c]) => [k, { intact: (c.intact || []).map(s => s.census.other), shots: (c.shots || []).map(s => [s.tag, s.census && s.census.other]) }]))));
})().catch(e => { console.log('WRECK_STILLS_FAIL ' + (e && e.stack || e)); process.exit(1); });
