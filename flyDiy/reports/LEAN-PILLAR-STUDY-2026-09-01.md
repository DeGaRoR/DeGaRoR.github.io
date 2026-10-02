# THE TILTED PILLAR — a shear study (2026-09-01)

> **LANDED same day (user: "apply your change").** `cageResolve` applies the
> shear when `spec.lean` is set; P rows `leanPaxDeg` / `leanCabDeg` /
> `leanPivot` (0/0/'floor' = identity), clamp as proposed below. Verified:
> stock spec carries no lean and the zero-lean build hashes identical;
> 12° moves the roof by exactly tan θ·(roof−floor) with the floor pinned;
> 30° into the 0.8 m taper clamps to 0.400 m travel (15.0° effective) and
> the fold probe stays flat (33.25° → 34.10°); GATE CAGEFIT: PASS. The
> bench now drives the real path (sliders write the P rows). The editor
> rows landed too ("aft bulkhead lean" / "cabin pillar lean", rendered from
> 4 · cabin / dimensions in _cage_page5.js) and — after the user could not
> find them in the part tree — were CLAIMED by their parts in
> _cage_parts.js (the exactly-one-part invariant: leanPaxDeg → Passenger
> bay, new visible group "aft bulkhead"; leanCabDeg → Cabin, group "aft
> pillar"; an unclaimed row renders in PROPERTIES but vanishes from the
> part tree, which was the symptom). Verified IN THE GAME: both panels
> show and drive their slider, scene geometry responds at 12° and hashes
> bit-identical back at 0°. Quick gates run: PARTS, CAGEFIT, JOIN, DESIGN
> — all PASS (the full battery deliberately not run, user's call).

**The question (user):** most real light aeroplanes do not keep the cabin's
aft bulkhead vertical — the passenger pillar (pilot pillar on two-seaters)
leans, top aft / bottom fore. That slants the aft window edge and moves
stowage aft at shoulder height. Can the cage take a shear on that pillar
(and on the cabin pillar) without the surface growing an ugly bump where a
loop was tilted? Studied **disconnected from the game**: nothing in
`_cage_gen.js` or any shared file was touched.

**The bench:** `tools/_lean.html` + `tools/_lean_page.js` (launch:
`flydiy-lean`, port 8169 — any repo-root server works). Sliders for the aft
pillar and the cabin pillar (−25°…+30°), pivot (floor / waist / keel /
mid-height), the four presets (template, 2 pax bays, taper, round tube),
sections/normals/facets views, a 0° ghost, a fold probe, OBJ export.

## The verdict: a SHEAR is clean, and it is clean by construction

The pass moves control vertices only:

    z' = z − w(st) · tanθ · (y − yPivot)

with `w = 1` on the pillar's tight ring pair, fading linearly to 0 at the
neighbouring stations (`st` from the surface field `A` — the lattice's own
coordinate). Three facts make this bump-free where a "rotate the loop on a
finished surface" approach would not be:

1. **The surface is GENERATED from the rings.** Bays are single
   Catmull-Clark spans; tilting a ring re-slopes the spans on either side.
   There is no pre-existing surface to dent.
2. **A shear is not a rotation.** x and y are untouched, so every section
   keeps its drawn shape and the waistline/band rails stay dead straight —
   only z slides as a function of height. A rotation would shrink the
   band's projection and pinch it.
3. **lerp commutes with an affine map**, so the post-pass is
   vertex-identical to tilting the rings inside `cageResolve`: step-2 guard
   rings (constant-t lerps of the bounding rings) land exactly where the
   linear `w` ramp puts them. What the bench shows IS what an in-resolver
   lean would ship.

## Measured (fold probe = sharpest smooth-dihedral near the pillars, at L2;
creased families excluded via the mesh's own E map)

| case                              | 0° probe | leaned probe | verdict |
|-----------------------------------|---------:|-------------:|---------|
| template, aft pillar 12°          |   36.88° |       37.27° | clean   |
| template, aft pillar 20°          |   36.88° |       37.57° | clean   |
| template, 20° pivot=waist         |   36.88° |       37.55° | clean   |
| template, aft 12° + cabin 12°     |   36.88° |       37.27° | clean (parallelogram windows) |
| round tube, 15°                   |   21.34° |       21.46° | clean   |
| taper 0.8 m, 30° (83 cm top shift)|   33.25° |       40.92° | **folds** |

(The 36.88° baseline is the designed aft-shoulder transition at the pillar
— the lean rides it without adding to it.) At 12°/pivot floor the cabin
gains 20.8 cm of shelf at shoulder height for zero floor change; at 20°,
35.7 cm. The pax window's aft edge slants by exactly θ; leaning the cabin
pillar too gives the classic parallelogram rear window (Jodel/Robin look).

**The failure mode is displacement, not angle:** 30° into a 0.8 m taper bay
pushes the pillar top 0.83 m — past most of the neighbouring span — and the
taper roof creases (probe +7.7°). The knob therefore needs a clamp on
**shift**, not degrees: `|tanθ·(yRoof−yPivot)| ≤ ~0.5 × min(fore bay span,
aft bay span)`, evaluated per build (the taper preset hits it at ~20°, the
template not before the slider ends).

## The proposed real landing (one knob, in cageResolve)

`S.lean = { pax: deg, cab: deg, pivot: 'floor' }` (absent = identity — the
fit path stays bit-exact), applied to the `pilPaxA`/`pilPaxB` and
`pilCabA`/`pilCabB` ring pairs **inside `cageResolve`, on the built rings
just before return** — the crest pass already mutates rings in exactly that
slot, so there is precedent and a place. P-keys `leanPaxDeg`, `leanCabDeg`,
`leanPivot` ride through `cageSpec`/`cageToSpec` like any other row.

Why in the resolver and not a post-pass like the bench's:

- **cageInterior re-resolves rings from the spec** — with a post-pass lean
  the interior frames would stand vertical inside a tilted skin band. In
  the resolver, they follow for free (the bulkhead liner tilts WITH the
  bulkhead, which is the whole point for stowage).
- **cageBodyZones bounds zones with ring waist-z planes** — a tilted ring
  wants the zone border on the ring, not on a plane through its waist.
  Small (≤ half the shift at roof height) but real for zone-picking.
- `cageWindows` (winFrameW > 0) adds limit-stencil frame vertices AFTER
  emission — a bench post-pass cannot weight them, the resolver lean
  needs no special case (they derive from the already-leaned mesh).
- Everything else already follows in the bench: guard rings, the aStruct
  field, glass sill, cuts, canopy, rims, subdivision, win/door marks.

Cheap to land (~15 lines in `cageResolve` + 3 P-rows + the clamp), but it
touches `_cage_gen.js` + the editor's slider tables — **shared files; land
it WITH the user, per the tree discipline.** Check GATE FIT (identity path),
GATE JOIN (station anchors — the waist datum moves ~tanθ·(waistY−floorY)
aft at the pillar), and GATE DESIGN after.

Open questions for the user:
- default pivot: floor (bottom anchored, all gain at the top) or waist
  (splits the motion, keeps the door frame more square)?
- should the ROD's aft cap (the real exposed bulkhead) take the same lean?
- does the archetype/birth flow want a per-role default (utility fore-lean
  0°, tourer 8–12°)?
