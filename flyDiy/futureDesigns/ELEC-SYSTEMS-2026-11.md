# ELEC-SYSTEMS — the electrics, audited and tidied (9 Nov 2026)

The user, 9 Nov: "Now that we're dealing with batteries and electrical systems, maybe we need to tidy this up? Where do
we set that? I think battery type is under controls? Do we even compute the discharge? Do we refuse lamps without
electrics? And electrical instruments? If we need to manage that, we need to manage that well."

## 1. THE AUDIT (what is there today, master @ session start)

### 1.1 Where the player sets the electrics
- Not under Controls. The part tree (`tools/_cage_parts.js:1318`) has **Fit > Instruments** (`panel: 'CAGE_PANEL'`),
  a sibling of Controls (`:1210`). Its column is `tools/_cage_panel.js renderPanel()` (`:239`).
- Inside it, a fold **electrics** (`_cage_panel.js:300-306`) holds four `<select>` drop-downs: battery, charging,
  starter, suction, built from `GEN_ELEC` (`src/core/60_gen_spec.js:2030`). Below them, read-only: the installed parts
  and the breakers (`:308-329`).
- The tier (`fit`: minimal / basic / ifr / custom, `GEN_SYSTEMS` `60_gen_spec.js:2187`) is another drop-down at the top
  of the same column (`_cage_panel.js:249`). Any electrics edit turns the fit 'custom' (`makeCustom`, `:150`).
- Verdict: findable only if you know the electrics hang off the instruments; four drop-downs in the middle of a long
  column, not tiles; no line that says what the system adds up to (capacity, charge rate, endurance on the battery).

### 1.2 Is there a running electrical model in flight? Yes.
- `src/core/31_elec.js makeBus` (whole file): one 12 V bus; battery state of charge (`soc`), open-circuit volts from
  12.7 V full to 11.8 V at 20 % (`vBatt`), discharge by the loads (`step`, `:118-121`), the alternator holding 14.1 V
  above a cut-in rpm with its spare current charging the battery (`:110-116`), the starter a 150 A load that pulls the
  bus down 2.5 V (`:122-123`), `ok` (>= 9 V, instruments alive), `starterOk` (>= 10 V), breakers that trip on overload
  and an avionics bus (G2801).
- Bound in flight by `src/viewer/cockpit.js:83-140` from `genSystemsResolve`; stepped every frame (`:283-307`) with the
  lights' live draws (`:297-301`); the alternator charges only with the engine running (`:303`).
- A flat battery refuses a start: `cockpit.js:139` lends `sim.starterOk`, the solver asks it before it cranks
  (`src/core/30_solver.js:2237-2239`); no starter fitted refuses the key too.
- GATE ELEC (`tools/_elec_check.js`) holds the endurance anchors (16 Ah under ~3.5 A ≈ 3.5 h).
- GAPS: (a) the refusal is SILENT - the key turns, nothing cranks, nothing says why; (b) no low-volts / not-charging
  warning anywhere but the volt/ammeter needle (and only if one is fitted); (c) `altCutIn` 1100 and `starterA` 150 are
  constants in `cockpit.js:128`, not the catalogue's.

### 1.3 Consumers without a battery / generator
- Instruments: `genSystemsResolve` drops an `elec` dial with no battery (`60_gen_spec.js:2264`) and the radios
  (`:2269-2271`), and says why in `dropped`. The column paints a dropped dial red "dead — no battery"
  (`_cage_panel.js:288-292`); the dash draws only `items`; the ledger bills only `rows`; so dial, cockpit, bill and
  price agree. In flight an electric dial reads its rest value when its load is not powered (`cockpit.js:478`).
- Lamps: fitted lights are NOT refused. They stay billed and drawn; in flight they are dark because the bus never comes
  up (`cockpit.js:428` `busOk`). The garage says so with the top-bar warning triangle (`_cage_light.js:155-170`,
  `editor.js:2310`) - but not in the electrics section itself.
- Starter with no battery: billed, weighed, drawn in the bay, can never crank - nothing says so.
- Alternator with no battery: the bus model carries its loads (`31_elec.js:104-107`) but the resolver drops every
  electric dial as "no battery" (`hasBus = battery !== 'none'`, `60_gen_spec.js:2249`). Inconsistent, and unsaid.
