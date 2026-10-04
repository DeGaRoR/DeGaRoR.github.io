# DEFORM-AND-BREAK — what BeamNG learnt, checked against our frame (2026-10-04)

The design doc that ROADMAP's deferred item 5 ("Deform and break [L]. Design doc first — it does not exist on
paper") and DEBT-REGISTER §7 ask for. It starts from the three pieces of pre-study already in the tree and does
not re-derive them:

- **HANDOVER "STRUCTURAL REALISM" §C/§D (2026-08-10)**: k is a per-class constant, 5-900x softer than EA/L, and
  wrong in SHAPE (12-60x spread within a class) more than in level. **Failure is a FORCE threshold**, so
  `Fy = sigY*A` is correct even on soft springs. But peak in-flight load is 0.9-13 % of yield, so a raw physics
  failure model "would never trigger in flight — it would be a crash-only phenomenon".
- **HANDOVER "RUPTURE AND PERMANENT SET — the costed design (NOT implemented)" (2026-08-11)**:
  - add `sigU / eBreak / brittle` to `phys`;
  - stamp `Fy`, `Fu` and `Fc = min(Fy, pi^2 EI/L^2)` in `B()`;
  - add twenty lines in the beam loop that move `L0`;
  - "RESET REPAIRS THE AEROPLANE FOR FREE";
  - k never rises, so substeps stay valid;
  - "RATE-LIMIT the plastic flow … or an oscillating member ratchets its way to destruction".
- **GAME-LAYER-2026-09-14 §8 "FAILURE BEFORE DEFORMATION"**, ruling **(bd) Recommended**. Structural failure first
  ("your wing folded because you exceeded the load you certified it for"); crumpling and persistent visual damage
  "can wait years". It sits in the sequence as **P5g [M]**. Ruling **(bh)**, whether damage persists between
  flights, is **owed**.

The sessions since then changed what this doc can stand on:

- **G458** (2026-09-21): certificates fail on BROKE UP or a >15 % tip.
- **G610** (2026-09-26): the flight box and `trueBox()`.
- **G790-G793**: rigid float clusters out of the network.
- **TREE-HITBOX G1330-G1334** (2026-10-03): beams against trunks. Its open call: "**A crash is not modelled** … a
  damage/crash hook on `trunkHits` is the user's call".
- **GEAR-WATER G1380-G1383**: 6.5-9 g ditchings, reverted from train 27.
- **SND-AIRFRAME G1630** (2026-10-04): touchdown and impact detection, audio only.

Nothing in `src/` breaks, yields or ends a flight on load today. **"BROKE UP" means the sim went NaN**
(`app.js:11546`, `65_gen_loadtest.js:372`), and the bench card words it as "a member let go" (`bench.js:148`).

No G-block is reserved yet. **A0 to assign one** (suggested: the next free hundred after SOUND's G1600-G1699).
Sessions would be named `DMG-*`.

**Revised the same day (second pass)** after the user's own crash study and four answers:
- the reference aircraft: Cub, Cessna 172, Robin/Jodel, Beaver;
- damage is not carried between flights; a repair bill is computed instead;
- fire needs conditions;
- clipping after deformation must be handled;
- how big the job is.

New: **§7** real crashes (each observation checked against accident reports, CFR Part 23 and NASA's crash tests,
and given its mechanism), **§8** clipping, **§9** fire, **§10** repair cost, **§11** the plan with its size,
**§12** rulings, **§13** copyright. §1-§6 stand, with the material rules now set by §7.

---

## 0. THE IDEA IN ONE PARAGRAPH

**We are already a BeamNG-class solver**: nodes with mass, massless axial spring-damper beams, semi-implicit Euler at
a fixed sub-millisecond step. That is exactly the Rigs of Rods core BeamNG grew out of; RoR's is read below line by
line. What BeamNG added over fifteen years is not a different physics. It is **a constitutive layer on the same
beam**, plus authoring discipline:

1. a force threshold that moves the beam's rest length (plasticity), with hardening and a travel limit;
2. a break force above it;
3. groups that break together (detaching parts);
4. groups that flip visual state on small deformation (glass, lights);
5. one-sided beams that stop parts passing through each other;
6. a skin that follows the nodes and deletes its own polygons over a broken beam.

Every one of those is a few lines on top of a loop we already have. The hard part BeamNG talks about is **tuning**:
artists crash-test each part until it fails right. **Our edge is that we generate the airframe, so the bench can do
that tuning.** The load test we already run to certify a build is the rig that stamps the break forces. The
certificate becomes the material: the wing folds at the load the card says it folds at, because the card set the
number.

---

## 1. SOURCES, AND HOW FAR TO TRUST THEM

BeamNG's own sites (beamng.com, its blog, documentation.beamng.com, the wiki, beamng.tech) **refused this session's
egress proxy**, as did Wikipedia. The study therefore rests on four kinds of evidence, tagged throughout:

| tag | what | trust |
|---|---|---|
| **[READ-RoR]** | Rigs of Rods source (GPLv3, `github.com/RigsOfRods/rigs-of-rods` master): `physics/ActorForcesEuler.cpp`, `SimConstants.h`, `Actor.cpp`, `flex/FlexBody.cpp`, `air/Airfoil.cpp`; RoR docs source (`docs.rigsofrods.org`: `vehicle-concepts.md`, `fileformat-truck.md`, the aircraft page) | read line by line; the ancestor, not BeamNG itself |
| **[READ-BNG]** | BeamNG's own code that IS public: their VS Code JBeam extension (`github.com/BeamNG/vscode-jbeam-editor`, `src/docHelper.js`, Aug 2026: BeamNG's hover docs with **defaults**), and the game's vehicle Lua v0.36 (`lua/vehicle/jbeam/stage2.lua`, `lua/vehicle/beamstate.lua`, bCDDL, read from a GitHub mirror). The Lua shows exactly which parameters reach the closed C++ core | read; shows the interface, not the core's maths |
| **[SUMMARY]** | search-engine summaries of documentation.beamng.com pages, BeamNG release notes and blog posts, forum threads | paraphrase; the claim is probably right, the wording is not theirs. Verify on the box before quoting |
| **[OURS]** | our own derivation | stated as such |

What nobody public says, and stays unknown here:
- BeamNG's integrator (RoR's is semi-implicit Euler; BeamNG's continuity with it is inference);
- the exact hardening law of `beamDeform`;
- whether stiffness changes after yield (all evidence says no).

Raw material from the three research passes (source extracts, the RoR and Lua files) sits in that session's
scratchpad and is not committed. The URLs are in §14.

---

## 2. WHAT BEAMNG LEARNT — the history, as lessons

### 2.1 The core never changed: node, beam, 2 kHz, explicit

- **RoR's founding doc** [READ-RoR, `vehicle-concepts.md`]:
  - nodes are "the only concrete elements … they have a mass and can collide … but they are dimensionless";
  - beams are "massless and composed of a spring and a damper";
  - joints are ball joints, so "anything that is not triangulated will fold";
  - the laws they ignored ("rotation momentum, center of gravity, centripetal force") "are here anyway … because
    they emerge from the complex interaction between beams";
  - and the whole damage model in one line: "If the forces are too strong, it will not return to its original
    length (plastic deformation). If the forces are even stronger, it will snap and disappear!"
- **RoR's step** [READ-RoR]:
  - `PHYSICS_DT 0.0005f // fixed dt of 0.5 ms`;
  - `Velocity += Forces/mass*dt; RelPosition += Velocity*dt` (semi-implicit Euler);
  - beam force `-k*dL - d*v`, damping along the axis only.
  - That is our `30_solver.js:1413-1425` and `:1574-1587`, term for term.
- **BeamNG**:
  - still runs "2000 updates per second" [SUMMARY: beamng.com/game/about/physics; BeamNG.tech architecture docs];
  - `-physicsfps` defaults to 2000, and lower is "not recommended" for stability;
  - each graphics frame runs as many fixed 0.5 ms steps as reach the predicted next frame (a fixed-step accumulator);
  - deterministic mode fixes physics time per frame.
- **Why 2 kHz** [SUMMARY, source page uncertain]: stiffer structures need more steps, and 2000 is about the minimum
  for metal-like stiffness. A Steam thread has developers trying 4000 Hz for "diamond-like" stiffness, not real time.
- **Lesson L1 — they never left explicit integration.** Fifteen years in, the answer to "too stiff" is still a
  smaller step or softer springs, not an implicit solver. Our `genSubsteps` bound (ω·dt ≤ 0.45) and the G610
  flight box are the same trade made per build. **We are not behind on the core.**
- **Our rate is higher than theirs** [OURS]: 70 substeps at 60 Hz is 4.2 kHz, and 120 is 7.2 kHz. Our springs are
  softer than a BeamNG chassis:
  - ours: tubeFabric fuselage 8e5 N/m; wing 5e5 x wingK 4;
  - BeamNG defaults: `beamSpring` 4.3e6, bodywork about 1.4e6, suspension arms 8e6 [READ-BNG / SUMMARY].
  - Mean node mass is comparable: a car of about 1500 kg on 300-400 nodes, against our 93-165 nodes for 500-1100 kg.
  - **The real difference is DENSITY**: about 10 beams per node and 300-400 nodes per car for them, against 4.2
    beams per node and 93-165 nodes for us. §6.4 says why that is fine for tube-and-fabric and not fine for a
    monocoque.

### 2.2 Plasticity arrived late, as an add-on to an elastic sim — and was then refined for a decade

- **RoR was elastic first** [READ-RoR, `fileformat-truck.md`]: "A plastic deformation coefficient setting of `0.0` is
  close to the original beam behavior of RoR 0.36.2 (quite elastic). `1.0` is close to the maximum plastic
  deformation you were able to reach with the former experimental `enable_advanced_deformation` patch."
- **Lesson L2 — the same order as ours.** An elastic sim that flies (or drives) first, then a deformation layer
  bolted onto the same beam. Nobody rebuilt the core for damage.

