# WORLD V2 — one baked asset, resolution where it is earned
## The adaptive terrain quadtree, the modifier layer, and how Ursoy is built
### (2026-09-01, rewritten from the first draft after the user's complexity review)

STATUS: specification, unimplemented.

> **AMENDED 2026-09-07** — `RENDERER-DECISION-2026-09-07.md`. The structure,
> the budget and the data pipeline stand unchanged. What changed: the RENDERER
> TARGET is now declared (§8.0) instead of being chosen by default; §8.3 was
> one paragraph about the thing the user will not compromise on and is now the
> tree ladder (§8.3); the atmosphere is taken off the shelf (§8.4); the shipped
> world is W4’s slice until the loop proves itself (§11); and §5.4 states the
> physics continuity the quadtree actually offers.

**THIS REPLACES THE FIRST DRAFT** (kept as `WORLD-V2.superseded.md`), which was
too complicated and said so on inspection. What went, and why, is §13. The
short version: three tiers became two, the clipmap went, the streaming went,
the erosion simulation went, and the object-storage bucket went with them.

WHAT IT RELATES TO:
- `WORLD-CONTRACT.md` — the pure deterministic data API. §5 amends one of its
  principles deliberately and says so.
- `WORLD-GEN-PROC.md` — stages 0-5, all DONE. Stage 1 (hydrology) is reused
  unchanged; stage 0 (the analytic base) becomes a fallback.
- `ISLAND-ADMIRALTY.md` and `ISLAND-PREPACK.md` — which island, and its data.
- ROADMAP P11.

---

## 0. THE RULE, IN ONE LINE

**One asset. A quadtree of fixed-size height patches whose DEPTH is decided
offline by an error budget — so a bog is cheap, a ridge is not, and a runway
is exact.**

---

## 1. THE PROBLEM WITH A GRID

A regular heightfield charges the same resolution everywhere. That is the whole
difficulty, and every complicated answer in the first draft — tiers, hero
tiles, streaming, a CDN — was an attempt to ration a uniform grid rather than
to stop using one.

Uniform 5 m over Ursoy's 4 264 km² of land is 170 M samples. Uniform 25 m is
6.8 M and coarse in the places that matter. Neither is right, because **the
question was never "what resolution" — it was "where".**

Two facts that bound the answer:

**One-metre geometry only matters inside a ~500 m bubble.** At 300 m slant
range a 1 m feature is about 6 px on a 1080p / 60° view; at 1 km, 2 px. Beyond
that, normal maps and objects carry the detail — which is what every shipping
flight simulator does. MSFS is ~30-90 m elevation (1-5 m LiDAR in places),
X-Plane 30-90, DCS 50-100. The "1 m look" is textures, objects, material
response and erosion structure, not a fine mesh.

**The places that need 1 m are the places we FLATTENED.** See §3.2 — this is
the observation the whole design turns on.

---

## 2. THE STRUCTURE

**A quadtree over the domain. Each leaf is a patch of 33 × 33 vertices. Only
the HEIGHT is stored — position comes from the quadtree address.** What varies
from leaf to leaf is the DEPTH, and therefore the ground resolution.

Domain 180 km, patch = 32 cells:

| depth | patch side | cell |
|---|---|---|
| 8 | 703 m | **22.0 m** |
| 9 | 352 m | 11.0 m |
| 10 | 176 m | **5.5 m** |
| 11 | 88 m | **2.75 m** |
| 12 | 44 m | 1.37 m |
| 13 | 22 m | **0.69 m** |

Payload per patch: 33 × 33 × int16 = **2.13 KB**. Heights are quantised over
the world's range (−100 to +1 600 m in 65 536 steps = 2.6 cm), which is far
below any error budget below.

### 2.1 What decides the depth

Three inputs, combined, all evaluated ONCE by the offline baker:

1. **Error metric.** Subdivide while the patch's maximum vertical deviation
   from the source exceeds ε. This is what makes a bog cheap and a gully
   expensive, automatically, with no zone painting at all.
2. **Zone override.** A minimum depth inside a declared polygon (§6).
3. **Land-cover bias on ε.** And here the rule is better than "forest is
   boring": **under closed canopy the terrain is not visible**, so ε may be
   multiplied by 2-3 there without anybody being able to tell. Not laziness —
   a physical argument. Read the class from WorldCover.

