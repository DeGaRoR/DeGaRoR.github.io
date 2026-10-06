#!/usr/bin/env node
// G1858 (DMG-WALL): THE YELLOW CENSUS, LAYER BY LAYER - the user's test (2026-10-05: "the Cub should be yellow, even
// crashed; grey/black = the inside leaking out"), on the box, every grey patch ATTRIBUTED. A client of tools/live_driver.js
// (a headed Chrome on the box's GPU): the real page, the user's Cub, ?damage=1&simw=0. TAKE THE GPU LOCK FIRST
// (bash D:/Dev/DeGaRoR.github.io/flyDiy/tools/perf/boxlock.sh take gpu DMG-WALL "<note>"), drop it after.
//   SPORT=8691 DPORT=9591 UDD=C:/dmgwall Q='damage=1&simw=0' node tools/live_driver.js D:/Dev/dmgwall builds/cub_2026-09-20_corrected.json dev.html 8692
//   node tools/dmg_wall_census.js [--cmd 8692] [--boot] [--out reports/evidence/DMG-WALL/<tag>] [--cases trunk-0,trunk-2.5,taxi,noseover]
//        [--modes before,g1858,after]   (before: ?wallbind=0 + ?skinwall=0, the drawing until now; g1858: + the lining cut; after: the inherited binding)
// The stage is DMG-D4b's (tools/dmg_wreck_stills.js on claude/dmg-d4b-wreck, its pageStage / pageView / the flat masks,
// without its debris): each case staged on the home strip, the trunk the physics' own (a brown cylinder), stepped two
// physics steps a frame until it is over, then frozen and shot. Per shot:
//   - THE CENSUS: the aeroplane's own pixels (flat white-minus-black masks: a tree in front hides it), less the parts that
//     are not yellow by design (the glazing, the struts, the wheels and legs, the castor, the engine, the prop), classed
//     by hue on the lit frame: yellow, dark yellow (in shadow), other;
//   - THE ATTRIBUTION: the same frame drawn once more with every vertex coloured by WHAT it is (its payload bucket's
//     section: aeroskin's role) - the covering white (its BACK face red), the liner magenta, the frame's structure (tubes,
//     bulkheads, the firewall, the reveals) cyan, the fireproof sheet orange, the sill / door pads purple, the dash and
//     the cabin's furniture blue, the beads / seals / pane edges green, a part (not a payload bucket) grey - so every
//     'other' pixel of the lit frame is told by the layer drawn there. -> <case>_<cam>_<mode>.jpg + _cls.jpg, census.json
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const has = k => argv.indexOf('--' + k) >= 0;
const CMD = +opt('cmd', 8692);
const OUT = path.resolve(opt('out', path.join(__dirname, '..', 'reports', 'evidence', 'DMG-WALL', 'census')));
const post = (route, body) => new Promise((res, rej) => {
  const r = http.request({ host: '127.0.0.1', port: CMD, path: route, method: 'POST' }, s => { let b = ''; s.on('data', d => b += d); s.on('end', () => res(b)); });
  r.on('error', rej); r.setTimeout(900000, () => r.destroy(new Error('timeout'))); r.end(body);
});
const get = route => new Promise((res, rej) => http.get({ host: '127.0.0.1', port: CMD, path: route }, s => { let b = ''; s.on('data', d => b += d); s.on('end', () => res(b)); }).on('error', rej));
const run = async (fn, arg) => { const b = await post('/run', pageRunOn.toString() + ';\nreturn await (' + fn.toString() + ')(' + JSON.stringify(arg == null ? null : arg) + ');'); try { return JSON.parse(b); } catch (e) { return b; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// the cases: the brief's four (the trunk at 30 m/s on the centreline and 2.5 m out, the 3 m/s taxi into a trunk, a
// nose-over: the Cub rolling at 12 m/s into a 35 cm stump that takes the wheels - it goes over on its back)
const CASES = {
  'trunk-0':   { label: 'a trunk at 30 m/s, the centreline', o: { kind: 'trunk', D: 40, agl: 4, V: 30, off: 0, steps: 1500 }, cams: [[200, 22, 14], [300, 45, 20], [120, 12, 7]] },
  'trunk-2.5': { label: 'a trunk at 30 m/s, the wing 2.5 m out', o: { kind: 'trunk', D: 40, agl: 4, V: 30, off: 2.5, steps: 1500 }, cams: [[200, 22, 16], [250, 55, 26], [140, 15, 7]] },
  'taxi':      { label: 'a taxi into a trunk at 3 m/s, the throttle shut', o: { kind: 'trunk', D: 6, agl: 0, V: 3, off: 0, steps: 700, thr: 0 }, cams: [[150, 8, 4.5], [215, 14, 6]] },
  'noseover':  { label: 'a nose-over: 12 m/s on the ground into a 35 cm stump (the wheels stopped)', o: { kind: 'trunk', D: 12, agl: 0, V: 12, off: 0, top: 0.35, r: 0.25, steps: 1200, thr: 0 }, cams: [[200, 22, 9], [90, 15, 7], [300, 40, 10], [180, 72, 11]] },
};

// ---- in the page ----
function pageView([az, el, dist]) {
  const s = document.getElementById('dwHide') || document.createElement('style'); s.id = 'dwHide';
  s.textContent = '#ui,#hud,.hud,#pfd,#mm,#topbar,.plate,#phase,#card,.card,#flLine,#bootFly,#arrCard{visibility:hidden!important}';
  document.head.appendChild(s);
  if (FLIGHT_PROBE.camModeNow() !== 'orbit') FLIGHT_PROBE.camMode('orbit');
  FLIGHT_PROBE.camSet(az * Math.PI / 180, el * Math.PI / 180, dist);
  return new Promise(r => setTimeout(() => r(1), 900));
}
async function pageJpeg(png) {
  const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0);
  return c.toDataURL('image/jpeg', 0.86).slice(23);
}
// THE CENSUS + THE ATTRIBUTION (see the header). Returns the numbers and the class frame as a JPEG
async function pageCensus() {
  const P = FLIGHT_PROBE, m = P.model(), r = P.renderer(), cam = P.camera(), scene = P.craft().parent, B = m.wreckBuild, A0 = window.AEROSKIN;
  const cv = document.createElement('canvas'); cv.width = r.domElement.width >> 1; cv.height = r.domElement.height >> 1;
  const g = cv.getContext('2d', { willReadFrequently: true });
  const read = () => { g.drawImage(r.domElement, 0, 0, cv.width, cv.height); return g.getImageData(0, 0, cv.width, cv.height).data; };
  const wait = ms => new Promise(res => setTimeout(res, ms));
  scene.updateMatrixWorld(true);
  r.render(scene, cam);
  const A = read();
  // the parts that are not yellow by design (DMG-D4b's set)
  const parts = new Set();
  const parentOfAttr = new Map(); for (const [mesh, par] of B.parentOf) if (mesh.geometry && mesh.geometry.attributes.position) parentOfAttr.set(mesh.geometry.attributes.position, par);
  for (const s of m.strutRigs || []) { const p = parentOfAttr.get(s.posAttr); if (p && p !== m.grp) parts.add(p); }
  for (const w of m.wheelParts || []) if (w.obj) parts.add(w.obj);
  if (m.castorRig) parts.add(m.castorRig.obj);
  for (const s of m.stretchRigs || []) if (s.mesh) { const p = B.parentOf.get(s.mesh); if (p) parts.add(p); }
  for (const e of m.engRigs || []) if (e.obj) parts.add(e.obj);
  const glass = []; for (const k in B.meshes0) { const mt = m.mats[k]; if (mt && mt.fin === 'glass' && B.meshes0[k].parent) glass.push(B.meshes0[k]); }
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, side: THREE.DoubleSide, fog: false });
  const black = new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false, side: THREE.DoubleSide, fog: false });
  const craftMeshes = []; m.grp.traverse(o => { if (o.isMesh) craftMeshes.push(o); });
  const flat = (mat, only) => {
    const sw = craftMeshes.map(o => o.material); for (const o of craftMeshes) o.material = typeof mat === 'function' ? mat(o) : mat;
    const undo = only ? only() : null;
    r.render(scene, cam); const X = read();
    if (undo) undo();
    craftMeshes.forEach((o, i) => { o.material = sw[i]; });
    return X;
  };
  const hideParts = () => {
    const keep = [...parts].map(o => ({ o, auto: o.matrixAutoUpdate, M: o.matrix.clone(), vis: o.visible }));
    for (const k of keep) { k.o.matrixAutoUpdate = false; k.o.matrix.makeScale(1e-6, 1e-6, 1e-6); k.o.visible = false; }
    const gv = glass.map(x => x.visible); glass.forEach(x => { x.visible = false; });
    scene.updateMatrixWorld(true);
    return () => { for (const k of keep) { k.o.matrixAutoUpdate = k.auto; k.o.matrix.copy(k.M); k.o.visible = k.vis; if (k.auto) k.o.updateMatrix(); }
      glass.forEach((x, i) => { x.visible = gv[i]; }); scene.updateMatrixWorld(true); };
  };
  const glassOnly = () => { const kv = craftMeshes.map(c => c.visible); craftMeshes.forEach(c => { c.visible = glass.includes(c); });
    return () => { craftMeshes.forEach((c, i) => { c.visible = kv[i]; }); }; };
  // THE CLASS OF EVERY DRAWN VERTEX: each drawn geometry's vertices mapped back to the payload bucket they came from -
  // the bucket's own geometry, a still merge (its names in order), or a fold (the buckets' arrays are views into it)
  const CLS = { outer: [1, 1, 1], liner: [1, 0, 1], struct: [0, 1, 1], fire: [1, 0.5, 0], sill: [0.5, 0, 1], cabin: [0, 0, 1], trim: [0, 1, 0], part: [0.5, 0.5, 0.5] };
  const keyOfMesh = new Map(); for (const k in B.meshes0) keyOfMesh.set(B.meshes0[k], k);
  const clsOfKey = k => { const mt = m.mats[k] || {}, sec = mt.sec, role = sec && A0 ? A0.AERO_ROLE[sec] : null;
    if (mt.fin === 'glass' || role === 'glass' || role === 'bead' || role === 'seal' || role === 'edge') return 'trim';
    if (role === 'liner') return 'liner'; if (role === 'struct') return 'struct'; if (role === 'fire') return 'fire';
    if (role === 'sill' || role === 'doorPad') return 'sill'; if (role === 'pad' || role === 'panel') return 'cabin';
    if (mt.inside || mt.char) return 'cabin';
    return 'outer'; };
  const origByBuf = [];   // [array, cls]
  for (const [mesh] of B.parentOf) { const pa = mesh.geometry && mesh.geometry.attributes.position; if (!pa || !pa.array) continue;
    const k = keyOfMesh.get(mesh); origByBuf.push([pa.array, k ? clsOfKey(k) : 'part', mesh]); }
  const added = [];
  for (const o of craftMeshes) {
    const geo = o.geometry, pa = geo && geo.attributes.position; if (!pa || !pa.array) continue;
    if (geo.attributes.dwCls) continue;
    const n = pa.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0.5; }
    const arr = pa.array, st = (pa.data && pa.data.stride) || 3;
    if (o.userData && o.userData.still) {
      let vo = 0; for (const nm of o.userData.still) { const g0 = B.meshes0[nm] && B.meshes0[nm].geometry, c = g0 ? g0.attributes.position.count : 0, cl = CLS[clsOfKey(nm)];
        for (let v = vo; v < vo + c && v < n; v++) col.set(cl, v * 3); vo += c; }
    } else for (const [a, cls] of origByBuf) {
      if (a.buffer !== arr.buffer) continue;
      const off = Math.round((a.byteOffset - arr.byteOffset) / 4 / st), c = Math.floor(a.length / 3), cl = CLS[cls];
      if (off < 0 || off >= n) continue;
      for (let v = off; v < off + c && v < n; v++) col.set(cl, v * 3);
    }
    geo.setAttribute('dwCls', new THREE.BufferAttribute(col, 3)); added.push(geo);
  }
  // the class material: the bucket's colour, the covering's back face red; skinned / morphed folds keep their chunks
  const clsMats = new Map();
  const clsMat = o => { const key = (o.isSkinnedMesh ? 's' : '') + (o.isInstancedMesh ? 'i' : '');
    let mt = clsMats.get(key); if (mt) return mt;
    mt = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, side: THREE.DoubleSide, fog: false });
    mt.onBeforeCompile = sh => {
      sh.vertexShader = 'attribute vec3 dwCls;\nvarying vec3 vDw;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vDw = dwCls;');
      sh.fragmentShader = 'varying vec3 vDw;\n' + sh.fragmentShader.replace(/}\s*$/, ' gl_FragColor = vec4((!gl_FrontFacing && vDw.r > 0.99 && vDw.g > 0.99 && vDw.b > 0.99) ? vec3(1.0, 0.0, 0.0) : vDw, 1.0);\n}');
    };
    mt.customProgramCacheKey = () => 'dwCls' + key;
    clsMats.set(key, mt); return mt; };
  flat(white); flat(black); flat(clsMat); await wait(500); flat(white); flat(black); flat(clsMat); await wait(300);   // (compiled)
  const diffMask = only => { const W = flat(white, only), K = flat(black, only), M = new Uint8Array(W.length >> 2);
    for (let i = 0, j = 0; i < W.length; i += 4, j++) M[j] = (W[i] + W[i+1] + W[i+2]) - (K[i] + K[i+1] + K[i+2]) > 300 ? 1 : 0; return M; };
  const MA = diffMask(null), MN = diffMask(hideParts), MG = diffMask(glassOnly);
  const C = flat(clsMat, hideParts);
  // the class frame as a picture (the aeroplane's pixels only, the rest dimmed)
  const pic = g.createImageData(cv.width, cv.height);
  for (let i = 0, j = 0; i < C.length; i += 4, j++) { const on = MA[j] && MN[j]; pic.data[i] = on ? C[i] : A[i] >> 2; pic.data[i+1] = on ? C[i+1] : A[i+1] >> 2; pic.data[i+2] = on ? C[i+2] : A[i+2] >> 2; pic.data[i+3] = 255; }
  r.render(scene, cam);
  for (const geo of added) geo.deleteAttribute('dwCls');
  white.dispose(); black.dispose(); for (const mt of clsMats.values()) mt.dispose();
  g.putImageData(pic, 0, 0); const clsJpg = cv.toDataURL('image/jpeg', 0.86).slice(23);
  const names = Object.keys(CLS).concat(['back']), pal = Object.values(CLS).concat([[1, 0, 0]]);
  const near = (R, G, Bl) => { let b = 0, bd = Infinity; pal.forEach((p, k) => { const d = (p[0] * 255 - R) ** 2 + (p[1] * 255 - G) ** 2 + (p[2] * 255 - Bl) ** 2; if (d < bd) { bd = d; b = k; } }); return names[b]; };
  let craftPx = 0, yellow = 0, dark = 0, other = 0, grey = 0;
  const byAll = {}, byOther = {};
  for (const k of names) { byAll[k] = 0; byOther[k] = 0; }
  for (let i = 0, j = 0; i < A.length; i += 4, j++) {
    if (!MA[j] || !MN[j] || MG[j]) continue;
    craftPx++;
    const R = A[i] / 255, G = A[i+1] / 255, Bl = A[i+2] / 255, mx = Math.max(R, G, Bl), mn = Math.min(R, G, Bl), V = mx, S = mx > 0 ? (mx - mn) / mx : 0;
    let h = 0; if (mx > mn) { h = mx === R ? 60 * (((G - Bl) / (mx - mn)) % 6) : mx === G ? 60 * ((Bl - R) / (mx - mn) + 2) : 60 * ((R - G) / (mx - mn) + 4); if (h < 0) h += 360; }
    const cl = near(C[i], C[i+1], C[i+2]); byAll[cl]++;
    if (h >= 30 && h <= 68 && S > 0.35) { if (V > 0.32) yellow++; else dark++; }
    else { other++; byOther[cl]++; if (S < 0.18) grey++; }
  }
  const pc = x => craftPx ? +(100 * x / craftPx).toFixed(2) : 0;
  const pcs = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v).map(([k, v]) => [k, pc(v)]));
  return { px: craftPx, yellow: pc(yellow), darkYellow: pc(dark), other: pc(other), greyOrBlack: pc(grey),
           otherBy: pcs(byOther), allBy: pcs(byAll), clsJpg, w: cv.width, h: cv.height };
}
// the case staged and stepped (DMG-D4b's set-up on the home strip, no debris), two steps a frame until it is over
async function pageStage(o) {
  if (o.run) return pageRunOn(o);
  const P = FLIGHT_PROBE, sim = P.sim(), world = P.world();
  if (sim.dmgState) return { err: 'worker: open with ?simw=0' };
  if (!window.__dwStep) window.__dwStep = sim.step;
  const step = window.__dwStep;
  sim.step = () => {};
  window.FLYDIY_SKINBREAK = true;
  // the wind off (DMG-D4b's parity finding: the gust field is read at sim.t and every staging starts at another t - with
  // it off the page's crash is bit for bit the same); given back after the run
  if (!('__dwWind0' in window)) window.__dwWind0 = world.wind;
  world.wind = null;
  const strip = world.aerodromes.find(a => a.id === 'HOME') || world.aerodromes[0];
  sim.reset(0); placeAtAerodrome(sim, strip);
  const n = sim.n, p = sim.p, v = sim.v, fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg);
  { const c = sim.cgPos(), dx = strip.x - 300 * fx - c[0], dz = strip.z - 300 * fz - c[2]; for (let i = 0; i < n; i++) { p[i*3] += dx; p[i*3+2] += dz; } }
  const c0 = sim.cgPos(), ground = world.terrainH(c0[0], c0[2]);
  let yMin = Infinity; for (let i = 0; i < n; i++) yMin = Math.min(yMin, p[i*3+1] - (sim.r[i] || 0));
  const scene = P.craft().parent;
  if (window.__dwTrunk) { scene.remove(window.__dwTrunk); window.__dwTrunk = null; }
  if (world.treeHits.drop) world.treeHits.drop('fill:wallstill');
  if (o.kind === 'trunk') {
    if (!o.agl) { for (let i = 0; i < n; i++) p[i*3+1] += ground - yMin + 0.02; for (let f = 0; f < 120; f++) step(1 / 60); }
    else for (let i = 0; i < n; i++) p[i*3+1] += ground - yMin + o.agl;
    for (let i = 0; i < n; i++) { v[i*3] = o.V * fx; v[i*3+2] = o.V * fz; if (o.agl) v[i*3+1] = 0; }
    const c = sim.cgPos(), tx = c[0] + fx * o.D - fz * o.off, tz = c[2] + fz * o.D + fx * o.off, R = o.r || 0.3, H = o.top || 10;
    world.treeHits.set('fill:wallstill', [tx, tz, ground, R, ground + H]);
    const mm = new THREE.Mesh(new THREE.CylinderGeometry(R, R + 0.05, H, 20), new THREE.MeshStandardMaterial({ color: 0x5b4632, roughness: 0.95 }));
    mm.position.set(tx, ground + H / 2, tz); mm.castShadow = true; scene.add(mm); window.__dwTrunk = mm;
  }
  sim.ctl.thr = o.thr || 0;
  if (o.placeOnly) { const raf0 = () => new Promise(r => requestAnimationFrame(() => r())); for (let f = 0; f < 6; f++) await raf0(); return { placed: true }; }
  return pageRunOn(o);
}
async function pageRunOn(o) {
  const P = FLIGHT_PROBE, sim = P.sim(), step = window.__dwStep;
  const raf = () => new Promise(r => requestAnimationFrame(() => r()));
  const ms = [];
  // (the crash's node path, a frame each: the drawings replay it - the SAME wreck for each binding, pageReplay)
  const rec = window.__dwRec = [];
  let s = 0, settled = 0, t1 = performance.now();
  for (; s < (o.steps || 1200); s += 2) {
    step(1 / 60); step(1 / 60);
    rec.push(Float64Array.from(sim.p));
    await raf();
    const t2 = performance.now(); ms.push(t2 - t1); t1 = t2;
    const D = sim.damage();
    if (D.over || (!D.crashed && s > 500)) { if (++settled > 40) break; }
  }
  // (a few more frames: the pose reaches the last state, the binding's budget finishes)
  for (let f = 0; f < 40; f++) await raf();
  if ('__dwWind0' in window) { P.world().wind = window.__dwWind0; delete window.__dwWind0; }
  const D = sim.damage(), q = ms.slice().sort((a, b) => a - b);
  return { steps: s, crashed: D.crashed, over: !!D.over, reason: D.reason, broken: D.broken.length, brokeUp: !!D.brokeUp,
    frameMed: +q[q.length >> 1].toFixed(1), frameMax: +q[q.length - 1].toFixed(1),
    skin: window.FLYDIY_SKINBREAK_STATS(), wall: window.FLYDIY_SKINWALL_STATS ? window.FLYDIY_SKINWALL_STATS() : null };
}
// THE REPLAY: the recorded crash's node path drawn again, a recorded frame a page frame, under the binding the flags say
// now - the physics' damage state stays the crash's last (the broken list, the pieces), so both drawings see the same
// wreck through the same path (the page's own crash does not repeat bit for bit: 141 vs 120 members broken in two runs)
async function pageReplay() {
  const P = FLIGHT_PROBE, sim = P.sim(), rec = window.__dwRec || [];
  const raf = () => new Promise(r => requestAnimationFrame(() => r()));
  sim.p.set(rec[0]); for (let f = 0; f < 6; f++) await raf();      // (the switch's reset and the binding's first frames at the start)
  for (const f of rec) { sim.p.set(f); await raf(); }
  for (let f = 0; f < 60; f++) await raf();                       // (the binding's budget finishes; the pose settles)
  return { frames: rec.length, skin: window.FLYDIY_SKINBREAK_STATS(), wall: window.FLYDIY_SKINWALL_STATS ? window.FLYDIY_SKINWALL_STATS() : null };
}
// THE HEAL CHECK (G1858.1, the coordinator: the 'intact' shots drew the last wreck): every craft geometry's index, and the
// positions of the buckets nothing poses (the static ones: no wing binding, no hinge), hashed - at boot (a fresh load)
// and after each reset; equal = the drawing healed to the as-built pose. And THE STRETCH LIST: every drawn mesh's extent
// in its own frame against the same mesh fresh (a link, a strut, a wire drawn metres long shows here)
function pageHeal(mode) {
  const m = FLIGHT_PROBE.model(), B = m.wreckBuild, rigs = (B.rigsAll || m.rigs);
  const statics = new Set(); for (const r of rigs) if (!r.hb && !(r.bind && r.bind.bound.length)) statics.add(r.posAttr);
  const fnv = (a) => { let h = 2166136261 >>> 0; const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); for (let i = 0; i < u.length; i++) { h ^= u[i]; h = Math.imul(h, 16777619) >>> 0; } return h; };
  const ext = a => { let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < a.length; i += 3) { const x = a[i], y = a[i+1], z = a[i+2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    return Math.hypot(x1 - x0, y1 - y0, z1 - z0); };
  const keyOf = new Map(); for (const k in B.meshes0) keyOf.set(B.meshes0[k], k);
  const H = {}; let i = 0;
  for (const [mesh, par] of B.parentOf) { const g = mesh.geometry, pa = g && g.attributes.position; if (!pa) continue;
    const name = keyOf.get(mesh) || ((par && par.name) || 'part') + '#' + (i++);
    H[name] = { idx: g.index ? fnv(g.index.array) : 0, pos: statics.has(pa) ? fnv(pa.array) : 0, ext: ext(pa.array) }; }
  if (mode === 'fresh') { window.__dwFresh = H; return { n: Object.keys(H).length }; }
  const F = window.__dwFresh || {}, bad = [], grown = [];
  for (const k in H) { const f = F[k]; if (!f) continue;
    if (f.idx !== H[k].idx || f.pos !== H[k].pos) bad.push(k + (f.idx !== H[k].idx ? ' idx' : '') + (f.pos !== H[k].pos ? ' pos' : ''));
    if (f.ext > 0.02 && H[k].ext > 1.3 * f.ext) grown.push([k, +(H[k].ext / f.ext).toFixed(2), +f.ext.toFixed(2)]); }
  grown.sort((a, b) => b[1] - a[1]);
  return { n: Object.keys(H).length, healed: bad.length === 0, bad: bad.slice(0, 20), nBad: bad.length, grown: grown.slice(0, 12), nGrown: grown.length };
}
// THE TEARS, BY WING AND BY REASON (the coordinator, the user's review of a nose-over that combed both wings into strips):
// every removed triangle of the WING layer's covering, left and right (the design frame's z), by its dead code - 1 the event
// (two pieces / across a broken member), 2 the stretch tear, 3 G1858's cut, 4 gone with its covering, 5 DMG-D4b's debris -
// and the live ones posed STALE: a vertex whose distance to its dominant node moved by more than 0.3 m against the rest
// (a fragment not riding its piece). The inherited records only (K.inhL; the old binding's records carry no layers)
function pageTears() {
  const m = FLIGHT_PROBE.model(), K = m.brk, sim = FLIGHT_PROBE.sim();
  if (!K || !K.inhL) return { none: true };
  const lay = new Map(); for (const r of (m.data && m.data.layers) || []) { let L = lay.get(r[1]); if (!L) lay.set(r[1], L = []); L.push(r); }
  const out = { L: { live: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, stale: 0 }, R: { live: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, stale: 0 }, staleAt: [] };
  for (const E of K.inhL) {
    const R = E.R, rg = lay.get(E.name); if (!rg || !R.dead) continue;
    const layer = new Array(R.nv).fill(''); for (const r of rg) for (let v = r[2]; v < r[3] && v < R.nv; v++) layer[v] = r[0];
    const ix = R.idx0 || R.idx, B = R.baseD, W = R.w, Kk = R.K, rest = K.rest, live = sim.p;
    for (let t = 0; t < R.nt; t++) { const a = ix[t * 3]; if (layer[a] !== 'wing' || E.cv[a] !== 2) continue;
      const side = B[a * 3 + 2] >= 0 ? 'R' : 'L', d = R.dead[t];
      if (d) { out[side][d] = (out[side][d] || 0) + 1; continue; }
      out[side].live++;
      let st = false;
      for (let q = 0; q < 3 && !st; q++) { const v = ix[t * 3 + q], dn = R.dom ? R.dom[v] : R.wi[v * Kk];
        const r0 = Math.hypot(B[v*3] - rest[dn*3], B[v*3+1] - rest[dn*3+1], B[v*3+2] - rest[dn*3+2]);
        const l0 = Math.hypot(W[v*3] - live[dn*3], W[v*3+1] - live[dn*3+1], W[v*3+2] - live[dn*3+2]);
        if (Math.abs(l0 - r0) > 0.3) { st = true; if (out.staleAt.length < 8) out.staleAt.push({ name: E.name, t, v, dom: dn, rest: +r0.toFixed(2), live: +l0.toFixed(2) }); } }
      if (st) out[side].stale++; }
  }
  return out;
}
// UNDER THE PHYSICS WORKER (A0's rule: the default mode): the page's own loop flies the crash - the flight started, the
// hand on the controls, the aeroplane placed with its speed (FLIGHT_PROBE.place: the worker's sim, never the view's
// arrays), the trunk / stump in world.treeHits (it reaches the worker, G1330) - then watched until the solver's 'over'
// (or the time cap) and its debris at rest. Not a replay: one crash, the drawing as the game draws it
async function pageFlyW(o) {
  const P = FLIGHT_PROBE, world = P.world();
  const go = document.getElementById('bGo'); if (go && !P.over() && go.offsetParent) go.click();
  await new Promise(r => setTimeout(r, 2500));
  P.setManual(true);
  const sim = P.sim(), [xA] = sim.axes(), hl = Math.hypot(xA[0], xA[2]), fx = -xA[0] / hl, fz = -xA[2] / hl;
  const c = sim.cgPos(), g = world.terrainH(c[0], c[2]);
  let yMin = Infinity; for (let i = 1; i < sim.p.length; i += 3) yMin = Math.min(yMin, sim.p[i]);
  await P.place({ at: [c[0], g + (o.agl || 0) + (c[1] - yMin) + 0.05, c[2]], zeroV: true, dv: [o.V * fx, 0, o.V * fz] });
  const c2 = sim.cgPos(), tx = c2[0] + fx * o.D - fz * (o.off || 0), tz = c2[2] + fz * o.D + fx * (o.off || 0), gt = world.terrainH(tx, tz), R = o.r || 0.3, H = o.top || 10;
  world.treeHits.set('fill:wallworker', [tx, tz, gt, R, gt + H]);
  const scene = P.craft().parent;
  if (window.__dwTrunkW) scene.remove(window.__dwTrunkW);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(R, R + 0.05, H, 20), new THREE.MeshStandardMaterial({ color: 0x5b4632, roughness: 0.95 }));
  m.position.set(tx, gt + H / 2, tz); m.castShadow = true; scene.add(m); window.__dwTrunkW = m;
  try { sim.ctl.thr = 0; } catch (e) {}
  const t0 = performance.now(); let overAt = 0;
  while (performance.now() - t0 < (o.secs || 14) * 1000) {
    await new Promise(r => setTimeout(r, 250));
    const D = sim.damage ? sim.damage() : null;
    if (D && D.over && !overAt) overAt = performance.now();
    if (overAt && performance.now() - overAt > 3000) break;
  }
  const D = sim.damage ? sim.damage() : {};
  return { worker: !!sim.dmgState, crashed: !!D.crashed, over: !!D.over, reason: D.reason, broken: D.broken ? D.broken.length : null,
           skin: window.FLYDIY_SKINBREAK_STATS(), wall: window.FLYDIY_SKINWALL_STATS ? window.FLYDIY_SKINWALL_STATS() : null };
}
// THE BOOT: the page up, the build kept, rolled out, the roll-out screen gone
async function pageBootStep(k) {
  if (k === 'ready') return await Promise.race([(window.BOOT && BOOT.whenReady) ? BOOT.whenReady().then(() => 'ready') : new Promise(r => setTimeout(() => r('no BOOT'), 18500)), new Promise(r => setTimeout(() => r('boot timeout'), 240000))]);
  if (k === 'go') { const g = document.getElementById('bGo'); if (g) { g.click(); return 'bGo'; } [...document.querySelectorAll('button')].filter(b => /roll out/i.test(b.textContent)).forEach(x => x.click()); return 'roll'; }
  if (k === 'flying') return !!window.FLIGHT_PROBE && (/TAXI|DOWNWIND|FINAL|DEPART/.test(document.body.innerText) || (window.BOOT && BOOT.state === 'loading'));
  if (k === 'keep') { const l = [...document.querySelectorAll('button,a,div')].filter(b => /keep the current build/i.test(b.textContent || '') && b.children.length === 0 && b.offsetParent); l.forEach(x => x.click()); return l.length; }
  if (k === 'state') return window.BOOT ? BOOT.state : 'none';
  return null;
}
// the structure the census reads (the probe): the rigs, the still merge, the folds, the sections drawn
function pageProbe() {
  const m = FLIGHT_PROBE.model(), B = m.wreckBuild, A0 = window.AEROSKIN;
  const rigNames = new Set((m.rigs || []).map(r => r.name));
  const rows = Object.keys(B.meshes0).map(k => { const mt = m.mats[k] || {}, g = B.meshes0[k].geometry;
    return [k, mt.sec || '', mt.sec && A0 ? (A0.AERO_ROLE[mt.sec] || '') : '', mt.inside ? 'in' : '', g.attributes.position.count, rigNames.has(k) ? 'rig' : '', B.meshes0[k].parent ? 'g' : '-'].join(' '); });
  let drawn = 0; m.grp.traverse(o => { if (o.isMesh) drawn++; });
  return { rigs: (m.rigs || []).length, still: m.still ? { from: m.still.from, to: m.still.to, names: [...m.still.names] } : null, drawnMeshes: drawn, buckets: rows };
}

