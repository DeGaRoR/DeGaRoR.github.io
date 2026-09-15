#!/usr/bin/env node
// wall_tex_prep.js — bakes the hangar WALL material options: the encoded
// images land as real files under media/tex/walls/ and
// src/viewer/hangar_walls.js becomes the slim manifest of pre-loading <img>
// refs (externalized 2026-09-01 — the data URIs left with the single-file
// artifact; this one file was 25 MB of the old 98).
//
// SOURCE: assets/hangar_walls/<key>/ (Poly Haven CC0, 1k sets; EXR maps
// converted once with ImageMagick — browsers read no EXR). Every set is
// assumed to cover 2 m x 2 m of real wall (the user's ruling); the tile
// size is a live control in the editor's hangar section on top of it.
//
// These are WORKING OPTIONS (user 2026-08-28): the unused ones get
// deleted once a wall is chosen — do not build on all six being here.
//
// Run after changing the source maps: node tools/wall_tex_prep.js
// The output is committed, like the model payloads.
const fs = require('fs');
const path = require('path');
const { writeMedia, pruneMedia, encodeTex, BASE_DECL } = require('./_media_lib.js');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'hangar_walls');
const OUT = path.join(ROOT, 'src', 'viewer', 'hangar_walls.js');
const SUB = 'tex/walls';

// display order: metals first (the shed it is), then the masonry
const SETS = [
  ['factory', 'factory wall'],
  ['rustymetal', 'rusty painted metal'],
  ['rustysheet', 'rusty metal sheet'],
  ['concrete004', 'concrete 004'],
  ['concrete008', 'concrete 008'],
  ['slabwall', 'concrete slab'],
  ['sandstone', 'sandstone brick'],
  // the woods (G59): a boarded shop lining. brown_planks_09 ships a plain
  // rough map; raw_plank_wall packed it as arm's G — both were unpacked to the
  // library's own contract by the import step, so this file stays one recipe.
  ['planks09', 'brown planks'],
  ['rawplank', 'raw plank wall'],
];

// THE MAPS ARE PREPPED (LOADING S4): the role picks the format - the 1k
// JPEG colour and roughness pass through, the PNG normals (1.3-2 MB each,
// 18 MB of the boot) become WebP q92 (~250 KB); the sources stay as-is
const bake = (k, f, role) => {
  const enc = encodeTex(fs.readFileSync(path.join(SRC, k, f)), role, 1024);
  return writeMedia(SUB, `${k}_${f.replace(/\.(jpg|png)$/, '')}`, enc.ext, enc.data);
};

let body = `// GENERATED FILE - DO NOT EDIT. Built by tools/wall_tex_prep.js from
// assets/hangar_walls/ (Poly Haven CC0). The files live under
// media/tex/walls/ (hash-in-filename). A SET LOADS WHEN IT IS READ (LOADING
// S4): the maps are getters that create their Image on first access, so the
// one set the room wears is fetched and the other eight are not (they used
// to start at script eval, 18 MB of every boot) - and every consumer waits
// on img.complete/onload, so a slow network is a late needsUpdate, not a bug.
const HANGAR_WALL_TILE_M = 2;
const HANGAR_WALL_SETS = (typeof Image !== 'undefined') ? (() => {
  ${BASE_DECL}
  const lazy = (name, p) => { const o = { name }, im = {};
    for (const k in p) Object.defineProperty(o, k, { enumerable: true, get() { if (!im[k]) { im[k] = new Image(); im[k].src = B + p[k]; } return im[k]; } });
    return o; };
  return {
`;
let report = [];
const emitted = [];
const sz = rel => fs.statSync(path.join(ROOT, rel)).size;
for (const [k, name] of SETS) {
  const d = bake(k, 'diff_1k.jpg', 'color');
  const n = bake(k, 'nor_gl_1k.png', 'normal');
  const r = bake(k, 'rough_1k.jpg', 'data');
  emitted.push(d, n, r);
  body += `    ${k}: lazy('${name}', { diff: '${d}', nor: '${n}', rough: '${r}' }),\n`;
  report.push(`${k} ${((sz(d) + sz(n) + sz(r)) / 1048576).toFixed(1)} MB`);
}
body += `  };
})() : null;
`;
// THE SKY LEFT THIS FILE AT G62. It was one alps_field equirect riding along
// with the walls; it is a SET of five times of day now, each with the light
// rig measured off its own HDR, and it has its own source, its own tool and
// its own payload: assets/hangar_sky/ -> tools/sky_prep.py ->
// tools/sky_tex_prep.js -> src/viewer/hangar_sky.js. A sky is not a wall.
fs.writeFileSync(OUT, body);
const gone = pruneMedia(SUB, emitted);
console.log(`src/viewer/hangar_walls.js (${(body.length / 1024).toFixed(1)} KB) + ` +
  `${emitted.length} files in media/${SUB}/ — ` + report.join(', ') +
  (gone.length ? ` · pruned ${gone.join(', ')}` : ''));
