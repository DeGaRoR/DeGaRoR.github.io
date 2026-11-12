# REAL-FIGURES CANON — the one file per type we test and stand behind (11 Nov 2026)

For FLAGSHIP's canon table and the game's plane list (`builds/lists/plane_lists.json`, claude/ready/plane-list-2).

How this table was built:
- **The file:** each type's row in `tools/real_refs.js` PLANES, at claude/practical-cerf-7fjpwp 6a39d8c92.
- **The blob:** the file's git blob, so "same name" is never mistaken for "same aeroplane". Several canon files share a
  name with the list's file but differ in content.
- **The score:** from the report `reports/REAL-CHECK-2026-11-11.html` (geometry / specs / performance → overall).
- **"Wins":** which file the list should carry.

| type | canon file (blob) | score | list's file (blob) | which wins, and why |
|---|---|---|---|---|
| Piper Cub J-3 | `builds/candidates/cub_chord160.json` (0a814bc8) | 93 | `cub_2026-09-20_corrected.json` (ba66a5a8) | **Canon.** The user's ruling, 9 Nov: the J-3's 1.60 m chord for the 1.70 ("modify the root chord of both Cubs"). |
| Jodel D112 | `builds/candidates/jodel_geo.json` (3591c617) | 94 | `jodel_2026-09-20_corrected.json` (02475e5e list / 444873d9 master) | **Canon.** The user's request, 9 Nov: the D112's wing and length, and the real 60 L tank. Only on this branch. |
| Chinook Plus 2 | `builds/chinook_2026-09-21_corrected.json` (ccb46168) | 84 | same name (f757b0d3) | **Canon's content.** The adopted card, 9 Nov (pull-start: no battery, generator or starter). The user: "the candidates should replace their cards". |
| Stearman-alike | `builds/candidates/stearman_2026-10.json` (07aaf87d) | 86 | same file | Agree. |
| Tiger Moth-alike | `builds/candidates/tigermoth_2026-10.json` (08c6b9bb) | 86 | same name (38b58797) | **Canon's content.** The adopted card, 9 Nov (no electrics as built). |
| Camel-alike | `builds/candidates/camel_2026-10.json` (70abe61f) | 75 | same name (f5d86420) | **Canon's content.** The adopted card, 9 Nov. |
| DC-3-alike | `builds/candidates/dc3_2026-10.json` (82364be1) | 90 | same name (a9708ed7) | **Canon's content.** The adopted card, 9 Nov: the proper radial cowl, the mains retracting into the nacelles (the exact cut), no doors. The user: "especially the DC-3, we are very happy". |
| PA-18 on floats | `builds/candidates/pa18_floats_chord160.json` (155de265) | 80 | `pa18_floats_2026-10-23.json` (e26c7353) | **Canon.** The same 1.60 m chord ruling as the Cub. |
| Super Petrel LS | `builds/candidates/superpetrel_V4_2.json` (9e95f67c) | 77 | `superpetrel_V4_1.json` (ecb9d20a) | **Canon.** V4.2 is fitted to the maker's three LS drawings, its fuel where the manual puts it; phase 1 closed by the user on 10 Nov. Open: the tail dips at the water hump (PETRELTRIM b, 0.20 m). Only on this branch. |
| Carbon Cub SS | `builds/candidates/carbon_cub_ss.json` (3d51ef93) | 93 | same file | Agree. |
| Cessna 172 (land) | `builds/cessna172r_2026-11-08.json`, the V2-172 (338b4237) | 81 | same file, same blob | Agree. This is the Cessna we test: FLAGSHIP's V2-172, measured 9 Nov on that exact blob. The old corrected 172 (`cessna172_2026-09-20_corrected`) is superseded; the metal B-CESS and its floats were dismissed by the user on 8 Nov. |
| Cessna 172 on floats | **none settled** | — | no list row | See below. |
| Top Rudder Ruckus | `builds/candidates/ruckus_std_2026-11-09.json` (7c9f54b1) | 63 | no list row | The real Ruckus, made from the story plane Rufus without touching it. On the list only if the user wants it; the Rufus file stays as it is. |

