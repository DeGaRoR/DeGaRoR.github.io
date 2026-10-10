# AVIONICS-STATUS 2026-10 — what the interior, electrics, lights, instruments, radios and GPS options do (G2800)

*AVIONICS-GPS step 1 (G2800), 2026-10-10, cloud, node only, read-only: no `src/` or `tools/` edit. Base: origin/master
train 42 (26e04598b). Branch `claude/avionics-gps-g2800`.*

The user (slider review, 10 Oct 2026): *"Maybe we should finish the interior work, ensure the electrics work and
correspond to elements drawn in 3d, and do the GPS things. And do a status on which of these options are wired or not
yet. And do the GPS with integration of the minimap maybe."*

## How to read the table

- **Garage rows.** Every garage row in these families is from the cage editor, which is built into the game by `tools/build.js` MANIFEST:
  - `tools/_cage_page5.js` `groupsOverride` holds the interior, seats, controls and doors rows.
  - `tools/_cage_light.js` holds the `2e · lights` rows.
  - `tools/_cage_panel.js` `renderPanel` is the "Instruments" part; it holds the fit, the units, the dials, the electrics and the radios.
  - The part tree is in `tools/_cage_parts.js:1028-1137`.
  - `src/viewer/editor.js` and `garage.js` hold no rows of these families. editor.js:1801 "radio" is the boombox music player.
  - `src/viewer/cabin.js` and `cabin_livery.js` are the TRAM cabin, not the aeroplane's.
- **One reader.** `genSystemsResolve` (`src/core/60_gen_spec.js:1893`) feeds three places:
  - the ledger, at `61_gen_frame.js:2590-2606`: the panel on the firewall top pair, the battery low on the firewall, the alternator, starter and pump on the engine, and the avionics on the top pair;
  - the bus: `cockpit.js:107-113` passes it to `makeBus`, in `31_elec.js`;
  - the dash: `_cage_panel.js` → `_panel_gen.js`.
- **Drawn in flight.** The join bakes every visible mesh into the flown model (`_cage_join.js:2035-2064`). So "drawn in 3D" means drawn in the garage AND in flight, unless a row says otherwise.
- **Moving and clickable controls.** The linkage drives only `de da dr flap thr brake trim fuel thr0-3` (`50_model_codec.js:268`). Only flap, brake, fuel, trim and throttle are clickable picks (`app.js:2779`, `cockpit.js:441-566`).
- **Night lights.** "Auto" means `CK.lightsFor` (`cockpit.js:184`), the night rule that turns the lights on at sunset.

Measured with `genSystemsResolve` on `tools/flight_core.js` (train 42), node:

| tier | fit kg | price cr | bus loads (A) |
|---|---|---|---|
| minimal | 2.10 | 1 800 | none (no battery) |
| basic | 22.55 | 7 950 | fuel 0.1, volts 0.02, com 0.5 |
| ifr | 28.80 | 16 660 | aiE 1, turn 0.3, fuel 0.1, volts 0.02, hobbs 0.02, com 0.5, xpdr 0.7, nav 0.5 |
| basic + GPS portable / panel / glass | +0.7 / +1.5 / +3.5 kg | +900 / +4 500 / +6 500 | + gps 0.5 / 1.0 / 2.5 |

Lights are NOT among those loads. `cockpit.js:44` LIGHT_AMPS adds them at bind; all on is 18.9 A against basic's 20 A generator.

## THE TABLE

Verdict words:
- **YES**: does what it says, in flight.
- **PARTLY**: does part of what it says; the gap is in the notes.
- **NO**: chosen and billed, but does nothing in flight.
- **n/a**: a geometry or placement row.

