# Individual shader and preparation breakdown

Uses existing captures only. Control: RTX 3080 after driver update, saved Cessna, 5120 × 1271, startup clock to readiness 191.822 seconds. No new browser run.

## What the timing means

Each WebGL program combines a vertex shader and fragment shader. The inventory records both source identities. There are 620 linked program instances, not 620 independent visual effects. Light layouts, material features, geometry attributes, render passes, and material cache keys create variants.

The per-program delay is from submission to the first observed completion. Compilation runs in parallel; delayed polling and unrelated main-thread work can inflate this interval. These intervals cannot be added or interpreted as time recoverable by removing a shader. True exclusive per-shader compiler times were not captured. Blocking GL-call time is a separate column and also does not include asynchronous compiler work.

## Most conspicuous individually identified programs

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

## Aircraft skin variants

| Emitted shader name | Program instances |
|---|---:|
| aeroskin:scuff | 16 |
| aeroskin:scuff:live:eye:band | 12 |
| aeroskin:scuff:live:eye | 10 |
| aeroskin:band | 3 |
| Total aeroskin | 41 |

Other named families: flown 24, matlib 15, char 8, animal 6, water 2. There are 501 unnamed program instances; full vertex/fragment identities are retained. A reliable mapping of those to individual scene objects requires further instrumentation, not guessing names from their size.

## Preparation phases in the same full-startup capture

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

## World generator detail — separate focused run

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

## Complete inventory

[All 620 programs](evidence/PERFORMANCE-2026-11-19/shader-bill/individual-programs.csv), with phase, submission time, observed completion, blocking GL calls, source sizes and exact vertex/fragment source identifiers. Regenerate with tools/perf/export_shader_inventory.py.

Next useful measurement: map unnamed programs to materials and scene objects, and distinguish compiler readiness polling from main-thread gaps. The current evidence supports prioritizing terrain/pavement compiler complexity and aircraft variant repetition; it does not support assigning an exclusive savings estimate to each visual feature.
