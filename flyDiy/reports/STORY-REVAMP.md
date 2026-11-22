# STORY-REVAMP - progress (structure only)

Cloud session [CLOUD] STORY-REVAMP, branch `claude/story-revamp` (base `origin/master` 9349a62c = train L40H).
Readies: `claude/ready/story-<n>`, each with its gate results. This file shows STRUCTURE (counts, steps, systems, what
is wired, what is tested). It carries no dialogue and no twists.

Inputs read: CLAUDE.md, HANDOVER (ritual, files, gates), `origin/claude/story-revamp-inputs`
(`flyDiy/reports/story-revamp-inputs/`, five notes, 13-17 Nov), and the user's four backbone stories for the large
missions (22 Nov, handed to this session: the remote community, home improvement, the observatory, the cultural
heritage site). Where a backbone story and an older note disagree, the backbone story wins (the user, 22 Nov).

## Where it stands

| ready | content | state |
|---|---|---|
| story-1 | THE RULES ON THE PACK: no drawn job, no drawn shady job, an unflyable mission offered, repeating authored contracts, a project step moves its world track and gives machinery; GATE STORYPACK | PUSHED `claude/ready/story-1` 2e319695c |
| story-2 | THE PACK'S OWN CLIENTS, FOUR PROJECT TRACKS, THE STORY PACK v0; a whole career walked in the gate | PUSHED `claude/ready/story-2` 2f9def0e8 |
| story-3 | THE TUTORIAL ON NODE (`tools/story_run.js`, GATE TUTORWALK core + TUTORFLY full); THE AERO CLUB (six events, the STOL / attitude samples wired on the page and in the rig, results kept on the career); THE MACHINERY GIVEN (the pack's start, kits given by projects, the career adopts its pack once) | on the branch (abe740cc3), gates running |
| story-4 | THE SWITCH-OVER: a player's career reads the story pack with no flag (the career loader, app.js, the adoption at the load, the projects on the clock); the projects board's record | coded, gated in node (GATE STORYPACK 16-17), a headless browser boot running |
| feasibility | every mission of the story pack flown on node (`tools/mission_feas.js`, 3 shards) | running in the background |
| the tutorial flown | `node tools/story_run.js` (4 flights + the job's 2) | running in the background |

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

`src/missions/story.json`, written by `tools/_story_pack.js` (`--table` prints this, `--check` is in the gate).

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
| the totem site | field | nv_strip | 2 | 2 | heritage 1-2 | - | the old mine |
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

## The ladder (a proposal: three lines of the generator)

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

`node tools/story_run.js --dry`: T0 -> T7 in order, the effects applied (the hangar, the client's Cub, the gift, the
checkpoint); both builds' rows all open on the start file and all met on the target (5 + 4); the end = the checkpoint
(17 July, 12 000, the one seed) = the state of "New career, no tutorial"; then the story pack's board: 28 missions,
none drawn, 5 projects open. The flown run (4 flights + the job's 2) is running; its table lands here.

## Baseline and reds (origin/master 9349a62c, this container)

Master's own reds, by check name, the same text on a plain master worktree: STAGES (19, "7 [...] the editor's save
restores the whole record"), MEDIA ("media/thumbs/index.json references ... cand_cub_fittings_hand_2026-10.webp"),
NAMES (4, "Alaska" in aeroskin.js / livery_marks.js), LAZY (1, "default: the door's first demand (ROUTE_DRAW.ready)").
Story-1 on 888b545aa: 20 gates PASS (CLOCK UISMOKE GAMEPREM DMGPOD CONTRACTS MISSIONS PROJECTS STORYPACK MISSIONPROPS
MISSIONLIVE STORY TUTORLOCK ROUTES TECH ECON PRICE PROCURE FREIGHT PILOTS BUILT) + COMMITHYGIENE; no red of its own.
Re-pin: GATE CONTRACTS' track list and a new career's tracks (the four project tracks), its own commit 241ec63da.

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
| no glider, no aerobatic plane on the official list; the 6 g order is out of the pack | planes | plane_lists.json |
| the two clients the pack brings wear stand-in faces (home: sophie; community: james) | portraits | 72_people.js |
| a project's works cost nothing but at home (0 everywhere else); home's missions pay nothing | economy pass (ready 5) | the pack |
| the machinery pop-up animation and the reveal's panning shot | local GPU work | out of scope here |
| the Projects board on the page (the steps, the works running) | page work, after the flip | app.js shows project lines on the arrival card only |
