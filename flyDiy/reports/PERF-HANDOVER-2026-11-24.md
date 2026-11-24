# Wingsmith performance: the handover (PERF-LEAD, 23-24 Nov 2026)

The perf round of 21-24 Nov ends here. This file says what landed, what exists as a switch with its measured number,
what is half done, how everything was measured, and what to do next, in order. The targets are in
`flyDiy/PERF-OBJECTIVES.md` (rows 1-15, the bars for the week, how a frame is counted against a limit). Every figure below
was measured in a VISIBLE Chrome at 5120x1440 on the user's box (RTX 3080), cold = a new browser profile, unless it says
otherwise. Evidence folders are under `D:/Dev/flydiy-notes/evidence/` (not in git).

## 1. Where each objective stands (23 Nov, evening)

| # | Objective | Target | The live game (L40J) | Best measured (switches) |
|---|---|---|---|---|
| 1 | Sliders, desktop | no frame over 50 ms | 0 of 30 aeroplanes (Cub 67 ms, Chinook 117, DC-3 684) | 10 of 30 with `?dragbudget=auto`, by holding the model |
| 1p | Sliders, phone | no worse than the Chinook as flown | about half the fleet slower; DC-3 release 3-9 s | see PERF-SLIDERS' section |
| 2 | Menu to garage, cold | 20 s | 119-127 s (the world loads first) | 25-41 s with garage first (quiet box, 23 Nov 13:00); 20.8 s for a returning player |
| 3 | World ready behind the garage | 60 s | not applicable (one loading screen) | 80-89 s after the menu with the world-build switches (97 without); 77 s returning |
| 3b | Go to flying, world ready | 3 s (the roll-out shot, ~11 s, not counted) | 2.5 s | 0.3 s on the screen with garage first, no loading screen; Go at 5 s joins the load (80-84 s, the same total) |
| 5 | Change garage | under 5 s | about 20 s unprepared | 0.25 s prepared ahead (the Game coordinator's ROOMS 6) |
| 7 | Garage freeze | none over 100 ms | 1-2 a visit | garage first, while the world loads (about 50-90 s): 153 tasks of 50 ms+ / 45 over 100 / worst 2.3 s at first; 62 / 19 / 1.42 s on perf-lead-1; on perf-lead-2 both 1.4 s freezes gone, 12-17 over 100 ms left, the worst 0.6-0.9 s right after the world step (section 4.1) |
| 8 | World freeze, first 8 min of the journey | none over 100 ms | 25-31 frames | 7 with the flight switches |
| 9 | Evenness | 5 % of 20-second blocks | 88-100 % | 84 % |
| 13 | 30 fps in flight | 95 % of seconds at 29+ frames | 55 % (the GPU alone takes 33 ms a frame) | 72 % (GPU 24 ms) |
| 14 | Crash | no wait over 250 ms for a new picture | the page shown 6.3-10.3 s (6.7 s on L40K, twice) | MET on two builds (23 Nov 14:22 and 16:37): no page, nothing linked after the impact, worst frame 133-150 ms, 5-10 frames over 100 ms, longest screen gap 138-161 ms |
| 15 | No blue screen, ever | never | at every crash; single frames in flight | none at a crash; none in 500 s of the journey (guard default `ground`, 13:00); the guard's settle patch for cache-hit materials is in perf-lead-1 |

Row 11 (music during loading): PASS (109 s audible, also behind a garage-first load; AUDIO-ROBUST's rig). Rows 4, 6, 10, 12: see section 6.

## 2. What is offered to the trains

- `claude/ready/perf-lead-1` (da944dd68, build 3d3bd56f9fb0, ten gates): the draw guard holds the whole frame for the
  ground's family only (default; `?holdframe=all` is the old way) and holds none for a material whose program exists;
  the `still` event; the table's rows 13-15 and the counting rule; every switch of section 3, off; the tools of
  section 5; GATE GARAGEFIRST. It carries the Deform Coordinator's crash prelink and rest fix, PERF-TRACE 7,
  PERF-WORLDBUILD's switches, AUDIO-ROBUST 1 and MOUNTAIN-VEG's lily pads (VISIBLE: the pads are drawn again).
- `claude/ready/perf-lead-2` (from d0bf3a3e5, build c20556c5712b, ten gates): garage first's 1.4 s garage freeze removed
  (section 4.1), the world's vertex buffers handed up in slices behind the garage (`?gfbuf=0` is the old way).
- `claude/ready/deform-crash-prelink` (+ `-lab`) and `claude/ready/deform-wreck-rest` (the Deform Coordinator): nothing is
  linked at a crash; a wreck at rest costs nothing.
- `claude/ready/perf-trace-7` (+ `-8`), `claude/ready/perf-worldbuild-2`, `claude/ready/perf-sliders-release-1`
  (+ `perf-sliders-1`), `claude/ready/audio-robust-1` / `-2`: their sections are at the end.

## 3. The switches, with what each measured (all OFF by default)

| Switch | What it does | Measured |
|---|---|---|
| `?boot=garagefirst` | The boot runs none of the world's steps; they run behind the live garage on a budget; Go joins the load where it stands | garage on screen 31 s quiet (22-35 s with the fast set on a busy box) against 119-127; the world ready 98-123 s later; Go 2.6 s, no screen |
| `?gfrest=N` `?gfbusy=N` `?gfdelay=N` `?gfwarm=0` `?gfbuf=0` | garage first's budget (ms a task at rest / while input moves), its start delay, the world's first draws left to Go, the world's buffers left to Go's first frame | defaults 12 / 3 / 1500 / warm on / buffers on. The budget barely matters (6, 12, 25 ms measured alike): the freezes are single calls that do not yield |
| `?latelinks=bg` | the scuff's and the see-through view's links after the reveal | the garage 10-18 s sooner; Go 6 s after the reveal costs a 6.6 s screen |
| `?pavefirst=1` `?groundfirst=1` | the heavy ground programs handed to the driver as soon as they exist (the world build's own stand-ins) | with pace=32, stripw, settle=near: 85-88 s against 120 (three runs) |
| `?pace=N` | programs linking at once (8 by default) | 32: the garage's own links faster; the pavement's link slower when it competes |
| `?stripw=1` `?patchw=1` `?roadw=1` `?nearfirst=1` `?compsteps=1` `?settle=near` | the world build in workers and steps (PERF-WORLDBUILD) | under garage first: the world step 35.6 -> 25.4 s, the garage's worst world-build slice 2.0 -> 0.38 s |
| `?farslots=1` `?fartol=N` | the far terrain's buffers refilled in place; its error tolerance | big uploads 28 -> 0 |
| `?mirpace=1` `?mirlean=1` | the water mirror's captures paced and leaned | with farslots: 55 -> 72 % of seconds at 29+ frames, GPU 33 -> 24 ms. PICTURE NOT REVIEWED BY THE USER |
| `?coverbudget=K` | the four ground-cover layers plant on K % of their ms and rebuild one block a frame | not flown yet |
| `?keepframe=1` | the canvas keeps its last picture (preserveDrawingBuffer) | a held frame is a frozen picture, not the page |
| `?holdframe=all\|ground\|0` | which held draws may hold the whole frame | default `ground` since perf-lead-1 |

## 4. Half done, and the next steps in order

1. GARAGE FIRST AS THE DEFAULT. It works end to end (first run 23 Nov 06:06, no error in some twenty loads). Before it
   is the default: (a) the user's word after flying it; (b) THE GARAGE MUST NOT FREEZE WHILE THE WORLD LOADS (the user,
   23 Nov). `python tools/perf/gf_garage.py <row.json>` is the measure: the garage's tasks of 50 ms+ by step and label.
   On perf-lead-1, quiet box: 62 tasks, 19 over 100 ms, worst 1.42 s, 9 % of the time. What they were, by size:
   - 1.42 s + 0.27 + 0.23 + 0.22 s: A GARAGE FRAME WAITING ON A LINK. A compile behind the live garage for another state
     than the frame's (the craft step's, for the roll-out shot: the shed's shadow map on) leaves each material's
     `currentProgram` on the program it asked for; three re-keys a lit material at the next frame, nothing re-keys one
     without lights (the sky's two domes, the outdoors' tree cards), so the frame drew programs still linking. Fixed in
     perf-lead-2: `compileSliced` puts back the program the frames were drawing.
   - a second 1.4 s at the end of first light, in every run, with or without a long task (a gap between two frames):
     THE CLOUDS' FIRST DRAW. The march writes two targets and the driver builds that variant on the GPU process's main
     thread at its first draw (`CLOUDS.warmDraw`'s note); behind a live garage the warm draw held the garage's picture.
     perf-lead-2 runs it at the boot's end, under the garage's own loading screen (about 1.5 s longer: a named cost;
     `?gfcloud=late` is the old place). `gf_garage.py` prints THE PICTURE STANDING STILL since: long tasks alone called
     a row with a 1.45 s frozen picture clean.
   - 0.62 + 0.19 + 0.21 s right after the world step: the world's first textures and buffers in one frame (304 texture
     calls, 1 157 MP; 522 buffers, 244 MB), then a readback (`readRenderTargetPixelsAsync`, `render_world.js sheetStat`).
     OPEN, PERF-WORLDBUILD's side.
   - 0.27 + 0.32 + 0.26 s in the settle and first-light steps: single `worldUpdate` calls that do not yield
     (`27_premises.js` plane / roadDist / rasterTileDecode / inPoly, `scenery_life.js` freeForMast, `29_obstacles.js`
     hull, `cover_ring.js` buildCell). OPEN: they ignore `FLYDIY_SLICE.until`.
   - the world build's own slices over 100 ms (trees 305 = the town kit's decode, a far-terrain quadrant 141, the ring
     130, the built links 117, patch fields 109): PERF-WORLDBUILD's section.
   (c) the parked aeroplanes' captures go through the editor the player is using (never seen to matter with the based
   planes on hold, never proved); (d) under `?gfwarm=0` the world's first draws still run at Go.
