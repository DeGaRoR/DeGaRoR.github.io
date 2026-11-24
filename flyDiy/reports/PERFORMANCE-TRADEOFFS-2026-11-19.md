# Performance choices: what to bake, simplify, or retain

> Scope correction, 19 November: the game-state snapshot used in these comparisons has `flydiy.garageStudio=1`. These are studio-garage tests; the full hangar is not constructed and its main compile step is bypassed. The paired comparisons remain internally useful, but they must not be presented as reproductions of the historical full-hangar 6-9-minute startup. A visible-Chrome full-hangar replay is recorded separately in `BASELINE-RECONCILIATION-2026-11-19.md`.


Local audit branch; nothing deployed. Visual changes below are proposals unless explicitly identified as an authorized diagnostic. Measurements are RTX 3080 / Chrome / ANGLE D3D11 after the driver update. The private game-state replay excludes IndexedDB and the original browser process/cache. It is not an exact reproduction of the historical evening session.

## What is paying the bill

The saved-state run with corrected lamp prelinks reaches readiness in about 195 seconds. Its world-compile phase is about 69 seconds, world construction about 35 seconds, and scene settling about 30 seconds. Snapshot, active-aircraft baking, parked preparation, forest growth and first-use draws also cost seconds each. These are phase wall times with overlapping compiler jobs. They are not independent feature costs that can be added as promised savings.

The ground, fine ground and pavement are particularly expensive individual programs. Prior isolated cold links took roughly 28Ã¢â‚¬“31 seconds each, versus roughly 90Ã¢â‚¬“105 seconds of overlapping submission-to-completion delay in the full game. This supports both shader simplification and reducing competing/redundant compilation. It does not support adding three link delays to promise a 270-second saving.

The corrected lamp-layout preparation already saved about 20Ã¢â‚¬“22 seconds in controlled runs without visual changes. Early exact fine-ground preparation is a separate opt-in scheduling experiment, not a simpler shader.

## Priorities and visible scope

| Priority | Proposal | What changes for the player | Evidence and realistic scope of benefit |
|---|---|---|---|
| 1 | Three shipped static parked aircraft; no player-plane captures/bakes | Parked scenery uses a Cub, Cessna and Jodel, not the player's saved designs | Explicitly authorized as a test. Six player-plane bake misses in the evening log each took about 24Ã¢â‚¬“25 s elapsed, overlapping; repeated captures also occur. Actual end-to-end saving is being measured, not inferred by summing them. |
| 2 | Bake static terrain and vegetation fields/tiles | Can retain the intended shape, shoreline and distribution within a declared sampling tolerance | Targets part of the ~35 s world build and ~30 s settle, plus later streaming. Larger engineering change, but more promising than repeatedly optimizing tiny lake-mask setup. |
| 3 | Replace large portions of the ground/pavement procedural shader with baked unlit material data | A hybrid can preserve near detail; a more aggressive version changes close-up blending, repetition and slope appearance | Targets the dominant compiler family and per-frame ground shading. The ~56Ã¢â‚¬“89 s world-compile phase is the relevant current opportunity, not a measured saving. Needs isolated source test plus full-load A/B and slope/shore/runway visual comparisons. |
| 4 | Fewer town details, shorter detailed-town reach, shared simpler materials | Less distant detail/variety; possibly fewer decorative objects and lamps | World generator measured ~7.25 s premises terrain patches, ~6.86 s aerodromes and ~5.10 s road-bucket work in a separate CPU profile. Some settling is town-related too. These categories are mixed; they are not all removable town cost. Reducing house count alone does not remove the ground/pavement shader compile. |
| 5 | Rationalize aircraft mode programs and capture light layouts | Some merges can retain visuals; baked-only nearby aircraft would soften fine detail | Current saved-state census has 34 named aeroskin and 16 named flown-bake links. These are not 50 interchangeable programs. About ten duplicate-source groups involve these families, after removing only the diagnostic shader-name line. Other variants genuinely differ. |
| 6 | Texture residency/atlas cleanup and compressed pre-generated aircraft assets | Can retain appearance; reduced texture resolution would need separate acceptance | Helps memory, decode/upload and recurring hitches. Ground libraries already use packed layers/KTX2. A blanket compression pass does not explain or solve a 99-second shader wait. |
| 7 | Atmospheric evaluation in fewer passes rather than in every material | Could alter transparent surfaces, edges and cockpit fog if implemented aggressively | Much of atmosphere code and map storage is already shared. Shared source is still compiled into many separate material programs. Moving more to one depth-based pass could reduce repeated compiler work, but transparency requires explicit design and visual testing. |

