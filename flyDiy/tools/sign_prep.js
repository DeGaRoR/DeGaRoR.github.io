#!/usr/bin/env node
// sign_prep.js — bakes THE BILLBOARDS (G313): the signs tools/sign_import.py
// cut off the user's sheets (assets/billboards/out/<key>_1k.png) land as real
// files under media/tex/signs/ and src/viewer/sign_tex.js becomes the slim
// manifest of pre-loading <img> refs with each sign's ASPECT - the one number
// the sign slot needs (a board is sized by its width; the height follows).
// The png (or the webp) keeps its alpha: a shaped sign (the arched store board) shows its
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
  // G392, the institutions: kind `civic` - the house presets' sign slot
  admiralty_police: { name: 'Admiralty Police', kind: 'civic', role: 'police' },
  island_clinic:    { name: 'Island Clinic', kind: 'civic', role: 'clinic' },
  town_hall:        { name: 'Town Hall', kind: 'civic', role: 'town hall' },
  fire_brigade:     { name: 'Fire Brigade', kind: 'civic', role: 'fire hall' },
  kootz_school:     { name: 'Kootz Landing School', kind: 'civic', role: 'school' },
  postal_service:   { name: 'Postal Service', kind: 'civic', role: 'post office' },
  community_church: { name: 'Community Church', kind: 'civic', role: 'church' },
  veterinary_care:  { name: 'Veterinary Care', kind: 'civic', role: 'vet' },
  // G3540, the player's cabin shed (the user's own plank, one file: sign_import's SINGLES)
  the_shed:         { name: 'The Shed', kind: 'shed' },
};

function pngSize(buf) {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}
// a webp's canvas (G3540): VP8X carries it whole; a plain lossy/lossless one in its own frame header
function webpSize(buf) {
  const c = buf.toString('ascii', 12, 16);
  if (c === 'VP8X') return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
  if (c === 'VP8L') { const b = buf.readUInt32LE(21); return { w: 1 + (b & 0x3fff), h: 1 + ((b >> 14) & 0x3fff) }; }
  return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
}
// the working copy: a webp (one sign to a file) over the png (cut off a sheet)
function srcOf(key) {
  const wp = path.join(SRC, key + '_1k.webp');
  return fs.existsSync(wp) ? { f: wp, ext: 'webp', size: webpSize } : { f: path.join(SRC, key + '_1k.png'), ext: 'png', size: pngSize };
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
  // A SET LOADS WHEN IT IS READ (LOADING S4.1): the maps are getters, the
  // Image made on first access (one per url); nothing here fetches at script eval
  const IM = {};
  const mk = src => IM[src] || (IM[src] = (() => { const i = new Image(); i.src = B + src; return i; })());
  return {
`;
const emitted = [], report = [];
for (const key in SIGNS) {
  const { f, ext, size } = srcOf(key);
  if (!fs.existsSync(f)) {
    console.error(`sign_prep: missing ${path.relative(ROOT, f)} — run python tools/sign_import.py first`);
    process.exit(1);
  }
  const buf = fs.readFileSync(f);
  const { w, h } = size(buf);
  const rel = writeMedia(SUB, key + '_1k', ext, buf);
  emitted.push(rel);
  const S = SIGNS[key];
  body += `    ${key}: { name: '${S.name}', kind: '${S.kind}',${S.role ? ` role: '${S.role}',` : ''} aspect: ${(w / h).toFixed(3)}, px: [${w}, ${h}], get img() { return mk('${rel}'); } },\n`;
  report.push(`${key} ${w}x${h} ${(buf.length / 1024).toFixed(0)} KB`);
}
body += `  };
})() : null;
// the same table headless, for the gates: keys, names, kinds, aspects
const SIGN_TEX_META = ${JSON.stringify(Object.fromEntries(Object.keys(SIGNS).map(k => {
  const S = srcOf(k), { w, h } = S.size(fs.readFileSync(S.f));
  return [k, { name: SIGNS[k].name, kind: SIGNS[k].kind, role: SIGNS[k].role || null, aspect: +(w / h).toFixed(3) }];
})))};
if (typeof module !== 'undefined' && module.exports) module.exports = { SIGN_TEX_META };
`;
fs.writeFileSync(OUT, body);
const gone = pruneMedia(SUB, emitted);
console.log(`src/viewer/sign_tex.js + ${emitted.length} files in media/${SUB}/ — ` + report.join(', ') +
  (gone.length ? ` · pruned ${gone.join(', ')}` : ''));
