# Changelog

## 0.7.0 — 2026-07-29 — B4b · The tank (GATE GREEN)

The screen. Six creatures under physics, tap-select, Breed, Undo, Pause, Speed.
**This is the first time anything in this application has stepped a simulation**
— B3 was signed off against a checkpoint requiring a screen that did not exist.
Both B3's and B4's checkpoints are now answerable, and both need a person.

### Added
- `ui/screens/tank.js` — replaces the B2 screen entirely. Six live simulations,
  selection rings, per-creature speed labels, orbit/zoom/double-tap-reset,
  long-press specimen sheet, the 600 ms BREEDING beat, one-step Undo.
- `ui/tank/sim.js` — the tank's pure arithmetic, extracted so it can be
  asserted: cell layout, the fixed-timestep accumulator, the hit-test radius,
  tap-vs-drag classification. A screen is the one thing a gate cannot look at,
  so whatever can be moved out of it was.
- `gate/breed.js` L1-32, L1-33.
- Tank tokens in `trunk/ui/tokens.css`; tank layout in `ui/base.css`.

### Changed — tiled tanks, a deviation in mechanism, not appearance
- 21 §4.2 resolves the layout as ONE SHARED TANK and rejects pods and viewports
  because they trade away the aquarium. `createSimulation` builds its own
  `RAPIER.World` per call, so six creatures in one physics world would mean
  reworking it — and it is under a green B3 gate with every B4a viability
  threshold measured against W1's tank exactly as it stands. So each creature
  gets its **own unmodified W1 tank**, and the six are TILED: cell centres one
  full tank apart, so a creature confined to its cell can never reach another's.
  **The box drawn on screen is exactly the union of the six real tanks**, which
  L1-32 asserts. Cost: creatures cannot touch. Nothing in the slice needs them
  to — duels are their own simulation at C2 and there is no damage system.

### Measured
- **Six simulations: 0.281 ms per step, all six together** — 21 bodies total,
  29.7x realtime. At 60 fps and two steps per frame that is 3.4% of the frame
  budget at 1x speed, 14% at 4x. This is the typical corpus, not 10 §A17.4's
  144-body worst case, and it is a desktop container rather than a phone.
  The fallback ladder looks unlikely to be needed; it remains unexercised.

### Gate
- **GREEN.** 57 assertions, 55 passed, 0 failed, 2 pending. 1504 checks.
- **Mutation-tested: 23 of 23**, including five seeded defects against the tank
  helpers — packed cells that let creatures overlap across tanks, a drawn box
  larger than the tanks it claims to be, an unclamped accumulator (the spiral of
  death), a hit radius without its tap-target floor, and a drag treated as a tap.
- `gate/breed.js`'s collector was missing `close()`, which the motion suite has.
  Added; L1-33 needed it.

### Deliberately not done
- The derived binomial is NOT shown on the specimen sheet. 10 §8 keeps naming to
  "function only, no UI" in the slice and 21 §4.5 makes the persistent label
  speed. `binomial()` exists and this is one line; it stays a step-F decision
  rather than a silent one.
- No persistence of the tank across reload. Not in 30 §4 B4; E1 owns the loop.

## 0.6.0 — 2026-07-29 — B4a · Breeding, engine half (GATE GREEN)

