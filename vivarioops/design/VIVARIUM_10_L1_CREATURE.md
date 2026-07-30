# VIVARIUM — 10 · L1 Creature Layer

| | |
|---|---|
| **Status** | Normative |
| **Supersedes** | `VIVARIUM_MVP_SPEC.md` **in part only** — see §1 |
| **Reads** | 00 Vision R2 · 01 Architecture · 02 Worlds R2 · 11 L2 |

---

## 1. Relationship to VIVARIUM_MVP_SPEC.md

`VIVARIUM_MVP_SPEC.md` was written against the Sims papers and then corrected against a
working MIT-licensed implementation. Its detailed sections are accurate and were verified
line by line against real code. **Rewriting them here would risk transcription loss for no
gain**, so this document does not restate them.

**Resolved at R3: the base specification is now consolidated into this document as an
ANNEX below.** `VIVARIUM_MVP_SPEC.md` is historical and is referenced by nothing. There
is no longer an override chain across two files.

The annex contains, verbatim:

| Section | Content |
|---|---|
| §5 | Genome structure, and the five corrections (face+2D attachment · joint on the node · reflections multiply · orientation ±π/4 · id-not-index) |
| §6 | Morphogenesis — recursion semantics, reflection variants, placement, parity, joint strength |
| §7 | Controller — CPG, phase propagation, motor scaling |
| §8 | Physics, timestep, determinism scope |
| §9 | Mutation — one-per-call weighted tree, grafting, viability |
| §10 | Naming and rendering |
| §14 | Gate assertions 1–8 |
| §16 | Reference implementations and licensing |
| §17.1–17.4 | Random factory, Rapier joint mapping, breed semantics, performance |

**Dropped from the annex** (superseded):

| Section | Superseded by |
|---|---|
| §2 (MVP loop framing) | 00 Vision R2 §7 — vertical slice |
| §11 (UI mental model) | 21 UI |
| §12 (out of scope) | 00 Vision R2 §7 |
| §13 (build order B1–B6) | 30 Implementation Plan |
| §17.6 (open design decision) | 21 UI |

**Amendments below override the corresponding text in MVP_SPEC.** Where they conflict,
this document wins.

---

## 2. Amendment A1 — density range *(from 02 Worlds R2 §7)*

```
  density: 0.6 .. 1.4        →        density: 0.15 .. 1.8
```

**Reason.** Medium density spans 0.0012 (air) to 1.0 (water) across the world set. A floor
of 0.6 makes positive buoyancy impossible in the thick-gas world and marginal in water.
0.15 is a defensible gas bladder; 1.8 is dense bone and muscle.

**Consequence, and it is a good one.** The midpoint is ≈ 0.98 — water. A randomly
generated creature in a water world is therefore approximately neutrally buoyant *by
construction*. Buoyancy does not have to be evolved before anything else works.

Density remains a **per-node** gene. A creature can carry a light anterior float and a
dense posterior keel; swim bladders and ballast emerge without being named.

---

## 3. Amendment A2 — slice-constrained random factory

The genome **schema is unchanged and unrestricted.** Only the random factory and the
mutation operators are constrained during the slice. Loosening at step F is a
configuration change, never a migration.

```js
SLICE_LIMITS = {
  maxNodes:            8,     // full: 24 bodies instantiated
  maxRecursion:        2,     // full: 6
  maxConnPerNode:      3,     // full: 4
  allowGrafting:    false,    // full: true (30% of reproductions)
  allowRadialSymmetry: false, // bilateral and none only
  jointTypes: ['revolute', 'twist', 'spherical']   // full: all 7
}
```

**Reason (external review, accepted).** Arbitrary 3D articulated morphology produces an
enormous debugging space: disconnected bodies, self-intersection, unusable joints,
creatures that vibrate rather than swim, controllers exploiting numerical quirks,
mutations that destroy recognisable heredity, and bodies that are physically valid but
visually meaningless. Procedural depth comes from combinatorics, not from complete
morphological freedom.

