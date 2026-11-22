# Wingsmith performance objectives: THE OFFICIAL TABLE (the user, 21 Nov 2026)

Permanent. Every perf report, benchmark and ready is measured against this table. Copy in the repo: flyDiy/PERF-OBJECTIVES.md.

| # | Objective (the user's words) | Target | How it is measured |
|---|---|---|---|
| 1 | Garage sliders instantaneous | no frame > 50 ms while a slider moves | in-game Benchmark sliders row (input to frame) |
| 2 | Time menu to sandbox garage | 20 s | menu click -> garage interactive, cold |
| 3 | Time garage to world | 20 s + 20 s background loading | Go -> flying; background work after it must not freeze (rows 8-9) |
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
| 14 | Crash (the user, 22 Nov 2026: "less than 250 ms freeze on crash, and no sky blue screen (failed render frame) during those") | no frame over 250 ms at a crash and in its aftermath; no frame that draws nothing (the sky's colour alone) | flight log of tools/flight_scripts/perf/crash_cub.json and crash_pc6.json, and of the user's own crashes: the frames of the 20 s after the impact, the frames not rendered or drawing under a tenth of their neighbours' calls, the errors caught in the loop; read by tools/perf/user_log.py |

The user also notes (21 Nov): the sound misbehaves during lags and freezes (huge saturation, slow-down and speed-up, pitch variation). The audio must be robust to main-thread stalls, isolated like the UI's responsiveness.

Baseline on 21 Nov (A0 cold loads, RTX 3080 box, empty shader cache, to the end of the loading screen): master L40h 185-224 s / 488 programs; claude/perf-codex (Codex + the user's cuts) 109-130 s / 451 programs.
