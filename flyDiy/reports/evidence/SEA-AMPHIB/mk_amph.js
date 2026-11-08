// SEA-AMPHIB (test tool, no game code): THE AMPHIBIOUS-FLOAT BUILD, MADE THROUGH THE EDITOR'S OWN ROW.
// The float Cessna (LB.VALIDATED.floats) with spec.cage.fltAmph = 1 (Wipline) / 2 (EDO style) - the row
// tools/_cage_float.js:141 writes - then the game's load door (LB.gameSpec). Writes the two builds and diffs each game
// spec against the plain float Cessna's game spec.
//   node reports/evidence/SEA-AMPHIB/mk_amph.js
'use strict';
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..', '..', '..');
const LB = require(path.join(R, 'tools', '_load_build.js'));
const raw = JSON.parse(fs.readFileSync(path.join(R, LB.VALIDATED.floats.build), 'utf8'));
const base = LB.gameSpec(JSON.parse(JSON.stringify(raw)));
function diff(a, b, p, out) {
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') { if (JSON.stringify(a) !== JSON.stringify(b)) out.push(p + ': ' + JSON.stringify(a) + ' -> ' + JSON.stringify(b)); return out; }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], p + '.' + k, out);
  return out;
}
for (const k of [1, 2]) {
  const j = JSON.parse(JSON.stringify(raw));
  const s = j.spec || j; s.cage = Object.assign({}, s.cage, { fltAmph: k });
  const out = path.join(__dirname, 'cessna_floats_amph' + k + '.json');
  fs.writeFileSync(out, JSON.stringify(j));
  const g = LB.gameSpec(j);
  const d = diff(base, g, 'spec', []);
  console.log('fltAmph ' + k + ': ' + path.relative(R, out) + '  game spec vs the plain float Cessna: ' + d.length + ' difference(s)');
  for (const l of d) console.log('   ' + l.slice(0, 200));
  console.log('   gear.type ' + g.gear.type + ', gear.floats.amphibian ' + (g.gear.floats && g.gear.floats.amphibian) + ', stripGear -> ' + require(path.join(R, 'tools', 'flight_core.js')).stripGear(g));
}
