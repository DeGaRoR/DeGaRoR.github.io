# proto/skin — a continuous body for a generated creature

**Prototype. Nothing in here is imported by the app.** No tracked file was
modified to build it. `proto/` is outside `gate/trunk.js` `APP_ROOTS` and
`BROWSER_ROOTS`, so N16, N3 and V2 cannot be tripped from here and `npm run gate`
is unaffected by construction.

```
npm run serve
open http://localhost:8092/proto/skin/
```

The page carries its own import map pointing at the committed
`vendor/three-0.185.1/` build. `SkinnedMesh`, `Bone` and `Skeleton` are all in
`three.core.js`, so nothing was added to `vendor/` and `index.html` is untouched.

The **experiment** dropdown switches between all three attempts. All of them are
kept; the third is the one that works.

## The problem

`render/creature.js:406` emits one mesh per physics body and
`ui/screens/vivarium.js:1388` places each one independently from the Rapier pose.
A seven-body animal is seven detached capsules that telescope and gap at the
joints. It reads as assembled furniture.

## Result, in one line

Experiments 1 and 2 both **replaced** the bodies with a single surface, and both
lost something doing it — the first could not describe a fin, the second
dissolved the limbs. Experiment 3 keeps the shipped render exactly as it is and
wraps **one continuous transparent shell** around it. The separation goes away
and the differentiation stays, because nothing was replaced.

**Ship candidate: `shell-sdf`.** Median 69 ms to build, 9 k triangles (max 201 ms
/ 18.6 k over 30 random genomes), two extra draw calls per creature.

## What was tried first, and why it was dropped

**Signed distance fields + polygonisation** (`field.js`, `march.js`, still here
behind the *superseded: SDF reconstruction* checkbox). Every body becomes an
exact capsule or ellipsoid SDF, smooth-unioned with a girth-relative blend
radius; a surface-nets pass pulls out one closed mesh; skin weights fall out of
the same distance evaluation.

It worked, in the narrow sense. On the reference eel: one closed manifold, zero
boundary edges, zero non-manifold edges, Euler characteristic 2. Empty-space
skipping made the sampling exact and twice as fast (identical triangle counts and
identical defect counts with skipping on and off).

It was still the wrong lever, and the failure that showed it is worth keeping:

> A **fin** is a membrane 0.19 units thick on an animal two units across. A
> uniform grid either cannot afford to resolve it or renders it in rags. The
> prototype's own mitigation — inflating anything below a girth-relative
> thickness floor so it could be sampled at all — is an admission: the fin came
> out as a ragged square sheet, because a sampling grid has no idea what a fin
> is.

Measured cost, 30 random genomes at the settings that produced acceptable
surfaces: **median 76 ms, worst 208 ms, median 13.9 k triangles, worst 36 k.**

## Experiment 2 — anatomy loft, and why it was also dropped

`anatomy.js`, `geom.js`. The plan is read as a body, not recovered from one:

| | |
|---|---|
| **Spine** | the longest path from the root, weighted by accumulated body *length* and by *alignment* — a child that keeps going the way its parent pointed beats a slightly longer one that turns a corner. Lofted as one tube. |
| **Appendages** | every other branch, lofted the same way and started from a point *inside* the trunk with a flared collar, so a limb grows out of the body. |
| **Blades** | a terminal flat body gets a chord that opens out, holds, and rounds off, with a thickness that falls to an edge. Same loft, different profile curve. |
| **Anatomy** | the centreline is a centripetal Catmull-Rom through the body centres and their junctions; the root end gets a head bulge, the far end a taper, and every joint a waist. |

Continuity is not recovered, it is **built**: consecutive rings are stitched to
each other, so there is no seam to hide, no grid to resolve and no minimum
feature size. UVs come out of the parameterisation for free (`u` around, `v` on
arclength), which the SDF path could not offer at all.

Measured, same 16-genome contact sheet: **0.3–2.8 ms, 1.5 k–6.6 k triangles**,
one draw call per creature. Two orders of magnitude off the reconstruction.

It solved continuity, it solved the fin, it was fast — and it lost the animal:

> Everything became one smooth thing. A limb that reads as a smooth bulge on a
> smooth body is not a limb; a segmented trunk became an undifferentiated tube
> with soft ripples on it. The genome's structure was still in the silhouette in
> principle and unreadable in practice.

That is the same failure as experiment 1 in a different costume, and it names the
real mistake both share: **the bodies were never the problem — the separation
was.** Replacing the bodies to fix the separation throws away the differentiation
that made the creature legible.

### Licence

The rendered body is an interpretation, not a tracing. This extends the rule the
project already holds — `design/VIVARIUM_10_L1_CREATURE.md` §A10 says physics
uses boxes and the render uses capsules because "boxes read as furniture".
Measurement, hydrodynamics, morphometrics and the Atlas keep reading the boxes.

### The rig

One `THREE.Bone` per body, **flat** — no parenting — because `readPose()` returns
a world transform per body. `applyPose()` in `rig.js` is the same loop as
`vivarium.js:1385`: walk something keyed by body index, write position and
quaternion. A trunk port would be a substitution, not a rewrite.

