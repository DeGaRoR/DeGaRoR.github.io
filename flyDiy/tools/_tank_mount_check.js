#!/usr/bin/env node
// GATE TANKMOUNT - NO TANK SUPPORT THROUGH THE SKIN, ON EVERY ARCHETYPE
// (G1106, CUB-COCKPIT 2026-09-30).
//
// The user, from the Cub's seat: two dark posts on the cowl top in front of
// the windscreen - "The support for the tank are poking through the meshes.
// They're drawn far too recklessly ... If you can't do something clean, get
// rid of it." They were the energy layer's MOUNT (G189: legs from each strap
// to "the surface the bay stands on", G317: each foot asked the fuselage
// airframe table its height, a coarse ray grid keeping the outermost hit,
// windscreen included, or a flat plane at the section's top) - and over a
// 20-30 L nose tank 167 of 352 leg vertices stood past the fuselage sheet,
// 37.5 mm out. The mount is gone (G1106).
//
// This builds every CAGE_DESIGN archetype headless, the energy layer
// included (tools/_scene_headless.js runs the page's own PAGE.post chain;
// the three energy files are taken out of its exclusion list here), and for
// every drawn vessel asks the geometric question: does any part of the
// tank's own drawing lie beyond a surface of the aeroplane, seen from the
// tank's centre? Each vertex of the vessel's `mount` (legs, feet) and `hard`
// (straps, filler, vent, sump) is joined to the solid's centre and the
// segment raycast against every OTHER mesh in the scene (the fuselage sheet,
// the cowl, the windscreen, the wing, the crew...). A crossing is a piece of
// the tank's hardware outside a skin.
//
// Rows (judged):
//   mount: no archetype draws an edVessel_*_mount mesh (the support is gone)
//   mount: VESSEL_MESH exports no mount builder
//   drawn: the check is not vacuous - body tanks were drawn on N archetypes
// Measured (printed, --json for the table): per archetype the vessels, the
// hardware vertices and how many cross a skin (the straps' own clearance -
// a declared follow-up, not this gate's verdict unless --strict).
//
//   node tools/_tank_mount_check.js [--tools <dir>] [--only cub,c172] [--sizes 1,0.66,0.45] [--json out.json] [--strict]
//
// `--tools <dir>` runs the same measurement over another tree's tools/ (the
// before/after table: a copy of master's). No --help: an unknown flag is
// ignored, and the check runs.
'use strict';
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const TOOLS = path.resolve(opt('tools', __dirname));
const ONLY = opt('only', null);
const JSON_OUT = opt('json', null);
const STRICT = argv.includes('--strict');

const fail = [];
const check = (ok, what, info) => { if (!ok) fail.push(what + (info != null ? ' (' + info + ')' : '')); };

const SH = require(path.join(TOOLS, '_scene_headless.js'));
for (const f of ['_bay_site.js', '_vessel_gen.js', '_vessel_mesh.js', '_cage_energy.js']) SH.EXCLUDE.delete(f);
const BJ = require(path.join(TOOLS, '_bake_joined.js'));
const { D, C } = BJ.loadPanel();

const C0 = SH.context();
const W = C0.ctx, THREE = C0.THREE;
check(!C0.errors.length, 'the headless layers load (energy included)', C0.errors.join(' | '));
const VM = W.VESSEL_MESH;
check(!!VM && typeof VM.build === 'function', 'the vessel builder loads headless');
check(!!VM && !('mount' in VM), 'mount: VESSEL_MESH exports no mount builder (G1106)');
check(!!W.CAGE_ENERGY && typeof W.CAGE_ENERGY.fromSpec === 'function', 'the energy layer loads headless');

