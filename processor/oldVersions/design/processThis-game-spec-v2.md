# processThis → Game Conversion: Consolidated Architecture Specification

**Version:** 2.0 (consolidated from v1 + addenda 1–4 + audit)
**Source codebase:** processThis.html, 27,784 lines, scene version 15
**Status:** Architecture complete. Ready for implementation planning.

---

# PART I — EXECUTIVE SUMMARY

processThis is a single-file browser-based process simulator with 228 registered unit operations, a rigorous thermodynamic solver, and a governance framework (NNG) of 40+ invariant rules. This specification converts it into a survival-engineering game where the player crash-lands on a planet and must build chemical processes to sustain life — separating oxygen from atmosphere, cracking fuel from CO₂, storing water, managing scarce salvaged equipment.

The conversion adds four systems to the existing codebase:

1. **A mission/campaign layer** that restricts the player to specific salvaged parts (2 pumps, 1 compressor), defines objectives (produce 0.3 mol/s O₂ at 95% purity), and chains missions into a narrative-driven campaign with progressive unlocks.

2. **A simulation/production state machine** where the player designs freely in a virtual sandbox, then commits changes to a live production plant. The production plant keeps running in the background — time-based objectives accumulate, survival demands are tracked, and the player can design the next iteration while the current one runs.

3. **A 3D plant view** (Three.js) that shows the production plant as physical equipment on a factory ground. Initially auto-laid-out from the flowsheet grid, later manually arrangeable. The flowsheet remains the process design tool; 3D is the physical layout tool.

4. **A narrative system** that delivers briefings, dialogue, mid-mission events, and debriefings through a beat-based sequence player with visual, text, dialogue, audio, and choice layers.

The economy is not money — it's **scarcity**. The player has a finite inventory of salvaged parts. Completing missions unlocks more. There is no buy/sell. Products sustain the settlement, not generate revenue. The critical game metric is **runway**: "if nothing changes, how many hours until oxygen runs out?"

The existing codebase is preserved intact. Block 1 (DOM-free engine) gains new registries and evaluators. Block 2 (flowsheet UI) gains mode-awareness and palette restrictions. New Block 3 (3D) and Block 4 (shell/narrative) are additive.

---

# PART II — CONCEPTS AND DECISIONS

This section describes every major architectural decision in plain language. Each subsection is one concept, one paragraph, standing alone.

## The Four Layers

The game has four layers stacked on top of the existing simulator. The **Shell** is the outermost — home screen, mission select, campaign management, save/load. The **Editor** is the process-building workspace, shared across all game modes, containing both the SVG flowsheet and the 3D view. The **Simulation/Production state machine** governs whether the player is experimenting freely or running a committed plant. The **Narrative layer** delivers story through modal overlays that pause gameplay. All four layers read from the same engine (Block 1), which remains DOM-free and testable.

## Simulation vs. Production

The player works in two modes. In **simulation mode**, the flowsheet is fully editable — place units, connect streams, test and tune. Nothing is "real" yet; no resources are consumed, no time passes on the production clock. In **production mode**, the plant is committed and running — time advances, survival demands are tracked, objectives accumulate. The key insight: entering simulation does NOT pause production. The production plant keeps ticking in the background while the player designs the next iteration. This eliminates dead time. When ready, the player commits simulation changes to production — surviving units keep their production-state inventories (tank contents, battery charge), new units appear fresh, deleted units are removed.

## Parts Scarcity (The Economy)

There is no money. The player has a physical inventory of salvaged parts: "3 valves, 2 tanks, 1 compressor." Placing a unit on the flowsheet reduces the available count by one. Deleting it returns the part. Committing to production makes the placement persistent. Completing missions unlocks more parts as rewards. The palette shows each unit type with a count badge ("2×") and greys out when all are placed. Parameter locks can further restrict individual units — a heater limited to 600°C (damaged), a compressor capped at 10 bar (small unit), a reactor fixed to a specific reaction.

## Survival Demands

The settlement needs certain flows to survive: oxygen, water, fuel. These are defined as **demands** — a species, a minimum rate in mol/s, and a criticality flag. The production ledger tracks whether demands are met. The survival score (0–1) reflects how many critical demands are satisfied. The single most important number is **runway**: given current production rates, current tank reserves, and current demand rates, how many hours until a critical resource runs out? This number is always visible in the HUD.

## The Mission Format

A mission is the atomic unit of gameplay — a self-contained challenge defined as a pure JSON object. It specifies: which parts are available (and how many), which parameters are locked, which species and reactions exist, what the starting scene looks like, what the objectives are, what star ratings require, what the briefing/debriefing narratives contain, what other missions must be completed first, and what rewards completing it grants. Missions are registered in a global MissionRegistry and are frozen on registration. Campaigns chain missions into chapters with a persistent production plant and accumulated parts inventory.

## The Three Objective Families

Missions test the player with three types of challenge. **Produce pure component**: deliver a species to a sink at a minimum flow rate and mole-fraction purity, optionally in a specific phase (liquid or vapor), optionally within a time deadline. **Maintain conditions**: keep temperature, pressure, and composition within bounds at a target unit (a habitat, a tank) continuously for a duration — the timer resets if any condition falls out of spec. **Store component**: accumulate a quantity of a species in a tank at a minimum pressure and purity, optionally in a specific phase. These three types, combined with the convergence check, cover all realistic process engineering challenges.

## Dual Coordinates (Flowsheet vs. 3D)

A process flow diagram (PFD) is a logical diagram — equipment arranged for clarity. A real plant is a physical layout — equipment arranged for gravity, access, and safety. These are never the same. Each unit therefore has two independent position fields: `u.x/u.y` (integer grid coordinates for the flowsheet) and `u.pos3d` (floating-point world coordinates for the 3D view). Editing one never affects the other. In Phase 1, 3D positions are auto-derived from the grid. In Phase 2, the player can drag-move equipment in 3D. Adding units and connecting streams remains flowsheet-only — that's process logic, not physical layout.

## Inventory Preservation

The current codebase has a gap: `exportJSON()` does not serialize tank contents or battery charge. These are transient, lost on save/load. The game fixes this — `u.inventory` and clock state are included in export/import. When the player transitions between simulation and production, the production plant's inventories are snapshot-preserved. When committing simulation changes, surviving units keep their production inventories; new units get fresh defaults.

## The Production Ledger

Instantaneous flow rates answer "what is happening now?" but not "do I have enough oxygen?" The production ledger tracks cumulative totals — total moles produced, consumed, sourced — and computes net position and runway. It samples rate history for charts. It snapshots current storage (all tanks and batteries). It is updated only during production ticks, never during simulation. It is serialized in save data.

## The Bible of Thermodynamics

A static in-game reference manual — found in the narrative as a salvaged technical book. It's a flat array of pages with `{ id, category, title, content }`. Content is markdown. The UI is a slide-over panel in the right-panel slot (same space as the inspector). Contextual links from the inspector, palette, and alarm messages open relevant pages. No registry pattern, no auto-generation, no unlock system. Just content and a clean UI slot.

## The Narrative System

