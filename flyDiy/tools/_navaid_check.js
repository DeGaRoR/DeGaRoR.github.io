#!/usr/bin/env node
// _navaid_check.js - GATE NAVAID (ASSETS-OCT, G2909): the radio navaids and the small utilities (tools/_navaid_gen.js,
// NAVAID_GEN, loaded on demand) - the Annette Island DVOR/DME (ANN 117.1) and Metlakatla's hydro powerhouses.
//
//   1 BUILD    every catalogue preset builds headless at lod 0 and lod 1; finite geometry; lod 1 lighter than lod 0
//   2 DVOR     the FAA's dimensions: the counterpoise's diameter and height (as dialled), the sideband count, the
//              DME's red obstruction light published as a `beacon` (the night lamp pool); <= 5 000 tris at lod 0
//   3 HYDRO    the shed's length / width as dialled, the two-tone roof (both roof parts carry triangles), the yard
//              with the pack's transformer (its generated mesh decodes: the counts, finite, inside its box) and the
//              procedural mast; <= 3 500 tris at lod 0
//   4 CATALOGUE  keys navaid/... and utility/...; every entry has a foot, a ground rule, its lights slot
//   5 SITES    the ANN VOR/DME in the Jolene record near its real point (> 60 m is a fault, > 5 m an editor nudge), its
//              tree-clear exclude ~30 m round it (the user's rule: cleared only there); the powerhouses are not placed
//   6 LAZY     the generator is NOT in index.html's static list (build.js MANIFEST.lazy), and every lazy trigger
//              (world_boot, the house worker) matches both namespaces
// Run: node tools/_navaid_check.js        (one final `GATE NAVAID: ...`)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const TOOLS = __dirname;

function makeTHREE() {
  function Col(c) { this.hex = c; }
  Col.prototype.setHex = function (h) { this.hex = h; };
  Col.prototype.multiplyScalar = function () { return this; };
  function Mat(o) { Object.assign(this, { isMat: 1 }, o || {}); this.color = new Col((o && o.color) || 0); }
  class BufferAttribute { constructor(a, n) { this.array = a; this.itemSize = n; } }
  class BufferGeometry { constructor() { this.attributes = {}; this.index = null; } setAttribute(k, a) { this.attributes[k] = a; } setIndex(i) { this.index = i; } computeVertexNormals() {} }
  class Mesh { constructor(g, m) { this.geometry = g; this.material = m; } }
  class Vec2 { constructor(x, y) { this.x = x; this.y = y; } set(x, y) { this.x = x; this.y = y; } }
  class Texture { constructor(img) { this.image = img; this.repeat = new Vec2(1, 1); } }
  return { BufferAttribute, BufferGeometry, Mesh, Texture, Vector2: Vec2, Color: Col, MeshLambertMaterial: Mat, MeshStandardMaterial: Mat,
           MeshBasicMaterial: Mat, DoubleSide: 2, FrontSide: 0, RepeatWrapping: 1000, SRGBColorSpace: 'srgb', LinearSRGBColorSpace: 'srgb-linear' };
}

// the real points (A0 off Esri z18, 12 Oct; the published ones beside): lat, lon
const POINTS = {
  // game x / z by tools/geo.py (EPSG:3338; run with `py` - the PATH's python is Inkscape's)
  ann: { lat: 55.060373, lon: -131.578509, x: -1010.1, z: -1663.3, why: 'the disc ~7 m W / 4 m S of the FAA point' },
  purple: { lat: 55.092773, lon: -131.544800, x: -174.7, z: -5780.2, why: 'the shed at the end of Hydroplant Rd (for the user)' },
  chester: { lat: 55.117115, lon: -131.545932, x: -1141.9, z: -8313.1, why: 'candidate A, picked by the user' },
};

const fails = [], notes = [];
const fail = m => fails.push(m);
const win = {};
const ctx = { window: win, THREE: makeTHREE(), console, Math, JSON, Float32Array, Object, Array, Set, Map, Number, String, isFinite, parseInt, parseFloat };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['_house_kit.js', '_house_gen.js', '../src/viewer/sign_tex.js', '_tower_gen.js', '_navaid_gen.js'])
  vm.runInContext(fs.readFileSync(path.join(TOOLS, f), 'utf8'), ctx, { filename: f });
