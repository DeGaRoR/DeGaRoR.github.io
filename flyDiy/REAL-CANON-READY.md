# REAL-CANON — ready (15 Nov 2026, REAL-FIGURES)

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

The full core battery, 316 gates, on 0125dbfe1 (Sat-Sun, 4 jobs, under load). Every red placed against the base
(master 6a8d705c4 + claude/l40a-repin's fixture re-pins, c7020a536), the same check run there.

FIXED on the stack (green on the tip):
- LINEUP (the gate read the stand mid-settle: f5805a35c), STRUTOPT (the body row less ENGINE-COOLING's measured cool,
  7e4c2a000), PARTS (tailDrawn on the tightening panel's row list), ENGINEDIALS (the DC-3's pitch 'cs' -> 'standard',
  the physics already flew standard, 439fdcf2c), DMGDETERMINISM's 24th stray (62_gen_aero's skin-friction pow on
  CORE_MATH, 6cc3cf71a; the 23 others and the Chromium/node hashes are the base's).
RE-PINNED for the stack's deliberate physics (PHYSICS_V 9), the reason in each gate file:
- WINGSPLIT (baefc9247): ELEC-SYSTEMS' harness moves the CG, the drawn wing translates by +1.101 / -0.451 / 0 mm in the
  CG frame; only the "p" and hinge digests moved.
- ENERGYBASE (8929eb23e): the harness, +0.58 to +0.93 kg on 13 Cub cases (the flip measured at 614822358^ / 614822358).
  The carbon case is left at master's numbers: its -48 kg is master's own red (L40a's list).
- PROCURE (8929eb23e): twelve option effects re-emitted (PHYS-SCALE's take-off deltas, the tundra tyres 7 -> 3 kg; the
  harness on the avionics fits). Green on the base, green on the tip.
- FREIGHT (87eb7e466): the five freight cards' mass blocks (+0.7 to +1.6 kg, the harness); holds, seats, doors the
  same bytes. CARDS, CONTRACTS, CREWSEATS, LOADS, MISSIONS, SAVE, SIMWORKER green after.
- JOINPARITY (68a4346da): the page fixture re-captured for two rows only (--only): the twin floatplane 477.615 -> 474.525
  kg (the stack's masses; the float station 1.2333 -> 1.2194 with it), the V4.1 831 -> 845 bars (TAIL-LATENT's FIN-MOUNT
  on its tailDrawn row). Left red, the base's own: the Jodel mass, the tool census line.
RED, the base's own (the same failing checks on the base; most on L40a's STANDING list): ALTIPORT, CANDIDATES
(pc6_drafting), CREWLOAD, DESIGNCHECK, DESTTO, DMGCERT, DMGCLUSTERS, DMGDAMP, DMGFABRIC, DMGINST, DMGLOOK, DMGPOD,
DMGSCAR, DMGTYRE, DMGWALL, ENERGYBASE (carbon), ENGCONFIG, ENGINE, ENGTORQUE, FLEX, FLIGHTREC, FLOATLETTERS, GEN,
HOUSEWORKER, LAZY, LIVERY, LOAD, NAMES, NODUMMY, POD, RADIALDIV, ROUNDTRIP, SCENERYED, SHADOWSKY, DMGDETERMINISM (23).
RED, the stack's, each with its cause:
- CANDIDATES +2: THE CANON's one row per plane (the user, 10 Nov) took superpetrel_V4_1.json out of the pool for V4.2
  (the file stays: the damage gates fly the V4.1), and jodel_geo.json waits for FLAGSHIP's list:2 re-point (L40c). A0:
  list them, or the gate learns a "fixture, not offered" row.
- DMGINTEGRITY (the metal Cessna's engine through the firewall with the limiters): a knife edge, not ELEC's bug - swept
  round the gate's case, the engine went through in 5 of 7 points before the harness, 6 of 7 after. A0's ruling.
- DMGGEAR: base-or-not, stated: the twin floatplane's touchdowns and the V4.1's float dig-in / nose-in are the base's;
  NEW is the V4.1's FIN-MOUNT swept-root tie at touchdown (0.67 / 0.68 at 1.0 / 1.5 m/s, 1.03 at the FAR 23.473 sink;
  the base 0.40 / 0.50 / 0.31). It comes with tailDrawn on the V4.1 (1e0957ae1), which cleared its DMGCERT pull (1.21
  without). One of the two stands either way: PETREL-LS's owner / A0 to rule.
- FRAMECOST (+19 items: the parked draws 0 -> 123 at the stand, 193 taxiing) and PARKED (over its wall): the parked
  cook src/core/parked_packs.json is keyed to the build id, so any core change makes it stale and the page captures
  the four parked planes live. Re-cook (tools/parked_cook.js, needs a GPU) after L40d's build.
- BENCH: builds/rufus_2026-10-18_certified.json is stamped PHYSICS_V 7 and the stack is 9; the Rufus file is not to be
  touched. The user's / A0's call (re-certify, or the gate reads the stamp's era).
TIMING under the battery's load, GREEN run alone on the tip (Sun): HITBOX, PREMISES, BENCHTIME, DMGCERTCOST, DMGUPLOAD,
SETTLE. BENCH's timing lines ride with its Rufus stamp red. TREECRASH's timeout is master's (6a8d705c4's baseline).

OPEN for A0: CANDIDATES' two files; DMGINTEGRITY's knife edge; the V4.1's FIN-MOUNT tie (DMGGEAR) vs its DMGCERT pull;
BENCH's Rufus stamp; the parked re-cook (GPU) after L40d's build. Brakes (GEN-BRAKES) come in their own ready next round.
