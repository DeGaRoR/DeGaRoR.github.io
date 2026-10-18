#!/usr/bin/env node
// PATCH CENSUS (G2115, TERRAIN-MATCH) - the premises' ground patch AS render_premises.js BUILDS IT, in node: its blocks,
// each block's four levels (2 / 4 / 8 / 16 m), every level's triangles (the grid and the skirts apart) and the distance
// it is drawn from, over Jolene. The builder is LIFTED from the source (buildPatchSteps and what it reads: activeChunks,
// the border's laws, the levels' table) and run on the real three.js - no copy kept here - so a change there is counted
// here; `--src <file>` reads another render_premises.js (a base's, for the before / after).
//
//   node tools/patch_census.js [--src file] [--tolpx N] [--at x,z[,x,z...]] [--json f]
//     --tolpx  the budget's patchTolPx (potato / laptop 3 on train 37b; 1 every desktop preset)
//     --at     the levels drawn for an eye there (each block's LOD by its distance), and their triangles: the frame's share
//              (default: HOME's stand and the half-way point of its taxi - FRAMECOST's two views - and w3's stand)
'use strict';
process.env.FLYDIY_GROUND_RASTER = process.env.FLYDIY_GROUND_RASTER || '1';
const fs = require('fs');
const path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const SRC = arg('--src', path.join(ROOT, 'src', 'viewer', 'render_premises.js'));
const RP = fs.readFileSync(SRC, 'utf8');
const lift = (a, b) => { const i = RP.indexOf(a), j = i < 0 ? -1 : RP.indexOf(b, i); if (i < 0 || j < 0) throw new Error('patch_census: lift failed at ' + a); return RP.slice(i, j); };
const THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
global.PAVEMENT = require(path.join(ROOT, 'src', 'viewer', 'pavement.js'));
const TOL = +arg('--tolpx', 1);
global.window = { GFX: { budget: () => ({ patchTolPx: TOL }) } };
const IN = require(path.join(T, 'island_node.js'));
const C = require(path.join(T, 'flight_core.js'));
const W = IN.islandWorld('jolene', { premises: fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8') });
const O = W.premises.overlay, PG = C.PREMISES_GEN;
const body = lift('  const extentWorld = () =>', '\n') + '\n' + lift('  let patch = null, patchKey', '  // THE ROADS (game)') +
  (RP.indexOf('  const REFINE_NEAR = ') > 0 ? lift('  const REFINE_NEAR = ', '  const pavSeed = ') : '');   // (G2115: the refined pavements, sinkNear's)
const added = [];
const G = { ground: { add: m => added.push(m), remove: () => {} } };
const run = new Function('THREE', 'O', 'PG', 'G', 'o', 'world',
  'const NSLOT = 0; function injectMaterials() {}\nfunction groundB(x, z) { return world.terrainHBuild ? world.terrainHBuild(x, z) : world.terrainH(x, z); }\n' + body +
  '\nconst g = buildPatchSteps(); while (!g.next().done);\nreturn { patch, PL };');
const t0 = Date.now();
const R = run(THREE, O, PG, G, { game: true, patchMat: null, patchUV: null }, W);
const ms = Date.now() - t0;
const blocks = R.patch.children;
const lvTris = [0, 0, 0, 0], lvSkirt = [0, 0, 0, 0];
const rows = blocks.map(lod => ({ pos: [lod.position.x, lod.position.z], levels: lod.levels.map((L, k) => {
  const g = L.object.geometry, tris = g.index.count / 3; lvTris[k] += tris;
  return { d: L.distance, tris }; }) }));
console.log(`PATCH CENSUS (${path.relative(ROOT, SRC)}, patchTolPx ${TOL}): ${blocks.length} blocks, ${R.patch.userData.chunks.length} chunks, built in ${ms} ms`);
console.log('  triangles by level (every block): ' + lvTris.map((t, k) => R.PL.res[k] + ' m ' + t).join(', ') + '; the 2 m level ' + R.patch.userData.tris);
// the levels an eye draws (THREE.LOD: the last level whose distance the eye is past)
const eyes = (arg('--at', null) ? arg('--at').split(',').map(Number) : null);
const views = [];
if (eyes) for (let i = 0; i + 1 < eyes.length; i += 2) views.push({ id: eyes[i] + ',' + eyes[i + 1], x: eyes[i], z: eyes[i + 1] });
else {
  const home = C.siteOf('HOME').stand, w3 = C.siteOf('w3').stand;
  views.push({ id: 'HOME stand', x: home.x, z: home.z });
  const tp = C.siteOf('HOME').taxiOut; if (tp) { const m = tp[Math.floor(tp.length / 2)]; views.push({ id: 'HOME taxi', x: m[0], z: m[1] }); }
  views.push({ id: 'w3 stand', x: w3.x, z: w3.z });
}
const out = { tolPx: TOL, blocks: blocks.length, lvTris, views: [] };
for (const v of views) {
  let tris = 0; const lv = [0, 0, 0, 0];
  for (const b of rows) { const d = Math.hypot(b.pos[0] - v.x, b.pos[1] - v.z); let k = 0; for (let L = 0; L < b.levels.length; L++) if (d >= b.levels[L].d) k = L; tris += b.levels[k].tris; lv[k]++; }
  console.log(`  ${v.id.padEnd(12)} the patch drawn: ${tris} triangles (blocks at 2 / 4 / 8 / 16 m: ${lv.join(' / ')})`);
  out.views.push({ id: v.id, tris, lv });
}
const jf = arg('--json', null);
if (jf) fs.writeFileSync(jf, JSON.stringify(out, null, 1));
