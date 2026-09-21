# TERRAIN FOLLOW-UP — after the alpha-splatting chantier (2026-09-21)

The pick-up document for the next terrain session. The chantier (G438, G438.1,
HANDOVER) landed the island's ground drawn by terrain type from a library of
seventeen sets, on the bench (`tools/_island.html`) and in the game
(`src/viewer/splat_ground.js` in the island ground hook, F8 > map layers >
splat). This lists what it left owed, in the order the user's eye will meet
them, with what is known about each. Nothing here is started.

## Where things are (read first)

- **The recipe is ONE table**: `src/core/28b_ground_fields.js` `RECIPE`
  (codes: near/far sets, scales, mask, variation, orient, para; knobs; grades;
  the library order). `CODES[ttype]` is derived from it; the vegetation
  (`28c_biomes.js`, `cover_ring.js`) reads the rows. Change the table, both
  sides move. The bench's `export` and F8's `export` print a browser's copy -
  paste it into RECIPE to make it the default.
- **The library**: `assets/alphaSplat/*.gltf.zip` (Poly Haven) ->
  `tools/splat_tex_import.py` (py -3.11; the scale off the pack's preview
  sphere, heights integrated from the normals, means) -> `assets/splat/` ->
  `tools/splat_tex_prep.js` -> `media/tex/splat/` + `src/viewer/splat_tex.js`.
  Add a set: import, append to `RECIPE.library`, re-bake, GATE MEDIA.
- **The map**: `tools/island_prep.py` (10 m and 5 m grids), the shore band
  (shingle / sand / cliff), the terrain type `ttype` with codes 0-11; 12-14
  derived in the shader (and on the CPU by `deriveCode`).
- **The rigs**: `tools/island_bench_shot.js` (the bench, headless, prints the
  compile status), `tools/island_shot.js --boot 45000 --tries 20 --wait 60000
  --eval` (the game, headless), `tools/sampler_census.js` (units per program
  off the GL program), `tools/_glsl_probe.html` (fxc bisect), `tools/
  splat_sheet.py` (the colour cascade per code). The pictures of the chantier
  were under the worktree's `bench/` (gitignored) - not kept unless copied.
- **The rules on ANGLE/D3D** (HANDOVER G438): implicit `texture()` only on a
  `sampler2DArray`, loop bounds as uniforms, one struct through the chain, no
  sRGB array upload (decode in the shader), backticks never in a GLSL comment.
- **Samplers**: near ring 10, outer ring 14, premises patch 15, of 16. Census
  before adding one.
- **Serving a worktree**: `node flyDiy/tools/_serve.js <port> . --fallback
  D:/Dev/DeGaRoR.github.io`. NEVER a junction into a worktree (bench/ was wiped
  twice on 2026-09-20 by a landing that removed one).

## 1. The ring as a Standard material (the pools, the roughness)

