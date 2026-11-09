CESSNA-RUNNER: sweep PASS, land V2 FAIL, floats V2 FAIL, gates PASS - the sweep is clean (only pawnee moves, -14.1 kg), and the land V2 is inside on empty (729 kg) and lands with flap, but LDG50 (game) went near->outside (438->464 m); the floats V2 rebuilt on it is still flapless at gross (CG 39.1 % MAC, deAppr -0.065), empty 846 kg, and does not get off the water at MTOW; the three red gates are red on master with the same lines.

# CESSNA-CLOUD 2026-11-08 (run 2026-11-09): the V2-172's heavy runs, for FLAGSHIP

This run only measures and reports. Nothing was tuned or fixed.

- new = `claude/alloy-frame` dbd37ff77, built here (`node tools/build.js`, build ca531cc465b4)
- base = master bddb81b0f, built here (build 34a32d206c6f)
- Both trees ran from a cold join cache. The cloud box has 4 cores. The sweeps and the land run went in parallel, then the floats run and the gates.
- **Note on the built files.** On `claude/alloy-frame` the committed built files (`tools/flight_core.js`, `index.html`, `dev.html`,
  `sw.js`, `version.json`) are still master's build 34a32d206c6f. A fresh `build.js` on dbd37ff77 gives ca531cc465b4 (11 changed lines in
  flight_core.js: A1/A4). Every run here used the fresh build. The branch needs its "(built)" commit before it merges.

## Step 1. SWEEP: PASS

Files: `sweep_diff.txt`, `sweep_base.json`, `sweep_new.json`.
- base: 106 files, 0 errors. new: 108 files, 0 errors. 32 files are "not a build" (skipped the same way on both). 73 are identical bit for bit.
- (a) PASS. All five hashes are the same on both sides:
  cub_2026-09-20_corrected 0453d25b7c784f47, jodel_2026-09-20_corrected 885861d232eb20e7, rufus_2026-10-18_certified 98871b21080d3f16,
  pa18_floats_2026-10-23 f56cb4262d9ff613, candidates/Twin_busher_floats_4b 4d71a758c5ac74f6.
- (b) PASS. The only mover is `builds/candidates/pawnee (1).json`: empty 321.5 -> 307.4 kg (**-14.1**, A4 as expected), cgX -0.183 -> -0.207,
  tubeFabric/oleo, 1 seat (1 drawn). The two cessna172r_*_2026-11-08 files exist only on new, so the diff cannot count them as movers.
  On new they read: land empty 728.98, all-up 1081.6, cgX 1.155, 111/467, hash 8452ac98c13b7690. The DRAFT floats file (before the
  step 3 rebuild) read empty 813.53, all-up 1166.17, cgX 0.748, 138/558, hash 5e73d6e2c72a2d1c.
- (c) PASS. 0 errors in new.json.

## Step 2. LAND V2-172 flown: FAIL (one row, (c))

Files: `v2land.log`, `v2land.json` (real_check `--ref=c172r`, 1417 s).
- (a) PASS. `facts.landsFlapless === false` (flapsGame ldg 1). The game's pilot flew flap 1.00 at MIN, TYP and MTOW (`flapLdgFlown` 1 at each). All three runs stopped, none hard, no go-arounds.
- (b) PASS. Empty is **728.98 kg**, inside 721-744.
- (c) **FAIL.** Compared row by row with `reports/evidence/REAL-CHECK-2026-11-08/c172v2.json`. That baseline was 2 inside / 9 near / 6 outside. This run is 5 inside / 5 near / 7 outside.

| row | baseline | new | ours (base -> new) | band |
|---|---|---|---|---|
| empty ledger | near | **inside** | 669.05 -> 728.98 | 706.6-758.9 (ref 721-744) |
| Vs1 airframe | inside | inside | 93.29 -> 93.20 | 91.6-97.3 |
| V75 airframe | near | near | 194.55 -> 194.45 | 207.6-229.5 |
| Vmax airframe | inside | inside | 221.35 -> 221.28 | 218.2-241.1 |
| roc airframe | near | near | 3.32 -> 3.34 | 3.5-3.8 |
| roc POH | near | near | 3.26 -> 3.23 | 3.5-3.8 |
| roc game | outside | outside | 3.10 -> 3.18 | 3.5-3.8 |
| L/D airframe | outside | outside | 11.21 -> 11.21 | 8.1-9.9 |
| TO airframe (grass) | near | **inside** | 266.0 -> 283.7 | 279.4-296.7 |
| TO POH | near | near | 274.6 -> 278.6 | 279.4-296.7 |
| TO game | near | near | 265.8 -> 278.2 | 279.4-296.7 |
| TO50 POH | outside | outside | 771.7 -> 788.2 | 498.2-529.0 |
| TO50 game | outside | outside | 756.7 -> 781.9 | 498.2-529.0 |
| LDG POH | outside | outside | 136.4 -> 138.9 | 159.3-176.0 |
| LDG game | outside | outside | 227.0 -> 239.7 | 159.3-176.0 |
| LDG50 POH | near | **inside** | 374.4 -> 377.6 | 375.0-414.5 |
| **LDG50 game** | **near** | **outside** | **437.99 -> 463.75** | 375.0-414.5 (ref 394.7) |

  Three rows improved (empty, TO grass, LDG50 POH). One row got worse: **LDG50 (game) went from near to outside, +25.8 m**. In the flown
  game lines the 50 ft landing distance is 494 m at MIN, 496 m at TYP and 461 m at MTOW. Touchdown is 86 / 86 / 84 km/h with sink 1.08 / 1.10 / 1.31 m/s.
