#!/usr/bin/env node
// house_tex_prep.js — bakes the WOODEN HOUSE material library (G230): the
// encoded jpgs land as real files under media/tex/house/ and
// src/viewer/house_tex.js becomes the slim manifest of pre-loading <img> refs,
// exactly like site_tex_prep.js before it.
//
// SOURCE: assets/house/<key>/ (CC0 — Poly Haven and ambientCG), normalised to
// one contract by `python tools/house_tex_import.py`, which is where the two
// Poly Haven packings become diff/nor_gl/rough and where a paintable set gets
// its NEUTRAL map. This file only picks the size the import already sized for
// and copies the bytes; it knows nothing about arm channels.
//
// THE SIZE IS NOT A TASTE HERE, unlike site_tex_prep's budget field. The user
// asked for similar texel density across the finished house, so `px` is
// derived in the import from each set's own `tile` (metres of building per
// repeat) — see DENSITY_TARGET there. This table carries both numbers so the
// manifest can publish px/m, and GATE HOUSE holds the spread at 2:1.
//
// WHAT THE EXTRA FIELDS MEAN, because they are the difference between a
// texture library and a MATERIAL library:
//   tile    metres of building per repeat. The house generator emits UVs in
//           METRES (_house_kit.js's rule), so the consumer sets
//           texture.repeat = 1/tile and the scale is right on every surface
//           without a single hand-tuned number.
//   metal   scalar metalness. None of these sets ships a metalness map worth
//           the bytes (ambientCG's is 4 KB of near-constant), so it rides as
//           one number per set.
//   paint   the set has a neutral map: `map * color` IS the paint colour.
//   ribbed  THE CORRUGATION IS IN THE TEXTURE. The roof draws standing seams
//           as real geometry; a corrugated-iron map on top of them is two
//           sets of ribs at two pitches, which reads as a mistake because it
//           is one. A ribbed set suppresses the drawn seams — the material
//           knows what it already contains.
//   kind    plank | veneer | roof | log | stone. The generator's roles are
//           derived from this, so a casing can never be offered a wall scan.
//   tile    ALSO A LOOK, not only a measurement: a 1.2 m plank repeat is
//           eighteen copies of the same knot across a 22 m cannery. The planks
//           tile at 1.9-2.2 m now and the corrugated sheets at 3.2-4.8 (the
//           user: "your corrugated rusty metal is tiled too small ... *4
//           easily, maybe *6"), which is why those three are 1024: density is
//           px/tile and a coarse tile has to buy its resolution back.
//
// Run after changing the source maps: node tools/house_tex_prep.js
// The output is committed, like the other payloads.
const fs = require('fs');
const path = require('path');
const { writeMedia, pruneMedia, BASE_DECL } = require('./_media_lib.js');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'house');
const OUT = path.join(ROOT, 'src', 'viewer', 'house_tex.js');
const SUB = 'tex/house';

// THE KIND IS THE FIRST FIELD FOR A REASON (the user: "you also need to
// categorize the textures between planks and veneers, and roof material, and
// maybe logs, and ensure you are using the right ones. Finishes, beams and
// pillars takes veneer. Walls and floors take planks. Roofs take metal sheets
// or tiles.").
//
// A PLANK scan is a WALL: several boards with joints between them. Tile it onto
// a 100 mm casing or a 90 mm post and you get three joints across one piece of
// timber, which is the single thing that made the finish read wrong. A VENEER
// scan is ONE piece: continuous grain, no joints, which is what a milled board,
// a beam and a pillar are. A ROOF scan is a covering — sheet or tile — and
// belongs on nothing else.
//
// So the kind is declared here, the generator's roles are DERIVED from it, and
// GATE HOUSE refuses a role that offers the wrong kind. `use` is gone: it said
// the same thing twice and the two could drift.
//
// kind: 'plank' | 'veneer' | 'roof' | 'stone'
// key, kind, label, tile, px, metal, paint, ribbed
const SETS = [
  ['boxprof', 'roof', 'box-profile metal sheet', 3.2, 1024, 0.55, true, true],
  ['corrworn', 'roof', 'worn corrugated iron', 3.6, 1024, 0.50, false, true],
  ['corrrust', 'roof', 'rusty corrugated iron', 4.8, 1024, 0.35, false, true],
  ['shingle', 'roof', 'shakes / shingles', 2.6, 512, 0.00, false, false],
  ['galv', 'roof', 'galvanised sheet', 1.0, 256, 0.85, false, false],
  ['rust', 'roof', 'rusted steel', 1.8, 512, 0.60, false, false],
  ['shakes', 'plank', 'shake siding', 2.2, 512, 0.00, false, false],
  ['paintwood', 'plank', 'painted planks', 1.9, 512, 0.00, true, false],
  ['greenwood', 'plank', 'rough painted planks', 1.9, 512, 0.00, true, false],
  ['board', 'plank', 'long boards', 1.9, 512, 0.00, true, false],
  ['roughwood', 'plank', 'rough sawn planks', 1.9, 512, 0.00, false, false],
  ['brownwood', 'plank', 'planed planks', 1.9, 512, 0.00, false, false],
  ['greywood', 'plank', 'weathered grey planks', 2.1, 512, 0.00, false, false],
  ['wornwood', 'plank', 'weathered brown planks', 2.1, 512, 0.00, false, false],
  ['deckwood', 'plank', 'decking boards', 2.2, 512, 0.00, false, false],
  ['darkwood', 'plank', 'dark weathered planks', 1.9, 512, 0.00, true, false],
  ['veneer', 'veneer', 'pale veneer', 0.9, 256, 0.00, true, false],
  ['veneerdark', 'veneer', 'figured veneer', 0.9, 256, 0.00, true, false],
  ['veneerwarm', 'veneer', 'warm veneer', 0.9, 256, 0.00, true, false],
  ['veneerpale', 'veneer', 'pale laminate', 0.9, 256, 0.00, true, false],
  ['stain', 'veneer', 'dark stained boards', 1.9, 512, 0.00, true, false],
  ['bark', 'log', 'bark', 1.1, 512, 0.00, false, false],
  ['concrete', 'stone', 'damaged concrete', 2.8, 512, 0.00, false, false],
];

