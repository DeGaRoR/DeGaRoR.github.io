#!/usr/bin/env node
// _cover_check.js — GATE COVER (G585): the cover ring's rocks and debris drawn as batches are the same picture
// for a fraction of the draws.
//
// At the airfield stand the ring drew ~1 600 times a frame (rock 252 + 270 shadow, debris 340 + 181, shrub 192 +
// 198, cover 152): one InstancedMesh per prototype PART per 128 m block, each casting. The rocks and the debris are
// now BatchedMeshes, one per (species, material, casts) across the ring, three culling each instance per camera
// (cover_ring.js THE BATCHES). This gate runs the REAL cover ring and the real fade hook (trees.js) on the real
// three.js over a fake WebGL2 (tools/_fake_gl.js), on a stub pack and biome, twice - `batch: false` (the per-block
// instanced path, as before) and `batch: true` - from the same eye, and holds:
//
//   1. THE SAME INSTANCES. Every rock and debris instance of the instanced path is in a batch - its geometry,
//      its matrix, its colour and its fade threshold (aRand there, the colour's alpha here) - and nothing else is.
//   2. THE SAME REACH. An instance draws where its block does (the fade's reach test), and nowhere else.
//   3. FEWER DRAWS. One frame counted per kind (main and shadow): the batched kinds draw once per batch at most.
//   4. SHADOWS FROM 0.35 m. No prototype under castMinH (0.35 m since 2026-10-03, 0.5 since G585) casts, in either path.
//   5. NOTHING LEAKS. The eye leaves and comes back: cells drop and replant, the batches hold exactly the live
//      cells' instances (a dropped cell's ids are reused without switching anybody else's).
//   6. THE FADE READS THE BATCH. The batched program takes aRand from the colour's alpha after <color_vertex>,
//      the instanced one reads its attribute.
//
//   node tools/_cover_check.js   -> "GATE COVER: PASS|FAIL", exit 1 on FAIL
'use strict';
const path = require('path');
const { boot } = require('./_fake_gl.js');
let fails = 0;
const ok = (c, msg, extra) => { console.log((c ? '  ok   ' : '  FAIL ') + msg + (extra !== undefined ? '  (' + extra + ')' : '')); if (!c) fails++; };

