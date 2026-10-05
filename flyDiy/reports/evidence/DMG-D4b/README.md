# DMG-D4b WRECK DRAWN - evidence

The user's Cub (`builds/cub_2026-09-20_corrected.json`) unless named, `dev.html?damage=1&simw=0`, on the box's GPU (headed Chrome,
`tools/live_driver.js`), staged on the HOME runway by `tools/dmg_wreck_stills.js`. Each wreck is shot three ways from the same
camera on the same frame: **after** (all of it: debris, the prop strike, D4a's skin break with the G1866-G1867.1 fix), **skin**
(`FLYDIY_WRECK = false`: D4a's skin break alone, no debris), **before** (`FLYDIY_SKINBREAK = false` too: the drawing before G1851).
**intact** is the same aeroplane where it is placed, before the run.

## The wreck (G1860, G1866-G1867.1)
- `trunk-0_1_after.jpg` / `_skin` / `_before` / `_intact` - 30 m/s into a trunk on the centreline (it broke up): the cowl halves, the panes, the engine with its prop and the wheels lie off as debris; before = the giant stretched sheets.
- `trunk-0_2_*.jpg` - the same wreck from above.
- `trunk-0_3_*.jpg` - the same, a low side view.
- `trunk-2.5_1_*.jpg` / `trunk-2.5_2_*.jpg` - 30 m/s, the trunk 2.5 m out on the left wing: the cabin truss with the pilot thrown clear, the wing pieces, the tail.
- `nosein_1_*.jpg` / `nosein_2_*.jpg` - 180 km/h, 10 m/s down, 60 deg nose-down onto the runway (broke up).
- `taxi_1_*.jpg` / `taxi_2_*.jpg` - 3 m/s into a trunk, the throttle shut: the wings whole (G1867.1's fix; they shredded before it), the crushed cowl off by the trunk, the engine bared. (Shot before G1861.2: the wooden prop curls here; see the prop shots.)

## The prop strike (G1861.1-G1861.2)
- `prop_wood_cub_taxi.jpg` - the Cub's WOOD prop after the 3 m/s trunk strike: both blades snapped at 29-44 % of their radius, the stubs on the hub, an outer piece on the ground; the engine and prop ride the engine nodes' frame (down with the crushed nose).
- `prop_wood_cub_trunk0.jpg` - the same build at 30 m/s: both blades snapped (167 kJ), the pieces thrown.
- `prop_metal_cessna_taxi_nose.jpg` - the metal Cessna's ALUMINIUM prop, the 3 m/s trunk strike: no blade breaks (they bend aft and against the rotation, 0.40-0.45 rad); the cowl off as debris, the engine bared beside the trunk.
- `prop_metal_cessna_taxi.jpg` - the same strike, side view.
- `props_wood.json`, `props_metal.json` - the strikes' numbers (material, energy, cut / curl per blade) and the bodies.

## The census, the clip, the gates
- `census.json` - THE YELLOW-CUB CENSUS (the user's leak test): the share of the aeroplane's own pixels (a white-minus-black flat render; the glazing, struts, wheels, prop and engine taken out) that is not yellow - intact / after / skin / before, per camera.
- `stills.json` - every shot's numbers: the census, the stage (frame times, the parts gone and why, the bodies, the strikes), the drawn clip (furniture through the skin, debris inside it).
- `gate_dmgwreck.txt`, `dmgwreck.json` - GATE DMGWRECK; `gate_clip.txt` - GATE CLIP.
- `d4a-fix/` - the D4a fix (G1866-G1867.1): DMGSKIN against the base, the stills that verified G1867.1.

## The impact's frame rate (G1869)
- `fps_trace.svg` - every frame through each crash (the trunk on the centreline, 2.5 m out, the severe nose-in), the G1869 cuts off (red) and on (green), and the cuts-on frame split into the physics, the skin break, the rest of the scene and the render. Worst frame 263 -> 104 / 145 -> 138 / 116 -> 96 ms; the impact second's mean 91 -> 58.5 / 55 -> 43.5 / 64.5 -> 51.6 ms; the wreck at rest 25.8 -> 22.9 / 52.7 -> 41.8 / 24.4 -> 21.4 ms (the box, 1600x900, inline).
- `fps_trace.json` (the summaries), `fps_trace_frames.json` (every frame's split).
