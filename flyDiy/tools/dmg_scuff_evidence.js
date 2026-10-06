#!/usr/bin/env node
// G2007 (DMG-SCUFF): THE EVIDENCE ON THE BOX - the damage drawn on the real page, the user's Cub crashed, before / after
// at fixed cameras and the close-ups the brief asks for (a scrape, a crease, a torn edge, a cracked windscreen), the
// program links in the crash window counted (the rule: ZERO), the block's GPU cost timed, the scuff's own costs read.
// A client of tools/live_driver.js (a headed Chrome on the box's GPU), as DMG-WALL's census (its staging verbatim: the
// home strip, the wind off, the trunk the physics' own drawn as a brown cylinder). TAKE THE GPU LOCK FIRST
// (bash flyDiy/tools/perf/boxlock.sh take gpu DMG-SCUFF "<note>"), drop it after.
//   SPORT=8701 DPORT=9601 UDD=C:/dmgscuff Q='damage=1&simw=0' node tools/live_driver.js <repo> builds/cub_2026-09-20_corrected.json dev.html 8702
//   node tools/dmg_scuff_evidence.js --cmd 8702 --boot [--out reports/evidence/DMG-SCUFF/box/cub] [--cases trunk-0,taxi,noseover]
//   ...and the metal Cessna (bare-alloy scrapes): the same with 'bugReports/cessnaMetal (1).json' and --out .../box/metal
//   --keys: the program cache keys and their count only (run once with Q='damage=0' on this branch and once on the base:
//           the two lists must be the same - damage OFF changes no program)
// Per case: <case>_<cam>_intact.jpg (staged, before the crash), <case>_<cam>_after.jpg (the wreck, the damage drawn),
// <case>_<cam>_noscuff.jpg (the same frame, the block's branch off: FLYDIY_SCUFF_SHOW(false) - no program changes),
// <case>_close_<layer>.jpg (the camera 1.3 m off the most damaged vertex of that layer), evidence.json (every number).
// In the cloud the same page functions run as a soft_still.js --stage module (SwiftShader: a picture, never a time):
//   node tools/dmg_scuff_evidence.js --soft [--out reports/evidence/DMG-SCUFF/soft]
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const has = k => argv.indexOf('--' + k) >= 0;
const CMD = +opt('cmd', 8702);
const OUT = path.resolve(opt('out', path.join(__dirname, '..', 'reports', 'evidence', 'DMG-SCUFF', has('soft') ? 'soft' : 'box')));

// the brief's three (DMG-WALL's census cases and cameras: [azimuth deg, elevation deg, distance m] about the CG)
const CASES = {
  'trunk-0':  { label: 'a trunk at 30 m/s, the centreline', o: { kind: 'trunk', D: 40, agl: 4, V: 30, off: 0, steps: 1500 }, cams: [[200, 22, 14], [300, 45, 20], [120, 12, 7]] },
  'taxi':     { label: 'a taxi into a trunk at 3 m/s, the throttle shut', o: { kind: 'trunk', D: 6, agl: 0, V: 3, off: 0, steps: 700, thr: 0 }, cams: [[150, 8, 4.5], [215, 14, 6]] },
  'noseover': { label: 'a nose-over: 12 m/s on the ground into a 35 cm stump', o: { kind: 'trunk', D: 12, agl: 0, V: 12, off: 0, top: 0.35, r: 0.25, steps: 1200, thr: 0 }, cams: [[200, 22, 9], [90, 15, 7], [300, 40, 10]] },
};

