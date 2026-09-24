#!/usr/bin/env node
// _parked_check.js — GATE PARKED: the aeroplanes-as-props (G411), headless.
//
// The capture itself needs the editor and a page (the round trip through
// CAGE_UI); everything downstream of the snapshot is pure and is proven here
// on a SYNTHETIC payload in the snapshot's own shape (buckets by material
// with sec / wing / inside records, parts about their pivots with kinds and
// radii) under the real vendor three.js:
//
//   1  the record: an aircraft object composes into records.objects with its
//      key, its yaw and the ground's height; one without a key is an issue
//   2  the stance: a taildragger's resting pitch puts all three tyre bottoms
//      on y = 0 (tail down); a tricycle's too (near level); no wheels stands
//      on the lowest vertex
//   3  the hitbox: fuselage / wing / tail / engine / gear boxes by identity —
//      the engine ahead of the fuselage, the wing the span wide, the tyres
//      on the ground, an interior bucket in no box
//   4  the ladder: L0 carries every bucket and part, L1 no interior bucket
//      and no gauge / control / link / wire part; a level's meshes share the
//      record's geometry
//   5  the cut: the exterior as one wedge mesh (nt = the exterior's), the
//      decimator reaches its target, every cut triangle's three wedges belong
//      to ONE bucket (what the far levels' grouping relies on); the far
//      rungs land through the inline path (no Worker headless) — L2 one
//      mesh per distinct material, L3 at most three — and stand on the same
//      ground (lowest point within a millimetre of 0)
//   6  the material dupe: a pooled material's copy keeps its hook, defines
//      and per-finish uniforms, takes the block, and leaves the original's
//      userData untouched
//   8  the far levels baked (G569): the unwrap, the cut per chart, the dilation,
//      the bake hook, and L1 / L2 / L3 each ONE mesh on ONE material
//   7  the fixture: every aircraft object in island_jolene.json names an
//      archetype the design table declares and stands inside a flatten
//
// Usage: node tools/_parked_check.js          (prints GATE PARKED: PASS|FAIL)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const TOOLS = __dirname;
const ROOT = path.join(TOOLS, '..');
const fail = [];
let checks = 0;
const check = (ok, label, extra) => { checks++; if (!ok) fail.push(label + (extra ? ' — ' + extra : '')); return ok; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ---- the module, headless: the real three, the decimator's source, no page ---------
const THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
const CORE = require(path.join(TOOLS, 'flight_core.js'));
const W = { THREE, MESH_DECIMATE_SRC: CORE.MESH_DECIMATE_SRC, meshDecimate: CORE.meshDecimate, console,
            setTimeout, clearTimeout, performance, Math, JSON, Object, Array, Map, Set, Float32Array, Int16Array, Int8Array,
            Uint16Array, Uint32Array, Promise, Number, String, isFinite, Infinity, GEN_SPEC_V: CORE.GEN_SPEC_V };
W.window = W; W.globalThis = W;
vm.createContext(W);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'parked.js'), 'utf8'), W, { filename: 'parked.js' });
const PK = W.PARKED;
check(!!PK && typeof PK.build === 'function', 'the module loads headless');
if (PK) PK.quiet = true;

// ---- 1 the record ------------------------------------------------------------------
const PG = require(path.join(ROOT, 'src', 'core', '27_premises.js'));
{
  const synth = { id: 'synth', terrainH: (x, z) => 2 + 0.01 * x + 0.02 * z, waterH: () => -4 };
  const rec = PG.normalise(PG.DEF());
  rec.layers.objects.push({ id: 'o1', kind: 'aircraft', key: 'arch:cub', x: 12, z: -7, yaw: 0.4 });
  const O = PG.compose(rec, synth);
  const ob = (O.records.objects || []).find(q => q.kind === 'aircraft');
  check(!!ob, '1 an aircraft object composes into records.objects');
  if (ob) {
    check(ob.key === 'arch:cub' && ob.x === 12 && ob.z === -7 && near(ob.yaw, 0.4, 1e-9), '1 the record keeps key, place and yaw');
    check(near(ob.y, O.localH(12, -7), 1e-6), '1 the record stands at the composed ground', String(ob.y));
  }
  const bad = PG.normalise(PG.DEF());
  bad.layers.objects.push({ id: 'o2', kind: 'aircraft', x: 0, z: 0, yaw: 0 });
  check(PG.issues(bad).some(s => /aircraft o2: no key/.test(s)), '1 an aircraft without a key is an issue');
  check(PG.compose(bad, synth).records.objects.length === 0, '1 ...and composes to nothing');
}

