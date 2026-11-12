# CESSNA DOSSIER — the corrected 172 and the 172 on floats against the real 172R (2026-11-08)

A working brief for the session that rebuilds the Cessna this week: every number we measure, every number we compare it
to, where each comes from, and how sure we are of both. Produced with `tools/real_check.js` (the measurements) and
`tools/real_report.js` (the scores); the HTML report is `reports/REAL-CHECK-2026-11-08.html`.

## 0. The rulings and the files

**The user, 8 Nov:**
- The corrected Cessna is **the** Cessna: `builds/cessna172_2026-09-20_corrected.json`.
- The official Metal Cessna B-CESS (`builds/cessna172_2026-09-20.json`) and its float version
  (`builds/cessna172_floats_2026-11.json`) are dismissed.
- A Cessna on floats with accurate float geometry is to be rebuilt.

**A0, 8 Nov:**
- A new final Cessna (the corrected one + the official cabin, centre-section and tank changes) is coming from the
  FLAGSHIP session this week.
- So is a Wipline 2350 floats Cessna built from it.
- When they land, measure them: the floats one against Wipline's published floatplane figures.

| file | what it is | status |
|---|---|---|
| `builds/cessna172_2026-09-20_corrected.json` | the user's 172 corrected on 20 Sep (C172-STUDY): IO-360 dials (159 hp), the 172R's wing, 3.11 m² stab with a 0.44 elevator | **the Cessna**, until FLAGSHIP's final one |
| `builds/c172r_wipline2350_stcprop_2026-10-20.json` | HYDRO-TRIM (G3390-G3448): a 172R airframe on Wipaire's catalogue-exact 2350 floats, STC 82 × 43 prop | **the float Cessna that exists today**: measured in §4; probably what "I thought it was done already" refers to |
| `builds/c172r_wipline2350_landprop_2026-10-20.json` | the same on the 1.905 m land prop | does not leave the water at gross (T/W 0.194, G3440) |
| `builds/cessna172_2026-09-20.json`, `builds/cessna172_floats_2026-11.json` | B-CESS on an O-540 235 hp, 18.4 m² wing, 2.65 m² stab | dismissed |
| `bugReports/cessnaFloatsWOrks.json`, `tools/fixtures/build_v10_c172_wipline2350_2026-09-20.json` | older float test planes (the gates read them) | not measured |

## 1. How each number is measured, and what was checked today

The user asked: *"check whether we measure the same thing, and whether you measure correctly what you think you
measure"*. What was checked, and what changed:

1. **The plane is the game's, not the file's.** Every build goes through `tools/_load_build.js`, the page's own load
   chain. This matters on the 172: the load door re-measures the tail off the drawing and overwrites `spec.tail`.
   - The corrected file says stab span 3.41 m, chord 0.913, fin at x 5.82 m, fin sweep 0°.
   - The game flies stab span **3.20 m**, chord 0.973, fin at **5.34 m** (0.48 m forward), fin sweep 38°.
   - The stab area is the same 3.11 m².
   - **The 20 Sep correction of the tail lived in `spec.tail` and does not survive a load.** A rebuild must change the
     cage's tail rows (`stSpan`, `stChord`, `stChordTip`, `finHeight`, `finChord`, and the fin's station and sweep).
     Then the drawing, and so the join, carries it.
   - The Jodel shows the same: its fin is 0.55 m forward of its file's station.
   - `tools/perf_study.js --build` reads the raw file and so measures the file's tail, not the game's.
2. **Span, length, height are measured on the DRAWN aeroplane** (new today, `tools/_drawn_dims_probe.js`): the editor's
   own scene through the load door, crew and propeller blades left out.
   - Span: tip to tip.
   - Length: spinner to rudder.
   - Height: standing on the gear at the deck angle the plane settles to (tail down on a taildragger).
   - Until today these came off the structure's node cloud, which sits inside the skin: no spinner, no fin tip, the
     height measured along the body axis. On the 172 that read 7.47 m long (drawn 8.21; the type is 8.28); on the
     DC-3, 7.26 m high (drawn 5.33; the type is 5.16).
   - If a drawn figure disagrees with the structure's by more than 35 %, the structure's is kept and the drawn one
     flagged.
