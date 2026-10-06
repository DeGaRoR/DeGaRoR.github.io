### TOUR-REAL: page vs node, leg by leg (the same measures from both tracks)

| leg | done page / node | faults page / node | sim time page / node | ground turn, max off centreline page / node | roll from the end page / node | lift-off run page / node | touchdown past thr, off centre page / node | roll-out page / node | deviation p50 / p95 / max (both ways) | stretches > 20 m |
|---|---|---|---|---|---|---|---|---|---|---|
| HOME > mn_strip | yes / yes | none / none | 971.4 s / 965.8 s | 104.3 deg, 270 m / 104.7 deg, 274.7 m | 108.9 / 108.9 | 115.2 / 124.1 | 27 m, 0.2 m / 34.1 m, 0 m | 49.3 / 128.9 | 5.9 / 63.7 / 324.5 (327) | 2 |
| mn_strip > tw_ski | yes / NO | none / off-strip (landing), ground-loop (landing), off-strip, ground-loop | 887.3 s / 963 s | 198.1 deg, 2.8 m / 198 deg, 2.8 m | 54.1 / 54.1 | 116.3 / 127.8 | 87 m, 1.3 m / 54.8 m, 1 m | 252.2 / 284.6 | 10.2 / 63.5 / 411.2 (1178.4) | 2 |
| tw_ski > w3 | yes / yes | none / none | 465.3 s / 529 s | 206.4 deg, 17.4 m / 205.4 deg, 17.6 m | 27.8 / 26.7 | 62.5 / 68.9 | 64.7 m, 0.1 m / 68.3 m, 0.1 m | 59.3 / 135.5 | 1.8 / 70 / 338.8 (1091.2) | 1 |
| w3 > HOME | yes / yes | none / none | 446 s / 511 s | 210.7 deg, 17.8 m / 210.7 deg, 17.8 m | 31.8 / 31.6 | 98.2 / 102 | 525.8 m, -0.7 m / 540 m, -0.9 m | 87.5 / 195.8 | 0.5 / 180.1 / 399.1 (1077.9) | 2 |

### every stretch where the page flew more than 20 m from node's track

| leg | stretch (leg s) | max | page phases | where | node at that point |
|---|---|---|---|---|---|
| HOME > mn_strip | 231.4-592.7 | 66.3 m | ENROUTE | on HOME (agl 187.7 m) | ENROUTE at 252.5 s, agl 181.6 m |
| HOME > mn_strip | 799.4-826.9 | 324.5 m | BASE FINAL | 1684.2 m from mn_strip (agl 342.1 m) | BASE at 826.8 s, agl 371.9 m |
| mn_strip > tw_ski | 109.5-437.3 | 97 m | ENROUTE | 1225.1 m from mn_strip (agl 411.7 m) | ENROUTE at 106.8 s, agl 390.1 m |
| mn_strip > tw_ski | 668.8-715.5 | 411.2 m | BASE FINAL | 1280.6 m from SEA (agl 817.7 m) | DOWNWIND at 685.8 s, agl 818.3 m |
| tw_ski > w3 | 291.3-321.8 | 338.8 m | BASE FINAL | on SEA (agl 145.8 m) | FINAL at 416 s, agl 106.2 m |
| w3 > HOME | 150.3-225.5 | 134.7 m | ENROUTE | 388.4 m from SEA (agl 147.8 m) | ENROUTE at 152.5 s, agl 149.7 m |
| w3 > HOME | 297.5-340.6 | 399.1 m | BASE FINAL | 887.7 m from w2 (agl 132.2 m) | FINAL at 414.3 s, agl 104.2 m |

### the pilots' own verdicts

- **HOME > mn_strip** page pilot: no verdict · rate {"mean":2,"min":1.89,"simOverWall":2}
  node pilot: no verdict
- **mn_strip > tw_ski** page pilot: pivot: a 217 deg turn tighter than the wheels steer (11.3 m) — turning on the spot; committed-takeoff: past the point of stopping at V=12.8 with 133 m left — Vr in 31 m, continuing; slope: stopped on a 9.8 % grade — rolling 190 m on to the level part · rate {"mean":2,"min":1.78,"simOverWall":1.99}
  node pilot: pivot: a 217 deg turn tighter than the wheels steer (11.3 m) — turning on the spot; committed-takeoff: past the point of stopping at V=12.6 with 131 m left — Vr in 39 m, continuing; slope: stopped on a 5.4 % grade — rolling 190 m on to the level part
- **tw_ski > w3** page pilot: committed-takeoff: airborne with 271 m of strip left, past the point of stopping — continuing · rate {"mean":2,"min":1.92,"simOverWall":1.98}
  node pilot: committed-takeoff: airborne with 271 m of strip left, past the point of stopping — continuing
- **w3 > HOME** page pilot: no verdict · rate {"mean":2,"min":1.94,"simOverWall":1.98}
  node pilot: no verdict

### the ground and the obstacles

- terrain: the page's ground under the aeroplane vs node's terrainH at the same point over 11137 samples: max 0 m, 0 samples over 1 m (worst {"x":6283.3,"z":-15584.4,"page":332,"node":332,"phase":"ENROUTE","leg":2,"where":"853.7 m from mn_strip"})
- obstacles: node's world 324, the page's registry at the stops 345, the page's that node lacks 242 ({"traffic":33,"outbuilding":12,"car":77,"boat":10,"house":84,"item":5,"prop":16,"mast":5}), 82 of them within 60 m of either track
- world: page {"weather":null,"woodSolid":false} · node {"weather":null,"day":{"cloudCover":0.25,"cloudSeed":1,"cloudType":"cuh","date":"2026-06-22","groundAlbedo":0.15,"ozone":300,"rate":1,"rh":0.5,"turbidity":2.8,"utc":18.03936666666676,"wind":{"kts":8,"dirDeg":250,"gust":0.15,"refH":10,"breeze":1}},"woodSolid":true,"obstacles":324,"trunks":0}
