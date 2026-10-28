# G3440-G3446 - HYDRO-TRIM: the evidence

The write-up (the cause, the fix, the user's rulings of 25 Oct, the references, the before/after table, the gates, the
asks) is HANDOVER.md's G3440-G3446 entry. Here, the raw numbers it quotes (round 2, 25 Oct, the tree with master L25b
merged in):
- `hydro_trim_table_before_masterL25b.{json,log}`, `hydro_trim_table_after.{json,log}`: `tools/hydro_trim_table.js` on
  master L25b's core and on this tree - the validated floatplanes, the G3390 and the floatplane-POH techniques, the
  heading and wings held (G3446) on both.
- `sea_to_result_{landprop,stcprop}_{g3390,poh}.json`, `sea_to_runs_after.log`: `tools/sea_to_g3390.js` on this tree,
  both builds, both techniques, gross / half, calm / 8 kt (G3390's own results stay in reports/evidence/G3390/).
- `gates_after.txt`: the battery on this tree before G3446 (its HYDROTRIM FAIL is the hands-off rig the torque swung;
  re-run after G3446: PASS). `gates_masterL25b_the_failing_ones.txt`: the red rows re-run on master L25b.
- `round1_2026-10-20/`: the 20 Oct round (before = the branch-start core 8698ddb47, no propeller torque yet).
