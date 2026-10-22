# DMG-D4b on the merged code, 2026-10-06 16:30 (the user's Cub; integration 4300dc58 merged)

**Read this first.** These were shot on claude/dmg-d4b-wreck at 1d90f18e..6413e25d, which carried a merge fault found
an hour later and fixed in d4426cf9: skin_break.js held stale copies of `over()` / `worstStretch()` that replaced
DMG-WALL's tube / sheet tear bounds. **The skin's tears in these shots are not the final code's.** Re-shoot pending on
d4426cf9+. The wreck layer's own rows (debris, reset paths, the prop's grade) are unaffected by that fault.

## Under the physics worker (the DEFAULT mode - `worker_*`), staged by `dmg_wreck_stills.js` pageStageW
The worker flies its own aeroplane; the rig moves it onto the runway along its OWN heading (a placement cannot turn it)
and pushes it into a trunk / stump sent as a tree hit, the conditions calm, then the game runs in real time.
- `worker_noseover_*` - 12 m/s into a 35 cm stump: on its nose, 48 breaks on the page (the worker's), the cowl ON (0 cm).
- `worker_trunk-0_*` - 30 m/s into a trunk: broke up (175 breaks on the page); a cowl half OFF (off) and one OFF
  (crushed 33 cm); DMG-DRIVE graded the strike 'stoppage' (wood: whole).
- `worker_taxi_*` - 3 m/s into a trunk: DRIVE 'stoppage', NOTHING broken - the engine and the cowl stay on (they agree).
- `worker_path_place_*`, `worker_path_garage_*` - after a 30 m/s break-up, the shed and a roll-out (with another
  departure / the same): the wreck layer CLEAN (0 bodies, 0 debris, 0 hidden or collapsed parts, 0 skin records). **BUT
  the stills, in the hangar at the stand, show giant orange stretched triangles** (and the garage one is a blur from inside
  them): the user's 'giant sheets after a crash' NOT gone on this code. Being chased: `dmg_wreck_paths.js` now lists the
  meshes holding triangles past 2 m after each path (003b902f), for the next slot.
- The rig's own report said "NOT EXERCISED" for both paths: wrong - it read the page's never-stepped sim (fixed b29a4e06);
  the page's damage state held 175 / 177 breaks.

## Staged inline (`?simw=0` - `inline_*`), the comparison only (and the 60-degree nose-in, which a placement cannot stage)
- `inline_noseover_*` - 68 members broken (the gear, the mount, the tail), both cowl halves OFF (crushed 29 / 31 cm).
- `inline_nosein_*` - broke up (151), both cowl halves OFF (crushed 70 / 67 cm), DRIVE 'stoppage'.
- `inline_taxi_*` - 13 members broken (the whole engine mount), the engine OFF (loose), DRIVE graded the strike
  'separation' at biteR 1.224 (a bite past the radius) with the throttle shut - against the worker's taxi (stoppage,
  nothing broken). The two are not the same crash (the worker's runs along the stand's heading, on other ground), so
  this is no worker / inline divergence by itself; a DRIVE separation at an idle tip speed in a walking-pace bump is a
  finding for DMG-DRIVE.
- The worker / inline stagings differ (heading, ground, the run's clock): the stills compare the drawing, not one crash.

`worker_stills.json`, `inline_stills.json`, `worker_paths.json`: every number (the stage, the cowl panels, the strikes,
the tear census per wing).

**CORRECTION (2026-10-07, DMG-DRIVE2 found it): the INLINE taxi here was NOT run with the throttle shut.** The stills rig set the
throttle once and the page's own loop wrote it back from the input every frame (0.62: 1710 rpm, 3 -> 4.27 m/s before the strike).
Its DRIVE "separation" and the mount it tore came from a POWERED strike - my "strike first at an idle tip speed" finding is
withdrawn. (DMG-DRIVE2's own finding is separate and stands at any throttle: the strike was graded with the trunk's face
0.84-0.98 m AHEAD of the flange - biteR = R + r - lat passes R whenever the trunk is near the hub's line - see its READY ab53b8e4.) Fixed in the rig (3455e001: hands on, the controls zeroed before every step pair).
The worker-staged shots were unaffected.
