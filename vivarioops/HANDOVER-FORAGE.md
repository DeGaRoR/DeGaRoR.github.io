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
