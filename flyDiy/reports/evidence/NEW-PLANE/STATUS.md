# NEW-PLANE — the new-aeroplane flow, rebuilt (cloud, 3 Nov 2026)

Branch `claude/new-plane`, **rebased on origin/master `2f104df8` (train F4: FINISH-4 landed)**; the work was done on
`0fcf54ef` (PH1A) and replayed without a conflict. Asked for by the user on 2-3 Nov through A0.

**After the rebase:** FINISH-4 added "candidate official" builds to the old overlay's grid — the chooser's first screen
offers them too (same door, `GARAGE_SPEC.openCandidate`); FINISH-4's firewall cowl rule (cowled pushers stand on the
face, the block rows do not move them) is what the pusher's back cowl already assumed. The ten named gates were re-run
on the rebased tree: **all PASS** (STARTER, DESIGN, PARTS, SAVE, JOIN, UISMOKE, UISMOKE-PHONE, CARDS, UILAYER, NEWPLANE).
Validation A, the renders and ARCHETYPES were run on `0fcf54ef`.

## 0000. NOW (3 Nov, 14:30 UTC)

- **N1, as the user re-ruled ("make the join measure the fin above the deck"): DONE** - `_cage_join.js` `finTaperAbove`:
  the fin's taper is read on its planform above the highest point of the boom's top line under its chord (the fin
  layer's own `deck`). The FIN_ARCH presets now read 0.46-0.54, the validated Cub 0.59, Jodel 0.69, metal Cessna 0.70,
  Chinook 0.55 - inside the envelope, no clamp, no error row. **A physics change for saved builds:** they fly their
  measured fin taper instead of the clamp's 0.35 (the user accepted it with the call).
- **Running:** the core battery on this branch (the flown taper moves numbers the gates may pin); a red is compared
  with master `a8a23ad6` before it is called standing. Then the replay onto `a8a23ad6` (train L30a) and the ten named gates.
- **Blocked:** the push to `claude/ready/new-plane` is refused by this cloud session's permission policy (a
  `claude/ready/*` push reads as a production deploy). Everything lands on `claude/new-plane`; A0 promotes from it.

## 000. READY (the train-1B branch)

**Base: origin/master `1db22c8a` (train 1B: PHONE-1b landed).** The NEW-PLANE commits replayed onto it (two textual
conflicts, both resolved by keeping 1B's side and adding only this work: `phone.css` - 1B's installed-app block, the
chooser's phone rules after it; `plane_shot.js` - 1B's `phmat` URL and option, `&idle=0` and the chooser's close
added). Gates on this base (`--no-build` over its own build, all PASS): **NEWPLANE (45 s solo), STARTER, DESIGN, PARTS,
SAVE, JOIN, UISMOKE, UISMOKE-PHONE, CARDS, UILAYER**. NEWPLANE-BUILDS once, outside the battery: **11 checks, 167 s,
PASS**. ARCHETYPES was last run on `0fcf54ef` (one red, standing on master: the Chinook-alike's rejected take-off).
CONFIG-MATRIX step 4 is a separate ready in the same train: a trial merge on F4 had no conflict.

**Where it is:** the push to `claude/ready/new-plane` was refused by this cloud session's permission policy (a
`claude/ready/*` push reads as a production deploy here). The identical tree is on `claude/new-plane` (an `ours` merge
over the earlier history, so the push is a fast-forward; `git diff <1B branch head> claude/new-plane` is empty) - A0
promotes from it, as the original brief had it.

## 00. The user's calls of 3 Nov (via A0, 08:40) — what landed

| call | status |
|---|---|
| **N1** redraw the fin presets' tips blunter (new births only), no envelope change | **NOT LANDED — it cannot clear the error, measured.** The join's taper is chord(75 % span) / chord(25 % span) of the DRAWN fin sheet (`_cage_join.js:1595`, `_fin_gen.js finMeasure`), and the sheet runs down the tail post: 25 % of its span sits at the tail cone, where fin + rudder span the whole cone. Measured on the joined build (eab, tailwheel): at each preset's own tip chord 0.15-0.22; at the row's MAXIMUM tip chord (1.5x the root, a tip wider than its root) still 0.30-0.34; sweep 0 changes nothing. The user's validated stock Cub-alike measures **0.217** too. So no tip shape reaches 0.35 and every fin in the shed flies at the clamp. Blunter tips would change the look for no change in the error, so the presets are left as they are. The two real fixes are not tip shapes: (a) the join measures the fin PROPER above the boom deck (a measurement change; saved builds would fly their measured taper instead of the clamp's 0.35), or (b) the envelope (ruled out). **Question for the user: (a)?** |
| **N2** accept the stance fit's 1-3 extra loads | landed as is. Faster since: a two-seater's fit no longer shakes down the four loading corners (only cabins over two seats need them) and keeps its drawn margin 8 points higher instead (14 % floor) - NEWPLANE-BUILDS caught the low-wing microlight pusher drawn at 8 % with its worst corner at 0; now 15 %, clean |
| **N3** keep 3-4 bays with the design check's warning; a bays-forward cabin rule later | kept (the `big cabin corner` standing kind); **OWED: the bays-forward cabin rule** (logged here and in `tools/_new_plane.js` MAX_BAYS) |
| **N4** grey pushers under a high wing and over-the-wing engines until a shaft/block row moves the disc aft; "prop strike should refuse certificate"; "can also be fixed through wing geometry" | **landed** (`tools/_new_plane.js` RULES, "N4"): the over-the-wing engine greyed; a pusher's High and Parasol wings greyed; a pusher defaults to the low wing. Measured basis (validation A): pusher + high/parasol cleared the disc in 0 of 9 builds, over the wing 2 of 13, pusher + low/mid 3 of 8, push-pull 8 of 12. **The measured check is the editor's**, not the chooser's (nothing is built while choosing): `_cage_eng.js` propFitCheck → the join's `prop:` error row, which DESIGN-AIDS promotes to an airworthiness refusal — so a builder who reshapes the wing until the disc clears it gets a certificate, whatever the chooser offered. Three generated cards leave the generator's outputs by this call: **Pod-and-boom pusher, Archaeopteryx-alike, Whittaker-alike** (GATE NEWPLANE names them; the chooser's "start like" row hides them) |
| **N5** keep the authored cards on the first screen, as drawn | kept |
| CONFIG-MATRIX step 4 (`CM_OFF`) | read (`origin/claude/config-matrix-step4` 1b0225c3); its cells and the chooser's agree, but for one: CM keeps a push-pull on a SINGLE ROD live (its rod fit clears the disc) — the chooser greys it because the Push-pull tile always writes twin booms, so the generator cannot build that cell. A trial merge of step 4 into this branch: no conflict |

