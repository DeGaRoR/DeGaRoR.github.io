# Wingsmith performance — consolidated living report

Updated: 2026-11-21T04:46:35.204Z. Branch: codex/wingsmith-performance-audit. This is the single report to read and update for subsequent sessions. It includes observations, analysis, successes, failed attempts, measurement corrections and data references. The current summary takes precedence over historical next-step/status statements reproduced below.

## Latest validated native-player mist comparison

User selected original mist C versus approved B on the corrected build, with the same accepted cliff/runtime-aircraft-bake cuts. Both completed14/14 circuit steps; all seven scenery systems, town and original high-poly runway geometry/cues retained. Experimental ground/runway caches off; original scuff unchanged. Same private saved Cub/full hangar,5120×1271/DPR1,30fps cap, fresh visible Chrome profiles, normal player clock verified. Driver cache not erased.

| Build73f492674f4c | Original mist C | Approved mist B |
| --- | ---: | ---: |
| Garage observed, saved night (s) | 151.460 | 130.560 |
| dry taxi chase: rendered FPS / p99 gap(ms) | 28 / 50.1 | 27.5 / 50.2 |
| dry taxi cockpit: rendered FPS / p99 gap(ms) | 28.2 / 50.1 | 29.1 / 50 |
| dry airborne chase: rendered FPS / p99 gap(ms) | 23.9 / 66.8 | 23.8 / 83.4 |
| dry airborne cockpit: rendered FPS / p99 gap(ms) | 30 / 33.5 | 30 / 33.5 |
| active mist chase: rendered FPS / p99 gap(ms) | 23.1 / 83.3 | 25.6 / 66.7 |
| active mist cockpit: rendered FPS / p99 gap(ms) | 23.3 / 66.7 | 26.8 / 50.2 |
| the circuit to the final: rendered FPS / p99 gap(ms) | 27.3 / 66.7 | 27.1 / 66.7 |
| land and stop on HOME: rendered FPS / p99 gap(ms) | 25.2 / 66.8 | 25.1 / 66.8 |

One matched pair: no sustained dry-flight slowdown; active mist improves23.1→25.6fps outside and23.3→26.8fps in cockpit. This does not prove every world/weather/crash. Both report GL0 at garage/all steps/final and zero post-circuit draw errors. Same two known birch/pine impostor snag-sheet warnings remain. Peak85°C(C)/86°C(B). First cockpit use still hitches684ms(C)/317ms(B); steady-flight samples have no≥250ms gaps. C departure includes a2251ms stall; cover transitions are not steady airborne samples.

Cold garage timing151.461→130.560s:20.900s/13.8% shorter in this pair. BOOT gone stamps150.541/130.249s; table consistently uses the later observer timestamp. WorldCompile63.477→38.755s, partly offset by quiet-frame step6.146→14.223s. These stages overlap GPU/background work; do not add deltas as exclusive shader bills.

**Departure correction:** both native circuits change saved night to noon AFTER garage timing. B submits164 additional shader links and spends38.440s in rollout preparation. Its54s departure therefore includes a lighting change and cannot be attributed just to the native clock or compared with earlier9s unchanged-night trips. Repeated preparation across lighting signatures is a substantial next target. Earlier page_rig disables vsync/frame limiting and uses port0, selecting the legacy diagnostic clock; its FPS is not native-player evidence.

Untouched published original attempt1 reached241.680s with GL1282, then dashboard-monitor timeout; excluded. Attempt2 failed its own normal loader watchdog near258s; no FPS accepted. User selected corrected C/B after these two misses. First corrected-C attempt (~163s garage) was falsely stopped by the old eight-poll flight observer despite advancing simulation; excluded. Native observer now requires two advancing samples, never reclicks during active cinematic, and passes long-reveal/stopped-simulation unit checks. Retry completed; taxi camera aligned at simulation8.2s. No game watchdog extended. Direct read-only CPU sensors replace full hardware-dashboard polling; missing/invalid readings still fail closed. No fan/power/hardware changes.

### Simplified scuff: preliminary evidence and next validation

Lite uses one analytic buckle field and three filtered reads of the existing grunge texture; dents, directional abrasion/stains, exposed substrate, ragged torn edges and computed mud remain. Window crack body unchanged. Liteone also shares intact/damaged opaque surface programs; glass retains original asleep/awake paths. Both remain opt-in: integrated loading/image/GPU results follow; fine-pattern visual approval and full-flight validation remain pending.

Two opposite-order compiler screens link12/12 with GL0, peak63°C. Representative surface original3.405/3.322s, full shared-mud3.955/3.540s, lite2.258/2.088s (~35% below original). Window~0.46s unchanged. Screen predates final material-class guards: preliminary, not a whole-game loading or FPS saving.

## Simplified surface damage: integrated loading and controlled rendering

Fresh visible Chrome profiles, saved Cub/full hangar,5120x1271/DPR1. Legacy diagnostic-clock startup measurements; native-player mist/FPS circuit reported separately. Mist B, all seven scenery systems and original full runway geometry/cues retained. Accepted advanced-cliff/runtime-aircraft-bake cuts only. Experimental caches off. Original-scuff controls bracket lite candidates;20s garage soak; no world departure in loading cases. Controlled damage/deposit images and GPU patches follow cold timing and are excluded from loading. Window crack body unchanged; shared-state candidate applies only to opaque surfaces. Driver cache not erased.

| Case | Garage (s) | Shorter than reference (s) | Submitted links | Damage-capable links | Peak CPU (°C) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Approved mist B, original scuff | 141.954 | 0.000 | 565 | 8 | 76 |
| Simplified scuff, two states | 140.720 | 1.234 | 566 | 10 | 84 |
| Simplified scuff, shared surface state | 126.007 | 15.947 | 560 | 24 | 85 |
| Repeated original-scuff reference | 128.126 | 13.828 | 566 | 10 | 84 |
| Shared surface state — repeat after closing reference | 124.677 | 17.277 | 559 | 24 | 87 |

These are independent loading observations. Lite replaces fine procedural damage networks with three filtered reads of the existing grunge texture while keeping dents, directional abrasion, exposed substrate, torn edges and computed mud. Window crack body remains unchanged. Liteone additionally shares intact/damaged opaque surface programs, with a possible intact-frame overhead that requires measurement. Glass keeps the original asleep/awake paths. Candidates remain opt-in until loading, image activity and GPU costs are reviewed.

Damage-capable link counts include intact surfaces in shared-state mode; they do not count actual damaged aircraft. Opening original-scuff reference141.954s and closing128.126s show13.828s drift. Shared-state126.007s is15.947s below opening but only2.119s below closing: no established16s causal saving. Repeat after closing reference is recorded separately. Ordinary two-state lite140.720s establishes no startup gain.

Repeat shared-state candidate124.677s, 3.448s below the closing reference. Candidates cluster124.7–126.0s; controls128.1–142.0s. This is a modest startup signal with substantial control drift, not a clean16s saving. All five cases pass normal readiness/GL/20s garage soak; all peaks≤87°C. Main recommendation: retain the opt-in two-state lite as an active-damage rendering candidate; its intact path is unchanged. Keep shared-state mode experimental because its intact patch overhead has not been checked through a native full flight. No new default or visual acceptance is claimed.

### Controlled active-damage GPU checks

Four actual Cub material classes,512² offscreen patches, synthetic uniform damage and deposit records. Four alternating-order samples/profile,12 draws/query. These are isolated patch times, not whole-world FPS. Intact output is pixel-identical; damage-on/off and mud-on/off both change pixels for all four classes. No query disjoint/errors in this run.

| Finish | Original active (ms/draw) | Full + shared mud | Lite + shared mud | Lite with damage off | Original intact |
| --- | ---: | ---: | ---: | ---: | ---: |
| fabric | 0.1484 | 0.1578 | 0.0721 | 0.0742 | 0.0569 |
| rubber | 0.1830 | 0.1929 | 0.0876 | 0.0721 | 0.0713 |
| steelTube | 0.0273 | 0.0297 | 0.0171 | 0.0166 | 0.0156 |
| ply | 0.0707 | 0.0736 | 0.0370 | 0.0299 | 0.0283 |

Active simplified patch cost is37–52% below original in this test, with computed mud restored. Keeping the damage code present when inactive adds~0.001–0.017ms/draw on these patches (~1–30% relative, depending finish); that is the shared-state tradeoff. Ordinary two-state lite keeps original asleep shaders for intact surfaces. Fine scratch/gouge/fray patterns are visibly simplified; images are controlled material tests, not a physical crash validation. Window crack body is unchanged by source equivalence test; glass remains two-state.

Controlled forced-damage panel images: [original surface](evidence/PERFORMANCE-2026-11-21/scuff-lite-integrated/lite/scuff-fabric-originalDry.png), [simplified surface](evidence/PERFORMANCE-2026-11-21/scuff-lite-integrated/lite/scuff-fabric-liteDry.png), [simplified with computed mud](evidence/PERFORMANCE-2026-11-21/scuff-lite-integrated/lite/scuff-fabric-liteMud.png).

Current interactive figures: [loading comparison](figures/loading-measurement-history.html), [current loading waterfall](figures/garage-waterfall-current.html). Eight comparison groups preserve historical and new valid measurements, with native/diagnostic clock modes separated. Waterfall unknown/zero-duration rows are hidden while gaps remain. Source-identified example program intervals are parallel observations, not exclusive costs; complete per-building/cloud/vegetation attribution is not claimed for the new captures. Desktop1024px/narrow320px and changed selections checked in an isolated browser. GPU-disabled screenshot rendering clipped waterfall text despite valid layout; normal graphics rendering plus font readiness produced readable labels. All five new load cases peaked≤87°C.

Branch checkpoints04411db93 (approved optimizations),5989b85c1 (sensor monitoring),bf1ba4408 (opt-in scuff prototypes). Generated main files, private save and raw flight logs excluded from commits. Under20s garage/under60s initial loading remain unmet.


## Earlier native-comparison plan (superseded by validated results above)

User requests all defect types retained, simplified where necessary: mud, surface damage and window cracks. Simplified surface prototype scuffopt=lite uses one analytic buckle field and three reads of the existing grunge texture for dents, directional abrasion/stains, exposed substrate and ragged torn edges. Fine3D cellular paint networks and independent millimetre stroke lattices are replaced with filtered texture detail; window crack shader body remains unchanged. Shared grunge preserves computed mud; no finish-class shader multiplication. Test remains OFF pending loading/active-render/visual checks. Original/full, shared-sampler-only and lite are separate candidates, not one assumed improvement.

### Measurement correction

Earlier page_rig FPS used disabled vsync/frame limiting and port0, which Chrome can identify as automated. The game then uses its diagnostic legacy clock. Those numbers do not establish native-player FPS or a smoothness regression. New live:true mode uses a nonzero debugging port without the uncapped flags, visible Chrome, the same private Cub/full-hangar save,5120×1271/DPR1 and saved30fps cap. It verifies webdriver false and clock.legacy false. The established flight_script runner now samples changes in renderer frame count rather than counting every screen callback, and records delivered FPS/p90/p99/hitches/freezes per step. The route includes taxi, take-off, climb, chase/cockpit, forced-active mist, approach and landing. Full flight logs retain CPU/GPU splits. Intrusive draw diagnosis runs only AFTER timed circuit steps.

### Code-based runtime risk assessment

- Exact terrain/road memoization and avoiding repeated preparation should reduce work without adding render passes; equivalence tests do not substitute for player-clock profiling.
- Advanced-cliff fallback and runtime aircraft-bake/fleet removal are the accepted cuts; they can reduce geometry/memory, but the original-versus-current comparison therefore has a declared visual/content difference.
- Approved mist B moves density sampling from ordinary surface shaders into the cloud pass. It removes repeated work but changes GPU sampling/integration: active weather and camera views must be measured.
- Restoring computed mud adds volume-texture reads to awakened damage materials. Sharing the same grunge sampler prevents exceeding sampler limits; it is not by itself an FPS saving.
- Full class specialization multiplied damaged program instances6→18 and failed loading. It stays off; the lite candidate shares the existing class-general variants.
- Experimental ground/runway caches add sampling/passes/memory and previously showed runtime risks. They remain off in the current comparison.
- Correcting old shadow-sampler bindings can make previously failed draws execute. The original native-clock garage reported GL1282, so raw original FPS may include missing graphics; draw diagnostics/screenshots are required before treating it as an equal-rendering control.

| Native-player run | Garage reached (s) | Clock | Circuit status |
| --- | ---: | --- | --- |
| original | — | not verified | Pending |
| current | 130.560 | normal player | Complete |
| ↳ board | — | — rendered FPS | p99 —ms; max —ms; >100ms — |
| ↳ start-up | — | 27.2 rendered FPS | p99 116.6ms; max 483.7ms; >100ms 15 |
| ↳ dry taxi chase | — | 27.5 rendered FPS | p99 50.2ms; max 100.1ms; >100ms 1 |
| ↳ dry taxi cockpit | — | 29.1 rendered FPS | p99 50ms; max 316.7ms; >100ms 1 |
| ↳ taxi to the hold | — | 28.9 rendered FPS | p99 50.1ms; max 83.4ms; >100ms 0 |
| ↳ take-off | — | 26.2 rendered FPS | p99 66.7ms; max 83.4ms; >100ms 0 |
| ↳ climb to 150 m | — | 29 rendered FPS | p99 50.1ms; max 66.8ms; >100ms 0 |
| ↳ dry airborne chase | — | 23.8 rendered FPS | p99 83.4ms; max 116.8ms; >100ms 1 |
| ↳ dry airborne cockpit | — | 30 rendered FPS | p99 33.5ms; max 50.1ms; >100ms 0 |
| ↳ active mist chase | — | 25.6 rendered FPS | p99 66.7ms; max 83.5ms; >100ms 0 |
| ↳ active mist cockpit | — | 26.8 rendered FPS | p99 50.2ms; max 83.3ms; >100ms 0 |
| ↳ restore saved weather | — | 23.5 rendered FPS | p99 100.1ms; max 100.1ms; >100ms 1 |
| ↳ the circuit to the final | — | 27.1 rendered FPS | p99 66.7ms; max 100.2ms; >100ms 1 |
| ↳ land and stop on HOME | — | 25.1 rendered FPS | p99 66.8ms; max 183.5ms; >100ms 6 |

Attempt original-attempt-1 reached241.680s in native-player mode, GL1282, then stopped on LHM dashboard timeout just after departure. Entire attempt excluded from completed comparisons; no flight smoothness verdict. Monitoring discovered read-only Core Max/Package sensor IDs once, then polls Sensor?action=Get (7–16ms in preflight) instead of rebuilding the83KB hardware dashboard each second. Missing/invalid readings still stop the owned process tree; temperature limits are not relaxed. No CPU/fan/power or monitor configuration change. [API source](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor/blob/master/LibreHardwareMonitor.Windows.Forms/Utilities/HttpServer.cs).

Checkpoint04411db93 preserves completed approved-mist/performance work. Reconstructed index/dev/flight_core/sw/version outputs and private save remain excluded from commits. New benchmark harness and simplified scuff are separate phases to commit after validation. No original/current native smoothness conclusion is established until both runs complete and rendering correctness is qualified.


## Previous completed decision

User explicitly approved mist B after seeing two daylight A/B views: softer cloud-pass haze preferred over original bright surface pockets. Build73f492674f4c makes cloud-pass mist the ordinary default when clouds are enabled; cloudless presets retain the original veil. Live mist off/on updates all techniques, and crossing cloudless/cloud-pass settings reloads into the correct compiled method. Focused tests cover saved/explicit settings, preset/profile/welcome/software selection and live switches. Scuff specialization/shared-grunge prototype and experimental runway/ground/mist caches remain OFF by default. All seven prioritized scenery systems, town and original high-poly runway geometry/cues remain in benchmark; ONLY advanced cliffs and runtime player-derived aircraft bakes excluded via perftrim=1. Latest valid observations: Original veil mist / original scuff 181.188s (buildca358c1224b4, peak78C); Original veil mist / specialized scuff + live mud 167.714s (buildca358c1224b4, peak83C); Cloud-pass pocket mist / specialized scuff + live mud 138.327s (buildca358c1224b4, peak86C); Cloud-pass mist / full-detail specialized scuff + live mud 133.775s (build83ba2179d8e5, peak86C); Cloud-pass mist / full-detail specialized scuff + live mud 134.003s (build83ba2179d8e5, peak89C); Original surface-veil mist and scuff 161.865s (build83ba2179d8e5, peak86C); Original mist / full-detail optimized scuff + live mud 199.560s (build83ba2179d8e5, peak90C); Approved mist B / original scuff, actual default 131.625s (build73f492674f4c, peak87C). Latest same-build83ba2179d8e5: original methods161.865s, combined mist B/scuff134.003s, scuff-only199.560s. The earlier scuff181.188→167.714 screening pair did not establish a repeatable gain. New cold damaged shader instances increased6→18 (all links563→574); default scuff remains unchanged. Controlled actual fabric/steel/ply parts with damage-on/off activity checks now show pixel-identical general-vs-specialized results, with mud active; computed mud restoration changes pixels versus old GD_OFF. These are synthetic material probes, not a physical crash or full-fleet visual acceptance. Empty images from a local/world camera mismatch and nonempty-but-damage-inactive comparisons caused by live-frame uniform resets are rejected; corrected tests explicitly reapply damage/grid uniforms before synchronous draws. Mist hash atlas/compact-loop caches failed consistent compile gains; parked OFF. GL1281 remains intermittent/unidentified: failures and instrumented timings excluded; subsequent ordinary runs passed. Loader quiet-frame handoff watchdog recognizes landing progress without extending any threshold. Current thermal policy matches updated user steering: brief95C peaks allowed, no sustained90C; first94C stop or3s90C+,1Hz/fail-closed monitoring. Earlier conservative thermal stops remain excluded, never retroactively accepted. GFX gate has one pre-existing device-probe whitelist failure in unchanged perf_bench.js (also in HEAD); other assertions pass and focused new mist tests pass. No publication or commit of generated main files. Under20s garage remains unmet. Approved actual-default run:131.625s garage, no fmist/scuffopt override, GL zero and normal readiness, garage20s soak median9.8/p99 12.8/max27.2ms with no100ms gaps or long tasks. Unchanged-design departures9.456/9.364s, returns0.636/0.317s, peak87C. This is30.241s/18.7% shorter than the latest161.865s original-method reference from the preceding build; not a repeated same-build causal estimate. World stand samples still about43ms/~23fps; first had one147.6ms hitch, second max47.5ms. No claim of smooth crashes, edited-aircraft readiness or full scripted-circuit acceptance.


## Measured change ledger — seconds, not cumulative claims

Positive delta means a shorter wait. Each row is its own comparison, never a cumulative saving. Scene/clock/scope differences prohibit adding rows. Invalid or aborted runs never count. Diagnostic exclusions are not accepted graphics settings. For repeated runs the delta below uses their arithmetic means; individual times remain visible. Different clocks and fixtures are labelled. Historical pairs without repetition remain screening evidence.

| Change | Scope | Control (s) | Candidate (s) | Shorter by (s) | Decision / evidence |
| --- | --- | ---: | ---: | ---: | --- |
| Initial published build to early combined audit | Full hangar; aggregate across builds | 243.853 | 211.248 | 32.605 | Observed aggregate; individual attribution unavailable. [Evidence](BASELINE-RECONCILIATION-2026-11-19.md) |
| Prepare final village-lamp count before shader prelinks | Studio; startup clock; appearance preserved | 215.408 | 194.792 / 195.128 | 20.448 | Retained; two candidate runs; later control 217.408 also supports direction. [Evidence](LAMP-PRELINK-2026-11-19.md) |
| Share coarse/fine ground programs | Startup comparison; same experiment only | 192.890 | 203.550 | -10.660 | Failed; default off. [Evidence](PERFORMANCE-ATTEMPTS-2026-11.md) |
| Pad reflection lights with zero-intensity lights | Startup comparison; visual acceptance incomplete | 192.890 | 203.170 | -10.280 | Failed; default off despite fewer links. [Evidence](PERFORMANCE-ATTEMPTS-2026-11.md) |
| Replace player-derived parked aircraft with static trio | Studio; single pair | 181.930 | 180.615 | 1.315 | No established loading benefit; exclusion subsequently accepted by user. [Evidence](STATIC-PROPS-AND-TOWN-2026-11-19.md) |
| Replace player-derived parked aircraft with static trio | Full hangar; single pair | 211.248 | 233.963 | -22.715 | No loading benefit; do not claim fleet removal saved startup seconds. [Evidence](STATIC-PROPS-AND-TOWN-2026-11-19.md) |
| Town 383 to 129 plots | Matched kit backend; single pair | 172.495 | 173.869 | -1.374 | No startup benefit; not retained as an accepted cut. [Evidence](STATIC-PROPS-AND-TOWN-2026-11-19.md) |
| Split ground material construction and lighting, packed buffer | Full hangar; build ee694f8981b9; navigation-to-ready | 208.592 / 218.046 | 205.694 / 206.659 | 7.143 | Functional opt-in only; modest result, ~99 MiB buffers and worse world cadence. [Evidence](evidence/PERFORMANCE-2026-11-19/material-cache/integrated-comparison.json) |
| Reuse existing road-distance bound in five query callers | Accepted cliffs/bakes exclusions; full hangar; single pair | 164.591 | 161.388 | 3.203 | Retained; observed pair, not a fixed guaranteed saving; 100940 equivalence checks. [Evidence](evidence/PERFORMANCE-2026-11-19/material-cache/integration-journal.json) |
| Repair mixed terrain-cache hash | Full hangar; comparison crossed restart | 164.872 | 162.003 | 2.869 | Retained; observed pair only; do not attribute earlier 193-to-162 shift to this change. [Evidence](evidence/PERFORMANCE-2026-11-19/material-cache/integration-journal.json) |
| Broader scenery/effects exclusions, runway cues retained | Full hangar; additional quality cuts beyond accepted cliffs/bakes | 164.591 | 121.247 | 43.344 | Diagnostic only; unacceptable quality losses. [Evidence](evidence/PERFORMANCE-2026-11-19/material-cache/integration-journal.json) |
| Remove runway shader relief cues | Full hangar; other systems retained | 164.591 | 152.447 | 12.144 | Rejected; cues required to read physical relief. [Evidence](evidence/PERFORMANCE-2026-11-19/material-cache/integration-journal.json) |
| Broader scenery/effects exclusions plus runway cues off | Full hangar; lowest visual-cut diagnostic | 164.591 | 95.740 | 68.852 | Rejected; not an approved target or preserved-quality optimization. [Evidence](evidence/PERFORMANCE-2026-11-19/material-cache/integration-journal.json) |
| Exact runway noise-corner coefficient cache | Full hangar; existing relief/weather cues preserved | 164.591 | 182.456 | -17.864 | Failed; disabled; also slower in isolated GPU check. [Evidence](evidence/PERFORMANCE-2026-11-19/material-cache/trimmed-pavnoise-1/) |
| Damage/scuff off | Same build 780109adbe73; startup-only; all five other prioritized systems, town, runway cues, cracks and physics retained | 161.654 / 160.100 | 148.000 | 12.877 | Diagnostic exclusion only; one off-run, two bracketing controls. [Evidence](evidence/PERFORMANCE-2026-11-20/damage-mist-comparison/analysis.json) |
| Pocket mist and damage/scuff off | Same build 780109adbe73; startup-only; all five other prioritized systems, town, runway cues, cracks and physics retained | 161.654 / 160.100 | 116.105 | 44.772 | Diagnostic exclusion only; one off-run, two bracketing controls. [Evidence](evidence/PERFORMANCE-2026-11-20/damage-mist-comparison/analysis.json) |
| Pocket mist off | Same build 780109adbe73; startup-only; all five other prioritized systems, town, runway cues, cracks and physics retained | 161.654 / 160.100 | 125.702 | 35.175 | Diagnostic exclusion only; one off-run, two bracketing controls. [Evidence](evidence/PERFORMANCE-2026-11-20/damage-mist-comparison/analysis.json) |
| Scuff OFF; damage look ON | Separate screening; matched reference interrupted | — | 152.665 | Not established | Actual ready time only; no marginal saving claim. [Evidence](evidence/PERFORMANCE-2026-11-20/runway-fields-integrated/analysis.json) |
| Higher-level runway relief/curvature bake | Build 0ab57604f54a; matched reference interrupted | — | 157.672 | Not established | Integrated/image/GPU prototype; default OFF;128 MiB extra GPU texture plus CPU backing. [Evidence](evidence/PERFORMANCE-2026-11-20/runway-fields-integrated/candidate-2/summary.json) |

Negative values mean slower. None of the rows may be added together: their changes, build states, shader overlap and controls differ. The current accepted-quality total must be read from its own controls, not reconstructed by subtracting this ledger from the original reference. A lower diagnostic time is not a delivered optimization.

Work without an isolated whole-startup comparison (terrain-neighbour memoization, generator yielding, shadow-sampler correctness, readiness/polling fixes) stays documented without invented seconds saved. Compiler-only and image/GPU probes are listed in their own evidence sections; their seconds are not garage-loading savings. Safety stops, watchdog exits and GL-error runs remain failures and are excluded. Future sessions must add the control and candidate evidence, scene, source build, timing clock, validation outcome and visual scope before claiming another saving.

### Mist/scuff implementation screening

| Change | Reference (s) | Candidate (s) | Shorter by (s) | Scope |
| --- | ---: | ---: | ---: | --- |
| Original veil mist / specialized scuff + live mud | 181.188 | 167.714 | 13.474 | Same build ca358c1224b4; one pair, not additive. Cloud-pass mist changes lighting/integration and needs review; scuff retains detail/restores mud. [Evidence](evidence/PERFORMANCE-2026-11-20/mist-scuff-optimization/analysis.json) |
| Cloud-pass pocket mist / specialized scuff + live mud | 181.188 | 138.327 | 42.862 | Same build ca358c1224b4; one pair, not additive. Cloud-pass mist changes lighting/integration and needs review; scuff retains detail/restores mud. [Evidence](evidence/PERFORMANCE-2026-11-20/mist-scuff-optimization/analysis.json) |

These screening results do not replace the repeated accepted-quality reference or establish a final visually approved preset.

### Latest same-build mist/scuff comparison

| Configuration | Original-method reference (s) | Candidate (s) | Shorter by (s) | Evidence |
| --- | ---: | ---: | ---: | --- |
| Cloud-pass mist / full-detail specialized scuff + live mud | 161.865 | 134.003 | 27.862 | Build83ba2179d8e5; fresh browser profiles, driver cache not erased. One run each; visual scope and screenshots in follow-up. [Raw](evidence/PERFORMANCE-2026-11-20/mist-scuff-cooled/analysis.json) |
| Original mist / full-detail optimized scuff + live mud | 161.865 | 199.560 | -37.694 | Build83ba2179d8e5; fresh browser profiles, driver cache not erased. One run each; visual scope and screenshots in follow-up. [Raw](evidence/PERFORMANCE-2026-11-20/mist-scuff-cooled/analysis.json) |

No sum of the scuff-only and combined differences is valid. Active-mist runtime observations and damage patch comparisons are post-cold diagnostics, not a complete scripted playtest.

### Approved mist B alone as the branch default

131.625s, build73f492674f4c, no mist/scuff query override; original scuff. Previous-build original-method reference161.865s: observed30.241s/18.7% shorter. Cloud-pass appearance explicitly approved after two A/B views; all other prioritized systems, town and full runway detail/cues retained, with accepted cliff/runtime-bake exclusions. This is not a repeated same-build marginal estimate. Normal-ready/GL/20s garage soak plus two unchanged-design trips passed; world FPS/hitches remain unresolved. [Evidence](evidence/PERFORMANCE-2026-11-20/mist-approved-default/analysis.json).


## Latest mist/scuff work — measured outcomes and limits

The user approved the softer cloud-pass B appearance on21 Nov after viewing both paired screenshots. It is now the preferred method with clouds enabled; cloudless presets retain the original veil. Earlier build83ba2179d8e5 comparisons used explicit method flags, before this default-selection integration. Cloud-pass mist (fmist=a) retains the pocket density model but integrates and lights it differently: the alternative appearance approved by the user after A/B review; no identical-look claim. In that method, the unused surface-veil call is removed, then its unused density-library text is confined to the cloud pass. Standard fog/clouds and all other prioritized scenery, original high-poly runway geometry/cues and town remain. Common accepted exclusions are advanced cliffs and runtime player-derived aircraft bakes. No high-memory runway cache is involved.

Scuffopt=1 is a test, not a default setting. It keeps ALL existing damage detail, specializes only materials whose authoritative geometry/record class agrees (general fallback otherwise), shares the exact same cached grunge texture with weathering, and restores computed mud/rain in damaged shaders. No dents, strokes, paint removal, gouges, fraying or crack detail is intentionally cut. Intact keys remain shared; awake classes may add programs while making each cheaper.

| Study | Configuration | Actual ready (s) | Build | Evidence / status |
| --- | --- | ---: | --- | --- |
| First eight-job comparison | Original veil mist / original scuff | 181.188 | ca358c1224b4 | Normal ready / GL checks /20s garage soak. [Raw](evidence/PERFORMANCE-2026-11-20/mist-scuff-optimization/analysis.json) |
| First eight-job comparison | Original veil mist / specialized scuff + live mud | 167.714 | ca358c1224b4 | Normal ready / GL checks /20s garage soak. [Raw](evidence/PERFORMANCE-2026-11-20/mist-scuff-optimization/analysis.json) |
| First eight-job comparison | Cloud-pass pocket mist / original scuff | — | — | Excluded: thermal/sensor safety stop. [Raw](evidence/PERFORMANCE-2026-11-20/mist-scuff-optimization/manifest.json) |
| First eight-job comparison | Cloud-pass pocket mist / specialized scuff + live mud | 138.327 | ca358c1224b4 | Normal ready / GL checks /20s garage soak. [Raw](evidence/PERFORMANCE-2026-11-20/mist-scuff-optimization/analysis.json) |
| Separated density library | Reference: original veil mist / original scuff | — | — | Excluded: thermal/sensor safety stop. [Raw](evidence/PERFORMANCE-2026-11-20/mist-scuff-optimization-final/manifest.json) |
| Separated density library | Cloud-only density library / original scuff | — | 441e266648f5 | Excluded: loader or graphics validation failed. [Raw](evidence/PERFORMANCE-2026-11-20/mist-scuff-optimization-final/manifest.json) |
| Separated density library | Cloud-only density library / specialized scuff + live mud | — | — | Excluded: thermal/sensor safety stop. [Raw](evidence/PERFORMANCE-2026-11-20/mist-scuff-optimization-final/manifest.json) |
| Six-job diagnostic | 6 jobs: original veil / original scuff | — | 83ba2179d8e5 | Excluded: loader or graphics validation failed. [Raw](evidence/PERFORMANCE-2026-11-20/mist-scuff-paced6/manifest.json) |
| Final eight-job candidate | Cloud-only pocket mist / full-detail specialized scuff + live mud | — | 83ba2179d8e5 | Excluded: loader or graphics validation failed. [Raw](evidence/PERFORMANCE-2026-11-20/mist-scuff-result/manifest.json) |
| Approved actual default | Approved mist B / original scuff, actual default | 131.625 | 73f492674f4c | Normal ready / GL checks /20s garage soak and two unchanged-design round trips. [Raw](evidence/PERFORMANCE-2026-11-20/mist-approved-default/analysis.json) |
| Cooled final comparison | Cloud-pass mist / full-detail specialized scuff + live mud | 134.003 | 83ba2179d8e5 | Normal ready / GL checks /20s garage soak. [Raw](evidence/PERFORMANCE-2026-11-20/mist-scuff-cooled/analysis.json) |
| Cooled final comparison | Original surface-veil mist and scuff | 161.865 | 83ba2179d8e5 | Normal ready / GL checks /20s garage soak. [Raw](evidence/PERFORMANCE-2026-11-20/mist-scuff-cooled/analysis.json) |
| Cooled final comparison | Original mist / full-detail optimized scuff + live mud | 199.560 | 83ba2179d8e5 | Normal ready / GL checks /20s garage soak. [Raw](evidence/PERFORMANCE-2026-11-20/mist-scuff-cooled/analysis.json) |
| Ordinary combined validation | Cloud-pass mist / full-detail specialized scuff + live mud | 133.775 | 83ba2179d8e5 | Normal ready / GL checks /20s garage soak. [Raw](evidence/PERFORMANCE-2026-11-20/mist-scuff-clean-validation/analysis.json) |

Intermittent GL_INVALID_VALUE1281 also occurred with ordinary eight-job pacing, so six-job pacing alone is not an established cause. A synchronous every-call GL diagnostic distorted preparation severely and is excluded. A later history-only trace completed with GL zero, no deleted-program/oversize-array suspects and peak83°C; tracing changes overhead, so that is diagnostic evidence only. Root cause of the intermittent error remains unidentified. [Trace](evidence/PERFORMANCE-2026-11-20/mist-scuff-gl-history/gl-call-history.json).

A warm quality-repeat attempt reached90°C during early CPU preparation and was terminated; it contributes no timing or image acceptance. Follow-up cases require a33°C start after60s cooling and use an85°C stop margin. [Thermal record](evidence/PERFORMANCE-2026-11-20/mist-scuff-quality-validation/thermal.jsonl). The ordinary133.775-second candidate had a20s garage soak with1856 frame intervals, median10.2ms, p99 13.9ms, maximum33.2ms, no100ms gaps and no long tasks. This is garage evidence, not a crash/circuit guarantee.


First same-build scuff pair: 181.188→167.714 s, observed 13.474 s shorter. This includes restored mud, not a feature removal. Single pair; a later completed reference is still needed to separate compiler/cache variation. The three largest default material sources matched earlier160-second captures byte-for-byte despite the181-second reference. Do not call that whole timing shift a code regression or combine savings from unrelated controls.

Fastest **valid** mist/scuff observation in this series: 131.625 s, Approved mist B / original scuff, actual default, build73f492674f4c. This is an observed test result with the visual scope above, not a guaranteed final preset or a repeatability claim.

### Failed preserved-model mist cache

Four GPU-baked wrapped hash corners were designed to reuse the selected recipe's unused contour tile in the existing atmosphere atlas, with no extra sampler/allocation. All six density noise terms, weather and interpolation were retained (half-float quantization would still require image checks). The isolated compile did not improve consistently:

| Order | Material | Original (s) | Cache (s) |
| --- | --- | ---: | ---: |
| 1 | Fine ground | 9.455 | 9.957 |
| 1 | Pavement | 32.127 | 31.087 |
| 2 | Fine ground | 9.124 | 9.377 |
| 2 | Pavement | 31.347 | 33.020 |

All eight links passed, peak67°C. Parked/default OFF; no full-loading win or rendered cache acceptance claimed. Do not repeat hash caching or the earlier compact loop without a new lead. [Evidence](evidence/PERFORMANCE-2026-11-20/mist-atlas-study/results.json).

### Loader correction and rejected measurements