## Terrain: are lakes, slopes and vegetation already maps?

Partly. The existing code has considerably more precomputation than a purely procedural implementation:

- Island inputs already contain raster fields for elevation/land classes/canopy/coast/lakes. Lake-bed construction builds compact distance/ownership masks. A source comment reports about 40 ms and 0.67 MB for Jolene's lake masks; that is historical source documentation, not a new measurement.
- `20_world.js` memoizes exact terrain coordinates and uses the premises' lazily cooked terrain raster. The documented raster tolerance is 1 cm. The final height still composes lake carving, premises modifiers, stones and weather-dependent strip wear.
- Fine terrain generates tile vertices from the composed height and computes normals with multiple nearby height samples. It also stores coarse height/normal attributes for its edge morph. This geometry work is different from fragment shading.
- Ground material sets are already packed offline into array layers, with KTX2 support. Macro colour and classification maps exist. Near surfaces still use substantial height blending, hex tiling, triplanar projection, procedural micro-fields, normal/roughness work and atmosphere.
- Vegetation reads the same ground micro-fields and biome rules on the CPU so its distribution and tint agree with the rendered ground. Forest masks, instanced geometry, LOD and impostors already exist. Placement, slope tests, exclusion/polygon rules, shoreline bands and chunk construction still involve repeated work.

Therefore "put it in a map" is a good direction, but it should identify which result to store. Storing a classification mask does not eliminate evaluating the final material; storing height does not eliminate constructing mesh topology and uploading buffers.

### Recommended bake boundaries

1. **Base world tiles:** final static heights, normals/slope, lake ownership/level/shore distance, biome weights and exclusion masks. Key by actual terrain/premises/recipe dependencies. Ship the default world; recompute only changed local tiles after edits.
2. **Vegetation plans:** deterministic positions, species, scale, tint and collision metadata per chunk, keyed by the same fields and vegetation recipe. Reuse these lists across LODs. Keep wind animation, visibility/LOD selection and actual local edits dynamic. This can preserve population rather than merely reducing density.
3. **Material tiles:** unlit albedo, normal and roughness/material weights for stable ground composition. Preserve a small reusable near-detail shader, with simpler distant terrain. Keep illumination, moving shadows, weather wetness/snow and local scars separate. Do not bake sunlight into base colour.
4. **Precision:** compare the rendered surface and physics against the same authoritative composed surface, especially runway edges, lake levels and steep banks. A low-resolution whole-island image is not an acceptable replacement for wheel-contact geometry. Use tiled resolution and border handling, not one giant texture.

This exchanges compute for storage, transfer and memory. For scale, one 1024Ãƒ—1024 float32 height tile is 4 MiB before compression, before normals and other fields. Resolution and residency need budgets. Bake only deterministic inputs; retain weather-dependent wear and edited areas as local overlays or invalidated tiles. Baking cannot be called lossless until its sampling tolerance and seams pass comparison.

## Parked versus flown aircraft, and fiche pictures

These are separate systems:

- **Parked props:** `parked.js` supports offline cooked stock aircraft and player-specific bakes. The evening published-session log loaded stock Cub/Cessna/Jodel/Chinook assets successfully, with actual decode calls around 27Ã¢â‚¬“67 ms; their 4.8Ã¢â‚¬“10.3 s total load intervals include fetching/waiting and overlap. It also captured and baked six saved player designs, with repeated captures.
- **Audit build caveat:** stock cook signatures include the broad `FLYDIY_BUILD` and `parked.js` source. Reconstructing the branch invalidates the shipped stock cooks and falls back to live capture/bake. This affects both sides of our same-build comparisons. It must not be presented as proof the published evening game re-baked those stock planes. A narrower dependency fingerprint plus a release asset check is preferable to accepting all stale assets generally.
- **Static-trio test:** only the three shipped Cub/Cessna/Jodel asset records are loaded. Parked placement keys are mapped to those props; player fleet queues/capture/bake paths are disabled. The diagnostic deliberately uses the fixed manifest/container signatures rather than rejecting the three frozen props for an unrelated running-build change. Container identity is still checked; missing assets must not trigger a live capture fallback. This is an opt-in test, not the normal cache policy.
- **Your flown aircraft:** `flown_bake.js` already bakes albedo/normal/material atlases, with 2048 exterior and interior settings, and folds geometry to reduce draw calls. Close and cockpit views retain live detail, and the transition band can use both sets. Baking everything away would lose close-up detail and cannot replace deformation/controls/glass with a static prop.
- **Fiche:** the full six-view fiche is generated when requested/awarded and stored in IndexedDB. It is not automatically regenerated for every startup. Its cutaway and studio preparation can be costly at that operation, but no present evidence makes it the main cold-boot cost. The separate small side thumbnail is cached by saved-design hash; stock thumbnails/heroes are pre-generated. Instrument an actual fiche generation before removing views for startup performance.