const NG = win.NAVAID_GEN;
if (!NG) { console.log('GATE NAVAID: FAIL - NAVAID_GEN did not load'); process.exit(1); }

// 1 + 2 + 3
const finiteBags = (R) => { for (const k of NG.BAGS) { const d = R.bags[k].data(); for (const v of d.pos) if (!Number.isFinite(v)) return k; } return null; };
for (const name of Object.keys(NG.PRESETS)) {
  const P = Object.assign({}, NG.DEF, NG.PRESETS[name]);
  let R0, R1;
  try { R0 = NG.build(P, 0); R1 = NG.build(P, 1); } catch (e) { fail(`1 build: ${name} threw ${e.message}`); continue; }
  const bad = finiteBags(R0); if (bad) fail(`1 build: ${name} has a non-finite vertex in ${bad}`);
  if (!(R1.stats.tris < R0.stats.tris)) fail(`1 build: ${name} lod 1 (${R1.stats.tris}) not lighter than lod 0 (${R0.stats.tris})`);
  const S = R0.stats;
  notes.push(`${name}: ${S.tris} tris at lod 0, ${R1.stats.tris} at lod 1`);
  if (P.kind === 'hydro') {
    if (S.tris > 3500) fail(`3 hydro: ${name} ${S.tris} tris at lod 0, over 3 500`);
    const u = S.utility, bb = S.bbox;
    if (!u || Math.abs(u.L - P.hL) > 1e-6 || Math.abs(u.W - P.hW) > 1e-6) fail(`3 hydro: ${name} shed not as dialled`);
    if (!(S.per.roof > 0 && S.per.metal > 0)) fail(`3 hydro: ${name} roof not in two tones (roof ${S.per.roof}, metal ${S.per.metal})`);
    if (!u.yard || !(u.yard.tris > 150)) fail(`3 hydro: ${name} switchyard missing or empty (${u.yard && u.yard.tris})`);
    if (!(bb.y1 - bb.y0 > P.slabH + P.hEave)) fail(`3 hydro: ${name} stands ${bb.y1 - bb.y0} m, under its base + eave`);
  } else {
    if (S.tris > 5000) fail(`2 dvor: ${name} ${S.tris} tris at lod 0, over 5 000`);
    const nv = S.navaid;
    if (!nv || Math.abs(nv.counterpoise.d - P.cpD) > 1e-6 || Math.abs(nv.counterpoise.y - P.cpH) > 1e-6) fail(`2 dvor: ${name} counterpoise not as dialled`);
    if (!nv || nv.sidebands.n !== Math.round(P.sbN)) fail(`2 dvor: ${name} sidebands ${nv && nv.sidebands.n}, dialled ${P.sbN}`);
    const b = (S.lit.lights || []).find(l => l.kind === 'beacon');
    if (!b || !(b.col[0] > 0.8 && b.col[1] < 0.3)) fail(`2 dvor: ${name} has no red obstruction beacon published`);
    if (b && Math.abs(b.y - nv.top) > 0.3) fail(`2 dvor: ${name} beacon at ${b.y.toFixed(2)} m, the top is ${nv.top.toFixed(2)} m`);
    if (Math.abs((S.bbox.x1 - S.bbox.x0) - P.cpD) > (P.shelter ? P.shelterGap + P.shelterW + 2 : 1)) fail(`2 dvor: ${name} box ${(S.bbox.x1 - S.bbox.x0).toFixed(1)} m vs a ${P.cpD.toFixed(1)} m disc`);
  }
}
// the generated transformer decodes inside its box
{
  const src = fs.readFileSync(path.join(TOOLS, '_navaid_gen.js'), 'utf8');
  const m = src.match(/const UTIL_MESH = (\{.*?\});\n/s);
  const U = m ? JSON.parse(m[1]) : {};
  if (!U.transformer) fail('3 hydro: the generated block has no transformer (python tools/hydro_prep.py in Blender)');
  else {
    const T = U.transformer, nb = Buffer.from(T.pos, 'base64'), ib = Buffer.from(T.idx, 'base64'), rb = Buffer.from(T.role, 'base64');
    if (nb.length !== T.nv * 6 || ib.length !== T.nt * 6 || rb.length !== T.nt) fail('3 hydro: the transformer\'s buffers do not match its counts');
    for (let t = 0; t < T.nt * 3; t++) if (ib.readUInt16LE(t * 2) >= T.nv) { fail('3 hydro: a transformer index past its vertices'); break; }
    if (T.nt > 600) fail(`3 hydro: the transformer is ${T.nt} tris, over its 600`);
    if (/"mast"\s*:/.test(m[1])) fail('3 hydro: the pack\'s mast is still in the generated block (the mast is built procedurally)');
  }
}
// 4
const cat = NG.CATALOGUE || [];
for (const want of ['navaid/DVOR-DME', 'utility/hydro powerhouse'])
  if (!cat.find(e => e.key === want)) fail(`4 catalogue: no ${want}`);
