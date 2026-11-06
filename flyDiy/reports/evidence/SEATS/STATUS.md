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

## SEATS-COST: ZERO COST, MEASURED ON POST-L30c MASTER (the user 3 Nov 19:00: "garage + world performance should remain unaffected")
Tree: origin/master e6bcfb368 (train L30c) + the seats (merged), built. What changed for the cost (claude/ready/seats):
- the game builds the MID level (the user: "the second level of detail also look good"); the hero is the seat studio's;
- ONE MATERIAL PER ROLE at the game's levels: at most four a seat (base, accent, seams, frame), the hardware folded into the
  frame's; the default Tube & sling wears three (cushion, piping, frame) - the count of the tube frame it replaced;
- no new shader programs (the materials are the finish system's pooled ones; program links equal below).
FRAMECOST, LIKE FOR LIKE (the parked cook off on BOTH trees, FRAMECOST_QUERY=parkcook=0; `--compare master seats`):
RED rows: cub 0, cessna 0. Verbatim (full files in framecost/):
```
  cub stand (a -> b, what moved)
  cub taxi (a -> b, what moved)
  cub boot (a -> b, what moved)
    boot/garage:compile/three.updateMatrixWorld       16364      15580  down
    boot/garage:landing/three.updateMatrixWorld        3014       2566  down
    boot/garage:parked/three.updateMatrixWorld       116123      93051  down
    boot/garage:recheck/three.updateMatrixWorld       14671      13775  down
    boot/garage:restore/three.updateMatrixWorld         810        698  down
    boot/garage:seed/three.updateMatrixWorld          25262      21118  down
    boot/garage:settle/three.updateMatrixWorld        42888      42328  down
    boot/garage:snapshot/three.updateMatrixWorld      35858      31266  down
    boot/garage:town/three.updateMatrixWorld           4673       4449  down
    boot/garage:world/three.updateMatrixWorld         97331      88707  down
    boot/rollout:click/three.updateMatrixWorld         2442       2106  down
    boot/rollout:craft/bytes.uniforms                809860     798196  down
    boot/rollout:craft/gl.calls                       25284      25007  down
    boot/rollout:landing/three.updateMatrixWorld     129896     128216  down
    boot/rollout:shedWarm/three.updateMatrixWorld      12298      11738  down
    boot/rollout:snapshot/three.updateMatrixWorld       1628       1404  down
    boot/rollout:spec/three.updateMatrixWorld          7618       7058  down
  cub the aeroplane at stand (a -> b)
    craft.stand/draws.main                                0          0  
    craft.stand/draws.other                               0          0  
    craft.stand/draws.shadow                              0          0  
    craft.stand/materials                                 0          0  
    craft.stand/meshes                                  105        105  
    craft.stand/programs                                  0          0  
    craft.stand/skinnedDraws                              0          0  
  cub the aeroplane at taxi (a -> b)
    craft.taxi/draws.main                                 0          0  
    craft.taxi/draws.other                                0          0  
    craft.taxi/draws.shadow                               0          0  
    craft.taxi/materials                                  0          0  
    craft.taxi/meshes                                   105        105  
    craft.taxi/programs                                   0          0  
    craft.taxi/skinnedDraws                               0          0  
  cessna stand (a -> b, what moved)
  cessna taxi (a -> b, what moved)
  cessna boot (a -> b, what moved)
    boot/garage:compile/three.updateMatrixWorld       19759      18191  down
    boot/garage:firstFrame/bytes.uniforms            861264     647140  down
    boot/garage:firstFrame/draws.total                 6170       4602  down
    boot/garage:firstFrame/gl.calls                   67077      49084  down
    boot/garage:firstFrame/three.frustumTests          6938       5370  down
    boot/garage:firstFrame/three.updateMatrixWorld       2927       2703  down
    boot/garage:landing/bytes.uniforms              2556836    1831520  down
    boot/garage:landing/draws.total                   18441      13737  down
    boot/garage:landing/gl.calls                      94499      67560  down
    boot/garage:landing/three.frustumTests            20742      16038  down
    boot/garage:landing/three.updateMatrixWorld       11763      10643  down
    boot/garage:parked/three.updateMatrixWorld       133109     104885  down
    boot/garage:recheck/three.updateMatrixWorld       18721      16929  down
    boot/garage:restore/three.updateMatrixWorld        4677       3781  down
    boot/garage:seed/three.updateMatrixWorld          34486      26422  down
    boot/garage:settle/three.updateMatrixWorld        44678      43558  down
    boot/garage:snapshot/three.updateMatrixWorld      51824      42416  down
    boot/garage:town/three.updateMatrixWorld           7697       6801  down
    boot/garage:trees/three.updateMatrixWorld          2308       1860  down
    boot/garage:world/three.updateMatrixWorld        127365     109669  down
    boot/rollout:click/three.updateMatrixWorld      2492948    2340404  down
  cessna the aeroplane at stand (a -> b)
    craft.stand/draws.main                               89         89  
    craft.stand/draws.other                               0          0  
    craft.stand/draws.shadow                              0          0  
    craft.stand/materials                                70         70  
    craft.stand/meshes                                  120        120  
    craft.stand/programs                                 16         16  
    craft.stand/skinnedDraws                             11         11  
  cessna the aeroplane at taxi (a -> b)
    craft.taxi/draws.main                                89         89  
    craft.taxi/draws.other                                0          0  
    craft.taxi/draws.shadow                               0          0  
    craft.taxi/materials                                 70         70  
    craft.taxi/meshes                                   120        120  
    craft.taxi/programs                                  16         16  
    craft.taxi/skinnedDraws                              11         11  
```
THE GATE ITSELF on this tree (framecost/gate_seats_L30c.txt) reads FAIL (16): the parked aeroplanes captured live because
the cook is STALE for any changed tree - `parked_cook.js --check`: manifest 6051f2c08e4b, this tree 9fed71f0fffe (STALE);
master 6051f2c08e4b (same). The gate's own HINT names it ("a STALE cook captures the parked aeroplanes live ... the train
re-cooks on its final build"). The cook refuses SwiftShader, so it cannot run in this cloud box: the train's re-cook on
the GPU box is what turns those rows back to master's.
GATES on this tree (L30c + seats, built): SEATS GEN WEIGHT BUILD JOIN SAVE PARTS DESIGN STARTER PROCURE PILOTS CAGEFIT
CABIN FRAMES DMGOCCUPANT SKINMAT UISMOKE UISMOKE-PHONE TANKMOUNT PANEL DASH - all PASS.

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
