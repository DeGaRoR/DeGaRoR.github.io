# THE WORLD QUEST — a briefing for the next session (2026-09-13)

Written at the close of the tree chantier (W0c, HANDOVER W0c), on the user's
ask: *"remind me of the macro plan, tell me what we've done, and what we've
identified next — a little briefing for the next session on the world quest."*
Read this first; then the documents it points at, in the order they are named.

## 1. THE MACRO PLAN, IN ONE PARAGRAPH

The second world (URSOY — Admiralty Island, Southeast Alaska, on a 5 m IFSAR
DTM + ESA WorldCover) arrives BESIDE the analytic world, and the analytic world
keeps flying throughout. The spine, as ruled: **the tree spike first (W0, done)
→ the three.js upgrade (W0.5a) → TSL, then the backend flag (W0.5b/c) →
the quadtree on the analytic world (W2), whose first content is the first
world → the splat material, written once, in TSL (W1) → trees productionised
(W3) → the data (U1) → one 20 × 20 km slice of Ursoy as THE SHIPPED WORLD
(W4) → nomination and the editor (W6, W7) → the whole island, deferred (W5).**
Canonical: `WORLD-V2.md` §11; the ROADMAP's Phase 3 / Phase 7 were reconciled
to it today (D0) — before that they still said "clipmap", "erosion at 4096²",
"hero tiles" and "Corsica on GLO-30, decision open".

## 2. WHERE EVERY STAGE STANDS

