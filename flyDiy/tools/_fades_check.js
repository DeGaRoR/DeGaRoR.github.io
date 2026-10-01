#!/usr/bin/env node
// _fades_check.js — GATE FADES (A2-FADES G670-G673, the 2026-09-26 Jolene playtest): what appears or disappears
// does it by a transition, and the propeller is a disc.
//
// The code under test is the shipped source (prop_disc.js, trees.js, cover_ring.js on the real three.js over the
// fake WebGL2 of tools/_fake_gl.js; render_premises.js's RISE block LIFTED and run on the vendor three).
//
//   1. THE DISC IS THE BLADES' (G672, prop_disc.js analyse). A synthetic two-blade and three-blade propeller with a
//      painted tip: the reach, the root, the blade count, the swept coverage at 30 / 70 % of the reach (the chord
//      over the circumference, times the blades), the tip's colour on the tip ring and the blade's inboard, and the
//      ghost that never moves the mean (the texel's alpha averaged round the circle = gain x coverage).
//   2. THE CROSSOVER (make / update, vendor three). A prop group (two blades + a spinner): the spinner is not a
//      blade; under rpmLo the disc is hidden and the blades drawn; between, the disc part-opaque with the blades;
//      over rpmHi the disc whole and the blades hidden; back to 0 the blades return. The texture counter-turns the
//      part's own angle. app.js makes one per prop part and updates it in the spin loop; build.js ships the file.
//   3. THE GROW IN THE SHADER (G670, trees.js). No `aRand > _fk` switch left: the instance scales by _fg (the band,
//      then the birth) BEFORE <project_vertex>, the throw-away after; aBorn is an instanced attribute only.
//   4. THE RING (G670/G671, cover_ring.js, the real ring on a stub pack, a fake clock): planted in the open, each
//      block mesh carries aBorn = its cells' birth and a near cell's batched instances start small and end exactly
//      where a ring with no grow puts them; between aglOff and aglPre the ring PLANTS while hidden (born -1e9: no
//      grow when it shows) and over aglPre it is dropped; the LEAD plants what the eye flies toward first.
//   5. THE RISE (G673, render_premises.js). Only the DRAW is scaled: onBeforeRender scales y about the item's foot,
//      onAfterRender restores matrixWorld bit for bit; the hooks go when the rise ends; the bench (o.game false)
//      hooks nothing; the stream calls it, the prewarm does not.
//
//   node tools/_fades_check.js   -> "GATE FADES: PASS|FAIL", exit 1 on FAIL
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fails = 0;
const ok = (c, msg, extra) => { console.log((c ? '  ok   ' : '  FAIL ') + msg + (extra !== undefined ? '  (' + extra + ')' : '')); if (!c) fails++; };
const THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
const read = f => fs.readFileSync(path.join(ROOT, 'src', 'viewer', f), 'utf8');
const lift = (src, a, b) => { const i = src.indexOf(a), j = i < 0 ? -1 : src.indexOf(b, i); return i < 0 || j < 0 ? null : src.slice(i, j); };
console.log('GATE FADES');

// ---- 1. the disc's analysis ------------------------------------------------------------------------------
const PD = require(path.join(ROOT, 'src', 'viewer', 'prop_disc.js'));
// a flat blade along angle a in the y-z plane (the shaft is x), chord c, from r0 to r1
const blade = (a, r0, r1, c, col) => { const ca = Math.cos(a), sa = Math.sin(a), px = (r, s) => [0, r * ca - s * sa, r * sa + s * ca];
  const pos = new Float32Array([].concat(px(r0, -c / 2), px(r1, -c / 2), px(r1, c / 2), px(r0, c / 2))); return { pos, idx: [0, 1, 2, 0, 2, 3], col }; };
