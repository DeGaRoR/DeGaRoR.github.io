# Design — from locomotion integrity to intent

Supersedes the phase ordering in `ROADMAP.md`. Written after the actuator
investigation (`tools/_zcoh.mjs`, `_zstiff.mjs`, `_zpump.mjs`, `_zdecay.mjs`).

**Organising principle.** Every phase closes exactly one feedback loop, from the
shallowest to the deepest. Nothing here is a feature; everything is an arrow that
does not currently exist.

**Ordering principle.** Phase A finishes locomotion completely before selection
starts. Selecting on a defective actuator breeds exploiters of the defect, and
every genome banked before A is done is a genome tuned to a bug.

| | phase | loop closed |
|---|---|---|
| **A** | locomotion integrity | body → controller |
| **B** | selection and growth | ledger → genome, ledger → morphology |
| **C** | internal state | ledger → controller |
| **D** | chemoreception | world → controller |
| **E+** | conceptual | topology, plasticity, ecology |

---

# Phase A — locomotion integrity

Five chantiers, strictly ordered. **A1 comes first among the substantive ones
because every trajectory-derived number in the repo moves by a factor of ~2–3
when it lands.** Tuning `budgetScale`, `MUSCLE_STRESS` or `Cd` before A1 is
tuning discretisation error.

---

## A0 — instrument repair

**Defect.** `physics.js` accumulates

```js
work += Math.abs(tau * relOmega) * FIXED_DT;
```

The absolute value collapses a signed quantity. Energy the actuator *injects*
and energy it *absorbs* sum identically, so `work` cannot distinguish a creature
swimming efficiently from one being shaken. Cost of transport, the forage ledger
and every A1 measurement rest on this number.

**Change.** Split the accumulator on both the solver and PD paths:

```js
const p = tau * relOmega;            // signed, per joint per step
if (p > 0) workOut += p * FIXED_DT;
else       workAbsorbed -= p * FIXED_DT;
```

Expose `workOut` and `workAbsorbed`; keep `work = workOut + workAbsorbed` so
nothing downstream breaks. **Metabolic cost bills `workOut` only** — an animal
does not eat to be pushed around by the water.

**Carry forward.** The solver path reconstructs `tau` from the configured
spring-damper law and lags by one step; it is exact in steady oscillation and
overstates during transients. That caveat now applies to two numbers.

**Gate.**
- `workOut + workAbsorbed` equals the old `work` to 1e-9 on the frozen corpus.
- On a passively drifting creature (`motorScale: 0`), `workOut ≈ 0`.

---

## A1 — fluid force convergence  ← *the defect under everything*

### The finding

**The simulation is not converged in time, and the error is large.** Refining
`FIXED_DT` from 1/120 to 1/960 reduces path speed monotonically in every
creature measured, by a factor of 3–4.5, with no plateau at 8× refinement:

| creature | 1/120 | 1/240 | 1/480 | 1/960 |
|---|---|---|---|---|
| #0 | 0.773 | 0.495 | 0.502 | 0.321 |
| #2 | 0.880 | 0.737 | 0.423 | 0.322 |
| #3 | 0.606 | 0.452 | 0.237 | 0.202 |
| #5 | 0.456 | 0.332 | 0.161 | 0.141 |
| #6 | 2.18 | 1.44 | 0.818 | 0.482 |
| #7 | 0.483 | 0.276 | 0.286 | 0.122 |

