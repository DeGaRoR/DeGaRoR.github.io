# ALTIPORT-ARRIVAL (G2520) - evidence

Every file here is NODE, THE GAME'S FLIGHT (tools/_tour_lib.js gameHost: src/viewer/sim_host.js makeSimHost - the page's
placement, its pilot with the garage's shakedown and the nav, DAY_CLOCK's 8 kt / 250 deg day ticked every step), damage
ON, on Jolene (tools/fixtures/island_jolene.json), unless its name says otherwise. No GPU, no page: the coordinator's
GPU runs (D:/Dev/pilot_runs/after_20261008/jodel, before_20261007/jodel) are the page's side.

THE TREES (the SHA in each file name):
- `pilot42_6131d34d` - origin/claude/pilot-42 6131d34d (train 40 bcf62797 + ROUTE-DRAW + PILOT-PROFILE), a worktree with
  this branch's tools copied in; `node tools/build.js` there prints build 594a68063d35 = THE GAME'S BUILD of the finding
- `train40_bcf62797` - train 40 master bcf62797, a worktree with the same tools
- `after_f8e21652` - this branch at f8e21652 (the fix as delivered in src; later commits change tools / the HANDOVER only)
- `after_v1_freecircle` - a mid-session cut (G2450's free climbing circle, then the arrival re-planned) - superseded by
  the holding pattern at the fix; kept for the Cub's circuit it caused (464 s downwind, gave-up)

THE AEROPLANES: the Jodel builds/jodel_2026-09-20_corrected.json as its file (45 L, 463 kg - the game's: the page's
verdicts and times reproduced to the second); the Cub builds/cub_2026-09-20_corrected.json at 29 L / 461 kg in GATE
ALTIPORT (the page's load door on this base, ISLAND-TOUR-2 G1970.1) and at its file's 45 L in island_tour_cub45L_*.

FILES
- trace_jodel_*.log - tools/altiport_trace.js: HOME > tw_ski, a line every 2 s and at every phase change (the height over
  the strip's highest ground, the distance to the threshold, the leg's plan), the pilot's verdicts as said
- island_tour_*.log - tools/island_tour.js --order HOME,tw_ski (the tour rig's own leg line)
- gate_altiport_*.log - tools/_altiport_check.js --show, one shard each (0 the Jodel, 1 the Cub, 2 the doctored arrival)
- battery_after_f8e21652.log - run_gates --no-build --all --jobs=4 --only=ALTIPORT,PROFILE,PILOT,TAKEOFF,LINEUP,TAXICLEAR,
  PILOTACT,PLAN,NAV,ROUTE,HOTHIGH,SOAR,PILOTMATRIX,TOUR (the progress lines dropped)
- landtour_cub_*.log - tools/island_tour.js --build cub (ORDERS.land: HOME > w3 > tw_ski > mn_strip > w2 > HOME)
- the HANDOVER's '## G2520 - ALTIPORT-ARRIVAL' carries the tables
