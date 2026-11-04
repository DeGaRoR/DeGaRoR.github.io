# RETRACT-1 - status (2026-11-03)

What was run, on this 4-core cloud box, at the RETRACT-1 commits (branch claude/retract-study = claude/affectionate-edison-fx8582):

- **GATE RETRACT** (`tools/_retract_check.js`, core): PASS. Every section: spec, bill, squat switch, the expert's
  circuit, drag, the gear-up landing, power and emergency, the forgetful person, the horn.
- **Fixed builds unchanged:** `fixed_identity.js` (here) flies the Cub, the Jodel, the metal Cessna and the PA-18 on
  floats. Each runs 150 s with the expert, the club pilot and the student, on master e6bcfb36's core and on this
  branch's. Every position, ctl and phase hash is the SAME (12 of 12):
```
cub/expert DOWNWIND 746132b95342
cub/club DOWNWIND 41711e5e71bc
cub/student DOWNWIND b09a838b6970
jodel/expert DOWNWIND cf14c82d88e4
jodel/club DOWNWIND 588ee8aa2979
jodel/student DOWNWIND 66ede7c1d4ac
metal/expert BASE febaf979af3f
metal/club BASE a9d18256fcde
metal/student DOWNWIND 42fb8f09ac85
floats/expert STOPPED acdf76cf93b1
floats/club STOPPED 67f5e12c7aa3
floats/student STOPPED 8edce1408883
```
- **Gates run green:** INPUT, AUDIO, DEFAULT, HONEST, UISMOKE, JOIN, SPECFIX, STARTER, PARTS, DESIGN, PILOTS, GEAR.
- **Red here, and red the same on a clean master e6bcfb36 worktree** (not this chantier's):
  - JOINPARITY: 8 FAIL. The page capture predates the tank-fit masses.
  - TECH: 1 FAIL, [pitch:seaplane] (A0's L30c note: "master standing").
  - CLIP: 4 new rows, the nav aerial in the fin on stock+ifr.
- **NOT run:** the whole core battery and the full tier (ARCHETYPES, PILOTMATRIX, SEAPLANE, HOTHIGH). On this box the
  core alone was still on its first two gates after 20 minutes, and was stopped. The delivery verdict
  (`run_gates.js --all`) is A0's to run on the box.
- **Pictures:** `ttail_gear{1,0.5,0}_{front,side,q}.png`, the T-tail tourer drawn by `tools/quickshot.js --gear`
  (no game, no browser).

## G1 - the fold (2026-11-04, merged with master L30d 05f95aa76)

- **GATE RETRACT:** PASS, §10 included. The fold's semantics, the mirror, the fraction, the preview, the join's lift
  and fraction, the certificate strip, and a partial gear's downwind between the two (50.22 < 50.46 < 51.06 m/s).
- **Fixed builds bit-identical to master L30d's core:** 12 of 12, the same hashes as above.
- **Gates green after the merge:** VIEW, PARTS, DESIGN, JOIN, STARTER, UISMOKE, SPECFIX, GEAR, INPUT, AUDIO, PILOTS.
- **STOL:** red here and identically on master L30d (the six builds' join comparison against the 0fa773687 baseline and
  the chinook card - A0's re-capture owed since the tank fit). Not this chantier's.
- **Stills (quickshot `--gear`, the T-tail tourer):**
  - `g1_folds_half_front.png`, `g1_folds_half_side.png`: the five mains folds half-way;
  - `g1_folds_up.png`: aft-flat and twist-and-tuck stowed, and inward at fraction 0.6.

## G2 - does it fit (2026-11-04)

- **GATE RETRACT:** PASS, §11 included. The T-tail tourer as born doesn't fit: its mains meet and stow 79 mm out of the
  body. Its half track, fold and leg rows go red. The fit costs about 22 ms. Configurations held by the gate:
  - a 3.2 m track at a 0.6 fraction fits, with nothing red;
  - the mains moved forward cross the front spar;
  - a nose turned too far rises into the floor;
  - a fixed gear has no fit and nothing red.
- **In the editor** (index.html, the phone-profile garage under SwiftShader, Playwright):
  - the imported retract build has 19 rows red, each with its reason as the tooltip;
  - the retraction row's note says "does not fit: the right main, up, is not inside: 79 mm out of the body (+2)";
  - set to a 3.2 m track at a 0.6 fraction, no row is red; no page error;
  - the still: `g2_red_rows.png` (the half track and the leg drop, red).
- **Gates green:** VIEW, PARTS, DESIGN, JOIN, STARTER, UISMOKE, SPECFIX, GEAR.
- **CLIP:** the nav aerial's 4 rows, the same as on master.

## G3 - the reservation (2026-11-04)

- **GATE RETRACT:** PASS, §12 included. A well per unit round its stowed wheel; the tank test (body box turned, wing
  side box, a tank 2 m off); the join's gear.wells; the under-floor bay 313.9 → 207.3 L as born; the wing root
  347.5 → 308.7 L with a 3.2 m track; no retraction, no wells; a fixed build's bays untouched.
- **In the editor** (Playwright, index.html):
  - the T-tail tourer with a 3.2 m track and an 80 L wing-root tank: the tank is RED, "the retracted gear's well
    (right main)";
  - set fixed, the tank is fine again.
  - One page error in the run, `crewEach ... reading 'grid'` (the nose tank's auto-fit, TANK-FIT): it happens
    identically in a control run with no retraction at all, so it is master's, not this chantier's.
- **Gates green:** VIEW, PARTS, DESIGN, JOIN, STARTER, UISMOKE, SPECFIX, GEAR, ENERGYBASE, BAY, ENERGY, TANKMOUNT.
- **Stills (quickshot, the wells drawn as edges):**
  - `g3_wells_born_*`: as born, the mains' two wells overlapping under the belly, the nose's forward, red;
  - `g3_wells_widetrack_*`: a 3.2 m track, stowed, the wells under the wing roots.

## G4 - the wells cut into the fuselage (2026-11-04)

- **The outline row** `gearWellCut`: exact (the swept unit's plan hull, the default) or box (a rounded rectangle, the
  fallback). The knife cut is exact either way.
- **Headless** (the T-tail tourer as born, stowed): two cuts, the mains' merged one and the nose's. One closed loop
  each (64 and 34 points), a flat ceiling, vertical walls (section `wheelWell`), and 477 interior faces (frames,
  liners, bulkheads) carved out of the wells. About 100 ms in node. The box option holds the exact hull and cuts as
  cleanly. A 3.2 m track cuts the nose alone (its mains stow in the wing: G5). A 0.6 fraction and a fixed gear cut
  nothing.
- **In the editor** (index.html, the phone-profile garage under SwiftShader, Playwright, the imported retract build):
  - the drawn fuselage wears both cuts (one mesh with `wheelWell`), 74-170 ms a cut on this box;
  - the box option swaps in (20-point outlines) and back;
  - with the capture's hold on, the eye sheet stands and wears the wells;
  - the roll-out snapshot carries a `wheelWell` material (the flown visual has the wells);
  - no page error.
- **GATE RETRACT:** §13 added; the run's result is recorded below when it ends.
- **Stills (quickshot, stowed, the reserved boxes off):**
  - `g4_born_exact_qb.png`, `g4_born_exact_bottom.png`: as born, the exact outline;
  - `g4_born_box_qb.png`: as born, the box outline;
  - `g4_widetrack_nose_bottom.png`: a 3.2 m track, the nose well alone (the mains hang under the wing until G5).
- **Known, next:** on a low wing the wing layer's centre section still crosses a mains well (G5 cuts the wing); the
  doors are G6's; CLIP's sweep of the travel can come now for the body.
