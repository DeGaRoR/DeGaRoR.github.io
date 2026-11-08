# SEA-PETREL test - the Super Petrel V4.1 as a plane, and its cost (8 Nov 2026)

CLOUD session (not the box). Tester only: no game code changed, nothing pushed but this report.
**Tested commit: `claude/seaplanes-merge` 15ad5d669** (the tip at 10:20 UTC; flight_core.js rebuilt from it is
byte-identical to the committed one; index.html / dev.html / sw.js / version.json were stale after c1ee10ad SEA-OFF and
were rebuilt locally for the gates, not committed). Master for the comparisons: `origin/master` 1bcd01d3 (L35a built).
Where a result is from 7f6e1df64 (the launch base) it says so.

**The base moved at ~14:00 to 4c60b519** (the L35a merge, SEA-OFF's built files, the Petrel's DMGCERTCOST budget row
and JOINPARITY page row). Between 15ad5d669 and 4c60b519 `src/core` changed only in 60_gen_spec.js's BIG-aeroplane
envelope (wings over 18 m: the DC-3 class) and the parked packs: nothing the Petrel (9.16 m) flies moved, so the
flights below stand for both. The gates that changed are re-run on 4c60b519 (marked "tip").

STATUS: IN PROGRESS - sections fill as the runs land. Pushed every 1-2 h.

## SUMMARY (for SEAPLANES-LAND)

The Petrel is NOT yet "nice and right" on the water. On land it is (every land leg passes, every wind). On the
sheltered SEA lane it mostly is. On the OPEN sea (Cedar Harbour, mk_sea) at the game's default 8 kt it fails every
way in, out and across - four separate mechanisms, none of them the static prop clearance (0.33-0.43 m at rest):

1. **S1 the landing roll-out porpoises** (every SEA > mk_sea landing at 8-15 kt, 4 of 4: two prop strikes at t 452 /
   480.9, one 30 deg swing at pitch 30.8, one 0.01 m miss at pitch 25.7; the same harbour reached from HOME lands, 4
   of 4, pitch 13-18): skips, the bow thrown to 25-43 deg nose-up, the pusher disc into the water. The hull,
   not the stick (the elevator goes forward as it pitches up). The take-off's porpoise law has no roll-out twin.
2. **S2 the water start drops it**: the game's placement puts it on the water in its land stance, wheels at the
   waterline, the hull ~0.5 m up; it falls, pitches to +9-10 deg in the open sea's wave, the disc goes in at
   t 0.6-1.5 - **3 of 3 starts at mk_sea, 8 kt**. Calm: 0.18 m clear.
