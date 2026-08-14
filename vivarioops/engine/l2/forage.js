// engine/l2/forage.js — FOOD AS THINGS, A MOUTH, AND THE ENERGY LEDGER.
//
// PURITY (01 §4, N1-N3): no clock, no Math.random, no DOM, no imports from
// /trunk/, /ui/, /render/. Rapier arrives injected.
//
// ── WHICH LAYER THIS IS, because it is the question that caused the confusion ─
//
// NOT L3. L3 is defined by its REPRESENTATION, not its subject matter: point
// agents {x, y, vx, vy, mass, age} in 2D, driven by a compiled Species record,
// with no physics at all (12 §2). A creature with real joints in real fluid
// cannot be represented there.
//
// NOT A PROBE either. 11 §3's probes produce fields of the Species record and
// every one costs a BRIDGE_V bump; this produces no identity.
//
// It is the third category objective.js already carved out: a HARNESS plus a
// number that SELECTION may read.
//
// ── WHY IT WAS REBUILT, and the fault is worth keeping written down ──────────
//
// The first version was a scalar density on a 2 cm grid, and a body absorbed
// from every cell inside its own half-diagonal. Two faults, and one screenshot
// showed both: it read as glowing graph paper rather than as food, and INTAKE
// SCALED WITH BODY SIZE. Measured, `eaten` correlated with mass at Spearman 0.94
// and with swimming at -0.37 — the winning strategy was to be large and hold
// still. That is the degeneracy PLAN-AFTER-B2 §3 names, arriving by a route
// local depletion alone could not block. A creature also ate 0.7 g in 155 s,
// because the patches formed one slab and it was sitting beside it.
//
// Now: discrete items, each with a position, a mass and an invisible PROXIMITY
// RADIUS, and a creature eats through a MOUTH — a point, not a volume. A point
// is the same size on a 2 cm creature as on a 12 cm one, so size no longer wins
// by merely existing. It can still win by carrying more mouths or by covering
// more ground, both of which are things selection should be allowed to discover.
//
// FOOD DOES NOT MOVE and there is no diffusion. Depletion is therefore strictly
// monotone, so `eaten` is exactly the food's loss and the ledger closes by
// construction rather than by hoping the flows balance.
//
// NO BIRTH AND NO DEATH. Those are D1. What replaces them is the ledger: energy
// in against energy out, which is the same information a death rule would use,
// without committing to one before it can be measured.

import { S1 } from './probes.js';
import { createSimulation, FIXED_DT } from '../l1/physics.js';
import { creatureTissue } from '../l1/tissue.js';
import { qmul, qrot } from '../l1/vecmath.js';

/**
 * How much food there is, and how big each item's invisible proximity sphere is.
 *
 * These two set COVERAGE — the fraction of tank volume a mouth is inside
 * something — and coverage is what decides whether a point-mouth ever finds
 * anything at all. Swept (tools/_zfoodsweep.mjs, 16 creatures, 300 s):
 *
 *   count  radius  coverage   items eaten p50/max
 *     700     1.6      39%            2 / 8
 *     700     2.4      81%           5 / 16
 *    1400     2.0      85%          10 / 32     <- shipped
 *    1400     2.6      98%          13 / 51
 *    2200     3.0     100%         26 / 104
 *
 * 700/1.6 was the first guess and it was too sparse to play with: a creature
 * found two items in five minutes. Past ~98% the tank is uniform soup, a mouth
 * is always inside something, and WHERE the creature goes stops mattering —
 * which throws away the patchiness the field exists for (02 §7). 85% leaves a
 * usable 15% of barren water while still paying a creature that moves.
 */
export const FOOD_COUNT = 1400;
export const FOOD_RADIUS = 2.0;

/**
 * The reference volume `FOOD_COUNT` was swept in, and therefore THE DENSITY.
 *
 * A LITERAL ON PURPOSE. Reading it from `world.tankBounds` would mean widening
 * the tank silently thinned the food — the count would stay 1400 while the volume
 * grew — and every measured figure above would quietly stop applying. Pinning the
 * reference makes the count follow the volume instead, so water is water whatever
 * size box it is in. That is what lets the aquarium and the open ocean be compared
 * at all: they are the same water.
 */
export const FOOD_REFERENCE_VOLUME = 32 * 24 * 32;                // cm^3 — W1's tankBounds
export const FOOD_DENSITY = FOOD_COUNT / FOOD_REFERENCE_VOLUME;   // items / cm^3

/**
 * Grams a mouth ingests per second while inside an item.
 *
 * PER MOUTH, NOT PER AREA. That is the whole point of the rebuild: a big animal
 * gets no bonus for being big. Sized so a typical item empties in about half a
 * second — long enough that dwelling in a patch beats brushing past it, short
 * enough that a pass still pays.
 */
export const INGEST_RATE = 1.2;

/**
 * DEFAULT TRIAL LENGTH, seconds. 300, and the number is measured rather than
 * inherited.
 *
 * THE TIMESCALE HAS TO MATCH THE ANIMAL. These creatures swim at ~0.04 cm/s, so
 * a mouth travels 0.8 cm in 20 seconds — against a 1.6 cm item radius, movement
 * is simply irrelevant over that window, and the trial measures where the
 * creature happened to SPAWN. Swept over duration (tools/_zforage.mjs):
 *
 *     T       eaten vs MASS     eaten vs body-lengths/s
 *     20 s        0.07               -0.17
 *     60 s        0.33               -0.06
 *    200 s        0.01               +0.37
 *    600 s       -0.01               +0.55
 *
 * Only past ~200 s does the objective become what it is for: size-NEUTRAL and
 * rewarding swimming. 20 s was a locomotion-burst window borrowed from the duel
 * (15 s) and objective.js (6 s), and those are the wrong scale for foraging.
 * 300 is the compromise — well inside the useful regime, and cheap enough that a
 * corpus sweep is still a couple of minutes.
 */
export const FORAGE_SECONDS = 300;

/**
 * Energy per gram of food, erg/g. Lives in the WORLD (03 §5), not here — 12 §5:
 * "all numeric constants come from the world fixture; none is hard-coded". This
 * is only the fallback for a fixture that predates the field.
 */
export const FOOD_ENERGY_FALLBACK = 6.4e3;

// ── the food ─────────────────────────────────────────────────────────────────

/** Deterministic 32-bit hash. No Math.random anywhere in /engine/ (N1). */
function hash3(x, y, z, seed) {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (x + 0x85ebca6b), 0xcc9e2d51) >>> 0;
  h = Math.imul(h ^ (y + 0xc2b2ae35), 0x1b873593) >>> 0;
  h = Math.imul(h ^ (z + 0x27d4eb2f), 0x85ebca6b) >>> 0;
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Trilinear value noise; fbm over `octaves`. Static — the food never moves. */
function fbm(x, y, z, seed, octaves = 3) {
  let sum = 0, amp = 1, norm = 0, f = 1;
  for (let o = 0; o < octaves; o++) {
    const X = Math.floor(x * f), Y = Math.floor(y * f), Z = Math.floor(z * f);
    const fx = x * f - X, fy = y * f - Y, fz = z * f - Z;
    const sm = (t) => t * t * (3 - 2 * t);
    const u = sm(fx), v = sm(fy), w = sm(fz);
    let acc = 0;
    for (let dz = 0; dz < 2; dz++) {
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const wx = dx ? u : 1 - u, wy = dy ? v : 1 - v, wz = dz ? w : 1 - w;
          acc += hash3(X + dx, Y + dy, Z + dz, seed + o * 7919) * wx * wy * wz;
        }
      }
    }
    sum += acc * amp; norm += amp; amp *= 0.5; f *= 2;
  }
  return sum / norm;
}

