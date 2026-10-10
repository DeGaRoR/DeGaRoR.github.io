# FLEET-PROPS B (G2225-G2229) - evidence

Box: the shared GPU box (RTX 3080), headed Chrome, viewport 2216x1023, warm profile `D:/ufb` (its own origin
`localhost:8695`: the fleet's bakes live in that origin's IndexedDB). The flown aeroplane in every run is the user's Cub
(`builds/cub_2026-09-20_corrected.json`, an unsaved working build, so all six props stand). THE FLEET: six saved slots
tied down outside at HOME (`tools/perf/fleet_b_set.js`): fleet-1-cub, fleet-2-jodel, fleet-3-c172, fleet-4-c172floats,
fleet-5-twinfloats, fleet-6-metal, baked by the garage's idle path (`fleet_b.js setup`).

| file | tree / build | preset | mode |
|---|---|---|---|
| `setup.log` | a11ba6be / 149a69c6c849 | gamer | the setup (03:41, GPU untimed): six bakes, the garage's long tasks while baking, the 40-build bound |
| `dry/` | a11ba6be / 149a69c6c849 | retro | the dry run (03:43): ITS A/B STILLS MEASURED NOTHING (the props behind the camera; the camera never moved) and its roll-out ran on another origin (no bakes) - kept as the record of the rig's bugs, never as a number |
| `timed/still_<preset>.json`, `timed/apron_*`, `timed/taxi_*`, `timed/close_l1_*` | 33942ca5 / f9145510da7b | gamer, retro, potato | `fleet_b.js still --timed` (06:02-06:09, GPU TIMED): the SAME held frame with the fleet group shown (`_fleet6`) and hidden (`_fleet0`), 5 rounds x 2 states x 60 frames a view: `apron` = on the stand, the orbit eye on the fleet (all six in view, the worst case); `taxi` = paused 14 s into the taxi, the player's chase view; `close_l1` = the eye inside the L1 ring of the nearest prop beside the live aeroplane |
| `timed/rp_<preset>_<off/3/6>.json` | 33942ca5 / f9145510da7b | gamer, retro, potato | `rollout_perf.js` HOME / CIRCUIT, chase, 90 s (06:08-06:31, GPU TIMED), `--eval tools/perf/fleet_b_eval.js`: `off` = FLYDIY_FLEET off, `3` / `6` = `?fleet=1&fleetn=N` |
| `timed/numbers.json` | 33942ca5 | all | `node tools/perf/fleet_b_table.js reports/evidence/FLEET-PROPS-B/timed --tree 33942ca5` |
| `untimed/` | 33942ca5 / f9145510da7b | gamer, potato | `fleet_b.js still <preset> untimed <Jodel> --look fleet-2-jodel` (06:40-06:44, GPU untimed): the Jodel flown beside the props |
| `gates/` | 230405a6 (04:00), 33942ca5 (07:42) | - | the node gates (CPU): PARKED, TAXICLEAR, UISMOKE(+PHONE), BUILD, BUILT, FRAMECOST census base f4c47a59 vs branch (flag off) and FRAMECOST_FLEET=1, INSTANT --fleet |
| `cruise/` | (8 Oct 22:22-22:42) | gamer, retro, potato | the cruise runs, the flight started lined up (A0's TIMED window) |

The stills are committed as JPG (quality 90) copies; the PNG originals stay on the box. Every still was taken on a
LOADED page (the boot overlay gone: BOOT.state 'gone', `#boot` hidden - asserted before and after the shot).
