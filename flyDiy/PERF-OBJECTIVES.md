# Wingsmith performance objectives: THE OFFICIAL TABLE (the user, 21 Nov 2026)

Permanent. Every perf report, benchmark and ready is measured against this table. Copy in the repo: flyDiy/PERF-OBJECTIVES.md.

| # | Objective (the user's words) | Target | How it is measured |
|---|---|---|---|
| 1 | Garage sliders instantaneous | no frame > 50 ms while a slider moves | in-game Benchmark sliders row (input to frame) |
| 1p | Sliders on the phone (the user, 23 Nov 2026, in the PERF-SLIDERS session, after the real-phone table: "I found the chinook performance to be acceptable, so you can benchmark this. Even before your fix. Nothing longer, but that felt acceptable. The DC3 should do the same.") | on the S20 FE no player plane worse than the Chinook AS FLOWN BEFORE ANY FIX, pinned as figures (median / worst frame while dragging): wing span 141 / 440 ms, cabin length 55 / 80 ms, main gear position 124 / 247 ms; the wait after letting go 1.3 s at most | PERF-SLIDERS' real-phone drag rows, every player plane against these figures (the DC-3 on 23 Nov: gear 2 158 / 2 865 ms, release 3-7 s) |
| 2 | Time menu to sandbox garage | 20 s | menu click -> garage interactive, cold |
| 3 | World loading (the user, 23 Nov 2026: "I revise my target of world loading time to 1 minute, including the background loading (so ideally 1 minute spent in the garage)"; was "Time garage to world: 20 s + 20 s background loading") | 60 s, background loading included: from the garage showing to the world ready, the garage responsive meanwhile (rows 1 and 7 hold); once the world is ready, Go -> flying in 3 s (row 4) | cold (a new browser profile): the garage's reveal -> the world's last step done (the boot's steps in the flight log); the garage's frames and long tasks in that span; then Go -> flying with tools/boot_perf.js --rollout (the roll-out shot, about 11 s when it plays, is NOT counted: PERF-LEAD's reading, not yet confirmed by the user) |
| 4 | Round trips garage-world / world-garage, after the first loading | max 3 s | each way |
| 5 | Change garage (teleport from one to the other) | < 5 s, no UI freeze | click -> new garage interactive; no frame > 100 ms |
| 6 | Show the plane in the transparent "interior" view | < 2 s, no UI freeze | click -> view drawn; no frame > 100 ms |
| 7 | Garage freeze | no freeze over 100 ms | frames in the garage |
| 8 | World freeze | no freeze over 100 ms | frames in flight, incl. approaches and arrivals |
| 9 | Evenness | max 5 % of 20-second blocks with at least 1 frame over the limit (orange bar in the profiler), none with freezes (red bars) | profiler blocks over the main journey |
| 10 | Responsive loading screens | the screen remains responsive during all loading screens | input/animation frame during loading, no long task blocking it |
| 11 | Music and radio Jolene during loading screens | available (not working on 21 Nov) | audible, uninterrupted |
| 12 | No "page unresponsive" prompt | the browser never prompts during a whole normal play sequence | full sequence run |
| 13 | 30 frames a second (the user, 22 Nov 2026: "it was implicit") | 30 fps held, in the garage and in flight, at the user's screen (5120x1440) | flight log: seconds of the session with 29 frames or more (proposed bar: 95 %; 84 % in the world on 22 Nov), read by tools/perf/user_log.py; a 1024-wide run beside it tells the screen's share |
| 14 | Crash (the user, 22 Nov 2026: "less than 250 ms freeze on crash, and no sky blue screen (failed render frame) during those") | the SCREEN never waits over 250 ms for a new picture at a crash and in its aftermath; no frame that draws nothing (the sky's colour alone) | READ ON THE SCREEN, not in the frame times alone (the user, 23 Nov: "the 200 ms quoted before are rubbish, it freezes for several seconds" - a frame the draw guard holds costs its 100-230 ms and shows NOTHING new: the Cub's crash read "worst frame 233 ms" while the screen stood still or showed the page for 4-9 s). The measure is the longest time between two pictures PRESENTED in the 20 s after the impact: the flight log's 'still' events (every run of held frames, from the last presented frame to the next) beside its frame times, read by tools/perf/user_log.py; checked against the screen's own recording (tools/flight_script.js --screencast). The crash flown is the one a player makes: tools/flight_scripts/perf/crash_cub_nosedown.json (take-off, 50 m, the nose down), and the user's own crashes |
| 15 | No blue screen (the user, 22 Nov 2026: "No blue screen, not in the garage, not in the world, not when crashing, ever"; "totally unacceptable in any circumstances. A freeze is better even") | never: no frame that shows no world, in the garage, in the world or at a crash | the picture itself: nine pixels of the lower half of the canvas read after every frame of a benchmark run (a frame whose samples are one flat colour is a blue screen; its time, colour and the eye's place kept) - tools/flight_scripts/perf/crash_cub_nosedown_picture.json is the first; the recorder's columns alone do NOT see it (the one the user watched on 22 Nov drew its usual calls and threw nothing). SINCE 23 Nov: nine pixels of the canvas do not see it either (the canvas is not what the screen shows when a frame is held) - the measure is the screen's recording (tools/flight_script.js --screencast, the page's background set to magenta: a magenta frame is the page) and the flight log's 'still' events without keepframe (each one is the page shown for its length) |

## The bars for this week (23 Nov 2026)

The user, 23 Nov: "You may also help me revise the objective table so it is achievable soon." The FINAL targets above stand; these are the bars a row is
read against this week, each with what was measured when it was set (5120x1440, the lab build, the first 8 minutes of the journey for the flight rows).
A row that meets its bar is "on its bar", not "met": the report always gives both.

| # | Measured on 22-23 Nov | This week's bar | Final target |
|---|---|---|---|
| 2 | 123 s cold (the world loads first); the garage alone 9.7 s | 20 s | 20 s |
| 3 | 123 s cold on a loading screen; 89.6 s with the best switches (one run) | 60 s | 60 s |
| 8 | 40 frames over 100 ms in 8 min; 11 with the flight switches; 3 at 1024 wide | none over 250 ms, at most 5 over 100 ms in the 8 min | none over 100 ms |
| 9 | 22 of 25 blocks late at 1024 wide | at most 25 % of blocks | at most 5 % of blocks |
| 13 | 55 % of seconds with 29+ frames; 72 % with the flight switches; 83 % at 1024 wide | 85 % | 95 % (proposed, not yet confirmed) |
| 14 | the page shown 7.7-9.2 s from the impact; with ?holdframe=ground one run at 217 ms, no page | no wait over 1 s for a new picture | 250 ms |
| 15 | the page shown at every crash | never | never |

The user's page of this table: https://claude.ai/artifact/AazRMiXJ8Ne87sbEgn2vF4

## How a frame is counted against a limit (23 Nov 2026, PERF-LEAD and PERF-TRACE; a READING rule, shown to the user)

The limits of rows 5 to 9 and 14 (50, 100, 250 ms) sit exactly on a multiple of the display's interval at 60 Hz (3, 6 and 15 intervals of 16.7 ms).
A frame of 6 intervals measures 100.0 ms give or take its jitter, so "over 100 ms" flipped on that jitter: one crash log read 61, 90 or 138
frames "over 100 ms" depending on where the cut fell.

THE RULE: a frame is OVER a limit when it lasted at least one display interval more than the limit's own count: over 100 ms = 7 intervals or more
(a frame of 6 intervals is AT 100 ms, not over it). On a 60 Hz display that is counted from 54 / 104 / 254 ms for the 50 / 100 / 250 ms limits;
the 35 ms limit of row 9 stays (33.3 ms is clear of it). Every reader (tools/perf/user_log.py; freeze_ledger.js, crash_window.js, slot_frames.js,
big_uploads.js from PERF-TRACE's tool 7b) uses the same three numbers and PRINTS the frames AT the limit beside the count, so a change that
moves frames from 7 intervals to 6, or back, stays visible. A row is judged on the first number.

WHAT IT MOVED, on one known log (the nose-down crash with ?holdframe=ground, the 20 s after the impact, 190 frames): "over 100 ms" 90 -> 61,
with 29 frames AT 100 ms. Every count quoted before 23 Nov was made with "over 100.0" and is a little higher than this rule gives.

The user also notes (21 Nov): the sound misbehaves during lags and freezes (huge saturation, slow-down and speed-up, pitch variation). The audio must be robust to main-thread stalls, isolated like the UI's responsiveness.

Baseline on 21 Nov (A0 cold loads, RTX 3080 box, empty shader cache, to the end of the loading screen): master L40h 185-224 s / 488 programs; claude/perf-codex (Codex + the user's cuts) 109-130 s / 451 programs.