/**
 * Scatter food through the tank.
 *
 * PATCHY BY REJECTION SAMPLING against an fbm field, so there are places worth
 * being — 02 §7: "a uniform substrate gives creatures no reason to move, which
 * removes locomotion from the selection pressure entirely."
 *
 * But NOT so patchy that a creature spawns outside every patch and starves
 * without a decision being involved. `floor` mixes a uniform component back in,
 * so the whole tank has something and the patches are a bonus rather than the
 * only option. The first build had no floor: the food formed one slab, and a
 * creature at its edge ate 0.7 g in 155 seconds.
 *
 * `total` is conserved — mass is split evenly across items AFTER placement, so
 * patchiness changes WHERE the food is and never HOW MUCH there is.
 */
export function makeFood(world, {
  bounds = null, count = null, radius = FOOD_RADIUS, total = null,
  seed = null, contrast = 2.0, floor = 0.35,
} = {}) {
  // `bounds` lets a SCREEN fill its habitat while SCORING keeps the measurement
  // volume (contracts/world.js). Count and mass both follow the volume, so density
  // is invariant and `makeFood(W1_SLICE)` is bit-identical to before.
  const [W, H, D] = bounds ?? world.tankBounds;
  const vol = W * H * D;
  count = count ?? Math.round(FOOD_DENSITY * vol);
  // AN EXPLICIT SEED WINS. This read `world.fertility?.seed ?? seed`, so any world
  // carrying a fertility seed — W1 does — silently ignored the caller's. Passing a
  // seed did nothing, and `tools/_zocean.mjs` caught it by asserting that two
  // different seeds give two different oceans: they did not. A parameter that is
  // accepted and discarded is worse than one that does not exist.
  const s = seed ?? world.fertility?.seed ?? 0x5EED;
  const scale = (world.fertility?.noiseScale ?? 0.05) * 4;
  const items = [];

  let a = (s ^ 0x1234567) >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Bounded attempts: an unbounded accept-loop can spin forever on a
  // pathological field, and nothing in /engine/ may hang.
  for (let tries = 0; items.length < count && tries < count * 40; tries++) {
    const x = (rnd() - 0.5) * W, y = (rnd() - 0.5) * H, z = (rnd() - 0.5) * D;
    const v = Math.pow(fbm(x * scale, y * scale, z * scale, s), contrast);
    if (rnd() > floor + (1 - floor) * v) continue;
    items.push({ x, y, z, r: radius, mass: 0 });
  }
  const want = total ?? ((world.biomassBudget ?? 300) * vol) / FOOD_REFERENCE_VOLUME;
  const per = items.length ? want / items.length : 0;
  for (const it of items) it.mass = per;

  // THE SPATIAL INDEX, built once. `forageStep` reads it instead of scanning the
  // field; cells are 2r on a side so a mouth's reach is inside its 3x3x3 block.
  // Built here rather than lazily so the cost is paid at field creation, and so
  // the invariant "grid and items describe the same field" cannot drift.
  const cellSide = 2 * radius;
  const grid = new Map();
  for (const it of items) {
    const key = `${Math.floor(it.x / cellSide)},${Math.floor(it.y / cellSide)},${Math.floor(it.z / cellSide)}`;
    const cell = grid.get(key);
    if (cell) cell.push(it); else grid.set(key, [it]);
  }

  return {
    items, radius, initialTotal: want, perItem: per,
    // The volume the field was scattered through. Carried so a sensor can express
    // concentration as a RATIO against the field's own mean density rather than
    // in grams — `senseAt` needs it, and deriving it from `cellSide` and the item
    // count instead gives a number 2.9x too small, which is what the first
    // version of that function did.
    volume: vol,
    grid, cellSide, tick: 0,
    remaining() {
      let t = 0;
      for (const it of items) t += it.mass;
      return t;
    },
    eatenCount() {
      let n = 0;
      for (const it of items) if (it.mass <= 0) n++;
      return n;
    },
  };
}


/**
 * THE OPEN OCEAN — an unbounded food field, generated on demand.
 *
 * `makeFood` scatters a fixed number of items through a box, which is exactly
 * right for an aquarium and impossible for open water: there is no box to fill.
 * This generates the SAME WATER, chunk by chunk, only where a mouth has been.
 *
 * ── WHY THIS IS NOW A DROP-IN ───────────────────────────────────────────────
 *
 * `forageStep` used to scan `food.items` — every item, every step — so an
 * infinite field was not merely slow, it was undefined. It now reads `grid` /
 * `cellSide` / `tick`, so anything maintaining those three IS a food field.
 * Measured on the finite field: 8x the items cost 10% more wall time, because the
 * cost became O(mouths) rather than O(field).
 *
 * ── DETERMINISM, AND WHY IT IS NOT OPTIONAL ─────────────────────────────────
 *
 * A chunk's contents are a pure function of its integer coordinates and the seed.
 * Nothing is stored until visited; a visited chunk is KEPT, so depletion persists
 * and a creature cannot farm the same water twice by leaving and returning. Two
 * runs of one seed meet the identical ocean. Without that a trial could not be
 * repeated and the field would be a random number generator in a costume.
 *
 * ── NO SEAMS ────────────────────────────────────────────────────────────────
 *
 * Patchiness is sampled in ABSOLUTE coordinates, never chunk-local ones, so a
 * patch straddling a boundary is one patch. Chunk-local noise would tile visibly
 * and lay a grid of density steps across the ocean — the same class of defect as
 * the first food model's "glowing graph paper".
 *
 * ── WHAT IT CANNOT ANSWER ───────────────────────────────────────────────────
 *
 * `initialTotal` and "% grazed" are MEANINGLESS here and are deliberately not
 * faked: there is no total. `remaining()` reports the visited region only, and
 * says so in its honest name `loadedTotal()`. A readout printing "7% grazed"
 * against an infinite ocean would be a lie with a number on it.
 */
