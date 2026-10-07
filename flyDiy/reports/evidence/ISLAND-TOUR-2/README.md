# ISLAND-TOUR-2 (G1970, 2026-10-06): the node tour flies the GAME's flight - and now matches the game's tracks

TOUR-REAL (G2065) flew the island tour in the game on the GPU and found that the node tour was not what the game flies. The ground work agreed to about 1 m. In the air the tracks were 65-135 m apart en route and 300-460 m apart at every base or final. Node's touchdowns were 19 m/s against the page's 14, and its roll-outs were twice as long. Node never landed at East Point; the page did. Part of the INBOUND gap was left unexplained.

This session explains all of it. GATE TOUR, `island_tour.js` and `tour_real_node.js --game` now fly the game's flight. With the aeroplane TOUR-REAL's page actually flew (29 L), node follows the page within **1.8 m** on every leg of both of TOUR-REAL's runs, with the same verdicts to the decimal.

## 1. The INBOUND gap, bisected (`bisect_leg1/`)

The rig is leg 1 of TOUR-REAL run 2 (HOME > Jumbo Mine, 15.6 km, the page's day). Node flew it once per switch, each switch added on top of the last, and every run was measured against the page's 4 Hz track (`bisect.md`; `xtrack_v3.txt` / `xtrack_v4.txt` hold the cross-track per 10 s).

| variant | deviation p50 / p95 / max | touchdown V, roll-out |
|---|---|---|
| v0 the old rig (the file's 45 L, 476.2 kg; no shakedown) | 5.6 / 63.6 / **324.5 m** | 19.2 m/s, 131 m (TOUR-REAL's node, reproduced) |
| v1 + the load door's aeroplane (27 L, 460.4 kg) | 7.1 / 38.2 / 269.3 m | 13.1 m/s, 47 m |
| v2 + the garage's shakedown behind the pilot | 6.7 / 36.8 / **39.5 m** | 13.7 m/s, 50 m |
| v3 + the worker's host (placement, nav, the day ticked at sim.t) | 6.6 / 37.8 / 40.7 m | 13.8 m/s, 51 m |
| v4 + hCruise 115 m | 0.9 / 12.5 / **13.4 m** | 13.7 m/s, 50 m |
| the page | - | 13.8 m/s, 50 m |

Three causes:
1. **The aeroplane.** The page never flies the file as written. JOIN-PARITY's load door reshapes the nose tank to the bay: 45 L becomes 27-29 L, the CG moves aft, and the measured landing-configuration stall Vs0 drops from 16.0 to 13.5 m/s. Vref drops from 20.8 to 17.5. That is the touchdown speed and the halved roll-out.
2. **The pilot's machine sheet.** The page builds its pilot with the garage's shakedown (app.js mkPilot, sim_host `pilot.shakedown`). Node's pilot had none, so LDbest and the idle sink were missing. That changes the steepest approach the pilot may plan (gsMax 1.4/LDbest) and the TECS descent. This is the 300-460 m gap at base and final; the "faster, lower INBOUND" was the same descent planned differently.
3. **The cruise height's rounding step.** genAP computes `hCruise = round(min(7 Vs, 90 VClimb gamma) / 5) * 5`. The 27 L Cub has 7 Vs = 112.32, which rounds to 110. TOUR-REAL's page flew 29 L (462.3 kg, its tank shaped against a crew still loading; JOIN-PARITY's G1986 fixed that afterwards). Its Vs is 16.079, so 7 Vs = 112.55, which rounds to 115. The page's climb therefore turned on course at 107.5 m instead of 102.5 m, and the en-route track ran a parallel 37 m offset. About 1.5 kg moves the cruise height by 5 m: a cliff in genAP worth knowing about.

Measured and not needed for these legs: the page's obstacle registry (305-345 at the stops, against node's 324; none of the page-only things within 60 m of either track), the trees (the page's solid woodland is off and its 59 559 drawn trunks are on; node's woodland is solid), and the viewers' wind queries and convection seed. Node matches to 0.1 m without any of them.

## 2. Node against the page, the whole of TOUR-REAL (`vs_page/`)

Reports come from `tools/tour_real_report.js` (TOUR-REAL's own measure). Node runs `tools/tour_real_node.js --game --day @<the run's legs.json>`.

**The page's own aeroplane (`--capacity 29`), `run1_29/` and `run2_29/`:**

| leg | deviation p50 / p95 / max | touchdown past thr page / node | roll-out page / node | pilot verdicts |
|---|---|---|---|---|
| HOME > East Point | 0 / 0 / **0.1 m** | 33.2 / 32.8 m | 98.3 / 98.8 m | both: go-around 'high on the slope 537 m out' |
| East Point > Jumbo Mine | 0 / 1.2 / 1.8 m | - | - | both: pivot 197 deg; 'rejected-takeoff: will not reach Vr: 1.48 m/s^2 needs 59 m more, 65 m left', twice, rolls from 37.3 m in |
| HOME > Jumbo Mine | 0 / 0 / 0.1 m | 27.0 / 27.3 m | 49.3 / 48.9 m | none / none |
| Jumbo Mine > the altiport | 0.3 / 1.3 / 1.7 m | 87.0 / 88.0 m | 252.2 / 249.9 m | the same pivot, commit and slope verdicts |
| the altiport > Tamgas Hill | 0.1 / 0.3 / 0.9 m | 64.7 / 65.3 m | 59.3 / 57.9 m | committed-takeoff 271 m left (both) |
| Tamgas Hill > HOME | 0 / 0.8 / 1.6 m | 525.8 / 521.7 m | 87.5 / 92.2 m | none / none |

No stretch is more than 20 m apart, and the terrain under the page's samples differs from node's by 0 m.

**Today's load door (27 L), `run1_27/` and `run2_27/`:** the same verdicts, the same outcomes and the same touchdowns within 4 m. The air work is 37-67 m apart, all of it the 110/115 m cruise height (cause 3). It is named, not a node/page difference: once JOIN-PARITY lands, the game itself flies 27 L.

**East Point, in node as in the game:** the Cub lands (node never did before) and cannot take off. That is the departure TOUR-REAL routed to PILOT-ONE-2: the roll starts 37 m in, runs downwind, and the abort stops past the end.

## 3. The tours in the game's flight, damage ON (GATE TOUR's job; `tours/`, `c172_tamgas/`)

| tour | result | bisect |
|---|---|---|
| the Cub, HOME > Tamgas Hill > the altiport > ... | **FAIL at Tamgas Hill > the altiport.** The straight-in final sinks to 0.2 m over the hillside 294 m out, touches down 62 m off the centreline past the strip, ground-loops; with the damage on, a wing breaks | Damage off: the same touchdown (5.7 m/s sink, 62 m off). **Calm day: lands** (14.7 m clear, 12.4 m/s). The default breeze at the altiport is a pilot item. The page never flew this leg (TOUR-REAL ran it the other way round). |
| the Cub, HOME > East Point > Jumbo Mine | lands at East Point; the take-off is rejected twice | = the page (above) |
| the C172, HOME > Tamgas Hill > ... | **FAIL at Tamgas Hill.** 'vref-raised: the elevator cannot hold 28.9 m/s at this power'; touchdown at 31.1 m/s, stopped 53 m past the end of the 520 m strip | Calm day: the same (32.3 m/s, 121 m past). The old rig with the load door's aeroplane: the same (33 m/s). **The file's aeroplane in the game's flight: lands** (21.7 m/s, 195 m). This is the load door's C172 with its engine at the drawn station, 65 cm forward (JOIN-PARITY). |
| the float Cessna, Annette Dock > Metlakatla | **FAIL.** 'vref-raised: ... 31.7 m/s'; touchdown at 40.7 m/s, 2.2 m/s sink, 444 members yield, dent | **The file's aeroplane in the game's flight: lands** (25.6 m/s). This is the load door's floatplane: the engine forward, the drawn hulls, static margin 0.176 -> 0.318 (JOIN-PARITY). |

## Files

- `bisect_leg1/`: bisect.md, v0-v4 logs, exp_leg.js (the scratch rig; its paths are this cloud box's), xtrack.py and its two outputs.
- `vs_page/run{1,2}_{29,27}/`: table.md, compare.json, map.png and map_<strip>.png (node blue, page orange; where only orange shows, node lies under it).
- `tours/`: node_game{29,}_run{1,2}.json.gz and .log (tour_real_node's 4 Hz tracks, the format TOUR-REAL's report reads); cub_game / floats_game (.log, .md, .json.gz: island_tour.js in the game's flight, damage on); cub_w3tw_dmg0.log, cub_w3tw_calm.log, floats_raw_game.log (the bisects).
- `c172_tamgas/`: c172_game (.log, .md, .json.gz), c172_game_calm.log, c172_oldrig_loaddoor.log, c172_filesaeroplane_game.log.
