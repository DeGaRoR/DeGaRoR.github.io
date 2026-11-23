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
//   (7-9: the count truncation, the grass field, the forest edge's band; 10: the world editor's vegetation knobs - below)
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
  ok(S.castMinH === 0.35 && bad === 0 && cast > 0, '4 no rock or debris under castMinH (0.35 m: the user world look, 2026-10-03; 0.5 since G585) casts, in either path', cast + ' casters');
  // (DEBRIS-SHADOW, the user 26 Oct: "keep the 131 debris, no shadows on small ones") no debris model under castMinDebris casts
  let badD = 0; for (const W of [A, Bt]) W.CR.root.traverse(o => { if (!(o.isInstancedMesh || o.isBatchedMesh) || !o.castShadow || !/debris/.test(o.userData.coverKind)) return;
    for (const g of (o.isBatchedMesh ? [...o.userData.geoIds.keys()] : [o.geometry])) if (heightOf(g) < S.castMinDebris) badD++; });
  ok(S.castMinDebris === 1.0 && badD === 0, '4 no debris under castMinDebris (1.0 m, DEBRIS-SHADOW: the user\'s "no shadows on small ones") casts, in either path', badD + ' small debris casting'); }
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
const fadeCheck = (W, set, sizeK, href, smax) => {   // (smax: the size fade's ceiling, the set's own - G2567 made it a dial)   // -> { meshes, cut (instances left out), bad (left out but would draw) }
  const L = W.ctx.TREE_LEAF, [near, reach, taper, agl] = L.fade(undefined, undefined, undefined, undefined, set), band = L.grow(null, null, null)[1], e = W.camera.position;
  let meshes = 0, cut = 0, bad = 0;
  W.CR.root.traverse(o => { if (!o.isInstancedMesh || o.userData.coverKind !== 'cover' || !o.userData.bins) return;
    let vis = true; for (let p = o.parent; p; p = p.parent) if (!p.visible) vis = false; if (!vis) return;
    meshes++; const M = o.instanceMatrix.array, A = o.geometry.getAttribute('aRand').array;
    for (let i = o.visible ? o.count : 0; i < o.userData.n; i++) { cut++;
      let d = Math.hypot(M[i * 16 + 12] - e.x, M[i * 16 + 13] - e.y, M[i * 16 + 14] - e.z);
      if (sizeK > 0) d /= 1 + (Math.min(smax || 1.5, Math.max(0.05, Math.hypot(M[i * 16 + 4], M[i * 16 + 5], M[i * 16 + 6]) / href)) - 1) * sizeK;
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
function fieldRing(opts) {   // (opts: { codeAt, mixAt } - a world of the caller's; GATE COVER 8g)
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
  const BIO = { mixAt: (opts && opts.mixAt) || (() => 'grassland'), mixOf: () => mix };
  const world = { terrainH: () => 0, waterH: () => -10, island: null };
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.5, 5000); camera.position.set(0, 2, 0); camera.lookAt(40, 0, 10); camera.updateMatrixWorld();
  const scene = new THREE.Scene();
  B.load(path.join('src', 'viewer', 'cover_ring.js'));
  const GM = [0.05, 0.06, 0.02];
  const coverAt = (x, z) => (x > 20 && x < 44 && z > -20 && z < 20) ? { kill: 0, boost: 0, kind: null, cls: 'concrete', cut: 1, surf: 0 } : null;
  const CR = ctx.COVER_RING.make(THREE, { scene, world, camera, treeBuild, treeList, LEAF: ctx.TREE_LEAF, BIO, GF: null, layer: 'grass',
    biomeAt: () => 'grassland', codeAt: (opts && opts.codeAt) || (() => 2), okAt: () => true, coverAt, groundMeanAt: () => GM.slice() });
  CR.set({ on: true, budgetMs: 1e9, blockBudget: 1e9, grow: 0, tufts: 12, reach: 60, near: 10, blotch: 0, minAlb: 0 });   // (8c the plain colour law; 8h the darkest tuft's floor)   // (the field ships off: FIELD_ON)
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
    const nV = Fd.CR.get().variants;   // (the tuft shapes a draw: a dial, 2 since G2567)
    ok(nT === nV && tuftsOk === nV, '8a the reed is cut into ' + nV + ' tufts of 3 of its own cards, each card unbent, the tuft moved whole to its foot', tuftsOk + ' of ' + nT + ' tufts');
    // (b) the length: the cut box's at the cut length, the meadow's about the type's median
    const hOf = (m, i) => Math.hypot(m.instanceMatrix.array[i * 16 + 4], m.instanceMatrix.array[i * 16 + 5], m.instanceMatrix.array[i * 16 + 6]) * 100;
    const S = Fd.CR.get(), cutH = [], wildH = [], cols = [];
    for (const m of meshes) for (let i = 0; i < m.userData.n; i++) { const x = m.instanceMatrix.array[i * 16 + 12], z = m.instanceMatrix.array[i * 16 + 14];
      // (the meadow's median read under the eye, where the cells hold the whole stream: a far cell keeps the TALL tufts first - the size fade)
      ((x > 21 && x < 43 && z > -19 && z < 19) ? cutH : (Math.hypot(x, z) < 5) ? wildH : []).push(hOf(m, i));
      cols.push([m.instanceColor.array[i * 3], m.instanceColor.array[i * 3 + 1], m.instanceColor.array[i * 3 + 2]]); }
    const med = a => a.slice().sort((p, q) => p - q)[a.length >> 1];
    const Hc = Math.max(S.minH || 0, S.cutH);   // (16 Nov eve, the user: "no grass should be smaller than 30 cm" - the mown height is floored at minH)
    ok(cutH.length > 20 && cutH.every(h => h > Hc * Math.exp(-2.6 * S.cutSigma) && h < Hc * Math.exp(2.6 * S.cutSigma)) && Math.abs(med(wildH) / 0.30 - 1) < 0.15,
       '8b cut where the premises say (' + Hc + ' m: cutH ' + S.cutH + ' floored at minH ' + S.minH + ', uniform), the meadow about its 0.30 m', cutH.length + ' cut, median ' + (cutH.length ? med(cutH).toFixed(3) : '-') + '; ' + wildH.length + ' wild, median ' + (wildH.length ? med(wildH).toFixed(3) : '-'));
    // (c) the colour: the ground's over the tinted texel (no texel mean in node: 0.4), within the tuft-to-tuft swing
    ok(cols.length > 0 && cols.every(c => [0, 1, 2].every(k => Math.abs(c[k] / (Fd.GM[k] / 0.4 * S.match) - 1) <= S.vary + 1e-6)), '8c each tuft wears the ground\'s drawn colour (x match over the tinted texel)', cols.length + ' tufts');
    // (h) THE DARKEST TUFT (17 Nov, the user: the dead grass "almost black"): with the floor at 0.1, every tuft's albedo (x the texel mean
    // 0.4) is lifted above the ground's own (0.0545 x match here) and stays at or under the floor
    { const lum = c => 0.4 * (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]), raw = cols.map(lum);
      Fd.CR.set({ minAlb: 0.1 }); for (let i = 0; i < 4; i++) Fd.CR.update();
      const L = []; Fd.CR.root.traverse(o => { if (o.isInstancedMesh && o.userData.coverKind === 'cover') for (let i = 0; i < (o.userData.n === undefined ? o.count : o.userData.n); i++) L.push(lum([o.instanceColor.array[i * 3], o.instanceColor.array[i * 3 + 1], o.instanceColor.array[i * 3 + 2]])); });
      const rMax = raw.length ? Math.max(...raw) : NaN, lMin = L.length ? Math.min(...L) : NaN, lMax = L.length ? Math.max(...L) : NaN;
      ok(L.length > 0 && lMin > rMax * 1.1 && lMax <= 0.1 + 1e-6, '8h the darkest tuft: a tuft coloured by dark ground is lifted toward the floor and never past it',
         'ground at most ' + rMax.toFixed(4) + ' -> ' + lMin.toFixed(4) + '..' + lMax.toFixed(4) + ' (floor 0.1), ' + L.length + ' tufts');
      Fd.CR.set({ minAlb: 0 }); for (let i = 0; i < 4; i++) Fd.CR.update(); }
    // (d) the tiers: from 60 m up the cells hold a prefix; down at 2 m they are planted again and only ADD
    const keyOf = (m, i) => m.instanceMatrix.array[i * 16 + 12].toFixed(4) + ',' + m.instanceMatrix.array[i * 16 + 14].toFixed(4);
    const posSet = () => { const s = new Set(); Fd.CR.root.traverse(o => { if (o.isInstancedMesh) for (let i = 0; i < o.userData.n; i++) s.add(keyOf(o, i)); }); return s; };
    // the tufts that DRAW from this eye (the field's fade and size fade, every instance planted - the truncation aside)
    const fs0 = Fd.CR.fadeSet(), LF = Fd.ctx.TREE_LEAF;
    const drawnSet = () => { const [near, reach, taper, agl] = LF.fade(undefined, undefined, undefined, undefined, fs0), [sk, href, smax] = LF.fadeSize(null, null, fs0), band = LF.grow(null, null, null)[1], e = Fd.camera.position, s = new Set();
      Fd.CR.root.traverse(o => { if (!o.isInstancedMesh) return; const M = o.instanceMatrix.array, A = o.geometry.getAttribute('aRand').array;
        for (let i = 0; i < o.userData.n; i++) { let d = Math.hypot(M[i * 16 + 12] - e.x, M[i * 16 + 13] - e.y, M[i * 16 + 14] - e.z);
          d /= 1 + (Math.min(smax, Math.max(0.05, Math.hypot(M[i * 16 + 4], M[i * 16 + 5], M[i * 16 + 6]) / href)) - 1) * sk;
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
    const Fx = fs ? fadeCheck(Fd, fs, L.fadeSize(null, null, fs)[0], L.fadeSize(null, null, fs)[1], L.fadeSize(null, null, fs)[2]) : { meshes: 0, cut: 0, bad: 1 };
    ok(Fx.meshes > 0 && Fx.bad === 0, '8e the field\'s truncation leaves out only tufts its own fade (and size fade) collapses', Fx.cut + ' left out, ' + Fx.bad + ' that would draw');
    // (f) THE ROOT GRADIENT (G2571; VEG-ROOT 9 Nov: ON by default, every small plant): the reed's compiled program reads the ring's own
    // uRoot - the cover's row (0.6, MID) by default, live A -> B -> A (0.6 -> 0.5 -> 0.6) - and every other faded material of the first ring
    // carries a uRoot of its own: rocks, debris and bushes the identity (no shade on bushes), a grass or flower its level's row (never the reed's object),
    // so a cache-hit program never keeps another material's state (the cached-program uniforms trap); the law after the map's tint
    { const reed = meshes[0] && meshes[0].material, rnd = () => { Fd.CR.update(); Fd.R.render(Fd.scene, Fd.camera); }, uR = () => { const p = Fd.R.properties.get(reed); return p && p.uniforms && p.uniforms.uRoot; };
      rnd(); const a0 = uR(), x0 = a0 ? a0.value.x : NaN;
      Fd.CR.set({ root: 0.5 }); rnd(); const x1 = uR() ? uR().value.x : NaN;
      Fd.CR.set({ root: 0.6 }); rnd(); const x2 = uR() ? uR().value.x : NaN;
      // (12 Nov: the key's weight is the TINTED mean's r/g - the reed's real texel mean, r/g 1.72, tinted to sat 0.24: ~1.09, never the raw 1.72)
      const tm0 = reed && reed.userData.texMean; if (reed) reed.userData.texMean = [0.15, 0.087, 0.029]; rnd(); const kw = uR() ? uR().value.w : NaN;
      if (reed) { if (tm0) reed.userData.texMean = tm0; else delete reed.userData.texMean; } rnd();
      const kwOk = kw > 0.9 && kw < 1.3 && Math.abs(kw - 0.15 / 0.087) > 0.3;
      let others = 0, othersOk = 0; Bt.R.render(Bt.scene, Bt.camera);
      Bt.CR.root.traverse(o => { if (!(o.isInstancedMesh || o.isBatchedMesh) || !o.material || !o.material.userData.fade || o.userData.coverKind === 'cover') return;
        const p = Bt.R.properties.get(o.material); others++; const k = o.userData.coverKind, u = p && p.uniforms && p.uniforms.uRoot;
        if (u && u !== a0 && ((k === 'rock' || k === 'debris') ? u.value.x === 0 : k === 'shrub' ? Math.abs(u.value.x - 0.6) < 1e-6 : true)) othersOk++; });   // (17 Nov: the bushes MID)
      const fsOk = Fd.B.links.some(l => l.fs && l.fs.indexOf('diffuseColor.rgb *= min(vRoot, 1.0);') >= 0 && l.vs && l.vs.indexOf('vRoot = 1.0 - uRoot.x + uRoot.x * position.y') >= 0 && l.vs.indexOf('if (uRoot.w > 0.0) { float _rk = smoothstep(') > l.vs.indexOf('vRoot = 1.0 - uRoot.x + uRoot.x * position.y'));   // (12 Nov: the key AFTER the law, or the law overwrites it)
      ok(a0 && Math.abs(x0 - 0.6) < 1e-6 && x1 === 0.5 && Math.abs(x2 - 0.6) < 1e-6 && others > 0 && othersOk === others && fsOk && kwOk,
         '8f the root gradient: the reed reads the field\'s uRoot (0.6 -> 0.5 -> 0.6 live), every other faded material its own (rocks identity; the bushes MID since the 17 Nov review), the vertex law in the program with the field keyed by colour',
         'x ' + [x0, x1, x2].join(' -> ') + ', ' + othersOk + ' of ' + others + ' others right, key weight ' + (+kw).toFixed(3)); }
  }
}

// 8g THE LAKE'S EDGE (G2572; the user: "the lakes seem to clear the grass within a few metres"): dry land the island's 10 m grid calls
// LAKE (1) - its bank - takes the nearest land code round it and grows the field's grass; the sea (0) keeps nothing
{ let L = null, S0 = null;
  try { L = fieldRing({ codeAt: x => (x > 30 && x < 34 ? 1 : 2), mixAt: cd => (cd >= 2 ? 'grassland' : null) });
        S0 = fieldRing({ codeAt: x => (x > 30 && x < 34 ? 0 : 2), mixAt: cd => (cd >= 2 ? 'grassland' : null) }); } catch (e) { ok(false, '8g the field plants by a lake', (e && e.message || String(e)).slice(0, 200)); }
  if (L && S0) {
    const inBand = W => { let n = 0; W.CR.root.traverse(o => { if (!o.isInstancedMesh) return; const M = o.instanceMatrix.array; for (let i = 0; i < o.userData.n; i++) { const x = M[i * 16 + 12]; if (x > 30.5 && x < 33.5) n++; } }); return n; };
    const nl = inBand(L), ns = inBand(S0);
    ok(nl > 0 && ns === 0, '8g a lake-coded bank grows grass (the nearest land code), a sea-coded band none', nl + ' tufts on the lake band, ' + ns + ' on the sea band'); } }

// 9 FOREST-EDGE's BAND (the user 16 Nov; the spec of 25 Oct): on the open side of a forest edge the ring plants the edge's bushes
// from 1 m in to 3 m out and its weeds from 3 to 6 m out, on their own hashes (every other species' instances the same as with
// the band off), and nothing of it with BIOMES.edgeOn false. A straight edge at x = 60 (the forest east of it)
function edgeRing(on) {
  const B = boot(), { THREE, ctx } = B;
  B.load(path.join('src', 'viewer', 'trees.js'));
  const t = new THREE.Texture(); t.image = { width: 4, height: 4 };
  const cols = [{ name: 'raspberry', kind: 'shrub', place: { hMin: 0.6, hMax: 1.4 } }, { name: 'flower_fireweed', kind: 'cover', place: { size: 1.2 } },
    { name: 'tuft', kind: 'cover', place: { density: 0.3, size: 0.3 } }];
  const H = { raspberry: 1, flower_fireweed: 1.2, tuft: 0.4 }, built = new Map();
  const treeList = () => cols.map(c => ({ key: c.name + '_m', col: c, sub: { bb: [-0.5, 0, -0.5, 0.5, H[c.name], 0.5], h: H[c.name] } }));
  const treeBuild = (T, key) => { if (built.has(key)) return built.get(key); const n = key.replace(/_m$/, ''), g = new THREE.BoxGeometry(1, H[n], 1); g.translate(0, H[n] / 2, 0);
    const b = { parts: [{ geo: g, mat: new THREE.MeshStandardMaterial({ map: t }) }] }; built.set(key, b); return b; };
  ctx.TREE_PACK = { collections: cols };
  const K = { edgeShrubIn: 0.5, edgeShrubOut: 3, edgeWeedOut: 6, edgeShrubDens: 0.2, edgeWeedDens: 0.25 };   // the outward trees' reach R = 10 m here
  const mix = { species: { tuft: { density: 0.3 } }, forest: { cover: 1, reach: 220 } };
  const BIO = { mixAt: () => 'mix', mixOf: () => mix, knobs: () => K, edgeOn: on, edgeReachAt: () => 10, edgeReachMax: () => 15 };
  const world = { terrainH: () => 0, waterH: () => -10, island: null };
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.5, 5000); camera.position.set(40, 3, 0); camera.lookAt(80, 0, 0); camera.updateMatrixWorld();
  B.load(path.join('src', 'viewer', 'cover_ring.js'));
  const CR = ctx.COVER_RING.make(THREE, { scene: new THREE.Scene(), world, camera, treeBuild, treeList, LEAF: ctx.TREE_LEAF, BIO, GF: null,
    biomeAt: () => 'mix', codeAt: () => 1, okAt: () => true, edgeD: (x, z) => x - 60 });
  CR.set({ batch: false, budgetMs: 1e9, blockBudget: 1e9, grow: 0 });
  for (let i = 0; i < 4; i++) CR.update();
  const xs = { shrub: [], cover: [] };
  CR.root.traverse(o => { if (!o.isInstancedMesh) return; const M = o.instanceMatrix.array, k = o.userData.coverKind, h = (o.geometry.boundingBox || (o.geometry.computeBoundingBox(), o.geometry.boundingBox)).max.y;
    for (let i = 0, n = o.userData.n === undefined ? o.count : o.userData.n; i < n; i++) (xs[k] || (xs[k] = [])).push([M[i * 16 + 12], h]); });
  return xs;
}
{ let on = null, off = null;
  try { on = edgeRing(true); off = edgeRing(false); } catch (e) { ok(false, '9 the edge band plants', (e && e.message || String(e)).slice(0, 200)); }
  if (on && off) {
    const sh = on.shrub || [], weeds = (on.cover || []).filter(([x, h]) => h > 1), tuftsOn = (on.cover || []).filter(([x, h]) => h < 1).length, tuftsOff = (off.cover || []).filter(([x, h]) => h < 1).length;
    const shOk = sh.length > 20 && sh.every(([x]) => x >= 47 - 1e-6 && x <= 55 + 1e-6), wdOk = weeds.length > 20 && weeds.every(([x]) => x >= 44 - 1e-6 && x <= 47 + 1e-6);   // the edge at x 60, R 10: bushes 5-13 m out, weeds 13-16
    ok(shOk && wdOk && !(off.shrub || []).length && !(off.cover || []).some(([x, h]) => h > 1) && tuftsOn === tuftsOff,
       '9 FOREST-EDGE: past the outward trees (R 10 m) the bushes stand from 5 to 13 m out, the weeds from 13 to 16 m out, nothing with the band off, the cell\'s other species untouched',
       sh.length + ' bushes in x ' + (sh.length ? Math.min(...sh.map(e => e[0])).toFixed(1) + '..' + Math.max(...sh.map(e => e[0])).toFixed(1) : '-') + ', ' + weeds.length + ' weeds in x ' +
       (weeds.length ? Math.min(...weeds.map(e => e[0])).toFixed(1) + '..' + Math.max(...weeds.map(e => e[0])).toFixed(1) : '-') + '; tufts ' + tuftsOn + ' / ' + tuftsOff + ' off'); } }

// 10 THE WORLD EDITOR'S VEGETATION KNOBS (WORLD-RAIL-VEG 16 Nov, the user: every new world setting editable in the world editor):
//   a. BIOMES.setKnobs lays the editor's knobs over the shipped (and drops them back), the dials ride it, tuned() is what the look saves;
//   b. the planters read the ground's LIVE knobs (BIOMES.ground: the splat the editor's split sliders move) under the editor's own;
//   c. the edge's distance field re-lays its cells when the editor moves the cell / tile / margin, and only then;
//   d. the cover ring's reshape re-builds a shaped species' cards from its pack row (the alpine shrubs' rows), and nothing else's
{
  const BIOMES = require(path.join(__dirname, '..', 'src', 'core', '28c_biomes.js'));
  const B = BIOMES.make({ biomes: { map: { 2: 'heath', 19: 'subalpine' }, mixes: { heath: { species: {} }, subalpine: { species: {} } } } });
  const K0 = B.knobs();
  const t1 = B.setKnobs({ subH0: 300, edgeMin: 0.8, subOn: false });
  const aOk = B.knobs().subH0 === 300 && B.knobs().edgeMin === 0.8 && B.subOn === false && t1.subH0 === 300 && t1.subOn === false && t1.edgeOn === true && !('subOn' in B.user);
  B.setKnobs({ subH0: null, subOn: true }); const aBack = B.knobs().subH0 === K0.subH0 && B.knobs().edgeMin === 0.8 && B.subOn === true;
  B.setKnobs(null); const aNull = B.knobs().edgeMin === K0.edgeMin && !Object.keys(B.user).length;
  ok(aOk && aBack && aNull, '10a the biomes\' knobs: the editor\'s over the shipped, back by null, the dials apart', 'subH0 ' + K0.subH0 + ' -> 300 -> ' + B.knobs().subH0 + ', edgeMin ' + B.knobs().edgeMin);
  // b: rock at 25 degrees is cliff only when the split starts under 25
  const r0 = B.codeOf(6, 25, 0, 0.5); B.ground = () => ({ cliffLo: 10, cliffHi: 20 }); const r1 = B.codeOf(6, 25, 0, 0.5);
  B.setKnobs({ cliffLo: 30, cliffHi: 40 }); const r2 = B.codeOf(6, 25, 0, 0.5); B.setKnobs(null); B.ground = null;
  ok(r0 === 6 && r1 === 12 && r2 === 6, '10b the split: the ground\'s live knobs reach the planters, the editor\'s own over them', 'shipped ' + r0 + ', live split ' + r1 + ', editor ' + r2);
  // c
  let calls = 0; const at = B.edgeField((x, z) => { calls++; return x > 60; });
  const d6 = at(70, 0), n6 = calls; calls = 0; at(80, 0); const nSame = calls;
  B.setKnobs({ subH0: 500 }); calls = 0; at(70, 0); const nSub = calls; B.setKnobs({ subH0: null });
  B.setKnobs({ edgeCell: 2 }); calls = 0; const d2 = at(70, 0), n2 = calls; B.setKnobs(null);
  const want = c => { const M = Math.ceil(K0.edgeMargin / c), n = Math.round(K0.edgeTile / c) + 2 * M; return n * n; };
  ok(n6 === want(6) && nSame === 0 && nSub === 0 && n2 === want(2) && Math.abs(d6 - 10) < 3.1 && Math.abs(d2 - 10) < 1.1,
     '10c the edge field re-lays on a cell / tile / margin move, and only then', 'cell 6: ' + n6 + ' reads, d ' + d6.toFixed(2) + '; another knob ' + nSub + ' reads; cell 2: ' + n2 + ' reads, d ' + d2.toFixed(2));
}
{ let res = null;
  try {
    const Bt = boot(), { THREE, ctx } = Bt;
    // a picture species needs an <img> (three's TextureLoader): a stand-in that never loads
    ctx.document = { createElementNS: () => ({ style: {}, addEventListener() {}, removeEventListener() {}, setAttribute() {} }) };
    Bt.load(path.join('src', 'viewer', 'trees.js'));
    const cols = [{ name: 'alp', kind: 'cover', maps: ['alp.png'], place: { shape: 'carpet', size: 1, density: 0.5 }, tint: { alpha: 0.3 } },
      { name: 'tuft', kind: 'cover', place: { density: 0.3, size: 0.3 } }];
    const built = new Map();
    const treeList = () => [{ key: 'tuft_m', col: cols[1], sub: { bb: [-0.5, 0, -0.5, 0.5, 0.4, 0.5], h: 0.4 } }];
    const treeBuild = (T, key) => { if (built.has(key)) return built.get(key); const g = new THREE.BoxGeometry(1, 0.4, 1); g.translate(0, 0.2, 0);
      const b = { parts: [{ geo: g, mat: new THREE.MeshStandardMaterial() }] }; built.set(key, b); return b; };
    ctx.TREE_PACK = { collections: cols };
    const mix = { species: { alp: { density: 0.5 }, tuft: { density: 0.3 } }, forest: { cover: 1, reach: 220 } };
    const BIO = { mixAt: () => 'mix', mixOf: () => mix };
    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.5, 5000); camera.position.set(0, 3, 0); camera.lookAt(60, 0, 0); camera.updateMatrixWorld();
    Bt.load(path.join('src', 'viewer', 'cover_ring.js'));
    const CR = ctx.COVER_RING.make(THREE, { scene: new THREE.Scene(), world: { terrainH: () => 0, waterH: () => -10, island: null }, camera, treeBuild, treeList, LEAF: ctx.TREE_LEAF, BIO, GF: null,
      biomeAt: () => 'mix', codeAt: () => 1, okAt: () => true });
    CR.set({ batch: false, budgetMs: 1e9, blockBudget: 1e9, grow: 0 });
    const grow = () => { for (let i = 0; i < 4; i++) CR.update(); };
    // the shaped species' meshes are the ones on its picture (a texture map); the tufts' have none
    const census = () => { const o = { geos: new Set(), alp: 0, tuft: 0, cut: null, top: 0 };
      CR.root.traverse(m => { if (!m.isInstancedMesh) return; const n = m.userData.n === undefined ? m.count : m.userData.n; if (!n) return;
        if (!m.material.map) { o.tuft += n; return; }
        o.alp += n; o.geos.add(m.geometry.attributes.position); o.cut = m.material.alphaTest;
        const P = m.geometry.attributes.position; let top = 0; for (let i = 0; i < P.count; i++) top = Math.max(top, P.getY(i)); o.top = top; });
      return o; };
    grow(); const a = census();
    cols[0].tint.alpha = 0.12; cols[0].place.tilt = 30; const r = CR.reshape('alp'); grow(); const b = census();
    res = { a, b, r, shapes: CR.shapes(), none: CR.reshape('nope') };
  } catch (e) { ok(false, '10d the shaped cards re-build', (e && e.message || String(e)).slice(0, 200)); }
  if (res) {
    const { a, b } = res, aG = [...a.geos], bG = [...b.geos];
    ok(res.r && !res.none && res.shapes.join() === 'alp' && a.alp > 0 && b.alp === a.alp && a.tuft === b.tuft && a.cut === 0.3 && b.cut === 0.12 && !bG.some(g => aG.includes(g)) && Math.abs(a.top - b.top) > 1e-3,
       '10d the cover ring\'s reshape: a shaped species\' cards re-built from its row (cut, tilt), the same instances, every other species as it was',
       a.alp + ' -> ' + b.alp + ' cards, cut ' + a.cut + ' -> ' + b.cut + ', top ' + a.top.toFixed(3) + ' -> ' + b.top.toFixed(3) + ', tufts ' + a.tuft + ' / ' + b.tuft + ', shapes [' + res.shapes.join() + ']'); } }


// 11 THE ALPINE GROUND (MOUNTAIN-VEG, the user 16 Nov: the mountain tops are "patches of bushes, weeds, moss carpets, and a lot rocks
// ... identify where it would be likely to have quite a few rocks dispersed"): a rock row's `exposed` keeps its rocks where the soil is
// likely bare - on a ridge (x < 60 here: the ground convex) - and drops most of them on the flat (x > 60); exposed 0 keeps both alike
function rockRing(exposed) {
  const B = boot(), { THREE, ctx } = B;
  B.load(path.join('src', 'viewer', 'trees.js'));
  const t = new THREE.Texture(); t.image = { width: 4, height: 4 };
  const cols = [{ name: 'rocks', kind: 'rock', place: {} }];
  const built = new Map();
  const treeList = () => cols.map(c => ({ key: c.name + '_m', col: c, sub: { bb: [-0.5, 0, -0.5, 0.5, 0.6, 0.5], h: 0.6 } }));
  const treeBuild = (T, key) => { if (built.has(key)) return built.get(key); const g = new THREE.BoxGeometry(1, 0.6, 1); g.translate(0, 0.3, 0);
    const b = { parts: [{ geo: g, mat: new THREE.MeshStandardMaterial({ map: t }) }] }; built.set(key, b); return b; };
  ctx.TREE_PACK = { collections: cols };
  const mix = { species: { rocks: { proportion: 1, exposed } }, forest: { cover: 1, reach: 220, rocks: 60 } };
  const BIO = { mixAt: () => 'mix', mixOf: () => mix, knobs: () => ({}), edgeOn: false };
  // x < 60: a ridge running along z (a parabola across x, period 24 m: convex on its crests), x > 60: flat
  const ridge = (x, z) => x < 60 ? -0.06 * Math.pow(((x % 24) + 24) % 24 - 12, 2) : 0;
  const world = { terrainH: ridge, waterH: () => -10, island: null };
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.5, 5000); camera.position.set(60, 3, 0); camera.lookAt(60, 0, 40); camera.updateMatrixWorld();
  B.load(path.join('src', 'viewer', 'cover_ring.js'));
  const CR = ctx.COVER_RING.make(THREE, { scene: new THREE.Scene(), world, camera, treeBuild, treeList, LEAF: ctx.TREE_LEAF, BIO, GF: null,
    biomeAt: () => 'mix', codeAt: () => 1, okAt: () => true });
  CR.set({ batch: false, budgetMs: 1e9, blockBudget: 1e9, grow: 0 });
  for (let i = 0; i < 4; i++) CR.update();
  const xs = [];
  CR.root.traverse(o => { if (!o.isInstancedMesh || o.userData.coverKind !== 'rock') return; const M = o.instanceMatrix.array;
    for (let i = 0, n = o.userData.n === undefined ? o.count : o.userData.n; i < n; i++) xs.push(M[i * 16 + 12]); });
  const band = (lo, hi) => xs.filter(x => x >= lo && x < hi).length;
  return { ridge: band(0, 60), flat: band(60, 120) };
}
{ let a = null, b = null;
  try { a = rockRing(0); b = rockRing(0.85); } catch (e) { ok(false, '11 the exposed rocks plant', (e && e.message || String(e)).slice(0, 200)); }
  if (a && b) ok(a.ridge > 20 && a.flat > 20 && Math.abs(a.ridge - a.flat) / a.flat < 0.35 && b.ridge > 0.55 * a.ridge && b.flat < 0.35 * a.flat,
    '11 THE ALPINE GROUND: a rock row\'s exposed keeps its rocks on the ridge and drops most on the flat; exposed 0 keeps both alike',
    'exposed 0: ridge ' + a.ridge + ', flat ' + a.flat + ' | exposed 0.85: ridge ' + b.ridge + ', flat ' + b.flat); }

// 12 THE WATER PLANTS (MOUNTAIN-VEG, the user 17 Nov: "the addition of some water plants could really blend things together"): the
// lakeshore's rows with onWater are planted by the water band ON the lake - in their band out from the drawn line, in their depth, at
// the water's level - and never by the land's loop
function waterRing() {
  const B = boot(), { THREE, ctx } = B;
  ctx.document = { createElementNS: () => ({ style: {}, addEventListener() {}, removeEventListener() {}, setAttribute() {} }) };
  B.load(path.join('src', 'viewer', 'trees.js'));
  const cols = [{ name: 'water_lily', kind: 'cover', maps: ['lily.png'], place: { shape: 'float', size: 2, aspect: 1, vary: 0.06 }, tint: { alpha: 0.4 } },
    { name: 'tuft', kind: 'cover', place: { density: 0.3, size: 0.3 } }];
  const built = new Map();
  const treeList = () => [{ key: 'tuft_m', col: cols[1], sub: { bb: [-0.5, 0, -0.5, 0.5, 0.4, 0.5], h: 0.4 } }];
  const treeBuild = (T, key) => { if (built.has(key)) return built.get(key); const g = new THREE.BoxGeometry(1, 0.4, 1); g.translate(0, 0.2, 0);
    const b = { parts: [{ geo: g, mat: new THREE.MeshStandardMaterial() }] }; built.set(key, b); return b; };
  ctx.TREE_PACK = { collections: cols };
  const shore = { species: { water_lily: { proportion: 1, density: 0.3, patch: 0, onWater: [1, 14], depth: [0.08, 1.8] }, tuft: { density: 0.3 } }, forest: { cover: 1 } };
  const land = { species: { tuft: { density: 0.3 } }, forest: { cover: 1, reach: 220 } };
  const BIO = { SHORE: 18, mixAt: c => (c === 18 ? 'shore' : 'land'), mixOf: m => (m === 'shore' ? shore : land), knobs: () => ({}), edgeOn: false, shoreHere: x => x > 54 && x < 60 };
  // the lake from x 60 (the drawn line), its bed 0.1 m deeper a metre out, the water at 0
  const world = { terrainH: x => (x > 60 ? -(x - 60) * 0.1 : (60 - x) * 0.05), waterH: () => -10, island: null };
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.5, 5000); camera.position.set(50, 3, 0); camera.lookAt(90, 0, 0); camera.updateMatrixWorld();
  B.load(path.join('src', 'viewer', 'cover_ring.js'));
  const CR = ctx.COVER_RING.make(THREE, { scene: new THREE.Scene(), world, camera, treeBuild, treeList, LEAF: ctx.TREE_LEAF, BIO, GF: null,
    biomeAt: () => 'land', codeAt: () => 1, okAt: x => x < 60, lakeSD: x => x - 60, waterY: x => (x > 59 ? 0 : null) });
  CR.set({ batch: false, budgetMs: 1e9, blockBudget: 1e9, grow: 0 });
  for (let i = 0; i < 4; i++) CR.update();
  const lily = [];
  CR.root.traverse(o => { if (!o.isInstancedMesh || o.userData.coverKind !== 'cover' || !(o.material && o.material.map)) return; const M = o.instanceMatrix.array;
    for (let i = 0, n = o.userData.n === undefined ? o.count : o.userData.n; i < n; i++) lily.push([M[i * 16 + 12], M[i * 16 + 13]]); });
  return { lily, stat: CR.stat ? CR.stat() : {} };
}
{ let r = null;
  try { r = waterRing(); } catch (e) { ok(false, '12 the water plants plant', (e && e.message || String(e)).slice(0, 200)); }
  if (r) { const L = r.lily, xs = L.map(p => p[0]), ys = L.map(p => p[1]);
    // depth 0.08-1.8 m on a 0.1 m/m bed: x 60.8-78; the band 1-14 m out: x 61-74
    ok(L.length > 20 && xs.every(x => x >= 61 - 1e-6 && x <= 74 + 1e-6) && ys.every(y => Math.abs(y) < 1e-6),
       '12 THE WATER PLANTS: the lily pads stand on the lake, 1-14 m out from the drawn line within their depth, at the water\'s level - none on the land',
       L.length + ' pads, x ' + (L.length ? Math.min(...xs).toFixed(1) + '..' + Math.max(...xs).toFixed(1) : '-') + ', y ' + (L.length ? Math.min(...ys).toFixed(3) + '..' + Math.max(...ys).toFixed(3) : '-')); } }
// 13 THE ROCKS' OWN RING (MOUNTAIN-VEG, the user 17 Nov: "rock should be visible for a little while ... a bit further"): layer
// 'rocks' plants the rock rows' rocks at least rockSplit m tall (the model's height x its scale) on the cover ring's own cells and
// stream, and the cover ring under that split keeps the rest: together EXACTLY the cover ring's rocks alone - no rock twice, none lost
function splitRings() {
  const B = boot(), { THREE, ctx } = B;
  B.load(path.join('src', 'viewer', 'trees.js'));
  const t = new THREE.Texture(); t.image = { width: 4, height: 4 };
  const cols = [{ name: 'rocks', kind: 'rock', place: {} }, { name: 'sticks', kind: 'debris', place: {} }];
  const built = new Map();
  const treeList = () => cols.map(c => ({ key: c.name + '_m', col: c, sub: { bb: [-0.5, 0, -0.5, 0.5, 0.6, 0.5], h: 0.6 } }));
  const treeBuild = (T, key) => { if (built.has(key)) return built.get(key); const g = new THREE.BoxGeometry(1, 0.6, 1); g.translate(0, 0.3, 0);
    const b = { parts: [{ geo: g, mat: new THREE.MeshStandardMaterial({ map: t }) }] }; built.set(key, b); return b; };
  ctx.TREE_PACK = { collections: cols };
  const mix = { species: { rocks: { proportion: 1 }, sticks: { proportion: 1 } }, forest: { cover: 1, reach: 220, rocks: 30, debris: 10 } };
  const BIO = { mixAt: () => 'mix', mixOf: () => mix, knobs: () => ({}), edgeOn: false };
  const world = { terrainH: () => 0, waterH: () => -10, island: null };
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.5, 5000); camera.position.set(0, 3, 0); camera.lookAt(0, 0, 40); camera.updateMatrixWorld();
  B.load(path.join('src', 'viewer', 'cover_ring.js'));
  const ring = (layer, split) => { const R = ctx.COVER_RING.make(THREE, { scene: new THREE.Scene(), world, camera, treeBuild, treeList, LEAF: ctx.TREE_LEAF, BIO, GF: null, layer,
      biomeAt: () => 'mix', codeAt: () => 1, okAt: () => true });
    R.set({ batch: false, budgetMs: 1e9, blockBudget: 1e9, grow: 0, maxCells: 1e5, rockSplit: split }); for (let i = 0; i < 4; i++) R.update();
    const o = { rock: [], debris: 0, layer: R.layer };
    R.root.traverse(m => { if (!m.isInstancedMesh) return; const M = m.instanceMatrix.array, n = m.userData.n === undefined ? m.count : m.userData.n;
      for (let i = 0; i < n; i++) { const x = M[i * 16 + 12], z = M[i * 16 + 14]; if (Math.abs(x) > 150 || Math.abs(z) > 150) continue;
        if (m.userData.coverKind === 'rock') o.rock.push(x.toFixed(3) + ',' + z.toFixed(3) + ',' + Math.hypot(M[i * 16 + 4], M[i * 16 + 5], M[i * 16 + 6]).toFixed(4)); else o.debris++; } });
    return o; };
  return { all: ring(undefined, 0), small: ring(undefined, 0.6), big: ring('rocks', 0.6) };
}
{ let r = null;
  try { r = splitRings(); } catch (e) { ok(false, '13 the rocks’ own ring plants', (e && e.message || String(e)).slice(0, 200)); }
  if (r) { const A = new Set(r.all.rock), S = new Set(r.small.rock), G = new Set(r.big.rock);
    const both = [...S].filter(k => G.has(k)).length, lost = [...A].filter(k => !S.has(k) && !G.has(k)).length, extra = [...S, ...G].filter(k => !A.has(k)).length;
    const bigOk = r.big.rock.every(k => +k.split(',')[2] * 0.6 >= 0.6 - 1e-3), smallOk = r.small.rock.every(k => +k.split(',')[2] * 0.6 < 0.6 + 1e-3);
    ok(A.size > 100 && S.size > 20 && G.size > 20 && !both && !lost && !extra && bigOk && smallOk && r.big.debris === 0 && r.small.debris > 0 && r.big.layer === 'rocks',
       '13 THE ROCKS’ OWN RING: it plants the rocks at least rockSplit m tall (no debris), the cover ring the smaller ones - together exactly the cover ring’s rocks alone',
       'alone ' + A.size + ' | small ' + S.size + ' + big ' + G.size + ', twice ' + both + ', lost ' + lost + ', extra ' + extra + ', debris ' + r.small.debris + ' / ' + r.big.debris); } }
