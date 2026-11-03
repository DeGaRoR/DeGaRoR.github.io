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

Steps 2-3 (`claude/config-matrix` 2686e99b0, `run_gates.js --only=` the thirteen named):

| PASS | GEN (4 shards, 748 s), CAGEFIT, COWL, JOIN, STARTER, FLOATKIT, SAVE, PARTS, DESIGN |
|---|---|
| FAIL, **standing** | CLIP (stock+ifr: navAerial 9.2 mm into the fin), TECH (pitch:seaplane has no segment), NODUMMY (retired-figure references in `_crew_head_probe.js`, `newshapes_build.js`, `quickshot.js`), ENGCONFIG (identity digests against its pin f353a0f8; the three cards differ from their saved files) |

Standing = run on `origin/master` 0fcf54ef9 in a clean worktree: the same four FAIL, with byte-identical FAIL lines.
ENGCONFIG's identity section prints the SAME digests on this branch and on master for the Cub, the Jodel, the C172
and its metal / floats builds, the twin floatplane, the Chinook, the four fixtures and Rufus: the validated builds are
bit-identical to master (the gate is red against its own stale pin, on both).

Step 4 (`claude/config-matrix-step4` 7173bd9a7): CAGEFIT, COWL, JOIN, STARTER, SAVE, PARTS, DESIGN, UISMOKE PASS;
TECH the standing red.

After the user's calls (`claude/config-matrix` 98ed1fcd9, the same thirteen): GEN (753 s), CAGEFIT, COWL, JOIN,
STARTER, FLOATKIT, SAVE, PARTS, DESIGN PASS; CLIP, TECH, NODUMMY, ENGCONFIG the standing four, FAIL lines
byte-identical to master's. Step 4 rebased (`claude/config-matrix-step4` 1b0225c3d): CAGEFIT, COWL, JOIN, STARTER,
SAVE, PARTS, DESIGN, UISMOKE PASS; TECH standing.

Rebased on master F4 2f104df85 (steps 2-4 + the push-pull rear fit, 14c8d5513), the thirteen + UISMOKE: GEN (910 s),
UISMOKE, CAGEFIT, COWL, JOIN, STARTER, FLOATKIT, SAVE, PARTS, DESIGN PASS; CLIP, TECH, NODUMMY, ENGCONFIG FAIL, and
F4 master itself (a clean worktree) fails the same four with byte-identical FAIL lines (ENGCONFIG re-pinned by F4:
fewer builds differ, the same ones on both).

The sweeps: `sweep_before.txt`, `sweep_after_steps2-3.txt` (the four XX cells left are step 4's greyed ones, now a
join error instead of an engine on the nose).

## The user's calls (2 Nov) — applied

1. **The dorsal on the single bare rod: yes.** The same opt-in row (`finDorsalTube`) on any tube host; saved single
   rods (Chinook, Birdman, the pusher fixture: `finDorsal 1` stored, never drawn) stay bit-identical. The style tiles
   carry the DRAWN dorsal on either boom count: the stock's dorsal now rides onto the rod when its Pusher tile is
   picked (`after/stock_pusher_tile_rod_fitted_below_disc_side.png`).
2. **Push-pull / pusher on a single rod: move the rod below.** Booms·Single stays live on a rod (greyed only on a
   lofted body, which has no aft face). A tile that puts an aft engine on a single rod (Pusher, Rod & pod,
   Booms·Single) arms one fit (`_cage_eng.js` `CAGE_ROD_FIT_NEXT`): the rod goes to the far side of the disc from the
   hub, 80 mm clear (below by default, above an engine set low), and the layer builds once more; a rod the builder
   already set clear is left alone. Measured: the stock + Pusher tile, rod −0.34 (inside the disc by 0.30 m — the
   Pusher tile's own rule never cleared it) → −0.72, clear. The prop check now measures the rod exactly (the sampled
   rings missed a 12 cm tube): a disc through the rod is a `prop:` error row; every saved single-rod pusher passes.
   **Left for after PHONE-1b:** a push-pull's rear engine sits on the bulkhead's centre line with a ~1.9 m disc, so
   the rod at its slider limit (−0.9) still leaves blade through it (the push-pull fixture: 284 mm;
   `after/pushpull_single_rod_at_limit_side.png`). A lone pusher's fit raises its engine (`engY`) by the rest; a
   push-pull's `engY` would move the NOSE engine too, and the rear's own height row (`engBlockY`) is what PHONE-1b
   changes for cowled pushers — so the fit says how much is left ("N mm of blade still reach it: raise the rear
   engine or shorten the prop") and the bench files it. Once PHONE-1b lands, the fit can raise the rear unit alone.
3. **T / V on twin booms: no new options now** (the inverted V would need its own undercarriage). They stay greyed
   (step 4).
