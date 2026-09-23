#!/usr/bin/env node
// island_node.js - THE ISLAND IN NODE (G434): what the page's loader fetches
// (build.js's island block: the quadtree, the grids), read off the disk, so a
// gate or a script can compose a world on Jolene headless:
//
//   const { islandWorld } = require('./island_node');
//   const W = islandWorld('jolene', { premises: fixtureText });   // null when the files are absent
//
// THE WORLD SHIPS (2026-09-23): the files live under media/world/<id>, named
// by src/core/world_packs.json (tools/world_prep.js bakes both), and they are
// IN THE REPOSITORY - so a worktree, a fresh clone and a cloud session all
// compose the same island. They lived under the gitignored bench/ until then,
// which is why every checkout but the one that baked them fell back to the
// analytic world and GATE WORLD skipped its island checks in silence.
//
// Two failure modes, deliberately different: an island the manifest does not
// name returns NULL (a typo'd --world says so, and no gate goes red for an
// island that was never baked); an island it DOES name whose payload is not on
// disk THROWS, because that is a broken checkout and must not be mistaken for
// an absent island.
//
// flight_core.js must be required by the caller (or here): it carries
// TERRAIN_CODEC, ISLAND_GEN and makeWorld.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const ROOT = path.join(__dirname, '..');

// THE RAW BENCH, STILL REACHABLE (G521's FLYDIY_BENCH, kept). The shipped
// manifest is the default and the only thing a gate measures by accident - it
// is what players get. But an island's author iterating a re-prep has bytes in
// bench/ that are not baked yet, and G521 added the honest way to read them:
//   FLYDIY_BENCH=D:/Dev/DeGaRoR.github.io/flyDiy/bench node tools/_hydro_check.js
// It is an EXPLICIT opt-in now rather than a fallback. Before the world shipped
// this read `bench/` whenever it existed, which silently divided what a gate
// measured from what the page fetched depending on which checkout it ran in.
// (Linking a bench into a worktree stays forbidden either way - `git worktree
// remove` follows the junction and empties the target, twice now.)
function benchBoot(name, BENCH) {
  const T = path.join(BENCH, 'terrain', name + '5_e2'), G = path.join(BENCH, name, 'dem'), F = path.join(BENCH, 'terrain', name + '5_e4');
  if (!fs.existsSync(T + '.json') || !fs.existsSync(G + '.json')) return null;
  const u8 = p => fs.existsSync(p) ? new Uint8Array(fs.readFileSync(p)) : null;
  const js = p => fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
  const gz = p => { const b = u8(p); return b ? new Uint8Array(zlib.gunzipSync(Buffer.from(b))) : null; };
  const far = (js(F + '.json') && u8(F + '.topo') && u8(F + '.bin')) ? { header: js(F + '.json'), topo: u8(F + '.topo'), payload: gz(F + '.bin') } : null;
  return { id: name, header: js(T + '.json'), topo: u8(T + '.topo'), payload: gz(T + '.bin'),
    grid: { meta: js(G + '.json'), cover: u8(G + '.u8'), canopy: u8(G + '.canopy.u8'), coast: u8(G + '.coast.u8'), albedo: u8(G + '.albedo.rgb'),
            tint: u8(G + '.tint.rgb'), ori1: u8(G + '.ori1.u8'), ndvi: u8(G + '.ndvi.u8'), lake: u8(G + '.lake.u8'), ttype: u8(G + '.ttype.u8'), lakes: js(G + '.lakes.json') },
    far, hydro: 'blend' };
}

function worldPack() {
  const p = path.join(ROOT, 'src', 'core', 'world_packs.json');
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : { islands: [] };
}

// the manifest KEY is the dotted path into the boot object, so nothing here
// spells a filename; the page loader in tools/build.js carries the same line
const set = (o, k, v) => { const p = k.split('.'); for (let i = 0; i < p.length - 1; i++) o = (o[p[i]] = o[p[i]] || {}); o[p[p.length - 1]] = v; };

function islandBoot(name) {
  if (process.env.FLYDIY_BENCH) return benchBoot(name, process.env.FLYDIY_BENCH);   // explicit: the un-baked bench
  const isl = (worldPack().islands || []).find(w => w.id === name);
  if (!isl) return null;
  const boot = { id: name, grid: {}, far: {}, hydro: 'blend' };
  for (const k of Object.keys(isl.files)) {
    const r = isl.files[k];
    if ('json' in r) { set(boot, k, r.json); continue; }      // inlined in the manifest
    const abs = path.join(ROOT, ...r.src.split('/'));
    if (!fs.existsSync(abs)) throw new Error('island_node: "' + name + '" names ' + r.src + ' and it is not on disk - this checkout is broken (re-bake with tools/world_prep.js, or restore the payload)');
    const raw = new Uint8Array(zlib.gunzipSync(fs.readFileSync(abs)));   // every payload is ONE gzip stream
    set(boot, k, r.kind === 'json' ? JSON.parse(Buffer.from(raw).toString('utf8')) : raw);
  }
  if (!(boot.far && boot.far.header && boot.far.topo && boot.far.payload)) boot.far = null;
  return boot;
}

// THE AUTHORING SOURCES: the 5 m float DEM, shipped for the premises authors
// (tools/jolene_author.py reads the runway levels off it) and never fetched by
// the page - it lives in the manifest's `authoring` section, which the loader
// does not iterate. Returns the decompressed Buffer, or null when this island
// ships no such file.
function islandAuthoring(name, key) {
  const isl = (worldPack().islands || []).find(w => w.id === name);
  const r = isl && isl.authoring && isl.authoring[key];
  if (!r) return null;
  const abs = path.join(ROOT, ...r.src.split('/'));
  if (!fs.existsSync(abs)) throw new Error('island_node: "' + name + '" names the authoring source ' + r.src + ' and it is not on disk');
  return zlib.gunzipSync(fs.readFileSync(abs));
}

function islandWorld(name, opts) {
  const C = require(path.join(ROOT, 'tools', 'flight_core.js'));
  const boot = islandBoot(name);
  if (!boot) return null;
  const island = C.ISLAND_GEN.makeIsland(boot);
  return C.makeWorld(0, Object.assign({ island }, opts || {}));
}

module.exports = { islandBoot, islandWorld, islandAuthoring, worldPack };

if (require.main === module) {
  const name = process.argv[2] || 'jolene';
  const fx = path.join(ROOT, 'tools', 'fixtures', 'island_' + name + '.json');
  const t0 = Date.now();
  const W = islandWorld(name, { premises: fs.existsSync(fx) ? fs.readFileSync(fx, 'utf8') : null });
  if (!W) { console.log('island_node: src/core/world_packs.json names no island "' + name + '"'); process.exit(0); }
  console.log('island ' + name + ' in ' + (Date.now() - t0) + ' ms; aerodromes: ' + W.aerodromes.map(a => a.id + ' (' + a.kind + ', ' + a.name + ')').join(', '));
}