// ---- the synthetic payload -------------------------------------------------------------
// a box as an unwelded, subdivided triangle soup in the snapshot's group shape
function box(x0, y0, z0, x1, y1, z1, n, withSrf) {
  const pos = [], nrm = [], idx = [], srf = [];
  const face = (o, u, v, N) => {
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const p = (a, b) => [o[0] + u[0] * a + v[0] * b, o[1] + u[1] * a + v[1] * b, o[2] + u[2] * a + v[2] * b];
      const a = p(i / n, j / n), b = p((i + 1) / n, j / n), c = p((i + 1) / n, (j + 1) / n), d = p(i / n, (j + 1) / n);
      for (const q of [a, b, c, a, c, d]) { idx.push(pos.length / 3); pos.push(...q); nrm.push(...N); srf.push(q[0], q[2], 0, 0); }
    }
  };
  const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
  face([x0, y0, z1], [dx, 0, 0], [0, dy, 0], [0, 0, 1]);    // +z
  face([x1, y0, z0], [-dx, 0, 0], [0, dy, 0], [0, 0, -1]);  // -z
  face([x1, y0, z1], [0, 0, -dz], [0, dy, 0], [1, 0, 0]);   // +x
  face([x0, y0, z0], [0, 0, dz], [0, dy, 0], [-1, 0, 0]);   // -x
  face([x0, y1, z1], [dx, 0, 0], [0, 0, -dz], [0, 1, 0]);   // +y
  face([x0, y0, z0], [dx, 0, 0], [0, 0, dz], [0, -1, 0]);   // -y
  const g = { pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint32Array(idx), nv: pos.length / 3,
              uv: new Float32Array((pos.length / 3) * 2) };
  if (withSrf) g.srf = new Float32Array(srf);
  return g;
}
// model frame: x aft, y up, z left. A taildragger: mains ahead of the CG, a tailwheel aft and higher.
function synthVis(kind) {
  const groups = {}, mats = {};
  const bucket = (k, g, m) => { groups[k] = g; mats[k] = Object.assign({ color: 0xafa893, rough: 0.7, metal: 0 }, m); };
  bucket('sbody', box(-3, -0.6, -0.5, 3, 0.6, 0.5, 6, true), { sec: 'body', fin: 'fabric', surf: 1 });
  bucket('staper', box(3, -0.3, -0.25, 3.6, 0.3, 0.25, 3, true), { sec: 'taper', fin: 'fabric', surf: 1 });
  bucket('cowl', box(-4, -0.5, -0.45, -3, 0.5, 0.45, 4, true), { fin: 'alclad', surf: 1, color: 0xa4abb3 });
  bucket('wing', box(-1, 0.8, -5, 0.5, 0.9, 5, 6, true), { fin: 'alclad', wing: 1, surf: 1 });
  bucket('stab', box(2.2, 0.3, -1.5, 3, 0.35, 1.5, 3, true), { fin: 'alclad', wing: 2, surf: 1 });
  bucket('liner', box(-2, 5, -0.3, 0, 6, 0.3, 2, false), { fin: 'liner', inside: 1 });   // absurdly high: no box may reach it
  bucket('glass', box(-2.4, 0.2, -0.52, -1.2, 0.7, 0.52, 2, true), { fin: 'glass', opacity: 0.3, sec: 'windshield', surf: 1 });
  bucket('tube', box(-1, -0.1, -0.05, 1, 0.1, 0.05, 2, false), { fin: 'steelTube', metal: 0.9, color: 0x525c68 });
  const wheel = (x, y, z, R) => ({ pos: box(-R, -R, -0.08, R, R, 0.08, 3, false).pos, nrm: box(-R, -R, -0.08, R, R, 0.08, 3).nrm,
                                   idx: box(-R, -R, -0.08, R, R, 0.08, 3).idx, nv: 6 * 9 * 6, uv: new Float32Array(6 * 9 * 6 * 2) });
  const parts = [];
  const tyre = { color: 0x101010, fin: 'rubber', rough: 0.9, metal: 0 };
  mats.tyre = tyre;
  if (kind === 'tail') {
    parts.push({ kind: 'mainsL', R: 0.25, pivot: [-1.5, -0.8, 0.8], stretch: false, groups: { tyre: wheel(0, 0, 0, 0.25) } });
    parts.push({ kind: 'mainsR', R: 0.25, pivot: [-1.5, -0.8, -0.8], stretch: false, groups: { tyre: wheel(0, 0, 0, 0.25) } });
    parts.push({ kind: 'tw', R: 0.1, pivot: [3.2, -0.75, 0], stretch: false, groups: { tyre: wheel(0, 0, 0, 0.1) } });
  } else if (kind === 'trike') {
    parts.push({ kind: 'mainsL', R: 0.2, pivot: [-0.8, -0.9, 0.8], stretch: false, groups: { tyre: wheel(0, 0, 0, 0.2) } });
    parts.push({ kind: 'mainsR', R: 0.2, pivot: [-0.8, -0.9, -0.8], stretch: false, groups: { tyre: wheel(0, 0, 0, 0.2) } });
    parts.push({ kind: 'tw', R: 0.15, pivot: [-2.6, -0.85, 0], stretch: false, groups: { tyre: wheel(0, 0, 0, 0.15) } });
  }
  mats.blade = { color: 0x925220, fin: 'ply', spin: 1 };
  mats.block = { color: 0x333941, fin: 'castAlu' };
  mats.needle = { color: 0xf2efe6 };
  parts.push({ kind: 'prop', R: 0, pivot: [-4.15, 0, 0], stretch: false, axis: [-1, 0, 0], groups: { blade: box(-0.05, -0.9, -0.03, 0.05, 0.9, 0.03, 2, false) } });
  parts.push({ kind: 'eng', unit: 0, R: 0, pivot: [-3.5, 0, 0], stretch: false, groups: { block: box(-0.3, -0.3, -0.3, 0.3, 0.3, 0.3, 2, false) } });
  parts.push({ kind: 'gauge', R: 0, pivot: [-2.2, 0.3, 0.1], stretch: false, groups: { needle: box(-0.01, -0.01, -0.03, 0.01, 0.01, 0.03, 1, false) } });
  parts.push({ kind: 'surf_elevL', surf: 'elevL', R: 0, pivot: [3, 0.32, 0.7], stretch: false, groups: { stab: box(0, -0.02, -0.7, 0.4, 0.02, 0.7, 2, true) } });
  return { cage: true, groups, mats, parts, off: [0, 0], pitch: 0, weather: null, footwell: null, holes: [] };
}
// a block with one entry stands in for AEROSKIN's: the placement adds its uCraftInv to it
const record = (key, vis) => ({ key, spec: {}, vis, block: { uDecN: { value: 0 } }, atlas: null, panel: {}, t: 0, far: null, tris: 0 });

