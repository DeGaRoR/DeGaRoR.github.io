# REAL-CANON — ready (14 Nov 2026, REAL-FIGURES)

Branch claude/real-canon (= claude/tail-retract-canon), onto master L40a 6a8d705c4 (merged at 11f911497). For L40c,
merged first. PHYSICS_V 9 (8 never reached master; 9 = PHYS-SCALE + ELEC-SYSTEMS, both history lines in 60_gen_spec).

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
- ELEC-SYSTEMS merged (claude/elec-systems 0c3c1bd24).
- GATE STOL: preStol drops the core's neutral rows (GEN_BRAKES' brkHold: 0 read as DIFFERS).
- The certificate key: one key in the page and in node (the spec's numbers at 12 digits); DMGCERTCOST floats budget
  1795 -> 1797.

## Merged onto L40a

62_gen_aero: DRAG-SCALE's radialCowlK / genReK and ENGINE-COOLING's model both kept (a measured cowl's momentum drag
replaces the per-kW figure; radialCowlK sets an unmeasured radial's). Exports: the union. The cowl's ABSENT table:
key by key. HANDOVER: master's file with the stack's entries appended. STOL's fixture re-captured, REALBAND re-written
(the DC-3: ENGINE-COOLING 4).

## The gates

The core battery on c03a6fc34: 100 of 316 gates when the session's credits ran out (Sat); resumed, still running.
Red there, each placed (the base: master 6a8d705c4 + claude/l40a-repin's fixture re-pins, or 23ce68c1f):
- the base's own: ALTIPORT, DESTTO (career cub@w3), FLIGHTREC, GEN (cruise quiet in wind), RADIALDIV, DMGINST (the
  twin-boom fixture), DMGCERT (the Cessna floats; the Super Petrel V4.1's breaking point), DMGCLUSTERS (the Cessnas'
  fin twist), DMGINTEGRITY (the V4.1's fuselage cut);
- ELEC-SYSTEMS's two (identical on claude/elec-systems 0c3c1bd24 alone), both flip at its cable-run harness 614822358
  (the user's ruling "cable runs live": the Cub card +1.61 kg, the metal Cessna +1.85 kg, the CG ~1-1.5 mm forward):
  - LINEUP jolene w4: the cause is the GATE's. The stand's rest height was read at 3 s, inside the gear's settling
    (1.176 m at 3 s, 1.123 from 6 s on; the roll began at 1.124: already 5.2 of its 6 cm before ELEC); the harness moved
    the 3 s sample to 1.200. Fixed in _lineup_check.js (f5805a35c): settled - 3 s at least, then until the CG's height
    holds to 1 mm over 0.5 s. GATE LINEUP green.
  - DMGINTEGRITY, the metal Cessna's engine through the firewall WITH the limiters: a knife edge, not ELEC's bug. Swept
    round the gate's case (V 49-51 m/s, sink 9.8-10.2): BEFORE the harness the engine already went through in 5 of 7
    (0.08-0.38 m; only 50/10 and 49/10 held); on the stack 6 of 7. The harness moved which point holds. The limiters do
    not reliably hold the metal Cessna's engine in this crash - the damage owners' finding, left RED here (not
    quarantined): A0's ruling.;
- timed out under load (1800 s): TREECRASH (master's: in 6a8d705c4's baseline); DMGCERTCOST over its 70 s by load (72.6 s).
- DMGGEAR: being placed against the base.
Green after layer 8 (they were PETREL-LS's): STOL (the Highlander), DMGCERT / DMGCLUSTERS (the twin floatplane),
DMGCERT (the V4.1's flown pull). STOL, REALBAND, REALREFS, PLANELISTS green on the merged tree.