| option | where defined (file:line) | DRAWN in 3D? (which mesh) | WIRED to the sim / bus? | affects physics (mass, power draw)? | works in flight? | notes |
|---|---|---|---|---|---|---|
| **INSTRUMENTS** — `GEN_INSTR`, one checkbox per key | `60_gen_spec.js:1749-1792`; rows `_cage_panel.js:251-275` | | | | | |
| airspeed `asi` | 60_gen_spec:1750 | 79 mm dial in the T (`_panel_gen` FACES:166) | `lin` needle on `R.ias` (cockpit.js:254) | 0.40 kg, 350 cr, no amps | YES | Reads 0 below ~35 km/h by design (G700). Not tied to the static-port fitting. |
| altimeter `alt` | :1752 | 79 mm, three `turn` hands | `cg.y − qnh` (cockpit.js:255) | 0.50 kg | YES | QNH is the field elevation, set at the roll-out. |
| VSI `vsi` | :1754 | 79 mm dial | `R.vs`, lag 2.5 s | 0.40 kg | YES | |
| attitude, vacuum `ai` | :1756 | 79 mm + ball drum (`_cage_panel.js:1600`) | `ball` law; no suction → the ball hangs plumb (LAG_HANG) | 1.10 kg; dropped if `vac: none` | YES | |
| attitude, electric `aiE` | :1758 | same | gyro on the bus (cockpit.js:250) | 1.00 kg, 1.0 A load | YES | A dead bus → hangs plumb. |
| directional gyro `dg` | :1760 | dial + rose card (`_cage_panel.js:1590`) | `card` on `hdgDg`; freezes only when `!gyroOk && !aiElec` (cockpit.js:299) | 1.20 kg | PARTLY | **Bug.** On an aiE build (IFR) the vacuum DG never fails, even with the pump stopped. |
| turn coordinator `turn` | :1762 | dial + plane symbol (`_cage_panel.js:1633`) | `r`, but `gaugeAt(..., 'r', 'lin', {sgn,k})` carries no `gauge`/`hand`, so the join bakes no `stops` (`_cage_join.js:2647`) and `interp(undefined)` = 0 | 0.70 kg, 0.3 A | **NO** | **Bug: the symbol never banks.** The slip ball is a static disc; `raw.beta` is computed and drives nothing. |
| tachometer `tacho` | :1764 | 79 mm, engine group | `R.rpmEng` | 0.45 kg | YES | |
| accelerometer `gmeter` | :1766 | 79 mm, three needles | nz / nzMax / nzMin from the solver | 0.45 kg | YES | In no tier; custom only. |
| oil pressure `oilP` | :1768 | 57 mm | synthetic 62 psi × rpm factor (cockpit.js:265) | 0.20 kg | YES (modelled) | Dropped on a battery build unless the fit is custom. |
| oil temperature `oilT` | :1770 | 57 mm | 82 °C running, else held | 0.20 kg | YES (modelled) | Same. |
| fuel quantity `fuel` | :1772 | 57 mm, L or gal | litres / design capacity; 0 on a dead bus | 0.25 kg + 0.30 per tank; 0.1 A | YES | |
| charge gauge (`fuel` on a pack) | :1779 | same face, kWh | pack SoC, not on the bus | 0.20 kg | YES | Swapped in by the resolver (:1912). |
| fuel sight gauge `fuelSight` | :1782 | **nothing** (d 0, no FACE) | no reading | 0.05 kg billed | **NO** | Default of the minimal tier. Billed, never drawn. |
| volt / ammeter `volts` | :1784 | 57 mm, VOLTS 8-16 | `bus.V` | 0.15 kg, 0.02 A | PARTLY | Volts only; `bus.amps` exists, no ammeter hand. |
| 8-day clock `clock` | :1786 | 57 mm, three hands | the day's local time | 0.25 kg | YES | Mechanical; ignores the bus (right). |
| hour meter `hobbs` | :1788 | **nothing** (d 0, no FACE) | only a 0.02 A load | 0.10 kg | **NO** | In the IFR tier. Billed, never drawn or read. |
| magnetic compass `compass` | :1790 | drum on the coaming (`_panel_gen:443`) | `R.hdg` | 0.30 kg | YES | |
| **FIT** | | | | | | |
| fit tier (minimal / basic / ifr / custom) | 60_gen_spec:1864, default :3213; row `_cage_panel.js:231` | through its items | presets items, elec, avionics | the fit's kg/price; ALSO the furnishing mass (`furnK`, :1662) and five GEN_ACCESS fittings by tier NAME (static drain, static port, venturi, OAT probe, beacon: :838-1054) | YES | **Two hidden couplings.** An IFR panel silently adds a full cabin lining (furnishing). The venturi and the pitot-static fittings follow the tier name, not the items or `elec.vac`. |
| units (aviation / metric) | :1883; row :235 | face painting + scales | the join bakes the stops per unit | none | YES | |
| dash side (pilot / centre) | :1884; row :238 | moves the T (`_panel_gen:325`) | no | none | YES (visual) | |
| looks: bezels / switches | `_cage_panel.js:242-248` | yes | no | none | YES (visual) | |
| **ELECTRICS** — `GEN_ELEC`, selects | `60_gen_spec.js:1798-1827`; rows `_cage_panel.js:278-286` | | | | | |
| battery (none / lead / lithium) | :1799-1804 | **not drawn from this row**; the engine mesh's own `battOn` knob (`_eng_mesh.js:139`) is independent | `battAh` → `makeBus`; none = no bus → electric dials and every radio dropped (:1925, :1929) | 7.0 / 2.3 kg low on the firewall; 180 / 520 cr | YES (SoC, volts, starter) | Drawn ≠ billed: a battery box appears or not by an unrelated engine knob. |
| alternator (none / gen20 / alt60) | :1806-1811 | **not from this row** (engine `genOn` knob, `_eng_mesh.js:110`) | `altA` → bus; cut-in **1100 rpm hard-coded for both** (cockpit.js:111) | 4.0 / 4.5 kg on the engine | YES (charges) | Not dropped or flagged when there is no battery. |
| starter (hand-propped / electric) | :1813-1816 | **not from this row** (engine `starter` knob) | `sim.starterOk` = fit.starter && bus.starterOk; 150 A hard-coded (cockpit.js:111) | 4.0 kg, 700 cr | YES | Billed but useless without a battery, and nothing says so. |
| suction (none / venturi / pump) | :1818-1823 | the venturi fitting follows the TIER (GEN_ACCESS :963), not this row; the pump is not drawn | vacOk: pump = engine running, venturi = IAS > 20 hard-coded (cockpit.js:249); `minV` unused | 0.4 / 1.2 kg | YES (feeds ai/dg) | The custom default (venturi) draws no venturi; basic on a metal airframe draws none either. |
| harness (no row) | :1826 | not drawn | not a load | 1.2 kg + 0.15 kg per powered item, when there is a bus | n/a | Lights are not counted as powered items (they are not in `fit.loads`). |
| **COCKPIT SWITCHES** — no spec field; the dash draws them | | | | | | |
| master (Bat.) | drawn when hasBus (`_panel_gen:477`) | lit rocker | `sw_master` → `bus.master`; bindable `master` | n/a | YES | |
| alternator switch (Alt.) | drawn when altA > 0 (:478) | rocker | `sw_alt` → `bus.alt` | n/a | YES | Not bindable. |
| avionics master | drawn when hasBus AND (com or xpdr) (`_panel_gen:479`; `_cage_panel.js:1668`) | rocker, tape "Avionics" | gates **com and xpdr only** (cockpit.js:219) | n/a | PARTLY | NAV and GPS loads ignore it. A NAV- or GPS-only fit gets no avionics master. No key binding. |
| ignition key | always (`_panel_gen:475`) | key | OFF / L / R / BOTH / START → `sim.setEngine`; a pack build gets OFF / ON | n/a | YES | START needs `bus.starterOk`. |
| fuel selector | crew layer, always (`_cage_crew.js:1537`) | `edCtl_fuel` + tape | `sim.ctl.fuel`; OFF stops the engine | inside the plumbing row | PARTLY | L / R / BOTH are cosmetic: the solver has no per-tank feed. |
| **RADIOS / AVIONICS** — `GEN_AVIONICS`, selects | `60_gen_spec.js:1833-1858`; rows `_cage_panel.js:289-297` | | | | | `later` rows are SELECTABLE; the label reads "declared, not drawn yet" (:295). |
| COM (none / compact) | :1834-1838 | 57 mm round face with static painted "122.500 / STBY 121.500" (`_panel_gen:851`) + a blade aerial (GEN_ACCESS commAerial, 2 on twin booms) | 0.5 A load behind the avionics master | 1.0 kg, 1 600 cr | **NO** (a box drawing amps) | No tuning, no frequencies in the world. `ampsTx` 2.0 is unused. The digits stay painted on a dead bus. Owed: PANEL-2026-09-11 session 5b. |
| transponder (none / modeS) | :1839-1843 | 57 mm face, static "1200 ALT" + a belly blade aerial | 0.7 A behind the avionics master | 0.7 kg, 2 300 cr | **NO** | No code, no mode, no reply lamp (session 5b). |
| NAV (none / vor, `later`) | :1844-1848 | **no dash item** (the layout keeps only com/xpdr, `_panel_gen:421`); the wire aerial IS drawn | 0.5 A, **not gated** by the avionics master | 1.6 kg, 2 200 cr | **NO** | The IFR tier's default: billed, aerial drawn, nothing in the cockpit. The world has no VORs (a stage-4 navaid record). |
| GPS (none / portable / panel / glass, all `later`) | :1849-1857 | **nothing**: no face, no aerial, no mount | 0.5 / 1.0 / 2.5 A, **not gated** | 0.7 / 1.5 / 3.5 kg, 900 / 4 500 / 6 500 cr | **NO** | Dropped without a battery (correct). The real navigator (`38_nav.js navMake`) is handed to EVERY autopilot whatever is fitted (`app.js:4644-4651`, `sim_host.js:381-386`), and nothing shows its DTK/XTK/CDI. |
| **LIGHTS** — group `2e · lights` | `tools/_cage_light.js:149-195`, table `LIGHTS` :39-74, defaults :122-147 | | | | | No lamp, light or amp has any mass or price anywhere. |
| lights (master) `lightOn` | :151 | at 0: no lamp, no wing bay cut, no light switches | gates every light load (`CK.lightOn`, cockpit.js:80, 221) | none | YES | A BENCH_STATE row (`bench.js:501`), yet it re-lofts the wing (the bay cuts). |
| draw the switches `lightSw` | :152 | the panel's toggles and knobs (`_cage_panel.js:1387`) | n/a | none | YES | At 0 there is nothing to click; keys and the rail still work. |
| taxi `li_taxi` | :153 | cup + bulb + bracket in the LEFT wing bay (:1580) | 5 A; shares ONE SpotLight with landing in flight (cockpit.js:164) | none | YES | The panel tape reads **"cruise"** (`_cage_panel.js:516`). Amps flow even when no bay was cut. |
| beacon `li_beacon` | :153 | teardrop pod on each fin crown + rotating mirror `liRotor_beacon` (:1042-1076, :1551) | 3 A × 0.5 duty | none | PARTLY | Flight flashes a fixed 0.75 Hz pulse (cockpit.js:320); `li_beaconRpm` is ignored. On a finless or rod-boom build GEN_ACCESS's beacon is drawn instead: plastic, unwired, unswitched, drawn even with lights off. |
| take-off & landing `li_land` | :153 | cup + bulb in the RIGHT wing bay; a garage SpotLight only while level > 0 (:1602) | 8 A; flight spot 4.0 × level | none | YES | The garage light count changes with the level (see the freeze). |
| navigation `li_nav` | :153 | red / green tip pods + white tail lamp (:974, :1118) | 2.5 A | none | YES | |
| cabin flood `li_flood` (inside dimmer) | :155 | proud fitting on the roof / frame / header / coaming / arch (:1298); a garage PointLight only while level > 0 (:1610) | 0.5 A; a constant flight PointLight 0.9 × level, 2.4 m (cockpit.js:175, 339) | none | YES | Taped **"Dash"** on the panel and "cabin" on the rail. Amps flow even when a bubble canopy draws no fitting. **The freeze row** (below). |
| instrument lights `li_instr` | :155 | no lamp: the dial faces' emissive (`_cage_panel.js:694`) | 0.6 A; drives the faces and the needles in flight (cockpit.js:344) | none | YES | |
| pedalier `li_pedal` | :155 | fitting under the dash (:1311); a garage PointLight only while level > 0 (:1619) | 0.3 A; constant flight PointLight 0.35 × level | none | YES | No key binding. |
| passenger `li_pax` | :155 | a fitting per non-pilot seat (:1336), none on an open or bubble canopy | 0.5 A flat, whatever the seat count | none | PARTLY | No key, no rail pill, no night rule. Draws 0.5 A on a single-seater with no lamp. Taped "Cabin". |
| placement rows: `li_plane`, `li_bayFrac/Half/Chord/Depth`, `li_lampSize`, `li_podLen/Girth`, `li_navSpan/Chord/Rise`, `li_beaconSink` | :159-191 | placement and size | n/a | none | n/a | The bay rows re-loft the wing (heavy). `li_plane` reads `CAGE_UI.P`, not `ctx.P`. |
| reflector glows `li_reflect` | :180 | cup glow in the garage | ignored in flight (`app.js:2117` always 1.0) | none | n/a | |
| beacon rotation `li_beaconRpm` | :194 | garage rotor speed | not used in flight | none | n/a | |
| **INTERIOR** — seats, cabin, dash, controls (`_cage_page5.js`) | | | | | | |
| crew layer `crewOn` | page5:603 | the whole crew group | no | the rows still bill when hidden (join:1616) | YES | |
| seat type / "Interior style" `seatType` (tube / shell / airliner) | page5:604; tile `_cage_design.js:888` | `buildSeat` (crew:579), `edSeat<n>` | **NO**: never written to the spec | **none** | drawn only | **Main interior gap.** The billed seat is `spec.outfit.seats` (`GEN_SEATS`, 60_gen_spec:1618), which has NO writer: no row, no join. Every build bills a 3 kg / 120 cr sling, even an airliner seat. |
| seat arrangement `seatLayout` + passenger bays `paxCount/paxLen/paxAbreast` | page5:610, 840-847 | seats, bays | the join derives `cabin.seating` and `cabin.seats` (join:1604) | cabin box, seat count × seat mass, dual-control mass | YES | |
| seat fore/aft `seatZ`, `paxSeatZ` | page5:611, 625 | yes | the join measures `cabin.seatsX` (join:1310) | CG fore-aft | YES | Seat height and recline (`seatH/Rake/Tilt`, `seat2*`) are drawn only; no CG height (DEBT-REGISTER §3). |
| who is aboard `cabOcc`, `paxOcc1-4` | page5:716, 865 | a dummy or a character per seat | join → `cabin.occupied` | 80 kg each at its station | YES | Stature (`dumSize`, `paxSize`) does not change the mass. |
| pilot / co-pilot character, pose rows | page5:709-755 | yes | the cockpit view hides the pilot (cockpit.js:426) | none | YES | |
| baggage `cabin.baggage` (10 kg) | 60_gen_spec:3051 | **not drawn** | ledger cargo | mass | n/a | No editor row; only presets set it. |
| furnishing (lining, floor, trim, headliner, soundproofing, carpet, heater) | `GEN_OUTFIT.furnK` 60_gen_spec:1653-1663 | **nothing drawn** | ledger 61_gen_frame:2683, 2905 | Raymer on W0 × the fit tier: 0 / 0.5 / 1.0 | n/a | **No row of its own**: keyed off `systems.fit`, and the Instruments bill does not show it. |
| interior master `intOn` + shell / pillars / firewall / fire seal / bulkhead | page5:344-373 | `cageInterior` (gen:3371) | **no** | **none** | drawn only | Drawn, not billed. |
| construction `intCons` | page5:345 | yes | join → `fuselage.material` (join:523) | member density, cover mass, price, drag | YES | The one fully wired interior-family row. |
| dashboard `intDash`, setback / lip / depth / crown / crease | page5:368, 525-532 | `dash` + `dashFace` sections | **no** | **none from the cage** | drawn only | The board is billed from `cabin.panel` defaults (60_gen_spec:3092; 61_gen_frame:2634), which nothing writes. A dash-less build still pays for a board. |
| upholstery / interior colours | aeroskin.js:420-464, 956 | paint and finish | no | none | YES (visual) | `garage.js genCabinDataURI` (:450) is orphaned loft-era code. |
| pitch / roll control `ctlStick` (stick / yoke / side stick / none) + placement rows | page5:641-657 | `edCtl_stick/yoke/sideStick` | de + da | `ctlKgM × reach` whatever the type | YES | 'none' still bills the control run. |
| dual controls (implicit) | 61_gen_frame:2667 | a station per side-by-side seat | yes | 3.4 kg when seats > 1 | PARTLY | Billed whenever there is more than one seat, even when one station is drawn. |
| throttle `ctlThr` + placement | page5:658-671 | `edCtl_throttle(2)` | thr / thr0-3; drag sets the axis | no | YES | |
| pedals `ctlPed` + placement | page5:672-681 | `edCtl_pedalL/R` | dr | in the control run | YES | No toe brakes. |
| flap control `flapCtl` (floor lever / dash switch) | page5:682-690 | `edCtl_flap` or a dash switch | flap; click steps a notch | no | YES | |
| trim wheel (position only) | page5:693 | `edCtl_trim` | trim; clickable | no | YES | No on/off row. |
| parking brake knob (no row) | crew:1422 | `edCtl_brake`, only with a dash | `sim.ctl.brake` | no | YES | Disappears with `intDash` off. |
| door levers, jacks, intercom (no row) | crew:1471-1532 | static | not animated | no | n/a | Decorative. |
| centre console `consoleOn`, floor `floorOn/floorLift` | page5:696-701 | `edConsole`, `edFloor` | no | **none** | drawn only | Drawn, not billed. |
| doors (pilot / pax / removed / jamb / sill / door panel) | page5:504-563, 855 | cut, jamb, seal, pleated panel | no | none | drawn only | Doors never open in flight. |
| glazing `glazeOn/glazeMat`, windows, skylight | page5:350-849 | yes | join → `cabin.glazing`, `glazedM2` | glass mass, price, screen drag | YES | |

