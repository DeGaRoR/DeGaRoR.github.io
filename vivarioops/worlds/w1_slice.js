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
  // BUMPED AT C6.2, 3 -> 4. Added mass is now in the mass matrix: a body
  // accelerating through water drags fluid with it, which was the largest
  // physical omission in the fluid model. It moves every measured capability
  // (net speed +31%, cost of transport -37%, body inertia x1.9 median), so every
  // record compiled before it is correctly invalidated and the residents below
  // were re-frozen against the new physics in the same commit.
  // BUMPED AGAIN AT THE C2 RE-MEASURE, 4 -> 5. `tankBounds` is a hashed field, so
  // widening the tank below invalidates every record compiled against the old one
  // and the residents are re-frozen with it.
  // BUMPED AT THE SOLVER FIX, 5 -> 6. `SOLVER_ITERATIONS` went from Rapier's
  // default 4 to 8, because 4 DOES NOT CONVERGE on these joint trees: measured on
  // a genome taken from a player's own save, a creature swam normally for ~50
  // minutes and then came apart in a single step, reaching a spread of 1309 times
  // its own rest radius (tools/_ztear.mjs — 8 and 16 iterations never burst,
  // and turning added mass off does NOT prevent it, so the solver owns it).
  // A convergence change moves every integrated trajectory, so every capability
  // measured before it is correctly invalidated. Shipped with it: the Hill
  // force-velocity relation on the actuator, which is 00 §9's power bound finally
  // enforced rather than approximated by a torque bound.
  // BUMPED AT A1/A2/A3, 6 -> 7, AND THIS IS THE LARGEST INVALIDATION SO FAR.
  // Three changes land together, each of which alone would require it:
  //   A1 — engine/l1/physics.js never called Rapier's resetForces/resetTorques,
  //        so the fluid force applied at step n was the SUM of every force
  //        computed since spawn (tools/_zaccum.mjs). Every trajectory ever
  //        measured in this repo was taken against that. Fixed; the corpus KE
  //        runaway went 31% -> 0% and path speed fell ~2.3x, which is a
  //        correction and not a regression.
  //   A2 — SLICE_LIMITS.maxRecursion 2 -> 6 plus the spine sub-grammar, so the
  //        draw produces segmented bodies (run >= 4: 0% -> 14.3%).
  //   A3 — GENOME_V 2 -> 3, the positional phase gradient. Neutral at insertion,
  //        but it moves every genome hash and therefore worldHash.
  //   A4 — gravity 9.81 -> 981, the CGS correction. `gravity` is a hashed field.
  //        Verified inert rather than argued inert (tools/_zgravity.mjs).
  //   A5 — GENOME_V 3 -> 4, proprioception. Neutral at insertion; moves the
  //        hashes again.
  //   D0 — GENOME_V 4 -> 5, organ placement: `mouth`, per-node `sites`,
  //        `controller.chemoGain`. Neutral at insertion — the migration writes
  //        the placement that reproduces the old derived mouth to the bit, no
  //        node gains a site, and the gain is 0 — but `canonical()` emits three
  //        new fields, so every genome hash moves and worldHash with it.
  faunaVersion: 8,

  // ── physics — L1 and L2 ────────────────────────────────
  // UNITS ARE CGS: cm, g, s (01 §7, and the header of engine/l1/physics.js).
  // gravity: 02 §1a says constant in every world, never a dial. It SHOULD read
  // 981 cm/s^2 under this system and is left at 9.81 because it is provably
  // inert — SLICE_LIMITS.density is [1,1] against mediumDensity 1.0, so the
  // buoyancy term (mediumDensity - density)*V*g is identically zero, bit-exact
  // at g = 0 / 9.81 / 981. It must be corrected before the density band unpins
  // at step F, and not before, so that one change moves one number.
  // CORRECTED AT A4, 9.81 -> 981. The note above says it "SHOULD read 981 cm/s^2
  // under this system" and was left wrong because it is provably inert:
  // SLICE_LIMITS.density is [1, 1] against mediumDensity 1.0, so the buoyancy
  // term `(mediumDensity - density) * V * g` is IDENTICALLY ZERO and no
  // trajectory can see g at all. Verified rather than assumed —
  // tools/_zgravity.mjs compares the corpus at 9.81 and 981 and requires
  // bit-identical centres of mass.
  //
  // Moved NOW, with MUSCLE_STRESS, because both change the same force balance
  // and the note asks for them to move once; and because A1/A2/A3 have already
  // bumped faunaVersion this session, so it rides an invalidation that is
  // happening anyway rather than forcing another one later.
  gravity:         981,           // cm/s^2 — CGS, and inert while density is pinned to [1,1]
  mediumDensity:   1.0,           // water, g/cm^3
  dragScale:       1.0,
  dragCoefficient: 0.9,
  floor:   { present: true, y: -12.0, friction: 0.3, restitution: 0.1 },
  surface: { present: true, y:  12.0 },
  // WIDENED AT THE C2 RE-MEASURE, [16,24,16] -> [32,24,32]. The old tank could not
  // hold the separation its own specs asked for, and both specs were unsatisfiable
  // at once: 11 §6 wants a duel start of k*(reachA+reachB) for k in 2..6, which is
  // a median of 24.9 cm, and 03 §4 puts L3 engagement at 4*(reachA+reachB) = 26 cm
  // — inside 16 cm of tank. duelSetup's room along an axis is
  // 2*(toWall - maxReach - WALL) = 8.5 cm at the old size, so EVERY duel clamped
  // and the k parameter selected nothing.
  // At 32 cm the axis room is 24.5 cm, which honours k=2 and k=3 outright and most
  // of the rest on the diagonal; `fitRatio` still reports what was honoured.
  // Height is unchanged: it is the buoyancy axis and buoyancy is inert here.
  // THE MEASUREMENT VOLUME. Hashed, so moving it invalidates every compiled
  // record — and it should almost never move, because nothing measured depends
  // on it: tools/_zsize.mjs shows locomotion scores bit-identical across an 8x
  // range, since objective.js scores on the torus with no walls at all.
  tankBounds: [32, 24, 32],       // cm — measurement volume (hashed)

  // WHAT THE PLAYER WATCHES. Unhashed, therefore FREE. Set to 2x the measurement
  // volume because tools/_zwall.mjs measured the old one as a trap: 4 of 6
  // creatures on the glass within 104 s and 29% of a ten-minute trial spent
  // against it, speed and wall gap decaying together — the absorbing boundary
  // physics.js:697 records. At 2x that is 1 of 6 and 0% of the trial.
  // Change this at will. It invalidates nothing.
  habitatBounds: [64, 48, 64],    // cm — the aquarium (NOT world identity)

  // ── presentation — label only, never physics ───────────
  phase: 'liquid',
  // Which --pal-<id>-0..5 ramp the creature renderer indexes (values live in
  // tokens.css per N16). A new world ships a new ramp and sets this.
  palette: 'w1',

  // ── ecology — L3 ───────────────────────────────────────
  worldSize:     [200, 200],      // cm, torus
  substrateGrid: [64, 64],
  totalMass:     6000,            // g — THE conserved quantity
  fertility: { noiseScale: 0.05, noiseContrast: 0.4, seed: 0x5EED },
  diffusionRate: 0.08,            // per tick, cell-to-cell
  HARVEST_RATE:  0.35,            // g/(cm^2 s) at full substrate

  // ENERGY PER GRAM OF FOOD, erg/g — the conversion the forage ledger compares
  // across. CALIBRATED, NOT DERIVED, and the distinction is the whole note:
  //
  //   Derived, it would be ~1e11 erg/g (real forage is of order 1e7 J/kg). At
  //   that value the measured ledger runs at intake/spend ~ 7e7 — food is free by
  //   seven orders of magnitude and the comparison says nothing at all. That is a
  //   true fact about these animals: 7 cm of near-neutral tissue doing almost no
  //   mechanical work cannot be energy-limited by real food.
  //
  //   4.2e4 is set so the MEDIAN creature roughly breaks even over a 300 s trial
  //   (tools/_zforage.mjs), which is what makes "is it paying its way?" a question
  //   with an answer. IT IS TIED TO THE HARVEST MODEL: it was 1.4e3 under the old
  //   point-sample uptake, 6.4e3 under body-proximity absorption, and moved again
  //   for the mouth model — because changing how a creature reaches food changes
  //   what breaking even means. It is also tied to the TRIAL LENGTH, since basal
  //   cost accrues with time. Recalibrate whenever either changes, and say so.
  //   It belongs in the world fixture rather than in engine code
  //   for exactly the reason 12 §5 gives — "all numeric constants come from the
  //   world fixture; none is hard-coded" — and like HARVEST_RATE beside it, 03 §5
  //   already says of these: "none is derived from theory."
  //   RECALIBRATED AT THE PHASE A EXIT, 4.2e4 -> 2.7e3. The fourth move, and the
  //   rule above names three of its four triggers as having fired at once: A0
  //   moved the metabolic bill from unsigned `work` to `workOut` (an animal does
  //   not eat to be pushed around by the water); A1 fixed a force that had been
  //   accumulating since spawn, so a creature no longer fights the summed history
  //   of its own drag and does an order of magnitude less work; A2 and A3 changed
  //   what the corpus is. Left at 4.2e4 the median intake/spend ran at 17 and
  //   100% of the corpus broke even — food was free again and the ledger had
  //   stopped asking a question.
  //
  //   Derived, not searched (tools/_zfoodcal.mjs, 24 creatures x 300 s): the value
  //   that puts a creature exactly at break-even is spend/eaten, and the median of
  //   that over the corpus is 2.663e3. At the shipped 2.7e3 the corpus spreads
  //   p10 0.12 / median 1.08 / p90 12.95 with HALF of it paying its way — which is
  //   the spread selection needs. A calibration that put everyone at 1.0 would
  //   have removed the signal.
  FOOD_ENERGY:   2.7e3,           // erg/g — see above; recalibrated at the Phase A exit
  PREDATION_EFFICIENCY: 0.6,
  KLEIBER:         0.75,          // basalRate proportional to mass^KLEIBER
  METABOLIC_SCALE: 0.02,          // erg/s per g^0.75
  REPRO_COOLDOWN: 20.0,           // s
  MAX_AGE:       600.0,           // s
  dt:              0.1,           // s per L3 tick

  // ── derivation ratios [A0] — were literals in 03 §3 ────
  MASS_MIN_RATIO:        0.5,     // massMin       = 0.5 x massBase  -> death
  MASS_REPRO_RATIO:      2.0,     // massReproduce = 2.0 x massBase  -> split
  PERCEPTION_REACH_K:    8.0,     // perceptionRadius = min(8 x reach, 0.02 x worldWidth)
  PERCEPTION_WORLD_FRAC: 0.02,    // 02 §3: the most important tuning parameter in the game

  // ── run ────────────────────────────────────────────────
  biomassBudget: 300,             // g the player may seed
  runDuration:   4000,            // s, about 40 000 ticks

  // ── bridge ─────────────────────────────────────────────
  duelRepeats:   3,               // slice value; full is 5
  duelDuration: 15.0,             // s
  // HALVED at the same re-measure, 4.0 -> 2.0. engagementRadius = k*(reachA+reachB)
  // and the reach sum runs to ~11 cm on a big pair, so k=4 asked for 44 cm of
  // engagement inside a tank that is now 32. k=2 gives 13 cm on a median pair and
  // 22 on the largest, both of which the tank can actually hold. Unlike tankBounds
  // this field is not hashed, but it ships in the same bump because the two
  // defects are one defect.
  engagementK:   2.0,

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