// ---- 2 the stance ----------------------------------------------------------------------
{
  const vis = synthVis('tail');
  const st = PK.stance(vis);
  check(st.pitch < -0.02, '2 a taildragger sits tail down (pitch < 0 in the model frame)', String(st.pitch));
  const cs = Math.cos(st.pitch), sn = Math.sin(st.pitch);
  for (const p of vis.parts) if (/^(mainsL|mainsR|tw)$/.test(p.kind)) {
    const yb = p.pivot[0] * sn + p.pivot[1] * cs - p.R + st.lift;
    check(near(yb, 0, 1e-6), '2 ' + p.kind + ' tyre bottom on y = 0', String(yb));
  }
  const st2 = PK.stance(synthVis('trike'));
  check(Math.abs(st2.pitch) < 0.1, '2 a tricycle sits near level', String(st2.pitch));
  const v3 = synthVis('tail'); v3.parts = v3.parts.filter(p => !/^(mainsL|mainsR|tw)$/.test(p.kind));
  const st3 = PK.stance(v3);
  check(st3.pitch === 0 && near(st3.lift, 0.9, 1e-6), '2 no wheels: level on the lowest vertex (the blade tip)', JSON.stringify(st3));
}

// ---- 3 the hitbox ------------------------------------------------------------------------
{
  const vis = synthVis('tail');
  const st = PK.stance(vis);
  const hb = PK.hitboxOf(record('k', vis), st);
  const by = {}; for (const b of hb) by[b.name] = b;
  check(['fuselage', 'wing', 'tail', 'engine', 'gear'].every(n => by[n]), '3 fuselage / wing / tail / engine / gear boxes', hb.map(b => b.name).join(','));
  // rough boxes: a pitched long body's corner reaches a little past the cowl's foot
  if (by.fuselage && by.engine) check(by.engine.min[0] > by.fuselage.max[0] - 0.2 && by.engine.max[0] > by.fuselage.max[0] + 0.5, '3 the engine box stands ahead of the fuselage (+x is the nose)', by.engine.min[0] + ' vs ' + by.fuselage.max[0]);
  if (by.tail && by.fuselage) check(by.tail.max[0] < by.fuselage.min[0] + 1.5, '3 the tail box is aft', by.tail.max[0] + '');
  if (by.wing) check(near(by.wing.max[2] - by.wing.min[2], 10, 0.02), '3 the wing box is the span wide', String(by.wing.max[2] - by.wing.min[2]));
  // the synthetic tyre is a BOX of half-size R: its corner dips R sin(pitch) under the analytic bottom
  if (by.gear) check(by.gear.min[1] > -0.015 && by.gear.min[1] < 0.02, '3 the gear box rests on the ground', String(by.gear.min[1]));
  check(hb.every(b => b.max[1] < 4), '3 the interior bucket is in no box', hb.map(b => b.name + ':' + b.max[1]).join(' '));
  check(by.tail && by.tail.min[2] < -1.4 && by.tail.max[2] > 1.4, '3 the elevator part joins the tail box');
}

