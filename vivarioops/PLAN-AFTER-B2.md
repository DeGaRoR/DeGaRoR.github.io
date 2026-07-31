# PLAN — after B2

This replaces the ordering in DESIGN-PHASE-B2 §9 from step 8 onward. Steps 2–7
shipped; step 7's deliverable is built and its gate is owed.

**Why it changed.** §9 optimises correctness-before-capability, which is right
for a codebase and wrong for a project someone has to enjoy. Four steps in, the
tank is *quieter* than when we started — deliberately, because the honest
actuator makes design matter — and the payoff sits at step 9. That is a bad
shape. This plan puts something playable in front of the remaining engine work,
and reorders §7 because the design has taxis before kinesis and that is backwards
for what is currently broken.

---

## 0. Play the current build — *Denis, before anything*

Three sessions of engine work, none of it seen. Every claim in the handover is
instrument-mediated, and the instruments have now been wrong three times in the
same way.

Denis's eyes caught border-sticking and the sibling problem before any tool did.
This is the cheapest high-information item available.

**Expect**: more varied and larger creatures, two authored eels seeded in, a
**quieter tank**, and **border-sticking unchanged** — the torus is opt-in and used
only for measurement.

**Risk**: the app is unverified since `BRIDGE_V` → 4. Cached records are
invalidated by design; anything else is a bug.

---

## 1. The dimensionless regime check

**Hypothesis, flagged as one.** Everything in this project is measured in metres
per second. Two numbers have never been computed:

- **Body-lengths per second.** A real fish does 1–10. Our creatures do roughly
  0.1. This is the number that decides whether motion *reads* as swimming.
- **Strouhal number**, `f·A/U` — beat frequency × amplitude ÷ forward speed.
  Efficient swimming across the animal kingdom sits at **0.2–0.4**. Rough
  arithmetic on our `omega` range puts us near **2**.

If that is right, creatures are beating far too fast for the speed they achieve —
slipping rather than swimming — and it would explain the slowness, the wobble
that broke the turn metric, and possibly why steering does nothing, **from one
constant rather than four subsystems**.

Nobody has ever measured it. It is an afternoon, and it is the highest-leverage
single measurement remaining.

**Deliverable**: `tools/_zstrouhal.mjs`. Report `L/s` and `St` across the corpus
and the authored library, swept over `omega`. If `St` falls toward 0.2–0.4 as
`omega` drops while speed *rises*, the finding is a constant, not a redesign.

**Also cheap and in scope**: tank scale relative to body size. A 1 m creature at
0.1 m/s in a 16 m tank looks static; the same creature in a 3 m tank looks like
it is exploring. That is not cheating, it is choosing the frame.

---

## 2. Distributed food + the kinesis gene — *the playable one*

**This is §7.2 before §7.1, and the swap is the point.** Light-following is
**taxis** — it needs orientation, which is broken. Food in a field needs only
swimming, which works.

### 2a. The field

A scalar field over the tank. Creatures absorb where they sit. **Food depletes
locally when eaten** — see §3 for why that single rule is load-bearing.

### 2b. Kinesis, not taxis

Navigation without steering is a solved problem in biology. *E. coli* cannot
orient and has no idea where the sugar is. It runs and tumbles — swim faster
while conditions improve, tumble when they worsen — and reliably climbs
gradients. That is **kinesis**, and it predates taxis by a long way.

Our creatures already do the random half: they wobble enormously and their
heading drifts. That drift is the noise floor that broke the turn metric; here it
is the useful ingredient.

**One gene.** Sense local field strength, modulate `control.effort`. Effort
already exists as a per-step input — the probes drive it at 0.6/1.0/1.5 today.
The **sign of the gain is evolved, not declared**, exactly as `preyGain` is, so a
creature that flees food is legal and simply loses.

**Risk, to check first (half an hour, not an afternoon)**: is the heading drift
fast enough to serve as the tumble? Measured drift is 0.13–1.96 °/s. If creatures
drift too slowly they will sit in one place and kinesis will not climb anything.
`tools/_zwobble.mjs` already measures this — run it before committing.

**Why this matters**: it is genuine intent, evolved rather than scripted,
selectable, watchable, and **it depends on nothing currently broken**.

---

## 3. Energy balance, growth and death

`sim.work` already accumulates joint work in Joules. Cost of transport
(`work / mass·distance`) is the natural currency.

### The trap that will kill it

If energy is spent by moving and gained from a field, **the optimal strategy is
to not move**. Sit still, spend nothing, absorb what drifts past. A tank of
stationary blobs, with selection pressure running backwards — structurally the
same failure as the mutation ratchet chantier 1 removed.

