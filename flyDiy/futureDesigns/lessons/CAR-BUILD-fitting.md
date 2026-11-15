# CAR-BUILD: lessons learnt on fitting a vehicle in the garage

The CAR session (branch `claude/fly-diy-car-build-uu6e6w`, 12-15 Nov 2026) built four cars from aeroplane cards: the
boat-tail roadster (Tiger Moth), the Dune Bug (Rufus), the Field Wagon van (Cessna 172) and the Ranch Hand UTV (Cub).
The van is the one that went wrong, got restarted, and then came good. This note covers what worked, where it
struggled, what the restart was, and what a new session needs on minute one. The user asked for it (via A0, 15 Nov):
"read the car session and how we got the van to look better. It says a lot about restarting clean, and what clean
means."

## 1. The workflow as it finally worked

1. **One base card, one edit set, one rejoin.** A build is never hand-edited. The van is
   `builds/cessna172r_2026-11-08.json` (the base) + `builds/edits/utility_2026-11.edits.json` (only the rows we
   changed) + an optional livery overlay (`utility_2026-11.retro.json`, `.mountain.json`), joined by
   `node tools/_rejoin_build.js <base> <out> <edits>[,<overlay>]` into `builds/vehicles/*.json`. Every change is one
   line in the edit set, then a rejoin of all three liveries. (Gotcha: the rejoin overwrites the top-level `name`;
   restore it, e.g. "Field Wagon Retro".)
2. **Proportions first, from a scaled reference, before any detail.** The user, 12 Nov 16:41: "project to scale on
   the drawing, and match the sections and global dimensions before the detail please. Nothing before the new
   outline." Tools:
   - `tools/blueprint_overlay.py`: the garage's side view, semi-transparent, over the scaled drawing. It is
     registered on the BODY's rear wall, not a fitting: a fitting put it 0.1 m off.
   - `tools/car_stations.js`: the section stations in metres.
   - `tools/car_lines.js --build`: the outline against the reference lines.

   The user drew the sections on the overlay in colour (cowl / nose / cabin with the angled A pillar / pax 1 / pax 2);
   we matched each station to about 1 mm (HANDOVER "CAR-3, THE USER'S SECTIONS, READ RIGHT", commit `3901de57`).
3. **The shape in a few global rows, never per-frame patches** (see section 3).
4. **Detail as new garage rows, absent = as before.** Every car feature is a row claimed in `tools/_cage_parts.js`, so
   any plane can use it:
   - arches `archOn` / `archGap`;
   - guards `carFender` / `carFenderGap` / `carStep` / `carStepY`;
   - rear windows `rearWinN` / `rearWinGap`;
   - bumpers and hitch `bumpF` / `bumpR` / `hitchOn`;
   - tow kit `carTowSign` / `carBeacon` / `carWipers`;
   - textured tyres `whTex` / `whTexPat` / `whTexDirt`;
   - headliner `hdlDepth`.

   A missing control is built as a row, never hard-coded in the card.
5. **Measure, don't eyeball.** After each round:
   - `node tools/ref_match/dump_build.js <build.json> <out>` dumps the drawn triangles per layer (sheet, cowl, gear,
     ...) in world metres. A few lines of numpy then give half-widths per station and height, tyre faces, and gaps.
   - The pinch between the bonnet (0.865 m) and the nose ring (0.75 m) was only found this way, and only after the
     user asked for a top view (`plane_shot.js --views hero:90/88/26`).
6. **Renders the user can judge, every round.**
   - `tools/plane_shot.js --build <b> --views hero:<yaw>/<el>/<fov>,at:x/y/z/az/el/dist --page dev.html`;
     `tools/convoy_shot.js` for the van + trailer + roadster.
   - Always front 3/4, rear 3/4, side, and top when widths matter.
   - The second build in one `plane_shot` run renders with its cabin lamps off: an artefact, not a bug.
7. **The car's physics is measured from the drawing.** `node tools/car_sheet.js <build> --out src/cars/car_<x>.json`
   re-measures wheels, track, hitch and mass into the vehicle sheet the drive, tow and trailer code reads. Re-run it
   after ANY stance change: it went stale once (track 0.82 against 0.97, fixed in `da97f638`).
8. **Gates before every push.** `node tools/run_gates.js --only=PARTS,DESIGN,GEAR,CAGEFIT,VEHICLE,LIVERYREACH,JOIN,KNIFE,UISMOKE --jobs=2`.
   Built files (`node tools/build.js`) go in their own "(built)" commit.

## 2. Where we struggled, and why

