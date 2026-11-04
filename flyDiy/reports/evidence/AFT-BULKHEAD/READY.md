# AFT-BULKHEAD READY (CABIN-CRAFT, 4 Nov 2026, for train L31b)

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
  - LIVERY: `garageFloodArm is not defined` in its rig when read on e6bcfb368. On adc53b25b only the FAIL was read, not the text.
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
