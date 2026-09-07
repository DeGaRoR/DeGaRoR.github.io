# THE RENDERER, THE WEB, AND THE TREES — a study

2026-09-07, on the user's questions: *"Is it still reasonable to have this in
the web? The one thing I would be really picky on are the trees — real
densities, and the close-up trees need to look good. Is a world renderer with
day-night something we could find ready-made? What do you think of the world
design from the new perspective? Are we making our life very difficult by
wanting to stay in the web — do we really need it, do we really want it?"*

Measured on this tree unless marked INFERRED. Opinion is marked as such.

## 0. ONE CLARIFICATION FIRST

**"Ursoy" is not an engine.** It is the island — Admiralty Island, Alaska,
taken whole from public-domain 5 m IFSAR elevation and ESA WorldCover land
cover, renamed (`ISLAND-ADMIRALTY.md`, `ISLAND-PREPACK.md`). The terrain
engine in `WORLD-V2.md` is homegrown: an adaptive quadtree of 33×33 int16
height patches whose depth is set offline by an error budget, on three.js.
Nothing external was picked. The vendored renderer is `vendor/three.min.js`,
a WebGL build (zero occurrences of `WebGPU` in it).

## 1. THE TREES, MEASURED — where the gap actually is

Today (`src/core/20_world.js:259-291`, `tools/_base_render_world.js:540-650`):

| layer | placement | ceiling | geometry |
|---|---|---|---|
| collidable stand trees | one per 64 m cell | **≤ 244 / km²** | cylinder + cone + icosahedron |
| W13 dense fill (render-only) | ~13.1 m jittered grid, FOREST_FLOOR only, 1024 m chunks to 5.6 km | **≤ 5 800 / km²** | 5-sided open cone 5 m, icosahedron r 1.9 m |
| far field | fog wall at 5.2 km | — | — |

A real Southeast-Alaska conifer stand runs hundreds of stems per hectare
mature and thousands young — **tens of thousands per km²** — with a CLOSED
canopy. The fill's 3.8 m crowns at 13 m spacing give ~7 % canopy cover. So
the gap to "real density" is roughly **one order of magnitude in count and
one in crown size**, and the close-up asset is a cone. The user's
"the world stinks" is, measurably, the trees.

**Can a browser do it?** Yes, and the shape of the answer is the same as in
any engine — a ladder — but the ladder needs two rungs it does not have:

1. **Near (< ~250 m): a real tree asset**, not a cone. Leaf cards on a
   trunk mesh, 2-8 k triangles, alpha-tested. Sources that exist: procedural
   generators for three.js (ez-tree style), CC0 scans the project already
   ships from Poly Haven, exported SpeedTree/TreeIt GLBs. This is an ASSET
   problem, not a platform problem.
2. **Mid (250 m – 2 km): impostors** — octahedral or crossed-card atlases
   baked from the near asset at boot. The project already bakes an atlas
   "from the near-tier geometry" (`WORLD-V2.md` §8.3); replacing the source
   improves the tier, as that section says.
3. **Far (> 2 km): the CANOPY SHELL.** This is the rung the plan undersells.
   `ISLAND-PREPACK.md` §3.2 already delivers a canopy height model
   (IFSAR DSM − DTM, 5 m). Render it as a displaced surface with a forest
   material — a lumpy green shell at canopy height — and the far forest is
   a texture with the right silhouette, at the cost of one more terrain
   layer. That is how a 195 km horizon is affordable at all; it is roughly
   what shipping simulators do at range.
4. **Density at the counts that follow.** Real density inside a 3 km radius
   is ~1-2 M instances. WebGL2 with CPU chunk culling and instancing (the
   pattern the renderer already uses) reaches that order; foliage is
   fill-rate/overdraw bound, which is the same wall a native renderer hits.
   WebGPU (compute-side culling and LOD selection, indirect draws) makes it
   comfortable rather than tight.

INFERRED but well-founded: the platform is not what stands between the
project and real trees. The ladder's two missing rungs and the asset are.

## 2. "READY-MADE" — components exist, a world renderer does not

There is no drop-in "world renderer with a day-night cycle" for three.js,
because that is what an ENGINE is. What exists, and is worth taking rather
than writing:

- **Atmosphere / sky / aerial perspective**: precomputed-scattering
  atmospheres for three.js (the Takram `three-geospatial` / `three-atmosphere`
  family — Bruneton-style scattering, sun/moon, clouds). `WORLD-V2.md` §8.4
  wants exactly this and should not write it.
- **Trees**: procedural generators and CC0 assets (§1).
- **Terrain**: the homegrown quadtree is the right size for this project
  (40 MB asset, no streaming) — the alternatives (Cesium, 3D Tiles) are for
  streaming the real Earth, which WORLD-V2 §13 deliberately deleted.