`work` over the same refinement stays flat or *rises* (#7: 5.4e4 → 2.1e5), so
cost of transport is wrong by roughly an order of magnitude, in the direction
that flatters the creatures.

### It is ONE defect, not two

The decisive measurement (`tools/_zdecay2.mjs`): a **passive** creature with
`effort = 0`, kicked to 5 cm/s and left to coast, and an **active** creature
swimming, under the same refinement.

| | median ratio, dt 1/480 ÷ dt 1/120 |
|---|---|
| passive coast distance | **0.414** |
| active swim speed | **0.501** |

**They are the same number.** There is no separate thrust phenomenon. The fluid
force integration is non-convergent and it corrupts drag and thrust identically.
An earlier framing of this as "rectification error unique to oscillating
surfaces" was wrong and should not be carried forward.

The coast half-times scale as roughly `dt^0.5` (e.g. 0.067 s → 0.033 s for a 4×
refinement), which is the signature of accumulating truncation rather than a
per-step scaling bug.

### The minimal reproduction — this is the gift to the implementation team

**No creature, no CPG, no joints, no motor is required.** A single rigid body
given an initial velocity and allowed to decelerate under drag alone reproduces
the defect at full magnitude. Debug it there, in the `_zplate` micro-test
register, and only then re-run the corpus.

### Hypotheses ruled out — do not re-investigate these

Each was tested and eliminated. Recorded so the work is not repeated.

| hypothesis | test | result |
|---|---|---|
| torque budget / saturation | `budgetScale` 1 → 24 | saturation → **0.000**, KE runaway unchanged or worse |
| added mass | `addedMass: false` | ratio 0.475 vs baseline 0.554 |
| the torque bound | `boundTorque: false` | ratio 0.444 |
| motor strength | `motorScale × 0.25` | ratio 0.479 |
| the implicit solver spring | solver vs `motor: 'pd'` | 0.554 vs 0.544 — **both drive paths equally affected** |
| the fluid energy/momentum guard | instrumented `sc`, coast at 0.5 / 2 / 5 cm/s, both dt | mean `sc` = **1.000**, bind = **0.0%** at every speed |

The guard result matters: `sc = min(1, -2P/(dt·Q))` has `dt` in the denominator
and looked like an obvious dt-dependent throttle. It is **inert** in every
regime the creatures actually occupy. It is not the bug.

### The mechanism — narrowed by elimination to one remaining term

Five candidate mechanisms were built and measured. Four are **disproven**. Each
is recorded with its number so nobody spends a day re-deriving it.

**Disproven 1 — the fluid law injects energy.** It does not. Logging the force
actually applied against the velocity it was computed from, on the real
unmodified plan (`tools/_zforce.mjs`): **0 of 40 steps have positive fluid
power.** `F·v < 0` at every step, `sc = 1.000` throughout. The law is strictly
dissipative in the discrete step, not just in theory.

*This permanently retires the "exploding creatures are fed by drag" theory.*

**Disproven 2 — explicit integration of quadratic drag on the body.** A
semi-implicit `1/(1 + λ·dt)` correction on the velocity-opposing component,
implemented at the `addForce` site: passive coast ratio **0.622 → 0.623**. A
no-op, because per-step traces give **λ_body·dt ≈ 0.11** — the body-scale drag
integration sits well inside its stability limit.

**Disproven 3 — the fluid energy/momentum guard.** `sc = min(1, -2P/(dt·Q))` has
`dt` in the denominator and looks damning. Instrumented: mean `sc` = **1.000**,
bind **0.0%**, at coast speeds 0.5 / 2 / 20 cm/s and both timesteps.

**Disproven 4 — joint solver convergence.** The natural instinct, given the
4 → 8 `SOLVER_ITERATIONS` precedent. Raising iterations at fixed `dt = 1/120`:

| iterations | 8 | 16 | 32 | 64 | 128 |
|---|---|---|---|---|---|
| ratio to the `dt=1/480` answer | 2.50 | 2.14 | 2.17 | 2.09 | 2.85 |

No trend toward 1 across a 16× increase. **Do not bump iterations again.**
Related and already established: solver vs explicit PD drive gives 0.554 vs
0.544 — both paths equally affected, so the implicit motor spring is not it
either.

**Remaining — fluid force sampling rate against limb speed.** The fluid force is
evaluated **once per step**, per quadrature sample, from the *local* velocity
`v + ω × r`. Every individual sample is dissipative (Disproven 1), but thrust is
not a fluid-power quantity — it is net momentum transfer, and it depends on how
finely the correlation between surface motion and force is sampled across the
step. Refining `dt` refines that sampling.

Corroboration, `tools/_zomega.mjs` — slow the CPG and the dt-sensitivity must
shrink if this is the term:

| gait speed | fine/coarse speed ratio |
|---|---|
| ×1 | 0.562 |
| ×0.25 | **0.714** |

Moves toward 1 as predicted. Two points at n=5 — directional, not conclusive.

This is now the *only* remaining term `dt` touches. That is an argument from
elimination, and it is the strongest claim the evidence supports. **Two prior
mechanisms in this section were stated confidently and were wrong; treat this
one as the leading candidate, not as established.**

### The next experiment — do this before building anything

Substep the fluid force alone, leaving the solver and motor at `FIXED_DT`. In
`applyEnvironment`, evaluate the quadrature at `n` sub-samples across the step by
advancing `v`, `ω` and the body rotation ballistically, and apply the averaged
impulse. Then:

> **If `n = 4` at `dt = 1/120` reproduces the `dt = 1/480` speed to within 10%,
> the mechanism is confirmed and the fix is the substep.**

That single comparison settles it. If it fails, the mechanism is wrong too and
the elimination list has a gap — say so and stop, rather than proposing a sixth.

Cost note before committing: the quadrature is already 96 samples per body, so
`n = 4` is a 4× hot-loop cost. Set `n` adaptively from a local Courant number
rather than as a constant, and measure the frame budget on the largest corpus
body plan.

### Gate — a convergence gate, not a tuning target

> **Path speed at `dt/4` within 10% of path speed at `dt`, on ≥ 90% of a
> 16-creature corpus.** Plus the same criterion on passive coast distance for a
> single free body.

`tools/_zconv.mjs` and `tools/_zdecay2.mjs` are the harnesses; keep both as
permanent regression checks against any future fluid-model change.

### Consequences to plan for

- **Cruise speeds will fall by roughly 3×.** This is a correction, not a
  regression.
- **`FOOD_ENERGY` needs its largest recalibration yet.** Do it once, at the end
  of Phase A.
- **Every trajectory-derived figure in the repo must be re-measured**: cruise
  speed, cost of transport, the "68×" fluid finding, duel closing rates, forage
  `eaten`, and the interpretation of the 0.347 tracking gain. `_zplate`'s force
  micro-tests measure forces directly and survive; anything derived from a
  *trajectory* does not.
- **The "exploding creatures" are not a separate bug.** Energy enters every step
  in every creature; some geometries accumulate it more efficiently and run
  away. That is why every clamp only delayed the failure — the clamps bound a
  symptom whose source is in the integrator. Expect the runaway subset (5 of 16
  at 300 s) to shrink or vanish when A1 lands, and re-measure before opening any
  separate stability chantier.

---

## A2 — positional phase gradient

**Defect.** `factory.js:343`

```js
phaseLag: uniform(rng, RANGE.phaseLag)
```

Independent uniform draws per node, which `controller.js:58` then accumulates
along the tree. **Phase along a chain is therefore a random walk, not a
gradient.** A travelling wave needs a roughly constant lag per segment.

Measured: commanded inter-joint coherence is **0.615 and flat over 300 s**. The
controller is perfectly stable and was never asking for a coordinated wave.
Achieved coherence is 0.43–0.48, so the servo delivers ~75% of a command that
was itself 60% coherent.

This is independent of A1 — commanded coherence is dt-invariant (measured ratio
exactly 1.000) — but its *benefit* cannot be measured until A1 lands.

**Change.** `phaseLag` becomes derived. Add to the genome's `controller` block:

```js
phaseBase:  float,   // rad, lag at depth 0
phaseSlope: float,   // rad per segment
```

and reinterpret the per-node gene as a **deviation**:

```
lag_j = phaseBase + phaseSlope * depth(j) + deviation_j
```

`depth(j)` is the number of joints between `j` and the root. Branched bodies get
one gradient per branch from the same coefficients, which is correct — each limb
has its own proximodistal axis.

**Migration must be bit-identical.** Set `phaseBase = 0`, `phaseSlope = 0`,
`deviation_j = phaseLag_j`. Behaviour unchanged to the bit; the coefficients are
neutral at insertion and only mutation moves them.

**Factory.** New genomes draw `phaseBase`/`phaseSlope` from the gradient ranges
and `deviation_j` from a narrow distribution (suggest σ ≈ 0.1 × `RANGE.phaseLag`),
with a correspondingly narrow mutation sigma — so selection can break the wave
where a body needs asymmetry, but not by default.

**Deferred, optional (A2b).** `amplitude` and `freqMult` have the same defect;
real segmented swimmers show a proximodistal amplitude envelope. Same
three-coefficient treatment. Not on the critical path.

**Gate.**
- Migrated genomes reproduce pre-migration traces to the bit.
- Commanded coherence ≥ 0.90 on a fresh corpus, n ≥ 16 (from 0.615).
- The `phaseSlope` mutation operator fires at a measured non-zero rate over 1000
  mutations.

**Expect** effective body-plan variety to drop — some of the current 337 plans
were distinct only by phase noise. Re-measure and record.

---

## A3 — actuator budget

**Established.** Saturation is real and progressive — corpus median fraction of
joint-steps hitting the error clamp rises across 30 s windows over 300 s:

| 30 s | 90 s | 150 s | 210 s | 300 s |
|---|---|---|---|---|
| 0.018 | 0.032 | 0.068 | 0.124 | 0.129 |

**Also established:** the budget is not the cause of the instability. At
`budgetScale: 12` saturation reaches exactly 0.000 and the energy accumulation
does not improve. Raise the budget to remove the clamp; expect nothing else
from it. A1 owns the instability.

**Change.** Sweep `budgetScale` and `MUSCLE_STRESS` against the post-A1, post-A2
corpus and take the smallest value giving saturation < 0.02 at 300 s.
`MUSCLE_STRESS` reads as 20 Pa against real muscle's 1e4–1e6 Pa and is scheduled
to become `2e6`; this chantier does it, together with `gravity → 981`, since both
change the same force balance and should move once.

**Gate.**
- Saturation < 0.02 at 300 s, corpus median.
- Achieved coherence ≥ 0.85 × commanded (with A2 landed, ≥ 0.77 absolute).
- Achieved inter-joint lag within 15% of commanded, from ~0–3° regardless of
  command.
- Heading rate at `turnBias 0.8` ≥ 5 °/s, from ~0.2. **No steering code is
  written here.** The wire exists — `sensorTurnBias` → `turnBias` → `turnSides`
  → per-joint bias. Orientation is an actuator symptom.

---

## A4 — proprioception

**Defect.** The CPG is a pure function of `(genome, t)`. It receives nothing from
the body, so when a joint fails to reach its commanded angle the oscillator
marches on and the phase relation between command and body drifts freely. Real
spinal CPGs are *entrained* by stretch receptors — the rhythm recalibrates
against the body actually executing it, which is why a lamprey's gait survives
load, damage and morphological variation.

**This is the first stateful element in Vivarioops.** After A4 the controller is
no longer a pure function of the genome and the clock.

**Change.** Replace the fixed `phases[]` plus global `t` with a per-joint phase
advanced each step:

```
φ_j += ω_j · dt + K · sin(φ̂_j − φ_j) · dt
```

with `φ̂_j` estimated from the joint's actual state:

```
φ̂_j = atan2( relOmega_j / (ω_j · A_j · range_j),  (θ_j − bias_j) / (A_j · range_j) )
```

`K` is a genetic gain on the `controller` block. **`K = 0` reproduces A3
behaviour to the bit** — same neutral-insertion discipline: migration sets
`K = 0`, the operator must exist and be shown to fire, and expression is billed
to `workOut`.

Inter-joint coupling is unchanged: `φ_j` still inherits from its parent through
the A2 gradient. Sensory feedback modulates each joint's own phase; it does not
replace the gradient.

**Numerical care.** `A_j · range_j` sits in a denominator and can be near zero
for a nearly-inert joint. Floor it and fall back to open loop (`φ̂ = φ`) below
the floor — same class of guard as `LATERAL_EPS`.

**Gate.**
- `K = 0` is bit-identical to A3.
- Under a ±30% load perturbation that visibly breaks the open-loop CPG, gait
  period returns within 10% of nominal in under 5 s.
- Achieved coherence ≥ 0.90 × commanded, up from A3's 0.85.
- Cross-body transfer: a controller genome scored on a morphology it did not
  evolve with loses less speed at `K > 0` than at `K = 0`, n ≥ 16.

**Not evolvable-as-organ.** Proprioception is plumbing. Its absence is a defect,
not a design space, and a lineage "discovering" that its muscles have stretch
receptors is not a watchable event. `K` is a tunable gene; the receptor is always
present.

---

## Phase A exit criteria

Do not begin Phase B until all of the following hold on a fresh corpus, n ≥ 16.

| | metric | target | current |
|---|---|---|---|
| A0 | `workOut` on a passive drifter | ≈ 0 | not measurable |
| **A1** | **path speed at `dt/4` vs `dt`** | **within 10%, ≥ 90% of corpus** | **~0.50 ratio, 0% pass** |
| A1 | passive coast distance at `dt/4` | within 10% | 0.414 ratio |
| A2 | commanded coherence | ≥ 0.90 | 0.615 |
| A3 | saturation at 300 s | < 0.02 | 0.129 |
| A3 | heading rate at bias 0.8 | ≥ 5 °/s | ~0.2 |
| A4 | achieved / commanded coherence | ≥ 0.90 | ~0.75 |
| — | slip | > 0.10 | 0.00–0.05 |
| — | late-window KE ratio in [0.8, 1.25] | ≥ 90% of corpus | ~69% |

The last row is a *watch* item, not a chantier. Re-measure it after A1 before
deciding whether it still needs its own work.

Then recalibrate `FOOD_ENERGY` once, re-measure every trajectory-derived figure
in the repo, and freeze the corpus to the Atlas as founding stock for Phase B.

---

## Tooling added by the investigation

| tool | question it answers | keep as |
|---|---|---|
| `_zconv.mjs` | does path speed converge in `dt`? | **permanent gate** |
| `_zdecay2.mjs` | passive drag vs active thrust under refinement | **permanent gate** |
| `_zcoh.mjs` | commanded vs achieved inter-joint coherence | **permanent gate** |
| `_zdt.mjs` | per-creature numerical vs model classification | diagnostic |
| `_zarm.mjs` | which force term is dt-sensitive | diagnostic |
| `_zfluid.mjs` | is it body motion or thrust? | diagnostic |
| `_zguard.mjs`, `_zguard2.mjs` | does the fluid guard bind? | **negative result, archived** |
| `_zstiff.mjs` | does raising the budget fix instability? | **negative result, archived** |
| `_zpump.mjs`, `_zdecay.mjs` | signed actuator power, tracking over time | diagnostic |

Archive the negative results rather than deleting them. *A retired finding can
un-retire* — C6.1 already proved that once in this repo.

# Phase B — selection and growth

## B1 — truncation selection, uniform depleting field

No explicit demography. Reuse the existing `breed` path: score, keep the top
fraction, breed, repeat. This is elevage rather than natural selection and the
document should say so; it becomes natural selection at D when the ledger starts
killing.

**Score solo, not in the shared tank.** Six creatures on one depleting field
makes fitness frequency-dependent — a score depends on who else was drawn — which
adds variance exactly where a 30% effect is being measured. Solo trials are
deterministic and reproducible. Keep `_zcast` as the thing that is *watched*;
select on solo runs.

**Population.** Six visible; 24 in the ledger across four headless tanks. At 35×
a 300 s trial costs ~9 s, so a generation is under a minute.

**Random immigrants** 10–20% per generation. Beyond that, noise outruns selection.

**Absolute-threshold readout.** Report each generation how many creatures reach
`in/out > 1`. Rank selection always keeps a population alive even when every
member is starving, so it will breed a lineage of failures and show a rising
curve. This single number says whether the world is survivable at all, and it is
the calibration D depends on.

**Gate.** Lineage cost of transport (on `workOut`) improves ≥ 30% over 20
generations against a random-selection control arm, on ≥ 3 seeds. The L2-19
precedent is explicit: n=8 over 2 generations is a coin flip that passed on luck.

## B2 — growth by moulting

**Why moulting rather than continuous growth.** Rapier impulse joints are
immutable and `makeJointData` bakes anchors from the plan at spawn
(`a1 = qrot(parent.rotation, j.anchor)`), so any dimensional change requires
destroying and recreating every joint. Arthropods grow in discrete jumps at a
threshold. The biology hands us the discretisation that makes the implementation
cheap: once every ~30 s, not every frame.

**Enablers already present.** Bodies are plain cuboids;
`recomputeMassPropertiesFromColliders()` is already called (line 616, from the
added-mass work — Rapier defers the merge and reads before the first `step()` are
stale); `morphogen` already builds dims from the genome, so scale is a parameter
rather than a rewrite.

**Change.**
1. `plan` parameterised by a scale factor.
2. `remould(sim, scale)`: capture positions, velocities and phase state →
   destroy joints and colliders → rebuild at new dims → restore.
3. Growth rule in the ledger, threshold-triggered on surplus.
4. Metabolism scales as `mass^0.75` (Kleiber) rather than linearly. This is the
   central size trade-off in biology and is currently absent.
5. Mesh rebuild in `render/creature.js` and `render/thumbnail.js`.

**Four things that will bite.**

- **Determinism.** The gate pins exact traces. The moult must fire at a
  bit-exact threshold or L1 assertions go red intermittently — the worst
  failure mode available.
- **`fitsTank`.** Creatures can now outgrow the tank. Needs an explicit rule;
  note that growing the tank previously grew the *creatures* (`fitsTank` admits
  reach 12.1 where it capped at 5.5), so this is not solved by a bigger tank.
- **The taxonomy.** The binomial derives deterministically from morphology. A
  creature that changes shape would rename itself mid-life. **Decide before
  writing code: the name derives from the genome's target adult form, not from
  current dims.**
- **`FOOD_ENERGY` recalibrates again** — mass changes, so drag, buoyancy, added
  mass and `workOut` all change. Fifth recalibration; expected.

**Gate.** Determinism across a moult. Growth curve monotone in cumulative
surplus. A moult is visible on the forage screen without reading a number.

**Why it is here and not later.** Nothing currently changes during a life, so
watching one creature for 300 s has no narrative. Size tracking energy is the
cheapest way to make the forage screen legible: who is winning becomes visible
without a chart.

---

# Phase C — internal state

**Change.** Satiety enters the perceptron as an input; **`effort` becomes an
output.** This is the important half. The only current output is `turnBias`, and
steering is meaningless on a field with no spatial structure — hunger must
modulate how hard the creature swims, not where it points.

Network goes from 2-in/1-out to 3-in/2-out. That is also the "widen before
complexifying" precondition E1 needs, obtained for free.

**Why the uniform tank is not behaviourally empty.** The field starts uniform but
a feeding creature creates a void around itself, so **depletion manufactures
patchiness**. The adaptive policy becomes: feed until local intake falls, then
relocate. That is klinokinesis — *E. coli* run-and-tumble, temporal differencing,
no bearing required. It is the most intelligent behaviour available in a world
with no spatial information, and it is visible: creatures that stop, feed out a
patch, and move on.

**Gate.** |r| > 0.5 between satiety and effort in an evolved lineage. Survival
advantage over a B-lineage under intermittent food supply, ≥ 3 seeds.

---

# Phase D — chemoreception and the concentrated food tank

Organ and world ship together. A receptor in a uniform world is pure cost and
will be correctly pruned; a patchy world without a receptor is just a harder
uniform world.

**Change.**
- `foodBearing` and `foodDistance` computed per creature. `senseOpponent` in
  `duel.js` is the pattern; it currently serves duels only.
- **Wire `turnBias` in `forage.js:503`**, which today hardcodes `turnBias: 0`.
  The single line that makes the only screen with food the only screen without
  senses.
- Receptor count and placement as genes, in the same shape the mouth needs
  (`mouthsOf()` is derived, one mouth on the root body's leading face; it should
  be genetic and only that function changes).
- **Neutral insertion**: gain 0, expression off, behaviour bit-identical at birth.
- **Metabolic cost on expression**, billed to `workOut`.
- Dedicated mutation operator **and a test that it fires**.
- Patchy food generator with tunable patch radius and void fraction.

**One receptor gives klinokinesis** (temporal differencing only — the *E. coli*
strategy C already selects for). **Two spatially separated receptors give
tropotaxis** — instantaneous gradient, direct steering, flatworm grade. Start
lineages at one and let the second be discovered; that mutation is a real
evolutionary transition and it is watchable as an abrupt behavioural change.

`reflectX/Y/Z` already exists on connections, so bilateral receptor placement is
expressible. But `SLICE_LIMITS` caps reflection axes at 1 and most factory
genomes set none — the lateral-offset fallback in `turnSides` is the common case,
not the exception. **Verify before D that mirrored receptor pairs are reachable
by mutation**, or tropotaxis is unreachable regardless of controller.

**Gate.**
- Control-subtracted forage score > 0: same genome, same seed, sensor on vs off.
  *This quantity cannot be computed today* — the objective measures "food found",
  not "foraging skill", and subtraction needs a behaviour to disable. D is what
  makes the objective honest.
- The control arm is a **Phase C lineage**, not a naive creature. A sensor that
  beats a competent klinokinetic forager is evidence; one that beats a random
  walker proves very little.
- **Regression gate.** Receptor expression frequency rises over 30 generations in
  the patchy world **and falls in the uniform world.** A lineage going blind
  again — cave fish — is the single most convincing result on this roadmap,
  precisely because it cannot be rigged.

---

# Phase E and beyond — conceptual

Not specified. Sequence and rationale only.

## E1 — evolvable topology

NEAT-style complexification, but **widen before complexifying**. By end of D the
network is ~4-in/2-out; target ~10-in/3-out (distance, joint load, own speed,
satiety in; `turnBias`, `effort`, `omega` out) before adding hidden structure.
Topology search on a narrow map has nowhere to go.

Three costs, all non-optional: **innovation numbers** so crossover survives
differing topologies — the same lesson `jointGenes` already paid for by being
keyed on `nodeId` rather than array index; **speciation**, without which new
structure is culled before it can be tuned and the gate reads zero hidden nodes
and looks like a bug; **per-node metabolic cost**, without which networks bloat.

The single structural mutation worth prioritising is **recurrence**, not depth.
Depth adds nonlinearity; a self-connection adds *state* — memory, hysteresis,
internal modes. It is the difference between a creature that reacts and one that
is in a state of doing something.

Expect modest quantitative gains. The literature is honest about this:
complexification improves scores, it rarely produces categorically new behaviour.
Qualitative jumps come from new sensors, new selective regimes, and coevolution.

## E2 — lifetime plasticity, and the Baldwin arc

The deepest loop: ledger → weights. **Three-factor Hebbian with eligibility
traces** rather than backprop — local synapses accumulate recent activity, a
global reward pulse gates the update, twenty lines, runs online at frame rate.
Chosen partly *because* its credit assignment is temporally sloppy, so
superstition emerges as a property of the algorithm rather than as authored
content.

**Architectural rule that makes it Baldwinian rather than Lamarckian:** the
genome encodes `W₀`, learning modifies `W`, and **at death `W` is discarded**.
Only `W₀` is inherited. That discard is the Weismann barrier. Lamarckian
inheritance is faster as pure optimisation and destroys the phenomenon — after a
few generations everything is born competent and there is nothing to watch.

**Learning must be costly**, or it shields the genome from selection: a bad `W₀`
gets rescued every lifetime, no gradient favours good `W₀`, and plasticity is
retained forever. This is a documented failure mode. Exploration noise burns
energy; juveniles that have not converged forage badly.

**Environmental drift rate is the dial.** Slow drift → assimilation → animals
born knowing. Fast drift → permanent plasticity → animals born curious. Same
code, two civilisations.

**Instrumentation: the innate probe.** At birth, fork the creature and run a copy
with learning disabled. Innate score climbing across generations is the Baldwin
effect; the gap between innate and learned closing is genetic assimilation. The
visible version needs no chart: watch the newborns, not the adults.

## E3 — social learning

Nothing inherited; offspring learns by watching the parent. Gives traditions —
arbitrary local behaviours persisting across generations and differing between
lineages — and also drift and bad habits propagating. Requires creature-creature
perception, so it follows E4.

## E4 — ecology

Six creatures depleting one shared field is already exploitative competition —
real ecology in the technical sense, with zero interaction code, available from B
onward. Interference competition, predation and duels are a separate and much
later project, and `duel.js` should not be revisited until A3 has delivered
orientation.

---

# Standing rules

1. Recalibrate `FOOD_ENERGY` whenever `forageStep`, trial length, metabolic cost
   or body mass changes — and say so in the constant. It has been recalibrated
   three times already; it is calibrated, not derived, and that is fine as long
   as it is labelled.
2. Every new gene needs a mutation operator **and** a test that the operator
   actually fires. The `preyGain` precedent: the gene existed, mutation never
   reached it, and the whole corpus measured zero.
3. Every organ: **neutral at insertion** (bit-identical behaviour), **metered on
   expression** (billed to `workOut`).
4. Freeze each phase's evolved population to the Atlas before starting the next.
   Evolution accumulates across sessions; it never restarts.
5. A retired finding can un-retire. Retire on evidence; re-check on change.
6. A knob that delays a failure has not explained it.