// ---- a world the ring can plant: a pack, a mix, flat ground ---------------------------------------------
function ring(batch) {
  const B = boot();
  const { THREE, renderer: R, ctx } = B;
  B.load(path.join('src', 'viewer', 'trees.js'));
  const tex = n => { const t = new THREE.Texture(); t.image = { width: 4, height: 4 }; t.name = n; return t; };
  const maps = { rockA: tex('rockA'), rockB: tex('rockB'), log: tex('log'), stick: tex('stick'), leaf: tex('leaf'), grass: tex('grass') };
  // models: [key, collection, h, map] - two rock models on one map, one on another; a pebble under 0.5 m; debris of two sizes
  const cols = [
    { name: 'rocksA', kind: 'rock', place: { size: 1, sizeVar: 0.3 } },
    { name: 'sticks', kind: 'debris', place: { size: 1 } },
    { name: 'bush', kind: 'shrub', place: { hMin: 0.6, hMax: 1.4 } },
    { name: 'sapling', kind: 'shrub', place: { hMin: 0.4, hMax: 1.0 } },   // the same file as the bush: the SAME material objects (trees.js PACK.materials)
    { name: 'tuft', kind: 'cover', place: { density: 0.4, size: 0.3 } },
  ];
  const models = [
    ['rock1', cols[0], 1.2, 'rockA'], ['rock2', cols[0], 0.9, 'rockA'], ['rock3', cols[0], 1.6, 'rockB'], ['pebble', cols[0], 0.3, 'rockB'],
    ['log', cols[1], 0.7, 'log'], ['twig', cols[1], 0.2, 'stick'],
    ['bush1', cols[2], 1.0, 'leaf'], ['sap1', cols[3], 0.8, 'leaf'], ['tuft1', cols[4], 0.4, 'grass'],
  ];
  const built = new Map(), fileMats = {};
  const geoOf = h => { const g = new THREE.BoxGeometry(1, h, 1); g.translate(0, h / 2, 0); return g; };
  const treeList = () => models.map(([key, col, h]) => ({ key, col, sub: { bb: [-0.5, 0, -0.5, 0.5, h, 0.5], h } }));
  // a shrub is a leaf the loader's way (trees.js hookLeaf: its own sway phase, alpha-tested, both sides) plus its bark
  const treeBuild = (T, key) => { if (built.has(key)) return built.get(key); const m = models.find(x => x[0] === key);
    const leafOf = () => fileMats.leaf || (fileMats.leaf = ctx.TREE_LEAF.hookLeaf(new THREE.MeshStandardMaterial({ map: maps.leaf, alphaTest: 0.5, side: THREE.DoubleSide }), true, {}, 0.5));
    const barkOf = () => fileMats.bark || (fileMats.bark = ctx.TREE_LEAF.hookLeaf(new THREE.MeshStandardMaterial({ map: maps.log }), false, {}));
    const b = m[1].kind === 'shrub'
      ? { parts: [{ geo: geoOf(m[2]), mat: leafOf() }, { geo: geoOf(m[2] * 0.5), mat: barkOf() }] }
      : { parts: [{ geo: geoOf(m[2]), mat: new THREE.MeshStandardMaterial({ map: maps[m[3]] }) }] };
    built.set(key, b); return b; };
  ctx.TREE_PACK = { collections: cols };
  const mix = { species: { rocksA: { proportion: 1 }, sticks: { proportion: 1 }, bush: { proportion: 1 }, sapling: { proportion: 1 }, tuft: { density: 0.02 } }, forest: { rocks: 40, debris: 60, under: 20, cover: 1, reach: 220 } };
  const BIO = { mixAt: () => 'mix', mixOf: () => mix };
  const world = { terrainH: () => 0, waterH: () => -10, island: null };
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.5, 5000); camera.position.set(0, 3, 0); camera.lookAt(100, 0, 40); camera.updateMatrixWorld();
  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight(0xffffff, 1); sun.castShadow = true; sun.position.set(100, 200, 50);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -150; sun.shadow.camera.right = sun.shadow.camera.top = 150; sun.shadow.camera.far = 600; scene.add(sun); scene.add(sun.target);
  B.load(path.join('src', 'viewer', 'cover_ring.js'));
  const CR = ctx.COVER_RING.make(THREE, { scene, world, camera, treeBuild, treeList, LEAF: ctx.TREE_LEAF, BIO, GF: null,
    biomeAt: () => 'mix', codeAt: () => 1, okAt: () => true });
  CR.set({ batch, budgetMs: 1e9, blockBudget: 1e9, grow: 0 });   // the picture as planted (G670: the batched grow is on the CPU; GATE FADES holds it ends here)
  for (let i = 0; i < 4; i++) CR.update();
  return { B, THREE, R, CR, scene, camera, ctx };
}
// every rock / debris instance as a record: geometry height, matrix, colour, threshold
const REC = (h, m, c, r) => [h.toFixed(3)].concat(Array.from(m).map(v => v.toFixed(4)), c.map(v => v.toFixed(4)), [r.toFixed(6)]).join(',');
const heightOf = g => { g.computeBoundingBox(); return g.boundingBox.max.y - g.boundingBox.min.y; };
function instanced(W) {
  const out = [], shown = [];
  W.CR.root.traverse(o => { if (!o.isInstancedMesh || !/rock|debris|shrub/.test(o.userData.coverKind)) return;
    let vis = true; for (let p = o.parent; p; p = p.parent) if (!p.visible) vis = false;   // (the block's reach; the mesh's own flag is the truncation's, G2561)
    const h = heightOf(o.geometry), M = o.instanceMatrix.array, C = o.instanceColor ? o.instanceColor.array : null, A = o.geometry.getAttribute('aRand').array;
    for (let i = 0, n = o.userData.n === undefined ? o.count : o.userData.n; i < n; i++) { const r = REC(h, M.subarray(i * 16, i * 16 + 16), C ? [C[i * 3], C[i * 3 + 1], C[i * 3 + 2]] : [1, 1, 1], A[i]); out.push(r); if (vis) shown.push(r); } });
  return { all: out.sort(), shown: shown.sort() };
}
function batchedRecs(W) {
  const { THREE } = W, out = [], shown = [], m4 = new THREE.Matrix4(), c4 = new THREE.Vector4();
  W.CR.root.traverse(o => { if (!o.isBatchedMesh) return;
    const byId = new Map([...o.userData.geoIds].map(([g, id]) => [id, g]));
    const info = o._instanceInfo;
    for (let i = 0; i < info.length; i++) { if (!info[i].active) continue;
      o.getMatrixAt(i, m4); o.getColorAt(i, c4);
      const r = REC(heightOf(byId.get(info[i].geometryIndex)), m4.elements, [c4.x, c4.y, c4.z], c4.w); out.push(r); if (info[i].visible) shown.push(r); } });
  return { all: out.sort(), shown: shown.sort() };
}
// one frame, counted: renderBufferDirect per kind, the shadow pass flagged
function draws(W) {
  const { R, scene, camera } = W, n = {}; let sh = 0;
  const smr = R.shadowMap.render, rbd = R.renderBufferDirect;
  R.shadowMap.render = function () { sh++; try { return smr.apply(this, arguments); } finally { sh--; } };
  R.renderBufferDirect = function (c, s, g, m, obj) { const k = ((obj && obj.userData && obj.userData.coverKind) || 'other') + (sh ? ':shadow' : ''); n[k] = (n[k] || 0) + 1; return rbd.apply(this, arguments); };
  R.render(scene, camera);
  R.shadowMap.render = smr; R.renderBufferDirect = rbd;
  return n;
}

