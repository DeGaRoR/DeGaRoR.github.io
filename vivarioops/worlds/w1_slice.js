// worlds/w1_slice.js — 03 §5. The complete W1 fixture.
//
// ALL VALUES PROVISIONAL AND EXPERIMENTAL. They are starting points chosen for
// plausible ratios; none is derived from theory. The audition procedure (12 §13,
// 02 §8) is what makes them right. `noiseContrast` and `totalMass` are the two
// expected to move.
//
// Every constant here is visible and editable on the developer panel (A1).
//
// A0 ADDITIONS to 03 §5, all approved — each marked [A0] below:
//   1. pursuitGain / evasionGain   — required by 30 §5 C1, omitted from 03 §5
//   2. MASS_MIN_RATIO, MASS_REPRO_RATIO, PERCEPTION_REACH_K, PERCEPTION_WORLD_FRAC
//      — 03 §3 had these as literals; 30 D1 forbids hard-coded constants
// Values are unchanged from the literals they replace, so behaviour is identical.

export const W1_SLICE = {
  id: 'w1',
  name: 'The Soup',
  faunaVersion: 1,

  // ── physics — L1 and L2 ────────────────────────────────
  gravity:         9.81,          // 02 §1a: constant in every world, never a dial
  mediumDensity:   1.0,           // water
  dragScale:       1.0,
  dragCoefficient: 0.9,
  floor:   { present: true, y: -12.0, friction: 0.3, restitution: 0.1 },
  surface: { present: true, y:  12.0 },
  tankBounds: [16, 24, 16],       // m — L1 tank

  // ── presentation — label only, never physics ───────────
  phase: 'liquid',

  // ── ecology — L3 ───────────────────────────────────────
  worldSize:     [200, 200],      // m, torus
  substrateGrid: [64, 64],
  totalMass:     6000,            // kg — THE conserved quantity
  fertility: { noiseScale: 0.05, noiseContrast: 0.4, seed: 0x5EED },
  diffusionRate: 0.08,            // per tick, cell-to-cell
  HARVEST_RATE:  0.35,            // kg/(m^2 s) at full substrate
  PREDATION_EFFICIENCY: 0.6,
  KLEIBER:         0.75,          // basalRate proportional to mass^KLEIBER
  METABOLIC_SCALE: 0.02,          // W per kg^0.75
  REPRO_COOLDOWN: 20.0,           // s
  MAX_AGE:       600.0,           // s
  dt:              0.1,           // s per L3 tick

  // ── derivation ratios [A0] — were literals in 03 §3 ────
  MASS_MIN_RATIO:        0.5,     // massMin       = 0.5 x massBase  -> death
  MASS_REPRO_RATIO:      2.0,     // massReproduce = 2.0 x massBase  -> split
  PERCEPTION_REACH_K:    8.0,     // perceptionRadius = min(8 x reach, 0.02 x worldWidth)
  PERCEPTION_WORLD_FRAC: 0.02,    // 02 §3: the most important tuning parameter in the game

  // ── run ────────────────────────────────────────────────
  biomassBudget: 300,             // kg the player may seed
  runDuration:   4000,            // s, about 40 000 ticks

  // ── bridge ─────────────────────────────────────────────
  duelRepeats:   3,               // slice value; full is 5
  duelDuration: 15.0,             // s
  engagementK:   4.0,

  // ── disposition [A0] — UNMEASURED slice defaults ───────
  // 30 §5 C1: S4 pursuit and S5 evasion are deferred. Flagged on the dev panel.
  pursuitGain: 0.6,
  evasionGain: 0.6,

  // ── fauna — three residents, bred and frozen at C2 ─────
  residents: ['res_a', 'res_b', 'res_c'],
};

/**
 * Placeholder resident genome hashes for worldHash() until C2 replaces them with
 * real genome hashes (03 §1, A0 defect 4). faunaVersion bumps at that swap, so
 * every record compiled before C2 is correctly invalidated.
 */
export const W1_RESIDENT_HASHES_PLACEHOLDER = W1_SLICE.residents.slice();

export default W1_SLICE;
