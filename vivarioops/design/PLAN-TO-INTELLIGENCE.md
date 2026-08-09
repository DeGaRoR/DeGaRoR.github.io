# Vivarioops — plan from here to intelligent behaviour

Supersedes `../planLocomotion/DESIGN-LOCOMOTION-TO-INTENT.md`, whose Phase A is
complete. Reconciled with `../ROADMAP.md` §5b, the 2026-08-07 symmetry discussion,
the land-creatures analysis, and an independent biological review.

**Organising principle.** Every phase closes one feedback loop or encodes one
physical law. Nothing here is a shape, a proportion, or a behaviour that someone
drew. Where a phase imposes something rather than deriving it, it says so.

**Discipline, and this document's first revision paid for it.** The previous draft
carried a measured baseline that **did not reproduce** from the scripts shipped
alongside it, and built two of its opening rungs on claims the source contradicts.
So the rule is now stronger than "nothing enters without a number":

> **A number enters this plan only with the script that produced it, the `n`, and a
> re-run. A number that has not been reproduced is not a measurement, it is a
> memory.**

Every figure below was re-measured on 2026-08-08 against a clean tree at `30a36f5`,
`GATE GREEN` (114 assertions, 106 passed, 0 failed, 5808 checks).

---

## Measured baseline

Sources: `_zmorph.mjs` / `_ztopo.mjs` (morphogenesis only, no physics, n=120),
`_zunits.mjs` / `_zst.mjs` (n=10/12, filtered `jointCount>=3`), inline censuses
(n as stated). **The two corpora differ — do not read across the blocks.**

### Morphology — `_zmorph.mjs`, n=120, deterministic (re-run twice, identical)

| | p10 | p50 | p90 | reference |
|---|---|---|---|---|
| body aspect ratio (per body) | 1.50 | **3.67** | **11.96** | p90 is a splinter |
| scale anisotropy per connection | 1.22 | **1.75** | 2.94 | 1.0 = proportion preserved |
| \|position\| on parent face | 0.63 | **0.99** | 1.24 | 0 = centre, 1.41 = corner |
| min half-thickness (cm) | 0.092 | **0.232** | 0.480 | O₂ diffusion depth ~0.1 |
| surface / volume (1/cm) | 4.44 | 8.14 | 17.2 | — |
| bodies per creature | 4 | 7 | 22 | cap 24 |

Symmetry present in **100%** of creatures and **75%** of connections. Parent–child
OBB overlap in **997/997 = 100%** of pairs. Topology depth p50 **2**, **max 8**
(`_ztopo`, recomputed from joints). Root branching p50 2.

### Viability — inline, n=400 draws, full tally

**Acceptance 37.3%.** Rejections: **`mass` 26.8%**, **`inert` 25.0%**,
interpenetration 9.3%, oversizeTank 1.8%, bodies/oversizeSpec/diverged 0%.

**All 107 mass rejections are TOO HEAVY; none are too light.** Median rejected mass
**98.1 g** against `maxMass = 40`, and mass over all draws runs p10 3.69 / p50 16.43
/ **p90 111.18 g**. So `minMass` never fires and the cap fires on a quarter of the
corpus: **the grammar reaches sizes the viability window does not admit.**

> **Prediction, not a conclusion.** Anisotropy is p50 **1.75 per connection** and
> compounds down chains reaching tree depth 8, so volume runs away
> multiplicatively. **If Phase 1′.1's taper gradient lands, the upper mass tail
> should shrink and acceptance should rise as a side effect.** If it does not, this
> diagnosis is wrong and the cap is what to revisit. Recorded so the taper work has
> a falsifiable secondary outcome.

> `factory.js:27` records 57–62%. **That is not a comparable baseline** — it comes
> from `tools/_zrecur.mjs`, which self-describes as THROWAWAY, checks viability on
> only `VIA = 60` of its draws, and exists to sweep `maxRecursion`. **"Acceptance
> has regressed" is not established.**

### Locomotion — `_zunits.mjs`, n=30 (277 joints), REPAIRED and re-run

*The first version of this row block was measured through `_zphlog.js`, a fork
100 lines behind with no `advancePhases`/`PHASE_COUPLE`, using a muscle-budget
formula that was not the one physics uses. Both fixed 2026-08-08; `_zphlog.js`
deleted and its FLOG hook moved into `physics.js` behind an off-by-default flag.*

| | p10 | p50 | p90 | reference |
|---|---|---|---|---|
| body length (cm) | 4.95 | 7.00 | 11.9 | real animal scale ✓ |
| mass, incl. added mass (g) | 5.35 | 18.5 | 44.7 | ✓ |
| Reynolds number | 16.2 | **185** | 1.33e3 | const-Cd law wants >1e3 — **intermediate Re** |
| body-lengths / s | 0.004 | **0.056** | 0.125 | real fish 1–10 |
| motor clamp saturation | 0.00 | **0.003** | 0.084 | **not 0.000** — see Phase 1.3 |

**Muscle, against both loads. Neither number alone is the answer.**

| | p10 | p50 | p90 |
|---|---|---|---|
| muscle ceiling / joint (dyn·cm) | 44.3 | 160 | 503 |
| **ratio muscle / water drag** | 70 | **2.08e3** | 3.03e5 |
| torque to hold own limb at g=981 (dyn·cm) | 40.8 | 1.02e3 | 1.23e4 |
| **ratio muscle / weight** | 0.0065 | **0.098** | 0.725 |

**Joints that can hold their own distal limb: 6.9% at `MUSCLE_STRESS` 200 → 100% at
2e6.** Muscle is ~2000× stronger than swimming needs and ~10× weaker than standing
needs. Both are true, of different loads, and **quoting either alone is how this
argument gets retired and re-opened every few sessions.**

### Steering — inline S3 census, `S3_BIAS = 1`, both directions

| random corpus, n=20 | p10 | p50 | p90 |
|---|---|---|---|
| yaw `turnRate` °/s | 0.20 | 1.20 | 3.10 |
| `turnRate3d` °/s | 0.80 | **1.57** | 4.31 |
| `steeringAuthority` | 0.123 | **0.668** | 0.995 |

