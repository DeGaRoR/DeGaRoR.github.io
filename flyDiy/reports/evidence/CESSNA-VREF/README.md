# CESSNA-VREF (G2500) - evidence

MODE: node only (a cloud session, no GPU). "The game's flight" = tools/_tour_lib.js gameHost: src/viewer/sim_host.js
makeSimHost (the worker's host and the page's placement), the page's pilot with the garage's shakedown and the nav,
src/viewer/day_clock.js DAY_CLOCK's day (a new player's: 8 kt from 250 deg, gust 0.15, the sea breeze) ticked every step,
the aeroplane through the load door (tools/_load_build.js), damage ON.

TREES:
- train 40 = bcf6279 (master; + this branch's tools copied in, no src/ change)
- pilot-42 = 6131d34d (build 594a68063d35 - the build the coordinator's GPU run names; + this branch's tools copied in)
- AFTER = claude/cessna-vref-g2500 (build 92ee2f0a0536 - src/core/43_pilot.js G2500)

| file | tree | command |
|---|---|---|
| w3_train40_bcf6279.log | train 40 | `node tools/cessna_vref_probe.js <tree> --build c172 --order HOME,w3 --from-phase FINAL` |
| w3_pilot42_6131d34d.log | pilot-42 | the same |
| w3_pilot42_slopefix_only.log | pilot-42 + G2500.5 (1) alone (a temporary switch, not committed) | the same (--from-phase FINAL default) |
| w3_fix1_held_roll.log | pilot-42 + G2500.5 (2-4), without (1) | the same |
| w3_after.log | AFTER | the same |
| w3_after_calm.log | AFTER, the day held calm | the same + `--calm` |
| tw_ski_after.log | AFTER | HOME > w3 > tw_ski chained (scratch: _tour_lib flyLeg with the host, the last leg sampled) |
| tw_ski_after_without_slopefix.log | AFTER without (1) (the temporary switch) | the same |
| elevator_authority.txt | pilot-42 (the build tunnel is the same on AFTER) | `node tools/elevator_authority.js` |
| gates_before_cvref.log | pilot-42 | `run_gates --no-build --only=CESSNAVREF --jobs=2 --verbose` |
| gates_before_tour.log | pilot-42 | `run_gates --no-build --only=TOUR --jobs=2 --verbose` |
| gates_after.log | AFTER | `run_gates --no-build --only=PILOT,PILOTACT,PILOTMATRIX,TAKEOFF,LINEUP,PLAN,NAV,ROUTE,PROFILE,HOTHIGH,TOUR,CESSNAVREF --jobs=4 --verbose` - its TOUR / CESSNAVREF rows ran with the shard-tagged verdict line run_gates does not read (fixed after): superseded by gates_after_tour.log |
| gates_after_tour.log | AFTER (the fixed gate tools) | `run_gates --no-build --only=TOUR,CESSNAVREF --jobs=2 --verbose` |
| jodel_before.log / jodel_after.log | pilot-42 / AFTER | `node tools/pilot_trace.js builds/jodel_2026-09-20_corrected.json` |
| jodel_before_w.log / jodel_after_w.log | pilot-42 / AFTER | the same + `--day-wind 8,250,0.15,1` |

The probe logs: one JSON row per 0.25-0.5 s (phase, s along the strip from its centre, height over the ground, V, the
TECS speed asked Vc, throttle, elevator de, flap, pitch, its command, vs, y, hP = the slope's height ap.intent.h, brake,
wheels down), then the approach record, the landing, the verdicts and the stop against the strip's ends (+-260).
