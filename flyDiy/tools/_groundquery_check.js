#!/usr/bin/env node
// GATE GROUNDQUERY: the visual pavement end correction keeps the full walk's
// exact answers, including nearest-segment ties, while using the existing grid.
// Counts segment-distance operations; no machine-dependent timing threshold.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const ROOT = path.join(__dirname, '..');
const CORE_MATH = require('./_core_math_global.js');
const src = fs.readFileSync(path.join(ROOT, 'src/core/27_premises.js'), 'utf8').replace(/\r\n/g, '\n');
const at = src.indexOf('  function roadEndIn(it, x, z) {'), end = src.indexOf('  // `reach`', at);
assert(at >= 0 && end > at, 'visual end helper exists');
const fastSource = src.slice(at, end);
const walkSource = "  function roadEndIn(it, x, z) {                  // metres inside the nearer DEAD end, along the road (Infinity: not near one)\n    const pts = it.road && it.road.pts, n = pts ? pts.length : 0;\n    if (n < 2 || (pts[0][0] === pts[n - 1][0] && pts[0][1] === pts[n - 1][1])) return Infinity;\n    const DE = roadDeadEnds(it);\n    if (!DE[0] && !DE[1]) return Infinity;\n    let best = Infinity, bi = 1, bt = 0;\n    for (let i = 1; i < n; i++) {\n      const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;\n      const t = l2 > 1e-12 ? ((x - a[0]) * dx + (z - a[1]) * dz) / l2 : 0, tc = Math.max(0, Math.min(1, t));\n      const d = HYP2(x - (a[0] + dx * tc), z - (a[1] + dz * tc));\n      if (d < best) { best = d; bi = i; bt = t; }\n    }\n    const len = i => HYP2(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);\n    let e = Infinity;\n    if (bi === 1 && DE[0]) e = bt * len(1);\n    if (bi === n - 1 && DE[1]) e = Math.min(e, (1 - bt) * len(n - 1));\n    return e;\n  }\n";
const registry = fs.readFileSync(path.join(ROOT, 'src/core/00_registry.js'), 'utf8');
const mathContext = vm.createContext({ Math, console });
vm.runInContext(registry + '\n;this.hypForTest = hyp2;', mathContext);
let assertions = 0;
function ok(c, label) { assert(c, label); assertions++; console.log('  ok   ' + label); }
for (const [mode, hypot] of [['Math.hypot', Math.hypot], ['core hyp2', mathContext.hypForTest]]) {
  let calls = 0;
  const HYP2 = (x, z) => { calls++; return hypot(x, z); };
  const context = vm.createContext({ Math, CORE_MATH, hyp2: HYP2, module: { exports: {} }, console });
  const anchor = 'const API = { PREMISES_V,';
  assert(src.split(anchor).length === 2);
  vm.runInContext(src.replace(anchor, 'const API = { __roadSegIdx: roadSegIdx, PREMISES_V,'), context);
  const PG = context.module.exports;
  const scope = { Math, isFinite, SEG_RINGS: 24, HYP2, roadSegIdx: PG.__roadSegIdx, roadDeadEnds: it => it.deadEnds };
  const fast = vm.runInNewContext('(' + fastSource + ')', scope);
  const walk = vm.runInNewContext('(' + walkSource + ')', scope);
  const line = Array.from({ length: 2501 }, (_, i) => [i * 10, 0]);
  const wave = Array.from({ length: 121 }, (_, i) => [i * 8 - 400, 40 * Math.sin(i / 7)]);
  const ties = [[0, 0], [50, 0], ...Array.from({ length: 52 }, (_, i) => [50 + i, 20 + i]), [0, 0], [2, 0]];
  const interiorTie = [[-100, 100], ...Array.from({ length: 52 }, (_, i) => [-100 + i, 110]), [0, 0], [5, 0], [0, 0], [2, 0]];
  const duplicate = Array.from({ length: 80 }, (_, i) => [Math.floor(i / 2) * 4, 0]);
  const closed = [...wave, wave[0]];
  const roads = [line, wave, ties, interiorTie, duplicate, closed, [[0, 0], [4, 0]], [[0, 0]], []].map(pts => ({ pts }));
  let samples = 0;
  for (const road of roads) for (const deadEnds of [[true, true], [true, false], [false, true], [false, false]]) {
    const it = { road, deadEnds };
    const queries = [[0.25, 0], [-1, 0], [1, 0], [16, 16], [-16, -16], [1e6, 1e6], [NaN, 0], [Infinity, 0]];
    for (let i = 0; i < road.pts.length; i += Math.max(1, Math.floor(road.pts.length / 40))) {
      const p = road.pts[i]; for (const dz of [-3, -0.1, 0, 0.1, 3, 16]) queries.push([p[0], p[1] + dz]);
    }
    for (const [x, z] of queries) { const a = fast(it, x, z), b = walk(it, x, z); assert(Object.is(a, b), mode + ' end parity ' + x + ',' + z + ': ' + a + ' vs ' + b); samples++; }
  }
  ok(samples > 1000, mode + ': exact end-distance parity on ' + samples + ' endpoint/interior/tie/degenerate/closed/fallback samples');
  const it = { road: { pts: line }, deadEnds: [true, true] };
  calls = 0; const a = fast(it, 12005, 1), fastCalls = calls;
  calls = 0; const b = walk(it, 12005, 1), walkCalls = calls;
  ok(Object.is(a, b) && fastCalls * 10 < walkCalls, mode + ': nearby long-road query avoids the full scan (' + fastCalls + ' vs ' + walkCalls + ' distance operations)');
  // Public result parity, including dPre/reach and joined vs dead ends. Recompose
  // after an edit: the prepared road and its existing grid get their normal lifetime.
  const points = Array.from({ length: 81 }, (_, i) => [i * 8, 10 * Math.sin(i / 8)]);
  const world = { id: 'groundquery', terrainH: () => 0, waterH: () => -10 };
  function same(a, b) { return a === null || b === null ? a === b : Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => Object.is(a[k], b[k])); }
  let queries = 0;
  for (const moved of [false, true]) {
    const pts = points.map(p => p.slice()); if (moved) pts[40][1] += 7;
    const rec = PG.normalise({ seed: 17, layers: { roads: [{ id: 'long', pts, w: 6, cls: 'gravel' }, { id: 'join', pts: [[-8, 0], [0, 0], [0, 24]], w: 4, cls: 'paved' }] } });
    PG.segIdx(true); const O = PG.compose(rec, world, { raster: false, noPlace: true });
    const qs = [];
    for (const r of O.roads) for (let i = 0; i < r.pts.length; i += Math.max(1, Math.floor(r.pts.length / 35))) for (const off of [-5, -2.99, -0.01, 0, 0.01, 2.99, 5]) { const p = O.frame.toWorld(r.pts[i][0], r.pts[i][1] + off); for (const reach of [undefined, 0, 3]) qs.push([p[0], p[1], reach]); }
    const indexed = qs.map(q => O.pavedAt(...q));
    PG.segIdx(false); const brute = qs.map(q => O.pavedAt(...q));
    assert(indexed.every((q, i) => same(q, brute[i])), mode + ': public pavement result differs after edit=' + moved);
    queries += qs.length; PG.segIdx(true);
  }
  ok(queries > 100, mode + ': public pavedAt results match the walk, including reach/dPre and recomposition (' + queries + ' queries)');
}
console.log('  ' + assertions + ' checks');
console.log('GATE GROUNDQUERY: PASS');