| authored | r(+bias) | r(−bias) | `turnRate3d` | authority |
|---|---|---|---|---|
| **eel-unison** | +22.50 | −22.50 | **15.95 °/s** | **1.000** |
| eel-slow | 22.50 | −0.00 | 6.98 | 1.000 |
| staircase | 8.35 | 4.00 | 5.54 | 0.823 |
| eel-fast | 0.00 | −0.00 | 1.09 | **1.000** |
| eel | 45.00 | 0.00 | 1.85 | **0.000** |
| eel-finned | 0.00 | −0.00 | 1.78 | 0.000 |

**`eel-fast` is the case that indicts the yaw probe**: zero yaw response in both
directions, a real and fully-reversing 3-D one. `contracts/species.js:75` clamps
**all L3 steering** by that yaw field.

### Taxis — `tools/_zlight.mjs`, n=7 × 5 placements × 2 arms

| arm | mean control-subtracted closing | helped |
|---|---|---|
| as shipped | **+0.0109** | **1 / 7** |
| torque bound lifted | −0.0006 | 1 / 7 |

**Light-following still fails after Phase A.** But the declared secondary is the
finding: **corr(score, `turnRate3d`) = 0.91**, corr(score, `steeringAuthority`) 0.31,
**corr(score, |sensor gain|) = 0.07**. The only creature helped is **eel-unison**
(15.9 °/s, authority 1.000, +0.091); `eel` and `eel-finned` return
`live == zeroed == 3.000` exactly.

> **Taxis is driven by turn rate and essentially nothing else.** The threshold sits
> near **14 °/s**; the corpus sits at **1.57 °/s**. A 9× gap, inside a body-plan
> space that demonstrably contains the answer.

### Strouhal — estimator REPAIRED, and the real gap is much larger than believed

The original `_zst.mjs` reported St p50 0.752, then 0.460 on re-run, and neither was
a gait number: it took the tail offset as world-frame `t.z − r.z` while its comment
claimed the root frame, so with heading persistence −0.22 (`physics.js:1669`) body
reorientation appeared as tail motion. Caught by the check the script computed at
line 44 and threw away.

| ratio f_measured / f_commanded | p10 | p50 | p90 |
|---|---|---|---|
| before (world frame, max−min over 40 s) | 0.034 | **0.263** | 0.877 |
| **after** (root frame via `qrot`, PCA beat axis, per-beat amplitude, 5 s warm-up discarded) | 0.653 | **1.01** | 2.04 |

**The estimator now recovers the commanded tailbeat.** With it working (n=12):

| | p10 | p50 | p90 | reference |
|---|---|---|---|---|
| **slip U/(f·A)** | 0.223 | **0.594** | 2.63 | **`ROADMAP` §3 wants 0.5–0.8 — this is now IN BAND** |
| **Strouhal f·A/U** | 0.380 | **~1.7–3.2** | 4.48 | efficient swimmers **0.2–0.4** |

Two consequences, and they point opposite ways:

- **Slip is fixed.** `ROADMAP` §3 recorded slip at 0.00–0.05 against a target of
  0.5–0.8. It now measures **0.594**. Phase A did that, and nothing had measured it.
- **Strouhal is far worse than the retracted number claimed.** Not 0.75 but roughly
  **2–3**, i.e. **5–8× above** the efficient band rather than 2×. The creatures beat
  much harder relative to their travel than this plan previously believed.

*(St and slip are exact reciprocals per creature; both are printed because they are
compared against two different literatures, not because they are two findings. The
percentile spread between them is the `pc()` index on even n, not physics.)*

---

## Where the project actually stands

**Locomotion works and B3/B4/B5 are signed.** Signature gaits, convergence gate
green.

**But the biological illusion is one layer ahead of the biological reality.** The
organism mechanics are sophisticated while perception, energetics, reproduction and
ecology still contain external scaffolding. Concretely:

- **`engine/l3/` contains only `.gitkeep`**, while `w1_slice.js:127-187` already
  specifies `substrateGrid`, `fertility`, `diffusionRate`, `HARVEST_RATE`,
  `KLEIBER`, `METABOLIC_SCALE`, `MASS_MIN_RATIO`. `forage.js:40` says it plainly:
  **NO BIRTH AND NO DEATH.**
- **The creature is handed exact world-space bearings.** `duel.js:444` passes
  `simB.centreOfMass()` straight in; `senseOpponent` has no range test despite
  `bearingTo`'s doc saying "0 if none in range". Receptor `normal` is carried and
  `morphogen.js:218` says **"Nothing reads it yet."**
- **The two sensor genes are non-identifiable.** `duel.js:277` passes
  `sensorTurnBias(genome, bearing, bearing)`, so the phenotype sees
  `(preyGain + threatGain) × bearing` — a neutral ridge in genotype space
  masquerading as two behavioural traits. Measured consequence:
  corr(taxis score, |gain|) = 0.07.
- **Inheritance is Lamarckian today.** See below. This is the largest single
  inconsistency in the project.

That is an **embodied evolutionary ALife system with an unfinished biological
economy** — not yet an ecosystem. The thing that changes it is not more detailed
physics. It is closing the loop:
*local sensing → action → resource gain/loss → survival → reproduction →
heritable offspring → competition.*

**Principle adopted from the review, and it governs the ordering below:**

> **Do not add realism where it does not create a new evolutionary trade-off.**
> A realistic sarcomere buys nothing while muscle quantity is free. A sophisticated
> eye buys nothing while the simulator hands the brain exact coordinates. A physical
> kcal/g buys nothing while there is no endogenous birth and death.

---

# Phase 1 — fix what is actually broken

Instruments and gods first. Every number in every later phase is read through these.

## 1.1 — The two invisible gods

**This is the highest-priority item in the plan.**

### Inheritance is Lamarckian, and it was not a decision

`gait.js:105` — *"Adapt a whole population, **Lamarckian**: each body keeps the
controller it learned."*
`objective.js` — *"the ADAPTED controller **REPLACES** the birth one, **Lamarckian**,
so selection and breeding both carry the learned gait."*

`adaptGait` is a `(1+λ)` hill climb **on net displacement measured by the
simulator**. The creature has no access to that objective and does not perform the
learning. It is an external optimizer writing its result into the genome before
reproduction.

