#!/usr/bin/env node
// G2044 (DMG-SETTLE) item 4: THE TERRAIN UNDER A WRECK - the drawn ground (tools/ground_drawn.js: the pavement, the
// premises' patch, the fine tiles - the page's stack, the one on top) against the solver's (W.terrainH, the ground the
// wreck's nodes and WRECK_DEBRIS's bodies rest on), over a wreck's footprint (20 x 20 m on a 0.5 m grid) beside trees
// a 30 m/s trunk crash would end at: every Jolene tree record within the fine tiles' range, sampled evenly (seeded), and
// every aerodrome's runway ends +60 m (the over-run). Prints per site the drawn - physics (mm, + drawn over: a resting
// piece looks sunk; - drawn under: it looks hovering), and the worst. FLYDIY_GROUND_RASTER=1 is the page's default.
//   FLYDIY_GROUND_RASTER=1 node tools/dmg_settle_terrain.js [--sites 40] [--json f]
'use strict';
process.argv.push('--none');
const path = require('path'), fs = require('fs');
const GD = require('./ground_drawn.js');
const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const W = GD.W, NS = +arg('--sites', 40);
const sites = [];
// the trees (the world's own records; those the drawn fine tiles reach)
const T = (W.trees || []).filter(t => Number.isFinite(t.x) && Number.isFinite(t.z) && !Number.isNaN(GD.drawnAt(t.x, t.z).y));
let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
for (let i = 0; i < NS && T.length; i++) { const t = T[Math.floor(rnd() * T.length)]; sites.push({ id: 'tree@' + t.x.toFixed(0) + ',' + t.z.toFixed(0), x: t.x, z: t.z }); }
for (const a of W.aerodromes) { if (!a.len || a.kind === 'water') continue;
  for (const sg of [1, -1]) { const d = sg * (a.len / 2 + 60); sites.push({ id: a.id + (sg > 0 ? ' end' : ' start') + '+60 m', x: a.x + Math.cos(a.hdg) * d, z: a.z + Math.sin(a.hdg) * d }); } }
const rows = [];
for (const s of sites) {
  const d = []; const kinds = {};
  for (let i = -20; i <= 20; i++) for (let j = -20; j <= 20; j++) { const x = s.x + i * 0.5, z = s.z + j * 0.5, q = GD.drawnAt(x, z);
    if (!Number.isFinite(q.y)) continue; d.push((q.y - W.terrainH(x, z)) * 1000); kinds[q.kind] = (kinds[q.kind] || 0) + 1; }
  if (!d.length) continue;
  d.sort((a, b) => a - b);
  rows.push({ id: s.id, n: d.length, min: +d[0].toFixed(1), p5: +d[Math.floor(0.05 * d.length)].toFixed(1), p50: +d[Math.floor(0.5 * d.length)].toFixed(1), p95: +d[Math.floor(0.95 * d.length)].toFixed(1), max: +d[d.length - 1].toFixed(1), kinds });
}
for (const r of rows) console.log(r.id.padEnd(28) + ' drawn - physics (mm): min ' + String(r.min).padStart(7) + '  p5 ' + String(r.p5).padStart(7) + '  p50 ' + String(r.p50).padStart(6) + '  p95 ' + String(r.p95).padStart(6) + '  max ' + String(r.max).padStart(6) + '  on top: ' + JSON.stringify(r.kinds));
const all = rows.flatMap(r => [r.min, r.max]), under = Math.min(...rows.map(r => r.min)), over = Math.max(...rows.map(r => r.max));
const p95u = rows.map(r => r.p5).sort((a, b) => a - b), med = p95u[Math.floor(p95u.length / 2)];
console.log('DMG-SETTLE TERRAIN: ' + rows.length + ' sites (' + T.length + ' trees in reach): the drawn ground at most ' + (-under).toFixed(1) + ' mm UNDER the physics (a resting piece reads that much over it), at most ' + over.toFixed(1) + ' mm over; the sites\' median p5 ' + med.toFixed(1) + ' mm');
if (arg('--json', null)) fs.writeFileSync(arg('--json'), JSON.stringify({ rows, under, over }, null, 1));
