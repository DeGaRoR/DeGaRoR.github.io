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

## 4b. CORRECTION, 2026-09-11 — THE PORT WAS UNDER-MEASURED, AND IT IS TWO JUMPS

§4 costed this as "one chantier for aeroskin, one sweep for the rest". **That
was wrong, and the error was mine: I measured the shader surface and never
checked the three.js VERSION.** Measured 2026-09-11:

```
vendor/three.min.js   REVISION "128"          (r128 — May 2021)
  outputEncoding 1   outputColorSpace 0
  sRGBEncoding   1   SRGBColorSpace   0
  physicallyCorrectLights 1   useLegacyLights 0
  ColorManagement 0   WebGPURenderer 0   BatchedMesh 0
```

So the move is **not** WebGL→WebGPU. It is **r128 → current, AND then
WebGL→WebGPU**, and the version jump is the larger and riskier of the two —
not because of the shaders, but because of what it does to every number in this
project that was tuned by eye:

- **Colour management (r152).** `outputEncoding`/`sRGBEncoding` become
  `outputColorSpace`/`SRGBColorSpace`, and `ColorManagement` is ON by default.
  Every hand-calibrated colour was tuned against r128's pipeline: the six
  MEASURED mood rows in `hangar_sky.js`, `light_rig.js`'s ground bounce
  (0.148), G206's material-lab gains, and a sky palette whose own comment says
  it is *"authored in DISPLAY space… which is what the colours were tuned
  against."*
- **Light units (r155).** `physicallyCorrectLights` is gone. `light_rig.js` —
  the file whose entire purpose is that a candela means one thing everywhere —
  is calibrated in r128 semantics.
- **Shader chunk names moved.** The 27 `onBeforeCompile` sites patch chunks by
  name.
- **The PMREM/RGBE workaround** documented at `render_world.js:66-77` is
  r128-specific and evaporates.

**The cost is RECALIBRATION, not translation.** That is the honest number.

### What this changes about the plan

**W0.5 splits into three, and each ends with the battery green:**

- **W0.5a — the three.js upgrade, STILL ON WebGLRenderer.** Its own chantier.
  The work is re-measuring what was measured: the mood rows, the rig, the
  gains, the palette. Ends with a working game on the same backend.
- **W0.5b — GLSL → TSL, still on the WebGL2 backend.** Incremental, one hook
  at a time, each verifiable against the version it replaces. No fork.
- **W0.5c — flip the backend.** A flag (below).

**AND IT SHOULD HAPPEN BEFORE THE WORLD WORK, NOT AFTER.** Every shader written
against r128 between now and the upgrade is one more thing to recalibrate. The
splat pass (W1), the tree material (W3) and the atmosphere (`SKY-ATMOSPHERE-
2026-09-11.md` S3+) should each be written ONCE, on modern three. This is a
stronger argument for going now than §8.0 originally made.

**Dependency surfaced:** `@pmndrs/sky` (the atmosphere recommendation) requires
modern three and TSL, so S3-S6 are GATED on W0.5a. S1 and S2 — the day and the
solar position — are pure data and are not.

## 4c. "CAN WE KEEP A WORKING VERSION AT ALL TIMES?" — YES, AND IT IS NOT A FORK

The user's fear was a parallel branch where *"almost nothing from the current
world would survive."* Two measured facts make that unnecessary:

1. **`WebGPURenderer` falls back to a WebGL2 backend automatically** when
   WebGPU is unavailable, and carries a `forceWebGL` flag for testing the
   fallback deliberately.
2. **TSL compiles to BOTH WGSL and GLSL.** One material source, both backends.

So the switch is a RUNTIME BACKEND SELECTION, not two codebases. There is never
a broken branch to maintain, and W0.5b can proceed shader by shader with the
old one still running beside it.

**And "almost nothing survives" is backwards.** What survives: the scene graph,
all geometry, the world data and its contract, the whole physics core, all 33
gates, the editor, the join, the aircraft generators, the UI, the loaders —
the large majority of the tree by line. What breaks is the 27 hooks, the 97
`ShaderMaterial`/`ShaderChunk` references, `aa_resolve.js`, the PMREM path, and
the calibration. It *feels* total because what breaks is precisely the part
that decides how it LOOKS.

## 4d. WHAT IS ACTUALLY ON THE CPU (measured 2026-09-11)

