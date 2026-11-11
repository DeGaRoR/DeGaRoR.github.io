# A NEW CONFIGURATION: THE WING-BORNE PYLON AND KEEL (the Archaeopteryx done properly) - a study (2026-11-11)

**The question (the user, 11 Nov):** the card's design is "slightly wrong because of this pillar and because of the way
the rod connects to the wing". The aircraft is a different configuration, so not vanilla. The wing has a socket in its
centre that takes the pod, blended into one proper surface, not two meshes. The rod connects straight to the wing. A
pillar goes down from that connection, at the wing's aft part. A beam goes forward from the pillar's foot, with the seat
on it, the pedals at its end and optionally supports for the controls. A member runs from the pedals back up to the
wing's leading edge. The cage's body design stays, but only as a very light fairing, separately built, with its own
materials, and with little integrity of its own. Where it can, it should extend the garage's philosophy: "the pillar
could be considered the equivalent of the joint between the cabin and the wing that we model today with a weight". Study
only: how to do it properly, and what it takes.

No code was changed. Three read-only surveys of the code (the Petrel's pylon and the wing centre, the frame physics,
the cage and the join) and the user's three photographs. Every hook below was opened and checked at the line cited.

## 1. The aircraft, read off the photographs

The load path runs from the wing down. Nothing in it starts at a fuselage.

- **The wing** is one cantilever piece across the centre, with root fittings; the published rigging is six ball-lock
  pins for the wings and tailplanes. Everything hangs from it.
- **The tail boom** is pinned to the wing's centre section at its aft part.
- **The pylon** comes down from that same aft point. It is a single vertical member with an aerofoil section, about the
  pilot's head height, and the main wheel sits directly under its foot.
- **The keel beam** is a grey tube, about 2 m, running forward from the pylon's foot to the nose. The seat hangs on it:
  a carbon back and a sling hammock. At its front are the rudder bar and a small nose shell.
- **The forward members** run from the beam's front up to the wing's leading edge. **On the photos these are two rigid
  dark tubes in a V, not a string.** On the Race version they also frame the two canopy halves, and the GPS is clamped
  to one. A rigid V takes compression too: a hard landing pushes the nose up into the wing. Two thin lines also run from
  near the pylon's top to the wing.
- **The cockpit fairing** is not structure. It weighs 6.7 kg (OSTIV 2015) and is removable; the Standard version flies
  without it. The pilot's legs drop through the floor for the foot launch.
- **Controls:** a side stick on the right, a handle on the left, the rudder bar at the nose. The instruments are
  clipped on.

## 2. Today against this

| | the garage today | the configuration |
|---|---|---|
| what carries the loads | the body: a ring-and-rail lattice of the cage's stations (61_gen_frame.js `genLattice`, :35) | the wing, then a truss hung from it |
| the wing's attachment | root nodes WF/WR tied by `'wing'` members to the 2-3 rings either side; a carry-through box across (:1325-1363, :1573-1584) | the pylon's head and the struts' heads on the centre section's spars |
| the tail boom | rooted on the aft bulkhead ring (`root: ring0`, :858; cage `zRodRoot = zPaxA`, _cage_gen.js:445) | rooted on the centre section's rear spar |
| the seat and pedals | hung off the cage's rings and keel (_cage_crew.js `anchors()`, :2450-2530) | on the keel beam |
| the main gear | legs rooted on two rings, two axle nodes `refs.mains: [GAL, GAR]` (:2638-2757, :3815) | one wheel under the pylon's foot |
| the body skin | the structure's cover: one material for the whole body (`fus.material`, _cage_join.js:683) | a fairing: its own light material, carrying nothing |

**The user's "joint modelled with a weight".** There is no lumped joint mass. The nearest things are:
- the Petrel's central cabane pylon (HULL-B78), which puts an inferred fairing mass on its base nodes (`pt(...)`,
  :1339);
- GATE LOAD, which treats the body as a fixed trestle: "Every non-wing node is pinned each step"
  (65_gen_loadtest.js:21);
- every member's mass, which is lumped half to each end node.

The analogy still holds as a design rule. **Today the wing-to-body joint is a set of root ties into the cabin rings. In
the new configuration that joint becomes a real member, the pylon**, with its own mass, stiffness and strength, which
fails like a member and is billed like one.

