### TOUR-REAL: page vs node, leg by leg (the same measures from both tracks)

| leg | done page / node | faults page / node | sim time page / node | ground turn, max off centreline page / node | roll from the end page / node | lift-off run page / node | touchdown past thr, off centre page / node | roll-out page / node | deviation p50 / p95 / max (both ways) | stretches > 20 m |
|---|---|---|---|---|---|---|---|---|---|---|
| HOME > nv_strip (node landed at w3) | yes / NO | none / ground-loop, off-strip, diverted | 923.1 s / 1656.5 s | 104.3 deg, 269.7 m / 104.7 deg, 274.7 m | 108.9 / 108.9 | 115.2 / 124.1 | 33.2 m, 0 m / 67.5 m, 0.1 m | 98.3 / 137.8 | 21.9 / 202 / 460.4 (1854.6) | 7 |
| nv_strip > mn_strip (node left w3) | NO / NO | abort, abort / where, ground-loop, off-strip | 317 s / 797.3 s | 722.5 deg, 19 m / 210.7 deg, 17.8 m | 37.3 / 31.7 | - / 105.8 | - / 36.9 m, 0.1 m | - / 125.7 | 4643.6 / 4677.8 / 4680.6 (14455.3) | 1 |
| mn_strip > tw_ski | NO / NO | none / off-strip (landing), ground-loop (landing), off-strip, ground-loop | - s / 960.8 s | - deg, - m / 198 deg, 2.8 m | - / 54.1 | - / 123.5 | - / 59.6 m, 1 m | - / 278.3 | - | - |
| tw_ski > w3 | NO / yes | none / none | - s / 529.5 s | - deg, - m / 206.9 deg, 17.2 m | - / 27.7 | - / 69.5 | - / 68.5 m, 0.1 m | - / 132.3 | - | - |
| w3 > HOME | NO / yes | none / none | - s / 511 s | - deg, - m / 210.7 deg, 17.8 m | - / 31.6 | - / 103.2 | - / 538.1 m, -0.8 m | - / 206 | - | - |

### every stretch where the page flew more than 20 m from node's track

| leg | stretch (leg s) | max | page phases | where | node at that point |
|---|---|---|---|---|---|
| HOME > nv_strip | 226.6-315.8 | 63.1 m | INBOUND | on HOME (agl 167.7 m) | INBOUND at 246.3 s, agl 164.2 m |
| HOME > nv_strip | 377.3-653.3 | 210.4 m | INBOUND | 2294 m from nv_strip (agl 558.3 m) | INBOUND at 653.3 s, agl 608.9 m |
| HOME > nv_strip | 655.1-666.3 | 143.9 m | INBOUND FINAL | 1898.4 m from nv_strip (agl 568.5 m) | FINAL at 670.3 s, agl 623.5 m |
| HOME > nv_strip | 732.6-759.3 | 59.1 m | CROSSWIND DOWNWIND | 626.4 m from nv_strip (agl 350.8 m) | CROSSWIND at 748.8 s, agl 497.1 m |
| HOME > nv_strip | 792.1-794.1 | 34.1 m | BASE | 1747.7 m from nv_strip (agl 221.3 m) | DOWNWIND at 800.8 s, agl 332.2 m |
| HOME > nv_strip | 795.8-825.8 | 347.4 m | BASE FINAL | 1694.9 m from nv_strip (agl 175.2 m) | INBOUND at 1012.8 s, agl 467.9 m |
| HOME > nv_strip | 890.4-923.1 | 460.4 m | FINAL FLARE ROLLOUT STOPPED | on nv_strip (agl 1 m) | CROSSWIND at 733 s, agl 522.8 m |
| nv_strip > mn_strip | 0-317 | 4680.6 m | TAXI STOP HOLD LINEUP ROLL ABORT STOPPED | on nv_strip (agl 1.1 m) | ENROUTE at 544 s, agl 252.7 m |

### the pilots' own verdicts

- **HOME > nv_strip** page pilot: go-around: high on the slope 537 m out (attempt 1) · rate {"mean":2,"min":1.91,"simOverWall":2}
  node pilot: strip-short: 150 m of strip for a 135 m landing run — landing short-field, no margin; go-around: high on the slope 521 m out (attempt 1); go-around: high on the slope 525 m out (attempt 2); divert: twice round East Point Clearing — diverting to Tamgas Hill Strip (520 m, 13.8 km)
- **nv_strip > mn_strip** page pilot: pivot: a 197 deg turn tighter than the wheels steer (11.3 m) — turning on the spot; rejected-takeoff: will not reach Vr: 1.48 m/s^2 needs 59 m more, 65 m left · rate {"mean":2,"min":1.94,"simOverWall":1.99}
  node pilot: no verdict
- **mn_strip > tw_ski** page pilot: - · rate null
  node pilot: pivot: a 217 deg turn tighter than the wheels steer (11.3 m) — turning on the spot; committed-takeoff: past the point of stopping at V=12.7 with 132 m left — Vr in 37 m, continuing; slope: stopped on a 6.6 % grade — rolling 190 m on to the level part
- **tw_ski > w3** page pilot: - · rate null
  node pilot: committed-takeoff: airborne with 271 m of strip left, past the point of stopping — continuing
- **w3 > HOME** page pilot: - · rate null
  node pilot: no verdict

### the ground and the obstacles

- terrain: the page's ground under the aeroplane vs node's terrainH at the same point over 4978 samples: max 0 m, 0 samples over 1 m (worst {"x":5562.4,"z":-6026.4,"page":346.8,"node":346.8,"phase":"INBOUND","leg":1,"where":"4964.5 m from SEA"})
- obstacles: node's world 324, the page's registry at the stops 305, the page's that node lacks 202 ({"traffic":9,"house":84,"outbuilding":12,"car":77,"boat":10,"prop":5,"mast":5}), 25 of them within 60 m of either track
- world: page {"weather":null,"woodSolid":false} · node {"weather":null,"day":{"cloudCover":0.25,"cloudSeed":1,"cloudType":"cuh","date":"2026-06-22","groundAlbedo":0.15,"ozone":300,"rate":1,"rh":0.5,"turbidity":2.8,"utc":18.03936666666676,"wind":{"kts":8,"dirDeg":250,"gust":0.15,"refH":10,"breeze":1}},"woodSolid":true,"obstacles":324,"trunks":0}
