# Vivarioops — where we are and what happens next

Written because "what is C1?" has three answers in this repo and none of them is
wrong. This file is the reconciliation and the plan. It supersedes the ordering in
`PLAN-AFTER-B2.md` §5 onward and is the entry point before any handover.

---

## 1. Why the letters are confusing — three schemes, same letters

| scheme | lives in | "C1" means | "C2" means |
|---|---|---|---|
| **The roadmap** (A–F) | `design/VIVARIUM_00_VISION.md` §7, `design/VIVARIUM_30_IMPLEMENTATION_PLAN.md` | **Sensors and probes** | **Duels + capability card** |
| **Chantiers / steps** | `HANDOVER-B2.md`, `PLAN-AFTER-B2.md` | "chantier 1" = morphology variety | n/a |
| **Engine work C0–C6** | code comments and `tools/_z*.mjs` only | **the actuator normalisation** | n/a — C6 is hydrodynamics |

**Two of the three schemes are defined in documents that are not in this repo.**
`DESIGN-PHASE-B2` is cited by ~40 comments in `gate/*.js` and by `PLAN-AFTER-B2.md:3`;
the C0–C6 plan and `RECONCILIATION` are cited by `engine/l2/gait.js` and several tools.
Neither exists in the tree. `design/INDEX.md` claims nothing outside `design/` is
authoritative, and yet the last several sessions were planned entirely outside it.

**Convention from here on:** the roadmap letters A–F are the only milestone names.
Engine work gets a descriptive name, never a letter. The C0–C6 labels already in the
code stay as historical references and are not extended.

---

## 2. Where we actually are

The reliable status board is **the gate's own carried-obligations block** (`npm run gate`,
read the tail). `CHANGELOG.md` stops at 0.8.0 against a `version.json` of 0.8.8 —
treat it as abandoned until someone backfills it.

| milestone | goal | status |
|---|---|---|
| A0 · Contracts | remove silent decisions | ✅ done |
| A1 · Skeleton | boots, navigates, persists, gates | ✅ done |
| B1 · Genome | round-trips, randomises | ✅ done |
| B2 · Morphogenesis | a genome becomes a body | ✅ done, re-tuned since |
| B3 · Motion | "swims, looks alive not convulsive" | ⚠️ **gate green, human checkpoint never signed** |
| B4 · Breeding | the toy loop, playable | ⚠️ same — green, unsigned |
| **B5 · First light** | the art pass; "would you show someone a screenshot?" | ❌ **never started** |
| C1 · Sensors + probes | measurable creatures | ⚠️ green but **hollow** — S2 yields 1 trustworthy number of 8 |
| **C2 · Duels** | "watch three fights, say what it's good at" | ❌ **engine done, UI never built, checkpoint unanswerable** |
| **Forage** (not a milestone) | food, a mouth, an energy ledger, six rivals | ✅ **built** — no gene, no death |
| D1 · Ecology core | a population lives and eats | ❌ not started |
| D2 · Verdict | the world judges | ❌ not started |
| E1 · The loop | verdict sends you back to breed | ❌ not started |

**Why you have never seen C1 or C2.** C1 has *no player-visible screen by design* —
its deliverable is numbers and a gate. C2's screen (capability card + tap-to-replay)
was **deliberately not built**: the matchup matrix was all zeros, so the card would
have shown three empty rows. That decision is recorded in `CHANGELOG.md:87` and is
still a live obligation at `gate/duel.js:394`.

**The C2 blocker was locomotion**, and it was named precisely: median closing
0.25–0.34 cm against a 6–8 cm start separation. Half of it (buoyancy) was fixed long
ago; the other half was the drag law, which is what the last several sessions have
been working on.

---

## 3. Did the engine finish reasonably?

