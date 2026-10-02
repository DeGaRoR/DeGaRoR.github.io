# PERF STUDY — the recreation cards against the real aeroplanes (2026-09-15)

`node tools/perf_study.js` (the bench; `--fly=cub,jodel` adds the pilot's own
take-off, climb and landing; `--md=` writes the table). Every "ours" number is
MEASURED off the built aeroplane — the shakedown's probes swept over speed for
the level-flight balance, `genTORunAt` for the roll — never read off a rule.
Every "real" number is a POH / type-sheet value as commonly published (sea
level, ISA, MTOW; Vs1 flaps up, power off; approximate to 5 %). Cards whose
engine is not the type's are flagged and their power-bound numbers are not
ranked.

## 1. The indicators

What a POH prints, and what each one tests in the model:

| indicator | tests |
|---|---|
| empty weight | the frame's mass model (structure, engine, systems) |
| S, span | the card's fidelity to the type |
| T0 / W | the propeller's static thrust (the registry's anchor) |
| Vs1 | the wing's CLmax x area against the mass |
| V75, Vmax | the drag polar (parasite + induced) against the thrust curve |
| ROC at Vy | the power balance: (T − D) V / W over the sweep |
| L/D best | the polar's shape |
| TO ground roll | Vs, the unstick speed, the thrust, the rolling drag |
| landing roll | (flown only) the approach speed and the brakes |

The cards are loaded toward MTOW with freight before the power-bound numbers
are read (a lighter card stalls slower, climbs faster and rolls shorter for
the mass alone). NOTE: the cargo bay's clamp caps that load — the four big
cards (172, Beaver, Caravan, DA62) stayed 10-57 % under MTOW and their Vs /
ROC / TO deltas carry that; read their EMPTY column instead, which is the real
finding for them.

## 2. The table

