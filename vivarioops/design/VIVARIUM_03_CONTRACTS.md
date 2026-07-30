# VIVARIUM — 03 · Contracts & Fixtures

**The single source for every struct that crosses a layer boundary, and for every
constant the slice needs.** No other document may restate these schemas; they quote this
one.

| | |
|---|---|
| **Status** | Normative and exclusive |
| **Created** | R3, in response to external review finding #2 |
| **Overrides** | 01 §2 C3 · 11 §7 · 12 §4 species table — all three now defer here |
| **Ships as** | `/contracts/species.js`, `/contracts/world.js`, `/worlds/w1_slice.js` |

**Why this document exists.** The same struct was written three times, in three
documents, across three sessions, and diverged: `burstDuration` present in one and not
another, `harvestArea` versus `surfaceArea`, thresholds nobody produced, a dense matrix
against a single row. That is a structural failure, not a proofreading one. The fix is
one source that the code imports and the documents quote.

---

## 1. `WorldKey` — content-derived world identity

`worldId` alone is insufficient: two materially different worlds can share it, and a
stale capability record would then be treated as valid against new physics or new fauna.

```js
worldHash = fnv1a([
  worldId,
  gravity, mediumDensity, dragScale,
  floor.present, floor.friction, floor.restitution, floor.y,
  surface.present, surface.y,
  tankBounds.join(','),
  faunaVersion,                       // bumps when the fauna set changes
  ...residents.map(r => r.genomeHash).sort()
].join('|'))
```

**Every cache key, storage key and validity check uses the triple:**

```
(genomeHash, worldHash, BRIDGE_V)
```

Storage key becomes `record:<genomeHash>:<worldHash>:<bridgeV>`. This corrects
01 §2 C4, which omitted `bridgeVersion`.

A record whose `worldHash` does not match the current world is **invalid, not stale** —
it is rejected and recompiled. There is no partial reuse.

---

## 2. `PairMatchup` — symmetric, both directions

Replaces the one-directional `vs` row in 11 §6. One duel run produces both directions;
recording only the subject's side made the resident→player column unreconstructible.

```js
PairMatchup = {
  aHash, bHash,            // canonical: aHash < bHash, always
  repeats,

  aToB: { pCapture, timeToCapture, energyRate },   // energyRate = work/s for A
  bToA: { pCapture, timeToCapture, energyRate },
  pStalemate,              // shared: neither captured
  engagementRadius         // separation at which the duel began, in metres
}
```

Invariants: `aToB.pCapture + bToA.pCapture + pStalemate = 1` · `timeToCapture` defaults
to `duelDuration` when that direction never won · `energyRate` is per-second, not
per-engagement, so L3 can charge it over an engagement of any length.

### Canonical pair seeding

Corrects 11 §4, whose order-dependent seed contradicted validation test 4.

```js
[lo, hi] = [aHash, bHash].sort()
pairSeed = fnv1a(`${BRIDGE_V}|${worldHash}|${lo}|${hi}|${repeat}`)
```

Which body is placed first, and which is "the subject" for reporting, is derived
*separately* from the seed. A-vs-B and B-vs-A therefore run the identical fights and
merely read them from opposite ends.

---

## 3. `Species` — the canonical L2 → L3 record

Flat. One struct. This is the entire knowledge L3 has of any creature.