**Yes — it is now finished, and it should stop here.** The fluid work closed out this
session: the lift term deleted, the quadrature corrected, the momentum guards fixed,
added mass shipped. Full account in `HANDOVER-FORAGE.md`. Gate green at 94. The fluid model is now a coherent, measured,
gate-guarded Newtonian blade-element law with added mass. What remains on the fluid
side is either blocked (`MUSCLE_STRESS`, which pins 83% of the corpus at the speed
ceiling) or out of reach without a different geometry (skin friction, wakes,
circulatory lift). None of it is what stands between the project and being fun.

**What the engine work did NOT fix, and cannot:** the corpus swims at ~0.006
body-lengths/s against a real swimmer's 0.5–10, and slip (`U/V_wave`) is 0.00–0.05
against 0.5–0.8. That gap is **coordination and the morphology grammar**, not fluid.
Orientation is worse: 0.13–1.96 °/s, so a 135° turn takes about four minutes.

**The consequence for planning:** anything that needs a creature to *aim* is blocked.
Anything that needs it only to *move* is not.

---

## 4. "A creature alone on a depletable food field" — which layer?

**Creature generation with a better selection criterion. Not L3.**

L3 is defined by its *representation*, not its subject matter: point agents
`{x, y, vx, vy, mass, age}` in 2D, driven by a compiled `Species` record, with **no
physics at all** (`design/VIVARIUM_12_L3_WORLD.md:41-47`, `01:156-162`). A creature
with real joints in real fluid cannot be represented there. And L2's probes produce
*identity*, which costs a `BRIDGE_V` bump per field.

An **objective** is the third category, and it was carved out deliberately for exactly
this (`engine/l2/objective.js:1-11`): it is what selection reads, it is not part of any
creature's identity, and it carries no schema and no version obligation. There is
already precedent — `tools/_zlight.mjs` scores against a light placed in the world and
feeds it straight into the shipped `autoBurst`.

So a food field is **a harness on `runSolo` plus an objective**, in the shape
`_zlight.mjs` already has. It becomes L3 when there are many agents, no physics, and a
compiled record — which is D1, and a different job.

**Four things that decide whether it works**, all already known:

1. **Local depletion is load-bearing.** If energy is gained from a field and spent by
   moving, the optimal strategy is to *not move*. Depletion is the only thing that
   makes the model non-degenerate (`PLAN-AFTER-B2.md:107-114`).
2. **Kinesis, not taxis.** Sense local field strength, modulate `control.effort`. One
   gene, sign evolved not declared. *E. coli* cannot orient either — it runs and
   tumbles. This is the whole reason food comes before light: **taxis needs
   orientation, which is broken; kinesis needs swimming, which works.**
3. **The objective must be control-subtracted.** Raw seek score correlates **0.90 with
   netSpeed** — selecting on it breeds fast swimmers and leaves the gene drifting.
   Run the identical trial with the gene zeroed and score the difference.
4. **It needs its own gait adapter.** `adaptGait` hill-climbs *net speed*
   (`objective.js:158-160`). Reusing it would optimise one quantity and select on
   another.

---

## 5. The plan

### Step 0 — DONE. The duel matrix was re-run, and the diagnosis changed.

**Result: C2 is still blocked, but not by what the obligations said.** The recorded
blocker was the drag law. The drag law is fixed and the duels still do not capture —
for a sharper reason.

Measured with `tools/c2duel.js`, `c2diag.js`, `c2sweep.js` after the C6 work:

| | before | after |
|---|---|---|
| captures, 84 duels at spec separation | 0 | **0** |
| duels aborting as unstable | ~16–33% | **0** |
| pairs ending nearer than they began | — | **26 / 28** |
| median closest approach, outside reach sum | — | **0.28 cm** (best pair **overlapped** by 6.06) |
| captures at 0.5× reach sum | 6/45 | **10/29** |

**The stability half is completely resolved**, and creatures now get within a third of
a centimetre of contact. But the sweep is what settles it:

```
 mult   duels  capture  stalemate  unstable   median closing
 0.50      29       10         19         0       0.17
 0.75      20        0         20         0       0.21
 1.00      14        0         14         0       0.18
 1.50       9        0          9         0       0.20
 2.00       5        0          5         0       0.16
```