The separated-library mist-only run completed all24 preparation steps, GL error zero, then failed at about130.270 s while confirming quiet frames. It remains excluded. Root cause: recent chain progress counted only in loading state, not the landing state used to confirm three quiet rendered frames after preparation. The narrow fix recognizes that handoff as recent progress. Idle30s, hard120s and absolute5×hard thresholds remain unchanged. Focused tests reproduce the old premature failure and verify normal frame-confirmed readiness plus retained idle/absolute failures; BOOT_HEALTH still rejects failures. No earlier failure is retroactively accepted.

Six-job preparation was attempted to reduce thermal contention, but its reference produced GL_INVALID_VALUE1281 despite a normal ready event. Excluded; eight jobs retained for final validation. Safety stops and sensor timeouts are kept in the manifests/thermal logs, not plotted as speeds. An automatic approval-service usage failure prevented one launch; that action was not executed. It resumed only after the user asked to continue and the service accepted it.

### Active-effect and rendering checks

Initial diagnostic code mistakenly called CLOUDS.stats as a function (it is an object), then used an unexported AEROWX.U field. Both diagnostic errors were corrected. They provide no image-equivalence claim. Later probes preserve partial data if a diagnostic fails, separate from cold readiness.

Damage image acceptance rejected: the earlier probe did not demonstrate damage-on versus damage-off activity. The live frame resets shared damage/grid uniforms while asynchronous compilation yields. Corrected probes reapply those uniforms immediately before each synchronous draw and include an intact negative control. Nonempty pixels and zero difference alone are insufficient.

- mist-scuff-cooled/combined: class audit {"checkedMaterials":63,"specialized":63,"generalFallback":0}.

| Probe mist-scuff-cooled/combined | Forced pocket strength | Median frame interval (ms) | p99 (ms) | Samples | Cloud march active | GL error |
| --- | ---: | ---: | ---: | ---: | --- | ---: |
| Paused stand/free camera | 0 | 53.500 | 98.300 | 126 | true | 0 |
| Paused stand/free camera | 0.7 | 54.400 | 126.500 | 126 | true | 0 |

These are7-second scheduling samples in a paused stand view, not a scripted circuit or exclusive GPU timing. Forced mist checks actual activity despite the saved dry weather. Surface-veil mist does not require the cloud march to be active.


| Probe mist-scuff-cooled/control | Forced pocket strength | Median frame interval (ms) | p99 (ms) | Samples | Cloud march active | GL error |
| --- | ---: | ---: | ---: | ---: | --- | ---: |
| Paused stand/free camera | 0 | 56.000 | 86.900 | 122 | true | 0 |
| Paused stand/free camera | 0.7 | 65.900 | 83.800 | 105 | true | 0 |

These are7-second scheduling samples in a paused stand view, not a scripted circuit or exclusive GPU timing. Forced mist checks actual activity despite the saved dry weather. Surface-veil mist does not require the cloud march to be active.

Diagnostic limitation: Error: Empty scuff image: {"sourceDraw":{"range":{"start":0,"count":null},"indices":16992,"groups":[],"materialVisible":true,"colorWrite":true,"opacity":1,"side":0},"box":[-2.6113662719726562,-0.5521187782287598,-0.37679070234298706,2.8354270458221436,0.7871435284614563,0.37679070234298706],"matrix":[-0.10458905164232794,-0.13625133236887235,0.9851379115150657,0,-0.021126402162971153,0.9807685236812804,0.19402777658801862,0,-0.9926287981757782,-0.000519238559046422,-0.10545615021533662,0,-152.3311363614494,31.5068709033558,620.0174491227131,1],"calls":1,"triangles":5664}. [Partial evidence](evidence/PERFORMANCE-2026-11-20/mist-scuff-cooled/control/page-diagnostic.json).

- mist-scuff-cooled/scuff-only: class audit {"checkedMaterials":63,"specialized":63,"generalFallback":0}.

| Probe mist-scuff-cooled/scuff-only | Forced pocket strength | Median frame interval (ms) | p99 (ms) | Samples | Cloud march active | GL error |
| --- | ---: | ---: | ---: | ---: | --- | ---: |
| Paused stand/free camera | 0 | 61.100 | 86.800 | 111 | true | 0 |
| Paused stand/free camera | 0.7 | 65.900 | 86.600 | 103 | true | 0 |

These are7-second scheduling samples in a paused stand view, not a scripted circuit or exclusive GPU timing. Forced mist checks actual activity despite the saved dry weather. Surface-veil mist does not require the cloud march to be active.

| Damage patch finish | General vs specialized mean / max RGB byte error | Mud change (mean bytes) | Old mud-disable difference (mean bytes) |
| --- | ---: | ---: | ---: |
| fabric | 0.000 / 0 | 24.165 | 24.165 |
| steelTube | 0.000 / 0 | 9.537 | 9.537 |
| ply | 0.000 / 0 | 21.953 | 21.953 |

Actual Cub raw material/geometry for each available metal/fabric/wood class, synthetic uniform damage records and constant2x2x2 deposit grid, controlled lighting. General-vs-specialized comparison includes the same restored mud. This does not validate a physical crash, pane cracks or every merged aircraft. Empty images are rejected, including their GPU timings; zero error on zero covered pixels is not equivalence. RGB differences on covered pixels are numerical observations, not automatic approval of every aircraft, view or crash. Shader compile and small-patch GPU timings in the raw probe are separate from loading savings.

Damage image acceptance rejected: the earlier probe did not demonstrate damage-on versus damage-off activity. The live frame resets shared damage/grid uniforms while asynchronous compilation yields. Corrected probes reapply those uniforms immediately before each synchronous draw and include an intact negative control. Nonempty pixels and zero difference alone are insufficient.

- mist-scuff-clean-validation/combined: class audit {"checkedMaterials":63,"specialized":63,"generalFallback":0}.

| Probe mist-scuff-clean-validation/combined | Forced pocket strength | Median frame interval (ms) | p99 (ms) | Samples | Cloud march active | GL error |
| --- | ---: | ---: | ---: | ---: | --- | ---: |
| Paused stand/free camera | 0 | 56.500 | 70.000 | 125 | true | 0 |
| Paused stand/free camera | 0.7 | 59.500 | 64.900 | 119 | true | 0 |

These are7-second scheduling samples in a paused stand view, not a scripted circuit or exclusive GPU timing. Forced mist checks actual activity despite the saved dry weather. Surface-veil mist does not require the cloud march to be active.

### Approved mist alone: actual branch default and round trips

Build73f492674f4c, no fmist/scuffopt query override, saved cloud-half settings selected cloud-pass mist automatically. Original scuff remains the default. Garage131.625s; original-method previous-build reference161.865s, an observed30.241s (18.7%) difference, not a new repeated same-build causal estimate.

| Transition | Elapsed (s) |
| --- | ---: |
| departure-1 | 9.456 |
| return-1 | 0.636 |
| departure-2 | 9.364 |
| return-2 | 0.317 |

Normal ready, garage/departure/final GL zero,20s garage soak, peak87°C. Garage median/p99/max frame interval 9.800/12.800/27.200ms; no100ms gaps or long tasks. These are two unchanged-design trips, not an edited-aircraft certification benchmark or scripted circuit. World stand samples remain about43ms median (~23fps); first stand sample had one147.6ms hitch, second max47.5ms. World smoothness remains unresolved. [Raw](evidence/PERFORMANCE-2026-11-20/mist-approved-default/summary.json).

### Requested A/B screenshots

Fixed noon, common camera anchors, forced0.7 pocket strengths, same saved world. The cloud-pass option visibly changes integration: broader/softer haze versus the original brighter tree-local pockets. Equal input strength is not an artistic matching of opacity. The user approved B after reviewing both screenshot pairs; cloud-enabled default integration follows in build73f492674f4c.

- combined, airfield: [Screenshot](evidence/PERFORMANCE-2026-11-20/mist-scuff-cooled/combined-attempt-2/mist-airfield.jpg).
- combined, near-canopy: [Screenshot](evidence/PERFORMANCE-2026-11-20/mist-scuff-cooled/combined-attempt-2/mist-near-canopy.jpg).
- control, airfield: [Screenshot](evidence/PERFORMANCE-2026-11-20/mist-scuff-cooled/control/mist-airfield.jpg).
- control, near-canopy: [Screenshot](evidence/PERFORMANCE-2026-11-20/mist-scuff-cooled/control/mist-near-canopy.jpg).
- scuff-only, airfield: [Screenshot](evidence/PERFORMANCE-2026-11-20/mist-scuff-cooled/scuff-only-attempt-2/mist-airfield.jpg).
- scuff-only, near-canopy: [Screenshot](evidence/PERFORMANCE-2026-11-20/mist-scuff-cooled/scuff-only-attempt-2/mist-near-canopy.jpg).
- scuff-only, fabric, original: [Controlled material render](evidence/PERFORMANCE-2026-11-20/mist-scuff-cooled/scuff-only-attempt-2/scuff-fabric-original.png).
- scuff-only, fabric, optimized: [Controlled material render](evidence/PERFORMANCE-2026-11-20/mist-scuff-cooled/scuff-only-attempt-2/scuff-fabric-optimized.png).
- scuff-only, fabric, intact: [Controlled material render](evidence/PERFORMANCE-2026-11-20/mist-scuff-cooled/scuff-only-attempt-2/scuff-fabric-intact.png).
- scuff-only, steelTube, original: [Controlled material render](evidence/PERFORMANCE-2026-11-20/mist-scuff-cooled/scuff-only-attempt-2/scuff-steelTube-original.png).
- scuff-only, steelTube, optimized: [Controlled material render](evidence/PERFORMANCE-2026-11-20/mist-scuff-cooled/scuff-only-attempt-2/scuff-steelTube-optimized.png).
- scuff-only, steelTube, intact: [Controlled material render](evidence/PERFORMANCE-2026-11-20/mist-scuff-cooled/scuff-only-attempt-2/scuff-steelTube-intact.png).
- scuff-only, ply, original: [Controlled material render](evidence/PERFORMANCE-2026-11-20/mist-scuff-cooled/scuff-only-attempt-2/scuff-ply-original.png).
- scuff-only, ply, optimized: [Controlled material render](evidence/PERFORMANCE-2026-11-20/mist-scuff-cooled/scuff-only-attempt-2/scuff-ply-optimized.png).
- scuff-only, ply, intact: [Controlled material render](evidence/PERFORMANCE-2026-11-20/mist-scuff-cooled/scuff-only-attempt-2/scuff-ply-intact.png).

Scuff renders are isolated actual aircraft parts with synthetic damage records and a constant deposit grid, not screenshots of a physical crash. Visibility is forced on both sides under controlled lighting; geometry/camera bounds use the same world frame. Valid damage comparisons must demonstrate a nonzero damage-on/off difference and nonempty pixels.


## Final mist library separation / scuff comparison

Same build441e266648f5; saved Cub/full hangar; fresh visible Chrome5120x1271/DPR1 per case; normal ready, GL checks and20s garage soak. Approved advanced-cliff/runtime-bake exclusions only. Original detailed runway geometry/cues and all seven prioritized systems/town retained. No memory-heavy runway cache. Revision2 removes unused density-library text from ordinary materials in cloud-march mode; the cloud pass retains the same density functions. This changes no appearance relative to the existing cloud-march technique, but cloud-march versus original surface veil still differs in lighting/integration and is NOT an approved replacement. Scuff preserves all detail, specializes verified single-class materials and restores live computed mud. Startup precedes active-mist and damage-image probes; those diagnostic programs excluded from cold census. Reference and combined include forced-active mist stand checks. Driver cache erasure not claimed; individual/cross-build deltas are not additive.

| Case | Garage (s) | Shorter than reference (s) | Submitted links | Awake damage links | Peak CPU (°C) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Reference: original veil mist / original scuff — incomplete/excluded | — | — | — | — | 88 |
| Cloud-only density library / original scuff — incomplete/excluded | — | — | — | — | 84 |
| Cloud-only density library / specialized scuff + live mud — incomplete/excluded | — | — | — | — | 88 |

Cases are independent observations, not additive savings. Cloud-pass mist retains the effect but changes its integration/lighting and requires active-mist image/runtime review. Scuff optimization preserves the full damage model, specializes only audited single-class materials and restores computed mud through one shared grunge sampler; no fine-detail reduction is included. Default preset remains unchanged. [Evidence](evidence/PERFORMANCE-2026-11-20/mist-scuff-optimization-final/analysis.json).


## Pocket mist / scuff optimization tests

Same source build and saved Cub/full-hangar fixture, fresh visible Chrome5120x1271/DPR1 per run, normal readiness, GL checks and20s garage soak. Advanced cliffs/runtime player bakes excluded as approved; original detailed runway geometry/cues, animals, sub-alpine, forest edge, dust/spray, traffic and town retained. No high-memory runway cache. Reference mist is the existing surface veil; alternative mist uses the existing cloud march, with zero-sample veil preparation compiled away. This alternative has different lighting/integration and is an experiment, not an approved appearance replacement. Scuff class specialization falls back for mixed/unverified geometry; same damage detail retained, computed mud restored. Driver cache erasure not claimed; timings nonadditive. All cases retain bounded diagnostic sessions for active-mist/scuff checks; no diagnostic program is included in cold link counts.

| Case | Garage (s) | Shorter than reference (s) | Submitted links | Awake damage links | Peak CPU (°C) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Original veil mist / original scuff | 181.188 | 0.000 | 563 | 7 | 78 |
| Original veil mist / specialized scuff + live mud | 167.714 | 13.474 | 573 | 17 | 83 |
| Cloud-pass pocket mist / original scuff — incomplete/excluded | — | — | — | — | 89 |
| Cloud-pass pocket mist / specialized scuff + live mud | 138.327 | 42.862 | 575 | 18 | 86 |

Cases are independent observations, not additive savings. Cloud-pass mist retains the effect but changes its integration/lighting and requires active-mist image/runtime review. Scuff optimization preserves the full damage model, specializes only audited single-class materials and restores computed mud through one shared grunge sampler; no fine-detail reduction is included. Default preset remains unchanged. [Evidence](evidence/PERFORMANCE-2026-11-20/mist-scuff-optimization/analysis.json).


## Focused pocket-mist × damage/scuff comparison

Same source build, visible Chrome5120x1271/DPR1, private saved Cub/full-hangar fixture, fresh profile per run. Normal ready plus20s garage soak and GL checks. Animals, sub-alpine ecosystem, extra forest edge, dust/spray, traffic, town and original runway cues retained throughout. Crack-sheet loading and damage physics retained. Only accepted advanced-cliff/player-bake exclusions common to all cases. Two all-on controls bracket the four-condition2x2 comparison; no driver-cache erasure claim. Off configurations are diagnostic only. This narrows the previous damage/scuff/cracks group: cracks are not disabled here. Damage/scuff off changes appearance preparation; crash physics remains active.

| Configuration | Garage (s) | Runs |
| --- | ---: | ---: |
| All systems on | 160.877 | 2 |
| Damage/scuff off | 148.000 | 1 |
| Pocket mist off | 125.702 | 1 |
| Both off | 116.105 | 1 |

Observed conditional reductions: damage/scuff off with mist 12.877s; without mist 9.597s. Mist off with damage 35.175s; without damage 31.895s. Combined change 44.772s. Single runs per exclusion; these are screening effects, not exclusive/additive system costs.

| Run | Status | Garage (s) | Startup submissions | Max garage frame gap (ms) | CPU peak (°C) |
| --- | --- | ---: | ---: | ---: | ---: |
| reference-open | Completed | 161.654 | 565 | 35.100 | 79.000 |
| damage-scuff-off | Completed | 148.000 | 549 | 27.800 | 81.000 |
| both-off | Completed | 116.105 | 545 | 14.600 | 86.000 |
| mist-off | Completed | 125.702 | 565 | 14.300 | 85.000 |
| reference-close | Completed | 160.100 | 566 | 17.000 | 84.000 |

These startup-only runs do not validate an impact, active plume, wet landing or cockpit transition. Normal configuration retains these systems; the off combinations are diagnostic. Evidence: evidence/PERFORMANCE-2026-11-20/damage-mist-comparison/.


## Scuff versus damage-look: separate startup screening

Same build, private saved Cub/full-hangar fixture, visible Chrome5120x1271, fresh profile each case, normal ready, GL checks and20s garage soak. Common accepted advanced-cliff/runtime-bake exclusions only. One reference then separate scuff-only and damage-look-only exclusions; preliminary single-run screening, no driver-cache erasure claim.

| Case | Ready (s) | Shorter than control (s) | Startup links | Awake scuff links | CPU peak (°C) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Retained quality; scuff and damage look ON — not valid/completed | — | — | — | — | 80 |
| Scuff OFF; damage look ON | 152.665 | — | 548 | 0 | 86 |
| Damage look OFF; scuff ON — not valid/completed | — | — | — | — | 90 |

These are single-run marginal exclusions, not additive or exclusive costs. No startup-only case proves active damage, mud, impact or cockpit quality. Crack loading, physics, town, all other effects and original detailed runway geometry/cues remain enabled; higher-level runway cache is OFF in this screening. [Raw study](evidence/PERFORMANCE-2026-11-20/runway-fields-integrated/analysis.json).


## Reconciling the 200-second and 160-second results

The recent reference means **seven prioritized scenery/effect systems ON, town ON and original detailed runway mesh/cues ON**, with the two accepted exclusions (advanced cliffs and runtime player-derived aircraft bakes). It does not mean literally every feature or every graphics preset. The saved dry weather has zero pocket-mist strength, although its shader preparation is enabled and paid. Normal full-detail strip refinement remains at the original STRIP_MICRO.REFINE_MIN / REFINE_MIN_V; perftrim does not reduce runway geometry.

Earlier full-hangar ground-cache controls were208.592/218.046 s, with advanced cliffs and the flown-aircraft bake still active (parked static trio already selected); the first cliff/bake-free run was193.037 s. Later repaired-cache162.003 s and same-build legacy164.872 s show that the memo repair does NOT explain the entire193→162 s shift. A host restart/compiler history changed, and the missing attribution remains unresolved. Recent same-build controls158.201–161.654 s support the current range; they do not establish a fixed82.976 s saving caused by identified code alone. Fresh browser profiles do not erase a driver shader cache. Do not connect these bars as a causal waterfall.

Graph data, individually labelled fixtures/clocks/configurations: [loading history](evidence/PERFORMANCE-2026-11-20/loading-history.json). Invalid/aborted runs are excluded from timing bars and retained in the failure records.

## Integrated runway shape bake — actual result

Opt-in pavfields=1, build0ab57604f54a: precompute unit height, fine/medium curvature and slope, keeping the original mesh/contact, holes/hazards, tracks/ruts, surface texture selection, colour variation and live wetness/wear amplitudes. Quarter-metre bilinear half-float fields are an approximation; this is different from the failed exact low-level noise-corner cache. Mist, scuff and other scenery systems remain on.

| Run | Garage ready (s) | Difference (s) |
| --- | ---: | ---: |
| Same-build original runway shader | pending | — |
| Higher-level shape-field candidate | 157.672 | Control incomplete; no saving claim |

Two unchanged-design departures 9.539/8.846 s, returns 0.367/0.328 s. Garage20s soak max gap27.900 ms, no100ms gaps. First world soak has a148ms gap; a complete no-stall/crash/cockpit/edited-design acceptance is not claimed.

Field generation 0.744 s for 12 fields; 128.000 MiB GPU texture plus the same CPU backing. Controlled actual rough-runway row on synthetic geometry: dry/wet mean RGB byte errors 0.011/0.012, maximum 2/255; cues-off negative control changes the image. Six alternating GPU samples per path,5120×1271 patch: original median 8.971 ms; baked 6.752 ms. These are controlled-patch results, not full-world FPS; inspected captures are dark and do not establish every weather/view/recipe.

Default remains OFF. Memory is substantial; seed/length/width keys reuse weather-independent bases, but edited layouts allocate new slots and eventual ownership/reclamation remains prototype work. No humidity variation was sacrificed. Initial attempt was stopped after a shader-anchor preflight failure was noticed; candidate-2 used the corrected anchor. Keep the interrupted attempt out of timing claims. [Run evidence](evidence/PERFORMANCE-2026-11-20/runway-fields-integrated/candidate-2/summary.json).

## Pocket mist: preserved-model loop experiment

343 ordered sample/weight checks passed. One uniform-bound loop replaces the two density call sites while retaining the density function, weather, noise, number/order of surface/eye samples and optical-depth cap.

| Order | Program | Existing loop (s) | Compact loop (s) | Shorter (s) |
| --- | --- | ---: | ---: | ---: |
| 1 | Fine ground | 9.511 | 9.297 | 0.214 |
| 1 | Pavement | 31.933 | 29.635 | 2.298 |
| 2 | Fine ground | 9.010 | 8.300 | 0.710 |
| 2 | Pavement | 31.149 | 31.552 | -0.403 |

All eight links passed/GL zero, peak66°C. Pavement direction reverses, so this is not a repeatable saving and has no whole-startup win. fmistloop=1 remains OFF by default. Do not repeat the same loop rewrite expecting35 s. The35.175 s whole-startup exclusion signal still targets the shared mist graph distributed across material variants. Static location map generation is only about0.48 s. The selected elong=1/strat=0 already compiles contour stretching/layers out; optimizing their atan/cos would buy nothing in this fixture.

Best next preserved-model lead: bake the periodic hash/noise lattice used by the six density-noise terms, sharing the existing atmosphere atlas to avoid another sampler and checking active-mist images and GPU cost. A less exact architectural alternative is the existing cloud-pass mist march (fmist=a), or a depth-aware shared mist pass, which changes integration/appearance and needs explicit visual comparison before adoption. Per-material veil removal alone is an unacceptable claim of preserved appearance. No effect was disabled in the normal configuration.

## Scuff model: preliminary rationalization findings

Nine awake scuff program instances are already submitted before garage readiness in the captured retained-quality reference. They are prelinked to avoid first-crash compilation; they are not evidence of nine independent exclusive costs. The previous12.877 s exclusion combined scuff AND other damage-look code; the separate screening above narrows that distinction. Physics, impact deformation and scuff appearance are distinct.

Retained candidate audit after two trips:49 prepared damage records,73 wrapped materials,622722 attributed vertices (8 bytes each, about4.75 MiB),69ms record preparation, zero damage passes/uploads while intact. Thus this snapshot points toward shader preparation rather than minutes of CPU damage calculations. It does not measure an active crash. Skin damage has directional grime/paint removal, soil staining, fine strokes/gouges, material-specific dents/fraying/splinters, and procedural glass cracks. Its3D cellular crack network searches27 neighbouring cells and is reused in crush, torn-edge and glass paths. Broad material-class mixing keeps multiple substrate models in the same shader.

Concrete priorities:

1. **Restore compatibility with computed mud/rain.** Awake scuff currently defines GD_OFF, removing the separate computed deposit term to fit texture units. Damage dirt/streaks remain, but that is not the same live mud projection. Both tDmgG and the weathering tGrunge reference the SAME cached grunge image. Reusing one sampler may recover the missing unit without sacrificing either texture; test actual complete shader variants and wet damaged rendering. A second option packs the two existing3D byte volumes into one3D atlas with guard slices, preserving filtering; it costs storage and needs boundary checks.
2. **Specialize verified single-finish materials.** Live materials carry finish metadata; records derive their class from that metadata. Validate merged/broken geometry first, then omit irrelevant metal/fabric/wood procedural branches per class. Mixed/baked materials retain a general path. This may create more keys, so measure total preparation rather than assuming fewer lines are faster.
3. **Remove obsolete scratch outputs explicitly.** The current caller uses only two channels of dmgScrPat; chip/scratch outputs and several out values are unused. GPU compilers may already remove this work, so it is source cleanup, not a promised measured saving. Keep directional dark streaks, restrained paint removal, soil stains and deposit projection.
4. **Potential ULTRA scope, only after comparison:** fine millimetre gouge normals, cellular crazing/frayed microdetail and procedural glass web detail. Standard quality should retain credible broad dents, substrate/paint damage, directional grime and mud. Neither an ULTRA-only policy nor removal of this detail has been implemented or assumed accepted. The combined12.877 s signal does not predict the saving from this narrower option.

Earlier intact-hook key sharing already failed its browser repeat; do not retry it blindly. Preserve prelink safety until an alternative avoids first-crash stalls.

### Shared-grunge sampler compatibility probe

Captured complete shader variants, original versus shared grunge with computed mud restored. Compiler/link/sampler validation only; not integrated or wet-crash visual acceptance.

| Program | Existing link (s) | Candidate link (s) | Candidate linked | Active sampler elements (both shader stages) |
| --- | ---: | ---: | --- | ---: |
| Scuff 211 | 0.459 | 0.546 | true | 7 |
| Scuff 212 | 4.552 | 5.090 | true | 12 |
| Scuff 214 | 4.172 | 5.123 | true | 10 |
| Scuff 215 | 4.788 | 5.072 | true | 12 |
| Scuff 216 | 3.543 | 4.347 | true | 10 |
| Scuff 218 | 3.637 | 4.350 | true | 14 |
| Scuff 219 | 3.411 | 3.955 | true | 14 |
| Scuff 220 | 4.116 | 4.762 | true | 16 |
| Scuff 223 | 0.480 | 0.545 | true | 11 |

Combined active-sampler counts can include vertex samplers; link acceptance establishes the actual per-stage limits. No speed saving follows from restoring an additional computed term. [Probe evidence](evidence/PERFORMANCE-2026-11-20/scuff-shared-grunge/results.json).


## Runway higher-level bake: measured compiler targets

Source interventions on the captured full pavement program, visible real-GPU Chrome, one program at a time. Field-read surrogates use variable texture values so downstream material branches stay live. These are not production caches or visually validated images. They exclude bake generation, upload, storage, first draw and runtime sampling costs. This study therefore establishes **no delivered garage-loading saving**.

| Intervention | Complete program link (s) | Shorter than original (s) | Linked / GL error |
| --- | ---: | ---: | --- |
| Original full runway cues | 33.017 | 0.000 | true / 0 |
| Relief and curvature fields read from cache — compiler surrogate | 25.470 | 7.547 | true / 0 |
| Hole/hazard fields read from cache — compiler surrogate | 26.825 | 6.192 | true / 0 |
| Track/way fields read from cache — compiler surrogate | 23.035 | 9.982 | true / 0 |
| All above shape fields cached — compiler surrogate | 15.569 | 17.448 | true / 0 |
| Micro-cue material sampling precomposed — compiler surrogate | 28.016 | 5.001 | true / 0 |
| Fixed humidity colour/roughness only; live puddles — diagnostic | 30.287 | 2.730 | true / 0 |

One order only; no reliable per-system additive attribution. Shape fields together are a better compiler target than the failed low-level noise-corner cache. Relief/curvature, holes/hazards and ways must be considered together, with weather/wear-dependent amplitudes and narrow ruts preserved. The humidity intervention changes only colour/roughness modulation inside the cue block; it retains live puddle filling and is not permission to remove wetness. Its single-run difference does not justify a quality cut.

Next runway experiment: precompute higher-level shape fields or compact hole/track descriptors once per runway, keep the original geometry/contact and texture cues, include generation/invalidation/memory cost in the benchmark, compare dry/wet images with a cues-off negative control, then re-benchmark whole startup and GPU cadence. Do not enable a cache based on compiler-only numbers. [Raw results](evidence/PERFORMANCE-2026-11-20/runway-field-study/results.json), [source intervention scope](evidence/PERFORMANCE-2026-11-20/runway-field-study/scope.json).


## Quality-preserving result, diagnostic floor, and initial situation

**Quality decision: preserve all seven listed systems, the town and the runway relief cues.** Only the previously accepted advanced cliffs and player-derived aircraft bakes are excluded from the current usable configuration. Single-feature off tests below are measurements, not proposed removals.

| Situation | Navigation to garage | Quality / comparability |
| --- | ---: | --- |
| Initial published-build browser reference | 243.853 s (4:03.9) | Visible Chrome, full hangar, same saved-fixture family; initial matched control, not the user’s original pre-driver 6:15 test. |
| Current optimizations + accepted cuts only | about159s (2:39); current controls158.201–160.426s | Advanced cliffs replaced with prior simple textures; runtime player-derived bakes disabled, three static Cub/C172/Jodel props retained. Town, all seven listed systems and original full runway cues retained. Both round trips passed. |
| Lowest completed diagnostic result | 95.740 s (1:35.7) | Also removed town, extra forest/sub-alpine ecosystem, pocket mist, animals, traffic/generated cars, dust/spray, damage/scuff/crack appearance AND runway shader relief cues. Rejected quality tradeoff; not the delivered configuration. |

These endpoints span builds and dates; this is a measured range, not a controlled proof that each optimization caused the total difference. The manual retest (studio2:56, backdrop switch1:22,19s further lag, departure54s, return2s) is separate acceptance evidence. The original6:15–9min incident remains historical and was retired by the user as the active comparison. The20-second garage objective remains unmet.

**Runway answer: cues restored, low cost not achieved.** Current accepted-quality runs use the original full-cue shader. Exact noise-coefficient precomputation matched the tested dry/wet patch pixels but reached182.456s and slightly worsened the controlled GPU patch test; it stays disabled. The152.447s cue-off experiment is not an acceptable replacement.

## Individual feature costs — preserve, measure, then optimize

Priority follows the user: animals → sub-alpine ecosystem → extra forest edge → dust/spray → pocket mist → damage/scuff/crack → traffic. Visible Chrome, private saved full-hangar/Cub fixture,5120x1271/DPR1. Advanced cliffs/runtime aircraft bakes excluded in all cases. Town, runway cues and all other feature groups retained. Fresh profile per case, normal loader readiness,20s garage soak,two unchanged-design round trips,5s stand-world soaks. Full-scenario runs profile the first world soak; explicitly marked startup-only retries do not enter flight. Three controls bracket the seven single-group exclusions; no additive cost or exclusive compiler attribution. No native-F11 or driver-cache erasure claim. Current shared query: mode=sandbox&parkstock=1&groundcache=0&perftrim=1&pace=8. The attempted pace4 control was graphics-invalid and is excluded; current cost comparisons use pace8.

| Feature omitted for measurement only | Garage (s) | Interpolated reference (s) | Observed marginal reduction (s) | Interpretation |
| --- | ---: | ---: | ---: | --- |
| Animals | 180.012 | 160.298 | -19.714 | No demonstrated loading benefit; arrival was later |
| Sub-alpine vegetation ecosystem | 156.684 | 159.857 | 3.173 | Single-run signal; repeat before claiming a fixed cost |
| Extra forest edge | 158.287 | 159.287 | 0.999 | Within observed reference spread; unresolved |
| Dust and aircraft spray | 155.859 | 158.542 | 2.683 | Single-run signal; repeat before claiming a fixed cost |
| Pocket mist | — | — | — | THERMAL ABORT — exclude |
| Damage, scuff and crack appearance | 148.984 | 158.872 | 9.889 | Single-run signal; repeat before claiming a fixed cost |
| Generated scenery cars and road traffic | 159.743 | 158.357 | -1.385 | Within observed reference spread; unresolved |

Positive reduction means the test arrived sooner with only that group absent; negative means later. It is **not** exclusive system work and these values must not be added. Parallel compilation, shared shaders and driver scheduling can hide removed work or move the critical path. Reference range so far: 158.201–160.426s, 3 completed controls. Small effects inside this spread are unresolved, not zero-cost. Compiler-source identities, phase durations, sampled CPU work, feature-state audits and two-trip response data are retained for each case in analysis.json and its run folder.

Startup-only retries (explicitly marked in the run table) complete normal readiness, GL checks and20s garage soak with normal process exit. They do not assert a flight or crash pass; their startup endpoint is the same as the full runs. Post-startup-aborted attempts remain excluded.

Scope: sub-alpine flag disables the added vegetation classification/thinning ecosystem, not the entire climate/weather simulation. Forest-edge flag removes the added band, not the base forest. Mist flag isolates the pocket/forest veil, not all atmospheric fog/clouds. Traffic flag removes generated scenery cars/road traffic, not every authored vehicle prop. Dust/spray flag leaves main water/waves/reflections. Damage group leaves damage physics active. A stationary HOME soak does not activate a crash, wet splash event or mountain biome, so these measurements cannot establish their worst-case runtime costs.

| Reference / run | Status | Garage (s) | CPU peak (°C) |
| --- | --- | ---: | ---: |
| reference-open | Completed | 160.426 | 85.000 |
| animals-off | Completed | 180.012 | 84.000 |
| subalpine-off | Completed | 156.684 | 84.000 |
| forestedge-off | Completed | 158.287 | 80.000 |
| dust-spray-off | Startup completed; flight not tested | 155.859 | 86.000 |
| reference-middle | Completed | 159.048 | 86.000 |
| pocket-mist-off | THERMAL ABORT — exclude | — | 88.000 |
| damage-surface-off | Completed | 148.984 | 86.000 |
| traffic-off | Startup completed; flight not tested | 159.743 | 85.000 |
| reference-close | Startup completed; flight not tested | 158.201 | 86.000 |

Excluded attempt: reference-open in reference-open, exit 4. Raw sensor/thermal and runner logs retained; no time accepted.

Excluded attempt: reference-open in reference-open-attempt-3, exit 1. Raw sensor/thermal and runner logs retained; no time accepted.

Excluded attempt: subalpine-off in subalpine-off, exit 4. Raw sensor/thermal and runner logs retained; no time accepted.

Excluded attempt: forestedge-off in forestedge-off-attempt-1, exit 4. Raw sensor/thermal and runner logs retained; no time accepted.

Excluded attempt: dust-spray-off in dust-spray-off-attempt-1, exit 4. Raw sensor/thermal and runner logs retained; no time accepted.

Excluded attempt: dust-spray-off in dust-spray-off-attempt-2, exit 4. Raw sensor/thermal and runner logs retained; no time accepted.

Excluded attempt: reference-middle in reference-middle-attempt-1, exit 4. Raw sensor/thermal and runner logs retained; no time accepted.

Excluded attempt: pocket-mist-off in pocket-mist-off-attempt-1, exit 4. Raw sensor/thermal and runner logs retained; no time accepted.

Excluded attempt: pocket-mist-off in pocket-mist-off-attempt-2, exit 4. Raw sensor/thermal and runner logs retained; no time accepted.

Excluded attempt: damage-surface-off in damage-surface-off-attempt-1, exit 4. Raw sensor/thermal and runner logs retained; no time accepted.

Excluded attempt: traffic-off in traffic-off-attempt-1, exit 4. Raw sensor/thermal and runner logs retained; no time accepted.

Excluded attempt: traffic-off in traffic-off-attempt-2, exit 4. Raw sensor/thermal and runner logs retained; no time accepted.

Excluded attempt: reference-close in reference-close-attempt-1, exit 4. Raw sensor/thermal and runner logs retained; no time accepted.

Excluded attempt: reference-close in reference-close-attempt-2, exit 4. Raw sensor/thermal and runner logs retained; no time accepted.

### Requested-world-soak CPU evidence (partial call-tree attribution)

These are sampled milliseconds inside identified CPU call trees during each measured first-world soak (target5s; actual duration recorded). They are not per-frame costs, complete system totals, or GPU costs. Biome/edge attribution covers named helpers only; zero samples are unresolved. Camera/conditions do not exercise mountain biomes or crashes. The second-world frame cadence is recorded without the profiler.

