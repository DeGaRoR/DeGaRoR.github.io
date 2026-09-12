#!/usr/bin/env node
// skin_tex_prep.js — bakes the scanned AEROSKIN detail sheets that are not
// wood: the encoded jpgs land as real files under media/tex/skin/ and
// src/viewer/skin_tex.js becomes the slim manifest of pre-loading <img> refs.
//
// wood_tex_prep.js's twin, and deliberately its copy: one recipe, no channel
// knowledge, the same budget field, the same prune. The split is by SOURCE
// LIBRARY, not by technique — assets/wood/ is the grain the wooden airframes
// wear, assets/skin/ is everything else the finish table asks for, starting
// with the firewall's fireproof foil.
//
// SOURCE: assets/skin/<key>/, normalised AND PACKED into aeroskin.js's own
// sheet layout by `python tools/skin_tex_import.py` (R,G tangent normal / B
// the 0.80-mean ride / A left to drawImage's 255).
//
// The `tex` FIELD IS A BUDGET, not a fact about the source: the import writes
// a 1k archive beside the 512 working copy, so promoting a sheet is one
// number here and a re-run — but note AERO_TEX is 512 and POT is a WebGL1
// requirement (GATE SKINMAT holds it), so 1024 is the only promotion there is.
//
// These sheets are claimed by AERO_FINISH rows through their `sheet:` field;
// a key nothing claims is dead weight the gate will name.
//
// Run after changing the source maps: node tools/skin_tex_prep.js
// The output is committed, like the other payloads.
const fs = require('fs');
const path = require('path');
const { writeMedia, pruneMedia, BASE_DECL } = require('./_media_lib.js');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'skin');
const OUT = path.join(ROOT, 'src', 'viewer', 'skin_tex.js');
const SUB = 'tex/skin';

// key, tex (512 | 1024)
const SETS = [
  ['foil', 512],
  // THE ONE PROMOTION IN THE TABLE, and it is the user's call (2026-09-04):
  // "the front panel is something we are going to see a lot, so let's not
  // reduce that too much". The instrument facia is the surface the camera
  // spends the most time nearest to, and it is the only sheet here that is
  // asked to hold up at 300 mm — so `panel` takes the 1k payload and the
  // leather that surrounds it stays on the 512 every other sheet uses.
  ['panel', 1024],
  ['leather', 512],
  // the cockpit's hands-on surfaces (the panel arc, session 4f)
  ['plasticScr', 512], ['plasticGrn', 512], ['plasticWorn', 512], ['rubberGrip', 512], ['hide', 512],
];

const sfx = tex => (tex === 1024 ? '1k' : String(tex));
const bake = (k, tex) => {
  const f = path.join(SRC, k, `aero_${sfx(tex)}.jpg`);
  if (!fs.existsSync(f)) {
    console.error(`skin_tex_prep: missing ${path.relative(ROOT, f)} — ` +
      'run `python tools/skin_tex_import.py` first');
    process.exit(1);
  }
  return writeMedia(SUB, `${k}_aero_${sfx(tex)}`, 'jpg', fs.readFileSync(f));
};

let body = `// GENERATED FILE - DO NOT EDIT. Built by tools/skin_tex_prep.js from
// assets/skin/ (CC0: ambientCG; see CREDITS.md). Each image IS an AEROSKIN
// detail sheet (R,G normal / B the 0.80-mean ride) — DATA, not a picture;
// aeroDetailTex draws it linear. The files live under media/tex/skin/
// (hash-in-filename); loading starts at script eval, ready long before the
// first material is built; until then the procedural bake's neutral fill
// stands in for a frame. wood_tex.js is the same table for the wood library —
// aeroDetailTex reads both, so a sheet may live in either.
const SKIN_TEX_SHEETS = (typeof Image !== 'undefined') ? (() => {
  ${BASE_DECL}
  const mk = src => { const i = new Image(); i.src = B + src; return i; };
  return {
`;
const report = [];
const emitted = [];
for (const [k, tex] of SETS) {
  const rel = bake(k, tex);
  emitted.push(rel);
  body += `    ${k}: { px: ${tex}, img: mk('${rel}') },\n`;
  report.push(`${k} ${sfx(tex)} ${(fs.statSync(path.join(ROOT, rel)).size / 1024).toFixed(0)} KB`);
}
body += `  };
})() : null;
`;
fs.writeFileSync(OUT, body);
const gone = pruneMedia(SUB, emitted);
console.log(`src/viewer/skin_tex.js (${(body.length / 1024).toFixed(1)} KB) + ` +
  `${emitted.length} files in media/${SUB}/ — ` + report.join(', ') +
  (gone.length ? ` · pruned ${gone.join(', ')}` : ''));
