#!/usr/bin/env node
// _dmg_scar_check.js - GATE DMGSCAR (G2357-G2360, DMG-SCAR): THE GROUND'S SCAR. The user, 2026-10-07: "the ground should
// also be impacted. I think we should at minimum remove the grass at impact, and possibly put an impact decal on the
// ground." On the user's validated builds (the Cub, the Jodel, the metal Cessna - the certificate stamped), node only:
//
//   1. NOTHING ON AN INTACT AIRCRAFT, NOTHING WITH THE LAYER OFF. The layer off: no record (sim.damageScar() null), and
//      the crashes flown through the worker's host send no damage payload at all (the page's bytes). The layer on: a
//      circuit, the 3 m/s taxi into a trunk (no part but the wheels on the ground) and the drops onto the wheels touch
//      the ground with nothing that scrapes - not one contact recorded, no scar, no payload. (A drop whose propeller
//      DMG-DRIVE grades past a brush is not intact: its scar is that slot alone, said so.)
//   2. THE STANDARD CRASHES SCAR, ON THE GROUND UNDER THEIR CONTACTS. The 30 m/s flights into a trunk (centreline, 2.5 m
//      out) leave craters and gouges, the nose-over its propeller's slot; at most 64 primitives; every gouge's point and
//      every crater's centre within its own half-width (radius) + 0.5 m of a ground contact the gate's own reader saw (a
//      node that is not a wheel, its bottom at the ground), a propeller's slot or a nose's crater within the disc's radius
//      + 0.5 m of the hub's track, the sweep within 0.5 m of the CG's track; nothing over water (a synthetic record).
//   3. READ, NEVER PUSHED: every crash flown with the record and without it (params.scar false) ends on the same bits.
//   4. THE HOP: a crash through the worker's host (sim_host.js makeSimHost, its payloads v8-serialized as postMessage
//      does) and inline: the page's scar (sim_view.js dmgS.scar) is the sim's, at every sealed version; the bytes.
//   5. RESET RESTORES: reset() empties the scar under a new version - the hop sends it, the page's scar is empty.
//   6. THE GRASS CULL IS EXACTLY THE FOOTPRINT (the real cover ring on the real three over a fake WebGL2, the stub pack of
//      GATE COVER, a real crash's scar laid under the eye): every tuft inside the craters' discs and the gouges' strips
//      gone and none outside; the shrubs and the debris inside those or the sweep gone, the rocks all kept; a cell
//      planted after the event plants none there; scar(null) gives back the very same instances.
//   7. NO NEW PROGRAM: the decal (ground_scar.js) parked in the scene and compiled as the roll-out does, then a scar laid
//      and drawn - the links and the program keys (renderer.info.programs) before and after are the same; the cull links
//      nothing either. Every decal vertex on the ground (terrainH + lift, a hilly ground) and inside the footprint; the
//      cleared decal frees its buffers. One frame after the event uploads nothing (no buffer, no texture).
//   REPORT: per build and crash the primitives (craters, gouges, sweeps), their area (the footprint, rastered at 5 cm),
//   the bytes on the hop, the event's cost (the seal; the decal; the cull) and the record's cost per frame.
//
//   node tools/_dmg_scar_check.js            -> "GATE DMGSCAR: PASS|FAIL", exit 1 on FAIL
//   node tools/_dmg_scar_check.js --selftest -> the gate run with the record off (params.scar false): it must go red
'use strict';
const path = require('path'), fs = require('fs'), v8 = require('v8');
const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const OFF_SELF = argv.includes('--scar-off');            // (the selftest's children: the record disabled)

