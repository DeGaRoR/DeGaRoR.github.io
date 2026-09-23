#!/usr/bin/env node
// world_prep.js — THE MANIFEST BAKE: a world leaves bench/ and SHIPS.
//
//   node tools/world_prep.js --island jolene --report     # measure, write nothing
//   node tools/world_prep.js --island jolene              # bake into media/world/<id>
//   node tools/world_prep.js --island jolene --bench D:/Dev/DeGaRoR.github.io/flyDiy/bench
//
// This is the tool tools/terrain_bake.js's writeGuard has always pointed at:
// "when the terrain asset really does ship, the thing writing it into media/
// will be the manifest bake, not this bench tool". terrain_bake.js and
// island_prep.py still write bench/ — the developer's scratch, gitignored,
// 1.4 GB of intermediates. This tool takes the SEVENTEEN files the game
// actually reads out of that scratch, gzips them, and writes them into the
// shipped store under content-hashed names, with one manifest naming every
// one: src/core/world_packs.json.
//
// THE LOOP, so the two halves never blur:
//   island_prep.py -> terrain_bake.js -> the bench tools iterate  (bench/, local)
//   world_prep.js  -> build.js        -> the gates                (media/, shipped)
// The bench half never touches media/; the ship half never re-derives.
//
// THREE RULES THIS FILE KEEPS
//
//   ONE GZIP STREAM   every file under media/world is exactly one gzip stream
//                     with the .bin extension. .bin because GATE MEDIA's
//                     reference regex already matches it (jpg|png|webp|bin) —
//                     a world ships without widening the store's grammar. One
//                     stream because then the consumer has ONE code path:
//                     gunzip, always. The two terrain payloads are ALREADY
//                     gzip in bench/, so they are copied byte-exact — the test
//                     is the magic number, never a flag that can lie.
//
//   ONE NAME LIST     the SET table below is the only place in the repository
//                     where these seventeen filenames exist. The manifest key
//                     IS the dotted path into the boot object, so the page
//                     loader and island_node.js both assemble generically and
//                     neither one spells a filename. A second island is a bake,
//                     not a code edit.
//
//   CONTENT-HASHED    via _media_lib.writeMedia. Not cosmetic: sw.js is
//                     cache-first and PERMANENT for /media/ (flydiy-media-v1,
//                     no eviction), so an unhashed world payload would be
//                     stuck in a returning player's cache for ever.
//
// THE PRICE, out loud: a re-bake writes ~48 MB of new blobs into git history,
// for ever. Batch world changes; do not re-bake to test a threshold — that is
// what bench/ and tools/_island.html are for. writeMedia is content-addressed,
// so a re-bake of unchanged bytes writes nothing and adds nothing.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { writeMedia, pruneMedia } = require('./_media_lib.js');

const ROOT = path.join(__dirname, '..');

// THE ONE LIST. key = the dotted path into the boot object that
// src/core/28_island.js reads (header/topo/payload, grid.*, far.*); src = the
// file under bench/, <id> standing for the island; kind = how the consumer
// decodes it after the gunzip; stem = the media basename the hash rides on.
const SET = [
  ['header',      'terrain/<id>5_e2.json',   'json', 'e2_header'],
  ['topo',        'terrain/<id>5_e2.topo',   'u8',   'e2_topo'],
  ['payload',     'terrain/<id>5_e2.bin',    'u8',   'e2_tree'],
  ['far.header',  'terrain/<id>5_e4.json',   'json', 'e4_header'],
  ['far.topo',    'terrain/<id>5_e4.topo',   'u8',   'e4_topo'],
  ['far.payload', 'terrain/<id>5_e4.bin',    'u8',   'e4_tree'],
  ['grid.meta',   '<id>/dem.json',           'json', 'grid_meta'],
  ['grid.cover',  '<id>/dem.u8',             'u8',   'cover'],
  ['grid.canopy', '<id>/dem.canopy.u8',      'u8',   'canopy'],
  ['grid.coast',  '<id>/dem.coast.u8',       'u8',   'coast'],
  ['grid.albedo', '<id>/dem.albedo.rgb',     'u8',   'albedo'],
  ['grid.tint',   '<id>/dem.tint.rgb',       'u8',   'tint'],
  ['grid.ori1',   '<id>/dem.ori1.u8',        'u8',   'ori1'],
  ['grid.ndvi',   '<id>/dem.ndvi.u8',        'u8',   'ndvi'],
  ['grid.lake',   '<id>/dem.lake.u8',        'u8',   'lake'],
  ['grid.ttype',  '<id>/dem.ttype.u8',       'u8',   'ttype'],
  ['grid.lakes',  '<id>/dem.lakes.json',     'json', 'lakes'],
];

