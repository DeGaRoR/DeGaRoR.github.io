#!/usr/bin/env node
// wall_tex_prep.js — bakes the hangar WALL material options into
// src/viewer/hangar_walls.js as pre-decoding <img> data URIs.
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

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'hangar_walls');
const OUT = path.join(ROOT, 'src', 'viewer', 'hangar_walls.js');

// display order: metals first (the shed it is), then the masonry
const SETS = [
  ['factory', 'factory wall'],
  ['rustymetal', 'rusty painted metal'],
  ['concrete004', 'concrete 004'],
  ['concrete008', 'concrete 008'],
  ['slabwall', 'concrete slab'],
  ['sandstone', 'sandstone brick'],
];

const uri = (k, f, mime) =>
  `data:${mime};base64,` +
  fs.readFileSync(path.join(SRC, k, f)).toString('base64');

let body = `// GENERATED FILE - DO NOT EDIT. Built by tools/wall_tex_prep.js from
// assets/hangar_walls/ (Poly Haven CC0). Images start decoding at
// script eval, ready long before the first garage entry builds the room.
const HANGAR_WALL_TILE_M = 2;
const HANGAR_WALL_SETS = (typeof Image !== 'undefined') ? (() => {
  const mk = src => { const i = new Image(); i.src = src; return i; };
  return {
`;
let report = [];
for (const [k, name] of SETS) {
  const d = uri(k, 'diff_1k.jpg', 'image/jpeg');
  const n = uri(k, 'nor_gl_1k.png', 'image/png');
  const r = uri(k, 'rough_1k.jpg', 'image/jpeg');
  body += `    ${k}: { name: '${name}',\n` +
    `      diff: mk('${d}'),\n      nor: mk('${n}'),\n` +
    `      rough: mk('${r}') },\n`;
  report.push(`${k} ${((d.length + n.length + r.length) / 1048576).toFixed(1)} MB`);
}
body += `  };
})() : null;
`;
fs.writeFileSync(OUT, body);
console.log(`src/viewer/hangar_walls.js (${(body.length / 1048576).toFixed(1)} MB) — ` +
  report.join(', '));
