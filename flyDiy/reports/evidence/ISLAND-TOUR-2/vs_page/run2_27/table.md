### TOUR-REAL: page vs node, leg by leg (the same measures from both tracks)

| leg | done page / node | faults page / node | sim time page / node | ground turn, max off centreline page / node | roll from the end page / node | lift-off run page / node | touchdown past thr, off centre page / node | roll-out page / node | deviation p50 / p95 / max (both ways) | stretches > 20 m |
|---|---|---|---|---|---|---|---|---|---|---|
| HOME > mn_strip | yes / yes | none / none | 971.4 s / 967.8 s | 104.3 deg, 270 m / 104.4 deg, 275 m | 108.9 / 108.9 | 115.2 / 115 | 27 m, 0.2 m / 27.2 m, 0.2 m | 49.3 / 49.3 | 6.7 / 37.9 / 40.7 (40.7) | 2 |
| mn_strip > tw_ski | yes / yes | none / none | 887.3 s / 878.5 s | 198.1 deg, 2.8 m / 198.2 deg, 2.8 m | 54.1 / 54.1 | 116.3 / 116.3 | 87 m, 1.3 m / 90.2 m, 1.3 m | 252.2 / 247.5 | 5 / 45.5 / 55.7 (55.6) | 3 |
| tw_ski > w3 | yes / yes | none / none | 465.3 s / 458.3 s | 206.4 deg, 17.4 m / 206.9 deg, 17.2 m | 27.8 / 27.9 | 62.5 / 63.7 | 64.7 m, 0.1 m / 68.7 m, 0.1 m | 59.3 / 56.9 | 0.8 / 43.3 / 50.2 (50.2) | 1 |
| w3 > HOME | yes / yes | none / none | 446 s / 438 s | 210.7 deg, 17.8 m / 210.7 deg, 17.8 m | 31.8 / 31.8 | 98.2 / 97 | 525.8 m, -0.7 m / 522.3 m, -0.6 m | 87.5 / 92.2 | 0.1 / 50 / 66.8 (66.8) | 2 |

### every stretch where the page flew more than 20 m from node's track

| leg | stretch (leg s) | max | page phases | where | node at that point |
|---|---|---|---|---|---|
| HOME > mn_strip | 231.9-523.9 | 40.7 m | ENROUTE | on HOME (agl 185.2 m) | ENROUTE at 247.8 s, agl 183.2 m |
| HOME > mn_strip | 799.9-827.4 | 33.6 m | BASE FINAL | 1664.5 m from mn_strip (agl 348.7 m) | BASE at 817.8 s, agl 341.6 m |
| mn_strip > tw_ski | 108-123.5 | 55.7 m | ENROUTE | 1225.8 m from mn_strip (agl 413.1 m) | ENROUTE at 114 s, agl 407.4 m |
| mn_strip > tw_ski | 130.3-282.5 | 28.5 m | ENROUTE | 983.8 m from mn_strip (agl 286.5 m) | ENROUTE at 131.5 s, agl 273.7 m |
| mn_strip > tw_ski | 667.8-717.5 | 50.1 m | BASE FINAL | 1375.6 m from SEA (agl 816.1 m) | BASE at 694.3 s, agl 811.1 m |
| tw_ski > w3 | 290.5-325.8 | 50.2 m | BASE FINAL | 102 m from SEA (agl 143.8 m) | FINAL at 312 s, agl 139.2 m |
| w3 > HOME | 148.5-213.3 | 66.8 m | ENROUTE | 382.2 m from SEA (agl 147.2 m) | ENROUTE at 156.3 s, agl 149.2 m |
| w3 > HOME | 297-342.8 | 50 m | BASE FINAL | 924.8 m from w2 (agl 131.1 m) | BASE at 321.8 s, agl 125 m |

### the pilots' own verdicts

- **HOME > mn_strip** page pilot: no verdict · rate {"mean":2,"min":1.89,"simOverWall":2}
  node pilot: no verdict
- **mn_strip > tw_ski** page pilot: pivot: a 217 deg turn tighter than the wheels steer (11.3 m) — turning on the spot; committed-takeoff: past the point of stopping at V=12.8 with 133 m left — Vr in 31 m, continuing; slope: stopped on a 9.8 % grade — rolling 190 m on to the level part · rate {"mean":2,"min":1.78,"simOverWall":1.99}
  node pilot: pivot: a 217 deg turn tighter than the wheels steer (11.3 m) — turning on the spot; committed-takeoff: past the point of stopping at V=12.8 with 133 m left — Vr in 31 m, continuing; slope: stopped on a 9.8 % grade — rolling 190 m on to the level part
- **tw_ski > w3** page pilot: committed-takeoff: airborne with 271 m of strip left, past the point of stopping — continuing · rate {"mean":2,"min":1.92,"simOverWall":1.98}
  node pilot: committed-takeoff: airborne with 271 m of strip left, past the point of stopping — continuing
- **w3 > HOME** page pilot: no verdict · rate {"mean":2,"min":1.94,"simOverWall":1.98}
  node pilot: no verdict

### the ground and the obstacles

- terrain: the page's ground under the aeroplane vs node's terrainH at the same point over 11137 samples: max 0 m, 0 samples over 1 m (worst {"x":6283.3,"z":-15584.4,"page":332,"node":332,"phase":"ENROUTE","leg":2,"where":"853.7 m from mn_strip"})
- obstacles: node's world 324, the page's registry at the stops 345, the page's that node lacks 242 ({"traffic":33,"outbuilding":12,"car":77,"boat":10,"house":84,"item":5,"prop":16,"mast":5}), 64 of them within 60 m of either track
- world: page {"weather":null,"woodSolid":false} · node {"weather":null,"day":{"cloudCover":0.25,"cloudSeed":1,"cloudType":"cuh","date":"2026-06-22","groundAlbedo":0.15,"ozone":300,"rate":1,"rh":0.5,"turbidity":2.8,"utc":2761.255900007548,"wind":{"kts":8,"dirDeg":250,"gust":0.15,"refH":10,"breeze":1}},"woodSolid":true,"obstacles":324,"trunks":0}