// ---- in the page ----
// the link census: every linkProgram from here on (the prototype's: three resolves it at each call)
function pageLinksInstall() {
  if (window.__dsL) return window.__dsL.n;
  const L = window.__dsL = { n: 0 }, P = WebGL2RenderingContext.prototype, lp = P.linkProgram;
  P.linkProgram = function (p) { L.n++; return lp.call(this, p); };
  return 0;
}
function pageLinks() { return { links: window.__dsL ? window.__dsL.n : -1, programs: FLIGHT_PROBE.renderer().info.programs.length }; }
function pageKeys() {
  const ks = FLIGHT_PROBE.renderer().info.programs.map(p => p.cacheKey);
  let h = 0x811c9dc5; for (const s of ks.slice().sort()) for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return { n: ks.length, hash: h.toString(16), scuff: ks.filter(k => /dmg\.scuff/.test(k)).length, keys: ks.map(k => k.length > 400 ? k.slice(0, 400) + '...' : k) };
}
function pageView([az, el, dist]) {
  const s = document.getElementById('dsHide') || document.createElement('style'); s.id = 'dsHide';
  s.textContent = '#ui,#hud,.hud,#pfd,#mm,#topbar,.plate,#phase,#card,.card,#flLine,#bootFly,#arrCard{visibility:hidden!important}';
  document.head.appendChild(s);
  if (FLIGHT_PROBE.camModeNow() !== 'orbit') FLIGHT_PROBE.camMode('orbit');
  FLIGHT_PROBE.camSet(az * Math.PI / 180, el * Math.PI / 180, dist);
  return new Promise(r => setTimeout(() => r(1), 900));
}
async function pageJpeg(png) {
  const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0);
  return c.toDataURL('image/jpeg', 0.88).slice(23);
}
// DMG-WALL's staging (dmg_wall_census.js pageStage), the wind off for the run
async function pageStage(o) {
  const P = FLIGHT_PROBE, sim = P.sim(), world = P.world();
  if (sim.dmgState) return { err: 'worker: open with ?simw=0' };
  if (!window.__dsStep) window.__dsStep = sim.step;
  const step = window.__dsStep;
  sim.step = () => {};
  if (window.FLYDIY_SCUFF_SHOW) window.FLYDIY_SCUFF_SHOW(true);
  if (!('__dsWind0' in window)) window.__dsWind0 = world.wind;
  world.wind = null;
  const strip = world.aerodromes.find(a => a.id === 'HOME') || world.aerodromes[0];
  sim.reset(0); placeAtAerodrome(sim, strip);
  const n = sim.n, p = sim.p, v = sim.v, fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg);
  { const c = sim.cgPos(), dx = strip.x - 300 * fx - c[0], dz = strip.z - 300 * fz - c[2]; for (let i = 0; i < n; i++) { p[i*3] += dx; p[i*3+2] += dz; } }
  const c0 = sim.cgPos(), ground = world.terrainH(c0[0], c0[2]);
  let yMin = Infinity; for (let i = 0; i < n; i++) yMin = Math.min(yMin, p[i*3+1] - (sim.r[i] || 0));
  const scene = P.craft().parent;
  if (window.__dsTrunk) { scene.remove(window.__dsTrunk); window.__dsTrunk = null; }
  if (world.treeHits.drop) world.treeHits.drop('fill:scuffstill');
  if (!o.agl) { for (let i = 0; i < n; i++) p[i*3+1] += ground - yMin + 0.02; for (let f = 0; f < 120; f++) step(1 / 60); }
  else for (let i = 0; i < n; i++) p[i*3+1] += ground - yMin + o.agl;
  for (let i = 0; i < n; i++) { v[i*3] = o.V * fx; v[i*3+2] = o.V * fz; if (o.agl) v[i*3+1] = 0; }
  const c = sim.cgPos(), tx = c[0] + fx * o.D - fz * o.off, tz = c[2] + fz * o.D + fx * o.off, R = o.r || 0.3, H = o.top || 10;
  world.treeHits.set('fill:scuffstill', [tx, tz, ground, R, ground + H]);
  const mm = new THREE.Mesh(new THREE.CylinderGeometry(R, R + 0.05, H, 20), new THREE.MeshStandardMaterial({ color: 0x5b4632, roughness: 0.95 }));
  mm.position.set(tx, ground + H / 2, tz); mm.castShadow = true; scene.add(mm); window.__dsTrunk = mm;
  sim.ctl.thr = o.thr || 0;
  const raf = () => new Promise(r => requestAnimationFrame(() => r()));
  if (o.placeOnly) { for (let f = 0; f < 8; f++) await raf(); return { placed: true, scuff: window.FLYDIY_SCUFF_STATS ? FLYDIY_SCUFF_STATS() : null }; }
  // THE CRASH WINDOW: from the first step to the last pass of the damage drawn (+ a second): the links counted
  const L0 = window.__dsL ? window.__dsL.n : -1, prog0 = P.renderer().info.programs.length;
  const ms = []; let s = 0, settled = 0, t1 = performance.now();
  // (o.fast, the cloud's SwiftShader: a frame is seconds there - the crash stepped in one go, as DMG-D4a's soft stills
  // stepped theirs, then the page's frames carry the skin and the damage drawn to rest)
  for (; s < (o.steps || 1200); s += 2) {
    step(1 / 60); step(1 / 60);
    if (!o.fast) { await raf(); const t2 = performance.now(); ms.push(t2 - t1); t1 = t2; }
    const D = sim.damage();
    if (D.over || (!D.crashed && s > 500)) { if (++settled > 40) break; }
  }
  if (!ms.length) ms.push(0);
  for (let f = 0; f < (o.fast ? 240 : 600); f++) { await raf(); const S = window.FLYDIY_SCUFF_STATS && FLYDIY_SCUFF_STATS(); if (S && S.on && !S.busy && S.passes > 0 && f > 4) break; }
  for (let f = 0; f < (o.fast ? 4 : 60); f++) await raf();
  if ('__dsWind0' in window) { world.wind = window.__dsWind0; delete window.__dsWind0; }
  const D = sim.damage(), q = ms.slice().sort((a, b) => a - b);
  return { steps: s, crashed: D.crashed, over: !!D.over, reason: D.reason, broken: D.broken.length, yields: D.yields, work: Math.round(D.work), slid: Math.round(D.scW || 0),
           frameMed: +q[q.length >> 1].toFixed(1), frameMax: +q[q.length - 1].toFixed(1),
           links: window.__dsL ? window.__dsL.n - L0 : null, programsAdded: P.renderer().info.programs.length - prog0,
           scuff: window.FLYDIY_SCUFF_STATS ? FLYDIY_SCUFF_STATS() : null, skin: window.FLYDIY_SKINBREAK_STATS ? FLYDIY_SKINBREAK_STATS() : null };
}
// the hottest vertex of a layer (0 crush, 1 scrape, 2 torn; 'glass' the pane's impact), in the world - the camera's aim
function pageHot(layer) {
  const P = FLIGHT_PROBE, m = P.model(), at = m && m.scuff;
  if (!at || !at.recs.length) return null;
  m.grp.updateMatrixWorld(true);
  const M = m.grp.matrixWorld, v3 = new THREE.Vector3();
  let best = null;
  if (layer === 'glass') {
    const pn = at.st.panes.filter(Q => Q.slot >= 0).sort((a, b) => b.sev - a.sev)[0];
    if (!pn) return null;
    const pa = pn.R.geo.attributes.position; v3.fromBufferAttribute(pa, pn.at).applyMatrix4(M);
    return { p: v3.toArray(), v: pn.sev, cls: 4 };
  }
  for (const R of at.recs) {
    const r = R.sc.rec, cls = R.sc.cls; if (cls === 4) continue;
    // a CREASE is fabric's crush: prefer fabric for the crush close-up, the sheet's where there is none
    const pref = layer === 0 ? (cls === 1 ? 1 : 0.6) : 1;
    for (let v = 0; v < R.nv; v++) { const x = r[v * 4 + layer] * pref; if (x > 0 && (!best || x > best.x)) best = { x, R, v, cls }; }
  }
  if (!best) return null;
  const R = best.R, pa = R.geo.attributes.position;
  if (R.active && R.w && R.ride && R.ride[best.v]) v3.set(R.w[best.v * 3], R.w[best.v * 3 + 1], R.w[best.v * 3 + 2]);
  else v3.fromBufferAttribute(pa, best.v).applyMatrix4(M);
  return { p: v3.toArray(), v: best.x / 255, cls: best.cls };
}
// the orbit set so the eye stands `d` metres off a world point on the line from the orbit's target through it
// (placeCamera: eye = target + dist (cos el cos az, sin el, cos el sin az))
function pageAim([px, py, pz, d]) {
  const g = FLIGHT_PROBE.camGet(), t = g.target, ux = px - t[0], uy = py - t[1], uz = pz - t[2], L = Math.hypot(ux, uy, uz) || 1;
  const el = Math.asin(Math.max(-0.95, Math.min(0.95, uy / L))), az = Math.atan2(uz, ux);
  FLIGHT_PROBE.camSet(az, el, L + d);
  return new Promise(r => setTimeout(() => r({ az: az * 180 / Math.PI, el: el * 180 / Math.PI, dist: L + d }), 900));
}
// THE BLOCK'S GPU COST on the frame in view: N frames timed with the branch on and off (EXT_disjoint_timer_query_webgl2
// round renderer.render when the context has it; the rAF interval's median otherwise - a CPU-side bound)
async function pageCost(N) {
  N = N || 60;
  const r = FLIGHT_PROBE.renderer(), gl = r.getContext(), X = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const raf = () => new Promise(res => requestAnimationFrame(() => res()));
  const run = async on => {
    window.FLYDIY_SCUFF_SHOW(on);
    for (let f = 0; f < 10; f++) await raf();
    const qs = [], ms = []; let t1 = performance.now();
    const rd = r.render;
    if (X) r.render = function () { const q = gl.createQuery(); gl.beginQuery(X.TIME_ELAPSED_EXT, q); const o = rd.apply(this, arguments); gl.endQuery(X.TIME_ELAPSED_EXT); qs.push(q); return o; };
    for (let f = 0; f < N; f++) { await raf(); const t2 = performance.now(); ms.push(t2 - t1); t1 = t2; }
    r.render = rd;
    for (let f = 0; f < 10; f++) await raf();
    const gpu = [];
    for (const q of qs) { if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) && !gl.getParameter(X.GPU_DISJOINT_EXT)) gpu.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(q); }
    const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? +s[s.length >> 1].toFixed(3) : null; };
    return { frameMed: med(ms), gpuMed: med(gpu), gpuN: gpu.length };
  };
  const off = await run(false), on = await run(true), off2 = await run(false), on2 = await run(true);
  window.FLYDIY_SCUFF_SHOW(true);
  return { timer: !!X, off, on, off2, on2 };
}
async function pageBootStep(k) {
  if (k === 'ready') return await Promise.race([(window.BOOT && BOOT.whenReady) ? BOOT.whenReady().then(() => 'ready') : new Promise(r => setTimeout(() => r('no BOOT'), 18500)), new Promise(r => setTimeout(() => r('boot timeout'), 240000))]);
  if (k === 'go') { const g = document.getElementById('bGo'); if (g) { g.click(); return 'bGo'; } [...document.querySelectorAll('button')].filter(b => /roll out/i.test(b.textContent)).forEach(x => x.click()); return 'roll'; }
  if (k === 'flying') return !!window.FLIGHT_PROBE && (/TAXI|DOWNWIND|FINAL|DEPART/.test(document.body.innerText) || (window.BOOT && BOOT.state === 'loading'));
  if (k === 'keep') { const l = [...document.querySelectorAll('button,a,div')].filter(b => /keep the current build/i.test(b.textContent || '') && b.children.length === 0 && b.offsetParent); l.forEach(x => x.click()); return l.length; }
  if (k === 'state') return window.BOOT ? BOOT.state : 'none';
  return null;
}

