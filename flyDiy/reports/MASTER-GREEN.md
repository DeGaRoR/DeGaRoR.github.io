# MASTER-GREEN: master's red gates, triaged (cloud session, started 22 Nov 2026)

Base: origin/master 9349a62c1 (train L40h), core battery 301 PASS / 61 FAIL on the box (A0's `land_L40H_gates.log`).
**Since 23 Nov 05:13 UTC master is train L40J 089297693: green-1 is rebuilt on it (STATUS below).**
Branch: `claude/master-green`. Readies: `claude/ready/green-<n>`. This file is kept current: read the STATUS block first.

## FOR A0, 22 Nov 10:55 UTC - YOUR L40J CANDIDATE BATTERY

<!-- L40J-RESULT --> **CORE BATTERY on the L40J candidate: FAIL - 91 red (273 PASS, 91 FAIL, 0 SKIP of 364).** FAIL (91 of 364 gates run; COMPLETE): GROUNDQUERY [L40H], FLIGHTREC [L40H], FMIST [NEW], STOL [L40H], GEN [L40H], TAKEOFF [NEW], RADIALDIV [L40H], TAXICLEAR [L40H], ALTIPORT [L40H], GLIDE [L40H], UNIFY [L40H], SLOPE [L40H], TAILWHEEL [L40H], DESTTO [L40H], ROUTE [NEW], TOW [L40H], TREES [L40H], TREECRASH [L40H], DMGCERT [L40H], DMGGEAR [L40H], WILGAGEAR [L40H], SKIS [L40H], DMGCLUSTERS [L40H], DMGINST [L40H], DMGINTEGRITY [L40H], DMGSKIN [NEW], DMGUPLOAD [NEW], DMGSETTLE [NEW], DMGDRIVE [NEW], DMGWRECK [NEW], DMGWALL [NEW], DMGLOOK [NEW], DMGDAMP [L40H], DMGTYRE [L40H], DMGFABRIC [L40H], DMGSCAR [NEW], DMGDETERMINISM [L40H], DMGSCUFF [NEW], FRAMECOST [L40H], ROUNDTRIP [L40H], CONTACT [L40H], TERRAINMATCH [L40H], SHADOWSKY [L40H], RWYLIGHTS [L40H], LAKEBED [L40H], MEDIA [L40H], ASSETS [L40H], LIVERYSET [NEW], FRAMES [NEW], COMMITHYGIENE [NEW], FIN [NEW], GEOPARITY [NEW], WINGROWS [L40H], DESIGNCHECK [L40H], JOINPARITY [L40H], ENGINE [L40H], SAVE [L40H], BENCHTIME [NEW], PARTS [L40H], DESIGN [L40H], SCENERYED [NEW], PREMRASTER [L40H], PARKED [NEW], OBSTACLE [L40H], HITBOX [NEW], SNOWMUDFX [NEW], ROUGHWHEEL [L40H], WATERDAMP [NEW], WINGSTRUCT [L40H], STORAGE [L40H], ACCEPT [L40H], POD [L40H], CONTRACTS [NEW], MISSIONS [NEW], STAGES [L40H], CANDIDATES [L40H], NAMES [L40H], FREIGHT [NEW], NODUMMY [L40H], ENERGYBASE [L40H], TANKMOUNT [L40H], ENGTORQUE [L40H], DASH [NEW], GPSFACE [NEW], BIOME [NEW], SETTLE [NEW], FLEX [L40H], LOAD [L40H], ENGCONFIG [L40H], AUDIOENG [NEW], LAZY [NEW] | NEW reds (not in master L40h's FAIL list): FMIST TAKEOFF ROUTE DMGSKIN DMGUPLOAD DMGSETTLE DMGDRIVE DMGWRECK DMGWALL DMGLOOK DMGSCAR DMGSCUFF LIVERYSET FRAMES COMMITHYGIENE FIN GEOPARITY BENCHTIME SCENERYED PARKED HITBOX SNOWMUDFX WATERDAMP CONTRACTS MISSIONS FREIGHT DASH GPSFACE BIOME SETTLE AUDIOENG LAZY | L40h reds that PASS here: MONOWHEEL GFX

- **15:05 UTC: THE CONTAINER RESTARTED AGAIN (about 14:55), the third time today.** The chunk then running (43 gates:
  TRAILER .. DMGCLUSTERS, 37 done) is lost and re-runs; the 72 gates already published stand. The remaining 292 gates
  now run in 20 small chunks (at most ~20 min each) so a restart costs little. Expect the end towards 19:30-20:30 UTC
  if the box holds; the log below keeps growing chunk by chunk in the meantime.
- **19:10 UTC - THE CESSNA REDS COME FROM `one-cessna-4`, PROVEN ON ONE OF THEM.** GATE TAKEOFF run alone here on both
  sides of the candidate's merge f3fffc8c1 (train L40J: merge origin/claude/ready/one-cessna-4): **PASS on its first
  parent 9eee1de09, FAIL on the merge**, with the candidate's own row and number ("technique c172: to 15 m 794 m in
  [0.6, 1.4] x 514 m"). ROUTE (fly:metal), DMGSETTLE (metal trunk-0), DMGWALL (metal, four rows) and probably DMGDRIVE
  (the propeller at VD: 3262 rpm against 2450, tip Mach 1.02) are on the same aeroplane and were not bisected: dropping
  that one ref from the train should clear most of the NEW list.
- More NEW reds since 18:25, all in the damage family (read from the log, not yet re-run on master here): **DMGDRIVE**
  (three rows on the prop's rpm: VD full, VNE cruise, the 4.36 g pull), **DMGWRECK** ("a trunk at 30 m/s strikes the prop
  on the trunk, drawn"; "nothing broken ...: no payload, no release, no strike"), **DMGWALL** (metal: "places past 8
  slots" on four cases), **DMGLOOK** (metal trunk-0, "c. the plan ... worst plan 2.00 ms": a per-event time, which the
  8 Nov cloud sweep already read as this box's speed - treat DMGLOOK as TIME, not as a red).
- **22:35 UTC - THE BATTERY IS COMPLETE: 273 PASS, 91 FAIL, 0 SKIP of 364.** 32 names are not in L40h's FAIL list;
  MONOWHEEL and GFX, red on L40h, pass. The log's first lines sort the 32:
  - **24 are the candidate's.** Proven by the same gate passing alone on master L40h on this box: DMGSKIN DMGSETTLE
    DMGUPLOAD (22:52 UTC) HITBOX CONTRACTS MISSIONS FREIGHT; proven inside the candidate's history: TAKEOFF (green on 9eee1de09, red on the
    merge of one-cessna-4). By their rows: the Cessna - ROUTE DMGWALL DMGDRIVE WATERDAMP LIVERYSET FIN GEOPARITY FRAMES
    DASH GPSFACE AUDIOENG PARKED; "nothing broken records nothing" - DMGWRECK DMGSCAR DMGSCUFF DMGUPLOAD; FMIST.
  - **1 is the candidate commit's packaging:** COMMITHYGIENE.
  - **7 are this box, not reds:** SNOWMUDFX and LAZY fail on master L40h here too; BENCHTIME, SCENERYED 20b, BIOME, SETTLE
    and DMGLOOK's plan row are millisecond budgets.
  - **3 hit the runner's 1800 s limit on this slower machine** (TOW, TREECRASH, DMGGEAR) and were then run directly on
    the candidate with no limit (23:55 UTC; outputs beside the log as `L40J_candidate_<GATE>_direct.log`): **TOW** and
    **DMGGEAR** fail on exactly master L40h's rows, nothing new. **TREECRASH** fails on L40h's row AND on two new ones,
    "metal/trunk0 against the reference ... MOVED" and "metal/trunk25 against the reference ... MOVED": the Cessna again.
- **21:35 UTC - seven more NEW names (266 of 364 gates in), sorted:**
  - `one-cessna-4` again: **LIVERYSET** dies on `ENOENT ... bugReports/cessnaMetal (1).json` (the candidate deletes
    that file and the gate still opens it); **FIN** "§10: cessna fin sheet folds over itself (5 faces)"; **GEOPARITY**
    "cessna: ... fin mean dx +0.056; fin worst dx +0.188"; **FRAMES** IDENTITY moved on builds/cessna172r_2026-11-08.json
    (tailCap.band) - and on builds/chinook_2026-09-21_corrected.json (pilPaxA.band: `chinook-user`).
  - the candidate commit itself: **COMMITHYGIENE** "built file(s) in source commit f80229d71 'train L40J CANDIDATE
    (built + premises cook)'" - the packaging of the candidate, gone when the train lands with its own (built) commit.
  - THIS BOX'S SPEED, not reds: **BENCHTIME** (the bench check 7.0 s / 8.7 s against 6 s) and **SCENERYED** row 20b
    (3251 ms against 2500 ms); both were already read as time budgets of a cloud CPU in the 8 Nov sweep.
- **20:05 UTC - A SECOND GROUP IN THE NEW LIST, NOT THE CESSNA: "nothing broken" is no longer nothing.** Five damage
  gates fail on the same kind of row - with no break, the candidate records or sends something master does not:
  DMGSKIN ("nothing broken ...: no payload, no byte, no key in the meta"), DMGWRECK ("nothing broken (a FAR 23.473 drop,
  0 yields): no payload, no release, no strike"), DMGSCUFF ("intact: no payload, no record, nothing drawn"; and the
  wing-low slide scrapes the HIGH wing: 128 vertices, 92 beyond 1.32 m right), DMGSCAR (four rows "only the wheels
  touch - nothing recorded, no scar"), and probably DMGUPLOAD. Look for one change to what a wheel-only ground contact
  records (the scuff / scar path), not five causes. DMGSKIN passes on master L40h on this box, so the group is the
  candidate's.
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
  - **DMGSETTLE** (18:25 UTC): "metal trunk-0: every detached piece's covering ON the ground, not over it (-40.3 cm;
    within +2 / -25)". **Run alone on master L40h on this same box: GATE DMGSETTLE: PASS** - the candidate's. It is the
    metal Cessna again (with TAKEOFF and ROUTE: three reds on that aeroplane).
  - **DMGUPLOAD** (18:25 UTC; the page in node): on the metal Cessna and the Cub, "the flown bake was not the test's fake
    (FB.last.hit null)", "no hybrid fold was made", "no drawn fold buffer checked", and the page logs "THREE.BufferGeometry
    .computeBoundingBox(): GLBufferAttribute requires a manual bounding box". NOT yet run on master here (it needs ~6 GB:
    after the battery); until then read it as candidate OR this box.
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

