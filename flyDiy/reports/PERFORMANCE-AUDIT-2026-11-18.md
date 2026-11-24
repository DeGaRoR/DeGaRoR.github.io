# Wingsmith performance audit — 18 November 2026

For subsequent sessions: read [the experiment ledger](PERFORMANCE-ATTEMPTS-2026-11.md) before repeating a performance experiment. It records unsuccessful attempts and invalid measurements as well as retained changes.

Status: post-driver baseline and first bounded optimization experiments complete. Two small geometry-builder improvements are retained; an unproven shader-sharing candidate was reverted. No visual feature or quality setting was removed or reduced. The 20/30-second targets have **not** been achieved.

## User's implementation priorities (confirmed after the audit)

The garage must be directly operational in **under 20 seconds**, with no freezes or lag. Departure to the world must take **at most 30 seconds**. Preserve fast repeated garage/world round trips, including after aircraft edits. First eliminate expensive and repeated work and rationalize shaders. Separating garage preparation from world preparation is approved; live/background loading is a later phase, not the first optimization strategy. Preserve all visuals unless a specific proposed change receives explicit approval.

The RTX 3080 driver update is complete; the post-update reference driver is **621.24**. The baseline uses the actual branch build, including the previously missing reed asset.

### Post-update results and first implementation checkpoint

Real RTX 3080 browser, 5120×1271 viewport, seeded Cessna, driver 621.24; two launches in one profile and two unchanged-design trips per launch. Readiness requires both `BOOT.state === 'gone'` and an inactive loading chain. Evidence is under `evidence/PERFORMANCE-2026-11-18/`.

| Measurement | First launch | Warm reload |
|---|---:|---:|
| Control garage fully ready | 193.782 s | 146.299 s |
| Control programs at garage readiness | 596 | 570 |
| Garage → world, first trip | 16.891 s | 16.742 s |
| Garage → world, repeat trip | 16.692 s | 16.694 s |
| World → garage, first return | 0.744 s | 0.743 s |
| World → garage, repeat return | 0.594 s | 0.561 s |

Departure figures include rollout animation and the harness's confirmation/polling delay; they are observed upper bounds, not precise transition timestamps. These are **unchanged-design**, clean-profile trips. A populated garage, edited-aircraft preparation, cockpit transitions and crashes still require separate acceptance runs. The control's first departure contains a 1.735-second frame interval; this is not a no-stall pass. Two tree-impostor bake warnings also recur in both control and candidate runs (Birch2_21 and pine_lampi snag sheets), so the test is not error-free.

**Shader-sharing experiment — reverted:** identical asleep damage hooks were temporarily allowed to share their base hook's program identity. Focused hook/uniform/wake/reset checks passed 13/13. Browser times were 188.019 s first launch and 151.767 s warm, with 586/570 programs. The warm control was faster and had the same program count. This does not demonstrate a useful loading win. Source/test changes were restored; the candidate patch and measurements remain in `shared-intact-programs/` for review. No shader-sharing optimization is being represented as shipped.

**Retained: cache terrain-cell border neighbours.** `render_premises.js` previously reconstructed the same eight neighbour keys at every sampled vertex. The neighbour rectangles are now cached per active cell and cleared on every patch rebuild/expansion/edit. Off-patch samples are not retained. Calculations, sample resolution and visual results are unchanged. Differential regression: **71,148 bit-exact comparisons**, including shared boundaries, corners, holes, negative coordinates, changing layouts, and bounded cache size.

**Retained: yield between aerodrome builds.** `render_world.js` previously built every aerodrome in one generator slice. It now gives the existing host budget a boundary after each strip. All strips, geometry and visual detail remain. This reduces the longest construction task rather than removing the total work.

Short real-browser probes stop immediately after world construction; no full boot is needed to compare this work:

| Builder measurement | Control | Border cache | Cache + strip boundaries |
|---|---:|---:|---:|
| Sum of generator execution time | 32.720 s | 31.745 s | 31.649 s |
| Patch-ground slices, summed | 8.181 s | 7.263 s | 7.251 s |
| Longest generator call | 7.220 s | 7.185 s | 2.485 s |

