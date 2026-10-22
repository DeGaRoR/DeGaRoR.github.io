# DMGUPLOAD's Cub crash staging sweep (train 41), 2026-10-07 14:10-14:18, A0's CPU window, node only

**The code**: claude/dmg-d4b-t41 fe742514 (the train-39 assembly 82cf6ed8 merged: DRIVE2 + WALL + TUNE + SKINGPU).
The Cub crash only (`_dmg_upload_check.js --child=1 --probe=1`), in the node page under the worker, a trunk 40 m ahead,
the throttle shut, 5 s. Each staging ran twice.

| V (m/s) | height (m) | trunk r (m) | broken | wreck bodies |
|---|---|---|---|---|
| 30 | 1 | 0.5 | **114** | 12 |
| 30 | 2 | 0.5 | 99 | 12 |
| 50 | 2 | 0.5 | 129 | 12 |
| 40 | 2 | 0.5 | 1 | 0 |
| 40 | 2 | 0.3 | 1 | 0 |
| 40 | 4 | 0.5 | 0 | 0 |
| (the mild default: 30, 4, 0.3) | | | 12 | 2 |

- **Chosen: 30 m/s, 1 m up, a 0.5 m trunk** (STAGES.hard). It is the user's speed, and it breaks up (114 members, 12 bodies).
  The gate's row requires 80+, which leaves a margin for V8's tiering (crash counts move between runs; see DMG JIT chaos).
- **Not a monotone dial**: at 40 m/s the Cub breaks 0-1 members from 2 m or 4 m up. It most likely does not meet the
  trunk squarely at that speed (it lifts). Not chased here; the 30 m/s staging is the one the gate uses.

## The full gate on it, 2026-10-07 22:10-22:19 (A0's CPU window): GATE DMGUPLOAD PASS (`DMGUPLOAD_full_2210.txt`)
Cub mild: 12 broken, 0 stale of 366. Metal Cessna: 156 broken, 0 stale of 427. **Cub hard: 114 broken, 12 bodies, 0 stale
of 366, the folds' 44 buffers included.** Damage OFF: the heal marking fired 0 times, 0 stale.