**Local depletion is the fix**, and it is the only thing that makes the model
non-degenerate. It is also what makes kinesis worth having: the field becomes
dynamic, so "conditions worsening" means something.

Worth knowing: **Sims never used metabolic cost.** His fitness was direct —
distance, or capturing the cube. Energy balance is more elegant and more fragile.

### The caveat on `work`

On the solver path it is a **reconstruction**, not a measurement. Exact in steady
oscillation, overstates during fast transients. That was fine feeding a
diagnostic. **If it decides who dies, its error becomes unfair deaths, and there
is no way to tell that from bad luck.** Validate against a known case before it
is load-bearing.

### Growth — two different questions

There is **no size gene**. There are `nodes[].dims` (per-part, mutable) and
`connections[].scale` (child-relative, the Sims recursive scaling).

- **Ontogenetic** (an individual grows during its life) is expensive: Rapier
  colliders rebuilt mid-simulation, mass properties recomputed, joint anchors
  shifted. Doable, messy, touches the most stable part of the engine.
- **Evolutionary** (lineages get bigger over generations) **already works and
  needs nothing**. `dims` mutate; if bigger eats better, bigger wins.

**For the feel of growth soon**: decouple them. Energy accumulates as a store,
shown as brightness or fullness; actual size changes at generation boundaries.
Visible feedback, no physics surgery.

**Per-part, not uniform.** Uniform scaling is clean and boring. Per-part is where
the morphological interest is, and the machinery exists today. If absorption
scales with surface area and cost scales with work, there is a real trade-off —
more area feeds you more and drags you more. That produces *shapes*, not sizes.

The square-cube law is already in the engine whether or not you want it: torque
goes as `A^1.5 · momentArm` ~ L⁴ while rotational inertia goes as L⁵, so angular
response falls as 1/L. Big creatures are automatically sluggish, for free.

### Scope flag

This is **D-tier — ecology**. B2 was explicitly scoped to stay in B. Jumping here
may be exactly right, but do it knowingly rather than by drift.

---

## 4. Then, and only then: orientation

Real work, not urgent, much more pleasant on a project that is being enjoyed.

1. **Fix `turn3d` to measure body rotation, not velocity direction.** Contained
   change to one function, `BRIDGE_V` bump, and a re-baseline of everything
   downstream — S3, the record, N21, L2-20. **Until this exists there is no
   instrument that can answer the steering question**, which is why the
   TURN_AUTHORITY sweep cannot simply be run.
2. **Re-derive the torque bound's `maxError`.** Recovers ~45% of turn rate
   without touching 00 §9's guarantee. Bound against the oscillatory amplitude;
   treat the steering DC offset separately.
3. **Then ask the authority question properly**, with an instrument that answers
   it. The "units" branch is already closed — `TURN_AUTHORITY` is 1.0, full
   range. Actuation delivers 11% of command. The loss is at L2.
4. **Then §7.1, follow the light.** `_zlight.mjs` is written and its endpoints
   are declared; re-run it unchanged.

---

## 5. A process change worth making

The gate discipline is genuinely excellent and it is making *research* expensive.
Fixing `turn3d` is twenty lines; in this codebase it is a `BRIDGE_V` bump, a
record migration, S3 re-derivation, N21, L2-20 and a full re-baseline — a
session. Sims did not have 4021 assertions. He had a simulator, an objective, and
compute, and he **looked at what came out**.

**Suggested convention**: measurement tools and experiments (`tools/_z*.mjs`)
carry no gate obligation and no version bump. Only findings that change engine
behaviour do. That keeps the engine's guarantees intact while making it cheap to
*ask questions*, which is the activity that has produced every real result in the
last three sessions.

---

## Ladder position, honestly

| objective | status |
|---|---|
| truly different creatures | **done and measured** — variety 17 → 337, duplicate tanks 86% → 15% |
| reasonable speeds through evolution | **mechanism proven** (2.8× in 3 generations, 6/6 vs null arm), **magnitude unverified** and possibly a regime problem — see §1 |
| manual → automated selection | **done** — auto-burst validated against a null arm |
| orientation | **not achieved.** 0.13–1.96 °/s heading rate; a 135° turn takes ~4 minutes |
| intent / sensing / biome | **not started**, and §2 above is the path that does not wait on orientation |

**Against Sims**: we have the morphology half — directed-graph genome, recursion,
reflection, a fluid model that correctly punishes a bad gait. We do not have the
behaviour half. He also ran ~300 individuals × 100 generations; we run 24 × 3.
Different regime, and part of the gap is simply compute.