These are single-probe observations, not broad statistical estimates or end-to-end loading claims. The border-cache gain repeats in the final probe. The shorter longest call is a direct consequence of the new strip boundaries; remaining **2.485-second** calls are still unacceptable once interactive. Full garage/world acceptance has not been rerun after these two small changes: the measured builder benefit is approximately one second, and claiming that it solves the minutes-long startup would be misleading.

The source profile also identifies approximately **5.1 seconds of roads**, **2.4 seconds near the lighting stage**, and **2.25 seconds constructing the premises renderer**. Its raw labels name yield boundaries: the 7.2-second call ending at `meadows` actually executes the preceding aerodrome construction. In the split run, individual `w2` and `xw_rough` strip builds account for about 2.49 and 1.46 seconds respectively. These are concrete next profiling targets alongside shader compilation.

Validation: rebuilt generated game files; JavaScript syntax and whitespace checks passed; `tools/_patch_depth_check.js` passed; existing `tools/_pagerig_check.js` passed; actual GPU world-builder probes completed. Full flight, edited-design round trips and crash acceptance remain outstanding. No test browser was left running.

## Decision

Treat this as a responsiveness and shader-lifecycle problem first, followed by a separate sustained rendering problem. The minute-long freezes are real driver-facing waits, not merely low FPS or an overly demanding screen resolution. Shader rationalization is justified. Another layer of broad prewarming, by itself, is unlikely to solve it.

Start with truthful readiness/reporting, exact shader-variant coverage at transitions, and avoiding repeated aircraft work. Then separate the usable garage from preparation for flight. Investigate large rendering costs afterward, preserving visuals throughout. Any proposed visual compromise needs its own scope, evidence, benefit estimate, and explicit user approval.

## Evidence and revision

- User-supplied logs: `flydiy-flightlog-20261118T025214-btvn.json`, `flydiy-flightlog-20261118T050718-dwo4.json`, and `flydiy-flightlog-20261118T195107-3x3o (1).json`. Only these three were analyzed; the similarly named evening file without `(1)` was not substituted.
- Evening build: `48a71176c5a6`, dated 18 November 13:04 UTC; matches fetched `origin/master`, commit `9349a62c1cbee17ae77741d5e62b2ab1657ef376`.
- Work branch: `codex/wingsmith-performance-audit`, in a separate managed checkout. Rebuilding its generated outputs reproduces build `48a71176c5a6`.
- The original working directory contains substantial staged/unstaged work and older generated/source files. Those were not changed. Early inspection found that mismatch; source conclusions below were rechecked against the matching November master.
- Hardware in the logs: RTX 3080, ANGLE over Direct3D 11, Chrome 157, 24 logical cores. Evening window 5120×1271, DPR 1; canvas dimensions change with the garage sidebar. The `sky` events confirm 8 actual MSAA samples and a 5120×1271 flight target.
- Raw analysis output: `playtest-summary.json`, produced by `analyze_playtests.py`. Timings below are recorded observations, not estimates of achievable savings.

## What the playtests show

| Observation | Evidence | Meaning |
|---|---|---|
| Loading screen disappears at 375.458 s (6:15.5) | Evening `header.boot.t0` 24,974.6 ms + initial `gone` 350,483 ms | Almost exact agreement with the user's stopwatch |
| Frame recorder observes garage `gone` only at 392.757 s (6:32.8) | Evening event stream | Polling the state from the game loop can lag the loading screen's own timestamp |
| Initial startup chain continues until about 555.538 s (9:15.5) | Boot `recheck` ends at 530,275 + 288 ms, relative to `boot.t0` | The screen lifting does not mean preparation has finished; it exposes the expensive tail |
| Two successive frame bodies take 99.738 s and 93.852 s | Frames starting at page times 4791.814 and 4891.569 s | Over three minutes of near-continuous main-thread blocking |
| Of those frames, 99.478 s and 93.593 s are in the shader slot | Same frame rows | About 99.7% of their recorded work is shader-related |
| 457 blocking shader-query waits total 1,095.481 s | Evening `linkwait` events | About 18:15 cumulatively blocked across the session; do not add this to the overlapping shader/frame timings |
| 140 freeze events; 113 browser long tasks over one second | Evening event stream | This is recurrent, not a single first-load incident |
| Garage has 30 >1 s frame intervals; active world has 48 | Frame flags exclude hidden/loading/no-render; world also excludes held frames | Both contexts need to be scored; camera changes can put an interval's end in a different context from the frame that caused it |
| Active-world median interval 50 ms, p99 116.7 ms | 59,897 world intervals | Roughly 20 FPS at the median, even before addressing the extreme tail |
| JS heap samples range about 3.47–6.16 GiB | Evening `heap` column, stored in MiB | Significant memory pressure; this is not a VRAM measurement or proof of a leak |

