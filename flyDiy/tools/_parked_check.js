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
//   9  L0 shelved (G571): by default a placement has no L0 - L1 from 0 m, no
//      interior mesh built, the far rungs one index lower, and with the bake
//      ONE draw from 0 m; 5b / 6c / 8 switch PARKED.L0 on to prove the full
//      ladder the switch keeps
//   8  the far levels baked (G569): the unwrap, the cut per chart, the dilation,
//      the bake hook, and L1 / L2 / L3 each ONE mesh on ONE material
//   7  the fixture: every aircraft object in island_jolene.json names an
//      archetype the design table declares and stands inside a flatten
//  10  the cook (G805): the container both ways (atlases lossless, the cut
//      rungs to the bit, L1 within half a step), torn files refused, the
//      cooked record's ladder = the live bake's at the same placement, the
//      signature's inputs; the shipped manifest's files decode to its keys
//  12  the fleet (G2221-G2224), headless: the draw rules (the nearest 6, L1 within
//      30 m, the light presets' L3-only 4), the LRU (8 keys resident, the least
//      recently stood out, its holder emptied), the signature (the fingerprint +
//      the look), the flag off queues nothing
//  11  THE CAPTURE LEAK (G2220), the page in node (tools/_page_node.js, its 2D
//      canvases digested: tools/_c2d_digest.js; ~5 min): the same `mine:` spec
//      (and arch:c172, G809's case) captured under the user's Cub and under the
//      metal Cessna - the geometry's bytes and the atlas's (the copy's digest +
//      the block's numbers) identical; PARKED.cleanCapture = false re-opens the
//      leak and the row goes red (the negative control, every run)
//  13  THE FLEET STOOD (G2225, fleet_stand.js), headless: the ledger's rows tied down
//      outside on the cooked spots, by slot name, the flown one's spot left empty, a
//      resident not drawn, a full field counted; the holders at the spots on the
//      ground; kept / re-stood; one decode a key; potato's L3 alone (GQ9); the flag
//      off stands nothing; source scans (no capture / bake; the parking step; the build)
//  12p THE FLEET in the page: a save queues, the garage's idle path captures and
//      bakes (a synthetic bake: no GPU here) and stores under the signature; with
//      the world up (flying, the roll-out screen) nothing is captured or baked,
//      a roll-out only decodes, a key with no bake stands nothing, back in the
//      garage the queue drains; the world's doors hold no capture / bake call
//
// --pure (or PARKED_PURE=1): 1-10, 12 and 13 only (seconds)
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
check(PK.L0 === false, '9 L0 is off by default (G571): L1 stands from 0 m');
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
  PK.L0 = true;
  const lod = PK.build(THREE, rec, grp);
  PK.L0 = false;
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
    PK.L0 = true;
    const lod = PK.build(THREE, rec, new THREE.Group());
    PK.L0 = false;
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
    PK.L0 = true;
    const lod = PK.build(THREE, rec, grp);
    PK.L0 = false;
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
    // 9 the default (L0 shelved) with the bake in hand: the baked L1 from 0 m, one draw a rung, on the same ground
    const g9 = new THREE.Group(); g9.position.set(3, 1, 2); g9.rotation.y = -0.4;
    const lod9 = PK.build(THREE, rec, g9);
    const m9 = L => { const m = []; lod9.levels[L].object.traverse(o => { if (o.isMesh) m.push(o); }); return m; };
    check(lod9.levels.length === 4 && lod9.levels[0].distance === 0, '9 baked, no L0: four rungs, L1 from 0 m', lod9.levels.map(l => l.distance).join(' / '));
    check([0, 1, 2].every(L => m9(L).length === 1 && m9(L)[0].material === m), '9 ...each ONE draw on the bake\'s one material', [0, 1, 2].map(L => m9(L).length).join(' / '));
    g9.updateWorldMatrix(true, true);
    let lo9 = Infinity; lod9.levels[0].object.traverse(o => { if (!o.isMesh) return; const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); lo9 = Math.min(lo9, v.y); } });
    check(near(lo9, low[0], 1e-4), '9 ...standing where the full ladder does', lo9 + ' vs ' + low[0]);
  } finally { PK.renderer = null; }
}

// ---- 9 L0 shelved (G571): the default ladder, headless (no bake) ------------------------------
async function shelvedL0() {
  const vis = synthVis('tail');
  const rec = record('noL0', vis);
  const grp = new THREE.Group(); grp.position.set(-4, 2, 7); grp.rotation.y = 1.1;
  const lod = PK.build(THREE, rec, grp);
  check(lod.isLOD && lod.levels.length === 4, '9 a four-rung LOD', String(lod.levels.length));
  check(lod.levels[0].distance === 0 && near(lod.levels[1].distance, PK.LEVELS.L2, 0) && near(lod.levels[2].distance, PK.LEVELS.L3, 0) && near(lod.levels[3].distance, PK.LEVELS.cull, 0),
    '9 L1 from 0 m, L2 / L3 / cull at their declared distances', lod.levels.map(l => l.distance).join(' / '));
  const interior = Object.keys(vis.mats).filter(k => PK.isInterior(vis.mats[k]));
  const built = new Set(); lod.traverse(o => { if (o.isMesh && o.geometry) built.add(o.geometry); });
  const made = interior.map(k => rec.geos.get(vis.groups[k])).filter(Boolean);
  check(interior.length > 0 && made.length === 0 && built.size > 0, '9 no interior bucket is built for any rung', interior.join(',') + ': ' + made.length + ' built');
  const t0 = Date.now();
  while (!rec.far && Date.now() - t0 < 30000) await new Promise(r => setTimeout(r, 50));
  if (!check(!!rec.far, '9 the far levels land without L0')) return;
  await new Promise(r => setTimeout(r, 20));
  const count = g => { let n = 0; g.traverse(o => { if (o.isMesh) n++; }); return n; };
  check(count(lod.levels[2].object) <= 3 && count(lod.levels[2].object) >= 2, '9 the far rungs one index lower: L3 at index 2', String(count(lod.levels[2].object)));
  grp.updateWorldMatrix(true, true);
  const v = new THREE.Vector3();
  for (const li of [0, 1, 2]) {
    let low = Infinity;
    lod.levels[li].object.traverse(m => { if (!m.isMesh) return; const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) { v.set(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(m.matrixWorld); if (v.y < low) low = v.y; } });
    check(near(low - grp.position.y, 0, 0.015), '9 rung ' + li + ' stands on the ground', String(low - grp.position.y));
  }
  check(!!(lod.userData.craftInv && lod.userData.craftInv.value), '9 the placement has its craft matrix');
}