// ---------------------------------------------------------------------------------------------------------------------
// THE CHILD: one build's physics (1-5)
// ---------------------------------------------------------------------------------------------------------------------
if (argv[0] === '--build') {
  const k = argv[1];
  const L = require('./_treecrash_lib.js'), S = require('./_dmg_scar_lib.js');
  const SH = require(path.join(ROOT, 'src', 'viewer', 'sim_host.js')), SV = require(path.join(ROOT, 'src', 'viewer', 'sim_view.js'));
  const C = L.core(), out = { key: k, cases: [], intact: {}, hop: {}, reset: {} };
  const scarOpt = OFF_SELF ? { scar: false } : {};
  const hashOf = sim => require('crypto').createHash('md5').update(Buffer.from(sim.p.buffer)).update(Buffer.from(sim.v.buffer)).digest('hex').slice(0, 12);
  const d0 = L.defOf(k), Rp = ((d0.params.prop || {}).D || 1.8) / 2;
  // ---- 1. the layer off: no record ----
  { const r = S.runCase(k, S.CASES[2], { elastic: true }), sim = r.sim;
    out.intact.offRecord = sim.damageScar ? sim.damageScar() : null; out.intact.offScar = sim.damage().scar === undefined ? null : sim.damage().scar;
    out.intact.offRecord = out.intact.offRecord === null ? null : 'present'; }
  // ---- 1. the layer on, intact: the circuit, the taxi, the drops ----
  { const ci = L.circuit(k, Object.assign({ cert: true }, scarOpt)), sim = L.lastRun.sim, R = sim.damageScar();
    out.intact.circuit = { outcome: ci.outcome, hits: R ? R.hits : null, v: sim.damage().scar ? sim.damage().scar.v : null, prims: sim.damage().scar ? sim.damage().scar.prims.length : null }; }
  // ---- 2 + 3: the standard crashes, with and without the record ----
  for (const c of S.CASES) {
    const r = S.runCase(k, c, Object.assign({}, scarOpt)), sim = r.sim;
    const h1 = hashOf(sim);
    const r0 = S.runCase(k, c, { scar: false }), h0 = hashOf(r0.sim);
    // the reader's contacts / the hub's track / the CG's track, for "under the contacts"
    const near = (x, z, list, step, lim) => { for (let j = 0; j < list.length; j += step) if (Math.hypot(list[j] - x, list[j + 1] - z) <= lim) return true; return false; };
    const bad = [];
    for (const p of r.prims) {
      if (p.k === 'c') { if (!near(p.x, p.z, r.contacts, 4, p.r + 0.5) && !near(p.x, p.z, r.hubs, 2, Rp + 0.5)) bad.push('crater at ' + p.x + ',' + p.z); }
      else if (p.k === 'g') { for (let j = 0; j < p.p.length; j += 2) { const ok = p.ps ? near(p.p[j], p.p[j + 1], r.hubs, 2, Rp + 0.5) : (near(p.p[j], p.p[j + 1], r.contacts, 4, p.w / 2 + 0.5) || near(p.p[j], p.p[j + 1], r.hubs, 2, Rp + 0.5)); if (!ok) { bad.push((p.ps ? 'slot' : 'gouge') + ' point ' + p.p[j] + ',' + p.p[j + 1]); break; } } }
      else if (p.k === 's') { for (let j = 0; j < p.p.length; j += 2) if (!near(p.p[j], p.p[j + 1], r.cg, 3, 0.5)) { bad.push('sweep point ' + p.p[j]); break; } }
    }
    // the contacts' share inside the footprint (a REPORT: a light touch that slid under 0.3 m and dug no bowl leaves none)
    let inF = 0, nC = 0; for (let j = 0; j < r.contacts.length; j += 4) { nC++; if (C.scarIn(r.prims, r.contacts[j], r.contacts[j + 1], true)) inF++; }
    // the footprint's area: rastered at 5 cm over its box (overlaps once)
    let area = 0, areaS = 0; { const b = C.scarBox(r.prims, true); if (b) { const h = 0.05; for (let x = b[0]; x <= b[2]; x += h) for (let z = b[1]; z <= b[3]; z += h) { if (C.scarIn(r.prims, x, z, false)) area += h * h; if (C.scarIn(r.prims, x, z, true)) areaS += h * h; } } }
    const R = sim.damageScar();
    out.cases.push({ id: c.id, label: c.label, v: r.v, n: r.prims.length, craters: r.prims.filter(p => p.k === 'c').length, gouges: r.prims.filter(p => p.k === 'g').length,
      slots: r.prims.filter(p => p.ps).length, sweeps: r.prims.filter(p => p.k === 's').length, bytes: r.bytes, prims: r.prims, bad, contacts: nC, inFoot: inF,
      area: +area.toFixed(2), areaSweep: +areaS.toFixed(2), same: h1 === h0, h1, h0, rec: R ? { hits: R.hits, frames: R.frames, seals: R.seals, ms: +R.ms.toFixed(3) } : null,
      crashed: r.crashed, reason: r.reason, strike: r.strike, breaks: r.breaks });
  }
  // ---- the record's cost per frame: the 2.5 m crash flown with and without it, alternated (ms of step) ----
  { const c = S.CASES[3], ms = { on: [], off: [] };
    for (let rep = 0; rep < 3; rep++) for (const on of [true, false]) { const r = S.runCase(k, c, on ? scarOpt : { scar: false }); ms[on ? 'on' : 'off'].push(r.wallMs / r.frames); }
    const med = a => a.slice().sort((x, y) => x - y)[a.length >> 1];
    out.cost = { onMs: +med(ms.on).toFixed(3), offMs: +med(ms.off).toFixed(3) }; }
  // ---- 4 + 5: the hop - the worker's (sim_host.js simDmgHop with its 0.1 s set window, as the host's meta() calls it on
  // every snapshot; its payload v8-serialized as postMessage does) and the inline page's (app.js dmgNow: no window) -
  // applied to the page's state (sim_view.js simViewDmgApply); then reset ----
  { const c = S.CASES[3], core = d0.refs.noseFrame[0];
    const stW = SV.simViewDmgState(d0.nodes.length, d0.beams.length), stI = SV.simViewDmgState(d0.nodes.length, d0.beams.length);
    const hopW = SH.simDmgHop0(), hopI = SH.simDmgHop0();
    let sends = 0, scarSends = 0, bytes = 0, allBytes = 0, mism = 0, checks = 0, simW = null;
    S.runCase(k, c, Object.assign({}, scarOpt, { onFrame: sim => {
      simW = sim;
      const PW = SH.simDmgHop(sim, hopW, core);
      if (PW) { const P = v8.deserialize(v8.serialize(PW)); sends++; allBytes += JSON.stringify(PW).length; if (P.sc) { scarSends++; bytes += JSON.stringify(P.sc).length; } SV.simViewDmgApply(stW, P); }
      const PI = SH.simDmgHop(sim, hopI, core, 0); if (PI) SV.simViewDmgApply(stI, PI);
      const S0 = sim.damage().scar; if (S0) { checks++; if (JSON.stringify(stW.scar) !== JSON.stringify(S0.prims) || JSON.stringify(stI.scar) !== JSON.stringify(S0.prims)) mism++; }
    } }));
    out.hop = { sends, scarSends, bytes, allBytes, mism, checks, v: simW && simW.damage().scar ? simW.damage().scar.v : null, prims: stW.scar.length, vS: stW.vS };
    // 5: reset
    simW.reset(0); const PW = SH.simDmgHop(simW, hopW, core), P = PW ? v8.deserialize(v8.serialize(PW)) : null; if (P) SV.simViewDmgApply(stW, P);
    out.reset = { prims: simW.damage().scar.prims.length, v: simW.damage().scar.v, sent: !!(P && P.sc), page: stW.scar.length };
    const P2 = SH.simDmgHop(simW, hopW, core); out.reset.again = !!(P2 && P2.sc);
    // the layer off: the hop sends nothing in the whole crash (the host's meta() then carries no damage key)
    let keysOff = 0, bytesOff = 0; const hopO = SH.simDmgHop0();
    S.runCase(k, c, { elastic: true, onFrame: sim => { const P0 = SH.simDmgHop(sim, hopO, core); if (P0) { keysOff++; bytesOff += JSON.stringify(P0).length; } } });
    out.hop.offKeys = keysOff; out.hop.offBytes = bytesOff;
  }
  console.log('RESULT ' + JSON.stringify(out));
  process.exit(0);
}

