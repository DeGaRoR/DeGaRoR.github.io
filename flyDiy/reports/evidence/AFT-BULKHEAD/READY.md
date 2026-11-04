# AFT-BULKHEAD-2 READY (CABIN-CRAFT, 4 Nov 2026, for train L31c)

Branch claude/ready/aft-bulkhead-2, on L31b master af8116aa9. Code gated: bc47816ab, build 61908778ed66. On top of it: this note and HANDOVER only.

The user, via A0, 4 Nov ~13:50: "cabin interior and aft bulkhead to land soon, I need that for the screenshot." A0: one branch with the aft-wall fixes, the
Mosquito lamp, cabin-interior and the rows on in 4b. No v3 cloud run (the user away, credits tight). This READY rests on the node drawings, NIGHT-LOOK's frame and L31c's battery.

## What lands

1. **The aft-wall fixes** (2b3bd2a5a; rows nobody but 4b has):
   - the strip no longer sits behind the net: the net drops under the lamp's band (`BH.lampBand`), lower still on small walls (Cub flat strip 29 cm, Cub full 21 cm, Jodel arch 55 cm, twin 47 cm above the net at y .426);
   - the bevel's inner edge and the screw line follow a smoothed outline, not the ring's lumps (`at(p,k)`);
   - relief on the upper panel: a roll narrows to fit its height (2 to 3.4 cm);
   - the Jodel's strip bends under its arch (rise 83 mm), the twin (64) and the Cub (30) run straight (`isArch`, threshold .07).
