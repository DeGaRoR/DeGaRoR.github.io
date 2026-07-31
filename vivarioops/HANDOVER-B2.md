# HANDOVER — B2 steps 2–7, and why the plan changed at the end

**Gate: 84 assertions, 80 passed, 0 failed, 4 pending, 4021 underlying checks. GREEN.**
Baseline at session start was 80 / 76 / 3311.

`npm install && npm run vendor && npm run gate`.

---

## 1. What shipped

### Chantier 1 — morphology (§2)

Two mutation fixes and six constants.

- **Fix A** — `addNode`'s inbound edge is never `terminalOnly`. The flag was drawn true 48.9% of the time, and those additions grew the body 2.3% of the time against 48.3% for the rest, because a terminalOnly edge from a host at depth 0 never fires. Half the ratchet was one line.
- **Fix B** — `removeNode` prefers cheap removals, but as a **tournament of 2, not the full argmin §2.1 asks for**. The literal version overshoots badly: at a 75% discard rate an argmin does not find the *cheapest* removal, it finds a *free* one — a node whose limbs were being rejected anyway. It grew the body 18% of the time it was asked to shrink it, and drift inverted to +0.110. A fixed-size tournament does not scale with the candidate pool, which is the whole point.
- `maxReflectionAxes` 1 → **3**. The A2/A5 ambiguity is resolved in favour of reading (a). This is the single largest lever on variety in the project.
- `nodeCount` [2,5] → **[3,7]**. The floor is the half that matters: at 2 the factory produced a two-box hinge 28% of the time.
- `extraEdges` [0,3] → **[1,5]**, and **not for §2.2's reason**. As a variety lever it is unnecessary. At a floor of 0 a large share of genomes are pure spanning trees, every edge is load-bearing, and `removeConnection` simply *refuses* — 212 applications against `addConnection`'s 361, carrying +0.043 bodies/mutation of drift from an operator that could not run.
- **Back-face exclusion** (`allowedFaces`, no face 2). `FACE_NORMAL[2]` is −Z and every child attaches by its own −Z face, so a limb on face 2 aims into its grandparent.
- **Reflection clamp** (`reflectMinOffset` 0.6). The anchor scales `faceRight` by `position[0]` and `reflectX` negates `faceRight`, so a mirrored limb at the face centre is its own mirror. 41% of reflected connections sat inside that zone.
- **Branch weights made explicit**: nodes .30, connections .30, controller .25, material .125, social **.025** (was .125). 27.3% of mutations were landing on genes nothing measures.

| | shipped | now | gate |
|---|---|---|---|
| effective variety (H1) | 16.3 | **337.5** | ≥ 155 |
| single-joint creatures | 27.8% | **3.0%** | ≤ 8% |
| tanks of six with a duplicate | 86% | **15%** | ≤ 40% |
| `addNode` grows | 31.0% | **45.3%** | ≥ 45% |
| degenerate reflections | 40.9% | **0%** | 0 |
| 30-generation walk | 3.87 → 3.06 | **9.17 → 8.95** | flat |

Cost: **mean bodies 3.91 → 9.78**, so physics is ~2.5× slower. That bill is visible everywhere downstream.

### Step 3 — spherical joints dropped

Recommended by the design on one measurement. Checked against the binding and the case is stronger: `SphericalImpulseJoint` in rapier3d-compat 0.19.3 has **no motor surface at all** (so "upgrade the binding" is not a version bump), **no `setLimits` either** (so three `angleLimits` genes per spherical joint have always been inert), and it is the known 1e21 divergence at `physics.js:944`. Cost: mean DOF 5.0 → 3.0. Restored at step F.

### Step 4 — the solver motor is the default

- **`work` accumulates on the solver path**, reconstructed from the spring-damper law the motor is configured with. Rapier does not expose the motor impulse. Exact in steady oscillation, **overstates during fast transients**. Solver-to-solver cost of transport is comparable without qualification; solver-to-PD is not, below a few percent.
- **The 00 §9 torque bound is implemented**, per the §12 decision to re-impose rather than amend. Both operands are boundable: `setLimits` bounds the tracking error, `OMEGA_MAX` bounds the angular velocity. `k` and `c` scale together so ζ is preserved exactly.
- **Bug found**: the solver path ignored `motorScale` entirely, so `motorScale: 0` left motors running.
- **L1-18** now asserts N19 on the configured budget, not through the integrator. An implicit spring's first-step response is `k·dt·e/(I + k·dt² + c·dt)` — sub-proportional to torque by construction, so asserting `2^1.5` through it would assert a property of Rapier's timestepping.
- **`minSelfMotion` re-derived and did not move.** The solver drops the distribution 4.2× as predicted; chantier 1's widening pushed it up by about as much. **That is luck, not robustness** — either change alone would have moved it.