## Which aircraft variants could merge?

Good candidates for further controlled investigation:

- Programs with identical complete vertex/fragment source except `SHADER_NAME`, where separate hook/material keys currently prevent reuse. The current capture has about ten duplicate groups involving flown/aeroskin programs. This is a link-count opportunity, not a ten-times-eight-second speed claim. An earlier shared-intact-key experiment did not establish a loading improvement.
- Near/eye/far zone distinctions that only govern visibility or folding should not create distinct GLSL unless shader behavior actually differs. Preserve zone geometry and visibility even if program identity is shared.
- Plain and hybrid-band variants could use a shared uniform-controlled fade path. This trades fewer programs for a branch/discard path in the ordinary case and must be timed on the GPU.
- Damage-asleep and damage-awake variants could potentially share a shader controlled by a uniform. The current design intentionally removes the damage block from intact aircraft, and precompiles both modes to avoid a first-crash link. A common program would increase intact shader work; it is not automatically faster overall.
- Reflection/capture and flight lighting layouts should agree wherever mathematically equivalent. The lamp-layout fix is a proven example. A separate reflection zero-light-padding experiment reduced links but did not improve total readiness and remains disabled.

Do not indiscriminately merge opaque skin, transmission glass, skinned/rigid geometry, shadow-depth passes or different output colour spaces. Those distinctions can change the result or required inputs.

## Do fog and cloud systems share shaders?

They share code and data, not one universal linked program. `ATMO` provides common aerial-perspective and mist GLSL; cloud composition reuses it. Cloud shadows occupy the shared atmospheric atlas, avoiding another sampler on already-full ground materials. Cloud noise is already GPU-baked to 3D textures, and shadow transmittance is baked into the atlas. Forest mist bakes a world map into that atlas too.

The current forest-mist default is the veil (`c`), despite an outdated introductory "off by default" comment: the executable preference logic enables it unless stored off. The optional mist-in-cloud-march path shares the march; the card technique uses its own instanced draw/material. Cloud march, composite, history, shadow and noise-bake passes have different jobs and distinct programs. Their common helpers can still enlarge many compiled ground/aircraft material variants. Before removing any mist system, measure the incremental compiler and GPU cost of each path at the same weather and camera.

## Crash calculations: what share?

There is no trustworthy crash-physics-only percentage in these logs. Damage/contact/debris work is not separated into one exported timer. Zero in the page `solver` column does not mean zero physics when a worker runs; worker step time is reported separately as `wms` and is not directly additive to page time.

One concrete evening frame records **99.738 s of page work, of which 99.478 s is attributed to shader work** (roughly 99.7%), while its reported worker step metric is about 5.96 ms. This is a cockpit frame (`STOPPED`, running/manual); the data does not label it as a crash. It demonstrates a catastrophic graphics-preparation stall, not a 99-second crash solver step. Other large scene/render stalls still need attribution.

For crashes, profile contact/structural solver work, damage mesh/scuff updates, debris and first-use damage rendering separately on a fixed scripted impact. Preserve damage effects while ensuring every actually drawn damage/cockpit/cut/light combination is prepared. Disabling crash physics would be a poorly supported first sacrifice from the current evidence.

## Suggested decisions after the static-prop test

First decide whether losing personal parked designs buys enough time/responsiveness. Then prioritize a versioned static-world tile/vegetation bake and a hybrid simplified ground/pavement material. For a smaller visual sacrifice, test reduced distant town detail and fewer decorative local lamps while retaining the active field and nearby buildings. Reducing fiche views and broad texture downscaling rank lower until measurements identify them as bottlenecks.

