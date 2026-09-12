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
  ['pebble', 'pebbles',        1.6, 512],
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
// media/tex/lot/ (hash-in-filename); loading starts at script eval and every
// consumer waits on img.complete/onload.
//
// THE LOT'S GROUND (G290): five sets the lot ground shader splats by the
// plan's own weights - grass and dense grass mixed on a noise, dry ground
// under the buildings, pebbles at the seafront, dirt on the paths.
const LOT_TEX_SETS = (typeof Image !== 'undefined') ? (() => {
  ${BASE_DECL}
  const mk = src => { const i = new Image(); i.src = B + src; return i; };
  return {
`;
const report = [], emitted = [];
const sz = rel => fs.statSync(path.join(ROOT, rel)).size;
for (const [k, name, tile, tex] of SETS) {
  const d = bake(k, 'diff', tex), n = bake(k, 'nor_gl', tex), r = bake(k, 'rough', tex);
  emitted.push(d, n, r);
  body += `    ${k}: { name: '${name}', tile: ${tile}, px: ${tex},\n` +
    `      diff: mk('${d}'),\n      nor: mk('${n}'),\n      rough: mk('${r}') },\n`;
  report.push(`${k} ${sfx(tex)} ${((sz(d) + sz(n) + sz(r)) / 1048576).toFixed(2)} MB`);
}
body += `  };
})() : null;
`;
fs.writeFileSync(OUT, body);
const gone = pruneMedia(SUB, emitted);
console.log(`src/viewer/lot_tex.js (${(body.length / 1024).toFixed(1)} KB) + ${emitted.length} files in media/${SUB}/ — ` +
  report.join(', ') + (gone.length ? ` · pruned ${gone.join(', ')}` : ''));
