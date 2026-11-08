# MASTER-GREEN sweep, 8 Nov 2026 (cloud session)

Base: origin/master 1bcd01d3e (train L35a). Node only, a 4-CPU cloud box (15 GB), node v22.23.4. Nothing fixed; no
other file touched.

How it was run:
- `run_gates.js --only=ID --no-build` was used throughout. The build was run once first and is clean: `node tools/build.js`
  on 1bcd01d3e leaves `git status` empty.
- Older commits ran in their own sparse worktrees (flyDiy/ without media/, screenshots/, reports/), each built with
  `node tools/build.js`.
- The bisects ran on first-parent history. Where the change came in through a merge's second parent, that side was then
  bisected too.
- Where a gate is slow, a scratch reader stood in for it: the gate's own check, lifted out of the gate file (scratchpad,
  not committed). Each boundary was then confirmed with the real gate where it says "real gate".

## 1. The three reds without an owner

### DMGCERT: the Cessna on floats holds at ultimate x 1.1

On master here, FAIL 67/70 in 712 s. The first failing lines, verbatim:

```
  FAIL  to the ultimate x 1.1 (6.27 g): it breaks (0 members), the first group none, the first member a -
  FAIL  BROKE AT - g (null, null) - within [5.70, 5.99] g (+2.5 % for the ramp's lag); first set 3.85 g
  FAIL  the page's bench thread (bench_worker.js benchLoadRun, the roll-out's certificate handed in) breaks it the same: the card reads "LIMIT 3.8 g · ULTIMATE 5.7 g · BROKE AT none (BROKE UP) — the test to destruction, free"
```

They are printed by `tools/_dmg_cert_check.js:208`, `:211` and `:213`.

**It is two changes, both older than the train list. None of the box's suspects did it:** the CESSNA-TAIL rows, the
Wipline rows and the FLAGSHIP 212 L tank all land after 24 Oct, and the gate was already red on 24 Oct.

- **Change 1, 13 Oct: the floats stop breaking at ultimate x 1.1** (HELD, 0 members; it was BROKE UP at 6.11 g).
  - Real gate: 07f68f9e8 PASS 70/70, then **32d5c364b FAIL 67/70**. 32d5c364b is train t52c's merge of
    `claude/design-trust-g2640`, tip f0ca25877 (G2640 DESIGN-TRUST). Its diff to 30_solver.js:
    - a thin oval skin's break is capped by its local buckling (`S.sigB`);
    - a split tube cluster's piece gets its own omega (`clOmegaPiece`);
    - plus 61_gen_frame / 60_gen_spec changes.
  - It reached the master tip's first-parent line on 18 Oct, at **7abc31170** (TORQUE-RETUNE-66 merges master 8a04876e).
    - First-parent bisect, real gate: a69f31fda PASS 70/70, 7abc31170 FAIL.
    - On master's side, train t57's merge of `claude/t55-held` (8c75cde0c, 14 Oct) carries it: 8c75cde0c FAIL,
      e21d9c7fc PASS.
  - From 7abc31170 to 4ab6c317d (L27) the destruction test still breaks, at 6.6-7.2 g, outside the [5.70, 5.99] band.
    The gate reads 68/70 there: two FAIL lines, `:208` and `:211`.
- **Change 2, L28a: the destruction test ends "BROKE UP" with no BROKE AT** (brokeAt null, 18 members broken; it was
  BROKE AT 7.21 g on 4ab6c317d).
  - Scratch destroy bench: 7075c5892 BROKE AT 7.21 g, then **1bd6cdf93 BROKE UP**. 1bd6cdf93 is train L28a's merge
    of `claude/ready/hydro-trim` (HYDRO-TRIM, tip ef3f0a98f; it reads "validated land builds bit-identical": this one
    is the floats).
  - This adds the third FAIL (`:213`, the card's "BROKE AT none"), and from here `:211` prints null.
  - It has been the same from L28a up to master: tested on L29e, L29h, PHONE-1b, L30b, L30c, L32c, L32g and master.

Side notes:
- The train 41 assembly merge of `claude/dmg-bundle-green` (8b9d055d0, 7 Oct) was briefly red in the same way: BROKE
  AT 6.59 g. That was settled before the train-41 final, and a69f31fda passes.
- The Cub, the Jodel and the land Cessna are not involved. Only the floats fail, matching the box.

**Read: unclear.**
- Change 1 is a deliberate change of the members' strength (G2640). Whether the floats' wing-strut fitting should
  still go by 6.27 g is the certificate owner's call: a **stale band** if G2640 is right, a **real fault** if not.
- Change 2 looks like a **real fault**, unproven: a test to destruction that breaks 18 members and records no break load
  is not a change any commit message names.

### TREECRASH: the 30 m/s trunk ensembles

On master here, the full gate went NOVERDICT: `timeout 1500` killed it while DMGCERT and DMGINST shared the box. So the
gate's own section 7 was lifted for the two cases (`L.ensemble(k, id, {n: 16, jobs: 3})` against master's
`tools/fixtures/treecrash_ensemble_ref.json`, printed by `tools/_treecrash_check.js:188`). On master it reproduces the
box exactly:

```
cub/trunk0   work MOVED p 0.001 med 33015.75->43513.05 (broken p 0.970, pieces p 0.310)
jodel/trunk0 pieces MOVED p 0.004 med 13->14, work MOVED p 0.000 med 19724.1->21613.15
```

**It is not one train, and the reference itself is in doubt.**

