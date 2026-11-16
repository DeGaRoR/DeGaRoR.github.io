# PC-6 TAIL-REFS, 16 Nov 2026 (FIT-PROCEDURE): the PC-6 on its oleo tailwheel against the real aeroplane

The branch claude/fit-procedure-pc6-tail-refs on claude/ready/skis-pc6-2 (3fe1c5cdd, on L40d). The card
builds/candidates/pc6_drafting_2026-11-11.json on the user's oleo tailwheel (twStyle 1, PC6-OLEO; the relaxed drop
0.58 m, static stroke 0.176 m, pitch 4.93 deg parked), the fuel the TCDS gives (492 L). The references: tools/real_refs.js
REFS.pc6 from tools/drafting/refs/pc6.json (FOCA TCDS F 56-10 issue 7 + the Pilatus factsheet, ISA). No re-tune.

## The run (node tools/real_check.js pc6, 951 s)

### Pilatus PC-6/B2-H4 Turbo Porter (the drafting table, the oleo tailwheel; candidate) — against the Pilatus PC-6/B2-H4 Turbo Porter (PT6A-27, 550 shp)

Build `builds/candidates/pc6_drafting_2026-11-11.json` through the load door; 550 hp P&W PT6A-27, S 30.3 m², empty 1081 kg, as baked 1317 kg, fuel 115 kg, 8 seats. Reference: FOCA TCDS F 56-10 issue 7 (the B2-H4 column) + Pilatus factsheet "PC-6 The world's leading STOL" (ISA): 2800 kg, 30.15 m2, flaps 28 / 38 deg, Vs1 58 KEAS / Vs0 52 KEAS at gross, climb 5.13 m/s, max cruise 125 KTAS, TO50 440 m, LDG50 315 m.

| load | mass kg | CG % MAC | SM % | Vs | Vs0 | V75 | Vmax | ROC m/s (Vy) | L/D | CdS | TO grass (analytic) | approach trim de (flap) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| min | 1180 | 39 | 11 | 69 | 60 | 253 | 275 | 17.54 (161) | 11.5 | 1.04 | 49 | -0.193 (0.95) |
| typ | 1219 | 37 | 14 | 70 | 61 | 253 | 275 | 16.93 (161) | 11.5 | 1.04 | 52 | -0.150 (0.95) |
| mtow | 2800 | 76 | -17 | 106 | 93 | 244 | 269 | 5.95 (169) | 11.5 | 1.04 | 345 | -1.103 (0.95) |

Flown on grass (flat, calm, ISA). game = the pilot as it ships; POH = the same pilot on the handbook schedule.

| load | who | TO roll | Vlof | TO 50 ft | climb m/s @ km/h (thr) | LDG roll | LDG 50 ft | flap flown | outcome |
|---|---|---|---|---|---|---|---|---|---|
| min | game | 58 | 88 | 176 | 13.55 @ 154 (0.86) | 208 | 482 | 0.70 | stopped |
| min | poh | 42 | 74 | 126 | 11.30 @ 141 (0.84) | 77 | 329 | 0.95 | stopped |
| typ | game | 64 | 91 | 187 | 13.24 @ 153 (0.86) | 218 | 496 | 0.70 | stopped |
| typ | poh | 45 | 76 | 135 | 11.08 @ 140 (0.85) | 81 | 337 | 0.95 | stopped |
| mtow | game | — | — | — | — @ — (—) | — | — | — | stopped |
| mtow | poh | — | — | — | — @ — (—) | — | — | — | stopped |

Technique sweep at mtow (2800 kg; 16 flights): best TO roll — m, best TO 50 ft — m, best climb — m/s, best landing roll — m.
**The pilot's share** (game − best, at mtow): TO roll — m, TO 50 ft — m, climb — m/s, landing roll — m.

| indicator | reading | reference (band) | at kg | ours at those kg | verdict | ours equals theirs at |
|---|---|---|---|---|---|---|
| empty kg | ledger | 1250 (1150–1350) | — | 1081 | **near** | — |
| Vs1 km/h | airframe | 107 (102–113) | 2800 | 106 | **inside** | 2870 kg (above gross) |
| Vmax km/h | airframe | 232 (208–255) | 1407–2800 | 269–275 | **near** | — |
| roc m/s | airframe | 5.13 (4.87–5.39) | 2800 | 5.95 | **outside** | 2922 kg (above gross) |
| roc m/s | POH | 5.13 (4.87–5.39) | 2800 | 10.01 | **outside** (extrap.) | — |
| roc m/s | game | 5.13 (4.87–5.39) | 2800 | 11.82 | **outside** (extrap.) | — |
| TO50 m | POH | 440 (396–484) | 1407–2800 | 174 | **outside** (extrap.) | — |
| TO50 m | game | 440 (396–484) | 1407–2800 | 237 | **outside** (extrap.) | — |
| LDG50 m | POH | 315 (284–347) | 1407–2800 | 376 | **near** (extrap.) | — |
| LDG50 m | game | 315 (284–347) | 1407–2800 | 560 | **outside** (extrap.) | 708 kg (below our lightest load) |

## Out of band, named (no re-tune: the rule)

- **MTOW is not flown: CG 76 % MAC, static margin -17 %.** The check's MTOW load (every seat at 80 kg, the fuel and the
  baggage topped to the TYPE's 2800 kg) puts ~600 kg in the aft bay over the card's 1317 kg as baked; the TCDS envelope at
  2800 kg is 32-38 % MAC. The type is never loaded so; its gross is reached with the cabin's benches forward. The
  MTOW flights stopped at 9 s, so every flown row at MTOW is EXTRAPOLATED from MIN / TYP. Owed: a PC-6 MTOW loading
  (seats on the TCDS stations 3050 / 3850 / 4570 / 5280 mm, the baggage limit) for the check - REAL-FIGURES' load door.
- **roc**: airframe 5.95 m/s at 2800 kg against 5.13 (+16 %), flown POH 10.0 / game 11.8 (extrapolated). The PT6A-27's
  550 shp on a 1081 kg empty card (the type's 1250) - the empty mass row is near (-13.5 %) and lighter means faster climb.
- **TO50**: 174 (POH) / 237 (game) m against 440 (extrapolated from the light loads; the reference states no weight).
- **LDG50**: POH 376 m near (+19 %), game 560 m outside (the pilot's own approach: flap 0.70, not the full flap).
- Vs1 106 km/h at 2800 kg: inside. Vmax 269-275 km/h against the factsheet's max cruise 232 (near: read as full power).
- empty 1081 kg against 1250 "depends on configuration": near. The oleo tail adds 30.5 kg of it (per-part bill).

## Ardent's pivot (A0 / SNOW-MUD, 15 Nov)

The 252 deg apron pivot is GATE SKISARDENT's leg; it is flown in this branch's gate run (the oleo PC-6 on skis).
