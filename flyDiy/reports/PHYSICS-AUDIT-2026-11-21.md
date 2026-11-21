# PHYSICS AUDIT — the performance model against REAL-FIGURES, re-assessed (21 Nov 2026)

The user, 21 Nov: *"interpret all the results of real-figures, review its conclusions critically and perform its own
independent assessment, then provide a plan for the new models to be added or modified, and the expectations regarding
the move of the plane roster ... we shouldn't chase half a percent, but we should build sufficient confidence that our
performance model is complete and accurate within the range covered by our current roster."*

- Branch `claude/physics-audit`, on master L40H `9349a62c1` (PHYSICS_V 9). **Nothing in `src/` is changed; nothing lands.**
  GATE REALBAND on this tree: PASS (17 planes, nothing moved).
- Every number below is a node run of today's model, not a figure taken from a report. The evidence is in
  `reports/evidence/PHYSICS-AUDIT-2026-11-21/`.
- Units: kg, km/h, m/s, m, m². A cell `-8 → -1` is the error against the reference's middle, today → after the plan;
  `~` near (within 10 % of the band), `!` outside (real_check's own verdict rule).

```
node tools/physics_audit.js --all [--proto=...]      the model taken apart per plane: polar, CLmax, propeller, drag rows (6 s)
node tools/physics_audit_refs.js <audit.json>        the drag area and climb efficiency the parents' figures imply
node tools/physics_audit_plan.js --rc=<dir>          the plan stage by stage, judged by real_check's verdict rule (30 s)
```

## 1. The verdict

1. **The lift model is right.** On the four planes whose book gives a calibrated stall (172R, Velis, PC-6, DC-3) the
   clean stall is within -4 to +1 % and the flapped stall within ±6 %. No change proposed.
2. **The mass model is right since PHYS-SCALE.** 10 of 13 comparable empty weights are within ±6 %. The three outliers
   are cards, not a bias (the Camel, the Ruckus, the Archaeopteryx's unweighed drive). No change proposed.
3. **The propeller is the one systematic defect, but not the one REAL-FIGURES named.** The validated planes' climb
   efficiency is already right (172R 0.65 against 0.67 needed, Cub 0.59 / 0.55). The defect is that every propeller is
   the same one: `T0 x V0 = 1.95 P`, so the peak is 75 % for all of them, at a speed set by the disc loading alone
   (zero-thrust speed 255-478 km/h on aeroplanes that top out at 87-370). Blade material and a constant-speed hub do
   not exist. It costs the metal-prop planes 5 % of their top end, the slow planes a third of their climb, and the
   governed ones (the DC-3, the PC-6) 5-6 % of top speed.
4. **The drag model is right in the middle of the roster and wrong at both ends.** Model over real drag area: 172R
   0.99, Cub 0.96, DC-3 1.09 (wheels up). Too clean: PC-6 0.56, Super Petrel 0.65. Too draggy: Tiger Moth 1.12, Camel
   1.18, Stearman 1.31, Velis 1.48, the gliders 2.4-2.7.
5. **Above aspect ratio 8 the induced drag is wrong** (new): the span-efficiency fit falls to 0.65 at AR 13 and sits on
   its 0.55 floor at AR 21. It is half of the gliders' missing glide.
6. **Three reads of real_check are not like for like** (new): retractables are probed wheels down, a row's altitude is
   ignored, a row's power is ignored. Four reference rows are wrong or not comparable.
7. **The plan** is six steps after a step 0 that only reads the planes right. The four prototyped model steps move 12
   rows toward or into their band. They take one row of a well-documented plane out of its band: the Velis's top
   speed, which is an rpm limit the model does not have. The drag rows and the constant-speed propeller are ordered so
   the PC-6 never moves away.

Mean absolute error on the seven best-documented planes (172R, Velis, PC-6, DC-3, Tiger Moth, Cub, Carbon Cub):

| figure | today | read right (step 0) | the prototyped plan (steps 1-4) | the whole plan (steps 5-6, drag as a target) |
|---|---|---|---|---|
| clean stall | 3 % | 3 % | 3 % | 3 % |
| top speed | 9 % | 7 % | 7 % | 5 % (2 % without the Velis's rpm-limited row) |
| rate of climb | 7 % | 11 % | 8 % | 4 % |
| best glide | 14 % | 12 % | 5 % | 2 % |
| verdicts, 14-plane subset (inside / near / outside) | 52 / 14 / 9 | 51 / 14 / 10 | 53 / 14 / 8 | 61 / 8 / 6 |

"Read right" makes the climb worse because it removes a flattering mistake: the Electric trainer's climb row is flown
at 48 kW and the model was climbing at 57.6 kW.

## 2. REAL-FIGURES' physics items, each judged

| # | REAL-FIGURES said | verdict | the evidence (this session's runs) |
|---|---|---|---|
| 1 | Climb 10-20 % short on every matched engine: the propeller's climb-speed efficiency, ~58 % against ~65 % | **re-scoped** | The efficiency the book's climb needs at Vy, on the model's own polar, against the model's: 172R 0.67 / 0.65, Cub 0.55 / 0.59, Tiger Moth 0.55 / 0.56, DC-3 0.70 / 0.67. Not a uniform deficit. It is short where the propeller is metal (Stearman 0.66 / 0.58), where the aeroplane is slow (Ruckus 0.53 / 0.43) and where the hub is governed. Cause: verdict 3 above. |
| 2 | Cruise -11 % on the 172 | **half a reference error** | The row is 118 KTAS at sea level, "read off" a table that starts at 2000 ft. The POH's own 123 kt at full power and 122 KTAS at 80 % / 8000 ft both give 110-112 KTAS (204-207 km/h) at 75 % at sea level. The model reads 195: -5 %, and 204 after the propeller step. |
| 3 | L/D high on the 172 (+24 %): add a windmilling propeller to the glide probe | **confirmed, and wider** | The polar is right: drag area 0.54 against 0.52-0.54, clean L/D 11.2. With an idling disc of 0.10 x its area the glide is 9.2 at 128 km/h against the POH's 9.0 at 120. But the GAME has no idle drag either: thrust is `throttle x max(0, T0 - k V²)`. It is a model item, not only a probe item. |
| 4 | DC-3 cruise and top speed -13 to -15 % | **two instrument errors and the propeller** | The quick probe flies it wheels down: 2.90 m² against 2.41 wheels up (Loftin's DC-3: 2.28). The row is at 8,500 ft and is read at sea level. Both fixed: -8 %. On a constant-speed propeller: -2 %. Its drag needs nothing. |
| 5 | Empty weights: 172 -13 %, Jodel +7.5 %, Tiger Moth +13 %, DC-3 -15 to -22 %, Camel +37 % | **closed since** | Today: 172 0 %, Jodel 0 %, Tiger Moth 0 %, DC-3 +4 %, Cub +3 %, Stearman +1 %, PC-6 -6 %. Left: Camel +31 % (engine 209 kg against a Clerget's 173, wings and bracing 186 kg), Ruckus +36 % (gear 25 kg and STOL devices 13 kg on a 115 kg airframe). |
| 6 | The stall is read prop-off and untrimmed | **confirmed, small** | The trimmed CLmax is 3-9 % lower (Vs +1 to +4 %). Untrimmed against calibrated books: 172R 94 / 94.5, Velis 91 / 94.5, PC-6 106 / 107, DC-3 124 / 124. Trimmed: 97, 93, 110, 125. Flapped, untrimmed-trimmed against the book: 172R 82-84 / 87, Velis 86-88 / 83, PC-6 93-95 / 96, DC-3 116 / 115. Keep the probe as it is. |
| 7 | PROP-CLASSES: blade material x1.08 on the whole curve, a constant-speed class | **confirmed in direction, re-derived** | Material belongs on the top end only (the static thrust is validated by the 172's and the Cub's rolls). A governed propeller is not a factor on the quadratic: a quadratic through its static and top-speed thrust over-reads the climb by 7-23 %. |
| 8 | Gliders: L/D 28 against 40 (LS4), 13.6 against 28 (Archaeopteryx): "the body drag build-up" | **re-scoped: two causes** | Read today: LS4 19.5 (its branch), Archaeopteryx 14.8. (a) Span efficiency 0.52 and 0.62 where a clean cantilever wing has ~0.85. (b) Every row of a clean airframe is about double: the LS4 reads 0.244 m² against 0.091 (wing and tail profile 0.117, body 0.053, tail brace wires 0.026, junctions 0.021, wheel 0.017, canopy 0.010). |
| 9 | The Electric trainer is inside on climb (+7 %) | **refuted** | POH-128's 647 fpm is at 48 kW (max continuous). At that power the model climbs 2.48 m/s against 3.29: -25 %. Causes: its propeller (0.65 at Vy where the book needs ~0.73), its span efficiency (0.70), its drag area (0.41 against ~0.28). |
| 10 | The climb-out to 50 ft is long (172 +44-48 %) | **the pilot's, not re-flown** | The airframe's share is small: the propeller step adds 1-3 % of thrust at 1.2 Vs. The model's Vx is 124 km/h against the POH's 111-115, and the schedule has no Vx climb-out. Flights were not run in this session. |
| 11 | Landing roll 18 % shorter than the POH on the handbook schedule | **not assessed** | Ground and brakes need flights (GEN-BRAKES' and the pilot's ground). Note for them: step 4 below adds drag at idle, which shortens the flare and the roll further. |

**New in this audit, not in REAL-FIGURES:**

| # | finding | the evidence |
|---|---|---|
| N1 | `real_check --quick` probes a retractable wheels DOWN (a reset sim; the retraction only runs in `step`) | DC-3 drag area 2.90 down, 2.41 up; Petrel 0.50 / 0.39; the PC-6 on amphibious floats 1.14 / 0.89. |
| N2 | A row's altitude (`alt`) is in `real_refs.js` and is not read | DC-3: 230 mph at 8,500 ft compared with a sea-level reading. |
| N3 | A row's power is not read by the airframe reading (`poh.climbPowerK` reaches the flights only) | Velis climb at 48 of 57.6 kW; DC-3 climb at METO 1,050 of 1,200 hp. |
| N4 | Reference rows wrong or not comparable | 172R V75 (item 2). PA-18 `Vs1` "43 mph flaps up": Jane's 43 mph is flaps DOWN; clean is 41-43 KIAS (model 74 km/h against 76-80, not +8 %). Ruckus: the sheet is a calculation with a constant 57 % propeller, its stall needs CL 3.0 and its climb the whole actuator-disc ideal. Ruckus Back-Country (64 hp) is scored against the 37 hp sheet. The PC-6 on floats is scored against the landplane. Glide rows do not say whether the propeller is in them. |
| N5 | The PC-6 and the Super Petrel are far too clean; "near" hides it | PC-6: 1.02 m² against 1.73 (sea level) to 1.96 (10,000 ft). Cross-check: with the drag at 1.85 and the governed propeller, the model's climb lands at 5.23 against 5.13 without being fitted to it. Petrel: 0.39 against 0.59. |
| N6 | The three wire-braced biplanes are 12-31 % draggy | Table in section 4. The flying wires are billed as 4 mm round cable at Cd 1.0 (a Tiger Moth carries streamline wires): 0.06 m² each. The Stearman's remaining +25 % is its bare radial and fabric body, billed on top of each other. |
| N7 | Four tail brace wires are billed on every build, cantilever tails included | 0.02-0.07 m² on the 172, DC-3, Velis, LS4, Archaeopteryx (a quarter of the LS4's whole real drag). |

## 3. The reference subset

Chosen for what their books state, not for how well we match. Geometry and specs are taken as given.

**Tier 1: the conditions are stated (weight, power, altitude, calibrated speeds).**

| plane (card) | source | empty / max kg | Vs1 / Vs0 | Vy, climb | top / cruise | glide | TO roll / 50 ft | LDG roll / 50 ft |
|---|---|---|---|---|---|---|---|---|
| Cessna 172R (`c172v2`) | POH | 721-744 / 1111 | 94 / 87 (KCAS) | 146, 3.66 | 228 at sea level; 226 TAS at 80 %, 8000 ft | 9.0 at 120, propeller windmilling | 288 / 514 paved | 168 / 395 |
| Pipistrel Velis Electro (`etrainer`) | POH-128, TCDS A.573 | 428 / 600 | 94 / 83 (KCAS) | 139, 3.29 at 48 kW | VH 172, rpm-limited | 15 | 240 / 448 at 50 kW | 183 / 537 |
| Pilatus PC-6/B2-H4 (`pc6`) | TCDS F 56-10, factsheet | 1250 / 2800 | 107 / 96 (KEAS) | 5.13 | max cruise 232 TAS (altitude not stated), 213 economy | - | - / 440 | - / 315 |
| Douglas DC-3A (`dc3r`) | A-669, C-47 manual, AOPA | 7630-7650 / 11431 | 124 / 115 (KIAS) | 204, 5.74-6.20 at METO | 370 at 8,500 ft | 14.7 (Loftin, computed) | - | - |
| DH.82A Tiger Moth (`tigermothm`) | AAIB 1/2019 trial | 506-535 / 828 | 64-79 | 106, 2.54-3.42 | 172-175 | - | 200-300 grass | - |
| Piper J-3C-65 (`cub`) | Piper sheet | 345 / 550 | 61 (IAS, 1940s) | 2.29 | 140 / 117-121 | 9.5 (Loftin, computed) | 113 | 88 |
| Carbon Cub SS (`carboncubss`) | reviews | 408 / 599 | 65 | 7.6-10.7 | cruise 177-193 | - | 40-50 (ruled) | 75 |

**Tier 2: one source or unstated conditions; read with that in mind.** Stearman PT-17, Sopwith Camel, Jodel D.112,
Chinook Plus 2, Super Petrel LS, PA-18 on floats, Archaeopteryx, LS4 (on `claude/ready/ls4-2`).

**Not scored on performance:** the two Ruckus cards and the PC-6 on floats (N4).

## 4. Today's errors, and what drives them

Error against the reference's middle at the reference's weight (the Cub's climb row has no stated weight: +33 % is the
middle of 423-550 kg; at gross it is 2.39 against 2.29, +4 %).

| plane | empty | Vs1 | top speed | cruise 75 % | climb | glide | TO roll |
|---|---|---|---|---|---|---|---|
| c172v2 | 0 | -1 | -3 | -11~ | -8~ | +25! | -1 |
| etrainer | -2 | -4 | +12~ | | +7 | -17~ | -3 |
| pc6 | -6 | -2 | +18~ | | +16! | | |
| dc3r | +4~ | +1 | -15! | | +6 | -12~ | |
| tigermothm | 0 | -4 | -3 | +6 | +1 | | -37! |
| cub | +3 | -6 | +3 | +6 | +33 | -1 | -10 |
| carboncubss | 0 | -7 | | -8 | -5 | | +8 |
| stearman | +1 | -16~ | -15~ | -5 | -15! | | |
| camelm | +31! | | -5 | | | | |
| jodelg | 0 | +11 | -13~ | -10 | -6 | -9 | -1 |
| chinookm | +3 | +7 | +2 | +13 | -3 | -8 | +35 |
| petrel42 | +2 | +3 | +7~ | | -5 | +4 | +50~ |
| pa18f | | +8~ | | | -13~ | | |
| archaeo | +47! | +15 | | | -18 | -47! | +19 |

**The terms behind them.** The real drag area is read from the published top speed: thrust power = blade efficiency x
the actuator disc's ideal efficiency x shaft power, less the induced drag (`physics_audit_refs.js`; the range is ±0.03
on the blade efficiency). The model's is the fitted `CD0 x S` of its own polar, wheels up.

| plane | real drag area m² | model m² | model / real | model span efficiency | propeller efficiency at Vy: needed / model | at top speed: physical / model |
|---|---|---|---|---|---|---|
| Cessna 172R | 0.54 (0.52-0.56); Loftin 0.52 | 0.54 | **0.99** | 0.70 | 0.67 / 0.65 | 0.80 / 0.75 |
| Piper J-3C-65 | 0.85 (0.82-0.89); Loftin 0.62 | 0.82 | **0.96** | 0.79 | 0.55 / 0.59 | 0.73 / 0.74 |
| Douglas DC-3A | 2.20 (2.11-2.29); Loftin 2.28 | 2.41 | **1.09** | 0.73 | 0.70 / 0.67 | 0.81 / 0.73 |
| Pilatus PC-6 | 1.73 at sea level, 1.96 at 10,000 ft | 1.02 | **0.56** | 0.68 | 0.58 / 0.68 | 0.77 / 0.72 |
| Super Petrel LS | 0.59 (0.57-0.61) | 0.39 | **0.65** | 0.86 | 0.64 / 0.62 | 0.79 / 0.75 |
| Tiger Moth | 0.88 (0.84-0.92) | 0.98 | **1.12** | biplane | 0.55 / 0.56 | 0.73 / 0.72 |
| Sopwith Camel | 0.82 (0.79-0.85); Loftin 0.81 | 0.97 | **1.18** | biplane | - / 0.58 | 0.76 / 0.74 |
| Stearman PT-17 | 1.12 (1.08-1.16) | 1.47 | **1.31** | biplane | 0.66 / 0.58 | 0.80 / 0.73 |
| Velis Electro | 0.28 (from its 15:1 glide) | 0.41 | **1.48** | 0.70 | ~0.73 / 0.65 | rpm-limited |
| Archaeopteryx | 0.16 (from its 28:1 glide) | 0.37 | **2.4** | 0.62 | | |
| LS4 | 0.09 (from its 40.5:1 glide) | 0.24 | **2.7** | 0.52 | | |

Reading the table:
- **Propeller.** At the top speed the model is 0.72-0.75 for everything. A wooden propeller really is there (0.73-0.76);
  a metal one is at 0.80, a governed one at 0.77-0.81.
- **PC-6 "needs" only 0.58 at Vy** because its drag is too low: the model climbs 16 % too well on a propeller that is
  already too weak. The two errors hide each other, which is why it reads "near".
- **Loftin's values** (SP-468) for the J-3, the 172 and the DC-3 are quoted from memory of the tables and were not
  re-read this session; the Camel's 0.0378 was confirmed.

## 5. The plan

Ordered so that every step obeys the standing ruling (14-15 Nov): each validated plane stays in its band or moves
toward it. Stage columns come from `physics_audit_plan.js`: today's real_check figure times the ratio the prototype
moves it by. Full table, all 17 planes: `reports/evidence/PHYSICS-AUDIT-2026-11-21/plan.md`.

| step | what | kind | who moves | PHYSICS_V |
|---|---|---|---|---|
| 0 | Read right: wheels up, the row's altitude, the row's power; fix four reference rows; a glide row states its propeller | instrument + references | DC-3, Velis, Petrel, PC-6 on floats | no |
| 1 | M2: span efficiency above aspect ratio 8 | model | Velis, Archaeopteryx, LS4, motor gliders | yes |
| 2 | M4: streamline flying wires; no brace wires on a cantilever tail | model, two garage rows | the three biplanes; 172, DC-3, Velis, gliders | yes |
| 3 | M1a: the fixed-pitch propeller by its design speed and blade material | model (synthesis only; the solver's law is unchanged) | every fixed-pitch plane; the wooden ones by under 1 % | yes |
| 4 | M3: the propeller's drag at idle | model (solver) + the glide probe | every powered plane's glide and approach | yes |
| 5 | M5: the drag rows at both ends of the roster | model, a study first | PC-6, Petrel, floats; gliders, Velis; Stearman | yes |
| 6 | M1b: the constant-speed propeller on the actuator disc | model (solver: a second law) | PC-6s, DC-3, the turbine cards | yes |

Steps 1-4 can ride one PHYSICS_V bump; steps 5-6 a second.

### Expected moves (error against the reference, %)

| plane | figure | real | today | step 0 | steps 1-4 (prototyped) | steps 5-6 (drag as a target) |
|---|---|---|---|---|---|---|
| Cessna 172R | top speed | 228-230 | 222 (-3) | 222 | **232 (+1)** | 232 |
| | cruise 75 % | 219 (row); 204-207 (corrected) | 195 (-11~; -5 corrected) | 195 | **204 (-7~; 0 corrected)** | 204 |
| | climb | 3.66 | 3.36 (-8~) | 3.36 | **3.64 (-1)** | 3.64 |
| | glide | 9.0 | 11.3 (+25!) | 11.3 | **9.2 (+3)** | 9.2 |
| | TO roll | 288 | 284 (-1) | 284 | 281 (-2) | 281 |
| Velis Electro | climb at 48 kW | 3.29 | 3.52 (+7, at 57.6 kW) | **2.48 (-25!)** | 2.87 (-13~) | **3.43 (+4)** |
| | glide | 15.0 | 12.4 (-17~) | 12.4 | 12.9 (-14~) | **14.8 (-2)** |
| | TO roll at 50 kW | 240 | 232 (-3, at 57.6 kW) | 285 (+19!) | 279 (+16!) | 269 (+12~) |
| | VH | 172, rpm-limited | 193 (+12~) | 182 (+6) | 192 (+11~) | 215 (+25!) see the note |
| Pilatus PC-6 | max cruise | 232 | 272 (+18~) | 272 | 272 | **229 (-1)** |
| | climb | 5.13 | 5.95 (+16!) | 5.95 | 5.97 | **5.23 (+2)** |
| Douglas DC-3A | top speed at 8,500 ft | 370 | 313 (-15!) | **340 (-8~)** | 343 (-7~) | **362 (-2)** |
| | climb at METO | 5.74-6.20 | 6.36 (+6, at take-off power) | 5.47 (-8) | 5.56 (-7) | 6.42 (+8) |
| | glide | 14.7 | 13.0 (-12~) | **14.3 (-3)** | 14.6 (-1) | 14.6 |
| Tiger Moth | top speed | 172-175 | 168 (-3) | 168 | 173 (-1) | 176 (+1) |
| | climb | 2.54-3.42 | 3.02 (+1) | 3.02 | 3.18 (+7) | 3.27 (+10) |
| Piper Cub | top speed / climb at gross | 140 / 2.29 | 144 / 2.39 | same | 143 / 2.39 | same |
| Carbon Cub SS | climb | 7.6-10.7 | 8.72 (-5) | 8.72 | 8.95 (-2) | 8.95 |
| Stearman | top speed | 200-217 | 177 (-15~) | 177 | 184 (-12~) | **200 (-4)** |
| | climb | 4.27 | 3.64 (-15!) | 3.64 | 3.92 (-8~) | 4.50 (+6~) |
| Sopwith Camel | top speed | 182-185 | 174 (-5) | 174 | 178 (-3) | 185 (+1) |
| Super Petrel | max cruise | 185 | 198 (+7~) | 211 (+14~) | 216 (+17!) | **185 (0)** |
| | climb | 5.08 | 4.83 (-5) | 5.41 (+7) | 5.62 (+11) | 4.53 (-11) |
| Archaeopteryx | glide | 28 | 14.8 (-47!) | 14.8 | 16.7 (-40!) | 24.7 (-12~) |
| LS4 (its branch) | glide | 40.5 | 19.5 (-52!) | 19.5 | 25.2 (-38!) steps 1-2 | target: 0.09 m² |
| Jodel, Chinook, PA-18 floats | all rows | | | | within 2 points of today | |

Note on the Velis's VH: 93 KCAS is where its fixed propeller reaches 2300 rpm, not where its drag meets its power.
The model has no rpm limit, so every step that makes the card right elsewhere (less induced drag, a better propeller,
less parasite drag) makes it faster there. Either the row is dropped, or the card takes the fine pitch class and the
propeller law learns that pitch runs out. It is the one Tier 1 row the plan moves the wrong way (+6 → +11 after step 0).

### The band rule, row by row

Of the 93 scored rows, the prototyped plan (steps 0-4) leaves 51 where they are, 19 stay inside, 9 move toward, 3 move
into their band, and 11 read worse. The 11, by cause:

| rows | cause | ruling needed? |
|---|---|---|
| Velis climb, Velis TO roll | Step 0 only: the book's power replaces a flattering one. Steps 1-4 then move both toward. | no |
| PC-6 on floats: top speed, climb | Step 0 only (its float wheels up). It is scored against the landplane. | no (N4) |
| Ruckus Back-Country: 3 rows | Scored against the 37 hp sheet with 64 hp. | no (N4) |
| Ruckus: top speed 87 → 94 (+8 %), TO roll | Step 3 lifts its propeller from 0.57 to 0.70 at the top speed. The sheet's 87 km/h is itself computed with 0.57. | **yes: accept, or cap a small high-rpm propeller's blade efficiency** |
| Super Petrel: max cruise +14 → +17 %, glide | Step 0 shows the real gap (+14 % wheels up); step 3 adds 3 points. Its hull drag is step 5. | **yes: accept until step 5, or hold step 3 off this card** |

Apart from the Velis's VH, no Tier 1 row moves away at any step, provided step 6 follows step 5 on the PC-6: the governed propeller alone takes
the PC-6 from +18 to +22 % on speed and +16 to +26 % on climb. The DC-3 needs no drag change and could take step 6 at
once; that is the user's call.

### Step 0 — read right (no physics)

- **Wheels up.** In `real_check.js airframe()`, a retractable's cruise, climb and glide rows on the gear-up drag
  (`params.retract.cdA x frac` off the body row, as the solver does at `GR.pos` 0). Take-off and stall stay gear down.
- **The row's altitude.** `Vmax` / `V75` rows with `alt` are solved at that altitude, TAS (`sim.thrustAt(V, 0, h)`).
- **The row's power.** A `power` fraction on a row (Velis climb 48 / 57.6, VH 49.2 / 57.6, TO 50 / 57.6; DC-3 climb
  1,050 / 1,200; Petrel max cruise 69 / 73.5).
- **References.** 172R `V75` 204-207 km/h and `Vmax` 123 kt. PA-18 `Vs1` re-sourced as the clean stall. Each `LD` row
  says `propeller: idle | none | unknown`. The Ruckus sheet marked as a calculation. Ruckus Back-Country and the PC-6 on
  floats scored on shape and mass only.
- REALBAND's baseline is re-written with these reasons; no model number moves.

### Step 1 — M2, the span efficiency above aspect ratio 8

- **Today:** `genOswald = 1.78 (1 - 0.045 AR^0.68) - 0.64`, floor 0.55. It is Raymer's fit of conventional aeroplanes,
  valid to AR ~10: 0.84 at AR 7, 0.71 at 12, 0.68 at 13, under the floor at 21.
- **Proposed:** above AR 8 only, `max(today, 1 / (1/0.95 + pi AR kv))`, `kv` 0.0035 on a smooth composite surface,
  0.007 otherwise. At AR 8 the two meet (0.81), so no light aeroplane moves.
- **Measured:** Velis 0.73 → 0.87, glide 12.4 → 13.5. Archaeopteryx 0.72 → 0.89, glide 14.8 → 16.1. LS4 0.55 → 0.85,
  glide 19.5 → 24 (25.2 with step 2). PC-6 and DC-3: +1 %.

### Step 2 — M4, the wires

- A wing-bracing row "wires: round | streamline" (round is today's Cd 1.0; streamline 0.35 on the same thickness),
  default by archetype. Tiger Moth, Camel, Stearman: -0.06 m² each, top speed +2-3 %.
- A tail row "bracing: wires | none". Absent = wires, as today. Cantilever tails: 172 -0.029, DC-3 -0.067, Velis
  -0.025, LS4 -0.026 m².

### Step 3 — M1a, the fixed-pitch propeller

- **Kept:** the law `T = T0 - k V²`, and the static thrust by pitch class. Both are validated by the 172's and the Cub's
  rolls and climbs. A first cut that also re-derived the static thrust took 12 % off the 172's and put 27 % on its roll;
  it is rejected and kept in the file for the record.
- **Changed:** `k`. Today `V0 = 1.95 P / T0` for every propeller. Proposed: `k` from the thrust at the aeroplane's own
  top speed (times a pitch-class factor), where efficiency = blade efficiency (wood 0.79, metal and composite 0.84) x the
  actuator disc's ideal efficiency. Two guards: `T0` is at least that thrust (a slow aeroplane on a big disc pulls about
  the same standing as at its top speed), and thrust never exceeds the actuator disc's at any speed.
- **Where:** `60_gen_spec.js genPropSynth`, called again from `buildGen` once the drag is known (as `genPropAuto` is
  today). `05_atmos.js` keeps its scalings. One extra `min` in the solver's thrust line for the second guard.
- **Measured:** efficiency at Vy / top speed. 172R 0.65 / 0.75 → 0.68 / 0.80. Stearman 0.58 / 0.73 → 0.63 / 0.79. Cub
  0.59 / 0.74 → 0.59 / 0.73. Ruckus 0.43 / 0.57 → 0.48 / 0.70. Take-off rolls within 2 % (the Ruckus -6 %).

### Step 4 — M3, the propeller at idle

- **Today:** at closed throttle the propeller is not there.
- **Proposed:** below the throttle that gives zero thrust, a drag `kw x q x disc area`: 0.10 for a windmilling fixed
  pitch, 0.03 for an electric motor, 0.02 for a governed or feathering propeller. The glide probe reads it for a flown
  glide row.
- **Measured:** 172R glide 11.3 → 9.2 at 128 km/h (POH 9.0 at 120). Velis 13.9 → 12.9 (it then needs step 5).
- **Cost:** every approach steepens and every flare shortens. Pilot must re-check the approach laws, the flare and the
  landing gates before it lands. It is the largest behavioural change in the plan and the only one the player will feel
  at once.

### Step 5 — M5, the drag rows at both ends (a study, with these targets)

Not prototyped: the evidence fixes the total each plane needs, not yet which row carries it.

| class | planes: model → target m² | the rows to study |
|---|---|---|
| Utility box, hull, floats | PC-6 1.02 → 1.7-2.0; Petrel 0.39 → 0.59; the PC-6's two floats add only 0.115 (to be checked against a float's own figure) | The body's pressure drag by its shape (a hull's step and chines, a float, a slab cabin's afterbody): today it is friction x a streamlined form factor. The gear's legs by what is drawn: today 0.66 m of bare 50 mm tube on every build. |
| Clean airframes | LS4 0.24 → 0.09; Archaeopteryx 0.37 → 0.16; Velis 0.41 → 0.28 | A laminar section's profile drag (`0.0055 + 0.018 t` is a turbulent section). A flush canopy (billed as a windscreen step). A pod's form factor. A cantilever junction. On the Velis also the card: its three wheels and legs are bare (0.15 m², a third of its drag) where the type wears spats. |
| Radial biplanes | Stearman 1.47 → 1.12; Camel 0.97 → 0.82; Tiger Moth 0.98 → 0.88 (after step 2: 1.40, 0.91, 0.92) | A bare radial (0.22 m² on the Stearman) and the body behind it are billed in full on top of each other. The fabric body's coefficient (0.0125, 2.5 x metal's) is the Cub's calibration constant and carries the Cub's bluff-body drag onto every fabric aeroplane. |

The middle of the roster (172R, Cub, DC-3, Jodel, Chinook, Carbon Cub) must not move: that is the study's gate.

### Step 6 — M1b, the constant-speed propeller

- **Proposed:** a propeller with the `cs` row flies the actuator disc itself: thrust from `P x blade efficiency = T (V +
  induced velocity)`, capped standing at a static figure of merit of 0.65 (Hartzell and MT statics on the O-360: 0.49-
  0.59). A second law in the solver's two thrust lines; three Newton steps per engine per frame.
- **Needs:** the `cs` row on a piston card (PROP-CLASSES' class; the DC-3 has none today).
- **Measured:** DC-3 top speed 343 → 362 (-2 %), climb at METO 5.56 → 6.42, static thrust 13.1 → 17.9 kN an engine (its
  roll shortens by about a third; no roll row exists to judge it). PC-6, after step 5: 229 (-1 %) and 5.23 (+2 %).

## 6. Limits

- **Flights were not run.** Every number is the airframe reading (the probe and the thrust law). The flown rows (the
  climb-out to 50 ft, the landing rolls, the pilot's share) are as REAL-CHECK left them.
- **The prototypes are ratios on today's figures,** computed from the measured polar and thrust. They are what the core
  change would do to the level-flight balance; they do not replace building it and running REALBAND and the gates.
- **The real drag areas rest on one assumption:** blade efficiency 0.79 / 0.84 ±0.03 times the actuator disc. The
  ranges in section 4 are that ±0.03. The PC-6's figure also rests on which altitude its 125 KTAS is flown at: the two
  readings are 1.73 and 1.96 m², both far from 1.02.
- **Thin references stay thin.** The Stearman's, the Camel's and the Petrel's rows are single sources or unstated
  weights; their targets in step 5 are indications.
- **The LS4** was measured on a scratch worktree of `claude/ready/ls4-2` (its core built there); it is not on master.
- **Not looked at:** the take-off roll's own model (the Tiger Moth's -37 % and the Petrel's +50 % against thin rows),
  water performance, hot-and-high, the solver in flight against its own probe.

Sources checked on the web this session: the 172R's POH figures (123 kt at sea level, 122 kt at 80 % / 8000 ft, 720
fpm) on [172guide.com](https://172guide.com/models/172R.htm) and a [POH scan](https://kerrville.cap.gov/media/cms/Cessna_172R_POH_712F3D6CCB3C7.pdf);
the PA-18's stall speeds on [Wikipedia](https://en.wikipedia.org/wiki/Piper_PA-18_Super_Cub) and
[AOPA](https://aopa.org/go-fly/aircraft-and-ownership/aircraft-fact-sheets/piper-super-cub); the PC-6's 125 KTAS on the
[Pilatus fact sheet](https://pc-6.com/vPilatus-Fact%20Sheet.pdf); Loftin's Camel figure on
[Wikipedia](https://en.wikipedia.org/wiki/Zero-lift_drag_coefficient) ([SP-468](https://ntrs.nasa.gov/api/citations/19850023776/downloads/19850023776.pdf)).