**Closing is FLAT at ~0.2 cm across a 4× range of starting separation.** Closing that
does not depend on the gap is **drift, not approach** — a creature that were actually
closing would close further when it started further away. Captures happen only where
the envelopes already overlap and 0.2 cm of drift is enough to touch.

**So: C2 needs pursuit, pursuit needs orientation, and orientation is the open
problem** (turn rate ~0.2 °/s — a creature cannot aim at anything inside a 15 s duel).
**Locomotion is no longer the blocker. Aiming is.** Do not spend another session on
thrust for C2. The obligations in `gate/duel.js` have been rewritten to say this.

This *confirms* the ordering below rather than changing it: the food path needs no
aiming, and it is the one that can move now.

### Step 1 — B5, the art pass. PARTLY DONE, informally.

`B5 · First light` was never started as a session, but the tank has been critiqued and
reworked: the top scrim removed, chrome given its own contrast over water
(`--c-on-water`), the scale legend made legible, motes spread over 27× the volume and
slowed off a one-way drift that implied a current, sun shafts given a third motion.
The **Forage** screen was built to the same look.

Still owed: `B3` and `B4`'s human checkpoints — both say "watch the tank screen with a
person" and both are unsigned.

### Step 2 — food. DONE as a harness; the gene is not.

`engine/l2/forage.js`, `ui/screens/forage.js`, the **Forage** tab. Six creatures from
the Atlas share one tank and compete for one depleting field. See
`HANDOVER-FORAGE.md` §5 for the three model faults found and fixed along the way.

Against §4's four conditions:

1. **Local depletion** — yes. No diffusion at all, so depletion is strictly monotone
   and `eaten` is exactly the field's loss.
2. **Kinesis, not taxis** — **NOT DONE.** There is no gene. Creatures forage by
   swimming into food, not by sensing it. This is the next step.
3. **Control-subtracted** — **NOT DONE**, and it cannot be until (2) exists: there is
   no behaviour to disable. `eaten` is "food found", not "foraging skill".
4. **Its own gait adapter** — not yet needed, because nothing selects on food yet.

**Scope flag, honoured rather than drifted past:** this is D-tier work sitting before
C2 and D1, and it was taken knowingly. It is still L2 — real bodies, real fluid, no
compiled records — and it is not D1.

### Step 2b — the MOUTH GENE, and it is the next thing to do

`mouthsOf()` derives one mouth on the root body. Placement and **count** should be
genes: the same shape the sensor gains already have, and **the same shape eyes will
need**. That is one `GENOME_V` bump with a migration, factory support and a mutation
operator — worth spending once, and now is the once, because the model it serves has
been measured. **Only `mouthsOf()` changes.**

Do this before the kinesis gene: they are the same schema decision, and doing them
together costs one migration instead of two.

### Step 3 — orientation, and only then light

Light-following is the Sims demo and it is the natural finale. It has already been run
and it failed honestly: closest approach 2.92–2.99 cm against a 3.00 cm start —
*nobody gets near the light in either arm*. It needs orientation, and orientation is
the open research question. Do not attempt it before then.

### Not scheduled

`MUSCLE_STRESS → 2e6` (blocked on `STABLE_SPEED`), D1/D2/E1 (blocked on C2 and on
turn rate), skin friction / wake / circulatory lift (need a different geometry).

---

## 5b. The order, as it now stands

1. **Mouth + sensor placement genes** (`GENOME_V` bump). Unlocks eyes too.
2. **Kinesis gene** — sense local food, modulate `effort`. Sign evolved, not declared.
   Same migration as (1) if done together.
3. **Control-subtracted forage objective**, which (2) makes possible for the first
   time. Only then may anything select on food.
4. **Orientation** — the open research question, and the gate on both C2's capability
   card and light-following. Do not attempt light before it.
5. D1 / D2 / E1, still blocked on C2 and on turn rate.

**Not scheduled:** `MUSCLE_STRESS → 2e6` (blocked on `STABLE_SPEED`), skin friction,
wake modelling, circulatory lift.

---

