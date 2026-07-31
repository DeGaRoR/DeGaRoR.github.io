# Vivarioops — the buoyancy/locomotion investigation

> ## ⚠ SUPERSEDED IN PART — read `HANDOVER-SESSION10.md` first
>
> Session 10 measured several claims in this document and found them false. The
> corrections, so that nothing below is acted on as written:
>
> **§3 priority 2, "the slice cannot build a serpent — `SLICE_LIMITS.maxRecursion`
> is 2, one line".** WRONG, and it is not one line. `maxRecursion` is read only by
> `factory.js` and `mutate.js` — the RANDOM genome generator. Hand-written seeds go
> straight to `morphogenesis` and never consult it. What actually capped the chain
> was `tools/_seed.mjs`'s `parentFace: 0`: `makeJointData` attaches a child by its
> own −Z face, so a self-connection on +X is a ninety-degree turn, the chain
> spirals into itself, and `obbOverlap` rejects the fourth segment. Attach on +Z
> (`parentFace: 5`) and the same unmodified slice builds 13 bodies over 6.5 m with
> zero rejections. Every efficiency figure measured on a "6-segment serpent" was
> taken on a 3+1 staircase.
>
> **§3 priority 5, "direction control does not work and should not be built —
> steering is downstream of gait coherence".** The conclusion is right; the reason
> is wrong. Measured on a body at efficiency 0.93, yaw response to `turnBias` is
> still exactly zero. Gait coherence was not the gate. `bearingTo` computes a
> horizontal compass bearing while a chain bends about its limbs' local X and turns
> in PITCH — the sensor measures one plane and the actuator drives another, so the
> loop has never been closed. Not poorly closed: open, by construction, in the
> coordinate convention.
>
> **§3 priority 1, "default the solver motor".** Necessary and not sufficient.
> Rapier's JS binding exposes motors on revolute-family joints only, so ~42% of
> corpus joints stay on the PD with a tracking gain p95 of 10.9. Also
> `setMotorMaxForce` does not exist in rapier3d-compat 0.19.3, so §44's plan to
> preserve N19 via max force is not implementable and 00 §9's bounded actuator
> power is currently unenforced on the solver path.
>
> **§7, `_track.mjs` / `_amp.mjs`.** Both read `j.axisLocal`, a field that does not
> exist, and measured about the parent's X axis. Fixed in session 10 by exporting
> `jointAxisAtSpawn`.
>
> **§6, "one assertion worth adding".** Still worth adding, and now cheap: through
> the solver motor a π/2 travelling wave beats unison on efficiency by 68×.



Written at the end of a measurement-only sitting. **Nothing under `engine/` was
modified.** Two files were added:

- `tools/hydro.js` — the diagnostic. `node tools/hydro.js [N] [--seconds S]`
- `tools/_hydro_physics.mjs` — a LAB COPY of `engine/l1/physics.js` in which the
  fluid law is a parameter, so the current law and the reference's can be
  measured against each other in the same harness. Not shipped, not gated.

Reproduce with `npm install && npm run vendor && node tools/hydro.js 60`.
Runtime is about 20 minutes on a desktop container.

**Housekeeping: the gate's red was a packaging artefact, not a mutant.** `V2`
("every browser bare specifier resolves to a file that ships") fails because the
zip carries `vendor/VENDOR.json` but not `vendor/`. After `npm run vendor` the
gate is GREEN — 77 assertions, 72 pass, 0 fail, 4 pending, 2088 checks. The tree
is clean; the HANDOFF's warning about interrupted mutation runs does not apply
here.

---

## 1. The finding: this is two independent defects, not one

The handoff treats buoyancy as *the* C2 blocker. It is not. Measured over a
60-creature factory corpus, 15 s runs, `FIXED_DT` unchanged:

| configuration | horiz travel p50 | vert p50 | pinned |
|---|---|---|---|
| tank, gravity ON (as shipped) | 0.54 m | 11.26 m | **28/59** |
| tank, buoyancy neutralised | **0.158 m** | 0.09 m | 0/60 |
| density clamped to [0.9, 1.1] | 0.356 m | 8.18 m | 9/60 |
| density clamped to [0.97, 1.03] | 0.298 m | 3.72 m | 2/60 |
| density clamped to [1, 1] | 0.169 m | 0.09 m | 0/60 |
| `dragScale` x4 | 0.388 m | 9.73 m | 15/59 |
| `dragScale` x16 | 0.195 m | 4.72 m | 3/60 |

Every candidate in the handoff's "cheapest first" list lands in the same place:
pinning goes away and **locomotion stays at 0.16–0.36 m in 15 s** against a duel
start separation of 6–8 m. Two creatures approaching each other need roughly
2–3 m apiece net of reach. **Resolving the density question does not unblock C2.**

The buoyancy figure is also worse than recorded. Per-creature drift/swim ratio —
vertical displacement with motors off and gravity on, over horizontal
displacement with motors on and gravity zeroed — is **p50 108x** (p10 15,
p90 467), not the ~40x in the carried obligation. The ratio is stable across
corpus size and run length (p50 111.6 at n=12 over 8 s), so it is not an
artefact of the sample.

Supporting statics, from the plan alone:

```
bulk density, mass-weighted (medium 1.0)   p10 0.557  p50 1.033  p90 1.442
|net buoyant accel| m/s^2                  p10 0.39   p50 2.44   p90 7.79
fraction within 5% of neutral              13%
analytic terminal |v_y| m/s                p10 1.59   p50 3.63   p90 5.47
```

A9's "approximately neutrally buoyant by chance" claim (10 §2, amendment A1) is
false as generated: 13% of the corpus is near neutral, and the median creature
carries 2.4 m/s^2 of net buoyant acceleration. The midpoint of the *gene range*
is 0.98; the mass-weighted bulk density of an *instantiated* creature is not the
midpoint of the range, because volume weights it.

---

## 2. What the reference does, and it settles the density question

Read from `mycoolfin/the-simsulator` (MIT, verified against the code, not the
paper PDF):

**2a. There is no buoyancy anywhere in the reference, and water runs at zero
gravity.** `Core/ECS/API/SimulationSettingsBase.cs`:

```
SetToAquaticDefaults:      gravity = zero, fluid simulation ON  (density 1),
                           ground plane destroyed
SetToTerrestrialDefaults:  real gravity, fluid simulation OFF
```

Gravity and the fluid model are never both active. No floor, no lid, no walls in
the aquatic trial — the creature is repositioned to the origin instead of being
contained.

**2b. There is no density gene.** `Sims/Phenotype/Components/Limb.cs` derives
mass from volume alone, with the author's own comment that mass is proportional
to volume. Density is implicitly 1.0 for every limb, equal to the fluid density.
**Every creature is exactly neutrally buoyant by construction.** The genotype
`Node` carries dimensions, a joint definition, a recursive limit and a colour —
and nothing else. Dimension bounds are 0.2–2.0, identical to ours.