This contradicts the standing decision — Lamarckian rejected, Baldwinian + genetic
assimilation (Waddington 1953) accepted. And it is not merely inconsistent:
**Phase 5's entire instrumentation is unmeasurable while it stands.** The innate
probe measures the gap between the born and the learned; if an oracle closes that
gap before reproduction, the Baldwin arc cannot be observed even if it occurs.

**Fix:** `adaptFn` is already an injected parameter (`objective.js` imports nothing
from `gait.js`, to avoid a cycle). Score the adapted gait if a body should be judged
at its best — **but breed the birth genome.**

### Viability retries erase mutational load

`VIABILITY.maxAttempts` gives every reproductive event up to **12** tries (tier 1 =
attempts 1–8 with grafting, tier 2 = 9–12 scalars only) and then copies the parent.
So a genotype whose developmental neighbourhood is fragile has the same reproductive
output as a robust one, and nothing selects for developmental robustness.

**Fix:** keep it for the six-slot tank UX; **turn it off wherever selection is being
measured.** One reproductive event, one zygote. If development fails, that birth
fails. That buys selection for robustness with no new fitness term.

> **Gate.** Bit-identical tank behaviour with retries on. With retries off over ≥3
> seeds, offspring viability rate becomes a reported per-lineage number. An innate
> probe forked at birth measures a non-zero innate–learned gap — **which is
> impossible today and is the proof the god is gone.**

## 1.2 — The Strouhal estimator ✅ DONE

Root→tail rotated into the root frame with `qrot`; beat axis found by PCA rather
than assumed to be `z`; amplitude peak-to-peak **per beat**; 5 s warm-up discarded;
and the cross-check the script already computed at line 44 is now **printed**.

> **Gate: ratio f_measured/f_commanded ≥ 0.9 at p50. PASSED — 0.263 → 1.01.**
>
> Two results fall out. **Slip is in band** (0.594 against `ROADMAP` §3's 0.5–0.8,
> which had it at 0.00–0.05) — Phase A fixed it and nothing had measured it. And
> **Strouhal is ~2–3, not 0.75**: the real gap to the efficient band is 5–8×, not
> 2×. The headline biological gate is now both meaningful and further away.

## 1.3 — The saturation counter lies

Measured: `sim.saturation` reports **0.000000** while a ceiling-only change
(`budgetScale 6 → 6e4`, which touches no gain) moves **7 of 10** creatures by up to
1.21 cm over 30 s and `workOut` by up to 31%. A/A control: **0.000 cm on 10/10**, so
the simulation is bit-deterministic and the difference is real.

`physics.js:1240` already names the cause — *"counted only the linear branch above,
so every saturation figure in the handovers is blind to this"* — and nobody
quantified it. Count every branch, including the spin cap.

**And strike `physics.js:565`**: *"with the clamp not binding — corpus saturation is
0.000 after A1 — `budgetScale` is inert."* **It is not inert.** That sentence is
what the `budgetScale = 6` decision rests on.

## 1.4 — Split `MUSCLE_STRESS`, and end the recurrence

The constant does two jobs and only one is physical:

```
motorBudget[j] = budgetScale · muscleStress · A^1.5 · arm   ← the CEILING. physical.
motorStiff[j]  = motorScale  · budget       · kStiff        ← the GAIN. a tuning scale.
```

Raising it raises **both**, which is exactly why the A4 sweep saw `workOut`
2.5e3 → 5.2e7 and reds on L1-18/N19 and L2-19. **Split:**

- `MUSCLE_STRESS = 2e6` barye (2×10⁵ Pa, real muscle) → **ceiling only**
- `MOTOR_GAIN_STRESS = 200` → **gains only**, documented as *a gain scale in stress
  units, not a stress*

**Write both measured ratios into the constant**, because the missing context is
what regenerates the argument every few sessions:

| load | ratio | |
|---|---|---|
| muscle / **water drag** | ≈ **1.3e4** | 13,000× *stronger* than swimming needs |
| muscle / **weight at g = 981** | ≈ **0.09** | **11× weaker** than standing needs |

Measured over **241 joints / 30 creatures**, ceiling against the torque to hold each
joint's own distal subtree horizontal: available p50 76.3 dyn·cm, needed p50 954
dyn·cm. **5.8% of joints can hold their own limb at 200; 100% at 2e6.**

Both prior claims were right about different loads. *(Mass model validated: with
`addedMass:false` the dry mass `d₀·d₁·d₂·ρ` matches Rapier exactly on 111/111
bodies. The 41.5% gap is added mass, p50 ×1.221 — a fluid effect that vanishes in
air, so dry mass is correct for the land calculation.)*

**N19 survives** — the ceiling stays ∝ A^1.5, geometric, mass-independent.
**L2-19 survives** — gains are untouched, so `r(speed, mass)` cannot move.

> **Gate — this is the blocking one. BLOCKED until it passes.** Re-run **L1-18
> (N19)** and **L2-19** after the split. 1.3 proves the change is *not* bit-identical,
> so **the claim "zero behavioural change" is withdrawn** — land it as a measured
> change with a re-freeze and a `faunaVersion` bump.
> **Failure = the actuator needs the `motorFreqHz` branch**, which is implemented,
> opt-in, and known to tear high-inertia bodies apart.

## 1.5 — N21 clamps by the wrong field

`contracts/species.js:75`: *"`turnRate` — rad/s, **YAW only**. N21 clamps all L3
steering by this."* Measured victim: **`eel-fast` reads yaw 0.00 in both directions
with `steeringAuthority` 1.000 and `turnRate3d` 1.09 °/s** — N21 grants it nothing.
Conversely `eel` reads yaw 22.50 with authority 0.000: it turns 45 °/s one way and
0 the other, so the budget is spendable in one direction only.

Switch to `turnRate3d` gated by `steeringAuthority`. Deferred deliberately at
`SESSION-10.md:1834`; now due. `BRIDGE_V` bump.

## 1.6 — The stale forks ✅ DONE

