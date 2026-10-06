# DMG-WALL (G1855-G1859) evidence

The user's Cub (`builds/cub_2026-09-20_corrected.json`), `dev.html?damage=1&simw=0`, staged on the home strip by
`tools/dmg_wall_census.js` (DMG-D4b's cases and cameras; taxi = the user's 2.webp scene, trunk-0 = 3.webp's).

- `census/` - run 1 (22:33): **before** (`?wallbind=0&skinwall=0`, the drawing until now) vs **after** (the inherited
  binding), each mode flying the crash itself. NOTE: in this run the frame's tubes, bulkhead and firewall still stood
  rigid in the body frame (the still merge took them out of the wreck's records - found here, fixed in the next commit),
  so the 30 m/s cases' cyan is that, not the wall. `census_table.md`: the inside layers showing, per shot.
- `census2/` - run 2 (22:48): **after** with the still-merged frame riding too (585db1ef). `census2_table.md`: run 1's BEFORE vs run 2's AFTER.
  The page's crash is not bit-repeatable (trunk-0 broke 141 members in one run, 120 in another), so a close camera may
  frame a different wreck: read the far cameras and the pictures together. The 30 m/s close-ups show the cabin torn open
  (cabin BLUE, the covering's inside RED where it tore) - the wreck's own content, not a layer through the wall.
- Every `*_cls.jpg` is the same frame drawn by layer: covering white (its back face RED), lining MAGENTA, frame tubes /
  bulkheads CYAN, fireproof ORANGE, sill / door pads PURPLE, dash / cabin BLUE, beads / glazing GREEN, parts GREY.
- `study_cub.txt` / `.json` - the node study (tools/_dmg_wall_study.js, headless snapshot, the certificate on): every
  wall place against its covering's live plane, and every compact part's triangles, frame by frame.
- `census3/` - run 3 (00:41, 32e770cb): ONE crash a case flown with the wind off, then its recorded node path REPLAYED under
  each binding - the same wreck for BEFORE and AFTER (`census3_table.md`). The heal checks: after every wreck a reset (and
  the garage -> roll-out path) gives every craft geometry's index + static positions bit-identical to the fresh load.
- `gates/` - the worker gate set on 32e770cb: DMGSKIN, UISMOKE, BUILD, JOIN identical to the base 01e6892f (numbers
  masked, `gates_vs_base.txt`); GATE DMGWALL FAIL on the drawn-tube row and on three builds' severe nose-in (not READY).
- `gates2/` - the worker gate set at READY: GATE DMGWALL PASS 98/98; DMGSKIN, UISMOKE, BUILD, JOIN identical to the base.
- `census4/` - the READY code, the user's two scenes (taxi, trunk-0), one wind-off crash replayed under both bindings; the
  heal true after both.