## 6. Debts this file does not discharge

- **Two normative planning docs are missing from the repo.** Recover or re-write
  `DESIGN-PHASE-B2` and the C0–C6 plan, or accept that ~40 gate comments cite
  documents nobody can read.
- **`CHANGELOG.md` is 8 patch versions stale.**
- **Nothing has ever been persisted.** `store.js` has the whole envelope/migration
  layer; grepping for `KEY.` outside it returns nothing. The Atlas is nine lines and
  its comment is false.
- **B3 and B4's human checkpoints are still unsigned.** Both say "watch the tank
  screen with a person". That is now overdue by many sessions.
- **`FOOD_ENERGY` is calibrated, not derived**, and has moved three times as the
  harvest model changed. Recalibrate whenever `forageStep` or the trial length moves.
- **The forage objective is not control-subtracted** and must not be selected on yet.
- **`_myria2.json` no longer reproduces the tear-apart**, so added mass's stability
  benefit is unproven and needs a fresh repro.
- **`_dragmicro.mjs`'s "ratio 1.000 to 30 m/s" is stale** — above `STABLE_SPEED` it
  measures the clamp.

---

## Study — can Tank and Forage be merged? (asked, not decided)

**Short answer: the engine does not prevent it, and a Breed button on Forage would
work today. What is not ready is the automated half — Burst — and the reason is the
same one Step 2b names.**

### What is NOT in the way (checked, not assumed)

**Breeding never touches the on-screen simulation.** `doBreed()`
([tank.js:994](vivarioops/ui/screens/tank.js:994)) takes `genomes`, `selected` and an
rng, and calls `breed({ RAPIER, genomes, selected, rng, world: W1_SLICE })`. No slot,
no arena, no pose. `runBurst` scores through `scoreBy(RAPIER, obj, [pop[i]],
W1_SLICE)` and `adaptGait(...)` — **fresh headless sims in the canonical world**, never
the display arena. So "private tiled arenas" versus "one shared arena" cannot affect
what breeding produces. It only affects what you WATCH.

The selection state is already identical — Forage now carries the tank's `Set`, ring,
tap and long-press verbatim (HANDOVER-FORAGE §10a). Wiring `Breed` to `doBreed` is
genuinely "and off you go".

### What IS in the way

**1. The two arenas are mutually exclusive, and choosing between them chooses the
experiment.** The tank gives each creature a PRIVATE sim on an invisible 2×3 grid
(`layoutGrid`, [tank.js:212](vivarioops/ui/screens/tank.js:212)) precisely so they
cannot touch. Forage gives them ONE `createArena` + `stepAll`, so they collide and
compete. A merged screen must pick:

| | you see | "keep the best" means |
|---|---|---|
| private, six food fields | each creature's own foraging | its own performance — comparable, reproducible |
| shared, one field | rivalry | partly **who got the good spawn** |

`foodEaten()` already takes the first side for scoring — "A FRESH FIELD PER CREATURE,
or the trial order decides the result". A shared display tank next to private scoring
is defensible, but the screen would then be showing something other than what it
selects on, and that has to be said out loud rather than discovered.

**2. There is no trustworthy forage objective, and that is the real blocker.**
`OBJECTIVES` carries exactly three — Speed, Size, Span — each with a `trusted` flag
whose whole purpose is to record whether the number means anything.
`foodEaten()` would have to ship `trusted: false`: it is **not control-subtracted**,
and the seek objective already taught what that costs (raw seek score correlated 0.90
with netSpeed, so it bred fast swimmers and left the sensor gain drifting).
Subtraction needs a behaviour to disable; the kinesis gene does not exist.

So: **Breed (manual, by eye) is honest today. Burst on "Food eaten" is not.** That
split is the answer to the question.

**3. Small, real, and cheap:** Forage has no persistence (the tank has `vivariumSeed`,
`persistLineage`, one-step undo); the water/atmosphere is sized from the grid in one
and from `tankBounds` in the other; `R4` pins five tabs
([runtime.js:146](vivarioops/gate/runtime.js:146)) so dropping one is a literal edit;
and the combined per-frame load is six bodies plus 1400 proximity tests plus, during a
burst, dozens of headless sims.