Narratives are sequences of **beats**. Each beat is one screen: a visual layer (image, animation, 3D vignette, or nothing), a text layer (markdown, optional typewriter effect), a dialogue layer (speaker portrait + lines that advance on click), an audio layer (music, sound effect, voiceover), and an optional choice layer. The NarrativeManager plays beats sequentially, pauses the game clock, and returns a Promise when the sequence completes. Mid-mission events can trigger narratives based on objective completion, elapsed time, or alarm severity.

## UI Mode Switching

The editor has two independent axes: **mode** (simulation/production) and **view** (flowsheet/3D). A stacked segmented toggle in the info bar shows both. The entire editor signals the active mode ambientally — canvas border color (cyan for simulation, green for production), process name prefix, palette visibility, parameter editability. A production ticker remains visible during simulation, showing the background plant's clock, demand status, and objective progress. Clicking it switches to production view. The commit dialog appears when switching from dirty simulation to production, showing an itemized diff of changes.

---

# PART III — TECHNICAL SPECIFICATION

## 1. Architecture

### 1.1 Block Structure

```
┌─────────────────────────────────────────────────────────────┐
│ Block 1: ENGINE (DOM-free, NNG-A2)                           │
│ Existing: Scene, UnitRegistry (228 units), Solver,           │
│   ThermoAdapter, TimeClock, SimSettings, AlarmSystem,        │
│   ComponentRegistry (9 species), ReactionRegistry (3 rxns),  │
│   ErrorSeverity, STREAM_CONTRACTS                            │
│ New: UnitCostRegistry, ObjectiveEvaluator, EconomyEngine,    │
│   ProductionLedger, InventoryReport, MissionDefinition data  │
└─────────────────────────────┬───────────────────────────────┘
                              │ reads Scene + runtime
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Block 2:         │ │ Block 3:         │ │ Block 4:         │
│ FLOWSHEET VIEW   │ │ 3D VIEW (new)    │ │ SHELL (new)      │
│ (existing SVG)   │ │ Three.js         │ │ Home, missions,  │
│ render()         │ │ Equipment models │ │ campaign, save,  │
│ inspector        │ │ Pipe geometry    │ │ narrative, HUD,  │
│ palette          │ │ Alarm effects    │ │ Bible, mission   │
│ modal dialogs    │ │ Camera controls  │ │ editor           │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

### 1.2 Existing Codebase Key APIs

These are the real interfaces the game code must use. All verified against the source.

**Scene** (line 10580):
- `scene.units` — `Map<string, Unit>` where Unit = `{ id, defId, name, x, y, rot, params, inventory?, sticker? }`
- `scene.connections` — `Array<{ id, from: {unitId, portId}, to: {unitId, portId} }>`
- `scene.tile` — 48 (grid cell size in SVG units)
- `scene.runtime.unitData` — `Map<string, { ports: {}, last: {}, errors: [] }>`
- `scene.runtime.lastSolve` — `{ ok, iterations, warnings, alpha, tearCount, ... }`
- `scene.placeUnit(defId, x, y)` → unit ID string or null
- `scene.deleteUnit(id)` → void
- `scene.moveUnit(id, nx, ny)` → void
- `scene.connect(from, to)` → connection ID or null
- `scene.exportJSON()` → JSON string (version 15, does NOT include inventory — must be extended)
- `scene.importJSON(str)` → `{ ok, error? }` (transactional: all-or-nothing)

**Material stream** (on `ud.ports[portId]`):
```
{ type: StreamType.MATERIAL, T, P, n: {species: mol_s}, phase: 'V'|'L'|'VL',
  vaporFraction, beta, x, y, nV, nL, Hdot_J_s }
```

**Power streams** (HEAT, MECHANICAL, ELECTRICAL):
```
{ type, capacity, actual, demand, curtailmentFactor? }    // all in Watts
```

**TimeClock** (line 3900, singleton):
- `TimeClock.t` — seconds since epoch (43200 = noon Day 1)
- `TimeClock.frame` — tick counter
- `TimeClock.mode` — `'test'|'paused'|'playing'`
- `TimeClock.dt` — seconds per step (from `SimSettings.dt`, default 3600)
- `TimeClock.step(scene)` → `{ t, frame, solveResult }`
- `TimeClock.reset(scene)` → `{ solveResult }`
- `TimeClock._captureInitial(scene)` / `_restoreInitial(scene)` — inventory snapshots

**AlarmSystem** (line 13218):
- `AlarmSystem.evaluate(scene)` → sorted alarm array
- `AlarmSystem.worstSeverity(alarms)` → `AlarmSeverity` object (has `.level` number)
- `AlarmSeverity.CRITICAL.level` = 4

**UnitRegistry** (line 8002):
- `UnitRegistry.get(defId)` → def object
- `UnitRegistry.listByCategory({ excludeCheats })` → `{ categoryName: [def, ...] }`

**ThermoAdapter** (line 5449+):
- `ThermoAdapter.saturationTemperature(comp, P_Pa)` → Kelvin or null

**Registered units** (22 types):
`source`, `source_multi`, `source_air`, `sink`, `sink_electrical`, `sink_heat`, `grid_supply`, `tank`, `battery`, `power_hub`, `gas_turbine`, `generator`, `source_mechanical`, `motor`, `electric_heater`, `valve`, `pump`, `compressor`, `heater`, `cooler`, `hex`, `mixer`, `splitter`, `flash_drum`, `reactor_adiabatic`, `reactor_equilibrium`

**Registered reactions** (3):
`R_H2_COMB` (2H₂+O₂→2H₂O), `R_SABATIER` (CO₂+4H₂→CH₄+2H₂O), `R_STEAM_REFORM` (CH₄+H₂O→CO+3H₂)

**Registered species** (9):
H₂O, O₂, H₂, N₂, Ar, CH₄, He, CO₂, NH₃

**Atmosphere presets**:
`earth_isa`, `mars`, `titan`, `venus`, `planet_x`, `custom`

### 1.3 Structural Refactoring Requirements

These must be addressed before game features can work:

**Global `scene` singleton.** All UI code references a single global `scene`. The game needs two scenes (simulation + production). Every reference must be routed through `EditorSession.activeScene` or equivalent. This is the largest refactoring task.

**`TimeClock` singleton.** Needs two independent clocks. Approach: keep `TimeClock` for simulation (existing behavior), create new `ProductionClock` for production. Both `step(scene)` already takes a scene parameter — good. The singleton state (`t`, `frame`, `mode`) is what must be duplicated.

**`UndoStack` scope.** Currently snapshots the global scene. Must be scoped to `EditorSession.simulationScene`. Disabled in production mode.

**`SimSettings` save/restore.** Missions override `dt` and `atmosphere`. Must snapshot before mission start, restore on exit.

**`models` global.** Thermodynamic package selection is global, shared between scenes. This is acceptable — both scenes use the same physics. Note as a constraint.

---

## 2. State Machine

### 2.1 Mode × View Matrix

```
              VIEW AXIS
              ┌──────────────────┬──────────────┐
              │ Flowsheet (SVG)  │ 3D (Three)   │
 MODE   Sim   │ Edit process     │ Blueprint    │
 AXIS   ──────│ (full editor)    │ ghosts       │
        Prod  │ Read-only PFD    │ Live plant   │
              │ (monitor)        │ (watch)      │
              └──────────────────┴──────────────┘