### What the table says, in short

- **The instruments are the most finished family.** 13 of 17 dials read the sim. The exceptions:
  - the turn coordinator never banks;
  - the DG cannot fail on an aiE build;
  - the hour meter and the fuel sight gauge are billed but never drawn.
- **The electrics run but do not match the 3D.** The battery, alternator, starter and pump are billed and run the bus, but nothing they bill is drawn. The engine mesh's own battery, generator and starter knobs are independent of them. The venturi and the pitot fittings follow the tier name instead.
- **The lights are fully drawn and switched, but weigh nothing and cost nothing.** Their amps are bolted on at bind, outside the fit. They draw current for lamps that were never drawn. On a minimal (no-battery) build they stay dark in flight, and nothing warns about it.
- **The radios are billed boxes.** COM and XPDR are painted faces that draw amps. NAV and GPS are billed and draw amps with nothing in the cockpit, and they are not on the avionics master.
- **The interior is drawn but mostly not billed.** The seat drawn and the seat billed are unrelated. Furnishing is billed from the instrument tier and never drawn. The board is billed from defaults. Liners, floor and console weigh nothing.

## THE FREEZE: "lights → inside dimmer → flood" (belongs to EDITOR-BUGS G2780, noted here)

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

## THE PLAN — G2800-G2809

