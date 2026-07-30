# VIVARIUM — 12 · L3 World Simulation

**Layer 3 of three.** L1 = creature physics (doc 10). L2 = bridge (doc 11).
L3 = the ecosystem in which a compiled creature is introduced and must persist.

| | |
|---|---|
| **Status** | Normative |
| **Renamed R2** | was `VIVARIUM_L3_WORLD_SPEC.md`; old file retained on disk |
| **Revision R3** | §4 species table deferred to **03 Contracts** · §8 predation replaced by engagement-based hazard (03 §4) · constants now read from `w1_slice.js` |
| **Revision R2** | §3 mass-conservation claim corrected · §7 social-behaviour scope restricted for the slice · §11 gravity now constant (02 R2) |
| **Reads** | 00 Vision R2 · 01 Architecture · 02 Worlds R2 · 11 L2 |

**Design rule for this document:** reinvent nothing. Every mechanism below is either
taken from a published paper, taken from an MIT-licensed working implementation, or is a
textbook algorithm. Where a canonical form exists, it is given as code and should be
followed rather than redesigned.

---

## 1. Provenance — read this before implementing anything

| Mechanism | Source | Status |
|---|---|---|
| Eco-evolutionary structure, time scales, sensing constraint, capture rule, frozen-predator methodology | Ito, Pinheiro Saraiva, Suzuki, Arita, *Population and Evolutionary Dynamics based on Predator–Prey Relationships in a 3D Physical Simulation*, **Artificial Life 22(2), MIT Press, 2016** | **Authority.** Do not deviate without reason. |
| Mass conservation via a fertiliser substrate; threshold reproduction; three trophic levels | `jobtalle/PredatorPreySystem` — **MIT, © 2018 Job Talle**. Cloned and read. | **Adopt directly.** Adapted from hex-grid to continuous space. |
| Steering: seek, flee, pursue, evade, wander, separation, cohesion, alignment | Craig Reynolds, *Flocks, Herds and Schools* (1987) and *Steering Behaviors for Autonomous Characters* (1999) | **Canonical.** Reference impl: `SebLague/Boids` (MIT). Implement from the standard formulation; do not invent steering. |
| Uniform spatial hash | Textbook broad-phase | Canonical |
| Lotka–Volterra oscillation | Emergent — **not implemented**. It is an outcome to observe, never a formula in the code. | — |

**The one thing that is genuinely ours:** the capability record and matchup matrix
supplied by L2 replacing the paper's full physics. Everything else is assembly.

---

## 2. Purpose and non-goals

**Purpose.** The player introduces a compiled creature into a world already inhabited by
frozen resident species and finds out whether it persists.

**Non-goals, stated so they are not drifted into:**
- No mutation. Genomes are fixed for the duration of a run. This is what keeps L3 a test harness rather than an open-ended ALife research project, and it is what makes the matchup matrix valid.
- No physics. No collision solving, no joints, no rigid bodies.
- No neural networks, no learning, no training.
- No 3D. The world is 2D. Depth adds cost and nothing else at this level.
- No procedural world generation. Worlds are authored by audition (§13).

---

## 3. The core invariant: mass is conserved

Adopted from `jobtalle/PredatorPreySystem`, whose grid maintains
`totalMass = Σ fertiliser + Σ agent mass` and never creates or destroys it.

This is the single most valuable structural decision available, because a population can
only grow by taking mass from somewhere, and everything it takes returns on death.

**Corrected claim (R2).** Mass conservation **bounds total biomass and makes failure
modes interpretable.** It does *not* make the ecosystem interesting, and it does not
prevent: one species consuming nearly everything · permanent extinction of residents ·
sterile equilibrium · oscillation too fast or too slow to read · spatial deadlock · a
dominant species monopolising the recyclable pool.

What it guarantees is that when those happen, the mass is still accounted for and the
cause is findable. Auditioning (§13) and the three knobs (§11) are still required to
produce dynamics worth watching. The earlier wording — "makes runaway impossible" —
oversold it.

```
TOTAL_MASS = Σ substrate[i] + Σ agentMass[j]     // invariant, asserted every tick
```

Flows:

```
substrate --(harvest)--> autotroph/harvester biomass
biomass   --(predation)--> predator biomass        (with a loss fraction, see below)
biomass   --(metabolism)--> substrate              (continuous)
biomass   --(death)--> substrate                   (whole remaining mass)
```

Predation is **not** lossless: a predator gains `PREDATION_EFFICIENCY × prey.mass`
(default 0.6) and the remainder returns to the substrate at the kill location. This is
what makes trophic levels cost something and keeps predator populations naturally
smaller than prey populations — an ecological pyramid falls out of one constant.

**Assertion:** total mass drift over 10⁵ ticks must be zero to within float epsilon.
This is validation test 1 and it catches nearly every accounting bug.