Restricting the factory keeps the search space legible while the pipeline is being
debugged. Every constraint above is a single constant.

---

## 4. Amendment A3 — steering sensors *(required by 11 L2 §10)*

**`GENOME_V` → 2. Migration required.** Without this the bridge is meaningless: a pure
oscillator cannot steer toward anything, so it cannot pursue, evade, or meaningfully duel.

**Two sensor channels**, following Sims' competition paper, which used two photosensor
colours — one on the contested object, one on the opponent:

```js
sensors = { preyBearing, threatBearing }   // signed, [-1, 1], 0 if none in range
```

**Two genes**, mutating like everything else:

```js
ControllerGenes += { preyGain: -1..1, threatGain: -1..1 }
```

**One line**, reusing the differential bias already required for the turning probe:

```js
turnBias = preyGain * preyBearing + threatGain * threatBearing
// +turnBias to mirrored joint instances, −turnBias to non-mirrored
```

Negative gain produces avoidance, positive produces approach. **The sign is evolved, not
declared** — a creature that flees prey and chases threats is representable and will
simply lose. Consistent with P2: no declared categories.

Scheduled at session C1, not B1. The tank does not need it.

Migration `1 → 2`: initialise both gains to 0 for existing genomes, which preserves
their behaviour exactly.

---

## 5. Amendment A4 — world-parameterised physics

MVP_SPEC §8 specified an aquarium with hard-coded constants. Physics constants now come
from the `World` object (02 §2) and nothing is hard-coded.

```js
gravity        = world.gravity          // 9.81 in every world (02 §1a)
buoyancy_i     = world.mediumDensity * volume_i * gravity      // upward, per body
weight_i       = density_i * volume_i * gravity                // downward, per body
drag_i         = 0.5 * world.mediumDensity * world.dragScale * Cd * A_i * |v| * v
```

Buoyancy and weight are computed **per body**, not per creature, or per-node density
genes do nothing. Floor and surface are read from `world.floor` and `world.surface`.

**Slice value: W1 The Soup** — gravity 9.81, mediumDensity 1.0, deep floor, surface
present.

---

## 6. Amendment A5 — game-rule invariants promoted to gate assertions

These were prose in MVP_SPEC and are now enforced. See 20 Trunk §3.

| | Rule |
|---|---|
| N17 | One tank slot is always an unrelated random genome |
| N18 | Selected creatures survive unchanged as elites |
| N19 | Motor strength scales with cross-sectional area, not mass |
| N20 | Joint parity — odd mirror count flips orientation sign |
| N22 | Ground and wall contacts never damage; creature–creature only |

N17 is the one most likely to be lost in a refactor and the one whose absence kills the
loop within five generations.

---

## 7. Amendment A6 — exploits are content in L1, corrosive in L2

Creatures that discover flaws in the physics — locomotion by controlled collapse,
launching via contact resolution — are **kept, named and collected** in the tank. Sims'
outtakes are the best-remembered thing in that lineage and they are unfakeable proof to a
player that nothing was authored.

The same exploits are **corrosive in a duel**, where they decide an outcome that should
have been decided by the body. So:

- **L1:** do not patch. Collect. Mark them in the Atlas as a separate class.
- **L2:** guard the scoring. Capture requires contact with the root body, contact impulses above a plausibility threshold are ignored, and a duel decided in under 0.5 s is flagged for review rather than recorded.

---

## 8. Slice deliverable summary

What L1 must provide by session B5:

Genome v2 (sensors present, unused) · constrained random factory · morphogenesis with
parity · Rapier physics parameterised by W1 · CPG with phase propagation · mutation and
grafting-free crossover · viability filter · breeding with stranger slot and elites ·
derived binomial naming (function only, no UI) · first art pass.

Deferred to step F: unrestricted grammar · grafting · radial symmetry · all seven joint
types · walking stabilisation preamble · soft bodies.


---

# ANNEX — consolidated base specification

