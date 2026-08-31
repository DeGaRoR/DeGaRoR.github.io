# flyDiy — ROADMAP (2026-08-26, v2: the vertical slice)

This document SUPERSEDES `HANDOVER.md` § ROADMAP (the sessions 1-6 / W-branch
list). That section stays where it is as history — its entries are cited all
over the handover — but the living plan is here. One chantier per session, the
battery green at the end of each, exactly as before; chantiers keep taking G
numbers as they happen and get written up in HANDOVER as always. This file
holds the ORDER and the WHY, not the as-builts.

v2, same day as v1: restructured around the game loop. v1 was a parts
pipeline — eight phases of bench and editor work with the game deferred to
the last three — which left the core hypothesis untested until after
materials. v2 puts the loop's first full turn immediately after wings and
interleaves bench work with loop work from there.

## THE GAME, IN ONE PARAGRAPH (the judging criterion for every phase)

Design your plane, see if it flies. Test it — yourself or automatically —
collect its stats, make some faster, some landing shorter, some carrying
people or heavy cargo. Collect your planes, customize them, get attached to
them, fly missions with them, modify them, build a fleet, and discover the
principles of flight by doing all of it. You are the engineer more than the
pilot: THE AUTOPILOT IS THE PILOT, and hand-flying arrives eventually as an
option, not as a gate.

## THE RULINGS

1. **BENCH UNTIL INTEGRATION.** The cage bench stays the working surface; the
   in-game garage is kept but frozen, and is REBASED at P10 on the bench's
   parameter model. This is the architecture G21 settled: the bridge between
   editors is the SPEC, not the UI — generators are modules, the game
   consumes the same modules. Nothing bench-side is lost; nothing is spent on
   the old panel meanwhile. The vertical slice does not contradict this: the
   harness is headless and the bench already exports the game's own build
   envelope.
2. **THE LOOP IS VALIDATED UGLY.** The slice (P3) exists to test whether
   design → fly → stats → hangar → mission is fun, with zero art budget.
   Every phase after it is judged by what it adds to the loop.
3. **THE PHYSICS-BEARING PARAMETER SET IS DECLARED, NOT DISCOVERED.** A table
   (written in P3, kept in HANDOVER) says which parameters reach physics —
   masses and positions from the dressed parts, areas and arms from the
   outlines, drag increments per feature — and everything else is DECLARED
   cosmetic. A player who finds sliders that move nothing on the plaque loses
   the engineering fantasy; a slider must either move a number or be honest
   set dressing. Corollary: aero is never re-derived from arbitrary mesh —
   that is a tar pit with no floor. Physics deepens by INCREMENTAL JOINS
   (the engine bench deriving mass from geometry is the pattern), never by a
   mesh-aero rewrite.
4. **SAVE COMPATIBILITY IS FOREVER, FROM THE SLICE ONWARD.** Builds become
   collectibles at P3; attachment means a build from a year ago must load
   forever. `GEN_SPEC_V` migration becomes a permanent discipline: every
   version bump ships its migrator, and the battery keeps one old build of
   each vintage as a loading gate.

## WHERE THE BENCH STANDS (2026-08-26)

| Part | Bench | State |
|---|---|---|
| Fuselage cage (template, creases, windows, canopy, interior, crew) | `_cage8.html` lineage (G12-G19) | live |
| Undercarriage | `_gear.html` + cage layer (G20, G21§2) | DONE, integrated |
| Cowl + propeller | `_pwr.html` + `_cage_cowl.js` (G21§4) | DONE, integrated |
| Fin + stabiliser | `_cage7.html` (G22, G23) | DONE, integrated |
| Engine, dressed, all ten registry families + electric | `_engine.html` (G24, G25) | DONE, **not integrated** |
| Rod & pod (taper section, rod boom, tail pod) | G26, `_cage8.html` | IN PROGRESS — rod in, pod remaining |
| Wings | game-side only (`src/core/6x_gen_*`) | not in the bench |
| Fuel / battery / payload systems | — | not started |

## THE PHASES

**P0 — finish what is open.** — DONE 2026-08-26 (G26 rod-and-pod by the
user; the engine into the cage is HANDOVER G29: dressed engine on the
genuine firewall, prop + nose cone re-parented to it, global detail dial
in polycount, no auto cowl fitting).
G26 rod-and-pod to completion. Then the engine into the cage: the cowl layer
consumes the dressed engine mesh instead of the bare `engResolve` envelope
(the fit contract already exists — the cowl wraps `env.hull`), firewall and
mount arteries land on the cage's own frame, and the G24.3 LOD ladder is what
the game will actually load — the hero build stays a bench luxury. Nose-mount
only here; wing mounts and pushers are P7's problem.

**P1 — panel grammar (tranche A of the UI revamp).** — DONE 2026-08-26
(HANDOVER G27, second pass G28: resize handle, chrome consolidated into
the panel, flattened nesting, polycount group, relationship audit
completed, waist-rides-edges + radial explode + flat seals; the gear
bench page and segmented button rows recorded as follow-ups).
The cheap two-thirds of the slider revamp, done BEFORE wings so every page
written afterwards inherits it instead of being retrofitted:
- §1 the control type is a property of the parameter, decided in `mkRow`:
  two-state → checkbox, short name-list → dropdown/segment row, small integer
  span → stepper, everything else a slider with a typeable number and
  double-click reset. G24.8 already made this ruling for the engine page —
  this generalises it to the row helper every bench shares.
- §2 existence is declarative: `when` (the cowl rows already carry it, the
  engine groups carry `show` — unify), `link: 'key'` replacing every −1
  "follows the front" sentinel with a visible checkbox, and
  `level: basic | detail | expert` replacing "don't touch" with a global
  expert switch. The conditionals become one auditable table per page.