---

## 4. Data layout

Structure-of-Arrays, typed arrays, fixed capacity, free-list for dead slots. **No
objects per agent. No allocation inside the tick.** This is the difference between
1 000 agents and 10 000.

```js
const CAP = 8192;

const A = {
  // identity
  alive:      new Uint8Array(CAP),
  species:    new Uint8Array(CAP),     // index into species table
  // kinematics
  x:          new Float32Array(CAP),
  y:          new Float32Array(CAP),
  vx:         new Float32Array(CAP),
  vy:         new Float32Array(CAP),
  // state
  mass:       new Float32Array(CAP),   // == energy. one quantity, not two.
  age:        new Float32Array(CAP),
  state:      new Uint8Array(CAP),     // FORAGE|PURSUE|FLEE|REST|SPAWN
  targetIdx:  new Int32Array(CAP),     // -1 = none
  cooldown:   new Float32Array(CAP),
};
```

**Mass and energy are the same variable.** Talle's system does this and it removes an
entire category of bookkeeping. A creature that starves shrinks; a creature that eats
grows; death is `mass < minMass`. One number, three mechanics.

### Species table — see **03 Contracts §3**

**Deferred at R3.** The struct previously stated here diverged from 01 and 11 —
`harvestArea` vs `surfaceArea`, `burstDuration` present in one and not the other,
thresholds nobody produced, and a matrix of disputed shape. The canonical definition is
**03 Contracts §3**, shipped as `/contracts/species.js`. L3 imports it and states nothing.

Two consequences L3 must honour:
- `mass` is **current biomass reserve**. `massMin = 0.5 × massBase`, `massReproduce = 2.0 × massBase`, derived in 03 §3.
- Speed, reach and turn rate are **fixed capabilities** and do not scale with current biomass. A starving creature is not slower.

All numeric constants — `HARVEST_RATE`, `PREDATION_EFFICIENCY`, `REPRO_COOLDOWN`,
`MAX_AGE`, `METABOLIC_SCALE`, `dt` — come from the world fixture (03 §5). None is
hard-coded.

---

## 5. Spatial hash

Uniform grid, cell size = **max perception radius across all species**. Rebuilt every
tick by counting sort — no allocation, no linked lists.

```js
// build (counting sort, two passes, zero allocation)
cellCount.fill(0);
for (let i = 0; i < CAP; i++) if (A.alive[i]) cellCount[cellOf(i)]++;
prefixSum(cellStart, cellCount);              // exclusive prefix sum
cellCursor.set(cellStart);
for (let i = 0; i < CAP; i++) if (A.alive[i]) cellItems[cellCursor[cellOf(i)]++] = i;
```

Query iterates the 3×3 cell neighbourhood. With cell size = perception radius, each
agent examines ~10–30 candidates regardless of population.

---

## 6. Tick pipeline

Fixed `dt = 0.1 s` simulated. Order matters; do not reorder.

```
1  rebuildSpatialHash()
2  for each alive agent:
3      sense()          → nearest prey, nearest threat, local density, flock centroid
4      decideState()    → FORAGE | PURSUE | FLEE | REST | SPAWN
5      steer()          → desired velocity, clamped by turnRate and speed
6      integrate()      → x += vx*dt ; y += vy*dt ; wrap at world bounds (torus)
7      metabolise()     → mass -= (basalRate + cotC0*v + cotC1*v^3) * dt
8  resolveInteractions() → predation rolls, substrate harvest
9  resolveLifecycle()    → reproduction, death, mass return to substrate
10 substrateRegrow()     → diffusion only; no mass created
11 sampleStats()         → populations, mean mass, total mass assertion
```

Note step 7: cost of transport is `cotC0 + cotC1*v²` **per unit distance**, so per unit
*time* it is multiplied by `v`, giving the `v³` term. Getting this wrong makes fast
creatures free.

---

## 7. Steering — Reynolds, unmodified

Implement the standard formulation. Do not invent. Each behaviour returns a desired
velocity; they are weighted, summed, truncated, and then constrained by `turnRate`.

```js
// canonical primitives
seek(pos, target, maxSpeed)      → normalize(target - pos) * maxSpeed
flee(pos, threat, maxSpeed)      → normalize(pos - threat) * maxSpeed
pursue(pos, tPos, tVel, maxSpeed)→ seek(pos, tPos + tVel * predictionTime, maxSpeed)
evade (pos, tPos, tVel, maxSpeed)→ flee(pos, tPos + tVel * predictionTime, maxSpeed)
wander(heading, jitter)          → heading rotated by random walk
separation(neighbours)           → Σ normalize(pos - n.pos) / dist
cohesion(neighbours)             → seek(pos, centroid(neighbours))
alignment(neighbours)            → mean(n.vel) - vel
```

