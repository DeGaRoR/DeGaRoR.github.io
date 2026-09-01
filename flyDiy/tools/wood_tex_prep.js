#!/usr/bin/env node
// wood_tex_prep.js — bakes the scanned WOOD detail sheets: the encoded jpgs
// land as real files under media/tex/wood/ and src/viewer/wood_tex.js becomes
// the slim manifest of pre-loading <img> refs (externalized 2026-09-01 — the
// data URIs left with the single-file artifact).
//
// SOURCE: assets/wood/<key>/ (CC0 — Poly Haven and ambientCG), normalised AND
// PACKED into aeroskin.js's own sheet layout by `python tools/wood_tex_import.py`
// (R,G tangent normal / B the 0.80-mean height ride / A left to drawImage's
// 255). This file only picks a size and copies the bytes, exactly like
// site_tex_prep.js before it — one recipe, no channel knowledge.
//
// The `tex` FIELD IS A BUDGET, not a fact about the source: the import writes
// a 1k archive beside the 512 working copy, so promoting a sheet is one
// number here and a re-run — but note AERO_TEX is 512 and POT is a WebGL1
// requirement (GATE SKINMAT holds it), so 1024 is the only promotion there is.
//
// These sheets are claimed by AERO_FINISH rows through their `sheet:` field;
// a key nothing claims is dead weight the gate will name.
//
// Run after changing the source maps: node tools/wood_tex_prep.js
// The output is committed, like the other payloads.
const fs = require('fs');
const path = require('path');
const { writeMedia, pruneMedia, BASE_DECL } = require('./_media_lib.js');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'wood');
const OUT = path.join(ROOT, 'src', 'viewer', 'wood_tex.js');
const SUB = 'tex/wood';

// key, tex (512 | 1024)
const SETS = [
  ['maple',     512],
  ['walnut',    512],
  ['walnutfig', 512],
  ['laminate',  512],
];

const sfx = tex => (tex === 1024 ? '1k' : String(tex));
const bake = (k, tex) => {
  const f = path.join(SRC, k, `aero_${sfx(tex)}.jpg`);
  if (!fs.existsSync(f)) {
    console.error(`wood_tex_prep: missing ${path.relative(ROOT, f)} — ` +
      'run `python tools/wood_tex_import.py` first');
    process.exit(1);
  }
  return writeMedia(SUB, `${k}_aero_${sfx(tex)}`, 'jpg', fs.readFileSync(f));
};

let body = `// GENERATED FILE - DO NOT EDIT. Built by tools/wood_tex_prep.js from
// assets/wood/ (CC0: Poly Haven + ambientCG; see CREDITS.md). Each image IS
// an AEROSKIN detail sheet (R,G normal / B height ride, mean 0.80) — DATA,
// not a picture; aeroDetailTex draws it linear. The files live under
// media/tex/wood/ (hash-in-filename); loading starts at script eval, ready
// long before the first material is built; until then the procedural bake's
// neutral fill stands in for a frame.
const WOOD_TEX_SHEETS = (typeof Image !== 'undefined') ? (() => {
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
console.log(`src/viewer/wood_tex.js (${(body.length / 1024).toFixed(1)} KB) + ` +
  `${emitted.length} files in media/${SUB}/ — ` + report.join(', ') +
  (gone.length ? ` · pruned ${gone.join(', ')}` : ''));
