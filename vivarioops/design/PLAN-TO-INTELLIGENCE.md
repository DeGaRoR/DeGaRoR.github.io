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
2e6.** That is the solid number — a clean statics comparison, known weight at a
known lever arm, no controller in the loop.

> **Retraction.** This table first said "muscle is ~2000× stronger than swimming
> needs". That divided per-joint torque by the drag on **body 0**, the
> least-actuated body in the plan. Like for like — each joint against **its own**
> limb, n=101 — the ratio is **33.4**, and it is **8.2×** the pure inertial cost of
> swinging the limb, with the delivered torque almost entirely the position-tracking
> spring (24.3 dyn·cm spring vs 0.82 damping). That is a fact about **controller
> stiffness**, not a strength surplus.
>
> **The claim that survives is narrower and still decisive:** the muscle *ceiling*
> never binds in water — delivered torque is **0.0065%** of it, clamp saturation
> **0.0000**. Strength is not what limits a swimmer here; it is exactly what limits
> a walker. Different loads, and quoting one alone is how this argument gets retired
> and re-opened every few sessions.

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

> **Gate — LANDED 2026-08-09, `GENOME_V` 6. Three of four pass.**
>
> | | before | after | gate | |
> |---|---|---|---|---|
> | scale anisotropy **applied** p50 | 1.749 | **1.138** | ≤ 1.2 | ✅ |
> | body aspect p90 | 11.96 | **6.02** | ≤ 6 | ⚠️ 6.02 |
> | body aspect p50 | 3.67 | 2.79 | — | ✅ |
> | viability acceptance | 37.3% | **46%** | not below | ✅ |
> | migration bit-identical at t=0 | — | **max dim delta 0** | exact | ✅ |
> | `mutateTaper` fires | — | **72 / 1000** | > 0 | ✅ |
> | founder survives breeding | — | `eel/g1` after 4 gens | — | ✅ |
>
> **Aspect p90 lands at 6.02 against a gate of 6, and it should not be chased.**
> Measured: the aspect of raw **node dims**, before any scaling at all, is p90
> **5.72** — because `RANGE.dim` is `[0.2, 2.0]` drawn *independently per axis*, so
> a single node can be 0.2 × 2.0 × 0.2 before a connection touches it. The taper
> has closed almost the entire gap between 11.96 and that floor. **The remaining
> aspect is in `RANGE.dim`, not in the gradient**, and that is the next lever if
> anyone wants it — not more taper.
>
> **The recorded prediction failed on the first attempt, and the reason is worth
> more than the fix.** `taperRatio` shipped as a deliberately unbiased `[0.7, 1.3]`
> so the prediction could fail honestly. It did, and worse than baseline —
> acceptance 34.5%, mass p90 **183.8 g** against a pre-taper 111.2.
>
> `r` compounds as `r^depth` and the grammar reaches tree depth 8, so a band
> symmetric in `r` is violently asymmetric in outcome: 1.3^8 is 8.2× per axis, 550×
> in volume, while 0.7^8 merely vanishes and gets culled. **Exponentiating a
> symmetric band produces a heavy right tail.** A second mechanism showed up in the
> tally — pre-taper, *anisotropy was acting as an accidental volume brake*, because
> a distorted limb usually had one thin axis that `MIN_LIMB_DIMENSION` culled along
> with its subtree. Removing the distortion removed the brake (`oversizeTank` 7 → 1,
> `interpenetration` 37 → 46: the bodies are chunkier now).
>
> So the band is **derived from the depth the grammar reaches** — `r^8` must stay
> near unity — giving `[0.75, 1.05]`. `[0.70, 1.00]` scored better still (45.8%,
> mass p90 31.3) and was **declined**: it forbids distal flare outright, and a broad
> tail fluke is a real animal.

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

