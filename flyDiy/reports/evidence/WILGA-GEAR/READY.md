# WILGA-GEAR READY (cloud, 9 Nov 2026, for A0's next train)

Branch claude/ready/wilga-gear (= claude/wilga-gear = claude/loving-pasteur-aly3v9), on master 7daba875 (L36a). Code
commits each followed by its "(built)" commit, then this note and HANDOVER. A0 lands it after the local GPU check (no box here).

The user: "modeling the Wilga type suspension, very close to original, full integrated in the game"; "ensure you get full
references, measurements, plans, maybe even 3d models, do that clean".

## What it is

A fifth main-leg family, **'trailing-link (Wilga type)'**: the PZL-104 Wilga's fixed, faired, forward-raked leg with a
lateral pivot at its foot, a trailing arm carrying the axle, and a two-stage nitrogen-oil strut from a bracket up the leg
to a horn on the arm. Offered in the garage (the mains' leg row, eight rows of its own, a preview row, the design tile),
saved and loaded (absent at default), flown (its own strut law), drawn as flown (every part posed from three physics
nodes), broken by the crash model (the leg drops), priced and weighed, gated at tech stage 2.

**Its fairing** (the user, over several rounds: an elegant fairing that hides the mechanism; the leg only, not the wheel;
cut so the articulation moves freely; closer to the bone and directional; then a professional model - details, other
placements, the ground, the profile, the first try's flare, the Wilga itself): the leg-fairing row dresses the leg in a
boot of three shapes (the new row lvBoot: trailing - the Wilga's round leg tube and slab, the default -, tapered, flared). Every section
is flow-aligned (nose into the flight), the smallest strut-fairing section round what it must hide, the edges straight;
a square-cut floor the strut leaves through (as on the Wilga); cut round the swept articulation with rubber-trimmed
lips; seams and ~70-85 screw heads a leg. No wheel fairing on this leg (rows hidden; join and clampSpec write none).
Cached: 35 ms a leg replayed, 0.3-0.4 s on a leg-row edit. Study §7.5.

**A second version of the strut** (the user: "do it as a second version and we'll check"; the row lvStrut, v1 the
default): v2 is the photographs' long strut along the leg, its eye under the fairing's root - 1.25 m eye to eye, a 269 mm
stroke (v1: 0.50 m, 119 mm), 7 / 24 bar; it stands at 68 mm, takes the limit drop without bottoming, does not bounce
(GATE WILGAGEAR 7c). It does not slim the Wilga fairing: the leg leans 31 deg on a horizontal pivot, so the strut swings
~+-8 cm sideways at the fairing's foot whatever its length. Picture: strut_v1_v2.png.

The study, every figure sourced or derived: futureDesigns/WILGA-GEAR-STUDY-2026-11.md.

## The study's key figures

| | | source |
|---|---|---|
| architecture | fixed upper leg, trailing arm on a spindle in a lateral cylinder, separate strut, its axis not quite square to the pivot | AAIB 7/2009 G-EPZL (read in full) |
| arm | 0.400 m, its horn at 0.959 of it 12.3 deg above its line, 0.268 m inboard of the wheel at the pivot | Aerofly FS4 Wilga 80 geometry, held to the TCDS (prop 2652 vs 2650 mm), track (2.79 vs 2.83 m), wheelbase (6.76 vs 6.70 m), tyres |
| track / tyres / MTOW | 2.83 m; STOMIL 500 x 200 and 255 x 110; 1300 kg; FAR 23 to Amdt 23-20 (Wilga 80) | samoloty.pl / EASA TCDS EASA.A.061 |
| travel | the arm 62 -> 12 deg below level: 270 mm of wheel on 115 mm of strut, motion ratio 0.69 -> 0.29, toggle 41.5 deg past full stroke | DERIVED (study §4.1-4.2) |
| static deflection | 70 mm of wheel travel at the loaded mass (the charge; the row) | DERIVED (§4.2) |
| strut | 45 mm piston, two stages: on the 1.0 t host 17 bar extended, 54 bar static, stage 2 at 120 bar; orifice for the 23.473(d) sink, rebound 4 x, seals 0.15 + 5 % friction | DERIVED (§4.3); the IOT's figures are not public |
| mass | the main pair ~52 kg on the 1.0 t host (the oleo row: 22.7) | DERIVED (§6), inside 4-6 % of gross |
| price | 5 400 credits the set (the host's gear ledger 11 095, oleo 7 231) | DERIVED (§6) |

## Gates (cloud, node, full logs read)

| gate | verdict | note |
|---|---|---|
| **WILGAGEAR** (new, core, ~3 min) | **PASS 51/51** | geometry as researched; static 72 mm (the study's 70); limit drop 110 / 115 mm, no bottoming; reserve drop bottoms on the steel stop and recovers; no pogo; trailing arc to 1.4 mm; a broken leg drops (tip 2.32 -> 0.00 m, "the landing gear broke"); drawn = physics through the load chain to 0.4 mm; the garage's red row; the fairing (7 cases - the Cub tapered / trailing, the host in the three shapes and, trailing, with its fitting low and high: no wheel fairing, cut and detailed; nothing moving within 3 mm through the stroke - 8.2 mm at the closest, 0.0 mm (FAIL) with the cuts off; the ground 80 mm or more at full stroke on a flat tyre pitched 10 deg nose-down; the cylinder hidden above the floor; the cache replays the same boot to the bit; clampSpec agrees); nothing else moved |
| GEAR, GEARFALL, TAILWHEEL, CLIP, BUILD, SAVE, PARTS, TAKEOFF, STOL, PILOT | PASS | PARTS after the part tree's new group (it caught the rows); STOL after the flat rows went absent (it caught them) |
| UISMOKE, DESIGN, JOIN, SUBSTEP, SPECFIX, FIT, KNIFE, CAGEFIT, EDBUGS | PASS | the layers touched |
| HITBOX, RETRACT | PASS alone | under four jobs each missed a time budget (260 vs 138 ms; 372 ms) |
| TOUR shard 0 | PASS | (36 min) |
| GEN | FAIL as master | "cruise is quiet in wind" - L36a's line; GEN flies the stock build (bit-identical) |
| JOINPARITY | FAIL as master | the five lines of L36a (Cub / Jodel masses, the nose tank, the cessnaMetal fixture bytes, the tools list) |
| TECH | FAIL as master | av.elt has no segment (master 7daba875 the same line). **Re-pin**: TILE_EXPECT.suspension [] -> ['lever'] (the option gated at stage 2 by design; reason in the gate) |
| DESIGNCHECK | FAIL as master | "200 N sideways at the post: 4.2 mm against the drawn carbon shell's 1.8 mm" - master 7daba875 run here: the same line |
| DMGGEAR | FAIL (2 lines, the floatplanes) | "the float nose-in at its own V_S0 ... nothing breaks (3 set)" and "the float dig-in at 150 km/h ... the floats' strut fittings fail in overload" - no lever build in it, its builds bit-identical; master 7daba875 run here: the same two lines, the log identical line for line but the timings |

After the fairing and the struts' drag (the last code commits) re-run green: WILGAGEAR, CLIP, GEAR, PARTS, UISMOKE, SAVE,
JOIN, EDBUGS, CAGEFIT, HONEST, BUILD, STOL, DESIGN, SPECFIX, TAKEOFF (TECH: its av.elt line only, as master). After the
leg-only fairing and its cuts: WILGAGEAR (33/33), CLIP, GEAR, PARTS, UISMOKE, SAVE, JOIN, EDBUGS, CAGEFIT, BUILD, HONEST,
SPECFIX, DESIGN green. After the directional, slimmer boot: WILGAGEAR, CLIP, GEAR, PARTS, UISMOKE, SAVE, JOIN, EDBUGS,
CAGEFIT, BUILD green. After the shapes, details and cache: WILGAGEAR (45/45), CLIP, GEAR, PARTS, UISMOKE, SAVE, JOIN, EDBUGS,
CAGEFIT, BUILD, STOL, SPECFIX, HONEST, DESIGN green (TECH: its av.elt line only, as master).

Not run here: the full battery (`--all`; the cloud box takes ~2 h a heavy gate); the timed gates (no GPU).

## Costs (node, idle machine, interleaved, parked)

| | without | with the leg | |
|---|---|---|---|
| the Cub | 97 nodes / 404 members / 75 substeps | 105 / 429 / 77 | **+9-11 %** a frame |
| the Wilga-class host | 111 / 467 / 142 (oleo row) | 119 / 492 / 145 | **+7-15 %** (its wing sets its step) |
| a build without the leg | | | one compare a substep; all 30 builds bit-identical |

The fairing: one boot a leg (~4 500 triangles, ~80 screws), nothing a frame; 35 ms a leg replayed from its cache, 0.3-0.4 s on a leg-row edit (the version pushed before took 4.6 s a leg on every redraw - found and fixed in this round). Drag (a lever leg only): the two struts at the leg's Cd - the
host's gear CdA 0.139 m^2 on the oleo row, 0.199 on the bare trailing link, 0.111 booted.

The leg's 8 nodes and 25 members over the tripod and axle bar they replace, 2-3 substeps, four rigid clusters (~4 %), the
oleo pass (negligible).

## Version bumps

None: PHYSICS_V 7, GEN_SPEC_V 10, GEN_CERT_V 7. Every build in builds/ and builds/candidates/ (30) is bit-identical to
master (the def and 2 s of node positions).

## Pictures (reports/evidence/WILGA-GEAR/)

- garage_leg_at_rest.png, garage_leg_full_stroke.png, garage_leg_rest_vs_full.png - quick_view close-ups, the same camera
- rough_strip_landing.png - the landing on a rough strip, five moments from the physics and both struts' traces
- host_side.png, host_front.png, cub_preview_0_half_full.png - quickshot
- fairing_shapes.png - the three shapes, side / three-quarter / ahead (quick_view)
- fairing_details.png - seams, screws, the floor's cut, the pivot's notch (quick_view)
- fairing_placements.png - the fitting low / default / high (quick_view)
- strut_v1_v2.png - the strut's two versions, bare and faired, at rest and at full stroke (quick_view)

## Open questions (each with its default)

The study's §9: the manual's stroke / charge / orifice (default: derived); the arm's extended and full-stroke angles
(62 / 12); the strut's upper eye (0.18 m up the leg); G-EPZL's arm-off-the-spindle break as its own group (default: the
whole leg); the strut's skew load on the spindle (not reported); the boot's own drag and mass (default: the
leg-fairing row's, the struts at the faired Cd); the strut's ~20 deg sideways skew (default: as derived; moving its upper
eye into the arm's plane would let the Wilga shape be the photographs' slim slab); a lever tailwheel (the game's tailwheel); a Wilga card
(none; the gate's host stands in).