// ---- 4 the ladder ---------------------------------------------------------------------------
{
  const vis = synthVis('tail');
  const rec = record('k', vis);
  rec.geos = new Map();
  const matFor = () => new THREE.MeshStandardMaterial();
  const count = g => { let n = 0; g.traverse(o => { if (o.isMesh) n++; }); return n; };
  const L0 = PK.levelMeshes(THREE, rec, matFor, true), L1 = PK.levelMeshes(THREE, rec, matFor, false);
  const nAll = Object.keys(vis.groups).length + vis.parts.reduce((s, p) => s + Object.keys(p.groups).length, 0);
  const nExt = Object.keys(vis.groups).filter(k => !PK.isInterior(vis.mats[k])).length + vis.parts.filter(PK.PART_L1).reduce((s, p) => s + Object.keys(p.groups).length, 0);
  check(count(L0) === nAll, '4 L0 carries every bucket and part', count(L0) + ' vs ' + nAll);
  check(count(L1) === nExt && nExt === nAll - 2, '4 L1 drops the interior bucket and the gauge', count(L1) + ' vs ' + nExt);
  const geos = new Set(); L0.traverse(o => { if (o.isMesh) geos.add(o.geometry); }); L1.traverse(o => { if (o.isMesh) geos.add(o.geometry); });
  check(geos.size === nAll, '4 the levels share the record\'s geometries', String(geos.size));
}

// ---- 5 the cut -------------------------------------------------------------------------------
{
  const vis = synthVis('tail');
  const rec = record('k', vis);
  const ext = PK.exteriorMesh(rec);
  const nExt = Object.keys(vis.groups).filter(k => !PK.isInterior(vis.mats[k])).reduce((s, k) => s + vis.groups[k].idx.length / 3, 0)
             + vis.parts.filter(PK.PART_L1).reduce((s, p) => s + Object.keys(p.groups).reduce((t, k) => t + p.groups[k].idx.length / 3, 0), 0);
  check(ext.nt === nExt, '5 the exterior mesh has the exterior\'s triangles', ext.nt + ' vs ' + nExt);
  check(ext.wb.length === ext.pos.length / 3 && ext.srf.length === ext.wb.length * 4, '5 a bucket id, a field per wedge');
  // quantise as the worker does and cut to a third
  const bb = ext.bb, nv = ext.pos.length / 3;
  const q = new Int16Array(nv * 3), n8 = new Int8Array(nv * 3);
  const sx = 65535 / (bb[3] - bb[0]), sy = 65535 / (bb[4] - bb[1]), sz = 65535 / (bb[5] - bb[2]);
  for (let i = 0; i < nv; i++) {
    q[i * 3] = Math.round((ext.pos[i * 3] - bb[0]) * sx) - 32768; q[i * 3 + 1] = Math.round((ext.pos[i * 3 + 1] - bb[1]) * sy) - 32768; q[i * 3 + 2] = Math.round((ext.pos[i * 3 + 2] - bb[2]) * sz) - 32768;
    for (let k = 0; k < 3; k++) n8[i * 3 + k] = Math.round(ext.nrm[i * 3 + k] * 127);
  }
  const target = Math.round(ext.nt / 3);
  const r = CORE.meshDecimate({ nv, nt: ext.nt, pos: q, nrm: n8, idx: ext.idx }, bb, target);
  check(r.nt <= target + 2 && r.nt >= target * 0.5, '5 the decimator reaches its target', r.nt + ' of ' + ext.nt + ' for ' + target);
  let cross = 0;
  for (let t = 0; t < r.nt; t++) { const a = ext.wb[r.idx[t * 3]], b = ext.wb[r.idx[t * 3 + 1]], c = ext.wb[r.idx[t * 3 + 2]]; if (a !== b || b !== c) cross++; }
  check(cross === 0, '5 every cut triangle keeps to one bucket', String(cross));
}

