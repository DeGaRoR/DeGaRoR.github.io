# PHYSICS-AUDIT: READY 1 (the built plan, steps 0-6; ref `claude/ready/physics-audit-1`, on master 9349a62c1, L40H)

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

## The rebase

**None was needed when this was pushed** (Sun 22 Nov, 23:30 CET): master was still `9349a62c1`, the plan's own base, and
the user said "Push". This line is `claude/physics-audit` without its three FUSELAGE-DRAG STUDY commits (reports and
node-only tools: nothing built moves; they ride physics-audit-2), plus the fiche's physics pages re-baked.
When L40J and L40K land I MERGE the new master into this ref (no force-push, so no rebase of a pushed ref), re-measure
what conflicts (A0 named `61_gen_frame.js`, `64_gen_build.js`, `realband_baseline.json`: REALBAND is re-written with its
reason, never a side picked), and say so here.

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

**Run on this exact tree before the push** (13 gates): REALBAND, PLANEFICHE, BUILT, WIRES, PROPFIT, IDLEPROP, DRAGROWS, RPM,
CARDS, PLANELISTS, SNAPSHOTS, COMMITHYGIENE pass; PHYSPAGES red on one named check (below).

**Run on the same source earlier** (22 Nov, tree 835da79f9: this tree plus the study's files): 109 of the core tier's
367 gates, listed in the report's section 7 "Gates", each red read against master by check name.

**The whole core tier in chunks of 30** (the landing gates first: TAKEOFF, GLIDE, ROUTE, APSMOOTH, PILOTACT, the PILOT
set, REALBAND, STOL) is started on this tree as it is pushed; each chunk's log is committed and pushed to
`claude/physics-audit` as it ends, and this section is completed from them. Until then this ref is NOT fully gated.

## Reds, NEW against master (by check name) and left

| gate, check | master → this ref | for whom |
|---|---|---|
| BENCH "stamped under this game (physics 9; now 10)" | the shipped Rufus certificate predates the bump | A0's box: re-stamp it in the game, then `SHIPPED_CERTS` takes the new hash |
| GLIDE "FAIL300": the C172-alike, engine dead at 300 m | lands 66 m in → 110 m short, capsized (glide flown 9.5 → 8.7) | Pilot: the glider circuit was tuned on a glide with no propeller drag (step 4) |
| UNIFY "EMERG": the Cessna 172, engine dead at 600 m | expert: on the runway → 10.8 m off it; student: 1.2 m off (red on master) → no landing | Pilot: the same law |
| PROFILE "2 cessnaMetal: altitude reversals in the cruise" | 1 in 528 s → 3 in 506 s (limit 2) | Pilot |
| TOW "LAUNCH": the car's corners off the runway | 0 samples → 21 (the launch itself within 1 %) | the tow's owner |
| PHYSPAGES "twin: DESTROY no shape or nothing broken" | passes → red since step 4 (the twin floatplane's destroy run) | the damage layer's owner; cause not proven (a rig switch on the idle drag changed nothing) |

Master's own reds met on the way (the same check name fails on master): GROUNDQUERY, FLIGHTREC, GEN "cruise is quiet in
wind", RADIALDIV, TAXICLEAR, ALTIPORT, SLOPE, TAILWHEEL, MONOWHEEL, DESTTO, GLIDE "CIRCUIT archaeopteryx", UNIFY "STRIP the
user's Cub", WINGROWS, JOINPARITY, SAVE, PARTS, DESIGN, CANDIDATES, ASSETS, LIVERYSET.

## Not run

The full tier (PHYSPAGES apart), any browser page, the flown `real_check --all` and `real_report`, the fiche's
Reference page re-bake (it reads a full `real_check --all`), the in-game re-stamp of the shipped Rufus certificate
(BENCH's red: the GPU box).

## On top of this ref

`claude/ready/physics-cards-1`: seven cards corrected to their parents (its own note, `PHYSICS-CARDS-READY.md`). It was
measured on this physics and must not land before it.
