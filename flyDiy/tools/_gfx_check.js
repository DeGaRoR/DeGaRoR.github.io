#!/usr/bin/env node
// _gfx_check.js — GATE GFX: the graphics settings menu (G286) owns a saved
// choice and applies it to the world's handles - so the menu is tested as a
// contract over those handles, in a vm with stubs for every one of them.
//
//   node tools/_gfx_check.js   -> "GATE GFX: PASS|FAIL", exit 1 on FAIL
//
// 1. every preset resolves every option to one of its named steps
// 2. the pref round-trips: a saved choice is the choice at the next boot
// 3. applying a preset puts the preset's values on every handle
// 4. one option changed under a preset makes it `custom`; picking a
//    preset again rewrites every option
// 5. no pref = medium; a corrupt pref = medium
// 6. a density that does not change never re-grids the fill
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

let fails = 0;
const ok = (c, msg) => { console.log((c ? '  ok   ' : '  FAIL ') + msg); if (!c) fails++; };

// ---- the stubs: every handle the menu drives, recording what it is told ----
function makeWindow(store) {
  const log = [];
  const rig = { shadowMap: 1024, farShadow: true, floor: 0.30, row: 'sunset' };
  const w = {
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
    },
    requestAnimationFrame: () => 1,
    FLYDIY_AA: { _tier: 'full', setTier(t) { this._tier = t; log.push(['aa', t]); }, tier() { return this._tier; } },
    TREE_FILL: { _ng: 128, get() { return this._ng; }, set(ng) { this._ng = ng; log.push(['fill', ng]); return ng; } },
    TREE_LOD: { _b: [10, 30, 30], get() { return this._b.slice(); }, set(b) { this._b = b.slice(); log.push(['bands', b.join('/')]); } },
    WORLD_RIG: { get: () => Object.assign({}, rig),
                 set(o) { Object.assign(rig, o); log.push(['rig', JSON.stringify(o)]); },
                 row(n) { rig.row = n; rig.shadowMap = 2048; rig.floor = 0.30; log.push(['row', n]); } },
    WORLD: { sun: { castShadow: true } },
    log, rig,
  };
  w.window = w;
  return w;
}
function boot(store) {
  const w = makeWindow(store);
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'gfx_settings.js'), 'utf8');
  vm.runInNewContext(src, Object.assign({ window: w, setInterval: () => 0, clearInterval: () => {} }, w));
  return w;
}

