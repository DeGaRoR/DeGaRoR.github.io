# REAL CHECK 2026-11-07 - the generated sections

`node tools/real_check.js <key>`; verdicts recomputed with the final tools/real_refs.js.

| plane | inside | near | outside | wall s |
|---|---|---|---|---|
| cub | 10 | 2 | 1 | 1319 |
| jodel | 7 | 3 | 3 | 3170 |
| cessna | 3 | 3 | 11 | 2656 |
| c172x | 3 | 7 | 7 | 1974 |
| cessnaF | 1 | 2 | 6 | 1016 |
| pa18f | 1 | 5 | 4 | 715 |
| chinook | 5 | 2 | 0 | 885 |
| petrel | 10 | 0 | 3 | 6959 |

### Piper Cub (official) — against the Piper J-3C-65 Cub (A-65)

Build `builds/cub_2026-09-20_corrected.json` through the load door; 65 hp Continental A-65, S 17.6 m², empty 355 kg, as baked 476 kg, fuel 32 kg, 2 seats. Reference: Piper J-3C-65 sheet / POH reprint: gross 1220 lb, empty 765 lb, stall 38 mph, cruise 73-75 mph, top 87 mph, climb 450 fpm, TO run 370 ft, ldg roll 290 ft (perf_study REAL.cub).

| load | mass kg | CG % MAC | SM % | Vs | Vs0 | V75 | Vmax | ROC m/s (Vy) | L/D | CdS | TO grass (analytic) | approach trim de (flap) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| min | 433 | 24 | 16 | 55 | 55 | 128 | 145 | 3.62 (93) | 9.4 | 0.84 | 86 | 0.181 (0.00) |
| typ | 451 | 23 | 17 | 56 | 56 | 127 | 145 | 3.40 (92) | 9.4 | 0.84 | 91 | 0.200 (0.00) |
| mtow | 550 | 35 | 5 | 62 | 62 | 124 | 143 | 2.40 (95) | 9.4 | 0.84 | 118 | -0.045 (0.00) |

Flown on grass (flat, calm, ISA). game = the pilot as it ships; POH = the same pilot on the handbook schedule.

| load | who | TO roll | Vlof | TO 50 ft | climb m/s @ km/h (thr) | LDG roll | LDG 50 ft | flap flown | outcome |
|---|---|---|---|---|---|---|---|---|---|
| min | game | 87 | 61 | 260 | 3.70 @ 88 (0.99) | 159 | 456 | 0.00 | stopped |
| min | poh | 91 | 65 | 282 | 3.36 @ 80 (0.96) | 115 | 409 | 0.00 | stopped |
| typ | game | 94 | 62 | 289 | 3.46 @ 88 (1.00) | 158 | 473 | 0.00 | stopped |
| typ | poh | 102 | 67 | 313 | 3.18 @ 77 (0.99) | 113 | 417 | 0.00 | stopped |
| mtow | game | 135 | 61 | 433 | 2.49 @ 86 (1.00) | 160 | 444 | 0.00 | stopped |
| mtow | poh | 156 | 70 | 376 | 2.25 @ 79 (1.00) | 96 | 380 | 0.00 | stopped |