export function makeChunkedFood(world, {
  chunk = 16, radius = FOOD_RADIUS, seed = null,
  density = FOOD_DENSITY, massPerItem = null,
  contrast = 2.0, floor = 0.35,
} = {}) {
  // AN EXPLICIT SEED WINS. This read `world.fertility?.seed ?? seed`, so any world
  // carrying a fertility seed — W1 does — silently ignored the caller's. Passing a
  // seed did nothing, and `tools/_zocean.mjs` caught it by asserting that two
  // different seeds give two different oceans: they did not. A parameter that is
  // accepted and discarded is worse than one that does not exist.
  const s = seed ?? world.fertility?.seed ?? 0x5EED;
  const scale = (world.fertility?.noiseScale ?? 0.05) * 4;
  // Mass per item matched to the aquarium's, so a gram of ocean is a gram of tank.
  const per = massPerItem ?? ((world.biomassBudget ?? 300) / FOOD_COUNT);

  const cellSide = 2 * radius;
  const grid = new Map();
  const items = [];                 // every LOADED item, for rendering
  const loaded = new Set();
  let loadedInitial = 0;

  /** One chunk's worth of items. Pure in (cx, cy, cz, s). */
  function generate(cx, cy, cz) {
    const target = Math.round(density * chunk * chunk * chunk);
    // A per-chunk stream seeded from the chunk's own coordinates: neighbours must
    // not share a sequence, or the ocean repeats itself.
    let a = ((hash3(cx, cy, cz, s) * 4294967296) ^ 0x1234567) >>> 0;
    const rnd = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const out = [];
    for (let tries = 0; out.length < target && tries < target * 40; tries++) {
      const x = (cx + rnd()) * chunk, y = (cy + rnd()) * chunk, z = (cz + rnd()) * chunk;
      const v = Math.pow(fbm(x * scale, y * scale, z * scale, s), contrast);
      if (rnd() > floor + (1 - floor) * v) continue;
      out.push({ x, y, z, r: radius, mass: per });
    }
    return out;
  }

  function loadChunk(cx, cy, cz) {
    const key = `${cx},${cy},${cz}`;
    if (loaded.has(key)) return;
    loaded.add(key);
    for (const it of generate(cx, cy, cz)) {
      items.push(it);
      loadedInitial += it.mass;
      const ck = `${Math.floor(it.x / cellSide)},${Math.floor(it.y / cellSide)},${Math.floor(it.z / cellSide)}`;
      const cell = grid.get(ck);
      if (cell) cell.push(it); else grid.set(ck, [it]);
    }
  }

  return {
    items, radius, grid, cellSide, tick: 0, chunk, unbounded: true,
    /** There is no total. Saying so beats inventing one. */
    initialTotal: Infinity,

    /**
     * Materialise everything a mouth could reach this step. The pad is the reach
     * PLUS one grid cell, because `forageStep` looks at the 3x3x3 CELLS around a
     * point and those can straddle a chunk boundary. Call before stepping.
     */
    ensureAround(points) {
      const pad = radius + cellSide;
      for (const p of points) {
        if (!p || !Number.isFinite(p[0] + p[1] + p[2])) continue;
        const lo = [0, 1, 2].map((k) => Math.floor((p[k] - pad) / chunk));
        const hi = [0, 1, 2].map((k) => Math.floor((p[k] + pad) / chunk));
        for (let i = lo[0]; i <= hi[0]; i++)
          for (let j = lo[1]; j <= hi[1]; j++)
            for (let k = lo[2]; k <= hi[2]; k++) loadChunk(i, j, k);
      }
    },

    chunkCount() { return loaded.size; },
    /** Grams still present in the region that has actually been visited. */
    loadedTotal() {
      let t = 0;
      for (const it of items) t += it.mass;
      return t;
    },
    /** Grams removed. Exact, because food never moves and never regrows. */
    eatenMass() { return loadedInitial - this.loadedTotal(); },
    /** Named for the interface `makeFood` provides; it is the VISITED remainder. */
    remaining() { return this.loadedTotal(); },
    eatenCount() {
      let n = 0;
      for (const it of items) if (it.mass <= 0) n++;
      return n;
    },
  };
}

// ── mouths ───────────────────────────────────────────────────────────────────

/**
 * Where this creature can eat.
 *
 * A MOUTH IS A POINT ON A BODY, in that body's local frame. Ingestion happens
 * only when a mouth enters an item's proximity sphere, and that is what makes
 * the model size-fair: a point is a point whatever it is attached to.
 *
 * GENETIC AS OF GENOME_V 5, and this function is the only thing that changed —
 * which is what the note that stood here promised. `genome.mouth` is a face plus
 * (u,v) on it; morphogenesis resolves that to a body-local point and hands it
 * over on the plan, so nothing downstream needs the genome.
 *
 * STILL EXACTLY ONE, AND STILL ON THE ROOT. Count is deliberately not a gene: a
 * mouth costs nothing on either side of the ledger, so N mouths would be N times
 * the intake for free — measured at up to 24x — and `INGEST_RATE`'s "a big animal
 * gets no bonus for being big" would be repealed in silence. genome.js CAPS
 * carries the full argument and what count would need first (a gut).
 *
 * The v4 genomes that derived their mouth keep it exactly: the migration writes
 * the face and offset that reproduce the old expression to the bit.
 */
export function mouthsOf(plan) {
  return plan.mouth ? [plan.mouth] : [];
}

/** World-space mouth positions for the current pose. Reuses `out` (N4). */
export function mouthPoints(sim, plan, mouths, out = null) {
  const dst = out || mouths.map(() => [0, 0, 0]);
  for (let i = 0; i < mouths.length; i++) {
    const m = mouths[i];
    const rb = sim.bodies[m.bodyIndex];
    if (!rb) continue;
    const p = rb.translation(), q = rb.rotation();
    // The body is spawned world-aligned and the limb's orientation rides on the
    // collider (see physics.js), so the mouth's local offset must be rotated by
    // the COMPOSED quaternion or it lands off the body.
    const lq = qmul([q.x, q.y, q.z, q.w], plan.bodies[m.bodyIndex].rotation);
    const v = qrot(lq, m.local);
    dst[i][0] = p.x + v[0]; dst[i][1] = p.y + v[1]; dst[i][2] = p.z + v[2];
  }
  return dst;
}

/**
 * ONE STEP of ingestion. Returns grams taken.
 *
 * A linear scan over items: 700 items against a few mouths is nothing next to a
 * Rapier step, and a spatial index would be a premature structure to maintain
 * through a model that is still moving.
 *
 * Shared by `runForage` (headless, for measurement) and the Forage screen (live,
 * so the player watches food vanish). One definition, so what is shown and what
 * is scored cannot drift apart.
 */
export function forageStep(sim, plan, food, mouths, dt = FIXED_DT, rate = INGEST_RATE, buf = null) {
  if (!mouths.length) return 0;
  const pts = mouthPoints(sim, plan, mouths, buf);
  let eaten = 0;

  // A UNIFORM GRID, NOT A SCAN OVER THE FIELD. This loop used to touch every item
  // on every step: 1400 items x 6 creatures x 240 steps/s is ~2 million distance
  // tests per simulated second, and it scales with the SIZE OF THE WORLD rather
  // than with the number of mouths — which is the wrong variable, and fatal for
  // any field bigger than the current tank.
  //
  // Cells are 2r on a side, so everything a point can reach lies inside the 3x3x3
  // block around its own cell. Cost becomes O(mouths), independent of field size.
  //
  // THE TOTAL IS UNCHANGED, not approximately: each item's `take` depends only on
  // its own mass, so summing them in grid order gives the identical number. The
  // `tick` guard preserves the old `break` — an item is eaten once per STEP, not
  // once per mouth — without allocating a Set every step.
  const g = food.grid, side = food.cellSide;
  const tick = ++food.tick;
  for (const p of pts) {
    const cx = Math.floor(p[0] / side), cy = Math.floor(p[1] / side), cz = Math.floor(p[2] / side);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
      const cell = g.get(`${cx + i},${cy + j},${cz + k}`);
      if (!cell) continue;
      for (const it of cell) {
        if (it.mass <= 0 || it.tick === tick) continue;
        const dx = p[0] - it.x, dy = p[1] - it.y, dz = p[2] - it.z;
        if (dx * dx + dy * dy + dz * dz > it.r * it.r) continue;
        const take = Math.min(it.mass, rate * dt);
        it.mass -= take;
        it.tick = tick;
        eaten += take;
      }
    }
  }
  return eaten;
}

