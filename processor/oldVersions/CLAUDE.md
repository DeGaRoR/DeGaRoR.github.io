# processThis — Project Context for Claude

## Project Identity
- **processThis v14.4.0** — chemical process simulation game engine
- Single HTML file: `processThis.html` (~42,600 lines)
- Hosted on GitHub Pages (`degaror.github.io`)

## Key Files
- `processThis.html` — the entire codebase (NNG-12: single file, no external JS)
- `processThisBCK.html` — backup copy
- `_runTests.js` — headless Node.js test runner (DOM mock + vm sandbox)
- `PTIS_*.md` — design specs per milestone (S0–S10, S_TERRAFORM, S_SIM, etc.)
- `design/`, `game manifest/`, `oldVersions/` — supporting materials

## Running Tests
```bash
cd processor && node --max-old-space-size=2048 _runTests.js
```
Expected: `475/475 tests passed  2583/2583 checks passed` (as of v14.4.0).
The runner extracts `<script>` blocks dynamically — no updates needed for new code/tests.

## File Structure (line ranges)

| Block | Lines | Role |
|-------|-------|------|
| NNG + changelog | 1–779 | 15 invariants + version history |
| CSS + HTML | 780–7398 | Styling, canvas, panels |
| Script 1 — Engine | 7399–20956 | DOM-free core (NNG-11) |
| Script 2 — UI | 20962–29834 | Canvas, inspector, menus |
| Script 3 — Tests | 29839–42105 | 475 tests, ~2583 assertions |
| Script 4 — Boot | 42110–42576 | DOM wiring, XSS tests |

## Key Classes & Singletons
- `ComponentRegistry` (~7724) — 10 species (H2O, O2, H2, N2, Ar, CH4, He, CO2, CO, NH3)
- `ReactionRegistry` (~8272) — 13 reactions
- `ModelRegistry` / `models` (~9017) — thermo packages, HX models, unit systems
- `ThermoAdapter` / `thermo` (~10381) — flash, enthalpy, Cp; delegates to IdealRaoult or PengRobinson
- `UnitRegistry` (~12906) — 24 unit types with tick functions
- `ProfileRegistry` (~13018) — equipment tiers/variants
- `Scene` / `scene` (~17147) — units Map, connections[], runtime
- `RuntimeContext` (~18238) — per-unit solver scratch
- `solveScene()` (~18714) — main solver loop
- `AlarmSystem` (~20387) — sole alarm producer
- `PG` (~20856) — public API namespace, everything exported here

## Unit Types (24)
source, source_multi, source_air, sink, grid_supply, tank, open_tank, reservoir,
restriction, battery, power_hub, sink_electrical, gas_turbine, valve, pump,
compressor, electric_heater, air_cooler, hex, mixer, splitter, flash_drum,
distillation_column, reactor_equilibrium

## NNG Rules — The 15 Non-Negotiables
Every change must respect ALL of these. Full text is in processThis.html lines 6–298.

**PHYSICS — The Game's Promises:**

- **NNG-1 Conservation.** Mass and energy rigorously conserved. Every non-boundary unit: mass-in = mass-out, energy-in = energy-out. Inventory units (tank, battery) exempt from instantaneous check — imbalance is accumulation. Reactors include heat of reaction via formation enthalpies. Energy residuals > 100 W flagged.

- **NNG-2 Second Law.** Heat flows hot → cold. No reversal without explicit work input. No HEAT stream type — heat transfer only through material streams or electrical streams.

- **NNG-3 WYSIWYG.** Physics = visual state. Unconnected port = zero. Units compute consequences of what they receive, not what they request. Every defId = distinct physical topology. Same logic + different ports → separate defIds. Same topology + different ratings → profiles. Palette shows profiles. Groups are canvas-level only — solver sees through them.

- **NNG-4 Pressure-Flow Network.** Flow computed algebraically from anchor pressures, path resistances, ΔP budgets. No iteration between flow/pressure. All flows ≥ 0, backflow zeroed and alarmed. No silent clamping. Passive devices: insufficient ΔP → straight pipe. Active devices: backward scan traces blocked inlets to origin.

- **NNG-5 Power Lifecycle.** Power is the only demand-driven system. Sequence: capacity (tick) → demand (solver scratch) → actual (≤ capacity) → curtailmentFactor (ud.last). Every consumer has finite rated capacity. Overload ≠ curtailment: overload escalates to CATASTROPHIC, curtailment degrades gracefully.

**SYSTEMS — How Physics Is Executed:**

- **NNG-6 Solver Protocol & Stream Contracts.** Fixed step order: tick → validateStreamFlows → validateMaterialPreFlash → flash → port storage → validateUnitPorts → Steps B/C/D → convergence check. Inter-iteration state: scratch only. STREAM_CONTRACTS is sole schema. Two-phase validation: pre-flash + post-flash.

- **NNG-7 Alarm Architecture.** Frozen schema (id, domain, category, severity, message, unitId?, unitName?, detail?, remediation?). PLANT = player-visible physical events. SIM = engine health. Severity: CATASTROPHIC > WARNING > INFO > OK. AlarmSystem.evaluate() is the sole alarm producer.

**ARCHITECTURE — How Code Is Organized:**

- **NNG-8 SI Internally.** Pa, K, mol/s, W, J/mol, J/(mol·K), kg/m³. User-facing params convert at tick boundary only.

- **NNG-9 Tick Isolation.** Tick = pure computation. Reads only own ports, params, u.inventory. Never reads scene state, other units, DOM, solver internals. Never writes to u.inventory or scratch.

- **NNG-10 Registries, Adapters, Data Integrity.** Static registries (register/get/all/exists). All thermo through ThermoAdapter. Full data at registration time. Reactions mass-balanced, reference registered species only.

- **NNG-11 DOM-free Core.** Script block 1 = zero DOM references. Tests headless. Everything exported on PG.

- **NNG-12 Single File.** All code in one HTML file. No external JS, no build step. Only CDN imports.

**UI — How the Engine Is Presented:**

- **NNG-13 Inspector & Presentation.** Immutable section order: Params → Conditions → Flowrates → Composition → Reaction → Power & Energy → Sizing → KPIs → Detail. Empty sections omitted. Port geometry via getPresentation() only.

**GOVERNANCE — How We Keep It Honest:**

- **NNG-14 Development Discipline.** Every functional change: version bump + changelog (what, why, NNGs, tests). All existing tests pass. New features: min 1 positive + 1 edge-case test. All tests deterministic.

- **NNG-15 XSS Defense.** User-editable strings → esc() before innerHTML. fmt.* and def.* from registries are trusted.

## Workflow Checklist (for every change)
1. Read the relevant section before editing
2. Respect all 15 NNG rules
3. SI units internally, convert at tick boundary (NNG-8)
4. Tick functions are pure (NNG-9), all thermo through ThermoAdapter (NNG-10)
5. Version bump + changelog entry for functional changes (NNG-14)
6. Run `node _runTests.js` — all tests must pass, count must not drop
7. New features: add tests (min 1 positive + 1 edge case)
8. User strings through esc() before innerHTML (NNG-15)
