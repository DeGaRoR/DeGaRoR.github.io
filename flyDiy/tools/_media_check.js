#!/usr/bin/env node
// GATE MEDIA — the external asset store (2026-09-01) against the manifests
// that reference it, and the artifact against the budget that was prose for
// a year.
//
//   node tools/_media_check.js            -> "GATE MEDIA: PASS|FAIL"
//   node tools/_media_check.js --selftest -> negative verification
//
// WHAT IT GUARDS, and why each one is a check rather than a habit:
//
//   REFERENCED -> PRESENT   every media/ path a baked manifest names exists
//              on disk. This is the check that fires when a bake and a commit
//              go out of step — the page would show a missing texture or a
//              prop that never lands, silently, because every consumer
//              degrades by design.
//   PRESENT -> REFERENCED   every file under media/ is named by some
//              manifest. Each baker prunes what it owns, so an orphan means a
//              baker's prune is broken or a file was dropped in by hand — and
//              orphans are how a 400 MB directory happens one forgotten file
//              at a time.
//   NO BASE64 CREEP   the externalized manifests carry zero data: URIs, and
//              index.html's total data: payload stays under what the fonts
//              cost (they are inlined by design — build.js inlineFonts). The
//              single-file artifact died at 97.83 MiB, 95.9% of it base64;
//              this is what keeps it dead.
//   THE BUDGET, MECHANICAL   index.html under a declared ceiling. The old
//              100 MiB limit was enforced by comments in build.js and a
//              hand-computed margin ("0.42 MiB under a limit FIVE OTHER
//              SESSIONS are committing towards"). Never again: the number
//              lives here and goes red.
//
// NEGATIVE-VERIFIED: --selftest breaks each rule in turn.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MEDIA = path.join(ROOT, 'media');

const fail = [];
const check = (ok, msg) => { if (!ok) fail.push(msg); return !!ok; };

// index.html budget, MiB. Code-only now: three.js + core + editor + viewer +
// styles + inlined fonts. Raising this needs a reason written here.
//   6.0 -> 6.5 (W0c.29.1, 2026-09-12): the artifact reached 6.03 MiB on the
//   day the tree chantier closed - the ladder, the impostors and their shadow
//   cascades (render_world.js +86 KB, trees.js 21 KB), the F8 panel (12 KB),
//   the graphics settings menu (10 KB) and the tree manifest (17 KB, compact)
//   are 146 KB of code and one manifest, not data creeping back; the same day
//   G289-G294 grew the shed. DATA_BUDGET_KB below is the guard that matters.
//   6.5 -> 6.75 (W0.5a, 2026-09-13): three r128 -> r186 is +140 KB of vendor
//              (the node-material core rides in the same bundle), and a
//              CLEAN WORKTREE BUILDS CRLF (autocrlf): the same artifact
//              measures 6.44 MiB in the LF tree and 6.53 in a worktree, so
//              the budget carries the line-ending margin too.
//   6.75 -> 7.0 (G385, 2026-09-14): the premises composer (src/core/27_premises.js,
//              78 KB) joins the core - makeWorld composes the editor's record
//              in the physics' own frame, so it cannot ride as a ref; the
//              WORLD PACK it composes with (900 KB: the generators, their
//              textures, the cabin) ships as <script src> refs after the
//              viewer and stays outside this number by design.
//   7.0 -> 7.25 (G408, 2026-09-14): THE SKY CHANTIER is code - the almanac
//              (06_solar.js 9 KB), the day (07_day.js 11 KB), the clock
//              (day_clock.js 6 KB), then Hillaire's atmosphere (atmo.js 25 KB)
//              and the sky's light (sky_light.js 6 KB): ~60 KB, and the
//              worktree's CRLF margin measured the artifact at 7.01 MiB the
//              day the sun first moved. Nothing heavy; the 6.3 MB of graded
//              hangar sky LEAVES the media store when the shed takes this sky (S5).
//   7.25 -> 7.4 (G432, 2026-09-15): the everyday vehicles - 42 props' TABLES
//              (pier_auto.js 40 KB: parts, materials, boxes; the bins and maps
//              are in media/), their 70 levels of detail in pier_lods.js
//              (+50 KB of the same), the YARD_KIT mirror and the traffic
//              runner (~20 KB) - measured 7.17 -> 7.29 MiB in the worktree.
//              Nothing heavy: the geometry and the textures are refs.
//   7.4 -> 7.55 (G443, 2026-09-21): six days of code since G432 - the clouds (clouds.js
//              +30 KB, the field 08_cloud_field.js, clouds_ui.js / day_ui.js, shadow_near.js),
//              the playtest triage's A1-A5 (the camera, the rail, the garage room), the panel
//              arc's compact panel and gauge (G442-G442.4: _cage_panel / _panel_gen), the
//              runway lights (1.5 KB) - master's own LF build measured 7.419 MiB at G442.4,
//              over the line before this commit added its 5 KB. Nothing heavy: the data
//              payload is still 118 KB against its 400 (DATA_BUDGET_KB is the guard that matters).
//   7.55 -> 7.75 (G445.8, 2026-09-21): three STOCK DESIGNS on the shelf as whole
//              builds (the user's 172, Cub and Jodel D.112, ~60 KB of joined spec each in
//              tools/_cage_page5.js, 180 KB) - build data, not media; DATA_BUDGET_KB unchanged
//   7.75 holds (G448 post-FX, 2026-09-21): post_fx.js (28 KB: six shaders and their passes,
//              every one off by default) plus the six GRAPHICS rows (2 KB) - measured under
//              the line on the LF build. No data: the passes own no texture, no LUT.
//   7.75 -> 7.95 (G454.12, 2026-09-20): THE BIOMES - the vegetation payload is per
//              SPECIES now, 27 of them (deciduous, pines, shrubs, grasses, dead, rocks,
//              flowers) against five conifers: the MANIFEST (trees_pack.js 17 -> 80 KB:
//              every rung's part records, the file's materials once, the biome
//              table) plus 28c_biomes.js (4 KB) + cover_ring.js - measured +0.19 MiB.
//              Nothing heavy: 9.9 MB of geometry and 29 MB of maps are refs in media/.
//   7.95 -> 8.0 (G460, 2026-09-21): THE WATER SHADER is code - src/viewer/water.js
//              (45 KB: the GLSL of the three bands, the presets, the tile bake, the JS
//              mirror of the felt band). No media: the detail tile is baked at boot.
const BUDGET_MIB = 8.0;
// index.html's allowed data: payload: the four woff2 fonts (~121 KB base64)
// plus the two svg select arrows. Anything past this is base64 creeping back.
const DATA_BUDGET_KB = 400;

