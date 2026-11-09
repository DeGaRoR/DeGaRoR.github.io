# WILGA-GEAR STUDY: the PZL-104 Wilga's trailing-link oleo main gear, researched and built (2026-11)

The user: "modeling the Wilga type suspension, very close to original, full integrated in the game"; "ensure you get full
references, measurements, plans, maybe even 3d models, do that clean". A0's brief: a new main-undercarriage TYPE in the
plane builder, offered in the garage, saved and loaded, flown by the physics, damaged by the crash model, priced and
weighed, gated, WYSIWYG, with GATE WILGAGEAR.

This study holds the facts with their sources (§1-§3), the figures the published record does not give and how each was
derived (§4), what the gear does (§5), its mass and price (§6), how the game builds it (§7), what it costs (§8), the
open questions with their defaults (§9) and the pictures (§10).

**Tags.** `[n]`: a source in §1. **MEASURED**: read off a source's numbers or pixels. **DERIVED**: computed here, the
method given. **UNKNOWN**: not found; the default used is said.

---

## 1. Sources

Read in full this session (the environment's network was opened to these hosts for it):

- **[A]** AAIB Bulletin 7/2009, EW/C2008/06/03, PZL-104 Wilga 80 G-EPZL, Wortham 14 Jun 2008.
  https://assets.publishing.service.gov.uk/media/5422f80bed915d1374000697/PZL-104_Wilga_80__G-EPZL_07-09.pdf
  Gave: the gear's architecture in the investigators' words, the pivot's construction, the strut's skew, the known
  failure mode (§2).
- **[T]** EASA TCDS EASA.A.061, PZL-104 WILGA Series, Issue 05, 25 Aug 2022. https://www.easa.europa.eu/en/downloads/7403/en
  Gave (Wilga 80 section): FAR 23 through Amdt 23-20 (reference date 2 Aug 1978), span 11.134 m, length 8.10 m, height
  2.96 m, wing area 15.5 m², MTOW 1300 kg, landing mass 1265 kg, CG range 0.425-0.616 m aft of datum, propeller US 122 000
  2-blade 2650 mm, main tyre STOMIL 500 x 200 mm, tail tyre STOMIL 255 x 110 mm, limit load factors +3.8 / -1.52.
  (The Wilga 2000 sections: Cleveland 40-75D wheel / Goodyear 8.00-6TT 486 x 191 mm as an alternative.)
- **[N]** CAA of New Zealand, Type Acceptance Report TAR 99/18, PZL-104 Wilga 35.
  https://www.aviation.govt.nz/assets/aircraft/type-acceptance-reports/PZL-104_Wilga_35.pdf
  Gave: BCAR Section D (1959) basis; "U/c Position - N/A - Fixed undercarriage".
- **[P]** IPMS Netherlands walkaround, PZL-104 Wilga 35A SP-EBK (32 photographs).
  https://ipms.nl/walkarounds/walkaround-vliegtuigen-props/walkaround-pzl-wilga
  Gave (IMG_5487 side view, IMG_5504 the leg three-quarter, IMG_5525-5527 the arm and strut close): the faired upper leg
  raked forward with its thin rear brace, the lateral pivot cylinder at its foot, the red box-section trailing arm, the
  strut's chrome rod and black rubber boot from a bracket up the leg to the arm by the axle; the piston's size against
  the tyre (§4.3).
- **[F]** The Aerofly FS4 PZL-104 Wilga 80 (freeware; compiled by K. Kaniewski, 3D model by R. Pearsons; no licence
  file - read for measurement only, nothing of it is in the repo). https://github.com/krzysk1/wilga (wilga.tmd, wilga.tmc)
  Gave the 3D geometry as text coordinates (x forward, y left, z up; metres): the arm's pivot joint (1.2571, +-1.1216,
  -1.09358) on a lateral axis, the axle (1.0, +-1.39, -1.40), the strut's eyes (1.13218, +-1.2249, -1.077) on the leg and
  (0.95498, +-1.2166, -1.33008) on the arm, the wheel radius 0.25 (rim 0.11), the tailwheel at (-5.76, 0, -0.774) radius
  0.128, the propeller hub at x 1.95616 radius 1.32588, the contact spheres. The developer's commented-out strut limits
  (0.295 / 0.33 m eye to eye about the drawn 0.3089) were read as a hint, not data.
