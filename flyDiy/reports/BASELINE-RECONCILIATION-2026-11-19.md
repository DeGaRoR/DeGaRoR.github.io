# Reconciling the player's 6–9 minutes with audit timings

> Working baseline updated: the user's 19 November retest records about 2:56 to studio, 1:22 switching studio off, 19 s further settling, 54 s departure and 2 s return. The log corroborates these observations. The earlier 6-9-minute launch is now historical evidence, not the active reproduction target. See `MANUAL-RETEST-2026-11-19.md`.

## What was wrong with the comparison

The private Chrome localStorage snapshot has `flydiy.garageStudio=1`. The later saved-state audit runs faithfully replayed that value, but this selects the studio, not the full hangar. `app.js` deliberately does not construct the hangar in studio mode; the main `compile` boot step exits when `hangar` is absent. The recent saved-state runs consequently record zero time in that step.

The supplied evening log records **80.212 seconds** in that same compile step, plus **45.205 seconds** in first-frame preparation and **186.921 seconds** in subsequent first-use frames. Its loading screen disappears at navigation-clock 375.458 s; its initial preparation chain ends around 555.538 s. It is not an equivalent workload to a studio test reaching readiness at about 195 s. The audit should have identified this distinction before treating saved-state studio timing as a reproduction of the user's full garage.

The paired studio tests can still compare their local changes, but their conclusions cannot be extrapolated to the full hangar, career transitions or the historical first-use tail. Earlier clean-Cessna tests are a separate fixture and should not be conflated with these later saved-state studio runs either.

## Did the fleet control actually bake aircraft?

Yes. `static-stock-player-control/garage.meta.json` records six player-fleet captures, six bakes, six stored results and zero cache hits. Each named parked bake is a miss, with overlapping elapsed durations about 9.7–12.7 s. The static-trio counterpart has no player capture/bake and only three cooked stock records.

However, the removed linked programs in this comparison are not several independent 30-second links:

- Control: 401 links. Static trio: 352.
- Fifty control program instances have source pairs absent from the static capture (21 distinct pairs); other substitutions explain why the net difference is 49. Names alone are not used as source identity.
- The longest closely observed submission-to-completion delay among those absent variants is about **4.52 s**, followed by 3.62 and 3.49 s. This is overlapping/queued elapsed time, not exclusive compiler CPU time.
- The expensive fine-ground program completes at page time **165.603 s** with player props and **164.234 s** without them. Its required work remains. The control's long coarse-ground/pavement waits also remain as ground/pavement programs in the static case.
- Startup-clock readiness is 181.930 versus 180.615 s. Removing work that finishes well before the last required program need not shorten readiness much.

The source-pair evidence is saved in `evidence/PERFORMANCE-2026-11-19/fleet-source-comparison.json`. This explains that particular pair; it does not prove the historical full hangar would get the same small fleet saving. The original evening fleet bake misses took about 24–25 s elapsed each, overlapping, and some designs were captured repeatedly.

## Other differences that must remain explicit

- The historical measurement precedes the graphics driver update. Current tests use the updated driver. Its effect has not been isolated by a controlled before/after test.
- Tests replay game-only localStorage in a separate browser profile. IndexedDB, cache history, extensions and the original browser process are not copied. Missing caches can add work; accumulated live resources or stale-cache refresh behavior can add different work. "Has cached content" is not itself an explanation for slow loading.
- The snapshot was exported after the playtests, so current WIP, garage mode and settings are not guaranteed to be the original startup inputs. The historical log's exported aircraft/settings can describe its later state too.
- Most tests used real GPU Chrome in headless mode. Visible Chrome is now tested explicitly at the same measured inner viewport and DPR. These remain instrumented diagnostic runs, including GL-error tracing and the harness's frame/vsync flags.
- Two career documents exist in the snapshot. The last-selected one has two fleet entries; the older one has nineteen. The separate sandbox ledger has twenty-one. Stored fleet size does not guarantee all those designs are instantiated or baked at a particular hangar.
- The original URL does not specify a mode. Recorded flight events say `career:false`; this describes those flight events and does not by itself reconstruct every initial menu choice and garage state.