> **LANDED 2026-08-09 — `engine/l1/tissue.js`, derived and reported. No schema
> bump, no new coefficient invented, gate green.**
>
> The law had to pass one test before earning a line in the ledger: **does it
> discriminate, or does it restate a pressure selection already sees?** Measured
> over 60 viable creatures:
>
> | | p10 | p50 | p90 |
> |---|---|---|---|
> | **dead tissue fraction** | 0.289 | **0.470** | 0.621 |
> | oxygen ratio `S / M^0.75` | 8.64 | 11.0 | 13.6 |
> | surface / volume | 4.48 | 6.57 | 9.56 |
>
> **The median creature is 47% anoxic core** — nearly half its volume is tissue it
> must drag and accelerate and cannot contract. And selection is blind to it:
>
>     r(deadFraction, netSpeed) = 0.034
>     r(oxygenRatio,  netSpeed) = 0.050
>     r(mass,         netSpeed) = 0.051
>
> **Thick creatures pay nothing for being thick today.** So this is a genuinely new
> pressure, not a duplicate of one the objective already applies — which is the
> only thing that justified adding it.
>
> **Corroboration nobody designed in:** the authored swimmers sit at dead fraction
> **0.158**, three times leaner than the random corpus (`jelly` is 0.397 — its bell
> is a thick slab, and a real medusa solves that with inert buoyant mesoglea rather
> than with muscle). The animals that work are the ones this law would reward.
>
> **The respiratory-surface law is much weaker than the diffusion law on this
> corpus** and should not be leaned on: `oxygenRatio` spans only 8.6–13.6, so it
> barely orders anything. Reported, not relied upon.
>
> **The coefficient I declined to invent.** The plan has dead tissue paying for
> circulation. That needs joules per cm³ of perfused tissue, and there is no
> measurable biological quantity to derive one from — so it is **not implemented**,
> and the ledger's arithmetic is unchanged. `deadFraction`, `liveMass`,
> `oxygenRatio` and `thinnestHalfThickness` are *reported* so 1′.6 can show them
> and so the ordering can be studied. Nothing may read them as a cost until
> someone can cite where the price came from. This is the rung whose named risk was
> "fitted until the shapes look nice"; declining the number is how that is avoided.
>
> **Derived density is deferred to Track W, deliberately.** Making density the
> mass-weighted mean of the tissue mix unpins `SLICE_LIMITS.density` from `[1,1]`,
> which makes weight and buoyancy live for every body and turns a tissue change
> into a world change. It belongs with the W3 unpin as one change, not two.

**Every coefficient cites a measurable biological quantity in the constant itself**
— diffusion depth ~1 mm, Kleiber 0.75, tissue density ~1.05 — the way
`SLICE_LIMITS.density` documents its 60-creature measurement. *This is the risk on
this phase:* "joules per cm³ of dead tissue" has no principled value, and fitting
those numbers until the shapes look nice is authored morphology with extra steps.

## 1′.3 Energy units become honestly artificial — **LANDED, and the fix is the opposite of the recommendation**

The review recommended going dimensionless: relabel everything as "energy units,
food units, maintenance units". **I did not, and the reason is that it would throw
away three true statements to stop one from looking true.**

`work` really is ergs. `basal` really is ergs. `erg/g` really is the right unit for
an energy density. **The only fiction is how much energy this world's food
contains** — which is a world-design choice and belongs exactly where `12 §5` puts
it. Relabelling the ledger dimensionless would make three real quantities fake in
order to defuse one.

So the fix is to make the gap **impossible to miss at the point of use** instead of
forty lines above it:

```
REAL_FORAGE_ENERGY / W1_SLICE.FOOD_ENERGY  =  1.7e11 / 2.7e3  =  6.3e7
```

`REAL_FORAGE_ENERGY` is a new module constant read by nothing — it exists so
`FOOD_ENERGY` cannot be quoted without its context, and it sits outside the fixture
because `validateWorld` correctly rejects unknown keys in a hashed world. The
`intake` line in `ledger()` carries the same factor.

**This world's substrate is seven orders of magnitude more dilute than grass.**
Not a unit error — a very thin soup, chosen so the ledger asks a question with an
answer.

> **And I got the constant wrong on the first pass**, writing 1.7e8 by dropping the
> kg→g factor — understating the gap by 1000×. Caught before it shipped. The unit
> chain (`4 kcal/g → 1.7e4 J/g → 1.7e7 J/kg → 1.7e11 erg/g`) is now written out
> beside the number, because in an engine whose own comments said "m" and "kg"
> until this session, an energy density is precisely the constant that acquires a
> silent factor of 1000.

## 1′.4 Active braking is no longer free — **LANDED**

`forage.js` billed only `workOut`, treating all absorbed energy as free on the
grounds that "an animal does not eat to be pushed around". True of a limb shoved by
the fluid; **false of a muscle generating force while being lengthened.**

