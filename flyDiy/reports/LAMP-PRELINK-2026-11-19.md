# Avoid compiling obsolete village-lamp shader variants at startup

> Scope correction, 19 November: the game-state snapshot used in these comparisons has `flydiy.garageStudio=1`. These are studio-garage tests; the full hangar is not constructed and its main compile step is bypassed. The paired comparisons remain internally useful, but they must not be presented as reproductions of the historical full-hangar 6-9-minute startup. A visible-Chrome full-hangar replay is recorded separately in `BASELINE-RECONCILIATION-2026-11-19.md`.


Branch: codex/wingsmith-performance-audit. Visuals, actual lamp behavior, light quality and shader calculations retained. Nothing published.

## Cause measured in the saved Chrome state

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

## Change

Early world prelinks now synchronously dress the village lamps to the state requested by the actual day and world settings, alongside the existing aircraft-light stand-ins. The previous armed state and every existing light intensity are restored immediately, including on exceptions and when the compile call returns a Promise. The existing final world compilation and readiness checks remain.

This applies to the town, settled-world, lot-ground and graphics-change prelink paths. It changes preparation keys, not the visible lamps, their number, their illumination or their day/night behavior. Daytime layouts remain supported. If the desired and current lamp states already agree, the helper does no additional work. prelinklamps=0 retains the old preparation for controlled comparisons.

## First real-GPU comparison

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

## Checks and remaining cost

tools/_prelink_lamps_check.js executes the actual helper and checks the desired count, exact intensity restoration, exception safety, immediate restoration for Promise returns, unchanged-state behavior, missing API handling, the default and the diagnostic opt-out. It passes. The game was rebuilt for GPU testing.

The under-20-second garage target remains far unmet. The fine-terrain program still first appears around the snapshot step, much later than coarse terrain and pavement; starting its exact required program earlier is a concrete next scheduling experiment. World generation and scene settling also remain substantial. The old 6–9-minute startup remains valid historical evidence but has not been reproduced after the driver update; the update's contribution has not been isolated.

## Default-on repeat and departure limitation

The default-on repeat reached full readiness at **195.128 s**, versus 194.792 s in the first candidate: a 0.336 s spread. World compilation was 68.894 s. The first-frame and subsequent-frame steps were 7.436 s and 7.642 s. The early obsolete two-point terrain/pavement variants remain absent. The garage source census contains 402 linked programs. Six more links appeared during the subsequent capture/metadata window from continuing parked-aircraft work (408 in metadata and the world source census); those later counts must not be compared directly to the earlier 402 checkpoint.

The required ten-point coarse terrain, pavement and fine terrain vertex/fragment sources are **byte-for-byte identical** between the control and first candidate. No visual shader calculation was simplified.

The initial departure completed and simulation advanced (0.633 s in the world snapshot). Internal preparation was 0.235 s; return preparation 0.580 s. After an aircraft edit, preparation completed in 7.004 s, but simulation time stayed at zero despite active worker messages/steps. This is an unresolved validation failure, not a successful edited round trip. A matching optimization-disabled control is being recorded before attributing it to the change. The failure capture recorded zero GL errors across 1,085,192 checked draws.

The focused lamp, compile-poll, shadow-fallback, terrain-depth and probe-padding checks pass, as does the whitespace/error check. The shadow-fallback check uses the existing read-only dependency installation via FLYDIY_NODE_MODULES.

### Optimization-disabled departure control

The matching `prelinklamps=0` control reached readiness at **217.408 s** and also failed the edited-departure simulation-time check: render holds cleared, worker messages and steps continued, but the page simulation time remained zero for the two-minute observation. Its first departure worked. This reproduces the validation failure without the lamp optimization and does not support blaming that optimization. Neither saved-state failure is being called a confirmed general game defect: an unseeded/previous-master reproduction and worker/page mirror diagnosis remain separate work. The GPU was released after the second failed edited-departure check; no blind retries followed.

The lamp change remains on the local audit branch, unpublished. Startup improvement is supported by two candidate runs and controls on either side; edited-trip acceptance remains explicitly incomplete. Next recommended optimization: start the exact fine-terrain program earlier and measure total readiness, without changing shader source or appearance.