| stage | status | where it is written |
|---|---|---|
| D0 doc drift | ✔ done 2026-09-13 | ROADMAP Phase 3, Phase 7, WORLD-PATH RULING |
| W0a bench · W0b assets | ✔ | `tools/_trees.html`, `tree_prep.py`, TREE-IMPORT.md |
| **W0c the ladder (W0 + W0e's verdict)** | ✔ **closed** (W0c.6–33) | HANDOVER W0c, TREE-IMPORT.md §8 |
| W0d canopy shell (R3) | not done; partly moot (impostor ring to 4 km, terrain mask beyond); R5 open | WORLD-V2 §8.3, §12.12 |
| **W0.5a three.js upgrade** (r128 → current, still WebGL) | **NEXT** | RENDERER-DECISION §4b |
| W0.5b TSL · W0.5c backend flag | after W0.5a; conditional | RENDERER-DECISION §4b, §4c |
| W2a switch · W2b loader/sampler · W2c second world = first world | not started; `terrain_bake.js` / `terrain_codec.js` exist, run once (2.55×, 3 361 leaves) | WORLD-V2 §2–5, §11 |
| W1 splat material (TSL) | not started | WORLD-V2 §8.1 |
| W3 trees productionised | half inside W0c (density as data, species by place, hand placement); per-class table waits for U1 | TREE-IMPORT.md §8 |
| U1 the data | not started; **GDAL not installed** | ISLAND-PREPACK.md |
| W4 the slice — the shipped world | not started | WORLD-V2 §11 note |
| W6 · W7 · W5 | later / later / deferred | ISLAND-ADMIRALTY.md §12, WORLD-V2 §6–7 |
| S1 the day · S2 the sun | pure data, not gated on anything — can land any time | SKY-ATMOSPHERE §6 |
| S3–S6 atmosphere, aerial perspective, probe, mist+glare | **gated on W0.5a** (`@pmndrs/sky` needs modern three + TSL) | SKY-ATMOSPHERE §6 |

## 3. WHAT THE TREE CHANTIER DELIVERED, AND WHAT IT DECIDED

- Real trees, five collections, the full ladder: L0 shipped · L1 stem + full
  foliage (60 → 270 m) · G-buffer impostors beyond (albedo + normal sheets, lit
  at draw, 64 views, per-collection gain) · dithered transitions · a CPU
  partition from the eye · a sliced streamer whose worst frame is 15–18 ms.
- Light: three shadow passes (sun map ±540 m, far cascade ±1400 m, canopy map
  for the floor), texel snapping, the forest floor from the trees that exist.
- The rig as data (`sunset` / `alps`), the F8 panel, the G286 graphics menu,
  `TREE_PLACE` hand placement, species by altitude / patches / wet-or-steep.
- The instrument: `node tools/tree_perf.js` (paused sim, fresh profile, refuses
  a cone world). Baseline NG 100 / alps: **Off 10.2 · Smooth 19.9 · Smoothest
  27.9 ms** on the RTX 3080 at 1080p.
- **The verdict W0 existed to give:** the whole streamed forest is **0.6 ms of
  the 10.6 ms Off frame**, and all of its cost at Smoothest is AA fill-rate —
  the same wall a native engine hits. The near tier's triangles are free.
  **The platform is not the constraint; the web stays.** What the frame is
  made of otherwise (~10 / ~17.5 ms) is terrain, village, props, clutter, the
  aeroplane and the resolve; and the unpaused frame carries **~7 ms of
  `sim.step` + instruments** — a finding for the physics, not the forest.

## 4. WHY THE THREE.JS UPGRADE IS NEXT, BEFORE THE RENDERER TARGET

`RENDERER-DECISION-2026-09-07.md` §4b (the 2026-09-11 correction): the port
was under-measured — it is **two jumps, r128 → current AND WebGL → WebGPU**,
and the version jump is the larger and riskier. Its cost is **recalibration,
not translation**: colour management (r152) and light units (r155) change the
meaning of every number tuned by eye — the six mood rows, `light_rig.js`, the
material-lab gains, the sky palette, and now the whole tree rig (W0c's
28 `onBeforeCompile` sites are written against r128's chunk names and its
`RGBADepthPacking` shadow path). Every shader written on r128 between now and
the upgrade is one more thing to recalibrate — so **W0.5a goes before W1, W3's
material work and S3+**, each of which should be written once. It stays on
WebGLRenderer and ends with the battery green; `4c` says how to keep a working
game throughout without a fork.

**WARNING (2026-09-13):** §4b and §4c of RENDERER-DECISION — the correction
that puts the upgrade first — are **UNCOMMITTED in the shared tree** (+224
lines over HEAD `9fe0bda`, another session's working copy). If the next
session reads that file from a clean checkout and finds no §4b, the correction
exists and must be landed from the shared tree, not re-derived. This briefing
carries its substance for that reason.

## 5. RULINGS OWED, WITH WHERE THEY FALL DUE

| # | question | due at |
|---|---|---|
| R1 | skirts vs edge stitching (recommend skirts) | W2b |
| R2 | game-frame projection, Alaska Albers or UTM 8N — decide once, write it down | U1 |
| R3 | does Angoon survive? | W4 |
| R4 | parent prediction in the codec (measurable against 2.55×) | W2b |
| R5 | does the canopy shell replace the fog wall? | W0d / S4 |
| R6 | the Home Field village (touches the house generator) | open |
| R7 | the flapped approach under the vortex kernel | open, not the world |
| (ac)/(ad) | one day object; `@pmndrs/sky` as the atmosphere | S1 / S3 |
| boot rig | `sunset` (today) or `alps` (where the trees were judged) | any time |

## 6. LEFTOVERS THAT ARE NOT STAGES

- A quiet-machine re-measure of the no-L2 ladder (the A/B was taken with three
  gate batteries running; it said "no difference").
- The forest card + editor with persistence (the map-and-hand editor
  `TREE_PLACE` was built for); bushes and grass through the same pipeline;
  day/night (SKY-ATMOSPHERE S1/S2 can start now).
- ~61 stale `cdp_*` Chrome profiles in `%TEMP%` from the CDP harnesses
  (`tree_perf` cleans its own now).
- `DEBT-REGISTER-2026-09-01.md` still carries the pre-world debts; nothing in
  it blocks the world.

## 7. TRAPS THE NEXT SESSION MUST KNOW (all in memory + docs)

The shared tree and index (commit through a temporary index, prove from a
clean worktree, never `git checkout`); r128 keys its program cache on hook
text (`customProgramCacheKey` per variant); a forest point is never
SAND/SCREE (the classifier says those first); the Browser pane's rAF is dead
(pump with a `setTimeout` shim after a capture); a static server too slow for
the payload gives a cone world; the full gate battery cannot be finished on a
box running three of them (GEN alone: 73 min under load — a timeout is not a
verdict) — prove per commit from a clean worktree, the full battery when the
machine is quiet.
