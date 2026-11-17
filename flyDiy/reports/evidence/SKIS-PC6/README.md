# SKIS-PC6: the PC-6 on skis, on snow, at the Ardent altiport (15 Nov 2026, cloud, node only)

The user's ULTIMATE TEST (via A0, Sun 15 Nov 00:50): the PC-6 (FIT-PROCEDURE's validated card, its flight figures as
landed) on skis "as the real Porter does", on snow, at the OBSERVATORY's runway on Mount Ardent - take-off and landing
flown in node by the game's pilot, persona Expert, the numbers tabled.

THE RIG: `tools/_skis_ardent.js` (GATE SKISARDENT, the full tier: `--gate`). The game's own flight (tools/_tour_lib.js
gameHost: the game's placement and fuel, the day ticked, damage on), the pilot `profile: 'expert'`:
- LANDING: HOME > mt_strip (the arrival, the circuit, the flare, the roll-out UP the strip);
- TAKE-OFF: mt_strip > HOME from the line-up (the game's skip to line-up, G3302), DOWN the strip, to 15 m over the
  lift-off point and on into the climb. (From the stand, the pilot's 252-degree pivot on the apron breaks the PC-6's tail
  on plain wheels on today's gravel too - see THE FINDINGS.)

THE STRIP: mt_strip "Ardent Altiport", 210 x 12 m, ends at 1020.0 and 1038.9 m, 15 % at the bottom easing to a flat top,
landed WEST uphill, left EAST downhill (OBSERVATORY-SITE). THE SNOW: SNOW-MUD's SURFACE codes (8 packed, 9 powder) laid
over the summit's snowfield by the rig (world.surface wrapped: the ground over 960 m within 600 m of the strip) - the
OBSERVATORY's SNOW HOOK switches the record itself (SNOW-MUD's); `snow: 'record'` reads it when it does.

THE AEROPLANES: the PC-6/B2-H4 (builds/candidates/pc6_drafting_2026-11-11.json) on its wheels; and with the real
Porter's factory ski option - hydraulic main WHEEL-SKIS (aluminium shell, UHMW bottom, 2.9 x 0.66 m, the tyre through the
cutout; skis down 6 cm below the tyre, up 3 cm above it, a 15 s cycle) and a tailwheel ski (0.95 x 0.28 m)
(tools/fixtures/skis/pc6_skis.json: the landed card + the ski rows only). The game's load for the leg: 1277 kg on wheels,
1457 kg on skis (144 L of fuel; the kit 149 kg + its share of the drag).

## THE NUMBERS (persona Expert; the take-offs from the line-up)

| case | surface | leg | result | ground run / roll | speed | to 15 m | strip left | ski rut | skis | damage |
|---|---|---|---|---|---|---|---|---|---|---|
| PC-6 on wheels (the datum) | gravel (today) | landing | stopped, 3-point, touchdown 40 m in | 97 m | 38 kt, sink 1.38 m/s | - | 73 m | - | - | none |
| PC-6 on wheels (the datum) | gravel (today) | take-off | off | 67 m | 50 kt | 199 m | 92 m | - | - | none |
| PC-6 on wheels | powder | landing | stopped, 3-point, touchdown 40 m in | 74 m | 38 kt | - | 96 m | (the tail wheel 30 cm, the mains ~7) | - | none |
| PC-6 on wheels | powder | take-off | off | 67 m | 48 kt | 210 m | 91 m | (30 cm) | - | none |
| **PC-6 on wheel-skis** | **powder** | **landing** | **stopped, 3-point, touchdown 40 m in** | **79 m** | **40 kt, sink 1.55 m/s** | - | **90 m** | **15.8 cm** | **down at the touchdown** | **none** |
| **PC-6 on wheel-skis** | **powder** | **take-off** | **off** | **88 m** | **53 kt** | **248 m** | **70 m** | **14.9 cm** | down | **none** |
| PC-6 on wheel-skis | packed (rolled) | landing | stopped 52 m PAST THE END | 221 m | 40 kt, sink 1.55 m/s | - | -52 m | 3 cm | down at the touchdown | none |
| PC-6 on wheel-skis | packed (rolled) | take-off | off | 85 m | 53 kt | 244 m | 73 m | 3 cm | down | none |

(The wheel rows: the first run; the ski rows: after the two fixes below. GATE SKISARDENT re-flies the four ski legs.)

## THE FINDINGS