console.log('GATE COVER');
let A, Bt;
try { A = ring(false); Bt = ring(true); }
catch (e) { ok(false, 'the ring plants in both paths', (e && e.message || String(e)).slice(0, 160)); console.log('GATE COVER: FAIL (' + fails + ')'); process.exit(1); }
const ia = instanced(A), ib = batchedRecs(Bt), rest = instanced(Bt);
// 1
ok(ia.all.length > 100 && JSON.stringify(ia.all) === JSON.stringify(ib.all) && rest.all.length === 0,
   '1 every rock, debris and shrub instance of the instanced path is in a batch, with its geometry, matrix, colour and threshold', ia.all.length + ' instances; ' + ib.all.length + ' batched');
{ const kinds = new Set(); Bt.CR.root.traverse(o => { if (o.isBatchedMesh) kinds.add(o.userData.coverKind); });
  const inst = new Set(); Bt.CR.root.traverse(o => { if (o.isInstancedMesh) inst.add(o.userData.coverKind); });
  ok(kinds.has('rock') && kinds.has('debris') && kinds.has('shrub') && !kinds.has('cover') && !inst.has('shrub') && inst.has('cover'), '1 the batches are the rocks, the debris and the shrubs; the tufts stay instanced by block'); }
// 2 - the eye steps 150 m: the cells behind it are kept (to reach + 2 cells) but their blocks pass the fade's reach
{ for (const W of [A, Bt]) { W.camera.position.set(150, 3, 60); W.camera.updateMatrixWorld(); for (let i = 0; i < 4; i++) W.CR.update(); }
  const sa = instanced(A), sb = batchedRecs(Bt);
  ok(sa.shown.length > 0 && sa.shown.length < sa.all.length && JSON.stringify(sa.all) === JSON.stringify(sb.all) && JSON.stringify(sa.shown) === JSON.stringify(sb.shown),
     '2 the eye moves: the same instances kept, the same within reach (a block past the fade\'s reach draws nothing, batched or not)', sa.shown.length + ' of ' + sa.all.length);
  for (const W of [A, Bt]) { W.camera.position.set(0, 3, 0); W.camera.updateMatrixWorld(); for (let i = 0; i < 4; i++) W.CR.update(); } }
