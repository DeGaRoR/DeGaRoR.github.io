# Static aircraft and compact-town experiments

> Scope correction, 19 November: the game-state snapshot used in these comparisons has `flydiy.garageStudio=1`. These are studio-garage tests; the full hangar is not constructed and its main compile step is bypassed. The paired comparisons remain internally useful, but they must not be presented as reproductions of the historical full-hangar 6-9-minute startup. A visible-Chrome full-hangar replay is recorded separately in `BASELINE-RECONCILIATION-2026-11-19.md`.


Branch codex/wingsmith-performance-audit. Opt-in diagnostics only; no deployment or saved-data deletion. The active edited/flown aircraft is retained. All runs use fresh real Chrome on RTX 3080 / ANGLE D3D11 at 5120×1271 with the same game-only saved-state fixture and GL-error tracing. IndexedDB and the original browser session are not replayed.

## Static parked aircraft

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

## Earlier fine-terrain submission

The fine-terrain material is available before streamed tile meshes exist. `fineprelink=1` supplies a tiny temporary object with the exact tile attribute layout to the existing sliced compiler, using the final lamp/light signature. It adds no visible geometry, changes no shader source and disposes its temporary geometry after preparation.

Two early-fine runs reached readiness at 189.653 s and 178.721 s, versus a same-build opt-out control at 201.579 s. Earlier lamp-only candidates were 194.792 and 195.128 s. The required fine-ground vertex/fragment pair in the first candidate is byte-for-byte identical to the prior final fine-ground pair; it is submitted at 74.047 s instead of around the later snapshot. Both early-fine runs complete with zero GL errors. The spread is substantial, so no precise fixed saving or broad-hardware claim is justified. The experiment remains opt-in rather than being silently enabled.

## Compact town fixture

`tools/perf/make_compact_town.js` creates `tools/fixtures/premises_v1_perf_town_third.json`; it does not overwrite the shipped world or saved scenery. Original composed town: 383 plots. Candidate: 129 plots (33.68%), all retaining original IDs. Kept zones: core, central residential, northern residential and eastern residential. Town roads drop 62→39, sites 61→32, objects 42→8, and terrain-modifier entries 9→3. The seaplane base and its essential entries remain. Removed peripheral neighbourhoods receive modest forest zones and land-cover overrides.

These are plot counts, not an assertion of exactly one rendered house mesh per plot. Some retained sites contain multiple named buildings and the town kit can contain outbuildings. Other named places on the island are retained. This is a performance fixture, not a fully reviewed mission/navigation replacement.

### Cooked-city correctness finding

The current default city renderer loads the full cooked city and reconciles changed plot seeds only for plots still in `O.records.plots`. Absent plots are not hidden by that loop. The initial reduced-fixture run (`town-third-static-trio`) therefore cannot establish a reduced rendered town and is excluded from acceptance. Reducing the premises count alone is insufficient.

The matched follow-up uses `cityhost=0`, the existing kit path. Its host explicitly filters instance rows against present plot IDs before creating the host. Both the full and reduced town must use this same backend for a meaningful comparison. The reduced fixture's retained IDs preserve access to the existing kit instead of intentionally forcing unique-house generation. Results are recorded below when both runs finish.

Fixing default city-pack reconciliation is a separate concrete correctness task. A visibility-only repair would still leave full-pack fetch/decode/allocation; trimming assets or a correct dependency-aware subset is required to remove that work too.

### Matched kit-renderer result

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

### Recommended next substantial batch

Keep both simplifications opt-in for now. Their savings do not justify an unconditional visual reduction based on this loading evidence. Focus on reducing ground/pavement compilation, specializing unused shader capabilities and caching static world/vegetation work. Treat the cooked-city record/asset mismatch as a correctness issue. Measure near-town runtime separately rather than spending more cold boots seeking a house-count loading win.

JavaScript syntax checks, static-trio behavior, lamp-state restoration, compile-poll checks and diff whitespace checks pass. Every GPU run closed its own browser and released its lock. Generated main pages remain local reconstruction products; nothing has been committed or published.

## Follow-up in the actual hangar path

The saved-state comparisons above used the studio; the scope correction at the top is essential. A later visible-Chrome/full-hangar test with draw-error tracing off reaches normal ready at 211.248 s with six real player-fleet capture/bake misses, versus 233.963 s with only the three static stock props. Program counts are 655 versus 607 in the garage source census, and the expensive ground/fine-ground/pavement source pairs are identical. The largest observed delay among removed program sources is 5.161 s, not thirty seconds. This single pair does not prove a general slowdown from removal, but it still provides no cold-loading win. Full details, the published-master control and remaining historical differences are in `BASELINE-RECONCILIATION-2026-11-19.md`. Hangar-size switching and runtime responsiveness remain separate acceptance work.
