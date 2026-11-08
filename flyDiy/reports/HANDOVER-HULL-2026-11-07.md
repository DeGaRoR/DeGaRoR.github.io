# HANDOVER — hull types / Super Petrel / amphibian gear (2026-11-07)

Branch `claude/hull-types` (mirrored on `claude/dreamy-pasteur-7358q4`), head after HULL-B80. Not on master; no build here is published. The full log is in `flyDiy/HANDOVER.md`, entries HULL-B1 to HULL-B80, append-only. The retract work comes from `claude/retract-study`, merged up to d44e54bc (the RETRACT session).

## 1. Done and working — the Super Petrel builds

All builds are in `flyDiy/builds/candidates/`. They are `{spec}` files produced by `node tools/hull_matrix.js --one=classic:<card> --fitonly=1 --nofit=1 --save=<file>`.

| build | what | card | flown |
|---|---|---|---|
| `superpetrel_V0.json` | no wheels (B54): the last flying-boat-only build | (git history of `superPetrel`) | water: airborne 25.1 s |
| `superpetrel_V1.json` | folding knee mains (gearFold 8), the exact round recess, nose folds 155° into the bow, two nose doors | `superPetrel` | not re-flown since B55 |
| `superpetrel_V2.json` | rigid-L mains (gearFold 9, flat into the lower wing's round recess), lower wing w2Dy 0.0 | `superPetrelV2` | superseded by V3 (same card) |
| `superpetrel_V3.json` | V2 + clean nose (s1Drop / s2Drop 0.08), no flaps, spray strakes, no cabin door | `superPetrelV2` (as of B75) | water 25.7 s; land: run 180 m, roll 258 m; solo half fuel meets the brochure |
| `superpetrel_V4.json` | V3 + **central faired pylon** carrying the upper wing (bpCabPylon) + engine **on** the wing on an 8 cm pylon | (B78 state of `superPetrelV4`) | water 26.6 s (roll 4.3°); land: run 183 m, roll 368 m |
| `superpetrel_V4_1.json` | V4 with the engine **slid into** the wing (engBlockY -0.18, no engine pylon) | `superPetrelV4` | water 26.3 s (roll 1.1°); land: run 182 m, roll 363 m |

- **The user's pick.** V3 was named "a very nice little plane". After that the user asked for V4 / V4.1 as an experiment ("theoretically more correct"), and asked for the three to be compared. No final pick has been stated between V3 and V4.1. V4.1 is the best on paper: CdS 0.59 vs 0.62, L/D 9.9 vs 9.7, static margin 15.5 % vs 16.7 %.
- **The comparison table** is in HANDOVER.md, HULL-B80.
- **Reference comparison:**
  - `tools/perf_study.js` has a new `REAL.petrel` row (approximate web figures; the POH is not read). Run it as `--build=<file> --vs=petrel [--fly]`.
  - At gross (584-600 kg): Vs 76 / 68, V75 161 / 160, Vmax 183 / 180, ROC 3.9 / 5.1 (calculated).
  - Solo with half fuel (475 kg): Vs 67, ROC 5.5. The brochure figures are solo figures.
  - The report is in `reports/PETREL-STUDY-2026-11-06.md`.

## 2. User rulings still in force

- **Hull.**
  - A single arch: the fluted bottom is kept as an option.
  - Continuous, monotone waistline.
  - Belly profile with one slope change.
  - Vertical skirt (hullSkirt 0.04) with an overhang.
  - Floats sit right **under** the lower wing (hullTipPlane 1).
  - Spray strakes are on.
  - No cabin door: the bubble canopy is the way in (doorOn 0, hgDoor 0).
  - Composite construction; carbon was recalibrated in B50.
  - No flaps: the real Petrel has none.
- **Engine.**
  - Rotax 912 iS row (`rotax 912 iS` preset; 915 iS kept for the newer model).
  - Three-blade carbon propeller, 1.6 m, slim chords.
  - Upturned wing tips: a new tip kind, `GEN_TIPS.upturned`. The drooped kind is untouched.
- **Retract gear.**
  - The cut is an **exact round** recess: gearWellCut 0. The box outline drew "squares" and the user rejected it.
  - **No cut into the hull's bottom, ever.**
  - Small wheels: s1R 0.12, s2R 0.12. Small mechanism.
  - Mains just outboard of the bottom shoulder.
  - Nose folds **forward into the nose**, EDO-float style: custom gn1Ang -155, s2Z 2.85.
  - The nose's pivot sits inside the V bottom, not through it (B67).
  - **Two** nose doors, no leg door: gearLegDoor 0, gearDoors 2. The doors **stay open while the gear is down** and shut only when retracted (B64; the RETRACT session carries the same rule).
  - The nose **cannot** go further forward than 2.85: at 2.92 its well pokes through the bow's top, and foldFit does not see it.
- **Pylons.**
  - The engine pylon is a valid design and is kept (V3).
  - The central cabane pylon (V4) must be **drawn and flown** (no hidden struts).
  - An engine slid into the wing draws no pylon; the user called this "clean".
  - Push-pull is out of scope.
- **Gates.** "Don't run gates yet". This has held since about HULL-B47, and the user has not lifted it.
- **Messaging.** Peer sessions may be messaged only when the user asks; they did for the RETRACT session.

## 3. Open / known-bad (not final)

- **Retract.**
  - **V1's nose is messy.** The base card `superPetrel` still has s2Drop -0.04 (from B72), which jammed the wheel against its doors and well, with the stowed wheel 14 mm out. It was fixed only on the V2/V3/V4 cards (s1Drop / s2Drop 0.08). If V1 matters, give it the same fix.
  - **A probable false red** in foldFit: "the right main's leg, strut or jack crosses the second plane (at gear …)". It appears on knee builds; V2/V3/V4 are green.
  - **The mass rule is coarse.** `GEN_RULES.retractKg` = 3.5 % of gross (20 kg on the Petrel). The user asked for a **bottom-up** mass built from the drawn mechanism (links, pistons, wheels, actuation type). It is planned, not built.
  - **No amphibian switch in the garage.** An amphibian is implied by hullOn + gearRetract + s1On + s2On, and the Hull design tile writes s1On / s2On 0. The agreed design is a "Hull > wheels: none / fixed / retracting" row, plus the same row under Floats. Naming must not assume a tricycle.
  - **Retracting tail-draggers are refused.** This blocks the SeaRey (mains on 45° legs, tailwheel fixed). Three tricycle-only checks need widening:
    - `GEAR_RETRACTABLE`;
    - `_cage_join` retract spec;
    - `61_gen_frame` AMPH.
  - **Amphibious float wheels are drawn but not flown** (RETRACT session's code).
- **Flight.**
  - The V4 / V4.1 landing roll is ~100 m longer than V3's; not investigated.
  - The autopilot's flown climb is ~1.4 m/s under the calculated best: it does not fly Vy.
  - The empty weight is +50-60 kg over the brochure's 320. That is the gear rule, plus the hull's planing bottom at 3 kg/m² (17.7 kg) and the floats (11.7 kg), all booked in ledger "gear".
  - The hump is 0.18-0.21: GATE HYDROTRIM's band tops out at 0.21.
- **Geometry.**
  - Wing area is 14.5 m² vs 15.0 (w2Chord 0.87 would match).
  - Upper-wing dihedral and the upper / lower incidence (4° / 1.5°) are unconfirmed.
  - The bubble canopy is not tuned.
  - Puller and push-pull on the lowered centre nacelle put a 1.6 m disc through the canopy.
- **Renderers.** `quick_view.js` does not pose the retract mechanism or cut wells, so it shows raw links (it drew a bar under the hull). Use `quickshot.js --gear g` (it now has `--fit`) for gear pictures. quickshot draws no frame lines.

## 4. Garage rows added on this branch (default = old behaviour, bit-identical)

| row | default | where | used by |
|---|---|---|---|
| hullStepZ, hullFlute, hullFluteN, hullFluteAt, hullFluteBow, hullFluteAft | 0 / off | Hull | the Petrel cards (single arch, 0.16) |
| hullStrakes, hullStrakeW, hullStrakeLen | 0 | Hull | the Petrel (1, 0.045, 0.85) |
| hullRocker, hullSkirt, hullTipPlane | 0 | Hull | the Petrel (0 / 0.04 / 1) |
| engPylonAft (range extended to -1.5) | 0.15 | Engine > mounting | Petrel V1-V3 (-0.50) |
| engPylonFwd | 0 | Engine > mounting (roof pylon) | Petrel V1-V3 (0.30) |
| bpStrutK, bpCabDraw | 1, 1 | Bracing > cabane | Petrel (strut size; cabane hidden on V1-V3) |
| bpCabPylon | 0 | Bracing > cabane ('struts' / 'central pylon (faired)') | Petrel V4 / V4.1 |
| wgTip 8 'Upturned' (GEN_TIPS appended) | — | Wing > tips | Petrel (both planes) |
| engine preset 'rotax 912 iS' | — | Engine | Petrel |
| (RETRACT session) gearFold 8 'knee' / 9 'lfold', gearKneeDoor | — | Gear > retraction | V1 (knee), V2-V4.1 (lfold) |

Existing rows used with new meaning: `engBlockY` slides the over-the-wing engine into the wing (V4.1). All rows are claimed in `_cage_parts.js`.

## 5. Gates, and changes that touch builds NOT using the new features

- **Gates.**
  - Some gates were run early on this branch (HULL-B26..B37 era; see the log).
  - **None have been run since ~B47** (the user's ruling).
  - Owed:
    - GEN, ARCHETYPES and anything composite (B50's GEN_MATERIALS recalibration);
    - ENGID, PROCURE, ENGCONFIG (912 iS);
    - TECH, DESIGN (the appended tip kind);
    - RETRACT, KNIFE, GEAR, PARTS, SAVE, JOIN, JOINPARITY;
    - the hull gates and HYDROTRIM.
  - Known reds on the bases at merge time (RETRACT session's word): CLIP, JOINPARITY, ENGCONFIG, HANDLE.
- **Global changes (affect other builds):**
  - **B50 GEN_MATERIALS:** carbon members lin ×0.45 (k ×0.55, c ×0.50), glass lin ×0.75. **Every carbon / glass build changes mass and stiffness.**
  - **B64 door rule** (`_cage_gear.js` doorBuild): a well door shuts with the gear down only if a leg door covers the leg (`closedDown = !through && gearLegDoor`). It changes every retract build with well doors and no leg door.
  - **B49:** the new engine row and its tables (registry, GEN_ENG_CG, drive, tech, audio, _eng_check).
- **Changes gated on the new features** (should be inert elsewhere, but unverified by gates):
  - **30_solver** wheelsOnGround / wheelContacts: the amphibian branch runs only when `def.parts.amph`.
  - **61_gen_frame:**
    - The gear chain was restructured (wheels; then hull; floats only if no wheels). A pure boat (`classic:pylon`) was flown before and after: identical.
    - The cabane-pylon truss runs only with `bracing.cabPylon`.
    - The roof pylon uses `pylonFwd` only when set.
    - The buoyant tip is skipped for the upturned kind.
  - **25_airfield** stripGear: a tricycle carrying hull lines = 'amphibian'.
  - **_cage_gear foldFit:** the floor test is limited to the cabin (only `hullOn`); `retIn` nose trunnion (only `hullOn`).
  - **63_gen_wing:** the tip mirror runs only for `TIP.up`.
  - **_cage_eng:** no pylon when an over-the-wing engine is slid into the wing (any build with engBlockY that low — previously a degenerate pylon).

## 6. What I'd do next

1. Run the owed gates; fix or record the reds (GEN / ARCHETYPES first, for B50).
2. Fix V1's nose (s2Drop / s1Drop 0.08 on the base card) or retire V1.
3. Build the bottom-up retract mass; re-measure the empty weight vs 320 kg.
4. Add the "Hull > wheels: none / fixed / retracting" row and the design-tile toggle. Widen the three tricycle-only checks for retracting tail-draggers. Start a SeaRey card.
5. Investigate the V4 landing roll, and the autopilot climb not flying Vy.
6. Read the Petrel POH: incidences, dihedral, wing area (w2Chord 0.87), stall weight. Then make the Petrel a reference: GATE WEIGHT / DRAG rows, plus a VALIDATED build in `_load_build.js`.
