#!/usr/bin/env node
// GATE DEFAULT (G770) — THE PLAYER'S DEFAULT IS THE CUB, AND "THE STOCK BUILD" STILL IS THE OLD STOCK.
//
// The user (2026-09-27): "the default plane should be updated to the cub once and for all". Two halves,
// and a gate for each so neither drifts:
//   1. THE PLAYER. app.js's garage bridge hands garage.js `playerDefaultSpec` as api.defaults(): the Cub
//      archetype as the birth flow's Cub tile bakes it (CAGE_DESIGN.designBake on the 'cub' card),
//      normalised, with a cage (so the boot adopts it and seeds the editor with it); GEN_DEFAULT only when
//      the design rows are absent. Run here on the ARTIFACT's own text (index.html), against the real
//      design rows. The editor's reset (CAGE_RESET_BUILD) hands back the same aeroplane.
//   2. THE BASELINES. GEN_DEFAULT is still 'Garage Special' (what buildGen() builds, what every node gate
//      and pilot_trace's 'stock' fly), and tools/_stock_pin.js's working build is GEN_DEFAULT with no cage
//      - the envelope the boot does NOT adopt, so a pinned browser rig takes the pre-G770 road (the page's
//      own cage, joined) - and every rig named in that file carries the pin.
//
//   node tools/_default_check.js     -> "GATE DEFAULT: PASS|FAIL"
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const T = __dirname;
const C = require(path.join(T, 'flight_core.js'));
const BJ = require(path.join(T, '_bake_joined.js'));
const SP = require(path.join(T, '_stock_pin.js'));

const fail = [];
const check = (ok, label, extra) => { if (!ok) fail.push(label + (extra ? ' - ' + extra : '')); return ok; };

// ---- 2. the baselines' stock ---------------------------------------------------------------
check(C.GEN_DEFAULT && C.GEN_DEFAULT.meta && C.GEN_DEFAULT.meta.name === 'Garage Special',
      'GEN_DEFAULT is still the old stock (Garage Special) - the node gates fly it by name', C.GEN_DEFAULT && C.GEN_DEFAULT.meta && C.GEN_DEFAULT.meta.name);
const wip = JSON.parse(SP.stockWip());
check(wip.what === 'flydiy-build' && JSON.stringify(wip.spec) === JSON.stringify(C.GEN_DEFAULT),
      'the pinned working build is GEN_DEFAULT, verbatim');
// app.js's boot adopts a restored build only with a cage; GEN_DEFAULT's null cage takes the old road
check(!(wip.spec.cage && Object.keys(wip.spec.cage).length), 'the pinned build carries no cage (the boot opens the page\'s own cage, as before G770)');
for (const f of ['rollout_perf', 'frame_perf', 'tree_perf', 'met_perf', 'boot_perf', 'program_census', 'sampler_census'])
  check(/_stock_pin\.js/.test(fs.readFileSync(path.join(T, f + '.js'), 'utf8')), 'tools/' + f + '.js carries the stock pin');

// ---- 1. the player's default ----------------------------------------------------------------
const html = fs.readFileSync(path.join(T, '..', 'index.html'), 'utf8');
const i0 = html.indexOf('const PLAYER_DEFAULT_ARCH'), i1 = html.indexOf('if (typeof garageInit === \'function\') garageInit({', i0);
check(i0 > 0 && i1 > i0, 'app.js declares the player\'s default before the garage bridge');
check(/garageInit\(\{\s*defaults: playerDefaultSpec,/.test(html), 'the garage bridge\'s defaults() is playerDefaultSpec');
if (i0 > 0 && i1 > i0) {
  const src = html.slice(i0, i1);
  check(/PLAYER_DEFAULT_ARCH = 'cub'/.test(src), 'the default archetype is the cub');
  BJ.loadPanel();
  const D = require(path.join(T, '_cage_design.js'));
  const run = (window) => {
    const box = { window, GEN_DEFAULT: C.GEN_DEFAULT, genNormaliseSpec: C.genNormaliseSpec, console, JSON, Object };
    vm.createContext(box);
    vm.runInContext(src + '\n;this.__f = playerDefaultSpec;', box);
    return box;
  };
  const b = run({ CAGE_DESIGN: D, GARAGE_SPEC: { set: s => { b.__set = s; } } });
  const got = b.__f();
  const card = D.ARCHETYPES.find(a => a.key === 'cub');
  const want = C.genNormaliseSpec(D.designBake(card.sel, card.over));
  check(got && got.cage && Object.keys(got.cage).length > 0, 'the default carries a cage (the boot adopts it and seeds the editor)');
  check(JSON.stringify(got) === JSON.stringify(want), 'the default is the Cub card exactly as the birth flow bakes it');
  check(got && got.meta && /cub/i.test(got.meta.name || ''), 'the default is named as the Cub', got && got.meta && got.meta.name);
  b.window.CAGE_RESET_BUILD();
  check(b.__set && JSON.stringify(b.__set) === JSON.stringify(want), 'the editor\'s reset hands back the same Cub, through the shelf');
  const bare = run({});
  check(JSON.stringify(bare.__f()) === JSON.stringify(C.GEN_DEFAULT), 'without the design rows the default falls back to GEN_DEFAULT');
  // and it flies: the joined Cub builds (the aeroplane the game puts on the stand)
  const jc = BJ.bakeCard('cub');
  let ok = false; try { const def = C.buildGen(jc.spec); ok = def && def.nodes && def.nodes.length > 0; } catch (e) { ok = false; }
  check(ok, 'the joined Cub builds');
}

for (const f of fail) console.log('  FAIL ' + f);
console.log('GATE DEFAULT: ' + (fail.length ? 'FAIL (' + fail.length + ')' : 'PASS'));
process.exit(fail.length ? 1 : 0);