// ---- 10 the cook (G805) ------------------------------------------------------------------------
// The container both ways on a synthetic bake cut by the page's own cutBaked (the inline door headless): the atlases
// lossless, the cut rungs' positions to the bit (they are the lattice the container quantizes on), L1 within half a
// step, the uv within 1/65535, the normals and the index exact; a misaligned buffer decodes, a torn one refuses; the
// cooked record stands the SAME ladder as the live bake - four rungs, one draw each on one material, every rung mesh
// at the live placement's matrix; the signature moves with the build, this file and the spec; headless (no fetch) the
// cook is out of the way. Then the shipped manifest, when there is one: every file there, one gzip stream, its header
// the manifest's key and signature (a manifest cooked on another build is reported, not failed: the page captures live).
async function cookRungs() {
  const vis = synthVis('tail');
  const rec = record('arch:cooktest', vis);
  const ext = PK.exteriorMesh(rec);
  const uw = PK.unwrap(ext, { S: 64, gutter: 1 });
  if (!check(!!uw, '10 the synthetic exterior unwraps')) return;
  const rungs = await new Promise((res, rej) => PK.cutBaked(uw, (r, err) => r ? res(r) : rej(new Error(err))));
  const S = 64, n = S * S;
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) >>> 24;
  const T = () => { const t = new Uint8Array(n * 4); for (let i = 0; i < n; i++) { t[i * 4] = rnd(); t[i * 4 + 1] = rnd(); t[i * 4 + 2] = rnd(); t[i * 4 + 3] = 255; } return t; };
  const n8 = new Int8Array(Array.from(uw.nrm, v => Math.max(-127, Math.min(127, Math.round(v * 127)))));
  const data = { S, tex: [T(), T(), T()], cc: true, ccR: 0.2, ms: 5, stats: { charts: uw.charts },
                 L: [{ pos: uw.pos, nrm: n8, uv: uw.uv, idx: uw.idx }].concat(rungs) };
  const st = PK.stance(vis), hb = PK.hitboxOf(rec, st);
  const u8 = PK.cookEncode({ key: 'arch:cooktest', sig: 'sig1', build: 'b1', stance: st, hitbox: hb, tris: 321, data });
  check(u8[0] === 0x50 && u8[3] === 0x31 && u8.length < 8 + 4096 + n * 9 + data.L.reduce((a, l) => a + l.pos.length * 2 + l.nrm.length + l.uv.length * 2 + l.idx.length * 4 + 16, 0),
    '10 the container: PKC1, the atlases as RGB, the geometry quantized', u8.length + ' bytes');
  const d = PK.cookDecode(u8);
  check(d.hdr.key === 'arch:cooktest' && d.hdr.sig === 'sig1' && d.hdr.tris === 321 && JSON.stringify(d.hdr.hitbox) === JSON.stringify(hb) && d.hdr.stance.pitch === st.pitch,
    '10 the header round trips (key, signature, stance, hitbox)');
  check([0, 1, 2].every(k => d.tex[k].length === n * 4 && d.tex[k].every((v, i) => v === data.tex[k][i])), '10 the three atlases come back byte for byte (alpha restored)');
  const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  check(d.L.length === 3 && [1, 2].every(i => same(d.L[i].pos, data.L[i].pos)), '10 the cut rungs\' positions come back to the bit',
    [1, 2].map(i => d.L[i].pos.reduce((m, v, j) => Math.max(m, Math.abs(v - data.L[i].pos[j])), 0)).join(' / '));
  const bb = [0, 1, 2].map(a => { let lo = Infinity, hi = -Infinity; for (let j = a; j < uw.pos.length; j += 3) { lo = Math.min(lo, uw.pos[j]); hi = Math.max(hi, uw.pos[j]); } return Math.max(hi - lo, 1e-3); });
  const e1 = d.L[0].pos.reduce((m, v, j) => Math.max(m, Math.abs(v - data.L[0].pos[j]) / (bb[j % 3] / 65535)), 0);
  check(e1 <= 0.5001, '10 L1 within half a quantization step', e1.toFixed(4) + ' steps');
  const eu = Math.max(...d.L.map((l, i) => l.uv.reduce((m, v, j) => Math.max(m, Math.abs(v - data.L[i].uv[j])), 0)));
  check(eu <= 0.5 / 65535 + 1e-7, '10 the atlas uv within half of 1/65535', String(eu));
  check(d.L.every((l, i) => same(l.nrm, data.L[i].nrm) && same(l.idx, data.L[i].idx)), '10 the normals and the index exact');
  const off = new Uint8Array(u8.length + 1); off.set(u8, 1);
  let okMis = false; try { const d2 = PK.cookDecode(off.subarray(1)); okMis = same(d2.L[1].pos, d.L[1].pos) && same(d2.tex[0], d.tex[0]); } catch (e) {}
  check(okMis, '10 a misaligned buffer decodes the same');
  let torn = 0;
  try { PK.cookDecode(u8.subarray(0, u8.length - 64)); } catch (e) { torn++; }
  const bad = u8.slice(); bad[0] = 0; try { PK.cookDecode(bad); } catch (e) { torn++; }
  const a254 = { S, tex: [T(), T(), T()], cc: false, ccR: 0.1, L: data.L }; a254.tex[1][7] = 254;
  try { PK.cookEncode({ key: 'k', sig: 's', stance: st, hitbox: hb, tris: 1, data: a254 }); } catch (e) { torn++; }
  check(torn === 3, '10 a short file, a wrong magic and an atlas with alpha < 255 are refused', torn + ' of 3');
  // the cooked record against the live bake of the same data, at the same placement
  const live = record('arch:cooktest', vis);
  live.baked = PK.bakedFrom(THREE, data);
  const cooked = PK.cookRecord(THREE, d);
  check(cooked.cooked && cooked.baked && cooked.baked.tris.join() === live.baked.tris.join(), '10 the cooked record carries the baked rungs', cooked.baked.tris.join(' / '));
  PK.renderer = { isWebGLRenderer: true, readRenderTargetPixels() {} };
  try {
    const place = r => { const g = new THREE.Group(); g.position.set(-7, 2, 5); g.rotation.y = 0.9; return [g, PK.build(THREE, r, g)]; };
    const [gL, lodL] = place(live), [gC, lodC] = place(cooked);
    gL.updateWorldMatrix(true, true); gC.updateWorldMatrix(true, true);
    check(lodC.levels.length === 4 && lodC.levels.map(l => l.distance).join() === lodL.levels.map(l => l.distance).join(), '10 the cooked ladder: the live one\'s rungs and distances',
      lodC.levels.map(l => l.distance).join(' / ') + ' vs ' + lodL.levels.map(l => l.distance).join(' / '));
    const ms = (lod, L) => { const m = []; lod.levels[L].object.traverse(o => { if (o.isMesh) m.push(o); }); return m; };
    const mc = [0, 1, 2].map(L => ms(lodC, L)), ml = [0, 1, 2].map(L => ms(lodL, L));
    check(mc.every(m => m.length === 1) && new Set(mc.map(m => m[0].material)).size === 1, '10 ...each ONE draw on ONE material', mc.map(m => m.length).join(' / '));
    let dm = 0; for (let L = 0; L < 3; L++) if (ml[L][0]) { const a = mc[L][0].matrixWorld.elements, b = ml[L][0].matrixWorld.elements; for (let i = 0; i < 16; i++) dm = Math.max(dm, Math.abs(a[i] - b[i])); }
    check(ml.every(m => m.length === 1) && dm < 1e-12, '10 ...each rung at the live placement\'s matrix (the stance)', String(dm));
    check(JSON.stringify(PK.hitbox(gC)) === JSON.stringify(PK.hitbox(gL)) && lodC.userData.cooked === 1, '10 the cooked placement\'s hitbox is the live one');
    const m0 = mc[0][0].material;
    check(m0.isMeshPhysicalMaterial && m0.clearcoatMap === m0.roughnessMap && m0.map.image.data === cooked.baked.mat.map.image.data, '10 the material is the bake\'s (clear coat from the gloss map)');
  } finally { PK.renderer = null; }
  // the signature
  const sp = { cage: { a: 1 } };
  const s0 = PK.cookSig('arch:x', sp);
  W.FLYDIY_BUILD = 'other'; const s1 = PK.cookSig('arch:x', sp); delete W.FLYDIY_BUILD;
  check(!!s0 && s0 === PK.cookSig('arch:x', sp) && s1 !== s0 && PK.cookSig('arch:x', { cage: { a: 2 } }) !== s0 && PK.cookSig('arch:y', sp) !== s0 && PK.cookSig('arch:x', null) === null,
    '10 the signature: stable; moves with the build, the spec and the key; none without a spec');
  const src = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'parked.js'), 'utf8');
  check(/\(function parkedJs\(\)/.test(src) && /selfHash\(\)/.test(src.slice(src.indexOf('function cookSig'), src.indexOf('function cookSig') + 600)), '10 the signature hashes parked.js itself (the world pack is not in FLYDIY_BUILD)');
  check(PK.cookable('arch:cub') === false && PK.COOK.pending === 0, '10 headless (no fetch) the cook stands aside: captured as before');
  // the shipped cook
  const MF = path.join(ROOT, 'src', 'core', 'parked_packs.json');
  if (fs.existsSync(MF)) {
    const man = JSON.parse(fs.readFileSync(MF, 'utf8')), zlib = require('zlib');
    const keys = Object.keys(man.keys || {});
    check(keys.length > 0, '10 the manifest names cooked keys', keys.join(','));
    for (const k of keys) {
      const e = man.keys[k], f = path.join(ROOT, ...String(e.src).split('/'));
      if (!check(/^media\/parked\/[\w.]+\.gz\.bin$/.test(e.src) && fs.existsSync(f), '10 ' + k + ': its file is in media/parked', e.src)) continue;
      let dk = null, why = ''; try { dk = PK.cookDecode(new Uint8Array(zlib.gunzipSync(fs.readFileSync(f)))); } catch (x) { dk = null; why = x && x.message; }
      check(dk && dk.hdr.key === k && dk.hdr.sig === e.sig && dk.hdr.build === man.build && dk.L.length === 3, '10 ' + k + ': one gzip stream, its header the manifest\'s', dk ? dk.hdr.key + ' ' + dk.hdr.sig : 'no decode: ' + why);
    }
    const ver = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8')).build; } catch (x) { return null; } })();
    console.log('  the cook: ' + keys.length + ' keys, cooked on build ' + man.build + (ver && ver !== man.build ? ' - STALE for this build (' + ver + '): the page captures live until tools/parked_cook.js runs' : ' (this build)'));
  }
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

// ---- 12 THE FLEET, headless (G2221-G2224) -------------------------------------------------------------
// a synthetic bake (the box soup as all three rungs, deterministic atlases) in a realm R's typed arrays
function synthBake(R, seed) {
  const g = box(-3, -0.6, -0.5, 3, 0.6, 0.5, 2, false), S = 16, n = S * S;
  let q = seed >>> 0; const rnd = () => (q = (q * 1103515245 + 12345) >>> 0) >>> 24;
  const T = () => { const t = new R.Uint8Array(n * 4); for (let i = 0; i < n; i++) { t[i * 4] = rnd(); t[i * 4 + 1] = rnd(); t[i * 4 + 2] = rnd(); t[i * 4 + 3] = 255; } return t; };
  const nv = g.pos.length / 3, nrm = new R.Int8Array(nv * 3), uv = new R.Float32Array(nv * 2);
  for (let i = 0; i < nv * 3; i++) nrm[i] = Math.round(g.nrm[i] * 127);
  for (let i = 0; i < nv; i++) { uv[i * 2] = (i % 13) / 13; uv[i * 2 + 1] = (i % 7) / 7; }
  const L = () => ({ pos: new R.Float32Array(g.pos), nrm: new R.Int8Array(nrm), uv: new R.Float32Array(uv), idx: new R.Uint32Array(g.idx) });
  return { S, tex: [T(), T(), T()], cc: true, ccR: 0.2, ms: 1, stats: { charts: 1 }, L: [L(), L(), L()] };
}
const memStore = () => { const m = new Map(); return { m, get: k => Promise.resolve(m.has(k) ? m.get(k) : null), put: (k, v) => { m.set(k, v); return Promise.resolve(); } }; };
async function fleetHeadless() {
  const FD = PK.FLEET_DRAW;
  check(FD.max === 6 && FD.l1 === 30 && FD.lightMax === 4 && FD.resident === 8 && ['potato', 'laptop', 'pocket'].every(p => FD.light.includes(p)),
    '12 the fleet\'s draw rules as data: 6 drawn, L1 within 30 m, potato / laptop / pocket L3-only at most 4, 8 resident', JSON.stringify(FD));
  // the count: ten props on a line 0..90 m, the camera at 0 - the nearest six (four on a light preset), nearest first
  const pts = [5, 0, 8, 2, 9, 1, 7, 3, 6, 4].map(k => [k * 10, 0, 0]);
  const pk = PK.fleetPick([0, 1.7, 0], pts, false), pl = PK.fleetPick([0, 1.7, 0], pts, true);
  check(JSON.stringify(pk.drawn) === JSON.stringify([1, 5, 3, 7, 9, 0]) && pk.max === 6, '12 fleetPick: the nearest 6 drawn, nearest first', pk.drawn.join(','));
  check(JSON.stringify(pl.drawn) === JSON.stringify([1, 5, 3, 7]) && pl.max === 4, '12 fleetPick on a light preset: the nearest 4', pl.drawn.join(','));
  const tie = PK.fleetPick([0, 0, 0], [[10, 0, 0], [-10, 0, 0], [0, 0, 10]], false);
  check(JSON.stringify(tie.drawn) === '[0,1,2]', '12 fleetPick is deterministic on a tie (by order)');
  check(JSON.stringify(PK.fleetLadder(false)) === JSON.stringify([[0, 0], [1, 30], [2, PK.LEVELS.L3]]) && JSON.stringify(PK.fleetLadder(true)) === JSON.stringify([[2, 0]]),
    '12 the fleet ladder: L1 to 30 m, L2 to 450 m, L3 on; a light preset L3 alone', JSON.stringify(PK.fleetLadder(false)) + ' / ' + JSON.stringify(PK.fleetLadder(true)));
  // the flag off: a save queues nothing
  W.GARAGE_SPEC = { slotSpec: n => ({ cage: { boomLen: 4 + n.length / 10 }, meta: { name: n }, finish: { body: '#c0ffee' } }), slotImages: () => null, cageDefaults: () => null };
  check(PK.fleetOn() === false && PK.fleetQueue('a') === false && PK.fleet.queue.length === 0, '12 FLYDIY_FLEET off (the default): a save queues nothing');
  // the signature: the spec's fingerprint plus the look
  const sp = PK.specOf('mine:abc'), s0 = PK.fleetSig(sp, null);
  const sp2 = JSON.parse(JSON.stringify(sp)); sp2.finish.body = '#000000';
  const sp3 = JSON.parse(JSON.stringify(sp)); sp3.cage.boomLen += 0.1;
  check(!!s0 && s0 === PK.fleetSig(JSON.parse(JSON.stringify(sp)), null) && PK.fleetSig(sp2, null) !== s0 && PK.fleetSig(sp3, null) !== s0 && PK.fleetSig(sp, { 1: { data: 'data:image/png;base64,AA' } }) !== s0,
    '12 the fleet signature: stable; moves with the spec, the finish and the picture pages');
  // THE LRU: ten slots baked into a store, all stood: 8 resident, the first two out (their holders emptied, pending again)
  W.FLYDIY_FLEET = true;
  const st = memStore(); PK.fleet.store = st;
  const names = 'abcdefghij'.split('');
  for (const [i, nm] of names.entries()) {
    const key = 'mine:' + nm, spec = PK.specOf(key), sig = PK.fleetSig(spec, null);
    const rec = record(key, synthVis('tail')), stc = PK.stance(rec.vis);
    const u8 = PK.cookEncode({ key, sig, build: 'b', stance: stc, hitbox: PK.hitboxOf(rec, stc), tris: 100 + i, data: synthBake(globalThis, i + 1) });
    await st.put(key, { sig, n: u8.length, bytes: u8, when: 0 });
  }
  const holders = [];
  for (const nm of names) { const g = PK.place(THREE, 'mine:' + nm, 0, 0, 0, 0); new THREE.Group().add(g); holders.push(g); await PK.fleetLoad('mine:' + nm); }
  const res = Object.keys(PK.records).filter(k => PK.records[k] && PK.records[k].fleet);
  check(res.length === 8 && !res.includes('mine:a') && !res.includes('mine:b') && PK.fleet.stats.evicted === 2, '12 the LRU: 8 keys resident of 10 stood, the two least recent out',
    res.length + ' resident, evicted ' + PK.fleet.stats.evicted + ': ' + res.join(' '));
  check(holders[0].children.length === 0 && holders[2].children.length === 1 && PK.pending.some(p => p.key === 'mine:a'), '12 ...an evicted key\'s holder is emptied and pending again');
  const lod = holders[9].children[0];
  check(!!lod && lod.isLOD && lod.levels.map(l => l.distance).join() === [0, 30, PK.LEVELS.L3, PK.LEVELS.cull].join(), '12 a fleet prop stands the fleet ladder (L1 to 30 m)', lod ? lod.levels.map(l => l.distance).join(' / ') : 'none');
  await PK.fleetLoad('mine:a');
  check(!!(PK.records['mine:a'] && PK.records['mine:a'].fleet) && holders[0].children.length === 1 && !PK.records['mine:c'], '12 ...stood again it decodes again (and the next least recent goes)');
  // the count on the placed props: the camera at the first holder, ten holders 20 m apart - six drawn
  holders.forEach((g, i) => { g.position.set(i * 20, 0, 0); g.parent.updateMatrixWorld(true); });
  const scene = new THREE.Scene(); for (const g of holders) scene.add(g.parent);
  const cam = new THREE.PerspectiveCamera(); cam.position.set(-5, 2, 0); cam.updateMatrixWorld(true); scene.updateMatrixWorld(true);
  let drawn = 0;
  for (const g of holders) { const l = g.children[0]; if (!l) continue; l.update(cam); if (l.levels.some(v => v.object.visible)) drawn++; }
  check(drawn === 6, '12 of the stood fleet props the nearest six are drawn', drawn + ' drawn');
  W.FLYDIY_FLEET = false; PK.fleet.store = null; delete W.GARAGE_SPEC;
  for (const k of Object.keys(PK.records)) if (PK.records[k] && PK.records[k].fleet) delete PK.records[k];
  PK.pending.length = 0; PK.fleet.lru.length = 0; PK.fleet.placed.length = 0;
}

// ---- 13 THE FLEET STOOD (G2225, FLEET-STAND: src/viewer/fleet_stand.js), headless --------------------------------------
// the ledger's rows tied down outside, on the cooked spots (src/viewer/fleet_spots_pack.js) through PARKED.place: the
// flag off stands nothing; the planner's order by slot name, the flown one's spot left EMPTY (no one else moves), a
// hangar's resident not drawn, a row past the spots or on another world counted; THE DRAWN SET (the roll-out's aerodrome,
// the first `cap` by name, the flown one counted in it) and THE QUEUE'S BOUND (wants: a 40-build sandbox bakes at most the
// cap; one bake per idle window - input waits); the holders at the spot's x / z / ry on the world's ground (the water's
// over a lake); the same set kept, another set re-stood with the old holders out of the count; one decode a key in
// flight; on a light preset the L3 rung alone and at most 4, although the budget builds no parked bake (GQ9)
async function fleetStood() {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'fleet_spots_pack.js'), 'utf8'), W, { filename: 'fleet_spots_pack.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'fleet_stand.js'), 'utf8'), W, { filename: 'fleet_stand.js' });
  const FS = W.FLEET_STAND, PACK = W.FLEET_SPOTS_PACK;
  check(!!FS && !!PACK && PACK.island === 'jolene' && (PACK.aero.HOME || []).length >= 6, '13 the stand and the cooked spots load (HOME has room for six)', PACK ? Object.keys(PACK.aero).map(k => k + ' ' + PACK.aero[k].length).join(', ') : 'no pack');
  const names = ['fleet-1-cub', 'fleet-2-jodel', 'fleet-3-c172', 'fleet-4-c172floats', 'fleet-5-twinfloats', 'fleet-6-metal'];
  const doc = { fleet: {} }; for (const n of names) doc.fleet[n] = { hangar: null, aero: 'HOME', outSince: 0 };
  doc.fleet['in-shed'] = { hangar: 'HOME', aero: 'HOME' };
  doc.fleet['at-w3'] = { hangar: null, aero: 'w3' };
  doc.fleet['at-tw'] = { hangar: null, aero: 'tw_ski' };          // no room there: counted, never a bad spot
  const P = FS.plan(doc, null, PACK, 'jolene');
  const H = PACK.aero.HOME;
  check(P.stand.filter(p => p.aero === 'HOME').map(p => p.slot + '@' + p.spot).join() === names.map((n, i) => n + '@' + H[i][3]).join(),
    "13 the plan: HOME's rows by slot name on HOME's spots in the planner's order (the painted stand first)", P.stand.map(p => p.slot + '@' + p.spot).join(' '));
  check(!P.stand.some(p => p.slot === 'in-shed') && P.stand.some(p => p.slot === 'at-w3' && p.spot === PACK.aero.w3[0][3]), "13 ...a hangar's resident is not stood; a row out at w3 takes w3's first spot");
  check(P.miss.length === 1 && P.miss[0].slot === 'at-tw' && /no spots at tw_ski/.test(P.miss[0].why), '13 ...a row at a field with no room stands nothing and is counted', JSON.stringify(P.miss));
  const Pf = FS.plan(doc, 'fleet-1-cub', PACK, 'jolene');
  check(!Pf.stand.some(p => p.slot === 'fleet-1-cub') && Pf.stand.filter(p => p.aero === 'HOME').every(p => p.spot === P.stand.find(q => q.slot === p.slot).spot),
    '13 ...the flown airframe stands nothing and its spot stays empty: no other prop moves');
  check(FS.plan(doc, null, PACK, 'jolene', 3).stand.map(p => p.slot).join() === P.stand.slice(0, 3).map(p => p.slot).join() && FS.plan(doc, null, PACK, null).stand.length === 0 && FS.plan(doc, null, PACK, 'other').miss.length === 8,
    '13 ...?fleetn=3 stands the first three; another world (no pack for it) stands none');
  // THE DRAWN SET: the roll-out's aerodrome, the first `cap` by name, the flown one counted
  const big = { fleet: {} }; for (let i = 0; i < 40; i++) big.fleet['b' + String(i).padStart(2, '0')] = { hangar: null, aero: 'HOME' };
  big.fleet['zz-w3'] = { hangar: null, aero: 'w3' };
  const D6 = FS.plan(big, null, PACK, 'jolene', null, 'HOME', 6), D6f = FS.plan(big, 'b00', PACK, 'jolene', null, 'HOME', 6), D4 = FS.plan(big, null, PACK, 'jolene', null, 'HOME', 4);
  check(D6.stand.map(p => p.slot).join() === 'b00,b01,b02,b03,b04,b05' && D6.held.length === 7 && D6.held.some(h => h.slot === 'zz-w3' && /aerodrome/.test(h.why)) && D6.held.filter(h => /draw cap/.test(h.why)).length === 6 && D6.miss.length === 28,
    "13 THE DRAWN SET: the roll-out's aerodrome's first six of 40 (held: past the cap / another aerodrome; past HOME's 12 spots: no spot)", D6.stand.map(p => p.slot).join(',') + '; held ' + D6.held.length + ', no spot ' + D6.miss.length);
  check(D6f.stand.map(p => p.slot).join() === 'b01,b02,b03,b04,b05' && D4.stand.length === 4, '13 ...the flown one counts in the cap (five stood beside it); a light preset\'s cap 4', D6f.stand.map(p => p.slot).join(','));
  // THE QUEUE'S BOUND: wants() = the drawn set with the airframe on the stand counted in it; a 40-build sandbox queues 6
  const world = { island: { id: 'jolene' }, terrainH: (x, z) => 30 + 0.001 * x, waterH: (x, z) => (x > 800 ? 40 : NaN) };
  FS.setCtx(() => ({ world, doc: big, flown: 'b00', from: 'HOME', cap: 6 }));
  check(FS.wants('mine:b00') && FS.wants('mine:b05') && !FS.wants('mine:b06') && !FS.wants('mine:zz-w3'), "13 wants(): the drawn set and the airframe on the stand (b00..b05); not b06, not another aerodrome's");
  W.FLYDIY_FLEET = true;
  const q0 = PK.fleet.stats.queued, nw0 = PK.fleet.stats.notWanted;
  for (const n of Object.keys(big.fleet)) PK.fleetQueue(n);
  check(PK.fleet.stats.queued - q0 === 6 && PK.fleet.queue.length === 6 && PK.fleet.stats.notWanted - nw0 === 35, '13 THE BOUND: 41 saves in a 40-build sandbox queue six bakes (35 refused: not drawn)',
    (PK.fleet.stats.queued - q0) + ' queued, ' + (PK.fleet.stats.notWanted - nw0) + ' refused');
  // ONE BAKE PER IDLE WINDOW: an input under FLEET.idleMs ago - the step waits (nothing taken off the queue)
  clearTimeout(PK.fleet.timer); PK.fleet.timer = null;
  PK.fleet.inputAt = performance.now(); const iw0 = PK.fleet.stats.inputWaits, ql = PK.fleet.queue.length;
  PK.fleetStep();
  check(PK.fleet.idleMs >= 3000 && PK.fleet.stats.inputWaits === iw0 + 1 && PK.fleet.queue.length === ql && !PK.fleet.busy, '13 ONE BAKE PER IDLE WINDOW: input 0 s ago - the step waits (3 s of no input)', 'idleMs ' + PK.fleet.idleMs);
  clearTimeout(PK.fleet.timer); PK.fleet.timer = null; PK.fleet.queue.length = 0; PK.fleet.inputAt = -1e9;
  // ...and a pointer HELD DOWN (a slider held still past the window) is still a drag: nothing starts
  PK.fleet.queue.push('mine:b01'); PK.fleet.down = true; const iw1 = PK.fleet.stats.inputWaits;
  PK.fleetStep();
  check(PK.fleet.stats.inputWaits === iw1 + 1 && PK.fleet.queue.length === 1 && !PK.fleet.busy, '13 ...a pointer held down (no input for 3 s, the slider held still): the step still waits');
  clearTimeout(PK.fleet.timer); PK.fleet.timer = null; PK.fleet.queue.length = 0; PK.fleet.down = false;
  // a queued key that left the drawn set while it waited is dropped at its turn
  PK.fleet.queue.push('mine:b06'); const nw1 = PK.fleet.stats.notWanted;
  PK.fleetStep();
  check(PK.fleet.queue.length === 0 && PK.fleet.stats.notWanted === nw1 + 1 && !PK.fleet.busy, '13 ...a queued key no longer drawn is dropped at its turn, not baked');
  clearTimeout(PK.fleet.timer); PK.fleet.timer = null; PK.fleet.queue.length = 0;
  FS.setCtx(null); W.FLYDIY_FLEET = false;
  // the flag off: nothing (the key the step had)
  const scene = new THREE.Scene();
  check(W.FLYDIY_FLEET !== true && FS.key({ world, doc, flown: null }) === '', "13 FLYDIY_FLEET off: the parking step's key is what it was");
  const r0 = await FS.stand({ THREE, scene, world, doc, flown: null });
  check(r0 === null && scene.children.length === 0, '13 FLYDIY_FLEET off: nothing stood');
  // the flag on, the bakes in a store: every row stood at its spot, decoded
  W.FLYDIY_FLEET = true;
  W.GARAGE_SPEC = { slotSpec: n => ({ cage: { boomLen: 4 + n.length / 10 }, meta: { name: n } }), slotImages: () => null, cageDefaults: () => null };
  const st = memStore(); PK.fleet.store = st;
  const all = Object.keys(doc.fleet);
  for (const [i, nm] of all.entries()) {
    const key = 'mine:' + nm, spec = PK.specOf(key), sig = PK.fleetSig(spec, null);
    const rec = record(key, synthVis('tail')), stc = PK.stance(rec.vis);
    const u8 = PK.cookEncode({ key, sig, build: 'b', stance: stc, hitbox: PK.hitboxOf(rec, stc), tris: 100 + i, data: synthBake(globalThis, i + 7) });
    await st.put(key, { sig, n: u8.length, bytes: u8, when: 0 });
  }
  const d0 = PK.fleet.stats.decodes;
  const ALL = { THREE, scene, world, doc, from: null, cap: 99 };   // every aerodrome, no cap: the stand's mechanics
  const P1 = await FS.stand(Object.assign({}, ALL, { flown: null, waitMs: 5000 }));
  const S = FS.state, g = S.grp;
  check(!!g && g.parent === scene && S.holders.length === 7 && S.holders.every(h => h.children.length === 1 && h.children[0].isLOD),
    '13 the flag on: every stood row a filled holder (decoded) in one group in the scene', S.holders.length + ' holders, ' + S.holders.filter(h => h.children.length).length + ' filled');
  const ok = P1.stand.every((p, i) => { const h = S.holders[i]; const y = Math.max(world.terrainH(p.x, p.z), Number.isFinite(world.waterH(p.x, p.z)) ? world.waterH(p.x, p.z) : -1e9);
    return h.userData.fleetSlot === p.slot && h.userData.parkedKey === 'mine:' + p.slot && near(h.position.x, p.x, 1e-9) && near(h.position.z, p.z, 1e-9) && near(h.position.y, y, 1e-9) && near(h.rotation.y, p.ry, 1e-9); });
  check(ok, '13 ...each at its spot: x, z, the yaw, on the ground (the water where it is higher)');
  { let auto = 0, n = 0; g.traverse(o => { n++; if (o.matrixAutoUpdate) auto++; });
    check(auto === 0 && n > 7 && S.holders.every(h => { const e = h.matrixWorld.elements; return near(e[12], h.position.x, 1e-6) && near(e[14], h.position.z, 1e-6); }),
      '13 ...STATIC: every object of the fleet group frozen (matrixAutoUpdate off), its world matrices made (the holders at their spots)', auto + ' of ' + n + ' still auto'); }
  { const sp0 = PK.specOf('mine:fleet-1-cub'), g0 = W.GARAGE_SPEC.cageDefaults, s0 = PK.fleetSig(sp0, null);
    W.GARAGE_SPEC.cageDefaults = () => ({ boomLen: 9.9, wingSpan: 1 }); const s1 = PK.fleetSig(sp0, null); W.GARAGE_SPEC.cageDefaults = g0;
    check(s0 === s1, "13 the bake's signature is the slot's alone: the garage's live cage defaults (the build on the stand) do not move it"); }
  check(PK.fleet.stats.decodes - d0 === 7, "13 ...ONE decode a key although two doors asked (place() and the stand's wait)", (PK.fleet.stats.decodes - d0) + ' decodes');
  // the same set: kept
  const st0 = S.stats.stands;
  await FS.stand(Object.assign({}, ALL, { flown: null }));
  check(S.stats.stands === st0 && S.grp === g, '13 the same set at the next roll-out: kept (nothing re-stood)');
  // another set (the Cub rolled out): re-stood; the old holders leave the count
  const old = S.holders.slice();
  await FS.stand(Object.assign({}, ALL, { flown: 'fleet-1-cub' }));
  check(S.grp !== g && !g.parent && old.every(h => !h.parent) && S.holders.length === 6 && !S.holders.some(h => h.userData.fleetSlot === 'fleet-1-cub'),
    '13 another set (the Cub flown): re-stood without it, the old group and holders out of the scene');
  scene.updateMatrixWorld(true);
  const cam = new THREE.PerspectiveCamera(); cam.position.set(H[1][0], 32, H[1][1]); cam.updateMatrixWorld(true);
  PK.fleet.rankAt = -1e9;
  for (const h of S.holders) h.children[0].update(cam);
  check(PK.fleet.placed.length === 6 && PK.fleet.placed.every(l => l.parent && l.parent.parent && l.parent.parent.parent === scene), '13 ...the count holds only the holders in the scene', PK.fleet.placed.length + ' placed');
  // a light preset at HOME: the cap 4, the L3 rung alone, although the budget builds no parked bake (the GQ9 exception)
  W.GFX = { get: () => ({ preset: 'potato', build: 'potato' }), budget: () => ({ parked: false }) };
  FS.clear();
  for (const k of Object.keys(PK.records)) if (PK.records[k] && PK.records[k].fleet) delete PK.records[k];   // decoded again: the ladder is the record's build
  await FS.stand({ THREE, scene, world, doc, flown: null, from: 'HOME' });
  check(PK.fleetCap() === 4 && S.holders.length === 4 && S.holders.every(h => h.children[0] && h.children[0].levels.length === 2 && h.children[0].levels[0].distance === 0),
    '13 potato: the cap 4 at HOME, every prop on the L3 rung alone (GFX.budget().parked false does not stop the fleet: GQ9)', 'cap ' + PK.fleetCap() + ', ' + S.holders.map(h => h.children[0] ? h.children[0].levels.length : 0).join(','));
  delete W.GFX; FS.clear();
  check(PK.fleetCap() === 6 && scene.children.length === 0, '13 clear(): the group out of the scene (and the cap 6 off a light preset)');
  // SOURCE: the stand captures and bakes nothing; app.js's parking step stands it and keys on it ('' off); the build packs it
  const fsSrc = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'fleet_stand.js'), 'utf8');
  check(!/\b(capture|batchSteps|bakeData|bakeNow|fleetBake|fleetQueue|captureAll|enqueue)\s*\(/.test(fsSrc.replace(/^\s*\/\/.*$/gm, '')), '13 SOURCE: fleet_stand.js calls no capture, no bake, no queue');
  const app = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
  const park = (app.match(/\{ id: 'parking',[\s\S]*?\} \},/) || [''])[0];
  check(/key: \(\) => WF \? 'at ' \+ anchorStr\(\) \+ fleetStandKey\(\) : null/.test(park) && /const fl = fleetStand\(\);/.test(park) && /if \(!FS_ON\(\)\) return '';/.test(app) && /from: inGarage \? rollFromId\(\) : fromId/.test(app),
    "13 SOURCE: the parking step keys on the fleet's set ('' with the flag off) and stands it, from the roll-out's aerodrome");
  const pk = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'parked.js'), 'utf8');
  check(/if \(!wanted\(key\)\) \{ FLEET\.stats\.notWanted\+\+; return false; \}/.test(pk) && /quiet < FLEET\.idleMs/.test(pk), '13 SOURCE: fleetQueue asks wants(); fleetStep waits for the idle window');
  const bsrc = fs.readFileSync(path.join(TOOLS, 'build.js'), 'utf8');
  const iP = bsrc.indexOf("['src/viewer', 'parked.js']"), iS = bsrc.indexOf("['src/viewer', 'fleet_spots_pack.js'], ['src/viewer', 'fleet_stand.js']"), iR = bsrc.indexOf("['src/viewer', 'render_premises.js']");
  check(iP > 0 && iS > iP && iR > iS, '13 SOURCE: the build packs the spots and the stand after parked.js');
  W.FLYDIY_FLEET = false; PK.fleet.store = null; delete W.GARAGE_SPEC;
  for (const k of Object.keys(PK.records)) if (PK.records[k] && PK.records[k].fleet) delete PK.records[k];
  PK.pending.length = 0; PK.fleet.lru.length = 0; PK.fleet.placed.length = 0;
}

