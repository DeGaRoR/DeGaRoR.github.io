# VIVARIUM — 02 · Worlds & Environments

**Cross-cutting.** A World is one object read by all three layers: L1 breeds in it, L2
compiles in it, L3 runs the ecosystem in it. A creature's record is meaningless without
naming the world it was measured in.

| | |
|---|---|
| **Status** | Normative |
| **Amends** | 10 L1 — node density range widened, see §7 |
| **Corrects** | 00 Vision §6 said "~6 numbers per world". It is closer to 20. |
| **Revision R2** | Gravity is now a **constant, not a parameter**. See §1a. World table in §4 revised accordingly. |
| **Consumed by** | 10 L1 · 11 L2 · 12 L3 |

---

## 1. Principle: density is the master parameter

**Phase is not a physical parameter.** The difference between a gas and a liquid at this
scale is density — a factor of about 800 — plus compressibility, which we do not model.
So `phase` is a *label* that drives art direction and one optional boundary (a free
surface), never the physics. The physics reads `mediumDensity` and nothing else.

This matters because it means worlds interpolate continuously. There is no gas/liquid
switch to branch on; there is a number, and thin air and thick soup are the same
equation at different values.

Density does three things at once, which is why it carries so much:

```
buoyancy    = mediumDensity × displacedVolume × gravity      (upward)
weight      = bodyDensity   × volume          × gravity      (downward)
drag        = ½ × mediumDensity × Cd × A × v²                 (opposing motion)
```

Raise it and creatures float, undulation becomes efficient, and coasting becomes
impossible. Lower it and limbs start to matter, momentum is preserved, and gravity is
unopposed. One slider, three consequences, no special cases.

---

## 1a. Gravity is a constant, not a dial

**`gravity = 9.81 m/s² in every world.** It is recorded in the schema for clarity and for
the arithmetic, but it is never varied for design purposes.

Reasoning: intermediate gravity values (2, 4, 6) have no referent. A player cannot form
an intuition about "gravity 4", and a designer tuning it is tuning a number with no
physical meaning. Earth gravity is the one value everyone already understands, and
holding it fixed makes every other parameter interpretable relative to it.

All environmental variation therefore comes from **medium density, floor proximity, and
floor friction.** This is both more physical and easier to reason about: a world is
defined by what you are swimming in and how far away the ground is.

Consequence for the density gene, and it is a happy one: with `density: 0.15 .. 1.8`
(§7) the midpoint is ≈ 0.98, essentially the density of water. **A randomly generated
creature in a water world is therefore approximately neutrally buoyant by
construction.** Buoyancy does not have to be evolved before anything else can work — what
evolves is *control* of it. Generation one floats; generation fifty chooses its depth.

---

## 2. Schema

```js
World = {
  id, name, blurb,

  // ── physics · read by L1 and L2 ──────────────────────────
  gravity,             // m/s², -Y. 0 is legal and is the simplest case.
  mediumDensity,       // relative to water = 1.0.  air ≈ 0.0012
  dragScale,           // multiplier on standard drag; default 1.0
  floor:    { present, friction, restitution },
  surface:  { present, height },    // free surface; only meaningful with gravity
  tankBounds,                       // L1 tank dimensions

  // ── presentation · label only ────────────────────────────
  phase,               // 'liquid' | 'gas' — art direction, never physics
  palette, lightPreset, particulate, fogDensity,

  // ── ecosystem · read by L3 ───────────────────────────────
  worldSize,           // torus dimensions
  totalMass,           // THE conserved quantity
  fertility: { noiseScale, noiseContrast, seed },
  diffusionRate,
  biomassBudget,       // player's introduction allowance
  runDuration,         // simulated time units before verdict

  // ── fauna ────────────────────────────────────────────────
  residents:      [speciesId],
  residentMatrix,      // precomputed at world build, shipped with the world

  // ── bridge ───────────────────────────────────────────────
  duelRepeats          // default 5
}
```

About twenty authored numbers, plus a bred resident set. That is the entire content of a
world.

---

## 3. Substrate distribution, reconciled with mass conservation

L3 conserves total mass, so substrate cannot be *created* by a growth rate. But a
uniform substrate gives creatures no reason to move, which removes locomotion from the
selection pressure entirely.

The reconciliation: **a static fertility field biases diffusion; mass is still
conserved.**

```
fertility[cell] = fbm(cell × noiseScale, seed)      // static, computed once
                  contrast-adjusted by noiseContrast
