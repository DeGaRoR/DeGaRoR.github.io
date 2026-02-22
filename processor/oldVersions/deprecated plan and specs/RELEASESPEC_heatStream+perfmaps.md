# Equipment Limits, Performance Maps & Alarm Architecture
## Comprehensive Design v5 — v11.3.0 (FINAL)

---

# PART A — DESIGN DECISIONS

## A1. Scope

Six interlocking workstreams designed holistically:

1. **Heat stream deletion** (Phase 0, prerequisite)
   → See `heat_stream_deletion.md`
2. **Equipment limits & sizing** with alarm integration
3. **Performance maps** (curve maps + field maps)
4. **Alarm architecture** (three-layer pipeline)
5. **Visualization infrastructure** (shared canvas rendering)
6. **Supporting registrations** (Haber reaction, default params)

All share data models, rendering, alarm pathways, and will be
constrained by the future mission system.

---

## A2. NNG Updates

### NNG-3 — Extended with Physical-Equipment Rule

```
NNG-3   WYSIWYG.
        Physics = visual state.  Unconnected port carries zero —
        no flow, no heat, no power.  Every unit computes
        consequences of what it receives, not what it requests.
        If a wire doesn't exist on canvas, it doesn't exist in
        the solver.  No implicit connections, no phantom sources.

        Physical-equipment rule: every unit in the palette
        corresponds to a nameable, purchasable piece of physical
        equipment — not an abstract transfer concept.  If you
        cannot point at it in a pilot plant and say "that one",
        it should not be a unit.  Corollary: stream types model
        physical flows (material in pipes, electrons in cables).
        Heat is not a fluid; there is no heat stream type.
```

### NNG-16 — Extended with Three-Layer Pipeline

```
NNG-16  Alarm architecture.
        Three-layer pipeline: sources → rationalization →
        presentation.

        Sources: pluggable pure functions registered via
        AlarmSystem.register(). Each: (scene) → Alarm[].
        Sources produce, renderers consume — never crossed.
        No other code path creates alarm objects. Zero DOM.

        Rationalization: AlarmSystem._rationalize() is the sole
        transform between raw and presented alarms. Dedup by id
        (keep highest severity). Future: cascade suppression,
        aggregation, shelving, dead-banding. No rationalization
        logic in sources or presentation.

        Presentation: consumes rationalized alarms only. Never
        filters, transforms, or creates alarms.

        Schema: frozen { id, category, severity, message,
        detail?, remediation?, unitId?, paramName?, paramValue?,
        limitTag?, limitValue?, source? }.
        Severity: CRITICAL > ERROR > WARNING > INFO > OK.

        Equipment limits: data-driven via UnitRegistry.limits
        and limitParams. evaluateLimits() is a pure function;
        output feeds through a registered source, never directly
        into tick functions.
```

---

## A3. Parameters Architecture (Philosophy for Future Work)

### A3.1 Overview

Every unit has a `params` object that holds its operational
configuration. This document defines the architecture for how
parameters interact with limits, missions, and the UI.

### A3.2 Parameter Categories

```
unit.params = {
  // ── Operational settings (player-set, inspector-editable) ──
  T_out: 423.15,          // heater setpoint
  Pout: 500000,           // compressor discharge
  eta: 0.75,              // efficiency
  reactionId: 'R_HABER',  // reaction selection
  mode: 'insulated',      // reactor thermal mode

  // ── Equipment identity (set once at placement) ──
  size: 'S',              // S/M/L equipment size

  // ── Constraint layer (set by mission or player) ──
  limitOverrides: null,   // player alarm setpoint adjustments
  paramLocks: null,       // locked parameters (mission or mode)
}
```

### A3.3 Limit Resolution — Three Layers

When evaluating whether a parameter violates a limit:

```
Layer 1: def.limits[size]           ← Equipment base (UnitRegistry)
         Manufacturer hard stops. Cannot be relaxed.

Layer 2: mission.constraints        ← Mission tightening (future)
         The mission may TIGHTEN limits (smaller P_HH) but
         never RELAX them beyond equipment rating.

Layer 3: unit.params.limitOverrides ← Player tuning (future)
         Player adjusts L/H warning bands. Cannot move
         beyond LL/HH design limits.
```

Implemented via `getEffectiveLimits(def, unit, mission?)`:

