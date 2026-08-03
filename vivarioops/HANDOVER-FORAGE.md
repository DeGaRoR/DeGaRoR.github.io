# Handover — the fluid model closed out, and food

Continues `HANDOVER-SESSION10.md`. Gate at close: **GREEN, 94 assertions, 90 passed,
0 failed, 4 pending, 4464 checks.** Committed at `08cc2cc`.

Read `ROADMAP.md` first — it is the new entry point and it explains why "C1" means
three different things in this repo.

Run `cd vivarioops && npm install && npm run vendor && npm run gate`.

---

## 1. The one-line story

**The fluid model is finished and the engine work should stop.** Three defects were
found by measurement and fixed; the fourth was measured false and retired. Then the
duel matrix was re-run against the new physics, and the answer changed what the
project is blocked on: **locomotion is no longer the blocker for C2 — aiming is.**

With the engine closed, the session went where `PLAN-AFTER-B2` §2 said to go: a
depletable food field, on its own screen, with an energy ledger.

---

## 2. What is verified and should not be re-examined

| | evidence |
|---|---|
| the lift term was wrong | cross-flow ratio **−0.200** at every incidence 5–75°; gate **L1-45**, mutation-tested red |
| the quadrature under-resolved rotation | delivered torque **0.500** of the law's own continuum value, flat in ω; now **0.875** |
| added mass buys speed, it does not cost it | net speed **+31%**, cost of transport **−37%**, body inertia **×1.90** median |
| the momentum guards were degenerate | at ω = 0 with any torque, `sc = 0` discarded the ENTIRE fluid force |
| the duel blocker is aiming, not thrust | closing is **flat at ~0.2 cm** across a 4× range of start separation |
| food intake is now size-fair | `eaten` vs mass **0.94 → −0.18**; vs swimming **−0.37 → +0.68** |

---

## 3. What changed in the engine

**Units are CGS** (cm, g, s). This was always true — density relative to water with
`mass = density × volume` *is* the g/cm³ convention — but the labels said "m" and
"kg" together, which is not any consistent system. Naming it makes every constant
citable. Three debts recorded in the `physics.js` header: `MUSCLE_STRESS` reads as
20 Pa and is **scheduled** to become `2e6`; `gravity` must become `981` before the
density band unpins at step F; the constant-`Cd` drag law wants `Re ≳ 10³` and the
corpus sits at ~32.

**The lift term is deleted.** It applied the reference's `Cl` block on top of a drag
term already applied along `−n`, which *already contains* Newtonian lift. Measured,
the combination cut a plate's cross-flow force to a fifth **and reversed it**.
`opts.lift` is gone. Gate **L1-45** holds the sign, and `tools/_zplate.mjs` test B
keeps modelling the deleted term *locally*, so the evidence outlives the code.

**Face quadrature is 4×4** (`QUAD = 4`, 96 samples). Costs **+6%** hot loop, not 4× —
Rapier's solve dominates. `QUAD = 2` reproduces the old table exactly if ever needed.

**The momentum guards project onto the opposed component.** They used total speed, so
a body with a denormal torque and zero spin lost everything. This is the retired
"C6.1" un-retired: it was correct to retire on the evidence *at 2×2*, and wrong the
moment the quadrature changed. **An assertion-free corner that is unreachable today
is not absent — it is waiting for the change that reaches it.**

**Added mass is on.** `setAdditionalMassProperties`, verified present in the pinned
rapier3d-compat 0.19.3. Two traps: Rapier **defers the merge** (reads before the
first `step()` are stale — fixed with `recomputeMassPropertiesFromColliders()`), and
its translational added mass is a **scalar**, so for a plate it takes the edgewise
value and is nearly inert. The anisotropic *inertia* is where the whole effect lives.

**`stepAll` now clamps.** The duel path ran with no speed or spin ceiling, in the one
place two creatures collide. `step()` is untouched, so solo determinism did not move.

**Tank widened to `[32, 24, 32]`, `engagementK` 4.0 → 2.0.** Both specs were
unsatisfiable at once. `faunaVersion` 3 → 4 → 5, residents re-frozen twice.

---

## 4. The C2 re-measure — read this before touching thrust

| | before | after |
|---|---|---|
| captures, 84 duels | 0 | **0** |
| duels aborting unstable | ~16–33% | **0** |
| pairs ending nearer | — | **26 / 28** |
| median closest approach outside reach sum | — | **0.28 cm** (best **overlapped** by 6.06) |

