# SEATS — status (cloud session, 2026-11-02)

## Where it stands
STEP 1 (references), STEP 2 (models, studio renders, the user's validation: "all looks good") and STEP 3 (levels of
detail, the wiring) are done. The user's calls on 2 Nov, all applied: belts dropped; the UL's back brace dropped; the
base seat reworked as the Cub's; ag, WWI, glider, bush, warbird and Beaver seats added (the Beaver's bench then
dropped); cushions flat-topped; LOD by regeneration, not decimation; the tube frame, the composite shell AND the
airliner seat REPLACED by the Tube & sling, the Carbon bucket and the Vintage airliner; names by spirit, not by
aeroplane; base / accent / seam colours.

## The seats (cage.seatType; docs/SEATS-REFERENCES.md for what each is modelled on)
| # | name | kg | hero tris / draws | mid | phone |
|---|---|---|---|---|---|
| 0 | Tube & sling | 3.0 | 19 012 / 7 | 4 256 / 5 | 908 / 4 |
| 1 | Carbon bucket | 4.5 | 23 264 / 6 | 5 212 / 4 | 956 / 4 |
| 2 | Vintage airliner | 18 | 28 136 / 6 | 6 544 / 6 | 1 320 / 5 |
| 3 | Touring | 14 | 31 308 / 9 | 6 512 / 9 | 1 250 / 6 |
| 4 | Sculpted sport | 9 | 31 952 / 7 | 6 732 / 5 | 1 028 / 5 |
| 5 | Executive leather | 18 | 28 120 / 6 | 5 808 / 5 | 936 / 4 |
| 6 | Ultralight sling | 3.5 | 12 816 / 6 | 2 640 / 4 | 766 / 4 |
| 7 | Aerobatic recline | 6 | 21 218 / 6 | 5 164 / 5 | 728 / 5 |
| 8 | Vintage crew | 20 | 29 952 / 7 | 6 812 / 6 | 1 028 / 5 |
| 9 | Heavy-duty work | 16 | 41 796 / 7 | 7 820 / 7 | 1 228 / 5 |
| 10 | Woven cane | 3 | 44 330 / 6 | 11 684 / 5 | 1 272 / 4 |
| 11 | Reclined tub | 3 | 21 672 / 7 | 5 744 / 7 | 988 / 6 |
| 12 | Folding canvas | 2.5 | 8 544 / 6 | 2 692 / 6 | 640 / 4 |
| 13 | Parachute bucket | 8 | 22 680 / 8 | 5 480 / 7 | 792 / 5 |
| 14 | Bush utility | 12 | 21 684 / 7 | 4 704 / 6 | 1 012 / 5 |

The phone profile builds the phone level (640-1 320 tris, 4-6 draws a seat; a four-seat cabin ~5k tris, ~24 draws),
everything else the hero; `?seatlod=0|1|2` forces one. 1-4 ms to generate a phone seat, 7-80 ms a hero: nothing cached.

## The wiring (what changed for a saved build)
- DRAWN: every seat is the library's. A saved build on type 0 / 1 / 2 now draws the Tube & sling / Carbon bucket /
  Vintage airliner (the user's call), at its own stance rows (checked at the Cub, Jodel and C172 stances).
- MASS: a Tube & sling seat bills 3.0 kg, the `sling` row every saved build already bills, so a build on type 0 keeps
  its spec, its mass, its CG and its certificate (the join writes `cabin.seatsKg` only when a seat weighs other than the
  row). A build on another type bills each seat as drawn (its weight & balance group then asks for re-certification -
  honest: the seats changed).
- ROWS: the Interior style tiles (15, with their own recline/tilt as the seed), the panel's seat type (0-14), and the
  cabin's own seat type (`paxSeatType`, passenger seats folder; absent = as the pilots').
- FINISH: four livery sections on the Seats part - the seats' base (`seatTrim`, as before), accent, seams, frames; with
  nothing picked each seat wears its calibrated look.
- CODE: `tools/_seat_gen.js` (library), `_cage_crew.js` (the three old builders and their helpers removed; buildSeat is
  the door; seatsAt carries kg), `_cage_join.js` (cabin.seatsKg), `src/core/60_gen_spec.js` (GEN_SEATS rows,
  GEN_SEAT_TYPES, seatsKg normalised), `61_gen_frame.js` (seat-by-seat billing), `76_procure.js` (seatsKg trimmed with
  seatsX), `_cage_design.js` / `_cage_page5.js` / `_cage_parts.js` / `design_flow.js` (rows), `aeroskin.js` (sections),
  `test_skinmat.js` (its crew-section list), `_cage8.html` / `_bake_joined.js` (load the library), GATE SEATS (new).

