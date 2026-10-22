# ALTIPORT-TAXI (G2490) - evidence

Mode: node only (a cloud box, no GPU). Trees: before = `9546d2ee` (origin/claude/pilot-integration), after = this branch
(`7c8d9a8c` for the gates and the tour, `ce0e3084` for the final TAXICLEAR); see HANDOVER `## G2490` for which run used which.

| file | what |
|---|---|
| tour_before_node_game.log / .json | `tools/tour_real_node.js --game --damage 1 --order HOME,tw_ski,nv_strip` on the base: leg 2 crashes into the tram station |
| tour_after_node_game.log / .json | the same on this branch: leg 2 turns on the spot, takes off, lands at East Point |
| leg2_repro.js | the fast repro: the aeroplane seated at the game's stop pose (335.69, -7843.75, nose -1.05), the chained leg to nv_strip (`ROOT_T=<tree>/flyDiy/tools`, `--build`, `--x --z --nose --from --to`) |
| leg2_before.txt / leg2_after.txt | the Cub, the Jodel, the metal Cessna from that pose, base / branch |
| turnaround_census.js, census_before.* / census_after.* | every land strip x build x pose: the plan DEPART makes (246 plans; 32 change, at tw_ski's top end and Jumbo Mine's south end) |
| flyposes.sh, mn_strip_before.txt / mn_strip_after.txt | Jumbo Mine's street, poses 25/45/60/90 m from end0, the three builds flown, base / branch |
| stand_departure.js, tw_ski_stand_departure_after.txt | tw_ski's stand departure flown (the top-end U-turn beside the station): clean |
| gates_base_9546d2ee.log, taxiclear_base_9546d2ee.log, gates_after.log, gates_after_taxiclear_final.log | the gate runs |
