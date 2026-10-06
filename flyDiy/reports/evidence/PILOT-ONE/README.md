# PILOT-ONE evidence (G1935-G1944, 2026-10-05)

Base = train 34 (origin/master 55dd98b7, untouched); branch = claude/pilot-one-g1935. Node only, a 4-core cloud box.

## takeoff/ - tools/pilot_one_trace.js (one take-off per build, THE PILOT, calm; HOME's grass for wheels, the SEA lane for floats)
- `summary-before.txt` (base core, `CORE=<base flight_core.js>`) / `summary-after.txt` (branch).
- `before/*.csv`, `after/*.csv`: 10 Hz from brake release to 2 x hSafe: t, phase, V, pitch (deg), q (deg/s, 0.25 s filter),
  contacts (wheelsOnGround: on the water 3 = displacement, 2 = on the step), height, de, thr, flap, run.
- Builds: cub / jodel / c172 (builds/*_corrected.json, the user's), c172f (the user's C172 with floats for wheels),
  wip (tools/fixtures C172 on Wipline 2350s), ultraf (the v7 ultralight on floats), twinf (the v7 twin on floats).
- The wheels are identical base -> branch (the user ruled the land take-off fine). The water: the twin's bow dig
  (-66 deg, -91 deg/s) and never airborne -> one lift-off at 28.1 m/s; the ultralight's porpoise (q 14.6 deg/s) gone;
  the floats C172 (T/W 0.20) stuck on the hump for ever -> rejected, said.

## turnaround/ - tools/pilot_one_turnaround.js (stopped 20 m from a short strip's far end, nose to it; departFrom)
- `summary-before.txt` / `summary-after.txt`: East Point Clearing (150 x 12) and Jumbo Mine Street (250 x 18) on Jolene,
  the Cub / Jodel / C172; `cub_eastpoint_after_trace.txt`: the Cub's pivot at 0.5 s (along, cross, Vg, heading, thr,
  rudder, brake, the differential brake).

## shortfield/ - tools/pilot_trace.js (Jolene, calm; the .txt is the tool's summary, the .csv.gz its 0.1 s trace)
- `cub_eastpoint_before.*`: base - touched 213 m into 150 m, 'completed'.
- `cub_nv_long.*`: branch - on the slope, two go-arounds (the float in ground effect), the diversion, landed at Tamgas Hill.
- `c172_mn_base.*` / `c172_mn.*`: Tamgas -> Jumbo Mine (250 m), full flap: base stopped ~44 m past the end ('completed');
  branch touched 16 m in and stopped with 80 m to spare.