Effect: peak speed median 31.7 → 0.9 m/s, p90 60.0 → 21.6, peak spin 180 → 64 rad/s. **Locomotion median 0.90 → 0.10 m** — deliberate, and it makes authored seeding load-bearing.

### Step 5 — torus and authored opening

`wrap: true`, opt-in. Every body translates by the world extent, atomically, between steps. **`centreOfMass()` returns the unwrapped position**, which is what makes the wrap invisible to `settle`, the probes, `assessViability` and every displacement figure.

A wrap is exact in exact arithmetic and **not bit-identical in floating point** — 0.49 m of divergence over 15 s, because the two arms run at different distances from the origin and a multibody solver amplifies rounding. L1-37 therefore asserts across the wrap *step*, where it is exact.

Two of six opening slots come from `worlds/seeds.js`, **placed rather than drawn** — running the authored library through a threshold calibrated on the random corpus would let the corpus reject the thing that exists to compensate for it.

### Step 6 — locomotion objective and auto-burst

In `engine/l2/objective.js`, deliberately not a probe (probes cost a `BRIDGE_V` bump to change; an objective must stay free to move).

| | |
|---|---|
| split-half reliability | pearson 0.80 / spearman 0.69 (design: 0.78) |
| confound: body count | 0.03 |
| confound: total mass | −0.05 |
| null arm | **6/6 replicates beat random survivors** |
| mean best | 0.0766 before → **0.2164** selected → 0.0502 random |
| cost | 136 ms/trial, 96 trials/burst, **~13 s wall** (design: 3.4 s) |

**Caught by the trial count**: `breed()` takes its population from `genomes.length` and *cannot grow one*, so `population: 24` was silently ignored. The first burst ran three generations at population 6 while reporting 24 — and at population 6 it merely *preserved* the authored eel, which looked like a 2.3× win. At a real 24 it improves 2.8×.

### Step 7 — the steering plane (gate NOT met)

Built and correct: the trace carries the root quaternion, `turn3d` accumulates the turn axis in the **body** frame, S3 emits `turnPlaneX/Y/Z`, `bearingTo` and `senseOpponent` are expressed in it, `BRIDGE_V` → 4.

The bug it fixes is real: `bearingTo` took a compass bearing while a chain of revolute joints bends in its own local YZ plane. **`turnRate` (yaw) reads exactly 0.00000 for all five authored eels** — their plane is local ±X. The sensor and the actuator had never named the same plane.

**§5's gate still fails: live gains beat the gains-zeroed control on 1 of 9 headings.** The convention was *a* reason the loop was open. It was not the only one.

---

## 2. The analysis that changed the plan

### `turnRate3d` measures wobble, not heading

`turn3d` accumulates the swept angle of the **centre-of-mass velocity direction**. A swimming creature's COM oscillates every stroke, so its velocity vector reverses every stroke. Over 20 s at full turn bias:

| id | velDir swept | body rotated (net) | net travel | **heading rate** |
|---|---|---|---|---|
| eel | 5426° | 28.7° | 1.598 m | **1.43°/s** |
| eel-fast | 6618° | 17.4° | 1.487 m | 0.87°/s |
| r0 | 10615° | 2.8° | 0.348 m | 0.14°/s |
| r2 | 13360° | 18.2° | 0.962 m | 0.91°/s |

Five to thirty-seven full rotations of the velocity vector against **2.5–39 degrees of actual body rotation**. Real heading rate is **0.13–1.96 °/s**; a 135° turn takes about four minutes.

`steeringAuthority` is compromised too — it differences `axis3d`, from the same accumulator.

**This is the third instance of this defect class in the project**, after session 2's tortuosity of 119 and the 20 Hz aliasing of a 12–22 Hz COM oscillation. A derived metric built on the velocity direction of an oscillating body measures the oscillation. `tools/_zwobble.mjs` exists so it cannot happen a fourth time.

### Follow-the-light: negative