| card | real aeroplane | empty kg (real) | as baked / at MTOW kg | S m² | T0/W | Vs km/h | V75 km/h | Vmax km/h | ROC m/s | L/D | TO roll m | TO 50 ft m |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| cub | Piper J-3C-65 Cub | 331 / 345 (-4 %) | 481 / 549 | 14.7 / 16.6 (-12 %) | 0.22 / 0.22 | 70 / 61 (15 %) | 126 / 120 (5 %) | 146 / 140 (4 %) | 2.3 / 2.3 (-2 %) | 8.9 / 9.5 (-7 %) | 224 / 113 (98 %) | 327 / — (—) |
| pietenpol | Pietenpol Air Camper (A-65) | 326 / 280 (16 %) | 491 / 491 | 12.9 / 14.6 (-12 %) | 0.25 / 0.26 | 71 / 56 (26 %) | 123 / 120 (3 %) | 144 / 137 (5 %) | 2.5 / 2.5 (1 %) | 8.0 / 8.0 (-1 %) | 230 / 120 (92 %) | 342 / — (—) |
| tigermoth | DH.82 Tiger Moth (Gipsy Major 130 hp) (engine differs) | 506 / 506 (0 %) | 657 / 827 | 23.7 / 22.2 (7 %) | 0.15 | 70 / 72 (-3 %) | — / 145 (—) | 114 / 175 (-35 %) | 0.3 / 3.2 (-91 %) | 8.3 / 8.0 (4 %) | 389 / 150 (159 %) | 561 / — (—) |
| stearman | Boeing-Stearman PT-17 (R-670 220 hp) (engine differs) | 786 / 878 (-10 %) | 993 / 1232 | 28.8 / 27.6 (4 %) | 0.45 | 77 / 87 (-11 %) | 230 / 170 (35 %) | 256 / 200 (28 %) | 11.0 / 4.3 (156 %) | 8.7 / 7.5 (16 %) | 80 / 180 (-56 %) | 113 / — (—) |
| jodel | Jodel D.119 (O-200) | 374 / 360 (4 %) | 539 / 649 | 12.3 / 12.7 (-3 %) | 0.24 / 0.25 | 84 / 68 (24 %) | 154 / 175 (-12 %) | 177 / 200 (-12 %) | 3.3 / 3.5 (-7 %) | 9.3 / 11.0 (-15 %) | 248 / 200 (24 %) | 352 / — (—) |
| c172 | Cessna 172R (IO-360-L2A 160 hp) | 412 / 736 (-44 %) | 597 / 997 | 15.2 / 16.2 (-6 %) | 0.25 / 0.21 | 94 / 87 (8 %) | 181 / 218 (-17 %) | 207 / 230 (-10 %) | 4.0 / 3.7 (7 %) | 9.3 / 9.0 (3 %) | 247 / 288 (-14 %) | 345 / — (—) |
| caravan | Cessna 208 Caravan (PT6A-114A 675 shp) | 558 / 2145 (-74 %) | 1158 / 1559 | 23.8 / 26.0 (-8 %) | 0.56 | 94 / 144 (-35 %) | 282 / 324 (-13 %) | 304 / 340 (-11 %) | 17.2 / 5.0 (243 %) | 11.3 / 11.0 (3 %) | 90 / 354 (-75 %) | 125 / — (—) |
| rv | Van's RV-7 (IO-360 180 hp) | 435 / 500 (-13 %) | 600 / 816 | 12.4 / 11.2 (11 %) | 0.30 | 94 / 93 (2 %) | 194 / 310 (-37 %) | 218 / 340 (-36 %) | 5.7 / 8.0 (-29 %) | 9.3 / 11.0 (-16 %) | 187 / 150 (25 %) | 261 / — (—) |
| savannah | ICP Savannah S (Rotax 912 100 hp) | 302 / 300 (1 %) | 428 / 599 | 13.3 / 13.0 (3 %) | 0.22 | 77 / 52 (48 %) | 131 / 160 (-18 %) | 156 / 190 (-18 %) | 2.2 / 5.0 (-56 %) | 8.2 / 9.0 (-9 %) | 238 / 60 (297 %) | 345 / — (—) |
| mw5 | Whittaker MW5 Sorcerer (Rotax 503) (engine differs) | 283 / 160 (77 %) | 377 / 377 | 13.6 / 12.1 (13 %) | 0.30 | 61 / 48 (26 %) | 110 / 90 (22 %) | 128 / 105 (21 %) | 3.0 / 3.0 (-1 %) | 7.0 / 8.0 (-12 %) | 87 / 80 (9 %) | 130 / — (—) |
| da62 | Diamond DA62 (2 x AE330 180 hp) (engine differs) | 652 / 1600 (-59 %) | 837 / 1237 | 17.7 / 17.1 (3 %) | 0.40 | 98 / 143 (-32 %) | 233 / 315 (-26 %) | 256 / 350 (-27 %) | 9.8 / 5.2 (89 %) | 10.9 / 12.0 (-9 %) | 139 / 500 (-72 %) | 193 / — (—) |
| beaver | DHC-2 Beaver (R-985 450 hp) | 660 / 1361 (-52 %) | 866 / 1266 | 28.5 / 23.2 (23 %) | 0.44 | 77 / 111 (-31 %) | 246 / 222 (11 %) | 271 / 260 (4 %) | 11.8 / 5.2 (126 %) | 11.3 / 9.0 (26 %) | 87 / 170 (-49 %) | 122 / — (—) |

Mean signed error over the eight engine-matched cards: TO roll +50 % (spread
−75..+297), ROC +36 % (−56..+243), empty weight −21 % (−74..+16), Vs +7 %
(−35..+48), V75 −10 % (−37..+11), Vmax −9 %, L/D −2 %, S −1 %, T0 0 % (n 4,
±5).

## 3. What is honest

- **Static thrust.** T0 matches on every card where a real figure exists (Cub
  1202 N vs ~1200; ±5 %). The registry's P^(2/3) D^(2/3) anchor holds. (The
  582's IVO reads 15-25 % low against the maker's claim — G396's note.)
- **The power balance on the fabric-and-strut family.** Cub: V75 +5 %, Vmax
  +4 %, ROC −2 %, L/D −7 %. Air Camper: +3 / +5 / +1 / −1 %. Jodel: −12 / −12
  / −7 / −15 %. Where the mass and the wing are right, the aeroplane flies the
  POH within 10 %.
- **The polar's shape.** L/D within ±15 % everywhere the wing matches; the
  NACA 2412 polar (Cl0 0.153, a3d 4.23/rad, CLmax 1.48 at 18 deg in 3D) is a
  2412.
- **Empty weight on the EAB / ULM classes.** Cub −4 %, Jodel +4 %, Savannah
  +1 %, Tiger Moth 0 %, Stearman −10 %, RV −13 %.

## 4. The discrepancies, ranked, and their causes

