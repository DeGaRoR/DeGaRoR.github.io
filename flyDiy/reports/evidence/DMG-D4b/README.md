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
- `prop_metal_cessna_taxi_nose.jpg` - the metal Cessna's ALUMINIUM prop, the 3 m/s trunk strike (the wind off; re-shot after G1860.1 + G1861.4): no blade breaks, they curl aft and against the rotation (0.40-0.46 rad); the cowl stays on (its distortion 1 mm: dented sheet keeps its fasteners), the engine inside it.
- `prop_metal_cessna_bent_closeup.jpg` / `_skin.jpg` - the bent blades close, the other front quarter (camera `noseL`): after (the curl drawn) / D4a's skin alone (the prop straight).
- `prop_metal_cessna_taxi.jpg` - the same strike, side view.
- `engine_ride_bug_before_g1861_4.jpg` - THE BUG G1861.4 fixed (shot before it): with nothing broken the engine block stood turned out through the front of an intact cowl - a nose engine's rig has two nodes and a two-node fit has no turn, so the block was drawn in the frame's own axes. Now fitted on the engine nodes and everything still joined to them.
- `props_wood.json`, `props_metal.json` - the strikes' numbers (material, energy, cut / curl per blade) and the bodies.

## The page against node (the coordinator's D0 check; `tools/dmg_taxi_parity.js`)
- `taxi_parity_metal.json`, `taxi_parity_cub.json` - the page's 3 m/s taxi into a trunk logged step by step (the certificate - stamped before the run in every case -, the controls, the wind, the ground, the CG and its velocity, the hits, the damage) four ways: as staged, the wind off, the wind off and the controls zeroed, as staged again; each with its start state.
- THE WIND (a gust field read at sim.t) made the same staging another crash: the metal Cessna 2.43 vs 3.11 kJ, the Cub's whole engine mount broken (10-11 members) with it and nothing broken without it (0.78 kJ). The wind off, two runs are bit-identical.
- THE DEFS DIFFER: the page's metal Cessna hangs its engine 65 cm further forward than node's buildGen of the same file (ENGL/ENGR x -1.162 vs -0.510: G445.1's join measures the drawn flange into spec.engines[0].x, which the v10 file lacks), 887.3 vs 883.4 kg; the page's Cub carries its nose tank's vessel nodes (VSNL/VSNR) at the bottom of the firewall, node's at the top, and is 13.9 kg lighter. One join path for node and page: A0's JOIN-PARITY (G1985-G1989).

## The census, the clip, the gates
- `census.json` - THE YELLOW-CUB CENSUS (the user's leak test): the share of the aeroplane's own pixels (a white-minus-black flat render; the glazing, struts, wheels, prop and engine taken out) that is not yellow - intact / after / skin / before, per camera.
- `stills.json` - every shot's numbers: the census, the stage (frame times, the parts gone and why, the bodies, the strikes), the drawn clip (furniture through the skin, debris inside it).
- `gate_dmgwreck.txt`, `dmgwreck.json` - GATE DMGWRECK; `gate_clip.txt` - GATE CLIP.
- `d4a-fix/` - the D4a fix (G1866-G1867.1): DMGSKIN against the base, the stills that verified G1867.1.

## The impact's frame rate (G1869)
- `fps_trace.svg` - every frame through each crash (the trunk on the centreline, 2.5 m out, the severe nose-in), the G1869 cuts off (red) and on (green), and the cuts-on frame split into the physics, the skin break, the rest of the scene and the render. Worst frame 263 -> 104 / 145 -> 138 / 116 -> 96 ms; the impact second's mean 91 -> 58.5 / 55 -> 43.5 / 64.5 -> 51.6 ms; the wreck at rest 25.8 -> 22.9 / 52.7 -> 41.8 / 24.4 -> 21.4 ms (the box, 1600x900, inline).
- `fps_trace.json` (the summaries), `fps_trace_frames.json` (every frame's split).

## The user's review, 2026-10-06 03:00 (review/; the Cub, the wind off, `tools/dmg_wreck_stills.js` + `tools/dmg_wreck_paths.js`)
- THE COWL IN THE HARD CRASHES: both cowl halves come OFF in every hard case (`cowl_stills.json`, each panel's reason):
  the 30 m/s trunk on the centreline (crushed 27 / 36 cm; it breaks up), the severe nose-in (69 / 66 cm), the NOSE-OVER (12 m/s into a 35 cm stump, DMG-WALL's staging: 60 / 43 cm).
  A 3 m/s bump keeps it on, on purpose (G1860.1: a few cm of dent keeps its fasteners; the Cessna's taxi measured 1 mm).
- `cowl_trunk0_after.jpg` (+ `_low_`, `_skin` = D4a's skin alone), `cowl_nosein_after.jpg` / `_2_` (a cowl half lying open on the runway), `cowl_noseover_after.jpg` / `_2_` (the cowl bowl off the nose; `_intact` before, `_skin` without the debris).
  In the nose-over the wings' covering is torn into strips - D4a's tear (DMG-WALL's), not the debris.
- THE RESET PATHS (`paths.json`): after a 30 m/s break-up, `Fly again` (retry) and `The shed` + `Roll out` (garage) both left the wreck layer idle, 0 debris bodies, 0 hidden or collapsed part objects, 0 broken members, 0 skin records. The third path (another departure) was NOT exercised: its staged crash did not happen (0 broken), so its "clean" proves nothing.
- `path_garage_after_SUSPECT.jpg`: the garage path's still (the hangar, close): jagged dark edges along the top of the wing - possibly the previous crash's torn drawing surviving the reset (the user's report). The wreck layer's own numbers were clean; whether the torn triangles of D4a's records came back is DMG-WALL's check. Flagged, not concluded.
