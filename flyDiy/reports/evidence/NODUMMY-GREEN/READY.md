# NODUMMY-GREEN READY (CABIN-CRAFT, 8 Nov 2026, for train L35d)

Branch claude/ready/nodummy-green, on master 1bcd01d3e (L35a). Tool files only (nothing built changes), then this note and HANDOVER.

MASTER-GREEN, via A0. GATE NODUMMY (G3700, the user 25 Oct: "no reference in code to the old model") was red on master: 12 hits in six tool files.

## What changed

- **A real stale reference.** `tools/newshapes_build.js` read the retired figure's groups (`edDum1`/`edDum2`) out of `tools/_crew_head_probe.js`. The seated characters are `edCrew1`/`edCrew2` (`_cage_crew.js`), so its "occupants" line had printed nothing since the figure retired. Both files now use edCrew. The probe takes a character's own group (the innermost), and otherwise the outermost panel or seat group as before. Proof: `node tools/newshapes_build.js --only=stearman --no-fly` now prints "occupants: pilot head in an opening, 15 cm over the coaming rail, 4 cm over the crown; second head in an opening, 16 cm over the coaming rail, 5 cm over the crown" (master: "occupants:" with nothing after it).
- **A dead alternative.** `tools/quickshot.js` skipped `^edDum|^edCrew`; now `^edCrew` (which already covers the crew).
- **Unrelated words, renamed:** `box_render.js` `dummy` (a stub gradient) to `stubGrad`; `_treehit_check.js` `atD` (matched the old ATD) to `atDist`.
- **Comments reworded:** `_bench_check.js` ("the pilot rows' rename"), `_crew_head_probe.js` header.

No re-pin, and the gate is unchanged.

## Gates (node)

```
NODUMMY PASS  TREEHIT PASS  BENCH PASS
```