1. THE PC-6 ON ITS WHEEL-SKIS DOES THE ARDENT ALTIPORT ON POWDER: down uphill in 79 m with 90 m to spare, off downhill in
   88 m with 70 m to spare, the skis 15 cm into the fresh snow, no damage.
2. ON ROLLED (PACKED) SNOW IT DOES NOT STOP: 221 m of slide from a 40 kt touchdown (SNOW-MUD's ideal UHMW mu 0.04, no
   brakes on skis, the slope easing to flat over the last 40 m). The real B2-H4 stops on its REVERSING PROPELLER - the game
   has no reverse thrust (A GAP: the engine's / A0's). The pilot's own landing-run sheet said 195 m (its wheels' brakes):
   the Pilot's landing sheet does not know that skis have none (A GAP: the Pilot's).
3. ON WHEELS ON POWDER the roll is the gravel's (67 m against 67). SNOW-MUD measured it (15 Nov): the 0.69 m mains at
   ~100 kPa sink 7 cm (rolling coefficient ~0.1 at rest, falling as the wing takes the load); the 30 cm read is the 0.14 m
   TAIL WHEEL bottoming the layer until the tail lifts (~3 s); against the PC-6's thrust (T/W 0.57) and the 15 % downhill
   the ~1 kN barely shows. What SNOW-MUD's tyre law leaves out is the BULLDOZING / ram drag of the snow pushed ahead (~rho b
   z v^2) - their named cut (futureDesigns/SNOW-MUD-FINISH-2026-11-15.md): if the wheels on powder should read visibly
   harder at the observatory, it is A0's call (it moves SNOW-MUD's stock runs and re-fits k on 9 and 10).
4. FIXED HERE (they were the skis'): (a) the wheel-ski's reset snap pushed the PC-6's mains 6 cm into the ground at its
   stand (the game stands it on its tyres, not on its skis): 38 fuselage yields -> 0 (the gap measured, the airframe turned
   about the tail contact); (b) the skis touched down 42 % lowered (the solver's selector follows the surface UNDER the
   mains): the pilot now sets a hydraulic wheel-ski for the DESTINATION's ground before the approach (43_pilot, as the
   amphibian's wheels) - down at the touchdown.
5. NOT THE SKIS' (reported): the PC-6 breaks a tail member during the pilot's 252-degree pivot on the mt_strip apron
   (first yield at 1.2 m/s, the tail 0.42 m over a flat apron: no strike), on plain wheels on gravel too; the same pivot at
   HOME (94 degrees) is clean. FIT-PROCEDURE's card (the tail) and the Pilot's (a pivot at a "push only" strip).

## ON L40d WITH DEEP SNOW, FROM OBSERVATORY-3's STAND (claude/skis-pc6-2, 16 Nov)

The base: L40d fb8fb633b + SNOW-MUD's snow-mud-finish-l40d 192ae6a1b (DEEP SNOW: powder and wet snow a virgin layer, a
tyre's bulldozing). The take-offs FROM THE STAND, which OBSERVATORY-3 (claude/ready/observatory-2 2211a4387, overlaid here:
it is not on L40d) turned to face the take-off (hdg 0, nose east, downhill), its apron packed snow; the strip's own snow
the case's. The pilot taxis and lines up on its wheels and lowers the skis at the hold (the run measured from there).

| PC-6 on wheel-skis | leg | result | run | strip left | to 15 m | ski rut | damage |
|---|---|---|---|---|---|---|---|
| powder | landing (uphill) | stopped, skis down at the touchdown, 40 m in at 20.7 m/s | 78 m | 93 m | - | 20.5 cm | none |
| powder | take-off (downhill, from the stand) | off at 24.3 m/s | 71 m | 88 m | 259 m | 19 cm | none |
| packed | take-off (from the stand) | off at 25.8 m/s | 76 m | 79 m | - | 3 cm | none |
| packed | landing | stopped 19 m PAST THE END (no brakes, no reverse) | 189 m | -19 m | - | - | 624 member yields past the end, in the bank (4.5 m rise in 20 m); none on the strip, no break |

On L40d alone (its stand 90 deg off the take-off: the line-up) the same four legs fly the same numbers within 4 m.
On plain wheels from the turned stand (the site's own snow: packed apron, powder strip) the PC-6 taxis and takes off
clean (104 m); with its skis down on the apron it broke its tail in the pilot's pivot - hence the wheels on the ground.
