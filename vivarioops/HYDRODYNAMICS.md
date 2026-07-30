# Vivarioops — the buoyancy/locomotion investigation

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