```

### 2.2 Transitions

```
enterSimulation():
  1. Snapshot production: sceneJSON, clockState, economyState
  2. Deep-clone production → simulationScene (via export+import)
  3. Reset simulation clock to 'test' mode
  4. Switch editor to simulation mode (palette opens, editing enabled)
  5. Production clock KEEPS RUNNING in background

commitToProduction():
  1. Compute diff(productionScene, simulationScene)
  2. Verify parts availability for new units
  3. If unavailable → block, show which parts are missing
  4. Merge: replace production with simulation structure
     - Surviving units: keep production inventory and pos3d, take simulation params
     - New units: fresh initInventory(), pos3d = null (auto-layout)
     - Deleted units: removed, parts returned to inventory
  5. Restore production clock from snapshot (time did NOT advance in sim domain)
  6. Re-solve production scene
  7. Switch to production mode

revertSimulation():
  1. Discard simulationScene
  2. Restore productionScene from snapshot (unchanged)
  3. Switch to production view
  4. No inventory change

pauseProduction() / resumeProduction():
  Toggle ProductionClock.mode between 'paused' and 'playing'
```

### 2.3 The Two Clocks

```javascript
// SimulationClock — the existing TimeClock, used for the simulation scene
// Player controls: Test, Step, Play, Pause, Reset
// Independent of production. Resets freely.

// ProductionClock — new, used for the production scene
const ProductionClock = {
  t: 43200, frame: 0, mode: 'paused',
  dtMultiplier: 1,  // for warp speeds
  
  tick(productionScene, economy, ledger) {
    const dt = SimSettings.dt * this.dtMultiplier;
    // 1. Update inventories
    // 2. Advance time: this.t += dt; this.frame++
    // 3. Solve scene
    // 4. Economy tick (demand evaluation)
    // 5. Ledger tick (cumulative tracking)
    // 6. Objective evaluation
    // 7. Auto-pause on CRITICAL alarm
  }
};

const PRODUCTION_SPEEDS = [
  { label: 'Normal',    interval: 5000, dtMultiplier: 1   },
  { label: 'Fast',      interval: 2000, dtMultiplier: 1   },
  { label: 'Turbo',     interval: 1000, dtMultiplier: 1   },
  { label: 'Warp ×10',  interval: 200,  dtMultiplier: 10  },
  { label: 'Warp ×100', interval: 100,  dtMultiplier: 100 },
];
```

### 2.4 What Each Mode Shows

| Aspect | Simulation | Production |
|---|---|---|
| Flowsheet | Editable, sim scene | Read-only, production scene |
| 3D view | Production plant with blueprint ghosts for changes | Live plant, alarm effects |
| Palette | Open, parts-restricted, count badges | Hidden |
| Inspector | Full edit (subject to paramLocks) | Read-only, lock icon |
| Transport | Test/Step/Play on sim clock | Play/Pause/Warp on production clock |
| Clock shown | Sim clock primary, production ticker secondary | Production clock |

---

## 3. Data Models

### 3.1 Unit Extension

```javascript
unit = {
  id: 'compressor-3',       // existing
  defId: 'compressor',      // existing
  name: 'Compressor 3',     // existing
  x: 8, y: 4,               // existing — flowsheet grid
  rot: 0,                   // existing — 0/1/2/3 (×90°)
  params: { Pout: 300000, eta: 0.80 },  // existing
  sticker: null,             // existing (v10.7.0)
  inventory: null,           // EXISTING but not serialized — must fix
  pos3d: null                // NEW — 3D world position { x, y, z, rotY }
};
```

### 3.2 Scene Serialization Fix (NNG-G8)

`exportJSON()` must be extended:

```javascript
// Per unit — add inventory and pos3d:
if (u.inventory) unitData.inventory = JSON.parse(JSON.stringify(u.inventory));
if (u.pos3d) unitData.pos3d = { ...u.pos3d };

// Top level — add clock state:
data.clock = { t: ProductionClock.t, frame: ProductionClock.frame, mode: ProductionClock.mode };

// Bump version to 16
data.version = 16;
```

`importJSON()` must restore them:

```javascript
// Per unit — after creation:
if (ud.inventory) u.inventory = JSON.parse(JSON.stringify(ud.inventory));
if (ud.pos3d) u.pos3d = { ...ud.pos3d };

// Top level — restore clock if present:
if (data.clock) { /* restore ProductionClock state */ }

