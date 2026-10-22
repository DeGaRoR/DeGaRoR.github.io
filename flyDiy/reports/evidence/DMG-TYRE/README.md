# DMG-TYRE evidence (G1844-G1846)

Made by `node tools/dmgtyre_evidence.js --base <DMG-DAMP 8a22a4f9's tools/flight_core.js> --gate-json <GATE DMGTYRE --json output>`.
The "before" is the base core (DMG-DAMP's READY, with the Coulomb tyre). The "after" is this branch's core.

- `slip.svg` / `slip.json`: the side force over the weight against the slip angle, measured IN THE SOLVER. GATE
  DMGTYRE's part 1 sets every node of a settled aeroplane in vacuum to 10 m/s at slip angle beta, runs one substep and
  reads the ground's lateral impulse / dt. It is shown per tyre class, with the old Coulomb law dashed. The new law is
  linear in tan(beta) with slope cN, then saturates at mu = 0.8 (grass). The old law reaches 0.49 W by 0.5 deg and the
  full mu W by 1 deg.
- `rollout.svg` / `rollout_zoom.svg`: the user's Cub (builds/cub_2026-09-20_corrected.json), flown round HOME by THE
  PILOT (tools/pilot_trace.js) in a steady 3 / 4 / 5 m/s straight across the strip. The plot shows the heading error
  from 1 s before touchdown to the stop. Before: 110.3 / 89.2 / 151.3 deg (ground loops). After: 8.0 / 10.4 / 12.3 deg,
  0 / 0 / 1 reversals, 0.2-0.3 m off the centre line at the stop. The zoom adds the rudder (x 20).
- `rollout_<w>_<before|after>.csv`: pilot_trace's 0.1 s trace, trimmed to the flare, the roll-out and the stop.
  Columns: t, phase, agl, aglT, V, vs, pitch, bank, e (heading error, deg), xt, s, thr, de, dr, flap, ...
- `rollout.json`: pilot_trace's summaries.
- `perf.txt` / `perf.json`: sim.step(1/60) of the Cub and the metal Cessna (damage off) in three cases: parked,
  taxiing at 8 m/s (the new term's branch) and in the air. Base core against this one, in alternating child
  processes; each figure is the median of 15 processes' medians.