module.exports = { run, post, get, CASES, pageStage, pageView, pageCensus, pageProbe };
if (require.main === module) (async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const R0 = {};
  if (has('boot')) {
    console.log('boot ' + await run(pageBootStep, 'ready')); await sleep(800);
    let flying = false;
    for (let a = 0; a < 8 && !flying; a++) { await run(pageBootStep, 'go'); await sleep(6000); flying = await run(pageBootStep, 'flying'); }
    for (let i = 0; i < 20; i++) { const n = await run(pageBootStep, 'keep'); await sleep(500); if (!n && i > 4) break; }
    let bs = ''; for (let i = 0; i < 300; i++) { bs = await run(pageBootStep, 'state'); if (bs === 'gone' || bs === 'none') break; await sleep(1000); }
    console.log('rolled out: ' + flying + ', boot ' + bs); await sleep(2000);
  }
  R0.fresh = await run(pageHeal, 'fresh');
  console.log('fresh ' + JSON.stringify(R0.fresh));
  if (has('probe')) { const pr = await run(pageProbe); fs.writeFileSync(path.join(OUT, 'probe.json'), JSON.stringify(pr, null, 1)); console.log(JSON.stringify(pr).slice(0, 3000)); if (!opt('cases', null)) return; }
  const names = opt('cases', Object.keys(CASES).join(',')).split(','), modes = opt('modes', 'after').split(',');
  if (has('worker')) {                                    // (the default mode: one crash a case, flown by the page)
    const RW = { at: new Date().toISOString(), worker: true, cases: {} };
    const shootW = async file => { const tmp = file + '.png'; await get('/shot?f=' + encodeURIComponent(tmp)); const png = fs.readFileSync(tmp).toString('base64'); fs.unlinkSync(tmp);
      const jpg = await run(pageJpeg, png); fs.writeFileSync(file, Buffer.from(jpg, 'base64')); return path.basename(file); };
    for (const k of names) {
      const C = CASES[k], out = { label: C.label, shots: [] };
      out.fly = await run(pageFlyW, C.o);
      out.tears = await run(pageTears);
      console.log(k + ' worker ' + JSON.stringify(out.fly).slice(0, 500) + ' tears ' + JSON.stringify(out.tears));
      for (const [ci, c] of C.cams.entries()) { await run(pageView, c); const f = path.join(OUT, k + '_' + (ci + 1) + '_worker.jpg');
        const cz = await run(pageCensus); if (cz && cz.clsJpg) { fs.writeFileSync(f.replace(/\.jpg$/, '_cls.jpg'), Buffer.from(cz.clsJpg, 'base64')); delete cz.clsJpg; }
        out.shots.push({ cam: c, file: await shootW(f), census: cz }); console.log('  worker cam' + (ci + 1) + ' other ' + cz.other + ' % ' + JSON.stringify(cz.otherBy)); }
      RW.cases[k] = out;
      // (the next case from a fresh aeroplane: back to the hangar and out again - the heal checked on the way)
      await post('/eval', "(() => { const b = document.getElementById('bHangar2'); if (!b) return 'no button'; b.click(); return 'ok'; })()");
      await sleep(6000);
      for (let a = 0; a < 6; a++) { await run(pageBootStep, 'go'); await sleep(5000); if (await run(pageBootStep, 'flying')) break; }
      for (let i = 0; i < 60; i++) { const bs = await run(pageBootStep, 'state'); if (bs === 'gone' || bs === 'none') break; await sleep(1000); }
      await sleep(2000);
      out.healNext = await run(pageHeal, 'check');
      fs.writeFileSync(path.join(OUT, 'census_worker.json'), JSON.stringify(RW, null, 1));
    }
    console.log('WALL_CENSUS done ' + OUT);
    return;
  }
  const R = Object.assign(R0, { at: new Date().toISOString(), modes, cases: {} });
  const shoot = async file => { const tmp = file + '.png'; await get('/shot?f=' + encodeURIComponent(tmp)); const png = fs.readFileSync(tmp).toString('base64'); fs.unlinkSync(tmp);
    const jpg = await run(pageJpeg, png); fs.writeFileSync(file, Buffer.from(jpg, 'base64')); return path.basename(file); };
  const censusTo = async file => { const c = await run(pageCensus); if (c && c.clsJpg) { fs.writeFileSync(file.replace(/\.jpg$/, '_cls.jpg'), Buffer.from(c.clsJpg, 'base64')); delete c.clsJpg; } return c; };
  // (a box window's end: no case is started past the time in <out>/../DEADLINE, "HH:MM" local)
  const deadline = () => { try { const t = fs.readFileSync(path.join(OUT, '..', 'DEADLINE'), 'utf8').trim().split(':').map(Number), d = new Date(); d.setHours(t[0], t[1], 0, 0); return d.getTime(); } catch (e) { return Infinity; } };
  for (const k of names) {
    if (Date.now() > deadline()) { console.log('past the DEADLINE: ' + k + ' and the rest not run'); break; }
    const C = CASES[k], out = { label: C.label, intact: [], shots: [] };
    await run(pageStage, Object.assign({}, C.o, { placeOnly: true }));
    out.heal = await run(pageHeal, 'check');
    console.log(k + ' heal ' + JSON.stringify(out.heal));
    for (const [ci, c] of C.cams.entries()) { await run(pageView, c); const f = path.join(OUT, k + '_' + (ci + 1) + '_intact.jpg'); out.intact.push({ cam: c, census: await censusTo(f), file: await shoot(f) }); }
    out.stage = {};
    // ONE crash (flown under the inherited binding), then each mode REPLAYS its recorded node path: the same wreck
    await post('/run', 'window.FLYDIY_WALLBIND = true; window.FLYDIY_SKINWALL = true; return 1;');
    out.crash = await run(pageStage, Object.assign({}, C.o));
    console.log(k + ' crash', JSON.stringify(out.crash).slice(0, 600));
    if (out.crash && out.crash.err) { R.cases[k] = out; continue; }
    for (const mode of modes) {
      // before: the old binding, no cut (the drawing until G1858); g1858: the old binding and the lining cut; after: inherited
      await post('/run', 'window.FLYDIY_WALLBIND = ' + (mode === 'after') + '; window.FLYDIY_SKINWALL = ' + (mode !== 'before') + '; return 1;');
      const st = out.stage[mode] = await run(pageReplay);
      st.stretch = await run(pageHeal, 'check');
      st.tears = await run(pageTears);
      console.log('  ' + mode + ' tears ' + JSON.stringify(st.tears));
      console.log(k + ' ' + mode, JSON.stringify(st).slice(0, 900));
      await sleep(1500);
      for (const [ci, c] of C.cams.entries()) {
        await run(pageView, c);
        const f = path.join(OUT, k + '_' + (ci + 1) + '_' + mode + '.jpg');
        const census = await censusTo(f);
        out.shots.push({ cam: c, mode, file: await shoot(f), census });
        console.log('  ' + mode + ' cam' + (ci + 1) + ' other ' + census.other + ' % ' + JSON.stringify(census.otherBy));
      }
    }
    await post('/run', 'window.FLYDIY_SKINWALL = true; window.FLYDIY_WALLBIND = true; return 1;');
    R.cases[k] = out;
    fs.writeFileSync(path.join(OUT, 'census.json'), JSON.stringify(R, null, 1));
  }
  // THE OTHER WAY BACK TO A FRESH AEROPLANE (G1858.1): the last case's wreck stands; the garage and a new roll-out (the
  // hangar button, then Roll out) - the drawing checked against the fresh load's as after each reset
  if (has('paths')) {
    R.paths = {};
    await post('/eval', "(() => { const b = document.getElementById('bHangar2'); if (!b) return 'no button'; b.click(); return 'ok'; })()");
    await sleep(8000);
    for (let a = 0; a < 6; a++) { await run(pageBootStep, 'go'); await sleep(6000); if (await run(pageBootStep, 'flying')) break; }
    for (let i = 0; i < 20; i++) { const n = await run(pageBootStep, 'keep'); await sleep(500); if (!n && i > 4) break; }
    for (let i = 0; i < 120; i++) { const bs = await run(pageBootStep, 'state'); if (bs === 'gone' || bs === 'none') break; await sleep(1000); }
    await sleep(3000);
    R.paths.garage = await run(pageHeal, 'check');
    console.log('paths garage -> roll-out: ' + JSON.stringify(R.paths.garage));
    await run(pageView, [200, 22, 12]);
    await shoot(path.join(OUT, 'paths_garage_rollout.jpg'));
  }
  fs.writeFileSync(path.join(OUT, 'census.json'), JSON.stringify(R, null, 1));
  // the README: a line a picture (the evidence board reads it)
  const cap = c => 'not yellow ' + c.other + ' % of the Cub\'s pixels' + (c.otherBy ? ' (by layer: ' + Object.entries(c.otherBy).map(([k, v]) => k + ' ' + v).join(', ') + ')' : '');
  const lines = ['# DMG-WALL census - ' + path.basename(OUT), '', 'The user\'s Cub, `?damage=1&simw=0`, tools/dmg_wall_census.js. Modes: **before** = the drawing until G1858 (each place on its own nearest nodes), ' +
    '**g1858** = + the lining cut at the damage, **after** = the binding inherited (G1855-G1859). Each `_cls.jpg` is the same frame drawn by layer: covering white, its back face RED, ' +
    'lining MAGENTA, frame tubes / bulkheads CYAN, fireproof ORANGE, sill / door pads PURPLE, dash / cabin BLUE, beads / glazing GREEN, parts GREY.', ''];
  for (const [k, c] of Object.entries(R.cases)) {
    lines.push('## ' + k + ' - ' + c.label, '');
    for (const s of c.intact || []) lines.push('- `' + s.file + '` - intact, camera ' + JSON.stringify(s.cam) + ': ' + cap(s.census));
    for (const s of c.shots || []) lines.push('- `' + s.file + '` (+ `' + s.file.replace(/\.jpg$/, '_cls.jpg') + '`) - ' + s.mode + ', camera ' + JSON.stringify(s.cam) + ': ' + cap(s.census));
    lines.push('');
  }
  fs.writeFileSync(path.join(OUT, 'README.md'), lines.join('\n'));
  console.log('WALL_CENSUS done ' + OUT);
})().catch(e => { console.log('WALL_CENSUS_FAIL ' + (e && e.stack || e)); process.exit(1); });