// Migration: v15 scenes without inventory — no action needed,
// lazy init on first TimeClock.step() still works (line 3915)
```

### 3.3 MissionDefinition (Canonical Format)

```javascript
const MissionDefinition = {
  // ── Identity ──
  id: 'ch1_m3_sabatier',
  version: 1,
  title: 'The Sabatier Gambit',
  description: 'Convert CO₂ to methane using the Sabatier reaction.',

  // ── Environment ──
  atmosphere: 'planet_x',
  settings: { dt: 3600, cheatsEnabled: false },

  // ── Parts inventory (the core restriction) ──
  // If a defId is not listed, it does not exist in this mission.
  parts: {
    source:              { count: 2 },
    sink:                { count: 3 },
    sink_heat:           { count: 1 },
    mixer:               { count: 2 },
    splitter:            { count: 1 },
    heater:              { count: 1, paramLocks: { T_out: { max: 873.15 } } },
    cooler:              { count: 1 },
    reactor_equilibrium: { count: 1, paramLocks: { reactionId: { fixed: 'R_SABATIER' } } },
    compressor:          { count: 1, paramLocks: { Pout: { max: 1000000 } } },
    flash_drum:          { count: 1 },
    tank:                { count: 2, paramLocks: { volume_m3: { max: 20 } } },
    grid_supply:         { count: 1, paramLocks: { maxPower: { fixed: 30 } } },
    power_hub:           { count: 1 }
  },

  // Units shown greyed with narrative reason
  tease: {
    hex:         'Heat exchangers require fabrication tools (unlocked in Mission 5)',
    gas_turbine: 'No turbine components recovered yet'
  },

  // ── Chemistry ──
  species: ['CO2', 'H2', 'CH4', 'H2O', 'N2', 'O2', 'Ar'],
  reactions: ['R_SABATIER'],

  // ── Starting state ──
  initialScene: null,       // null = blank canvas; JSON string = prebuilt flowsheet
  inheritScene: false,      // true = start from campaign productionScene
  inheritParts: false,      // true = parts add to campaign inventory

  // ── Survival demands ──
  demands: [
    { species: 'O2', minRate_molps: 0.3, label: 'Oxygen', critical: true },
    { species: 'H2O', minRate_molps: 0.2, label: 'Water', critical: true }
  ],

  // ── Objectives ──
  objectives: [
    { id: 'obj_ch4', type: 'produce_pure',
      params: { species: 'CH4', minPurity: 0.90, minFlow_molps: 0.5 },
      label: 'Produce ≥ 0.5 mol/s CH₄ at ≥ 90% purity', primary: true },
    { id: 'obj_converge', type: 'convergence', params: {},
      label: 'Process converges', primary: true },
    { id: 'obj_water_bonus', type: 'store_component',
      params: { species: 'H2O', minMoles: 500, requiredPhase: 'L' },
      label: 'Bonus: store 500 mol liquid water', primary: false }
  ],

  // ── Stars ──
  stars: [
    { count: 1, requires: 'all_primary' },
    { count: 2, requires: { type: 'objective', id: 'obj_water_bonus' } },
    { count: 3, requires: { type: 'parts_remaining', min: 3 } }
  ],

  // ── Narrative ──
  briefing: { beats: [ /* NarrativeBeat[] */ ] },
  debriefing: { success: { beats: [] }, failure: { beats: [] } },
  events: [
    { trigger: { type: 'objective_met', objectiveId: 'obj_ch4' },
      sequence: { beats: [] }, once: true }
  ],

  // ── Hints ──
  hints: [
    { after: { type: 'attempts', count: 2 },
      text: 'The Sabatier reaction is exothermic. You won\'t need external heating.' }
  ],

  // ── Dependencies ──
  requires: [ { type: 'mission', id: 'ch1_m2_water_split' } ],

  // ── Rewards ──
  rewards: {
    unlockedParts: { hex: 2 },
    unlockedMissions: ['ch1_m4_power_grid'],
    unlockedSpecies: [],
    unlockedReactions: []
  }
};
```

### 3.4 CampaignDefinition

```javascript
const CampaignDefinition = {
  id: 'campaign_planet_x',
  title: 'Planetfall',
  description: 'Survive and build on Planet X.',
  atmosphere: 'planet_x',
  
  startingParts: {
    source: 3, source_air: 1, sink: 4, sink_heat: 2,
    valve: 3, mixer: 2, splitter: 1, heater: 1, cooler: 1,
    tank: 2, grid_supply: 1, power_hub: 1, battery: 1
  },
  startingSpecies: ['N2', 'O2', 'Ar', 'CO2', 'H2O'],
  startingReactions: [],
  
  chapters: [
    { title: 'Chapter 1: Survival',
      narrative: { beats: [] },
      missions: ['ch1_m1_air_sep', 'ch1_m2_water_split', 'ch1_m3_sabatier'] },
    { title: 'Chapter 2: Expansion',
      narrative: { beats: [] },
      missions: ['ch2_m1_h2_storage', 'ch2_m2_ammonia'] }
  ]
};
```

### 3.5 CampaignState (Save File)

```javascript
const CampaignState = {
  campaignId: 'campaign_planet_x',
  partsInventory: { source: 3, sink: 4, valve: 3, /* ... */ },
  unlockedSpecies: ['N2', 'O2', 'Ar', 'CO2', 'H2O'],
  unlockedReactions: [],
  completedMissions: {
    'ch1_m1_air_sep': { stars: 3, attempts: 1, timestamp: '...' }
  },
  productionSceneJSON: '...',      // includes inventories (v16+)
  productionClock: { t: 43200, frame: 0, mode: 'paused' },
  productionLedger: { /* ... */ },
  demands: [
    { species: 'O2', minRate_molps: 0.3, label: 'Oxygen', critical: true }
  ]
};
```

### 3.6 EditorSession (Runtime, Transient)

```javascript
const EditorSession = {
  mode: 'sandbox',                  // 'campaign' | 'mission' | 'sandbox'
  missionDef: null,                 // active MissionDefinition or null
  campaignState: null,              // active CampaignState or null
  
  simulationScene: null,            // Scene instance (editable copy)
  productionScene: null,            // Scene instance (committed plant)
  productionSnapshot: null,         // { sceneJSON, clockState, economyState }
  activeView: 'simulation',         // 'simulation' | 'production'
  viewMode: 'flowsheet',            // 'flowsheet' | '3d'
  
  economy: null,                    // { demands, production, demandsMet, survivalScore }
  ledger: null,                     // ProductionLedger instance
  objectiveResults: [],             // [{ objectiveId, passed, progress, detail }]
  objectiveTrackers: {},            // { objectiveId: tracker } for stateful objectives
  
  startedAt: null,
  elapsedRealTime: 0
};
```

---

## 4. Parts Scarcity System

### 4.1 Palette Restriction

`populatePalette()` reads from the mission's `parts` dictionary:
- If `defId` is in `parts` and `count > placedCount` → visible, draggable, shows `"N×"` badge
- If `defId` is in `parts` and `count <= placedCount` → visible, greyed, shows "All N placed"
- If `defId` is in `tease` → visible, greyed, shows narrative reason
- If `defId` is not in `parts` or `tease` → invisible
- Sandbox mode → everything visible, no restrictions

### 4.2 Engine-Level Guard

`Scene.placeUnit()` must be wrapped to enforce parts at the engine level:

```javascript
const _origPlaceUnit = scene.placeUnit.bind(scene);
scene.placeUnit = function(defId, x, y) {
  const session = EditorSession.current;
  if (session?.missionDef) {
    const parts = getEffectiveParts(session.missionDef, session.campaignState);
    const spec = parts[defId];
    if (!spec || countPlacedUnits(this, defId) >= spec.count) return null;
  }
  const id = _origPlaceUnit(defId, x, y);
  // Apply paramLocks to default params
  if (id && session?.missionDef) {
    const unit = this.units.get(id);
    const locks = session.missionDef.parts[unit.defId]?.paramLocks;
    if (locks) applyParamLocks(unit, locks);
  }
  return id;
};
```

### 4.3 Parameter Locks

Three lock types, enforced in both `placeUnit` defaults and inspector rendering:

```javascript
paramLocks: {
  T_out: { max: 873.15 },        // capped — input shows max, value clamped
  Pout: { min: 101325, max: 1e6 }, // range — input shows min/max
  reactionId: { fixed: 'R_SABATIER' }, // fixed — shown as read-only text
  eta: { fixed: 0.72 }           // fixed — not editable
}
```

### 4.4 Campaign Parts Accumulation

```
Campaign start → startingParts → CampaignState.partsInventory
Mission N begins → available = partsInventory - placedInProductionScene
  (mission.parts can add extra via inheritParts)
Mission N completed → rewards.unlockedParts added to partsInventory
  (rewards granted once per mission, not on re-completion for better stars)
