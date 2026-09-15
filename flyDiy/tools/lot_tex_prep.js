#!/usr/bin/env node
// lot_tex_prep.js — bakes THE LOT'S GROUND sets (G290): the five ambientCG
// ground scans the user chose for the village's lots, normalised by
// tools/lot_tex_import.py under assets/lot/, land as real files under
// media/tex/lot/ and src/viewer/lot_tex.js becomes the slim manifest of
// pre-loading <img> refs, like site_tex.js before it.
//
//   lush    the dark dense grass, by the fences
//   grass   the everyday grass
//   pebble  the seafront
//   dry     the least green ground, under the houses
//   dirt    the paths
//
// `tile` is metres of ground per repeat; the lot's ground shader samples every
// set in world metres divided by it. Run after changing the maps:
// node tools/lot_tex_prep.js. The output is committed, like the other payloads.
const fs = require('fs');
const path = require('path');
const { writeMedia, pruneMedia, BASE_DECL } = require('./_media_lib.js');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'lot');
const OUT = path.join(ROOT, 'src', 'viewer', 'lot_tex.js');
const SUB = 'tex/lot';

// key, label, tile (metres per repeat), tex (512 | 1024)
const SETS = [
  ['lush',   'dense grass',    2.4, 512],
  ['grass',  'grass',          2.4, 512],
  ['pebble', 'pebbles',        4.5, 512],     // G293: mapped large - a beach's stones, not gravel
  ['dry',    'dry ground',     2.2, 512],
  ['dirt',   'dirt path',      1.8, 512],
];

const sfx = tex => (tex === 1024 ? '1k' : String(tex));
const bake = (k, stem, tex) => {
  const f = path.join(SRC, k, `${stem}_${sfx(tex)}.jpg`);
  if (!fs.existsSync(f)) {
    console.error(`lot_tex_prep: missing ${path.relative(ROOT, f)} — run python tools/lot_tex_import.py first`);
    process.exit(1);
  }
  return writeMedia(SUB, `${k}_${stem}_${sfx(tex)}`, 'jpg', fs.readFileSync(f));
};

let body = `// GENERATED FILE - DO NOT EDIT. Built by tools/lot_tex_prep.js from
// assets/lot/ (CC0: ambientCG; see CREDITS.md). The files live under
// media/tex/lot/ (hash-in-filename); a map's Image is made when a consumer
// first reads it (a getter), and every consumer waits on img.complete/onload.
// The TABLE below is the baker's; LOT_GROUND after the rule line is hand-
// written and kept across re-bakes (see lot_tex_prep.js).
//
// THE LOT'S GROUND (G290): five sets the lot ground shader splats by the
// plan's own weights - grass and dense grass mixed on a noise, dry ground
// under the buildings, pebbles at the seafront, dirt on the paths.
const LOT_TEX_SETS = (typeof Image !== 'undefined') ? (() => {
  ${BASE_DECL}
  // A SET LOADS WHEN IT IS READ (LOADING S4.1): the maps are getters, the
  // Image made on first access (one per url); nothing here fetches at script eval
  const IM = {};
  const mk = src => IM[src] || (IM[src] = (() => { const i = new Image(); i.src = B + src; return i; })());
  return {
`;
const report = [], emitted = [];
const sz = rel => fs.statSync(path.join(ROOT, rel)).size;
for (const [k, name, tile, tex] of SETS) {
  const d = bake(k, 'diff', tex), n = bake(k, 'nor_gl', tex), r = bake(k, 'rough', tex);
  emitted.push(d, n, r);
  body += `    ${k}: { name: '${name}', tile: ${tile}, px: ${tex},\n` +
    `      get diff() { return mk('${d}'); },\n      get nor() { return mk('${n}'); },\n      get rough() { return mk('${r}'); } },\n`;
  report.push(`${k} ${sfx(tex)} ${((sz(d) + sz(n) + sz(r)) / 1048576).toFixed(2)} MB`);
}
body += `  };
})() : null;
`;
// THE TAIL IS HAND-WRITTEN: G378 put LOT_GROUND (the drawn patch, one keeper
// with the premises bench) under the table in this same file, and G410 hooked
// the atmosphere into it. The baker owns the TABLE; everything from the first
// rule line after it is kept as found - a re-bake must not wipe a module.
const TAIL_AT = '\n// -----';
let tail = '';
if (fs.existsSync(OUT)) {
  const cur = fs.readFileSync(OUT, 'utf8');
  const i = cur.indexOf(TAIL_AT);
  if (i >= 0) tail = cur.slice(i);
}
if (!tail) console.log('  note: no hand-written tail found under the table (LOT_GROUND lives there since G378)');
fs.writeFileSync(OUT, body + tail);
const gone = pruneMedia(SUB, emitted);
console.log(`src/viewer/lot_tex.js (${(body.length / 1024).toFixed(1)} KB) + ${emitted.length} files in media/${SUB}/ — ` +
  report.join(', ') + (gone.length ? ` · pruned ${gone.join(', ')}` : ''));
