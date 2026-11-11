#!/usr/bin/env node
// fiche_physics_bake.js - PHYSICS-PAGES: THE OFFICIAL PLANES' PHYSICS PAGES, BAKED. The official fiches ship baked
// (tools/fiche_bake.js, a graphics-card run); their physics pages' DATA needs no graphics card: each official plane through
// the game's load door (tools/_load_build.js), then genFichePages (66c), written beside the plane's fiche pictures:
//   media/fiches/<key>/physics.json        (fiche_physics.js dataFor reads it from its side picture's folder)
// The pictures' frames are not baked: the page fits them on its own pictures (fitFrame).
//   node tools/fiche_physics_bake.js [--only <key,key>] [--jobs N] [--dry]
'use strict';
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const T = __dirname, FLY = path.join(T, '..'), OUT = path.join(FLY, 'media', 'fiches');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const safe = k => k.replace(/[^\w.-]+/g, '_');
if (argv[0] === '--one') {
  const C = require(path.join(T, 'flight_core.js')), LB = require(path.join(T, '_load_build.js'));
  const [file, dir] = [argv[1], argv[2]], t0 = Date.now();
  // the drawn hubs: the editor's engine record (CAGE_ENG) read in the load door's own scene by a two-line probe, then
  // 64c genAidPropOff - the model page draws the propeller discs where the blades are drawn
  const PR = path.join(require('os').tmpdir(), 'fiche_physics_cage_eng.probe.js');
  fs.writeFileSync(PR, 'const U = window.CAGE_ENG && window.CAGE_ENG.units;\nreturn U ? { units: U.map(u => u && { at: u.at && Array.from(u.at), propAt: u.propAt && Array.from(u.propAt) }) } : null;\n');
  process.env.FLYDIY_JOIN_PROBE = PR;
  const B = LB.loadBuild(file), CE = B.probe && typeof B.probe === 'object' ? B.probe : null;
  const D = C.genFichePages(C.buildGen(B.spec), { propOff: C.genAidPropOff(CE) });
  fs.mkdirSync(path.join(OUT, dir), { recursive: true });
  fs.writeFileSync(path.join(OUT, dir, 'physics.json'), JSON.stringify(D));
  console.log(`${dir.padEnd(36)} ${(JSON.stringify(D).length / 1024).toFixed(0)} KB  ${D.load && D.load.verdict}  ${D.destroy && D.destroy.verdict}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  process.exit(0);
}
const L = JSON.parse(fs.readFileSync(path.join(FLY, 'builds', 'lists', 'plane_lists.json'), 'utf8'));
const only = opt('only', '') ? opt('only').split(',') : null;
const rows = L.planes.filter(p => p.list === 'official' && p.file && p.thumb && (!only || only.includes(p.thumb)));
if (argv.includes('--dry')) { for (const r of rows) console.log(r.thumb.padEnd(40), safe(r.thumb).padEnd(36), r.file); process.exit(0); }
const jobs = +opt('jobs', '3');
let next = 0, bad = 0;
const one = () => { if (next >= rows.length) return Promise.resolve();
  const r = rows[next++];
  return new Promise(res => { const p = spawn(process.execPath, [__filename, '--one', r.file, safe(r.thumb)], { cwd: FLY, stdio: ['ignore', 'inherit', 'pipe'] });
    let err = ''; p.stderr.on('data', d => { err += d; });
    p.on('close', c => { if (c) { bad++; console.log(`${safe(r.thumb).padEnd(36)} FAILED: ${err.trim().split('\n').pop()}`); } res(); }); }).then(one); };
Promise.all(Array.from({ length: Math.min(jobs, rows.length) }, one)).then(() => { console.log(`fiche_physics_bake: ${rows.length - bad} of ${rows.length}`); process.exit(bad ? 1 : 0); });
