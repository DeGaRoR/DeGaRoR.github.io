# DMG-NOSE (G2013-G2015): the crushable nose, and the nose's 9 g at either corner on the certificate

Made by `node tools/dmg_nose_evidence.js --base <base tools/> --before <json> --after <json>` (node only; `--replot` redraws
from `traces.json`). Before = `claude/dmg-integration` d3d5e24 (DMG-DRIVE + DMG-WINDBREAK merged), flown with GATE DMGWIND's own
`--part` runs (the Jodel's and the metal Cessna's offsets with the same staging: that part of DMGWIND flies the Cub only).
After = this branch, GATE DMGNOSE's `--json`. Staging = DMG-WINDBREAK's (`tools/_dmg_wind_lib.js`): settled 2 s in the wind,
started at 3.6 m/s with the throttle shut, a 0.3 m trunk 6 m ahead. That meets the trunk at ~3 m/s, the page's impact speed.

- `crush_curve.svg`: the nose's force against its crush depth, per build. The spinner crushes as a cone (Alexander's shell
  load at its local diameter), then the propeller at its hub (the blade roots; dashed: after a separation, a lost blade's
  share less), then the nose bowl; past the stack the engine block itself (core). The dashed grey line is what the mount is
  certified to carry on the nose (9 g / 1.5 of the whole aeroplane). The dot is where the calm 3 m/s hit stopped.
- `mount_worst.svg`: the worst engine-mount member's force over its certified limit. Top: one run, the Cub at 2.5 m/s from
  30 deg. Before, the crankcase stand-in CGE-ENGR folds round the trunk at 0.1 s and all 10 mount members go. After, the mount
  holds at 0.54 of its limit and the nose crushes 19 cm. Bottom: every run at the impact speed (49 winds + 19 offsets a
  build), before and after; red means the mount came off.
- `sweep.svg`: the grids, winds 0-10 m/s from 12 directions, plus the trunk moved across the nose (the strip, no wind),
  before and after. Mount off before / after, winds and offsets: the Cub 17/49 and 11/19 -> 0 and 0; the Jodel 0/49 and
  2/19 -> 0 and 0; the metal Cessna 4/49 and 8/19 -> 0 and 0.
- `gate_dmgnose.txt` / `.json`: GATE DMGNOSE on this branch, PASS 41/41.
- `battery.txt`: the targeted battery's verdicts on this branch and what moved against the base (`battery_run1.log`,
  `battery_run2.log`, `dmgcertcost.log`: the runs themselves).
- `off_bytes.txt`: damage OFF, LOAD / BENCH / UISMOKE / BUILD / JOIN against the base, byte by byte (timings masked).
- `perf.txt`: the step's A/B, nothing touching (alternating processes).
- `summary.json`: the counts above. `traces.json`: the top panel's substeps (every other one).

## The stack's numbers (GEN_NOSE, `src/core/33_drive.js`)

| what | value | source |
|---|---|---|
| shell crush load | P = 6.08 σ0 t^1.5 √D | Alexander, Q. J. Mech. Appl. Math. 13 (1960) 10-15, as recalled |
| spinner | spun 6061-T6, 0.032 in; σ0 = (F_ty 35 + F_tu 42 ksi) / 2 = 265 MPa | MIL-HDBK-5J, as recalled; the gauge as recalled (0.025-0.050 in in service) |
| spinner shape | radius = spinner.dia × R, length = spinner.len × its radius (the spec's own) | the build |
| nose bowl | 5052-H32, 0.032 in; σ0 = (23 + 31 ksi) / 2 = 186 MPa; D = the cowl's width at the engine | MIL-HDBK-5J as recalled; the spec's cowl |
| bowl depth ahead of the crankcase | 8 cm | GAME |
| hub protrusion ahead of the flange | wood 12 cm, carbon 10 cm, alloy 7 cm | GAME (a wood hub 4-5 in thick, a forged alloy one 2.5-3 in, as recalled) |
| blade root | wood: MOR 114 MPa (yellow birch), Z = c t²/6; alloy: F_ty 255 MPa (2025-T6), plastic Z = c t²/4; carbon 600 MPa GAME | Wood Handbook FPL-GTR-190 Table 5-3a, MIL-HDBK-5J, as recalled |
| root thickness / chord, arm | wood 0.40, alloy 0.15, carbon 0.30; arm = 2 × the root station | GAME |
| a separation | the prop layer × (blades − bladeLost) / blades | DMG-DRIVE's bladeLost (0.35 of a blade) |
| core | the node contact's spring and damper (1.5e4 × m), unloading at 10 × (DMG-WINDBREAK's TK_RU) | the solver's own law |
| friction on bark | μ = 0.3 | GAME (dry wood on metal 0.2-0.6, as recalled; measured window below) |

Per build (the gate's row 1): the Cub's spinner 24 cm to 17.4 kN, prop 12 cm at 17.3 kN, bowl 8 cm at 19.1 kN, 6.36 kJ in 44 cm;
the Jodel 6.29 kJ; the metal Cessna 32 / 7 / 8 cm, to 20.0 / 9.5 / 23.8 kN, 6.78 kJ. A 3 m/s taxi carries 2.1 kJ (the Cub) to
4.0 kJ (the metal Cessna). Every plateau sits under what the mount is certified to carry on the nose (28 / 27 / 52 kN).

**μ on bark, measured** on the Cub's five worst winds: 0 loses 7.5 m/s from 90 deg (the Cub slides off the trunk and swings
its cabin corner into it); 0.5 loses 2.5 m/s from 30 and 150 deg (the sideways grip at the hub tears a top mount fitting at
1.01 of its 4.95 kN floor); 0.2, 0.3 and 0.4 hold all five. 0.3 is the middle of that window; it is a GAME number.
