### leg 1 of TOUR-REAL run2_rest (HOME > Jumbo Mine, the user's Cub, the page's day 8 kt): node under each switch against the page's 4 Hz track

Rig: exp_leg.js here (one leg, the tour's world, damage off as on the page). Deviation = each page sample's distance to node's polyline. Phase times on the sim clock from the first sample.

| variant | what changed | sheet Vs0 / Vref, LDbest, sinkBg | ENROUTE / DOWNWIND / BASE / FINAL / FLARE (s) | touchdown (V, sink, in, run) | deviation p50 / p95 / max |
|---|---|---|---|---|---|
| v0 | the old rig: the build file as written (45 L, 476.2 kg), no shakedown, the page's day frozen, the authored stand settled 600 steps | 16 / 20.8, -, - | 226.5 / 744.5 / 806.8 / 829.3 / 949 | 19.2 m/s, 0.7 m/s, 32 m, 131 m | 5.6 / 63.6 / 324.5 m |
| v1 | + the load door's aeroplane (27 L, 460.4 kg; tools/_load_build.js) | 13.5 / 17.5, -, - | 221.8 / 735.8 / 796.3 / 824.3 / 978.8 | 13.1 m/s, 1.14 m/s, 14 m, 47 m | 7.1 / 38.2 / 269.3 m |
| v2 | + the garage's shakedown behind the pilot's sheet (genShakedown(def, {corners: false}), app.js mkPilot / sim_host) | 13.5 / 17.5, 9.45, 2.35 | 221.8 / 739.5 / 791.5 / 819.5 / 954 | 13.7 m/s, 1.52 m/s, 25 m, 50 m | 6.7 / 36.8 / 39.5 m |
| v3 | + the worker's host (makeSimHost: the page's placement, the nav, the day ticked every step at sim.t) | 13.5 / 17.5, 9.45, 2.35 | 221.8 / 739.5 / 791.5 / 819.5 / 954 | 13.8 m/s, 1.5 m/s, 26 m, 51 m | 6.6 / 37.8 / 40.7 m |
| v4 | + hCruise 115 m (what the page's 29 L aeroplane rounds to; the 27 L one rounds to 110) | 13.5 / 17.5, 9.45, 2.35 | 223.3 / 740.5 / 793.5 / 821.5 / 959 | 13.7 m/s, 1.54 m/s, 25 m, 50 m | 0.9 / 12.5 / 13.4 m |
| page | the game on the GPU (TOUR-REAL run 2, 09:12) | - | 221.1 / 738.1 / 790.9 / 819.1 / 955.9 | 13.8 m/s, 1.56 m/s, 26 m, 50 m | - |

Node's sim clock starts at the host's placement; the page's first sample was 2.4 s in, so node's phase times read ~2.4 s later on the same sim clock (the taxi and the climb: 0.0 m apart, dt +2.4 s throughout).