```js
Species = {
  // ── identity ───────────────────────────────────────────
  id,                    // dense index into the fauna array
  genomeHash, worldHash, bridgeVersion,
  name, provenance,      // 'shipped' | 'player'

  // ── morphology · measured, S1 ──────────────────────────
  massBase,              // kg, physical body mass
  volume, boundingRadius, longestAxis,
  frontalArea,
  harvestArea,           // = exposed surface area. ONE name. Was 'surfaceArea' in 11.
  reach,
  torsoExposure,
  bodyCount, jointCount, dofCount,

  // ── locomotion · measured, S2 + S3 ─────────────────────
  cruiseSpeed, burstSpeed, burstRatio,
  burstDuration,         // s at burstSpeed before dropping to cruise. MEASURED IN S2.
  turnRate, turnRadius, turnSpeedRatio,     // S3 — REQUIRED, see 30 C1
  cotC0, cotC1,          // power(v) = cotC0·v + cotC1·v³
  basalRate,             // W at rest
  straightness, gaitFrequency,

  // ── disposition · measured S4/S5, or defaulted in slice ─
  pursuitGain, evasionGain,

  // ── ecology thresholds · DERIVED, not measured ─────────
  massMin,               // = 0.5 × massBase   — death
  massReproduce,         // = 2.0 × massBase   — split
  perceptionRadius,      // = min(8 × reach, 0.02 × worldWidth)

  // ── from genome, not measured ──────────────────────────
  trophic, boldness,
  cohesion, separation, alignment, separationRadius,

  // ── matchups · dense over the whole fauna ──────────────
  vs                     // Float32Array, 3 × faunaCount, resolved from PairMatchup:
                         //   [i*3+0] pCapture   (this species → species i)
                         //   [i*3+1] timeToCapture
                         //   [i*3+2] energyRate
                         // self entries are zero. pStalemate is implied.
}
```

### Resolved divergences

| Was | Now |
|---|---|
| `surfaceArea` (11) vs `harvestArea` (12) | **`harvestArea`** everywhere |
| `burstDuration` in 12, absent in 11 | **measured in S2**, present |
| `massMin` / `massReproduce` nowhere produced | **derived here**, §3 formulas |
| `vs` = 5 × residentCount (11) vs 5 × speciesCount (01/12) | **3 × faunaCount, dense.** Assembled by the fauna loader from `PairMatchup` records, not by L2. L2 produces pair records; assembly is a separate, cheap step. |
| nested `CapabilityRecord` (11) vs flat `Species` (01) | **flat** |

### Ecology thresholds — semantics, fixed

`mass` in L3 is **current biomass reserve**, one variable serving as energy, size proxy,
reproduction currency and death threshold.

```
massBase      = measured physical mass
massMin       = 0.5 × massBase      → death
massReproduce = 2.0 × massBase      → split into two agents at massBase
```

Conserved by construction: two children at `massBase` from one parent at `2 × massBase`.

**Explicitly not claimed:** speed, reach and turn rate do **not** scale with current
biomass. They are fixed capabilities from the record. A starving creature is not slower.
Implementing that scaling would be defensible; pretending it happens without implementing
it would not.

---

## 4. L3 capture — engagement, not contact

Corrects 12 §8. Two problems with `pCapture × dt / timeToCapture`: it does not reproduce
`pCapture` over `timeToCapture`, and it applies an engagement-scale probability at
contact scale.

**Semantic decision.** `pCapture` describes an **engagement** — two creatures beginning a
few body lengths apart, both free to act, resolved within `duelDuration`. That is what
the duel measured. L3 must therefore open an engagement at approach range, not roll dice
on touch.

```js
// engagement opens when
dist < engagementRadius = k · (reachA + reachB)      // k = 4, matching the duel mean

// constant hazard, calibrated so P(capture within timeToCapture) = pCapture
lambda = -Math.log(1 - pCapture) / timeToCapture
pTick  = 1 - Math.exp(-lambda * dt)

// while engaged, each tick:
if (rng() < pTick_AtoB) { capture(A, B) }
else if (rng() < pTick_BtoA) { capture(B, A) }
mass[A] -= energyRate_A * dt
mass[B] -= energyRate_B * dt

// engagement closes when captured, or dist > 1.5 × engagementRadius, or duelDuration elapses
```

Guard `pCapture ≥ 0.999` → treat as certain capture at `timeToCapture`; guard
`pCapture = 0` → no hazard, engagement is a pure energy drain.

On capture: `mass[predator] += PREDATION_EFFICIENCY × mass[prey] × trophic[predator]`,
remainder to substrate.

---

## 5. `W1_SLICE` — the complete fixture

Every constant D1 needs. **All values provisional and marked experimental.** They live in
one file and are all visible and editable on the developer panel.