- **Tuning by accumulation.** Each round the user asked for something ("waist +12 cm", "the bonnet face at 70 %",
  "the nose 10 cm max") and we added or nudged rows on top of the last round. By the evening of 12 Nov the van's
  edit set had 165 rows: per-frame waists, roofs and floors, windscreen crowns and bows, nose squaring, lid rises. The
  user, 18:32: "your whole thing is curved. I don't know if you ever look at the seams. They are not lining up." The
  cause: per-frame rows (`frPostWaistY`, `frCabWaistY`, `fr*TopY`, `fr*BotY`, ...) each kinked one ring, so the sill
  kinked, the roof fell 12 cm aft and the bottom stayed round. No single row was wrong; the sum was.
- **Too little nose.** "the no section almost nothing, 10 cm max" taken literally (`noseLen 0.12`) made the nose ring
  glitch "in all direction" (16:34). The garage needs a real section there; we restored it to the drawing's 0.333.
- **A reference misread.** The first overlay was registered on a fitting on the rear wall, not on the body, and the
  stations came out 0.1 m off. The user: "I have not been clear, and your sections do not match. Ensure you understand
  the drawing" (17:06).
- **Squaring by guesswork.** "Square the nose" was done with per-frame widths; the user: "cancel what you've done with
  the nose section, it was good when you just matched it, there was no need to square it" (17:26). The right control
  was one row: `noseKeelSq` (bottom squareness), cherry-picked from FIT-PROCEDURE `f04a18ef`.
- **The wrong control for "squarer bottom" (15 Nov).** The per-frame bottom half-widths `fr*BotW` NARROW the keel
  (the seats came through the flanks). The control is `botRound` (0.05 -> 0).
- **A fix that broke continuity.** Narrowing the nose for the front wheels (`noseW 0.8`, task 23) left the nose ring
  0.75 m against the bonnet's 0.865 m: a step in plan view that nobody saw until the top shot. Fixed with
  `noseW 0.914` (`965e9b85`).
- **Artefacts blamed on the wrong thing.** Dark patches under the rear windows: we blamed the seats (moved them 12 cm),
  then the wall trim (switched it off). The cause was the padded headliner, which took a sill-height ledge for the
  ceiling and hung a slab whose back face was coplanar with the skin (z-fighting). A raycast probe in the page found it
  in one run (`_cage_gen.js`: the ceiling is faces within 30 cm of the crown; `f1708185`). Lesson: probe the geometry
  before moving parts.
- **Things through the skin** (a tank, a rod socket, reclined seat backs, pillar trim at the rear corners): found by
  probing the page's own scene. The headless scene has no seats.
- **Reinventing materials.** Painting the mudguards by hand failed: the join keeps only a material's colour. The user:
  "just give it exactly the same material as the fuselage ... You are reinventing the wheel." The fix: an AEROSKIN
  section `fenderSkin` (`{ parent: 'body', role: 'skin' }`), which inherits paint, finish, wear and markings.

## 3. The restart: what "clean" meant

**When:** 12 Nov 18:32. The user: "let's face it, it's really fucked up now ... you have to assume that something is
really fucked up in here, and so you have to come back to really simpler settings ... anything that you have fine-tuned
and move a lot of settings around, then yeah, you just get rid of it. Not any detail. Let's try to get the correct
shape. What you keep in place is the pillars for sure, and the global proportions." Commit `421a2226` ("the wagon reset
to its essentials").

**The starting card:** unchanged, `builds/cessna172r_2026-11-08.json`. We did not restart from a new card; we
restarted the EDIT SET: 165 rows -> 138. We removed 29, set 7 back to one value and added 2 (the diff of `421a2226`
on `builds/edits/utility_2026-11.edits.json`). The old set stayed in scratch, not in the repo.

**What we kept, the pillars and proportions:**

- `pilotLen`, `paxLen`, `paxLenLast`, `noseLen`, `wsRun`: the section lengths matched to the user's lines;
- `planeScale`, `halfW`, `roofHalfW`, `roofY`: the size;
- the bonnet, engine, wheels and legs, as they were.

**The 29 rows removed:**

- per-frame shape: `frCabWaistY`, `frPostWaistY` (the kinked sill), `frNoseTopW`, `frNoseBotW`, `frWinBotW` (the
  guessed squaring), `frPaxProfile`, `frPaxBulgeH`, `frPaxEase`, `frPaxBias`;
- the aero tail: `aeroAftLen`, `aeroAftDroop`, `aeroAftTip`, `aeroTipH`, `aeroTipW`;
- the windscreen fine-tunes: `wsBaseLift`, `wsTopOff`;
- the drawn windows and doors: `paxWin*` and `win2*` (14 rows), `doorPaxN`.

**The 7 set back to ONE value each (a global row in place of a per-frame one):**

- ONE roof: `frPaxTopY`, `aftRoofY`, `tailRoofY` all `1.0` = `roofY`. It had fallen 12 cm aft.
- ONE waist: `waistY 0.258 -> 0.147`.
- no drawn windows or passenger doors: `paxWinN 0`, `win2N 0`, `doorPax 0`.

