VERDICT: the V2-172 (land) is 5 inside / 5 near / 7 outside against the 172R POH (8 Nov baseline 2 / 9 / 6): empty weight, analytic take-off roll and the handbook landing from 50 ft move inside; still outside are the climb-out to 50 ft (+53 %), the landing rolls (handbook −17 %, game +43 %), the game's climb (−13 %) and the glide (not like for like). The V2-172 floats (draft) is 9 / 1 / 0 against Wipaire at 920–1157 kg, but at its own gross case it is 1212 kg, over the STC 1157, CG 46 % MAC, lands flapless, and the supplement's technique does not lift it off. The STOL Cub is not a Carbon Cub SS: 1 inside / 1 near / 9 outside; its kit stalls 25 % slower and its 141 hp climbs 30 % less.

# REAL-CHECK 2026-11-09: STOL Cub and the final Cessna (REAL-FIGURES for A0)

`tools/real_check.js` in the same method as before: flights only in node; loads MIN / TYP / MTOW through the game's
doors; the airframe probes, the handbook schedule, the technique sweep, and the game's pilot.

- Results JSON are in this folder.
- The HTML report is `reports/REAL-CHECK-2026-11-09.html`.
- Builds and the existing reference rows are unchanged.

| run | branch / core | wall |
|---|---|---|
| Cessna V2-172 land and floats | worktree of `claude/alloy-frame` at dbd37ff77 (its core built from its sources: A1 + A4; its real_refs, whose c172r / c172f rows CESSNA-FINAL re-read off the POH and Wipaire's 172 guide) | 23 / 13 min |
| STOL Cub | `claude/real-figures-3` (master L35a + REAL-FIGURES-2) | 29 min |

## 1. The final Cessna: V2-172 (`builds/cessna172r_2026-11-08.json`) against the 172R POH

Rows are at 1111 kg unless stated; "8 Nov" is CESSNA-FINAL's run (`reports/evidence/REAL-CHECK-2026-11-08/c172v2.json`
on claude/alloy-frame). Both runs are recomputed here with the same reference rows.

| indicator | reading | 172R (band) | 8 Nov | now | verdict 8 Nov → now |
|---|---|---|---|---|---|
| empty | ledger | 721–744 kg | 669 | **729** | near → **inside** |
| stall, flaps up | airframe | 94 km/h (92–97) | 93 | 93 | inside → inside |
| cruise 75 % | airframe | 219 (208–229) | 195 | 194 | near → near (−11 %) |
| top speed | airframe | 230 (218–241) | 221 | 221 | inside → inside |
| climb | airframe | 3.66 m/s (3.55–3.77) | 3.32 | 3.34 | near → near |
| climb | handbook | | 3.26 | 3.23 | near → near |
| climb | game | | 3.10 | 3.18 | outside → outside (−13 %) |
| best glide | airframe | 9.0 | 11.2 | 11.2 | outside → outside (not like for like: our probe has the prop off) |
| TO roll | airframe (grass) | 288 m (279–297) | 266 | **284** | near → **inside** |
| TO roll | handbook | | 275 | 279 | near → near |
| TO roll | game | | 266 | 278 | near → near |
| TO over 50 ft | handbook | 514 m (498–529) | 772 | 788 | outside → outside (+53 %) |
| TO over 50 ft | game | | 757 | 782 | outside → outside |
| landing roll | handbook | 168 m (159–176) | 136 | 139 | outside → outside (−17 %) |
| landing roll | game | | 227 | 240 | outside → outside (+43 %) |
| landing over 50 ft | handbook | 395 m (375–414) | 374 | **378** | near → **inside** |
| landing over 50 ft | game | | 438 | 464 | near → **outside** |

**Counts:** 2 / 9 / 6 → **5 / 5 / 7**.