// ---- 11 / 12p THE PAGE IN NODE (G2220-G2224) ------------------------------------------------------------
async function pageRows() {
  if (process.argv.includes('--pure') || process.env.PARKED_PURE) { console.log('  --   11 / 12p: the page in node skipped (--pure)'); return; }
  const crypto = require('crypto'), C2D = require('./_c2d_digest.js');
  const { openPage } = require('./_page_node.js');
  const rd = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  const CUB = rd('builds/cub_2026-09-20_corrected.json').spec, MET = rd('tools/fixtures/build_v10_cessnaMetal_2026-09-26.json').spec;
  const C172 = rd('tools/fixtures/build_v10_c172_wipline2350_2026-09-20.json').spec;
  const env = (name, spec) => JSON.stringify({ what: 'flydiy-build', v: 10, name, spec });
  const t0 = Date.now();
  const P = await openPage({ quiet: true, storage: { 'flydiy.wip': env('cub', CUB), 'flydiy.build.parkC172': env('parkC172', C172) }, c2d: 'digest' });
  const PW = P.win;
  await P.until(() => PW.BOOT && PW.BOOT.state === 'gone', 900000);
  const K = PW.PARKED, G = PW.GARAGE_SPEC;
  if (!check(!!(K && G && K.capture && G.set), '11 the page booted the garage (PARKED, GARAGE_SPEC)', ((Date.now() - t0) / 1000).toFixed(0) + ' s')) return;
  K.quiet = true;
  const sha = x => crypto.createHash('sha1').update(x).digest('hex').slice(0, 16);
  const geomHash = rec => {
    const h = crypto.createHash('sha1');
    const add = gs => { for (const k of Object.keys(gs).sort()) { const a = gs[k]; h.update('|' + k); for (const f of ['pos', 'nrm', 'idx', 'uv', 'srf']) if (a[f]) h.update(Buffer.from(a[f].buffer, a[f].byteOffset, a[f].byteLength)); } };
    add(rec.vis.groups);
    for (const p of rec.vis.parts) { h.update('|part ' + p.kind + JSON.stringify(p.pivot) + ' ' + p.R + ' ' + p.stretch); add(p.groups); }
    h.update(JSON.stringify(rec.vis.mats));
    return h.digest('hex').slice(0, 16);
  };
  // the atlas: the copy's digest, the block's numbers (every uniform but the placement's craft frame, which build()
  // replaces per placement), the instrument faces' canvases
  const valOf = v => {
    if (v == null || typeof v === 'boolean') return String(v);
    if (typeof v === 'number') return v.toFixed(6);
    if (Array.isArray(v)) return '[' + v.map(valOf).join(',') + ']';
    if (v.isTexture) return 'tex:' + (v.image ? C2D.digest(v.image) : 'none');
    if (v.elements) return 'm[' + Array.from(v.elements, x => x.toFixed(6)).join(',') + ']';
    if (typeof v.toArray === 'function') return 'v[' + v.toArray().map(x => x.toFixed(6)).join(',') + ']';
    if (ArrayBuffer.isView(v)) return 'a:' + sha(Buffer.from(v.buffer, v.byteOffset, v.byteLength));
    return JSON.stringify(v);
  };
  const atlasHash = rec => {
    const parts = ['atlas ' + (rec.atlas && rec.atlas.image ? C2D.digest(rec.atlas.image) : 'none')];
    for (const k of Object.keys(rec.block || {}).sort()) if (k !== 'uCraftInv') parts.push(k + '=' + valOf(rec.block[k].value));
    // the instrument faces: each set's copied canvases and its colour (a material's uuid is no part of the picture)
    for (const k of Object.keys(rec.panel || {}).sort()) { const m = rec.panel[k] || {};
      parts.push('panel ' + k + '=' + ['map', 'emissiveMap', 'alphaMap'].map(sl => (m[sl] && m[sl].image ? C2D.digest(m[sl].image) : '-')).join(',') + ' ' + (m.color && m.color.getHexString ? m.color.getHexString() : '')); }
    return { h: sha(parts.join('|')), parts };
  };
  const capUnder = (b, key) => { G.set(JSON.parse(JSON.stringify(b))); delete K.records[key]; const rec = K.capture(key); if (!rec) return null;
    const a = atlasHash(rec); const out = { tris: rec.tris, g: geomHash(rec), a: a.h, parts: a.parts }; delete K.records[key]; return out; };
  const diffParts = (a, b) => { const d = []; for (let i = 0; i < Math.max(a.parts.length, b.parts.length); i++) if (a.parts[i] !== b.parts[i]) d.push((a.parts[i] || '').slice(0, 40)); return d.slice(0, 4).join('; '); };
  // 11 THE CAPTURE LEAK
  for (const key of ['mine:parkC172', 'arch:c172']) {
    const tA = Date.now();
    const a = capUnder(CUB, key), b = capUnder(MET, key);
    if (!check(!!(a && b), '11 ' + key + ' captured under both current builds')) continue;
    check(a.g === b.g && a.tris === b.tris, '11 ' + key + ': the same geometry under the Cub and under the metal Cessna (the bytes)', a.tris + ' / ' + b.tris + ' tris, ' + a.g + ' / ' + b.g);
    check(a.a === b.a, '11 ' + key + ': the same atlas under both (the copy\'s digest, the block, the faces)', a.a + ' / ' + b.a + (a.a !== b.a ? ': ' + diffParts(a, b) : ''));
    console.log('  11 ' + key + ': ' + a.tris + ' tris under the Cub, ' + b.tris + ' under the metal Cessna; geometry ' + a.g + ' / ' + b.g + ', atlas ' + a.a + ' / ' + b.a + ' (' + ((Date.now() - tA) / 1000).toFixed(0) + ' s)');
  }
  // the negative control: the leak re-opened, the row must see it
  {
    K.cleanCapture = false;
    let a = null, b = null;
    try { a = capUnder(CUB, 'mine:parkC172'); b = capUnder(MET, 'mine:parkC172'); } finally { K.cleanCapture = true; }
    if (a && b) console.log('  11 NEGATIVE CONTROL (the leak re-opened): mine:parkC172 ' + a.tris + ' tris under the Cub, ' + b.tris + ' under the metal Cessna; geometry ' + a.g + ' / ' + b.g + ', atlas ' + a.a + ' / ' + b.a);
    check(!!(a && b) && (a.g !== b.g || a.a !== b.a), '11 NEGATIVE CONTROL: with the leak re-opened (PARKED.cleanCapture = false) the same spec captures DIFFERENTLY under the two builds - the row goes red',
      a && b ? a.tris + ' / ' + b.tris + ' tris, geometry ' + (a.g === b.g ? 'same' : 'differs') + ', atlas ' + (a.a === b.a ? 'same' : 'differs') : 'no capture');
  }
  // 12p THE FLEET in the page
  {
    const F = K.fleet, S = F.stats, st = (() => { const m = new Map(); return { m, get: k => PW.Promise.resolve(m.has(k) ? m.get(k) : null), put: (k, v) => { m.set(k, v); return PW.Promise.resolve(); } }; })();
    G.set(JSON.parse(JSON.stringify(MET)));
    G.save('offA');
    // G2225: the queue bakes only the DRAWN SET (FLEET_STAND.wants: outside at the roll-out's aerodrome) - the two fleet
    // slots exist first (saved with the flag off) and are tied down outside at HOME (the ledger), offA inside
    G.save('fleetB'); G.save('fleetA');
    check(F.queue.length === 0 && S.queued === 0, '12p FLYDIY_FLEET off: the garage\'s save queues nothing');
    if (PW.FLYDIY_PLAYER && PW.FLYDIY_PLAYER.set) {
      const d = PW.FLYDIY_PLAYER.doc();
      d.fleet.fleetA = { hangar: null, aero: 'HOME', outSince: 0 }; d.fleet.fleetB = { hangar: null, aero: 'HOME', outSince: 0 }; d.fleet.offA = { hangar: 'HOME', aero: 'HOME' };
      const d2 = PW.FLYDIY_PLAYER.set(d);
      check(!!(d2.fleet.fleetA && !d2.fleet.fleetA.hangar && d2.fleet.fleetB && !d2.fleet.fleetB.hangar), '12p the two fleet slots tied down outside at HOME (the ledger)', JSON.stringify(d2.fleet));
    }
    PW.FLYDIY_FLEET = true; F.store = st;
    const nw0 = S.notWanted;
    G.save('offA');
    check(!F.queue.includes('mine:offA') && (!(PW.FLEET_STAND && PW.FLEET_STAND.state.ctx) || S.notWanted === nw0 + 1), '12p THE BOUND: a save of an airframe that would not be drawn (inside the hangar) queues nothing',
      'queue ' + F.queue.join(',') + ', notWanted ' + (S.notWanted - nw0) + ', ctx ' + !!(PW.FLEET_STAND && PW.FLEET_STAND.state.ctx));
    G.set(JSON.parse(JSON.stringify(MET)));
    let bakes = 0; F.bake = async (THREE, rec) => { bakes++; return synthBake(PW, rec.tris); };
    const holds0 = PW.FLYDIY_HOLDS;
    const setHolds = h => { PW.FLYDIY_HOLDS = h ? () => Object.assign({ holdRender: false, rollHold: false, craftAway: false, inGarage: false, running: true }, h) : holds0; };
    G.save('fleetA');
    check(F.queue.includes('mine:fleetA'), '12p a save queues its slot\'s key', F.queue.join(','));
    await P.until(() => S.stored >= 1 && !F.busy && !F.queue.length, 300000);
    const vA = st.m.get('mine:fleetA');
    check(S.captures === 1 && bakes === 1 && !!vA && vA.sig === K.fleetSig(K.specOf('mine:fleetA'), null), '12p the garage\'s idle path captured, baked and kept it under its signature',
      'captures ' + S.captures + ', bakes ' + bakes + ', stored ' + S.stored + (vA ? ', sig ' + vA.sig : ''));
    const c0 = S.captures, b0 = bakes;
    // FLYING: a save is queued, nothing starts; a decode is refused
    setHolds({ inGarage: false });
    G.save('fleetB');
    await P.until(() => false, 8000);                       // past FLEET.idleMs and a worldMs re-look
    const H = PW.THREE;
    const gA = K.place(H, 'mine:fleetA', 0, 0, 0, 0);
    await P.until(() => false, 2000);
    check(S.captures === c0 && bakes === b0 && S.worldRefused > 0 && F.queue.includes('mine:fleetB'), '12p FLYING: no capture, no bake (the queue waits for the garage)', 'captures ' + S.captures + ', bakes ' + bakes + ', refused ' + S.worldRefused);
    check(gA.children.length === 0 && S.flightRefused > 0 && S.decodes === 0, '12p FLYING: no decode either (the fleet set changes at the roll-out only)');
    // THE ROLL-OUT SCREEN: a baked key decodes and stands; an unbaked one stands nothing; still no capture / bake
    setHolds({ inGarage: false, holdRender: true });
    const root = new H.Group(), gB = K.place(H, 'mine:fleetA', 5, 0, 5, 0.3), gC = K.place(H, 'mine:fleetB', 30, 0, 5, 0); root.add(gB); root.add(gC);
    await P.until(() => gB.children.length > 0, 20000);
    await P.until(() => false, 5000);
    check(gB.children.length === 1 && gB.children[0].isLOD && gB.children[0].userData.cooked === 1 && S.decodes === 1, '12p THE ROLL-OUT ONLY DECODES: the baked slot stands from its bytes', 'decodes ' + S.decodes);
    check(gC.children.length === 0 && F.why['mine:fleetB'] === 'not baked', '12p ...a slot with no bake stands nothing', String(F.why['mine:fleetB']));
    check(S.captures === c0 && bakes === b0 && S.bakeInWorld === 0, '12p NO CAPTURE OR BAKE RAN WHILE THE WORLD WAS UP (flying, the roll-out screen)', 'captures ' + S.captures + ', bakes ' + bakes + ', bakeInWorld ' + S.bakeInWorld);
    // BACK IN THE GARAGE: the queue drains
    setHolds(null);
    await P.until(() => S.stored >= 2 && !F.busy && !F.queue.length, 300000);
    check(S.captures === c0 + 1 && st.m.has('mine:fleetB'), '12p back in the garage the queue drains (fleetB baked there)', 'captures ' + S.captures + ', stored ' + S.stored);
    check(gC.children.length === 0, '12p ...and the bake\'s LIVE capture filled no waiting world holder (G2225: only a decoded bake stands)', gC.children.length + ' children');
    // a second save of an unchanged aeroplane is a hit, not a bake
    G.save('fleetB');
    await P.until(() => !F.busy && !F.queue.length && !F.timer, 60000);
    check(S.hits >= 1 && S.captures === c0 + 1, '12p saving the same aeroplane again bakes nothing (its signature holds)', 'hits ' + S.hits);
    PW.FLYDIY_FLEET = false; F.store = null; F.bake = null;
    // (the node page's own: an impostor sheet baked on the recording GL reads back no pixels - every node page boot says so)
    const errs = (P.errors || []).filter(e => !/WebGL|webgl|shader|AudioContext|impostor bake: .* sheet EMPTY/i.test(e));
    check(!errs.length, '11 / 12p no page error', errs[0] ? errs[0].slice(0, 200) : '');
  }
  // the world's doors hold no capture and no bake (a source scan of the functions the roll-out and the flight run)
  {
    const src = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'parked.js'), 'utf8');
    const fnText = name => { const i = src.indexOf('function ' + name + '('); if (i < 0) return ''; let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return ''; };
    const branch = (() => { const t = fnText('place'); const a = t.indexOf('if (fleetOn() && isMine(key))'); return a >= 0 ? t.slice(a, t.indexOf('return grp;', a)) : ''; })();
    const world = [fnText('fleetLoad'), fnText('fleetGate'), fnText('fleetDrawn'), fnText('fleetEvict'), branch];
    check(world.every(t => t.length > 40) && world.every(t => !/\b(capture|batchSteps|bakeData|bakeNow|farBaked|enqueue|cutFar|captureAll|fleetBake)\s*\(/.test(t)),
      '12p SOURCE: the roll-out\'s and the flight\'s fleet doors (fleetLoad, the place() branch, fleetGate, fleetDrawn, fleetEvict) call no capture and no bake');
    check(/if \(!garageIdle\(\)\)/.test(fnText('fleetStep')) && /garageIdle\(\)/.test(fnText('fleetBake')), '12p SOURCE: the bake door (fleetStep, fleetBake) starts only in the garage at rest');
  }
}

