# Edited design iteration and playtest reconstruction

Branch: codex/wingsmith-performance-audit. All visuals retained. Nothing deployed. This follow-up changes diagnostic tools, not game rendering or physics.

## Real-browser Cessna design iteration

Build 8e0b89c4ca70, RTX 3080, 5120 × 1271, fresh profile with saved Cessna. Actions: complete garage startup, one Go click, wait for simulation time to advance, return through the game's shed action, move p_topRound by one step through input/change events, one Go click, wait for simulation time to advance.

The script records worker state, simulation time, actual trip decisions, shader sources, material ownership and program disposal. Unlike the earlier harness path, it does not click Go repeatedly while the transition runs. This follows the normal one-click interaction; it does not establish why the previous run stalled.

| Snapshot | Total program links since page load | Live programs | Scene materials |
|---|---:|---:|---:|
| Garage ready | 622 | 605 | 1,222 |
| First departure, simulation advancing | 622 | 605 | 1,221 |
| Edited departure, simulation advancing | 638 | 602 | 1,221 |

The 16 new links after the first world snapshot comprise five on returning to the shed and eleven during edited departure. Only four normalized shader-source pairs were absent at garage readiness; the remaining links reproduce source already present. Some were temporary bake programs that were then disposed. This is not a wholesale recompilation of the world.

The game recorded:

- First rollout: 7.709 seconds in the trip record, no aircraft snapshot/bake/spec/craft step rerun. The first restore runs. The world steps are skipped.
- Return to garage: 0.359 seconds in the trip record.
- Edited rollout: 14.002 seconds in the trip record. Snapshot, bake, spec, craft and shedWarm rerun. All world steps, world shader compilation and world first-light preparation are skipped.
- Edited aircraft preparation steps: snapshot 0.473 seconds; bake 2.966 seconds; spec 0.365 seconds; craft 1.171 seconds; shedWarm 0.019 seconds. These sum to 4.994 seconds; the full trip additionally contains transition and other scheduling work.

Trip-record times are the game's internal boundaries, not click-to-first-interactive stopwatch measurements. The diagnostic's simulation clock advanced after both departures. No sustained flight/cockpit/crash acceptance is claimed. A single edit without scene-material/live-program growth is not a long-session memory-leak test.

## Earlier stalled departure

The prior failure remains evidence of a failed automated run. It was not reproduced by this single-Go-click test. Do not label the earlier run as a confirmed game defect or label this run as a fix. Further tests should distinguish transition interactions, worker startup, subsequent simulation progress and actual rendering stalls.

## Player-log reconstruction

The supplied evening log contains header.buildSpec and graphics settings at export. They can seed an isolated browser using --playtest-log. The reconstructed profile also matches the recorded viewport and final flight worker mode. This is not the full saved garage: saved slots, fleet placement, persistent caches, other preferences and their history are missing. The exported aircraft/settings may differ from those present at the initial boot of that long playtest.

The prior Cessna control and the player's exported settings both name the gamer preset with the same graphics options. The substantial known differences include aircraft design, session/profile state and worker mode. Browser inventory had no open game tab to inspect for the full persistent garage.

The reconstruction completed on the real GPU:

| Measurement | Reconstructed Piper Cub |
|---|---:|
| Startup-clock garage readiness | 191.672 s |
| First rollout, internal trip record | 7.437 s |
| Return, internal trip record | 0.345 s |
| Edited rollout, internal trip record | 13.630 s |
| Program links at garage readiness | 611 |
| Program links after return and edited departure | 632 |
| Newly introduced normalized source pairs | 10 |

The flight recorder confirms Piper Cub, 97 nodes, 477 kg, the restored gamer graphics options including own=true, and inline physics matching the exported playtest mode. Simulation time advanced after both departures. The edited rollout reran aircraft steps only; the world preparation steps were skipped. The added 21 links are cumulative since garage readiness and include the return, temporary bake programs and edited departure. No sustained flight/crash acceptance is claimed.

This does not reproduce the original 6–9 minute startup. It rules out the exported aircraft/graphics combination by itself as a sufficient explanation under this fresh profile and updated driver. It does not rule out saved-fleet/session state, persisted overrides absent from the log, prior-driver behavior, or other differences; those causes remain unproven. The original log's export-time spec is not proof of its initial-boot spec.

## Reproduction and evidence

- tools/perf/shader_bill.js now supports --single-go and --playtest-log <file>; metadata includes worker state and trip ran/skipped decisions.
- tools/perf/program_reuse_report.py compares program IDs and normalized source pairs across captured snapshots.
- Evidence: reports/evidence/PERFORMANCE-2026-11-19/edited-roundtrip-control, especially program-reuse.json, edited-world.meta.json and departure trace files.
- Player reconstruction evidence is in reports/evidence/PERFORMANCE-2026-11-19/playtest-reconstruction, with explicit reconstruction limitations in reconstruction.json.

## Decision

There is no evidence here justifying a broad rewrite of edit/round-trip caching: the expensive world steps are already reused in this case. Investigate the minutes-long startup/garage stalls against the actual saved profile before spending another batch on material-cache changes. Initial terrain/pavement compilation remains expensive, but source-pair counts alone do not explain the player's much longer first-light and garage waits.
