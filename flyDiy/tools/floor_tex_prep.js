#!/usr/bin/env node
// floor_tex_prep.js — bakes the hangar floor's PBR maps: the encoded images
// land as real files under media/tex/floor/ and src/viewer/hangar_floor.js
// becomes the slim manifest of pre-loading <img> refs (externalized
// 2026-09-01 — the data URIs left with the single-file artifact).
//
// SOURCE: assets/concrete_floor_damaged_01/ (Poly Haven CC0,
// "concrete_floor_damaged_01", 1k set; the EXR normal/rough maps were
// converted to PNG/JPG once with ImageMagick — browsers read no EXR).
// The tile covers 5 m x 5 m of real floor (the asset's stated scale);
// hangar.js reads that from the payload rather than knowing it.
//
// Run after changing the source maps: node tools/floor_tex_prep.js
// The output is committed, like the model payloads.
const fs = require('fs');
const path = require('path');
const { writeMedia, pruneMedia, BASE_DECL } = require('./_media_lib.js');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'concrete_floor_damaged_01');
const OUT = path.join(ROOT, 'src', 'viewer', 'hangar_floor.js');
const SUB = 'tex/floor';

const bake = (k, f, ext) =>
  writeMedia(SUB, k, ext, fs.readFileSync(path.join(SRC, f)));

const maps = {
  diff: bake('diff', 'diff_1k.jpg', 'jpg'),
  nor: bake('nor', 'nor_gl_1k.png', 'png'),
  rough: bake('rough', 'rough_1k.jpg', 'jpg'),
};

let body = `// GENERATED FILE - DO NOT EDIT. Built by tools/floor_tex_prep.js from
// assets/concrete_floor_damaged_01/ (Poly Haven CC0). The files live under
// media/tex/floor/ (hash-in-filename); loading starts at script eval, well
// ahead of the first garage entry baking the room — and every consumer
// already waits on img.complete/onload, so a slow network degrades to a
// late needsUpdate, never to a broken room.
const HANGAR_FLOOR_TILE_M = 5;
const HANGAR_FLOOR_IMG = (typeof Image !== 'undefined') ? (() => {
  ${BASE_DECL}
  const mk = src => { const i = new Image(); i.src = B + src; return i; };
  return {
`;
for (const k of Object.keys(maps))
  body += `    ${k}: mk('${maps[k]}'),\n`;
body += `  };
})() : null;
`;
fs.writeFileSync(OUT, body);
const gone = pruneMedia(SUB, Object.values(maps));
const kb = n => (n / 1024).toFixed(1) + ' KB';
console.log(`src/viewer/hangar_floor.js (${kb(body.length)}) + 3 files in media/${SUB}/ — ` +
  Object.entries(maps).map(([k, v]) =>
    `${k} ${kb(fs.statSync(path.join(ROOT, v)).size)}`).join(', ') +
  (gone.length ? ` · pruned ${gone.join(', ')}` : ''));