- **[S]** Stomil-Poznań, aircraft tyre AT4 500 x 200 (via the research notes' snippets; the host was opened but the
  figures were taken from [T] and the snippet): 505 mm new, 195-200 mm wide, 0.20 (-0.02) MPa rated.
- **[W]** Wikipedia EN, PZL-104 Wilga; Wikimedia Commons "ПЗЛ П-104 Вильга схема.jpg" (M. Fetisov, public domain - a
  394 x 540 three-view, too small to measure the leg from; Commons rate-limited this session's address otherwise).

From search-result excerpts only (the research subagent's notes, 43 sources; the full list:
the session's `wilga_research.md`, summarised here): Jane's Wilga 2000 entry ("semi-cantilever main legs, of rocker
type, have oleo-pneumatic shock-absorbers. Low-pressure tyres. Hydraulic brakes"); polot.net ("amortyzatory
powietrzno-olejowe, a następnie gazowo-olejowe dwustopniowe, napełniane azotem" - air-oil, later two-stage gas-oil,
nitrogen-charged; the cable-steered tailwheel); samoloty.pl (the track widened 2.12 -> 2.83 m from the Wilga 3 to the 35);
the Thai Flying Club article (track 9.3 ft, wheelbase 22 ft); Pytka et al., Sensors 20(1):227 (2020) (the 35A's rocker
gear, 500 x 200 low-pressure tyres); lotnictwo.net.pl (the tail leg's oleo from ~1978).

Checked and set aside:
- **The repo's own "Draco" payload** (src/models/draco_model.js, helijah, CC-BY-4.0): Mike Patey's turbine Wilga 2000
  conversion. Rendered side and front here: its gear is the conversion's (a long curved faired leg to huge tundra
  tyres), not the stock trailing link - not used for the gear.
- **Outerzone RC plans** (oz14619 2.3 m span, oz10376): the download is behind a script gate the session's browser could
  not pass; RC plans' gear is not dimensioned anyway.
- **The maintenance manual (Instrukcja Obsługi Technicznej) and the flight manual (IUwL)**: copies are posted on Scribd,
  nakolannik.pl and chomikuj.pl; not reachable, and their licensing is unclear. They hold the strut's stroke, charge and
  servicing figures this study had to derive (§4, §9).

---

## 2. The real gear

The AAIB [A], verbatim: "Each main gear comprises a fixed upper leg, to which is attached a pivoting trailing arm carrying
the wheel and brake unit. The trailing arm is attached to the upper leg by a spindle with a bearing at its outer end. The
spindle locates into the bore of a lateral cylinder attached to the bottom of the upper leg and is retained by a small
diameter bolt and two small welds. The trailing arm is free to pivot about the bearing. A separate shock absorber strut is
attached to the trailing arm and the upper leg. The axis of the shock absorber is not exactly perpendicular to the
trailing arm pivot axis, such that compression of the strut results in an axial load component on the bearing and
spindle."

The known failure [A]: G-EPZL "overturned on landing following the separation of the lower part of the right main landing
gear": the spindle's retaining bolt and welds failed and the arm with its wheel came off; "the upper part of the leg had
then dug into the ground, causing the aircraft to pitch forward and become inverted". The AAIB thought cumulative damage
over many landings more likely than one heavy landing.

The photographs [P]: the upper leg is a faired strut (a red tube with a white trailing fairing) from the lower fuselage
below the cabin's front, raked forward and splayed outward to the pivot cylinder at its foot, with a thin tube bracing it
back to the fuselage; the arm is a red box-section forging trailing from the pivot to the axle inside the wheel; the
strut runs from a bracket on the leg a little above the pivot down to the arm by the axle - the black boot at its upper
end, the chrome rod below.

The tailwheel [T][P]: STOMIL 255 x 110, cable-steered from the pedals; on the later aircraft a short rocker with a small
oleo; earlier a glass-fibre spring leg. **Not modelled here** (the game's own tailwheel kinds fly it; §9 Q6).

---

## 3. The geometry, measured

From [F], in its frame (x forward, z up), each side:

| | x | lateral | z | relative to the axle (fwd, up, inboard) |
|---|---|---|---|---|
| pivot (arm's joint, lateral axis) | 1.2571 | 1.1216 | -1.0936 | +0.257, +0.306, 0.268 |
| axle | 1.000 | 1.390 | -1.400 | 0 |
| strut eye on the arm (horn) | 0.9550 | 1.2166 | -1.3301 | -0.045, +0.070, 0.173 |
| strut eye on the leg | 1.1322 | 1.2249 | -1.0770 | +0.132, +0.323, 0.165 |

**The arm is 0.400 m** (pivot to axle, MEASURED), **50.0 deg below level** as drawn; the horn sits at 0.959 of the arm
from the pivot, **12.3 deg above the arm's line** (MEASURED); the arm runs 0.268 m inboard of the wheel's centre at the
pivot and 0.173 m at the horn (MEASURED: the arm runs inside the wheel, the axle stub carries the wheel).

**The model is held to the published figures**: its propeller 2 x 1.32588 = **2.652 m** against [T]'s 2650 mm; its
track 2 x 1.39-1.40 = **2.78-2.80 m** against the published 2.83 m; its wheelbase 1.0 + 5.76 = **6.76 m** against
6.70-6.71 m; its main wheel radius **0.250 m** against the tyre's 505 / 2 = 0.2525 m [S]; its tailwheel 0.128 m against
255 / 2 = 0.1275 m [T]. Every check inside 2 %.

**The model's strut eyes do not make a working strut.** With them, the strut is nearly square to the horn's path; its
stroke rises only 51 mm and then the linkage toggles (the arm 45 deg up):

| arm up from drawn (deg) | 0 | 10 | 20 | 30 | 40 | 45 | 50 |
|---|---|---|---|---|---|---|---|
| wheel rise (mm) | 0 | 49 | 106 | 170 | 237 | 272 | 306 |
| strut stroke (mm) | 0 | 18 | 34 | 45 | 50 | 51 | 51 (toggle) |

So the eye on the leg is moved UP THE LEG (DERIVED, §4.1), keeping the measured horn - which is also what the photographs
show (the bracket a hand above the pivot, not level with it).

---

## 4. The figures not published, derived

### 4.1 The strut's upper eye: 0.18 m up the leg from the pivot (DERIVED)

The leg's direction from the pivot to its fitting (the drawn leg's in the game; the reference's (aft 0.640, up 0.577,
inboard 0.514) from [P]'s side and front views and [F]'s pivot). With the eye up that line at `top`:

| top (m) | strut eye to eye (m) | motion ratio, extended -> full | toggles at |
|---|---|---|---|
| 0.10 | 0.422 | 0.42 -> 0.14 | |
| 0.14 | 0.439 | 0.56 -> 0.21 | |
| **0.18** | **0.458** | **0.69 -> 0.29** | **91.5 deg of swing** |
| 0.22 | 0.480 | 0.80 -> 0.33 | |

0.18 m: a strut as long as the arm, as the photographs show it, with the linkage's toggle 41.5 deg past full stroke.

### 4.2 The travel and the stroke (DERIVED)

- **Full extension: the arm 62 deg below level.** The drawn pose of [F] (50 deg) is the aeroplane parked light (the
  modeller works from photographs of parked aircraft - [P] shows the same); its strut 21 mm short of [F]'s own extended
  limit (0.33 m) says the same. 62 deg puts it 47 mm of wheel travel below the drawn pose.
- **Full stroke: the arm 12 deg below level** - the wheel's travel **0.270 m** on **0.115 m** of strut. A strut's
  closed length must hold twice its stroke plus its glands and eyes: 0.458 - 0.115 = 0.343 m >= 2 x 0.115 + 0.10. "Long
  stroke for rough strips" (Plane & Pilot, the pilots on supercub.org) is 0.27 m of wheel travel.
- **The static deflection at the loaded mass: 0.070 m of wheel travel** (`lvStat`, the charge - the shop services a
  strut for its aeroplane): the strut's two-point fit - the light aeroplane at 0.75 of the load then stands at 52 mm, the
  drawn pose of [F] at 47 mm.

### 4.3 The strut (DERIVED; gearOleoDesign, src/core/62c_gear_mech.js)

- **Piston 45 mm**: the chrome rod in [P] IMG_5526 is about a fifth of the tyre's 200 mm width.
- **Two stages, nitrogen over oil** (polot.net): stage 1 charged so the static pressure is **3.0 x** the extended one
  (light-aircraft practice); stage 2 comes in at **2.2 x** the static pressure, its volume such that the gas alone carries
  **3.0 x** the static wheel load at full stroke; **n = 1.3** (the gas compressed in a landing).
- **The orifice**: at the aeroplane's FAR 23.473(d) limit sink, the strut closes at the static motion ratio times the
  sink, and the orifice carries **0.5** of the strut's force at the limit load factor 2.67 (23.473(g)); **the rebound
  throttled 4 x** harder (the classic oleo's flapper valve); the seals **0.15** of critical on the static spring plus
  **5 %** of the static strut force as Coulomb friction (regularised under 5 mm/s).
- **The stops**: a spring of 3 x the gas's stiffness at full stroke cushions the first millimetres; past S the strut is
  STEEL - the solver holds it there as a constraint (30_solver oleoStop).

On the gate's Wilga-class host (§7.4, 1011 kg loaded): **17-18 bar extended, 54 bar static, stage 2 at 120 bar**; the
static strut force 8.6 kN per side. A light-aircraft oleo's static pressure is 40-120 bar.

---

## 5. What it does

**The wheel rate** (the host, one side, the parked attitude; wheel load over the static):

| wheel rise (mm) | 0 | 12 | 27 | 45 | 65 | 88 | 113 | 140 | 169 | 199 | 231 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| strut (mm) | 0 | 11 | 23 | 35 | 47 | 59 | 71 | 82 | 94 | 105 | 115 |
| motion ratio | 1.04 | 0.85 | 0.72 | 0.63 | 0.56 | 0.50 | 0.45 | 0.41 | 0.38 | 0.34 | 0.31 |
| load / static | 0.62 | 0.61 | 0.65 | 0.74 | 0.94 | 1.36 | 1.96 | 2.11 | 2.31 | 2.58 | 2.94 |

The **mechanical advantage** falls with the stroke (the levered geometry is REGRESSIVE: 1.04 -> 0.31) while the gas is
progressive, so the wheel's rate is nearly flat over the first 30 mm (0.61-0.65 of the load: the soft, long-legged ride
over small bumps), stiffens through the static point and climbs steeply into stage 2 - three times the static load at
full stroke from the gas alone. The orifice adds its share in a landing; the rebound valve keeps the aeroplane on the
ground after it.

**Measured** (GATE WILGAGEAR, the host): the static deflection at its loaded mass **72 mm** (the study's 70); the limit
drop with no wing lift absorbed in **110 of 115 mm**, 39.5 kN at most; the reserve drop (1.2 x) bottoms on the stop and
the gear stands again on its static stroke; after a 1.5 m/s landing the wheels never leave the ground, one compression,
one rebound, then dead-beat; the axle stays on its circle about the pivot to 1.4 mm and rises aft.

---

## 6. Mass and price

- **Mass (DERIVED, GEN_RULES.lever)**: per leg the forged arm with its spindle and bearings 4.5 kg, the strut 3.2 kg, the
  leg's fittings 2.5 kg, plus the leg's and the arm's members at the gear class's linear density. On the host the main
  pair weighs **52.5 kg** (the same airframe on the oleo row: 22.7), the gear's ledger 72.9 kg (38.9): inside the
  study's 4-6 % of the gross for a fixed gear (55-75 kg at 1300 kg; the main pair 45-60). No published gear mass.
- **Price (DERIVED)**: GEN_SUSPENSION.lever 5 400 credits - two struts at the oleo row's set price and the forged arms,
  pivots and bearings; the host's gear ledger 11 095 credits (the oleo row: 7 231).

---

## 7. In the game

### 7.1 One build path

- **The kinematics and the law** - `src/core/62c_gear_mech.js` GEAR_LEVER: `gearLeverRef` (the leg from its rows),
  `gearLeverAt` (the arm turned: the axle, the horn, the stroke, the rise), `gearLeverMR`, `gearOleoP` / `gearOleoSpring`
  / `gearOleoF` (the two-stage gas, the stops, the semi-implicit orifice, seals and friction), `gearOleoDesign` (the
  strut for its aeroplane), `gearNodeFrame` (a part's pose from three points). The garage, the frame, the solver and the
  flown drawing all read it.
- **The spec** - `gear.suspension: 'lever'` (GEN_SUSPENSION.lever) and `gear.lever { piv, horn, top, w, comp, dSt }`: the
  drawn leg in the frame's axes, relative to the axle at full extension (the join's measurement); absent, the frame
  builds the reference (GEN_RULES.lever). clampSpec keeps it only on a fixed wheeled gear.
- **The frame** (61) - per side the axle, the pivot's two bearing nodes, the horn H and the strut's upper eye U (tagged
  AXLE*: the damage layer's gear part); the leg's members to the body at 20 x the gear class's k and 0.1 x its damper
  (steel, not a spring), the arm (axle, pivot ends, horn) and the leg's foot (pivot ends, strut eye) as rigid clusters
  (shape matching: no snap-through, no bending, no substep cost);
  no axle bar; each strut designed on the final masses (parts.lever).
- **The solver** (30) - the oleo pass after the members (null on every other build), the steel stop after the step;
  `sim.oleo()`.
- **The garage** - the mains' leg row's fifth kind, **'trailing-link (Wilga type)'**, its eight rows (arm, its angle
  extended and at full stroke, the strut's eye up the leg, the axle ahead of the fitting, **the static deflection at gross
  = the charge**, the leg's fairing chord, the fitting round the body), the drawing (`tools/_gear_gen.js legLever`), the
  preview row **gearLvPos** (0 extended .. 1 full stroke - the editor's, never saved); the design tile's option
  'Trailing-link oleo (Wilga type)'.
- **The join** writes `gear.lever` from the drawn points; **the flight** (app.js) poses the leg, the arm and the strut's
  two halves each from three of its physics nodes (the affine map exact on them), the wheel on its axle node.

### 7.2 Saves and validated builds

Every new cage row is absent at its default (`CAGE_DEFAULT_ABSENT`, the core's `GEN_LEVER_ROW_OFF` for the
fingerprints); the preview is a view key (`CAGE_VIEW_KEYS`). **No saved build gains a key; every build in builds/ and
builds/candidates/ (30) builds and flies bit-identical** to master (the def and 2 s of node positions compared).
No version bump: no physics answer of an unchanged spec moved (PHYSICS_V), no migration (GEN_SPEC_V), no certificate rule
for an existing build (GEN_CERT_V; the certificate reads the oleo row's travel for a lever leg's members).

### 7.3 Damage, economy, gating

- **Damage**: the leg is one breakable part (`gearL:gear` / `gearR:gear`, its 9 joint members to the body); a joint
  letting go DROPS the leg with its arm, strut and wheel (the physics nodes leave, and the drawn parts ride them) - the
  crash says "the landing gear broke". G-EPZL's own mode, the arm off its spindle, is §9 Q4.
- **Economy**: the price and the mass above, on the gear's ledger section.
- **Gating**: `susp:lever` at tech stage 2 (the tricycle's); the garage's leg row gates the option.

### 7.4 GATE WILGAGEAR (tools/_wilga_gear_check.js, core, ~2 min)

On a **Wilga-class host**: the user's metal Cessna 172 airframe (high wing, four seats, 1.0 t loaded) flown as a
taildragger on the leg, the Wilga's 2.83 m track and 500 mm tyres. The checks: the geometry as
researched; the static deflection; the 23.725-style limit drop (no bottoming) and the reserve drop; no pogo; the
trailing arc; a broken leg drops; the drawn leg = the physics leg through the game's own load chain (the Cub on the
leg, s1Drop 0.85: the frame's nodes on the drawn points to 1e-16 m, the drawn arm and horn on the physics nodes through
a limit drop to 0.4 mm; the garage reddens a leg whose tyre meets the body at full stroke); the fairing (7.5: on the
Cub and on the host, the leg wears the boot and no wheel fairing; nothing that moves comes within 3 mm of the cut boot
through the stroke - 20 / 6.7 mm at the closest; the cylinder's body hidden; clampSpec agreeing); nothing else moved. Nine sections, 33 checks, ~2 min.

### 7.5 The fairing

The user, in turn: "an elegant fairing ... something robust that could go on many planes, but something that looks good
and that hides a bit of this huge mechanics"; "allow only a fairing for the leg, not the wheel"; "the little proper
cuts so the wheel articulation can move freely"; "closer to the bone ... a fairing that is directional"; then "a proper
professional 3D model": details, bolts and seams, a cap on what pokes out, other leg placements, the ground, the
aerodynamic profile, the first try's flare, and the Wilga itself.

**The reference** ([P] IMG_5504 / 5527 / 5525 / 5526): the Wilga's red leg tube IS the leading edge; a white flat-sided
fairing trails behind it and holds the strut, a line of screws down its side, a rounded cap at the root (the strut's
upper pin poking through near the top), the bottom cut square above the knuckle - the strut's black gaiter, its chrome
rod, the red arm and the pivot's red end cap bare below.

**No wheel fairing** on the trailing link: the spat / trousers row and its shape rows step aside on leg 4; the gear layer
draws none; the join and clampSpec write `gear.fairing 'none'`. The leg-fairing row (`s1LegFair`) is its fairing.

**One generator, three shapes** (`tools/_gear_gen.js leverBoot`; the new row **lvBoot, 'leg fairing shape'**, with the
leg-fairing row, absent at its default like every leg row): (0) **tapered**, (1) **flared** (the first try's: slim down the
leg, swelling into the knuckle, c = c0 + k t^3), (2) **trailing (Wilga)** - the leg a round tube, the leading edge, and a
flat-sided slab behind it closing over its last 30 % to a 3 mm trailing edge.
- **Directional**: every section CONTAINS THE FLIGHT DIRECTION (nose into the flight, chord along the airflow) and is
  square to the leg as seen from ahead. (Horizontal slices first: the leg's 55 deg splay cut obliquely gave a tube 0.35 m
  deep across the flow.)
- **The section** (0, 1): a strut fairing's "fish form" - an elliptic nose to the thickest point 40 % back, a long full
  tail to a fine point, 40 % thick. (A NACA 00xx was tried: its thin tail could hold the strut, 20 cm behind the leg, only
  on a 0.6 m chord.) Strut fairings sit at 25-50 % thickness, where their drag on the frontal area is flat.
- **Closest to the bone**: each slice (16 down the leg) finds its smallest section round what it must hide - the leg's
  tube, the strut's bracket lugs, the strut's cylinder over the whole stroke, each with 10 mm - by bisection on the chord
  and a golden search on its leading edge (exactly: the section is convex, so the slice's 2-D convex hull is what has to
  fit); then THE LEADING EDGE AND THE CENTRE ARE STRAIGHT LINES (least squares, the edge moved forward, whole, until every
  slice fits) and the chord the smallest straight (or t^3) law holding every slice.
- **The square-cut bottom** (the Wilga's): a 12 mm rounded rim and a flat floor just under the pivot. The strut leaves
  THROUGH THE FLOOR, cut round, its foot and gaiter bare below - the round toe it replaces was crossed by the strut
  through its side wall (the user's "little thing poking through").
- **The cuts**: the space everything that moves sweeps over the stroke - the arm, its horn, the horn's lugs, the axle's
  boss, the strut (rod and cylinder one part), the pivot, the tyre - capsules at 25 poses (GEAR_LEVER), a plain union per
  part, a 50 mm smooth minimum between parts, less 8 mm plus the sampling's own scallop; each cut edge bisected onto the
  contour; the lip a 2.5 mm RUBBER TRIM.
- **The details**: seams (1.5 mm dark ribbons 0.4 mm proud) down each side at the thickest point (the Wilga's screw line),
  round the root joint 10 cm under the fitting and round the lower service panel 10 cm above the floor; domed screw heads
  8.4 mm across along each (7 / 6 cm pitch), none on or by a cut - ~70-85 screws a leg.
- **The cache**: the boot is recorded on its inputs and replayed: ~35 ms a leg (a leg without the fairing: 34 ms); a
  leg-row edit rebuilds it in ~0.3-0.4 s (the first version took 4.6 s a leg, every redraw - measured and fixed: the
  convex hulls, a coarse pass of the cut field that only reads where it could matter, the field's hot path in plain
  arithmetic, a table for the section).

**Measured** (GATE WILGAGEAR 7b and a 45-case placement matrix - the host's fitting at 50 / 80 / 110 deg round the body x
drop 0.65 / 0.80 / 0.95 m x the three shapes; the Cub's fitting x axle reach 0.25 / 0.45 / 0.70 m x tapered / trailing):
every case builds clean (no layer error, no red row); nothing that moves comes within **9 mm** of the boot through the
stroke; **the ground**: at full stroke on a tyre flat to 0.6 R and pitched 10 deg nose-down (hard braking on the mains)
every boot stays **75 mm** or more above it (level: 134 mm or more) - the nose does not strike.

**What it is not yet**: the Wilga shape needs a 20-24 cm leg tube where the photographs show ~8 cm - our strut is skewed
~20 deg sideways (its upper eye on the leg's line, which leans inboard, its lower on the arm's horn) and swings sideways
over the stroke, where the Wilga's lies in the arm's plane. The same skew makes the other two shapes deep at the knuckle
(0.65 m of chord). §9 Q9.

---

## 8. What it costs

Measured in node on an idle machine, the frames interleaved, 600 frames each, parked (ms a frame; the VM's absolute speed
varies, the ratios are the figure):

| | without the leg | with the leg | |
|---|---|---|---|
| the Cub (its oleo / bungee row vs the leg, drop 0.85) | 97 nodes, 404 members, 75 substeps, 4.82-4.97 ms | 105, 429, 77, 5.36-5.43 ms | **+9-11 %** |
| the Wilga-class host (the oleo row vs the leg) | 111, 467, 142, 11.05-11.35 ms | 119, 492, 145, 11.86-13.0 ms | **+7-15 %** (its wing sets its step) |
| a build without the leg | | | one compare a substep; every build bit-identical |

Where it goes: the 8 nodes and 25 members of the two legs over the tripod and the axle bar they replace, 2-3 more
substeps (the leg's steel members on light nodes), the four rigid clusters (~4 % on the Cub), the oleo pass (two
struts: negligible).

**Drag** (62_gen_aero genGearCdA, a lever leg only): the two struts as 60 mm cylinders eye to eye (the drawn length,
0.50 m on the reference) at the leg's Cd - 1.0 bare, 0.30 under the boot. The host's gear CdA: the oleo row bare 0.139
m^2, the trailing link bare **0.199**, booted **0.111** (the oleo row faired 0.093; the calibration's delta clamps the two
faired builds alike at -0.08). The fairing's mass and price are the leg-fairing row's (+5 kg on the host); the trailing
link never carries a wheel fairing.

**The fairing's drawing**: one boot a leg, ~4 500 triangles and ~70-85 screws; 35 ms a leg replayed from its cache,
0.3-0.4 s when a leg row changes (§7.5).

## 9. Open questions (each with its default)

1. **The strut's stroke, charge pressures, oil and orifice** (the IOT's servicing table). Default: §4's derivation
   (115 mm, 17 / 54 / 120 bar on the host, the orifice for the 23.473 sink). When the manual's figures are found, they
   go in GEN_RULES.lever and the gate's §1-§2 bands move with them.
2. **The extended and full-stroke arm angles** (62 / 12 deg). Default: §4.2. A side photograph of a Wilga on jacks would
   settle the first.
3. **The strut's upper eye** (0.18 m up the leg). Default: §4.1 (the measured eye toggles). A dimensioned drawing (the
   MMP Single No. 46/47 plans) would settle it.
4. **The G-EPZL failure** - the arm leaving its spindle while the upper leg stays (AAIB: it then dug in and flipped the
   aeroplane). Default: the whole leg is one breakable part; a separate arm-off break group (the spindle's bolt and welds
   as the joint, loaded axially by the strut's skew) is a follow-up for the DMG owner.
5. **The strut's skew** ([A]: "not exactly perpendicular to the pivot axis"). Default: the strut lies in the arm's plane
   but for the measured lateral offsets of its eyes (0.173 / 0.165 m inboard - a 1 deg skew); the axial load on the
   spindle is carried by the pivot's members, not reported.
6. **The tailwheel's rocker and small oleo**. Default: the game's own tailwheel kinds (the steerable wheel on its leaf
   spring); a lever tailwheel on the same GEAR_LEVER is a natural follow-up.
7. **Tyre pressure**. Default: the game's tyre law by the wheel's radius (the 500 x 200's 0.20 MPa rated [S] is not a
   game input).
8. **The boot's own drag and mass** (its chord grows to ~0.65 m at the knuckle). Default: the leg-fairing row's figures
   and the struts' term at the faired Cd (§8); a boot-sized wetted area is a refinement for the drag owner.
9. **The strut's skew** (found with the fairing): our strut's upper eye sits on the leg's line, which leans inboard, so
   the strut runs ~20 deg sideways to the arm's horn and swings sideways over the stroke; the photographs show the
   Wilga's strut in the arm's plane, its upper pin near the top of the fairing (a long strut). Default: as derived (§4.1);
   moving the upper eye's bracket outboard into the arm's plane (and up) re-designs the strut and would let the Wilga
   shape be the photographs' slim slab. The user's call.
10. **A Wilga card** in the garage (an archetype matched to a reference model, tools/REF_MATCH.md). Default: none in this
   chantier ("touch only what the gear needs"); the gate's host stands in.

---

## 10. Pictures

`reports/evidence/WILGA-GEAR/` (rendered in the cloud with tools/quickshot.js and tools/quick_view.js; no in-game
renderer): the leg at rest and compressed in the garage, the Wilga-class host, the rough-strip landing's
compression sequence drawn from the physics, and the fairing with its cuts at rest and at full stroke. See the HANDOVER entry for the list.