Note carefully that the first mechanism is about CURVATURE, not vegetation. A
forested ridge still earns its vertices; a flat bog does not.

### 2.2 The two mechanics that must be decided with the format

**2:1 balance (restricted quadtree).** Neighbouring leaves differ by at most
one depth level. Standard, and it bounds the crack problem to one case.

**Cracks.** Two options, and pick one now rather than later:
- *Skirts* — a downward apron on each patch edge. ~12% more vertices, never
  shows a crack, trivial. **Recommended to start.**
- *Edge stitching* — the finer patch drops every other edge vertex. No waste,
  but needs 16 index-buffer variants (4 edges × 2 states). The optimisation to
  take later if the 12% ever matters.

---

## 3. WHAT THIS BUYS

### 3.1 One structure does two jobs

The quadtree answers **"how much detail does this place deserve"** (the baked
depth) and **"how much do I need right now"** (the depth drawn, by distance).
The first draft needed a clipmap for the second job and a tier system for the
first. One structure replaces both, and the LOD hierarchy is the storage
hierarchy.

Cost: ancestors must be stored as well as leaves, which is +33% (a quadtree's
internal nodes are about a third of its leaves).

Render load: 500-2 000 patches visible at any moment, 0.5-2 M vertices — the
same order as the clipmap it replaces, better distributed.

### 3.2 A runway is DESIGNED, not measured — and that changes the budget

The user's own framing: *"1 mètre sur les aéroports, mais qui seront
manuellement créés."*

A strip is a plane you drew. Its fine geometry comes from the **grading
modifier** (§6), not from the source data. Two consequences, and the second is
the good one:

- **No 1 m source data is needed anywhere.** 5 m IFSAR plus authored grading
  gives a decimetre-accurate runway, because the runway is designed rather
  than surveyed.
- **A graded surface is FLAT, therefore nearly free in an adaptive mesh.** The
  vertices go into the transition ring where the grading meets natural ground.
  The adaptive structure is at its most efficient exactly where the finest
  detail was wanted.

### 3.3 Everything the first draft needed, deleted

No streaming. No object storage. No tier 1 / tier 2. No clipmap. No runtime
access to any source. **One asset, loaded once.**

---

## 4. THE BUDGET

Leaves, for Ursoy:

| zone | depth | cell | area | patches | MB |
|---|---|---|---|---|---|
| all land (base) | 8 | 22 m | 4 264 km² | 8 630 | 18.0 |
| complex relief | 10 | 5.5 m | ~400 km² | 12 900 | 26.9 |
| site surrounds | 11 | 2.75 m | 40 km² | 5 170 | 10.8 |
| strips proper | 13 | 0.69 m | 2.4 km² | 4 960 | 10.3 |
| | | | | **31 660** | **66** |

Plus ancestors for LOD (+33%) → **~88 MB raw**.

### MEASURED, 2026-09-01 — the estimates above now stand on a bake

`tools/terrain_bake.js` + `tools/terrain_codec.js` run against the ANALYTIC
world (24 km domain, ε = 4 m, depth ≤ 8). Round-trip verified before writing.

    leaves                3 361      over 576 km²  =  5.8 leaves/km²
    nodes with ancestors  4 481      = +33%, exactly as predicted
    topology                561 B    4 481 nodes at one bit — free, as claimed
    int16 raw              9.31 MB
    ASSET                  3.66 MB   = 2.55x

Extrapolating the measured 5.8 leaves/km² to Ursoy's 4 264 km² of land gives
**~24 700 leaves** against this section's estimated 31 660 — the estimate was
right to within 25%. At the measured 1.09 KB per compressed leaf that is
**~27 MB**, plus the strip zones (flat, so they compress far better than
average) and ~9 MB of overlays. **The ~40 MB target survives, now on a measured
compression ratio rather than a guessed one.**

Two things bias the real number DOWNWARD and are worth stating: the analytic
world is a pessimal case, because fbm has energy at every scale by construction
while eroded terrain is smooth between its drainage features; and half of
Ursoy's domain is sea, which stops at minimum depth.

### The codec finding, which was a bug and not an optimisation