// 3
{ const da = draws(A), db = draws(Bt);
  const k = (d, s) => (d[s] || 0) + (d[s + ':shadow'] || 0);
  const nb = (() => { let n = 0; Bt.CR.root.traverse(o => { if (o.isBatchedMesh) n++; }); return n; })();
  const bk = d => k(d, 'rock') + k(d, 'debris') + k(d, 'shrub');
  ok(bk(db) <= 2 * nb && bk(da) > 3 * bk(db),
     '3 the batched kinds draw once per batch and pass at most', 'rock ' + k(da, 'rock') + ' -> ' + k(db, 'rock') + ', debris ' + k(da, 'debris') + ' -> ' + k(db, 'debris') + ', shrub ' + k(da, 'shrub') + ' -> ' + k(db, 'shrub') + ' (main + shadow, ' + nb + ' batches)');
  ok(k(da, 'cover') === k(db, 'cover'), '3 the tufts draw as before', 'cover ' + k(db, 'cover')); }
// 4
{ const S = Bt.CR.get(); let bad = 0, cast = 0;
  for (const W of [A, Bt]) W.CR.root.traverse(o => { if (!(o.isInstancedMesh || o.isBatchedMesh) || !o.castShadow) return; cast++;
    const geos = o.isBatchedMesh ? [...o.userData.geoIds.keys()] : [o.geometry];
    for (const g of geos) if (/rock|debris/.test(o.userData.coverKind) && heightOf(g) < S.castMinH) bad++; });
  ok(S.castMinH === 0.35 && bad === 0 && cast > 0, '4 no rock or debris under castMinH (0.35 m: the user world look, 2026-10-03; 0.5 since G585) casts, in either path', cast + ' casters'); }
// 5
{ const W = Bt, n0 = batchedRecs(W).all.length;
  W.camera.position.set(3000, 3, 0); W.camera.updateMatrixWorld(); for (let i = 0; i < 4; i++) W.CR.update();
  const away = batchedRecs(W);
  W.camera.position.set(0, 3, 0); W.camera.updateMatrixWorld(); for (let i = 0; i < 4; i++) W.CR.update();
  const back = batchedRecs(W);
  const live = (() => { let n = 0; W.CR.root.traverse(o => { if (o.isBatchedMesh) n += o.instanceCount; }); return n; })();
  ok(away.shown.every(r => !ib.all.includes(r)) && JSON.stringify(back.all) === JSON.stringify(ib.all) && JSON.stringify(back.shown) === JSON.stringify(ib.shown) && live === back.all.length,
     '5 the eye leaves and comes back: the same instances, the same shown, no instance left over', n0 + ' / ' + away.all.length + ' away / ' + back.all.length + ' back, ' + live + ' live');
  // a batch shows exactly when one of its instances does (an empty one would still cost three's per-draw setup every pass)
  let wrong = 0, nb = 0; W.CR.root.traverse(o => { if (!o.isBatchedMesh) return; nb++; let n = 0; for (let i = 0; i < o._instanceInfo.length; i++) if (o._instanceInfo[i].active && o._instanceInfo[i].visible) n++;
    if (o.userData.nVis !== n || o.visible !== n > 0) wrong++; });
  W.CR.set({ batch: false }); for (let i = 0; i < 4; i++) W.CR.update();
  let shownEmpty = 0; W.CR.root.traverse(o => { if (o.isBatchedMesh && o.visible) shownEmpty++; });
  W.CR.set({ batch: true }); for (let i = 0; i < 4; i++) W.CR.update();
  ok(nb > 0 && wrong === 0 && shownEmpty === 0, '5 a batch is visible exactly when one of its instances is (and none after the dial goes back to per-block)', nb + ' batches'); }