```
 mult   duels  capture  stalemate  unstable   median closing
 0.50      29       10         19         0       0.17
 0.75      20        0         20         0       0.21
 1.00      14        0         14         0       0.18
 1.50       9        0          9         0       0.20
 2.00       5        0          5         0       0.16
```

**Closing does not depend on the gap.** That is drift, not approach — something
actually closing would close further when it started further away. Captures happen
only where the envelopes already overlap, which is *below* the floor `duelSetup`
deliberately defends.

**C2 needs pursuit → pursuit needs orientation → orientation is broken** (~0.2 °/s).
The obligations in `gate/duel.js` have been rewritten to say this. Do not spend
another session on thrust for C2.

Also: growing the tank grew the *creatures* (`fitsTank` admits reach 12.1 where it
capped at 5.5), so `k × reachSum` grew with it. **11 §6 can never be satisfied by
growing the tank.**

---

## 5. Food — new, and the shape of it matters

`engine/l2/forage.js` + `ui/screens/forage.js` + the **Forage** tab.

**It is L2, not L3.** L3 is defined by its *representation* — point agents, 2D, no
physics — and a creature with real joints in real fluid cannot be represented there.
This is a harness plus an objective, the third category `objective.js` carved out.

**Food is THINGS, not a field.** Discrete items with a position, a mass and an
invisible proximity radius. A creature eats through a **MOUTH** — a point, not a
volume — so a point is the same size on a 2 cm creature as on a 12 cm one.

**Three model faults were found and fixed by measurement, in order:**

1. **Scalar density on a grid, absorbed over the body.** Read as glowing graph paper,
   and intake correlated with mass at **0.94** — the winning move was to be large and
   hold still, the exact degeneracy `PLAN-AFTER-B2` §3 names.
2. **Point-sample uptake.** Required a body's *centre* to land in a full cell. A
   creature ate 0.7 g in 155 s.
3. **The trial was 20 s.** At 0.04 cm/s a mouth travels **0.8 cm in 20 seconds** — so
   movement was irrelevant and the trial measured where the creature *spawned*.
   `FORAGE_SECONDS = 300`, with the sweep in the constant's comment.

Coverage — the fraction of tank volume a mouth is inside something — is the lever
that decides whether a point-mouth finds anything. Shipped **1400 items at r = 2.0**,
85% coverage: past ~98% the tank is uniform soup and *where* a creature goes stops
mattering.

**Six creatures share one tank**, from the **Atlas** (capped at `CAST_MAX = 6`), via
`createArena` + `stepAll`. They collide and compete for one depleting field, which
turns the ledger from *"can this creature feed itself"* into *"can it feed itself
against rivals"*. **35× realtime** headless, 0 non-finite over 300 s.

The result worth keeping:

```
   #   eaten g   in/out    verdict
   1     4.714    36.76    SURPLUS
   4     8.091     0.24    deficit     <- ate the MOST, still cannot pay for itself
   6     2.143    26.85    SURPLUS
```

---

## 6. What is owed, and what to distrust

- **`FOOD_ENERGY` is CALIBRATED, NOT DERIVED.** Derived it would be ~1e11 erg/g, at
  which the ledger runs at intake/spend ~ 7e7 and food is free by seven orders of
  magnitude. It has been recalibrated **three times** as the harvest model changed
  (1.4e3 → 6.4e3 → 2.4e5 → 4.2e4). **Recalibrate whenever `forageStep` or the trial
  length changes, and say so.**
- **The forage objective is NOT control-subtracted.** Read `eaten` as "food found",
  not "foraging skill". Subtraction needs a behaviour to disable and the kinesis gene
  does not exist yet. The seek objective taught this: raw seek score correlated 0.90
  with netSpeed.
- **The mouth is DERIVED, not genetic.** One mouth, root body, leading face. Placement
  and count should be genes — same shape the sensor gains have, same shape eyes will
  need. That is a `GENOME_V` bump with a migration; **only `mouthsOf()` changes.**
- **`_dragmicro.mjs`'s headline is stale.** `clampKinematics` runs at the top of
  `step()`, so its 30 m/s row measures the **clamp**. HYDRODYNAMICS.md §10's "ratio
  1.000, 0.1–30" now holds only to 10.
- **`_myria2.json` no longer reproduces the tear-apart** (peak 1.0 cm/s, not 60). The
  actuator work fixed that case, so added mass's stability benefit is unproven and
  needs a fresh repro.
- **On the solver path the achieved inter-joint lag is ~0–3° whatever is commanded.**
  So "π/2 beats unison" is not comparing a travelling wave against unison. This bears
  on HANDOVER-SESSION10's "the fluid model is right — 68×". It is an **actuator**
  question, not a fluid one.
