# MASTER-GREEN: master's red gates, triaged (cloud session, started 22 Nov 2026)

Base: origin/master 9349a62c1 (train L40h), core battery 301 PASS / 61 FAIL on the box (A0's `land_L40H_gates.log`).
Branch: `claude/master-green`. Readies: `claude/ready/green-<n>`. This file is kept current: read the STATUS block first.

## STATUS (updated 22 Nov, block 2)

- 61 reds. **17 have a fix or a reasoned re-pin on this branch** (green-1, below). 5 are in hand elsewhere. 39 are for
  owners or still being traced; every one has a first read in the table.
- **A REAL L40h REGRESSION, live on master (read this one first):** ELECTRIC-TRAINER cfe477466 added four garage rows
  (`frLeanCap`, `boomRound`, `boomRoundAt`, `finVentralLand`) without a `CAGE_DEFAULT_ABSENT` entry, so the save writes
  them at their defaults into EVERY joined build. Every validated build's bench / parked / certificate-store /
  procurement key moved at L40h (GATE STOL: "keys MOVED" on all six builds at L40h, on the Cub alone at L40f / L40g).
  Proven here: with the four declared absent the Cub's joined def is L40f's again but for REG-PLACE's three decal
  numbers. The fix is one line; it is NOT in green-1 (it moves every fingerprint back, so the cooked packs must be
  checked with it): it is green-2, next.
- **green-1 is NOT pushed as a ready yet.** Each of its 17 gates passes when run alone here, except ACCEPT (a 300 s
  gate, not re-run yet). The battery on the branch has not been run: the cloud baseline of master's 61 reds is
  still running (this 4-CPU box runs the gates 2-3x slower than A0's). Then the whole core battery runs ON THE BRANCH,
  once; its FAIL list is compared with A0's L40h list, and any gate red here and green there is run alone on master to
  tell this box from a regression. The ready is pushed after that, with both lists in its commit message.
- Nothing here weakens a gate. Every re-pin names the change that moved the pin and is its own commit.

### What A0 can relay now

| to | what |
|---|---|
| AIRCRAFT-LOOKS (livery) | NAMES: a livery mark is shown as "Alaska" (a real name by the user's table) and the row hint says "the twelve Alaska marks". |
| FLAGSHIP | **the four ELECTRIC-TRAINER rows written at their defaults (above)**; DESIGNCHECK (the carbon boom reads 2.4x softer than its drawn shell since HULL-B50's k x0.55); CANDIDATES (jodel_geo, superpetrel_V4_1 have no index row); FLEX + LOAD (the softShell cantilever folds); the Archaeopteryx card (TANKMOUNT's tank at x0.45; `GP_PARKED_FOOT.archaeopteryx` half 5.5 m against a 6.50 m half-span, TAXICLEAR 1); the E811 rows already named (MONOWHEEL, TAILWHEEL). |
| TOW-LAUNCH | CANDIDATES (buggy, roadster have no index row); TERRAINMATCH's pavement budget (+2 %, the joined roads). |
| SKYLINE-RESORT | RWYLIGHTS: the footpath `tw_p_launch` runs along tw_ski's light line, 7 of 24 lights left out. |
| Deform | DMGDETERMINISM: 44 builtin `Math.sin / cos / pow` sites in src/core (list in the log); plus the older DMG rows below. |
| Game | DESTTO's career rows; the six tools JOINPARITY names (TUTORLOCK's among them); STAGES' `--selftest` crashes on master (it looks for `sg_k_hangar`, gone from the record) - not a battery row. |
| Pilot | GEN (cruise in wind), GLIDE, UNIFY, SLOPE, TAXICLEAR 11c, ALTIPORT, TOW, RADIALDIV: first reads below. |

### A trap found on the way (for any session that bisects)

`tools/.joincache` (gitignored) is keyed by the load chain's code, not by `media/`. A tree checked out WITHOUT `media/`
builds a different joined aeroplane (the Jodel 465.054 kg instead of 470.666) and leaves that answer in the cache; the
same tree with `media/` back then reads the wrong one. Bisect load-chain gates with `media/` present and delete
`tools/.joincache` at every step. The 8 Nov sweep suspected a warm cache behind TREECRASH's reference: this is how it
can happen.

## The table

Class: **REAL** = the game (or its data) is wrong; **PIN** = a baseline a named, wanted change moved; **FLAKY** = proven
by two different results on one build (none so far); **?** = first read only, not yet proven.
Status: **green-1** = fixed or re-pinned on this branch; **in hand** = another session's ready; **owner** = for the
owner named; **tracing** = this session is still on it.

| gate | class | cause, in one line | owner | fix | status |
|---|---|---|---|---|---|
| GROUNDQUERY | PIN | SNOW-MUD RAIL put `SURFACE_WX_NAMES` ahead of `PREMISES_V` in 27_premises.js's export literal; the gate's hook anchor matched nothing and it died before any check | orphan | anchor on the literal's opening (asserted once) | green-1 |
| ACCEPT | PIN | CONTROLS-STRIP (L40g) put `ctlStrip()` between `hudGear()` and `ACCEPT_REC.frame()`; the row admits hudWind / hudGear only | orphan | `ctlStrip()` admitted the same way | green-1 (gate not re-run yet) |
| WINGSTRUCT | PIN | TOW-LAUNCH's `vehicle_kind.js` sits between `wing_struct.js` and `garage.js` in build.js's viewer list | orphan | that one file admitted | green-1 |
| NODUMMY | REAL (a name) | HULL-B12's closure `atD` in tools/_cage_gen.js reads as the retired figure's ATD | orphan | renamed `atDeg` | green-1 |
| SAVE | REAL | SKIS: the wheel-ski preview row `skiPos` is skipped by the save but was not in `CAGE_VIEW_KEYS` ("lost 1 of 1166") | orphan | declared a view key, as gearPos / gearLvPos | green-1 |
| DESIGN | REAL | the roadster card (CAR-1) still sets `cw_partLevel`, a row retired 13 Nov. (The canClear row A0 named is PARTS', not DESIGN's any more.) | orphan | dead key off the card | green-1 |
| STORAGE | REAL | `PREM_STORE.spots` behind the cooked pack since L40f: w4 0 vs 12 (AFB-0220-B2), tw_ski 0 vs 2 (SKYLINE-RESORT), no xw_rough row | Game (done here: mechanical) | the table follows the pack | green-1 |
| STAGES | REAL | `PG.stageRestore` put `stage` last on every restored entry; nv_strip and tw_ski carry MICRO's `micro` after `stage`, so a staged save swapped two keys (19 rows) | Game (done here) | the restored entry keeps the whole entry's key order | green-1 |
| MEDIA | REAL (data) | thumbs/index.json kept a row for `cub_fittings_hand` (in review/ since 4 Nov), its webp gone | orphan | row dropped | green-1 |
| ASSETS | REAL | (1) REG-PLACE PICTURES 7e8f50cce copied list:1's thumb + hero to `design_cub.webp`; (2) CAR-3 made two materials with `new THREE.*Material` in tools/_cowl_gen.js | orphan | (1) design:cub points at list_1.webp, copies removed; (2) `MATLIB.make` | green-1 |
| ENERGYBASE | PIN | `carbon`: HULL-B50 4ab3c819d (the user's composite recalibration; on master since L35c's merge of seaplanes 7d6ad8b11 - bisected). `electric`: ELECTRIC-TRAINER 3bbc9984d (L40h, the user: "modify the existing E811") | orphan | `--bless`; 12 of 14 cases byte-identical | green-1 |
| ENGINE | PIN | ENGINE-DIALS A 75e9863bb (in at L38c2's merge 95af1ce1c - bisected): custom power cap 1 -> 2 MW; a custom engine's own 1.80 m prop, so Tstatic goes as (P D)^(2/3) | orphan | both rows re-pinned (the cap exact, the disc asserted) | green-1 |
| TREES | PIN | GRASS-CARDS 3d66d2a4e (L40f, the user 16 Nov): the lawn plants `grass_plates`, so the "unreached" census is five | orphan | list re-pinned, still exact | green-1 |
| SHADOWSKY | PIN | FOREST-MIST A put `${FM_A ? ... : ''}` ahead of `tScene < deckEntry(o, d)` in clouds.js | orphan | that prefix admitted | green-1 |
| LAKEBED | PIN | ROCK-STUDY d98560831 (L40f) narrowed the ring's discard with `&& vRM.w < 1.5` (still two discards) | orphan | line re-pinned | green-1 |
| WINGROWS | PIN | 80b1759a5 (13 Nov, the LS4): the tip chord's floor 0.45 -> 0.35 x the root | orphan | two rows re-pinned to 0.735 | green-1 |
| TAILWHEEL | ? | E, I: the circuit rows (L40h, the E811 change) | Pilot / FLAGSHIP | claude/ready/pilot-slope-power | in hand (the ready is not on origin yet) |
| MONOWHEEL | ? | E: parked on the wheel, the nose skid and one wingtip skid (L40h) | FLAGSHIP | user-fixes-1121 or a sliders ready | in hand (not on origin yet) |
| PARTS | REAL | `canClear` is rendered and claimed by no part (1566 vs 1567) | FLAGSHIP | as above | in hand (not on origin yet) |
| GFX | REAL | perf_bench.js reads the device outside welcome.js | Game | claude/ready/perfbench-gfx | in hand (on origin) |
| FLIGHTREC | PIN | the rows regex app.js's hold line; NEW-PLANE widened it (8 Nov sweep) + a third row (worldPrelinkGfx) | A0 | claude/perf-codex / perf-trace | in hand |
| NAMES | REAL | LIVERY-5 fb442d878: a mark named "Alaska" (aeroskin.js:3125, livery_marks.js:29) and the hint "the twelve Alaska marks" (_cage_ui.js:5622) are shown | AIRCRAFT-LOOKS | a fictional shown name (the id may stay) | owner |
| CANDIDATES | REAL (data) | four files in builds/candidates/ with no index row: jodel_geo, superpetrel_V4_1 (since REAL-CANON 2f90acd8c, 12 Nov), buggy, roadster (TOW-LAUNCH) | FLAGSHIP + TOW-LAUNCH | a row with `hide` each, or review/ (GATE SKIS flies superpetrel_V4_1 from that path) | owner |
| RWYLIGHTS | REAL (scenery) | tw_ski (280 x 6) keeps 17 of 24: the dirt footpath `tw_p_launch` along the edge (6 left out, 2 flush) and the pad `tw_m_launch` (1); in with AFB-0220-B3's merge of skyline-resort-2 c5f99c8b3 | SKYLINE-RESORT | move the path off the light line, or declare 17 as w4 / w5 are declared | owner |
| JOINPARITY | PIN + REAL | (1) Jodel node 470.666 vs page 469.732 kg: the page capture (15 Nov 04:43) is older than REAL-CANON's landing (L40d merge f1cb81f9e, 19:01; the harness +0.93 kg). (2) six tools read a validated build raw: large_hangar_shot, large_hangar_store_shot, _muddeposit_check, _qscut_check, _tutorlock_check, _unify_check | (1) orphan (2) HOME-DERELICT, GROUND-FX, QUICKSHOT, Game, Pilot | (1) re-capture the Jodel (running here, headless Chromium) (2) through tools/_load_build.js, or declared at its door | (1) tracing (2) owner |
| DMGDETERMINISM | REAL | the census: 44 `sin / cos / pow` sites in src/core on the builtin, not CORE_MATH (00_registry groundSink*, 07e_soil_wet, 26b_strip_micro, 28c_biomes, 29_obstacles, 29c_ski, 32_hydro, 43_pilot gTerr, 60_gen_spec, 62_gen_aero, 62c gear) | Deform + each site's author | CORE_MATH at each site (bits may move: needs the battery) | owner |
| DESIGNCHECK | REAL (a side effect of a wanted change) | "200 N sideways at the post": 4.20 mm against the drawn carbon shell's 1.77 mm (2.37x; the band is 2x). HULL-B50 4ab3c819d (carbon k x0.55): its parent reads 2.83 mm (1.60x), the commit 4.20 - bisected; on master since L35c's merge of seaplanes 7d6ad8b11 | FLAGSHIP | the shell cluster carries the boom's stiffness, or its owner re-argues the band; not widened here | owner |
| FLEX | REAL | (1) the WEIGHT STUDY's `softShell` material in the matrix: "softShell cantilever" doubling 1.21x, folds 39 %, never reached cruise. (2) "tail arm: the tube factor is live" (since L31b gear-falls, 8 Nov sweep) | FLAGSHIP | (1) a soft shell is not a cantilever: the garage's rule or the matrix (2) owner | owner |
| LOAD | REAL | the same row: "GEN softShell cantilever" does not survive the ultimate load | FLAGSHIP | as FLEX (1) | owner |
| TANKMOUNT | ? | archaeopteryx x0.45: a tank that fits has vertices past a surface (2374) and 63 points inside it | FLAGSHIP | - | owner |
| ENGTORQUE | ? | "SIGN swirl": both hands swing the same way. 8 Nov sweep: L31c, TAILWHEELS 3cfc6d101 (the new tail contact dominates the swing) | Pilot / FLAGSHIP | - | owner |
| ENGCONFIG | ? (PIN likely) | 1 IDENTITY: every build's two digests differ from the pinned master's (last re-pinned 12 Nov, ENGINE-COOLING 3; the physics canon and L40a's brakes / engine lump came after) | FLAGSHIP | to trace by train, then re-pin naming each change | tracing |
| STOL | REAL + PIN | (1) three cards differ from master 9f77ac48f's bits: spitfire (fly, since L40g), motorglider and etrainer (def, fly, draw, L40h: the E811 change). (2) the six validated builds' joined spec differs and their keys MOVED: **the four leaked ELECTRIC-TRAINER rows** (L40h, real); under it L40e's colours and tank profile and L40g's REG-PLACE decals (wanted) | FLAGSHIP (the leak) | green-2: the four rows absent at default, then the baseline re-captured with each remaining move named | tracing |
| SKIS | REAL + PIN | 1 "absent is as today": six builds' def digest moved while their sheet and 300 flown steps are the base's to the bit (the base: L40d). The Cub's def diff, measured: L40e's tints + two tank-profile numbers, L40g's three REG-PLACE decal numbers, L40h's four leaked rows. carbon_cub_ss moved in all three (CARBON-CUB-FINAL, wanted) | FLAGSHIP (the leak) | green-2, as STOL | tracing |
| POD | ? (PIN likely) | "pod off, the whole def is the base's bytes": moved on all six, and the certificate / 300 steps. PASS on L38c2 4d7b99acf (its 12 Nov re-pin); the trains since are being run one by one | Game | to trace by train, then re-pin naming each change | tracing |
| GEN | ? | "cruise is quiet in wind": bank p2p 11.6 deg | Pilot | - | owner |
| RADIALDIV | ? | mosquito, mosquito_1: not airborne inside 300 s (new); cub hands off 20 s, the heading moved -176 deg (8 Nov sweep: first red a0aeeeee9, G2080 ENGINE-TORQUE, 12 Oct) | Pilot | - | owner |
| TAXICLEAR | REAL (data) + ? | (1) `GP_PARKED_FOOT.archaeopteryx` is [5.5, 0.6, 5.5] (25_airfield.js:659) and the card builds a 6.50 m half-span; (11c) the C172 off the altiport: the too-short take-off is not rejected | FLAGSHIP (1), Pilot (11c) | (1) the row to the card's span | owner |
| ALTIPORT | ? | 2: the Cub's final begun under the circuit height; 3: the doctored arrival not caught; 4: the metal Cessna breaks up at tw_ski (8 Nov sweep: rows 2-3 since L31c pilot1-circuit) | Pilot | - | owner |
| GLIDE | ? | CIRCUIT archaeopteryx (motor off): landed off the field, sink 17.5 m/s, capsized | Pilot + FLAGSHIP (the card's pitch) | - | owner |
| UNIFY | ? | STRIP: the Cub off-strip at tw_ski (every person); TAIL: the C172 at tw_ski; EMERG: the student lands 1.2 m off Cannery Runway | Pilot | the 6 m roll-out (owed, A0's L40g note) | owner |
| SLOPE | ? | the free roll on ~9 % grass: a 0.461 m/s2 against the law's 0.430 (7.3 %) | Pilot | - | owner |
| DESTTO | ? | career:cub@w3, three rows (the Trust's arc contract). 8 Nov sweep: passes alone, fails in its shard, since L30d cert-m2 | Game | - | owner |
| TOW | ? | CIRCUIT archaeopteryx: no circuit; ALTIPORT: landed off Fishing Village Strip | Pilot + FLAGSHIP | - | owner |
| TREECRASH | ? | the load test (the certificate): at 5.7 g BROKE UP, 4 members set, nothing broken | Deform | - | owner |
| DMGCERT | ? | the float Cessna: holds at ultimate x 1.1, no BROKE AT (8 Nov sweep: G2640 13 Oct, then HYDRO-TRIM at L28a); + a second build's rows | Deform | - | owner |
| DMGGEAR | ? | touchdown headroom rows on two builds; the float nose-in / dig-in | Deform | - | owner |
| DMGCLUSTERS | ? | the FIN pulled sideways comes off by twist (8 Nov sweep: since a69f31fda, 13 Oct) | Deform | - | owner |
| DMGINST | PIN? | the speed guard trips at frame 1, not 0 (8 Nov sweep: G2640; "stale pin, probable") | Deform | - | owner |
| DMGINTEGRITY | ? | the fuselage cut behind ring 3 (10 members): no break-up | Deform | - | owner |
| DMGDAMP | ? | angular momentum drifts in the vacuum spin, 15 rows (8 Nov sweep: since a69f31fda) | Deform | - | owner |
| DMGTYRE | ? | taxi turns tighter than the band; the Cub's crosswind roll-out 28.9 deg (8 Nov sweep: since a69f31fda) | Deform | - | owner |
| DMGFABRIC | PIN? | "damage OFF - the base's bits" on the Cub and the metal Cessna (8 Nov sweep: stale pin, probable) | Deform | - | owner |
| WILGAGEAR | REAL (a garage bug) | tools/_cage_eng.js assigned `window.CAGE_PYLON` twice (WILGA-GEAR 6a6097c49 `{caster, hug, NS}`; the cabane pylon 1f0c59fa9 `{pylonCaster, ...}`): the second replaced the first and "leg fairing root: fitted to the body" threw `CP.caster is not a function` - no gear drawn at all | orphan | one object, both sets of names (59/59) | green-1 |
| OBSTACLE | ? | against the wall under a third of throttle: 1.54 m/s into / off the wall (L40g: joint-tether / contact) | Deform / Pilot | - | owner |
| ROUGHWHEEL | ? | A: the 0.15 m wheel does not stop at the 15 cm stone; the ordering of the wheels (L40g) | Deform / Pilot | - | owner |
| CONTACT | ? | Jolene strip gravel / grass: the drawn surface off terrainH (p5 -13.6 mm); 02/20's band over other pavement (25749 of 38764) | DIRT-STRIP | - | owner |
| PREMRASTER | ? | the raster against the analytic ground: worst 140.6 mm (w6 grade); the LRU sweep | DIRT-STRIP | - | owner |
| TERRAINMATCH | ? | HOME lane 2: worst 78.8 mm on a road (47 creased points); the pavement budget +2 % (the joined roads) | DIRT-STRIP + TOW-LAUNCH | - | owner |
| FRAMECOST | ? | cub stand / taxi: triangles, shadow triangles, draws, texSubImage2D above the pinned budget (the L40f scenery, costs A0 named) | scenery + perf round | admit with ALLOW entries (reason + G-number), or cut | owner |
| ROUNDTRIP | ? | roll-out 1 links a program; roll-out 2 uploads; the physics worker flew 4 flights with 1 inline | perf round / Game | - | owner |

## green-1: what it holds

Eight commits on `claude/master-green`, in this order; the re-pins are their own commits.

1. Three stale source pins: GROUNDQUERY, ACCEPT, WINGSTRUCT (gate files only).
2. ENERGYBASE re-blessed (carbon, electric).
3. Six source fixes: NODUMMY, SAVE, DESIGN, STORAGE, STAGES, ASSETS' materials
   (tools/_cage_gen.js, _cowl_gen.js, _cage_design.js, src/core/71_player_bases.js, 27_premises.js).
4. Media hygiene: MEDIA, ASSETS' duplicates.
5. ENGINE re-pinned (ENGINE-DIALS A).
6. TREES, SHADOWSKY, LAKEBED re-pinned.
7. WINGROWS re-pinned.
8. WILGAGEAR: `CAGE_PYLON` one object (tools/_cage_eng.js).

Still owed before the ready: the (built) commit, the gates that read the changed files, the battery, the two lists.

## How the reds were read

- A0's three battery logs, split by gate; every gate's failing check lines compared across L40f, L40g, L40h.
- The 8 Nov sweep (`origin/claude/master-green-sweep`, flyDiy/reports/MASTER-GREEN-SWEEP-2026-11-08.md) for the reds
  that are older than 8 Nov: its bisects are quoted above as "8 Nov sweep", not re-proven.
- History deepened to 5 Oct. Bisects ran on first-parent history in a second worktree (with `media/`, a cold
  `tools/.joincache` at every step), each commit built with `node tools/build.js`.
- "?" rows are a first read of the log, not a proof: the class is filled in when the cause is found.
