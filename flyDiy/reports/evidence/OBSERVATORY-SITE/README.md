# OBSERVATORY-SITE evidence (13 Nov 2026)

- `trace_cub_HOME_mt_strip.log` - `node tools/altiport_trace.js --build builds/cub_2026-09-20_corrected.json --from HOME --to mt_strip --tmax 1500`
  (the game's flight: 8 kt / 250 deg day, the page's pilot, damage on). Mode: node, this branch's record and core.
- `trace_cub_mt_strip_HOME.log` - the same, `--from mt_strip --to HOME` (from the altiport's stand).
- `search.js`, `fit.js`, `design.js` (+ `world.js`, their loader) - the strip's site search on the DEM (node; the world without the
  catalogue = the raw ground): `node search.js` (coarse: length, top end, heading, a 4-point profile from the ground, scored on
  cut/fill +-10 m), `node fit.js` (the local refinement that chose 210 m at c (205, -80) from the summit's site frame, due west),
  `node design.js '<json>'` (one design's profile, slopes and cut/fill table). Run from this folder; world.js's path is absolute
  to the cloud checkout - edit T for another tree.
