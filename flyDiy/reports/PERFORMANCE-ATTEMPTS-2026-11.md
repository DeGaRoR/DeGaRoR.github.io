# Performance attempts: avoid repeating rejected experiments

Branch: `codex/wingsmith-performance-audit`. Default remains visually unchanged unless a retained fix is explicitly identified. Experiments below are not cumulative wins. Consult this index before spending another GPU slot on the same idea.

## Rejected, inconclusive, or diagnostic-only attempts

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

## Retained work, with the limits of its claims

- Terrain patch neighbour caching: 71,148 exact comparison checks pass; reduces repeated CPU work without changing the shape.
- Aerodrome generation yields: reduced a measured maximum generator task from about 7.2 to 2.5 s, without reducing geometry. Total generator work remains about 32 s.
- Correct village lamp signature during early prelinking: obsolete two-point variants avoided when the final world needs ten. Studio comparisons saved about twenty seconds. Corrected full-hangar master→combined audit pair is 243.853→211.248 s (~13.4%), not an isolated attribution to this change alone.
- Shadow-sampler array fallback fix: confirmed wrong comparison mode; corrected validation captures report no GL draw errors. This is a correctness fix, not by itself a proven loading win.
- Earlier exact fine-terrain submission (`fineprelink=1`): 189.653 / 178.721 s versus 201.579 s control, with considerable spread. Opt-in; shader source unchanged. No broad fixed saving claim.

## Measurement traps discovered and corrected

1. A copied `garageStudio=1` state omitted the full hangar and bypassed its compile step. Studio and full-hangar results must be labelled separately. Census tool now defaults explicitly to the full hangar; `--studio` is opt-in.
2. `BOOT.state==='gone'` can mean a watchdog timeout. Require normal ready, no fail/error records, and an idle chain. `page_rig.js` now checks this; diagnostic continuation is explicitly unsuccessful.
3. A navigation callback consumed loading time before the rig started its timer, printing zero seconds. Timer now starts before navigation. BOOT timestamps remained the report's measurement source.
4. Draw-error tracing stopped querying after twelve errors on the broken build, while a corrected build continued querying every draw. Those correctness-run timings were unequal; separate draw-tracing-off comparisons are required.
5. Broad build/source fingerprints invalidate pre-generated stock aircraft after unrelated audit edits. Published-versus-audit timing used frozen stock assets on the audit side. Do not generally accept stale assets or attribute their re-bakes to the published game.
6. The first simulated edited departure sometimes stayed at page sim time zero while worker messages continued. It occurred with the lamp optimization enabled and disabled. Not a passing iteration test and not yet a general game defect without independent reproduction.
7. The new manual log shows a 49 s shader stall before the rollout panel, which itself reports only ~0.2 s. Measure from actual input to advancing flight, not panel duration.

## Current baseline and next work

The user retired the old 6–9-minute launch as the active target after a fresh playtest: studio 2:56, studio off 1:22, a further 19 s until no lag, departure 54 s, return ~2 s. See [manual retest](MANUAL-RETEST-2026-11-19.md). Keep historical evidence; do not chase old driver/profile differences unless they recur.

Primary priority is actual world/shader work reduction, followed by fast edited garage/world round trips. Studio→garage→world staged loading is planned, but must not merely move blocking work behind an interactive studio. No visual feature reduction without scoped argument and user consent. No generated main-page commits or deployment from this audit.

Current structural prototype: `src/viewer/ground_material_cache.js`, not registered in the shipping loader. It splits material construction from lighting, with two half-float material outputs. See [material-cache evidence and limitations](MATERIAL-CACHE-PROTOTYPE-2026-11-19.md). It is not yet a production cache or a startup win.

Update after the user's request to persevere: rendered checks now pass for one fine tile in overhead/oblique controlled lighting (maximum 1 RGB byte difference; inverted-normal negative control detected). Isolated coarse-program compilation improved in both orders: 33.329→19.007 s and 34.518→21.961 s. GPU cost was roughly unchanged in a full-viewport terrain-only test, with 99.30 MiB additional material buffers. Production pre-compilation source generation/render integration remains next. Earlier failed probes are historical, not the current final acceptance status.