**Merged verbatim from `VIVARIUM_MVP_SPEC.md` at R3.** That file is now historical and is
no longer referenced by any other document. This annex is the authoritative base
specification for L1.

**Precedence:** amendments A1–A6 above override anything below them. Where the annex and
an amendment conflict, the amendment wins. Cross-references elsewhere of the form
"10 §5", "10 §6", "10 §7", "10 §9", "10 §17.1" now resolve to **A5, A6, A7, A9, A17.1**
in this annex.

## A5 · The genome

Simplified from Sims: a **flat list of nodes plus a flat list of connections**, both
keyed by generated ids. Connections may point to an ancestor or to the node itself,
which is what produces recursion. This structure is confirmed against a working MIT
implementation (see §16) and corrects several things I had wrong in the first draft.

```js
Genome = {
  version: 1,
  seed: uint32,
  rootNodeId: id,
  nodes: Node[],
  connections: Connection[],
  material: MaterialGenes,
  controller: ControllerGenes
}

Node = {
  id,                        // generated unique id, NOT an array index (see below)
  dims: [x, y, z],           // full extents, each 0.2 .. 2.0
  density: 0.6 .. 1.4,
  recursiveLimit: 1 .. 6,    // how many times this node re-instantiates in a cycle
  joint: {                   // JOINT LIVES ON THE NODE, NOT THE CONNECTION
    type: 'rigid'|'revolute'|'twist'|'bendTwist'|'twistBend'|'universal'|'spherical',
    angleLimits: [x, y, z],  // radians, each within +/- PI/2
    phaseLag: -PI .. PI      // our addition; see section 7
  },
  colorGenes: {...}
}

Connection = {
  id,
  parentNodeId: id,
  childNodeId: id,           // may equal parentNodeId or an ancestor -> recursion
  parentFace: 0 .. 5,        // which of the 6 faces of the parent box
  position: [u, v],          // position ON that face, each -1 .. 1
  orientation: [rx, ry, rz], // euler radians, each within +/- PI/4  (NARROW - see below)
  scale: [sx, sy, sz],       // each 0.5 .. 2.0, CUMULATIVE down the chain
  reflectX: bool,
  reflectY: bool,
  reflectZ: bool,
  terminalOnly: bool         // apply only once recursiveLimit is reached -> tails, hands
}
```

### Five corrections worth reading carefully

**1. Attachment is by face + 2D coordinate, not by parametric surface position.**
A box has six faces; `parentFace` picks one, `position` is a point on it in `[-1,1]²`.
This is dramatically simpler and more robust than parameterising a curved surface, and
it is why the reference implementation uses boxes as physics proxies. **Keep boxes in
the physics layer and render capsules/ellipsoids on top** — you get the simple math and
the organic look.

**2. The joint belongs to the node, not the connection.** This is the paper's design and
it matters: every instance of a node type shares a joint type and limits, so replicated
segments behave alike. Putting it on the connection (my first draft) breaks the
replication property that makes segmented creatures coherent.

**3. Reflections are three independent booleans and they MULTIPLY.** Each enabled
reflection axis doubles the number of instantiated children — one connection with all
three set spawns eight limbs. This is where rich symmetry comes from, and it is a much
better mechanism than a global `symmetry` gene. **Drop the global symmetry field
entirely**; per-connection reflection subsumes it.

**4. Orientation range must be narrow: ±π/4.** Full-range random orientation produces
garbage. This single constant does more for plausibility than any viability filter.

**5. Nodes and connections are referenced by generated id, never by array index.**
This makes crossover trivial — no re-indexing, no dangling pointers to fix afterwards.
The paper's "randomly reassign out-of-bounds connections" step disappears entirely.

### Caps

Max instantiated bodies 24 · max connections per node 4 · max recursion depth as
`recursiveLimit`. Morphogenesis truncates when a cap is hit; truncation is normal, not
an error.

---



## A6 · Morphogenesis (`morphogen.js`)

Genome → body plan. Deterministic. This and the mutation operators are the two fiddly
parts; both are now specified from working code rather than from the paper's prose.