farRungs().catch(e => check(false, '5b the far rungs threw', e && e.stack || String(e)))
  .then(() => paneLevels().catch(e => check(false, '6c the pane levels threw', e && e.stack || String(e))))
  .then(() => bakedRungs().catch(e => check(false, '8 the baked rungs threw', e && e.stack || String(e))))
  .then(() => shelvedL0().catch(e => check(false, '9 the shelved L0 threw', e && e.stack || String(e))))
  .then(() => cookRungs().catch(e => check(false, '10 the cook threw', e && e.stack || String(e))))
  .then(() => fleetHeadless().catch(e => check(false, '12 the fleet threw', e && e.stack || String(e))))
  .then(() => fleetStood().catch(e => check(false, '13 the fleet stood threw', e && e.stack || String(e))))
  .then(() => pageRows().catch(e => check(false, '11 / 12p the page threw', e && e.stack || String(e)))).then(() => {
  if (fail.length) {
    for (const f of fail.slice(0, 30)) console.log('  ! ' + f);
    if (fail.length > 30) console.log('  ... ' + (fail.length - 30) + ' more');
    console.log('GATE PARKED: FAIL (' + fail.length + ')');
    process.exit(1);
  }
  console.log('  ' + checks + ' checks');
  console.log('GATE PARKED: PASS');
});
