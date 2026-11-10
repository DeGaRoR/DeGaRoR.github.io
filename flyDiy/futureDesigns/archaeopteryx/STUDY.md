# THE ARCHAEOPTERYX — a preliminary study (2026-11-10)

**The question (the user):** can the garage build the Ruppert Archaeopteryx in its electric version (the "Electeryx")?
It is the lightest sailplane there is: a pod and rod, the rod at the wing, a pylon cabin under a fabric cladding, and an
electric pusher behind the pilot with a shaft to a propeller aft of a tapering tail cone. Where are the gaps, and can we
reach the reference data?

No code was changed and no gate was run. The two probes in this folder are headless node scripts that bake the existing
`archaeopteryx` archetype the way the shed does (designBake + the load door):

- `node futureDesigns/archaeopteryx/probe_ladder.js [--save DIR]` (about 20 s): the card, then one change at a time,
  each with its ledger, plaque and body drag;
- `node futureDesigns/archaeopteryx/probe_drag.js <build.json>`: the drag at the best-L/D point split into wing, stab,
  fin and the rest (the body's axial CdA).

## 1. The answer in five lines

1. **The shape is buildable today**: the pod and rod, the rod high on the bulkhead, a cantilever 13.6 m tapered wing,
   the aero nose, a 12 kW electric unit and a 2 kWh pack are all live rows. A card already exists (`archaeopteryx`,
   2026-09-04).
2. **The weight is not.** The lightest build the existing rows give is **141 kg empty** (pack and motor included).
   The real Electeryx is about **72 kg**: 54 kg for the glider, parachute included, plus about 18 kg of electric drive
   (an estimate, §2). The airframe without propulsion is **111 kg against 54**, twice as heavy.
3. **The materials are not the problem; the construction rows are.** Carbon is in the table (E 135 GPa, 1550 kg/m3) and
   so are tube and Dacron. What is missing is a way to build with them as a 50 kg glider is built: a carbon D-tube wing
   with fabric aft, a pylon instead of a cabin cage, fabric over poles, a monowheel. Every structural rate is tuned on
   400-600 kg aeroplanes (the `ul1` class says "~180 kg").
4. **The glide is half the real one**: L/D 13.4 against 28. The wing alone reaches about 23. The body's 0.34 m2 of
   drag area does the rest, and half of that (0.15 m2) is the undercarriage: two 0.2 m wheels where the real aircraft has
   one semi-recessed wheel.
5. **The electric side is closest**: the e-PPG 12 kW row (7 kg, 1.30 m, 370 N static) is almost the real unit
   (10.5 kW, 370 N at 75 km/h). The pack is about 4 kg heavy. But the pusher row will not take an aft aeropod or a
   shaft, which is exactly this aircraft's layout.

## 2. The aircraft (reference data)

| | value | source |
|---|---|---|
| span / area / AR | 13.6 m / 12.8 m2 / 14.5 | Wikipedia; kasaero (via search) |
| length / height | 5.7 m / 2.9 m | Wikipedia |
| empty | 54 kg, **parachute included** (older figures 46 and 50 kg; a 2026 article says 61) | Wikipedia; Hesselbarth & Ruppert, OSTIV 2015 (via search) |
| cockpit cladding | 6.7 kg (in the 54) | OSTIV 2015 (via search) |
| recovery parachute | 5.5 kg (in the 54); 62 m2 canopy | OSTIV 2015 (via search); Wikipedia |
| the "hang glider" configuration | 40 kg | all-aero (via search) |
| gross / MTOW | 160 / 191 kg; pilot 55-100 kg, 165-195 cm | Wikipedia |
| L/D / min sink | 28 / 0.50 m/s | Wikipedia |
| stall / cruise / VNE | 30-39 / 57 / 130 km/h | Wikipedia |
| load factors | +4.0/-2.0 at 130 km/h, +5.1/-3.1 at 100 km/h | Wikipedia |
| flaps | glide-path control, used as airbrakes at 45-70 deg | Wikipedia |
| structure | carbon, aramid, glass, PMI foam, aramid honeycomb; "wing integral shell/ribs in carbon"; one reference says fabric-covered wings, concave between the ribs | Ruppert Composite / OSTIV 2015 / kasaero (via search) |
| rigging | one person, about 15 min; wings and tailplanes on six ball-lock pins | Wikipedia; search snippets |
| electric motor | 10.5 kW at 3 800 rpm; 370 N of thrust at 75 km/h (another source: an MGM Compro unit, 15-18 kW) | Wikipedia; Sustainable Skies (via search) |
| battery | Kokam LiPo 14s1p 40 Ah, 2.07 kWh, 58.8 V max, 200 A continuous | Wikipedia |
| electric performance | 50 m take-off roll; 2.5 m/s climb; 11 min at full power | Wikipedia |
| layout of the drive | motor just behind the pilot, a long shaft with a bearing to a folding propeller; the whole power pack is removable (velcro panels, about 5 min) | Sustainable Skies (via search) |

**Estimated, not sourced:** the electric drive is about 18 kg (motor about 4-5 kg, 14 Kokam 40 Ah pouches about 13 kg,
shaft and folding prop about 1-2 kg; a ZHAW student twin-motor system weighed 16.6 kg), so the Electeryx is about
72 kg empty.

**Unknown (needed before a fit):** the tail type (conventional, T or cruciform), the undercarriage (Wikipedia says
only that it "normally lands on the main wheel"), the wing's sweep, dihedral and chord law, the pod's and the rod's
dimensions, the airfoil, and the propeller's diameter and station.

## 3. What the garage has, row by row

| the aircraft has | the garage | status |
|---|---|---|
| pod and rod | `boomStyle` Rod & pod | live |
| rod at wing level | `rodY` (free slider; G26 named the Archaeopteryx "high") | live |
| cantilever high wing, 13.6 m, tapered | `wgBrace`, `wgSpan`, `wgChord`, `wgChordTip`; envelope 6.5-18 m and 0.80-2.10 m chord | live |
| carbon wing | `wgCons` Carbon (moulded, cover 1.6 kg/m2) | live, but a sailplane's moulded wing, not this one (§4.1) |
| aero nose | `aeroNose` (NOSE_AERO) | live |
| tapering aft section with the prop behind it | `aeroAftOn` | live, but **the Pusher mount forces it off** (§4.3) |
| shaft from motor to prop | `cw_noseOff` "shaft length (prop off the engine)", 0-1.5 m (added for the Spitfire) | drawn per unit, aft units too; **not tried on a pusher** |
| electric motor about 10 kW | `e-PPG 12 kW` (7.0 kg, 1.30 m, 370 N) or `FES sustainer` (22 kW, 9 kg, folding 1.0 m) | live |
| 2 kWh LiPo | energy `battery`, cells `nmc` (147 Wh/kg at pack level), `packCase` vessel | live, about 4 kg heavy (§4.6) |
| no electrics | systems `minimal` (battery, alternator and starter: none) | live |
| third-party instruments (a vario on each shoulder) | the minimal tier still bills ASI, altimeter, tacho, oil and compass (1.9 kg); no vario row | small gap |
| reclined pilot | seat `Reclined tub` (3 kg), `Ultralight sling` (3.5 kg); the pilot's `lean` | live |
| pylon cabin, pedal beam held by a cable | — | **missing** (§4.2) |
| fabric cladding over a light (tent-pole) frame | fuselage materials are composite, steel tube, ply, alloy, alloy tube, glass; the cover is set by the material | **missing** (§4.2) |
| one main wheel | gear is Taildragger / Tricycle / Floats / Hull | **missing** (§4.4) |
| flaps to 70 deg as airbrakes | flaps top out at the 50 deg STOL row; no spoilers or airbrakes | gap |
| folding prop | the FES row is named folding; whether a folded or stopped prop's drag is modelled was **not checked** | open |
| recovery parachute (5.5 kg) | no row | small gap (ballast for now) |
| foot-launch hatch in the pod's floor | — | cosmetic |

## 4. The measurement: what the existing rows can reach

`probe_ladder.js`, 2026-11-10, on this branch at `6f1497d72` (master, train L37b). Empty includes the pack; gross adds the 80 kg pilot.

| step | empty kg | gross kg | L/D | body CdA m2 | climb m/s | TO m | note |
|---|---|---|---|---|---|---|---|
| 0 the card as it is | 170.7 | 268.0 | 10.9 | 0.417 | 7.7 | 38 | E-811, **24 L of avgas**, struts, 11 m, prop through wing/body/rod |
| 1 cantilever | 172.1 | 269.3 | 11.8 | 0.379 | 7.8 | 39 | |
| 2 13.6 m tapered (12.84 m2, AR 14.4) | 172.9 | 270.2 | 13.2 | 0.375 | 8.2 | 42 | |
| 3 e-PPG 12 kW | 145.2 | 242.5 | 13.8 | 0.339 | 1.9 | 129 | |
| 4 2.07 kWh NMC pack, no fuel | 158.3 | 238.3 | 13.8 | 0.339 | 1.9 | 124 | pack 18.0 kg |
| 5 taildragger, windscreen, bare paint | 151.3 | 231.3 | 13.7 | 0.340 | 2.0 | 162 | |
| 6 wing 6061 tube + Dacron | 145.8 | 225.8 | 13.4 | 0.340 | 2.0 | 169 | the lightest wing row |
| **7 1.0 m prop** | **141.3** | **221.3** | **13.4** | 0.341 | 1.1 | 383 | **the join is clean** |
| x pod in 6061 tube + Dacron | 172.7 | 252.7 | 11.4 | 0.514 | 0.4 | 609 | the carry-through box goes 8 -> 37 kg |
| *the real Electeryx* | *~72* | *~150* | *28* | *?* | *2.5* | *50* | |

Step 7's ledger against a plausible split of the real aircraft. The right-hand column is **my estimate**, sized to add
up to the published 54 kg plus the drive; it is not a published breakdown:

| ledger row | step 7 | real (estimate) | what it is here |
|---|---|---|---|
| wings | 32.8 (39.6 in carbon) | ~25 | two spars, ribs and cover at the class rates |
| bracing | 8.2 | ~1 | the cantilever carry-through box (WB/WF/WR nodes); the real one is six pins and fittings |
| fuselage | 26.0 | ~7 + 6.7 cladding | a carbon cabin cage with its rings and rails, the rod |
| tail | 10.4 | ~3 | |
| gear | 11.5 | ~2 | two mains and a tailwheel |
| outfit | 16.0 | ~4 | seat, controls, harness, firewall... |
| furnish + panel + paint | 6.1 | ~0.5 | |
| parachute | — | 5.5 | |
| engines (with prop and mount) | 12.3 | ~6 | |
| pack | 18.0 (14.1 cells + 3.9 case) | ~14 | |
| **empty** | **141.3** | **~72** | |

**The gauge floor is not what binds.** `GEN_GAUGE` scales structure by `(W0 / refGross)^e` with a floor of 0.6. At
step 7 the gear sits on the floor and wing, tail and fuselage at 0.67-0.75. Lowering the floor to 0.25 saves 0.7 kg.
The mass is in the per-metre member rates (`lin`), the per-m2 covers and the fixed items, all fitted on aeroplanes of
400-600 kg.

**The drag** (`probe_drag.js` on step 7, 60 km/h, best L/D): 162 N in all; the wing 91 N (its own L/D about 23,
induced about 46 N and profile about 45 N, the Dacron row's cd0); the body's axial CdA 0.341 m2 is about 58 N: gear
0.147, body 0.098, tail wires 0.027, junction 0.021, screen 0.023. A semi-recessed monowheel (about 0.02) and a
moulded wing's profile drag would bring the sheet into the low 20s before any mass is saved.

## 5. The gaps, by what they cost

1. **A light-glider construction family** (the big one). A wing row for a carbon D-tube with carbon ribs and fabric or
   Mylar aft (the Archaeopteryx's, the Swift's, the Atos's), with a gauge reference near 190 kg so it thins at a
   microlift's weight. A tail row to match. A carry-through rule for a pinned cantilever wing on a light pod: the box is
   7-8 kg on a carbon pod and **37 kg on a tube pod**, the cantilever box HANDOVER already flags as "NOT fixed".
   This is where 40-50 kg of the 70 kg gap lives.
2. **The pylon cabin.** The cage is a ring-and-rail lattice: keel, floor, waist, band, ceiling, roof. This aircraft is a
   vertical pylon from the wing to a keel point, a short beam forward to the pedals, a cable from the pedals to the wing,
   and a fabric cladding (6.7 kg) over poles. The *outside* can be drawn today (aero nose, a round section, the aft
   taper); the *structure and its mass* cannot. Needed: a "pylon" frame topology (pylon + pedal beam + wire, billed as
   such) and a "fabric over poles" covering row independent of the frame material.
3. **The buried pusher.** The Pusher mount puts the motor on the back of the aft bulkhead and forces `aeroAftOn` off: no
   cone, the prop on the bulkhead's face. The real layout is motor and pack inside the pod behind the pilot, a shaft
   through a tapering cone, the prop behind it under the rod. Needed: a pusher variant that keeps the aft aeropod, with
   the motor's station inside the pod and `cw_noseOff` as the shaft. Your doubt was right: the back aeropod and the
   pusher do not combine today.
4. **The monowheel.** No single-wheel layout. It is the largest single drag item (0.15 m2 of the 0.34) and 9-10 kg of
   gear. Needed: a `gearLayout` monowheel (main under the seat, a nose skid or small wheel, a tail skid, wingtip
   skids), with the ground handling that goes with one wheel.
5. **The card's own bugs**, fixable in the card today (step 7 does most of them):
   - all three electric cards (`archaeopteryx`, `motorglider`, `etrainer`) are born with an **avgas tank** (24-53 L).
     The engine family does not set the energy kind, and `fuel.litres: 0` does not stop the energy layer fitting one;
   - asked for a 2.07 kWh pack, the energy layer **fills the bay** (7.3 kWh came back) unless the vessel is pinned;
   - the drawn prop stays at the E-811's 1.91 m (`cw_propD`) after the engine model changes, and it goes through the
     wing, the body and the rod (the join says so). At 1.0 m it clears;
   - the card is strut-braced (`wgBrace 0` is struts), 11 m by 1.30 m rectangular, no aero nose: none of it the
     Archaeopteryx.
6. **The pack's case floor**: `packCase` has a fixed 3.0 kg plus 4.1 kg/m2, sized for car-scale packs; a 2 kWh glider
   pack comes out at 18.0 kg against about 14. Small; a lighter case row or a size-scaled fixed mass.
7. **Airbrake flaps to 70 deg** (the type lands on them) and spoilers: not on the flap table.
8. **The small ones**: a vario-only panel (a "none" instrument tier, or a vario item), a rescue-parachute item
   (5.5 kg, the price of a microlift), the folding prop's drag (check before building), the foot-launch hatch (looks only).

Not a gap: the solver and the autopilot. A 220 kg card flies the circuit already (the September flight-test pass:
253 s, sink 1.07). Whether a 150 kg build at 12 kg/m2 of wing loading flies the circuit as well is the first thing
to fly once gap 1 lands.

## 6. Where to start the card

- **The existing `archaeopteryx` card**, not Rufus. It is already pusher, rod and pod with the rod high, the ul1 class
  and the glider role. Step 7 above is a better card than the one in the table: cantilever, 13.6 m tapered, e-PPG,
  2.07 kWh pinned, taildragger, windscreen (the Race version's), bare, 1.0 m prop.
- **Rufus** (the user's ul1, `builds/rufus_2026-10-18_certified.json`) is a Rotax 915 nose tractor, open tube and
  fabric, strut-braced, taildragger, **275 kg empty**. Only its class and its rod survive the swap.
- **The Chinook-alike** (`builds/chinook_2026-09-21_corrected.json`): a 582 pusher on an open alloy-tube pod with
  struts, 219 kg. Closer in spirit (pusher, tube and Dacron), but the strut wing and the tube cage are what we would
  remove, and a tube pod makes the cantilever box 37 kg.
- **The `motorglider` card** lends its cantilever-wing settings and T-tail, if the photographs say T-tail.

## 7. The reference data

- **Reached from here:** Wikipedia only. Everything else in §2 came through search-result summaries, not the documents.
- **Blocked by this session's network** (allow them and they can be read): `www.ruppert-composite.ch` (the maker),
  `www.pa.op.dlr.de` (Hesselbarth & Ruppert, OSTIV 2015, "Experiences with the Archaeopteryx": **the most useful
  one**, with the component masses), `sustainableskies.org` (the electric drive), `www.kasaero.de`,
  `www.nestofdragons.net`, `www.fai.org` (CIAM flyer 3/2011).
- **No reference GLB found.** A search turned up only the dinosaur, as models and fossil scans; Sketchfab's own catalogue
  was not searched from here. REF_MATCH (tools/REF_MATCH.md §0) wants a GLB. Without one, the route is the Camel's §8
  "before the model": photographs, a three-view and the published dimensions, with the shapes taken from them by eye
  and flagged as such.
- **What to ask for first:** three-view or side/top/front photographs (the tail type, the gear, the pod's outline, the
  rod's diameter and length, the prop's station and size), and the OSTIV 2015 paper.

## 8. A chantier order, if it goes ahead

1. The card fixes (gap 5), taken now on the existing rows: a better card at 141 kg that flies, and GATE ARCHETYPES on it.
2. The monowheel (gap 4): the largest drag item, and a row other gliders will want.
3. The light-glider wing and tail rows with their carry-through (gap 1): where the mass is.
4. The buried pusher (gap 3): the layout, and the aft aeropod back on a pusher.
5. The pylon cabin and the cladding (gap 2): the most new structure, and the most specific to this aircraft.
6. Airbrakes, vario panel, parachute (gaps 7-8).

Each fitted value lands on a garage row, each missing control goes into REF_MATCH §7, as CLAUDE.md asks.
