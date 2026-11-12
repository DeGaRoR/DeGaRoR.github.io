# strip-decides evidence (FIT-PROCEDURE, for the Pilot Coordinator via A0)

Old = claude/fit-procedure-fixes 4dc7bebc (master L39b + fixes; 43_pilot.js as master).
New = claude/fit-procedure-strip-decides cc56ea30 (one commit on old: 43_pilot.js "the strip decides").

## td_probe.js - the touchdown probe

    node td_probe.js <tree root> <out.json> <key,key,...|build.json> [order, default HOME,nv_strip,HOME,tw_ski,HOME]

Reads the tree's own code only (pilot_trace, flight_core, island_node, _tour_lib, src/viewer/sim_host.js) and writes
nothing in the tree. Each build flies a tour TOUR's way (gameHost: the game's day, 8 kt from 250, the shakedown, no
profile = the expert, damage on, roundOK nv_strip, tMax 2800). It wraps the host's step; per leg it records:
- td: the first wheel contact after > 15 m AGL (reset by a go-around): bank (deg), ground speed, sink, phase, the strip
  under the wheels, preBankMax (the largest bank on FINAL/FLARE before it);
- rollBankMax: the largest |bank| on the ground after td;
- driftMax: the roll-out heading drift, the nose against its heading at td, the largest while > 2 m/s (deg);
- axisMax: the largest error to the landed strip's axis while > 5 m/s (deg; > 30 = a ground loop, _tour_lib's rule);
- goArounds, the tour leg's warnings / faults / divert.
Bank = asin of the span axis's y (the body axis least upright at rest).

Fleet run: the user's Cub file (builds/cub_2026-09-20_corrected.json) + every no-device taildragger archetype (no
archetype has a STOL device): cub pietenpol tigermoth stearman camel pittsAlike sesqui jodel chinook savannah ul1
motorglider radial beaver - on old and new.

First result (new, the user's Cub, HOME > nv_strip): 2 go-arounds, diverted to w3; td bank 0.0, V 15.9 m/s, sink 0.8;
roll bank max 0.8; drift 1.2 deg; axis 0.7 deg. No ground loop.

Logs and SUMMARY.md follow in later commits on this branch as the runs finish.
