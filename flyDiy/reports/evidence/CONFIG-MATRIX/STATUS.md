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

## Step 2-3 — the switch fixes and the missing points: in progress

## Step 4 — the disables: pending (separate commit)

## Borderline cells for the user to decide

1. The dorsal on a SINGLE bare rod (an ultralight's tube): today clamped off (G26.4: "a bare tube has no deck").
   Offer it too, rooted on the tube like the twin's?
2. Push-pull with a single boom: greyed (the rear disc sweeps the rod), or offer it with the rod moved under the disc
   the way the Pusher tile does?
3. T-tail and V-tail on twin booms: greyed (step 4), or build the Adam A500's stab between the fin tips and the
   Shadow's inverted V as new garage rows?