## Visible populated-career replay

`populated-career-headed` selects the nineteen-aircraft career in the private snapshot, with `mode=career`, visible Chrome, 5120×1271 inner viewport and DPR 1. It reaches readiness at **154.523 s**. Its active garage remains studio mode from the snapshot. No player fleet captures/bakes are triggered: only two stock aircraft are captured/baked in this scene. Ninety seconds of post-readiness observation records no new program links or player-fleet bakes. This is a valid observation of that career state, not a reproduction of the historical six-player-bake full hangar.

## Full-hangar replay

`full-hangar-headed` uses the populated sandbox snapshot and overrides only `flydiy.garageStudio` to `0` in the private test profile. It uses visible Chrome at the original viewport, no static-trio/fine-prelink simplification flags, the current audit branch's lamp-layout and shadow-fallback fixes, and ninety seconds of post-readiness observation. The user's actual saves and preferences are untouched. The initial chain reaches its end around 264 s and the screen disappears at 264.093 s through `fail: hard timeout`, not normal `ready`. It links 660 programs and has zero recorded GL errors. No new links or fleet bakes appear in the subsequent 90 s; this does not establish interaction/FPS acceptance. Its roughly 80 s of extra preparation over studio cases confirms that studio is an inadequate full-hangar baseline, but the timeout-driven release is not a performance pass.

## What the ambition needs to be

The convincing loading win so far is approximately twenty seconds in the measured lamp-layout comparisons. The remaining microbenchmarks and simplification tests are diagnostic evidence, not delivery of the target. A roughly 195-second result still needs about a 90% reduction to reach a twenty-second garage. The ~35-second world-construction step alone exceeds the entire garage budget before shader preparation begins.

The next implementation needs a measured garage/flight budget split, versioned pre-generated static terrain/vegetation data, a materially smaller ground/pavement shader workload and a bounded variant set, with exact first-use preparation verified in the actual full hangar, cockpit and damaged states. Separating work can make the garage arrive sooner, but the cold garage-to-first-flight total must also fall; moving minutes onto the first departure is not meeting the objective. Further rounds of removing house counts are lower priority without a demonstrated near-town runtime benefit.

## Published runtime and tracing bias

The published runtime was extracted from Git commit `9349a62c1cbee17ae77741d5e62b2ab1657ef376` into a separate read-only-in-use fixture outside the repository. Its generated index, source scripts, vendor, manifests and tools are from that commit; remaining large assets are served from the existing tree. The game reports published build `48a71176c5a6`. This is not a rebuilt hybrid of old HTML and changed runtime scripts.

The first published full-hangar diagnostic (`master-full-hangar-headed`) reaches normal `ready` at 246.062 s, links 703 programs, and records twelve GL errors before the diagnostic error cap. It successfully uses its shipped stock cooks; the first audit full-hangar run re-baked stale stock cooks. In addition, GL draw-error tracing stops making its queries after the twelve-error cap. The corrected branch records no errors and continues tracing all draws. Those correctness runs therefore have unequal tracing overhead and stock preparation; their wall-time difference is **not a valid performance comparison**. A matched pair without draw-error tracing, with frozen stock assets on the audit side, is recorded separately.

`page_rig.js` now rejects a loading screen disappearance without normal ready evidence, an idle chain and no loader fail/error records. Diagnostic census runs may explicitly continue after that rejection to collect evidence, but report the failed health check and a nonzero exit status. A focused check covers timeouts, failed steps, unfinished chains and missing readiness evidence. The harness's navigation timer also includes time spent in its diagnostic navigation callback, instead of printing a misleading zero-second boot after the callback waited for loading. These changes improve measurement truthfulness; they are not claimed as game speedups.

