# DMG-WINDBREAK (G1883-G1884): why a 5.5 m/s breeze broke the Cub's whole engine mount at a 3 m/s trunk, and the fix

Made by `node tools/dmg_windbreak_evidence.js --base <base tools/> --before-gate <json> --after-gate <json>` (node only).
Before = the base `claude/dmg-integration` 01e6892f plus only the read-only instruments (`sim.onSubstep`,
`damageCaps`, `damagePush`, which leave the run's bits unchanged: GATE DMGWIND 4). After = this branch. Staging = DMG-D4b's page
rig on node's flat world: settled 2 s in the wind, 3 m/s, throttle shut, a 0.3 m trunk 6 m ahead.

- `divergence.svg`: the first thing the wind changes is where the Cub meets the trunk. The settle weathercocks the parked Cub 2.2 deg and the roll drifts it 14 cm, so the trunk lands on the thrust node ENGR instead of the flange bar's middle.
- `push_engine.svg`: the trunk's push on the engine's nodes (page wind). Before, it steps to ~18 kN on the first substep (the contact counted once per member at the node, 5x); after, one contact per node, rising from ~4 kN.
- `mount_force.svg`: the worst mount member's force over its certified limit, wind off (blue) and on (orange), before and after, at the page's staging and at the page's impact speed. Before with wind, ENGR-S0TR hits its crush limit within 5 ms and kinks; the group takes all 10 members. After, it sits at 1.0 (a set) and holds.
- `sweep.svg`: steady winds 0-10 m/s from 12 directions on the Cub, Jodel and metal Cessna, before and after; orange = the mount came off. Page's staging (gated): Cub 10/49 -> 0/49, Jodel 10/49 -> 0/49, metal 0 -> 0. Page's impact speed (reported): Cub 24 -> 5, Jodel 12 -> 19, metal 4 -> 10.
- `offset.svg`: no wind, the trunk moved across the nose. Before, the mount breaks at 8/19 offsets (even 5 cm off centre); after, 1/19 at the page's staging.
- `aero_nose.json`: the air on the nose, the frame before contact (page wind, q = 18.4 Pa). 0 N on every nose node with the wind and without; 64 N sideways on the whole aeroplane (76 N lift without).
- `gate_dmgwind.txt` / `.json`: GATE DMGWIND on this branch (PASS 11/11). `gate_dmgwind_before.txt` / `.json`: the same gate on the base (FAIL 4/9).
- `runs.json`: every substep the pictures plot (every other substep kept).
- `battery_*.txt`, `perf_*.txt`: the targeted gates and the perf A/B (see HANDOVER G1883-G1884).
