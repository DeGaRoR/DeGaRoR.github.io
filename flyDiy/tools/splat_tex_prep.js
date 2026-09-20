#!/usr/bin/env node
// splat_tex_prep.js — bakes THE ISLAND'S GROUND LIBRARY (alpha splatting,
// 2026-09-20): the seventeen sets the splat draws by terrain type - twelve
// Poly Haven packs normalised by tools/splat_tex_import.py under assets/splat/
// and the lot's five (assets/lot/, G290) - land as real files under
// media/tex/splat/ and src/viewer/splat_tex.js becomes the manifest of
// lazily-made Images, like lot_tex.js. The game assembles them into TWO
// texture arrays at boot (render_world.js): colour + height, normal.
//
// THE ORDER IS THE MODULE'S: src/core/28b_ground_fields.js RECIPE.library
// names the sets and their layer index; a code's set is its index there. Add
// a set: import it, append it to RECIPE.library, re-bake. Three maps each at
// 512 (the rough map is imported but not shipped: the ring is a Lambert).
//
// The assets are looked for under this checkout's assets/ first, then the
// main checkout's (a worktree carries no link to it - see the junction rule).
// Run after changing the maps: node tools/splat_tex_prep.js. Committed.
const fs = require('fs');
const path = require('path');
const { writeMedia, pruneMedia, BASE_DECL } = require('./_media_lib.js');
const G = require('../src/core/28b_ground_fields.js');

const ROOT = path.join(__dirname, '..');
const ROOTS = [path.join(ROOT, 'assets'), 'D:/Dev/DeGaRoR.github.io/flyDiy/assets'];
const OUT = path.join(ROOT, 'src', 'viewer', 'splat_tex.js');
const SUB = 'tex/splat';
const LOT = new Set(['lush', 'grass', 'pebble', 'dry', 'dirt']);
const PX = 512;

const find = (key, stem) => {
  for (const r of ROOTS) { const f = path.join(r, LOT.has(key) ? 'lot' : 'splat', key, `${stem}_${PX}.jpg`); if (fs.existsSync(f)) return f; }
  console.error(`splat_tex_prep: missing ${key}/${stem}_${PX}.jpg under ${ROOTS.join(' or ')} — run py -3.11 tools/splat_tex_import.py first`);
  process.exit(1);
};
const bake = (k, stem) => writeMedia(SUB, `${k}_${stem}_${PX}`, 'jpg', fs.readFileSync(find(k, stem)));
// the sets' MEAN colours (linear rgb 0-1), measured by the importer: assets/splat/index.json, assets/lot/means.json
const readJ = rel => { for (const r of ROOTS) { const f = path.join(r, rel); if (fs.existsSync(f)) { try { const j = JSON.parse(fs.readFileSync(f, 'utf8')); if (!Array.isArray(j) || j.length) return j; } catch (e) {} } } return null; };
const MEANS = {};
for (const e of (readJ('splat/index.json') || [])) if (e.mean) MEANS[e.key] = e.mean;
Object.assign(MEANS, readJ('lot/means.json') || {});
const meanOf = k => JSON.stringify(MEANS[k] || [0.2, 0.2, 0.2]);

let body = `// GENERATED FILE - DO NOT EDIT. Built by tools/splat_tex_prep.js from
// assets/splat/ + assets/lot/ (CC0: Poly Haven, ambientCG; see CREDITS.md).
// The files live under media/tex/splat/ (hash-in-filename); a map's Image is
// made when a consumer first reads it (a getter). THE ORDER is the module's
// RECIPE.library (src/core/28b_ground_fields.js): a set's index here is its
// layer in the game's texture arrays.
//
// THE ISLAND'S GROUND LIBRARY (alpha splatting): seventeen sets the splat
// draws by terrain type - colour + height, normal - at 512. \`mean\` is the
// set's mean colour (linear rgb 0-1, measured at import): what a tuft takes
// at its foot (GROUND_FIELDS.groundColor), never a pixel read at runtime.
const SPLAT_TEX_SETS = (typeof Image !== 'undefined') ? (() => {
  ${BASE_DECL}
  const IM = {};
  const mk = src => IM[src] || (IM[src] = (() => { const i = new Image(); i.src = B + src; return i; })());
  return [
`;
const report = [], emitted = [];
const sz = rel => fs.statSync(path.join(ROOT, rel)).size;
for (const [k, metres] of G.RECIPE.library) {
  const d = bake(k, 'diff'), n = bake(k, 'nor_gl'), h = bake(k, 'height');
  emitted.push(d, n, h);
  body += `    { key: '${k}', metres: ${metres}, px: ${PX}, mean: ${meanOf(k)},\n` +
    `      get diff() { return mk('${d}'); },\n      get nor() { return mk('${n}'); },\n      get height() { return mk('${h}'); } },\n`;
  report.push(`${k} ${((sz(d) + sz(n) + sz(h)) / 1048576).toFixed(2)} MB`);
}
body += `  ];
})() : null;
`;
fs.writeFileSync(OUT, body);
const gone = pruneMedia(SUB, emitted);
const total = emitted.reduce((a, r) => a + sz(r), 0);
console.log(`src/viewer/splat_tex.js + ${emitted.length} files in media/${SUB}/ (${(total / 1048576).toFixed(1)} MB) — ` +
  report.join(', ') + (gone.length ? ` · pruned ${gone.join(', ')}` : ''));
