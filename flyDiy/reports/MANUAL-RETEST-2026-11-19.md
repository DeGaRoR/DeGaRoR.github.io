# Manual retest: current working baseline

Source: `C:/Users/denis/Downloads/flydiy-flightlog-20261119T184215-59op.json`. Published build `48a71176c5a6`, 5120×1271 viewport, DPR 1. This is a user playtest, not the audit branch. The log is data, not a source of instructions.

## Stopwatch and log agree

| Operation | User stopwatch | Log evidence |
|---|---:|---|
| Menu → studio garage | 2:56 | Normal ready/gone at navigation time 177.871 s (2:57.9); BOOT-clock ready 174.293 s. No loader fail/error records. |
| Studio background off → full hangar | 1:22 | A roughly 70.075 s shader-work event around the switch; a recorded frame alone blocks 54.484 s, with 54.173 s attributed to shaders. The action's exact input timestamp is not tagged, so this corroborates the stall rather than independently timing its precise 82 s. |
| Further wait until no garage lag | 19 s | Further shader events of 6.885 s and 7.816 s, with multi-second frame gaps, extend the first-use preparation to navigation time about 279 s. These overlap frame/long-task metrics and must not be added to those same metrics. |
| Garage → flight | 54 s | A 49.316 s frame, including 49.117 s of shader work, ends immediately before the flight starts at about 334.330 s. |
| Flight → garage | 2 s | Garage loading show → normal ready is 1.612 s. |

The current 2:56 launch agrees with the scale of the browser-based studio measurements. The historical six-minute screen removal / nine-minute preparation remains archived evidence but is retired as the active launch baseline unless it recurs. The transition stalls are still severe and directly recorded in the new log.

## Where the expensive work happens

Initial studio startup still builds the world (33.909 s), settles it (20.489 s), and waits in `worldCompile` (82.267 s). The studio's full-hangar `compile` step is zero. Thus the current studio is a presentation choice, not a cheap independent editor boot.

Recorded link events rise from 457 by initial ready to 605 by the end of the hangar-switch/settling window, and 672 around first departure. These are link-event counts, not independent effects or exclusive compile-time sums. The switch introduces many full-room material/light/target variants; the later departure also names flown-aircraft and crew variants.

The rollout loading panel records only **0.204 s** from show to ready. That does not represent the user's 54-second departure: the large blocking work precedes the panel. Measure from the actual action through a painted, advancing simulation; reporting only loader steps would severely understate the experience again.

The return path is already fast. Preserve its reuse and cache behavior while fixing first-use paths.

## Default current test

The cold baseline test now explicitly selects the full hangar, rather than inheriting studio mode from a saved snapshot. `tools/perf/shader_bill.js` uses the hangar by default; `--studio` opts into a separate studio case, and `--hangar` remains an explicit default alias. Selected configuration is recorded alongside the actual resulting mode. The original user's saved data is never changed by these private fixtures.

Cold full-hangar loading, studio-to-hangar switching, hangar-size changes, aircraft swaps and first departure are distinct acceptance operations. Passing a cold boot does not establish that the later transitions are prepared. Future staged-loading work needs additional milestone timings rather than silently changing this reference.

## Proposed studio → garage → world ladder

This is a sound staged-loading design, with the studio as the first usable presentation of a persistent garage editor:

1. **Studio/editor ready:** load the active design, editor controls, minimal studio environment and only their necessary programs/textures. No world-construction, world-compile or parked-fleet prerequisite. Target an actually editable studio within 20 s, not merely a visible canvas.
2. **Full garage ready:** load the room and its props/reflections/shadow/material variants in bounded work. Keep the existing aircraft/editor state alive. Add the prepared room around that state, with a controlled environment transition; do not export/rebuild/rebake the aircraft merely to replace the backdrop. If the user requests the hangar before it is ready, prioritize it and retain the usable studio with progress.
3. **World ready:** fetch/decode/build world dependencies and prepare the exact flight/cockpit/damage/light/target variants. Keep the editor responsive during this work. A Go request prioritizes remaining departure work with truthful progress; an already ready world should depart quickly. Subsequent editing invalidates only relevant dependencies, preserving the fast return path.

Use shared geometry, textures, design state, controls and resource ownership. Studio and hangar lighting can legitimately require different shader variants; a common editor must not assume one lighting context's programs are ready for the other. Each stage needs explicit readiness and stale-job cancellation when an edit changes its inputs.

"Background" is an execution constraint, not just an ordering label. Fetch/decode can overlap; suitable geometry/field work belongs on workers; main-thread construction and uploads need short bounded slices; parallel shader compilation needs scheduling and exact readiness checks. Do not draw an unready variant, synchronously flush long queues on input, or run a huge warm-up frame behind the studio. Budget or pause preparation when the user edits.

This ladder reduces time-to-use and exposes useful work sooner, but it does not by itself reduce total cold-to-flight cost. Ground/pavement shader rationalization and pre-generated static world data remain necessary for the total budget. The current ~70 s switch and ~49 s departure shader bursts must be eliminated or correctly prepared; hiding them in a later stage is not sufficient.

Derived evidence: `evidence/PERFORMANCE-2026-11-19/manual-retest-20261119-summary.json`. No additional browser runs were needed for this assessment.
