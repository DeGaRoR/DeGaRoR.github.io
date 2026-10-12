# AVIONICS-STATUS — interior, electrics, avionics and lights: what the editor offers and what each option actually does (2026-10-12)

G2800 AVIONICS-GPS, phase 1 (cloud, node only, read-only survey). The source is the user's slider review of 10 Oct:
"finish the interior work, ensure the electrics work and correspond to elements drawn in 3d, and do the GPS things. And
do a status on which of these options are wired or not yet."

The user's rulings of 11 Oct, which this document takes as given:
- **the GPS stays as-is for now, independent from the GPS drawn inside.** This document reads that as: the minimap /
  GPS work (phase 3) does not wait for, and is not coupled to, the `GEN_AVIONICS.gps` catalogue row or anything drawn on
  the panel. That row is left exactly as it is.
- **radio and transponder are NOT priorities.** They are listed below for completeness and get no phase-2 work beyond
  what falls out of the shared rules.
- **cabin furnishing (seats, panel, trim) is accounted accurately in mass.** That is phase 2's second half (§4).

Every claim is a file:line on origin/master f353a0f8 (train 44.1 + 44.3). Measured numbers come from running
`tools/flight_core.js` as committed on the four `builds/*_corrected.json` saves.

---

## 0. How an option reaches anything (read this first)

There are three different routes, and which route a row takes decides most of the table.

1. **`spec.cage` only.** Every editor row `P.*` is saved verbatim in `spec.cage` (`tools/_cage_gen.js:7502-7513`,
   `tools/_cage_join.js:632, 1629-1630`). Physics never reads `spec.cage`. A row that only takes this route **draws** but
   bills no mass, draws no current and changes no flight number.
2. **A mapped spec field.** `cageJoinSpec` maps a handful of rows to real spec fields. For this survey they are:
   - `intCons` → `fuselage.material` (`_cage_join.js:523-525`);
   - the seat layout and occupancy → `cabin.seating / seats / occupied / pilots / pax` (`_cage_join.js:452-469, 1597-1626`);
   - the drawn seat positions → `cabin.seatsX` (`_cage_join.js:1310-1316, 464`);
   - the whole Instruments column → `spec.systems` (`_cage_join.js:645, 1653`);
   - `li_bayFrac` / `li_bayHalf` → `wings[0].cuts` (`_cage_join.js:138-148, 241`);
   - interior colours → `spec.finish` (`_cage_join.js:641`).
3. **The fly snapshot.** `lightOn` and the eight `li_*` levels ride the visual snapshot's `lights` record
   (`_cage_join.js:2750-2757`). The cockpit reads them at bind time (`src/viewer/cockpit.js:79-81`).

**The one reader for the electrics is `genSystemsResolve`** (`src/core/60_gen_spec.js:1893`). The ledger, the dash, the
aerials and the bus all read it. Instruments and radios it cannot feed are **dropped and say why**: "no battery", "no
suction", "no oil (electric)" (`60_gen_spec.js:1919-1931`). This is the rule the rest of the interior does not yet follow.

**The bus is `makeBus`** (`src/core/31_elec.js`): 12 V, a battery that drains, an alternator that cuts in at 1100 prop rpm,
a 150 A starter, and loads that sum. **Its only runtime consumer is `src/viewer/cockpit.js`**, which:
- builds the bus at bind (`cockpit.js:107-112`);
- steps it every frame (`cockpit.js:216-226`);
- gates the electric dials, the lamps, the panel backlight and the starter on `bus.ok` / `bus.starterOk`.

---

## 1. THE TABLE

Column key:
- **Spec** — does the option change the spec (and so the flight, the plaque, the certificate)?
- **3D** — is it drawn?
- **Sim** — is it wired to the sim (bus load, battery, an instrument, a lamp)?
- **Mass** — what it bills, and where.
- **Broken / missing** — the gap, if there is one.

Marks: ✔ yes · ✘ no · ½ partly.

### 1A. The instrument fit (Instruments part: Fuselage › Cabin › Cabin fit › Instruments; `tools/_cage_panel.js`)