The block, in order. Sizes are S (half a session), M (one) or L (two).

### (a) The electrics match the 3D

The rule for every row: drawn = billed = wired. It is the join's G121.1 rule, extended to the fit.

- **G2801 THE LIGHTS ON THE LEDGER AND THE BUS [M, cloud].**
  - One core table, `GEN_LIGHTS` in 60_gen_spec, with kg, price and amps per lamp (amps moved from `cockpit.js` LIGHT_AMPS).
  - `genSystemsResolve` takes the lights the join says were DRAWN (lightOn, li_* levels, lamp sites found). Their loads and bill go into `fit.loads` and `bill.elec`, and the harness counts them.
  - No battery → the lights are dropped with a "no battery" line the Instruments bill shows. No load for a lamp that was not drawn. Passenger amps per lamp drawn.
  - The GEN_ACCESS beacon is wired as a lamp or removed.
  - Tape fixes: taxi "cruise" → "taxi"; flood "Dash" vs "cabin" on one word.
  - Gate: PANEL/ELEC extended. Every drawn lamp has a load and a bill line; no load without a lamp.
- **G2802 THE ELECTRICS ROWS DRAW WHAT THEY BILL [M, cloud + A0 stills].**
  - battery, alternator, starter and pump are drawn from `systems.elec`. The engine mesh's `battOn` / `genOn` / `starter` knobs follow the fit (or retire).
  - The venturi follows `elec.vac`, the pitot-static fittings follow the items, not the tier name.
  - Per-row cut-in and starter amps come from GEN_ELEC (no hard-coded 1100 rpm / 150 A).
  - An alternator or starter with no battery is flagged.
  - The avionics master is drawn whenever ANY radio or GPS is fitted and gates nav and gps too; it gets a key binding.
  - Gate: GATE ELEC + PARTS (each elec row → a drawn part, a load, a bill line).