- **Slip is 0.00–0.05** against a real anguilliform swimmer's 0.5–0.8. That is the
  locomotion gap in the model's own predicted units.
- **Two normative planning docs are missing from the repo** — `DESIGN-PHASE-B2` and
  the C0–C6 plan. ~40 gate comments cite documents nobody can read.
- **`CHANGELOG.md` is 8+ versions stale.** The real status board is the gate's own
  carried-obligations block.

---

## 7. Gate assertions added or amended

| id | what |
|---|---|
| **L1-45** | NEW — a plate at incidence is pushed toward its leeward side. Mutation-tested: restoring the lift term turns it red. |
| L1-18 | Third correction of the same mistake. Asserted `dense/base === 1/8`, a property of the old implementation — fluid does not get denser when flesh does. Now recovers torque as `spin × I` with `I` measured off the body. Mutation-tested. |
| L2-10 | `faunaVersion` pin 3 → 5. |
| L2-19 | Asserted score-selection beats random on **one seed, n=8, 2 generations, 1.5 s trials** — a coin flip that passed on luck. Now asserts what its own comment always claimed: the arm exists, costs the same, selects differently. |
| K7 | `engagementRadius` literal 10 → 5. |
| R4 | Tab count 4 → 5. |

---

## 8. Tools added

| tool | answers |
|---|---|
| `_zplate.mjs` | the four fluid micro-tests; the permanent record of the deleted lift term |
| `_zadded.mjs` | what added mass costs and buys, and on the pumping case |
| `_zquad.mjs` | hot-loop cost of the face quadrature |
| `_zforage.mjs` | is the food model fair, and does the ledger discriminate |
| `_zfoodsweep.mjs` | how dense must food be to be catchable |
| `_zcast.mjs` | does a shared tank of six foragers work |

---

## 9. Method notes earned this session

- **A retired finding can un-retire.** C6.1 was retired on a true measurement and
  became load-bearing three changes later. Retire on evidence; re-check on change.
- **Match the timescale to the animal.** Three separate food-model "failures" were one
  fault: a 20 s window on a creature that moves 0.04 cm/s.
- **A screenshot found a bug the harness could not.** The Rapier init-order crash and
  the food-is-a-slab problem both came from looking at the screen.
- **Calibrated is fine; unlabelled is not.** `FOOD_ENERGY` cannot be derived at this
  scale. Saying so in the constant is what keeps it honest.

---

## 10. The legibility pass — six fixes, and why each one was a real defect

Every item here came from looking at the screen, not from the gate. They are recorded
because each was a *representation* bug that made a correct simulation unreadable, and
that class of bug does not show up in any assertion.

| complaint | what was actually wrong | fix |
|---|---|---|
| "deeper movement history, forget nothing" | the trail was a sliding ring buffer — it erased exactly the evidence you open the screen for | `TRAIL_START = 2048` **doubling** to `TRAIL_CEIL = 32768`. >2 h at 4 Hz. It only forgets at the ceiling. |
| "no way to know what creature is what number" | there were no names and no colours — six rows of anonymous numbers | rows carry the binomial and a `.forage-swatch` chip in the creature's **own** `colourFrom` colour; the trail and the mouth take the same colour |
| "many numbers without units, a lot of scientific format" | ergs in the rows. `6.4e+03` is honest and unreadable | rows show grams and plain multiples (`15×`, `99+×`, `starving`) plus `6s`/`2m 30s`. **Ergs moved to the per-creature sheet**, where scientific notation is the right register |
| "no way to choose creatures from the atlas" | the cast was seeded, not chosen | `Cast` chip → `openPicker()`, toggle-select capped at `CAST_MAX = 6` |
| "horizontal plane, not ideal on the phone" | `spawnRing` used XZ, so a portrait frame saw the cast edge-on | XY ring at `W/4`, `H/3` |
| "bright white squares, much too harsh" | untextured `Points` render as **filled squares**; 1400 of them near-white on additive blending is a wall | soft round dot (`dotTexture()`, now exported from `render/tank.js`), `--forage-food: #7fd6b4`, size 4, opacity 0.42 |
| "a way to select creatures and get their stats" | nothing was pickable | tap → `pick()` on `hitRadius` (so small creatures are not harder to hit) → 10-row sheet |

