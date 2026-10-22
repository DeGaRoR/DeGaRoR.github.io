# DMG-DAMP evidence (G1885-G1889)

The deformation damper takes deformation, not rotation (the independent review's D1, the user's ruling 2026-10-04).
The whole account is HANDOVER.md, entry "G1885-G1889 DMG-DAMP"; this folder is its evidence.

- `L_<build>.svg` - |L| / L0 about the CG in vacuum (the air at 1e-9, no world), each validated build spun at 1 rad/s
  about roll (solid), pitch (dashed) and yaw (dotted) for 10 s: blue = before (the pre-G1885 damper, `params.defDampMean`,
  the base core to the bit), orange = after. Before: exp(-0.5 t) on all three axes. After: kept to 1e-4..2e-4 (the same
  drift with the damper off). Made by `node tools/dmgdamp_evidence.js --no-modes --no-perf`.
- `modes.json` - the flown modes of the five validated builds, before / after, the stick fixed at a probe trim (1.6 Vs,
  1000 m); every signal the kicked flight minus an unkicked one from the same trim. `node tools/dmgdamp_evidence.js
  --no-L --no-perf` (~25 min).
- `perf.txt` - the stock build's sim.step(1/60), the median of 15 processes' medians (600 steps): the base core, this core
  on the old formula, this core; the Cub and the metal Cessna, ground and air.

## The flown modes, before -> after

| build | V trim (m/s) | dutch roll T (s) | dutch roll zeta | dutch t1/2 (s) | roll-rate tau (s) | yaw-rate t1/2 (s) | pitch-rate t1/2 (s) | spiral |
|---|---|---|---|---|---|---|---|---|
| Cub (corrected) | 26.1 | 3.30 -> 3.20 | 0.358 -> 0.241 | 0.95 -> 1.42 | 0.091 -> 0.095 | 0.33 -> 0.42 | 0.17 -> 0.18 | T2 10.3 s -> T2 8.8 s |
| Jodel | 30.2 | 2.60 -> 2.50 | 0.271 -> 0.179 | 1.02 -> 1.52 | 0.119 -> 0.126 | 0.32 -> 0.37 | 0.18 -> 0.22 | T1/2 10.0 s -> T1/2 54.2 s |
| metal Cessna | 35.8 | 2.60 -> 2.53 | 0.293 -> 0.198 | 0.94 -> 1.39 | 0.125 -> 0.133 | 0.28 -> 1.23 | 0.17 -> 0.18 | T2 20.9 s -> T2 14.4 s |
| Cessna on floats | 41.2 | 2.57 -> 2.53 | 0.274 -> 0.180 | 0.99 -> 1.53 | 0.123 -> 0.131 | 0.30 -> 1.30 | 0.20 -> 0.22 | T2 23.0 s -> T2 15.6 s |
| twin on floats | 26.2 | 3.20 -> 3.10 | 0.369 -> 0.256 | 0.89 -> 1.29 | 0.114 -> 0.121 | 0.33 -> 0.40 | 0.13 -> 0.15 | T2 10.0 s -> T2 8.5 s |

The gate-by-gate census (every flying gate's output, base 4ca0678c vs this branch) is in the HANDOVER entry.
