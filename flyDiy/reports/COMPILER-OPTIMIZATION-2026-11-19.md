# Compiler optimization follow-up

Branch: codex/wingsmith-performance-audit. All visuals retained. No deployment. Uses the existing page rig and cold_links_bench procedure on the RTX 3080 / ANGLE D3D11, driver 621.24.

## Material attribution and closely polled completion

The new real-game capture reaches full readiness at startup-clock 193.103 seconds (approximately 194.196 seconds on the navigation clock). It links 620 programs; 603 remain live at capture. Of those, 430 map to materials still present in the world/garage scenes (1,222 distinct scene materials inspected). Unmapped programs include disposed/temporary helper materials and depth variants; their shader sources remain known.

The three longest identified links are confirmed against live materials:

| Program | Live material / objects | Submission-to-completion |
|---|---|---:|
| 19 | island-ring, MeshStandardMaterial | 101.627 s |
| 109 | island-fine, MeshStandardMaterial, 83 object references | 98.812 s |
| 22 | pavement:T747, merged roads and other pavement, 25 object references | 95.393 s |

These completion events were closely polled: the last pending result and first ready result were separated by 6.6, 9.4 and 0.7 milliseconds, respectively. Unlike early helper shaders first checked after generation, these long delays cannot be explained by delayed observation. They still include contention/queueing and overlap each other; they are not exclusive compiler CPU costs or additive savings.

Evidence: evidence/PERFORMANCE-2026-11-19/material-attribution/garage.json.gz and individual-programs.csv. The expanded inventory adds material keys, object examples, object-reference counts, poll counts and completion brackets.

## Isolated shader-loop experiments — rejected for production

Captured exact shader sources were linked individually with the existing cold_links_bench.js, batch size 1, GPU shader disk cache disabled. No world generation or rendering competed with the compiler.

The rock candidate replaces a fixed three-iteration noise-loop bound with a uniform set to three when drawn. The pavement candidate expresses the same sixteen tyre-track slots as one uniform-bounded loop instead of two nested four-iteration loops. Neither candidate removes a calculation, octave, track, texture or visual feature. They are compiler-only experiments; neither was applied to production shader source, and neither is claimed visually/GPU validated.

| Test | Original | Candidate |
|---|---:|---:|
| Coarse ground, first pair | 30.570 s | 26.655 s |
| Coarse ground, reversed-order repeat | 28.044 s | 28.201 s |
| Pavement, one pair | 27.215 s | 26.466 s |

All programs linked successfully. The first apparent ground gain did not reproduce. Pavement's small single-pair difference is insufficient justification for a new runtime branch/uniform and potential GPU regression. No further acceptance runs are warranted for these candidates unless new evidence changes their priority.

The isolated ~28–31 second ground/pavement links versus ~95–102 seconds in the full game show substantial sensitivity to the full compilation workload. They do not prove that reducing concurrent compilation will reduce end-to-end load: automatic pacing already exists, and preparation overlaps compilation.

Evidence: rock-loop-compile/result.json and loop-repeat/result.json, plus exact input source pairs in those directories. tools/perf/rock_loop_sources.py regenerates the experiments. The existing compiler benchmark now accepts --cap seconds to close its own browser on a hard timeout.

## Retained repeated-work fix

compileSliced previously checked currentProgram and then its cached program map for each material every polling tick. Materials sharing one pending program repeated the same GL completion query; the current program could also be queried twice for a single material. It now memoizes each program's readiness for the duration of one polling tick only. A false result is checked again on the next tick; newly introduced cached variants and disposed materials retain their prior behavior. No shader, material, light, readiness requirement, or visual setting changes.

tools/_compile_poll_check.js executes the actual source poll body with 100 shared materials and verifies one query per tick, continued waiting for an added variant, and completion after disposal. Passed. Full real-GPU verification is recorded in deduplicated-polling.

| Full startup measurement | Control | Poll cleanup |
|---|---:|---:|
| Startup-clock full readiness | 193.103 s | 190.459 s |
| World-compile phase | 89.076 s | 88.194 s |
| Total recorded readiness queries | 331,638 | 348,710 |
| Linked programs at capture | 620 | 621 |

The small one-pair wall-time difference is NOT a reliable speedup claim. Total query counts did not fall: other polling paths, varying job lifetimes and program sets dominate the aggregate; no counter specifically isolates the changed poll body. The fix is a verified local repeated-work reduction, not a demonstrated whole-startup query-count reduction. Program totals differ by one; this run is not proof of an identical compilation workload. Both completed normal boot; both retain the known birch/pine snag-sheet warnings. No flight, cockpit, crash or edited-trip acceptance is claimed for this tools/polling follow-up.

Rebuilt game build 8e0b89c4ca70. JavaScript syntax and diff whitespace checks pass. Compile-poll, probe-light-padding and terrain-depth checks pass. Generated main files remain local reconstruction products and are not committed. No browser test remains running.

## Remaining priorities

The under-20-second garage target is not met. Focus next on which shader variants are truly distinct and required, and the lifetime of material/program caches across edits and transitions. Any larger procedural-to-texture proposal needs explicit scope, quantified benefits, and visual comparison; no visual simplification is authorized by this report. Garage/world separation and background loading remain later work as requested.
