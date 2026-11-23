# PHYSICS-AUDIT: READY 1d (the built plan and the seven cards, on L40K's master 56047b34e; A0's six checks)

**1d = master `56047b34e` (L40K) merged with `claude/ready/physics-cards-1c` (which holds physics-audit-1c), then two
fixes in source** (Mon 23 Nov, evening). A pushed ready never moves (A0's rule): -1, -1b and -1c stay as they were.

A0, 23 Nov 20:05: "L40L (your physics-cards-1c, with physics-audit-1c inside) is merged on L40K. Battery chunks 1-3 of
13 show 6 NEW failing checks compared with L40K. These are your job; please trace and fix ... on a FRESH ready name:
claude/ready/physics-audit-1d, built on 9ee92406b or on master 56047b34e ... Put the per-check verdicts in its READY
note." The train's own merge (9ee92406b) was never pushed, so this is the same merge made again on master, with the
resolutions A0 described (below). **It therefore carries the seven cards too**: it stands in for both -1c refs.

**Where it is.** The user cleared ready names up to -1c; the question for -1d was not answered when this was
written. So the line is pushed on `claude/physics-audit`, whose head is a merge commit carrying this tree: its SECOND
parent is the 1d line's tip, linear on master `56047b34e`. A0 copies that commit to `claude/ready/physics-audit-1d`
(COMMIT-PROCEDURE rule 7), or the user's yes lets this session push it there.

**In one line: 2 of the 6 fixed in source, 1 is master's own crash, 3 named with their traces; nothing re-pinned.**

## A0's six checks: the verdicts

Each was flown on this line and on master `56047b34e` with the same probe (the gate's own code, a trace added). The traces:
`reports/evidence/PHYSICS-AUDIT-2026-11-21/ready1d/` (`*_master56047b34e.log` against `*_thisline*.log`).

| # | gate, check | verdict | what was found |
|---|---|---|---|
| 1 | GLIDE "FAIL300" (the C172-alike, engine stopped at 300 m, 104-110 m short of Cannery, capsized) | **FIXED in source** (`43_pilot.js`) | The pilot measured the worse glide correctly (8.2:1 with the dead propeller's drag, step 4; 9.5 on master). The loss was in the turn onto the final: half a circle at 26 deg of bank is 460 m wide at 33 m/s, the downwind was 330 m out, the aeroplane swung 113 m through the centreline (101 m on master) and flew about 480 m more than the plan counted. Master's better glide paid for it; here nothing was left. The base and the final are now turned at the bank whose half circle fits the downwind's distance (26 deg as before when two radii fit, 40 deg at the most), and the way left is counted on that half circle. A circuit whose downwind is two radii out flies as before. **Now: on the runway 84 m in, under 3 m/s, stopped on it.** The whole gate (7 flights) passes; so does UNIFY "EMERG" (expert and student on the runway), a named red of -1c |
| 2 | SAILPLANE "B full out at 28 m/s ... the L/D 24.5 -> 10.9" | **FIXED in source** (`60_gen_spec.js`, `GEN_RULES.airbrake.cdPlate` 1.2 -> 2.0) | The plates add the same 245-250 N on both trees. "Under 10" held on master only because its LS4 glided 19.5 clean (247 N of clean drag); step 1's span efficiency puts the clean glide at 24.5 (197 N; the book's is about 38 there), and the same plates left it at 10.9 - further from the rule's own target ("from ~40 to ~8", the manual's 7-9), not nearer. 1.2 is a plate in the free stream; this one stands on the wing's upper surface at mid chord, in air about 1.25 x the flight speed at a glide's lift, and its wake takes the section's pressure recovery. At 2.0: 8.2 at 28 m/s, 9.2 at 25, 6.5 at 33. **INFERRED, as the 1.2 was: one number, the LS4's owner may move it.** Nothing flies the brakes but this check and the player |
| 3 | TOW "CIRCUIT archaeopteryx ... released at 94 m ... sink 15.95 m/s (capsized)" | **MASTER'S OWN, not this line's** | The same launch on master `56047b34e`: "the weak link broke (6.0 kN)" at 16.7 s, 88 m up, the nose 68 deg up at 26.5 m/s; it falls and capsizes, no landing recorded. Here: the weak link breaks at 16.8 s, 94 m up, the nose 82 deg up; it falls and capsizes, and a 15.95 m/s landing is recorded - so the row's TEXT differs, the event does not. Up to the break the two launches are the same to 2 % (line tension at 14 s: 1802 N on master, 1845 N here). The cause is the launch (the car tow's hands and the L40K Archaeopteryx's pitch-up on the line), before any glide. -1c's note already listed GLIDE "CIRCUIT archaeopteryx" among master's reds. Not touched here |
| 4 | TOW "ALTIPORT ... lift-off 10.0 s, 10.6 m/s, 70 m down the slope; to -; NO LANDING (null)" | **NAMED** (red on master too, for another reason) | Master `56047b34e`: the row FAILS as "...to Fishing Village Strip (divert ...); landed OFF it 333 m in ... -55 m left". On both trees the glider (hands frozen, elevator 0) hops off a bump 167-173 m down the slope and comes down nose first: -15.3 deg on master, which recovers and flies off at 29 s; here -16 deg and on to -39 deg: it stands on its nose and stops 202 m down. The only difference before the hop is the freewheeling propeller's drag (step 4: 0.03 of the disc, 8 N at 13 m/s; 13.06 m/s against 12.94 at 17 s). A knife edge that the push start sits on; the fix is in the push start's hands (hold the tail down over the bump), which is the tow's owner's |
| 5 | ROUTE "fly:metal: the vertical speed flown stays inside them ... 0.5 s outside (31 steps), worst 0.56 m/s past" | **NAMED** (the same flight is red on master by three checks) | Master `56047b34e`, `--only fly:metal`: FAIL "the drawn profile is clean for this aeroplane ... WP1 climbs 2.5 m/s, plan limit +2.4", FAIL "WP1 at 175 m +-15 - +160.6 m", FAIL "the pilot's own captures agree with the trace". Here the same three (2.6 against 2.5) and this fourth: at t = 129 s, where the asked height steps from 192 to 216 m, the pull-up at 53.7 m/s and full throttle peaks at 4.20 m/s (1 s mean) against the published 3.64 + 0.5 - 0.06 m/s over, for half a second. The fitted fixed-pitch propeller (step 3) pulls harder at cruise speed than the old law. The limit is not moved; the flight wants its route re-drawn for this aeroplane first (master's three reds) |
| 6 | UNIFY "STRIP the user's Cub, the club pilot (Brian) ... off-strip, ground-loop" | **NAMED** (the leg is red on master for all three Cub rows) | Master `56047b34e`, the expert's and Brian's legs flown with the gate's own tour: both FAIL "off-strip" ("the landing roll left tw_ski's box": stopped on the 8-10 % grade, then "rolling 100 m on to the level part"); -1c's note already listed UNIFY "STRIP the user's Cub" among master's reds. Brian's landing there (4.5 m/s of tailwind, uphill): on master the nose swings 12 deg one way, back through 0, then 21.7 deg the other way at 6 m/s, the rudder at 0.87-0.94 of full - 8 deg short of a ground loop. Here the rudder sits ON its 0.95 stop from 385.1 to 386.5 s and the second swing goes to 54.7 deg: a ground loop (30.2 deg at 8.5 m/s), and it rolls back down off the strip. Cause: the idling propeller's drag (step 4, 0.05 of the disc) slows the slipstream, and the tail flies in 5 % less dynamic pressure (`30_solver` `wash`, momentum theory - true at approach speed). **A known coarse edge of step 4**: at roll-out airspeeds (5-10 m/s) a real idling propeller still pulls a little; the idle term should fade out under about 0.4 of the top speed. That moves every approach's idle drag, so it is physics-audit-2's, not a patch tonight |

Checks 3 and 4 fail on master under the same check names with other text; 5 and 6 are new checks on flights already
red on master. None is re-pinned.

## What is in it (one PHYSICS_V bump, 9 -> 10)

| step | what | where | gate |
|---|---|---|---|
| 0 | `real_check` reads the planes right: wheels up, the row's altitude, the row's power; four reference rows corrected | `tools/real_check.js`, `tools/real_refs.js` | REALREFS |
| 1 | the span efficiency of a slender wing | `62_gen_aero genOswald`, `GEN_DRAG.oswald` | GEN, REALBAND |
| 2 | the bracing wires' drag is the wires the aeroplane has (rows `stBrace`, `bpWireSec`, absent at 0) | `62_gen_aero`, `_cage_brace.js`, the join | WIRES (new) |
| 3 | a fixed-pitch propeller is cut for its aeroplane and held to its redline | `60_gen_spec genPropFit`, `30_solver thrLimit` | PROPFIT (new) |
| 4 | a propeller that is not driven is a brake | `60_gen_spec GEN_PROP_IDLE`, `30_solver` | IDLEPROP (new) |
| 5 | a floatplane's floats, a hull, a bare radial's wake | `62_gen_aero`, `GEN_DRAG.float / hullK / radialWake` | DRAGROWS (new) |
| 6 | a governed propeller flies the actuator disc (`engine.cs`; the R-1830 row) | `60_gen_spec genPropGovern`, `30_solver csThrust` | PROPFIT 7 |
| cards | the Electric trainer and the Ruckus Solo take the climb pitch class | `builds/candidates/` | REALBAND |
| fix | the fiche's Drag page shows a floatplane's floats and their struts; the 24 official fiches' physics pages re-baked | `66c_gen_fiche_pages.js`, `media/fiches/*/physics.json` | PHYSPAGES, PLANEFICHE |

Verdicts over every scored row of the 17 live planes (`real_check --quick`, inside / near / outside):
before the audit 55 / 18 / 20, as built 61 / 14 / 18.

## The merge with L40K (1d)

`git merge` of `ac85f8eab` (physics-cards-1c) into master `56047b34e`:

| file | what it became |
|---|---|
| `src/core/90_node_exports.js` | the union: master's list + the plan's nine names |
| `builds/archaeopteryx_2026-11-10.json`, `builds/candidates/superpetrel_V4_2.json` | master's file + this line's rows (`accHandling 0`; `wgCons 5`, `w2Cons 5` and the two wings' material) |
| `builds/ls4_2026-11-13.json` | deleted on master (folded into `builds/candidates/ls4_2026-11.json`): the row `accHandling 0` is on that file |
| `tools/realband_baseline.json` | re-written on this tree (18 planes: L40K's `ls4` is new; `jodelg`, `archaeo`, `petrel42`, `c172v2` move their figures against the -1c fixture, with `cub`, `pa18f`, `dc3r`, `carboncubss` by L40K's own changes) |
| `tools/fixtures/stol_baseline.json.gz` | re-captured on this tree |
| `media/fiches/*/physics.json` | re-baked on this tree (24 baked, 14 moved) |
| `HANDOVER.md` | master's bytes, then the PHYSICS-AUDIT block's 22 lines, as bytes |
| the built files | master's in the merge commit, rebuilt in their own (built) commits |

## Every re-pin, with its reason

| gate | what was re-pinned | why |
|---|---|---|
| REALBAND | `tools/realband_baseline.json` re-written at steps 2, 3-4 and 5-6 + the two cards | every step moves the live planes' figures; the baseline is this tree's |
| RPM | the census names the governed piston row (`GOVERNED_PISTONS`); two engine-off thrust checks re-stated | step 6: the R-1830 row is governed; step 4: a dead propeller's thrust is its drag, not zero |
| STOL | `tools/fixtures/stol_baseline.json.gz` re-captured on this tree; the slat-seam bound follows the base (`base.D2 * 1.0105`) with a check that an automatic slat costs under 12 % of a fixed slot's | PHYSICS_V 10 moves every flown figure of the six validated builds; the seam bound was an absolute number of the old base |
| SOFTGROUND | `tools/fixtures/softground_legacy_rolls.json` re-blessed | the stock's propeller fit moved its ground roll by 4-34 mm (kV2 0.1941 -> 0.1964) |
| PROCURE | five catalogue effects re-emitted (the 172's O-320 and IO-360 cruise / range, the Jodel's O-200 range) | the propeller fit and the idle drag move the catalogue's computed effects |
| WIRES 6 / BENCH | a stated-null wire section or tail bracing hashes as the absent key in the three fingerprints | found red by BENCH: the join's A3 null moved every cage build's certificate; fixed in source, pinned by WIRES 6 |

## The gates run on this exact tree

Tree `decd4e545` (the merge, the two fixes, the re-taken baseline, fixture and fiches; after it only this note and the
evidence logs are added). Logs: `reports/evidence/PHYSICS-AUDIT-2026-11-21/ready1d/`.

- **19 of 20 pass**: STOL, REALBAND, PROCURE, SOFTGROUND, TAKEOFF, PILOTCANFLY, WIRES, PROPFIT, IDLEPROP, DRAGROWS, RPM,
  CARDS, PLANELISTS, SNAPSHOTS, PLANEFICHE, BUILT, SAILPLANE, PHYSPAGES, PROFILE. **BENCH** is red on the shipped
  Rufus's stamp only ("stamped under this game (f3, spec 10, physics 9; now 10, 10)": the box's re-stamp).
- **GLIDE** (7 flights), SAILPLANE and IDLEPROP were run on `9b7c17f9d`/`1a223f427` (the same core, before the
  baseline, fixture and fiches were re-taken): pass. **UNIFY "EMERG"** on the same core: both rows pass.
- **UNIFY "STRIP"** on `decd4e545`: Stig's and Megan's rows "off-strip" (master's), the archetype cub passes, Brian's
  "off-strip, ground-loop" (#6). **TOW** on `decd4e545`: LAUNCH, GLIDE, RELEASE, WEAK, AUTOPILOT, TAKEUP and the
  motorglider's CIRCUIT pass; the Archaeopteryx's CIRCUIT and ALTIPORT are #3 and #4 (read with the gate's own code
  on this core and on master; the gate itself takes over 40 minutes on those two rows in this container and was still
  on them when this note was committed - its log is added to the evidence folder if it ends in time).
- COMMITHYGIENE passes on the pushed line.

Two named reds of -1c pass on this tree without a change of mine: PROFILE "2 cessnaMetal" and PHYSPAGES "twin:
DESTROY" (L40K's own changes; not traced).

## Reds left, NEW against master (by check name)

| gate, check | master -> this ref | for whom |
|---|---|---|
| TOW "ALTIPORT" | red on master (lands off the strip at a diversion) -> red (noses over on the slope's bump): #4 above | the tow's owner: the push start's hands |
| ROUTE "fly:metal: the vertical speed flown" | passes -> 0.06 m/s over for 0.5 s: #5 above | the route's owner: the flight is red on master by three checks |
| UNIFY "STRIP ... the club pilot (Brian)" | off-strip -> off-strip and ground loop: #6 above | physics-audit-2: the idle term at roll-out speeds |
| BENCH "stamped under this game (physics 9; now 10)" | the shipped Rufus certificate predates the bump | A0's box: re-stamp it in the game, then `SHIPPED_CERTS` takes the new hash |
| TOW "CIRCUIT archaeopteryx" | red -> red, the same crash with other text: #3 above | master's own (the Archaeopteryx's car launch) |

Cured since -1c: GLIDE "FAIL300" and UNIFY "EMERG" (the pilot's turn onto the final); TOW "LAUNCH" passes on this tree.

## The DC-3's mass and its floats (A0, 23 Nov: SEAPLANES' bisect to f1cb81f9e)

`builds/candidates/dc3_2026-10.json`, empty weight by the ledger: 6482 kg before the real-canon merge, 7937 kg after
(+1455) and on this ref (the plan moves no mass). By row: furnishing 320 → 1202, gear 273 → 794, fuselage +39, tail
+10, electrics +4 - **not the harness**. Crossed over: the new card on the old tree reads 7390 (+870: its airliner
seats and full trim - the card's own change in that merge), the old card on the new tree 6648 (+150: the gear's mass
law); the rest is the new card's gear rows under that law. The book is 7630-7650 kg: the card was 15 % light and is
4 % heavy now (57 kg over its band). It reached its parent's weight; the 4 % sits in the gear group (794 kg, about
7 % of gross where the type's is 5-6 %) and the furnishing - a card item, not fixed here.

On floats it was the THRUST that failed it, and step 6 answers: `node tools/_floatsclassic_check.js --only=water` on
this tree passes - "DC-3 on EDO 78-28000: 12520 kg, reserve 2.12, keel draft 0.770 m; the hydroplane run lifts off -
36.8 s, 36.6 m/s, 660 m" (the governed R-1830s: static thrust 13.1 → 17.9 kN).

## Not a model row: the Ruckus Back-Country

`ruckusbc` is scored against the Solo 103's sheet (no Back-Country figures are sourced; `real_refs` says so): a 64 hp
card against a 37 hp book. Its four "outside" rows are that, on master as here.

## Not run

The rest of the core tier on this tree (the train's battery is the full verdict; its chunks 4-13 were still running
when this was pushed), any browser page, the flown `real_check --all` and `real_report`, the fiche's Reference page
re-bake, the in-game re-stamp of the shipped Rufus certificate (BENCH's red: the GPU box). The fuselage-drag line
(physics-audit-2) is not in this ref.

## The cards

The seven cards of `claude/ready/physics-cards-1c` are IN this ref (the merge above); their note is
`PHYSICS-CARDS-READY.md`. The three card changes that need the fuselage line's rows still wait for physics-audit-2.
