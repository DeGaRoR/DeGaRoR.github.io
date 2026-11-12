# LINER-BACK-2 READY (CABIN-CRAFT, 11 Nov 2026, for train L38b)

Branch claude/ready/liner-back-2, on master L38a 603da882f: FRESH commits (the L37b merge of claude/ready/liner-back was reverted: the revert trap), the 13 commits replayed on L38a (11c626544..f1d6a0f83; the STOL baseline merged: L38a's with the liner's Cub and Jodel entries), built f8d906c27 + 50f17fd4d (build dcf181f40477; flight_core rebuilt for PROCURE's rows; career_core.8f21ab03.js). On top: this note and HANDOVER.

The user, 9 Nov (via Deform, "yes to all"): the black cabin liner showed through the yellow Cub's lower cabin sides. Every liner that copies the skin's shape becomes the skin's own back face: one surface, a material on each side. 16:30: the clipping is "an essential, long-standing, really annoying issue"; 16:46 "Yes, defaults" to part 2. After the pictures and the staged crashes: "crashes already look pretty good, and no more clipping, big progress", "Yes, take the new mass", and **"I validate the double sided mesh, this looks good and fixes a lot of issues"** (an approved feature: gates only).

## Why a second ready

L37b pulled liner-back (A0, 10 Nov 19:0x): five battery gates its own set never ran went red, each bisected on master + liner-back alone. Judged and fixed here:

- **STOL**: the Cub and Jodel joined specs moved with the mass budget -> their baseline entries re-captured (`_stol_samebits.js --capture` on the liner tree, merged into L38a's baseline: master's cards and other builds kept).
- **KNIFE**: the window planes' cut sheet shrinks (~58.4k -> 55.1k verts) because the liner is no longer a separate offset sheet; the window loops are the same -> `--record`.
- **PROCURE**: the Cub and Jodel option effects re-measured (`--emit`): with the 'bare'/'light' trims an option's empty-mass delta no longer carries a furnishing share -> the 11 cub/jodel `eff` rows in `src/core/76_procure.js` (a core data change: flight_core rebuilds).
- **DMGNOSEOVER**: see "The nose-over row" below (Deform agrees).
- **DMGSCAR**: one row, a named and owner-accepted edge (below).

## The nose-over row (Deform agrees, 10 Nov)

The Cub's 18 m/s full-brake stick-back negative sat at the tip line on master: min -4.92 deg (12 deg below parked at 9.43 s), no strike - measured again on L38a 603da882f: margin above the tip point **-0.14 deg**. The liner Cub's CG is 4.4 mm forward and 2.1 mm up (~2.9 mm from removing the aft furnishing lump - a J-3 has none - and ~1.4 mm from the liner's +0.95 kg billed at VSN L/R); that tips it to -41.7 deg and a prop strike. Physical in direction, a knife-edge in size. Deform (10 Nov) agrees: the old row is now a REPORT (printed, never fails) and the negative is the case that clears the tip point by at least 6 deg on the worse arm.

Measured on master L38a (the REPORTs): 18 m/s full brake -4.92 deg (margin -0.14); **18 m/s at 0.8 brake 6.60 deg (margin 11.38)**; 15 m/s full brake -41.01 deg, a prop strike (the full brake at 15 m/s noses over on master too, so it cannot be a negative). **CUB_NEG = 18 m/s at 0.8 brake**: on master 11.38 deg clear; on this ready GATE DMGNOSEOVER PASS, its check "clear of the tip point by at least 6 deg" included.

## DMGSCAR 2J, a known edge (Deform accepts it for this landing)

A different wreck path, 1 of 26 skipping runs at 75 % on a 5-touchdown run (the Jodel, 30 m/s into a trunk 2.5 m out, node 51) against the scar join's 80 % rule. Deform (10 Nov): "ACCEPT as a known edge for this landing ... the rule is mine. I'll check in the crash round whether a 5-touchdown run should be judged by length share or by touchdown count." The solver is deterministic: a re-run gives the same 75 %.

## What lands

- **The liner is the skin's back face** (`_cage_gen.js` cageInterior `linerBack`): cloth, plywood and toele liners re-emit each skin face once, same winding and order, on copies of the skin's vertices, flagged back; the skin face is flagged front. The posts (woodFrame) and the composite shell and bands stay solid liners.
- **One-sided for real** (`aeroskin.js` `exactSide`): `THREE.FrontSide` is 0, so `o.side || DoubleSide` made every lined skin double-sided. `exactSide` keeps FrontSide/BackSide on the liner sites only (editor `matOf`, game `app.js`, parked `matFor`). Same aeroMaterial keys in app.js, parked.js and flown_bake.js (GATE FLOWNBAKE check 7).
- **The game's buckets**: `s<sec>|f` and `s<sec>|b` (`_cage_join.js`); a lined bucket stays live (`flown_bake.js` skips `sd`), the fiche keeps the pair's sides (`plane_fiche.js` keepSide).
- **The wreck** (Deform's dd56a0a51): the back face is wall class, tears by its own skin's rule, finds its own skin triangle, cutWall skips back records, |f and |b records go in the same frame.
- **Part 2, the user's six defaults**: the structure meets the skin in lined sections (plywood 1.5 mm, was 14; metal frames, boom rings and landing 2.5 mm, was 9; the pillar-less bulkhead 2.5 mm); the floor board 1.5 mm off the skin (was 4); **the roof lamps drop at most 6 mm** along their normal until the flange clears the skin (a 10 mm drop hung the twin's left pax lamp under the bare aluminium by the window pillar; past 6 mm the site is given up and the ladder looks further aft); the skinT slider no longer moves the structure in lined sections; door and window edges stay zero-thickness unless beaded.
- **Two tool fixes found on the way**: CABINLAMP's probe gives a tie between a lined skin and its lining to the lining (the back face: the lamp sits on it); the load door's join cache keys a probe by its content, not only its path (an edited probe answered from the cache - see HANDOVER).

## The mass budget (in the flown aeroplane: named)

The drawn back-face liner now has the skin's full area, and the lining bills its mass from its geometry, so two validated planes' flown aeroplanes move. The user, 9 Nov: **"Yes, take the new mass"**, and asked CABIN-CRAFT, ELEC-SYSTEMS and REAL-FIGURES to keep every plane as close or closer to its real reference. REAL-FIGURES' ruling (MASS-BUDGET-CUB-JODEL.md on claude/real-figures-3, the user's "go with your best judgment"):

| plane | cabin trim | empty | vs the real one | why |
|---|---|---|---|---|
| Cub | `bare` (was lined) | 353.35 kg | +2.4 % (J-3 345) | a J-3 has no lining: -1.44 kg of furnishing pays the drawn liner's +0.95 |
| Jodel | `light` | 342.45 kg | +7.0 % (D112 320) | a D112: side pads, no headliner; its electrics come off with JODEL-GEO |

Re-pinned (and only these): GATE ENGCONFIG's IDENTITY lines for `builds/cub_2026-09-20_corrected.json` and `builds/jodel_2026-09-20_corrected.json`; GATE POD's `cub` and `jodel` entries (def, sh, cert, sim) in `tools/_pod_base.json`. ENGCONFIG `--pin` run on master L37a and on this ready differ in those two lines only: **no other plane's spec moves** (the C172 V2, the twins, the Petrel). Master's own drifts are left as master has them and are not this ready's (A0, 10 Nov): POD's c172 entry (master fails it: cert 847af8c1 vs the pinned 4ba80c97, same 300 flown steps) is re-pinned on SEAPLANES' float-deck ready, and ENGCONFIG's chinook line stays master's named red (NOSE-STRIKE; the Chinook is out of the test battery). **_pod_base.json clash**: SEAPLANES re-blesses the same file today and its c172 entry sits right under this ready's jodel entry, so a text merge may conflict: take both sides, entry by entry (cub + jodel from LINER-BACK, c172 + floats from SEAPLANES).

Both build files are one line each: ELEC-SYSTEMS' cable runs (Cub wire +1.61 kg) and JODEL-GEO touch the same lines; whoever lands second re-applies their own key (agreed with both).

## Gates

Run on claude/liner-back-2 50f17fd4d (this ready's code), CPU Wed 11 Nov 16:2x-16:4x (A0's slot, box alone), two lanes of one process each, `run_gates --only=<ID> --jobs=1 --no-build`.

**PASS (19):** DMGNOSEOVER, STOL, KNIFE, PROCURE, POD, FLOWNBAKE, CABINLAMP, CLIP, CABIN, SEATS, SURF, HANGAR, FIT, SHOULDER, PARKED, UISMOKE, DMGWALL, FRAMES, DMGSKINGPU.

**Named reds, none new:**
- **DMGSCAR 1 of 111:** 2J, the Jodel trunk 2.5 m out, node 51 at 75 % (owner-accepted edge, above).
- **ENGCONFIG:** master's own list, line for line as on L37a's master (chinook IDENTITY; quad level / cut 0 / cut 2 never wings-level; pushpull, trimotor, four "the game's load is the saved aeroplane false" + their cards DIFFER). The Cub and Jodel IDENTITY lines pass on their pins.
- **JOINPARITY 1 FAIL:** master's named Jodel row (TANK-SPLIT): page 468.238 vs node 469.173 kg (was 467.989 vs 471.79 on master before the liner). The Cub = node.

## Pictures

`D:/Dev/flydiy-notes/evidence-2026-10-18/2026-11-10/liner-back/{after, busher/after, crash/after, crash/before}`: the Cub (41: orbit, garage x-ray, 13 cockpit head views), the Twin Busher 4b (42), the staged nose-in crash new (9) against master (11). The user's page: the liner-back artifact.

## Cost (named)

- **A live draw per lined bucket**: the lined skin and its liner never bake into the flown fold.
- **The first-break frame**: |f and |b records in the same frame can pass REC_BUDGET on the first break (Deform's).
- **The parked planes re-cook**: the parked materials change side and flight_core rebuilds (PROCURE's rows), so the parked cook is stale after this lands (owed by the train's cook).
- **The liner's mass is billed at VSN** (firewall top, x -0.17), forward of the lining's real centroid (~x 1.0): ~1 mm of CG, parked (Deform).
- **The mass budget** above: Cub +2.4 %, Jodel +7.0 % empty against the real ones; ~11-13 kg still missing elsewhere on the Cub is REAL-FIGURES' open item.

## Open

- The fallback repaint (`_cage_ui.js` matOf(name) without a side), the selection highlight bleeding across sides, the surfMesh diagnostic z-fight.
- Knife windows show the exterior paint inside (old).
- Door frames 3 mm, post hairline 1.5 mm (negligible).
- DMGWALL no longer measures the liner as a separate wall.
- The trunk crash still (ran out of slot time; the feature is approved, so only if the user asks).
