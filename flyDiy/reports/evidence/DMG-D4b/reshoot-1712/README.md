# DMG-D4b re-shoot, 2026-10-06 17:12-17:24 (A0's slot): the final code d4426cf9+, the user's Cub

**The code**: claude/dmg-d4b-wreck d4426cf9+ (the merge fault fixed: WALL's tear bounds back), integration 4300dc58
merged. NOT yet DMG-WALL's copy-on-first-break fix (claude/dmg-wall-cowl 44a74f78) - which the coordinator expects to
be the giant sheets' root cause (see below).

## Under the physics worker (the DEFAULT; `worker_*`)
- `worker_path_place_after_1/2`, `worker_run2_path_place_after_1/2` - after a 30 m/s break-up, the shed, ANOTHER
  departure, roll-out: **a crashed, stretched Cub is drawn at the stand in the hangar (giant orange sheets, the torn
  tail) - the user's 'giant sheets after a crash' REPRODUCED on this code.** The flight's own model holds no triangle
  past 2 m and the wreck layer is clean (0 bodies, 0 debris, 0 hidden parts, 0 skin records): what is drawn is NOT the
  flight's model. The coordinator's reading: the flown geometries wrapped the aeroplane snapshot's own arrays, so the
  crash was written INTO the snapshot and every view built from it (the stand) draws the wreck - fixed at the source by
  DMG-WALL's copy on first break (44a74f78). Re-run on a tree with it pending (19:11).
- `worker_path_garage_after_1/2` - the same after the shed and a roll-out from the same departure (close: inside the sheets).
- `worker_noseover_*` - 12 m/s into a 35 cm stump: on its nose, the wings whole in the pictures, the cowl on (0 cm).
  (The tear census's wing counts - ~95 of 224 a side 'gone by stretch' - disagree with the pictures: its wing
  classification is suspect, being checked.)
- `worker_trunk-0_*` - 30 m/s into a trunk: broke up (173 breaks), both cowl halves OFF (crushed 51 cm), DRIVE 'stoppage'.

## Staged inline (`?simw=0`; `inline_taxi_*`) - one question only
- 3 m/s into a trunk: DMG-DRIVE graded 'separation' at t 2.933 s (biteR 1.197, rigid, wood, the throttle shut); the
  first engine-mount member broke at t 3.267 s (ENGL-S0BR), 12 members in all - **the strike first**: a DMG-DRIVE finding
  (the coordinator's cloud chip).
