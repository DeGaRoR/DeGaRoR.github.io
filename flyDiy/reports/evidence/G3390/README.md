# G3390 — the corrected 172R on Wipaire's exact float does not leave the water (a realism bug)

RUFUS-CERT for A0, 20 Oct 2026. Branch `claude/hydro-trim-rig` (tools + data only, no `src/` change), for a physics
session (WATER / HYDRO). The user's ruling: *"taking the validated C172 and putting the exact Wipaire floats on it should
work out of the box, otherwise we have another issue with realism."* It does not work: **0 of 10 runs airborne.**

## The aeroplane and the float
- **Airframe:** `builds/cessna172_2026-09-20_corrected.json` (the user's corrected 172R, wing centre "open (upper only)")
  + the lowered passenger roof `frPaxTopY 0.85`; its own engine (the custom 172R engine: 118 kW / 159 hp, 144 kg),
  212 L of wing fuel.
- **Float:** Wipaire's float for the 172R/S is the **Wipline 2350**. Wipaire's own page: 172R, S at **2,550 lb
  (1,157 kg)** gross, stock engine, propeller **McCauley 1A200/WFA8243** (fixed pitch). Seaplane float 19'7" (5.97 m)
  long, 2'5" (0.74 m) beam, 1'11" (0.58 m) hull height, 2,570 lb (1,166 kg) displacement per float, seaplane system
  305 lb (138 kg). The sim's `FLOAT_PRESETS['Wipline 2350']` (src/core/32_hydro.js) holds exactly these numbers; the
  builds use the editor's own preset (`CAGE_FLOAT_APPLY_PRESET(P, 'Wipline 2350')`: L 5.97, B 0.74, step 0.554 L,
  step depth 0.097 m).
- **Position:** Wipaire's installation drawings are not public, so (the user's fallback) the previous Cessna float
  position from `bugReports/cessnaFloatsWOrks.json` (fltZ -0.22, fltDrop 1.08, fltTrack 0.8, fltInc -0.5, struts).
  Measured: the step 59-60 cm aft of the CG, 19-20 deg from the vertical through the CG — the same as the validated
  floats Cessna (58 cm, 19 deg), which does get off the water.
