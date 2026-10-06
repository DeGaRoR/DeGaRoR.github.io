### TOUR-REAL: page vs node, leg by leg (the same measures from both tracks)

| leg | done page / node | faults page / node | sim time page / node | ground turn, max off centreline page / node | roll from the end page / node | lift-off run page / node | touchdown past thr, off centre page / node | roll-out page / node | deviation p50 / p95 / max (both ways) | stretches > 20 m |
|---|---|---|---|---|---|---|---|---|---|---|
| HOME > nv_strip | yes / yes | none / none | 923.1 s / 924 s | 104.3 deg, 269.7 m / 104.3 deg, 275 m | 108.9 / 108.9 | 115.2 / 115.2 | 33.2 m, 0 m / 32.8 m, 0 m | 98.3 / 98.8 | 0 / 0 / 0.1 (5.3) | 0 |
| nv_strip > mn_strip | NO / NO | abort, abort / abort-retried, abort | 317 s / 296.8 s | 722.5 deg, 19 m / 722.4 deg, 19 m | 37.3 / 37.3 | - / - | - / - | - / - | 0 / 1.2 / 1.8 (3.2) | 0 |

### every stretch where the page flew more than 20 m from node's track

| leg | stretch (leg s) | max | page phases | where | node at that point |
|---|---|---|---|---|---|

### the pilots' own verdicts

- **HOME > nv_strip** page pilot: go-around: high on the slope 537 m out (attempt 1) · rate {"mean":2,"min":1.91,"simOverWall":2}
  node pilot: go-around: high on the slope 537 m out (attempt 1)
- **nv_strip > mn_strip** page pilot: pivot: a 197 deg turn tighter than the wheels steer (11.3 m) — turning on the spot; rejected-takeoff: will not reach Vr: 1.48 m/s^2 needs 59 m more, 65 m left · rate {"mean":2,"min":1.94,"simOverWall":1.99}
  node pilot: pivot: a 197 deg turn tighter than the wheels steer (11.3 m) — turning on the spot; rejected-takeoff: will not reach Vr: 1.48 m/s^2 needs 59 m more, 65 m left

### the ground and the obstacles

- terrain: the page's ground under the aeroplane vs node's terrainH at the same point over 4978 samples: max 0 m, 0 samples over 1 m (worst {"x":5562.4,"z":-6026.4,"page":346.8,"node":346.8,"phase":"INBOUND","leg":1,"where":"4964.5 m from SEA"})
- obstacles: node's world 324, the page's registry at the stops 305, the page's that node lacks 202 ({"traffic":9,"house":84,"outbuilding":12,"car":77,"boat":10,"prop":5,"mast":5}), 0 of them within 60 m of either track
- world: page {"weather":null,"woodSolid":false} · node {"weather":null,"day":{"cloudCover":0.25,"cloudSeed":1,"cloudType":"cuh","date":"2026-06-22","groundAlbedo":0.15,"ozone":300,"rate":1,"rh":0.5,"turbidity":2.8,"utc":1239.489266665868,"wind":{"kts":8,"dirDeg":250,"gust":0.15,"refH":10,"breeze":1}},"woodSolid":true,"obstacles":324,"trunks":0}