Stated because the decision was nearly taken on a wrong premise. **WebGL is a
GPU API; shading, rasterising and texturing are already on the GPU.** What runs
on the CPU, in JavaScript, on ONE thread:

- **the solver — 24 substeps per frame** (`30_solver.js:1060`,
  `step(dtFrame, sub = P_.substeps ?? 24)`);
- **every instance matrix**, composed in JS and re-uploaded each frame
  (`setMatrixAt` / `setColorAt` / `instanceMatrix.needsUpdate` at a dozen sites
  in `render_world.js`);
- chunk streaming and all culling decisions (`fillUpdate`, `worldUpdate`);
- **no Web Workers anywhere in the game** (the only `new Worker` in the tree is
  in the `_cage_energy.js` bench).

So the constraint is not "CPU rendering". It is that **the CPU decides
everything the GPU draws, and shares one thread with the physics.** That is
exactly the wall W0 is designed to identify, and it is the wall WebGPU's
compute culling and indirect draws remove — the GPU builds its own instance
lists instead of being handed them.

**Two corollaries that matter:**

- **The physics must NEVER move to the GPU.** The whole method here is
  deterministic headless node gates; GPU compute is not reproducible across
  drivers and does not exist in node. The solver stays on the CPU, by ruling.
- **Moving the solver to a Web Worker is a separate, cheaper win that needs no
  WebGPU at all**, and it may be worth more frame time than the backend port:
  it stops 24 substeps of physics from competing with render submission on the
  same thread. Independent of everything above; worth its own line in the
  register.

## 4f. MEASURED SINCE — THE CPU IS NOT THE WALL, AND TWO RECOMMENDATIONS DIE (2026-09-12)

W0c ran. Two numbers from the tree's own record settle things this document
argued from first principles:

- **`HANDOVER.md:23643`** — *"the default build's physics — 45 substeps, 54
  nodes — costs **~1.4 ms/frame** headless, parked or cruising. **Physics
  exonerated.**"*
- **W0c.4** — the LOD partition done CPU-side, *"and **measured not to be the
  wall**"*. In the densest stand, unthrottled at 1920x1080: all-L0 **21.4 ms**,
  150/300/450 21.2, 80/200/450 21.0, all-L2 20.5. *"Eight hundred trees at
  7 784 triangles cost under a millisecond more than the same trees at 1 798.
  THE NEAR TIER'S TRIANGLES ARE NOT THE WALL."*

**Consequence 1 — ruling (am), the solver in a Worker, is WITHDRAWN as a
priority.** §4e's obstacles are all still true, but the prize is 1.4 ms of a
21 ms frame — under 7 %, for a chantier that touches determinism, the world's
instantiation and the clone boundary. Not worth it. Keep §4e as the record of
HOW, should the number ever change; drop it to the bottom of the register.

**Consequence 2 — the migration's PERFORMANCE case is unproven, and may be
zero.** WebGPU's win is compute culling and indirect draws, i.e. a CPU-wall
fix. Two CPU candidates have now been measured and exonerated. The remaining
honest case for the migration is **"so new shader work is not written twice"**
— real, but a debt argument, not a frame-rate one. Say so rather than let §8.0
be read as a performance ruling.

**Consequence 3 — the number that should set the agenda.** 21.4 ms is ~47 fps
at 1920x1080 with **800 trees**, and W0c.4 states the density Ursoy wants is
*"an order of magnitude up from here"* — before grass, clouds, water, the
imported terrain, or road decals. **W0e — locating the wall — is now the
highest-value hour in the project.** Its suspect list is already written: *"the
streamed fill's thousands of instances, the shadow pass, the terrain, the
sim."* Note the list still spans both sides: the streamed fill is CPU-side
submission (which WebGPU fixes), the shadow pass is GPU-side (which it does
not). **So the migration decision is not dead — it is GATED ON W0e**, exactly
as §11's W0 was written to be.

**One small data point FOR the migration, from the same arc:** W0a.2 was
*"the albedo sheet was written linear and decoded as sRGB, which is where the
far band's missing 2.2x went"* — a colour-space bug, and W0c.4 had to work
around *"r128's shadow map copies neither [map nor cutoff]"*. r128's missing
colour management is already costing sessions.

## 4e. THE SOLVER IN A WORKER — feasible, with four named obstacles (2026-09-11)

Recorded so the chantier behind ruling (am) starts from the measurement.

