#!/usr/bin/env node
// _lawn_check.js - GATE LAWN (GRASS-CARDS, 16 Nov 2026): ALL MOWN GRASS AS GRASS CARDS. The user: "when the grass is really small,
// they look just like little dots ... I think that we should use grass cards ... there are some in the bench. We have just never used
// them ... all mown grass needs to be addressed through grass cards". cover_ring.js layer 'lawn' plants the bench's grass_plates
// (realtime_grass.glb) on the premises' cut ground alone; the grass field (layer 'grass') leaves that ground to it while it is on.
// On the real rings and the real fade hook, over a fake WebGL2 (_fake_gl.js), a flat world of the gate's own: a 20 m strip of
// cut ground (x 0..20; its soft edge x 20..24), a 3 m kill (the runway, x -3..0), wild meadow beyond (x > 24):
//   1. the lawn plants grass_plates and nothing else, only where the ground is cut: none on the wild meadow, none on the kill
//   2. its count follows dens x cut (the fully mown strip within 10 % of dens x area; the soft edge thinner)
//   3. its length: cutH on the lawn, tallH on a `tall` cut, stripH on a grass strip's surface (surf) - the mean card scale x the
//      plate's top; no floor (the field's minH is the reed's alone)
//   4. the field with the lawn on: no reed tuft on the fully cut ground; the wild meadow's tufts the same, point for point, as
//      with the lawn off (the wild grass is untouched)
//   5. the field with the lawn off: the cut ground keeps its tufts (today's)
//   6. the tiers nest: a cell planted for a far eye is a subset of the same cell planted near (every card kept far is kept near)
//   7. the instrument lawnAt(x, z): cards / m2 and the length at a point, 0 on the wild and on the kill
//   8. off: nothing planted (the GRAPHICS row's `off`)
//   0. the shipped default: on, D (10 cm, 300 / m2 to 20 m), the tall band 40 cm
//   10. the ladder: the GRAPHICS row 'mown grass' (free, auto: D / B / phone by preset) and its rungs
//   9. never in drawn water: a pond across the mown strip plants no card in it (A0 17 Nov, LOOKS 5)
//   node tools/_lawn_check.js   -> "GATE LAWN: PASS|FAIL"
'use strict';
const path = require('path');
const { boot } = require('./_fake_gl.js');
let fails = 0;
const ok = (c, m, x) => { console.log((c ? '  ok   ' : '  FAIL ') + m + (x !== undefined ? '  (' + x + ')' : '')); if (!c) fails++; };
console.log('GATE LAWN');

