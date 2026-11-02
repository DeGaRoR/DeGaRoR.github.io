# PILLAR-ANCHORS: status

Branch `claude/pillar-anchors` (cloud session). Asked for by the user on 2 Nov through A0:

> "being able to snap the strut into the cabin pillar, and also to constrain the handles to go there (they are also
> modeled poorly) would be a great addition. Floats struts should also preferably go onto these pillars, and not try
> to go on the door areas, when possible. Pillars should really be the target for all fixation devices and anchors.
> We know perfectly where they are."

State: **work in progress.** Sections below are rewritten as results come in.

## 1. What was measured first (the trace)

On `_4b` (`builds/candidates/Twin_busher_floats_4b.json` from `origin/claude/ready/candidates-4b`), through the game's
own load door (`_load_build.js gameSpecFull`) and the editor's layers headless:

- **The physics already loads the pillars.** 61_gen_frame roots the lift strut on fuselage ring S1, and hangs the float
  truss on S1 and S2. The join measures those rings off the pillars (noseGap ends on `pilCabB`, the cabin's length on
  `pilPaxA`). So S1 is the B pillar's forward ring (cage z 1.614 m) and S2 the C pillar's aft ring (0.787 m).
- **The drawing did not.** The lift strut's foot was drawn 0.15 m ahead of its node, on the pilot door's bottom. The
  float struts were rooted at the float's deck stations, 0.4 m and 0.2 m from the nodes they ride. The forward root was
  on the pilot door's skin (y −0.525 against a sill at −0.583).
- **Doors.** The pilot door touches the float strut root from 3° and the lift strut foot at 13–23°. The passenger door
  touches the lift strut at about 80–90°. The fittings layer had put the boarding step (and a static port and the belly
  inspection plate) on the pilot door.

## 2. What is built

**One source.** `tools/_pillar_site.js` (`window.PILLAR_SITE`, in the editor manifest after `_fit_site.js`) holds:

- `pillarsOf(mesh, R, FS)`: the pillars as anchor sites, read off the resolved rings and the sheet. A, B, C, the mid
  pillars and the aero windscreen post, each with its band, its centre, and the frame ring it carries (`frame` and
  `zNode`). B carries ring 1 and C carries the cabin's rear ring. The A post carries the firewall's ring 0 when the
  firewall stands on it.
- The doors: each door's own skin triangles and edge runs, in metres.
- The firewall's station, by the join's own rule.
- `frameStations`, `strutRootStation` and `floatRootStations`: the frame's own anchor rules (61_gen_frame) applied to
  the pillars' stations. A layer that uses them lands on the very ring the physics loads.
- `inDoor`: is a point on a door's panel, or anywhere in its 0–90° swing.
- `swingSweep` and `doorSwingReport`: the door-swing check.

**The row.** `pilSnap` ('anchors': as placed / on the pillars), in the lift struts' foot group.

- It is 0 by default, so every saved build loads as it was.
- It is absent from `spec.cage` at 0 (`CAGE_ZERO_ABSENT`), so a saved build keeps every key it had.
- A card born in the design flow gets 1 (`_cage_design.js designFull`). That makes the snap the default for new
  placements and opt-in for existing builds. Nothing moves silently.

**With `pilSnap` 1:**

- **Lift strut foot** (`_cage_wing.js`): stands on the pillar that carries the frame's strut-root ring (B on `_4b`, the
  A post on the C172-alike, whose frame roots the strut on the firewall ring). The fore/aft trim then moves only the
  wing fittings. The status line names the pillar, or says why there is none.
- **Float strut roots** (`_cage_float.js`): on the pillars that carry the frame's iFwd and iAft rings. The struts are
  raked from the deck fittings up to the pillars. On a pillar the root walks down toward the keel until it is 40 mm
  under the lowest sill of the doors either side. That is the frame's bottom longeron, where its node is. Without the
  snap, the status line now names any strut root that sits on a door.
- **Fittings** (`_cage_access.js`): an anchor (the step, the grab handle) whose site lands on a door's panel goes to
  the nearest pillar at the same height. Any other fitting on a door's panel moves off it, to the nearest non-door
  skin aft of the firewall, or stays where it is if no such skin exists. Flush plates ride the door anyway.
- **The door handle**: a new latch lever (`FIT_GEN.FORMS.handleLever`): an escutcheon with a lever pivoted away from
  the latch, its grip at the latch edge turned out a finger's depth, and a lock barrel. It is ~230 triangles, against
  320 for the old U. It sits 25 mm in from the latch edge at the waist, and the two nudges are held to the latch strip
  (0–0.10 m along, ±0.15 up).

**The door-swing check.**

- Each door is turned 0→90° about its hinge line as the hinge layer draws it (`CAGE_HINGE.doors`, published now),
  against every drawn layer. The door's own barrels and the fittings lying on it ride with it.
- It reports the least clearance per door and per kind of obstacle (wing, wing strut, float strut, boom, anchor), and
  RED under 20 mm.
- In the editor it runs in an idle callback after a build (~1 s a door) and appends to the status line.
- The join reads that last answer as a **note** per red door (`door swing: …`). The join never computes it, because
  export runs on every preview.
- `tools/door_swing_survey.js` writes the repo-wide table.

**GATE PILLAR** (`tools/_pillar_check.js`, core) holds:

- The sweep against an analytic ruler.
- Snap-off identity on the validated aeroplanes: every layer's vertices are the same with the module removed.
- The B and C pillars on the C172-alike.
- The snapped placements on the C172-alike and the Cessna floats. It also prints their swing table.

## 3. The door-swing table, per build

(pending: `tools/door_swing_survey.js` over every repo build)

## 4. Gates

(pending)

## 5. Renders

(pending: `_4b` before / after, the handle close-up, the C172-alike as born)

## 6. Questions for the user

(pending)