const WOOD = [0.30, 0.18, 0.08], TIP = [1.0, 0.75, 0.0];
for (const N of [2, 3]) {
  const R = 0.95, c = 0.12, B = [];
  for (let k = 0; k < N; k++) { const a = k / N * 2 * Math.PI; B.push(blade(a, 0.1, 0.87, c, WOOD), blade(a, 0.87, R, c, TIP)); }
  const D = PD.analyse(B, [1, 0, 0]);
  ok(!!D, '1 ' + N + '-blade: analysed');
  if (!D) continue;
  ok(Math.abs(D.R - Math.hypot(R, c / 2)) < 1e-6 && Math.abs(D.r0 - Math.hypot(0.1, 0)) < 0.02 && Math.abs(D.h) < 1e-9, '1 ' + N + '-blade: the reach, the root, the plane', D.R.toFixed(3) + ' ' + D.r0.toFixed(3) + ' ' + D.h);
  ok(D.n === N, '1 ' + N + '-blade: the blade count off the silhouette', D.n);
  const row = f => Math.min(D.NR - 1, Math.floor((f * D.R - D.r0) / (D.R - D.r0) * D.NR));
  for (const f of [0.3, 0.7]) { const want = N * c / (2 * Math.PI * f * D.R), got = D.cov[row(f)];
    ok(Math.abs(got - want) / want < 0.12, '1 ' + N + '-blade: the swept coverage at ' + f * 100 + ' % = N chord / circumference', got.toFixed(4) + ' vs ' + want.toFixed(4)); }
  const px = (f, it) => D.rgba.slice((row(f) * D.NT + (it || 0)) * 4, (row(f) * D.NT + (it || 0)) * 4 + 4);
  const toS = x => Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055));
  ok(px(0.97)[0] === toS(TIP[0]) && px(0.97)[1] === toS(TIP[1]), '1 ' + N + '-blade: the painted tip is the tip ring\'s colour', px(0.97).slice(0, 3).join(','));
  ok(px(0.5)[0] === toS(WOOD[0]) && px(0.5)[2] === toS(WOOD[2]), '1 ' + N + '-blade: the blade\'s colour inboard', px(0.5).slice(0, 3).join(','));
  let worst = 0;
  for (const f of [0.3, 0.5, 0.7]) { const ir = row(f); let s = 0, mx = 0, mn = 1e9; for (let it = 0; it < D.NT; it++) { const a = D.rgba[(ir * D.NT + it) * 4 + 3]; s += a; mx = Math.max(mx, a); mn = Math.min(mn, a); }
    const streak = (s / D.NT / 255) / (PD.S.gain * D.cov[ir]); worst = Math.max(worst, Math.abs(streak - 1));
    ok(mx > mn + 2, '1 ' + N + '-blade: the ghost varies round the circle at ' + f * 100 + ' %', mn + '..' + mx); }
  ok(worst <= PD.S.streak + 0.03, '1 ' + N + '-blade: the ghost keeps the mean (only the concentric streak moves it)', worst.toFixed(3));
}

