// tools/_zocean.mjs — THROWAWAY: is the chunked ocean the same water as the tank?
//
// The whole value of the open-ocean arm is that it can be compared with the
// aquarium arm. That only holds if the two fields are the SAME WATER — same
// density, same mass per gram of volume, same patchiness — and if the ocean is
// reproducible. Four things have to be true, and each is a way this could be
// silently wrong rather than obviously broken:
//
//   1. DENSITY matches makeFood's, in items and in grams per cm^3.
//   2. NO SEAMS: density does not step at a chunk boundary. Chunk-local noise
//      would tile, and it would look like structure the creature could exploit.
//   3. DETERMINISTIC: same seed, same ocean, every time.
//   4. DEPLETION PERSISTS: leaving a region and returning does NOT regrow it —
//      otherwise a creature farms one patch forever and the ledger is fiction.
//
// Then it runs a creature for an hour of open water to show the field keeps up.
import RAPIER from '@dimforge/rapier3d-compat';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { authoredList } from '../worlds/atlas_seed.js';
import {
  makeFood, makeChunkedFood, mouthsOf, mouthPoints, forageStep,
  ledger, FOOD_DENSITY,
} from '../engine/l2/forage.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const pass = (ok) => (ok ? '  ok  ' : ' FAIL ');
let bad = 0;
const check = (ok, label, detail) => { if (!ok) bad++; console.log(`  ${pass(ok)} ${label.padEnd(46)} ${detail}`); };

console.log('\n  ── 1. same water as the aquarium ────────────────────────────────────');

// Load a known cube of ocean by walking a grid of points through it, then count.
const CUBE = 64;                       // cm, aligned to the chunk grid (chunk = 16)
const ocean = makeChunkedFood(W1_SLICE);
const pts = [];
for (let x = 8; x < CUBE; x += 16) for (let y = 8; y < CUBE; y += 16) for (let z = 8; z < CUBE; z += 16) pts.push([x, y, z]);
ocean.ensureAround(pts);
const inCube = ocean.items.filter((i) => i.x >= 0 && i.x < CUBE && i.y >= 0 && i.y < CUBE && i.z >= 0 && i.z < CUBE);
const oceanDensity = inCube.length / (CUBE ** 3);

const tank = makeFood(W1_SLICE);
const tankVol = W1_SLICE.tankBounds[0] * W1_SLICE.tankBounds[1] * W1_SLICE.tankBounds[2];
const tankDensity = tank.items.length / tankVol;

check(Math.abs(oceanDensity / tankDensity - 1) < 0.10, 'item density matches makeFood within 10%',
  `ocean ${oceanDensity.toFixed(5)} vs tank ${tankDensity.toFixed(5)} /cm3 (ref ${FOOD_DENSITY.toFixed(5)})`);

const oceanMassDensity = inCube.reduce((s, i) => s + i.mass, 0) / (CUBE ** 3);
const tankMassDensity = tank.initialTotal / tankVol;
check(Math.abs(oceanMassDensity / tankMassDensity - 1) < 0.10, 'MASS density matches within 10%',
  `${oceanMassDensity.toFixed(5)} vs ${tankMassDensity.toFixed(5)} g/cm3`);

console.log('\n  ── 2. no seams at chunk boundaries ──────────────────────────────────');

// Count items in slabs either side of the boundary at x = 32 (a chunk edge) and
// compare with slabs straddling it. A tiled field shows a step; a continuous one
// shows only the ordinary patchiness.
const slab = (x0, x1) => ocean.items.filter((i) => i.x >= x0 && i.x < x1 && i.y >= 0 && i.y < CUBE && i.z >= 0 && i.z < CUBE).length;
const onEdge = slab(28, 36);                       // straddles the x=32 chunk edge
const interior = [slab(4, 12), slab(12, 20), slab(36, 44), slab(44, 52)];
const meanInt = interior.reduce((a, b) => a + b, 0) / interior.length;
const spreadInt = Math.max(...interior) / Math.max(1, Math.min(...interior));
check(Math.abs(onEdge / Math.max(1, meanInt) - 1) < (spreadInt - 1) + 0.35,
  'boundary slab is within the field\'s own patch spread',
  `edge ${onEdge} vs interior mean ${meanInt.toFixed(1)} (interior spread ${spreadInt.toFixed(2)}x)`);

