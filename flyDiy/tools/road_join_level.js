#!/usr/bin/env node
// ROAD JOIN, LEVEL (TOW-LAUNCH, 2026-11-12): tools/road_join_drawn.js's joins KEPT ONLY WHERE THE GROUND STAYS. A junction
// makes its roads meet at ONE height (27_premises G2950: the first road graded through it sets it) - right where two roads
// meet at grade, wrong where they only touch on the map: the old airport road runs 5 m beside and below r3 (joined, the
// ground moved 5.5 m), r24 meets r2's embankment from below (2.1 m: the car hit the step). So: join, compose the island
// before / after, every junction's ground within 15 m compared; a pair whose join moves it more than `--dh` (0.3 m) is
// skipped and the join made again without it, until none moves it. Prints the joins kept, the pairs left apart (with the
// height they would have moved), and writes the last patch.
//   node tools/road_join_level.js [--dh 0.3] [--out PATCH.json]      then: python tools/road_patch.py PATCH.json
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const DH = +arg('--dh', 0.3), OUT = arg('--out', path.join(os.tmpdir(), 'road_join_level.json'));
const ROOT = path.join(__dirname, '..'), FIX = path.join(__dirname, 'fixtures', 'island_jolene.json');
const C = require('./flight_core.js'), IN = require('./island_node.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rjl-'));
const before = IN.islandWorld('jolene', { premises: fs.readFileSync(FIX, 'utf8') });
const skip = new Map();   // 'a|b' -> the height the join moved
for (let it = 1; it <= 8; it++) {
  const patch = path.join(tmp, 'p.json'), copy = path.join(tmp, 'rec.json');
  const log = cp.execFileSync(process.execPath, [path.join(__dirname, 'road_join_drawn.js'), '--max', '100', '--out', patch, '--skip', [...skip.keys()].join(',')], { encoding: 'utf8' });
  fs.copyFileSync(FIX, copy);
  cp.execFileSync('python3', [path.join(__dirname, 'road_patch.py'), patch, copy], { encoding: 'utf8' });
  const after = IN.islandWorld('jolene', { premises: fs.readFileSync(copy, 'utf8') });
  const joins = log.split('\n').map(l => l.match(/^\s+(crossing|trim|tee|gap)\s+(\S+) x (\S+).*at \((-?[\d.]+), (-?[\d.]+)\)/)).filter(Boolean);
  const bad = [];
  for (const m of joins) {
    const x = +m[4], z = +m[5]; let d = 0;
    for (let dx = -15; dx <= 15; dx += 1.5) for (let dz = -15; dz <= 15; dz += 1.5) { if (dx * dx + dz * dz > 225) continue; const e = after.terrainH(x + dx, z + dz) - before.terrainH(x + dx, z + dz); if (Math.abs(e) > Math.abs(d)) d = e; }
    if (Math.abs(d) > DH) bad.push([m[2], m[3], d]);
  }
  console.log('pass ' + it + ': ' + joins.length + ' joins, ' + bad.length + ' move the ground more than ' + DH + ' m' + (bad.length ? ': ' + bad.map(b => b[0] + '|' + b[1] + ' ' + b[2].toFixed(2)).join(', ') : ''));
  if (!bad.length) {
    fs.copyFileSync(patch, OUT);
    console.log(log.split('\n').filter(l => /^\s{2}\S/.test(l)).join('\n'));
    console.log('left apart (they meet at different heights): ' + ([...skip].map(([k, v]) => k + ' ' + v.toFixed(2) + ' m').join(', ') || 'none'));
    console.log('the patch -> ' + OUT);
    process.exit(0);
  }
  for (const [a, b, d] of bad) skip.set(a + '|' + b, d);
}
console.log('no level join set after 8 passes'); process.exit(1);
