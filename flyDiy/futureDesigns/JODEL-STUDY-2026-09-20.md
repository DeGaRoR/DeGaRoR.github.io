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

## 4. THE MARGIN, WITH A FRESH MIND (2026-09-20, the user: "it's been a while
## that the game is calculating this wrong ... if the geometry is right, why
## would the CG/margin be wrong?")

Checked, in order, with numbers:

1. **The frames.** The CG the plaque prints is the mass-weighted node centre
   in the rest frame (0.554 m from the nodes, 0.554 from sim.cgPos, 0.554
   from genShakedown), the LE it is compared to is the spec's (wings[0].xLE,
   and the front-spar nodes sit at 16 % of chord behind it). The balance
   probe runs on `sim.reset(0)` — the level rest frame — never on the
   settled stance, so the deck angle (13° on this taildragger, 0.7° on the
   172) never enters. The user's suspicion is ruled out.
2. **The neutral point.** Reconstructed by hand from the model's own strips
   — wing c/4, tail c/4 (arm 3.29 m), Sh 2.26 m², a_t/a_w 3.17/4.12, η 0.9
   and the monoplane's calibrated dε/dα 0.40 (the 0.65 is a READOUT of the
   kernel; a monoplane applies the constant): NP = 25 + 13.5 = 38.5 %
   against the probe's 36.2 %. Cub: 38.7 vs 44.4; 172: 49 vs 65 (the probe
   adds what the textbook leaves out — the wing's own AC, the wash). The
   arithmetic is sound and the tail volume is genuinely small: against the
   d112 payload the stab sits 1.13 m ahead of the tail end on the model and
   1.23 on the build, the same area. A Jodel HAS a small tail.
3. **The CG, empty.** Ours 37 % of chord on the Jodel AND on the Cub; the
   books say ~26 (D.112) and ~24 (J-3). Same bias, same size, on two
   aeroplanes of different construction and wing position — a MODEL bias:

   | | model | a real one | at | worth on the CG |
   |---|---|---|---|---|
   | tail group (stab, fin, rudder, tailwheel) | 25 kg | ~12 | 4.0 m | 6 % of chord |
   | tail cone (rings S3 → post) | 35 kg | ~11 | 2.75 m | 7 % of chord |

   The lattice bills tube mass by member length to the very post and the
   tail surfaces at the fuselage's areal weight; a plywood Jodel's tail
   cone and a fabric tail weigh a third of that. With real masses the Jodel
   reads CG 21 %, margin 15 % — the D.112's book values to the digit; the
   Cub goes to 17 / 27 % (its "real" cone is likelier 18-20 kg, a tube one;
   call it 21 / 23), which is why the Cub never showed the bias: its tail
   volume covered it.

**THE CHANTIER (a MASS one, fleet-wide — a ruling):** (a) the empennage at a
surface's own areal density (fabric/ply on wood or tube: 2.5-3.5 kg/m² of
sheet incl. structure, the GEN_SURF_MATERIALS rows already say what a wing
weighs per m² — the tail should read the same table), (b) the fuselage's
mass per metre tapering with the section (perimeter × covering + a frame
per ring, not a tube lattice at the cabin's gauge to the post), (c) the
empty CG printed on the plaque beside the loaded one, with the type's
range where a REAL row has it. Every card's CG moves forward 5-13 % of
chord; the pilot matrix moves with it.

### 4.1 The chantier, done (G445.7)

Three rules in 61_gen_frame's mass model, all measured on the three builds:

1. **The aft lattice follows the section** — a fuselage member with both
   ends aft of the cabin box bills at `fusAftGauge` (0.6, G351's flat cut)
   × the local perimeter over the cabin box's (`perimK`: an ellipse through
   the joined profile's w and yt−yb, or the box-to-post taper on a bake),
   floored at `fusAftPerimMin` 0.3. The Jodel's aft members: 14 → 8 kg.
2. **The aft skin is skin** — a body cover panel whose centroid is aft of
   the box takes the same factor, floored at `fusAftCoverMin` 0.5 (the
   row's kg/m² carries the cabin's doors, floor and windows; a cone has
   stringers and a thinner sheet). The 172's cone skin: 36 → 18 kg.
3. **The tail at the J-3's weight** — `tailSection` 0.25 → 0.20 (its own
   note: 16-20 kg read against the J-3's 14-16). Cub 18 → 16, Jodel 20 → 17.

And the EMPTY CG on the plaque beside the loaded one (`genShakedown.cgEmptyX`:
the same spec with nobody aboard, dry tanks, no freight, built once).

| | empty kg (book) | CG loaded | CG empty (book) | NP | margin |
|---|---|---|---|---|---|
| Jodel D.112, before → after | 329 → 326 (320) | 34 → 30 % | 37 → 32 % (26) | 36 | 2 → 6 % |
| Cub, before → after | 342 → 339 (345) | 31 → 26 % | 37 → 28 % (24) | 44 | 13 → 18 % |
| 172, before → after | 664 → 630 (736) | 50 → 43 % | 49 → 43 % (24-27) | 65 | 15 → 22 % |

The Jodel's residual (32 vs 26 empty, margin 6 vs ~10): the tail's last
5 kg at 4 m (17 vs a D.112's ~12) and the model's tail effectiveness (NP
36 vs a real ~40) — 2-3 % of chord each. THE 172 IS THE OTHER WAY ROUND:
100 kg LIGHT (630 vs 736) and that mass is forward — the engine
installation (a 172R's engine+mount+cowl+prop+exhaust ~180 kg against the
row's 138+prop), the panel and avionics (~30 kg against 11), the cabin's
doors, glazing and four upholstered seats (outfit 74). Its empty CG at 43 %
is missing forward mass, not carrying aft excess: the next MASS item, a
forward one. Fleet: every card's CG moved 2-6 % of chord forward; the
cards' pre-existing negative margins (pusherPod, da62, twinBush,
skymaster, vtail at 0) are not touched by rules that only take aft mass
away.

### 4.2 The forward item (G445.8)

The engine installation as a fraction of the dry mass (`engInstallK`: 0.13
on a four-stroke — the mount, baffles, oil, hoses and controls; the cowl
and the exhaust were already the outfit row's, and a first cut at 0.20 had
counted them twice). With it, and the aft rule's spar reach at 0.75 (the
ring a spar braces to keeps the flat gauge): Cub CG 26 → 25.5 % loaded,
empty 28 → 27 (the J-3's 24); Jodel 30 → 29, empty 32 → 30.5 (the D.112's
26), margin 6 → 7 %; 172 43 / 43.5. The Jodel's last 4-5 % of chord is
its tail (17 kg vs a D.112's ~12) and the model's tail effectiveness (NP
36 vs a real ~40). The 172's last 17 % is its systems catalogue (30 kg at
the firewall against a 172R's ~55), its alloy cabin box's split and its
baggage station — calibration items.
- The 45 L nose tank reads "through the crew (105 points)" on the bench —
  the same ENERGY item as the Cub's.