The first codec used ONE global quantisation step over the whole asset — 8.7 mm
everywhere, including patches 47 m across that the baker had already declared
may be 4 m out. That is nine bits of noise per sample, and the predictor was
then obliged to encode the noise. Compression measured **1.83×**.

Making the step follow the depth — `step(d) = cell(d) / 256`, so a 47 m cell is
kept to 18 cm and a 0.7 m runway cell to 3 mm — took it to **2.55×** and made
precision track the detail each patch actually carries. A strip zone now gets
its accuracy from its DEPTH rather than from a special case.

Raster overlays, 20 m over land (10.7 M cells each, 1 byte):

    splat weights (from WorldCover)   ~3 MB compressed
    canopy height (DSM - DTM)         ~3 MB
    ORI variation mask                ~3 MB

**TOTAL: ~40 MB, as one asset bundle.**

### The one number to watch

**The 0.69 m zone must stay tight** — the strip and a margin, not a square
kilometre. At 1 km² per site it alone becomes 42 MB and the whole economy
collapses. 600 m × 100 m per site is the shape to hold.

### And it fits where the game already lives

The published site is currently ~87 MB (`media/` 79, `index.html` 4, `src/` 3,
`vendor/` 1). Adding 40 MB takes it to ~130 MB against GitHub Pages' 1 GB soft
limit. **No bucket, no CDN, no streaming.**

*Assumption to confirm:* that `assets/` (409 MB of Poly Haven / Sketchfab
sources), `archiveSingle/` (99 MB) and `assetsSketchfab/` (70 MB) are NOT
committed. The git root is one level above `flyDiy/`. If they are tracked, that
is a 595 MB problem worth fixing on its own account, independently of terrain.

---

## 5. THE COMPOSITION CONTRACT

`WORLD-CONTRACT.md` states that *"the continuous `terrainH` never reads a
stored heightmap"*. **V2 breaks that deliberately**, and the replacement is
simpler than the first draft's five-term sum:

    terrainH(x, z) = quadtreeSample(x, z)      // descend to leaf, bilinear
                   + Σ liveModifiers(x, z)     // only while editing (§6.3)

Four properties to keep, none of them free:

1. **Determinism.** Same asset, same bytes, on any engine. GATE WORLD's
   goldens are re-captured in the commit that changes the world.
2. **One authority.** Physics, renderer and gates read the same patches.
   **The physics ALWAYS reads the baked leaf; the renderer may draw coarser at
   distance.** They never disagree where it matters, because the aeroplane is
   always where the finest LOD is drawn — and this is exactly the "the renderer
   may resample" clause the contract already carries.
3. **C¹ continuity.** Within a patch by bilinear interpolation; across patches
   by the 2:1 balance and the shared edge row; across modifiers by smoothstep
   falloff, as the existing runway carve and meadow blend already do.
4. **Hot path.** `h0` is called per node per substep, up to ~8 000 times a
   frame. A quadtree descent (~13 hops) plus a bilinear read is **cheaper**
   than the current 5-octave warped fbm. Measure it; do not assume it.

### 5.1 `h0` survives, as the fallback — and this saves the gate battery

The analytic world does not go away. `makeWorld()` gains a source:

    makeWorld({ analytic: seed })   the world as it is today — every existing
                                    gate, every golden, unchanged
    makeWorld({ asset: 'ursoy' })   the baked quadtree

Without this, adopting Ursoy invalidates twenty gates at once. With it, the new
world arrives beside the old one and the battery keeps running throughout.

### 5.2 Detail below the finest leaf becomes MATERIAL, not geometry

The first draft synthesised extra geometric detail below the bake. It does not
need to: §1's own argument says fine geometry only matters within ~500 m, and
inside that bubble the baked depth is already 2.75 m or finer wherever anyone
lands.

So sub-leaf detail is a **normal map and a splat modulation**, guided by the
same fields — slope, flow accumulation, curvature, aspect — exported by the
baker. Cheaper, and it cannot disagree with the physics, because it is not
geometry at all.

### 5.3 The honest limitation, and its answer

Away from any zone, the ground is a 22 m mesh. An opportunistic landing on an
un-nominated gravel bar therefore touches a smoother surface than it should.