All 14 `_z*` copies of `physics.js` in `engine/l1/` were pre-Phase-A — no
`advancePhases`, no `PHASE_COUPLE` — so the 13 sweep tools importing them all
measured the open-loop controller, and `design/_zunits.mjs` put the result into
this document's first baseline as "this build".

**The cause was smaller than it looked, and the lesson is bigger.** Those files are
**generated, gitignored and disposable** — `tools/_zvariants.mjs` writes them from
`physics.js`. They were stale for exactly one reason: *the generator had not been
re-run since Phase A.* One command made all thirteen current.

`_zphlog` is **deleted outright**: its only difference from `physics.js` was three
logging lines, now the `FLOG` flag in `physics.js` itself, off by default and inert
when off. `tools/_zforce.mjs` and `design/_zunits.mjs` import the real module and
`_zforce` still reports 0/40 steps of positive fluid power.

> **A diagnostic that can be a flag must not be a copy.** A copy earns its keep only
> when the change cannot be a runtime option — a different `FIXED_DT` or
> `SOLVER_ITERATIONS`, which is what the remaining variants genuinely are. And
> **`node tools/_zvariants.mjs` runs after every `physics.js` edit**: the variants
> are not versioned and nothing else will tell you they have drifted.

**And a correction to this document's own first draft**, which claimed "112
archaeological files in the executable repository". The 14 engine forks were never
committed — `.gitignore` has covered them since they were introduced. What *was*
committed is six **`.bak` files** (`breed`, `genome`, `mutate`, `naming`,
`viability` inside `engine/l1/`, plus `ui/tank/sim.js.bak`), landed at `de21670`
"vivarioops 0.7". They are mutation-harness scratch — `tools/_mut*.mjs` copies
`file → file.bak` before mutating and restores in a `finally` — and at 40–60% of
their live counterparts' length they meant every grep of `engine/l1/` returned two
hits per symbol, one from a dead version. **Deleted, `*.bak` gitignored.** The 86
tracked `tools/_z*` files are genuine experiment scripts, not duplicates.

## 1.7 — Unit annotation drift, now scientifically dangerous

Verified in a **CGS** engine: `genome.js:25` `// m, full extent per axis`; `:160`
`// m`; `:230` *"1e-6 m is one micron"*; `viability.js:41` `// A9, kg`; `:47`
*"metres of centre-of-mass travel"*; duel comments in metres.

Equations are now justified against physical literature. **A stale unit comment
becomes a wrong constant six months later.**

## 1.8 — Gravity is done. Delete the comment that says otherwise.

`w1_slice.js:91` is already `gravity: 981 // cm/s^2 — CGS`, and `:61` records
*"Verified inert rather than argued inert (`tools/_zgravity.mjs`)"*.

**Eighteen lines above it, `:73-77` still says it "SHOULD read 981".** That stale
block has now misled **three separate analyses** into reporting gravity as broken
and Re as ~32. Delete it.

The real remaining item is **`SLICE_LIMITS.density = [1,1]`**: with density pinned
against `mediumDensity 1.0`, `(mediumDensity − density)·V·g` is **identically zero
for every segment**, so gravity is numerically correct and **biologically absent**.
Defensible for a neutrally-buoyant swimming experiment; it removes selection for
density distribution, hydrostatic stability, flotation and ballast. That is a world
change and belongs in Track W. **Do not simply restore `[0.15, 1.8]`** — that range
is only meaningful if the extremes correspond to gas cavities and mineralised
structure.

## 1.9 — Correct the stale numbers

`physics.js` header Re ~32 → **309**. `ROADMAP.md`: B3/B4/B5 **signed**; §5b·1 done
(`30a36f5`); §3's 0.006 L/s superseded; §79's orientation figure annotated (it
reproduces, but as yaw); C2 retired; the 13 pre-Phase-A tools into §6 Debts.
`CHANGELOG.md:493` `maxReflectionAxes` 1 → **3**.

> **Phase 1 gate.** `npm run gate` green. Baseline table reproduces **twice** from a
> clean checkout, every row tagged with source script and `n`.

---

# Phase 1′ — morphology and the ledger

No automatic selection. The ledger computes; **you** read and choose.

**Measure first.** Re-run `_zmorph` post-repair. And **build `jelly`** — one bell
node, one tentacle connection with two reflection axes, recursion on the tentacle.
Entirely inside the current schema, ~1 hour. `factory.js:156` already calls it *"the
first radial creature in the project"* and `worlds/seeds.js` is six eels and a
staircase. **It is the cheapest possible test of whether 4-fold reads as a medusa or
as a box with four box-arms — and if it reads badly, the answer is `proto/skin/`,
not the genome.** Do it before any symmetry schema work.

## 1′.1 Scale becomes a gradient

Anisotropy p50 **1.75** per connection: every joint redistorts proportions between
axes, compounding down chains that reach depth 8. Composed with body aspect p90
**11.96**, that is the whole "assemblies of stones" problem.

**This is a law, not a preference.** It is the `phaseLag` fix applied to shape:
independent per-node draws along a chain give a random walk; biology gives a
gradient. That exact change is what produced coordinated swimming in this repo.
Replace three independent per-connection scales (`RANGE.scale [0.5, 2.0]`) with **a
scalar plus a taper coefficient along the chain**.

Follow `phaseBase`/`phaseSlope` exactly: resolved at morphogenesis, **bit-identical
at zero taper**, no-op migration, mutation operator **and a test that it fires**.

> **Gate.** Anisotropy p50 ≤ 1.2 (from 1.75). Body aspect p90 ≤ 6 (from 11.96).
> Migration bit-identical at zero taper. Operator measured firing over 1000
> mutations. Acceptance not below Phase 1's repaired baseline.

## 1′.2 The ledger laws — and muscle becomes a phenotype

Three laws, all computable from state that already exists:

**Diffusion limit.** O₂ reaches ~1 mm into tissue; the deepest interior point of a
box of half-extents (a,b,c) is `min(a,b,c)`. Measured min half-thickness p50
**0.232 cm** against ~0.1 cm, so **this bites the median creature**. Tissue beyond
it is dead mass: dragged, cannot contract. This is why flatworms are flat.

**Respiratory surface.** Demand ~M^0.75 (Kleiber — already in `ledger()`), compact
surface ~M^0.67. They diverge, so past some size a compact body cannot breathe.
Per-face areas already exist for the drag quadrature; S/V is one division away.

