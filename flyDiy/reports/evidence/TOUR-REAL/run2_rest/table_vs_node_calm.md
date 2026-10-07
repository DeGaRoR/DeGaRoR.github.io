### TOUR-REAL: page vs node, leg by leg (the same measures from both tracks)

| leg | done page / node | faults page / node | sim time page / node | ground turn, max off centreline page / node | roll from the end page / node | lift-off run page / node | touchdown past thr, off centre page / node | roll-out page / node | deviation p50 / p95 / max (both ways) | stretches > 20 m |
|---|---|---|---|---|---|---|---|---|---|---|
| HOME > mn_strip | yes / yes | none / none | 971.4 s / 1048 s | 104.3 deg, 270 m / 104.6 deg, 274.9 m | 108.9 / 109 | 115.2 / 105.5 | 27 m, 0.2 m / 41.5 m, 0 m | 49.3 / 141.5 | 17.1 / 98 / 280.9 (319.6) | 3 |
| mn_strip > tw_ski | yes / yes | none / none | 887.3 s / 862.8 s | 198.1 deg, 2.8 m / 198.1 deg, 2.8 m | 54.1 / 54.1 | 116.3 / 118.3 | 87 m, 1.3 m / 50.3 m, 0 m | 252.2 / 290.6 | 56.5 / 248.7 / 285.4 (1184.4) | 4 |
| tw_ski > w3 | yes / yes | none / none | 465.3 s / 471 s | 206.4 deg, 17.4 m / 204.9 deg, 17.9 m | 27.8 / 26.2 | 62.5 / 91 | 64.7 m, 0.1 m / 146.4 m, 0 m | 59.3 / 151.6 | 3.2 / 129.4 / 296.1 (1095.8) | 3 |
| w3 > HOME | yes / yes | none / none | 446 s / 446.8 s | 210.7 deg, 17.8 m / 210.7 deg, 17.8 m | 31.8 / 31.5 | 98.2 / 93.7 | 525.8 m, -0.7 m / 541.2 m, 0 m | 87.5 / 174 | 476.7 / 2671.7 / 2708 (1698.6) | 1 |

### every stretch where the page flew more than 20 m from node's track

| leg | stretch (leg s) | max | page phases | where | node at that point |
|---|---|---|---|---|---|
| HOME > mn_strip | 230.1-414.1 | 64.1 m | ENROUTE | on HOME (agl 169.8 m) | ENROUTE at 247 s, agl 163.3 m |
| HOME > mn_strip | 543.9-802.1 | 98 m | ENROUTE DOWNWIND BASE | 597.8 m from mn_strip (agl 258.3 m) | DOWNWIND at 859.5 s, agl 259.2 m |
| HOME > mn_strip | 804.1-826.9 | 280.9 m | BASE FINAL | 1673.7 m from mn_strip (agl 352.8 m) | FINAL at 950 s, agl 420 m |
| mn_strip > tw_ski | 108.3-119.8 | 44.8 m | ENROUTE | 1219.3 m from mn_strip (agl 408 m) | ENROUTE at 101.5 s, agl 408.6 m |
| mn_strip > tw_ski | 123.3-134.5 | 67.8 m | ENROUTE | 1078.9 m from mn_strip (agl 384.2 m) | ENROUTE at 111.3 s, agl 396.2 m |
| mn_strip > tw_ski | 197.8-683.3 | 249 m | ENROUTE DOWNWIND BASE | 634 m from tw_ski (agl 601.4 m) | DOWNWIND at 482.5 s, agl 434.8 m |
| mn_strip > tw_ski | 685.6-715.8 | 285.4 m | BASE FINAL | 1388 m from SEA (agl 816.1 m) | FINAL at 668.8 s, agl 722.5 m |
| tw_ski > w3 | 108.3-209.8 | 133.3 m | ENROUTE | 1303.1 m from tw_ski (agl 597.7 m) | ENROUTE at 111 s, agl 685.4 m |
| tw_ski > w3 | 239-293.8 | 131.8 m | ENROUTE DOWNWIND BASE | 522.2 m from SEA (agl 250.9 m) | DOWNWIND at 218 s, agl 425.7 m |
| tw_ski > w3 | 295.8-322 | 296.1 m | BASE FINAL | on SEA (agl 145 m) | DOWNWIND at 271.5 s, agl 259.7 m |
| w3 > HOME | 145.8-446 | 2708 m | ENROUTE DOWNWIND BASE FINAL FLARE ROLLOUT STOPPED | 872 m from w2 (agl 131 m) | DOWNWIND at 196.5 s, agl 121.8 m |

### the pilots' own verdicts

- **HOME > mn_strip** page pilot: no verdict · rate {"mean":2,"min":1.89,"simOverWall":2}
  node pilot: no verdict
- **mn_strip > tw_ski** page pilot: pivot: a 217 deg turn tighter than the wheels steer (11.3 m) — turning on the spot; committed-takeoff: past the point of stopping at V=12.8 with 133 m left — Vr in 31 m, continuing; slope: stopped on a 9.8 % grade — rolling 190 m on to the level part · rate {"mean":2,"min":1.78,"simOverWall":1.99}
  node pilot: pivot: a 217 deg turn tighter than the wheels steer (11.3 m) — turning on the spot; committed-takeoff: past the point of stopping at V=12.9 with 135 m left — Vr in 37 m, continuing; slope: stopped on a 10.1 % grade — rolling 220 m on to the level part
- **tw_ski > w3** page pilot: committed-takeoff: airborne with 271 m of strip left, past the point of stopping — continuing · rate {"mean":2,"min":1.92,"simOverWall":1.98}
  node pilot: committed-takeoff: past the point of stopping at V=15.9 with 267 m left — Vr in 4 m, continuing
- **w3 > HOME** page pilot: no verdict · rate {"mean":2,"min":1.94,"simOverWall":1.98}
  node pilot: no verdict

### the ground and the obstacles

- terrain: the page's ground under the aeroplane vs node's terrainH at the same point over 11137 samples: max 0 m, 0 samples over 1 m (worst {"x":6283.3,"z":-15584.4,"page":332,"node":332,"phase":"ENROUTE","leg":2,"where":"853.7 m from mn_strip"})
- obstacles: node's world 324, the page's registry at the stops 345, the page's that node lacks 242 ({"traffic":33,"outbuilding":12,"car":77,"boat":10,"house":84,"item":5,"prop":16,"mast":5}), 74 of them within 60 m of either track
- world: page {"weather":null,"woodSolid":false} · node {"weather":null,"day":{"cloudCover":0.2,"cloudSeed":1,"cloudType":"cu","date":"2026-06-21","groundAlbedo":0.15,"ozone":300,"rate":1,"rh":0.5,"turbidity":2.5,"utc":64800},"woodSolid":true,"obstacles":324,"trunks":0}
