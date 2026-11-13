# Cooling section: the configuration sweep (13 Nov 2026)

Every card the load door takes (builds/, builds/candidates/, tools/fixtures/), drawn desktop (cream) and phone (320 px, dark) by fiche_physics.js svg("cooling") on genFicheCooling. Checks: a well-formed svg, no NaN / undefined / Infinity, no phone text estimated past the edge.

After the nose-ring fix (de0c02c3: only a nose engine takes the fuselage's first ring) the 22 wing / pod / pusher cards were re-run, with the two space-named candidates the first run had split.

**64 cards, 64 render OK on both, 0 with text past the edge.**

| configuration (kind · path · facing · mounts) | cards | hot-day climb margin (min-max) | e.g. |
|---|---|---|---|
| measured · air · tractor · nose | 36 | 0.0 - 4.6 | c172r_wipline2350_landprop_2026-10-20.json |
| bare · liquid · pusher · pusher | 6 | 1.3 - 1.4 | chinook_2026-09-21.json |
| measured · air · tractor · wing+wing | 4 | 1.1 - 1.4 | dc3_2026-10.json |
| measured · liquid · tractor · nose | 3 | 0.7 - 1.1 | stol_cub_showcase.json |
| measured · liquid · pusher · pusher | 2 | 0.0 - 1.3 | Twin_busher_floats_4b.json |
| bare · liquid · tractor · wing+wing | 2 | 1.4 - 1.4 | build_v7_twin_2026-09-04.json |
| measured · liquid · tractor · wing+wing | 2 | 0.6 - 1.5 | build_v7_ultralight_2026-09-05_floats.json |
| bare · air · tractor · nose | 2 | 5.2 - 5.2 | stearman_2026-10.json |
| measured · electric · tractor · nose | 2 | 0.3 - 2.5 | build_v8_twin-boom_2026-09-11.json |
| bare · liquid · tractor · nose | 1 | 2.5 - 2.5 | rufus_2026-10-18_certified.json |
| measured · liquid · pusher · wingTop | 1 | 1.5 - 1.5 | superpetrel_V4_1.json |
| measured · liquid · tractor · wing+wing+wing+wing | 1 | 2.3 - 2.3 | build_v10_engcfg_four_2026-10-22.json |
| measured · air · pusher · nose+pusher | 1 | 0.3 - 0.3 | build_v10_engcfg_pushpull_2026-10-22.json |
| measured · liquid · tractor · nose+wing+wing | 1 | 2.4 - 2.4 | build_v10_engcfg_trimotor_2026-10-22.json |
