#!/usr/bin/env node
// crew_cut/dump.js - THE COCKPIT AS THE GAME DRAWS IT, DUMPED (16 Nov 2026, the LS4's pilot and clearances).
//   node tools/crew_cut/dump.js <build.json> <out-prefix> [--over '{"seatZ":-0.4}']
// The load chain (tools/_load_build.js: the characters loaded, the crew, the panel, the tanks - what the game builds)
// runs probe_scene.js after its last build: every visible mesh's triangles in the layer frame, metres (skinned meshes -
// the pilot - posed), tagged by layer and name, and the pilot's reach misses; and _scene_headless builds the fuselage
// SHEET (the hull, the glass, the liner - the load chain's scene has none), in the same frame.
// -> <out>.json { meshes:[{layer,name,col,op,skinned,P:[mm...]}], reach, zBack } and <out>_sheet.json { F:[[mat, 9 mm]] }
// `--over` writes cage rows over the build's first (a variant without a file). Then: cut.py, poke.py, clash.py.
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const pos = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
if (pos.length < 2) { console.error('usage: node tools/crew_cut/dump.js <build.json> <out-prefix> [--over JSON]'); process.exit(2); }
const FLY = path.resolve(__dirname, '..', '..'), T = path.join(FLY, 'tools');
const raw = JSON.parse(fs.readFileSync(path.resolve(pos[0]), 'utf8')), OUT = path.resolve(pos[1]);
const over = JSON.parse(opt('over', '{}'));
const b = raw.spec ? raw : { what: 'flydiy-build', v: 10, name: 'dump', spec: raw };
b.spec.cage = Object.assign({}, b.spec.cage || {}, over);
// (the load chain takes a path under the tree: a temporary copy beside the candidates, removed after)
const tmp = path.join(FLY, 'builds', 'candidates', '_crewcut_' + process.pid + '.json');
fs.writeFileSync(tmp, JSON.stringify(b));
try {
  process.chdir(FLY);
  process.env.FLYDIY_JOIN_PROBE = path.join(__dirname, 'probe_scene.js'); process.env.FLYDIY_JOIN_NOCACHE = '1';
  const LB = require(path.join(T, '_load_build.js'));
  const L = LB.loadBuild(path.relative(FLY, tmp));
  fs.writeFileSync(OUT + '.json', JSON.stringify(L.probe));
  const SH = require(path.join(T, '_scene_headless.js'));
  const S = SH.sceneBuild(b.spec, { garage: b.spec }), sh = S.built.sheet, FS = S.FS, F = [];
  for (const f of sh.F) { if (f.v.length < 3) continue;
    for (let t = 1; t + 1 < f.v.length; t++) { const a = sh.V[f.v[0]], c = sh.V[f.v[t]], d = sh.V[f.v[t + 1]];
      F.push([f.m, ...[a, c, d].flatMap(p => p.map(x => Math.round(x * FS * 1000)))]); } }
  fs.writeFileSync(OUT + '_sheet.json', JSON.stringify({ F }));
  const by = {}; for (const m of L.probe.meshes) by[m.layer || '?'] = (by[m.layer || '?'] || 0) + m.P.length / 9;
  console.log('CREW_CUT_DUMP ' + JSON.stringify({ out: OUT, triangles: by, sheet: F.length, reach: L.probe.reach, zBack: L.probe.zBack }));
} finally { try { fs.unlinkSync(tmp); } catch (e) {} }
