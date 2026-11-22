# MASTER-GREEN: master's red gates, triaged (cloud session, started 22 Nov 2026)

Base: origin/master 9349a62c1 (train L40h), core battery 301 PASS / 61 FAIL on the box (A0's `land_L40H_gates.log`).
Branch: `claude/master-green`. Readies: `claude/ready/green-<n>`. This file is kept current: read the STATUS block first.

## FOR A0, 22 Nov 10:55 UTC - YOUR L40J CANDIDATE BATTERY

<!-- L40J-RESULT --> **PARTIAL CORE BATTERY on the L40J candidate: FAIL - 27 red (93 PASS, 27 FAIL, 0 SKIP of 364).** FAIL (27 of 120 gates run; PARTIAL: 9 of 23 chunks, 244 gates still to run): GROUNDQUERY [L40H], FLIGHTREC [L40H], FMIST [NEW], STOL [L40H], GEN [L40H], TAKEOFF [NEW], RADIALDIV [L40H], TAXICLEAR [L40H], ALTIPORT [L40H], GLIDE [L40H], UNIFY [L40H], SLOPE [L40H], TAILWHEEL [L40H], DESTTO [L40H], ROUTE [NEW], TOW [L40H], TREES [L40H], TREECRASH [L40H], DMGCERT [L40H], DMGGEAR [L40H], WILGAGEAR [L40H], SKIS [L40H], DMGCLUSTERS [L40H], DMGINST [L40H], DMGINTEGRITY [L40H], DMGSKIN [NEW], DMGUPLOAD [NEW] | NEW reds (not in master L40h's FAIL list): FMIST TAKEOFF ROUTE DMGSKIN DMGUPLOAD | L40h reds that PASS here: MONOWHEEL  (of the gates run so far)

- **15:05 UTC: THE CONTAINER RESTARTED AGAIN (about 14:55), the third time today.** The chunk then running (43 gates:
  TRAILER .. DMGCLUSTERS, 37 done) is lost and re-runs; the 72 gates already published stand. The remaining 292 gates
  now run in 20 small chunks (at most ~20 min each) so a restart costs little. Expect the end towards 19:30-20:30 UTC
  if the box holds; the log below keeps growing chunk by chunk in the meantime.
- **THE NEW REDS SO FAR, read by check (14:40 UTC; none is this box: no memory kill, no timeout, all deterministic):**
  - **TAKEOFF**: "technique c172: to 15 m 794 m in [0.6, 1.4] x 514 m (C172S POH)" - the C172's take-off to 15 m is
    1.54 x the book's.
  - **ROUTE** (shard 2, fly:metal only; the three personas pass): the metal Cessna cannot make the drawn profile - "WP1
    climbs 2.5 m/s, plan limit +2.4", "WP1 at 175 m +-15 - +160.7 m", "reversals ... da 3.1 dr 20.3 /min" (limit 12).
    TAKEOFF and ROUTE both say the candidate's Cessna climbs less than master's: look at the Cessna change in it first.
  - **FMIST**: three rows - "atmo.js: every pocket switch is a ternary whose off arm is what was there (5 sites)", "the
    stored choice compiles the veil alone", "nothing stored, no flag: ON - the veil alone". Source rows on atmo.js.
  - **DMGSKIN** (17:30 UTC): "nothing broken (a FAR 23.473 drop through the host, 0 yields): no payload, no byte, no key
    in the meta" - with nothing broken the host still sends a payload, bytes or a meta key (the row has no time budget).
    **Run alone on master L40h on this same box: GATE DMGSKIN: PASS** - so it is the candidate's, not the machine's.
  - MONOWHEEL, red on L40h, PASSES on the candidate.
- **Running here since 10:52 UTC** on origin/claude/train/L40J-candidate f80229d71: the 364 core gates / 387 jobs,
  `GATES_CORE=1`, `--no-build`, `--jobs=4`, `node --max-old-space-size=4096`. 4 CPUs / 15 GB, about 1.5x slower per core
  than the box: 6-8 h.
- **Where the log is: on THIS branch**, `flyDiy/reports/gates-2026-11/L40J_candidate_gates.log`, the FAIL list on its
  first line with NEW / L40H beside each red. It is pushed PARTIAL after each of 8 chunks of the gate table (in table
  order), so the early reds can be read before the end.
- **Not on `claude/train/L40J-cloud-battery`**: the user authorised this session to push `claude/master-green` and
  `claude/ready/green-<n>` only, and a cloud session cannot message you back to ask. If you need that branch name, have
  the user say so in this session and it is pushed at once.
- Why chunks: this container RESTARTED at 10:48 UTC. My own battery on ffe95133d died at 126 of 386 jobs and
  `run_gates` prints its verdicts only at the end: all lost. The chunks keep each part as it ends and the run resumes.

## STATUS (updated 22 Nov 10:55 UTC, block 7)

- 61 reds. **19 have a fix or a reasoned re-pin on this branch**, 5 are in hand elsewhere, 37 are for owners or still
  being traced; every one has a first read in the table.
- **green-1 is NOT a ready and has NO battery.** Its battery on ffe95133d was killed by the container's restart at
  126 of 386 jobs (no verdict kept). It is re-run after L40J lands, on the rebased branch, in chunks. Until then: every
  gate it claims passes alone or through the runner on that tree (listed under "green-1: what it holds"), and that is
  all that is proven.
- **A REAL L40h REGRESSION, live on master, fixed on this branch (0e59a24ea):** ELECTRIC-TRAINER cfe477466 added four
  garage rows (`frLeanCap`, `boomRound`, `boomRoundAt`, `finVentralLand`) with no `CAGE_DEFAULT_ABSENT` entry, so the
  save wrote them at their defaults into EVERY build the load door joins. Measured on the Cub, the Jodel and the metal
  Cessna: the certificate's fingerprint, the parked bake's, the certificate store's key and the procurement's ALL
  moved (a player's certified aeroplane no longer matches its certificate since L40h). With the four entries the keys
  are L40g's again; PARKED BENCH PROCURE CERTGATES SNAPSHOTS FLEET FREIGHT CONTRACTS STORY pass on it through the runner.
- **A second real one, for its owner (not fixed here):** node's load door and the game's page do not build the same
  Jodel (JOINPARITY 1: a 51 L tank against 50 L). It is not a stale capture: the page was re-captured here.
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
| JOINPARITY | REAL (both rows) | (1) **node is not the page for the Jodel, and it is not a stale capture**: re-captured here on the branch (headless Chromium, 781 s; reports/evidence/MASTER-GREEN/join_parity_jodel_page_2026-11-22.json) the page still builds 469.732 kg, node's load door 470.666. Page -> node: `fuel.litres` 50 -> 51, the vessel's capacity 50 -> 51, its W 0.825 -> 0.826, H 0.269 -> 0.272, six profile numbers +1..3 mm, and `tail.stabH` differs in its last digit. The tank fit lands on the other side of a litre in node; node moved inside REAL-CANON (L40d merge f1cb81f9e: 469.173 -> 470.666). (2) six tools read a validated build raw: large_hangar_shot, large_hangar_store_shot, _muddeposit_check, _qscut_check, _tutorlock_check, _unify_check | (1) FLAGSHIP (the tank fit) + JOIN-PARITY's owner (2) HOME-DERELICT, GROUND-FX, QUICKSHOT, Game, Pilot | (1) why the fit differs by millimetres between the two engines (the last-digit `stabH` says their maths differ: see DMGDETERMINISM) (2) through tools/_load_build.js, or declared at its door | owner |
| DMGDETERMINISM | REAL | the census: 44 `sin / cos / pow` sites in src/core on the builtin, not CORE_MATH (00_registry groundSink*, 07e_soil_wet, 26b_strip_micro, 28c_biomes, 29_obstacles, 29c_ski, 32_hydro, 43_pilot gTerr, 60_gen_spec, 62_gen_aero, 62c_gear_mech), in with the trains since L40a | Deform (done here: the gate's own remedy) | `node tools/_core_math_sites.js --apply`: 578 on CORE_MATH, 0 stray. Node's bits cannot move: CORE_MATH = the builtins on 2 000 000 seeded arguments each in this node | green-1 (the 734 s gate itself runs in the battery) |
| DESIGNCHECK | REAL (a side effect of a wanted change) | "200 N sideways at the post": 4.20 mm against the drawn carbon shell's 1.77 mm (2.37x; the band is 2x). HULL-B50 4ab3c819d (carbon k x0.55): its parent reads 2.83 mm (1.60x), the commit 4.20 - bisected; on master since L35c's merge of seaplanes 7d6ad8b11 | FLAGSHIP | the shell cluster carries the boom's stiffness, or its owner re-argues the band; not widened here | owner |
| FLEX | REAL | (1) the WEIGHT STUDY's `softShell` material in the matrix: "softShell cantilever" doubling 1.21x, folds 39 %, never reached cruise. (2) "tail arm: the tube factor is live" (since L31b gear-falls, 8 Nov sweep) | FLAGSHIP | (1) a soft shell is not a cantilever: the garage's rule or the matrix (2) owner | owner |
| LOAD | REAL | the same row: "GEN softShell cantilever" does not survive the ultimate load | FLAGSHIP | as FLEX (1) | owner |
| TANKMOUNT | ? | archaeopteryx x0.45: a tank that fits has vertices past a surface (2374) and 63 points inside it | FLAGSHIP | - | owner |
| ENGTORQUE | ? | "SIGN swirl": both hands swing the same way. 8 Nov sweep: L31c, TAILWHEELS 3cfc6d101 (the new tail contact dominates the swing) | Pilot / FLAGSHIP | - | owner |
| ENGCONFIG | ? (PIN likely, as POD) | 1 IDENTITY: every build's two digests differ from the pinned master's (last re-pinned 12 Nov, ENGINE-COOLING 3). The same builds' def and flown bits moved at L40a (ENGINE-COOLING), L40d (REAL-CANON) and L40g (tow-launch's rough-ground law): see POD's by-train list | FLAGSHIP | re-pin with POD | owner |
| STOL | REAL + PIN | (2) the six validated builds against master 9f77ac48f's spec and keys. REAL: the four leaked rows - fixed here, and metal / floats / twin-floats pass again. What is left is wanted: the Cub, the Jodel and the Rufus FILES were repainted (COLOUR-RESTORE; REG-PLACE on the Cub; the Rufus re-stamped by CANON-REDS 67c5372ee), and the Cub's keys moved at L40e (PROPER-COWLS' tank profile, as SKIS). (1) three cards differ from the pinned bits: motorglider and etrainer (def, fly, draw - L40h, the E811 change, wanted); spitfire (fly only) since train L40g's merge of joint-tether ebdd22542 (bisected) - Deform to say it is meant | Pilot (the gate), Deform (the spitfire), the train (the capture) | `node tools/_stol_samebits.js --root=<the landed master> --capture` once Deform confirms: the gate asks for it after every merge that moves the physics | owner |
| SKIS | REAL + PIN | 1 "absent is as today" against the 15 Nov base (L40d). REAL: the four leaked rows (metal, floats, twin: the base's bits again once fixed). PIN, each def diffed key by key: the Cub - COLOUR-RESTORE 62085a33f (14 tints), REG-PLACE 164eb1665 (3 decal numbers), two numbers of the joined tank profile since L40e's merge of carbon-cub-cowl 25b893a1f (bisected; PROPER-COWLS); the Jodel 19 tints; the Petrel 2 tints; the Carbon Cub SS its card. The sheet and the 300 flown steps of the six others are the base's to the bit | orphan | the leak fixed, then `--bless`: exactly 6 of 21 digests changed, the list in the gate's header | green-1 |
| POD | PIN (every move now named) | A "pod off = the base's bytes" (the 12 Nov re-pin), by train, all six builds alike: **L40a** def + sheet (the merge of physics-pages-cooling ca0c54e46 - bisected: ENGINE-COOLING's fields; certificate and flown steps unchanged); **L40d** def, sheet, certificate, flown steps (REAL-CANON, the physics canon); **L40e** the repainted files' def (COLOUR-RESTORE) and every certificate's `key`, nothing else in it (livery-manager-4 bb25a950d - bisected: LIVERY-MANAGER leaves the look out of the certificate store's key, on purpose); **L40g** the certificate's `taxiRough` case on the four wheeled builds (tow-launch-l40f-2 dc742075c - bisected; see ROUGHWHEEL) | Game (the pin); TOW-LAUNCH for the L40g move | `--bless` with this list, once the L40g `taxiRough` move is confirmed as meant | owner |
| GEN | REAL | "cruise is quiet in wind" (3 m/s + gusts): bank swing 11.6 deg, aileron 1.2 deg/s. It read 0.93 deg / 0.42 deg/s on 2c1644414 and 11.59 deg on a89495fec = train L31c's merge of **claude/ready/pilot1-circuit** (4 Nov; bisected with the gate's own shard, 24 Oct .. L32g), and has not moved since. The same merge as ALTIPORT's rows 2-3 (8 Nov sweep) | Pilot | - | owner |
| RADIALDIV | ? | mosquito, mosquito_1: not airborne inside 300 s (new); cub hands off 20 s, the heading moved -176 deg (8 Nov sweep: first red a0aeeeee9, G2080 ENGINE-TORQUE, 12 Oct) | Pilot | - | owner |
| TAXICLEAR | REAL (data) + ? | (1) `GP_PARKED_FOOT.archaeopteryx` is [5.5, 0.6, 5.5] (25_airfield.js:659) and the card builds a 6.50 m half-span; (11c) the C172 off the altiport: the too-short take-off is not rejected | FLAGSHIP (1), Pilot (11c) | (1) the row to the card's span | owner |
| ALTIPORT | ? | 2: the Cub's final begun under the circuit height; 3: the doctored arrival not caught; 4: the metal Cessna breaks up at tw_ski (8 Nov sweep: rows 2-3 since L31c pilot1-circuit) | Pilot | - | owner |
| GLIDE | ? | CIRCUIT archaeopteryx (motor off): landed off the field, sink 17.5 m/s, capsized | Pilot + FLAGSHIP (the card's pitch) | - | owner |
| UNIFY | ? | STRIP: the Cub off-strip at tw_ski (every person); TAIL: the C172 at tw_ski; EMERG: the student lands 1.2 m off Cannery Runway | Pilot | the 6 m roll-out (owed, A0's L40g note) | owner |
| SLOPE | ? | 1 "the free roll on ~9 % grass": a 0.461 m/s2 against the law's 0.430 (7.3 %). The gate is new with L40g and was red as it landed: red on the branch tip b74691f90 (tow-launch-l40f onto afb-0220-b3-2, i.e. on SKYLINE-RESORT's re-cut tw_ski, 280 x 6) | TOW-LAUNCH / Pilot | - | owner |
| DESTTO | ? | career:cub@w3, three rows (the Trust's arc contract). 8 Nov sweep: passes alone, fails in its shard, since L30d cert-m2 | Game | - | owner |
| TOW | ? | CIRCUIT archaeopteryx: no circuit; ALTIPORT: landed off Fishing Village Strip | Pilot + FLAGSHIP | - | owner |
| TREECRASH | ? | the load test (the certificate): at 5.7 g BROKE UP, 4 members set, nothing broken | Deform | - | owner |
| DMGCERT | ? | the float Cessna: holds at ultimate x 1.1, no BROKE AT (8 Nov sweep: G2640 13 Oct, then HYDRO-TRIM at L28a); + a second build's rows | Deform | - | owner |
| DMGGEAR | ? | touchdown headroom rows on two builds; the float nose-in / dig-in | Deform | - | owner |
| DMGCLUSTERS | ? | the FIN pulled sideways comes off by twist (8 Nov sweep: since a69f31fda, 13 Oct) | Deform | - | owner |
| DMGINST | PIN? | the speed guard trips at frame 1, not 0 (8 Nov sweep: G2640; "stale pin, probable") | Deform | - | owner |
| DMGINTEGRITY | REAL or the row's scope | 2 "the fuselage cut across behind ring 3 (10 members): no break-up" - on the SUPER PETREL only (its block: no nose engine, the interplane groups). Red since the Petrel joined the gate's builds: 063c67567 "PETREL-VALIDATED: the Super Petrel V4.1 joins the test reference set" (7 Nov; bisected inside claude/ready/seaplanes, on master with train L35c). The five older builds pass the row. Either the ten cut members do not part a pod-and-rod hull (the rod still carries the tail), or the break-up rule misses it | Deform + the hull's owner | - | owner |
| DMGDAMP | ? | angular momentum drifts in the vacuum spin, 15 rows (8 Nov sweep: since a69f31fda) | Deform | - | owner |
| DMGTYRE | ? | taxi turns tighter than the band; the Cub's crosswind roll-out 28.9 deg (8 Nov sweep: since a69f31fda) | Deform | - | owner |
| DMGFABRIC | PIN? | "damage OFF - the base's bits" on the Cub and the metal Cessna (8 Nov sweep: stale pin, probable) | Deform | - | owner |
| WILGAGEAR | REAL (a garage bug) | tools/_cage_eng.js assigned `window.CAGE_PYLON` twice (WILGA-GEAR 6a6097c49 `{caster, hug, NS}`; the cabane pylon 1f0c59fa9 `{pylonCaster, ...}`): the second replaced the first and "leg fairing root: fitted to the body" threw `CP.caster is not a function` - no gear drawn at all | orphan | one object, both sets of names (59/59) | green-1 |
| OBSTACLE | REAL | "against the wall under a third of throttle": 1.54 m/s into / off the wall. PASS on f3295a3b1, FAIL on ebdd22542 = train L40g's merge of **claude/ready/joint-tether** (both sides run here). The spitfire card's 4 s of flight (STOL 1) moved at the same merge | Deform (JOINT-TETHER) | - | owner |
| ROUGHWHEEL | REAL | A: the 0.15 m wheel does not stop at the 15 cm stone; the wheels' ordering. First red dc742075c = train L40g's merge of **claude/ready/tow-launch-l40f-2** (bisected; fc25aee4e PASS). At that same merge the certificate's `taxiRough` case moved on the wheeled builds (the Cub: members +3..+17 %, Fc[105] 320 -> 374 N): the wheel's law over rough ground changed, though the branch says "no solver change" | TOW-LAUNCH (+ Deform for the certificate) | - | owner |
| CONTACT | REAL (scenery) | Jolene strip gravel / grass: the drawn surface off terrainH (p5 -13.6 mm); 02/20's band over other pavement (25749 of 38764). PASS on L40e and on cb43a3668; first red d43397f5e = train L40f's merge of **claude/ready/afb-0220-b3-2** (bisected with the gate) | DIRT-STRIP (AFB-0220) | - | owner |
| PREMRASTER | REAL (scenery) | the raster against the analytic ground: worst 140.6 mm (w6 grade); the LRU sweep makes the stand's tile 4 times. The same first red as CONTACT: d43397f5e, train L40f's merge of **afb-0220-b3-2** (bisected with the gate) | DIRT-STRIP (AFB-0220) | - | owner |
| TERRAINMATCH | REAL | HOME lane 2: worst 78.8 mm on a road (47 creased points); the pavement budget within 3 km +2 %. Both rows PASS on fc25aee4e and are red from dc742075c = train L40g's merge of **claude/ready/tow-launch-l40f-2** (bisected with the gate; the same merge as ROUGHWHEEL) | TOW-LAUNCH | - | owner |
| FRAMECOST | ? | cub stand / taxi: triangles, shadow triangles, draws, texSubImage2D above the pinned budget (the L40f scenery, costs A0 named) | scenery + perf round | admit with ALLOW entries (reason + G-number), or cut | owner |
| ROUNDTRIP | ? | roll-out 1 links a program; roll-out 2 uploads; the physics worker flew 4 flights with 1 inline | perf round / Game | - | owner |

## green-1: what it holds

`claude/master-green` up to ffe95133d, in this order; every re-pin is its own commit.

1. e87a9505c - three stale source pins: GROUNDQUERY, ACCEPT, WINGSTRUCT (gate files only).
2. 7e123c94e - ENERGYBASE re-blessed (carbon, electric).
3. 6119e7cf1 - six source fixes: NODUMMY, SAVE, DESIGN, STORAGE, STAGES, ASSETS' materials
   (tools/_cage_gen.js, _cowl_gen.js, _cage_design.js, src/core/71_player_bases.js, 27_premises.js).
4. fa8e6d81e - media hygiene: MEDIA, ASSETS' duplicates.
5. d2d34d059 - ENGINE re-pinned (ENGINE-DIALS A).
6. 99c6a8a45 - TREES, SHADOWSKY, LAKEBED re-pinned.
7. f54913289 - WINGROWS re-pinned.
8. 857009b7b - WILGAGEAR: `CAGE_PYLON` one object (tools/_cage_eng.js).
9. 0e59a24ea - the four ELECTRIC-TRAINER rows absent at their defaults (tools/_cage_gen.js).
10. 1c110cd6a - the core's 44 stray sin / cos / pow sites on CORE_MATH (11 files of src/core).
11. 07e3a96db - SKIS' witnesses re-blessed.
12. ffe95133d - (built).

Run alone here on that tree, PASS: GROUNDQUERY WINGSTRUCT NODUMMY MEDIA SAVE ENERGYBASE ENGINE TREES SHADOWSKY LAKEBED
WINGROWS SKIS; through the runner, PASS: ACCEPT WILGAGEAR STAGES STORAGE DESIGN ASSETS (and the 20 fingerprint / pack
gates named in STATUS). DMGDETERMINISM's census reads 0 stray; the gate runs in the battery.

## How the reds were read

- A0's three battery logs, split by gate; every gate's failing check lines compared across L40f, L40g, L40h.
- The 8 Nov sweep (`origin/claude/master-green-sweep`, flyDiy/reports/MASTER-GREEN-SWEEP-2026-11-08.md) for the reds
  that are older than 8 Nov: its bisects are quoted above as "8 Nov sweep", not re-proven.
- History deepened to 5 Oct. Bisects ran on first-parent history in a second worktree (with `media/`, a cold
  `tools/.joincache` at every step), each commit built with `node tools/build.js`.
- "?" rows are a first read of the log, not a proof: the class is filled in when the cause is found.