- CG, static margin and approach trim (flap 0.75):

| load | mass kg | CG % MAC | SM % | deAppr | deAppr clean |
|---|---|---|---|---|---|
| MIN | 837 | 30.8 | 25.4 | +0.077 | 0.192 |
| TYP | 885 | 31.0 | 25.4 | +0.075 | 0.189 |
| MTOW | 1127 | 40.7 | 18.9 | -0.061 | 0.101 |

  The quick run gave 30.8 / ~ / 40.7. This run agrees.

## Step 3. FLOATS V2-172 on the new land file, on water: FAIL ((b), (c)). Stopped at (c) as the brief says.

Files: `v2floats_make.txt`, `v2floats_ledger.txt`, `v2floats.log`, `v2floats.json`. The rebuilt file is committed:
`builds/cessna172r_floats_2026-11-08.json`.
- Rebuild: `v2floats.js builds/cessna172r_floats_2026-11-08.json fltMass=48.25`. Output: "44 float rows (finVentralZ, finVentralTip, gearFloats,
  cw_propD + flt*), gear floats, prop 2.083 seaplane".
- Diff to the land file (75 paths). These are only float rows plus prop D and pitch:
  - the cage `flt*` rows (fltMass 48.25), `gearFloats` 0 -> 1, `finVentralZ` - -> 0.08, `finVentralTip` - -> 0.35;
  - `cw_propD` 1.905 -> 2.083. This is the cage's mirror of prop D.
  - `spec.gear.type` tricycle -> floats, and `spec.gear.floats.*` taken whole (preset "Wipline 2350", mFloat 55.2);
  - `spec.prop.D` 1.905 -> 2.083, `spec.prop.pitch` standard -> seaplane.
  - Against the old DRAFT, only the land changes came through: noseLen 0.45 -> 0.674, eng_mountGap 1.76 -> 0.4, cw_cowlLen 0.9 -> 0.733,
    noseBody - -> 1, outfit.trim - -> "full".
- (a) PASS. The ledger's gear row is **139.9 kg** (138 +-3).
- (b) **FAIL**. Empty is **846.2 kg**, outside 797-820 (real_check calls it "near"; its band is 781-836). The DRAFT was 813.5. The rebuild added +32.7 kg, which came with the new land file.
- (c) **FAIL, the main question.** `facts.landsFlapless === true` (flapsGame ldg 0). The game's pilot landed with flap 0.00 at MIN and TYP.

| load | mass kg | CG % MAC | SM % | deAppr (flap 0.75) | deAppr clean |
|---|---|---|---|---|---|
| MIN | 954 | 30.0 | 28.5 | +0.062 | 0.183 |
| TYP | 1003 | 30.2 | 28.5 | +0.059 | 0.179 |
| MTOW | 1244 | 39.1 | 22.9 | -0.065 | 0.098 |

  The CG at gross moved from 45 % MAC to 39.1 %, and deAppr at gross is still negative (-0.065). The file is still flapless.
- The brief says to stop at (c), so (d) and (e) are not graded. The run had finished, so its readings are below without a verdict:
  - water take-off MIN: POH 231 m / 17.4 s, rig 337 m / 21.0 s, game 314 m / 20.0 s.
  - water take-off TYP: POH 277 m / 20.4 s, rig 398 m / 24.4 s, game 357 m / 22.9 s.
  - water take-off **MTOW (1244 kg): the POH technique did not take off (TOW null, hump R/W 0.355). The game's pilot did not take off either (TO null, outcome
    "stopped", 70 s).** The rig with no flap took 1067 m / 66.0 s.
  - real_check's own verdicts (interpolated to 920-1157 kg): TOW POH 199-419 inside, TOW game 284-490 inside, TOWs POH 15.4-29.5 inside, TOWs game 18.0-31.8 inside.
  - `crashed` is null in every water run, and the log has no capsize or sim-diverged line.

