# WEIGHT HAS A PRICE - light constructions that break where they should (study, revision 2, 2026-11-12)

The ask (the user, 12 Nov): "launch the study on weight ... if I put such a lightweight wing, for example, on another
plane, it should probably break at some point. So let's offer the ultralight options, but with the cost in terms of
rigidity."

The user then set the design rule (revision 2):
- **No classes, no ratings and no max-weight setting on screen.** The game must stay playable.
- **Light options are constructions:** a wing, a cabin skin, a rod. Each comes with what it can take.
- **Physics teaches:** a light construction on a heavy aeroplane sags and then crumbles, in the garage or in the air.
- **A test must prove there is no exploit:** the light wing on the Cessna fails.

Revision 1's ratings, categories and max weight are dropped. This file replaces them.

**Status (12 Nov): the foot-launch D-tube wing and GATE LIGHTWING are BUILT** (the Wing structure tile's 9th option;
the row `GEN_SURF_MATERIALS.dtube`; the certificate's build weight). Measured by the gate:
- the Archaeopteryx certifies at 6.75 g on a 34.7 kg wing;
- a Cub breaks at 3.63 g, a C172 at 2.73 g, a Caravan at 1.57 g, all at the root;
- without its build weight the C172 holds 10.98 g (the exploit, the gate's negative control).

Three things the build added to the prototype:
- the D-tube is sized in its own group (`wingB`), so the carry-through billed in carbon keeps its own size;
- its bracing (struts, carry-through) is certified at its build weight too: on the strut-braced Cub, full-strength
  struts held the light wing to 6.13 g;
- its stiffness never drops under 0.7 of the aeroplane's own (`kFloorK`): at 0.45 the Caravan blew the simulator up. **The Archaeopteryx flies it** (L1 of THE
PATH, §4: empty 169.1 -> 155.0 kg); no other card uses it.

## 0. The answer in one paragraph

A construction carries a hidden **build weight**, the aeroplane it was designed for (the foot-launch wing: about
250 kg). Three things follow from it:
- **Mass:** it may thin below its build weight but never grows past it.
- **Stiffness:** it is capped at its build weight.
- **Certification:** it is certified *as if its aeroplane weighed its build weight*.

Nothing else changes, and the player never sees the number. They see a light wing, and a Cessna that breaks it.

**A throwaway prototype measured it** (§2):
- On the Archaeopteryx the light wing is 13 kg lighter and still certifies (6.28 g).
- On a Cub it folds at 3.70 g, on a C172 at 2.68 g, on a Caravan at 1.57 g. Every aeroplane over about 500 kg
  breaks it before its own 3.8 g limit.

## 1. Why something new is needed (measured)

Today a light construction cannot break, for two reasons the prototype found:

1. **The sizing grows every construction with its aeroplane** (`GEN_GAUGE`, up to ×3), and the member's strength
   never drops below its row's (`61_gen_frame.js:477`).
2. **The certificate is itself an auto-sizer.**
   - It flies this aeroplane's loads and stamps every member and fitting to break at about 1.5 × its own limit load,
     capped only by physics (`66_gen_cert.js`, `30_solver.js` certStamp).
   - Today's wing members have 4 to 7 times that strength in physics:

| card (its own wing) | design gross | wing members' peak load at 3.8 g | member capacity | margin |
|---|---|---|---|---|
| Archaeopteryx (carbon) | 252 kg | 12.9 kN | 77 kN | ×3.8 |
| ul1 (wood) | 348 kg | 8.6 kN | 90 kN | ×6.6 |
| Cub (wood) | 538 kg | 9.2 kN | 90 kN | ×6.2 |
| C172 (alloy) | 868 kg | 10.7 kN | 93 kN | ×5.5 |

So every certified aeroplane lets go at its wing fittings near 6 g, whatever it is made of.

**Note the C172's 10.7 kN.** Its braced, deeper wing has lower member loads than the cantilever Archaeopteryx's. A
light construction defined only by its per-metre rates would hold on the Cessna's own braced planform. Section 2
measured exactly that.

## 2. The prototype (throwaway, not in the game)

**How it was built.** A new wing row, `dtube`, in a scratch tree:
- moulded carbon, its cover 0.6 kg/m² (carbon's 1.6) and its members 0.3 of carbon's rate;
- a reference gross of 190 kg;
- its size factor capped at 1.15, so it is built for about 250 kg;
- no strength floor, and its stiffness capped.

The patch and the bench script are in `weight_proto/` (`dtube_prototype.patch`, `bench_wing.js`). The bench is the
garage's own destroy test: sandbags ramped until the first part lets go.

**Run 1: the light wing alone (no change to certification)**

| card | own wing | breaks at | light wing | breaks at |
|---|---|---|---|---|
| Archaeopteryx | 47.9 kg | 6.74 g | 34.9 kg | 6.28 g |
| ul1 | 57.8 kg | 6.03 g | 32.3 kg | 6.10 g |
| Cub | 63.8 kg | 6.02 g | 30.4 kg | 6.00 g |
| C172 | 101.3 kg | 6.06 g | 31.0 kg | **simulation diverged** |

**The exploit, confirmed:** a 31 kg wing on the Cessna that still holds 6 g. The certificate re-sizes its fittings.

**Run 2: certified at its build weight.** Each light-wing member's certified load is scaled by min(1, 250 kg / the
aeroplane's design gross):

| card | design gross | scale | light wing breaks at | first to go |
|---|---|---|---|---|
| Archaeopteryx | 244 kg | ×1.00 | **6.28 g** | the fittings: it certifies |
| ul1 | 330 kg | ×0.76 | 5.49 g | the fittings |
| Cub | 506 kg | ×0.49 | **3.70 g** | the spar folds at the root |
| Savannah | 499 kg | ×0.50 | 3.70 g | the spar folds at the root |
| C172 | 796 kg | ×0.31 | **2.68 g** | the spar folds at the root |
| Caravan | 1 614 kg | ×0.15 | **1.57 g** | the spar folds at the root (its own wing: 6.15 g) |

**What the runs show:**
- The light wing saves real mass and stays certified where it belongs.
- From about 500 kg up it breaks below the 3.8 g limit, so it can never be certified there.
- On a 700-1 000 kg aeroplane it breaks in a steep turn or a firm landing; on a Caravan, on a bump.
- The failure is the honest one: the spar folds at the root.

**The test case that must stay red:** "the foot-launch wing on the C172 breaks under 3.8 g". It becomes a gate
(GATE LIGHTWING, §7).

**Not exactly proportional.** The C172's 2.68 g is above a straight 250/796 ratio, which would give ~1.9 g. The
certificate's physics floor and the fold mode take over. Still well inside "it does not work".

## 3. The constructions to offer

### 3.1 Wing structure (`wgCons`, options appended)

| construction | real examples | kg/m² of wing (real) | built for | in the game |
|---|---|---|---|---|
| **Foot-launch D-tube** (new) | Archaeopteryx, Swift, Atos | ~1.5-2.5 | ~250 kg | new row: the prototype's, calibrated |
| Microlight: tube and sailcloth | trikes, the MW5, most 3-axis microlights | ~3-5 | ~450 kg | today's aluminium tube + fabric, alu spar + fabric |
| Sailplane: moulded | the ASW 28, the DG | ~8-11 | ~550 kg, ±5.3 g | today's carbon and glass rows |
| General aviation | Cub, Cessna | | grows with its aeroplane | today's wood, steel, alloy |
| **Aerobatic** (new) | Extra 330, Pitts | heavy | grows with its aeroplane, built for ±10 g | new row; symmetrical profile by default (`wgCamber 0`) |

**The user's question: glider wings rather than ultralight?** They are three different things. The Archaeopteryx's
wing is a foot-launch wing, lighter than both a microlight's and a sailplane's. The other two already exist, so only
two rows are new: the foot-launch D-tube and the aerobatic.

**The aerobatic wing is the same mechanism reversed:**
- certified as if built for ±10 g (its certified loads × 10 / 3.8, so it breaks near 15 g);
- its mass sized for it: about +60 % wing structure ((10/3.8)^0.49);
- a symmetrical profile proposed when picked. It is a default, not a lock.

**Existing constructions keep growing with their aeroplane.** That is right: real designers size spar caps to the
aeroplane. Only the new light rows stop growing at their build weight.

### 3.2 The tail follows the wing

- Today the tail's default follows the **fuselage** (`GEN_SURF_DEFAULT_TAIL`, `60_gen_spec.js:616`).
- Proposed: it follows the **wing's** construction; `finCons` / `stCons` still set it on their own.
- A foot-launch tail on a heavy aeroplane fails the same way. The stab's spar folds at its root, or the fin snaps
  sideways at its root under rudder or a gust.

### 3.3 The cabin: a soft shell (`intCons` option 6)

- **Name:** "Soft shell" (fabric on poles). Other candidates: "Sailcloth", "Fabric shell".
- **What it is:**
  - a `GEN_MATERIALS` row: thin poles, very low stiffness, a ripstop cover at ~0.15 kg/m²;
  - its `GEN_CRASH` row folds first;
  - Euler buckling switched on for its members (today only steel and aluminium tube buckle).
- **Offered on every body.** On a Cub the wing sits on it and it folds: the physics teaches. Under the pylon the wing
  rides on the mast and the keel, the cabin hangs, and it stands.
- **Its test (the user's):** any wing loaded on a soft-shell cabin without the pylon crumbles on the bench; the
  Archaeopteryx's stands.

### 3.4 The rod: a light option

- Today the rod has **no material row of its own**. It takes the fuselage's material, with a 1.2 mm wall
  (`GEN_RULES.rodWall`, `60_gen_spec.js:3322`).
- Proposed: a row on the boom page: "rod: standard / foot-launch".
  - The light one has a thin wall and a 250 kg build weight, certified the same way as the wing.
- **How it fails on a heavier aeroplane:** the tail's balancing loads, gusts and rudder grow with the aeroplane.
  1. The thin rod whips and droops (stiffness capped).
  2. It folds at its root, where it leaves the pod or the hub (the largest bending moment).
  3. Or it twists off under hard rudder.
- **Its test:** the foot-launch rod on the pusher-pod card at about 500 kg breaks under 3.8 g.

### 3.5 Where the pylon architecture is chosen

**In the New Plane chooser** (`tools/_new_plane.js` STEPS), step 6, **"Boom architecture"** (`booms`, "what carries
the tail"): lofted / rod / twin / twin rod. Append **"Pylon (hanging nacelle)"**.

`compose()` then writes the rod, the hub and the hanging nacelle:
- `boomStyle 1`, `rodHub 1`, `hangOn 1`, the mast's station and chord, `hangKeels 2`;
- the aero aft over the pusher.

The step comes before the wing and gear steps, so they can follow it:
- **Wing:** a high wing under a pusher is greyed today (`_new_plane.js:259-260`). The pylon needs an exception, and
  greys on mid and low.
- **Gear:** the step offers no Monowheel. Add it, and make it the pylon's default.

The Archaeopteryx then becomes reachable from the chooser (out of GATE NEWPLANE's `N4_OUT`).

**In the editor:** a third option appended to "Fuselage style" (`boomStyle`, `_cage_design.js:1307`). It reads
`hangOn`, and options 0 and 1 write `hangOn 0`. Options are appended, never inserted: the index is the saved value.

### 3.6 The fixed items (the user: "that should fix most of the fixed items")

| item | v1 card | proposal | saves |
|---|---|---|---|
| seat | aerobatic recline, 6 kg | the reclined tub (3.0 kg, exists); folding canvas is 2.5 | 3 kg; no new seat needed |
| glazing | 2.67 m² of acrylic at 3.6 kg/m² | new **soft glazing** (film, ~0.7 kg/m²; it crazes and cracks sooner) | ~7.8 kg |
| controls | 0.62 kg/m × ~11 m of reach | a light rate (push-pull rods, Dyneema: ~0.15 kg/m), **mounted on the keel tubes, no central lever** | ~5 kg |
| dashboard | 2.1 kg panel | none, or a vario only (~0.3 kg) | ~1.8 kg |
| furnishing | 6.0 kg | the minimal fit (0) | 6.0 kg |
| paint | 5.1 kg (full white) | gelcoat, part of the moulding (white, no paint bill) | ~5 kg |
| **total** | | | **~29 kg** |

## 4. THE PATH (tracked: expected against measured)

Every level is measured on the card with the same tool: the ledger's non-payload sections, the card born as the shed
births it. That is everything except the pilot, fuel and cargo. **v1's empty is 169.1 kg.** An earlier "154 kg"
came from a read that left sections out; the ledger is the reference from here on.

**The target:** the real aeroplane is ~72 kg (54 kg as a glider, parachute included, plus ~18 kg of electric drive;
`STUDY.md` §2).

**The levels:**

| level | what | expected | measured | empty after | status |
|---|---|---|---|---|---|
| L0 | v1: moulded carbon wing | | | **169.1** | frozen (v1) |
| L1 | the foot-launch D-tube wing | -13 to -20 | **-14.1** (wing 47.9 -> 34.7; bracing 7.1 -> 6.9) | **155.0** | **done**, certified 6.28 g |
| L2 | the tail and the rod follow the wing (light tail, light rod) | ~-8 (tail 8.3 -> ~3; the rod ~-3) | | ~147 | next |
| L3 | the fixed items: reclined tub, soft glazing, light controls on the keel tubes, no panel, minimal furnishing, gelcoat | ~-29 (outfit 21.2 -> ~5, furnishing 6 -> 0, paint 5.1 -> 0, panel 2.1 -> 0.3) | | ~118 | |
| L4 | the soft-shell cabin over the hard keel, mast and struts | ~-10 (of the fuselage's 26.6) | | ~108 | |
| L5 | a pinned carry-through (six pins, not the cantilever box) | ~-6 (bracing 6.9 -> ~1) | | ~102 | |
| L6 | the light gear (a carbon blade on the monowheel) | ~-3.5 (5.5 -> ~2) | | ~98 | |
| L7 | the real drive: a ~10 kW motor (the e-PPG 12 kW row, 7 kg) and a ~2 kWh pack, the avgas nose tank gone | ~-12 net (engines 36 -> ~13, the tank -2.8, the pack +~14) | | **~86** | |
| | **the real aeroplane** | | | **~72** | the remaining ~14 kg: the cabin cage, the mast and the hub, to measure at L4-L5 |

**A finding on the way (L7):** the card carries the Velis's E-811 electric motor (30 kg) fed from a 4 L avgas nose
tank, with no battery. That is a leftover from the stage-1 card. The drive level fixes it.

## 5. The gaps found

1. **The certificate must take the build weight.** Without it the light construction is an exploit (run 1).
   - In the game: the light row's `buildKg` is read when its members are stamped (`certStamp`).
   - The certificate's cache key gains the construction (it already hashes the spec).
2. **No strength floor for the light rows.** The floor exists because on the metal Cessna much of a member's strength
   is in the skin. It stays for every other row.
3. **Softness must not crash the simulator.** The light wing on the C172 *diverged* in run 1. Rated, it broke first.
   - The stiffness cap needs a floor the integrator can hold (the solver's substep).
   - A gate: "softest legal wing on the heaviest card: a clean break, never a divergence".
4. **Fittings are covered.** They are stamped from their members' certified loads, so the scale reaches them: the
   Archaeopteryx's light wing still lets go at its fittings first.
5. **The cert's physics floor** makes the break gentler than the straight ratio (§2). Fine for play; documented.
6. **The rod has no row**, and only tubes buckle today (§3.3, §3.4).

## 6. Decisions for the user

1. The construction names: "Foot-launch D-tube" and "Aerobatic" for the wing, "Soft shell" for the cabin,
   "Foot-launch" for the rod.
2. Should the aerobatic wing propose the symmetrical profile and leave it editable? (Recommended.)
3. Order: the foot-launch wing and its GATE LIGHTWING first (the exploit test), then the tail-follows-wing default,
   the soft shell, the rod, the fixed items, the pylon in the chooser.

## 7. The gates

- **GATE LIGHTWING:**
  - the foot-launch wing certifies on the Archaeopteryx (≥ 5.7 g);
  - it breaks under 3.8 g on the Cub, the C172 and the Caravan, at the root, cleanly (never a divergence);
  - it is lighter than the Archaeopteryx's moulded carbon;
  - every card without it is unchanged (the fleet hash used for v1).
- **GATE SOFTSHELL:** a wing on a soft-shell cabin without the pylon folds on the bench; the pylon card stands.
- **GATE LIGHTROD:** the foot-launch rod breaks under 3.8 g on the pusher pod at ~500 kg; it holds on the
  Archaeopteryx.
- **GATE AEROWING:** the aerobatic wing breaks near 15 g and weighs about +60 % in wing structure.