**The RoR algorithm, as it runs today** [READ-RoR, `ActorForcesEuler.cpp` ~1316-1445], restated in our own
notation (not RoR's code, which is GPLv3; see §13). This is the ancestor of
BeamNG's `beamDeform`:

```
slen = -k*dL - d*v                        // total beam force, DAMPER INCLUDED
if |slen| > minmaxposnegstress:           // ONE compare per beam: the fast path
  compression past maxposstress:
    deform = dL + (maxposstress/k)*(1 - plastic_coef)
    L += deform;  L = max(MIN_BEAM_LENGTH 0.1 m, L)
    slen -= (slen - maxposstress)*0.5     // this step's force: halfway back to the threshold
    maxposstress *= Lold/L                // HARDENING: shorter beam, higher threshold
    // "For the compression case we do not remove any of the beam's
    //  strength for structure stability reasons"
  expansion past maxnegstress:
    same, hardening by L/Lold, AND strength -= deform*k   // stretching CONSUMES break strength
if |slen| > strength:
  unless a collision-triangle node would be left with < 3 live beams
       (then strength = 2*minmaxposnegstress instead):
    broken; every beam of its detacher_group breaks too; wheels in that group detach
```

**BeamNG's parameters on the same beam** [READ-BNG, `stage2.lua`]:

- Every beam reaches the core as `setBeam(cid, id1, id2, beamStrength, beamSpring, beamDamp, dampCutoffHz,
  beamDeform, deformLimit, deformLimitExpansion, deformLimitStress, beamPrecompression)`.
- Defaults [READ-BNG, `docHelper.js`]:
  - `beamSpring` 4,300,000 N/m;
  - `beamDamp` 580 N·s/m;
  - **`beamDeform` 220,000 N**, "how much force (N) is required to deform the beam permanently. A value of
    'FLT_MAX' will result in a beam that can't be permanently deformed";
  - **`beamStrength` FLT_MAX**, unbreakable unless set.
- `deformLimit` and `deformLimitExpansion` (Lua default: infinite) cap how far the rest length may drift in
  compression and expansion, as fractions of the original length. The docs call expansion "the most frequently used".
  The forum's typical values are 1.05-1.2, and 1.01-1.001 on tiny parts [SUMMARY].
- **`deformLimitStress`**, added in v0.30 (2023) [SUMMARY, v0.30 notes]: "Limits the beamDeform gain to this value
  (N)" [READ-BNG]. **The threshold rises as the beam deforms**, the same hardening as RoR's `maxposstress *= Lold/L`,
  and in 2023 they needed a cap on it.
- `beamStrength` "should always be above the deform threshold, except for special cases like glass". Close
  together means brittle; far apart means tough [SUMMARY, Beams page]. RoR says the same: "Never use a break
  setting lower then a deform setting!" [READ-RoR].
- **Nothing says stiffness changes after yield.** The spring keeps its k about a new rest length.

**Lessons from the algorithm:**
- **L3 — permanent set is a moved rest length**, exactly the costed design's `b.L0 += dLp`. Independent
  confirmation.
- **L4 — the anti-ratchet is HARDENING plus a TRAVEL CAP, not (only) a rate limit.** RoR raises the threshold by
  the length ratio each time a beam yields. BeamNG caps that gain (`deformLimitStress`) and caps the total drift
  (`deformLimit*`). The costed design's "rate-limit the plastic flow per substep" is a third tool. §4.2 keeps all
  three.
- **L5 — stretching consumes strength; crushing does not, "for structure stability reasons".** A stretched member
  tears; a crushed one keeps carrying load, which keeps the structure from going slack in a pile-up.
- **L6 — the break test must not orphan a contact node.** RoR refuses to break a beam that would leave a
  collision-surface node with fewer than three live beams. Ours is an AERO node: §4.5.
- **L7 — one compare on the fast path.** The whole layer costs nothing for a beam below its smallest threshold.
  Ours: "a beam with no limits declared behaves exactly as today".
- **L8 — RoR yields on TOTAL force, damper included**, so a fast impact yields earlier (a crude rate effect, and it
  dissipates). **We should not copy this** (§4.2): our gear `c` is tuned for ride, and a hard landing would
  "yield" a leg on its damper alone.

### 2.3 Element types grew one problem at a time

Each was added because something kept going wrong [SUMMARY unless tagged; versions from BeamNG release notes]:

| element | what it solved | when | our equivalent |
|---|---|---|---|
| `breakGroup` (RoR: `detacher_group`) | a part comes off as a part: door, bumper, wheel. `breakGroupType 1` = broken by the group, does not break it [READ-BNG, beamstate.lua comments] | early; 0.5 made inter-part collision triangles breakable "to stop vehicles sticking together" | **none** (§4.4) |
| `deformGroup` + `deformationTriggerRatio` | glass cracks, lights die, mesh material swaps, on SMALL deformation (ratio "typically under 0.1") [READ-BNG]. Docs: the trigger is the costly part, so use it sparingly; v0.36 cleaned it up across all content | 0.3.x ("prop breaking via deformGroup") | **none** (§5.3) |
| `SUPPORT` beam | compression-only limiter, so parts stop inverting and clipping. Not an attachment. `beamLongBound` breaks it on over-extension [SUMMARY; implemented as anisotropic with zero expansion spring, READ-BNG] | — | the mirror of our `tens` wire (G185): one line (§4.6) |
| `BOUNDED` | multistage dampers and bump stops. v0.12 capped its internal forces "to increase their stability" | 0.12 | gear legs, if ever needed |
| `ANISOTROPIC` | different spring in compression and expansion (tyre sidewalls, suspension) | — | not needed |
| `LBEAM` (3 nodes, resists the angle) | lateral stiffness without compression stiffness (tyres, leaf springs); anisotropic since 0.10 | 0.10 (2017) | our shape-matched clusters + twist (G294-G350) do this job |
| `torsionbars` (4 nodes; spring/damp/**deform**/**strength** in N·m) | rotational springs (sway bars); docs say they also stiffen flat panels "without the use of rigidifier nodes"; spring2 in 0.34; can break breakGroups in 0.35 | 0.14 | cluster twist constraint (G350). It has no deform/strength yet (§4.7) |
| `PRESSURED`, `pressureWheels` | the tyre. The old "tweel" (a straight beam from axle to contact patch) "created stability and handling problems"; hubWheels "used precompressed beams to inflate the tire", which was "very difficult to tune" | many rounds, 2014-2025 | our wheel is a node with a contact radius. Not in scope |
| `dampCutoffHz` | "band limited damping, increasing the amount of damping that can be stably used" | 0.11 | our DEFDAMP is the opposite tool. Leave it alone (HANDOVER: "Do not reach for DEFDAMP") |
| rigidifier nodes | flat panels collapsing on spawn: an off-plane node beamed to every panel node. "Change topology before raising beamSpring" | docs, current | our structural rules 1-10 ("a line of nodes has no bending stiffness") |
| `beamPrecompressionTime` | precompressed beams no longer kick the vehicle at spawn | 0.10 | our `reset()` stance (G-era taildragger pitch) |

- **Lesson L9 — every element type is a patch for a failure mode artists hit repeatedly.** We should add element
  types only when a gate shows the failure, in the same order. For an aeroplane that order is break groups
  (attachments) → support beams (gear through the floor, engine into the cabin). Most of the rest is tyre and
  suspension work we do not need.

### 2.4 Stability: what makes vehicles explode

- **RoR** [READ-RoR]:
  - "Excessive spring will result in an unstable chassis. Increasing the damping will help with this, but excessive
    damping will crash RoR. Higher chassis mass may mitigate that problem";
  - the defaults are "overspringy, or underdamped for stability reasons";
  - `DEFAULT_MINIMASS 50 kg`, with lighter nodes reset to it;
  - "When using a very low minimass, i.e. below 10, you should use a low damping value";
  - an **anti-explosion guard**: a node faster than Mach 20 resets the actor;
  - node masses are distributed from dry mass in proportion to beam length (`Actor.cpp`). This is our "half the
    member to each end", `61_gen_frame.js:312-345`.
- **BeamNG docs** [SUMMARY, Common Issues and the wiki "JBeam Physics Theory"]:
  - instability is spring and/or damp too high for the node weight, so lower them or add mass;
  - a node with many beams needs more mass than one with few;
  - too much damping for the mass pulses;
  - "if the system wants to vibrate faster than the time step can follow, it blows up";
  - the default `nodeWeight` is 25 kg (0.39.1), and about 4-5 kg is the practical floor before retuning;
  - the "instability detected" message is a per-vehicle soft failure, so one vehicle cannot take the game down.
- **Lesson L10 — they never published a formula; we have one.** `genSubsteps` / `genNetEig` (power iteration on
  the whole network) is a stronger tool than anything in their docs.
- **Lesson L11 — plasticity and breaking cannot destabilise our bound, IF k stays tied to the original member**
  [OURS]:
  - **Breaking** removes a positive-semidefinite term from the stiffness matrix, so by Weyl's inequality the
    largest eigenvalue of M⁻¹K cannot rise. **No substep count is invalidated by a break.**
  - **Plastic flow** with a fixed `k` changes rest lengths, not stiffness. The geometric-stiffness term is bounded
    by the capped force.
  - The trap is a *length-aware* k: HANDOVER §C's option (i), `k = k_ref·L_ref/L`, recomputed on the CURRENT rest
    length. A crushed member would stiffen without bound (RoR clamps `MIN_BEAM_LENGTH` for a reason).
  - **Rule: k is stamped once from the def length and never recomputed from `L0`.**
- **Lesson L12 — tell a sim fault apart from a broken aeroplane.** BeamNG's "instability detected" is not a crash.
  RoR's Mach-20 guard is not a crash. **Our `broke-up` conflates them today.** Once members really let go, the
  NaN ending must be renamed (`sim-diverged`), and `broke-up` kept for the structure (§5.4).

### 2.5 The skin follows the nodes, and deletes itself over a break

- **RoR flexbodies** [READ-RoR, `FlexBody.cpp`]: each vertex is stored in the local frame of a ref node plus X and Y
  nodes (`ref + cx*dX + cy*dY + cz*(dX×dY)`), rebuilt every frame. "Flexbodies are pretty much the same as props.
  The only difference between them is that flexbodies deform."
- **BeamNG** [SUMMARY, flexbodies docs]:
  - 3-4 nodes per vertex: a centre node, VX and VY at roughly 90°, and VZ if possible;
  - only nodes in the flexbody's `group` may drive it;
  - at least 3 nodes, on a regular grid with no outliers;
  - a "flexbody help node" fixes stretched spots;
  - every vertex is recomputed from node motion, so polygons cost CPU (use normal maps).
- **On a break** [READ-BNG, `beamstate.lua`]:
  - `obj:breakMeshes(id)` removes flexbody polygons over the broken beam, unless `disableMeshBreaking` is set;
  - the rails break;
  - every beam, coupler and collision triangle in the beam's breakGroup breaks, and props in the group hide;
  - `deformSwitches` swap materials;
  - glass or wood particles spawn "if beam is part of a breakgroup and a deformgroup, indicating that it's glass or
    wood";
  - deformation calls `onBeamDeformed(id, ratio)`, which feeds per-part damage tracking. **That per-part tally is
    what their repair cost reads.**
- **Lesson L13 — a skin bound to nodes gets bending for free and breaking almost free.** Ours already does the
  first (`poseSkinGen`'s affine blend: "a bent or broken airframe deforms its own skin for nothing"). The missing
  half is the delete-over-a-break step. Without it, a snapped wing stretches its covering across the gap like
  chewing gum (§5.1).

### 2.6 Aero on a damaged body — BeamNG came to it in 2026; we started there

- **BeamNG's aero is per collision triangle** [READ-BNG, `stage2.lua`]:
  - `dragCoef` (default 100 % of a flat plate), `liftCoef` (defaults to drag), `skinDragCoef`, and `stallAngle`
    (default 0.58 rad);
  - lift was added in 0.4.2 (2015);
  - an airfoil lift-curve approximation came in 0.9;
  - triangles do not shadow one another [SUMMARY].
- **v0.39 (29 Jul 2026)** [SUMMARY, release notes]: vehicles now affect each other's airflow (drafting), and "aero
  surfaces respond to damage and moving parts and flex under air pressure".
- **No official aircraft.** Community planes fly on the triangle aero with Lua engines [SUMMARY, forum].
- **RoR**, by contrast, has real wings [READ-RoR]:
  - 8-node wing segments with X-Plane `.afl` polars ("we load directly X-Plane AFL file format!!!");
  - forces at quarter chord, a troposphere model, and induced drag.
  - Its descendant BeamNG dropped that for the cheaper triangle model.
- **Lesson L14 — our strip aero on LIVE node positions** (HANDOVER:393: aeroelasticity "emerges") **already
  delivers what BeamNG shipped in 2026.** A bent wing flies bent. One thing must be added: §4.5, strips whose
  nodes have parted.

### 2.7 Is it realistic? Their own evidence, both ways

- **RMIT study** (Arya, Yao, Davy, Fard, Elsevier 2024/25) [SUMMARY]: BeamNG.tech's mass-spring model against FE and
  physical tyre-barrier crash tests came within about 1 g peak deceleration and about 8 cm intrusion. FE was more
  accurate; mass-spring was far cheaper.
- **The Drive** [SUMMARY]: viral BeamNG "crash tests" are not realistic, because accuracy needs OEM structural
  data the game's cars do not have.
- **Lesson L15 — the model is as good as its thresholds.** BeamNG's thresholds are tuned by artists against
  plausibility. Ours can be **derived** (material × area, Euler buckling) **and certified** (the bench). That is
  the one place we can be better than the reference, and it is the thesis of the game: the card was right.

---

## 3. SIDE BY SIDE

| | BeamNG / RoR | flyDiy today | gap |
|---|---|---|---|
| integrator | semi-implicit Euler (RoR, read); BeamNG not published | semi-implicit Euler, `30_solver.js:1574` | none |
| step | fixed 0.5 ms (2 kHz) | 1/60 ÷ substeps: 24-200, typically 70-120 (0.14-0.24 ms) | none (ours is finer) |
| stability bound | folklore: mass vs spring, "4-5 kg floor" | `genSubsteps`: ω·dt ≤ 0.45, network eigenvalue, G580 damper cut, G610 flight box | **ours is better** |
| beam law | `-k dL - d v`, axial | `k(L-L0) + c·vrel`, axial | none |
| beam types | NORMAL, SUPPORT, BOUNDED, ANISOTROPIC, PRESSURED, HYDRO, LBEAM, torsionbar, rails | NORMAL, `tens` wire (G185), gear leg | SUPPORT (one line) |
| rotational stiffness | LBEAM, torsionbars, rigidifiers | shape-matched clusters + twist (G294-G350) | equivalent |
| plasticity | `beamDeform` moves rest length; hardening; `deformLimit*`; `deformLimitStress` | **none** ("no plastic or damage model", HANDOVER:70114) | **the work** |
| breaking | `beamStrength`; RoR: not if it orphans a contact node | **none**; "BROKE UP" = NaN | **the work** |
| part detach | `breakGroup` / `breakGroupType` | none | §4.4 |
| visual damage switch | `deformGroup` + `deformationTriggerRatio` | none | §5.3 |
| node collision | node vs triangle (2.5 cm skin), self-collision opt-in | node vs ground (penalty), node vs obstacle, **beam vs trunk** (G1330) | ours has no triangles; fine for v1 |
| aero | per-triangle flat plate; damage-aware since 0.39 | strip theory on live nodes, polars, propwash | **ours is better** |
| skin | flexbody, 3-4 nodes per vertex, `breakMeshes` | affine blend on generated wings/cage (`poseSkinGen`); station overlay on fleet models; rigid parts | mesh breaking (§5.1) |
| damage tally | `onBeamDeformed` → per-part damage → repair cost | `out.nzMax` only, read by nothing | §5.4 |
| instability handling | per-vehicle "instability detected"; RoR Mach-20 guard | NaN check every 30 frames → `broke-up` | rename + guard (§5.4) |
| debug views | beam Stress / Displacement / **Deformation** / **Broken**; node Forces / Stability | Frame mode strain colour ±2 % (`app.js:4518`) | add permanent set + broken |
| size | about 300-400 nodes, about 4000 beams per car; caps 4000/20000 (0.14) | 93-165 nodes, 394-758 beams | coarser (§6.4) |

---

## 4. THE PHYSICS LAYER — what we build

All of it is additive in the G3.3/G3.4 sense. **A beam with no limits stamped behaves exactly as today.** The fleet
log diff stays empty until a build opts in, and a param (`params.damage`, default off until §11's D2 gate) turns the
whole layer off.

### 4.1 Limits stamped in `B()` (`61_gen_frame.js`, beside k and c)

The costed design, with three changes from what BeamNG taught.

```
A    = lin[cls] / rho                     // already implied by the mass model (HANDOVER §C)
I    = tube I from A and the class gauge  // the cluster code already builds EI (61_gen_frame.js:102-112)
Fy   = sigY*A                             // tension yield
Fc   = min(Fy, pi^2*E*I/(K*L)^2)          // compression: yield OR Euler buckling, K = 1 pinned
Fu   = sigU*A                             // tension break
dLmax= eBreak*L                           // the deformLimit: total plastic travel before it tears
kFix = k                                  // L11: never recomputed from the moved L0
```

- **`Fc` is the high-value line** (costed design): long slender tubes buckle far below yield, and that is what a
  crashed tube-and-fabric fuselage looks like (§6.4).
- **Materials** gain `sigU`, `eBreak` and `brittle` in `phys` (`60_gen_spec.js:88-338`). **§7.1 sets the
  behaviour per material from the crash record**: alloy and tube are ductile; wood splinters in tension and crushes in
  compression; carbon is brittle along its bonds; seams and fittings are their own class (§7.2). Wood and carbon in
  tension are brittle, which means **`Fu ≈ Fy`, the BeamNG glass case** (`beamStrength` ≈ `beamDeform`: it breaks without
  bending). Steel 4130 and 2024-T3 are ductile.
- **Wires (`tens`)** get `Fu` only; a slack wire has nothing to yield.
- **Gear legs** get limits from the archetype (`GEN_SUSPENSION`), not `sigY*A`: the leg is a spring standing for a
  whole leg.
- **Clusters** (fin, rod, boom, float) get limits per cluster, not per member (§4.7).

### 4.2 The beam loop (`30_solver.js:1413-1425`)

```
if (b.broken) { b.strain = 0; continue; }                // no force, no damper
let Fe = b.k*(L - b.L0);
if (b.Fy !== undefined && (Fe > b.FyH || Fe < -b.FcH)) {     // L7: one compare when quiet
  const lim  = Fe > 0 ? b.FyH : -b.FcH;
  let dLp = (Fe - lim)/b.k;                               // plastic flow, elastic force only (L8)
  dLp = clamp(dLp, -b.dLrate, b.dLrate);                  // costed design's rate limit, per substep
  b.L0 += dLp;  b.plast += Math.abs(dLp);
  if (Fe > 0) b.FyH = Math.min(b.Fy*b.hardCap, b.FyH*(1 + b.hard*dLp/b.L)); // L4 hardening, capped
  else        b.FcH = Math.min(b.Fc*b.hardCap, b.FcH*(1 - b.hard*dLp/b.L));
  b.wPl += Math.abs(lim*dLp);                             // plastic work, J: the damage tally (§5.4)
  Fe = lim;
  if (Fe > 0 && (b.plast > b.dLmax || Fe > b.Fu)) breakBeam(b); // L5: tension tears
  else if (b.L0 < b.Lmin) b.L0 = b.Lmin;                  // compression: crush to a floor, never break on crush
}
const Fb = Fe + b.c*vrel;
```

**What changed from the costed design, and why:**

- **Hardening (`FyH`/`FcH`) plus a cap (`hardCap`, BeamNG's `deformLimitStress`).** This is the primary
  anti-ratchet (L4). The rate limit stays as a second line, sized so a beam can still cross from yield to break
  within a realistic crash time (tens of milliseconds, so hundreds of substeps).
- **Compression never breaks a beam; it crushes to `Lmin`** (L5: RoR does not consume strength in compression "for
  structure stability reasons"). A buckled tube keeps a floor of length so nodes do not pass through each other.
  **[OURS]** A post-buckling softening curve (the force falls after Euler) is physically right and numerically safe
  (it lowers stiffness), but it is a second step. **Start with a plateau at `Fc`.**
- **Plastic work `wPl` is accumulated per beam.** It is BeamNG's `onBeamDeformed` tally, and it is the number a
  repair cost reads (§5.4).
- **The yield test uses the elastic force only** (L8).
- **Under the flight box (G610), the force `k_soft·(L-L0)` is the right thing to test.** HANDOVER §D: failure is a
  force threshold, and softness only exaggerates the displacement on the way. `dLp` divides by the SAME soft k, so
  a member yields at the right load. Its permanent set in metres is exaggerated by `kTrue/k`, which is honest at the
  level the frame already is. **`trueBox()` keeps the bench exact.**
- **Cost** [OURS]: one or two compares per beam on the quiet path. Beams are about 16 % of the solver
  (PHYSICS-PERF-2026-09-24), so the layer is invisible until something yields. **GATE: the stock build's
  `step(1/60)` in node within 2 % of 2.30 ms with the layer on.**

### 4.3 Calibration — the decision §D left open

Straight `sigY*A` is crash-only (0.9-13 % of yield in flight). Three ways out, from §D's "needs an explicit
knockdown either way":

| | rule | in flight | crash | cost |
|---|---|---|---|---|
| **(a) physics only** | `Fy = sigY*A`, `Fc = Euler`, `Fu = sigU*A` | nothing ever yields; you cannot pull the wings off | yes | none |
| **(b) global knockdown** | all limits × κ (say 0.15) | everything yields early, gear included | over-fragile | one number, tuned "until it feels right" (what §D forbade) |
| **(c) CERTIFICATE-ANCHORED (recommended)** | the bench sets each beam's limits | yield past limit load, fold past ultimate, **at the numbers on the card** | yes, with the physics floor | one extra bench pass per build |

**(c), concretely.** This is the BeamNG artist's crash-test loop, run by the generator:

1. **The load cases.** `65_gen_loadtest.js` already ramps to 5.7 g ultimate on trestles under `trueBox()`. Add the
   cases a real certification has:
   - the symmetric pull it runs now;
   - negative g (the card's −);
   - a rolling pull (aileron, the case that loads the torsion diagonals);
   - a gear drop at the certified sink rate.
2. **The per-beam envelope.** For each case, record every beam's peak `|F|` at limit load, `Fₗ`. The ultimate case
   is ×1.5.
3. **Stamp**:
   - `Fy = max(Fₗ_max × 1.0, Fy_floor)`: the first permanent set appears just past limit load, the regulation
     definition;
   - `Fu = max(1.5·Fₗ_max × m, Fu_floor)`, with `m ≈ 1.0-1.1` the margin the card prints.
   - **The floors are what keep the outcome physical.** `Fy_floor = κ_floor·sigY·A`, with `κ_floor` sized so a beam
     that carries nothing in any certified case (a fairing stringer) is not made of paper.
4. **Never below the physics where the physics is weaker.** `Fc = min(Fc_cert, Euler)`: a slender tube still
   buckles at Euler even if the card would allow more. **This is where a badly designed aeroplane shows up**: its
   bench fails, which is G458's BROKE UP made real.

What the player gets: **"limit 3.8 g / ultimate 5.7 g"** on the card. Pull 4.5 g, land, and the wing has a
permanent set (a rigging check, a repair). Pull 6 g and it folds. The certificate was right, in both directions,
and per build. That is GAME-LAYER's P5g, verbatim.

The cases cover flight and landing. A crash into terrain, trunks or a house meets members at loads no certificate
case ever reached. There the floors and Euler govern, so **crashes stay physical and flights stay certified**.

### 4.4 Break groups — parts come off as parts

An aeroplane's attachment points:
- engine mount bolts;
- wing root fittings;
- lift-strut pins at both ends;
- gear leg attach;
- tail attach;
- float struts.

The generator knows every one of these; they are the members `B()` builds with `mountK`, `cls: 'gear'` and the strut
fan. Each gets a `grp` id. **When any beam in a group breaks, all beams in the group break** (`breakGroupType 0`).
A member marked type 1 is broken BY its group but does not break it, which BeamNG uses for the beams that hold
two detachable parts together.

- **BeamNG's leak warning** [SUMMARY]: groups that chain into each other drop the wrong parts ("a front-bumper
  break dropping the rear bumper"). **GATE: every group is a closed set** (a generator assertion, not a convention).
- **A detached part stays in the same sim**, as in BeamNG. Its nodes still have mass, gravity, ground and trunk
  contact, and its strips still fly (a detached wing tumbles, which is correct). The engine on a torn mount keeps
  its node and falls.

### 4.5 Orphaned aero — our version of RoR's "do not orphan a contact node" (L6)

- A strip spreads its force over nodes by `st.w` (`30_solver.js:695, 1187, 1278`), and reads position and velocity
  as the weighted mean of those nodes.
- **If a break separates a strip's nodes, that mean is meaningless.** It is a point between two pieces flying
  apart. The force then goes to nodes that may be a few kg each. That is a sim fault in the making.
- **Rule**: when a beam breaks, any strip whose weight set now spans two connected components is **split**
  (renormalised onto the component holding most of its weight) or, if no component holds 70 %, **dropped**.
- The component test runs only on a break event, never per substep: a union-find over live beams, a few
  microseconds for 400 beams.
- **GATE: after any break, no strip has weight on two components.**

The same rule covers the **body frame**:
- `bodyAxes()` (`30_solver.js:935-943`) averages `noseFrame / tailMid / upLo / upHi`. The `out.*` the pilot, HUD,
  camera and autopilot read all come from it.
- These ref sets must be on the fuselage core. If a break puts them on two components, **the flight ends**
  (`broke-up`, §5.4); the body frame does not average a wreck.
- **GATE: every archetype's refs sit inside one group-free core.**

### 4.6 SUPPORT beams — one line, the mirror of G185

```
const Fb = (b.tens && L <= b.L0) || (b.supp && L >= b.L0) ? 0 : ...
```

These are compression-only limiters. Where they go:
- between the gear leg top and the cabin floor, so a collapsed leg does not drive through the floor;
- engine mount to firewall;
- wing root to fuselage side;
- under the cockpit floor, against a crushed belly.

BeamNG's rule [SUMMARY]: they are limiters, not attachments. They carry nothing until the gap closes. **Add them
only where a crash gate shows parts passing through each other (L9)**, not prophylactically.

### 4.7 Clusters (fin, rod, boom, float) — the one place we differ from BeamNG

- Shape-matched clusters project their members back onto a rest shape every substep (`30_solver.js:122-352`, `al =
  min(1, (ω dt)²)`). **A plastic set inside a cluster is undone the next substep.**
- Two options:
  1. **(i) A cluster is a single breakable part (recommended for v1).** Its limits are a moment and a torque at its
     root, from the same EI and GJ that set its ω (`61_gen_frame.js:102-112`). Exceed them and the cluster's root
     attachment group breaks: the fin comes off, the boom snaps at the root, the float strut lets go. Rigid
     float clusters (G790) are exactly BeamNG's "prop": a rigid body that detaches.
  2. **(ii) Plastic clusters.** Re-take the rest pose (G348's mechanism) after a yield event, with the rest offsets
     bent. This is real work and can wait.
- The **twist constraint** (G350) gets a torque limit in the same pass. That is BeamNG's `torsionbar.deform` and
  `.strength` in N·m.

---

## 5. WHAT THE PLAYER SEES, HEARS AND PAYS

### 5.1 Skin

- **Generated wings and cage** (`poseSkinGen`, `63_gen_wing.js:1337-1355`): bending and permanent set are free
  (L13).
- **Mesh breaking** (BeamNG `breakMeshes`) is new:
  - at build time, each skin vertex records its dominant node component per break group (the group whose nodes
    carry most of its `w`);
  - on a break, triangles whose three vertices do not all sit on one surviving component are hidden (index-buffer
    compaction, an event, not a frame cost);
  - the torn edge is left open; a cut-edge cap is a later polish.
- **Cage parts that ride a node** (engine units, wheels, struts as pin-to-tip lines) follow their node and detach
  with it for free. Struts drawn pin-to-tip must be drawn as two halves when their group breaks.
- **Fleet models on station binding** (SKIN-PROC §0-§6: the wing overlay, a rigid tail and fuselage) get **part
  detach only**. The tail, wing panel or gear is hidden or dropped as a rigid prop on its group's nodes; there is
  no crumple. That is honest, and it is what GAME-LAYER (bd) asked for.

### 5.2 Views and instruments (BeamNG's Deformation and Broken debug modes)

- **Frame mode** gains:
  - permanent set: colour by `(L0 − L0def)/L0def`, the same orange/cyan as strain but on a separate scale;
  - broken beams in red, dashed.
- **The bench** gains **TEST TO DESTRUCTION** (ROADMAP item 5's "test-to-destruction"): ramp past ultimate until
  the first group breaks, and report **the g it broke at and the member that went first**. The card prints it, and
  it is the trailer shot.
- **A dev overlay** shows per-beam `|F|/Fy` while flying. This is BeamNG's Stress view, and it is how a session
  tunes floors.

### 5.3 State switches (`deformGroup`) — the cheap, high-value ones for an aeroplane

Each is an event on a small threshold, never per frame. The docs warn the trigger is the costly part, so there are
few of them:

| switch | trigger | effect |
|---|---|---|
| **prop strike** | a prop-disc node in ground or obstacle contact with rpm > 0 | prop bent (mesh swap or blade deflection), engine stops (`e.running = false`, the path fuel starvation already takes, `30_solver.js:560-578`), sound `SND` impact |
| windscreen cracked | any windscreen-frame beam permanent set > 0.5 % | material swap (crack decal) |
| fabric torn | **only** a broken group under the panel, or a trunk or obstacle puncture. Fabric does NOT tear on a bent frame; it drapes (§7.1 #5) | covering holes on that panel (the wear layer's crack network, WEATHERING-2026-09-13, is a candidate for the pattern) |
| gear collapsed | gear group broken | leg drawn folded; the wheel node is free |
| fuel leak | a tank-node beam broken | `mFuel` drains through `setNodeMass` (the chantier's door exists, `61_gen_frame.js:2362`) |

**Prop strike is the first one to build.** Every nose-over (G1380's ditchings, the pilot's nose-over rejection
`43_pilot.js:2211`) is a prop strike today with nothing happening.

### 5.4 Endings, events and the tally

- **Rename**: the NaN ending becomes `sim-diverged` ("SIM DIVERGED — RESET" stays the message). `bench.js:148`
  stops saying "a member let go" for it.
- Add a **velocity guard** (RoR's Mach-20): any node over 150 m/s relative to the CG. That is a sim fault, caught
  before NaN.
- **`broke-up` now means the structure**: the body-frame refs split (§4.5), or the wing, tail or fuselage-core
  group broke.
- **`crashed`** (new): an impact whose plastic work in one second exceeds the build's survivable threshold, or any
  break while in ground, obstacle or trunk contact. **This is TREE-HITBOX's open call answered: a trunk at speed
  yields and breaks members, and `crashed` fires from the structure, not from `trunkHits()` counting.**
- **Damage tally** (BeamNG's `onBeamDeformed` → part damage): Σ`wPl` per group, plus broken groups. This is the
  number the repair bill reads (§10). **Ruling (bh) is taken: damage is not carried**, so `reset()` keeps
  repairing for free and nothing per-beam is saved. If persistence is ever wanted, the per-beam state (`L0` deltas,
  `broken` bits, `plast`, `FyH`/`FcH`) is about 9 KB raw.
- **Worker snapshot** (ARCH-2026-09-27): the main thread needs a broken-bit array and the `L0` set for the views. It
  is sent **on change only**, as an event message, not in the per-frame snapshot.
- **Sound** (SOUND-2026-10-04, which put "crash/deformation sounds beyond impacts" out of scope): the break event
  and plastic-work bursts are exactly the hooks a crunch/creak/snap voice needs. A one-line event, for SND to price.

---

## 6. WHAT WE DO NOT COPY, AND WHY

### 6.1 Their thresholds
BeamNG's numbers (beamDeform 220 kN default, bodywork about 32.7 kN) are tuned for steel car bodies on 3-25 kg
nodes. Ours derive from our materials and are certified by the bench (§4.3). **Take the method, not the numbers.**

### 6.2 Self-collision and collision triangles
BeamNG's `selfCollision` defaults to false even for them. Node-vs-triangle collision is their biggest cost centre
(the 50 cm proximity rule, NONCOLLIDABLE in dense areas) and a decade of anti-sticking fixes (0.5, 0.9, 0.12, 0.13,
0.30). An aeroplane crash is dominated by ground, trunks and obstacles, which we already have. **SUPPORT beams
(§4.6) cover the interpenetration that matters.**

### 6.3 Tyres
Ten years of their history is the tyre (tweel → hubWheel → pressureWheel → the 2025 Calspan data). Our wheel is a
node with a contact radius, rolling resistance and grip, and that is the right size for an aeroplane.

### 6.4 Crumpling sheet metal
- Car crumpling reads because about 400 nodes and about 4000 beams resolve a crush zone into folds.
- A **tube-and-fabric** aeroplane's wreck is bays of buckled tubes, fabric draped over them and a folded wing. **Our
  coarse truss plus Euler buckling plus draping fabric is the correct resolution** for that, by luck of the archetype.
- A **monocoque** (C172, alloy row) would need a dense skin lattice to crumple. That is GAME-LAYER's "can wait
  years", and stays there. It gets part detach plus dent decals.

### 6.5 Yield on total force (L8)
This is a rate effect we have not calibrated, and it would make soft-damped gear yield on its damper.

### 6.6 Length-aware k on the moved rest length (L11)
Stamp once.

---

## 7. WHAT REAL CRASHES LOOK LIKE — the user's study, the references, and what each one needs

The user's own crash study (2026-10-04) is the target picture: what a player must recognise. The reference aircraft
are:
- **the Piper Cub family** (J-3, PA-18): steel tube and fabric, strut-braced, tailwheel;
- **the Cessna 172**: alloy semi-monocoque, strut-braced, tricycle with spring-steel mains and an oleo nose leg;
- **the Robin/Jodel wooden aircraft** (D11/D112/D117/D140, DR400): wooden box spar, ply D-box, fabric;
- **the DHC-2 Beaver**: alloy, strut-braced, R-985 radial, wheels or floats.

The four builds validated against fiches are the 172, the Jodel, the Chinook and the Cub (`60_gen_spec.js:1308`).
The Beaver exists as a cage archetype.

Each observation below is checked against public accident reports and crash tests, and given its mechanism in this
design. Evidence tags:
- **[NASA]**: NASA Langley full-scale crash tests, public domain;
- **[NTSB]**, **[AAIB]**, **[BEA]**, **[ATSB]**, **[TSB]**: accident investigation bodies;
- **[CFR]**: 14 CFR Part 23, using pre-amendment-64 numbering.

**Every figure here came through search summaries** (the proxy blocked the PDFs; see §13). The NASA and CFR
documents are named so a session on the box opens them before a number becomes a gate.

### 7.1 The observations, one by one

| # | the user saw | the references say | mechanism here | step |
|---|---|---|---|---|
| 1 | **nose cowl and prop are hit first; the prop bends or breaks first** | NASA TP-1477: every test had two impacts, nose first, then the cabin near the wing. NASA's 172 Test 1 (2015): nose tyre first. Under power a prop shows S-bending and leading-edge gouging; windmilling, much less [NTSB]. Lycoming SB 533 / Continental SB96-11: **any** contact while running is a prop strike, including a gear collapse at rest | **prop strike** state switch (§5.3), severity from rpm × contact speed; blades bent (under power) or nicked (windmilling); the engine stops (`e.running = false`). A teardown line on the bill (§10) | D4 |
| 2 | **the cowl opens and is ejected** | An NTSB factual report found the left cowling panel "farthest from the main wreckage" (one case; no systematic study found). AGATE designed a "non-scooping" lower cowl and firewall, which implies the stock cowl digs in and fails | the cowl is **debris** (§8.3): a rigid panel set on fasteners. When the firewall ring or mount yields past a small set, or a cowl node takes ground contact above a speed, the panels leave as rigid bodies with their anchor's velocity | D4 |
| 3 | **the engine mount deforms; sometimes the engine flies away** | the C172 FE model makes mount, gear and firewall steel and everything else aluminium [NASA 20160006503]. NTSB often records "engine separated from the firewall and displaced". Part 23 sizes the mount for torque and 1.33 g side load only (23.361/23.363), **with no crash case** | the `mnt` members (`61_gen_frame.js:139, 266`) are **ductile steel with a low yield**: they bend first and absorb. The **mount bolts are a break group** at the firewall with `Fu` from an emergency forward load (see 7.3). The engine (90-290 kg on two to four nodes) loads its mount by inertia; that alone does it | D1-D2 |
| 4 | **all-metal deforms a lot and barely breaks; wings only under very large loads** | 2024-T3 elongation at break about 18 %. NASA TP-1042: liveable volume kept at 27 m/s. Ultimate = 1.5 × limit (23.303); fittings × 1.15 (23.625) | alloy row: **long plastic travel** (large `eBreak`), hardening on. The wing breaks only past the certificate's ultimate (§4.3) | D1-D2 |
| 5 | **steel tube bends without breaking; the fabric wraps the bent frame like a deflated balloon** | Piper: 4130 forward and highly stressed, **1025 mild steel aft of the baggage bay until 1982**; the softer aft tubes buckle and twist, absorbing energy (AOPA). Polyester fabric (Poly-Fiber, Ceconite) about 105-115 lb/in, about 1.3-1.4 × the Grade A cotton baseline | tubeFabric row: Euler buckling plateau (`Fc`), **never breaks on crush** (§4.2), long tension travel. **Fabric never deletes on a bent frame**: the skin stays bound to its nodes (`poseSkinGen`), so a crushed bay drapes by itself. A **wrinkle term** from each panel's area shrink (a normal-map blend) makes it read as slack cloth, not stretched paint. The `fabric torn` switch (§5.3) is **demoted**: holes only on a broken group or a trunk or obstacle puncture | D1, D4 |
| 6 | **wood breaks with no permanent set, and not cleanly** | Wood-mechanics practice (the USDA Wood Handbook's): tension parallel to grain fails brittle, often *splintering*; compression crushes, **ductile**. Sitka spruce: compression about 38 MPa against a modulus of rupture about 70. A 6° grain slope can cut impact bending strength by 45 % (AC 43.13). Glue joints are their own failure mode (casein, UF) | wood row: **tension `Fu ≈ Fy`** (no permanent set, the BeamNG glass case). **Compression** gets a short crush plateau at the crushing stress. **Ragged break**: a member breaks in 2-3 stages (strength falls to 60 % then 0 over a few ms, so it splinters rather than snaps), with a ±15 % seeded per-member scatter for grain and glue. **Glue lines** (spar-to-ply, rib gussets) are seams (7.2) | D1 |
| 7 | **composites break hard, along seam lines** | FAA review of 73 bond-related accidents: disbonds along spar and skin bonds, stabilisers lost at the bond. ATSB: composites "shatter rather than deform". Counterpoint: AGATE's crashworthy Lancair shows design can change this | carbon row: brittle everywhere (`Fu ≈ Fy`, no plastic travel). **Bond lines are seams** with a lower `Fu` (7.2), so failure finds them first | D1 |
| 8 | **booms crack, often in the middle** | NASA's 172 Test 3 (tail-low on soil) "snapped the fuselage in half". NTSB: "tailcone separated just aft of the baggage compartment", held by the control cables | two cases. **Monocoque tailcone**: a seam at the cabin-to-tailcone joint aft of the baggage bay. **Rod or tube boom** (the twin-boom and rod builds): the boom cluster (§4.7) gets a **mid-span weak station**. A bending-moment limit at its middle as well as its root splits it into two rigid halves. The user's "in the middle" and the reports' "just aft of the cabin" are both stations; the generator puts one at each | D3 |
| 9 | **wheels and suspension break easily and get thrown — and must be polished, because hard-landing gear failure is real** | **the strongest evidence set of all** (7.3). Cub: lug and bracket fatigue, gear collapse [AAIB G-BEUA, G-BJIV]. 172: nose leg pushed up through its housing, **firewall buckled around the nose-gear mount** (NTSB ERA15CA038; AAIB G-NWFC, G-GFMT; ATSB VH-EIB). DR400: nose gear breaks on the third bounce, then a wooden prop strike [BEA F-GTPE]. Jodel: main gear bolted to the spar, broken in ground loops [BEA F-BLMO] | **the gear gets its own calibration** (7.3), **not** the generic one | D2 |
| 10 | **everything breaks along seams and openings** | NTSB: tailcone "broken out … along the rivet lines"; fuselage "broken … at the windscreen frame and cabin door posts". The FAA AD on 172/182/206/210 forward-doorpost cracking (the strut attach) shows where the load concentrates | **seams and openings** (7.2) | D1 |
| 11 | **wings dislocate, bending and breaking at the cabin attach points** | NASA's 172 Test 2 (nose-down on soft soil): "wings wrenched off and the fuselage flipped tail over nose onto its back". 172 wings attach with two shear pins plus one strut. In-flight analogue: a strut nut fails and the wing breaks at the root [NTSB DEN05FA032] | the **wing root and strut-pin groups are the weakest links of the wing load path** (7.2's break order). The spar between them is ductile (alloy, tube) or splinters (wood) only after the fitting has gone | D1-D2 |
| 12 | **the engine bay is almost always damaged and bent relative to the frame** | NASA TP-1699 (four high-wing singles, 25 m/s): −30° on soil gave "massive structural damage in the engine compartment and fire wall"; floor pulses up to 45 g on soil. AGATE: soft soil is among the most severe cases | the **firewall ring** (ring 0, `61_gen_frame.js:485-527`) and mount are the designed plastic zone. The engine's inertia plus nose ground contact bends the bay relative to the cabin. **GATE**: after each nose impact in 7.4, the firewall's permanent set is the largest of any ring | D1-D2 |
| 13 | **nose-over, flip onto the back, broken gear: the classics** | de Voogt & Louteiro 2024 (134 NTSB accidents, CC BY): nose-overs are about 12 % of GA accidents; 58 % tailwheel; 78 % on landing; wind or terrain in 65 %; 3 % fatal. Nall (AOPA): tailwheel in more than 40 % of landing accidents. 23.561(d) **already assumes a turnover with the nose strut failed** | **scenario gates** (7.4): each classic is scripted, run on the reference builds, and its outcome and damage list checked against a real report | D2-D4 |
| 14 | **fire** | §9 | §9 | D5 |

### 7.2 Seams, openings and the break order

Joints and cutouts are where a crash finds the structure. That is a fact about load concentration and fasteners, not
about the certified strength: 23.625 makes fittings 1.15 × stronger for the certified cases, and crashes still tear
along rivet lines. The generator knows every seam it builds, so each beam gets a `seam` tag:

| tag | where (the generator already builds these) | rule |
|---|---|---|
| `fitting` | wing root pins, strut pins (both ends), tail attach, gear attach, mount bolts, float struts | its own break group (§4.4). **Brittle** (shear of a bolt or lug: `Fu ≈ Fy`, no plastic travel). `Fu = 1.15 × F_cert` (23.625) |
| `rivet` | monocoque frame-to-skin lines, the cabin-to-tailcone joint, longeron splices | `Fu = η × member Fu`, joint efficiency **η ≈ 0.7** (a riveted lap joint is weaker than its sheet). Short plastic travel |
| `bond` | composite skin-to-spar and skin-to-skin; wood glue lines (ply to spar, rib gussets) | brittle, `Fu = η_b × member Fu`, η_b ≈ 0.6-0.8 with a seeded scatter (glue quality) |
| `opening` | members bordering the door, the windscreen frame, side windows, inspection holes (glazing: `61_gen_frame.js:2466`) | stress-concentration knockdown on `Fu` (Kt ≈ 1.5-2 on the frame members). Doorposts are the 172's known hot spot |

**The break order is a GATE, not a hope.** Under TEST TO DESTRUCTION and in the scenario gates, the first group to
break must be a fitting or a seam:
- on a strut-braced wing: the root pin or strut pin;
- on a cantilever wood wing: the root fitting or a glue line;
- never the middle of a ductile spar.

If a build breaks in the middle of a member first, its numbers are wrong, and the gate says which.

### 7.3 The gear: its own calibration, because it is real

Gear failure is a normal-operations outcome, not just a crash outcome. A flight school's 172 bends a nose fork from
a bad flare. So the gear is calibrated against certification and the NASA tests, not against §4.3's flight cases:

- **Limit descent velocity** (23.473): `V = 4.4 (W/S)^¼` ft/s, bounded to **7-10 ft/s (2.1-3.0 m/s)**. The drop
  test is 23.725.
- **Reserve energy** (**23.727**; not 23.726, which the first pass got wrong): the gear **may yield but must not
  fail** at **1.2 × V** with lift equal to weight. That is 2.6-3.7 m/s.
- **Side and ground loads**, which are the ground loop and the braked swerve:
  - 23.485 side load: 1.33 g vertical, 0.83 g side (0.5 W inboard on one side, 0.33 W outboard on the other);
  - 23.493 braked roll: 0.8 friction about one locked main;
  - 23.497 tailwheel: up-and-aft obstruction at 45°, and a side load equal to the vertical;
  - 23.499 nosewheel: 2.25 × static vertical, with 0.8 drag or 0.7 side.
- **Where it actually fails** [NASA 172 Test 1]: about **7 m/s vertical** (276 in/s) at 18 m/s forward on concrete.
  The **nose gear separated and the mains spread**.

**So the bracket per gear archetype**:
1. **Survives** with no permanent set up to V. This is GATE: the existing landing gates at their measured sink
   rates stay clean, the "no ruined normal flying" guarantee.
2. **Yields, does not break,** up to 1.2 V: the spring-steel leg spreads and stays spread, an oleo bottoms. The
   bill shows an inspection.
3. **Breaks** between about 1.2 V and the NASA point, at a seeded station:

   | archetype | breaks at |
   |---|---|
   | bungee (Cub) | the lug or bracket, a `fitting` |
   | spring steel (172 mains, Jodel) | the leg yields a long way first (it is the energy absorber), then breaks at the attach |
   | oleo nose (172, DR400) | the fork bends, then the strut is driven up into the firewall: **the firewall buckle is the classic damage line**, and it is a mechanism (the strut top is a SUPPORT beam against the firewall ring that transfers the load into it), not a decal |
   | Jodel mains | bolted through the spar, so a gear failure can take spar damage with it |

4. **Side loads break gear too.** A ground loop past the 23.485 / 23.497 envelope folds a main, and the low wing
   then strikes. That is the Cub and Beaver ground-loop report in one line.

This uses the existing `GEN_SUSPENSION` archetypes (`60_gen_spec.js:1912-1916`) and the springs the gates already
measure. Wheels are debris when their group breaks (§8.3).

### 7.4 The scenario gates — the classics, nailed against real reports

Each scenario is a scripted run, like the existing pilot and gate tools. It runs on the reference builds and checks
the outcome and the damage list. Expected values are written down **before** tuning:

| scenario | script | expected (reference) |
|---|---|---|
| **NASA 172 Test 1**: hard landing on concrete | 18 m/s forward, 7 m/s down, 1.5° nose-up | nose gear separates, mains spread, prop strike; **cabin intact** |
| **NASA 172 Test 2**: nose-down on soft soil | per the NASA TM (open on the box) | **wings wrenched off at the attach**, flip tail over nose onto the back |
| **NASA 172 Test 3**: tail-low on soil | per the NASA TM | flips onto the roof, **fuselage snaps behind the cabin** |
| **soft-field nose-over** (Cub, Jodel) | a taildragger rolls into soft ground or ploughed earth at 8-12 m/s, or brakes hard | pitches over; **prop strike**; rests inverted (BEA/AAIB G-BBPS) or on its nose; **fin and rudder damaged** (NTSB J-3 reports) |
| **ground loop** (Cub, Jodel, Beaver) | crosswind or tailwind landing, loss of directional control | a main gear folds (side load), the **low wing strikes**: wingtip, spar, struts (NTSB PA-18 ×3; Beaver ANC03LA102) |
| **porpoise** (172, DR400) | nose-first touchdown, two to three bounces | **nose gear collapses on the third bounce**, prop strike, **firewall buckled around the nose-gear mount** (NTSB ERA15CA038, BEA F-GTPE) |
| **float dig-in** (Beaver) | a float bow digs in on landing | water loop or cartwheel, the wing hits the water, **float-strut fittings fail in overload**, capsize (NTSB ANC19FA035; TSB A18A0053) |
| **over-g** (all) | a pull to ultimate × 1.1 | the wing fails **at a root or strut fitting**, at the g on the card (§4.3) |
| **tree at speed** (all) | TREE-HITBOX's 30 m/s trunk | engine bay bends, the wing dislocates at the attach, `crashed` fires |

The NASA tests are public domain and documented with accelerometers. **Matching their outcome and their order of
failure is the most credible "convincing" a sim can claim.** Deceleration is a second check: cabin floor under
about 25-30 g on concrete; AGATE's 95th-percentile survivable envelope is 15 g longitudinal and 24 g vertical.

---

## 8. CLIPPING AFTER DEFORMATION

What BeamNG players complained about, as far as the record goes:
- meshes stretched across broken parts;
- parts passing through each other (engines into cabins, wheels through bodywork);
- vehicles sticking together.

BeamNG patched these one at a time (`breakMeshes`, SUPPORT beams, NONCOLLIDABLE anti-clip triangles, breakable
inter-part collision in 0.5). We plan for it from the start, in five layers, cheapest first.

### 8.1 Stop it in the physics, on the known paths
We have **no self-collision at all**. For an aeroplane the intrusion paths are few, and the generator knows them all:
- engine to firewall to cabin;
- gear leg top to cabin floor (the 172 nose strut is a real one, 7.3);
- wing root to cabin side;
- cabin roof to floor (the flip).

Each is a **SUPPORT beam** (§4.6): one line, carries nothing until the gap closes, costs nothing in flight. The crush
floor `Lmin` (§4.2) stops nodes passing through each other along a beam.

### 8.2 Selective point-against-tube collision, only after damage
If a scenario gate still shows passthrough, add a node-against-beam-capsule test for a short list of pairs:
- wheel nodes and mount nodes against the cabin box members;
- the prop hub against the cabin.

The trunk test already does beam-against-cylinder with a per-frame pair list (`30_solver.js:369-414, 1533-1553`), so
this is the same pattern. It **switches on at the first yield event**, so flight pays nothing.

### 8.3 Drop it before it clips: debris
Clipping mostly comes from rigid, non-structural shells sitting on a moved frame:
- cowl panels;
- wheel pants and fairings;
- windscreen and glazing;
- prop blades;
- a detached wheel.

These become **debris**: on a trigger, the shell leaves its anchor as a rigid body with its anchor's velocity plus a
small seeded spin, and falls and bounces on the analytic ground. Triggers are:
- the anchor group breaks;
- the anchor's permanent set passes a small threshold;
- it takes direct ground contact above a speed.

This is **outside the beam solver** (a few rigid bodies, no beams), runs on the main thread from the event message,
and expires after a few seconds or at rest. That is the user's "the cowl opens and gets ejected" and "wheels are sent
flying", and it removes the shells that would otherwise clip.

### 8.4 No stretched skin
On a group break, skin triangles spanning two components are hidden (§5.1). Fabric over a bent tube frame stays
bound and drapes (7.1 #5). The wrinkle term keeps a shrunken panel from reading as a stretched one.

### 8.5 Measure it — GATE CLIP, extended to the wreck
FITMENT-STUDY-2026-09-12 built **GATE CLIP** (`tools/_clip_check.js`, G299) under the ruling "must measure clipping
IN FLIGHT after deformation". This extends it to the end state of every scenario in 7.4:
- **intrusion**: skin vertices of one part inside another part's hull (the cabin box first);
- **stretch**: skin triangles whose edge ratio against rest exceeds 3.

Both fail the gate. Two more rules:
- **The camera**: after `crashed` with cabin intrusion, the cockpit view cuts to the outside view. The IK
  crash-test dummy is not drawn inside a crushed cabin.
- **The ground**: skin between contact nodes can dip under terrain today. Worse after deformation, it is checked by
  the same gate against `terrainH`, and fixed with extra contact nodes on the offenders only.

---

## 9. FIRE

The user's ask: conditions that check for it. The record is clear on the conditions and rough on the rates.

### 9.1 What the record says
- **How often**:
  - NTSB-AAS-80-2: 8 % of 22,002 GA accidents (1974-78) had post-crash fire. In severe accidents fatality was 59 %
    with fire against 13 % without.
  - FAA AIR723-2023-01-S-2800: about 9 % of small-aeroplane accidents (2012-2021); 68 % of fire accidents fatal.
  - TSB Canada SII A05-01: fire or smoke contributed in 128 of 521 otherwise survivable accidents.
- **Where the fuel is matters.**
  - The J-3's tank sits in the cabin in front of the front-seat occupant: 58 % of its fatal accidents (1970-2013)
    had post-crash fire.
  - The PA-18, with wing tanks: 43 % (AVweb).
  - Piper SL 955 / SB 868 thickened the PA-11/PA-18 header tank because it ruptured in impacts.
- **What causes it.** TSB's four conditions are:
  1. an ignition source near fuel;
  2. fuel near the occupants;
  3. escape blocked;
  4. no suppression.

  FAA 2023's fire subset counts 91 tank ruptures and 71 fuel-line ruptures. Gascolators, carburettors and filters
  were the release point in 11, 9 and 6 accidents. 104 fire fatalities were in accidents with electrical arcing as a
  probable source.
- **Fuel type.** Avgas has a low flash point and lights from a spark. Jet-A has a flash point of about 38 °C but a
  lower autoignition temperature (about 210 °C against about 450 °C), so it is dangerous as mist or on hot engine
  parts.
- **Timing.** Escape windows in fuel-fed light-aircraft fires are quoted under 20 s.
- **Mitigations**:
  - firewall: 2,000 °F for 15 min (23.1191);
  - no tank on the engine side of the firewall (23.967);
  - Army crash-resistant fuel systems (self-sealing breakaway fittings, tear-resistant bladders): 66 % fewer
    post-crash fires;
  - the Part 23 crash-resistant fuel system rule (NPRM 85-7A) was withdrawn in 1999.

### 9.2 The conditions, as code
At a `crashed` event, and every second for 30 s after it, evaluate:

```
release  = tank group broken                           // 91/… in FAA 2023: tank rupture
         | (tank location's permanent set > s_tank)    // a crushed nose tank, a folded wing root tank
         | (firewall ring set > s_fw && fuel line crosses it)   // line or gascolator torn (71 + 11)
         | (inverted && fuel > 0 && t_inverted > 5 s)  // vents and caps leak on its back
ignition = engine hot (GEN_ENG_THERMO temp > T_ign of the fuel)  // the thermal model exists
         | (engine running or windmilling && release near the engine bay)
         | (bus.master && battery or bus cable run in a damaged group)   // arcing: 31_elec's switch
         | (prop strike under power && release)        // sparks
         | (electric build && battery group crushed)   // thermal runaway: its own, slower path
fire     = release && ignition && seeded roll < p      // p scaled by how much fuel and how close the two are
```

The facts to read are all present today:
- tank placement: `GEN_TANKS` nose, wing root or outboard (`60_gen_spec.js:1516`);
- fuel litres;
- the fuel type: `GEN_FUELS`;
- engine temperature: `GEN_ENG_THERMO`;
- the master switch and battery: `31_elec.js`;
- attitude and the break and set events from §4.

**The base rate is the check.** Over the scenario suite plus random crash sweeps, fire occurs in roughly 5-15 % of
`crashed` endings and is much likelier for nose tanks than wing tanks. If the conditions produce 50 %, they are wrong.

### 9.3 What fire does
- **In the game**, fire is a **hull loss** for the repair bill (§10) and an ending (`fire`).
- **Garage content**: a crash-resistant tank and breakaway fittings, and a master switch the pilot actually turns
  off. These are real choices, cost money and weight, and lower `p`. The game teaches what 23.967 and the Army
  learnt.
- **Visuals**: smoke and flame at the release point, then spreading. Owed to the POST-FX / particles owners and
  priced there.
- **Sound**: a roar bed. Owed to SND.

---

## 10. REPAIR COST — damage is not carried; the bill is computed

**Ruling (bh) taken by the user, 2026-10-04: damage is not carried between flights.** Wear will come later and act
on reliability, as a separate system. **Repair cost is computed** at the end of every flight that took damage. The
ledger already has cost centres.

### 10.1 What exists
`genFrame`'s **ledger** bills mass and cost per **section** as the aeroplane is built: `fuselage`, `wings`,
`bracing`, `tail`, `gear`, `engines`, `cabin`, `fuel`, `panel`, `avionics`, `elec`, `outfit`, `paint` and others
(`61_gen_frame.js:405-446`, `sec(...)`, `bill(mass, cost)`). The section is open when each node and member is built,
so **every beam can be stamped with its section at build time** at no cost. `GEN_PRICES` holds the bought parts:
wheels, seats, fairings (`60_gen_spec.js:2100`). Engines and props are priced by the registry (`genEnginePrice`).

### 10.2 The bill
For each section:
```
damage_s = Σ wPl (plastic work) over the section's beams / W_ref_s     // how bent, 0..1+
broken_s = any of the section's break groups broken
repair_s = cost_s × labour_s × min(1, a·damage_s + (broken_s ? b : 0))
```
plus **fixed event lines**, which are what real bills are made of:

| event | line | real anchor (USD, search summaries, to calibrate RATIOS, not prices) |
|---|---|---|
| prop strike | new prop **+ engine teardown inspection**. With a seeded 10-20 % chance, internal damage (crankshaft, gear) **+ overhaul** | wood Cub prop about 4.3-4.4 k (Aircraft Spruce 2025); 172 metal prop about 5.9-13 k; teardown about 4 k (2007) to about 13 k (2024); **all-in prop-strike claim on a 172 about 27 k (2024)**; only 10-20 % of torn-down engines show internal damage (AOPA 2007) |
| firewall buckled | firewall section repair | crack repair about 5 k; sheet plus stiffeners about 20 k (156 h); a new 182 firewall about 40 k |
| nose gear | fork and strut | 172 nose fork about 4.2-5.3 k (McFarlane) |
| main gear leg | per leg | 172 spring-steel leg about 8-9.2 k; Cub gear vee about 0.3-0.5 k (Univair) |
| lift strut | per strut | PA-18 sealed strut about 0.7-3 k |
| engine mount | the mount | J-3 mount about 1.3 k (Aircraft Spruce) |
| cowl | per panel | 172 cowl set about 2.5 k |
| fabric | per panel recovered | Cub full recover about 40 k (shop); fuselage only about 10-12 k |
| wing (wood) | rebuild | DR400 spar AD reinforcement about €3 k (a floor, not a rebuild) |

**Write-off**: when the bill reaches **about 75 % of the hull value** (insurer practice; policies 75-90 %), the
aeroplane is a total loss and the bill says so. Hull value is the build's own ledger total. **Fire is always a
write-off.**

**Calibrate as ratios.** Our credits are not dollars, so each line's fraction of a reference aircraft's value is
carried onto the build's own ledger total. The prop strike's 27 k against a 172's value, for example, becomes a
fraction applied to the player's 172-alike. Labour factors per material are real:
- a fabric recover is mostly labour;
- a wood repair needs a qualified wood shop;
- composite needs a bond repair.

### 10.3 What it costs to build
The tally is a few dozen sums at the end of a flight, from per-beam `wPl` and the broken bits the worker already
publishes on change (§5.4). **The bill is the cheapest feature in this doc and the most legible.** It is a list of
real-sounding lines that tells the player what happened ("prop strike: teardown inspection"). It sits in D5 but can
ship with D1's physics as a debug readout.

---

## 11. THE PLAN, AND HOW BIG IT IS

Each step lands behind `params.damage` until its gates pass. Nothing changes flight behaviour before D2's gate says
so. Session counts are an **estimate** in this project's units (a cloud session; a train is a batch of sessions
integrated by A0), not a measurement.

| step | content | sessions | gates |
|---|---|---|---|
| **D0 — instruments** | `sim-diverged` vs `broke-up` split; velocity guard; per-beam `|F|` exposed (`stats().beamF` on demand); Frame mode `|F|/Fy` overlay with **limits stamped but inert**; beams stamped with section and seam tags | 1 | log diff empty; fleet "would-yield" census (§D re-measured, flight box on) for GATE SOAR / FLEX / LOAD / CROSSWIND / taxi. **Expected zero in flight** |
| **D1 — the beam loop** | §4.2; materials per 7.1 (ductile alloy and tube, splintering wood, brittle carbon); seams and fittings (7.2); groups (§4.4); strip split/drop (§4.5); refs-core check; SUPPORT beams on the known paths (8.1) | 2 | stock step within 2 % of 2.30 ms; quiet fleet bit-identical; **spawn-settle gives zero plastic flow on every archetype**; a 30 m/s trunk hit breaks and does not diverge; no strip spans two components after a break |
| **D2 — certificate and gear** | §4.3 (c): four load cases, envelope, stamping, floors; **the gear calibration (7.3)**; TEST TO DESTRUCTION; break-order gate (7.2) | 2 | broke-at g within [1.5, 1.5·m] × limit; existing landing gates clean (gear bracket 1); the first break is a fitting or seam; bad-design wing fails the bench |
| **D3 — clusters** | §4.7 (i) root limits, twist torque limit, **mid-span boom station** (7.1 #8) | 1 | fin, boom and float detach cleanly; the boom splits at a station |
| **D4 — the visible wreck** | mesh breaking (§5.1, 8.4); **debris** for cowl, prop, fairings, wheels (8.3); prop strike; fabric wrinkle; fleet-model part detach; GATE CLIP on the wreck (8.5); cockpit camera rule | 2-3 | no intrusion or stretch on the scenario end states; prop strike on every nose-over |
| **D5 — endings, bill, fire** | `crashed` / `fire` endings; the repair bill (§10); fire conditions (§9); worker events; SND hooks | 1-2 | the bill's lines match each scenario's reference damage list; fire base rate in band (9.2) |
| **tuning the classics** | the scenario gates (7.4) on the four reference aircraft, against the reports | about 2 | every row of 7.4 matches its expected column |

**About 11-13 sessions, two to three trains, to a first convincing model.** The risk is not the solver (the beam
loop is twenty lines) but **tuning** (the gear bracket, nose-overs that happen on soft ground and not on every taxi)
and **D4's visual layer**.

**The thin slice, about 5-6 sessions**: D0 + D1, plus prop strike, the gear bracket, cowl and wheel debris, mesh
breaking, and the bill as a readout. No certificate anchoring, no fire. It already makes a nose-over or a hard
landing an event.

**Not in this plan:** self-collision beyond 8.2, collision triangles, monocoque crumpling, fatigue, post-buckling
softening, plastic clusters (§4.7 ii), yield on total force, length-aware k, persisted damage.

---

## 12. RULINGS

- **(dm1) Calibration: certificate-anchored (§4.3 c)**, with physics floors and Euler as a hard ceiling. The gear
  has its own bracket (7.3). **Recommended.**
- **(dm2) Failure before deformation stands** (GAME-LAYER (bd)). Crumpling stays out; the wreck reads through
  failure, debris and draping fabric. **Recommended.**
- **(dm3) TREE-HITBOX's open call: a trunk at speed is a crash**, fired from the structure, not from `trunkHits()`
  counting. **Recommended.**
- **(dm4) `broke-up` is renamed `sim-diverged` for the NaN case.** **Recommended**; it costs nothing.
- **(dm5) Prop strike is the first state switch.** **Recommended.**
- **(bh) RULED 2026-10-04 by the user: damage is NOT carried between flights.** Wear comes later and acts on
  reliability. A **repair bill is computed** per flight from the ledger's sections (§10).
- **(dm6) Does TEST TO DESTRUCTION cost the airframe?** **Owed.**
- **(dm7) The NASA 172 tests and the 7.4 scenarios are the acceptance suite** for "convincing". **Recommended.**
- **(dm8) Fire** (§9): conditions plus a seeded roll, base-rate checked, always a write-off. Crash-resistant tanks
  are garage options. **Recommended**; visuals owed to POST-FX.
- **(dm9) Is the repair bill charged to the wallet** (GAME-LAYER P5a) or shown only? **Owed**; it decides how
  harsh a hard landing feels.

---

## 13. COPYRIGHT — what we consulted, and what it allows

**Short answer: we are clear, as long as we keep doing what we did: read, learn, cite, and write our own.** Ideas,
algorithms, physical facts and numbers are not protected by copyright. Expression and code are. Nothing was copied
into the tree, and this doc carries short attributed quotations only, for commentary.

| source | licence | what we did | rule going forward |
|---|---|---|---|
| Rigs of Rods engine source | **GPLv3** | read; the algorithm restated in our own pseudo-code (§2.2), short code comments quoted with attribution | **never paste RoR code into `src/`**: one copied function would put the project under GPLv3. Implement from §4.2, which is our own design |
| RoR documentation | licence not confirmed | a few one-line quotations, attributed | quotation only |
| BeamNG VS Code JBeam extension, Blender JBeam Editor | **MIT** (© 2023 BeamNG GmbH) | read the parameter docs and defaults | facts only; nothing to copy anyway |
| BeamNG vehicle Lua 0.36 | **bCDDL 1.1** (a CDDL-style file licence) | read through a third-party GitHub mirror; parameter names and two comments quoted | **never paste it into `src/`**: a copied file must stay bCDDL with its notice. We copied nothing |
| BeamNG docs, blog, release notes, forum | © BeamNG and the posters | search summaries only, paraphrased with links | facts and paraphrase only; never paste their text into the game or docs |
| "BeamNG", "JBeam" | trademarks | named for comparison | fine in design docs; **not in the product's name, store page or marketing** |
| NTSB, FAA (ADs, CFR, ACs), NASA (civil-servant reports) | **US public domain** | cited, numbers used | free to use; still cite |
| UK AAIB | **Open Government Licence v3** | cited | reuse with acknowledgement |
| ATSB (Australia) | **CC BY 4.0** (logos and third-party photos excluded) | cited | reuse with attribution |
| BEA (France) | free **non-commercial** reuse with source and date; **commercial use needs authorisation** | cited, paraphrased | if the game is ever sold, keep to facts and links, no BEA text or figures |
| TSB Canada, Transport Canada and EASA ADs | Crown / official, current terms unconfirmed | cited | facts and links |
| de Voogt & Louteiro 2024 (MDPI *Safety*) | **CC BY 4.0** | cited | free with attribution |
| journals, magazines, vendors, insurers, forums (AOPA, Flying, AVweb, Aircraft Spruce, Univair, McFarlane, insurers, PoA, supercub.org) | © | prices and facts, cited | **facts only**; prices are facts, not expression |
| Wikipedia | CC BY-SA | not quoted | quoting text would carry share-alike: don't |
| crash photos and videos anywhere | © their authors | **none downloaded or committed** | links only; never ship a crash photo as a texture or reference image in the tree |

Two loose ends, both outside this doc:
- **The repository has no LICENSE file.** The site is public on GitHub Pages, which by default means "all rights
  reserved". That is fine for us, but the SOUND plan ports MIT code (credit kept in CREDITS.md) and GPL code must
  never come in. Choosing a licence is the user's call, and it matters if the game is ever sold or opened.
- **BEA's commercial clause** is the only restriction that bites if the game becomes commercial. Everything else
  used here is public domain, OGL, CC BY, or facts.

---

## 14. REFERENCES

Read directly:
- Rigs of Rods source: `github.com/RigsOfRods/rigs-of-rods`, master, `source/main/physics/ActorForcesEuler.cpp`
  (beam force, plasticity ~1316-1445, Mach-20 guard ~1649), `SimConstants.h` (`PHYSICS_DT`, `DEFAULT_MINIMASS`,
  `MIN_BEAM_LENGTH`), `Actor.cpp` (mass by length), `flex/FlexBody.cpp`, `air/Airfoil.cpp`,
  `flex/FlexAirfoil.cpp`.
- Rigs of Rods docs source: `github.com/RigsOfRods/docs.rigsofrods.org`, `source/vehicle-creation/vehicle-concepts.md`,
  `fileformat-truck.md`, the aircraft-and-aerodynamics page.
- BeamNG VS Code JBeam extension: `github.com/BeamNG/vscode-jbeam-editor`, `src/docHelper.js` (defaults and key
  descriptions).
- BeamNG Blender JBeam Editor: `github.com/BeamNG/Blender-JBeam-Editor` (test fixtures: node materials).
- BeamNG vehicle Lua 0.36 (bCDDL), `lua/vehicle/jbeam/stage2.lua` and `lua/vehicle/beamstate.lua`, via a GitHub
  mirror (`KRtkovo-eu-AI/BeamNG_FreeMode_Inventory`, `.beamng/orig-0.36/`).

Search summaries only. **Re-read on the box before quoting any of these as BeamNG's words:**
- documentation.beamng.com:
  - `modding/vehicle/intro_jbeam/` with `jbeamtips/`, `common_issues/` and `debugtools/`
  - `modding/vehicle/sections/` with `nodes/`, `beams/` (and `support/`, `bounded/`, `anisotropic/`, `pressured/`,
    `l-beam/`), `triangles/`, `torsionbars/`, `rails/`, `hydros/`, `wheels/`, `flexbodies/`, `props/`, `thrusters/`
  - `modding/vehicle/vehicle_modeling/`
  - `beamng_tech/architecture/`, `beamng_tech/deterministic_mode/`
- beamng.com:
  - `game/about/physics/`
  - blog: `a-faster-selection-algorithm` (2014), `the-new-wheel-and-tire-model`, `a-look-at-tire-development-in-beamng`
    parts 1-2, `tire-model-improvements-round-2`, `tire-physics-changes` (0.21), `tire-physics-development-sneak-peek`
    (Jul 2025)
  - release notes: 0.4.2, 0.5, 0.9 "Hopping into 0.9", 0.10, 0.11 "The coast is clear", 0.12 "Get busy", 0.13,
    0.14, 0.16, 0.25, 0.30, 0.35, 0.36, 0.38, 0.39 (29 Jul 2026)
- wiki.beamng.com `JBeam_Physics_Theory`.
- BeamNG.tech technical paper, 2021-06-21 (Maul, Mueller, Enkler, Pigova, Fischer, Stamatogiannakis).
- Gambi, BeamNG, Panichella, ICSE-SEIP.
- Arya, Yao, Davy, Fard, *A novel and fast crash simulation method* (Elsevier, sciencedirect S2590123024021133).
- The Drive, "No, those viral BeamNG crash test videos aren't realistic".
- Forum threads: node weights and instability, aerodynamics, planes.

In this tree:
- HANDOVER.md:377-460 (solver invariants, structural rules), :2253-2380 (STRUCTURAL REALISM §C/§D), :2634-2735
  (GATE LOAD), :2736-2805 (the costed rupture design, the ×4 bug, "Left open, deliberately"), :21495 (G115
  DEFDAMP), :30050-30109 (G179.2), :53163-53215 (G458), :59218-59830 (G572/G580/G610), :70062-70168
  (TREE-HITBOX)
- GAME-LAYER-2026-09-14 §8, §10, §11
- ROADMAP.md:683-685, :2009-2022
- DEBT-REGISTER-2026-09-01 §7
- SKIN-PROC.md
- PHYSICS-PERF-2026-09-24
- SOUND-2026-10-04:428
- ARCH-2026-09-27

Added in the second pass (all through search summaries; open on the box before a number becomes a gate):
- 14 CFR Part 23, pre-amendment-64 sections, via govinfo annual editions (public domain): 23.303, 23.337, 23.361,
  23.363, 23.473, 23.485, 23.493, 23.497, 23.499, 23.561, 23.562, 23.625, 23.725, **23.727** (reserve energy),
  23.967, 23.1191; amendment 64's 23.2430 (eCFR). FAA AC 23.562-1.
- NASA crash tests (NTRS, public domain): TP-1042 (1978), TP-1210, TP-1477 (1980), TP-1699 (1980); Littell,
  NASA/TM-2015-218987 (the 2015 Cessna 172 tests); Fasanella and Jackson, NTRS 20160010792 (172 LS-DYNA); NASA
  20160006503 (172 FE model materials); Jones and Lyle, NTRS 20040191337 (AGATE Lancair).
- AGATE Small Airplane Crashworthiness Design Guide (Simula, Hurley and Vandenburg), agate.niar.wichita.edu: cite
  only.
- FAA AIR723-2023-01-S-2800, *Post-Crash Fires in General Aviation Airplanes* (2023), rosap.ntl.bts.gov/view/dot/77378;
  NTSB-AAS-80-2 (1980); TSB Canada SII A05-01 (2006); Federal Register 1999-12-30 (NPRM 85-7A withdrawn); DTIC
  ADA401947 and NTSB ASR-16-02 (crash-resistant fuel systems); FAA review *Bond-Related Aircraft
  Accidents/Incidents* (rosap dot/57647).
- de Voogt and Louteiro 2024, *Safety* 10(2):39 (MDPI, CC BY 4.0): nose-over accidents.
- Accident reports (public domain / OGL / CC BY / BEA non-commercial):
  - Cub: NTSB GAA18CA303 and the PA-18 ground loops (Centennial 2019, Kerrville 2019); J-3 nose-overs (Quincy 2007,
    Glenwood Springs 2013, Bald Head Island 2022); AAIB G-AJAD, G-BEUA (gear lug fatigue), G-BJIV (bungee bracket).
  - Cessna 172: NTSB ERA15CA038 (nose strut through housing, firewall buckle), CEN13CA090, ERA14CA081; AAIB G-NWFC,
    G-GFMT, G-BAEY, G-BUJN; ATSB 199603044 (VH-EIB).
  - Jodel and Robin: AAIB G-BHNL, G-BBPS (inverted, beyond repair), G-BDIH, G-INNI, G-CBMT, G-FTIL; BEA F-BLMO,
    F-GLVK, F-GTPE, F-GSBN, F-GNNE.
  - Beaver: NTSB ANC19LA028, ANC19FA035 (float fittings in ductile overstress), ANC03LA102; TSB A18A0053, A23P0091,
    A19O0089.
- Airworthiness directives and service letters:
  - lift-strut ADs (93-10-06, 99-01-05, FR 2013-29396);
  - Cessna doorpost AD (SEB93-5, SEB95-19);
  - EASA AD 2007-0071R2 and EAD 2022-0267-E / 2023-0048-E (DR400 spars; the latter revoked);
  - Transport Canada CF-1985-08R4 and CF-2020-22 (Beaver);
  - Piper SL 955 / SB 868 (header tank);
  - Lycoming SB 533 and Continental SB96-11 (prop strike).
- Repair-cost anchors (facts, ©): Aircraft Spruce catalogue 2024-25 (props, J-3 mount); Univair (Cub gear and
  struts); McFarlane (172 nose fork, spring-steel legs); AOPA 2007 "Two dreaded words" (teardown, 10-20 % internal
  damage); Global Aerospace 2024 (prop-strike claim inflation); AssuredPartners 2023 (constructive total loss);
  Aviation Consumer (hard-landing damage); owner forums as low-confidence context.
