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

## 4g. W0.5a LANDED — r128 → r186 ON WebGLRenderer, AND WHAT THE JUMP ACTUALLY COST (2026-09-13)

Done in one session, autonomously, on ruling (ak). The vendor is
three@0.186.0 (r186, released 2026-09-08), bundled by `tools/vendor_three.js`
(three stopped shipping a global build at r160; the bundle is an esbuild IIFE
with a global `THREE`, a CommonJS export for the node gates, and the colour
ruling in its footer; `package.json` pins it, `node_modules` is ignored, the
output `vendor/three.min.js` is tracked as it always was). Baseline shots were
taken on r128 FIRST (garage, roll-out, two flight frames; headless Chrome +
CDP at 1600×900), then the same states on r186, compared region by region.
The list below is MEASURED on this tree, not the migration guide's.

**What the port was, by kind:**

- *Translation* (mechanical, 30 files): `encoding` → `colorSpace`,
  `sRGBEncoding` → `SRGBColorSpace`, `LinearEncoding` → `LinearSRGBColorSpace`,
  `outputEncoding` → `outputColorSpace`, `PlaneBufferGeometry`,
  `WebGLMultisampleRenderTarget` → `WebGLRenderTarget` + `samples`,
  `uv2` → `uv1` for the props' aoMap, `updateRange` → `addUpdateRange`,
  `PCFSoftShadowMap` (removed in r186; PCF, the fallback it names), the dead
  `skinning` / `extensions.derivatives` flags, and the gate stubs' constants.
- *GLSL* (of the 55 hooks, only these broke): `GeometricContext` is gone
  (`geometry.normal/viewDir` → `geometryNormal/geometryViewDir`: the trees
  and the house glass); `geometryNormal` is declared by the LIGHTS now, so a
  hook that runs before them (the weathering, the impostor's normal
  substitution) reads `nonPerturbedNormal`; `#ifdef CLEARCOAT` →
  `USE_CLEARCOAT` (the aeroskin's clear layer compiled and silently drew
  nothing until then); `sRGBToLinear` → `sRGBTransferEOTF`;
  `encodings_fragment` → `colorspace_fragment`; Lambert is per-fragment and
  its vertex-lit shadow line (the far cascade's anchor) is gone — the cascade
  rides after `lights_fragment_end` and includes `<packing>` by hand (Lambert
  no longer does); **`vUv` does not exist any more** — `USE_UV` is defined
  nowhere in r186 and every map has its own varying (`vMapUv`,
  `vNormalMapUv`, …), so a hook that read the map's uv reads `vMapUv` (the
  house wander shifts ALL of them).
- *Recalibration* — the honest cost, and it was three things, not thirty:
  1. **The colour ruling.** `ColorManagement.enabled = false`, set in the
     vendor's footer so every page, bench and gate gets the same three. A hex
     literal means what it meant on r128 (the linear value the shader sees);
     texture decode is untouched (that is `texture.colorSpace`, independent).
     Turning it ON is a one-line, whole-project re-judging of every colour
     tuned by eye — the six mood rows, the sky palette, the material lab,
     every saved livery — a ruling for the user's eye, not for a session.
  2. **The light unit.** The WORLD ran r128's legacy light model (the shed ran
     the physical one already — `light_rig.js`); r186 has only the physical
     one, in which a directional/hemisphere intensity means PI× less. The rows
     keep their numbers (2.75 / 0.50, alps 2.8 / 0.274; the F8 panel shows and
     edits them) and `render_world.js LIGHT_UNIT = Math.PI` converts where a
     row reaches a light, once; the leaf wrap/SSS terms, which read the light
     uniform by hand, take the PI back out. Every bench rig got the same
     factor (`LU`). The aeroplane's own lamps were already tuned in the shed's
     physical model, so in flight they now fall off as they do in the shed.
  3. **The world's Lambert stays out of the environment.** r186 hands
     `scene.environment` to Lambert/Phong as diffuse IBL (r128: Standard
     only). Left alone, every slope, tree and roof would count the sky twice
     (the hemisphere IS the world's ambient because of r128's rule). One
     opt-out, zero cost: a Lambert with an envMap of its own is left alone by
     the scene, and an equirect texture with no image resolves to no map at
     all (`LAMBERT_NO_ENV`, `worldLambert()`, 27 sites in one file). The IBL
     is the better ambient; taking it means retiring the hemisphere and
     re-judging the world — RULING OWED.