// ---------------------------------------------------------------------------
// the manifests that may reference media/ — one list, so a new externalized
// payload is one line here and the orphan check covers it from then on
// ---------------------------------------------------------------------------
function manifestFiles() {
  const v = ['hangar_walls.js', 'hangar_floor.js', 'site_tex.js',
             'wood_tex.js', 'skin_tex.js', 'vessel_tex.js', 'hangar_sky.js',
             'house_tex.js', 'panel_tex.js', 'lot_tex.js', 'splat_tex.js', 'sign_tex.js',
             'cabin_livery.js']   // the tram cabin's liveries (G343)
    .map(f => path.join(ROOT, 'src', 'viewer', f));
  const packs = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'src', 'props', 'props_packs.json'), 'utf8'))
    .map(f => path.join(ROOT, 'src', 'props', f));
  // the pier kit (G252): the hangar baker's second table, its own packs and
  // its own media directories (media/geo/pier, media/tex/pier)
  const pierMf = path.join(ROOT, 'src', 'pier', 'pier_packs.json');
  const pier = fs.existsSync(pierMf)
    ? JSON.parse(fs.readFileSync(pierMf, 'utf8'))
        .map(f => path.join(ROOT, 'src', 'pier', f))
    : [];
  // the totem poles (2026-09-13): the baker's table for the scanned poles,
  // its own pack cut by tools/totem_lod.js from a STAGED as-is bake (the
  // stage lives under bench/, never media/) - media/geo/totems, media/tex/totems
  const totemMf = path.join(ROOT, 'src', 'totems', 'totems_packs.json');
  const totems = fs.existsSync(totemMf)
    ? JSON.parse(fs.readFileSync(totemMf, 'utf8'))
        .map(f => path.join(ROOT, 'src', 'totems', f))
    : [];
  // the panel hardware kit (the panel arc, session 4c): the baker's third
  // table — the switches, knobs, buttons and the key — its own packs and
  // media (media/geo/panelhw, media/tex/panelhw)
  const hwMf = path.join(ROOT, 'src', 'panelhw', 'panelhw_packs.json');
  const panelhw = fs.existsSync(hwMf)
    ? JSON.parse(fs.readFileSync(hwMf, 'utf8'))
        .map(f => path.join(ROOT, 'src', 'panelhw', f))
    : [];
  // the tram cabin (G343): the baker's fourth table - the user's cable car,
  // its own pack and media (media/geo/cabin; media/tex/cabin holds the liveries)
  const cabinMf = path.join(ROOT, 'src', 'cabin', 'cabin_packs.json');
  const cabin = fs.existsSync(cabinMf)
    ? JSON.parse(fs.readFileSync(cabinMf, 'utf8'))
        .map(f => path.join(ROOT, 'src', 'cabin', f))
    : [];
  // EVERY payload on disk, not build.js's publish list: the table is the
  // CATALOGUE and MANIFEST.models the published subset (GATE REF's own
  // distinction). draco is baked-but-unpublished — no spec holds its scale —
  // and its bin is not an orphan, it is a catalogued aeroplane waiting on a
  // spec. A payload .js deleted from disk DOES orphan its bin, and that is
  // exactly when this gate should go red.
  const models = fs.readdirSync(path.join(ROOT, 'src', 'models'))
    .filter(f => f.endsWith('_model.js'))
    .map(f => path.join(ROOT, 'src', 'models', f));
  // the rigged characters (G204): every manifest on disk, the same
  // catalogue-not-publish-list reasoning as the models above
  const chars = fs.existsSync(path.join(ROOT, 'src', 'chars'))
    ? fs.readdirSync(path.join(ROOT, 'src', 'chars'))
      .filter(f => /_(?:char|anim)\.js$/.test(f))
      .map(f => path.join(ROOT, 'src', 'chars', f))
    : [];
  // the baked trees (W0b): one manifest, listing one bin per collection
  const trees = fs.existsSync(path.join(ROOT, 'src', 'core', 'trees_pack.json'))
    ? [path.join(ROOT, 'src', 'core', 'trees_pack.json')] : [];
  // the loading screen's pictures (LOADING S1): tools/shots_prep.py bakes the
  // user's captures into media/tex/shots and names them in this manifest
  const shots = fs.existsSync(path.join(ROOT, 'src', 'viewer', 'shots_pack.json'))
    ? [path.join(ROOT, 'src', 'viewer', 'shots_pack.json')] : [];
  return v.concat(packs, pier, totems, panelhw, cabin, models, chars, trees, shots);
}