// ---- 5b the far rungs through build, inline (no Worker here) --------------------------------
async function farRungs() {
  const vis = synthVis('tail');
  const rec = record('k', vis);
  const grp = new THREE.Group(); grp.position.set(10, 5, -3); grp.rotation.y = 0.7;
  const lod = PK.build(THREE, rec, grp);
  check(lod.isLOD && lod.levels.length === 5, '5b a five-rung LOD', String(lod.levels.length));
  check(near(lod.levels[1].distance, PK.LEVELS.L1, 0) && near(lod.levels[4].distance, PK.LEVELS.cull, 0), '5b the rungs at the declared distances');
  const t0 = Date.now();
  while (!rec.far && Date.now() - t0 < 30000) await new Promise(r => setTimeout(r, 50));
  if (!check(!!rec.far, '5b the far levels land through the inline path')) return;
  await new Promise(r => setTimeout(r, 20));
  const count = g => { let n = 0; g.traverse(o => { if (o.isMesh) n++; }); return n; };
  const exteriorKeys = Object.keys(vis.groups).filter(k => !PK.isInterior(vis.mats[k]));
  const partKeys = []; for (const p of vis.parts) if (PK.PART_L1(p)) for (const k in p.groups) partKeys.push(k);
  const nMat = new Set(exteriorKeys.concat(partKeys)).size;   // one plain material per bucket key headless
  check(count(lod.levels[2].object) === nMat, '5b L2: one mesh per distinct material', count(lod.levels[2].object) + ' vs ' + nMat);
  check(count(lod.levels[3].object) <= 3 && count(lod.levels[3].object) >= 2, '5b L3: paint / metal / glass', String(count(lod.levels[3].object)));
  const t2 = rec.far.levels[0].nt, t3 = rec.far.levels[1].nt;
  check(t2 <= Math.max(PK.CUT.L2[1], Math.round(PK.CUT.L2[0] * PK.exteriorMesh(rec).nt)) + 2 && t3 < t2, '5b the rungs get smaller', t2 + ' > ' + t3);
  // every rung stands on the same ground: its lowest world point at the holder's y
  grp.updateWorldMatrix(true, true);
  const v = new THREE.Vector3();
  for (const li of [0, 1, 2, 3]) {
    let low = Infinity;
    lod.levels[li].object.traverse(m => { if (!m.isMesh) return; const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) { v.set(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(m.matrixWorld); if (v.y < low) low = v.y; } });
    check(near(low - grp.position.y, 0, 0.015), '5b rung ' + li + ' stands on the ground (a box tyre corner)', String(low - grp.position.y));
  }
  // the craft frame: the model group's own point (0, 0, 0) is at the holder; the nose (model -x) is at +x of the holder's yaw
  const inv = lod.userData.craftInv && lod.userData.craftInv.value;
  check(!!inv, '5b the placement has its craft matrix');
  if (inv) {
    // a world point one metre ahead of the nose axis in the holder's frame -> craft y (aft) negative
    const st = lod.userData.stance;
    const ahead = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), grp.rotation.y).add(grp.position);
    const c = ahead.clone().applyMatrix4(inv);
    check(c.y < -0.5 && Math.abs(c.x) < 0.3, '5b craft space: ahead of the nose is aft-negative, on the centreline', c.toArray().map(x => x.toFixed(2)).join(','));
    check(typeof st.pitch === 'number', '5b the stance rides on the object');
  }
}

