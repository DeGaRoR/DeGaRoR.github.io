# STORY-REVAMP - progress (structure only)

Cloud session [CLOUD] STORY-REVAMP, branch `claude/story-revamp` (`origin/master` 56047b34e = train L40K merged in on
23 Nov, 20c8f846f; before that L40J 089297693, e82422d65, and L40H 9349a62c).
Readies: `claude/ready/story-<n>`, each with its gate results. This file shows STRUCTURE (counts, steps, systems, what
is wired, what is tested). It carries no dialogue and no twists.

Inputs read: CLAUDE.md, HANDOVER (ritual, files, gates), `origin/claude/story-revamp-inputs`
(`flyDiy/reports/story-revamp-inputs/`, five notes, 13-17 Nov), and the user's four backbone stories for the large
missions (22 Nov, handed to this session: the remote community, home improvement, the observatory, the cultural
heritage site). Where a backbone story and an older note disagree, the backbone story wins (the user, 22 Nov).

## Status for A0 (Mon 23 Nov, sixth note, 20:20 UTC) - story-9 c4d67392e

- **`claude/ready/story-9`** = story-8 + (1) THE VALIDATED-WITH FLAG on the missions and its display in the mission
  editor (the user asked for it this evening), (2) the cargo seating correction of the harness, (3) the rows flown on
  L40K's sim so far and their flags, (4) `story_feas --only` in the order given. It CONTAINS story-8: take the latest
  ready. Under `src/` only `src/missions/story.json` moves (the flags); the built files move with the editor (its
  (built) commit: index.html, dev.html, sw.js, version.json - flight_core.js and the chunks byte for byte).
- GATES ON IT: STORYPACK, TUTORWALK, MISSIONLIVE, BUILT, COMMITHYGIENE PASS; MISSIONS red on 8 checks, the same 8
  lines on the tree without these changes (the bush run: master's, named in L40K's note); MISSIONFEAS passed on the
  merged tree before the seating correction, whose path it does not use (run again when the flights end); CONTRACTS
  master's four. The editor was read in a headless page: no page error, the flag's states on the missions.
- The flights go on overnight; rows and flags are pushed to `claude/story-revamp` as they land.

## HANDOVER (A0 asked, Mon 23 Nov: "what's done, what's left, the feasibility state, how to run" - then this session stands down)

Whoever takes this on needs this section, the table "Where it stands" and the table "Gaps"; the rest is the detail.

### What is done

- THE GAME LAYER IS ON THE MISSION SYSTEM. A player's career reads the story pack `src/missions/story.json` with no
  flag: no drawn job, contracts in any order, projects as ordered steps tied to a site, each step moving its world
  track and giving machinery (never bought), the ladder as three lines of the pack. Readies story-1 to story-7 carry it
  (the table below names each); story-7 and the two-line `story-fields` ready ride L40K.
- THE PACK IS THE MISSION EDITOR'S FILE (the user, 22 Nov: "Yes"): saved in the editor's format, no generator; the
  editor edits rules, clients, starting kits, projects and steps. GATE STORYPACK holds the rules and the byte round trip.
- THE USER'S FOUR LARGE MISSION STORIES are four projects of the pack (8, 7, 6 and 2 steps) with short draft words;
  their verbatim text is NOT committed (the user, 22 Nov: "no").
- THE TUTORIAL (v2) IS PLAYED START TO END ON NODE: `tools/story_run.js`, GATE TUTORWALK (core) and TUTORFLY (full).
- THE AERO CLUB: five scored events (speed pylons, a regularity run, a multi-leg tour, a short-landing event, a spot
  landing) and one contract; the measurements are wired on the page and in the rig; results are kept on the career.
  All six flew start to end on L40J's sim (re-flown on L40K: the state below). GLIDERS AND THE TOW: L40K lands the
  LS4-alike, the Archaeopteryx-alike, a winch and a van tow - the club's glider and tow events can be authored on
  them now; none is authored here.
