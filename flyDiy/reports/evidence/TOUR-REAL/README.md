# TOUR-REAL (G2065-G2069, 2026-10-06): the island tour flown by the GAME, on the GPU, against the node tour

The user (5 Oct): "the ultimate test of pilot one should be to do a full tour of the island's location in one go. Land at
each, u-turn, take-off again, visit the next one. Success when it gets undamaged back to the mother airport." (6 Oct, on
ISLAND-TOUR's node-only tours): "we'll need to check the path of island-tour with a real GPU run, because that sounds
fishy to me." And (6 Oct, via A0): "ISLAND-TOUR ignored East Point, which was the one I was interested in."

## VERDICT

**The node tour is NOT what the game flies, but it gets closer when node is given the game's day.** On the ground the
two agree to about a metre: the same taxi out of HOME, the same U-turns (198.1 vs 198.0 deg at Jumbo Mine, 2.8 m off the
centreline in both), the same roll starts (54.1 / 54.1 m in). In the air they diverge from the climb-out on (65-135 m en
route, 300-460 m at every base / final turn). Three causes were measured. The rest of the gap is not explained yet:

1. **THE WIND.** ISLAND-TOUR's node world is CALM. The game's default day ("Standard - light breeze 8 kt", 250 deg,
   gust 0.15, the sea breeze on, 16:00 AKDT) blows about 7 m/s at circuit height. Given the page's day
   (`tour_real_node.js --day`), node's first East Point go-around moves from 825 s to 723 s, against the page's 721 s.
   The two worlds' wind fields agree to within 0.07 m/s at East Point's final, at every height and time sampled.
2. **THE LOAD.** The game flies the user's Cub with **29 L** of fuel at 462 kg. Node takes the build file's `spec.fuel`
   45 L at 476 kg. (`--fuel` on the node runner did not take: the litres live elsewhere in the build path. Open.)
3. **THE AIR WORK.** In the same wind the page flies INBOUND faster and lower (36-38 vs 30 m/s ground speed, 50-70 m
   lower). It turns base / final 300-400 m earlier, and its legs run up to 65 s shorter. Its roll-outs are about half of
   node's (49 / 59 / 87 m vs 129 / 135 / 196 m). Not explained by the load alone. Candidates: the page pilot's shakedown
   (trim) for its own load, the worker world's obstacles (the page's registry holds 249 streamed things, node's 324), the
   trees (the page's solver: woodland cylinders OFF, 59 559 drawn trunks; node: woodland solid, no trunks).

Ruled out, measured: the terrain (the page's ground under every sample = node's terrainH, 0 m over 16 115 samples), East
Point's runway model (the slope the obstacles ask: 0.1701 in node, 0.17 in the page, solid woodland or not), the wind
field (above), the step (2x = 120 x 1/60 s steps per wall second, sim/wall 1.98-2.0, worker dilation 1.00 throughout, no
drop to 1x in either run).

**THE TOUR, PAGE:** not one tour in one go. **East Point LANDS in the game** (node never lands there), **but the Cub
cannot take off from it** - rejected twice. The rest of the island (a fresh roll-out) is flown clean and back to HOME.

## THE RUNS (the page: master 1ae2eebb (train 36) + ISLAND-TOUR 761ce1ef + PILOT-ONE 5d294064 + PILOT-ONE-2 ed826c23, build b8d94946)

Built in scratch worktrees (D:/Dev/wt-tour, D:/Dev/wt-tour2), never committed:
- ISLAND-TOUR onto master: the cooked side taken from ISLAND-TOUR (master's MILL-TAXI cook equals ISLAND-TOUR's base to
  the byte); run_gates' TOUR row kept; generated files rebuilt.
- + PILOT-ONE: `90_node_exports` unioned, minus the retired `makeAutopilot` / `makeTestPilot`, plus `PILOT_PROFILES`,
  `pilotProfile`, `servoStepHold`. `41_test_pilot.js` deleted, as PILOT-ONE retires it (master had only a comment change
  in it).
- + PILOT-ONE-2: its 4 hunks taken in 43_pilot (aimBack, flLeft, the centreline-only pivot). Its later tips f59a6231 and
  ed826c23 merged clean.

The game's own handles only. The page: `index.html?damage=0`, a fresh Chrome profile, the gamer preset (checked:
GFX.get(), RTX 3080). The user's Cub (builds/cub_2026-09-20_corrected.json) in the WIP slot. The route pref v2
`{ base: HOME, to: <first To> }`, so the roll-out departs HOME's stand. EACH NEXT LEG at STOPPED goes through the plate's
To picker (`#selDest` + its change event -> app.js setTo -> destApply -> nextLeg: DEST-TO's From under the aeroplane, a
fresh pilot, no reset, no teleport). The game's 2x (`TEST_FLIGHT.rate(2)`, the pilot flyout's row) was re-armed each poll;
the measured sim/wall is in every leg's line.