```js
function getEffectiveLimits(def, unit, mission) {
  const size = unit.params?.size || 'S';
  const base = def.limits?.[size];
  if (!base) return null;

  // Today: return base directly
  // Future: deep-merge mission tightening, then player overrides
  // Rules: mission can only tighten (move limits inward)
  //        player can only adjust L/H within LL/HH envelope
  return base;
}
```

### A3.4 Parameter Locks

Some parameters should be read-only in certain contexts:

```js
// Mission locks: reactor must stay insulated in M3
mission.constraints.paramLocks = {
  reactor_equilibrium: { mode: 'insulated' }
};

// Equipment locks: S-size has fixed efficiency
// (no player-adjustable eta on this model)
def.paramLocks = { eta: true };
```

The inspector checks `paramLocks` before rendering an editable
control. If locked: show value as read-only text with lock icon.
Source of lock shown on hover ("Locked by mission" or "Fixed by
equipment design").

### A3.5 Equipment Inventory Constraints (Future)

Missions constrain what the player can place:

```js
mission.constraints = {
  // Which unit types appear in the palette
  palette: ['source', 'air_cooler', 'flash_drum', 'tank'],

  // Max count per unit type (null = unlimited)
  inventory: { compressor: 2, air_cooler: 3, valve: 4 },

  // Limit tightening per unit type
  limitOverrides: {
    compressor: { P: { HH: 500000 } },  // "5 bar max for M4"
  },

  // Parameter locks per unit type
  paramLocks: {
    reactor_equilibrium: { mode: 'insulated' },
  },
}
```

`palette` filters the toolbar — units not listed don't appear.
`inventory` caps placement — addUnit checks count against cap,
toolbar button greys out at limit. These are UI-only constraints;
the solver doesn't care.

### A3.6 How It All Connects

```
Mission defines  ──→  palette (what's available)
                 ──→  inventory (how many of each)
                 ──→  limitOverrides (tighter equipment limits)
                 ──→  paramLocks (frozen settings)

UnitRegistry defines ──→  limits[size] (equipment base)
                     ──→  limitParams (what's limitable + metadata)
                     ──→  def.paramLocks (equipment-inherent locks)

evaluateLimits() reads ──→  getEffectiveLimits() (merged layers)

Performance maps read  ──→  getEffectiveLimits() (for overlays)

Inspector reads  ──→  paramLocks (for editable vs read-only)
                 ──→  getEffectiveLimits() (for limit bars)
                 ──→  inventory (for placement count)

Alarm system reads ──→  evaluateLimits() output (violations)
```

All paths converge on the same data model. No parallel systems.
Adding missions later is a data exercise, not a restructuring.

### A3.7 Implementation Now vs Later

| Component | v11.3.0 | Future |
|-----------|---------|--------|
| `def.limits[size]` | ✅ Full data for S | M/L data |
| `limitParams` templates | ✅ Shared dictionary | — |
| `getEffectiveLimits()` | ✅ Returns base | Merge 3 layers |
| `evaluateLimits()` | ✅ Full evaluation | — |
| `limitOverrides` in params | Reserved field | Player editor |
| `paramLocks` in params | Reserved field | Mission system |
| `mission.constraints` | Not implemented | Mission system |
| `palette` / `inventory` | Not implemented | Mission system |
| Inspector lock icons | Not implemented | Mission system |
| Limit bars in inspector | Near-term (v11.4) | — |

The 5 lines of `getEffectiveLimits()` indirection is the only
code cost now. Everything else is schema reservation.

---

## A4. Performance Maps

### D1: Curve Maps vs Field Maps

Both render on a 2D canvas. Shared trunk with two leaf renderers.

**Curve maps** (1 independent var → lines on Y):

| Use case | X | Y | Status |
|----------|---|---|--------|
| Species VP envelope | T | Psat | v11.3.0 |
| Pump cavitation | T | Bubble P | v11.3.0 |
| Compressor condensation | T | Dew P | v11.3.0 |
| Valve Cv | Opening % | Cv | Future |
| Pump P-Q | Q | Head | Future |

**Field maps** (2 independent vars → color):

| Use case | X | Y | Color | Status |
|----------|---|---|-------|--------|
| Reactor (isothermal) | T | P | Conv % | v11.3.0 |
| Reactor (adiabatic) | T | P | Conv % | v11.3.0 |
| Efficiency maps | T | P | η % | Future |

### D2: Standard Axes

Default T(x) vs P(y) via `PM_AXES_TP`. Renderer axis-agnostic.

### D3: Dynamic Phase Maps

Pump: P_bubble(T) = Σ xᵢ·Psat_i(T). Compressor: P_dew(T).
Computed from actual inlet composition (<0.1 ms).
Default curves (water/air) before first solve.

### D4: No General Visualization Framework Yet

Performance maps are static reference data on fixed axes.
Future charts (bar, pie, time series) have different interaction
patterns. Build perf maps now; evaluate chart infrastructure when
actually needed. Canvas lifecycle, HiDPI, and color utilities
carry forward regardless.

---

## A5. Equipment Limits

### D5: Generic Named Parameters

Not hardcoded fields. Any named parameter: T, P, mass, phase,
level_pct, compression_ratio, etc.

### D6: Limit Parameter Metadata

Shared templates — each unit just lists which params apply:

```js
const LIMIT_PARAM_TEMPLATES = {
  T:     { label: 'Temperature', unit: 'K', display: '°C',
           fromSI: v => v - 273.15, toSI: v => v + 273.15 },
  P:     { label: 'Pressure', unit: 'Pa', display: 'bar',
           fromSI: v => v / 1e5, toSI: v => v * 1e5 },
  mass:  { label: 'Mass flow', unit: 'kg/s' },
  phase: { label: 'Phase', type: 'enum', values: ['V','L','VL'] },
  level_pct: { label: 'Fill level', unit: '%' },
};

// Per unit definition:
limitParams: ['T', 'P', 'mass', 'phase'],
```

### D7: S/M/L Sizing

`unit.params.size = 'S'` always. M/L null. Selector hidden
when only one size. Full 10-mission trunk on S size.

### D8: LL/L/H/HH → Two Severities

L/H → WARNING. LL/HH → CRITICAL. Phase → CRITICAL.

### D9: Compressor — Diaphragm for All Missions

One type: diaphragm. P_HH=150 bar, mass_HH=0.05 kg/s.
Supports all 10 missions. Trade-off: high P, modest flow.

### D10: Air Cooler — 2nd Law Enforced

T_out ≥ T_ambient + T_approach. Hard floor from physics.
Below-ambient requires real refrigeration cycle.

### D11: Reactor Heated Mode — Electrical Jacket

elec_in replaces heat_in. Jacket adds heat regardless of
reaction direction. Exothermic + Q_in → hotter output. WYSIWYG.

### Full limits database: see `equipment_limits_S_v2.md`

---

## A6. Alarm Architecture — Three Layers

```
Layer 1: SOURCES
  Existing: convergence, mass, energy, pressure, connectivity,
            per-unit error relay
  New:      equipment limit violations

Layer 2: RATIONALIZATION (skeleton now, extensions future)
  Now:    dedup by alarm id (keep highest severity)
  Future: cascade suppression, aggregation, shelving, dead-band

Layer 3: PRESENTATION
  Existing: traffic lights, diagnostic modal, inspector glow
  New:      limit bars in inspector (near-term)
  Future:   alarm panel, alarm history, alarm editor
```

---

# PART B — TECHNICAL SPECIFICATION

## B1. evaluateLimits()

Pure function. No DOM, no side effects.

```js
function evaluateLimits(def, unit, unitData, mission) {
  const violations = [];
  const limits = getEffectiveLimits(def, unit, mission);
  if (!limits) return violations;

  for (const [param, spec] of Object.entries(limits)) {
    const actual = getLimitParam(param, def, unit, unitData);
    if (actual == null) continue;

    if (spec.required !== undefined) {
      if (actual !== spec.required) {
        violations.push({
          param, tag: 'PHASE', severity: 'CRITICAL',
          actual, limit: spec.required
        });
      }
      continue;
    }

    if (!isFiniteNum(actual)) continue;
    const r = v => typeof v === 'function' ? v(actual) : v;

    if (spec.LL != null && actual < r(spec.LL))
      violations.push({ param, tag:'LL', severity:'CRITICAL',
        actual, limit: r(spec.LL) });
    else if (spec.L != null && actual < r(spec.L))
      violations.push({ param, tag:'L', severity:'WARNING',
        actual, limit: r(spec.L) });

    if (spec.HH != null && actual > r(spec.HH))
      violations.push({ param, tag:'HH', severity:'CRITICAL',
        actual, limit: r(spec.HH) });
    else if (spec.H != null && actual > r(spec.H))
      violations.push({ param, tag:'H', severity:'WARNING',
        actual, limit: r(spec.H) });
  }
  return violations;
}
```

## B2. PerfMapData

Static class. Reactor cache, phase envelope cache, phase
boundary cache. Default pump/compressor curves.

Reactor: 25×20 grid, T linear, P log. Warm-start. ~35 ms/rxn.
Phase: single-component VP + mixture bubble/dew from Raoult.
Cache by composition hash. < 0.1 ms.

## B3. Rendering

Common trunk: canvas lifecycle, HiDPI, axes (lin/log), pointer
tracking, markers, limit region overlays, click-to-expand, legend.
Two leaf renderers: pmDrawCurves(), pmDrawHeatmap()+pmDrawContours().
CSS: pm-* classes.

## B4. Alarm Source + Rationalization

Limit source: registered via AlarmSystem.register(). Calls
evaluateLimits() per unit. Extended schema: paramName, paramValue,
limitTag, limitValue, source.

Rationalization: _rationalize() dedup by id. ~10 lines skeleton.

---

# PART C — USE CASE INVENTORY

### Immediate — v11.3.0

| ID | Type | Description | Phase |
|----|------|-------------|-------|
| HS-1 | Retire | electric_heater, sink_heat, cooler | 0 |
| HS-2 | New unit | Inline electric heater | 0 |
| HS-3 | New unit | Air cooler (2nd-law floor) | 0 |
| HS-4 | Modify | Reactor elec_in for heated mode | 0 |
| HS-5 | NNG | NNG-3 physical-equipment clause | 0 |
| PM-1 | Curve map | Species VP envelopes | 3 |
| PM-2 | Curve map | Pump cavitation (bubble P) | 4 |
| PM-3 | Curve map | Compressor condensation (dew P) | 4 |
| PM-4 | Field map | Reactor isothermal feasibility | 5 |
| PM-5 | Field map | Reactor adiabatic feasibility | 5 |
| LM-1 | Limits | S-size limits on 13 units | 2 |
| LM-2 | Alarm | Limit violation alarm source | 2 |
| LM-3 | Alarm | Rationalization skeleton (dedup) | 6 |
| RX-1 | Data | Haber reaction registration | 2 |
| DF-1 | Params | Tank volume 50→0.15 m³ | 2 |
| DF-2 | Params | Reactor volume 1.0→0.003 m³ | 2 |
| DF-3 | Params | Air cooler defaults (T_out, T_approach) | 0 |

### Near-Term — v11.4.0

| ID | Type | Description |
|----|------|-------------|
| PM-6 | Overlay | Limit regions on performance maps |
| PM-7 | Curve | VP curve in component registry modal |
| PM-8 | Field | Reactor maps in reaction registry modal |
| LM-4 | Inspector | Limit bar visualization |
| VIS-1 | Refactor | Registry modal rd-* CSS classes |
| HS-6 | Cleanup | Remove StreamType.HEAT from enum/validation |

### Future — Designed For, Not Built

| ID | Type | Description |
|----|------|-------------|
| PM-9–13 | Maps | Cv, P-Q, surge, efficiency, effectiveness |
| LM-5 | Limits | M/L size data |
| LM-6–9 | Alarm | Cascade, aggregation, shelving, dead-band |
| LM-10 | UI | Player alarm editor (L/H within LL/HH) |
| LM-11 | Alarm | Alarm history log |
| MS-1 | Mission | palette + inventory constraints |
| MS-2 | Mission | limitOverrides per mission |
| MS-3 | Mission | paramLocks per mission |
| MS-4 | Mission | Win condition KPIs in inspector |
| VIS-2–4 | Chart | Time series, bar/pie, Sankey |

---

# PART D — IMPLEMENTATION SEQUENCE

## Full Ordered Sequence

```
Phase 0 — HEAT STREAM DELETION (prerequisite)
  0.1  Register air_cooler (new unit)
  0.2  Rewrite heater tick + ports (elec_in + mat_in → mat_out)
  0.3  Update reactor_equilibrium (heat_in → elec_in)
  0.4  Delete electric_heater, sink_heat registrations
  0.5  Update demo scene
  0.6  Write import migration + version bump
  0.7  Rewrite affected tests (~15)
  0.8  Write new tests (~8)
  0.9  Update NNG-3 (physical-equipment clause)
  0.10 Verify zero StreamType.HEAT producers/consumers
  ── GATE: all existing tests pass ──

Phase 1 — RENDERING INFRASTRUCTURE (parallel with Phase 2)
  1.1  pm-* CSS classes in style block
  1.2  pmSetupCanvas() — HiDPI
  1.3  pmAxisLayout() — margins, lin/log scale functions
  1.4  pmNiceTicks() — linear + log tick generation
  1.5  pmDrawAxes() — grid, ticks, labels
  1.6  pmDrawMarker() — crosshair at operating point
  1.7  pmColorScale() — heatmap palette, sqrt compression
  1.8  pmSpeciesColor() — 8-color categorical
  1.9  PM_AXES_TP default constant
  1.10 ImageData caching + pointer redraw loop
  1.11 pmOpenExpanded() — click-to-expand modal

Phase 2 — LIMITS + ALARM SOURCE + DATA (parallel with Phase 1)
  2.1  LIMIT_PARAM_TEMPLATES dictionary
  2.2  limitParams on 13 unit definitions
  2.3  limits: { S: {...} } on 13 units (from equipment_limits_S_v2)
  2.4  size: 'S' in addUnit() defaults
  2.5  getLimitParam() + _findPrimaryStream() + _computeMassRate()
  2.6  getEffectiveLimits() with future merge point
  2.7  evaluateLimits() pure function
  2.8  AlarmSystem limit source registration
  2.9  Alarm schema extension (paramName, limitTag, etc.)
  2.10 R_HABER reaction registration
  2.11 Tank volume_m3: 50 → 0.15
  2.12 Reactor volume_m3: 1.0 → 0.003
  2.13 Tests T290 (basic violations), T291 (phase),
       T292 (null/missing), T293 (alarm integration)
  ── GATE: all tests pass ──

Phase 3 — PHASE ENVELOPES (depends: Phase 1)
  3.1  PerfMapData.getPhaseEnv() — compute + cache
  3.2  pmDrawCurves() — lines, Tc dots, Tb ticks
  3.3  Legend builder
  3.4  Supercritical species note
  3.5  flash_drum.map hook, air_cooler.map hook
  3.6  Test T295 (Psat accuracy at Tb)

Phase 4 — DYNAMIC PHASE MAPS (depends: Phase 1, 3)
  4.1  PerfMapData.getBubbleCurve() / getDewCurve()
  4.2  Default water/air curves at startup
  4.3  Composition hash cache invalidation
  4.4  pump.map hook
  4.5  compressor.map hook
  4.6  "Default fluid — solve to update" note
  4.7  Test T296 (bubble/dew accuracy)

Phase 5 — REACTOR FEASIBILITY MAPS (depends: Phase 1)
  5.1  PerfMapData.computeReactorMaps() with warm-start
  5.2  _computeReactorGrid() per reaction
  5.3  Stoichiometric feed builder
  5.4  Startup call after registries populated
  5.5  pmDrawHeatmap() — color fill, sqrt compression
  5.6  pmDrawContours() — marching squares + labels
  5.7  reactor_equilibrium.map hook
  5.8  Test T294 (grid structure + spot-checks)

Phase 6 — ALARM RATIONALIZATION (depends: Phase 2)
  6.1  AlarmSystem._rationalize() — dedup by id
  6.2  Wrap evaluate() with rationalize step
  6.3  Test T297 (dedup, highest severity wins)

Phase 7 — WIRING + NNG + FINAL (depends: all above)
  7.1  config?.map block in inspector rendering loop
  7.2  NNG-15 amendment (→ Map section)
  7.3  NNG-16 revision (three-layer pipeline text)
  7.4  Changelog entry v11.3.0
  7.5  Gate: ALL existing tests + T290–T297 + Phase 0 tests pass
```

## Dependency Graph

```
Phase 0 (heat deletion)
  │
  ├──→ Phase 1 (rendering)  ──→ Phase 3 (VP) ──→ Phase 4 (dynamic)
  │                          ──→ Phase 5 (reactor)
  │
  └──→ Phase 2 (limits)     ──→ Phase 6 (alarm rationalization)
                 │
                 └──────────────────────────────→ Phase 7 (wiring)
```

Phase 0 is the gate. Phases 1 and 2 proceed in parallel.
Phases 3-6 follow their dependencies. Phase 7 ties everything.

## Estimated Scope

| Phase | ~Lines | Tests |
|-------|--------|-------|
| 0 | 200 (net −50) | ~8 new, ~15 rewritten |
| 1 | 170 | — |
| 2 | 180 | T290–T293 |
| 3 | 120 | T295 |
| 4 | 80 | T296 |
| 5 | 200 | T294 |
| 6 | 30 | T297 |
| 7 | 80 | — |
| **Total** | **~1060** | **~15 tests** |

---

# PART E — TEST SPECIFICATIONS

### Phase 0 Tests (Heat Stream Deletion)

**T_AC1: Air cooler ambient floor (Planet X)**
air_cooler with T_out=250K, Planet X ambient=288K, approach=10K
→ T_out clamped to 298K, WARNING, clamped=true

**T_AC2: Air cooler ambient floor (Mars)**
air_cooler with T_out=200K, Mars ambient=210K, approach=10K
→ T_out clamped to 220K

**T_AC3: Air cooler cannot heat**
air_cooler with T_out=400K, inlet T=300K → ERROR, passthrough

**T_H1: Heater curtailment**
Heater T_set=500K, inlet=300K, 50% power available
→ T_out between 300K and 500K, curtailed=true

**T_H2: Heater no electrical supply**
Heater with no elec_in → T_out=T_in, passthrough, MAJOR error

**T_H3: Heater cannot cool**
Heater T_set=200K, inlet=300K → WARNING, passthrough

**T_R1: Reactor heated mode exothermic**
Sabatier (exo) + 5kW elec → T_out > adiabatic T_out

**T_R2: Reactor heated mode endothermic**
SMR (endo) + 10kW elec → T_out > insulated T_out

### Phase 2 Tests (Limits)

**T290: Basic violations**
Compressor S, inlet T=700K → HH violation (CRITICAL)
Compressor S, P=13e6 → H violation (WARNING)
Compressor S, T=300K P=5e6 mass=0.02 → no violations

**T291: Phase constraint**
Pump phase required='L', inlet phase='V' → CRITICAL
Pump inlet phase='L' → no violation

**T292: Null, missing, functional**
Unit without limits → []
Size M=null → []
Functional limit called correctly

**T293: Alarm integration**
Scene + compressor T=700K → AlarmSystem.evaluate contains
limit alarm with CRITICAL, paramName='T', limitTag='HH'

### Phase 3–5 Tests (Maps)

**T294: Reactor grid**
getReactor('R_SABATIER'): nT=25, nP=20, values in [0,100]

**T295: Phase envelope**
H₂O Psat(373.15K) ≈ 101325 ± 5%. H₂ in supercritical list.

**T296: Bubble/dew**
Pure H₂O bubble(373K) ≈ 101325 ± 5%.
H₂O+NH₃ bubble > pure H₂O at same T.

### Phase 6 Test (Rationalization)

**T297: Dedup**
Two alarms same id, different severity → 1 alarm, higher wins.

---

# PART F — REFERENCE DOCUMENTS

| Document | Contents |
|----------|----------|
| `heat_stream_deletion.md` | Phase 0: unit specs, migration, NNG-3 |
| `equipment_limits_S_v2.md` | S-size limits, mission compat, Haber rxn |
| `limits_perfmap_design_v5.md` | This document: master design |

---

# PART G — ALARM AUDIT SUMMARY

53 alarm-generating code paths.

| Class | Count | Becomes limit? |
|-------|-------|----------------|
| Phase constraint | 5 | Yes → phase: { required } |
| Process T/P bounds | 4 | Yes → T, P limits |
| Level/capacity | 2 | Yes → level_pct |
| ΔT / approach | 2 | Future → dT limit |
| Setpoint sanity | 1 | Future → relationship |
| Connectivity | 4 | No — topology |
| Configuration | 6 | No — missing params |
| Data integrity | 22 | No — solver bugs |
| Operational | 3 | No — power curtailment |
| System balance | 4 | No — global checks |

14 operational alarms migrate to the limit system.
9 remain as hardcoded logic. 22 stay in STREAM_CONTRACTS.