const GRASS = [0.119, 0.1528, 0.0305];
// the ground: cut 1 on x 0..20, falling to 0 over 20..24; the kill on -3..0; `tall` / `surf` by the caller's flags
const coverOf = o => (x, z) => {
  if (x > -3 && x < 0) return { kill: 1, cut: 0 };
  if (x >= 0 && x <= 24) { const cut = x <= 20 ? 1 : Math.max(0, (24 - x) / 4); return { kill: 0, cut, tall: o.tall ? 1 : 0, surf: o.surf ? 1 : 0 }; }
  return null;
};
function rings(o) {
  const B = boot(), { THREE, ctx } = B;
  B.load(path.join('src', 'viewer', 'trees.js'));
  const t = new THREE.Texture(); t.image = { width: 4, height: 4 };
  const quad = (w, h) => { const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -w, 0, 0, w, 0, h, w, 0, h, -w], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals(); g.setAttribute('aoV', new THREE.Float32BufferAttribute([1, 1, 1, 1], 1)); return g; };
  const reedG = new THREE.BufferGeometry(), pos = [], uv = [], idx = [];
  for (let c = 0; c < 12; c++) { const a = c / 12 * 2 * Math.PI, x = Math.cos(a) * 60, z = Math.sin(a) * 60, b = pos.length / 3, w = 8 + c;
    pos.push(x - w, 0, z, x + w, 0, z, x + w, 100, z, x - w, 100, z); uv.push(0, 1, 1, 1, 1, 0, 0, 0); idx.push(b, b + 1, b + 2, b, b + 2, b + 3); }
  reedG.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); reedG.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); reedG.setIndex(idx); reedG.computeVertexNormals();
  reedG.setAttribute('aoV', new THREE.Float32BufferAttribute(new Array(pos.length / 3).fill(0.6), 1));
  const mat = () => new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.3, side: THREE.DoubleSide });
  const cols = [{ name: 'grass_reed', kind: 'cover', place: { size: 0.01, lift: 0.29 } }, { name: 'grass_plates', kind: 'cover', place: { size: 1, lift: 0.382 } }];
  ctx.TREE_PACK = { collections: cols };
  // the six plates as the pack ships them: three upright (top 0.87 m), three leaning (0.53 m)
  const plates = [0.87, 0.87, 0.87, 0.53, 0.55, 0.51].map((h, i) => ({ key: 'plate' + i, col: cols[1], sub: { bb: [-0.13, 0, -1.12, 0.13, h, 1.12], h }, geo: quad(1.12, h), mat: mat() }));
  const reedM = mat();
  const treeList = () => [{ key: 'reed1', col: cols[0], sub: { bb: [-70, 0, -70, 70, 100, 70], h: 100 } }].concat(plates);
  const treeBuild = (T, key) => { const p = plates.find(q => q.key === key); return p ? { parts: [{ geo: p.geo, mat: p.mat }] } : { parts: [{ geo: reedG, mat: reedM }] }; };
  const MIX = { grassland: { species: { grass_reed: { proportion: 1, density: 0.48 } }, forest: { cover: 1 } } };
  const BIO = { mixAt: () => 'grassland', mixOf: k => MIX[k] || null, knobs: () => ({}) };
  BIO.edgeOn = false;
  const world = { terrainH: () => 0, waterH: (x, z) => (o.pond && z > 30 && z < 40 ? 0.1 : -10), island: null };   // (o.pond: drawn water over z 30..40, over the mown strip)
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.5, 5000); camera.position.set(o.ex || 10, 2, o.ez || 8); camera.lookAt(30, 0, 8); camera.updateMatrixWorld();
  B.load(path.join('src', 'viewer', 'cover_ring.js'));
  const coverAt = coverOf(o);
  let lawn = null;
  const base = { scene: new THREE.Scene(), world, camera, treeBuild, treeList, LEAF: ctx.TREE_LEAF, BIO, GF: null, biomeAt: () => 'grassland', codeAt: () => 2,
    okAt: () => true, coverAt, groundMeanAt: () => GRASS.slice() };
  const field = ctx.COVER_RING.make(THREE, Object.assign({}, base, { layer: 'grass', lawnOn: () => !!(lawn && lawn.get().on && !lawn.get().off), lawnTall: () => (lawn ? +lawn.get().tallCards || 0 : 0) }));
  lawn = ctx.COVER_RING.make(THREE, Object.assign({}, base, { scene: new THREE.Scene(), layer: 'lawn' }));
  const common = { budgetMs: 1e9, blockBudget: 1e9, grow: 0, reach: 60, near: 10, tier: 0 };
  field.set(Object.assign({ on: true, tufts: 12, blotch: 0, green: 0, minH: 0.3 }, common, o.field || {}));
  const def = lawn.get();   // the shipped defaults, before the gate's own dials
  lawn.set(Object.assign({ on: o.lawnOn !== false }, common, o.lawn || {}));
  for (let i = 0; i < 4; i++) { field.update(); lawn.update(); }
  const pts = R => { const c = R.census(), a = []; for (let i = 0; i < c.length; i += 3) a.push([c[i + 1], c[i + 2]]); return a; };
  return { field, lawn, def, fp: pts(field), lp: pts(lawn), THREE, B, CR: ctx.COVER_RING };
}
const run = o => { try { return rings(o); } catch (e) { ok(false, 'the rings plant: ' + (e && e.stack || e).toString().slice(0, 400)); return null; } };

