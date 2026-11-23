# PHYSICS-AUDIT: READY 1c (the built plan, steps 0-6; ref `claude/ready/physics-audit-1c`, on master 089297693, L40J)

**1c = 1b (`143eff6db`) merged with L40J's master `089297693` (Mon 23 Nov, 06:10 CET), every conflict re-measured.** A
pushed ready never moves (A0's rule): -1 and -1b stay as they were, on L40H.

The user, 21 Nov: "We'll do all steps, so what matters is the final result ... I'm OK with the plan and you may
proceed." A0, 22 Nov (L40L): the built plan only; the fuselage-drag work is a later ref (physics-audit-2).
The full account: `reports/PHYSICS-AUDIT-2026-11-21.md` section 7 ("As built"); the HANDOVER block PHYSICS-AUDIT.

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

## The merge with L40J (1c)

`git merge origin/master` (089297693) into the plan's line - a merge, not a rebase (the line was already pushed).
`61_gen_frame.js` and `64_gen_build.js` merged by themselves. The conflicts, each RE-MEASURED on the merged tree:

| file | what it became |
|---|---|
| `src/core/76_procure.js` (the shop catalogue's effects) | nine rows re-emitted from `_procure_check.js --emit` (the refit 172 x the plan's propeller): c172 o320 rangeKm 47; c172 io360 cruiseKmh 8, rangeKm -103; c172 tank long toM 102, rangeKm 580; c172f o320 cruiseKmh -22, rangeKm 41; c172f io360 cruiseKmh -9, rangeKm 26 |
| `tools/realband_baseline.json` | re-written on the merged tree (L40J's refit 172 and the user's Chinook, the plan's steps): reason in its history |
| `tools/fixtures/stol_baseline.json.gz` | re-captured on the merged tree (33 cards + 6 builds) |
| `media/fiches/*/physics.json` | all 24 re-baked on the merged tree |
| `HANDOVER.md` | master's bytes, then the PHYSICS-AUDIT block's |
| the built files | rebuilt, their own (built) commit |

L40K (about noon: the refit 172's tail strut, the route fixture, ls4-arch-1) is NOT in this ref.

## Every re-pin, with its reason

| gate | what was re-pinned | why |
|---|---|---|
| REALBAND | `tools/realband_baseline.json` re-written at steps 2, 3-4 and 5-6 + the two cards | every step moves the live planes' figures; the baseline is this tree's |
| RPM | the census names the governed piston row (`GOVERNED_PISTONS`); two engine-off thrust checks re-stated | step 6: the R-1830 row is governed; step 4: a dead propeller's thrust is its drag, not zero |
| STOL | `tools/fixtures/stol_baseline.json.gz` re-captured on this tree; the slat-seam bound follows the base (`base.D2 * 1.0105`) with a check that an automatic slat costs under 12 % of a fixed slot's | PHYSICS_V 10 moves every flown figure of the six validated builds; the seam bound was an absolute number of the old base |
| SOFTGROUND | `tools/fixtures/softground_legacy_rolls.json` re-blessed | the stock's propeller fit moved its ground roll by 4-34 mm (kV2 0.1941 -> 0.1964) |
| PROCURE | five catalogue effects re-emitted (the 172's O-320 and IO-360 cruise / range, the Jodel's O-200 range) | the propeller fit and the idle drag move the catalogue's computed effects |
| WIRES 6 / BENCH | a stated-null wire section or tail bracing hashes as the absent key in the three fingerprints | found red by BENCH: the join's A3 null moved every cage build's certificate; fixed in source, pinned by WIRES 6 |

## The gates, in chunks (logs: `reports/evidence/PHYSICS-AUDIT-2026-11-21/ready1/chunk_NN.log` on `claude/physics-audit`)

**Run on this exact tree (1c, merged and rebuilt)**: STOL, REALBAND, PROCURE, SOFTGROUND, TAKEOFF, PILOTCANFLY, WIRES,
PROPFIT, IDLEPROP, DRAGROWS, RPM, CARDS, PLANELISTS, SNAPSHOTS, PLANEFICHE, BUILT, COMMITHYGIENE pass; BENCH red on the
shipped Rufus's stamp (below). 17 of 18.

**Run before the merge, on L40H** (trees 4a1989294 / 835da79f9): chunk 1 of 13 of the core tier (30 gates: 25 pass;
GLIDE, BENCH, PHYSPAGES = the named reds; REALREFS, APSMOOTH = master's own), FLOATSCLASSIC-WATER (passes), and the 109
gates of 22 Nov listed in the report's section 7. Logs: `reports/evidence/PHYSICS-AUDIT-2026-11-21/ready1/` on
`claude/physics-audit`.

**NOT RUN on the merged tree: the rest of the core tier.** The cloud container restarted twice in the night and the
chunked battery reached chunk 1 only. It is restarted on this tree as this is pushed (landing gates first, parts of
six gates, each chunk's log to `claude/physics-audit`), but **this ref is not fully gated**: the full verdict is the
train's battery.

## Reds, NEW against master (by check name) and left

| gate, check | master → this ref | for whom |
|---|---|---|
| BENCH "stamped under this game (physics 9; now 10)" | the shipped Rufus certificate predates the bump | A0's box: re-stamp it in the game, then `SHIPPED_CERTS` takes the new hash |
| GLIDE "FAIL300": the C172-alike, engine dead at 300 m | lands 66 m in → 110 m short, capsized (glide flown 9.5 → 8.7) | Pilot: the glider circuit was tuned on a glide with no propeller drag (step 4) |
| UNIFY "EMERG": the Cessna 172, engine dead at 600 m | expert: on the runway → 10.8 m off it; student: 1.2 m off (red on master) → no landing | Pilot: the same law |
| PROFILE "2 cessnaMetal: altitude reversals in the cruise" | 1 in 528 s → 3 in 506 s (limit 2) | Pilot |
| TOW "LAUNCH": the car's corners off the runway | 0 samples → 21 (the launch itself within 1 %) | the tow's owner |
| PHYSPAGES "twin: DESTROY no shape or nothing broken" | passes → red since step 4 (the twin floatplane's destroy run) | the damage layer's owner; cause not proven (a rig switch on the idle drag changed nothing) |

Master's own reds met on the way (the same check name fails on master): REALREFS ("PLANES.c172v2f: ... not found on
claude/cessna-final"), APSMOOTH (the same four: jodel level HOME,HOME; c172, rufus and mosquito level HOME,w3 - read on
master alone, 23 Nov; one figure is looser here: the c172's altitude on that leg peaks at 59 m where master's peaks at
8 m, the same family as PROFILE's row above), GROUNDQUERY, FLIGHTREC, GEN "cruise is quiet in
wind", RADIALDIV, TAXICLEAR, ALTIPORT, SLOPE, TAILWHEEL, MONOWHEEL, DESTTO, GLIDE "CIRCUIT archaeopteryx", UNIFY "STRIP the
user's Cub", WINGROWS, JOINPARITY, SAVE, PARTS, DESIGN, CANDIDATES, ASSETS, LIVERYSET.

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

The full tier (PHYSPAGES apart), any browser page, the flown `real_check --all` and `real_report`, the fiche's
Reference page re-bake (it reads a full `real_check --all`), the in-game re-stamp of the shipped Rufus certificate
(BENCH's red: the GPU box).

## On top of this ref

`claude/ready/physics-cards-1`: seven cards corrected to their parents (its own note, `PHYSICS-CARDS-READY.md`). It was
measured on this physics and must not land before it.