Technique sweep at mtow (550 kg; 12 flights): best TO roll 130 m (rotate 1 Vs, flap 0.25), best TO 50 ft 358 m, best climb 2.61 m/s (1 x the probe's Vy), best landing roll 68 m (brake 1 at 1/s from 1.2 Vs, approach 1.3 Vs0).
**The pilot's share** (game − best, at mtow): TO roll +5 m, TO 50 ft +75 m, climb +0.12 m/s, landing roll +92 m.

| indicator | reading | reference (band) | at kg | ours at those kg | verdict | ours equals theirs at |
|---|---|---|---|---|---|---|
| empty kg | ledger | 345 (335–355) | — | 355 | **inside** | — |
| Vs1 km/h | airframe | 61 (58–64) | 423–550 | 54–62 | **inside** (extrap.) | 544 kg (≈ gross) |
| V75 km/h | airframe | 117–121 (112–127) | 423–550 | 124–128 | **inside** (extrap.) | 668 kg (above gross) |
| Vmax km/h | airframe | 140 (133–147) | 423–550 | 143–145 | **inside** (extrap.) | — |
| roc m/s | airframe | 2.29 (2.17–2.40) | 423–550 | 2.40–3.72 | **near** (extrap.) | 561 kg (≈ gross) |
| roc m/s | POH | 2.29 (2.17–2.40) | 423–550 | 2.25–3.46 | **inside** (extrap.) | 547 kg (≈ gross) |
| roc m/s | game | 2.29 (2.17–2.40) | 423–550 | 2.49–3.79 | **near** (extrap.) | 570 kg (above gross) |
| LD  | airframe | 9.5 (8.6–10.5) | 423–550 | 9.4 | **inside** (extrap.) | — |
| TO m | airframe (grass) | 113 (101–124) | 423–550 | 83–118 | **inside** (extrap.) | 531 kg (≈ gross) |
| TO m | POH | 113 (101–124) | 423–550 | 86–156 | **inside** (extrap.) | 470 kg (≈ solo, half fuel) |
| TO m | game | 113 (101–124) | 423–550 | 83–135 | **inside** (extrap.) | 496 kg (between solo and gross) |
| LDG m | POH | 88 (80–97) | 423–550 | 96–117 | **inside** (extrap.) | 599 kg (above gross) |
| LDG m | game | 88 (80–97) | 423–550 | 159–160 | **outside** (extrap.) | — |

### Jodel D112 (official) — against the Jodel D.112 (A-65)

Build `builds/jodel_2026-09-20_corrected.json` through the load door; 65 hp Continental A-65, S 13.8 m², empty 344 kg, as baked 472 kg, fuel 38 kg, 2 seats. Reference: Wikipedia D.11 / aircraft-catalog D.112: 320 / 530 kg, 12.7 m2, cruise 100 mph, Vmax 124 mph, climb "800 fpm / 2 m/s"; club stall 60-65 km/h (perf_study REAL.d112).

| load | mass kg | CG % MAC | SM % | Vs | Vs0 | V75 | Vmax | ROC m/s (Vy) | L/D | CdS | TO grass (analytic) | approach trim de (flap) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| min | 423 | 27 | 4 | 65 | 65 | 142 | 163 | 3.22 (107) | 9.0 | 0.56 | 130 | 0.011 (0.00) |
| typ | 443 | 26 | 5 | 66 | 66 | 141 | 163 | 2.96 (106) | 9.0 | 0.56 | 139 | 0.028 (0.00) |
| mtow | 530 | 27 | 4 | 73 | 73 | 134 | 159 | 2.00 (109) | 9.0 | 0.56 | 185 | 0.025 (0.00) |

Flown on grass (flat, calm, ISA). game = the pilot as it ships; POH = the same pilot on the handbook schedule.

| load | who | TO roll | Vlof | TO 50 ft | climb m/s @ km/h (thr) | LDG roll | LDG 50 ft | flap flown | outcome |
|---|---|---|---|---|---|---|---|---|---|
| min | game | 145 | 73 | 476 | 3.06 @ 103 (0.98) | — | — | 0.00 | clock, 2 GA |
| min | poh | 157 | 78 | 470 | 3.00 @ 97 (0.97) | — | — | 0.00 | clock, 2 GA |
| typ | game | 159 | 74 | 519 | 2.88 @ 103 (1.00) | 238 | 530 | 0.00 | stopped |
| typ | poh | 176 | 80 | 500 | 2.74 @ 91 (1.00) | 157 | 449 | 0.00 | stopped |
| mtow | game | 252 | 78 | 782 | 1.91 @ 100 (1.00) | 247 | 519 | 0.00 | stopped |
| mtow | poh | 440 | 105 | 621 | 1.69 @ 92 (1.00) | 133 | 405 | 0.00 | stopped |

Technique sweep at mtow (530 kg; 12 flights): best TO roll 246 m (rotate 1.1 Vs, flap 0.25), best TO 50 ft 594 m, best climb 2.00 m/s (1 x the probe's Vy), best landing roll 84 m (brake 1 at 1/s from 1.2 Vs, approach 1.3 Vs0).
**The pilot's share** (game − best, at mtow): TO roll +6 m, TO 50 ft +188 m, climb +0.09 m/s, landing roll +163 m.

| indicator | reading | reference (band) | at kg | ours at those kg | verdict | ours equals theirs at |
|---|---|---|---|---|---|---|
| empty kg | ledger | 320 (304–336) | — | 344 | **near** | — |
| Vs1 km/h | airframe | 60–65 (57–68) | 398–530 | 63–73 | **inside** (extrap.) | 392 kg (below our lightest load) |
| V75 km/h | airframe | 150–161 (143–169) | 398–530 | 134–144 | **inside** (extrap.) | — |
| Vmax km/h | airframe | 175–200 (166–210) | 398–530 | 159–164 | **near** (extrap.) | — |
| roc m/s | airframe | 2.00–4.06 (1.90–4.27) | 398–530 | 2.00–3.51 | **inside** (extrap.) | 438 kg (≈ MIN) |
| roc m/s | POH | 2.00–4.06 (1.90–4.27) | 398–530 | 1.69–3.31 | **inside** (extrap.) | 420 kg (≈ MIN) |
| roc m/s | game | 2.00–4.06 (1.90–4.27) | 398–530 | 1.91–3.33 | **inside** (extrap.) | 427 kg (≈ MIN) |
| LD  | airframe | 10.0 (9.0–11.0) | 398–530 | 9.0 | **near** (extrap.) | — |
| TO m | airframe (grass) | 200 (180–220) | 530 | 185 | **inside** | 558 kg (above gross) |
| TO m | POH | 200 (180–220) | 530 | 440 | **outside** | 451 kg (≈ solo, half fuel) |
| TO m | game | 200 (180–220) | 530 | 252 | **outside** | 481 kg (between solo and gross) |
| LDG m | POH | 150 (128–173) | 398–530 | 133–169 | **inside** (extrap.) | 468 kg (between solo and gross) |
| LDG m | game | 150 (128–173) | 398–530 | 234–247 | **outside** (extrap.) | — |

### Metal Cessna B-CESS (official) — against the Cessna 172R (IO-360-L2A 160 hp)

Build `builds/cessna172_2026-09-20.json` through the load door; 235 hp Lycoming O-540-B2C5, S 18.4 m², empty 710 kg, as baked 1062 kg, fuel 153 kg, 4 seats. **Engine:** the build flies an O-540 235 hp (the type: IO-360 160 hp) on an 18.4 m2 wing (16.2): power-bound rows are not like for like. Reference: Cessna 172R POH (1996+), section 4-5: Vs1 44 KIAS / 51 KCAS flaps up at 2450 lb, Vs0 47 KCAS, Vr 55 KIAS, Vy 79 KIAS, 720 fpm, ground roll 945 ft / 50 ft 1685 ft (flaps 0-10, paved), landing roll 550 ft / 50 ft 1295 ft (flaps 30, max braking, paved); 75 % cruise ~118 KTAS at SL.

| load | mass kg | CG % MAC | SM % | Vs | Vs0 | V75 | Vmax | ROC m/s (Vy) | L/D | CdS | TO grass (analytic) | approach trim de (flap) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| min | 818 | 21 | 20 | 77 | 67 | 219 | 243 | 8.82 (149) | 10.5 | 0.66 | 112 | 0.424 (0.75) |
| typ | 866 | 21 | 20 | 79 | 69 | 219 | 243 | 8.21 (150) | 10.5 | 0.66 | 120 | 0.407 (0.75) |
| mtow | 1111 | 29 | 14 | 89 | 78 | 215 | 241 | 5.83 (152) | 10.5 | 0.66 | 162 | 0.169 (0.75) |
| mtowF | 1111 | 21 | 22 | 89 | 78 | 215 | 241 | 5.83 (152) | 10.5 | 0.66 | 162 | 0.407 (0.75) |
| mtowA | 1111 | 29 | 14 | 89 | 78 | 215 | 241 | 5.83 (152) | 10.5 | 0.66 | 162 | 0.169 (0.75) |

Flown on paved (flat, calm, ISA). game = the pilot as it ships; POH = the same pilot on the handbook schedule.

| load | who | TO roll | Vlof | TO 50 ft | climb m/s @ km/h (thr) | LDG roll | LDG 50 ft | flap flown | outcome |
|---|---|---|---|---|---|---|---|---|---|
| min | game | 148 | 106 | 287 | 7.34 @ 146 (0.92) | 614 | 1060 | 0.00 | stopped |
| min | poh | 135 | 102 | 284 | 7.21 @ 139 (0.90) | 379 | 800 | 0.75 | stopped |
| typ | game | 159 | 106 | 304 | 6.83 @ 141 (0.92) | 643 | 1092 | 0.00 | stopped |
| typ | poh | 149 | 103 | 309 | 6.67 @ 134 (0.91) | 406 | 837 | 0.75 | stopped |
| mtow | game | 225 | 110 | 430 | 4.92 @ 136 (0.96) | 656 | 1079 | 0.00 | stopped |
| mtow | poh | 229 | 110 | 432 | 5.41 @ 137 (1.00) | 166 | 499 | 0.75 | stopped |
| mtowF | game | 257 | 115 | 547 | 4.81 @ 136 (0.96) | 855 | 1196 | 0.00 | stopped |
| mtowF | poh | 256 | 115 | 531 | 5.15 @ 137 (1.00) | 581 | 947 | 0.75 | stopped |
| mtowA | game | 225 | 110 | 430 | 4.92 @ 136 (0.96) | 656 | 1079 | 0.00 | stopped |
| mtowA | poh | 229 | 110 | 432 | 5.41 @ 137 (1.00) | 166 | 499 | 0.75 | stopped |

Technique sweep at mtow (1111 kg; 12 flights): best TO roll 213 m (rotate 1 Vs, flap 0.25), best TO 50 ft 408 m, best climb 6.33 m/s (1.15 x the probe's Vy), best landing roll 137 m (brake 1 at 1/s from 1.2 Vs, approach 1.3 Vs0).
**The pilot's share** (game − best, at mtow): TO roll +12 m, TO 50 ft +22 m, climb +1.42 m/s, landing roll +519 m.

| indicator | reading | reference (band) | at kg | ours at those kg | verdict | ours equals theirs at |
|---|---|---|---|---|---|---|
| empty kg | ledger | 736 (714–758) | — | 710 | **near** | — |
| Vs1 km/h | airframe | 94 (92–97) | 1111 | 89 | **near** | 1232 kg (above gross) |
| V75 km/h | airframe | 219 (208–229) | 1111 | 215 | **inside** | — |
| Vmax km/h | airframe | 230 (218–241) | 1111 | 241 | **inside** | — |
| roc m/s | airframe | 3.66 (3.55–3.77) | 1111 | 5.83 | **outside** | 1335 kg (above gross) |
| roc m/s | POH | 3.66 (3.55–3.77) | 1111 | 5.41 | **outside** | — |
| roc m/s | game | 3.66 (3.55–3.77) | 1111 | 4.92 | **outside** | 1273 kg (above gross) |
| LD  | airframe | 9.0 (8.1–9.9) | 1111 | 10.5 | **near** | — |
| TO m | airframe (grass) | 288 (279–297) | 1111 | 162 | **outside** | — |
| TO m | POH | 288 (279–297) | 1111 | 229 | **outside** | 1292 kg (above gross) |
| TO m | game | 288 (279–297) | 1111 | 225 | **outside** | 1344 kg (above gross) |
| TO50 m | POH | 514 (498–529) | 1111 | 432 | **outside** | 1273 kg (above gross) |
| TO50 m | game | 514 (498–529) | 1111 | 430 | **outside** | 1275 kg (above gross) |
| LDG m | POH | 168 (159–176) | 1111 | 166 | **inside** | 1108 kg (≈ gross) |
| LDG m | game | 168 (159–176) | 1111 | 656 | **outside** | — |
| LDG50 m | POH | 395 (375–414) | 1111 | 499 | **outside** | 1187 kg (above gross) |
| LDG50 m | game | 395 (375–414) | 1111 | 1079 | **outside** | — |

### Cessna 172 (corrected, internal) — against the Cessna 172R (IO-360-L2A 160 hp)

Build `builds/cessna172_2026-09-20_corrected.json` through the load door; 159 hp custom Flat (boxer) 4-cyl 5.9 L, S 16.5 m², empty 639 kg, as baked 977 kg, fuel 138 kg, 4 seats. Reference: Cessna 172R POH (1996+), section 4-5: Vs1 44 KIAS / 51 KCAS flaps up at 2450 lb, Vs0 47 KCAS, Vr 55 KIAS, Vy 79 KIAS, 720 fpm, ground roll 945 ft / 50 ft 1685 ft (flaps 0-10, paved), landing roll 550 ft / 50 ft 1295 ft (flaps 30, max braking, paved); 75 % cruise ~118 KTAS at SL.

| load | mass kg | CG % MAC | SM % | Vs | Vs0 | V75 | Vmax | ROC m/s (Vy) | L/D | CdS | TO grass (analytic) | approach trim de (flap) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| min | 744 | 33 | 21 | 77 | 67 | 204 | 227 | 6.31 (142) | 11.2 | 0.55 | 150 | 0.092 (0.75) |
| typ | 788 | 33 | 21 | 79 | 69 | 203 | 226 | 5.82 (142) | 11.2 | 0.54 | 161 | 0.091 (0.75) |
| mtow | 1111 | 43 | 14 | 93 | 82 | 194 | 221 | 3.31 (145) | 11.2 | 0.54 | 265 | -0.068 (0.75) |

Flown on paved (flat, calm, ISA). game = the pilot as it ships; POH = the same pilot on the handbook schedule.

| load | who | TO roll | Vlof | TO 50 ft | climb m/s @ km/h (thr) | LDG roll | LDG 50 ft | flap flown | outcome |
|---|---|---|---|---|---|---|---|---|---|
| min | game | 161 | 99 | 303 | 5.55 @ 143 (0.93) | 242 | 475 | 1.00 | stopped |
| min | poh | 133 | 91 | 286 | 5.39 @ 134 (0.91) | 118 | 340 | 0.75 | stopped |
| typ | game | 172 | 99 | 328 | 5.19 @ 139 (0.94) | 243 | 475 | 1.00 | stopped |
| typ | poh | 148 | 92 | 322 | 4.95 @ 128 (0.92) | 122 | 345 | 0.75 | stopped |
| mtow | game | 262 | 99 | 738 | 3.05 @ 136 (0.99) | 231 | 431 | 1.00 | stopped |
| mtow | poh | 275 | 102 | 760 | 3.29 @ 140 (1.00) | 138 | 375 | 0.75 | stopped |

Technique sweep at mtow (1111 kg; 12 flights): best TO roll 275 m (rotate 1.1 Vs, flap 0.25), best TO 50 ft 657 m, best climb 3.46 m/s (1.15 x the probe's Vy), best landing roll 117 m (brake 1 at 1/s from 1.2 Vs, approach 1.3 Vs0).
**The pilot's share** (game − best, at mtow): TO roll -12 m, TO 50 ft +81 m, climb +0.41 m/s, landing roll +114 m.

| indicator | reading | reference (band) | at kg | ours at those kg | verdict | ours equals theirs at |
|---|---|---|---|---|---|---|
| empty kg | ledger | 736 (714–758) | — | 639 | **outside** | — |
| Vs1 km/h | airframe | 94 (92–97) | 1111 | 93 | **inside** | 1132 kg (above gross) |
| V75 km/h | airframe | 219 (208–229) | 1111 | 194 | **near** | — |
| Vmax km/h | airframe | 230 (218–241) | 1111 | 221 | **inside** | — |
| roc m/s | airframe | 3.66 (3.55–3.77) | 1111 | 3.31 | **near** | 1068 kg (between solo and gross) |
| roc m/s | POH | 3.66 (3.55–3.77) | 1111 | 3.29 | **near** | 1040 kg (between solo and gross) |
| roc m/s | game | 3.66 (3.55–3.77) | 1111 | 3.05 | **outside** | 1020 kg (between solo and gross) |
| LD  | airframe | 9.0 (8.1–9.9) | 1111 | 11.2 | **outside** | — |
| TO m | airframe (grass) | 288 (279–297) | 1111 | 265 | **near** | 1182 kg (above gross) |
| TO m | POH | 288 (279–297) | 1111 | 275 | **near** | 1145 kg (above gross) |
| TO m | game | 288 (279–297) | 1111 | 262 | **near** | 1202 kg (above gross) |
| TO50 m | POH | 514 (498–529) | 1111 | 760 | **outside** | 930 kg (between solo and gross) |
| TO50 m | game | 514 (498–529) | 1111 | 738 | **outside** | 935 kg (between solo and gross) |
| LDG m | POH | 168 (159–176) | 1111 | 138 | **outside** | — |
| LDG m | game | 168 (159–176) | 1111 | 231 | **outside** | — |
| LDG50 m | POH | 395 (375–414) | 1111 | 375 | **inside** | 1320 kg (above gross) |
| LDG50 m | game | 395 (375–414) | 1111 | 431 | **near** | 1382 kg (above gross) |

### Metal Cessna on floats (official) — against the Cessna 172 on Wipline 2350 floats (160-180 hp)

Build `builds/cessna172_floats_2026-11.json` through the load door; 235 hp Lycoming O-540-B2C5, S 18.4 m², empty 842 kg, as baked 1195 kg, fuel 153 kg, 4 seats. **Engine:** O-540 235 hp against the 160-180 hp the references cover. Reference: GATE HYDROTRIM brief (Wipaire ~335-365 m, 20-35 s, 160-180 hp); wipaire.com 2350 tag page (search extract): water run 1645 ft, over 50 ft 2463 ft, ROC 749 fpm, configuration unstated; STC gross 1157 kg (G3390).

| load | mass kg | CG % MAC | SM % | Vs | Vs0 | V75 | Vmax | ROC m/s (Vy) | L/D | CdS | TO grass (analytic) | approach trim de (flap) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| min | 950 | 24 | 18 | 82 | 72 | 213 | 230 | 9.36 (140) | 10.5 | 0.66 | 1022 | 0.339 (0.75) |
| typ | 998 | 24 | 17 | 85 | 74 | 213 | 229 | 8.78 (139) | 10.5 | 0.66 | 1031 | 0.329 (0.75) |
| mtow | 1240 | 31 | 13 | 94 | 83 | 210 | 227 | 6.45 (146) | 10.5 | 0.66 | 1084 | 0.133 (0.75) |

| load | water: POH rig run / time | rig (no flap) | hump R/W | game pilot (SEA lane) run / time / 50 ft / climb |
|---|---|---|---|---|
| min | 112 m / 9.1 s | 160 m / 10.8 s | 0.140 | 201 m / 12.6 s / 305 m / 5.63 m/s (stopped) |
| typ | 128 m / 10.1 s | 181 m / 12.0 s | 0.141 | 219 m / 13.7 s / 324 m / 5.45 m/s (stopped) |
| mtow | 234 m / 16.9 s | 334 m / 20.1 s | 0.150 | 310 m / 19.5 s / 454 m / 4.94 m/s (stopped) |

| indicator | reading | reference (band) | at kg | ours at those kg | verdict | ours equals theirs at |
|---|---|---|---|---|---|---|
| Vs1 km/h | airframe | 94 (90–99) | 1157 | 91 | **inside** | 1245 kg (≈ gross) |
| roc m/s | airframe | 3.35–3.80 (3.19–4.00) | 994–1157 | 7.25–8.83 | **outside** | 1539 kg (above gross) |
| TOW m | POH (water rig) | 335–501 (318–526) | 994–1157 | 126–198 | **outside** | — |
| TOW m | rig (no flap) | 335–501 (318–526) | 994–1157 | 179–282 | **outside** | 1372 kg (above gross) |
| TOW m | game | 335–501 (318–526) | 994–1157 | 217–279 | **outside** | 1526 kg (above gross) |
| TOWs s | POH (water rig) | 20.0–35.0 (19.0–36.8) | 994–1157 | 10.0–14.5 | **outside** | 1609 kg (above gross) |
| TOWs s | rig (no flap) | 20.0–35.0 (19.0–36.8) | 994–1157 | 11.9–17.3 | **near** | 1464 kg (above gross) |
| TOWs s | game | 20.0–35.0 (19.0–36.8) | 994–1157 | 13.6–17.5 | **near** | 1578 kg (above gross) |
| TOW50 m | game | 751 (676–826) | 994–1157 | 322–409 | **outside** | — |

### PA-18 on floats (official) — against the Piper PA-18 Super Cub on floats (O-320)

Build `builds/pa18_floats_2026-10-23.json` through the load door; 150 hp Lycoming O-320-E2D, S 17.6 m², empty 564 kg, as baked 752 kg, fuel 98 kg, 2 seats. **Engine:** O-320 150 hp against Wipaire's 160 hp; EDO-style seaplane floats against Wipline amphibians. Reference: Wipaire PA-18/PA-12 Product & Modification Guide (Wipline 2100 amphibian, O-320 160 hp): gross 1776 lb: TO run land 588 ft, water 776 ft, over 50 ft water 1294 ft, ROC 925 fpm; at 2000 lb: water 1174 ft, 50 ft 1956 ft, ROC 756 fpm.

| load | mass kg | CG % MAC | SM % | Vs | Vs0 | V75 | Vmax | ROC m/s (Vy) | L/D | CdS | TO grass (analytic) | approach trim de (flap) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| min | 658 | 19 | 21 | 67 | 58 | 163 | 185 | 5.51 (114) | 8.9 | 0.93 | 708 | 0.176 (0.86) |
| typ | 693 | 20 | 21 | 69 | 60 | 163 | 185 | 5.12 (117) | 8.9 | 0.93 | 718 | 0.162 (0.86) |
| mtow | 806 | 30 | 11 | 74 | 65 | 160 | 183 | 4.05 (119) | 8.9 | 0.93 | 746 | -0.226 (0.86) |

| load | water: POH rig run / time | rig (no flap) | hump R/W | game pilot (SEA lane) run / time / 50 ft / climb |
|---|---|---|---|---|
| min | 109 m / 12.1 s | 136 m / 12.6 s | 0.128 | 166 m / 14.7 s / 257 m / 4.88 m/s (stopped) |
| typ | 133 m / 14.3 s | 159 m / 14.3 s | 0.131 | 187 m / 16.5 s / 285 m / 4.76 m/s (stopped) |
| mtow | 292 m / 29.4 s | 260 m / 23.1 s | 0.139 | 297 m / 27.5 s / 437 m / 4.17 m/s (stopped) |

| indicator | reading | reference (band) | at kg | ours at those kg | verdict | ours equals theirs at |
|---|---|---|---|---|---|---|
| Vs1 km/h | airframe | 69 (66–73) | 806 | 74 | **near** | 695 kg (≈ solo, half fuel) |
| roc m/s | airframe | 4.70 (4.46–4.93) | 806 | 4.05 | **near** | 738 kg (between solo and gross) |
| roc2 m/s | airframe | 3.84 (3.65–4.03) | 907 | 3.04 | **outside** (extrap.) | 827 kg (above gross) |
| TOW m | POH (water rig) | 237 (225–248) | 806 | 292 | **outside** | 767 kg (between solo and gross) |
| TOW m | rig (no flap) | 237 (225–248) | 806 | 260 | **near** | 780 kg (between solo and gross) |
| TOW m | game | 237 (225–248) | 806 | 297 | **outside** | 744 kg (between solo and gross) |
| TOW2 m | POH (water rig) | 358 (340–376) | 907 | 416 | **outside** (extrap.) | 854 kg (above gross) |
| TOW2 m | rig (no flap) | 358 (340–376) | 907 | 345 | **inside** (extrap.) | 916 kg (above gross) |
| TOW2 m | game | 358 (340–376) | 907 | 386 | **near** (extrap.) | 870 kg (above gross) |
| TOW50 m | game | 394 (375–414) | 806 | 437 | **near** | 774 kg (between solo and gross) |

### Chinook (official, out of the battery) — against the Chinook Plus 2 (Rotax 582)

Build `builds/chinook_2026-09-21_corrected.json` through the load door; 64 hp Rotax 582 + 2.62 red., S 13.1 m², empty 235 kg, as baked 353 kg, fuel 27 kg, 2 seats. Reference: ASAP Chinook Plus 2 sheet / pilotmix (perf_study REAL.chinook): stall 35 mph, cruise 83 mph, max 95, 1200 fpm, TO 200 ft, ldg 300 ft.

| load | mass kg | CG % MAC | SM % | Vs | Vs0 | V75 | Vmax | ROC m/s (Vy) | L/D | CdS | TO grass (analytic) | approach trim de (flap) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| min | 312 | 39 | 4 | 55 | 55 | 139 | 154 | 6.35 (94) | 8.8 | 0.72 | 53 | 0.069 (0.00) |
| typ | 329 | 37 | 6 | 57 | 57 | 138 | 154 | 5.93 (93) | 8.8 | 0.72 | 59 | 0.106 (0.00) |
| mtow | 476 | 37 | 9 | 68 | 68 | 134 | 151 | 3.42 (99) | 8.8 | 0.72 | 144 | 0.122 (0.00) |

Flown on grass (flat, calm, ISA). game = the pilot as it ships; POH = the same pilot on the handbook schedule.

| load | who | TO roll | Vlof | TO 50 ft | climb m/s @ km/h (thr) | LDG roll | LDG 50 ft | flap flown | outcome |
|---|---|---|---|---|---|---|---|---|---|
| min | game | — | — | — | — @ — (—) | — | — | — | gave-up |
| min | poh | — | — | — | — @ — (—) | — | — | — | gave-up |
| typ | game | — | — | — | — @ — (—) | — | — | — | gave-up |
| typ | poh | — | — | — | — @ — (—) | — | — | — | gave-up |
| mtow | game | — | — | — | — @ — (—) | — | — | — | stopped |
| mtow | poh | — | — | — | — @ — (—) | — | — | — | stopped |

Technique sweep at mtow (476 kg; 12 flights): best TO roll — m, best TO 50 ft — m, best climb — m/s, best landing roll — m.
**The pilot's share** (game − best, at mtow): TO roll — m, TO 50 ft — m, climb — m/s, landing roll — m.

| indicator | reading | reference (band) | at kg | ours at those kg | verdict | ours equals theirs at |
|---|---|---|---|---|---|---|
| empty kg | ledger | 172–209 (167–215) | — | 235 | **near** | — |
| Vs1 km/h | airframe | 56 (54–59) | 286–476 | 53–68 | **inside** (extrap.) | 327 kg (≈ MIN) |
| V75 km/h | airframe | 116–134 (110–140) | 286–476 | 134–140 | **inside** (extrap.) | — |
| Vmax km/h | airframe | 153 (145–161) | 286–476 | 151–155 | **inside** (extrap.) | — |
| roc m/s | airframe | 5.08–6.10 (4.83–6.40) | 286–476 | 3.42–6.82 | **inside** (extrap.) | 349 kg (between solo and gross) |
| LD  | airframe | 10.0 (9.0–11.0) | 286–476 | 8.8 | **near** (extrap.) | — |
| TO m | airframe (grass) | 61–76 (58–80) | 286–476 | 38–144 | **inside** (extrap.) | 346 kg (≈ solo, half fuel) |

### Super Petrel V4.1 (claude/hull-types) — against the Super Petrel LS (Rotax 912 iS)

Build `builds/candidates/superpetrel_V4_1.json` through the load door; 99 hp Rotax 912 iS, S 14.5 m², empty 380 kg, as baked 592 kg, fuel 52 kg, 2 seats. Reference: maker / Wikipedia EDRA Super Petrel / pilotmix: 320 / 600 kg, stall 56 km/h (Wikipedia) or 37 kt (maker), cruise ~86 kt, VH ~97 kt, climb 1000-1400 fpm, take-off run land 80 m, water 120 m (Wikipedia; a review: water < 400 ft, hard surface 260 ft).

| load | mass kg | CG % MAC | SM % | Vs | Vs0 | V75 | Vmax | ROC m/s (Vy) | L/D | CdS | TO grass (analytic) | approach trim de (flap) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| min | 463 | 31 | 4 | 66 | 66 | 168 | 189 | 5.80 (115) | 9.9 | 0.59 | 89 | 0.033 (0.00) |
| typ | 486 | 32 | 3 | 67 | 67 | 168 | 188 | 5.43 (118) | 9.9 | 0.59 | 95 | 0.016 (0.00) |
| mtow | 600 | 21 | 16 | 75 | 75 | 164 | 186 | 3.96 (120) | 9.9 | 0.59 | 128 | 0.189 (0.00) |

Flown on paved (flat, calm, ISA). game = the pilot as it ships; POH = the same pilot on the handbook schedule.

| load | who | TO roll | Vlof | TO 50 ft | climb m/s @ km/h (thr) | LDG roll | LDG 50 ft | flap flown | outcome |
|---|---|---|---|---|---|---|---|---|---|
| min | game | 109 | 88 | 227 | 4.21 @ 110 (0.76) | 435 | 835 | 0.00 | stopped |
| min | poh | 99 | 85 | 224 | 2.93 @ 93 (0.66) | 314 | 714 | 0.00 | stopped |
| typ | game | 114 | 88 | 238 | 4.19 @ 110 (0.80) | 440 | 835 | 0.00 | stopped |
| typ | poh | 108 | 86 | 236 | 3.01 @ 95 (0.70) | 313 | 708 | 0.00 | stopped |
| mtow | game | 192 | 98 | 358 | 2.42 @ 117 (0.75) | 457 | 811 | 0.00 | stopped |
| mtow | poh | 187 | 98 | 359 | 2.07 @ 115 (0.70) | 366 | 720 | 0.00 | stopped |

Technique sweep at mtow (600 kg; 9 flights): best TO roll 184 m (rotate 1 Vs, flap 0.00), best TO 50 ft 355 m, best climb 4.26 m/s (1.15 x the probe's Vy), best landing roll 182 m (brake 1 at 1/s from 1.2 Vs, approach 1.3 Vs0).
**The pilot's share** (game − best, at mtow): TO roll +8 m, TO 50 ft +4 m, climb +1.84 m/s, landing roll +275 m.

| load | water: POH rig run / time | rig (no flap) | hump R/W | game pilot (SEA lane) run / time / 50 ft / climb |
|---|---|---|---|---|
| min | 135 m / 12.6 s | 173 m / 14.2 s | 0.216 | — m / — s / — m / — m/s (stopped) |
| typ | 227 m / 17.7 s | 200 m / 16.3 s | 0.223 | — m / — s / — m / — m/s (stopped) |
| mtow | 338 m / 30.8 s | 463 m / 35.5 s | 0.220 | 317 m / 25.1 s / 510 m / 2.42 m/s (stopped) |

| indicator | reading | reference (band) | at kg | ours at those kg | verdict | ours equals theirs at |
|---|---|---|---|---|---|---|
| empty kg | ledger | 320 (304–336) | — | 380 | **outside** | — |
| Vs1 km/h | airframe | 56–68 (54–70) | 406–600 | 62–75 | **inside** (extrap.) | 410 kg (below our lightest load) |
| V75 km/h | airframe | 159 (151–167) | 406–600 | 164–170 | **inside** (extrap.) | — |
| Vmax km/h | airframe | 180 (171–189) | 406–600 | 186–190 | **inside** (extrap.) | — |
| roc m/s | airframe | 5.08–7.11 (4.93–7.33) | 406–600 | 3.96–6.56 | **inside** (extrap.) | 445 kg (below our lightest load) |
| roc m/s | POH | 5.08–7.11 (4.93–7.33) | 406–600 | 2.07–3.28 | **outside** (extrap.) | — |
| roc m/s | game | 5.08–7.11 (4.93–7.33) | 406–600 | 2.42–4.94 | **inside** (extrap.) | — |
| TO m | airframe (grass) | 80–79 (75–84) | 406–600 | 73–128 | **inside** (extrap.) | 427 kg (below our lightest load) |
| TO m | POH | 80–79 (75–84) | 406–600 | 63–187 | **inside** (extrap.) | 410 kg (below our lightest load) |
| TO m | game | 80–79 (75–84) | 406–600 | 74–192 | **inside** (extrap.) | 337 kg (below our lightest load) |
| TOW m | POH (water rig) | 120–122 (114–128) | 406–600 | 51–338 | **inside** (extrap.) | — |
| TOW m | rig (no flap) | 120–122 (114–128) | 406–600 | 53–463 | **inside** (extrap.) | 418 kg (below our lightest load) |
| TOW m | game | 120–122 (114–128) | 406–600 | 317 | **outside** (extrap.) | — |
