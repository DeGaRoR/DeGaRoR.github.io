# LIVERY-STICKERS evidence (9 Nov 2026)

Renderer: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`, headless
Chromium in the cloud (no graphics card), `dev.html?gfx=gamer` (atlas 4096) and `?gfx=laptop` (atlas 2048), the shed's
GOLDEN mood (the late sun through the door; under the gamer preset AFTERNOON lights the shed from the skylights only and
a sticker in shadow does not read). The stock Cub as the garage boots it; the Twin busher on floats
(`builds/candidates/Twin_busher_floats_4b.json`) through the fleet's Import. Every sticker went on through the editor's
own finish door (`CAGE_UI.finishFromSpec` + `build`); once per run the panel's own mark button was clicked
(`panel {"vn1On":1,"vn1Mk":11,"thumb":true}` in each log: it reached the export, the buttons carry the marks' pictures).
Rig: `node flyDiy/tools/stickers_shot.js --out <dir> --gfx gamer|laptop --size 1920x1080 [--nowatchdog] [--only cub|twin]`
(`--nowatchdog` for gamer: its frames take seconds on SwiftShader). JPG q84, the canvas only (1600 x 1080; the editor's
columns fold). The Cub's stills are from the `--only cub` runs (stickers_log_*_cub.json), the Twin's from the full runs
(stickers_log_*_twin.json); the composition is `COMPOSE` in the rig.

## The stills (`sheet_gamer.jpg`, `sheet_laptop.jpg`: all eight of a preset on one page)

| file | what |
| --- | --- |
| `cub_<gfx>_threequarter_right.jpg` | the hero shot: the grizzly on the right cowl (right side only), the Alaska map on the fin |
| `cub_<gfx>_nose_right.jpg` | the right cowl closer: the grizzly, head to the nose as drawn |
| `cub_<gfx>_left_side.jpg` | the left flank: the bull moose on the cowl (left side only, a dark red picked for it), the map on the fin |
| `cub_<gfx>_nose_left.jpg` | the left cowl closer: the moose |
| `twin_<gfx>_threequarter_right.jpg` | the glassy panorama on the pod (dark green), the orca on both fins (the trim's orange) |
| `twin_<gfx>_tail_right.jpg` | the fins: the orca on the near fin's outer face and the far fin |
| `twin_<gfx>_threequarter_left.jpg` | the left side: the orca mirrored (it leaps forward on both flanks) |
| `twin_<gfx>_above.jpg` | from above: the midnight valley on a wing top (plan projection) |

The Cub wears three stickers (the right and left cowl hold different marks: the sides feature), the Twin busher three.
The Cub's registration fills its rear fuselage from the cabin aft, so its flank stickers are nose art on the cowl.

## The probe (`probe_flanks_grid.jpg`, `probe_mirror_zoom.jpg`)

`stickers_shot.js --probe`, the stock Cub, the grizzly in red at the registration: rows = uDecE.z +1 (one side), both
sides with no mirror, both sides with the mirror; columns = the view whose nose points right (the aeroplane's RIGHT
side) and left (its LEFT side). The +1 sticker shows only on the left side: **+x is the left flank**, so
`AERO_VINYL_RIGHT = -1`. With noMirror the bear is head-right (as drawn) on the left flank and head-left on the right:
the cell is drawn flipped when the mirror is on, so "mirror on the left" means the right flank reads as drawn. (The probe
was taken before the composition: the grizzly sits over the registration there on purpose.)

## The marks (`marks_before_after.jpg`)

02 grizzly, 08 true north, 09 moose, 12 alaska: before (the approved v3 masks, flattened) and after, big and at sticker
size on red and navy. The other eight are byte-identical masks.

## What SwiftShader cannot show

No frame time and no compile time (a GPU's driver compiles differently), and the GPU's own uniform limit: SwiftShader
reports 4096 fragment / 4096 vertex vectors. Measured on the page: the heaviest skin program holds 282 vec4 of uniforms
(laptop) and 327 (gamer), both stages counted together, 65 of them the decal arrays (+20 from this branch). The gamer page
lost its GPU process once per run to the session's memory limit (SwiftShader's process grew past 8 GB) and recovered.