3. **Wing area** is the projected planform the simulation flies (`resolveSpec` geom.Sw). Chords and tail areas are the
   built spec's, after the load door.
4. **Engine family** is read by name, or by displacement for custom dials. The corrected 172's engine is "custom Flat
   (boxer) 4-cyl 5.9 L", i.e. 361 in³, an IO-360. Until today it scored as a wrong engine.
5. **The best glide is not like for like.** Our probe glides with the propeller removed; the POH's 9:1 is with it
   windmilling (10-20 % of L/D). It stays on the page but weighs 0 in the score. To make it comparable, the glide probe
   needs a windmilling-prop drag.
6. **The loads** go aboard through the game's own doors: the frame's seat billing into `sim.setFreight`, and the fuel
   through the burn's node records.
   - MIN: one 70 kg pilot, ¼ fuel.
   - TYP: one 80 kg pilot, ½ fuel.
   - MTOW: four seats at 80 kg, full fuel, the rest to 1111 kg in the baggage bay.
   - On the 172 the MTOW case puts the CG at 43 % MAC: four aboard plus baggage, on a build whose empty CG is already
     aft. That is probably aft of the real 172R's envelope at gross; see gap 6.
7. **Things not yet in the instrument:**
   - The take-off sweep has no Vx obstacle climb-out (the POH's short-field technique). The "best" 50 ft distance is
     therefore not the handbook's technique, and the TO 50 ft gap mixes pilot and airframe.
   - The stall is the probe's peak lift, propeller off, no tail trim load.
   - Flights run on a flat, calm, ISA world, on the reference's surface (paved for the 172R).

## 2. The real 172R

Every figure in `tools/real_refs.js` (`REFS.c172r`, `GEO.c172r`).

**Confidence:** **firm** = several sources agree, or the handbook states it with conditions; **spec sheet** = Cessna's
published figure, carried from the repo's C172-STUDY (the handbook PDF host was not reachable from this session, see
§6); **thin** = one source or derived.

**Geometry**

| item | value | conditions / note | confidence |
|---|---|---|---|
| span | 11.00 m (36 ft 1 in) | | firm (POH section 1, several summaries) |
| length | 8.28 m (27 ft 2 in) | spinner to rudder | firm |
| height | 2.72 m (8 ft 11 in) | on the gear; Cessna measures to the top of the fin and beacon | firm |
| wing area | 16.2 m² (174.0 ft²) | | firm |
| root / tip chord | 1.63 / 1.12 m (5 ft 4 in / 3 ft 8.5 in) | | type sheet (C172-STUDY) |
| dihedral / incidence / washout | 1.73° / +1.5° root / 3° | | type sheet |
| horizontal tail span | 3.40 m (11 ft 4 in) | | type sheet |
| horizontal tail area | 3.30-3.35 m² (35.7-36.1 ft²) | elevator 15.7 ft² of 35.7 (chord fraction 0.44); a design analysis gives 21.56 + 14.53 ft² | thin, two sources agree within 1.5 %; not in the TCDS |
| fin area | ~1.6 m² | | thin |
| wheel track / wheelbase | 2.53 / 1.65 m | | type sheet |

**Specs**

| item | value | confidence |
|---|---|---|
| engine | Lycoming IO-360-L2A, 160 hp at 2400 rpm | firm |
| propeller | McCauley fixed pitch, 2 blades, 75 in (1.905 m) | firm |
| maximum weight | 1111 kg (2450 lb) | firm |
| standard empty | 721-744 kg (1590-1639 lb) | firm as a range (aircraft vary) |
| fuel | 212 L total / 201 L usable (56 / 53 US gal) | firm |
| seats | 4 | firm |

**Performance** (POH section 5, at 2450 lb, sea level, ISA)

