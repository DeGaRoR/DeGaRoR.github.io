# DMG-PLOUGH evidence (G1807-G1809)
- `dmgplough.json`: GATE DMGPLOUGH's results (law curves, the calm take-offs' runs, the sweep). The `hump` block is from the
  final hump picker (C_V <= 4); `gate_first_run.txt` is the first run, where the picker read a porpoise on the step.
- `trim.svg`, `law.svg`, `sweep.svg`: `node tools/dmgplough_evidence.js --plots reports/evidence/DMG-PLOUGH/dmgplough.json`.
- `bench_twin.txt`: `node tools/dmgplough_bench.js twin --V=1,2,3,4 --trims=-10,-5,0,5,10` (the pitch budget, wave off -> on).
- `side_force_vs_trim.txt`: `node tools/dmgplough_side.js` (DMG-HULL's side force's centre against the hump trim).
- `throttle_cap.txt`: `node tools/dmgplough_trace.js twin <wind> --thrCap=c --capUntil=V` (an instrument, not the pilot).
- `wave_on_takeoff.txt`: `node tools/dmgplough_trace.js <build> 0 --kWave=k` (the pitch range on the water run).
- `bits.txt`, `perf*.txt/json`, `perf_pooled.txt`: `node tools/dmgplough_evidence.js --bits/--perf --*-base <base core>`.
- `gates_now.txt`, `gates_base.txt`, `gates_diff.txt`: the gate list on this branch and on the base (6d9bdf7), diffed.
