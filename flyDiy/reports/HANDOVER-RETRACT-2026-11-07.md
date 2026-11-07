# HANDOVER - RETRACTABLE GEAR AND AMPHIBIOUS FLOATS (cloud session, 3-7 Nov 2026)

The retract work moves to a local session that can test on the box. The user's word on it: "not great yet, not final".
This is where it stands at **claude/retract-study @ d44e54bc** (claude/affectionate-edison-fx8582 is the same
commit). claude/hull-types already contains everything up to d44e54bc, and there is nothing after it.

**Where to read more:**
- the study: `futureDesigns/RETRACT-STUDY-2026-11.md`, sections 1-3 (research and plan) and 8.1-8.32 (as built, in
  order);
- HANDOVER.md, the RETRACT phase 1 and phase 2 entries;
- the evidence page: the artifact "Retractable Gear Evidence", https://claude.ai/artifact/FiTHnhqbAT9a48KedGjF7c
  (version 17, private to the user), one entry per option, each with its rows and screenshots.

**How it was tested.** Everything was checked HEADLESS: GATE RETRACT, quickshot renders, and scene builds through
`_scene_headless.js`. Nothing was seen in a live browser garage or a live flight by this session. That is the first
thing the local session can do that this one could not.

---

## 1. WHAT WORKS

All of the following is green in GATE RETRACT on its test cards. Where the user looked at it, they said so.

**The core and the flight** (phase 1, the study's section 3.1 as built):
- **The spec.** `gear.retract` is emitted by the join (`_cage_join.js`) only for a tricycle without floats. It carries
  the time, the actuation, the fraction, the hoist / arc, the units' kinematic record, and the wells' litres taken from
  the tanks (`60c_gen_energy.js`).
- **The solver** (`30_solver.js`):
  - the handle `ctl.gear` (1 down, 0 up) and the transit `st.gear` at 1 / time, on bus power for electric and
    hydraulic, always for manual;
  - **the squat switch**: no retraction while a wheel is loaded;
  - the emergency extension;
  - a wheel rolls only down and locked; in transit it scrapes; up, it rides up into its well, so a gear-up landing
    lands on the belly with no new law.
- **Drag.** The gear's CdA is applied by `st.gear` (open wells and doors add about 15 % in transit, `[TUNE]`). GATE
  RETRACT's flight block shows the partial-retraction downwind between down and fully up.
- **Mass and price:** `R.retractKg` on the axles, plus GEN_PRICES.retract (`61_gen_frame.js`).
- **Water:** a retracted wheel is no bluff plate (`32_hydro.js`).
- **The pilot** (`43_pilot.js`): gear up after take-off and down on the approach (GUMPS), and a rare "forgets the
  gear" quirk per profile (gearForget: expert 0.005, club 0.01, student 0.02). The die is a hash of the seed and the
  approach, so it draws no random numbers.
- **The viewer:** the gear key, the HUD lamps, the horn, and the swing replayed from the same kinematics.

**One kinematics** (`src/core/62c_gear_mech.js`, GEAR_MECH). The garage preview, quickshot and the flight all pose from
it:
- the fold chain: turns about a hinge, a twist, a fraction;
- the shortening slide (`shorten`);
- the whole-unit hoist (`hoist`);
- the folding knee's arc (`arc`);
- two-link braces, doors, and aimed links;
- a point on a link (`along`).

**Fold types** (row gearFold; `_cage_gear.js` FOLD_KEYS, all presets plus 'custom'):

| # | key | what | test card | status |
|---|---|---|---|---|
| 0 | inward | into the wing root or under the belly (Mooney, Bonanza) | ttail, B-ITES | green; wells and doors |
| 1 | outward | outboard | battery | green |
| 2 | aftFlat | aft, the wheel turned flat (P-40) | battery | green |
| 3 | aftBelly | aft and in, flat: the 210's twist-and-tuck | the **skymaster card** | green |
| 4 | skymaster | two axes | battery | green |
| 5 | custom | two turns plus twist, set by rows | — | as set |
| 6 | catalina | PBY: the leg outside along the hull, a side strut with a knee, a V-strut jack, one round side recess | c172 as a hull | green except that card's cabin floor |
| 7 | nacelle | into the engine nacelle; the nacelle grown to fit (gearNacFit) or a separate pod (gearNacPod) | da62, twinBush | green |
| 8 | knee | the folding knee: an arm from a pivot just inside the hull, the leg upright, a quarter circle up and in; a little piston on the arm's horn | c172 as a hull | green except the floor |
| 9 | lfold | **the Super Petrel's V2**: a rigid L turned 90 deg up, the tyre flat in the lower wing | the Petrel (hull-types card) | green on the Petrel |

**The nose:** aft, forward, custom. A forward-folding nose stows in the cowl's lower quarter (a cowl is structure that
the knife cuts).