The ready-made world renderers are Unreal, Unity and Godot. That is the real
form of the user's question, and it is answered in §4.

## 3. THE WORLD DESIGN, READ FROM TODAY (opinion, on measured facts)

What holds, and holds well:
- **Real elevation, own look.** Real DEM for erosion, land cover for
  placement, palette entirely ours — the strongest section of the design.
- **The quadtree with error-budget depth.** Standard, correct, measured
  (2.55× codec, 5.8 leaves/km², ~40 MB). One structure for storage and LOD.
- **Runways designed, not measured** (§3.2) — the observation the budget
  turns on, and right.
- **W2 before W4** — prove the structure on the trusted analytic world.

What I would change, from today's perspective:
- **§8.3 is one paragraph and it is the thing the user will not compromise
  on.** It needs to be the tree LADDER document: the near asset, the impostor
  bake, the canopy shell, the density target per land-cover class, the
  budget per rung, and a gate with a number (instances drawn / ms / cover
  fraction). W3 is under-specified relative to its importance.
- **The renderer target is undecided and the code is choosing by default.**
  G206's materials pass is GLSL `onBeforeCompile` hooks (`lights_fragment_
  end`, `uGain`, `defines.PHYSICAL` by hand). Every such hook is a cost of
  moving to three.js's WebGPURenderer/TSL later. `WORLD-CONTRACT.md` §0
  keeps the world data free of THREE types precisely so the renderer can be
  swapped — but the AIRCRAFT's materials are not behind that contract. Decide
  WebGL-vs-WebGPU now, before the aeroskin accumulates more GLSL.
- **Take the atmosphere off the shelf** (§2).
- **Size.** Ursoy is 145 km long for a game about little airports and short
  hops. The design's own W4 (one 20×20 km slice as the 24 km domain) is the
  right SHIPPED world for a long time; the whole island (W5) is the step
  that "invalidates every golden" and should wait for the loop to prove
  itself on the slice.
- **Physics on the quadtree**: bilinear int16 patches are C⁰; fine for
  wheels at 0.69 m strip cells, fine for ground effect. Say so in §5 rather
  than leaving C¹ implied from WORLD-GEN-PROC.

## 4. DO WE NEED THE WEB, DO WE WANT IT — the decision (opinion)

**What leaving buys:** Unreal's foliage (Nanite, PCG forests, Lumen) — the
best trees in the industry, for free, if you accept Unreal. Unity/Godot buy
less on trees and cost the same rewrite.

**What leaving costs:** the whole game is JavaScript — the solver, the
generators, the 46-slider grammar, the join, the design flow, and a node gate
battery that is the project's method. Two exits exist: (a) keep the JS core
and run it beside a native renderer (Electron/Tauri changes nothing about the
renderer; a Node sidecar feeding node positions to Unreal each frame is a
new architecture with a real IPC problem); (b) port. (b) is a year, and the
year would be spent re-proving what the gates already prove.

**What the web buys that nothing else does:** the demo is a link. For a
project whose potential (per the earlier conversation) rests on being seen —
"draw a plane, watch it fly" — that is not a small thing.

**The verdict:** stay, but stop letting the renderer choose itself.

1. **Pick three.js WebGPURenderer (TSL) as the WORLD renderer target now**,
   with its WebGL2 fallback backend so one material code path serves both.
   Port the aeroskin's GLSL hooks to TSL as a bounded chantier before more
   accumulate. Browser support for WebGPU is mainstream in Chrome/Edge and,
   as of my knowledge, shipped in Firefox (Windows) and Safari in 2025 —
   confirm current numbers before relying on it.
2. **Run the tree spike before any more world work**: one week, one 3 km
   slice of the analytic world, a real near asset, an impostor atlas, the
   canopy shell, real density from WorldCover-style classes — and MEASURE
   frames, instances and canopy cover. If the number is 60 fps at real
   density on a mid-range GPU, the question is closed for the web. If it is
   not, `WORLD-CONTRACT` is the exit, and the spike will have told you which
   rung failed.
3. **The exit stays real**: the world data contract means the world could go
   native with the JS core in a sidecar. Do not spend on it; keep it.

## 5. RULINGS OWED

- (t) WebGPURenderer/TSL as the world renderer target; the aeroskin port as
  its own chantier.
- (u) The tree spike as the next world chantier, ahead of W1's splat pass
  (the user's stated priority), with a numeric gate.
- (v) The atmosphere taken off the shelf rather than written (§8.4).
- (w) W4's 20×20 km slice as the shipped world until the loop proves itself.
