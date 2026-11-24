#!/usr/bin/env node
// GARAGE-VIEW, step 5: INSTALL - a cooked scene into the game's media, and its row into the pack list the page reads.
//
//   node tools/garage_view/install.js --scene <cook's out dir> [--dry]
//     -> media/garage_view/<pack>/scene.json + scene.bin + the pictures
//     -> src/core/garage_view_packs.json   { v, packs: [{ id, world, field, sheds: [{ id, x, y, z, ry }], base, rev, sig,
//                                             tris, bytes: { bin, textures }, made }] }
// The page (src/viewer/garage_view.js find) picks a room's scene by its world, its field and its shed. `sig` is what the
// scene was cooked FROM - the fixture's rev and every shed's place and yaw: GATE GARAGEVIEW (tools/_garageview_check.js)
// compares it with today's record and names the pack to cook again when a hangar moved or the record changed.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const SRC = opt('scene'), DRY = argv.includes('--dry');
if (!SRC || !fs.existsSync(path.join(SRC, 'scene.json'))) { console.error('usage: install.js --scene <dir with scene.json>'); process.exit(2); }
const J = JSON.parse(fs.readFileSync(path.join(SRC, 'scene.json'), 'utf8'));
if (!J.pack || !J.world || !J.field) { console.error('install: scene.json carries no pack / world / field (cook it from a measure.json made with --site)'); process.exit(1); }
const { sigOf } = require('./site.js');
const TX = Object.keys(J.textures || {}).map(k => J.textures[k]);
const files = ['scene.json', 'scene.bin'].concat(TX.map(t => t.file), TX.filter(t => t.ktx2).map(t => t.ktx2));
for (const f of files) if (!fs.existsSync(path.join(SRC, f))) { console.error('install: ' + f + ' is named by scene.json and is not in ' + SRC); process.exit(1); }
const DST = path.join(ROOT, 'media', 'garage_view', J.pack), size = f => fs.statSync(path.join(SRC, f)).size;
const row = { id: J.pack, world: J.world, field: J.field, sheds: J.sheds.map(s => ({ id: s.id, x: s.x, y: s.y, z: s.z, ry: s.ry })), base: 'media/garage_view/' + J.pack + '/',
  files: files.map(f => 'media/garage_view/' + J.pack + '/' + f),   // (GATE MEDIA's manifest: every file of the scene by its media/ path)
  rev: J.rev || null, sig: sigOf(J.rev || null, J.sheds), tris: J.meshes.reduce((a, m) => a + m.tris, 0), meshes: J.meshes.length,
  bytes: { bin: size('scene.bin'), textures: TX.reduce((a, t) => a + size(t.ktx2 || t.file), 0), fallback: TX.reduce((a, t) => a + size(t.file), 0),
    gpu: Math.round(TX.reduce((a, t) => a + (t.ktx2Size ? t.ktx2Size[0] * t.ktx2Size[1] * 1.33 : (t.size ? t.size[0] * t.size[1] * 5.33 : 0)), 0)) }, ktx2: TX.filter(t => t.ktx2).length, made: J.made };
const PF = path.join(ROOT, 'src', 'core', 'garage_view_packs.json');
const PK = fs.existsSync(PF) ? JSON.parse(fs.readFileSync(PF, 'utf8')) : { v: 1, packs: [] };
PK.packs = PK.packs.filter(p => p.id !== row.id).concat([row]).sort((a, b) => a.id < b.id ? -1 : 1);
console.log('install: ' + row.id + '  ' + row.world + ' / ' + row.field + '  sheds ' + row.sheds.map(s => s.id).join(', ') + '  ' + row.tris + ' triangles, scene.bin ' + (row.bytes.bin / 1024).toFixed(0) + ' kB, pictures ' + (row.bytes.textures / 1048576).toFixed(2) + ' MB (' + row.ktx2 + ' as KTX2; about ' + (row.bytes.gpu / 1048576).toFixed(0) + ' MB on the GPU), sig ' + row.sig);
if (DRY) { console.log('install: --dry, nothing written'); process.exit(0); }
fs.mkdirSync(DST, { recursive: true });
for (const f of fs.readdirSync(DST)) if (!files.includes(f)) fs.unlinkSync(path.join(DST, f));   // a picture the scene no longer names
for (const f of files) fs.copyFileSync(path.join(SRC, f), path.join(DST, f));
fs.writeFileSync(PF, JSON.stringify(PK, null, 1) + '\n');
console.log('install: -> ' + DST + ' ; ' + path.relative(ROOT, PF) + ' (' + PK.packs.length + ' pack' + (PK.packs.length > 1 ? 's' : '') + ')');