## Step 4. NODE GATES: PASS

Files: `gates_new.txt` (all 19 on w-new), `gates_base_fails.txt` (HANDLE and FREIGHT on w-base), `gates_base_engconfig.txt`
(ENGCONFIG on w-base). The floats file had already been rebuilt in w-new when the gates ran. No gate reads that file.

PASS on w-new: BUILD, WEIGHT, CABIN, SEATS, PILLAR, FRAMES, KNIFE, COWL, JOIN, WINGROWS, FLOATKIT, HYDROTRIM, ENERGYBASE, ENERGY,
TANKMOUNT, PLANELISTS (16 of 19).

- **HANDLE: FAIL (2), red on master too, same lines.**
  ```
  FAIL bugReports/Twin_busher_floats_2.json: doorHandle/star is on the hinge edge, not opposite it
  FAIL bugReports/Twin_busher_floats_2.json: doorHandle/port is on the hinge edge, not opposite it
  GATE HANDLE: FAIL (2)
  ```
- **FREIGHT: FAIL (1 of 2511), red on master too, same line.**
  ```
  - cub: FREIGHT_CARDS = its build measured off its mesh (tools/_freight_site.js)
  2511 checks (cards measured)
  GATE FREIGHT: FAIL (1 of 2511)
  ```
- **ENGCONFIG: FAIL**, red on master too, the same 16 FAIL lines (diffed: identical). Its IDENTITY block digests against an old
  master pin (2c2a74459), which master bddb81b0f also fails. The lines are verbatim in `gates_base_engconfig.txt` and `gates_new.txt`:
  ```
  FAIL  builds/cub_2026-09-20_corrected.json                 042d13ba5da78ab6 8064ad76b0127161  (master 155419e4ddd55891 5f81fcf4b4175980)
  FAIL  builds/jodel_2026-09-20_corrected.json               69507f1f10405b4c 3497672e75dd4e23  (master 33c1b6b22fa8a5d5 b281985b850ee5b7)
  FAIL  builds/cessna172_2026-09-20_corrected.json           4b96bdef8b315409 b4a926d9ce6d6b33  (master cfff2062f514f276 c3124e0092d05851)
  FAIL  builds/chinook_2026-09-21_corrected.json             0ce32059d36b92a3 9a62a6a61fcc8556  (master bf6854b8a6066f35 f4dbe53bc257a050)
  FAIL  tools/fixtures/build_v7_ultralight_2026-09-05.json   f6a9c697f782f45b e7942c80c42fb7f0  (master ae93bc2acf2aa2c7 152e8c2cbb80d7b5)
  FAIL  tools/fixtures/build_v8_pusher_2026-09-11.json       790e2dd9045031e6 1e888903ddfb652c  (master 382e0869b7b40fca 1e888903ddfb652c)
  FAIL  bugReports/cessnaMetal (1).json                      94470c8f8a15303b a46c863c418b9466  (master a7ef3e20bbb60e99 3424501b41d6e08a)
  FAIL  bugReports/cessnaFloatsWOrks.json                    f96f0f0fb183066c c0cb85e1b844a200  (master ad5b0932430ce736 654023193f98094b)
  FAIL  tools/fixtures/repro/rufus_2026-10-18_certified.json 4cdd3f968a12bfe3 210d8b580d8fe556  (master de3b3f1e42596986 af31390fe113f650)
  FAIL  quad level: never wings-level on the downwind
  FAIL  quad cut 0: never wings-level on the downwind - an inner engine out flies
  FAIL  quad cut 2: never wings-level on the downwind - an outer engine out flies, and yaws more than an inner
  FAIL  pushpull  pushPull, 2 x io360_mccauley, 1035 kg: the game's load is the saved aeroplane false, join errors 0, design PASS (static margin 0.141 as drawn, 0.111 at the worst corner)
  FAIL  trimotor  tri, 3 x rotax912_warp, 826 kg: the game's load is the saved aeroplane false, join errors 0, design PASS (static margin 0.241 as drawn, 0.162 at the worst corner)
  FAIL  four      quad, 4 x rotax912_warp, 938 kg: the game's load is the saved aeroplane false, join errors 0, design PASS (static margin 0.221 as drawn, 0.158 at the worst corner)
  FAIL  the cards: pushpull: DIFFERS from the saved file (run --write after a deliberate change); trimotor: DIFFERS from the saved file (run --write after a deliberate change); four: DIFFERS from the saved file (run --write after a deliberate change)
  GATE ENGCONFIG: FAIL
  ```

Every gate is PASS or red on master too with the same lines: **gates PASS**. None of the three reds is ours.

