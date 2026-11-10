# LINER-BACK READY (CABIN-CRAFT, 10 Nov 2026, for train L37b)

Branch claude/ready/liner-back, on master L37a db2298a41: the 8 source commits replayed clean on L37a (09:45), built c170aaee3 (build 11193a934954; flight_core unchanged), the pins af05b033c, the JOINPARITY capture fb08da77e. On top: this note and HANDOVER.

The user, 9 Nov (via Deform, "yes to all"): the black cabin liner showed through the yellow Cub's lower cabin sides. Every liner that copies the skin's shape becomes the skin's own back face: one surface, a material on each side. 16:30: the clipping is "an essential, long-standing, really annoying issue"; 16:46 "Yes, defaults" to part 2. After the pictures and the staged crashes: "crashes already look pretty good, and no more clipping, big progress", "Yes, take the new mass", and **"I validate the double sided mesh, this looks good and fixes a lot of issues"** (an approved feature: gates only).

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

Run on claude/liner-back af05b033c (this ready's code), CPU Tue 10 Nov 12:46-13:16, two lanes of one process each, `run_gates --only=<ID> --jobs=1 --no-build`.

**PASS (14):** CABINLAMP, FLOWNBAKE, CLIP, CABIN, SEATS, SURF, HANGAR, FIT, SHOULDER, PARKED, UISMOKE, DMGWALL, FRAMES, DMGSKINGPU.

**POD: FAIL on master's own c172 only.** Cub and Jodel pass on their new pins. The one red is c172 (def 6dd3e32e:163687, cert 847af8c1), and `_pod_check.js` run on origin/master db2298a41 itself fails it the same way. Its re-pin rides SEAPLANES' float-deck ready (A0).

**ENGCONFIG: FAIL, master's own reds only.** Cub and Jodel's IDENTITY lines pass on their new pins. `_engconfig_check.js` run on origin/master db2298a41 itself prints the identical FAIL list, line for line:
- the chinook IDENTITY line (NOSE-STRIKE's 10 cm grass; out of the battery);
- quad level / cut 0 / cut 2: never wings-level on the downwind;
- pushpull, trimotor, four: "the game's load is the saved aeroplane false", and their cards DIFFER from the saved file.

**JOINPARITY: 1 FAIL, master's named Jodel row (TANK-SPLIT).** The capture was re-taken on GPU 14:57-15:03 for the Cub and the Jodel (`join_parity_page.js --only cub,jodel`, fb08da77e). Cub page 475.748 kg = node. Jodel page 468.238 vs node 469.173 kg, worst 1.96e-2; on master it was 467.989 vs 471.79, the same named red and a smaller gap now.

**Identity:** `ENGCONFIG --pin` on master and on this ready differ in the Cub and Jodel lines only. Measured on L35d with the same trims: Cub all-up 475.748 kg, empty 353.35 kg, cert c85b9a7f; Jodel all-up 469.173 kg, empty 342.45 kg, cert c70a6e6b.


## Pictures

`D:/Dev/flydiy-notes/evidence-2026-10-18/2026-11-10/liner-back/{after, busher/after, crash/after, crash/before}`: the Cub (41: orbit, garage x-ray, 13 cockpit head views), the Twin Busher 4b (42), the staged nose-in crash new (9) against master (11). The user's page: the liner-back artifact.

## Cost (named)

- **A live draw per lined bucket**: the lined skin and its liner never bake into the flown fold.
- **The first-break frame**: |f and |b records in the same frame can pass REC_BUDGET on the first break (Deform's).
- **The parked planes re-cook**: the parked materials change side, so the parked cook is stale after this lands (owed by the train's cook).
- **The mass budget** above: Cub +2.4 %, Jodel +7.0 % empty against the real ones; ~11-13 kg still missing elsewhere on the Cub is REAL-FIGURES' open item.

## Open

- The fallback repaint (`_cage_ui.js` matOf(name) without a side), the selection highlight bleeding across sides, the surfMesh diagnostic z-fight.
- Knife windows show the exterior paint inside (old).
- Door frames 3 mm, post hairline 1.5 mm (negligible).
- DMGWALL no longer measures the liner as a separate wall.
- The trunk crash still (ran out of slot time; the feature is approved, so only if the user asks).