### Recursion semantics — exact

```
for each connection c from the current node:
    limitReached = (currentDepth == currentNode.recursiveLimit)

    if c.terminalOnly and not limitReached:  skip        // tails appear only at the end
    childNode = nodes[c.childNodeId]
    newDepth  = (c.childNodeId == currentNode.id) ? currentDepth + 1 : 0
    if newDepth > childNode.recursiveLimit:  skip

    variants = reflectionVariants(c)         // 1, 2, 4 or 8 of them
    if bodies.length + variants.length > 24: stop
    for each variant: instantiate child, recurse with newDepth
```

Note `newDepth` **resets to 0** when moving to a different node, and increments only on
self-reference. Depth is per-node-type, not global tree depth.

### Reflection variants

```
variants = [(false,false,false)]
if c.reflectX: variants += variants.map(flip X)
if c.reflectY: variants += variants.map(flip Y)
if c.reflectZ: variants += variants.map(flip Z)
```

### Placement

1. Get the parent face's `right`, `up`, `normal` axes from a 6-entry lookup table.
2. If the parent is itself mirrored on X, negate the X component of all three.
3. Apply the variant's mirroring: negate `right`, `up`, `normal` as flagged.
4. Anchor in parent space:
   `anchor = normal*halfExtent + right*halfExtent*position.u + up*halfExtent*position.v`
5. **Parity** — this is the bug everybody hits:
   `parity = (mirrorX XOR mirrorY XOR mirrorZ XOR parentWasMirrored) ? -1 : +1`
   Multiply all three orientation angles by `parity` before building the rotation.
   An odd number of mirrorings flips handedness; without this, mirrored limbs bend the
   wrong way and the creature looks subtly broken in a way that is very hard to trace.
   The reference implementation ships a dedicated joint-flip regression test — take the
   hint and write assertion 8 in §14 for it.
6. Child position = `anchor + rotate([0, 0, childHalfDepth], jointRotation)`. The child
   attaches by its own **−Z face**; fix this convention and never revisit it.
7. Cumulative scale: `currentScale = parentScale * c.scale` (component-wise), then
   `childDims = childNode.dims * currentScale`. Tapering falls out of repeated
   multiplication down a recursive chain.

### Joint strength

`minCrossSectionalArea = min(parentFaceWidth * parentFaceHeight, childDims.x * childDims.y)`

Store it on the joint; §7 scales motor torque by it.

---



## A7 · The controller — CPG, not a neural net

This section determines whether the creatures look alive or look like 1994. Read it
carefully.

Sims used evolved neural networks. They work, but they produce twitchy, spastic motion.
Coupled oscillators produce undulation, gait, and travelling waves — the motion
vocabulary of actual animals — at a fraction of the complexity.

```js
ControllerGenes = {
  omega: 0.5 .. 6.0,         // rad/s, global body frequency
  jointGenes: [{ amplitude: 0 .. 1, bias: -0.5 .. 0.5, freqMult: {0.5, 1, 2} }]
}
```

Target angle for joint *j* at time *t*:

```
phase_j   = phase_of_parent_joint + joint.phaseLag        // propagated down the tree
theta_j(t) = bias_j + amplitude_j * limitRange_j * sin(freqMult_j * omega * t + phase_j)
```

**Phase propagation down the body tree is the critical detail.** Because a child joint's
phase is its parent's phase plus a genetic lag, a chain of segments with a consistent
lag produces a **travelling wave** — an eel swimming, a centipede's metachronal gait,
a ray's fin ripple. Independent per-joint phases produce noise. Do not shortcut this.

Root joint phase = 0.

**Velocity motors are a viable alternative to position targets.** One reference
implementation drives joint *velocity* directly as `amplitude * sin(...)`, which is often
more stable than chasing a position target and is cheaper. Worth trying both at B3 and
keeping whichever looks more alive. A third waveform worth stealing from the same source:
`amplitude * sin(p1*PI*phase) * sin(p2*PI*phase)` — a product of two sines, which yields
beat patterns and non-trivial gaits from two extra parameters.