for (const e of cat) {
  if (!/^(navaid|utility)\//.test(e.key)) fail(`4 catalogue: ${e.key} outside navaid/ and utility/`);
  const foot = e.foot(e.P);
  if (!Array.isArray(foot) || foot.length < 3) fail(`4 catalogue: ${e.key} has no foot`);
  if (!e.ground || !e.ground.need) fail(`4 catalogue: ${e.key} has no ground rule`);
  if (!e.slots || e.slots.lights !== 'stats.lit.lights') fail(`4 catalogue: ${e.key} does not publish its lights`);
}
// 5 SITES: the ANN VOR/DME placed at its real point (the user, 12 Oct: "You can put the VOR"; the hydro powerhouses are
// catalogue assets the user positions - their points are in HANDOVER), with its tree-clear exclude round it
{
  const rec = JSON.parse(fs.readFileSync(path.join(TOOLS, 'fixtures', 'island_jolene.json'), 'utf8'));
  const L = rec.layers || {};
  const sites = (L.sites || []).filter(s => (s.items || []).some(it => /^navaid\//.test(it.key)));
  const ann = sites.find(s => s.id === 's_vor_ann');
  if (!ann) fail('5 sites: the ANN VOR/DME (s_vor_ann) is not in the Jolene record');
  else {
    const d = Math.hypot(ann.at.x - POINTS.ann.x, ann.at.z - POINTS.ann.z);
    if (d > 60) fail(`5 sites: s_vor_ann stands ${d.toFixed(0)} m from its real point - not an editor nudge`);
    else if (d > 5) notes.push(`5 sites: s_vor_ann ${d.toFixed(1)} m off its imagery point (an editor nudge)`);
    const ex = (L.exclude || []).concat(L.areas || []).find(a => a.id === 's_vor_ann_clear');
    if (!ex || !(ex.what || (ex.props && ex.props.exclude) || []).toString().includes('trees')) fail('5 sites: s_vor_ann has no tree-clear exclude (s_vor_ann_clear)');
    else {
      const r = Math.max(...ex.poly.map(q => Math.hypot(q[0] - ann.at.x, q[1] - ann.at.z)));
      if (r < 29 || r > 45) fail(`5 sites: the clear round s_vor_ann reaches ${r.toFixed(0)} m (the disc and its shelter want ~30)`);
    }
  }
  if ((L.sites || []).some(s => (s.items || []).some(it => /^utility\//.test(it.key)))) notes.push('5 sites: a utility/ site is placed (placed by the user)');
}
// 6 LAZY
{
  const B = fs.readFileSync(path.join(TOOLS, 'build.js'), 'utf8');
  const lazyAt = B.indexOf('lazy: ['), lazyEnd = B.indexOf(']].filter', lazyAt);
  const head = B.slice(0, lazyAt);
  if (/\['tools', '_navaid_gen\.js'\]/.test(head)) fail('6 lazy: _navaid_gen.js is in index.html\'s static list');
  if (!/\['tools', '_navaid_gen\.js'\]/.test(B.slice(lazyAt, lazyEnd + 2))) fail('6 lazy: _navaid_gen.js is not in MANIFEST.lazy');
  const WB = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'world_boot.js'), 'utf8');
  if (!/navaid\|utility/.test(WB)) fail('6 lazy: world_boot.js does not ask for the generator on navaid/ and utility/ keys');
  const HW = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'house_worker.js'), 'utf8');
  if (!/\(navaid\|utility\)/.test(HW)) fail('6 lazy: the house worker does not load it on navaid/ and utility/ keys');
}
for (const n of notes) console.log('  ' + n);
for (const f of fails) console.log('  FAIL ' + f);
console.log('GATE NAVAID: ' + (fails.length ? 'FAIL (' + fails.length + ')' : 'PASS'));
process.exit(fails.length ? 1 : 0);
