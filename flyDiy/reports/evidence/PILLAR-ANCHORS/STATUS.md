# PILLAR-ANCHORS: status

Branch `claude/pillar-anchors` = `claude/ready/pillar-anchors` (cloud session), **rebased on L30a (origin/master a8a23ad62)**,
for L30c. Commits: source first,
then one "(built)" commit.

**Pushed to `claude/ready/pillar-anchors` too** (the user's go, 3 Nov), for L30b; `claude/pillar-anchors` is the same
commit.

## 0. The user's calls of 3 Nov (through A0), and where each stands

| call | state |
|---|---|
| **P1** a door stop per build, default 75°, wing included | **Done.** Row `doorStop` (the doors' hinge group, 45–120°, 75 by default). The door-swing check sweeps each door from 0 to its stop. The wing is an obstacle like any other. |
| **P2** a blocked door FAILS the commercial certificate (DESIGN-AIDS' row) | **Interface ready; the row is DESIGN-AIDS'.** Their bench row `aid.doors` (tier `comm`, "Doors open fully (egress)", `origin/claude/design-aids` bench.js:205) reads `CAGE_DOORSWING.last`: `doors[].red`, `redMM`, `PILLAR_SITE.swingLine`. This branch keeps those names and adds `stopDeg` (and `doors[].stop`), so their limit text can say "to the 75° stop" instead of "0–90 deg". |
| **P3** every saved build with doors gets `pilSnap` 1 | **Done.** The row's default is 1 and it is absent from the file at 1 (`CAGE_DEFAULT_ABSENT`), so no saved build gains a key. On the validated builds the physics is unchanged (section 3). Every build whose drawing moves is named in section 4. |
| **P4** a user-picked pillar, the frame following | **Done, lowest priority as asked.** Row `wgStrutPil`: auto / A post / B pillar / C pillar. The join writes the picked pillar's ring station (`bracing.strutAt`, metres aft of the firewall); 61_gen_frame roots the strut on that ring; the foot is drawn on the pillar. On auto (every saved build) nothing is written, so the spec is byte for byte what it was. A pick set back to auto clears the stored station. GATE PILLAR checks a B pick on the C172-alike; on _4b a C pick puts the root on S2, the C ring. |
| **P5** the C172-alike's A-post foot | Kept as it is. |
| **P6** always a narrow pillar step | **Done** (the remodel below). |
| **the remodel** (the user: "I keep hating the step handle … the pixelated shape used as a base … the access doors … almost a texture job … The old U style would even be better") | **Done.** Pictures in section 6. **The "pixelated" base was `plateInto` itself:** a 9 × 7 grid with the points outside the rounded outline dropped, so every plate's edge was a staircase. It is now rings of the outline curve (smooth at any size, ~280 triangles). **The step:** a narrow pillar step — a turned boss on the post, one round stem bent out and down, and a 64 mm tread disc; no plate, nothing wider than a pillar. **The handle:** the latch lever and its base are gone; it is the table's U again, smoother (rounded feet, 10-sided bar, softer bends), ~640 triangles. **The inspection hatch and the hinged access door:** drawn, not bolted on — no plate at all, the skin's own colour inside, a 2 mm dark seam and flat screw heads (the hinged door keeps a slim hinge and a flat catch). A thin plate was tried first and failed: the fittings' paint is the livery's base colour, not the stripe it lands on, and so close to the skin it fought the skin for depth. |
| **landing** | Rebased on PHONE-1b; the gates are in section 5. |

## 1. What the snap does (`pilSnap` 1, now every build's default)

The physics already loads the pillars. The frame roots the lift strut on a fuselage ring and hangs the float truss on
two, and the join measures those rings off the pillars (noseGap ends on `pilCabB`, the cabin's length on `pilPaxA`).
What was not on the pillars was the drawing. On _4b, the lift strut foot was 0.15 m ahead of its node on the pilot
door's bottom, and a float strut root sat on the pilot door's skin. The snap draws each anchor on the pillar that
carries the ring the frame already loads, so the drawing and the load agree and no physics moves:

- **The lift strut foot** goes on the pillar that carries the frame's strut-root ring, or on the picked one (P4).
- **The float strut roots** go on the pillars that carry the frame's forward and aft rings. They are lowered below the
  doors' sills, to the frame's bottom longeron.
- **An anchor (the step, the grab handle) found on a door** goes to the nearest pillar.
- **Any other fitting whose footprint touches a door** moves off it, keeping its whole footprint outside every door's
  outline. Failing that, it goes wholly onto the door, where it rides the door; it never sits across the gap.
- **The door handle** is held to the latch strip.

One source, `tools/_pillar_site.js`, holds the pillars, the doors, the frame's anchor rules and the swing check.

## 2. The door-swing check

Each door is turned from 0 to its **stop** (75°) about the hinge line the hinge layer draws, against every drawn layer.
The door's own hinges, and the fittings lying flush on it, ride with it.

A door is **RED** when:
- something touches it shut (the "ON the closed door" column), or
- something it **moves toward** comes within 20 mm as it opens.

Something the door moves away from (a fitting beside its edge, the strut by its hinge side) is listed with "beside" and
is not a block. This replaced the strict minimum: _4b's passenger doors read 14–20 mm at 3° against the strut foot by
their hinge and open away from it. Touching is always a block.

The editor runs the check when the hand stops and shows it in the status line. The join shows its last answer as a
note. DESIGN-AIDS' row makes a red fail the commercial certificate.

## 3. The validated builds: the physics is unchanged

GATE PILLAR, on Cub, Jodel, metal Cessna, Cessna floats and the twin floatplane:
- no `pilSnap` in their saved cages, and they load with it on;
- **the flown spec through the load door is identical with the snap on or off** (the frame, the masses and every
  physics digest are the build's own);
- with the snap off, every layer draws the same vertices with the pillar module removed.

GEN passes. ENGCONFIG's physics digests for this tree are the same values master produced before this branch (its red
is standing, see section 5). Rufus has no doors; only its lift strut foot moves.

What the snap moves, per validated build:

| build | layers moved |
|---|---|
| Cub | wing (the strut feet), access |
| Jodel | access |
| metal Cessna | wing, access |
| Cessna floats | wing, float, access |
| twin floatplane | wing, float |

## 4. The door-swing table, before / after, and the drawings that move

`door_swing_table.md` (and every number in `door_swing_survey.json`):
- 39 build files on master after PHONE-1b, plus `review/flydiy-build (4).json` (no doors; its row is at the end of
  the table);
- **BEFORE** = the anchors as placed, swept to 90° (master before this branch);
- **AFTER** = the snap on, swept to the 75° stop (this branch);
- per door: the least clearance per kind (wing, wing strut, float strut, boom, anchor), "beside" or not, and what
  touches the closed door.

**Overall** (the 39 build files): 58 door rows; **RED before 56, after 51.**

**Cleared by the snap and the stop:**
- **_4b** (now on master): all four doors, least 21 mm (the step on the B pillar, at 8°). The passenger doors' lift
  strut by their hinge and the wing above them are "beside".
- **The DC-3's starboard pilot door**: 0 mm at 13° against the OAT probe before; clear after.

**Still red after, by cause** (the doors whose block is under 20 mm):

| cause | doors | builds | what would clear it |
|---|---|---|---|
| **the wing root over the door's top or sill**, mostly on the shut door | 56 | the Cessnas and C172 Wiplines, the Jodels, every Cub, the PA-18, Twin 2 / 3 / 3b / 4, ugly_bi | the user's own _4b fix: the wing raised (wgDy) or the door's top lowered |
| **the lift strut across the door's arc**, closing in | 40 | the same high-wing builds | a smaller stop, or the strut's wing fittings forward; a picked pillar (P4) moves the foot |
| **an anchor or fitting** the door closes on | 24 | the Cessnas, the Cubs, the Jodels, PA-18, ugly_bi | per fitting, next |
| **the gear leg** on the Cub's door | 18 | the Cubs, the Jodels | |
| **float strut** | 6 | Twin 3 / 3b / 4: their aft ring has no pillar, so the root keeps the deck station | |

(A door can have several causes.)

**The drawings that move per build** are listed at the end of `door_swing_table.md`: the layers whose vertices differ
before vs after.
- Every build with a lift strut moves its `wing` layer (the strut feet).
- Every float build moves `float`.
- Every build whose fittings sat on a door moves `access`.
- Builds whose drawing does not move: camel, mosquito, stearman, tigermoth, ugly_bi.
- The engine and cowl layers never read the snap and are left out of the list. One process building aeroplane after
  aeroplane redraws them differently; the camel drawn alone is identical before and after.
- The remodelled fittings change every build's fittings drawing, snap or not.

## 5. Gates

**On L30a (a8a23ad62), 3 Nov 14:42 UTC:** PILLAR, PARTS, DESIGN, SAVE, JOIN, CAGEFIT, FLOATKIT, FLOATS, GEN (4 shards),
STARTER, HINGE, FIT, FITMANUAL and BUILD pass. HANDLE (Twin_busher_floats_2) and CLIP (the IFR nav aerial) are the same
standing reds. Nothing is blocking. The rest of this section is the PHONE-1b run.

### On PHONE-1b

**PASS:** PILLAR, PARTS, DESIGN, SAVE, JOIN, CAGEFIT, FLOATKIT, FLOATS, GEN (4 shards), STARTER, HINGE, FIT, FITMANUAL,
BUILD.

**Red, standing:**
- **HANDLE**: `bugReports/Twin_busher_floats_2.json` — the handle on the hinge edge. Red on master since before this
  branch.
- **CLIP**: stock+IFR — the nav aerial 9.2 mm into the fin. Same.
- **ENGCONFIG**: IDENTITY against its pinned digests, and the three cards. Re-run on a clean PHONE-1b master worktree, it fails
  the same way **with the same digests** (cub `dbabd0baa8a84577 73e6b8c787a9ed0d`), so this branch's physics digests
  equal master's.

Earlier runs on this branch (FINISH-4 and before): TECH and NODUMMY were red on master too, in files this branch does
not touch. PARKED runs out of heap on master too.

## 6. Renders (SwiftShader, `tools/plane_shot.js`)

| file | what it shows |
|---|---|
| `remodel_step_pillar.jpg` | The narrow pillar step on _4b's B pillar: boss, stem and tread, no base plate. |
| `remodel_handle_U.jpg` | The smoothed U handle by the door's latch edge (the static port moved off the door onto the post beside it). |
| `remodel_hatch_drawn.jpg` | The belly inspection hatch, drawn: a seam line and flat screws on the skin, its own colour inside. This shot is from before the footprint rule; the hatch now sits clear of the door's bottom edge. |
| `4b_doors_side_now.jpg` | The newest _4b between its doors as it loads now: the lift strut foot and the float roots low on the B pillar, the step on the post, the U handles. |
| `4b_doors_side_before_after.jpg`, `4b_pod_aft_C_pillar_before_after.jpg`, `4b_side_before.jpg`, `4b_side_after.jpg` | The 2 Nov pair, on the pre-fix _4b: the foot moving off the pilot door to the B pillar; the rear float root that hung in the air aft of the pod, on the C pillar. The "after" handles there are the dropped lever. |
| `c172_born_snap_q.jpg`, `c172_born_snap_door_side.jpg` | The C172-alike as born: the foot on the A post. |

`tools/plane_shot.js` gained two views:
- `fit:<key>/<az>/<el>/<dist>`: one placed fitting, on the flank facing the eye.
- `at:<x>/<y>/<z>/<az>/<el>/<dist>`: a point of the cage, the same framing for two builds.

Its "hide the aeroplane" check reads 0 % on the phone page, so every still is saved as `_FAIL.png`; the stills are
good.

## 7. For the user

- **The step on _4b** stands on the B pillar right beside the passenger door's lower hinge leaf. A narrow pillar is
  shared by the hinge, the strut foot and the step. Lower the step below the hinge, or put it on the strut?
- **The wing root over the doors** is the most common red (the Cessnas, Jodels, Cubs). Is that wanted as a
  commercial-certificate failure for those builds, or should the validated builds be fixed first (the wing raised, as
  on _4b)?
