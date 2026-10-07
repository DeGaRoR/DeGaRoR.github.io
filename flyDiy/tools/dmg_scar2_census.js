#!/usr/bin/env node
// dmg_scar2_census.js - G2379 (DMG-SCAR2): THE SCAR'S PROGRAMS, COUNTED IN NODE - the base (DMG-SCAR, given with
// --before <its flyDiy dir>) and this tree, damage off and on. tools/program_census.js needs the game to roll out in
// Chrome, and in the cloud SwiftShader never lifts the roll-out (7 Oct: 52 min at the shed, killed) - this is the same
// count on the scar's own objects: the real three r186 over the fake WebGL2 (tools/_fake_gl.js, as GATE DMGSCAR 7), a
// lit, shadowed, fogged scene with a ground; damage ON parks the decal (ground_scar.js make) as the roll-out does, the
// scene compiled (the roll-out's compile), then each of the six cases' scars (reports/evidence/DMG-SCAR2/cases.json, the
// tree's own: before / after) laid and drawn in turn; damage OFF makes no decal (app.js: scarMesh only with the layer on).
// Prints per tree and layer: links and program keys at the roll-out, and after every scar laid and drawn.
//   node tools/dmg_scar2_census.js --before <base flyDiy>
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const HERE = path.join(__dirname, '..'), BEFORE = opt('before', null);
const FG = require('./_fake_gl.js');
const cases = JSON.parse(fs.readFileSync(path.join(HERE, 'reports', 'evidence', 'DMG-SCAR2', 'cases.json'), 'utf8'));
function census(tree, damage, which) {
  const links = [], { gl, WebGL2RenderingContext, canvas } = FG.makeGL({ links });
  const ctx = { console, performance, setTimeout, clearTimeout, requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, WebGL2RenderingContext, navigator: { userAgent: 'node' } };
  ctx.globalThis = ctx; ctx.window = ctx; ctx.self = ctx; vm.createContext(ctx); vm.runInContext(FG.THREE_SRC, ctx);
  const THREE = ctx.THREE; canvas.getContext = () => gl;
  const R = new THREE.WebGLRenderer({ context: gl, canvas, reversedDepthBuffer: true });
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFShadowMap; R.toneMapping = THREE.ACESFilmicToneMapping;
  const load = rel => vm.runInContext(fs.readFileSync(path.join(tree, rel), 'utf8').replace(/^'use strict';/m, ''), ctx);
  load('src/viewer/matlib.js'); ctx.MATLIB = vm.runInContext('MATLIB', ctx);
  load('src/core/34_scar.js'); load('src/viewer/ground_scar.js');
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.5, 5000);
  camera.position.set(0, 4, 15); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const sun = new THREE.DirectionalLight(0xffffff, 1); sun.castShadow = true; sun.position.set(50, 100, 30); scene.add(sun); scene.add(sun.target);
  scene.add(new THREE.HemisphereLight(0x9bbefb, 0x404030, 1)); scene.fog = new THREE.Fog(0xcccccc, 100, 3000);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x557733 })); ground.receiveShadow = true; scene.add(ground);
  let decal = null;
  if (damage) { decal = ctx.GROUND_SCAR.make(THREE); scene.add(decal); }
  R.compile(scene, camera); R.render(scene, camera);
  const keys = () => (R.info.programs || []).map(p => p.cacheKey).sort();
  const out = { links0: links.length, keys0: keys(), laid: 0, tris: 0 };
  if (decal) for (const c of cases) {
    const r = c[which]; if (!r || !r.prims.length) continue;
    // the scar moved under the eye (its box's centre to the origin), the world flat (paved where the case is)
    const P = r.prims, b = ctx.scarBox(P, true), dx = -(b[0] + b[2]) / 2, dz = -(b[1] + b[3]) / 2;
    const mv = P.map(p => p.k === 'c' ? Object.assign({}, p, { x: p.x + dx, z: p.z + dz }) : Object.assign({}, p, { p: p.p.map((v, j) => v + (j % 2 ? dz : dx)) }));
    const st = ctx.GROUND_SCAR.build(THREE, decal, mv, { terrainH: () => 0, waterH: () => -100, surface: () => (c.id === 'stump' ? 5 : 0) });
    out.tris += st.tris; out.laid++;
    R.render(scene, camera); R.render(scene, camera);
  }
  out.links1 = links.length; out.keys1 = keys();
  return out;
}
const rows = [];
for (const [name, tree, which] of [['base (4575e99f)', BEFORE, 'before'], ['this tree', HERE, 'after']]) {
  if (!tree) continue;
  for (const damage of [false, true]) {
    const r = census(tree, damage, which);
    rows.push({ name, damage, r });
    console.log(name + ', damage ' + (damage ? 'ON ' : 'OFF') + ': at the roll-out ' + r.links0 + ' links, ' + r.keys0.length + ' program keys; '
      + (damage ? r.laid + ' scars laid and drawn (' + r.tris + ' triangles) -> ' : '') + r.links1 + ' links, ' + r.keys1.length + ' keys' + (r.links1 === r.links0 && JSON.stringify(r.keys1) === JSON.stringify(r.keys0) ? ' (no link after the roll-out)' : ' (LINKED AFTER THE ROLL-OUT)'));
  }
}
const k = (n, d) => { const x = rows.find(r => r.name === n && r.damage === d); return x ? JSON.stringify(x.r.keys1) : null; };
if (BEFORE) {
  console.log('the program keys, base vs this tree: damage OFF ' + (k('base (4575e99f)', false) === k('this tree', false) ? 'the same' : 'DIFFERENT') + ', damage ON ' + (k('base (4575e99f)', true) === k('this tree', true) ? 'the same' : 'DIFFERENT'));
  const on = rows.find(r => r.name === 'this tree' && r.damage), off = rows.find(r => r.name === 'this tree' && !r.damage);
  console.log('damage ON over OFF (this tree): +' + (on.r.keys0.length - off.r.keys0.length) + ' program key(s) at the roll-out - the decal\'s, parked and linked with the scene; none after');
}