The near and outer rings are `MeshLambertMaterial`. The splat carries a
roughness per set (the normal array's alpha) and the muskeg pools set it to
0.03, but a Lambert has nowhere to put it: the pools read as dark slate, the
wet mud and the bare rock never catch the sun, the beach at low light is
matte. Switch the island rings to `MeshStandardMaterial` with the splat's
roughness written into `roughnessmap_fragment` (the hook already computes
`gSRough`), metalness 0, the environment the world's probe.

- Cost: a Standard program is heavier than a Lambert; measure the frame with
  `tools/tree_perf.js` before and after on Jolene. The sampler count rises by
  `envMap` + `dfgLUT` (+2): the premises patch would stand at 17 - so either the
  patch keeps its Lambert (it draws pavement) or the canopy hook's four fold
  into an array first. Census.
- The stack's `light`/`sat` knobs and the macro exposure assume the Lambert's
  response; re-measure the near/far luminance (the scratch `measure.py` recipe
  in HANDOVER G438.1) after the switch.

## 2. The fine ring under the aeroplane (5 m geometry near the eye)

The game's near ring is a 512x512 plane over the inner disc: 17.6 m chords.
The true surface is 5 m (the quadtree's leaves, which the bench draws). This
is behind three things the user has seen: the ring riding above concave
ground (G434.1's clipping, mitigated by sinking it 4 m under the premises
patch), the lakes' two blues (G438.1: the ring's chords through the surface
quad - fixed by discarding the ground inside the line, but the cause stands),
and every silhouette within a few hundred metres. A fine disc around the
camera (the quadtree's own leaves, re-centred as the aeroplane moves)
replacing the coarse ring there, with a seam the LOD already knows how to
sew. A proper chantier: the shadow near-pass, the premises patch's
relationship, the streamer's budget (`tree_perf.js` is the instrument).
Displacement from the sets' heights (vertex or parallax) is only worth
anything once this exists - see 6.

## 3. GATE SPLAT

Nothing gates the splat today. A gate that (a) checks `RECIPE`'s shape - every
code's sets exist in the library, scales positive, the far slots either a set
or null, the knobs in their ranges, `CODES` derived cleanly; (b) checks the
manifest against the media store (GATE MEDIA already lists `splat_tex.js`;
this is the reverse: every `RECIPE.library` key has three files); (c) runs
`sampler_census.js` headless on Jolene and asserts the three island ground
programs at or under 16 with the current counts as the ratchet; (d) compiles
the bench's fragment shader through `_glsl_probe.html` and asserts no fxc
internal error (the trap that killed the pane's GPU process). (c) and (d) need
Chrome; the runner has precedent (UISMOKE).

## 4. A rock-beach set

`11 shingle` draws `pebble` (the lot's Gravel022, pale) + `rocksG`. The user
asked for a rocky beach; Poly Haven's `coast_land_rocks_01/02` and
`coast_sand_rocks_02` are the candidates (any of them imports through
`splat_tex_import.py` unchanged - the `_col_` naming is handled). Then the
sand-vs-rock choice at the shore is the map's (the shore band's NDVI rule
today) or a knob; the user wants both kinds visible on Jolene.

## 5. The rare aerials, the grades, the user's eye

- Muskeg and sand borrow aerials (`grassRock`; the beach at both ranges). A
  peat / moor aerial and a wet-sand one would be truer than the macro tint
  covering for them.
- The grades (`RECIPE.grade`: dry, snowAir, rockyB, cliff, grass, lush) were
  set from `splat_sheet.py`'s numbers and one evening's eye. The user's own
  pass in the game, code by code with F8's picker, is owed - and its `export`
  pasted back into RECIPE.
- The forest floor is `forestAir` (aerial rocks 04) near and far since G438.1
  (the user's call); `leaves` is in the library unused - a detail forest floor
  under the aerial at the last 50 m may come back once the fine ring exists.
- A per-hex-cell brightness/hue jitter (MicroSplat's "stochastic height",
  Terrain3D's detiling) is one line in `sTile` once the sets are settled: the
  anti-tiling step the survey listed and the chantier skipped.

## 6. Displacement

Answered on 2026-09-21: no real displacement exists. The sets' heights are
integrated from their normal maps (the Poly Haven 1k zips ship none) and drive
the height blend and the normals only. A fixed-count parallax march was tried
on the bench (`parallax` knob, `para` per code in RECIPE, off at 0): on the
aerial sets it smears (their "height" is the integrated normal of a 50-90 m
photo), on the detail sets it is invisible at 25 m. Worth turning on only with
real displacement maps for the detail sets (Poly Haven ships `_disp` at 2k+;
the importer prefers a `_disp` when the zip has one) AND the fine ring (2), so
the silhouette and the surface agree. Until then the knob stays at 0.

## 7. Two data items the chantier surfaced

- The lake mask's NDWI term is now bounded by tint and slope (G435) and the
  shore band joins lagoons within 60 m to the sea; a lake that is a true
  mountain tarn above ~500 m still deserves a look on the bench (`isolate ->
  1 lake`) after any re-prep.
- The Landsat albedo carries July's shading (the far tier is ~3x darker than
  the sets' means; `macroExp` is measured at boot to compensate). A true macro
  pass - the shading divided out by the DEM's own sun on the scene's date -
  would let the far tier be the sets' colour rather than the sets' colour
  corrected. A separate chantier; it touches the analytic bake and the minimap.

## What NOT to do

- No junction or symlink into a worktree (see above). No `git update-ref` on
  master from a worktree: land by `git merge --ff-only <built>` FROM the main
  checkout so its tree follows. A HANDOVER conflict is both sides appending:
  rebuild it as master's file + your entry, never "keep both hunks" by regex.
- No `textureGrad` / `textureLod` on the arrays. No new sampler on an island
  ground program without a census.
- Do not re-import the lot's five with `lot_tex_import.py` alone: their
  `height_*.jpg` come from `splat_tex_import.py`'s LOT pass.