const A = run({});
if (A) {
  // 0 the shipped default (17 Nov, variant B on the page): on, 8 cm, 150 cards / m2, the tall band at grass-edge's 40 cm
  ok(A.def.on === true && A.def.dens === 300 && A.def.cutH === 0.10 && A.def.reach === 20 && A.def.tallH === 0.4, '0 the default: the lawn ON, D (10 cm, 300 / m2 to 20 m: the user 17 Nov "d is best looking"), the tall band 40 cm', JSON.stringify({ on: A.def.on, dens: A.def.dens, cutH: A.def.cutH, reach: A.def.reach, tallH: A.def.tallH }));
  const st = A.lawn.stat(), by = st.by || {}, lp = A.lp;
  // 1 only grass_plates, only on the cut
  ok(Object.keys(by).length === 1 && by.grass_plates > 0, '1a the lawn plants grass_plates alone', JSON.stringify(by));
  console.log('  info the lawn\'s cells: ' + st.built + ' built, mean ' + (st.sumMs / Math.max(1, st.built)).toFixed(1) + ' ms, the slowest ' + st.maxMs.toFixed(1) + ' ms (dens ' + A.lawn.get().dens + ', cell ' + A.lawn.get().cell + ' m, node)');
  const wild = lp.filter(p => p[0] > 24.5).length, onKill = lp.filter(p => p[0] > -3 && p[0] < -1).length, ramp = lp.filter(p => p[0] >= -1 && p[0] < 0).length, row = lp.filter(p => p[0] >= 0 && p[0] < 1).length;
  ok(wild === 0 && onKill === 0, '1b none on the wild meadow, none on the runway\'s kill past its 1 m ramp', 'wild ' + wild + ', kill ' + onKill);
  ok(ramp < row * 0.5, '1c the pavement\'s edge: the last metre before the kill thins (bilinear, never the nearest node)', ramp + ' vs ' + row + ' in the next metre');
  // 2 dens x cut: the fully mown strip (x 0..20) over the planted z span
  const S = A.lawn.get(); let z0 = Infinity, z1 = -Infinity; for (const p of lp) { if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1]; }
  const inner = lp.filter(p => p[0] >= 1 && p[0] <= 19 && p[1] >= z0 + 1 && p[1] <= z1 - 1).length, area = 18 * (z1 - z0 - 2);
  const per = inner / area;
  ok(Math.abs(per / S.dens - 1) < 0.1, '2a the fully mown strip holds dens cards / m2 (dens ' + S.dens + ')', per.toFixed(1) + ' / m2 over ' + area.toFixed(0) + ' m2');
  const edge = lp.filter(p => p[0] >= 21 && p[0] <= 23 && p[1] >= z0 + 1 && p[1] <= z1 - 1).length / (2 * (z1 - z0 - 2));
  ok(edge > 0.25 * per && edge < 0.75 * per, '2b the band\'s soft edge is thinner (cut 0.25-0.75)', edge.toFixed(1) + ' / m2');
  // 3 the length: the mean card scale x its plate's top
  const hs = []; for (const m of A.lawn.root.children.flatMap(g => g.children || [])) { const ud = m.userData || {}; if (!m.isInstancedMesh || !m.count) continue;
    const top = m.geometry.boundingBox ? m.geometry.boundingBox.max.y : (m.geometry.computeBoundingBox(), m.geometry.boundingBox.max.y);
    const a = m.instanceMatrix.array; for (let i = 0; i < m.count; i++) hs.push(a[i * 16 + 5] * top); }
  const mean = a => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
  if (hs.length) ok(Math.abs(mean(hs) / S.cutH - 1) < 0.15, '3a the lawn stands at cutH (' + S.cutH + ' m), no 30 cm floor', 'mean ' + mean(hs).toFixed(3) + ' m over ' + hs.length);
  else ok(false, '3a the lawn\'s instanced meshes are readable', 'none');
  // 4 the field leaves the cut ground to the lawn; the wild meadow is today's point for point
  const fOnCut = A.fp.filter(p => p[0] >= 0 && p[0] <= 20).length;
  ok(fOnCut === 0, '4a with the lawn on, no reed tuft on the fully cut ground', fOnCut);
  const Off = run({ lawnOn: false });
  if (Off) {
    const key = p => p[0].toFixed(4) + ',' + p[1].toFixed(4);
    const wOn = A.fp.filter(p => p[0] > 24).map(key).sort(), wOff = Off.fp.filter(p => p[0] > 24).map(key).sort();
    ok(wOn.length > 100 && wOn.join('|') === wOff.join('|'), '4b the wild meadow\'s tufts are the same point for point, lawn on or off', wOn.length + ' vs ' + wOff.length);
    // 5 the lawn off: the field keeps the cut ground's tufts (today's), and the lawn plants nothing
    ok(Off.fp.filter(p => p[0] >= 0 && p[0] <= 20).length > 100 && Off.lp.length === 0, '5 the lawn off: the cut ground keeps the field\'s tufts, the lawn plants none',
      Off.fp.filter(p => p[0] >= 0 && p[0] <= 20).length + ' tufts, ' + Off.lp.length + ' cards');
  }
  // 7 the instrument
  const at = A.lawn.fieldAt(10, 8), aw = A.lawn.fieldAt(40, 8), ak = A.lawn.fieldAt(-1.5, 8);
  ok(at && Math.abs(at.perM2 - S.dens) < 1e-6 && at.h === S.cutH && aw && aw.perM2 === 0 && ak && ak.perM2 === 0, '7 lawnAt: dens on the mown strip, 0 on the wild and the kill',
    JSON.stringify({ mown: at && at.perM2, wild: aw && aw.perM2, kill: ak && ak.perM2 }));
}
// 3b / 3c the tall cut and a grass strip's surface
{ const T = run({ tall: true }), U = run({ surf: true });
  const hOf = R => { const hs = []; for (const m of R.lawn.root.children.flatMap(g => g.children || [])) { if (!m.isInstancedMesh || !m.count) continue; m.geometry.computeBoundingBox();
    const top = m.geometry.boundingBox.max.y, a = m.instanceMatrix.array; for (let i = 0; i < m.count; i++) hs.push(a[i * 16 + 5] * top); } return hs.reduce((s, v) => s + v, 0) / Math.max(1, hs.length); };
  if (T) { const tf = T.fp.filter(p => p[0] >= 1 && p[0] <= 19).length, inBand = T.lp.filter(p => p[0] >= 0 && p[0] <= 24).length;   // (the band itself; the pavement's 1 m ramp reads its own node)
    ok(inBand === 0 && tf > 100, '3b the tall band beside a soft strip stays the field\'s tufts (tallCards 0: 40 cm cards read as dark blocks, 17 Nov)', inBand + ' cards in the band, ' + tf + ' tufts'); }
  const T1 = run({ tall: true, lawn: { tallCards: 1 } });
  if (T1) { const S = T1.lawn.get(); ok(T1.lp.length > 1000 && Math.abs(hOf(T1) / S.tallH - 1) < 0.2 && T1.fp.filter(p => p[0] >= 1 && p[0] <= 19).length === 0, '3b2 tallCards 1: cards at tallH (' + S.tallH + ' m) and no tuft there', hOf(T1).toFixed(3)); }
  if (U) { const S = U.lawn.get(); ok(Math.abs(hOf(U) / S.stripH - 1) < 0.15, '3c a grass strip\'s surface stands at stripH (' + S.stripH + ' m)', hOf(U).toFixed(3)); } }
