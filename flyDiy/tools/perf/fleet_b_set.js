// fleet_b_set.js - FLEET-PROPS B (G2225): THE TEST FLEET, one definition for the rig (tools/perf/fleet_b.js) and the node
// gates' fleet variants (FRAMECOST_FLEET=1, INSTANT --fleet): the user's six validated airframes saved as slots
// (fleet-1-cub .. fleet-6-metal: their slot names are the order they take an aerodrome's spots) and the player's
// document with all six tied down OUTSIDE at HOME, no wear.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const FLEET = [
  ['fleet-1-cub', 'builds/cub_2026-09-20_corrected.json'],
  ['fleet-2-jodel', 'builds/jodel_2026-09-20_corrected.json'],
  ['fleet-3-c172', 'builds/cessna172_2026-09-20_corrected.json'],
  ['fleet-4-c172floats', 'bugReports/cessnaFloatsWOrks.json'],
  ['fleet-5-twinfloats', 'tools/fixtures/build_v7_ultralight_2026-09-05.json', j => { j.spec.gear.type = 'floats'; j.spec.cage = Object.assign({}, j.spec.cage, { gearFloats: 1 }); return j; }],
  ['fleet-6-metal', 'bugReports/cessnaMetal (1).json'],
];
// localStorage entries: { 'flydiy.build.<name>': <text>, ..., 'flydiy.player': <text> }
function storage() {
  const C = require(path.join(ROOT, 'tools', 'flight_core.js'));
  const doc = C.playerNormalise(C.playerDefault()), out = {};
  for (const [name, file, patch] of FLEET) {
    let j = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    if (patch) j = patch(j);
    j.name = name;
    out['flydiy.build.' + name] = JSON.stringify(j);
    doc.fleet[name] = { hangar: null, aero: 'HOME', outSince: 0, wearOut: 0 };
  }
  out['flydiy.player'] = JSON.stringify(doc);
  return out;
}
// the same as a script run before the page's own (rollout_perf --pre, live_driver PRE)
function preScript() {
  const S = storage();
  return ['// fleet_b_set.js: the six slots and the ledger (G2225)'].concat(Object.keys(S).map(k => 'try{localStorage.setItem(' + JSON.stringify(k) + ',' + JSON.stringify(S[k]) + ')}catch(e){}')).join('\n') + '\n';
}
module.exports = { FLEET, storage, preScript };
