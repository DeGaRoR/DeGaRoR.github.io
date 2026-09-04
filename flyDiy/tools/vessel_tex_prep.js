#!/usr/bin/env node
// vessel_tex_prep.js — bakes the VESSEL surfaces (tanks, packs, their
// hardware) into media/tex/vessel/ and writes src/viewer/vessel_tex.js, the
// slim manifest of pre-loading <img> refs the energy layer builds materials
// from.
//
// skin_tex_prep.js's twin in shape and its opposite in kind: that one emits
// ONE packed four-channel AEROSKIN sheet per set, because the covering is
// drawn by one shader; this one emits the THREE maps a MeshStandardMaterial
// binds — diff (sRGB), arm (R ao, G roughness, B metalness), nor (GL tangent)
// — because a tank is an object in the scene with a material of its own. That
// is src/viewer/props.js's recipe verbatim, and the reason is the same: one
// image serving roughnessMap and metalnessMap is three samplers and one
// upload.
//
// SOURCE: assets/vessel/<key>/, written by `python tools/vessel_tex_import.py`.
//
// THE TABLE BELOW IS THE MATERIAL, not just a budget. `tile` is METRES PER
// REPEAT, which is what makes these scale well: the vessel mesh lays its uv
// out in real metres of arc length, so a 30-litre header tank and a 200-litre
// ferry tank wear the same grain at the same size, and neither is a stretched
// version of the other. `norScl` is the normal-map strength, `ao` says whether
// the R channel is worth binding (none of these sets has a baked occlusion, so
// none of them does).
//
// Run after changing the source maps: node tools/vessel_tex_prep.js
// The output is committed, like the other payloads.
const fs = require('fs');
const path = require('path');
const { writeMedia, pruneMedia, BASE_DECL } = require('./_media_lib.js');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'vessel');
const OUT = path.join(ROOT, 'src', 'viewer', 'vessel_tex.js');
const SUB = 'tex/vessel';

// key, px, tile (metres per repeat), norScl, label
const SETS = [
  // A PAINTED TANK'S GRAIN IS ITS SPRAY AND ITS WEAR, both of which are
  // centimetres, so half a metre of tank is one repeat of the sheet.
  ['paint',   512, 0.50, 1.00, 'painted metal'],
  // Rolled alloy sheet: the widest tile of the four. Metal050C's relief is
  // very shallow (normal 119..135 of 255, measured at import) and stretching
  // it further is what stops a big tank looking like foil.
  ['alu',     512, 0.60, 0.85, 'bare alloy'],
  // Moulded polythene: mould texture, a few millimetres across.
  ['plastic', 512, 0.35, 1.00, 'moulded plastic'],
  // The hardware is small — a filler neck is 60 mm across — so its sheet is
  // small too, or a whole fitting lands inside one texel of a rust patch.
  ['steel',   512, 0.22, 1.00, 'steel hardware'],
];

const sfx = px => (px === 1024 ? '1k' : String(px));
const bake = (k, px, stem) => {
  const f = path.join(SRC, k, `${stem}_${sfx(px)}.jpg`);
  if (!fs.existsSync(f)) {
    console.error(`vessel_tex_prep: missing ${path.relative(ROOT, f)} — ` +
      'run `python tools/vessel_tex_import.py` first');
    process.exit(1);
  }
  return writeMedia(SUB, `${k}_${stem}_${sfx(px)}`, 'jpg', fs.readFileSync(f));
};

let body = `// GENERATED FILE - DO NOT EDIT. Built by tools/vessel_tex_prep.js from
// assets/vessel/ (CC0: Poly Haven, ambientCG; see CREDITS.md). Three maps per
// set, the hangar props' own recipe (src/viewer/props.js): diff is sRGB base
// colour, arm is linear R = ao / G = roughness / B = metalness, nor is a
// linear OpenGL tangent normal. \`tile\` is METRES PER REPEAT — the vessel
// mesh lays uv out in real metres, so the grain is the same size on any tank.
// The files live under media/tex/vessel/ (hash-in-filename); loading starts at
// script eval, long before the first tank is drawn, and a material built
// before an image lands simply repaints when it does.
const VESSEL_TEX_SETS = (typeof Image !== 'undefined') ? (() => {
  ${BASE_DECL}
  const mk = src => { const i = new Image(); i.src = B + src; return i; };
  return {
`;
const report = [];
const emitted = [];
for (const [k, px, tile, norScl, label] of SETS) {
  const maps = {};
  let bytes = 0;
  for (const stem of ['diff', 'arm', 'nor_gl']) {
    const rel = bake(k, px, stem);
    emitted.push(rel);
    maps[stem === 'nor_gl' ? 'nor' : stem] = rel;
    bytes += fs.statSync(path.join(ROOT, rel)).size;
  }
  body += `    ${k}: { px: ${px}, tile: ${tile}, norScl: ${norScl}, ao: 0,\n` +
          `      label: ${JSON.stringify(label)},\n` +
          `      diff: mk('${maps.diff}'), arm: mk('${maps.arm}'), nor: mk('${maps.nor}') },\n`;
  report.push(`${k} ${sfx(px)} ${(bytes / 1024).toFixed(0)} KB`);
}
body += `  };
})() : null;
`;
fs.writeFileSync(OUT, body);
const gone = pruneMedia(SUB, emitted);
console.log(`src/viewer/vessel_tex.js (${(body.length / 1024).toFixed(1)} KB) + ` +
  `${emitted.length} files in media/${SUB}/ — ` + report.join(', ') +
  (gone.length ? ` · pruned ${gone.join(', ')}` : ''));
