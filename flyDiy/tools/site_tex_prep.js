#!/usr/bin/env node
// site_tex_prep.js — bakes the AIRFIELD ground material options: the encoded
// jpgs land as real files under media/tex/site/ and src/viewer/site_tex.js
// becomes the slim manifest of pre-loading <img> refs (externalized
// 2026-09-01 — the data URIs left with the single-file artifact).
//
// SOURCE: assets/airfield/<key>/ (CC0 — Poly Haven and ambientCG), normalised
// to one contract by `python tools/site_tex_import.py`, which is where the
// three delivered map shapes become diff/nor_gl/rough. This file only picks a
// size and copies the bytes; it knows nothing about arm channels.
//
// THE `tex` FIELD IS A BUDGET, not a fact about the source. The import writes
// every set twice — a 1k archive and a 512 working copy — so promoting a row
// is one number here and a re-run of THIS tool, with no re-import and no loss:
// exactly props_table.py's rule. The budget used to defend index.html's size;
// it now defends the first visit's transfer, which is the same argument at a
// gentler slope.
//
// These are WORKING OPTIONS, like the walls before them: every part can wear
// any set (hangar.js's LIB/PARTS), so the picking happens in the editor and
// the losers get deleted from this table afterwards.
//
// Run after changing the source maps: node tools/site_tex_prep.js
// The output is committed, like the other payloads.
const fs = require('fs');
const path = require('path');
const { writeMedia, pruneMedia, BASE_DECL } = require('./_media_lib.js');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'airfield');
const OUT = path.join(ROOT, 'src', 'viewer', 'site_tex.js');
const SUB = 'tex/site';

// key, label, tile (metres of real ground per tile), tex (512 | 1024).
// `tile` is the set's natural scale and rides along as data — the live control
// is per PART, in the editor, on top of it.
// Display order: what the paving wears, then the ground it stands in.
const SETS = [
  ['brushed',       'brushed concrete',   2,  512],
  ['cracked',       'cracked concrete',   4,  512],
  ['antislip',      'anti-slip concrete', 2,  512],
  ['asphalt',       'asphalt',            4,  512],
  ['asphaltaerial', 'asphalt · aerial',  16,  512],
  ['grass004',      'lawn grass',         2,  512],
  ['grass005',      'field grass',        2,  512],
  ['leafygrass',    'leafy grass',        2,  512],
  ['ground003',     'dry ground',         2,  512],
  ['dirt',          'dirt floor',         2,  512],
];

const sfx = tex => (tex === 1024 ? '1k' : String(tex));
const bake = (k, stem, tex) => {
  const f = path.join(SRC, k, `${stem}_${sfx(tex)}.jpg`);
  if (!fs.existsSync(f)) {
    console.error(`site_tex_prep: missing ${path.relative(ROOT, f)} — ` +
      'run `python tools/site_tex_import.py` first');
    process.exit(1);
  }
  return writeMedia(SUB, `${k}_${stem}_${sfx(tex)}`, 'jpg', fs.readFileSync(f));
};

let body = `// GENERATED FILE - DO NOT EDIT. Built by tools/site_tex_prep.js from
// assets/airfield/ (CC0: Poly Haven + ambientCG; see CREDITS.md). The files
// live under media/tex/site/ (hash-in-filename); loading starts at script
// eval, ahead of the first garage entry building the room or the world scene
// placing the shed — and every consumer waits on img.complete/onload.
//
// Ground materials for the aerodrome's surfaces — apron, taxiway, strip and
// field. They join the same LIB the walls use, so any part can wear any set.
const SITE_TEX_SETS = (typeof Image !== 'undefined') ? (() => {
  ${BASE_DECL}
  const mk = src => { const i = new Image(); i.src = B + src; return i; };
  return {
`;
const report = [];
const emitted = [];
const sz = rel => fs.statSync(path.join(ROOT, rel)).size;
for (const [k, name, tile, tex] of SETS) {
  const d = bake(k, 'diff', tex), n = bake(k, 'nor_gl', tex), r = bake(k, 'rough', tex);
  emitted.push(d, n, r);
  body += `    ${k}: { name: '${name}', tile: ${tile}, px: ${tex},\n` +
    `      diff: mk('${d}'),\n      nor: mk('${n}'),\n` +
    `      rough: mk('${r}') },\n`;
  report.push(`${k} ${sfx(tex)} ${((sz(d) + sz(n) + sz(r)) / 1048576).toFixed(2)} MB`);
}
body += `  };
})() : null;
`;
fs.writeFileSync(OUT, body);
const gone = pruneMedia(SUB, emitted);
console.log(`src/viewer/site_tex.js (${(body.length / 1024).toFixed(1)} KB) + ` +
  `${emitted.length} files in media/${SUB}/ — ` + report.join(', ') +
  (gone.length ? ` · pruned ${gone.join(', ')}` : ''));
