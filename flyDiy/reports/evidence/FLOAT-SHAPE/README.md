# FLOAT-SHAPE (G1930-G1934) - the Wipline afterbody, before and after

The user (2026-10-05): "the shape of the Cessna floats seems a little off. The back part is really thin. Can you check
that? It had the objective to model the range of Wipaire, but the current one seems slightly off."

## What to look at

| file | what it shows |
|---|---|
| `Wipline2350_lines.png` / `.svg` | THE DRAWING: the Cessna's 2350, orthographic. Profile (keel, chine, deck), plan (deck edge, chine), the afterbody's sections at u = 0 / 0.25 / 0.5 / 0.75 / 1 from astern, the section area per station bow -> stern. Dashed grey = before (origin/master 55dd98b7), solid blue = after, magenta = the reference (the catalogue's box, the 7-9 deg sternpost band from the step's keel point, the stern's minimum depth and width band, the step's station). The reference's verdicts at the foot. |
| `Wipline8750_lines.*`, `Wipline2100_lines.*` | the same for the Caravan's 8750 (the big end of the range) and the 2100 |
| `before/`, `after/` | the bench (tools/_float.html `?ref=1`), SwiftShader: `profile` (side), `top`, `aft` (dead astern), `iso`, each in `paint` and `sections` view, for the 2350 and the 8750. The stat line carries the reference's verdicts (`!` = outside). |
| `game/c172_2350_side_{before,after}.jpg` | the game (tools/soft_still.js, SwiftShader): the Cessna 172 on Wipline 2350s (the GATE WIPLINE fixture) on the stand, the same orbit |
| `numbers_{before,after}.json` | tools/float_shape_numbers.js: displacement, the settle, the hump, the step, the lift-off, for the three float builds |
| `c172_crosswind_{before,after}.log` | GATE SEAPLANE's crosswind take-off and taxi flown on the 172 fixture (not a gate: its bounds are the twin's) |

## The reference and its sources

No Wipaire lines drawing was reachable from the cloud session (wipaire.com, manualslib, manualzz, NACA's and DTIC's
servers, Elsevier's book site: all outside the environment's network policy). The reference is therefore three kinds
of fact, each tagged in `tools/_float_gen.js` REF and on every verdict:

- **CAT, measured:** the catalogue rows (wipaire.com product pages, read through search): the 2350 is 19'7" (5.97 m)
  long, its hull 2'5" (0.74 m) wide and 1'11" (0.58 m) high, displacement 2,570 lb / maximum flotation 2,855 lb (the
  3450's page states both the same way: 3,776 / 4,196 lb). The hull lands on all four exactly (the fineness fit).
- **RULE, published design practice:** the sternpost angle 7-9 deg (NACA tank practice as Gudmundsson, *General
  Aviation Aircraft Design* App. C3, and the USNA EN486 notes quote it), on a straight afterbody keel (the line that
  angle is defined on); the step's station at 0.55 L (G451's reading of the 2350 parts manual p. 97).
- **INF, inferred** from photographs of Wipline 2100 / 2350 floats on 172s and the parts manual's rigging (the aft
  spreader bar sits across a parallel-sided deck just aft of the step): the deck held at full width to the aft bar,
  a stern about half the beam (0.45-0.65), at least a quarter of the step's depth at the stern, the mid-afterbody
  section at least 0.45 of the step's, the afterbody 30-45 % of the volume. THESE ARE NOT MEASURED - the user's eye
  and a Wipaire drawing are the judges.

## Where it was thin (the 2350, the afterbody from the step u = 0 to the stern u = 1)

Section area as a fraction of the step's (forebody) section; depth keel -> deck; deck width.

| u | area before | area after | depth before | depth after | width before | width after |
|---|---|---|---|---|---|---|
| 0 | 0.82 | 0.82 | 0.430 m | 0.430 m | 0.740 m | 0.740 m |
| 0.2 | 0.64 | 0.70 | 0.369 | 0.375 | 0.689 | 0.740 |
| 0.4 | 0.47 | 0.56 | 0.303 | 0.320 | 0.627 | 0.719 |
| 0.5 | 0.39 | 0.49 | 0.269 | 0.292 | 0.594 | 0.692 |
| 0.6 | 0.31 | 0.41 | 0.234 | 0.265 | 0.559 | 0.654 |
| 0.8 | 0.18 | 0.27 | 0.162 | 0.210 | 0.489 | 0.547 |
| 1.0 | 0.11 | 0.14 | 0.118 | 0.155 | 0.415 | 0.397 |

