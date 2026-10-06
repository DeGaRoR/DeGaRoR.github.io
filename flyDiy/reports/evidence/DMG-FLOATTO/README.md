# DMG-FLOATTO evidence (G1880-G1882)

Made by `node tools/_dmgfloatto_check.js --evidence=<dir> --name=<base|after>` (GATE DMGFLOATTO's sweep, base core via
`--core`, the flat-sea run with `--flatSea`), then `node tools/dmgfloatto_evidence.js --base=… --after=… --flat=…`.
"Before" is the assembled bundle at 7eacfba1 (PLOUGH + TYRE + integration + PILOT-ONE-2 + JOIN-PARITY), "after" is
this branch. Both floatplanes are flown as the game flies them (`tools/_load_build.js` `twinFloats`, `floats`), by
THE PILOT, on the SEA lane, straight across. Every float contact from the throttle to CLIMB is judged.

- `pitch_twin.svg`: the twin on floats, its pitch while a float is wet (gaps = hops; a nose-over drawn to 1 s past it), before (orange) and after (blue), at 0 / 2 / 4 / 5 m/s across; before it noses over at 2 and 5 m/s, after its lowest pitch on the water is 0.0 / -6.1 / -4.8 / -3.7 deg.
- `sweep.svg`: GATE DMGFLOATTO's sweep, 0-5 m/s, both floatplanes: the lowest pitch at a float contact (top, the -20 deg bar dashed) and the run's heading swing (bottom, GATE SEAPLANE's 30 deg bound dashed), before and after.
- `cause.svg`: the cause, on the base core: the twin at 2 and 5 m/s across with the chop the wind raises (orange), with the same wind and the sea flattened (aqua: clean, as in calm air), and after the fix with the chop (blue).
- `sweep_before.txt` / `sweep_after.txt` / `sweep_before_flatsea.txt`: the gate's printed tables (water run, swing and lane on the run and at any touch, pitch range, skips, balks, power held back).
- `takeoff_trace_before.txt` / `takeoff_trace_after.txt`: PILOT-ONE-2's trace rig (`tools/pilot_one_trace.js`), calm: the Cub, Jodel and C172 land take-offs identical to the byte (their 10 Hz CSVs compared), the Wipline C172 and the C172-on-floats too; the two high-thrust-line float builds' calm runs lengthen (ultraf 84 -> 96 m, twinf 180 -> 186 m).
- `perf.txt`: `tools/dmgfloatto_perf.js` - the pilot's update and the solver's step, timed apart in alternating child processes.
- `gates_before.txt` / `gates_after.txt` / `gates_int.txt`: the targeted gate set (`run_gates.js --all --verbose --only=...`) on the assembled base, this branch and the integration base d3d5e24e.
- `tanks_float/`: `tools/tanks_float.js --entry ditch --fuel full --secs 600`, the integration core (`int.log`) and this branch's (`after.log`): the ditch's "sunk" times.
