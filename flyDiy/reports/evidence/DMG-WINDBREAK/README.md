# DMG-WINDBREAK (G1883-G1884): why a 5.5 m/s breeze broke the Cub's whole engine mount at a 3 m/s trunk, and the fix

Made by `node tools/dmg_windbreak_evidence.js --base <base tools/> --before-gate <json> --after-gate <json>` (node only;
`--replot` redraws from `runs.json`). Before = the base, `claude/dmg-integration` 01e6892f, plus only the read-only
instruments (`sim.onSubstep`, `damageCaps`, `damagePush`; the run's bits unchanged, GATE DMGWIND 4). After = this
branch. Staging = DMG-D4b's page rig on node's flat world: settled 2 s in the wind, 3 m/s, throttle shut, a 0.3 m trunk 6 m
ahead. On node's grass that meets the trunk at 2.2 m/s, where the page's ground kept ~2.95; the "page's impact speed"
rows start at 3.6 m/s to meet it at ~3.0.

- `divergence.svg`: the first thing the wind changes is where the Cub meets the trunk. The settle weathercocks the parked Cub 2.2 deg and the roll drifts it 14 cm, so the trunk lands on the thrust node ENGR rather than the flange bar's middle.
- `push_engine.svg`: the trunk's push on the engine's nodes in the page's wind. Before, it steps to ~18 kN on the first substep (counted once per member at the node: 5x the node's spring and damper); after, one contact per node, rising from ~4 kN.
- `mount_force.svg`: the worst mount member's force over its certified limit, wind off (blue) and on (orange), before and after, at the page's staging (top) and impact speed (bottom). Before, with wind, ENGR-S0TR reaches its crush in ~5 ms and kinks, taking all 10 mount members; after, the worst member sits at its limit (a set) and the mount holds.
- `sweep.svg`: steady winds 0-10 m/s from 12 directions, before and after; orange = the mount came off. Page's staging: Cub 10/49 -> 1/49 (7.5 m/s from 210 deg, open), Jodel 10/49 -> 0/49, metal Cessna 0 -> 0. Page's impact speed: Cub 24 -> 17, Jodel 12 -> 0, metal 4 -> 4.
- `offset.svg`: no wind, the trunk moved across the nose (dots: the mount broke). Page's staging 8/19 -> 3/19; impact speed 17/19 -> 11/19.
- `aero_nose.json`: the air on the nose in the frame before contact (page wind, q = 18.4 Pa). Every nose node carries 0 N, wind or no wind; the whole aeroplane carries 64 N sideways (76 N lift without the wind).
- `gate_dmgwind.txt` / `.json`: GATE DMGWIND on this branch, PASS 11/11. `gate_dmgwind_before.txt` / `.json`: the same gate on the base, FAIL 4/9.
- `battery_vs_base.txt`: the targeted battery's verdicts and the damage-OFF byte comparison.
- `perf.txt`: the perf A/B (alternating processes, and pinned pairs).
- `runs.json`: every substep the pictures plot (every other substep kept).