Clock convention: `BOOT.log.t` is relative to `BOOT.t0`; recorder event/frame times are navigation-relative. The final recheck ends at page time **555.538 s (9:15.5)**. These clocks must be normalized before comparing readiness.

### Recorded startup costs in the evening session

| Stage | Recorded duration | Scope and interpretation |
|---|---:|---|
| World creation | 41.827 s | Work paid before the garage is usable |
| World settling | 24.650 s | Streamers and scene preparation around the departure stand |
| Parking preparation | 10.521 s | Includes other aircraft preparation; separate from later parked work |
| Parked step | 5.102 s | Additional parked-aircraft work |
| Aircraft bake | 34.097 s | Build-specific bake; not necessarily CPU baking alone |
| World compile | 29.819 s | Shader work despite the `world` name |
| Garage compile | 80.212 s | Compiles for the garage and its rendering context |
| First frame | 45.205 s | First-use work after compilation |
| First-light frames | 186.921 s | Spans the screen disappearing; major source of post-load unresponsiveness |
| Craft preparation | 17.511 s | Continues after the screen has lifted |

These are stage durations, with asynchronous jobs and driver work overlapping them. They are not independent costs to sum or savings to promise. A feature's causal saving requires an isolated A/B.

The boot log also records six saved-player-aircraft bake misses, each with about 24–26 s elapsed, plus repeated captures for some saved planes. Their elapsed times overlap. This is strong justification to audit duplicate scheduling, cache invalidation, and which parked aircraft are needed immediately; it does not establish that six times 25 s can be removed.

## Why the automated results look better

The early logs are different builds (`71b8092b3b52` and `232a4d38c2d8`), not repeat runs of the evening build. The 05:07 benchmark records a 640×900 canvas, versus up to 5120×1271 in the real playtest: about 11.3 times fewer pixels. It has only about 6.5 seconds of non-loading world frame intervals, no cockpit samples, and no crash test. This cannot validate extended flight or the populated garage.

It is nevertheless already red: warm garage 148.6 s, slider response medians around 402–413 ms, and a studio-menu stall around 5.65 s. Its summary still says `end.ok: true`, `passed: 0`, `of: 0`.

Specific source findings in current master:

1. **Success is only scenario-step success.** `src/viewer/perf_bench.js:241` uses `tr.steps.every(s => s.ok)`; loading, sliders, menu, and crash performance do not determine the overall result. An empty scenario passes vacuously. Report functional completion and performance acceptance separately; overall performance must include all required checks and reject absent samples.
2. **Shader cost is filed under world work.** `PHASE_OF` near line 86 recognizes `compile` and `frames`, then categorizes `worldCompile` as world. In the 05:07 warm run, its reported 88.144 s of world work includes a 60.266 s `worldCompile`. Shader cost is substantially understated by those categories. Use explicit phase metadata, and split compilation from first-use draws.
3. **Loading frame statistics are drained and reused.** `loadCycle` repeatedly calls `takeFrames()` during world settling; `tr.boot.loading` is collected much later, after the load cycle and garage return. Its optimistic short frame maximum does not describe the entire initial load. Record each operation in its own time window without draining a shared stream.
4. **Gone is not ready.** `bootGone` looks only at `BOOT.state`, ignores its own timeout result at callers, and does not require the startup chain to finish. The supplied evening boot proves this distinction matters. Require the operation's completion state, loaded revision, a painted frame, and actual interaction acknowledgement; separately report time-to-first-visible, time-to-interactive, and longest subsequent stall.
5. **The 125 s garage-return figures in the early benchmark are invalid evidence.** Those logs waited for a body class that was not set; current master explicitly fixes that check to `mode-ws`. Do not count that old timeout as measured rendering cost or repeat it as an unfixed defect.
6. **rAF sampling can measure the sampler rather than gameplay.** The page runner adds an unrestricted rAF sampler while game rendering is capped. Use recorder-rendered frames and presentation/interaction evidence together; report sampler and game cadence separately. Successful autopilot steps are not performance passes.