**The 2 added:** `noseKeelSq 1` (a square nose bottom: one row instead of per-frame widths) and `paxSeatBays 1` (no
seats in the rear bay: their reclined backs came through the wall).

**Already uniform, left alone:** ONE floor, every frame's bottom at `-0.82` (`keelY`, `aftKeelY`, `tailKeelY`,
`fr*BotY`); the windscreen's crowns and bows at 0 (`wsBaseBow`, `wsCeilBow`, `bubble`, `noseCrown`, `dashCrown`),
from the user's 17:15 round.

**What we stopped carrying over:**

- the drawn passenger windows and passenger doors (the pilot door stays), until the shape was right;
- the C172's leftovers: the rod's bolted socket, the aft tank (moved to the nose bay), the avionics (the car systems),
  and seats in the rear bay (`paxSeatBays 1`);
- every per-frame fine-tune.

**Why it worked:**

- A per-frame row fixes one ring and kinks its neighbours. A global row moves the whole body coherently, so seams line
  up by construction.
- With no per-frame shape rows left, each later request ("waist +12 cm", "the step 10 cm up") is ONE edit with a
  predictable effect. The set grew back to 223 rows since, but every row added after `421a2226` is a feature or a
  global value, not a ring patch.
- Detail (windows, doors, bumpers, the rear relief) then went back on as rows with their own geometry, on a body that
  was already right.
- Everything after `421a2226` (the doors, bumpers, liveries, wheels, arches, guards, tow kit, stance) was additive and
  never needed another reset.

**The rule:** "clean" = the base card + the pillars (the section lengths) + the proportions (scale, widths, roof) + ONE
value per global shape row. No per-frame rows unless the reference demands a local feature, and no detail until the
outline matches.

## 4. What a new session must know on minute one

- Read `flyDiy/HANDOVER.md` (the CAR-3 entries, from "CAR-3 - THE FIELD WAGON"), `tools/REF_MATCH.md` and
  `tools/FIT_AND_VALIDATE.md`.
- The van is an EDIT SET, not a file to edit: `builds/edits/utility_2026-11.edits.json`, then rejoin all three
  liveries. Same for the UTV (`utv_2026-11.edits.json` over the Cub) and the buggy.
- Match sections and global dimensions to a scaled reference BEFORE any detail; ask the user to mark the sections.
- Prefer global rows (`keelY`, `roofY`, `waistY`, `halfW`, `noseW`, `botRound`, `noseKeelSq`) over per-frame ones
  (`fr*Y`, `fr*W`). If you are reaching for a per-frame row to fix a look, stop and check the global one.
- Look from the top as well as the side: plan-view widths (bonnet, nose ring, cabin) must run continuous.
- Measure with `dump_build.js` (triangles per layer, world metres). Probe artefacts in the page with a raycast before
  moving parts. Find what a colour is: material `userData.aeroFinish` names it, e.g. 'headliner'.
- A car feature is a garage row (`_gear_page.js` or `_cage_page5.js`), claimed in `_cage_parts.js` and gated by PARTS.
  A `when` must hang off a switch reachable in ONE change from the default plane (GATE PARTS' rescue rule; `carStepY`
  is gated on `carFender`, not `carStep`).
- New parts take the body's own material through `window.CAGE_SECMAT('<section>', ...)` with an AEROSKIN section
  (`src/viewer/aeroskin.js`). A textured part needs its own join bucket (`userData.propMat` or `tyreTex`) or the join
  keeps only its colour.
- After any stance change, re-run `tools/car_sheet.js ... --out src/cars/car_<x>.json`; the tow and drive gates read it.
- Cut parts: the windscreen faces carry `cutOff` (their explode offset); read them back the way
  `GG.cageAirframe` does.

## 5. Missing tooling

- **A shape-health check.** A gate row that flags kinks: the seam lines' straightness, the roof and floor level end to
  end, and the plan-view half-width continuity across the cowl / nose / cabin joints, with steps in cm. It would have
  caught the curved seams and the bonnet pinch without the user.
- **An edit-set "reset to essentials" helper.** List the rows of an edit set by family (pillars, proportions, global
  shape, per-frame, detail) and write the clean subset. The reset was done by hand.
- **The page raycast probe as a tool.** "What is at this pixel / along this ray: mesh, material finish, depth, other
  coplanar hits" (`tools/probe_ray.js`). It exists only in this session's scratch.
- **Headless seats.** `_scene_headless.js` has no crew layer, so seats through the skin are page-only.
- **A plan-view overlay.** `blueprint_overlay.py` does the side view only; a top-view overlay against a reference plan.
- **A rejoin that keeps the build's name** (`_rejoin_build.js` overwrites it).
- **The car sheet's freshness in a gate.** Fail when `src/cars/car_<x>.json` disagrees with its build's drawn wheels.
- **The page rebuilding textured gear parts.** `propBuild` knows neither `carPlate` nor `carTowSign`; in the game they
  fall back to their bucket colour.
