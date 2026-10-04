// THE LIVE ANIMALS IN NODE (G1705, SND-ANIMALS) - the page's own animals layer (src/viewer/animals.js + animal_run.js on
// the real vendor/three.min.js, the shipped payload src/animals/*) in a vm, as GATE ANIMALS runs it (tools/_animal_check.js
// viewerContext: the same files, the same order). GATE AUDIO's ANI* checks and the evidence (animals_render.js) drive
// the REAL behaviours with it - the clip machine, the dive cycle, the flocks - and read them through the sound's reader.
//
//   const AW = require('./animal_world.js');
//   const L = await AW.load({ runText })        // runText: animal_run.js's source (a mutation is a string), optional
//   const R = L.make({ ground, waterH, eye })   // ANIMAL_RUN.make on a scene of its own (no water field, no spray)
//   R.sync([{ id, key, x, z, n, r, dy }]); R.tick(dt); R.sound(out, since); R.clock()
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src', 'animals');
let CORE = null, THREE = null;

async function load(o) {
  o = o || {};
  if (!CORE) CORE = require(path.join(ROOT, 'tools', 'flight_core.js'));
  if (!THREE) THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
  const { readGeo } = require(path.join(ROOT, 'tools', '_media_lib.js'));
  const g = {};
  for (const k of Object.keys(CORE)) g[k] = CORE[k];
  g.THREE = THREE;
  g.console = o.console || { log() {}, info() {}, warn() {}, error: console.error };
  g.performance = { now: () => Number(process.hrtime.bigint()) / 1e6 };
  g.Image = function () { return { addEventListener() {}, set src(v) {}, complete: false }; };
  g.FLYDIY_ASSET_BASE = '';
  const ctx = vm.createContext(g);
  vm.runInContext('var window = globalThis; window.window = window;', ctx);
  g.ASSET_FETCH = rel => Promise.resolve(readGeo(rel));
  for (const f of ['matlib.js', 'props.js', 'plume.js', 'animals.js', 'animal_run.js']) {
    const text = f === 'animal_run.js' && o.runText != null ? o.runText : fs.readFileSync(path.join(ROOT, 'src', 'viewer', f), 'utf8');
    vm.runInContext(text, ctx, { filename: f });
  }
  for (const f of JSON.parse(fs.readFileSync(path.join(SRC, 'animals_index.json'), 'utf8')))
    vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), ctx, { filename: f });
  for (const f of JSON.parse(fs.readFileSync(path.join(SRC, 'animals_packs.json'), 'utf8')))
    vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), ctx, { filename: f });
  const AN = g.ANIMALS, AR = g.ANIMAL_RUN;
  const keys = AN.list().map(a => a.key);
  await Promise.all(keys.map(k => AN.warm(k)));
  return {
    g, THREE, AN, AR, keys, ctx,
    make(c) {
      const scene = new THREE.Group();
      return AR.make(THREE, Object.assign({ scene, ground: () => 0, waterH: () => -Infinity, lit: () => 1, wind: () => [0, 0] }, c || {}));
    },
  };
}
module.exports = { load };