State-dependent weights:

| State | seek/wander | pursue | evade | separation | cohesion | alignment |
|---|---|---|---|---|---|---|
| FORAGE | 1.0 (toward substrate gradient) | — | 0.3 | sep | coh | ali |
| PURSUE | — | pursuitGain | 0.2 | sep | 0 | 0 |
| FLEE | — | — | evasionGain | sep×2 | coh×2 | ali×2 |
| REST | 0.1 | — | 0.5 | sep | coh | ali |

**Turn-rate constraint is what makes the proxy honest.** After summing, rotate the
current velocity toward the desired velocity by at most `turnRate * dt`. A creature that
measured slow-turning in L1 cannot corner sharply here. This single clamp carries more
of the creature's physical identity than any other line in the file.

**Collective behaviour is generated here — and it is a new behaviour layer, not the
recovery of something measured in L1 (00 R2 §5).** Spacing, cohesion, alignment, pursuit
and avoidance need no physical validation and are safe. But the *effectiveness* of group
behaviour depends on physical facts the pairwise duel never tested: whether three bodies
can restrain one, whether a school degrades targeting, whether geometry permits dense
formation, whether several attackers interfere with each other.

**Slice restriction.** In the first world, social parameters affect **spacing, cohesion,
alignment, pursuit and avoidance only.** Bait balls and converging attacks may *appear*
as a consequence of those weights, and that is fine — but no rule may be added that
implies cooperative restraint, coordinated encirclement, or pack tactics. Those are
step F at the earliest, and only after L2 can measure many-on-one.

---

## 8. Feeding

### Substrate (for `trophic < 1`)

```
uptake = harvestArea * substrate[cell] * (1 - trophic) * HARVEST_RATE * dt
uptake = min(uptake, substrate[cell])
mass += uptake ;  substrate[cell] -= uptake
```

### Predation — engagement-based (03 §4)

**Corrected at R3.** `pCapture` was measured as the outcome of an *engagement* beginning
several body lengths apart with both creatures free to act. Applying it as a per-contact
roll would be a different event, and `pCapture × dt / timeToCapture` does not reproduce
`pCapture` over `timeToCapture` in any case.

```js
// engagement opens
dist < engagementRadius = engagementK * (reachA + reachB)      // engagementK = 4

// constant hazard, calibrated
lambda = -Math.log(1 - pCapture) / timeToCapture
pTick  = 1 - Math.exp(-lambda * dt)

// each tick while engaged, both directions, then both pay
mass[a] -= energyRate_a * dt
mass[b] -= energyRate_b * dt

// on capture
gain = PREDATION_EFFICIENCY * mass[prey] * trophic[predator]
mass[predator] += gain
substrate[cellOf(prey)] += mass[prey] - gain
kill(prey)

// engagement closes on capture, or dist > 1.5 * engagementRadius, or duelDuration elapsed
```

Guards: `pCapture ≥ 0.999` → certain capture at `timeToCapture`; `pCapture = 0` → no
hazard, the engagement is a pure energy drain on both parties.

Gate assertion K7 verifies the calibration: simulating the hazard for `timeToCapture`
seconds must yield capture frequency `pCapture ± 0.02` over 10⁴ trials.

---

## 9. Target selection

```
valid prey of A  = B where species[A].trophic > 0.2
                     and massRatio = mass[B]/mass[A] < boldness_A * 2
                     and vs[A][B].pCapture > 0.05
threat to A      = B where vs[B][A].pCapture > 0.15
```

Both derived from the matrix — **no species is declared predator or prey anywhere in the
code.** A creature is prey to whoever can catch it. This is what keeps the trophic
structure emergent rather than typed, and it is why a large "herbivore" can be
genuinely dangerous to attack.

---

## 10. Lifecycle

