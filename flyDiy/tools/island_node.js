#!/usr/bin/env node
// island_node.js - THE ISLAND IN NODE (G434): what the page's loader fetches
// (build.js's island block: the quadtree, the grids), read off the disk, so a
// gate or a script can compose a world on Jolene headless:
//
//   const { islandWorld } = require('./island_node');
//   const W = islandWorld('jolene', { premises: fixtureText });   // null when the files are absent
//
// The files live under bench/ (gitignored: the developer's machine); absent,
// islandWorld returns null and the caller says so - never a red for a
// missing island. flight_core.js must be required by the caller (or here):
// it carries TERRAIN_CODEC, ISLAND_GEN and makeWorld.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const ROOT = path.join(__dirname, '..');

function islandBoot(name) {
  const T = path.join(ROOT, 'bench', 'terrain', name + '5_e2'), G = path.join(ROOT, 'bench', name, 'dem'), F = path.join(ROOT, 'bench', 'terrain', name + '5_e4');
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

function islandWorld(name, opts) {
  const C = require(path.join(ROOT, 'tools', 'flight_core.js'));
  const boot = islandBoot(name);
  if (!boot) return null;
  const island = C.ISLAND_GEN.makeIsland(boot);
  return C.makeWorld(0, Object.assign({ island }, opts || {}));
}

module.exports = { islandBoot, islandWorld };

if (require.main === module) {
  const name = process.argv[2] || 'jolene';
  const fx = path.join(ROOT, 'tools', 'fixtures', 'island_' + name + '.json');
  const t0 = Date.now();
  const W = islandWorld(name, { premises: fs.existsSync(fx) ? fs.readFileSync(fx, 'utf8') : null });
  if (!W) { console.log('island_node: no files for ' + name + ' under bench/'); process.exit(0); }
  console.log('island ' + name + ' in ' + (Date.now() - t0) + ' ms; aerodromes: ' + W.aerodromes.map(a => a.id + ' (' + a.kind + ', ' + a.name + ')').join(', '));
}
