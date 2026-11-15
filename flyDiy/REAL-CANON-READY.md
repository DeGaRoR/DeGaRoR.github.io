# REAL-CANON — ready (15 Nov 2026, REAL-FIGURES)

claude/ready/real-canon (= claude/real-canon = claude/tail-retract-canon), ON MASTER L40c 58c681347 for L40d: L40c, then
ALL of ELEC-SYSTEMS (claude/ready/elec-systems = elec-systems-eol e0ec0363b merged first, so its whole history is an
ancestor: L40d can take elec-systems-eol out), then the stack (9b73e74ed, built on L40a). No built files against master:
the train builds them. PHYSICS_V 9 (9 = PHYS-SCALE + ELEC-SYSTEMS, both history lines in 60_gen_spec).

## The layers

1. PHYS-SCALE: DRAG-SCALE, MASS-SCALE's gear ceiling, BIPLANE-SIZING (the user's approved REAL-FIGURES physics).
2. STRUT-OPTIONS: the lift strut's section (profiled / round tube) and the jury strut; absent rows neutral.
3. RUCKUS pieces: NOSE-DECK, the rod boom's profile in the join, the two Ruckus cards (plane_lists rows 53, 54).
4. PETREL-LS: the Super Petrel V4.2 (the maker's LS drawings), list:41 -> V4_2. Its drawn-tail rules are LATENT
   (layer 8).
5. THE CANON: the adopted cards' content (chinook, tigermoth, camel: systems.fit minimal; the DC-3), jodel_geo, the
   plane lists, candidates/index.json, real_refs (the canon PLANES, the Petrel's LS references), REALBAND.
6. TAIL-RETRACT: a taildragger's mains retract, its tailwheel stays down (the DC-3).
7. PETREL-FRAME: two mechanisms in the Super Petrel's lattice closed (the cabane's free node, the tip floats' roll):
   the certificate's 1e8 N rows down to ~1e4 N. V4.2's load test: first yield 5.53 g, broken 6.95 g.
8. TAIL-LATENT (A0, 13 Nov): PETREL-LS's FIN-TAPER (the 25 % / 75 % chords read as a straight planform, floor 0.15,
   the post gap's 0.05) and FIN-MOUNT (a raised stab hung on the fin, a swept fin root tied to the bay under it) only
   on a card with the row tailDrawn (the Super Petrel V4.2 and V4.1). Every other card's tail is as before PETREL-LS.
   The fleet-wide reading is the user's call, with pictures (the formula is the faithful one for the drawn chords).
- ELEC-SYSTEMS: all of it (e0ec0363b, the ready's LINEUP fix and HANDOVER bytes included).
- GATE STOL: preStol drops the core's neutral rows (GEN_BRAKES' brkHold: 0 read as DIFFERS).
- The certificate key: one key in the page and in node (the spec's numbers at 12 digits); DMGCERTCOST floats budget
  1795 -> 1797.

## Merged onto L40a

62_gen_aero: DRAG-SCALE's radialCowlK / genReK and ENGINE-COOLING's model both kept (a measured cowl's momentum drag
replaces the per-kW figure; radialCowlK sets an unmeasured radial's). Exports: the union. The cowl's ABSENT table:
key by key. HANDOVER: master's file with the stack's entries appended. STOL's fixture re-captured, REALBAND re-written
(the DC-3: ENGINE-COOLING 4).

## Onto L40c (Sun 15 Nov, A0's request)

Merge commits 426a84dc7 (ELEC-SYSTEMS onto 58c681347) and 9f77ac48f (the stack), every conflict a union - both sides'
features kept:
- TAIL-RETRACT x the ultralight monowheel (30_solver, 60_gen_spec, 62_gen_aero, _cage_join, _cage_gear): a retract on
  a tricycle, a taildragger (its mains; `tail`) or the ultralight monowheel (`fixedTw`); either keeps the tail wheel down.
- STRUT-OPTIONS x the Archaeopteryx rows (GEN_CAGE_ROW_NEUTRAL, CAGE_DEFAULT_ABSENT, the bracing rows, refs.strutDrag);
  BIPLANE-SIZING's member massK x the rod / hub / ultralight factors; MASS-SCALE's class ceiling x the build-weight
  ceiling; BUSH-WHEELS' carcass law x the bicycle wheel.
- PETREL-LS x the hub: the rod's root-aft / socket rows and the hub's socket (no flange on either); the cabane pylon's
  bpPylonZ / bpPylonLen ported into L40c's cabPylonDraw (_cage_wing) - its centreline caster only when they are set, so
  every other pylon draws as on L40c; quickshot's open frame / crew / tints x --half / --wire / the hub's paint.
- HANDOVER.md: master's bytes + the REAL-CANON entry (the stack's other entries are in L40c already); CR 204913.
- GATE STOL's baseline re-captured on this tree (_stol_samebits --root=this tree), REALBAND re-written with its reason:
  every live plane's figures equal the stack's own on L40a - the merge moved no physics.

## The gates (L40c, Sun 15 Nov)

On this tree (the merge, 9f77ac48f + 123c7b63f): the 249 core gates that are NOT on L40c's 45 standing, 4 jobs,
4 h 39 wall. L40c's 45 standing were not re-run (A0: "name any red not among them"); the ones run earlier on this tree
(GEN, ALTIPORT, DESTTO, FLEX, SHADOWSKY, TAXICLEAR) fail as on L40c. STOL (the fixture re-captured on this tree) PASS.
Every red placed against 58c681347 (the same check run there):

FIXED on this tree (this commit) - TAIL-RETRACT x the ultralight monowheel, a merge interaction (after it: ULTRALIGHT's G,
RETRACT, MONOWHEEL, ENGINELESS, STOL, REALBAND, KNIFE, STORY, WEARTAB, WEARPRICE, LIVERYTEXT green):
- ULTRALIGHT G: the join wrote a retraction for every taildragger, the standard monowheel's included (clampSpec drops it
  there, the gate reads the join's spec), and the frame billed the taildragger's powered kit (12 kg at the least) ON TOP
  of the ultralight's own 0.6 kg (+16.54 kg). Now: _cage_join retracts a taildragger's mains only on two wheels
  (`taildragger && !mono`); 61_gen_frame's TAIL-RETRACT kit skips the ultralight monowheel (`!GUL`). ULTRALIGHT's G green (the LS4, the one build with a retracting ultralight monowheel, billed
  its own 0.6 kg kit again).
RED, the stack's, with its cause:
- NACELLE B (high wing, parasol) and ULTRALIGHT B (the pod) / D (the mast), ONE cause - the Archaeopteryx (master's card,
  newer than the piece): RUCKUS's "the join measures a ROD boom's body profile" (f9818c3b2, from 7741c3a73; on a rod the
  profile block never ran and a build kept an earlier join's profile). The Archaeopteryx now flies its own drawn pod: the
  keel rises aft of it (the S3 ring 0.94 m over the datum; L40c 0.19), empty 80.4 -> 79.6 kg, the carbon pod 24.5 ->
  17.8 kg. The gates were pinned on the stale profile:
  - NACELLE B: the mast's aft foot (1.756 m) sits ON the new keel line (0.069 m, the line 0.071 m); the gate compares it
    to the lowest keel within 0.7 m (-0.020 m): 0.089 > 0.08 (a flat-keel assumption);
  - ULTRALIGHT B: the soft shell 3.8 kg against the carbon's 17.8 (0.21, the bound 0.2; L40c 4.4 / 24.5 = 0.18);
  - ULTRALIGHT D: off the mast the wing sinks 3.4 cm against 1.4 on it (the bound: 3 cm more; L40c 6.4 / 0.8).
  A physics change on a card that is not the stack's: the user's call through A0. Either the profile stays (the
  Archaeopteryx's three checks re-pinned by their owner, NACELLE's foot read on the interpolated keel) or the stack keeps
  the stale-profile behaviour for that card. Not changed here.
- BENCH: builds/rufus_2026-10-18_certified.json stamped PHYSICS_V 7, the stack is 9 (the Rufus file is not touched).
- PARKED (over its wall; FRAMECOST is on the standing list): the parked cook is keyed to the build id - re-cook
  (tools/parked_cook.js, a GPU) after L40d's build.
RED, the base's own (on L40a's list; the same failing checks): CREWLOAD (the retry clock), DMGLOOK (the cub / metal
plans), HOUSEWORKER (1800 s timeout), LAZY (route_draw's first fetch), SCENERYED.
TIMING under the battery's load (4 jobs on 4 cores): BENCHTIME (6.0-8.3 s against 6 s; green run alone on Sat's tip),
BIPLANE (a biplane's build 3.58x the stock, the bound 3x) and DUST (p99 over 1 ms a frame): both GREEN run alone on this commit's tree.
Re-pinned on the line for the stack's deliberate physics (PHYSICS_V 9), each reason in its gate: WINGSPLIT, ENERGYBASE
(carbon at master's), PROCURE, FREIGHT, JOINPARITY's page fixture (two rows), STOL's fixture, REALBAND.

OPEN for A0: the Archaeopteryx's profile (NACELLE B, ULTRALIGHT B / D, above: the user's call); CANDIDATES +2 (FIT-PROCEDURE / FLAGSHIP, A0's note); DMGINTEGRITY's
knife edge and DMGGEAR's V4.1 FIN-MOUNT tie (standing, rulings as before); BENCH's Rufus stamp; the parked re-cook
(GPU) after L40d's build. Brakes (GEN-BRAKES) in their own ready.