**Reproduction** (Talle's threshold rule, adapted):

```
if (mass[i] > species.massReproduce && cooldown[i] <= 0) {
    child = spawn(species[i], x + jitter, y + jitter)
    mass[child] = mass[i] * 0.5           // mass split — conserved
    mass[i]     = mass[i] * 0.5
    cooldown[i] = REPRO_COOLDOWN
}
```

Mass splitting rather than mass creation is what preserves the invariant. It also gives
r/K strategy for free: a small cheap species reaches threshold often; a large expensive
one rarely.

**Death:** `mass[i] < species.massMin` or `age[i] > MAX_AGE`. Remaining mass goes to
`substrate[cellOf(i)]`. Slot returns to the free list.

---

## 11. The three knobs that decide whether this works

Everything else is bookkeeping. These three decide between a living ecosystem, a flat
line, and a crash.

**0. Gravity is not among them.** Per 02 R2 §1a, gravity is 9.81 in every world and is
never tuned. L3 is 2D on the XZ plane and does not use it directly; it enters only
through the capability record, which was measured under it.

**1. `perceptionRadius` must be SMALL.** The paper is explicit and it is the most
actionable sentence in it: if creatures detect others at distant locations, prey density
stops affecting predators, because predators always find prey — which destroys the
coupling between population dynamics and everything else. Start at ~2% of world width.
A large perception radius turns a spatial ecosystem into a well-mixed reactor with no
dynamics at all.

**2. Metabolic cost must scale hard with mass.** In the paper's long cycle, prey bodies
shrink when predators are scarce and bulk up when predators are abundant, with a −0.75
correlation between prey population and prey body volume — driven entirely by the
tradeoff between defensive success and the cost of defence. If mass is cheap, big always
wins and there is no cycle. `basalRate ∝ mass^0.75` (Kleiber) is the defensible default.

**3. Separation of time scales.** The paper found prey population changes lead predator
changes by about two generations. Population dynamics must be fast relative to the
player's intervention cycle, or the player cannot perceive cause and effect. Target a
full predator–prey oscillation in roughly 2 000–5 000 ticks so a run shows several.

---

## 12. Verdict

Runs for `T` simulated time units. **Verdict is not a score**, it is a classification —
because maximum population is a failure mode, not a win.

| Verdict | Condition |
|---|---|
| **Extinct** | player population reached 0 |
| **Marginal** | survived, peak population < 10 |
| **Established** | survived, population oscillated within bounds, no resident driven extinct |
| **Boom-and-collapse** | population exceeded 3× seed then fell below 20% |
| **Overrun** | player species drove ≥1 resident extinct (destabilised the world) |
| **Persistent** | survived T, oscillation amplitude stable across the final third, all residents alive |

**Persistent is the win.** Established is a pass. Overrun is explicitly a loss even
though it looks like dominance — this is the answer to "what stops the player designing
an invincible monster." The monster wins every duel, eats everything, and starves.

**Introduction budget:** the player seeds with `BIOMASS_BUDGET` mass units, not a fixed
count. A 10-unit creature gives 50 individuals; a 100-unit creature gives 5. Powerful
designs are numerically fragile by construction, and schooling requires numbers you can
only afford by staying small. One number, one real strategic axis.

---

## 13. Building worlds — audition, don't author

The paper's methodology, adopted directly: they **pre-evolved predators in preliminary
experiments against random prey, then froze successful ones to seed the population**,
evolving only the other species.

Our process:

1. Breed candidate residents in L1 (tank), selecting by eye.
2. Compile them through L2. The residents' mutual matchup matrix is computed once here and shipped with the world.
3. Run L3 with residents only, no player creature. Observe.
4. Keep configurations that persist and oscillate. Discard those that flatline or collapse.
5. That surviving set, plus its matrix and world constants, **is** a world.

**No creature is ever written by hand and no world is balanced by hand.** Content
creation is a session of playing the game with a different objective. This is the
mechanism that prevents the content-authoring burden that normally kills projects of
this shape.

---

## 14. Performance

Target: 2 000 agents at 60 fps on a mid-range phone; 8 000 headless at ≥ 10× realtime.

Budget per agent per tick: ~150 flops + ~20 neighbour examinations. The model above
uses roughly half of that, leaving headroom.

Non-negotiables: typed arrays, zero allocation in the tick, counting-sort spatial hash,
`Math.hypot` avoided in favour of squared distances, rendering as one instanced draw
call or a single 2D canvas pass.

Rendering ≠ simulation rate. Simulate at fixed `dt`; render interpolated at display rate;
allow ×1 / ×10 / ×100 with rendering skipped at high speed.

---

## 15. Validation tests

1. **Mass conservation**: total mass drift = 0 over 10⁵ ticks.
2. **Determinism**: same seed, same species table → identical state hash at tick 10⁵.
3. **Lotka–Volterra signature**: with one harvester and one predator, populations oscillate and prey leads predator by a positive lag. Cross-correlate and assert the lag is > 0. *This is the test that says the ecosystem is real.*
4. **Perception sensitivity**: increasing `perceptionRadius` by 10× measurably reduces oscillation amplitude. Confirms the paper's mechanism is active.
5. **Trophic pyramid**: at equilibrium, predator biomass < harvester biomass < substrate. Falls out of `PREDATION_EFFICIENCY`; assert it.
6. **No-op introduction**: introducing a species with all-zero matchup rows changes resident populations by less than 5%.
7. **Performance**: 2 000 agents, tick time < 8 ms.

---

## 16. Deliberately absent

Three-body physical interaction · terrain and obstacles · within-lifetime learning ·
mutation · day/night and seasons · disease · territory and nesting · sexual
reproduction · body-part damage · any neural network.

Each is a plausible extension. None is needed to test whether the loop works, and every
one of them is a week.