### Recommendation

**Do not merge the screens yet. Add `Breed` to Forage instead** — it reuses machinery
that already exists, it makes food part of the loop rather than a museum, and
breeding-by-eye on a depleting field is exactly the fun the project is after. Keep
Tank as the controlled comparison, where a creature is measured on its own.

Revisit the merge **after Step 2b (the mouth gene)**, when placement and count are
heritable, a control subtraction has something to disable, and a forage objective can
be offered with `trusted: true`. At that point the two screens are answering the same
question and keeping both is the redundancy.

---

## Study — why is tank size so deeply embedded, and can it be free? (MEASURED)

**The short version: it is not the SIZE that is embedded, it is the HASH, and the
hash is now over-broad. Measured, tank size does not reach a single number the game
selects on.**

### The measurement (`tools/_zsize.mjs`)

Same 10 genomes, same `Speed` objective, four tank sizes spanning 8×:

| | 1× (32³) | 2× | 4× | 8× | max rel. diff |
|---|---|---|---|---|---|
| every creature | — | — | — | — | **0.0e+0** |

**Bit-identical.** Not close — identical. The reason is in
[objective.js:62](vivarioops/engine/l2/objective.js:62): scoring already runs
`bounded: false, wrap: true`. **Selection happens on the torus, in a world with no
walls at all.** Tank size can only reach it through `wrapExtent`, the torus period,
and [physics.js:761](vivarioops/engine/l1/physics.js:761) reconstructs the centre as
if the tank were unbounded, so a wrap is invisible to a measurement — as designed.

Viability reads `tankBounds` too ([viability.js:225,238](vivarioops/engine/l1/viability.js:225))
but only to REJECT creatures too big for the tank. **Growing the tank can only ever
relax it** — 0 oversize rejections at every scale, against a corpus of radius
1.62–5.45 cm.

### So what does tank size actually change?

1. **Duel placement** — [duel.js:145](vivarioops/engine/l2/duel.js:145) starts the
   pair from the half-extents. This one is real. But C2 already records the tank as
   **too small for its own spec** (start separation `k × (reachA + reachB)` was
   "unsatisfiable" and had to be clamped), so a wider tank *repairs* that rather than
   breaking it.
2. **Food density** — [forage.js:165](vivarioops/engine/l2/forage.js:165) spreads
   `FOOD_COUNT` over the volume, so a bigger tank at fixed count is a sparser field.
   Fixed by scaling the count with volume.
3. **What the player watches**, which is the whole reason the question came up.

### What is possible, and what each costs

**(a) Bump and widen — 2× now.** `tankBounds → [64,48,64]`, `faunaVersion 5 → 6`, one
gate pin. ~30 minutes. Invalidates every compiled Species record, which is what the
mechanism is FOR and not a loss — but it buys a one-off, and the next size change
costs the same again.

**(b) SPLIT THE FIELD — this is the real answer.** One field is doing two jobs:

| meaning | who needs it | should it be stable? |
|---|---|---|
| **the habitat** — how much room, what you watch | the screens, the forage trial | **no — free** |
| **the measurement volume** — torus period, oversize limit | scoring, viability, records | **yes** |

Add an unhashed `habitatBounds`; keep `tankBounds` hashed as the canonical
measurement volume. **Adding an unhashed field does not change `worldHash`, so this
costs ZERO invalidation** — no bump, no re-freeze, K5 unaffected (it checks the hashed
path list, which does not move). Afterwards the habitat is freely editable forever,
including from a Settings slider. Cost: one schema entry, and a deliberate decision at
each of the ~7 `tankBounds` consumers about which of the two it actually wants —
which is work worth doing anyway, because right now they are all guessing.

