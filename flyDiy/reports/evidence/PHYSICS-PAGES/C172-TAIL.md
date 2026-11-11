# The Metal Cessna flies a bigger tailplane than the one drawn (PHYSICS-PAGES, 11 Nov 2026)

Seen by the user on the "What the sim flies" page (c172_model.png): the sim's tail panels overhang the drawn tail.
Measured (tailfit.py: the sim's strips against the fiche's own plan and side pictures, the frame fitted on the nodes):

| plane | drawn stab, plan | sim stab (strips) | drawn fin top | sim fin top |
|---|---|---|---|---|
| Cub (official) | x 4.59..5.71, span 2.82 m | x 4.51..5.64, span 2.84 m | y 2.08 | y 1.96 |
| Metal Cessna (official, list:5) | x 5.02..6.15, span 2.68 m | x 4.89..6.02, span **3.40 m** | y 1.98 | y 1.98 |

Why: the load door (tools/_load_build.js, the page's join) re-measures the Cub's tail off the drawing (its Sh, hChord, vX,
vSweep change through the join), but on both Cessna files the join leaves spec.tail as the file has it, with the note
"stab: the drawing stopped a slider short — tip fore / aft": the editor's stab could not be drawn to the spec's size, so the
drawn stab is smaller than the flown one.
- builds/cessna172_2026-09-20.json (the official list's file): flies hSpan 3.40 m, Sh 3.33 m2; drawn ~2.68 m.
- builds/cessna172_2026-09-20_corrected.json: flies hSpan 3.20 m, Sh 3.11 m2; same note.
So the official Metal Cessna's pitch stability, trim and certificate are computed with a tailplane ~27 % wider than the
one the player sees. The fin's height agrees; its chord was not checked beyond its top.

## CLOSED (12 Nov, A0): a stale fiche
The 10 Nov baked fiche (3cad3e994) was stale at 2.69 m. The re-bake e78d1a062 (claude/ready/cut-takes, L38c) shows the
stab at 3.40 m, the same as the editor (the headless load path: 3.42 m) and the flight model (3.40 m). No tail mismatch.
