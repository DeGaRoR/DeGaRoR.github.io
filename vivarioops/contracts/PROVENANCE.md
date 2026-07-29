# A0 — resolved dependencies and reference commits

Recorded at session A0, 2026-07-29. **03 §6 must be updated in the spec set to match
this file** — its table still shows the pre-A0 placeholder versions.

## Pinned exactly, lockfile committed

| Dependency | 03 §6 said | Actually resolved | Integrity |
|---|---|---|---|
| `@dimforge/rapier3d-compat` | 0.14.0 | **0.19.3** | `sha512-mMVdSj1PRTT108s9Swbu2GQOmHbn8kbJANRV5xfczL3s0T4vkgZAuoMRgvBzQcHanpKusbC0ZJj6z3mC3aj3vg==` |
| `three` | 0.169.0 | **0.185.1** | `sha512-5aojFCXKwnjBRZvUnt3WFfEcvUJgkN5LlijRFN95hMy8WVkG4I0QNcJE+OuWvuJ0bOdStrbfXn0pkd6/QyiAlg==` |

03 §6's A0 action says to resolve the actual latest stable, which is what these are.
No caret ranges. `package-lock.json` is committed.

## Reference repositories — commit SHAs

| Repo | Licence | HEAD at A0 |
|---|---|---|
| `mycoolfin/the-simsulator` | MIT — may adapt with attribution | `bd428a1303c335b794cd45400a69ade194ebd0f8` |
| `jobtalle/PredatorPreySystem` | MIT, (c) 2018 Job Talle | `068ef7fb78e6140b3ca65347e9feb377a41da4bc` |
| `SebLague/Boids` | MIT | `fdda4db1368df92fbacd8a644bbe6dc61d705441` |

## Rapier `enhanced-determinism`: NOT EXPOSED

Checked against the published `@dimforge/rapier3d-compat@0.19.3` package. Every
occurrence of the substring `determin` in the tarball is the English word
*determine*/*determines*, in `control/character_controller.d.ts` and
`pipeline/physics_hooks.d.ts`. There is no API surface, no init option, and no
alternative build.

`enhanced-determinism` is a Rust cargo feature compiled into the wasm; the published
build does not enable it and exposes no runtime toggle.

**Consequence: 01 §5 stands unrelaxed.** Cross-device physics determinism remains
unpromised. L1 and L2 are same-device, same-build. L3 remains deterministic everywhere
because it contains no solver. A shared specimen must continue to carry its compiled
record, and a local recompile must be surfaced as "recompiled locally".

Recheck at step F if the slice proves out; do not architect assuming it will change.