// ---- 2. the crossover ------------------------------------------------------------------------------------
{
  const mat = new THREE.MeshStandardMaterial({ color: 0x663311 }), spin = new THREE.MeshStandardMaterial({ color: 0xcccccc });
  const part = new THREE.Group();
  const bladeMesh = a => { const b = blade(a, 0.1, 0.95, 0.12, null), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(b.pos, 3)); g.setIndex(b.idx); return new THREE.Mesh(g, mat); };
  const b1 = bladeMesh(0), b2 = bladeMesh(Math.PI), cone = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 12).rotateZ(-Math.PI / 2), spin);
  part.add(b1, b2, cone);
  const found = PD.bladesOf(part, [1, 0, 0]);
  ok(found.length === 2 && found.includes(b1) && found.includes(b2) && !found.includes(cone), '2 the blades are the meshes that reach out; the spinner is not one', found.length);
  const ctl = PD.make(THREE, part, null, [1, 0, 0]);
  ok(!!ctl && ctl.mesh.parent === part, '2 the disc is a child of the spinning part (it rides its pose)');
  if (ctl) {
    const S = PD.S, st = () => [ctl.mesh.visible, +ctl.mesh.material.opacity.toFixed(3), b1.visible && b2.visible, cone.visible];
    ctl.update(0, 0, 1, 0);
    ok(String(st()) === String([false, 0, true, true]), '2 stopped: no disc, the blades', st().join(' '));
    ctl.update(S.rpmLo - 20, 0, 1, 0);
    ok(!ctl.mesh.visible && b1.visible, '2 under rpmLo (a slow windmill): the blades alone', st().join(' '));
    ctl.update((S.rpmLo + S.rpmHi) / 2, 0, 1, 0);
    ok(ctl.mesh.visible && ctl.mesh.material.opacity > 0.3 && ctl.mesh.material.opacity < 0.7 && b1.visible, '2 half-way: the disc half-grown, the blades still drawn', st().join(' '));
    ctl.update(2400, 1.0, 1, 0);
    ok(ctl.mesh.visible && ctl.mesh.material.opacity === 1 && !b1.visible && !b2.visible && cone.visible, '2 at 2 400 rpm: the disc whole, the blades hidden, the spinner turning', st().join(' '));
    const off0 = ctl.mesh.material.map.offset.x;
    ctl.update(2400, 1.0 + 2 * Math.PI * 0.25, 1, 0);
    const d = ((ctl.mesh.material.map.offset.x - off0) % 1 + 1) % 1;
    ok(Math.abs(d - 0.25) < 1e-6, '2 the texture counter-turns the part\'s own angle (the ghosts do not strobe with it)', d.toFixed(6));
    ctl.update(2400, 1.0, 1, 1.0);
    const dr = ((ctl.mesh.material.map.offset.x - off0) % 1 + 1) % 1;
    ok(Math.abs((1 - dr) - S.drift) < 1e-6, '2 ...and drifts `drift` turns a second the engine\'s way', (1 - dr).toFixed(4));
    ctl.update(0, 0, 1, 0);
    ok(!ctl.mesh.visible && b1.visible && b2.visible, '2 wound down: the blades come back', st().join(' '));
  }
  const app = read('app.js'), build = fs.readFileSync(path.join(__dirname, 'build.js'), 'utf8');
  const mk = app.indexOf('PROP_DISC.make(THREE, pg, null, pt.axis)'), part0 = app.indexOf("if (pt.kind === 'prop') {");
  ok(mk > part0 && part0 > 0 && mk - part0 < 4000, '2 app.js makes a disc for every prop part (the cage build)', mk + ' / ' + part0);
  ok(/ud\.disc\.update\(ud\.spinRate \* 60 \/ \(2 \* Math\.PI\), ax2 \? ud\.spinAng : p\.rotation\.x, sense, frameDt\(\)\)/.test(app), '2 ...and updates it in the spin loop at the shaft\'s rpm');
  ok(/renderer\.compileAsync\(dc\.mesh, camera, scene\)/.test(app), '2 ...and links its program at the build, not on the first frame that shows it');
  // 2026-10-01 (the user: "the spinning prop does not render on top of the runway texture"): the disc is transparent and
  // writes no depth, like the pavement (renderOrder 1.99-3), so it must sort in the aeroplane's see-through band
  { const s = app.slice(mk, mk + 1500), ac = /const AERO_CLEAR = (\d+);/.exec(app);
    ok(/dc\.mesh\.renderOrder = AERO_CLEAR;/.test(s) && ac && +ac[1] > 3, '2 ...and sorts in the craft\'s see-through band (renderOrder AERO_CLEAR = ' + (ac && ac[1]) + '), after every pavement (renderOrder <= 3)'); }
  ok(/'prop_disc\.js'/.test(build), '2 build.js ships prop_disc.js');
}