- §5's glossary fix rides along: one word per concept (windscreen, width,
  sharpness, roundness), units in metres after `planeScale`, one sign
  convention stated once (+forward, +up, +pilot's left).

**P2 — wings into the bench.** — STARTED 2026-08-26 (G30: the game wing
verbatim on the cage, binding-filtered extraction, deck/keel anchoring,
"6 · wings" panel; the rework arc — cage-style outline/creases, struts on
the cage, structure display — continues with the user).
Import the game's wing generator (`6x_gen_*`) as modules — the G21 move,
again — and rework outline, tips, crank, sweep and creases in the cage style,
against the live fuselage the way the fin was built against the live deck.
The physics contract (`62_gen_aero`) does not move. STOL is NOT implemented
here, but the geometry RESERVES it: hinge lines, aft-spar nodes and slat/flap
station allowances exist from the first build, so P12 adds surfaces without
rebuilding the wing.

**P3 — THE VERTICAL SLICE (the hinge).** — STARTED 2026-08-28 (G35: the
cage editor EMBEDS in the game and replaces the old garage panel — the
P10 "garage rebased" move pulled forward by the user; the old game is
archived whole as earlierVersions/2026-08-28-preP3-last-old-garage.html;
the hangar room carried over as the editor's backdrop, matured G40-44
into the part-system material library + real lighting).
THE JOIN LANDED same day (G45): the declared physics-bearing table is
in HANDOVER (ruling 3, written before the button), _cage_join.js maps
it, `build & fly` ran export → the save pipeline → the stand (that
button is retired at G65; the export is a step inside testing and
rolling out now), and the FIRST FULL DESIGN→FLY TURN is verified — an editor-set 912 + 11.6 m
wing flew ROLL→LIFT-OFF→CLIMB on the AP. THE PLAQUE landed at G60.
THE SHELF landed at G63 (the user: "the save/import mechanism seems
broken, and it is somehow redundant with the presets in the editor") —
one store and one format instead of three, the editor finally LOADS
what you loaded, the join UPDATES instead of replacing, the stock
designs are ordinary builds, and GATE BUILD is the loading gate
ruling 4 has been promising since the slice opened.
THE ENGINEERING BENCH landed at G64 and the FLOW COLLAPSED at G65, so
P3's turn is now a turn: pick the Garage build and you are in the
hangar editing; the bench tab runs a DECLARED LIST of tests and the
plaque fills from them; any slider withdraws the certificate; ROLL OUT
& FLY exports through the join and flies what you built. No
intermediate screen anywhere in it. The wing loading came back with the
aeroplane ON ITS BACK — how a homebuilt sandbag test is actually done,
and the only way the bags can push the wing the way they look like they
push it (the rig loaded +y while the viewer drew the bags on top; the
physics was right and the picture was not). G46's declared visual gap
closed on the way past: the save carries the cage, the editor is seeded
from it, and the snapshot is REGENERATED — no mesh bytes in storage.

REMAINING in P3: the ONE MISSION. The logbook stub it writes into
exists (built date, tests, flights) and nothing reads it back yet.

FOUND BY PUTTING BOTH ON SCREEN (G65.1): the editor's cage build and
the physics lattice stand ~2.8 m apart along the room, and always have
— placeEditor grounds the build and leaves it at the CAGE's own datum.
It was invisible while the two were never up together. The instruments
now measure the gap and follow the aeroplane you can see; moving the
BUILD onto the lattice instead is the deeper fix and wants its own
chantier, because it re-places the aeroplane in a room P11's own work
is composed around.

TEST FLIGHT — BUILT at G107 (2026-08-31), exactly as declared: IN PAGE, an
offscreen fast-stepped circuit flown by THE TEST PILOT (`41_test_pilot.js`,
the second autopilot — `makeAutopilot` forked verbatim and given BOUNDED
ATTEMPTS WITH STRUCTURED VERDICTS: rejected takeoff, put-down from a
ground-effect hover, accepted ceilings, terrain go-around, a watchdog).
Generated builds fly it in the game too; the hand-built fleet keeps the old
AP so its eleven gates stay benchmarks. The LANDING RUN is on the plaque,
GATE PILOT (core, --selftest) holds it negative-first, the strips wear
TOUCHDOWN MARKERS at the registry's own tdz rule, and the dalt row went
ADVISORY (TESTED is not PASSED). THE TEST CARD landed at G107.1 (same day):
target altitude + target speed on the flight row, the pilot clamps an unsafe
ask to its OWN approach speed and says so, flown means judged against the
ask on the plaque, 'cant-hold-speed' said with both numbers — tried in the
game on the user's 0.10 m/s WIP: "REJECTED TAKEOFF — card-clamped,
wont-climb". THE ARRIVAL CARD landed at G107.2 (same day): the flight ends
with a card — outcome, touchdown, landing run, past the aim, the test card
asked-vs-held, the pilot's notes verbatim — for BOTH pilots (the fleet AP's
falls back to tdInfo), with "Fly again" (the dead bGo, fixed) and "Back to
the hangar". Still open from the arc: plaque persistence (blocked on the
load-path BENCH_DIRTY sequencing, wants the finish session).
The first full turn of the loop, ugly by design. Almost everything it needs
already exists — GATE GEN flies a generated aeroplane headless around a full
circuit and prints its stats (the SHAKEDOWN line: Vs, VCruise, L/D, wing
loading, static margin, TO run), the hangar exists (G6), saving a build
exists (G7), the aerodrome registry and multi-leg AP routes exist (W10/W11/
W14). The slice wires them into one player-facing turn:
- **The physics-bearing parameter set, declared** (ruling 3's table) — the
  minimal spec→physics join for a bench build: engine mass/position from the
  registry + dressed envelope, gear from its layer, crew, cage-derived mass
  and CG contributions, wing from P2. Written down BEFORE the button, so the
  plaque's numbers are known to respond to known knobs.
- **TEST FLIGHT**: one button on the bench build. Export the spec, fly the
  harness circuit, return the PLAQUE — the stat card. Whether the button
  shells to node (the bench's verdict pattern) or steps the sim in-page (the
  game already runs the same sim in the browser) is the chantier's first
  decision; neither needs the game shell.
- **THE PLAQUE**: the SHAKEDOWN numbers plus landing run, formatted as the
  thing you get attached to. It is the game's unit of pride.
- **SAVE TO HANGAR**: name it, keep the plaque and a logbook stub with it.
- **ONE MISSION**: a cargo contract from HOME to one existing aerodrome,
  flown by the AP end-to-end (watch it, or skip to the outcome — both must
  exist, because "skip" is what fleet play will actually use). Outcome to
  the logbook.
What the slice is NOT: no economy, no art pass, no game shell, no manual
flying, no balancing. It exists to answer two questions — is the loop fun,
and which numbers must the plaque show — before polish is spent anywhere.

**P4 — energy & payload (the plaque grows range and load).**
The old "energy module" rider, PROMOTED — missions make it load-bearing.
Tanks and battery packs as volume + mass + CG (bench geometry, gameplay
numbers); fuel burn and pack discharge in the solver (contact arrays
refreshed ~1 Hz, not per-substep, per the old rider's note); cargo and
passengers as stationed MASS, not just cabin geometry. Range, payload,
endurance and cruise-at-weight join the plaque — the numbers "carries a lot"
and "flies far" are made of. The fuel-system DRESS (lines, gascolator,
plumbing at engine-bench finish) is explicitly deferred cosmetics — it rides
with F2 or a later dress pass.

OPENED 2026-08-30, arc numbers claimed **G97-G101** (see the claim block in
HANDOVER; it was G95-G99 until the P8 session took those mid-planning, and it
is held loosely per the numbering note below). A tank or a pack is a PHYSICAL
THING YOU BUY — a real solid at a standard capacity, dropped into a declared
bay, positioned and rotated until it fits around the pilot, whose swept volume
IS its capacity. G97 the interior volume + the wing spars · G98 the vessel
catalogue · G99 placement, fit and clearance · G100 the loading table and
CG(fill) · G101 the balance panel. BURN AND DISCHARGE is deliberately NOT in
this arc — it needs the flight loop, while everything above is provable on the
bench (RULING 1), so it is named and left for the next chantier.

**P5 — missions & economy v0.**
Contracts generated over the aerodrome registry: cargo demand, passengers
who want to go somewhere, payment in the credits the registry already prices
engines in. Accept → the AP flies it → outcome, wear and earnings to the
logbook. Design note written here: THE WORLD IS THE MISSION BOARD —
destinations need reasons (what does Morford want, what does Stein sell),
even if v0 hardcodes them. Materials economy (the old garage-arc G4 half
that never landed) starts here: parts cost credits, missions fund parts.

**P6 — fleet & discovery.**
The attachment systems. Fleet: the hangar as a collection — rows of named
aeroplanes with plaques, logbooks, hours, wear; the found aircraft (PA-18,
C172) as measuring sticks in the same rack, exactly the role the 2026-08-08
scope decision gave them; F1 imports join the rack as references. Discovery:
the teaching instrument, v1 — a post-flight WHY report built from the checks
and traces the project already computes (CG angle, nose load, static margin,
the AP's own telemetry): why it porpoised, why it would not rotate, why it
dropped a wing. The envelope card (Vs to Vne, the corners flown by the
harness) joins the plaque. Half the fantasy is discovering principles; this
is where the game starts explaining instead of just failing.

**P7 — powerplant plurality.**
Multiple engines (wing nacelles — physics has counted engines honestly since
G4.9; this unlocks the heavy-cargo mission tier), no engine (glider noses —
winch/aerotow stay in the far backlog), pushers (the Chinook has always been
one in physics; the bench needs the pusher cowl and mount). Judged by the
loop: each configuration must earn mission types or plaque numbers, not just
exist.

**P8 — the editor experience (tranche B of the UI revamp).** — STARTED
2026-08-30, and it carries a DESIGN: the Claude design session's option 9b
("Bone") rebaselines the whole editor screen on one rule — every surface has
exactly one job. The view shows and is manipulated directly; the parts column
selects; the properties column edits; everything about the aeroplane AS AN
OBJECT lives behind its name. High fidelity: colours, type, spacing and copy
are final. The handoff bundle is `design_handoff_garage_editor_9b`.

THE ARC, AND ITS NUMBERS ARE RESERVED (three sessions share this tree, and
G72 went to the atmosphere while this was mid-flight):
- **G76 — the part table. LANDED.** `tools/_cage_parts.js`: 7 assemblies,
  33 parts, the param -> part map, the part -> section map, the placement
  strip per part, and the existence rules. GATE PARTS (tier core, `--selftest`
  negative-verified) holds it against the editor's own 537 rows and the 28
  sections real builds emit.
- **G77 — the panel is two columns. LANDED.** `src/viewer/editor.js` +
  `editor.css`. §4's tree and inspector, §5's placement strip, §6's
  changed-from-loaded dots with per-row and per-part reset. It builds no
  widget: the rows are `_cage_ui.js`'s own elements, moved, so the row grammar
  stays one implementation across the game and the benches.
- **G78 — the view owns looking. LANDED.** The icon rail (camera, display,
  night, explode, measure) with its flyouts, the name chip, the two verbs
  bottom left, and the SHED'S OWN SHEET (user's ruling: tuning the atmosphere
  or the hangar is a different interface). `#edBar`, `#bEnv`, `#bMood`,
  `#bEdit` and the game's whole bottom bar left the garage with it, and the
  STUDIO stopped being a choice — the hangar is the only room. Also G77.1
  (user): the render is the FREE ESTATE, not a full frame under an opaque
  panel, so the orbit centre follows the space available.
- **G79 — selection is bidirectional. LANDED.** A raycast on the material
  groups selects the part, hover tints both ways (view → tree row, tree row →
  geometry), and the selected part carries the design's callout, pinned to a
  world point on itself. app.js reports a HIT and editor.js resolves it
  through the part table, so an unknown layer — GEN_ACCESS's, when it lands —
  resolves the moment its part row exists, with no edit to the editor. The
  root is a tree row now, which is what makes "everything visible" a place you
  can go back to.
- ~~G80 — the sheet behind the aeroplane's NAME.~~ **SUPERSEDED 2026-08-30 by
  the user's design review**: the plaque, the bench and the store go into a
  permanent LEFT INFORMATION PANEL instead of a sheet, because a plaque you
  have to open hides the consequence of the slider you just moved. Only the
  fleet RACK stays a sheet. The name chip goes with it — it was a door to a
  sheet that no longer exists. See G87.

**THE UI MODEL (2026-08-30, the user's design review after G76-G79).** The
review is written up as `futureDesigns/UI-MODEL.md` — the authority on WHAT
GOES WHERE, with the 9b handoff remaining the authority on colour, type,
spacing and copy, and the three layout disagreements between them listed and
argued. In one line: **two interfaces, one renderer; in the workshop, observe
LEFT, change RIGHT, select RIGHTMOST, look in the MIDDLE.**
Arc numbers: **G86 LANDED**. The rest are NOT pre-reserved — see the note on
numbering below.
- **G86 the two interfaces. LANDED.** FLIGHT and WORKSHOP as separate chrome
  layers (`#ui` / `#wsUI`), so the aircraft card cannot render under the name
  chip and the PFD cannot watch you build. The mode follows the GARAGE, not the
  editor's boot. Gated twice: the mode is observable (UISMOKE's classList stub
  is real now) and the seam holds (ten flight ids inside `#ui`, eight workshop
  ids inside `#wsUI`, checked on the built artifact). The `#edStat` blob and
  the parts column's help text went with it.
- **the INFORMATION panel. LANDED as G91.** Plaque, bench and fleet on the
  left, 280 px, folding, pushing the render and its centring. The
  aeroplane's SHEET and the NAME CHIP retire with it (a door to a room
  that is now a wall is a sign), and so do the design/bench TABS — they
  existed because the plaque and the sliders shared a column, and they are
  on opposite sides of the screen now. The two panel insets became two
  custom properties on <body>, because four things have to agree about the
  free estate and the same arithmetic was written out four times.
- **the tree's TOP LEVEL. LANDED as G102.** It is a SCENE, not an aeroplane:
  roots register themselves through `window.CAGE_TREE_ROOTS.add({...})`, so
  the shed and the world join it without editing editor.js — which is what
  three sessions in one file most needed. Build plane and Reference plane
  read as peers now (they always shared a class; one was in capitals). The
  tree folds per branch, with `fold all`, persisted.
- **the THIRD FOLD. LANDED as G103.** The properties column folds too, so
  all three workshop surfaces do and folded to their spines the render has
  the screen (651 px -> 1433 px of a 1571 px window). The right panel's
  four widths are COMPUTED in one place and published as a number rather
  than declared as four classes.
- **the tree grows its remaining ROOTS. LANDED as G108.** Four roots — the
  build, the reference, `The shed` and `The world` — through G102's registry,
  which had two callers and both were in editor.js. The SHED SHEET retires with
  them (G78's ruling reversed on UI-MODEL section 2.4's own argument: one
  selector scales, two interfaces do not), and `#edScrim` / `body.sheet-open`
  go with it — the FLEET RACK brings its own back when it lands.
  `Design & construction` is the first row under the aeroplane, holding
  construction, the two derived configuration selectors, boom style, pod and
  canopy, wing position and bracing, and the three existence switches. NOT
  `engPreset`: it names a model rather than deciding what exists. GATE PARTS'
  "assembly with no children" rule was widened to "no children NOR rows" for
  the one case that is deliberately a top-level row heading nothing, with its
  own negative probe. Per-assembly collapse already landed at G102.
- **the FINISH view. LANDED as G104.** SHAPE/FINISH as two views of the SAME
  tree — the tree stays the only selector (the noun), the tab is the
  adjective. Per-part finish, tint and G102's three dials, moved from
  `_cage_ui.js`'s materials panel under the part whose `sections` claim them;
  whole-aeroplane livery and markings on the root; and the CONCEPTION row the
  user could not find (`intCons`) is live at the head of the livery instead of
  read out dead beside it. The join is `sections` in the part table, which
  GATE PARTS already held true in both directions — the finish view needed no
  new rule. The part callout went with it, at the user's request, and took
  `EDITOR_FRAME`, `projectPoint` and ~900 vector ops per highlight build.
- **`spec.finish`. LANDED as G105**, and it closes what ROADMAP has owed since
  G67. The finish is the aeroplane's now, not the browser's: it rides out
  through the join beside the shape and in through `applySpec`, so two designs
  keep two liveries and a build file carries its own paint. Deviations only,
  one object per section, null = the factory finish.
  **NO GEN_SPEC_V BUMP, and that is the finding** — the version exists to
  branch a MIGRATION on and there is nothing to branch: an old spec gets null,
  null means "no overrides", which is what it always meant. The 5 -> 6 bump
  stays the ENERGY MODULE's, whose `spec.fuel` change really does need one.
  GATE BUILD +12 checks, each negative-verified; the converters measured in
  the browser and in `CAGE_VISUAL` (no node harness boots `_cage_ui.js`).
  Still not carried, declared: a loaded livery IMAGE (placement yes, pixels
  no), and the finish is exactly as fresh as the shape — it lands on the next
  build sync, like every slider.
- **VIEW STATE NEVER FLIES. LANDED as G106**, and the plan above was wrong
  in three places, which is written up in HANDOVER because the corrections are
  the useful part. The VERTICES were already un-exploded (G63 works). What
  flew exploded was **the PROPELLER'S PIVOT** — the restore sat in the MIDDLE
  of the capture, and its `build()` put the scene back before the hub and the
  shaft axis were read out of it: measured at explode 0.9, the hub at -3.4792
  became -4.4828, a metre off the nose. The restore is a `finally` around the
  WHOLE capture now, so the capture happens in one state. This probably also
  closes the G58.4 "prop sometimes ends up in the middle" tripwire, whose own
  warning asks the reporter whether explode was on.
  Reading for the user's other half — alpha — turned up three more: the family
  alphas (4 translucent materials became 18: a see-through aeroplane) and the
  two display modes that REPLACE the fuselage mesh outright, wireframe
  (409,944 vertices to 276,114 — no fuselage at all) and the surface field.
  The fix is a DECLARED TABLE in `_cage_join.js`: VIEW_STATE (10 neutralised,
  each with a constant neutral) + VIEW_KEEP (5 exempt, each with its reason,
  all five measured). **GATE VIEW** (new, tier core) holds it against
  editor.js's own RAIL in both directions, so a display control added later
  without a decision is red. 12 checks, every rule negative-verified.
  ALSO NOT a usable instrument, contrary to the plan: "vertex-identical at two
  explode settings" — two captures at the SAME setting disagree in the third
  decimal on one translucent group, so that gate would have been red on
  arrival.
  **G106.1 — SUBSURF IS NOT A CHOICE.** I left subsurf alone and flagged it;
  the user overruled it ("it shouldn't even be an option in this editor
  anymore. OK to keep it in the cage, but not in game"), and the ruling is
  right: the subdivision level is how smooth the aeroplane IS, not how you are
  looking at it. Gone from the game in three places — `_cage_ui.js` does not
  adopt it under CAGE_IN_GAME, the rail does not list it, and it is pinned at
  2 in VIEW_STATE regardless. The ELEMENT stays parked and hidden because
  `build()` reads its value every build. GATE VIEW gained a `hidden: '<why>'`
  flag and two rules for it, since "decided but not shown" is exactly what a
  stale ghost row looks like. Measured: editor at L1 (6,515 v on screen),
  capture still 412,602 v.
- **the TYPE LADDER, the top bar, the way inside and THE SCENE. LANDED as
  G108** — the first four chantiers of the user's twenty-one-item review
  (2026-08-31; the ordered plan for all of it is in the session's plan file). The heading
  hierarchy item below is CLOSED by it, and so is half the pass: there is one
  type scale now, declared on `#edWrap` and used by both columns, with
  uppercase reserved for group labels — the ladder had been running BACKWARDS
  (a root drawn quieter than the assembly inside it) and the tree's assembly
  style was byte-identical to the properties column's group style. Separators
  moved to the END of sections in both columns. Also: click-outside deselects;
  `Wheels & tyres` highlighted NOTHING and now highlights the wheels (it
  failed in both directions and had since the part table declared the kit);
  hover narrows to the named instance; the icon rail and the two verbs became
  ONE BAR across the top with `Save` on it; `Run the bench` is deleted, not
  moved, because it only ever pressed a button already on screen in the
  information panel; and the INTERIOR VIEW is real — `_cage_crew.js` publishes
  the pilot's eye point (it was computed and thrown away, drawn as a marker
  and askable by nobody), the orbit pivots 0.35 m in front of the eyes, the
  polar / radius / shed clamps come off and the near plane goes to 35 mm.
  GATE: UISMOKE's seam gained four ids, three RETIRED ids asserted absent, and
  the two-file interior contract; four negative probes, four reds.
- ~~the pass — the 108 NATIVE checkboxes whose OS accent is the red the user
  has no place for~~ **LANDED as G112**, together with the scrollbars (which
  had NO styling anywhere in the project outside `tools/_pwr.html`). Measured
  after: 0 of 123 checkboxes and 0 of 565 ranges native, across both workshop
  roots. TWO THINGS THE DIAGNOSIS GOT SHORT: the workshop is `#wsUI` AND
  `#edView` — the flyout lives in the second, so `#wsUI .r` alone would have
  left the very surface the diagnosis named untouched; and the PALETTE has the
  same defect one level down, so after the rescope the flyout's toggles came
  out `appearance:none` with a transparent track. Both roots carry the control
  rules and the tokens now. THE RULE: in a re-parenting architecture, a look
  keys off the ROW, not off the place the row is standing.
  STILL OWED from this item: the focus-visible / hover / reduced-motion sweep
  across the surfaces added since G77.
- **THE SECOND BATCH — the user's twenty-item review after G108. SIX LANDED as
  G112** (2026-08-31; the ordered plan for all twenty is in the session's plan
  file): the instrument panel is ON the dashboard and the dash IS its plate —
  it was displaced by exactly `dashDepth`, 0.35 m, because `dashLip` measured
  the BOTTOM of the dash box and the panel was hung below it, and then buried
  38 mm INSIDE the box once the height was right; the shed's lamps spread 135°
  and the ground bounce is 1, with GATE LIGHT's own `< 1` bound rewritten
  because the user overruled the G94 occlusion term (the argument stays in the
  file, with a paragraph saying who overruled it); the Piper Cub rests on its
  wheels — it is drawn FUSELAGE-LEVEL, 12.09° from its parked attitude, and
  the `pitch trim` slider was rotating about the wrong axis and ROLLING it;
  the tail's tranche is smooth-shaded and the flats are not, with `tailRimN`
  a row (the tail was flat by CONSTRUCTION — non-indexed geometry, so
  `computeVertexNormals` could only ever give face normals); the cowl's oil
  door is a superellipse; and the styling pass above.
  **STILL OWED, all named in HANDOVER G112 with what the reading established:**
  the joints in black rubber and the dash's materials (HANDED to the per-part
  livery arc, the user's call — the `rubber` finish already exists and the
  change is four words in `AERO_BY_CONS`); the beacon inside the dorsal fin
  (NOT a depth trick — the pod straddles the fin by design and the dorsal is
  not in the fit); the cabin lamps, the wing-tip lamp placement and the lit
  reflector; the artefact in the cabin (the engine layer sizes its
  firewall-side hardware off the CAGE's aperture and nothing clamps it to the
  engine — plus a zero-length normalise feeding a lathe a NaN axis); the aft
  bulkhead's z within its pillar, the fitting nudges and the door gap; the
  waist line's forward limit (CHEAP — `sL = 0` already IS the window pillar);
  and passengers, which goes last because `61_gen_frame.js` and
  `60_gen_spec.js` belong to the energy arc's live migrator.

**ON NUMBERING, AND WHY THIS ARC STOPPED RESERVING (2026-08-30).** G76-G80 were
reserved in this file before the work started, and the reservation was read and
honoured by the GEN_ACCESS session (which took G81-G85 the same way). It was
then quietly broken twice: the ATMOSPHERE session took G72 mid-flight, and the
REFERENCE-OVERLAY session took G89 AND G90 — both reserved here — and had
working code on disk with those numbers baked into its comments before anybody
noticed. Renumbering someone else's in-flight work is worse than the collision,
so both were ceded.

THE HONEST CONCLUSION: a reservation only binds sessions that read it, and a G
number is a LABEL, not an identifier. Nothing in the code, the gates or the save
format keys off one; the cost of a collision is a confusing handover, not a
broken build. So the protocol changes:

  TAKE A NUMBER WHEN THE CHANTIER LANDS, not when it is planned — by reading
  the last `## G` heading in HANDOVER.md and taking the next free one. Reserve
  at most the one you are writing right now.

Planned work is named by WHAT IT IS, as the list above now does. A plan that
needs a number to be findable was not named well enough.

DECIDED WITH THE USER ON THE WAY IN (2026-08-30): the standalone cage benches
KEEP today's accordion — the new UI is game-side, which is also the smallest
footprint in `_cage_ui.js` while the materials session is live in it; the
editor IS the garage screen (no "back to the game" door, the parts column
folds instead); and every tree node is selectable including the assemblies and
a root, because "we should still have a top layer where everything is visible".

The structural half, designed AFTER the loop is live because the loop is
what it serves — the badges ARE stat feedback now, not tool decoration:
- §3 configure THEN shape: a first screen of ~eight discriminators, each
  writing derived values once and deciding which parts exist. DECIDED HERE:
  the tension between auto-derived correctness and the discovery fantasy —
  derivation framed as the engineer's handbook (guidance you can ignore),
  never as guardrails that prevent building a bad aeroplane. Building it
  wrong and learning why is content, not error.
- §4 a part tree + inspector replaces the flat slider tree; selection tints
  geometry (SEC groups), viewport clicks select parts (raycast on material
  groups); the tree's nesting replaces the "3b/4b/4c" suffixes.
- §5 every part opens with the same placement strip: fore/aft, up/down,
  length, width — same order, labels, signs.
- §6 game feel: hover-tints, changed-from-preset dots with per-row/per-part
  reset, drag ghosts, undo/redo, A/B snapshots, checks as green/amber/red
  badges on the tree, randomise-within-envelope per part.
- §7 parent-child as DATA: children reference named parent anchors (deck
  line, keel, firewall face, tailpost), placement params are offsets, `link`
  is the general mechanism — the mirrored pod becomes an instance with
  per-param links instead of 22 duplicated rows.

**P9 — materials & mapping.** — PULLED FORWARD, STARTED 2026-08-29 (G66),
user: "we are going to give materials to the procedural planes".
Parameter-space UVs (the C4 item, still open), PBR materials per part,
liveries and registration decals (G4.5's decals are the seed). Liveries are
an ATTACHMENT system as much as an art one — your plane, your colours — and
land after P8 because materials hang off the final part model.

WHY THE P8 DEPENDENCY DISSOLVED, and it is not a waiver: P8 §4 says selection
tints geometry "(SEC groups)". The cage's ~30 section names ALREADY ARE the
part model as far as materials are concerned — a material system keyed on them
needs nothing P8 has not got, and P8's part tree will be a nicer selector over
the same keys, not a different set of keys. The ordering argument that stands
is the other one: P9's liveries are designed against P6's fleet, so the
LIVERY half still wants the fleet in front of it. The material half does not.

The arc, one chantier each: G66 the surface field (the coordinate that
replaces a UV unwrap — LANDED); G67 AEROSKIN, the one material — finish table,
per-section tint, the materials panel, glass, the moods reaching the aeroplane
at last, GATE SKINMAT (LANDED; the four constructions now measurably differ,
and a livery set in the editor arrives unchanged on the aeroplane that flies).
Still owed from G67: the detail sheets are procedural rather than the agreed
~25 MB of curated CC0, only the CAGE is AEROSKIN (the wing/gear/engine layers
still wear G38's grey), and the per-section finish and tint live in a pref
rather than in the spec — ruling 4 wants them in a `spec.finish` block with a
GEN_SPEC_V bump and its migrator before liveried builds are shared.
G68 the structure grammar — LANDED: GEN_BUILD_GRAMMAR beside GEN_MATERIALS,
fasteners and seams and panel lines and oil-canning per construction, from the
real structure in real millimetres, with the analytic masks deciding WHERE and
a mipped stamp supplying the pixels. THE "FOUR MATERIALS LOOK IDENTICAL"
PLAYTEST ITEM IS CLOSED — fabric and alloy now differ 3.5x in measured local
contrast at the same luminance. G68.1 then gave the WING its own field, at the
user's steer ("do the wing spars first"): rib tapes on the stations the mass
model paid for, spars as integer rails, the washed-out leading edge — the
three things the user named as right about the old yellow plane. G68.2 then
did the FIN and STAB — one `finMesh`, both surfaces, because the stab is the
fin laid flat (G23) — with a DECLARED tail rib pitch, since the frame bills no
tail ribs to read. Still owed: rib LACING is not drawn on any surface, the
tail's LE treatment is a chord FRACTION where it should be metres from the
edge, and GEN_ACCESS (hatches, inspection rings, fuel caps) is designed and
unwritten.
G68.3 put the leading-edge treatment in METRES rather than chord fraction.
G69 the decals — LANDED: the surface field IS the projection, so a marking is
placed in metres and holds its proportions on any shape (G4.5's own conclusion,
generalised); the registration reads correctly on both flanks, an atlas with
dilated pages carries it and any image the player loads, and the panel edits
it. Still owed from G69: a decal is on BOTH sides or neither. Its other two
debts are PAID: placement moved into the spec at G105, and THE CRAFT-SPACE
ORTHOGRAPHIC PROJECTOR LANDED AS G113 — two channels (fuselage+cowl+tail, and
wing+slabs), three modes per decal (field, side, plan), a surface CLASS in
place of the old is-it-a-flying-surface flag, and the decal loop out of the
field's own `#if` so an analytic surface can carry a marking at all. THE
FINDING WORTH CARRYING: `uFieldM` is NOT a common frame — measured, the cowl is
in metres and the fin in cage units — so the projector reads a shared
`uCraftInv`/`vCraftPos` instead of `vObjPos`, which also retired `uSideAxis`
(declared, defaulted and passed by no caller since G69). Still owed from G113:
the flat surfaces' DETAIL sheet is still field-mapped, which is the user's
item 21.
G70 the interior, the technical parts and the wear — LANDED: the gear, the
engine, the cowl, the propeller and the cabin leave G38's understudy grey for
AEROSKIN through `AERO_HARD` (65 material names over 4 layers, read out of the
four layers' own tables), eight new finishes for the hardware vocabulary, and
ONE CONDITION DIAL whose every placement is derived — grime in the
microsurface, chalking on what faces the sun, metal dulling, and streaks that
run from the MEASURED exhaust exit and the mains' own contact. Still owed from
G70: glass takes no wear, the streaks are on the fielded surfaces only, there
is no per-part condition, and the wing's diagnostic part colours (G31's purple
tip, orange ailerons) survive into the material view where they read as a
mistake rather than as a part list.
G109 the per-part livery, phase A (2026-08-31) — LANDED: the flying surfaces
are SECTIONS now (AERO_SEC in aeroskin.js: wingSkin/wingTip/wingAil/wingFlap,
finSkin/finRud, stabSkin/stabElev), each with the full finish/tint/three-dials
row set in the livery view under its own part, and each FOLLOWING its parent —
control surfaces the wing, the wing and the tail the fuselage — through a pure
resolver (`aeroSecResolve`) the gate exercises directly. No new machinery: the
five override maps, the pref, `spec.finish.sections` and the join carry the
new names exactly as they carried the cage's (NO GEN_SPEC_V bump — the G105
ruling, for the same reason). The join's colour-only fallback bucket gained
the finish identity, or a carbon fin and a green-ply stab wearing one tint
would merge irreversibly. G70's leaked diagnostic colours are DELETED,
answered by real per-part rows. PHASE B LANDED AS G110 the same day: per-part
CONSTRUCTION (wgCons/finCons/stCons, structure tab, 0 = 'as the aeroplane'),
feeding grammar AND the auto-finish bottom-out — carbon fins on a wooden
fuselage measured on the meshes themselves (fin composite/carbon beside wing
ply/wood in one build); mass/price do not follow it yet, declared. PHASE C
LANDED AS G111: seven hardware sections (strut — joining AEROSKIN at last —
spat, gearLeg, prop, spinner-follows-prop, cowlSkin, accPaint), the
PINNED-FIN rule (an ancestor's finish never reaches painted hardware, its
colour does) and `tint0` (the layer's legacy palette as the walk's last word
before the finish base). PHASE D LANDED AS G112, closing the arc: seatTrim
(cushion+pipe in the M getter, following nobody) and one suit tint per dummy
(dummy2 follows dummy1; the figures are named edDum1/edDum2; editor.js
untouched). THE ARC IS CLOSED — every part the user listed has a livery row
under its own part or a declared reason not to. Still owed, named at
G109-G112: the three dials and the wing/rib grammar across the join,
per-part wear, mass/price behind per-part construction, seats/console
naming. HANDOVER G109-G112 are canonical.
G67.1 the default cage at boot — LANDED, and larger than it looked: the game
now OPENS on the cage build, in the hangar, with the editor open and committed,
so the aeroplane you see first is the one you are building; AEROSKIN is the
default view rather than the section palette; and `buildModel('gen')` no longer
falls back to the old generated skin, which is what actually took it off the
flight path. THE OLD SKIN IS NOT DELETED, and the reason is worth carrying:
`_cage_wing.js` builds the WING of every cage build out of `genSkin`, so the
wing was lifted out of it first — `genWingInto`/`genWing`, verbatim, with GATE
WINGSPLIT freezing thirteen wings as digests to prove the move changed nothing
— and the workshop's wing and engine were re-homed with it (the engine on the
bench is the engine bench's own engine now). What still holds the file alive is
GATE GEN, which asserts on the old aeroplane's fuselage, tail, cowl, prop and
gear MESHES; deleting it means promoting the cage's own checkers
(`_cowl_check`, `_fin_check`, `_eng_mesh_check`, `_cage_fit`, `_join_check`,
none of them in the battery) rather than accepting a quietly smaller gate.
G67.2 CLOSED IT (2026-08-30): `63_gen_skin.js` is `63_gen_wing.js`, genSkin is
deleted (flight_core 658 -> 538 KB), and the coverage moved rather than
vanished — `_cage_fit`, `_fin_check`, `_cowl_check`, `_eng_mesh_check` and
`_join_check` joined the battery as CAGEFIT/FIN/COWL/ENGMESH/JOIN (five
checkers that had existed for chantiers and were only ever run by hand). GATE
GEN kept 70 of its 75 checks; the five that went are each recorded where they
stood. G67.3 THEN CLOSED THE ONE GAP IT DECLARED: GATE GEAR (`tools/_gear_check.js`)
runs the undercarriage headless on a THREE stub and asserts the three leg
families are three different drawings — the check GATE GEN lost — plus the
wheel turning on its own, the tyre reading as a circle, the leg mirroring
vertex for vertex, the spat clearing the ground and the castor filling its own
bags. TWO LESSONS IN IT: a dodecagon tyre PASSED the first roundness check
(a revolve puts every vertex on the circle, so faceting is a SAGITTA and not a
radial spread), and the wheel deliberately does not mirror — a valve stem and a
bolt circle are fitted at an arbitrary clock angle, so the structure is checked
vertex-for-vertex and the wheel as a volume.
THE INSTRUMENT WORTH REUSING: diff a gate's CHECK NAMES before and after
surgery. A deleted assertion leaves no trace, and this one immediately caught a
frame-side gear check deleted by accident because it shared a comment header
with its skin-side neighbour.
G94-G98 CLOSED THE INTERIOR AND LIT THE AEROPLANE (2026-08-30). G94 the
instrument panel, the floorboards and the cowl's own detail — the panel's
rows are laid out first and then CENTRED on the pilot, and its height comes
from a MEASURED coaming lip rather than from the throttle's mounting height.
G95 the part highlight became an OUTLINE in a noticeable colour, at the user's
ask, with the mode kept as an option so the default can be chosen later.
G96 THE AEROPLANE HAS LIGHTS: eight of them, in the user's own two groups
(outside = physical switches, inside = potentiometers), every one owning
emitting geometry per the user's rule "there should be no light without
emitting geometry", every position measured off the thing it is mounted on,
levers and knobs on the panel, and exactly TWO real `THREE.Light`s because r128
is a forward renderer and the hangar already runs seven. G97 the fin and stab's
dendritic shading — the tail's ribs were on the object-space path where the
rail coordinate jumps between panels; `ribM` puts them on the metric one.
G98 THE LAMP BAY became a real fitting: the wing is CUT along its own loft
rows, the hole is closed by an interior cage the user drew himself (a quad and
two ribs on the aerofoil profile, all three from the cut's own boundary), the
lamp is a solid of revolution, and it is FITTED to the interpolated section at
its own station so it cannot protrude — GATE BAY asserts all three, each
against the defect that produced it. Four frames-and-measurement lessons in it,
all in the HANDOVER entry: a bench with no transform cannot catch a frame bug;
a bay is ONE LOFT CELL, so it has no mid-span; DIHEDRAL makes the intersection
of two stations a section neither of them has; and a floor on a derived
quantity is a way of ignoring the measurement that was taken.
G99 THE BEACON TURNS: a real mirror inside the dome, and the flash computed
against the camera rather than animated — a clock-only pulse would flash at the
same instant for every observer, which is a strobe and not a beacon. The rate
IS the rotation rate, so there is no second number to disagree with the first.
GATE BEACON's AIM assertion is what tells the two apart.
G100 THE FITTINGS FIT THE SURFACE: the beacon was a metre forward because
`cageLayer:fin` carries the STABILISER (G96's "the group is not only the wing",
now on the tail) and because a fin tip is SWEPT, so a fairing laid at the apex
floats over the forward half of its own edge; the black square through every
lamp was an axis-aligned gasket plate on a surface that does not lie in the
world's axes; and the discs on blades became TEARDROP FAIRINGS sized from the
surface's own thickness — a straddling base for the beacon (an anti-collision
light cannot be let into a fin and still be seen), and a tip fairing whose NOSE
IS THE LENS for the nav lights.
STILL OWED from the lighting arc: the instrument light (the user's own
"later"), and nothing switches on at night by itself.

The material library and the wall-wardrobe prune ride with G66/G67.

GEN_ACCESS — THE FITTINGS — OPENED 2026-08-30, arc numbers RESERVED G81-G85
(claimed in HANDOVER before starting, per the G76-G80 note's own protocol).
This is the "technical parts" third of G70 and it is not a new design: the
G68 gap list already declares it — "a declared table of REQUIREMENTS, each
naming what it serves and a placement rule, resolved against built geometry
and SNAPPED to structure" — with the acceptance test stated, "you can point
at any hatch and say what is behind it, and no tank means no fuel cap".
What the arc adds is REAL GEOMETRY, because a filler cap and a pitot mast
stand off the skin and the grammar can only draw what is flush.
DERIVED, NEVER PLACED: `spec.fuel.tank` decides where the cap goes,
`spec.systems.fit` decides how many aerials, `spec.fuselage.material`
decides whether a panel laces, screws or doubles. That is the wear ruling
("a hand-placed smudge is decoration, and decoration does not survive the
aeroplane changing shape under it") applied to the thing it was written
about. THE MOUNT ALREADY EXISTS: `fitFrame`/`fitPad` in _gear_gen.js:606
answer point-normal-and-bolted-pad on the skin, proven on the whole
undercarriage; the surface field's integer st/lv choose the station, the
contract mounts the part. G81 the site · G82 the table · G83 the body's
fittings · G84 the wing and the cowl · G85 it was already saved.

G81-G84 LANDED (uncommitted). 19 declared requirements, 14 forms, three
skins each with its own placer — the fuselage a mesh with a field in cage
units, the wing the SAME FIELD in metres meaning span/chord/rib/spar, the
cowl an analytic surface evaluated rather than searched. GATE FIT is core
tier: 354 fittings measured over 6 shapes x 5 specifications, eleven
negative probes all caught. Measured in the page: 14 fittings on the stock
aeroplane, 18 with wing tanks + IFR + a cargo bay, and SIX on a minimal
day-VFR machine with no tank — which is the acceptance test doing its job.
G85 CLOSED THE ARC BY CORRECTING IT. The gap G83 and G84 both declared —
"spec.access does not exist, the switches live in the panel not the save" —
was WRONG: `cageToSpec` passes every unrecognised key straight into
`spec.cage` and `cageFromSpec` reads it back, which is how all eight cage
layers persist theirs. A private `spec.access` would have singled this one
out from seven; a GEN_SPEC_V bump would have been dishonest (nothing about
the shape changed); and a migrator is forbidden by the version note's own
last line. What was owed was a TEST — what an aeroplane wears is saved
because what it IS is saved — so GATE FIT now asserts the equipment and the
switches both survive a round trip, and that the aeroplane asks for the same
fittings on both sides of it. Thirteen negative probes.

STILL OPEN: cross-layer clearance (the gate checks fittings against their own
skin and each other, not against the gear, engine or tail — the tail tie-down
buried inside the tailwheel castor was found by counting pixels, and nothing
stops the next one); nothing on the fin or stabiliser; a biplane's lower wing;
~~and ONE NAMED BOUNDARY DEFECT — an aeroplane that IS the template still writes
sixteen layer keys into `spec.cage`~~ — CLOSED at G106 (2026-08-30, the quality
review's P-1): "sixteen" had grown to **518 keys, ~470 of them frozen layer
defaults**, before the boundary learned to read the declaration that existed
all along — `CAGE_PAGE.defaults`, THE DEFAULT AEROPLANE — lazily, with the
baseline split (cage keys vs the template, layer keys vs the default
aeroplane). The default bake is 42 keys now, all genuine cage deviations, and
GATE BUILD holds it with a negative probe plus a frozen fat-vintage fixture
(`tools/fixtures/`) that must load forever. The same chantier gave
`GEN_SPEC_V` its first reader: `GEN_MIGRATORS`/`genMigrateSpec`, the empty,
exercised walk the energy arc's v6 plugs into.

THE LIFT-STRUT FOOT — LANDED 2026-08-30, arc numbers RESERVED G86-G88
(claimed in HANDOVER before starting, same protocol). User, with both feet
circled on a screenshot: the struts were drawn from `63_gen_skin`'s beams and
stopped at truss NODES with no fitting at all — in mid-air beside the belly at
one end and buried in the covering at the other. Now every one of the four
ends is a bolted doubler with a clevis on it: the fuselage foot through the
undercarriage's own `fitFrame`/`fitPad` (the user named the method), the wing
fitting through the same object on the wing's own surface, under a high wing
and over a low one. Two editor rows, `strut fore/aft` (which moves BOTH ends,
so the strut stays straight) and `foot lateral` (arc length round the section),
BOUNDED by the wing's structural chord — `strutBand`, 6 % clear of the leading
edge and 4 % clear of the aileron hinge — so the drawn ends can never leave
the beams they stand for. GATE STRUT, core tier.
THE FOOT DID NOT ACTUALLY TOUCH ITS PLATE UNTIL G108 (2026-08-31, the user:
"there is a small gap between the end of the struts and the metal plate they
attach to, on both ends"). Measured on the drawn geometry: the clevis ear
spanned 38.9-71.0 mm off a 7 mm doubler at the fuselage and 21.9-53.7 mm off a
5 mm one at the wing — thirty-two and seventeen millimetres of daylight, at all
four ends. `lug`'s tang does not follow the vector its signature calls `up`; it
follows the BINORMAL, so handing it the surface normal threw both ears sideways
at pin height and `stand * 0.92` bought nothing. One exported line
(`strutClevisUp`) and the ears now root 4.4 / 3.0 mm off the skin, inside their
plates. `lug` untouched — the undercarriage is drawn with it. GATE STRUT gained
a headless measurement of the DRAWN ear (GATE GEAR's stub trick), and its
negative probe is the bug itself.

NO NEW PHYSICS, on the user's ruling ("prefer constraining the visuals to the
existing physics rather than adding new physics now"): the divergence between
each drawn wing fitting and its beam is REPORTED every build, and is 3 mm at
zero trim. STILL OPEN, and it is where the user's "if the attachment points
are significantly shifted, it should be reflected in the physics" points:
`61_gen_frame` roots both members of a side at ONE node, so the two clevises
are 116 mm apart where a real pair is much further; giving them their own
stations is a FRAME chantier. Also open: no jury struts, no fairing where a
strut enters the wing.
THE LESSON THIS ARC PAID FOR, three times: a frame that is nearly right draws
a picture that is nearly right. `toCage` undoes genSkin's rest pose and is for
SKIN vertices; a node sent through it tilts by the whole rest pitch. The
airframe contract is a SAMPLED surface and missed the drawn skin by 3.5 mm,
enough to cut a doubler in half. And the ray that finds the wing must be cast
ACROSS it, not along the strut, or a 28-degree strut walks its fitting 153 mm
inboard of the spar. All three were found by LOOKING, and all three would have
survived any gate this project has.

**P10 — into the game shell.**
- The garage rebased on the bench modules and the P8 part tree; the spec
  round-trips already (`GEN_SPEC_V5`, G21§1).
- Boot & packaging: per-model payload splitting (the SKIN-PROC §6 open
  item), deferred model decode, a build step baking `src/` into one file —
  the bench pages prove the single-file boot; this dissolves the loading and
  server-mount complaints.
- Physics deepening, by ruling 3's increments: per-feature drag (spats
  already flagged in `62_gen_aero`), cooling drag, body lift where the
  ledger earns it — never a mesh-aero rewrite.
- The deform-and-break plan: WRITTEN as a design doc first (it does not
  exist on paper), then built. Its game role is named now: breaking is
  content — test-to-destruction in the bench, damage and repairs in the
  logbook, scars as attachment.
- The fixed-step accumulator (the timestep HONEST CUT: the sim currently
  runs at the display's refresh rate) — feel work starts here, and
  slow-motion-reads-as-rubber must die first.
- Manual controls (old session 4) — the OPTION the vision always said it
  was, not a gate anything waited on. reEngage and holdWas landed in W14;
  what remains is input UI and its gate.

**P11 — the world glow-up.**
Aeroplanes of P9 fidelity cannot land in the current world. Two halves:
- RENDERING, the overhaul backlog by name: chunked terrain LOD (far
  cliffs), contour-traced lakes, animated water shader, triplanar splat,
  per-surface detail + near-field clutter (W15 b+c), ultra-inner aerodrome
  bakes (W15 d), sky/lighting to match the PBR skins. The world DATA
  pipeline (stages 0-5) is complete and untouched.
- THE MISSION BOARD MATURES: P5's hardcoded demand becomes worldgen —
  settlements produce and want things, strips have character, distance and
  terrain price the contracts. The world stops being scenery.

**P12 — validation against reality.**
Build two or three real aircraft against reference models (F1), benchmark
against published numbers — the DIVERGENCE LEDGER machinery is exactly this
— and tweak the physical model where the ledger says so. STOL goes LIVE on
the P2 reservations (flaps/slats/VGs with physics to measure them). REYNOLDS
NUMBER lands here and nowhere earlier: F5 gave the air a density and
deliberately left Cd0 and CLmax fixed against it, which is a real omission
and exactly the kind the ledger is built to price. Far backlog behind it:
STOL competition mode, the jet module + SubSonex, the gliders' atmosphere
(thermals/ridge — the wind(x,y,z,t) plumbing is where they plug in, and F5
made that argument load-bearing instead of decorative).

## FLOATING CHANTIERS (pull forward at will)

**F1 — the reference overlay.** — PULLED FORWARD, STARTED 2026-08-30, arc
numbers RESERVED G89-G93 (claimed in HANDOVER before starting, per the
G76-G80 note's own protocol), user: "the goal is to recreate an existing
airplane by importing the model in lieu of blueprints".
3D model import instead of blueprints: a GLB
as a ghost in the bench, scale/align, match by eye. The in-repo Cub and C172
are free; more from the same modeller as they come. Display-only, r128 loads
GLBs, deliberately small. Pull it forward the moment matching a real
aeroplane would help — wings (P2) is the likely moment. Blueprints only if a
wanted aeroplane has no model. Imports also join the P6 rack as found
aircraft.

TWO THINGS THE ENTRY ABOVE GOT WRONG, both found by measuring rather than
reading, and they make this cheaper than it looks. THERE IS NO GLB TO LOAD
and r128 does NOT load one — no loader is vendored. The Cub and the C172 are
already BAKED payloads (`MODEL_PA18`/`MODEL_C172`, `src/models/`), already
inlined in the artifact, already decoded by `decodeModel`: the reference
costs zero new bytes and no loader. And it lands in the GAME EDITOR, not the
bench — the editor is the garage screen now (G35/G78), and the benches keep
their accordion (the P8 ruling). Both models measure TRUE SCALE on decode
(PA-18 span 10.713 m, C172 11.00 m), so the size slider is a correction knob
for future imports, not a necessity for these two.

**F2 — naked structures.** Door removal and the tube structure dressed to
hero level for the open-frame class (Top Rudder / Ruckus): the truss stops
being interior and becomes the visible airframe — gussets, fittings, bolted
clusters at the engine-bench finish. G13's I-series is the foundation.
Aesthetic content with no loop dependency, so it floats; the deferred
fuel-plumbing dress from P4 can ride with it.

**F3 — the prop library and the asset editor.** LANDED in part, 2026-08-28
(HANDOVER G50): 29 downloaded objects are a declared table, a baker, group
packs, one material factory, GATE PROPS and a bench (`tools/_props.html`).
A second batch (G51) took it to 40 props and DID the hangar swap: the drawn
bench/pegboard/shelving/toolChest/drum/tyreStack/bottleRack/stepladder/
partsTrolley are deleted and the room is furnished from the library. What
remains is the asset editor proper, growing out of that bench — it already
lists, groups and reports facts from PROP_REG, so what is missing is the
working surface, not the data. Floating because it is set dressing: it makes
the shed a place, and it moves no number on the plaque.

**F4 — the day cycle.** LANDED in part, 2026-08-29 (HANDOVER G62): the
hangar's moods are five HDRI skies (the alps field plus the Kloppenheim
noon / covered / sunset / night series), each carrying a light rig
MEASURED off its own HDR — sun direction and colour, how directional the
sky is, sky and ground colour — with one authored `level` per row for the
day cycle, because Poly Haven's HDRIs are not calibrated to a common
absolute scale. `tools/sky_prep.py` is where that line between measured
and authored lives.

What remains is the cycle itself and the WORLD's half of it. The room is
lit by a time of day; the sim's own scenery is not, so flying out of a
sunset hangar still arrives in the world's fixed daylight. That is the
P11 consistency goal seen from the other end (recorded at G41: "the
honest destination is the GAME's own scenery seen from the hangar"), and
the two should be one clock. Also open: the procedural grass and strip
outside the door are lit by the room's lights rather than by the sky's own
ground, and a mission that names a time of day has nothing to set.

Also open, and the user's own proposal (2026-08-29): ONE panorama graded into
several hours instead of one per hour. Prototyped at G62.1 as a test area
(`tools/sky_grade.py`, `sky_prep.py --lab`, `make_probe.js --sky-lab`) and it
reads — golden, sunset, dusk and night all convince in the real room; only
overcast does not, and cannot, since there are no clouds in a clear-sky source
to reveal. Adopting it shrinks the SOURCES (125 MB of HDR to 26); shrinking the
PAYLOAD as well meant moving the grade into a fragment shader, and G62.2 did:
base.jpg + a per-channel gain map = 1.66 MB for every hour there will ever
be, verified against the offline grade to one 8-bit level. Mounted at
`tools/_sky.html`. The decision to adopt it is still open.

**F5 — the atmosphere.** LANDED 2026-08-30 (HANDOVER G72), pulled forward on
the user's own reading: "our skies are poorly modelled. No air density, no
engine response to lower air density. Probably nothing about temperature
either... we need a very correct flight model. Not the ultimate super accurate
one, but something that does not lie."

The air is a real thing now. `src/core/05_atmos.js` is one constant-lapse-rate
atmosphere in four lines — temperature, pressure, density, speed of sound —
exact at ISA and exact for an offset day, with the only two chosen numbers
being the ones that describe the DAY (sea-level temperature and QNH). It feeds
every dynamic-pressure term, the propwash disc, and the propeller, and the
engine's response falls out of 60_gen_spec's own momentum-theory synthesis
rather than being asserted: a naturally aspirated piston lapses (Gagg-Ferrar),
an electric motor does not, and the difference is one declared `aspiration`
field on the registry row.

The load-bearing half was NOT the density. It was declaring that every V-number
in the project — Vs, VClimb, VCruise, VAppr — is an EQUIVALENT airspeed, which
they all already were and nobody had said. The autopilot flew them as TRUE
airspeeds, which is identical at sea level and stalls the aeroplane at altitude;
the instrument printed "ias" over a true airspeed for the same reason. One
factor of sqrt(sigma) in one place in `40_autopilot.js` fixed both.

The bench earned a DENSITY ALTITUDE test (the same genClimbAt / genTORunAt
measurements, run in different air) and the plaque a "in thin air" section, so
the qualifier that has silently sat on every number the game ever showed — at
ISA, at sea level — is now visible and answerable. Wind grew a vertical
dimension: `refH` makes a wind a SURFACE wind and the column shears above it.

DELIVERED RED, deliberately, on the user's own call. GATE WIND fails one case —
the DC-3's crosswind landing, touchdown drift 0.79 -> -3.67 m/s against a 1.8
bound. It is NOT the density (isolated: density live + autopilot on TAS lands
unchanged) and it is NOT new (HEAD's own physics fails identically on a +0.8%
cruise-speed nudge; the cliff sat 0.5% away). Two stacked pre-existing faults,
both traced: the DC-3's wheel-landing flare balloons when it arrives slightly
hot, and the decrab rudder then sits pinned at its clamp for five seconds while
the aeroplane is CLIMBING, turning the crab into a sideslip. Fixing either is
arrival work on a calibrated fleet and happens WITH the user. The bound was not
relaxed and nothing was tuned. Full writeup in HANDOVER G72.

STILL OPEN, and named rather than implied: that DC-3 arrival; re-anchoring the fleet's wind gates
onto sheared wind (they still fly the uniform column they were calibrated in);
Reynolds number (P12); turbo/supercharging (`aspiration` reserves 'turbo' and
the R-1830 is lapsing like a normally-aspirated engine because of it); the
battery model that would give an electric aeroplane a real ceiling instead of a
refusal to guess; thermals and ridge lift, which are the same `wind(x,y,z,t)`
plug the roadmap has always pointed at.

## SEQUENCING RATIONALE

- **Why the slice sits at P3 and not later:** it is the earliest HONEST
  point — it needs wings (P2) and the declared join, and nothing else it
  needs is new (harness circuit + SHAKEDOWN, hangar, saves, aerodromes, AP
  routes all exist). Every phase before it in v1's order — editor tranche B,
  materials, packaging — was polish on an unvalidated loop.
- **Why bench and loop interleave after P3 instead of bench-then-game:**
  each bench phase is judged by what it adds to the loop (ruling 2), and the
  loop phases feed the bench phases — P8's badges are designed against P3's
  plaque, P9's liveries against P6's fleet.
- **Slider revamp split (unchanged from v1):** tranche A (P1) is
  one-function-deep and every later page inherits it; tranche B (P8) must
  see all the parts AND the live loop to be designed once.
- **Cage vs in-game editor (unchanged):** the bench is the editor; the
  garage is replaced-in-place at P10 by the same part tree over the same
  spec.
- **Manual controls demoted on purpose:** the vision says the autopilot is
  the pilot. The AP-flown mission game needs zero new flying tech — that is
  what makes P3-P5 cheap — and hand-flying is a P10 option.
- **Physics-from-mesh refused (ruling 3):** the loop needs physics that
  responds CONSISTENTLY to design choices, not physics derived from
  arbitrary mesh. Incremental joins, declared boundary, no tar pit.

## WHAT THE OLD ROADMAP'S LIVE ITEMS BECAME

| Old item | Where it lives now |
|---|---|
| Session 4 — manual controls | P10 option (holdWas/reEngage prerequisites DONE in W14) |
| Session 5 — STOL competition | P12 far backlog (STOL surfaces: reserved P2, live P12) |
| Session 6 — jet module + SubSonex | P12 far backlog |
| Rider — energy module (fuel burn, packs) | P4, PROMOTED to load-bearing |
| Rider — gliders | noses P7, atmosphere P12 far backlog |
| Old garage arc G4 — save/persistence + materials economy | saves landed as G7; the economy is P5 |
| Old garage arc G5 — missions over the 24 km world | P5 (v0) + P11 (mission board matures) |
| Renderer-overhaul backlog (W15/W17 notes) | P11 |
| SKIN-PROC §6 per-model payload splitting | P10 boot & packaging |
| Timestep-is-not-wall-clock (HONEST CUTS) | P10 |
| POST-G6 spats drag accounting (`62_gen_aero`) | P3's physics-bearing table names it; P10 implements the increment |