```js
W1_SLICE = {
  id: 'w1', name: 'The Soup', faunaVersion: 1,

  // physics — L1 and L2
  gravity:        9.81,
  mediumDensity:  1.0,
  dragScale:      1.0,
  dragCoefficient:0.9,
  floor:   { present: true, y: -12.0, friction: 0.3, restitution: 0.1 },
  surface: { present: true, y:  12.0 },
  tankBounds: [16, 24, 16],          // m — L1 tank

  // presentation
  phase: 'liquid',

  // ecology — L3
  worldSize:     [200, 200],         // m, torus
  substrateGrid: [64, 64],
  totalMass:     6000,               // kg — THE conserved quantity
  fertility:  { noiseScale: 0.05, noiseContrast: 0.4, seed: 0x5EED },
  diffusionRate: 0.08,               // per tick, cell-to-cell
  HARVEST_RATE:  0.35,               // kg/(m²·s) at full substrate
  PREDATION_EFFICIENCY: 0.6,
  KLEIBER: 0.75,                     // basalRate ∝ mass^KLEIBER
  METABOLIC_SCALE: 0.02,             // W per kg^0.75
  REPRO_COOLDOWN: 20.0,              // s
  MAX_AGE:        600.0,             // s
  dt:             0.1,               // s per L3 tick

  // run
  biomassBudget: 300,                // kg the player may seed
  runDuration:   4000,               // s ≈ 40 000 ticks

  // bridge
  duelRepeats:      3,               // slice value; full is 5
  duelDuration:     15.0,            // s
  engagementK:      4.0,

  // fauna — three residents, stored as genome data at C2
  residents: ['res_a', 'res_b', 'res_c']
}
```

**Provenance of these numbers:** none is derived from theory. They are starting points
chosen for plausible ratios. The audition procedure (12 §13) is what makes them right,
and `noiseContrast` and `totalMass` are the two expected to move.

---

## 6. Pinned dependencies

Frozen before B1. Recorded here so a rebuild is reproducible.

| Dependency | Version | Note |
|---|---|---|
| `@dimforge/rapier3d-compat` | **0.14.0** | pin exact; verify at A0 and record the actual resolved version and integrity hash |
| `three` | **0.169.0** | pin exact |
| Reference: `mycoolfin/the-simsulator` | record commit SHA at A0 | MIT — read for A6 morphogenesis |
| Reference: `jobtalle/PredatorPreySystem` | record commit SHA at A0 | MIT — read for mass conservation |
| Reference: `SebLague/Boids` | record commit SHA at A0 | MIT — read for steering |

**A0 action:** resolve the actual latest stable versions, pin them exactly in
`package.json` with a lockfile committed, and replace the numbers above with what was
actually installed. Do not proceed to B1 with a caret range.

Also at A0: determine whether the Rapier JS build exposes an equivalent to the Rust
`enhanced-determinism` feature. If it does, 01 §5 may be relaxed. Do not assume it will.

---

## 7. Validation of the contract itself

| # | Assertion |
|---|---|
| K1 | Every field in `Species` is written by a named producer: S1, S2, S3, genome, or the derivation in §3. No field is unassigned. |
| K2 | `vs` is dense: `3 × faunaCount`, every pair present, self entries zero. |
| K3 | `PairMatchup` invariant: `aToB.pCapture + bToA.pCapture + pStalemate = 1 ± ε`. |
| K4 | Canonical seeding: compiling A-then-B and B-then-A yields byte-identical `PairMatchup`. |
| K5 | `worldHash` changes when any physical parameter or resident genome changes; does not change otherwise. |
| K6 | A record with a mismatched `worldHash` or `bridgeVersion` is rejected, never partially used. |
| K7 | Hazard calibration: simulating the §4 hazard for `timeToCapture` seconds yields capture frequency `= pCapture ± 0.02` over 10⁴ trials. |
| K8 | Mass conservation holds through reproduction: parent at `2×massBase` → two at `massBase`. |