| Run | Profile duration (ms) | Animal animation/behavior | Sub-alpine helpers | Edge helpers | Dust/spray maintenance | Damage appearance | Traffic movement |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| reference-open | 6235.328 | 17.002 | not sampled | 1.540 | 9.313 | not sampled | 12.848 |
| animals-off | 6170.720 | not sampled | 3.083 | 8.457 | 4.626 | not sampled | 6.553 |
| subalpine-off | 6026.966 | 32.957 | not sampled | 11.247 | 7.054 | not sampled | 9.369 |
| forestedge-off | 6122.385 | 35.702 | 1.068 | not sampled | 13.007 | not sampled | 6.505 |
| reference-middle | 6135.590 | 23.772 | 1.548 | not sampled | 10.840 | not sampled | 6.319 |
| damage-surface-off | 6162.611 | 25.124 | not sampled | not sampled | 7.301 | not sampled | 6.377 |

### Pocket mist: separately isolated compiler cost

A whole-startup mist-off value remains unresolved: repeated browser-startup attempts were safety-stopped and excluded. The field bake was441.8ms in the first valid control, with dry-weather pocket strengths zero; shader code remains compiled while that effect is inactive.

Two fresh real-GPU Chrome sessions, opposite orders, one program at a time. The actual generated atmospheric mist-on block was replaced exactly by the actual mist-off block; atlas layout, vertex source and other fragment code retained. All12 links and shader compilations passed. Compiler-only results:

| Program | Mist on (s), two orders | Mist off (s), two orders | Mean difference (s) |
| --- | ---: | ---: | ---: |
| Coarse ground | 9.287 / 8.755 | 7.702 / 7.167 | 1.587 |
| Fine ground | 9.732 / 8.725 | 7.115 / 7.199 | 2.071 |
| Pavement | 29.460 / 30.329 | 25.445 / 27.766 | 3.289 |

**Do not sum these into startup savings.** They are isolated compile/link wall times for three representative programs, not exclusive CPU work or the total cost of mist across all materials. Shader variants compile concurrently in the game. No mist visual reduction is approved. Source pairs, exact module substitution and results are retained in mist-compiler/.


### Where the observed startup waits sit

| Run | Geometry (s) | Nearby settle (s) | World + garage shader gates (s) | Startup linked programs |
| --- | ---: | ---: | ---: | ---: |
| reference-open | 31.654 | 17.019 | 81.033 | 566 |
| animals-off | 32.673 | 18.165 | 101.228 | 556 |
| subalpine-off | 31.497 | 18.483 | 77.306 | 564 |
| forestedge-off | 31.583 | 16.366 | 81.770 | 567 |
| dust-spray-off | 31.614 | 18.236 | 77.346 | 565 |
| reference-middle | 32.338 | 17.122 | 78.561 | 566 |
| damage-surface-off | 32.204 | 18.154 | 68.260 | 548 |
| traffic-off | 32.144 | 17.821 | 78.806 | 567 |
| reference-close | 31.834 | 18.220 | 78.810 | 566 |

Shader gates are elapsed waits, not exclusive compiler CPU time; work also compiles earlier during geometry/settle. Program counts include the complete startup workload, not exclusively the omitted feature. The damage-only off test removes18 startup links (566→548) with geometry essentially unchanged; this is a material/preparation lead. Animal removal removes10 startup links yet does not shorten readiness, so its missing program durations must not be summed into a predicted loading saving.


### Preserving each system: code review and next tests

| System | Existing optimizations | Candidate preserving quality | Status |
| --- | --- | --- | --- |
| Animals | Geometry/materials/decoded clips cached per species; merged skinned draw; distant animals already park or select static LODs. Head/body clip metadata already cached. | animals.js makePlayer/P.step still calls full sampleInto even when write=false. Prototype root-travel-only sampling for static LODs while retaining clocks, fades, movement and full near poses. Compare behavior across LOD transitions before runtime benchmarking. (src/viewer/animals.js:538; src/viewer/animal_run.js:790) | Code finding; not implemented or claimed as a loading win. |
| Sub-alpine ecosystem | BIO.hold already snapshots knobs per walk. Added subAt classifies vegetation; keepAt adds four110m terrain taps for ridge thinning. This is not the complete weather model. | Measure classification/terrain-query frequency; share exact revision-keyed height/slope/classification samples across tree, grass and cover builders. Preserve current edited terrain and wet/wear invalidation rather than substitute the raw DEM. (src/viewer/render_world.js:5265; src/core/28c_biomes.js:136) | Candidate; whole-fixture off test and terrain/settle phase deltas first. |
| Extra forest edge | Distance field is already baked lazily per tile and cached; it is not a polygon-distance search at every tree. Outward-band placement adds gradient taps, inner-biome lookup and16 canopy taps. | Count SDF tile builds and shared-margin work; reuse identical forest-mask/canopy queries with revision invalidation. Avoid reducing the band or tree counts. Check post-boot vegetation queues as well as startup. (src/core/28c_biomes.js:149; src/viewer/render_world.js:5866) | Candidate; existing cache must not be reimplemented as a new optimization. |
| Dust / aircraft spray | Spray uses instanced batches; dust pools merge old puffs, use baked texture sheets and hide inactive drawables. Main water remains separate. | Check empty-pool CPU scans and buffer uploads, reuse physics contact/soil data, and verify shader/material sharing across dust and spray. A dry stationary Cub does not measure an active wet landing or mud plume. (src/viewer/dust.js; src/viewer/spray.js; src/viewer/app.js:8272) | Loading/stand screening only until active-effect scenario is measured. |
| Pocket mist | Terrain/canopy/valley field is already baked into the shared atmospheric atlas. Fresh control bake441.8ms. Pocket strengths were zero in the saved dry weather although the shader was enabled. | Isolate shared shader compile burden. Exact mathematical direction projection can replace atan+sin+cos used to recover the baked signless contour axis (using its doubled-angle projector); validate floating-point image error. CPU min/max neighborhood scans can use exact monotonic sliding windows if their measured cost warrants it. (src/viewer/forest_mist.js:77 and :393; src/viewer/atmo.js:501) | Code-derived candidates, not measured savings. No mist shape/fidelity reduction proposed. |
| Damage / scuff / cracks | Crack sheet is pre-baked and fetched once, not generated at crash. Intact-plane shader branch sleeps at uDmgOn=0, but its full shader still has to compile. Physics is separate from these appearance switches. | Use missing/changed source identities to locate duplicated aircraft material variants and repeated preparation. Preserve damaged materials and crack visuals; validate an actual crash/cockpit case before concluding runtime cost. (src/viewer/skin_scuff.js:417; src/viewer/app.js:7245) | Group cost first; no source shader simplification or visual removal yet. |
| Traffic / generated cars | Segment spatial index, sorted following order, distance pose culling and far-road sleeping already exist. Static authored vehicle props are outside the switch. | Profile nearby posed cars; reuse per-road direction lists and following-gap scratch storage to remove per-frame Map/filter/sort/pair allocations without changing vehicle motion. Keep exact terrain placement. (src/viewer/render_premises.js:2080) | Lowest user priority; no new density or reach reduction proposed. |

### Decision and next actions from this screening

- Preserve every system in the user priority list, the town and the runway cues. Only the two accepted cuts stay in the measured configuration. No new quality reductions are proposed.
- First investigate damage/scuff/crack shader preparation: about9.9s marginal startup signal and18 fewer submitted startup links. Separate the three appearance paths and compare material/program keys and exact source pairs; retain the damaged appearance and verify intact/damaged/cockpit images and first-use response. This group test is not the cost of crash physics.
- Investigate shared mist shader work next. Its static field is already baked (~0.442s). The repeated shader contribution is measured separately above; algebraic contour projection/shared higher-level fields are candidates, not delivered savings. Keep its spatial structure, weather behavior, clouds and water interactions.
- Keep runway relief cues active. The exact noise-corner cache was correct for the tested patch but slower. A future prototype must move higher-level height/curvature/hole/track work, with explicit image/physics/GPU validation, rather than repeat the unsuccessful low-level cache.
- Avoid prioritizing small idle animal CPU samples for this loading problem. The control captured17ms in identified animal animation/behavior call trees during6.235s (not a total CPU/GPU cost). Near-herd/alpine/active plume/spray/mist/crash/near-town runtime scenarios remain to be profiled. Existing LOD/caches/batching should not be reinvented.
- The common world build remains about32s and the shader gates dominate. Even the rejected95.7s floor misses the20s garage target by a wide margin. Continue exact shared terrain/road/vegetation preparation and shader-variant rationalization; feature removal alone is not a solution.

Reproduction query for the accepted-quality browser configuration: mode=sandbox&parkstock=1&groundcache=0&perftrim=1&pace=8. Frozen stock assets are explicit; no user profile, save or deployment was modified.


Optimization decisions must follow the measured stage/source/CPU evidence, rather than the size of a diagnostic visual cut. No additional removal is approved. Full data: evidence/PERFORMANCE-2026-11-20/feature-isolation/analysis.json.


## Visual scope of the benchmark options

These options are experiments, not an approved final graphics preset. User decision: keep runway micro-relief cues; replace their repeated calculations with precomputed fields if validation succeeds.

| Test option | What is excluded or changed | What remains |
| --- | --- | --- |
| perftrim=1 (common recent reference) | R1 cliff/rock shader path, bias worker, fallback rock map, procedural rock ring; player-derived parked fleet generation and flown-bake module initialization | Prior simple cliff textures; mountain geometry; three prebuilt Cub/C172/Jodel props; flown aircraft render/physics |
| Extra scenery/effects cuts (121.247 s, or combined 95.740 s) | mk_ town records including the usual keep exceptions; extra forest band; sub-alpine classification; pocket/forest mist veil; ambient animals; generated scenery cars and road traffic; dust including mud/snow classes; aircraft spray/splash pools; new damage/scuff visuals; crack-sheet fetch | Baseline forest, mountain terrain, main water/waves/reflections, other fog/clouds, AFB02/20, authored static car props and player vehicle modules, damage physics |
| pavmicro=0 (152.447 s alone; 95.740 s combined) | Shader bump, hollow, rut, fine normal, wetness/puddle relief cues on applicable nongrass soft strips | Physical micro-relief/contact, strip mesh, base material textures, CPU alpha. **Not accepted as a final solution: these cues are required.** |
| pavnoise=1 (new validation) | Replaces repeated integer noise hashing with exact precomputed corner coefficients for six relief octaves and two lump fields | Existing interpolation, micro-relief cues, weather/wear, wetness, puddles, material blending, geometry/contact; no extra scenery cuts implied. Adds bounded CPU/GPU texture storage. Must prove browser correctness and net benefit. |

The 95.740-second result must always be labelled **combined visual-cut diagnostic**. Do not present its saving as a preserved-visual optimization or attribute it to the runway shader alone. The new noise cache is opt-in while under test. Hard/soft shader splitting was measured in isolation and rejected; no material split was integrated.

## Objectives and constraints

- Immediately usable garage under 20 seconds, without post-loading freezes; world departure at most 30 seconds; fast repeated garage/world iteration after design edits.
- Eliminate compilation/repeated work first. Later, stage studio → furnished garage → world within the same editor/state, with a smooth transition around the aircraft. Background loading must not simply move blocking work behind an interactive screen.
- Preserve visuals. No reductions without explicit consent and a scoped benefit argument. Accepted cuts for the current configuration: advanced cliffs and player-derived aircraft bakes only. Preserve the town and all seven user-prioritized systems. Single-system exclusions are diagnostic measurements only, not approved quality reductions. User requires runway micro-relief cues; their removal is not an accepted final solution.
- RTX 3080 driver updated, reference 621.24; real visible Chrome, saved game-state fixture, 5120×1271 viewport/DPR 1. The fixed integration fixture's active design is Piper Cub (confirmed from saved build metadata and screenshots). It is not a reconstruction of every earlier Mosquito/studio manual test. Browser rendering tests take precedence over optimistic internal summaries. Native F11 fullscreen was not independently verified.
- User's private fixture is external to this report/repository. No clearing or modifying the user's real Chrome profile. No publication or generated-main-page commits.

## Current evidence and interpretation

| Observation | Result / interpretation |
| --- | --- |
| Latest manual playtest | Studio 2:56; backdrop off 1:22; another 19 s until garage stops lagging; departure 54 s; return ~2 s. Published build 48a71176c5a6. |
| Historical 6–9-minute launch | Valid historical evidence, retired by user as the active target after the fresh manual retest. Do not chase driver/profile differences without recurrence. |
| Corrected full-hangar browser comparison | Master 243.853 s → existing combined audit 211.248 s, one pair (~13.4%). Do not attribute the entire difference to a single change. Studio/full hangar must be labelled separately. |
| Shader critical path | Ground and pavement are conspicuously expensive; link submission-to-observed-completion intervals overlap and are not exclusive compiler times. Never sum them into recoverable time. |
| Exact terrain neighbour cache | 71,148 equivalence checks; retained CPU work reduction. |
| Generator yielding | Largest measured generator task ~7.2 → 2.5 s; total work still about 32 s. Better responsiveness, not a total-work reduction. |
| Lamp-signature correction | Prevents obsolete light-count variants. Retained; studio comparisons around twenty seconds better. |
| Shadow array fallback | Real comparison-mode correctness fix; corrected captures have no GL draw errors. Not independently a loading win. |
| Static fleet / compact town | No cold-loading win demonstrated in matched tests. Does not settle near-town FPS or fleet swapping. Cooked-city subset reconciliation bug invalidated the first town test. |
| Small shader rewrites | Rock-loop saving failed repetition; far-one ground variant slower in both orders; other reductions in links did not improve readiness. Full ledger below. |
| Split ground material/lighting prototype | Isolated coarse compile 33.329 → 19.007 s; reversed 34.518 → 21.961 s (36–43% lower for that program). Not whole-game savings. |
| Split rendered acceptance | One fine tile, controlled lighting, overhead/oblique: mean RGB byte errors 0.00716 / 0.00981; max 1/255; no GL errors. Inverted normals correctly fail (mean error 23.718). Other recipes/tiers/weather not yet broadly accepted. |
| Split GPU work | Full-viewport terrain stress test: 19.969 ms original vs 19.504 ms split medians, twelve samples each. Roughly equal; not game FPS. Extra material buffers ~99.30 MiB at 5120×1271, excluding depth. |

## Live integration and browser re-benchmark

The functional packed integration is query-flagged with **groundcache=2**. It generates standard-material builder/lighting sources from hooks and shader chunks BEFORE original GL compilation, stores the same eight half-floats in one RGBA32UI buffer, and uses a ground-only material pass. Original hooks/materials remain available for groundcache=0 control. The earlier groundcache=1 MRT path is retained only to reproduce its failed first-use experiment; do not use it for acceptance. The render path rebuilds material data for each rendered view and uses live lighting/shadows in the final scene; no feature is deliberately removed. Loading readiness and texture upload walks include both derived materials; render-target textures are initialized through the renderer's target path. Default remains off while full-loading benefit and broader quality/runtime acceptance are assessed. The unsuccessful shaderlogs policy was reverted from production code.

Actual whole-game results appear below as soon as each run saves its summary. No result without normal readiness and an error assessment counts as a successful optimization. First-run failures and aborted work remain visible.

## Garage wait: reconciled elapsed-time waterfall

Control integrated-control-2, saved Piper Cub, full hangar, groundcache=0. The loading-system clock runs **217.185 seconds** to cover removal; navigation-to-observed-ready is **218.046 seconds**. Their difference includes clock-origin and polling differences; do not invent its location in the waterfall. All 24 logged steps plus explicit gaps reconcile exactly to cover removal.

| Lane | Start (s) | End (s) | Elapsed (s) | What the player is waiting for |
| --- | ---: | ---: | ---: | --- |
| Load scripts, engine and renderer | 0.000 | 7.934 | 7.934 | Before the first timed preparation step; includes scripts, core and renderer initialization. |
| Find vegetation assets — 0.003 s | 7.934 | 7.937 | 0.003 | Find the tree asset bins. This is not all vegetation preparation. |
| Between-step scheduling / unassigned | 7.937 | 7.964 | 0.027 | Measured clock gap. Not assigned to a feature or shader. |
| Build the editable aircraft — 0.378 s | 7.964 | 8.342 | 0.378 | Construct the saved player design for the editor. |
| Between-step scheduling / unassigned | 8.342 | 8.354 | 0.012 | Measured clock gap. Not assigned to a feature or shader. |
| Construct the hangar — 0.622 s | 8.354 | 8.976 | 0.622 | Create the room; its shader and first-draw preparation happen later. |
| Between-step scheduling / unassigned | 8.976 | 9.171 | 0.195 | Measured clock gap. Not assigned to a feature or shader. |
| Prepare editor controls — 0.100 s | 9.171 | 9.271 | 0.100 | Create the design editing interface. |
| Between-step scheduling / unassigned | 9.271 | 9.320 | 0.049 | Measured clock gap. Not assigned to a feature or shader. |
| Initialize the saved world — 1.047 s | 9.320 | 10.367 | 1.047 | Initialize the world state used by subsequent scenery work. |
| Between-step scheduling / unassigned | 10.367 | 10.456 | 0.089 | Measured clock gap. Not assigned to a feature or shader. |
| Generate world geometry — 36.138 s | 10.456 | 46.594 | 36.138 | Build terrain, premises, roads and aerodromes. This is elapsed generation time, not pure CPU time; some shader work starts here. |
| Between-step scheduling / unassigned | 46.594 | 47.280 | 0.686 | Measured clock gap. Not assigned to a feature or shader. |
| Build town geometry — 2.302 s | 47.280 | 49.582 | 2.302 | Assemble town content. Includes early ground/pavement program submissions; not an exclusive building cost. |
| Between-step scheduling / unassigned | 49.582 | 49.590 | 0.008 | Measured clock gap. Not assigned to a feature or shader. |
| Place parked aircraft — 0.346 s | 49.590 | 49.936 | 0.346 | Arrange parking. Fleet capture work also runs later and can overlap other phases. |
| Between-step scheduling / unassigned | 49.936 | 49.940 | 0.004 | Measured clock gap. Not assigned to a feature or shader. |
| Prepare trees step — 0.000 s | 49.940 | 49.940 | 0.000 | Zero-duration logged step; vegetation work is distributed elsewhere. |
| Between-step scheduling / unassigned | 49.940 | 49.945 | 0.005 | Measured clock gap. Not assigned to a feature or shader. |
| Populate nearby forest / terrain ring — 4.910 s | 49.945 | 54.855 | 4.910 | WF.prewarm grows the nearby scenery ring in budgeted updates. Farther content already streams during flight. |
| Between-step scheduling / unassigned | 54.855 | 54.870 | 0.015 | Measured clock gap. Not assigned to a feature or shader. |
| Drain nearby scenery queues — 24.131 s | 54.870 | 79.001 | 24.131 | Repeated WF.worldUpdate calls build nearby premises, vegetation fill, ground cover and other streamers. Requires premises near queue empty, fill not busy and stable scene-object count across three checks, or caps of 1500 updates / 45 seconds. Then waits for PARKED.whenIdle. Each internal system needs separate timing. |
| Between-step scheduling / unassigned | 79.001 | 79.005 | 0.004 | Measured clock gap. Not assigned to a feature or shader. |
| Prepare parked aircraft — 5.236 s | 79.005 | 84.241 | 5.236 | Wait for parked-aircraft preparation. Other fleet work overlaps later steps. |
| Between-step scheduling / unassigned | 84.241 | 84.463 | 0.222 | Measured clock gap. Not assigned to a feature or shader. |
| Freeze aircraft geometry for flight — 4.843 s | 84.463 | 89.306 | 4.843 | CAGE_JOIN.snapshotSteps builds the visual payload for flight from the edited design. It does not take a fiche photograph; world and garage shader prelinks are also kicked off at this boundary. |
| Between-step scheduling / unassigned | 89.306 | 89.370 | 0.064 | Measured clock gap. Not assigned to a feature or shader. |
| Bake the flown aircraft — 5.662 s | 89.370 | 95.032 | 5.662 | Prepare the flight representation of the selected design; concurrent fleet work may also finish here. |
| Between-step scheduling / unassigned | 95.032 | 95.033 | 0.001 | Measured clock gap. Not assigned to a feature or shader. |
| Apply aircraft flight specification — 0.872 s | 95.033 | 95.905 | 0.872 | GARAGE_SPEC.update applies the exported working design specification, potentially rebuilding the flown model. This is not certification or running the performance test bench. |
| Between-step scheduling / unassigned | 95.905 | 96.277 | 0.372 | Measured clock gap. Not assigned to a feature or shader. |
| Restore the certificate — 0.006 s | 96.277 | 96.283 | 0.006 | Restore the saved aircraft test certificate via BENCH_RESTORE. This is not the world restoration step with the same internal ID. |
| Between-step scheduling / unassigned | 96.283 | 96.307 | 0.024 | Measured clock gap. Not assigned to a feature or shader. |
| Wait for remaining images — 0.090 s | 96.307 | 96.397 | 0.090 | Wait for image readiness, excluding work already paid elsewhere. |
| Between-step scheduling / unassigned | 96.397 | 96.407 | 0.010 | Measured clock gap. Not assigned to a feature or shader. |
| Upload world textures — 2.120 s | 96.407 | 98.527 | 2.120 | Prepare textures for the graphics device; programs may be linked here too. |
| Between-step scheduling / unassigned | 98.527 | 98.545 | 0.018 | Measured clock gap. Not assigned to a feature or shader. |
| Wait for world shader preparation — 96.844 s | 98.545 | 195.389 | 96.844 | 96.844 seconds in this phase. Includes submitting and waiting for many programs; ground and pavement are major suspects. NOT 96.844 seconds attributed exclusively to one shader. |
| Between-step scheduling / unassigned | 195.389 | 195.395 | 0.006 | Measured clock gap. Not assigned to a feature or shader. |
| Prepare hangar shaders and reflection — 10.872 s | 195.395 | 206.267 | 10.872 | Prepare reflection-capture, visible room and shadow variants, bake reflection, then finish texture preparation. |
| Between-step scheduling / unassigned | 206.267 | 206.275 | 0.008 | Measured clock gap. Not assigned to a feature or shader. |
| Draw garage and prepare see-through views — 4.121 s | 206.275 | 210.396 | 4.121 | Start rendering under the cover and prepare aircraft see-through shader variants. |
| Between-step scheduling / unassigned | 210.396 | 210.414 | 0.018 | Measured clock gap. Not assigned to a feature or shader. |
| Warm world views, shadows and clouds — 5.785 s | 210.414 | 216.199 | 5.785 | Catch-up compile and depth variants; upload newly discovered textures; wait for readiness; render SIX views around the stand, then warm shadows, clouds, near plants and hangar outdoor views. The earlier one-draw description was incomplete. |
| Between-step scheduling / unassigned | 216.199 | 216.209 | 0.010 | Measured clock gap. Not assigned to a feature or shader. |
| Prepare aircraft in world lighting — 0.298 s | 216.209 | 216.507 | 0.298 | Warm the settled flown aircraft with the actual world lighting. |
| Between-step scheduling / unassigned | 216.507 | 216.830 | 0.323 | Measured clock gap. Not assigned to a feature or shader. |
| Check for aircraft rebuilds — 0.298 s | 216.830 | 217.128 | 0.298 | Recheck design changes that could invalidate earlier preparation. |
| Final readiness and overlay removal | 217.128 | 217.185 | 0.057 | Final readiness aggregation and removing the loading cover. |

### What remains unknown before another optimization

- This explains elapsed startup phases, not exclusive CPU/GPU time or a proven shader dependency graph.
- Source identities for coarse/fine ground and pavement are reliable; complete named ownership and causal tail attribution are missing.
- Do not overlay WebGL performance.now timestamps on the BOOT clock without recording their shared origin.
- The old 620-program capture lacks the material attribution field; the newer harness has attribution code but it was not present in that old saved evidence.

The next measurement must capture creation-time material/object ownership, shader family and exact vertex/fragment identity, render-pass and light-count variants, last-pending/first-ready observations, polling gaps, blocking GL calls and first draws, on a shared clock. Record which pending programs each readiness gate actually awaits. Avoid high-frequency forced GL status polling that changes the benchmark. Validate overhead against an uninstrumented run. Until then, a suspected expensive shader is not a measured number of recoverable seconds.

### Handover leads, not new instructions or proven attribution

flyDiy/HANDOVER.md lines 317246 and 317495–317529 record an earlier 143 → 205–215 s loading regression with a bisect outstanding, increased world draw calls, 2.2–2.6× vegetation shadow triangles and extra strip geometry. Investigate these historical changes against controlled versions; do not treat their runtime costs as startup shader costs. Current focus: attribution and critical path; pause further speculative shader rewrites.

Raw reconciled spans: [critical-path.json](evidence/PERFORMANCE-2026-11-19/material-cache/critical-path.json).

## Critical review of the large startup gates

### Unassigned time

10.161 seconds includes startup before the first timed step plus between-step gaps and final readiness. The startup portion can be split using earlier phase markers; between-step gaps need task/worker attribution. Do not pretend these are zero. The displayed waterfall hides their rows but preserves their positions on the time axis.

### World geometry — 36.138 seconds

The renderer builds the selected world, not a second complete procedural map alongside Jolene. However, shared analytic terrain code still runs on the island: the outer 512×512 colour bake is unconditional, even when the drawn outer texture is the island texture, because its forest mask and minimap are still used. This creates a concrete opportunity to separate required field generation from unused colour work; not yet benchmarked. The 513×513 near ground mesh is sampled and normals computed at startup. Earlier CPU profiling identified premises patching, aerodromes and road work as substantial generators. Far buildings and vegetation already stream, and terrain already has coarse/fine representations. A coarser initial view plus incremental detailed geometry is feasible but must preserve collision/height agreement, avoid cracks, and budget expensive builders; merely scheduling a multi-second task later recreates the freeze.

### Nearby world settling — 24.131 seconds

worldAtRest repeatedly runs WF.worldUpdate at the stand in nominal 40 ms slices. It waits for the premises near queue to empty, the ring fill to stop being busy, and the scene object count to remain unchanged over three checks. It stops at 1500 updates or 45 seconds, then also awaits PARKED.whenIdle. A house-worker wait is raced against 250 ms. This gate includes active building, worker waits, streamer iterations and parked-aircraft work; not passive stabilization or physics settling. Existing timing does not separate those internal costs. Whole-scene object counting and a stable count are coarse completion heuristics, not a rigorous readiness contract. Prefer explicit per-streamer completion counters and record which condition prevents readiness.

### Parked aircraft — 5.236 seconds, plus overlapping fleet work

Fixed prebuilt assets eliminate player-design capture and baking in principle, but still need decoding, placement, texture upload and shader preparation. captureAll has an explicit static-trio path to cookAll with no player editor batch. It is therefore reasonable to expect the player-capture part to disappear, not the entire row or a matching reduction in total startup. Existing static-trio comparison did not establish an end-to-end speedup. The current reference deliberately retains the original fleet for comparability; parkstock=1 alone is not static-trio mode.

### Snapshot — 4.843 seconds: label corrected

This is NOT a fiche picture. syncSnapshotSteps calls CAGE_JOIN.snapshotSteps to create CAGE_VISUAL for the selected design and calibrates against GARAGE_SPEC.preview. The boot wrapper also schedules worldPrelinkSettled and shedPrelink here. The earlier waterfall label Capture aircraft pictures was incorrect. This trace cannot establish the cost of fiche photography; that requires instrumenting the fiche/thumbnail producers separately.

### Flown bake — 5.662 seconds

FLOWN_BAKE.step produces exterior/cabin material atlases or reads its IndexedDB cache, keyed to the design and wear step. Defer review of this as requested. It is a candidate for preparation after the editor is usable, with strict task budgets and a readiness gate before flight.

### Apply flight specification — 0.872 seconds

syncApply calls GARAGE_SPEC.update with the exported working design and records its preparation keys. The update merges the specification and rebuilds. This is not certification, performance-test flight simulation, or a photograph. The later boot step restore (6 ms here) restores the test certificate via BENCH_RESTORE; the previous Restore editor aircraft description was also incorrect.

### World shader gate — 96.844 seconds

The gate first arms the required premises lamps, moves/dresses the aircraft and its lights into the world, and updates the world at the stand. It calls compilePass → renderer.compileAsync for the scene/actual output target, then compileDepthVariants. This entails material hooks and expanded shader source generation, cache keys and light/geometry/pass variants, graphics-driver shader compile/link, asynchronous completion polling, and shadow depth variants. Programs start earlier in town, settle and snapshot prelinks. Elsewhere compileSliced defaults to pacing at most 2–8 pending programs and prioritizes groundFamily/heavyLink materials; therefore submission order and queueing matter, not just each shader complexity. Roads, buildings, water and vegetation are materials inside this whole-scene process, not separate BOOT rows. Clouds also have separate later warm-up passes. A reliable subsystem chart must map those program instances to source/factory owners and readiness tails, not divide 96.844 seconds proportionally by program count.

### World under the cover — 5.785 seconds

The frames gate is a catch-up preparation gate, not one draw: it compiles late scene/depth variants and parked tree rungs, uploads textures, waits for programs, renders six azimuth views around the stand, then warms shadows, clouds, nearby plants and hangar outdoor views. This intentionally pays first-use stalls before control is returned. It belongs to world readiness and need not inherently block a studio-only editor. It must not simply be deleted if the same first draws would then freeze the first flight.

## New ownership and pending-tail capture — 20 November

Normal browser readiness passed in about 214 s on unchanged runtime build ee694f8981b9. This is diagnostic, not a claimed speedup. Creation-time interception attributes 655 of 655 program instances to material records. Scene paths and shader keys provide finer subsystem identification for only part of that set; generic/shared materials remain unresolved. The hook adds no GL queries, but its CPU overhead has not been isolated. Two sparse-tree impostor warnings were captured; they are retained in the diagnostic log.

**Important: settle did not finish.** It stopped at 1500 updates after 23887 ms, rest=false, premises near=0, fill busy=true, with 57 queued fill entries. Do not describe this gate as guaranteeing an idle scene. The 40 ms slicing budget and 1500-update limit need completion-condition review before tuning.

World shader gate: 100.157–195.644 s (95.487 s). Fine-ground program #143 was submitted at 85.500 s, last observed pending near 195.564 s and then completed; the following shadow variants finish near 195.64 s. Coarse ground #19 completed by 155.206 s; pavement #22 by 144.314 s. This identifies fine ground as a near-final readiness dependency, not proof that deleting it saves 95 s: other compilation proceeds in parallel and submission order/driver contention matter.

Synchronous renderer.compile calls inside the world gate total 3.492 s. This excludes other JavaScript, query blocking, asynchronous compilation and scheduling waits; it is not a complete CPU accounting.

| Identified family | Program instances | New links submitted in world gate | Representative program | Submission → observed ready (s) |
| --- | ---: | ---: | ---: | --- |
| Other / shared / not yet identified | 373 | 215 | 0 | 8.725 → 47.263 |
| Coarse ground | 1 | 0 | 19 | 47.267 → 155.206 |
| Outer ground / premises ground patches | 2 | 0 | 20 | 47.271 → 84.950 |
| Road / runway pavement | 1 | 0 | 22 | 47.277 → 144.314 |
| Cloud composite (not all cloud passes) | 1 | 0 | 26 | 47.279 → 47.834 |
| Water | 2 | 0 | 27 | 47.837 → 50.775 |
| Buildings / hangar (may share materials) | 68 | 19 | 221 | 100.203 → 104.151 |
| Parked aircraft bake materials | 31 | 0 | 148 | 86.817 → 89.421 |
| Vegetation / ground cover | 4 | 0 | 642 | 203.016 → 207.178 |
| Vegetation impostors / their shadows | 4 | 3 | 243 | 100.317 → 105.807 |
| Fine ground | 1 | 0 | 143 | 85.500 → 195.564 |
| Player aircraft / editor | 110 | 90 | 450 | 159.537 → 171.946 |
| Other shadow variants | 57 | 31 | 588 | 195.975 → 196.002 |

Creation-time material ownership plus post-ready scene paths. Shared generic materials can cross subsystem boundaries. Counts are program instances, not effects. Representative intervals run from link submission to first observed completion and include parallel work, scheduling and polling; not exclusive compiler costs. Shadow ownership and non-scene cloud passes remain partly unidentified. This is a diagnostic run, not an optimization comparison. The 373 other/shared instances are not 373 unknown source texts; their exact sources are saved, but subsystem ownership is insufficiently resolved. Cloud composite is identified; cloud volume/history passes are not fully attributed.

Raw ownership, exact shader sources, query observations, compile calls, BOOT clock origin and health: evidence/PERFORMANCE-2026-11-19/shader-critical-path. Next: combine the game recorder and Chrome main-thread trace with explicit per-streamer counters; use existing scripted scenarios for later repeat-trip/flight acceptance. No further speculative shader rewrites until this attribution is usable.

## Focused ground, runway and ecosystem investigation — 20 November

97.281-second Chrome CPU sample, intentionally stopped after geometry/settling, not a complete boot benchmark. Existing recorder push/pop functions were wrapped to measure scopes during boot, when the recorder frame clock is normally closed. No gameplay graphics or shader logic changed.

### Repeated cliff/rock compiler diagnostic

| Ground | Variant | Mean compile/link (s) | Original order (s) | Reverse order (s) |
| --- | --- | ---: | ---: | ---: |
| Fine ground | Original | 31.786 | 33.050 | 30.523 |
| Fine ground | Cliff/rock block excluded | 8.654 | 8.676 | 8.633 |
| Coarse ground | Original | 32.006 | 31.180 | 32.832 |
| Coarse ground | Cliff/rock block excluded | 9.281 | 9.507 | 9.056 |

The diagnostic GS_NOTROND exclusion was injected only into captured source for an isolated compiler test. No gameplay visual was removed or changed. Fresh Chrome profiles, shader disk cache disabled, one program at a time, same RTX 3080; original order then reversed order. Driver-level caching was not independently eliminated. These are compiler comparisons, not full-load savings. All eight links passed.

### Measured CPU work

| Group | Execution (s) |
| --- | ---: |
| Terrain patch slices | 7.992 |
| Aerodrome slices (all strips) | 7.335 |
| Roads-labelled slices (mixed work) | 5.592 |
| Paved-polygon slices | 1.223 |
| Vegetation fill | 7.722 |
| Ground cover systems | 4.903 |
| Premises build scope | 0.140 |

Generator execution total 34.688 s. The listed generation groups are yield-boundary groups, not exclusive feature attribution. The listed settling scopes are only part of a 28.670-second instrumented settle; do not sum them into the earlier control run.