| run | order | result |
|---|---|---|
| run1_eastpoint (09:00) | HOME > **nv_strip** > mn_strip > tw_ski > w3 > HOME | HOME > East Point **landed** (923 s, one go-around); East Point > Jumbo Mine **take-off rejected twice** -> the tour ends at East Point (10.4 min of flight) |
| run2_rest (09:12, a fresh roll-out) | HOME > mn_strip > tw_ski > w3 > HOME | **DONE**, every leg landed and stopped at its To, back at HOME, no fault (23.2 min of flight) |
| node, same source, page's day | HOME > nv_strip > ... | East Point: two go-arounds ('high on the slope 537 / 541 m out'), **diverts to Tamgas Hill**; flies on: Jumbo Mine, the altiport (**landing roll leaves the box, 30 deg ground loop at 10 m/s**), Tamgas, HOME |
| node, same source, calm | the same | East Point: the same diversion; the rest clean, back at HOME |

### EAST POINT (the user's question), in the game - run1_eastpoint/
- **The arrival from HOME** (15.6 km): FINAL begins 1.9 km out at 568 m agl - the cruise height carried into the final.
  At 537 m out it goes around, 'high on the slope' (`stills_L1...`: final1k at 475 m). The circuit that follows is low
  and tight: downwind at 234 m, FINAL from 139 m 1.7 km out (821.8 s), aim 10 m in, flap 1, Vref 16.2 m/s, slope 0.148 against the
  obstacles' 0.17. **Touchdown 29 m in at 0.81 m/s and 15.1 m/s; stopped after 103 m with 19 m of strip left**
  (`stills/L1_touchdown_*`, `L1_stop_*`, `cast_L1_landing.webp`). That is ~4 m/s of TAILWIND on the final: it lands in
  the direction the obstacles allow (0.17 toward -z, against 0.11 the other way).
- **The turn-around**: 'pivot: a 197 deg turn tighter than the wheels steer - turning on the spot', the backtrack, a
  second turn (722 deg of ground turning in all before the roll; `cast_L2_ground.webp`).
- **THE TAKE-OFF FAILS, TWICE.** Both rolls start at the same point, **37.7 m INSIDE the strip** (s +37.7 of +/-75, 112 m
  of gravel ahead, 37 m behind unused). Both run **the same way the landing came - DOWNWIND, a 4.4 m/s (8.6 kt)
  tailwind** - on gravel (1.48 m/s^2). Verdict: 'rejected-takeoff: will not reach Vr: 1.48 m/s^2 needs 59 m more, 65 m
  left'. **Both rejections stop 6.8 m PAST the far end** (s -81.8 against the end at -75; the pilot's own abort record:
  onStrip false, left -7). The retry (the To picked again where it stopped, as a player would) does exactly the same.
  Stills `L2_roll_*`, `L2_abort_*`, `L2_abort1_*`.