**The answer is §7: the nomination pass feeds the BAKER's zone list, not only
the player's map.** Anywhere plausibly landable gets subdivided automatically,
so the limitation applies only to genuinely implausible ground.

### 5.4 What the physics gets, stated (2026-09-07)

The composed height is **C⁰, not C¹**: bilinear interpolation inside an int16
patch is continuous, its derivative is not, and the derivative jumps again at a
depth change. WORLD-GEN-PROC’s analytic `h0` was C¹ and this is a real
regression, so it is stated rather than discovered:

- **Wheels and ground contact: fine.** Contact reads height, not slope, and at
  a strip’s 0.69 m cells the facet is far below a tyre’s own footprint.
- **Ground effect: fine.** It reads height under the aeroplane, smoothed over
  a span.
- **Anything reading a GRADIENT is not**: a taxi-slope law, a ski or float
  planing model, a rolling-resistance term keyed on slope. Those must sample
  the gradient over a baseline of at least one cell, never by differencing two
  points a centimetre apart. Write that in the sampler, once.
- The modifier layer (§6) stays analytic and stays C¹, so a graded strip —
  the one place a gradient law would matter — is smooth by construction.

---

## 6. THE MODIFIER LAYER

The second and last tier. Vector, kilobytes, and where the airfield editor
lives. Its own document; what belongs here is the DATA, because `terrainH`
composes it.

### 6.1 The primitive already exists, twice, hardcoded

Inside `h0` today:

```js
const dxC = Math.max(0, Math.max(-3400 - x, x - 400));      // the corridor
const dzC = Math.max(0, Math.abs(z) - 750);
h *= 0.06 + 0.94 * sstep(0, 700, Math.hypot(dxC, dzC));

const dxR = Math.max(0, Math.max(-1180 - x, x - 130));      // the runway
const dzR = Math.max(0, Math.abs(z) - 90);
h *= sstep(0, 260, Math.hypot(dxR, dzR));
```

Each is a **terraforming polygon with a smoothstep falloff** — the central
primitive of the MSFS Scenery Editor, written by hand, in the physics hot path.
Generalising these two into a typed list is the editor's foundation and half
the world's quality at once.

### 6.2 The types

    flatten     polygon + target height + falloff
    grade       polyline + width + longitudinal profile      (the strip)
    ramp        polygon + plane/profile + falloff            (aprons, shelves)
    surface     polygon + SURFACE enum                       (reaches physics)
    material    polygon + splat weights                      (paint)
    exclude     polygon + what to exclude                    (trees, rocks)
    objects     placed instances from the prop registry

Each carries a falloff and composes in a declared order.

### 6.3 Baked or live — BOTH, and that is the point

Two evaluation modes over one set of data:

- **While editing:** modifiers compose at runtime, on top of the quadtree
  sample. You drag a strip and the ground moves under you.
- **At publish:** the baker folds them into the patches and re-bakes only the
  affected subtree. Runtime cost returns to zero.

**GATE: the two modes must agree** to within the height quantisation. That
equivalence is what makes live editing safe.

### 6.4 The strip is a profile, not a rectangle

    centreline    polyline — bush strips CURVE
    width         may vary along it
    slope         longitudinal — and this is content, not decoration
    crossfall     camber
    surface       SURFACE enum -> the friction row
    ends          displaced threshold, overrun, blast pad

Two things fall out free. The surface **reaches the physics immediately** —
`GROUND_SURF` already holds a friction row per surface (GRASS 0.05/0.45/0.80,
PAVED 0.02/0.55/0.90, GRAVEL 0.045/0.38/0.75, SAND 0.10/0.30/0.60). And a real
longitudinal slope gives the **one-way sloping strip** — land uphill, take off
downhill, whatever the wind — a signature bush mechanic that costs nothing once
the profile is honest.

---

## 7. ZONES, AND WHERE THEY COME FROM

Zones are **data, not structure**: `zones.json`, a list of

    { polygon | circle, minDepth (or ε), why }

They are inputs to the baker. Adding one re-bakes its subtree and replaces
those entries in the patch table — **the world is not rebuilt.** Start with
five; have forty in six months; nothing structural changes.

### 7.1 Nomination — the semi-manual starts before the editing