| item | value | conditions | confidence |
|---|---|---|---|
| stall, flaps up | 51 KCAS = 94 km/h (44 KIAS) | power off, most forward CG | firm (KCAS) |
| stall, flaps 30° | 47 KCAS = 87 km/h | | firm |
| rotate | 55 KIAS | | spec sheet |
| Vy / Vx | 79 / 60 KIAS | | spec sheet |
| maximum climb | 720 fpm = 3.66 m/s | sea level, 2450 lb | spec sheet |
| cruise, 75 % | ~118 KTAS = 219 km/h | the POH table starts at 2000 ft; sea level read off it | thin |
| top speed | 124 KTAS = 230 km/h | sea level | spec sheet |
| take-off ground roll / over 50 ft | 945 / 1685 ft = 288 / 514 m | flaps 10° (short field), paved, dry, level | spec sheet |
| landing ground roll / over 50 ft | 550 / 1295 ft = 168 / 395 m | flaps 30°, maximum braking, paved | firm |
| best glide | ~9:1 | engine out, propeller windmilling | spec sheet; not like for like with our probe |
| CG envelope at 2450 lb | about 41.0-47.3 in aft of datum (~26-36 % MAC) | | thin: from memory of the POH envelope, not re-read |

## 3. The corrected 172, measured (scores: geometry 98, specs 94, performance 76, overall 88)

**Geometry** (drawn; the structure in brackets)

| | ours | real | off |
|---|---|---|---|
| span | 11.02 m (11.00) | 11.00 | 0 % |
| length, spinner to rudder | 8.21 m (7.47) | 8.28 | −1 % |
| height on the gear | 2.65 m (2.54) | 2.72 | −3 % |
| wing area | 16.53 m² | 16.2 | +2 % |
| root / tip chord | 1.63 / 1.12 m | 1.63 / 1.12 | 0 % |
| stab span | **3.20 m** (the file says 3.41; overwritten by the drawing) | 3.40 | −6 % |
| stab area | 3.11 m² | 3.30-3.35 | −6 % |
| fin area | 1.46 m² | ~1.6 | −9 % |
| track | 2.54 m | 2.53 | 0 % |

**Specs**

| | ours | real | off |
|---|---|---|---|
| engine | custom IO-360 dials (5.9 L, 159 hp) | IO-360-L2A 160 hp | −1 % |
| propeller | 1.905 m, 2 blades | 1.905, 2 | 0 % |
| **empty** | **639 kg** | 721-744 | **−11 %** |
| design gross | 1137 kg | 1111 | +2 % |
| fuel | 191 L | 201-212 | −5 % |
| seats | 4 | 4 | |

**The airframe at three loads** (probes, no pilot; ISA, sea level)

| load | kg | CG % MAC | margin % | Vs | Vs0 (30°) | V75 | Vmax | ROC m/s (Vy km/h) | approach trim at 30° |
|---|---|---|---|---|---|---|---|---|---|
| MIN | 744 | 33 | 21 | 77 | 67 | 204 | 227 | 6.31 (142) | 0.092 |
| TYP | 788 | 33 | 21 | 79 | 69 | 203 | 226 | 5.82 (142) | 0.091 |
| MTOW | 1111 | **43** | 14 | **93** | 82 | **194** | 221 | **3.31** (145) | −0.068 |

**Flown, on paved** (game = the pilot as it ships; POH = the same pilot on the handbook schedule)

| load | who | TO roll | lift-off km/h | to 50 ft | climb m/s at km/h | landing roll | from 50 ft | flap landed |
|---|---|---|---|---|---|---|---|---|
| MIN | game | 161 | 99 | 303 | 5.55 at 143 | 242 | 475 | 1.00 (40°) |
| MIN | POH | 133 | 91 | 286 | 5.39 at 134 | 118 | 340 | 0.75 (30°) |
| TYP | game | 172 | 99 | 328 | 5.19 at 139 | 243 | 475 | 1.00 |
| TYP | POH | 148 | 92 | 322 | 4.95 at 128 | 122 | 345 | 0.75 |
| MTOW | game | 262 | 99 | 738 | 3.05 at 136 | 231 | 431 | 1.00 |
| MTOW | POH | 275 | 102 | 760 | 3.29 at 140 | 138 | 375 | 0.75 |

