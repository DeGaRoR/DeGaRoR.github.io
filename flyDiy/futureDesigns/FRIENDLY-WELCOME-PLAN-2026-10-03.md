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

## Status, 4 Oct 2026 ~22:45 (A0)

**Pages:** train 30 (live since 18:05). GitHub had started NO Pages deploy for trains 28-30 - the site served train 27 for
~14 h and the user's first potato test ran on train 27; re-triggered with an empty commit, now verified after every landing.
- **Train 28** (9825e1e0): COLD-LINKS, EVEN-30, LIGHT-SMOOTH 2, CRAFT-SHADOW, TREE-HITBOX, HOUSE-LOD (+ the house worker's lod 1
  packed with every attribute), EDITOR-LAG, METLA-LOAD, METLA-TAXI, RUNWAY-LOOK, RUNWAY-LIGHTS, HYBRID-FARTHER, GARAGE-LAG-2,
  GARAGE-INSTANT, C0. LAKE-HOLES dropped (4 gates). Its "trips red was the box" verdict was WRONG: the cost needs a taxi first.
- **Train 29** (e3575943): MEM-BUDGET (potato peak 2265 -> 1141 MB), TOWN-COOK; HYBRID-FARTHER's band reverted (after a taxi the
  trip took 2.8 s and a 5.2 s re-link - HYBRID-TRIPS fixes it properly).
- **Train 30** (a1ffcf5b): SOUND (engine / prop / airframe, 34 sounds, 12 lo-fi tracks, lazy) + LAKE-HOLES reworked (no white
  gaps at the shore; the banks steep - SHORES).

**Train 31 (landing tonight):** RELEASE-FAST, SOFT-GPU (the world draws on SwiftShader: cloud stills), the cover fix for every
machine (potato / retro's 'cover off' never reached the ring: ~30 M triangles a frame), music OFF by default. Last check: a
+1.5 s garage load on both aircraft, being bisected (SOFT-GPU vs RELEASE-FAST).

**The potato test (GTX 660, on train 27):** loads and flies, ~2 fps in the world (GPU ~500 ms a frame, 16.7 M triangles at
taxi), 18 fps in the garage, 141 s to the garage. POTATO-DEEP (G1520) cuts for a playable 30, then a laptop (HD 620) rung;
the user retests on train 31.

**Next trains:** 32 = HYBRID-TRIPS (+ G1493: the live aeroplane's decals on its control surfaces), POSE-BACK (no backward
jump at low fps), UPDATE-NOW (the "new version - Update" button), GEAR-WATER + GEAR-WATER 2 (water: the slam, flooding,
wing buoyancy; nothing in dry air), TREE-CRASH (yield, bend, break, the crash ending - damage OFF by default), the
MOBILE-GARAGE study doc; WOODLAND / SHORES after the user's look call. 33 = sound-next (the radio). 34+ = the DEFORM plan
(futureDesigns/DEFORM-AND-BREAK-2026-10-04.md, G1800-G1899, owned by the local Deform Coordinator: D0-D1 -> 34 with the
potato cuts, D2-D3 -> 35 damage ON, D4-D5 -> 36-37). The mobile garage itself: later (a new feature); its touch-first slider
rules feed the slider revamp now.

**Running:** WOODLAND, SHORES, HYBRID-TRIPS, POTATO-DEEP (local GPU); TANKS-FLOAT, GROUND-LATTICE (cloud); the Sound
Coordinator (radio), the Deform Coordinator.

## Status, 4 Oct 2026 ~07:30 (A0)

**On Pages:** train 26 (b2f1ffdc, 3 Oct: the prop over the clouds, the user's two world looks) and **train 27** (e40628b0,
4 Oct 03:45): SHADER-GUARD (the 76-97 s dusk freezes = the lamp pool re-keying every lit program), LIGHT-SMOOTH (the eye
pinned the frame at x0.35; light eases; no cloud-tile flash), SIM-STALL, STRIP-SURFACE, EDITOR-VEG, UI-LAYER, WELCOME (+ the
hangar backdrop; skips localhost so the rigs run), SMALL-FIXES, GATE-TOOLS (the strict per-train gate, tools/perf/train_gate.js),
the rigs' Cub = builds/cub_2026-09-20_corrected.json (default is the Cub-alike), the live mirror back as an option (off).
GEAR-WATER was dropped from 27 (GATE SOAR: its wet-body pass changes the glide in dry air) - waiting for its fix.

**Train 28, final pass now** (47 commits): COLD-LINKS (cold first load 75.6 -> 57.9 s), LAKE-HOLES (carved lakebeds; merged
with COLD-LINKS' ground keying; A0's lakeCarve() so METLA-LOAD's build read carves too), EVEN-30 (a hard 30 by default, ultra
auto; the forest fill sliced - the taxi's 57-131 ms stalls), LIGHT-SMOOTH 2 (the plane's bake finally reads its 1.6 cm shadow
cascade - the in-flight bands; the eye at 4 Hz; the GPU catcher), CRAFT-SHADOW (the parked shadow stands still: sun held, grid
anchored on the aeroplane, map cached), TREE-HITBOX, HOUSE-LOD, EDITOR-LAG, METLA-LOAD (the town's boot bakes gone; the
town-ON default HELD), METLA-TAXI (town-on taxi as even as off), RUNWAY-LOOK, RUNWAY-LIGHTS, HYBRID-FARTHER (+1.5 ms at taxi,
accepted by the user), GARAGE-LAG-2 (+ its busy-time trade, accepted), GARAGE-INSTANT (drag ticks 26-75 ms drawn), C0 (honest
wing sliders). Its first gate went red on CPU contention (peers' lockless node work) - a quiet prefix bisect found one cost
(HYBRID-FARTHER) - new rule: heavy node work takes `boxlock take cpu`.

**Next: train 29** = SOUND (d313481b: the engine/prop/airframe voices, 34 recorded sounds, 12 music tracks, +35.5 MB of media,
nothing before the first click) + MEM-BUDGET (potato peak 2265 -> 1141 MB) + TOWN-COOK (Metlakatla cooked, fetched by the
town-on page only) -> then Metlakatla ON by default (G1408 as pref v8) once its load is measured.

**Open:** GEAR-WATER's fix (relay), the potato test (GTX 660) and the phone (after MEM-BUDGET), the far-town cull (a look
decision), GARAGE-INSTANT's release (still the whole build, 330-520 ms).