**Wells** (the automatic cut):
- the swept unit's points inside the body, wing or nacelle give an **exact** outline (a convex hull, round where a
  wheel is) or a **box** (gearWellCut);
- each well is a closed box from the outline to one flat ceiling (`_knife_gen.js` wellBox), carved of structure;
- side wells for the Catalina and the knee; the knee's **keyhole** (a round recess plus a slot over it for the leg);
- the rigid L's round recess **in the lower wing**: the second plane's skin is now cut, with each cut naming its
  plane;
- wells into nacelles and cowls; the wing's own cut capped under its upper skin;
- the litres a well takes come out of the tanks.

**Doors:**
- leg doors carried by the unit;
- well doors (one, or two split along the well), hinged on the outer long edge, which **turns on the edge's tangent at
  its middle** (7 Nov fix for the Petrel's bow doors);
- slab doors: thickness, bevel, grime, seam;
- flush up: GATE RETRACT section 17 measures the outer face;
- **with no leg door, well doors stay open gear down and close only up** (the user, both versions);
- the knee's two full-door versions (on the leg with a foot door; on the hull, hinged at the top and swung up under the
  wing).

**Fit checks** (foldFit): a red with the rows to change, for:
- out of the skin, through the wing, past the trailing edge;
- the cabin floor (stopped at the firewall);
- units meeting or crossing the centre line;
- the actuator's stroke and place;
- the wing over the Catalina or knee;
- each fold's own words.

**The amphibious floats** (row fltAmph, `_cage_float.js` amphib, `32_hydro.js` WIPLINE_AMPHIB / AMPHIB_GEOM /
amphibOf):
- **Wipline:** Wipaire's published models and tyres (2100-13000; 5.00x5 = 14 in, 8.50x10 = 25.3 in). The mains just
  aft of the step swing up; the castering nose trolley retracts into the float's nose as its dock bumper. Keel
  clearance 0.8 R, measured off Wipaire's 3-views.
- **EDO style:** from the user's photographs. The nose leg is anchored at the bottom of the float's front, about 20 cm
  aft of the tip, and swung up by a little piston to the bow tip. The landing rake is solved to 15-45 deg.
- Gate section 19 and GATE FLOATKIT.

---

## 2. NOT FINAL, OR KNOWN BAD

Each item gives what the user saw or said, and what this session saw.