/**
 * ── CHEMORECEPTION (Phase 2) — WHAT A RECEPTOR CAN ACTUALLY SMELL ────────────
 *
 * THE DEFECT THIS EXISTS TO FIX. Until now the only thing in this project that
 * sensed anything was `duel.js`, and it was handed `simB.centreOfMass()` directly:
 * the exact geometric position of its opponent, with NO RANGE TEST AT ALL, despite
 * `bearingTo`'s own docstring promising "0 if none in range". An omniscient
 * compass. Meanwhile `morphogen.js` has been carrying a receptor's position, its
 * outward `normal` and its left/right `side` for two versions, under the comment
 * "Nothing reads it yet."
 *
 * So morphology, sensing and behaviour were not causally connected. A creature's
 * anatomy could not affect what it perceived, which means no amount of sensory
 * sophistication downstream would have meant anything.
 *
 * WHAT THIS RETURNS. Local food concentration at each receptor, as a RATIO
 * AGAINST THE FIELD'S MEAN DENSITY: 1.0 is ordinary water, above 1 is a patch,
 * below 1 is a hole the creature has already eaten out. Ratio rather than grams
 * because that is the quantity a kinesis actually needs — "is this better than
 * average" — and because it makes the gene's useful magnitude independent of how
 * rich the world happens to be.
 *
 * IT USES THE SAME 3x3x3 GRID BLOCK `forageStep` USES, so sensing costs O(sites)
 * and not O(field), for the reason recorded there.
 */

/**
 * How far a chemoreceptor reaches, as a MULTIPLE OF THE MOUTH'S OWN REACH.
 *
 * THIS IS A DESIGN RATIO, NOT A DERIVED CONSTANT, and saying so is the point. A
 * real chemical plume's detection range depends on diffusion, flow and turbulence
 * and is not computable from anything this simulation models.
 *
 * What CAN be argued is the ordering: a sense that reaches no further than the
 * mouth is worthless, because by the time it fires the creature is already eating.
 * 3x `FOOD_RADIUS` gives a receptor a 6 cm reach against a 2 cm bite, so a
 * creature can notice a patch roughly a body length away — near enough to be
 * about THIS patch rather than the whole tank, far enough to be worth having.
 * Tied to `FOOD_RADIUS` rather than written as 6.0 so the two cannot drift.
 */
export const SENSE_REACH = 3;

/**
 * What a kinesis may do to `effort`.
 *
 * Bounded because `effort` multiplies `omega` directly and the corpus's omega band
 * is already [0.5, 6.0] rad/s: an unbounded gain would let a receptor drive a
 * joint past what the gait was ever measured at, and the resulting speed would be
 * an artefact of the sensor rather than of the animal. `probes.js` sweeps effort
 * at 0.6 / 1.0 / 1.5, so this is the band the probes already characterise.
 *
 * The floor is not zero: a creature that senses nothing must still swim, or
 * "stop moving" becomes a strategy for paying no transport cost, and 1'.4 has
 * only just finished closing the other free-energy hole.
 */
export const EFFORT_FLOOR = 0.5;
export const EFFORT_CEIL = 1.5;

/**
 * ── A FIELD A KINESIS CAN ACTUALLY READ ──────────────────────────────────────
 *
 * `makeFood`'s `contrast` and `floor` shape the fbm rejection sampling: higher
 * contrast deepens the patches, lower floor removes the uniform component mixed
 * back in. `total` is conserved either way, so this changes WHERE the food is and
 * never HOW MUCH.
 *
 * IT IS A PREREQUISITE, NOT A FLOURISH, and that is a measured claim. The signal a
 * receptor experiences over a 220 s trial, as p95 - p05 of the concentration ratio:
 *
 *     default   contrast 2.0 / floor 0.35   ->  0.087   an 8.7% swing
 *     SPOTTY    contrast 4.0 / floor 0.10   ->  0.360   4x more
 *     extreme   contrast 6.0 / floor 0.02   ->  0.340   no better, and see below
 *
 * On the shipped field there is almost nothing to smell: at 6 cm reach the fbm
 * plus a 0.35 uniform floor averages out to nearly flat. A kinesis cannot beat a
 * blind control on a field that is 8.7% varied no matter how good its gene is,
 * which is the honest reason the first Phase 2 gate run failed.
 *
 * EXTREME IS NOT BETTER, and `makeFood`'s own note says why: "NOT so patchy that a
 * creature spawns outside every patch and starves without a decision being
 * involved." At floor 0.02 the tank is mostly empty and the outcome is decided by
 * where the creature happened to spawn. 4.0 / 0.10 is the widest signal that still
 * leaves the whole tank worth swimming in.
 */
export const SPOTTY_FOOD = { contrast: 4.0, floor: 0.10 };

/**
 * Concentration at each point, as a ratio against the field's mean density.
 *
 * Reuses `mouthPoints` — a receptor and a mouth are both `{bodyIndex, local}`, and
 * having two functions that turn an organ into a world position is how the two
 * would eventually disagree about what a face offset means.
 */
export function senseAt(sim, plan, sites, food, out = null, buf = null) {
  const dst = out || new Float64Array(sites.length);
  if (!sites.length) return dst;
  const pts = mouthPoints(sim, plan, sites, buf);
  const reach = SENSE_REACH * food.radius;
  const r2 = reach * reach;
  // Expected mass inside the sensing sphere if the field were uniform. Follows the
  // field's own numbers rather than assuming the W1 ones.
  //
  // THE DENOMINATOR IS THE SCATTER VOLUME, and getting that wrong is easy: the
  // first version divided by `items.length * cellVolume`, which is not a volume
  // the field has, and every concentration came out centred on 2.86 instead of
  // 1.0. It still ORDERED patches correctly, so nothing looked broken — a ratio
  // that is silently 2.9x is exactly the kind of error that survives a smoke test
  // and then poisons a gain gene's calibration.
  const meanDensity = food.volume > 0 ? food.initialTotal / food.volume : 0;
  const expected = meanDensity * (4 / 3) * Math.PI * reach * reach * reach;

  const g = food.grid, side = food.cellSide;
  // The sensing sphere is WIDER than one grid cell, so the 3x3x3 block that
  // suffices for a 2 cm bite does not suffice for a 6 cm sniff. Sweep whatever
  // radius of cells the reach actually needs, computed rather than assumed —
  // hard-coding 1 here would silently truncate the sense to the mouth's range and
  // the bug would look like "the sensor does not help".
  const span = Math.max(1, Math.ceil(reach / side));
  for (let s = 0; s < sites.length; s++) {
    const p = pts[s];
    const cx = Math.floor(p[0] / side), cy = Math.floor(p[1] / side), cz = Math.floor(p[2] / side);
    let sum = 0;
    for (let i = -span; i <= span; i++) {
      for (let j = -span; j <= span; j++) {
        for (let k = -span; k <= span; k++) {
          const cell = g.get(`${cx + i},${cy + j},${cz + k}`);
          if (!cell) continue;
          for (const it of cell) {
            if (it.mass <= 0) continue;
            const dx = p[0] - it.x, dy = p[1] - it.y, dz = p[2] - it.z;
            if (dx * dx + dy * dy + dz * dz > r2) continue;
            sum += it.mass;
          }
        }
      }
    }
    dst[s] = expected > 0 ? sum / expected : 0;
  }
  return dst;
}