With the erosion baked, slope, flow accumulation, curvature and elevation are
known everywhere. A pass **scores landability** — flat run length, cross-slope,
approach clearance on both axis directions, surface class, distance to water —
and NOMINATES candidates: river bars, ridge shoulders, beaches, moraine
terraces, valley flats.

**The author then PROMOTES rather than searches.** Over 4 264 km² that is the
difference between forty sites and four, and it is the same pattern the project
already uses twice (the seating starter, the nose configuration): a high-level
intent, derived details, everything editable afterwards.

**And the nominations feed the zone list**, which is what closes §5.3's
limitation: plausible ground is fine ground, automatically.

---

## 8. RENDERING, IN ORDER OF IMPACT

### 8.0 THE RENDERER TARGET — declared, not defaulted (2026-09-07)

**Target: three.js `WebGPURenderer` with TSL, WebGL2 as its fallback backend.**
One material description, two backends, chosen at runtime by capability.

The reason is not benchmarks, it is drift. The world work below is where the
shader surface doubles — splat weighting, canopy shells, aerial perspective are
all material work — and the project already carries **27 `onBeforeCompile`
sites and 97 `ShaderMaterial`/`ShaderChunk` references across 9 files**
(measured 2026-09-07). Every one is a hand-patched string against three.js’s
WebGL shader internals, and every new one raises the cost of a decision that
has not been taken. Declaring the target now makes §8.1–8.4 the FIRST work
written in TSL rather than the last work written in GLSL.

The port surface is bounded and lopsided, which is why this is affordable:
`src/viewer/aeroskin.js` holds 5 hooks, 4 ShaderMaterials and ~249 lines of
GLSL — the aeroplane’s whole material system, G206’s shared block included.
The other eight files hold 1–6 hooks each and almost no GLSL; they are small
patches, not systems. So: **one chantier for aeroskin, one sweep for the rest**,
and it is a prerequisite of W1, not of the whole plan.

Constraints that come with it, stated so nobody rediscovers them:
- WebGL2 stays the FALLBACK, not a second implementation. If a feature cannot
  be expressed once for both backends, it does not ship in the world layer.
- Confirm current WebGPU availability per browser before relying on it; the
  fallback is what makes that a performance question and not a support one.
- `WORLD-CONTRACT.md` §0 keeps world DATA free of renderer types. The
  aeroplane’s materials were never behind that contract and still are not —
  this section is what stands in for it on the render side.

### 8.1 Terrain material — depends on nothing but the renderer target

*(2026-09-07: still the first thing that depends on no other WORLD work — but
W0’s tree spike now runs ahead of it, and it is written in TSL per §8.0.)*

Replace altitude-banded vertex colour with a **splat material**: a small set of
tiling PBR materials, weighted per fragment, triplanar on steep ground.

- **Texture cost is bounded by the MATERIAL COUNT, not by world size.** This is
  what makes any of the sizing affordable.
- **The weights are already computable**: WorldCover gives the class, the
  baker's guide fields give slope, accumulation and curvature, and the ORI mask
  breaks the boundaries.
- **Start from the ten CC0 scans already shipped** in `site_tex.js`; the
  hangar's `PARTS`/`LIB` wardrobe is a proven pattern for the per-surface tile
  / roughness / normal dials.

### 8.2 Geometry — the quadtree

§2. Replaces the two-ring mesh, its seam, the ~100 m far strips and the 5 km
fog cap.

### 8.3 Trees — THE LADDER (rewritten 2026-09-07)

This is the section the user will not compromise on — *“real tree densities,
and the close-up trees need to look good”* — and in the first draft it was one
paragraph. It is the world’s single largest visual defect. Measured, today:

| layer | placement | ceiling | geometry |
|---|---|---|---|
| collidable stand trees (`20_world.js:259`) | one per 64 m cell | **≤ 244 / km²** | cylinder + cone + icosahedron |
| W13 dense fill (`_base_render_world.js:540`) | ~13.1 m jittered grid, FOREST_FLOOR only, 1024 m chunks to 5.6 km | **≤ 5 800 / km²** | 5-sided open cone 5 m + icosahedron r 1.9 |
| far field | — | fog wall at 5.2 km | — |