Deleting a unit from production → part returns to inventory
```

---

## 5. Objective System

### 5.1 Evaluator Framework

```javascript
const ObjectiveEvaluator = {
  evaluators: new Map(),
  
  register(type, fn) {
    // fn: (scene, economy, params, tracker) → { passed, value?, progress?, detail }
    this.evaluators.set(type, fn);
  },
  
  evaluate(missionDef, scene, economy, trackers) {
    return missionDef.objectives.map(obj => {
      const fn = this.evaluators.get(obj.type);
      if (!fn) return { objectiveId: obj.id, passed: false, detail: 'Unknown type' };
      if (!trackers[obj.id]) trackers[obj.id] = {};
      const result = fn(scene, economy, obj.params, trackers[obj.id]);
      return { objectiveId: obj.id, ...result };
    });
  }
};
```

### 5.2 Built-In Evaluators

**`convergence`** — checks `scene.runtime.lastSolve.ok`

**`produce_pure`** — scans all sinks for a stream where `speciesFlow / totalFlow >= minPurity` and `speciesFlow >= minFlow_molps`. Optional `requiredPhase` checks `stream.phase`. Optional `deadline_s` checks against `ProductionClock.t`.

```javascript
ObjectiveEvaluator.register('produce_pure', (scene, economy, params, tracker) => {
  for (const [uid, u] of scene.units) {
    if (u.defId !== 'sink') continue;
    const stream = scene.runtime.unitData.get(uid)?.ports?.in;
    if (!stream?.n) continue;
    const totalFlow = Object.values(stream.n).reduce((a, b) => a + b, 0);
    if (totalFlow < 1e-12) continue;
    const speciesFlow = stream.n[params.species] || 0;
    const purity = speciesFlow / totalFlow;
    const phaseOk = !params.requiredPhase || stream.phase === params.requiredPhase;
    if (purity >= params.minPurity && speciesFlow >= params.minFlow_molps && phaseOk) {
      if (params.deadline_s) {
        if (!tracker.firstMetTime) tracker.firstMetTime = ProductionClock.t;
        if (tracker.firstMetTime > params.deadline_s)
          return { passed: false, detail: 'Deadline exceeded' };
      }
      return { passed: true, detail: `${(purity*100).toFixed(1)}% at ${speciesFlow.toFixed(2)} mol/s` };
    }
  }
  return { passed: false, detail: 'Target not reached' };
});
```

**`maintain_conditions`** — reads T, P, composition from a target unit (sink port or tank inventory). Checks bounds. Tracks continuous duration; resets on any violation.

```javascript
ObjectiveEvaluator.register('maintain_conditions', (scene, economy, params, tracker) => {
  // Find target by unitId or name
  let reading = null;
  for (const [uid, u] of scene.units) {
    if ((params.targetUnitId && uid === params.targetUnitId) ||
        (params.targetUnitName && u.name === params.targetUnitName)) {
      if (params.port) {
        const stream = scene.runtime.unitData.get(uid)?.ports?.[params.port];
        if (stream) reading = { T: stream.T, P: stream.P, n: stream.n };
      } else if (u.inventory) {
        reading = { T: u.inventory.T_K, P: u.inventory.P_Pa, n: u.inventory.n };
      }
      break;
    }
  }
  if (!reading) return { passed: false, detail: 'Target not found' };

  const violations = [];
  const cond = params.conditions;
  if (cond.T) {
    if (reading.T < cond.T.min) violations.push(`T: ${reading.T.toFixed(1)} K < ${cond.T.min} K`);
    if (reading.T > cond.T.max) violations.push(`T: ${reading.T.toFixed(1)} K > ${cond.T.max} K`);
  }
  if (cond.P) {
    if (reading.P < cond.P.min) violations.push('P too low');
    if (reading.P > cond.P.max) violations.push('P too high');
  }
  if (cond.species && reading.n) {
    const total = Object.values(reading.n).reduce((a, b) => a + b, 0);
    if (total > 1e-12) {
      for (const [sp, bounds] of Object.entries(cond.species)) {
        const frac = (reading.n[sp] || 0) / total;
        if (bounds.minFrac !== undefined && frac < bounds.minFrac)
          violations.push(`${sp}: ${(frac*100).toFixed(1)}% < ${(bounds.minFrac*100).toFixed(0)}%`);
        if (bounds.maxFrac !== undefined && frac > bounds.maxFrac)
          violations.push(`${sp}: ${(frac*100).toFixed(1)}% > ${(bounds.maxFrac*100).toFixed(0)}%`);
      }
    }
  }

  const inSpec = violations.length === 0;
  const dt = SimSettings.dt * (ProductionClock.dtMultiplier || 1);
  if (!tracker.sustainedTime) tracker.sustainedTime = 0;
  tracker.sustainedTime = inSpec ? tracker.sustainedTime + dt : 0;

  return {
    passed: tracker.sustainedTime >= params.duration_s,
    progress: Math.min(1, tracker.sustainedTime / params.duration_s),
    detail: inSpec
      ? `In spec — ${formatTime(tracker.sustainedTime)} / ${formatTime(params.duration_s)}`
      : violations[0]
  };
});
```

**`store_component`** — scans all tanks for inventory matching species quantity, purity, pressure, and phase.

```javascript
ObjectiveEvaluator.register('store_component', (scene, economy, params, tracker) => {
  let best = null;
  for (const [uid, u] of scene.units) {
    if (u.defId !== 'tank' || !u.inventory) continue;
    const inv = u.inventory;
    const total = Object.values(inv.n).reduce((a, b) => a + b, 0);
    const speciesMol = inv.n[params.species] || 0;
    if (speciesMol < 1e-12) continue;
    const purity = speciesMol / total;
    if (params.minPurity && purity < params.minPurity) continue;
    if (params.minPressure_Pa && inv.P_Pa < params.minPressure_Pa) continue;
    if (params.requiredPhase) {
      const T_sat = ThermoAdapter.saturationTemperature(params.species, inv.P_Pa);
      if (T_sat !== null) {
        const isVapor = inv.T_K > T_sat;
        if ((params.requiredPhase === 'V') !== isVapor) continue;
      }
      // If T_sat is null (supercritical/no data), skip phase check
    }
    if (!best || speciesMol > best.moles)
      best = { name: u.name, moles: speciesMol, purity, P: inv.P_Pa };
  }
  const met = best && best.moles >= params.minMoles;
  return {
    passed: met,
    progress: best ? Math.min(1, best.moles / params.minMoles) : 0,
    detail: best
      ? `${best.name}: ${best.moles.toFixed(0)}/${params.minMoles} mol (${(best.purity*100).toFixed(0)}% at ${(best.P/1e5).toFixed(1)} bar)`
      : 'No qualifying tank'
  };
});
```

**`total_produced`** — reads cumulative total from the production ledger.

**`sustained_flow`** — tracks continuous flow above threshold, resets on drop.

**`parts_remaining`** — counts unused parts in inventory.

### 5.3 Complete Objective Type Reference

| Type | Reads from | Key params |
|---|---|---|
| `convergence` | `scene.runtime.lastSolve.ok` | — |
| `produce_pure` | Sink `ports.in.n`, `.phase` | `species, minPurity, minFlow_molps, requiredPhase?, deadline_s?` |
| `maintain_conditions` | Sink port or tank inventory | `targetUnitId/Name, port?, conditions: {T,P,species}, duration_s` |
| `store_component` | Tank `u.inventory` | `species, minMoles, minPressure_Pa?, requiredPhase?, minPurity?` |
| `total_produced` | `ledger.produced[species]` | `species, totalMoles` |
| `sustained_flow` | Sink `ports.in.n` | `species, minFlow_molps, duration_s` |
| `parts_remaining` | Parts inventory count | `min` |

---

## 6. Economy and Survival

### 6.1 No Money

There is no budget, no revenue, no opex in monetary terms. The economy is entirely parts-scarcity (§4) plus survival-demands (§6.2).

### 6.2 Demand Evaluation

```javascript
const EconomyEngine = {
  tick(scene, economy, dt) {
    // 1. Read production from all sinks
    economy.production = {};
    for (const [uid, u] of scene.units) {
      if (u.defId === 'sink') {
        const stream = scene.runtime.unitData.get(uid)?.ports?.in;
        if (stream?.n) {
          for (const [sp, rate] of Object.entries(stream.n))
            economy.production[sp] = (economy.production[sp] || 0) + rate;
        }
      }
    }
    
    // 2. Evaluate demands
    economy.demandsMet = true;
    let criticalMet = 0, criticalTotal = 0;
    for (const demand of economy.demands) {
      const produced = economy.production[demand.species] || 0;
      if (demand.critical) {
        criticalTotal++;
        if (produced >= demand.minRate_molps) criticalMet++;
        else economy.demandsMet = false;
      }
    }
    economy.survivalScore = criticalTotal > 0 ? criticalMet / criticalTotal : 1.0;
  }
};
```

### 6.3 Sandbox Mode

Sandbox sets `economy = null`. No demands, no HUD, no restrictions. Full access to all units, species, reactions. Named save slots, import/export JSON. The existing processThis experience, unchanged.

---

## 7. Production Ledger

### 7.1 Purpose

Tracks cumulative production, consumption, storage, and runway. Updated every production tick, never during simulation. Serialized in save data.

### 7.2 Structure

```javascript
const ProductionLedger = {
  create() {
    return {
      startTime: 0, lastUpdateTime: 0,
      produced: {},    // { species: totalMoles } — delivered to sinks
      consumed: {},    // { species: totalMoles } — consumed by demands
      sourced: {},     // { species: totalMoles } — drawn from sources
      energyGenerated_J: 0, energyConsumed_J: 0,
      netPosition: {},
      currentStorage: { tanks: [], batteries: [], totals: { species: {}, totalMoles: 0, totalEnergy_J: 0 } },
      history: { sampleInterval: 10, maxSamples: 200, ticksSinceLastSample: 0, samples: [] }
    };
  },
  
  tick(ledger, scene, economy, dt) {
    // Accumulate from sources (source, source_multi, source_air → ports.out.n)
    // Accumulate from sinks (sink → ports.in.n)
    // Accumulate energy (sink_electrical, sink_heat → ports.in.actual)
    // NOTE: All three sink types use portId 'in', not 'elec_in' or 'heat_in'
    // Compute net position
    // Snapshot storage via InventoryReport.generate(scene)
    // Sample history ring buffer
  }
};
```

### 7.3 Runway Calculation

```javascript
function calculateRunway(ledger, species, economy) {
  const demand = economy?.demands?.find(d => d.species === species);
  if (!demand) return Infinity;
  const rate = economy.production[species] || 0;
  const stored = ledger.currentStorage.totals.species[species] || 0;
  if (rate >= demand.minRate_molps) return stored / demand.minRate_molps;
  const deficit = demand.minRate_molps - rate;
  return deficit > 0 ? stored / deficit : Infinity;
}
```

### 7.4 Inventory Report

```javascript
const InventoryReport = {
  generate(scene) {
    const tanks = [], batteries = [], totals = { species: {}, totalMoles: 0, totalEnergy_J: 0 };
    for (const [uid, u] of scene.units) {
      if (u.defId === 'tank' && u.inventory) {
        const n_total = Object.values(u.inventory.n).reduce((a, b) => a + b, 0);
        const V = u.params.volume_m3 || 50;
        const n_max = (u.inventory.P_Pa * V) / (8.314 * u.inventory.T_K);
        tanks.push({ unitId: uid, name: u.name, species: { ...u.inventory.n },
          T_K: u.inventory.T_K, P_Pa: u.inventory.P_Pa,
          fillPct: n_max > 0 ? (n_total / n_max) * 100 : 0, totalMoles: n_total });
        for (const [sp, mol] of Object.entries(u.inventory.n))
          totals.species[sp] = (totals.species[sp] || 0) + mol;
        totals.totalMoles += n_total;
      }
      if (u.defId === 'battery' && u.inventory) {
        batteries.push({ unitId: uid, name: u.name,
          charge_J: u.inventory.charge_J, capacity_J: u.inventory.capacity_J,
          socPct: u.inventory.capacity_J > 0 ? (u.inventory.charge_J / u.inventory.capacity_J) * 100 : 0 });
        totals.totalEnergy_J += u.inventory.charge_J;
      }
    }
    return { tanks, batteries, totals };
  }
};
```

---

## 8. 3D View

### 8.1 Dual Coordinates (NNG-G7)

- `u.x, u.y` — integer grid coordinates for SVG flowsheet. Existing.
- `u.pos3d` — `{ x, y, z, rotY }` floating-point world meters for 3D. New, optional.
- Independent. Moving in one view never affects the other.

### 8.2 Auto-Layout (Phase 1)

```javascript
function autoLayoutFromGrid(unit, def) {
  const SCALE = 6;  // 1 grid tile ≈ 6 meters
  return {
    x: unit.x * SCALE + (def.w * SCALE) / 2,
    y: 0,
    z: unit.y * SCALE + (def.h * SCALE) / 2,
    rotY: unit.rot * 90
  };
}
```

When `u.pos3d` is null, the 3D renderer uses `autoLayoutFromGrid()`.

### 8.3 Manual Positioning (Phase 2)

Player can drag-move and rotate equipment in 3D. Sets `u.pos3d` explicitly. Cannot add units, create connections, or delete units in 3D — those are flowsheet operations.

### 8.4 New Units After Commit

New units (in simulation, not in production) have no `pos3d`. After commit, they appear at auto-layout positions with a "NEW" badge. Player arranges them manually.

### 8.5 Blueprint / Ghost Mode

During simulation, the 3D view shows:
- Unchanged production units → solid render
- Modified units → solid with amber highlight badge
- Deleted units → translucent red ghost
- New units → translucent blue wireframe at auto-layout position

---

## 9. Narrative System

### 9.1 Beat Structure

```javascript
const NarrativeBeat = {
  visual: { type: 'image'|'animation'|'video'|'scene3d'|'none', src: 'key' },
  text: { body: 'markdown string', typewriter: false },
  dialogue: { speaker: 'Name', portrait: 'key', lines: ['...', '...'] },
  audio: { music: 'key', sfx: 'key', voiceover: 'key' },
  choices: null | [{ label: 'text', value: 'key' }],
  layout: 'cinematic'|'corner'|'banner',
  duration: null | milliseconds,
  transition: 'fade'|'slide-left'|'cut'
};
```

A narrative sequence is `{ id, beats: NarrativeBeat[], onComplete: 'enter_editor'|'return_to_menu' }`.

### 9.2 NarrativeManager

Plays beat sequences. Returns Promise. Pauses game clock. Stores choice results in `NarrativeManager.state[sequenceId]`. Never mutates Scene, runtime, economy, or inventory (NNG-G9).

### 9.3 Mid-Mission Events

Defined in `MissionDefinition.events`:
```javascript
{ trigger: { type: 'objective_met'|'time_elapsed'|'alarm', ... },
  sequence: { beats: [...] }, once: true }