3. **S4 the open-sea take-off in 10-15 kt is rejected**: a porpoise at 12-14 m/s (pitch 22-27 deg), no acceleration.
4. **S5 a water departure after a water landing never lines up** (calm, 1500 s of taxi / line-up loops) - the same
   endless water taxi the float Cessna capsizes in (S3: its t 604.6 strike is THAT, not the Petrel's causes).

And, everywhere on the water: the disc comes within **0.12-0.17 m** of the water at the take-off hump and coming off
the step on every landing that passes - the margin is the hull's trim, not the chop.
The gear: a gear-down water landing is identical to gear-up (G1: the hull build's wheels have no water: no flip is
possible); a gear-up runway landing is caught by GUMPS twice, then a belly landing with no damage at all (G2).
Gates: five new reds on the merge that are gate-side (PLANELISTS - fixed on the tip; ACCEPT and DMGSKINGPU source
patterns; STOL's baseline; DMGDRIVE's Petrel mount), DMGINTEGRITY's cut (known); the rest red on master too.
Cost: the Petrel's solver frame is ~6x the Cub's in the air, ~7x on the ground (ratios, this machine); its drawing is
the Cub's size. Whether it holds 60 Hz on the box: browser-needed.

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
| HOME>mk_sea | 8 kt / 250 | full 592 kg | down | PASS | 0.18 | 204 m / 25.2 m/s | 0.72 (ROLL/ground) | 0.12 (ROLLOUT/water) | -4.4 / 2.0 | -2.7 / 13.1 | 2 |
| HOME>mk_sea | 10 kt / 133 | full 592 kg | - | PASS | 0.55 | 239 m / 24.9 m/s | 0.73 (ROLL/ground) | 0.09 (ROLLOUT/water) | -10.1 / 7.6 | -2.4 / 18.5 | 0 |
| HOME>w3 | 0 | full 592 kg | - | PASS | 0.68 | 386 m / 26.8 m/s | 0.72 (ROLL/ground) | 0.75 (ROLLOUT/ground) | - | - | 0 |
| HOME>w3 | 15 kt / 250 | full 592 kg | - | PASS | 0.62 | 327 m / 28.1 m/s | 0.72 (ROLL/ground) | 0.76 (ROLLOUT/ground) | - | - | 0 |
| HOME>w3 | 8 kt / 250 | full 592 kg | - | PASS | 0.66 | 369 m / 27.8 m/s | 0.72 (ROLL/ground) | 0.76 (ROLLOUT/ground) | - | - | 0 |
| HOME>w3 | 8 kt / 250 | full 592 kg | up | PASS | 0.66 | 369 m / 27.8 m/s | 0.72 (ROLL/ground) | 0.76 (ROLLOUT/ground) | - | - | 0 |
| HOME>w3 | 8 kt / 250 | full 592 kg | up (no emergency ext.) | PASS | - | - | 0.72 (ROLL/ground) | - | - | - | 2 |
| HOME>w3 | 10 kt / 345 | full 592 kg | - | PASS | 0.59 | 352 m / 27.4 m/s | 0.73 (ROLL/ground) | 0.75 (ROLLOUT/ground) | - | - | 0 |
| SEA>SEA | 0 | full 592 kg | - | PASS | 0.51 | 291 m / 24.6 m/s | 0.17 (ROLL/water) | 0.14 (ROLLOUT/water) | -2.7 / 3.5 | -2.6 / 12.2 | 0 |
| SEA>SEA | 15 kt / 250 | full 592 kg | - | FAIL ground-loop | 0.60 | 188 m / 24.8 m/s | 0.18 (ROLL/water) | 0.17 (ROLLOUT/water) | -1.4 / 8.4 | -2.7 / 10.4 | 2 |
| SEA>SEA | 8 kt / 250 | full 592 kg | - | PASS | 0.22 | 251 m / 24.6 m/s | 0.17 (ROLL/water) | 0.15 (ROLLOUT/water) | -1.5 / 5.8 | -2.6 / 11.9 | 0 |
| SEA>SEA | 8 kt / 250 | full 592 kg | down | PASS | 0.52 | 253 m / 24.8 m/s | 0.17 (ROLL/water) | 0.14 (ROLLOUT/water) | -2.4 / 5.0 | -2.6 / 12.9 | 2 |
| SEA>SEA | 10 kt / 44 | full 592 kg | - | PASS | 0.78 | 239 m / 24.2 m/s | 0.18 (ROLL/water) | 0.15 (ROLLOUT/water) | -5.0 / 1.5 | -2.6 / 12.1 | 0 |
| SEA>mk_sea | 0 | full 592 kg | - | PASS | 0.35 | 341 m / 25.0 m/s | 0.17 (ROLL/water) | 0.13 (ROLLOUT/water) | -4.6 / 1.6 | -2.6 / 13.9 | 0 |
| SEA>mk_sea | 15 kt / 250 | full 592 kg | - | FAIL prop-strike (water t 480.9 ROLLOUT) | 0.47 | 117 m / 25.7 m/s | 0.18 (ROLL/water) | 0.02 (ROLLOUT/water) | -10.9 / 3.5 | -10.5 / 37.0 | 0 |
| SEA>mk_sea | 8 kt / 250 | full 592 kg | - | FAIL prop-strike (water t 452 ROLLOUT) | 0.36 | 179 m / 25.6 m/s | 0.17 (ROLL/water) | -0.09 (ROLLOUT/water) | -5.6 / 14.6 | -5.3 / 42.6 | 0 |
| SEA>mk_sea | 10 kt / 133 | full 592 kg | - | FAIL ground-loop | 0.32 | 227 m / 24.9 m/s | 0.13 (ROLL/water) | 0.01 (ROLLOUT/water) | -13.0 / 16.2 | -2.7 / 25.7 | 0 |
| mk_sea>HOME | 0 | full 592 kg | - | PASS | 0.79 | 479 m / 26.9 m/s | 0.17 (ROLL/water) | 0.76 (ROLLOUT/ground) | -0.8 / 0.6 | -2.6 / 9.1 | 0 |
| mk_sea>HOME | 15 kt / 250 | full 592 kg | - | FAIL abort | - | - | 0.07 (ROLL/water) | - | -1.8 / 2.8 | -6.8 / 26.5 | 0 |
| mk_sea>HOME | 8 kt / 250 | full 592 kg | - | FAIL abort, prop-strike (water t 0.6 ROLL) | - | - | 0.03 (ROLL/water) | - | -1.3 / 2.6 | -10.9 / 9.9 | 0 |
| mk_sea>HOME | 10 kt / 221 | full 592 kg | - | FAIL abort | - | - | 0.12 (ROLL/water) | - | -4.3 / 7.2 | -3.0 / 25.0 | 0 |

What the grid says (the core grid - 5 legs x 4 winds, full load, + the two gear rows - is complete; repeats,
loads and the chained water departures are still flying and land on the next pushes):
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
- CROSSWIND 10 kt (square to the destination's lane): land legs pass; HOME > mk_sea passes (roll -10 / +8 on the
  water, the roll-out disc 0.09 m); SEA > SEA passes; **SEA > mk_sea: `ground-loop: the nose 30.6 deg off the take-off
  run at 11.1 m/s`** (the wind 133 deg is along SEA's lane - the swing is on the water, the hull weathervaning; then
  the landing at mk_sea came within 0.01 m of a strike, pitch 25.7, roll +16 / -13); **mk_sea > HOME rejected** (S4).
- 15 kt SEA > SEA: two go-arounds (`unstabilised approach at 85 m: sinking 3.0 m/s`), `committed-unstable` on the
  third, then the weathervane on the water (`ground-loop` 30 deg at 5.7 m/s).
- No capsize anywhere (the worst roll on the water +27.1 / -20.6 deg); no member yielded or broken on any leg; no
  prop strike on land.
- Score of the core grid: land-only 4 / 4 pass; land > sea 4 / 4 (one near miss); sea circuit 3 / 4; sea > open sea
  1 / 4; open sea > land 1 / 4. **The user's bar - a water circuit and a sea landing with no prop strike - is not met
  on the open sea at the game's default 8 kt.**

## The gear held the wrong way (task 1's two extra rows)

### G1 GEAR DOWN ON THE WATER: NO FLIP IS POSSIBLE - the hull build's wheels have no water at all - severity: bad (a model gap)
- Flown: SEA > SEA, 8 kt, the handle held DOWN from FINAL (sp_fly `--gear down`: written after the AP, before every
  solver step). GUMPS saw it: `go-around: the wheels are not up for the water (attempt 1)`, `(attempt 2)`, then the
  third approach landed as it was (the existing cap). The landing: sink 0.52 m/s at 24.8 m/s, run 253 m, pitch max 12.9
  deg, roll -2.4 / +5.0 - **exactly a wheels-up landing; no flip, no nose-over, no drag**.
- Why (read in the source, not flown): the wheels' water (GEAR-WATER's wet body, `HYDRO.wetBuild`: the tyres' plough
  plates, "the wheels' plough plates (32_hydro) see the same lift") is built only for a build WITHOUT floats
  (`30_solver.js:1856 WB_CAN = !HY && ...`). The Petrel has a hull (HY), so its wheels never meet the water: the
  classic amphibian gear-down water landing (the flip) cannot happen in this sim. Same for the float Cessna /
  amphibious floats (fltAmph) when they fly.
