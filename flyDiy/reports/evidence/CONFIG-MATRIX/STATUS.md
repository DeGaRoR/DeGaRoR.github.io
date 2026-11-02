# CONFIG-MATRIX — STATUS

Branch `claude/config-matrix`, base `origin/master` 0fcf54ef9 (train PH1A). A0 promotes; this branch is not a ready/ one.

## Step 1 — the map: DONE (this commit)

- The table: `docs/CONFIG-MATRIX.md`.
- The instrument: `tools/config_matrix.js` (one build + tiles, or `--sweep`: 109 cells, ~3 min).
- The sweep before any fix: `sweep_before.txt`. The user's switch on `_4b` before any fix: `repro_4b_before.txt`
  (the base flies and draws the pusher; after the Lofted tile the engine is not drawn, still flown at x 2.40, the
  twin booms stay, the dorsal appears and flies 0.126 m²).
- Pictures (quickshot, the editor's own layers): `before/`.

### The BROKEN cells found

| cell | what happens |
|---|---|
| twin booms + pusher → Lofted (the user's) | no aft aperture: the engine and the prop vanish, the join still flies them |
| single body + pusher → Lofted | the pusher bolts onto the windscreen band, facing aft (or vanishes); flown |
| push-pull → Single, lofted | the rear engine bolts onto the windscreen band; flown |
| push-pull → Single, rod | the rear disc sweeps through the rod |
| over the wing → Mid / Low wing | the engine vanishes; flown |
| twin booms + T-tail | the stab seats on a centre fin that is not there; its halves kink to the fin tips |
| twin booms + V-tail | one canted panel on one boom; flown as `twinBoom` with no fin |

MISSING ROW: the dorsal on rod-style twin booms (the user's ask).

### Repo builds in a BROKEN / NONSENSE cell

None: every `*.json` with a `spec.cage` in the repo, the 32 archetype cards, and `builds/candidates/` on
`claude/ready/candidates-4b` (the `_4b` and its review/ siblings are rod twin + pusher: a WORKS cell).

## Steps 2-3 — the switch fixes and the missing points: DONE (commit 2686e99b0 on `claude/config-matrix`)

| fix | file | effect |
|---|---|---|
| the pod's END decides an aft engine's face (`cageAftEngineFace`: Rod & pod, or twin booms of either style) | `_cage_gen.js` | the user's `_4b` switched to Lofted keeps its pusher (and its cowl) on the same aft face; back to Rod & pod, the same |
| no aft face, no pusher unit | `_cage_cowl.js` `engineFaces` | a pusher / push-pull rear is no longer bolted onto the nose cap or the windscreen band facing aft |
| the engine layer names every engine it could not bolt on (`CAGE_ENG_LOST`) and drops the stale `CAGE_ENG` | `_cage_eng.js` | the stat line says "N of M drawn — why"; the old drawing's stations no longer fly on |
| an engine flown and not drawn is an ERRS row | `_cage_join.js` | the bench fails it: no silent part loss |
| the dorsal on rod-style twin booms: its own row `finDorsalTube` + slot tile `finDorsalTubeT`; with it the fin roots on the boom skin (a dorsal is a fairing; the saddles go) | `_cage_fin.js`, `_tail_headless.js`, `_cage_parts.js`, `_cage_design.js` | the pod-and-rod twin wears a dorsal; a saved rod twin (finDorsal 1 stored, never drawn) loads bit-identical |
| the style tiles (Lofted, Rod & pod, Pusher) carry the DRAWN dorsal across on twin booms | `_cage_design.js` | rod dorsal ↔ loft dorsal; the `_4b`'s never-drawn `finDorsal 1` no longer pops up on Lofted |

Measured after (`tools/config_matrix.js` on `_4b`): base / → Lofted / → Rod & pod: `units pusher | flown
pusher@2.40 | ok` all three; + dorsal tile: dorsal area 0.126 m² flown on rod, carried to Lofted and back.
Pictures: `after/`.

Saved builds changed: none (every changed path is a BROKEN cell, and no repo build sits in one).

## Step 4 — the disables: DONE on its own branch `claude/config-matrix-step4` (7173bd9a7, on top of steps 2-3)

For the user's veto before A0 promotes it. `_cage_design.js` `CM_OFF`: an `off(P)` per tile, greyed with its
reason shown in the tile, the pick refused, the tile the aeroplane holds stays lit (`design_flow.js`).

| tile | greyed when |
|---|---|
| Fuselage style · Lofted skin | a pusher or push-pull on a single boom |
| Booms · Single | a push-pull; a pusher on a lofted body |
| Empennage · T-tail, V-tail; Stab sits · On the fin tip | twin booms |
| Wing position · Mid, Low | over-the-wing engine |

Checked: nothing greys on the stock aeroplane; each rule fires in its cell; every archetype card still composes.
A saved build in one of these cells loads unchanged (engine: the join's error row; T/V on twin: a join notice).

## Gates

(running — see below)

## Borderline cells for the user to decide

1. The dorsal on a SINGLE bare rod (an ultralight's tube): today clamped off (G26.4: "a bare tube has no deck").
   Offer it too, rooted on the tube like the twin's?
2. Push-pull with a single boom: greyed (the rear disc sweeps the rod), or offer it with the rod moved under the disc
   the way the Pusher tile does?
3. T-tail and V-tail on twin booms: greyed (step 4), or build the Adam A500's stab between the fin tips and the
   Shadow's inverted V as new garage rows?