console.log('GATE GFX');
// 1. the presets are complete
{
  const w = boot({});
  const G = w.GFX;
  let complete = true;
  for (const p in G.PRESETS) for (const o of G.OPTIONS)
    if (!o.steps.some(s => s.v === G.PRESETS[p][o.k])) { complete = false; console.log('    ' + p + '.' + o.k + ' = ' + G.PRESETS[p][o.k] + ' is not a step'); }
  ok(complete, 'every preset resolves every option to a named step (' + Object.keys(G.PRESETS).length + ' presets, ' + G.OPTIONS.length + ' options)');
}
// 1b. the five tiers (PERF 2026-09-23): named, labelled, gamer the default, and gamer IS the medium of before
{
  const w = boot({});
  const G = w.GFX;
  ok(Object.keys(G.PRESETS).join(',') === 'potato,retro,current,gamer,ultra' && G.DEFAULT === 'gamer',
     'five tiers, potato .. ultra, gamer the default (' + Object.keys(G.PRESETS).join(',') + ')');
  const OLD_MEDIUM = { ground: 'far1', terrain: 1, scale: 1, drawDist: 'vis', aa: 'msaa', density: 128, bands: 'near', shadows: 'full', canopy: 'on', rails: 'on', poles: 'on', lighting: 'sunset', tone: 'cineon', exposure: 1, colour: 'managed', glare: 'on', sway: 'on', mist: 'land', clouds: 'half', bloom: 'off', look: 'off', lens: 'off', rays: 'off', ao: 'off', eye: 'off', compositing: 'linear', water: 'full', mirror: 'periodic' };
  OLD_MEDIUM.bloom = 'soft';   // the default look (2026-09-23): the soft bloom from 'current' up
  ok(G.OPTIONS.every(o => G.PRESETS.gamer[o.k] === OLD_MEDIUM[o.k]), 'gamer is the medium of before, option for option (plus the far ground lean, G513)');
  const w2 = boot({ 'flydiy.gfx': JSON.stringify(Object.assign({ preset: 'medium' }, OLD_MEDIUM)) });
  ok(w2.GFX.get().preset === 'gamer', 'a choice saved as medium reads as gamer');
  ok(Object.keys(G.PRESETS).every(p => G.PRESET_LABEL[p]), 'every tier has its label');
}
// 5. no pref, corrupt pref
{
  const w = boot({});
  ok(w.GFX.get().preset === 'gamer', 'no pref boots on gamer (the default tier)');
  const w2 = boot({ 'flydiy.gfx': '{not json' });
  ok(w2.GFX.get().preset === 'gamer', 'a corrupt pref boots on gamer');
  const w3 = boot({ 'flydiy.gfx': JSON.stringify({ preset: 'retro', aa: 'nope', density: 5 }) });
  ok(w3.GFX.get().aa === 'msaa' && w3.GFX.get().density === 128, 'unknown steps in the pref fall back to gamer’s');
}
// 3 + 4. applying, and custom
{
  const store = {};
  const w = boot(store);
  const G = w.GFX;
  G.onWorld();
  ok(w.FLYDIY_AA.tier() === 'msaa' && w.rig.shadowMap === 2048 && w.rig.farShadow === true && w.rig.floor === 0.30,
     'gamer at boot: smooth, 2048 map, far cascade, floor on');
  const nBefore = w.log.filter(e => e[0] === 'fill').length;
  ok(nBefore === 0, 'the boot did not re-grid a fill already at gamer’s density (' + nBefore + ' re-grids)');
  G.set('preset', 'retro');
  ok(w.FLYDIY_AA.tier() === 'off' && w.TREE_FILL.get() === 100 && w.TREE_LOD.get().join('/') === '10/30/30' &&
     w.rig.shadowMap === 1024 && w.rig.farShadow === false && w.rig.floor === 1.0 && w.WORLD.sun.castShadow === true,
     'retro (the low of before): off, 100, impostor-first bands (10/30), 1024 map, no cascade, floor off, sun still casts');
  G.set('shadows', 'off');
  ok(G.get().preset === 'custom', 'one option changed under a preset makes it custom');
  ok(w.WORLD.sun.castShadow === false && w.rig.farShadow === false, 'shadows off: the sun stops casting and the cascade is off');
  G.set('preset', 'ultra');
  const s = G.get();
  ok(s.preset === 'ultra' && s.shadows === 'ultra' && s.aa === 'full' && s.density === 200,
     'picking a preset again rewrites every option');
  ok(w.WORLD.sun.castShadow === true && w.rig.shadowMap === 4096 && w.TREE_FILL.get() === 200 && w.FLYDIY_AA.tier() === 'full',
     'ultra: the sun casts again, 4096 map, 200, smoothest');
  G.set('lighting', 'alps');
  ok(w.rig.row === 'alps' && w.rig.shadowMap === 4096, 'a lighting row change re-asserts the shadow choice over the row’s own');
  // 2. the pref round-trips
  const w2 = boot(store);
  const t = w2.GFX.get();
  ok(t.preset === 'custom' && t.lighting === 'alps' && t.shadows === 'ultra' && t.density === 200,
     'the saved choice is the choice at the next boot (' + JSON.stringify(t) + ')');
  w2.GFX.onWorld();
  ok(w2.rig.row === 'alps' && w2.TREE_FILL.get() === 200 && w2.FLYDIY_AA.tier() === 'full', 'and it is applied to the handles at that boot');
}
// 6. the restart contract is stated
{
  const w = boot({});
  const r = w.GFX.restart();
  ok(r.anything === 'no restart' && Object.keys(r).length >= 7, 'every option states what changing it costs; nothing needs a restart');
}

console.log(fails ? 'GATE GFX: FAIL' : 'GATE GFX: PASS');
process.exit(fails ? 1 : 0);