// ---- 6 the material dupe -------------------------------------------------------------------
{
  const m = new THREE.MeshPhysicalMaterial({ color: 0x123456, roughness: 0.3, metalness: 0.2, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
  m.defines = { AEROSKIN_SURF: 1, STANDARD: '', PHYSICAL: '' };
  m.clearcoat = 0.4;
  const hook = function (shader) { return shader; };
  m.onBeforeCompile = hook;
  const shared = { u: 1 }, aeroU = { tDetail: { value: 7 } };
  m.userData = { aeroU, aeroD: shared, aeroFinish: 'fabric' };
  const block = { uDecN: { value: 0 } };
  const c = PK.dupe(m, block);
  check(c !== m && c.isMeshPhysicalMaterial, '6 a fresh instance of the same class');
  check(c.onBeforeCompile === hook, '6 the copy keeps the hook');
  check(c.defines && c.defines.AEROSKIN_SURF === 1 && c.defines.PHYSICAL === '' && c.defines !== m.defines, '6 the defines are copied');
  check(c.userData.aeroU === aeroU && c.userData.aeroD === block && c.userData.aeroFinish === 'fabric' && c.userData.parked === 1, '6 the copy takes the block, shares the finish uniforms');
  check(m.userData.aeroD === shared && m.userData.aeroU === aeroU, '6 the original\'s userData is untouched');
  check(c.color.getHex() === 0x123456 && near(c.roughness, 0.3, 0) && c.transparent && near(c.opacity, 0.5, 0) && c.side === THREE.DoubleSide && near(c.clearcoat, 0.4, 0), '6 the fields are copied');
  const sm = new THREE.ShaderMaterial({ uniforms: { uDecN: { value: 5 }, uOwn: { value: 2 } } });
  sm.userData = { aeroFinish: 'glass' };
  const sc = PK.dupe(sm, block);
  check(sc.uniforms.uDecN === block.uDecN && sc.uniforms.uOwn !== sm.uniforms.uOwn && sc.uniforms.uOwn.value === 2, '6 a shader material takes the block into its own uniforms');
}
// 6b THE HOOK THROUGH ATMO'S ACCESSOR. In the game atmo.js makes Material.prototype.onBeforeCompile
// an accessor (G432.2): a material's own hook lives on `_atmoHook` and is not an own property, and
// until 2026-09-23 every copy went out hookless - no decals, no weathering, the glass without its
// shader. Headless there is no atmo, so the accessor is installed here in atmo's own shape and the
// prototype put back after.
{
  const proto = THREE.Material.prototype;
  const d0 = Object.getOwnPropertyDescriptor(proto, 'onBeforeCompile');
  const WRAP = new WeakMap(), injectOnly = function () {};
  injectOnly.toString = () => 'atmo.inject';
  Object.defineProperty(proto, 'onBeforeCompile', { configurable: true,
    get() { const f = this._atmoHook; if (!f) return injectOnly; let w = WRAP.get(f);
            if (!w) { w = function (sh, r) { return f.call(this, sh, r); }; w.toString = () => 'atmo.inject+' + f.toString(); WRAP.set(f, w); } return w; },
    set(f) { this._atmoHook = f || null; } });
  try {
    const m = new THREE.MeshStandardMaterial({ color: 0x224466 });
    const hook = function (shader) { return 'the aeroskin hook'; };
    m.onBeforeCompile = hook;
    m.userData = { aeroFinish: 'alclad' };
    check(!Object.prototype.hasOwnProperty.call(m, 'onBeforeCompile') && m._atmoHook === hook, '6b the accessor holds the hook off the instance (the trap\'s precondition)');
    const c = PK.dupe(m, { uDecN: { value: 0 } });
    check(c._atmoHook === hook, '6b the copy keeps the hook through the accessor');
    check(String(c.onBeforeCompile) === String(m.onBeforeCompile), '6b ...so it keys the same program as the original', String(c.onBeforeCompile).slice(0, 40));
  } finally {
    if (d0) Object.defineProperty(proto, 'onBeforeCompile', d0); else delete proto.onBeforeCompile;
  }
}

// ---- 6c the panes' multiply pass per level ----------------------------------------------------
// With a stub AEROSKIN (the factories' shape, not their shaders): every pane carries its multiply
// companion at every level that draws the real glass - L0, L1 and the merged L2 - and past L0,
// where no cabin stands behind the pane, that companion stops most of what is behind it.
async function paneLevels() {
  const mk = (cls, fin, o) => { const m = new cls(o || {}); m.userData.aeroFinish = fin; return m; };
  W.AEROSKIN = {
    aeroGlass: (T, o) => mk(THREE.MeshPhysicalMaterial, 'glass', { color: o.tintLin, transparent: true, opacity: o.opacity }),
    aeroGlassTint: (T, o) => { const m = new THREE.ShaderMaterial({ uniforms: { uA: { value: o.opacity }, uTint: { value: new THREE.Color(o.tintLin) } } }); m.userData.aeroFinish = 'glassTint'; return m; },
    aeroMaterial: (T, o) => mk(THREE.MeshStandardMaterial, o.finish, { color: o.tintLin }),
    aeroGlassCompanion: (T, host, mats, tintOf) => { const c = new THREE.Mesh(host.geometry, tintOf(mats)); c.userData.aeroCompanion = 1; host.add(c); return c; },
  };
  try {
    const vis = synthVis('tail');
    const rec = record('pane', vis);
    const lod = PK.build(THREE, rec, new THREE.Group());
    const t0 = Date.now();
    while (!rec.far && Date.now() - t0 < 30000) await new Promise(r => setTimeout(r, 50));
    await new Promise(r => setTimeout(r, 20));
    const panes = L => { const out = []; lod.levels[L].object.traverse(o => { if (o.isMesh && o.material.userData.aeroFinish === 'glass') out.push(o); }); return out; };
    const uA = p => { const c = p.children.find(q => q.userData.aeroCompanion); return c ? c.material.uniforms.uA.value : null; };
    for (const L of [0, 1, 2]) {
      const ps = panes(L);
      check(ps.length > 0 && ps.every(p => uA(p) != null), '6c L' + L + ': every pane carries its multiply pass', ps.length + ' panes, slabs ' + ps.map(uA).join(','));
    }
    check(panes(0).every(p => near(uA(p), 0.3, 1e-9)), '6c L0: the pane\'s own slab (the cabin is behind it)', panes(0).map(uA).join(','));
    check(panes(1).concat(panes(2)).every(p => uA(p) >= 0.8), '6c L1/L2: a dark slab where no cabin stands behind the pane', panes(1).concat(panes(2)).map(uA).join(','));
    const t1 = panes(1).map(p => p.children[0].material);
    check(t1.length && t1.every(m => m === t1[0]) && t1[0] !== panes(0)[0].children[0].material, '6c one companion material per pane and level kind, not one per mesh');
  } finally { delete W.AEROSKIN; }
}

// ---- 8 the far levels baked (G569) ------------------------------------------------------------
// The GPU bake itself needs a page; the rest is pure and proven here: the unwrap (every triangle
// counter-clockwise in the atlas, inside it, its chart's box clear of every other box), the cut on
// the unwrapped mesh (a triangle never straddles two charts), the dilation (no texel left unwritten),
// the bake hook's splices, and the assembly - L1, L2 and L3 each ONE mesh on ONE shared material,
// standing on the same ground as L0.
async function bakedRungs() {
  const vis = synthVis('tail');
  const rec = record('baked', vis);
  const ext = PK.exteriorMesh(rec);
  const uw = PK.unwrap(ext, { S: 256, gutter: 1 });
  if (!check(!!uw, '8 the synthetic exterior unwraps')) return;
  check(uw.nt === ext.nt && uw.idx.length === ext.nt * 3 && uw.cornerUV.length === ext.nt * 6, '8 the unwrap keeps every triangle', uw.nt + ' vs ' + ext.nt);
  check(uw.nv < ext.pos.length / 3, '8 the soup is welded within a chart', uw.nv + ' wedges of ' + ext.pos.length / 3);
  let bad = 0, out = 0;
  for (let t = 0; t < uw.nt; t++) {
    const a = uw.idx[t * 3], b = uw.idx[t * 3 + 1], c = uw.idx[t * 3 + 2];
    const s = (uw.uv[b * 2] - uw.uv[a * 2]) * (uw.uv[c * 2 + 1] - uw.uv[a * 2 + 1]) - (uw.uv[b * 2 + 1] - uw.uv[a * 2 + 1]) * (uw.uv[c * 2] - uw.uv[a * 2]);
    if (s < -1e-9) bad++;
  }
  for (let i = 0; i < uw.uv.length; i++) if (!(uw.uv[i] >= 0 && uw.uv[i] <= 1)) out++;
  check(bad === 0, '8 every triangle is counter-clockwise in the atlas (the bake sees its front)', String(bad));
  check(out === 0, '8 every uv inside the atlas', String(out));
  const R = uw.rects, S = uw.S, G = uw.gutter, s = uw.density;
  const box = r => [r.x, r.y, r.x + Math.max(1, Math.ceil(r.w * s)) + 2 * G, r.y + Math.max(1, Math.ceil(r.h * s)) + 2 * G];
  let over = 0, outside = 0;
  for (let i = 0; i < R.length; i++) { const A = box(R[i]); if (A[2] > S || A[3] > S) outside++;
    for (let j = i + 1; j < R.length; j++) { const B = box(R[j]); if (A[0] < B[2] && B[0] < A[2] && A[1] < B[3] && B[1] < A[3]) over++; } }
  check(over === 0 && outside === 0, '8 the chart boxes are disjoint and inside the atlas', over + ' overlaps, ' + outside + ' outside');
  check(uw.charts >= 6 && uw.fill > 0.2, '8 the boxes chart by facing and fill the atlas', uw.charts + ' charts, fill ' + uw.fill.toFixed(2));
  // the cut on the unwrapped mesh, as the Worker runs it: a chart border is a seam it keeps
  const wChart = new Int32Array(uw.nv); R.forEach((r, i) => { for (let w = r.w0; w < r.w1; w++) wChart[w] = i; });
  const bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let i = 0; i < uw.nv; i++) for (let a = 0; a < 3; a++) { bb[a] = Math.min(bb[a], uw.pos[i * 3 + a]); bb[a + 3] = Math.max(bb[a + 3], uw.pos[i * 3 + a]); }
  const q = new Int16Array(uw.nv * 3), n8 = new Int8Array(uw.nv * 3);
  for (let i = 0; i < uw.nv; i++) for (let a = 0; a < 3; a++) { q[i * 3 + a] = Math.round((uw.pos[i * 3 + a] - bb[a]) * 65535 / (bb[a + 3] - bb[a])) - 32768; n8[i * 3 + a] = Math.round(uw.nrm[i * 3 + a] * 127); }
  const cut = CORE.meshDecimate({ nv: uw.nv, nt: uw.nt, pos: q, nrm: n8, idx: uw.idx.slice() }, bb, Math.round(uw.nt / 3), { W_SEAM: PK.BAKE.seam });
  let straddle = 0;
  for (let t = 0; t < cut.nt; t++) { const a = wChart[cut.idx[t * 3]]; if (a !== wChart[cut.idx[t * 3 + 1]] || a !== wChart[cut.idx[t * 3 + 2]]) straddle++; }
  check(cut.nt < uw.nt && straddle === 0, '8 the cut keeps every triangle inside one chart', cut.nt + ' of ' + uw.nt + ', ' + straddle + ' straddle');
  // the dilation
  const A = new Uint8Array(8 * 8 * 4), B = new Uint8Array(8 * 8 * 4);
  A[(3 * 8 + 3) * 4] = 200; A[(3 * 8 + 3) * 4 + 3] = 255; B[(3 * 8 + 3) * 4 + 1] = 77;
  const cov = PK.dilate([A, B], 8);
  let unw = 0; for (let i = 0; i < 64; i++) if (A[i * 4 + 3] !== 255 || A[i * 4] !== 200 || B[i * 4 + 1] !== 77) unw++;
  check(near(cov, 1 / 64, 1e-9) && unw === 0, '8 every unwritten texel takes its nearest written one', 'cov ' + cov + ', ' + unw + ' left');
  // the bake hook: the source hook first, the atlas position and the outputs spliced at the end
  const src = function (sh) { sh.fragmentShader = sh.fragmentShader.replace('//x', '//src'); };
  const hk = PK.bakeHook(src);
  check(hk === PK.bakeHook(src) && String(hk) !== String(src) && String(hk).indexOf(String(src)) >= 0, '8 one bake twin per source hook, keyed apart from it');
  const sh = { uniforms: {}, vertexShader: 'void main() {\n  gl_Position = vec4(0.0);\n}', fragmentShader: 'void main() {\n  //x\n}' };
  hk.call({ userData: { parkedBakeGlass: 0.12 } }, sh);
  check(/gl_Position = vec4\(aBakeUv \* 2\.0 - 1\.0/.test(sh.vertexShader) && sh.vertexShader.lastIndexOf('aBakeUv') > sh.vertexShader.indexOf('gl_Position = vec4(0.0)'), '8 the vertex lands at its atlas texel after the flown projection');
  check(/\/\/src/.test(sh.fragmentShader) && /uBakeOut/.test(sh.fragmentShader) && sh.uniforms.uBakeOut && near(sh.uniforms.uBakeGlass.value, 0.12, 1e-9), '8 the fragment runs the flown hook, then writes the bake');
  // the assembly: a stand-in renderer so build takes the baked door, the record's bake in hand
  const lvl = o => ({ pos: o.pos, nrm: o.nrm, uv: o.uv, idx: o.idx });
  const small = { pos: uw.pos, nrm: new Int8Array(Array.from(uw.nrm, v => Math.round(v * 127))), uv: uw.uv, idx: new Uint32Array(cut.idx) };
  const T = () => new Uint8Array(S * S * 4).fill(255);
  rec.baked = PK.bakedFrom(THREE, { S, tex: [T(), T(), T()], cc: false, ccR: 0.1,
    L: [lvl({ pos: uw.pos, nrm: small.nrm, uv: uw.uv, idx: uw.idx }), small, small] });
  PK.renderer = { isWebGLRenderer: true, readRenderTargetPixels() {} };
  try {
    const grp = new THREE.Group(); grp.position.set(3, 1, 2); grp.rotation.y = -0.4;
    const lod = PK.build(THREE, rec, grp);
    const meshes = L => { const m = []; lod.levels[L].object.traverse(o => { if (o.isMesh) m.push(o); }); return m; };
    for (const L of [1, 2, 3]) check(meshes(L).length === 1, '8 L' + L + ' is ONE draw', String(meshes(L).length));
    const mats = new Set([1, 2, 3].map(L => meshes(L)[0] && meshes(L)[0].material));
    const m = [...mats][0];
    check(mats.size === 1 && m.map && m.normalMap && m.normalMapType === THREE.ObjectSpaceNormalMap && m.roughnessMap === m.metalnessMap, '8 ...on ONE standard material: the atlas, an object-space normal, roughness / metalness');
    check(meshes(0).length > 3, '8 L0 is left as it was', String(meshes(0).length));
    grp.updateWorldMatrix(true, true);
    const v = new THREE.Vector3(), low = [];
    for (const L of [0, 1]) { let lo = Infinity; lod.levels[L].object.traverse(o => { if (!o.isMesh) return; const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); lo = Math.min(lo, v.y); } }); low.push(lo); }
    check(near(low[0], low[1], 1e-4), '8 the baked rung stands where the full one does', low.join(' vs '));
  } finally { PK.renderer = null; }
}

