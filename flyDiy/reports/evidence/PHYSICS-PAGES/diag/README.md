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
