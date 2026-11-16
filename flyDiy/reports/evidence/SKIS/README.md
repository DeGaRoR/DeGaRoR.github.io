# SKIS evidence (13 Nov 2026, cloud: node, tools/quickshot.js - no in-game renderer)

The design note: futureDesigns/SKIS-2026-11-13.md. The gates: tools/_skis_check.js (GATE SKIS core, GATE SKISFLY full).
The cards: tools/fixtures/skis/ (carbon_cub_ss_skis.json - list:47 on Summit SS2300 wheel-skis; carbon_cub_ss_skis_pod.json - the same with the belly pod; pc6_skis.json - FIT-PROCEDURE's
PT6A-27 Porter, not on master yet, on aluminium wheel-skis with its tail ski; carbon_cub_ss_pod.json - list:47 with the
belly pod). Every picture below is the game's own load chain headless (the editor's layers draw, the join measures).

| picture | what |
|---|---|
| carbon_cub_ss2300_close_q.png | the SS2300 on the Carbon Cub (a wheel-ski: gearSki 3), close: the white monocoque on its UHMW skins, the screwed flange, the walk-on deck and its non-skid pad, the beam's spine and the T-pedestal, the cable along the top, the 4 in heel wheel, the tyre in the outboard cutout, the front spring and cable to the cowling's corner, the aft check cable |
| carbon_cub_ss2300_q / side / front / bottom.png | the same, whole; from below the skins' outline and the cutout (outboard) |
| pc6_wheelskis_q / side.png | the PC-6 on its wheel-skis (the same family, 2.9 x 0.66 m, aluminium shell), skis down: the jack to the deck |
| pc6_wheelskis_up_side.png | the same, skis up (the preview row skiPos 0): the tyre below the sole |
| carbon_cub_pod_side / q.png | the Carbon Cub with the belly pod (2.1 x 0.48 x 0.30 m, 116 L, rated 65 kg) |
| quickview_cub_skis_pod_q / q2.png | tools/quick_view.js (the perspective viewer): the Carbon Cub on its SS2300 wheel-skis WITH the belly pod (tools/fixtures/skis/carbon_cub_ss_skis_pod.json) - the user's look before the phone render |
| carbon_cub_skis_down_up.png / _front.png | the wheel-ski's two places side by side (the preview row skiPos 1 / 0): down, the ski under the tyre; up, the tyre 3 cm through the cutout - the tyre passes the cutout, no clip (GATE SKIS 4 measures it) |
| addon_control_box_panel / _close.png | the wheel-skis' control box, an ADD-ON (quick_view, the panel layer alone), FIRST version (64 x 36 mm, bolted over the breaker row - the user: "a little small ... a big white bar hanging over", the breakers' tape); superseded below |
| phone_garage_cub_skis_pod.jpg | tools/phone_still.js (the phone garage, 390x844 @3, portrait): the Carbon Cub on its SS2300 wheel-skis with the belly pod (the green T is the editor's selection handle, a UI layer) |
| phone_cockpit_addon.jpg / _zoom.jpg | the phone garage in landscape, the INTERIOR camera (`--view interior`, the head cam pitched 0.5 rad down, the selection handle hidden by `--js`): the add-on box at its parts' standard sizes (4 x 2 in: an MS35058 toggle, MS25041 amber PUMP / green DN lamps, a Klixon 7277 breaker, 3/8 in tape, one inch apart) hung under the panel's edge left of the key, clear of the switches and the breakers' tape |

The flights (the game's pilot, tools/_skis_check.js; a powder layer = SOFT_GROUND.powder handed to a world shim over
HOME - no snow surface exists on master yet: the SNOW-MUD interface, design note section 3):

- GATE SKIS 5: on powder the Carbon Cub's sinkage 33.8 / 15.3 / 8.0 cm on 0.6 x 0.12 / 1.1 x 0.2 / 1.7 x 0.3 m skis;
  on its SS2300 wheel-skis (down on the snow: the selector unset follows the surface) it lifts off in ~84 m; fixed beside
  its wheel the tyre 3 cm under the sole ploughs (78 / 87 / 198 m at 1.5 / 3 / 5 cm: the references' "the protruding tyre
  ploughs"); on 0.6 x 0.12 m skis it sinks to the bed and the pilot aborts.
- GATE SKIS 6: a straight-ski slide-out on packed snow is the same with the brake held, to the bit; a wheel-ski with
  its skis up stops in 7 m braked against 59 m free.
- GATE SKIS 7: the PC-6's selector - up on grass, down on powder, the pilot's 15 s cycle, the axles rise 6 cm.
- GATE SKISFLY: the Carbon Cub (SS2300s) and the PC-6 (skis down) fly the circuit off and back onto powder and stop
  with no brakes; the PC-6 also on the grass with its skis up (the full tier: the battery's log).
- Before the fix of the tail ski's mass and of the three-point stance (the rigs drop the aeroplane level; the game does
  not), the PC-6's tail spring snapped through under full rudder at the take-off's start: FIT-PROCEDURE's card sits
  with its aft belly 1 cm off the ground (reported).