A Southeast-Alaska conifer stand is **tens of thousands of stems per km²**
under a CLOSED canopy. The fill’s 3.8 m crowns at 13 m spacing give roughly
**7 % canopy cover**. The gap is about one order of magnitude in count and one
in crown size — and the close-up asset is a cone.

**Four rungs. Each has an owner, a budget and a number.**

**R1 — the near asset (< ~250 m).** A real tree: trunk mesh plus alpha-tested
leaf cards, 2–8 k triangles, 3–5 species × 2–3 age classes. Sourced, not
authored from nothing: a procedural generator (ez-tree class) baked to GLB, or
the CC0 scans already shipped. **This is an asset problem, not a platform
problem** — it is the single change that most improves the close-up view, and
it improves every rung below it because they are baked FROM it.

**R2 — impostors (250 m – 2 km).** An octahedral or crossed-card atlas baked
at boot from R1. The bake, the chunking, the species and the tinting all
already work; only the source changes. This is the first draft’s whole
paragraph, and it was right — it was just not the section.

**R3 — the CANOPY SHELL (> 2 km).** The rung the first draft did not have, and
the one that makes a 195 km horizon affordable. `ISLAND-PREPACK.md` §3.2
already delivers a canopy height model for free (IFSAR DSM − DTM, 5 m).
Render it as a displaced surface at canopy height with a forest material and
the far forest becomes a texture with the RIGHT SILHOUETTE — one more terrain
layer, no instances at all. Beyond the shell there is only aerial perspective
(§8.4). Note what this deletes: the 5.2 km fog wall exists to hide the fact
that there is nothing past it.

**R4 — density, and the count that follows.** Real density inside a 3 km
radius is order 1–2 M instances. That is reachable on WebGL2 with the chunk
culling the renderer already does, and comfortable on WebGPU with compute-side
culling and indirect draws (§8.0). Foliage is fill-rate and overdraw bound —
the same wall a native renderer hits, which is why the platform is not the
thing standing between this project and real trees.

**The three real inputs, unchanged from the first draft:** WorldCover says
*what*, DSM − DTM says *how tall*, ORI says *how dense*. What is added is that
a density TARGET per land-cover class is a number in the asset, not a constant
in the renderer.

**THE GATE (this is what makes the rung a rung).** GATE TREES asserts, on a
fixed camera set over a forested slice: canopy cover fraction within a band of
the class target; instances drawn; frame time on a declared reference GPU; and
that R1’s asset is what R2’s atlas was baked from. A tree pass without a number
is how this section stayed one paragraph.

### 8.4 Aerial perspective — TAKEN, NOT WRITTEN (amended 2026-09-07)

Fog is not distance. Ursoy is 145 km long and the horizon from 3 000 m is
195 km — you will see one end from the other, and height-dependent extinction
and in-scattering are what separate a landscape from a model.

**This is the one part of the world renderer that is genuinely available
ready-made, and it should be taken.** Precomputed-scattering atmospheres for
three.js exist as libraries (the Takram `three-geospatial` / `three-atmosphere`
family: Bruneton-style scattering, sun and moon, aerial perspective, clouds).
Writing a scattering atmosphere is a month that buys nothing this project is
about.

What is NOT available ready-made, and the distinction is worth writing down
because it is the answer to “could we just find a world renderer”: there is no
drop-in world renderer with a day–night cycle for three.js, because that is
what an ENGINE is. What exists is COMPONENTS — an atmosphere, tree generators,
CC0 assets, post-processing. The terrain engine is ours because the shipping
alternatives (Cesium, 3D Tiles) exist to STREAM the real Earth, which §13
deliberately deleted. Take the components; keep the structure.

Check the licence and the backend of any library taken here against §8.0 — a
WebGL-only atmosphere would decide the renderer question by the back door.


---

## 9. THE ASSET FORMAT

    header      domain bounds, projection, height range/quantisation,
                patch size, max depth, source provenance
    index       quadtree topology — which addresses exist, and at what depth
    patches     33×33 int16, addressed by quadtree code, delta-compressed
    overlays    splat weights · canopy height · ORI mask, 20 m rasters
    guides      slope · accumulation · curvature · aspect (or recomputed on load)
    modifiers   the vector layer (§6)

**A patch table keyed by quadtree address** is the requirement that makes
editing cheap: a rebuild is a diff, not a new file.