// ---------------------------------------------------------------------------------------------------------------------
// THE PAGE (6, 7): the cover ring and the decal on the real three over a fake WebGL2
// ---------------------------------------------------------------------------------------------------------------------
function pageChecks(prims0, yes, rep, extra) {
  // _fake_gl.js boot(), with a RECORDER on its GL (the uploads counted per call: bufferData, texImage2D, ...)
  const FG = require('./_fake_gl.js'), vm = require('vm'), rec = FG.makeRecorder();
  const B = (() => { const links = [], { gl, WebGL2RenderingContext, canvas } = FG.makeGL({ links, rec });
    const ctx = { console, performance, setTimeout, clearTimeout, requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, WebGL2RenderingContext, navigator: { userAgent: 'node' } };
    ctx.globalThis = ctx; ctx.window = ctx; ctx.self = ctx; vm.createContext(ctx); vm.runInContext(FG.THREE_SRC, ctx);
    const THREE = ctx.THREE; canvas.getContext = () => gl;
    const renderer = new THREE.WebGLRenderer({ context: gl, canvas, reversedDepthBuffer: true });
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; ctx.window.THREE = THREE;
    const load = rel => { vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/^'use strict';/m, ''), ctx); };
    load(path.join('src', 'viewer', 'matlib.js')); ctx.MATLIB = vm.runInContext('MATLIB', ctx);
    return { THREE, renderer, links, ctx, load }; })();
  const { THREE, renderer: Rr, ctx } = B;
  const UP = ['bufferData', 'bufferSubData', 'texImage2D', 'texSubImage2D', 'texStorage2D', 'compressedTexImage2D'];
  const uploads = () => UP.reduce((a, k) => a + (rec.calls[k] || 0), 0);
  B.load(path.join('src', 'core', '34_scar.js'));
  B.load(path.join('src', 'viewer', 'trees.js'));
  B.load(path.join('src', 'viewer', 'ground_scar.js'));
  B.load(path.join('src', 'viewer', 'cover_ring.js'));
  // GATE COVER's stub pack: rocks, debris, two shrubs on one file, a tuft (denser here)
  const tex = n => { const t = new THREE.Texture(); t.image = { width: 4, height: 4 }; t.name = n; return t; };
  const maps = { rockA: tex('rockA'), rockB: tex('rockB'), log: tex('log'), stick: tex('stick'), leaf: tex('leaf'), grass: tex('grass') };
  const cols = [
    { name: 'rocksA', kind: 'rock', place: { size: 1, sizeVar: 0.3 } }, { name: 'sticks', kind: 'debris', place: { size: 1 } },
    { name: 'bush', kind: 'shrub', place: { hMin: 0.6, hMax: 1.4 } }, { name: 'sapling', kind: 'shrub', place: { hMin: 0.4, hMax: 1.0 } },
    { name: 'tuft', kind: 'cover', place: { density: 0.4, size: 0.3 } } ];
  const models = [['rock1', cols[0], 1.2, 'rockA'], ['rock2', cols[0], 0.9, 'rockA'], ['rock3', cols[0], 1.6, 'rockB'], ['pebble', cols[0], 0.3, 'rockB'],
    ['log', cols[1], 0.7, 'log'], ['twig', cols[1], 0.2, 'stick'], ['bush1', cols[2], 1.0, 'leaf'], ['sap1', cols[3], 0.8, 'leaf'], ['tuft1', cols[4], 0.4, 'grass']];
  const built = new Map(), fileMats = {};
  const geoOf = h => { const g = new THREE.BoxGeometry(1, h, 1); g.translate(0, h / 2, 0); return g; };
  const treeList = () => models.map(([key, col, h]) => ({ key, col, sub: { bb: [-0.5, 0, -0.5, 0.5, h, 0.5], h } }));
  const treeBuild = (T, key) => { if (built.has(key)) return built.get(key); const m = models.find(x => x[0] === key);
    const leafOf = () => fileMats.leaf || (fileMats.leaf = ctx.TREE_LEAF.hookLeaf(new THREE.MeshStandardMaterial({ map: maps.leaf, alphaTest: 0.5, side: THREE.DoubleSide }), true, {}, 0.5));
    const barkOf = () => fileMats.bark || (fileMats.bark = ctx.TREE_LEAF.hookLeaf(new THREE.MeshStandardMaterial({ map: maps.log }), false, {}));
    const b = m[1].kind === 'shrub' ? { parts: [{ geo: geoOf(m[2]), mat: leafOf() }, { geo: geoOf(m[2] * 0.5), mat: barkOf() }] }
      : { parts: [{ geo: geoOf(m[2]), mat: new THREE.MeshStandardMaterial({ map: maps[m[3]] }) }] };
    built.set(key, b); return b; };
  ctx.TREE_PACK = { collections: cols };
  const mix = { species: { rocksA: { proportion: 1 }, sticks: { proportion: 1 }, bush: { proportion: 1 }, sapling: { proportion: 1 }, tuft: { density: 0.48 } }, forest: { rocks: 40, debris: 120, under: 120, cover: 1, reach: 220 } };
  const BIO = { mixAt: () => 'mix', mixOf: () => mix };
  // a hilly ground (the decal must follow it), water nowhere near
  const hill = (x, z) => 2 * Math.sin(x / 9) * Math.cos(z / 13) + 0.3 * Math.sin(x * 0.7 + z * 0.4);
  const world = { terrainH: hill, waterH: () => -100, surface: () => 0, island: null };
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.5, 5000); camera.position.set(0, 3, 0); camera.lookAt(30, 0, 10); camera.updateMatrixWorld();
  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight(0xffffff, 1); sun.castShadow = true; sun.position.set(100, 200, 50);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -150; sun.shadow.camera.right = sun.shadow.camera.top = 150; sun.shadow.camera.far = 600; scene.add(sun); scene.add(sun.target);
  scene.add(new THREE.HemisphereLight(0x9bbefb, 0x404030, 1)); scene.fog = new THREE.Fog(0xcccccc, 100, 3000);
  const CR = ctx.COVER_RING.make(THREE, { scene, world, camera, treeBuild, treeList, LEAF: ctx.TREE_LEAF, BIO, GF: null, biomeAt: () => 'mix', codeAt: () => 1, okAt: () => true });
  CR.set({ batch: true, budgetMs: 1e9, blockBudget: 1e9, grow: 0 });
  for (let i = 0; i < 4; i++) CR.update();
  // the decal, parked as the roll-out parks it, and the scene compiled (the roll-out's compile step)
  const decal = ctx.GROUND_SCAR.make(THREE); scene.add(decal);
  Rr.compile(scene, camera); Rr.render(scene, camera);
  const progKeys = () => (Rr.info.programs || []).map(p => p.cacheKey).sort();
  const L0 = B.links.length, K0 = progKeys();
  // a steady frame's uploads before any scar (the batches' per-instance cull textures go every frame: three's own)
  Rr.render(scene, camera); let u0 = uploads(); Rr.render(scene, camera); const upBase = uploads() - u0;
  // the scar: the real crash's primitives moved under the eye (their own shape; the box's centre to (25, 8))
  const bx = ctx.scarBox(prims0, true), dx = 25 - (bx[0] + bx[2]) / 2, dz = 8 - (bx[1] + bx[3]) / 2;
  const mv = p => p.k === 'c' ? Object.assign({}, p, { x: p.x + dx, z: p.z + dz }) : Object.assign({}, p, { p: p.p.map((v, j) => v + (j % 2 ? dz : dx)) });
  const prims = prims0.map(mv);
  const census = () => { const c = CR.census(), o = []; for (let j = 0; j < c.length; j += 3) o.push(c[j] + ':' + c[j + 1].toFixed(4) + ':' + c[j + 2].toFixed(4)); return o.sort(); };
  const before = census();
  const t0 = process.hrtime.bigint();
  const cut = CR.scar(prims);
  const cullMs = Number(process.hrtime.bigint() - t0) / 1e6;
  for (let i = 0; i < 2; i++) CR.update();
  const after = census();
  // 6: exactly the footprint
  const setA = new Set(after); let wrongCut = 0, wrongKept = 0, rocksGone = 0, nCover = 0, cutBy = {};
  for (const r of before) {
    const [kind, xs, zs] = r.split(':'), x = +xs, z = +zs, gone = !setA.has(r);
    const inside = kind === 'cover' ? ctx.scarIn(prims, x, z, false) : (kind === 'shrub' || kind === 'debris') ? ctx.scarIn(prims, x, z, true) : false;
    if (kind === 'cover') nCover++;
    if (gone) cutBy[kind] = (cutBy[kind] || 0) + 1;
    if (kind === 'rock' && gone) rocksGone++;
    else if (gone && !inside) wrongCut++;
    else if (!gone && inside) wrongKept++;
  }
  const nothingNew = after.every(r => before.includes(r));
  yes(cut.cut > 0 && wrongCut === 0 && wrongKept === 0 && rocksGone === 0 && nothingNew && (cutBy.cover || 0) > 0,
    '6 the grass cull is exactly the footprint: ' + (cutBy.cover || 0) + ' tufts gone of ' + nCover + ', ' + (cutBy.shrub || 0) + ' shrubs and ' + (cutBy.debris || 0) + ' debris (the sweep too); none outside, none left inside, the rocks all kept (' + cut.cells + ' cells, ' + cullMs.toFixed(1) + ' ms)');
  // a cell planted after the event: the eye goes away (the ring drops everything) and comes back (it plants again)
  camera.position.set(3000, 3, 0); camera.updateMatrixWorld(); for (let i = 0; i < 4; i++) CR.update();
  camera.position.set(0, 3, 0); camera.updateMatrixWorld(); for (let i = 0; i < 4; i++) CR.update();
  const again = census();
  yes(JSON.stringify(again) === JSON.stringify(after), '6 cells planted after the event plant none in it: the same instances as the cull left', again.length + ' instances');
  // 7: the decal - no new program
  const t1 = process.hrtime.bigint();
  const st = ctx.GROUND_SCAR.build(THREE, decal, prims, world);
  const decalMs = Number(process.hrtime.bigint() - t1) / 1e6;
  // the buffers' uploads: the frame that first draws the decal, then the next
  u0 = uploads(); Rr.render(scene, camera); const upFirst = uploads() - u0;
  u0 = uploads(); Rr.render(scene, camera); const upNext = uploads() - u0;
  { u0 = uploads(); Rr.render(scene, camera); }   // (a third: the ring settled)
  const L1 = B.links.length, K1 = progKeys();
  yes(L1 === L0 && JSON.stringify(K1) === JSON.stringify(K0) && decal.visible && st.tris > 0,
    '7 no program links in a crash: the decal parked and compiled with the scene, the scar laid and drawn, the cull done - links ' + L0 + ' -> ' + L1 + ', program keys ' + K0.length + ' -> ' + K1.length + ' (the same)');
  { const P = decal.geometry.getAttribute('position'), A = decal.geometry.getAttribute('color'); let off = 0, out = 0, maxE = 0;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), e = Math.abs(y - hill(x, z) - ctx.GROUND_SCAR.S.lift); if (e > maxE) maxE = e; if (e > 1e-4) off++;
      if (A.getW(i) > 0 && !ctx.scarIn(prims, x, z, false)) { let near = false; for (const p of prims) if (p.k === 'c' ? Math.hypot(x - p.x, z - p.z) <= p.r + 0.01 : p.k === 'g' && ctx.scarSegD(p.p, x, z) <= p.w / 2 + 0.01) near = true; if (!near) out++; } }
    yes(off === 0 && out === 0, '7 every decal vertex on the ground (terrainH + ' + ctx.GROUND_SCAR.S.lift + ' m on a hilly ground, worst ' + (maxE * 1000).toFixed(3) + ' mm) and inside the footprint', P.count + ' vertices, ' + st.tris + ' triangles, ' + (st.bytes / 1024).toFixed(1) + ' KB');
    rep('the decal: ' + st.prims + ' primitives -> ' + st.tris + ' triangles, ' + P.count + ' vertices, ' + (st.bytes / 1024).toFixed(1) + ' KB of buffers, built in ' + decalMs.toFixed(2) + ' ms; the first frame after the event uploads ' + upFirst + ' buffers / textures (the decal\'s and the rebuilt blocks\'), the next ' + upNext + ' (a steady frame before the crash: ' + upBase + ')'); }
  yes(upNext === upBase && upFirst > upBase, '7 a frame after the event uploads nothing more than a frame before the crash (' + upBase + ': the batches\' own) - the decal\'s buffers and the rebuilt blocks went once (' + (upFirst - upBase) + ')');
  // reset: the decal cleared (its buffers disposed), the ring's cells planted again whole
  let disposed = 0; const g1 = decal.geometry; g1.addEventListener('dispose', () => disposed++);
  ctx.GROUND_SCAR.clear(decal); const rs = CR.scar(null); for (let i = 0; i < 4; i++) CR.update();
  const restored = census();
  Rr.render(scene, camera);
  yes(disposed === 1 && !decal.visible && decal.geometry === decal.userData.parked && JSON.stringify(restored) === JSON.stringify(before) && B.links.length === L0,
    '5 reset restores: the decal\'s buffers freed and the mesh parked; the ring\'s cells under the scar planted again - the very instances before the crash (' + restored.length + '); no link', rs.dropped + ' cells dropped and replanted');
  // REPORT: every crash's scar laid in turn under the eye (the stub's tuft at the shipped reed row: 0.48 a m2 x the ring's
  // density 2) - the instances it culls, the decal's triangles and buffers, the event's cost - and let go
  const per = [];
  for (const e of (extra || [])) {
    if (!e.prims.length) continue;
    const b2 = ctx.scarBox(e.prims, true), ex = 25 - (b2[0] + b2[2]) / 2, ez = 8 - (b2[1] + b2[3]) / 2;
    const P2 = e.prims.map(p => p.k === 'c' ? Object.assign({}, p, { x: p.x + ex, z: p.z + ez }) : Object.assign({}, p, { p: p.p.map((v, j) => v + (j % 2 ? ez : ex)) }));
    const c0 = census(), ta = process.hrtime.bigint(), cu = CR.scar(P2), tb = process.hrtime.bigint(), sd = ctx.GROUND_SCAR.build(THREE, decal, P2, world), tc = process.hrtime.bigint();
    for (let i = 0; i < 2; i++) CR.update();
    const c1 = new Set(census()), by = {}; for (const r of c0) if (!c1.has(r)) { const k = r.split(':')[0]; by[k] = (by[k] || 0) + 1; }
    per.push({ label: e.label, cover: by.cover || 0, shrub: by.shrub || 0, debris: by.debris || 0, cells: cu.cells, cullMs: +(Number(tb - ta) / 1e6).toFixed(2), tris: sd.tris, kb: +(sd.bytes / 1024).toFixed(1), decalMs: +(Number(tc - tb) / 1e6).toFixed(2) });
    rep(e.label + ': culls ' + (by.cover || 0) + ' tufts, ' + (by.shrub || 0) + ' shrubs, ' + (by.debris || 0) + ' debris (' + cu.cells + ' cells, ' + per[per.length - 1].cullMs + ' ms); the decal ' + sd.tris + ' triangles, ' + per[per.length - 1].kb + ' KB, ' + per[per.length - 1].decalMs + ' ms');
    ctx.GROUND_SCAR.clear(decal); CR.scar(null); for (let i = 0; i < 4; i++) CR.update();
  }
  return { cullMs, decalMs, tris: st.tris, bytes: st.bytes, cut: cutBy, per };
}