/**
 * The ledger, from grams eaten and ergs of work. Shared by the tool and the screen.
 *
 * `work` MUST BE `sim.workOut`, NOT `sim.work` — A0. The actuator both injects and
 * absorbs energy, and the old unsigned accumulator summed the two, so a creature
 * being shaken by the water billed exactly like one swimming. An animal does not
 * eat to be pushed around. `sim.work` is still the unsigned total and is still
 * what the probes and the determinism assertions read; only the metabolic bill
 * moved.
 */
/**
 * THE METABOLIC COST OF ECCENTRIC CONTRACTION, as a fraction of concentric.
 *
 * SOURCE. Lengthening a loaded muscle is substantially cheaper than shortening it
 * — the classic finding is that eccentric work costs roughly a third to a fifth of
 * concentric work for the same force, because cross-bridges are detached
 * mechanically rather than by hydrolysing ATP. It is why walking downhill is
 * easier than up and why it still is not free. 0.25 is the middle of that band.
 *
 * IT IS A RATIO, WHICH IS WHY IT IS ALLOWED HERE. Nothing about this number
 * depends on the calibration of `FOOD_ENERGY` or on any unit in this file — it is
 * the same fraction in ergs, joules or arbitrary units, and it is measured from
 * real muscle. Contrast the circulation cost 1'.2 declined to invent, which would
 * have needed an absolute joules-per-cm^3 with nothing to derive it from.
 */
export const ECCENTRIC_COST = 0.25;

export function ledger(world, massBase, eaten, work, seconds, tissue = null, eccentric = 0) {
  const basalRate = (world.METABOLIC_SCALE ?? 0.02) * Math.pow(massBase, world.KLEIBER ?? 0.75);
  const basal = basalRate * seconds;
  // erg. THE UNIT IS REAL AND THE WORLD IS DILUTE: `FOOD_ENERGY` is 6.3e7 times
  // lower than real forage (2.7e3 against 1.7e11 erg/g), which is a stated
  // property of this world's substrate, NOT a unit error — see `REAL_FORAGE_ENERGY`
  // and the long note in worlds/w1_slice.js. Every intake, balance and ratio below
  // should be read with that factor in hand.
  const intake = eaten * (world.FOOD_ENERGY ?? FOOD_ENERGY_FALLBACK);
  // ACTIVE BRAKING IS NO LONGER FREE (1'.4). `work` is `sim.workOut`, the energy
  // the actuator injected; `eccentric` is the ACTIVE part of what it absorbed —
  // the muscle generating force while being lengthened, separated from passive
  // damper dissipation by physics.js using the spring torque alone. The old
  // ledger billed only the first, which let a controller take unlimited
  // resistance from something charged as muscle everywhere else.
  const braking = (world.ECCENTRIC_COST ?? ECCENTRIC_COST) * eccentric;
  const spend = work + basal + braking;
  const out = {
    intake, basal, braking, spend,
    balance: intake - spend,
    ratio: spend > 0 ? intake / spend : Infinity,
  };

  // ── TISSUE, REPORTED AND NOT YET CHARGED (1'.2) ────────────────────────────
  //
  // `engine/l1/tissue.js` derives, from geometry alone, how much of a body is
  // within oxygen's reach of a surface. MEASURED over 60 viable creatures: the
  // median carries a DEAD FRACTION OF 0.470 — nearly half its volume is anoxic
  // core that must be dragged and accelerated and cannot contract.
  //
  // AND SELECTION IS CURRENTLY BLIND TO IT: r(deadFraction, netSpeed) = 0.034.
  // Thick creatures pay nothing for being thick. That is what makes this a real
  // new pressure rather than a restatement of one the objective already sees —
  // it was the test the law had to pass before earning a line here.
  //
  // Corroboration from the other direction: the authored swimmers sit at 0.158,
  // three times leaner than the random corpus. The animals that work are the ones
  // this law would reward, and nobody designed them with it in mind.
  //
  // ── WHAT IS DELIBERATELY NOT CHARGED, AND WHY ──────────────────────────────
  //
  // The plan has dead tissue paying for CIRCULATION — the price of violating the
  // diffusion limit. That is the right law and it is NOT IMPLEMENTED HERE,
  // because it needs a joules-per-cm^3-of-perfused-tissue coefficient and there
  // is no measurable biological quantity to derive one from. The plan's own
  // standing rule is that a coefficient without a source is a parameter and does
  // not belong, and its recorded risk for this rung is exactly this number being
  // fitted until the shapes look nice.
  //
  // So the fields below are REPORTED so that manual selection can see them and
  // so the ordering can be studied, and the ledger's arithmetic is unchanged.
  // Nothing downstream should read `deadFraction` as a cost until someone can
  // cite where its price came from.
  if (tissue) {
    out.deadFraction = tissue.deadFraction;
    out.liveMass = tissue.mass * (1 - tissue.deadFraction);
    out.oxygenRatio = tissue.oxygenRatio;
    out.thinnestHalfThickness = tissue.thinnestHalfThickness;
  }
  return out;
}

/**
 * ── SATIETY, AS A BIOMASS RESERVE (1'.5) ─────────────────────────────────────
 *
 * NOTHING IN THIS PROJECT HAS EVER MODELLED INTERNAL STATE. A creature is a pure
 * function of its genome and the clock: it cannot be hungry, cannot be full, and
 * therefore cannot have a reason to change what it is doing. That is the gap this
 * closes, and it is a prerequisite for Phase 4 (satiety is the first perceptron
 * input that is not a world measurement) and for L3 (birth and death need a
 * currency).
 *
 * THE SHAPE IS LIFTED, NOT INVENTED. `VIVARIUM_03_CONTRACTS.md` §3 already
 * specifies it, for a layer that was never built:
 *
 *     mass          = CURRENT BIOMASS RESERVE — "one variable serving as energy,
 *                     size proxy, reproduction currency and death threshold"
 *     massBase      = measured physical mass
 *     massMin       = MASS_MIN_RATIO   x massBase   -> death
 *     massReproduce = MASS_REPRO_RATIO x massBase   -> split
 *
 * Both ratios are already in the world fixture (0.5 and 2.0). Writing a second,
 * different reserve model at L1 when a canonical one is sitting in the contracts
 * is how `harvestArea` vs `surfaceArea` happened — 12 §4 records that exact
 * failure and says L3 "imports it and states nothing".
 *
 * ── THE ONE THING 12 §4 IS EMPHATIC ABOUT, AND IT IS COUNTER-INTUITIVE ───────
 *
 * "Speed, reach and turn rate are FIXED CAPABILITIES and do not scale with
 * current biomass. A STARVING CREATURE IS NOT SLOWER." The reserve is an energy
 * store, not a body size — it decides whether the animal lives and whether it can
 * breed, and it must not quietly become a performance multiplier. Nothing here
 * returns anything the physics reads.
 *
 * ── THE ENERGY-TO-MASS CONVERSION, AND WHY IT NEEDS NO NEW COEFFICIENT ───────
 *
 * A surplus becomes stored substrate at the SAME density the creature ate it at,
 * `FOOD_ENERGY`. That is an identity rather than a fitted constant: the store is
 * the same stuff as the food.
 *
 * REAL TISSUE SYNTHESIS IS LOSSY — something like 60-80% efficient — and that
 * factor is DELIBERATELY NOT APPLIED, for the same reason 1'.2 declined the
 * circulation cost: it would be a coefficient chosen from a range rather than
 * derived, and it changes the answer. Assuming lossless storage is the neutral
 * choice and it is stated rather than hidden.
 */