Endpoints declared before the run per §7.1. 15 creatures × 5 placements at ±90°, ±135°, 180° in each creature's own plane — symmetric, so a straight swimmer scores zero by construction — control-subtracted against the same creature with gains zeroed.

| arm | primary | helped by sensor |
|---|---|---|
| as shipped | +0.0006 | 2/15 |
| torque bound lifted | −0.0032 | 2/15 |

The diagnostic is in the raw columns, not the score: **closest approach 2.92–2.99 m against a 3.00 m start.** Nobody gets near the light in either arm. Experiment 2 (does selection improve it) was **not run** — with capability at zero there is nothing to select on.

### The torque bound costs 45% of turn rate

| | bounded | unbounded |
|---|---|---|
| stiffness | 4.40 | 12.7 (ratio 0.347) |
| achieved deflection | 0.098 rad | 0.140 rad |
| turn rate | 0.117 | 0.214 |

`maxError` is sized on the worst-case command **including full turn authority**, so every creature's stiffness is permanently divided by a number assuming it always steers as hard as possible. Bounding against the oscillatory amplitude and treating the steering DC offset separately would recover most of it without touching 00 §9's guarantee.

### `TURN_AUTHORITY` is already 1.0 — full joint range

The "units" branch of C1's question is closed. Commanded deflection is 100% of range; beyond 1.0 the command lands outside `angleLimits` and `setLimits` discards it. Actuation delivers **11% of what is commanded** (0.098 rad achieved against 0.900 commanded). The loss is at L2, not L1 or L3.

### One clean positive

`eel-unison` — the zero-phase-lag control creature, same body as `eel` — travelled **0.031 m against the eel's 1.598 m**. The fluid model correctly punishes a creature that beats every joint together. The hydrodynamics is real.

---

## 3. New tools

| tool | what it answers |
|---|---|
| `_zdiv.mjs` | effective body-plan variety (H1 over id-free canonical topology). **Replaces `_diversity.mjs`, deleted** — its signature was built on generated ids, so it returned N distinct out of N and could not fail. |
| `_zratchet.mjs` | per-operator body-count delta, with error bars |
| `_zdrift.mjs` | 30-generation neutral walk |
| `_zrefl.mjs` | reflection degeneracy |
| `_zauto.mjs` | auto-burst cost, reliability, confounds, **null arm** |
| `_zturn.mjs` | three-layer steering decomposition (command → actuation → hydrodynamics) |
| `_zlight.mjs` | follow-the-light, pre-declared endpoints, control arm |
| `_zwobble.mjs` | heading change vs per-stroke wobble |
| `_zsolver.mjs` | `minSelfMotion` re-derivation across motor paths |

**`_track.mjs` and `_amp.mjs` needed nothing** — §11 is stale there, both were already fixed in the session-10 tree.

---

## 4. Traps for whoever picks this up

1. **Read the error bar before re-tuning drift.** Per-mutation delta has sd ≈ 1.6, so 2 s.e. at n = 3000 is ±0.067 — nearly seven times the |drift| < 0.01 gate. Resolving it needs n ≈ 90,000. An early pass of this work read a figure at n = 3000 as passing and it was noise.
2. **Effective variety is corpus-sensitive.** ±1.5 across seed namespaces at n = 2000, and it rises with n. Compare runs of `_zdiv` against each other, never against a figure quoted elsewhere. The design's 17.1 reads 16.3 here.
3. **The design's absolute solver figures do not reproduce.** §0.2 quotes random p50 0.015 m/s and the eel at 0.73; measured here, 0.0046 and 0.049 bounded. The *ratio* survives (11–20× vs ~50×) and is what the argument rests on. Part is the torque bound, which every design figure predates. **The rest is unexplained** and is the first thing to check if a locomotion number looks wrong.
4. **`bearingTo` still defaults to the horizontal plane** when no `turnPlane` is passed. Deliberate — a silent global change to what a bearing *means* would invalidate duel results without anything failing — but the plane is only used where a compiled record is in hand. `duel.js:428` passes null today.
5. **The torus is opt-in and every tool still passes `bounded: false`.** Moving them over is the point of having built it. The game still runs bounded, so **the border-sticking Denis reported is not fixed** — §4.2's other half, the wall as a sensed field, is untouched.
6. **The UI has not been booted once in three sessions of engine work.** `BRIDGE_V` → 4 invalidates every cached record, the species record gained three fields, `KIND` gained `authored`. The headless gate is green; the app is unverified.