### 4.1 The mass model does not scale with the aeroplane (−44 to −74 % on the n23 class; +77 % on the MW5)

The ledgers (kg):

| card | fuselage | wings | bracing | tail | gear | engines | outfit+elec+panel+avionics |
|---|---|---|---|---|---|---|---|
| cub (real empty 345) | 43 | 65 | 25 | 18 | 27 | 87 | 55 |
| c172 (real 736) | 43 | 68 | 28 | 19 | 29 | 146 | 67 |
| beaver (real 1361) | 47 | 112 | 36 | 30 | 30 | 304 | 83 |
| caravan (real 2145) | 46 | 92 | 35 | 25 | 36 | 178 | 119 |
| mw5 (real 160) | 37 | 64 | 24 | 18 | 34 | 49 | 52 |

The FUSELAGE weighs 43-47 kg on every card from the Cub to the Caravan. The
frame bills structure as linear density x length (`61_gen_frame.js` B():
`row(MM.lin, cls)`), and the linear density is a constant per material and
member class — the tube GAUGE never grows with the aeroplane, while the
STIFFNESS does (`kScale` = (mass/refMass)^0.85). A Caravan's cabin is built
of the Cub's tube. The wing (64-112 kg) and the gear (25-36 kg) follow the
same rule; a 172's wing is ~110 kg real, a Caravan's ~350, a Beaver's ~300; a
172's gear ~50, a Caravan's ~100. Systems (outfit, elec, panel, avionics:
55-119 kg) are right for a light aeroplane and half of a certified
four-seater's (interior, IFR panel, vacuum, heating: 150-250 kg). On the other
end the MW5-alike (a 160 kg-empty microlight) carries a 64 kg wing and 52 kg
of systems.

This is the biggest single error in the model and it cascades into every
dynamic number of the big cards: at their real mass the Caravan-alike and the
Beaver-alike would stall, climb and roll like their types (Vs scales as
sqrt(m): Caravan 94 -> 143 km/h at 3629 kg, real 144; Beaver 77 -> 104, real
111; DA62 98 -> 134, real 143).

