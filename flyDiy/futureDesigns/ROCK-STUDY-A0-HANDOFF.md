# ROCK-STUDY → A0: findings, and the user's go for an in-game test (17 Nov 2026)

**From the user:** they **validate an in-game test** of the ROCK-STUDY result: implement the study's recommendations in the
game, with **screenshots and performance measurements**, **to be shipped before the performance round**.

Branch: `claude/rock-study-2026-11`. Fall-back look: `claude/rock-study-v1`. The full study is
`futureDesigns/ROCK-STUDY-2026-11.md`; sections 5c-5g and 5i are the ones that matter. Nothing has landed in the game.

## What the user approved (the "v1" look)

The bench reference is `tools/rock_study/bench.html?trond=1&tskirt=1.25&scatter=1`. Ledges are OFF: the user dropped them.

1. **The island's own rock (trondhjemite).** Two baked tile materials from `tools/rock_study/trond_gen.py`:
   - slab: joint network with T-junctions, for rock under ~50°;
   - face: water-polished sheets and streaks, for cliffs.

   Colour, normal and roughness all come from one height field per material. A weathering pass on top: dirt, grime drips,
   lichens, sandstone-leaning colour.
2. **The large-scale (macro) layer.** Four joint sets, vein-bounded formations, wet streaks down the real fall line, and
   the EXPOSURE mosaic: rock on the high, convex, steep ground; vegetation down the drainage and in every pocket.
3. **The rock mesh.** A 1.25 m ring within 450 m, displaced only where rock is exposed. It carries the macro relief plus
   the user's Blender "Cliff-Rock" recipe, transcribed node for node, softened and soft-clipped. `blend_nodes.py` reads a
   .blend without Blender.
4. **Green growth** fills the low spots first: joints, crack texels, hollows, upward faces, crevices.
5. **PBR micro detail.** The game's own `cliff` layer, hex-tiled, adding brightness and normal only, faded out by 180 m.
6. **Roughness.** Bare stone 0.4-0.5; cliff faces 0.38, wet streaks to 0.2; everything green or dirty 0.9-1. It needs the
   sky probe, which the game's near ring already has. Specular anti-alias by pixel footprint.
7. **Scattered 3D rocks.**
   - +55 % over the cover ring's rules, plus a BIG class (2.5-5 m) in packs.
   - Seated on the DISPLACED surface (a plane fit, then the deepest hollow, then a sink of 30-45 %).
   - Triplanar material, so no UV smear.
   - LOD rungs by vertex clustering: ~400 / 245 / 100 triangles, real geometry to 2 km.
8. **Vegetation placement maps** for the subalpine-biome session: `reports/evidence/ROCK-STUDY/vegmaps/` (README inside).

## What the in-game implementation must solve (from the study's audit, 5g)

- **The macro must be PROCEDURAL island-wide.** It can't be baked: the bench's 2 km at 0.78 m does not scale to 39 km.
  The joints are warped line sets (a hash per band) and the exposure is a function of 10 m fields. Probably one new 10 m
  channel (flow + curvature) in the island packs.
  - The bench showed what happens outside a bake: bare white tiles with a repeating dash grid (the user's red circle).
  - Keep the far fade (tiles give way to their mean past 400-1200 m).
- **Samplers.** The near ring is at 12/16 (GATE SPLAT --gpu). The bench path adds 7; the game must add ≤ 4 (two 1024²
  arrays for the slab/face pair, a packed macro), or 0-1 with the procedural macro.
- **Cold compile (ANGLE/D3D11).** The bench path adds ~33 fetch sites; the micro detail alone is 18. Make the micro
  detail one plain biplanar fetch pair, add a lean phone variant, and measure with `tools/perf/cold_links_bench.js`.
- **Build.** The rock mesh (0.8-2.2 s) and the scatter (0.6-0.9 s) must be chunked in a worker, like the cover ring
  (64 m chunks).
- **Triangles** (bench, near view): the rock ring 0.5-0.6 M + blocks ~1 M with LODs (+ the shadow pass). Phone tier:
  2.5 m ring at 250 m, shorter rock rings, no micro detail, ~0.3 M estimated.
- **Memory.** The tiles at 1024², as KTX2 (~5 MB), not 2048² raw (85 MB).
- **Untouched by design:** forest, heath, muskeg, beach, shingle, built ground, water, and the raster's snow class.

## Measured on the bench (SwiftShader 1280 x 720, no shadows; ratios, not phone ms)

| | reads/px | ms | triangles | draws |
|---|---|---|---|---|
| today, near | 23.1 | 3259 | 0.32 M | 2 |
| v1, near | 43.6 | 4643 | 1.92 M | 42 |
| v1, face | 32.7 | 4792 | 1.72 M | 42 |

The rock material alone is 13 reads/px against today's 39 on a face. The camera eyes for GPU before/after shots are in the
study's section 3.

## The user asks for

An in-game test with screenshots (before / after at those eyes) and performance measurements (GPU and phone: frame time,
triangles, draws, cold link time, samplers), with the recommendations implemented, shipped **before the performance
round**.
