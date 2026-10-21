# EAST-POINT-DEPART (G2450) - evidence

Every run here is **node, the game's flight** (`tools/_tour_lib.js` gameHost: the worker's host and placement, the
page's pilot with the garage's shakedown and the nav, DAY_CLOCK's default day ticked - 8 kt from 250 deg, gust 0.15,
the sea breeze - and the load door's aeroplane: the user's Cub at 27 L / 460.4 kg), **damage ON**, unless the file
name says otherwise. No GPU run in this session.

Trees (SHA):
- `it2_4bf4bd37` - origin/claude/island-tour-2-g1975x (ISLAND-TOUR-2, the tree that reproduces TOUR-REAL's page to
  1.8 m a leg) - THE GAME'S CASE.
- `base_57aeaf39` - this branch's base: pilot-integration (train 38 + ENGINE-TORQUE + ROUTE-DRAW) + PILOT-PROFILE
  cf3fc61b + ISLAND-TOUR-2 4bf4bd37, nothing of G2450.
- `after_7bb649ab` - this branch with every G2450 change but the last (build 5db5fccfca2b); `after` without a SHA:
  f7a27621 (build 5950b726b2c9) - the hold's no-go on a tailwind only, nothing else.
- `it2_4bf4bd37_plus_departure_patch` - the game's tree with ONLY the departure hunks of 43_pilot.js
  (`it2_4bf4bd37_departure_patch.diff`: the named way out, the roll on to the end, the go / no-go over the ground,
  the hold's check in its first form - 1.0 x TORun; irrelevant here: the run is into wind).
- Traces (`trace_*.json.gz`, tools/ep_depart.js --trace, a row every 0.25 s: t, phase, s / c on the departure strip,
  agl, ground speed, airspeed, the wind along the strip, thr, brake, flap, then for the arrival: the distance to the
  To, h, the ground, the plan's h, the vertical air, Veas, thr, the nose against the To's axis, dr, brake, wheels):
  - `trace_dep_it2` (it2): the departure rejected - rolled from 37.7 m in TOWARD THE CLOSED END, ground speed over
    airspeed (the 4.4 m/s tailwind), abort past the far end.
  - `trace_dep_it2_after` (it2 + the departure patch): rolled on 19 m, turned 7 m from the end, rolled from 5.9 m
    in the named way into the wind, lift-off 54.8 m, on to Jumbo Mine.
  - `trace_dep_after2` (the branch, mid-session): the same, from base_57aeaf39's own landing.
  - `trace_dep_tail` (the branch, the wind turned to 070): the wait, then the decline - no roll.
  - `trace_arr_before` / `trace_arr_after`: HOME > East Point's arrival - INBOUND over the 667 m ridge 3.9 km
    out, the final from 1693 m at 593 m (before) / the circuit joined, the final from 1628 m at 117 m (after).
  - `trace_dep_w3` / `trace_dep_w3b`: Tamgas Hill > the altiport - the IAF reached 260 m under the strip, FLARE
    2.3 km out, broken up (w3: mid-session tree, before the climb hold) / the climb hold, the circuit, landed (w3b).

Logs: `base_57aeaf39_tour_*` (island_tour.js), `it2_4bf4bd37_*`, `*_arrival_HOME_nv.log` (ep_depart save),
`jodel_* / c172_*_before_decline.log` (HOME > East Point before the destination check: both go round twice; the
Jodel breaks up, the C172 diverts and overruns Tamgas Hill), `after_destination_check.log` and
`after_replay_nv_tailwind_decline.log` (both on f7a27621, the branch's last core change).

Added at the end of the session:
- `gates_base.log` / `gates_base_tour.log` - the battery on base_57aeaf39 (the before column); `gates_after2_7bb649ab.log`
  - the battery on 7bb649ab; `gates_after3.log` - TAKEOFF + PILOT on f7a27621 (the last core change: the hold's
  no-go on a tailwind only); GATE LINEUP on f7a27621 is in the HANDOVER entry (FAIL (3), the base's three).
- `after_mid_tour_land_original_order.log` - island_tour.js --order HOME,w3,tw_ski,mn_strip,w2,HOME (no East Point)
  on the mid-session tree (escape fix, before the steer-integral change): the same 02/20 ground loop - the red is not
  East Point's.
- `trace_dep_nv_w2_rollout(_fixed).json.gz` - East Point > 02/20 from the tour's own chained state
  (`ep_depart save --chain HOME,w3,tw_ski,mn_strip,nv_strip`): the roll-out's swing with the G2080 integral at idle /
  straight with it under power only. `after_chain_to_w2.log` + `trace_dep_w2_home.json.gz` - the chain to 02/20 and
  02/20 > HOME: the 13/31 landing in 5.0 m/s of direct crosswind, 7 deg of crab at the touchdown, the weathercock past
  full rudder (the same with the integral on at idle).