// AUTHORING, not runtime: a sibling of `files` in the manifest, and the page
// loader iterates `files` only — so the browser never fetches these. The 5 m
// float DEM is what tools/jolene_author.py samples to place the runways and
// read their levels; shipping it is what lets the premises be re-authored off
// the machine that baked the island (the user's ruling, 2026-09-22).
const AUTHORING = [
  ['f32', '<id>/dem.f32', 'f32', 'dem_f32'],
];

// absent -> the key is simply omitted, and the loader's contract is "what is
// named must fetch". These five may never be omitted: without them there is no
// island at all, and a half-island must fail loudly at the bake, not at boot.
const REQUIRED = new Set(['header', 'topo', 'payload', 'grid.meta', 'grid.cover']);

// a JSON source at or under this size is INLINED into the manifest (and so
// into index.html), decoded, costing no round trip at all. Kept at 1 KB on
// purpose: that inlines the two quadtree headers (299 + 297 B), which are the
// two the boot path cannot start without, and leaves dem.json (3.1 KB) and
// dem.lakes.json (28 KB) as payloads. index.html has ~17 KB of headroom under
// GATE MEDIA's 8.7 MiB budget and it is not this asset's to spend - a world
// must not be the reason another chantier's feature does not fit.
const INLINE_MAX = 1024;

// Copied here so the manifest carries its own attribution and CREDITS.md and
// the shipped asset cannot drift apart silently — GATE WORLD checks that the
// sources named here are the sources CREDITS.md documents.
const CREDIT = {
  jolene: {
    text: 'Annette Island, Southeast Alaska, taken whole from public data and renamed. '
        + 'Elevation and radar: USGS 3DEP Alaska IFSAR 5 m (US federal public domain). '
        + 'Macro tint: USGS Landsat 8 Collection 2 Level-2 (US federal public domain). '
        + 'Land cover: (C) ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021), CC-BY 4.0. '
        + 'Canopy height: (C) Meta and WRI (2024), CC-BY 4.0. '
        + 'Modifications and the full notice: flyDiy/CREDITS.md.',
    // the tokens GATE WORLD looks for in CREDITS.md - the two CC-BY holders and
    // the two public-domain programmes. A source that loses its line in
    // CREDITS.md goes red here.
    sources: ['IFSAR', 'Landsat', 'ESA WorldCover', 'Meta'],
  },
};

const MB = b => (b / 1048576).toFixed(2) + ' MB';

function flag(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  if (i < 0) return dflt;
  const v = process.argv[i + 1];
  return (v === undefined || v.startsWith('--')) ? true : v;
}