The split needed no new machinery, because the actuator already computes its two
torques separately:

```
springTau = k * (target - theta)    the ACTIVE element. The muscle.
dampTau   = -c * omega_rel          the PASSIVE element. Dissipation.
```

so `springTau * omega_rel < 0` is exactly "the muscle is resisting while being
stretched", and the damper's power — dissipative by construction — stays free.
`sim.workEccentric` accumulates the first; `work`, `workOut` and `workAbsorbed` all
read what they always did.

**`ECCENTRIC_COST = 0.25`**, and it is a *ratio*, which is why it is allowed where
1′.2's circulation coefficient was not: eccentric contraction costs roughly a third
to a fifth of concentric for the same force, because cross-bridges detach
mechanically rather than by hydrolysing ATP. Nothing about it depends on
`FOOD_ENERGY` or on any unit in the file.

**Measured, 8 creatures × 220 s:** braking is **8.8% of total spend on average**,
range 2.9% – **27.9%**. One creature was taking more than a quarter of its energy
budget as free resistance. That is the exploit surface closed.

*(On the explicit-PD path the whole torque is active — that path never separates
spring from damper — so its `workEccentric` is an overestimate relative to the
solver path's. Stated in the code rather than hidden; the two paths' costs were
already declared non-comparable in §3.2.)*



## 1′.5 Satiety — **LANDED**

Never modelled at any layer before this. **The shape was lifted, not invented** —
`VIVARIUM_03_CONTRACTS.md` §3 already specifies it, for a layer nobody built:

```
mass          = CURRENT BIOMASS RESERVE
massMin       = MASS_MIN_RATIO   x massBase  -> death
massReproduce = MASS_REPRO_RATIO x massBase  -> split
```

Both ratios (0.5, 2.0) were already sitting in the world fixture. Writing a second,
different reserve model at L1 when a canonical one is in the contracts is exactly
how `harvestArea` vs `surfaceArea` happened — `12 §4` records that failure and says
L3 "imports it and states nothing".

**The counter-intuitive rule `12 §4` is emphatic about, and which is honoured:**
*"Speed, reach and turn rate are FIXED CAPABILITIES and do not scale with current
biomass. A starving creature is not slower."* The reserve decides whether an animal
lives and whether it can breed; it must not become a performance multiplier.
Nothing in `reserveAfter` returns anything the physics reads.

**No new coefficient.** A surplus becomes stored substrate at the same density it
was eaten at — an identity, not a fit. Real tissue synthesis is 60–80% efficient and
that factor is **deliberately not applied**: it would be a number chosen from a
range, and lossless is the neutral assumption. Stated, not hidden.

`satiety` is normalised 0–1 between starvation and reproduction, which is the form
Phase 4 needs — a raw gram count would make the gain gene's useful magnitude depend
on how big the animal happens to be.

**Measured, 10 creatures × 220 s: 4 starving, 0 able to reproduce.** The reserve is
deliberately **not clamped at zero** — one creature lands at −20.5 g against a
massBase of 20.8, and that deficit is the informative part when calibrating a
world. Clamping would report a hopeless creature and a marginal one identically.

## 1′.6 The ledger on screen — **LANDED**

Selection is manual until L3, so anything the ledger computes and does not show is
a number nobody can act on. Five rows added to the creature sheet, and the compact
HUD row was given the same arguments — `braking` defaults to zero, so omitting it
there would have shown **two different ratios for one creature**, differing by up
to 28% depending on which part of the screen you read.

| row | why |
|---|---|
| **Braking cost** | 1′.4. Beside the other two costs, not inside them |
| **Per gram** | `_zselect` lesson 4, on screen instead of in a comment: absolute balance runs +0.50 with mass and `balance/mass` runs −0.86. They crown different animals — a 37 g animal with the worst net energy per gram, and a 0.30 g filament. Showing both, labelled, is the only honest way to hand this to a human |
| **Reserve** | 1′.5, with satiety and a STARVING / can-breed verdict |
| **Dead tissue** | 1′.2, with the thinnest half-thickness beside it. Reported, never charged |
| **Ancestry** | 1′.0 — the row the founder field was built for |