The reference does not reproduce here even on the commit it was captured on: 49b2932ce, the train-41 final
(344f5cf19, 8 Oct, "56/56").
- On 49b2932ce, cub/trunk0 work is 40.1 kJ against the reference's 33.0 kJ, and its seed-0 hash is 460faa0e, not
  e3559a48.
- So the cub's member work has read about 40 kJ, with p hovering around 0.01, on every commit tested since:

| commit | cub/trunk0 work, against 33.0 kJ |
|---|---|
| 49b2932ce | 40.1 kJ, p 0.011 |
| a69f31fda | 40.4 kJ, p 0.004 (MOVED) |
| 07f68f9e8 | 40.1 kJ, p 0.011 |
| 062c61251 (22 Oct) to adb2d2a92 (L30b) | 40.7 kJ, p 0.044, the same seed-0 hash cf9b14c2 throughout |

Possible causes, none checked: a warm gitignored `tools/.joincache` on the box at capture, or a page-dumped spec.

- **cub/trunk0: last crossed at L30c, train L30c's merge of `claude/ready/new-plane` (04ffb5b6e, 3 Nov).**
  - d17dbbac6: 40.7 kJ, p 0.044, then 04ffb5b6e: 42.7 kJ, p 0.002 MOVED.
  - Later trains add to it: 43.3 kJ on L32c, 43.5 kJ on master.
  - That merge's physics change is the load chain: `tools/_cage_join.js` now measures the fin's taper above the deck
    (`finTaperAbove`, "the user 3 Nov"). Its `_cage_cowl.js` hunk is a UI preset door. **No nose, mount or cowl change**
    is in it.
- **jodel/trunk0: changed at 7abc31170 (18 Oct)**, the same entry as DMGCERT.
  - a69f31fda: work 20.8 kJ, p 0.925, then 7abc31170: 22.6 kJ, p 0.000 MOVED, pieces 13 -> 14.
  - Inside, train t52c's G2640 merge: 07f68f9e8 work p 0.337, then 32d5c364b work 22.4 kJ, p 0.000 MOVED.
  - It has been red on every train since (tested 5f3f2c797, 062c61251, 2b381015d, 1db22c8a4, d17dbbac6, 04ffb5b6e
    and master).
  - Note: jodel pieces already read MOVED, p 0.010, on 49b2932ce itself: the same doubt about the reference.

**Read: stale pin, probable, for both rows.**
- G2640 (the Jodel) and NEW-PLANE's fin taper (the Cub) are deliberate changes of the physics, and the reference was
  never rewritten on master for either. The rewrite cb1049254 (G2809, 26 Oct) left master again with the avionics-gps
  revert df347ca21 (2 Nov).
- The reference should be re-captured, on the box, with a cold `.joincache`. That it was right on 8 Oct is unproven.

### DMGINST: the speed guard and k x 5

On master here, FAIL in 590 s:

```
  FAIL  every k x 5 in flight (past the integrator's limit): tripped at frame 1 as 'speed' (node 22 at 687.59 m/s off the CG), every number finite, stats().bad; it never went NaN in 600 frames - the old watchdog would have flown it on (at rest the fastest node read 0.16 m/s)
  FAIL  the worker host's diverged() (its snapshot's F_DIVERGED, the page's sw.diverged): false, then true on the blown lattice with p still finite
```

They are printed by `tools/_dmg_instruments_check.js:93` (it pins `fr.f === 0`) and `:129` (one step after k x 5).

**Turned red with train t52c's merge of `claude/design-trust-g2640` (32d5c364b, 13 Oct). It reached the master tip's
first-parent line on 18 Oct, at 7abc31170** (the merge of master 8a04876e; on master's side, t57's merge of
`claude/t55-held`, 8c75cde0c).
- Same as DMGCERT. It is red on every train in the list.
- Bisected with the gate's two checks lifted out:
  - first parent: a69f31fda good, 7abc31170 bad;
  - master's side: e21d9c7fc good, 8c75cde0c bad;
  - t55-held's own line: b0cbaf781 good, the t52-full side bad;
  - t52-full's line: 07f68f9e8 good, 32d5c364b bad.

What moved: the fastest node off the CG on the frames after k x 5, on the Cub.

| | first frame | second frame |
|---|---|---|
| before (07f68f9e8 / e21d9c7fc) | 869 m/s, guard trips | |
| after (8c75cde0c) | 1.7 m/s | 653 m/s, guard trips |
| master | 1.0 m/s | 688 m/s, guard trips |

The guard itself is fine: it trips on the first frame it sees past 150 m/s. The lattice on G2640's members simply blows up
one frame later.

**Read: stale pin, probable.** The gate's frame-0 assumption and its one-step diverged() read pin the old lattice's
blow-up speed, not the guard. Which G2640 hunk delays it is unproven.

