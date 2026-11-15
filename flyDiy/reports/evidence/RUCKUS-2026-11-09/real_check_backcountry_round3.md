### ruckus_2026-11-09 — against the Top Rudder Ruckus, standard (Polini Thor 303, 37-38 hp)

Build `builds/candidates/ruckus_2026-11-09.json` through the load door; 64 hp Rotax 582 + 2.62 red., S 11.3 m², empty 206 kg, as baked 314 kg, fuel 27 kg, 1 seats. Reference: B&B Sport Aviation "RUCKUS - Airframe" sheet (pasted by the user 9 Nov): 254 / 550 lb, 17.5 ft, 28.4 ft, 122 ft2, Vs 24.1 mph, Vso 22, cruise 50, Vmax 54 at 37 hp, 650 fpm, L/D 4.6, TO 350 ft, LDG 300 ft, 5 gal.

| load | mass kg | CG % MAC | SM % | Vs | Vs0 | V75 | Vmax | ROC m/s (Vy) | L/D | CdS | TO grass (analytic) | approach trim de (flap) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| min | 283 | 28 | 26 | 47 | 45 | 94 | 109 | 4.30 (69) | 5.0 | 1.82 | 37 | 0.230 (0.50) |
| typ | 300 | 29 | 27 | 49 | 46 | 94 | 109 | 3.91 (71) | 5.0 | 1.82 | 42 | 0.217 (0.50) |
| mtow | 293 | 29 | 27 | 48 | 46 | 94 | 109 | 4.06 (70) | 5.0 | 1.82 | 40 | 0.219 (0.50) |
| mtowF | 293 | 29 | 27 | 48 | 46 | 94 | 109 | 4.06 (70) | 5.0 | 1.82 | 40 | 0.219 (0.50) |
| mtowA | 293 | 29 | 27 | 48 | 46 | 94 | 109 | 4.06 (70) | 5.0 | 1.82 | 40 | 0.219 (0.50) |

Flown on grass (flat, calm, ISA). game = the pilot as it ships; POH = the same pilot on the handbook schedule.

| load | who | TO roll | Vlof | TO 50 ft | climb m/s @ km/h (thr) | LDG roll | LDG 50 ft | flap flown | outcome |
|---|---|---|---|---|---|---|---|---|---|
| min | game | 44 | 55 | 144 | 3.78 @ 77 (0.97) | 26 | 168 | 1.00 | stopped |
| min | poh | 50 | 59 | 162 | 3.46 @ 72 (0.92) | 29 | 173 | 0.50 | stopped |
| typ | game | 50 | 56 | 157 | 3.48 @ 77 (0.98) | 27 | 169 | 1.00 | stopped |
| typ | poh | 57 | 61 | 179 | 3.22 @ 72 (0.94) | 30 | 175 | 0.50 | stopped |
| mtow | game | 48 | 56 | 152 | 3.60 @ 77 (0.98) | 26 | 169 | 1.00 | stopped |
| mtow | poh | 55 | 60 | 173 | 3.31 @ 72 (0.93) | 30 | 175 | 0.50 | stopped |
| mtowF | game | 48 | 56 | 152 | 3.60 @ 77 (0.98) | 26 | 169 | 1.00 | stopped |
| mtowF | poh | 55 | 60 | 173 | 3.31 @ 72 (0.93) | 30 | 175 | 0.50 | stopped |
| mtowA | game | 48 | 56 | 152 | 3.60 @ 77 (0.98) | 26 | 169 | 1.00 | stopped |
| mtowA | poh | 55 | 60 | 173 | 3.31 @ 72 (0.93) | 30 | 175 | 0.50 | stopped |

Technique sweep at mtow (293 kg; 13 flights): best TO roll 51 m (rotate 1 Vs, flap 0.25), best TO 50 ft 163 m, best climb 3.79 m/s (1 x the probe's Vy), best landing roll 24 m (brake 1 at 1/s from 1.2 Vs, approach 1.3 Vs0, the short-field stop).
**The pilot's share** (game − best, at mtow): TO roll -4 m, TO 50 ft -12 m, climb +0.19 m/s, landing roll +3 m.

| indicator | reading | reference (band) | at kg | ours at those kg | verdict | ours equals theirs at |
|---|---|---|---|---|---|---|
| empty kg | ledger | 115 (109–121) | — | 206 | **outside** | — |
| Vs1 km/h | airframe | 39 (37–41) | 249 | 45 | **near** (extrap.) | 179 kg (below our lightest load) |
| V75 km/h | airframe | 80 (76–84) | 188–249 | 96–96 | **outside** (extrap.) | — |
| Vmax km/h | airframe | 87 (83–91) | 249 | 110 | **outside** (extrap.) | — |
| roc m/s | airframe | 3.30 (3.14–3.47) | 249 | 5.08 | **outside** (extrap.) | 327 kg (above gross) |
| roc m/s | POH | 3.30 (3.14–3.47) | 249 | 3.93 | **outside** (extrap.) | 294 kg (≈ MIN) |
| roc m/s | game | 3.30 (3.14–3.47) | 249 | 4.38 | **outside** (extrap.) | 311 kg (above gross) |
| LD  | airframe | 4.6 (4.1–5.1) | 188–249 | 5.0 | **inside** (extrap.) | — |
| TO m | airframe (grass) | 107 (96–117) | 249 | 27 | **outside** (extrap.) | — |
| TO m | POH | 107 (96–117) | 249 | 34 | **outside** (extrap.) | — |
| TO m | game | 107 (96–117) | 249 | 31 | **outside** (extrap.) | — |
| LDG m | POH | 91 (82–101) | 249 | 26 | **outside** (extrap.) | — |
| LDG m | game | 91 (82–101) | 249 | 24 | **outside** (extrap.) | — |
