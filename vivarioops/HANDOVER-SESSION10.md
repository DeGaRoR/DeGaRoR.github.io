# Handover — session 10

Continues `HANDOVER-LOCOMOTION.md` (nine sessions, "buoyancy makes them move
faster than they can move on their own"). Gate at close: **GREEN, 80 assertions,
76 passed, 0 failed, 4 pending, 3310 checks.** Full detail in `SESSION-10.md`,
§§57–155; this is the operational summary.

Run `npm install && npm run vendor && npm run gate`.

---

## 1. The one-line story

The previous handover's one-line story was "the creatures were never swimming —
a PD controller saturating 52% of the time is a relay, and relays limit-cycle".
That was right. This session's is one layer down and one layer up at the same
time:

**The actuator was parametrised by the wrong two numbers, and the sensor gene
was hardcoded to zero.** Fix the first and a chain swims at efficiency 0.93
instead of 0.04. Fix the second and selection for a behaviour becomes possible
for the first time — it had been impossible since C1, not difficult.

---

## 2. Before and after

| | before | after |
|---|---|---|
| best efficiency, any body | 0.19 designed / 0.03 random | **0.93** |
| best net speed | ~0.10 m/s | **0.73 m/s** |
| pi/2 wave beats unison by | 1.6x (through the PD) | **68x** (through the solver motor) |
| `preyGain` / `threatGain` in a random genome | **0, always, unreachable** | drawn over [-1,1], mutable |
| selection for seeking | never attempted | **p = 0.031**, six paired seeds vs a random-selection control |
| `breed()` population | fixed at 6, threw otherwise | any size; N17 generalised as a RATE |
| steering measured as | yaw only (`atan2(f[0], f[2])`) | `turnRate3d` + `steeringAuthority` on the record |
| authored creatures | none | `worlds/seeds.js`, six, all validating |

**Not** fixed, and worth being blunt: the creatures still only home inside a
±30° forward cone. They do not orient.

---

## 3. Ratio of measurement to change

Roughly **20 tools written, 11 files changed.** That is deliberate and it is the
shape of the whole investigation: almost everything found was found by
measurement, and most measurements ended in "no change needed, here is why".

Changed:

| file | change |
|---|---|
| `engine/l1/physics.js` | `opts.motorFreqHz` / `motorZeta` — reference actuator parametrisation, DEFAULT OFF |
| `engine/l1/factory.js` | sensor gains drawn instead of hardcoded 0 |
| `engine/l1/mutate.js` | `mutateSensorGain` operator |
| `engine/l1/breed.js` | `POPULATION` generalised; `strangerCount(n)` |
| `engine/l2/probe.js` | `turn3d()` |
| `engine/l2/probes.js` | S3 returns `turnRate3d`, `steeringAuthority` |
| `engine/l2/compile.js` | forwards both |
| `contracts/species.js` | both registered |
| `contracts/versions.js` + `version.json` + `trunk/version.js` | BRIDGE_V 2 → 3 |
| `gate/breed.js` | `diffGenome` sees the sensor genes; L1-23 entry; L1-26 amended |
| `worlds/seeds.js` | NEW — the authored creature library |

Every engine change is additive or default-off except the sensor gains, which
change every newly generated genome's gains and shift `social` down the rng
stream. **Morphology from a given seed is bit-identical.**

---

## 4. What is verified and should not be re-examined

| | evidence |
|---|---|
| the slice CAN build a serpent | `parentFace: 5` gives 13 bodies, 6.5 m, zero rejections. `SLICE_LIMITS.maxRecursion` is NOT in the path for hand-written genomes |
| a chain swims | efficiency 0.933 at pi/2, 12 segments, solver motor |
| the fluid model is right | pi/2 beats unison 68x on efficiency — the assertion §56 asked for |
| the objective must be control-subtracted | raw seek score correlates **0.90 with netSpeed**, 0.98 with its own control |
| selection works | +0.364 ± 0.088 over a matched random control, 6/6 seeds, p = 0.031 |
| `breed()` at size | N17/N18 hold at 6/12/20/50; population 6 bit-identical |

---

## 5. What is broken, in priority order

**1. `bearingTo` and `headingOf` measure yaw; the creatures turn in pitch.**
`duel.js:189` computes `atan2(fx, fz)` with a comment defending it as a compass
bearing — correct for a compass, wrong for a body that bends about its limbs'
local X. The sensor measures one plane and `turnBias` actuates another, so **the
control loop has never been closed. Not poorly closed — open, by construction, in
the coordinate convention.** `steeringAuthority` and the steering axis are now
measured fields, so the plane is a quantity the record carries; this became a
small change rather than a research question.

**2. The solver motor is still not the default.** Two blockers, both confirmed:
`work` does not accumulate on the solver path (so cost of transport is
unavailable, and it prints `n/a` in every solver measurement in this document),
and L1-18 needs the model-agnostic treatment `'stress'` already got. Add a third:
**42% of joints are spherical and have no solver motor at all** — Rapier's JS
binding exposes motors on revolute-family joints only. Those joints keep the PD,
and their tracking gain p95 is **10.9**: eleven times the commanded amplitude.
"Default the solver motor" is not a complete fix.

**3. `setMotorMaxForce` does not exist in rapier3d-compat 0.19.3.** The plan to
preserve N19 by bounding motor force is not implementable. The code put the
torque budget in the STIFFNESS instead, which bounds torque per unit of tracking
error rather than bounding torque, so **00 §9's bounded actuator power is
silently unenforced on the solver path.** Either the binding needs upgrading, the
bound needs reimposing outside the solver, or 00 §9 needs amending for this path.

**4. Nothing has ever been persisted.** `store.js` exports `KEY.specimen`,
`KEY.lineage`, `KEY.run` and a full envelope/migration/quota layer. Grepping the
tree for `KEY.` outside `store.js` returns **nothing**. The only writes are
`vivarium:seed` and two dev-panel preferences. `ui/screens/atlas.js` is nine
lines and its comment ("specimens and records are stored correctly from B1") is
false.

**5. `tools/_track.mjs` and `tools/_amp.mjs` read `j.axisLocal`, which does not
exist.** Both have always measured the swing-twist angle about the parent's X
axis. Every number they produced is about an arbitrary axis.

---

## 6. INVESTIGATED, NOT FIXED: "the creatures don't feel random"

Player report: they seem to come from about a dozen specific seeds. Measured,
and the report is accurate about the experience and wrong about the cause. Four
candidate mechanisms, in the order I would test them:

**A. The genome factory is NOT the problem.** 400 random genomes gave **400
distinct topologies**, 0 rejected. The draw is fully diverse.

**B. But 77% of creatures have 2–4 bodies.** Body-count distribution over 400:
`2:90  3:135  4:83  5:45  6:11  7:9  8:8 ...`. A 2- or 3-body creature has very
few visually distinct arrangements, so most of the population looks like the same
handful of blobs however different the genomes are. `maxRecursion: 2` in
`SLICE_LIMITS` is the direct cause and it IS in the path here (unlike for
hand-written genomes). **This is the most likely single cause and the cheapest to
test: raise it and look.**

**C. They all MOVE the same, which is probably what "not random" really means.**
Through the shipped PD the entire authored library — a designed pi/2 undulator,
a control with zero phase lag, a finned swimmer, a deliberately broken
staircase — scores efficiency **0.006 to 0.035**, a range narrower than
measurement noise. The relay erases the difference between a designed swimmer and
a random tangle. Bodies differ; behaviour does not. Fixing this is item 5.2.

**D. The tank never changes between sessions.** `vivarium:seed` is minted once
via `freshVivariumSeed()` and persisted; `tank.js:583` regenerates the whole
population from it on every load, and **breeding results are never stored**
(§5.4). So a player sees the same six creatures every time they open the app, and
their descendants after breeding — which is *literally* about a dozen specific
seeds. **If the report is "the same creatures keep coming back", this is the
cause, and it is the Atlas write path, not a diversity problem at all.**

Distinguishing test, five minutes: clear `vivarium:seed` from storage, reload,
and see whether the creatures are new. If they are, it is D. If they still look
like siblings, it is B and C.

---

## 7. Ordered next steps

1. **Diagnose §6 properly** with the storage test above before changing anything.
   B, C and D have different fixes and the symptom is the same.
2. **`bearingTo` / `headingOf` in the measured steering plane.** Small now.
3. **Atlas write path** — `store.set(KEY.specimen(hash), …)` on selection,
   `store.list('specimen:')` into the grid, import/export via the existing
   `serialise`/`deserialise`. One afternoon; everything under it exists.
4. **Default the solver motor**: `work` accounting, L1-18, spherical joints.
   Largest remaining piece; every measured number depends on it.
5. **Decide the actuator parametrisation deliberately.** `motorFreqHz` makes it a
   choice. Budget-derived gains buy efficiency (0.93); high natural frequency
   buys speed (0.73 m/s). That trade is a design decision about what a creature
   is, not a constant to tune.
6. Re-run the six selection seeds through `breed()` if the p = 0.031 claim ever
   needs to be about the game rather than about a harness. S1 already agrees
   (+0.237 vs +0.210). Five mechanical chunks.

---

## 8. Method notes, earned the hard way

- **Run the null arm.** A 28x selection result was reproduced by choosing the
  survivors AT RANDOM. Benefit is right-skewed, so carrying any six of twenty
  forward raises the median without any selection at all.
- **Correlate every new metric against speed before believing it.** The seek
  score looked like a steering measure and was 0.90 correlated with netSpeed.
- **Put the target somewhere the creature is not already going.** A 0.01 m
  pursuit result came from a target placed dead ahead by an off-by-one in a plane
  basis, under a comment that said "90 degrees off the initial heading".
- **Measure signal-to-noise before running an experiment, not after.** It cost
  ten evaluations and would have saved two full runs.
- **A caveat in prose does not survive being read quickly.** An unbounded ratio
  was flagged as not-to-be-quoted in one session and printed as infinity in the
  next. Wrong arithmetic in a tool outlives any correction made in a document.
- **State the endpoint and the n before the first run.** Three claims were made
  and retracted inside one six-seed series; all three were secondary readings
  promoted mid-series. The primary endpoint never moved.
- **Pipe output to a file.** Two chunks were abandoned because `grep` buffered
  the progress lines and a killed process showed nothing.

---

## 9. Tools added this session

| tool | answers |
|---|---|
| `_gains.mjs` | what natural frequency and damping do the shipped gains produce? |
| `_bode.mjs` | per-joint tracking gain and phase lag, by joint type and drive path |
| `_wave.mjs` | the travelling-wave test on a real long chain |
| `_sweep.mjs` | gait frequency x actuator tuning |
| `_bias.mjs` | what `turnBias` does to clipping, gait amplitude and travel |
| `_orient.mjs` / `_plane.mjs` | which plane does `turnBias` steer in? |
| `_chase.mjs` | closest approach against target BEARING — the honest pursuit test |
| `_atlas.mjs` | validate, round-trip, hash, measure and draw the authored library |
| `_capability.mjs` | the full parameter card; does each objective discriminate? |
| `_objective.mjs` | is the seek score steering, or speed in disguise? |
| `_steerplane.mjs` | each creature's own steering axis and authority |
| `_floor.mjs` | can the corpus reach the target at all? |
| `_grid.mjs` | dense bearing sweep; S/N for every trial size by subsampling |
| `_noise.mjs` | signal-to-noise of the fitness metric |
| `_evolib.mjs` | shared evaluation machinery, one definition |
| `_evo.mjs` | one arm-replicate, checkpointed, wall-clock guarded |
| `_evobreed.mjs` | the same experiment through the shipped `breed()` |
| `_evosum.mjs` | reads every checkpoint, pairs the arms |
| `_breedsize.mjs` | `breed()` at 6/12/20/50 |
| `_diversity.mjs` | how many distinct body plans does the factory produce? |
