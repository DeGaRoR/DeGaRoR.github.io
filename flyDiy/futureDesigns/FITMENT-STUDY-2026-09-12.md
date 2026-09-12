# FITMENT STUDY — clipping, the wrong physics part, doors, the rod boom
(2026-09-12; the user: "some fitment clip through the fuselage, some move
because they're attached to the wrong physics model part (for example the
rudder and fin, and the stabs and elevators). The doors have no hinges. Parts
on rod may not have proper fitment. Do a study on this ... I want no clipping")

Rulings taken with the user this session: the instrument must be rigorous
but cheap, and must measure clipping IN FLIGHT after deformation; cabin doors
get hinges + a handle and stay shut; the fin, stab and tailwheel on a rod meet
BOLTED SADDLE CLAMPS, not the tube.

## 0. The instrument — GATE CLIP (P0, landed as G299)

`node tools/_clip_check.js` (~9 s, four builds). What it does and why it is
the first deliverable: "no clipping" was a screenshot until it was measured.

- `tools/_scene_headless.js` runs every DRAWING layer of `build.js`'s
  `MANIFEST.editor` under node with the real r128 three.js and a six-line
  document — the page's own `cageSheet` + `PAGE.post` chain, 0.6-0.9 s per
  build. Excluded: crew, panel, characters, energy, design, UI (need a person
  or a document). One context per process: a second build is a slider drag.
- `tools/_mesh_query.js`: AABB tree + SIGNED distance by angle-weighted
  pseudonormals against the DRAWN triangles (the airframe table is ±3.5 mm
  off, more than a fitting stands proud). A rim never votes beyond itself:
  past a hole's edge is "outside" (conservative), which is what makes an
  open loft (the wing panel open at its root, the fuselage minus a door)
  answer sensibly. The doorway's own column therefore reads outside —
  stated in the self-test.
- `tools/_pose_headless.js` reproduces the join's MEMBERSHIP (the ancestor
  name walk, `_cage_join.js:1694`) and the viewer's poses over it: every
  surface at full declared travel both ways about the hinge the join bakes
  (`cageSurfLine`/`cageSurfPlane`/`cageSurfHinge`, now pure and exported),
  a synthetic wing-flex parabola (5 % semispan) over the viewer's binding
  box with the strut's two-end follow, and on twin booms a ±40 mm
  tail-anchor throw over the parts the join anchors. A `userData.partOf`
  tag is honoured (the P1 contract) so the fix can be measured before the
  join learns it.
- Identity: the access layer records each site's triangle range per bag,
  the hinge layer each surface's fixed-half range (+ an `inner` bag for the
  bellcrank and torque-tube pivot, inside the wing by design), lamps carry
  their key and their sunk depth (`site.buried`).
- Cross-layer: signed distance into the non-skin solids (legs, castor,
  wheels, struts, hinge halves), accepted only inside the nearest
  triangle's own component box (a kit mesh is dozens of small parts and one
  wound wrong claimed a static port 520 mm away).
- THE RATCHET: `fixtures/clip_baseline.json` holds the 230 known lines
  (build | pose | fitting | skin → depth mm). Red only for a NEW or deeper
  (> 0.5 mm) finding; CLEARED lines are printed; `--rebase` rewrites after a
  chantier. Twin-boom `tail±` findings are a DECLARED GAP until P1.
- `--selftest`: a box inside/outside the flank, the door zone removed, the
  rim rule, a static box on the twin's fin flagged at tail+ and riding it
  once tagged, k = 0 stops the rudder, the rudder hinge is the declared line.

## 1. What the first run found (all real; every line probed)

Numbers are the worst vertex, stock build unless said.

