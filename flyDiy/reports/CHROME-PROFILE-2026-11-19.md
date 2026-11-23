# Actual Chrome profile and invalid shadow-sampler warm-up

Branch: codex/wingsmith-performance-audit. Original saved designs/settings were not cleared. No deployment. All visual features retained.

## Saved Chrome state

Opened the user's existing Chrome profile and the published Wingsmith build 48a71176c5a6. Exported only this game's flydiy.* localStorage entries through DevTools: 91 keys, including 21 saved designs, fleet/player documents, stored premises, graphics, world-look and material settings. The fixture is private, outside the repository. Do not commit it or copy the entire browser profile. Authentication, history and unrelated site data were not exported.

The current saved profile has the black studio enabled. The observed published-page session displayed the career/story interface, so it is not a controlled sandbox comparison. Its internal boot log reached gone at 144.630 seconds; Chrome's tab UI later reported 5.7–6.4 GB. Those figures are observations, not proof of a memory leak or a comparable sandbox timing. DevTools and UI interactions also make it unsuitable for a formal speed benchmark. The previous evening's 6–9-minute preparation was not reproduced in that observation.

The complete flight-recorder download was blocked by Chrome's multiple-download permission. That permission was left unchanged. The successfully exported game-state snapshot includes the internal boot log. The original test window was closed before isolated GPU work resumed.

## Isolated sandbox replay

Replayed the 91 game entries on localhost with mode=sandbox and the real RTX 3080. This copies game localStorage, not IndexedDB, browser caches, extensions or the original process's history. The copied storage changes only inside the disposable test profile. Graphics error tracing adds overhead; timing is diagnostic rather than a speedup benchmark.

The replay reproduced repeated GL_INVALID_OPERATION (1282) on the aircraft skin/glass programs. The first captured errors were in the boot's worldCompile interval, while asynchronous preparation also draws stand-ins. The first replay reached gone at 216.678 seconds; it does not reproduce the old nine-minute preparation either.

Evidence: chrome-profile-replay and chrome-sampler-bindings under reports/evidence/PERFORMANCE-2026-11-19. Full shader sources, material attribution and the offending bindings are retained.

## Confirmed invalid binding

Three captured offending program families are MeshPhysicalMaterial aeroskin:scuff (glass and live skin variants). Their active directionalShadowMap sampler is SAMPLER_2D_SHADOW (35682), but its bound 2D texture has TEXTURE_COMPARE_MODE = NONE (0). A comparison sampler requires comparison mode; the driver reports the mismatch.

In pinned three@0.186.0, WebGLUniforms.setValueT1 configures emptyShadowTexture.compareFunction before substituting a missing single shadow texture. setValueT1Array substitutes the same fallback for missing array elements but omits that configuration. Early warm draws can encounter missing shadow-map array entries before real maps exist. This explains the observed invalid fallback bindings.

Invalid warm-up draws are a correctness problem and can undermine the intended first-use preparation. The captures do not establish how much of the user's minutes-long freezes they cause. No exclusive savings estimate is justified.

## Fix and rebuild ownership

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

## Separate finding

The published console also reported ReferenceError: rockSync is not defined during the world's after-build hook. The branch source has two rockSync callers and no definition. This can abort the remaining work in that hook and is a separate correctness issue; it was not silently bypassed or treated as a visual optimization. Fixing it needs its own scope and validation because restoring omitted world setup may add work.