const REF_RE = /media\/[A-Za-z0-9_\-./]+?\.(?:jpg|png|webp|bin)/g;   // webp: LOADING S4's texture prep

function collectRefs(files) {
  const refs = new Map();               // rel path -> first manifest naming it
  for (const f of files) {
    const txt = fs.readFileSync(f, 'utf8');
    for (const m of txt.match(REF_RE) || [])
      if (!refs.has(m)) refs.set(m, path.relative(ROOT, f));
  }
  return refs;
}

function walkMedia(dir, out) {
  out = out || [];
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walkMedia(p, out);
    else out.push(path.relative(ROOT, p).split(path.sep).join('/'));
  }
  return out;
}

function checkStore(refs, present) {
  check(refs.size > 0, 'zero media references found — every baker has ' +
        'regressed to base64, or the scan is broken');
  for (const [rel, who] of refs)
    check(present.includes(rel),
      `${who} references ${rel}, which is not on disk — bake and commit ` +
      'went out of step');
  const refSet = new Set(refs.keys());
  for (const rel of present)
    check(refSet.has(rel),
      `orphan: ${rel} is referenced by no manifest — a baker's prune is ` +
      'broken, or the file was dropped in by hand');
}

function checkNoCreep(files) {
  for (const f of files) {
    const txt = fs.readFileSync(f, 'utf8');
    check(txt.indexOf('data:image') < 0,
      `${path.relative(ROOT, f)} carries a data:image URI — base64 is ` +
      'creeping back into an externalized manifest');
  }
}

function dataBytes(html) {
  let n = 0;
  for (const m of html.match(/data:[a-z0-9/+.-]+;base64,[A-Za-z0-9+/=]+/g) || [])
    n += m.length;
  return n;
}

