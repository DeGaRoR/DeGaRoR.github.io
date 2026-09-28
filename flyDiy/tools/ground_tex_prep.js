#!/usr/bin/env node
// ground_tex_prep.js - bakes THE GROUND LIBRARY (G910-G911, AS2; futureDesigns/ASSETS-2026-09-27.md §5.3 M7):
// ONE set table for the four ground consumers that each had their own baker, media directory and copies -
//   the splat      (the island's ground: splat_ground.js, 19 sets, was tools/splat_tex_prep.js),
//   the pavement   (roads and runways: pavement.js, 35 sets, was tools/pavement_tex_prep.js),
//   the lot        (the village's lots: lot_tex.js LOT_GROUND, 5 sets, was tools/lot_tex_prep.js),
//   the site       (the aerodrome's and the garage's ground: site_ground.js, 10 sets, was tools/site_tex_prep.js).
// The census found them shipping the same maps two to four times (32 byte-identical groups, 5.8 MiB). Here a
// SET is one set of maps, stored once under media/tex/ground/; a library's key is an ALIAS of a set, with that
// library's own numbers (tile / metres / role / mean / name). Where two libraries' keys name DIFFERENT texels
// (the pavement's flattened copies of the lot's and the airfield's sets, the site's own dirt) they are two sets:
// the pavement's are <key>Pv, the site's dirt is siteDirt - no library sees a texel change.
//
// THE COOKED LAYERS. Every set an ARRAY consumer can name (the splat's and the pavement's) is also cooked, OFFLINE
// (tools/array_cook.js), into ONE file of two raw RGBA8 planes, px x px each, packed exactly as the page packed
// them: A = colour rgb + height (a), N = normal rgb + roughness (a) - pavement.js library()'s packing, which
// splat_ground.js's buildArrays shared. The page fetches the layers it needs and copies them into its arrays
// (src/viewer/ground_lib.js): no Image, no canvas, no getImageData at the roll-out.
//
// THE TABLE is tools/ground_sets.json (the set list, each map's source under assets/, each library's aliases in
// that library's order); the splat's order and metres are src/core/28b_ground_fields.js RECIPE.library's, as
// before. A map is read from, in order: assets/ (this checkout's, then the main checkout's - the old bakers'
// rule), then the file the current src/viewer/ground_tex.js names (so a box without assets/ re-bakes the
// shipped bytes, byte-exact), then `legacy` (the four old media directories - the migration's, G910). A map a set
// lists in `keep` skips assets/ (a hand tone lives only in the shipped file: tools/splat_tex_tone.py).
//
//   node tools/ground_tex_prep.js            bake: media/tex/ground/ + src/viewer/ground_tex.js, prune the rest
//   node tools/ground_tex_prep.js --report   say what it would write; write nothing
// Needs python + Pillow for the cook (tools/media_lib.py, the importers' own dependency). Committed.
'use strict';
const fs = require('fs');
const path = require('path');
const { writeMedia, pruneMedia, BASE_DECL, mediaRel } = require('./_media_lib.js');
const { cookLayers } = require('./array_cook.js');
const G = require('../src/core/28b_ground_fields.js');

const ROOT = path.join(__dirname, '..');
const ROOTS = [ROOT, 'D:/Dev/DeGaRoR.github.io/flyDiy'];
const OUT = path.join(ROOT, 'src', 'viewer', 'ground_tex.js');
const SUB = 'tex/ground';
const REPORT = process.argv.includes('--report');
const T = JSON.parse(fs.readFileSync(path.join(__dirname, 'ground_sets.json'), 'utf8'));
const PX = T.px;
const MAPS = ['diff', 'nor', 'rough', 'height'];
const STEM = { diff: 'diff', nor: 'nor_gl', rough: 'rough', height: 'height' };
// what each library's view exposes (the maps its old manifest had)
const VIEW_MAPS = { splat: ['diff', 'nor', 'height', 'rough'], pavement: ['diff', 'nor', 'rough', 'height'], lot: ['diff', 'nor', 'rough'], site: ['diff', 'nor', 'rough'] };

