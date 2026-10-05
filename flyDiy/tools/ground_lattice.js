#!/usr/bin/env node
// GROUND LATTICE (G1380, GEAR-WATER) — the DRAWN open ground against the height the wheels stand on, on Jolene, in node.
//
// The user (2026-10-03): "the cub still has about 3-5 cm below its tail wheel not touching the ground". The wheel is
// not it: tools/ground_gap.js puts the Cub's drawn tailwheel 0.3 mm from its physics contact, every axle on its node
// within 4 mm, and tools/ground_surface.js the taxi out of HOME's stand within 3 mm on the apron. The wheel stands on
// world.terrainH - the codec's quadtree, BILINEAR in leaves finer than 5 m - while the open ground drawn round the
// eye is render_world.js's FINE tiles: vertices every FINE.step = 5 m on the world grid, terrainH sampled there,
// LINEAR between (the a-b-d / b-c-d split). This rig samples random land points and prints drawn - terrainH (mm;
// - = the drawn ground under the tyre: the wheel reads afloat), for the 5 m lattice and finer ones.
//
//   node tools/ground_lattice.js [--n 20000] [--steps 5,2.5,1]
'use strict';
const fs = require('fs');
const path = require('path');
const T = __dirname;
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const N = +arg('--n', 20000), STEPS = String(arg('--steps', '5,2.5,1')).split(',').map(Number);

const IN = require(path.join(T, 'island_node.js'));
const W = IN.islandWorld('jolene', { premises: fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8') });
const H = W.terrainH;
// render_world.js FINE.build's surface: vertices at multiples of `s`, a = (i, j), b = (i, j+1), c = (i+1, j+1), d = (i+1, j)
const drawn = (x, z, s) => {
  const u = x / s, v = z / s, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, X = i * s, Z = j * s;
  const ha = H(X, Z), hb = H(X, Z + s), hc = H(X + s, Z + s), hd = H(X + s, Z);
  return fu + fv <= 1 ? ha + fv * (hb - ha) + fu * (hd - ha) : hc + (1 - fu) * (hb - hc) + (1 - fv) * (hd - hc);
};
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pts = [];
for (let k = 0; k < N * 4 && pts.length < N; k++) { const x = (rnd() - 0.5) * 16000, z = (rnd() - 0.5) * 16000; if (H(x, z) > 0.5) pts.push([x, z]); }
const q = (a, p) => a[Math.floor(p * (a.length - 1))] * 1000;
console.log(`GROUND LATTICE: ${pts.length} land points on Jolene, drawn (linear on an s-metre lattice) - terrainH, mm`);
for (const s of STEPS) {
  const e = pts.map(([x, z]) => drawn(x, z, s) - H(x, z)).sort((a, b) => a - b), A = e.map(Math.abs).sort((a, b) => a - b);
  console.log(`  s ${String(s).padStart(4)} m   p5 ${q(e, 0.05).toFixed(1).padStart(7)}  p50 ${q(e, 0.5).toFixed(1).padStart(6)}  p95 ${q(e, 0.95).toFixed(1).padStart(6)}` +
    `   |e| p50 ${q(A, 0.5).toFixed(1).padStart(5)}  p95 ${q(A, 0.95).toFixed(1).padStart(6)}   over 3 cm ${(100 * A.filter(x => x > 0.03).length / A.length).toFixed(1).padStart(5)} %`);
}