**Volume allocation — and this is the one that buys the most biology.** Body volume
partitions into muscle (driven by `workOut`), gut (intake), circulation (the price
of violating the diffusion limit) and gas/lipid (the price of buoyancy). Density
becomes *derived*.

> Two independent analyses reached this from opposite directions. The review's
> recommendation — *"add muscle allocation as a phenotype rather than merely fixing
> `MUSCLE_STRESS`"* — is this law. Today a cuboid is simultaneously structure,
> displaced volume, inertia and contractile machinery, and actuator capacity falls
> out of joint geometry for free, so **evolution never decides how much of a body
> should be muscle.** One genetic variable — muscle fraction per joint — makes PCSA
> depend on it, makes muscle cost mass and maintenance, and lets appendages be
> passive. **That buys more biology than a sarcomere model ever would.**

**Costs, not filters.** A violator carries dead tissue and reads badly on the
ledger; it is not rejected at birth. Rejection collapses acceptance and turns the
project into acceptance-rate tuning.

**Every coefficient cites a measurable biological quantity in the constant itself**
— diffusion depth ~1 mm, Kleiber 0.75, tissue density ~1.05 — the way
`SLICE_LIMITS.density` documents its 60-creature measurement. *This is the risk on
this phase:* "joules per cm³ of dead tissue" has no principled value, and fitting
those numbers until the shapes look nice is authored morphology with extra steps.

## 1′.3 Energy units become honestly artificial

`w1_slice.js:171` is `FOOD_ENERGY: 2.7e3 // erg/g`, *"recalibrated at the Phase A
exit"*, because the physically derived value is orders of magnitude too generous
against the current actuator and metabolism. **The label says erg/g and the number
is not erg/g.** That is the dangerous hybrid: downstream equations look more
grounded than they are.

Two clean options — **dimensionless artificial bio-energy**, or genuinely physical
energetics. **Take the dimensionless one.** Rename the units (energy units,
maintenance units), tune them unapologetically for meaningful scarcity, and stop
implying a physical derivation. Physical energetics would force a much deeper
physiological model than this project needs.

## 1′.4 Active negative work is not free

`physics.js:1893` correctly separates positive and absorbed actuator work, but
`forage.js:476-488` bills only `workOut` — *"an animal does not eat to be pushed
around."* That conflates **passive external loading** with **active eccentric
contraction**. Eccentric work is substantially cheaper than concentric; it is not
free. Right now a controller can obtain free braking from something billed as muscle
elsewhere, which is an exploit surface.

Separate active contractile negative work from passive elastic/viscous absorption,
and charge the former.

## 1′.5 Satiety

Never modelled at any layer. But `VIVARIUM_12_L3_WORLD.md:131` /
`VIVARIUM_03_CONTRACTS.md:150` already define `mass` as **"current biomass
reserve"** with `massMin = 0.5 × massBase` and `massReproduce = 2.0 × massBase` — a
complete model written for a layer that was never built, and `w1_slice.js:180`
already carries `MASS_MIN_RATIO`. **Lift that shape to L1** rather than inventing a
second one. It is one accumulator over `ledger()`. State, not behaviour — nothing
reads it until Phase 4.

## 1′.6 The ledger on screen

Vivarium shows intake / spend / balance / ratio per creature, so manual selection is
informed. Carry the four `_zselect` lessons (`ROADMAP.md:280-298`) or they get
re-learned:

1. **Never rank on the ledger ratio.** Drifter wins it 70× by not moving.
2. **Never run a trial under ~200 s.** At 60 s intake correlates 0.33 with mass and
   −0.06 with swimming.
3. **Check `integrity()`.** `runForage` does not, and an exploder reported 7864 g
   against rivals' 31–49.
4. **`balance` runs +0.50 with mass; `balance/mass` runs −0.86.** The readout must
   say which question it answers.

---

# Phase 2 — sensors and perception

Perception **without** direction. Kinesis senses a scalar and modulates `effort`, so
it needs swimming (works), not orientation. `ROADMAP.md:96`: *"taxis needs
orientation, which is broken; kinesis needs swimming, which works."* It is also
Phase 3's only honest control arm — a sensor that beats a competent kinetic forager
is evidence; one that beats a random walker is not.

**Measure first: the null.** With `chemoGain` forced to 0, what is intake variance
across the corpus? Without that floor, §4.3's 0.90 correlation between raw seek
score and `netSpeed` swallows the result.

## 2.1 Sensing becomes receptor-mediated

**This is the defect, not the missing gene.** The machinery exists — `chemoGain` +
`RANGE` (`genome.js:150`), its mutation operator (`mutate.js:626`), organ `sites`
with placement, surface `normal` and left/right provenance, a cap and validation,
the neutral blind state `sites: []` / `chemoGain: 0`, and `GENOME_V 5` shipped.
`mutate.js:682` even says *"RAISE IT WHEN THE SENSE IS WIRED."*

What is missing is that **nothing reads it**. `morphogen.js:218` — *"Nothing reads it
yet."* And the one thing that does sense, `senseOpponent`, is handed
`simB.centreOfMass()` directly with **no range test at all**, despite `bearingTo`'s
own doc claiming "0 if none in range". That is an omniscient compass.

**Minimum credible replacement:** local concentration at each receptor site →
receptor activation → left/right difference → controller input. Noise, finite range,
attenuation and occlusion can come later; **the causal chain cannot.** Until it
exists, morphology, orientation, sensory evolution and behaviour are not coupled,
and no amount of sensory sophistication downstream means anything.

`forage.js` already has the spatial grid (`cellSide = 2r`, 3×3×3 block lookup) that
`forageStep` uses for ingestion. The sense is the same query without the eating.

## 2.2 The wire

`runForage`'s loop is `sim.step(); forageStep(…)` and **nothing touches
`sim.control`** (`forage.js:518-521`). It must update `effort` per step from the
receptor reading. (`turnBias: 0` at `:509` is a default and `simOpts` spreads last —
the gap is the per-step update, not the literal.)

## 2.3 An honest objective