```

---

## 10. Bible of Thermodynamics

### 10.1 Data

```javascript
const BIBLE_PAGES = [
  { id: 'fundamentals_temperature', category: 'Fundamentals',
    title: 'Temperature & Energy', content: 'markdown...' },
  { id: 'species_water', category: 'Species',
    title: 'Water (H₂O)', content: 'markdown...' },
  // ... flat array, static content
];
```

### 10.2 UI

Slide-over panel in the right-panel slot (replaces inspector while open). 📖 button in info bar. Categories with collapsible entries. Search box. `openBible(pageId)` is a global function. `closeBible()` restores inspector.

### 10.3 Contextual Links

`bibleLink(text, pageId)` creates a clickable span anywhere in the UI — inspector, palette tooltips, alarm messages, narrative text.

---

## 11. UI Layout

### 11.1 Mode/View Switcher

In the info bar, between the menu and process name:

```
┌─────────────┬──────────────┐
│ 🔬 Simulate │  🏭 Produce  │  ← mode (blue/green tint)
└─────────────┴──────────────┘
┌─────────────┬──────────────┐
│ ◻ Flowsheet │  ◼ 3D View   │  ← view
└─────────────┴──────────────┘
```

### 11.2 Ambient Mode Signals

- Canvas border: cyan (sim) / green (prod)
- Action bar border tint matches mode
- Process name shows mode prefix
- Palette hidden in production, + button disabled

### 11.3 Production Ticker (During Simulation)

Anchored below info bar. Shows production clock, speed, demand status, objective progress. Clicks through to production view. Flashes red on alarm. Hidden in production mode and sandbox.

```
🏭 Day 14, 18H  ▶ ×10  │  O₂ ✓  H₂O ✓  CH₄ ✗  │  ◐ 63%
```

### 11.4 Resource HUD

Above the action bar. Per-demand: rate/need, status, runway.

```
🫁 O₂ 0.42/0.30 ✓ 14h │ 💧 H₂O 0.28/0.50 ✗ 8h │ ⛽ CH₄ 0.15/0.10 ✓ 22h
```

Clicking any entry opens the Resource Dashboard modal with charts and detailed accounting.

### 11.5 Action Bar Adaptation

| Control | Simulation | Production |
|---|---|---|
| Test (⟳) | Solve sim scene once | Disabled |
| Step (▶\|) | Step sim clock | Step production clock |
| Play (▶) | Play sim clock | Play production clock |
| Pause (⏸) | Pause sim clock | Pause production clock |
| Reset (↺) | Reset sim clock | Disabled |
| Warp (⏩×10, ×100) | Not available | Available |

### 11.6 Commit Dialog

Shown when switching from dirty simulation to production:
- Itemized diff: new units, deleted units, modified units, connection changes
- Parts used / returned / net
- Three buttons: Commit, Revert, Cancel

---

## 12. Registries and Dependencies

### 12.1 MissionRegistry / CampaignRegistry

```javascript
MissionRegistry.register(missionDef)    // freezes on registration
MissionRegistry.get(id)
MissionRegistry.isUnlocked(id, completedMissions)

