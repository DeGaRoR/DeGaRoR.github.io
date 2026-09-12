#!/usr/bin/env node
// sign_prep.js — bakes THE BILLBOARDS (G313): the signs tools/sign_import.py
// cut off the user's sheets (assets/billboards/out/<key>_1k.png) land as real
// files under media/tex/signs/ and src/viewer/sign_tex.js becomes the slim
// manifest of pre-loading <img> refs with each sign's ASPECT - the one number
// the sign slot needs (a board is sized by its width; the height follows).
// The png keeps its alpha: a shaped sign (the arched store board) shows its
// backing through the corners.
// Run after a new sheet: python tools/sign_import.py && node tools/sign_prep.js
const fs = require('fs');
const path = require('path');
const { writeMedia, pruneMedia, BASE_DECL } = require('./_media_lib.js');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'billboards', 'out');
const OUT = path.join(ROOT, 'src', 'viewer', 'sign_tex.js');
const SUB = 'tex/signs';

// key: the label a bench shows, the business it names (for the village's
// choice: what goes on a store, a workshop, a roadside post)
const SIGNS = {
  air_taxi:       { name: 'Admiralty Air Taxi', kind: 'roadside' },
  harbor_fuel:    { name: 'Harbor Fuel & Bait', kind: 'harbour' },
  general_store:  { name: 'Kootz Landing General Store', kind: 'store' },
  tidal_cup:      { name: 'Tidal Cup Cafe', kind: 'store' },
  bear_tours:     { name: 'Bear Coast Tours', kind: 'roadside' },
  sitka_lumber:   { name: 'Sitka Spruce Lumber', kind: 'industrial' },
  north_motel:    { name: 'North Channel Motel', kind: 'roadside' },
  tongass_marine: { name: 'Tongass Marine Supply', kind: 'harbour' },
};

function pngSize(buf) {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

let body = `// GENERATED FILE - DO NOT EDIT. Built by tools/sign_prep.js from
// assets/billboards/out/ (the user's own painted signs; see CREDITS.md). The
// files live under media/tex/signs/ (hash-in-filename); loading starts at
// script eval and every consumer waits on img.complete/onload.
//
// THE BILLBOARDS (G313): each sign with its aspect (width over height) - the
// sign slot sizes its board by width and takes the height from here.
const SIGN_TEX_SETS = (typeof Image !== 'undefined') ? (() => {
  ${BASE_DECL}
  const mk = src => { const i = new Image(); i.src = B + src; return i; };
  return {
`;
const emitted = [], report = [];
for (const key in SIGNS) {
  const f = path.join(SRC, key + '_1k.png');
  if (!fs.existsSync(f)) {
    console.error(`sign_prep: missing ${path.relative(ROOT, f)} — run python tools/sign_import.py first`);
    process.exit(1);
  }
  const buf = fs.readFileSync(f);
  const { w, h } = pngSize(buf);
  const rel = writeMedia(SUB, key + '_1k', 'png', buf);
  emitted.push(rel);
  const S = SIGNS[key];
  body += `    ${key}: { name: '${S.name}', kind: '${S.kind}', aspect: ${(w / h).toFixed(3)}, px: [${w}, ${h}], img: mk('${rel}') },\n`;
  report.push(`${key} ${w}x${h} ${(buf.length / 1024).toFixed(0)} KB`);
}
body += `  };
})() : null;
// the same table headless, for the gates: keys, names, kinds, aspects
const SIGN_TEX_META = ${JSON.stringify(Object.fromEntries(Object.keys(SIGNS).map(k => {
  const { w, h } = pngSize(fs.readFileSync(path.join(SRC, k + '_1k.png')));
  return [k, { name: SIGNS[k].name, kind: SIGNS[k].kind, aspect: +(w / h).toFixed(3) }];
})))};
if (typeof module !== 'undefined' && module.exports) module.exports = { SIGN_TEX_META };
`;
fs.writeFileSync(OUT, body);
const gone = pruneMedia(SUB, emitted);
console.log(`src/viewer/sign_tex.js + ${emitted.length} files in media/${SUB}/ — ` + report.join(', ') +
  (gone.length ? ` · pruned ${gone.join(', ')}` : ''));