**The common thread:** two of the three reds (DMGCERT's first step, DMGINST) and TREECRASH's Jodel row all date from one
merge: G2640 DESIGN-TRUST (train t52c, 32d5c364b, 13 Oct), on master's first-parent line since 7abc31170 (18 Oct). All
three have been red on every train from 24 Oct to 8 Nov.

## 2. The sweep (257 gates)

THE TABLE IS COMPLETE (23:05 UTC): all 257 gates have a verdict. Four had no verdict the first time, under load or memory pressure, and were re-run alone: DMGWIND, DMGDRIVE, TOUR and SOFTGPU. The last row per gate counts. Bisects still running: TOUR (the float Cessna's shard), ALTIPORT and DMGCLUSTERS to a merge; DMGTYRE and LAZY before 24 Oct.

How the sweep was run:
- One run_gates per gate on 1bcd01d3e: `--only=ID --no-build --verbose`.
- A slot scheduler on 4 slots. A gate costs its shards or its weight; a Playwright gate costs 4.
- The timeout is max(1500 s, 2.5 x the row's wall), capped by the row's own timeout.
- The verdict is run_gates' own summary row, which covers every shard; no row is NOVERDICT.
- The walls are this 4-CPU box's, partly under the bisect lanes' load, not the box's.

Kinds:
- ENV: needs something this box lacks.
- TIME?: only a time budget on a cloud CPU.
- red: a red for its owner (section 3).

257 of 257 run (the last row per gate): 223 PASS, 34 FAIL, 0 NOVERDICT, 0 pending.

| gate | verdict | wall s | kind |
|---|---|---|---|
| PILOTPAGE | FAIL | 625 | ENV (page legs: no Chrome page target here) |
| ARCHETYPES | FAIL | 3239 | red |
| SOFTGPU | PASS | 395 | (re-run alone; first pass's Chrome OOM-killed) |
| TOUR | FAIL | 3109 | red (re-run alone; first pass NOVERDICT at 3600 s under load) |
| DESTTO | FAIL | 1621 | red |
| DMGWIND | PASS | 747 | (re-run alone; first pass NOVERDICT at 1800 s under load) |
| DMGDRIVE | PASS | 634 | (re-run alone; first pass NOVERDICT at 1800 s under load) |
| DMGNOSE | PASS | 1107 |  |
| PILOT | PASS | 909 |  |
| DMGWALL | PASS | 498 |  |
| DMGSCAR | PASS | 822 |  |
| ALTIPORT | FAIL | 335 | red |
| FLEX | FAIL | 247 | red |
| DMGCLUSTERS | FAIL | 853 | red |
| TAILWHEEL | PASS | 1117 |  |
| DMGPLOUGH | PASS | 407 |  |
| DMGLOOK | FAIL | 93 | red (the pose row) + TIME? (the plan rows) |
| PILOTMATRIX | PASS | 1991 |  |
| RADIALDIV | FAIL | 1542 | red |
| CESSNAVREF | PASS | 448 |  |
| PROFILE | PASS | 1366 |  |
| DMGCOMPOSITE | PASS | 504 |  |
| DMGFALL | PASS | 409 |  |
| DMGFABRIC | FAIL | 236 | red |
| STOL | PASS | 533 |  |
| SEAPLANE | PASS | 207 |  |
| STORESPOT | PASS | 619 |  |
| PLAN | PASS | 372 |  |
| DMGTYRE | FAIL | 569 | red |
| TAXICLEAR | PASS | 407 |  |
| PROCURE | PASS | 182 |  |
| DMGFPS | PASS | 534 |  |
| DMGGLASS | PASS | 264 |  |
| DMGSETTLE | PASS | 201 |  |
| LAZY | FAIL | 193 | red |
| ROUTE | PASS | 1307 |  |
| AUDIOENG | PASS | 211 |  |
| DMGFLOATTO | PASS | 339 |  |
| TAKEOFF | PASS | 369 |  |
| CANDIDATES | PASS | 245 |  |
| PILLAR | PASS | 150 |  |
| DMGCERTCOST | FAIL | 200 | TIME? + one unclear row |
| PILOTACT | PASS | 209 |  |
| HOTHIGH | PASS | 186 |  |
| FREIGHT | FAIL | 95 | red |
| LINEUP | PASS | 165 |  |
| SOAR | PASS | 648 |  |
| TERRAINMATCH | PASS | 193 |  |
| DMGSKIN | PASS | 207 |  |
| DRAG | PASS | 26 |  |
| MIXLEAD | PASS | 40 |  |
| DMGDAMP | FAIL | 233 | red |
| DESIGNSIM | FAIL | 213 | red |
| HYDROTRIM | PASS | 92 |  |
| PREMCOOK | PASS | 531 |  |
| WIPLINE | PASS | 10 |  |
| LOAD | PASS | 482 |  |
| TESTFIELD | PASS | 244 |  |
| ROLLSND | PASS | 88 |  |
| DMGINTEGRITY | PASS | 117 |  |
| AUDIO | FAIL | 337 | red |
| GPSFACE | PASS | 478 |  |
| INPUT | PASS | 189 |  |
| BIPLANE | PASS | 139 |  |
| DMGWRECK | PASS | 369 |  |
| FLOATS | PASS | 73 |  |
| MOUNT | PASS | 80 |  |
| KTX2 | PASS | 124 |  |
| DMGSCUFF | PASS | 134 |  |
| GEARFALL | PASS | 114 |  |
| BENCHTIME | FAIL | 87 | TIME? |
| DMGMEMBERS | PASS | 107 |  |
| WEIGHT | PASS | 61 |  |
| CERTGATES | PASS | 41 |  |
| POSEBACK | PASS | 233 |  |
| BENCH | PASS | 128 |  |
| ENGTORQUE | FAIL | 102 | red |
| DMGPOD | PASS | 75 |  |
| SPECFIX | PASS | 159 |  |
| VILLAGE | PASS | 182 |  |
| SIMWORKER | PASS | 133 |  |
| STAGES | PASS | 121 |  |
| MATLIB | PASS | 75 |  |
| WATERDAMP | PASS | 96 |  |
| FLOATSCLASSIC | PASS | 49 |  |
| HEADING | PASS | 102 |  |
| AIDS | PASS | 37 |  |
| MISSIONS | PASS | 16 |  |
| MAPBAKE | PASS | 57 |  |
| HONESTY | PASS | 32 |  |
| CLOUD | PASS | 1118 |  |
| TANKMOUNT | PASS | 700 |  |
| GE | PASS | 509 |  |
| CONTACT | PASS | 470 |  |
| PREMRASTER | PASS | 323 |  |
| HYDRODYN | PASS | 238 |  |
| CABINLAMP | PASS | 169 |  |
| PREMISES | PASS | 150 |  |
| HINGE | PASS | 123 |  |
| DASH | PASS | 99 |  |
| LODS | PASS | 77 |  |
| ECON | PASS | 63 |  |
| HOUSE | PASS | 71 |  |
| METKIT | PASS | 85 |  |
| SCENERYED | FAIL | 78 | red (row 15) + TIME? (row 20b) |
| WETFX | PASS | 56 |  |
| ENGMESH | PASS | 87 |  |
| TOWNKIT | PASS | 85 |  |
| ENERGY | PASS | 107 |  |
| SUBSTEP | PASS | 74 |  |
| HONEST | PASS | 68 |  |
| CONTRACTS | PASS | 85 |  |
| FLOATKIT | PASS | 77 |  |
| CITYHOST | PASS | 50 |  |
| COVER | PASS | 42 |  |
| PAVEMENT | PASS | 44 |  |
| KITHOST | PASS | 63 |  |
| CLIP | FAIL | 52 | red |
| PRICE | PASS | 60 |  |
| RPM | PASS | 34 |  |
| STRESS | PASS | 59 |  |
| CLIMATE | PASS | 49 |  |
| WORLD | PASS | 42 |  |
| FITMANUAL | PASS | 30 |  |
| GAMEPREM | PASS | 24 |  |
| FIN | PASS | 34 |  |
| CLOCK | PASS | 28 |  |
| MASS | PASS | 18 |  |
| OBSTACLE | PASS | 31 |  |
| FIT | PASS | 29 |  |
| PILOTCANFLY | PASS | 24 |  |
| WORLDRENDER | PASS | 29 |  |
| SITE | PASS | 23 |  |
| WATER | PASS | 22 |  |
| TREES | PASS | 22 |  |
| PLOTQUERY | PASS | 15 |  |
| KNIFE | PASS | 26 |  |
| LOOKS | FAIL | 22 | red (stale pin) |
| FRAMES | PASS | 29 |  |
| SHOULDER | PASS | 29 |  |
| BIOME | FAIL | 17 | TIME? |
| TREE | PASS | 15 |  |
| GRASSSIDES | PASS | 14 |  |
| LAKEBED | FAIL | 14 | red |
| STRUT | PASS | 8 |  |
| SETTLE | FAIL | 8 | TIME? |
| RWYLIGHTS | FAIL | 11 | red |
| WEATHER | PASS | 9 |  |
| JOIN | PASS | 9 |  |
| GROUNDQUERY | PASS | 8 |  |
| AERO | PASS | 15 |  |
| HYDRO | PASS | 17 |  |
| PARTS | PASS | 13 |  |
| SKIN | PASS | 13 |  |
| SKINMAT | FAIL | 10 | red |
| DEFAULT | PASS | 14 |  |
| ELEC | PASS | 7 |  |
| FLAPS | PASS | 7 |  |
| ASSETBUDGET | PASS | 3 |  |
| POSTFX | PASS | 1 |  |
| GROUNDLIB | PASS | 6 |  |
| DAY | PASS | 4 |  |
| BUILD | PASS | 4 |  |
| PATCHBOUNDS | PASS | 3 |  |
| CABIN | PASS | 3 |  |
| RAYINDEX | PASS | 3 |  |
| HANGAR | PASS | 2 |  |
| FLIGHTREC | FAIL | 4 | red (stale pin) |
| ANIMALS | PASS | 5 |  |
| WINGSPLIT | PASS | 3 |  |
| TARR | PASS | 3 |  |
| STORAGE | PASS | 5 |  |
| FLIGHTEVIDENCE | PASS | 0 |  |
| ATMOS | PASS | 5 |  |
| CHARS | PASS | 3 |  |
| SURF | PASS | 3 |  |
| CGBAND | PASS | 5 |  |
| HYPOT | PASS | 2 |  |
| FADES | PASS | 3 |  |
| SAVE | PASS | 3 |  |
| VIEW | PASS | 0 |  |
| GROUNDBOX | PASS | 1 |  |
| PILOTS | PASS | 1 |  |
| SCENEDETAIL | PASS | 1 |  |
| EDBUGS | PASS | 6 |  |
| QUADWIN | PASS | 4 |  |
| REF | PASS | 2 |  |
| FLOWNBAKE | PASS | 0 |  |
| LIFE | PASS | 2 |  |
| PLAYER | PASS | 1 |  |
| STOREDRAW | PASS | 2 |  |
| PACECADENCE | PASS | 2 |  |
| NAV | PASS | 1 |  |
| BOOT | PASS | 0 |  |
| PROPS | PASS | 2 |  |
| LOADS | PASS | 1 |  |
| TOTEM | PASS | 0 |  |
| SCENERY | PASS | 1 |  |
| CARS | PASS | 1 |  |
| NAVAID | PASS | 1 |  |
| SHADOWSKY | FAIL | 1 | red |
| COWL | PASS | 1 |  |
| ENGINE | PASS | 3 |  |
| ENGID | PASS | 1 |  |
| BEACON | PASS | 0 |  |
| HANGARVIEW | PASS | 0 |  |
| GEAR | PASS | 2 |  |
| PANEL | PASS | 3 |  |
| PACKINPUTS | PASS | 1 |  |
| COOKWAIT | PASS | 0 |  |
| WINDRASTER | PASS | 0 |  |
| AA | PASS | 0 |  |
| PATCHFAR | PASS | 1 |  |
| MISSIONPROPS | PASS | 2 |  |
| STAND | PASS | 0 |  |
| SEATS | PASS | 3 |  |
| STARTER | PASS | 3 |  |
| NIGHTVISIBILITY | PASS | 1 |  |
| SCENERYLIGHTS | PASS | 0 |  |
| ATMO | PASS | 3 |  |
| BAY | PASS | 0 |  |
| BLUEPRINT | PASS | 1 |  |
| INTROSTATE | PASS | 0 |  |
| BACKGUARD | PASS | 0 |  |
| NIGHTEXPOSURE | PASS | 0 |  |
| HULLWARM | PASS | 0 |  |
| NODUMMY | FAIL | 1 | red |
| INTROSCENE | PASS | 1 |  |
| ENERGYBASE | PASS | 1 |  |
| COVERIDLE | PASS | 0 |  |
| FOG | FAIL | 0 | red (stale pin) |
| CAGEFIT | PASS | 0 |  |
| CREWLOAD | FAIL | 45 | TIME? (red on its own landing commit here) |
| CITYCOOK | PASS | 42 |  |
| GEOPARITY | PASS | 110 |  |
| PODEDITOR | PASS | 54 |  |
| STORY | PASS | 11 |  |
| WINGROWS | PASS | 69 |  |
| STRIPSURF | PASS | 35 |  |
| WEATHERPLAN | PASS | 27 |  |
| NAMES | FAIL | 23 | red |
| UILAYER | PASS | 4 |  |
| GENPAIRS | PASS | 4 |  |
| STRIPGROUND | PASS | 16 |  |
| WEARPRICE | PASS | 3 |  |
| WEARTAB | PASS | 7 |  |
| BUILT | PASS | 5 |  |
| OBSTFRAME | PASS | 3 |  |
| UPDATE | PASS | 1 |  |
| CARDDRAG | PASS | 0 |  |
| TECH | FAIL | 4 | red |
| HWCOV | PASS | 0 |  |
| PWA | PASS | 1 |  |
| PLANELISTS | PASS | 1 |  |
| FLOATLETTERS | PASS | 1 |  |
| PLANETHUMB | PASS | 0 |  |
| PLANEFICHE | PASS | 0 |  |


## 3. The reds, one block each

How each one was bisected:
- With that gate alone, first over the 28 "(built)" trains, newest to oldest.
- Then over the first-parent commits of the train it turned red in. Where that landed on a merge of master into a branch,
  master's side was bisected too.
- The gate itself was the test unless a case is named. Gates that print one row per case were bisected on the failing
  row ("the cub case alone" and so on).
- "first red X / last green Y" means two adjacent commits on that line, each run.
- The earlier trains were checked out in full (media/ included) after a first pass without media/ gave false reds
  (LAKEBED, LOOKS, AUDIO, RWYLIGHTS); those runs were thrown away.

### Turned red inside the 24 Oct - 8 Nov trains

**DESIGNSIM** (`tools/_designcheck_check.js:239`)
```
  FAIL   mosquito_3: predicted spiral root -0.0409 /s, flown 0.0215 /s (bank doubling stable vs 32.2 s)
```
- Train **L31c** (L31b af8116aa9 green, c2ac56b39 red). The merge: **`claude/ready/pilot1-circuit`** (a89495fec; 2c1644414
  green).
- Read: **unclear**. The design check's predicted spiral still says stable; the flown one now diverges. pilot1-circuit
  changed what is flown, not the prediction.

**FREIGHT** (`tools/_freight_check.js:142`, printed at `:809`)
```
  - cub: FREIGHT_CARDS = its build measured off its mesh (tools/_freight_site.js)
```
- Train **L31c**. The merge: **`claude/ready/cub-window`** (28ad15d61; dc7b768d4 green).
- Read: **stale pin, probable**. cub-window changed the Cub's mesh; the stored FREIGHT_CARDS row was not re-measured.

**ENGTORQUE** (`tools/_engtorque_check.js:145`)
```
FAIL SIGN swirl: the Lycoming hand + (hands-off swing, + = left) - -38.9892
FAIL SIGN swirl: the other hand mirrors it (25 %) - 38.9892 vs 38.9892
```
- Train **L31c**. It came in on e589ae7e1, "merge L31b into tailwheels", from **`claude/ready/tailwheels`**' side. On that
  branch the commit is **3cfc6d101** "TAILWHEELS (G3800): the tail contact's four laws, the skid..." (adb2d2a92 green).
- Read: **unclear**. Both hands now swing the same way by the same amount. The swirl swing is no longer the effect being
  measured; the new tail contact dominates the hands-off swing.

**SKINMAT** (`tools/test_skinmat.js:1202`)
```
  FAIL finish: a click on a surface in the FINISH view does not land on its own section's row
```
- Train **L32c** (L32b f7ee20edf green, 0ebe6e3eb red). The merge: **`origin/a0/wear-tab-eol`** (244c4a7c3).
- Read: **real fault, probable**: the Wear tab's merge breaks the FINISH view's pick-to-row. Unproven which hunk.

**NAMES** (`tools/_names_check.js:124`)
```
  FAIL src/viewer/aeroskin.js:2695: Alaska in "Alaska"
  FAIL index.html script 168:2696: Alaska in "Alaska"
```
- Train **L32b** (L31c green). The merge: **`claude/ready/livery-5`** (982a2d211). The line is LIVERY-5's fb442d878: a
  livery named "Alaska".
- Read: **real fault** by the gate's own rule (a real place name), unless the names list is meant to allow it: the
  livery owner's call.

**SHADOWSKY** (`tools/_shadowsky_check.js:218`)
```
  FAIL 4 clouds: a stale depth nearer than the first deck is sky - marched through, its key the far plane (the composite hides behind this frame's scene)
```
- Train **L32f** (L32e e99afbfc7 green, 12d3f17e6 red). The commit: **bbc115dda**, "LOOK-1 2a: the clouds' temporal pass:
  history, reprojection on the cloud's own distance...".
- Read: **stale pin, probable**: the cloud march was rewritten on purpose and the row reads the old shader. Unproven.

**FLIGHTREC** (`tools/_flightrec_check.js:422`)
```
FAIL   app.js: begin after the frame clock says the frame is ours, end before PACE.end, end(false) on the boot's hold
FAIL   app.js: a held frame (holdRender) reports itself to PACE.end flagged held, and the pace counts nothing of it (REVEAL)
```
- Train **L30c** (L30b adb2d2a92 green, e6bcfb368 red). The merge: **`claude/ready/new-plane`** (04ffb5b6e).
- Read: **stale pin**. The rows regex-match `if (holdRender) { if (FR) FR.end(false, cg); ...`. NEW-PLANE widened that
  line to `if (holdRender || uiHold || (window.NEW_PLANE && window.NEW_PLANE.isOpen())) { ...`.

**LOOKS** (`tools/_looks_check.js:120`)
```
  FAIL 3 the patch's waves fade to the coast (the vertex reads the coast field)
```
- Train **L31a** (L30d 05f95aa76 green, adc53b25b red). The merge: **`claude/ready/bay-mirror`** (c8b6fdcd2; it touches
  water.js).
- Read: **stale pin**. The row pins the water shader's source in two parts:
  - the smoothstep, which is still at water.js:269;
  - the literal `uniform sampler2D uWSdf; uniform vec4 uWGrid; uniform float uWSdfOn;' + GLSL_GERSTNER`, which is gone.
    The declaration now lives in a longer string, at water.js:144 and :260.

**CLIP** (`tools/_clip_check.js:357`)
```
  FAIL stock+ifr/rest: navAerial/centre [access, on body body] 9.2 mm INTO edFinSkin (allow 5.5 mm), 3% of 216 v buried, at (-0.00, 0.71, -1.21)
```
- Train **L29h** (L29f d1a754b94 green, e6c668dab red). The merge: **`claude/ready/windows-fittings`** (A0 FINISH-3,
  83cbf8ad4).
- Read: **real fault, probable**: the IFR nav aerial sits 9.2 mm into the fin skin.

**TECH** (`tools/_tech_check.js:129`); already named red on master in the HANDOVER (DC3-EDITABLE)
```
FAIL every option of every covered table has a segment (113 options, 23 groups)  [pitch:seaplane]
```
- Train **L28b** (L28a 20a534e89 green, a5e89abe9 red). The commit: **c5e9f46c9**, "train L28b integration (A0):
  _cage_float.js...".
- Read: **unclear**: a covered option, pitch:seaplane, without a segment.

**NODUMMY** (`tools/_nodummy_check.js:87`)
```
  FAIL no reference to the retired figure outside the load migration  [tools/_bench_check.js:682 dummy | tools/_crew_head_probe.js:2 dummies | ... | tools/box_render.js:42 dummy | tools/box_render.js:47 dummy]
```
- Train **L29h**. The merge: **`claude/ready/avionics-gps`** (8090d6de5). At that merge only tools/box_render.js:39/44 hit.
- The revert df347ca21 removed box_render.js, but master holds it again, plus later hits in _crew_head_probe.js,
  _treehit_check.js and _bench_check.js.
- Read: **unclear, tools only**: no game source is hit, and it has more than one source now.

**SCENERYED** (`tools/_scenery_ed_check.js`): two rows, two stories
```
  ! 15 the shipped record is the save entry by entry (held back: sg_k_club:0, sg_k_club:1, ... )
  ! 20b ...and with Metlakatla put back under 2500 ms (4680 ms, 444 plots; 3.95 s before G3081 on the flight world)
```
- Row 15 (`:688`): train **L31c**, the merge **`claude/ready/s39-lights`** (913abfb5d; 5465135e1 green). Bisected on
  that row alone.
  - Read: **unclear**. The user's shipped record holds back the sg_k_club entries the save writes.
- Row 20b (`:870`): **TIME?**. It is red here on every commit since the row came in with EDITOR-PERF a970e8117 (12 Oct;
  on the master tip's first-parent line from 7abc31170). Here it reads 4.7-5.7 s against 2500 ms.

**FLEX** (`tools/test_flex.js:765`; 3 shards)
```
TypeError: Cannot read properties of undefined (reading 'vis')      (src/core/30_solver.js:796, in a shard)
  FAIL  tail arm: the tube factor is live (K 1 reads 3x softer in rise or roll)
```
- Train **L31b** (af8116aa9 red; the first-parent bisect over adb2d2a92..0ebe6e3eb). The merge:
  **`claude/ready/gear-falls`** (d5ac50d44; 96591e5e3 green).
- An earlier train-level pass read one shard's GATE line and placed it at L31c; that pass was thrown away.
- A shard throws in the solver's new gear-group walk: `beams[j].vis`, on a beam index the def does not have. That shard
  prints no verdict line, so a parser that reads one shard's GATE line calls it PASS. Only run_gates' summary row says
  FAIL.
- Read: **real fault, probable**: the walk does not guard a def without that beam (FLEX's variants). Unproven whether
  the variant or the solver should give.

**DESTTO**: two cases, two stories (3 shards; the full gate 1621 s here)
```
  FAIL career:cub@w3: accepted: the job (tracked) and the Trust's first arc contract
  FAIL career:cub@w3: the same stop moves the Trust's arc to its stage 2 (land at HOME), now tracked
  FAIL career:cub@w3: the arrival card's lines: Tools for Ridgeback Strip: complete, paid 1 720 / wallet 87 620 (+1 720)
  FAIL ltd:floats: leg 2 flies to mk_sea and lands there - gave-up FINAL out mk_sea after 811 s | 120.8 pivot: a turn of 26 deg that the wheels (Infinity m) cannot steer on the route ...
  FAIL prem:floats@mk_sea: it stopped on the lane at mk_sea - out mk_sea
```
- `career:cub@w3` (`tools/_destto_check.js:216` / `:236`):
  - It passes alone (`--only career:cub@w3`) and fails inside its shard (`--shard=0/3`), so it depends on the cases
    before it. It was bisected on the shard.
  - Train **L30d** (L30c green). The merge: **`claude/a0/cert-m2`** (b4d436410; 53190f574 green).
  - Read: **unclear**. The Trust's first arc contract is not accepted alongside the job after the cases before it.
    The cert-m2 merge must touch the career's state carried between cases; unproven how.
- `ltd:floats` (`:173`; bisected alone):
  - Train **PHONE-1b** (L29h e6c668dab green, d7fd93adc red). The merge: **PHONE-1b's merge of PHONE-1a** (b8e244028:
    L29i, PHONE-GARAGE, "the floatplane drag-release drop"; d291b3adf green).
  - Read: **real fault, probable**: the floats' second leg gives up its final into mk_sea on a pivot the "wheels"
    cannot steer.

**DMGLOOK** (`tools/_dmg_look_check.js:179`)
```
FAIL cub trunk-0 (25 s, broken 54, ...) d. the pose: 1 slots @81, 8 slots @191 bad 1, 8 slots @300 bad 1 - ... worst {"step":300,"why":"bent: centreline length off its rest",...}
FAIL cub trunk-0 (...) c. the plan: ... worst plan 4.28 ms over 15 events (measure 17.1 ms once) ...
```
- The four "c. the plan" rows are a per-event planning time in ms: **TIME?**.
- The "d. the pose" row was bisected alone: train **L30c** (L30b green). The merge: **`claude/ready/tank-fit`**
  (349bc11f2; 04ffb5b6e green).
- Read: **unclear**: a wreck's bent member's drawn centreline is off its rest length, after the honest tank fit moved
  the Cub's mass.

### Red before 24 Oct (traced back)

**DMGFABRIC** (`tools/_dmg_fabric_check.js:194`)
```
  FAIL  cub t25: damage OFF - the base's bits (a6929aa46172), no tie store
  FAIL  cub t25: damage ON with the ties disabled (GEN_COVER.on = false) - the base's physics, its bits (51d9e8dc9ab4)
  FAIL  cub t0: damage OFF - the base's bits (ad0a1489d925), no tie store
```
- Red on every train in the list. The first red is **a69f31fda** (13 Oct), pilot-45's merge of master 39570350b, as
  DMGDAMP: master's side passes (39570350b PASS), and the pilot-45 side has no gate.
- Read: **stale pin, probable**: the rows pin the hashes of the base's flights, and the merge brought pilot-45's physics
  (TORQUE-BUNDLE-45) under them.

**AUDIO** (`tools/audio/_audio_check.js:3995`)
```
  FAIL EMITALLOC: 1 failure(s)
         the emitters allocate in AUDIO.update: 7.1 B a frame over the page without them (420360 vs 349416 B, 0 vs 0 GC; 47 params and 9 calls of theirs allow 39120 B + 16 KB)
```
- Train **1B** (PHONE-1b eae624e14 green, 1db22c8a4 red). It came in on 4f959b923, PHONE-1b's merge of master F4. On
  master's side the merge is train F4's **`claude/gps-pfd`** (382a66977; b34115323 green).
- Read: **real fault, probable**: an allocation budget, measured with GC exposed, so not a CPU-time budget.

**CREWLOAD** (`tools/_crewload_check.js:84`)
```
  FAIL A: it is retried on the clock (0, +2, +6 s from the first fetch)  (builds at [5142] ms, fetches at [2971,8413,12420] ms)
```
- **TIME?** It is red here from train 1B on, and also on its own landing commit 69246cd21 (CREW-LOAD-BACKOFF; there the
  retries are 3.05 and 4.0 s apart against +2 / +4). It is a wall-clock schedule on a loaded 4-CPU box.

**FOG** (`tools/test_fog.js:92-93`)
```
  FAIL app.js applies it for the MAIN camera
  FAIL app.js releases it in the same frame
```
- Red on every train in the list. It came in on L21c's merge **`claude/ready/story-intro`** (2ca567bd1, 21 Oct;
  d943b6cd9 green). It reached the master tip's line through ap-adapt's merge of master L21c (a11d8fbc6).
- Read: **stale pin**. The rows regex `if (!inGarage && WF && WF.vis) WF.vis.apply(camera);`, and app.js:20323 now reads
  `if (!inShed && ...)`.

**LAKEBED** (`tools/_lakebed_check.js:112`)
```
  FAIL 2 02/20's pond stays the runway's fill (G753: no texel, no quad)  (texels 28)
  FAIL 3 ...and the physics has water there (the floats ride what is drawn)  (4 without)
```
- It is on the master tip's line since 7abc31170 (18 Oct, TORQUE-RETUNE-66's merge of master 8a04876e; a69f31fda green).
  On master's side it is train t52ab's merge **`claude/t54-audit`** (64e360d19, 13 Oct; f6bda9011 green).
- Read: **unclear**: the 02/20 pond now has 28 water texels drawn.

**RWYLIGHTS** (`tools/_rwylights_check.js:77`)
```
FAIL   jolene w5: the strip keeps its lights (15 of 24, 10 flush) - 15 of 24
  FAIL   jolene w4: the strip keeps its lights (16 of 22, 10 flush) - 16 of 22
```
- It came in on 50cc21452 (TORQUE-STEER's merge of master into pilot-45; 9ded1303f green). On master's side it is
  **train ship's merge of `claude/scenery-ship-g3010`** (214e8b6cb, 12 Oct; 0b42f6826 green).
- Read: **unclear**: the shipped scenery takes strip lights off w4 / w5.

**RADIALDIV** (`tools/_radialdiv_check.js:158`)
```
FAIL mosquito: HANDS OFF 20 s, the heading moved under 15 deg - -88.1
  FAIL mosquito_1: HANDS OFF 20 s, the heading moved under 15 deg - -88.2
  FAIL cub: HANDS OFF 20 s, the heading moved under 15 deg - -175.9
```
- Red on every train in the list. Bisected on the cub case alone (`--only=cub`):
  - first red **a0aeeeee9** (12 Oct), "G2540 TORQUE-BUNDLE-45: ENGINE-TORQUE G2080, its net change over train 38", on the
    pilot-45 line (the master tip's first-parent line);
  - last green a9afa4967. The cub read -46.8 deg there; -175.9 on master, which grew later and is unproven where.
- The mosquito rows were not bisected.
- Read: **unclear**. The engine's torque turning the aeroplane hands off is G2080's point, and the row's 15 deg predates
  it. That would make it a stale pin, but 176 deg in 20 s is a lot.

**ARCHETYPES** (`tools/_arch_check.js:144`; shard 1/4)
```
  FAIL   Chinook-alike: the circuit completes — rejected-takeoff
```
- Red on every train in the list. Bisected on the card alone (`_arch_check.js --only=chinook`): first red **a0aeeeee9**
  (ENGINE-TORQUE G2080, as RADIALDIV), last green a9afa4967.
- Read: **unclear**: the Chinook-alike rejects its take-off since the engine torque came in.

**DMGDAMP** (`tools/_dmgdamp_check.js:92`)
```
FAIL Cub roll: |L - L0| / L0 over 10 s = 4.23e-3 (<= 1e-3; the old damper: L(10 s) / L0 = 0.0067)
FAIL Cub pitch: |L - L0| / L0 over 10 s = 1.51e-1 (<= 1e-3; the old damper: L(10 s) / L0 = 0.0067)
```
The same, roll / pitch / yaw, on the Jodel and the others.
- Red on every train in the list. The first red is **a69f31fda** (13 Oct), pilot-45's merge of master 39570350b.
  - Master's side passes: 39570350b PASS, and every one of master's 12-13 Oct commits tested passes.
  - The pilot-45 side has no DMGDAMP gate (ABSENT).
  - Master's gate file dropped into the pilot-45 trees before and after G2080 fails 30 checks on both, because that side
    still has the old damper. So that is not a clean test.
- So it is the meeting of master's new damper and pilot-45's line (TORQUE-BUNDLE-45). Which commit: **unproven**.
- Read: **unclear**. Angular momentum in the vacuum spin drifts 0.3 % (roll / yaw) and 15 % (pitch) in 10 s.

### Not reds

- **TIME?**:
  - DMGCERTCOST (`_dmg_certcost_check.js:243`: 48.5 s in node against a 42 s ceiling). Its other red row (`:191`, "the
    worker's certificate is node's", in headless Chromium, 1.1e-8 against the 1e-6 it allows) is **unclear** and was
    not bisected;
  - BENCHTIME (`_benchtime_check.js:72`: the bench checks 6.2-9.6 s against 6 / 8 s);
  - BIOME (`test_biome.js:132`: surface perf < 5 us);
  - SETTLE (`test_settle.js:122`: the bake budget);
  - CREWLOAD and SCENERYED 20b (above).
- **ENV**: PILOTPAGE. Its node twins exit 0. Every page leg fails with "no page target" (`tools/tour_real.js:183`): its
  Chrome (/usr/bin/chromium, as root, no --no-sandbox) never opens a DevTools page here.