## Landing (A0: for train L30c, 3 Nov 19:00)
- ON origin/master a8a23ad62 (train L30a, after PHONE-1b and CABIN-CRAFT 3) by a MERGE, not a rebase: claude/ready/seats
  already carried the 1B rebase, and a merge keeps its update a plain fast-forward (no forced push). Conflicts: the
  built files (master's taken, then rebuilt) and HANDOVER's end (both entries kept). Pushed as claude/ready/seats.
- Earlier the same day: rebased onto 1db22c8a (train 1B). claude/seats still holds the pre-rebase history of 2 Nov
  (overwriting it needs a forced push, not done); nothing reads it, A0 may delete it.
- S2: no seatLod row on the panel - the profile decides (?seatlod= stays a test override).
- The four seat finish sections keep their names for CABIN-CRAFT's interior: seatTrim (base), seatAccent, seatSeam,
  seatFrame.

## Gates (on the merged tree, a8a23ad62 + SEATS, built)
A0's set, ALL PASS: SEATS GEN WEIGHT BUILD JOIN SAVE PARTS DESIGN STARTER PROCURE PILOTS CAGEFIT CABIN FRAMES
DMGOCCUPANT SKINMAT UISMOKE UISMOKE-PHONE TANKMOUNT PANEL DASH - no red, so nothing to name against master.
(Outside that set, on the 2 Nov tree: JOINPARITY, LIVERY, CLIP and NODUMMY were red identically on a clean master.)

## FRAMECOST (A0 17:35 / 17:40: "22 red rows against master's 5 ... the Cub's draws 914 -> 1063, links 5 -> 42")
MEASURED (tools/_framecost_check.js --census cub, master a8a23ad62 vs this branch, --compare):
- ALL OF THE FRAME ROWS ARE THE PARKED AEROPLANES, NOT THE SEATS. detail.stand: every family equal except `parked`,
  5 -> 357 draws (shadow 5 -> 302; taxi 5 -> 153). The flown Cub is identical: 79 draws, 15 programs, 66 materials.
  Cause: the parked cook (media/parked, src/core/parked_packs.json) is signed with the build id, so ANY source change
  leaves it stale (`node tools/parked_cook.js --check`: manifest 604798b36690, this tree 31a9cc2f3768 - STALE; master:
  same) and every parked aeroplane is captured live, its buckets drawn. PROOF: with the cook off on BOTH trees
  (FRAMECOST_QUERY=parkcook=0) the stand and taxi counts are equal to the digit (draws.main 1063 / 1063, shadow 235.5 /
  235.5, programs 103.5 / 103.5, uniform bytes 698102 / 698102, uniform4f 541 / 541). THE FIX IS THE TRAIN'S RE-COOK on
  the GPU box after its build (parked_cook.js refuses SwiftShader, so it cannot run here) - as L30a re-cooked for its own.
- THE SEATS' OWN COST is at boot, in the garage: +8 draws (garage:craft 627 -> 635), ~+12 MB of buffer uploads across
  garage:spec / bake / firstFrame (the hero seats' geometry); updateMatrixWorld DOWN (fewer objects than the old seats).
  FIX (claude/ready/seats-cost): the game builds the MID level by default (the same shapes at a fifth of the triangles;
  the hero is the seat studio's and ?seatlod=0's). MEASURED (the Cub, the cook off on both trees, master a8a23ad62 vs
  claude/ready/seats-cost): NO red row - stand and taxi equal to the digit, the flown Cub equal (79 draws, 15 programs),
  and every boot row that moved went DOWN (garage:firstFrame draws 4977 -> 4221, uniform bytes 714 356 -> 609 036;
  garage:landing draws 14 931 -> 12 663; updateMatrixWorld down in every step). The +8 garage draws and the ~12 MB of
  uploads are gone. With the train's re-cook, FRAMECOST on master + seats-cost should read master's own 5 rows.
- GATES on claude/ready/seats-cost: SEATS JOIN CABIN CAGEFIT SKINMAT DESIGN PARTS SAVE UISMOKE UISMOKE-PHONE
  DMGOCCUPANT WEIGHT - all PASS. (FRAMECOST itself reads red here until the re-cook - the stale cook, above.)
- A0 could not be messaged from this cloud session (the cross-session send needs the owner's trust grant); this file is
  the report, as the first brief said.
- NOT DONE, the user's call: collapsing every seat to its four section materials (chrome levers, rubber rollers, cast
  brackets into the frame colour) - it changes the approved look and the measurement says it buys nothing in flight.

## Renders
- `seats_sheet.jpg`: all 15, 3/4 over side. `seats_lod.jpg`: each at hero / mid / phone.
- `close/`: each seat front-3/4 and from behind (hero; taken before the renumbering, file names by the old keys).
- In-cabin shots: OWED (after the landing). What the rig work found, for the follow-up (a scratch copy of
  tools/plane_shot.js with a `seat:<az>/<el>/<dist>` view, not committed):
  - the cut works: `FLIGHT_PROBE.renderer().localClippingEnabled = true; REF_MOUNT.setBuildClip([plane])` (the freight
    rig's door) clips the whole build, crew layer included - one shot showed the fuselage cut open, the seats behind;
  - the aim does not yet: in plane_shot's garage the orbit target is the craft's CG unless the editor's sit is shown
    (app.js: `if (edSit.visible) target.copy(edTarget).add(edPan)`), so FLIGHT_PROBE.pan took only on the second view;
    and the eye computed from (az, el) did not match the drawn one - read app.js placeCamera's convention before
    placing the plane, or set the plane from camGet().eye AFTER a pumped frame;
  - the phone profile builds the phone level of detail: add `&seatlod=0` to the page URL for hero seats.

## Rig handbrake (A0's note)
The cockpit shot came from the repo's own `tools/plane_shot.js`: the built `index.html` (master 0fcf54ef + the seat
module, which does not touch the brake), the build brought in through the game's own Import door, the editor's full
post chain - no layer skipped, no old site. The brake knob is placed by `_cage_crew.js` `buildBrakeKnob`: 30 mm under
`A.dashBotAt(x, 0.06, zB±0.03)`, falling back to `A.dashLip`; its own comment records that a too-narrow vertex net once
"hung the knob at the ASI's height". So the box on the panel face is most likely the GAME's `dashBotAt` picking a panel
vertex on that Cub, not the rig - for CABIN-CRAFT to confirm on the game side.

## Open
- The phone level could go lower if the S20 says so (fewer cushion rows; the far-side frame).
- The `seatLod` row is honoured but not on the panel (the profile decides); say if you want it there.