FIX (a chantier, the frame's): component weights that follow the design load,
the way every preliminary-design method does (Raymer / Torenbeek / Nicolai
class equations, or the same thing derived — the spar sized by the bending
moment at the ultimate load factor, the fuselage tube gauge by the class's
gross, the gear at 4-6 % of MTOW, the systems by class: 4-6 % of empty for an
ULM, 15-25 % for a certified four-seater). The stiffness already scales with
the mass; the mass must scale with the load.

### 4.2 Clean airframes carry a fabric-and-struts drag (V75 −12..−37 %)

Parasite drag area at cruise (the probe in level flight, the induced part
removed):

| card | ours CdS m² | real (from 75 % power at V75, prop eff 0.75) |
|---|---|---|
| cub | ~0.77 | ~0.7-0.8 |
| jodel | ~0.60 | ~0.45 |
| c172 | ~0.68 | ~0.45-0.50 |
| rv | ~0.68 | ~0.20 |

The Cub is right. The Jodel is +27 %, the 172 +50 %, the RV-alike +240 %: the
RV-alike, a cantilever alloy low-wing with a bubble and spats, cruises at 194
km/h where the type does 310 — it carries a Cub's drag. The drag build-up
(the exposed members', the fuselage's, the gear's, the cooling's) does not
discriminate construction: it is anchored on the tube-and-fabric strutted
family and stays there when the tubes are inside a skin, the struts are gone
and the gear is spatted.

FIX: a wetted-area x skin-friction basis (Cf 0.004-0.006 per m² of smooth
alloy or composite, 0.008-0.012 for fabric over tubes, form factors by
thickness, interference by the junction count) with the exposed members
(struts, legs, wires, exhausts, a radial) ADDED, instead of a fixed airframe
drag with the members on top. The Cub must still come out at 0.75 m²; the RV
at 0.2.

### 4.3 The taildraggers unstick at 1.2-1.3 Vs (TO roll +90..+100 % on the Cub and the Air Camper)

`genTORunAt`: Vun/Vs = 1.29 (Cub), 1.21 (Jodel), 1.24 (Beaver), 1.12 (172),
1.10 (RV). A real Cub leaves the ground at 1.05-1.10 Vs in the three-point
attitude. Ours sits at −9.4 deg on its tailwheel (the real J-3: −11.5) with
1.5 deg of incidence, and its wing is a NACA 2412 (α0 −2.1 deg) where the
J-3's USA 35B is 4.5 % cambered (α0 ≈ −5 deg): at the ground attitude our
wing makes CL 1.0 of a 1.48 max where the type makes 1.45 of 1.7. The roll
goes as (Vun/Vs)² x (Vs/Vs_real)²: the Cub's 224 m against 113 is
(1.29/1.08)² x (70/61)² = 1.9. The same on the water (G396.3: the pitch on
the step is elevator-limited and the twin card unsticks at 1.45 Vs).

FIX: the card's airfoil and stance first (4.4); then the pilot's rotation at
Vr for a taildragger (it holds the tail-up attitude and lets the aeroplane
fly off) and a look at the ground-effect lift near the stall.

### 4.4 Card fidelity (cheap, and they hide behind 4.1-4.3)

- Cub-alike: S 14.7 vs 16.6 m² (−12 %), span 9.8 vs 10.7; the wing is the
  class default, not the J-3's 10.7 x 1.6 m; the airfoil 2412 for a USA 35B
  (4.5 % camber). Vs +15 % at MTOW from the area alone.
- Air Camper-alike: S −12 %, Vs +26 %, the same story.
- Savannah-alike: Vs +48 %, TO roll +297 %: the type's slats and big flaps
  (CLmax ~2.2) do not exist in the wing model (no leading-edge device).
- Beaver-alike: S +23 % (28.5 vs 23.2).
- The Tiger Moth-alike, Stearman-alike, DA62-alike and MW5-alike fly the
  wrong engine (A-65 for a Gipsy Major, R-985 for an R-670, IO-360 for an
  AE330, 582 for a 503): their power numbers are not comparable until the
  registry has those rows.

### 4.5 Study limits

- The load to MTOW is capped by the cargo bay's clamp; the big cards were
  measured 10-57 % light. Ballast on the cabin nodes would remove that.
- "75 % power" is taken as 75 % of the prop's thrust at the speed, which is
  the fixed-pitch convention within a few percent.
- Real numbers are book values; POH numbers themselves scatter ±5 % by
  edition.

### 4.6 Flown, the pilot (Cub, Jodel, 172 at the ballasted mass)

| card | TO run m (ours / real) | climb m/s at VClimb (ours / real ROC) | cruise km/h at thr | landing roll m (ours / real) |
|---|---|---|---|---|
| cub | 291 / 113 (+158 %) | 1.7 / 2.3 (−27 %) | 112 at 0.75 (real 120) | 239 / 88 (+172 %) |
| jodel | 283 / 200 (+42 %) | 2.5 / 3.5 (−28 %) | 141 at 0.75 (real 175) | 216 / 150 (+44 %) |
| c172 | 326 / 288 (+13 %) | 3.3 / 3.7 (−11 %) | 167 at 0.72 (real 218) | 33 / 168 (the record is suspect) |

The flown take-off run is longer than the analytic one (Cub 291 vs 224:
the pilot rotates at Vr and unsticks at 1.4 Vs); the flown climb is 25 %
under the probe's best (the pilot climbs at VClimb = 1.38 Vs, not at Vy,
and it is a full-thrust hold, not a trimmed climb); the cruise at 0.75 of
thrust reproduces the probe sweep (Cub 112 vs 126 probe / 120 real). THE
LANDING ROLL is the flown number furthest out: the Cub stops in 239 m
where the type does 88 — the approach at 1.42 Vs, a long hold-off and a
gentle brake law (a bungee taildragger's), and the 172's 33 m is not a
roll a 1000 kg aeroplane makes from 20 m/s (the landing record's own
datum, to be checked — the pilot session's).

## 5. Order of work

1. THE MASS MODEL (4.1) — the frame's, the largest; every big card is wrong
   until it lands.
2. THE DRAG BUILD-UP (4.2) — the aero's; the clean cards are 30-70 % slow.
3. THE CARDS (4.4) — an afternoon: wing sizes, airfoils, the four engines.
4. THE UNSTICK (4.3) — the pilot's and the polar's, after 3.
5. High-lift devices for the STOL cards.
6. The landing: the approach speed and the brake law (4.6), and the landing record's datum.

## 6. THE CHANTIERS LANDED (2026-09-15, G428-G431) — the table re-measured

Four chantiers in the plan's order: the instrument and the cards (G428), the
mass model (G429), the drag build-up (G430), the unstick (G431). Every
"ours" below is the JOINED spec — the card as the game flies it
(tools/_bake_joined.js: the join's measured cabin, seats, profile, gear and
tail over the birth spec; §2 flew the birth spec on GEN_DEFAULT's Cub cabin)
— loaded to MTOW at its own CG through the G121 door (§2 had the cargo
clamp at 400 kg). `node tools/perf_study.js`; `--birth` for §2's road.

| card | real aeroplane | empty kg (real) | as baked / at MTOW kg | S m² | T0/W | Vs km/h | V75 km/h | Vmax km/h | ROC m/s | L/D | CdS m² | TO roll m | TO 50 ft m |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| cub | Piper J-3C-65 Cub | 354 / 345 (3 %) | 486 / 550 | 16.4 / 16.6 (-2 %) | 0.23 / 0.22 | 65 / 61 (7 %) | 126 / 120 (5 %) | 145 / 140 (4 %) | 2.4 / 2.3 (5 %) | 9.4 / 9.5 (-1 %) | 0.78 / 0.75 (4 %) | 122 / 113 (8 %) | 185 / — (—) |
| pietenpol | Pietenpol Air Camper (A-65) | 339 / 280 (21 %) | 482 / 482 | 12.9 / 13.5 (-5 %) | 0.26 / 0.26 | 68 / 56 (22 %) | 143 / 120 (19 %) | 162 / 137 (18 %) | 3.2 / 2.5 (30 %) | 9.2 / 8.0 (15 %) | 0.58 / — (—) | 131 / 120 (9 %) | 195 / — (—) |
| tigermoth | DH.82 Tiger Moth (Gipsy Major 130 hp) | 574 / 506 (13 %) | 736 / 828 | 23.7 / 22.2 (7 %) | 0.24 | 69 / 72 (-4 %) | 146 / 145 (1 %) | 170 / 175 (-3 %) | 3.0 / 3.2 (-7 %) | 8.7 / 8.0 (8 %) | 0.96 / — (—) | 144 / 150 (-4 %) | 209 / — (—) |
| stearman | Boeing-Stearman PT-17 (R-670 220 hp) | 894 / 878 (2 %) | 1139 / 1232 | 28.8 / 27.6 (4 %) | 0.27 | 77 / 87 (-11 %) | 158 / 170 (-7 %) | 183 / 200 (-9 %) | 3.7 / 4.3 (-14 %) | 7.9 / 7.5 (6 %) | 1.34 / — (—) | 150 / 180 (-17 %) | 217 / — (—) |
| jodel | Jodel D.119 (O-200) | 348 / 360 (-3 %) | 495 / 650 | 12.3 / 12.7 (-3 %) | 0.25 / 0.25 | 84 / 68 (24 %) | 182 / 175 (4 %) | 203 / 200 (2 %) | 4.4 / 3.5 (26 %) | 11.4 / 11.0 (3 %) | 0.46 / 0.45 (2 %) | 154 / 200 (-23 %) | 218 / — (—) |
| c172 | Cessna 172R (IO-360-L2A 160 hp) | 640 / 736 (-13 %) | 904 / 1111 | 16.3 / 16.2 (0 %) | 0.22 / 0.21 | 95 / 87 (9 %) | 203 / 218 (-7 %) | 230 / 230 (0 %) | 4.0 / 3.7 (7 %) | 11.0 / 9.0 (22 %) | 0.56 / 0.47 (19 %) | 222 / 288 (-23 %) | 311 / — (—) |
| caravan | Cessna 208 Caravan (PT6A-114A 675 shp) | 1179 / 2145 (-45 %) | 2099 / 3629 | 23.1 / 26.0 (-11 %) | 0.24 | 143 / 144 (-1 %) | 282 / 324 (-13 %) | 308 / 340 (-9 %) | 5.6 / 5.0 (13 %) | 12.3 / 11.0 (11 %) | 0.70 / 0.57 (22 %) | 470 / 354 (33 %) | 646 / — (—) |
| rv | Van's RV-7 (IO-360 180 hp) | 484 / 500 (-3 %) | 699 / 816 | 12.4 / 11.2 (11 %) | 0.30 | 93 / 93 (-0 %) | 240 / 310 (-23 %) | 263 / 340 (-23 %) | 7.3 / 8.0 (-8 %) | 12.5 / 11.0 (14 %) | 0.38 / 0.20 (90 %) | 188 / 150 (25 %) | 257 / — (—) |
| savannah | ICP Savannah S (Rotax 912 100 hp) | 370 / 300 (23 %) | 509 / 600 | 13.3 / 13.0 (3 %) | 0.24 | 77 / 52 (47 %) | 144 / 160 (-10 %) | 166 / 190 (-13 %) | 2.7 / 5.0 (-45 %) | 8.7 / 9.0 (-3 %) | 0.63 / — (—) | 172 / 60 (187 %) | 246 / — (—) |
| mw5 | Whittaker MW5 Sorcerer (Rotax 503) | 213 / 160 (33 %) | 308 / 308 | 13.6 / 12.1 (13 %) | 0.34 | 55 / 48 (14 %) | 100 / 90 (12 %) | 116 / 105 (10 %) | 3.2 / 3.0 (5 %) | 6.7 / 8.0 (-16 %) | 1.17 / — (—) | 67 / 80 (-16 %) | 103 / — (—) |
| da62 | Diamond DA62 (2 x AE330 180 hp) (engine differs) | 973 / 1600 (-39 %) | 1324 / 2300 | 17.8 / 17.1 (4 %) | 0.21 | 129 / 143 (-10 %) | 237 / 315 (-25 %) | 264 / 350 (-25 %) | 4.2 / 5.2 (-18 %) | 12.1 / 12.0 (1 %) | 0.68 / — (—) | 425 / 500 (-15 %) | 582 / — (—) |
| beaver | DHC-2 Beaver (R-985 450 hp) | 1115 / 1361 (-18 %) | 1494 / 2313 | 23.2 / 23.2 (0 %) | 0.24 | 115 / 111 (3 %) | 238 / 222 (7 %) | 267 / 260 (3 %) | 5.2 / 5.2 (-0 %) | 11.0 / 9.0 (22 %) | 0.90 / 0.80 (12 %) | 444 / 170 (161 %) | 628 / — (—) |

Mean signed error over the eleven engine-matched cards (§2's eight in
brackets): empty +1 % (−21), V75 −1 % (−10), Vmax −2 % (−9), ROC +1 %
(+36), L/D +7 % (−2), Vs +10 % (+7), TO roll +31 % (+50), CdS +25 % (new),
S +2 % (−1), T0 +2 % (0).

Flown (the pilot, at MTOW): cub TO run 162 m (§4.6: 291; real 113), climb
2.1 / 2.3, cruise 117 km/h at 0.75 (real 120), landing 197 (239; real 88);
jodel 198 / 200, climb 3.9 / 3.5, landing 296; c172 391 / 288, climb 2.9 /
3.7; rv 295 / 150, climb 5.7 / 8.0. The Cub-alike unsticks at 1.16 Vs (was
1.38), the 172-alike at 1.16 (was 1.27 — and 1.36 nose-down on the drawn
trike gear before its stance was set).

What each chantier moved is in HANDOVER G428-G431. WHAT IS LEFT, ranked:
1. The RV-alike's wing row (V75 240 / 310; CdS 0.38 / 0.20): genPolar's
   `0.0055 + 0.018 t + matCd0` reads 0.0089 on a smooth alloy 2412 where
   the section runs 0.0065-0.0070 — GEN_SURF_MATERIALS.cd0, its own
   measurement.
2. The build standard: an alloy ULM (Savannah +23 %, MW5 +33 %) is built
   ~35 % lighter than a certified alloy aeroplane of its size (0.4 mm
   skins, no fatigue life) — a row seeded by the class at birth, as
   systems.fit is; the load test would read it too. The Caravan-alike
   (−45 %) is the utility category's equipment (cargo floor, pod, de-ice,
   oxygen, an interior for ten) the outfit has no rows for.
3. The landing (the Cub-alike 197 m where the type does 88): the approach
   at 1.42 Vs, the hold-off, the brake law — a pilot session's.
4. The STOL cards' slats (Savannah Vs +47 %, TO +200 %): no leading-edge
   device in the wing model.
5. The Beaver-alike's roll (439 / 170) is a flaps-up figure against a
   flapped POH one; the trike's squat under ballast (the joined 172-alike
   sits 3 deg nose-down with 210 kg on its own springs).