// 14 THE ALPINE ROCKS (MOUNTAIN-VEG, the user 22 Nov: "a lot more rocks in the alpine section ... rocks are a bit like trees" and "not to
// land very easily on mountain tops"): a mix's forest.rockUp [h0, h1, k] multiplies its rocks above the band (and fades the exposed rule);
// the rocks' own ring registers each landed cell's big rocks as ONE trunk-law hit set (world.treeHits) and drops it with the cell;
// ?alprocks=0 = neither; the runs ask ?alprocks=1 / =0 outright, so the check holds whichever default a branch ships (the lab: off)
function alpRing(height, off) {
  const B = boot(), { THREE, ctx } = B;
  ctx.location = { search: off ? '?alprocks=0' : '?alprocks=1' };   // (MOUNTAIN-VEG 23 Nov: the lab's default is OFF unless ?alprocks=1 - the 'on' runs ask for it, as a player of the lab would)
  B.load(path.join('src', 'viewer', 'trees.js')); B.load(path.join('src', 'core', '29_obstacles.js'));
  const t = new THREE.Texture(); t.image = { width: 4, height: 4 };
  const cols = [{ name: 'rocks', kind: 'rock', place: {} }];
  const built = new Map();
  const treeList = () => cols.map(c => ({ key: c.name + '_m', col: c, sub: { bb: [-0.5, 0, -0.5, 0.5, 1.2, 0.5], h: 1.2 } }));
  const treeBuild = (T, key) => { if (built.has(key)) return built.get(key); const g = new THREE.BoxGeometry(1, 1.2, 1); g.translate(0, 0.6, 0);
    const b = { parts: [{ geo: g, mat: new THREE.MeshStandardMaterial({ map: t }) }] }; built.set(key, b); return b; };
  ctx.TREE_PACK = { collections: cols };
  const mix = { species: { rocks: { proportion: 1, exposed: 0.85 } }, forest: { cover: 1, reach: 220, rocks: 20, rockUp: [700, 950, 1.5] } };
  const BIO = { mixAt: () => 'mix', mixOf: () => mix, knobs: () => ({}), edgeOn: false };
  const TH = require('vm').runInContext('TREE_HITS.make()', ctx);   // (a top-level const: visible to the context's scripts, not as ctx's own property)
  const world = { terrainH: () => height, waterH: () => -10, island: null, treeHits: TH };
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.5, 5000); camera.position.set(0, height + 3, 0); camera.lookAt(0, height, 40); camera.updateMatrixWorld();
  B.load(path.join('src', 'viewer', 'cover_ring.js'));
  const R = ctx.COVER_RING.make(THREE, { scene: new THREE.Scene(), world, camera, treeBuild, treeList, LEAF: ctx.TREE_LEAF, BIO, GF: null, layer: 'rocks',
    biomeAt: () => 'mix', codeAt: () => 1, okAt: () => true });
  R.set({ batch: false, budgetMs: 1e9, blockBudget: 1e9, grow: 0, maxCells: 1e5, rockSplit: 0.1, reach: 120 }); for (let i = 0; i < 4; i++) R.update();
  let n = 0; R.root.traverse(m => { if (m.isInstancedMesh && m.userData.coverKind === 'rock') n += m.userData.n === undefined ? m.count : m.userData.n; });
  const sets = TH.keys().filter(k => /^alprocks:/.test(k)).length, cyl = TH.count, alp = R.alp;
  R.replant(); const after = TH.keys().filter(k => /^alprocks:/.test(k)).length;
  return { n, sets, cyl, after, alp };
}
{ let lo = null, hi = null, off = null;
  try { lo = alpRing(0); hi = alpRing(1000); off = alpRing(1000, true); } catch (e) { ok(false, '14 the alpine rocks plant', (e && e.message || String(e)).slice(0, 200)); }
  if (lo && hi && off) ok(hi.n > 2.5 * lo.n && off.n < 1.2 * lo.n && hi.sets > 0 && hi.cyl > hi.n * 0.5 && hi.after === 0 && off.sets === 0 && hi.alp === true && off.alp === false,
    '14 THE ALPINE ROCKS: above the band the rocks multiply (and the flat keeps more), each landed cell’s big rocks are ONE hit set dropped with the cell; ?alprocks=0 neither',
    'rocks low ' + lo.n + ' / high ' + hi.n + ' / high off ' + off.n + '; hit sets ' + hi.sets + ' (' + hi.cyl + ' cylinders), after replant ' + hi.after + ', off ' + off.sets); }
console.log('GATE COVER: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
