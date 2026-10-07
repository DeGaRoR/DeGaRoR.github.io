### TOUR-REAL: page vs node, leg by leg (the same measures from both tracks)

| leg | done page / node | faults page / node | sim time page / node | ground turn, max off centreline page / node | roll from the end page / node | lift-off run page / node | touchdown past thr, off centre page / node | roll-out page / node | deviation p50 / p95 / max (both ways) | stretches > 20 m |
|---|---|---|---|---|---|---|---|---|---|---|
| HOME > nv_strip (node landed at w3) | yes / NO | none / ground-loop, off-strip, diverted | 923.1 s / 1596.3 s | 104.3 deg, 269.7 m / 104.6 deg, 274.9 m | 108.9 / 109 | 115.2 / 105.5 | 33.2 m, 0 m / 146.1 m, 0 m | 98.3 / 154.2 | 24.4 / 204 / 433 (1901.5) | 8 |
| nv_strip > mn_strip (node left w3) | NO / NO | abort, abort / where, ground-loop, off-strip | 317 s / 854.3 s | 722.5 deg, 19 m / 210.6 deg, 17.8 m | 37.3 / 31.5 | - / 96.4 | - / 50.8 m, 0 m | - / 133.3 | 4586.4 / 4608.9 / 4611.7 (14455.2) | 1 |
| mn_strip > tw_ski | NO / yes | none / none | - s / 860.8 s | - deg, - m / 198.1 deg, 2.8 m | - / 54.1 | - / 117.6 | - / 56.5 m, 0 m | - / 286.2 | - | - |
| tw_ski > w3 | NO / yes | none / none | - s / 469.5 s | - deg, - m / 202.1 deg, 18.6 m | - / 24.4 | - / 90.7 | - / 143.7 m, 0 m | - / 152 | - | - |
| w3 > HOME | NO / yes | none / none | - s / 446 s | - deg, - m / 210.7 deg, 17.8 m | - / 31.6 | - / 94 | - / 532.6 m, 0 m | - / 177.7 | - | - |

### every stretch where the page flew more than 20 m from node's track

| leg | stretch (leg s) | max | page phases | where | node at that point |
|---|---|---|---|---|---|
| HOME > nv_strip | 226.3-315.3 | 64.9 m | INBOUND | on HOME (agl 159.2 m) | INBOUND at 245 s, agl 157.5 m |
| HOME > nv_strip | 382.1-653.3 | 193.9 m | INBOUND | 2285.6 m from nv_strip (agl 559.1 m) | INBOUND at 739.3 s, agl 586.8 m |
| HOME > nv_strip | 655.1-666.8 | 146.1 m | INBOUND FINAL | 1906.3 m from nv_strip (agl 568.2 m) | FINAL at 759.5 s, agl 589.7 m |
| HOME > nv_strip | 736.1-739.6 | 23.3 m | CROSSWIND | 486.3 m from nv_strip (agl 355.1 m) | CROSSWIND at 840.8 s, agl 433.7 m |
| HOME > nv_strip | 744.6-794.1 | 217 m | CROSSWIND DOWNWIND BASE | 1205.6 m from nv_strip (agl 238.7 m) | DOWNWIND at 863.3 s, agl 365.9 m |
| HOME > nv_strip | 795.8-800.6 | 80.9 m | BASE | 1775.9 m from nv_strip (agl 199 m) | DOWNWIND at 886.5 s, agl 307.8 m |
| HOME > nv_strip | 802.3-826.8 | 283.5 m | BASE FINAL | 1681.8 m from nv_strip (agl 162.2 m) | FINAL at 770.5 s, agl 572.9 m |
| HOME > nv_strip | 894.6-923.1 | 433 m | FINAL FLARE ROLLOUT STOPPED | on nv_strip (agl 1 m) | INBOUND at 1007.3 s, agl 189.9 m |
| nv_strip > mn_strip | 0-317 | 4611.7 m | TAXI STOP HOLD LINEUP ROLL ABORT STOPPED | on nv_strip (agl 1.1 m) | ENROUTE at 606.5 s, agl 251.7 m |

### the pilots' own verdicts

- **HOME > nv_strip** page pilot: go-around: high on the slope 537 m out (attempt 1) · rate {"mean":2,"min":1.91,"simOverWall":2}
  node pilot: strip-short: 150 m of strip for a 135 m landing run — landing short-field, no margin; go-around: high on the slope 537 m out (attempt 1); go-around: high on the slope 541 m out (attempt 2); divert: twice round East Point Clearing — diverting to Tamgas Hill Strip (520 m, 13.8 km)
- **nv_strip > mn_strip** page pilot: pivot: a 197 deg turn tighter than the wheels steer (11.3 m) — turning on the spot; rejected-takeoff: will not reach Vr: 1.48 m/s^2 needs 59 m more, 65 m left · rate {"mean":2,"min":1.94,"simOverWall":1.99}
  node pilot: no verdict
- **mn_strip > tw_ski** page pilot: - · rate null
  node pilot: pivot: a 217 deg turn tighter than the wheels steer (11.3 m) — turning on the spot; committed-takeoff: past the point of stopping at V=12.9 with 136 m left — Vr in 36 m, continuing; slope: stopped on a 10.1 % grade — rolling 220 m on to the level part
- **tw_ski > w3** page pilot: - · rate null
  node pilot: committed-takeoff: past the point of stopping at V=15.9 with 268 m left — Vr in 3 m, continuing
- **w3 > HOME** page pilot: - · rate null
  node pilot: no verdict

### the ground and the obstacles

- terrain: the page's ground under the aeroplane vs node's terrainH at the same point over 4978 samples: max 0 m, 0 samples over 1 m (worst {"x":5562.4,"z":-6026.4,"page":346.8,"node":346.8,"phase":"INBOUND","leg":1,"where":"4964.5 m from SEA"})
- obstacles: node's world 324, the page's registry at the stops 305, the page's that node lacks 202 ({"traffic":9,"house":84,"outbuilding":12,"car":77,"boat":10,"prop":5,"mast":5}), 12 of them within 60 m of either track
- world: page {"weather":null,"woodSolid":false} · node {"weather":null,"day":{"cloudCover":0.2,"cloudSeed":1,"cloudType":"cu","date":"2026-06-21","groundAlbedo":0.15,"ozone":300,"rate":1,"rh":0.5,"turbidity":2.5,"utc":64800},"woodSolid":true,"obstacles":324,"trunks":0}
