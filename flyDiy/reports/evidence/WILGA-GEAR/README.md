# WILGA-GEAR evidence (9 Nov 2026, cloud: node, tools/quickshot.js and tools/quick_view.js - no in-game renderer)

The study: futureDesigns/WILGA-GEAR-STUDY-2026-11.md. The gate: tools/_wilga_gear_check.js (GATE WILGAGEAR).

| picture | what | how |
|---|---|---|
| garage_leg_at_rest.png | the trailing-link leg at its static deflection at gross (strut 50 mm in) | quick_view, perspective, the Wilga-class host; floor and shadow composited (studio.py) |
| garage_leg_full_stroke.png | the same camera at full stroke (strut 115 mm, wheel up 270 mm) | as above |
| garage_leg_rest_vs_full.png | the two side by side | |
| rough_strip_landing.png | the host landing at 1.5 m/s and 0.8 Vs onto 5 cm bumps every 3 m: five moments at their simulated height and pitch over the field's profile, the legs posed at the physics strokes; both struts' traces | rough.js (the flight, node) -> roughshots.js (quickshot side views at each stroke) -> compose.py |
| host_side.png / host_front.png | the Wilga-class host: the user's metal Cessna airframe as a taildragger on the leg, 2.83 m track, 500 mm tyres | quickshot |
| fairing_shapes.png | the leg fairing's three shapes (lvBoot: tapered, flared, trailing - the Wilga's), side / three-quarter / ahead, at rest | quick_view, the host with s1LegFair 1 |
| fairing_details.png | close: the seams and screws, the floor's cut where the strut leaves, the pivot's trimmed notch (tapered above, trailing below) | quick_view |
| strut_v1_v2.png | the strut's two versions (lvStrut): v1 the derived short strut, v2 the photographs' long strut along the leg - bare, faired at rest, at full stroke, from aft | quick_view |
| strut_mount_slider.png | the strut's mount up the leg (lvTop) at 0.13 (v1), 0.40 and 0.72 (the default): bare, faired at rest from aft, at full stroke - the fairing and its cuts follow | quick_view |
| fairing_root_fit.png | the fairing's root fitted to the fuselage (trimmed on the skin, filleted, a rubber bead round the joint): the host and the Cub | quick_view |
| fairing_placements.png | the fitting low / default / high on the body (lvRootAng 50 / 80 / 110), side and ahead | quick_view |
| cub_preview_0_half_full.png | the garage preview row (gearLvPos) at 0 / 0.5 / 1 on the Cub | quickshot |

The host's garage rows (quickshot --over / quick_view --cage):
`s1Leg 4, s1Drop 0.80, s1R 0.25, s1X 1.415, s1Z 1.45, s1Fair 0, s1LegFair 0, s2Leg 3, s2Z 0.10, s2X 0, s2R 0.064, s2Fair 0, s2LegFair 0, s2Steer 1`
on builds/cessna172_2026-09-20_corrected.json.

quick_view with a pose: tools/quick_view.js run with its probe swapped for one that first poses the legs (mkprobe.js writes it:
GEAR_LEVER.gearLeverAt + gearNodeFrame, the gear layer's own preview rule, then the stock probe), shot by shoot.js
(Playwright, the viewer's own camera: target, distance, yaw, pitch). The scripts carry this session's scratch paths.

Not committed: the third-party references (the IPMS walkaround photographs, the Aerofly FS4 flight model, the AAIB / EASA /
NZ CAA documents) - their URLs are in the study's §1.