// THE SIZE COMES FROM THE IMPORT, not from the table below: it derives px from
// each set's own tile and publishes _sizes.json. A number repeated in two files
// drifts the first time a tile moves - it did, and the prep asked for a 512
// that had never been written. The `px` column here is what the table EXPECTS;
// a mismatch is reported, not guessed at.
const SIZES = (() => {
  const f = path.join(SRC, '_sizes.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
})();
const sfx = px => (px === 1024 ? '1k' : String(px));
const bake = (k, stem, px, optional) => {
  const f = path.join(SRC, k, `${stem}_${sfx(px)}.jpg`);
  if (!fs.existsSync(f)) {
    if (optional) return null;
    console.error(`house_tex_prep: missing ${path.relative(ROOT, f)} — ` +
      'run `python tools/house_tex_import.py` first');
    process.exit(1);
  }
  return writeMedia(SUB, `${k}_${stem}_${sfx(px)}`, 'jpg', fs.readFileSync(f));
};

let body = `// GENERATED FILE - DO NOT EDIT. Built by tools/house_tex_prep.js from
// assets/house/ (CC0: Poly Haven + ambientCG; see CREDITS.md). The files live
// under media/tex/house/ (hash-in-filename); loading starts at script eval and
// every consumer waits on img.complete/onload, so a material is built with
// whatever has arrived and updates itself when the rest lands.
//
// THE MATERIAL LIBRARY OF THE WOODEN HOUSE (G230). \`tile\` is metres of
// building per repeat and the generator's UVs are in metres, so the consumer
// sets repeat = 1/tile and nothing is hand-scaled. \`paint\` sets carry a
// NEUTRAL map (hue removed, luminance re-based) so that map * color is the
// paint colour at any hue. \`ribbed\` sets contain their own corrugation and
// suppress the roof's drawn standing seams.
const HOUSE_TEX_SETS = (typeof Image !== 'undefined') ? (() => {
  ${BASE_DECL}
  const mk = src => { const i = new Image(); i.src = B + src; return i; };
  return {
`;
const report = [];
const emitted = [];
const sz = rel => fs.statSync(path.join(ROOT, rel)).size;
let bytes = 0;
for (const [k, kind, name, tile, pxWant, metal, paint, ribbed] of SETS) {
  const px = SIZES[k] || pxWant;
  if (SIZES[k] && SIZES[k] !== pxWant)
    console.log('  note: ' + k + ' baked at ' + SIZES[k] + ' px (table said ' +
                pxWant + ')');
  const d = bake(k, 'diff', px), n = bake(k, 'nor_gl', px),
        r = bake(k, 'rough', px);
  const p = paint ? bake(k, 'paint', px) : null;
  for (const rel of [d, n, r, p]) if (rel) { emitted.push(rel); bytes += sz(rel); }
  body += `    ${k}: { kind: '${kind}', name: '${name}', tile: ${tile}, ` +
    `px: ${px}, metal: ${metal}, ribbed: ${ribbed},\n` +
    `      diff: mk('${d}'),\n      nor: mk('${n}'),\n      rough: mk('${r}'),\n` +
    (p ? `      paint: mk('${p}') },\n` : `      paint: null },\n`);
  report.push(`${k} ${kind} ${px}px/${tile}m=${Math.round(px / tile)}`);
}
body += `  };
})() : null;
`;
fs.writeFileSync(OUT, body);
const gone = pruneMedia(SUB, emitted);
const dens = SETS.map(s => (SIZES[s[0]] || s[4]) / s[3]);
console.log(`src/viewer/house_tex.js (${(body.length / 1024).toFixed(1)} KB) + ` +
  `${emitted.length} files in media/${SUB}/ (${(bytes / 1048576).toFixed(2)} MB)`);
console.log('texel density px/m: ' +
  `${Math.round(Math.min.apply(null, dens))}..${Math.round(Math.max.apply(null, dens))} ` +
  `(spread ${(Math.max.apply(null, dens) / Math.min.apply(null, dens)).toFixed(2)}:1)`);
console.log(report.join(', ') + (gone.length ? ` · pruned ${gone.length}` : ''));
