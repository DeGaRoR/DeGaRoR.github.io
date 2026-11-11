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
