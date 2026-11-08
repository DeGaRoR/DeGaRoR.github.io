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