### Conclusions that must be withdrawn or narrowed

The studio fleet experiment does **not** rule out a significant fleet cost in the actual full hangar. It accounts for six real bake misses in its own scene, but not the full hangar's reflection/shadow/light-layout and first-use program workload. Its result must not be used to dismiss the user's observation or to decide the player-fleet feature is cheap everywhere. Likewise, the one-third-town result concerns a cold studio/HOME setup on the kit backend, not near-town runtime or full-hangar startup. The corrected full-hangar baseline takes priority before further simplification tests.

The historical 6:15 and 9:15 measurements remain supported by the supplied log. The studio mismatch explains why the recent saved-state workload was lighter, but does not quantitatively explain every second of the historical gap. A driver-change attribution cannot be established without a controlled pre-update replay; the exported snapshot is also a later state. The original runtime on the updated driver is the proper current control, not a replacement for that historical evidence.

## Matched full-hangar timing pair, draw-error tracing disabled

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

## User-confirmed historical scene and stopping point

The user confirmed the original measurement was **Sandbox, Mosquito, large hangar**. They then switched to the medium hangar and experienced another huge lag. The snapshot exported later is not a record of that exact initial scene. Current saved-data replays at 5120×1271 are retained as a working browser reference; historical driver/profile differences are not being pursued further at this checkpoint. The user's later manual playtest remains the acceptance verdict. Fullscreen display and viewport should not be conflated: these visible-Chrome tests explicitly fix the render viewport to 5120×1271/DPR 1; they are not claimed as an independently verified F11 desktop-fullscreen session.

Next runtime acceptance should include the original meaningful actions: choose/load Mosquito, large-to-medium hangar switch, aircraft swap, cockpit entry, edited departure/return and a crash. Those should be measured as operations with continuous responsiveness, not inferred from a clean cold boot or a silent post-ready probe.

## Corrected full-hangar fleet-removal result

`audit-full-hangar-static-timing` uses the same visible-Chrome/full-hangar saved-state setup and no draw-error tracing. It passes normal loader health at **233.963 s**, versus **211.248 s** for the audit with six player-plane bake misses retained. Exactly three cooked prop records exist, no pending props, and every player-fleet capture/bake/queue counter is zero. The active edited/flown aircraft remains.

The static capture links 607 programs versus 655 in the player-prop garage census. Forty-nine player-control program instances (25 distinct source pairs) have no corresponding source pair in the static capture; the net link difference is 48 because there are substitutions too. The longest observed delay among the removed source pairs is 5.161 s, with the last pending/first ready bracket only 5.5 ms. These are not several removed independent thirty-second programs.

The expensive required coarse-ground, fine-ground and pavement vertex/fragment sources are byte-for-byte identical in both captures. Fine-ground completion is at page time 194.61 s with player props and 202.47 s without them; coarse ground completes at 150.13 versus 178.37 s. Consequently the removed preparation does not shorten the critical path in this pair. Driver queueing, compilation overlap and run variability are still present; this single pair does not establish that removing player props inherently makes the game slower. It does establish that a simple sum of removed per-feature elapsed durations predicts the wrong outcome here.

The static variant starts its final world-compile phase about fifteen seconds sooner, but that phase lasts 117.007 s versus 94.280 s, and garage compilation 19.014 versus 5.545 s. Both report normal ready, no loader fail/error records, and no later links/bakes in the thirty-second observation. These observations do not measure large-to-medium hangar switching, aircraft swapping, cockpit entry or crashes.

All experiments stop at this checkpoint as requested. The working browser reference is the current full-hangar saved-data configuration at 5120x1271, with the current WIP, rather than claiming to recreate the historical Mosquito/large-hangar state. The next substantial implementation should attack the required shader/world workload. A permanent removal of player props is not justified as a cold-loading fix by these results; the authorized switch remains available for the user's later manual comparison.