// the client (the box): one page function a /run
const post = (route, body) => new Promise((res, rej) => {
  const r = http.request({ host: '127.0.0.1', port: CMD, path: route, method: 'POST' }, s => { let b = ''; s.on('data', d => b += d); s.on('end', () => res(b)); });
  r.on('error', rej); r.setTimeout(900000, () => r.destroy(new Error('timeout'))); r.end(body);
});
const get = route => new Promise((res, rej) => http.get({ host: '127.0.0.1', port: CMD, path: route }, s => { let b = ''; s.on('data', d => b += d); s.on('end', () => res(b)); }).on('error', rej));
const PAGE_FNS = [pageLinksInstall, pageLinks, pageKeys, pageView, pageJpeg, pageStage, pageHot, pageAim, pageCost, pageBootStep];
const runBox = async (fn, arg) => { const b = await post('/run', 'return await (' + fn.toString() + ')(' + JSON.stringify(arg == null ? null : arg) + ');'); try { return JSON.parse(b); } catch (e) { return b; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// THE SEQUENCE, the same on both hosts: run(fn, arg) evaluates a page function, shot(file) writes a JPEG
async function sequence(run, shot, log, names) {
  const R = { at: new Date().toISOString(), cases: {} };
  R.install = await run(pageLinksInstall);
  R.links0 = await run(pageLinks);
  R.scuff0 = await run(() => (window.FLYDIY_SCUFF_STATS ? FLYDIY_SCUFF_STATS() : null));
  log('scuff at the stand ' + JSON.stringify(R.scuff0) + ' ' + JSON.stringify(R.links0));
  for (const k of names) {
    const C = CASES[k], out = { label: C.label, shots: [] };
    out.place = await run(pageStage, Object.assign({}, C.o, { placeOnly: true }));
    for (const [ci, c] of C.cams.entries()) { await run(pageView, c); out.shots.push({ cam: c, kind: 'intact', file: await shot(k + '_' + (ci + 1) + '_intact.jpg') }); }
    out.crash = await run(pageStage, Object.assign({}, C.o, { fast: !!process.env.SCUFF_FAST }));
    log(k + ' crash ' + JSON.stringify(out.crash).slice(0, 900));
    if (out.crash && out.crash.err) { R.cases[k] = out; continue; }
    for (const [ci, c] of C.cams.entries()) {
      await run(pageView, c);
      out.shots.push({ cam: c, kind: 'after', file: await shot(k + '_' + (ci + 1) + '_after.jpg') });
      await run(() => window.FLYDIY_SCUFF_SHOW(false)); await run(() => new Promise(r => setTimeout(() => r(1), 400)));
      out.shots.push({ cam: c, kind: 'noscuff', file: await shot(k + '_' + (ci + 1) + '_noscuff.jpg') });
      await run(() => window.FLYDIY_SCUFF_SHOW(true));
    }
    // the close-ups: a scrape, a crease (fabric's crush), a torn edge, the cracked pane
    out.close = {};
    for (const [lab, layer] of [['scrape', 1], ['crease', 0], ['torn', 2], ['glass', 'glass']]) {
      const h = await run(pageHot, layer);
      if (!h) { out.close[lab] = null; continue; }
      const aim = await run(pageAim, h.p.concat([lab === 'glass' ? 1.1 : 1.3]));
      out.close[lab] = { hot: h, aim, file: await shot(k + '_close_' + lab + '.jpg') };
      await run(() => window.FLYDIY_SCUFF_SHOW(false)); await run(() => new Promise(r => setTimeout(() => r(1), 400)));
      out.close[lab].fileOff = await shot(k + '_close_' + lab + '_noscuff.jpg');
      await run(() => window.FLYDIY_SCUFF_SHOW(true));
    }
    // the block's cost on the wreck in view (the first camera)
    await run(pageView, C.cams[0]);
    out.cost = await run(pageCost, +(process.env.SCUFF_COSTN || 60));
    log(k + ' cost ' + JSON.stringify(out.cost));
    out.linksEnd = await run(pageLinks);
    R.cases[k] = out;
  }
  return R;
}

module.exports = async function softStage(page, { shot, log }) {
  // tools/soft_still.js --stage: the page is at the stand (rolled out); the cases run the same way
  fs.mkdirSync(OUT, { recursive: true });
  const run = async (fn, arg) => page.evaluate(`(${fn.toString()})(${JSON.stringify(arg == null ? null : arg)})`);
  const sh = async name => { await shot(path.join(OUT, name)); return name; };
  const names = (process.env.SCUFF_CASES || 'taxi,noseover,trunk-0').split(',');
  const R = await sequence(run, sh, log, names);
  fs.writeFileSync(path.join(OUT, 'evidence.json'), JSON.stringify(R, null, 1));
  return { skipMain: true, cases: Object.keys(R.cases) };
};
module.exports.CASES = CASES;
module.exports.pageFns = PAGE_FNS;

if (require.main === module) (async () => {
  if (has('soft')) {
    // the cloud: soft_still.js boots the page on SwiftShader and runs this file as its stage
    const S = require('./soft_still.js');
    const size = opt('size', '1280x720').split('x').map(Number);
    process.env.SCUFF_FAST = '1'; if (!process.env.SCUFF_COSTN) process.env.SCUFF_COSTN = '4';
    const o = Object.assign(S.parse(), { page: 'dev.html', build: path.join(__dirname, '..', opt('build', 'builds/cub_2026-09-20_corrected.json')), q: 'damage=1&simw=0&fog=0', size,
      stage: __filename, out: path.join(OUT, 'stand.jpg'), secs: +opt('secs', 7200), day: 'noon' });
    fs.mkdirSync(OUT, { recursive: true });
    const R = await S.still(o);
    console.log('SCUFF_SOFT ' + JSON.stringify({ stage: R.stage, errors: R.errors, t: R.t }).slice(0, 3000));
    process.exit(R.stage && !R.stage.err ? 0 : 1);
  }
  fs.mkdirSync(OUT, { recursive: true });
  if (has('boot')) {
    console.log('boot ' + await runBox(pageBootStep, 'ready')); await sleep(800);
    let flying = false;
    for (let a = 0; a < 8 && !flying; a++) { await runBox(pageBootStep, 'go'); await sleep(6000); flying = await runBox(pageBootStep, 'flying'); }
    for (let i = 0; i < 20; i++) { const n = await runBox(pageBootStep, 'keep'); await sleep(500); if (!n && i > 4) break; }
    let bs = ''; for (let i = 0; i < 300; i++) { bs = await runBox(pageBootStep, 'state'); if (bs === 'gone' || bs === 'none') break; await sleep(1000); }
    console.log('rolled out: ' + flying + ', boot ' + bs); await sleep(2000);
  }
  if (has('keys')) { const K = await runBox(pageKeys); fs.writeFileSync(path.join(OUT, 'keys.json'), JSON.stringify(K, null, 1)); console.log('keys ' + K.n + ' hash ' + K.hash + ' (dmg.scuff: ' + K.scuff + ')'); return; }
  const shot = async name => { const file = path.join(OUT, name), tmp = file + '.png'; await get('/shot?f=' + encodeURIComponent(tmp));
    const png = fs.readFileSync(tmp).toString('base64'); fs.unlinkSync(tmp); const jpg = await runBox(pageJpeg, png); fs.writeFileSync(file, Buffer.from(jpg, 'base64')); return name; };
  const names = opt('cases', Object.keys(CASES).join(',')).split(',');
  const R = await sequence(runBox, shot, s => console.log(s), names);
  R.keys = await runBox(pageKeys); delete R.keys.keys;
  fs.writeFileSync(path.join(OUT, 'evidence.json'), JSON.stringify(R, null, 1));
  console.log('DMG_SCUFF_EVIDENCE ' + JSON.stringify(Object.fromEntries(Object.entries(R.cases).map(([k, c]) => [k, { links: c.crash && c.crash.links, cost: c.cost, frameMax: c.crash && c.crash.frameMax, scuff: c.crash && c.crash.scuff && { tick: c.crash.scuff.tickMs, frame: c.crash.scuff.frameMs, torn: c.crash.scuff.tornMs } }]))));
})().catch(e => { console.error(e); process.exit(1); });
