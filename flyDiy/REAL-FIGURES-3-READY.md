# REAL-FIGURES-3 — READY (claude/ready/real-figures-3, onto master L36b e789e77cb)

REAL-FIGURES-2 (never landed: claude/ready/real-figures-2 2755f3023) and REAL-FIGURES-3, squashed from claude/real-figures-3
(through 2ae3a3a2e) onto master L36b. Two commits: sources, then built (`node tools/build.js`).

## What it changes in the GAME

1. **Engine dials `bmepK` (tune) and `massK` (build)** in tools/_eng_gen.js (ENG_DEFAULT, engResolve), tools/_eng_page.js
   (engDefaults, the "architecture" rows) and tools/_cage_parts.js.
   - Both default to 1, which is every catalogue engine as it was.
   - At 1 they are absent from every key: `GEN_CAGE_ROW_NEUTRAL` beside `GEN_STOL_ROW_OFF` in 60_gen_spec.js, kept with
     master's retract and hull rows in `genStolCageOff`. So the cert, bench, parked-fleet and procurement keys are
     master's.
   - The names are as ENGINE-DIALS will use them.
2. **The `stol` flap** (a plain hinge to 50°: lift 1.60, cd 0.090, rate 0.16, travel 50) is appended last to GEN_FLAPS and
   GEN_FLAP_TRAVEL. Every saved `wgFlapType` index holds. It has a tile in the Flaps row.
3. **The `fabricAlu` surface row** (aluminium spar + fabric, PA-18 / Carbon Cub) in GEN_SURF_MATERIALS:
   - the seventh construction stop on the wing, fin and stab (tools/_cage_wing.js, _cage_fin.js, _cage_stab.js,
     _cage_join.js, _cage_design.js);
   - TECH_SURF_ROW and 'surf:fabricAlu' in 79b_tech.js, and tools/_tech_check.js;
   - the field states (60_gen_spec.js), 32_hydro WB_WING, 26_hangar_fit (the metal shop), the audio space map;
   - a "Wing structure" tile row, the twin of `wgCons`, with section icons.
4. **Candidates** (builds/candidates/, no shipped build touched):
   - the Carbon Cub SS (carbon_cub_ss + edits);
   - the Cub at the J-3 chord (cub_chord160);
   - the float Super Cub at the PA-18 chord (pa18_floats_chord160).
5. **tools/_rejoin_build.js** takes `systems`, `paint` and `finish`, lets eng_ edits ride a preset, and takes a preset
   by NAME.
6. **The measurement:**
   - tools/real_check.js, real_refs.js, real_report.js;
   - reports/REAL-CHECK-2026-11-0{7,8,9}.html and reports/evidence/REAL-CHECK-*;
   - the STOL take-off run-up, the tailwheel / tricycle short-field stop, NOSE-OVER and GROUND LOOP flags;
   - the single-weight band chart fix.

Measurement code is node-only and never loaded by the game.

## Validated builds: no digest moves