The technique sweep at MTOW (12 flights) gave the best results below; the pilot's share (game minus best) is in
brackets:

| | best | how | pilot's share |
|---|---|---|---|
| TO roll | 275 m | rotate 1.1 Vs, flaps 10° | −12 m |
| TO 50 ft | 657 m | rotate 1.2 Vs, no flap | +81 m |
| climb | 3.46 m/s | at 1.15 × the probe's Vy, 167 km/h | −0.41 m/s |
| landing roll | 117 m | full braking from touchdown, 1.3 Vs0 | +114 m |

**Against the POH at 1111 kg**

| | ours | POH | verdict |
|---|---|---|---|
| stall, flaps up | 93 | 94 | **inside** |
| top speed | 221 | 230 | **inside** (−4 %) |
| cruise 75 % | 194 | 219 | near (−11 %) |
| climb | 3.31 airframe / 3.29 POH / 3.05 game | 3.66 | near / near / outside (−10 / −10 / −17 %) |
| TO roll | 265 airframe (grass) / 275 POH / 262 game | 288 | near (−5 to −9 %) |
| TO over 50 ft | 760 POH / 738 game | 514 | **outside (+44-48 %)** |
| landing roll | 138 POH / 231 game | 168 | outside (−18 % / +37 %) |
| landing over 50 ft | 375 POH / 431 game | 395 | inside / near |
| empty | 639 | 721-744 | **outside (−11 %)** |

## 4. The 172R on Wipline 2350 floats (HYDRO-TRIM's build), measured (geometry 99, specs 98, performance 91)

- **Shape:** the corrected 172's planform; drawn on its floats 8.59 m long and 3.42 m high.
- **Specs:**
  - custom IO-360 159 hp, the STC prop 2.08 m;
  - empty 770 kg against an ESTIMATED 800-900 kg (the 172R plus a seaplane float exchange; Wipaire's 2350 page for
    the 172 was not reachable, so this row is thin);
  - design gross 1283 kg against Wipaire's STC gross of 1157 kg.
- **Water.** Wipaire's figures don't state their weight, so the band covers 994-1157 kg:

  | reading | water run | time | to 50 ft | reference |
  |---|---|---|---|---|
  | the floatplane supplement's technique (flaps 20°, stick back through the hump) | 265-430 m | 19.5-30 s | | **inside** 335-501 m and 20-35 s |
  | the no-flap rig | 404-645 m | 24-37 s | | inside |
  | the game's pilot off the SEA lane | 399-526 m | 25-33 s | 529-693 m | inside; 50 ft against Wipaire's 751 m |

- **Climb:** 4.3-5.6 m/s against Wipaire's 660-749 fpm (3.4-3.8 m/s): about 10 % better at gross, near.
- **The balance at gross is again aft:** 45 % MAC at 1168 kg.

**This build already does what a float 172 should on the water.** For FLAGSHIP's rebuild: carry these floats and this
prop onto the final airframe, then re-measure.

## 5. The gaps, ranked, with what to change and how to tell it worked