Raw seek score correlates **0.90 with `netSpeed`**, so selecting on it breeds fast
swimmers and leaves the gene drifting. Same genome, same seed, gene zeroed vs live.
**And it needs its own gait adapter** (`ROADMAP.md` §4.4): `adaptGait` hill-climbs
net speed, so reusing it optimises one quantity and scores another — a point that
Phase 1.1 makes sharper, not softer.

**Organ discipline:** neutral at insertion (bit-identical at birth), **metered on
expression** (billed to `workOut`). Without a cost, expression-off and expression-on
are indistinguishable to selection and everything drifts to on.

> **Gate.** Control-subtracted score **> 0**, sign test over ≥15 creatures (the
> `_zlight` standard). Trials ≥200 s. `integrity()` checked. Operator measured
> firing. **Failure = the wiring is wrong, not the gene.**

---

# Phase 3 — direction

**Measured, not assumed: taxis fails today** (`_zlight` +0.0109, 1/7), **and turn
rate is the entire mechanism** (r = 0.91 against `turnRate3d`; r = 0.07 against the
sensor gain).

## 3.1 Select on turn rate

The threshold is near **14 °/s** (eel-unison, the only creature that works). The
corpus is at **1.57 °/s**. A **9× gap**, and the authored library proves it is
reachable inside the existing body-plan space. **Nothing in the project has ever
selected for it.** A turn-rate objective is `OBJECTIVES`-shaped and costs no schema.

> **Gate.** Corpus `turnRate3d` p50 moves from 1.57 toward 14 °/s, ≥3 seeds,
> **gated on `steeringAuthority` > 0.5 so it cannot be won by breeding circlers** —
> the `eel` failure mode, measured. Then re-run `_zlight` against its own
> pre-declared endpoint.

## 3.2 The spotty world is a parameter change

`makeFood(world, { contrast = 2.0, floor = 0.35 })` — fbm rejection sampling, with
`total` conserved so patchiness changes *where* the food is and never *how much*.
Define `W1_SPOTTY` as a named preset so runs are comparable.

## 3.3 Then taxis

Two spatially separated receptors give **tropotaxis** — instantaneous gradient,
direct steering, flatworm grade. Symmetry is present in 100% of creatures so
mirrored pairs are reachable, but **confirm the operator reaches *placement*** first.
Start lineages at one receptor and let the second be discovered; that transition is
a real evolutionary event and watchable as an abrupt behavioural change.

> **Regression gate, worth more than any positive result: receptor expression
> frequency rises in `W1_SPOTTY` and falls in the uniform world.** A lineage going
> blind again — cave fish — cannot be rigged.

---

# Track W — new worlds, alongside Phases 2–3

The concrete form of *variety is a niche problem, not an encoding problem*, and
where 1.4's muscle split is validated under real load. **Records are keyed by
`worldId`, so W2/W3/W4 are strictly additive — nothing in the Atlas breaks.** The
world schema is already fully parameterised; `physics.js:371` already builds the
floor; buoyancy is already per-body; N22 is already a gate assertion.

**Do not jump to W4.** The staging isolates one failure mode at a time.

| World | Change | Tests | Cost |
|---|---|---|---|
| **W2 The Shelf** | same water, floor close and grippy (friction 0.75) | ground contact and traction **with buoyancy still holding the creature up and the fluid still damping** | cheap |
| **W3 The Loft** | `mediumDensity 0.55` | the **density unpin** while the fluid still damps; **and whether 1.4's split holds under load** | the real work |
| **W4 The Terrace** | air | land proper | after W3 |

**Three things W3/W4 break that nothing else does:**

1. **The C6 fluid work stops being load-bearing — and it was the damper.** Drag and
   added mass scale with `mediumDensity`, dropping ~800× in air. `STABLE_SPEED`, the
   momentum guards and the error clamp were all tuned against a medium that absorbs
   most of the energy. Expect tear-apart and peak-spin back — **and `_myria2.json`
   no longer reproduces the tear-apart, so there is currently no repro to test
   against.** Rebuilding it is a W2 prerequisite.
2. **Viability inverts.** The inertness check rejects COM travel < 0.05 in 2 s and is
   **25.0% of all rejections**. On land, standing still is the *first* achievement,
   and a creature that "moves" because it toppled would pass.
3. **The stabilisation preamble** (`02 §4`): drop with no friction and no effector
   forces until COM settles, then score. Skipping it scores creatures on how they
   happened to be dropped.

**Two genuinely open items — do not schedule them yet:**

- **Grammar.** A splinter that swims is a splinter that buckles (aspect p90 11.96,
  min half-thickness 0.232 cm). Worse, A2 deliberately biased the factory *toward*
  axial spines (`spineAxialRate`) to reach eels — precisely the anti-leg bias. Legs
  need off-axis reflected pairs; the schema supports them (`reflectMinOffset`) but
  the generator steers away. **1′.1 is a prerequisite here, not a nicety.**
- **The controller has no posture and no duty cycle.** The CPG makes
  phase-propagated sinusoids — undulatory vocabulary, exactly the wrong one. Walking
  needs a *stance* phase where the joint is loaded and not moving, and a sinusoid has
  no stance. `10 §A7` names the cheapest candidate (product-of-two-sines). Harder:
  `step(t, sensors) → jointTargets` has no notion of holding an angle against a
  load, so "stand up" is not expressible in the current signature.

**Hydrodynamics, honestly labelled.** The current model — local `v + ω×r`, normal
velocity per cuboid face, quadratic pressure, added mass, **no tangential viscous
term, no wake, no flow history, no inter-segment interaction** — is a
**phenomenological aquatic locomotion model, not validated biological
hydrodynamics.** Every appendage meets virgin fluid independently, so forces simply
add where real closely-spaced limbs shield each other and recover energy from
vortices. At the measured Re p50 **309** — squarely intermediate, where neither
low-Re nor high-Re assumptions suffice — an evolved twelve-paddle creature may be
brilliant inside Vivarioops and impossible outside it. That is fine for ALife. It is
**not** enough to claim evolution discovers realistic aquatic locomotion. Validate
against a few canonical shapes and gaits over the actual Re range before believing
any morphological conclusion; do not build CFD.