**Balance:** CG 30.8 % MAC light and 40.7 % at gross (8 Nov: 33.0 / 43.1). The POH's envelope at 2450 lb is 24.0–36.4 %
MAC (CESSNA-FINAL's thin row), so the V2 is still aft at gross. It lands on full flap at every load.

**Its MTOW case is 1127 kg:** empty 729 kg plus four aboard cannot reach 1111 kg, even on a quarter of the fuel.

**Why the remaining rows are out:**
- **TO 50 ft:** the game's pilot accelerates level in ground effect to its climb speed. The POH climbs out at Vx 60 KIAS,
  and the sweep has no Vx climb-out yet. On top of that sits the propeller's low-speed efficiency. The extra 60 kg of A1
  / A4 added 16 m.
- **Landing roll (handbook schedule, −17 %):** braking is a little strong on paved (the mean deceleration is 2.3 against
  about 2.0 m/s²).
- **Landing roll (game, +43 %):** the shipped brake law (brakes from 0.75 Vs, ramp 0.12/s to 0.30).
- **Climb and cruise:** the propeller item (climb) and the drag at cruise (CdS 0.545 against about 0.47).

## 2. The V2-172 floats (`builds/cessna172r_floats_2026-11-08.json`, DRAFT) against Wipaire's 172 on 2350s

**Weights:** Wipaire's water figures don't state their weight, so the band covers 920–1157 kg. The STC gross is 1157 kg.

| indicator | reading | Wipaire (band) | 172R on 2350 (G3390) | V2 floats | verdict |
|---|---|---|---|---|---|
| empty | ledger | 797–820 kg | 770 | **814** | near → **inside** |
| stall, flaps up | airframe | 94 km/h | 95 | 95 | inside |
| climb | airframe | 3.35–3.80 m/s | 4.29–6.24 | 4.32–6.23 | near (~10 % better at gross) |
| water run | supplement rig | 335–501 m | 193–430 | 190–333 (extrapolated past 1100 kg) | inside |
| water run | no-flap rig | | 298–645 | 291–677 | inside |
| water run | game | | 342–526 | 340–562 | inside |
| water time | supplement / no-flap / game | 20–35 s | 15–30 / 19–37 / 22–33 | 15–24 / 18–39 / 22–35 | inside |
| to 50 ft off water | game | 751 m (676–826) | 456–693 | 457–735 | inside |

**Counts:** 9 inside / 1 near / 0 outside (the 172R on 2350 with the same rows: 8 / 2 / 0).

**But its own MTOW case is 1212 kg**, over the STC gross, and at that weight:
- the CG is 46 % MAC and it lands flapless;
- the hump R/W is 0.27, above GATE HYDROTRIM's band top of 0.21;
- the floatplane supplement's technique does not lift it off;
- the no-flap rig needs 773 m / 44 s, the game's pilot 613 m / 39 s.

Inside the band's weights it is fine. At the gross it can actually be loaded to, it is not.

## 3. The STOL Cub (`tools/fixtures/stol_cub_showcase.json`) against the CubCrafters Carbon Cub SS

**Why the Carbon Cub SS (CC11-160, the 1320 lb light-sport model, CC340 180 hp):** it is the closest Carbon Cub with
published figures. The Rotax model, the Carbon Cub UL (916 iS 160 hp, 600–700 kg), publishes no performance. The EX-3 /
FX-3 are 2000 lb, 186 hp aeroplanes.

**Its figures:**
- weights: 1320 lb gross, 900 lb empty, 24 gal fuel;
- stall: 35 kt flaps up, 27 kt full flap;
- cruise: 105–110 mph (104 kt), with the POH limiting cruise to 80 hp;
- climb: 2100 fpm (1500 in one source);
- take-off roll 60 ft and landing roll 245 ft, both from aeropedia and single-source.

**Sources:** Plane & Pilot "Carbon Cub SS"; AOPA "Light-sport brute" (2010); Wikipedia CC11-160; aeropedia; AvPay. No
figure states its weight or surface, so each is read as a band from a light pilot to gross. Ours flies a Rotax 915 iS
(141 hp).

**By load range** (MIN 492 kg, TYP 506, MTOW 599; flown on grass):

| indicator | Carbon Cub SS (band) | MIN | TYP | MTOW | verdict | what in our build causes it |
|---|---|---|---|---|---|---|
| empty | 408 kg (388–428) | 417 | 417 | 417 | **inside** | |
| stall, flaps up | 65 km/h, 35 kt (62–68) | 47 | 48 | 52 | **outside** (−20 to −25 %) | the STOL kit's full-span slot, VGs, droop and drooped tips are always on, so our "clean" stall is the SS's full-flap one (27 kt = 50 km/h) |
| cruise 75 % | 177–193 km/h (168–202) | 150 | 150 | 149 | **outside** (−11 %) | the kit's drag (slot, VGs, drooped tips, tundra tyres, the bigger tail) on 141 hp against 180; the SS's figure is at its power-limited cruise, so the gap understates the drag |
| climb, airframe | 7.6–10.7 m/s (7.2–11.2) | 6.98 | 6.72 | 5.37 | near at MIN, outside at gross | 141 hp against 180: ours equals the SS's low figure at 368 kg, below any load we fly |
| climb, handbook / game | | 5.27 / 5.94 | 5.17 / 5.81 | 4.15 / 4.59 | **outside** | the same, plus the climb speed |
| TO roll, airframe / handbook / game | 18 m, 60 ft (16–21) | 34 / 29 / 36 | 35 / 33 / 40 | 50 / 49 / 55 | **outside** | the power (141 hp against 180) and the reference: 60 ft is a demonstration figure, single-source |
| landing roll, handbook / game | 75 m, 245 ft (63–86) | 22 / 25 | 23 / 26 | 30 / 30 | **outside** (ours 60–70 % shorter) | ours is a full-braking STOL arrival at 39–43 km/h; the SS's 245 ft is single-source and probably a normal landing |

**Verdicts by reading:** 1 inside, 1 near, 9 outside.

**Shape and specs:** span 10.70 m against 10.36; wing area 17.8 m² against ~16.6 (thin); a 3-blade 1.80 m prop;
25 L of fuel against 91; empty right.

**Balance:** at MTOW (passenger and baggage aft) the CG is 36 % MAC, margin 9 %, and the full-flap approach needs −0.69
of elevator against the 0.154 budget. The join already reports that the drawn elevator chord (0.664) flies clamped at
0.65.

**Reading:** the STOL Cub is a Cub with a STOL kit, not a Carbon Cub. Against the SS it is right on empty weight and
shape. It is "too good" where the kit acts (stall, landing) and short where the SS's 180 hp acts (climb, take-off,
cruise). A truer parent would be a PA-18 with a STOL kit, which has no clean published figures, or the Carbon Cub UL
once CubCrafters publishes its figures.

## 4. The user's question: average the best and the worst landing rolls?

The midpoint of the game's roll and the best schedule's roll does land near the books: Cub (160 + 68) / 2 = 114 against
88, Jodel 165 against 150, 172 174 against 168. It is not used as a measure, for three reasons:
- It averages two biases in opposite directions: the shipped pilot brakes too gently, and the sweep's best brakes
  harder than a handbook would.
- It would move whenever the pilot or the sweep's settings change.
- The handbook-schedule reading already measures the right thing on its own: Cub 96–116 against 88, Jodel 133–169
  against 150, V2-172 139 against 168.

The fix is to bring the game pilot's brake law to the handbook's. The game-minus-best gap stays as the pilot's share.