// 6 the tiers nest: the cell planted for a far eye is a subset of the near one
{ const near = run({ lawn: { tier: 0 } }), far = run({ lawn: { tier: 1 }, ex: 10, ez: 8 });
  if (near && far) {
    const C = far.lawn.get().cell, key = p => p[0].toFixed(4) + ',' + p[1].toFixed(4), N = new Set(near.lp.map(key));
    const sub = far.lp.every(p => N.has(key(p)));
    ok(sub && far.lp.length <= near.lp.length, '6 the tiers nest: every card a far tier keeps, the whole stream keeps', far.lp.length + ' of ' + near.lp.length); } }
// 9 never in drawn water (A0 17 Nov, L40e's LOOKS 5): a pond across the mown strip plants no card in it
{ const W = run({ pond: true }); if (W) { const wet = W.lp.filter(p => p[0] >= 0 && p[0] <= 20 && p[1] > 30.5 && p[1] < 39.5).length, dry = W.lp.filter(p => p[0] >= 0 && p[0] <= 20 && p[1] > 20 && p[1] < 29).length;
  ok(wet === 0 && dry > 1000, '9 no card in drawn water across the mown strip (the dry metres either side keep theirs)', 'wet ' + wet + ', dry ' + dry); } }
// 8 off
{ const O = run({ lawn: { off: true } }); if (O) ok(O.lp.length === 0, '8 off (the GRAPHICS row): no card', O.lp.length); }

// 10 THE LADDER (the user 17 Nov: "d is best looking. Maybe a ladder D -> B -> B phone?"): the GRAPHICS row 'mown grass' is a FREE
// row (the desktop presets untouched), 'auto' by default, picking D on ultra / gamer, B on current / retro, the phone's on potato /
// laptop; the rungs' dials as shipped
{ const src = require('fs').readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'gfx_settings.js'), 'utf8');
  const of = /const LAWN_OF = (\{[^}]*\})/.exec(src), lad = /const LAWN_LADDER = (\{[\s\S]*?\n    off:\s*\{ off: true \} \})/.exec(src);
  const obj = t => Function('return (' + t + ')')();
  const O = of ? obj(of[1]) : {}, L = lad ? obj(lad[1]) : {};
  ok(O.ultra === 'D' && O.gamer === 'D' && O.current === 'B' && O.retro === 'B' && O.potato === 'off' && O.laptop === 'off', '10a auto: D on ultra / gamer, B on current / retro, off on potato / laptop (the phones: 17 Nov 12:40, the cards do not match their plain ground)', JSON.stringify(O));
  ok(L.D && L.D.dens === 300 && L.D.cutH === 0.10 && L.D.reach === 20 && L.B && L.B.dens === 150 && L.B.cutH === 0.08 && L.B.reach === 40 && L.phone && L.phone.reach < L.D.reach && L.off && L.off.off === true,
    '10b the rungs: D 300 / 10 cm / 20 m, B 150 / 8 cm / 40 m, the phone nearer than D, off', JSON.stringify({ D: L.D, B: L.B, phone: L.phone }));
  ok(/\{ k: 'lawn', label: 'mown grass', free: true, def: 'auto'/.test(src), "10c the row is free with 'auto' its default (the desktop presets as train 31 shipped them)"); }

console.log('GATE LAWN: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
