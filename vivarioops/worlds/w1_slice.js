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

import { W1_RESIDENT_HASHES } from './w1_residents.js';

export const W1_SLICE = {
  id: 'w1',
  name: 'The Soup',
  // BUMPED AT C2, 1 -> 2. The residents stopped being the placeholder strings
  // 'res_a'/'res_b'/'res_c' and became three real genome hashes, which changes
  // worldHash and therefore correctly invalidates every record compiled before
  // C2 (03 §1). This is the swap A0 wrote the placeholder for.
  // BUMPED AT THE DRAG-LAW DELIVERY, 2 -> 3. 10 §A8 was amended from a single
  // centre-applied force to the per-face law, which changes every measured
  // capability, so the residents were re-frozen against the new physics and
  // every record compiled before it is correctly invalidated (03 §1).
  faunaVersion: 3,

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
  // Which --pal-<id>-0..5 ramp the creature renderer indexes (values live in
  // tokens.css per N16). A new world ships a new ramp and sets this.
  palette: 'w1',

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
 * The resident genome hashes fed to `worldHash()`.
 *
 * REPLACED AT C2 (A0 defect 4, and the obligation the gate has carried since).
 * Until now these were the resident IDS standing in for genomes that did not
 * exist; `worlds/w1_residents.js` now holds the three frozen genomes and their
 * precomputed hashes, so world identity is derived from the actual fauna. The
 * old export name is kept as an alias for one step so nothing breaks silently,
 * and `faunaVersion` was bumped in the same edit — a resident change that did
 * not move the hash would leave stale records looking valid, which is exactly
 * what K5 exists to catch.
 */
export const W1_RESIDENT_HASHES_PLACEHOLDER = W1_RESIDENT_HASHES;

export default W1_SLICE;