**The Cessna on floats — "the wrong Cessna" risk.** Two files were tested, and neither is canon yet:

| file | origin | tested | score | why not canon |
|---|---|---|---|---|
| `builds/c172r_wipline2350_stcprop_2026-10-20.json` (ac171eed) | HYDRO-TRIM's 172R on Wipline 2350s, 20 Oct | 11 Nov | 85 | NOT built from the V2-172; on no list row |
| `builds/cessna172r_floats_2026-11-08.json` (8198cb76, claude/alloy-frame only) | the V2-172 on floats | 9 Nov | 88 | a DRAFT: its gross case is 1212 kg (over the STC's 1157), CG at 46 % MAC, flapless, and the supplement's technique does not lift it off |

The canon should be the V2-172 floats once those three are fixed. That is the user's 8 Nov ruling: "rebuild a Cessna on floats from the corrected one". Until then, list neither as a validated reproduction.

**For the list:**
1. The canon files above that exist only on this branch need it to land: `jodel_geo`, `superpetrel_V4_2`, `ruckus_std`, and the four adopted cards' content (Chinook, Tiger Moth, Camel, DC-3).
2. The list should name the canon files by name (`cub_chord160`, `pa18_floats_chord160`, `jodel_geo`, `superpetrel_V4_2`). A list row whose filename matches but whose blob differs is the old aeroplane.
3. The validator's next step (REAL-FIGURES made perennial) stamps every result with its build's blob, so a mismatch like this one is flagged automatically.

## Answers to A0 (11 Nov, after FLAGSHIP's PLANE CANON)

**(a) The live set, confirmed.** One file per type, as tested on 11 Nov. The `listRow` field now in each `real_refs.js`
PLANES entry gives the plane list's row for the same type (ask d):

| PLANES key | file | listRow |
|---|---|---|
| cub160 | `builds/candidates/cub_chord160.json` | 48 |
| jodelg | `builds/candidates/jodel_geo.json` | — (list 2 carries jodel_2026-09-20_corrected) |
| chinookm | `builds/chinook_2026-09-21_corrected.json` | 8 (same name, different blob) |
| stearman | `builds/candidates/stearman_2026-10.json` | 9 |
| tigermothm | `builds/candidates/tigermoth_2026-10.json` | 10 (same name, different blob) |
| camelm | `builds/candidates/camel_2026-10.json` | 11 (same name, different blob) |
| dc3r | `builds/candidates/dc3_2026-10.json` | 12 (same name, different blob) |
| pa18f160 | `builds/candidates/pa18_floats_chord160.json` | 49 |
| petrel42 | `builds/candidates/superpetrel_V4_2.json` | 41 (the list's file is V4_1) |
| carboncubss | `builds/candidates/carbon_cub_ss.json` | 47 |
| c172v2 | `builds/cessna172r_2026-11-08.json` | 50 |
| c172v2f | `builds/cessna172r_floats_2026-11-08.json` (claude/alloy-frame) | — |
| c172rf | `builds/c172r_wipline2350_stcprop_2026-10-20.json` | — (a test plane from now on) |
| ruckus | `builds/candidates/ruckus_std_2026-11-09.json` | — (until the cards land) |

**(b)** Waiting for the user's answer to Q1. On a yes, the Cub and the PA-18 floats rows point back to list 1 / 25's
files, and the chord-160 cards stay "next" (48 / 49).

**(c) The Ruckus cards need three features master does not have.** Both cards (`ruckus_std_2026-11-09`, the Solo
103, and `ruckus_2026-11-09`, the Back-Country) use four rows absent from origin/master 1f5b82195:

| rows | feature | where it is |
|---|---|---|
| `noseDeck` | NOSE-DECK, the nose's top skin on an open frame | only on claude/practical-cerf-7fjpwp |
| `wgStrutSec`, `wgJury` | STRUT-OPTIONS, round-tube struts and the jury strut | claude/strut-options, its own READY 1343f1e00, not landed |
| `brkHold` | the brakes' hold, GEN_BRAKES | practical-cerf only; it went out with the reverted real-figures-3 |

On master the cards would load with those rows ignored: no nose deck, profiled struts with no jury, and the old
brakes. That is not the aeroplane the user approved. A claude/ready/ruckus therefore has to stack on, or carry,
STRUT-OPTIONS and the brakes. The order is the user's / A0's call.

**(c, continued) What the Ruckus weighs, and which core changes it was weighed on** (12 Nov). The same file,
`ruckus_std_2026-11-09.json`, measured with the same ledger script on both cores:

| section | origin/master 1f5b82195 | practical-cerf 7328d17a5 | difference | the change behind it (practical-cerf only) |
|---|---|---|---|---|
| bracing | 18.00 | 11.46 | -6.54 | STRUT-OPTIONS 0e934785d: the card's round-tube struts and jury (`wgStrutSec`, `wgJury`, which master ignores) |
| wings | 27.49 | 22.09 | -5.40 | UL-WING e449077fb: the ultralight wing's stand-ins bill as tubes and wires (the user: "we overestimate the wing weight by a factor 2") |
| stol | 18.59 | 13.39 | -5.20 | SLAT-KG 24f7ce231: the slat's mass by its section |
| fuselage | 24.54 | 20.28 | -4.26 | no change of its own: inferred to be the gauge, which sizes the structure to the design gross (270 -> 249 kg). Not isolated by a test |
| tail | 7.24 | 7.04 | -0.20 | the same gauge |
| gear | 23.85 | 24.61 | +0.76 | MASS-SCALE 5be057892 (the gear's own gauge ceiling) and BUSH-WHEELS 24f7ce231 |
| **empty** | **176.3** | **155.5** | **-20.8** | the real Ruckus: 115 kg (254 lb). Both cores are well over it, and the wing and fuselage are the open mass findings |

So a claude/ready/ruckus that reports 155.5 kg must carry:
- STRUT-OPTIONS, which has its own READY on claude/strut-options;
- UL-WING and SLAT-KG / BUSH-WHEELS (practical-cerf; the reverted real-figures-3 lineage);
- MASS-SCALE (in PHYS-SCALE's READY, the other REAL-FIGURES session);
- and, for the shape: NOSE-DECK and the brakes' hold.

Otherwise it re-reports on master's 176.3 kg, with the struts profiled and no jury. That is not the approved card.

**Overlap with the Archaeopteryx work** (claude/archaeopteryx-sailplane-study-q8tzz2 as pushed): none in code. It adds
new parts with their own masses (the monowheel and bicycle wheel, the tip skids, the hanging pylon's GEN_HANG). It does
not touch the wing's, the struts' or the slat's billing, the material table, or the gauge. If its "light materials and
weight ledgers" are still to come, the shared ground is:
- UL-WING (63_gen_wing: how an open ultralight wing bills its tubes, wires and fabric);
- the `fabricAlu` construction and the aluminium spar under fabric (REAL-FIGURES-3, GEN_MATERIALS / GEN_BUILD_GRAMMAR);
- STRUT-OPTIONS' tube masses.

Those should be designed together, not twice.

## The canon, settled (12 Nov: the user, via A0, "yes to all" on FLAGSHIP's PLANE CANON)

- **Cub:** list 1's `builds/cub_2026-09-20_corrected.json` is THE reproduction (PLANES `cub`, listRow 1). The J-3 chord
  card `cub_chord160` is NEXT (listRow 48, hidden in the report until it replaces list 1).
- **PA-18 floats:** list 25's `builds/pa18_floats_2026-10-23.json` (PLANES `pa18f`, listRow 25). `pa18_floats_chord160`
  is NEXT (49).
- **Cessna on floats:** `c172r_wipline2350_stcprop_2026-10-20` is a TEST plane (PLANES `c172rf`: dropped from the report,
  test: true). The reproduction will be FLAGSHIP's V2 floats draft once the user answers the floats plan.

Report: `reports/REAL-CHECK-2026-11-12.html`. Cub and PA-18 floats re-flown on the list's files on 12 Nov
(`reports/evidence/REAL-CHECK-2026-11-12/`): Cub 89 (geometry 82, specs 93, performance 92: the 1.70 m chord), PA-18
floats 70 (76 / 89 / 51). The rest as on 11 Nov.
