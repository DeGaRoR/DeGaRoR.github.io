#!/usr/bin/env node
// _cover_check.js — GATE COVER (G574): the cover ring's rocks and debris drawn as batches are the same picture
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
//   4. SHADOWS FROM 0.5 m. No prototype under castMinH (0.5 m since G574) casts, in either path.
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
  CR.set({ batch, budgetMs: 1e9, blockBudget: 1e9 });
  for (let i = 0; i < 4; i++) CR.update();
  return { B, THREE, R, CR, scene, camera, ctx };
}
// every rock / debris instance as a record: geometry height, matrix, colour, threshold
const REC = (h, m, c, r) => [h.toFixed(3)].concat(Array.from(m).map(v => v.toFixed(4)), c.map(v => v.toFixed(4)), [r.toFixed(6)]).join(',');
const heightOf = g => { g.computeBoundingBox(); return g.boundingBox.max.y - g.boundingBox.min.y; };
function instanced(W) {
  const out = [], shown = [];
  W.CR.root.traverse(o => { if (!o.isInstancedMesh || !/rock|debris|shrub/.test(o.userData.coverKind)) return;
    let vis = true; for (let p = o; p; p = p.parent) if (!p.visible) vis = false;
    const h = heightOf(o.geometry), M = o.instanceMatrix.array, C = o.instanceColor ? o.instanceColor.array : null, A = o.geometry.getAttribute('aRand').array;
    for (let i = 0; i < o.count; i++) { const r = REC(h, M.subarray(i * 16, i * 16 + 16), C ? [C[i * 3], C[i * 3 + 1], C[i * 3 + 2]] : [1, 1, 1], A[i]); out.push(r); if (vis) shown.push(r); } });
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
  ok(S.castMinH === 0.5 && bad === 0 && cast > 0, '4 no rock or debris under castMinH (0.5 m) casts, in either path', cast + ' casters'); }
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

console.log('GATE COVER: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
