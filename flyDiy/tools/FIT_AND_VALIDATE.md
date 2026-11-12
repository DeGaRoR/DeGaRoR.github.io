# FIT AND VALIDATE — fitting an aeroplane to its real parent, and proving it (method and best practices)

What REAL-FIGURES learned between 7 and 11 Nov 2026 fitting and checking 14 aeroplanes (Cub, Jodel, Cessnas, PA-18
floats, Carbon Cub SS, Chinook, DC-3, Tiger Moth, Camel, Stearman, Ruckus, Super Petrel...) against makers' sheets,
drawings and photos, with the user correcting each step. It is the brief for streamlining the procedure. It sits beside
`tools/REF_MATCH.md` (fitting a card to a 3D model, GLB) and does not repeat it.

## 1. The pipeline, in order

Each phase is finished before the next starts; a later phase never quietly changes an earlier one's result.

| phase | what | done when | tools today |
|---|---|---|---|
| A. References | the maker's figures, their conditions, the drawings | every row sourced, its conditions stated | `tools/real_refs.js` (REFS, PLANES, NOTES) |
| B. Geometry | shape fitted to drawings / photos / 3D model | the overlay matches, the user signs it off | `REF_MATCH.md`, photo / three-view overlays, `quickshot.js`, edits recipes |
| C. Internals | fuel, seats, systems, mass, balance | where the real ones are; CG computed with the pilot in | the garage rows, `real_check --quick` |
| D. Physics check | the flown lattice over the drawing | no visible mismatch; `geoparity` rows small | `tools/lattice_overlay.js`, `_geoparity_*.js` |
| E. Fly and measure | min / typ / MTOW, land and water, game pilot vs handbook vs sweep | numbers inside bands or explained | `real_check.js` (quick, full), `_petrel_trim_check.js` |
| F. Report and land | evidence, report, commit, HANDOVER | the final build files committed; the report regenerated on the shipped core, every result fresh | `real_report.js`, `reports/evidence/REAL-CHECK-<date>/`, `_real_stamp.js`, GATE REALBAND |

## 2. References (phase A)

- **The maker beats everyone.** The maker's sheet and handbook beat Wikipedia and reviews. Wrong secondary rows cost
  us twice: the Petrel's empty mass (Wikipedia 320 kg, maker 386 kg) and its climb (a range mixing the 100 hp and the
  115 hp turbo engines).
- **The exact variant and engine.** LS is not XP. A 912iS is not a 914 Turbo. A three-view of a sister type is a note,
  never the reference (the user: "Don't use the Petrel XP, that's not our plane").
- **Every figure has conditions.** State them on the row:
  - weight (brochures quote solo with half fuel);
  - flaps;
  - surface (paved, grass, water);
  - ground roll vs over 50 ft;
  - which speed it is. "Max cruise" is not Vmax.
- **Unknown weight becomes a range.** We fly min / typ / MTOW, and the reference must fall between them. A single
  number is never compared to a single load (the user, day 1).
- **Disagreeing sources become a range** with a per-row tolerance. A single-source reference is marked thin.
- **Keep the trail:** the URL, the date read, and a saved copy in the evidence folder. Today the confidence is guessed
  from the source text: make it a field.
- **Measure what the reference measures.** Length is spinner to rudder trailing edge, height is standing on the wheels,
  span is tip to tip.

## 3. Geometry (phase B)

- **Scale each view by its own published dimension.** Side by length, top by span, front by span. Set anchors per
  axis, check the datum on two markers, and use the user's own clean images (one view per file, transparent
  background) over a composite.