// ---- 3. the grow in the shader ---------------------------------------------------------------------------
{
  const T = read('trees.js');
  const fv = lift(T, '  const FADE_VS = [', "].join('\\n');");
  ok(!!fv, '3 FADE_VS found in trees.js');
  ok(T.indexOf('aRand > _fk') < 0, '3 no instance switches on its threshold any more');
  if (fv) {
    const iG = fv.indexOf('float _fg = clamp((_fk * (1.0 + uFadeBand) - aRand) / max(1e-3, uFadeBand), 0.0, 1.0);'), iB = fv.indexOf('_fg *= clamp((uFadeNow - aBorn) / max(1e-3, uFadeGrow), 0.0, 1.0);'), iT = fv.indexOf('transformed *= _fg;');
    ok(iG > 0 && iB > iG && iT > iB, '3 the band, then the birth, then the shrink of `transformed`', [iG, iB, iT].join(' '));
  }
  ok(T.indexOf(".replace('#include <project_vertex>', FADE_VS + '\\n#include <project_vertex>\\n' + FADE_CUT_VS)") > 0, '3 the shrink BEFORE <project_vertex>, the throw-away after it');
  ok(T.indexOf("'#ifdef USE_INSTANCING\\nattribute float aBorn;\\n#endif'") > 0, '3 aBorn is declared for instanced programs only (a batch has none)');
  // the band's law, in numbers: whole at _fk = 1 for every threshold, nothing at 0, never growing as _fk falls
  const g = (fk, r, b) => Math.min(1, Math.max(0, (fk * (1 + b) - r) / b));
  let law = true; for (let r = 0; r < 1; r += 0.01) { if (g(1, r, 0.25) !== 1 || g(0, r, 0.25) !== 0) law = false; for (let fk = 0; fk < 1; fk += 0.05) if (g(fk, r, 0.25) > g(fk + 0.05, r, 0.25) + 1e-12) law = false; }
  ok(law, '3 the band: whole at _fk 1, gone at 0, monotone between');
}