/*
 * `reserve` IS DELIBERATELY NOT CLAMPED AT ZERO, and goes negative in practice —
 * measured over 10 creatures at 220 s, 4 starve and one lands at -20.5 g against a
 * massBase of 20.8. Negative biomass is of course meaningless; what the number
 * means below `massMin` is HOW BADLY the trial was lost, and that is the
 * informative part when calibrating a world. `starving` is the verdict; in L3 the
 * animal would already be dead and the arithmetic would have stopped there.
 * Clamping at zero would report a hopeless creature and a marginal one identically.
 */
export function reserveAfter(world, massBase, balance, from = null) {
  const start = from ?? massBase;
  const perGram = world.FOOD_ENERGY ?? FOOD_ENERGY_FALLBACK;
  const reserve = start + balance / perGram;
  const massMin = (world.MASS_MIN_RATIO ?? 0.5) * massBase;
  const massReproduce = (world.MASS_REPRO_RATIO ?? 2.0) * massBase;
  // NORMALISED 0..1 BETWEEN DEATH AND REPRODUCTION, which is the form a
  // controller input has to take — `RANGE`-bounded, unitless, and meaningful at
  // both ends. A raw gram count would make the gain gene's useful magnitude
  // depend on how big the animal happens to be.
  const span = massReproduce - massMin;
  const raw = span > 0 ? (reserve - massMin) / span : 0;
  return {
    reserve,
    massBase,
    massMin,
    massReproduce,
    satiety: raw < 0 ? 0 : raw > 1 ? 1 : raw,
    starving: reserve <= massMin,
    canReproduce: reserve >= massReproduce,
  };
}

// ── the trial ────────────────────────────────────────────────────────────────

/**
 * Run one creature alone on a food field and return the energy ledger.
 *
 * @returns {{valid:boolean, reason?:string, eaten:number, intake:number,
 *            work:number, basal:number, spend:number, balance:number,
 *            ratio:number, mouths:number, itemsEaten:number}}
 */
/**
 * @param {boolean} [args.sensing=true] Set FALSE for the control arm: receptors
 *   are ignored and `effort` stays at 1 for the whole trial, which is exactly the
 *   pre-Phase-2 open-loop behaviour and therefore bit-identical to it. This is the
 *   parameter `foodEatenControlled` subtracts across, and it is a flag rather than
 *   a zeroed gene because zeroing the gene would also change the genome hash and
 *   every record keyed on it.
 */
export function runForage(RAPIER, { plan, genome, world, food, seconds = FORAGE_SECONDS,
                                    simOpts = {}, sensing = true, tropoGain = null }) {
  const steps = Math.round(seconds / FIXED_DT);
  const m = S1(plan);
  const mouths = mouthsOf(plan);
  const buf = mouths.map(() => [0, 0, 0]);

  let sim;
  try {
    sim = createSimulation(RAPIER, plan, genome, world, {
      bounded: true, wrap: false, effort: 1, turnBias: 0, ...simOpts,
    });
  } catch (e) {
    return { valid: false, reason: `sim: ${e.message}`, eaten: 0, intake: 0, work: 0, basal: 0, spend: 0, balance: 0 };
  }

  const foodStart = food.remaining();
  const rate = world.INGEST_RATE ?? INGEST_RATE;
  let eaten = 0;

  // ── THE WIRE (Phase 2.2) ───────────────────────────────────────────────────
  //
  // THIS LOOP NEVER TOUCHED `sim.control`. It set `effort: 1, turnBias: 0` at
  // spawn and then ran the creature open-loop for three hundred seconds, so
  // nothing a creature perceived could change anything it did — which is why
  // `eaten` measured "food found" and not "foraging skill".
  //
  // KINESIS, NOT TAXIS: the receptors modulate `effort` — how hard to swim — and
  // never `turnBias`. That is the whole design and it is a scheduling decision
  // rather than a limitation. Taxis needs to know WHICH WAY, which needs
  // orientation, which `tools/_zlight.mjs` measures as still broken (1 of 7
  // helped). Kinesis needs only "better here than a moment ago", which needs
  // swimming, which works. It is also E. coli's actual strategy.
  //
  // NEUTRAL AT chemoGain 0. `effort` stays exactly 1 and this is bit-identical to
  // the open-loop trial, which is what makes a blind creature a clean control arm
  // and what lets the 5 -> 6 corpus be compared with itself.
  const receptors = sensing === false ? [] : (plan.receptors ?? []);
  const senseBuf = receptors.map(() => [0, 0, 0]);
  const conc = new Float64Array(receptors.length);
  const gain = sensing === false ? 0 : (genome.controller.chemoGain ?? 0);
  // GENOME_V 9 — READ FROM THE GENOME, overridable by the caller. The argument
  // is how `tools/_zsense.mjs` measured this before it was a gene; it stays as an
  // override so a sweep is still possible, but the DEFAULT is now the creature's
  // own evolved value rather than zero.
  const tropo = sensing === false ? 0 : (tropoGain ?? genome.controller.tropoGain ?? 0);
  // Re-sensing every physics step is pointless and expensive: the field only
  // changes where a mouth has eaten, and a creature cannot swim a receptor's
  // 6 cm reach in 1/120 s. 12 steps is 0.1 s, which is also the L3 tick.
  const SENSE_EVERY = 12;

  for (let st = 0; st < steps; st++) {
    // ── EITHER GAIN OPENS THE BLOCK, AND THAT IS A FIX NOT A WIDENING ─────────
    //
    // This read `gain !== 0` — the KINESIS gain alone — so a creature with a live
    // `tropoGain` and `chemoGain` at zero never sensed at all and its taxis gene
    // was silently inert. `chemoGain` gating `tropoGain` is a coupling neither
    // gene's definition claims: they are two independent readings of one receptor
    // array, one driving `effort` and the other `turnBias`.
    //
    // It mattered the moment the factory started DRAWING `tropoGain`: every drawn
    // creature has `chemoGain` 0, so without this the whole draw would have been
    // a no-op and the fix would have measured nothing.
    if ((gain !== 0 || tropo !== 0) && receptors.length && st % SENSE_EVERY === 0) {
      senseAt(sim, plan, receptors, food, conc, senseBuf);
      // The creature has ONE nose, not one per receptor. Averaging is the
      // non-directional read — a differential between sides is what tropotaxis
      // would take, and that is Phase 3, gated on orientation.
      let mean = 0;
      for (let i = 0; i < conc.length; i++) mean += conc[i];
      mean /= conc.length;
      // `mean - 1` centres on ordinary water, so the sign of `chemoGain` decides
      // the STRATEGY and neither is declared: positive swims harder in richer
      // water, negative slows down in it and dwells. Dwelling is the one that
      // should win on a patchy field, and the point is that nothing here says so.
      // Guarded: at `chemoGain` 0 the effort must stay exactly 1, or opening the
      // block for taxis would quietly hand every creature a kinesis it did not
      // evolve — and `1 + 0 * (mean - 1)` is 1 only if the arithmetic is exact.
      if (gain !== 0) {
        const e = 1 + gain * (mean - 1);
        sim.control.effort = e < EFFORT_FLOOR ? EFFORT_FLOOR : e > EFFORT_CEIL ? EFFORT_CEIL : e;
      }

      // ── TROPOTAXIS — THE DEFERRED HALF, AND IT IS A WIRE NOT AN ORGAN ───────
      //
      // The block above averages every receptor into one number, and the comment
      // beside it says why: "a differential between sides is what tropotaxis
      // would take, and that is Phase 3, gated on orientation". Orientation was
      // measured broken at the time (1 of 7 helped). IT IS NOT ANY MORE — four of
      // eight bred champions arrive in 6 of 6 directions — so the gate that
      // deferred this has been lifted and the differential can be taken.
      //
      // WHY THE CONTRAST AND NOT THE DIFFERENCE. `(R - L) / (R + L)` is
      // dimensionless and bounded in [-1, 1], so the command does not scale with
      // how rich the water is and cannot saturate `turnBias` merely by the
      // creature swimming into a dense patch. A raw difference would make the
      // gene's usable range a function of `FOOD_ENERGY`, which is the kind of
      // coupling that makes a constant need re-tuning every time the world moves.
      //
      // `tropoGain` IS AN ARGUMENT, NOT A GENE, AND DELIBERATELY SO. `preyGain2`
      // was given a schema bump on a mechanism and came out of its A/B roughly
      // neutral; the standing lesson is to measure first and spend `GENOME_V`
      // after. At 0 — every caller that does not pass it — this branch does not
      // execute and the trial is bit-identical to the kinesis-only one.
      if (tropo !== 0) {
        let l = 0, nl = 0, r = 0, nr = 0;
        for (let i = 0; i < conc.length; i++) {
          if (receptors[i].side < 0) { l += conc[i]; nl++; } else { r += conc[i]; nr++; }
        }
        // A creature with receptors on only ONE side has no differential to read.
        // Left at turnBias 0 rather than fed a one-sided number, which would be a
        // fabricated direction — the omniscient compass all over again.
        if (nl && nr) {
          const lm = l / nl, rm = r / nr;
          const denom = lm + rm;
          const contrast = denom > 1e-9 ? (rm - lm) / denom : 0;
          const b = tropo * contrast;
          sim.control.turnBias = b < -1 ? -1 : b > 1 ? 1 : b;
        }
      }
    }
    try { sim.step(); } catch { break; }
    eaten += forageStep(sim, plan, food, mouths, FIXED_DT, rate, buf);
  }

  // A0 — the metabolic bill is the energy INJECTED. `work` (the unsigned total)
  // is still reported alongside it so the two can be compared in the field.
  const work = sim.workOut;
  const workTotal = sim.work;
  // 1'.4 — the ACTIVE part of what the actuator absorbed. Read before free().
  const eccentric = sim.workEccentric;
  sim.free();

  const L = ledger(world, m.massBase, eaten, work, seconds, creatureTissue(plan), eccentric);
  return {
    valid: true,
    eaten, work, workTotal, eccentric, ...L,
    // 1'.5 — where the trial LEFT the creature, not just what it spent. Reported
    // rather than enforced: nothing dies of this yet, because death is L3's job
    // and L3 does not exist. `satiety` is the field Phase 4 feeds to the network.
    ...reserveAfter(world, m.massBase, L.balance),
    mouths: mouths.length,
    fieldStart: foodStart, fieldEnd: food.remaining(), itemsEaten: food.eatenCount(),
  };
}