// ---------------------------------------------------------------------------------------------------------------------
// THE GATE
// ---------------------------------------------------------------------------------------------------------------------
if (argv.includes('--page-only')) {   // (a quick run of 6 and 7 on the last run's Cub scar: reports/evidence/DMG-SCAR/gate_dmgscar.json)
  const J = JSON.parse(fs.readFileSync(path.join(ROOT, 'reports', 'evidence', 'DMG-SCAR', 'gate_dmgscar.json'), 'utf8'));
  const extra = []; for (const k of Object.keys(J.results)) for (const c of J.results[k].cases) if (c.n) extra.push({ label: k + ', ' + c.label, prims: c.prims });
  let f = 0; pageChecks(J.results.cub.cases.find(c => c.id === 'fly25').prims, (ok, m) => { if (!ok) f++; console.log((ok ? '  ok    ' : '  FAIL  ') + m); }, m => console.log('  REPORT  ' + m), extra);
  process.exit(f ? 1 : 0);
}
if (argv.includes('--selftest')) {
  // the gate itself, the record disabled in every child: it must go red
  const r = require('child_process').spawnSync(process.execPath, [__filename, '--scar-off'], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const red = r.status !== 0 && /GATE DMGSCAR: FAIL/.test(r.stdout);
  console.log((r.stdout || '').split('\n').filter(l => /FAIL|GATE/.test(l)).slice(0, 12).join('\n'));
  console.log('SELFTEST DMGSCAR: ' + (red ? 'PASS (the gate goes red with the scar disabled)' : 'FAIL (the gate stayed green with the scar disabled)'));
  process.exit(red ? 0 : 1);
}
let checks = 0, fails = 0;
const yes = (ok, msg) => { checks++; if (!ok) fails++; console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + msg); };
const rep = msg => console.log('  REPORT  ' + msg);
(async () => {
  const { spawn } = require('child_process'), S = require('./_dmg_scar_lib.js'), t0 = Date.now();
  const run = k => new Promise(res => {
    const c = spawn(process.execPath, [__filename, '--build', k].concat(OFF_SELF ? ['--scar-off'] : []), { stdio: ['ignore', 'pipe', 'pipe'] });
    let so = '', se = ''; c.stdout.on('data', d => { so += d; }); c.stderr.on('data', d => { se += d; });
    c.on('close', () => { const l = so.split('\n').reverse().find(x => x.indexOf('RESULT ') === 0); res(l ? JSON.parse(l.slice(7)) : { key: k, err: se.slice(-1200) }); });
  });
  const R = {}; await Promise.all(S.BUILDS.map(async k => { R[k] = await run(k); }));
  console.log('GATE DMGSCAR (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s, ' + S.BUILDS.length + ' builds, the certificate stamped' + (OFF_SELF ? '; THE RECORD DISABLED (selftest)' : '') + ')');
  const LAB = { cub: "the user's Cub", jodel: 'the Jodel', metal: 'the metal Cessna' };
  const all = {};
  let pick = null;
  for (const k of S.BUILDS) {
    const r = R[k]; console.log(LAB[k] + ':');
    if (r.err) { yes(false, 'the build ran: ' + r.err.split('\n').slice(-6).join(' | ')); continue; }
    all[k] = r;
    const by = id => r.cases.find(c => c.id === id);
    // 1
    yes(r.intact.offRecord === null && r.intact.offScar === null && r.hop.offKeys === 0 && r.hop.offBytes === 0,
      '1 the layer off: no record, no scar, not one damage payload from the hop in a whole 30 m/s crash (the page\'s bytes)');
    yes(r.intact.circuit.hits === 0 && r.intact.circuit.v === 0 && r.intact.circuit.prims === 0,
      '1 a circuit (' + r.intact.circuit.outcome + '): not one ground contact recorded, no scar');
    { const tx = by('taxi'); yes(tx.rec && tx.rec.hits === 0 && tx.v === 0 && tx.n === 0, '1 the 3 m/s taxi into a trunk (only the wheels on the ground): not one contact recorded, no scar'); }
    for (const id of ['drop', 'drop6']) { const d = by(id);
      const struck = d.strike && d.strike !== 'brush';
      if (d.crashed || d.breaks) yes(d.n > 0, '2 ' + d.label + ': a crash (' + d.reason + ') - it scars (' + d.craters + ' craters, ' + d.gouges + ' gouges' + (d.slots ? ' incl. the prop\'s slot' : '') + ')');
      else if (!struck) yes(d.rec && d.rec.hits === 0 && d.v === 0 && d.n === 0, '1 ' + d.label + ': only the wheels touch - nothing recorded, no scar');
      else yes(d.n === d.slots && d.rec.hits === 0, '1 ' + d.label + ': nothing of the airframe touches; the propeller struck (DMG-DRIVE: ' + d.strike + ') - its scar is that slot alone (' + d.slots + ')');
    }
    // 2 + 3
    for (const c of r.cases) {
      const crash = c.id === 'fly0' || c.id === 'fly25';
      if (crash) yes(c.n > 0 && (c.craters + c.gouges) > 0, '2 ' + c.label + ': a scar (' + c.craters + ' craters, ' + c.gouges + ' gouges, ' + c.sweeps + ' sweep; ' + c.area.toFixed(1) + ' m2 torn, ' + c.areaSweep.toFixed(1) + ' m2 with the sweep)');
      if (c.id === 'noseover') yes(c.slots > 0 || c.craters > 0, '2 ' + c.label + ': the propeller\'s slot' + (c.craters ? ' and the nose\'s crater' : '') + ' (' + c.n + ' primitives)');
      if (c.n) yes(c.n <= 64 && c.bad.length === 0, '2 ' + c.label + ': ' + c.n + ' primitives (at most 64), every one on the ground under the contacts' + (c.bad.length ? ' - ' + c.bad.slice(0, 3).join('; ') : ''));
      yes(c.same, '3 ' + c.label + ': the same bits with the record and without (' + c.h1 + ')');
    }
    // 4 + 5
    yes(r.hop.checks > 0 && r.hop.mism === 0 && r.hop.scarSends === r.hop.v && r.hop.prims > 0,
      '4 the hop: the page\'s scar is the sim\'s at every frame, the worker\'s hop (its window, v8) and the inline one - ' + r.hop.scarSends + ' scar payload(s) (one a sealed event), ' + r.hop.bytes + ' B of scar in ' + r.hop.sends + ' damage payloads (' + r.hop.allBytes + ' B in all)');
    yes(r.reset.prims === 0 && r.reset.sent && r.reset.page === 0 && !r.reset.again, '5 reset: the scar empty under a new version (v' + r.reset.v + '), sent once, the page\'s scar empty');
    for (const c of r.cases) rep(c.label + ': v' + c.v + ', ' + c.n + ' primitives (' + c.craters + ' craters, ' + c.gouges + ' gouges' + (c.slots ? ' incl. ' + c.slots + ' prop slot' : '') + ', ' + c.sweeps + ' sweep), ' + c.area.toFixed(2) + ' m2 (' + c.areaSweep.toFixed(2) + ' with the sweep), ' + c.bytes + ' B; '
      + (c.contacts ? Math.round(100 * c.inFoot / c.contacts) + ' % of ' + c.contacts + ' contact samples in it; ' : '') + 'record ' + (c.rec ? c.rec.hits + ' contacts, ' + c.rec.frames + ' frames, ' + c.rec.seals + ' seal(s), ' + c.rec.ms + ' ms sealing' : '-') + (c.crashed ? '; crashed (' + c.reason + ')' : '') + (c.strike ? '; prop ' + c.strike : ''));
    rep('the step with the record / without, the 2.5 m crash (median of 3 alternated): ' + r.cost.onMs + ' / ' + r.cost.offMs + ' ms a frame');
    if (!pick) { const f = by('fly25'); if (f && f.n) pick = f.prims; }
  }
  // 6 + 7: the page
  console.log('the page (the cover ring and the decal on the real three, a fake WebGL2):');
  let page = null;
  const extra = []; for (const k of S.BUILDS) if (all[k]) for (const c of all[k].cases) if (c.n) extra.push({ label: LAB[k] + ', ' + c.label, prims: c.prims });
  if (pick) { try { page = pageChecks(pick, yes, rep, extra); } catch (e) { yes(false, 'the page checks ran: ' + (e && e.stack || e).toString().split('\n').slice(0, 4).join(' | ')); } }
  else yes(false, '6 a crash scar to lay under the ring');
  // the synthetic record: water - nothing scars over it
  { const C = require('./_treecrash_lib.js').core();
    const def = { nodes: [{ p: [0, 0, 0], m: 10, r: 0 }, { p: [1, 0, 0], m: 10, r: 0 }], beams: [{ a: 0, b: 1, sec: 'fuselage' }] };
    const R = C.scarMake(def, 0), p = new Float64Array(6), m = new Float64Array([10, 10]);
    const W = { terrainH: () => 0, waterH: (x) => (x > 0 ? 1 : -5), surface: () => 0 };
    const D = { breaks: 1, crashed: true, over: false };
    for (let f = 0; f < 120; f++) { const x = -6 + f * 0.1; p[0] = x; p[2] = 0; p[3] = x; p[5] = 1;
      for (let s = 0; s < 24; s++) { C.scarHit(R, 0, x, 0, 5000, f < 3 ? -4 : 0, 4000 * 6, 1 / 1440); C.scarHit(R, 1, x, 1, 5000, f < 3 ? -4 : 0, 4000 * 6, 1 / 1440); }
      C.scarFrame(R, p, m, W, f / 60, D); }
    D.over = true; C.scarFrame(R, p, m, W, 2, D);
    const P = R.out.prims; let wet = 0; for (const q of P) { if (q.k === 'c' && q.x > 0) wet++; if (q.k !== 'c') for (let j = 0; j < q.p.length; j += 2) if (q.p[j] > 0.05) wet++; }
    yes(P.length > 0 && wet === 0, '2 water: a slide from dry ground into the water - its scar stops at the shore (' + P.length + ' primitives, none over the water)'); }
  console.log('GATE DMGSCAR: ' + (fails ? 'FAIL (' + fails + ' of ' + checks + ')' : 'PASS (' + checks + ' checks)'));
  try { fs.writeFileSync(path.join(ROOT, 'reports', 'evidence', 'DMG-SCAR', 'gate_dmgscar.json'), JSON.stringify({ results: all, page }, null, 1)); } catch (e) {}
  process.exit(fails ? 1 : 0);
})();
