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

Full table: `door_swing_table.md`. Every number: `door_swing_survey.json`. Made by:

```bash
node flyDiy/tools/door_swing_survey.js <builds> --out <prefix>
```

Each build goes through the load door and is drawn twice: as saved, and with `pilSnap` 1. Each door is swept 0→90°
about the hinge line the hinge layer draws. RED = under 20 mm. "ON the closed door" lists what already touches the shut
door.

**Red today (as saved):** every repo build that has doors.

- Twin_busher_floats_2 and _4b
- both c172r Wiplines, both cessna172 files, the metal Cessna and the Cessna floats
- both Jodels and composite_jodel
- both Cubs, cub_fittings_hand, stol_cub_showcase and pa18_floats
- dc3 (starboard pilot door only) and ugly_bi

No doors: both chinooks, Rufus, camel, mosquito, stearman, tigermoth and the twin floatplane fixture.

**Why they are red**, by obstacle (from the table):

| cause | builds | does the snap fix it |
|---|---|---|
| **a float strut root ON the door's skin** | _4b, Twin 2, both c172r Wiplines, pa18_floats, Cessna floats | **yes**. Float struts clear by 36–65 mm on _4b, 49 mm on the Wiplines, 52 mm on the Cessna floats and 158 mm on the PA-18 |
| **a step or plate on the door** (the step, the inspection plate, the static port, the venturi) | _4b, Twin 2, Jodels, Cessnas, Cubs, PA-18, ugly_bi | **yes**. The step goes to the B pillar; the other fittings move off the door |
| **the lift strut crossing the door's arc** (0 mm at 13–28°, the _4b passenger door 3 mm at 90°) | Cessnas, Cubs, PA-18, Twin 2, ugly_bi, _4b's passenger doors | **no**. The strut runs from the fuselage to the spar station over the door; the foot moving to the pillar does not take the strut out of the arc. On _4b's passenger door it moves the hit from 90° (3 mm) to 78° (0 mm), because the foot went 0.19 m aft to the B pillar |
| **the wing root over the door's top or sill** (0 mm from 3–13°, "ON the closed door: wing") | Cessnas, Jodels (low wing: the door's bottom on the wing root), Cubs, PA-18, Twin 2, ugly_bi | **no**. This is the user's own _4b fix (wing raised, wgDy −0.12 → 0); _4b's doors now clear the wing by 33–64 mm |
| the gear leg ON the Cub's door | Cubs, stol_cub_showcase | no |

**_4b** (as saved → snapped):

- Pilot doors: **RED 0 mm → 38 mm.** The float strut root moved off the door to the B pillar, the lift strut foot from
  the door's bottom to the B pillar (0 → 49 mm), and the step to the B pillar. The 38 mm left is the step on the pillar
  beside the door edge.
- Passenger doors: RED 3 mm @90° → RED 0 mm @78°, against the lift strut.
- The door handle is the latch lever.

## 4. Gates

(running: GEN and the readers of the touched files, see below)

## 5. Renders

SwiftShader, `tools/plane_shot.js` from this branch.

| file | what it shows |
|---|---|
| `4b_doors_side_before_after.jpg` | _4b's port flank between the doors, the same framing (`at:` view), before and after. The lift strut foot moves from the pilot door's bottom to the B pillar. The float struts converge on the B pillar under the door seam. The step moves from the pilot door onto the B pillar. The handles are the new levers. |
| `4b_pod_aft_C_pillar_before_after.jpg` | The pod's aft end. Before, the rear float strut's root hangs in the air aft of the pod (the float's deck station is past the pod's end). After, it is on the C pillar. |
| `handle_before_after.jpg` | The door handle close (`fit:doorHandle`): the old 115 mm U grab, then the new latch lever (escutcheon, lever, grip at the latch edge, lock barrel) 25 mm from the latch edge. |
| `4b_side_before.jpg`, `4b_side_after.jpg` | The side preset. |
| C172-alike as born (snap on) | (shooting) |

Caveats:

- On today's phone page, plane_shot's own "hide the aeroplane" assert reads 0 % for every view (`CAGE_UI_SCENE.visible`
  no longer hides the build). Every still is therefore written as `_FAIL.png`. The pictures are good; the assert is a
  tool/page mismatch for CLOUD-SHOTS.
- In one browser session, the second build's `at:`/`fit:` target lands about 0.8 m off. Each build was shot in its own
  run.
- Under ~0.8 m the camera's near plane cuts the skin.

## 6. Questions for the user

1. **The check is strict, and today every build with doors is red.** It measures every drawn layer, anywhere in a
   0–90° swing. Mostly it is the wing root over the doors' tops or sills and the lift strut across the arc. Keep 90°,
   or give each build a door stop (a real door opens 70–90°)? Should the wing be in it?
2. **A red is a join NOTE today** (shown in the editor's status line and the join's notes; nothing blocks). Should it
   be an ERROR (the bench files errors as failed tests)?
3. **Which saved builds get the snap?** Today it is opt-in per build, through the 'anchors: on the pillars' row in the
   lift struts' foot group. _4b first: it clears the pilot doors (0 → 38 mm). The passenger door's lift strut stays red
   (now 78°): a door stop at ~70°, or the strut's wing fittings forward?
4. **User-picked pillar**: not built. The snap takes the pillar the frame roots the load on, so the drawing tells the
   truth. Picking another pillar needs the frame to follow, which is a physics change for that build only (a
   `bracing` field the join writes). Is that wanted?
5. **The C172-alike** (as born) roots its lift strut on the firewall ring, because its wing sits near the screen, so
   its foot goes to the A post. Fine, or should the frame root it on the B pillar (new births only)?
6. **The step on a 75 mm pillar**: its plate (176 mm) is wider than the post. Use a narrow pillar step, or the step on
   the lift strut, as on a Cessna?
