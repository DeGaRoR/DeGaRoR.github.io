# DMG-D4b + DMG-FOLDNODE G2352, the box A/B, 2026-10-07 03:28-03:35 (my untimed GPU slot)

**The code**: claude/dmg-d4b-wreck c33960d6 (D4b + FOLDNODE b03a5462 merged), built 7794a9e329fa, dev.html?damage=1,
**flown, default mode** (the physics worker). The user's path each time: a 30 m/s crash into a trunk -> the shed -> Roll out
-> the stand (tools/dmg_wreck_paths.js --paths garage). One live Chrome per aeroplane; Cub A and Cub B are on one page, in that order.

| run | aeroplane | the fixes | the stand |
|---|---|---|---|
| `cub_A_*` | the user's Cub (builds/cub_2026-09-20_corrected.json) | all on (G2352 owe + D4b's heal mark + the shot reset) | **clean**: the whole yellow Cub at the stand (`after_1/2`) |
| `cub_B_*` | the same Cub, the same page, crashed again | all off: `FLYDIY_FOLD_NOOWE` + `FLYDIY_HEAL_NOMARK` + `FLYDIY_ROLL_NORESET` (the code as it was) | **black**: only the lamps' bloom shows, already IN THE SHED (`in_shed`), at the stand (`after_1/2`), and after a forced re-upload of every attribute (`after_reupload`) |
| `jodel_A_*` | Jodel (builds/jodel_2026-09-20_corrected.json) | all on | **clean** |
| `cessna_A_*` | the metal Cessna (bugReports/cessnaMetal (1).json) | all on | **clean** |

**Every crash was real** (broke up / a gear member broke, 142-172 members broken, 9-12 wreck bodies), and the wreck layer
healed after each path (0 bodies, 0 debris, 0 hidden, 0 skin records). The CPU census found no aeroplane triangle past
2 m in any run, including B. The giant triangles it lists are world statics: the same groups are in a fresh load.

**Reading B (an inference, stated as one):** in B, the scene renders: the lamps' bloom shows. Everything else is occluded
by something in front of the camera. Earlier no-fix shots of this path showed the same thing: the giant orange sheets
seen from outside (merged-1630, reshoot-1712), and "a blur from inside them" for this garage camera. Here the stale fold
covers the camera. The forced re-upload does not clear it in B, which is FOLDNODE's mechanism: with NOOWE on, that whole
upload is also replaced by the rig's range. B was not split by fault: FOLDNODE's (C) (the mark on, NOOWE on) was not run
in this slot.

**The heal's cost** (`*_paths.json` HEAL COST, every fold marked stale and the frame it lands on):

| aeroplane | folds | bytes | median frame (ms) | frames after (ms) |
|---|---|---|---|---|
| Cub | 7 | 19.3 MB | 24-28 | 30-35 |
| Jodel | 7 | 17.7 MB | 29 | 32 |
| Cessna | 7 | 23.9 MB | 29 | 33 |

That is one frame of +3-7 ms over the median, once per heal.

`run_log.txt`: the job's whole output (the box state at the start: POTATO-repro's CPU lock, untimed stills allowed beside it).