Keep cold usable-garage time, cold first departure, edited round trip, cockpit entry, scripted circuit and scripted crash as separate acceptance cases. Moving work later is not a reduction in total cost; smaller link counts are not sufficient acceptance either.

## Resource census from the early-fine repeat

After readiness, scene-referenced materials held 393 distinct texture objects (49 compressed) and 4,629 distinct geometries. Their unique CPU ArrayBuffer backing stores totalled about 871 MiB. This is not total process or GPU memory: it excludes unreferenced caches, some render targets and other systems, and backing stores can include more data than a given geometry's view. Several material arrays already use compressed 512px layers; a 3095×3920 uncompressed colour image and a 4096×2048 image also appear. Inspect ownership and duplicates before globally reducing all textures. The static-trio comparison will use this same inventory to show whether player props materially affect residency.

## Follow-up: alpha-splat specialization and vegetation tint

The splat's blend counts are uniforms (`uSNearN` / `uSFarN`, normally 3). There is already a compile-time `SPLAT_ONE` specialization when both near and far use one set. The saved gamer setting is `far1`, which retains the general near/far material chain. A partial runtime restriction does not necessarily shrink that compiled chain. Several earlier compiler-specific changes are documented in the source: uniform-bounded loops and fewer sampling call sites avoid expensive D3D11 inlining, and a previous extra rock sampling chain added about 15 seconds per ground link in the source's historical measurements. This is a strong architectural reason to specialize capabilities, not just turn visual dials down.

Recommended replacement design: one bounded capability profile for the active world recipe, with compile-time exclusions for unused third detail/global layers, unused height blending/recolour modes, and unused rock/micro/puddle paths. Bake stable large-scale blend weights and grading into fields; retain local texture detail and dynamic weather in a shorter shader. Recompile under a visible preparation step only when an edit enables a new capability; ordinary numeric colour/weather changes should remain uniforms. Do not generate a unique shader for every terrain tile or colour value. First compare exact enabled-feature output and cold source/link complexity, then full-load and near-ground GPU time. A lower runtime quality dial alone may leave nearly the entire compiler cost intact.

Vegetation tint is also a concrete bake candidate. `trees.js` composes species/master/kind/shadow-match values on the CPU in `retint`, but fragment GLSL still applies hue rotation, saturation/lightness and flattening terms; flowers have a similar hook. Stable final art-direction transforms can be pre-applied to the albedo sheets or combined into a precomputed colour matrix/offset, removing repeated hue sin/cos/matrix construction from shader source. Baking post-texture nonlinear/clamped transforms can differ from transforming a filtered sample, so check edges/mips and matching geometry/impostors. Preserve alpha/data maps, leaf translucency, moving lighting, cloud shadows, weather and any seasonal control separately. This is not yet a measured end-to-end saving.

The town review also found a correctness gap: `cityBuild` synchronizes changed seeds only for currently present plots; it does not hide pack plots absent from the record. A partial-town fixture can therefore retain full-town packed houses. The first reduced-fixture/city-host run is excluded from reduced-town acceptance. Matched `cityhost=0` tests use the existing kit path, which filters instance rows against present plot IDs. Repairing the default cooked-city reconciliation and properly trimming its assets remain follow-up work; merely hiding missing plots would not remove their allocation or decode cost.

The saved ground recipe contains sixteen override rows: seven have one near texture, two have two, and seven have three. Far overrides have zero/one/two named textures, with absent far slots inheriting near slots before the graphics limit is applied. The effective `far1` setting forces the extra far slots off. Thus stored null far entries alone are not proof that third-layer code is unused, and removing every third near layer would visibly change seven saved rows. Extend the existing compile-time specialization rather than claim it does not exist. The source also documents substantial earlier optimization work; the present issue is accumulated complexity and coverage, not the absence of all best practices.

## Authorized simplification results

The static-only aircraft test and actual one-third-town test are complete; see `STATIC-PROPS-AND-TOWN-2026-11-19.md` for matched controls, limitations and resource counts. Static props reached readiness in 180.615 s versus 181.930 s with player props retained and valid stock cooks: no meaningful startup gain established in that pair despite 49 fewer links. The compact town reached 173.869 s versus 172.495 s for the full town on the same kit renderer, with identical 334-program counts. Neither visual sacrifice is presently justified as the primary cold-loading fix. Near-town FPS, sustained garage responsiveness and crashes still need their own tests; these boot measurements do not settle those cases.