**The trap that cost the most: post-process tone mapping.** r186 writes every
ordinary render target LINEAR and UN-tone-mapped, so the resolve pass (G144)
had to apply three's own two chunks itself — and the first r186 frame showed
why that cannot be: the sky dome writes DISPLAY values and relies on never
being tone-mapped, and every `toneMapped: false` material (UI colours, the
impostor bake, the instrument faces) loses its opt-out under a post-process
tone map. three carries the rule that restores r128's arrangement for its own
WebXR layers — a target with `isXRRenderTarget` is treated LIKE THE CANVAS
(tone map per material, output space from the target's texture, linear
storage so the shader encodes; WebGLPrograms 181/213, UniformsUtils 140,
WebGLTextures 2120, WebGLRenderer 2378). One flag on the resolve target; GATE
AA holds it and checks that the vendor still carries the rule. Blending stays
in display space, as the header's own measurement wanted.

**Measured, r128 vs r186, same states (mean |Δ| per channel, 0–255):** the sky
region 0.8 (identical); the roll-out frame 7 overall (dither plus a moment of
taxi); the flight frames' ground 15–25 in the mid/bottom regions — shots taken
at slightly different taxi moments, so partly the aeroplane's own shadow
moving; the residual candidates are PCF vs PCFSoft (the shadow's edge),
hardware sRGB decode vs r128's shader approximation, and per-fragment Lambert.
The garage matched to the eye (its numbers are dominated by a different boot
framing). Console: zero errors on the game page after the port. THEN THE
SAME FRAME, properly: a clean HEAD worktree (r128) served beside the tree,
both rolled out and PAUSED at the stand within three seconds, shot twice each
(the r128 pair's own difference: 0.02 — the frame is still) — r128 vs r186
mean |Δ| 3.9 on the sky, 8–12 on the apron and the aeroplane, region means
within 1–4 codes of each other, 8–14 % of pixels over 24 codes (edges: the
shadow's PCF vs PCFSoft filter and the dither). **RULING
OWED: a same-frame A/B by the user's eye on the shipped tier**, and whether
the slightly darker ground is wanted back (the hemisphere's number is the
knob).

**What W0.5b must actually look like — a finding, not a plan change.** The
briefing says "GLSL → TSL on the WebGL2 backend, one hook at a time, no
fork". Measured against r186: TSL runs only under `WebGPURenderer` (its WebGL2
backend is `forceWebGL: true`), and that renderer IGNORES `onBeforeCompile`
and cannot draw a `ShaderMaterial` at all. So the moment the renderer object
changes, every GLSL hook is dead at once — "one hook at a time" is only
possible as a RENDERER FLAG with each material module offering both a GLSL
and a TSL variant, the GLSL path staying the default until the last hook is
ported. Not a fork of the tree; a second variant per material (aeroskin's
5 hooks + 4 ShaderMaterials, aeroweather, render_world's ~20, trees,
site_ground, hangar's backdrop + probe, the impostor bake, aa_resolve → three's
PostProcessing / RenderOutput node). The vendor script emits the second bundle
(`three.webgpu.js`) beside the first; it loads only under the flag, so
index.html does not grow until the flip. §4h records the first step.

**THE FLAG IS NOT INERT ANY MORE — the second trap, found by the user's eye.**
On r128 `texture.encoding` did nothing on a sampler the hook declared itself
(only the built-in map chunks decoded), so two hooks decoded by hand: the
impostor sheet (`impSRGB`) and the aeroskin's decal atlas (`sRGBToLinear`).
On r186 the flag IS the decode — an sRGB texture gets `SRGB8_ALPHA8`
storage and every sampler, ours included, reads it decoded — so both were
decoded TWICE and every impostor and every decal came out darker. Fixed by
dropping the hand decodes (the flag stays; one keeper). The converse is
true as well and was NOT a bug here: an sRGB-flagged texture a hook read
raw on r128 (the house steel mix's second diffuse, `uMap2`) now arrives
decoded, i.e. correctly — the rust on the village's steel roofs is a little
darker and that is the right value (the village session owns it).

**TWO MORE, FOUND ON THE SAME FRAME BY THE USER'S EYE (the pane and the shoe).**
(1) The aeroskin's glass pass anchored its output on the literal line
`gl_FragColor = vec4( outgoingLight, diffuseColor.a );`, which sat inline in
r128's template and lives inside `<opaque_fragment>` since r15x — the anchor
census passed it because the text still exists in a CHUNK. The replace missed
silently, the pane drew the whole outgoingLight additively and read as milk
(centre |Δ| 92 vs r128; 17 after re-anchoring on the include). Lesson: a
non-include anchor must be checked against the ShaderLib TEMPLATES, not the
chunks. (2) `Object3D.updateWorldMatrix` recomputes a world matrix only when
`matrixWorldNeedsUpdate` is set or a parent forces it; r128 recomputed it
unconditionally. The crew's solver twin hangs off a DETACHED, never-rendered
root whose frame is a hand-set `cageM` with `matrixAutoUpdate = false`, so on
r186 that frame stayed the identity and the legs and arms were solved in the
cage's frame — a foot outside the door. One flag (`matrixWorldNeedsUpdate =
true`) after every hand-set matrix (`mkFrame`, and the craft's own `grp` per
pose, whose world was otherwise a frame stale for anything read between the
pose and the render). After both: the door close-up, same frame, r128 vs
r186 — mean |Δ| 6–8 codes, 2–7 % of pixels over 24, and the pilot's feet on
the same pedals to the centimetre (41.84 / 0.97 / 40.29 both).

**Traps for the next three bump, so nobody pays them twice:** the migration
guide lists the renames and none of the four that hurt (no `vUv`,
`geometryNormal` moved to the lights, `CLEARCOAT` → `USE_CLEARCOAT`, Lambert
without `<packing>`); a hook that compiles can still be WRONG (the clearcoat
one compiled and drew no clear coat, because `#ifdef` of a dead name is not an
error); shoot the page before trusting a green node battery — every one of
these was found in the first headless-Chrome frame and none by a gate; and the
node battery's stubs (UISMOKE, WORLDRENDER, HANGAR, HOUSE, VILLAGE) carry
three's constants by hand — a rename lands in five stubs or a gate goes red on
a name, not on a fact.

## 4h. W0.5b GROUNDWORK — THE SECOND BUNDLE, THE TSL BENCH, AND THE FIRST MATERIAL WRITTEN ONCE (2026-09-13)

Landed with W0.5a so the next session starts from a number:

- **`vendor/three.webgpu.min.js`** (1.08 MB, built by the same
  `tools/vendor_three.js`): `three/webgpu` (the whole core + WebGPURenderer +
  the node materials + PostProcessing) with the TSL functions under
  `THREE.TSL`. A page loads ONE of the two bundles; nothing in the game loads
  this one yet, and index.html does not carry it.
- **`tools/_tsl.html`**: WebGPURenderer, `forceWebGL` by default (`?gpu=1` for
  the WebGPU backend), the world's SKY DOME ported to a
  `MeshBasicNodeMaterial.colorNode` — the same five uniforms, three mixes and
  three sun powers as `render_world.js skyMat` — over a Standard node-material
  ground under the world's sun and hemisphere in the physical unit; then a
  render-target readback compared with the dome formula evaluated in JS.

**Measured (headless Chrome, RTX 3080):**

| run | backend | ColorManagement | dome vs formula, three sky samples |
|---|---|---|---|
| default | WebGL2 fallback | off (the ruling) | **|Δ| 0 / 1 / 1 codes** |
| `?gpu=1` | **WebGPU** (real, in headless Chrome) | off | **|Δ| 0 / 1 / 1** — identical to the fallback |
| `?nocm=0` | WebGL2 fallback | ON | |Δ| 72–74: the node stage's working↔output conversions do not round-trip a display-authored palette |

So: (1) the TSL toolchain works from the vendor bundle with no module
loader; (2) the first material ported reads the same to the code on BOTH
backends, which is §4c's "one material source, both backends" made true on
this tree; (3) the colour ruling holds under the node renderer too —
`colorSpaceToWorking` + the output stage are both inert with the flag off,
so a display-authored colour round-trips exactly, and the flip to ON is the
same whole-project re-judging it is on WebGLRenderer, no worse.

**Traps met (both cost a run):** `renderAsync()` is deprecated in r186
(`await renderer.init()` once, then `render()`); and `readRenderTargetPixelsAsync`
returns rows BOTTOM-UP on the WebGL backend and TOP-DOWN on WebGPU — the
first WebGPU run sampled the ground where it asked for the zenith and
reported |Δ| 138 against a sky that was, on the screenshot, right.

**The order for W0.5b, from here:** a renderer flag in app.js (`?tsl=1` /
a graphics-menu row) that loads the second bundle and constructs
`WebGPURenderer({ forceWebGL: true })`; the dome first (done on the bench —
move it into render_world.js behind the flag); then the impostor and tree
materials (the newest GLSL, 28 hooks, all in two files); then the resolve
pass as `PostProcessing` + `RenderOutputNode` (the XR-target trick of §4g is
WebGLRenderer-only — under the node renderer the dome must be decoded on the
way in exactly as the bench does, and every `toneMapped: false` material
needs the same treatment or a per-material output node); the aeroskin last
(5 hooks + 4 ShaderMaterials, the largest surface, and the material lab
sits on it). Each step: the bench's readback against the GLSL variant on
the same frame, both backends. GLSL stays the default until the last.

## 4i. W0.5b, THE FLAG IS IN — the game boots on WebGPURenderer behind `?tsl=1` (2026-09-13, later the same day)

The user: *"let's do the TSL move right here and now."* What one session could
land honestly is the RENDERER FLAG and the first materials on it; the rest is a
checklist with the GLSL path untouched and default.

**The mechanism (dev.html only; index.html stays the WebGLRenderer build):**
- `tools/build.js` emits the dev page's 143 scripts INERT (`type="text/x-flydiy"`)
  and a loader in their place: `?tsl=1` loads `vendor/three.webgpu.min.js` and
  makes `WebGPURenderer({ forceWebGL: true })` on the page's canvas, `?tsl=gpu`
  asks for the WebGPU backend, `localStorage flydiy.tsl` holds the choice; the
  loader `await`s `renderer.init()` and only then promotes the scripts (real
  copies, `async = false`, order kept). Why: the node renderer THROWS on a
  render before init, and the boot bakes (the PMREM, the impostor sheets)
  render during script evaluation. `?cm=1` flips ColorManagement ON after the
  vendor loads — the colour A/B the ruling is owed, on either path.
- `app.js` takes `window.FLYDIY_RENDERER` when the loader made one and
  publishes `TSL_ON` / `window.FLYDIY_TSL_ON`; every module picks its variant
  on it. The resolve pass steps aside under the flag (the renderer's own MSAA
  draws to the canvas); anisotropy is asked of whichever renderer answers.
- `onBeforeCompile` is silently ignored by the node renderer and a
  `ShaderMaterial` is refused with "NodeBuilder: Material is not compatible" —
  so under the flag every hooked material draws PLAIN until its TSL variant
  exists, and every raw shader needs a variant or a guard before the page can
  even boot.

**Ported (TSL variant beside the GLSL one, chosen on `TSL_ON`):**
- the world's sky dome (`render_world.js skyMatTSL`, from the bench) — one node
  material serves the screen and the PMREM bake; `uniforms` keeps the GLSL
  shape so the rig rows and the F8 panel read and write it unchanged;
- the impostor bake's normal sheet (`normalMatTSL`: world normal, flipped on a
  back face, cut through the material's own map + alphaTest);
- the aeroskin's companion multiply pass (`aeroGlassTint`: fresnel, the tint's
  pass, the alpha — without the weathering's grunge on the pane yet).

**Guarded (no variant yet, the feature is off under the flag):** the graded
hangar backdrop (the room keeps its baked sky picture), the shed's two shadow
prints (`GS.bake` / `CS.bake`, a GLSL blur), the bench's station/rail lattice
diagnostic (normals instead), the resolve pass (off).

**THE CHECKLIST — every GLSL hook in the game path, to port in this order
(each: a same-frame readback against the GLSL variant, both backends):**

| module | hooks | what they do | status |
|---|---|---|---|
| `render_world.js` | 10 + 2 raw | the dome ✔, the normal bake ✔; terrain floor darkening + canopy map + far cascade (Lambert), the water, the ground detail, the impostor DRAW (octahedral lookup, G-buffer lighting, leaf terms), the impostor depth/cover, the clutter | 2 of 12 |
| `trees.js` | 1 | the leaf material: wrap + SSS terms, the AO bake switch, the tint | — |
| `site_ground.js` | 1 | the strip's splat | — |
| `props.js` | 1 | the props' AO/mood hook | — |
| `cabin.js` | 1 | the liner's second normal set | — |
| `hangar.js` | 1 + 2 raw | the floor/walls hook; the grade backdrop, the print blur (guarded) | guarded |
| `editor.js` | 2 | the selection silhouette / x-ray | — |
| `tools/_house_gen.js` | 7 | shadeHouse, cloudWeather, steelMix, the glass, the wander (the village's look) | — |
| `tools/_cage_panel.js`, `_cage_energy.js` | 1 + 1 | the instrument faces, the tank fill | — |
| `aeroskin.js` (+ `aeroweather.js`) | 3 + 1 raw | the skin (livery projector, decals, detail, structure grammar, cabin darkness), the glass, the companion ✔; the 24 weathering layers ride on the skin's hook | 1 of 4 — LAST |

**Traps met today under the node renderer:** a `MeshDepthMaterial` is refused the same way a `ShaderMaterial` is (every custom depth material — the impostor, band and tree depths, the far cascade and canopy passes — is null or off under the flag until ported); a `ShaderMaterial` is an error at
DRAW time, not at construction — the boot looks clean until the object enters
the frame; `renderer.capabilities` does not exist (ask `renderer.getMaxAnisotropy()`);
a `WebGLRenderTarget` is accepted (it extends `RenderTarget`); `PMREMGenerator`
from the WebGPU bundle is the node one and works after init; the dev loader's
promotion means any `window.addEventListener('load')` in a module registers
AFTER the load event — `design_flow.js` checks `readyState` first and is fine,
anything new must too.

**THE COLOUR A/B, AND THE KNOBS (the user, on the pair: "a significant
change… I believe the rendering is better though, but the scenes have also
darkened and colours shifted a lot… can we play with that with sliders? Is
this like Blender where there is a filmic option? As-is I cannot approve").**
Measured on the same states, ColorManagement OFF vs ON: the flight frame
|Δ| 40 codes over 93 % of the pixels (the sky palette, the hemisphere, the
livery all decode darker and more saturated); the shed |Δ| 3 (textures decode
the same either way; only the painted colours move). Three NAMED-STEP rows
joined the GRAPHICS menu (`gfx_settings.js`, both rails): the TONE CURVE —
ACES (today's), AgX (Blender 4's default view transform, the closest thing
to "filmic" three has; Blender 3's Filmic itself is not in three), Neutral
(Khronos), Reinhard, Cineon, linear — live on `renderer.toneMapping` (r186
re-keys the programs itself); EXPOSURE ×0.7…×1.7 as a multiplier on whatever
the mood or the world row sets (the renderer's `toneMappingExposure` becomes
an accessor once, so every existing writer keeps its number); and COLOUR
MANAGEMENT as authored / managed, which stores `flydiy.cm` and reloads (a
colour is converted when it is MADE, so it cannot flip live). The defaults
reproduce today's look exactly; the ruling stays OFF until the user finds
a managed setting they approve. Under managed, the honest fix for "darker" is
the light and the palette, not the curve: the sky dome's hex rows and the
hemisphere/sun colours are the numbers that decode differently.

**The first flagged frames, seen:** one console line from boot through the roll-out (`AttributeNode: Vertex attribute "uv" not found` — a node material on a geometry without uv, harmless) and no error, through
the roll-out; the TSL dome draws the sunset band exactly as the GLSL one; the
aeroplane, the apron, the shed and the strip draw as PLAIN Standard/Lambert
(every hook ignored: no livery projector, no floor darkening, no far cascade,
no room lights' hooks — the shed reads dark); the near trees draw as their
plain material and the impostor tier as flat quads. That is the checklist
above, made visible. The GLSL page is byte-for-byte the same look it was.

## 4j. THE COLOUR RULING, DECIDED BY THE USER'S EYE: MANAGED, CINEON (2026-09-13, evening)

The user played with the rows live and ruled: *"Let's do the switch to
managed, and choose cineon as the default tone curve"* — and, on my starting
to re-author the hand-decoded colours to keep the old look under management:
*"you're overdoing it. I tested as-is and I was happy with the result… let me
complain if I'm unhappy."* So the ruling is taken AS TESTED: three's default
colour management (every hex decoded as sRGB) with Cineon, and NO colour
re-authored — the vendor's footer no longer touches the flag, the pages read
`flydiy.cm = '0'` only to bring the "as authored" reading back for the menu's
step, the presets say `tone: 'cineon', colour: 'managed'`. §4g's colour
paragraph is history from here. What this leaves as it was, deliberately:
`aeroLinear` still calls `convertSRGBToLinear` on a Color that management
already decoded (the liveries the user judged were seen that way), the dome
still writes its palette raw (the sky the user judged). If either ever reads
wrong to the eye, those are the two lines.

**Two things the rows found the same evening.** (1) The exposure step's
first cut made `renderer.toneMappingExposure` an accessor returning base ×
step; the world's rig snapshot read that back and wrote it as the row's
exposure, so every rig/mood write compounded the step — the field shed
"went crazy" (×1.4ⁿ). Now the writers declare a BASE through
`GFX.setExposure(renderer, v)` and the menu multiplies once; the snapshot
reads the base. (2) The shed rail's flyout sat 96 px down with a
`calc(100% - 44px)` height and spilled past the window once the colour rows
joined; `calc(100% - 120px)` now, scrolling.

## 5. RULINGS OWED

- (t) WebGPURenderer/TSL as the world renderer target; the aeroskin port as
  its own chantier.
- (u) The tree spike as the next world chantier, ahead of W1's splat pass
  (the user's stated priority), with a numeric gate.
- (v) The atmosphere taken off the shelf rather than written (§8.4).
- (w) W4's 20×20 km slice as the shipped world until the loop proves itself.
- **(ak) The three.js upgrade (r128 → current) is its own chantier, on
  WebGLRenderer, and lands BEFORE the world's new shader work** (§4b).
  **LANDED 2026-09-13 as W0.5a (§4g): r186. Owed from it: the same-frame
  A/B, the ColorManagement flip, the Lambert IBL — all rulings for the eye.**
- **(al) The solver never moves to the GPU** — determinism and the node gate
  battery (§4d). Recommended as a standing ruling.
- **(am) The solver in a Web Worker** as an independent frame-time chantier,
  unrelated to the backend (§4d). Recommended for the debt register.