- Reproduce: `sp_fly.js --order SEA,SEA --wind 8@250 --gear down` (17 min). Node-only for the model gap; the
  browser shows the same (one physics).

### G2 GEAR UP ON THE RUNWAY: the AP's emergency extension saves it - and with that blocked: see below
- Flown: HOME > w3, 8 kt, the handle held UP from FINAL: the AP saw the gear not coming down and pulled the emergency
  extension (`gear-emergency: the gear did not come down: the emergency extension`) - the gear came down regardless of
  the handle; the landing was the normal one to the decimal (sink 0.66, run 369 m). Correct pilot behaviour, and it
  means the handle alone cannot make a gear-up landing.
- Re-flown with `sim.gearEmergency` disabled too (`--noemerg`, a pilot who never gets it down): GUMPS goes round twice
  (`go-around: the gear is not down and locked (attempt 1)`, `(attempt 2)`, an emergency extension tried before each),
  the third approach lands as it is: `gear-up-landing: on the belly: the gear was not down`. On the hull's belly at
  ~27 m/s: **0 yields, 0 breaks, no dent, no prop strike (the pusher disc 0.57-0.62 m over the runway), g peak 2.7**,
  stopped on the strip at t 1131 s, and the tour rig scores the leg OK (no fault; no landing record - `ap.report.landing`
  is null on a belly). A composite planing bottom slid 100+ m on asphalt with no damage at all: "bad", UNPROVEN either
  way here (the hull's scrape / skin wear is SEAPLANES' crash work, "never seen before"); the rig should at least say
  a belly landing is not a pass.
