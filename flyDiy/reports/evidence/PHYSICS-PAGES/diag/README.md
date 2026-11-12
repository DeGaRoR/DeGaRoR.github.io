# DIAGNOSTIC: the drawn plane against what the sim flies (A0 for the user, 11 Nov)
- load_one.js + probe_raster.js: each plane through the load door with FLYDIY_JOIN_PROBE=probe_raster.js (FLYDIY_JOIN_NOCACHE=1):
  the headless editor's visible meshes rasterised into side / plan / front silhouettes (60 px/m, RLE).
  `cat planes.txt | FLYDIY_JOIN_NOCACHE=1 FLYDIY_JOIN_PROBE=$PWD/probe_raster.js xargs -P 3 -L 1 node load_one.js`
- the baked fiche planes use their fiche render instead (fm_<k>_<view>.bin alpha masks from media/fiches; fiche_masks.json).
- diag.js: the frame fit (the nodes onto the silhouette), the measures (wing span / chord, tailplane span / area / position,
  fin top, the body's end on the plan's centreline - fiche renders only: the editor scene has no fuselage skin), the drawing.
- gallery_diag.js -> diag.html (published: the user's Model Diagnostic artifact). diag_rows.json: the findings.

## Version 2 (12 Nov, the user's review): registered, no pilot
- probe_raster2.js: the editor's scene taken into the PHYSICS frame by the join's own datums (window.CAGE_DATUM: cage z =
  zFw - x, cage y = y + yD) - exact, no fit; the drawn airframe surface (window.CAGE_GEAR.AF, sampled ring by ring) added
  (the editor scene has no fuselage skin); the drawn body's ends (bodyEnd / bodyNose). No crew layer: no pilot.
- diag2.js: every plane from the editor's shapes (one source); fiche renders can still be laid on the exact silhouette
  (register(): 98-100 % of their pixels land on it). Float / hull members drawn; masses small; the aft body the physics
  flies, per plane; a body-depth check on rod / twin-boom planes.
- The Metal Cessna: the 10 Nov fiche shows its stab 2.70 m; today's editor (headless load path) draws it 3.42 m, as flown.

## Version 3 (12 Nov)
- The propeller disc stands where the blades are drawn: engine station + 64c genAidPropOff(CAGE_ENG) (probe_raster2 now
  returns CAGE_ENG's units; diag2 applies it). Was a fixed flange - 0.12 m (FLAGSHIP's trace). Offsets read: Cessnas
  -0.255 m, Cubs/Jodel -0.165, DC-3 -0.305, Tiger Moth -0.095, Stearman/Camel/Rufus/Ruckus -0.065, pushers: Petrel
  +0.255, Chinook +0.065. The physics strike disc still sits at the flange (dashed tick; FLAGSHIP's fix after the perf round).
- Ruckus added (its own reproduction, not Rufus): builds/candidates/ruckus_std_2026-11-09.json from
  claude/practical-cerf-7fjpwp, the card REAL-CHECK-2026-11-11/ruckus.json tests. Findings: tailplane area (gross) -14 %,
  fin top -4 %, aft-body depth at 3.21 m +30 % (a rod drawn, a fuselage cone flown: the AFT-PODS case).
- The V2-172 (list:50, cessna172r_2026-11-08) labelled the official Cessna for comparisons; B-CESS labelled legacy.

## The crew-free fiches check (12 Nov)
claude/diag-fiches e49c7c7cb (DIAG-FICHES-2026-11-12, 10 planes rendered without crew on master 79724e428). Each render's
alpha laid on the editor silhouette (probe_raster2, the join's datums; register() offset and side tilt): 97-100 % of its
pixels on it, all three views, 10/10. Every finding returns; two measures straddle the 3 % line by source: Petrel span
(editor 8.90, render 8.86, flown 9.16 m), DC-3 chord at half span (editor 3.80, render 3.48 at 31 px/m, flown 3.69 m).
The Petrel's render shows its fin top 9 cm under the editor's shape. Re-run like for like on 79724e428's core
(DIAG_CORE=<its tools/flight_core.js>): the same numbers. No new finding.

## INTEGRITY: the certification bench on every baked fiche (12 Nov) - for the crash-integrity study (Deform)
What the Integrity page shows, as it is (A0: "show the bench as it is; no hiding, no softening"). Baked by
tools/fiche_physics_bake.js (genFichePages: the load test = app.js startLoadTest's rig to the 5.7 g ultimate, held 1.5 s;
then the bench to destruction = bench_worker benchLoadRun's destroy path, damage on, the certificate's attachments) on a
test merge of claude/physics-pages onto claude/ready/fiche-mass aa81b71ff (master 79724e428 + the fiche pass), each fiche
on the build file its list row names. Data: media/fiches/<dir>/physics.json there (load.verdict, destroy.yieldAt /
breakAt / brokeAt / groups / firstBreak). The 4 BROKE UP first, then the rest.

| plane | list row | file | load test (5.7 g ultimate) | first bend g | first break g | lets go g | first group to go | first member broken |
|---|---|---|---|---|---|---|---|---|
| Stearman-alike | list:9 | `builds/candidates/stearman_2026-10.json` | BROKE UP | 3.85 | 4.06 | 4.13 | wing1L:interplane | wire tension at its fitting |
| Tiger Moth-alike | list:10 | `builds/candidates/tigermoth_2026-10.json` | BROKE UP | 5.27 | 5.27 | 5.27 | wing1L:interplane | wire tension at its fitting |
| DC-3-alike | list:12 | `builds/candidates/dc3_2026-10.json` | HELD — over yield | 3.85 | 5.71 | 13.89 | wing0R:root | wing kink at its null |
| Super Petrel LS | list:41 | `builds/candidates/superpetrel_V4_1.json` | BROKE UP | 5.44 | 5.44 | 6.22 | wing1R:root | wing kink at its null |
| mosquito | list:18 | `builds/candidates/mosquito.json` | BROKE UP | 4.75 | 4.75 | 4.92 | wing0L:root | wing kink at its null |
| Piper Cub | list:1 | `builds/cub_2026-09-20_corrected.json` | HELD | 6.01 | 6.01 | 6.01 | wing0R:strut | wing tension at its fitting |
| Jodel D112 | list:2 | `builds/jodel_2026-09-20_corrected.json` | HELD | 6.01 | 6.01 | 6.09 | wing0R:root | wing tension at its bond |
| Twin busher floats 4b | list:6 | `builds/candidates/Twin_busher_floats_4b.json` | HELD | 6.96 | 7.30 | 13.17 | wing0R:root | wing kink at its null |
| Rufus | list:7 | `builds/rufus_2026-10-18_certified.json` | HELD | 6.97 | 7.15 | 7.22 | wing0R:root | wing kink at its null |
| Chinook | list:8 | `builds/chinook_2026-09-21_corrected.json` | HELD | 6.53 | 7.00 | 7.11 | wing0R:root | wing kink at its null |
| STOL Cub | list:13 | `builds/candidates/stol_cub_showcase.json` | HELD | 6.02 | 6.02 | 6.02 | wing0R:strut | wing tension at its fitting |
| PA-18 on floats | list:25 | `builds/pa18_floats_2026-10-23.json` | HELD | 5.99 | 5.99 | 5.99 | wing0R:strut | wing tension at its fitting |
| Client Cub | list:26 | `builds/cub_2026-09-20.json` | HELD | 6.02 | 6.02 | 6.02 | wing0R:strut | wing tension at its fitting |
| Camel-alike | list:11 | `builds/candidates/camel_2026-10.json` | HELD | 6.07 | 6.07 | 6.10 | wing1L:root | wing tension at its bond |
| Carbon Cub SS | list:47 | `builds/candidates/carbon_cub_ss.json` | HELD | 5.99 | 5.99 | 5.99 | wing0R:strut | wing tension at its fitting |
| Cessna 172 | list:50 | `builds/cessna172r_2026-11-08.json` | HELD | 3.85 | 6.30 | 6.30 | wing0R:strut | wing tension at its fitting |
| Cessna 172 floats (career) | list:4 | `bugReports/cessnaFloatsWOrks.json` | HELD | 3.85 | 7.14 | - | - | wing tension at its fitting |
| Cessna 172 (career) | list:40 | `bugReports/cessnaMetal (1).json` | HELD | 3.85 | 6.06 | 6.06 | wing0R:strut | wing tension at its fitting |
| ugly bi | list:17 | `builds/candidates/ugly_bi.json` | HELD | 6.24 | 6.24 | 6.24 | wing1R:interplane | wire tension at its fitting |
| pusherLight | list:21 | `builds/candidates/build_v8_pusher_2026-09-11.json` | HELD | 6.03 | 6.02 | 6.02 | wing0R:strut | wing tension at its fitting |
| twinBoomFail | list:22 | `builds/candidates/flydiy-build (4).json` | HELD | 3.82 | 4.68 | 4.94 | boomL:attach | wing tension at its fitting |
| B-ITES | list:23 | `builds/candidates/B-ITES.json` | HELD | 3.85 | 6.78 | 6.87 | wing0R:root | wing tension at its null |
| Ultralight twin on floats | list:27 | `builds/candidates/build_v7_ultralight_2026-09-05_floats.json` | HELD | 5.98 | 5.98 | 6.02 | wing0R:strut | wing tension at its fitting |
| Pawnee | list:24 | `builds/candidates/pawnee (1).json` | HELD | 8.04 | 8.04 | 9.10 | wing0L:root | wing tension at its fitting |

Reading it:
- BROKE UP = the damage layer broke a member before the 5.7 g ultimate had held 1.5 s. Stearman and Tiger Moth: an
  interplane wire lets go in tension at its fitting (Stearman from 4.06 g, under the ultimate, over the 3.8 g limit).
  Super Petrel LS and Mosquito: the wing root kinks.
- twinBoomFail (list:22) HELD the load test but its destroy run lets go at 4.94 g (the boom's attach): the two runs
  differ in their setup (the destroy run carries the certificate's attachments), so the 5.7 g hold and a sub-5.7 g
  let-go can both be true of one card - worth a look in the study.
- "first bend 3.85" on several: the first permanent set sits just past the 3.8 g limit (the yield proxy's own rule).
