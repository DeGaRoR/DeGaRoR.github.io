#!/usr/bin/env node
// pavement_tex_prep.js — bakes THE PAVEMENT LIBRARY (roads & runways,
// 2026-09-21): the sets the pavement material (src/viewer/pavement.js) draws
// roads and runways with - fourteen Poly Haven packs fetched and normalised by
// tools/pavement_tex_import.py under assets/pavement/, four of the airfield's
// (assets/airfield/, their heights integrated by the same importer) and the
// lot's five (assets/lot/) - land as real files under media/tex/pavement/ and
// src/viewer/pavement_tex.js becomes the manifest of lazily-made Images, keyed
// by set. Four maps each at 512: colour, normal, roughness, height.
//
// NOT AN ORDERED LIST: unlike splat_tex.js, a set's layer in the pavement's
// texture arrays is assigned when a page builds them from the sets its
// recipe actually names (PAVEMENT.library) - the manifest is a dictionary,
// the arrays are per page, and a class can be re-pointed at any set without
// a re-bake. The airfield and lot sets are baked AGAIN here (a copy under
// this baker's own directory): every baker owns its media/ subdirectory and
// prunes it, so a cross-reference into media/tex/site would break the moment
// site_tex_prep re-hashed a file.
//
// The assets are looked for under this checkout's assets/ first, then the
// main checkout's (a worktree carries no link to it - see the junction rule).
// Run after changing the maps: node tools/pavement_tex_prep.js. Committed.
'use strict';
const fs = require('fs');
const path = require('path');
const { writeMedia, pruneMedia, BASE_DECL } = require('./_media_lib.js');

const ROOT = path.join(__dirname, '..');
const ROOTS = [path.join(ROOT, 'assets'), 'D:/Dev/DeGaRoR.github.io/flyDiy/assets'];
const OUT = path.join(ROOT, 'src', 'viewer', 'pavement_tex.js');
const SUB = 'tex/pavement';
const PX = 512;

// the airfield's and the lot's, with THEIR REAL SIZES (api.polyhaven.com/info, ambientCG's
// pages) - not the eye-picked `tile` site_tex_prep.js / lot_tex_prep.js carry for the old ground
const LEGACY = [
  // key, dir, metres, role, label, source, slug
  ['cracked',       'airfield', 2.23, 'base',   'cracked concrete (the old runway look)', 'Poly Haven', 'cracked_concrete_02'],
  ['brushed',       'airfield', 2.0,  'base',   'brushed concrete (the apron)',            'Poly Haven', 'brushed_concrete_04'],
  ['asphalt',       'airfield', 3.0,  'base',   'asphalt',                                'Poly Haven', 'asphalt_02'],
  ['asphaltaerial', 'airfield', 30.0, 'macro',  'asphalt from above (the macro tier)',    'Poly Haven', 'aerial_asphalt_01'],
  ['leafygrass',    'airfield', 2.0,  'grass',  'leafy grass (the rougher lawn)',        'Poly Haven', 'leafy_grass'],
  ['fieldgrass',    'airfield', 2.0,  'grass',  'field grass (the strip)',               'ambientCG',  'Grass005'],
  ['lush',          'lot',      2.4,  'grass',  'dense grass',                            'ambientCG',  'Grass001'],
  ['grass',         'lot',      2.4,  'grass',  'grass',                                  'ambientCG',  'Grass004'],
  ['pebble',        'lot',      4.5,  'shoulder','pebbles',                               'ambientCG',  'Gravel022'],
  ['dry',           'lot',      2.2,  'shoulder','dry ground (the cleared band)',         'ambientCG',  'Ground081'],
  ['dirt',          'lot',      1.8,  'base',   'dirt path',                              'ambientCG',  'Ground110'],
];

const find = (dir, key, stem) => {
  const sub = key === 'fieldgrass' ? 'grass005' : key;   // the airfield's own directory name
  // a reused set's colour and height come from the importer's flattened copy (assets/pavement/_legacy/<key>/)
  const dirs = (dir === 'pavement') ? [[dir, key]] : ((stem === 'diff' || stem === 'height' || stem === 'nor_gl') ? [['pavement/_legacy', sub], [dir, sub]] : [[dir, sub]]);
  for (const r of ROOTS) for (const [dd, kk] of dirs) { const f = path.join(r, dd, kk, `${stem}_${PX}.jpg`); if (fs.existsSync(f)) return f; }
  console.error(`pavement_tex_prep: missing ${dir}/${key}/${stem}_${PX}.jpg under ${ROOTS.join(' or ')} — run py -3.11 tools/pavement_tex_import.py --fetch first`);
  process.exit(1);
};
const readJ = rel => { for (const r of ROOTS) { const f = path.join(r, rel); if (fs.existsSync(f)) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) {} } } return null; };
const index = readJ('pavement/index.json') || [];
if (!index.length) { console.error('pavement_tex_prep: no assets/pavement/index.json — run the importer'); process.exit(1); }
const lotMeans = readJ('lot/means.json') || {};

