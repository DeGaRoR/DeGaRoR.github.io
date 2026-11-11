# DIAGNOSTIC: the drawn plane against what the sim flies (A0 for the user, 11 Nov)
- load_one.js + probe_raster.js: each plane through the load door with FLYDIY_JOIN_PROBE=probe_raster.js (FLYDIY_JOIN_NOCACHE=1):
  the headless editor's visible meshes rasterised into side / plan / front silhouettes (60 px/m, RLE).
  `cat planes.txt | FLYDIY_JOIN_NOCACHE=1 FLYDIY_JOIN_PROBE=$PWD/probe_raster.js xargs -P 3 -L 1 node load_one.js`
- the baked fiche planes use their fiche render instead (fm_<k>_<view>.bin alpha masks from media/fiches; fiche_masks.json).
- diag.js: the frame fit (the nodes onto the silhouette), the measures (wing span / chord, tailplane span / area / position,
  fin top, the body's end on the plan's centreline - fiche renders only: the editor scene has no fuselage skin), the drawing.
- gallery_diag.js -> diag.html (published: the user's Model Diagnostic artifact). diag_rows.json: the findings.