## STATUS (updated 23 Nov 17:05 UTC, block 11)

- **Train L40K landed (56047b34e, ~16:00). Everything moved onto it as ONE branch, green-4** (local; 21 commits + its
  (built) 3ef7ab3d1): green-1, green-2 and green-3's fixes cherry-picked one by one. Three were already on L40K and are
  dropped (WILGAGEAR's CAGE_PYLON, PARTS' cowl rows - 8d56cac43, SKIS' witness paths - LS4-ARCH); DESIGN's roadster
  line too. Re-checked on L40K: 25 of the fixed gates PASS through the runner; WINGROWS' re-pin REVERTED (L40K's
  2b3267ee7 put the tip floor back at 0.45, so master's own pins hold); ACCEPT admits the LS4's hudBrakeWater();
  SKIS re-blessed with both its moves named (the seven leaked rows; the Jodel's sheet, below).
- **Its core battery runs since 16:59 UTC** (369 gates, 33 chunks). `claude/ready/green-4` is pushed when it ends - the
  one ready for all of this. green-2's L40J battery was stopped at 10 of 32 chunks when L40K landed (no red in neither
  list); its partial log is kept.
- **JOINPARITY row 1 looks CLOSED BY L40K**: node's load door builds the Jodel at 469.732 kg - the page's figure - since
  L40K's merge of ls4-arch-2 (2b2a52772, bisected through SKIS' Jodel digest). The battery will say.