```

Each tick, substrate diffuses between neighbouring cells with a bias toward higher
fertility:

```
flow(a→b) = diffusionRate · (substrate[a] − substrate[b]) · (1 + fertility[b] − fertility[a])
```

Mass moves; none is created. Hot spots emerge and persist because mass flows toward them,
and they *deplete* when grazed, then refill from the surrounding field. That produces
patchiness, competition for good ground, and a real reason to travel — all from a noise
field and one flow rule.

`noiseContrast` near 0 gives a smooth world where staying put works. High contrast gives
scarce rich patches and rewards fast, far-ranging bodies. **It is the second most
important tuning parameter in the game**, after perception radius.

---

## 4. The four worlds

Gravity is 9.81 throughout. Worlds differ in **what the creature is immersed in** and
**how far away the ground is**. Each introduces exactly one new concept.

### W1 · The Soup — *open water*

```
gravity        9.81
mediumDensity  1.0          // water
dragScale      1.0
floor          present, deep, friction 0.3
surface        present
phase          liquid
noiseScale     0.05     noiseContrast  0.4
```

Primordial ocean on Earth, not soup in a vacuum. Full gravity, fully opposed by
buoyancy for a body near water density — which, per §1a, a random creature already is.
The floor is present but far below, and the surface is present above; both are boundaries
rather than habitats. Substrate drifts and settles slowly, so the water column is where
life happens.

Selection pressure is almost purely locomotive: any body that oscillates goes somewhere,
and going somewhere better than your neighbours is the whole game. **This is the MVP
world** and the only one required for Phases 1–4.

### W2 · The Shelf — *shallows, with ground that matters*

```
gravity        9.81
mediumDensity  1.0
floor          present, shallow, friction 0.75
surface        present
phase          liquid
noiseScale     0.08     noiseContrast  0.6
```

Same medium, but the floor is close and grippy, and substrate accumulates on it. Now
body density decides a livelihood: dense creatures settle, gain traction, and graze the
richest ground; light ones stay in the column and take what drifts. Two ecological zones
from one parameter change, nothing declared.

### W3 · The Loft — *thick air*

```
gravity        9.81
mediumDensity  0.55        // dense gas
floor          present, very deep, friction 0.4
surface        absent
phase          gas
noiseScale     0.12    noiseContrast  0.75
```

The medium supports roughly half a body's weight, so staying aloft requires either a
genuinely light body or continuous work. Drag is still high enough that flailing
propels. Expect large, light, wide creatures — and expect them to be fragile, since low
mass means low momentum and a small energy reserve.

This is where the density gene is most decisive: the difference between 0.4 and 0.7 is
the difference between hovering and falling.

### W4 · The Terrace — *land*

```
gravity        9.81
mediumDensity  0.0012      // air
floor          present, at grade, friction 0.9
surface        absent
phase          gas
noiseScale     0.10    noiseContrast  0.7
```

No buoyancy support and negligible drag. Bodies must hold themselves up and push against
the ground; momentum is conserved, so impacts are severe and mass becomes an asset.

**Post-MVP.** Walking is a far harder evolutionary target than swimming, and Sims needed
a dedicated preamble for land: drop the creature with no friction and no effector forces
until its centre of mass reaches a stable minimum, and only then begin evaluation. That
stabilisation phase is required here and in no other world.

## 5. What each world introduces

| | New physical concept | Locomotion | Density gene |
|---|---|---|---|
| W1 Soup | neutral buoyancy, open column | swim | mild — sets resting depth |
| W2 Shelf | ground contact, traction, settled substrate | swim + crawl | decisive — chooses a zone |
| W3 Loft | partial support, unopposed weight | flail + fall | critical — decides aloft or not |
| W4 Terrace | posture, unopposed gravity, impact | walk | costly — mass is now an asset |

---

## 6. Buoyancy and the density gene — is there a free lunch?

**Yes, creatures can already evolve their mass-to-volume ratio**, and better than
expected: `density` is a **per-node** gene, so a creature can carry a light anterior
float and a dense posterior keel. Swim bladders and ballast emerge without being named.
Nothing needs adding for this to work.

The design question is whether low density is strictly dominant. It is not, and the
counterweights are all already in the system:

| Low density gives | Low density costs |
|---|---|
| less weight to lift | less momentum → weaker impacts, and impact is how damage works |
| faster acceleration (motor strength scales with cross-sectional **area**, not mass) | worse coasting: drag/mass ratio rises, so it decelerates immediately when it stops working |
| easier to hold position in a dense medium | less mass = less energy, since L3 treats mass and energy as one quantity |
| | reaches death threshold sooner under starvation |

The last row is the strongest. In L3 a creature *is* its mass, so a light creature is a
creature with a small reserve. It reproduces sooner and dies sooner — genuine r/K
strategy from one gene.

**No adjustment needed.** The trade is real without intervention.

---

## 7. Amendment to L1 — widen the density range

Current spec: `density: 0.6 .. 1.4`.

With `mediumDensity` ranging from 0.0012 (air) to 1.0 (water) across the world set, a
floor of 0.6 means nothing can be positively buoyant in W3 (medium 0.55) and only
marginally in W2.

**Change to `density: 0.15 .. 1.8`.** 0.15 is physically defensible as a gas-filled
bladder; 1.8 is dense bone-and-muscle. This is a one-line range change with no structural
consequence, and it makes buoyancy genuinely evolvable across the whole world set rather
than only in water.

---

## 8. Worlds are auditioned, not tuned

The numbers above are **starting points, not settled values.** Per 00 Vision §6, a world
is finished when its resident set persists and oscillates in L3, not when its constants
look right on paper.

Procedure per world: set constants → breed 6–10 candidate residents in the tank → compile
them → run L3 with residents only → keep the configuration if populations oscillate
without extinction → otherwise adjust `noiseContrast`, `totalMass`, or the resident set,
and repeat.

The constants that get adjusted in practice are almost always `noiseContrast` and
`totalMass`, not the physics. The physics defines what bodies work; the ecology
parameters define whether a population can persist.

---

## 9. Open questions

1. **Recompilation on world switch.** Records are world-specific, so moving a creature to another world requires a full recompile. Cached per (genome, world), so it happens once. Accepted.
2. **Does the tank show the world?** The L1 tank should visibly be *in* the current world — its medium, its light, its particulate. Confirmed as intent; specified in 21 UI.
3. **Free surface behaviour.** W2 has a surface; whether creatures can breach it, and whether that costs or gains anything, is unresolved. Simplest answer for now: it is a boundary, nothing more.
4. **Resolved (R2).** W1 gravity is 9.81, which gives the world an unambiguous vertical axis for art direction and makes resting depth a real evolved property.
5. **Sinking and rising as failure modes.** A creature far from neutral buoyancy will rest on the floor or against the surface. This is legitimate — bottom-dwellers and surface-skimmers are real — but if generation one piles up at one boundary, reduce the density gene's mutation step rather than narrowing its range.
