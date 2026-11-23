# Ground material/lighting split — 19 November 2026

Working diagnostic prototype on codex/wingsmith-performance-audit; not registered in the shipping loader. No visual feature has been removed. Image acceptance now passes in the tested cases. Cold compilation improved in both tested orders. Whole-game startup has not yet been improved by this prototype.

## What works

The original complete ground material recipe is separated from lighting. Two RGBA16F images carry linear colour/roughness and the world-space normal. The lighting reader retains the original lighting, shadows, atmospheric effects and output calculations. The source generator fails closed if its expected shader boundaries change.

### Cold compilation

RTX 3080, ANGLE D3D11, fresh browser profiles, shader disk cache disabled, programs issued individually. Two orders, not a statistical population or full-game load test. The compiler capture is the coarse-ground variant; image/render tests below use fine terrain.

| Program | Original order | Reverse order |
| --- | ---: | ---: |
| Original combined coarse ground | 33.329 s | 34.518 s |
| Complete material builder | 18.227 s | 21.214 s |
| Cached material lighting | 0.780 s | 0.747 s |
| Split total | **19.007 s** | **21.961 s** |
| Reduction for this program | **43.0%** | **36.4%** |

Evidence: material-cache/compile-result.json and compile-reversed-result.json under evidence/PERFORMANCE-2026-11-19/. The frozen compiler sources use world-space cache coordinates; the rendered prototype uses screen-space coordinates. The material builder is the same computation; the lighting reader differs in coordinate lookup. Do not present these as an exact same-source end-to-end test.

### Rendered acceptance

One real 160 m fine-terrain tile from the user's saved game, 256×256 render targets, overhead and oblique cameras. Controlled ambient [2,2,2] and first directional light colour [6,5,4], direction [.2,.8,.5]; the other captured lights and real world shadow maps remain present. Reference and candidate use identical test lighting. This is a controlled lighting fixture, not a claim to match the user's entire world view.

| View | Covered pixels | Mean absolute RGB error (0–255) | 99th percentile | Maximum |
| --- | ---: | ---: | ---: | ---: |
| Overhead | 65,536 | 0.00716 | 0 | 1 |
| Oblique | 24,272 | 0.00981 | 0 | 1 |

Both pass the predeclared mean ≤0.5 / p99 ≤2 limits. No GL errors. Deliberately inverting the cached normals produces a mean error of 23.718, correctly failing: the test is sensitive to normal errors. Reference/candidate/difference PNGs were inspected. These are linear render-target byte comparisons; the PNG previews are correspondingly dark.

Evidence: material-cache/session/accepted-result.json and accepted-*.png. No broad acceptance yet for other recipes, shores, snow, distance/detail transitions, terrain tiers or moving lights.

### Added GPU work

GPU timer queries at 5120×1271, twelve samples per path, alternating order, three warmups. One fine-terrain tile stretched across the viewport, controlled lighting as above. The split path rebuilds both material buffers on EVERY sample, then lights the result. No disjoint timers or GL errors.

| Path | Median | Range |
| --- | ---: | ---: |
| Original combined shader | 19.969 ms | 16.353–21.427 ms |
| Material builder + lighting reader | 19.504 ms | 16.265–20.143 ms |

Roughly equal in this bounded test; do not claim a game-FPS improvement. The material buffers cost **99.30 MiB** at this viewport, excluding depth and the final colour target. At 256×256 they cost 1 MiB. Evidence: material-cache/session/gpu-cost.json.

## Failures, cause and fixes

1. First image attempt: normal full-hangar boot 216 s, then shader linking failed. Captured SHADER_TYPE/SHADER_NAME headers conflicted with the headers Three adds for RawShaderMaterial. Strip those captured headers. Original failure preserved in material-cache/images/failure.json.
2. Second image attempt: normal boot 211 s, but a blank reference. Initial suggestions of a disabled fine disc or bad camera were **ruled out** in the retained session: fine radius 700 m; unlit geometry covers all 4096 diagnostic pixels; no GL error.
3. Exact cause of blank reference: GL INVALID_OPERATION, validation message “Two textures of different types use the same sampler location.” This Three build binds shadow maps directly from light state, outside the ordinary material-uniform dictionary. The raw probe had no directionalShadowMap entries, leaving shadow samplers at unit zero. Copying uniform needsUpdate flags alone did NOT fix it. Explicitly capture real shadow maps by matching each shadow matrix to its source light. This preserves light ordering and shadows.
4. Once bindings were fixed, coverage was complete but the saved lighting made linear-byte outputs almost black. Use a documented controlled lighting fixture; do not accept two black images as equivalent. Both original and candidate receive the same fixture.
5. The first retained-session geometry command had an expression-wrapper syntax error from a trailing semicolon. The cheap corrected command passed without another game load. External probe page text now strips that final semicolon at the wrapper boundary.

The successful retained game session loaded normally in 214 s. It was used for all diagnostics and image/runtime checks, then closed and the GPU lock released. Its load time measures the existing audit build, not this inactive prototype's startup benefit. Background game rendering continued during GPU-query tests; queries enclose only the explicitly tested draws.

## Integration boundary and next work

The prototype currently obtains source from an already compiled reference. Production must generate the two programs BEFORE the original combined compilation, then replace its loading/render path. Otherwise there is no startup saving. That integration is not done.

This is a camera-dependent screen cache. Camera, recipe, geometry, weather and relevant material inputs require rebuilding; it is not a once-per-world baked map. Persistent world tiles need a separate resolution/filtering/LOD/invalidation design and image checks. Captured view-space light uniforms are suitable for this fixed diagnostic only; production must use the renderer's live lighting state.

Next: implement pre-compilation source generation and a query-flagged render integration, measure whole-game readiness and departure, then check the remaining terrain families/recipes and moving-camera behaviour. Keep all visual features. No default enablement or publication based only on this diagnostic.
