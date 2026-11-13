# water-taxi evidence (FIT-PROCEDURE, 13 Nov, for Pilot via A0)

The PC-6 on Wipline 6100s (claude/fit-procedure-floats, builds/candidates/pc6_floats_2026-11-13.json) cannot get back
to mk_sea's lane start after landing there on the tour SEA > mk_sea > SEA: in TAXI the pilot holds thr 0.00 with
brake 0.60 for minutes while the 5 m/s wind drifts it at 1.2 m/s; it steers (dr to +-1.0) but with no power the water
rudder has no flow, ctl.wr stays null; lineup-timeouts, gave-up near 820 s, then a 30 deg swing on the SEA water roll.
Placed fresh on mk_sea's lane it takes off in 13 s. Same with fltAmph 0 (a pure seaplane).

    node leg2b.js <tree root> <build.json>      the tour SEA > mk_sea > SEA (TOUR's gameHost: the game's day, the
                                                 expert); the SECOND leg's water phases every 3 s (phase, V, nose vs
                                                 the lane, along / across, thr, dr, wr, brake, wind) until CLIMB
    node dep.js <tree root> <build.json> <from> <to> <secs>   a departure placed fresh on <from>'s lane, logged
    node run.js <tree root> <build.json> <secs> [from] [to]   the first yield's moment on a run (LINEUP=1: placed lined up)

leg2b_amph.txt: the run quoted above (the amphibian card at 35e1beac).