`pose.js` drives it with forward kinematics rather than Rapier, because the
question is "does the skin hold when the joints bend" and FK can pin every joint
at its own angle limit and hold it there.

## Experiment 3 — the transparent shell. This is the one.

`shell.js`. `buildCreature()` runs exactly as it ships — every body, every
material, every organ, the whole phase-locked glow readout — and one continuous
transparent surface is wrapped around all of it.

You read the segments and the limbs *through* the envelope, the way you read a
salp's viscera or the muscle blocks of a glass eel, and the animal reads as whole
because a single unbroken silhouette encloses it. Neither property costs the
other.

It is also what the project already asked for. `design style/README.md` wants a
translucent shell over a lit interior — *"a transmissive shell over an occluded or
unlit interior reads as plastic, not tissue"* — and `render/creature.js:464`
already builds a membrane at ×1.11 for that reason. **That membrane is per body,
so it draws the seams it exists to hide.** This is the same layer, made whole.

### Geometry

The field from `field.js` at an inflated iso-level, polygonised by `march.js`.
Experiment 1's code, doing the job it is actually good at: a shell wants to be
smooth, thick and blobby, and at any inflation worth looking at **no feature is
thin any more**, so the sampling grid has nothing left to shred. The thickness
floor that had to be bolted on for experiment 1 never engages here.

The offset is given **relative to the animal's girth**, not in world units — a
fixed offset is a tight film on a whale and a balloon on a shrimp, and the corpus
contains both. Around 0.3× girth is the useful range: below ~0.15 the shell hugs
each body and the creature is still visibly separate; above ~0.5 the limbs
disappear into a bell.

### Rendering

Two skinned copies of the same geometry sharing one skeleton, back faces then
front, both `depthWrite: false` above the body's `renderOrder`. A single-sided
transparent surface shows only the near wall and reads as a decal; drawing the
far wall first gives the envelope thickness, and at grazing angles both walls
land in the same pixels — which *is* a Fresnel rim, with no shader and without the
transmission pass `render/creature.js:23` already rejected.

### The lofted variant is worse, and the reason is instructive

`shell-loft` builds the envelope from `anatomy.js` at inflated radii instead. It
has clean topology and real UVs, and it looks like soap bubbles: the anatomy
builder emits **one loft per chain**, so a five-limbed creature gets five
overlapping translucent lobes and every internal wall is visible. A transparent
envelope has to be one surface, and only the field is.

### Integration shape, if this is taken to the trunk

`buildCreature()` is unchanged. Add one skinned shell group beside it, driven
from the same pose by body index — `applyPose()` in `shell.js` is the same loop
as [vivarium.js:1385](../../ui/screens/vivarium.js). That is close to the
smallest possible change to the shipped renderer.

## Two bugs worth not re-introducing

1. **Frame transport must be a rotation, not a reflection.** Reflecting the frame
   across the bisector of two tangents does carry one tangent onto the next — and
   reverses handedness, so an elliptical section swaps its major and minor axes
   at every station. Straight chains look fine; curved ones render as a
   concertina. `geom.js frames()` uses Rodrigues.

2. **Section vertices must be spaced by arclength, not by angle.** On a fin
   section, equal angles put most vertices around the two thin tips and describe
   each broad face with three points, so the blade reads as a polygon.
   `geom.js ringAngles()`.

3. `render/creature.js partClass()` is **not** reused for "is this a fin". It
   answers a different question — which material a body gets — and its
   thresholds are gated on the animal's largest girth. The Paddletail's caudal
   fin, dims `[1.08, 0.19, 0.46]`, comes back `mass` from it. `anatomy.js
   isBlade()` asks only whether the body is flat.

## Not done — shell (the live candidate)

- **Transparent sorting in the tank.** One specimen against black is the easy
  case. Six overlapping creatures with `depthWrite: false` have not been tried,
  and neither have the motes, god-ray shafts and trails they would sort against.
  This is the first thing to test before believing any of it.
- **The per-body membrane is redundant now.** `detail: 'flesh'` should probably
  become the inner default under a shell — the *inner body* control on the panel
  switches it. Not decided by eye yet.
- **The shell has no colour of its own.** It is a fixed pale blue; the genome's
  ramp is not consulted. `colourFrom()` is exported and ready.
- **The shell does not glow.** `updateCreatureGlow()` drives the bodies inside it;
  whether the envelope should pick up the wave is an open question and probably
  a good one.
- **`RENDER_TAG`.** Any port must bump it in `render/thumbnail.js:57` or every
  saved Atlas portrait keeps its old look.

## Not done — anatomy loft (experiment 2, parked)

- One plain material; per-node hue, per-body opacity, organ, membrane and the
  emissive wave were never re-homed.
- UVs are emitted but `generateMaps()` is not wired up.
- A flat body in the *middle* of a chain renders as a flat section of tube rather
  than as a fin.
- Appendage sockets are interpenetration, not CSG. Opaque it reads as fused;
  under translucent materials it may not.