**`Origin` and `Ancestry` are different questions and the sheet now asks both.**
`Origin` is per-breed-call: how this creature reached this slot, forgotten one
generation later. `Ancestry` is per-lineage. Verified live in the running app:

```
Origin    = offspring · mix of 3 + 4
Ancestry  = reference · jelly · 28 gen
```

That creature is 28 generations descended from a medusa authored the same
afternoon, and the tank says so without being asked. **A reference is not a lesser
creature** — it is one whose competence was designed rather than earned, and a
player choosing breeding stock is entitled to know which they are looking at.

The merge was verified against known inputs rather than inferred from the screen:
`wild × wild → null` (not over-applied), and both `wild × jelly` and
`jelly × wild` give `jelly` — so an authored animal cannot launder its ancestry by
entering as the second parent.

---|---|
| **Braking cost** | 1′.4. Beside the other two costs, not inside them |
| **Per gram** |  lesson 4, on screen instead of in a comment: absolute balance runs +0.50 with mass and balance/mass runs −0.86. They crown different animals — a 37 g animal with the worst net energy per gram, and a 0.30 g filament. Showing both, labelled, is the only honest way to hand this to a human |
| **Reserve** | 1′.5, with satiety and a STARVING / can-breed verdict |
| **Dead tissue** | 1′.2, with the thinnest half-thickness beside it. Reported, never charged |
| **Ancestry** | 1′.0 — the row the founder field was built for |

** and  are different questions and the sheet now asks both.**
 is per-breed-call: how this creature reached this slot, forgotten one
generation later.  is per-lineage. Verified live in the app:



That creature is 28 generations descended from a medusa authored the same
afternoon, and the tank says so without being asked. **A reference is not a lesser
creature** — it is one whose competence was designed rather than earned, and a
player choosing breeding stock is entitled to know which they are looking at.

The merge was verified against known inputs rather than inferred from the screen:
 (not over-applied),  and
 (so an authored animal cannot launder its ancestry by
entering as the second parent).

---

# Phase 2 — sensors and perception


> ## PHASE 2 AS BUILT, 2026-08-09 — mechanism works, **gate does not pass**
>
> **The machinery is in and verified.** Receptors resolve onto the plan with
> position, outward normal and left/right side; `senseAt` reads local
> concentration through the same spatial grid `forageStep` uses, with a **finite
> reach** (`SENSE_REACH = 3 × FOOD_RADIUS` = 6 cm against a 2 cm bite); `runForage`
> updates `sim.control.effort` every 0.1 s from `chemoGain × (concentration − 1)`;
> and `sensing: false` is bit-identical to the old open-loop trial (**12/12
> creatures**), which is what makes the control arm honest.
>
> Mutation reaches it: **40/40 lineages** acquire both a site and a non-zero gain
> within 200 mutations, median 53.
>
> ### The gate
>
> | run | field | gains | mean control-subtracted | helped |
> |---|---|---|---|---|
> | 1 | default | as first drawn | **−0.087 g** | 3 / 16 |
> | 2 | `SPOTTY_FOOD` | \|gain\| ≥ 0.25 | **−0.058 g** | 7 / 16 |
>
> **Gate: control-subtracted score > 0. FAILED, twice.** Not tuned until it passed,
> and not going to be.
>
> ### But the sign replicates, and that is the finding
>
> | | run 1 | run 2 |
> |---|---|---|
> | `chemoGain < 0` — **dwell** where food is rich | **+0.077** | **+0.054** |
> | `chemoGain > 0` — **hurry** where food is rich | **−0.214** | **−0.169** |
>
> Two independent runs, two different fields, same direction: **slowing down in
> rich water helps a little; speeding up in it hurts more.** That is exactly what a
> kinesis is supposed to do, and nothing in the code declares it — the sign is
> evolved. The population mean is negative only because gains are drawn
> symmetrically and half the corpus has the wrong one.
>
> **So the honest reading is not "the sensor is useless" but "the sensor has a
> correct polarity and nothing has ever selected for it"** — the same shape as the
> turn-rate finding in Phase 3. Direction replicated; magnitude not established.
>
> ### Root cause of the small magnitude: the world, not the gene
>
> Measured signal at a receptor over a 220 s trial, as p95 − p05 of the
> concentration ratio:
>
>     default   contrast 2.0 / floor 0.35   ->  0.087    an 8.7% swing
>     SPOTTY    contrast 4.0 / floor 0.10   ->  0.360    4x more
>     extreme   contrast 6.0 / floor 0.02   ->  0.340    no better
>
> **On the shipped field there is almost nothing to smell.** At 6 cm reach the fbm
> plus a 0.35 uniform floor averages to nearly flat, and no gene can beat a blind
> control on an 8.7% signal. `SPOTTY_FOOD` is therefore a **prerequisite for Phase
> 2, not a Phase 3 flourish** — which the plan half-anticipated by scheduling it,
> but as an enhancement rather than a dependency.
>
> Extreme is not better, for the reason `makeFood` already records: below a ~0.10
> floor the creature spawns outside every patch and the outcome is decided by where
> it landed rather than by what it did.
>
> ### One bug found by measuring rather than by testing
>
> `senseAt`'s first normalisation divided by `items.length × cellVolume`, which is
> not a volume the field has. Concentrations came out centred on **2.86 instead of
> 1.0** — and they still *ordered* patches correctly, so nothing looked broken. A
> ratio silently 2.9× is precisely the kind of error that survives a smoke test and
> then quietly miscalibrates a gain gene. `food.volume` is now carried explicitly.
>
> ### What is still owed
>
> - **A gait adapter for this objective.** `foodEatenControlled` exists;
>   `adaptGait` hill-climbs *net speed* (`gait.js:88`), so handing it to a forage
>   burst would tune each body for travel and then score it on eating. Deliberately
>   not wired — `autoBurst` takes `adaptFn` as a parameter so the wrong one cannot
>   be assumed.
> - **Metering on expression.** Standing rule 3 says every organ must be billed, or
>   expression-off and expression-on are indistinguishable and everything drifts to
>   on. A per-receptor cost needs a coefficient with no available source, so it is
>   **declined** on the same grounds as 1'.2's circulation cost — and the
>   consequence is recorded rather than hidden: **until it exists, receptor count
>   should be expected to drift upward**, and the cave-fish regression gate cannot
>   be run.

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

