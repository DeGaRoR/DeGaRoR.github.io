#!/usr/bin/env node
// fiche_physics_bake.js - PHYSICS-PAGES: THE OFFICIAL PLANES' PHYSICS PAGES, BAKED. The official fiches ship baked
// (tools/fiche_bake.js, a graphics-card run); their physics pages' DATA needs no graphics card: each official plane through
// the game's load door (tools/_load_build.js), then genFichePages (66c), written beside the plane's fiche pictures:
//   media/fiches/<key>/physics.json        (fiche_physics.js dataFor reads it from its side picture's folder)
// The pictures' frames are not baked: the page fits them on its own pictures (fitFrame).
//   node tools/fiche_physics_bake.js [--only <key,key>] [--jobs N] [--dry] [--prune]   (a full bake prunes the fiches gone from the index; --prune alone only prunes)
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
// EVERY BAKED FICHE (the board's index, media/fiches/index.json: its key, its pictures' folder, the list row's build file),
// not only the official list: the strip shows the physics sections on every baked fiche (12 Nov, 24 of them)
const IX = JSON.parse(fs.readFileSync(path.join(OUT, 'index.json'), 'utf8')).fiches || {};
const only = opt('only', '') ? opt('only').split(',') : null;
// (an index from before the fiche pass carries no listFile: the official list's row of the same key gives the file)
const LROWS = (() => { try { return JSON.parse(fs.readFileSync(path.join(FLY, 'builds', 'lists', 'plane_lists.json'), 'utf8')).planes || []; } catch (e) { return []; } })();
const fileOf = (k, f) => f.listFile || ((LROWS.find(p => p.thumb === k && p.file) || {}).file);
const rows = Object.entries(IX).map(([k, f]) => ({ thumb: k, dir: ((f.pics && f.pics.side) || '').split('/')[0], file: fileOf(k, f) }))
  .filter(r => r.dir && r.file && fs.existsSync(path.join(FLY, r.file)) && (!only || only.includes(r.thumb)));
for (const [k, f] of Object.entries(IX)) if (!rows.find(r => r.thumb === k) && (!only || only.includes(k))) console.log(k.padEnd(40), 'SKIPPED: no build file (' + (fileOf(k, f) || 'none') + ')');
// THE PRUNE: a fiche gone from the index takes its physics.json with it (and its folder, when nothing else is left in it) -
// after every full bake, or alone with --prune (GATE MEDIA calls a file no manifest names an orphan)
function prune() {
  const keep = new Set(Object.values(IX).map(f => ((f.pics && f.pics.side) || '').split('/')[0]).filter(Boolean));
  for (const d of fs.readdirSync(OUT)) { const f = path.join(OUT, d, 'physics.json');
    if (keep.has(d) || !fs.existsSync(f)) continue;
    fs.unlinkSync(f); if (!fs.readdirSync(path.join(OUT, d)).length) fs.rmdirSync(path.join(OUT, d));
    console.log(d.padEnd(36), 'PRUNED: no longer in the index'); }
}
if (argv.includes('--prune')) { prune(); process.exit(0); }
if (argv.includes('--dry')) { for (const r of rows) console.log(r.thumb.padEnd(40), r.dir.padEnd(36), r.file); process.exit(0); }
const jobs = +opt('jobs', '3');
let next = 0, bad = 0;
const one = () => { if (next >= rows.length) return Promise.resolve();
  const r = rows[next++];
  return new Promise(res => { const p = spawn(process.execPath, [__filename, '--one', r.file, r.dir], { cwd: FLY, stdio: ['ignore', 'inherit', 'pipe'] });
    let err = ''; p.stderr.on('data', d => { err += d; });
    p.on('close', c => { if (c) { bad++; console.log(`${r.dir.padEnd(36)} FAILED: ${err.trim().split('\n').pop()}`); } res(); }); }).then(one); };
Promise.all(Array.from({ length: Math.min(jobs, rows.length) }, one)).then(() => { if (!only && !bad) prune(); console.log(`fiche_physics_bake: ${rows.length - bad} of ${rows.length}`); process.exit(bad ? 1 : 0); });