/**
 * FOOD EATEN, as a selection objective.
 *
 * A FRESH FIELD PER CREATURE, or the trial order decides the result: the second
 * creature would forage a field the first had already stripped. Same seed, so
 * every creature meets the identical field and the comparison is about them.
 *
 * NOT CONTROL-SUBTRACTED, which is a live caveat rather than an oversight. The
 * seek objective taught this: raw seek score correlated 0.90 with netSpeed, so it
 * bred fast swimmers and left the sensor gain drifting. Subtraction needs a
 * behaviour to disable, and the kinesis gene it would disable does not exist yet.
 * Until it does, read this as "food found", not "foraging skill".
 */
export function foodEaten(RAPIER, { plan, genome, world, seconds = FORAGE_SECONDS, foodOpts = {} }) {
  const food = makeFood(world, foodOpts);
  const r = runForage(RAPIER, { plan, genome, world, food, seconds });
  return r.valid ? r.eaten : 0;
}

/**
 * ── THE STABILISED REGIME, AND IT IS MEASURED RATHER THAN CHOSEN ─────────────
 *
 * A forage trial is not steady. Measured over 6 creatures in 30 s buckets, mean
 * intake in mg/s across a 300 s run:
 *
 *      0-30    30-60   60-90   90-120  120-150  150-180  180-210 210-240 ...
 *      39.0     13.1    13.1     9.5     14.3     13.1      9.5     4.5
 *      ^^^^     \_______________ flat, ~12-14 ______________/       ^^^ falling
 *
 * THREE REGIMES, and reporting a single total conflates all of them:
 *
 *   1. A SPAWN WINDFALL. The first bucket runs at 3x everything after it, because
 *      the creature wakes up inside an untouched neighbourhood and hoovers it.
 *      That is a fact about where it was placed, not about how it forages.
 *   2. THE STABILISED REGIME, roughly 30-180 s. Flat. This is the animal's actual
 *      rate.
 *   3. LOCAL DEPLETION. Past ~180 s the rate falls away as the creature finishes
 *      its own patch — real, and the thing kinesis exists to escape, but it
 *      measures the tank as much as the creature.
 *
 * So `FORAGE_WARMUP` discards (1) and `FORAGE_WINDOW` ends before (3) takes hold.
 * Both numbers come from the table above rather than from taste, and if the
 * harvest model or the field moves they must be re-derived — the same standing
 * obligation `FOOD_ENERGY` carries.
 */
export const FORAGE_WARMUP = 30;
export const FORAGE_WINDOW = 150;

/**
 * Everything a card needs about one creature, measured in the stabilised regime.
 *
 * WHY THIS IS NOT `runForage` WITH A LONGER COMMENT: `runForage` reports TOTALS
 * over a whole trial, so its `eaten` is dominated by the spawn windfall and its
 * `ratio` mixes three regimes. Totals are the right thing for a live tank readout,
 * where the question is "how is this creature doing right now". They are the wrong
 * thing for a card, where the question is "what IS this creature" — and a number
 * that changes with how long you happened to watch is not a property of an animal.
 *
 * Path length accumulates EVERY PHYSICS STEP, not from a sampled trace, for the
 * reason `probe.js:246` records: the centre of mass oscillates at 12-22 Hz and a
 * 20 Hz trace aliases the wobble away, reporting a thrashing creature as
 * travelling almost straight.
 */
