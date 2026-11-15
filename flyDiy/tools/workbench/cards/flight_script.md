# flight_script - scripted flights, step by step, with a deep log

**Owner:** PILOT. **Gate:** FLIGHTSCRIPT (core, ~6 min, one process). **Since:** 15 Nov 2026 (the user, via A0: scripted runs for the perf round and the tests, flights in steps, deep logging).

## Purpose

Fly a whole flight the way the game flies it: board, start-up, taxi, take-off, climb, the route, the landing, the stop. Each step has its own pass condition and time cap. A failed step stops the run and says **why**: the fault or the unmet condition, the phase, what the pilot was trying to do, its last words, the position and the speeds. It never runs on blind.

## Runners

- **node** (today). The solver plus the game's own host (`src/viewer/sim_host.js` via `_tour_lib.js` `gameHost`): the page's placement off the walked stand, the garage's shakedown, the game's day ticked every step. Jolene, with every solid thing near a strip. Fast, for tests.
- **page** (Thu 19 Nov). The same scenario in the game on the GPU through `page_rig.js`, with frame ms p50 / p99 and freezes per step, for the perf round. The GPU runs only in a booked window.

## Command

```bash
node tools/flight_script.js --list
node tools/flight_script.js home_circuit
node tools/flight_script.js path/to/my_scenario.json --out D:/Dev/pilot_runs/flight_script
```

Exit codes: 0 = every step passed, 1 = a step failed (the WHY is printed and logged), 2 = a bad scenario. Run it from `flyDiy/` on a **built** tree (it needs `tools/flight_core.js`).

## The scenario (`tools/flight_scripts/<name>.json`)

```json
{ "name": "home_circuit", "what": "...", "plane": "list:50", "from": "HOME", "to": "HOME",
  "day": "game", "persona": "expert",
  "steps": [ { "name": "board", "do": "board" },
             { "name": "start-up", "do": "start", "until": { "engine": true }, "capS": 10 },
             { "name": "take-off", "until": { "agl": 30 }, "capS": 120 },
             { "name": "leg back", "do": "leg", "to": "HOME", "until": { "agl": 30 }, "capS": 900 },
             { "name": "land", "until": { "stoppedAt": "HOME" }, "capS": 300 } ] }
```

- `plane`: a plane-list row (`list:N`, from `builds/lists/plane_lists.json`) or a build file (from `flyDiy/`).
- `day`: `game` (the new player's day: 8 kt from 250, 16:00 midsummer), `calm`, or a day spec.
- `persona`: `expert` (default; the story's Stig; the player's autopilot is always Expert), `club`, `student`, `bush` or `hamfist`.
- `do`: `board` (in node, an assert: mass, fuel, no damage), `start` (the page's Go), `leg` (the next leg from where it stopped), `lift` (`"by": m`, the aeroplane raised in place with its speeds kept: "high on final", the autopilot handed back high). Absent means watch.
- `until`: `phase` (one or a list), `agl` (metres), `engine`, `stoppedAt` (an aerodrome id, judged by flightWhere), `declined` (a take-off declined at the hold, its reason said). All must hold.
- `allow`: `yield`, `prop-strike`, `dent`, `declined`. Otherwise these faults end the step: **no prop strike is a pass condition of every step**. A break, a crash, NaN and ABORT always end it.
- `trees` (scenario level, optional): `[[x, z, r, h], ...]`, a stand of canopy `h` m tall within `r` of (x, z), added to the node world's `canopyH`. The page's trees where the node world has none: the runway model's obstacle cone reads them, so a slope the page steepens can be flown in node.

## The library

- `home_circuit`: F-HCSN (list:50), one circuit at HOME. This is the gate's flight.
- `east_point`: the Cub (list:1), HOME > East Point > HOME, on a **calm** day.
- `strip_jumbo`: the Jodel (list:2), HOME > Jumbo Mine > HOME.
- `altiport`: the Cub, HOME > Skyline Altiport > HOME.
- `float_circuit`: the float Cessna B-CESF (list:4), one circuit on SEA.
- `rufus_cabin`, `rufus_cabin_trees`: Rufus (list:7), one circuit at Cabin Strip on its drawn approach (the user's flight of 15 Nov); the trees version steepens the slope as the page did. Read step 5's `fly.hMax`: the base must not climb.
- `high_final_rufus`, `high_final_cub`, `high_final_cessna`: one circuit off HOME, lifted 300 m on the final, then land (DESCENT).

## Output: one JSONL per run

- `run`: first line. The scenario, plane, build file, day, persona, git sha, world.
- `sample`: one a second. Step, phase, the pilot's goal, x/y/z, AGL, ground / air / vertical speed, pitch / bank / heading, throttle / brake / flaps, fuel.
- `say`: each verdict the pilot speaks, as it speaks it.
- `step`: one per step. t0 / t1, the phases, the state at its end, the verdicts said, the solver ms p50 / p99 / max, `ok` or `why`, and `fly`: the least air speed and most sink while airborne, the highest and lowest CG, and the first touch (sink, air speed, pitch).

The table: `node tools/flight_table.js run1.jsonl run2.jsonl ... [--step <name part>] [--md]` prints one row per run from its landing step (time, go-arounds, min IAS, max sink, top, the touch, slips and diverts said, the why).
- `end`: last line. ok, steps passed, sim and wall seconds, the failed step.

Read it with any JSONL reader, e.g. `grep '"type":"step"' run.jsonl`.

## Traps

- **The game's day changes the pilot's choices.** With 8 kt from 250, the Cub judges East Point too short with the wind behind and diverts to Hiking Strip. That is the pilot's own call (GATE TOUR 5/6), so `east_point` flies calm. Expect figures at w8 to move when it turns to mud (DIRT-STRIP, L40e).
- **Caps are sim seconds, not wall.** The node solver costs about 8-11 ms a step, so a 10-minute flight is about 6 minutes of wall time. Run one flight per process, `nice`'d, in your lane.
- **The float Cessna goes round up to twice at SEA** before its committed landing (JOIN-PARITY G1970.4, vref-raised). Its landing step's cap holds three approaches.
- **Afloat, a hold has no brake** (the water-hold hole, owed after perf). A float departure from mk_sea loops its line-up about five times. The library flies the float Cessna from SEA, where it starts lined up.
- **Never judge a step by its phase alone** when a landing matters: `stoppedAt` reads the strip under the wheels (a divert stops elsewhere).
- **Built files:** it reads `tools/flight_core.js`. On a git-archive tree, run `node tools/build.js` first. Never commit the built files.