// ---- 7 the fixture ------------------------------------------------------------------------------
{
  const fx = path.join(TOOLS, 'fixtures', 'island_jolene.json');
  if (check(fs.existsSync(fx), '7 island_jolene.json exists')) {
    const J = JSON.parse(fs.readFileSync(fx, 'utf8'));
    const rec = J.premises || J;
    const objs = (rec.layers.objects || []).filter(o => o.kind === 'aircraft');
    check(objs.length >= 2, '7 the field parks at least two aeroplanes', String(objs.length));
    const design = fs.readFileSync(path.join(TOOLS, '_cage_design.js'), 'utf8');
    const flats = rec.layers.terrain.filter(t => t.kind === 'flatten');
    for (const ob of objs) {
      check(!!ob.key && /^(arch|stock|mine):/.test(ob.key), '7 ' + ob.id + ' names a build', ob.key);
      const m = /^arch:(\w+)$/.exec(ob.key || '');
      if (m) check(new RegExp("\\{ key: '" + m[1] + "', kind:").test(design), '7 ' + ob.id + ': archetype ' + m[1] + ' is declared');
      check(flats.some(t => PG.inPoly(t.poly, ob.x, ob.z)), '7 ' + ob.id + ' stands on a flatten', ob.x + ',' + ob.z);
    }
    check(PG.issues(PG.normalise(rec)).length === 0, '7 the fixture has no issues', PG.issues(PG.normalise(rec))[0]);
  }
}

farRungs().catch(e => check(false, '5b the far rungs threw', e && e.stack || String(e)))
  .then(() => paneLevels().catch(e => check(false, '6c the pane levels threw', e && e.stack || String(e))))
  .then(() => bakedRungs().catch(e => check(false, '8 the baked rungs threw', e && e.stack || String(e)))).then(() => {
  if (fail.length) {
    for (const f of fail.slice(0, 30)) console.log('  ! ' + f);
    if (fail.length > 30) console.log('  ... ' + (fail.length - 30) + ' more');
    console.log('GATE PARKED: FAIL (' + fail.length + ')');
    process.exit(1);
  }
  console.log('  ' + checks + ' checks');
  console.log('GATE PARKED: PASS');
});
