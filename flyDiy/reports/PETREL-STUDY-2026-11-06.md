# The Super Petrel LS against the real one (HULL-B54, 2026-11-06)

The build: `builds/candidates/superpetrel_2026-11-06_b54.json` (hull_matrix `classic:superPetrel`, saved with `--fitonly=1 --nofit=1 --save=`).
The method: the perf study's own (`node tools/perf_study.js --build=<file> --vs=petrel`), the G396.5 rules - sea level ISA, ballasted to MTOW (600 kg) at its own CG, every "ours" measured; the `petrel` row in `REAL` (perf_study.js) cites the maker's and the web summaries' figures, APPROXIMATE until the POH is read. The water run is hull_matrix's (`--nofit`, two aboard and 72 L, 550 kg): the perf study's TO roll is a land run and this card has no wheels (NOT on its wheels in the build check).

## Water (hull_matrix, 550 kg)

Settles at trim 0.7 deg, the propeller dry; AIRBORNE 25.1 s at 24.5 m/s; hump R/W 0.213 at 8.9 m/s; swing 2.6 deg, roll 1.4; 0 breaks - FLIES. Static thrust over weight 0.26 against the hump's 0.213: no longer marginal (B50: 0.193 vs 0.191). GATE HYDROTRIM's bands for comparison: lift-off 18-36 s (in), hump R/W 0.12-0.21 (0.213: a hair over).

## Air (perf_study, 600 kg)

| card | real aeroplane | empty kg (real) | as baked / at MTOW kg | S m² | T0/W | Vs km/h | V75 km/h | Vmax km/h | ROC m/s | L/D | CdS m² | TO roll m | TO 50 ft m |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| petrel_b54.json | Super Petrel LS (912 iS) | 338 / 320 (6 %) | 550 / 600 | 14.5 / 15.0 (-3 %) | 0.26 | 75 / 68 (11 %) | 162 / 160 (1 %) | 184 / 180 (2 %) | 3.9 / 5.1 (-24 %) | 9.7 / — (—) | 0.61 / — (—) | 725 / — (—) | 782 / — (—) |

```

DIMENSIONS (ours / Super Petrel LS (912 iS); ours at MTOW 600 kg, ballast 50 kg):
  engine     Rotax 912 iS 99 hp 64 kg, prop Warp Drive 3-pale 1.73 m 1.60 m   / 100 hp 64 kg, prop — m
  fuselage   carbon, hull gear, 2 seats / 2
  length m (eng flange-rudder TE)   5.63 /   6.25  -10 %
  height m                         2.29 /   2.25  2 %
  span m                           9.16 /   8.90  3 %
  area m2                          14.5 /   15.0  -3 %
  AR                                5.8 /      —  —
  root chord m                     1.00 /      —  —
  tip chord m                      1.00 /      —  —
  dihedral deg                      0.0 /      —  —
  incidence deg                     4.0 /      —  —
  washout deg                       1.5 /      —  —
  flap max deg                       40 /      —  —
  flap span frac                   0.50 /      —  —
  stab span m                      2.70 /      —  —
  stab area m2                     2.07 /      —  —
  fin area m2                      1.16 /      —  —
  track m                          2.54 /      —  —
  wheelbase m                      1.81 /      —  —
  cabin width m                    1.19 /      —  —
  fuel L                             72 /     90  -20 %
  wing load kg/m2 at MTOW          41.4 /   40.0  4 %
  power load kg/hp at MTOW          6.1 /    6.0  1 %

BUILD CHECK (the bench, headless; as baked 550 kg):
  stance     NOT on its wheels (rests on HLK), deck 0.0 deg, suspension travel 0 mm, nose-over — deg, power-over 0.00
  balance    CG 24 % MAC, static margin 13 % (NP 36 % MAC), stab trim 1.0 deg, Cn-beta 0.105, d(eps)/d(a) 0.56
  shake      FLIES A CIRCUIT: Vs 72 km/h, cruise 152 km/h at thr 0.65, climb 4.17 m/s, TO 731 m, L/D best 9.7 at 99 km/h, 99 hp, 5.6 kg/hp
  sandbags   HELD: limit 3.95 % of semispan, ultimate 5.91 %, worst member 16 % of yield (wing)
  hot & high WORKS HOT AND HIGH: 1614 m DA, TO 799 m, climb 3.20 m/s, service ceiling 5958 m
  ledger     fuselage 45, engines 78, wings 73, bracing 19, stol 2, tail 12, gear 34, cabin 160*, vessel 6, fuel 52*, panel 8, elec 19, avionics 3, outfit 29, furnish 4, paint 6, cargo 0*  (* payload; empty 338 kg)
  systems    asi 0.4, alt 0.5, vsi 0.4, ai 1.1, aiE 1.0, dg 1.2, turn 0.7, tacho 0.5, gmeter 0.5, oilP 0.2, oilT 0.2, fuel 0.6, fuelSight 0.1, volts 0.1, clock 0.3, hobbs 0.1, compass 0.3, battery:lead 7.0, alternator:alt60 4.5, starter:yes 4.0, vac:pump 1.2, com:compact 1.0, xpdr:modeS 0.7, nav:vor 1.6, harness 2.4
  drag       CdS fit 0.612 m2 (induced k 148124)  fusCdA 0.472  gear -0.080  brace 0.060  swet 15.538 L 5.237 frontal 1.798 vol 3.774 f 3.461 FF 2.456 boxK 1.058 cdWet 0.004 body 0.182 cool 0.019 heads 0.000 screen 0.010 junct 0.033 exh 0.006 gear 0.105 brace 0.083 axial 0.472

RANKED DISCREPANCIES (engine-matched cards, |ours/real - 1|):
   -24 %  build     ROC     ours 3.9  real 5.1
  +  11 %  build     Vs      ours 75.3  real 68.0
  +   6 %  build     empty   ours 338.5  real 320.0
    -3 %  build     S       ours 14.5  real 15.0
  +   2 %  build     Vmax    ours 184.0  real 180.0
  +   1 %  build     V75     ours 161.9  real 160.0

BY INDICATOR (mean signed error over the engine-matched cards):
  ROC      -24 %  (n 1, spread -24..-24)
  Vs        11 %  (n 1, spread 11..11)
  empty      6 %  (n 1, spread 6..6)
  S         -3 %  (n 1, spread -3..-3)
  Vmax       2 %  (n 1, spread 2..2)
  V75        1 %  (n 1, spread 1..1)
```

## Reading

- V75 +1 %, Vmax +2 %, wing loading +4 %, power loading +1 %: the cruise end matches.
- Empty +6 % (338 vs 320 kg): inside GATE WEIGHT's +-15 % band; the ledger above.
- Vs +11 % (75 vs 68 km/h): 37 kt at 600 kg on 15 m2 is CL 1.80 - high for a NACA 2412 biplane; ours is CL 1.48 at 14.5 m2. The perf study's standing remark ("our stall speeds are always too high") and the Jodel ruling apply; the brochure figure may be light or indicated. To read from the POH (weight, flaps).
- ROC -24 % (3.9 vs 5.1 m/s): the low end of the 1000-1400 fpm range at gross was taken; to confirm the weight the maker quotes it at.
- Length -10 %: the study measures from the engine's flange (a pusher's is aft of the bow) - not the type's nose-to-rudder length; read with care.
- Wing area 14.5 vs 15.0: a lower-wing chord of ~0.87 would close it (and lower Vs ~2 %).
- The card carries the Cessna base's flaps (40 deg, half span): to check whether the Petrel has flaps.