- Electric starter on an electric motor build: the pack starts the motor (`cockpit.js:735`); the 12 V starter row is
  still offered and billed.

### 1.4 Masses
- Every light aeroplane on 'basic' carries lead battery 7 kg + 20 A generator 4 kg + starter 4 kg + harness 1.2 kg +
  0.15 kg per powered item: ~17 kg whatever the engine. A Rotax 503 (38 kg dry) carries 15 kg of electrics; a 750 kg
  R-1830 carries the same 15 kg.
- Real anchors (sources at the end):
  - Rotax 503/582 electric start: starter 3.4-4.5 kg; the engine's own lighting coil feeds a rectifier-regulator
    (~0.5-1 kg); a small 12 V battery 1-4 kg.
  - Rotax 912: 12 V 0.6 kW starter and a 250 W (~18 A) integrated generator are INSIDE the 57-61 kg dry weight; the
    external regulator and a 5 Ah LiFePO4 (0.9 kg) are the bill.
  - Continental A-65/O-200 class: Sky-Tec ST2 4.2 kg (9.2 lb); the OEM heavyweight 7+ kg (16 lb); 20-60 A belt
    generator / alternator 4-6 kg; a PC680 7 kg (the existing rows are right for this class).
  - Lycoming O-360 class: starter 4-7 kg; 60-70 A alternator 4.5-6 kg.
  - Big radials (DC-3 class): two 12 V Eclipse starters with brackets 67 lb (15 kg each); engine-driven generators of
    the period ~15-18 kg each (estimate - the R-1830's own figures were not found online).
- Verdict: one fixed set is ~3x too heavy on an ultralight and ~3x too light on a radial.

## 2. THE PLAN (Phase 2)

Hard rule: ADDITIVE. Every existing key, tier and default stays byte-identical; a build with no new key resolves,
weighs, prices and flies as before (proved on every `builds/*.json` through `tools/_load_build.js`).

### 2.1 The catalogue grows CLASS rows (60_gen_spec.js GEN_ELEC)
| row | key | kg | price | figure | for |
|---|---|---|---|---|---|
| battery | `lifeSmall` (new) | 1.0 | 260 | 5 Ah | ultralight, 912 iS class LiFePO4 |
| battery | `leadSmall` (new) | 3.2 | 90 | 9 Ah | ultralight, a sealed powersport battery |
| battery | `lead` / `lithium` | 7.0 / 2.3 | as was | 16 / 13 Ah | light (unchanged) |
| battery | `leadHeavy` (new) | 12.5 | 420 | 35 Ah | heavy, Gill G-35 class (est.) |
| charging | `coil12` (new) | 0.8 | 250 | 12 A | the engine's lighting coil + rectifier-regulator (Rotax 2-strokes) |
| charging | `int18` (new) | 0.9 | 350 | 18 A | the integrated 250 W generator + regulator (Rotax 912) |
| charging | `gen20` / `alt60` | 4.0 / 4.5 | as was | 20 / 60 A | light (unchanged) |
| charging | `genHeavy` (new) | 15.0 | 2600 | 50 A | heavy, engine-driven generator on a radial's pad (est.) |
| starter | `ul` (new) | 3.5 | 650 | 80 A | ultralight (Rotax 582 kit 3.4-4.5 kg) |
| starter | `yes` | 4.0 | as was | 150 A | light (unchanged) |
| starter | `heavy` (new) | 15.0 | 2800 | 300 A | heavy direct-cranking (DC-3's Eclipse 15 kg) |

New optional fields: `cutIn` (prop rpm) on a charging row (absent = 1100, as before; `coil12`/`int18` charge from a
geared engine's low prop rpm), `internal` (the machine is inside the engine: nothing drawn on the case), and the starter
rows' `amps` are now the bus's draw (the 150 the cockpit hard-coded is `yes`'s own value: unchanged).
The harness row stays one row (open question 3).

### 2.2 Classes as STEPS, the engine SUGGESTS (no hidden formula)
`GEN_ELEC_CLASSES` = ultralight / light / heavy, each {battery, alternator, starter}. `genElecClassOf(engine)` names
the suggestion from the registry (electric: none; two-stroke or < 70 kg: ultralight; > 200 kg: heavy; else light). The
suggestion is SHOWN (a "suggested for <engine>" mark on its tile), never applied: the tiers keep their electrics, so the
Cub, the Jodel and the C172 do not move. A class tile writes the three rows at once; the per-component tiles stay.

### 2.3 The column: an ELECTRICS section of tiles (`_cage_panel.js`)
- A summary line: battery Ah, charge A, the build's steady load (instruments + radios + the night lights), and the
  endurance on the battery alone with the charging off.
- A class tile row (Hand-propped / Ultralight / Light / Heavy), the engine's suggestion marked.
- One tile row per component (battery, charging, starter, suction): `.dfTile` buttons, the editor's one tile look.
- THE REFUSALS SAID HERE, red, each with its consequence: dials and radios dropped (named), lights with no power,
  a starter with no battery, a generator with no battery (instruments are refused although the bus model could feed
  them - open question 2), a 12 V starter on an electric motor.

### 2.4 The resolver says it (`genSystemsResolve`)
New field `warnings[]` ({key, why}) - nothing dropped, nothing re-billed (that would move saved builds): `starterNoBatt`,
`altNoBatt`, `starterOnMotor`. `starter` becomes "a starter is fitted" for any non-'none' row; new fields `altCutIn`,
`starterA`, `altInternal`, `elecClass` (the class the fit matches, or null).

### 2.5 In flight: the alarms (`cockpit.js` + `app.js`)
`CK.alarms` each frame: LOW VOLTS (bus up, V < 11.9 and not charging), NOT CHARGING (engine running above cut-in,
alternator fitted and switched on, not carrying the bus), BATTERY FLAT (bus dead with a battery fitted), and a refused
start said for 5 s (no starter: swing the prop / battery flat). A small line in the flight screen shows them; the bus
takes `altCutIn` and `starterA` from the fit.

### 2.6 Gates
GATE ELEC grows: the new rows exist and are sane against their anchors, every class resolves and carries its mass band,
the engine suggestion per registry engine, the tiers' electrics are the ones they were, the warnings fire. GATE TECH:
the new keys get their segments.

## 3. Sources
- Rotax 912 starter 0.6 kW, generator, weight table: [OM-912 p.63](https://www.manualslib.com/manual/1140797/Rotax-Om-912.html?page=63),
  [912 UL technical data](https://www.manualslib.com/manual/1083170/Rotax-912-Ul.html?page=23),
  [the integrated generator's net output](https://rotax-owner.com/en/912-914-technical-questions/10084-what-is-the-net-output-of-rotax-s-internal-generator_1),
  [5 Ah LiFePO4 for the 912 iS, 0.91 kg](https://accu-24.de/Airbatt_1__10_2).
- Rotax 582 electric start 3.4 / 4.5 kg: [ultralightnews.ca spec sheet](https://ultralightnews.ca/rotax582/rotax582specs.htm),
  [Aircraft Spruce weight table](https://www.aircraftspruce.com/cps/catalog/pdf/10.pdf).
- Sky-Tec ST2 9.2 lb, OEM heavyweight 16+ lb: [Aircraft Spruce C12ST2](https://aircraftspruce.com/catalog/eppages/c12st2.php),
  [PilotsHQ](https://pilotshq.com/products/sky-tec-starter-fly-weight-continental-12volt-c12st2),
  [Hartzell Continental starters](https://hartzellaviation.com/manufacturers-brands/sky-tec/continental-aircraft-starters).
- DC-3 starters, two with brackets 67 lb: [Warbird Information Exchange](https://www.warbirdinformationexchange.org/phpBB3/viewtopic.php?p=277426);
  Eclipse inertia starter 33 lb (T-6): [WIX](https://warbirdinformationexchange.org/phpBB3/viewtopic.php?p=569264).
- Not found online, marked ESTIMATE in the rows: the R-1830's own generator mass, the heavy battery.