// ---- 4. the ring -----------------------------------------------------------------------------------------
function ring(opt) {
  const { boot } = require('./_fake_gl.js');
  const B = boot(), { THREE: T3, ctx } = B;
  let clock = 1000; ctx.performance = { now: () => clock };   // the fake clock (ms): the grow and the lead read it
  B.load(path.join('src', 'viewer', 'trees.js'));
  const cols = [{ name: 'rocksA', kind: 'rock', place: { size: 1, sizeVar: 0.3 } }, { name: 'tuft', kind: 'cover', place: { density: 0.4, size: 0.3 } }];
  const models = [['rock1', cols[0], 1.2], ['rock2', cols[0], 0.9], ['tuft1', cols[1], 0.4]];
  const built = new Map(), geoOf = h => { const g = new T3.BoxGeometry(1, h, 1); g.translate(0, h / 2, 0); return g; };
  const tex = () => { const t = new T3.Texture(); t.image = { width: 4, height: 4 }; return t; };
  const treeList = () => models.map(([key, col, h]) => ({ key, col, sub: { bb: [-0.5, 0, -0.5, 0.5, h, 0.5], h } }));
  const treeBuild = (X, key) => { if (built.has(key)) return built.get(key); const m = models.find(x => x[0] === key);
    const b = { parts: [{ geo: geoOf(m[2]), mat: new T3.MeshStandardMaterial({ map: tex() }) }] }; built.set(key, b); return b; };
  ctx.TREE_PACK = { collections: cols };
  const mix = { species: { rocksA: { proportion: 1 }, tuft: { density: 0.02 } }, forest: { rocks: 40, debris: 0, under: 0, cover: 1, reach: 220 } };
  const BIO = { mixAt: () => 'mix', mixOf: () => mix };
  const world = { terrainH: () => 0, waterH: () => -10, island: null };
  const camera = new T3.PerspectiveCamera(60, 16 / 9, 0.5, 5000); camera.position.set(0, 3, 0);
  const scene = new T3.Scene();
  B.load(path.join('src', 'viewer', 'cover_ring.js'));
  const CR = ctx.COVER_RING.make(T3, { scene, world, camera, treeBuild, treeList, LEAF: ctx.TREE_LEAF, BIO, GF: null, biomeAt: () => 'mix', codeAt: () => 1, okAt: () => true });
  CR.set(Object.assign({ batch: true, budgetMs: 1e9, blockBudget: 1e9 }, opt || {}));
  return { CR, camera, tick: (ms) => { clock += ms; }, now: () => clock / 1000, T3 };
}
const blockMeshes = CR => { const L = []; CR.root.traverse(o => { if (o.isInstancedMesh) L.push(o); }); return L; };
const batchMats = CR => { const out = []; CR.root.traverse(o => { if (!o.isBatchedMesh) return; const M = new THREE.Matrix4();
  for (let id = 0; id < o.instanceCount; id++) { try { if (!o.getVisibleAt(id)) continue; o.getMatrixAt(id, M); out.push(Array.from(M.elements)); } catch (e) {} } }); return out; };
{
  // (a) planted in the open, near: the grow
  const A = ring(), Z = ring({ grow: 0 });
  A.CR.update(); Z.CR.update();
  const born = blockMeshes(A.CR).map(m => m.geometry.getAttribute('aBorn'));
  ok(born.length > 0 && born.every(a => a && a.array.every(v => Math.abs(v - A.now()) < 1e-3)), '4 planted in the open: every block instance carries aBorn = its birth', born.length + ' meshes');
  const mA = batchMats(A.CR), mZ = batchMats(Z.CR);
  const colN = e => Math.hypot(e[0], e[1], e[2]);
  ok(mA.length > 0 && mA.length === mZ.length, '4 the batched rocks are the same instances with and without the grow', mA.length + ' / ' + mZ.length);
  const small = mA.filter((e, i) => colN(e) < 0.01 * colN(mZ[i])).length;
  ok(small > 0, '4 a near cell\'s batched rocks start small (grown on the CPU)', small + ' of ' + mA.length);
  A.tick(A.CR.get().grow * 1000 + 1); A.CR.update();
  const mA2 = batchMats(A.CR); let worst = 0; for (let i = 0; i < mA2.length; i++) for (let j = 0; j < 16; j++) worst = Math.max(worst, Math.abs(mA2[i][j] - mZ[i][j]));
  ok(mA2.length === mZ.length && worst === 0, '4 ...and end exactly where the ring with no grow puts them', 'max |d| ' + worst);
  // (b) the pre-grow: hidden between aglOff and aglPre, planting; dropped over aglPre
  const P = ring(), S = P.CR.get();
  P.camera.position.set(0, (S.aglOff + S.aglPre) / 2, 0); P.CR.update();
  const st = P.CR.stat();
  ok(st.hidden && !P.CR.root.visible && st.live > 0, '4 between aglOff and aglPre the ring plants while hidden', 'agl ' + st.agl + ', live ' + st.live);
  const bornH = blockMeshes(P.CR).map(m => m.geometry.getAttribute('aBorn').array[0]);
  ok(bornH.length > 0 && bornH.every(v => v < -1e8), '4 ...born hidden: nothing grows when the fade lets it show', bornH.length);
  P.camera.position.set(0, S.aglPre + 50, 0); P.CR.update();
  ok(P.CR.stat().live === 0, '4 over aglPre the ring is dropped, as before', P.CR.stat().live);
  // (c) the lead: the eye flies +x at 50 m/s for a second high up (nothing planted), then drops in
  const lead = L => { const W = ring({ maxCells: 10, lead: L }); W.camera.position.set(0, 1000, 0);
    for (let i = 0; i < 12; i++) { W.tick(100); W.camera.position.x += 5; W.CR.update(); }
    W.camera.position.y = 3; W.tick(100); W.camera.position.x += 5; W.CR.update();
    const ex = W.camera.position.x; let sx = 0, n = 0; W.CR.root.traverse(o => { if (o.isInstancedMesh) { const a = o.instanceMatrix.array; for (let i = 0; i < o.count; i++) { sx += a[i * 16 + 12] - ex; n++; } } });
    return { lead: W.CR.stat().lead, dx: n ? sx / n : 0 }; };
  const L0 = lead(0), L4 = lead(4);
  ok(L4.lead > 100 && L4.dx > 60 && Math.abs(L0.dx) < 30, '4 the lead: what the eye flies toward is planted first', 'lead ' + L4.lead + ' m: mean dx ' + L4.dx.toFixed(0) + ' m (no lead ' + L0.dx.toFixed(0) + ' m)');
}