**The mouth marker was wrong twice, and the second way is worth remembering.** A filled
additive sphere accumulates its own front and back faces, so the centre blows out into
a bright ball — six of those hid the animals they belonged to. It is now `side:
BackSide` (far hemisphere only, so you see the creature *through* the reach) plus a
solid `--forage-mouth-dot` at the mouth point. Position and reach are different
questions and they now have different marks.

**Method note.** All seven were found by screenshotting the running app, and none of
them could have been. The gate checks that the numbers are right; it has no way to
check that a number is *readable* or that a marker does not obscure its subject.

### 10a. Selection now IS the tank's selection

The forage screen had invented its own gesture: **tap opened a modal sheet**. So
choosing a creature to watch meant reading a sheet and dismissing it, there was no
persistent mark saying which one you had chosen, and the two screens showing the same
animals answered the same finger differently. Replaced wholesale with tank.js's:

| gesture | before | now (= tank) |
|---|---|---|
| tap a creature | opened the stats sheet | toggles a **selection ring** |
| tap open water | closed the sheet | clears the selection |
| long-press a creature | — | opens the stats sheet |
| tap a row | opened the sheet | toggles the same ring |
| long-press a row | — | opens the stats sheet |

The ring is `RingGeometry(0.92, 1.0, 48)` in `--c-select`, `depthTest: false`,
`renderOrder 10`, scaled `max(radius*1.4, 1)` and re-aimed at the camera **every
frame** — copied from tank.js:318 rather than re-derived, because a DOM overlay lags
the WebGL canvas by a frame and visibly slides off the body during orbit. Selection is
a `Set`, multi-select, same as the tank. Row highlight moved from an underline (which
says "hyperlink", not "selected") to `--c-select-tint` + a `--c-select` left bar, so
the row and the ring speak the same colour.

**Three latent defects fell out of wiring it, all of the same class — the pointer path
reads state that only `frame()` maintains:**

1. **`c.world` was only refreshed on sim steps.** Spawn then pause, and every
   creature's pick-and-ring position is the origin. `spawn()` now poses the cast once
   before the first step.
2. **The camera was only positioned inside `frame()`.** `pick()` raycasts *from* it,
   so a gesture arriving before the first rAF hit-tested from the constructor default
   at the origin. Extracted as `placeCamera()`, called from `spawn()` and `frame()`.
3. **`view.setPointerCapture()` throws `NotFoundError`** for a pointer id the browser
   is not tracking, and it sat *above* the lines that initialise the gesture — so a
   throw left `drag`/`down` unset and every later tap silently did nothing. Now
   wrapped. **Fixed in `tank.js` too**, which had the identical ordering.

None of the three is reachable through ordinary use, which is exactly why they had
survived: rAF always wins the race against a human finger. They are reachable the
moment anything drives the screen that is not a human finger.

---

## 11. The trajectory is a noisy signal, and this is how noisy — MEASURED

`tools/_ztrail.mjs`, 12 creatures, shared arena, 300 s, mouth sampled at 4 Hz (what
the screen keeps), food radius 2 cm.

### The ruler decides the answer

The SAME trajectory, measured three ways:

| ruler | mean "distance travelled" | share of the 4 Hz figure |
|---|---|---|
| 0.25 s (what the trail stores) | **371 cm** | 100% |
| 1 s | 105 cm | 28% |
| 4 s | 33 cm | **9%** |

**An 11× spread from the sampling interval alone.** Path length is not a property of
the path, it is a property of the path AND the ruler — the coastline paradox, and it
means no "distance travelled" may ever be printed without its sampling scale. At the
screen's own 4 Hz, **91% of the number is wiggle.**

Same thing in volume: the mouth's naive swept tube (`L × πr²`) is 4662 cm³ against a
true union of **285 cm³**. **94% of "swept" water is re-visits** — the scribble balls
on the screen are the animal eating water it has already stripped.

### Which metric actually predicts eating

Pearson against `eaten`, n = 12 — indicative, not established:

| metric | r |
|---|---|
| net displacement | **0.715** |
| path length @ 4 s | 0.691 |
| radius of gyration | 0.676 |
| explored volume (swept-sphere union) | 0.671 |
| straightness (net / L@1s) | 0.550 |
| path length @ 1 s | 0.540 |
| path length @ 0.25 s | **0.513** |
| naive swept volume | 0.513 (it is L@0.25s rescaled) |

**The correlation rises monotonically as the ruler coarsens** — 0.513 → 0.540 → 0.691.
That is the quantitative form of "it's basically noisy signal": the fine detail is not
merely uninformative, it is *anti*-informative, and the finest ruler is the worst
predictor on the list.