2. **The Mosquito's stock flood lamp** no longer goes through the deck (y max .166-.171 under a wall top of .176, was .22): the whole flange must fit on the wall, or `bulkheadAt` passes to the next rung. **Numbers only, no picture.**
3. **Cabin interior** claude/ready/cabin-interior 20243a3ed, merged (c515f2903): hdlOn, wallTrimOn, ohConsoleOn, absent at default. HANDOVER section 6.
4. **Rows ON in builds/candidates/Twin_busher_floats_4b.json** (bc47816ab): `hdlOn:1, wallTrimOn:1, ohConsoleOn:1, bhBevel:.05, bhTwoTone:1, bhLamp:2, bhNet:1, bhRelief:1, bhFast:1, lightOn:1, li_pax:1`. bhRelief and bhFast are my addition (A0 OK'd). No cert to lose on 4b (A0).

FLAGSHIP's electrics and bay kept: the base is post-L31b master.

## Mass and draw cost on 4b (the numbers A0 asked for)

Node identity, before | after the rows:

| | before | after |
|---|---|---|
| mass | 820.615 kg | 820.615 kg |
| ledger | 51ed9f0d1f993515 | same |
| price, sheet, design | | same |
| fly20 | 0744b7fd98288dad | same |
| editor meshes | 407 | 417 (+10) |
| verts | 288346 | 289628 (+1282) |
| certKey | 38c9264e | 129d1942 (moves) |
| procure | 42a71e60 | 64a6418a (moves) |

- **Added mass: zero, and that is the model, not the truth.** None of these rows carries weight in the ledger: not the headliner, the panel, the net, the screws or the lamps. A real cabin's would weigh some kilos. Named, not fixed.
- **Flight draw cost: NOT measured on 4b.** FRAMECOST reads the default builds only. Expected by construction: +1 draw each for bulkTrim, baggage, headliner and cabWall; toele +1 where it is not already there; the console none (M.dark); the lamps in the passenger buckets; no new program. The interior's bakes are 512 px detail sheets, kept on the phone's lite tier.

## Gates, on bc47816ab

- Node, 14:53-15:00, 2 jobs: **19 of 21 PASS**. SEATS, DMGWALL, MATLIB, BUILD, SKINMAT, LIVERYREACH, SURF, LIGHT, CABINLAMP, EDBUGS (40 rows, 0 red), FIT, KNIFE, JOIN, SAVE, PARTS, SHOULDER, DESIGN, PANEL, DASH.
- **LIVERY FAIL, CLIP FAIL: the same lines as on master adc53b25b** (run this morning; **not re-run on L31b master**).
  - `cage editor seed: ReferenceError: garageFloodArm is not defined` (its rig)
  - `stock+ifr/rest: navAerial/centre [access, on body body] 9.2 mm INTO edFinSkin (allow 5.5 mm)`
- The 22 probe builds: 0 vertices of bulkhead, bulkTrim or baggage outside the skin. The probe does not test the screw heads.

## Identity and FRAMECOST, A0's slot 17:00, gpu lock CABININT

- Real cook on port 8773, then `parked_cook --check: manifest build 61908778ed66, this tree 61908778ed66 (same); keys arch:c172, arch:chinook, arch:cub, arch:jodel`. Packs restored after.
- **IDENTITY: ALL LINES IDENTICAL (6 lines)** against af8116aa9. The default builds do not move.
- **FRAMECOST: FAIL (5)**, the same 5 rows and the same numbers as plain master adc53b25b this morning. **Not run on af8116aa9 by me**; the interior and the wall are absent on these builds:
  - `cub boot/garage:compile/links rose 5 -> 39`
  - `cub boot/garage:landing/bytes.bufferData rose 0 -> 83912`
  - `cub boot/garage:seed/three.updateMatrixWorld rose 17652 -> 21266`
  - `cessna boot/garage:compile/links rose 5 -> 44`
  - `cessna boot/garage:restore/three.updateMatrixWorld rose 2269 -> 3813`

## The look

**The frame:** NIGHT-LOOK, 17:26, evidence 2026-11-04/night-photo/c3/photo_night_index_gfxgamer_Twin_busher_floats_4b.png (2560x1440, night, 4b at bc47816ab, li_pax 1, bhLamp 2). Copy and a cabin crop: evidence 2026-11-04/aft-bulkhead/night-frame/.

**"Far too black": helped, not solved.** Through the glass the room is no longer a black hole: the strip lamp reads as a white bar, the upper panel and the net read against it, the lower wall and the seat frame are visible. But it is a dim grey room, not a warm glow, and the headliner does not read in this frame. Part of it is the night itself (NIGHT-LOOK's bright stylised night lights the whole scene), and I did not separate the two. One frame, one build, port side only; the screws and the beads do not read at this distance. NIGHT-LOOK is raising the cabin flood's gain in its own cockpit.js dial at 18:00 (3.2 -> 10, then 20), not in these rows; its next frames go under night-photo/d1 and d2 and are not judged here. Warm tan on the headliner is the suggested paint, not applied. No new interior work (A0).

Drawings (node, flat colour, not renders): evidence 2026-11-04/aft-bulkhead/drawings-6/ (twin_beads_screws_net_strip, cub_flat_beads_screws_net_strip, jodel_full_arch_strip_net).

## Unseen, named

- **The Cub sling** (bhSling): still the real FAIL of the first note (seat frame through the canvas, 20.8 cm). Next week.
- **The page-error question** (`_cage_energy.js:1906`, crewTop, CREW_PTS null on twin and C172 pages): A0's nose-job-crew fix is on L31b; I have not seen a page load since it.
- The fixes on a real page: nothing but NIGHT-LOOK's frame, on the twin. The strip over the net, the smoothed bevel and the upper panel's relief are read off node drawings; the Jodel, Cub and Mosquito have no browser picture of them.

## Gaps

- Jodel: with the net on, the strip but no dome (no room for both over the net).
- Cub: the strip is 21-29 cm; the upper panel still has no relief (~.15 m high, the strip and the net use it).
- Twin 4b's cert key moves with the rows (no cert to lose, A0).
- T2 vinyl only: no panel joins. Visors and grab handles not built.
- With the interior on the ceiling reads darker: the flood sits 6 cm lower in the console, the headliner base is 0x9d968a. Warm tan is suggested, not applied.
- Next week: stickers and placards (each picks a place, 17 original designs unrendered), accessories, the Cub sling.

---

# The first ready, landed in L31b (CABIN-CRAFT, 4 Nov 2026)

Branch claude/ready/aft-bulkhead. Code gated: f06d11a89, the merge of claude/aft-bulkhead with post-L31a master adc53b25b.
On top of it: this note + HANDOVER, then the "(built)" commit. A0 11:09: push as it is with the gaps named; the fixes ride L31c.

The user 3 Nov: "Focus on the aft bulkhead really ... integrated lamps, interesting bevels".
The user 4 Nov, on the first drawings: "the panel itself should have more geometry", "fasteners/screws as well", all three
relief patterns as options.

## What lands

New rows on the garage's aft wall group. Every one is absent at default, so a build without them is today's wall.

| row | what |
|---|---|
| bhStep, bhShelfY, bhShelfD | a hat shelf stepping aft: lower wall, shelf, lined recess, upper wall set back |
| bhBevel | the moulded tub, a chamfer round the face |
| bhTwoTone | a light upper panel (new section bulkTrim) |
| bhRelief, bhReliefH | bas-relief, real low geometry: 1 pressed beads, 2 rolled upholstery, 3 framed panel |
| bhFast | fasteners round each face: 1 pan-head screws, 2 dome rivets (bare metal, section toele) |
| bhNet | a low cargo net (new section baggage) |
| bhLamp, bhLampY | 1 dome, 2 LED strip, 3 both, on the passenger dimmer; the strip runs straight, bending only under a true round arch |
| bhSling | tube builds: no wall, a canvas sling on a U of tube |

## Gates, on f06d11a89

- Node, 08:52-09:00, unlocked in A0's window, 2 jobs: 16 of 18 PASS. PARTS, SKINMAT, LIGHT, CABINLAMP, SAVE, DESIGN, JOIN, FIT,
  SURF, EDBUGS (40 rows, 0 red), SHOULDER, PANEL, DASH, LIVERYREACH, DMGWALL, MATLIB.
- **LIVERY FAIL, CLIP FAIL: both red on master adc53b25b as well** (run in the 10:55 slot).
  - CLIP, verbatim, same row: `stock+ifr/rest: navAerial/centre [access, on body body] 9.2 mm INTO edFinSkin (allow 5.5 mm)`.
  - LIVERY, verbatim, same on both: `cage editor seed: ReferenceError: garageFloodArm is not defined` (its rig).
- The 22 probe builds: 0 vertices of bulkhead, bulkTrim or baggage outside the skin. The probe does not test the screw heads.

## Identity and FRAMECOST, A0's slot 10:55, gpu lock CABININT

- Real cook on port 8771, then `parked_cook --check: manifest build e33815284a56, this tree e33815284a56 (same)`. Packs restored after.
- **IDENTITY: ALL LINES IDENTICAL** against adc53b25b (newshapes_identity, every line: spec, def, draw, mass, ledger, sheet).
- **FRAMECOST: FAIL (5), the same 5 rows on plain master adc53b25b** (its own cook, 29a363c631cc (same)). The two logs differ only
  in the reported memory lines:
  - `cub boot/garage:compile/links rose 5 -> 39`
  - `cub boot/garage:landing/bytes.bufferData rose 0 -> 83912`
  - `cub boot/garage:seed/three.updateMatrixWorld rose 17652 -> 21266`
  - `cessna boot/garage:compile/links rose 5 -> 44`
  - `cessna boot/garage:restore/three.updateMatrixWorld rose 2269 -> 3813`

## The cost when a build opts in

No new program. bulkTrim, baggage and, on non-alloy builds, toele are +1 draw each. The relief is in the wall's own sections, the
lamp in the passenger buckets. Not timed with the rows on: FRAMECOST reads the default builds only.

## Stills

claude/aft-bulkhead-shots d8558a7ce, flyDiy/reports/evidence/AFT-BULKHEAD/rows/ROWS.md (cloud, SwiftShader, code 02220cf3a on L30c: the
same wall code as here, before the merge). The best three, by that report: full/twin_TWINB_dusk_q34Fwd,
pairs/jodel_BEFORE-FULL_day_inFwdFwd, relief/twin_RELIEF1_day_inClose. The user has these three and the twin's day before | after;
no verdict from the user on them yet.

## Gaps, all behind rows nobody has yet

Fixes ride L31c (A0: ready by 18:30):
1. **The net stands in front of the lamp on shelf builds** (Cub and Jodel FULL): the strip reads through a grille.
2. **The upper panel gets little relief.** Cub: none, the strip and the net use its height. Twin: one roll. On the Cub the relief
   lands on the near-black lower wall, so it reads faintly.
3. **The bevel's inner edge and the screw line follow the ring's lumps** while the strip runs straight.

Next round, after those:

4. **Cub SLING: a real FAIL.** The rear seat's frame goes through the canvas, up to 20.8 cm
   (details/FAIL_cub_SLING_seat_through_sling.jpg). The seat already reaches 21.6 cm behind the wall on today's Cub; a closed wall
   hides that, the open frame does not.
5. Accessories and placards (the user 4 Nov): owed, on their own branch. Original art only.

As built, not bugs:

- C172: no wall to rebuild, the rows change nothing (pixel-identical at inFwd).
- Twin 4b: no hat shelf, its pod ends 7 cm behind the wall, so bhStep falls back to the flat wall.
- Mosquito: no lamp and no net, 64 mm of face over the shelf.
- Cub FULL: the strip but no dome, no room under it in the recess.
- bhSling opens the Cub's tail interior.
- bhTwoTone + bhNet: light on light. The panel is the fully darkened pick, a light gelcoat; half-darkening is a possible follow-up.
- Fasteners do not read through the glass at q34Fwd on any build; the relief does only as RELIEF1 on the twin, as faint ribs.

Found on the way, not from these rows:

- **Page error on every twin and C172 page of the stills, BEFORE included:** tools/_cage_energy.js:1906, crewTop, CREW_PTS null. A0 is
  checking it. The stills were on L30c; not checked on master here.
- **Mosquito, stock: edLamp_flood pokes through the deck** behind the canopy. Mine, next round (A0).