> ## ⚠ RE-BASELINED AGAIN, 2026-08-10. READ THIS BEFORE THE SECTION BELOW.
>
> The 2026-08-09 re-baseline replaced "orientation is the open question" with "it
> is kinematic, and `_zreach`'s envelope computes it". **The envelope has now been
> scored against creatures actually trying, and it does not predict arriving.**
>
> `tools/_zreach.mjs 0 validate`: **agreement 16/26 = 62%** against a pre-declared
> 75%. **RETIRED AS A GATE.** The failure is entirely one-directional — 10 of 26
> cells are "predicted reachable, observed not", and 0 are the other way. It is a
> necessary condition and nothing more, and it must not decide which creatures are
> worth trialling.
>
> Worse, the fields it is built on are anti-correlated with arriving.
> `tools/_zgoal.mjs`, n = 17, Spearman against control-subtracted goal closure:
> `turnCapability` **−0.152**, `turnRate3d` −0.309, `steeringAuthority` 0.005,
> `turnRadius` 0.155, `netSpeed` 0.243. Pre-declared threshold 0.3. All retired as
> selection proxies.
>
> **Cause: `S3` measured at `turnBias = ±1.0`**, where `TURN_AUTHORITY = 1.0`
> commands a full joint range of differential offset on top of a gait already
> using p50 0.69 of it. The joint pins against its own limit, the stroke
> rectifies, thrust collapses. The response is not monotone in the command —
> `eel-fast` turns 8.88 °/s at bias 0.5 and 1.25 °/s at 1.0. Repaired at
> `BRIDGE_V` 8: `S3` sweeps and reports at each creature's `bestBias`.
>
> **The two creatures this phase wrote off as unable to steer — `eel` and
> `eel-finned`, `turnCapability` 0.000 — are the best goal-reachers in the
> authored library** (+0.65 and +0.67 closure, arriving in 4 of 6 directions).
> They roll their bend plane onto the target, which no field was looking for.
>
> **What replaces the envelope:** `tools/_zgoal.mjs` is the only scorer, and
> selection on it works — 10.9× a paired null arm over 3 seeds, with out-of-plane
> closure (0.463) as good as in-plane (0.312). The gene that carries it is the
> SENSOR GAIN: 0.200 in every authored creature, 0.484–1.275 in four winners from
> two independent founding regimes.
>
> **What is still open:** the tank gate failed at 5/56 arrivals against 50%. See
> `HANDOVER-STEERING.md` for the two diagnosed causes and the ordered next steps.
> Sections 3.1 and 3.2 below are superseded; the traps in them are still true.