Three causes, each measured: (1) the plan tapered from the step itself (u^1.15) - the deck lost 15 % of its width by
mid-afterbody where a Wipline's is parallel to the aft spreader bar; (2) the keel curved up (aftCurve) onto an 8.7 deg
sternpost on the 2350 and 9.5-10.3 deg on the big rows (the rule is 7-9); (3) the fineness fit took the volume the
catalogue forbids OFF THE STERN (it raised and curved the keel and narrowed the transom with the fineness: the 8750's
stern was 0.34 of the beam and 0.19 of the step's depth). The afterbody held 28 % of the 2350's volume (29 % on the
8750).

## The fix (src/core/32_hydro.js - the one section family the drawn float and the physics share)

- `WIPLINE_AFT` (every catalogue row): a straight afterbody keel on an 8.0 deg sternpost (`aftAngle` 5.9 off the heel,
  `aftCurve` 0), the plan held at the step's beam over the first fifth (`aftHold` 0.2) and closing as the square
  (`aftPow` 2) to a stern half the beam (`bStern` 0.5).
- The fineness fit no longer touches the afterbody; it takes the volume from the forebody (the bow's plan 2.6 per
  unit, the rocker 0.3, the V 12 deg per unit - was 20). Every row still lands on its maximum flotation (0.0 %).
  The 2350 now fits at f +0.09 (deadrise 23.1 / 18.6, was 20.6 / 17.1 at f -0.23); the 8750 at 33.7 / 23.9 (was
  34.8 / 24.4).
- `DEF` (the H0 float and every aeroplane the frame sizes by its gross - the twin of GATE FLOATS / SEAPLANE) keeps
  its afterbody bit for bit (`aftHold` 0, `aftPow` 1.15 = the old law); a record saved before G1930 carries neither
  key and is drawn and flown as it was.
- The garage's float (tools/_cage_float.js hullParams) wears the Wipline plan law.

## The hydro numbers that move

Only the Cessna on the 2350 (the GATE WIPLINE fixture, re-picked to the new preset). The twin and the user's
custom Cessna (bugReports/cessnaFloatsWOrks.json) are identical to master in every number below.

| the 172 on 2350s | before | after |
|---|---|---|
| displacement (pair, to the deck) | 2590 kg | 2590 kg |
| draft at the step, at rest | 0.320 m | 0.318 m |
| trim at rest | +0.79 deg | -0.12 deg (decks level) |
| hump R/W (max under 14 m/s) | 0.243 at 7.9 m/s | 0.250 at 8.9 m/s |
| on the step | 13.3 s, 111 m | 13.1 s, 111 m |
| lift-off | 35.8 s, 714 m, 38.1 m/s | 33.8 s, 654 m, 37.7 m/s |
| crosswind take-off (5 m/s) | 21.1 s, swing 12.5 deg, 4 skips | 21.3 s, swing 11.0 deg, 3 skips |
| crosswind taxi | 10.2 deg, 1.9 m | 10.3 deg, 1.8 m |

The rest trim is the honest price of the fuller afterbody: at the catalogue's flotation a third of the volume aft moves
the centre of buoyancy 0.13 m aft (1.08 -> 0.95 m ahead of the step at the rest draft), and the 172 floats level.
GATE WIPLINE's trim floor went from +0.5 to -1 deg (level or bow-up).

## Open

- **The deck height.** The catalogue's 0.58 m is read as the OVERALL height (the bow, with G451's 10 % sheer), so the
  deck at the step and over the whole afterbody sits at 0.527 m. If Wipaire's drawing shows a level deck at 0.58 m,
  the afterbody gains 5 cm of depth (the stern 0.21 m instead of 0.155) - but at the catalogue's flotation the fit
  must then take ~13 % of the volume off the bottom: measured on a scratch copy, the 2350 fits at a 30.8 deg V (from
  23.1) with a sharp bow plan, the 2100 at 31.9, and the 8750 cannot reach its flotation at all (4978 kg against 4405
  at the finest fit). Under this family the catalogue's flotation argues FOR the overall-height reading; a drawing
  decides it.
- A Wipaire lines drawing (the service manual P/N 1002549 or the parts manual's p. 97 profile) against the INF
  rules - the user, or a session whose network reaches wipaire.com.
- A build saved on a preset before G1930 keeps its rows (the starter applies once); re-picking the preset in the
  float page gives it these lines. Opened in the garage, any saved Wipline float takes the held plan on its next join.
