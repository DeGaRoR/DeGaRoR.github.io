# CHINOOK STUDY — the user's birdman.json against the Chinook Plus 2 (2026-09-21)

"The attached build takes the architecture from the birdman chinook 2S. I
eyeballed it. It probably does not have the right engine, and not the exact
right dimensions, and it probably needs the ability to tilt the engine with
regards to the frame." Files: `builds/chinook_2026-09-21.json` (as found),
`builds/chinook_2026-09-21.edits.json` (the edit set), `builds/chinook_2026-09-21_
corrected.json` (the deliverable: the shelf's 'chinook' row and the
Chinook-alike card), the instrument's trace `.run.txt`.

    node tools/_rejoin_build.js builds/chinook_2026-09-21.json out.json builds/chinook_2026-09-21.edits.json
    node tools/perf_study.js --build=builds/chinook_2026-09-21_corrected.json --vs=chinook --fly

## 0. Which Chinook

The 1980s Birdman Chinook 2S is the WT-11 with two seats and 2 ft more span
(37 ft) on a Rotax 447 or 503; Wikipedia gives it no weights or speeds. The
documented two-seater is ASAP's **Chinook Plus 2** (1989 on: the 2S revised
— span back to 32 ft, the 503 or the 582), and the user's build carries the
582. THE ROW `chinook` in perf_study is the Plus 2 / 582: 32 ft (9.75 m),
154.5 sq ft (14.35 m²), 17 ft 8 in (5.38 m) long, 5 ft 10 in high, 380-460 lb
empty, 1050 lb (476 kg) gross, 10 US gal, stall 35 mph (32 with flaperons),
cruise 83 mph, Vmax 95, Vne 115, climb 1200 fpm, take-off 200 ft, landing
300 ft, glide 10:1 (ultralightnews' ASAP sheet, pilotmix). If the user wants
the 2S proper: span 11.3 m and the 503 (50 hp) are the two dials.

## 1. The numbers (at MTOW 476 kg, sea level, ISA)

| | empty kg | S m² | Vs km/h | V75 | Vmax | ROC m/s | L/D | TO roll m | T0 N |
|---|---|---|---|---|---|---|---|---|---|
| **Chinook Plus 2 / 582** | 209 | 14.3 | 56 | 133 | 153 | 6.1 | 10 | 61 | ~1500 |
| as found | +26 % | +6 % | +15 % | −23 % | −18 % | −73 % | −21 % | +356 % | −34 % |
| **corrected** | +29 % | −1 % | +18 % | −14 % | −12 % | −60 % | −23 % | +354 % | −21 % |

Flown by THE PILOT (corrected, MTOW): take-off 337 m, climb 3.1 m/s at
VClimb, cruise 110 km/h at 0.77, landing 192 m, circuit completed.

Balance: as found CG 62 % MAC, **static margin −18 %** (NP 45), the engine
0.15 m behind the trailing edge and the mains behind the CG; corrected CG
41 %, margin 3 % (NP 44), stab trim 0.9°. Stance: deck 5.2°, nose-over 33°.
Sandbags HELD at 47 % of yield.

## 2. What was corrected

| what | as found → corrected | why |
|---|---|---|
| span, chord | 10.6 × 1.45 → 9.75 × 1.47 m (S 15.2 → 14.2) | the Plus 2's 32 ft / 154.5 sq ft |
| propeller | 1.41 m two-blade (`cw_propD`) → 1.73 m three-blade | the 68 in IVO the 582 swings |
| fuel | 17 → 38 L, the tank behind the rear seat, low in the pod | 10 US gal |
| engine station | the pod's aft face (2.49 m, 110 % MAC) → over the wing at 60 % MAC (`engBlockZ` 0.75, a NEW dial for the pusher: block fore/aft and up/down, G461) | a Chinook's engine sits on the wing's centre section, the prop just behind the trailing edge |
| wing station | `wgDx` −0.2: the LE 0.74 → 0.93 m behind the windscreen base | the pilot's head under the leading edge, the passenger under the wing |
| mains | `s1Z` 1.55 → 1.85: the axle 1.36 → 1.06 m | ahead of the corrected CG (a taildragger's mains must be) |

The stab, fin and boom are the user's ("the architecture is right") and
stay; the registration C-ICHK.

## 3. What is still off, and whose it is

- **Empty — DONE (G466): the aluminium-tube row.** On the `tubeFabric` +
  `fabric` rows (4130 steel tube and wood-spar wings at the J-3's gauge) the
  Chinook weighed 269 kg: wings 59, bracing 23, tail 19, gear 24. On
  `aluTube` / `aluFabric` (GEN_MATERIALS: 6061-T6, E 68.9 GPa, yield 276
  MPa, bolted tube under undoped Dacron at 0.20 kg/m², k and c at 0.6 / 0.7
  of the steel row — the trade-off, see §4) it weighs **218 kg (+4 %)**:
  wings 35, fuselage 23, gear 20, bracing 15 (the lift struts stay 4130 —
  every airframe's strut class does), tail 13. CG 38 %, **margin 6 %**;
  sandbags HELD at 33 % of yield with the tip at 2.4 % of semispan at limit
  load (the steel row's 0.7 — an ultralight's wing visibly bends).
- **Take-off 337 vs 61 m, ROC 3.1 vs 6.1.** The sheet's 200 ft and 1200 fpm
  are a solo ultralight's at full power; at 476 kg with the model's weight
  and its 582 row (Tstatic 1168 N on a 1.68 m IVO where the real 68 in
  three-blade makes ~1500) the take-off is long. T0 −21 % is the registry
  row's (00_registry rotax582_ivo), an engine-bench item.
- **Vs +18 %.** 56 km/h at 476 kg on 14.3 m² needs CLmax 2.2 — the sheet's
  35 mph is a flaperon-and-ASI number; 66 clean is honest.
- **The tilt.** The engine can be moved fore/aft and up/down on the pusher
  now; a THRUST-LINE TILT dial (the Chinook's mount is inclined) is not
  there yet — an item, with the physics (the solver's thrust along the
  body axis) behind it.
- The tank reads "runs out of the body / 14 corners past the bay" on the
  bench: the pod's aft end is narrow and the `cabin` bay ends at the pod's
  rear ring; the tank sits where a Chinook's does.

## 4. The aluminium-tube row (G466, the user: "it also needs to have appropriate
## mechanical characteristics ... there needs to be a trade-off in stiffness")

`GEN_MATERIALS.aluTube` and the surface row `GEN_SURF_MATERIALS.aluFabric`,
the fifth stop of every construction dial (`intCons` 4, `wgCons` / `stCons`
/ `finCons` 5, the design flow's "Aluminium tube" tile, the join's
vocabulary, the hangar's tube shop). What each number is:

| | value | why |
|---|---|---|
| E, ρ, σy | 68.9 GPa, 2700, 276 MPa | 6061-T6; its elastic strain limit 0.40 % against 4130's 0.22 — the load test reads yield off `phys` |
| lin fus / wing / gear | 0.42 / 0.40 / 0.75 kg/m | a 1.75 × 0.058 in tube is 0.82 kg/m, heavier than the ⅞ × 0.035 4130's 0.58, and the aeroplane is lighter because a bolted pod has half the members; the lattice's count is the frame's, so the per-metre carries it (a Chinook pod + boom ~22 kg, its wing structure ~24) |
| cover | 0.20 kg/m² | 3.9 oz Dacron with tapes and stitching, undoped |
| k / c | 0.6 / 0.7 × the steel row | E·A on the tubes actually used comes out near steel's (the fat tube buys the soft metal back), the bolted joints, tang brackets and missing diagonals give a third of it back; c by √(k m) at the lighter mass |
| refMass / refGross | 400 / 476 | the row is an ultralight's — a two-seater on a 582 |
| cdWet, cd0 | the doped-fabric figures | sailcloth sags between ribs and the tubes stand proud |

Measured: the stock aeroplane on the row weighs 276 kg against the steel
row's 333 and runs 62 integrator substeps against 76 (softer members,
lighter nodes); GATE FLEX sweeps the row's cantilever with the others.