**RE-BASELINED 2026-08-09 after an investigation that changed what this phase is.
The headline: orientation was never the open research question it has been
recorded as, and two of the three things the previous draft recommended are
wrong. `tools/_zreach.mjs` holds the analysis.**

## What the investigation found

### `_zlight`'s "1 of 7 helped" is not a sensing result

`_zlight.mjs:112-113` hands the creature a **perfect, noiseless, unlimited-range
bearing on every physics step** — `bearingTo(sim, light, plane)` straight into
`sensorTurnBias`. There is no perception in the loop that could fail. Whatever
that experiment measures, it is not whether a creature can sense a target.

### It is a kinematic result, and it is computable without simulating

A swimmer has a minimum turning radius `r = v / ω` and cannot curve inside it.
`_zlight` places its target **3.0 cm** away (`START_DIST = 3.0`, labelled
"metres" in a CGS engine — the same class of stale unit the Phase 1 sweep found
elsewhere) at bearings of ±90/±135/180, with a **40 s** window.

Computing the shortest legal path — one arc on the minimum-radius circle, then a
straight tangent — against the distance each creature could swim in 40 s:

| | reach ≥1 bearing |
|---|---|
| 21 creatures, `_zlight` geometry, T = 40 s | **1 / 21** |

**And the one is `eel-unison` — exactly the one creature `_zlight` reports as
helped.** The model predicts the experiment. Six of the seven were being asked to
do something kinematically impossible, so that result is a measurement of the
task, not of the animals.

> ### A caveat on `_zlight`'s declared secondaries — they are not stable at this n
>
> The re-run at T=40 reproduced the primary exactly (2/8 helped, matching the
> prediction) but its correlations came out **inverted** against the previously
> recorded ones:
>
> | | recorded earlier (n=7) | re-run (n=8) |
> |---|---|---|
> | corr(score, `turnRate3d`) | **0.91** | **0.13** |
> | corr(score, `steeringAuthority`) | 0.31 | 0.38 |
> | corr(score, \|sensor gain\|) | **0.07** | **0.89** |
>
> Same script, same geometry, one extra library creature and a different pair of
> randoms. **Two coefficients swapped places.** At n = 7–8, with most subjects
> scoring exactly 0.000 because they cannot physically move, these correlations
> are noise dressed as evidence.
>
> **I used the 0.91 to argue that turn rate was "the measured critical path" and
> to justify Phase 3.2. That argument is withdrawn.** What replaces it is not a
> better correlation but a mechanism: `_zreach` predicts *which specific creatures*
> can arrive, and the prediction was confirmed creature-by-creature. A mechanistic
> prediction that names its cases is worth more than a correlation over eight
> points, and it is what Phase 3 now rests on.
>
> The declared-secondary correlations should either be dropped from `_zlight` or
> computed only over the ELIGIBLE subset, where a score of zero means "tried and
> failed" rather than "could not have tried".


### The criterion is `ω · T`, and speed cancels

Place the target at a fixed *fraction* of each creature's own swim budget — the
only fair way to compare a 0.003 cm/s creature with a 0.76 cm/s one — and

    r/D  =  (v/ω) / (k·v·T)  =  1 / (ω·k·T)

**the speed cancels exactly.** Reachability depends only on `ω · T`: the total
angle a creature can turn through during the trial.

The corpus median is 1.57 °/s. Over 40 s that is **50–63° of total turning** — it
cannot complete one 90° turn, let alone aim. *That is the entire "orientation
problem", as one number.*