| Option | Spec | 3D | Sim | Mass | Broken / missing |
|---|---|---|---|---|---|
| **fit** (minimal / basic / ifr / custom), `SY.fit` (`_cage_panel.js:230`) | ✔ `systems.fit` | ✔ sets the dial list (`_cage_panel.js:1373`) | ✔ sets the battery, alternator and loads (`60_gen_spec.js:1864-1882`) | the rows below, plus **the furnishing**: `furnK` minimal 0 / basic 0.5 / ifr 1 / custom 0.5 × Raymer (`60_gen_spec.js:1653-1663`, `61_gen_frame.js:2683`) | **The cabin's trim weight hangs off the instrument tier.** A minimal panel buys a bare cabin and an IFR panel a fully lined one, whatever is drawn. See §4.3. |
| **units** (aviation / metric) | ✔ `systems.units` | ✔ dial faces | — | — | — |
| **side** (pilot / centre) | ✔ `systems.side` | ✔ layout | — | — | — |
| **dial bezels** (plastic / metal) | ½ `systems.look`, which the core neither clamps nor reads | ✔ (`_cage_panel.js:1580`) | — | none (cosmetic by design, `_cage_panel.js:240`) | — |
| **light switches** (toggle / push-pull) | ½ `systems.look` | ✔ (`_cage_panel.js:1078, 1111`) | ✔ same switches | — | — |
| **asi, alt, vsi** | ✔ `systems.items` | ✔ dial | ✔ pitot/static, no power needed | 0.40 / 0.50 / 0.40 kg, firewall top pair (`61_gen_frame.js:2593-2595`) | — |
| **ai** (vacuum) | ✔ | ✔ | ✔ dies without suction (venturi below ~20 m/s, pump with the engine; `cockpit.js:248-251`) | 1.10 | — |
| **aiE** (electric) | ✔ | ✔ | ✔ 1.0 A, dies with the bus | 1.00 | On an aiE build the **vacuum DG never freezes**: `R.hdgDg = R.hdg` whenever aiE is fitted, even with the pump dead (`cockpit.js:299-300`). |
| **dg** (vacuum) | ✔ | ✔ | ✔ freezes without suction (except the case above) | 1.20 | (see aiE) |
| **turn** coordinator | ✔ | ✔ | ✔ 0.3 A | 0.70 | — |
| **tacho, gmeter, oilP, oilT, clock** | ✔ | ✔ | ✔ (oil: nominal while running; clock: the day's) | 0.45 / 0.45 / 0.20 / 0.20 / 0.25 | — |
| **fuel** quantity | ✔ | ✔ | ✔ 0.1 A, reads 0 with a dead bus (`cockpit.js:278`). On a battery build it is the charge gauge, fed by the pack. | 0.25 + 0.30 per tank (charge gauge 0.20) | — |
| **fuelSight** | ✔ | ✔ the cork (no dial; `d: 0`) | ✔ | 0.05 | — |
| **volts** (volt / ammeter) | ✔ | ✔ | ½ 0.02 A; reads `bus.V` | 0.15 | The **ammeter half is never shown**: `bus.amps` is computed but the face drives volts only (`tools/_panel_gen.js:183`). |
| **hobbs** | ✔ | ✘ no face (`d: 0`, by design) | ✔ 0.02 A | 0.10 | Billed and powered, never seen. Acceptable; noted. |
| **compass** | ✔ | ✔ on the coaming | ✔ | 0.30 | — |

### 1B. The electrics (the same column, fold "electrics")

| Option | Spec | 3D | Sim | Mass | Broken / missing |
|---|---|---|---|---|---|
| **battery** (none / lead / lithium) | ✔ `systems.elec.battery` | ½ draws the **master rocker** only (`_panel_gen.js:476`). **No battery is drawn from this row.** | ✔ 0 / 16 / 13 Ah on the bus | 0 / 7.0 / 2.3 kg, firewall bottom pair (`61_gen_frame.js:2600`) | The battery box that IS drawn is the engine bay's `eng_battOn` (§1G), which is not linked to this row. |
| **charging** (none / gen20 / alt60) | ✔ `systems.elec.alternator` | ½ draws the **alt rocker** (`_panel_gen.js:478`). The engine's drawn alternator is `eng_genOn`, not linked. | ✔ 20 / 60 A, cut-in 1100 prop rpm | 0 / 4.0 / 4.5, engine pair | (1) The alternator charges off **prop rpm whether or not the engine runs**, so a windmilling prop charges (`cockpit.js:224`). (2) On an electric build the basic tier still fits a lead battery and a 20 A generator turned by the motor; there is no DC-DC from the pack. |
| **starter** (none / yes) | ✔ `systems.elec.starter` | ½ the key is always drawn (`_panel_gen.js:475`). The engine's starter motor is `eng_starter`, not linked. | ✔ `sim.starterOk` asks the bus (`cockpit.js:115`). The 150 A is hard-coded at the call site; `GEN_ELEC.starter.yes.amps` is not read. | 0 / 4.0, engine pair | The roll-out animation's start bypasses the bus (`src/viewer/rollanim.js:771-778`). Harmless: a fresh battery. |
| **suction** (none / venturi / pump) | ✔ `systems.elec.vac` | ✘ **the venturi drawn on the nose follows the tier NAME**, not this row: `need: R.systems === 'basic' && tube` (`60_gen_spec.js:963`) | ✔ gyros | 0 / 0.4 / 1.2. The venturi is billed on the engine pair, though its own note says "on the strut". | A custom fit with a venturi draws none, and an IFR fit with a pump draws none either way. |
| **harness** (automatic) | ✔ | ✘ (wiring is not drawn) | ✔ whenever there is a bus | 1.2 + 0.15 kg per powered item, firewall top | — |
| **master switch** `swMaster` (`_cage_page5.js:160`) | ✘ cage | ✔ rocker, lit cap | ✔ in flight; in the shed it lights and presses with no bus behind it (by design, `app.js:5820-5834`) | — | — |
| **alt switch** `swAlt` | ✘ cage | ✔ | ✔ in flight | — | **No keyboard binding.** |
| **avionics master** `swAvionics` | ✘ cage | ✔ drawn when COM or XPDR is fitted (`_panel_gen.js:481`) | ½ gates COM and XPDR only (`cockpit.js:219`). NAV and GPS loads run regardless. | — | (1) **Its lit cap lights only when the lights layer is fitted**: the `fitted` exception covers master and alt, not avionics (`cockpit.js:325`). (2) **A shed click on it is a no-op**: it looks up `li_avionics`, which does not exist (`app.js:5828-5829`). (3) No keyboard binding. |
| **key** | ✘ (no row) | ✔ always | ✔ OFF/L/R/BOTH/START, or OFF/ON on a pack | — | — |

### 1C. The avionics (the same column, fold "radios") — not a priority (user, 11 Oct)

| Option | Spec | 3D | Sim | Mass | Broken / missing |
|---|---|---|---|---|---|
| **COM** (none / compact) | ✔ `systems.avionics.com` | ✔ a 57 mm controller face (static digits), plus the comm aerial when `accAerials` is on | ½ 0.5 A behind the avionics master. `ampsTx` 2.0 is declared and never used; no tuning (session 5 of the panel arc, never built). | 0 / 1.0 | Static face. Not a priority. |
| **transponder** (none / modeS) | ✔ | ✔ static "1200" face + aerial | ½ 0.7 A behind the avionics master | 0 / 0.7 | Static face. Not a priority. |
| **NAV** (none / vor, `later`) | ✔ | ½ the aerial only; **no box on the panel** ("declared, not drawn yet", `_cage_panel.js:295`) | ½ 0.5 A, **not behind the avionics master** | 0 / 1.6 | Billed and powered, not drawn. |
| **GPS** (none / portable / panel / glass, all `later`) | ✔ `systems.avionics.gps` | ✘ never drawn (`_panel_gen.js:421` lays out COM and XPDR only) | ½ 0.5 / 1.0 / 2.5 A, not behind the avionics master | 0 / 0.7 / 1.5 / 3.5 | **Left as-is (user, 11 Oct).** The minimap is not tied to it (§5). |

### 1D. The lights (Cabin fit › Lights; `tools/_cage_light.js`)

The general rule today: **`lightOn` is one all-or-nothing fitment.** With it on, every lamp the layer can place is drawn
(`_cage_light.js:1574-1586`). Each `li_*` row is only the design's **switch position**: it sets the glow, not whether the
lamp exists. **No light has a mass, a price, or a spec field.** The amps live as a viewer constant,
`cockpit.js:44 LIGHT_AMPS`, and a hand-copied duplicate of it sits in `tools/_elec_check.js:33`.

| Option | Spec | 3D | Sim | Mass | Broken / missing |
|---|---|---|---|---|---|
| **lights** `lightOn` | ✘ cage + snapshot | ✔ the whole layer, plus the dash's switch row | ✔ zeroes every light load when off (`cockpit.js:221`) | **none** | (1) **No mass or price** for any lamp, wire or switch. (2) **On a build with no battery** (the minimal fit) the lamps are drawn and can never light: V = 0. Nothing says so (the light layer never asks for a bus), unlike an electric dial, which is dropped with a reason. |
| **draw the switches** `lightSw` | ✘ cage | ✔ | ✔ the switches it draws work | — | — |
| **taxi** `li_taxi` | ✘ | ✔ left wing bay (`_cage_light.js:1580`) + the shared spot | ✔ 5 A × switch | none | — |
| **take-off & landing** `li_land` | ✘ | ✔ right wing bay + SpotLight | ✔ 8 A | none | — |
| **navigation** `li_nav` | ✘ | ✔ red / green tips + white tail | ✔ 2.5 A | none | — |
| **beacon** `li_beacon` | ✘ | ✔ fin top, rotating mirror (+ the second fin's) | ✔ 3 A × 0.5 duty | none | — |
| **flood** `li_flood` | ✘ | ✔ cabin lamp + PointLight | ✔ 0.5 A × dimmer | none | — |
| **instrument** `li_instr` | ✘ | ✔ the dial faces are the emitter (no lamp of its own, `byPanel`) | ✔ 0.6 A × dimmer; the backlight dies with the bus | none | — |
| **pedalier** `li_pedal` | ✘ | ✔ under the dash + PointLight | ✔ 0.3 A × dimmer | none | — |
| **passenger** `li_pax` | ✘ | ✔ one lamp per passenger seat | ½ 0.5 A × dimmer | none | (1) **Draws its 0.5 A even when no passenger seat exists, so no lamp is drawn.** The same holds for any lamp the layer could not place: all eight `sw_*` loads exist whenever the bus does (`cockpit.js:107-108`). (2) Not in the night rule (`cockpit.js:171-173`) or the rail's pills. |
| tip lights on which wing, the wing bay (station, half-width, chord, setback, lamp size), fairings, nav nudges, beacon sink / rpm | ½ only `li_bayFrac` / `li_bayHalf` reach the spec (`wings[0].cuts`) | ✔ | — | none | — |
| **strobe** | — | — | — | — | **Not offered.** The beacon is the only anti-collision light (`_cage_light.js:43`). |

### 1E. The cockpit and dash (Structure & skin; Cockpit & dash; Sill shoulder; Door panel)

| Option | Spec | 3D | Sim | Mass | Broken / missing |
|---|---|---|---|---|---|
| **interior** `intOn` | ✘ cage | ✔ `cageInterior` (`_cage_gen.js:3371`) | — | none of its own | — |
| **construction** `intCons` | ✔ `fuselage.material` | ✔ | ✔ structure | ✔ via the material | — |
| **dashboard** `intDash` | ✘ **not mapped** | ✔ the dash shell and facia (`_cage_gen.js:5723-5970`) | — | The panel board is billed at **6 kg/m² from the spec default** `cab.panel {on, depth 0.27, wrap 0.5}` (`60_gen_spec.js:3092`), **not from the drawn dash**. Measured: Cub 1.2, 172 1.6, Jodel 1.73 kg. | **Drawn and billed from two different sources.** The dash can be switched off and still billed, and resizing it never changes the mass. The Cub's drawn dash is 0.39 m deep; the bill uses 0.27. |
| **dash setback / lip / depth / crown / crease** | ✘ cage | ✔ | — | (same) | (same) |
| **pillar bodies, firewall, fire seal, aft bulkhead, bulkhead station** | ✘ cage | ✔ | — | none of their own (the structure is the lattice) | The drawn firewall plate and bulkhead are sheet with no mass. Small; noted. |
| **sill shoulder** (on, width, drop, gauge, lip, run) | ✘ cage | ✔ `cageShoulder`; also carries the door levers, the headset jacks and the intercom (`_cage_crew.js:1471-1532`) | — | **none** | Trim that is drawn and weighs nothing. §4.3. |
| **door panel** (on, gauge, stand-off, margin, map pocket) | ✘ cage | ✔ | — | **none** | Trim that is drawn and weighs nothing. §4.3. |

### 1F. Seats, controls and crew (Seats, Controls, Crew; `tools/_cage_crew.js`)

| Option | Spec | 3D | Sim | Mass | Broken / missing |
|---|---|---|---|---|---|
| **seat type** / design tile "Interior style" `seatType` (tube frame / composite shell / airliner) | ✘ **not mapped** | ✔ `seatTube` / `seatShell` / `seatAirline` (`_cage_crew.js:374, 419, 533`) | — | Billed as **`spec.outfit.seats`, which nothing in the editor writes**: every save carries `"sling"` (3 kg a seat). `GEN_SEATS`: sling 3 / basic 7 / standard 11 / energy 15 (`60_gen_spec.js:1618-1623`). | **Drawn and billed from two different sources.** The Chinook's composite shells and any "Airliner" cabin are billed as 3 kg slings. The design tile's own help says "headliner, console and trim are owed to a later pass" (`_cage_design.js:890`). |
| **row** `seatLayout` (single / side-by-side) | ✔ `cabin.seating / seats / occupied` | ✔ | ✔ | Seats bill **`max(1, rows of the LAYOUT table)` chairs** (`61_gen_frame.js:2378-2386, 2623, 2631`), **not the cabin's seat count** | **The chair count is wrong when they differ.** The 172 save has `seats` 4 and `seating` side2, so it bills 2 chairs; the Jodel save has `seats` 2 and `single`, so it bills 1. The price uses `S.seats` (`61_gen_frame.js:2367`), so price and mass disagree. Passenger-bay seats are never billed as chairs. |
| **seat fore/aft, height, rake, tilt, gap** (+ the passenger seat's) | ✔ `cabin.seatsX` via the measured stations | ✔ | ✔ the CG | ✔ each chair at its own station when measured | — |
| **pax bays, bay seating, bay n seated** | ✔ `cabin.seats / occupied / pax` | ✔ | ✔ 80 kg per filled seat | the occupants yes; **the chairs no** (see row) | (see row) |
| **pitch/roll control** `ctlStick` (stick / yoke / side stick / none) | ✘ cage | ✔ | — (the sim's controls are not the drawn ones) | controls = 0.62 kg/m × (semi-span + tail arm) + 3.4 kg dual (`61_gen_frame.js:2664-2667`). **Independent of this choice**; "none" still bills them. | Small. A yoke column is ~1-2 kg over a stick; noted, not proposed. |
| **throttle** `ctlThr`, **pedals** `ctlPed`, **flaps** `flapCtl`, **trim wheel**, **centre console** `consoleOn` | ✘ cage | ✔ | ½ the flap switch on the dash works the flaps in flight; the others are drawn | inside the controls lump; the console **none** | The console is trim that weighs nothing (§4.3). |
| **floor** `floorOn`, floor lift | ✘ cage | ✔ `buildFloor` (`_cage_crew.js:2126`) | — | **none** | A drawn floor panel with no mass. §4.3. |
| **seat belts** `seatBelt` | ✘ (default only) | ✘ removed (`_cage_crew.js:585-588`) | — | none | Not offered. Fine. |
| **pilot dummy** `dumOn`, pilot / co-pilot | ½ `cabin.occupied / pilots` | ✔ | ✔ | 80 kg per occupant | The pilot's 80 kg is billed with the dummy hidden. **By design**: the dummy is a picture, not the pilot. |

### 1G. Fittings and the engine bay (the ones that claim to be electrics)

| Option | Spec | 3D | Sim | Mass | Broken / missing |
|---|---|---|---|---|---|
| **access layer** `accOn`, **instruments** `accInstr` (static ports, venturi, OAT probe), **aerials & lights** `accAerials` | ✘ cage; which fittings appear is decided by `GEN_ACCESS` rules on the resolved spec (`60_gen_spec.js:949-1072`) | ✔ (`tools/_fit_gen.js`) | — | `GEN_ACCESS` has **no kg** | The venturi follows the tier name, not `elec.vac` (§1B). The aerials follow the avionics rows correctly. |
| **engine bay: battery** `eng_battOn` | ✘ an install row "engResolve does not read" (`_cage_eng.js:130-142`) | ✔ a battery box in the bay (`tools/_eng_mesh.js:3035-3049`) | — | none | **Not linked to `systems.elec.battery`.** A build shows a battery box while its systems say "no battery", or the reverse. All four reference saves carry `eng_battOn` 1. |
| **engine bay: alternator** `eng_genOn` | ✘ install row | ✔ (`_eng_mesh.js:1959`) | — | none | **Not linked to `systems.elec.alternator`.** |
| **engine bay: starter motor** `eng_starter` | ✘ install row | ✔ (`_eng_mesh.js:2006`) | — | none | **Not linked to `systems.elec.starter`.** |
| **engine bay: magnetos, ECU** | ✘ install row | ✔ | — | none | Not electrics in the bus's sense; fine. |
| **pitot** | ✘ (no row) | ✔ always, on the first wing (`63_gen_wing.js:755-797`) | ✔ the ASI | none | No pitot heat. Fine for day/night VFR. |

### 1H. Interior colours (paint view → `spec.finish`)

Seat upholstery (`seatTrim`), the instrument facia and glareshield (`dashFace` / `dash`, in woods, alloys, leathers or
plastics), the sill and door pad, the pilot's suit: **✔ spec (`finish`) · ✔ drawn · no sim · no mass**. A leather facia
weighing what a plastic one does is fine at this scale; nothing proposed.

### 1I. Not offered at all

ELT · strobe · pitot heat · electric fuel pump · flap motor · cabin fan / heater as a load · headsets as equipment (only
the jacks are drawn) · headliner / carpet / sidewalls as drawn parts (they exist only as the furnishing mass, §4.3).
None of these is proposed now.

---

## 2. THE MEASURED STATE OF THE FOUR REFERENCE SAVES

`builds/*_corrected.json` through the committed core:

| Save | fit | battery / charging / COM | systems kg | seating / seats | `outfit.seats` | `seatType` | dash depth (drawn / billed) | outfit kg |
|---|---|---|---|---|---|---|---|---|
| Cub | basic | lead / gen20 / compact | 22.6 | tandem2 / 2 | sling | 0 tube | 0.39 / 0.27 | 37.7 |
| Cessna 172 | custom | lead / alt60 / compact | 30.4 | **side2 / 4** | sling | 0 tube | 0.35 / 0.27 | 73.1 |
| Jodel | basic | lead / gen20 / compact | 22.6 | **single / 2** | sling | 0 tube | 0.14 / 0.27 | 27.7 |
| Chinook | basic | lead / gen20 / compact | 22.6 | tandem2 / 2 | sling | **1 shell** | 0.12 / 0.27 | 27.8 |

GATE WEIGHT already says why its big-aeroplane bands are wide: "an interior this outfit has no row for"
(`tools/_weight_check.js:36-38, 61-66`). The 172 measures 639 kg against a published 736 kg (−13 %); the Caravan is 47 %
short.

---

## 3. WHAT DOES NOT MATCH, IN ONE LIST

Grouped by the user's own sentence: "the electrics work and correspond to elements drawn in 3D".

**Drawn but not powered, or powered but not drawn**
- E1. Lights on a build with no battery: drawn, never lit, nothing said (§1D).
- E2. A light load for a lamp the layer never drew (`pax` with no passenger seat, any unplaced lamp) (§1D).
- E3. NAV and GPS: billed and drawing current, with no box on the panel and not behind the avionics master (§1C). GPS is
  **left as-is** (ruling). NAV is not a priority.
- E4. The engine bay's battery, alternator and starter are drawn from their own rows, not from the systems (§1G).
- E5. The venturi is drawn by the tier name, not by `elec.vac` (§1B).
- E6. `LIGHT_AMPS` is a viewer constant with a hand copy in GATE ELEC; the core has no light catalogue (§1D).

**Wired wrong in the cockpit (small)**
- W1. The avionics master's lit cap needs the lights layer (`cockpit.js:325`).
- W2. The avionics master in the shed is a no-op (`app.js:5828`).
- W3. The vacuum DG never freezes on an aiE build (`cockpit.js:299`).
- W4. The alternator turns with a windmilling prop (`cockpit.js:224`).
- W5. The ammeter needle is never drawn (`_panel_gen.js:183`).

**Mass that does not follow what is drawn** (the user's furnishing ruling)
- M1. Seat **kind**: `seatType` is never mapped; every aeroplane bills 3 kg slings (§1F).
- M2. Seat **count**: the layout's rows, not the cabin's seats; passenger-bay chairs are never billed (§1F).
- M3. The **panel board**: the spec default, not the drawn dash (§1E).
- M4. The **trim**: floor, door panels, sill shoulders and console are drawn and weigh nothing, while a furnishing lump
  scaled from the instrument tier stands in for them (§1A, §1E, §1F).
- M5. The **lights**: no mass for any lamp, lens, wire or switch (§1D).

---

## 4. PROPOSED ORDER (phase 2, then phase 3) — for the user's OK

Each step is one commit with its node gate. Gates run as `node tools/run_gates.js --only=<IDs> --no-build`, after a
separate `node tools/build.js` (the generated outputs are not committed: they are A0's at the train). Anything that moves
empty mass moves frozen numbers. **ENERGYBASE** (fourteen aeroplanes frozen node by node), **GEN**'s shakedown anchors and
**WEIGHT**'s table move together, and each re-freeze is named in its commit with the before / after.

### 4.1 Step A — ONE LIGHT CATALOGUE IN CORE (E6, E1, E2, M5). [S] Mass +0.5-3 kg per aeroplane.

- A `GEN_LIGHTS` table beside `GEN_ELEC` (`60_gen_spec.js`): per key, the amps (today's `LIGHT_AMPS`), a kg and a price
  for the fitting (nav set 0.6 kg, beacon 0.45, landing 0.4, taxi 0.4, interior lamps 0.08 each, per-lamp wiring in the
  harness's `kgPerItem`).
- `systems.lights` in the spec, written by `cageJoinSpec` from the drawn census: **which lamps the light layer actually
  drew, and how many**. The census already exists (`drawn[key]`, `_cage_light.js:1570`).
- `genSystemsResolve` treats a lamp like an electric dial: **dropped "no battery"** on a build with no bus, and the drop
  is said on the panel column the way a dial's is. Its rows go in the bill and the ledger (wing lamps at the tips' rings,
  the beacon at the fin, interior lamps at the cabin rings).
- `cockpit.js` builds its light loads from the resolver's `loads` and stops carrying `LIGHT_AMPS`; GATE ELEC reads the
  core table (the copy goes).
- **Gate:** GATE ELEC grows "a load per DRAWN lamp, none for an undrawn one; no-bus build: lamps dropped with a reason;
  the light rows billed exactly once". GATE PANEL §8 keeps "master off: the nav lens is dark".

### 4.2 Step B — WHAT IS SWITCHED IS DRAWN (E4, E5, W1, W2, W3). [S-M] No mass change.

- The engine bay's battery box, alternator and starter motor **follow `systems.elec`** (the systems are the truth; the
  bay rows become derived, and their sliders read the fit). Where the battery is billed (firewall bottom) is where the
  box is drawn when the engine is on the nose. A pack build draws no 12 V box unless the fit has one.
- `GEN_ACCESS.venturi.need` reads the resolved `vac === 'venturi'`, not the tier name.
- The cockpit fixes: the avionics cap lights with its own switch; the shed's avionics click toggles `swAvionics`; the DG
  freezes on suction whatever the AI is.
- **Gate:** a new **GATE FITMATCH** (core, node, headless: `tools/_scene_headless.js` already runs the page's own
  `PAGE.post` chain in node, which is how GATE TANKMOUNT builds every archetype; its default `EXCLUDE` drops
  `_cage_crew.js`, `_panel_gen.js` and `_cage_panel.js` (`_scene_headless.js:38`), and the light layer's interior lamps
  hang off the crew's anchors, so FITMATCH must bring those layers in or the census will be thin, and that is the step's
  first risk). Over the reference saves and every tier × battery × alternator × starter × vac × lights
  corner it asserts, both ways:
  - every drawn electrical thing (lamp, bay battery, alternator, starter, venturi, rocker, radio face) is in the
    resolver's record **and** bills a mass **and**, if electric, has a load;
  - every resolver row that is fitted and drawable is drawn.
  `--selftest` doctors one row in each direction.

### 4.3 Step C — CABIN FURNISHING IN MASS (M1, M2, M3, M4). [M] Mass moves on every aeroplane.

- **M1** `seatType` maps to `outfit.seats` in the join: tube frame → `sling`, composite shell → `basic` (moulded pan,
  7 kg), airliner → `standard` (upholstered, 11 kg). The Chinook moves +8 kg.
- **M2** Chairs are billed **per seat of the cabin** (`S.seats`, every bay), each at its measured station, so mass and
  price agree. The 172 moves +6 kg at slings, +22 kg as upholstered.
- **M3** `intDash` / `dashDepth` / the drawn dash width map to `cab.panel` (`on`, `depth`), so the panel board is the
  drawn one. With no dash, there is no board.
- **M4** THE TRIM FROM WHAT IS DRAWN. The floor, the door panels, the sill shoulders and the console are billed from
  their own drawn areas × an areal density (floor ply 2.5 kg/m², door / side pads 1.2, carpet 0.9 per m² of floor). The
  **furnishing lump stops reading the instrument tier**. The Raymer law (GA, on W0) stays as the **cross-check**: GATE
  WEIGHT prints drawn vs Raymer per card and fails beyond a band. The headliner and soundproofing, which nothing draws
  yet, stay a Raymer share keyed to the interior style (tube 0, shell 0.5, airliner 1), so the airliner cabin keeps its
  weight and a bare Cub carries none.
- **Gates:** GATE BUILD (seat count × kind, station levers, dash off → no board), GATE JOIN (the three new mappings at
  non-default values, the G48 discipline), GATE WEIGHT (the drawn-vs-Raymer column; the published-weight bands, which
  should **narrow** for the 172 and the bigger cards), ENERGYBASE and GEN re-frozen and named.

### 4.4 Step D — small cockpit truths (W4, W5). [S] Optional, last.

The alternator runs only with the engine running; the ammeter needle on the volt/ammeter face.

### 4.5 Phase 3 — THE GPS WITH THE MINIMAP (only after the user's OK of this status)

Kept independent of the `GEN_AVIONICS.gps` row (ruling). The groundwork is already there:
- the minimap renderer, `drawMap()` (`app.js:11291`), with its baked underlay (`render_world.js:1525-1562`) and the
  pilot's plan overlay (`app.js:11229-11290`);
- the navigator, `38_nav.js` (DTK / TRK / BRG / DIS / XTK / CDI / ETE / GS), which the autopilot already uses
  (`app.js:5029`) and which nothing shows the pilot.

The plan of `PANEL-2026-09-11.md` session 6 still stands:
- `drawMap` becomes `drawMapInto(ctx, W, opts)`, one renderer for the HUD map and a GPS page;
- the minimap gains a NAV strip (the leg's DTK / DIS / ETE / XTK from `38_nav`) and a direct-to on the map's click.

It is designed in its own short note before any code, after the user's OK.

**Proposed sequence: A → B → C → (D) → the user's look → phase 3.** A and B are the "electrics match the 3D" sentence; C
is the furnishing ruling. A comes first because B's gate and C's ledger both read the light rows.

---

## 5. THE GPS AND THE MINIMAP TODAY (for phase 3)

- **The GPS** is a catalogue row only: `GEN_AVIONICS.gps` portable / panel / glass, all `later` (`60_gen_spec.js:1849-1856`).
  No tier fits one. If fitted, it bills mass and price and an ungated load. It is never drawn, and no instrument, HUD or
  map reads it. **Left as-is.**
- **The minimap** is a HUD panel in `app.js`: `drawMap` (11291), the plan overlay (11229-11290), click for large /
  nose-up (11512-11524), the rail's "map" flyout (11635), redrawn on the HUD cadence (14492). It is tied to no fit, no
  avionics and no bus.
- **The navigator** `38_nav.js` drives the autopilot; nothing shows its numbers to the pilot.
- **The relation between the GPS and the minimap today: none.**
