# SEATS — status (cloud session, 2026-11-02)

## Done (STEP 1 + STEP 2: models and studio renders, for the user's validation)
- `docs/SEATS-REFERENCES.md`: what each seat is modelled on, dimensions, materials, mass (published vs *est.*).
- `tools/_seat_gen.js` (new, MANIFEST.editor before `_cage_crew.js`): the seat library. 16 presets on `seatType` 3–16;
  0 / 1 / 2 are untouched. One primitive (`slab`: a rounded box on a side-profile spine with crown, wings, pleats),
  plus skins (inserts laid on a cushion's own surface, tucked into a seam channel), piping through the slab's own edge
  rounding, pads built ON their shell (the underside follows the shell, the top stays flat), filleted tubes (GEAR_KIT).
- `tools/_cage_crew.js`: `buildSeat` hands seatType >= 3 to SEAT_GEN (same interface); `paxSeatType` (new row, absent /
  -1 = the pilots' type) dresses passenger seats separately; `window.CAGE_CREW_SEAT` exports the builder for the bench.
- User asks this session, all done: belts dropped from every preset; the UL's back brace dropped; the base seat
  reworked as a Cub seat (preset 10, proposed to replace type 0 once validated); ag, WWI wicker, glider, bush jump seat,
  warbird bucket, Beaver added (its passenger bench modelled, then dropped); the glider tub on four small tubes;
  cushions flat-topped; the levels of detail by regeneration.
- Finishes: every preset's materials are the finish system's, and its main materials go through the editor's livery
  resolver (`seatTrim` upholstery, `seatFrame`, `seatAccent`); the preset's look is the bottom-out, a pick overrides.
- The bench: `tools/_seats.html` (open with `?seat=N`, drag to orbit) and `tools/seat_shot.js` (headless, ~10 s for
  the whole sheet on SwiftShader).

## Renders
- `seats_sheet.jpg`: all seats, 3/4 over side (today's tube and composite shell beside the new ones).
- `seats_lod.jpg`: every preset at its three levels (hero / mid / phone), the same eye and framing.
- `close/seat_<key>_q.jpg` / `_back.jpg`: each seat front-3/4 and from behind (the hero level).
- In-cabin shots: NOT YET (the user, 2 Nov: "keep modeling and looking at the sheet first, before you do expensive
  screenshots"). A scratch rig view `seat:<az>/<el>/<dist>` (frame the seats part, orbit) is ready for them.

## Levels of detail (by REGENERATION, not decimation - the user, 2 Nov)
The same generator at a level: 0 hero, 1 mid, 2 phone. Every primitive reads it (lattice rows, tube sides, edge and
revolve segments scale by k = 1 / 0.45 / 0.14; paths thin to a 15 / 35 mm step, corners kept); small features step off
(mid: stitching, rail holes, rivets, bolts, lacing, buttons, domed tube ends; phone: piping, lugs, bindings, turned
parts under 16 mm radius, grooves, shell rim beads; the wicker's cane strands become one woven sheet). An insert lifts
clear of its base where the base's facets would cut it. ONE level per seat build (not a THREE.LOD: the join flattens
the crew layer, and a parked aeroplane already drops the interior past its first rung): the phone profile builds the
phone level, everything else the hero; `?seatlod=0|1|2`, `P.seatLod` or `SEAT_GEN.force` override. Generation is fast
enough that nothing is cached: 7-80 ms a seat at hero, 1-4 ms at phone (node, this box).

| preset | kg | hero tris / draws | mid | phone |
|---|---|---|---|---|
| Cub (reworked base) | 3.5 | 19 012 / 7 | 4 256 / 5 | 908 / 4 |
| Carbon bucket | 4.5 | 23 264 / 6 | 5 212 / 4 | 956 / 4 |
| Cessna 172 | 14 | 31 308 / 9 | 6 512 / 9 | 1 250 / 6 |
| ICON A5 | 9 | 31 952 / 7 | 6 732 / 5 | 1 028 / 5 |
| Bonanza | 18 | 28 120 / 6 | 5 808 / 5 | 936 / 4 |
| Ultralight (A22) | 3.5 | 12 816 / 6 | 2 640 / 4 | 766 / 4 |
| Extra 330 | 6 | 21 218 / 6 | 5 164 / 5 | 728 / 5 |
| DC-3 pilots | 20 | 29 952 / 7 | 6 812 / 6 | 1 028 / 5 |
| DC-3 passengers | 18 | 28 136 / 6 | 6 544 / 6 | 1 320 / 5 |
| Agricultural | 16 | 41 796 / 7 | 7 820 / 7 | 1 228 / 5 |
| WWI wicker | 3 | 44 330 / 6 | 11 684 / 5 | 1 272 / 4 |
| Glider tub | 3 | 21 672 / 7 | 5 744 / 7 | 988 / 6 |
| Bush jump seat | 2.5 | 8 544 / 6 | 2 692 / 6 | 640 / 4 |
| Warbird bucket | 8 | 22 680 / 8 | 5 480 / 7 | 792 / 5 |
| Beaver | 12 | 21 684 / 7 | 4 704 / 6 | 1 012 / 5 |
| (today) Tube frame | 3.0 | 4 184 / 59 | — | — |
| (today) Composite shell | 7.0 | 2 252 / 4 | — | — |

Phone: 640-1 320 triangles, 4-6 draws a seat (a four-seat C172 ~5k, 24 draws). Above the 400-800 first guess; it can go
lower (fewer cushion rows, no frame on the far side) if the S20 says so. The Beaver's passenger bench was dropped (the
user, 2 Nov); a cabin takes any preset through `paxSeatType`.

## Identity (existing builds bit-identical)
- `tools/flight_core.js` unchanged (the seats are editor-layer only): mass, CG, cert untouched.
- The crew's seat geometry hashed old (HEAD) vs new `_cage_crew.js` for the validated Cub, Jodel and C172 stances,
  pilot and passenger, and types 0/1/2: identical (sha256 68fc618b…, c72df9a4…, 04e25170…; f4ce9729…, d55b5233…,
  b0e4ce08…). No saved build carries seatType >= 3 or paxSeatType.
- NOT wired yet: the design-row options, GEN_SEATS mass rows, the `seatFrame` / `seatAccent` finish rows (STEP 3,
  after the verdict).

## Gates
On the first commit's tree (8ea4d126 + its build): PARTS, DESIGN, SAVE, JOIN, CAGEFIT, PILOTS, UISMOKE, UISMOKE-PHONE,
SKINMAT, CABIN, DMGOCCUPANT, STARTER, FRAMES, DASH, PANEL - PASS. CLIP and NODUMMY - FAIL, both STANDING: the same
two fail identically on a clean origin/master worktree (CLIP: stock+ifr's navAerial 9.2 mm into the fin skin, the
access layer; NODUMMY: retired-figure references in _crew_head_probe.js, newshapes_build.js, quickshot.js). Neither
reads the seat files.

## Rig handbrake (A0's note)
The cockpit shot came from the repo's own `tools/plane_shot.js`: the built `index.html` of this branch (master
0fcf54ef + the seat module, which does not touch the brake), the build brought in through the game's own Import door,
the editor's full post chain - no layer skipped, no old site. The brake knob is placed by `_cage_crew.js`
`buildBrakeKnob`: 30 mm under `A.dashBotAt(x, 0.06, zB±0.03)`, falling back to `A.dashLip`; its own comment records
that a too-narrow vertex net once "hung the knob at the ASI's height". So the box on the panel face is most likely the
GAME's `dashBotAt` picking a panel vertex on that Cub, not the rig - for CABIN-CRAFT to confirm on the game side.

## Needed from the user
1. Verdict on the sheet and the LOD sheet (which presets, any reshaping, is the phone level good enough).
2. Replace type 0 with the Cub seat and type 1 with the carbon bucket? (Changes every saved build that uses them.)
3. Then the wiring (STEP 3): the Interior-style options and the `paxSeatType` row in the editor, the GEN_SEATS mass
   rows (each preset's kg into the build, the bench and the cert), the seatFrame / seatAccent finish rows, and the
   in-cabin shots.