---

## 10. THE GATES

**GATE WORLD** (exists) — reworked for an asset-driven world, not patched.
Add: with no asset present, `makeWorld({analytic:0})` reproduces today's world
bit-identically (§5.1).

**GATE TERRAIN** (new).
1. **C⁰ across every patch boundary — no step, sampled** (amended 2026-09-07:
   the first draft asked for C¹ here, which a bilinear int16 patch cannot give
   and §5.4 now states plainly. The modifier falloffs ARE C¹ and are still
   asserted as such; the patch field is asserted continuous, plus a bound on
   the gradient jump at a depth change.)
2. Physics and renderer sample the same height at the same (x, z) at the
   finest drawn level.
3. 2:1 balance holds everywhere; no crack at any boundary.
4. **Baked and live modifier evaluation agree** to within quantisation (§6.3).
5. Hot path within budget, measured against the current `h0`.

**GATE TREES** (new, 2026-09-07 — §8.3). On a fixed camera set over a forested
slice, on a DECLARED reference GPU: canopy cover fraction within a band of the
per-class target; instances drawn; frame time; and that the impostor atlas was
baked from the same asset R1 ships. A tree pass without a number is how §8.3
stayed one paragraph for a month.

**GATE SITES** (new) — every nominated site is flyable into, measured with
`41_test_pilot.js`.

---

## 11. STAGING (revised 2026-09-07)

Two stages are ADDED IN FRONT and numbered W0/W0.5 so that every existing
reference to W1–W7 — here, in `ISLAND-ADMIRALTY.md`, in the ROADMAP — keeps
its meaning. Nothing below W1 changed except where it says so.

**W0 — THE TREE SPIKE. A DECISION, NOT A FEATURE.** One week, one ~3 km slice
of the analytic world, on TODAY’S WebGL2 renderer. Build all four rungs of
§8.3 cheaply: one real near asset, an impostor atlas baked from it, a canopy
shell from a stand-in height field, and real per-class density. Then MEASURE —
and measure the right thing:

- frame time on a declared mid-range reference GPU, at real density;
- canopy cover fraction, against the class target;
- **and WHICH WALL is hit** — CPU-side (draw calls, culling, instance upload)
  or GPU-side (fill rate, overdraw). This is the whole point of running it
  first. A CPU wall is what WebGPU’s compute culling and indirect draws fix,
  so it argues FOR W0.5. A fill-rate wall is the same wall a native engine
  hits, so it argues that the platform was never the constraint. Only a
  fill-rate wall that is still unacceptable after LOD and overdraw work is an
  argument for leaving the web — and then `WORLD-CONTRACT.md` is the exit.

W0 is first because it is the cheapest test of the most expensive assumption,
and because every stage after it is a bet on the answer. It is deliberately
run on the CURRENT renderer: a spike that needed the port first would not be a
spike.

**W0.5 — THE RENDERER TARGET** (§8.0), conditional on W0. Port
`src/viewer/aeroskin.js` (5 hooks, 4 ShaderMaterials, ~249 GLSL lines) to TSL
as its own chantier, then sweep the remaining ~22 hooks across eight files,
which are small patches rather than systems. Prerequisite of W1 — not because
W1 needs WebGPU, but because W1 is the first big new shader surface and should
not be written twice.

**W1 — the material pass.** Splat materials on today’s mesh and today’s 24 km
analytic world. Depends on nothing (except being written in TSL, per W0.5).
Largest visible improvement available after the trees.

**W2 — the quadtree, on the analytic world.** Build the baker, the format, the
renderer and the physics sampler against `h0` — a world whose right answer is
already known, and against which every existing gate still runs. Ship §5.4’s
gradient rule with the sampler.

**W3 — trees, productionised.** W0’s spike becomes the real ladder: the
species set, the density targets per WorldCover class, the atlas bake at boot,
the canopy shell driven by real DSM − DTM, and GATE TREES (§8.3).

**W4 — the pipeline, on a slice.** `ISLAND-PREPACK.md` §6 on one 20 × 20 km
piece of Ursoy, loaded as the 24 km domain. First real tuning of ε, the zone
budgets and the palette.

