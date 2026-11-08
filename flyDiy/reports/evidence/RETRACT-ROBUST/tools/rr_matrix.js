// RETRACT-ROBUST: the case list (plane x option), printed one per line as name|src|overJSON for xargs
'use strict';
const fs = require('fs'), path = require('path');
const D = path.join(__dirname, '..');
const FOLDS = ['inward', 'outward', 'aftFlat', 'aftBelly', 'skymaster', 'custom', 'catalina', 'nacelle', 'knee', 'lfold'];
const planes = (process.argv[2] || 'c172,caravan,rv,ttail,da62,skymaster,petrel').split(',');
const bases = Object.fromEntries(fs.readFileSync(path.join(__dirname, 'bases.txt'), 'utf8').trim().split('\n').map(l => l.split('|')));
for (const n of planes) {
  const B = JSON.parse(fs.readFileSync(path.join(D, 'out', 'base_' + n + '.json'), 'utf8')).P;
  const on = { gearRetract: 1 };
  const C = [];
  FOLDS.forEach((f, i) => { if (f !== 'custom') C.push(['fold_' + f, Object.assign({}, on, { gearFold: i })]); });
  C.push(['nose_fwd', Object.assign({}, on, { gearFoldNose: 1 })]);
  C.push(['cut_box', Object.assign({}, on, { gearWellCut: 1 })]);
  C.push(['doors_0', Object.assign({}, on, { gearDoors: 0 })]);
  C.push(['doors_1', Object.assign({}, on, { gearDoors: 1 })]);
  C.push(['legdoor_0', Object.assign({}, on, { gearLegDoor: 0 })]);
  C.push(['legs_short', Object.assign({}, on, { s1Drop: +(B.s1Drop * 0.6).toFixed(3), s2Drop: +(B.s2Drop * 0.6).toFixed(3) })]);
  C.push(['legs_long', Object.assign({}, on, { s1Drop: +(B.s1Drop * 1.4).toFixed(3), s2Drop: +(B.s2Drop * 1.4).toFixed(3) })]);
  C.push(['shorten_03', Object.assign({}, on, { gearShort: 0.3, gearShortNose: 0.3 })]);
  C.push(['frac_06', Object.assign({}, on, { gearRetFrac: 0.6 })]);
  for (const [k, o] of C) {
    // the Petrel's own card already retracts on its own fold: keep its fold unless the case sets one
    console.log(n + '__' + k + '|' + bases[n] + '|' + JSON.stringify(o));
  }
}