So the answer to "did the reference get stuck on creatures barely moving?" is
that the failure mode cannot arise in their model. `RANGE.density: [0.15, 1.8]`
is ours, introduced by amendment A1 and justified by a thick-gas world that does
not exist in the slice (10 §2: "a floor of 0.6 makes positive buoyancy
impossible in the thick-gas world"). **A step-F requirement broke the slice.**

**2c. Their drag law is a different law, not a tuned version of ours.**
`Core/ECS/Systems/Simulation/Physics/ApplyFluidForcesSystem.cs`. Per limb, six
faces times four quadrants = 24 sample points. For each:

- the velocity used is the **local** velocity at the sample, `v + omega x r`, so
  rotation generates translational force;
- the force is applied **at** `r`, so it generates torque via `cross(r, F)`;
- it is **one-sided** — a face whose normal points away from the flow
  contributes nothing;
- `Cd` depends on **incidence**: `0.5 + 1.5 * (1 - |c|)^2`, where `c` is the
  cosine between flow direction and face normal;
- there is a **lift** term, `Cl = 1.2 * |c| * sqrt(1 - c^2)`, applied
  perpendicular to the flow. It peaks near 45 degrees of incidence.

Our law has none of those five properties. It is one force at the centre of
mass, opposing linear velocity, with a projected area. That is also *why*
`applyEnvironment` needs a separate angular drag term with a tuned `r^5 * 0.4`:
a force applied at the centre of mass cannot produce torque, so the rotational
resistance had to be reinvented rather than falling out of the same law.

**One deviation taken deliberately in the port.** The reference places a face
centre at `0.5 * unitNormal` *without* scaling by the body dimension, while
scaling the in-plane quadrant offsets. That is dimensionally inconsistent — a
2.0 x 0.2 x 2.0 plate gets its +X face sampled 0.5 m out instead of 1.0 m.
`_hydro_physics.mjs` scales the normal offset too. Worth a note if the numbers
are ever compared against the reference directly.

---

## 3. The per-face law measured, gravity OFF, unbounded

| fluid law | horiz travel p50 | peak speed p95 |
|---|---|---|
| projected area (current engine) | 0.158 m | 23.7 m/s |
| per-face, lift disabled | **0.94–1.10 m** | 4.5e4 |
| per-face, with lift | **5.9 m** | 1.1e14 |

Per-face drag alone is **6x** the current model and removes the need for the
ad-hoc angular term. With lift it is **37x**, which is the range where a 6–8 m
closing distance becomes reachable — and it diverges.

### The lift instability, named

This is the same class of defect B3 already hit twice, and it is worth recording
as a hazard rather than a number.

1. A first limiter bounded force **magnitude** at `0.5 * m * |v| / dt`. A force
   *perpendicular* to velocity at that bound grows `|v|` by about 12% per step.
   That is Pythagoras, not physics: `sqrt(1 + 0.25) = 1.118`. Over 1800 steps it
   is astronomical. **Bounding the magnitude of a force does not bound the
   energy it adds.** The engine's existing semi-implicit factor is safe only
   because its force is antiparallel to `v` by construction.
2. Adding an energy projection — drop any component with `F . v > 0`, and the
   angular equivalent with `tau . omega > 0` — moved p90 from 2.6e10 to 2.2e7
   and **did not close the tail**. Residual energy enters through the joint
   solver: lift on one limb is transmitted through the constraint to the rest of
   the creature, where neither guard sees it.
3. Removing lift entirely drops p95 peak speed by nine orders of magnitude.

So lift needs an integration that is energy-preserving *by construction* —
applying it as a **rotation** of the velocity vector rather than an additive
impulse, or substepping the fluid term — not a clamp. The reference gets away
with hard clamps (force ±1000, dv ±100, v ±200, omega ±50) because its creatures
are neutrally buoyant and its integrator never has to survive a buoyancy tail on
top of a lift tail.

**Measurement discipline note: the divergence is time-dependent.** At 8 s the
same configuration reports p95 peak 273 m/s and looks fine. At 15 s it is 1e14.
Any tuning done against a shortened probe window will not see it.

---

## 4. Does the genome account for hydrodynamic surfaces?

**No — not one gene.** A node carries `dims`, `density`, `recursiveLimit`,
`joint`, `colorGenes`. There is no surface gene, no per-face coefficient, no
fin or plate designation, no smoothness. `MaterialGenes` (10 §A10) exists but
drives only hue, pattern and iridescence.

**But the phenotype can already express a fin, and this was a surprise.**
`RANGE.dim` is [0.2, 2.0] — a 10:1 ceiling — yet the *instantiated* aspect ratio
measured over the corpus is:

```
max aspect ratio per creature   p50 5.93   p90 17.89   max 111.94
wetted area / volume^(2/3)      p50 9.70   (sphere 4.84, cube 6.00)
```

It exceeds the gene ceiling because connection `scale` is [0.5, 2.0] and
**cumulative per axis** down the chain. Blades and plates are reachable today,
without a schema change.

**They do not help.** Spearman correlation of horizontal travel against
morphology, gravity zero, unstable tail excluded:

| fluid law | rho(travel, wetted area) | rho(travel, max aspect) | rho(travel, bodies) |
|---|---|---|---|
| projected (current) | −0.09 | 0.16 | −0.03 |
| per-face, no lift | 0.01 | −0.05 | 0.05 |

**Body plan does not predict locomotion under either drag law.** B3's finding
that "body plan barely matters to locomotion at all" therefore survives the
fluid-law change, which rules the drag law out as its cause and leaves the
controller — mirrored limbs receiving mirrored phase, so their thrust cancels —
as the remaining candidate. B3 named all three suspects; two are now eliminated.

**Consequence for the schema: do not add surface genes yet.** They would enlarge
the search space with nothing selecting on them. Revisit after the controller.

---

## 5. Solid-body and contact modelling

- **Creature colliders read the FLOOR's material.** `createSimulation` sets
  `setFriction(world.floor.friction)` and `setRestitution(world.floor.restitution)`
  on every creature collider. A creature's skin is being given the tank floor's
  properties. Numerically harmless today (both are single global values) and a
  category error that will bite the moment materials mean anything.
- **No added-mass term.** For a thin plate, added mass is comparable to the
  body's own mass. Its absence makes limbs too cheap to flick — it inflates the
  peak-speed tail *and* removes a real physical stabiliser. This is the third of
  B3's named candidates and it remains unaddressed.
- **The free surface is a solid lid.** `createArena` builds a 0.5 m-thick cuboid
  at `world.surface.y`, with the floor's friction and restitution. "Reaching the
  surface" means pressed against a ceiling and sliding along it at friction 0.3.
  That is exactly what the pinning count measures, and it is why C1 saw the
  corpus reorder (Spearman −0.06) between zero-g and tank measurement: the tank
  window measures wall friction, not swimming.
- **Within a single body, centre of buoyancy equals centre of mass**, so a body
  generates no righting moment of its own. `applyEnvironment`'s comment that
  "swim bladders emerge without being named" holds at creature level — a light
  anterior body and a dense posterior one do produce a net torque about the
  creature's centre of mass — but a single-body creature has zero static
  stability in orientation, and mean body count is 3.95.
- Linear and angular damping are both zeroed on the rigid bodies, so all
  resistance is hand-applied. That is correct and worth keeping.

---

## 6. Spec defects to add to the table

| Doc | Defect |
|---|---|
| 10 §A8 | **the drag law is specified as "applied at each body's centre".** That clause is the defect: a centre-applied force produces no torque, so undulation cannot generate rotational thrust and the angular resistance has to be invented separately. The reference applies force at 24 offset sample points. Amend before anyone implements against A8 again. |
| 10 §A8 | **no local-velocity rule.** The reference's sample velocity is `v + omega x r`. Without it, a limb rotating about its own centre has zero centre-of-mass velocity and therefore zero drag, which is most of why thrust is missing. |
| 10 §A8 | no lift term, and no statement that drag is one-sided (faces moving away from the flow contribute nothing). |
| 10 §2 (A1) | **"a randomly generated creature in a water world is therefore approximately neutrally buoyant by chance" is false as generated** — 13% of the corpus is within 5% of neutral, median net buoyant acceleration is 2.4 m/s^2. The gene-range midpoint is not the volume-weighted bulk density of an instantiated creature. |
| 10 §2 (A1) | the density widening is justified entirely by the thick-gas world, which the slice does not contain. It should be scoped to that world rather than applied globally. |
| 02 §7 | the density range against `mediumDensity` 1.0 is stated as a tuning question. It is a **law** question: the reference removes buoyancy from water entirely rather than tuning it. |
| 03 §5 | creature collider friction and restitution have no source of their own and are read from `world.floor`. |

---

## 7. Recommended sequence

1. **Make W1 neutral by construction**, as the reference does — either set
   `mediumDensity` to the volume-weighted corpus median, or clamp
   `RANGE.density` hard for the slice and record A1 as deferred to the world
   that needs it. A `w1_slice.js` change. It removes pinning outright and
   unblocks C1's zero-g amendment, which can then be withdrawn.
2. **Port the per-face fluid law, lift disabled.** 6x locomotion, and the
   ad-hoc angular drag term can be deleted because torque now falls out of the
   same law. Its own delivery: it invalidates every B3 and C1 number, so plan a
   re-measure rather than a diff.
3. **Then lift, with a rotation-based integration.** This is where the 6–8 m
   closing distance comes from. Do not attempt it behind a magnitude clamp —
   see §3.
4. **Then re-run `tools/c2sweep.js` and `tools/c2diag.js`** before touching the
   capability card UI. C2's checkpoint becomes answerable at step 3, not before.
5. **Do not expect any of this to answer B3's checkpoint.** Undulation is a
   controller question and the correlations in §4 say so. Worth settling before
   the B5 art pass, and worth taking up separately as B3 already recommended.

## 8. Carried obligations this sitting closes or changes

- **CLOSES** — "buoyancy dominates locomotion by ~40x, worth deciding at B5".
  Measured at 108x, and the decision is no longer a tuning choice: the reference
  removes buoyancy from water rather than narrowing it.
- **CLOSES** — "the candidates for what limits thrust are the controller, a pure
  quadratic drag model with no lift or added-mass term, and MOTOR_SCALE".
  The drag model is confirmed as a cause and quantified at 6x (drag) and 37x
  (drag plus lift). Body-plan correlation stays near zero under both laws, so
  the controller remains a separate, unresolved cause.
- **CHANGES** — "C2 is blocked and the blocker is buoyancy". The blocker is
  buoyancy *and* the drag law, and buoyancy alone is the smaller of the two.
- **NEW** — a magnitude bound on a force is not an energy bound. Any future
  non-antiparallel force term (lift, added mass, thrust surfaces) needs an
  energy-preserving integration, not a clamp. The gate asserts "drag must never
  add energy"; that assertion would not have caught this, because the current
  drag law cannot violate it by construction. An assertion whose corpus cannot
  violate it asserts nothing — B4's own lesson, in a new place.
- **NEW** — divergence in the fluid term is time-dependent. Anything measured
  over a shortened window under-reports it.

---

# Session 2 — the drag law, and what it uncovered

Gate at close: **GREEN, 80 assertions, 76 passed, 0 failed, 4 pending.**

## 9. What the original symptom actually was

"Buoyancy makes them move faster than they can move on their own" was true and
concealed three separate problems:

| | status |
|---|---|
| buoyant drift 108x locomotion, pinning every creature to a boundary | **closed** |
| locomotion near zero because the drag law could not produce thrust | **largely closed** |
| morphology does not predict travel | **resolved, and it was never a separate defect** |

## 10. The drag law (10 §A8, amended)

Per-face: 24 sample points per limb, local velocity `v + omega x r`, force applied
AT the face so torque falls out of the same law, one-sided. The ad-hoc `r^5 * 0.4`
angular term is deleted. Face table precomputed, one rotation matrix per body per
step, no allocation in the hot loop.

| | before | after |
|---|---|---|
| locomotion p50, 15 s | 0.23 m | 0.64 m |
| p90 | 0.61 m | 2.78 m |
| peak speed max | 9.7e4 m/s | 80 m/s |
| divergent | some | 0 |

**The law is exactly right.** Measured drag force against analytic at 0.1, 0.5,
1, 2, 5, 10 and 30 m/s: ratio 1.000 at every point (`tools/_dragmicro.mjs`).

## 11. Three false leads, each killed by measurement

- **Drag-weakening feedback.** Suspected the momentum cap suppressed drag as
  `1/v`. Killed by §10's micro-test: the cap never binds in the operating range.
- **The controller.** `computePhases` makes phase a function of depth alone, so
  siblings are always in unison. Killed: forced unison 0.510 m, genome phase
  0.572 m, randomised phase 0.559/0.636 m. Coordination is not the limiter.
- **"They aren't swimming."** Killed: net displacement grows 2.85x, 2.77x, 3.64x
  per tripling of duration — LINEAR, i.e. ballistic. They swim in a straight
  line. Tortuosity 119 is a per-stroke wobble on a steady drift, not a walk.

## 12. Morphology does predict travel — a correction

An earlier session reported Spearman |rho| <= 0.16 against every shape measure
under both drag laws. That was measured in the lab harness with the old guards
and it is WRONG for the shipped per-face law. Measured properly:

| | rho(wetted area) | rho(aspect) |
|---|---|---|
| shipped, motorScale 1.0 | -0.38 | -0.10 |
| motorScale 50 | -0.45 | +0.31 |
| stress model | -0.45 | +0.23 |

More wetted area means less travel — correct, more drag. And with realistic
power, slenderness starts to PAY. The per-face law fixed this; it was never an
independent defect and it does not need the controller.

## 13. Actuator power — the remaining factor, derived not tuned

`MOTOR_SCALE = 1.0` is dimensionally meaningless: torque is [force][length],
`A` is [length]^2, so the constant carries units of pressure x length.

Derived instead: a muscle of cross-section `A` at stress sigma pulls with force
`sigma*A` and inserts about one joint-radius `sqrt(A)` from the axis, so
`maxTorque = sigma * A^(3/2)`. In slice units — density relative to water, so
mass is 1/1000 of SI and the force unit is 1 kN — vertebrate muscle at 2e5 Pa
gives `MUSCLE_STRESS = 200`.

Measured: travel p50 0.78 -> 2.83 m unbounded, **2.96 m in the duel tank**, which
is the 2-3 m C2 needs. Zero divergence.

Two pieces of muscle physics were missing and both matter:

1. **Hill force-velocity.** Without it, a realistically-sized muscle accelerates
   a light limb without bound — peak spin 5185 rad/s. `OMEGA_MAX` is derived and
   size-independent: muscle shortens ~10 lengths/s, insertion speed is
   `omega*sqrt(A)`, the `sqrt(A)` cancels, so the ceiling is ~10 rad/s for every
   joint whatever its size.
2. **Hill applies to the ACTIVE term only.** Scaling the whole budget by `fv`
   also killed the DAMPING term, so above `OMEGA_MAX` a joint produced neither
   drive nor resistance and a spun limb coasted freely: 732 rad/s, bodies
   thrashing at a sustained 26.7 m/s. Passive viscoelasticity does not vanish
   with speed — at speed it is what dominates. Fixing this took median body
   speed to 18.1 m/s.

**STILL NOT THE DEFAULT.** `opts.torqueModel` is `'scale'`; flipping one word
switches it. Outstanding before it can ship:
- sustained body speeds ~18 m/s. Cause understood: at this stress the muscle is
  so strong relative to limb inertia that every joint runs VELOCITY-limited, and
  a 5-7 joint chain compounds to `OMEGA_MAX * chain radius` ~ 30 m/s. This is a
  morphology-space consequence, not a unit error, and the honest fixes are a
  per-joint arm shorter than `sqrt(A)` or a limit on chain length.
- an occasional divergence returned (one creature at 19851 m/s).
- L2-1 probe determinism reds under the stress model, unexplained. Torque
  magnitude should not affect determinism at all. **Diagnose this first.**

## 14. Resident selection had two holes, both found by the gate

- **Maximising spread selects corpses.** The first post-§A8 run chose a creature
  cruising at 0.087 m/s. Fixed with a liveness floor at 0.1 x the candidate
  MEDIAN — relative, so it carries no tuned constant across a physics change.
- **And it selects creatures that cannot fight.** `runDuel` aborts as `unstable`
  above `UNSTABLE_SPEED`; the fastest candidate maximises spread and is exactly
  the one that trips it. Three attempts were needed:
  1. A solo overspeed filter dropped NOTHING — the failure is an INTERACTION in
     the shared arena, a collision, invisible to a solo run.
  2. Ranking triples and walking down failed on all top 40 — the offender has
     the highest spread, so it is in every high-ranking triple.
  3. Per-candidate duels work, but REFEREES MUST COME FROM THE QUARTILES. Using
     the fastest candidate as a referee dropped 38 of 40: it destabilises
     everyone it meets, so it convicted the field instead of itself.

  Final: 9 unstable candidates dropped, highest-spread triple accepted, spread
  1.255 (against 1.262 unfiltered — almost nothing lost). Cruise 2.56 / 5.95 /
  0.87 m/s, all plausible.

## 15. Assertions amended, and why each was wrong

- **L1-21** asserted drag never increases linear speed and never increases spin,
  SEPARATELY. That is a property of a centre-applied antiparallel force, not of
  fluids: a limb that rotates and pushes the creature forward is drag converting
  spin into translation. The assertion would have forbidden swimming. Restated
  as the invariant that actually holds — the fluid term never increases a free
  body's TOTAL kinetic energy — with the pure-translation case retained, where
  the old wording is meaningful.
- **L1-18** asserted the EXPONENT literally (doubling `A` doubles the spin),
  which is true of `scale` and false BY DESIGN of `stress`. N19 is not about the
  exponent; it says torque comes from GEOMETRY and never from MASS. Now asserts
  both models against their own predicted exponents, with the density check —
  the load-bearing one — identical for both.

Both are the same mistake: an assertion encoding the current implementation's
accidental properties as if they were laws, and thereby blocking the correction.

## 16. Standing lessons

- **A magnitude bound on a force is not an energy bound.** A perpendicular
  impulse at any clamp still grows `|v|` by Pythagoras, ~12% per step at the
  bound tested.
- **An energy bound alone permits reversal.** An exact velocity reversal is
  energy-neutral, so `dE <= 0` allows `v -> -v` — precisely B3's divergence
  mechanism. Energy and momentum caps are independent and both are needed.
- **Background jobs are SIGKILLed, so `try/finally` cannot protect the tree.**
  Hence the sentinel and N24.
- **Divergence in the fluid term is time-dependent.** At 8 s a configuration
  reports p95 peak 273 m/s; at 15 s the same one reports 1e14.

---

# Session 3 — the derived actuator, shipped

Gate: **GREEN, 80 assertions, 76 passed, 0 failed, 4 pending**, with
`torqueModel: 'stress'` as the DEFAULT.

## 17. L2-1 was never a determinism failure

Reported last session as "probe determinism reds, unexplained". Wrong framing.
Every trace comparison in L2-1 passes byte-identically; the single failing check
was `the reference creature compiles`, i.e. `compileSolo` returning invalid. It
was the same instability appearing in a third place, not a new mystery. Reading
the failure detail rather than the assertion title would have saved a session.

## 18. The moment arm was the missing anatomy

`maxTorque = sigma * A^(3/2)` assumed the muscle inserts at the joint RIM.
Vertebrate tendons insert close to the axis: moment arm over limb radius is
roughly 0.1 to 0.3. `MOMENT_ARM_FRACTION = 0.2` is the middle of that range and
it is a direct multiplier on torque, so it was never a detail.

Swept, 40 creatures, 15 s, gravity 0 (`tools/_arm.mjs`):

    arm    n_ok  div   travel p50   body speed p50   max speed   rho(area)
    1.0      40    0        2.47           18.45         446       -0.36
    0.5      39    1        2.24           14.91         194       -0.42
    0.2      40    0        1.60           12.01          84       -0.46
    0.1      40    0        1.37           10.21          75       -0.30
    0.05     40    0        1.26            7.52          87       -0.18

0.2 is both the anatomically correct value and the one where the divergences
stop. Taking the honest physics costs travel — 2.47 -> 1.60 m — and that cost is
the finding, not a disappointment.

Shipped result, whole gate corpus: **locomotion p50 0.64 -> 1.45 m over 15 s**,
p90 2.78 -> 4.88 m, peak spin 265 -> 193 rad/s, 0 divergent. Nine assertions went
green when the moment arm was corrected, including L2-1, L2-10, L2-11 and L1-30.

## 19. A real bug the gate caught: motorScale stopped meaning "off"

`motorScale: 0` is how the gate and every diagnostic disable motors. The first
stress implementation read `motorScale` only in the 'scale' branch, so under the
new default `motorScale: 0` left the motors RUNNING. L1-19 found it: two deeply
overlapping jointed limbs, meant to sit still, picked up 1.6 mm/s of drive that
had nothing to do with contact — a 1.6e-3 reading against a 1e-3 bound.

`motorScale` now multiplies whatever model is in force. Worth remembering as a
shape: adding a branch beside an existing one silently changed what an option
MEANT, and the only thing that noticed was an assertion about something else.

## 20. L1-22's speed bound, and why the number moved

25 m/s was calibrated against MOTOR_SCALE 1.0 — an actuator budget now known to
be about fifty times below muscle. With derived torque a limb tip legitimately
reaches OMEGA_MAX * limb radius ~ 20 m/s, so the old bound measured the weakness
of the motors rather than the plausibility of the physics.

Replaced by the bound that is actually physical: WALL / FIXED_DT, the tunnelling
speed, derived from the timestep and the geometry and identical to the rule
clampKinematics() already uses.

**This assertion does not say the tail is fine.** It measures the fastest BODY,
not the creature — a limb tip at 20 m/s belongs to a creature travelling at
0.1 m/s — and p90 (74.7) still exceeds the tunnelling speed. That remains a
recorded obligation.

## 21. Where locomotion actually stands

    shipped before this work        0.23 m / 15 s
    per-face drag law              0.64 m
    + derived actuator power       1.45 m
    needed to close a duel        ~2-3 m per creature

**Lift is back on the critical path.** Last session's guess that it would be
unnecessary assumed the rim moment arm; with the anatomically correct one there
is a factor of about two still missing, and lift measured ~6x in the lab. It is
now the most likely route to C2 rather than a nice-to-have.

## 22. Obligations carried out of this session

- **The peak-speed tail.** p90 74.7 m/s exceeds the tunnelling speed. Cause is
  understood and is not divergence: at derived stress the muscle is strong
  enough relative to limb inertia that joints run VELOCITY-limited, and a 5-7
  joint chain compounds toward OMEGA_MAX * chain radius. The honest fixes are a
  per-joint arm shorter still, or a limit on chain length, or accepting it and
  raising WALL. Not urgent — 0 divergent — but it is real.
- **Lift**, with an energy-preserving integration. See §3 and §16.
- **The naming reference constants** in naming.js are still B4's, measured under
  a generator two physics changes ago.
- **Residents will need re-freezing once more** after lift.

---

# Session 4 — lift, ported from the reference

Gate: **GREEN, 80 assertions, 76 passed, 0 failed, 4 pending.**
Lift is implemented, faithful, stable — and OFF by default. Why, below.

## 23. The reference's lift, verbatim

`ApplyFluidForcesSystem.ComputeFluidForce`, taken as-is because this is the part
of the reference that is already debugged and there was no reason to re-derive
it:

    Cl      = 1.2 * |c| * sqrt(1 - c^2)
    liftMag = 0.5 * rho * speed^2 * area * Cl * |c|
    liftDir = cross(cross(u, n_signed), u) / |cross(u, n_signed)|

Peaks near 45 degrees of incidence, zero head-on and zero edge-on. The
normalisation by `|cross(u, n)|` rather than by the outer cross product is
theirs and is correct: `u` is unit and perpendicular to the inner cross, so the
two magnitudes are equal and this is the cheaper one.

## 24. Why it did NOT need a new integration

The previous session recorded lift as needing "an energy-preserving integration,
not a clamp", after a lab attempt diverged. That turned out to be a property of
the LAB GUARD, not of lift.

Lift is perpendicular to the SAMPLE velocity, so `F_lift . v_sample = 0` exactly
for every sample. Summing over samples, `sum F_i . v_i = F_total . v +
T_total . omega`, so lift contributes PRECISELY ZERO to the power term the
shipped energy guard uses. `P <= 0` therefore still holds from drag alone and
the guard is valid unchanged. The earlier divergence came from a guard that
bounded force MAGNITUDE, which a perpendicular impulse escapes by Pythagoras.

This is also why the reference gets away with plain component-wise clamps: its
lift genuinely does no work, so there is nothing for a clamp to have to catch.

Measured, 40 creatures, 15 s, derived torque:

| | travel p50 | p90 | divergent | max speed |
|---|---|---|---|---|
| no lift | 1.60 m | 5.16 m | 0 | 84 |
| **lift** | **6.99 m** | 17.39 m | **0** | 510 |

**4.4x, and zero divergence in every condition tested.** The physics works.

## 25. Why it is off: the integration saturates before the physics does

With lift on, the whole gate corpus reports locomotion p50 6.26 m — comfortably
past the 2-3 m a duel needs — but median PEAK BODY SPEED is 76.7 m/s against a
tunnelling limit of `WALL / FIXED_DT` = 60 m/s. Above that a body crosses a wall
between two collision queries and the arena stops being solid.

Clamping after the step as well as before (a correct change, kept: the bound has
to hold on the velocity the step PRODUCED, since that is what the next
collision query sees) brings every number to exactly 60.0 — median, p90 and max.
That is worse than a failure, it is a tell: **the ceiling has become the dominant
physics rather than a safety net.** A simulation whose median creature is pinned
to its own numerical limit is not measuring swimming any more.

So the finding is not "lift is unstable". It is:

> Derived muscle plus the reference's lift is more power than this
> discretisation can carry. dt = 1/120 with 0.5 m walls cannot represent it.

Four honest resolutions, none of them a tuning dial:

1. **Smaller timestep** for the fluid and motor terms. Most faithful, most
   expensive, and it raises the tunnelling limit proportionally.
2. **Thicker walls.** One line, and it raises the limit for free — the 0.5 m is
   itself arbitrary and nothing else depends on it.
3. **Shorter chains.** The residual speed is chain compounding: a distal limb's
   tip runs at `OMEGA_MAX * chain radius`, and morphogenesis permits 7-body
   chains with cumulative per-axis scale, so a radius of 8 m is reachable. Real
   animals do not have eight 2 m segments each rotating at 10 rad/s. Capping
   recursion or cumulative scale is a GENOME-space fix for a genome-space cause.
4. **Accept that the reference's Cl = 1.2 belongs to a world with no walls.**
   The aquatic reference runs at zero gravity in an unbounded volume and
   repositions creatures to the origin instead of containing them. Its
   coefficients were never asked to coexist with a tank.

My reading: (3) is the real cause and (2) is the cheap unblock. (1) is correct
and should happen eventually regardless.

## 26. State

    original                        0.23 m / 15 s
    per-face drag law               0.64 m
    + derived actuator              1.45 m
    + lift (available, not default) 6.26 m
    needed to close a duel         ~2-3 m

The shipped default sits at 1.60 m on the lift harness corpus, 1.45 m on the
gate corpus — still short. Lift is one option flag from closing it, and the only
thing in the way is a discretisation limit with four known fixes.

## 27. Carried

- Chain compounding, now the binding constraint rather than a curiosity.
- `L1-22` bound is `WALL / FIXED_DT`; p90 sits AT it with lift off, which is
  tight. Any of §25's fixes gives it headroom back.
- Residents re-freeze after lift lands.
- naming.js reference constants still B4's, three physics changes old.

---

# Session 5 — STOP. The creatures are not swimming.

Prompted by a reader asking how 60 m/s peaks reconcile with 6 m in 15 s. They do
not, and chasing that question overturned the four preceding sessions'
interpretation. The gate is GREEN and the numbers in it are real; what they MEAN
is not what was reported.

## 28. The reconciliation, sampling every step

|  | lift OFF (shipped) | lift ON |
|---|---|---|
| net speed (displacement / 15 s) | 0.107 m/s | 0.468 m/s |
| **centre-of-mass PATH speed** | **5.50 m/s** | **16.92 m/s** |
| COM peak instantaneous | 17.6 m/s | 60.7 m/s |
| fastest body peak | 45.5 m/s | 60.0 m/s |
| tortuosity | 36 | 27 |
| final kinetic energy | 863 | 3474 |

The CENTRE OF MASS — the whole creature, not a limb tip — travels 5.5 to 17 m/s
along a path 27-36x longer than its net displacement. They vibrate violently and
drift slowly.

Earlier sessions measured NET displacement and its growth with time, found it
linear, and concluded "ballistic, therefore swimming". A violent thrash with a
small directional bias also grows linearly. The test was not wrong; it was not
sufficient, and no one asked how fast the COM itself was moving.

## 29. The joints do not track their command

Commanded reversal rate is 0.80/s (omega ~1 rad/s). Achieved:

    POSITION scale          3.7/s     travel 0.40 m
    POSITION stress        12.4/s     travel 0.71 m
    POSITION stress+lift   21.6/s     travel 4.95 m
    VELOCITY scale          2.2/s     travel 0.17 m
    VELOCITY stress         6.9/s     travel 0.28 m
    VELOCITY stress+lift   17.5/s     travel 1.30 m

Nyquist for FIXED_DT is 60/s, so the joints run a third of the way to pure
timestep noise. **Travel is a monotone function of chatter rate across all six
configurations.** The locomotion IS the buzzing.

30 §142 states the goal for this stage: "It swims, and it looks alive rather
than convulsive." We are on the wrong side of that sentence, and 10 §A7's
velocity-motor fallback — provided for exactly this — only halves the chatter
while costing most of the travel. It is not the fix.

## 30. It is SELF-EXCITED: the command is irrelevant

Scaling the commanded amplitude by 10x changes neither the chatter nor the
distance:

    amplitude   chatter/s   travel
    1.0            12.4      0.71 m
    0.6            10.4      0.94 m
    0.3            11.2      0.65 m
    0.1            12.1      1.19 m

A creature told to move a tenth as much moves the same. The oscillation is
sustained by the actuator-solver-timestep loop, not by the gait, and its
amplitude is set by MOTOR STRENGTH alone.

**This retroactively explains every earlier negative result**, and they should
have been read as one symptom rather than four separate findings:

- §11 phase made no difference (unison vs genome vs scrambled) — the command
  never drove the motion, so its phase could not matter.
- §12 morphology correlations were weak and unstable — shape cannot select on a
  motion the shape is not producing.
- §13 travel rose monotonically with motorScale — stronger motors, more
  energetic limit cycle.
- §5 tortuosity 119 was measured and REPORTED without following it up. It was
  the whole answer, three sessions early.

## 31. What this means for the preceding work

Not that it was wrong — that its interpretation was.

- **Buoyancy (§1-2) stands.** Independent of the actuator, measured statically
  and confirmed against the reference. Neutral by construction is correct.
- **The drag law (§10) stands as CODE.** It is verified against analytic to
  ratio 1.000 at seven speeds, and that test does not involve motors at all.
- **The travel numbers attributed to it do NOT stand as swimming.** 0.23 -> 0.64
  -> 1.45 -> 6.26 m are real displacements of a buzzing object. How much of each
  step is thrust and how much is a livelier limit cycle is UNKNOWN and must be
  re-measured once the joints track.
- **The derived actuator (§13, §18) is physically sound and made the symptom
  worse**, because the limit cycle scales with actuator power. It is not the
  cause and reverting it would not fix anything, it would only quieten it.

## 32. The one thing to do next

Find why a PD joint controller self-oscillates at 12-22 Hz under a command at
0.13 Hz. Not tuning — diagnosis. Candidates, none tested:

1. **Torque saturation making the PD bang-bang.** maxTorque clamps the total,
   and a saturated PD is a relay: relays limit-cycle. Testable by logging the
   fraction of steps at the clamp.
2. **The damping term fighting the solver.** applyMotors already carries a
   comment about a torque held on a fixed parent-frame axis doing net work over
   a cycle — a pump was found here once and fixed by damping the full vector.
   This may be the same family, not fully closed.
3. **Gain versus timestep.** omega_n * dt for a stiff joint approaches the
   explicit stability limit; the PD is applied as an external torque through
   addTorque rather than as a Rapier joint motor, so nothing is implicit.

**Do not tune constants until one of these is confirmed.** Every constant in
this system is now derived from something real, and the temptation to quieten
the symptom by weakening the muscle should be resisted — the muscle is not the
problem.

## 33. A note on method

The failure that mattered was not any single measurement. It was reporting a
ratio of 119 in §5, calling it "a per-stroke wobble on a steady drift", and
moving on. The number was already anomalous; it was rationalised in a sentence
instead of being followed. Four sessions of real work sit downstream of that.

---

# Session 6 — the actuator is a relay. Root cause found.

Prompted by watching the creatures: most twitch violently, a MINORITY move at
1.5-3 m/s and look acceptable. A bimodal population has a discriminator, and
looking for it found the root cause of everything since session 1.

Gate: **GREEN, 80 assertions, 76 passed, 0 failed.** All new options default off.

## 34. The measure that was missing: efficiency and heading

    net speed        p50 0.107 m/s
    COM path speed   p50 5.50 m/s
    EFFICIENCY       p50 0.022        (net / path; a fish is ~0.9)
    heading persist  p50 -0.22        (+1 straight, 0 random walk)

Persistence is NEGATIVE: consecutive seconds of displacement are
ANTI-correlated. They do not random-walk, they oscillate in place. **They cannot
control direction — not poorly, at all.**

And the metric reproduces what the eye saw: the 3/60 creatures above efficiency
0.10 have COM path speed 0.57 m/s (the calm ones); the 25/60 below 0.02 have
7.94 m/s (the violent ones). Same population, same split.

**S1 measures cruiseSpeed and not this.** Selection currently cannot tell a
swimmer from a vibrator, which is why C2's matchup matrix says so little.

## 35. Two of my own metrics were wrong. Recorded so they are not reused.

- **Sign-change "chatter" is invalid.** With motors OFF it reads 18.3/s while
  COM speed is 0.00 — it counts numerical noise in the angle. Every chatter
  figure in session 5 is unreliable.
- **Net travel is too noisy to test a hypothesis with.** Session 5 concluded
  "the gait is irrelevant" from net travel against amplitude. Measured on COM
  path speed instead: flat target 0.36 m/s, real gait 1.73 m/s. The gait drives
  most of the motion. That conclusion was wrong.

## 36. Where the motion comes from, isolated

| | peak joint \|omega\| | COM path speed |
|---|---|---|
| baseline (fluid + motors) | 51.2 | 1.73 m/s |
| **no fluid** (mediumDensity 0) | **46.3** | 0.00 |
| fluid, **no motors** | **0.0** | 0.00 |
| no fluid, **old** motors | 44.0 | 0.00 |

The spin is entirely MOTOR-driven — the fluid is irrelevant to it — and it is the
same magnitude under the OLD torque model, so it predates every change in
sessions 2-5. COM motion is entirely FLUID-driven, as it must be: internal
forces cannot move a centre of mass.

Chain: PD drives joints to ~50 rad/s on a ~1 rad/s command -> fast limbs make
large alternating fluid forces -> those shake the COM -> net travel is a small
rectification residue with anti-correlated heading.

## 37. ROOT CAUSE: the PD saturates into a relay

| stiffness | damping | saturated | peak omega | net m/s | efficiency | persist |
|---|---|---|---|---|---|---|
| **1.0** (shipped) | 0.12 | **52%** | 51.5 | 0.095 | 0.038 | -0.24 |
| 0.1 | 0.12 | 0% | 5.1 | 0.005 | 0.074 | -0.23 |
| 0.01 | 0.12 | 0% | 0.1 | 0.002 | 0.681 | 0.77 |
| 0.01 | 1.0 | 0% | 0.0 | 0.001 | **0.930** | **0.92** |
| 0.003 | 2.0 | 48% | 15.5 | 0.011 | 0.055 | -0.10 |

The shipped controller is at its torque clamp **52% of the time**. A saturated PD
is a bang-bang relay, and relays limit-cycle. Saturation correlates with
everything: unsaturate it and efficiency goes to 0.93 and persistence to 0.92 —
straight-line, fish-like swimming.

**But there is no gain setting that gives both.** Every unsaturated row has net
speed <= 0.005 m/s. Thrust and stability are mutually exclusive inside an
explicit PD, which is exactly why the reference does not use one.

## 38. What the reference does, and it has four defences to our zero

| | reference | us |
|---|---|---|
| motor | `RotationMotor` CONSTRAINT, solved implicitly by the solver | explicit PD via addTorque |
| tuning | SpringFrequency 10 Hz, DampingRatio 0.9 (near-critical) | MOTOR_STIFFNESS 1.0, MOTOR_DAMPING 0.12 |
| bound | MaxImpulse = 2 * MinCrossSectionalArea | torque clamp (same idea) |
| target slew limit | MAX_ANGULAR_VELOCITY 15 rad/s | none |
| target low-pass | lerp(current, target, 0.8) per step | none |

An IMPLICIT spring-damper cannot ring however stiff it is; that is the whole
point of solving it inside the constraint solver. Their MaxImpulse bounds
actuator strength without turning the controller into a relay, because
saturation of an implicit constraint degrades gracefully.

They also document the failure modes they hit — a RotationMotor 360-degree
startup flip, and AngularVelocityMotor "can create angular momentum out of
nothing" — which is worth reading before choosing between Rapier's equivalents.

**Their two smoothing defences were implemented here and measured: they change
nothing** (efficiency 0.022 -> 0.022, persistence -0.23 -> -0.21). Correctly so.
Our targets already come from a sine at ~1 rad/s, so a 10 rad/s slew limiter
never binds. The reference needs them because its targets come from a NEURAL
NETWORK whose output can step arbitrarily. Kept behind `opts.smooth`, off, for
when L2 gains a real controller.

## 39. The fix, and the note in the code that chose against it

Replace the explicit PD with Rapier's built-in joint motor —
`configureMotorPosition(target, stiffness, damping)` — solved implicitly, with a
max impulse from `minCrossSectionalArea` so N19 survives.

physics.js already records why this was not done: "ForceBased would work but
hides the law that N19 is." That was a decision to keep the torque law visible
in our own code rather than delegate it to Rapier's motor model. It is a
defensible instinct and it has cost the entire locomotion effort: N19 can be
preserved exactly by setting the motor's max impulse from the same
cross-sectional area, with a comment, and nothing about the law becomes hidden.

## 40. What this does and does not invalidate

- **Buoyancy (§1-2): stands.** Static, no actuator involved.
- **The drag law (§10): stands as code.** Verified against analytic to ratio
  1.000 at seven speeds, a test with no motors in it.
- **The derived actuator (§13, §18): stands as physics, and is not the cause.**
  The relay is present at identical magnitude under the old torque model.
- **Every travel number from sessions 2-5 measures a vibrating object.** They are
  not swimming speeds and must be re-measured after §39.
- **Lift (§23-25): unresolved and now un-measurable.** Its 4.4x was measured on
  the relay. Re-test after §39, not before.

## 41. Next, in order

1. **Implement §39.** Nothing else can be measured honestly until it lands.
2. **Add efficiency and heading persistence to S1**, beside cruiseSpeed. Without
   them selection cannot see the difference the eye can, and 30 §142's "alive
   rather than convulsive" has no numerical form.
3. Re-measure lift, the moment arm, and the peak-speed tail — in that order,
   against the new actuator.
4. Only then re-freeze residents.

---

# Session 7 — audit against the reference, and energy

## 42. Energy: we have it, and it is the right shape

`work = sum |tau . domega| dt` already accumulates in applyMotors and S2 reads it.
Turned into the standard biological measure — **cost of transport**,
`work / (mass * distance)`, dimensionless and comparable across body sizes:

    work (J)            p50 8357
    power (J/s)         p50 557
    COST OF TRANSPORT   p50 763          salmon ~0.5, human swimmer ~10
    rho(efficiency, CoT)      -0.39      frenzy does cost more, weakly
    rho(net distance, work)   -0.04      burning energy gets you NOWHERE

    efficient (eff>0.05):  CoT  522, power 137 J/s
    frenetic  (eff<0.02):  CoT 1334, power 868 J/s

Three orders of magnitude worse than any animal, and work is UNCORRELATED with
distance. Cost of transport is what food consumption should read at L3 and it
needs no new machinery — only exposure.

**But note what the reference does about energy: NOTHING.** Its fitness is raw
displacement (WaterDistanceAssessmentSystem: `distance(current, start)`), with no
energy term anywhere. That works for them because in their simulator thrashing
does not produce displacement. In ours it does, so distance-alone selection would
actively reward the relay. Our energy metric is currently COMPENSATING FOR A
DEFECT rather than adding realism — and once the actuator is fixed, displacement
alone may well suffice, exactly as it does for them.

## 43. The audit

**Faithful already — do not touch:**

| | reference | vivarioops |
|---|---|---|
| dimensions | 0.2 – 2.0 | 0.2 – 2.0 |
| recursive limit | 1 – 10 | 1 – 6 (slice 2) |
| connections/node | 0 – 4 | 0 – 4 (slice 3) |
| parent face | 0 – 5 | 0 – 5 |
| position on face | [-1,1]^2 | [-1,1]^2 |
| orientation | ±pi/4 | ±pi/4 |
| scale | 0.5 – 2.0 cumulative | 0.5 – 2.0 cumulative |
| reflections | X, Y, Z independent | X, Y, Z independent |
| terminalOnly | yes | yes |
| joint types | 7 (Rigid…Spherical) | same 7, slice uses 3 |
| angle limits | ±pi/2 | same |
| density gene | none (mass = x·y·z) | none in slice (band [1,1]) |
| fluid model | 24 samples/limb, v+omega×r, applied at r, one-sided | identical |

The genome and morphology are essentially an exact port. This is the part that
should stop being re-examined.

**Divergent, and each is a decision rather than an oversight:**

| | reference | vivarioops | verdict |
|---|---|---|---|
| **actuator** | `RotationMotor` CONSTRAINT, implicit, SpringFreq 10 Hz, DampingRatio 0.9, MaxImpulse 2·A | explicit PD via addTorque, saturating 52% | **DEFECT — root cause** |
| controller | evolved neural net, 0–10 neurons/node, 11 sensors/limb (5 contact, 3 light, 3 joint) | fixed sine oscillator + phase lag | deliberate slice scope (11 §10) |
| drag coefficient | Cd = 0.5 + 1.5(1−\|c\|)² | Cd = 1 × world 0.9 | ours verified vs analytic; keep |
| lift | Cl = 1.2\|c\|√(1−c²) | implemented, default off | re-test after actuator |
| world | zero gravity, no ground, UNBOUNDED, reposition to origin | tank, walls, floor, surface | ours by design (duels) |
| fitness | displacement only | duel capability | ours by design |
| energy | none | work accumulator | we are ahead |
| target smoothing | slew 15 rad/s + low-pass 0.8 | implemented, no effect | correct — our targets are already smooth |

## 44. The answer on Rapier delegation: YES, and narrowly

The audit says the divergence is not broad. Genome, morphology and fluid are
already the reference's. **Exactly one item in the physics loop differs
structurally, and it is the measured root cause**: they solve the motor as a
CONSTRAINT inside the solver; we integrate a PD outside it.

That is the whole case. An implicit spring-damper cannot ring however stiff it
is, and its saturation degrades gracefully instead of becoming a relay. Rapier's
joint motor (`configureMotorPosition(target, stiffness, damping)`) is the direct
equivalent of Unity's `RotationMotor`, with `max_force` standing in for
`MaxImpulse`.

**N19 survives intact**, which was the objection recorded in physics.js —
"ForceBased would work but hides the law that N19 is". Set the motor's max force
from the same `minCrossSectionalArea` the current clamp uses, with the comment
kept. The law stays visible in our code; only the INTEGRATION moves into the
solver, and integration was never what N19 was about.

**Do not delegate anything else.** Specifically: the neural controller is L2/L3
scope and the oscillator is a deliberate, spec-acknowledged simplification; the
unbounded zero-gravity world is theirs because they measure displacement and we
measure duels; and their drag coefficient is looser than ours, which is verified
against analytic at seven speeds.

## 45. Order

1. Actuator to Rapier's implicit motor, max force from cross-section.
2. Re-measure efficiency, heading persistence and cost of transport. Everything
   from sessions 2–6 is measured on the relay and means nothing until this lands.
3. Expose efficiency, persistence and CoT in S1 beside cruiseSpeed.
4. Re-test lift, moment arm, peak-speed tail — in that order.
5. Re-freeze residents last.

---

# Session 8 — seeding, hand-authored geometry, and the recursion cap

## 46. How the reference seeds: randomly, and it says so

`SimsGenotypeFactory.CreateInitialisedGenotype()`, verbatim comment:

    // Sims creatures initialise with a random genotype.

Random nodes, then random connections, then random neurons. **There is no
designed seed anywhere in the reference.** Seeding is therefore NOT what
separates our results from Sims'.

Two operator differences do matter, and one is ours to change:

| | reference | vivarioops |
|---|---|---|
| connections in the initial genotype | up to 4 x nodeCount (dense) | slice caps 3 per node |
| asexual / crossover / **grafting** | 40% / 30% / **30%** | `allowGrafting: false` |

Grafting — transplanting a subtree between creatures — is nearly a third of
their reproductions and is switched off in our slice. That is a large hole in
the search operator set, and A17.3 already lists it as a step-F restoration.

## 47. Hand-authoring works today; there is simply no path to it

The genome is plain JSON, `deserialise` already exists (the residents use it),
and a hand-written serpentine genome loaded and simulated first try. Nothing is
missing except an authoring surface. `tools/_seed.mjs` builds them from the same
schema the factory emits, so mutation and breeding accept them unchanged.

## 48. Designed bodies beat random ones — but only once the actuator is fixed

12 s, gravity 0, random corpus n=40.

**Through the PD relay:** every design scored net 0.031-0.121 m/s and efficiency
0.021-0.046, indistinguishable from the random corpus (p50 0.111 / 0.029). The
relay erased the difference between a designed swimmer and a random tangle.

**Through the solver motor:**

| design | net m/s | efficiency |
|---|---|---|
| random corpus p50 | 0.026 | 0.034 |
| serpent, lag pi/2 | 0.029 | **0.193** |
| serpent, lag pi/3 | 0.019 | 0.143 |
| serpent, lag pi | 0.009 | 0.095 |
| serpent, NO lag (unison) | 0.008 | 0.058 |
| serpent, slow omega | 0.014 | **0.211** |

Six times the efficiency of the random median, and **the phase lag behaves
exactly as undulatory swimming says it must**: a pi/2 travelling wave is 3.3x
more efficient than unison, with pi/2 the optimum and pi worse again. That is a
real fluid-dynamical result falling out of the model unprompted, and it is the
strongest evidence so far that the physics is right.

It also retro-justifies the actuator work: this signal EXISTED all along and the
relay was hiding it.

## 49. The slice cannot build a serpent

`recursiveLimit` 4 and 6 both yield **4 bodies**. `SLICE_LIMITS.maxRecursion` is
2 against a full-system 6, so a self-connected chain terminates at three
segments plus a terminal fin. Every "6-segment" design above is really 3+1.

That is a hard constraint on the design space: undulatory swimming wants a
travelling wave along MANY segments, and 3 is not many. The efficiency numbers
above are therefore a floor, achieved by a body that cannot be the shape it
wants to be. Raising `maxRecursion` for locomotion work is a one-line slice
change and should be tried before concluding anything about body plans.

## 50. Latitude to modify geometry

Mutation reaches: per-node `dims` on three axes, `recursiveLimit`, joint type,
three angle limits and `phaseLag`; per-connection `parentFace`, `position` on
the face, `orientation`, three-axis `scale`, three reflection flags and
`terminalOnly`; plus node and connection add/delete. That is essentially the
reference's set.

What is missing versus the reference is not per-gene latitude but the STRUCTURAL
operator: grafting, at 30% of their reproductions, disabled here.

## 51. Consequences

1. **Do not seed to fix the median.** The reference does not, and our designed
   bodies do not beat random on SPEED — only on efficiency.
2. **Do seed to test the physics.** The serpent's lag sweep is a better physics
   check than any corpus statistic, and it should become a gate assertion: a
   pi/2 travelling wave must beat unison on efficiency, or the fluid model is
   wrong.
3. **Raise `maxRecursion`** before drawing conclusions about morphology.
4. **Enable grafting** for locomotion experiments; it is the operator that moves
   whole limbs between lineages.
5. Net speed remains the bottleneck and it is actuator power, not body plan.

---

# Session 9 — direction, and where this leaves us

## 52. They cannot orient their velocity vector, and my earlier claim was wrong

Session 7 reported "106 degrees of steering authority" from the angle between
turnBias +1 and -1 outcomes. That measured the MAGNITUDE of the response, not
whether it was ORDERED. Corrected, solver motor, n=30:

    monotonic steering response      1/30 creatures (3%)
    heading span, turnBias -1 to +1  p50 99 deg
    CLOSED-LOOP pursuit, 6 m target  0/30 reached within 1 m
    distance closed                  p50 0.39 m of 6 m, best 3.66 m

A large disordered response is chaos, not control. turnBias perturbs the outcome;
it does not aim it.

## 53. Bilateral symmetry is not the missing ingredient

turnSides() gives mirrored joint instances +turnBias and non-mirrored -turnBias —
a differential deflection that presupposes a left and a right, which a random
tangle usually lacks. Tested with a designed BILATERAL body (12 bodies, paired
reflectZ fins):

| design | -1 | -0.5 | 0 | +0.5 | +1 | monotone |
|---|---|---|---|---|---|---|
| bilateral fins | -110 | -63 | 0 | -19 | -86 | no |
| bilateral, lag pi/3 | 4 | -1 | 0 | 24 | 79 | nearly |
| bilateral, omega 3 | 47 | -17 | 0 | -85 | -56 | no |
| no reflection | -60 | -25 | 0 | 19 | 1 | no |

Symmetry alone does not produce steering. **Direction control is DOWNSTREAM of
gait coherence.** A static differential deflection can only rotate a velocity
vector that exists; at efficiency 0.19 — the best designed body, against a fish's
0.9 — there is not enough coherent thrust for a bias to steer. The one nearly
monotone row is the most efficient configuration, which is the tell.

So steering is not a feature to be built. It is a symptom, and it should be
re-measured after gait quality improves rather than engineered around.

## 54. Where this leaves us

**Verified correct, stop revisiting:**
- buoyancy — neutral by construction, matching the reference
- the drag law — measured against analytic at seven speeds, ratio 1.000
- the derived actuator physics — muscle stress, Hill force-velocity, tendon
  moment arm, all from real constants
- the fluid model's behaviour — a pi/2 travelling wave beats unison 3.3x on
  efficiency, unprompted. Textbook undulatory locomotion falling out of the model
- the genome and morphology — an essentially exact port of the reference

**Found and understood:**
- the PD relay: 52% torque saturation, the root cause of six sessions of
  confusing measurements. Solver motor drops COM path speed 5.52 -> 0.77 m/s
- selection works: median displacement 0.181 -> 5.546 m in 8 generations, 30x,
  and it had never been run
- seeding is not the gap: the reference initialises randomly and says so

**Not working:**
- net speed 0.03 - 0.1 m/s
- efficiency 0.03 random, 0.19 designed, against ~0.9 for a fish
- steering 3% monotone, 0/30 pursuit
- the slice cannot build a serpent: maxRecursion 2 caps chains at 3 segments

## 55. What to do next, in order

1. **Finish the solver motor and make it default.** Two open items, both
   recorded: work accounting for solver-driven joints, and L1-18's model
   assumption. NOTHING ELSE CAN BE MEASURED HONESTLY UNTIL THIS LANDS — every
   number from sessions 2-6 was taken through the relay.
2. **Raise `maxRecursion`.** Undulation wants a travelling wave along many
   segments and the slice permits three. One line.
3. **Put efficiency, cost of transport and heading persistence into S1**, beside
   cruiseSpeed. Selection cannot currently see the difference the eye can.
4. **Put cost of transport into fitness.** Measured: displacement-only selection
   improved distance 30x and left efficiency flat at 0.047. It breeds efficient
   thrashers. This corrects session 7, which argued displacement alone might
   suffice as it does for the reference — it does not, because in our simulator
   thrashing produces displacement.
5. **Enable grafting** for locomotion work: 30% of the reference's reproductions,
   disabled in our slice.
6. **Then run evolution properly** — population in the hundreds, tens of
   generations, efficiency in the objective. That is the actual experiment, and
   the 8-generation run converged to one genotype by generation 7, so diversity
   maintenance needs attention first.
7. **Re-measure steering afterwards**, per §53. Do not build steering machinery.
8. Sensors and an evolved controller remain the path to Sims' light-following
   demo. That is L2/L3 scope and an absence, not a defect.

## 56. A gate assertion worth adding

**A pi/2 travelling wave must beat unison on efficiency.** It is a sharper test
of the fluid model than any corpus statistic, it is cheap, and it would have
caught the relay six sessions earlier — through the PD every design scored
identically, and that identity was itself the evidence.