// ---- 5. the rise -----------------------------------------------------------------------------------------
{
  const RP = read('render_premises.js');
  const code = lift(RP, '  const RISE = { on: true,', '  const STREAM = { reach: 6000,');
  ok(!!code, '5 the RISE block found in render_premises.js (RISE .. STREAM)');
  if (code) {
    let clock = 0;
    const mkCtx = game => { const c = vm.createContext({ THREE, Math, performance: { now: () => clock }, o: { game } }); vm.runInContext(code + '\nthis.RISE = RISE; this.riseAdd = riseAdd; this.riseTick = riseTick;', c); return c; };
    const C = mkCtx(true);
    const grp = new THREE.Group(); grp.position.set(40, 10, -7);
    const m1 = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 2), new THREE.MeshBasicMaterial()); m1.position.set(1, 3, 0);
    const m2 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()); m2.position.set(-2, 8, 1);
    grp.add(m1, m2); grp.updateMatrixWorld(true);
    const w0 = Array.from(m1.matrixWorld.elements), proto = THREE.Object3D.prototype.onBeforeRender;
    C.riseAdd(grp);
    ok(C.RISE.list.length === 1 && m1.onBeforeRender !== proto && m2.onBeforeRender !== proto, '5 a streamed item is hooked, every mesh of it');
    clock = C.RISE.secs * 1000 * 0.25; C.riseTick();
    m1.onBeforeRender(null, null, null, m1.geometry, m1.material, null);
    const e = m1.matrixWorld.elements, k = 1 - Math.pow(1 - 0.25, 3), y0 = 10;
    ok(Math.abs(e[13] - (y0 + k * (w0[13] - y0))) < 1e-9 && Math.abs(e[5] - k * w0[5]) < 1e-9 && e[12] === w0[12] && e[14] === w0[14], '5 the draw is scaled in y about the foot, x and z untouched', 'y ' + e[13].toFixed(4) + ' k ' + k.toFixed(4));
    m1.onAfterRender(null, null, null, m1.geometry, m1.material, null);
    ok(m1.matrixWorld.elements.every((v, i) => v === w0[i]), '5 ...and the matrix is back, bit for bit, after the draw (nothing else sees the rise)');
    clock = C.RISE.secs * 1000 + 1; C.riseTick();
    ok(C.RISE.list.length === 0 && m1.onBeforeRender === proto && m2.onAfterRender === THREE.Object3D.prototype.onAfterRender, '5 the rise over: the hooks are gone');
    const Cb = mkCtx(false); const g2 = new THREE.Group(); const m3 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)); g2.add(m3); Cb.riseAdd(g2);
    ok(Cb.RISE.list.length === 0 && m3.onBeforeRender === proto, '5 the bench (o.game false) hooks nothing');
  }
  const st = lift(RP, '  function stream(cx, cz) {', '  function prewarm('), pw = lift(RP, '  function prewarm(', '  function buildOne(');
  // (G830: and their house-worker twins - streamW places what the worker made and raises it, prewarmW does not)
  const stW = lift(RP, '  function streamW(cx, cz) {', '\n  }\n'), pwW = lift(RP, '  function prewarmW(', '  function streamW(');
  ok(!!st && /riseAdd\(h\.grp\)/.test(st) && !!stW && /riseAdd\(h\.grp\)/.test(stW), '5 the stream raises what it builds (inline and from the house worker)');
  ok(!!pw && !/riseAdd/.test(pw) && !!pwW && !/riseAdd/.test(pwW), '5 the prewarm (under the roll-out screen) does not (either way)');
}

console.log('GATE FADES: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