- **G2803 THE DASH'S DEAD ITEMS [S, cloud].**
  - The turn coordinator gets `gauge: 'turn', hand: 'plane'`, so the join bakes stops; a slip ball on `beta`.
  - The DG fails on its own source.
  - The hour meter gets a face; the fuel sight is drawn (cork on a wire) or stops being billed.
  - COM/XPDR digits and every electric face go dark on a dead bus.
  - Gate: GATE PANEL, the hands move on a scripted turn; dead bus → dark.
- **G2804 THE INTERIOR: DRAWN = BILLED [M, cloud].**
  - The join writes `outfit.seats` from `seatType` (tube → sling, shell → basic/standard, airliner → energy; per row if pax seats differ).
  - Furnishing gets its own `outfit.furnish` row (bare / basic / full), no longer keyed off `systems.fit`, shown in the bill.
  - `cabin.panel` from `intDash` / `dashDepth` / the measured dash.
  - The control-run mass follows `ctlStick` / `ctlPed` and the stations drawn.
  - Console, floor and liners billed by measured area.
  - NAMED CHANGES: every stock build's empty mass moves (the sling → the drawn seat, the lining off the IFR tier), so GATE GEN's SHAKEDOWN anchors are re-read, not hand-edited.
  - The headliner, carpet and heater DRAWING (HANDOVER ~17660) stays a later interior chantier outside this block.