CampaignRegistry.register(campaignDef)
CampaignRegistry.get(id)
CampaignRegistry.isComplete(id, completedMissions)
```

### 12.2 Dependency Types

```javascript
{ type: 'mission', id: '...' }           // mission completed (any stars)
{ type: 'mission_stars', id: '...', minStars: 2 }
{ type: 'campaign', id: '...' }          // all missions in campaign completed
```

### 12.3 Mission Editor

In-game form that produces MissionDefinition JSON. Sections: metadata, parts allocation (count spinners + param lock editors), chemistry (species/reaction checkboxes), starting state (capture current flowsheet), objectives (type dropdowns + param fields), stars, dependencies, rewards, basic narrative text. Test button loads mission in throwaway session. Export/import JSON.

---

## 13. NNG Amendments

All existing NNG rules (40+) remain. These are added:

```
NNG-G1   Dual-scene integrity. Commit merges simulation structure into
         production while PRESERVING production inventories and pos3d
         for surviving units. Revert discards simulation entirely.

NNG-G7   Dual coordinate independence. u.x/u.y (flowsheet) and u.pos3d
         (3D world) are independent. Editing one never affects the other.

NNG-G8   Inventory serialization. u.inventory MUST be in exportJSON and
         restored by importJSON. Clock state included. Version bumped.

NNG-G9   Narrative purity. Narratives never mutate Scene, runtime,
         economy, or inventory. Choices stored in NarrativeManager.state.

NNG-G10  Economy pluggability. Demand types and labels are data-driven,
         defined per mission/campaign. No demand type hardcoded.

NNG-G11  Parts scarcity. Palette and placeUnit() enforce parts counts.
         Available = parts[defId].count - countPlacedInScene(defId).

NNG-G12  Parameter locks. Fixed values read-only. Min/max applied on top
         of normal validation. Solver never sees locked-out values.

NNG-G13  Production continuity. Entering simulation does NOT pause
         production. Only explicit action stops the production clock.

NNG-G14  Mission purity. MissionDefinition and CampaignDefinition frozen
         on registration. Runtime state in EditorSession, not definitions.

NNG-G15  Reward integrity. Rewards applied once on first completion with
         all primary objectives met. Re-completion doesn't re-grant.

NNG-G16  Mode/view disambiguation. UI must unambiguously show current
         mode and view at all times via ambient cues.

NNG-G17  Ledger integrity. Cumulative totals never decrease. Only updated
         during production ticks. Serialized in save data.

NNG-G18  Runway purity. Runway = f(current rates, storage, demands).
         No prediction, no smoothing, no hidden state.