GATE NEWPLANE now **47 s, PASS** (core; its joined build is the LSA tricycle, two seats, the f1 failure; the 4-seat tricycle
moved to NEWPLANE-BUILDS). NEWPLANE-BUILDS run once, outside the battery: **11 checks, 169 s, PASS**. Validation A, the renders and
ARCHETYPES are from before these calls; the N4 greys only REMOVE offered combinations.

## 0. In one paragraph

NEW opens a **full-screen chooser**: 14 short steps (size class, mission, engine architecture, engine type, fuselage
shape, booms, wing layout + shape + bracing, gear, tail layout + fin preset, seats + cabin design, passenger bays,
canopy, construction, base colour), each a row of today's SVG symbols, greyed tiles saying why in the tile. Nothing is
composed, built or drawn while choosing (the garage's render loop is held behind the opaque panel). A summary lists
every pick (each a door back), then **Generate** composes the spec through the archetypes' own recipe
(`designBake`), gives the cowl its engine type's preset, loads it (the one build), reads the drawn aeroplane once to
seat the legs and balance the wing (a second load only when a leg or the wing moved), and hands over to the normal
editor on STRUCTURE with every slider. The prop's blade count is no longer a choice.

- **Validation A (once):** 123 builds (32 card choice sets, a 77-build pairwise covering array, 14 extremes):
  **43 clean, 39 clean but for three STANDING kinds that master's own cards share, 41 with a real failure** — 28 of
  the 32 card choice sets and 13 of the 14 extremes pass; 36 of the 41 are odd pairwise combinations (section 4).
- **GATE NEWPLANE (recurring, core): 45 checks, 51 s, PASS.** NEWPLANE-BUILDS (full tier): 11 joined builds, 230 s, PASS.
- **The browser run:** the chooser opens on a first launch, 0 composes / 0 loads / 0 editor builds while choosing, one
  bake at Generate, then the editor on STRUCTURE with 831 sliders; no page error.

## 0b. The files

- NEW `src/viewer/new_plane.js` — the full-screen chooser (renders, declares nothing); `editor.css` / `phone.css` its look.
- NEW `tools/_new_plane.js` — the generator's declaration: the steps, the static rule table (`why`), the defaults, the
  compose over `_cage_design.js`, the cowl preset per engine type, the stance and balance fit.
- NEW `tools/_newplane_lib.js` — one generated aeroplane judged (bake, join, fit, shakedown, design check, stance, hop) +
  the `standing()` kinds. NEW `tools/_newplane_check.js` — GATE NEWPLANE (+ `--builds`, `--selftest`), in `run_gates.js`.
- NEW `tools/newplane_validate.js` — the one-time validation (NOT in the battery). NEW `tools/fixtures/newplane/`.
- `tools/_cage_design.js` — WING_ARCH + the `wingArch` starter row (beside `finArch`), `iconPlan`, a few API exports.
- `tools/_cage_cowl.js` — `CAGE_COWL_BIRTH_PRESET` (a preset that survives the birth load).
- `src/viewer/design_flow.js` — NEW opens the chooser (the old overlay stays as the fallback; its Custom build is no
  longer reachable from NEW). `src/viewer/app.js` — the render hold (`FLYDIY_UI_HOLD` + `NEW_PLANE.isOpen()`).
- `tools/build.js` (MANIFEST), `tools/_cards_check.js` (the allow-list), `tools/plane_shot.js` (`idle=0`, closes the
  chooser).
- Saved builds are untouched: nothing in the load path changed (GATE SAVE, JOIN pass).

## 1. Today's flow (master `0fcf54ef`), and why it traps

- **Doors:** the garage ribbon's NEW (`garage.js` → `DESIGN_FLOW.openBirth`), and a first launch with no build ever
  saved (`design_flow.js maybeAutoOpen`). Desktop and phone share it (`phone.css` only widens `#dfBirth`).
- **Step 1, the overlay `#dfBirth`:** a grid of 32 archetype cards (recreations / fictional) + "Custom build" + "surprise
  me". A card bakes `designBake(sel, over)` and loads it (`GARAGE_SPEC.set`) — one build, fine. "Surprise me" rolls
  every row of the design table at random (all 40 rows, STOL devices and all) and loads it at once — the user never
  sees what was rolled.
- **"Custom build" is the trap.** It loads the stock aeroplane and switches the editor to a hidden THIRD view
  (`EDITOR_SET_VIEW('design')`, `edTabDesign` is `hidden`): the properties column becomes the whole Custom-build tile
  grid (eight groups, ~40 rows), the parts column folds away, and the only way back to the sliders is a small
  "‹ back to structure" pill at the top of a long scrolled grid. Every tile click **applies and rebuilds at once**
  (`doApply` → `syncSliders` + `build`, plus the pre-plaque strip's shakedown on the sheet thread): you design by
  rebuilding the aeroplane 20-40 times, in an order the table dictates (identity, cabin, structure, wing, propulsion,
  tail, undercarriage, livery) — the engine after the body, the gear after everything.
- **Why the planes are ugly:** the surprise roll combines anything (`before_surprise3`: a twin-boom bubble-canopied
  biplane with four STOL devices, which the renderer could not even frame); the tiles' starter values were tuned on a
  handful of cards; the cowl stays the page default unless a card is radial or turbine; nothing balances the wing or
  seats the gear for the combination chosen (validation A below: the stock taildragger tile put an eab's mains 11.7°
  ahead of its CG — the test pilot holds 30 % throttle and rejects the take-off; the stock tricycle left the n23's nose
  wheel carrying ~45 %, the LSA's 5.5° nose-up with 0.10 m of prop clearance; the ultralight's prop 0.02 m off the
  ground).
- **Before renders:** `before/` (today's flow: Custom build, five seeded "surprise me" rolls, three generated cards).

## 2. The archetypes: authored and generated, and the rules

32 cards in `tools/_cage_design.js` ARCHETYPES. **Authored** (drawn by hand to a reference, kept as cards and offered
"as drawn" on the chooser's first screen): the four **stock designs** (Cub, Jodel D112, C172, Chinook: `over.stock`),
the three **reference-fitted** biplanes (Tiger Moth, Stearman, Camel: a hand-fitted tail in `over.cage`), and the
**Spitfire** (WIP, blocked). **Generated** (24): a selection over the design rows + a small `over.cage` patch — these are
what the new generator now produces, and every one of them is reachable as a choice set (the coverage table).

The generation rules that existed, and are used as they are:

| rule | where | used for |
|---|---|---|
| class seed (span, chord, cabin widths, taper section, cintre, fuel, the engine's power) | `CLASS_ROWS[].seed` | the class step |
| role seed (flaps, bush tyre, wing) | `ROLE_ROWS[].seed` | the mission step (written before the explicit choices, so a choice always wins) |
| the tiles' writes (mount, count, booms, empennage, gear starters, canopy...) | `DESIGN_ROWS` | every step |
| the tail sized by the volume coefficients at birth | `designTailSeed` | every build (the fin preset gives the outline, the rule the size) |
| the fin/stab presets | `FIN_ARCH` / `finArch` | the fin step — the presets only |
| one cowl preset per engine type | `_cage_cowl.js COWL_PRESETS` | the cowl, through a new birth door |
| the aero nose recipe | `NOSE_AERO` | the nose, at the user's "a collapse, 3 rings and a slight ease" |
| the CONFIG-MATRIX switch rules | `docs/CONFIG-MATRIX.md` (origin/claude/config-matrix-step4) | the static grey table |
| GEN_RULES gearRake / noseLoad / trikeDeck, FAR 23.925 prop clearance | `60_gen_spec.js` | the stance fit |
| the green margin band | `genMarginBand` (5-40 %) | the balance fit |

**The coverage table** (`coverage_table.md`): every card, its choice set, authored or not, reachable or not.
**27 of 32 cards reachable** (after N4; 30 before): every **generated** card but the three whose disc strikes their wing
(Pod-and-boom pusher, Archaeopteryx-alike, Whittaker-alike — N4, the user's call), and every authored card but two, which stay cards — the
**Chinook-alike** (a pusher on a tailwheel: validation A greys that layout, the disc swings into the ground tail-down;
the Chinook's own engine stands over the wing on its block rows) and the **Spitfire-alike** (WIP, blocked; a V on the
eab class is 2.6x its power).

| card | kind | authored? | class | mission | engines | type | body | booms | wing | shape | bracing | gear | tail | fin | seats | cabin | bays | canopy | material | reachable |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Cub-alike | recreation | yes (stock piper cub) | Experimental (amateur-built) | Bush | Single, nose | Flat (boxer) | Round top | Lofted tail cone | High | Rectangular | Lift struts | Taildragger | Conventional | Rounded | Single row | Cabin | 1 bay | Windscreen | Steel tube | yes |
| Air Camper-alike | recreation | no: generator output | Experimental (amateur-built) | Touring | Single, nose | Flat (boxer) | Round top | Lofted tail cone | Parasol | Rectangular | Lift struts | Taildragger | Conventional | Rounded | Single row | Cabin | 1 bay | Windscreen | Plywood | yes |
| Tiger Moth-alike | recreation | yes (reference-fitted) | Experimental (amateur-built) | Trainer | Single, nose | Inline | Round top | Lofted tail cone | Biplane | Rectangular | Cantilever | Taildragger | Conventional | Rounded | Single row | Open cockpit | 1 bay | Windscreen | Plywood | yes |
| Stearman-alike | recreation | yes (reference-fitted) | Normal category | Trainer | Single, nose | Radial | Round top | Lofted tail cone | Biplane | Rectangular | Cantilever | Taildragger | Conventional | Rounded | Single row | Open cockpit | 1 bay | Windscreen | Steel tube | yes |
| Camel-alike | recreation | yes (reference-fitted) | Experimental (amateur-built) | Touring | Single, nose | Radial | Round top | Lofted tail cone | Biplane | Rectangular | Cantilever | Taildragger | Conventional | Rounded | Single row | Open cockpit | No bay | Windscreen | Plywood | yes |
| aerobatic biplane | fiction | no: generator output | Experimental (amateur-built) | Touring | Single, nose | Flat (boxer) | Round top | Lofted tail cone | Biplane | Rectangular | Cantilever | Taildragger | Conventional | Rounded | Single row | Cabin | No bay | Windscreen | Steel tube | yes |
| sesquiplane | fiction | no: generator output | Experimental (amateur-built) | Touring | Single, nose | Flat (boxer) | Round top | Lofted tail cone | Biplane | Rectangular | Cantilever | Taildragger | Conventional | Straight taper | Single row | Cabin | 1 bay | Windscreen | Steel tube | yes |
| Jodel-alike | recreation | yes (stock jodel D112) | Experimental (amateur-built) | Touring | Single, nose | Flat (boxer) | Round top | Lofted tail cone | Low | Rectangular | Cantilever | Taildragger | Conventional | Straight taper | Side by side | Cabin | No bay | Windscreen | Plywood | yes |
| C172-alike | recreation | yes (stock cessna 172) | Normal category | Touring | Single, nose | Flat (boxer) | Round top | Lofted tail cone | High | Rectangular | Lift struts | Tricycle | Conventional | Swept | Side by side | Cabin | 1 bay | Windscreen | Aluminium | yes |
| Chinook-alike | recreation | yes (stock chinook) | Microlight / ULM | Trainer | Single, pusher | Inline | Round top | Pod & rod | High | Rectangular | Lift struts | Taildragger | Conventional | Tall & slender | Single row | Cabin | 1 bay | Bubble | Steel tube | NO: gear |
| Caravan-alike | recreation | no: generator output | Normal category | Touring | Single, nose | Turboprop | Round top | Lofted tail cone | High | Constant + taper | Lift struts | Tricycle | Conventional | Swept | Side by side | Cabin | 4 bays | Windscreen | Aluminium | yes |
| RV-alike | recreation | no: generator output | Experimental (amateur-built) | Touring | Single, nose | Flat (boxer) | Round | Lofted tail cone | Low | Tapered | Cantilever | Tricycle | Conventional | Straight taper | Side by side | Turtledeck | No bay | Bubble | Aluminium | yes |
| Spitfire-alike (WIP) | recreation | yes (WIP, blocked) | Experimental (amateur-built) | Aerobatic | Single, nose | V engine | Round | Lofted tail cone | Low | Elliptic | Cantilever | Taildragger | Conventional | Rounded | Single row | Cabin | No bay | Windscreen | Aluminium | NO: engType |
| Savannah-alike | recreation | no: generator output | Microlight / ULM | Bush | Single, nose | Flat (boxer) | Box | Lofted tail cone | High | Tapered | Lift struts | Taildragger | Conventional | Rounded | Side by side | Cabin | No bay | Windscreen | Aluminium | yes |
| Single-seat ultralight | fiction | no: generator output | Ultralight (single seat) | Trainer | Single, nose | Inline | Box | Pod & rod | High | Tapered | Lift struts | Taildragger | Conventional | Straight taper | Single row | Cabin | No bay | Windscreen | Steel tube | yes |
| Twin-582 floatplane | fiction | no: generator output | Ultralight (single seat) | Trainer | Twin (wings) | Inline | Box | Pod & rod | High | Tapered | Lift struts | Floats | Conventional | Straight taper | Single row | Cabin | No bay | Windscreen | Steel tube | yes |
| Pod-and-boom pusher | fiction | no: generator output | Microlight / ULM | Trainer | Single, pusher | Inline | Box | Pod & rod | High | Rectangular | Cantilever | Tricycle | Conventional | Tall & slender | Single row | Cabin | No bay | Bubble | Steel tube | yes |
| Motorglider | fiction | no: generator output | Sailplane / motorglider | Glider | Single, nose | Electric | Round | Lofted tail cone | Mid | Tapered | Cantilever | Taildragger | T-tail | Tall & slender | Single row | Turtledeck | No bay | Bubble | Composite | yes |
| Radial tourer | fiction | no: generator output | Normal category | Touring | Single, nose | Radial | Round | Lofted tail cone | Low | Tapered | Cantilever | Taildragger | Conventional | Broad slab | Side by side | Cabin | 1 bay | Windscreen | Aluminium | yes |
| Electric trainer | fiction | no: generator output | Light Sport | Trainer | Single, nose | Electric | Round | Lofted tail cone | Low | Tapered | Cantilever | Tricycle | Conventional | Straight taper | Side by side | Cabin | 1 bay | Bubble | Composite | yes |
| T-tail tourer | fiction | no: generator output | Normal category | Touring | Single, nose | Flat (boxer) | Round | Lofted tail cone | Low | Tapered | Cantilever | Tricycle | T-tail | Swept | Side by side | Cabin | 1 bay | Bubble | Aluminium | yes |
| V-tail tourer | fiction | no: generator output | Normal category | Touring | Single, nose | Flat (boxer) | Box | Lofted tail cone | Low | Rectangular | Cantilever | Tricycle | V-tail | Straight taper | Single row | Cabin | No bay | Bubble | Steel tube | yes |
| Whittaker-alike | recreation | no: generator output | Ultralight (single seat) | Trainer | Over the wing | Inline | Open frame | Pod & rod | High | Rectangular | Lift struts | Tricycle | Conventional | Straight taper | Single row | Cabin | No bay | Windscreen | Steel tube | yes |
| Archaeopteryx-alike | recreation | no: generator output | Ultralight (single seat) | Glider | Single, pusher | Electric | Round | Pod & rod | High | Rectangular | Lift struts | Tricycle | Conventional | Tall & slender | Single row | Cabin | No bay | Bubble | Composite | yes |
| DA62-alike | recreation | no: generator output | Normal category | Touring | Twin (wings) | Flat (boxer) | Round | Lofted tail cone | Low | Tapered | Cantilever | Tricycle | T-tail | Swept | Side by side | Cabin | 3 bays | Bubble | Composite | yes |
| Twin bush hauler | fiction | no: generator output | Normal category | Cargo | Twin (wings) | Flat (boxer) | Box | Lofted tail cone | High | Rectangular | Lift struts | Tricycle | Conventional | Broad slab | Side by side | Cabin | 4 bays | Windscreen | Aluminium | yes |
| Skymaster-alike | recreation | yes (reference-fitted) | Normal category | Touring | Push-pull | Flat (boxer) | Round | Twin booms | High | Tapered | Lift struts | Tricycle | Conventional | Straight taper | Side by side | Cabin | 1 bay | Windscreen | Aluminium | yes |
| P-38-alike | recreation | no: generator output | Experimental (amateur-built) | Aerobatic | Twin (wings) | Flat (boxer) | Round | Twin tubes | Mid | Tapered | Cantilever | Tricycle | Conventional | Swept | Single row | Cabin | No bay | Bubble | Aluminium | yes |
| Push-pull starter | fiction | yes (reference-fitted) | Normal category | Touring | Push-pull | Flat (boxer) | Round top | Twin booms | High | Rectangular | Lift struts | Tricycle | Conventional | Straight taper | Side by side | Cabin | 1 bay | Windscreen | Aluminium | yes |
| Trimotor | fiction | no: generator output | Normal category | Touring | Three | Flat (boxer) | Round | Lofted tail cone | Mid | Rectangular | Lift struts | Tricycle | Conventional | Straight taper | Side by side | Cabin | 1 bay | Windscreen | Aluminium | yes |
| Four-engine starter | fiction | no: generator output | Normal category | Touring | Four | Flat (boxer) | Round top | Lofted tail cone | Mid | Rectangular | Lift struts | Tricycle | Conventional | Straight taper | Side by side | Cabin | 1 bay | Windscreen | Aluminium | yes |
| Beaver-alike | recreation | no: generator output | Normal category | Bush | Single, nose | Radial | Round top | Lofted tail cone | High | Rectangular | Lift struts | Taildragger | Conventional | Broad slab | Side by side | Cabin | 3 bays | Windscreen | Aluminium | yes |


## 3. The new flow

### 3.1 The order, and why

1 size class · 2 mission · 3 engine architecture · 4 engine type · 5 fuselage shape · 6 booms · 7 wing (layout, shape,
bracing) · 8 gear · 9 tail (layout, fin preset) · 10 cabin (seats, cabin design) · 11 passenger bays · 12 canopy ·
13 construction · 14 base colour.

- **What it IS first:** the class sets the size, the seats, the power and the rules; the mission is a bias, never a
  clamp (ROADMAP P8 §3), and is the brief's "mission hint" — it is also what 31 of the 32 cards already carry.
- **Then what drives the layout:** the engines. Their placement decides the booms (a pusher needs an aft bulkhead, a
  push-pull twin booms), the nose (faired when nothing is bolted to it) and the wing that may carry them (over the wing
  needs a high wing or a parasol). Type after architecture, because the catalogue's power per engine depends on the count.
- **Then the body and what balances it:** the fuselage, the booms, the wing, the gear, the tail.
- **Then the people and the glass:** the cabin before the canopy (an open cockpit has no hood, a turtledeck takes a
  bubble), the bays after the cabin (a turtledeck or open cockpits take at most one).
- **Last what it is made of and how it looks:** construction (mass and structure follow), then colour.
- **Every grey reads only earlier steps** (GATE NEWPLANE holds it), so going back never silently breaks a later pick: a
  pick a change greys is cleared and named on the summary ("your pick no longer fits: the usual one").
- **Skip** takes the class's usual choice (read off the shed's own cards of that class), bent by the choices made.

### 3.2 The options and their symbols

Today's SVG symbols throughout (`_cage_design.js` option icons). New plain SVGs only where nothing existed: the wing
shapes (`iconPlan`, drawn from the preset's own stations), the open frame, the open cockpit, the twin tubes.

### 3.3 The cowl preset table (one per engine type × architecture)

| engine type | nose / nacelles | pusher | source |
|---|---|---|---|
| flat (boxer) | `flat` — the validated Cessna's own cowl | `flat@pusher` | COWL_PRESETS.flat |
| inline | `inline` — long flat-sided box | `inline@pusher` | COWL_PRESETS.inline |
| V | `vee` (a low elliptic wing: `faired`, the Spitfire's) | `vee@pusher` | COWL_PRESETS.vee / faired |
| radial | `radial` — the approved COWL_BY_ARCH shape | `radial@pusher` | COWL_PRESETS.radial |
| electric | `electric` — slim closed nose, two slots | `electric@pusher` | COWL_PRESETS.electric |
| turboprop | `turbine` — COWL_BY_ARCH | `turbine@pusher` | COWL_PRESETS.turbine |

Applied on the birth build through `CAGE_COWL_BIRTH_PRESET` (new: a load clears the editor's preset door, this one
survives the load and is spent by the first cowl build, or dropped by a build with no cowl), sized to the fitted engine
by the preset's own rule; every row is the builder's in the editor afterwards. **The pusher's back cowl:** the cowl is
on (the Pusher tile turned it off), its barrel runs the fitted engine's length to the prop's cone (the preset's length
rule, `env.length × 1.10`), `engBlockZ/Y` at 0 (FINISH-4's rule: cowled pushers ignore the block rows).

### 3.4 The rules added

- **The wing shape presets** (`WING_ARCH` + the `wingArch` starter row, beside `finArch`; the editor offers them too):
  rectangular (Cub), tapered (RV / D112), constant + taper (C172), elliptic (Spitfire), swept, cranked dihedral (Jodel
  D11). Fractions of the chord the aeroplane has; each writes the whole planform set. `wing_presets.png`.
- **The dihedral by position:** high/parasol 1.5°, mid 3°, low 5° (the cranked preset keeps its own 0 / 14°).
- **The aero nose:** `NOSE_AERO` with 3 rings and ease 0.30 whenever the engine is not on the nose.
- **The canopy:** a bubble is the windscreen's own continuation with the G267 numbers (bubH 0.79, bubW 1.25, one ring);
  the arceau fit is always on; the cabin lamps already follow the bubble (no flood, `_cage_light.js`); an open cockpit
  gets the open-tandem trainer's rows (one hole, or two with a bay) and no hood.
- **The engine model:** the family's catalogue engine nearest in ratio to the class's own power, split by the engine
  count (twin 0.85, three/four 0.45); a family more than 4× off is greyed with the nearest engine named.
- **The propeller:** turbine 3-blade carbon; electric over 90 kW 3-blade carbon; over 120 kW 2-blade metal; else wood.
- **The details nobody is asked:** flaps, suspension, fairings by class/mission/wing (`flapsFor`, `suspensionFor`,
  `fairFor`).
- **Colour + material:** `spec.paint` (base + a matching trim) and every exterior body section's tint (the aeroskin
  reach, `BODY_PAINT`), wing/fin/stab with it; the construction is `intCons` → the fuselage's material and the wing's
  (`wgCons` follows), so the mass and the structure follow (WYSIWYG).
- **THE STANCE AND BALANCE FIT** (`stanceFit`, run on the drawn aeroplane after the birth load):
  - the wing slid by `wgDx` until the static margin is in the band's middle (only outside 8-35 %; measured −0.55 of
    margin per metre, the CG −0.20 m per metre);
  - a taildragger's mains 18.5° ahead of the CG in the three-point attitude (GEN_RULES.gearRake 16 + margin — the
    gear layer's 15-18 window);
  - a tricycle's nose wheel at GEN_RULES.noseLoad 0.25 with the tip-back angle ≥ 15° (the tip-back wins when they
    disagree), then the nose leg sized so the deck sits GEN_RULES.trikeDeck 1.2° nose-up — the floor, the waterline
    and the designed incidence hold their lines on the ground;
  - the prop ≥ 0.25 m off the ground on a tailwheel, 0.22 m on a nose wheel (FAR 23.925 0.229 / 0.178 + a margin);
  - the legs' response per metre of row MEASURED once (s1Z moves the axle 1:1 and tilts the ground +0.06 / −0.19; s1Drop
    lowers it 1:1 and trails the axle 0.10 spring / 0.31 bungee / 0 oleo; s2Drop lowers the nose wheel 1:1) and
    solved as a small linear system.
- **The static grey table** (`RULES` in `tools/_new_plane.js`): CONFIG-MATRIX section 11 (pusher/lofted, push-pull/single,
  twin booms/T and V, over-the-wing/mid and low), an open frame's booms, a biplane's struts, the elliptic wing's struts,
  the classes' seats and bays, open cockpits and turtledecks ≤ 1 bay, engines by class and catalogue power, the
  ultralight's tube, **[VAL] a pusher on a tailwheel** (measured: tail-down, unflyable).

## 4. Validation A (one-time, not in the battery)

`node tools/newplane_validate.js --jobs=4` — the archetypes' choice sets, a constraint-aware pairwise covering array and
the extremes, each build judged by `tools/_newplane_lib.js`: builds, joins (engines drawn = flown), design check (no FAIL
row), static margin in the green band, stance (tricycle deck −0.5..+3°, nose share 5-40 %, tip-back ≥ 12°;
taildragger 7-17°; prop ≥ 0.18 m), circuit-capable, a short hop (60 m in 120 s). Log: `validation.jsonl`, pairs:
`validation_pairs.json`.

**Result** (`validation_final.jsonl`: pass 1 with every real failure re-run on the fixed rules; pass 1 alone is
`validation_pass1.jsonl`, the re-run `validation_retry.jsonl`):

```
FINAL 123 builds: 43 clean, 39 clean but for a standing kind, 41 with a real failure
by set {"arch":{"n":32,"clean":15,"standing":13,"real":4},"pair":{"n":77,"clean":22,"standing":19,"real":36},"ext":{"n":14,"clean":6,"standing":7,"real":1}}
STANDING kinds:
  fin taper                     18
  pusher disc                   29
  big cabin corner              16
REAL kinds:
  hop: rejected-takeoff / not accelerating          7  arch:mw5 pair:4 pair:33 pair:41 pair:58 pair:62 ext:smallest
  join: tail                                        7  pair:15 pair:42 pair:44 pair:54 pair:31 pair:72 pair:59
  design: pitch.Vh                                  6  arch:vtail pair:2 pair:30 pair:15 pair:49 pair:51
  circuit: climb # m/s, TORun # m                   6  pair:20 pair:30 pair:23 pair:46 pair:43 pair:71
  stance: tricycle deck # deg (level to no          5  arch:mw5 pair:6 pair:50 pair:64 ext:smallest
  stance: mains # deg ahead of the CG (#)           5  pair:4 pair:25 pair:44 pair:41 pair:72
  design: pitch.sm (worst corner)                   5  pair:11 pair:25 pair:42 pair:72 pair:63
  hop: rejected-takeoff / noseover                  5  pair:25 pair:15 pair:64 pair:70 pair:74
  stance: nose wheel carries # % (#)                4  arch:vtail pair:69 pair:76 pair:74
  stance: three#point deck # deg (#)                4  pair:12 pair:15 pair:47 pair:62
  join: prop through the body                       2  arch:c172 pair:34
  design: roll.spiral                               2  arch:chinook pair:22
  stance: tip#back angle # deg (>= #)               2  pair:76 pair:74
  hop: rejected-takeoff / will not                  1  pair:6
  hop: wont-climb / no climb                        1  pair:26
  hop: capsized / on its                            1  pair:42
  margin: # % (barely stable)                       1  pair:62
  hop: hop: NaN at # s (ROLL)                       1  pair:51
```

Note: the builds that passed in pass 1 were not re-run after the catalogue rule tightened (2.5x): a few of them (the
extremes' "vee elliptic", some pairwise V engines on light classes) used a choice the chooser now greys — they stand as
evidence that the combination built, not as offered options.

**What validation A found and fixed** (each saved as a fixture in `tools/fixtures/newplane/` or a rule unit):

| found | fix |
|---|---|
| the taildragger tile's mains 11.7° ahead of an eab's CG: the pilot holds 30 % throttle, rejects the take-off | the stance fit (mains 18.5° ahead in the three-point attitude) — fixed build `taildragger` |
| the n23 tricycle's nose wheel at 45-57 %, the LSA's deck +5.5° with 0.10 m of prop clearance, the ultralight's prop 0.02 m off the ground | the stance fit (nose share 0.25 / tip-back 15°, deck 1.2°, prop 0.22-0.25 m) — `f1_lsa_trike_stance`, fixed `tricycle` |
| the microlight pusher at a −13.5 % margin, rejected take-off | the balance fit (wgDx) + the light two-stroke for light pushers — `f2_ulm_pusher_balance` |
| a first one-pass fit sent the C172 card's choices to a 7.2° deck, a twin-tube taildragger to 35-40° (nosed over) | the fit re-reads the drawn aeroplane (≤ 3 damped passes), the three-point rake clamped, the tailwheel leg is `s2_twLegDrop` — `f4_twinrod_taildragger_deck` |
| centring a 4-bay cabin's loading spread left the Caravan's choices 70 % nose-heavy as drawn | the as-drawn margin stays in 10-32 % whatever the corners ask |
| a 190 kW Hirth V on a microlight (nose-over on the wheels); a 4-seater on the Clerget rotary (would not accelerate); biplanes under-powered (0.55 m/s climb) | catalogue ratio 2.5 (4 for the turboprop), no rotary, biplanes x1.3 power |
| a pusher on a tailwheel: tail-down, the disc in the ground | greyed ([VAL] in the rule table) |
| the fit read cage rows a saved spec does not hold (only deviations) as NaN | the fit reads the full panel values (defaults + the spec's cage) |

**STANDING** (reported, not hidden; each on master's own cards — `_newplane_lib.js standing()`):

- **fin taper** (18): every FIN_ARCH preset draws a fin taper of 0.15-0.22 that the core clamps to 0.35 (the join's
  "the drawn tail is not the flown tail"); the T-tail tourer card has it on master. Question 1.
- **pusher disc** (29): the disc through the wing or the pod on a pusher, an over-the-wing engine or a push-pull's rear
  (the Pod-and-boom, Archaeopteryx and Chinook cards on master): the disc stands over the wing / against the pod, not
  behind it — a garage gap (no row moves a body-face pusher's disc aft). Question 4.
- **big cabin corner** (16): 3-4 bays put the full-cabin corner's CG behind the neutral point whatever the wing
  station (20 of 28 such builds; 0 of 9 with 2 bays; the Caravan, DA62, twin bush and Beaver cards on master). Question 3.

**Still failing (41, mostly odd combinations), by kind, for the next pass:** the pilot's aborted take-offs ("not
accelerating", "nose-over" — mostly heavy engines on short bodies and over-the-wing ultralights), tail join notes on
twin-tube T/cruciform tails, low tail volume on V-tails (the V-tail card too: `pitch.Vh` 0.175), take-off runs past
1100 m on electric multi-engine cases, a handful of stances the 3-pass fit does not settle (over-the-wing ultralights,
very short twin-tube bodies), and the nose prop within 6 cm of the 4-seater's wide nose on two builds (the engine preset
is applied after the card's own rows, so the generator cannot move the mount row — a small `designFull` change).
Per-build numbers for the cards and the extremes:

| build | verdict | margin | deck | prop clear | nose share / mains angle | hop | what failed |
|---|---|---|---|---|---|---|---|
| arch:cub | clean but standing (fin taper) | 27 % | 9.57° | 0.27 m | 17.12° | 60 m at 33.38 s |  |
| arch:pietenpol | clean but standing (fin taper) | 27 % | 9.39° | 0.25 m | 17.02° | 60 m at 31.85 s |  |
| arch:stearman | clean | 17 % | 11.77° | 0.26 m | 16.94° | 60 m at 76.3 s |  |
| arch:camel | clean | 18 % | 13.91° | 0.26 m | 17.23° | 60 m at 29.42 s |  |
| arch:pittsAlike | clean | 14 % | 11.49° | 0.26 m | 15.46° | 60 m at 71.42 s |  |
| arch:jodel | clean | 20 % | 10.79° | 0.25 m | 16.35° | 60 m at 29.98 s |  |
| arch:c172 (retried) | **FAIL** | 23 % | 1.38° | 0.23 m | 33 % | 60 m at 26.32 s | join: prop: through the body (6 points) |
| arch:chinook (retried) | **FAIL** | 20 % | 1.2° | 0.22 m | 24 % | 60 m at 48.48 s | design: roll.spiral=7.87 |
| arch:tigermoth (retried) | clean | 22 % | 11.82° | 0.26 m | 16.9° | 60 m at 44.05 s |  |
| arch:rv | clean | 28 % | 1.19° | 0.26 m | 32 % | 60 m at 31.3 s |  |
| arch:savannah | clean but standing (fin taper) | 29 % | 11.12° | 0.27 m | 16.05° | 60 m at 34.97 s |  |
| arch:spitfire | clean but standing (fin taper) | 32 % | 11.8° | 0.25 m | 17.03° | 60 m at 28.12 s |  |
| arch:motorglider | clean | 11 % | 13.05° | 0.25 m | 17.36° | 60 m at 33.7 s |  |
| arch:pusherPod | clean but standing (pusher disc) | 16 % | 1.16° | 0.22 m | 24 % | 60 m at 53.45 s |  |
| arch:sesqui | clean | 14 % | 10.23° | 0.26 m | 15.91° | 60 m at 81.03 s |  |
| arch:floatplane (retried) | clean | 25 % | 0° | 1.27 m | - | n/a (floats: the land strip) |  |
| arch:vtail (retried) | **FAIL** | 28 % | 1.18° | 0.36 m | 44 % | 60 m at 30.72 s | design: pitch.Vh=0.175 ctl.flare=1.36 / stance: nose wheel carries 44 % (5-40) |
| arch:ttail | clean but standing (fin taper) | 30 % | 1.39° | 0.25 m | 30 % | 60 m at 27.03 s |  |
| arch:caravan | clean but standing (fin taper, big cabin corner) | 31 % | 1.19° | 0.22 m | 28 % | 60 m at 13.43 s |  |
| arch:etrainer | clean but standing (fin taper) | 33 % | 1.18° | 0.22 m | 26 % | 60 m at 31.32 s |  |
| arch:ul1 | clean | 28 % | 11.87° | 0.25 m | 16.81° | 60 m at 27.2 s |  |
| arch:archaeopteryx | clean but standing (pusher disc) | 7 % | 1.19° | 0.22 m | 24 % | 60 m at 18.37 s |  |
| arch:twinBush | clean but standing (fin taper, big cabin corner) | 28 % | 1.13° | 1.11 m | 23 % | 60 m at 40.27 s |  |
| arch:da62 | clean but standing (fin taper, big cabin corner) | 29 % | 1.14° | 0.22 m | 23 % | 60 m at 23.52 s |  |
| arch:trimotor | clean | 21 % | 1.23° | 0.25 m | 29 % | 60 m at 19.98 s |  |
| arch:p38 | clean | 13 % | 1.21° | 0.59 m | 26 % | 60 m at 19.62 s |  |
| arch:pushPull | clean | 14 % | 1.19° | 0.23 m | 25 % | 60 m at 23.4 s |  |
| arch:radial (retried) | clean but standing (fin taper) | 26 % | 10.96° | 0.24 m | 16.63° | 60 m at 32.22 s |  |
| arch:mw5 (retried) | **FAIL** | 11 % | 12.58° | 0.58 m | 25 % | no | stance: tricycle deck 12.58 deg (level to nose-up: -0.5..+3) / hop: no lift-off in 120 s (STOPPED) - the pilot: rejected-takeoff (not accelerating (0.00 m/s^2 a |
| arch:beaver | clean but standing (fin taper, big cabin corner) | 32 % | 10.55° | 0.26 m | 15.98° | 60 m at 68.88 s |  |
| arch:skymaster | clean | 21 % | 1.2° | 0.25 m | 25 % | 60 m at 24.02 s |  |
| arch:fourEngine | clean | 18 % | 1.18° | 0.55 m | 28 % | 60 m at 18.7 s |  |
| ext:twin bush | clean but standing (fin taper, big cabin corner) | 29 % | 1.13° | 1.13 m | 24 % | 60 m at 34.88 s |  |
| ext:three on floats (retried) | clean but standing (fin taper) | 20 % | 0° | 0.58 m | - | n/a (floats: the land strip) |  |
| ext:vee elliptic | clean | 32 % | 10.39° | 0.25 m | 17° | 60 m at 24.6 s |  |
| ext:smallest (retried) | **FAIL** | 10 % | 12.53° | 0.77 m | 25 % | no | stance: tricycle deck 12.53 deg (level to nose-up: -0.5..+3) / hop: no lift-off in 120 s (STOPPED) - the pilot: rejected-takeoff (not accelerating (-0.01 m/s^2  |
| ext:push-pull | clean | 15 % | 1.19° | 0.23 m | 25 % | 60 m at 24.03 s |  |
| ext:lsa electric pusher | clean but standing (pusher disc) | 24 % | 1.16° | 0.48 m | 25 % | 60 m at 39.7 s |  |
| ext:radial biplane | clean | 17 % | 11.97° | 0.26 m | 17.54° | 60 m at 59.87 s |  |
| ext:sailplane | clean | 11 % | 13.05° | 0.25 m | 17.36° | 60 m at 33.7 s |  |
| ext:eab swept low | clean | 33 % | 1.18° | 0.26 m | 32 % | 60 m at 30.57 s |  |
| ext:ul1 twin floats (retried) | clean | 19 % | 0° | 1.27 m | - | n/a (floats: the land strip) |  |
| ext:largest | clean but standing (big cabin corner) | 27 % | 1.11° | 1.12 m | 23 % | 60 m at 22.22 s |  |
| ext:turboprop | clean but standing (fin taper, big cabin corner) | 31 % | 1.19° | 0.22 m | 28 % | 60 m at 13.43 s |  |
| ext:sail pusher | clean but standing (pusher disc) | 13 % | 1.46° | 0.43 m | 24 % | 60 m at 35.9 s |  |
| ext:ulm cranked parasol | clean but standing (fin taper) | 24 % | 10.75° | 0.25 m | 17.15° | 60 m at 33.85 s |  |

## 5. Gate B (recurring): GATE NEWPLANE

`node tools/_newplane_check.js` — **core tier, 45 checks, 51 s** on the quiet cloud box (4 cores), PASS:

- **rule units (no build):** 14 steps (10-15), every option a symbol and a label, no blade choice; every non-authored
  card reachable (authored ones outside printed); CONFIG-MATRIX's greys; greys read only earlier steps; one cowl
  preset per engine type, `@pusher` for the pusher; the aero nose (collapse 0.98, 3 rings, ease 0.30) on every
  nose-free layout, the firewall on a nose engine; the pusher's back cowl with the block rows at 0; the fin choices are
  exactly FIN_ARCH; each wing preset's rows; the canopy rule; colour and material into the spec; a catalogue engine
  for every offered type and class; 40 random choice sets hold no greyed option;
- **the flow** (`src/viewer/new_plane.js` over a DOM stub): opens full-screen and holds the render loop; cancel touches
  nothing; every step answered by a tile, the summary reached; **nothing composed, built or loaded while choosing**;
  back/next; Generate: one bake, one load + one fit load, closed, hold released, the editor on STRUCTURE, a second
  press ignored; the spec says what was chosen (`meta.newPlane`);
- **one joined build:** the tricycle (bake, the cowl's birth preset, the drawing layers + the join, the stance fit,
  judged);
- **5 seeded random builds** pre-join (the seed is the day number, printed; `NEWPLANE_SEED=<n>` replays it).

`node tools/_newplane_check.js --builds` — **GATE NEWPLANE-BUILDS, full tier, 11 checks, 230 s**, PASS: the fixed
taildragger, tricycle and floats + the saved fixtures (f1, f2, f4) + 5 seeded builds. `--selftest`: four doctored rules
(a pusher on a lofted body, a four-ring nose, a turbine with no cowl preset, an unreachable card) each go red. No
nightly sweep.

## 6. Renders

Cloud, SwiftShader, `tools/plane_shot.js` (the phone profile's studio; the builds go in through the fleet's Import).
Two small fixes to the tool on the way: `&idle=0` (PHONE-1a's idle hold froze the frame, so its in-frame check read
0 % on every shot) and the new chooser closed before each import (a fresh profile's first launch opens it). A `_FAIL`
in a raw file name is the tool's edge check (the phone sheet takes a third of the 1600 px frame, the wingtips run off
the 3/4 view); the pictures themselves are whole aeroplanes.

- **BEFORE** (today's flow, master): `before/before_side.jpg`, `before/before_34.jpg` — Custom build (the stock
  aeroplane it parks you on), five seeded "surprise me" rolls (twin-boom float biplanes with four STOL devices, a
  four-bay biplane on a nacelle pair...), three generated cards. Build files beside them.
- **AFTER** (the new generator, each build the chooser's own path: bake, the cowl preset, the join, the stance fit):
  `after/after_side.jpg`, `after/after_34.jpg` (16 planes), and full-size: `01_tourer_trike_s` (a 172-class tricycle
  side-on: deck 1.4°, sitting level), `03_lsa_electric_bubble_s` (LSA, low tapered wing, bubble over a turtledeck,
  tricycle), `12_turboprop_s` (4 bays, tricycle), `02_wood_taildragger_s` (three-point 10.7°), `07_radial_bush_s`,
  `09_radial_biplane_open_s` (open cockpits), `06_luxury_twin_s`, `14_swept_sport_q`. Build files beside them
  (`after_*.json`). `08_vee_elliptic` flies a boxer: the V was greyed for the eab class by the catalogue rule (2.6x).
  Two pictures show the join's red prop: `01` (the open nose clearance defect) and `05` (the standing pusher disc).
- **The wing presets:** `wing_preset_symbols.png` (the chooser's symbols), `wing_presets_top.jpg` (rectangular, tapered,
  constant + taper, elliptic, swept, cranked — on real generated aeroplanes, from above), `wing_presets_front.jpg`
  (the dihedral by position; the cranked preset's flat centre and 14° outer panels).
- **The chooser:** `chooser/phone_*.jpg` at 360 x 780 on the phone profile (start, the class, the wing with greyed
  options and their reasons, the tail, the colour, the summary), `chooser/symbols.jpg` (every option's symbol),
  `chooser/desktop_*.jpg` at 1400 x 900 on the desktop profile.

## 7. Gates

Node, cloud, this branch (`--no-build` over the branch's own build), all named gates:

| gate | result |
|---|---|
| STARTER, DESIGN, PARTS, SAVE, JOIN, UISMOKE, UISMOKE-PHONE, CARDS, UILAYER | **PASS** (all nine) |
| NEWPLANE (new, core) | **PASS** — 45 checks, 51 s (53 s on the rebased tree) |
| NEWPLANE-BUILDS (new, full) | **PASS** — 11 checks, 230 s (213 s on the rebased tree) |
| ARCHETYPES (full, 4 shards) | FAIL (1) — **standing**: "Chinook-alike: the circuit completes — rejected-takeoff", the identical line on master `0fcf54ef` (`--only=chinook` run on both trees). The other 30 live cards pass; the card is a stock design this branch does not touch |

**The browser runs** (Playwright, SwiftShader, `index.html`, a fresh profile):

- **phone** (360 x 780): the chooser opens by itself on the first launch; **0 renderer frames in 3 s while it is up**
  (54 in 4 s after the hand-over); 0 composes / 0 loads / 0 editor builds over 14 steps; Generate: 1 bake + the birth
  load + 3 fit loads (~42 s on SwiftShader, behind the spinner), then STRUCTURE with 831 sliders; 0 page errors.
- **desktop** (1400 x 900): the same flow, the same counts, 0 page errors. The renderer counter read 82 in the 3 s just
  after the boot with the chooser up — more than the shed loop ever draws here (11 in 4 s after the hand-over), i.e.
  the world's background bakes finishing after the boot screen lifted; the phone run (no world) is the clean count.
- One fix the runs found: a first launch can open the chooser before app.js has published its hold, and the shed drew
  behind it (36 frames) — the loop now asks the chooser itself (`NEW_PLANE.isOpen()`).

Not run here: the rest of the battery (`run_gates.js --all`), left to the train.

## 8. "Anything else critical?" — proposals

| proposal | status |
|---|---|
| **mission hint** biasing the defaults | **ADDED** (step 2): the role table the cards already carry - flaps, the bush tyre, the wing - written before the explicit choices, so it biases and never overrides |
| **registration** | **ADDED** on the summary (optional, `meta.reg`, painted on the boom). The NAME stays the save slot's (the G65 ruling: a birth-flow name field would be a second writer) |
| **seat count** | covered: seats = the row (single / side by side) x (1 + bays); the bays' tile says "a tandem, or a 2+2". A seat-count readout on the summary is a 10-line follow-up |
| **flaps kind** | a rule today (`flapsFor`: none for aerobatic / glider / biplane / the single-seat ultralight, slotted for bush / cargo / n23, Fowler on a bush microlight, plain otherwise). Proposed as an optional "wing details" row if the user wants it among the main choices |
| **fixed vs retractable gear** | NOT offered: the retraction row is `declared`, not built (no mass, drag, price or mechanism model - `_cage_design.js` retract). A garage gap first |
| **the panel level** | from the class seed today (`systems.fit` minimal / basic / ifr). Proposed as a 3-tile row after the cabin (cheap, it is one spec field) - left for the user's call since it moves price and mass |
| **a pusher with its disc behind the trailing edge** (found here) | a garage gap: no engine-block / extension-shaft row moves a body-face pusher aft of a high wing; the shed's own pusher cards strike their wing on master |
| **amphibian floats, skis, the inverted V on twin booms, a T-tail between two fin tips** | CONFIG-MATRIX's garage gaps, not offered |


## 9. Questions for the user

1. **(N1 follow-up)** The fin taper error cannot be cleared by any tip shape (section 00). Should the join measure the
   fin proper ABOVE the boom deck? Saved builds would then fly their measured taper instead of today's clamp at 0.35.
2. (answered 3 Nov: N2 accepted, N3 kept + owed rule, N4 greyed, N5 kept.)
