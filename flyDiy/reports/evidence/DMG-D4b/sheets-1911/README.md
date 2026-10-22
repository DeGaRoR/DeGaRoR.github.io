# The giant sheets after a reset path, 2026-10-06 19:11 (the user's Cub, the physics worker)

After a 30 m/s break-up, the shed, another departure (or the same) and a roll-out, the stand in the hangar draws a
crashed, stretched Cub:
- `with_wall_fix_*` - a scratch tree: claude/dmg-d4b-wreck 9d2bee4f + DMG-WALL's copy on the first break (44a74f78);
- `control_no_wall_fix_*` - claude/dmg-d4b-wreck alone.
**Both still draw it.** And no CPU array of the aeroplane holds it (`*_paths.json`): the aeroplane snapshot is pristine
(0 of 147102 triangles past 2 m), the page's model after the path is the crashed model itself (not rebuilt) with 0
triangles past 2 m, and the scenes' groups against a fresh load show no aeroplane survivor (only the streamed terrain).
So it is drawn from the GPU's side - a stale upload after the heal, or the flown bake's fold bones - which the next run
tests (a bone census, every attribute uploaded again, a still again: tools/dmg_wreck_paths.js b6781f41).