## Highest-priority technical findings

### A. The shader guard has two relevant holes

`src/viewer/app.js:22130` enables the guard only outside the garage and only for the world scene. `shader_warm.js:165` admits an already-known material whenever its per-material programs map exists. Its own comment explicitly excludes changed keys. Its 20 s timeout can eventually release an unfinished program to a blocking draw.

The worst evening watchdog events name `aeroskin:scuff`, `:live:eye`, `:band`, `flown:baked:scuff:band`, and `:cut`. Multiple flags, lighting configurations, material hooks, and object kinds change. Existing prewarming is not covering the combinations actually drawn.

**Recommendation:** prepare the exact variant for a requested transition, then atomically commit the camera/build/lighting/damage presentation when it is ready. Include garage, cockpit, shadows and render-target differences. Preserve the previous complete image and provide feedback while necessary work proceeds. Do not merely widen a timeout, turn off diagnostics, or permanently skip unready objects. A general guard must recognize the renderer's exact variant, not approximate readiness by material identity.

For crashes, first verify `scuffPrelink` against the actual damaged scene: it already prelinks sleeping/awake materials, so adding another generic damage warm-up duplicates an existing mechanism. Its warm context and lifetime must match the real lights, target, geometry, skinning, hybrid band, and cut-face paths. The logs show a failure of that guarantee; they do not identify one sole faulty line.

### B. Compile and first use are different bills

The code already uses `compileAsync`, paced compilation, sliced source generation, readiness polls, warm draws, and multiple catch-up passes. It is not missing the basic async API. Ready-at-link time does not establish cheap first use on this ANGLE path. The first-light stage alone takes 186.9 s in the evening log.

**Recommendation:** inventory each program with family, stable parameter signature, GLSL source hashes/lengths, creation owner, material/object/context, queued time, completion time, first-draw duration, and reuse/disposal. Join waits to program IDs. Keep compiler queues bounded; do not increase parallelism without measurement. Consolidate redundant prewarm passes only after proving equivalent variant coverage.

The current watchdog's comma-split cache-key differences and shared `(unnamed)` bucket are useful clues, not a canonical variant census. Function-source/custom keys can contain commas, and unrelated materials share names. Do not assign an individual 34 s wait to a particular feature from that text alone.

### C. Aircraft shader families need rationalization

The aircraft is no longer simply one shared skin program: baked/live, cockpit-eye, hybrid-band, asleep/awake scuff, glass, damage cuts, skinning, lighting, and target variants multiply.

Safe first experiments preserve the rendered result:

- Deduplicate semantically identical emitted shader sources and eliminate unnecessary cache-key distinctions. Do not merge keys when generated GLSL differs.
- Preserve material and compiled-program ownership across compatible build/view changes; avoid disposing/recreating reusable variants. Verify uniform ownership so sharing never makes one aircraft use another's values.
- Inspect duplicated hook injection and repeated GLSL sampling chains; factor equivalent calculations and sample results where derivatives and spaces remain correct.
- Keep cosmetic values in uniforms when they do not change required code or resource layout. Do not replace all defines with runtime branches indiscriminately: that can increase pixel cost and sampler pressure.
- Keep damage sleeping/awake designs under measurement. Current source deliberately sleeps damage code for intact aircraft, and already compiles both states. Unifying them may reduce variants but increase every intact frame's cost; approval requires an A/B showing the tradeoff.
- Stabilize lighting signatures where feasible. The eight-light premises pool changes the number of visible lights at dusk; exact lighting-context prewarming must work before considering a fixed-count alternative. A fixed pool may save recompiles but add daytime shader work, so it is an experiment, not a default recommendation to ship.

Ground remains an expensive family, but the evening evidence prevents blaming ground alone. `splat_ground.js` documents prior FXC inlining/unrolling disasters and existing fixes. Do not repeat the failed constant-loop/explicit-gradient experiments or assume they are unexplored quick wins. Start from emitted source and current cold/warm attribution, preserving hex tiling, layers and shading.

### D. The populated garage pays for more than its visible task

