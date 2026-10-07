DMG-RECAL2 (G2383-G2387) - the floatplanes' water circuits, the pilot from SEA's lane back to it, DMGGEAR's circuit rig
(the certificate, the probe, damage on as the DMG gates fly it), before (90ebbbff) and after (this branch).

landings.txt                          the 40 landings: outcome, float contact phases (a run of wet frames after >= 3 dry
                                      ones is a new contact), the first touch (t, V over the ground, sink, pitch, bank,
                                      throttle, peak hydro lift / W), the heels at the touch (the stern keel over the step
                                      keel, deg, per float), the spreaders' peak (the worst FLD-FLD gear member's force
                                      over its certified yield), the pilot's verdicts
<before|after>_<key>_<U>_<th>.csv     each landing, every frame, 4 s before the first touch to 14 s after:
                                      t, phase, pitch (deg), bank (deg), V (ground, m/s), vy, wet (floats), Fy/W,
                                      spreader, comp (1: compression), thr, de, aglG, vlat (over the lane, m/s), da, dr
                                      key: twinFloats (the game's twin on floats), floats (the Cessna on floats);
                                      U m/s from th deg off the lane's heading (90: DMGGEAR's crosswind side);
                                      3.312 / 4.984 = 0.2 V_S0 of each
floats_5_0_final_<before|after>.txt   the Cessna on floats' final in 5 m/s of headwind, every second (every 0.1 s
                                      under 16 m), with TECS's demand: after, the elevator pushes to -0.17..-0.19 and
                                      the nose drops by itself three times (NOT SOLVED 1); before, the raised Vref's
                                      final never pushes past -0.04
Scripts: ../scripts/ (water_landing.js, summary.js, trace_svg.js, final_trace.js); run from flyDiy/ with ROOT=$PWD.
