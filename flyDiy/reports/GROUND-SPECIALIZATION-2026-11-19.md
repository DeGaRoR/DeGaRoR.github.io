# Bounded ground-shader prototype: rejected

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
