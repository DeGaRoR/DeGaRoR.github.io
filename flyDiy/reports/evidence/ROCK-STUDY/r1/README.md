# ROCK-STUDY R1: the island's own rock on the splat (ready for the GPU and phone run)

Branch `claude/rock-study-r1`, three commits on master fb8fb633b (L40d): the source, the gate re-pins and the (built) commit.
L40e had not landed when this was cut, so the rebase follows it.

## The dial

- `?rocks=0` at the load: today's ground. The recipe's rock and cliff sets are drawn, no terrain bias is computed and the two
  new layers are not fetched.
- `?rocks=1` or no parameter: R1 (the default).
- Live: `WORLD.ground.splat().rocks(0|1)`, or F9 > **rock & cliffs** > "the island's rock" on/off. The dial is a uniform, so
  no program re-keys.

## The eyes (world x, y, z; Mount Ardent, Jolene)

| view | pos | target |
|---|---|---|
| face (230 m) | 9727.5, 843.1, -4788.2 | 9780, 793.1, -5020 |
| near (110 m) | 9762.8, 798.1, -4910.7 | 9780, 798.1, -5020 |
| high (~800 m out, 600 m up) | 9380.4, 1369.9, -4596.3 | 9807.6, 769.9, -5073.3 |
| far (the summit at 1.2 km) | 8640, 1175.1, -4590 | 9490, 815.1, -5440 |

## The stills here (`*_off_vs_on.jpg`, top `?rocks=0`, bottom `?rocks=1`)

- They are made by `tools/rock_study/ground_shot.js`, which drives `ground_bench.html`.
- **The game's code:** `splat_ground.js`, the ground library and the cooked layers, unmodified, on Ardent's own ground inputs:
  pack A, pack B with NDVI and terrain type, and the tint with R1's bias in its alpha (`export_gpatch.js`).
- **The glue:** render_world's map_fragment hook, copied.
- **The headless renderer:**
  - It is SwiftShader, and it compiles only the **lean** program (`SPLAT_ONE`).
  - The full program runs SwiftShader out of memory (13 GB) at link time, and **master's does too**: a box limit, not an R1 regression.
  - R1's text is in both programs.
- **The light is the study bench's** (hemisphere + sun, ACES), not the game's light rig or atmosphere. Read the stills as
  "off vs on", not as the game's final look.

## Costs

- **Samplers: +0.** The tiles are two layers of the existing `uSplat` / `uSplatN` arrays. The micro detail reads the existing
  `cliff` layer and the green the existing `grassRock` layer. The bias rides `uGTint`'s alpha (it was 255 and never read). The
  NDVI comes from `uGPackB`.
- **Arrays:** 13 -> 15 layers on the Ardent patch's sets. `cliff` and `grassRock` were already reachable, so only `trondSlab`
  and `trondFace` are fetched new: 1.27 MB of KTX2 (kAl + kN), or 3.3 MB of raw layers in the fallback.
- **Main thread at the load: `rockBias()` ~90-130 ms** (node, 1024² hydrology grid, two box blurs, measured three times). In
  the game it is `window.ROCK_STATS.biasMs`. It runs once, is cached, and is skipped on `?rocks=0`. No worker yet; it could
  move to one if A0 wants the ~0.1 s back.
- **The shader:** `sTrond` is inlined ONCE a pixel, before the candidate loop (GATE SPLAT's R1 rule). It does up to
  8 sample pairs where rock shows (slab 3, face 2, micro 2, green 1), plus the joints' ALU. It costs nothing where the
  exposed rock weighs under 0.004. **Its cold link and frame cost on D3D11 are the GPU run's to measure** (`node
  tools/_splat_check.js --gpu`, ground_cost.js).

## What to read

- `src/viewer/splat_ground.js`: R1's header, then `sTrJoints` / `sTrExpo` / `sTrond`, the exposure in both vote paths,
  the single call before the candidates, and `push()`'s rock block.
- `src/viewer/render_world.js`: `rockBias()` before `tintRGBA`.
- `src/core/28b_ground_fields.js`: the `rock*` knobs.
- `src/viewer/world_rail.js`: `buildRock`, in the **rock & cliffs** section.

## The world rail (A0's ask, the user will tune it)

F9 > **rock & cliffs** has these rows:

- on/off and brightness;
- the exposure: rock shows from / fully by (m), the map's rock weight, the threshold, the imagery's green and its NDVI midpoint;
- joints, green and wet: joint density, soil in the joints, joint dirt, hollow dirt, green in the cracks, wet streaks;
- roughness: bare stone (x the tiles' maps), the green;
- micro detail: on, brightness, relief, fades from / gone by; and the far fade from / full by;
- each tile's grade and recolour (the materials editor);
- **reset the rock**.

Every row is a splat knob, so it is kept as the other ground rows are: `flydiy.ground.splat.v1`, the export's `splat` block
and its "changes" against the recipe.

## Gates

`node tools/run_gates.js --no-build` on this tree:

- **PASS:** SPLAT, GROUNDLIB, KTX2, MATLIB, GEO, FADES, PREMISES, WORKBENCH, COMMITHYGIENE, LOOKS, LIGHT, GEOPARITY, UISMOKE.
- **MEDIA, master's:** `career_core` 654 KB against 640 KB. It is master's identical `career_core.713f1a62.js`; R1 does
  not touch it.
- **SCENERYED 20b, master's on this box:** a wall-clock row. Master's archive measured 2713 ms against 2500 here, this tree
  2994 ms; the row is the town's compose and does not read the splat.
- **Not run:** SPLAT `--gpu` (needs Chrome on the island). It is the GPU slot's.
- **Re-pins**, in their own commit:
  - GROUNDLIB `--update`: the two new sets' fingerprints.
  - KTX2 `MEANM_ALLOW`: `trondFace.kAl` 2.7. Its 4 x 4 mip is blue 2.56 against 2.5, in one UASTC block; RDO lambda 0.5
    gave the same.
- **New rules in SPLAT:**
  - the rock knobs' ranges and order;
  - the arrays' reach includes R1's four sets;
  - "R1: the island's rock inlined once a pixel";
  - the decode rule pinned to the fetch's own line.

## Known, for the eye on the GPU

- The two regional joint sets (24-25 m apart) still draw as long, faint curved lines at ~1 km. Joint dirt and density are
  rail rows; lowering the dirt is the quick lever.
- From altitude, bare rock reads lighter than the study's v1 still. Brightness is `rockK` 0.5; the game multiplies the ground
  by `uGLight` 1.38, which the study bench did not.
- R1 is texture only. v1's relief (the 1.25 m mesh ring) is R2, and its boulders are R3.