- L40K also closed: FLIGHTREC (perf-trace-6), PARTS (canClear + the cowl rows), TAXICLEAR row 1 (6.5 m), WINGROWS.
- LOAD's glass red bisected: green on HULL-B50's parent (111 % of yield), red on HULL-B50 4ab3c819d (149 %) - the user's
  composite recalibration (glass x0.75), for FLAGSHIP / the user.
- A lesson for this box: the container is reclaimed ~6 min after a turn ends, batteries or not (13:41 today).

- green-2's battery: chunks 00-04 done (FLIGHTREC, STOL, TAKEOFF red - all named); ~9 h to go if the box holds.
- green-3 (local, on green-2) adds: DESTTO (a setup older than CERT-GATES - fixed with the rule asserted), and the soft
  shell's rows in LOAD and FLEX asserting its designed fold. Both gates keep one other red each (glass cantilever; the
  tail arm's truss). green-3 goes in a second ready after green-2's.
- GEN turned green with L40J itself (the pilot-takeoff-yaw cherry-picks): 0.95 deg on master L40J, 11.61 on the candidate.
- New readings for owners: the spitfire card snaps a tail wire at rest (STOL's last unnamed move); TERRAINMATCH's
  lane 2 is the pavement lattice over a kinked junction ease; DESIGNCHECK's shell calibration; FLEX's stiff truss.

- **Refocused on master's reds (the user, 23 Nov ~11:30).** green-2 = green-1 + five more: PARTS (CESSNA-REFIT's cowl rows
  claimed), CANDIDATES (the cars' vehicles list; jodel_geo's hidden row), NAMES ("Alaska" -> "North Coast"), and a
  SOLVER fix that turns ROUGHWHEEL and SLOPE green (the rough-ground cam against TOW-LAUNCH's ground normal: details in
  the rows). Its core battery started 11:51 UTC on 72cad25a3 (green-1's battery stopped at chunk 4: superseded).
  `claude/ready/green-2` is pushed when that battery ends (it holds green-1's fixes too: one ready, not two).
- In hand elsewhere, so not duplicated: canClear and TAXICLEAR (1) on claude/ready/ls4-arch-2; FLIGHTREC in L40K.

- **Master moved to train L40J (089297693). green-1 now sits on it** (local branch `green-1`, 16 commits on L40J, tip
  d8e0bd667 = its (built) commit; list under "green-1: what it holds"). Every fix was carried over one by one and each
  claimed gate re-run there: GROUNDQUERY ACCEPT WINGSTRUCT NODUMMY SAVE DESIGN STORAGE STAGES MEDIA ASSETS ENERGYBASE
  ENGINE TREES SHADOWSKY LAKEBED WINGROWS WILGAGEAR SKIS MICRO GAMEPREM: all PASS on the L40J tree; the core-math
  census reads 0 stray.
- **Its core battery on L40J is RUNNING here since 10:42 UTC** (364 gates, 32 resumable chunks, then TOW TREECRASH
  DMGGEAR ROOMMERGE PARKED alone, then every red not in L40h's list once more alone). On this box that is 8 to 10 hours
  if the container holds. `claude/ready/green-1` is pushed when it ends, with both FAIL lists in its message. Not before.
- **A SECOND LEAK, new with L40J, fixed on green-1 (b001d778e):** CESSNA-REFIT 5a34dcfca added three cowl rows
  (`cw_keelLevel`, `cw_deckLevel`, `cw_deckFall`) with no `CAGE_DEFAULT_ABSENT` entry; the save writes them at 0 into
  EVERY build the load door joins and the certificate's fingerprint, the parked bake's key, the certificate store's key
  and the procurement's key all move again (measured on the Cub, the Jodel, the float Cessna on L40J). Same class as
  ELECTRIC-TRAINER's four rows at L40h. With the three entries the keys stop moving. **Until green-1 lands, a player's
  certified aeroplane does not match its certificate on L40J either.**
- **The L40h-based battery of green-1 (f40d977b9) finished its 31 chunks before master moved**: 360 of 363 gates with a
  verdict, 311 PASS / 49 FAIL. TURNED GREEN against L40h's list (18): GROUNDQUERY TREES WILGAGEAR SKIS SHADOWSKY LAKEBED
  MEDIA ASSETS WINGROWS ENGINE SAVE DESIGN WINGSTRUCT STORAGE ACCEPT STAGES NODUMMY ENERGYBASE. Red there and not in
  L40h's list (9): MICRO and GAMEPREM (caused by green-1's own fixes; re-pinned with reasons in 4ae4919a7, both PASS);
  DMGLOOK, BENCHTIME, SCENERYED row 20b (millisecond budgets on a slower box), LAZY (red on master L40h here too),
  HITBOX (a time-comparison row; PASS alone on the same tree); ROOMMERGE and PARKED (killed by the box's memory with
  four page gates at once; they run alone in the L40J battery). TOW alone: FAIL on L40h's two rows only (CIRCUIT
  archaeopteryx, ALTIPORT). That battery is superseded by the L40J one and is not a ready.
- **DMGDETERMINISM: the census is fixed (0 stray), the gate still fails where a browser exists.** Its section 4 (page
  against node) runs only with Chromium present, so it never ran on A0's logs. Here it fails the same on the L40J
  candidate and on green-1: the core's `tan / atan / atan2 / asin / acos / exp / log / cbrt / tanh` give different last
  bits in Chromium 157 and in node 22 (sin / cos / pow are CORE_MATH and agree). For Deform: either those nine join
  CORE_MATH or the row is scoped to one engine pair. Not re-pinned, not weakened.
- 61 L40h reds: **19 fixed or re-pinned** (the 18 above + DMGDETERMINISM's census), 5 in hand elsewhere (A0's L40J
  note: GFX and MONOWHEEL are green on L40J), 37 for owners. L40J adds its own named reds (A0's handover, "NAMED, NOT
  HELD"): they are FLAGSHIP's and Pilot's and are not triaged again here.
- A real node-against-page difference stays open for its owner: JOINPARITY 1 (the Jodel's tank, 51 L against 50 L).
- Nothing here weakens a gate. Every re-pin names the change that moved the pin and is its own commit.

### What A0 can relay now

| to | what |
|---|---|
| AIRCRAFT-LOOKS (livery) | NAMES: a livery mark is shown as "Alaska" (a real name by the user's table) and the row hint says "the twelve Alaska marks". |
| FLAGSHIP | **the four ELECTRIC-TRAINER rows written at their defaults (above)**; DESIGNCHECK (the carbon boom reads 2.4x softer than its drawn shell since HULL-B50's k x0.55); CANDIDATES (jodel_geo, superpetrel_V4_1 have no index row); FLEX + LOAD (the softShell cantilever folds); the Archaeopteryx card (TANKMOUNT's tank at x0.45; `GP_PARKED_FOOT.archaeopteryx` half 5.5 m against a 6.50 m half-span, TAXICLEAR 1); the E811 rows already named (MONOWHEEL, TAILWHEEL). |
| TOW-LAUNCH | CANDIDATES (buggy, roadster have no index row); TERRAINMATCH's pavement budget (+2 %, the joined roads). |
| SKYLINE-RESORT | RWYLIGHTS: the footpath `tw_p_launch` runs along tw_ski's light line, 7 of 24 lights left out. |
| FLAGSHIP (L40J) | **CESSNA-REFIT's three cowl rows written at 0 into every build (STATUS; fixed on green-1 b001d778e)**; PARTS on L40J names them too: `cw_keelLevel cw_deckLevel cw_deckFall` are rendered and claimed by no part (with `canClear`: 1588 vs 1592). CANDIDATES on L40J: three files without an index row (buggy, jodel_geo, roadster). |
| Deform | DMGDETERMINISM: the 44 builtin sites are fixed on green-1; **its page-against-node section fails wherever Chromium exists** (nine more functions differ in the last bits: STATUS). Plus the older DMG rows below. |
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
| PARTS | REAL | `canClear` is rendered and claimed by no part (1566 vs 1567) | FLAGSHIP | on L40J the three CESSNA-REFIT cowl rows are unclaimed too: claimed by the cowl's part on green-2 (7c6f843a1). `canClear` is claimed on claude/ready/ls4-arch-2 | green-2 (the cowl rows); in hand ls4-arch-2 (canClear) |
| GFX | REAL | perf_bench.js reads the device outside welcome.js | Game | claude/ready/perfbench-gfx | in hand (on origin) |
| FLIGHTREC | PIN | the rows regex app.js's hold line; NEW-PLANE widened it (8 Nov sweep) + a third row (worldPrelinkGfx) | A0 | claude/ready/perf-trace-6, merged in the L40K candidate (the hold line widened by uiHold / NEW_PLANE / FLEET_SCREEN; settleScreen's done wrapped in loopDone) | in hand (L40K) |
| NAMES | REAL | LIVERY-5 fb442d878: a mark named "Alaska" (aeroskin.js:3125, livery_marks.js:29) and the hint "the twelve Alaska marks" (_cage_ui.js:5622) are shown | AIRCRAFT-LOOKS | green-2 f344e8819: shown name "North Coast" (as the 'alaska' theme, G3240), the id stays; livery_marks.js regenerated from the SVG title | green-2 (PASS) |
| CANDIDATES | REAL (data) | four files in builds/candidates/ with no index row: jodel_geo, superpetrel_V4_1 (since REAL-CANON 2f90acd8c, 12 Nov), buggy, roadster (TOW-LAUNCH) | FLAGSHIP + TOW-LAUNCH | green-2 1e946f0fe: the cars are reached through builds/lists/vehicles.json (FLAGSHIP's choice b, 12 Nov) - the gate follows it, as strictly (4 new self-test breaks); jodel_geo gets its hidden "next" row like cub_chord160 | green-2 (PASS) |
| RWYLIGHTS | REAL (scenery) | tw_ski (280 x 6) keeps 17 of 24: the dirt footpath `tw_p_launch` along the edge (6 left out, 2 flush) and the pad `tw_m_launch` (1); in with AFB-0220-B3's merge of skyline-resort-2 c5f99c8b3 | SKYLINE-RESORT | move the path off the light line, or declare 17 as w4 / w5 are declared | owner |
| JOINPARITY | REAL (both rows) | (1) node 470.666 kg (also on green-2), the page 469.732: the tank fit across a litre (50 / 51 L), profile numbers +1..3 mm, stabH's last digit; node moved inside REAL-CANON's merge f1cb81f9e (469.173 -> 470.666: _cage_gen / _cage_join changed there), the page did not. (2) six tools read a validated build raw | (1) FLAGSHIP (the tank fit) + JOIN-PARITY's owner (2) HOME-DERELICT, GROUND-FX, QUICKSHOT, Game, Pilot | (1) why the fit differs by millimetres between the two engines (the last-digit `stabH` says their maths differ: see DMGDETERMINISM) (2) through tools/_load_build.js, or declared at its door | owner |
| DMGDETERMINISM | REAL | the census: 44 `sin / cos / pow` sites in src/core on the builtin, not CORE_MATH (00_registry groundSink*, 07e_soil_wet, 26b_strip_micro, 28c_biomes, 29_obstacles, 29c_ski, 32_hydro, 43_pilot gTerr, 60_gen_spec, 62_gen_aero, 62c_gear_mech), in with the trains since L40a | Deform (done here: the gate's own remedy) | `node tools/_core_math_sites.js --apply`: 578 on CORE_MATH, 0 stray. Node's bits cannot move: CORE_MATH = the builtins on 2 000 000 seeded arguments each in this node | green-1 for the census (0 stray, also on L40J). **The gate itself stays red on a box with Chromium: section 4, page against node, nine more functions - Deform (STATUS)** |
| DESIGNCHECK | REAL (a side effect of a wanted change) | "200 N sideways at the post": 4.20 mm against the drawn carbon shell's 1.77. HULL-B50 4ab3c819d cut the carbon lattice k x0.55; the shell cluster's hold comes from G314's calibration pair (kRef 29182, mRef 61.6, wRef 300) measured on the old lattice, and lattice and cluster do not add as springs (lattice alone 37.9 mm) | FLAGSHIP | re-calibrate the shell cluster on the recalibrated lattice (not the band) | owner |
| FLEX | PIN (soft shell) + REAL (tail arm) | (1) the soft shell never reached cruise and its cantilever folds 39 % - its design; (2) "tail arm: the tube factor is live": the twin boom as a plain truss (no tube, K 1) reads rise 0.09 % / roll 0.14 deg against the tube's 0.05 / 0.09 - not 3x softer: the truss itself got stiff (since L31b, 8 Nov sweep) | FLAGSHIP | (1) green-3 4e291ec3c: two results assert the fold (2) owner | green-3 (1); owner (2) |
| LOAD | PIN (soft shell) + REAL (glass) | (1) the soft shell's cantilever DID NOT SURVIVE - its design (the user 12 Nov: "it should crumble"; GATE ULTRALIGHT); (2) GEN glass cantilever 148 % of yield, DID NOT SURVIVE - on L40h too, missed in the first read; HULL-B50's glass x0.75 likely (attribution running) | FLAGSHIP (2) | (1) green-3 4e291ec3c: the case asserts it folds (2) owner | green-3 (1); owner (2) |
| TANKMOUNT | ? | archaeopteryx x0.45: a tank that fits has vertices past a surface (2374) and 63 points inside it | FLAGSHIP | - | owner |
| ENGTORQUE | ? | "SIGN swirl": both hands swing the same way. 8 Nov sweep: L31c, TAILWHEELS 3cfc6d101 (the new tail contact dominates the swing) | Pilot / FLAGSHIP | - | owner |
| ENGCONFIG | ? (PIN likely, as POD) | 1 IDENTITY: every build's two digests differ from the pinned master's (last re-pinned 12 Nov, ENGINE-COOLING 3). The same builds' def and flown bits moved at L40a (ENGINE-COOLING), L40d (REAL-CANON) and L40g (tow-launch's rough-ground law): see POD's by-train list | FLAGSHIP | re-pin with POD | owner |
| STOL | REAL + PIN | green-2's battery: 5 rows (L40h 7). Floats and twin floats PASS; the Jodel's and the Rufus's keys steady; what moves is named: the Cub (PROPER-COWLS' tank, L40e), the 172 (the refit's new card), motorglider / etrainer (E811), and the SPITFIRE's 4 s: its card snaps a tail bracing wire at t = 0.017 s standing still (beam 337, HTL -> TPB, tubeFabric, a fitting in tension) and kinks two members - joint-tether's tethers then move its bits. The card's rigging, not the damage model | FLAGSHIP (the spitfire card), the train (the capture) | `node tools/_stol_samebits.js --root=<the landed master> --capture` once Deform confirms: the gate asks for it after every merge that moves the physics | owner |
| SKIS | REAL + PIN | 1 "absent is as today" against the 15 Nov base (L40d). REAL: the four leaked rows (metal, floats, twin: the base's bits again once fixed). PIN, each def diffed key by key: the Cub - COLOUR-RESTORE 62085a33f (14 tints), REG-PLACE 164eb1665 (3 decal numbers), two numbers of the joined tank profile since L40e's merge of carbon-cub-cowl 25b893a1f (bisected; PROPER-COWLS); the Jodel 19 tints; the Petrel 2 tints; the Carbon Cub SS its card. The sheet and the 300 flown steps of the six others are the base's to the bit | orphan | the leak fixed, then `--bless`: exactly 6 of 21 digests changed, the list in the gate's header. **On L40J (20a06971e): two witnesses read from tools/fixtures/test_copies/ (moved by ONE-CESSNA, the same blobs) and five sheets more re-blessed for FLAPLESS-SAID ed4d8ddbd's `landing` key (the only difference, diffed tree against tree); CESSNA-REFIT's three leaked cowl rows fixed first** | green-1 (PASS on L40J) |
| POD | PIN (every move now named) | A "pod off = the base's bytes" (the 12 Nov re-pin), by train, all six builds alike: **L40a** def + sheet (the merge of physics-pages-cooling ca0c54e46 - bisected: ENGINE-COOLING's fields; certificate and flown steps unchanged); **L40d** def, sheet, certificate, flown steps (REAL-CANON, the physics canon); **L40e** the repainted files' def (COLOUR-RESTORE) and every certificate's `key`, nothing else in it (livery-manager-4 bb25a950d - bisected: LIVERY-MANAGER leaves the look out of the certificate store's key, on purpose); **L40g** the certificate's `taxiRough` case on the four wheeled builds (tow-launch-l40f-2 dc742075c - bisected; see ROUGHWHEEL) | Game (the pin); TOW-LAUNCH for the L40g move | `--bless` with this list, once the L40g `taxiRough` move is confirmed as meant | owner |
| GEN | FIXED BY L40J | "cruise is quiet in wind": 11.61 deg on L40f/g/h and on the L40J candidate f80229d71; 0.95 deg on master L40J 089297693 - the same shard 1/4, here, both. Between the two: the pilot-takeoff-yaw cherry-picks d83064264 / 98d28fe57 (the take-off, so the circuit after it) | Pilot | - | green on L40J (GEN PASS in green-2's battery) |
| RADIALDIV | ? | mosquito, mosquito_1: not airborne inside 300 s (new); cub hands off 20 s, the heading moved -176 deg (8 Nov sweep: first red a0aeeeee9, G2080 ENGINE-TORQUE, 12 Oct) | Pilot | - | owner |
| TAXICLEAR | REAL (data) + ? | (1) `GP_PARKED_FOOT.archaeopteryx` is [5.5, 0.6, 5.5] (25_airfield.js:659) and the card builds a 6.50 m half-span; (11c) the C172 off the altiport: the too-short take-off is not rejected | FLAGSHIP (1), Pilot (11c) | (1) fixed on claude/ready/ls4-arch-2 (archaeopteryx [6.5, 0.6, 5.5]); (11c) Pilot | in hand ls4-arch-2 (1); owner (11c) |
| ALTIPORT | ? | 2: the Cub's final begun under the circuit height; 3: the doctored arrival not caught; 4: the metal Cessna breaks up at tw_ski (8 Nov sweep: rows 2-3 since L31c pilot1-circuit) | Pilot | - | owner |
| GLIDE | ? | CIRCUIT archaeopteryx (motor off): landed off the field, sink 17.5 m/s, capsized | Pilot + FLAGSHIP (the card's pitch) | - | owner |
| UNIFY | ? | STRIP: the Cub off-strip at tw_ski (every person); TAIL: the C172 at tw_ski; EMERG: the student lands 1.2 m off Cannery Runway | Pilot | the 6 m roll-out (owed, A0's L40g note) | owner |
| SLOPE | ? | 1 "the free roll on ~9 % grass": a 0.461 m/s2 against the law's 0.430 (7.3 %). The gate is new with L40g and was red as it landed: red on the branch tip b74691f90 (tow-launch-l40f onto afb-0220-b3-2, i.e. on SKYLINE-RESORT's re-cut tw_ski, 280 x 6) | TOW-LAUNCH / Pilot | the same solver fix as ROUGHWHEEL: the cam's mean sits ~g^2 R/2 above a slope's line, skewing the grade ~4 %. Row 1: 0.461 -> 0.421 against the law's 0.427 (-1.4 %); holds unchanged | green-2 (PASS) |
| DESTTO | PIN (a setup older than a rule) | not flaky: fails alone too (shard 0/3). A fresh dev career's Cub has no airframe row, so CERT-GATES (the user 3 Nov) refuses the Trust's paid arc contract: "needs a commercial certificate ... run the bench". The game is right | Game | green-3 12f735648: the row first asserts the refusal, then flies a maker's airframe (factory, unmodified: both certificates) | green-3 (PASS) |
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
| ROUGHWHEEL | REAL | A: the 0.15 m wheel does not stop at the 15 cm stone; the wheels' ordering. First red dc742075c = train L40g's merge of **claude/ready/tow-launch-l40f-2** (bisected; fc25aee4e PASS). At that same merge the certificate's `taxiRough` case moved on the wheeled builds (the Cub: members +3..+17 %, Fc[105] 320 -> 374 N): the wheel's law over rough ground changed, though the branch says "no solver change" | TOW-LAUNCH (+ Deform for the certificate) | green-2 702db5f5f (src/core/30_solver.js): on the cam the slope's normal read the cams' mean gy against raw terrainH (a false slope at every stone) and the tangent branch dropped the stone's push. Fixed both; self-test row C re-pinned with its reason (b9eb95b87) | green-2 (PASS) |
| CONTACT | REAL (scenery) | Jolene strip gravel / grass: the drawn surface off terrainH (p5 -13.6 mm); 02/20's band over other pavement (25749 of 38764). PASS on L40e and on cb43a3668; first red d43397f5e = train L40f's merge of **claude/ready/afb-0220-b3-2** (bisected with the gate) | DIRT-STRIP (AFB-0220) | - | owner |
| PREMRASTER | REAL (scenery) | the raster against the analytic ground: worst 140.6 mm (w6 grade); the LRU sweep makes the stand's tile 4 times. The same first red as CONTACT: d43397f5e, train L40f's merge of **afb-0220-b3-2** (bisected with the gate) | DIRT-STRIP (AFB-0220) | - | owner |
| TERRAINMATCH | REAL | HOME lane 2 on green-2 = L40h to the digit: cause "pavement lattice" (terrain_match.js), 168 points, worst 78.8 mm at (52.5, 671.5) on a road - the mesh between its vertices misses the road's height; likely TOW-LAUNCH's stretched junction ease, an even ramp that kinks at both ends (27_premises, 12 Nov). The budget +2 %: TOW-LAUNCH's 57 joined roads (wanted) | TOW-LAUNCH | smooth the stretched ease or refine the lattice there, then re-cook; the budget re-pinned for the joined roads with that | owner |
| FRAMECOST | ? | cub stand / taxi: triangles, shadow triangles, draws, texSubImage2D above the pinned budget (the L40f scenery, costs A0 named) | scenery + perf round | admit with ALLOW entries (reason + G-number), or cut | owner |
| ROUNDTRIP | ? | roll-out 1 links a program; roll-out 2 uploads; the physics worker flew 4 flights with 1 inline | perf round / Game | - | owner |

## green-1: what it holds

**On L40J** (local branch `green-1` on 089297693; pushed as `claude/ready/green-1` when its battery ends). Every re-pin
is its own commit; each line names the L40h-based commit on `claude/master-green` it was carried from.

1. 420b69a3a (from e87a9505c) - three stale source pins: GROUNDQUERY, ACCEPT, WINGSTRUCT (gate files only).
2. 87790cdb8 (7e123c94e) - ENERGYBASE re-blessed (carbon, electric).
3. 63aa2f200 (6119e7cf1) - six source fixes: NODUMMY, SAVE, DESIGN, STORAGE, STAGES, ASSETS' materials
   (tools/_cage_gen.js, _cowl_gen.js, _cage_design.js, src/core/71_player_bases.js, 27_premises.js).
4. fcc258b99 (fa8e6d81e) - media hygiene: MEDIA, ASSETS' duplicates.
5. fe6fde4c6 (d2d34d059) - ENGINE re-pinned (ENGINE-DIALS A).
6. 69b1843b4 (99c6a8a45) - TREES, SHADOWSKY, LAKEBED re-pinned.
7. fecda6f8b (f54913289) - WINGROWS re-pinned.
8. 85200319b (857009b7b) - WILGAGEAR: `CAGE_PYLON` one object (tools/_cage_eng.js).
9. f1bd7febc (0e59a24ea) - the four ELECTRIC-TRAINER rows absent at their defaults (tools/_cage_gen.js).
10. 5c759ed3b (81c257995) - the cowl's two library materials never throw on a page without matlib.js.
11. cb8432b9e (1c110cd6a, re-applied on L40J) - the core's 44 stray sin / cos / pow sites on CORE_MATH.
12. 2e08c4d2e (4ae4919a7) - MICRO and GAMEPREM re-pinned for green-1's own fixes (11 and 3).
13. ec0c12f25 (new on L40J) - LAKEBED's discard row follows L40J's shared ground program (four textual discards).
14. b001d778e (new on L40J) - CESSNA-REFIT's three cowl rows absent at their defaults (tools/_cage_gen.js).
15. 20a06971e (new on L40J; replaces 07e3a96db) - SKIS re-blessed: 11 of 21 digests, each move named.
16. d8e0bd667 - (built). `_commit_hygiene.js`: PASS.

The L40h-based line (`claude/master-green` up to 4ae4919a7) stays as the record of the work; it is not the ready.

## How the reds were read

- A0's three battery logs, split by gate; every gate's failing check lines compared across L40f, L40g, L40h.
- The 8 Nov sweep (`origin/claude/master-green-sweep`, flyDiy/reports/MASTER-GREEN-SWEEP-2026-11-08.md) for the reds
  that are older than 8 Nov: its bisects are quoted above as "8 Nov sweep", not re-proven.
- History deepened to 5 Oct. Bisects ran on first-parent history in a second worktree (with `media/`, a cold
  `tools/.joincache` at every step), each commit built with `node tools/build.js`.
- "?" rows are a first read of the log, not a proof: the class is filled in when the cause is found.
