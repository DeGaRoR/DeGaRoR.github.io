# ROCK-STUDY: the island's rock, delivered whole (material + relief ring + boulders)

## Update 16 Nov, late: the blend with the grass, the face tile plain, rebased on L40e

- **The blend** (the user: "we have a value issue - the new grass is a lot darker than the grass you had used"). v1's bench
  drew its green as grassRock x (0.78, 1, 0.62). The game grades it by the imagery (~0.26 / 0.47 / 0.90): about half the
  value, and bluer.
  - The rock now scales by that ratio to a dial ('value to the grass', 0.5).
  - A film of the grass's hue sits on the stone ('weathering film', 0.25).
  - `slope_blend_ABC.jpg` (the bench): A today, B the defaults, C v1's exact proportion with a 0.4 film.
- **The face tile is plain** (the user's circles: the dark dashes). Its water streaks were hex-turned into chevrons; they now
  run down the fall line, as v1 drew them.
- **Merged on L40e** (origin/master 2157a2f98). GATE LOOKS check 5 (the cover ring and the drawn water) is red on master
  L40e too.
- The `*_v1_vs_game.jpg` pictures are the macro-texture state, before the blend and the face fix. The bench is not the game:
  the in-game stills (A0's GPU run) are the judge.

## Update 16 Nov, night: v1's macro TEXTURE, the boulders' footprint, the rock's textures in the editor

**Why the far render was patchy (the user: "terribly patchy, unacceptably downgraded").** v1's ground read its macro (the
joints' lines, the formations, the colour zones, the exposure, the green's chance, the height) from a 2560^2 TEXTURE at
0.78 m, a pixel at a time, mip-filtered with distance. It also faded the tiles to their mean from 400 to 1200 m, which only
works because that texture keeps the variation. The first port carried the macro per relief VERTEX only (1.25 m, to 450 m).
Beyond that it fell back to a procedural stand-in under the same fade, which gave flat, blotchy patches and no lines.

- **The macro texture, ported** (`rock_ring_core.macroTile`, `rock_ring.js` MT, `splat_ground.js` sTrMac / sTrE).
  - v1's law per texel, in a worker of its own.
  - Three levels round the eye, in ONE texture array (+1 sampler on the near ring and fine programs: 14 on the lean program,
    measured):
    - 1 m to +-512 m;
    - 2 m to +-1 km;
    - 4 m to +-2 km.
  - v1's channels: mult / 1.5 + exposure; normal x z, green, height.
  - Toroidal: a move of the eye recomputes only the tiles that enter.
  - The vote takes its exposure (v1: the macro over the raster), and sTrPost its colour, green, height and normal. On the
    relief it replaces the vertex values.
  - The joint grooves widen to the texel at the coarse levels and keep their share, as v1's mips averaged them.
  - About 19 s of worker time fills all three levels, nearest first. The lite programs (outer ring, premises) are untouched.
- **The boulders' count (the user: "very little of them in game. Do you have the same sort of settings?").**
  - The settings ARE v1's: the same law, x1.25, and the same reach by size (small 250 m, mid 450 m, big to 2 km).
  - The difference was the shape. v1 drew the tree pack's scanned paving blocks, 1.4-3.6 x as wide as tall (capped at 2.6).
    The closed procedural rocks are ~1.4 x. Same count, about a third of the ground covered.
  - A closed rock now takes the width of the scan v1 would have drawn.
- **The editor (the user: "part of the editor ... so I can tune or change these textures myself").**
  - F9 > rock & cliffs > "the rock's textures" picks the four sets R1 wears from the library: slab, face, micro + the
    boulders' stone, the green. They are stored on code 6's row, so they persist and export with the codes.
  - Each set has the materials' own grade and recolour editor.
  - The boulders follow the slab's grade, with their own 'boulder tone' and 'boulder contrast' rows.
  - The 'macro texture' toggle carries a live note showing each level's coverage.

Cost of the macro texture: 1024^2 x 6 layers RGBA8 = 24 MB of CPU copy (the layer uploads) and ~32 MB on the GPU with mips. On
the phone tier it is unmeasured and wants the perf round (a 512^2 level set is the obvious cut).

Still open: the joint lines read softer than v1's past ~500 m. Our 2 m level is coarser than v1's 0.78 m texture at that range.

## Update 16 Nov, evening: the faithful v1 port (the user: "go for faithful V1 implementation")

- **The relief wears the ground's own material**, as v1's skirt did.
  - Every terrain type's PBR sets, hex-tiled and height-blended against the rock: no more flat green "mask" on the outcrops.
  - The macro computed in the worker reaches the splat through vertex attributes: the colour multiplier, the green's chance,
    the exposure, the height and the masses' crevices.
  - The same program as the near ring, so no new link.
- **The boulders are CLOSED rocks**: the study's procedural kit, boulder and block archetypes, three rungs of one shape. They
  wear v1's rock material: the cliff photo triplanar through its own grade, the trondhjemite's mean, creases, moss, the foot.
- **v1's far layer**: big blocks out to 2 km (a 6 m grid at 9 x the odds), v1's LOD ladder.
- **The micro detail** is v1's: the cliff photo, hex-tiled and triplanar.
- **The green** in the rock and on the boulders is the game's own grass, graded as the game grades it. The user: "use the same
  textures as the game already uses".
- **Every look value is back to v1's.** The v2-v4 notes were the coordinator's, not the user's. The tiles are raw, a touch
  greyer (sat 0.8; the user: "greyer, but not as much, and not as dim"). Also back to v1: slab 16 m and face tile 24 m, v1's
  four joint sets, wet, dirt, micro and green values.
- **The pictures below are this state.** The grass is the game's own green (v1's bench used an olive stand-in).

### Still open

- The ground eye at 2.2 m: the near slab is softer than v1's 1024² tile (the game's layers are 512²).
- The slope's boulders read smaller and paler than v1's.


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
