# Thermodynamic Refactoring Log
## v0.7 → v0.7.1

### Summary
Centralized all thermodynamic calculations through single `ThermoAdapter` interface.
All internal calculations now use K and Pa. UI conversions happen only at boundaries.

---

## VIOLATIONS FOUND AND FIXED

### 1. PUMP UNIT (lines ~1979-1990)
**Violation:**
```javascript
const pvtLiq = models.getActive('pvt_liquid');  // Direct model access
const compData = ComponentRegistry.get(comp);   // Direct component access
const m_kgs = n * (compData.MW / 1000);         // Manual MW calculation
const rho = pvtLiq.density(comp, T, P);         // Direct density call
```

**Fix:**
```javascript
const m_kgs = thermo.streamMassFlow(sIn);       // Use adapter for mass flow
const rho = thermo.density(comp, sIn.T, sIn.P, 'L');  // Use adapter for density
```

---

### 2. HEATER UNIT (lines ~2171-2178)
**Violation:**
```javascript
const compData = ComponentRegistry.get(comp);
const Cp = thermo.Cp(comp, sIn.T, sIn.P);      // Old thermo model direct call
const MW = compData.MW;                         // Direct MW access
totalHeatCapacity += n_mols * Cp / 1000;        // Manual calculation
```

**Fix:**
```javascript
const Cp_kW_K = thermo.streamCp(sIn);          // Single call for stream Cp
```

---

### 3. HEAT EXCHANGER (lines ~2262-2267)
**Violation:**
```javascript
function calcHeatCapacity(stream) {
  let Cp_total = 0;
  for (const [comp, n_mols] of Object.entries(stream.n)) {
    const Cp = thermo.Cp(comp, stream.T, stream.P);  // Old model call
    Cp_total += n_mols * Cp / 1000;
  }
  return Cp_total;
}
```

**Fix:**
```javascript
const Cp_hot = thermo.streamCp(sHot);          // Direct adapter call
const Cp_cold = thermo.streamCp(sCold);
```

---

### 4. STREAM RENDERING (lines ~3093-3095)
**Violation:**
```javascript
const compData = ComponentRegistry.get(comp);
mTotal += n * (compData.MW / 1000);            // Direct MW access
```

**Fix:**
```javascript
const mTotal = thermo.streamMassFlow(stream);  // Use adapter
```

---

### 5. SOURCE UNIT (lines ~1790+)
**Violation:**
- Phase determination done inline without flash
- Manual phase logic scattered

**Fix:**
```javascript
// Perform flash calculation through adapter
const flashResult = thermo.tpFlash(stream);
// Use flash results for phase, compositions
```

---

## NEW THERMO ADAPTER API

### Core Methods

#### `thermo.getComponentProp(comp, prop)`
- Centralized component property access
- Properties: 'MW', 'Tc', 'Pc', 'omega', etc.
- **Replaces:** Direct `ComponentRegistry.get(comp).MW`

#### `thermo.cpMolar(comp, T_K, P_Pa)`
- Molar heat capacity in J/(mol·K)
- **Replaces:** `thermoModel.Cp(comp, T, P)`
- **Units:** T in K, P in Pa (enforced)

#### `thermo.density(comp, T_K, P_Pa, phaseHint)`
- Density in kg/m³
- Phase hint: 'V' or 'L'
- **Replaces:** Direct `pvtLiq.density(...)` and ideal gas formula

#### `thermo.tpFlash(stream)`
- Returns: `{phase, beta, x, y, nL, nV}`
- **Replaces:** Scattered phase determination logic

#### `thermo.streamCp(stream)`
- Total heat capacity in kW/K for stream
- **Replaces:** Manual loops over components

#### `thermo.streamMassFlow(stream)`
- Total mass flow in kg/s
- **Replaces:** Manual MW loops

---

## INTERNAL UNIT CONVENTIONS

### ALL units now enforce:
1. **Temperature:** Always Kelvin internally
2. **Pressure:** Always Pascal internally
3. **UI conversion:** Only at parameter editor / property display

### Unit System Integration:
```javascript
// Parameter editor (UI → internal)
const T_K = unitSys.temperature.to(userInput);  // User sees °C, internal K

// Property display (internal → UI)
const T_display = unitSys.temperature.from(T_K);  // Internal K, user sees °C
```

---

## FILES MODIFIED

1. `/home/claude/process_grid_v0_5.html`
   - Added `ThermoAdapter` class (lines 1142-1390)
   - Modified pump unit (lines ~2000-2040)
   - Modified heater unit (lines ~2150-2220)
   - Modified heat exchanger (lines ~2250-2370)
   - Modified stream rendering (lines ~3090-3120)

---

## TESTING CHECKLIST

- [ ] Pump: Check liquid density calculation
- [ ] Compressor: Check gamma values, compression work
- [ ] Heater: Check heat duty calculation
- [ ] Heat Exchanger: Check energy balance
- [ ] Display: Verify all temperatures show in user units
- [ ] Parameters: Verify temperature inputs converted properly

---

## FUTURE ENHANCEMENTS

1. **Implement full phFlash** (currently stubbed)
2. **Add enthalpy integration** (currently linear Cp approximation)
3. **Multi-component VLE** (Rachford-Rice for flash)
4. **Phase change detection** in heaters
5. **Accurate Antoine constants** for all components

---

## VERSION NOTES

- **v0.7.0:** Initial heat exchanger implementation (violations present)
- **v0.7.1:** Thermodynamic refactoring (this document)
