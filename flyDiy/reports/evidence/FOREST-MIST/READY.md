# FOREST-MIST READY (cloud session, 9-10 Nov 2026, for A0)

Branch `claude/forest-mist` (also pushed as `claude/sweet-dirac-s3avm7`), off master `e789e77c` (L36b). The study:
`futureDesigns/FOREST-MIST-STUDY-2026-11.md`. The pictures: this folder (`s08_PICK_run11.jpg` is the user's pick;
`target_concept.webp` the user's target).

The user (9 Nov): pockets of mist hung on the trees, as in the concept art - study it, prototype the cloud system idea
and the "fakey" planes idea. Steered over eight notes to a pick (10 Nov: *"this image was looking best"*), then:
*"maybe we need to integrate it into the game now"* and *"presets in the weather settings ... including the authored
ones, so I can trigger them for screenshots"*.

## What lands

- **`src/viewer/forest_mist.js`** (new, in MANIFEST before `atmo.js`): the POCKET MAP (512^2 over the island, baked once
  per world from terrain, water, the island's canopy raster: valley pools under a lid, wet forest in hollows) and a
  CONTOUR map (512^2, baked, unused at the pick's settings), both drawn into the atmosphere atlas's free columns
  [768, 1792) of the tile rows - **no new sampler**; the WEATHER LAW (`strengths`: the season's `fog.hold`, the day's
  humidity, `mistBurn`, `mistCalm`, cover and cloud base, `SOIL_WET.hoursDry`) and the DRIFT (the integral of
  `climate.sample` at 40 m); the GLSL density `fmDens` and the veil `fmOD` (4 taps over 450 m before each surface,
  2 after the eye), lit by the key's beam with a droplet forward lobe; a CPU mirror (`densCPU`) proven equal to the GPU
  (`tools/forest_mist/glsltest.js`: 4096 points on SwiftShader, mean |diff| 0.05).
- **`atmo.js`**: the veil inside `MIST_GLSL` (the one splice), all behind `FM_ON` ternaries; the lanes stay the literal
  `uMist[7]` and are rewritten to 13 only when on; `ATMO.blit` (the scissored atlas upload, through `MATLIB.make`).
- **`clouds.js`**: the pockets marched ahead of the decks (`?fmist=a` only - not landed as a feature).
- **`render_world.js`**: the bake beside F2's field, the update beside `ATMO.update` - both no-ops unless on.
- **`gfx_settings.js`**: a FREE row **`forest mist: off / on`** (sky group; on reloads the page - the code is compiled at
  the start; off is live through the lane and compiles out at the next start). **No preset names it** (the desktop
  presets are frozen - GATE GFX, the user's rule): it is OFF until the player turns it on.
- **`weather_ui.js`** (sandbox): **"the season"** - nine MOMENTS (valley fog dawn, morning fog, sea fog, the storm, after
  the storm, drizzle on the hills, thermal day, golden evening, aurora night) and a picker of the **42 crafted days**;
  each plays the season's plan on that date (the moment at its hour); a CONDITIONS preset leaves the plan. Node-checked:
  every day and moment lands on its own crafted day.
- **GATE FMIST** (core, `tools/_fmist_check.js`, ~4 s): off is identical (no pocket code, 28 lanes; every switch a
  ternary whose off arm is what was there), on is the veil alone from the stored row, the map (deterministic, in range,
  the sea nearly free, hollows full, ridges empty), the law (zero in dry air, burns off, dies in wind, wisps fade with
  the hours since rain, the oro band needs a low covered base), the row (free, off, no preset names it).
- The cards (`?fmist=b`) and the march (`?fmist=a`) stay in the branch as the study's comparison, flag-only.

## Off is identical

With the row off (the default) and no `?fmist`: no texture uploaded, no mesh, no GLSL, the 28-float lane array - GATE
FMIST section 1, and the battery's own text assertions (ATMO's `uMist[7]`, CLOUD's one copy of the mist) untouched.

## Gates (node, `run_gates.js --no-build --jobs=2`, on the built tree)

FMIST, ATMO, FOG, GFX, ASSETS, UISMOKE, WORLDRENDER, CLOUD: PASS (CLOUD after acb30be8: atmo.js carries one literal `uMist[7]`).

**FRAMECOST: red, and it is the STALE PARKED COOK, not the mist** - bisected on a clean master worktree:
- master `e789e77c` on this box: master's 5 boot lines only (`garage:compile/links`, `garage:landing/bytes.bufferData`,
  `garage:seed` / `garage:restore` `updateMatrixWorld`) - its standing red.
- this branch: those 5 + the stand and taxi rows (Cub stand `draws.main` 914 -> 1043, `draws.shadow` 169.5 -> 266,
  `bytes.uniforms` 205 k -> 720 k; the Cessna the same; taxi +56 / +42).
- master + ONLY this branch's `gfx_settings.js` reproduces it exactly - and so does the row with no `free`, no `reload`,
  out of the sky group, or moved to the end: ANY viewer source change does. `tools/parked_cook.js --check`: master
  "manifest build 26485aadd65d, this tree 26485aadd65d (same)"; this branch "this tree 70b9c3bfaeb6 (STALE: every key
  is captured live until a re-cook)". The cooked parked fleet is signed with the build id (parked_cook.js header), so a
  stale cook draws the parked aeroplanes live at the stand. **A0's train re-cook clears it** (the cook refuses
  SwiftShader, so it cannot be done from this cloud). With the row off, the mist itself adds nothing (GATE FMIST 1).

## Owed to the box (A0 books it) - the numbers this cloud cannot give

1. **The veil's ms** (row on, `FMIST.S.force = { pool: 1, wisp: 1, oro: 0 }`, A/B/A against off): gamer at the stand and
   in the forest; laptop (the phone's preset). Budget: <= 2.0 ms gamer, <= 1.0 ms laptop (`FMIST.S.surfN = 2,
   eyeN = 0` there if over). F2's `banks` (6 taps of field + noise) measured +3.3 ms on the 3080: the same order.
2. **FRAMECOST with the row on** (uniform bytes +96 per program from the 13-vec4 lanes; draws +0, programs +0).
3. **Then the defaults**: on for current / gamer / ultra if (1) holds - that is the presets' change the user must OK
   (they are frozen by the user's rule), plus a FRAMECOST ALLOW for the lanes.
4. **The map's bake**: 885 ms on the page (SwiftShader's CPU), 630-780 ms in node, once per world under the roll-out
   screen - to bake offline with the island (study Q6) before it is on by default.
5. Motion: drift and the dissolve at the pocket edges, judged in flight (the stills cannot).

## Open (the study SS8)

The phone's taps (Q3); the dawn breath's frequency (Q5); the lake's steam fog at dusk (Q4); the offline bake (Q6);
the contour stretch / altitude layers (built, off - the user preferred the pick).