- **Props:** `c172r_wipline2350_landprop_2026-10-20.json` = the land prop as built (1.905 m, standard pitch);
  `c172r_wipline2350_stcprop_2026-10-20.json` = the STC float prop: by McCauley's naming 1A200/WFA8243 is 82 in x
  43 in -> D 2.083 m, 'climb' pitch (P/D 0.52 ~ the table's 0.55).

## The test (`tools/sea_to_g3390.js`, header has the commands)
Sea at (0, 1600), damage ON, settle 8 s, then GATE FLOATS' technique: full throttle, stick back (de 0.45), the step
attitude (6 deg) held by the elevator once the water speed passes 9 m/s; 90 s on the clock. Weights: 'gross' = 2 pilots
+ full fuel + baggage to the STC gross 1,157 kg; 'half' = 2 pilots + half fuel (~1,020 kg). Winds: calm and 8 kt
(4.12 m/s; sign verified: airspeed = water speed + 5 m/s, a headwind).

## Results (`sea_to_result.json`, `sea_to_result_easeat4_*.json`, `sea_to_result_wind_sign.json`)
| prop | weight | wind | T/W (static) | stuck at | water R/W there | trim | airborne |
|---|---|---|---|---|---|---|---|
| land 1.905 m | 1,157 kg | calm | 0.194 | 5.9 m/s | 0.176 | 8.3 deg | no |
| land | 1,157 kg | 8 kt | 0.193 | 5.8 m/s | 0.324 | 8.1 | no |
| land | 1,020 kg | calm | 0.220 | 6.2 m/s | 0.197 | 9.1 | no |
| land | 1,020 kg | 8 kt | 0.219 | 6.1 m/s | 0.345 | 10.0 | no |
| STC 2.083 m fine | 1,157 kg | calm | 0.228 | 6.5 m/s | 0.205 | 9.8 | no |
| STC | 1,157 kg | 8 kt | 0.227 | 6.5 m/s | 0.356 | 10.6 | no |
| STC | 1,022 kg | calm | 0.258 | 6.9 m/s | 0.229 | 10.6 | no |
| STC | 1,022 kg | 8 kt | 0.257 | 7.5 m/s | 0.349 | 13.9 | no |
| STC, stick eased from 4 m/s | 1,157 kg | calm | 0.228 | 6.8 m/s | 0.208 | 8.9 | no |
| land, stick eased from 4 m/s | 1,157 kg | calm | 0.194 | 6.0 m/s | 0.176 | 7.4 | no |

Every run sticks where water drag + air drag = thrust and stays there for the 90 s. The more thrust, the higher the
trim and the higher the water drag: it ploughs and never planes.

**Not the cause (measured):** the weight (half fuel sticks too); the hull (catalogue-exact); the float position (same
geometry as the validated floats Cessna, which lifts at 27.1 s on its 235 hp O-540 at 952 kg); the pilot's technique
(easing the stick from 4 m/s still sits at 7.4-8.9 deg).

## The terms, against the references
1. **HUMP / TRIM ON THE WATER (main).** R/W rises with speed and never peaks: 0.176 at 5.9 m/s, 0.205 at 6.5, 0.229 at
   6.9 (beam speed coefficient C_V = V / sqrt(g B) = 2.2-2.6), the steps only 0.75 ventilated, the trim 8-10 deg (14
   with the headwind), and the elevator does not bring it under 7.4 deg. A real float hull peaks at R/Δ ~0.15-0.20
   near C_V 2.5-3 and then falls as it climbs on the step. GATE HYDRODYN's own tow (tools/_hydro_check.js §3) holds the
   default float — built on the 2350's proportions — inside 0.18-0.22 and falling, so the fault is most likely the
   AIRCRAFT-level pitch balance on the water (the trim it settles at: elevator authority and prop wash at 6-7 m/s, the
   step / afterbody moment) rather than the lone hull's resistance curve. The headwind case points the same way: a
   higher water speed, the nose up to 14 deg, R/W 0.32-0.36.
2. **PROP STATIC THRUST (secondary, an estimate).** The sim: 2,200 N (land prop) / 2,590 N (STC 82 x 43). Momentum
   theory at 160 hp with a static figure of merit 0.45-0.55: ~2,500 N / ~3,000-3,300 N, i.e. the sim 10-20 % low. Not a
   published figure.

**References found:** no published POH / AFM water-run for a 172R on Wipline 2350s. Wipaire lists water take-off runs
of ~1,100-1,200 ft (335-365 m) for 160-180 hp 172s on the smaller 2100 floats (one of its pages gives 776 ft for the
160 hp O-320; the two disagree). The sim's own note (src/core/32_hydro.js ~line 709): "a 172 on 2350s lifts off in 20 s
on 180 hp". Float pilots quote ~20-30 s.

**Sources:** https://www.wipaire.com/wipline-floats/wipline-2350-floats/ (the 2350 table, the 172R/S row, the
propellers); https://generalaviationnews.com/2005/12/02/add-wipaire-floats-to-any-cessna-172 (2100 vs 2350 by gross);
https://www.wipaire.com/aircraft_page/cessna-172-175-skyhawk/ ; float position rule of thumb (step a little aft of the
CG): https://bearhawkforums.com/forum/bearhawk-4-place-plans-build/64103-float-installation-2870-edo

## Hand-off
A physics session (WATER / HYDRO), by name: **"seaplane trim at the hump — the aircraft's pitch equilibrium on the
water"**, then **"fixed-pitch static thrust for long fine props"**. Done = this rig gets the STC-prop build airborne at
the STC gross in calm air in a realistic time (~20-35 s, ~350-600 m) without touching the build, and the validated
floats Cessna / twin floatplane gates (FLOATS, SEAPLANE, DMGHULL, DMGPLOUGH, DMGFLOATTO, HYDRODYN, WIPLINE) stay green.

Gates on this branch (20 Oct 17:13, node): LIVERY PASS (285, incl. the two new builds), KNIFE PASS; the rig reproduced
the STC/gross/calm row to the digit.
