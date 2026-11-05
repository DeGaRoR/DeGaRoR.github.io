# LOOK-1-STUDY evidence (4 Nov 2026)

The study: `futureDesigns/LOOK-1-STUDY-2026-11.md`. Every still: Jolene, the HOME stand, the sim paused, the free eye,
1280 x 720, JPG q85, renderer `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`
= the software rung (potato: no tree shadows, 64 px impostor tiles, NO SKY PROBE - see the study §5). Night = 24 Dec 2026
03:00Z (full moon 22.5 deg, clear), blue = 01:00Z (sun -5.2), golden = 23 Dec 23:00Z, noon = 24 Dec 21:00Z.
`TREE_LOD.set([60,270,270])` (bands=far). "near": the nearest cedar 28 m from the moon's side; "forest": a cedar 250-900 m
out, from 200 m and 35 m up.

| still | what it shows |
|---|---|
| `key_specks_near.jpg` | **the cause**: night, the probe off; the moon key ON (lit card faces = the specks) / held at 0 (a uniform dark crown) |
| `key_specks_forest.jpg` | the same over the forest (geometry in front, impostors behind) |
| `sheet_near_night.jpg` | the amplifier: master / `?l1mip=1` (alpha-weighted mips) + leaf light x0.69; crown mean and speck index (p99/p50) |
| `sheet_forest_night.jpg` | the same, the forest: the mips barely move the forest's specks |
| `sheet_near_blue.jpg`, `sheet_forest_blue.jpg` | blue hour, master / A1 (both frosted white: the static env, see below) |
| `sheet_near_golden.jpg`, `sheet_forest_golden.jpg` | golden hour, master / A1: the day-look risk of A1 |
| `sheet_near_noon.jpg`, `sheet_forest_noon.jpg` | midday, master / A1: the day-look risk of A1 |
| `near_night_before.jpg`, `near_night_after.jpg`, `forest_night_before.jpg` | the full frames behind the night sheets |
| `swiftshader_env_artefact.jpg` | night and blue hour with SwiftShader's static boot-time environment / with it off: why cloud night frames look frosted |
| `terms_lamps_leaf.jpg` | night base / premises lamps muted (identical) / leaf wrap + SSS 0 (-2 %) |
| `map_cedar_rgb_alpha.jpg`, `map_larch_rgb_alpha.jpg` | the leaf maps' RGB (left) and alpha (right): the PNG's own fill under alpha 0 |
| `mip6_cedar_today_vs_weighted_pngfill.jpg` | cedar mip 6 off the PNG (its pale fill), straight / weighted: what a non-canvas load path WOULD draw |
| `crowns.json` | the sheets' numbers (crown mean, speck index, before / after) |
| `l1mip_prototype.patch` | the `?l1mip=1` prototype (push-pull; evidence only, not the proposal) |
| `rig/` | `stage.js` / `stage_lights.js` (soft_still stages), the run scripts, `mips_canvas.py` (the mip table), `sheet.py`, the runs' light dumps (`run6_rows.json`, `run7_rows.json`) |

Re-run: `L1_SCRATCH=<dir> bash rig/run7_key.sh` (one boot, ~15 min on 4 cores; one page at a time: two pages run out of 15 GB).

## Pass 2 (5 Nov): the six picks, the forest in volume, the blue hour

Same rig; `rig/views8-11.json` + `rig/stage_lights.js` (per-view `pre` and `vars`); the prototype dials of
`rig/pass2_prototype.patch` (`?softprobe=1`, `L1U.crown`, `L1U.dirK`, `L1U.far`), applied for the runs only.

| still | what it shows |
|---|---|
| `pick2_far_stand8.jpg` | **the forest of speckles at a low sun (~8 deg)**: today / the impostors reading the far cascade (shadows 'full' on at runtime): part of the stand loses its per-tree bright sides (8.4 % of pixels, luma x0.96) |
| `pick2_far_stand30.jpg` | the same at ~30 deg: 2.3 %, x0.99 (untuned prototype) |
| `pick2_far_potato_inert.jpg` | the same dial on potato: inert (no far cascade without shadows) |
| `pick2_forest_dials.jpg` | a side-lit stand: today / impostor crown normals 1 (lollipops) / the key x0.5 / wrap 2 |
| `pick1_aa.jpg` | potato aa off / msaa4 (small: potato has no clouds; the default preset's 0-sample case is GPU-only) |
| `pick3_trees085.jpg` | trees today / MASTER.light x0.85 |
| `pick4_air.jpg`, `pick4_mist.jpg` | turbidity 2.8 / 5 / 8; mist flat rh 0.5 / banks rh 0.85 |
| `pick5_bloom.jpg` | bloom off (potato) / soft (current, gamer) |
| `pick6_hand.jpg` | one stand at 40 m into the sun as geometry / as impostors: luma 0.92x, hue equal; the trunks differ |
| `also_tone.jpg` | Cineon (today) / AgX / Khronos neutral |
| `blue_softprobe.jpg` | the blue hour with the REAL probe forced on (dark trees, not white) / probe off / the night with the probe |
| `softprobe_poison_noon.jpg` | why the forced probe cannot settle the blue hour: noon goes black (G1460), golden draws |

## Pass 3 (5 Nov): the flicker in motion

`rig/stage_flicker.js` + `rig/flicker.py` + `rig/viewsF.json`: the same paused scene at six sub-pixel camera offsets
(Halton 2,3, ±0.5 px) + one repeat (the noise floor). Each sheet: one frame | the offsets' mean (what a temporal
accumulation converges to) | the flicker map (the per-pixel spread x 8: hot = crawls when the camera moves). Potato,
render scale 0.67, no clouds (the clouds black the frame under SwiftShader). Numbers: `flicker.json`.

| still | what it shows |
|---|---|
| `flicker_stand_base.jpg` | a stand from 350 m: 13.8 % of the pixels below the horizon crawl, every crown's outline |
| `flicker_canopy_base.jpg` | a canopy from the ground: 13.4 % |
| `flicker_*_soft.jpg` | the leaf sharpen 0.3 + the impostor alpha gain x0.5: -2 % only - the edges' sharpness is not the crawl |
| `flicker_*_msaa4.jpg` | the runtime MSAA switch did not apply on SwiftShader (identical numbers): NOT a result |
