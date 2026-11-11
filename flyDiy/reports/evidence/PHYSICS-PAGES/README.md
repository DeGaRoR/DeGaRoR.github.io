# PHYSICS-PAGES, prototype 1 (11 Nov 2026)

Prototype fiche pages that show the physics a player never sees: LOAD TEST, DRAG, ELECTRICS, TANKS & STRUCTURE,
for the three official planes (Cub `builds/cub_2026-09-20_corrected.json`, Metal Cessna `builds/cessna172_2026-09-20.json`,
Twin busher `builds/candidates/Twin_busher_floats_4b.json`), loaded through the game's door (tools/_load_build.js).
No new physics: every number comes from a core function, named on the page. Gallery published as an Artifact for the user.

Run order (paths are absolute to a /workspace clone; the scripts write next to themselves):
  node specs.js          the three specs through LB.loadBuild -> specs.json (not committed, 20 s)
  node load.js cub|c172|twin   makeLoadTest at 3.8 / 5.7 g, the shape at limit, each member's force / its yield (fy0, fc0)
  node drag.js           def.params.gen.drag rows, the gear row split (genGearCdA's own terms, sum checked), each row's
                         km/h by the core's cruise rule (drag = 65 % thrust, 64_gen_build's pod rule) with that CdA taken off
  node elec.js           genSystemsResolve (the fitted lights), makeBus run with the generator off to 9 V
  python3 calib.py       fits the core's nodes onto the baked fiche pictures (media/fiches/*/side|plan|front.webp, pxPerM known)
  node gallery.js        render.js's four SVG pictures per plane -> gallery.html

Findings:
- the float hulls carry no air drag: a float build is charged by genGearCdA as two bare wheels + a third wheel + legs;
  32_hydro has no air term (Twin busher: 0.133 m2 "main gear" = 13 km/h, an asterisk on the page)
- the Cub at night with every light on: 19.5 A of its 20 A generator; battery alone 49 min
- the game pages should read the fiche bake's camera frame (centre + px/m per view) instead of fitting: one re-bake
