#!/usr/bin/env node
// keydiff.js - THE BAND TWINS' PROGRAM KEYS, BEFORE AND AFTER THE TRIP (HYBRID-TRIPS G1490). Reads a hybrid_trips.js run
// (its JSON: every link with its source hash, SHADER_NAME and page time; its --dump dir: the sources) and pairs each program
// linked on round trip 2 with the program of the same material family the craft step linked before the taxi (same
// SHADER_NAME, SHADER_TYPE, AEROSKIN_SURF, skinning) - then prints what differs: the #defines and the light / shadow arrays.
// Usage: node keydiff.js <ht.json> <dumpDir>
'use strict';
const fs = require('fs'), path = require('path');
const [J, D] = process.argv.slice(2);
const R = JSON.parse(fs.readFileSync(J, 'utf8'));
const src = (k, s) => { try { return fs.readFileSync(path.join(D, k + '_' + s + '.glsl'), 'utf8'); } catch (e) { return null; } };
const sig = fs => {
  const def = (fs.match(/^#define [A-Z_0-9]+.*$/gm) || []).filter(l => !/^#define (PI|RECIPROCAL|EPSILON|saturate|whiteComplement|LOG2|ln|varying|texture|gl_)/.test(l));
  const arr = (fs.match(/uniform \w+ \w+(Lights|ShadowMap|LightShadows)\[ *\d+ *\]/g) || []).map(s => s.replace(/uniform \w+ /, ''));
  return { def: [...new Set(def)], arr: [...new Set(arr)] };
};
const fam = (k) => { const vs = src(k, 'vs') || '', fs = src(k, 'fs') || ''; const g = re => ((re.exec(fs) || [])[1] || '');
  return [g(/#define SHADER_NAME (.*)/), g(/#define SHADER_TYPE (.*)/), g(/#define AEROSKIN_SURF (.*)/), /#define USE_SKINNING/.test(vs) ? 'skin' : ''].join('|'); };
const trip2 = R.trips.find(t => /round trip 2: garage -> world/.test(t.trip));
const t0 = trip2 ? trip2.t0 : Infinity;
const before = R.allLinks.filter(e => e.t < t0 && /band/.test(e.nm) && src(e.k, 'fs'));
const after = (trip2 ? trip2.slow : []).filter(e => src(e.k, 'fs'));
console.log('round trip 2: ' + (trip2 ? (trip2.ms / 1000).toFixed(2) + ' s, ' + trip2.links + ' links, ' + after.length + ' slow' : 'missing'));
for (const a of after) {
  const f = fam(a.k), pair = before.filter(b => fam(b.k) === f);
  console.log('\n' + a.k + '  ' + f + '  linked ' + a.ms + ' ms (sync ' + a.sync + ' ms), ' + a.was);
  if (!pair.length) { console.log('  no program of this family linked before the trip'); continue; }
  const sa = sig(src(a.k, 'fs'));
  for (const b of pair.slice(0, 2)) {
    const sb = sig(src(b.k, 'fs'));
    const d1 = sa.def.filter(x => !sb.def.includes(x)), d0 = sb.def.filter(x => !sa.def.includes(x));
    const a1 = sa.arr.filter(x => !sb.arr.includes(x)), a0 = sb.arr.filter(x => !sa.arr.includes(x));
    console.log('  vs ' + b.k + ' (linked at ' + (b.t / 1000).toFixed(1) + ' s, ' + b.ms + ' ms):');
    console.log('    defines  +' + JSON.stringify(d1) + '  -' + JSON.stringify(d0));
    console.log('    lights   now ' + JSON.stringify(a1) + '  was ' + JSON.stringify(a0));
  }
}
