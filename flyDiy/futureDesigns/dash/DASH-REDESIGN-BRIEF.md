# Dashboard redesign: the brief (A0, 18 Oct 2026)

## What the user wants
- **Their words:** "A proper dashboard redesign... Proper geometry for this thing, as specified, and as understood from references from the internet. A proper dash job. I think the whole top and front parts are OK, the sides and bottom are not, and being able to fit fuel tanks without collisions in there feels imperative."
- **Their stills,** in this folder:
  - `garage_dashboard_front_edge.webp`: the blue ring marks the dash's slanted lower front and side corner.
  - `garage_floor_pedals_seat.webp`.
- **Earlier review notes** (the garage review, 18 Oct, Train B):
  - Item 11: the dash must be empty at the bottom, with a STRAIGHT foremost vertical edge.
  - Item 12: a flexible dial layout. One row when the plate is wide enough; switches beside the dials when they fit. Room is reserved below a dial only where its switches really go there.
  - Room for tanks.

## What is known about the code
- **The slant:**
  - It is a hard-coded +0.15 forward push of the dash's bottom corners (`_cage_gen.js`, `zPillA` / `zPill`).
  - It was put there so no gap shows beside the pillar.
- **The dash shell:**
  - It is already hollow, with an open footwell below its flat bottom.
  - "Empty at the bottom" means a higher or optional bottom, so real tanks fit.
- **The dial layout:**
  - The 'did not fit' rule is a 2-D outline check, plus 38 mm reserved under EVERY dial for the switch row (`_panel_gen.js`).
- **Who follows the dash shape:**
  - the crew anchors, the panel plate, the brake knob and fuel selector (now placeable: Train A), the pedals' firewall fairleads (Train A);
  - the tank-through-dash fit test (`_cage_energy.js` / `_vessel_gen.js`).
- **Not yours:** the nose-tank slider range fix (60c_gen_energy.js:352 reads `fuse.cowlDeck` as metres) is EDITOR-UX-A's. It is a CG-safe split, Train B. Coordinate through HANDOVER; don't change the tank ranges or the default tank stations.

## Rules
- **Saved builds:**
  - The new geometry is the DEFAULT for new builds.
  - A saved build keeps its dash unless the user opts in (a version flag or a 'dash style' row).
  - The user has said this for item 11 ("the new default only").
  - Mass and CG are unchanged.
- **Acceptance:** overlay stills, before and after, on the validated builds:
  - the Cub (`builds/cub_2026-09-20_corrected.json`);
  - the Jodel (`builds/jodel_2026-09-20_corrected.json`);
  - the Cessna (`builds/cessna172_2026-09-20_corrected.json`);
  - the user's Rufus (`builds/rufus_2026-10-18_certified.json`, once landed).
- **Gates:** CAGEFIT, CABIN, PANEL, PARTS, ENERGY, JOIN.

## The user's design direction (18 Oct, 20:00): follow this
"I think the proper design is 1 mesh for the dash/black part, including the lip, but basically like an arch, and the flat front panel."
- **One mesh, like an arch:**
  - The black dash part is ONE mesh: the glareshield top, its lip and the two sides.
  - It is shaped like an arch over the panel: it comes down the sides to the floor or the cage side rails, with no closed bottom box.
- **The instrument panel stays a separate FLAT plate** at the front, in the arch, with the straight vertical edge.
- **The space under and behind:** the arch leaves the volume under and behind the panel open, so tanks fit without collisions.
