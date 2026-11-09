# PROPER-COWLS READY 1 (CABIN-CRAFT, 9 Nov 2026, for train L36d)

Branch claude/ready/proper-cowls-int (pushed under that name: claude/ready/proper-cowls is the cloud session's ready), on master 7daba875d (L36a). Code 21633574a, built c77af8204 (build 56574ba19dcc; flight_core unchanged). On top: this note and HANDOVER.

The user, 9 Nov, via A0: "the proper cowl work is really a great work, and so it should replace every cowl generator that we have. If we have to put the procedural cowl around an engine, we should always go through its methodology."

## What lands

- **The cloud session's cowl method** (claude/pensive-wozniak-ib8yjq 4f6862269, rounds 1-9 and the user's rulings in it), re-applied on master. `_cage_cowl`, `_cowl_gen`, `_cowl_rows`, `_cage_parts`, `_cage_eng`, `_eng_mesh` and `_eng_page` get the method's rows: the exit, the gills, the lowered bottom, the level split line, the pod plate. The Tiger Moth design (`builds/candidates/tigermoth_2026-10.json`) takes its new cowl.
- **The method's source**: `tools/cowl_study/straight.js` (`rowsFor` / `finish`: the straight cowl's rows for any build) and `clear.js` (the cheeks and helmets fitted to the drawn engine). Nothing calls them yet. READY 2 (the one cowl rule, `tools/_cowl_rule.js`) routes every cowl generator through them, per the user's rule.
- **Saved draws never move (Q1, A0: "saved draws must not move")**. `partLevel`, `partArc` and `podFit` are absent at master's drawing (`ABSENT_AT` 0). Two rows are new: "groove width even (metres)" (`partArc`) and "pod houses the engine (no plate)" (`podFit`). The generator's defaults are 1, so a new cowl gets the level split, the even groove and the plate-less pod. READY 2's births set all three to 1.
- Evidence of the method (from the cloud session): `img/b_*_today_*` vs `img/b_*_rule_*` (busher, c172, cub, jodel, radial, stol, tboom, tiger, ugly), `crease_study.*`, `README.md`.

## The user's rulings (9 Nov 17:05, via A0: "yes to all defaults")

- **Q1**: saved draws stay as drawn (this ready: `partLevel`, `partArc`, `podFit` absent at master's drawing).
- **Q2**: the reference-matched archetypes keep their fitted rows; the Tiger Moth design takes the new candidate rows.
- **Q3**: a procure engine swap keeps the cowl.
- **Q4**: the core aero nose is untouched.
- **Q5**: the groove-width fix and the pod no-plate fix reach new cowls only; saved planes stay as drawn.

## Identity (14 planes, the branch vs master L35d, cowl_identity: spec, def, ledger, price, sheet, design, certKey, procureFp, mass, nodes, beams, draw, fly20)

- 13 saved planes IDENTICAL in every key: cub, jodel, metal, floats, twinFloats, rufus, rufusCert, c172, c172floats, pa18floats, busher4b, petrel, stolCub.
- The Tiger Moth design DIFFERS by design (its new cowl): spec 43eebdced7082e74 -> 0f70ecff1de7b445; def 271848f550cba329 -> 592a95605a7f5c24; ledger af9c5be60b00c118 -> c3d752bdd82aa5ef; price 98562.23160144182 -> 98552.11037174823; sheet 2c13d4ed463eb345 -> e8934a64f33aa4c1; design fda36a2010a3cf74 -> 8ca618d7714caab6; certKey ae345de2 -> 3aca3562; procureFp 2346124d -> 5f1286f4; mass 812.4192655497446 -> 812.2035355490017; draw {"draw":"c86fa062","meshes":424,"verts":301728} -> {"draw":"3ba19103","meshes":421,"verts":299111}; fly20 c23d113243af49ce -> d5a6b9632b03d68a.

## Gates

Run one at a time (`run_gates --only=<ID> --jobs=1 --no-build`) on the L35d-based branch claude/proper-cowls 63b3657a2, which has the same code as this ready (patch applied clean on L36a, `_cage_parts` merged), CPU slot 9 Nov 17:56-19:54.

- **PASS** (16): COWL, ENGMESH, ENGDRAWN, CLIP, WINGROWS, PLANELISTS, UISMOKE, PARTS, PODEDITOR, HULL, FRAMES, DESIGN, KNIFE, CANDIDATES, STOL, RETRACT.
- **FAIL, master's own** (the same red on master, nothing of this ready's):
  - **ENGCONFIG**: the 9 pinned builds' hashes and the 6 multi-engine lines (quad level / cut 0 / cut 2, pushpull, trimotor, four) are byte-for-byte the FAIL lines in train L36b's gate log (master e789e77cb).
  - **GEN**: 76/77, "cruise is quiet in wind", the same check as L36b's GEN shard FAIL.
  - **JOINPARITY**: 5 FAIL (Cub and Jodel node = page masses, the Cub nose tank, the cessnaMetal fixture, "no tool flies a validated build raw"), the same 5 lines as L36b.
  - **POD**: "pod off, the whole def / the shakedown sheet is the base's bytes" for cub, jodel, c172, floats, twinf, metal, and "no pod - the certificate and 300 flown steps are the base core's" for cub, jodel, c172: stale base pins, by inference: the identity shows these planes' def, sheet, certKey and fly20 equal master's. POD was not in L36b's battery, so no master log proves it yet: A0 added POD to L36d's battery. If L36d shows exactly these 9 lines (and a master run confirms them), it stands; any other POD line takes this ready out. The pod's clearance and drag rows run as before.
- **ARCHETYPES**: timed out at 3600 s (the per-gate cap), so it is PARTIAL: its one FAIL, "Chinook-alike: the circuit completes - rejected-takeoff", is master's own (the same line in master d7e181f4e's archetypes tour log, reports/evidence/STOL-WING-2/gates); the Tiger Moth-alike rows ran ok; the rows after the cap are UNRUN (A0 fits a full run Tuesday morning).

## Cost

None at draw time for a saved plane (identity: the same meshes and verts). The method's files load only in the tools.

## Open

- READY 2: `tools/_cowl_rule.js`, the live entry. It routes births, procure swaps, pods and tiles, the preset menu and the tools through the method. With SEAPLANES for the fin pod / fin nacelle / gearFit nacelle / pylons (Petrel frozen).
- ARCHETYPES in full (the rows past the 3600 s cap; Tuesday morning, A0).
- Master's own reds named above (ENGCONFIG, GEN, JOINPARITY, POD stale pins, the Chinook-alike rejected takeoff): their owners, not this ready.
