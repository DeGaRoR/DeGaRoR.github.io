# PILOT-44-REDS (G2530) - evidence

MODE: node only (a 4-core cloud box, no GPU). TREES: BEFORE = origin/claude/pilot-44 fa4e2409 (the box run's tree);
AFTER = claude/pilot-44-reds-g2530 (src as of 53343347; the later commits are tools / evidence / HANDOVER only).
"The game's flight" = tools/_tour_lib.js gameHost (the worker's host, the page's placement and pilot, DAY_CLOCK's 8 kt /
250 deg day ticked every step, the load door's aeroplane, damage ON).

| file | what | mode / tree | command |
|---|---|---|---|
| taxiclear11c_cub_mine45_before_fa4e2409.log | TAXICLEAR 11c's Cub from Jumbo Mine 45 m, every step the wing came within 1.5 m of a footprint's plan with the lowest node's height over its top | node, fa4e2409 src | `node reports/evidence/PILOT-44-REDS/mine45_probe.js cub 45` |
| gates_taxiclear_after.log | GATE TAXICLEAR, 4 shards | node, after (tools change; src = fa4e2409) | `run_gates --no-build --only=TAXICLEAR --jobs=4 --verbose` |
| altiport_trace_metal_8kt_before_fa4e2409.log | the metal Cessna HOME > tw_ski traced (2 s; the roll every 0.25 s) | node, the game's flight, fa4e2409 | `node tools/altiport_trace.js --build tools/fixtures/build_v10_cessnaMetal_2026-09-26.json --fine --tmax 1500` |
| alti_metal_8kt_before_fa4e2409.log / alti_metal_8kt_after.log | the same leg through _tour_lib flyLeg, with the approach's record (ap.appr.held) | node, the game's flight, fa4e2409 / after | `node reports/evidence/PILOT-44-REDS/alti_metal_probe.js` |
| alti_metal_calm_before_fa4e2409.log / alti_metal_calm_after.log | the same, the day held calm | node, calm, fa4e2409 (its own worktree) / after | `... alti_metal_probe.js <metal json> HOME tw_ski calm` |
| c172_tour_w3_twski_before.log | GATE TOUR shard 1's tour to its red leg (w3 > tw_ski) | node, the game's flight, fa4e2409 src | `node tools/island_tour.js --build c172 --order HOME,w3,tw_ski --verbose` |
| floats_loaddoor_fa4e2409.log / floats_rawfile_fa4e2409.log | the float Cessna SEA > mk_sea: the load door's build / the file as written | node, the game's flight, fa4e2409 src | `node tools/island_tour.js --build floats --order SEA,mk_sea --verbose` (FLYDIY_RAW_BUILDS=1 for the file) |
| gates_battery_after.log | the battery: the 22 gates of the box run | node (+ headless Chromium for UISMOKE), after | `node tools/build.js` then `run_gates --no-build --only=... --jobs=4 --verbose` |
| c172_tour_home_twski_w2_after.log (+ c172_home_tw_w2.json) | after the refusal: HOME > tw_ski (refused, diverted to 13/31) > w2 - the propeller strike on 02/20 | node, the game's flight, after | `node tools/island_tour.js --build c172 --order HOME,tw_ski,w2 --verbose --json ...` |
| w2strike_before_fa4e2409.log / w2strike_after.log | the metal Cessna HOME > w2: the strike's time, what (water), the water's depth under the lowest node | node, the game's flight, fa4e2409 (its worktree) / after | `node reports/evidence/PILOT-44-REDS/w2strike_probe.js HOME w2` |
| gates_tour_after2.log | GATE TOUR again with the 02/20 known red | node, after | `run_gates --no-build --only=TOUR --jobs=4 --verbose` |
| gates_rwytrees_after.log | GATE RWYTREES alone (the battery's run hit the runner's 1800 s cap while side flights shared the box) | node + headless Chromium, after | `run_gates --no-build --only=RWYTREES --verbose` |
| rwytrees_standalone_after.log | GATE RWYTREES standalone (G2125 / G2520's way on a cloud box: the runner's 1800 s cap) | node + headless Chromium, after | `cd tools && node _rwytrees_check.js` |