### (b) The GPS, on the minimap the HUD already has

**What exists:**
- `drawMap()` (`app.js:9894`) and `drawPlanOnMap()` (:9832) draw the baked island (`WF.minimap`, `minimapBox`), the From/Dest line, the patterns and the pilot's published plan (`ap.intent` legs, active leg, waypoints).
- `38_nav.js navMake` is a full GPS navigator: DTK / TRK / BRG / DIS / XTK / CDI / ETE / GS, direct-to, a plan, sequencing and VNAV.
- `43_pilot.js:670` `ap.instruments()` is "THE ONE READOUT for a panel (the PFD/MFD to come)", including `nav`.
- `PANEL-2026-09-11.md` session 6 already ruled the shape:
  - `drawMap` becomes `drawMapInto(ctx, W, opts)`;
  - the GPS face is its own 512² CanvasTexture at the HUD cadence;
  - the pages are Garmin-LIKE, with no Garmin marks.

**The gap:** nothing in the cockpit shows any of it. The nav is handed to every pilot regardless of the fit. Under the physics worker the nav lives in `sim_host.js` (`world.__simNav`), and `ap.instruments()` is not shipped to the page.

- **G2805 ONE MAP RENDERER [S, cloud].**
  - `drawMap` → `drawMapInto(g, W, opts)`, with opts: frame (north-up box / nose-up range / track-up), layers (underlay, fields, route, plan, patterns, wind, own ship) and a style for a small LCD.
  - The HUD minimap calls it with today's options.
  - Gate: UISMOKE + a node canvas-shim gate that records the draw calls; the HUD map's call list is identical before and after.