- Node with the same pilot never reaches a touchdown (two 'high on the slope' go-arounds, then 'divert twice round East
  Point Clearing -> Tamgas Hill'), calm or with the page's day. The page was already ~100 m lower on the first final; through the
  second circuit it is 130-190 m below node's, and that circuit is what lands.

### THE REST OF THE ISLAND, in the game - run2_rest/
Every leg landed and stopped at its To. The ground work matches node's to the metre (table.md). The turn-arounds: Jumbo
Mine 'pivot 217 deg', committed take-off ('past the point of stopping at V=12.8 with 133 m left, Vr in 31 m'); the altiport
'stopped on a 9.8 % grade - rolling 190 m on to the level part'; Tamgas committed with 271 m left. Node with the page's day
has the altiport landing roll leave the box with a 30 deg ground loop; the page lands there clean (87 m in, 1.3 m off).

### THE THREE ODD LINES IN ISLAND-TOUR's legs_cub.md
- "HOME > w3: on the ground before the roll 104.7 deg, **274.9 m off the centreline**": HOME's STAND - it stands 270-275 m
  beside 13/31 inside the strip's length band, and the measure counts it. The page shows the same (269.7 m). Not flown.
- "w2 > HOME: **roll from the end 576.2 m**": DEST-TO's chain on a 1835 m runway takes off straight ahead from where it
  stopped (no U-turn) - by design; not the "U-turn and take off again" the user pictures.
- "East Point dropped": with PILOT-ONE-2 the Cub LANDS there in the game (not in node); it cannot take off again (above).

## BUGS FOUND (routed - none fixed here, all the pilot's or the arrival planner's)
1. **East Point take-off (PILOT-ONE-2 / 43_pilot):** the roll starts 37.7 m inside a 150 m strip, not from its end, and runs
   downwind (4.4 m/s tailwind), the direction with the easier climb-out (the runway model's 0.106, against 0.17 the other way). It rejects with the run
   it lacks, and **stops past the far end** (onStrip false). The retry repeats it exactly. Wants: backtrack to the very
   end on a short strip, weigh the wind in the departure direction (or hold), and an abort decided early enough to stop
   on the strip.
2. **The cross-country arrival into a short strip (43_pilot planArrival):** INBOUND's cruise height is carried into
   FINAL (568 m agl 1.9 km out), so the first approach is always 'high on the slope' - a go-around every time, in node
   and in the game.
3. **Node vs game drift (tools, ISLAND-TOUR's runner):** the node tour flies a calm day and the build file's fuel. A
   node tour that means 'the game' should take the page's day (`tour_real_node.js --day @legs.json`) and its load.
4. **_tour_lib.flyLeg after a diversion** measures the landing roll against the PLANNED To's box: it reports ground loops
   and off-strip that did not happen (the w3 landing judged on East Point's 150 x 12 m box). tour_real_report re-measures
   each leg on the field really left / landed on.
5. Seen in node only (PILOT-ONE-2 4f1f3f8f, superseded): Jumbo Mine's turn-around stuck at the south end - a 217 deg
   pivot, two 80 s taxi timeouts, 692 steps with a node inside an obstacle, 'nose-over 45 deg' -> rejected. Gone on
   f59a6231 ('a path pivot resumes where the turn comes back') in node and in the game.

## FILES
- `run1_eastpoint/`, `run2_rest/`: `table.md` (page vs node with the page's day, the same measures from both tracks by
  one function; every stretch > 20 m named), `table_vs_node_calm.md`, `compare.json`, `map.png` (the island: node blue,
  page orange, ISLAND-TOUR's cloud json dotted, node's obstacles grey, page-only red), `map_<strip>.png` (each strip close
  up: the U-turns, the rolls, the touchdowns, the stops), `stills_L<n>_*.jpg` (per leg: the chase row and the top-down
  row at depart / U-turn / roll / lift-off / final 1 km / final 300 m / touchdown / stop), `cast_L<n>_uturn.webp` /
  `_landing.webp` / `_ground.webp` (the screencast cut, played at 2x of the 2x), `legs.json` (per leg: the To picker's
  answer, the pilot's report, the obstacles the page held, the rate), `samples.json.gz` (the 4 Hz track: t, x, y, z, agl,
  phase, Vg, nose, onG, leg, wall ms, worker dil, HUD agl, fuel), `flightlog.json.gz` (the game's own flight recorder,
  FLIGHT_REC.save), `run.log`.
- `node/`: the node tours on the same source (4 Hz, phases): `node_pageday` / `node_calm` (run 1's order), `node2_*`
  (run 2's), `node_pilot_one_2_4f1f_run.log` (the superseded tip's Jumbo Mine stick).
- `shakedown/`: the 08:45 rig check (one leg, 100 s).

## REPRODUCE
    node tools/tour_real.js --root <tree> --order HOME,nv_strip,mn_strip,tw_ski,w3,HOME --damage 0 --rate 2 --deadline HH:MM --out <dir>   (GPU lock)
    node tools/tour_real_node.js --root <tree> --order ... [--day @<dir>/legs.json] --out node.json                                       (CPU)
    node tools/tour_real_report.js --root <tree> --page <dir> --node node.json [--cloud tour_cub.json.gz] --out <report dir>
    node tools/tour_real_mock.js --root <tree> --node node.json      (the rig's own check: headless, no GPU, a mock page)
