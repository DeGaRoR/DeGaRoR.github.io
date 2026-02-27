# PTIS S-CLEAN SPEC
## Codebase Cleanup — Naming Harmonization
### Post-S5-lite (v14.0.0 → v14.1.0)

---

## Audit Summary

A full sweep of UnitRegistry, ProfileRegistry, and port/parameter
naming across all 21 units reveals systematic inconsistencies that
accumulated as the codebase grew organically. This spec consolidates
the cleanup into a single phase with a clear migration path.

---

## Issue 1: Port Naming Chaos

### Current State

**Material IN ports — 4 conventions:**

| Convention | Units |
|---|---|
| `mat_in` | pump, compressor, electric_heater, air_cooler, reactor_equilibrium, gas_turbine, tank, flash_drum, distillation_column |
| `in` | valve, splitter¹, sink |
| `in1`, `in2` | mixer |
| `hot_in`, `cold_in` | hex |

¹ Splitter becomes flow divider in S5-lite.

**Material OUT ports — 7 conventions:**

| Convention | Units |
|---|---|
| `mat_out` | pump, compressor, electric_heater, air_cooler, reactor_equilibrium, gas_turbine |
| `gas_out` | tank (vapor draw) |
| `liq_out` | tank (liquid draw) |
| `out` | source, source_multi, source_air, valve, mixer |
| `out1`, `out2` | splitter |
| `hot_out`, `cold_out` | hex |
| `vap_out`, `liq_out` | flash_drum |
| `mat_out_D`, `mat_out_B` | distillation_column |
| `overflow`, `vent` | tank (special purpose) |

**Electrical ports — 4 conventions:**

| Convention | Units |
|---|---|
| `elec_in` | pump, compressor, electric_heater, air_cooler, reactor, distillation, power_hub |
| `elec_out` | gas_turbine, power_hub |
| `out` | grid_supply ← **wrong** (ELECTRICAL type, material naming) |
| `in` | sink_electrical ← **wrong** (ELECTRICAL type, material naming) |
| `elec` | battery (bidirectional) |
| `elec_surplus` | power_hub (special purpose) |

### Proposed Standard

**Rule: `{type}_{direction}` for single-purpose ports, with
semantic qualifiers for multi-port units.**

**Material ports:**

| Pattern | When | Example |
|---|---|---|
| `mat_in` | Single material inlet | pump, compressor, heater, reactor |
| `mat_out` | Single material outlet | pump, compressor, heater, reactor |
| `mat_in_1`, `mat_in_2` | Numbered inlets | mixer |
| `mat_out_1`, `mat_out_2` | Numbered outlets | flow divider |
| `{semantic}_in`, `{semantic}_out` | Domain-specific multi-stream | hex: `hot_in`/`hot_out`/`cold_in`/`cold_out`; tank: `gas_out`/`liq_out` |
| `{semantic}_out` | Special purpose (safety/separation) | flash_drum: `vap_out`/`liq_out`; distillation: `dist_out`/`bot_out`; tank: `overflow`/`vent` |

**Electrical ports:**

| Pattern | When | Example |
|---|---|---|
| `elec_in` | Single electrical inlet | pump, compressor, heater |
| `elec_out` | Single electrical outlet | gas_turbine |
| `elec` | Bidirectional | battery |
| `elec_surplus` | Special purpose | power_hub |

### Migration Table

| Unit | Current | Proposed | Breaking? |
|---|---|---|---|
| **sink** | `in` | `mat_in` | Yes |
| **valve** | `in`, `out` | `mat_in`, `mat_out` | Yes |
| **splitter** | `in`, `out1`, `out2` | `mat_in`, `mat_out_1`, `mat_out_2` | Yes |
| **mixer** | `in1`, `in2`, `out` | `mat_in_1`, `mat_in_2`, `mat_out` | Yes |
| **source** | `out` | `mat_out` | Yes |
| **source_multi** | `out` | `mat_out` | Yes (merged) |
| **source_air** | `out` | `mat_out` | Yes (merged) |
| **grid_supply** | `out` | `elec_out` | Yes |
| **sink_electrical** | `in` | `elec_in` | Yes |
| **distillation** | `mat_out_D`, `mat_out_B` | `dist_out`, `bot_out` | Yes |
| **tank** | `mat_in`, `gas_out`, `liq_out`, `vent`, `overflow` | keep (all semantic) | No |
| **hex** | `hot_in`/`hot_out`/`cold_in`/`cold_out` | keep | No |
| **flash_drum** | `vap_out`, `liq_out` | keep | No |
| **pump, comp, etc.** | `mat_in`, `mat_out`, `elec_in` | keep | No |
| **gas_turbine** | `mat_in`, `mat_out`, `elec_out` | keep | No |
| **power_hub** | `elec_in`, `elec_out`, `elec_surplus` | keep | No |
| **battery** | `elec` | keep | No |

