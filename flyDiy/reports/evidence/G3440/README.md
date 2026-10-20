# G3440-G3443 - HYDRO-TRIM: the evidence

The write-up (cause, fix, references, the before/after table, the gates, the asks) is HANDOVER.md's G3440-G3443 entry.
Here, the raw numbers it quotes:
- `hydro_trim_table.json`, `hydro_trim_table_{before,after}.log`: `tools/hydro_trim_table.js` on the branch-start core
  (8698ddb47, built in a worktree) and on this tree - the validated floatplanes, the G3390 and the floatplane-POH
  techniques.
- `sea_to_result_{landprop,stcprop}_{g3390,poh}.json`, `sea_to_runs_after.log`: `tools/sea_to_g3390.js` on this tree,
  both builds, both techniques, gross / half, calm / 8 kt (G3390's own results stay in reports/evidence/G3390/).
- `gates_after.txt`, `gates_base_branchstart.txt`: the gate verdicts on this tree and, for the four that failed, on the
  branch-start core.
