# DMG-RECAL (G2030-G2034) - evidence

Base = `7846e790` (claude/dmg-floatto, the held water/ground bundle), built in a worktree; after = claude/dmg-recal.
Plots are written by `node tools/dmgrecal_evidence.js` from `data/`.

| file | what | how it was measured |
|---|---|---|
| `gates_before.txt` / `gates_after.txt` | the 17 targeted gates, whole outputs (`run_gates --no-build --verbose --jobs=4 --only=...`) | base worktree / this branch, both built with `node tools/build.js` (exit 0) |
| `gates_diff.txt` | the two, diffed (timings and progress lines dropped) | `diff` |
| `hull_side.svg`, `data/hull_law_*.json` | G2030: GATE DMGHULL's LAW bench at each float's hump pose - the side term over U w and the wetted keel stations against the slip angle | `node tools/_dmghull_check.js --child=law:<cessna|twin>` (this branch's gate), the file as written with `FLYDIY_RAW_BUILDS=1` |
| `plough_hump.svg`, `data/plough_cessna_*.json` | G2032: the Cessna on floats' calm take-off - keel trim and R/W against C_V | `node tools/_dmgplough_check.js --child=xw:cessna:0:base` (game / `FLYDIY_RAW_BUILDS=1`) |
| `data/plough_cessna_game_ballast1018.txt`, `data/plough_cessna_game_de.txt` | INSTRUMENT: the game's Cessna with every node's mass x1.07 (the file's 1018 kg, the CG kept); the stick through the plough (0.02: G396.4's neutral) | a scratch script stepping `makePilot` + `makeSim` on `L.defOf('floats')` |
| `cub_rollout.svg`, `data/cub_rollout_*.csv/json` | G2034: the user's Cub, PILOTMATRIX's crosswind roll-out (`pilot_trace.js builds/cub_2026-09-20_corrected.json --wind 0,<w> --csv`) | before = the base worktree's `flight_core.js` (`--core`), after = this branch; `file_4` = `FLYDIY_RAW_BUILDS=1` (the pre-JOIN-PARITY aeroplane) |
| `floats_landing.svg`, `data/floats_landing_*.json`, `data/floats_gate_*.txt` | G2033: GATE FLOATS' landing - the water's lift / W per frame from the first touch | GATE FLOATS with a per-frame series dump (game / `FLYDIY_RAW_BUILDS=1`) |
| `data/taxi_work_metal.txt` | TREECRASH 3 traced: the metal Cessna's 3 m/s taxi into a trunk, the plastic work per member (game / file) | `L.atTrunk('metal', {D:4, V:3, thr:0, secs:8})` under the certificate, `sim.damage().wB` |
| `data/cards_flaps.txt` | G2034: genTrim's flap decision on every active archetype card and the five validated builds, before / after | `buildGen` on `designBake` cards and `tools/_load_build.js` specs |
