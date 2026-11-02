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
  warbird bucket, Beaver crew + bench added; the glider tub on four small tubes; cushions flat-topped.
- Finishes: every preset's materials are the finish system's, and its main materials go through the editor's livery
  resolver (`seatTrim` upholstery, `seatFrame`, `seatAccent`); the preset's look is the bottom-out, a pick overrides.
- The bench: `tools/_seats.html` (open with `?seat=N`, drag to orbit) and `tools/seat_shot.js` (headless, ~10 s for
  the whole sheet on SwiftShader).

## Renders
- `seats_sheet.jpg`: all seats, 3/4 over side (today's tube and composite shell beside the new ones).
- `close/seat_<key>_q.jpg` / `_back.jpg`: each seat front-3/4 and from behind.
- In-cabin shots: NOT YET (the user, 2 Nov: "keep modeling and looking at the sheet first, before you do expensive
  screenshots"). A scratch rig view `seat:<az>/<el>/<dist>` (frame the seats part, orbit) is ready for them.

## Triangles / draws per seat (the hi master, drawn live today; the LOD levels are the next step)
| preset | kg | tris | draws |
|---|---|---|---|
| Tube frame (today) | 3.0 | 4 184 | 59 |
| Cub (reworked base) | 3.5 | 19 012 | 7 |
| Composite shell (today) | 7.0 | 2 252 | 4 |
| Carbon bucket | 4.5 | 23 264 | 6 |
| Cessna 172 | 14 | 31 308 | 9 |
| ICON A5 | 9 | 31 952 | 7 |
| Bonanza | 18 | 28 120 | 6 |
| Ultralight (A22) | 3.5 | 12 816 | 6 |
| Extra 330 | 6 | 21 218 | 6 |
| DC-3 pilots | 20 | 29 952 | 7 |
| DC-3 passengers | 18 | 28 136 | 6 |
| Agricultural | 16 | 41 796 | 7 |
| WWI wicker | 3 | 44 330 | 6 |
| Glider tub | 3 | 21 672 | 7 |
| Bush jump seat | 2.5 | 8 544 | 6 |
| Warbird bucket | 8 | 22 680 | 8 |
| Beaver crew | 12 | 21 684 | 7 |
| Beaver bench (per place) | 6 | 16 380 | 6 |

Too heavy for the phone as masters; draws are fine (one bag per material). Next (agreed direction, pending the user's
go): LOD by REGENERATION, not decimation - a detail level on every primitive (lattice rows, tube sides, edge segments)
and per-level feature drops (stitching, rail holes, rivets, lacing, cane strands), three levels (hero / mid / phone
~400-800 tris), mounted as a THREE.LOD; cached through the prop-pack path only if run-time generation is too slow.

## Identity (existing builds bit-identical)
- `tools/flight_core.js` unchanged (the seats are editor-layer only): mass, CG, cert untouched.
- The crew's seat geometry hashed old (HEAD) vs new `_cage_crew.js` for the validated Cub, Jodel and C172 stances,
  pilot and passenger, and types 0/1/2: identical (sha256 68fc618b…, c72df9a4…, 04e25170…; f4ce9729…, d55b5233…,
  b0e4ce08…). No saved build carries seatType >= 3 or paxSeatType.
- NOT wired yet: the design-row options, GEN_SEATS mass rows, the `seatFrame` / `seatAccent` finish rows (STEP 3,
  after the verdict).

## Gates
Run: PARTS, DESIGN, SAVE, JOIN, CAGEFIT, NODUMMY, PILOTS, UISMOKE, UISMOKE-PHONE, SKINMAT, CABIN, CLIP, DMGOCCUPANT,
STARTER, FRAMES, DASH, PANEL - started on this commit's tree; still running at commit time on this box (DMGOCCUPANT
alone > 7 min). Results go into the next STATUS update.

## Rig handbrake (A0's note)
The cockpit shot came from the repo's own `tools/plane_shot.js`: the built `index.html` of this branch (master
0fcf54ef + the seat module, which does not touch the brake), the build brought in through the game's own Import door,
the editor's full post chain - no layer skipped, no old site. The brake knob is placed by `_cage_crew.js`
`buildBrakeKnob`: 30 mm under `A.dashBotAt(x, 0.06, zB±0.03)`, falling back to `A.dashLip`; its own comment records
that a too-narrow vertex net once "hung the knob at the ASI's height". So the box on the panel face is most likely the
GAME's `dashBotAt` picking a panel vertex on that Cub, not the rig - for CABIN-CRAFT to confirm on the game side.

## Needed from the user
1. Verdict on the sheet (which presets, any reshaping).
2. Replace type 0 with the Cub seat and type 1 with the carbon bucket? (Changes every saved build that uses them.)
3. Go on the LOD-by-regeneration step.