**(c) No walls at all** — the boundless tank. Blocked by a real thing, and it is
written down: [physics.js:711](vivarioops/engine/l1/physics.js:711) — *"WRAPPING IS
SAFE HERE FOR A SPECIFIC REASON — creatures do not interact... The day that stops
being true this needs a periodic broad-phase, not a translate."* **Forage is that
day.** Wrapping a shared arena needs ghost copies of every body within one wrap
distance of each seam so contacts work across it; Rapier has no periodic world. One
to two sittings, and a genuine source of subtle bugs (a creature colliding with its
own ghost).

### Recommendation

**Do (b), and take the 2× as its first free consequence.** It is barely more work than
(a), it costs no invalidation at all, and it turns "the aquarium is too small" from a
session into a number anyone can change. Keep (c) available for when boundless
wandering is actually the point — it is a real feature, not a workaround, and it
should be costed on its own.

---

## Study — how to make the OPEN environment watchable, not just headless

**The measurement forced the question.** `tools/_zthrive.mjs` ran the player's own
Atlas cast for 66 minutes each, open water against walls (HANDOVER-FORAGE §12):

| creature | eaten OPEN | eaten WALLED | | multiplier |
|---|---|---|---|---|
| Drifter | 26.57 g | 5.79 g | **4.6×** | 8.90 → 8.41 |
| Polypoda multipes | 44.04 g | 11.05 g | **4.0×** | 0.22 → 0.22 |
| Darter | 22.07 g | 8.57 g | **2.6×** | **6.91 → 1.96** |
| Eel | 12.23 g | 5.92 g | 2.1× | 11.91 → 8.38 |
| Paddletail | 8.82 g | 8.72 g | 1.01× | 8.19 → 8.82 |
| **Flapper** | **5.641 g** | **5.641 g** | **1.00×** | **5.14 → 5.14** |

**Flapper is bit-identical in both arms** — it never travels far enough to meet a
wall, so the boundary costs it nothing. Darter changes VERDICT: walled it merely
survives, open it thrives. The walls do not add noise, they re-rank.

### THE KEY FACT: an unbounded SHARED arena already works

`createArena(RAPIER, world, { bounded: false })` is supported today —
[physics.js:255](vivarioops/engine/l1/physics.js:255), *"false builds an open
volume"*. The wall colliders are simply not created. **Creatures still collide with
each other normally. No wrap, therefore no periodic broad-phase, therefore none of
the blocker at physics.js:711.**

So the open world is not blocked by physics. It is blocked by **food**: `makeFood`
generates items inside `world.tankBounds`, and past that edge there is nothing to eat.
That is the entire gap.

### Two ways to close it

**(T) TILED TORUS — private wrapped sim per creature, laid out like the Tank.**
Exactly what `_zthrive` measures, so screen and harness would agree by construction.
Reuses the Tank's existing tiled-arena architecture; **no new physics at all**. The
creature wraps, so the trail needs a break at each wrap event (and optionally ghost
copies at ±extent so the seam reads as continuous). **Cost: they stop competing for
one field** — though `foodEaten` already argues a fresh field per creature is the
CORRECT comparison, so this is arguably a feature. ~1 sitting.

