// GATE WORLD — world contract v1: golden-hash freeze of the validated seed-0
// world, determinism across instances and seeds, v0-shim surface, tile
// contract, aerodrome invariants, perf budget. Pure data, no rendering.
// Any INTENTIONAL terrain change must re-capture the goldens below with the
// snippet in futureDesigns/WORLD-CONTRACT.md §4, in the same commit.
const { makeWorld } = require('./flight_core.js');

// goldens re-captured 2026-08-03 for stage 1 hydrology (rivers/lakes carve
// terrainH; trees re-laid on the carved terrain + water rejection). The
// meadow hash and all four anchors are unchanged from the pre-contract
// world — carves don't reach them. Pre-hydro goldens for reference:
// GRID 68852648, TREES fe7ae7d8.
const GOLDEN_GRID = 'cdccbc80';
const GOLDEN_TREES = '38e47146';
const GOLDEN_MEADOWS = '27f288de';
const GOLDEN_ANCHORS = ['0', '0.1927813924095721', '22.029038814851813', '24.310422903189508'];

const fnv = s => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16);
};
const gridHash = (W, step) => {
  const n = Math.round(9000 / step), g = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) g.push(W.terrainH(-4500 + step * i, -4500 + step * j));
  return fnv(g.join(','));
};
const treesHash = W => fnv(W.trees.map(t => t.x + ',' + t.z + ',' + t.h + ',' + t.s).join(';'));
const meadowsHash = W => fnv(W.meadows.map(m => m.x + ',' + m.z + ',' + m.r + ',' + m.h).join(';'));

const W = makeWorld();
const checks = {};

// --- shim + contract surface ---
checks['shim members'] =
  typeof W.terrainH === 'function' && typeof W.treesNear === 'function' &&
  typeof W.wind === 'function' && typeof W.setWind === 'function' &&
  Array.isArray(W.trees) && Array.isArray(W.meadows) && W.meadows.length === 3 &&
  W.meadows.every(m => [m.x, m.z, m.r, m.h].every(Number.isFinite)) && W.CELL === 64;
checks['v1 members'] =
  W.v === 1 && W.seed === 0 &&
  W.bounds && W.bounds.x0 === -4500 && W.bounds.x1 === 4500 && W.bounds.z0 === -4500 && W.bounds.z1 === 4500 &&
  typeof W.waterH === 'function' && typeof W.surface === 'function' &&
  W.SURFACE && W.SURFACE.GRASS === 0 && W.SURFACE.WATER === 4 &&
  W.TILE === 512 && typeof W.tile === 'function' &&
  Array.isArray(W.aerodromes) && W.aerodromes.length === 4 && Array.isArray(W.settlements);

// --- golden freeze (seed 0 === pre-contract world, full precision) ---
checks['golden grid hash'] = gridHash(W, 90) === GOLDEN_GRID;
checks['golden trees hash'] = treesHash(W) === GOLDEN_TREES && W.trees.length === 2200;
checks['golden meadows hash'] = meadowsHash(W) === GOLDEN_MEADOWS;
checks['golden anchors'] =
  String(W.terrainH(-320, 0)) === GOLDEN_ANCHORS[0] &&
  String(W.terrainH(-2500, -500)) === GOLDEN_ANCHORS[1] &&
  String(W.terrainH(1234.5, -987.25)) === GOLDEN_ANCHORS[2] &&
  String(W.meadows[0].h) === GOLDEN_ANCHORS[3];

// --- determinism ---
const W0b = makeWorld(0);
checks['default==seed0'] = gridHash(W0b, 90) === GOLDEN_GRID && treesHash(W0b) === GOLDEN_TREES;
const WA = makeWorld(12345), WB = makeWorld(12345);
checks['same-seed identical'] = gridHash(WA, 225) === gridHash(WB, 225) && treesHash(WA) === treesHash(WB);
{
  let same = true;
  for (let ix = -9; ix <= 8 && same; ix++) for (let iz = -9; iz <= 8 && same; iz++) {
    const a = WA.tile(ix, iz).trees, b = WB.tile(ix, iz).trees;
    if (a.length !== b.length) { same = false; break; }
    for (let k = 0; k < a.length; k++)
      if (a[k].x !== b[k].x || a[k].z !== b[k].z || a[k].h !== b[k].h || a[k].s !== b[k].s) { same = false; break; }
  }
  checks['tiles same-seed identical'] = same;
}
checks['seeds differ'] = gridHash(makeWorld(1), 225) !== gridHash(W, 225);