- R1 cliff/rock inclusion is associated with roughly 3.4–3.7× isolated compiler time in both ground variants. Four original/diagnostic links repeated in reverse order; all links valid. No image preservation is claimed for diagnostic sources, because these were never rendered or installed in the game.
- The exclusion bypasses R1 exposure/joints, micro-detail, weathering and recolouring contribution together. It does not isolate the recent cliff commit or establish a historical regression attributable to that commit.
- Runway relief is a CPU geometry suspect: adaptive refinement inserts whole rows/columns, and paved polygons build grids over world-axis bounding boxes. Existing per-builder height memoization is present, so adding another identical memo is not a new proposal.
- Sub-alpine changes operate in CPU vegetation classification, height/noise tests and ridge thinning. The code explicitly keeps the ground splat code unchanged. Their individual startup cost has not been measured; no claim they cause the cliff shader compiler bill.
- Chrome self-samples: hyp2 ~6.351 s; distPtSeg ~2.243 s; roadDist ~2.078 s; terrainH ~2.563 s. These self-time samples are separate from generator groups and must not be added to them. hyp2 call paths concentrate under road/polygon boundary queries (pavedAt) used by terrain and vegetation.
- The profile intentionally stops before full boot; do not compare its 97-second duration with usable-garage readiness. Two pre-existing sparse-impostor warnings were recorded.

### Actions to pursue, in order

**1. Reduce R1 cliff/rock compiler complexity while preserving the look.** First measure micro-detail separately using the existing GS_TRLITE compile-only switch, then separate exposure/joint calculations from post-texture weathering. Hoist reusable position/normal-dependent factors outside material candidate loops where dependency analysis permits. Reuse existing macro maps for stable fields only after precision and image checks.

Expected benefit/evidence: The strongest measured compiler leverage: original fine 30.5–33.0 s versus diagnostic 8.6–8.7 s. Recoverable full-load seconds unknown; earlier caching and loop rewrites did not suffice.

Acceptance: Unchanged visual features; controlled daylight image checks, full saved-state load repeats, and no flight-frame regression.

**2. Reduce repeated road/polygon boundary queries during construction.** Use the Chrome call paths to target build-scoped spatial candidate selection and reuse of exact boundary/height results. Preserve edits/invalidation and use existing height memoization rather than duplicating it. Avoid changing the global robust distance helper used by physics.

Expected benefit/evidence: Sampled distance work is substantial across terrain patches, pavement and vegetation; exact startup saving not yet measured.

Acceptance: Existing terrain/premises equivalence and height/collision checks, exact point coverage, followed by real browser load.

**3. Make runway relief refinement local and distance-aware.** Measure mesh counts per strip and polygon first. Avoid extending local refinement across an entire strip or a diagonal polygon bounding box. Keep the near-aircraft relief and wheel-contact shape; any actual detail reduction requires user consent.

Expected benefit/evidence: Potential CPU, upload and runtime triangle reduction. Existing handover reports +1.2–1.4 million nearby bump triangles, not independently remeasured here.

Acceptance: No cracks or raised pavement; terrain-match and contact checks plus near/far images and a runway scripted test.

**4. Separate vegetation completion from repeated whole-world updates.** Record progress per fill/cover job, explain the 1500-update cap, cache stable biome/slope inputs with correct edit invalidation, and stop rerunning unrelated world systems to drain a specific queue. Measure sub-alpine contribution separately before proposing any density change.

Expected benefit/evidence: Measured fill ~7.7 s and cover ~4.9 s inside instrumented settling; these are workloads, not guaranteed savings.

Acceptance: Same distribution and density for the same state; no late freeze on first departure; no hidden queue presented as settled.

Raw Chrome profile and recorder scopes: evidence/PERFORMANCE-2026-11-19/geometry-cpu-profile/{chrome.cpuprofile,stage-data.json}. Compiler source/result pairs: evidence/PERFORMANCE-2026-11-19/shader-critical-path/cliff-compiler-*.json. The normal runtime is unchanged.

## Retained cuts, terrain memo repair and guarded benchmarks

Updated 2026-11-20T13:03:10.415Z. This section supersedes earlier proposed actions where they have now been implemented or tested.

**Completed matched scenery comparison:** 164.591 → 121.247 s, 43.344 s (26.3%) lower in this pair. One matched pair, same build/pacing/fixture, fresh browser profiles. Simultaneous feature cuts; no individual feature attribution. Both passed normal readiness and two unchanged-design round trips. The revised user ceiling is90°C, automatic stop85°C; sampled peak80°C in each completed run. Extra cuts remain diagnostic options, not the default trimmed profile.

| Run | Status | Garage ready (s) | Sampled CPU peak (°C) | Build |
| --- | --- | ---: | ---: | --- |
| trimmed-actors-1 | Completed | 193.037 | not recorded | 382fd6a165ad |
| trimmed-baseline-pace2-90c | Loader failure — exclude | — | 75 | 232d06968cec |
| trimmed-baseline-pace8-90c | Completed | 164.591 | 80 | 232d06968cec |
| trimmed-cache-1 | Completed | 162.003 | not recorded | aec89037e494 |
| trimmed-cache-legacy | Interrupted / no completed summary — exclude | — | not recorded | — |
| trimmed-cache-legacy-resumed | Completed | 164.872 | 79 | aec89037e494 |
| trimmed-pavmicro-off | Completed | 152.447 | 75 | 09555f4b5f53 |
| trimmed-pavnoise-1 | Completed | 182.456 | 84 | 7a00973d674b |
| trimmed-road-bounds-1 | THERMAL ABORT — exclude | — | 85 | — |
| trimmed-road-bounds-2 | THERMAL ABORT — exclude | — | 86 | — |
| trimmed-road-bounds-3 | Completed | 161.388 | 84 | 780109adbe73 |
| trimmed-scenery-cut-1 | THERMAL ABORT — exclude | — | 81 | — |
| trimmed-scenery-pace2 | THERMAL ABORT — exclude | — | 84 | 232d06968cec |
| trimmed-scenery-pace8-90c | Completed | 121.247 | 80 | 232d06968cec |
| trimmed-scenery-pavmicro-off | Completed | 95.740 | 79 | 09555f4b5f53 |

- perftrim=1 parks the R1 cliff/rock implementation (shader feature, bias worker, macro map and procedural rock ring) and returns to the prior texture recipe. It also disables the flown-bake module before initialization and uses only prebuilt stock Cub/C172/Jodel props. Source code is retained; no removal from master or publication.
- Completed cut runs record no player fleet captures, bakes, decodes, cache writes or pending queue, including after two unchanged-design round trips. FLOWN_BAKE is null; no bake step work occurs. Three stock containers still load: about 41 MiB combined on disk; decoding in the first cut run took 21–29 ms each. Prebuilt prop loading/upload/material costs remain; zero runtime bake does not mean zero aircraft cost.
- Terrain memo repair: low-bit hashing used two of 16,384 slots on a 2 m grid. High-bit mixing uses 7,431 slots on the test grid while retaining exact coordinate checks and existing invalidation/weather bypasses. 140,000 actual-read-function comparisons pass bit-identically. Cache hits observed at garage: 8.60M repaired vs 4.01M legacy, with different call totals.
- Do not attribute 193.037→162.003 s wholly to the memo repair. A same-build legacy hash reached164.872 s after a host crash/restart. The observed cache-pair difference is2.869 s, single pair across restart; no reliable fixed saving established. World build was34.972 vs35.950 s, settle18.215 vs18.740 s, shader gates70.875 vs70.422 s.
- Ground compilation is successfully excluded from the R1 block: captured sources contain GS_NOTROND. In the first cut run coarse ground was observed ready88.317 s and fine113.439 s; pavement remained pending until165.450 s. The bottleneck moved; original isolated shader savings are not summed into startup savings.
- Extra scenery diagnostic combines town=none, forestedge=0, subalpine=0, fmist=0, animals=0, cars=0, dust=0, waterfx=0, dmglook=0, scuff=0, cracks=0. It cannot attribute individual costs. It removes the mk_ town including keep exceptions; scenery cars/road traffic rather than every authored car. Crack image fetch and whole aircraft scuff hooks are distinct switches. It leaves AFB02/20 and the main water shader present.
- The default-concurrency scenery diagnostic was stopped at81°C by the80°C guard and is not a speed result. The ceiling at those aborts was85°C; the user subsequently raised it to90°C. The pace2 test also aborted at84°C during the first world visit. LHM recorded a maximum84°C, below the user85°C ceiling, and later current45°C. GPU tests initially stopped. User then raised the ceiling to90°C; current guard is85°C. The resumed full baseline at pace2 hit a loading watchdog and is excluded. Normal pace8 comparisons resumed. Compare only matching pacing settings.
- Recent references are visible Chrome, RTX3080, saved Piper Cub/full hangar,5120×1271/DPR1. No native F11 verification or driver-cache erasure claim. A host restart occurred between the162-second run and the resumed legacy control. No complete crash/cockpit/scripted-circuit acceptance is claimed.

### Preparation and round-trip details

| Completed run | World geometry (s) | Settle (s) | World shader gate (s) | Hangar shader gate (s) | Worst garage rAF gap (ms) |
| --- | ---: | ---: | ---: | ---: | ---: |
| trimmed-actors-1 | 36.954 | 20.662 | 87.808 | 15.657 | 35.5 |
| trimmed-baseline-pace8-90c | 35.033 | 18.042 | 72.849 | 6.927 | 15.1 |
| trimmed-cache-1 | 34.972 | 18.215 | 70.875 | 7.035 | 16.4 |
| trimmed-cache-legacy-resumed | 35.950 | 18.740 | 70.422 | 6.995 | 14.9 |
| trimmed-pavmicro-off | 35.374 | 18.761 | 31.412 | 40.668 | 30.5 |
| trimmed-pavnoise-1 | 36.086 | 19.878 | 84.195 | 9.052 | 33.6 |
| trimmed-road-bounds-3 | 31.933 | 16.513 | 70.724 | 10.347 | 18.0 |
| trimmed-scenery-pace8-90c | 31.543 | 12.821 | 51.373 | 3.334 | 15.2 |
| trimmed-scenery-pavmicro-off | 31.775 | 11.124 | 23.061 | 8.496 | 15.6 |

**trimmed-actors-1**: departure-1 10.608 s; return-1 0.410 s; departure-2 9.967 s; return-2 0.330 s.

**trimmed-baseline-pace8-90c**: departure-1 9.002 s; return-1 0.367 s; departure-2 8.836 s; return-2 0.330 s.

**trimmed-cache-1**: departure-1 9.491 s (following soak CPU-profiled); return-1 0.487 s; departure-2 10.190 s; return-2 0.328 s.

**trimmed-cache-legacy-resumed**: boot-only, no round-trip claim.

**trimmed-pavmicro-off**: departure-1 9.535 s; return-1 0.385 s; departure-2 8.868 s; return-2 0.319 s.

**trimmed-pavnoise-1**: departure-1 9.533 s; return-1 0.381 s; departure-2 9.351 s; return-2 0.323 s.

**trimmed-road-bounds-3**: departure-1 9.468 s; return-1 0.365 s; departure-2 8.813 s; return-2 0.322 s.

**trimmed-scenery-pace8-90c**: departure-1 8.373 s; return-1 0.371 s; departure-2 8.379 s; return-2 0.303 s.

**trimmed-scenery-pavmicro-off**: departure-1 8.374 s; return-1 0.387 s; departure-2 8.385 s; return-2 0.318 s.

### Further diagnosis: what is already baked or optimized

**Lake borders.** Already stored in a signed-distance field, copied/adjusted for drawn lakes and shared with the water shader and vegetation. Sampling drawnLakeSD is bilinear lookup, not a fresh polygon-distance search.

Next action: Keep the shared field. Profile/reuse the composed lake-field adjustment; avoid inventing another full-lake border bake.

**Lake flattening / carved beds.** lakeCarve can evaluate terrain composition a second time at the lakebed to preserve roads/runway fills. The regular terrain memo stores its result; collision bypasses previously destroyed much of that reuse. Build reads deliberately bypass lazy raster creation in uncooked cells.

Next action: Retain exact final-height reuse first. Future persistent maps need premise, lake and ground/wear invalidation; do not simply replace current composed heights with the raw DEM.

**Slope / biome classification.** Vegetation codeAt uses finite height taps; sub-alpine ridge thinning adds four110m taps on applicable points. Raw slope maps cannot substitute for edited roads/grades without an update path.

Next action: Measure a shared, revision-keyed slope/classification tile cache. Keep exact near-aircraft terrain/collision and use current edited composition.

**Roads.** Road segments already have a spatial index, bounded roadDistNear queries, and editing geometry caches. Nevertheless sampled road/polygon distances dominate several terrain/vegetation call paths. Road and apron caches are mainly editing caches, not shipped first-load geometry.

Next action: Implemented finite influence bounds in five pavement/vegetation callers,100940 exact fixture comparisons, completed browser161.388 s vs164.592 s prior reference (single comparison, modest3.203 s). Original pavement source identical. Other unbounded queries retain the original path. Next target geometry/refinement or higher-level shared fields; do not add another spatial index.

**Vegetation fill.** Trimmed CPU profile: fill7.859 s, cover4.845 s, premises scope0.151 s within20.780 s settle. Fill sample subtree7.757 s, dominated by walkRows and terrain/material queries. BIO.hold already snapshots knobs per walk; do not repeat that optimization. The1500-update cap still expires with86 entries queued.

Next action: Separate completion counters from repeated world updates; cache stable query results with proper invalidation. Forest-band/sub-alpine diagnostic is separate from a permanent density reduction.

**Terrain patches / aerodromes.** Exact neighbour cache and per-strip yielding are retained. New CPU profiling still finds patching~8 s and aerodromes~7.3 s. Pavement refineAxis inserts full rows/columns and polyGeometry covers world-axis polygon boxes; per-builder height memoization already exists.

Next action: Localize refinement and avoid unnecessary outside-polygon work while preserving shoulders, normals and wheel-contact shape. Measure strip/patch counts before proposing fidelity reductions.

**Water.** Two identified water programs are present in the ordinary references. Early representative completion was~2.9 s, not a full water-system cost. Main water remains present even when waterfx=0 disables aircraft spray pools.

Next action: Separate shader preparation from reflection captures, waves, foam/spray and runtime GPU rendering; no zero-cost claim from the short CPU sample.

**Cars / animals / effects.** Road traffic follows paths with sorted following-gap logic; far traffic already sleeps. The short flight CPU sample identifies at least~8 ms traffic and~14 ms animal-owned samples over~5.87 s, not complete costs or a GPU attribution. Crack sheets are pre-baked textures; scuff/damage hooks and dust/spray materials have separate compilation costs.

Next action: Use the combined-cut result as a screening test, then isolate only the systems worth further work. AFB02/20 remains for a separate record/geometry comparison.

Raw summaries, shader sources, CPU profiles and temperature logs are in the named evidence directories. The failed thermal run and interrupted host-crash run remain excluded. No generated main files are committed, and nothing is published.

## Exact road bounds: completed browser validation

**Retained.**161.388 s garage versus164.592 s prior reference:3.203 s/1.9% observed, single comparison, not a fixed saving. Town/ecosystems/effects and runway cues retained; common cliff/bake exclusions remain. Two departures9.468/8.813 s, returns0.365/0.322 s.20 s garage soak: maximum18 ms rAF gap, no gaps over100 ms. Zero captured GL errors; two pre-existing sparse-impostor warnings remain.

100,940 exact-result comparisons over97 roads pass for coverAt (sides and pavement-only), treePaveAt, pavedNear and pavedAt. The five callers use finite maximum influence distances with the existing index; other consumers still request exact unbounded distance. No road/terrain geometry, vegetation rules or visual density change. Captured pavement vertex and fragment source IDs are identical to reference.

World generation35.033→31.933 s; nearby settle18.042→16.513 s; world shader gate72.849→70.724 s; hangar shader gate6.927→10.347 s. Gates overlap compilation and are not additive shader bills. This remains a modest CPU optimization, not the20-second-garage solution. Earlier attempts stopped at85/86°C and are excluded. Completed peak84°C under explicit87°C guard, user ceiling90°C.

Evidence: evidence/PERFORMANCE-2026-11-19/material-cache/road-bounds-cpu-check.json, road-bounds-source-check.json, trimmed-road-bounds-3/summary.json and thermal.jsonl.

## Runway cues preserved: exact coefficient-cache experiment

**Correctness passed for the tested patch; performance rejected. Default remains the original full-cue shader.** CPU checks:20,000 integer hashes and80,000 exact noise samples. Browser load182.456 s versus earlier164.592 s reference; not a saving. Both round trips passed.12 fields,8 MiB GPU texture plus8 MiB CPU backing,8.3 ms generation. Scope: Controlled actual rough-runway material row on identical synthetic patch geometry, fixed lighting/camera; dry and wet. Not a full-world screenshot or physical relief geometry check.

| Wetness | Mean byte error | Maximum byte error | Difference when cues disabled |
| --- | ---: | ---: | ---: |
| 0 | 0 | 0 | 1.140 |
| 0.8 | 0 | 0 | 1.175 |

Full-width5120×1271 controlled patch GPU samples (ms), original: 8.734, 9.632, 9.790, 8.587, 9.418, 8.654. Cached: 9.853, 10.411, 9.411, 10.286, 10.187, 9.471. Extra texture lookups did not improve this test. These are not full-game frame times. Dry/wet images, metric JSON and captured source identities are under evidence/PERFORMANCE-2026-11-19/material-cache/trimmed-pavnoise-1/. CPU peak84°C, below user90°C ceiling. The prototype remains opt-in for diagnosis, not enabled as a shipped optimization.

## Next priority: pavement compiler structure

Compilation only, sequential programs, fresh browser profiles in both orders, shader disk cache disabled; driver cache not independently erased. All eight links passed. Captured source identifies the material, not exclusive whole-game cost.

| Compiler case | First order (s) | Reverse order (s) |
| --- | ---: | ---: |
| pavement-original | 30.978 | 28.783 |
| pavement-hard-only-DIAGNOSTIC | 4.430 | 4.394 |
| pavement-soft-only-DIAGNOSTIC | 24.246 | 25.874 |
| pavement-no-micro-relief-DIAGNOSTIC | 11.752 | 11.142 |

Hard+soft totals: 28.676 / 30.268 s versus original 30.978 / 28.783 s. Do not integrate hard/soft splitting for startup: its total compiler cost is not consistently lower, and it adds draw/material grouping complexity. Micro-relief exclusion is a strong repeated diagnostic lead. pavmicro=0 is opt-in only and bypasses the shader cue block; geometry, CPU contact and normal-map textures remain. Full load/visual acceptance must be assessed separately.

The implemented pavmicro=0 diagnostic changes only the shader micro-relief cue block and its program cache key. All strip/road/polygon geometry, physical contact, recipe textures and CPU alpha functions remain unchanged; VM checks compare the exact functions and shader substitution. It affects visual bump/hollow/rut/wet cues on applicable non-grass soft strips. It is not enabled by default. User subsequently required those cues to remain: this switch is only a cost diagnostic, not a proposed final graphics setting. No hard/soft material split was integrated.

### integrated-candidate-1

Query: mode=sandbox&parkstock=1&groundcache=1. Build: 5665070d4f4d. Normal boot health: true.

Garage readiness from navigation: 198.449 s.

Rendered benchmark status: **INVALID / unsuccessful; exclude from speed claims**.

| Operation | Seconds |
| --- | ---: |
| departure-1 | 7.869 |
| return-1 | 0.359 |
| departure-2 | 7.740 |
| return-2 | 0.317 |

Recorded errors: []. Page errors: ["ERR impostor bake: birch|Birch2_21 snag sheet EMPTY (drawn 0.46 %, mean byte 49.6)","ERR impostor bake: pine_lampi.glb|bark04_0 snag sheet EMPTY (drawn 0.50 %, mean byte 65.4)","ERR THREE.WebGLProgram: Shader Error 0 - VALIDATE_STATUS false\n\nMaterial Name: ground:cache-baker\nMaterial Type: MeshStandardMaterial\n\nProgram Info Log: Fragment shader is not compiled.\n\nFRAGMENT\n\nERROR: 0:520: 'uMaterialBakeEye' : undeclared identifier\nERROR: 0:520: 'xz' :  field selection requires str","ERR THREE.WebGLProgram: Shader Error 1282 - VALIDATE_STATUS false\n\nMaterial Name: ground:cache-baker\nMaterial Type: MeshStandardMaterial\n\nProgram Info Log: Fragment shader is not compiled.\n\nFRAGMENT\n\nERROR: 0:520: 'uMaterialBakeEye' : undeclared identifier\nERROR: 0:520: 'xz' :  field selection requires "].

Integration counters at readiness: {"pairs":2,"sourceBuilds":4,"renders":35,"width":4160,"height":1271,"bytes":84597760,"failures":[]}.

Full data: [integrated-candidate-1 summary](evidence/PERFORMANCE-2026-11-19/material-cache/integrated-candidate-1/summary.json); program sources, phase submissions and long tasks: integrated-candidate-1/programs.json.gz.

### integrated-candidate-2

Query: mode=sandbox&parkstock=1&groundcache=1. Build: d00eeee0916d. Normal boot health: true.

Garage readiness from navigation: 192.497 s.

Rendered benchmark status: **INVALID / unsuccessful; exclude from speed claims**.

Recorded errors: ["Error: Invalid rendered readiness: shader/draw errors; timings excluded"]. Page errors: ["ERR impostor bake: birch|Birch2_21 snag sheet EMPTY (drawn 0.46 %, mean byte 49.6)","ERR impostor bake: pine_lampi.glb|bark04_0 snag sheet EMPTY (drawn 0.50 %, mean byte 65.4)","ERR THREE.WebGLProgram: Shader Error 0 - VALIDATE_STATUS false\n\nMaterial Name: ground:cache-baker\nMaterial Type: MeshStandardMaterial\n\nProgram Info Log: Fragment shader is not compiled.\n\nFRAGMENT\n\nERROR: 0:520: 'uMaterialBakeEye' : undeclared identifier\nERROR: 0:520: 'xz' :  field selection requires str","ERR THREE.WebGLProgram: Shader Error 1282 - VALIDATE_STATUS false\n\nMaterial Name: ground:cache-baker\nMaterial Type: MeshStandardMaterial\n\nProgram Info Log: Fragment shader is not compiled.\n\nFRAGMENT\n\nERROR: 0:520: 'uMaterialBakeEye' : undeclared identifier\nERROR: 0:520: 'xz' :  field selection requires "].

Integration counters at readiness: {"pairs":2,"sourceBuilds":4,"renders":41,"width":4160,"height":1271,"bytes":84597760,"failures":[]}.

Full data: [integrated-candidate-2 summary](evidence/PERFORMANCE-2026-11-19/material-cache/integrated-candidate-2/summary.json); program sources, phase submissions and long tasks: integrated-candidate-2/programs.json.gz.

### integrated-candidate-3

Query: mode=sandbox&parkstock=1&groundcache=1. Build: not yet recorded. Normal boot health: not yet recorded.

Garage readiness from navigation: not completed.

Rendered benchmark status: **INVALID / unsuccessful; exclude from speed claims**.

Recorded errors: ["Error: page_rig: loading screen gone without a healthy completed boot"]. Page errors: [].

Full data: [integrated-candidate-3 summary](evidence/PERFORMANCE-2026-11-19/material-cache/integrated-candidate-3/summary.json); program sources, phase submissions and long tasks: integrated-candidate-3/programs.json.gz.

### integrated-candidate-4

Query: mode=sandbox&parkstock=1&groundcache=1. Build: 0a77832e847e. Normal boot health: false.

Garage readiness from navigation: 245.007 s.

Rendered benchmark status: **INVALID / unsuccessful; exclude from speed claims**.

Recorded errors: ["Error: Invalid readiness: loader failure/timeout; diagnostics retained, timings excluded"]. Page errors: ["ERR impostor bake: birch|Birch2_21 snag sheet EMPTY (drawn 0.46 %, mean byte 49.6)","ERR impostor bake: pine_lampi.glb|bark04_0 snag sheet EMPTY (drawn 0.50 %, mean byte 65.4)"].

Integration counters at readiness: {"pairs":2,"sourceBuilds":4,"renders":48,"width":4160,"height":1271,"bytes":84597760,"failures":[],"sources":[{"role":"lit","t":46021.70000000298,"phase":"town","key":"island-ring|material-cache-v1:lit","length":185614},{"role":"baker","t":46025,"phase":"town","key":"island-ring|material-cache-v1:baker","length":169378},{"role":"lit","t":83591.5,"phase":"snapshot","key":"island-fine|material-cache-v1:lit","length":185582},{"role":"baker","t":83598.09999999404,"phase":"snapshot","key":"island-fine|material-cache-v1:baker","length":169346}],"slowDraws":[{"t":176960.29999999702,"bakeMs":3.2000000029802322,"litMs":157.29999999701977,"width":4160,"height":1271,"phase":"compile"},{"t":198894,"bakeMs":19964.09999999404,"litMs":20341.09999999404,"width":4160,"height":1271,"phase":"frames"},{"t":239274.89999999106,"bakeMs":62.900000005960464,"litMs":101,"width":4160,"height":1271,"phase":"frames"},{"t":239596.20000000298,"bakeMs":892.5999999940395,"litMs":17.200000002980232,"width":4160,"height":1271,"phase":"frames"},{"t":240616,"bakeMs":447.29999999701977,"litMs":13.900000005960464,"width":4160,"height":1271,"phase":"frames"}]}.

Full data: [integrated-candidate-4 summary](evidence/PERFORMANCE-2026-11-19/material-cache/integrated-candidate-4/summary.json); program sources, phase submissions and long tasks: integrated-candidate-4/programs.json.gz.

### integrated-candidate-5

Query: mode=sandbox&parkstock=1&groundcache=1. Build: c330799189c6. Normal boot health: false.

Garage readiness from navigation: 244.496 s.

Rendered benchmark status: **INVALID / unsuccessful; exclude from speed claims**.

Recorded errors: ["Error: Invalid readiness: loader failure/timeout; diagnostics retained, timings excluded"]. Page errors: ["ERR impostor bake: birch|Birch2_21 snag sheet EMPTY (drawn 0.46 %, mean byte 49.6)","ERR impostor bake: pine_lampi.glb|bark04_0 snag sheet EMPTY (drawn 0.50 %, mean byte 65.4)"].

Integration counters at readiness: {"pairs":2,"sourceBuilds":4,"renders":34,"width":4160,"height":1271,"bytes":84597760,"failures":[],"sources":[{"role":"lit","t":46961.10000000894,"phase":"town","key":"island-ring|material-cache-v1:lit","length":185614},{"role":"baker","t":46964.40000000596,"phase":"town","key":"island-ring|material-cache-v1:baker","length":169378},{"role":"lit","t":88260.30000001192,"phase":"snapshot","key":"island-fine|material-cache-v1:lit","length":185582},{"role":"baker","t":88264,"phase":"snapshot","key":"island-fine|material-cache-v1:baker","length":169346}],"slowDraws":[{"t":185163,"bakeMs":0,"litMs":252.20000000298023,"width":4160,"height":1271,"phase":"firstFrame"},{"t":201067.90000000596,"bakeMs":19242.59999999404,"litMs":19675.39999999106,"width":4160,"height":1271,"phase":"frames"},{"t":240089.60000000894,"bakeMs":0.5999999940395355,"litMs":152.40000000596046,"width":4160,"height":1271,"phase":"frames"}]}.

Full data: [integrated-candidate-5 summary](evidence/PERFORMANCE-2026-11-19/material-cache/integrated-candidate-5/summary.json); program sources, phase submissions and long tasks: integrated-candidate-5/programs.json.gz.

### integrated-candidate-6

Query: mode=sandbox&parkstock=1&groundcache=1&shaderlogs=0. Build: b0527a1d48dd. Normal boot health: false.

Garage readiness from navigation: 247.746 s.

Rendered benchmark status: **INVALID / unsuccessful; exclude from speed claims**.

Recorded errors: ["Error: Invalid readiness: loader failure/timeout; diagnostics retained, timings excluded"]. Page errors: ["ERR impostor bake: birch|Birch2_21 snag sheet EMPTY (drawn 0.46 %, mean byte 49.6)","ERR impostor bake: pine_lampi.glb|bark04_0 snag sheet EMPTY (drawn 0.50 %, mean byte 65.4)"].

Integration counters at readiness: {"pairs":2,"sourceBuilds":4,"renders":38,"width":4160,"height":1271,"bytes":84597760,"failures":[],"sources":[{"role":"lit","t":46902.79999999702,"phase":"town","key":"island-ring|material-cache-v1:lit","length":185614},{"role":"baker","t":46905.90000000596,"phase":"town","key":"island-ring|material-cache-v1:baker","length":169378},{"role":"lit","t":86168,"phase":"snapshot","key":"island-fine|material-cache-v1:lit","length":185582},{"role":"baker","t":86174.79999999702,"phase":"snapshot","key":"island-fine|material-cache-v1:baker","length":169346}],"slowDraws":[{"t":179530.40000000596,"bakeMs":0.09999999403953552,"litMs":206.90000000596046,"width":4160,"height":1271,"phase":"compile"},{"t":203326.90000000596,"bakeMs":20231.70000000298,"litMs":19716.59999999404,"width":4160,"height":1271,"phase":"frames"},{"t":243337.10000000894,"bakeMs":0.5999999940395355,"litMs":139.90000000596046,"width":4160,"height":1271,"phase":"frames"}]}.

Full data: [integrated-candidate-6 summary](evidence/PERFORMANCE-2026-11-19/material-cache/integrated-candidate-6/summary.json); program sources, phase submissions and long tasks: integrated-candidate-6/programs.json.gz.

### integrated-candidate-7

Query: mode=sandbox&parkstock=1&groundcache=2. Build: ee694f8981b9. Normal boot health: true.

Garage readiness from navigation: 205.694 s.

Rendered benchmark status: **completed; assess detailed errors and scope**.

| Operation | Seconds |
| --- | ---: |
| departure-1 | 7.960 |
| return-1 | 0.568 |
| departure-2 | 7.925 |
| return-2 | 0.368 |

Recorded errors: []. Page errors: ["ERR impostor bake: birch|Birch2_21 snag sheet EMPTY (drawn 0.46 %, mean byte 49.6)","ERR impostor bake: pine_lampi.glb|bark04_0 snag sheet EMPTY (drawn 0.50 %, mean byte 65.4)"].

Integration counters at readiness: {"packed":true,"pairs":2,"sourceBuilds":4,"renders":35,"width":4160,"height":1271,"bytes":84597760,"failures":[],"sources":[{"role":"lit","t":47375.5,"phase":"town","key":"island-ring|material-cache-v2:packed:lit","length":185779},{"role":"baker","t":47379.40000000596,"phase":"town","key":"island-ring|material-cache-v2:packed:baker","length":169477},{"role":"lit","t":85491.70000000298,"phase":"snapshot","key":"island-fine|material-cache-v2:packed:lit","length":185747},{"role":"baker","t":85497.90000000596,"phase":"snapshot","key":"island-fine|material-cache-v2:packed:baker","length":169445}],"slowDraws":[{"t":178936.70000000298,"bakeMs":0.10000000894069672,"litMs":242.29999999701977,"width":4160,"height":1271,"phase":"compile"},{"t":200598,"bakeMs":21.100000008940697,"litMs":518,"width":4160,"height":1271,"phase":"frames"},{"t":201188.90000000596,"bakeMs":0.5999999940395355,"litMs":142.6000000089407,"width":4160,"height":1271,"phase":"frames"}]}.

Full data: [integrated-candidate-7 summary](evidence/PERFORMANCE-2026-11-19/material-cache/integrated-candidate-7/summary.json); program sources, phase submissions and long tasks: integrated-candidate-7/programs.json.gz.

### integrated-candidate-8-repeat

Query: mode=sandbox&parkstock=1&groundcache=2. Build: ee694f8981b9. Normal boot health: true.

Garage readiness from navigation: 206.659 s.

Rendered benchmark status: **completed; assess detailed errors and scope**.

| Operation | Seconds |
| --- | ---: |
| departure-1 | 8.089 |
| return-1 | 0.600 |
| departure-2 | 7.859 |
| return-2 | 0.392 |

Recorded errors: []. Page errors: ["ERR impostor bake: birch|Birch2_21 snag sheet EMPTY (drawn 0.46 %, mean byte 49.6)","ERR impostor bake: pine_lampi.glb|bark04_0 snag sheet EMPTY (drawn 0.50 %, mean byte 65.4)"].

Integration counters at readiness: {"packed":true,"pairs":2,"sourceBuilds":4,"renders":35,"width":4160,"height":1271,"bytes":84597760,"failures":[],"sources":[{"role":"lit","t":46834.29999999702,"phase":"town","key":"island-ring|material-cache-v2:packed:lit","length":185779},{"role":"baker","t":46836.89999999106,"phase":"town","key":"island-ring|material-cache-v2:packed:baker","length":169477},{"role":"lit","t":84756.09999999404,"phase":"snapshot","key":"island-fine|material-cache-v2:packed:lit","length":185747},{"role":"baker","t":84762.79999999702,"phase":"snapshot","key":"island-fine|material-cache-v2:packed:baker","length":169445}],"slowDraws":[{"t":182597.29999999702,"bakeMs":0,"litMs":233.5,"width":4160,"height":1271,"phase":"compile"},{"t":201592.5,"bakeMs":21.200000002980232,"litMs":500.8999999910593,"width":4160,"height":1271,"phase":"frames"},{"t":202162.09999999404,"bakeMs":0.5,"litMs":144.1000000089407,"width":4160,"height":1271,"phase":"frames"}]}.

Full data: [integrated-candidate-8-repeat summary](evidence/PERFORMANCE-2026-11-19/material-cache/integrated-candidate-8-repeat/summary.json); program sources, phase submissions and long tasks: integrated-candidate-8-repeat/programs.json.gz.

### integrated-control-1

Query: mode=sandbox&parkstock=1&groundcache=0. Build: 0c6725a90a31. Normal boot health: true.

Garage readiness from navigation: 208.592 s.

Rendered benchmark status: **completed; assess detailed errors and scope**.

| Operation | Seconds |
| --- | ---: |
| departure-1 | 7.352 |
| return-1 | 0.890 |
| departure-2 | 7.745 |
| return-2 | 0.351 |

Recorded errors: []. Page errors: ["ERR impostor bake: birch|Birch2_21 snag sheet EMPTY (drawn 0.46 %, mean byte 49.6)","ERR impostor bake: pine_lampi.glb|bark04_0 snag sheet EMPTY (drawn 0.50 %, mean byte 65.4)"].

Full data: [integrated-control-1 summary](evidence/PERFORMANCE-2026-11-19/material-cache/integrated-control-1/summary.json); program sources, phase submissions and long tasks: integrated-control-1/programs.json.gz.

### integrated-control-2

Query: mode=sandbox&parkstock=1&groundcache=0. Build: ee694f8981b9. Normal boot health: true.

Garage readiness from navigation: 218.046 s.

Rendered benchmark status: **completed; assess detailed errors and scope**.

| Operation | Seconds |
| --- | ---: |
| departure-1 | 8.000 |
| return-1 | 0.567 |
| departure-2 | 7.804 |
| return-2 | 0.377 |

Recorded errors: []. Page errors: ["ERR impostor bake: birch|Birch2_21 snag sheet EMPTY (drawn 0.46 %, mean byte 49.6)","ERR impostor bake: pine_lampi.glb|bark04_0 snag sheet EMPTY (drawn 0.50 %, mean byte 65.4)"].