All 18 shipped builds (builds/*.json and the three official fixtures) were loaded through the load door on master and on
this tree (scratch `digests.js`):
- the same `genCertKey`;
- the same sha256 of nodes, masses, beams and params.

For example the Cub af84cf8d, the Jodel 59b49604, the Cessna corrected 1e02cbdf, the PA-18 floats e5f3f8e1 and the STOL
Cub f801025a.

## Gates (this tree against master e789e77cb, `run_gates.js --no-build --jobs=2`, side by side)

| gate | master e789e77cb | this tree | note |
|---|---|---|---|
| BUILD, JOIN, DESIGN, PANEL, ENGID, PRICE, SPECFIX, HINGE | PASS | PASS | |
| STOL | PASS | PASS | The first run failed on the raw-spec compare: the load door now writes the two neutral engine dials. `_stol_check.js` now lets them through as it does the STOL and hull rows (GEN_CAGE_ROW_NEUTRAL, exported, asserted dropped by genStolCageOff). Re-run alone: PASS. |
| GEN | FAIL | FAIL | The same checks on both: clampSpec holds the envelope; cruise is quiet in wind. |
| ENGCONFIG | FAIL | FAIL | The same identity list on both (the pinned digests predate both trees). |
| TECH | FAIL `[av.elt:none, av.elt:fitted]` | FAIL, the same two keys | 118 options here against 117 (the seventh surface stop, segmented). |


## Not in this train (findings for Pilot and the physics owner)

On claude/practical-cerf-7fjpwp, not to merge (A0: Pilot's domain):
- **The user's tailwheel landing** (`A.tailStop 'feel'`, the arrival flag `ap.feelFld`):
  - the STOL flare's attitude ramp, its power capped at the approach's + 0.1, and a stall reflex;
  - progressive brakes, the stick following them, soft easing at the mass transfer.
  - Results: Cub 56–67 m three-point (old short technique 91–120 m); Jodel 79–104 m (old: gave up / 124 m); SS 57–58 m
    at light loads.
  - The SS at gross and aft CG still drops a wing at the stall (its tail authority; no in-flight stab trim).
  - Finding: the old SS "20 m" landing was a 100° ground loop after the STOL flare's power rolled the stalled wing.
- **GEN_BRAKES** (drum 600 N / disc 1400 N / double 2600 N a main wheel, with mass and price; absent = as before) and the
  Jodel on heel drums: handbook landing 165 / 165 / 151 m against the book's 150.
- **PROP-CLASSES:**
  - material efficiency on the whole thrust curve (wood 1.00, metal and carbon 1.08);
  - a Pitch tile;
  - a constant-speed class;
  - PHYSICS_V 8.
  - Roster: Stearman 92 → 98, PA-18 floats (metal prop) 63 → 92, woods and the float 172 unchanged, the SS 99 → 92, the
    DC-3 87 → 81 (it is 19 % light).
  - reports/evidence/PROP-CLASSES-2026-11-09 on that branch.

## Open questions for the user (each with a default)

1. **Count the drawn cowl bulges in the drag model's cover?** The CC340's heads are billed as bare, 0.083 m². Default:
   no (the user has not validated the bulge designs).
2. **Fly the tailwheel short-field stop as every taildragger's handbook schedule?** Quick check: Cub 90 m against 88,
   Jodel 80 against 150. Default: the Carbon Cub reference only.
3. **Promote the chord candidates** (Cub, float Super Cub at 1.60 m) over the shipped files? Those files are the
   calibration datum of about 105 and 56 checks. Default: no; the candidates stand in the report.
4. **The propeller classes and the brakes** (physics, PHYSICS_V bump). Default: not in this train.

## ONTO L36d (10 Nov, ~03:00 UTC)

- **Merged, not rebased:** master e79a114d8 merged into this branch (a71999598, then 3d5fb9eca built), because a rebase
  would need a force push (not done on these branches). The content is this branch's on top of L36d.
- **real_refs.js:** master's land V2-172 rows kept (`c172v2`, `c172x` supersededBy `c172v2`, the carboncub / stolcub
  rows). The draft **`c172v2f` floats row is left out**: its build file `builds/cessna172r_floats_2026-11-08.json` is
  not on master, and a PLANES row pointing at a missing file breaks real_report. It comes back with the floats build.
- **90_node_exports.js:** the union (this branch's `GEN_CAGE_ROW_NEUTRAL` + master's `genDriveTurf`).
  **HANDOVER:** both sides kept.
- **Built files:** rebuilt from the merged sources (`node flyDiy/tools/build.js`), own commit.
- **GATES: STILL RUNNING.** The full battery restarted at 01:12 UTC after a container restart. At 02:58 UTC it was at
  10/322 jobs (the heavy jobs first: DMGGEAR, INSTANT, RADIALDIV, HOUSEWORKER, TREECRASH). The result will be added
  here and pushed when it completes. Before this merge, the branch's own gates were as in the sections above.
- **Targeted gates (03:23 UTC)** - the full battery was stopped at the session's 2 h limit (11/322 jobs), so the gates that
  read what the merge touched were run: STOL, PWA, UPDATE, CARDS, SPECFIX, BENCH, CGBAND, RETRACT, DESIGN, CANDIDATES
  **PASS**; **JOINPARITY FAIL** - the same single Jodel line fails on plain master e79a114d8 (node 471.789 vs page 467.989
  kg, first node 0 S0BL), so it is master's, not this branch's; **PLANELISTS FAIL**, this branch's own and now FIXED: the
  three candidates indexed in d3a2953d6 were not on `builds/lists/plane_lists.json` (rows 47-49 added), and that commit
  had re-serialised `builds/candidates/index.json`, dropping `"official": true` from stol_cub_showcase and
  Twin_busher_floats_4b (the selftest's flagship probe went inert) - the file is master's again byte for byte plus the
  three rows. After the fix (4f88e2b1b): PLANELISTS (with --selftest) PASS, CANDIDATES PASS.