**My prediction was wrong.** I expected the swept-sphere union to win clearly, because
it is the mechanistically right quantity — the water the mouth could have reached, with
overlap removed. It lands at 0.671, tied with gyration and below plain net
displacement. In a roughly uniform field, "did it get to fresh water at all" carries
most of the signal, and the geometry of how it got there carries little.

### What to do with that

- **Never print path length at 4 Hz.** It is the worst number available and it looks
  like the most precise one.
- **A readout wants explored volume, not net displacement**, despite net displacement
  scoring higher here: net displacement is blind to a return trip and decays toward
  meaninglessness as trials lengthen, while the union only grows. Over 300 s they
  agree; over an hour they will not.
- **Everything above is free.** `c.trailPos` already holds mouth positions at 4 Hz —
  every metric here is a read over a buffer the screen keeps anyway.
- **`eaten / exploredVolume` is a real foraging EFFICIENCY** — food found per unit of
  water searched — and it is the natural place a control subtraction would attach when
  the kinesis gene exists.

**Caveats, stated because n is small:** one seed, one 300 s trial, a shared arena (so a
creature's result depends on its neighbours), and 12 creatures. Re-run before any of
this is quoted as settled.

### Two mistakes worth keeping

1. **The first `exploredVol` was too coarse to test its own hypothesis.** One voxel of
   side `2r` per sample gave 1–12 cells over a whole trial, so the metric was quantised
   to about ten values and its correlation (0.468) was measuring the quantisation, not
   the biology. A cell approximating a radius must be well BELOW it, and every cell
   within `r` of a sample must be marked — not just the one the sample landed in.
2. **The naive swept column is not an independent metric.** `L × πr²` is path length
   times a constant, so it correlates identically (0.513). Kept in the table precisely
   to show that: it is what you get if you trust path length, and it is worth 94% less
   than it claims.

---

## 12. THE MULTIPLIER IS THE SELECTOR — and the walls were censoring it

`tools/_zthrive.mjs`. One hour of simulation per creature, each in its OWN sim with
its OWN fresh copy of the same field, ranked on `intake / spend`. **221× realtime** —
an hour per creature in 16 s.

### Open water costs nothing to run, and the screen cannot have it

The Forage SCREEN must run bounded: the cast shares one arena, and
[physics.js:711](vivarioops/engine/l1/physics.js:711) permits wrapping only while
creatures do not interact. **A one-creature-per-trial harness has no such problem** —
and `foodEaten` already required exactly that ("a fresh field per creature, or the
trial order decides the result"). So `simOpts: { bounded: false, wrap: true }` is the
whole change. The field is generated over the wrap extent and the wrap keeps the body
inside it, so **the field is periodic by construction and its density is exactly the
tank's**: a creature may swim forever and keeps meeting food, while depletion still
means something because the field is finite.

### The A/B — same 8 creatures, same hour, walls on vs off

| # | creature | mass g | eaten OPEN | eaten WALLED | ×|
|---|---|---|---|---|---|
| 3 | Oligopterus radiatus | 6.32 | **298.9** (field stripped) | 15.7 | **19×** |
| 4 | Polycheirus multipes | 32.89 | **251.2** | 6.7 | **37×** |
| 1 | Mesoanguillops elongatus | 0.97 | 12.0 | 5.9 | 2× |
| 6, 7, 8 | (barely move) | 1.5–2.3 | — | identical | 1× |

**The walls do not add noise, they censor systematically.** The creatures that
actually travel ate 19× and 37× less against glass; the ones that never reach a wall
are bit-identical in both arms. The walled tank ranks *the ability to not go anywhere*.

### The finding that matters most: the multiplier is currently a SIZE selector

    multiplier vs mass:  r = -0.863  (log-log, open water, saturated excluded)
    multiplier vs mass:  r = -0.887  (log-log, walled)

Nearly identical in both arms, so this is **intrinsic, not a wall artefact**. The
mechanism is structural: basal cost scales with mass (Kleiber), while intake is capped
by ONE mouth of FIXED radius. A 33 g creature pays ~13× the basal of a 1 g one and
cannot possibly eat 13× more through the same 2 cm mouth.

**This is not a defect of the multiplier. It is a defect of the fixed mouth — a whale
has a big mouth.** It is therefore the sharpest possible argument for **Step 2b, the
mouth gene**: once placement and COUNT are heritable, mouth area can scale with the
animal and the multiplier stops being a small-creature ranking. Until then, read the
multiplier as "energy balance for this body plan AT THIS SIZE" and expect selection on
it to shrink the corpus.

### Two hazards this surfaced

1. **Saturation.** Over an hour the best forager stripped 100% of the field. Its
   multiplier is then a FLOOR set by how much food existed, not a measurement of the
   animal, and must not be ranked against unsaturated creatures. The tool marks it
   with `!`. **An hour-long trial needs a field sized for an hour** — raise `total`
   in `makeFood`, or shorten the trial.
2. **Thresholds are editorial.** `<1 dies / 1–2 survives / >=2 thrives`. The 1 line is
   real (spending more than you eat); the 2 line is a judgement about how much surplus
   growth and reproduction need, and it is the first number to revisit at D1.

**Caveats:** n = 8, one seed, one field. Indicative.

---

## 13. Speed control on Forage

`FORAGE_SPEEDS = [1, 2, 4, 8, 16, 32]`, deliberately longer than the tank's
`SPEEDS = [1, 2, 4]`. The tank's ladder is right for the tank — you watch six
creatures and decide which to breed, a decision made in seconds. **Forage is a
different timescale:** at 300 s the field is 2% grazed and a starving creature and a
thriving one both read "about 1×". The trial that discriminates is an hour.

The high rungs are **aspirational, not guaranteed** — `stepBudget` caps the steps one
frame may run (deliberately, so a stalled frame cannot spiral). When it drops steps
the chip dims itself via `data-on="no"`, the same vocabulary the layer toggles use. A
speed control that silently lies about its rate makes every long trial unreproducible.

---

## 14. The torus is not on screen anywhere — confirmed

Asked directly, so it is written down. `wrap` defaults to **false**, and neither
screen passes it: `tank.js:302` calls `createSimulation(RAPIER, plan, genome, TANK)`
with no opts, and `forage.js` passes `wrap: false` explicitly. **Both screens run
bounded, with real walls.** The torus exists in exactly one place —
[objective.js:62](vivarioops/engine/l2/objective.js:62), `bounded: false, wrap: true`
— which is the headless scoring path, plus now `_zthrive.mjs`.

So: **everything the player watches has walls; everything the game scores on does
not.** That gap is the reason `tools/_zsize.mjs` finds tank size bit-identical across
8× (§ROADMAP tank-size study), and it is the reason the screen and the trial disagree
about who the good foragers are.

---

## 15. The chunked ocean — step 1 of the open-water screen. DONE.

`makeChunkedFood(world, opts)` in `engine/l2/forage.js`, checked by
`tools/_zocean.mjs`. An unbounded food field generated on demand, chunk by chunk,
only where a mouth has actually been.

### It is a drop-in, and that is entirely because of the grid

`forageStep` no longer scans `food.items`; it reads `grid` / `cellSide` / `tick`, so
**anything maintaining those three IS a food field**. Before the grid, an infinite
field was not slow — it was undefined, because the loop's cost scaled with the size of
the world rather than the number of mouths. Measured on the finite field: **8× the
items cost 10% more wall time** (1400 → 11200, 1.67 s → 1.84 s per 300 s trial), and
the totals were identical to 9 decimal places.

### Density is now volume-invariant

`FOOD_REFERENCE_VOLUME = 32*24*32` is **a literal on purpose**. Reading it from
`world.tankBounds` would mean widening the tank silently thinned the food — count fixed
at 1400 while volume grew — and every swept figure in this file would quietly stop
applying. Count and mass now follow the volume, so the aquarium and the ocean are the
same water, which is the only thing that makes the A/B mean anything.
`makeFood(W1_SLICE)` is unchanged: 1400 items, 300 g.

### Measured

    item density   0.05688 /cm3   vs tank 0.05697   (ref 0.05697)
    mass density   0.01219 g/cm3  vs tank 0.01221
    chunk seams    edge slab 1847 vs interior mean 1868.8 (interior spread 1.02x)
    determinism    same seed -> identical ocean; different seed -> different ocean
    depletion      stripped region still stripped after leaving and returning
    an hour        Darter, 3600 s in 21 s wall (172x realtime), ate 36.7 g,
                   travelled to (3.9, 93.6, 67.8) cm — 115 cm out, far outside any box
                   52 chunks materialised, 12116 items live
    conservation   field loss == creature intake, to 1e-9

**Note the escalation across the three arms** — same creature, same hour:
walled **8.57 g**, torus **22.07 g**, truly open **36.72 g**. The torus is not
equivalent to open water: a wrapped creature re-enters water it has already stripped,
and the true ocean always has fresh food ahead. Worth remembering before quoting torus
numbers as "open".

### THE DEFECT THE TOOL CAUGHT, which had been there all along

    const s = world.fertility?.seed ?? seed;      // in BOTH makeFood and the new one

**The world's fertility seed beat the caller's, so a passed `seed` did nothing** on any
world carrying one — W1 does. Every `makeFood(world, { seed })` call in the tree was
silently ignoring its argument. Caught only because `_zocean.mjs` asserts that two
different seeds give two different oceans; they did not. Now `seed ?? world.fertility
?.seed ?? 0x5EED`, so an explicit seed wins.

`tools/_zthrive.mjs` was passing `seed: FIELD_SEED` believing it selected the field. It
did not — every creature met the world's own field, which is what was wanted, but by
accident. The argument is removed so §12's numbers still describe what was run.

**A parameter that is accepted and discarded is worse than one that does not exist.**

### One of the two failures was MINE, and it is worth keeping

The first depletion check stripped grid cell `'0,0,0'` (covering x,y,z in [0,4)) and
then measured `|x| < 4` — a region including negative coordinates, which live in cell
`'-1,-1,-1'`. The two never overlapped, so it reported a defect that did not exist. A
check whose strip and whose measurement are not the same items is not a check.

### What is NOT done

- **The readout.** `initialTotal` is `Infinity` and `% grazed` is meaningless; the
  ocean arm must print absolute grams plus LOCAL density, or it prints a lie with a
  number on it. `remaining()` returns the visited region only and is honestly named
  `loadedTotal()`.
- **The mode control** (`Aquarium | Open ocean`) and the `bounded: false` screen arm.
- **The follow camera**, and re-anchoring water/motes to the camera.
- **Chunk eviction** — chunks are never freed. Memory grows with EXPLORED volume
  (12k items per creature-hour), the same way the trail buffer already does. Fine for
  now; revisit if a session runs for many hours.

---

## 16. The mode control and the open-ocean arm. DONE (rendering unverified).

### The control

Two segments in the TITLE ROW — `Aquarium | Open ocean` — not a chip in the cluster.
The cluster holds adjustments; the habitat is *which experiment is running*, and the
readout under it names the arm so a screenshot is self-describing. Switching
**respawns**: different arena, different field, clock from zero. Carrying the clock
over would imply the two were one trial.

### What actually differs — a short list, as designed

| | Aquarium | Open ocean |
|---|---|---|
| arena | `bounded: true, bounds: habitatBounds` | **`bounded: false`** |
| food | `makeFood(bounds: habitatBounds)` | **`makeChunkedFood`** |
| glass | drawn | hidden |
| camera | manual | **follows** |
| readout | `2348 g of 2400 · 2% grazed` | `Open ocean · 97.9 g taken · density 1.00x` |
| manual pan | yes | **no** — `followCast` owns the centre |

Everything else — cast picker, ledger, trails, rings, selection, speed, layer
toggles, stats sheet — is shared verbatim.

### Measured, in the screen's exact configuration

One shared arena, six Atlas creatures, 30 simulated minutes:

| | aquarium | ocean |
|---|---|---|
| Paddletail eaten | 5.16 g | **62.89 g** (12x) |
| Paddletail drift | 12.6 cm | **114.6 cm** |
| Darter drift | 4.1 cm | 29.8 cm |
| throughput | 28x realtime | **29x realtime** |

**337 chunks materialised, 78 521 items live, no throughput cost against 56x the
items.** That is the uniform grid doing its job; on the old linear scan this arm
would have been ~56x slower in ingestion alone.

### Three implementation notes worth keeping

1. **`ensureAround` runs BEFORE the step, per step.** Food that has not been
   materialised does not exist, so a creature would swim through water that is empty
   only because nobody asked for it yet.
2. **The food buffer doubles**, like the trail. `makeFood` fills a box once; the ocean
   grows, so a fixed buffer would silently stop drawing food the creature can still
   eat. Positions are written only for NEW items — food never moves, and rewriting
   78k positions per frame would be pointless.
3. **Manual pan is disabled in the ocean.** A pan offset and a follow target fight
   each other every frame. Orbit and zoom stay manual; only the centre is taken over.
   The motes follow the camera too, or the player swims out of the weather and the
   ocean goes visibly sterile.

### NOT VERIFIED: how it LOOKS

The Browser pane has been `visibilityState: hidden`, which stops `requestAnimationFrame`
entirely — so the on-screen clock reads 0 s and nothing composites. **This is not a
defect and I spent a while treating it as one.** The DOM, the control, the readout
branch and both arms' physics are confirmed; the rendering, the follow camera's feel
and the ocean's look are NOT. Next session should open the pane and look before
building on this.

**A hidden pane freezes rAF. A frozen clock in a hidden pane is evidence of nothing.**

---

## 17. Nomenclature — design 13, STAGE 1 of 2. DONE.

`design/13-NOMENCLATURE.md` implemented as far as it can go without touching the
genome schema. Gate green at **95 assertions, 5076 checks** (was 94 / 4464).

### What shipped

| 13 § | | |
|---|---|---|
| §3 | six new signature axes | `mirroredFlag, limbClass, depthClass, runClass, dofClass, angleClass` — **added alongside** the four originals, not replacing them, so the old assertions keep testing what they were written for |
| §4.1 | **24 curated families**, `-idae`, each with a body stem | every genus in *Dolichopodidae* contains `pod` |
| §4.2 | **variable-arity genus** — 1, 2 or 3 slots by tree depth | *Podus* next to *Oligosphalmatops* |
| §4.3 | **five weighted species channels** + gender agreement + intensity | descriptive 87% · habitat 11% · typicality 2% · misfit 2% |
| §5 | the token pools, verbatim | 18 P1 · 12 P2 · 20 qualities · 18 stems · 14 misfits |
| §6 | **phonotactics E1–E8**, with a deterministic fallback ladder | a rejected composition drops to the next candidate; the bare stem is always legal |
| §9.1 | `DISAMBIGUATORS` **deleted**, replaced by a suppression weight | no more "elongatus II" |

**Measured over 200 genomes:** 179 distinct binomials (**90%**, NM-16's bar exactly),
32 genera, 9 of 24 families, 107 distinct epithets, arity mix 27/66/8.

### NOT shipped — stage 2, and it needs a schema bump

`tag` (§7), author citations (§8), subspecies (§4.4), recombination scars (§10),
streaming local normalisation (§9). All of them need a `GENOME_V` bump with a
migration, and §14.3's open question — **does `tag` enter `genomeHash`?** — is
unanswered. Recommendation stands at yes; it changes every existing hash.

**`ctx` is OPTIONAL here**, against §14.1's "every caller must supply ctx". Making it
required would mean touching every call site in the same commit as a rewrite of the
generator, and then a naming defect and a plumbing defect would be indistinguishable.

### THE DESIGN DEFECT THIS FOUND: `dofClass` is dead

§5.1 indexes P1 as `limbBucket × dofClass`, 18 prefixes. **Measured over a 300-genome
corpus, every joint in this world is `revolute` or `twist` — both 1 DOF.** `dofClass`
is therefore constant and P1 would collapse from 18 prefixes to **6**.

Handled the way `density` already is: fall back to a live axis (a slenderness class),
**derived from `JOINT_TYPES` rather than listed**, so `dofClass` returns by itself the
day a multi-DOF joint type becomes reachable. §13's reachability table over-counts
until then.

Two other axes are weak rather than dead and should be read with that in mind:
`runClass` puts 270 of 300 in one bucket, and only 10 of 24 family cells are occupied.

### Three defects found by LOOKING at the output, each now a gate check

1. **`EuryProtea`, `OrthoThetia`, `IsoHydra`** — the mythological stems are stored
   capitalised (they are proper nouns) and a prefix was prepended to one. An interior
   capital is the single most obvious way a name announces it was assembled by
   machine. Stems are lowercased before composition; only the first letter is raised.
2. **`levus`, `gravus`, `mediocra`** — a blanket `-us|-is|-a` rewrite applied to
   THIRD-DECLENSION adjectives, whose masculine and feminine forms are identical.
   §4.3 names this exact error as the loudest possible tell. Now `-is`, `-ax` and
   `-ae` are left alone.
3. **73% distinct, against NM-16's 90%** — a collided descriptive epithet fell through
   to another CHANNEL, so a collision turned a described animal into `habitat` or
   `misfit`. Replaced with a LADDER: the quality still names the most extreme axis and
   only the stem moves to the next trait worth mentioning. 73% → **90%**.

**L1-46 is mutation-tested.** Restoring defect 1 gives `got 96, expected 0` interior
capitals; restoring defect 2 gives `got 2, expected 0` re-gendered adjectives. Both
name the exact fault.

### Retired

`genusSpace().length === 72` — a statement about a 4×6×3 lookup table that no longer
exists. The genus is composed now, with variable arity and phonotactic rejection, so
its space is not enumerable; §13 is explicit that occupancy must be **measured** over a
corpus, not asserted from a table. Replaced by `familySpace()` and three checks on it.