Full data: [integrated-control-2 summary](evidence/PERFORMANCE-2026-11-19/material-cache/integrated-control-2/summary.json); program sources, phase submissions and long tasks: integrated-control-2/programs.json.gz.

## Integration observations and corrective actions

### Integrated candidate 1 — failed rendering; timing invalid

Build 5665070d4f4d reached normal BOOT readiness at 198.378 s, but the real main-world draw reported ground:cache-baker fragment compilation failure: uMaterialBakeEye undeclared. The fully expanded diagnostic source contained a cameraPosition declaration; an onBeforeCompile hook source does not, because Three injects it later. This readiness time is not an optimization result.

Correction / next action: Add the eye uniform declaration only when absent, cover both expanded/unexpanded source forms in the guard, and fail the benchmark before trips when shader/draw errors occur. Rebuild, then repeat the actual browser run.

### Integrated candidate 2 — failed rendering; timing invalid

Build d00eeee0916d reached normal readiness at 192.497 s but the builder still failed. Its added eye uniform was at line 2873, after helper functions first used it at line 520. The first corrective patch declared it before main, which was insufficient in GLSL. Captured source proves the ordering error. Independently, review found the compile wrapper submitted non-ground scene materials a second time into the linear material target, generating unused aircraft/building variants.

Correction / next action: Place an explicitly highp eye declaration before all helper functions, preserving #version ordering. Guard declaration-before-first-use. Compile only ground stand-ins for the builder pass, retaining the original world as its lighting scene. Add a CPU regression check that non-ground materials are not submitted twice. Repeat the cold browser test; both prior times remain excluded.

### Integrated builder preflight and compile-scope guard — passed

Both corrected actual integrated builder source pairs linked on RTX 3080/ANGLE D3D11 in the direct GPU preflight (29.1/30.9 s when submitted together; these are overlapping completion times, not additive exclusive costs). The CPU integration check verifies that the second compilation submits only ground builder stand-ins, preserves the lighting scene, returns all derived materials for readiness polling, and restores original object materials/render target.

Correction / next action: Run candidate 3 and a matched flag-off control using build 0c6725a90a31, the same saved state, visible Chrome and full-hangar configuration. Accept only zero shader/draw errors plus advancing flight.

### Integrated candidate 3 — loader hard timeout; excluded

Build 0c6725a90a31 passed shader preflight and reached worldCompile at 99.3 s, garage compile at 155.4 s and first-light frames at 196.4 s. The loader then recorded hard timeout at 236.388 s and was gone/idle at 240.906 s. Normal-ready evidence was absent, so no garage timing or trip was accepted. No shader error was printed, but this does not establish full rendering correctness. PR.start rejected/closed the page before returning its handle, losing the detailed source census for this attempt.

Correction / next action: Keep the health rejection, but use explicit diagnostic continuation in the benchmark followed by an immediate failure check so forensic snapshots survive timeouts. Run a matched flag-off control before attributing this stall. Investigate first-light shader variants/draw preparation; do not lengthen watchdogs or report timeout as success.

### Matched flag-off control 1 — completed normally

Build 0c6725a90a31, full hangar, saved fixture, visible Chrome: readiness 208.592 s; departures 7.352/7.745 s, returns 0.890/0.351 s; GL error zero. Thus candidate 3 hard timeout is not a passing alternative to the baseline. Control screenshots and complete shader census retained.

Correction / next action: Candidate 4 fixes the builder to a zero-light signature in BOTH compile and render; it computes material before lighting, so no light/shadow feature is removed from the final pass. Record slow builder vs lighting draw times and source variants to diagnose first-light cost. This changes only flag-on code plus instrumentation; flag-off rendering remains functionally identical.

### Control post-ready responsiveness — measured limitation

Control 1 normal readiness is not equivalent to freeze-free operation: the subsequent garage soak recorded a maximum rAF gap of 1707.1 ms and a 1568 ms long task; first world soak had a 1640 ms gap, while the second world soak max was 50.1 ms. All are bounded observations from this harness, not the user manual test. Screenshot encoding occurs after soak windows and is excluded from these summaries.

Correction / next action: Keep post-ready frame gaps visible alongside load times. Do not declare the under-20-second, immediately usable garage goal achieved merely because BOOT reports ready. The fixed-zero-light builder is currently under full-browser test.

### Integrated candidate 4: retained first-draw diagnostics — loader hard timeout; not accepted

Build 0a77832e847e, zero-light builder: exactly four source builds (coarse/fine lit+builder), all submitted by snapshot. First light at 198.894 s recorded builder CPU submission 19964.1 ms and following full-scene submission 20341.1 ms, with no new ground source construction. Loader hard timeout at 239.166 s, idle cover gone at 244.949 s; GL error 1282. This rules out a late new ground GLSL source as the sole explanation. The following lit timing covers the entire scene, not only the ground lighting reader.

Correction / next action: Keep this failed page alive for bounded draw validation and first-use investigation. Diagnose GL error source separately; investigate native shader/layout/target specialization and complete-scene render cost. Do not interpret shader-only compiler savings as startup savings.

### Retained page: pass isolation correction — implemented; requires cold validation

Draw validation after the failed boot found GL errors in non-ground programs, not the four split shaders. A direct canvas diagnostic took 96.356 s and created additional output-mode variants: this is diagnostic overhead, not a load result, and must not be repeated as a timing test. Code inspection found SHADOW_NEAR.hook always runs parkIn/parkOut and visibility restoration even when automatic shadow updates are disabled. Thus hiding currently visible non-ground materials in the real scene does not establish an isolated builder pass; shadow proxy meshes can become visible during that call.

Correction / next action: Builder now renders a separate ground-only scene using original geometry/world matrices and original parents, with the shadow-render hook bypassed only for that material pass. Final scene retains live lights and shadows. CPU regression confirms ground-only draw, no builder shadow-hook call, normal final lighting, and restoration of parents/materials/target/flags. Own render-target textures are excluded from manual texture upload. The planned hot check was queued after the bounded retained session ended, so it did NOT run. Candidate 5 must provide actual cold validation.

### Candidate 5: successful pass isolation, remaining diagnostic stall — GL error fixed; readiness still failed

Build c330799189c6 isolates the material pass and produced GL error zero, with four ground source builds only. It still hit loader hard timeout at 239.957 s (idle cover gone 244.441 s). The new trace identifies coarse builder program 20: submitted 46.966 s, KHR completion first observed 98.814 s, then getProgramInfoLog at 201.079 s blocks 19.135 s. The subsequent scene submission costs another 19.675 s, not yet attributed to one query. Thus compile-completion and diagnostic/first-use cost differ materially.

Correction / next action: Three onFirstUse eagerly fetches program and BOTH shader logs before checking LINK_STATUS. Add query-flagged successful-warning opt-out that checks LINK_STATUS first and preserves the entire existing failed-link diagnostic branch. CPU tests cover success/error/default cases; all 142 ShaderChunks and all ShaderLib sources remain byte-identical to pinned Three. Candidate 6 uses shaderlogs=0; a matched control with the same policy must follow to separate the effects.

### Candidate 6: successful-log opt-out rejected — no speed win; production change reverted

Build b0527a1d48dd, shaderlogs=0 retained full error checking and skipped successful warning logs as intended. It did NOT avoid the first-use delay: the same coarse builder first-use wait moved to LINK_STATUS, 19.154 s, after KHR completion had been observed at 100.320 s. Builder/scene draw submissions still cost 20.232/19.717 s; GL error zero, but loader hard timeout at 243.236 s. This falsifies the earlier hypothesis that warning-log retrieval itself was unnecessary recoverable work.

Correction / next action: Revert the runtime warning-policy flag and vendor patch application. Keep the small isolated patch/test as an unsuccessful experiment record only. Test a single RGBA32UI attachment containing the identical eight half-float values via packHalf2x16; no layer, colour correction, normal or roughness feature is removed, and storage remains 16 bytes per pixel. This specifically probes multi-output/native-format first-use overhead; validate rendered equivalence and actual full loading, not just link completion.

### Single-buffer packed preflight — shader compilation passed; whole-game test pending

One RGBA32UI attachment encodes the same eight half-float values using four packHalf2x16 words; the reader unpacks them. Storage is still 16 bytes/pixel, with one integer texture lookup instead of two float texture lookups. Direct cold preflight linked the builder in 22.2 s and reader in 0.7 s (wall 23 s). This does not establish first-draw or loading savings.

Correction / next action: Run candidate 7 with groundcache=2 and original shader diagnostics restored. Then compare controlled overhead/oblique pixels against an unsplit reference reconstructed from the live material prefix plus original lighting tail; no original combined program is paid during the cold benchmark solely for reference generation.

### Packed integrated candidate 7 — normal readiness, two round trips and image/GPU checks passed

Build ee694f8981b9, fixed Piper Cub save, full hangar: poll-detected normal readiness 205.694 s, GL zero; departures 7.960/7.925 s and returns 0.568/0.368 s. The first real world builder draw was 21.1 ms and following scene draw 518 ms instead of roughly 20 s each in MRT. Controlled overhead/oblique packed-vs-unsplit reference errors are means 0.007065/0.009517 RGB bytes, p99 zero, max1; inverted-normal negative control detected (mean23.968). GPU stress medians 19.031 ms original /18.984 ms packed, ~99.30 MiB extra buffer storage. Control/candidate whole-scene screenshots inspected: no gross change in the night hangar/stand views.

Correction / next action: Same-build control 2 completed at 218.046 s; earlier control 1 was 208.592 s. These are close enough that one optimized repeat is underway before a startup-gain claim. Keep the packed integration opt-in; preserve the cold census separately from post-benchmark reference/image/GPU commands. Full circuit, edited-aircraft iteration and broader visual acceptance remain unproven.

### Final integrated comparison and decision — Approved mist B default integrated and browser-verified; scuff specialization left OFF

Same build ee694f8981b9: flag-off control 2 reached garage at 218.046 s; packed candidate 7 at 205.694 s and packed repeat 8 at 206.659 s (~5.2â€“5.7% lower in those comparisons). Earlier control 1 was 208.592 s, so the broader spread limits confidence in a fixed saving. Packed departures 7.86â€“8.09 s and returns 0.37â€“0.60 s did not materially improve the already fast controls. Main standard-lit combined ground instances 2â†’0, replaced by two builders and two readers; total program instances remain ~670. WorldCompile elapsed fell from 94.8â€“96.8 s to 64.8â€“65.8 s, but garage compile grew from 5.5â€“10.9 s to 29.4â€“31.9 s. Roughly 100 program submissions shifted from the worldCompile-labelled window to compile; phase savings are not exclusive or additive.

Correction / next action: Keep approved mist B default and original scuff. Next scuff lead is shared-sampler-only without tripling material classes; full specialization had no reliable loading win. Next larger measurement is the scripted circuit/GPU-versus-main-thread world cost: ~23fps and a first-stand147.6ms hitch remain, despite responsive garage and fast unchanged-design trips. Preserve credible damage and mud; no additional cuts without scope/benefit approval. Keep all seconds, failures, screenshots and thermal evidence in PERFORMANCE-REPORT.md.

### Diagnostic/tooling traps for subsequent sessions — recorded; avoid repeating

The first uniform diagnostic selected uSplat/uSplatN texture objects and serialized their embedded compressed arrays, producing an enormous (~132 MB) payload. That was a diagnostic mistake, not game memory attribution. Payloads were pruned to texture metadata. Full-width PNGs also exceeded inline tool output capacity; reduced JPEG previews were generated solely for inspection while original PNGs and numeric comparisons were preserved. Some restricted build invocations intermittently failed opening generated index.html with UNKNOWN; the identical authorized elevated rebuild succeeded.

Correction / next action: Never JSON-serialize live Texture objects or arbitrary renderer state. Select scalar/vector values and texture IDs/dimensions explicitly. Use small inspection previews for large screenshots; retain untouched originals. On generated-page I/O failure, preserve the error and retry the build through the authorized execution path; do not infer a game regression. Keep generated main files uncommitted as requested. All GPU/browser helpers in this batch were closed and their locks released.

### Critical path attribution and source-label corrections — Diagnostic capture complete; no runtime optimization applied

Pause shader rewrites for attribution. Corrected snapshot/photo, certificate restore, ring and six-view warm-up descriptions. New unchanged-build capture normal ready ~214 s: 627/655 programs mapped to creation-time material records; many generic owners still unresolved. Fine-ground #143 still pending near195.564 s, worldCompile closes195.644 s. Settle hit1500-update cap, rest=false, fill busy with57queued.

Correction / next action: Combine game-recorder subsystem counters and Chrome main-thread profiling; retain unknown categories and avoid assigning parallel link delays as exclusive costs.

### Focused compiler and Chrome CPU analysis — Completed diagnostics; all eight isolated shader links passed

Two reversed-order compiler runs identify large R1 cliff/rock compilation contribution. Chrome stage-only CPU profile and existing recorder scope instrumentation identify terrain patch, road-boundary queries and fill/cover workloads. Sub-alpine incremental cost not isolated; runway-relief incremental cost not isolated. Three chart payloads passed static validation; render not inspected.

Correction / next action: Narrow the R1 compiler contribution, then preserve appearance while simplifying that path; optimize exact spatial queries and review relief refinement and vegetation completion.

### Host crash during legacy-cache comparison — Interrupted; exclude from timing comparisons

User reported a box crash. Completed trimmed-actors-1 (193.037 s) and trimmed-cache-1 (162.003 s), including both round trips, survive on disk. The legacy comparison has no completed summary. No owned test processes remained; the old wingsmith-audit lock was stale. Cause of the box crash is not established.

Correction / next action: Release the stale owned lock and rerun the missing comparison. Record the reboot/crash boundary when interpreting earlier/later timings.

### Thermal-aborted extra scenery diagnostics — Excluded; GPU tests stopped

Default-concurrency scenery cut aborted at81 C. Pace2 scenery cut reached garage163.180 s but aborted during first world visit at84 C before complete validation. LibreHardwareMonitor afterward showed Core Max and CPU Package historical Max84 C, current47/45 C. No owned benchmark processes remained; GPU lock released. Neither thermal-aborted run is accepted as an optimization comparison.

Correction / next action: Preserve logs; lower future automatic stop to75 C to allow polling margin under the user85 C ceiling. Do not retry GPU work in this batch. Future paired tests require a stable thermal budget; no individual feature savings inferred from incomplete bundle tests.

### User raised CPU ceiling to90 C — Matched comparison resumed under85 C guard

User explicitly revised the CPU ceiling from85 to90 C and asked to finish the comparisons then proceed to pavement. Automatic stop is85 C, fail-closed on missing LHM readings. Earlier thermal aborts remain excluded.

Correction / next action: Complete same-build pace2 baseline/scenery-cut pair; then run compiler-only hard/soft pavement specialization diagnosis.

### Completed90 C comparison and pavement next-priority tests — Completed; no benchmark processes left running

Same-build normal-pace baseline164.5915 s vs scenery-cut121.2474 s (43.3441 s /26.3% in one pair), both two round trips, peak80 C. Compiler hard/soft split failed to lower total cost consistently (28.676/30.268 vs30.978/28.783 s), not integrated. New opt-in pavmicro=0 reduces isolated compiler time to11.752/11.142 s, complete full-scenery trimmed load152.4472 s. Combined scenery+pavmicro test95.7395 s, both round trips~8.38 s departures,~0.32–0.39 s returns, peak79 C. Micro option and broader scenery cuts remain diagnostic, not default visual removals. All captured GL checks zero.

Correction / next action: Keep validated fixes and cliff/bake-free benchmark. Prioritize visual review of the micro-cue option and a preserved-look precomputed-field replacement; isolate scenery-group costs before selecting permanent cuts. Do not retry two-job pacing: its full baseline hit a watchdog despite peak75 C.

### Exact runway noise coefficients, cues retained — Correctness passed; performance rejected, option disabled by default

Opt-in pavnoise=1 stores exact RGBA32F noise-corner coefficients for six relief octaves and two lump fields; keeps all weather, curvature colour/normal, rut/hollow and puddle calculations. CPU:20,000 hash and80,000 exact-noise samples. Real Chrome build7a00973d674b:182.4555 s to garage, departures9.5333/9.3509 s, returns0.3811/0.3234 s, zero captured GL errors. Full scenery retained except the common authorized perftrim cliffs/fleet exclusions.12 fields,329495 texels,8 MiB GPU texture plus8 MiB CPU backing,8.3 ms generation. Controlled actual rough-runway row on synthetic patch: original vs cached byte-identical dry/wet; disabling cues changes the image. GPU full-width patch6 samples per variant slightly slower with cache. This is not a world-view acceptance or game FPS result; no startup gain claimed. CPU peak84 C under85 C guard.

Correction / next action: Do not enable as an optimization. Preserve prototype, exact data, source census and parity harness for future sessions. Pavement was observed ready160.223 s versus146.088 s in earlier reference; these are parallel completion observations, not exclusive compiler timings. Investigate cheaper reusable height/curvature fields only with explicit approximation/error bounds and preserved cues; do not silently turn cues off.

### Bounded road-query optimization — Validated and retained; modest whole-startup observation

Five pavement/vegetation callers pass finite influence radii into the existing roadDistNear index. Exact unbounded nearest-distance path remains for other consumers; compose({boundedRoads:false}) is the CPU control (third options argument).100940 actual composed-fixture comparisons over97 roads match exactly. No road geometry, vegetation rules or density changes. Completed build780109adbe73 full-scenery/cues run:161.3884 s garage, two departures9.4684/8.8132 s and returns0.3646/0.3217 s, normal readiness, zero captured GL errors. Garage maximum rAF gap18 ms during20 s sample, no100 ms gaps. Main pavement GLSL source IDs match reference exactly. World generation35.033→31.933 s, nearby settle18.042→16.513 s, but shader gates still dominate; whole observed saving3.2031 s/1.9% is one unpaired-in-time comparison, not guaranteed. Two earlier thermal stops at85/86 C excluded; final87 C guard completed with peak84 C. Original town,64 animals,141 road traffic agents,17 runways, pocket mist and original micro shader present; no extra scenery cuts.

Correction / next action: Retain exact road query bounds; avoid attributing shader compile savings to it. Next preserved-cue experiment should precompute higher-level shape data (hole/hazard/track descriptors, or bounded-error height/curvature fields), rather than repeat noise-corner caching. Check compiler cost in isolation before spending another full browser load. Weather and runway-edit invalidation and GPU cost must be included. Keep scenery tradeoff selection explicit;95.740 s is a combined visual-cut diagnostic.

### Individual-feature attribution protocol and safety revision — Completed screening; six startup comparisons and separate mist compiler attribution

Fresh pace8 all-on control160.4259 s; animals-only off180.012 s, both normal ready and two trips. Eight fewer linked programs when animals absent, no loading improvement established. The first reference attempt ended on LHM sensor timeout at81 C; a sub-alpine attempt stopped at89 C under87 C guard. Both incomplete attempts excluded. To avoid approaching user90 C ceiling, restart all individual comparisons with shader concurrency4 and85 C stop;500ms monitoring. Completed pace8 predecessors retained but excluded from the matched pace4 screening table. Game/visual settings and source build remain unchanged. Range evidence stays initial243.853 s, accepted-quality161.388 s with fresh160.426 s repeat, rejected broad-cut minimum95.740 s.

Correction / next action: Read the new quality-range and individual-cost sections at the top of PERFORMANCE-REPORT.md. Do not repeat the graphics-invalid pace4 control or count aborted runs. Preserve systems; first optimize damage/scuff material preparation, investigate shared mist math/variants, and keep the major common geometry/pavement critical path in scope. Active event runtime profiles remain separate next work.

### Individual-feature results, quality range and next optimization priorities — Measured; no further visual cuts accepted

Quality decision: preserve all seven user-prioritized systems, town and runway micro-relief cues. Only advanced cliffs (prior simple texture restored) and runtime player-derived aircraft bakes are accepted cuts; static Cub/C172/Jodel props remain. Current same-build accepted-quality controls:158.201,159.048,160.426 s (about2:39, median159.048), versus initial published-build full-hangar browser reference243.853 s. Across-build measured range, not causal attribution. Lowest rejected visual-cut diagnostic95.740 s also removed town, extra forest/sub-alpine ecosystem, pocket mist, animals, generated cars/traffic, dust/spray, new damage/scuff/crack appearance AND runway shader cues. It is not an approved preset. Runway cues are restored with their original shader cost; exact coefficient-cache replacement failed performance and remains disabled. Individual startup screening: animals-off180.012 (no benefit), sub-alpine-off156.684 (~3.2 s signal), edge-off158.287 (within control spread), dust/spray-off155.859 (~2.7 s signal), damage-appearance-off148.984 (~9.9 s strongest signal), traffic-off159.743 (within spread). Three controls span2.225 s; single off runs and parallel compilation prevent fixed/additive cost claims. Whole-startup mist-off remained unresolved under safety stops; real-GPU compiler-only opposite-order pairs isolate mean mist overhead1.587 s coarse ground,2.071 s fine ground,3.289 s pavement. Do not add these to predict startup savings. Both orders/all12 links passed; compiler peak73 C. Full-case controls/animal/sub-alpine/edge/damage passed two unchanged-design trips; dust,traffic,closing control are explicitly startup-only with normal ready/GL checks/20s garage soak. No active crash/alpine/wet-plume runtime acceptance claimed. Failed thermal/sensor/GL1281 attempts retained and excluded. Highest sampled aborted CPU89 C, user ceiling90 C; study guard87 C,1Hz/3s fail-closed monitoring. All owned browsers/servers and GPU locks closed after tests. Under20-second garage remains unmet. No new feature removal, publication or commits.

Correction / next action: Among the seven systems, begin with the18 fewer startup submissions and~9.9 s signal in damage/scuff/crack appearance; separate the three paths and inspect duplicate material/source keys before changing rendering. Mist already bakes its static map (~0.442 s), so lead with shared shader work (including algebraic contour projection), not a rewrite of that bake. Animal modules sampled17 ms over6.235 s in the stationary control: insufficient evidence to prioritize animation work for loading, and not a total animal/GPU/runtime cost. Preserve all animal count/LOD quality. Sub-alpine and dust signals are only a few seconds; forest edge and traffic have no resolved loading benefit. Main world geometry remains~32 s, and shared shader gates dominate; these seven alone will not deliver20 s. Continue higher-level runway shape/curvature precomputation only with image/physics/GPU validation; the exact noise-corner cache was unsuccessful. Profile representative active herd/alpine/mud/spray/mist/crash/traffic scenarios before runtime optimization claims.

### Focused mist and damage isolation completed; runway field compiler screen — Five valid startup runs and seven valid compiler links; no new game optimization enabled

Latest matched screening, build780109adbe73, full-hangar saved Cub, Chrome5120x1271: all-on controls161.654/160.100 s (mean160.877); damage/scuff off148.000 s (12.877 s shorter); pocket mist off125.702 s (35.175 s shorter); both off116.105 s (44.772 s shorter). Five valid startup-only runs, normal ready, GL zero and20s garage soaks; largest garage frame gaps14.3–35.1 ms, no100ms gaps. Animals, sub-alpine, forest edge, dust/spray, traffic, town and runway cues retained. Cracks and crash physics retained. Common accepted cuts: advanced cliffs and runtime player-derived aircraft bakes only. Exclusion runs are diagnostic, not approved presets. One off-run each and two controls, no driver-cache-erasure claim; do not add individual effects. This supersedes the prior unresolved mist startup status. Initial published reference243.853 s and rejected broad-cut minimum95.740 s remain separate across-build range markers. The latest accepted-quality mean is82.976 s shorter than the initial reference, an aggregate observation rather than attribution. Runway exact noise cache failed (182.456 vs164.592 s); default off. Higher-level shape-read compiler diagnostic33.017 to15.569 s excludes bake cost and establishes no whole-load saving. All seven compiler variants linked/GL zero, peak77 C; focused startup study peak86 C, below user90 C ceiling. Under20s garage remains unmet; no new visual exclusions enabled or publication.

Correction / next action: Use the measured seconds ledger at the top of the single report. Highest current preserved-quality leads: shared pocket-mist shader work (35.175 s exclusion signal across the full startup, not an exclusive cost), damage/scuff preparation/material keys (12.877 s signal with cracks retained), and higher-level runway shape caching. Retain original runway cues while prototyping; do not repeat the slower low-level noise cache. Validate actual cached rendering dry/wet and account for bake/invalidation/GPU/memory costs before a whole-startup claim. No additional visual sacrifices without explicit scoped approval. A new all-on control must accompany any combined implementation; independent measured deltas cannot be added.

### Runway field integration, mist loop failure and scuff sampler investigation — Prototype and compatibility probes completed; new whole-load reference remains incomplete

Trusted latest retained-quality reference remains build780109adbe73,161.654/160.100 s (mean160.877). Seven prioritized systems, town, full original high-detail runway mesh and cues are ON; ONLY advanced cliffs and runtime player-derived aircraft bakes are excluded. This is not literally every feature/ULTRA preset, and saved weather has zero mist strength although its shader preparation is paid. Earlier208.592/218.046 s controls already used parked static props, but retained advanced cliffs and the flown-aircraft bake. First full cliff/bake-free run193.037 s; later162.003/164.872 s cache comparisons do not causally explain the full drop. Restart/compiler history changed. New build0ab57604f54a: integrated higher-level runway shape fields157.672 s, two unchanged-design trips, no GL errors; bake0.744 s,12 fields,128 MiB GPU plus128 MiB CPU backing. Controlled actual rough-row dry/wet errors at most2/255 RGB, GPU median8.971 to6.752 ms on a5120x1271 synthetic patch. Normal original runway shader remains default; no fixed loading win established because three new references were interrupted (88C,86C under lowered85C guard, LHM timeout at last80C). Separate scuff-only exclusion152.665 s completed; damage-look-only run stopped at90C and is excluded. Do not subtract either from a mismatched control as an exclusive cost. Pocket-mist compact-loop rewrite passed sample equivalence and all8 links but failed repeatable pavement gain; default OFF. Nine damaged-aircraft source pairs now pass compatibility with shared grunge sampler and computed mud restored (18 links, max16 sampler elements, peak75C); this is a source probe, not integrated or wet-crash acceptance. Current scuff GD_OFF workaround suppresses separate computed deposits after wake; credible damage and mud should be preserved in rationalization. No new graphics cuts, commits or publication. Inline archive has individually labelled loading observations, not a causal waterfall.

Correction / next action: Finish normal-load comparison only after the temperature feed is stable; do not keep retrying the same interrupted reference. Keep runway field cache opt-in until net startup/memory/full-world acceptance is worthwhile; it preserves height/curvature cues with an approximation, leaving holes/ruts live. Pocket mist remains strongest exclusion lead35.175 s in earlier matched runs; test periodic noise lookup in the shared atmosphere atlas or a separately reviewed shared mist pass. Elongation/layer math is already compiled out in the chosen preset. Scuff: first share the existing grunge sampler to preserve computed mud, then verify per-finish specialization and cheaper fine detail. Standard quality should keep dents, directional grime/paint damage and mud; any ULTRA-only loss needs explicit scoped approval. Report all measurements and failures in PERFORMANCE-REPORT.md and its seconds ledger; do not add independent deltas.

### Mist/scuff optimization, clean validation and probe corrections — Approved mist B default integrated and browser-verified; scuff specialization left OFF

User explicitly approved mist B after seeing two daylight A/B views: softer cloud-pass haze preferred over original bright surface pockets. Build73f492674f4c makes cloud-pass mist the ordinary default when clouds are enabled; cloudless presets retain the original veil. Live mist off/on updates all techniques, and crossing cloudless/cloud-pass settings reloads into the correct compiled method. Focused tests cover saved/explicit settings, preset/profile/welcome/software selection and live switches. Scuff specialization/shared-grunge prototype and experimental runway/ground/mist caches remain OFF by default. All seven prioritized scenery systems, town and original high-poly runway geometry/cues remain in benchmark; ONLY advanced cliffs and runtime player-derived aircraft bakes excluded via perftrim=1. Latest valid observations: Original veil mist / original scuff 181.188s (buildca358c1224b4, peak78C); Original veil mist / specialized scuff + live mud 167.714s (buildca358c1224b4, peak83C); Cloud-pass pocket mist / specialized scuff + live mud 138.327s (buildca358c1224b4, peak86C); Cloud-pass mist / full-detail specialized scuff + live mud 133.775s (build83ba2179d8e5, peak86C); Cloud-pass mist / full-detail specialized scuff + live mud 134.003s (build83ba2179d8e5, peak89C); Original surface-veil mist and scuff 161.865s (build83ba2179d8e5, peak86C); Original mist / full-detail optimized scuff + live mud 199.560s (build83ba2179d8e5, peak90C); Approved mist B / original scuff, actual default 131.625s (build73f492674f4c, peak87C). Latest same-build83ba2179d8e5: original methods161.865s, combined mist B/scuff134.003s, scuff-only199.560s. The earlier scuff181.188→167.714 screening pair did not establish a repeatable gain. New cold damaged shader instances increased6→18 (all links563→574); default scuff remains unchanged. Controlled actual fabric/steel/ply parts with damage-on/off activity checks now show pixel-identical general-vs-specialized results, with mud active; computed mud restoration changes pixels versus old GD_OFF. These are synthetic material probes, not a physical crash or full-fleet visual acceptance. Empty images from a local/world camera mismatch and nonempty-but-damage-inactive comparisons caused by live-frame uniform resets are rejected; corrected tests explicitly reapply damage/grid uniforms before synchronous draws. Mist hash atlas/compact-loop caches failed consistent compile gains; parked OFF. GL1281 remains intermittent/unidentified: failures and instrumented timings excluded; subsequent ordinary runs passed. Loader quiet-frame handoff watchdog recognizes landing progress without extending any threshold. Current thermal policy matches updated user steering: brief95C peaks allowed, no sustained90C; first94C stop or3s90C+,1Hz/fail-closed monitoring. Earlier conservative thermal stops remain excluded, never retroactively accepted. GFX gate has one pre-existing device-probe whitelist failure in unchanged perf_bench.js (also in HEAD); other assertions pass and focused new mist tests pass. No publication or commit of generated main files. Under20s garage remains unmet. Approved actual-default run:131.625s garage, no fmist/scuffopt override, GL zero and normal readiness, garage20s soak median9.8/p99 12.8/max27.2ms with no100ms gaps or long tasks. Unchanged-design departures9.456/9.364s, returns0.636/0.317s, peak87C. This is30.241s/18.7% shorter than the latest161.865s original-method reference from the preceding build; not a repeated same-build causal estimate. World stand samples still about43ms/~23fps; first had one147.6ms hitch, second max47.5ms. No claim of smooth crashes, edited-aircraft readiness or full scripted-circuit acceptance.

Correction / next action: Keep approved mist B default and original scuff. Next scuff lead is shared-sampler-only without tripling material classes; full specialization had no reliable loading win. Next larger measurement is the scripted circuit/GPU-versus-main-thread world cost: ~23fps and a first-stand147.6ms hitch remain, despite responsive garage and fast unchanged-design trips. Preserve credible damage and mud; no additional cuts without scope/benefit approval. Keep all seconds, failures, screenshots and thermal evidence in PERFORMANCE-REPORT.md.

### Simplified scuff integrated loading and active GPU validation 2026-11-21 — All five load cases valid; active patch GPU improvement; startup benefit modest/unresolved; opt-in only

Build290bbbf690ea with approved mist B and accepted cliff/runtime-bake cuts only: original-scuff opening141.954s, two-state lite140.720s, shared-state126.007s, closing original128.126s, shared-state repeat124.677s. Controls drift13.828s: do not claim16s causal saving. All cases normal ready/GL0/20s garage soak, peak87C maximum. Four real Cub material classes:224 GPU patch queries valid, active simplified damage37–52% cheaper than original, computed mud active, damage-on/off nonzero, intact images pixel-identical. Shared-state inactive code adds~1–30% relative patch cost (~0.001–0.017ms/draw); no native full-flight result for scuff candidate. Window crack body unchanged; glass stays asleep/awake. Fine procedural scratch/gouge/fray detail visibly simplified; no appearance approval yet.

Correction / next action: Keep candidate flags off by default. Two-state lite is the lower-risk active-damage rendering candidate; shared-state stays experimental. Next substantial loading target: duplicated lighting-state program preparation (native B night→noon164 additional links,38.440s rollout gate), then~32s terrain/roads/aerodromes and~15s nearby scenery fill. Updated comparison and current waterfall distinguish native versus diagnostic clocks. Visual QA initially missed isolated iframe contexts and a missing per-frame error array; corrected tool passes desktop/narrow initial/changed states. Windows chart validation needed UTF8 and a temporary executable alias; no game change. No raw/private save or generated main output committed.

## Matched integration comparison and post-ready behaviour

Visible Chrome, fresh isolated profiles, fixed game-only saved state (Piper Cub), full hangar, viewport 5120x1271/DPR1. Ready times are poll-detected (~1 s resolution), not a verified native F11 screen. Driver cache not independently cleared. Controlled run order and all unsuccessful attempts are recorded in the living report. Post-ready rAF measures scheduling gaps; it is not input acknowledgement or GPU frame time. Cold census excludes subsequent image/GPU acceptance commands.

| Run | Garage ready (s) | World compile row (s) | Garage compile row (s) | Worst garage rAF gap (ms) |
| --- | ---: | ---: | ---: | ---: |
| integrated-control-1 | 208.592 | 94.829 | 5.499 | 1707.1 |
| integrated-control-2 | 218.046 | 96.844 | 10.872 | 15.1 |
| integrated-candidate-7 | 205.694 | 65.774 | 29.382 | 63.6 |
| integrated-candidate-8-repeat | 206.659 | 64.766 | 31.931 | 64.3 |

These phase wall times are waits/elapsed work boundaries, not exclusive compiler costs. Compilation overlaps and may finish while a different phase is active. Do not add per-program completion delays or interpret a reduced worldCompile row as an equal startup saving.

| Run | Combined ground program instances | Builder instances | Reader instances |
| --- | ---: | ---: | ---: |
| integrated-control-1 | 2 | 0 | 0 |
| integrated-control-2 | 2 | 0 | 0 |
| integrated-candidate-7 | 0 | 2 | 2 |
| integrated-candidate-8-repeat | 0 | 2 | 2 |

The combined-ground count above means the standard-lit coarse/fine material programs identified by their full material main and PhysicalMaterial block. It does not claim that pavement or every Lambert/outer-ground shader was replaced. The cold census for retained runs is captured before numerical image/GPU diagnostic work. Subsequent reference programs are excluded.

| Run | Second world visit rAF median (ms) | p99 (ms) | First world visit worst gap (ms) |
| --- | ---: | ---: | ---: |
| integrated-control-1 | 47.6 | 50.1 | 1640.0 |
| integrated-control-2 | 46.7 | 52.9 | 1289.4 |
| integrated-candidate-7 | 52.1 | 70.2 | 1356.9 |
| integrated-candidate-8-repeat | 52.5 | 72.1 | 1347.4 |

