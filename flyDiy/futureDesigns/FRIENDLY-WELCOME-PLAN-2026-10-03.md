# Friendly Welcome — the plan of 3 Oct 2026 (after the user's long test session)

Board: the "Friendly Welcome" artifact. Contract for budgets: `FRIENDLY-WELCOME-BUDGETS.md`. Previous release:
`reports/PERFORMANCE-RELEASE-2026-10-02.md`.

## What the user's session showed (3 Oct, Pages 5502f450, custom near-ultra settings)

| Finding | Evidence | Owner |
|---|---|---|
| 76–97 s single-frame freezes, recurring ~every 82 s after "skip to line up"; a minute's lag entering no-physics mode | flight logs `…151335-hzlj*`, `…165355-7u7a*`: one frame's `shader` slot holds the whole time | SHADER-GUARD |
| After a freeze, the aircraft is "miles away" (the physics kept running) | same logs | SIM-STALL |
| Choppy start until the runway; flight "not great"; evenness worse than fps | 1.5 h log: 86 % of frames 20–40 ms, 6 % longer, 17 over 250 ms | EVEN-30, GATE-TOOLS (distribution) |
| Shadow bands on the Cub at golden hour; sudden one-frame light changes; single-frame white flashes; all-sky frames, flicker | screenshots, logs | LIGHT-SMOOTH |
| Lakes cut holes in the terrain (reddish background at the shore) | screenshots | LAKE-HOLES |
| Building low LODs too crude, swap too late | play | HOUSE-LOD |
| Editor: no grass / bush colours; polygons can't take any vegetation; no tree-exclusion control round runways | play | EDITOR-VEG |
| Runway and side colours; grass runway thin vs dirt path wide | play | RUNWAY-LOOK |
| Strip surface not shown; water strips allowed for wheels, ground for floats | play | STRIP-SURFACE |
| Autopilot path ribbons reflect and show in photo mode; action buttons during the roll-out cinematic | play | UI-LAYER |
| Cub tail wheel 3–5 cm above the ground; a wheeled Cub on water meets no drag | play | GEAR-WATER |
| Trees: only some collide | play | TREE-HITBOX |
| Garage tank slider ~1 s; global colour misses the Cub's rudder; frame-control sliders unusable | play | GARAGE-LAG-2, SMALL-FIXES |
| Metlakatla off by default | expected: METLA-RETURN's verdict (loading +18 s), it stays off | — |

## The order

**Cloud, all at once now (no GPU; node gates only; ≤ 2–4 h each):** GATE-TOOLS, SIM-STALL, UI-LAYER, STRIP-SURFACE,
GEAR-WATER, TREE-HITBOX, EDITOR-VEG, RUNWAY-LOOK, HOUSE-LOD, SMALL-FIXES, WELCOME (the GPU / memory suggestion + the
device gate).

**Local GPU, at most two sessions on the box at once:**
- wave 1: SHADER-GUARD (top priority), LIGHT-SMOOTH;
- wave 2 (after SHADER-GUARD reports): EVEN-30, GARAGE-LAG-2, LAKE-HOLES;
- wave 3: COLD-LINKS (after SHADER-GUARD has landed), HYBRID-FARTHER, MEM-BUDGET.

**End of the run:** the potato test (the GTX 660 desktop, `?gfx=potato` and the welcome screen), then the phone
(the adb rig) once MEM-BUDGET lands.

**Parked:** TREE-IMPOSTORS (rig-only artefact, second order), the town's ground cook (Metlakatla), MOBILE-STUDY.

## Rules for every session (written into every chip)

- A **GPU budget** under the box lock (minutes), a **cap on browser runs**, and a **wall-clock bound**. Stop and report at
  the bound even if unfinished.
- **Only the gates of the files touched.** No full battery, no master bench, no full ratchet in a session.
- **A0 integrates.** Merge trains, the ratchet (light or full by the cargo's reach), the battery, the strict gates once
  GATE-TOOLS lands, landing and Pages.
- Cloud sessions push `claude/<name>-*` only. Local sessions message A0 with the branch and SHA.
