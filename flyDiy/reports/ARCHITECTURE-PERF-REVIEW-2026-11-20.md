# Wingsmith — Independent Architecture and Performance Review

**20 November 2026 · Research note for the project owner and development team**  
**Scope:** performance *explainability*, critical-path analysis, engine coordination, historical performance evidence, and future map scale. This is an independent assessment, **not** a detailed implementation design or a measured benchmark of the current build.

## Executive assessment

**The immediate deficit is not logging; it is actionable attribution.** Wingsmith has extensive recording of frame intervals, CPU slots, shader links, loading phases, network activity, GPU timings (where available), and asset residency. Yet reports still collapse distinct operations into “shader compile” and “world compile”. Those categories cannot support a creative cost–benefit choice.

**Recommended order:** (1) improve the *reporting/interpretation* of existing traces; (2) establish semantic identities linking visible features to work, resources, and shader programs; (3) add dependency-aware timelines and evidence-rated freeze attribution; (4) only then test coordinated scheduling in a limited, measured pilot. The profiling work can bring value independently of a coordinator.

**Observed code evidence** (repository `DeGaRoR/DeGaRoR.github.io`, `flyDiy`, inspected against master around 18 November 2026):

- [`src/viewer/flight_recorder.js`](https://github.com/DeGaRoR/DeGaRoR.github.io/blob/master/flyDiy/src/viewer/flight_recorder.js): already records detailed per-frame CPU slots, rAF frame intervals, `longtask` / `long-animation-frame` events, shader-link and link-wait events, newly created Three.js program names and cache-key differences, selected GPU timer queries, and replayable logs. It marks frames **≥250 ms** as freezes; this is one specific existing definition, not the only stall metric that should be reported.
- [`tools/boot_perf.js`](https://github.com/DeGaRoR/DeGaRoR.github.io/blob/master/flyDiy/tools/boot_perf.js): already gathers Chrome CPU sampling profiles, named BOOT steps, milestones, network records and top self/inclusive function costs. Its cold run uses a fresh Chrome profile; its warm run uses a persistent profile.
- [`src/viewer/perf_bench.js`](https://github.com/DeGaRoR/DeGaRoR.github.io/blob/master/flyDiy/src/viewer/perf_bench.js): `PHASE_OF` groups specific boot steps into broad `shaders`, `assets`, `world`, `settle`, `impostors` and `other` totals. **This is an identifiable loss of decision-making detail**, not proof that the original tasks were unnamed.
- [`tools/perf_trace.js`](https://github.com/DeGaRoR/DeGaRoR.github.io/blob/master/flyDiy/tools/perf_trace.js): records **every >50 ms frame**, nearby events and preceding work, but its summary cause labels remain coarse (`shader-dominated`, `recorded-frame-work`, `outside-recorded-frame-work`). These are starting categories, not finished causal explanations.
- [`tools/asset_census.js`](https://github.com/DeGaRoR/DeGaRoR.github.io/blob/master/flyDiy/tools/asset_census.js): already associates objects, materials and textures with top-level scene owners and reports resource duplication and program counts. This is a promising source for the missing feature → resource → program link.
- [`src/viewer/shader_warm.js`](https://github.com/DeGaRoR/DeGaRoR.github.io/blob/master/flyDiy/src/viewer/shader_warm.js): already stores some `object/material` labels, held draws and warm-up times; these should be reconciled with the flight recorder, not replaced by a new independent shader profiler.

### 1. The report the project owner should actually see

**View A — An interactive startup critical-path timeline.** Horizontal time axis; separately visible lanes for (a) browser/main-thread startup, (b) asset fetching, (c) worker jobs and decode/generation, (d) GPU uploads/program readiness, (e) scene integration, and (f) user-facing readiness milestones. A lane contains **named, drillable operations**, not `world` or `shader` as undifferentiated bars. Causal arrows connect actual prerequisite/await relationships. The *critical path* is highlighted: the chain of operations whose delay would delay the chosen milestone.

A schematic only, **not measured Wingsmith data**:

```text
TIME ───────────────────────────────────────────────────────────▶
Main thread   [parse]  [terrain setup]       [activate runway] [ready]
Workers                   [forest distribution]───┐
Network          [terrain records]──┐ [texture pack]──────┐
GPU/programs                [ground splat shader]─────────┤
Scene integration                                      [near scene]
                                                   ↑ critical dependency

Click 'ground splat shader': feature/owner, compile variant, first use,
                                   elapsed link interval, main-thread wait,
                                   whether it delayed 'flight ready'.
```

**Non-negotiable distinction:** a job taking 20 seconds in the background does **not necessarily add 20 seconds to loading**. Report separately: its own elapsed time, CPU time (if known), time spent waiting, and its *marginal contribution to the selected readiness milestone*. Where prerequisite links have not been instrumented, show the timeline and say **critical path not proven**; overlapping bars alone cannot establish causality.

**View B — A freeze ledger.** For each event, show location, aircraft/camera state, frame interval, prior recorded loop work, work between frames, CPU main-thread attribution, driver wait, worker completions, GPU query coverage, relevant shader/material/scene operations, and a confidence-rated cause. Example wording: “286 ms interval near runway 02: 171 ms main-thread cover-cell build, 43 ms rendering, remaining time unassigned; no confirmed shader wait.” **Illustrative wording, not a real measurement.** Never infer “shader caused it” merely because a shader event occurs nearby.

**View C — A decision table**, sorted by *measured marginal delay to first flight*, not by cumulative CPU work alone:

| Visible feature / responsibility | Critical-path delay | Runtime stalls | Memory | Necessity/visual benefit | Evidence |
|---|---:|---:|---:|---|---|
| Terrain splat, ground textures | measured / unknown | measured / unknown | measured | owner judges | direct / inferred |
| Airfield buildings | measured / unknown | measured / unknown | measured | owner judges | direct / inferred |
| Near-ground grass and rocks | measured / unknown | measured / unknown | measured | owner judges | direct / inferred |
| Cloud/atmosphere effects | measured / unknown | measured / unknown | measured | owner judges | direct / inferred |

Make these rows clickable down to resource family, specific generation task, shader variant, render pass and source location. Where a feature shares a GPU program with others, distinguish **the cost of the shared program** from the cost attributable to that individual feature. Disabling a feature may save *zero* shader compilation time if another feature still requires the same program.

### 2. Shader attribution: what is specifically missing

Three.js shader programs depend on material configuration, scene/pass state and compilation defines; a material is not a one-to-one shader program. Merely renaming a material or listing `renderer.info.programs` is insufficient.

A useful trace records a stable **program fingerprint** and its associated **human-readable owner(s)**: e.g. `terrain / island ground / splat surface / shadowed fog variant`, plus draw context and references to assets/materials that require it. A program may have multiple owners, and a family may have many variants. Naming must be **diagnostic metadata**: do not change `customProgramCacheKey()` just to attach a friendly label, because that could change program reuse.

For each program, distinguish: first requested; submitted for compilation; completion reported; first needed by a visible draw; main-thread link/status-query blocking; warmed but unused; repeated variant after warm-up; and deferred because the visual detail is optional. A shader's parallel *wall-clock latency* is not automatically CPU time. The Khronos `KHR_parallel_shader_compile` specification explicitly distinguishes nonblocking completion polling from potentially blocking status queries.

**Current gap to verify:** `flight_recorder.js` uses separate `gl.linkProgram` events (with sequential numeric IDs) and Three.js program-list names. A robust link from **that exact GL program** to the originating shader/material/pass/feature is not evident from those wrappers alone. The shader agent should verify it before claiming shader-specific causal durations. It should also verify that the profiling hooks do not alter warm-up behavior or introduce new compilation variants.

### 3. Quantify freezes honestly

Report several complementary metrics with explicit denominators:

- **Incidence:** number and percentage of eligible frames above **50, 100 and 250 ms**; also show the existing recorder's ≥250 ms freeze convention.
- **Player-impact duration:** total excess frame time above a declared budget (e.g. actual frame duration minus the relevant 16.7 or 33.3 ms target). Report separately from sum of long-task durations, which can overlap and must not be added to this quantity.
- **Time affected:** share of elapsed **active gameplay** within long-frame intervals, excluding hidden tabs/loading screens when answering *in-flight* smoothness. Show startup/transition freezes in their own category.
- **Causal allocation:** confirmed main-thread CPU work; confirmed driver/API blocking; measured GPU time when valid; suspected resource/worker handoff; **unattributed**. Unattributed is a legitimate result.
- **Context:** world location, camera, altitude, speed, stream queue pressure, requested assets, newly introduced shader variants.

The existing recorder already has much of this. One caution: `rAF` intervals include time *between* frames; the current report itself correctly looks at the preceding frame and “outside” time. The Long Animation Frames API can improve script attribution but does **not** attribute worker and service-worker execution itself. GPU timer queries also measure GPU elapsed work, not necessarily a JavaScript stall's root cause; coverage/disjoint status must be reported.

### 4. Reference practice from mature tools

- **Unreal Insights:** named timing events, per-thread timelines and **Asset Loading Insights**; its distinction between main-thread loading and asynchronous loading matches the requested explanatory views. [Official documentation](https://dev.epicgames.com/documentation/unreal-engine/unreal-insights-in-unreal-engine).
- **Chrome DevTools:** custom tracks can be created through User Timing (`performance.mark/measure`) and the DevTools performance extensibility metadata. This offers a relatively low-cost way to expose **existing Wingsmith task names in the standard browser timeline**. [Official documentation](https://developer.chrome.com/docs/devtools/performance/extension).
- **Perfetto:** accepts Chrome JSON trace format, including asynchronous **flow arrows** between slices. A human-readable exported trace can therefore coexist with a simple management summary without building a full custom timeline editor. [External trace formats](https://perfetto.dev/docs/getting-started/other-formats).
- **Browser freeze attribution:** the [Long Animation Frames API](https://developer.mozilla.org/en-US/docs/Web/API/Performance_API/Long_animation_frame_timing) records problematic frames and supporting script entries, with documented attribution limits.
- **WebGL shader and GPU timing:** [Khronos parallel shader compilation](https://registry.khronos.org/webgl/extensions/KHR_parallel_shader_compile/) and [WebGL disjoint GPU timer queries](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/) explain why asynchronous compilation latency, JavaScript blocking and GPU elapsed time must be reported separately.
- **Flight simulators and pagers:** [X-Plane's published job-system account](https://developer.x-plane.com/2025/12/the-glorious-multi-core-future-is-now-the-boring-present/) and [OpenSceneGraph DatabasePager](https://camlosg.sourceforge.net/osg/classosgDB_1_1DatabasePager.html) are useful references for dependency scheduling, staging, asynchronous loading, and frame-budgeted integration. These are references for later coordination, **not evidence that Wingsmith needs a rewrite now**.

### 5. Archaeology before optimization

The repository's [2 October 2026 performance release](https://github.com/DeGaRoR/DeGaRoR.github.io/blob/master/flyDiy/reports/PERFORMANCE-RELEASE-2026-10-02.md) reports **81.4 seconds cold** and **51.9–58.6 seconds warm** to first flight in its defined benchmark; about **9 seconds** for warm garage → world. It also documents a cold garage wait dominated by approximately **46 seconds of first-time shader linking**. Another historical failure was a **20–30 second wait for a house-worker response that never arrived**: a scheduling/dependency failure rather than useful geometry work.

The late-October [Wave 2 integration note](https://github.com/DeGaRoR/DeGaRoR.github.io/blob/master/flyDiy/reports/PERF-WAVE2-READY.md) reported boot controls of **125.6/99.9 s** and a candidate of **101.1 s**, with *no proven loading improvement*. This demonstrates how sensitive results were to conditions and build state.

If contemporary runs appear closer to 230–250 seconds, **do not automatically conclude a 3–5× regression**: the October benchmarks used specific aircraft, graphics settings, scenes and cache profiles, and in the October release Metlakatla was **off by default**. Reconstruct comparable conditions or mark the series as not comparable. The archaeology task should identify which changes introduced (a) new work, (b) duplicate work, (c) new waits, or (d) a changed readiness milestone. An apparent loading freeze can be an unresolved dependency or watchdog, not a CPU-heavy compile.

### 6. Global coordination: promising, but downstream of observability

The code already contains **independent scheduling**: `render_premises.js` uses a per-frame time bank; `cover_ring.js` has budgeted vegetation-cell updates; `rock_ring.js` bounds worker jobs per frame; `ground_tier.js` rebuilds incrementally; `shader_warm.js` has separate compilation pacing. Local budgets can coincide and cause bursts. A shared planner/execution budget **could improve frame pacing**, shorten critical-path loading by overlapping or deferring work, and sometimes help CPU-limited FPS. It cannot by itself reduce intrinsic GPU draw cost or unavoidable shader compilation.

Study **shared observability → limited admission/priority pilot → wider coordination only after measured A/B gains**. Avoid replacing mature subsystem-specific streaming with a single large controller. Key distinction: a **residency/priority policy** chooses what should exist; a **work scheduler** chooses when preparation executes.

### 7. Future maps and missions

A 200 × 200 km map is **40,000 km²** and reinforces the need for hierarchical world representations, finite memory residency and prefetch based on aircraft motion/destination. The currently small map is not the architectural limit. Because mission progression can reshape runways, an efficient production model could be a **prepared base world plus localized, versioned terrain/scenery overlays**. Where missions have fixed stages, alternative terrain states may be baked in advance; dynamic edits would invalidate only affected local dependencies. Visual ground and collision should switch coherently.

### 8. Suggested near-term acceptance tests (without a new engine architecture)

1. **Every reported startup bottleneck** can be expanded from an anonymous category to a named feature/asset/task, its shader variants (if any), and its *measured or explicitly unknown* contribution to time-to-garage and time-to-flight.
2. **Every frame ≥250 ms** appears in a freeze ledger with the responsible operations if confirmed; otherwise an explicit “unattributed” remainder. Coverage and confidence are visible.
3. **One exported trace** shows lanes, precise time ranges and causal dependencies *where recorded*, and opens in Chrome DevTools or Perfetto; raw data and report agree.
4. **Controlled feature-on/off comparisons** quantify the marginal effect on cold/warm startup, streaming stalls, GPU work and memory, keeping build, browser profile, pilot, graphics and scene consistent. Visual quality impact is judged by the project owner.
5. **Historical performance changes** can be compared against exact compatible release settings, or are flagged *not comparable* rather than presented as a definitive regression.
6. **Profiler overhead is tested** (`?rec=0` vs recording, or equivalent controlled comparison); the new analysis layer must not materially alter the startup and frames it measures.

## Bottom line

The first objective is not a smarter coordinator. It is an engine that can explain itself at the **level of visual features and user-visible consequences**, so its owner can decide what deserves the cost. The coordinator should eventually consume that same evidence, not become a prerequisite for obtaining it.

**Confidence:** high that report aggregation and semantic ownership are important current gaps, because the relevant code has been inspected; medium that coordination will improve frame pacing because independent budgets are present; low on the actual cost ranking of individual shaders, scenery features and current regressions until reproducible current traces are analyzed. No live build was benchmarked for this review.