- VALIDATED WITH (the user, 23 Nov: "add a flag on the missions, possibly direct in editor, like validated with XXX
  plane"): every mission of `src/missions/story.json` carries the test pilot's flight of it - `validated { with:
  <aeroplane> | null, sim, flownS | verdict + why, sig }` - written from the kept rows by `node tools/story_feas.js
  --stamp`. THE MISSION EDITOR SHOWS IT: on a mission "Validated with: <aeroplane> - time flown - sim", or why it is
  not, or that it was never flown; a mark and the aeroplane in the mission list; the count by aeroplane on the pack.
  `sig` is what the mission asks of a flight as written (kind, legs and steps, order, timers, course, landing lines):
  edit a step in the editor and the flag reads "edited since the test pilot flew it" until it is flown and stamped
  again. The contract record does not carry the flag (the career and the page are untouched).
- THE FEASIBILITY HARNESS: `tools/mission_feas_lib.js` flies a mission the game's way (the stand, the pilot, the
  career's stops) with the seats filled through the garage's own door, a course entered on a base turn and left without
  a climb; `tools/story_feas.js` keeps one row a mission.

### How to run it (from `flyDiy/`, after `node tools/build.js` if `src/` changed)

| what | command | time |
|---|---|---|
| the story gates | `node tools/run_gates.js --only=STORYPACK,TUTORWALK,MISSIONLIVE --jobs=3 --no-build` | minutes |
| the feasibility gate (the built-in pack) | `node tools/run_gates.js --only=MISSIONFEAS --no-build` - ALONE: it times out beside other work | 7-8 min |
| the tutorial, walked | `node tools/story_run.js --dry` | seconds |
| the tutorial, every flight flown | `node tools/story_run.js` (GATE TUTORFLY is the same, as a full-tier gate) | ~50 min |
| the pack's flights still missing | `node tools/story_feas.js --fly --workers=4 --tmax=2400 --rows=reports/STORY-REVAMP/feasibility` (`--only=<ids>` for a group, `--max=N` for a batch) | ~25 min of one core a feasible mission; a red one up to 3 aeroplanes x its legs x tmax |
| chosen missions again | `node tools/story_feas.js --fly --only=<id>,<id> --again --rows=reports/STORY-REVAMP/feasibility` | |
| the table from the rows | `node tools/story_feas.js --table --rows=reports/STORY-REVAMP/feasibility` (writes feasibility.json + .md) | seconds |
| the flags on the missions | `node tools/story_feas.js --stamp` (writes `validated` into story.json from the current rows; then GATE STORYPACK) - open `tools/mission_editor.html`, "Open story pack", to read them | seconds |
| is the pack covered | `node tools/story_feas.js --check` (exit 1 while a mission is not flown, stale or red outside the named classes) | seconds |
| one mission, the legs printed | `node tools/mission_feas.js --only=<id> --rerun --packs=src/missions --out=<a scratch dir> --official --also=57,58 --builds=<the two files in story_feas.js BUILDS>` | |
| a flight with no mission | `node tools/flight_script.js reports/STORY-REVAMP/repro/<file>.json --out <dir>` | minutes |

- A ROW IS CURRENT only for its mission's own record (`key`) AND the sim it was flown on (`sim`, the constant `SIM` in
  story_feas.js). `SIM` is bumped BY HAND when a merge of master changes the pilot, the flight model or the career's
  aeroplanes: every row is then stale and flown again. Read a red from its row's `attempts` (each aeroplane tried, the
  pilot's own words, the landing), never from the one-line verdict.
- THE POOL (the user, 23 Nov: "you can really try any of the official planes ... maybe you can even build a quick one"):
  the validated designs first, then every official plane, the two PC-6 of the wip list, and two test builds in
  `tools/fixtures/storyfeas/` (a Cessna with the STOL kit, on the retired light airframe and on today's).
  THE CABIN IS SEATED AS THE JOB ASKS, both ways, through the garage's seat door: its passengers aboard, and the
  pilot alone for freight (the Cessnas and the DC-3-alike are SAVED with two aboard: a cargo job flew with that seat
  taken and half the loading card's room until 23 Nov evening; feasible rows flown the heavier way stand).
- IN A CLOUD CONTAINER: a tracked background task is killed at two hours WITH its flights (finished rows are kept), and
  a detached process dies when the turn ends (the container sleeps). What works: the run detached in its own session
  (`setsid nohup`), and a tracked task that only waits on it (`while pgrep -f <the run>; do sleep 60; done`), started
  again each time it is cut. Do not rebuild the tree while flights run (each mission is a new process on
  `tools/flight_core.js`); a flight has no wall-clock limit, so the run can be paused (SIGSTOP / SIGCONT) for a gate
  that must run alone. A mission that ends red costs up to three aeroplanes of an hour of flight each.

### What is left

1. THE REDS OF THE FLIGHTS, BY WHAT WOULD TURN THEM (the missions under each cause: "The feasibility state" below; each
   mission's own cause is on its flag in the editor). None of them is a fault of the mission system:
   - THE LOADING CARD AGAINST THE CAPABILITY RULE (the largest group). `contractCanDo` says the Cessna's cabin takes
     280 kg, so the board offers it the job; the loading view then puts 140 kg aboard (50 kg for the 210 m mountain
     strip, 90 to 98 kg on floats), and the cards of the PC-6 and the DC-3-alike take no cargo at all. Either the
     rule reads the card, or the cards are completed, or these loads wait for a hauler the player builds (the user,
     23 Nov: "the players will not be limited to existing planes, they will modify them"). The loads are the pack's
     draft numbers: the editor changes them, and the flag then reads "edited" until the mission is flown again.
   - THE ALTIPORT (tw_ski) AND THE CANNERY STRIP (w5): the test pilot's landing. Flown light at the altiport the Cub
     and the STOL Cub stop off the strip's end and cannot taxi back, the Jodel alone goes over in the rollout (with a
     passenger it lands it); flown heavy it never gets down. At w5 the multi-leg tour's stop ends off the strip or
     cannot leave (on L40J the Cub flew it). The pilot's owner has the rows and a scripted repro
     (`reports/STORY-REVAMP/repro/`). A player lands these by hand: the missions are playable.
   - THE 210 m MOUNTAIN STRIP WITH THREE ABOARD: the pilot will not go (277 m for the Cessna, 246 m for the PC-6):
     a three-seat STOL plane the player builds.
   - CABIN LAKE names no landing direction (the island's aerodrome record: the user's document): five missions land
     there; the flight with the direction named lands.
   - THE PC-6 ON WIPLINES (wip list) is started at HOME as an amphibian and often does not line up there; when it
     does (lumber.03) it flies the job.
2. `node tools/story_feas.js --check` is not green while those stand, so GATE STORYFEAS is not registered. After a
   merge of master that changes the aeroplanes or the pilot: bump `SIM`, fly again (about 14 hours of 4 cores for the
   whole pack; the reds cost the most), `--table`, `--stamp`, GATE STORYPACK.
3. THE GAPS TABLE at the end of this file: scenery for 18 of the 31 world stages, two scenery readies not on master,
   the clear-day rule, the planes no official list has (a glider, a tow plane, a ski hauler, a STOL hauler), the
   Projects board and "restart this flight" on the page, portraits, the economy pass.
4. THE LADDER is a proposal (three lines of the pack): who gives what is the user's and Game's call.
5. THE WORDS: every mission and step carries short draft words; the stories' own text is the user's to place (the
   mission editor edits them in the page).

### The feasibility state

<!-- feas-state -->
ON L40K's SIM (this branch; the table `reports/STORY-REVAMP/feasibility.md`, each row `reports/STORY-REVAMP/feasibility/<id>.json`), of the pack's 91 missions outside the tutorial: 58 FEASIBLE, 22 red or waiting for a plane the player builds, 3 not flown yet on this sim (1 of them have a row from L40J, marked stale), 8 aircraft orders (not flights).
The feasible ones, by the aeroplane that flew them: 27 Piper Cub, 8 STOL Cub, 7 light metal Cessna with the STOL kit (test build), 4 PC-6 Turbo Porter, 4 Cessna 172 floats (career), 4 Jodel D112, 2 Cessna 172, 1 PA-18 on floats, 1 PC-6 on Wiplines.
Those, by cause:
- heritage.02: no official plane can carry it (300 kg into a 150 m strip): a STOL hauler the player builds - a named class, not flown
- lumber.02, lumber.04: water cargo over about 95 kg: the float Cessna's loading card takes 90 to 98 kg with the pilot alone, the Twin busher 15 kg, and the PC-6 on Wiplines (wip list), started at HOME as an amphibian, does not line up there - a float hauler the player builds, or that PC-6's taxi
- resort.03, clients.03: the altiport (tw_ski, 280 m on a 20 % grade), flown light: the Cub and the STOL Cub touch about 100 m in, stop off the strip's end on the slope and cannot taxi back; the Jodel alone goes on its back in the rollout (with a passenger it lands it: club.breakfast, resort.01, resort.guests). The built-in pack's own mission - the pilot's or the field's
- resort.05: two passengers to the altiport (tw_ski): with three aboard the STOL-kit Cessna goes around until its fuel is out and the PC-6 gives up in the flare - the altiport again, flown heavy; master's own GATE CONTRACTS names this mission red ("stage 0 is flyable by a validated design")
- obs.02: 200 kg and a passenger into the 210 m mountain strip: the STOL-kit Cessna lands there, its loading card takes 140 kg beside the passenger - a hauler the player builds
- obs.04, obs.07: two passengers into the 210 m mountain strip: with three aboard the test pilot will not go (the STOL-kit Cessna needs 277 m, the PC-6 246 m) - a three-seat STOL plane the player builds
- obs.06, obs.08, obs.09: 150 to 250 kg into the 210 m mountain strip: the STOL-kit Cessna lands there but its loading card takes 50 kg for that strip, and the PC-6 will not go (a 226 m landing run) - the observatory's hauler, a plane the player builds (the class named before any flight)
- clients.n2: no official plane can carry it (a 175 kg load with its long item): a named class, not flown
- home.06: no official plane can carry it (450 kg into the 383 m Cabin Strip): a STOL hauler the player builds - a named class, not flown
- home.08: Cabin Lake names no landing direction (the island's aerodrome record); its 150 kg is also over what a float plane of the pool loads
- home.10, home.11: Cabin Lake names no landing direction (the island's aerodrome record)
- home.13: 280 kg to the Cabin Strip: the capability rule says the Cessna's cabin takes 280 kg, its loading card takes 140 kg of it (flown with the pilot alone); the PC-6's card takes none - the rule against the card, or a hauler the player builds
- community.09, community.10, community.11: heavy cargo (300 kg and more): the Cessna's cabin takes 280 kg, and the loading cards of the PC-6 and the DC-3-alike take none - a hauler the player builds, or those two cards
- club.tour: the stop at w5 (Cannery Runway, 310 m, a 10 m obstacle 25 m from its end): the test pilot lands off the strip or cannot line up to leave - the listed pilot / field gap (on L40J the Cub flew the whole tour; on L40K the Cub and the Jodel land off the end, the STOL Cub lands and cannot taxi out)
AS FLOWN ON L40J (23 Nov, before the train changed the Cub, the Jodel and the Cessna): 26 flown, 24 feasible, 2 red - home.08 (Cabin Lake's landing direction) and lumber.04 (250 kg on water: no float plane of the pool carries it).
<!-- /feas-state -->

## Status for A0 (Mon 23 Nov, fifth note, 15:40 UTC) - story-8

- **`claude/ready/story-8`** = origin/master 56047b34e (L40K) + this branch (the merge 20c8f846f: source clean, the
  tree is master's plus this branch's own delta; HANDOVER = master's bytes + block 10 and 11; built files master's,
  byte for byte - the build leaves them unchanged). WHAT IT ADDS TO story-7: the harness's three corrections (the seat
  fill through the garage's door, a course entered on a base turn, a course left without a climb), two test builds
  (a Cessna with the STOL kit on the retired and on today's airframe), the pack's corrections (the tour's mirrored
  gates, the club contract's limit from the measured flight: 14 -> 20 min), a row's `sim` tag, `--tmax`, the rows
  and this file's handover section. No change under `src/` but `src/missions/story.json` (30 lines).
- GATES ON IT (the merged tree, this container): STORYPACK, TUTORWALK, MISSIONLIVE, BUILT, COMMITHYGIENE PASS;
  MISSIONFEAS PASS (427 s, run alone); CONTRACTS 4 red of 2 585, master's own four by name (minedock.02 / .03 and
  resort.05 "stage 0 is flyable by a validated design", "the C172 takes two into the mine street": L40K's note names
  them). Not run here: the full tier (TUTORFLY last passed at 89d00aa76, before L40J).
- THE ROWS START AGAIN ON L40K: the train builds the Cub, the Jodel, the Cessna 172 and the STOL Cub differently (36 of
  79 builds differ in def or shakedown, measured on both trees), so the 26 rows flown on L40J are stale. They read, on
  L40J: 24 feasible (the club's five events and its contract among them), 2 red (home.08: Cabin Lake's direction;
  lumber.04: 250 kg on water, no float plane of the pool carries it). The re-flight runs now, the club and the four
  projects first; rows are pushed to `claude/story-revamp` as they land (a later ready would differ from story-8 by
  report files only).
- THE HANDOVER is the section just below (what is done, how to run, what is left, the feasibility state).

## Status for A0 (Mon 23 Nov, fourth note, 10:50 UTC)

- THE FLIGHTS ON L40J's SIM, SO FAR: 17 flown, 16 feasible, 1 red (table: `reports/STORY-REVAMP/feasibility.md`).
  THE AERO CLUB'S FIVE SCORED EVENTS ARE ALL FLOWN start to end by the Piper Cub on the merged tree (the STOL event,
  the spot landing, the regularity run, the pylons, the multi-leg tour with its corrected gates and its two field
  stops); the club's sixth mission is a contract, in the next batch. The tour's third leg, which did not leave w5
  before the merge, flies on L40J.
- The one red is home.08 (a 150 kg job onto Cabin Lake): the gap already listed (the lane names no landing direction),
  flown again with three float planes - two break up on the closed final, the third lands long and its hold is 39 kg.
  The four other missions that land there will read the same until the island's record names the direction.
- The rest of the pack is in the air in batches of 14 (a tracked task dies at two hours here); rows are pushed as each
  batch ends. Nothing else changed since the third note: the story-fields ready and story-8's plan stand.

## Status for A0 (Mon 23 Nov, third note, 08:40 UTC)

- L40J IS MERGED INTO THIS BRANCH (e82422d65), and it is green on the story gates ONLY with commit 28ef278e5: master's
  merge `f9f813191` (one-cessna-4; inside it `7c30889ba`) took an OLDER `src/core/72_contract_data.js` for two
  CONTRACT_FIELDS lines - `xw_rough` gone from the table (AFB-0220, the user 13 Nov), `tw_ski` back at 257 / -7707 /
  380 m (SKYLINE-RESORT 146a752b7: 282 / -7751 / 280 m, what the world has). No message names either as meant; master's
  own GATE CONTRACTS is red on it by name ("the 17 runways", "wheels at xw_rough", "amphibian at xw_rough").
  **story-7 (784d85bfe) on L40K will be red on STORYPACK, TUTORWALK and MISSIONLIVE for this one cause** ("field
  xw_rough is not a field": the aero club's short-landing event lands there) unless the train carries the two lines.
  28ef278e5 is exactly those two lines as they were at L40H: take it, or the same edit.
  **A READY OF ITS OWN FOR L40K: `claude/ready/story-fields` 8b35f7672** = origin/master 089297693 + those two lines +
  its (built) commit, nothing else. Gates on it: BUILT, COMMITHYGIENE PASS; CONTRACTS 4 red of 2 549 (master: 8) - the
  four left are the refitted Cessna's, named below; NAMES red as on master ("Alaska" in livery_marks.js / aeroskin.js).
- Gates on the merged tree (95a4bc6c9 + harness commits): STORYPACK, TUTORWALK, MISSIONLIVE, BUILT, COMMITHYGIENE PASS;
  CONTRACTS red on four checks, all master's (the refitted Cessna: minedock.02 / .03 and resort.05 "flyable by a
  validated design", "the C172 takes two into the mine street"). MISSIONFEAS: PASS (438 s, run alone) with the
  harness's new entry / exit / seat fill.
- story-8 = this branch (a fresh ref `claude/ready/story-8`), for L40M, by Tue 07:00: the harness's three faults
  corrected, club.tour's gates, the rows re-flown on L40J's sim (the refitted Cessna is the career's `c172` now).
- THE USER'S FOUR LARGE MISSION STORIES ARE IN story-7 (since story-2): four projects of the pack - the remote community
  (8 steps), home improvement (7), the observatory (6), the heritage site (2) - with short draft words. Their VERBATIM
  text is not committed, on the user's own word (22 Nov, asked "commit the four stories verbatim?": "no").

## Where it stands

| ready | content | state |
|---|---|---|
| story-1 | THE RULES ON THE PACK: no drawn job, no drawn shady job, an unflyable mission offered, repeating authored contracts, a project step moves its world track and gives machinery; GATE STORYPACK | PUSHED `claude/ready/story-1` 2e319695c |
| story-2 | THE PACK'S OWN CLIENTS, FOUR PROJECT TRACKS, THE STORY PACK v0; a whole career walked in the gate | PUSHED `claude/ready/story-2` 2f9def0e8 |
| story-3 | THE TUTORIAL ON NODE (`tools/story_run.js`, GATE TUTORWALK core + TUTORFLY full); THE AERO CLUB (six events, the STOL / attitude samples wired on the page and in the rig, results kept on the career); THE MACHINERY GIVEN (the pack's start, kits given by projects, the career adopts its pack once) | PUSHED `claude/ready/story-3` 6c076ee23 |
| story-4 | THE SWITCH-OVER: a player's career reads the story pack with no flag (the career loader of both pages, app.js, the adoption at the load, the projects on the clock); the projects board's record; `mission_feas --official`; `tools/story_feas.js`; the HANDOVER entry | PUSHED `claude/ready/story-4` 7667a826b |
| story-5 | THE MISSION EDITOR: a row on the start menu, a way back, "Try it in the game", and the story pack's own structure editable (rules, clients, starting kits, projects and steps) | PUSHED `claude/ready/story-5` a02d9d81c |
| story-6 | story.json IS THE EDITOR'S: the file in the editor's save format, the generator deleted, GATE STORYPACK 9-13 as rules (never today's counts or names), a frozen copy of the pack for the mechanism rows | PUSHED `claude/ready/story-6` |
| story-7 | THE FIRST FLIGHTS READ: the harness lands a scored landing the way its line names; the pylons' bronze from the measured lap; `story_feas.js --again` and a flight's notes in its row; 12 rows kept as flown | PUSHED `claude/ready/story-7` 784d85bfe, on master with L40K |
| story-fields | master's merge had lost two CONTRACT_FIELDS lines (the short-landing lane, the altiport's length): restored | PUSHED `claude/ready/story-fields` 8b35f7672, on master with L40K |
| story-8 | L40K MERGED IN; the harness's seat fill, entry and exit; two STOL-kit test builds; the tour's gates and the club contract's limit corrected from the flights; a row knows its sim; this file's handover section | PUSHED `claude/ready/story-8` (the fifth status note has its gates) |
| feasibility | every mission of the story pack flown on node, one a process, each row kept (`tools/story_feas.js`); a row counts only on the sim it was flown on (the `sim` tag) | the state is kept in the handover section above ("The feasibility state"): 26 flown on L40J (24 feasible, 2 red), all flown again on L40K |
| the tutorial flown | `node tools/story_run.js`: 8 beats, 4 flights + the job's 2, 3 753 s flown. GATE TUTORFLY at 89d00aa76 with the story pack in use and adopted from the career's birth: PASS, 19 of 19 checks (49 min) | flown twice, the same times |

## The rules this work is held to

| rule | how it is held |
|---|---|
| no generated jobs | the pack states `rules.jobs: 'none'`; GATE STORYPACK 3 and 10: three careers with three seeds see one board at every step of a whole career, no `job:` / `shady:` id ever |
| contracts in any order | GATE STORYPACK 9: every chapter of every campaign is any-order, no provider holds an arc |
| projects = ordered steps tied to a site | GATE STORYPACK 9 and 11: every step has a mission and a site that is an aerodrome; a step's missions are on the board only while the project stands at it |
| the sandbox = the final stage | GATE STORYPACK 5 and 12: no career = every track at its max; the story's end reaches the max of every track a project builds |
| every mission flown on node | `tools/mission_feas.js` over `story.json`; the table lands with the ready that carries it |
| the tutorial playable start to end on node | `tools/story_run.js`: the eight beats with the page's events, the four flights flown, the end held to the checkpoint |
| no rendering / performance work | nothing here adds a shader program or load-time work; the pack is fetched only by a career that names it |

## The story pack (structure)

`src/missions/story.json`: THE USER'S FILE, edited in the mission editor (welcome menu > Mission editor > "Open story
pack"; Save writes the file, which replaces `src/missions/story.json`). The script that wrote its first version is
retired (22 Nov, on the user's word). The numbers below are the pack as handed over; GATE STORYPACK prints today's.

- 91 missions: 74 contracts, 8 aircraft orders, 3 surveys, 6 challenges. 30 kept from the built-in pack by id, 61 new.
- 34 contracts in any order across 6 clients; 57 missions are steps of projects; 8 missions repeat (4 clients' regular
  work + 4 club events).
- 8 clients: the game's five + 3 the pack brings (home, community, the Aero Club).
- Words: 156 text keys, every one marked a draft.
- The start: both of the career's hangars begin without the metal shop and the wood shop. Nothing is bought.

| project | client | site | steps | missions | world track | gives | opens after |
|---|---|---|---|---|---|---|---|
| the old wartime hangar | field | HOME | 3 | 5 | field 1-3 | the metal shop, segment 2 | - |
| the old mine | minedock | mn_strip | 4 | 4 | minedock 1-2 | - | - |
| the harbour | minedock | SEA | 2 | 2 | minedock 3-4 | - | the old mine |
| the lumber camp | minedock | mk_sea | 3 | 4 | lumber 1-3 | - | the harbour |
| Skyline in summer | resort | tw_ski | 3 | 4 | resort 1-3 | - | - |
| the totem site | field | nv_strip | 2 | 2 | heritage 1-2 | - | - |
| the observatory | survey | mt_strip | 6 | 9 | observatory 1-3 | segment 3 | the old hangar |
| home improvement | home | w1, cb_sea | 7 | 14 | home 1-6 | the wood shop, the home hangar | - |
| the community's runway | community | w6, w7 | 8 | 11 | community 1-7 | - | - |
| the club house | Aero Club | HOME | 2 | 2 | clients 1-2 | - | - |

The Aero Club's events (all on the existing scoring, 73c):

| event | kind | where | scored on | repeats | rival (fixed ghost) |
|---|---|---|---|---|---|
| the short landing | STOL landing | the rough strip 02R/20L | metres from the line to the stop; short = foul | yes | yes |
| the spot landing | STOL spot | the concrete band of 02/20 | metres from the line at the first touch | yes | - |
| the pylons | a timed lap, 4 gates | round the field | seconds, +3 s a pylon touched | yes | yes |
| the regularity run | a lap to MATCH | 2 gates 4 km apart | seconds off the target | yes | - |
| the island tour | a 3-leg course | field > Fishing Village > Cannery > field | the sum of three laps | once (club house step) | yes |
| the flying breakfast | a timed gathering | field > Skyline | arrive inside the limit | once (club house step) | - |

The walk of GATE STORYPACK (a whole career, every offer done in turn, the projects ticked a day apart): 91 of 91
missions done, 10 of 10 projects done, 40 of 40 steps reached in order, every world stage unlocked once, EVERY track at
its max at the end (the sandbox's world), EVERY aerodrome of the island used, the same career for three seeds. It found
one authoring error (two projects sharing a track out of order: fixed) and one mission that can never be offered (the
6 g order: no aerobatic certificate; left out, listed below).

## The ladder (a proposal: three lines of the pack)

| what | given by | when |
|---|---|---|
| the machine shop's segment 1 (tube, wood and fabric) | the start | - |
| the metal shop (kit) + segment 2 (sheets and bolts) | the old wartime hangar | its last step |
| the wood shop (kit) | home improvement | the new cabin |
| segment 3 (composite and electronics) | the observatory | its last step |

The mechanism is gated (GATE STORYPACK 15); WHO gives WHAT is the user's and Game's call. The user's two rulings it
encodes: "Old hangar -> metal shop", "Start = tube and fabric (not woodworking)".

## The switch-over

A career of the welcome menu reads the story pack with no flag: the career loader of the built page names it and
fetches it beside the career core; the page keeps its text for a start with no network; the career adopts it once.
The dev career (`?career=1`), `?map=1` and the sandbox never ask for a pack: every gate's fixture career keeps the
built-in tables, and the sandbox is the game as it is. `?pack=<id>` still wins. GATE STORYPACK 17 runs the built
page's loader as written over eight ways in.

A career saved before the switch keeps what the story pack still holds; an accepted mission it no longer holds is
dropped at the adoption and said in the console; an accepted drawn job is kept as it was offered and can be finished.

## Who can fly what (the capability rule, before any flight)

| class | missions |
|---|---|
| a validated design flies it (Cub, Jodel, Cessna 172, Cessna 172 on floats) | 69 |
| an aircraft order (the player builds it) | 8 |
| a delivery NO validated design can fly: offered all the same, the player builds the aeroplane | 14 |

The 14: the totem site's two (150 m strip; 300 kg in one 3 m piece), six of the observatory's (a loaded ski plane off
210 m of snow), the digger (450 kg), four of the community's (4 passengers; 300-400 kg), the night stretcher.

## The tutorial on node

`node tools/story_run.js --dry` (GATE TUTORWALK, core): T0 -> T7 in order with the story pack in use and adopted at the
career's birth; the effects applied (the hangar, the client's Cub, the gift, the checkpoint); both builds' rows all open
on the start file and all met on the target (5 + 4); the end = the checkpoint (17 July, 12 000, the one seed) = the
state of "New career, no tutorial"; then the board: the pack's, none drawn.

`node tools/story_run.js` (GATE TUTORFLY, full), flown on e5df77487: PASS.

| beat | flight | aeroplane | from > to | flown |
|---|---|---|---|---|
| T1 | the move | the starter | cabin strip (w1) > the field (HOME) | 1 132 s |
| T4 | the delivery | the client's Cub, upgraded | HOME > the owner's strip (w6) | 1 201 s |
| T6 | the one job, its load aboard | the same Cub | HOME > w3 > HOME (2 flights, the career's stops) | 1 062 s |
| T7 | the floats | the Cub on floats | the seaplane base (SEA) > SEA | 358 s |

Every one boarded, started, taxied, took off, flew, landed and stopped where the beat asks. Total 3 753 s.
What node does NOT run: the bench's structural tests (the page's); the design check's two certificate tiers are read
instead (neither target fails the airworthiness tier) and stand in for the bench's signature.
The walk with the pack in use found a bug of the switch-over: the tutorial's one job sat second on a board whose
contracts come in any order; it leads it again.

## The flights so far (22 of 83 flown missions have a row; 8 more are aircraft orders, not flights)

THE POOL (the user, 23 Nov: "you can really try any of the official planes. If it works with the PC6 or the DC3, it's
OK ... maybe you can even build a quick one to clear these. The players will not be limited to existing planes"): a
mission is flown by the career's designs first, then every official plane, the PC-6 (wip list rows 57 / 58) and a test
build, the shortest take-off first, three aeroplanes at most; a row keeps EVERY aeroplane tried with its legs and the
pilot's own words (`attempts`). `node tools/story_feas.js --fly [--only=a,b --again]`, then `--table`.

What 23 Nov's rows taught, each read from its row:

| found | what the row said | what was wrong | state |
|---|---|---|---|
| the seat fill did not take | "flown with 2 aboard" in the notes, and the stop: "aboard 0 pax, the job is 1 pax" - on five missions | MY HARNESS: it wrote the filled seats into the build FILE, and the load door rebuilds the cabin from the design. It fills them now by the garage's own door (the spec the game flies, pilots 1, pax n - 1) | corrected; mine.04 (the PC-6, two aboard), field.ridge and heritage.01 (the STOL Cub) re-flown: FEASIBLE |
| a course's entry | club.regular: the Jodel turned back 2 km short of the entry point and joined the axis past the first gate (216 m wide) | MY HARNESS: out of a field ahead of the entry the turn onto the axis is 160 deg. A base turn on the field's side now, its corner about a right angle | corrected; club.regular flown by the Jodel: both gates within 7 m, FEASIBLE |
| a course's exit | club.tour's second leg: both gates crossed at 373 and 498 m (150 at most) | MY HARNESS: the pilot's planner looks 1500 m past a leg's end and moves a climb earlier; the run-out pointed at the hills east of the strip (519 m asked). The run-out is chosen on the planner's own measure now (none there) | corrected; flown by the Cub: 115 and 143 m |
| the Cub at w5 (Cannery Runway) | club.tour's third leg never leaves: "rejected take-off: will not reach Vr", after "off-the-strip: touched 187 m in, stopped 72 m past the end of 310 m" | NOT THE MISSION'S: `reports/STORY-REVAMP/repro/cub_w5_back.json` (plain HOME > w5 > leg back, no mission) ends the same - the pilot aims 144 m in over a 10 m obstacle 25 m before the threshold, runs off the end, and on the line-up back the propeller is in the water. From w5's stand (`cub_w5_stand.json`) the Cub flies home | the pilot's / the field's: listed under Gaps. club.tour stays red on it; being flown with w5 landed each way |
| the PC-6 (wip list) | flew passenger jobs "with 0 pax" | the same seat fill (it has 8 seats); its FREIGHT card is another matter (no door named: carries no cargo as built) | passengers: fine. Cargo: listed under Gaps |

THE CAREER'S CESSNA CHANGES UNDER THESE ROWS: master L40J makes list:50 (the refitted 172: 1 006 kg, take-off 357 m) the
career's `c172`. Rows flown with the light metal Cessna (and the STOL-kit test build made from it) are flown again on
the merged tree; a first STOL kit on list:50 measures Vs 25.8 > 21.5 m/s and the take-off run 414 > 260 m.

### The first twelve (22 Nov)

Every row is kept AS FLOWN (`reports/STORY-REVAMP/feasibility/<id>.json`); none is re-pinned or dropped. Nine missions
are feasible (hangar.01, home.01, obs.01, community.02 and the club's three in the Cub; community.01 in the Cessna 172; lumber.01 on floats). Five were not, read one by one
with the harness's whole leg record (`phases`, the pilot's own verdicts, the landing):

| mission | the flight | what the trace says | whose |
|---|---|---|---|
| mine.04 | HOME > mn_strip, 2 passengers, the Cessna 172: on its back in the flare at 780 s | the pilot says "250 m of strip for a 249 m landing run - no margin", raises its approach speed (the elevator on its stop), slips on the short final, the aileron goes to its stop against 15 deg of bank, capsized | MASTER'S: the built-in pack's `minedock.02` is the same flight and ends the same way, to the second, on a plain origin/master worktree (9349a62c) |
| home.03 | w3 > w1 (the Cabin Strip, 383 m), 250 kg, the Cessna 172: broke up on the second leg | the same aeroplane, the same end of a landing | the same cause as above (not re-flown on master: no built-in mission lands the Cessna on w1) |
| home.08 | SEA > cb_sea (Cabin Lake), 150 kg, the Cessna on floats: on its back on the final at 550 s | the lake (103 m) lies between ridges: 190 m over the water 750 m beyond its north-east end, 115 m at 1 km beyond the south-west end. The pilot picks the north-east final, is 99 to 223 m over the slope, slips, capsizes | A DATUM OF THE LAKE: with the landing direction forced the other way (the lane's `approach: 0`) the same flight LANDS - two go-arounds, 1 278 s, touched 844 m in, stopped with 98 m of lane left. With `approach: 1` it is the crash above, to the tenth of a second |
| club.pylons | HOME > the four gates > HOME: landed with no medal | the Cub flies the four gates (each passed within 6 m of its middle, 100 m up); its lap is 215.9 s and the bronze time was 215 s - a guess, 0.9 s under the slowest validated aeroplane | MINE, CORRECTED: bronze and the target 250 s (gold 130 and silver 165 as they were). Re-flown: FEASIBLE, 942 s. (The second aeroplane tried, the Jodel, passed 68.5 m from gate 1's middle - 8.5 m outside its post - on the harness's 600 m lead-in out of the climb, so nothing after it counted: a faster aeroplane needs a longer run-in to the first gate than the harness draws. Listed, not chased: the event is flown by the Cub) |
| club.spot | HOME > w2, the spot 300 m in: "the sp spot was not measured" | 73c measures a touchdown only when it runs the line's `dir`, and every line of the stop must be measured; the pilot took the wind's end of w2 and landed the other way (touched 397 m in from the far end) | MINE, CORRECTED IN THE HARNESS: a competitor lands the line's way, so for that flight the field's record names it (`mission_feas_lib.js`; the row says so). Re-flown: FEASIBLE, 95.3 m from the spot (bronze); club.stol the same 197.8 m. On the page it is the player who lands it: the brief must say which way (words: the story's writer) |

What follows from the three that are read:

- THE CESSNA 172 OUT OF A SLIP. 43_pilot.js already carries WINGS-LEVEL (16 Nov: "the refit Cessna ... capsized in
  tw_ski's flare"). The same end is flown here at three more places (mn_strip's flare, w1, Cabin Lake's final). It is
  the pilot's and that airframe's, not a mission's: the pilot's owner has three deterministic cases
  (`node tools/mission_feas.js --only=minedock.02` on master; `--only=mine.04` and `--only=home.03 --packs=src/missions`
  here). Every mission whose load only the Cessna carries into a short strip will read infeasible until then: the table
  says so row by row, it is not hidden.
- CABIN LAKE IS A ONE-WAY LANE. Five missions land there (home.08 to home.12: the lake dock's two steps); no mission
  flew there before (72_contract_data.js: "no job flies there yet"). The island's record for `cb_sea` names no
  `approach`; `approach: 0` (landed towards the north-east, over the lower south-west ridge) makes it landable by the
  test pilot. The way OUT is not flown yet (a `departure` over the south-west end is the open slope: 50 m over the
  water 250 m out, against 190 m at 750 m the other way). The island is the user's document: listed, not edited here.

## The mission editor

Where: the start menu's "Mission editor" row (new), or `flyDiy/tools/mission_editor.html`. A light page: the game is not
loaded. "<- The game" brings back; "Try it in the game" opens a new tab on the TEST career playing the pack being
written (never a player's own career).

| it could already | it can now |
|---|---|
| a tree: campaign > chapter > mission > leg > step | + projects > steps > their missions |
| a mission's form with labelled fields, the in-game card's preview, the island map to pick places, the game's own validator | + "Comes back" (after n others), "After these projects", "It gives" |
| open the built-in pack or a file, save a file | + open the story pack (one button), try the draft in the game |
| - | the pack's own form: how the job board is filled (three plain choices), the clients it brings, what a career starts without, its projects |
| - | a client's form: name, short name, face, airfields, track, colour |
| - | a step's form: its missions, the days and cost of its works, where, what it builds (a stage, by its caption), what it gives |

Checked by driving it in a headless browser (not a gate): the forms above, an edit kept in the draft, the pack still
checking out, no page error; then "Try it in the game": the game's page on the test career, pack story in use, 91
missions, the project renamed in the editor showing that name.
A bug fixed on the way: `?pack=draft` handed the game the editor's draft WRAPPER ({ file, pack }), never a pack, so a
draft could not be tried at all.

NOT in the editor yet (listed, not hidden): the competition fields (a STOL line, a regularity lap, a course, a ghost) are
edited through "Advanced: the raw JSON" only; the pack's text for a client's short name is edited, its portrait is
picked among the existing faces only.

WHO OWNS story.json: THE EDITOR (the user 22 Nov: "Yes"). The file is in the editor's own save format (GATE STORYPACK
9: opened and saved untouched, not a byte moves), `tools/_story_pack.js` is deleted, and the gate holds the file to
RULES, never to today's content:

| rule any edit must keep | check |
|---|---|
| the pack validates; it is as the editor saves it | 9 |
| no drawn job | 9 |
| every mission is a contract of an any-order chapter or a step of exactly one project | 9 |
| every project has a step; every step has a mission and a site that is an aerodrome | 9 |
| the tutorial's one job is in the pack | 9 |
| a whole career walked to its end: every mission done, every project done, the same career for three seeds | 10 |
| every step reached in its order | 11 |
| every track a project builds ends at its max (a track no project finishes is printed, not failed) | 12 |
| every kit the start takes out of a hangar is given back by the end | 12 |
| every aerodrome of the island is used | 13 |
| every scored mission (a lap, a STOL line, a course) is one the runtime runs | 13 |

The mechanisms that need content of known shape (the Aero Club's six events, the start and the machinery, the board's
record: 14-16, and GATE MISSIONLIVE's short landing) read a FROZEN copy of the pack as handed over
(`tools/fixtures/storypack/story_v0.json`), so editing the story never turns them red. TUTORWALK's "hangar as the start
left it" row reads the pack's own start. One invented prerequisite went with the hand-over: the totem site no longer
waits for the old mine.

## Baseline and reds (origin/master 9349a62c, this container)

Master's own reds, by check name, the same text on a plain master worktree: STAGES (19, "7 [...] the editor's save
restores the whole record"), MEDIA ("media/thumbs/index.json references ... cand_cub_fittings_hand_2026-10.webp"),
NAMES (4, "Alaska" in aeroskin.js / livery_marks.js), LAZY (1, "default: the door's first demand (ROUTE_DRAW.ready)").
Story-1 on 888b545aa: 20 gates PASS (CLOCK UISMOKE GAMEPREM DMGPOD CONTRACTS MISSIONS PROJECTS STORYPACK MISSIONPROPS
MISSIONLIVE STORY TUTORLOCK ROUTES TECH ECON PRICE PROCURE FREIGHT PILOTS BUILT) + COMMITHYGIENE; no red of its own.
Re-pin: GATE CONTRACTS' track list and a new career's tracks (the four project tracks), its own commit 241ec63da.

| ready | gated on | PASS | red, master's own by check name | notes |
|---|---|---|---|---|
| story-1 | 888b545aa | CLOCK UISMOKE GAMEPREM DMGPOD CONTRACTS MISSIONS PROJECTS STORYPACK MISSIONPROPS MISSIONLIVE STORY TUTORLOCK ROUTES TECH ECON PRICE PROCURE FREIGHT PILOTS BUILT COMMITHYGIENE | STAGES MEDIA NAMES LAZY | - |
| story-2 | b4e88a9ff | the same + MAPBAKE PREMISES PLAYER SNAPSHOTS | STAGES MEDIA NAMES LAZY SAVE ACCEPT | STAGES counts 37 not 19: master's red check is listed once a track value, and there are 18 more values |
| story-3 | abe740cc3 | CLOCK UISMOKE UISMOKE-PHONE PLAYER GAMEPREM CONTRACTS MISSIONS PROJECTS STORYPACK TUTORWALK MISSIONPROPS MISSIONLIVE MISSIONFEAS STORY TUTORLOCK ROUTES TECH ECON PRICE PROCURE FREIGHT PILOTS BUILT COMMITHYGIENE | GFX MEDIA NAMES LAZY | MISSIONFEAS timed out inside the loaded battery (not a verdict), PASS alone in 11 min 47 s |
| story-4 | 079de68d7, then 48d6a4850 | CLOCK PLAYER GAMEPREM CONTRACTS MISSIONS PROJECTS STORYPACK TUTORWALK MISSIONPROPS MISSIONLIVE MISSIONFEAS STORY TUTORLOCK ROUTES TECH ECON PRICE PROCURE FREIGHT PILOTS BUILT UISMOKE UISMOKE-PHONE COMMITHYGIENE | GFX MEDIA SAVE NAMES LAZY | UISMOKE and UISMOKE-PHONE were RED of this work on 079de68d7 (two career calls on lines without the career guard): fixed in source (48d6a4850), both green after |
| story-5 | e393772a6 | UISMOKE UISMOKE-PHONE CONTRACTS MISSIONS PROJECTS STORYPACK TUTORWALK MISSIONLIVE STORY TUTORLOCK BUILT COMMITHYGIENE | GFX NAMES | the editor itself is driven in a headless browser (not a gate) |
| story-6 | 585cc4465 | UISMOKE UISMOKE-PHONE COMMITHYGIENE CONTRACTS MISSIONS PROJECTS STORYPACK TUTORWALK MISSIONLIVE STORY TUTORLOCK BUILT (12 of 12 PASS, a clean worktree at the commit) | none | story.json to the editor; no built file moved |
| story-7 | b6ae7fb49 | MISSIONFEAS (634 s, the main flights paused for it) STORYPACK TUTORWALK MISSIONLIVE BUILT COMMITHYGIENE (6 of 6 PASS, a clean worktree at the commit) | none | the harness's landing way; no built file moved |

Master's reds added to the list above since: GFX ("no device test outside welcome.js ...: src/viewer/perf_bench.js 1 > 0"),
SAVE (2, "lost 1: skiPos"), ACCEPT (1, "app.js: the leg ticked and signed beside the HUD": `ctlStrip()` now sits between
`hudGear()` and `ACCEPT_REC.frame()`). Not run here: the GPU gates (FRAMECOST, PROGRAMS, ...) and the full battery: A0's
train. The page's switch-over was booted three ways in headless Chromium on SwiftShader (a new career with its tutorial,
a new career without, the dev career): no page error; the first two on the story pack, the third on the built-in
tables.

## Gaps (listed, not invented)

| gap | kind | found by |
|---|---|---|
| no scenery element wears the tracks home, community, heritage, lumber: 18 of the 31 world stages change nothing in the world yet (their reveals say `world: false`) | scenery to author (the final state in the sandbox, bands per stage) | the pack's tracks |
| the community strip's staged scenery (`claude/ready/community-airport`, 13 Nov: 3 stages) is not on master (15 commits, 1 072 behind) and predates the backbone story (7 stages: 200 m, 400 m, graded, 1 km, tower, hangar, terminal) | scenery ready to re-land and re-cut | the read of the branches |
| the docks and the sea lodge (`claude/ready/docks-lodge`, 13 Nov) are not on master (17 commits, 969 behind): no lodge project in the pack | scenery ready to re-land | the read of the branches |
| the observatory's wider snow strip (its last step) has no staged variant on mt_strip; the step counts, nothing changes | scenery | the backbone story |
| the lumber camp flies to Cedar Harbour's lane: the new lane north of it does not exist | scenery | the 16 Nov note |
| a step that waits for a clear day (the observatory's first rounds): no rule reads the weather | mission rule | the backbone story |
| no PC-6, no ski hauler, no 5-seater, no 450 kg hauler on the official plane list: 14 missions wait for a plane the player builds | planes | the capability table |
| no aerobatic plane on the official list (the 6 g order is out of the pack); L40K lands the LS4-alike and the Archaeopteryx-alike (reproduction list), a winch and a van tow, and no club event is authored on them yet | missions to author (the club's glider and tow events) | plane_lists.json at L40K |
| Cabin Lake (`cb_sea`) names no landing direction: the test pilot takes the closed end and capsizes; `approach: 0` on the lane lands it (flown). Its way out is not flown | the island's aerodrome record | the feasibility flight of home.08, three times |
| the Cessna 172 capsizes out of its slip on a short final (mn_strip, w1; master's own `minedock.02` the same) | the pilot (43_pilot.js, WINGS-LEVEL's family) | the feasibility flights of mine.04 and home.03, and master's baseline |
| a landing at w5 (Cannery Runway) on the game's day runs off the strip's end, and the leg back never leaves (the Cub; the STOL Cub rejects its take-off there too) | the pilot (43_pilot.js: the end it picks has a 10 m obstacle 25 m out, the aim is displaced 144 m into 310 m) or the field's record | `node tools/flight_script.js reports/STORY-REVAMP/repro/cub_w5_back.json` (no mission in it) | ON L40J club.tour flew its w5 stop and left again (the Cub, 2 139 s); the scripted repro was not run again |
| THE CAPABILITY RULE AGAINST THE LOADING CARD: `contractCanDo` counts the Cessna's cabin at 280 kg; the loading view puts 140 kg aboard (50 kg for the 210 m mountain strip), and the PC-6's and the DC-3-alike's cards take no cargo. The board offers jobs the card then refuses | the rule (73_contracts.js ctCapKg) or the cards; the pack's draft loads | the flights of home.13, community.09 / .10 / .11, obs.02 / .06 / .08 / .09 |
| the altiport (tw_ski) flown light or heavy: the test pilot lands long and cannot taxi back, or never gets down (the built-in pack's resort.03, resort.05, resort.b2, clients.03 among them); with one passenger the Jodel lands it | the pilot (43_pilot.js) or the field's record | the flights on L40K |
| water cargo over about 100 kg: the float Cessna's loading card takes 98 kg while the capability rule says it can do 250; the PC-6 on Wiplines (wip list), started at HOME as an amphibian, does not line up there | planes (a float hauler the player builds); the capability rule against the loading card; the PC-6 on Wiplines' taxi | the feasibility flights of lumber.04 and home.08 |
| the PC-6 Turbo Porter of the wip list carries no cargo: its loading card names no door and no seat row (passengers ride: 8 seats) | the PC-6 build (the drafting table's) | the feasibility flights of the cargo missions |
| master L40J: `xw_rough` out of CONTRACT_FIELDS and `tw_ski` back at 380 m, by a merge (see the status at the top) | master's (the train) | the trial merge; master's own GATE CONTRACTS |
| the two clients the pack brings wear stand-in faces (home: sophie; community: james) | portraits | 72_people.js |
| a project's works cost nothing but at home (0 everywhere else); home's missions pay nothing | economy pass (ready 5) | the pack |
| the machinery pop-up animation and the reveal's panning shot | local GPU work | out of scope here |
| the Projects board on the page (the steps, the works running) | page work (Game); its record exists: `careerProjectsBoard` | app.js shows project lines on the arrival card only |
| a "restart this flight" on the page (the free restart of every flight) | page work | a crash resets the aeroplane, free; no voluntary restart |
| the full feasibility table: the sim flies at about the game's speed, the whole pack is ~40 hours of one core | box time (`node tools/story_feas.js --fly --workers=N`, then `--table`; `--check` becomes GATE STORYFEAS when no row is missing) | the flights |
| 8 deliveries no OFFICIAL plane can fly: the totem (300 kg into 150 m), the digger (450 kg into 383 m), six of the observatory's (a loaded ski plane off 210 m of snow) | planes the player builds: a STOL hauler, a ski hauler | `mission_feas --official` |