// the displayed sheet {V, F:[{v:[...]}]} as a three mesh, fans per face
function sheetMesh(M, FS) {
  const pos = [];
  for (const f of M.F) {
    const v = f.v; if (!v || v.length < 3) continue;
    for (let i = 1; i + 1 < v.length; i++)
      for (const k of [v[0], v[i], v[i + 1]]) { const q = M.V[k]; pos.push(q[0] * FS, q[1] * FS, q[2] * FS); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  m.name = 'fuselage sheet'; m.updateMatrixWorld(true);
  return m;
}
const rc = new THREE.Raycaster();
const vO = new THREE.Vector3(), vP = new THREE.Vector3(), vD = new THREE.Vector3();
const rows = [];
let withTanks = 0, mountMeshes = 0, mountCross = 0;
const SIZES = (opt('sizes', '1,0.66,0.45')).split(',').map(Number);
const cards = D.ARCHETYPES.filter(a => !ONLY || ONLY.split(',').includes(a.key));
for (const a of cards) {
  // THE CARD AS THE GAME FLIES IT: the joined bake (the cabin, the seats,
  // the profile the join measures), and the energy layer handed the BUILT
  // spec through GARAGE_SPEC.resolved as the game hands it - off the game's
  // spec the bench's reconstruction put the Cub's nose tank 0 mm under its
  // band's top, and no support was drawn where the user saw two
  let base;
  try { base = BJ.bakeCard(a.key).spec; }
  catch (e) { check(false, a.key + ': the card bakes', e.message); continue; }
  // THE SIZES A BUILDER PICKS: the card's own tanks, then two thirds and a
  // bit under half of their capacity - a smaller tank hangs lower in its band
  // with air above it, which is where G189 drew its legs (the stock Cub's
  // 45 L box touches the top of the nose band and drew none; at 20-30 L it
  // stood two posts on the cowl, the user's screenshot)
  for (const kCap of SIZES) {
  const spec = JSON.parse(JSON.stringify(base));
  const vs = (spec.energy && spec.energy.vessels) || [];
  if (kCap !== 1) { if (!vs.length) continue; for (const v of vs) { v.capacity = Math.round((+v.capacity || 0) * kCap * 10) / 10; v.along = null; v.lv = null; delete v.dims; } }
  let def;
  try { def = C.buildGen(spec); }
  catch (e) { check(false, a.key + ' x' + kCap + ': the card builds', e.message); continue; }
  // the layer seeds its vessels from the spec it is handed (the game's
  // applySpec door) - every card its own tanks
  try { W.CAGE_ENERGY.fromSpec(spec.energy); } catch (e) {}
  const r = SH.sceneBuild(spec, { garage: spec, resolved: () => def.spec, inGame: true });
  if (r.errors.length) check(false, a.key + ': the scene builds clean', r.errors[0].split('\n')[0]);
  const all = [];
  r.scene.traverse(o => { if (o.isMesh && o.geometry && o.geometry.attributes.position) all.push(o); });
  const ves = all.filter(o => /^edVessel_\d+_/.test(o.name));
  const skins = all.filter(o => !/^edVessel_|^edFuel_/.test(o.name) && o.visible !== false);
  // THE FUSELAGE ITSELF: the page draws the cage sheet outside PAGE.post, so
  // the headless scene has every layer but the skin they all stand on - the
  // sheet (glass, pillars and the cut door included) as one more mesh, in
  // the layers' frame (cage units x FS)
  skins.push(sheetMesh(r.built.sheet, r.FS));
  // a ray from INSIDE meets a skin from behind: three's raycaster skips a
  // back face on a FrontSide material, so every skin is asked both ways
  // (measured: without it the Cub's legs read 0 crossings)
  for (const s of skins) {
    if (!s.geometry.boundingSphere) s.geometry.computeBoundingSphere();
    for (const m of [].concat(s.material || [])) if (m) m.side = THREE.DoubleSide;
  }
  const row = { key: a.key, cap: kCap, vessels: 0, mount: 0, mountVerts: 0, mountOut: 0, hardVerts: 0, hardOut: 0, worst: null };
  const idx = new Set(ves.map(o => +o.name.split('_')[1]));
  row.vessels = idx.size;
  if (row.vessels) withTanks++;
  for (const o of ves) {
    const slot = o.name.split('_').slice(2).join('_');
    if (slot !== 'mount' && slot !== 'hard') continue;
    if (slot === 'mount') { row.mount++; mountMeshes++; }
    // the solid's centre, world: every slot mesh is placed at the tank's centre
    o.getWorldPosition(vO);
    const pos = o.geometry.attributes.position;
    const step = Math.max(1, Math.floor(pos.count / 400));   // a few hundred rays a mesh
    for (let i = 0; i < pos.count; i += step) {
      vP.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      vD.subVectors(vP, vO); const L = vD.length(); if (L < 1e-4) continue;
      vD.multiplyScalar(1 / L);
      rc.set(vO, vD); rc.near = 0; rc.far = L;
      const hit = rc.intersectObjects(skins, false);
      if (slot === 'mount') row.mountVerts++; else row.hardVerts++;
      if (hit.length) {
        if (slot === 'mount') { row.mountOut++; mountCross++; } else row.hardOut++;
        const out = L - hit[0].distance;
        if (!row.worst || out > row.worst.mm / 1000)
          row.worst = { slot, mm: +(out * 1000).toFixed(1), through: hit[0].object.name || hit[0].object.parent && hit[0].object.parent.name };
      }
    }
  }
  rows.push(row);
  console.log('  ' + (a.key + ' x' + kCap).padEnd(18) + ' vessels ' + row.vessels + '  mount meshes ' + row.mount +
    (row.mount ? ' (' + row.mountOut + '/' + row.mountVerts + ' verts past a skin)' : '') +
    '  hardware ' + row.hardOut + '/' + row.hardVerts + ' past a skin' +
    (row.worst ? '  worst ' + row.worst.slot + ' ' + row.worst.mm + ' mm through ' + row.worst.through : ''));
  }
}
check(mountMeshes === 0, 'mount: no archetype, at any of its tank sizes, draws an edVessel_*_mount mesh (G1106: the support is gone)',
  mountMeshes + ' meshes, ' + mountCross + ' vertices past a skin');
check(withTanks >= Math.min(3, cards.length), 'drawn: body tanks were drawn (the check is not vacuous)', withTanks + ' of ' + cards.length);
if (STRICT) for (const r of rows) check(r.hardOut === 0, r.key + ': the tank hardware stays inside the skin', r.hardOut + '/' + r.hardVerts);
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ tools: TOOLS, rows }, null, 1));
for (const f of fail) console.log('  FAIL ' + f);
console.log('GATE TANKMOUNT: ' + (fail.length ? 'FAIL (' + fail.length + ')' : 'PASS'));
process.exit(fail.length ? 1 : 0);
