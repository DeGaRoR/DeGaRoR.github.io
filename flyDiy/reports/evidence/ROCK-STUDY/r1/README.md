# ROCK-STUDY R1 (v4): the island's own rock on the splat

## v4 (answers A0's box run of v3, b8d68316e: high and far good; near and face "too smooth, concrete-like")

Only the near look changed; everything else is v3.

- **The slab's grade:** contrast 0.6 -> 1.0, and the slab tile 32 -> 24 m.
- **Micro detail:** brightness 0.65 -> 0.85, relief 0.6 -> 1.0, and its fade moved out to 80-260 m so it reaches the near
  eye.
- **More green in the cracks:** `rockGreen` 1.8, and the cracks' weight 1.2.
- **New: each slab its own.**
  - A tone swing and a tilt of the shading normal.
  - The tone is per cell of the joint network (a hash on its two band indices), plus a 6 m / 2.3 m undulation inside the
    cells. The tile's own blocks, 5-13 m, are too small for the network's 38-46 m cells to break up alone.
  - The tilt is per cell plus a 9 m undulation, so the sun picks out facets.
  - Both fade with the joints (gone by 600 m).
  - New rail rows: "slab tone swing" (0.3) and "slab tilt" (0.1).
- **Geometry:** R1 adds none. Its only changes outside the shader are the tint's alpha and the defines. The 9.91 M against
  8.24 M triangles on the box came from the boot.


## v3 (answers A0's box run of v2, 7b10f6330)

The look regressed in v2. Close in it read as pale tan with a dense dark crack web ("cracked dried mud"); from high and far
it was flat beige smears. The island-ground step also waited 0.86 s for the bias.

- **The black crack web was the tile's normal at x3.**
  - The chain multiplies every set's relief by `nrmK` (3), which was made for the old aerial sets' weak normals.
  - `sTrPost` now divides it back out: the tile's relief is at its own scale, as v1 had it.
- **Grey, not tan.**
  - The recipe grades the slab and face tiles `gain #d4d4d0, sat 0.3, contrast 0.6 / 0.7` (the chain's own grade;
    master's rock sets are graded grey the same way).
  - `rockK` is 0.8.
  - The tiles' grooves are lifted toward dirt, not black.
- **The slab at 32 m** (the steep tile at 40 m): the tile's own joints read 5-13 m apart, not 2.5-6.5 m.
- **The joints are sparse slab edges.** Two sets, 38 and 46 m apart, a gentle warp, long open runs, and 6 lines in 10
  drawn. They are gone by 600 m.
- **The green mosaic in the cracks is back:** `rockGreen` 1.5, and the tile's cracks weigh 0.9.
- **Far: a textured far set, not a mean.** Only the rock codes' NEAR sets switch to the slab; the far triplet stays the
  recipe's (code 6: `cliff` at 79 m, code 12: `rocksB` at 120 m), with the macro mosaic and the green over it. The fade
  to the slab's mean is off by default (`rockFarFrom` 6000 m; the row stays).
- **The bias does not hold the step any more.**
  - If the worker has not landed, the tint goes up with a neutral alpha (191 = bias 0).
  - The bias is written in when the worker lands, and the tint is re-uploaded once.
  - `ROCK_STATS.biasLateMs` is the main thread's part; `biasWaitMs` is gone.
  - Tested in Chromium: `onDone` fires once and the bytes equal the main thread's.
- **Link:** unchanged from v2. The GLSL grew by a few lines of ALU and the same three plain reads.


Branch `claude/rock-study-r1`, on master fb8fb633b (L40d). L40e had not landed when this was cut; the rebase follows it.

v2 answers A0's box run of v1 (8e12b1b04, 16 Nov). v1 linked every ground program about 15 s slower, its terrain bias took
246 ms on the main thread, and close in it read as dark vertical stripes.

## What changed from v1

1. **R1 rides the material chain.**
   - Under the dial, `push()` points the rock codes' own sets at the tiles: code 6 wears `trondSlab` at 16 m. Code 12 (the
     steep split, 42-58 deg under the dial) wears the slab at 24 m, or the face tile if the rail's "on the steep faces"
     pill asks for it. The hex tiling, the triplanar, the far set, the grade and the recolour are all the chain's own.
   - R1's own fetch chain is gone: no `sTrond`, no `sTrTap`, no extra inlined `sFetch`. The material chain is back to 3
     `sFetch` sites.
   - What R1 adds itself:
     - `sTrExpo`, the exposure: once a pixel, in the vote;
     - `sTrPost`, on a rock candidate's sample: the far fade, the micro detail, the macro colour, two cheap joint sets and
       the green;
     - three plain texture reads: the micro's colour and normal, and the green's colour.
   - `GS_TRLITE` (the outer ring and the premises patch) leaves the micro and the joints out.
   - The splat GLSL without comments, over master: v1 was +9.0 KB, plus seven inlined `sFetch` bodies; v2 is +5.2 KB
     (+4.3 KB lite), with nothing inlined twice.
2. **`?rocks=0` links master's program.** With the dial off at the load, the programs carry `GS_NOTROND` and key apart
   (`:norock`). A live turn re-keys them once.
   - For the box's bisect: `?gstrip=notrond` (R1's text out) and `?gstrip=trlite` (its lite text everywhere).