// the file the current manifest names for (set, map), if any: a re-bake without assets/ keeps the shipped bytes
const current = (() => {
  if (!fs.existsSync(OUT)) return {};
  try { const m = {}; const vm = require('vm'), c = {}; vm.runInNewContext(fs.readFileSync(OUT, 'utf8') + '\nthis.T = GROUND_TEX;', c);
    for (const k in c.T.sets) m[k] = c.T.sets[k]; return m; } catch (e) { return {}; }
})();
// `keep` (a set's maps the shipped bytes win for, over assets/): a HAND-TONED map - forestAir's colour carries
// tools/splat_tex_tone.py's GIMP tone, which assets/ does not; reading assets/ would silently undo it
function source(key, m) {
  const s = T.sets[key], keep = (s.keep || []).includes(m);
  if (!keep) for (const rel of (s.src && s.src[m]) || []) for (const r of ROOTS) { const f = path.join(r, rel); if (fs.existsSync(f)) return { f, from: 'assets' }; }
  const cur = current[key] && current[key][m];
  if (cur && fs.existsSync(path.join(ROOT, cur))) return { f: path.join(ROOT, cur), from: 'shipped' };
  const leg = s.legacy && s.legacy[m];
  if (leg && fs.existsSync(path.join(ROOT, leg))) return { f: path.join(ROOT, leg), from: 'legacy' };
  return null;
}

// 1. THE MAPS, once each (writeMedia folds equal bytes under whatever stem wrote them first)
const sets = {}, emitted = [], from = { assets: 0, shipped: 0, legacy: 0 };
for (const key of Object.keys(T.sets)) {
  const s = T.sets[key], row = {};
  for (const m of MAPS) {
    if (!(s.src && s.src[m]) && !(s.legacy && s.legacy[m])) continue;
    const src = source(key, m);
    if (!src) { console.error(`ground_tex_prep: ${key} ${m}: no source (${(s.src[m] || []).join(' | ')}) - run the importer, or bake on a box with assets/`); process.exit(1); }
    from[src.from]++;
    const buf = fs.readFileSync(src.f);
    row[m] = REPORT ? mediaRel(SUB, `${key}_${STEM[m]}_${PX}`, 'jpg', buf) : writeMedia(SUB, `${key}_${STEM[m]}_${PX}`, 'jpg', buf);
    row['_' + m] = src.f;
    emitted.push(row[m]);
  }
  sets[key] = row;
}

// 2. THE LAYERS: every set an array consumer names (the old packers' fallbacks: height 128, rough 230)
const cooked = Object.keys(T.sets).filter(k => T.sets[k].cook);
const entries = cooked.map(k => {
  const r = sets[k];
  if (!r._diff || !r._nor) { console.error(`ground_tex_prep: ${k} is cooked but has no colour or normal map`); process.exit(1); }
  return { stem: `${k}_layers_${PX}`, planes: [
    [{ img: r._diff, ch: 0 }, { img: r._diff, ch: 1 }, { img: r._diff, ch: 2 }, { img: r._height || null, ch: 0, or: 128 }],
    [{ img: r._nor, ch: 0 }, { img: r._nor, ch: 1 }, { img: r._nor, ch: 2 }, { img: r._rough || null, ch: 0, or: 230 }]] };
});
const layers = cookLayers({ sub: SUB, px: PX, entries, dry: REPORT });
for (const k of cooked) { sets[k].layers = layers[`${k}_layers_${PX}`]; emitted.push(sets[k].layers); }

// 3. THE LIBRARIES' ALIASES (the splat's order and metres are the recipe's)
const libs = JSON.parse(JSON.stringify(T.libs));
{ const byKey = new Map(libs.splat.map(a => [a.key, a]));
  libs.splat = G.RECIPE.library.map(([k, metres]) => { const a = byKey.get(k); if (!a) { console.error(`ground_tex_prep: the recipe's set ${k} has no alias in ground_sets.json libs.splat`); process.exit(1); } return Object.assign({}, a, { metres }); }); }
for (const L in libs) for (const a of libs[L]) if (!T.sets[a.set]) { console.error(`ground_tex_prep: ${L}.${a.key} names no set ${a.set}`); process.exit(1); }

