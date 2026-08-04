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
 * ⚠ DERIVED, NOT YET GENETIC — and this is the next real schema decision.
 * Placement and COUNT should be genes, the same shape the sensor gains already
 * have and the same shape eyes will need, because where a sensor sits on a body
 * is exactly the sort of thing selection should be allowed to discover. That is
 * a GENOME_V bump with a migration, factory support and a mutation operator, and
 * it is worth spending ONCE — after this model has been measured, not before.
 *
 * Until then: one mouth, on the ROOT body, at the leading face of its own
 * longest axis. A head, by the only definition available without a gene to say
 * otherwise. When the gene lands, only this function changes.
 */
export function mouthsOf(plan) {
  const b = plan.bodies[0];
  if (!b) return [];
  const d = b.dims;
  const axis = d[2] >= d[0] && d[2] >= d[1] ? 2 : (d[1] >= d[0] ? 1 : 0);
  const local = [0, 0, 0];
  local[axis] = d[axis] * 0.5;
  return [{ bodyIndex: 0, local }];
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
 * The ledger, from grams eaten and ergs of work. Shared by the tool and the screen.
 *
 * `work` MUST BE `sim.workOut`, NOT `sim.work` — A0. The actuator both injects and
 * absorbs energy, and the old unsigned accumulator summed the two, so a creature
 * being shaken by the water billed exactly like one swimming. An animal does not
 * eat to be pushed around. `sim.work` is still the unsigned total and is still
 * what the probes and the determinism assertions read; only the metabolic bill
 * moved.
 */
export function ledger(world, massBase, eaten, work, seconds) {
  const basalRate = (world.METABOLIC_SCALE ?? 0.02) * Math.pow(massBase, world.KLEIBER ?? 0.75);
  const basal = basalRate * seconds;
  const intake = eaten * (world.FOOD_ENERGY ?? FOOD_ENERGY_FALLBACK);
  const spend = work + basal;
  return { intake, basal, spend, balance: intake - spend, ratio: spend > 0 ? intake / spend : Infinity };
}

// ── the trial ────────────────────────────────────────────────────────────────

/**
 * Run one creature alone on a food field and return the energy ledger.
 *
 * @returns {{valid:boolean, reason?:string, eaten:number, intake:number,
 *            work:number, basal:number, spend:number, balance:number,
 *            ratio:number, mouths:number, itemsEaten:number}}
 */
export function runForage(RAPIER, { plan, genome, world, food, seconds = FORAGE_SECONDS, simOpts = {} }) {
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
  for (let st = 0; st < steps; st++) {
    try { sim.step(); } catch { break; }
    eaten += forageStep(sim, plan, food, mouths, FIXED_DT, rate, buf);
  }

  // A0 — the metabolic bill is the energy INJECTED. `work` (the unsigned total)
  // is still reported alongside it so the two can be compared in the field.
  const work = sim.workOut;
  const workTotal = sim.work;
  sim.free();

  const L = ledger(world, m.massBase, eaten, work, seconds);
  return {
    valid: true,
    eaten, work, workTotal, ...L,
    mouths: mouths.length,
    fieldStart: foodStart, fieldEnd: food.remaining(), itemsEaten: food.eatenCount(),
    massBase: m.massBase,
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