B4 split in two. This is the headless half — mutation, viability, breed
semantics and naming, with nine gate assertions and a mutation harness. **B4b is
the tank UI and it is not written.** The B4 checkpoint ("six creatures, select,
breed, repeat, and it holds attention for twenty minutes") is a human judgement
that needs a screen, and so is B3's, which turns out never to have been
verifiable at all.

### Found before writing anything
- **The B3 checkpoint could not have been signed off.** `ui/screens/tank.js` is
  still the B2 screen: one static creature, a spin animation, and no import of
  `physics.js` anywhere in `/ui/` or `/render/`. Nothing in the app steps a
  simulation. B4b is what makes "watch the tank screen" possible.

### Added
- `engine/l1/mutate.js` — A9's weighted tree, exactly one mutation per call.
  Eleven operators over four branches. `mutateTimes(n)` is the single tuning
  knob (1–3 per offspring). `lockMorphology` restricts to the controller.
- `engine/l1/viability.js` — A9's filter, repel-then-discard, seven rejection
  reasons, measured thresholds.
- `engine/l1/breed.js` — 10 §A17.3 semantics, N17 stranger slot, N18 elites,
  `seedPopulation` for first run. Pure: same generation + selection + seed gives
  the same next generation, which makes undo a kept array.
- `engine/l1/naming.js` — derived binomial, 72 genera x 24 epithets, pure
  function of structure. Closes the B1 obligation.
- `gate/breed.js` — L1-23..L1-31, registered in `gate/run.js`'s manifest.
- `tools/_mut_b4.mjs` — the mutation harness for this gate.

### Fixed
- **`q()` rounds to the nearest micron, so quantising a value clamped to a bound
  can land it OUTSIDE that bound.** `q(-PI)` is `-3.141593`, which is 3.5e-7
  below `RANGE.phaseLag`'s own minimum, and `validateGenome` rejects it. Every
  `phaseLag` jitter that saturated produced an invalid genome. `qClamp()` now
  lives beside `q()` in `genome.js` and moves the bound to the nearest
  representable value inside the range. **`factory.js` has carried the same
  defect since B1** — it needs a uniform draw within 5e-7 of a bound, about one
  in ten million, so it has never fired. Both now use `qClamp`.
- A mutation that reported success and changed nothing: `recursiveLimit` steps
  +/-1 and the slice range is `[1, 2]`, so a freely chosen direction clamped
  back to its own value half the time at either end. Measured 2 in 400. The
  direction is now chosen from what is reachable. This is exactly A9's named
  failure — "simple creatures appear to produce identical children".

### Changed — three of A9's rules, each against measurement
- **Inertness.** A9 rejects below 0.05 m of centre-of-mass travel in 2 s. With
  gravity on that measures buoyant drift, which exceeds locomotion by ~40x
  (B3), so it would pass a corpse; measured at gravity zero, where displacement
  is locomotion and nothing else, it **rejects 46% of the corpus** — against
  A9's own warning that over ~40% means the operators are broken. Threshold set
  from the measured distribution instead: 0.01 m, below the corpus p10 of 0.013,
  rejecting 9%.
- **Size.** A9's `radius > 4x tank's smallest dimension` is 64 m in W1 and fires
  on nothing. The constraint physics actually needs is unstated: `physics.js`
  cannot instantiate a creature larger than the tank (it spawns embedded in the
  walls and Rapier panics), so it silently drops the environment and the
  creature drifts forever. Measured 10% of the corpus. Both rules implemented.
- **Interpenetration.** A single end-of-settle pose rejected 20% of candidates
  and was the dominant rejection cause — a limb mid-stroke crossing its own
  grandparent is a pose, not a defect. A9's word is *persistent*: sampled at
  three times, only pairs intersecting at every sample count. Rejection halved
  to 10%. A9's collision-clipping trick is moot here, since B3 already disables
  contacts between jointed bodies.

### Changed — two deviations from A9's mutation tree, reported
- `addOscillator` / `removeOscillator` are **unrepresentable**: 10 §A7 binds
  exactly one oscillator per node and `validateGenome` enforces the
  correspondence both ways, so adding one IS `addNode`. Replaced by
  `resampleFreqMult` (changes rhythmic structure) and `mutateOmega` (tempo).
- **A fourth branch** for material and social genes. A9's tree has three because
  Sims' genome had three parts; 10 §A10 requires MaterialGenes to mutate ("so
  lineages become visually recognisable") and L3 selects on the six social
  genes. Without it, colour is frozen per lineage and the ecology cannot select
  on behaviour. Each branch is now 1/4.

### Changed — naming
- The epithet was an argmax over raw normalised traits, which is worthless: any
  trait saturating at exactly 1.0 wins unconditionally, and **150 of 300
  creatures came out `apodus`** because most have no mirrored limbs. "Most
  extreme normalised trait" means extreme relative to a population. Twelve trait
  axes now each carry a measured corpus median and p10–p90 spread; the score is
  the signed deviation and its sign picks the pole — which is exactly A17.5's 24
  epithets. Distinct binomials over 300 rose from 45 to 69, the mode from 50% to
  11%.

### Resolved
- **`SLICE_LIMITS.maxReflectionAxes` stays at 1, and the decision moves to B5.**
  B3 measured every locomotion figure getting worse at 2 and 3. It is a question
  about how creatures look, not how they move, and B5 is where that is judged.

### Gate
- **GREEN.** 55 assertions, 53 passed, 0 failed, 2 pending (K3 -> C2, R5 ->
  browser). 1367 underlying checks.
- **Mutation-tested: 18 of 18 seeded defects caught**, after repairing two
  escapes the harness found:
  - the diff counted changed ELEMENTS, so an operator writing both `amplitude`
    and `bias` to one oscillator still showed as one change. "Exactly one
    mutation" is a statement about leaves; the diff is now leaf-granular.
  - the node cap was respected but never PRESSED — a factory genome holds 2–5
    nodes and three mutations can add at most three, so the corpus never reached
    8 and removing the cap check entirely escaped. A thirty-deep chain now
    reaches the cap, and the assertion checks that it does.
- Diagnostics: mutation viability rate **80%** over 60 mutants (target >= 60%),
  rejections inert 5, bodies 2, mass 2, interpenetration 2, oversizeTank 1;
  0 of 12 births fell back to an unmutated parent; breed costs 71–98 ms against
  the 600 ms BREEDING beat.

## 0.5.0 — 2026-07-29 — B3 · Motion (GATE GREEN)

B3's gate is written and green. Its **checkpoint is not signed off**: "at least
some undulate rather than twitch" is a human judgement and needs eyes on the tank
screen. Three measured caveats are carried as obligations and printed every run.

### Fixed — the panic
- **`RuntimeError: unreachable` was a symptom, not the fault.** Both drag terms
  were explicit (forward-Euler) forces proportional to v². Once `lambda*dt > 2`
  the drag impulse exceeds the momentum it opposes, reverses the velocity with a
  LARGER magnitude, and diverges about x1000 per step; Rapier's broad phase then
  panics on the NaN AABB. Both terms diverge independently. Both are now
  integrated semi-implicitly — divided by `1 + lambda*dt`, the exact solution of
  `dv/dt = -lambda*v` over a step. In the regime where explicit drag was valid it
  is the same force to within rounding; the bound is hard, so drag can never
  reverse a velocity or add energy.
- Two hypotheses from the previous handoff were **disproven**: removing the
  environment colliders makes survival worse (21/40 against 24/40), and `anchor2`
  is correct — the spawn gap between paired anchors is at most 4.1e-15 m.

### Fixed — the joints
- **Limb orientation moved from the rigid body to the collider.** Rapier's
  revolute joint takes one axis and builds BOTH bodies' local frames from it, so
  it requires the child to rest unrotated relative to its parent. Measured mean
  rest tilt over the corpus was 128 degrees: every joint was violated at spawn
  and the solver snapped every limb into line with its parent. Spawning both
  bodies world-aligned makes the rest relative rotation the identity, which is
  trivially a rotation about any axis, so 10 §A17.2's mapping becomes correct as
  written. Spawn jolt with motors off fell from 5-4500 m/s to under 0.05.
- `readPose` recomposes body and collider rotation for the renderer. `relativeAngle`
  now measures a true joint angle from a rest of zero, so the PD target means
  what 10 §A7 says it means.
- Contacts are explicitly disabled between jointed bodies. 10 §A6 exempts the
  parent from overlap rejection but never states the matching contact rule.
  Measured against rapier3d-compat 0.19.3 this is currently defensive — jointed
  pairs generate no contact response regardless — and it is commented as such.

### Fixed — swimming
- **Drag now uses the true projected area of the box along the direction of
  travel**, not the largest face. An orientation-independent drag area cannot
  produce thrust: a limb meets identical resistance on both strokes and a cycle
  nets to zero. Measured with gravity zeroed so displacement is locomotion and
  nothing else, over 15 s: median travel rose from 0.20 m to 0.36 m and the best
  swimmer from 0.7 m to 4.2 m.
- **Motor damping acts on the whole relative angular velocity**, not its
  projection on the driven axis. 10 §A17.2 gives each free angular DOF its own
  oscillator and the slice controller drives one, so a spherical joint's other
  two DOF were unobserved; a torque held along a fixed parent-frame axis while
  the child precesses does net work. One corpus creature wound from 4 rad/s to
  1e21 over fifteen seconds and took the run non-finite.

### Changed
- `MOTOR_SCALE` 60.0 → 1.0. It was never validated; 60 was two orders of
  magnitude past what these masses tolerate. Tuned, not derived.
- Position drive kept over velocity drive (10 §A7 offers both, 30 §4 says keep
  whichever looks more alive). Position moves creatures 3-5x further.

### Added
- `gate/motion.js` — L1-17 determinism over 600 steps, L1-18 N19, L1-19 N22 plus
  the jointed-contact rule, L1-20 phase propagation, L1-21 drag is dissipative,
  L1-22 nothing diverges over a duel including a stress pass at twice the motor
  scale. Registered in `gate/run.js`'s manifest.
- `tools/b3diag.js`, `tools/b3tune.js` — reproducer and motor-scale sweep.
- `tools/_mut.mjs` — the mutation harness for this gate.

### Gate
- **GREEN.** 46 assertions, 44 passed, 0 failed, 2 pending (K3 → C2, R5 → browser).
  433 underlying checks. 30 §2's ledger predicted 28 after B3; the ledger has been
  behind since A1 and the disagreement is recorded as a spec defect.
- **Mutation-tested: 6 of 7 seeded defects caught.** The escape is named in
  HANDOFF.md — reverting the motor damping to axis-only no longer diverges at the
  stress scale, so L1-22 does not catch it. Not repaired; recorded.
- Diagnostics: peak speed median 9.5 m/s, p90 135, max 245; locomotion at gravity
  zero median 0.17 m, p90 0.61 m, best 0.91 m over 15 s.

## 0.4.1 — 2026-07-29 — B3 · Motion, stability (STILL INCOMPLETE, GATE RED)

The Rapier panic is resolved. B3 is **not** delivered: it has no gate assertions,
and two further defects found while diagnosing the panic are open. See `HANDOFF.md`.

### Fixed
- **`RuntimeError: unreachable` was a symptom three steps downstream of the fault.**
  Both drag terms in `applyEnvironment` were explicit (forward-Euler) forces
  proportional to v². Once `lambda*dt > 2` — `lambda = k/m` linear, `ka/I`
  angular — the drag impulse exceeds the momentum it opposes, reverses the
  velocity with a LARGER magnitude, and the next step's drag is larger again.
  Measured divergence about x1000 per step, non-finite within a handful of ticks;
  Rapier's broad phase then panics on the NaN AABB. Both terms diverge
  independently: disabling either one alone still leaves 12-13 of 40 creatures
  divergent.
- Both drag terms are now integrated semi-implicitly — divided by
  `1 + lambda*dt`, the exact solution of `dv/dt = -lambda*v` over one step. In
  the regime where explicit drag was already valid (`lambda*dt << 1`) it is the
  explicit force to within rounding, so the drag law is unchanged; it only bounds
  the blow-up. The bound is hard: `|dv| = v*lambda*dt/(1+lambda*dt) < v`, so drag
  can never reverse a velocity and never adds energy.
- Per-body mass and minimum principal inertia are read once at build time.
  `principalInertia()` allocates a Vector per call, so reading it per tick would
  have allocated inside the step loop (N4). The minimum principal component is
  the stability-limiting axis, which makes the angular limiter conservative on
  every axis rather than only the stiffest.

### Measured
- 1800 steps over the 40-creature gate corpus: **40/40 survive**, bounded and
  unbounded, motors on and off. Before: 24/40, 26/40 with `motorScale: 0`.
- Two hypotheses recorded in the previous handoff are **disproven** and should
  not be retried: removing the environment colliders makes it *worse* (21/40),
  and `anchor2` is correct — the world-space gap between the two anchor points
  at spawn is at most 4.1e-15 m across the corpus.

### Added
- `tools/b3diag.js` — reproducer. Probes for a non-finite state BEFORE each step,
  so it reports the diverging state instead of dying inside wasm. Flags:
  `--unbounded`, `--nomotor`, `--set=field=value` to override a World field.
- `tools/b3speed.js`, `tools/b3joint.js` — peak-speed distribution and joint
  rest-frame measurement. All three are temporary B3 instruments, not gate code.

### Gate
- **RED.** 40 assertions pass from A0-B2, 371 checks. B3 still contributes none.

## 0.4.0 — 2026-07-29 — B3 · Motion (INCOMPLETE, GATE RED)

**This build is not fit to ship.** `engine/l1/physics.js` panics inside Rapier's
`step()` for a minority of creatures. Recorded because the code left the machine;
see `HANDOFF.md` for the diagnosis and the next step.

### Added
- `engine/l1/controller.js` — CPG with phase propagation down the body tree; position and velocity drive modes. Complete, pure, not the blocker.
- `engine/l1/physics.js` — Rapier world, per-body buoyancy and weight, linear and angular drag, explicit PD torque scaled by cross-sectional area (N19), environment colliders tagged for N22. **Unstable.**

### Fixed during B3
- Motor torque clamped as a TOTAL, not per term. The damping term is proportional to relative angular velocity and was otherwise unbounded, so a fast-spun joint produced an enormous restoring torque that spun it faster.
- Floor, free surface and tank walls were never built, so a creature not neutrally buoyant rose or sank forever and that read as "it swam a long way" in displacement measurements.
- Oversize creatures spawned embedded in the tank walls and made Rapier panic immediately; the boundary is now omitted and reported rather than crashing.

### Gate
- **RED.** 40 assertions pass from A0–B2; B3 contributes none yet and must not be counted as delivered.

## 0.3.1 — 2026-07-29 — B2 · Morphogenesis

### Added
- `engine/l1/morphogen.js` — Genome -> BodyPlan (contract C1). Breadth-first build, per-node-type recursion, reflection variants, face-anchored placement, cumulative scale, parity, cross-sectional area, derived mass/volume/COM/bounding radius
- `engine/l1/vecmath.js` — right-handed Y-up vector and quaternion algebra
- `render/creature.js` — capsules and ellipsoids over the box proxies, flat shading, colour from MaterialGenes and per-node colorGenes
- `ui/screens/tank.js` — one creature, Randomise, tank wireframe at true `tankBounds`, live readout
- Gate: N6, N20, L1-11..L1-16 (bounds, cross-sectional area, handedness cross-check, attachment geometry, overlap, recursion semantics)

### Changed
- Ported from `mycoolfin/the-simsulator@bd428a1` `LimbCreator.cs` (MIT, (c) 2024 Michael Finn) rather than derived from 10 §A6. Three DIVERGENCES where the working code differs from the spec, reference followed in each: breadth-first not depth-first; skip an over-cap connection rather than stop; component-wise parent half-extent, not a scalar.
- `engine/l1/factory.js` — spanning-tree edges are never `terminalOnly`
- `gate/trunk.js` — N16 now matches quoted hex; `render/creature.js` `token()` has no fallback argument

### Fixed
- **Two viability rules missing from 10 §A6 entirely, both load-bearing for B2's checkpoint.** `MIN/MAX_LIMB_DIMENSION` bounds runaway cumulative scale: `scale` is 0.5-2.0 and cumulative, so a 24-body chain reaches 2^24. Measured before: median bounding radius 3.93 m but a maximum of 33 km and 2.7 billion kg, 245 of 500 creatures larger than the tank. After: max 21.7 m, max 472 kg. And OBB overlap rejection, which is literally the checkpoint's "not a pile of overlapping boxes". A rejected limb takes its whole subtree.
- **`terminalOnly` on a spanning edge never fires.** Morphogenesis applies such a connection only once `depth === recursiveLimit`, and a node never self-referenced sits at depth 0 while its limit is at least 1. Genome connectivity did not imply body connectivity: 500 genomes gave a minimum of 1 body — a jointless blob that cannot move. L1-11 now asserts no singleton plans.
- N16 missed hex inside string literals, so `token('--c-bg', '#05080c')` fallbacks passed. Pattern widened, fallbacks removed.

### Gate
- 40 assertions, 0 failures, 2 pending (K3 -> C2, R5 -> browser). 371 underlying checks.
- Mutation-tested: 9 of 9 after repairing L1-14 and adding L1-16. Two escaped first: the scalar-half-extent bug (L1-14 checked the child against an anchor computed the same wrong way) and global-vs-per-node recursion depth.
- Phenotype: mean 3.95 bodies, 5/500 truncated, median radius 2.63 m, median mass 4.76 kg.

## 0.2.1 — 2026-07-29 — B1 · Genome

### Added
- `engine/l1/genome.js` — Genome v2 schema, one `RANGE` table, canonical serialisation, 64-bit `genomeHash`, validator, reachability, migration registry
- `engine/l1/factory.js` — slice-constrained random factory per 10 §A17.1 with A2 limits; `FULL_LIMITS` for step F
- `gate/l1.js` — L1-1..L1-10 over a 500-genome corpus, with population diagnostics
- Six social genes (`trophic`, `boldness`, `cohesion`, `separation`, `alignment`, `separationRadius`) and `genomeSourcedSpeciesFields()`, closing the obligation A0 opened
- Node `colorGenes` defined (`hueShift`, `valueShift`, `patternPhase`) — 10 §A5 left them as `{...}`

### Changed
- `controller.jointGenes` is keyed by nodeId, not a positional array. 10 §A7 writes an array, but §A5 correction 5 forbids referencing nodes by index; a positional array would rebind every joint's motion the first time crossover reorders nodes. DEVIATION, reported.
- Gene values quantised to 1e-6 at every write site, so a 1e-17 mutation cannot change `genomeHash` without changing anything observable
- `genomeHash` is 64-bit (16 hex). At 32 bits the birthday bound is ~65 000 genomes and a collision silently returns another creature's capability record.
- Density range 0.15–1.8 per amendment A1; 10 §A17.1's annex text still says 0.6–1.4 and is stale
- `gate/l1.js` L1-4 restates 10 §3's constants as literals rather than reading `SLICE_LIMITS`

### Fixed
- **`trunk/rng.js` seeding was biased on the first draw.** `state = seed + INC` emitted output one addition from the seed. Across 20 000 derived seeds a first `int(4)` gave `[4517, 5088, 5492, 4903]` against 5000 expected, and the B1 corpus averaged 2.90 nodes where `randInt(2,5)` gives 3.50. Uniform by the tenth draw, which is why single-generator tests all passed. Now uses PCG's canonical seeding (advance, add seed, advance). New assertion R1 covers first-draw uniformity across fresh seeds.

### Open
- `SLICE_LIMITS.maxReflectionAxes = 1`. A2 says "bilateral and none only"; A5 correction 3 makes reflections multiply (three axes = eight limbs). Implemented on the constraining reading, pinned in two places. Decide at B4.

### Gate
- 32 assertions, 0 failures, 2 pending (K3 → C2, R5 → browser). 307 underlying checks.
- Mutation-tested: 11 of 11 seeded defects caught after the L1-4 repair.
- Corpus: 500 genomes, 500 distinct hashes, mean 3.48 nodes / 4.00 connections, 38% self-recursive, mean 2648 bytes serialised.

## 0.1.1 — 2026-07-29 — A1 · Skeleton

### Added
- `index.html`, `app.js` — shell, top bar, tab bar, screen host
- `trunk/nav.js` — screen stack, four tab roots, `pushState`/`popstate`; browser history is the position of record
- `trunk/rng.js` — seeded PCG-XSH-RR 64/32, the only PRNG construction site; `fork()` derives, never splits shared state
- `trunk/store.js` — IndexedDB adapter (`get`/`set`/`delete`/`list`), N9 envelope on the write path, migration registry, N10 future-version rejection, quota error
- `trunk/i18n.js` — `t()` passthrough, per 20 §2 ("used from the first string written")
- `trunk/ui/tokens.css`, `ui/base.css`, `ui/widgets.js`, `ui/placeholder.js`
- `ui/screens/` — tank, atlas ("not yet available", 30 §9), world, settings (cog menu), dev
- Developer screen: run gate, seed override with live draw preview, persistence probe, version readout
- `tools/build.js` — sole writer of `version.json` and `trunk/version.js`; runs the static gate and emits `gate-report.json`
- `tools/navsim.js` — headless nav diagnostic with a real back/forward history stack
- `gate/trunk.js` — N1, N2, N3, N5, N8, N14, N16 + V1 version consistency
- `gate/runtime.js` — R1 rng, N9, N10, R4 routing, R5 persistence round-trip

### Changed
- `tools/version-a0.js` removed, superseded by `tools/build.js` as planned at A0
- `gate/run.js` rewritten around an explicit assertion manifest

### Fixed
- The gate could not document its own rules: N5, N8 and N14 failed against explanatory comments in the files they guard. Comments are now stripped before matching; string literals are not, so a forbidden call hidden in a string still trips.
- A suite that threw at import time produced no failures and a smaller green run. `gate/run.js` now declares the assertions it expects and fails on any that did not run.

### Gate
- 22 assertions, 0 failures, 2 pending (K3 → C2, R5 → browser). 221 underlying checks.
- Mutation-tested: 10 of 10 seeded defects caught after the runner-manifest repair.

## 0.0.1 — 2026-07-29 — A0 · Contracts as code

### Added
- `contracts/species.js` — `Species` (03 §3) as a generated struct plus a producer table; `deriveThresholds()`, `validateSpecies()`, `vs` accessors
- `contracts/world.js` — `World` validator, `worldHash()` (03 §1), record validity and storage key
- `contracts/matchup.js` — `PairMatchup` (03 §2), canonical pair seeding, engagement capture model (03 §4), `assembleVs()` fauna-loader step
- `contracts/hash.js` — `fnv1a`, `seed(...parts)`, stateless uniform draw
- `contracts/versions.js` — `GENOME_V` 2, `BRIDGE_V` 1, `ECOLOGY_V` 1
- `worlds/w1_slice.js` — the W1 fixture, every constant present
- `gate/contracts.js` + `gate/run.js` — K1–K8 and a headless runner
- `contracts/PROVENANCE.md` — resolved versions, integrity hashes, reference SHAs, Rapier determinism finding
- `tools/version-a0.js` — machine-generated `version.json`; superseded by `tools/build.js` at A1

### Changed
- Pinned `@dimforge/rapier3d-compat` 0.19.3 and `three` 0.185.1 exactly, lockfile committed. 03 §6's placeholders (0.14.0 / 0.169.0) are superseded.
- `dragCoefficient` added to the `worldHash` input — a physical parameter K5 requires but 03 §1 omitted
- `pursuitGain` / `evasionGain` added to `w1_slice.js` per 30 §5 C1; 03 §5 omitted them
- Four derivation ratios moved from literals in 03 §3 into the fixture, values unchanged
- `worldHash(world, residentGenomeHashes)` takes resident hashes explicitly; the fixture supplies placeholders until C2

### Fixed
- 03 §4's certain-capture guard: a per-tick probability of 1 captures on tick 1, not at `timeToCapture`. `captureModel()` returns a tagged union so L3 branches on the deadline case.
- K5 originally checked `WORLD_HASH_FIELDS` against itself, so deleting an entry deleted its own check. Hash membership is now cross-checked against an independent `hashed` flag on every schema key.

### Determinism
- Rapier JS build does **not** expose `enhanced-determinism`. 01 §5 stands unrelaxed.

### Gate
- 9 assertions, 0 failures, 1 pending (K3 — activates at C2). 188 underlying checks.
- Gate mutation-tested: 5 of 5 seeded defects caught after the K5 repair.