export function forageProfile(RAPIER, {
  plan, genome, world, foodOpts = {}, sensing = true,
  warmup = FORAGE_WARMUP, window = FORAGE_WINDOW, simOpts = {},
}) {
  const m = S1(plan);
  const mouths = mouthsOf(plan);
  const buf = mouths.map(() => [0, 0, 0]);
  const food = makeFood(world, foodOpts);
  const rate = world.INGEST_RATE ?? INGEST_RATE;

  let sim;
  try {
    sim = createSimulation(RAPIER, plan, genome, world,
      { bounded: true, wrap: false, effort: 1, turnBias: 0, ...simOpts });
  } catch (e) {
    return { valid: false, reason: `sim: ${e.message}` };
  }

  const receptors = sensing === false ? [] : (plan.receptors ?? []);
  const senseBuf = receptors.map(() => [0, 0, 0]);
  const conc = new Float64Array(receptors.length);
  const gain = sensing === false ? 0 : (genome.controller.chemoGain ?? 0);

  const fieldStart = food.remaining();
  const step = (n) => {
    let eaten = 0;
    for (let s = 0; s < n; s++) {
      if (gain !== 0 && receptors.length && s % 12 === 0) {
        senseAt(sim, plan, receptors, food, conc, senseBuf);
        let mean = 0; for (let i = 0; i < conc.length; i++) mean += conc[i];
        mean /= conc.length;
        const e = 1 + gain * (mean - 1);
        sim.control.effort = e < EFFORT_FLOOR ? EFFORT_FLOOR : e > EFFORT_CEIL ? EFFORT_CEIL : e;
      }
      try { sim.step(); } catch { return { eaten, broke: true }; }
      eaten += forageStep(sim, plan, food, mouths, FIXED_DT, rate, buf);
    }
    return { eaten, broke: false };
  };

  // ── the discarded warm-up ──────────────────────────────────────────────────
  const warm = step(Math.round(warmup / FIXED_DT));
  if (warm.broke) { sim.free(); return { valid: false, reason: 'diverged in warmup' }; }

  // Everything from here is the measurement. Zero the accumulators the sim owns
  // so `workOut` and friends describe the WINDOW and not the warm-up too.
  sim.resetClock();
  const startCom = sim.centreOfMass();
  let prevCom = startCom, path = 0;

  const steps = Math.round(window / FIXED_DT);
  let eaten = 0, broke = false;
  for (let s = 0; s < steps; s++) {
    if (gain !== 0 && receptors.length && s % 12 === 0) {
      senseAt(sim, plan, receptors, food, conc, senseBuf);
      let mean = 0; for (let i = 0; i < conc.length; i++) mean += conc[i];
      mean /= conc.length;
      const e = 1 + gain * (mean - 1);
      sim.control.effort = e < EFFORT_FLOOR ? EFFORT_FLOOR : e > EFFORT_CEIL ? EFFORT_CEIL : e;
    }
    try { sim.step(); } catch { broke = true; break; }
    eaten += forageStep(sim, plan, food, mouths, FIXED_DT, rate, buf);
    const c = sim.centreOfMass();
    if (Number.isFinite(c[0] + c[1] + c[2])) {
      path += Math.hypot(c[0] - prevCom[0], c[1] - prevCom[1], c[2] - prevCom[2]);
      prevCom = c;
    }
  }

  const endCom = prevCom;
  const work = sim.workOut;
  const eccentric = sim.workEccentric;
  const integrity = sim.integrity();
  sim.free();

  const net = Math.hypot(endCom[0] - startCom[0], endCom[1] - startCom[1], endCom[2] - startCom[2]);
  const L = ledger(world, m.massBase, eaten, work, window, creatureTissue(plan), eccentric);

  return {
    valid: !broke,
    reason: broke ? 'diverged in window' : null,
    warmup, window,

    // ── the five the card asks for ──────────────────────────────────────────
    /** g/s, stabilised. NOT total eaten — see the regime table above. */
    foodPerSecond: eaten / window,
    /** intake / spend over the window. UNCAPPED — the display clamps, not this. */
    multiplier: L.ratio,
    /** 0..1, net displacement over path length. 1 is an arrow, 0 is a thrash. */
    straightness: path > 1e-9 ? net / path : 0,
    /** cm, and the two ways of saying it — a card should not have to choose. */
    size: { mass: m.massBase, radius: m.boundingRadius, bodies: plan.bodyCount },
    /** rad/s. Set by the caller from S3; null when it has not been probed. */
    turnCapability: null,

    // ── context, so none of the above can be read out of it ─────────────────
    netDisplacement: net,
    pathLength: path,
    eaten,
    intake: L.intake, spend: L.spend, basal: L.basal, braking: L.braking,
    balance: L.balance,
    deadFraction: L.deadFraction,
    /**
     * Fraction of the WHOLE FIELD consumed by the end of the window. The
     * stabilised regime assumes the tank is not meaningfully emptier than it
     * started; if this ever climbs, the window has run into depletion and the
     * rate above is measuring the tank rather than the animal.
     */
    fieldDepletion: fieldStart > 0 ? (fieldStart - food.remaining()) / fieldStart : 0,
    /**
     * ROADMAP §5b lesson 3, honoured: `runForage` never checked this, and a
     * creature that comes apart reports fictional intake — 7864 g against rivals'
     * 31-49. A card must never show a number a burst creature produced.
     */
    intact: integrity.spread < 3,
    spread: integrity.spread,
  };
}

/**
 * ── FORAGING SKILL, CONTROL-SUBTRACTED (Phase 2.3) ───────────────────────────
 *
 * The score `foodEaten` above could never give. It measures FOOD FOUND, and
 * `ROADMAP.md` §4.3 records what happens if you select on that: the raw seek score
 * correlated **0.90 with netSpeed**, so it bred fast swimmers and left the sensor
 * gain drifting. Subtraction needs a behaviour to disable, and until Phase 2.2
 * wired the receptors there was none — the caveat on `foodEaten` said exactly
 * that, and this is the function it was waiting for.
 *
 *     score = eaten(sensor live) - eaten(sensor off)
 *
 * SAME CREATURE, SAME FIELD SEED, SAME EVERYTHING ELSE. Whatever a body gains by
 * simply being a good swimmer appears in BOTH arms and cancels; what survives is
 * what the sensor bought. That is the difference between "found food" and "knows
 * how to look", and it is the only form in which food may be selected on.
 *
 * WHY THE ARMS MUST SHARE A FIELD SEED, and it is not a detail: the blind arm's
 * intake has CV 0.624 over the corpus (measured, n=12) — the spread is nearly
 * two thirds of the mean. A sensor effect compared ACROSS creatures would be
 * invisible under that. Paired, the field cancels exactly.
 *
 * ── AND IT NEEDS ITS OWN GAIT ADAPTER, WHICH IT DOES NOT YET HAVE ────────────
 *
 * `ROADMAP.md` §4.4: `adaptGait` hill-climbs NET SPEED (`gait.js:88` calls
 * `scorePopulation`). Handing it to a forage objective optimises one quantity and
 * scores another — it would tune each body for travel and then ask how well it
 * eats. Any burst that selects on this function must pass an adapter that
 * hill-climbs THIS score, or pass none at all. Deliberately not wired here:
 * `autoBurst` takes `adaptFn` as a parameter precisely so the wrong one cannot be
 * assumed, and picking it is the caller's decision to make explicitly.
 */
export function foodEatenControlled(RAPIER, { plan, genome, world, seconds = FORAGE_SECONDS, foodOpts = {} }) {
  const live = runForage(RAPIER, {
    plan, genome, world, food: makeFood(world, foodOpts), seconds, sensing: true,
  });
  const blind = runForage(RAPIER, {
    plan, genome, world, food: makeFood(world, foodOpts), seconds, sensing: false,
  });
  if (!live.valid || !blind.valid) return 0;
  return live.eaten - blind.eaten;
}
