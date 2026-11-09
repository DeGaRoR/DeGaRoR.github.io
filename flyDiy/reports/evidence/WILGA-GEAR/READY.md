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

**Its fairing** (the user, after the first pictures: "an elegant fairing ... something robust that could go on many planes,
but something that looks good and that hides a bit of this huge mechanics"): the leg-fairing row dresses the leg in a
boot sized from what it hides (the strut over its whole stroke, its bracket, the pivot) with a slope-limited taper and
an outboard flank that hugs its contents; the spat row puts the spat on the arm, level at rest. They never meet through
the stroke (gated), and the boot takes the struts' drag from Cd 1.0 to 0.30. Study §7.5.

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
| **WILGAGEAR** (new, core, ~2 min) | **PASS 30/30** | geometry as researched; static 72 mm (the study's 70); limit drop 110 / 115 mm, no bottoming; reserve drop bottoms on the steel stop and recovers; no pogo; trailing arc to 1.4 mm; a broken leg drops (tip 2.32 -> 0.00 m, "the landing gear broke"); drawn = physics through the load chain to 0.4 mm; the garage's red row; the fairing (on the Cub and the host the spat never enters the boot through the stroke - 26.5 / 19.5 mm at the closest; the boot hides the strut's cylinder at rest and at full stroke; with the flank's easing off the host's line FAILs, 36 points inside); nothing else moved |
| GEAR, GEARFALL, TAILWHEEL, CLIP, BUILD, SAVE, PARTS, TAKEOFF, STOL, PILOT | PASS | PARTS after the part tree's new group (it caught the rows); STOL after the flat rows went absent (it caught them) |
| UISMOKE, DESIGN, JOIN, SUBSTEP, SPECFIX, FIT, KNIFE, CAGEFIT, EDBUGS | PASS | the layers touched |
| HITBOX, RETRACT | PASS alone | under four jobs each missed a time budget (260 vs 138 ms; 372 ms) |
| TOUR shard 0 | PASS | (36 min) |
| GEN | FAIL as master | "cruise is quiet in wind" - L36a's line; GEN flies the stock build (bit-identical) |
| JOINPARITY | FAIL as master | the five lines of L36a (Cub / Jodel masses, the nose tank, the cessnaMetal fixture bytes, the tools list) |
| TECH | FAIL as master | av.elt has no segment (master 7daba875 the same line). **Re-pin**: TILE_EXPECT.suspension [] -> ['lever'] (the option gated at stage 2 by design; reason in the gate) |
| DESIGNCHECK | FAIL as master | "200 N sideways at the post: 4.2 mm against the drawn carbon shell's 1.8 mm" - master 7daba875 run here: the same line |
| DMGGEAR | FAIL (2 lines, the floatplanes) | "the float nose-in at its own V_S0 ... nothing breaks (3 set)" and "the float dig-in at 150 km/h ... the floats' strut fittings fail in overload" - no lever build in it, its builds bit-identical; master 7daba875 run here: the same two lines, the log identical line for line but the timings |

Not run here: the full battery (`--all`; the cloud box takes ~2 h a heavy gate); the timed gates (no GPU).

## Costs (node, idle machine, interleaved, parked)

| | without | with the leg | |
|---|---|---|---|
| the Cub | 97 nodes / 404 members / 75 substeps | 105 / 429 / 77 | **+9-11 %** a frame |
| the Wilga-class host | 111 / 467 / 142 (oleo row) | 119 / 492 / 145 | **+7-15 %** (its wing sets its step) |
| a build without the leg | | | one compare a substep; all 30 builds bit-identical |

The fairing: one boot a leg (~520 vertices), nothing a frame. Drag (a lever leg only): the two struts at the leg's Cd - the
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
- fairing_boot_and_spat.png - the boot and the spat at rest and at full stroke, side and inboard-rear (quick_view)
- fairing_boot_only.png - the leg-fairing row alone, the wheel bare, at rest and at full stroke (quick_view)

## Open questions (each with its default)

The study's §9: the manual's stroke / charge / orifice (default: derived); the arm's extended and full-stroke angles
(62 / 12); the strut's upper eye (0.18 m up the leg); G-EPZL's arm-off-the-spindle break as its own group (default: the
whole leg); the strut's skew load on the spindle (not reported); the boot's own drag and mass (default: the
leg-fairing row's, the struts at the faired Cd); a lever tailwheel (the game's tailwheel); a Wilga card
(none; the gate's host stands in).
