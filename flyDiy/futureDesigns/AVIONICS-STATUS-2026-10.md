# AVIONICS-STATUS — interior, electrics, avionics and lights: what the editor offers and what each option actually does (2026-10-12)

G2800 AVIONICS-GPS, phase 1 (cloud, node only, read-only survey).

**Two passes, one document.** A first pass on 10 Oct (commit 1e56d9b9, base train 42) wrote this file before the user's
11 Oct rulings. This second pass (12 Oct, base train 44.1 + 44.3) re-surveyed, re-checked that pass's findings against
the code, and merged them here. Every 10 Oct finding that holds is in the tables below; the one that does not hold on
this base is said where it sits. The 10 Oct plan G2801-G2809 is replaced by §4, which is mapped step by step in §6, and
its flood-dimmer freeze trace is kept whole in §7. The 10 Oct text stays in git (1e56d9b9).

The source is the user's slider review of 10 Oct:
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
| **fit** (minimal / basic / ifr / custom), `SY.fit` (`_cage_panel.js:230`) | ✔ `systems.fit` | ✔ sets the dial list (`_cage_panel.js:1373`) | ✔ sets the battery, alternator and loads (`60_gen_spec.js:1864-1882`) | the rows below, plus **the furnishing**: `furnK` minimal 0 / basic 0.5 / ifr 1 / custom 0.5 × Raymer (`60_gen_spec.js:1653-1663`, `61_gen_frame.js:2683`) | **Two hidden couplings.** (1) The cabin's trim weight hangs off the instrument tier: a minimal panel buys a bare cabin and an IFR panel a fully lined one, whatever is drawn (§4.3). (2) Five `GEN_ACCESS` fittings follow the tier NAME, not the items or the electrics: the static drain, the static port, the venturi, the OAT probe and the crown beacon (`60_gen_spec.js:838-1054`). |
| **units** (aviation / metric) | ✔ `systems.units` | ✔ dial faces | — | — | — |
| **side** (pilot / centre) | ✔ `systems.side` | ✔ layout | — | — | — |
| **dial bezels** (plastic / metal) | ½ `systems.look`, which the core neither clamps nor reads | ✔ (`_cage_panel.js:1580`) | — | none (cosmetic by design, `_cage_panel.js:240`) | — |
| **light switches** (toggle / push-pull) | ½ `systems.look` | ✔ (`_cage_panel.js:1078, 1111`) | ✔ same switches | — | — |
| **asi, alt, vsi** | ✔ `systems.items` | ✔ dial | ✔ pitot/static, no power needed | 0.40 / 0.50 / 0.40 kg, firewall top pair (`61_gen_frame.js:2593-2595`) | — |
| **ai** (vacuum) | ✔ | ✔ | ✔ dies without suction (venturi below ~20 m/s, pump with the engine; `cockpit.js:248-251`) | 1.10 | — |
| **aiE** (electric) | ✔ | ✔ | ✔ 1.0 A, dies with the bus | 1.00 | On an aiE build the **vacuum DG never freezes**: `R.hdgDg = R.hdg` whenever aiE is fitted, even with the pump dead (`cockpit.js:299-300`). |
| **dg** (vacuum) | ✔ | ✔ | ✔ freezes without suction (except the case above) | 1.20 | (see aiE) |
| **turn** coordinator | ✔ | ✔ dial + aeroplane symbol | ✘ **the symbol never banks.** The 0.3 A load is there, but `gaugeAt(..., 'edGauge_turn_plane', ..., 'r', 'lin', {sgn, k})` carries no `gauge` / `hand` (`_cage_panel.js:1633`), so the join bakes no `stops` (`_cage_join.js:2647`), and `interp(undefined)` is 0 (`cockpit.js:48`). The slip ball is a static disc; `raw.beta` is computed and drives nothing. | 0.70 | **A drawn, powered, billed instrument that does nothing** (10 Oct finding, re-checked). |
| **tacho, gmeter, oilP, oilT, clock** | ✔ | ✔ | ✔ (oil: nominal while running; clock: the day's) | 0.45 / 0.45 / 0.20 / 0.20 / 0.25 | — |
| **fuel** quantity | ✔ | ✔ | ✔ 0.1 A, reads 0 with a dead bus (`cockpit.js:278`). On a battery build it is the charge gauge, fed by the pack. | 0.25 + 0.30 per tank (charge gauge 0.20) | — |
| **fuelSight** | ✔ | ✘ **nothing** (`d: 0`, no face, and no layer draws a cork: `fuelSight` appears nowhere in `_panel_gen.js`, `_cage_panel.js`, `_cage_crew.js`, `_cage_energy.js` or `cockpit.js`) | ✘ no reading | 0.05 | **Billed, never drawn**, and it is the minimal tier's only fuel instrument. |
| **volts** (volt / ammeter) | ✔ | ✔ | ½ 0.02 A; reads `bus.V` | 0.15 | The **ammeter half is never shown**: `bus.amps` is computed but the face drives volts only (`tools/_panel_gen.js:183`). |
| **hobbs** | ✔ | ✘ no face (`d: 0`, by design) | ✔ 0.02 A | 0.10 | Billed and powered, never seen. Acceptable; noted. |
| **compass** | ✔ | ✔ on the coaming | ✔ | 0.30 | — |

### 1B. The electrics (the same column, fold "electrics")

| Option | Spec | 3D | Sim | Mass | Broken / missing |
|---|---|---|---|---|---|
| **battery** (none / lead / lithium) | ✔ `systems.elec.battery` | ½ draws the **master rocker** only (`_panel_gen.js:476`). **No battery is drawn from this row.** | ✔ 0 / 16 / 13 Ah on the bus | 0 / 7.0 / 2.3 kg, firewall bottom pair (`61_gen_frame.js:2600`) | The battery box that IS drawn is the engine bay's `eng_battOn` (§1G), which is not linked to this row. |
| **charging** (none / gen20 / alt60) | ✔ `systems.elec.alternator` | ½ draws the **alt rocker** (`_panel_gen.js:478`). The engine's drawn alternator is `eng_genOn`, not linked. | ✔ 20 / 60 A, cut-in 1100 prop rpm for both, hard-coded at the call site (`cockpit.js:111`) | 0 / 4.0 / 4.5, engine pair | (0) An alternator or a starter on a build with no battery is billed and not flagged. (1) The alternator charges off **prop rpm whether or not the engine runs**, so a windmilling prop charges (`cockpit.js:224`). (2) On an electric build the basic tier still fits a lead battery and a 20 A generator turned by the motor; there is no DC-DC from the pack. |
| **starter** (none / yes) | ✔ `systems.elec.starter` | ½ the key is always drawn (`_panel_gen.js:475`). The engine's starter motor is `eng_starter`, not linked. | ✔ `sim.starterOk` asks the bus (`cockpit.js:115`). The 150 A is hard-coded at the call site; `GEN_ELEC.starter.yes.amps` is not read. | 0 / 4.0, engine pair | The roll-out animation's start bypasses the bus (`src/viewer/rollanim.js:771-778`). Harmless: a fresh battery. |
| **suction** (none / venturi / pump) | ✔ `systems.elec.vac` | ✘ **the venturi drawn on the nose follows the tier NAME**, not this row: `need: R.systems === 'basic' && tube` (`60_gen_spec.js:963`) | ✔ gyros | 0 / 0.4 / 1.2. The venturi is billed on the engine pair, though its own note says "on the strut". | A custom fit with a venturi draws none, and an IFR fit with a pump draws none either way. |
| **harness** (automatic) | ✔ | ✘ (wiring is not drawn) | ✔ whenever there is a bus | 1.2 + 0.15 kg per powered item, firewall top | — |
| **master switch** `swMaster` (`_cage_page5.js:160`) | ✘ cage | ✔ rocker, lit cap | ✔ in flight; in the shed it lights and presses with no bus behind it (by design, `app.js:5820-5834`) | — | — |
| **alt switch** `swAlt` | ✘ cage | ✔ | ✔ in flight | — | **No keyboard binding.** |
| **avionics master** `swAvionics` | ✘ cage | ✔ drawn when COM or XPDR is fitted (`_panel_gen.js:481`) | ½ gates COM and XPDR only (`cockpit.js:219`). NAV and GPS loads run regardless, and a NAV- or GPS-only fit gets no avionics master at all. | — | (1) **Its lit cap lights only when the lights layer is fitted**: the `fitted` exception covers master and alt, not avionics (`cockpit.js:325`). (2) **A shed click on it is a no-op**: it looks up `li_avionics`, which does not exist (`app.js:5828-5829`). (3) No keyboard binding. |
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
| **taxi** `li_taxi` | ✘ | ✔ left wing bay (`_cage_light.js:1580`) + the shared spot | ✔ 5 A × switch | none | **Its tape on the panel reads "cruise"** (`_cage_panel.js:516-517` `LABEL_OF`). |
| **take-off & landing** `li_land` | ✘ | ✔ right wing bay + SpotLight | ✔ 8 A | none | — |
| **navigation** `li_nav` | ✘ | ✔ red / green tips + white tail | ✔ 2.5 A | none | — |
| **beacon** `li_beacon` | ✘ | ✔ fin top, rotating mirror (+ the second fin's) | ½ 3 A × 0.5 duty; in flight the lens pulses at a **fixed 0.75 Hz** (`cockpit.js:320`) and `li_beaconRpm` is not read | none | (1) The rotation row works in the shed only. (2) **A second, unwired beacon**: on a V-tail or a rod boom, `GEN_ACCESS.beacon` (`60_gen_spec.js:1042-1054`) draws a plastic beacon on the crown that is not a lamp, not switched, and drawn even with the lights off. |
| **flood** `li_flood` | ✘ | ✔ cabin lamp + PointLight | ✔ 0.5 A × dimmer | none | (1) Taped **"Dash"** on the panel (`_cage_panel.js:516`) and "cabin" on the rail. (2) **The garage freeze on a dimmer drag** is traced in §7 (EDITOR-BUGS G2780's). |
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
| **pitch/roll control** `ctlStick` (stick / yoke / side stick / none) | ✘ cage | ✔ | ✔ the drawn control moves with the elevator / aileron (the linkage drives `de da dr flap thr brake trim fuel`, `50_model_codec.js:268`) | controls = 0.62 kg/m × (semi-span + tail arm) + 3.4 kg dual (`61_gen_frame.js:2664-2667`). **Independent of this choice**; "none" still bills them. | Small. A yoke column is ~1-2 kg over a stick; noted, not proposed. |
| **dual controls** (implicit) | ✘ | ✔ a station per side-by-side seat | — | +3.4 kg whenever the cabin has more than one seat (`61_gen_frame.js:2667`) | Billed even when only one station is drawn (a tandem with one stick). |
| **throttle** `ctlThr`, **pedals** `ctlPed`, **flaps** `flapCtl`, **trim wheel**, **centre console** `consoleOn` | ✘ cage | ✔ | ½ the flap switch on the dash works the flaps in flight; the others are drawn | inside the controls lump; the console **none** | The console is trim that weighs nothing (§4.3). |
| **floor** `floorOn`, floor lift | ✘ cage | ✔ `buildFloor` (`_cage_crew.js:2126`) | — | **none** | A drawn floor panel with no mass. §4.3. |
| **fuel selector** (no row; crew layer, `_cage_crew.js:1537`) | ½ `sim.ctl.fuel` | ✔ | ½ OFF stops the engine; L / R / BOTH are cosmetic (the solver has no per-tank feed) | inside the fuel plumbing | Not electrics; noted. |
| **baggage** `cabin.baggage` (no editor row; presets set it, 10 kg) | ✔ | ✘ | ✔ ledger `cargo` | ✔ | Not drawn; noted. |
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
- E7. The turn coordinator: drawn, powered, billed, and its symbol never banks; the slip ball is static (§1A).
- E8. The fuel sight gauge: billed, never drawn, and the minimal tier's only fuel instrument (§1A). (The hour meter is
  the same, but faceless by design.)
- E9. The crown beacon of `GEN_ACCESS` on a V-tail or a rod boom: drawn, not a lamp, not switched, there with the lights
  off; and the other tier-name fittings (static drain, static port, OAT probe) follow the tier, not the items (§1A, §1D).
- E10. An alternator or a starter on a build with no battery: billed, not flagged (§1B).

**Wired wrong in the cockpit (small)**
- W1. The avionics master's lit cap needs the lights layer (`cockpit.js:325`).
- W2. The avionics master in the shed is a no-op (`app.js:5828`).
- W3. The vacuum DG never freezes on an aiE build (`cockpit.js:299`).
- W4. The alternator turns with a windmilling prop (`cockpit.js:224`).
- W5. The ammeter needle is never drawn (`_panel_gen.js:183`).
- W6. The panel tapes: taxi reads "cruise", the flood reads "Dash" (`_cage_panel.js:516-517`).
- W7. The beacon pulses at a fixed 0.75 Hz in flight; `li_beaconRpm` is the shed's only (`cockpit.js:320`).

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

### 4.2 Step B — WHAT IS SWITCHED IS DRAWN, WHAT IS DRAWN WORKS (E4, E5, E7-E10, W1-W3, W6, W7). [M] No mass change except E8.

- The engine bay's battery box, alternator and starter motor **follow `systems.elec`** (the systems are the truth; the
  bay rows become derived, and their sliders read the fit). Where the battery is billed (firewall bottom) is where the
  box is drawn when the engine is on the nose. A pack build draws no 12 V box unless the fit has one.
- `GEN_ACCESS.venturi.need` reads the resolved `vac === 'venturi'`, not the tier name.
- The cockpit fixes: the avionics cap lights with its own switch; the shed's avionics click toggles `swAvionics`; the DG
  freezes on suction whatever the AI is.
- The dash's dead items: the turn coordinator's symbol gets its `gauge: 'turn', hand: 'plane'` so the join bakes stops,
  and the slip ball rides `beta`; the fuel sight gauge is drawn (a cork on a wire through the cap, the J-3's) or stops
  being billed - drawn is proposed.
- The crown beacon becomes a light-layer lamp (switched, on the bus, gone with the lights off) or goes; the other
  tier-name fittings follow the resolved items (the static port with the ASI / ALT, the OAT probe with an OAT item when
  there is one, else stays as the fit's). An alternator or starter with no battery is said on the panel column, as a
  dropped dial is. The cut-in and the starter's amps come from `GEN_ELEC` rows, not the call site.
- The tapes (taxi, flood) and the beacon's flown rate read the design's `li_beaconRpm`.
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
- one catch to design for (10 Oct finding, re-checked): under the physics worker the navigator lives in the worker
  (`sim_host.js:383-384`, `world.__simNav`) and the page's snapshot skips it (`sim_link.js:68`, `AP_SKIP` holds `nav`),
  so the readout (`ap.instruments()`, `43_pilot.js:673`) has to be shipped before the page can show it.

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

## 6. THE 10 OCT PLAN (G2801-G2809), MAPPED

The first pass planned nine steps before the 11 Oct rulings. Where each one went:

| 10 Oct step | Now |
|---|---|
| G2801 the lights on the ledger and the bus | **Step A** (plus its tape fixes and the crown beacon, now in Step B) |
| G2802 the electrics rows draw what they bill | **Step B** |
| G2803 the dash's dead items (turn coordinator, DG, hobbs, fuel sight, dark faces on a dead bus) | **Step B** (turn coordinator, DG, fuel sight). COM / XPDR faces going dark: not a priority (ruling). The hour meter stays faceless. |
| G2804 the interior: drawn = billed | **Step C**. The control-run mass by stick / pedal type is left out: a yoke is ~1-2 kg over a stick. |
| G2805 one map renderer (`drawMapInto`) | **Phase 3**, after the user's OK |
| G2806 the GPS in 3D (a tablet on a mount, a panel slot) | **Ruled out for now** (11 Oct: the GPS stays as-is, independent of the GPS drawn inside) |
| G2807 the GPS live (a CanvasTexture face, nav shipped from the worker) | The NAV readout and the worker shipping go to **phase 3**, on the minimap rather than on a drawn face |
| G2808 GPS a career unlock (TECH-ERA / MACHINE-SHOP hook) | **Not proposed.** Not in the brief, and it couples the GPS to the fit, which the ruling keeps apart. |
| G2809 reserve, A0 stills, the glass note | Stills are A0's (the cloud cannot render); the glass note is not proposed. |

The 10 Oct open questions are answered by the rulings: (1) the HUD minimap stays for every aeroplane, independent of the
fit; (2) COM / XPDR tuning is not a priority; (3) re-billing every build's empty mass is §8 Q4.

## 7. THE FREEZE: "lights → inside dimmer → flood" (belongs to EDITOR-BUGS G2780; the 10 Oct pass's trace, kept whole)

*Re-checked on train 44.1 + 44.3 (12 Oct): the defer line (`_cage_light.js:1378`), the `matCache` clear
(`_cage_ui.js:1928`) and the premises rule (`render_premises.js:246`) are where the trace says. Still unmeasured: the
cloud cannot render.*

Found by reading, not measured (the cloud cannot render).

**The cause: the garage scene's THREE light count changes on a dimmer drag.**
- The light layer creates the flood and pedal PointLights and the landing SpotLight only while their level is > 0 (`_cage_light.js:1602-1624`).
- On every deferred drag tick it hides its whole group, lights included (`_cage_light.js:1378`, `if (ctx.defer) { group.visible = false; return; }`, G1303).
- three r186 counts only visible lights. So the lights state changes, and every lit material in the garage scene compiles a new program variant, synchronously, in one frame.
- That includes the shed, the props, the parked aeroplanes and the aeroplane's own heavily injected materials. The build path also clears `matCache` (`_cage_ui.js:1928`), so the variants are compiled again.
- One drag compiles up to twice: once when the group hides, once when it shows again on release. Crossing 0 changes the count again.

**Smaller costs on release:**
- The full light-layer rebuild walks every wing, fin, stab and cabin face (`sites()`, :680-1340).
- New lens and cup materials are made per 0.05 step and never disposed (:222, :268).
- The understudy material pass, `placeEditor`'s bounding box, and the 400 ms `commit`.

**Hypothesis:** the shader compiles are the seconds; the rebuild is tens to hundreds of ms.

The codebase already states the rule:
- `render_premises.js:244`: "a count that changes recompiles every lit material".
- The flight side obeys it: `cockpit.js:142-179` keeps the lights constant and only turns their intensity.

**Confirm (A0, local GPU):** watch `renderer.info.programs.length` across a flood drag. Then:
- drag a wing row with flood > 0: it should stutter;
- drag with flood, pedal and land all at 0: it should not;
- set `CAGE_UI.dragDefer = false`: any freeze left comes only from crossing 0.

**Fix direction (for G2780, not done here):**
- Constant lights while `lightOn` and their fitting exist; drive intensity only.
- Hide the meshes, not the lights, on a defer.
- A fast path for dimmer-only rows that sets emissive and intensity in place (the `applyDrive` idiom), with no rebuild.


## 8. OPEN FOR THE USER

1. OK the order A → B → C → (D), then phase 3?
2. The seat-kind mapping: tube → sling 3 kg, composite shell → moulded 7 kg, airliner → upholstered 11 kg?
3. Trim from the drawn areas with Raymer as the check (recommended), or the smaller change: the Raymer lump keyed to the
   interior style instead of the instrument tier?
4. Step C moves every aeroplane's empty mass (a few kg; the 172 more). OK to re-freeze ENERGYBASE / GEN / WEIGHT on it,
   named at the train?
5. The fuel sight gauge: draw it (proposed), or stop billing it?
6. Phase 3 go?
