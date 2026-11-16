# ROCK-STUDY: the island's rock, delivered whole (material + relief ring + boulders)

Branch `claude/rock-study-r1` on master fb8fb633b (L40d); the rebase on L40e follows when it lands. **On by default.**
`?rocks=0` is the cost A/B. It turns off the material and the ring, links master's ground program, and skips the bias.

## What is in the game now

1. **The material** (splat_ground.js, the v4 path).
   - The trondhjemite slab is the rock codes' own set; the recipe's aerial sets are the far ground.
   - The exposure: height, slope, convexity, drainage and the map's rock share.
   - The joints, the green, the micro detail, the roughness.
2. **The relief ring** (new: `src/viewer/rock_ring_core.js` + `rock_ring.js`).
   - Ported from the bench v1's macro (trond_gen.py) and its 1.25 m skirt:
     - the regional joints, the formations and grooves;
     - the exposure: v1's law, with D8 drainage on the hydrology's heights;
     - the Blender 'Cliff-Rock' masses, rounded and smoothed.
   - Built in a WORKER in 62.5 m chunks within 450 m of the eye, nearest first.
   - The outcrops rise out of the ground; narrow gaps (gullies) stay on the outcrop as green.
   - The relief folds back under the ground toward the ring's edge.
   - Its own material is v1's sTrond, read from vertex attributes and the splat's arrays. It is a separate program: the ground
     programs' link is not touched.
3. **The boulders.**
   - v1's scatter, per chunk in the same worker:
     - talus at the foot of faces;
     - clusters on rocky slopes;
     - blocks at the rock's edge;
     - a rare big class.
   - Seated on the displaced surface: the lowest point under the footprint, sunk 30-45 %.
   - Three LOD rungs by vertex clustering. They are merged into the chunk's mesh: one draw a chunk.
   - The kit is the tree pack's `rocks` collection.
4. **The phone tier.** The GRAPHICS row's lean ground gets a 2.5 m ring within 250 m and no micro detail; the plain ground gets
   no ring.
5. **The world rail.** F9 > rock & cliffs has every rock setting, including the new 'outcrops and boulders' section: on, reach,
   outcrop lift, masses, stand-off, boulders on, boulder density. They are splat knobs, so they persist and export with the
   rest.

## The pictures

`*_v1_vs_game.jpg`: left v1 (the study bench, approved 17 Nov), right the game's modules on the same eye. Headless renders on
SwiftShader with the study bench's light, the lean ground program.

| eye | state |
|---|---|
| face | matches: the same slab field, relief, green mosaic and boulders |
| near | matches: the same shadowed slabs; ours a little whiter, v1 a little greener |
| high | matches in character: the same rock-and-green speckle; the open ground is the game's heath green (v1's bench had an olive stand-in) |
| slope | close: the same outcrops and boulders; ours whiter, with less green |
| ground (eye at 2.2 m) | **differs**: the cover's edge stands as a thin overhanging sheet where the ground falls away - being fixed |

## Costs (measured on this box, or estimated)

- **Worker** (off the main thread): 60-250 ms per chunk (relief + boulders), so ~15-45 s of worker time to fill the whole
  ring, nearest chunks first. The bias + D8 flow worker, in the soft boot: 805 ms in the worker, 4.9 s wall.
- **Main thread:** ~1.5-3 ms per chunk (the inputs sampled on a 2.5 m lattice, the geometry made), at most 2 chunks a frame.
  The bias: 11 ms, plus 118 ms when it lands late.
- **Triangles within 450 m:** 1.0-1.9 M. At the near eye: 1.81 M, of which 1.06 M are boulders.
- **Draws:** one per chunk with rock, 140-195 within reach before frustum culling, the same again in the shadow pass.
- **Link:**
  - The ground programs are as v4 (A0 measured +8.8 s on the ring program for the splat path).
  - The rock ring's own program is new and unmeasured. My estimate is a few seconds on D3D11: about 9 sample pairs, no loop.
    It links when the ring first draws.
- **Samplers:** +0 on the ground programs.

## Gates

`--no-build` after a build:
- **PASS:** SPLAT, GROUNDLIB, KTX2, MATLIB, GEO, FADES, PREMISES, WORKBENCH, LOOKS, LIGHT, GEOPARITY, UISMOKE,
  COMMITHYGIENE.
- **MEDIA:** red on master too (career_core 654 KB, the same file).
- **The game boot:** soft_still.js on Jolene reached the stand with no page error. The potato tier there has a plain ground,
  so no ring was drawn; the bias worker ran.

## Known, being worked on after landing

- The ground-level sheet at the cover's edge.
- The rock a touch whiter and less green than v1 on the slopes.
- The rock ring's link time is unmeasured.
- The boulders' draw and triangle budget wants the perf round.
