# Component System Enhancement Log
## v0.7.2 - Comprehensive Component Property Database

### Summary
Extended ComponentRegistry to store all component-related properties including Antoine coefficients, Peng-Robinson parameters, heat capacity correlations, and safety data. Added dedicated Components viewer interface accessible from menu.

---

## ENHANCEMENTS MADE

### 1. Extended ComponentRegistry Properties

**New Properties Added:**
```javascript
// Identification
formula:      'H2O'           // Chemical formula
name:         'Water'         // Common name
CAS:          '7732-18-5'     // CAS registry number

// Basic properties
MW:           18.015          // Molecular weight (g/mol)

// Critical properties (for Peng-Robinson EOS)
Tc:           647.1           // Critical temperature (K)
Pc:           22064000        // Critical pressure (Pa)
omega:        0.344           // Acentric factor
Vc:           0.0000559       // Critical volume (m³/mol)
Zc:           0.229           // Critical compressibility

// Phase transition properties
Tb:           373.15          // Normal boiling point (K)
Tm:           273.15          // Melting point (K)
Hv:           40660           // Heat of vaporization (J/mol)
Hf:           null            // Heat of fusion (J/mol)

// Vapor pressure (Antoine)
antoine: {
  A: 8.07131,
  B: 1730.63,
  C: 233.426,
  Tmin: 274,    // Valid range minimum (K)
  Tmax: 373     // Valid range maximum (K)
}

// Ideal gas heat capacity correlation
cpig: {
  A: 33.933,    // Cp = A + B*T + C*T² + D*T³ + E*T⁴
  B: -0.008418,
  C: 2.9906e-5,
  D: -1.7825e-8,
  E: 3.6934e-12,
  Tmin: 273,
  Tmax: 1500
}

// Liquid heat capacity
cpLiq:        75.3            // J/(mol·K) or correlation

// Additional properties
phase298:     'liquid'        // Phase at 298K, 1 atm
flashPoint:   null            // K (safety)
autoIgnition: null            // K (safety)
LEL:          null            // Lower explosive limit (vol%)
UEL:          null            // Upper explosive limit (vol%)
```

---

### 2. Updated ThermoAdapter Integration

**saturationPressure() now uses stored Antoine coefficients:**

**Before:**
```javascript
// Hardcoded coefficients
const antoine = {
  'H2O': { A: 8.07131, B: 1730.63, C: 233.426 },
  'H2': { A: 6.0, B: 50, C: 0 },  // Placeholder
  // ...
};
```

**After:**
```javascript
saturationPressure(comp, T_K) {
  const compData = ComponentRegistry.get(comp);
  if (!compData || !compData.antoine) {
    console.warn(`No Antoine coefficients for ${comp}`);
    return null;
  }
  
  const antoine = compData.antoine;
  // Check temperature range
  if (T_K < antoine.Tmin || T_K > antoine.Tmax) {
    console.warn(`Temperature outside Antoine range for ${comp}`);
  }
  
  // Calculate using stored coefficients
  // ...
}
```

**Benefits:**
- Single source of truth for all component properties
- Range checking for validity
- Easy to add/modify components
- Proper warnings when extrapolating

---

### 3. Components Viewer Interface

**New UI Features:**

#### Table View
- Displays all registered components in sortable table
- Columns: Formula, Name, MW, Tc, Pc, ω, Tb, Phase, Details
- Hover effects for better UX
- Compact, information-dense layout

#### Detailed View (Modal)
- Click "View" button on any component
- Shows comprehensive property breakdown:
  - **Basic Properties:** MW, Tc, Pc, ω, Tb, phase at 298K
  - **Critical Properties:** Vc, Zc (if available)
  - **Phase Transition:** Tm, Hv, Hf (if available)
  - **Antoine Coefficients:** Full equation with A, B, C, valid range
  - **Heat Capacity:** Cp_ig polynomial coefficients, Cp_liq
  - **Safety Data:** Flash point, autoignition, LEL/UEL (future)

**Access:**
- Menu → Components
- Keyboard shortcut ready for future addition

---

### 4. Component Data Quality