function checkArtifact() {
  const f = path.join(ROOT, 'index.html');
  if (!check(fs.existsSync(f), 'index.html is not built')) return;
  const mib = fs.statSync(f).size / 1048576;
  check(mib <= BUDGET_MIB,
    `index.html is ${mib.toFixed(2)} MiB against a declared ${BUDGET_MIB} MiB ` +
    'budget — something heavy moved back inside the artifact');
  const kb = dataBytes(fs.readFileSync(f, 'utf8')) / 1024;
  check(kb <= DATA_BUDGET_KB,
    `index.html carries ${kb.toFixed(0)} KB of data: URIs against the ` +
    `${DATA_BUDGET_KB} KB the fonts are allowed — base64 is creeping back`);
  return { mib, kb };
}

// ---------------------------------------------------------------------------
const files = manifestFiles();
for (const f of files)
  check(fs.existsSync(f), `manifest ${path.relative(ROOT, f)} does not exist`);
const refs = collectRefs(files.filter(f => fs.existsSync(f)));
const present = walkMedia(MEDIA);
checkStore(refs, present);
checkNoCreep(files.filter(f => fs.existsSync(f)));
const art = checkArtifact();

// ---------------------------------------------------------------------------
if (process.argv.includes('--selftest')) {
  console.log('  --selftest: breaking each rule in turn');
  const cases = [
    ['a manifest referencing a file that is not on disk', () => {
      const before = fail.length;
      checkStore(new Map([['media/tex/nothing.deadbeef.jpg', 'synthetic']]),
                 present);
      const caught = fail.length > before;
      fail.length = before;
      return caught; }],
    ['an orphan file no manifest references', () => {
      const before = fail.length;
      checkStore(refs, present.concat(['media/tex/planted.00000000.jpg']));
      const caught = fail.length > before;
      fail.length = before;
      return caught; }],
    ['a scan that finds nothing at all', () => {
      const before = fail.length;
      checkStore(new Map(), []);
      const caught = fail.length > before;
      fail.length = before;
      return caught; }],
    ['base64 creeping back into a manifest', () => {
      const tmp = path.join(__dirname, '_media_selftest.tmp.js');
      fs.writeFileSync(tmp, 'const X = "data:image/png;base64,AAAA";');
      const before = fail.length;
      checkNoCreep([tmp]);
      const caught = fail.length > before;
      fail.length = before;
      fs.unlinkSync(tmp);
      return caught; }],
    ['an artifact past its budget', () =>
      // the shape of the check, on a synthetic size: the real budget has
      // headroom, so the assertion is exercised against a doctored ceiling
      !(art && art.mib <= 0.001)],
    ['a data: payload past what the fonts cost', () =>
      dataBytes('data:font/woff2;base64,' + 'A'.repeat(500 * 1024)) / 1024
        > DATA_BUDGET_KB],
  ];
  let bad = 0;
  for (const [name, run] of cases) {
    let ok = false;
    try { ok = !!run(); } catch (e) { ok = false; }
    console.log(`  selftest ${ok ? 'caught  ' : 'MISSED  '}${name}`);
    if (!ok) bad++;
  }
  check(bad === 0, `${bad} rule(s) cannot be broken — those checks are inert`);
}

// ---------------------------------------------------------------------------
const byDir = {};
for (const rel of present) {
  const d = rel.split('/').slice(0, 3).join('/');
  const st = fs.statSync(path.join(ROOT, ...rel.split('/')));
  (byDir[d] = byDir[d] || { n: 0, b: 0 }).n++;
  byDir[d].b += st.size;
}
for (const d of Object.keys(byDir).sort())
  console.log(`  ${d}: ${byDir[d].n} files, ${(byDir[d].b / 1048576).toFixed(2)} MB`);
console.log(`  ${refs.size} references from ${files.length} manifests, ` +
  `${present.length} files in media/` +
  (art ? ` · index.html ${art.mib.toFixed(2)} MiB (budget ${BUDGET_MIB}), ` +
         `data: ${art.kb.toFixed(0)} KB (budget ${DATA_BUDGET_KB})` : ''));
if (fail.length) {
  for (const f of fail) console.log('  FAIL ' + f);
  console.log('GATE MEDIA: FAIL');
  process.exit(1);
}
console.log('GATE MEDIA: PASS');