The initial boot intentionally builds and warms the world as well as the garage. This was designed for immediate round trips, but is now imposing minutes of unrelated preparation before editing. Saved-player aircraft add more work than the clean benchmark reproduces.

**Recommendation:** first deduplicate capture/bake requests and preserve valid caches; then define a minimum genuinely interactive garage. Prepare flight dependencies in bounded background work or on explicit departure, with progress, cancellation, and correct readiness. Keep total cold-to-flight time as a second acceptance metric so moving work later cannot masquerade as a speedup. No scenery or visual feature needs to be removed to change when its work happens.

## Ranked work packages

Effort is relative, not a delivery promise. Savings ranges below are avoided work categories or test targets, not measured before/after results.

| Order | Package | Scope / expected benefit | Effort / confidence |
|---|---|---|---|
| 1 | Make benchmark and readiness truthful | Expose every garage/loading/crash failure; eliminate false passes and incorrect cost attribution | Small; high confidence |
| 2 | Close transition shader-readiness gaps | Target the 30–100 s synchronous stalls, especially garage, cockpit and damage; retain all visuals | Medium; strong evidence for priority, savings need A/B |
| 3 | Deduplicate parked-aircraft capture/bake and reuse compatible resources | Avoid repeated expensive work in a populated garage; compare no saved planes vs the user's six-plus saved builds | Small–medium; meaningful lead, benefit not yet isolated |
| 4 | Canonical program/source census and targeted shader rationalization | Reduce actual distinct programs and per-program compile/first-use cost, rather than compiling the same expanding set earlier | Medium, iterative; high value |
| 5 | Separate garage readiness from flight/world preparation | Move world creation/settling/compilation off the garage critical path without hiding a worse departure total | Medium–large; architectural, not a one-line quick win |
| 6 | Bound editor rebuild work; show aircraft-loading feedback and restart/retry | Early slider measurements are ~0.4 s; evening edits rebuild whole layers in hundreds of ms. Coalesce drag changes, rebuild only dirty layers, commit full result afterward | Medium; preserve geometry and physical outcome |
| 7 | Profile steady-frame cover, mirror, submission and memory retention | Recover sustained FPS after removing stalls; retain exact visuals using valid dirty-state caches and bounded spatial work | Medium; needs per-pass and allocation captures |

## Sustained rendering: next, but not a substitute for fixing stalls

For active, non-held frames with recorded CPU work below 250 ms, evening chase averages are approximately: cover 13.34 ms, mirror 6.63 ms, render submission 15.60 ms, scene 3.58 ms; total recorded work 45.26 ms. Cockpit averages: cover 6.81 ms, mirror 6.93 ms, render 17.99 ms, scene 2.79 ms; total 41.82 ms. These are mixed places/aircraft, not controlled camera A/Bs. Excluding huge frame bodies does not necessarily exclude the following long interval, so these subsets must not be described as clean steady-frame interval distributions.

Submitted draws average around 1,500 per active frame, triangles roughly 33–44 million across all recorded passes. These are not unique visible geometry counts. Cover and mirror deserve focused profiling; damage CPU or the solver is not the leading explanation in these samples. GPU timer coverage is complicated by subsystem/foreign queries, so do not add these GPU numbers to CPU timings or treat them as exact whole-frame attribution.

Memory peaks deserve a repeated build/swap/garage-return retention test. The logs alone cannot distinguish cache growth, live duplicate representations, allocator behavior and leaks. Preserve valid caches; measure ownership before aggressive disposal, which could trigger still more shader compilation.

Expensive visual options to discuss separately, never silently change: 8× MSAA at ultrawide resolution; reflected scene content; close cockpit live-detail paths; terrain/vegetation detail; multi-layer ground materials. Each needs isolated timing, visual comparisons, affected views, and expected benefit before approval. The current audit approves none of those reductions.

## Browser baseline and test procedure

Use the existing tools, not a new physics-only benchmark:

- `tools/RIG-PROCEDURE.md`: established browser procedure.
- `tools/page_rig.js`: real-GPU Chrome harness, readiness, diagnostics and captures.
- `tools/flight_script.js --runner page`: runs the real game with segment marks.
- `tools/flight_scripts/home_circuit.json`: complete Cessna circuit smoke test.
- `tools/flight_scripts/perf/main_journey.json`: relevant wider baseline, including taxi, orbit, cockpit, weather/time, destination, landing and garage return.
- `perf/crash_cub.json`, `perf/crash_pc6.json`, and the five-aircraft cases: targeted follow-ups.
- `tools/perf_trace.js` and `tools/analyze_log.js`: read recorded evidence; keep the separate garage scoring described above.

The main journey's CLI input is the actual JSON path, e.g. `tools/flight_scripts/perf/main_journey.json`; the scenario's internal name is not necessarily a library filename. The referenced `flydiy-notes/PERF-WEEK-METHOD-2026-11-14.md` is not present in this checkout, so this audit relies on the procedure and scenarios actually available.

### Pre-update diagnostic (not the acceptance baseline)

Captured 18 November on the RTX 3080 using the existing real-GPU headless Chrome harness, a fresh profile, a seeded Cessna `list:50`, a 5120×1271 emulated viewport and default game settings. No competing gate workload was launched. Build `48a71176c5a6`; the matching Git source was rebuilt separately on the audit branch. The served immutable copy has the same generated build, with shared assets supplied by the original directory as fallback.

- Harness garage time: **204 s**; boot's own `gone`: **202.583 s** from navigation.
- World creation **43.177 s**, world compile **94.498 s**, garage compile **6.775 s**, first frame **4.694 s**, first-light frames **4.609 s**.
- Program count at garage completion: **556**.
- First startup step recorded a **1.566 s** maximum sampler interval despite functional success.
- One missing local asset was reported: `media/geo/trees/reed_marsh.a36d1207.gz.bin` (404). Therefore this is explicitly a diagnostic, not a completely asset-clean acceptance run.
- Run was intentionally interrupted after preserving its partial recorder log, before the user's graphics-driver update. The circuit was not completed. Files: `browser/live-state.json`, `browser/live-flightlog.json`, `browser/home_circuit_page_2026-11-18T21-32-32.jsonl`.

This test independently reproduces multi-minute loading even without the populated garage. Its shorter time does not rebut the manual log: different aircraft/storage/cache state and headless execution matter.

### Post-update baseline to run next

1. Record driver version, build hash, browser version, viewport, actual per-mode canvas, DPR, preset, actual AA samples, aircraft and stored builds. Verify all required assets resolve. Keep the post-update driver constant for subsequent A/Bs.
2. First launch and immediate warm repeat with the same browser profile; label the first launch's real cache state. A fresh profile or cleared site cache alone does not prove the driver shader cache is empty. Do not call a post-update first launch a typical daily run.
3. Run a short garage/aircraft-swap/rollout/return/cockpit/crash diagnostic first. Then the complete main journey when the short case is measurable and stable. Compare a fresh garage with a representative populated garage. Seed representative storage into the isolated test profile; never clear the user's real profile.
4. Repeat decisive A/B cases under comparable conditions; use one cold and at least two warm measurements where practical. Report every run, including failures/timeouts, not only successful completions.
5. Measure visible, genuinely interactive, flight-ready, and post-transition settled times separately. Include actual slider/input acknowledgement, longest main-thread task, rendered-frame p50/p99/max, count and total duration over 100 ms/1 s, and newly created programs after readiness.
6. Proposed acceptance goals to agree before implementation: initial garage approximately 20 s and no loading transition over 30 s; input acknowledgement under 100 ms; no >1 s main-thread block after readiness; sustained rendered-frame p50 ≤33.3 ms and p99 ≤50 ms on the agreed reference configuration. Keep remaining >100 ms spikes visible. These are targets, not achieved claims.

## Best-practice checks

Avoid synchronous status queries that wait on incomplete programs during interactive rendering; use completion polling and exact readiness. Compile scheduling and first-use work both need accounting. These recommendations agree with [MDN WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices) and the [Three.js renderer documentation](https://threejs.org/docs/pages/WebGLRenderer.html). The project already implements much of the basic API machinery; the priority is making its coverage and ownership correct.

Do not start a blanket texture-compression pass or remove shadows as the first response to this evidence. Those can address memory/bandwidth, but they do not directly explain a frame spending 99 seconds in shader waits. Likewise, a permanent spinner or a longer loading timeout would describe the wait without reducing it.
