# strip-decides: old vs new - SUMMARY (FIT-PROCEDURE, 12 Nov 23:45 UTC; partial: TOUR and APSMOOTH still running)

Old = fixes 4dc7bebc (master L39b + fixes). New = strip-decides cc56ea30 (43_pilot.js "the strip decides").

## VERDICT: THE CUB GROUND-LOOPS AT tw_ski UNDER THE NEW RULE -> strip-decides goes to part 2 (A0's rule)

td_probe.js, the game's flight (TOUR's gameHost: the day's 8 kt from 250, the shakedown, the expert, damage on):

| build | leg | old: td bank / roll bank max / drift / axis | new: td bank / roll bank max / drift / axis | new fault |
|---|---|---|---|---|
| the user's Cub (cub_2026-09-20_corrected) | HOME > tw_ski | 0.8 / 1.3 / 8.0 / 7.5 | **-20.9 / 65.8 / 39.3 / 50.9** (pre-td bank 32.5, 20.4 m/s) | ground-loop |
| archetype cub | HOME > tw_ski | 0.8 / 1.3 / 6.6 / 6.2 | **23.3 / 34.4 / 99.9 / 89.9** (sink 2.9 m/s, 16.7 m/s) | ground-loop: the nose 30.8 deg off the roll |
| the user's Cub | HOME > nv_strip (East Point) | 2 go-arounds, divert to w3, td 0.0 / 0.8 / 1.2 / 0.7 | identical | - |
| archetype cub | HOME > nv_strip | 2 GA, w3, 0.2 / 0.7 / 2.1 / 1.1 | identical | - |
| both Cubs | w3 > HOME | 0.6 / 1.5-1.6 / 11.7 / 8.8-9.2 | identical | - |

(deg; td = the first wheel contact after > 15 m; roll bank = the largest on the ground after it; drift = the nose against
its heading at td while > 2 m/s; axis = the largest error to the strip's axis while > 5 m/s, > 30 = a ground loop.)

This is REAL-FIGURES' 57e18a499 failure (the power-on STOL flare on a no-device taildragger rolls the slow wing): the
whole STOL-PILOT technique (gsStol, the power-on flare, deStol, the derotate stick, the brakes at once) on a strip the
expert plans short-field. At East Point the Cub is unchanged (it still goes round twice and diverts): the rule bought
nothing there and broke tw_ski.

The other no-device taildragger archetypes (pietenpol tigermoth stearman camel pittsAlike sesqui jodel chinook savannah
ul1 motorglider radial beaver) DECLINE the take-off for East Point at HOME (old and new alike), so this order does not
reach their landings; a second probe order (HOME,tw_ski,HOME,w3,HOME) follows.

## The canon gates (old vs new, same machine, same night)

| check | old | new | diff |
|---|---|---|---|
| STOL --selftest | PASS | PASS | none (byte-identical) |
| PILOT shards 0/1/2 | PASS | PASS | none (byte-identical) |
| ACCEPT --show | PASS | PASS | none (byte-identical) |
| PROFILE | PASS | PASS | cessnaMetal / jodel enroute plans +-1 m, +-5 m top of descent; Cub East Point circuit 256 -> 255 s, 0 GA both |
| PILOTACT | PASS | PASS | none but wall time |
| APSMOOTH, TOUR 0/1/3 | running | running | to follow |

So the gates do not see the ground loop (no gate flies an expert taildragger onto tw_ski with the game's day except TOUR's
land tour - its result follows).

## Files
- td_probe.js, README.md: the probe and how to run it.
- td_old.txt / td_new.txt, td_old.json / td_new.json: the probe's logs and records.
- old.<check>.txt / new.<check>.txt: the canon checks' full output.