- **G2806 THE GPS IN 3D [M, cloud + A0 stills].**
  - `portable` drops `later`: a 5-7 in. tablet on a yoke or coaming RAM mount (crew layer, placed like the dash's compass), its screen a `gps` material bucket the join carries.
  - `panel` drops `later`: a slot in the radio column `_panel_gen` already lays out for COM/XPDR (:420), with a bezel, two knobs and a screen quad.
  - `nav: vor` and `glass` stay `later`. The editor greys `later` rows with "not yet" instead of letting them be billed: a stop-gap until G2808 replaces it with the unlock rule.
  - The avionics master gates it (G2802).
  - Gate: PARTS (gps fitted → a mount, a screen, a load, a bill line; none → none) + PANEL layout.
- **G2807 THE GPS LIVE [M, cloud + A0 stills].**
  - The screen is a 512² CanvasTexture redrawn every HUD tick by `drawMapInto` (nose-up, a range knob 2/5/10/20 km, own ship, fields, the route From/Dest, the pilot's plan) plus a NAV strip from `nav.last`: next waypoint, DIS, DTK, TRK, ETE, GS, and a CDI bar.
  - The worker ships `ap.instruments().nav` in its snapshot (sim_host / sim_link). The page's `flNav` is used as today when there is no worker.
  - Off with the bus or the avionics master (a dark screen, the load gone).
  - Clicks and keys: page (MAP/NAV), range ±, direct-to the nearest field (`nav.directTo`).
  - The navigator stays with the autopilot on every build. A GPS shows it; it does not gate the AP's own planning (the pilot is a person with a chart).
  - Gate: a node gate on the face's draw calls; UISMOKE; A0 stills of the cockpit at day and night.
- **G2808 GPS IS A LATE UNLOCK IN CAREER (TECH-ERA / MACHINE-SHOP) [S, cloud].**
  - No TECH-ERA or MACHINE-SHOP document exists on master yet. This step adds only the hook, and the condition comes from that design when it lands.
  - The hook: an `unlock` key on GEN_AVIONICS rows (`gps.portable`, `gps.panel`, `gps.glass`, `nav.vor`), replacing `later` as the lock reason. `careerUnlocked(career, key)` goes in 74_career. The Instruments select greys a locked row with its reason. The maker options sheet and the used market never offer a locked row.
  - **Sandbox: everything open** (`FLYDIY_MODE !== 'career'`, the GAME §14 rule: the sandbox is today's game byte for byte).
  - Gate: CONTRACTS/CAREER (locked in a new career, open after the unlock, open in the sandbox).
- **G2809 RESERVE, AND THE VERDICT [—, A0 local GPU].**
  - The block's stills (the dash, the GPS on a Cub's yoke and on a 172's panel, day and night).
  - The flood-freeze confirmation if G2780 has not done it.
  - The glass PFD/MFD written as a design note only (`GPS-GLASS-<date>.md`, PANEL session 6's own name): a tier that replaces the six-pack with the ADAHRS as the gyro source.
  - `run_gates.js --all` is A0's, at the train.

### Open questions for the user (asked, not assumed)

1. **The HUD minimap in career mode.** Does it stay for every aeroplane, or does it become the GPS's, shown only when one is fitted? The sandbox keeps it either way. The default if unanswered: it stays (a chart in the pilot's lap), and the GPS adds the moving map in the cockpit.
2. **COM / XPDR tuning (PANEL session 5b)**: in this block, or after the GPS? The default: after. They are billed boxes today, and the GPS is what was asked for.
3. **Furnishing as its own row (G2804)** re-bills every IFR-tier build. Is that change acceptable as a named change at the train?