Joints are driven by **PD position motors** toward `theta_j(t)`:
`torque = stiffness * maxTorque * (theta_target - theta_current) - damping * angularVel`

**`maxTorque` scales with the maximum cross-sectional area of the two bodies the joint
connects — not with mass.** This is the paper's rule and the reasoning is worth keeping:
mass scales with volume, strength scales with area, exactly as in nature. The
consequence is that behaviour does *not* scale uniformly — large creatures are
genuinely weaker relative to their bulk, which is why big evolved animals move
plausibly instead of like scaled-up small ones. Getting this wrong produces creatures
that all move identically regardless of size.

The controller signature is `step(t, sensors) -> jointTargets[]`, with `sensors` an
empty array in MVP.

---



## A8 · Physics and determinism

- **Engine:** Rapier (WASM), version pinned exactly in `package.json`.
- **Timestep:** fixed `1/120 s`. Never variable. Render interpolates.
- **Medium:** implemented as per-body drag, not a fluid solver.
  `F_drag = -0.5 * rho * Cd * A * |v| * v` applied at each body's centre, plus angular
  drag. `rho` and gravity come from the world parameter struct. For MVP: `rho` high,
  gravity partially offset by buoyancy proportional to body volume — i.e. an aquarium.
  This is what makes swimming the natural first behaviour and it is far more forgiving
  visually than walking.
- **Determinism scope for MVP:** same-device reproducibility only. Given a genome + seed
  + world params, re-running produces the same motion on that device. Cross-device
  bit-determinism is **not** promised and not needed — a shared genome re-simulated on
  another phone will look the same, not be identical frame-for-frame. Note this
  limitation in code comments; it constrains M5 (shared bounty worlds) and will need
  revisiting there.

### World parameters (struct now, genome later)

```js
World = {
  gravity: -9.81,
  mediumDensity: 1.0,        // -> buoyancy and drag
  dragCoefficient: 1.0,
  metabolicCostPerTorque: 0, // unused in MVP, present for M2
  tankSize: [w, h, d]
}
```

---



## A9 · Mutation and crossover (`mutate.js`)

The most failure-prone part of the project. Bad operators produce a stream of broken
bodies and the player concludes the game is boring when it is actually buggy.

### One mutation per call, chosen from a weighted tree

The reference implementation does **not** use the paper's per-element probabilities. It
applies exactly one mutation per invocation, selected from a nested weighted choice:

```
mutate(genome):
  pick one of: mutateNodes | mutateConnections | mutateController      (equal weight)

  mutateNodes:       pick one of: addNode | removeNode | mutateRandomNode
  mutateConnections: pick one of: addConnection | removeConnection | mutateRandomConnection
  mutateController:  pick one of: addOscillator | removeOscillator | jitterRandomJoint
```

This is simpler than the paper, always changes exactly one thing, and **removes the need
for mutation-rate normalisation entirely** (below). Prefer it. Call `mutate()` 1–3 times
per offspring to control mutation pressure — that single integer becomes your one
tuning knob instead of a table of twelve probabilities.

Field-level jitter, when `mutateRandomNode` / `mutateRandomConnection` fires: Gaussian,
scaled relative to the current value so large quantities move freely and small ones tune
finely, clamped to legal range afterwards.

Housekeeping that must run every time:
- `removeNode` also removes every connection referencing it as parent or child
- `removeDanglingConnections` before any connection mutation
- never drop below `MIN_NODES = 1`; never leave the root unreachable

### A useful extra: lock morphology

A boolean that restricts mutation to the controller only. Body preserved, behaviour
varies. As a game feature this is strong — "keep this shape, try different swimmers" is
an intuitive thing for a player to want, and it costs one flag.

### Mutation rate normalisation (from the paper — do not skip)

Mutations are applied per element. Without correction, a 3-node genome often receives
no mutation at all while a 20-node genome gets scrambled beyond recognition. Sims
compensates by **scaling mutation frequency inversely to the current genome size, such
that on average at least one mutation occurs per genome.**