function bake() {
  const id = String(flag('island', 'jolene'));
  const report = !!flag('report', false);
  const level = Number(flag('level', 9));
  const noPrune = !!flag('no-prune', false);
  const benchArg = String(flag('bench', 'bench'));
  const BENCH = path.isAbsolute(benchArg) ? benchArg : path.join(ROOT, benchArg);

  if (!/^[a-z0-9_]+$/.test(id)) { console.error('world_prep: the island id must match /^[a-z0-9_]+$/ — got "' + id + '"'); process.exit(2); }
  if (!fs.existsSync(BENCH)) { console.error('world_prep: no bench at ' + BENCH + ' — pass --bench <dir> (the bake lives on the machine that ran island_prep.py)'); process.exit(2); }

  console.log('world_prep: island ' + id + ', bench ' + BENCH + (report ? '  [--report: nothing is written]' : ''));

  const files = {}, keep = [];
  let rawTotal = 0, shipTotal = 0, inlined = 0, wrote = 0, omitted = [];

  const one = (key, src, kind, stem, into) => {
    const abs = path.join(BENCH, src.replace('<id>', id));
    if (!fs.existsSync(abs)) {
      if (REQUIRED.has(key)) { console.error('world_prep: REQUIRED ' + key + ' is missing (' + abs + ') — there is no island without it'); process.exit(2); }
      omitted.push(key);
      return;
    }
    const buf = fs.readFileSync(abs);
    if (kind === 'json' && buf.length <= INLINE_MAX) {
      rawTotal += buf.length;
      into[key] = { json: JSON.parse(buf.toString('utf8')) };
      inlined++;
      console.log('  ' + key.padEnd(12) + ' ' + String(buf.length).padStart(10) + ' B  inlined into the manifest');
      return;
    }
    // ONE gzip stream, always. The magic number decides - the two terrain
    // payloads come out of terrain_bake.js already gzipped and are copied
    // byte for byte rather than wrapped in a second stream.
    const already = buf.length > 1 && buf[0] === 0x1f && buf[1] === 0x8b;
    const gz = already ? buf : zlib.gzipSync(buf, { level });
    // `raw` is what the consumer holds AFTER the gunzip - so the invariant
    // "gunzip(src).length === raw" is one rule for all of them. For a payload
    // that arrived already compressed, that is NOT the file's size on disk,
    // and taking it to be was this file's first bug: GATE WORLD's new
    // size check caught the two terrain payloads on its first run.
    const rawLen = already ? zlib.gunzipSync(buf).length : buf.length;
    rawTotal += rawLen;
    shipTotal += gz.length;
    const rel = report
      ? 'media/world/' + id + '/' + stem + '.<h8>.bin'
      : writeMedia('world/' + id, stem, 'bin', gz);
    if (!report) { keep.push(rel); wrote++; }
    into[key] = { src: rel, kind, raw: rawLen };
    console.log('  ' + key.padEnd(12) + ' ' + String(rawLen).padStart(10) + ' B -> ' + String(gz.length).padStart(10) + ' B  ' + (already ? '(already gzip, copied)' : '') + '  ' + path.basename(rel));
  };

  for (const [key, src, kind, stem] of SET) one(key, src, kind, stem, files);
  const authoring = {};
  for (const [key, src, kind, stem] of AUTHORING) one(key, src, kind, stem, authoring);

  const meta = files['grid.meta'] && files['grid.meta'].json;
  const island = {
    id,
    name: id === 'jolene' ? 'Jolene Island' : id,
    baked: new Date().toISOString().slice(0, 10),
    credit: (CREDIT[id] || {}).text || '',
    sources: (CREDIT[id] || {}).sources || [],
    bytes: { raw: rawTotal, ship: shipTotal },
    files,
  };
  if (meta) island.grid = { w: meta.w, h: meta.h, cell: meta.cell, x0: meta.x0, z0: meta.z0 };
  if (Object.keys(authoring).length) island.authoring = authoring;

  console.log('  ---');
  console.log('  ' + SET.length + ' runtime keys: ' + inlined + ' inlined, ' + (Object.keys(files).length - inlined) + ' shipped' + (omitted.length ? ', omitted: ' + omitted.join(', ') : ''));
  console.log('  raw ' + MB(rawTotal) + '  ->  ship ' + MB(shipTotal));

  if (report) {
    console.log('\nnothing was written (--report). To bake and stage:');
    console.log('  node tools/world_prep.js --island ' + id + (benchArg === 'bench' ? '' : ' --bench ' + benchArg));
    console.log('  node tools/build.js');
    console.log('  git add flyDiy/media/world/' + id + ' flyDiy/src/core/world_packs.json');
    return;
  }

  // the manifest: merged BY ID, so baking a second island cannot clobber the first
  const OUT = path.join(ROOT, 'src', 'core', 'world_packs.json');
  const pack = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { note: '', v: 1, islands: [] };
  pack.note = 'GENERATED by tools/world_prep.js from bench/ — do not edit. Every src is one gzip stream; the key is the path into the boot object.';
  pack.v = 1;
  pack.islands = (pack.islands || []).filter(w => w.id !== id).concat([island]);
  pack.islands.sort((a, b) => a.id < b.id ? -1 : 1);
  fs.writeFileSync(OUT, JSON.stringify(pack, null, 1) + '\n');
  console.log('  manifest: src/core/world_packs.json (' + pack.islands.length + ' island' + (pack.islands.length === 1 ? '' : 's') + ')');

  // OWNED DIR: this bake owns media/world/<id> entirely, so anything it did not
  // emit is an orphan and GATE MEDIA would say so. Keeping the ownership per
  // ISLAND means a second island's files are never in this prune's sights.
  if (!noPrune) {
    const gone = pruneMedia('world/' + id, keep);
    if (gone.length) console.log('  pruned ' + gone.length + ': ' + gone.join(', '));
  }
  console.log('  wrote ' + wrote + ' files into media/world/' + id + ' (' + MB(shipTotal) + ')');
  console.log('\nnext: node tools/build.js   then   node tools/_media_check.js && node tools/test_world.js');
}

module.exports = { SET, AUTHORING, REQUIRED, INLINE_MAX };

if (require.main === module) bake();