## 3. Part by part: what exists, what is new, where it plugs

### A. The wing's centre section with the socket

- **Exists:**
  - The centre section is lofted between the root rows in eight constructions (`GEN_CENTRE_KEYS`, 60_gen_spec.js:3637;
    63_gen_wing.js:1266-1350): solid, glass, open, cutout, foreCut, topGlass, topFuselage, removed.
  - **The Petrel's central pylon (HULL-B78, `bpCabPylon`)**: a faired blade from the body's roof to the wing's
    underside. It is real structure: its roots sit at ±0.12 m with cabane-class members, a CPB base truss and a
    fairing mass. Its skin is ray-cast to hug both surfaces (`pylonHug` / `pylonCaster`, _cage_eng.js:745-872), with
    quarter-round fillets and a joint bead.
  - `cageSubdivideRegion`, a crack-free local Catmull-Clark refinement (_cage_gen.js:10554).
  - An unmerged wing-root fillet (branch `claude/wing-fillet`). It refuses parasol and no-contact layouts.
- **What the user remembers as the Petrel's "socket" is that pylon.** There is no socket in the wing: the Petrel's wing
  and pod are two meshes meeting, fillets hiding the join. HULL-B78 left a known dark sliver behind the pylon. The
  pylon's station (0.40 of the chord) and length (0.55) are hard-coded (_cage_eng.js:1658).
- **New: a `socket` centre construction.** The centre section becomes its own Catmull-Clark control cage, owned by the
  wing layer:
  - the root aerofoil at each side;
  - in between, a local bulge that grows the pylon's head down from the aft part and the boom's root out of the
    trailing edge;
  - subdivided as one surface, so the wing, the pylon's top and the boom's root are a single skin;
  - outboard of the centre section, the wing is unchanged.
- **The cost and the risk:**
  - The core generates the wing's loft (63_gen_wing.js) and the join binds it by spar nodes (_cage_wing.js:13-19).
  - The cage generates the body as its own CC cage.
  - A blended surface means one owner for the centre section's geometry, with the core's strip and spar binding
    reading it back.
  - This is the most expensive single piece of the study.
- **The staged way:** first the Petrel's hugging fairing, made general (a station row and a length row instead of 0.40
  and 0.55). Then the one-surface centre section in its own chantier.

### B. The boom from the wing

- **Precedent: the twin boom.**
  - Its root is tied to the wing's spar nodes `w.F/w.R` and the box caps `FB/RB` (61_gen_frame.js:2059-2063).
  - The attachment bay is clustered rigid (:2080-2087).
  - The cage draws the booms from the wing layer, off the trailing edge (_cage_wing.js:2557-2700).