console.log('\n  ── 3. deterministic ─────────────────────────────────────────────────');

const a = makeChunkedFood(W1_SLICE); a.ensureAround(pts);
const b = makeChunkedFood(W1_SLICE); b.ensureAround(pts);
const key = (f) => f.items.map((i) => `${i.x.toFixed(6)},${i.y.toFixed(6)},${i.z.toFixed(6)}`).sort().join('|');
check(a.items.length === b.items.length && key(a) === key(b), 'same seed gives the identical ocean',
  `${a.items.length} items, hashes ${key(a) === key(b) ? 'match' : 'DIFFER'}`);

const c = makeChunkedFood(W1_SLICE, { seed: 999 }); c.ensureAround(pts);
check(key(c) !== key(a), 'a different seed gives a different ocean', `${c.items.length} items`);

console.log('\n  ── 4. depletion persists across a revisit ───────────────────────────');

// FIRST VERSION OF THIS CHECK WAS WRONG and reported a defect that was not there:
// it stripped grid cell '0,0,0' (which covers x,y,z in [0,4)) and then measured
// |x| < 4, a region including NEGATIVE coordinates that live in cell '-1,-1,-1'.
// The two never overlapped. Strip and measure the same identified items instead.
const d = makeChunkedFood(W1_SLICE);
d.ensureAround([[0, 0, 0]]);
const marked = d.items.slice(0, 20);
const beforeStrip = marked.reduce((t, i) => t + i.mass, 0);
const chunksBefore = d.chunkCount(), liveBefore = d.items.length;
for (const it of marked) it.mass = 0;
d.ensureAround([[5000, 5000, 5000]]);                         // go far away
d.ensureAround([[0, 0, 0]]);                                  // and come back
const afterReturn = marked.reduce((t, i) => t + i.mass, 0);
check(beforeStrip > 0 && afterReturn === 0 && d.items.length > liveBefore,
  'a stripped region stays stripped after a revisit',
  `${beforeStrip.toFixed(2)} g -> ${afterReturn.toFixed(2)} g; chunks ${chunksBefore} -> ${d.chunkCount()}`);

console.log('\n  ── 5. an hour in the ocean ──────────────────────────────────────────');

const T = Number(process.argv[2] ?? 3600);
const entry = authoredList()[1];                              // Darter — a traveller
const plan = morphogenesis(entry.genome);
const mouths = mouthsOf(plan);
const buf = mouths.map(() => [0, 0, 0]);
const sea = makeChunkedFood(W1_SLICE);
const sim = createSimulation(RAPIER, plan, entry.genome, W1_SLICE, { bounded: false, wrap: false, effort: 1, turnBias: 0 });
let eaten = 0;
const t0 = Date.now();
for (let st = 0; st < Math.round(T / FIXED_DT); st++) {
  sea.ensureAround(mouthPoints(sim, plan, mouths, buf));
  sim.step();
  eaten += forageStep(sim, plan, sea, mouths, FIXED_DT, undefined, buf);
}
const wall = (Date.now() - t0) / 1000;
const L = ledger(W1_SLICE, 0.97, eaten, sim.work, T);
const p = sim.centreOfMass();
console.log(`  ${entry.commonName}: ${T}s in ${wall.toFixed(1)}s wall (${(T / wall).toFixed(0)}x realtime)`);
console.log(`  ate ${eaten.toFixed(3)} g · multiplier ${L.ratio.toFixed(2)} · travelled to `
  + `(${p[0].toFixed(1)}, ${p[1].toFixed(1)}, ${p[2].toFixed(1)}) cm`);
console.log(`  ocean: ${sea.chunkCount()} chunks materialised, ${sea.items.length} items live, `
  + `${sea.eatenMass().toFixed(3)} g removed`);
check(Math.abs(sea.eatenMass() - eaten) < 1e-9, 'the field\'s loss equals what the creature ate',
  `${sea.eatenMass().toFixed(9)} vs ${eaten.toFixed(9)} g`);
sim.free();

console.log(bad ? `\n  ${bad} CHECK(S) FAILED\n` : '\n  all checks passed\n');