**OBSTACLE 1, and it is the whole problem: the solver reaches the world through
FUNCTIONS, per substep.** Measured in `30_solver.js`:

```
 95  const airOf = () => atmOver || (world && world.atmos) || ATMOS_ISA;
615  gH = world.terrainH(mx, mz);
621  if (world.wind) { const wv = world.wind(mx, my, mz, simT); ... }   (+ :759, :870)
987  world.surface(p[i3], p[i3+2])                       the wheel's friction
1023 const near = world.treesNear(cgx, cgz, _treeScratch);  ... world.trees[ti]
```

**Functions cannot be structured-cloned across a worker boundary.** The world
cannot be posted. Three ways out, and only one works:

- **(a) BUILD THE WORLD TWICE — recommended.** `makeWorld(seed)` is pure and
  deterministic, and `tools/test_world.js:69` already asserts it:
  `makeWorld(12345)` twice compares equal. So each thread builds its own and
  they agree BY CONSTRUCTION. This is `WORLD-CONTRACT.md` §0's own principle
  ("three consumers read it independently") used as designed. Cost: the bake
  runs twice (~0.55 s, `WORLD-GEN-PROC.md`) and the world is resident twice.
  **WORLD-V2 makes this cheaper, not dearer** — an asset-driven quadtree is a
  loaded file both sides read, not a bake both sides run.
- **(b) SharedArrayBuffer for the heightfield — BLOCKED.** It requires COOP/COEP
  response headers, and **GitHub Pages cannot set custom headers.** Since the
  game ships from Pages (`WORLD-V2.md` §4), this route is closed unless the
  hosting changes. Worth knowing before someone spends a day on it.
- **(c) Ship terrain samples main → worker each frame.** Does not work: the
  solver samples at positions it computes DURING the substep, not before it.

**OBSTACLE 2 — `def` is probably not clonable as it stands.** `buildGen`
returns `{ nodes, beams, strips, refs, params, spec, parts }`
(`64_gen_build.js:16-17`), but the frame's own record carries FUNCTION-valued
fields — `chordAt`, `yF`, `incAt`, `xFat`, `xRat` (`61_gen_frame.js:898, 1918`).
A naive `postMessage(def)` throws `DataCloneError`. Needs an audit and a
`defToTransfer()` / `defFromTransfer()` pair. Small, but it bites on day one.

**OBSTACLE 3 — one frame of control latency.** Irrelevant to the autopilot,
which is the pilot by design; ~16 ms added for hand-flying, which is acceptable
but is a ruling to take deliberately now that G200 has a stick.

**OBSTACLE 4 — the gates must not move.** Solved by making the worker a
WRAPPER: the worker script loads `flight_core.js` and calls `step()`. The node
battery keeps calling `step()` directly, unchanged. **Do not restructure the
solver itself** — that is how a 33-gate battery gets invalidated for a
threading change.

**What is NOT a problem.** The return transfer is tiny — 55 nodes x 3 floats
per frame, a double-buffered transferable `Float32Array`; nothing like a
particle system. Determinism survives (same code, same seed). And `terrainH` is
0.52 µs/call (`WORLD-GEN-PROC.md`), so the world sampling is not the cost — the
solver's own arithmetic across 24 substeps is.

**WHETHER IT IS WORTH IT IS THE SAME QUESTION W0 ASKS.** A worker gives the
main thread back whatever the solver costs, and gives back more as the world
grows heavier. But it addresses the CPU wall — the same wall WebGPU's compute
culling addresses. If W0's spike reports a FILL-RATE wall, neither buys a
visible frame. **Run W0 first; it prices both of these at once.**

## 5. RULINGS OWED

- (t) WebGPURenderer/TSL as the world renderer target; the aeroskin port as
  its own chantier.
- (u) The tree spike as the next world chantier, ahead of W1's splat pass
  (the user's stated priority), with a numeric gate.
- (v) The atmosphere taken off the shelf rather than written (§8.4).
- (w) W4's 20×20 km slice as the shipped world until the loop proves itself.
- **(ak) The three.js upgrade (r128 → current) is its own chantier, on
  WebGLRenderer, and lands BEFORE the world's new shader work** (§4b).
  Recommended.
- **(al) The solver never moves to the GPU** — determinism and the node gate
  battery (§4d). Recommended as a standing ruling.
- **(am) The solver in a Web Worker** as an independent frame-time chantier,
  unrelated to the backend (§4d). Recommended for the debt register.