const rows = [];
for (const e of index) rows.push({ key: e.key, dir: 'pavement', metres: e.metres, role: e.role, label: e.label, mean: e.mean, source: e.source, slug: e.slug, authors: e.authors || '' });
for (const [key, dir, metres, role, label, source, slug] of LEGACY) rows.push({ key, dir, metres, role, label, mean: lotMeans[key] || null, source, slug, authors: '' });

const emitted = [], report = [];
const sz = rel => fs.statSync(path.join(ROOT, rel)).size;
let body = `// GENERATED FILE - DO NOT EDIT. Built by tools/pavement_tex_prep.js from
// assets/pavement/ (fetched off Poly Haven by tools/pavement_tex_import.py),
// assets/airfield/ and assets/lot/ (CC0: Poly Haven, ambientCG; see CREDITS.md).
// The files live under media/tex/pavement/ (hash-in-filename); a map's Image
// is made when a consumer first reads it (a getter).
//
// THE PAVEMENT LIBRARY (roads & runways): the sets src/viewer/pavement.js
// draws roads and runways with - colour, normal, roughness, height, at 512 -
// KEYED BY SET; a page assembles the ones its recipe names into two texture
// arrays (PAVEMENT.library). \`metres\` is the texture's real size (the
// shader tiles by it); \`mean\` the set's mean colour (linear rgb 0-1) for
// the far tier and the tufts' feet; \`role\` what the class rows reach for.
const PAVEMENT_TEX_SETS = (typeof Image !== 'undefined') ? (() => {
  ${BASE_DECL}
  const IM = {};
  const mk = src => IM[src] || (IM[src] = (() => { const i = new Image(); i.src = B + src; return i; })());
  return {
`;
for (const r of rows) {
  const d = writeMedia(SUB, `${r.key}_diff_${PX}`, 'jpg', fs.readFileSync(find(r.dir, r.key, 'diff')));
  const n = writeMedia(SUB, `${r.key}_nor_gl_${PX}`, 'jpg', fs.readFileSync(find(r.dir, r.key, 'nor_gl')));
  const g = writeMedia(SUB, `${r.key}_rough_${PX}`, 'jpg', fs.readFileSync(find(r.dir, r.key, 'rough')));
  const h = writeMedia(SUB, `${r.key}_height_${PX}`, 'jpg', fs.readFileSync(find(r.dir, r.key, 'height')));
  emitted.push(d, n, g, h);
  body += `    ${r.key}: { name: ${JSON.stringify(r.label)}, metres: ${r.metres}, px: ${PX}, role: '${r.role}', mean: ${JSON.stringify(r.mean)},\n` +
    `      get diff() { return mk('${d}'); },\n      get nor() { return mk('${n}'); },\n      get rough() { return mk('${g}'); },\n      get height() { return mk('${h}'); } },\n`;
  report.push(`${r.key} ${((sz(d) + sz(n) + sz(g) + sz(h)) / 1048576).toFixed(2)} MB`);
}
body += `  };
})() : null;
// the library's provenance, for CREDITS.md and the gate (never read at runtime)
const PAVEMENT_TEX_CREDITS = ${JSON.stringify(rows.map(r => ({ key: r.key, source: r.source, slug: r.slug, licence: 'CC0', metres: r.metres })), null, 0)};
if (typeof module !== 'undefined' && module.exports) module.exports = { PAVEMENT_TEX_CREDITS };
`;
fs.writeFileSync(OUT, body);
const gone = pruneMedia(SUB, emitted);
const total = emitted.reduce((a, r) => a + sz(r), 0);
console.log(`src/viewer/pavement_tex.js + ${emitted.length} files in media/${SUB}/ (${(total / 1048576).toFixed(1)} MB) — ` +
  report.join(', ') + (gone.length ? ` · pruned ${gone.join(', ')}` : ''));