- **Work in batches, as the user dictates.** Do the whole batch, then publish ONE overlay ("publish the next one when
  your overlay is final"). Run no flight tests during geometry batches ("do not launch any tests... we're doing them in
  batches").
- **Order:**
  1. Proportions in the side view (sections' lengths, deck and keel lines, wing stations).
  2. The plan from the top.
  3. The front (span, dihedral, gear).
  4. The parts (cabin, engine / cowl / pylon, tail, floats).
  5. The details (lips, sockets, clips).
- **The drawing wins over a guess, the user's included.** Say so when they differ.
- **Show what the outline hides.** Add the bubble canopy's footprint, the antenna, the cabin's real end.
- **Every change is a garage row.** A missing control is a garage gap. Build it as a general row with a rule that
  holds for other builds; never a hard-coded exception. The user's test: "a clean way... useful for other builds".
  The Petrel's gaps all became rows:
  - the hull's tail cut (a transom);
  - the rod's socket through the aft float;
  - the pylon's own section and colour;
  - the cowl's inlet band and tail hold;
  - a lower-wing leading-edge tank bay;
  - tip floats sized by their own load, without the main floats' 60 kg floor.
- **Recipes, not hand-edited saves.** Use `builds/edits/<plane>.edits.json` + `tools/_rejoin_build.js` → a new
  `builds/candidates/<plane>_Vn.json`. Keep the previous version, and mark its PLANES row `supersededBy`.
- **Continuity:** move only the part asked. "Only the back portion of the cabin should move", so realign the wings if
  a cabin row drags them.

## 4. Measure what you think you measure

- **Measure on the game's load path:** `LB.loadBuild` (the page's own join: crew layer, energy write-back), never a
  raw spec or a headless bake. The bake skipped the crew layer, put the seats 0.30 m forward and read 9 points of
  stability margin too much.
- **Doubt the tool before the aeroplane.** The user found the Jodel's and the Petrel's lengths "can't miss 60 cm". The
  probe was counting 91 construction vertices nothing draws. Measure drawn faces only.
- **Frames:**
  - the physics pitch is the nose-to-tail-post line, 5.8° under the Petrel's keel;
  - cage units × `planeScale` = metres;
  - the physics datum is not always the firewall you see.
- **Clamps rewrite measurements silently.** Found:
  - the taper floor at 0.35;
  - the tail-post gap floor at 0.35;
  - the 60 kg tip-float floor.

  When a measured value and a flown value differ, look for a `genClamp` first.

## 5. Internals and balance (phase C)

- **Always compute the CG with the pilot in** (the user, on light aircraft).
- **Fuel where the real one is.** The maker's manual puts the Petrel's in the lower-wing leading edges plus a header.
  Build vessels in the drawn bays.
- **Seats from the drawing.** The crew layer measures them. A pillar is not a seat.
- **Evaluate before acting** ("check all of this before we do anything rash"). Use moment arithmetic:
  ΔSM = m·Δx / (M·c̄). The neutral point does not move with masses. Report options with numbers, let the user choose,
  and prefer the realistic option over the convenient one.
- **Known model limit:** occupants are billed on the floor (y = 0), so the vertical CG is about 0.1 m low. That matters
  for water attitude and the thrust-line moment.

## 6. Physics check (phase D): the lattice over the drawing

- **Render the flown nodes, beams and aero strips over the drawn aeroplane**, side / top / front, plus zooms of the
  tail and of the gear. It is the fastest way to find representation bugs ("a visual check might help identify critical
  discrepancies faster than looking at numbers"). In one picture it found:
  - the fin taper read as a 75/25 chord ratio instead of tip/root;
  - the tail post clamped 0.35 m aft;
  - a raised stab tied to the post through the rudder.
- **Explain what the picture shows.** The rudder and the elevators are not lattice members: they are the aft fraction
  of the strips. The user read the fin truss as the stab.
- **Pair the picture with numbers:** `_geoparity_lib` (dx, dh, dc per strip, and the area centres).
- **The tool:** `node tools/lattice_overlay.js <build.json> <out-prefix> [--views side,top,front] [--crop z0,z1,y0,y1]`
  (about 15 s).

## 7. Fly and measure (phase E)

- **Quick check first** (`real_check <key> --quick`, ~20 s): airframe, geometry, specs. **Full check last** (10-45 min
  a plane; the Petrel with water is about 2 h).
- **Like-for-like comparison:** the airframe (no pilot), the handbook technique, and the game's pilot, side by side.
  The difference between the game's pilot and the best of the technique sweep is the pilot's share. Fix the pilot,
  not the aeroplane, when the share is the error (the user: "feel like the pilot's fault").
- **Technique by gear type:**
  - a taildragger's short-field stop is not a tricycle's;
  - STOL take-off: flaps full, brakes held to full rpm, mind the tail;
  - brakes cost weight.
- **Speeds for the weight on board.** The pilot's sheet was the design load's. It is now scaled to the actual weight
  (landed 10 Nov).
- **Water** (amphibians):
  - rest, run, level, lift-off (SEAPLANES' trim check);
  - the hump trim (towing-tank band 8-12°);
  - the roll stability on the hump;
  - the game pilot vs the book technique (the rig).
- **Isolate with one-variable tests.** Ailerons held neutral, CG ±15 cm, stick full forward, sheet correction off: one
  change each, then decide. Don't chase rabbits (the user, explicitly).

## 8. Physics changes and gates

- **Physics changes are the user's decision.** Present each with its fleet impact.
- **Fleet scan before landing.** Every build in base vs new: stability margin, mass, the tail's fitted taper and post
  gap. Run `node tools/fleet_scan.js --json=<x>.json` in each tree, then `--diff=<base>.json,<new>.json`. A new rule's
  trigger (which builds it fires on) is still a one-off probe per rule.
- **Run the same gates on the baseline** (a clean worktree at HEAD) to separate pre-existing reds from yours.
  On 10 Nov all six red gates were already red on the baseline; two new findings hid among them.
- **Never edit sources while gates run.** Every gate then fails on a stale core.
- **Parity captures** (JOINPARITY) must be redone when the join moves an aeroplane on purpose. Say so in the HANDOVER.

## 9. Land and report (phase F)

- **The runner flies the live set** (`real_check --all`: not `dropped`, `supersededBy`, `next` or `branch:` rows; `--every`
  for all). Before 12 Nov it ran four dropped planes by mistake.
- **Re-run everything after a core change lands.** A pilot or physics change makes every flown row stale.
- **Commit:**
  - sources, then "(built)";
  - the final build file of every plane, with its PLANES row naming it;
  - the evidence folder with a README;
  - the report;
  - a HANDOVER entry naming the final versions and the gate status.
- **Use the user's set.** Ask, never assume (13 validated + Ruckus = 14; the cut planes stay out).

## 10. Operations

- **Long jobs:** detach them (`setsid nohup`). Worker restarts kill background jobs; re-arm monitors.
- **Disk:** about 1 GB free. Reuse a clean worktree for baselines instead of a new one; clear caches.
- **Harness traps:** `real_check.loadSpec` returns `{spec, errors, name}`, not the spec. `FLYDIY_STALE_OK=1` is for
  scratch probes only, never for a verdict.

## 11. What to streamline (the implementer's list)

1. **One command per plane.**
   `fit <key>` does: the overlay of the drawings → the quick check → the lattice overlay → the trim check (water).
   `validate <key>` does: the full check → the report row.
2. **Commit the scratch tools as tools:**
   - ~~the lattice overlay~~ **done 12 Nov** (`tools/lattice_overlay.js`; the CG / NP marks are still to add);
   - the three-view drawing overlay (scale per view, outlines, the bubble footprint): still a scratch script;
   - ~~the fleet scan~~ **done 12 Nov** (`tools/fleet_scan.js`).
3. ~~Stamps on every result~~ **done 12 Nov** (`tools/_real_stamp.js`): the build's blob, the core's id, the PLANES and
   REFS rows' hashes; the report's freshness block and per-plane chip.
4. ~~GATE REALBAND~~ **done 12 Nov** (`tools/_realband_check.js`, baseline `tools/realband_baseline.json`).
5. ~~Reference row schema + lint~~ **done 12 Nov** (GATE REALREFS, `tools/_realrefs_lint.js`). Still open: the trail
   (url, date read, quality) of the 14 references made before it; the lint lists them.
6. **Trim check:** read pitch on the keel, not the nose-to-post line, and split "boom" from "rudder" clearance. This is
   SEAPLANES' `tools/_petrel_trim_check.js` (not committed on this branch), so it is theirs to change.
7. ~~A short how-to~~ **done 12 Nov:** section 12.

## 12. Add a plane, and keep it honest (the perennial loop, 12 Nov 2026)

Every step names its tool; each one's usage is at the top of its file.

1. **The reference row** (`tools/real_refs.js` REFS). Give it:
   - `variant`: the exact type, variant and engine;
   - `sources`: `{ id: { what, quality, read: 'YYYY-MM-DD', url | noUrl } }`;
   - `rows`: each with `v`, `tol` and `src`, its conditions (`kg`, `flaps`, `surface`) and `from: '<source id>'`;
   - `dims`, `specs`, and `poh` (the handbook technique).

   Then run `node tools/_realrefs_lint.js`. It refuses a row with no conditions and a reference with no trail.
2. **The build.** Write a recipe, `builds/edits/<plane>.edits.json`, and run `tools/_rejoin_build.js` to get
   `builds/candidates/<plane>_Vn.json`. Fit it to drawings (sections 3 and 6) or to a GLB (`REF_MATCH.md`).
3. **The PLANES row:** `file`, `ref`, `label`, `short` and `listRow` (the plane list's row; null if none), plus `water` /
   `land` for an amphibian.
   - A refit gets a new file and a new row. The old row gets `supersededBy`.
   - A candidate waiting behind the list's file gets `next: true`.
   - A plane the user takes out gets `dropped: '<why>'`.
4. **Quick:** `node tools/real_check.js <key> --quick` (about 30 s). Run it, look at the overlays and the lattice
   (section 6), and repeat until the shape and the specs hold.
5. **Full:** `node tools/real_check.js <key> --json=reports/evidence/REAL-CHECK-<date>/<key>.json`. It takes 10 to 45
   min, and about 2 h for an amphibian. Every result is stamped with what it was flown on.
6. **The report:** `node tools/real_report.js`. Its freshness block lists every result that is not on the current tree.
   Re-fly those before quoting their numbers (`node tools/_real_stamp.js` lists them too).
7. **The baseline:** `node tools/_realband_check.js --write` takes the new plane into GATE REALBAND. Commit it with the
   build, the PLANES row, the evidence and the report.

**When the core or a card moves on purpose** (a physics change, a refit):
- GATE REALBAND goes red and names the planes, the numbers and the cause (the build file or the core).
- Accept the move with `--write`, then re-fly the moved planes (`real_check --all` for the live set) and regenerate the
  report. Until then, the report marks those results stale.
- Results flown before the stamps are stamped from the commit they were flown on, as the evidence README states it:
  `node tools/_real_stamp.js --backfill=<dir> --at=<commit>`.
