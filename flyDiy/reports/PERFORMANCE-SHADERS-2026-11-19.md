# Shader and repeated-work checkpoint — 19 November 2026

Branch: codex/wingsmith-performance-audit. Nothing published. All visual features retained. Experimental shader changes remain opt-in, disabled by default.

## User targets and acceptance

Target: usable garage under 20 seconds; garage-to-world at most 30 seconds; no freezes; fast repeat trips after editing. These targets are NOT met. Measurements below use real Chrome on the RTX 3080 after the driver update, at 5120 × 1271, seeded with the Cessna saved aircraft. Browser automation still needs cockpit, crash, and edited-aircraft acceptance before any overall success claim.

The supplied evening playtest records approximately 6:15 to overlay removal and continued preparation until approximately 9:15. A fresh automated profile is substantially faster and is not an adequate substitute for that populated-user case.

## Established control

Post-driver fully-ready garage: 193.782 seconds first launch, 146.299 seconds warm reload. Two unchanged-aircraft departures per launch: 16.7–16.9 seconds; returns 0.56–0.74 seconds. Departure timing includes transition and harness polling. Evidence: ../reports/evidence/PERFORMANCE-2026-11-18/post-driver/summary.json.

The instrumented shader census control reached readiness at approximately 192.889 seconds. It submitted 620 program links, representing 517 distinct source pairs after normalizing only the shader-name label. It submitted 620 vertex shader compilations with 323 exact unique vertex sources, and 620 fragment compilations with 470 exact unique fragment sources. Duplicate source does not automatically mean a cache-key mistake: renderer parameters and uniform bindings must also be compatible.

World compilation alone accounted for 87.908 seconds in this control. Coarse ground, fine ground, and pavement emitted approximately 212–216 KB per shader pair. Their first observed completion delays reached approximately 94–100 seconds; these are polling upper bounds, not native compiler durations. Parallel delays must not be added together.

## Experiment: share coarse and fine ground programs

Opt-in: groundshare=1. One shared program selects the original coarse/fine predicates and morphing through a uniform. No ground feature, texture, precision, or shadow was removed.

Result: 620 → 619 links. Readiness approximately 203.549 seconds, versus control 192.889. World compile decreased to 71.377 seconds, but garage compile increased from 4.611 to 28.523 seconds. This is NOT evidence of an overall loading improvement.

Verification: specialized emitted shader token streams match both legacy ground sides exactly. Real factory hooks emit identical shared sources with side uniforms -1 and +1. Paused same-camera A/B/A captures show no visible difference. Short GPU samples: shared 39.203 ms, legacy 42.135 ms, shared again 39.876 ms (114/108/111 valid samples). This rules out an obvious local regression, not all-scene acceptance. Source equivalence is stronger than the small image comparison for preservation of the two original branches.

Evidence directories: shader-bill, shared-ground-disc, ground-share-compare under evidence/PERFORMANCE-2026-11-19.

## Experiment: keep reflection capture light counts stable

Opt-in: probepad=1. The garage reflection capture excludes the aircraft cabin lights. That changes the number of lights in the material shaders and creates another large set of programs. Temporary black, zero-intensity, non-shadowing lights retain the visible-scene light count during capture while the real cabin lights remain excluded. Placeholders are removed immediately after capture/preparation; none remains in normal rendering.

Result: 620 → 519 links (101 fewer, 16.3%). Distinct normalized source pairs: 517 → 451. Readiness approximately 203.170 seconds: again NOT an overall speed improvement. This removes considerable repeated preparation but does not remove the expensive world-compile critical path.

Automated helper checks pass for stable counts, zero contribution, excluded lights, hidden children, other-scene exclusion, cleanup, pooling, opt-out, and aircraft-in-probe mode. Full reflection-image and edited-round-trip acceptance is still required before enabling by default.

Evidence: evidence/PERFORMANCE-2026-11-19/probe-light-padding/garage.json.gz and garage.meta.json. Test: tools/_probe_light_padding_check.js.

## Functional finding

The census's first world departure completed. After returning, changing p_topRound, and departing again, rendering continued around 23 fps but simulation time remained at zero despite running=true and hold=false. This is a failed edited-round-trip check, not a successful benchmark. The failure snapshot is retained in shader-bill/failure.json.gz. Root cause has not been established; do not attribute it to an experiment without reproduction.

## Recommended next work, in order

1. Target the large ground/pavement shader compiler bill directly. Establish which expanded shader blocks and combinations dominate compiler cost, then simplify mathematically redundant work while preserving appearance. Measure full readiness, not a single phase. The current one-program-sharing experiment did not deliver enough.
2. Finish reflection-padding visual and edited-trip acceptance. It is a promising repeated-work reduction, but should remain opt-in until those checks pass. Do not sell its program-count reduction as seconds saved.
3. Reproduce the edited-aircraft simulation stall independently. A fast transition that cannot resume simulation is not an acceptable design-iteration loop.
4. Rerun a populated-profile baseline matching the supplied playtest, including cockpit and crash. Report overlay removal, full readiness, worst frame stalls, and edited round trips separately. The scripted circuit alone can miss garage preparation.
5. After actual work is reduced, separate garage and world preparation. This helps the garage target, but by itself relocates the world cost to departure; background loading comes later as requested.

A proposed shadow-only-light shortcut was inspected and not attempted: the near-shadow implementation directly indexes Three's native second directional shadow sampler, coordinate varying, and light-shadow array. Removing that light from the native layout would require a deliberate shadow-path refactor and full visual validation, not a safe quick switch.

## Retained earlier changes

Per-active-cell terrain-neighbour cache: 71,148 exact comparisons pass. Per-aerodrome yields reduce the longest measured world-generator call from approximately 7.2 to 2.5 seconds, preserving geometry; total generator execution remains approximately 31.6 seconds. These are useful CPU improvements, not proof of the startup target.

Generated main files are reconstructed locally for testing and should be excluded from the branch commit, following the user's workflow. No deployment or merge has occurred.
