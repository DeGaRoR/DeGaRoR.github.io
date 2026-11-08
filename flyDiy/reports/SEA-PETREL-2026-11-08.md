# SEA-PETREL test - the Super Petrel V4.1 as a plane, and its cost (8 Nov 2026)

CLOUD session (not the box). Tester only: no game code changed, nothing pushed but this report.
**Tested commit: `claude/seaplanes-merge` 15ad5d669** (the tip at 10:20 UTC; flight_core.js rebuilt from it is
byte-identical to the committed one; index.html / dev.html / sw.js / version.json were stale after c1ee10ad SEA-OFF and
were rebuilt locally for the gates, not committed). Master for the comparisons: `origin/master` 1bcd01d3 (L35a built).
Where a result is from 7f6e1df64 (the launch base) it says so.

STATUS: IN PROGRESS - sections fill as the runs land. Pushed every 1-2 h.

## The rig (how every flight here was flown)

- The aeroplane: `builds/candidates/superpetrel_V4_1.json` through the load door (`pilot_trace specOf` ->
  `_load_build.js gameSpec`, JOIN-PARITY's one path): 591.8 kg, 72 L, two aboard.
- The flight: `_tour_lib gameHost` (the worker's host, the page's placement - the water start is the game's own, the
  page's pilot with the garage's shakedown, Expert, damage ON, the game's day `DAY_CLOCK` ticked, its wind replaced).
- The driver: a tester's script, `flyDiy/reports/evidence/SEA-PETREL/sp_fly.js` (copied here; it changes nothing in the
  game). It instruments, every frame, the propeller disc's lowest point - the solver's own geometry (the engine nodes'
  centre + R down in the disc's plane, 30_solver propWater / driveFrame) - against the WAVED sea `waterH(x,z,t)` (what
  propWater strikes on), the level water `waterH(x,z)` (what driveFrame strikes on) and the ground; pitch / roll while
  the hull is wet; phases, go-arounds, the landing record; µs per solver frame by surface.
  `node sp_fly.js --root <repo> --order SEA,mk_sea --wind 8@250|0|15@250|xw10 --load full|solo|solo72 [--pre N] [--gear up|down]`
- Cross-check: `tools/tour_real_node.js --game --order SEA,mk_sea --damage 1` (the coordinator's rig) reproduces
  Sunday night's result exactly: **FAIL SEA > mk_sea, 479 s, prop-strike (water, t 452) in the ROLLOUT**, touchdown
  sink 0.36 m/s at 25.6 m/s, run 179 m (841 s wall).

## The flight grid (task 1)

The game's route, Expert, damage ON. Wind is the game's day (`DAY_CLOCK`, gust 0.15, the sea breeze on) with its wind
set to the row's: 0 / 8 kt from 250 (the game's default day) / 15 kt from 250 / a 10 kt crosswind square to the
destination lane. Loads: `full` = the build as saved (two aboard, 72 L - the tank is 72 L, so full and max fuel are
the same aeroplane, 591.8 kg), `solo` = one aboard, 20 L; `solo72` = one aboard, 72 L. The water starts are the
game's own placement (no taxi: the AP rolls from the spawn); a land start taxies from the walked stand (the "short
taxi" of every land leg). The runs are DETERMINISTIC: a repeat is a byte-identical flight, so the repeats are flown
with the start shifted by `--pre N` idle frames (37, 91: the waves and the gusts in another phase).
Prop min = the disc's lowest point over the surface (the waved sea on water), by phase. Evidence `runs/*.json`.

| leg | wind | load | gear held | verdict | td sink m/s | run / td V | prop min, departure (m, phase) | prop min, arrival (m, phase) | roll min/max on water (deg) | pitch min/max on water | go-arounds |
|---|---|---|---|---|---|---|---|---|---|---|---|
| HOME>mk_sea | 0 | full 592 kg | - | PASS | 0.40 | 334 m / 24.9 m/s | 0.72 (ROLL/ground) | 0.13 (ROLLOUT/water) | -4.5 / 1.8 | 0.7 / 13.8 | 0 |
| HOME>mk_sea | 15 kt / 250 | full 592 kg | - | PASS | 0.43 | 132 m / 25.7 m/s | 0.72 (ROLL/ground) | 0.13 (ROLLOUT/water) | -20.6 / 27.1 | -5.6 / 18.0 | 0 |
| HOME>mk_sea | 8 kt / 250 | full 592 kg | - | PASS | 0.25 | 213 m / 25.5 m/s | 0.72 (ROLL/ground) | 0.14 (ROLLOUT/water) | -4.8 / 2.0 | -4.0 / 13.5 | 0 |
| HOME>w3 | 0 | full 592 kg | - | PASS | 0.68 | 386 m / 26.8 m/s | 0.72 (ROLL/ground) | 0.75 (ROLLOUT/ground) | - | - | 0 |
| HOME>w3 | 15 kt / 250 | full 592 kg | - | PASS | 0.62 | 327 m / 28.1 m/s | 0.72 (ROLL/ground) | 0.76 (ROLLOUT/ground) | - | - | 0 |
| HOME>w3 | 8 kt / 250 | full 592 kg | - | PASS | 0.66 | 369 m / 27.8 m/s | 0.72 (ROLL/ground) | 0.76 (ROLLOUT/ground) | - | - | 0 |
| SEA>SEA | 0 | full 592 kg | - | PASS | 0.51 | 291 m / 24.6 m/s | 0.17 (ROLL/water) | 0.14 (ROLLOUT/water) | -2.7 / 3.5 | -2.6 / 12.2 | 0 |
| SEA>SEA | 8 kt / 250 | full 592 kg | - | PASS | 0.22 | 251 m / 24.6 m/s | 0.17 (ROLL/water) | 0.15 (ROLLOUT/water) | -1.5 / 5.8 | -2.6 / 11.9 | 0 |
| SEA>mk_sea | 0 | full 592 kg | - | PASS | 0.35 | 341 m / 25.0 m/s | 0.17 (ROLL/water) | 0.13 (ROLLOUT/water) | -4.6 / 1.6 | -2.6 / 13.9 | 0 |
| SEA>mk_sea | 15 kt / 250 | full 592 kg | - | FAIL prop-strike (water t 480.9 ROLLOUT) | 0.47 | 117 m / 25.7 m/s | 0.18 (ROLL/water) | 0.02 (ROLLOUT/water) | -10.9 / 3.5 | -10.5 / 37.0 | 0 |
| SEA>mk_sea | 8 kt / 250 | full 592 kg | - | FAIL prop-strike (water t 452 ROLLOUT) | 0.36 | 179 m / 25.6 m/s | 0.17 (ROLL/water) | -0.09 (ROLLOUT/water) | -5.6 / 14.6 | -5.3 / 42.6 | 0 |
| mk_sea>HOME | 0 | full 592 kg | - | PASS | 0.79 | 479 m / 26.9 m/s | 0.17 (ROLL/water) | 0.76 (ROLLOUT/ground) | -0.8 / 0.6 | -2.6 / 9.1 | 0 |
| mk_sea>HOME | 15 kt / 250 | full 592 kg | - | FAIL abort | - | - | 0.07 (ROLL/water) | - | -1.8 / 2.8 | -6.8 / 26.5 | 0 |
| mk_sea>HOME | 8 kt / 250 | full 592 kg | - | FAIL abort, prop-strike (water t 0.6 ROLL) | - | - | 0.03 (ROLL/water) | - | -1.3 / 2.6 | -10.9 / 9.9 | 0 |


What the grid says so far (the rows still flying are added on the next push):
- LAND ONLY (HOME > w3): passes at 0 / 8 / 15 kt, sink 0.62-0.68, the landing run 327-386 m on Ridgeback's 543 m.
- LAND TO SEA (HOME > mk_sea): passes at 0 / 8 / 15 kt; the gear up for the water; but at 15 kt the roll on the
  water reaches **+27.1 / -20.6 deg** and the pitch 18 deg (a skip with a wing down - a near miss, "bad").
- SEA CIRCUIT (SEA > SEA, the sheltered bay): passes at 0 / 8 kt.
- SEA TO SEA (SEA > mk_sea, landing on the OPEN sea): passes calm, **prop strike in the roll-out at 8 and 15 kt** (S1,
  the porpoise: pitch 42.6 / 37.0 deg).
- SEA TO LAND (mk_sea > HOME, the open-sea start): passes calm (sink 0.79, run 479 m at HOME), **prop strike at t 0.6
  at 8 kt** (S2, the drop), **take-off rejected at 15 kt** (`will not reach Vr: 0.18 m/s^2 needs 1793 m more, 1142 m
  left`: a porpoise on the run, pitch 26.5 deg at 13.9 m/s, the disc 0.07 m over the hump's water).
- EVERY water roll-out that passes still brings the disc to **0.13-0.15 m** over the water (pitch 11-12 deg at 5 m/s,
  coming off the step); every water take-off to **0.17 m** at the hump. The margin is the hull's trim off the step, not
  the chop: on the open sea at 15 kt it is 0.02-0.07 m.
- No go-around anywhere so far; no capsize (roll extremes above); no member yielded or broken on any passing leg.

## Prop strikes: what they are (task 2) - two different mechanisms, neither is the static clearance

Numbers are the disc's lowest point over the water surface it strikes on (`gapW`, the waved sea), node, the game's
route. Evidence: `reports/evidence/SEA-PETREL/diag/*.json` (`hist0` / `strike.story`: rows
`[t, phase, gapW, gapLevel, wave, Vg, pitch, roll, thr, surface, hubOverWater, gear, de, cgOverWater]`).

| where the disc is | clearance | note |
|---|---|---|
| at rest, settled, idle power (calm, either lane) | **0.33-0.43 m** | hub ~1.15 m over the water, pitch -2..+2 deg |
| at rest after a landing (mk_sea, STOPPED) | 0.35-0.40 m | |
| take-off hump, full power (calm, 6.0-6.6 m/s, pitch 6.9-7.0 deg) | **0.17 m** | the take-off's own minimum, every take-off; a chop over ~0.15 m reaches it |
| water start, the drop, calm | 0.18 m (t 0.6) | see S2 |
| water start, the drop, mk_sea 8 kt | **-0.04 m (STRIKE t 0.6)** | see S2 |
| landing roll-out, SEA > mk_sea 8 kt | **-0.09 m (STRIKE t 452)** at pitch 40.8 deg | see S1 |

### S1 THE ROLL-OUT STRIKE (SEA > mk_sea, t 452) IS A PORPOISE / SKIP DIVERGENCE, NOT CLEARANCE OR CHOP - severity: blocks
- Touch at 22.3 m/s, pitch 6.4 deg, sink 0.36 m/s - a good touch. Then the hull SKIPS: water / air alternating every
  ~1.5 s (444.5 -> 451.9: six contacts), the AP switching between its two water roll-out laws at each one (43_pilot
  ROLLOUT: `onG === 0 && V > 0.7 VsW` -> LOC PITCH thr 0.15, the touch attitude held; on the water -> RWY PITCH thr 0).
  The pitch at each re-entry grows: peaks 6.8, 8.4, 9.3 deg, then **32.7 deg** (t 450.2, 15.6 m/s) and **40.8 deg**
  (t 452.1, 8.6 m/s); roll swings to +14.5 deg between them.
- The big pitch-ups are the HULL, not the stick: at 449.6-450.2 the pitch goes 2.5 -> 32.7 deg while the elevator
  goes FORWARD (+0.17 -> -0.30, nose down). Both big ones start from a NOSE-LOW re-entry (pitch 2.5 deg at 17.7 m/s;
  -0.5 deg at 12.5 m/s, the AP then pulling de 0.60 to get its 6 deg back) - a forebody dig that throws the bow up.
  The AP's pull on the second one adds to it (de 0.60 -> 0.32 as the pitch rises 4 -> 18 deg).
- Why the disc goes in: the propeller is a pusher, aft and above the step; at 40 deg nose-up it swings down ~0.8 m
  (hub over the water 1.2 m level -> 0.73 m at 37 deg), the disc's bottom 9 cm under the water. The wave at that
  instant was 0.00 m: chop is not the cause (waves here +-0.12 m).
- Same leg, same day, same lane, landing at mk_sea from HOME: no skip (pitch max 13.5 deg on the water, sink 0.25) -
  the porpoise is sensitive to the touch (the repeats will say how often - UNPROVEN until they land).
- The take-off has a porpoise law (39b `SV.porpoise`, G1880: power ceiling + stick damping in ROLL / LIFTOFF on a
  high thrust line); the landing roll-out has none (`ap.phase === 'ROLL' || 'LIFTOFF'` only). A lead for SEAPLANES,
  not a proven fix.
- Reproduce (14 min wall, deterministic - two rigs agree to the decimal): `node tools/tour_real_node.js --root <repo> --game --build builds/candidates/superpetrel_V4_1.json --order SEA,mk_sea --damage 1`
  (or `sp_fly.js --order SEA,mk_sea --wind 8@250 --load full` for the pitch / elevator story).
- Browser-needed: yes - watch the roll-out at mk_sea (does the hull skip and throw its bow up in the page?).

### S2 THE WATER-START STRIKE (mk_sea > HOME, t 0.6) IS THE PLACEMENT'S DROP INTO THE OPEN SEA - severity: blocks
- The game's water start (sim_host place(): `placeAtAerodrome(sim, sea)` on the reset pose) puts the Petrel on the
  water in its LAND stance: gear handle 1 (down), the tricycle's -2.6 deg pitch, the lowest contact 1 cm over the
  design floor = the wheels at the waterline, so the hull's bottom is ~0.5 m over the water (the CG 0.8 m over it at
  t 0.1, 0.3 m settled; the hub 1.64 m, 1.15 m settled). The AP retracts the gear at t 0.3; the hull falls ~0.5 m.
- The fall pitches it up (the tail settles first): calm, both lanes: pitch -2.6 -> **+4.0 deg** at t 0.7, the disc
  0.18 m clear - no strike. mk_sea 8 kt (the open sea; SEA is sheltered and its wave reads 0.00-0.01 m): the hull
  lands in a moving sea (the wave at the disc -0.15 -> +0.14 m in 1.3 s), pitch **+9.8 deg**, the disc's bottom
  **-0.04 m** under the level water -> drown + prop strike (damage ON: seized), and the take-off is rejected at 252 s
  (4.7 m/s at full throttle).
- So: the water start's drop (a land placement on the water) + the open sea's wave; on SEA's sheltered water it
  survives with 0.18 m. A lead: place a water start at its floating pose (the gear up and the hull at its draft), or
  settle it before handing it over. SEAPLANES' call.
- Reproduce (2 min): `sp_fly.js --order mk_sea,HOME --wind 8@250 --load full --tmax 12 --dump0 12` (strike at 0.6);
  `--wind 0` the same start, no strike.
- Browser-needed: yes - the page's water start at Cedar Harbour (does the page also place it wheels-down and drop it?).

### S3 THE FLOAT CESSNA'S STRIKE (master's TOUR, mk_sea > SEA, t 604.6) IS ANOTHER CAUSE: A CAPSIZE IN A LONG WATER TAXI
- Flown here the same way (the game's route, the load door's float Cessna 949.5 kg / 25 L, 8 kt from 250, chained
  SEA > mk_sea > SEA): leg 1 OK (touch 35.6 m/s, sink 0.47, run 370 m). Leg 2, the chained departure from where it
  stopped at mk_sea, is a WATER TAXI that never ends (TAXI 1796 s of 1800; `taxi-timeout: the route took 958 s`,
  `replan: not lined up with a run ahead (1135 m, 201.5 m off)`, `pivot: a turn of 26 deg that the wheels (Infinity m)
  cannot steer on the route - turning on the spot`). At t 596-604.6, taxiing at 5.7-6.4 m/s on 0.5 throttle, stick 0.30
  back, the roll diverges: +9.9 -> -2.6 -> +13 -> +30 (603.0) -> +90.5 deg (604.6), pitch 4 -> 12 deg; the disc goes
  in as it rolls over: `capsized: on its back in TAXI at 3.5 m/s (bank 90 deg)`, the prop strike at 604.6 exactly as
  master's TOUR reports. The waves were +-0.03 m. Not the Petrel's mechanism (no porpoise, no drop): one taxi that
  should not be 600 s long, and a float Cessna that capsizes at 6 m/s / 0.5 power in it.
- The Petrel has never flown that chained water departure here (its first leg fails at 8 kt): queued (SEA > mk_sea >
  SEA calm, HOME > mk_sea > HOME 8 kt) - UNPROVEN until they land.
- Reproduce (40 min): `sp_fly.js --vkey floats --order SEA,mk_sea,SEA --wind 8@250` (evidence `diag/floats_tour.json`).
- Browser-needed: yes - the water taxi out of Cedar Harbour after a landing.

## Cost (task 4) - counts, and ratios measured on the same cloud machine at the same time (never ms)

| | Cub | twin floatplane (Twin_busher_floats_4b) | float Cessna | **Super Petrel V4.1** | Petrel / Cub | Petrel / twin |
|---|---|---|---|---|---|---|
| nodes | 97 | 123 | - | **184** | 1.9 | 1.5 |
| members | 404 | 500 | - | **811** | 2.0 | 1.6 |
| solver substeps / frame | 75 | 103 | - | **200** | 2.7 | 1.9 |
| members x substeps | 30 300 | 51 500 | - | **162 200** | 5.4 | 3.1 |
| hydro bodies (panels) | - | 2 floats (2 x 388) | - | **hull 608 + 2 tip floats 388** = 1 384 | - | 1.8 |
| hydro rate | - | every 17 substeps = 364 Hz | - | every 33 substeps = 364 Hz | - | same rate |
| solver frame, IN THE AIR (flown legs) | 1.0 | 1.5 | 3.1 | **~6 (5.4-8.1)** | ~6 | ~4 |
| solver frame, ON THE WATER (flown) | - | 2.6 | 4.2-4.9 | **~7.5 (6.1-12.4)** | - | ~3 |
| solver frame, ON THE GROUND (flown: taxi, roll) | 2.0 | - | - | **~13 (11-16)** | ~7 (ground vs ground) | - |
| solver frame at rest on its start (cost.js, 600 frames) | 1.0 | 2.9 | - | **10.8** | 10.8 | 3.8 |
| certificate (DMGCERTCOST): frames stepped | 1 807 | 1 784 | 1 762 | **1 789** (uncut 3 049) | 0.99 | 1.00 |
| certificate: node time, the same gate run | 1.0 | 2.0 | 3.0 | **4.7** | 4.7 | 2.4 |
| editor scene (headless, the drawing layers): meshes | 133 | 137 | - | 156 | 1.2 | 1.1 |
| ... draw calls (upper bound: mesh x material groups) | 159 | 189 | - | 186 | 1.2 | 1.0 |
| ... triangles | 175.9 k | 177.8 k | - | 153.5 k | 0.87 | 0.86 |
| ... materials | 71 | 72 | - | 76 | 1.1 | 1.1 |

Ratios are to the Cub's air frame (1.0 = the Cub in the air) unless the column says otherwise; the flown numbers are
the µs-per-frame accumulators in sp_fly (`legs[].cost`), every run on a 4-core box shared by 4-6 jobs, so +-30 %.
- THE COST IS THE PHYSICS, NOT THE DRAWING: the Petrel's scene is the Cub's size (fewer triangles; the gear layer is
  its biggest, 58 meshes). Its solver frame is ~6x the Cub's in the air and ~13x the Cub's AIR frame on the ground
  (~7x the Cub's ground frame): 200 substeps (the Cub 75) over twice the members, plus a third hydro body.
- The ground costs the Petrel twice its air frame (the Cub's too): the island raster's ground pass over 184 nodes.
- On the box this decides whether the worker keeps 60 Hz: **browser-needed** (the worker's step time and the page's
  frame time with the Petrel vs the Cub, the same session). UNPROVEN that it is too slow - only that it is 6-13x.
- Reproduce: `node reports/evidence/SEA-PETREL/cost.js --root <repo>` (counts, the rest bench, the scene; its air
  bench is broken - placed by hand it went NaN; the flown numbers above replace it); the certificate: `node tools/run_gates.js --only=DMGCERTCOST`.

## Findings

### F1 GATE PLANELISTS is red on 15ad5d669 (green on 7f6e1df64 and on master) - severity: blocks (a core gate)
- What: `FAIL the pool offers builds/candidates/superpetrel_V4_1.json, not on the Candidates list` and
  `FAIL garage: an official pool row is off the candidate cards`. SEA-OFF (c1ee10ad) moved the Petrel's list row to
  `internal` and marked its pool row `"lab": true` (index.json, no `official`), and rewrote garage.js's pool filter to
  `!p.official && labOk(p) && typeof p.file === 'string'`. The gate knows neither: its pool check counts every
  non-official index row as a candidate card (a lab row is no card unless the lab switch is on), and its source regex
  wants `!p\.official && typeof p\.file === 'string'` adjacent.
- Reproduce: `node tools/run_gates.js --only=PLANELISTS` (0.5 s).
- Node-only (a source / data check). The fix is the gate's (teach it `lab`), or the data's - SEAPLANES' call.

### F3 GATE ACCEPT is red on 15ad5d669: a source pattern, the merge's `hudGear()` - severity: blocks (a core gate), trivial
- What: `FAIL app.js: the leg ticked and signed beside the HUD (ACCEPT_REC.frame; GAME-MENUS' hudWind may sit between)`.
  The gate's regex (`_accept_check.js:369`) allows only `hudEnergy(); [hudWind();] if (window.ACCEPT_REC) ...`; the
  merge's app.js (already at 7f6e1df64) has `hudEnergy(); hudWind(); hudGear(); if (window.ACCEPT_REC) ...`. Master's
  app.js has no `hudGear()` and matches. Every flown check of the gate passed (the only FAIL line in 17).
- Reproduce: `node tools/run_gates.js --only=ACCEPT` (20 min here). Node-only. The fix is the regex (allow hudGear).

### F2 GATE JOINPARITY: master 5 FAIL, base 6 FAIL - the extra one is the Petrel row (ENV, as briefed)
- Base 15ad5d669: `FAIL the page capture holds every validated build (cub, jodel, metal, floats, twinFloats, petrel)`
  (the capture is 2026-11-04, no Petrel row) + the same five FAILs master has.
- Master 1bcd01d3 (pre-existing, not seaplanes'): `FAIL Cub node = page: ... mass 476.448/477.395 kg ... FIRST: node 0
  (S0BL).m`, `FAIL Jodel node = page: mass 471.789/464.182`, `FAIL Cub: the nose tank's nodes ...`, `FAIL
  tools/fixtures/build_v10_cessnaMetal_2026-09-26.json is the metal Cessna's spec to the byte`, `FAIL no tool flies a
  validated build raw: _aids_check.js, ...`. The gate itself says the chain's files changed since the 4 Nov capture.
- Reproduce: `node tools/run_gates.js --only=JOINPARITY` (4 min). Node-only.