**(O) OPEN OCEAN — shared unbounded arena, procedurally chunked infinite food.**
`bounded: false`, and food generated on demand: hash a chunk coordinate into a
deterministic set of items, keep a sparse Map of what has been eaten. Infinite extent,
identical density everywhere, memory proportional only to where creatures have
actually been. Rivalry is preserved and the space is genuinely open — no wrap, no
seam, no ghosts.

  What it needs beyond the food: **a following camera** (they disperse, so a fixed
  frame loses them — auto-fit the cast's bounding box, plus a "follow the selected
  creature" mode that the new trail highlight already sets up), and the water/mote
  atmosphere re-anchored to the camera instead of to a box. ~1–2 sittings.

  Honest risk: with nothing to hold them together the cast spreads until an auto-fit
  camera shows six specks. That is a true picture of an open ocean and may simply not
  be fun to watch — which is an argument for making "follow one creature" the default
  view rather than a mode.

### Recommendation

**(O).** It is what was actually asked for — creatures wandering in unbounded space —
the physics flag already exists, and the only genuinely new component is a chunked
food field, which is self-contained and testable on its own. Keep (T) as the fallback
if the dispersal turns out to make it unwatchable, since it costs no new physics.

**Do NOT ship either as a replacement for the bounded screen.** The walls are a real
habitat and the crowded tank is a legitimate (different) experiment; the open world is
the one that measures foraging rather than cornering. Both should exist, and the
screen should say which one it is running.

---

## DESIGN — Aquarium vs Open ocean: one screen, two habitats

### The decision: a MODE inside Forage, not a new tab

**Not a new tab.** The two habitats share ~90% of the screen — cast picker, ledger,
trails, selection rings, layer toggles, speed, stats sheet. A second tab means either
duplicating ~900 lines (which will drift within two sittings) or a refactor into a
shared module that is more work than the feature. Six entries is also too many for a
phone tab bar.

**And comparing them IS the feature.** `_zthrive` measured Darter at 1.96× walled and
6.91× open — same animal, different verdict. One tap between arms is the whole point;
a tab switch that respawns from scratch is the same thing with more ceremony.

**But the mode must not hide in the chip row.** `Cast / Trails / Food / 4× / Reset` is
a row of adjustments; the habitat is not an adjustment, it is *which experiment you are
running*. It goes in the **title row as a two-segment control**, and the readout names
it, so a screenshot is self-describing:

```
  [ Aquarium | Open ocean ]   6 foraging · 6m 14s
  Food 279 g of 300 · 7% grazed
```

Switching **respawns** — different arena, different field, the clock restarts. That is
honest rather than convenient: the two are not the same trial.

### What differs, and it is a short list

| | Aquarium | Open ocean |
|---|---|---|
| arena | `bounded: true, bounds: habitatBounds` | **`bounded: false`** |
| food | finite field over `habitatBounds` | **chunked, infinite** |
| glass | drawn | none |
| camera | framed to the box | **follows** |
| readout | `279 g of 300 · 7% grazed` | `eaten 12.4 g · density 0.9x` |

Everything else is shared verbatim.

### The one new component: chunked food

**And it is already a drop-in.** `forageStep` no longer scans `food.items`; it reads
`food.grid` / `food.cellSide` / `food.tick`. Any object providing those three plus
`remaining()` / `eatenCount()` works. Measured: **8× the field costs 10% more wall
time** (1400 → 11200 items, 1.67 s → 1.84 s per 300 s trial), because the cost is now
O(mouths) rather than O(field). Before the grid it was a linear scan of every item on
every step, and an infinite field was simply impossible.

So `makeChunkedFood(world, opts)`:
- **Chunk** = a cube (start at 16 cm) identified by integer coords. Its items are
  generated deterministically from `hash3(cx, cy, cz, seed)` — the same hash the patchy
  field already uses — so the ocean is infinite, reproducible, and needs no storage
  until visited.
- `ensureAround(points)` each step: materialise the 3×3×3 chunks around every mouth and
  splice them into `grid`. Cost is bounded by mouths, not by ocean size.
- Density matches `habitatBounds`' exactly, so the ocean and the aquarium are the same
  water — which is what makes the A/B mean anything.
- Chunks are never evicted. Memory grows with **explored** volume only, the same way
  the trail buffer already does.

**A real consequence to design for, not paper over:** `initialTotal`, `remaining()` and
`% grazed` are meaningless in an infinite field. The ocean readout must switch to
absolute grams eaten plus *local* density, or it will print a lie.

### Camera: follow, and default to following

They disperse — that is the point — so a fixed frame loses them and an auto-fit frame
eventually shows six specks. **Default to following the selected creature**, which the
trail highlight already sets up, and fall back to auto-fitting the cast when nothing is
selected. Water and motes re-anchor to the camera instead of to a box.

### Order of work

1. `makeChunkedFood` + its own tool — testable alone, against the finite field.
2. The mode control and the `bounded: false` arm.
3. Follow camera, then the ocean readout.