```

---

# PART IV — PROJECT PLAN

## Phase 0: Foundation (Refactoring)
**Goal:** Make the existing codebase dual-scene-ready without changing behavior.

- [ ] **0.1** Extract global `scene` into `EditorSession.activeScene`. Route all UI reads/writes through it. Test: existing functionality unchanged.
- [ ] **0.2** Create `ProductionClock` alongside `TimeClock`. Both take `scene` parameter. Test: TimeClock behavior unchanged.
- [ ] **0.3** Scope `UndoStack` to active scene reference. Disable in production mode.
- [ ] **0.4** Add `SimSettings` save/restore for mission context switching.
- [ ] **0.5** Extend `exportJSON()` / `importJSON()` with `inventory`, `pos3d`, `clock`. Bump version to 16. Add v15→v16 migration. Test: round-trip with inventory-bearing units.
- [ ] **0.6** Add guard wrapper on `placeUnit()` for parts enforcement (no-op in sandbox).

**Exit criteria:** All existing tests pass. Export→import round-trip preserves tank contents and battery charge.

## Phase 1: Mission Engine
**Goal:** Missions work. Player can complete a challenge with restricted parts.

- [ ] **1.1** Implement `MissionDefinition` schema, `MissionRegistry.register()` and `.get()`.
- [ ] **1.2** Implement `EditorSession.start({ mode, missionDef })` — configures SimSettings, loads parts.
- [ ] **1.3** Implement palette restriction from `parts` dict: count badges, greying, tease reasons.
- [ ] **1.4** Implement `paramLocks` in inspector: fixed display, range clamping.
- [ ] **1.5** Implement `ObjectiveEvaluator` with `convergence`, `produce_pure`, `maintain_conditions`, `store_component`.
- [ ] **1.6** Implement objective HUD (✓/◐/○ indicators) on the editor.
- [ ] **1.7** Implement basic mission flow: briefing (text-only), editor, objective check, debriefing (text-only), star rating.
- [ ] **1.8** Build 3 tutorial missions (air separation, water splitting [requires new R_WATER_SPLIT reaction], Sabatier loop).

**Exit criteria:** Player can select a mission, build a process with restricted parts, see objectives pass/fail, earn stars.

## Phase 2: Simulation/Production State Machine
**Goal:** Commit/revert works. Production runs independently.

- [ ] **2.1** Implement `enterSimulation()` — deep-clone, snapshot, switch mode.
- [ ] **2.2** Implement `commitToProduction()` — diff, parts check, merge with inventory preservation.
- [ ] **2.3** Implement `revertSimulation()` — discard and restore.
- [ ] **2.4** Implement `ProductionClock.tick()` with warp speeds.
- [ ] **2.5** Wire production clock to run in background during simulation mode.
- [ ] **2.6** Implement production ticker UI (visible during simulation).
- [ ] **2.7** Implement commit dialog with itemized diff.
- [ ] **2.8** Implement mode/view switcher widget and ambient mode signals.
- [ ] **2.9** Implement time-based objectives (`sustained_flow`, `total_produced`).

**Exit criteria:** Player can design in simulation, commit to production, watch objectives accumulate during warp, re-enter simulation to iterate.

## Phase 3: Economy and Survival
**Goal:** Survival demands tracked. Runway visible. Production ledger works.

- [ ] **3.1** Implement `EconomyEngine.tick()` with demand evaluation.
- [ ] **3.2** Implement `ProductionLedger` — cumulative tracking, history sampling.
- [ ] **3.3** Implement `InventoryReport` — tank/battery summary.
- [ ] **3.4** Implement Resource HUD (rate/need/status/runway per demand).
- [ ] **3.5** Implement Resource Dashboard modal (detailed accounting, charts).
- [ ] **3.6** Implement runway calculation.
- [ ] **3.7** Wire demands from MissionDefinition and CampaignState.

**Exit criteria:** Player sees "O₂ ✓ 14h" in HUD. Resource Dashboard shows cumulative totals and rate charts. Runway updates live.

## Phase 4: Campaign and Progression
**Goal:** Multi-mission campaign with persistent state.

- [ ] **4.1** Implement `CampaignDefinition`, `CampaignRegistry`, `CampaignState`.
- [ ] **4.2** Implement campaign parts accumulation (starting → rewards → inventory).
- [ ] **4.3** Implement `getEffectiveParts()` for campaign missions with `inheritParts`.
- [ ] **4.4** Implement scene inheritance (`inheritScene: true`).
- [ ] **4.5** Implement dependency checking (`MissionRegistry.isUnlocked()`).
- [ ] **4.6** Implement save/load for CampaignState (localStorage or IndexedDB).
- [ ] **4.7** Implement mission select screen with lock/star display.
- [ ] **4.8** Build Chapter 1 campaign: 4–5 missions with progressive unlocks.

**Exit criteria:** Player can play through a chapter, carry production plant and parts between missions, see unlocks.

## Phase 5: Shell and Navigation
**Goal:** Home screen, mode selection, settings.

- [ ] **5.1** Implement home screen (Campaign / Missions / Sandbox / Options).
- [ ] **5.2** Implement sandbox save slots (named, with import/export).
- [ ] **5.3** Implement settings screen (atmosphere, dt, play speed, graphics toggles).
- [ ] **5.4** Implement mission editor (form → MissionDefinition JSON).

**Exit criteria:** Player can launch the game, choose a mode, and navigate back.

## Phase 6: Narrative
**Goal:** Rich narrative sequences with beats, dialogue, choices.

- [ ] **6.1** Implement NarrativeManager with beat player (visual/text/dialogue layers).
- [ ] **6.2** Implement beat transitions (fade, slide) and layout modes (cinematic, corner, banner).
- [ ] **6.3** Implement mid-mission event triggers.
- [ ] **6.4** Implement choice storage in NarrativeManager.state.
- [ ] **6.5** Author narrative content for Chapter 1 missions.
- [ ] **6.6** Implement Bible UI (slide-over panel, search, contextual links).

**Exit criteria:** Briefings play as multi-beat sequences with dialogue. Mid-mission events fire. Bible opens from inspector links.

## Phase 7: 3D View (Phase 1 — Observation)
**Goal:** See the production plant in 3D.

- [ ] **7.1** Set up Three.js canvas, camera (OrbitControls), lighting.
- [ ] **7.2** Implement `Equipment3DRegistry` — procedural geometry per defId.
- [ ] **7.3** Implement auto-layout from grid (§8.2).
- [ ] **7.4** Implement connection rendering as pipe/wire geometry.
- [ ] **7.5** Implement raycasting for unit selection → inspector.
- [ ] **7.6** Implement alarm-driven visual effects (red glow, particles).
- [ ] **7.7** Implement blueprint/ghost mode for simulation view.
- [ ] **7.8** Wire view toggle (flowsheet ↔ 3D).

**Exit criteria:** Player can switch to 3D, orbit the plant, click equipment to inspect, see alarm effects.

## Phase 8: 3D View (Phase 2 — Layout Editing)
**Goal:** Move equipment in 3D.

- [ ] **8.1** Store `u.pos3d` on drag-end.
- [ ] **8.2** Implement snap grid and rotation controls.
- [ ] **8.3** Preserve pos3d across commit (surviving units keep positions).
- [ ] **8.4** New units appear with "NEW" badge at auto-layout positions.
- [ ] **8.5** Serialize pos3d in export/import.

**Exit criteria:** Player can manually arrange equipment in 3D. Layout persists across save/load and commit.

## Phase 9: Polish and Content
**Goal:** Ship-quality experience.

- [ ] **9.1** Audio placeholder system (music, SFX, voiceover keys).
- [ ] **9.2** Tutorial sequence (first-time player guidance).
- [ ] **9.3** Chapter 2 campaign content (5+ missions).
- [ ] **9.4** Standalone challenge missions (3+).
- [ ] **9.5** Bible content authoring (20+ pages).
- [ ] **9.6** Register `R_WATER_SPLIT` reaction in ReactionRegistry.
- [ ] **9.7** Performance testing with large scenes.
- [ ] **9.8** Mobile/touch input support.

---

*End of consolidated specification.*