Without this, breeding feels broken in a very specific and confusing way: simple
creatures appear to produce identical children, complex ones produce unrecognisable
ones.

**This only applies if you use the paper's per-element scheme. If you use the
one-mutation-per-call approach above — recommended — the problem does not arise and this
section can be ignored.**

### Reproduction mix

Per offspring, choose the method at random using the paper's ratios:
**40% asexual (mutation only) · 30% crossover · 30% grafting.**
Offspring from matings receive mutations too, but at reduced frequency.

### Crossover — grafting

Take parent A. Pick a random connection in A. Replace its target subtree with a subtree
copied from a random node in parent B. Re-index. Then apply per-field uniform crossover
to `controller.omega` and `material`.

This is Sims' grafting operator and it is why offspring resemble both parents
structurally rather than being an averaged mush.

### Viability filter (`viability.js`)

Reject and re-roll (max 12 attempts, then fall back to unmutated parent) if:

- instantiated bodies < 2 or > 24
- **interpenetration**: rather than a static overlap threshold, use the paper's method —
  run a short simulation with collision response that attempts to repel intersecting
  parts, then discard only those with *persistent* interpenetration. Many genomes that
  look broken at instantiation settle into something viable.
- **connected parts** are allowed to interpenetrate but must not rotate completely
  through each other. The paper's trick: when testing collisions between connected
  parts, clip the smaller part's collision shape halfway back from its attachment point,
  so it swings freely until its far end makes contact. Implement this or limbs will
  jam against their own parents.
- total mass outside `[0.2, 40]`
- bounding radius > 4× tank's smallest dimension
- **inertness check:** simulate headless for 2 seconds; reject if the centre of mass
  moved less than 0.05 units. This one check removes most of the "why are they all
  just sitting there" experience and costs milliseconds.

Log the rejection rate to console. If it exceeds ~40%, the operator weights need
retuning — that number is the diagnostic that tells you whether mutation is healthy.

---



## A10 · Presentation

### Naming (`naming.js`) — deterministic, offline, no model

Names must be **derived from structure**, so that structurally similar creatures receive
the same genus automatically. This gives you real taxonomy as a free consequence of real
genetics.

```
signature = {
  segmentBucket:  bodies.length -> {2-3: 'oligo', 4-7: 'meso', 8-14: 'poly', 15+: 'myria'},
  symmetry:       bilateral -> 'plano' | radial -> 'actino' | none -> 'ataxo',
  limbPairs:      count of reflected connections -> 0:'apod', 1-2:'brachy', 3+:'poly',
  depth:          max tree depth -> shallow:'brevi' | deep:'longi'
}
genus   = concat(two roots from signature) + 'us' / 'a' / 'ops'   // curated table
species = epithet from the single most extreme normalised trait:
            highest amplitude joint      -> 'undulans'
            longest single chain         -> 'elongatus'
            highest limb count           -> 'multipes'
            largest root body            -> 'crassus'
            highest omega                -> 'celer'
            ... (table of ~24)
          + disambiguator if the binomial is already taken in this Atlas
```

Latin roots table lives in a JSON file. Grammar-generated names are fine here precisely
because Latin morphology is compositional and *meaningful* — the name tells you
something true.

### Rendering — where the quality actually lives

Everything else in this document is mechanical. This is the part that decides whether
the result is beautiful or looks like 1994, so budget iteration time here and nowhere
else.

Baseline stack, to be tuned by eye:

- **Geometry:** capsules and ellipsoids only. No boxes in the render even if the
  physics proxy is a box. Boxes read as furniture; capsules read as flesh.
- **Lighting:** dark water, one strong key from above, visible god-rays, weak blue fill
  from below.
- **Material:** translucency/wrap-lighting to fake subsurface, strong Fresnel rim,
  slight gloss for wetness. Procedural fBm pattern on the surface with genetic
  parameters (`MaterialGenes`: hue, hue variance, pattern scale, pattern contrast,
  stripe anisotropy, iridescence strength).