| # | gap | evidence | probable cause | what to change | target, measured by real_check |
|---|---|---|---|---|---|
| 1 | **Climb-out to 50 ft +44-48 %** | 485 m from lift-off to 50 ft against the POH's 226 | the pilot levels in ground effect to accelerate to its VClimb before climbing (the POH climbs out at Vx 60 KIAS), plus the propeller's low-speed efficiency (ACCURACY SHEET: ~58 % at climb speed against ~65 %) | first the instrument: add a Vx obstacle climb-out to the sweep (a schedule, no core change); then decide pilot technique vs propeller (physics, PHYSICS_V) | TO 50 ft at 1111 kg within ±10 % of 514 m |
| 2 | **Empty weight −11 %** (639 against 721-744 kg) | ledger | the systems catalogue, the interior (four upholstered seats, doors, glazing) and the engine installation, all forward (C172-STUDY §4.2) | systems / outfit rows on the build (systems fit, seats, interior), not the frame | 721-744 kg |
| 3 | **Cruise −11 %** (194 against 219 km/h) | level speed at 75 % thrust; top speed is only −4 % | drag at cruise (CdS 0.545 against ~0.47) and the fixed prop's cruise thrust | the drag items the build carries (gear fairings, struts, cowl); check the reference first (the POH table starts at 2000 ft) | V75 within ±5 % |
| 4 | **Climb −10 %** at gross on the airframe | 3.31 against 3.66 m/s | the propeller's climb efficiency (the same item as on every matched engine: PA-18, Stearman) | physics (PHYSICS_V), the user's decision | ROC within ±5 % |
| 5 | **Stab span −6 %, and the tail that does not survive the load** | the file 3.41, the game 3.20; the fin 0.48 m forward of the file | the correction lives in `spec.tail`; the join re-measures the drawn tail | the cage's tail rows (stab span, chord, the fin's station and sweep) to the 172R's 3.40 m stab span; re-measure through the load door | stab span 3.40 ±3 %, area 3.30 ±5 % (drawn) |
| 6 | **Balance aft at gross** | CG 43 % MAC at 1111 kg (four aboard, 40 kg of baggage), 33 % even at MIN | the build's empty CG is aft (C172-STUDY: empty CG 43 % against 24-27 %), fed by gap 2's missing forward mass | gap 2 fixes most of it | empty CG 24-27 %; at gross inside ~26-36 % MAC |
| 7 | **Landing roll on the handbook schedule −18 %** | 138 against 168 m | the brakes or the paved surface's friction a little strong (mean deceleration 2.3 against ~2.0 m/s²) | a physics constant (MU_BRAKE / GROUND_SURF paved): check before changing | ±10 % |
| 8 | **Landing roll under the game's pilot +37 %** | 231 against 168 m | the pilot's brake law (brakes from 0.75 Vs, ramp 0.12 /s to 0.30); it lands on its full 40° flap here | the pilot's landing brake law (not PHYSICS_V) | the game's roll within ±15 % |
| 9 | fin area −9 % | 1.46 against ~1.6 m² | thin reference | check the reference before changing | |

What is right and should stay: span, chords, wing area, track, length, height, the stall at gross (93 / 94 km/h), the
top speed (−4 %), the take-off roll (−5 to −9 %), the propeller, the engine power, the trim (0.09 at forward CG with
30° of flap: it lands on its flaps).

## 6. How to measure the rebuilt Cessna

```bash
node tools/real_check.js c172x --json=reports/evidence/REAL-CHECK-<date>/c172x.json
node tools/real_check.js c172rf --json=reports/evidence/REAL-CHECK-<date>/c172rf.json
node tools/real_report.js
```

- The first two commands take about 33 and 15 minutes; the report takes 3 s.
- For a new file, add a PLANES row in `tools/real_refs.js`: `file:`, `ref: 'c172r'` (land) or `'c172f'` (floats),
  `water: true` for floats.
- `--quick` gives the shape, the specs and the airframe in under a minute: use it while iterating.
- The scores recompute from `tools/real_refs.js` every time, so correcting a reference row needs no new flight.

**Network:** the 172R POH PDF host (kerrville.cap.gov), 172guide.com and wipaire.com's 172 page were not reachable from
this cloud session. The rows marked "spec sheet", "thin" or "ESTIMATED" above should be re-read against the POH and
Wipaire's 2350 data sheet by a session with access. The usual blockers to read: the POH's section 5 tables at 2450 lb,
ISA (take-off, climb, cruise), the CG envelope, and Wipaire's 2350 seaplane exchange weight and water figures for a
160-180 hp 172.