1. **Nothing is checked in a live garage or flight.** All evidence is headless renders and gates. The new folds (the
   knee's arc, the rigid L, the hoist) are posed by the core; the gate checks the pose arithmetic, but the in-flight
   view was never looked at.

2. **The hull stand-in.** The Catalina, knee and rigid-L gates run on the C172 card "as a hull" (floorY -0.25, a second
   wing added). Its raised cabin floor stays red: 64 mm (knee open), 107-137 mm (knee full doors), 62 mm (the nose).
   That is the card, not a hull, but no real hull card is gated in GATE RETRACT. The Petrel is on claude/hull-types
   only.

3. **The Super Petrel V2, the rigid L** (d44e54bc).
   - The user sent a sketch, approved the build, and asked for the automatic round wing cut, which is now done. The user
     has NOT yet validated the result.
   - Seen: green on the hull-types HULL-B64 card at s1X 0.86 with w2Dy 0.0 or 0.025 (arm 0.14 m, leg 0.15-0.18 m).
   - The lower wing's underside at the station measures about -0.04 m. The hull-types session had relayed +0.10, which
     is wrong.
   - The leg is the knee's upright oleo. It reads chunky in renders at this small scale.
   - The piston passes the hull side through a 70 mm deep slot well, with the piston running on through its floor
     inside: a crude interior.
   - The arm, stowed, stands outside along the hull side, visible.

4. **The folding knee** (V1 on the Petrel, gearFold 8).
   - The user approved the knee ("that's good"), asked for the piston, the cut on top and full doors, then the hull-hinged
     door. The final screenshots were not validated.
   - The slot over the recess is not "little". The knee passes the skin near the beam, so the slot is about as tall as
     the circle is wide.
   - The leg-door version hangs its door beside the wheel like a fairing when down, with the slot's part standing up as
     a fin.
   - The hull-door version's door follows the hull's curve: open, it dips 180 mm below its hinge line.
   - Full doors under a low wing are red, honestly.
   - The "hidden when stowed" test checks the leg's axis, not its radius.

5. **The Catalina's under-wing behaviour** (since 30f7632): a hoist plus a telescoping oleo when a wing is over the
   mains. This session offered to take it back out of 'catalina'. No answer came.

6. **Door hinges on curves** (462250ae). On a curved, convex outline the hinge edge is only the outermost 12 mm band,
   and a straight axis leaves 8-12 mm on the edge's ends. A straight hinge can't follow a curved edge.

7. **Doors in quickshot are grey.** quickshot draws a door with its material colour, not the skin's paint. The garage
   should paint them, but that was not looked at live.

8. **The knee's full-door flush** is measured at 7 mm against the airframe's section probe, whose chords sit off the
   faceted bilge. The door is the skin itself; the probe is the cause.

9. **The EDO float style.** It is built from the user's photographs, not from EDO data (the record says "EDO
   (photographs)"). Wipline is from Wipaire's data.

10. **Drag in transit** (+15 %) and the retraction kit's mass are literature-light, `[TUNE]`.

11. **Known reds, not from this work:** CLIP, JOINPARITY, ENGCONFIG, HANDLE. They were red before retract work began
    and were not re-run since phase 2.

12. **GATE RETRACT is slow:** about 15 minutes headless.

---

## 3. GARAGE ROWS (all in `tools/_cage_gear.js` unless said)

The retract rows are **absent while the gear is fixed** (CAGE_RETRACT_ROWS in `_cage_gen.js` and the spec's list in
`60_gen_spec.js`), so no saved build gains a key. gearPos is never saved.

| row | default | what |
|---|---|---|
| gearRetract | 0 | fixed / retractable; the design tile `retract` (any tricycle without floats, s2On) |
| gearRetT | 6 | the cycle time, s, one way |
| gearRetAct | 1 | electric / hydraulic / manual (Johnson bar) |
| gearPos | 1 | the preview's position (1 down, 0 up); never saved |
| gearFold | 0 | the mains' fold, FOLD_KEYS 0-9 (table above) |
| gm1Ax, gm1Ang, gm2Ax, gm2Ang, gmTwist | 0, 90, 1, 0, 0 | the mains' custom turns |
| gearFoldNose | 0 | the nose: aft / forward / custom |
| gn1Ax, gn1Ang, gn2Ax, gn2Ang, gnTwist | 1, 90, 0, 0, 0 | the nose's custom turns |
| gearRetFrac | 1 | the fraction retracted (0.3-1; 0.6 a DC-3's) |
| gearWellCut | 0 | the well outline: exact / box |
| gearDoors | 2 | well doors: none / one / two (split) |
| gearLegDoor | 1 | the leg door: off / on (exact outline only) |
| gearShort, gearShortNose | 0, 0 | the leg shortens as it retracts (share, up to 0.45) |
| gearNacFit | 1 | the nacelle fitted to the gear (the nacelle fold) |
| gearNacPod | 0 | a separate gear pod under the nacelle |
| gearKneeDoor | 0 | the knee's recess: open / full door on the leg / full door on the hull, hinged at the top |
| fltAmph (`_cage_float.js`) | 0 | amphibian floats: none / Wipline / EDO style |

**Which builds use them:**
- **The skymaster card** (`_cage_design.js` ARCHETYPES): gearRetract 1, gearFold 3, gearShort 0.3, gearShortNose
  0.3, s1X 0.43, s1Z 1.7, s1R 0.17, floorY -0.25. **This card changed:** it is retractable now.
- **The design tile `retract`** writes gearRetract 0 / 1 on any tricycle.
- **The Super Petrel** on claude/hull-types (`hull_matrix.js` superPetrel): V1 = gearFold 8, gearKneeDoor 0; V2 =
  gearFold 9 (the hull-types session merges and decides).
- **The battery** (`tools/retract_battery.js`, 12 cases): ttail (fuselage, wing, box, partial 0.6 / 0.85, nose
  forward), c172_catalina, B-ITES (as is, wing, nose forward), da62_nacelle, twin_nacelle_bay and more.
- **GATE RETRACT** builds its own cards over ttail and c172.
- **fltAmph** is used by no stock card. GATE RETRACT section 19 and GATE FLOATKIT build the c172 on floats with it.

---

## 4. GATES

| gate | last state | when |
|---|---|---|
| RETRACT | **PASS** | at d44e54bc (7 Nov, about 15 min) |
| GEAR, KNIFE, PARTS, DESIGN, SAVE, FLOATKIT | **PASS** | at d44e54bc |
| UISMOKE, COWL, NACLAG, ENGMESH, JOIN | PASS | 5 Nov, end of phase 1; not re-run since |
| CLIP, JOINPARITY, ENGCONFIG, HANDLE | red, not ours | before retract work |

**GATE RETRACT's sections:**
- 1-12: the spec, the squat switch, the circuit, drag, the pilot, flights, the fold;
- 13-16: wells and their closed boxes;
- 17: doors (flush, slab, the tangent hinge, open down without a leg door);
- 18: the Catalina, the knee (piston, keyhole, full doors, hull door) and the rigid L (round cut in the lower plane,
  piston, the too-wide-track red);
- 19: the amphibian floats.

The scripts are `tools/_retract_check.js` and `tools/_<gate>_check.js`. Rebuild (`node tools/build.js`) after any
src/core edit; the headless scripts read `tools/flight_core.js` and refuse a stale one.

---

## 5. CHANGES THAT COULD TOUCH BUILDS WITHOUT RETRACT

Each is meant to be inert without gearRetract or fltAmph. Worth a look:

- **30_solver.js.** The gear state (GR) is null and `ctl.gear` is never set on a fixed build (the `RET` flag). Contacts,
  drag and water only read `st.gear` when GR exists.
- **62_gen_aero.js.** The gear CdA build-up (`genGearCdA`, added to fusCdA) is unchanged for fixed gear. The solver
  scales it by `st.gear` only on a retract build.
- **61_gen_frame.js.** The kit's mass and price only `if (S.gear.retract)`.
- **60_gen_spec.js.** `clampSpec` normalises `gear.retract`; the retract rows are absent unless retractable; the
  fingerprint drops gearPos.
- **60c_gen_energy.js.** The wells' litres come out of the tanks only with `gear.retract` and `gear.wells`.
- **43_pilot.js.**
  - **gearForget was added to the profile presets** (data). That could matter to anything that hashes or compares
    profiles.
  - The behaviour is gated on `def.params.retract`, and the forget die draws no random numbers.
- **32_hydro.js.** The amphibian tables (data) and the retracted wheel's ride-up (`WB.lift`, retract only).
- **_cage_join.js.** The retract spec, plus fairings and leg fairs set to 'none', **only when gear.retract** exists.
- **_cage_wing.js** (d44e54bc). **On every biplane, the second plane's skin meshes now carry userData.wingSkin and
  wingPlane 1.**
  - The editor's wingWellApply and quickshot now see them. Each cuts a mesh only with cuts naming its plane, and only
    the rigid L names plane 1, so nothing should change.
  - doorBuild skips plane 1.
  - Anything else that collects `wingSkin` meshes would now also see the second plane. A grep found only the gear,
    UI, quickshot and the gate.
- **_knife_gen.js.** Side wells, the keyhole wall drop and closed well boxes. These are used only with gear cuts, but
  the knife is shared with windows and doors: GATE KNIFE passes.
- **quickshot.js.** Smooth shading (vertex normals) is now the default for every render (`--flat` for the old look).
  Wing wells are cut per plane. Its images differ from before for every card.
- **_cage_cowl.js.** gearNacFit only with the nacelle fold.
- **The skymaster card** is a different aeroplane now (retractable): any reference image or number for it moved.

---

## 6. WHAT I'D DO NEXT

1. **Look at it live, in the garage and in flight:** each fold with the preview slider; the Petrel V1 and V2; a gear-up
   landing; the HUD lamps and horn; the flight's swing against the garage's.
2. **Get the user's verdict on the Petrel V2** (the rigid L) on the real card. Then settle the leg's look at that scale
   (a slimmer leg, a fairing at its top as in their photo), and the piston's interior (a bay rather than a slot box).
3. **Gate a real hull card** in GATE RETRACT, not the C172 stand-in, and drop the stand-in's floor reds.
4. **Settle the Catalina's under-wing hoist:** keep it or take it out.
5. **Doors on strongly curved outlines:** a hinge along a polyline, or a door split at the edge's bend, if the user
   still sees an edge leave the skin.
6. **Tune the transit drag and the kit's mass** against a data point, if one is found (section 1.9 of the study has the
   pairs).
7. **Speed up GATE RETRACT** (about 15 min): cache the scene builds the sections share.
8. **A tip for the next session:** don't `git worktree add` a second full checkout of this repository (about 2 GB
   each); it filled the disk here. To test another branch's card, extract `flyDiy/tools`, `src`, `assets`, `vendor`,
   the built files and the card's inputs with `git archive <ref> <paths> | tar -x`.

No further feature work was done after d44e54bc.
