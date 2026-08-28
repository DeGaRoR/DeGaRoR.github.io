#!/usr/bin/env node
// floor_tex_prep.js — bakes the hangar floor's PBR maps into
// src/viewer/hangar_floor.js as pre-decoding <img> data URIs.
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

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'concrete_floor_damaged_01');
const OUT = path.join(ROOT, 'src', 'viewer', 'hangar_floor.js');

const uri = (f, mime) =>
  `data:${mime};base64,` + fs.readFileSync(path.join(SRC, f)).toString('base64');

const maps = {
  diff: uri('diff_1k.jpg', 'image/jpeg'),
  nor: uri('nor_gl_1k.png', 'image/png'),
  rough: uri('rough_1k.jpg', 'image/jpeg'),
};

let body = `// GENERATED FILE - DO NOT EDIT. Built by tools/floor_tex_prep.js from
// assets/concrete_floor_damaged_01/ (Poly Haven CC0). The images start
// decoding at script eval, so they are ready long before the first
// garage entry bakes the room.
const HANGAR_FLOOR_TILE_M = 5;
const HANGAR_FLOOR_IMG = (typeof Image !== 'undefined') ? (() => {
  const mk = src => { const i = new Image(); i.src = src; return i; };
  return {
`;
for (const k of Object.keys(maps))
  body += `    ${k}: mk('${maps[k]}'),\n`;
body += `  };
})() : null;
`;
fs.writeFileSync(OUT, body);
const kb = n => (n / 1024).toFixed(1) + ' KB';
console.log(`src/viewer/hangar_floor.js (${kb(body.length)}) — ` +
  Object.entries(maps).map(([k, v]) => `${k} ${kb(v.length)}`).join(', '));