These are short ~5-second scheduling samples, not a completed circuit or isolated GPU measurement. They suggest a runtime cost that the terrain-only GPU microbenchmark misses. Extra traversal and ground shading before non-ground occlusion are plausible contributors, not separately measured attributions. Detailed results, frame gaps, operations, source submissions and image dimensions: [comparison data](evidence/PERFORMANCE-2026-11-19/material-cache/integrated-comparison.json).

## Packed-path rendered and GPU acceptance

Controlled live fine-terrain test; reference reconstructs the complete original material prefix and original lighting tail from the current shaders. It is compiled only after the cold loading/round-trip measurements. Same test lighting is applied to reference/candidate; world shadow maps are retained.

- overhead: 65536 covered pixels; mean absolute RGB byte error 0.007065, p99 0, max 1; pass=true; GL errors=0.
- oblique: 24272 covered pixels; mean absolute RGB byte error 0.009517, p99 0, max 1; pass=true; GL errors=0.

Deliberately inverted normals: mean RGB error 23.968, detected=true. Full data and PNGs are in evidence/PERFORMANCE-2026-11-19/material-cache/integrated-candidate-7/.

5120×1271 GPU-query stress test, twelve alternating samples per path: original median 19.031 ms; packed split 18.984 ms. Extra material storage 99.30 MiB, excluding depth/final target. One fine-terrain tile stretched over full viewport, material rebuilt every split draw; not game FPS or startup. No GPU time or game-FPS improvement is established by this near-equal result.

Whole-game garage/world screenshots were inspected at reduced preview size. This checks gross appearance in the saved night scene, not full pixel equivalence under every AA mode, recipe, shore, weather or cockpit/crash view.

## Measurement rules and remaining acceptance

Require normal ready evidence, idle loading chain and no fail/error records: a watchdog removing the cover is not success. Compare like-for-like scenes, saved content, viewport, settings and draw-error instrumentation. Measure from actual button input to advancing simulation; the rollout panel alone misses pre-panel stalls. Fresh profiles do not by themselves prove an empty driver shader cache. Keep compiler-only tests separate from whole-game loading and GPU render timings.

Completed in this batch: live integration, repeated normal-ready packed startup, same-build control, two unchanged-design round trips per passing run, cold shader-source census, pixel/normal negative-control checks, whole-scene screenshots, GPU stress samples and post-ready frame-gap measurements. The under-20-second garage and no-freeze objectives are NOT achieved. The roughly 8-second world departures in this fixture already occurred in the controls, so they are not an optimization saving. These full-hangar Piper Cub runs must not be presented as a direct before/after of the user's studio/Mosquito manual test.

Remaining acceptance: edited-aircraft iteration, full scripted circuit, cockpit/crash cases, other terrain recipes/tiers/shore/weather/AA boundaries, long-run material/resource ownership and explicit UI input acknowledgement. Current scheduling samples already warn of slower world cadence with the extra pass. Keep the flag off by default pending that work.

Next optimization priorities: direct active-recipe/pavement shader specialization with correct invalidation, and caching deterministic world geometry/masks. Existing CPU evidence measures ~31.6 seconds of generator execution (patch ~7.25 s, aerodromes ~6.86 s, roads bucket ~5.10 s), which gives targets, not guaranteed recoverable wall time. Avoid more camera-dependent passes without proving net runtime value. The approved garage/world separation remains relevant to the 20-second objective, but must not be sold as reducing total preparation work.

The scripted baseline already present is tools/flight_scripts/perf/main_journey.json, with tools/flight_script.js --runner page; home_circuit.json is the shorter circuit smoke case. Use tools/RIG-PROCEDURE.md and the shared page rig; do not invent a physics-only substitute for browser timing.

## Complete historical findings, data and unsuccessful attempts

The following sections embed all fourteen focused audit reports in full so this document is self-contained. They are chronological/source records, not fourteen separate documents the reader must consult. Their earlier status/next-step language is superseded by the current summary and live integration results above. Raw evidence links remain available for reproducibility.


## Record: Initial audit and supplied-log analysis

Source record: PERFORMANCE-AUDIT-2026-11-18.md.

### Wingsmith performance audit — 18 November 2026

For subsequent sessions: read [the experiment ledger](PERFORMANCE-ATTEMPTS-2026-11.md) before repeating a performance experiment. It records unsuccessful attempts and invalid measurements as well as retained changes.

Status: post-driver baseline and first bounded optimization experiments complete. Two small geometry-builder improvements are retained; an unproven shader-sharing candidate was reverted. No visual feature or quality setting was removed or reduced. The 20/30-second targets have **not** been achieved.

#### User's implementation priorities (confirmed after the audit)

The garage must be directly operational in **under 20 seconds**, with no freezes or lag. Departure to the world must take **at most 30 seconds**. Preserve fast repeated garage/world round trips, including after aircraft edits. First eliminate expensive and repeated work and rationalize shaders. Separating garage preparation from world preparation is approved; live/background loading is a later phase, not the first optimization strategy. Preserve all visuals unless a specific proposed change receives explicit approval.

The RTX 3080 driver update is complete; the post-update reference driver is **621.24**. The baseline uses the actual branch build, including the previously missing reed asset.

##### Post-update results and first implementation checkpoint

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

#### Decision

Treat this as a responsiveness and shader-lifecycle problem first, followed by a separate sustained rendering problem. The minute-long freezes are real driver-facing waits, not merely low FPS or an overly demanding screen resolution. Shader rationalization is justified. Another layer of broad prewarming, by itself, is unlikely to solve it.

Start with truthful readiness/reporting, exact shader-variant coverage at transitions, and avoiding repeated aircraft work. Then separate the usable garage from preparation for flight. Investigate large rendering costs afterward, preserving visuals throughout. Any proposed visual compromise needs its own scope, evidence, benefit estimate, and explicit user approval.

#### Evidence and revision

- User-supplied logs: `flydiy-flightlog-20261118T025214-btvn.json`, `flydiy-flightlog-20261118T050718-dwo4.json`, and `flydiy-flightlog-20261118T195107-3x3o (1).json`. Only these three were analyzed; the similarly named evening file without `(1)` was not substituted.
- Evening build: `48a71176c5a6`, dated 18 November 13:04 UTC; matches fetched `origin/master`, commit `9349a62c1cbee17ae77741d5e62b2ab1657ef376`.
- Work branch: `codex/wingsmith-performance-audit`, in a separate managed checkout. Rebuilding its generated outputs reproduces build `48a71176c5a6`.
- The original working directory contains substantial staged/unstaged work and older generated/source files. Those were not changed. Early inspection found that mismatch; source conclusions below were rechecked against the matching November master.
- Hardware in the logs: RTX 3080, ANGLE over Direct3D 11, Chrome 157, 24 logical cores. Evening window 5120×1271, DPR 1; canvas dimensions change with the garage sidebar. The `sky` events confirm 8 actual MSAA samples and a 5120×1271 flight target.
- Raw analysis output: `playtest-summary.json`, produced by `analyze_playtests.py`. Timings below are recorded observations, not estimates of achievable savings.

#### What the playtests show

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

##### Recorded startup costs in the evening session

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

#### Why the automated results look better

The early logs are different builds (`71b8092b3b52` and `232a4d38c2d8`), not repeat runs of the evening build. The 05:07 benchmark records a 640×900 canvas, versus up to 5120×1271 in the real playtest: about 11.3 times fewer pixels. It has only about 6.5 seconds of non-loading world frame intervals, no cockpit samples, and no crash test. This cannot validate extended flight or the populated garage.

It is nevertheless already red: warm garage 148.6 s, slider response medians around 402–413 ms, and a studio-menu stall around 5.65 s. Its summary still says `end.ok: true`, `passed: 0`, `of: 0`.

Specific source findings in current master:

1. **Success is only scenario-step success.** `src/viewer/perf_bench.js:241` uses `tr.steps.every(s => s.ok)`; loading, sliders, menu, and crash performance do not determine the overall result. An empty scenario passes vacuously. Report functional completion and performance acceptance separately; overall performance must include all required checks and reject absent samples.
2. **Shader cost is filed under world work.** `PHASE_OF` near line 86 recognizes `compile` and `frames`, then categorizes `worldCompile` as world. In the 05:07 warm run, its reported 88.144 s of world work includes a 60.266 s `worldCompile`. Shader cost is substantially understated by those categories. Use explicit phase metadata, and split compilation from first-use draws.
3. **Loading frame statistics are drained and reused.** `loadCycle` repeatedly calls `takeFrames()` during world settling; `tr.boot.loading` is collected much later, after the load cycle and garage return. Its optimistic short frame maximum does not describe the entire initial load. Record each operation in its own time window without draining a shared stream.
4. **Gone is not ready.** `bootGone` looks only at `BOOT.state`, ignores its own timeout result at callers, and does not require the startup chain to finish. The supplied evening boot proves this distinction matters. Require the operation's completion state, loaded revision, a painted frame, and actual interaction acknowledgement; separately report time-to-first-visible, time-to-interactive, and longest subsequent stall.
5. **The 125 s garage-return figures in the early benchmark are invalid evidence.** Those logs waited for a body class that was not set; current master explicitly fixes that check to `mode-ws`. Do not count that old timeout as measured rendering cost or repeat it as an unfixed defect.
6. **rAF sampling can measure the sampler rather than gameplay.** The page runner adds an unrestricted rAF sampler while game rendering is capped. Use recorder-rendered frames and presentation/interaction evidence together; report sampler and game cadence separately. Successful autopilot steps are not performance passes.

#### Highest-priority technical findings

##### A. The shader guard has two relevant holes

`src/viewer/app.js:22130` enables the guard only outside the garage and only for the world scene. `shader_warm.js:165` admits an already-known material whenever its per-material programs map exists. Its own comment explicitly excludes changed keys. Its 20 s timeout can eventually release an unfinished program to a blocking draw.

The worst evening watchdog events name `aeroskin:scuff`, `:live:eye`, `:band`, `flown:baked:scuff:band`, and `:cut`. Multiple flags, lighting configurations, material hooks, and object kinds change. Existing prewarming is not covering the combinations actually drawn.

**Recommendation:** prepare the exact variant for a requested transition, then atomically commit the camera/build/lighting/damage presentation when it is ready. Include garage, cockpit, shadows and render-target differences. Preserve the previous complete image and provide feedback while necessary work proceeds. Do not merely widen a timeout, turn off diagnostics, or permanently skip unready objects. A general guard must recognize the renderer's exact variant, not approximate readiness by material identity.

For crashes, first verify `scuffPrelink` against the actual damaged scene: it already prelinks sleeping/awake materials, so adding another generic damage warm-up duplicates an existing mechanism. Its warm context and lifetime must match the real lights, target, geometry, skinning, hybrid band, and cut-face paths. The logs show a failure of that guarantee; they do not identify one sole faulty line.

##### B. Compile and first use are different bills

The code already uses `compileAsync`, paced compilation, sliced source generation, readiness polls, warm draws, and multiple catch-up passes. It is not missing the basic async API. Ready-at-link time does not establish cheap first use on this ANGLE path. The first-light stage alone takes 186.9 s in the evening log.

**Recommendation:** inventory each program with family, stable parameter signature, GLSL source hashes/lengths, creation owner, material/object/context, queued time, completion time, first-draw duration, and reuse/disposal. Join waits to program IDs. Keep compiler queues bounded; do not increase parallelism without measurement. Consolidate redundant prewarm passes only after proving equivalent variant coverage.

The current watchdog's comma-split cache-key differences and shared `(unnamed)` bucket are useful clues, not a canonical variant census. Function-source/custom keys can contain commas, and unrelated materials share names. Do not assign an individual 34 s wait to a particular feature from that text alone.

##### C. Aircraft shader families need rationalization

The aircraft is no longer simply one shared skin program: baked/live, cockpit-eye, hybrid-band, asleep/awake scuff, glass, damage cuts, skinning, lighting, and target variants multiply.

Safe first experiments preserve the rendered result:

- Deduplicate semantically identical emitted shader sources and eliminate unnecessary cache-key distinctions. Do not merge keys when generated GLSL differs.
- Preserve material and compiled-program ownership across compatible build/view changes; avoid disposing/recreating reusable variants. Verify uniform ownership so sharing never makes one aircraft use another's values.
- Inspect duplicated hook injection and repeated GLSL sampling chains; factor equivalent calculations and sample results where derivatives and spaces remain correct.
- Keep cosmetic values in uniforms when they do not change required code or resource layout. Do not replace all defines with runtime branches indiscriminately: that can increase pixel cost and sampler pressure.
- Keep damage sleeping/awake designs under measurement. Current source deliberately sleeps damage code for intact aircraft, and already compiles both states. Unifying them may reduce variants but increase every intact frame's cost; approval requires an A/B showing the tradeoff.
- Stabilize lighting signatures where feasible. The eight-light premises pool changes the number of visible lights at dusk; exact lighting-context prewarming must work before considering a fixed-count alternative. A fixed pool may save recompiles but add daytime shader work, so it is an experiment, not a default recommendation to ship.

Ground remains an expensive family, but the evening evidence prevents blaming ground alone. `splat_ground.js` documents prior FXC inlining/unrolling disasters and existing fixes. Do not repeat the failed constant-loop/explicit-gradient experiments or assume they are unexplored quick wins. Start from emitted source and current cold/warm attribution, preserving hex tiling, layers and shading.

##### D. The populated garage pays for more than its visible task

The initial boot intentionally builds and warms the world as well as the garage. This was designed for immediate round trips, but is now imposing minutes of unrelated preparation before editing. Saved-player aircraft add more work than the clean benchmark reproduces.

**Recommendation:** first deduplicate capture/bake requests and preserve valid caches; then define a minimum genuinely interactive garage. Prepare flight dependencies in bounded background work or on explicit departure, with progress, cancellation, and correct readiness. Keep total cold-to-flight time as a second acceptance metric so moving work later cannot masquerade as a speedup. No scenery or visual feature needs to be removed to change when its work happens.

#### Ranked work packages

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

#### Sustained rendering: next, but not a substitute for fixing stalls

For active, non-held frames with recorded CPU work below 250 ms, evening chase averages are approximately: cover 13.34 ms, mirror 6.63 ms, render submission 15.60 ms, scene 3.58 ms; total recorded work 45.26 ms. Cockpit averages: cover 6.81 ms, mirror 6.93 ms, render 17.99 ms, scene 2.79 ms; total 41.82 ms. These are mixed places/aircraft, not controlled camera A/Bs. Excluding huge frame bodies does not necessarily exclude the following long interval, so these subsets must not be described as clean steady-frame interval distributions.

Submitted draws average around 1,500 per active frame, triangles roughly 33–44 million across all recorded passes. These are not unique visible geometry counts. Cover and mirror deserve focused profiling; damage CPU or the solver is not the leading explanation in these samples. GPU timer coverage is complicated by subsystem/foreign queries, so do not add these GPU numbers to CPU timings or treat them as exact whole-frame attribution.

Memory peaks deserve a repeated build/swap/garage-return retention test. The logs alone cannot distinguish cache growth, live duplicate representations, allocator behavior and leaks. Preserve valid caches; measure ownership before aggressive disposal, which could trigger still more shader compilation.

Expensive visual options to discuss separately, never silently change: 8× MSAA at ultrawide resolution; reflected scene content; close cockpit live-detail paths; terrain/vegetation detail; multi-layer ground materials. Each needs isolated timing, visual comparisons, affected views, and expected benefit before approval. The current audit approves none of those reductions.

#### Browser baseline and test procedure

Use the existing tools, not a new physics-only benchmark:

- `tools/RIG-PROCEDURE.md`: established browser procedure.
- `tools/page_rig.js`: real-GPU Chrome harness, readiness, diagnostics and captures.
- `tools/flight_script.js --runner page`: runs the real game with segment marks.
- `tools/flight_scripts/home_circuit.json`: complete Cessna circuit smoke test.
- `tools/flight_scripts/perf/main_journey.json`: relevant wider baseline, including taxi, orbit, cockpit, weather/time, destination, landing and garage return.
- `perf/crash_cub.json`, `perf/crash_pc6.json`, and the five-aircraft cases: targeted follow-ups.
- `tools/perf_trace.js` and `tools/analyze_log.js`: read recorded evidence; keep the separate garage scoring described above.

The main journey's CLI input is the actual JSON path, e.g. `tools/flight_scripts/perf/main_journey.json`; the scenario's internal name is not necessarily a library filename. The referenced `flydiy-notes/PERF-WEEK-METHOD-2026-11-14.md` is not present in this checkout, so this audit relies on the procedure and scenarios actually available.

##### Pre-update diagnostic (not the acceptance baseline)

Captured 18 November on the RTX 3080 using the existing real-GPU headless Chrome harness, a fresh profile, a seeded Cessna `list:50`, a 5120×1271 emulated viewport and default game settings. No competing gate workload was launched. Build `48a71176c5a6`; the matching Git source was rebuilt separately on the audit branch. The served immutable copy has the same generated build, with shared assets supplied by the original directory as fallback.

- Harness garage time: **204 s**; boot's own `gone`: **202.583 s** from navigation.
- World creation **43.177 s**, world compile **94.498 s**, garage compile **6.775 s**, first frame **4.694 s**, first-light frames **4.609 s**.
- Program count at garage completion: **556**.
- First startup step recorded a **1.566 s** maximum sampler interval despite functional success.
- One missing local asset was reported: `media/geo/trees/reed_marsh.a36d1207.gz.bin` (404). Therefore this is explicitly a diagnostic, not a completely asset-clean acceptance run.
- Run was intentionally interrupted after preserving its partial recorder log, before the user's graphics-driver update. The circuit was not completed. Files: `browser/live-state.json`, `browser/live-flightlog.json`, `browser/home_circuit_page_2026-11-18T21-32-32.jsonl`.

This test independently reproduces multi-minute loading even without the populated garage. Its shorter time does not rebut the manual log: different aircraft/storage/cache state and headless execution matter.

##### Post-update baseline to run next

1. Record driver version, build hash, browser version, viewport, actual per-mode canvas, DPR, preset, actual AA samples, aircraft and stored builds. Verify all required assets resolve. Keep the post-update driver constant for subsequent A/Bs.
2. First launch and immediate warm repeat with the same browser profile; label the first launch's real cache state. A fresh profile or cleared site cache alone does not prove the driver shader cache is empty. Do not call a post-update first launch a typical daily run.
3. Run a short garage/aircraft-swap/rollout/return/cockpit/crash diagnostic first. Then the complete main journey when the short case is measurable and stable. Compare a fresh garage with a representative populated garage. Seed representative storage into the isolated test profile; never clear the user's real profile.
4. Repeat decisive A/B cases under comparable conditions; use one cold and at least two warm measurements where practical. Report every run, including failures/timeouts, not only successful completions.
5. Measure visible, genuinely interactive, flight-ready, and post-transition settled times separately. Include actual slider/input acknowledgement, longest main-thread task, rendered-frame p50/p99/max, count and total duration over 100 ms/1 s, and newly created programs after readiness.
6. Proposed acceptance goals to agree before implementation: initial garage approximately 20 s and no loading transition over 30 s; input acknowledgement under 100 ms; no >1 s main-thread block after readiness; sustained rendered-frame p50 ≤33.3 ms and p99 ≤50 ms on the agreed reference configuration. Keep remaining >100 ms spikes visible. These are targets, not achieved claims.

#### Best-practice checks