2. THE WORLD IN 60 s BEHIND THE GARAGE. It is bound by the driver's link of the pavement's program (32 s alone, 57-103 s
   when 8-32 others link beside it). Next: the heavy programs first with the others held back until they are in (an
   ordered lane in the pacer), and the pavement's program handed before the world's first step. Then its shader text.
3. THE GARAGE IN 20 s. Its own 22-31 s is about 9 s to the first frame, 3.5 s of editor and commit, and the hangar's and
   the aeroplane's links, bound by the pacer's 8 (hence `?pace=32`); about 1.9 s is draws blocked on a link before the
   reveal (the clouds' noise bake, the atmosphere's dome, the characters): prelink them ahead of their first draw.
4. THE SINGLE BLUE FRAMES IN FLIGHT (row 15): 8 in 8 minutes, 0.9 s in all. Six of them with no program linking: the
   guard holds one frame for a material it has not seen, whose program exists. See PERF-TRACE's section for the materials.
5. 30 FPS AT 5K (row 13). The GPU alone takes the frame: the mirror and far-terrain switches are the measured gain and
   wait for the user's eye; then the cover ring's budget (`?coverbudget`), then the render scale that holds the budget
   (`aa_resolve.js` autoScale: whether it is on at the user's settings was never checked).
6. THE CRASH (rows 14, 15): met once on the box on perf-lead-1. Three pieces: the guard's default (`ground`), the
   Deform Coordinator's crash prelink (59 programs, 13 s of link in the background pass: the load pays it, behind the
   screen) and the rest fix (brkCage never rested: 43-51 ms a frame on a still wreck, all of it in poseModel). Repeat it
   on every train (`window_train_check.sh`): one run is not a law.
