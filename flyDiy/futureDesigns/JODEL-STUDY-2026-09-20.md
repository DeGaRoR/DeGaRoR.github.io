# JODEL STUDY — the user's Jodel1050v1 taken back to a D.112 (2026-09-20)

"This one should be a jodel D112 (even though I sometimes mixed it a bit
with a DR1050)." Files: `builds/jodel_2026-09-20.json` (as found),
`builds/jodel_2026-09-20_corrected.json` (the deliverable; the shelf's
'jodel D112' row and the Jodel-alike card, G445.4), the instrument's traces
`.asfound.txt` / `.corrected.txt`. The page's own 'jodel' row (the template)
is untouched.

    node tools/perf_study.js --build=builds/jodel_2026-09-20_corrected.json --vs=d112 --fly

THE ROW `d112` (perf_study.js REAL) is new: A-65 65 hp, 8.20 m, 12.70 m²,
320 / 530 kg (Wikipedia's D.11 page, aircraft-catalog); stall 35 mph, cruise
100 mph, Vmax 124 mph, climb "800 fpm / 2 m/s" (sic) — the middle taken (2.5
m/s), V75 150, Vmax 175. The tail span 2.74 and the height 2.07 are the d112
reference payload's own (src/models/d112, scanned as the PA-18's was).

## 1. The numbers (at MTOW 530 kg)

| | empty | S | Vs1 | V75 | Vmax | ROC | L/D | TO roll | length |
|---|---|---|---|---|---|---|---|---|---|
| **D.112** | 320 | 12.7 | 56 | 150 | 175 | 2.5 | 10 | 200 | 6.20 |
| as found (4 seats, O-200, 98 L; 687 kg) | +40 % | +9 % | +47 % | −17 % | −9 % | −35 % | −24 % | +30 % | +19 % |
| **corrected** (2 seats, A-65, 45 L, 1.83 m prop) | +6 % | +9 % | +29 % | −11 % | −9 % | −20 % | −10 % | −2 % | +1 % |

Flown (corrected): take-off 287 m (+44 %), climb 1.6 m/s (−35 %), cruise 124
km/h at 0.82, landing 87 m, circuit completed.

Balance: as found CG 42 %, **static margin −5 %** (NP 37 %); corrected CG
34 %, margin 2 %, stab trim −3.1°, dε/dα 0.65 (the low tail sits in the
wing's downwash). Sandbags HELD, 56 %.

Registration F-PJDL, wear 0.1, and a livery (G445.5): ivory body, a burgundy
sweep under a gold line rising over the aft fuselage (marking kit pattern
2), burgundy spinner and registration.

## 2. What was corrected

The DR.1050 in it, taken out: `paxCount` 1 → 0 (the rear bench; cabin.len
0.55 → 0.16, the length 7.40 → 6.25 m against the D.112's 6.20), the O-200
→ the A-65 (the preset applied through the page's own door, index pinned),
98 → 45 L, the 1.77 m carbon prop → the A-65's 1.83 m. The wing (8.3 × 1.8 /
1.1 m, crank at 0.55, 17.5° outer dihedral — the Jodel's) and the tail
(2.71 m across, the payload says 2.74) are the user's and stay.

## 3. What is still off, and whose it is

- **Vs1 +29 %.** The published 35 mph would need a clean CLmax of 2.5 at 530
  kg on 12.7 m² — no D.112 has it; that figure is an ASI reading at the
  stall (position error). Ours, 72 km/h at CLmax ~1.5, is the honest one.
  The row keeps the published number with this note.
- **Static margin 2 %.** The pilot flies it (the 172 as found flew on 3 %),
  but a D.112 keeps ~10 %. READ AGAINST THE PAYLOAD (G445.5, a plane cut of
  the d112 model's triangles at |y| = 1.6 m): the leading edge sits 1.26 m
  behind the spinner tip on the model and 1.29 m on the build; the stab
  0.6 m above the wing root on the model, 0.8 m on the build. The wing is
  where the Jodel's is. What is left is the model's: the downwash kernel
  puts the tail's dε/dα at 0.65 and the neutral point at 36 % MAC, and the
  airframe's mass sits 4 % of chord aft of a D.112's loaded CG. An aero item
  (the C172 study's §5.1 says the same for a high wing), not a build fault.
- ROC −20 %, V75 −11 %: the 65 hp against the +9 % of wing and the drag
  family (§5.2 of the C172 study).
- The 45 L nose tank reads "through the crew (105 points)" on the bench —
  the same ENERGY item as the Cub's.