| # | Finding | Depth | Class → chantier |
|---|---|---|---|
| 1 | `strutSkin.nrmAt` flipped any normal with +y; on a near-vertical flank the strut doubler's four bolts pointed INWARD, shanks 17 mm inside | 17 mm | **fixed in G299** |
| 2 | Spring gear leg (`legBeam`): the bezier bow (`ctrl x = half·beamBow`) passes THROUGH the lower flank/belly corner | 35 mm, 11 % of the blade | gear layer → P2 |
| 3 | Tailwheel spring root/clamp block inside the tail cone | 18 mm | gear → P2 |
| 4 | `inspAileron` cover sited at lv 1.25 ON the aileron cut: the wing loft is cut away there, the cover's forward half is inside the section, and the aileron sweeps into it at ±full | 17-21 mm; 5 mm from the aileron | access wing site must know the cut → P2 |
| 5 | Strap hinges assume the fixed side's skin is at hinge radius `r` (`lie = r + t/2`); the section thickens forward, so the fixed strap's far end is inside the wing (aileron/flap) and the fin/stab | 8-11 mm wing, 3-6 mm tail | hinge layer: lie measured off the mesh → P2 |
| 6 | Hinge pin + eye sit on the axis, inside the moving surface's nose drawn solid (a real nose is cut away at the hinge stations) | up to 44 mm | ALLOWED by rule (own nose); note for the hinge kit |
| 7 | Wing lamp with no bay cut (`CAGE_WING_BAY` absent, e.g. the twin): the fallback puts a PROUD housing 10 mm behind the LE, inside the wing | 42 mm (twin) | light layer → P2 |
| 8 | `commAerial` / `inspTail` on the twin's booms are placed where the FIN stands (inside `edFinSkin` / the fillet) | 22 / 17 mm | a peer's uncommitted `finBand` skip in `_cage_access.js` addresses this — coordinate |
| 9 | `commAerial` upright on the sloping deck: the blade root chord is buried | 6.5 mm | predicted by the study (`upright`) → P2 |
| 10 | `tieDownTail` (flat form) on the curved tail cone; `fuelCap`, `venturi`, `xpdrAerial`, `navAerial` on twin/IFR at 2-6 mm | 2-6 mm | flat forms conform / AF table → P2 |
| 11 | Tailwheel castor vs the rudder at full travel (the rudder's foot sweeps into the castor) | 11 mm | tail/gear clearance → P2 |
| 12 | Twin (mains on wing): the flap at full down comes onto the leg | 30 mm | gear vs flap → P2 |
| 13 | Twin trike: the nose leg roots INSIDE the nose cowl (the gear layer roots on the fuselage AF, which does not know the cowl) | 298 mm | gear vs cowl → P2 |
| 14 | Twin `tail±`: hinge fixed halves, boom collars, tie-downs, the beacon stay static while fin/stab/booms ride the anchor | 6-33 mm | **P1** (declared gap) |
| 15 | Beacon pod 1.1 mm deeper than its declared sink on the fin's rounded rim | 10.3 vs 9.2 | light seat off the mesh → P2 |

The AF-table class (§B.1 of the plan) did NOT show as a stand-alone finding
on these four builds beyond the strut normal: the access plates on the stock
body read 0.2-0.7 mm proud. It stays in P2 as the `strutSkin` swap because
the table is ±3.5 mm by measurement and the margin is 1.5 mm.

## 2. Priorities (unchanged by the findings, sharpened by them)

1. **P1 — a fitting rides the part it is bolted to** (`userData.partOf`,
   the join reads it first; hinge fixed halves per host, the beacon on the
   crown's owner, the boom fittings on their boom; `lamps.push` inside the
   parts loop; HIT_NAME rows). Flips CLIP's tail poses from declared to
   enforced. Finding 14.
2. **P2 — rest-pose clipping**: findings 2, 3, 4, 5, 7, 9, 10, 11, 12, 13,
   15 — the gate's baseline is the work list; each fix is `--rebase`d down.
3. **P3 — saddles on the rod** (fin root rim into the tube, stab, tailwheel
   doubler wrapped 80-95° round a 120 mm tube).
4. **P4 — door hinges + handle**, shut.

## 3. Traps met building the instrument

- Most-negative-over-skins is wrong: a far open patch folded at its rim
  read a fitting 2 m away as inside. The NEAREST skin decides.
- Ray parity is wrong on open lofts (the wing at its cove) and on
  overlapping closed parts (bolt heads in plates). Signed distance + the
  component box.
- The layers dispose their previous groups on every post: one context, one
  live scene — a scene handle from an earlier build is empty.
- `GEN_INFL` was not exported (`90_node_exports.js`), and `_cage_wing.js`
  falls back to 4, which picks no wing skin headless. Exported now.
- `_strut_gen.js` is CRLF while its neighbours are LF; anchor-based patches
  must normalise per file.
