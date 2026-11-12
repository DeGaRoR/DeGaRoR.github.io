# RUCKUS READY (REAL-FIGURES, 12 Nov) — claude/ready/ruckus

**Order** (the user, 12 Nov: "stack the Ruckus after the struts and physics branches"):
1. claude/ready/phys-scale;
2. claude/ready/strut-options;
3. this branch.

**The cards** (A0 / the user's 10 Nov call):

| card | file | list row |
|---|---|---|
| Ruckus Solo 103 | `builds/candidates/ruckus_std_2026-11-09.json` | 51 |
| Ruckus Back-Country | `builds/candidates/ruckus_2026-11-09.json` | 52 |

- Both rows are candidates rows of builds/lists/plane_lists.json. 51 and 52 are free on claude/ready/plane-list-2 too;
  fold them into its scheme there.
- The struts card is a test plane (review/, on the struts branch).
- Recipes in builds/edits/; evidence in reports/evidence/RUCKUS-2026-11-09/; real_refs REFS / GEO / PLANES `ruckus`.

**What the cards need, carried here:**
- **NOSE-DECK** (cd859431e): row `noseDeck`.
- **GEN_BRAKES** (from 57e18a499): row `brkHold`, the friction cap per main wheel, the mass and the price. NOT that
  commit's experimental "feel arrival" in 43_pilot (PHYS-SCALE's flare kept), nor its real_check debug trace.
- **The rod boom's measured body profile** (from 7741c3a73, the join). On a rod the profile block never ran, so a build
  kept an earlier join's profile.
- **The Brakes tile's icons**, and its slot writing its own row only (GATE DESIGN).

**The weight A0 asked about** (the Solo 103, the same ledger script):

| core | empty | all-up |
|---|---|---|
| origin/master | 176.3 kg | 270 kg |
| PHYS-SCALE | 152.5 kg (profiled struts: the rows unknown there) | — |
| PHYS-SCALE + STRUT-OPTIONS + this branch without the rod profile | 159.5 kg | — |
| **this branch** | **155.5 kg** | **249.2 kg** (= practical-cerf) |

Section by section against master:

| section | change | why |
|---|---|---|
| bracing | -6.5 kg | STRUT-OPTIONS |
| wings | -5.4 kg | UL-WING, in PHYS-SCALE |
| slats | -5.2 kg | SLAT-KG, in PHYS-SCALE |
| fuselage | -4.3 kg | the rod's profile, this branch: 24.07 -> 20.28 kg |
| gear | +0.8 kg | MASS-SCALE and BUSH-WHEELS |

The real Part 103 airframe is 115 kg, so the wing and fuselage remain the open mass findings.

**Gates, run 12 Nov on this branch before the DESIGN fix, against PHYS-SCALE and the struts branch:**
- **Green:** STRESS, PILOT, TAKEOFF, TAILWHEEL, BIPLANE, PLANELISTS, BUILD, SKINMAT, FIN, JOIN, GEOPARITY, PARTS, STRUTOPT,
  CANDIDATES, PROCURE.
- **DESIGN:** red then on the Brakes tile; fixed (4ef95edba), GATE DESIGN PASS.
- **Red as on PHYS-SCALE:** GEN (cruise is quiet in wind), LOAD (the ultimate load), JOINPARITY's Jodel.
- **NEW in JOINPARITY:** the twin floatplane and the Super Petrel V4.1. Both are rod booms, moved on purpose by the rod
  profile (V4.1's node mass 583.4 kg against the page's 591.8, captured 8 Nov).
  - `node tools/join_parity_page.js --only twinFloats,petrel` was run here.
  - The twin's page booted in 705 s and reads 473.484 kg against the node chain's 473.443, so a small node / page
    difference remains beyond this change.
  - The Petrel's page did not finish inside an hour under SwiftShader on this machine.
  - **To do on landing:** the re-capture, on a quieter machine.

The rod profile also moves the Chinook and Rufus (7741c3a73's own measurement, quick, typ load: Chinook 293 -> 290 kg,
Vmax 154 -> 158; Rufus Vmax 151 -> 155 km/h, its file untouched).