- **Atmosphere:** particulate motes, depth fog, mild depth-of-field.
- **Motion blur** is worth trying — it flatters oscillation enormously.

`MaterialGenes` mutate like everything else. Pattern is inherited, so lineages become
visually recognisable.

### Share card (`shell/share.js`)

A creature render alone is not shareable — a blob is a blob. The card is:

```
[ creature render, hero crop ]
Genus species
one line of derived description (from the factsheet, template-generated)
world: medium 1.0 · gravity 9.81 · generation 34
[ small lineage marker ]
```

One tap → PNG to the share sheet. The genome is embedded in the PNG metadata so another
player can import the creature from the image.

---



## A14 · Gate assertions (`tests/gate.js`)

Deliberately thin — the goal is playing, not testing. Assertions only where a silent
failure would be misdiagnosed as "the game is boring":

1. Morphogenesis is deterministic: same genome + seed → identical body plan, twice.
2. Body/joint/depth caps are never exceeded, over 500 random genomes.
3. Serialise → deserialise → serialise is byte-identical.
4. Mutation viability rate over 500 attempts is ≥ 60%.
5. Phase propagation: in a 5-segment chain with equal `phaseLag`, joint phases form an
   arithmetic sequence.
6. Physics is same-device deterministic: same genome, same seed, 600 steps, twice →
   identical final centre of mass.
7. Naming is a pure function of structure: two genomes with the same signature share a
   genus.
8. **Joint flip / parity**: a connection with `reflectX = true` produces a mirrored limb
   whose joint bends in the mirrored direction, not the same direction. Assert on the
   sign of the resulting joint axis. This is the single most likely silent bug in
   morphogenesis and the reference implementation keeps a dedicated test for it.

That is the whole gate. Seven assertions.

---



## A16 · Reference implementations — licensing and what to take from each

Checked 29 July 2026. **Licence status is the deciding factor and it is not good news
across the board.**

### Usable — MIT, code may be adapted with attribution

| Repo | Lang | Take |
|---|---|---|
| `mycoolfin/the-simsulator` | C# / Unity | **The primary reference.** MIT, © 2024 Michael Finn. Complete, faithful, actively structured. Everything in §5 and §6 above was verified against it. Read `Sims/Genotype/Components/{Node,Connection,JointDefinition}.cs`, `Sims/Phenotype/Creation/LimbCreator.cs`, `Sims/Genotype/Mutation/SimsGenotypeMutator.cs`. Note the author's own comment that `LimbCreator.cs` was AI-optimised into 716 lines — roughly half is object pooling. The algorithm is about 150 lines; ignore the rest. |
| `jjuiddong/KarlSims` | C++ / DX3D / PhysX | MIT, © 2013. Includes a genotype script parser — useful if a human-readable genome format is wanted. |

### Read-only — NO licence file, therefore all rights reserved

These may be read for understanding. Algorithms are not copyrightable and the papers are
the real source, so reimplementing what they demonstrate is fine. **Do not copy code.**