7. THE SLIDERS: cheaper wing and gear ticks (PERF-SLIDERS' section).

## 5. How to measure (the tools)

Rules of the box first: every node or Chrome run goes through `bash D:/Dev/flydiy-notes/cpu_token.sh run <WHO> -- <cmd>`;
a GPU run only as `... run <WHO> --gpu -- bash <script>` when `<WHO>` is the first line of
`D:/Dev/flydiy-notes/gpu_queue.txt` (the coordinator edits it); a timing run wants the QUIET file
(`cpu_tokens/QUIET "<WHO> <HHMM>"`). Every GPU run is headed, visible, 5120x1440.

| Command | What it gives |
|---|---|
| `TC_TREE=<parent of a built flyDiy> TC_NAME=<train> bash tools/perf/window_train_check.sh 33` | a train's perf check in 26 minutes: cold x2 (the roll-out shot skipped, then played), a returning player, the journey's first 8 minutes and the nose-down crash twice, both with the screen recorded, each read against the table |
| `bash tools/perf/load_matrix.sh <rows file> <out dir> <minutes>` | timed loads from a rows file (`tools/perf/rows/*.txt`: TAG ; BUILT DIR ; QUERY ; PROFILE ; MODE ; EXTRA); it checks that the port serves the row's folder and stops if not |
| `node tools/flight_script.js <scenario.json> --runner page --headed --live --size 5120x1271 --repo <parent> --q "<query>" --screencast <dir> --out <dir>` | a scripted flight on the real page, the compositor's frames recorded |
| `python tools/perf/user_log.py <flightlog.json>` | any flight log (the rig's or the player's exported one) against the table: loading screens, rows 7, 8, 9, 13, the crash on `still` events, row 15 |
| `python tools/perf/screen_read.py <screencast dir> [--step "<step>"]` | the picture pass: the page shown (exit 1), the screen frozen whole, the picture standing still |
| `python tools/perf/profile_window.py <profile.json> <row.json> [label ...]` | a garage-first slice named by function (`boot_perf --profile-out`) |
| `bash tools/perf/lab_build.sh` (`LAB_DEST=<dir>` for a second folder) | gates + build + a built copy to serve; stands nothing if the build or a gate fails |

Scenarios: `tools/flight_scripts/perf/journey_first8.json` (and `_picture`), `crash_cub_nosedown.json` (and `_magenta`:
the page's background set to magenta, so a magenta frame is the page). The 45 m teleport crash is NOT representative
(the user refused it): the crash a player makes is a take-off, 50 m, the nose down.

## 6. Not measured or not moved in this round

Row 4 back to the garage; row 6 the interior view; row 10 responsive loading screens (worst task 3.5-4.7 s in the
load's last step, the loading screen's worst frame 2.0 s); row 12 no "page unresponsive" prompt over a whole sequence;
row 11 music during loading: AUDIO-ROBUST's rig (`tools/audio/stall_rig.js`, verdict in `summary.json <pass>.row11`).

## 7. Traps this round paid for

- FRAME TIMES DO NOT SEE A HELD FRAME. A frame the guard holds costs 100-230 ms and shows nothing: a 9 s blue screen
  read "worst frame 233 ms". Read the `still` events and the screen's recording.
- THE LIMITS SIT ON VSYNC MULTIPLES (50, 100, 250 ms = 3, 6, 15 intervals): "over 100 ms" flipped between 61 and 138 on
  one log. A frame is over a limit from one interval more (54 / 104 / 254 ms at 60 Hz); the frames AT the limit are printed.
- A LEFTOVER STATIC SERVER held the rows' port for 15 hours and fed the lab build to every row that named another folder
  (a train's load figures were the lab's). `load_matrix.sh` now compares the port's `version.json` with the folder's.
  After killing a runner, kill its server.
- A PAGE STEP'S AXIS CENTRES ITSELF: a stick held forward must be re-set every 16 ms.
- THE ROLL-OUT SHOT lasts about 11 s and a second Go click skips it: say which was timed (`--rollout-once` plays it).
- NEVER `require` `tools/run_gates.js` (it runs the battery); list ids with grep. A `TaskStop` leaves the token
  wrapper's waiter alive: check `ps -ef | grep "run <WHO>"`.
- A bash heredoc halves backslashes: a patch with a backslash or an escaped quote goes in a file.
- The built files (`index.html`, `dev.html`, `sw.js`, `version.json`, `tools/flight_core.js`) stay modified in a lab
  worktree; putting them back from git leaves a stale core and every rig load refuses.

## 8. The other sessions' own handovers (read them: each is the detail of its part)

- `flyDiy/reports/PERF-TRACE-HANDOVER.md` and `flyDiy/tools/PERF_TRACE.md` (PERF-TRACE): every program named and owned,
  the who-table of link waits (which program a frame waited on, who linked it, in which step, what else linked beside
  it), the freeze ledger, the scene split (`?recscene=1`). The who-table is what named the garage's freezes.
- `flyDiy/reports/PERF-WORLDBUILD-HANDOVER.md` (PERF-WORLDBUILD): the world build in workers and steps - what is under
  which switch, the steps table, the host's contract (`window.FLYDIY_WORLD_BUDGET.left()`), its gates, its next three
  cuts (the impostor sheets' readbacks; a station's build; the raster's tile decodes).
- `flyDiy/reports/PERF-SLIDERS-HANDOVER.md` (PERF-SLIDERS, on its own branch until its ready lands): the sliders' table
  on 30 aeroplanes, the release rules (landed as perf-sliders-release-1 / -2), the drag budget and the derived read
  (not fully gated on 23 Nov: a preview build only).
- The Deform Coordinator's crash work is in its HANDOVER.md entries (crash prelink, wreck rest, wreck clear).

## 9. 24 Nov, 08:45: what the night and the morning changed (read this before sections 1-4: it supersedes them where they differ)

THE USER'S DECISIONS, 23 Nov evening. 21:05, on garage first: "Make it default". 22:10: "turn them on by default. Let's ensure
that you turn on all switches leading to good results, we can turn them off easily afterwards, when I'll have a look. [...]
Garage freezes, in particular when doing the background loading, should be avoided. And we should try something for the
general FPS again, try and get some headroom on the graphic card, maybe reach below 30 ms per frame?" His limits for the
garage (row 7): no freeze over 100 ms, and at most 2 s of freezes in any minute.

WHAT IS OFFERED NOW.
- `claude/ready/perf-lead-2b` (on the L40M train): perf-lead-2 + GATE WATER green again. MEASURED ON THE TRAIN'S OWN BUILD
  (426ff43ba7b2, quiet, 24 Nov 08:00): the crash met - no page, 0 programs linked after the impact, worst frame 133 ms,
  longest screen gap 140 ms; a cold load 121.7 s (L40K 114-120): no load regression.
- `claude/ready/perf-lead-5` (for L40N; it SUPERSEDES -3 and -4, which must not land): garage first is the DEFAULT on a real
  page (`?boot=loadfirst` is the one loading screen as it was; the node page keeps the old boot); Go at any moment joins the
  background load behind one screen; `?mirpace` and `?farslots` on by default; PERF-WORLDBUILD's six world-build switches on
  under the live host; the hangar's tree cards linked before they are shown; the clouds' first draw inside the boot; every
  compile behind the live garage puts the live program back; the automatic render scale's way back up; perf-trace-9.
  21 gates pass on it. A0's trial of the 22 real-page gates on master + -5 was running at the time of writing.
- THE FALLBACK if the default flip costs the battery more than a morning: one line, `GF_DEFAULT` false (app.js).

MEASURED, quiet box, headed 5120x1440.

| | L40K (live on 23 Nov) | the lab's defaults (perf-lead-4 / -5) |
|---|---|---|
| The plain address: garage on screen | 114-120 s (the world first) | 32-38 s |
| ... world ready after that | - | 90-93 s (the total from the menu is unchanged) |
| Go once the world is ready | 2.5 s | 0.3 s |
| Go at once | - | one screen of 84-88 s, then the flight |
| The journey: seconds at 29+ frames | 54-55 % | 72.6 % |
| The journey: the graphics card, median / 90th | 32.7 / 45 ms | 24.1 / 40 ms |
| The journey: frames over 100 ms | 17-31 | 5 (worst 283 ms) |
| The crash: the page shown | 6.7 s | never (eight crashes of eight, five builds) |
| The garage while the world loads | - | 11-15 tasks over 100 ms, worst 0.65-0.75 s, 3.7-4.2 s of freezes a minute |

WHAT WAS WRONG ON THE WAY, so nobody pays twice.
- `?mirlean` must NOT be a default: it takes grass and cover out of a lake's reflection, and GATE WATER carries the user's
  rule of 20 Oct that lakes keep the full mirror. The lab's first cut of it had rewritten a line that gate pins: red on
  perf-lead-1, -2 and -3 because WATER was not in the lab's gate set. The gain (72.6 %) needs no lean.
- A default must not be read with a device test in a module (GATE GFX: red on perf-lead-4). The page says
  `window.FLYDIY_REAL_PAGE` once, in app.js.
- Garage first as the default, Go inside the run's 1.5 s start delay: -3 and -4 fell to the old path (the garage frozen 28 s,
  the crash's programs never linked ahead). Every rig clicks Go at once. Fixed in -5.
- The node page (tools/_page_node.js) HAS compileAsync: "a renderer that can compile ahead" does not tell it from a browser.
  Its user agent says `flydiy-node`.
- `gf_garage.py` read long tasks only and called a row with a 1.45 s frozen picture clean; it prints the gaps between frames
  too. It still starts at the run's own reveal mark: a freeze in the first 250 ms after the loading screen goes is not in it.
- THE LAB'S GATE SET when a default or water.js / render_world.js / aa_resolve.js / hangar.js changes: PROGRAMS LIGHT
  HULLWARM FLIGHTREC GARAGEFIRST BACKGUARD WATER LOOKS COMMITHYGIENE HANGAR HANGARVIEW COMPSTEPS AA POSTFX GFX COVER CLOUD
  ROLLANIM BOOT DMGSKINGPU DMGPAGEW.
- A slot starts ON THE CLOCK the coordinator names, never on a test of the queue file's text (a slot was lost that way).

THE GARAGE'S FREEZES WHILE THE WORLD LOADS: what was found, in the order it fell.
1. 1.4 s: the craft step's compile of the shed as the roll-out shot dresses it left the sky's materials on programs still
   linking (a material without lights is never re-keyed by three). Fixed: a compile behind the live garage puts the live
   program back.
2. 1.4 s: the clouds' first draw - the march's two-output variant is built by the driver on the GPU's main thread at its
   first draw; no link can ask for it. It is inside the boot now (under the loading screen, with gl.finish): a named load
   cost of about 1.5 s.
3. 0.6-0.9 s right after the world step: the world's textures uploaded at a draw. Fixed by PERF-WORLDBUILD (its -4).
4. 0.15-0.23 s in the town step: the hangar's tree cards added with no program for their material; three linked it inside
   the frame's draw. Fixed: stood held, linked, then shown (one wait of 0.15 s remained at 07:30: not explained).
5. OPEN, the worst now, 0.65-0.75 s: the tree impostor atlases' bake (plantWoodland's QUEUED replant, after the build - the
   tree models' first meeting with the GPU). PERF-WORLDBUILD's -6 put the pre-upload at the wrong step (inert on a cold
   load); its -7 moves it before the queued replant. Never run in a browser at the time of writing: look for
   `WORLD.scene.userData.treeWarm = { via, packs, tex, geo, bytes, done }` in a row (the row's eval prints it).
6. OPEN, 0.13-0.39 s each: three atomic units of the world's streamers in the settle - the life's mast placement with
   first-touch raster tile decodes, one far-town HLOD cell's merge, one parked aeroplane's hull. Each must become
   resumable; they run in flight too. Named in PERF-WORLDBUILD's report, not cut.
7. OPEN, about 0.26 s: first light's `worldSettle(true)` in one task; and 100-120 ms each: a station's build with its AO
   bake, the patch's set-up.

THE GRAPHICS CARD'S FRAME (PERF-TRACE's `?recgpu=pass` and `tools/gpu_passes.js`, 24 Nov 07:36, corrected 09:52 after it
re-read the rows over the SAME seconds). By pass, a cruise over land: the scene pass 85-87 % of the frame (28.6 ms of 32.6 on
the base, 25.3 with the defaults); the clouds' march 2.2-2.6 ms; the shadow maps 0.6-1.9; the AA resolve, post and uploads 0.5
together. By what it scales with: about 1.9 ms a megapixel (12 ms of a full-scale frame at 5K), and THE REST FOLLOWS THE
TRIANGLE COUNT, about 0.75 ms a million triangles - 12 ms at 12 M (cruise), 18 ms at 15 M, 31 ms at 38 M (the take-off and
the first climb). So the frames over 33.3 ms are the LOW ones: in the first 77 s after the reveal the card takes 37-39 ms
whatever the render scale; at altitude the same build holds 24-30 ms. The user's "below 30 ms" is met in cruise and missed
near the ground, where resolution buys almost nothing. GEOMETRY NEAR THE GROUND IS THE LEVER: the knock-out rows of 24 Nov
13:00 (cover, ground blend, forest density and bands, shadows, clouds, each off in turn; read on the climb as well as en
route) put a number on each; their table is in PERF-TRACE's report. The 07:36 run's sampler lost its heaviest frames (fixed
in perf-trace-10): its medians were right, its tail was not in the split.
The automatic render scale (gfx 'auto'): its target follows the frame-rate cap (app.js tellScale). In its first flight it
went down to 0.5 in the climb, was HELD there 37.6 s by its way back up (which scaled ALL of the card's time by the pixels'
ratio), then climbed back to 0.67 by itself. aaAutoDecide now learns the part that does not scale from its own step (G0);
its first flight is the first row of 13:00. KNOWN LIMIT: that part is not a constant - it follows the triangle count, so a
G0 learnt in the climb is too large for the cruise and one learnt in the cruise too small near the ground (the trial step
then pays for it). The frame's triangle count is on the page (renderer.info.render.triangles): G0 = 0.75 ms a million
triangles would track it without learning - the next change if the 13:00 row shows the learnt one wandering.

NEXT, IN ORDER, for whoever takes this on.
1. Read A0's trial of perf-lead-5 and fix its reds by check name (a real-page gate that clicks Go now waits behind one
   roll-out screen of up to ~90 s cold; one that reads the world without Go waits for `FLYDIY_LAB.gfS.done` or asks
   `?boot=loadfirst`; pictures and frame-cost pins see the mirror's pacing and the far terrain's slots).
2. One garage-first row on PERF-WORLDBUILD's -7 (`python tools/perf/gf_garage.py`), then its word to the coordinator.
3. From the 13:00 table: the cheapest geometry lever as a default, measured on the journey.
4. The settle's three units resumable (PERF-WORLDBUILD's report, section 5), each with its own gate.
5. The world in 60 s behind the garage: the pavement's program (the driver takes 30 s or more to link it) first and alone,
   then its text.
6. The user has NOT yet looked at: the mirror's pacing; the strip drawn coarse for a moment and the stand-in cards for
   longer past 1.5 km under garage first; the side sheds appearing a moment after the world; the tree cards outside the
   hangar appearing a moment after the garage. Each has its switch (`?mirpace=0`, `?nearfirst=0`, `?settle=0`).