> ### THE 300 s RUN — prediction FALSIFIED, and the failure is the informative one
>
> Pre-declared before running, on `_zlight`'s exact subjects: **T=40 → 2/8,
> T=300 → 5/8.**
>
> | | predicted helped | actual helped | mean control-subtracted |
> |---|---|---|---|
> | T = 40 s | 2 / 8 | **2 / 8** ✓ | +0.0227 |
> | T = 300 s | **5 / 8** | **2 / 8** ✗ | +0.0799 |
>
> **The envelope over-predicts, and this section's headline was half wrong.** Four
> creatures the model said could arrive — `eel-fast`, `eel-slow`, `jelly`, `r0` —
> still do not, at 7.5× the window. `eel-slow` has authority 1.00, a 1.17 cm
> turning radius and a 44 cm swim budget against a 3 cm target, and it closed
> **2.977 → 2.977**: it did not move toward the light at all.
>
> ### What the envelope IS, restated honestly
>
> **A necessary condition, not a sufficient one.** It is exactly right about who
> *cannot*: `eel` and `eel-finned` both have `steeringAuthority` 0.000, both were
> predicted 0/5, and both scored a literal `3.000 → 3.000` in every arm at both
> windows — they never move, ever. That floor is kinematic and the model nails it.
>
> But among creatures that *could* arrive, only one actually does. **Being able to
> get there and going there are different questions, and only the first is
> geometry.**
>
> ### The genuine positive, and it is the first of its kind here
>
> `eel-unison`, given the longer window, **homes in**:
>
> | | closest approach (3.00 cm start) | normalised score |
> |---|---|---|
> | T = 40 s | 1.930 | 0.055 |
> | **T = 300 s** | **0.514** | **0.527** |
>
> Blind control 2.096 in both. That is 83% of the distance closed, a **ten-fold**
> rise in score, and the first unambiguous instance in this project of a creature
> perceiving a target and arriving at it. The window mattered enormously — for the
> one creature equipped to use it.
>
> The population mean grew 3.5× (+0.023 → +0.080) on an unchanged count, which is
> the signature of one creature improving a lot rather than more joining in.
>
> ### So the control loop IS the open question after all
>
> This phase named that outcome in advance as the informative failure: *"reachability
> rises but `_zlight` still shows no approach — the first evidence that the control
> loop is at fault rather than the body."* That is what happened, and Phase 3
> should be re-planned around it rather than around geometry.
>
> `eel-slow` is the case to investigate: full authority, ample budget, tight
> radius, a perfect bearing, and **exactly zero** distance closed. Candidates, none
> yet tested —
>
> - **`turnBias` may not produce SUSTAINED turning.** `steeringAuthority` measures
>   AXIS REVERSAL between a +bias and a −bias trial. A creature can reverse its
>   curl cleanly and still not hold a heading change long enough to aim. The probe
>   answers "does the input change which way it bends", not "can it execute a turn
>   to a commanded angle".
> - **The turn plane may not contain the target.** Steering happens in the
>   creature's own bend plane (B2 §5), measured once at rest — and it may rotate as
>   the creature swims.
> - **The loop may be unstable rather than weak.** The bearing updates every step
>   and there is no damping anywhere in `sensorTurnBias`.
>
> **The next measurement is a commanded-turn test, not another light trial:** hold
> `turnBias` at a constant value and measure heading change against time. That
> separates "cannot turn" from "cannot aim" — which every experiment so far has
> conflated — and it costs minutes, not a breeding run.


## Answering the two questions directly

**Can we have steering before 3.4?** **Yes, and 3.4 is irrelevant to it.** The
chain is sense → bearing → `turnBias` → turn → arrive. Links 1–4 all work
(`_zlight` proves 1–2, `turnCapability` measures 3–4). Only *arrive* fails.

**Can we have 3.4 in the current state?** We could build it, and it would be
**unmeasurable and pointless**. Tropotaxis improves the *bearing estimate* — a
quantity `_zlight` already supplies perfectly. Improving a perfect signal buys
nothing. 3.4 becomes meaningful only once creatures can act on a bearing, and
only in a trial where the bearing is *earned* rather than handed over.

## 3.1 — Fix the trial before running it again. Free, and necessary but not sufficient.

**This heading read "the dominant lever" until the 300 s run tested it. It is
not.** Raising the window took the mean effect from +0.023 to +0.080 and took
`eel-unison` from 1.93 to 0.51 cm — a real, large gain — but the number of
creatures helped did not move at all, 2/8 either way. The window unlocks the
creatures that could already steer; it does not create steerers.

Do it anyway: it is free, it is obviously right, and it is what let the one
capable creature show what capable looks like. Just do not expect it to be the
fix. What follows is what the geometry says is POSSIBLE, which the run has now
shown is an upper bound rather than a forecast:

| T (s) | reach ≥1 | 5/5 | mean/5 | cannot even *cover* 3 cm |
|---|---|---|---|---|
| **40** (current) | **1/17** | 1 | 0.29 | 7/17 |
| 120 | 4/17 | 3 | 1.12 | 4/17 |
| 300 | 9/17 | 8 | 2.47 | 2/17 |
| 600 | 12/17 | 11 | 3.47 | 1/17 |

No gene, no schema, no selection. **`FORAGE_SECONDS` is already 300 elsewhere in
this project; `_zlight` alone runs at 40.** Raising it to 300 takes the task from
1-in-17 POSSIBLE to 9-in-17 possible — and, measured, from 2-in-8 ACHIEVED to
2-in-8 achieved. The gap between those two sentences is the whole of what Phase 3
now has to explain.

Two further trial fixes, both measurement hygiene rather than capability:

- **Gate every trial on the envelope.** Never score a creature that cannot
  physically arrive. "1 of 7 helped" becomes "1 of 1 eligible helped" — the same
  data, the opposite conclusion.
- **Scale the target to the creature.** A fixed 3 cm target asks a 0.003 cm/s
  animal and a 0.76 cm/s animal completely different questions, and conflates
  *can it move* with *can it aim*. `D = k · v · T` isolates aiming, and by the
  cancellation above makes the test speed-independent by construction.

## 3.2 — Select on the ENVELOPE, not on turn rate. **My previous recommendation was wrong.**

The last draft said turn rate was "the measured critical path" and
`tools/_zturn.mjs` duly moves it — 1.57 → 13.12 °/s, 2.58× over a null arm.
**It does not produce creatures that can steer.** Measured, selecting on
`turnCapability` for 5 generations:

| seed | | v cm/s | turn °/s | radius cm | budget cm | reach |
|---|---|---|---|---|---|---|
| 1 | gen 0 | 0.018 | 5.38 | 0.20 | 0.74 | 0/5 |
| 1 | **after** | 0.069 | **21.21** | 0.19 | 2.74 | **0/5** |
| 2 | gen 0 | 0.017 | 9.57 | 0.10 | 0.69 | 0/5 |
| 2 | **after** | **0.012** | 11.99 | 0.06 | 0.46 | **0/5** |

Turn capability quadrupled and reachability never moved. **Selecting on turn rate
alone breeds creatures that spin brilliantly in place** — radius 0.06 cm, budget
0.46 cm. Seed 2's speed *fell* while its turning improved.

This is the `eel` circler problem one level up. `turnCapability` was introduced
to stop a naive turn objective crowning an animal that turns one way only; it
does not stop one crowning an animal that turns beautifully and goes nowhere.

**The objective must be reachability itself** — `minPath(v/ω, D, θ) ≤ v·T`,
counted over the bearing set. It is derived rather than invented, it is
dimensionless, it cannot be won by spinning *or* by sprinting, and it is cheap:
one S2 and one S3 per creature instead of a trial per bearing.

## 3.3 — `SPOTTY_FOOD` — already landed

`contrast 4.0 / floor 0.10`, measured to give a receptor a 0.360 signal against
the shipped field's 0.087. Prerequisite for Phase 2, not a Phase 3 flourish.

## 3.4 — Tropotaxis. **Deferred, and now for a stated reason.**

Not "later because it is hard" but **"not yet because it would measure nothing"**.
Two receptors improve a bearing estimate; the bearing is currently exact. It
becomes the right work once (a) creatures can act on a bearing — 3.1 and 3.2 —
and (b) the bearing is earned from the receptor field rather than supplied by the
harness, which is the honest version of the Phase 2 wire.

> **Gate for this phase, and it is now a fair test.** With the window at 300 s and
> trials gated on the envelope: **`_zlight`'s own pre-declared endpoint, over the
> eligible population only.** Plus the envelope objective moving corpus
> reachability from a measured 0.29/5 toward the library's best of 5/5, against a
> random-selection null arm, ≥3 seeds.
>
> **Failure = reachability rises but `_zlight` still shows no approach.** That
> would be the first evidence in this project that the *control loop* is at fault
> rather than the body, and it is the point at which orientation becomes a real
> research question rather than an arithmetic one.

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