**Resolved:** Tank keeps `mat_in` (S5-lite spec updated). Consistent
with tank_cryo (S9) and all other single-inlet material units.
No S-CLEAN migration needed for tank ports.

### Impact Assessment

| Area | Count | Migration |
|---|---|---|
| Unit registrations | 10 units | Port arrays + presentation maps |
| Profile registrations | ~10 profiles | No change (profiles don't store ports) |
| Demo scene connections | ~30 wires | Update portId fields |
| Test wires | ~300+ | Update t.wire() and t.port() calls |
| Solver port references | ~10 sites | ports.in → ports.mat_in etc. |
| Inspector port display | ~5 sites | Port label rendering |

**Total estimated touch points:** ~360. Large but mechanical — find
and replace with regex, then run full test suite.

---

## Issue 2: Source Consolidation

### Current State

Three defIds doing the same thing with different parameterization:

| defId | Tick parameterization | Test refs |
|---|---|---|
| `source` | `par.species` + `par.nDot` → single species | 224 |
| `source_multi` | `par.n` → object of {species: mol/s} | 80 |
| `source_air` | `SimSettings.atmosphere` → locked composition | 4 |

All three:
- Have identical port topology: single `out` (MATERIAL)
- Have identical presentation variants
- Are boundary units (no limits, no tiers beyond 1)
- Emit a MATERIAL stream with T, P, n, phaseConstraint

`source` is a special case of `source_multi` where `n = { [species]: nDot }`.
`source_air` is a special case of `source_multi` where n, T, P are
all locked to the atmospheric preset.

### Proposed: Single `source` defId with Profiles

**Unified tick:**

```javascript
UnitRegistry.register('source', {
  name: 'Source',
  category: UnitCategories.SOURCE,
  w: 2, h: 2,
  ports: [{ portId: 'mat_out', dir: PortDir.OUT,
            type: StreamType.MATERIAL, x: 2, y: 1 }],
  presentations: { /* same 4 variants */ },

  tick(u, ports, par) {
    let T_K, P_Pa, n, phaseConstraint;

    if (par._atmospheric) {
      // Locked to atmosphere preset
      const atm = SimSettings.getAtmosphere();
      T_K = atm.T_K;
      P_Pa = atm.P_Pa;
      n = {};
      const flowScale = par.flowScale ?? 1.0;
      for (const [sp, frac] of Object.entries(atm.air)) {
        if (ComponentRegistry.exists(sp)) n[sp] = frac * flowScale;
      }
      phaseConstraint = 'V';
      u.last = { T: T_K, P: P_Pa, flowScale, preset: atm.presetName };
    } else {
      // User-defined composition
      n = {};
      if (par.n && typeof par.n === 'object') {
        // Multi-component: par.n = { species: mol_s, ... }
        for (const [sp, flow] of Object.entries(par.n)) {
          if (!ComponentRegistry.exists(sp)) {
            u.last = { error: { severity: ErrorSeverity.CATASTROPHIC,
              message: `Unknown species '${sp}' in composition` } };
            return;
          }
          n[sp] = flow;
        }
      } else if (par.species && par.nDot != null) {
        // Legacy single-component: par.species + par.nDot
        if (!ComponentRegistry.exists(par.species)) {
          u.last = { error: { severity: ErrorSeverity.CATASTROPHIC,
            message: `Unknown species '${par.species}'` } };
          return;
        }
        n[par.species] = par.nDot;
      }

      const atm = SimSettings.getAtmosphere();
      T_K = par.T ?? atm.T_K;
      P_Pa = par.P ?? atm.P_Pa;
      phaseConstraint = par.phaseConstraint || 'V';

      if (T_K < 1) { T_K = 1; }
      else if (T_K > 5000) { T_K = 5000; }
    }

    ports.mat_out = {
      type: StreamType.MATERIAL,
      T: T_K, P: P_Pa, n,
      phaseConstraint
    };
  }
});
```

**Profiles (replace 3 registrations):**

```javascript
// Pure-component source (replaces 'source' defId)
ProfileRegistry.register('source_pure', {
  defId: 'source', name: 'Source',
  category: UnitCategories.SOURCE, tiers: [1],
  limits: {}, boundary: true,
  defaults: { 1: { species: 'N2', nDot: 1.0 } }
});

// Multi-component source (replaces 'source_multi' defId)
ProfileRegistry.register('source_mix', {
  defId: 'source', name: 'Multi Source',
  category: UnitCategories.SOURCE, tiers: [1],
  limits: {}, boundary: true,
  defaults: { 1: { n: { N2: 0.78, O2: 0.21, Ar: 0.01 } } }
});

// Atmospheric source (replaces 'source_air' defId)
ProfileRegistry.register('source_atmosphere', {
  defId: 'source', name: 'Atmospheric Intake',
  category: UnitCategories.SOURCE, tiers: [1],
  limits: {}, boundary: true,
  defaults: { 1: { _atmospheric: true, flowScale: 1.0 } }
});
```

### Migration

| Old defId | Old profile | New profile | Scene migration |
|---|---|---|---|
| `source` | `source` | `source_pure` | defId stays `source` |
| `source_multi` | `source_multi` | `source_mix` | defId: `source_multi` → `source` |
| `source_air` | `source_air` | `source_atmosphere` | defId: `source_air` → `source` |

**Scene import migration:**
```javascript
for (const [id, u] of scene.units) {
  if (u.defId === 'source_multi') {
    u.defId = 'source';
    u.profileId = 'source_mix';
  }
  if (u.defId === 'source_air') {
    u.defId = 'source';
    u.profileId = 'source_atmosphere';
    u.params._atmospheric = true;
  }
}
```

**Test migration:** 80 `place('source_multi', ...)` → `place('source', ..., { n: {...} })`.
4 `place('source_air', ...)` → `place('source', ..., { _atmospheric: true })`.
224 `place('source', ...)` → unchanged (legacy par.species/nDot path).

---

## Issue 2b: Profile System Scope Check

### What Profiles Do

Profiles are named parameter presets on a shared defId. Same ports,
same tick function, different defaults and limits. The ProfileRegistry
stores: `{ defId, name, category, tiers, limits, defaults, boundary }`.

Profiles do NOT change: port topology, tick logic, config flags,
or trunk assignment.

### What Requires a New defId (NNG-3)

Different ports, different physics branching (config flag in trunk),
or fundamentally different computation. S9 already decided:

| defId | Trunk | Ports | Why separate |
|---|---|---|---|
| `tank` | vesselTick | mat_in, gas_out, liq_out, vent, overflow | 5-port vessel with phase draws |
| `tank_cryo` | vesselTick | mat_in, gas_out, liq_out, vent, overflow | Config: boil-off model, cryo limits |
| `reservoir` | vesselTick | mat_out only | No inventory, no depletion, 1 port |
| `gas_turbine` | expanderTick | mat_in, mat_out, elec_out | Gas expansion |
| `steam_turbine` | expanderTick | mat_in, mat_out, elec_out | Config: moisture check |

tank_cryo (S9) should adopt the same 5-port topology as tank.

### Tank Profile Roadmap

All profiles below share the `tank` defId and vesselTick trunk.
They differ only in limits, defaults, and display name:

| Profile | Name | tankMode | T range | P range | Use case |
|---|---|---|---|---|---|
| `tank_atmospheric` | Atmospheric Tank | vented | 263–353 K | ~1 bar | Water storage, buffers |
| `tank_pressure` | Pressure Vessel | sealed | 233–523 K | ≤50 bar | Process intermediates |

Future profiles (same defId, no code changes):

| Profile | Name | tankMode | T range | P range | Use case |
|---|---|---|---|---|---|
| `tank_hp` | HP Vessel | sealed | 233–623 K | ≤200 bar | Gas storage |
| `tank_jacketed` | Jacketed Vessel | sealed | 233–473 K | ≤20 bar | Temperature-controlled |

`tank_cryo` is a separate defId (S9) because cryogenic insulation
and boil-off physics require config-flag branching in vesselTick —
not just different limits.

### Source Profile Roadmap

All profiles share the `source` defId. They differ in parameter
defaults and the `_atmospheric` flag:

| Profile | Name | Parameterization | Use case |
|---|---|---|---|
| `source_pure` | Source | `species` + `nDot` (single species) | Simple feeds |
| `source_mix` | Multi Source | `n: { sp: mol_s }` (multi-component) | Complex feeds |
| `source_atmosphere` | Atmospheric Intake | `_atmospheric: true` (locked to preset) | Air intake |

The tick handles all three via a single `if/else` on `par._atmospheric`
and `par.n` vs `par.species`. No config flags, no trunk branching —
just parameter interpretation. This is exactly what profiles are for.

### Conclusion

The profile system is not being overloaded. The boundary between
"same defId, different profile" and "different defId" is clear:

- **Same ports + same physics** → profile (parameter preset)
- **Different ports OR different physics** → defId (NNG-3)

---

## Issue 3: Electrical Boundary Port Names

### Current State

| Unit | Port | Type | Convention |
|---|---|---|---|
| grid_supply | `out` | ELECTRICAL | ❌ material convention |
| sink_electrical | `in` | ELECTRICAL | ❌ material convention |

Every other unit with electrical ports uses `elec_in`/`elec_out`.
These two boundary units break the pattern.

### Fix

| Unit | Current | Proposed |
|---|---|---|
| grid_supply | `out` | `elec_out` |
| sink_electrical | `in` | `elec_in` |

**Impact:** Small. grid_supply appears in ~5 demo wires and ~10 tests.
sink_electrical appears in ~3 demo wires and ~5 tests.

---

## Issue 4: Parameter Naming Inconsistencies

### Current State

| Concern | Examples | Severity |
|---|---|---|
| **NNG-8 violation** | `par.P_column_bar` on distillation_column stores bar, all other units store Pa | **High** |
| **Temperature unit ambiguity** | `par.T` (K? °C?), `par.T_out` (K) | Medium |
| **Pressure unit ambiguity** | `par.P` (Pa), `par.Pout` (Pa), `par.P_column_bar` (bar!) | High |
| **Flow parameterization** | `par.nDot` (source), `par.n` (source_multi), `par.flowScale` (source_air) | High (fixed by consolidation) |
| **CamelCase vs snake_case** | `par.nDot`, `par.splitPct`, `par.flowScale` vs `par.P_column_bar`, `par.T_out` | Low |

**NNG-8 violation detail:** The distillation column at line 15100
converts `par.P_column_bar` to Pa at the tick boundary:
`const P_col = (par.P_column_bar ?? 1.0) * 1e5`. NNG-8 permits
user-facing params in display units with conversion at the tick
boundary, so the tick itself is compliant. BUT: every other unit
stores pressure in Pa (`par.P`, `par.Pout`). The inspector at
line 24085 shows `'Column P (bar)'` with bar-unit clamping. This
is the only param in the entire codebase that stores a non-SI value.
It should be `par.P_column_Pa` (or just `par.P_column`) in Pa, with
the inspector doing the ÷1e5 display conversion — same as every
other pressure display in the inspector.

### Proposed Convention

**Units in parameter names:**
- Temperature: always `_K` suffix if explicit → `T_K`, `T_out_K`
- Pressure: always `_Pa` suffix if explicit → `P_Pa`, `Pout_Pa`, `P_column_Pa`
- Bare `T` and `P` acceptable ONLY when the unit is unambiguous from
  context (e.g., `par.T` on a source is always K).

**Naming style:** snake_case for compound names. `split_pct`, `flow_scale`,
`n_dot`, `T_out`, `P_out`.

### Decision Needed

This is a deep refactor touching every unit's params, every test's
params, every demo scene's params, and the inspector's parameter
display logic. The benefit is consistency; the cost is ~500 touch
points.

**Recommendation:** Defer broad parameter renaming (snake_case,
unit suffixes) to a future sprint. BUT: fix the distillation column's
`P_column_bar` → `P_column` (Pa) as part of S-CLEAN Phase 1.
This is a genuine NNG-8 violation — the only param in the codebase
storing a non-SI value. Small fix (~10 touch points: registration,
tick, inspector, profile defaults, 5 tests).

---

## Issue 5: Category Inconsistencies

### Current State

The UnitCategories object has 7 real categories and 8 legacy aliases.
All aliases resolve correctly. No units reference dead categories.

| Category | Units | Status |
|---|---|---|
| BOUNDARY | source×3, sink | ✅ |
| HEAT_TRANSFER | electric_heater, air_cooler, hex | ✅ |
| PRESSURE | gas_turbine, valve, pump, compressor | ✅ |
| REACTOR | reactor_equilibrium | ✅ |
| SEPARATION | flash_drum, distillation, mixer, splitter | ✅ |
| STORAGE | tank | ✅ |
| POWER | grid_supply, battery, power_hub, sink_electrical | ✅ |

**Post S5-lite:** reservoir joins BOUNDARY (via SOURCE alias). restriction
joins PRESSURE. Tank profiles may want to stay in STORAGE or move to
a new VESSEL category (currently an alias for STORAGE).

**No action needed.** Categories are clean.

---

## Issue 6: Display Name Updates (S5-lite + S-CLEAN)

### Full Name Audit

| defId | Current Name | Proposed Name | Reason |
|---|---|---|---|
| valve | Valve | Pressure Regulator | S5-lite: reflects actual behavior |
| splitter | Splitter | Flow Divider | S5-lite: active device, not passive |
| source | Source | Source | Keep (with profiles for variants) |
| source_multi | Source (Mix) | *(merged)* | Absorbed into `source` |
| source_air | Air Source | *(merged)* | Absorbed into `source` |
| sink_electrical | Electrical Sink | Power Sink | Consistency with grid_supply |
| distillation_column | Distillation Column | Keep | Fine |
| All others | — | Keep | Fine |

---

## Implementation Plan

### Phase 1: Port Naming + Distillation Bar Fix (mechanical, high impact)

1. Update 10 unit registrations (port arrays + presentations)
2. Fix `P_column_bar` → `P_column` (Pa) in distillation_column
   (registration, tick, inspector, profile, scene migration, tests)
3. Update demo scene wires (~30)
4. Update test wires (~300+)
5. Update solver port references (~10)
6. Scene import migration function
7. Run full test suite

**Approach:** Write a migration script that does the rename in all
connections and ports, run it on the test file itself, verify test
count unchanged.

### Phase 2: Source Consolidation

1. Write unified tick function
2. Register 3 profiles on single `source` defId
3. Remove `source_multi` and `source_air` registrations
4. Scene import migration
5. Test migration (84 places)
6. Run full test suite

### Phase 3: Electrical Boundary Ports

1. grid_supply: `out` → `elec_out`
2. sink_electrical: `in` → `elec_in`
3. Update wires and tests (~15 places)

### Phase 4: Display Names

1. valve → "Pressure Regulator" (S5-lite, may already be done)
2. splitter → "Flow Divider" (S5-lite, may already be done)
3. sink_electrical → "Power Sink"
4. Profile display names for merged sources

### Deferred

- Parameter renaming (snake_case, unit suffixes) — separate sprint
- Category restructuring — not needed

---

## Tests

No new functional tests. All existing tests must pass after
migration. The test migration itself is the validation — if a
portId rename breaks a wire, the test fails.

**Gate:** 440 tests (post S5-lite), zero delta.

---

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Massive mechanical refactor (~400 touch points) | Regex-based migration script, full test gate |
| Scene import compat for saved scenes | Migration function in scene loader |
| Demo scenes break | Updated alongside code |
| Merge conflicts with S5-lite | Run S-CLEAN after S5-lite merges |

**Recommendation:** Run S-CLEAN immediately after S5-lite lands (v14.0.0
→ v14.1.0). The port rename scope overlaps with S5-lite's tank port
change — better to do both cleanups together than to rename twice.

---

## Decision Log

| Decision | Options | Chosen | Rationale |
|---|---|---|---|
| Tank inlet port | `mat_in` vs `feed_in` | **`mat_in`** | Consistent with 9 other units + tank_cryo (S9). S5-lite spec updated. |
| Parameter renaming | Now vs later | **Later** | ~500 touches, low functional impact |
| Source defId | Keep `source` vs new name | **Keep `source`** | Minimal disruption, 224 test refs |
| Electrical boundary naming | Now vs later | **Now** | Only ~15 touches, high consistency value |