// 6
{ const vs = Bt.B.links.concat(A.B.links).map(l => l.vs);
  const batchedVs = vs.filter(s => /#define USE_BATCHING/.test(s) && /_bRand/.test(s)), instVs = vs.filter(s => /#define USE_INSTANCING\b/.test(s) && /uFadeReach/.test(s));
  const good = s => { const a = s.indexOf('attribute float aRand;'), d = s.indexOf('#define aRand _bRand'), c = s.indexOf('_bRand = vColor.a; vColor.a = 1.0;'); return a >= 0 && d > a && c > d; };
  ok(batchedVs.length > 0 && batchedVs.every(good), '6 the batched fade takes its threshold from the colour\'s alpha, after the attribute it stands in for', batchedVs.length + ' programs');
  ok(instVs.length > 0, '6 the instanced fade programs still read aRand (the batch path is compiled out there)', instVs.length + ' programs');
  const leafB = vs.filter(s => /#define USE_BATCHING/.test(s) && /LEAF_SWAY_PH/.test(s)), leafI = vs.filter(s => /#define USE_INSTANCING\b/.test(s) && /LEAF_SWAY_PH/.test(s));
  ok(leafB.length > 0 && leafI.length > 0 && leafB.concat(leafI).every(s => /#define LEAF_SWAY_PH \(getIndirectIndex\(gl_DrawID\) \* 1\.7\)/.test(s) && /#define LEAF_SWAY_PH \(float\(gl_InstanceID\) \* 1\.7\)/.test(s)),
     '6 a batched leaf sways on its own instance (the draw\'s indirect index), an instanced one on gl_InstanceID as before', leafB.length + ' + ' + leafI.length + ' programs'); }

// 7 THE COUNT TRUNCATION (GRASS-DENSE G2561): a block's tufts are ordered by their fade threshold and only the prefix its nearest
// point can show is submitted - every instance left out is one the vertex shader collapses (its _fg <= 0 from where the eye is),
// so the picture is the same to the pixel; and the order is a permutation (the same instances as with trunc off)
const fadeCheck = (W, set, sizeK, href) => {   // -> { meshes, cut (instances left out), bad (left out but would draw) }
  const L = W.ctx.TREE_LEAF, [near, reach, taper, agl] = L.fade(undefined, undefined, undefined, undefined, set), band = L.grow(null, null, null)[1], e = W.camera.position;
  let meshes = 0, cut = 0, bad = 0;
  W.CR.root.traverse(o => { if (!o.isInstancedMesh || o.userData.coverKind !== 'cover' || !o.userData.bins) return;
    let vis = true; for (let p = o.parent; p; p = p.parent) if (!p.visible) vis = false; if (!vis) return;
    meshes++; const M = o.instanceMatrix.array, A = o.geometry.getAttribute('aRand').array;
    for (let i = o.visible ? o.count : 0; i < o.userData.n; i++) { cut++;
      let d = Math.hypot(M[i * 16 + 12] - e.x, M[i * 16 + 13] - e.y, M[i * 16 + 14] - e.z);
      if (sizeK > 0) d /= 1 + (Math.min(1.5, Math.max(0.05, Math.hypot(M[i * 16 + 4], M[i * 16 + 5], M[i * 16 + 6]) / href)) - 1) * sizeK;
      const t = Math.max(0, Math.min(1, (d - near) / Math.max(1, reach - near))), fk = Math.pow(1 - t, 1 + 2 * taper) * agl;
      if ((fk * (1 + band) - A[i]) / Math.max(1e-3, band) > 1e-6) bad++; } });
  return { meshes, cut, bad };
};
{ const coverRecs = W => { const out = []; W.CR.root.traverse(o => { if (!o.isInstancedMesh || o.userData.coverKind !== 'cover') return;
    const M = o.instanceMatrix.array, A = o.geometry.getAttribute('aRand').array, C = o.instanceColor ? o.instanceColor.array : null;
    for (let i = 0; i < o.userData.n; i++) out.push(REC(heightOf(o.geometry), M.subarray(i * 16, i * 16 + 16), C ? [C[i * 3], C[i * 3 + 1], C[i * 3 + 2]] : [1, 1, 1], A[i])); });
    return out.sort(); };
  const T0 = ring(true); T0.CR.set({ trunc: 0 }); for (let i = 0; i < 4; i++) T0.CR.update();
  for (const W of [Bt]) { W.camera.position.set(0, 3, 0); W.camera.updateMatrixWorld(); for (let i = 0; i < 4; i++) W.CR.update(); }
  const on = coverRecs(Bt), off = coverRecs(T0), F = fadeCheck(Bt, null, 0, 1);
  ok(on.length > 50 && JSON.stringify(on) === JSON.stringify(off), '7 the truncated blocks hold the same tufts as the untruncated (a permutation)', on.length + ' tufts');
  ok(F.meshes > 0 && F.cut > 0 && F.bad === 0, '7 every tuft left out of a draw is one the fade collapses from this eye (the picture to the pixel)', F.cut + ' left out of ' + F.meshes + ' meshes, ' + F.bad + ' that would draw'); }

// 8 THE GRASS FIELD (G2563): the second ring of the same file, layer 'grass' - the reed's cards cut into tufts (none bent, moved
// apart or added), the length by the ground and cut where the premises say, the ground's colour over the tinted texel, the tiers
// nested (a nearer eye only adds), and its own truncation exact under the size fade
function fieldRing() {
  const B = boot();
  const { THREE, renderer: R, ctx } = B;
  B.load(path.join('src', 'viewer', 'trees.js'));
  const t = new THREE.Texture(); t.image = { width: 4, height: 4 };
  // a patch of 12 CARDS (two triangles each, separate strips) on a ring of 60 units, 100 units tall
  const g = new THREE.BufferGeometry(), pos = [], uv = [], idx = [];
  for (let c = 0; c < 12; c++) { const a = c / 12 * 2 * Math.PI, x = Math.cos(a) * 60, z = Math.sin(a) * 60, b = pos.length / 3, w = 8 + c;
    pos.push(x - w, 0, z, x + w, 0, z, x + w, 100, z, x - w, 100, z); uv.push(0, 1, 1, 1, 1, 0, 0, 0); idx.push(b, b + 1, b + 2, b, b + 2, b + 3); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  g.setAttribute('aoV', new THREE.Float32BufferAttribute(new Array(pos.length / 3).fill(0.6), 1));
  const mat = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.3, side: THREE.DoubleSide });
  const cols = [{ name: 'grass_reed', kind: 'cover', place: { size: 0.01, lift: 0.29 } }];
  ctx.TREE_PACK = { collections: cols };
  const treeList = () => [{ key: 'reed1', col: cols[0], sub: { bb: [-70, 0, -70, 70, 100, 70], h: 100 } }];
  const treeBuild = () => ({ parts: [{ geo: g, mat }] });
  const mix = { species: { grass_reed: { proportion: 1, density: 0.48 } }, forest: { cover: 1 } };
  const BIO = { mixAt: () => 'grassland', mixOf: () => mix };
  const world = { terrainH: () => 0, waterH: () => -10, island: null };
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.5, 5000); camera.position.set(0, 2, 0); camera.lookAt(40, 0, 10); camera.updateMatrixWorld();
  const scene = new THREE.Scene();
  B.load(path.join('src', 'viewer', 'cover_ring.js'));
  const GM = [0.05, 0.06, 0.02];
  const coverAt = (x, z) => (x > 20 && x < 44 && z > -20 && z < 20) ? { kill: 0, boost: 0, kind: null, cls: 'concrete', cut: 1, surf: 0 } : null;
  const CR = ctx.COVER_RING.make(THREE, { scene, world, camera, treeBuild, treeList, LEAF: ctx.TREE_LEAF, BIO, GF: null, layer: 'grass',
    biomeAt: () => 'grassland', codeAt: () => 2, okAt: () => true, coverAt, groundMeanAt: () => GM.slice() });
  CR.set({ on: true, budgetMs: 1e9, blockBudget: 1e9, grow: 0, tufts: 12, reach: 60, near: 10, blotch: 0 });   // (the field ships off: FIELD_ON)
  for (let i = 0; i < 4; i++) CR.update();
  return { B, THREE, R, CR, scene, camera, ctx, g, GM };
}
{ let Fd;
  try { Fd = fieldRing(); } catch (e) { ok(false, '8 the field plants', (e && e.message || String(e)).slice(0, 200)); }
  if (Fd) {
    const meshes = []; Fd.CR.root.traverse(o => { if (o.isInstancedMesh) meshes.push(o); });
    const geos = [...new Set(meshes.map(m => m.geometry.index))];
    // (a) the tufts: 3 variants of 3 cards each, every card one of the patch's own, moved whole
    const src = Fd.g.attributes.position.array, cardsOf = [];
    for (let c = 0; c < 12; c++) cardsOf.push(Array.from(src.slice(c * 12, c * 12 + 12)));
    let tuftsOk = 0, nT = 0; const seen = new Set();
    for (const m of meshes) { const P = m.geometry.attributes.position.array, I = m.geometry.index.array; if (seen.has(I)) continue; seen.add(I); nT++;
      // its cards: groups of 4 vertices; each must equal a source card less ONE translation shared by the tuft
      let tx = null, tz = null, good = I.length === 3 * 6 && P.length === 3 * 12;
      for (let k = 0; good && k < 3; k++) { const v = Array.from(P.slice(k * 12, k * 12 + 12));
        const match = cardsOf.find(cd => { const dx = cd[0] - v[0], dz = cd[2] - v[2]; if (tx !== null && (Math.abs(dx - tx) > 1e-4 || Math.abs(dz - tz) > 1e-4)) return false;
          for (let q = 0; q < 12; q += 3) if (Math.abs(cd[q] - v[q] - dx) > 1e-4 || Math.abs(cd[q + 1] - v[q + 1]) > 1e-4 || Math.abs(cd[q + 2] - v[q + 2] - dz) > 1e-4) return false; return true; });
        if (!match) good = false; else if (tx === null) { tx = match[0] - v[0]; tz = match[2] - v[2]; } }
      if (good) tuftsOk++; }
    ok(nT === 3 && tuftsOk === 3, '8a the reed is cut into 3 tufts of 3 of its own cards, each card unbent, the tuft moved whole to its foot', tuftsOk + ' of ' + nT + ' tufts');
    // (b) the length: the cut box's at the cut length, the meadow's about the type's median
    const hOf = (m, i) => Math.hypot(m.instanceMatrix.array[i * 16 + 4], m.instanceMatrix.array[i * 16 + 5], m.instanceMatrix.array[i * 16 + 6]) * 100;
    const S = Fd.CR.get(), cutH = [], wildH = [], cols = [];
    for (const m of meshes) for (let i = 0; i < m.userData.n; i++) { const x = m.instanceMatrix.array[i * 16 + 12], z = m.instanceMatrix.array[i * 16 + 14];
      // (the meadow's median read under the eye, where the cells hold the whole stream: a far cell keeps the TALL tufts first - the size fade)
      ((x > 21 && x < 43 && z > -19 && z < 19) ? cutH : (Math.hypot(x, z) < 5) ? wildH : []).push(hOf(m, i));
      cols.push([m.instanceColor.array[i * 3], m.instanceColor.array[i * 3 + 1], m.instanceColor.array[i * 3 + 2]]); }
    const med = a => a.slice().sort((p, q) => p - q)[a.length >> 1];
    ok(cutH.length > 20 && cutH.every(h => h > S.cutH * Math.exp(-2.6 * S.cutSigma) && h < S.cutH * Math.exp(2.6 * S.cutSigma)) && Math.abs(med(wildH) / 0.30 - 1) < 0.15,
       '8b cut where the premises say (' + S.cutH + ' m, uniform), the meadow about its 0.30 m', cutH.length + ' cut, median ' + (cutH.length ? med(cutH).toFixed(3) : '-') + '; ' + wildH.length + ' wild, median ' + (wildH.length ? med(wildH).toFixed(3) : '-'));
    // (c) the colour: the ground's over the tinted texel (no texel mean in node: 0.4), within the tuft-to-tuft swing
    ok(cols.length > 0 && cols.every(c => [0, 1, 2].every(k => Math.abs(c[k] / (Fd.GM[k] / 0.4 * S.match) - 1) <= S.vary + 1e-6)), '8c each tuft wears the ground\'s drawn colour (x match over the tinted texel)', cols.length + ' tufts');
    // (d) the tiers: from 60 m up the cells hold a prefix; down at 2 m they are planted again and only ADD
    const keyOf = (m, i) => m.instanceMatrix.array[i * 16 + 12].toFixed(4) + ',' + m.instanceMatrix.array[i * 16 + 14].toFixed(4);
    const posSet = () => { const s = new Set(); Fd.CR.root.traverse(o => { if (o.isInstancedMesh) for (let i = 0; i < o.userData.n; i++) s.add(keyOf(o, i)); }); return s; };
    // the tufts that DRAW from this eye (the field's fade and size fade, every instance planted - the truncation aside)
    const fs0 = Fd.CR.fadeSet(), LF = Fd.ctx.TREE_LEAF;
    const drawnSet = () => { const [near, reach, taper, agl] = LF.fade(undefined, undefined, undefined, undefined, fs0), [sk, href] = LF.fadeSize(null, null, fs0), band = LF.grow(null, null, null)[1], e = Fd.camera.position, s = new Set();
      Fd.CR.root.traverse(o => { if (!o.isInstancedMesh) return; const M = o.instanceMatrix.array, A = o.geometry.getAttribute('aRand').array;
        for (let i = 0; i < o.userData.n; i++) { let d = Math.hypot(M[i * 16 + 12] - e.x, M[i * 16 + 13] - e.y, M[i * 16 + 14] - e.z);
          d /= 1 + (Math.min(1.5, Math.max(0.05, Math.hypot(M[i * 16 + 4], M[i * 16 + 5], M[i * 16 + 6]) / href)) - 1) * sk;
          const t = Math.max(0, Math.min(1, (d - near) / Math.max(1, reach - near))); if (Math.pow(1 - t, 1 + 2 * taper) * agl * (1 + band) > A[i]) s.add(keyOf(o, i)); } });
      return s; };
    const near0 = posSet(), drawn0 = drawnSet();
    Fd.camera.position.set(0, 60, 0); Fd.camera.updateMatrixWorld(); Fd.CR.replant(); for (let i = 0; i < 4; i++) Fd.CR.update();
    const high = posSet();
    Fd.camera.position.set(0, 2, 0); Fd.camera.updateMatrixWorld(); for (let i = 0; i < 8; i++) Fd.CR.update();
    const low = posSet(), drawnL = drawnSet();
    ok(high.size > 0 && high.size < low.size && [...high].every(k => low.has(k)) && [...low].every(k => near0.has(k)),
       '8d tiered planting: the far eye holds a prefix of the stream, the near eye only adds to it', high.size + ' at 60 m -> ' + low.size + ' at 2 m (planted fresh from 2 m: ' + near0.size + ')');
    ok(drawn0.size > 0 && drawn0.size === drawnL.size && [...drawn0].every(k => drawnL.has(k)), '8d ...and what DRAWS is the same picture as a ring planted fresh from there', drawnL.size + ' drawn both ways');
    // (e) its truncation, exact under the size fade
    const L = Fd.ctx.TREE_LEAF, fs = Fd.CR.fadeSet ? Fd.CR.fadeSet() : null;
    const Fx = fs ? fadeCheck(Fd, fs, L.fadeSize(null, null, fs)[0], L.fadeSize(null, null, fs)[1]) : { meshes: 0, cut: 0, bad: 1 };
    ok(Fx.meshes > 0 && Fx.bad === 0, '8e the field\'s truncation leaves out only tufts its own fade (and size fade) collapses', Fx.cut + ' left out, ' + Fx.bad + ' that would draw');
  }
}

console.log('GATE COVER: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