- Reproduce: `sp_fly.js --order HOME,w3 --wind 8@250 --gear up --noemerg` (40 min here). Browser-needed: the belly
  landing's look and sound (scrape, sparks?) on the box.

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

### S4 THE OPEN-SEA TAKE-OFF IN 10-15 KT IS REJECTED: A PORPOISE ON THE RUN, THE AEROPLANE CANNOT ACCELERATE - severity: blocks
- mk_sea > HOME (the Cedar Harbour start), 15 kt from 250: `rejected-takeoff: will not reach Vr: 0.18 m/s^2 needs
  1793 m more, 1142 m left` at 34 s; 10 kt from 221 (square to HOME's runway): `... 0.23 m/s^2 needs 985 m more,
  1178 m left` at 31 s. Both get over the hump (6.5-6.7 m/s, the disc 0.07 / 0.12 m over the water at pitch 6-7 deg)
  and then, at 12.5-13.9 m/s, the hull porpoises off the water (pitch **22 / 26.6 deg**, the hull out of the water
  for moments - `ROLL/air` rows), the run stops accelerating and the AP rejects it (correctly). No strike, no damage:
  the aeroplane is left on the open sea.
- The same take-off from SEA (the sheltered bay) at 15 kt: off at 20.4 m/s, pitch 7.3 deg - fine. Calm at mk_sea: fine.
  So the open sea's waves at 10-15 kt (felt amplitude 0.14-0.16 m at the disc) start a porpoise the take-off's
  porpoise law (39b `SV.porpoise`, called in ROLL / LIFTOFF on a hydro build; whether its gains engage for the
  Petrel's thrust line was not checked) does not stop. UNPROVEN why.
- Reproduce: `sp_fly.js --order mk_sea,HOME --wind 15@250` (or `--wind xw10`), ~4 min.
- Browser-needed: yes - a Cedar Harbour take-off in 10-15 kt.

### S5 THE WATER DEPARTURE AFTER A LANDING NEVER GETS OFF: THE TAXI CANNOT LINE UP ON THE WATER - severity: blocks
- Flown: SEA > mk_sea > SEA, calm (the first leg passes), chained the page's way (_tour_lib flyLeg: the From under the
  aeroplane, a fresh `departFrom`). The second leg's departure from where it stopped on Cedar Harbour: **1500 s and
  no take-off** - TAXI 852 s, LINEUP 360 s, STOP 270 s, the phases cycling TAXI > STOP > HOLD > LINEUP > STOP > HOLD >
  LINEUP > ... > DEPART > TAXI three times; `lineup-timeout: could not line up in 60 s - stopping to replan` x6,
  `replan: not lined up with a run ahead (771 m, 34.3 m off)` (then 41.7, 50.8 m off), `gave-up: still in STOP at
  t=871 s`; 1395 deg turned on the water; taxiing at ~4.2 m/s on 0.5 power, pitch 5 deg, the disc 0.20 m over the
  water. No strike, no capsize, no damage: it simply cannot leave.
- This is the float Cessna's S3 taxi too (its `taxi-timeout: the route took 958 s`, `replan: ... 201.5 m off`) - the
  same water departure that never ends; the float Cessna capsized in it, the Petrel only circles. One cause for both:
  the water departure's line-up from a stop on the lane (likely the line-up's tolerance / the water rudder's turn
  against the weathercock - UNPROVEN which).
- The first-leg water starts (the game's spawn on the lane) never taxi - the AP rolls at once - so the grid's water
  starts did not see this; every water leg after a water landing will.
- Reproduce: `sp_fly.js --order SEA,mk_sea,SEA --wind 0 --load full` (~70 min here). Browser-needed: yes - land at
  Cedar Harbour, then pick SEA as the next destination.

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
- The Petrel flown into the same chained departure (calm): it does not capsize, it never leaves (S5).
- Reproduce (40 min): `sp_fly.js --vkey floats --order SEA,mk_sea,SEA --wind 8@250` (evidence `diag/floats_tour.json`).
- Browser-needed: yes - the water taxi out of Cedar Harbour after a landing.

## The gates that name the Petrel or seaplanes (task 3): base vs master

One gate per call, `node tools/run_gates.js --only=ID --no-build --verbose --jobs=1` (the tree's build regenerated
first). "base" = 15ad5d669, "tip" = 4c60b519, "master" = 1bcd01d3. Logs: not committed (big), the lines are quoted.

| gate | why it is in the list | base | tip | master | the first failing line / note |
|---|---|---|---|---|---|
| HULL | hull builds | PASS | - | (none: new) | |
| RETRACT | the retract / amphibian | PASS | - | (none: new) | |
| HULLWARM | hull | PASS | - | - | |
| SEAPLANE | seaplanes | PASS | - | - | |
| FLOATS | floats | PASS | - | - | |
| WATER | the sea | PASS | - | - | |
| WATERDAMP | water damage | PASS | - | - | |
| HYDRODYN | hydro | PASS | - | - | |
| HYDROTRIM | hydro trim | PASS | - | - | |
| DMGFLOATTO | float take-off damage | PASS | - | - | |
| DMGPLOUGH | VALIDATED (Petrel in) | PASS | - | - | |
| DMGHULL | VALIDATED | FAIL (1) | - | FAIL (1) | the same line on both (F6) |
| PILLAR | VALIDATED | PASS | - | PASS | |
| NACLAG / ROLLSND | VALIDATED | PASS / PASS | - | - | |
| DMGWRECK / DMGSKIN / DMGSETTLE / DMGWALL | VALIDATED | PASS x4 | - | DMGWRECK, DMGSKIN PASS | |
| PILOT | VALIDATED | PASS | - | - | |
| PLANELISTS | the Petrel's rows | **FAIL** | PASS | PASS | F1 (fixed on the tip) |
| ACCEPT | VALIDATED | **FAIL** | **FAIL** | PASS | F3 (the hudGear() regex) |
| STOL | VALIDATED, the cards | **FAIL** (12) | **FAIL** (12) | PASS | F4 (12 hull rows in the join; the carbon cards; the Upturned tip) |
| DMGSKINGPU | VALIDATED | **FAIL** (3) | **FAIL** (3) | FAIL (2) | F5 (one new: the gear-fold block in the source window) |
| JOINPARITY | the Petrel's row | FAIL (6) | FAIL (5) | FAIL (5) | F2 (the Petrel row PASSES on the tip; 5 are master's) |
| DMGCERTCOST | the Petrel's budget | FAIL | FAIL | FAIL | F7 (the Petrel's row holds on the tip; the rest is ENV) |
| DMGINTEGRITY | the Petrel's cut | **FAIL** | - | PASS | `Super Petrel: FAIL the fuselage cut across behind ring 3 (10 members): no break-up` - SEAPLANES' (as briefed) |
| DMGFABRIC / POD / HANDLE / ENGCONFIG | VALIDATED | FAIL | - | FAIL | identical lines (F6), pre-existing |
| DMGDRIVE | water prop strikes, VALIDATED | TIMEOUT (1800 s) | **FAIL** (1 of 154, run directly) | - | F8 (the Petrel's mount holds a blade loss) |
| TOUR (floats shard) | the float Cessna at mk_sea | not run as a gate | | | its float tour re-flown with the gate's own library (S3): t 604.6 reproduced |

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
| certificate: node time, the same gate run (two runs) | 1.0 | 2.0 / 2.3 | 3.0 / 3.1 | **4.7 / 3.1** | 3.1-4.7 | 1.3-2.4 |
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

## The browser list (task 5): what the box must fly in its daily slot

Node cannot see these; each names the node row it confirms. The game's default day (8 kt from 250) unless stated.
Expert, damage on, `?retract=lab` on the page if a lab row is needed (the Petrel's own retract is not behind it).

1. **SEA > Cedar Harbour (mk_sea), 8 kt** - the landing roll-out on the open sea: does the hull skip and throw its bow
   up (node: six skips, pitch 32.7 then 40.8 deg, the prop in the water at t ~452)? Watch the elevator. (S1)
2. **Cedar Harbour (mk_sea) > HOME, 8 kt, the water start** - does the page place the Petrel wheels-down above the
   water and drop it (node: the hull falls ~0.5 m, pitch +9.8 deg, the prop in at t 0.6)? (S2)
3. **The same start calm** (wind 0) - node: no strike, 0.18 m. And **at 15 kt** - node: take-off rejected (`will not
   reach Vr`), pitch 26.5 deg on the run.
4. **HOME > Cedar Harbour, 15 kt** - node passes but rolls +27 / -21 deg on the water: how does it look?
5. **SEA > SEA circuit, 8 kt** (passes in node) and **15 kt** (two unstabilised go-arounds, then a 30 deg weathervane
   at 5.7 m/s on the water: `ground-loop`).
6. **HOME > Ridgeback (w3), 8 kt** - the land leg (node passes: sink 0.66, run 369 m of 543 m) - and the take-off's
   gear retraction, the landing's gear-down (the gear HUD, the doors).
7. **A gear-up landing on the runway** (hold the gear key up through the final): node - GUMPS twice, the emergency
   extension each time; blocked, a belly landing with no damage at all. What does the page do with the key held?
8. **A gear-down water landing**: node - GUMPS twice, then a landing exactly like wheels-up (the wheels have no
   water on a hull build: no flip possible). Confirm in the page it is the same (one physics) and how it looks.
9. **The take-off hump on the water** (any water take-off): the disc 0.17 m over the water at 6-7 m/s - does spray /
   the drawn prop visibly touch?
10. **The cost**: the worker's step time and the page's frame rate, the Petrel against the Cub, the same session and
   view (node: the Petrel's solver frame ~6x the Cub's in the air, ~7x on the ground). Is it 60 Hz on the box?
11. **The float Cessna, Cedar Harbour > SEA after landing there** (the chained water taxi): node - a 600 s taxi and a
   capsize at 6 m/s (S3). Same in the page?

## Findings

### F1 GATE PLANELISTS was red on 15ad5d669 (green on 7f6e1df64 and on master) - FIXED on the tip 4c60b519 (PASS, run here)
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
- Tip 4c60b519: re-run, the same single FAIL (`app.js: the leg ticked and signed beside the HUD`).

### F4 GATE STOL is red on 15ad5d669 (PASS on master): the load door now writes the 12 hull-types cage rows into every validated build - severity: blocks (a core gate), spec-only
- What: `FAIL cub (builds/cub_2026-09-20_corrected.json): joined here to master's spec - DIFFERS + the STOL rows at
  their defaults (...; the bench / parked / certificate-store / procurement keys the same), def =, 4 s =, drawing =,
  design check + sheet =` - and the same line for jodel, metal, floats, twinFloats (+ `every card builds, flies 4 s and
  draws to the bit master did: motorglider, etrainer, archaeopteryx, da62 ...`).
- Measured (a diff of the load door's spec against the gate's baseline, the STOL rows dropped as the gate drops
  them): exactly 12 keys, all `cage.*`, all new and at their off values - `bpStrutK 1, bpCabDraw 1, bpCabPylon 0,
  engPylonFair 0, engPylonForm 0, engPylonAt 0, engPylonAft 0.15, engPylonFwd 0, engFinAt 0.55, engFinFwd 0,
  engNacOver 0, engNacLift 0` (the Cub and the float Cessna checked; the other three read the same line). The
  physics, the 4 s flight, the drawing, the design check and every key are master's to the bit (the gate says so):
  the gate's baseline needs these rows dropped the way it drops the STOL rows (the cert identity already does it:
  GEN_HULL_ROW_OFF).
- A third STOL line from the merge: `FAIL the Wing tips row offers Endplate and Drooped, in table order` - the gate
  wants 8 wgTip options with Endplate 7th and Drooped 8th; HULL-B77 put the Petrel's `Upturned` tip in the picker.
- The cards' line is a second, separate cause: the four cards (motorglider, etrainer, archaeopteryx, da62) are exactly
  the archetypes framed in carbon (`fuselage.material: 'carbon'`; the Cub tubeFabric, the C172 alloy pass), so their
  def / flight / drawing moved by HULL-B50's carbon recalibration (option d: lin x0.45, k x0.55, c x0.50, no version
  bump) - meant, but the gate's baseline was not re-recorded for it.
- Tip 4c60b519: re-run, the same 12 FAIL lines.
- Reproduce: `node tools/run_gates.js --only=STOL` (11 min); the diff: `node reports/evidence/SEA-PETREL/stoldiff.js <repo>/flyDiy/tools`.
- Node-only.

### F5 GATE DMGSKINGPU: one extra FAIL on 15ad5d669 - a source window, the merge's gear-fold block - severity: blocks (core gate), trivial
- What: base and master share two FAIL lines (`the tear on the read-back places: ...` x2, pre-existing on master);
  the base adds `FAIL app.js poseModel: a group the wreck rides whole skips its rig row (5 rows: rigs, struts, legs,
  surfaces, anchored, links)` (wants 6). The gate counts `if (brkWhole(r|s)) continue;` in app.js from `const brkW = `
  to `// G239: ...AND THE RODS AND CABLES` + 400 chars. The merge put the RETRACT gear-fold block (`if
  (model.gearMechRig) { ... }`) between that comment and the link rods' loop, so the sixth skip (linkRigs, still there
  and still `if (brkWhole(r)) continue;`) is past the window. The code is right; the gate's window is short.
- Reproduce: `node tools/run_gates.js --only=DMGSKINGPU` (5 min). Node-only.
- Tip 4c60b519: re-run, the same three FAIL lines (the window's one + master's two).

### F6 DMGHULL / DMGFABRIC / POD / HANDLE / ENGCONFIG: red on the base AND on master with the identical FAIL lines - pre-existing, not seaplanes'
- DMGHULL: `FAIL twin on floats hump: the side term is U w x 93.9 kg/m (the small-slip keel's m(TE)), each wetted
  keel's own constant to 1.08 % over 17 slip angles ...` (one FAIL, both trees).
- DMGFABRIC: `FAIL cub t25: damage OFF - the base's bits (a6929aa46172) ...` (stored bits; both trees).
- POD: `FAIL cub: pod off, the whole def is the base's bytes (95be854c:143346)` ... (stored bytes; both trees).
- HANDLE: `FAIL bugReports/Twin_busher_floats_2.json: doorHandle/star is on the hinge edge, not opposite it` (+ port).
- ENGCONFIG: `1 IDENTITY ... digested against master (2c2a74459)`: 9 builds FAIL with the SAME digests on both trees
  (the base's digests equal master's: the cert identity holds), and `quad level: never wings-level on the downwind` x3.

### F7 GATE DMGCERTCOST on the tip 4c60b519: the Petrel's budget row holds; the rest is the cloud box's load (ENV)
- `Super Petrel: ok 1789 frames stepped (budget 1789; the uncut 3049)`, `ok 80.0 s in node (ceiling 82 s)` (on this
  shared 4-core box beside 5 other jobs: 2 s under its ceiling - the box's 40.7 / 35.8 s is the real figure),
  `ok envelope equal to the bit`. The time FAILs on the Cub / Jodel / metal / floats / twin and `the worker's
  certificate is node's (... 1.1e-8, < 1e-6: the two V8s' last bits)` FAIL on master as well (ENV: the load; the last
  line pre-existing).

### F8 GATE DMGDRIVE: the Petrel's one FAIL - a blade off at full power and its mount holds - severity: bad (a gate expectation, SEAPLANES' call)
- Run directly on the tip (`node tools/_dmg_drive_check.js`, 1853 s here - longer than the runner's 1800 s spawn
  timeout, which is why `--only=DMGDRIVE` on the base timed out with no verdict): 153 / 154 checks; the one FAIL is
  the Super Petrel's: `a trunk grazing the tips (3 cm) at full power (2196 rpm, tip 184 m/s): a blade breaks off and
  the prop turns on short of it - 11.87 kN of imbalance (m e w^2) - the mount lets go - s later (the engine leaves)` -
  the mount NEVER lets go (the Cub's lets go at 30.8 kN after 0.07 s, the Jodel's at 26.5 kN after 0.12 s). The
  Petrel's slimmer carbon three-blade at a lower tip speed makes under half the imbalance and the engine on its wing
  pylon holds it. The expectation is marked `[GAME - no source]`: whether a 912 iS on a pylon must leave after a
  blade loss is a design question, not a bug.
- The rest of the Petrel's block passes: the bow digging in at 90 and 150 km/h strikes the WATER ('stoppage'); the
  gearbox shears on a full-power stoppage; the mount's certificate cases hold; and `the circuit ...: no strike, no
  exceedance - the disc's least clearance 0.17 m` (the same 0.17 m this report measured at the take-off hump).
- Reproduce: `node tools/_dmg_drive_check.js` (31 min here). Node-only.

### F2 GATE JOINPARITY: master 5 FAIL, base 15ad5d669 6 FAIL (+ the Petrel row, ENV as briefed); tip 4c60b519 5 FAIL = master's - the Petrel's row PASSES
- Tip 4c60b519 (run here): `PASS Super Petrel node = page: n 184/184 nb 811/811 mass 591.781/591.781 kg, worst
  1.89e-15` and `PASS Super Petrel save -> open`. So the aeroplane every flight here flew (591.8 kg, the load door) is
  the page's. The five FAILs left are master's own (below).
- Base 15ad5d669: `FAIL the page capture holds every validated build (cub, jodel, metal, floats, twinFloats, petrel)`
  (the capture is 2026-11-04, no Petrel row) + the same five FAILs master has.
- Master 1bcd01d3 (pre-existing, not seaplanes'): `FAIL Cub node = page: ... mass 476.448/477.395 kg ... FIRST: node 0
  (S0BL).m`, `FAIL Jodel node = page: mass 471.789/464.182`, `FAIL Cub: the nose tank's nodes ...`, `FAIL
  tools/fixtures/build_v10_cessnaMetal_2026-09-26.json is the metal Cessna's spec to the byte`, `FAIL no tool flies a
  validated build raw: _aids_check.js, ...`. The gate itself says the chain's files changed since the 4 Nov capture.
- Reproduce: `node tools/run_gates.js --only=JOINPARITY` (4 min). Node-only.
