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
