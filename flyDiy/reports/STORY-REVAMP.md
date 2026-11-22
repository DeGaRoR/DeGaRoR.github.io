# STORY-REVAMP - progress (structure only)

Cloud session [CLOUD] STORY-REVAMP, branch `claude/story-revamp` (base `origin/master` 9349a62c = train L40H).
Readies: `claude/ready/story-<n>`, each with its gate results. This file shows STRUCTURE (counts, steps, systems, what
is wired, what is tested). It carries no dialogue and no twists.

Inputs read: CLAUDE.md, HANDOVER (ritual, files, gates), `origin/claude/story-revamp-inputs`
(`flyDiy/reports/story-revamp-inputs/`, five notes, 13-17 Nov), and the user's four backbone stories for the large
missions (22 Nov, handed to this session: the remote community, home improvement, the observatory, the cultural
heritage site). Where a backbone story and an older note disagree, the backbone story wins (the user, 22 Nov).

## The rules this work is held to

| rule | how it is held |
|---|---|
| no generated jobs | the pack states `rules.jobs: 'none'`; GATE STORYPACK: two careers with different seeds get the same offers |
| contracts in any order | a pack contract sits in an any-order chapter; only its own `needs` gate it |
| projects = ordered steps tied to a site | a project declares its steps; a step names its missions, its works, its site, its world stage |
| the sandbox = the final stage | no career = every track at its max (76_stages); a story stage = the final state minus removals |
| every mission flown on node | tools/mission_feas.js over the story pack; the table is committed with each ready |
| the tutorial playable start to end on node | a node walk of the beats with the flights flown (ready story-3) |
| no rendering / performance work | nothing here adds a shader program or load-time work; reveals that need any are listed below |

## What master already holds (found, not rebuilt)

| piece | where | state on master |
|---|---|---|
| the mission pack format, validator, install | 73b_missions.js, GATE MISSIONS | landed; 43 missions in the built-in pack (35 retrofitted contracts + 8 tutorial listings) |
| the pack loader | missionPackUse, `?pack=<id>` | landed, DEV ONLY (a career without the flag reads the built-in tables) |
| the project node | pack.projects, careerProjectsTick, GATE PROJECTS | landed; no project authored in any pack |
| the mission runtime (timers, rules, gates, rings, STOL, courses, ghosts) | 73c_mission_run.js | landed, gated on tiny fixtures; no competition authored |
| the in-flight tracker and drawn gates | MISSIONS-LIVE, GATE MISSIONLIVE | landed |
| the feasibility harness | tools/mission_feas.js, GATE MISSIONFEAS | landed; never run over a whole pack on master |
| the flight-script runner | tools/flight_script.js, GATE FLIGHTSCRIPT | landed; 12 scenarios |
| tutorial v2 (beats T0-T7, checkpoint, skip, exact-build rows) | 79_story.js, GATE STORY, GATE TUTORLOCK | landed; no node run of the whole tutorial with its flights |
| the staged world (tracks, bands, the sandbox at max) | 76_stages.js, 27_premises `stage`, GATE STAGES | landed; 6 tracks, 53 staged elements |
| the workshop mask (3 segments) and the hangar kits (10) | 79b_tech.js, 26_hangar_fit.js | landed; nothing in play opens a segment or gives a kit |

## What the career still does that the rulings forbid (the switch-over's list)

1. Generated jobs: `careerOfferIds` draws `contractJobs(seed, ...)` for every provider at every refresh.
2. A generated "no questions asked" job from the second refresh on.
3. The authored contracts are offered as five ARCS (one at a time, in order), not in any order.
4. Projects exist only as a node; a step does not move the world's stage and gives no machinery.
5. The pack is installed only behind `?pack=`.

## The readies

| ready | content | state |
|---|---|---|
| story-1 | THE RULES ON THE PACK: `rules.jobs: 'none'` (no generated job, no generated shady job), repeating authored contracts, a project step moves its world track and gives machinery (abilities), GATE STORYPACK | in progress |
| story-2 | THE STORY PACK v0 (`src/missions/story.json`): clients, contracts in any order, the projects as steps (home improvement first), draft words only; feasibility table | queued |
| story-3 | THE TUTORIAL ON NODE: T0 to the end checkpoint walked with its flights flown | queued |
| story-4 | THE AERO CLUB: the competition events on the existing scoring (STOL, spot landing, gates, multi-leg, regularity, gliders) | queued |
| story-5 | WORKSHOPS AND THE LADDER: machinery given by contracts and projects, no buying | queued |
| story-6 | THE FLIP: a career reads the story pack by default (for Game's review; touches the page) | queued |

## Baseline (origin/master 9349a62c, this container)

Gates run before any change: GAMEPREM CONTRACTS MISSIONS PROJECTS MISSIONPROPS MISSIONLIVE STORY TUTORLOCK ROUTES TECH
ECON PILOTS = PASS. STAGES = FAIL (19, all "7 [...] the editor's save restores the whole record"): master's own red.

## Gaps (listed, not invented)

Filled in as each ready finds them: see the section at the end of every ready's note.

| gap | kind | found by |
|---|---|---|
| the community strip's staged scenery (`claude/ready/community-airport`, 13 Nov) is not on master (15 commits, 1 072 behind) | scenery ready to re-land | the read of the branches |
| the docks and the sea lodge (`claude/ready/docks-lodge`, 13 Nov) are not on master (17 commits, 969 behind) | scenery ready to re-land | the read of the branches |
| no PC-6 on the official plane list (the big STOL the heavy steps name) | plane | plane_lists.json |
| no glider on the official plane list (the LS4 ready is not landed) | plane | plane_lists.json |
| no aerobatic plane | plane | the user's note |
| the machinery pop-up animation and the reveal's panning shot | local GPU work | out of scope here |
