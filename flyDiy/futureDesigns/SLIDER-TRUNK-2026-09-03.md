# THE COMMON TRUNK — a slider re-ordering (2026-09-03)

The user: *"The most frequent controls relate to: types (discrete choices
driving other options), move (aft-fore, inward-outward, up-down), size
(height, width, length), count. I think we should try and identify the common
trunk in all the controls and group them appropriately. Right now, essential
controls live alongside dispensable controls. We don't hide anything, but we
re-order."* Then: the fin and elevator geometry is hard to set; the engine
should separate the common options from the specifics, with the stand first
and the cylinder count left to presets; is every slider clearly associated
with a part, and who are the strange ones (the wheel radius under the gear,
not the wheel).

This is the census that answered, the decisions, and what is still owed.
Canonical for the trunk's rules is the `place` paragraph in
`tools/_cage_parts.js`; canonical for the mechanism is `render()` in
`src/viewer/editor.js`. HANDOVER carries the delivery.

## THE CENSUS

649 distinct parameter rows reach the editor (655 rendered — six keys are
shown twice on purpose, the engine's shared electric/piston rows). By widget:
488 sliders, 114 checkboxes, 38 selects, 15 steppers. Every row is claimed by
exactly one of 34 parts under 8 assemblies (GATE PARTS), so **"is every
slider associated with a part?" — yes, by construction, and the gate keeps it
so.** The question that had teeth was whether each was under the RIGHT part,
and whether the part's rows were in an order a builder can use.

Rows per part, largest first: cowl 91, engine 73, main gear 50, third wheel
50, fittings 45, fin 36, stab 33, cabin 27, propeller 23, lights 23, wing 19.
Those eleven are where the ordering matters; the other twenty-three parts
carry 1–16 rows each and were already legible.

## THE TRUNK

Every part now opens with the same four headings, each present only when the
part has something to put under it, and then its own groups follow:

| heading    | slot(s)               | what goes there                                    |
|------------|-----------------------|----------------------------------------------------|
| `fitted`   | `on`                  | the switch (the part's `gate`, or a station's own)  |
| `type`     | `type`, `count`       | discrete choices that drive the rest; then how many |
| `position` | `fore`, `out`, `up`   | fore / aft · in / out · up / down; meta = the anchor |
| `size`     | `len`, `wide`, `high` | length · width · height                             |

The rows are RE-PRESENTED under the trunk and taken out of their own groups,
so nothing renders twice and nothing is hidden. This is P8 §5's placement
strip (fore/up/len/wide) grown three slots and two headings; the editor's
`render()` builds it from the `place` table and GATE PARTS holds every slot
key to a row the part owns.

The glossary rule (a row keeps ONE label everywhere) stands. What changed is
the labels themselves, in the layer files, so that a row sitting in a slot
says what the slot says: `fore / aft`, `in / out (half track)`, `up / down
(leg drop)`, `height (tip up / down)`, `root length (forward point)`. The
domain word stays in brackets where the builder needs it.

## THE STRANGE ONES — rows filed under the wrong part, and what was done

| row(s)                              | was under                    | now under                     | why |
|-------------------------------------|------------------------------|-------------------------------|-----|
| `s1R`, `s2R` (wheel radius)         | Main gear / Third wheel      | **Wheels & tyres → size**, as `main wheel radius` / `third wheel radius` | the user's own example; the radius is the wheel's size, one row per station |
| `cowlLoops`, `cowlEase`, `cowlBulge` | Cowl → nose curve            | **Nose → cowling loft**       | they loft the CAGE's own nose cap (`S.config.cowl`), exist with the cowl layer off, and shape the nose part — a cage control living in a switchable layer |
| `tailRimN` (edge sections)          | Fin → thickness              | **Polycount → layers**, as `tail edge sections` | a facet count shared by fin and stab; a polycount row, not a shape |
| `crNoseCap` (two rows, two labels)  | Nose → tip AND `don't touch` | one row (`tip sharpness`)     | one key rendered twice under two names; the expert copy deleted from `_cage_page5.js` |
| `eng_mountGap` (stand-off)          | Engine → mount + firewall    | **Engine → position (fore / aft)**, mount group moved up to second | the user: "the stand is very important for engine placement" |

Looked at and deliberately LEFT where they are, with the reason:

- `propR` / `propZ` under Balance & stance: the stance solver's prop circle
  (ground clearance), not the drawn propeller. G132 joined the two; these stay
  the solver's inputs and the balance part is where the solver lives.
- `wsBaseLift` under Nose: it lifts the NOSE deck at the windscreen base; the
  windscreen part has its own `top offset`.
- `bulkZ` under Structure & skin: the aft bulkhead's station is a member of the
  structure, not a bay's row.
- `planeScale` (`size ×`) is EXPERT under Build → Scale — deliberate since
  G19g (the one stored size number, shown relative). Not a slider a builder
  should find by accident.
- `whBrake` (disc/drum) under Wheels and `s1Brake` (fitted) under the station:
  one is what the wheel carries, the other whether the station has one.

## PER PART — the trunk each one got

- **Nose**: position `droop`; size `length · width × · height ×` (`depth ×`
  renamed). Then shape, tip, cowling loft, rings, pillar (expert).
- **Cabin**: size `length · half width · roof height`; then dimensions, pod &
  canopy, rings, aft pillar, pillars (expert).
- **Skylight**: type `skylight`, count `sky extent`.
- **Pilot door**: fitted `pilot door`; type `door removed · deep jamb`;
  position `door sill`.
- **Passenger bay**: type `pax doors`, count `pax bays`; size `bay length`.
- **Taper**: fitted; type `taper panels`; size length · width.
- **Boom**: position `rod height`; size `length · rod diameter`.
- **Tail cone**: size length · half-width · roof height.
- **Wing panels**: type `tips · centre section · construction`, count `spar
  stations`; position `fore / aft · up / down`; size `root chord · span`.
  Then planform (crank, tip chord, tip aft), rigging, aerofoil.
- **Lift struts**: position `fore / aft · in / out (foot)`.
- **Control surfaces**: type `flaps`; then flap span/chord, ailerons.
- **Fin & rudder**: fitted; type `fin / rudder · volume · construction ·
  dorsal · keel extension · root · root loops`; size `root length (forward
  point) · height (tip up / down)`. Then ONE CORNER PER GROUP: tip (with the
  shoulder and top-pair bulge that ride with it), top-aft corner, base corner,
  leading edge (LE root + dorsal creases), rows, trailing edge, corner
  sharpness. Every corner row reads `<corner> fore / aft` or `<corner> up /
  down`.
- **Stabiliser & elevator**: the fin laid flat — fitted; type; position
  `fore / aft · in / out (root half-track) · up / down (over the keel)`; size
  `root length · span (tip in / out)`; then the same corner groups with
  `in / out` where the fin says `up / down`.
- **Engine**: fitted; type `powertrain · preset · layout · cylinders · two-row
  · electric style`; position `fore / aft (stand-off) · up / down`. Then mount
  + firewall (moved to second), geometry (bore, stroke, rpm, stagger),
  architecture, electric, and the dressing: cylinder dress, induction +
  exhaust, ignition, radiator, engine bay, services.
- **Cowl**: fitted; type `fit to the nose · inherits the section · openings ·
  end · edge`; position `fore / aft (stand-off from the face)`; size `length
  · half-width · half-height at the firewall`. Then body, section shape, seam,
  apertures, lip, bulges, scoop, fasteners.
- **Propeller**: fitted; type `blade material`, count `blades`; position
  `fore / aft (base off the flange)`; size `diameter`.
- **Main gear / Third wheel**: fitted; type `leg · steering · brake · fairing
  · leg fairing`; position `fore / aft · in / out (half track) · up / down (leg
  drop)`. Then fairing shape, and the leg-kind groups (blade, linkage, shock,
  oleo, castor) — each only while that leg kind is chosen.
- **Wheels & tyres**: type `carcass · tread · rim · hub cap · brake type ·
  fairing build`, count `ribs · rim bolts`; size `main wheel radius · third
  wheel radius`.
- **Seats**: type `seat type · layout`; position `fore / aft · up / down
  (squab height)`.
- **Cockpit & dash**: fitted `dashboard`; position `dash setback`; size `dash
  depth · dash lip`.
- Unchanged, and right as they are: Design & construction, Fuselage,
  windscreen, pilot window, window joints, aft deck / aft cabin (mirrors of
  the nose and cabin, same slots), Fittings, Structure & skin, Controls (each
  control keeps its kind next to its own x/y/z), Crew, Lights, Balance,
  Polycount, Scale.

## STILL OWED (named, not done)

1. **A fin `fore / aft` that moves the whole fin.** The fin's outline has no
   single position row — the root forward point and the base corner move
   ends, not the fin. A generator-side offset (`_fin_gen.js`) is a cage
   change, not a table change, and is the one thing this pass could not give
   the fin's trunk.
2. **The slider-per-slider review pass** the user announced. This pass ordered
   and named; it did not question any row's existence or range.
3. **`eng_bore` / `eng_stroke` as the engine's size.** They are the engine's
   dimensions in the trunk's sense, but they are mm per cylinder and read as
   geometry, so they stayed under `geometry`. A ruling if the user wants them
   under `size`.
4. The `position` heading meta (`at`) names an anchor for every part; the
   anchors for the wheels (`every station`) and control surfaces (`along the
   trailing edge`) are descriptive, not measured.