> **Gate.** W2: ground contact held without the integrity guard firing, with the
> tear-apart repro rebuilt first. W3: **N19 and L2-19 both still green after 1.4's
> split, re-run in the new medium.**

---

# Phase 4 — intelligence

**Rename at this bump, not before.** `preyGain` / `threatGain` are duel vocabulary
on what becomes the generic sensory layer for chemoreception and then eyes. Cost: 6
engine files + **29 under `tools/`** — real, so pay it once, here. Following the
`jointGenes` precedent (`genome.js:341`, keyed by `nodeId` because *"a positional
array would silently rebind"*), key gains **by channel id**:
`controller.sensorGains: { food, obstacle, kin }`. Migration maps `preyGain` → first,
`threatGain` → second, bit-identical. That is what lets a new sense be added later
without renumbering every genome in the Atlas.

**4.1 Break the neutral ridge.** `duel.js:277` feeds the same bearing to both
channels, so the phenotype sees `(preyGain + threatGain) × bearing` and the two genes
are mathematically non-identifiable. Measured: corr(taxis score, |gain|) = **0.07**.
Give them distinct signals. Free, and it makes the perceptron genuinely 2-input for
the first time.

**4.2 Widen inputs** to ~6–10: receptor concentration, food bearing and distance,
satiety, joint load, own speed.

**4.3 Widen outputs — the important half.** Only `turnBias` exists. Add **`effort`**
(Phase 2 needs it) and **`omega`**. Intelligence lives in what a creature can sense
and do, not in the layers between; topology search on a narrow map has nowhere to go.

**4.4 Then topology.** NEAT-style complexification, three non-optional costs:
**innovation numbers** (so crossover survives differing topologies — the lesson
`jointGenes` already paid for), **speciation** (without it new structure is culled
before it can be tuned, and the gate reads zero hidden nodes and looks like a bug),
**per-node metabolic cost** (without it networks bloat).

Prioritise **recurrence over depth**. Depth adds nonlinearity; a self-connection adds
*state* — memory, hysteresis, internal modes. The difference between a creature that
reacts and one that is in a state of doing something.

**Expect modest quantitative gains.** The literature is honest that complexification
improves scores and rarely produces categorically new behaviour. Qualitative jumps
come from new sensors, new selective regimes and coevolution.

> **Gate.** Bit-identical at neutral weights, or the migration is not a migration.
> |r| > 0.5 between satiety and effort. Every channel has an operator and a test it
> fires. **Failure = hidden-node count drifts to zero → speciation is missing.**

---

# Phase 5 — inheritance of intelligence

**The mechanism was decided in E2** — Lamarckian rejected, **Baldwinian + genetic
assimilation** (Waddington 1953) accepted. This phase implements that decision.
**Phase 1.1 is a hard prerequisite:** the system is Lamarckian today, and the
instrumentation below cannot read anything until that is removed.

**Three-factor Hebbian with eligibility traces**, not backprop — local synapses
accumulate recent activity, a global reward pulse from the ledger gates the update.
~20 lines, online at frame rate. Chosen partly *because* its credit assignment is
temporally sloppy, so superstition emerges as a property of the algorithm rather
than as authored content.

**The Weismann barrier:** the genome encodes `W₀`, learning modifies `W`, and **at
death `W` is discarded**. Only `W₀` is inherited. Lamarckian inheritance is faster as
pure optimisation and destroys the phenomenon — after a few generations everything is
born competent and there is nothing to watch. *(Which is exactly what `adaptGait`
does today.)*

**Learning must be costly**, or it shields the genome from selection: a bad `W₀`
gets rescued every lifetime, no gradient favours good `W₀`, and plasticity is
retained forever. Documented failure mode. Exploration noise burns energy;
unconverged juveniles forage badly.

**Environmental drift rate is the dial.** Slow drift → assimilation → animals born
knowing. Fast drift → permanent plasticity → animals born curious. Same code, two
civilisations.

**Instrumentation: the innate probe.** At birth, fork the creature and run a copy
with learning disabled. **Innate score climbing across generations is the Baldwin
effect; the innate–learned gap closing is genetic assimilation.** Visible version:
watch the newborns, not the adults.

**E3 social learning** — nothing inherited; offspring learns by watching the parent,
giving traditions, drift and bad habits propagating. Needs creature–creature
perception and follows.

**Housekeeping:** `VIVARIUM_00_VISION.md:336` says *"a machine learning project.
Nothing is trained."* Amend it to record the E2 decision. It was written before the
project had a controller worth learning in, and was aimed at fitted physics
approximations (`:79`), not biology.

> **Gate — the cleanest in the plan.** **Innate score rises across generations AND
> the innate–learned gap narrows**, ≥3 seeds. Both are curves that can fail to
> appear. **Failure = plasticity never declines under slow drift** → learning is not
> costly enough and is shielding the genome, exactly as E2 predicts.

---

# Last — L3, where fitness stops being imposed

**Not "a better auto-breeder replacing `autoBurst`".** The endpoint is the ecology
that `w1_slice.js:127-187` already specifies and `engine/l3/` does not yet contain:
birth, death, resource circulation, and **fitness as persistence in a resource-limited
world** rather than a number handed down from outside.

That is the line between *a morphology optimizer living in physics* and *an
artificial ecology*.

**Why it is last, and this is the review's own argument turned on its ordering:** an
endogenous birth/death ecology buys little while a Lamarckian oracle rewrites
controllers before reproduction and 12 viability retries erase mutational load.
Build L3 on top of those and the evolution inside it is still driven by gods — and
the outputs will look plausible, so nothing will tell you. **Remove the gods first.**

**Three prior results to reckon with before any auto-selection is scheduled:**

1. **+5% over 60 generations** (`2baea0c`), and *"short bursts work and long ones do
   not"* — 3 gens @ 24 gives 47%, 10 gens @ 60 gives 23% at eight times the cost
   (`objective.js:16-20`). Any target above that is a hypothesis contradicting prior
   measurement and must say so.
2. **Convergence to a single animal in ~5 generations** (`breed.js:50`).
3. ***"More strangers makes it worse"*** (`objective.js:16`) — which rules out the
   obvious fix for (2).

**Score solo, not in a shared tank:** six creatures on one depleting field makes
fitness frequency-dependent, adding variance exactly where a small effect is being
measured. **Report each generation how many creatures reach `intake/spend > 1`** —
rank selection keeps a population alive even when every member is starving, so it
will breed a lineage of failures and show a rising curve regardless. That number
says whether the world is survivable at all.

**And two niches will buy more variety than any longer run.** One medium, one
feeding mode, one objective yields one body-plan family.

---

# Standing rules

1. **A number enters this plan only with the script that produced it, the `n`, and a
   re-run.** A number that has not been reproduced is a memory.
2. **Do not add realism where it does not create a new evolutionary trade-off.**
3. Every new gene needs a mutation operator **and a test that it fires**. The
   `preyGain` precedent: the gene existed, mutation never reached it, the whole
   corpus measured zero.
4. Every organ: **neutral at insertion** (bit-identical), **metered on expression**.
   Without a cost, expression-off and expression-on are indistinguishable to
   selection and everything drifts to on.
5. Every coefficient cites a measurable biological quantity **in the constant
   itself**. No source → it is a parameter → it does not belong.
6. **Costs, not filters.** Rejection collapses the acceptance rate.
7. **Units are load-bearing.** This is CGS. A stale unit comment becomes a wrong
   constant six months later, and has already misled three analyses.
8. Recalibrate `FOOD_ENERGY` whenever `forageStep`, trial length, metabolic cost or
   body mass changes, and say so in the constant.
9. Freeze each phase's population to the Atlas before starting the next.
10. **Authoring a phenotype and shipping it as an outcome is cheating; authoring the
    space and the pressures is the job.** A seed may enter the population, may never
    bypass the objective, and must carry authored ancestry in the Atlas. Keep a
    science mode with purely random founders — **2 of 6 opening slots are authored
    eels** (`breed.js:363`), so "evolution improves descendants of competent
    founders" and "evolution discovers swimming" are different claims and only the
    first is currently supported.
11. A retired finding can un-retire. **A knob that delays a failure has not explained
    it.**

---

# Withdrawn — do not resurface

| Proposal | Killed by |
|---|---|
| **`plan.bodies[].depth` is a bug** | It is **per node type by design** (`morphogen.js:105-107`), resets on moving to a different node, and the phase gradient deliberately does **not** read it (`:275-277`, which recomputes true tree depth at `:292`). Measured: `stored [0,0,1,2,3]` — non-zero exactly where self-recursion occurs. The all-zero sample that motivated this was one unlucky creature. **"Fixing" it would break a working field.** |
| **`MUSCLE_STRESS → 2e6` is a labelling correction with zero behavioural change** | `physics.js:70-116`, the A4 sweep: tracking 0.699→0.96, `workOut` **2.5e3 → 5.2e7**, L1-18/N19 red (area doubling gives 1.03, not 2^1.5), L2-19 red (r(speed,mass) −0.018 → 0.441 at n=120, 2 s.e. = 0.185). *"SWEPT, AND DELIBERATELY LEFT AT 200. A NEGATIVE RESULT."* The gains are `motorScale · budget · kStiff` with `budget ∝ muscleStress` (`:1040`), so the constant sets the response as well as the ceiling. **Superseded by Phase 1.4's split, which is a different change.** |
| Make bilateral symmetry the default prior | **100%** of viable creatures already carry ≥1 reflected connection; 75% of connections do |
| Add a penetration term so parts can be skinned | **997/997 = 100%** of parent–child OBB pairs already overlap |
| Creatures are star topologies, hence clumps | depth p50 2, max 8; root branching p50 2 |
| "Rung 0: gravity → 981" | **Already done.** `w1_slice.js:91` is 981, verified inert by `tools/_zgravity.mjs`. The open item is the density unpin, and it belongs to Track W |
| Semi-implicit drag correction (Phase A) | coast ratio 0.622 → 0.623, a no-op; λ_body·dt ≈ 0.11 |
| Raise `SOLVER_ITERATIONS` (Phase A) | 8 → 128 gave 2.50 / 2.14 / 2.17 / 2.09 / 2.85, no trend |
| Constrained morphology priors to mimic observed shapes | cosmetic; replaced by 1′.2's laws |
| Full GRN / morphogen-diffusion genome | rewrite of all of L1 except physics and controller; kills the taxonomy and inspectability. Vivarioops 2, not a migration |
| **Growth by moulting** | Fits none of the five phases, and its justification — *"nothing changes during a life"* — is delivered by satiety (1′.5) with no joint destroy/recreate, no bit-exact moult threshold and no rename-mid-life problem. Revisit after Phase 4 |
| **A rotational `repeatCount` gene** | Odd-order symmetry is genuinely unreachable (reflection gives orders 1/2/4/8 only), but **variety is a niche problem first**. If ever built: neutral at `n=1`, and the `parity` flip in `placeChild` is reflection-specific — rotational copies preserve handedness and must not use it |

**A note on attachment position.** Measured \|position\| p50 = **0.990** means
children attach at the *edge* of the parent face, not the centre. That is a real
number and it may contribute to the scattered look. It is deliberately **not** in the
plan, because there is no law behind it and no evidence it matters more than 1′.1 —
and adding it anyway is the move that cost this project four turns of churn. Revisit
only if 1′.1 lands and the creatures still look wrong.

**A note on C1 and C2.** C1's checkpoint is struck: it has no player-visible screen
by design, and its probes are earning their keep — without `steeringAuthority` you
cannot tell `eel` (45 °/s one way, 0 the other) from `eel-unison` (genuinely
steerable). **C2 is retired as a milestone**, for four measured reasons: closing is
flat at 0.16–0.21 cm across a 4× separation range (drift, not pursuit); the spec asks
for a 29 m separation inside a 16×24×16 m tank; three residents give one candidate
cycle so non-transitivity is weak evidence; and the UI was correctly never built.
**Keep `duel.js` parked** — `senseOpponent`/`bearingTo`/`turnPlane` is the only worked
closed-loop sense→steer example in the codebase and Phase 3.3 will copy it. **Duels
return after Phase 4, as a coevolutionary pressure** rather than as a measurement of
creatures that cannot aim.