3. **The terrain bias is in a worker.**
   - `rockBiasStart()` starts it at the build's first line. The 'island ground' step takes the result, or yields until it
     arrives.
   - `window.ROCK_STATS` reports `biasWorkerMs` (inside the worker), `biasMainMs` (the post and the copy back),
     `biasWallMs` and `biasWaitMs` (the step's wait, 0 when it was ready in time).
   - Measured in headless Chromium on a 1024² grid: the worker's output is byte for byte the main-thread function's.
     The main thread spent 10 ms; the worker 492 ms, on this busy CPU.
   - No Worker (node, a gate's stub): the step makes it on the main thread, as before.
4. **The look.**
   - The face tile's vertical streaks are off the steep faces by default: the slab, on the triplanar's side planes, reads
     as jointed slabs.
   - Wet streaks are down to 0.2 by default.
   - The joints are two sets, about 18-21 m apart. They are anti-aliased to the pixel and gone by 450 m ("joints gone by").
   - The green's saturation is down to 0.6 ("green's saturation"), which holds the lichen's yellow down.
   - Bare stone turns matte from 250 to 900 m, against the bleaching seen from altitude.
   - The far fade now goes to the slab's graded mean.

## The dial

- `?rocks=0` at the load: today's ground. Master's program text, no bias computed, no new layers fetched.
- Default: on.
- Live: `WORLD.ground.splat().rocks(0|1)`, or F9 > **rock & cliffs** > "the island's rock". A live turn re-keys the ground
  programs once.

## The eyes (world x, y, z; Mount Ardent, Jolene)

| view | pos | target |
|---|---|---|
| face | 9727.5, 843.1, -4788.2 | 9780, 793.1, -5020 |
| near | 9762.8, 798.1, -4910.7 | 9780, 798.1, -5020 |
| high | 9380.4, 1369.9, -4596.3 | 9807.6, 769.9, -5073.3 |
| far | 8640, 1175.1, -4590 | 9490, 815.1, -5440 |

## The stills here (`*_off_vs_on.jpg`, top `?rocks=0`, bottom `?rocks=1`)

They come from `tools/rock_study/ground_shot.js`: the game's `splat_ground.js` and ground library on Ardent's own ground
inputs, render_world's map_fragment glue copied, and the study bench's light. SwiftShader links only the lean program (the
full one runs it out of memory, master's too), so read them as "off vs on", not as the final look.

## Costs

- **Samplers: +0.** The tiles are layers of `uSplat` / `uSplatN`. The bias rides `uGTint`'s alpha, and the NDVI comes from
  `uGPackB`.
- **Arrays:** two new layers (trondSlab, trondFace): 1.27 MB of KTX2.
- **Main thread at the load:** about 10 ms for the bias (the worker does the rest).
- **Link and frame cost on D3D11:** the box's to measure. The bisect: `?rocks=0` against `?rocks=1`, and
  `?gstrip=notrond` / `trlite`.

## What to read

- `src/viewer/splat_ground.js`:
  - the R1 header;
  - `sTrLine` / `sTrJoints` / `sTrExpo` / `sTrPost`;
  - the exposure in both vote paths;
  - the `sTrPost` call after `sMatPass` in both candidate loops;
  - `push()`'s rock block, which overwrites codes 6 and 12;
  - `api.rocks` and `stripDefs`.
- `src/viewer/render_world.js`:
  - `ROCK_BIAS` and `rockBiasStart` (above the steps), the job at the build's first line, and the wait at 'island ground';
  - `GS_TRLITE` on the side-0 hooks.
- `src/core/28b_ground_fields.js`: the `rock*` knobs.
- `src/viewer/world_rail.js`: `buildRock`.

## The world rail (F9 > rock & cliffs)

- **The rock:**
  - on/off and brightness;
  - slab tile (m), steep tile (m), and on the steep faces: slab or face tile;
  - steep from / fully by (deg);
  - the exposure: shows from / fully by (m), the map's weight, the threshold, the imagery's green and its NDVI midpoint.
- **Joints, green and wet:**
  - joint density, soil in the joints, joint dirt, hollow dirt;
  - green in the cracks, wet streaks, the green's saturation;
  - joints gone by (m).
- **Roughness:** bare stone (x the tile's map), the green.
- **Micro detail and fades:**
  - micro detail on, its brightness, its relief, fades from / gone by (m);
  - the far fade from / full by (m).
- **Each tile:** its grade and recolour.
- **Reset the rock.**

These are splat knobs, so they persist as the other ground rows do: `flydiy.ground.splat.v1`, the export's `splat` block and
its changes.

## Gates (this tree, `--no-build` after a build)

- **PASS:** SPLAT (the new R1 rule: "the rock rides the material chain - its own functions call none of it, sTrPost once,
  sTrExpo once, no loop, <=3 plain texture reads"), GROUNDLIB, KTX2, MATLIB, GEO, FADES, PREMISES, WORKBENCH, LOOKS, LIGHT,
  GEOPARITY, COMMITHYGIENE.
- **MEDIA, red on master too:** `career_core` 654 KB against 640 KB. The file is identical to master's.
- **UISMOKE and SCENERYED:** run on v1, untouched since except world_rail rows. SCENERYED 20b is red on master on this box
  (wall-clock).

## Known

- R1 is texture only. v1's relief (the 1.25 m mesh) is R2, its boulders R3: close in, the bench v1's shadowed slabs need R2.