// --- tile contract (on the seed-0 world) ---
{
  const set = new Set(W.trees);
  let count = 0, identity = true, bounded = true;
  for (let ix = -9; ix <= 8; ix++) for (let iz = -9; iz <= 8; iz++) {
    const rec = W.tile(ix, iz);
    count += rec.trees.length;
    for (const t of rec.trees) {
      if (!set.has(t)) identity = false;
      if (Math.floor(t.x / W.TILE) !== ix || Math.floor(t.z / W.TILE) !== iz) bounded = false;
    }
    if (rec.roads.length || rec.buildings.length) bounded = false; // stage 3 features still empty
  }
  checks['tile union==trees'] = count === W.trees.length && identity;
  checks['tile bounds'] = bounded;
  checks['tile cached'] = W.tile(3, -2) === W.tile(3, -2) && W.tile(40, 40) === W.tile(40, 40);
}

// --- aerodrome invariants ---
{
  const a = W.aerodromes[0];
  let flat = true, maxSlope = 0;
  let prev = null;
  for (let i = 0; i <= 22; i++) {
    const x = 20 - (1080 / 22) * i; // +20 .. -1060 along the centreline
    const h = W.terrainH(x, a.z);
    if (Math.abs(h) > 1e-9) flat = false;
    if (prev !== null) maxSlope = Math.max(maxSlope, Math.abs(h - prev) / (1080 / 22));
    prev = h;
  }
  checks['aero main flat'] = flat && maxSlope < 0.005 && a.elev === 0 &&
    Math.abs(W.terrainH(a.tdz[0], a.tdz[1]) - a.elev) < 1e-9;
  checks['aero main tree-free'] = !W.trees.some(t =>
    Math.abs(t.z - a.z) < a.wid / 2 + 30 && t.x > a.x - a.len / 2 - 30 && t.x < a.x + a.len / 2 + 30);
  const mds = W.aerodromes.filter(d => d.kind === 'meadow');
  checks['aero meadows elev'] = mds.every((d, i) =>
    Math.abs(W.terrainH(d.x, d.z) - d.elev) < 1e-9 && W.meadows[i].h === d.elev);
  checks['aero meadows tree-free'] = mds.every(d =>
    !W.trees.some(t => Math.hypot(t.x - d.x, t.z - d.z) < d.r * 0.8));
}

// --- waterH / surface consistency ---
checks['waterH sea/land'] = W.waterH(0, 4000) === 0 && W.terrainH(0, 4000) < 0 && W.waterH(-520, 0) === -Infinity;
{
  let ok = true, rocks = 0;
  for (let j = 0; j <= 100; j++) for (let i = 0; i <= 100; i++) {
    const x = -4500 + 90 * i, z = -4500 + 90 * j;
    const s = W.surface(x, z);
    if (!(s >= 0 && s <= 7)) ok = false;
    if ((s === W.SURFACE.WATER) !== (W.waterH(x, z) > W.terrainH(x, z))) ok = false;
    if (s === W.SURFACE.ROCK) { rocks++; if (W.terrainH(x, z) < 220) ok = false; }
  }
  checks['surface consistency'] = ok && rocks > 0 &&
    W.surface(-520, 0) === W.SURFACE.GRASS && W.surface(-450, 0) === W.aerodromes[0].surface;
}

// --- treesNear index contract ---
{
  const T = W.trees[100], out = [];
  const r1 = W.treesNear(T.x, T.z, out);
  const hit = r1 === out && out.includes(100) && out.every(i => Number.isInteger(i) && i >= 0 && i < W.trees.length);
  const snap = out.slice();
  const r2 = W.treesNear(T.x, T.z, out);
  checks['treesNear contract'] = hit && r2 === out && out.length === snap.length && out.every((v, i) => v === snap[i]);
}

// --- wind zero fast path ---
{
  const w1 = W.wind(0, 0, 0, 0), w2 = W.wind(5, 5, 5, 1);
  checks['wind zero-path'] = w1 === w2 && w1[0] === 0 && w1[1] === 0 && w1[2] === 0;
}

// --- perf budget: 1e6 terrainH calls at scattered coords ---
{
  let s = 1, sum = 0;
  const t0 = Date.now();
  for (let i = 0; i < 1e6; i++) {
    s = (s * 1664525 + 1013904223) >>> 0; const x = (s / 4294967296 - 0.5) * 9000;
    s = (s * 1664525 + 1013904223) >>> 0; const z = (s / 4294967296 - 0.5) * 9000;
    sum += W.terrainH(x, z);
  }
  const ms = Date.now() - t0;
  console.log(`perf: 1e6 terrainH calls in ${ms} ms (${(ms / 1000).toFixed(2)} us/call), checksum ${sum.toFixed(3)}`);
  checks['perf terrainH<2.5us'] = ms < 2500;
}

const failed = Object.keys(checks).filter(k => !checks[k]);
console.log(`world: seed ${W.seed} | ${W.trees.length} trees | ${W.aerodromes.length} aerodromes | ${Object.keys(checks).length} checks, ${failed.length} failed`);
for (const f of failed) console.log(`  FAIL: ${f}`);
const pass = failed.length === 0;
console.log(pass ? 'GATE WORLD: PASS' : 'GATE WORLD: FAIL');
process.exitCode = pass ? 0 : 1;