> **W4 IS THE SHIPPED WORLD, and for a long time (2026-09-07).** Ursoy is
> 145 km long; the game is little airports and short hops. A 20 × 20 km slice
> holds more airfields than the loop has yet earned, and it is the world the
> playtest cycle should run on. W5 is the step that “invalidates every golden”
> and buys scale the game is not yet asking for — take it when the loop is
> proven fun, not before. This is the same ruling as the ROADMAP’s own
> “validated ugly”, applied to geography.

**W5 — the whole island.** The step that invalidates every golden, and the step
that does nothing else. Deferred per the note above.

**W6 — nomination + zones.** The landability pass, promotion, the zone list.

**W7 — the airfield editor.** Its own document, on §6’s format.

W2 before W4 is deliberate: prove the structure on a world you already trust
before introducing a world you do not.


---

## 12. OPEN QUESTIONS

1. **Skirts or stitching** (§2.2). Recommend skirts; decide with the format.
1b. **Parent prediction.** A child’s even samples ARE its parent’s, so a child
   could be predicted from the upsampled parent and only the high-frequency
   residual stored. Noted in `terrain_codec.js` and deliberately not taken
   until the current baseline had been measured. It is now measured (2.55×),
   so this can be tried against a real number.
2. **The game frame projection** — Alaska Albers or UTM 8N. Pick one, write it
   down, never convert again.
3. **ε, and the land-cover multipliers** (§2.1). Numbers to be found by looking
   at W4, not argued on paper.
4. **Is `assets/` committed?** (§4.) One `git ls-files` above `flyDiy/`.
5. **Does Angoon survive?** (`ISLAND-ADMIRALTY.md` §12.3.)

### Added 2026-09-07 (`RENDERER-DECISION-2026-09-07.md`)

6. **(t) The renderer target** — WebGPURenderer/TSL with a WebGL2 fallback
   (§8.0), and the aeroskin port as its own chantier. **Recommended; the
   user agreed 2026-09-07.** Conditional on W0’s verdict only in the sense
   that a fill-rate verdict would change what is worth porting to.
7. **(u) W0, the tree spike, ahead of W1** (§11), with a numeric gate.
   **Recommended.** It is the cheapest test of the platform assumption.
8. **(v) The atmosphere taken off the shelf** rather than written (§8.4).
   **Recommended** — check the library’s backend against §8.0.
9. **(w) W4’s 20 × 20 km slice is the shipped world** until the loop proves
   itself (§11). **Recommended.**
10. **The reference GPU for GATE TREES.** A frame-time gate needs a declared
   machine or it is not a gate. Name one at W0.
11. **Tree asset provenance and licence** — a procedural generator baked to
   GLB, or CC0 scans. `CREDITS.md` already has the home for the answer.
12. **Does the canopy shell (§8.3 R3) replace the 5.2 km fog wall entirely**,
   or does a shortened wall remain behind it? Decide at W0, when there is
   something to look at.


---

## 13. WHAT THE FIRST DRAFT GOT WRONG

Kept because the reasoning is instructive, and because a superseded document
that does not say why it was superseded gets quietly re-adopted.

| first draft | why it went |
|---|---|
| three tiers (49 m base + 4 m hero tiles + modifiers) | rationing a uniform grid. The adaptive quadtree makes the rationing unnecessary. |
| geometry clipmap | a second structure doing the job the quadtree already does |
| streamed tiles, ~650 MB | an artefact of uniform 5 m over the whole island. At 40 MB there is nothing to stream. |
| Cloudflare R2 | only needed because of the streaming. Deleted with it. |
| offline erosion simulation at 4096² | real DEM has real erosion. Replaced by a data pipeline (`ISLAND-ADMIRALTY.md` §8). |
| guided GEOMETRIC detail below the bake | becomes material (§5.2); the geometry argument in §1 never supported it |
| vertical exaggeration ×1.5-1.8 | decouples elevation from the land cover derived from it (`ISLAND-ADMIRALTY.md` §4.1) |
| sea-level flooding to make an island | same defect, worse — ocean where WorldCover says forest |
| "the site is 682 MB already" | 595 MB of that is source material and archives; only ~87 MB ships |

The pattern in almost every row: **a complicated mechanism defending a simple
wrong assumption.** The assumption was that terrain is a grid.
