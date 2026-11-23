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
| 2 | Menu to garage, cold | 20 s | 119-127 s (the world loads first) | 22-35 s with garage first |
| 3 | World ready behind the garage | 60 s | not applicable (one loading screen) | 98-123 s behind the garage |
| 3b | Go to flying, world ready | 3 s (the roll-out shot, ~11 s, not counted) | 2.5 s | 2.6 s with garage first, no loading screen |
| 5 | Change garage | under 5 s | about 20 s unprepared | 0.25 s prepared ahead (the Game coordinator's ROOMS 6) |
| 7 | Garage freeze | none over 100 ms | 1-2 a visit | garage first: 11 over 100 ms in the 30 s after the reveal, worst 0.31 s |
| 8 | World freeze, first 8 min of the journey | none over 100 ms | 25-31 frames | 7 with the flight switches |
| 9 | Evenness | 5 % of 20-second blocks | 88-100 % | 84 % |
| 13 | 30 fps in flight | 95 % of seconds at 29+ frames | 55 % (the GPU alone takes 33 ms a frame) | 72 % (GPU 24 ms) |
| 14 | Crash | no wait over 250 ms for a new picture | the page shown 6.3-10.3 s | no page; worst frame 217-250 ms; 13 fps after until the rest fix |
| 15 | No blue screen, ever | never | at every crash; single frames in flight | none at a crash (two fixes); the flight's single frames open |

Rows 4, 6, 10, 11, 12: see section 6.

## 2. What is offered to the trains

- `claude/ready/perf-lead-1`: the draw guard holds the whole frame for the ground's family only (default; `?holdframe=all`
  is the old way); the `still` event; the table's rows 13-15 and the counting rule; every switch of section 3, off; the
  tools of section 5; GATE GARAGEFIRST.
- `claude/ready/deform-crash-prelink` (+ `-lab`) and `claude/ready/deform-wreck-rest` (the Deform Coordinator): nothing is
  linked at a crash; a wreck at rest costs nothing.
- `claude/ready/perf-trace-7` (+ `-8`), `claude/ready/perf-worldbuild-2`, `claude/ready/perf-sliders-release-1`
  (+ `perf-sliders-1`), `claude/ready/audio-robust-1` / `-2`: their sections are at the end.

## 3. The switches, with what each measured (all OFF by default)

| Switch | What it does | Measured |
|---|---|---|
| `?boot=garagefirst` | The boot runs none of the world's steps; they run behind the live garage on a budget; Go joins the load where it stands | garage on screen 31 s quiet (22-35 s with the fast set on a busy box) against 119-127; the world ready 98-123 s later; Go 2.6 s, no screen |
| `?gfrest=N` `?gfbusy=N` `?gfdelay=N` `?gfwarm=0` | garage first's budget (ms a task at rest / while input moves), its start delay, the world's first draws left to Go | defaults 12 / 3 / 1500 / warm on |
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

1. GARAGE FIRST AS THE DEFAULT. It works end to end (first run 23 Nov 06:06, no error in eight loads). Before it is the
   default: (a) the user's word after flying it; (b) the garage must not freeze while the world loads - today a handful of
   slices of 100-400 ms remain (the town kit's host build, the island ground's albedo, the far terrain's quadrants: named by
   function with `profile_window.py`); (c) the parked aeroplanes' captures go through the editor the player is using
   (never seen to matter with the based planes on hold, never proved); (d) the roll-out shot's shadow warm and, under
   `?gfwarm=0`, the world's first draws still run at Go.
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
6. THE CRASH'S FRAME RATE: the Deform Coordinator's rest fix (brkCage never rested: 43-51 ms a frame on a still wreck).
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

## 8. The other sessions' sections

(PERF-TRACE, PERF-WORLDBUILD, PERF-SLIDERS: appended below from their own files.)