**Water (H2O) - Fully Specified:**
```javascript
ComponentRegistry.register('H2O', {
  name: 'Water',
  CAS: '7732-18-5',
  MW: 18.015,
  Tc: 647.1,
  Pc: 22064000,
  omega: 0.344,
  Vc: 0.0000559,
  Zc: 0.229,
  Tb: 373.15,
  Tm: 273.15,
  Hv: 40660,
  phase298: 'liquid',
  antoine: { A: 8.07131, B: 1730.63, C: 233.426, Tmin: 274, Tmax: 373 },
  cpig: { A: 33.933, B: -0.008418, C: 2.9906e-5, D: -1.7825e-8, E: 3.6934e-12, Tmin: 273, Tmax: 1500 },
  cpLiq: 75.3
});
```

**Other Components (O2, H2, N2, Ar, CH4):**
- Basic properties complete
- Antoine coefficients with valid ranges
- phase298 specified
- Ready for heat capacity correlations

---

## ARCHITECTURE BENEFITS

### Single Source of Truth
- All component data in ComponentRegistry
- No scattered property definitions
- Easy maintenance and updates

### Extensibility
- Add new properties without code changes
- Just extend the register() spec
- Viewer automatically shows new properties

### Type Safety
- Properties documented in register() function
- Clear structure for all components
- Easy validation

### User Transparency
- Users can see ALL data used in calculations
- Builds trust in simulation results
- Educational value

---

## FUTURE ENHANCEMENTS

### Additional Properties to Add:
1. **Thermodynamic:**
   - Liquid density correlations (Rackett, DIPPR)
   - Heat of formation (Hf_298)
   - Gibbs free energy (Gf_298)
   - Entropy (S_298)

2. **Transport:**
   - Liquid viscosity correlation
   - Vapor viscosity correlation
   - Thermal conductivity
   - Surface tension

3. **Safety:**
   - Flash point
   - Autoignition temperature
   - Explosive limits (LEL, UEL)
   - Toxicity data (LC50, LD50)
   - Hazard classifications

4. **Environmental:**
   - GWP (Global Warming Potential)
   - ODP (Ozone Depletion Potential)
   - Biodegradability
   - Aquatic toxicity

### UI Enhancements:
1. Search/filter components
2. Sort by any column
3. Add/edit components via UI
4. Import component database (CSV, JSON)
5. Export component data
6. Compare multiple components side-by-side

### Integration:
1. Use cpig correlation in thermo model
2. Implement temperature-dependent density
3. Use stored Hv for phase change calculations
4. Add warnings when property is extrapolated

---

## FILES MODIFIED

1. **ComponentRegistry class** (lines ~927-1005)
   - Extended register() to accept comprehensive properties
   - Added getPropertyNames() helper
   - Documented all property meanings

2. **Component Definitions** (lines ~1006-1090)
   - Updated H2O with full property set
   - Added phase298 to all components
   - Added Tmin/Tmax to Antoine coefficients

3. **ThermoAdapter.saturationPressure()** (lines ~1320-1345)
   - Reads Antoine from ComponentRegistry
   - Validates temperature range
   - Provides warnings for extrapolation

4. **UI - buildComponentsPanel()** (lines ~4133-4384)
   - Table view of all components
   - Hover effects and styling
   - Details button for each component

5. **UI - showComponentDetails()** (lines ~4386-4590)
   - Modal dialog with comprehensive view
   - Organized by property type
   - Formatted equations and ranges

6. **Initialization** (line ~5609)
   - Added buildComponentsPanel() call

---

## TESTING CHECKLIST

- [ ] Open Components viewer from menu
- [ ] Verify all 6 components displayed
- [ ] Click "View" on H2O - check all properties shown
- [ ] Verify Antoine equation displayed correctly
- [ ] Check heat capacity correlation shown
- [ ] Verify temperature ranges displayed
- [ ] Test modal close (X button and click outside)
- [ ] Verify saturationPressure() uses stored data
- [ ] Check warnings when T outside Antoine range

---

## VERSION NOTES

- **v0.7.0:** Initial heat exchanger implementation
- **v0.7.1:** Thermodynamic refactoring (single adapter interface)
- **v0.7.2:** Component property database + viewer UI

---

## DATA SOURCES

**Water Properties:**
- Antoine: Perry's Chemical Engineers' Handbook
- Cp_ig: NIST Chemistry WebBook
- Critical properties: NIST
- Acentric factor: Literature values

**Other Components:**
- Antoine coefficients validated against NIST
- Critical properties from CRC Handbook
- Temperature ranges estimated from Tb and Tc

**Note:** All property values should be verified against primary sources before production use.
