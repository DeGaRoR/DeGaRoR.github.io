#!/usr/bin/env node
// storage2_set.js - HANGAR-STORAGE-2 (G2700-G2704): THE TEST FLEET IN THE CAREER, written before the page's first script.
// FLEET-PROPS B's six validated airframes (tools/perf/fleet_b_set.js: slots fleet-1-cub .. fleet-6-metal) saved as slots,
// and the dev career's document (flydiy.career.dev, ?career=1) made by THAT TREE's own core (its careerNew /
// careerNormalise: a base tree writes its PLAYER_V 2 document, this tree its v3) with the fleet placed:
//   fleetb   today's FLEET-PROPS B state: all six tied down OUTSIDE at HOME (no kind / slot: the base tree's rows)
//   store    the storage state of the A/B: two INSIDE the main hangar (the Cub, the Jodel: the residents beside the stand)
//            and four OUTSIDE on HOME's apron slots 0-3 (the C172, the C172 floats, the twin floats, the metal Cessna)
//   node tools/perf/storage2_set.js <tree flyDiy dir> <fleetb|store> <out.js> [--sandbox]
// --sandbox: the same fleet in the SANDBOX's document (flydiy.player, today's club: 2 inside) - the window's fallback when
// a career roll-out cannot be timed
// The stand's build is the rig's own (rollout_perf --build: flydiy.wip, unsaved - no fleet row).
'use strict';
const fs = require('fs'), path = require('path');
const [TREE, LAYOUT, OUT] = process.argv.slice(2);
const SANDBOX = process.argv.includes('--sandbox');
if (!TREE || !/^(fleetb|store)$/.test(LAYOUT || '') || !OUT) { console.log('storage2_set.js <tree flyDiy dir> <fleetb|store> <out.js>'); process.exit(2); }
const C = require(path.resolve(TREE, 'tools', 'flight_core.js'));
const SET = require('./fleet_b_set.js');
const ROOT = path.resolve(__dirname, '..', '..');
const out = {};
let doc = SANDBOX ? C.playerNormalise(C.playerDefault()) : C.careerNew({ id: 'dev', seed: 'dev', name: 'the dev career', started: '2026-10-11' });
SET.FLEET.forEach(([name, file, patch], i) => {
  let j = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  if (patch) j = patch(j);
  j.name = name;
  out['flydiy.build.' + name] = JSON.stringify(j);
  doc.fleet[name] = LAYOUT === 'fleetb' || i >= 2
    ? Object.assign({ hangar: null, aero: 'HOME', outSince: 0, wearOut: 0 }, LAYOUT === 'store' ? { kind: 'outside', slot: i - 2 } : {})
    : { hangar: 'HOME', aero: 'HOME', kind: 'inside', slot: i };
});
doc = SANDBOX ? C.playerNormalise(doc) : C.careerNormalise(doc);
const F = doc.fleet, rows = Object.keys(F).sort().map(n => n + ' ' + (F[n].hangar ? 'in ' + F[n].hangar : 'out ' + F[n].aero) + (F[n].kind ? ' ' + F[n].kind + (F[n].slot != null ? ' ' + F[n].slot : '') : ''));
out[SANDBOX ? 'flydiy.player' : C.careerKey('dev')] = JSON.stringify(doc);
const js = ['// storage2_set.js ' + LAYOUT + (SANDBOX ? ' SANDBOX' : ' career') + ' (core of ' + TREE + ', PLAYER_V ' + doc.v + '): ' + rows.join(' | '),
  'try{for(const k of Object.keys(localStorage)) if(/^flydiy\\.(build\\.|career\\.|player$)/.test(k)) localStorage.removeItem(k);}catch(e){}']
  .concat(Object.keys(out).map(k => 'try{localStorage.setItem(' + JSON.stringify(k) + ',' + JSON.stringify(out[k]) + ')}catch(e){}')).join('\n') + '\n';
fs.writeFileSync(OUT, js);
console.log(LAYOUT + (SANDBOX ? ' sandbox' : ' career') + ' v' + doc.v + ' -> ' + OUT + '\n  ' + rows.join('\n  '));