- **New:** a centreline boom, the same recipe at x = 0 (the cage's `boomX` minimum is 0.6 today), rooted on the
  carry-through's rear spar and lower cap.
- **Re-pointed:** the fin, stab and tailwheel saddles that read the rod's axis (`ROD_FIT.SADDLE`); the join's tail
  datum (`M.rodTailDatum`, _cage_join.js:1441-1461), so the tail arm is measured from the wing.

### C. The pylon

- **Precedent: the HULL-B78 truss.** It is a short roof truss of `'cabane'` members, not a mast to a wheel.
- **New: a member class `'pylon'`** (or the cabane's 4130 routing) from the root's aft nodes (WR/WB) down to a foot node.
- **To make it real:**
  - Its rows in the material table (`lin`, `k`, `c`, `phys`; 60_gen_spec.js:88). `row()` returns undefined for an
    unknown class, and k becomes NaN.
  - A `GEN_CRASH` row (:486).
  - Its place in the Euler-buckling list, which today is `cabane`, `interplane` and tube-`fus` only (30_solver.js:767).
    A new class never buckles otherwise.
  - Its place in GATE LOAD's yield accounting, which skips any class with no `lin` row (65_gen_loadtest.js:262).
  - Unpinning it in GATE LOAD: the rig pins every non-wing node, so a pylon, keel and nose would be bolted down. The
    rig needs the truss to read as "hung from the wing" (`genLoadCarried`, :92).
  - The cert floor: members get the wing's kappa only through `CERT_WING`; otherwise the body's 0.5 applies.
  - Its own damage part: `dmgPart` reads node tags (61_gen_frame.js:252-281), so a new tag falls into `'body'`.

### D. The keel beam, the seat, the pedals, the controls

- **New:** a chain of nodes forward from the pylon's foot.
- **Masses:** the occupant (`billAt(seatX, 80)`, :3327-3354) and the seat land on the keel's nodes, not on ring nodes.
- **The crew needs a new anchor source.** The seat, floor and pedals derive from the cage's rings today
  (`zBack = pilCabB.waist.z + 0.05 + seatZ`, _cage_crew.js:2513). For this configuration they come from the beam's
  polyline: the seat sling between two beam stations, the rudder bar at the beam's end.
- **Already separate named parts:** the stick, the yoke or side stick, and the pedals (`edCtl_*`, :340-571). The pedal
  cables already run to a fairlead (:646-660), the precedent for drawing a line.
- **The optional control supports:** two short side arms off the keel at the seat, a row each.

### E. The forward members (beam nose to the wing's leading edge)

- **Two choices:**
  - **Struts**, matching the photos: tubes that take tension and compression, with buckling (class `'pylon'` or a
    `'strut'` class).
  - **Wires**: `'wire'` with `{tens: true, pre}` (61_gen_frame.js:1651; solver 30_solver.js:1186), tension-only.
- **Their heads:** on the centre section's front spar (WF nodes). They pay drag as `ext` members (62_gen_aero.js:1586).
- **Recommendation:** struts. A wire leaves the nose free to fold up on a nose-down landing; the real tube does not.
- **The thin lines from the pylon to the wing:** wires, as drawn.

### F. The main gear under the pylon

- `B()` accepts any nodes, so a leg can root on the pylon's foot.
- **What blocks it:**
  - the hard-coded ring indices for the anchors (:2638-2642);
  - `refs.mains` being two nodes, assumed by the solver and the cert (30_solver.js:949, 1578, 3941, 4283).
- **Cheapest:** two axle nodes a few centimetres apart under the foot (a "narrow pair"), plus wingtip skids. This
  stays inside `refs.mains`.
- **Properly:** a monowheel gear type with tip skids and the ground handling of one wheel. The gear gap is the same
  one STUDY.md §5 gap 4 already names.
- **The other contacts:** a nose skid or small wheel at the beam's front; a tail bumper.

### G. The fairing

- **The cage's body is drawn as it is now, but as a fairing.** `covering: 'fairing'` through the tile, the join and
  the core.
- **No lattice from the cage's stations.** The frame's `SHELL` / `fusCovered` logic (:885) assumes the body is the
  structure, and is bypassed.
- **Its own material rows:** ripstop over poles (~0.15 kg/m²), a thin glass shell (~0.5 kg/m²). Billed as cover mass
  per m² on the keel and pylon nodes.
- **Its drag:** the body CdA (62_gen_aero.js `genFusCdA`).
- **"Very little integrity":** a damage group of its own with a tiny strength. In a crash it tears or caves in, but it
  carries no flight load. Without the beam it would collapse under the wing, exactly the user's test.
- **Already prepared:** the cage's per-bay construction map (`S.interior.consMap`, _cage_gen.js:9759-9768) holds one
  entry per bay, all the same today. It is ready for the fairing's mixed constructions.

### H. The drive and the battery

- **The pusher** goes on the pylon's aft face or the keel's aft end, with the shaft as today (`cw_noseOff`).
- **The aft pod** (the aero aft, with this branch's `aeroAftOver`) belongs to the fairing.
- **The battery** goes on the keel beside the pilot, where the real one is. That also answers the open -10 % static
  margin: the real aircraft's CG sits under the wing because its heavy parts hang there.

### I. The join and the spec

- **A datum not tied to a firewall.** Today the station block is skipped when no firewall is found (`fwOk`,
  _cage_join.js:1350-1359).
- **The wing's station read directly**, not from the cabin ring.
- **A new spec block**, e.g. `spec.frame = { kind: 'pylon', pylon: {...}, keel: {...}, struts: [...], boom: {...} }`.
- **The fairing's covering and material.**

## 4. The garage's way, kept

- **A mode key, bit-identical when off**, like the hull's `hullOn` (absent from the spec while off, GATE FIT and the
  mesh hash proving it).
- **A tile on the design page:** the body "Cabin (structural)" or "Pylon and keel (the wing carries)".
- **One spec still drives both the drawing and the physics**, so the numbers live in one place.
- **The pylon is the cabin's root ties, become a member**, the user's analogy. The keel is the cabin's floor rail,
  become the structure. The fairing is the cabin's skin, freed from carrying anything.
- **Every new member** has a material row, a crash row, a buckling entry, a cert envelope and a gate line, the
  STRUCTURAL RULES the HANDOVER lists.

## 5. Risks

- **The solver:** light nodes on stiff members cost substeps. A pylon and keel of a few kilos under an 80 kg seat
  needs its masses checked against the substep budget.
- **Mirror snap-through at the pylon's foot and the gear** (Rule 10, :2739-2747): anchors in one plane let the axle
  flip to its mirror.
- **GATE LOAD's trestle** (above): the rig must free the hung truss, or the load test measures nothing.
- **Classes skipped silently:** yield (no `lin` row), buckling (not in the tube list), cert kappa (not on a wing part).
- **Aeroelastic re-rigging:** members landing on strip-carrying wing nodes (:1471-1473) change the wing's flex and
  torsion, which GATE FLEX measures.
- **The one-surface centre section:** two generators would have to agree on one surface (§3 A).
- **The attitude references** `noseFrame` / `upLo` / `upHi`, `tailMid` and `fusDrag` (:3809-3826) are taken off the
  body's rings and must be re-pointed.

## 6. What it takes: a staged plan

The hull (HULL-B1..B3) is the precedent for the size: one mode key and ~10 rows, 11 files, a frame branch, a join
measurement, and GATE HULL. This is larger: a new frame topology, the crew's anchors, the gear's refs, a new covering
through the core, and the load rig. **About two to three hull chantiers.**

- **P0, the contract.**
  - The mode key and the spec block; absent and bit-identical when off.
  - GATE PYLON's skeleton.
  - The configuration's rows on the design page, inert.
- **P1, the physics frame** (61_gen_frame.js, the largest piece).
  - Root ties replaced by the pylon from the centre section's aft nodes; the keel; the struts to the front spar; the
    boom on the rear spar (the twin-boom recipe at x = 0); the narrow-pair gear under the foot.
  - The ledger rows: `pylon`, `keel`, `struts`, `fairing`.
  - The material, crash and buckling rows; the load rig unpinning the hung truss; the cert.
  - GATE PYLON:
    - the wing alone holds the airframe in the sandbag test;
    - remove the beam and the fairing collapses;
    - remove a strut and the nose folds.
- **P2, the drawing.**
  - The pylon (aerofoil section) and the beam; the struts and wires.
  - The boom from the wing's centre, with the saddles re-pointed.
  - The crew on the beam (seat, rudder bar, side stick), the gear under the pylon.
  - The join reading all of it: the wing-first datum, the tail arm from the wing.
- **P3, the fairing.**
  - `covering: 'fairing'` through the tile, the join, the mass and the drag.
  - Its materials; its damage group.
  - The cage's body as its geometry; the aft pod as part of it.
- **P4, the blended centre section.**
  - First the hugging fairing generalised (station and length rows).
  - Then the one-surface centre section owned by the wing layer, the costliest step.
- **P5, the card.**
  - The Archaeopteryx on the new configuration, its masses against the published 54 kg, flown in GATE ARCHETYPES.
  - The current pod-and-rod card retired or kept as the "cabin" variant.

## 7. Decisions for the user

1. **The forward members:** rigid struts (the photos) or strings (wires)? The study recommends struts.
2. **The centre section:** the generalised hugging fairing first (P4a), or straight to the one-surface centre section?
3. **The main wheel:** the narrow pair (cheap, inside the solver's two-mains assumption) or a real monowheel gear type?
4. **The fairing's integrity:** cosmetic only, or a damage group that tears and collapses?
5. **Where the motor and the battery go:** on the pylon's aft face or the keel's aft end; the battery beside the
   pilot.