// 4. THE MANIFEST
const clean = r => { const o = {}; for (const m of MAPS.concat(['layers'])) if (r[m]) o[m] = r[m]; return o; };
const aliasRow = (L, a) => { const o = Object.assign({}, a); if (L !== 'pavement') { delete o.source; delete o.slug; } return o; };
let body = `// GENERATED FILE - DO NOT EDIT. Built by tools/ground_tex_prep.js from tools/ground_sets.json and the maps under
// assets/lot, assets/splat, assets/airfield, assets/pavement (CC0: Poly Haven, ambientCG; see CREDITS.md).
// The files live under media/tex/ground/ (hash-in-filename).
//
// THE GROUND LIBRARY (G910, AS2): ONE table for the splat, the pavement, the lot and the site. A SET is its maps,
// once (diff / nor / rough / height JPEGs, for the consumers that bind plain textures and the editors' previews)
// and, for the sets an array can hold, \`layers\`: the two texture-array planes COOKED offline (tools/array_cook.js;
// colour rgb + height a, normal rgb + roughness a; raw RGBA8, one gzip stream) - src/viewer/ground_lib.js copies
// them into the arrays, no canvas. \`libs\` are each library's keys, in its order, with its own numbers, each
// naming its set. Below the table: the four libraries' views, under their old names (SPLAT_TEX_SETS,
// PAVEMENT_TEX_SETS, LOT_TEX_SETS, SITE_TEX_SETS), whose maps are lazily-made Images shared by every view.
const GROUND_TEX = {
  px: ${PX},
  sets: {
${Object.keys(sets).map(k => `    ${k}: ${JSON.stringify(clean(sets[k]))},`).join('\n')}
  },
  libs: {
${Object.keys(libs).map(L => `    ${L}: [\n${libs[L].map(a => `      ${JSON.stringify(aliasRow(L, a))},`).join('\n')}\n    ],`).join('\n')}
  },
};
// THE VIEWS: a library's key -> its numbers + getters for the maps its old manifest had (the Image made on first
// read, ONE per url whichever library reads it - a listener, never an onload property: they are shared) +
// \`set\` (the set's key) and \`layers\` (the cooked file, prefixed) where cooked.
const GROUND_VIEWS = (typeof Image !== 'undefined') ? (() => {
  ${BASE_DECL}
  const IM = {};
  const mk = src => IM[src] || (IM[src] = (() => { const i = new Image(); i.src = B + src; return i; })());
  const MAPS = ${JSON.stringify(VIEW_MAPS)};
  const view = (L, a) => {
    const s = GROUND_TEX.sets[a.set], o = {};
    for (const k in a) if (k !== 'source' && k !== 'slug') o[k] = a[k];
    if (L !== 'splat') delete o.key;
    o.px = GROUND_TEX.px;
    if (s.layers) o.layers = B + s.layers;
    for (const m of MAPS[L]) if (s[m]) Object.defineProperty(o, m, { get: () => mk(s[m]), enumerable: true });
    return o;
  };
  const dict = L => { const d = {}; for (const a of GROUND_TEX.libs[L]) d[a.key] = view(L, a); return d; };
  return { splat: GROUND_TEX.libs.splat.map(a => view('splat', a)), pavement: dict('pavement'), lot: dict('lot'), site: dict('site') };
})() : null;
const SPLAT_TEX_SETS = GROUND_VIEWS && GROUND_VIEWS.splat;
const PAVEMENT_TEX_SETS = GROUND_VIEWS && GROUND_VIEWS.pavement;
const LOT_TEX_SETS = GROUND_VIEWS && GROUND_VIEWS.lot;
const SITE_TEX_SETS = GROUND_VIEWS && GROUND_VIEWS.site;
// the pavement's provenance, for CREDITS.md and GATE PAVEMENT (never read at runtime)
const PAVEMENT_TEX_CREDITS = GROUND_TEX.libs.pavement.map(a => ({ key: a.key, source: a.source, slug: a.slug, licence: 'CC0', metres: a.metres }));
if (typeof module !== 'undefined' && module.exports) module.exports = { GROUND_TEX, PAVEMENT_TEX_CREDITS };
`;
const sz = rel => fs.statSync(path.join(ROOT, rel)).size;
const uniq = [...new Set(emitted)];
const jpg = uniq.filter(r => r.endsWith('.jpg')), bin = uniq.filter(r => r.endsWith('.gz.bin'));
if (REPORT) {
  console.log(`--report: ${Object.keys(sets).length} sets, ${jpg.length} maps (${emitted.length - bin.length} asked), ${bin.length} cooked layer files; sources ${JSON.stringify(from)}`);
  process.exit(0);
}
fs.writeFileSync(OUT, body);
const gone = pruneMedia(SUB, uniq);
const MB = a => (a.reduce((s, r) => s + sz(r), 0) / 1048576).toFixed(1);
console.log(`src/viewer/ground_tex.js (${(body.length / 1024).toFixed(1)} KB) + media/${SUB}/: ${Object.keys(sets).length} sets, ` +
  `${jpg.length} maps (${MB(jpg)} MB; ${emitted.length - bin.length - jpg.length} asked twice, folded), ${bin.length} cooked layer files (${MB(bin)} MB gz, ` +
  `${(bin.length * PX * PX * 8 / 1048576).toFixed(0)} MiB raw); sources ${JSON.stringify(from)}` + (gone.length ? ` · pruned ${gone.length}: ${gone.slice(0, 6).join(', ')}${gone.length > 6 ? ' ...' : ''}` : ''));
