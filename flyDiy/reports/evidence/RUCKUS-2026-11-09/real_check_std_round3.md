### Top Rudder Ruckus, standard (candidate, from Rufus) — against the Top Rudder Ruckus, standard (Polini Thor 303, 37-38 hp)

Build `builds/candidates/ruckus_std_2026-11-09.json` through the load door; 38 hp custom Inline 1-cyl 0.3 L, S 11.3 m², empty 159 kg, as baked 253 kg, fuel 14 kg, 1 seats. Reference: B&B Sport Aviation "RUCKUS - Airframe" sheet (pasted by the user 9 Nov): 254 / 550 lb, 17.5 ft, 28.4 ft, 122 ft2, Vs 24.1 mph, Vso 22, cruise 50, Vmax 54 at 37 hp, 650 fpm, L/D 4.6, TO 350 ft, LDG 300 ft, 5 gal.

| load | mass kg | CG % MAC | SM % | Vs | Vs0 | V75 | Vmax | ROC m/s (Vy) | L/D | CdS | TO grass (analytic) | approach trim de (flap) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| min | 233 | 37 | 16 | 43 | 41 | 75 | 90 | 2.32 (61) | 5.1 | 1.71 | 48 | 0.111 (0.50) |
| typ | 246 | 37 | 17 | 45 | 42 | 74 | 89 | 2.05 (60) | 5.1 | 1.71 | 56 | 0.106 (0.50) |
| mtow | 249 | 37 | 17 | 45 | 42 | 74 | 89 | 2.00 (60) | 5.1 | 1.71 | 57 | 0.107 (0.50) |
| mtowF | 249 | 37 | 17 | 45 | 42 | 74 | 89 | 2.00 (60) | 5.1 | 1.71 | 57 | 0.107 (0.50) |
| mtowA | 249 | 37 | 17 | 45 | 42 | 74 | 89 | 2.00 (60) | 5.1 | 1.71 | 57 | 0.107 (0.50) |

Flown on grass (flat, calm, ISA). game = the pilot as it ships; POH = the same pilot on the handbook schedule.

| load | who | TO roll | Vlof | TO 50 ft | climb m/s @ km/h (thr) | LDG roll | LDG 50 ft | flap flown | outcome |
|---|---|---|---|---|---|---|---|---|---|
| min | game | 58 | 51 | 209 | 2.05 @ 67 (1.00) | 22 | 160 | 1.00 | stopped |
| min | poh | 65 | 55 | 215 | — @ 58 (0.57) | 25 | 164 | 0.50 | stopped |
| typ | game | 68 | 52 | 246 | 1.82 @ 67 (1.00) | 23 | 162 | 1.00 | stopped |
| typ | poh | 77 | 57 | 245 | 1.68 @ 59 (0.96) | 26 | 166 | 0.50 | stopped |
| mtow | game | 70 | 53 | 250 | 1.78 @ 67 (1.00) | 23 | 162 | 1.00 | stopped |
| mtow | poh | 79 | 57 | 251 | 1.67 @ 59 (0.97) | 27 | 166 | 0.50 | stopped |
| mtowF | game | 70 | 53 | 250 | 1.78 @ 67 (1.00) | 23 | 162 | 1.00 | stopped |
| mtowF | poh | 79 | 57 | 251 | 1.67 @ 59 (0.97) | 27 | 166 | 0.50 | stopped |
| mtowA | game | 70 | 53 | 250 | 1.78 @ 67 (1.00) | 23 | 162 | 1.00 | stopped |
| mtowA | poh | 79 | 57 | 251 | 1.67 @ 59 (0.97) | 27 | 166 | 0.50 | stopped |

Technique sweep at mtow (249 kg; 13 flights): best TO roll 77 m (rotate 1 Vs, flap 0.00), best TO 50 ft 232 m, best climb 1.83 m/s (1 x the probe's Vy), best landing roll 21 m (brake 1 at 1/s from 1.2 Vs, approach 1.3 Vs0, the short-field stop).
**The pilot's share** (game − best, at mtow): TO roll -8 m, TO 50 ft +18 m, climb +0.06 m/s, landing roll +3 m.

| indicator | reading | reference (band) | at kg | ours at those kg | verdict | ours equals theirs at |
|---|---|---|---|---|---|---|
| empty kg | ledger | 115 (109–121) | — | 159 | **outside** | — |
| Vs1 km/h | airframe | 39 (37–41) | 249 | 45 | **outside** | 183 kg (below our lightest load) |
| V75 km/h | airframe | 80 (76–84) | 188–249 | 74–79 | **inside** (extrap.) | — |
| Vmax km/h | airframe | 87 (83–91) | 249 | 89 | **inside** | — |
| roc m/s | airframe | 3.30 (3.14–3.47) | 249 | 2.00 | **outside** | 183 kg (below our lightest load) |
| roc m/s | POH | 3.30 (3.14–3.47) | 249 | 1.67 | **outside** | — |
| roc m/s | game | 3.30 (3.14–3.47) | 249 | 1.78 | **outside** | 159 kg (below our lightest load) |
| LD  | airframe | 4.6 (4.1–5.1) | 188–249 | 5.1 | **near** (extrap.) | — |
| TO m | airframe (grass) | 107 (96–117) | 249 | 57 | **outside** | — |
| TO m | POH | 107 (96–117) | 249 | 79 | **outside** | 285 kg (above gross) |
| TO m | game | 107 (96–117) | 249 | 70 | **outside** | 300 kg (above gross) |
| LDG m | POH | 91 (82–101) | 249 | 27 | **outside** | — |
| LDG m | game | 91 (82–101) | 249 | 23 | **outside** | — |