Avoid synchronous status queries that wait on incomplete programs during interactive rendering; use completion polling and exact readiness. Compile scheduling and first-use work both need accounting. These recommendations agree with [MDN WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices) and the [Three.js renderer documentation](https://threejs.org/docs/pages/WebGLRenderer.html). The project already implements much of the basic API machinery; the priority is making its coverage and ownership correct.

Do not start a blanket texture-compression pass or remove shadows as the first response to this evidence. Those can address memory/bandwidth, but they do not directly explain a frame spending 99 seconds in shader waits. Likewise, a permanent spinner or a longer loading timeout would describe the wait without reducing it.


## Record: Shader observations

Source record: PERFORMANCE-SHADERS-2026-11-19.md.

### Shader and repeated-work checkpoint — 19 November 2026

Branch: codex/wingsmith-performance-audit. Nothing published. All visual features retained. Experimental shader changes remain opt-in, disabled by default.

#### User targets and acceptance

Target: usable garage under 20 seconds; garage-to-world at most 30 seconds; no freezes; fast repeat trips after editing. These targets are NOT met. Measurements below use real Chrome on the RTX 3080 after the driver update, at 5120 × 1271, seeded with the Cessna saved aircraft. Browser automation still needs cockpit, crash, and edited-aircraft acceptance before any overall success claim.

The supplied evening playtest records approximately 6:15 to overlay removal and continued preparation until approximately 9:15. A fresh automated profile is substantially faster and is not an adequate substitute for that populated-user case.

#### Established control

Post-driver fully-ready garage: 193.782 seconds first launch, 146.299 seconds warm reload. Two unchanged-aircraft departures per launch: 16.7–16.9 seconds; returns 0.56–0.74 seconds. Departure timing includes transition and harness polling. Evidence: ../reports/evidence/PERFORMANCE-2026-11-18/post-driver/summary.json.

The instrumented shader census control reached readiness at approximately 192.889 seconds. It submitted 620 program links, representing 517 distinct source pairs after normalizing only the shader-name label. It submitted 620 vertex shader compilations with 323 exact unique vertex sources, and 620 fragment compilations with 470 exact unique fragment sources. Duplicate source does not automatically mean a cache-key mistake: renderer parameters and uniform bindings must also be compatible.

World compilation alone accounted for 87.908 seconds in this control. Coarse ground, fine ground, and pavement emitted approximately 212–216 KB per shader pair. Their first observed completion delays reached approximately 94–100 seconds; these are polling upper bounds, not native compiler durations. Parallel delays must not be added together.

#### Experiment: share coarse and fine ground programs

Opt-in: groundshare=1. One shared program selects the original coarse/fine predicates and morphing through a uniform. No ground feature, texture, precision, or shadow was removed.

Result: 620 → 619 links. Readiness approximately 203.549 seconds, versus control 192.889. World compile decreased to 71.377 seconds, but garage compile increased from 4.611 to 28.523 seconds. This is NOT evidence of an overall loading improvement.

Verification: specialized emitted shader token streams match both legacy ground sides exactly. Real factory hooks emit identical shared sources with side uniforms -1 and +1. Paused same-camera A/B/A captures show no visible difference. Short GPU samples: shared 39.203 ms, legacy 42.135 ms, shared again 39.876 ms (114/108/111 valid samples). This rules out an obvious local regression, not all-scene acceptance. Source equivalence is stronger than the small image comparison for preservation of the two original branches.

Evidence directories: shader-bill, shared-ground-disc, ground-share-compare under evidence/PERFORMANCE-2026-11-19.

#### Experiment: keep reflection capture light counts stable

Opt-in: probepad=1. The garage reflection capture excludes the aircraft cabin lights. That changes the number of lights in the material shaders and creates another large set of programs. Temporary black, zero-intensity, non-shadowing lights retain the visible-scene light count during capture while the real cabin lights remain excluded. Placeholders are removed immediately after capture/preparation; none remains in normal rendering.

Result: 620 → 519 links (101 fewer, 16.3%). Distinct normalized source pairs: 517 → 451. Readiness approximately 203.170 seconds: again NOT an overall speed improvement. This removes considerable repeated preparation but does not remove the expensive world-compile critical path.

Automated helper checks pass for stable counts, zero contribution, excluded lights, hidden children, other-scene exclusion, cleanup, pooling, opt-out, and aircraft-in-probe mode. Full reflection-image and edited-round-trip acceptance is still required before enabling by default.

Evidence: evidence/PERFORMANCE-2026-11-19/probe-light-padding/garage.json.gz and garage.meta.json. Test: tools/_probe_light_padding_check.js.

#### Functional finding

The census's first world departure completed. After returning, changing p_topRound, and departing again, rendering continued around 23 fps but simulation time remained at zero despite running=true and hold=false. This is a failed edited-round-trip check, not a successful benchmark. The failure snapshot is retained in shader-bill/failure.json.gz. Root cause has not been established; do not attribute it to an experiment without reproduction.

#### Recommended next work, in order

1. Target the large ground/pavement shader compiler bill directly. Establish which expanded shader blocks and combinations dominate compiler cost, then simplify mathematically redundant work while preserving appearance. Measure full readiness, not a single phase. The current one-program-sharing experiment did not deliver enough.
2. Finish reflection-padding visual and edited-trip acceptance. It is a promising repeated-work reduction, but should remain opt-in until those checks pass. Do not sell its program-count reduction as seconds saved.
3. Reproduce the edited-aircraft simulation stall independently. A fast transition that cannot resume simulation is not an acceptable design-iteration loop.
4. Rerun a populated-profile baseline matching the supplied playtest, including cockpit and crash. Report overlay removal, full readiness, worst frame stalls, and edited round trips separately. The scripted circuit alone can miss garage preparation.
5. After actual work is reduced, separate garage and world preparation. This helps the garage target, but by itself relocates the world cost to departure; background loading comes later as requested.

A proposed shadow-only-light shortcut was inspected and not attempted: the near-shadow implementation directly indexes Three's native second directional shadow sampler, coordinate varying, and light-shadow array. Removing that light from the native layout would require a deliberate shadow-path refactor and full visual validation, not a safe quick switch.

#### Retained earlier changes

Per-active-cell terrain-neighbour cache: 71,148 exact comparisons pass. Per-aerodrome yields reduce the longest measured world-generator call from approximately 7.2 to 2.5 seconds, preserving geometry; total generator execution remains approximately 31.6 seconds. These are useful CPU improvements, not proof of the startup target.

Generated main files are reconstructed locally for testing and should be excluded from the branch commit, following the user's workflow. No deployment or merge has occurred.


## Record: Individual shader/world preparation inventory

Source record: SHADER-BREAKDOWN-2026-11-19.md.

### Individual shader and preparation breakdown

Uses existing captures only. Control: RTX 3080 after driver update, saved Cessna, 5120 × 1271, startup clock to readiness 191.822 seconds. No new browser run.

#### What the timing means

Each WebGL program combines a vertex shader and fragment shader. The inventory records both source identities. There are 620 linked program instances, not 620 independent visual effects. Light layouts, material features, geometry attributes, render passes, and material cache keys create variants.

The per-program delay is from submission to the first observed completion. Compilation runs in parallel; delayed polling and unrelated main-thread work can inflate this interval. These intervals cannot be added or interpreted as time recoverable by removing a shader. True exclusive per-shader compiler times were not captured. Blocking GL-call time is a separate column and also does not include asynchronous compiler work.

#### Most conspicuous individually identified programs

| Program | Shader | Vertex / fragment source | Observed completion delay, upper bound |
|---|---|---|---:|
| 19 | Coarse island ground | 20,604 / 191,324 characters | 99.886 s |
| 109 | Fine island ground | 20,875 / 191,292 | 98.039 s |
| 22 | Pavement | 20,390 / 195,879 | 94.199 s |
| 399 | aeroskin:scuff:live:eye:band | 22,619 / 217,754 | 9.218 s |
| 421 | aeroskin:scuff:live:eye | 23,016 / 217,587 | 8.722 s |
| 398 | aeroskin:scuff:live:eye | 22,614 / 217,587 | 8.557 s |
| 340 | aeroskin:scuff | 22,584 / 217,557 | 8.495 s |
| 422 | aeroskin:scuff:live:eye:band | 23,021 / 217,754 | 7.717 s |
| 407 | aeroskin:scuff:live:eye:band | 23,021 / 217,754 | 7.633 s |

Source size is emitted text before the graphics compiler eliminates disabled preprocessor branches. It is not executable instruction count. Coarse/fine identification is verified by their characteristic clipping/morph source, rather than inferred from an absent material name.

There are also small, early-submitted unnamed/helper programs with observed delays of roughly 30–38 seconds. They share a later polling boundary after world generation, so those figures are particularly unsuitable as individual compiler-cost estimates.

#### Aircraft skin variants

| Emitted shader name | Program instances |
|---|---:|
| aeroskin:scuff | 16 |
| aeroskin:scuff:live:eye:band | 12 |
| aeroskin:scuff:live:eye | 10 |
| aeroskin:band | 3 |
| Total aeroskin | 41 |

Other named families: flown 24, matlib 15, char 8, animal 6, water 2. There are 501 unnamed program instances; full vertex/fragment identities are retained. A reliable mapping of those to individual scene objects requires further instrumentation, not guessing names from their size.

#### Preparation phases in the same full-startup capture

| Step | Wall time | New program links submitted in phase |
|---|---:|---:|
| World shader compile | 87.908 s | 380 |
| World generation | 35.309 s | 17 |
| Settle streamed world around stand | 17.911 s | 47 |
| Aircraft bake | 4.906 s | 35 |
| Prepare parked aircraft | 4.595 s | 0 |
| Terrain ring | 4.558 s | 25 |
| Garage shader compile | 4.611 s | 42 |
| Aircraft snapshot | 1.505 s | 12 |
| Spec preparation | 0.466 s | 4 |
| Restore | 0.005 s | 0 |
| Town | 2.360 s | 18 |
| Parking | 0.109 s | 0 |
| Image wait | 0.127 s | 2 |
| Upload | 2.528 s | 16 |

This is a selected breakdown, not all startup phases. The previous chart's scene/reflection category (29.388 seconds) is settle + parked + snapshot + bake + spec + restore. It should not be read as 29 seconds of reflection baking. Much of it is waiting for streamed scene content. Shader links are started across many phases, so the phase named worldCompile is not the entire shader bill.

#### World generator detail — separate focused run

Following the earlier CPU fixes, execution inside generator calls totals 31.649 seconds. This excludes time between calls and comes from a separate run: do not subtract it directly from the control's 42.336-second world/town/ring allocation.

| Generator slice group | Execution time |
|---|---:|
| Premises terrain patch (patch ground) | 7.251 s |
| Individual aerodromes, all strips | 6.863 s |
| Roads bucket | 5.102 s |
| Initial world setup through light yield | 2.433 s |
| Premises creation through premises made yield | 2.248 s |
| Paved polygons | 1.206 s |
| Ground colour slices | 0.961 s |
| Terrain block assembly slices | 0.946 s |
| Lots-labelled slice | 0.787 s |

Largest individual aerodromes: w2 2.485 seconds, xw_rough 1.465 seconds. Labels denote yield boundaries, not instrumented inner-function costs. In particular, the lots-labelled slice follows paintMaterials; it cannot be charged to placeLots just because of the label. Roads bucket also includes the boundary after placeLots before the individual road yields. The light boundary contains initial setup, not just light creation.

#### Complete inventory

[All 620 programs](evidence/PERFORMANCE-2026-11-19/shader-bill/individual-programs.csv), with phase, submission time, observed completion, blocking GL calls, source sizes and exact vertex/fragment source identifiers. Regenerate with tools/perf/export_shader_inventory.py.

Next useful measurement: map unnamed programs to materials and scene objects, and distinguish compiler readiness polling from main-thread gaps. The current evidence supports prioritizing terrain/pavement compiler complexity and aircraft variant repetition; it does not support assigning an exclusive savings estimate to each visual feature.


## Record: Compiler experiments

Source record: COMPILER-OPTIMIZATION-2026-11-19.md.

### Compiler optimization follow-up

Branch: codex/wingsmith-performance-audit. All visuals retained. No deployment. Uses the existing page rig and cold_links_bench procedure on the RTX 3080 / ANGLE D3D11, driver 621.24.

#### Material attribution and closely polled completion

The new real-game capture reaches full readiness at startup-clock 193.103 seconds (approximately 194.196 seconds on the navigation clock). It links 620 programs; 603 remain live at capture. Of those, 430 map to materials still present in the world/garage scenes (1,222 distinct scene materials inspected). Unmapped programs include disposed/temporary helper materials and depth variants; their shader sources remain known.

The three longest identified links are confirmed against live materials:

| Program | Live material / objects | Submission-to-completion |
|---|---|---:|
| 19 | island-ring, MeshStandardMaterial | 101.627 s |
| 109 | island-fine, MeshStandardMaterial, 83 object references | 98.812 s |
| 22 | pavement:T747, merged roads and other pavement, 25 object references | 95.393 s |

These completion events were closely polled: the last pending result and first ready result were separated by 6.6, 9.4 and 0.7 milliseconds, respectively. Unlike early helper shaders first checked after generation, these long delays cannot be explained by delayed observation. They still include contention/queueing and overlap each other; they are not exclusive compiler CPU costs or additive savings.

Evidence: evidence/PERFORMANCE-2026-11-19/material-attribution/garage.json.gz and individual-programs.csv. The expanded inventory adds material keys, object examples, object-reference counts, poll counts and completion brackets.

#### Isolated shader-loop experiments — rejected for production

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

#### Retained repeated-work fix

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

#### Remaining priorities

The under-20-second garage target is not met. Focus next on which shader variants are truly distinct and required, and the lifetime of material/program caches across edits and transitions. Any larger procedural-to-texture proposal needs explicit scope, quantified benefits, and visual comparison; no visual simplification is authorized by this report. Garage/world separation and background loading remain later work as requested.


## Record: Private Chrome state reconstruction

Source record: CHROME-PROFILE-2026-11-19.md.

### Actual Chrome profile and invalid shadow-sampler warm-up

Branch: codex/wingsmith-performance-audit. Original saved designs/settings were not cleared. No deployment. All visual features retained.

#### Saved Chrome state

Opened the user's existing Chrome profile and the published Wingsmith build 48a71176c5a6. Exported only this game's flydiy.* localStorage entries through DevTools: 91 keys, including 21 saved designs, fleet/player documents, stored premises, graphics, world-look and material settings. The fixture is private, outside the repository. Do not commit it or copy the entire browser profile. Authentication, history and unrelated site data were not exported.

The current saved profile has the black studio enabled. The observed published-page session displayed the career/story interface, so it is not a controlled sandbox comparison. Its internal boot log reached gone at 144.630 seconds; Chrome's tab UI later reported 5.7–6.4 GB. Those figures are observations, not proof of a memory leak or a comparable sandbox timing. DevTools and UI interactions also make it unsuitable for a formal speed benchmark. The previous evening's 6–9-minute preparation was not reproduced in that observation.

The complete flight-recorder download was blocked by Chrome's multiple-download permission. That permission was left unchanged. The successfully exported game-state snapshot includes the internal boot log. The original test window was closed before isolated GPU work resumed.

#### Isolated sandbox replay

Replayed the 91 game entries on localhost with mode=sandbox and the real RTX 3080. This copies game localStorage, not IndexedDB, browser caches, extensions or the original process's history. The copied storage changes only inside the disposable test profile. Graphics error tracing adds overhead; timing is diagnostic rather than a speedup benchmark.

The replay reproduced repeated GL_INVALID_OPERATION (1282) on the aircraft skin/glass programs. The first captured errors were in the boot's worldCompile interval, while asynchronous preparation also draws stand-ins. The first replay reached gone at 216.678 seconds; it does not reproduce the old nine-minute preparation either.

Evidence: chrome-profile-replay and chrome-sampler-bindings under reports/evidence/PERFORMANCE-2026-11-19. Full shader sources, material attribution and the offending bindings are retained.

#### Confirmed invalid binding

Three captured offending program families are MeshPhysicalMaterial aeroskin:scuff (glass and live skin variants). Their active directionalShadowMap sampler is SAMPLER_2D_SHADOW (35682), but its bound 2D texture has TEXTURE_COMPARE_MODE = NONE (0). A comparison sampler requires comparison mode; the driver reports the mismatch.

In pinned three@0.186.0, WebGLUniforms.setValueT1 configures emptyShadowTexture.compareFunction before substituting a missing single shadow texture. setValueT1Array substitutes the same fallback for missing array elements but omits that configuration. Early warm draws can encounter missing shadow-map array entries before real maps exist. This explains the observed invalid fallback bindings.

Invalid warm-up draws are a correctness problem and can undermine the intended first-use preparation. The captures do not establish how much of the user's minutes-long freezes they cause. No exclusive savings estimate is justified.

#### Fix and rebuild ownership

tools/three_shadow_fallback.js narrowly patches the array setter: configure the same comparison function as the single-texture path, and mark the one-pixel fallback for refresh if its comparison mode changes. Real shadow maps, lighting, texture quality and GLSL sources are not changed.

tools/vendor_three.js applies the correction while generating the WebGL vendor bundle. Installed dependencies are not edited. The patch fails explicitly if the upstream setter changes or is already fixed, requiring review at a Three upgrade. tools/perf/build_shadow_fallback_vendor.js supports a WebGL-only test rebuild with read-only dependencies, as used in this worktree.

tools/_shadow_fallback_check.js executes the patched setter and checks normal/reversed depth, cached fallback refresh, real-map preservation and non-shadow fallback behavior. Passed.

Real-GPU saved-profile validation, build fdc73714e3f8, is recorded in chrome-shadow-fix:

- 83,918 draw calls checked for GL errors across normal startup; zero errors recorded.
- Before the correction, the trace repeatedly captured error 1282 on the offending skin/glass programs and stopped recording after its twelve-error cap. That cap is not the total error count.
- Full startup-clock readiness: 215.408 seconds. Unfixed diagnostic replays were 216.678 and approximately 214 seconds. No reliable loading-speed improvement is established.
- No user visual feature or shader calculation was removed. A parity check against the previous vendor proves the same exported API names, all 142 ShaderChunk strings, every ShaderLib vertex/fragment source, and the managed-colour default. Only the fallback texture binding behavior changes.
- Known birch/pine snag-sheet warnings remain. This is not a full cockpit/crash/long-session acceptance pass and does not explain all historical freezes.

JavaScript syntax and whitespace checks pass. Shadow-fallback, compile-poll, reflection-padding and exact terrain-depth regression checks pass. The generated main files were rebuilt locally for testing; they remain excluded from any intended source commit. No test browser remains running and nothing is published.

The correction is retained as a rendering correctness fix. A valid warm draw is a prerequisite for meaningful first-use optimization; removing the errors is not by itself proof that the later flight freezes are solved.

#### Separate finding

The published console also reported ReferenceError: rockSync is not defined during the world's after-build hook. The branch source has two rockSync callers and no definition. This can abort the remaining work in that hook and is a separate correctness issue; it was not silently bypassed or treated as a visual optimization. Fixing it needs its own scope and validation because restoring omitted world setup may add work.


## Record: Edited round-trip investigation

Source record: EDITED-ROUNDTRIP-2026-11-19.md.

### Edited design iteration and playtest reconstruction

Branch: codex/wingsmith-performance-audit. All visuals retained. Nothing deployed. This follow-up changes diagnostic tools, not game rendering or physics.

#### Real-browser Cessna design iteration

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

#### Earlier stalled departure

The prior failure remains evidence of a failed automated run. It was not reproduced by this single-Go-click test. Do not label the earlier run as a confirmed game defect or label this run as a fix. Further tests should distinguish transition interactions, worker startup, subsequent simulation progress and actual rendering stalls.

#### Player-log reconstruction

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

#### Reproduction and evidence

- tools/perf/shader_bill.js now supports --single-go and --playtest-log <file>; metadata includes worker state and trip ran/skipped decisions.
- tools/perf/program_reuse_report.py compares program IDs and normalized source pairs across captured snapshots.
- Evidence: reports/evidence/PERFORMANCE-2026-11-19/edited-roundtrip-control, especially program-reuse.json, edited-world.meta.json and departure trace files.
- Player reconstruction evidence is in reports/evidence/PERFORMANCE-2026-11-19/playtest-reconstruction, with explicit reconstruction limitations in reconstruction.json.

#### Decision

There is no evidence here justifying a broad rewrite of edit/round-trip caching: the expensive world steps are already reused in this case. Investigate the minutes-long startup/garage stalls against the actual saved profile before spending another batch on material-cache changes. Initial terrain/pavement compilation remains expensive, but source-pair counts alone do not explain the player's much longer first-light and garage waits.


## Record: Correct lamp prelink signature

Source record: LAMP-PRELINK-2026-11-19.md.

### Avoid compiling obsolete village-lamp shader variants at startup

> Scope correction, 19 November: the game-state snapshot used in these comparisons has `flydiy.garageStudio=1`. These are studio-garage tests; the full hangar is not constructed and its main compile step is bypassed. The paired comparisons remain internally useful, but they must not be presented as reproductions of the historical full-hangar 6-9-minute startup. A visible-Chrome full-hangar replay is recorded separately in `BASELINE-RECONCILIATION-2026-11-19.md`.


Branch: codex/wingsmith-performance-audit. Visuals, actual lamp behavior, light quality and shader calculations retained. Nothing published.

#### Cause measured in the saved Chrome state

Early world prelinking starts during the town step. It accounts for the aircraft's future lights, but not the village lamp pool's desired armed state. In this saved state the early coarse-terrain and pavement programs were keyed for two point lights. After the village lamps armed, those large materials were keyed again for ten point lights: the aircraft's two plus the eight village lights.

The previous sampler-fix control captures both sets:

| Program | Submission phase | Point lights | Observed completion delay |
|---|---|---:|---:|
| Coarse terrain | town | 2 | 89.2 s |
| Pavement | town | 2 | 88.0 s |
| Coarse terrain again | snapshot | 10 | 105.3 s |
| Pavement again | snapshot | 10 | 102.0 s |
| Fine terrain | snapshot | 10 | 105.1 s |

Delays overlap; they are not additive or exclusive compiler times. Source and light-array identities establish that the initial two-point variants differ from the final required ten-point variants.

#### Change

Early world prelinks now synchronously dress the village lamps to the state requested by the actual day and world settings, alongside the existing aircraft-light stand-ins. The previous armed state and every existing light intensity are restored immediately, including on exceptions and when the compile call returns a Promise. The existing final world compilation and readiness checks remain.

This applies to the town, settled-world, lot-ground and graphics-change prelink paths. It changes preparation keys, not the visible lamps, their number, their illumination or their day/night behavior. Daytime layouts remain supported. If the desired and current lamp states already agree, the helper does no additional work. prelinklamps=0 retains the old preparation for controlled comparisons.

#### First real-GPU comparison

Both cases replay the same private game-only Chrome snapshot in a fresh browser at 5120 × 1271, mode=sandbox, with the renderer's shadow-array fix present. Both trace GL errors. This is not the pre-driver-update user session. Tracing adds overhead.

| Metric | Sampler-fix control | Correct lamp prelinks |
|---|---:|---:|
| Startup-clock full readiness | 215.408 s | 194.792 s |
| World-compile phase | 87.562 s | 68.278 s |
| First-frame preparation | 7.358 s | 7.471 s |
| Subsequent first-light preparation | 7.591 s | 7.671 s |
| Total program links | 435 | 402 |
| GL errors | 0 | 0 |
| Checked draw calls | 83,918 | 83,643 |

First-pair gain: 20.616 seconds, approximately 9.6% of full readiness. Thirty-three fewer links, approximately 7.6%. This is a measured first comparison, not yet a broad hardware or all-settings claim.

The candidate capture has only ten-point coarse-terrain, fine-terrain and pavement programs. The obsolete two-point coarse/pavement links are absent. No graphics option was disabled to obtain the result.

Evidence: reports/evidence/PERFORMANCE-2026-11-19/chrome-shadow-fix and prelink-lamps. A default-on repeat with edited-round-trip validation is recorded separately in prelink-lamps-default.

#### Checks and remaining cost

tools/_prelink_lamps_check.js executes the actual helper and checks the desired count, exact intensity restoration, exception safety, immediate restoration for Promise returns, unchanged-state behavior, missing API handling, the default and the diagnostic opt-out. It passes. The game was rebuilt for GPU testing.

The under-20-second garage target remains far unmet. The fine-terrain program still first appears around the snapshot step, much later than coarse terrain and pavement; starting its exact required program earlier is a concrete next scheduling experiment. World generation and scene settling also remain substantial. The old 6–9-minute startup remains valid historical evidence but has not been reproduced after the driver update; the update's contribution has not been isolated.

#### Default-on repeat and departure limitation

The default-on repeat reached full readiness at **195.128 s**, versus 194.792 s in the first candidate: a 0.336 s spread. World compilation was 68.894 s. The first-frame and subsequent-frame steps were 7.436 s and 7.642 s. The early obsolete two-point terrain/pavement variants remain absent. The garage source census contains 402 linked programs. Six more links appeared during the subsequent capture/metadata window from continuing parked-aircraft work (408 in metadata and the world source census); those later counts must not be compared directly to the earlier 402 checkpoint.

The required ten-point coarse terrain, pavement and fine terrain vertex/fragment sources are **byte-for-byte identical** between the control and first candidate. No visual shader calculation was simplified.

The initial departure completed and simulation advanced (0.633 s in the world snapshot). Internal preparation was 0.235 s; return preparation 0.580 s. After an aircraft edit, preparation completed in 7.004 s, but simulation time stayed at zero despite active worker messages/steps. This is an unresolved validation failure, not a successful edited round trip. A matching optimization-disabled control is being recorded before attributing it to the change. The failure capture recorded zero GL errors across 1,085,192 checked draws.

The focused lamp, compile-poll, shadow-fallback, terrain-depth and probe-padding checks pass, as does the whitespace/error check. The shadow-fallback check uses the existing read-only dependency installation via FLYDIY_NODE_MODULES.

##### Optimization-disabled departure control

The matching `prelinklamps=0` control reached readiness at **217.408 s** and also failed the edited-departure simulation-time check: render holds cleared, worker messages and steps continued, but the page simulation time remained zero for the two-minute observation. Its first departure worked. This reproduces the validation failure without the lamp optimization and does not support blaming that optimization. Neither saved-state failure is being called a confirmed general game defect: an unseeded/previous-master reproduction and worker/page mirror diagnosis remain separate work. The GPU was released after the second failed edited-departure check; no blind retries followed.

The lamp change remains on the local audit branch, unpublished. Startup improvement is supported by two candidate runs and controls on either side; edited-trip acceptance remains explicitly incomplete. Next recommended optimization: start the exact fine-terrain program earlier and measure total readiness, without changing shader source or appearance.


## Record: Visual tradeoffs and subsystem analysis

Source record: PERFORMANCE-TRADEOFFS-2026-11-19.md.

### Performance choices: what to bake, simplify, or retain

> Scope correction, 19 November: the game-state snapshot used in these comparisons has `flydiy.garageStudio=1`. These are studio-garage tests; the full hangar is not constructed and its main compile step is bypassed. The paired comparisons remain internally useful, but they must not be presented as reproductions of the historical full-hangar 6-9-minute startup. A visible-Chrome full-hangar replay is recorded separately in `BASELINE-RECONCILIATION-2026-11-19.md`.


Local audit branch; nothing deployed. Visual changes below are proposals unless explicitly identified as an authorized diagnostic. Measurements are RTX 3080 / Chrome / ANGLE D3D11 after the driver update. The private game-state replay excludes IndexedDB and the original browser process/cache. It is not an exact reproduction of the historical evening session.

#### What is paying the bill

The saved-state run with corrected lamp prelinks reaches readiness in about 195 seconds. Its world-compile phase is about 69 seconds, world construction about 35 seconds, and scene settling about 30 seconds. Snapshot, active-aircraft baking, parked preparation, forest growth and first-use draws also cost seconds each. These are phase wall times with overlapping compiler jobs. They are not independent feature costs that can be added as promised savings.

The ground, fine ground and pavement are particularly expensive individual programs. Prior isolated cold links took roughly 28Ã¢â‚¬“31 seconds each, versus roughly 90Ã¢â‚¬“105 seconds of overlapping submission-to-completion delay in the full game. This supports both shader simplification and reducing competing/redundant compilation. It does not support adding three link delays to promise a 270-second saving.

The corrected lamp-layout preparation already saved about 20Ã¢â‚¬“22 seconds in controlled runs without visual changes. Early exact fine-ground preparation is a separate opt-in scheduling experiment, not a simpler shader.

#### Priorities and visible scope

| Priority | Proposal | What changes for the player | Evidence and realistic scope of benefit |
|---|---|---|---|
| 1 | Three shipped static parked aircraft; no player-plane captures/bakes | Parked scenery uses a Cub, Cessna and Jodel, not the player's saved designs | Explicitly authorized as a test. Six player-plane bake misses in the evening log each took about 24Ã¢â‚¬“25 s elapsed, overlapping; repeated captures also occur. Actual end-to-end saving is being measured, not inferred by summing them. |
| 2 | Bake static terrain and vegetation fields/tiles | Can retain the intended shape, shoreline and distribution within a declared sampling tolerance | Targets part of the ~35 s world build and ~30 s settle, plus later streaming. Larger engineering change, but more promising than repeatedly optimizing tiny lake-mask setup. |
| 3 | Replace large portions of the ground/pavement procedural shader with baked unlit material data | A hybrid can preserve near detail; a more aggressive version changes close-up blending, repetition and slope appearance | Targets the dominant compiler family and per-frame ground shading. The ~56Ã¢â‚¬“89 s world-compile phase is the relevant current opportunity, not a measured saving. Needs isolated source test plus full-load A/B and slope/shore/runway visual comparisons. |
| 4 | Fewer town details, shorter detailed-town reach, shared simpler materials | Less distant detail/variety; possibly fewer decorative objects and lamps | World generator measured ~7.25 s premises terrain patches, ~6.86 s aerodromes and ~5.10 s road-bucket work in a separate CPU profile. Some settling is town-related too. These categories are mixed; they are not all removable town cost. Reducing house count alone does not remove the ground/pavement shader compile. |
| 5 | Rationalize aircraft mode programs and capture light layouts | Some merges can retain visuals; baked-only nearby aircraft would soften fine detail | Current saved-state census has 34 named aeroskin and 16 named flown-bake links. These are not 50 interchangeable programs. About ten duplicate-source groups involve these families, after removing only the diagnostic shader-name line. Other variants genuinely differ. |
| 6 | Texture residency/atlas cleanup and compressed pre-generated aircraft assets | Can retain appearance; reduced texture resolution would need separate acceptance | Helps memory, decode/upload and recurring hitches. Ground libraries already use packed layers/KTX2. A blanket compression pass does not explain or solve a 99-second shader wait. |
| 7 | Atmospheric evaluation in fewer passes rather than in every material | Could alter transparent surfaces, edges and cockpit fog if implemented aggressively | Much of atmosphere code and map storage is already shared. Shared source is still compiled into many separate material programs. Moving more to one depth-based pass could reduce repeated compiler work, but transparency requires explicit design and visual testing. |

#### Terrain: are lakes, slopes and vegetation already maps?

Partly. The existing code has considerably more precomputation than a purely procedural implementation:

- Island inputs already contain raster fields for elevation/land classes/canopy/coast/lakes. Lake-bed construction builds compact distance/ownership masks. A source comment reports about 40 ms and 0.67 MB for Jolene's lake masks; that is historical source documentation, not a new measurement.
- `20_world.js` memoizes exact terrain coordinates and uses the premises' lazily cooked terrain raster. The documented raster tolerance is 1 cm. The final height still composes lake carving, premises modifiers, stones and weather-dependent strip wear.
- Fine terrain generates tile vertices from the composed height and computes normals with multiple nearby height samples. It also stores coarse height/normal attributes for its edge morph. This geometry work is different from fragment shading.
- Ground material sets are already packed offline into array layers, with KTX2 support. Macro colour and classification maps exist. Near surfaces still use substantial height blending, hex tiling, triplanar projection, procedural micro-fields, normal/roughness work and atmosphere.
- Vegetation reads the same ground micro-fields and biome rules on the CPU so its distribution and tint agree with the rendered ground. Forest masks, instanced geometry, LOD and impostors already exist. Placement, slope tests, exclusion/polygon rules, shoreline bands and chunk construction still involve repeated work.

Therefore "put it in a map" is a good direction, but it should identify which result to store. Storing a classification mask does not eliminate evaluating the final material; storing height does not eliminate constructing mesh topology and uploading buffers.

##### Recommended bake boundaries

1. **Base world tiles:** final static heights, normals/slope, lake ownership/level/shore distance, biome weights and exclusion masks. Key by actual terrain/premises/recipe dependencies. Ship the default world; recompute only changed local tiles after edits.
2. **Vegetation plans:** deterministic positions, species, scale, tint and collision metadata per chunk, keyed by the same fields and vegetation recipe. Reuse these lists across LODs. Keep wind animation, visibility/LOD selection and actual local edits dynamic. This can preserve population rather than merely reducing density.
3. **Material tiles:** unlit albedo, normal and roughness/material weights for stable ground composition. Preserve a small reusable near-detail shader, with simpler distant terrain. Keep illumination, moving shadows, weather wetness/snow and local scars separate. Do not bake sunlight into base colour.
4. **Precision:** compare the rendered surface and physics against the same authoritative composed surface, especially runway edges, lake levels and steep banks. A low-resolution whole-island image is not an acceptable replacement for wheel-contact geometry. Use tiled resolution and border handling, not one giant texture.

This exchanges compute for storage, transfer and memory. For scale, one 1024Ãƒ—1024 float32 height tile is 4 MiB before compression, before normals and other fields. Resolution and residency need budgets. Bake only deterministic inputs; retain weather-dependent wear and edited areas as local overlays or invalidated tiles. Baking cannot be called lossless until its sampling tolerance and seams pass comparison.

#### Parked versus flown aircraft, and fiche pictures

These are separate systems:

- **Parked props:** `parked.js` supports offline cooked stock aircraft and player-specific bakes. The evening published-session log loaded stock Cub/Cessna/Jodel/Chinook assets successfully, with actual decode calls around 27Ã¢â‚¬“67 ms; their 4.8Ã¢â‚¬“10.3 s total load intervals include fetching/waiting and overlap. It also captured and baked six saved player designs, with repeated captures.
- **Audit build caveat:** stock cook signatures include the broad `FLYDIY_BUILD` and `parked.js` source. Reconstructing the branch invalidates the shipped stock cooks and falls back to live capture/bake. This affects both sides of our same-build comparisons. It must not be presented as proof the published evening game re-baked those stock planes. A narrower dependency fingerprint plus a release asset check is preferable to accepting all stale assets generally.
- **Static-trio test:** only the three shipped Cub/Cessna/Jodel asset records are loaded. Parked placement keys are mapped to those props; player fleet queues/capture/bake paths are disabled. The diagnostic deliberately uses the fixed manifest/container signatures rather than rejecting the three frozen props for an unrelated running-build change. Container identity is still checked; missing assets must not trigger a live capture fallback. This is an opt-in test, not the normal cache policy.
- **Your flown aircraft:** `flown_bake.js` already bakes albedo/normal/material atlases, with 2048 exterior and interior settings, and folds geometry to reduce draw calls. Close and cockpit views retain live detail, and the transition band can use both sets. Baking everything away would lose close-up detail and cannot replace deformation/controls/glass with a static prop.
- **Fiche:** the full six-view fiche is generated when requested/awarded and stored in IndexedDB. It is not automatically regenerated for every startup. Its cutaway and studio preparation can be costly at that operation, but no present evidence makes it the main cold-boot cost. The separate small side thumbnail is cached by saved-design hash; stock thumbnails/heroes are pre-generated. Instrument an actual fiche generation before removing views for startup performance.

#### Which aircraft variants could merge?

Good candidates for further controlled investigation:

- Programs with identical complete vertex/fragment source except `SHADER_NAME`, where separate hook/material keys currently prevent reuse. The current capture has about ten duplicate groups involving flown/aeroskin programs. This is a link-count opportunity, not a ten-times-eight-second speed claim. An earlier shared-intact-key experiment did not establish a loading improvement.
- Near/eye/far zone distinctions that only govern visibility or folding should not create distinct GLSL unless shader behavior actually differs. Preserve zone geometry and visibility even if program identity is shared.
- Plain and hybrid-band variants could use a shared uniform-controlled fade path. This trades fewer programs for a branch/discard path in the ordinary case and must be timed on the GPU.
- Damage-asleep and damage-awake variants could potentially share a shader controlled by a uniform. The current design intentionally removes the damage block from intact aircraft, and precompiles both modes to avoid a first-crash link. A common program would increase intact shader work; it is not automatically faster overall.
- Reflection/capture and flight lighting layouts should agree wherever mathematically equivalent. The lamp-layout fix is a proven example. A separate reflection zero-light-padding experiment reduced links but did not improve total readiness and remains disabled.

Do not indiscriminately merge opaque skin, transmission glass, skinned/rigid geometry, shadow-depth passes or different output colour spaces. Those distinctions can change the result or required inputs.

#### Do fog and cloud systems share shaders?

They share code and data, not one universal linked program. `ATMO` provides common aerial-perspective and mist GLSL; cloud composition reuses it. Cloud shadows occupy the shared atmospheric atlas, avoiding another sampler on already-full ground materials. Cloud noise is already GPU-baked to 3D textures, and shadow transmittance is baked into the atlas. Forest mist bakes a world map into that atlas too.

The current forest-mist default is the veil (`c`), despite an outdated introductory "off by default" comment: the executable preference logic enables it unless stored off. The optional mist-in-cloud-march path shares the march; the card technique uses its own instanced draw/material. Cloud march, composite, history, shadow and noise-bake passes have different jobs and distinct programs. Their common helpers can still enlarge many compiled ground/aircraft material variants. Before removing any mist system, measure the incremental compiler and GPU cost of each path at the same weather and camera.

#### Crash calculations: what share?

There is no trustworthy crash-physics-only percentage in these logs. Damage/contact/debris work is not separated into one exported timer. Zero in the page `solver` column does not mean zero physics when a worker runs; worker step time is reported separately as `wms` and is not directly additive to page time.

One concrete evening frame records **99.738 s of page work, of which 99.478 s is attributed to shader work** (roughly 99.7%), while its reported worker step metric is about 5.96 ms. This is a cockpit frame (`STOPPED`, running/manual); the data does not label it as a crash. It demonstrates a catastrophic graphics-preparation stall, not a 99-second crash solver step. Other large scene/render stalls still need attribution.

For crashes, profile contact/structural solver work, damage mesh/scuff updates, debris and first-use damage rendering separately on a fixed scripted impact. Preserve damage effects while ensuring every actually drawn damage/cockpit/cut/light combination is prepared. Disabling crash physics would be a poorly supported first sacrifice from the current evidence.

#### Suggested decisions after the static-prop test

First decide whether losing personal parked designs buys enough time/responsiveness. Then prioritize a versioned static-world tile/vegetation bake and a hybrid simplified ground/pavement material. For a smaller visual sacrifice, test reduced distant town detail and fewer decorative local lamps while retaining the active field and nearby buildings. Reducing fiche views and broad texture downscaling rank lower until measurements identify them as bottlenecks.

Keep cold usable-garage time, cold first departure, edited round trip, cockpit entry, scripted circuit and scripted crash as separate acceptance cases. Moving work later is not a reduction in total cost; smaller link counts are not sufficient acceptance either.

#### Resource census from the early-fine repeat

After readiness, scene-referenced materials held 393 distinct texture objects (49 compressed) and 4,629 distinct geometries. Their unique CPU ArrayBuffer backing stores totalled about 871 MiB. This is not total process or GPU memory: it excludes unreferenced caches, some render targets and other systems, and backing stores can include more data than a given geometry's view. Several material arrays already use compressed 512px layers; a 3095×3920 uncompressed colour image and a 4096×2048 image also appear. Inspect ownership and duplicates before globally reducing all textures. The static-trio comparison will use this same inventory to show whether player props materially affect residency.

#### Follow-up: alpha-splat specialization and vegetation tint

The splat's blend counts are uniforms (`uSNearN` / `uSFarN`, normally 3). There is already a compile-time `SPLAT_ONE` specialization when both near and far use one set. The saved gamer setting is `far1`, which retains the general near/far material chain. A partial runtime restriction does not necessarily shrink that compiled chain. Several earlier compiler-specific changes are documented in the source: uniform-bounded loops and fewer sampling call sites avoid expensive D3D11 inlining, and a previous extra rock sampling chain added about 15 seconds per ground link in the source's historical measurements. This is a strong architectural reason to specialize capabilities, not just turn visual dials down.

Recommended replacement design: one bounded capability profile for the active world recipe, with compile-time exclusions for unused third detail/global layers, unused height blending/recolour modes, and unused rock/micro/puddle paths. Bake stable large-scale blend weights and grading into fields; retain local texture detail and dynamic weather in a shorter shader. Recompile under a visible preparation step only when an edit enables a new capability; ordinary numeric colour/weather changes should remain uniforms. Do not generate a unique shader for every terrain tile or colour value. First compare exact enabled-feature output and cold source/link complexity, then full-load and near-ground GPU time. A lower runtime quality dial alone may leave nearly the entire compiler cost intact.

Vegetation tint is also a concrete bake candidate. `trees.js` composes species/master/kind/shadow-match values on the CPU in `retint`, but fragment GLSL still applies hue rotation, saturation/lightness and flattening terms; flowers have a similar hook. Stable final art-direction transforms can be pre-applied to the albedo sheets or combined into a precomputed colour matrix/offset, removing repeated hue sin/cos/matrix construction from shader source. Baking post-texture nonlinear/clamped transforms can differ from transforming a filtered sample, so check edges/mips and matching geometry/impostors. Preserve alpha/data maps, leaf translucency, moving lighting, cloud shadows, weather and any seasonal control separately. This is not yet a measured end-to-end saving.

The town review also found a correctness gap: `cityBuild` synchronizes changed seeds only for currently present plots; it does not hide pack plots absent from the record. A partial-town fixture can therefore retain full-town packed houses. The first reduced-fixture/city-host run is excluded from reduced-town acceptance. Matched `cityhost=0` tests use the existing kit path, which filters instance rows against present plot IDs. Repairing the default cooked-city reconciliation and properly trimming its assets remain follow-up work; merely hiding missing plots would not remove their allocation or decode cost.

The saved ground recipe contains sixteen override rows: seven have one near texture, two have two, and seven have three. Far overrides have zero/one/two named textures, with absent far slots inheriting near slots before the graphics limit is applied. The effective `far1` setting forces the extra far slots off. Thus stored null far entries alone are not proof that third-layer code is unused, and removing every third near layer would visibly change seven saved rows. Extend the existing compile-time specialization rather than claim it does not exist. The source also documents substantial earlier optimization work; the present issue is accumulated complexity and coverage, not the absence of all best practices.

#### Authorized simplification results

The static-only aircraft test and actual one-third-town test are complete; see `STATIC-PROPS-AND-TOWN-2026-11-19.md` for matched controls, limitations and resource counts. Static props reached readiness in 180.615 s versus 181.930 s with player props retained and valid stock cooks: no meaningful startup gain established in that pair despite 49 fewer links. The compact town reached 173.869 s versus 172.495 s for the full town on the same kit renderer, with identical 334-program counts. Neither visual sacrifice is presently justified as the primary cold-loading fix. Near-town FPS, sustained garage responsiveness and crashes still need their own tests; these boot measurements do not settle those cases.


## Record: Static parked props and town tests

Source record: STATIC-PROPS-AND-TOWN-2026-11-19.md.

### Static aircraft and compact-town experiments

> Scope correction, 19 November: the game-state snapshot used in these comparisons has `flydiy.garageStudio=1`. These are studio-garage tests; the full hangar is not constructed and its main compile step is bypassed. The paired comparisons remain internally useful, but they must not be presented as reproductions of the historical full-hangar 6-9-minute startup. A visible-Chrome full-hangar replay is recorded separately in `BASELINE-RECONCILIATION-2026-11-19.md`.


Branch codex/wingsmith-performance-audit. Opt-in diagnostics only; no deployment or saved-data deletion. The active edited/flown aircraft is retained. All runs use fresh real Chrome on RTX 3080 / ANGLE D3D11 at 5120×1271 with the same game-only saved-state fixture and GL-error tracing. IndexedDB and the original browser session are not replayed.

#### Static parked aircraft

User-authorized scope: only the pre-generated Cub, Cessna and Jodel as parked meshes; no parked player-design capture or bake. `parktrio=1` maps parked placements to those three keys and disables the player-fleet paths. It loads the existing shipped cooked assets without regenerating them. The frozen manifest/container signatures must agree; the diagnostic intentionally does not reject those fixed props just because the reconstructed audit build has a new broad build hash. This exception is test-only, not the normal cache rule. Missing props cannot silently fall back to live capture.

The fair control uses `parkstock=1`: pre-generated stock props like the published game, while retaining parked player designs. Both use `fineprelink=1` and the lamp-layout fix.

| Metric | Pre-generated stock + player props | Three static props only |
|---|---:|---:|
| BOOT readiness clock | 181.930 s | 180.615 s |
| Linked program instances in garage census | 401 | 352 |
| Scene-referenced texture objects | 393 | 375 |
| Unique CPU geometry backing stores | 910.2 MiB | 874.2 MiB |
| GL errors recorded | 0 | 0 |

The end-to-end difference is only **1.315 s in this pair**, within the variability seen in other runs. This does not establish a meaningful startup speedup. The test does reduce recorded work and resources: 49 fewer links, 18 fewer referenced textures and about 36 MiB fewer CPU geometry backing stores. These are not total GPU/process-memory figures.

Preparation moves earlier: scene settling 30.508→24.025 s; parked preparation 4.785→0 s; snapshot 5.018→1.098 s; active-aircraft bake 6.163→4.799 s. The later world-compile phase grows 58.699→76.232 s, absorbing most of the earlier saving. These concurrent phase times must not be summed as independent feature savings. This is a useful example of fewer links and less preparation not necessarily reducing the dominant critical path.

The static capture contains exactly three cooked records, all `arch:` keys, zero pending parked objects, and zero player-fleet queued/captured/baked/stored/decoded counters. Its boot log contains three cook loads and no parked capture/bake events. The currently flown aircraft's bake remains, as intended. `tools/_static_trio_check.js` verifies the actual key mapping, no live capture path, cache reuse, the fleet override and normal opt-out behavior.

Evidence: `static-trio`, `static-stock-player-control` under `reports/evidence/PERFORMANCE-2026-11-19`.

#### Earlier fine-terrain submission

The fine-terrain material is available before streamed tile meshes exist. `fineprelink=1` supplies a tiny temporary object with the exact tile attribute layout to the existing sliced compiler, using the final lamp/light signature. It adds no visible geometry, changes no shader source and disposes its temporary geometry after preparation.

Two early-fine runs reached readiness at 189.653 s and 178.721 s, versus a same-build opt-out control at 201.579 s. Earlier lamp-only candidates were 194.792 and 195.128 s. The required fine-ground vertex/fragment pair in the first candidate is byte-for-byte identical to the prior final fine-ground pair; it is submitted at 74.047 s instead of around the later snapshot. Both early-fine runs complete with zero GL errors. The spread is substantial, so no precise fixed saving or broad-hardware claim is justified. The experiment remains opt-in rather than being silently enabled.

#### Compact town fixture

`tools/perf/make_compact_town.js` creates `tools/fixtures/premises_v1_perf_town_third.json`; it does not overwrite the shipped world or saved scenery. Original composed town: 383 plots. Candidate: 129 plots (33.68%), all retaining original IDs. Kept zones: core, central residential, northern residential and eastern residential. Town roads drop 62→39, sites 61→32, objects 42→8, and terrain-modifier entries 9→3. The seaplane base and its essential entries remain. Removed peripheral neighbourhoods receive modest forest zones and land-cover overrides.

These are plot counts, not an assertion of exactly one rendered house mesh per plot. Some retained sites contain multiple named buildings and the town kit can contain outbuildings. Other named places on the island are retained. This is a performance fixture, not a fully reviewed mission/navigation replacement.

##### Cooked-city correctness finding

The current default city renderer loads the full cooked city and reconciles changed plot seeds only for plots still in `O.records.plots`. Absent plots are not hidden by that loop. The initial reduced-fixture run (`town-third-static-trio`) therefore cannot establish a reduced rendered town and is excluded from acceptance. Reducing the premises count alone is insufficient.

The matched follow-up uses `cityhost=0`, the existing kit path. Its host explicitly filters instance rows against present plot IDs before creating the host. Both the full and reduced town must use this same backend for a meaningful comparison. The reduced fixture's retained IDs preserve access to the existing kit instead of intentionally forcing unique-house generation. Results are recorded below when both runs finish.

Fixing default city-pack reconciliation is a separate concrete correctness task. A visibility-only repair would still leave full-pack fetch/decode/allocation; trimming assets or a correct dependency-aware subset is required to remove that work too.

##### Matched kit-renderer result

| Metric | Full town | Compact town |
|---|---:|---:|
| Composed town plots | 383 | 129 |
| Town site items | 65 | 36 |
| Actual kit-host house/outbuilding instances | 440 | 135 |
| BOOT readiness clock | 172.495 s | 173.869 s |
| World construction | 34.982 s | 36.548 s |
| Initial town step | 2.064 s | 1.761 s |
| Initial forest-ring preparation | 4.255 s | 2.845 s |
| Scene settling | 22.206 s | 22.702 s |
| World-compile phase | 70.909 s | 72.278 s |
| Linked programs | 334 | 334 |
| Scene-referenced textures | 349 | 349 |
| CPU geometry backing stores | 849.326 MiB | 841.585 MiB |
| Kit-host geometry accounting | 36.775 MiB | 29.352 MiB |
| Recorded GL errors | 0 | 0 |

The reduced town is actually reduced in this test (129 kit plots / 135 host instances), with the cooked-city host off on both sides. It is **1.374 s slower in this single pair**, not a demonstrated loading win. The same shader set is required. Forest was added outside the retained area; geometries therefore do not scale linearly with house count (4,498 full versus 4,525 compact), and some preprocessing can increase. The ~7.7 MiB reduction in counted CPU geometry backing stores is modest at whole-scene scale.

This is a cold-load-at-HOME test, not a measurement of frame rate while flying over or walking through the town. It does not establish that reducing the town cannot help near-town rendering; it establishes that housing count is not the dominant cold-start critical path in these cases. A scripted near-town pass remains necessary before judging the visual sacrifice for flight performance. Likewise no cockpit/crash/edited-trip success is implied by these boot-only tests.

The diagnostic fixture's six placement warnings concern other retained named sites and their roads; it is not a newly authored shipping town. The seaplane entry remains, but missions/navigation and the wooded replacement's final look have not been accepted.

##### Recommended next substantial batch

Keep both simplifications opt-in for now. Their savings do not justify an unconditional visual reduction based on this loading evidence. Focus on reducing ground/pavement compilation, specializing unused shader capabilities and caching static world/vegetation work. Treat the cooked-city record/asset mismatch as a correctness issue. Measure near-town runtime separately rather than spending more cold boots seeking a house-count loading win.

JavaScript syntax checks, static-trio behavior, lamp-state restoration, compile-poll checks and diff whitespace checks pass. Every GPU run closed its own browser and released its lock. Generated main pages remain local reconstruction products; nothing has been committed or published.

#### Follow-up in the actual hangar path

The saved-state comparisons above used the studio; the scope correction at the top is essential. A later visible-Chrome/full-hangar test with draw-error tracing off reaches normal ready at 211.248 s with six real player-fleet capture/bake misses, versus 233.963 s with only the three static stock props. Program counts are 655 versus 607 in the garage source census, and the expensive ground/fine-ground/pavement source pairs are identical. The largest observed delay among removed program sources is 5.161 s, not thirty seconds. This single pair does not prove a general slowdown from removal, but it still provides no cold-loading win. Full details, the published-master control and remaining historical differences are in `BASELINE-RECONCILIATION-2026-11-19.md`. Hangar-size switching and runtime responsiveness remain separate acceptance work.


## Record: Baseline reconciliation and invalid comparisons

Source record: BASELINE-RECONCILIATION-2026-11-19.md.

### Reconciling the player's 6–9 minutes with audit timings

> Working baseline updated: the user's 19 November retest records about 2:56 to studio, 1:22 switching studio off, 19 s further settling, 54 s departure and 2 s return. The log corroborates these observations. The earlier 6-9-minute launch is now historical evidence, not the active reproduction target. See `MANUAL-RETEST-2026-11-19.md`.

#### What was wrong with the comparison

The private Chrome localStorage snapshot has `flydiy.garageStudio=1`. The later saved-state audit runs faithfully replayed that value, but this selects the studio, not the full hangar. `app.js` deliberately does not construct the hangar in studio mode; the main `compile` boot step exits when `hangar` is absent. The recent saved-state runs consequently record zero time in that step.

The supplied evening log records **80.212 seconds** in that same compile step, plus **45.205 seconds** in first-frame preparation and **186.921 seconds** in subsequent first-use frames. Its loading screen disappears at navigation-clock 375.458 s; its initial preparation chain ends around 555.538 s. It is not an equivalent workload to a studio test reaching readiness at about 195 s. The audit should have identified this distinction before treating saved-state studio timing as a reproduction of the user's full garage.

The paired studio tests can still compare their local changes, but their conclusions cannot be extrapolated to the full hangar, career transitions or the historical first-use tail. Earlier clean-Cessna tests are a separate fixture and should not be conflated with these later saved-state studio runs either.

#### Did the fleet control actually bake aircraft?

Yes. `static-stock-player-control/garage.meta.json` records six player-fleet captures, six bakes, six stored results and zero cache hits. Each named parked bake is a miss, with overlapping elapsed durations about 9.7–12.7 s. The static-trio counterpart has no player capture/bake and only three cooked stock records.

However, the removed linked programs in this comparison are not several independent 30-second links:

- Control: 401 links. Static trio: 352.
- Fifty control program instances have source pairs absent from the static capture (21 distinct pairs); other substitutions explain why the net difference is 49. Names alone are not used as source identity.
- The longest closely observed submission-to-completion delay among those absent variants is about **4.52 s**, followed by 3.62 and 3.49 s. This is overlapping/queued elapsed time, not exclusive compiler CPU time.
- The expensive fine-ground program completes at page time **165.603 s** with player props and **164.234 s** without them. Its required work remains. The control's long coarse-ground/pavement waits also remain as ground/pavement programs in the static case.
- Startup-clock readiness is 181.930 versus 180.615 s. Removing work that finishes well before the last required program need not shorten readiness much.

The source-pair evidence is saved in `evidence/PERFORMANCE-2026-11-19/fleet-source-comparison.json`. This explains that particular pair; it does not prove the historical full hangar would get the same small fleet saving. The original evening fleet bake misses took about 24–25 s elapsed each, overlapping, and some designs were captured repeatedly.

#### Other differences that must remain explicit

- The historical measurement precedes the graphics driver update. Current tests use the updated driver. Its effect has not been isolated by a controlled before/after test.
- Tests replay game-only localStorage in a separate browser profile. IndexedDB, cache history, extensions and the original browser process are not copied. Missing caches can add work; accumulated live resources or stale-cache refresh behavior can add different work. "Has cached content" is not itself an explanation for slow loading.
- The snapshot was exported after the playtests, so current WIP, garage mode and settings are not guaranteed to be the original startup inputs. The historical log's exported aircraft/settings can describe its later state too.
- Most tests used real GPU Chrome in headless mode. Visible Chrome is now tested explicitly at the same measured inner viewport and DPR. These remain instrumented diagnostic runs, including GL-error tracing and the harness's frame/vsync flags.
- Two career documents exist in the snapshot. The last-selected one has two fleet entries; the older one has nineteen. The separate sandbox ledger has twenty-one. Stored fleet size does not guarantee all those designs are instantiated or baked at a particular hangar.
- The original URL does not specify a mode. Recorded flight events say `career:false`; this describes those flight events and does not by itself reconstruct every initial menu choice and garage state.

#### Visible populated-career replay

`populated-career-headed` selects the nineteen-aircraft career in the private snapshot, with `mode=career`, visible Chrome, 5120×1271 inner viewport and DPR 1. It reaches readiness at **154.523 s**. Its active garage remains studio mode from the snapshot. No player fleet captures/bakes are triggered: only two stock aircraft are captured/baked in this scene. Ninety seconds of post-readiness observation records no new program links or player-fleet bakes. This is a valid observation of that career state, not a reproduction of the historical six-player-bake full hangar.

#### Full-hangar replay

`full-hangar-headed` uses the populated sandbox snapshot and overrides only `flydiy.garageStudio` to `0` in the private test profile. It uses visible Chrome at the original viewport, no static-trio/fine-prelink simplification flags, the current audit branch's lamp-layout and shadow-fallback fixes, and ninety seconds of post-readiness observation. The user's actual saves and preferences are untouched. The initial chain reaches its end around 264 s and the screen disappears at 264.093 s through `fail: hard timeout`, not normal `ready`. It links 660 programs and has zero recorded GL errors. No new links or fleet bakes appear in the subsequent 90 s; this does not establish interaction/FPS acceptance. Its roughly 80 s of extra preparation over studio cases confirms that studio is an inadequate full-hangar baseline, but the timeout-driven release is not a performance pass.

#### What the ambition needs to be

The convincing loading win so far is approximately twenty seconds in the measured lamp-layout comparisons. The remaining microbenchmarks and simplification tests are diagnostic evidence, not delivery of the target. A roughly 195-second result still needs about a 90% reduction to reach a twenty-second garage. The ~35-second world-construction step alone exceeds the entire garage budget before shader preparation begins.

The next implementation needs a measured garage/flight budget split, versioned pre-generated static terrain/vegetation data, a materially smaller ground/pavement shader workload and a bounded variant set, with exact first-use preparation verified in the actual full hangar, cockpit and damaged states. Separating work can make the garage arrive sooner, but the cold garage-to-first-flight total must also fall; moving minutes onto the first departure is not meeting the objective. Further rounds of removing house counts are lower priority without a demonstrated near-town runtime benefit.

#### Published runtime and tracing bias

The published runtime was extracted from Git commit `9349a62c1cbee17ae77741d5e62b2ab1657ef376` into a separate read-only-in-use fixture outside the repository. Its generated index, source scripts, vendor, manifests and tools are from that commit; remaining large assets are served from the existing tree. The game reports published build `48a71176c5a6`. This is not a rebuilt hybrid of old HTML and changed runtime scripts.

The first published full-hangar diagnostic (`master-full-hangar-headed`) reaches normal `ready` at 246.062 s, links 703 programs, and records twelve GL errors before the diagnostic error cap. It successfully uses its shipped stock cooks; the first audit full-hangar run re-baked stale stock cooks. In addition, GL draw-error tracing stops making its queries after the twelve-error cap. The corrected branch records no errors and continues tracing all draws. Those correctness runs therefore have unequal tracing overhead and stock preparation; their wall-time difference is **not a valid performance comparison**. A matched pair without draw-error tracing, with frozen stock assets on the audit side, is recorded separately.

`page_rig.js` now rejects a loading screen disappearance without normal ready evidence, an idle chain and no loader fail/error records. Diagnostic census runs may explicitly continue after that rejection to collect evidence, but report the failed health check and a nonzero exit status. A focused check covers timeouts, failed steps, unfinished chains and missing readiness evidence. The harness's navigation timer also includes time spent in its diagnostic navigation callback, instead of printing a misleading zero-second boot after the callback waited for loading. These changes improve measurement truthfulness; they are not claimed as game speedups.

##### Conclusions that must be withdrawn or narrowed

The studio fleet experiment does **not** rule out a significant fleet cost in the actual full hangar. It accounts for six real bake misses in its own scene, but not the full hangar's reflection/shadow/light-layout and first-use program workload. Its result must not be used to dismiss the user's observation or to decide the player-fleet feature is cheap everywhere. Likewise, the one-third-town result concerns a cold studio/HOME setup on the kit backend, not near-town runtime or full-hangar startup. The corrected full-hangar baseline takes priority before further simplification tests.

The historical 6:15 and 9:15 measurements remain supported by the supplied log. The studio mismatch explains why the recent saved-state workload was lighter, but does not quantitatively explain every second of the historical gap. A driver-change attribution cannot be established without a controlled pre-update replay; the exported snapshot is also a later state. The original runtime on the updated driver is the proper current control, not a replacement for that historical evidence.

#### Matched full-hangar timing pair, draw-error tracing disabled

Both runs use visible Chrome, the same measured 5120×1271 inner viewport/DPR 1, the same game-state snapshot with studio forced off, fresh browser profiles, six player-fleet bake misses, and valid pre-generated stock assets. The published runtime uses its shipped asset signatures. The audit uses its explicitly scoped `parkstock=1` frozen-stock diagnostic so unrelated audit source edits do not force extra stock re-bakes. Neither uses static player-prop replacement or the opt-in early fine-ground experiment. Compilation/source census instrumentation remains on both sides; intrusive per-draw GL-error queries are off on both.

| BOOT-clock metric | Published master | Audit branch |
|---|---:|---:|
| Normal ready | 243.853 s | 211.248 s |
| World generation | 36.439 s | 35.893 s |
| Scene settling | 24.160 s | 23.794 s |
| Active-aircraft bake | 5.489 s | 6.096 s |
| World-compile phase | 102.902 s | 94.280 s |
| Garage-compile phase | 29.990 s | 5.545 s |
| First frame | 3.614 s | 4.231 s |
| Subsequent first-use frames | 5.969 s | 5.852 s |
| Loader fail/error records | 0 | 0 |

Both pass the strengthened loader-health check. The observed aggregate difference is **32.605 s (13.37%) in one pair**. Phase timings include overlap and are not an isolated attribution to individual code changes. The result is encouraging but needs repetition before a robust fixed saving claim. It remains nowhere near a twenty-second garage, and thirty seconds of post-ready diagnostic polling is not a scripted interaction, cockpit, circuit or crash acceptance test.

The audit's six bake misses mean this comparison does not quietly omit fleet generation. Its source census has 655 programs when the initial state is observed, with six more arriving during capture/post-ready observation (661). Published census/count windows must be compared at matching boundaries; final post-capture counts are not exactly the initial readiness count.

A further single full-hangar static-trio comparison is recorded as `audit-full-hangar-static-timing`, because the earlier studio-only fleet result did not settle the full-hangar cost. No more unrelated visual-reduction experiments are part of this calibration checkpoint.

#### User-confirmed historical scene and stopping point

The user confirmed the original measurement was **Sandbox, Mosquito, large hangar**. They then switched to the medium hangar and experienced another huge lag. The snapshot exported later is not a record of that exact initial scene. Current saved-data replays at 5120×1271 are retained as a working browser reference; historical driver/profile differences are not being pursued further at this checkpoint. The user's later manual playtest remains the acceptance verdict. Fullscreen display and viewport should not be conflated: these visible-Chrome tests explicitly fix the render viewport to 5120×1271/DPR 1; they are not claimed as an independently verified F11 desktop-fullscreen session.

Next runtime acceptance should include the original meaningful actions: choose/load Mosquito, large-to-medium hangar switch, aircraft swap, cockpit entry, edited departure/return and a crash. Those should be measured as operations with continuous responsiveness, not inferred from a clean cold boot or a silent post-ready probe.

#### Corrected full-hangar fleet-removal result

`audit-full-hangar-static-timing` uses the same visible-Chrome/full-hangar saved-state setup and no draw-error tracing. It passes normal loader health at **233.963 s**, versus **211.248 s** for the audit with six player-plane bake misses retained. Exactly three cooked prop records exist, no pending props, and every player-fleet capture/bake/queue counter is zero. The active edited/flown aircraft remains.

The static capture links 607 programs versus 655 in the player-prop garage census. Forty-nine player-control program instances (25 distinct source pairs) have no corresponding source pair in the static capture; the net link difference is 48 because there are substitutions too. The longest observed delay among the removed source pairs is 5.161 s, with the last pending/first ready bracket only 5.5 ms. These are not several removed independent thirty-second programs.

The expensive required coarse-ground, fine-ground and pavement vertex/fragment sources are byte-for-byte identical in both captures. Fine-ground completion is at page time 194.61 s with player props and 202.47 s without them; coarse ground completes at 150.13 versus 178.37 s. Consequently the removed preparation does not shorten the critical path in this pair. Driver queueing, compilation overlap and run variability are still present; this single pair does not establish that removing player props inherently makes the game slower. It does establish that a simple sum of removed per-feature elapsed durations predicts the wrong outcome here.

The static variant starts its final world-compile phase about fifteen seconds sooner, but that phase lasts 117.007 s versus 94.280 s, and garage compilation 19.014 versus 5.545 s. Both report normal ready, no loader fail/error records, and no later links/bakes in the thirty-second observation. These observations do not measure large-to-medium hangar switching, aircraft swapping, cockpit entry or crashes.

All experiments stop at this checkpoint as requested. The working browser reference is the current full-hangar saved-data configuration at 5120x1271, with the current WIP, rather than claiming to recreate the historical Mosquito/large-hangar state. The next substantial implementation should attack the required shader/world workload. A permanent removal of player props is not justified as a cold-loading fix by these results; the authorized switch remains available for the user's later manual comparison.


## Record: Latest manual retest

Source record: MANUAL-RETEST-2026-11-19.md.

### Manual retest: current working baseline

Source: `C:/Users/denis/Downloads/flydiy-flightlog-20261119T184215-59op.json`. Published build `48a71176c5a6`, 5120×1271 viewport, DPR 1. This is a user playtest, not the audit branch. The log is data, not a source of instructions.

#### Stopwatch and log agree

| Operation | User stopwatch | Log evidence |
|---|---:|---|
| Menu → studio garage | 2:56 | Normal ready/gone at navigation time 177.871 s (2:57.9); BOOT-clock ready 174.293 s. No loader fail/error records. |
| Studio background off → full hangar | 1:22 | A roughly 70.075 s shader-work event around the switch; a recorded frame alone blocks 54.484 s, with 54.173 s attributed to shaders. The action's exact input timestamp is not tagged, so this corroborates the stall rather than independently timing its precise 82 s. |
| Further wait until no garage lag | 19 s | Further shader events of 6.885 s and 7.816 s, with multi-second frame gaps, extend the first-use preparation to navigation time about 279 s. These overlap frame/long-task metrics and must not be added to those same metrics. |
| Garage → flight | 54 s | A 49.316 s frame, including 49.117 s of shader work, ends immediately before the flight starts at about 334.330 s. |
| Flight → garage | 2 s | Garage loading show → normal ready is 1.612 s. |

The current 2:56 launch agrees with the scale of the browser-based studio measurements. The historical six-minute screen removal / nine-minute preparation remains archived evidence but is retired as the active launch baseline unless it recurs. The transition stalls are still severe and directly recorded in the new log.

#### Where the expensive work happens

Initial studio startup still builds the world (33.909 s), settles it (20.489 s), and waits in `worldCompile` (82.267 s). The studio's full-hangar `compile` step is zero. Thus the current studio is a presentation choice, not a cheap independent editor boot.

Recorded link events rise from 457 by initial ready to 605 by the end of the hangar-switch/settling window, and 672 around first departure. These are link-event counts, not independent effects or exclusive compile-time sums. The switch introduces many full-room material/light/target variants; the later departure also names flown-aircraft and crew variants.

The rollout loading panel records only **0.204 s** from show to ready. That does not represent the user's 54-second departure: the large blocking work precedes the panel. Measure from the actual action through a painted, advancing simulation; reporting only loader steps would severely understate the experience again.

The return path is already fast. Preserve its reuse and cache behavior while fixing first-use paths.

#### Default current test

The cold baseline test now explicitly selects the full hangar, rather than inheriting studio mode from a saved snapshot. `tools/perf/shader_bill.js` uses the hangar by default; `--studio` opts into a separate studio case, and `--hangar` remains an explicit default alias. Selected configuration is recorded alongside the actual resulting mode. The original user's saved data is never changed by these private fixtures.

Cold full-hangar loading, studio-to-hangar switching, hangar-size changes, aircraft swaps and first departure are distinct acceptance operations. Passing a cold boot does not establish that the later transitions are prepared. Future staged-loading work needs additional milestone timings rather than silently changing this reference.

#### Proposed studio → garage → world ladder

This is a sound staged-loading design, with the studio as the first usable presentation of a persistent garage editor:

1. **Studio/editor ready:** load the active design, editor controls, minimal studio environment and only their necessary programs/textures. No world-construction, world-compile or parked-fleet prerequisite. Target an actually editable studio within 20 s, not merely a visible canvas.
2. **Full garage ready:** load the room and its props/reflections/shadow/material variants in bounded work. Keep the existing aircraft/editor state alive. Add the prepared room around that state, with a controlled environment transition; do not export/rebuild/rebake the aircraft merely to replace the backdrop. If the user requests the hangar before it is ready, prioritize it and retain the usable studio with progress.
3. **World ready:** fetch/decode/build world dependencies and prepare the exact flight/cockpit/damage/light/target variants. Keep the editor responsive during this work. A Go request prioritizes remaining departure work with truthful progress; an already ready world should depart quickly. Subsequent editing invalidates only relevant dependencies, preserving the fast return path.

Use shared geometry, textures, design state, controls and resource ownership. Studio and hangar lighting can legitimately require different shader variants; a common editor must not assume one lighting context's programs are ready for the other. Each stage needs explicit readiness and stale-job cancellation when an edit changes its inputs.

"Background" is an execution constraint, not just an ordering label. Fetch/decode can overlap; suitable geometry/field work belongs on workers; main-thread construction and uploads need short bounded slices; parallel shader compilation needs scheduling and exact readiness checks. Do not draw an unready variant, synchronously flush long queues on input, or run a huge warm-up frame behind the studio. Budget or pause preparation when the user edits.

This ladder reduces time-to-use and exposes useful work sooner, but it does not by itself reduce total cold-to-flight cost. Ground/pavement shader rationalization and pre-generated static world data remain necessary for the total budget. The current ~70 s switch and ~49 s departure shader bursts must be eliminated or correctly prepared; hiding them in a later stage is not sufficient.

Derived evidence: `evidence/PERFORMANCE-2026-11-19/manual-retest-20261119-summary.json`. No additional browser runs were needed for this assessment.


## Record: Ground branch specialization

Source record: GROUND-SPECIALIZATION-2026-11-19.md.

### Bounded ground-shader prototype: rejected

Scope: one captured coarse-ground source pair from the actual full-hangar audit. The saved graphics setting is `far1`. The prototype replaces the far branch's general three-set call with its exact single-set path, retaining near detail, grading, selective recolouring, lighting and vertex source. No production shader or default was changed.

The existing `cold_links_bench.js` compared original/candidate and reversed order in fresh Chrome profiles on RTX 3080 / ANGLE D3D11. Shader disk cache disabled; one program issued at a time; 180-second hard cap; no game/world generation alongside the measurement. All four programs linked successfully.

| Order | Original | Prototype |
|---|---:|---:|
| Original then prototype | 34.4 s | 38.4 s |
| Prototype then original | 30.6 s | 40.4 s |

Translated fragment HLSL length: 264,210 original versus 263,972 prototype. The source rewrite barely changes compiler output size and is slower in both orders. Rejected; no full-game trial or production integration is warranted. No whole-startup saving is claimed. Browser closed and GPU lock released.

An initial selective-colour pruning idea was ruled out by the saved-recipe check before GPU execution: `rocksB` and `rocksG` use nonzero selective hue-band corrections. Removing that path would change the image. The abandoned script was removed; those corrections remain intact. This also corrects the initial progress-message assumption that the feature was unused.

Evidence and reproducible source extraction: `tools/perf/far_one_ground_sources.py`, `reports/evidence/PERFORMANCE-2026-11-19/ground-far-one-specialization/{forward,reverse,scope,result}.json`.

The next useful prototype should structurally remove procedural material-composition work from the lit shader, for example by precomputing shared blend/recolour fields or material tiles with explicit near-detail and edit-invalidation handling. A simpler far material alone is insufficient if first departure still needs the same expensive near shader. Further small uniform/branch rearrangements are a low priority after this result. The existing visuals remain the acceptance reference.

Stopped at the user's credit-budget checkpoint; no additional browser loads or experiments were started.


## Record: Material/lighting prototype

Source record: MATERIAL-CACHE-PROTOTYPE-2026-11-19.md.

### Ground material/lighting split — 19 November 2026

Working diagnostic prototype on codex/wingsmith-performance-audit; not registered in the shipping loader. No visual feature has been removed. Image acceptance now passes in the tested cases. Cold compilation improved in both tested orders. Whole-game startup has not yet been improved by this prototype.

#### What works

The original complete ground material recipe is separated from lighting. Two RGBA16F images carry linear colour/roughness and the world-space normal. The lighting reader retains the original lighting, shadows, atmospheric effects and output calculations. The source generator fails closed if its expected shader boundaries change.

##### Cold compilation

RTX 3080, ANGLE D3D11, fresh browser profiles, shader disk cache disabled, programs issued individually. Two orders, not a statistical population or full-game load test. The compiler capture is the coarse-ground variant; image/render tests below use fine terrain.

| Program | Original order | Reverse order |
| --- | ---: | ---: |
| Original combined coarse ground | 33.329 s | 34.518 s |
| Complete material builder | 18.227 s | 21.214 s |
| Cached material lighting | 0.780 s | 0.747 s |
| Split total | **19.007 s** | **21.961 s** |
| Reduction for this program | **43.0%** | **36.4%** |

Evidence: material-cache/compile-result.json and compile-reversed-result.json under evidence/PERFORMANCE-2026-11-19/. The frozen compiler sources use world-space cache coordinates; the rendered prototype uses screen-space coordinates. The material builder is the same computation; the lighting reader differs in coordinate lookup. Do not present these as an exact same-source end-to-end test.

##### Rendered acceptance

One real 160 m fine-terrain tile from the user's saved game, 256×256 render targets, overhead and oblique cameras. Controlled ambient [2,2,2] and first directional light colour [6,5,4], direction [.2,.8,.5]; the other captured lights and real world shadow maps remain present. Reference and candidate use identical test lighting. This is a controlled lighting fixture, not a claim to match the user's entire world view.

| View | Covered pixels | Mean absolute RGB error (0–255) | 99th percentile | Maximum |
| --- | ---: | ---: | ---: | ---: |
| Overhead | 65,536 | 0.00716 | 0 | 1 |
| Oblique | 24,272 | 0.00981 | 0 | 1 |

Both pass the predeclared mean ≤0.5 / p99 ≤2 limits. No GL errors. Deliberately inverting the cached normals produces a mean error of 23.718, correctly failing: the test is sensitive to normal errors. Reference/candidate/difference PNGs were inspected. These are linear render-target byte comparisons; the PNG previews are correspondingly dark.

Evidence: material-cache/session/accepted-result.json and accepted-*.png. No broad acceptance yet for other recipes, shores, snow, distance/detail transitions, terrain tiers or moving lights.

##### Added GPU work

GPU timer queries at 5120×1271, twelve samples per path, alternating order, three warmups. One fine-terrain tile stretched across the viewport, controlled lighting as above. The split path rebuilds both material buffers on EVERY sample, then lights the result. No disjoint timers or GL errors.

| Path | Median | Range |
| --- | ---: | ---: |
| Original combined shader | 19.969 ms | 16.353–21.427 ms |
| Material builder + lighting reader | 19.504 ms | 16.265–20.143 ms |

Roughly equal in this bounded test; do not claim a game-FPS improvement. The material buffers cost **99.30 MiB** at this viewport, excluding depth and the final colour target. At 256×256 they cost 1 MiB. Evidence: material-cache/session/gpu-cost.json.

#### Failures, cause and fixes

1. First image attempt: normal full-hangar boot 216 s, then shader linking failed. Captured SHADER_TYPE/SHADER_NAME headers conflicted with the headers Three adds for RawShaderMaterial. Strip those captured headers. Original failure preserved in material-cache/images/failure.json.
2. Second image attempt: normal boot 211 s, but a blank reference. Initial suggestions of a disabled fine disc or bad camera were **ruled out** in the retained session: fine radius 700 m; unlit geometry covers all 4096 diagnostic pixels; no GL error.
3. Exact cause of blank reference: GL INVALID_OPERATION, validation message “Two textures of different types use the same sampler location.” This Three build binds shadow maps directly from light state, outside the ordinary material-uniform dictionary. The raw probe had no directionalShadowMap entries, leaving shadow samplers at unit zero. Copying uniform needsUpdate flags alone did NOT fix it. Explicitly capture real shadow maps by matching each shadow matrix to its source light. This preserves light ordering and shadows.
4. Once bindings were fixed, coverage was complete but the saved lighting made linear-byte outputs almost black. Use a documented controlled lighting fixture; do not accept two black images as equivalent. Both original and candidate receive the same fixture.
5. The first retained-session geometry command had an expression-wrapper syntax error from a trailing semicolon. The cheap corrected command passed without another game load. External probe page text now strips that final semicolon at the wrapper boundary.

The successful retained game session loaded normally in 214 s. It was used for all diagnostics and image/runtime checks, then closed and the GPU lock released. Its load time measures the existing audit build, not this inactive prototype's startup benefit. Background game rendering continued during GPU-query tests; queries enclose only the explicitly tested draws.

#### Integration boundary and next work

The prototype currently obtains source from an already compiled reference. Production must generate the two programs BEFORE the original combined compilation, then replace its loading/render path. Otherwise there is no startup saving. That integration is not done.

This is a camera-dependent screen cache. Camera, recipe, geometry, weather and relevant material inputs require rebuilding; it is not a once-per-world baked map. Persistent world tiles need a separate resolution/filtering/LOD/invalidation design and image checks. Captured view-space light uniforms are suitable for this fixed diagnostic only; production must use the renderer's live lighting state.

Next: implement pre-compilation source generation and a query-flagged render integration, measure whole-game readiness and departure, then check the remaining terrain families/recipes and moving-camera behaviour. Keep all visual features. No default enablement or publication based only on this diagnostic.


## Record: Success/failure ledger and traps

Source record: PERFORMANCE-ATTEMPTS-2026-11.md.

### Performance attempts: avoid repeating rejected experiments

Branch: `codex/wingsmith-performance-audit`. Default remains visually unchanged unless a retained fix is explicitly identified. Experiments below are not cumulative wins. Consult this index before spending another GPU slot on the same idea.

#### Rejected, inconclusive, or diagnostic-only attempts

| Attempt | Observed result | Decision / why not repeat as-is |
|---|---|---|
| Shared intact aircraft-damage hook key | No demonstrated load improvement | Reverted; patch retained in evidence. Do not assume fewer material keys produce a startup gain. |
| Share coarse/fine ground programs (`groundshare=1`) | 620→619 links; 192.89→203.55 s in that comparison | Default off. Geometry clipping/morph equivalence was checked; no loading gain. |
| Zero-intensity light padding for reflection captures (`probepad=1`) | 620→519 links; about 192.89→203.17 s | Default off. Large link-count reduction did not improve readiness. Visual acceptance also incomplete. |
| Uniform-bounded rock noise loop | First 30.570→26.655 s; reversed repeat 28.044→28.201 s | Rejected. Initial improvement did not reproduce. |
| Uniform-bounded pavement track loop | 27.215→26.466 s, one pair | No integration; too small/unconfirmed to justify runtime/compiler risk. |
| Deduplicate compile readiness polling | Local one-query-per-program/tick check passes; whole-run queries 331,638→348,710 | Local cleanup retained, but do not claim an aggregate query or speed reduction. |
| Three static parked props instead of player aircraft | Studio 181.930→180.615 s; full hangar 211.248→233.963 s, single pairs | Opt-in test only. Six real player bake misses were present in the controls. Required terrain/pavement shaders remain; no cold-loading win established. Hangar swapping/runtime are separate questions. |
| Town 383→129 plots | Matched kit backend 172.495→173.869 s; same 334 links | Opt-in fixture only. No cold-loading improvement. Does not settle near-town FPS. |
| First compact-town run on cooked-city backend | Packed houses absent from the new record were still present | Invalid reduced-town comparison; excluded. Cooked-city reconciliation is a correctness finding, not a measured optimization. |
| Far-one texture fast path | Original 34.4 / 30.6 s; candidate 38.4 / 40.4 s in reversed orders | Rejected. Translated HLSL barely shrank (264,210→263,972 chars). More branch rearrangement is a low priority. |
| Remove supposedly unused selective recolouring | Recipe guard found active `rocksB` and `rocksG` hue-band corrections | Aborted before GPU execution. Removing this would alter the image. Earlier progress-message assumption was wrong. |
| First material-cache image probe | Normal full-hangar boot 216 s; diagnostic shader link check failed before images | Captured shader headers duplicated Three's RawShaderMaterial `SHADER_TYPE` definition. Corrected header handling and added detailed link diagnostics; preserve `material-cache/images/failure.json`. Not a game loading failure or a valid image test. |
| Second material-cache image probe | Normal full-hangar boot 211 s; shaders linked after header correction, but reference image rejected as blank | Stopped after the second miss. No visual-equivalence claim. Failure at `material-cache/images-attempt2/failure.json`. Inspect fine-disc clipping, camera and lighting before any further run. Added early disabled-disc rejection and preservation of failed image/coverage metrics for future attempts; these diagnostic changes have not had another GPU run. |
| Retained-session uniform-wrapper fix alone | Setting copied wrappers to needsUpdate=true did not remove the shadow sampler collision | Actual cause was absent shadow texture entries: this Three build binds them outside material uniforms. Explicit real shadow-map capture fixed it. Disabled fine disc/camera hypotheses were ruled out. See the material-cache report before repeating this investigation. |
| Dark-image equivalence after shadow binding fix | Full reference coverage, no GL errors, but almost-black linear output under the saved lighting | Not accepted as an image match. A controlled ambient/directional fixture then passed overhead/oblique checks; deliberate normal inversion correctly failed. |

Detailed evidence: [compiler experiments](COMPILER-OPTIMIZATION-2026-11-19.md), [static props and town](STATIC-PROPS-AND-TOWN-2026-11-19.md), [far-one prototype](GROUND-SPECIALIZATION-2026-11-19.md), and `evidence/PERFORMANCE-2026-11-19/`.

#### Retained work, with the limits of its claims

- Terrain patch neighbour caching: 71,148 exact comparison checks pass; reduces repeated CPU work without changing the shape.
- Aerodrome generation yields: reduced a measured maximum generator task from about 7.2 to 2.5 s, without reducing geometry. Total generator work remains about 32 s.
- Correct village lamp signature during early prelinking: obsolete two-point variants avoided when the final world needs ten. Studio comparisons saved about twenty seconds. Corrected full-hangar master→combined audit pair is 243.853→211.248 s (~13.4%), not an isolated attribution to this change alone.
- Shadow-sampler array fallback fix: confirmed wrong comparison mode; corrected validation captures report no GL draw errors. This is a correctness fix, not by itself a proven loading win.
- Earlier exact fine-terrain submission (`fineprelink=1`): 189.653 / 178.721 s versus 201.579 s control, with considerable spread. Opt-in; shader source unchanged. No broad fixed saving claim.

#### Measurement traps discovered and corrected

1. A copied `garageStudio=1` state omitted the full hangar and bypassed its compile step. Studio and full-hangar results must be labelled separately. Census tool now defaults explicitly to the full hangar; `--studio` is opt-in.
2. `BOOT.state==='gone'` can mean a watchdog timeout. Require normal ready, no fail/error records, and an idle chain. `page_rig.js` now checks this; diagnostic continuation is explicitly unsuccessful.
3. A navigation callback consumed loading time before the rig started its timer, printing zero seconds. Timer now starts before navigation. BOOT timestamps remained the report's measurement source.
4. Draw-error tracing stopped querying after twelve errors on the broken build, while a corrected build continued querying every draw. Those correctness-run timings were unequal; separate draw-tracing-off comparisons are required.
5. Broad build/source fingerprints invalidate pre-generated stock aircraft after unrelated audit edits. Published-versus-audit timing used frozen stock assets on the audit side. Do not generally accept stale assets or attribute their re-bakes to the published game.
6. The first simulated edited departure sometimes stayed at page sim time zero while worker messages continued. It occurred with the lamp optimization enabled and disabled. Not a passing iteration test and not yet a general game defect without independent reproduction.
7. The new manual log shows a 49 s shader stall before the rollout panel, which itself reports only ~0.2 s. Measure from actual input to advancing flight, not panel duration.

#### Current baseline and next work

The user retired the old 6–9-minute launch as the active target after a fresh playtest: studio 2:56, studio off 1:22, a further 19 s until no lag, departure 54 s, return ~2 s. See [manual retest](MANUAL-RETEST-2026-11-19.md). Keep historical evidence; do not chase old driver/profile differences unless they recur.

Primary priority is actual world/shader work reduction, followed by fast edited garage/world round trips. Studio→garage→world staged loading is planned, but must not merely move blocking work behind an interactive studio. No visual feature reduction without scoped argument and user consent. No generated main-page commits or deployment from this audit.

Current structural prototype: `src/viewer/ground_material_cache.js`, not registered in the shipping loader. It splits material construction from lighting, with two half-float material outputs. See [material-cache evidence and limitations](MATERIAL-CACHE-PROTOTYPE-2026-11-19.md). It is not yet a production cache or a startup win.

Update after the user's request to persevere: rendered checks now pass for one fine tile in overhead/oblique controlled lighting (maximum 1 RGB byte difference; inverted-normal negative control detected). Isolated coarse-program compilation improved in both orders: 33.329→19.007 s and 34.518→21.961 s. GPU cost was roughly unchanged in a full-viewport terrain-only test, with 99.30 MiB additional material buffers. Production pre-compilation source generation/render integration remains next. Earlier failed probes are historical, not the current final acceptance status.

