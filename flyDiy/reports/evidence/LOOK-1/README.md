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