- `hanzholahs/evolving-creatures` (Python/PyBullet) — closest in spirit to our MVP: drops sensors and neurons entirely for parameterised joint motion. Source of the velocity-motor and product-of-two-sines ideas in §7.
- `khourihan/evolved-creatures` (Rust) — uses `bevy_rapier3d` with the **`enhanced-determinism`** feature flag. Worth checking whether the JS/WASM Rapier build exposes an equivalent; if it does, §8's determinism caveat may be relaxable.
- `danielholmes/evolved-virtual-creatures-2d` (Scala)
- `keiwando/evolution` (C#/Unity) — shipped commercial product, source published without a licence. Read for UX only.
- `222464/EvolvedVirtualCreaturesRepo` (C++)

### Non-code reference

`3DVCE` (Lee Graham) — no source, but its archive of evolved body plans is the best
available visual reference for what morphologies actually emerge.


---



## A17 · Implementation details

These were missing from the first draft and each would have blocked a build step.

### 17.1 Random genome factory (blocks B2 — nothing renders without it)

Mutation is specified; *initial* genome creation was not. The first population determines
whether B4 feels alive, so this is not a detail.

```
createRandomGenome():
  nodeCount = randInt(2, 5)
  nodes = [createRandomNode() for nodeCount]
  rootNodeId = nodes[0].id

  connections = []
  # guarantee the graph is connected: every node after the root gets one inbound edge
  for i in 1..nodeCount-1:
      parent = nodes[randInt(0, i-1)]
      connections.push(createRandomConnection(parent.id, nodes[i].id))

  # then add 0..3 extra edges, which is where recursion and branching come from
  for k in 0..randInt(0, 3):
      parent = randomChoice(nodes with < 4 outgoing connections)
      child  = randomChoice(nodes)            # may equal parent -> self-recursion
      connections.push(createRandomConnection(parent.id, child.id))
```

`createRandomNode`: dims uniform in 0.2–2.0 per axis; `recursiveLimit` uniform 1–6;
joint type uniform over the 7; angle limits uniform within ±π/2; density 0.6–1.4.

`createRandomConnection`: `parentFace` uniform 0–5; `position` uniform in [-1,1]²;
`orientation` uniform within **±π/4**; `scale` uniform 0.5–2.0 per axis;
each reflection flag 50%; `terminalOnly` 50%.

**Guaranteeing connectivity first, then adding extra edges, is the important part.**
Purely random edge sets produce disconnected graphs most of the time, which is the
fastest way to conclude wrongly that the generator is broken.

### 17.2 Joint type → Rapier mapping (blocks B3)

Sims defines seven joint types; Rapier does not have them all natively. Map as follows:

| Sims type | Rapier | DOF | Notes |
|---|---|---|---|
| `rigid` | `FixedJoint` | 0 | no actuator |
| `revolute` | `RevoluteJoint` on face-right axis | 1 | limits + motor |
| `twist` | `RevoluteJoint` on face-normal axis | 1 | same joint, different axis |
| `universal` | `GenericJoint`, 2 angular DOF free | 2 | |
| `bendTwist` | `GenericJoint`, bend then twist | 2 | axis order matters |
| `twistBend` | `GenericJoint`, twist then bend | 2 | mirror of the above |
| `spherical` | `SphericalJoint` | 3 | limits on all three |

Rapier's `GenericJoint` with per-axis limits and motors covers everything; the specific
types are just presets over it. **Implement `GenericJoint` once and express all seven as
configurations of it** rather than writing seven code paths. Each free angular DOF gets
one oscillator from §7 — so `spherical` joints get three phases, not one.

### 17.3 Breed semantics (blocks B4)

Population is fixed at 6. On tapping **Breed**:

- 0 selected → button disabled
- 1 selected → 1 elite survives unchanged, 5 offspring by asexual mutation from it
- 2+ selected → all selected survive unchanged as elites, remaining slots filled by
  offspring drawn from the selected pool using the 40/30/30 asexual/crossover/graft mix

Elites surviving unchanged matters: without it, a creature you liked can vanish in one
tap and the loop feels punishing. Generation counter increments per breed. Keep the
previous generation in memory for a single-step **undo** — cheap, and it removes all
anxiety from experimenting.

### 17.4 Performance budget

Worst case: 6 creatures × 24 bodies = 144 rigid bodies and ~138 joints, stepped at
1/120 s with rendering at 60 fps. Rapier handles this comfortably on desktop; mid-range
phones are the question.

Fallback ladder if B3 or B4 stutters, in order: drop physics to 1/60 with 2 substeps →
cap bodies at 16 → reduce population to 4 → simplify post-processing. Instrument step
time from the first build so the decision is measured rather than guessed.

### 17.5 Latin roots table

§10 specifies the naming scheme but the table is content that must be written: roughly
12 genus roots per signature axis and 24 species epithets. Half an hour of work, but it
does not exist yet and the naming module cannot be finished without it.

#